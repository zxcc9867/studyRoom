export const envDefault = (name) => globalThis.Deno?.env.get(name);
export const fail = (code) => { throw new Error(code); };
export const unwrap = ({ data, error }) => {
    if (error)
        fail('storage_error');
    return data;
};
const bytes = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const base64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
export async function seal(value, key, context) {
    if (!key)
        fail('integration_not_configured');
    const raw = bytes(key);
    if (raw.length !== 32)
        fail('integration_not_configured');
    const k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) }, k, new TextEncoder().encode(JSON.stringify(value)));
    return `${base64(iv)}.${base64(cipher)}`;
}
export async function unseal(value, key, context) {
    const [iv, cipher] = value.split('.');
    const k = await crypto.subtle.importKey('raw', bytes(key), 'AES-GCM', false, ['decrypt']);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv), additionalData: new TextEncoder().encode(context) }, k, bytes(cipher))));
}
export async function requestJson(url, options = {}, fetcher = fetch) {
    const signal = AbortSignal.any([AbortSignal.timeout(12000), ...(options.signal ? [options.signal] : [])]);
    signal.throwIfAborted();
    const response = await fetcher(url, { ...options, redirect: 'error', signal });
    if (!response.ok)
        fail(response.status === 401 || response.status === 403 ? 'connection_authorization_required' : 'provider_unavailable');
    const maximum = 2 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > maximum) {
        await response.body?.cancel();
        fail('provider_response_too_large');
    }
    const reader = response.body?.getReader();
    if (!reader)
        fail('provider_empty_response');
    const abort = () => { void reader.cancel().catch(() => { }); };
    signal.addEventListener('abort', abort, { once: true });
    const decoder = new TextDecoder();
    let length = 0, text = '';
    try {
        while (true) {
            signal.throwIfAborted();
            const chunk = await reader.read();
            signal.throwIfAborted();
            if (chunk.done)
                break;
            length += chunk.value.byteLength;
            if (length > maximum) {
                await reader.cancel();
                fail('provider_response_too_large');
            }
            text += decoder.decode(chunk.value, { stream: true });
        }
        return JSON.parse(text + decoder.decode());
    }
    finally {
        signal.removeEventListener('abort', abort);
        reader.releaseLock();
    }
}
export async function googlePages(url, token, fetcher = fetch, options = {}) {
    const out = [];
    let page;
    const seen = new Set();
    do {
        const next = new URL(url);
        if (page)
            next.searchParams.set('pageToken', page);
        const data = await requestJson(next, { headers: { Authorization: `Bearer ${token}` }, signal: options.signal }, fetcher);
        out.push(...(data.items || []));
        if (out.length > (options.maxItems ?? 999))
            fail('calendar_too_large');
        page = data.nextPageToken;
        if (page && seen.has(page))
            fail('invalid_pagination');
        seen.add(page);
        if (seen.size > 100)
            fail('calendar_too_large');
    } while (page);
    return out;
}
export function calendarEvent(event, calendarId, timeZone) {
    if (event.status === 'cancelled' || event.transparency === 'transparent' || event.attendees?.some(a => a.self && a.responseStatus === 'declined'))
        return null;
    const allDay = !!event.start?.date;
    if (!event.id || !event.start || !event.end)
        fail('invalid_calendar_event');
    if (!allDay && (!Number.isFinite(Date.parse(event.start.dateTime)) || Date.parse(event.end.dateTime) <= Date.parse(event.start.dateTime)))
        fail('invalid_calendar_event');
    if (allDay && (!/^\d{4}-\d{2}-\d{2}$/.test(event.start.date) || event.end.date <= event.start.date))
        fail('invalid_calendar_event');
    return { source: 'google', external_id: `${calendarId}:${event.id}`, title: String(event.summary || '일정').slice(0, 200), all_day: allDay, start_at: allDay ? null : event.start.dateTime, end_at: allDay ? null : event.end.dateTime, start_date: allDay ? event.start.date : null, end_date: allDay ? event.end.date : null, time_zone: event.start.timeZone || timeZone, repeat_weekdays: [] };
}
export function safeSource(path, size = 0) {
    if (typeof path !== 'string' || !Number.isFinite(size) || size < 0 || size > 24000)
        return false;
    const parts = path.replaceAll('\\', '/').split('/');
    if (parts.some(part => !part || part.startsWith('.') || /^(node_modules|vendor|dist|build|coverage|secrets?|credentials?|certs?|keys?)$/i.test(part)))
        return false;
    return !/(\.env|lock\.|\.lock$|\.pem$|\.key$|credentials|secret|token|service[-_]?account)/i.test(path) && /\.(ts|tsx|js|jsx|mjs|py|go|rs|json)$/.test(path);
}
export function redactSource(text) {
    if (typeof text !== 'string' || text.includes('\0'))
        return false;
    // Exclude the complete file when recognizable credentials occur. Do not replace
    // substrings and risk sending a partially redacted credential to an AI provider.
    const credentialPatterns = [
        /-----BEGIN\s+(?:[A-Z0-9]+\s+)*PRIVATE KEY-----/i,
        /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{12,}/,
        /\bsk-(?:proj-|or-v1-|ant-api\d+-)?[A-Za-z0-9_-]{12,}/,
        /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
        /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
        /\bAIza[A-Za-z0-9_-]{30,}/,
        /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
        /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s/@:]+:[^\s/@]+@/i,
        /\b(?:accountkey|sharedaccesskey|password|pwd)\s*=\s*[^;\s]{6,}/i,
        /\b(?:api[_-]?key|access[_-]?key|private[_-]?key|password|passwd|secret|token|authorization|client[_-]?secret)\b["']?\s*[:=]\s*["'`][^"'`\r\n]{6,}/i,
        /\b(?:Basic|Bearer)\s+[A-Za-z0-9_+\/.=-]{16,}/i,
    ];
    return !credentialPatterns.some(pattern => pattern.test(text));
}
export function repositoryTasks(files, sha) {
    const tasks = [];
    for (const file of files) {
        const lines = file.text.split('\n');
        const line = lines.findIndex(l => /\b(fetch\(|requests\.|axios\.)/.test(l));
        if (line >= 0 && !/AbortSignal|timeout\s*[:=]/.test(file.text))
            tasks.push({ title: '외부 요청에 시간 제한과 실패 처리를 추가하세요', duration_minutes: 30, acceptance: '느린 외부 응답과 실패 응답을 테스트로 검증합니다.', evidence: [{ sha, path: file.path, line: line + 1 }], source: 'rules' });
        const todo = lines.findIndex(l => /\b(TODO|FIXME)\b/.test(l));
        if (todo >= 0)
            tasks.push({ title: '미완료 구현 메모를 검토하고 작은 작업으로 해결하세요', duration_minutes: 30, acceptance: '메모의 요구사항을 확인하고 변경 동작을 검증합니다.', evidence: [{ sha, path: file.path, line: todo + 1 }], source: 'rules' });
        if (tasks.length >= 3)
            break;
    }
    return tasks.slice(0, 3);
}
