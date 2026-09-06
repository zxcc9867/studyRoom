export const envDefault = (name) => globalThis.Deno?.env.get(name);
export const fail = (code) => { throw new Error(code); };
export const unwrap = ({ data, error }) => { if (error)
    fail('storage_error'); return data; };
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
    const response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok)
        fail(response.status === 401 || response.status === 403 ? 'connection_authorization_required' : 'provider_unavailable');
    const text = await response.text();
    if (text.length > 2000000)
        fail('provider_response_too_large');
    return JSON.parse(text);
}
export async function googlePages(url, token, fetcher = fetch) {
    const out = [];
    let page;
    const seen = new Set();
    do {
        const next = new URL(url);
        if (page)
            next.searchParams.set('pageToken', page);
        const data = await requestJson(next, { headers: { Authorization: `Bearer ${token}` } }, fetcher);
        out.push(...(data.items || []));
        if (out.length > 10000)
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
    return size <= 24000 && !/(^|\/)(\.|node_modules|vendor|dist|build|coverage|lock|secrets?)(\/|$)/i.test(path) && !/(\.env|lock\.|\.lock$|\.pem$|\.key$|credentials|secret|token)/i.test(path) && /\.(ts|tsx|js|jsx|mjs|py|go|rs|json)$/.test(path);
}
export function redactSource(text) {
    return !/(-----BEGIN |(?:sk|ghp|github_pat|xoxb)-[\w-]+|(?:api[_-]?key|password|secret|token)\s*[:=]\s*["'][^"']{8,})/i.test(text) && !text.includes('\0');
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
