import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const closeScript = 'window.close();';
const closeScriptPolicy = `script-src 'sha256-${createHash('sha256').update(closeScript).digest('base64')}'`;
const entryScript = "const button=document.getElementById('continue-auth');button.addEventListener('click',()=>{try{const authWindow=window.open('about:blank','_blank','popup,width=560,height=760');if(!authWindow)throw Error();authWindow.opener=null;authWindow.location.replace(button.dataset.authorize);button.disabled=true;window.close();}catch{document.getElementById('browser-error').hidden=false;}});";
const entryScriptPolicy = `script-src 'sha256-${createHash('sha256').update(entryScript).digest('base64')}'`;
const escapeAttribute = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// HTML normalizes CRLF before CSP hashing; Windows checkouts must hash the same bytes.
const statusStyle = readFileSync(new URL('./desktopStatus.css', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
const statusStylePolicy = `style-src 'sha256-${createHash('sha256').update(statusStyle).digest('base64')}'`;

// Transport only. PKCE, identity, intent consumption and session cleanup belong to desktopAuth.
export function createLoopbackCallback({ onCallback, onExpire = () => {}, ttlMs = 300000 }) {
  const pathname = `/auth/callback/${randomBytes(32).toString('hex')}`;
  const entryPath = pathname.replace('/auth/callback/', '/auth/start/');
  let closed = false;
  let consumed = false;
  let host;
  let timer;
  let rejectReady;
  let authorizationUrl = null;
  let entryServed = false;
  const headers = {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; ${statusStylePolicy}`,
    Connection: 'close',
  };
  const reply = (response, status, success = false) => {
    if (response.destroyed || response.writableEnded) return;
    response.writeHead(status, { ...headers, ...(success ? {
      'Content-Security-Policy': `${headers['Content-Security-Policy']}; ${closeScriptPolicy}`,
    } : {}) });
    response.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>독서실 로그인</title><style>${statusStyle}</style></head><body><main class="status-panel" aria-labelledby="status-title"><div class="status-brand"><span class="status-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h6l2 2 2-2h6v14h-6l-2 2-2-2H4zM12 7v14"/></svg></span>독서실</div><div class="status-icon${success ? '' : ' status-icon--error'}" aria-hidden="true"><svg viewBox="0 0 24 24">${success ? '<path d="m5 12 4 4L19 6"/>' : '<path d="m7 7 10 10M17 7 7 17"/>'}</svg></div><h1 id="status-title">${success ? '로그인이 완료됐어요.' : '로그인을 완료하지 못했어요.'}</h1><p class="status-copy">${success ? '독서실 앱에서 공부를 이어가세요.' : '독서실 앱으로 돌아가 로그인을 다시 시작해 주세요.'}</p><p class="status-note">${success ? '브라우저에서 자동 닫기를 허용하지 않으면 이 화면이 남을 수 있어요. 이 탭은 닫아도 됩니다.' : '로그인이 취소됐거나 연결을 완료하지 못했어요. 기존 학습 기록은 그대로 유지돼요.'}</p></main>${success ? `<script>${closeScript}</script>` : ''}</body></html>`);
  };
  const replyEntry = response => {
    response.writeHead(200, { ...headers, 'Content-Security-Policy': `${headers['Content-Security-Policy']}; ${entryScriptPolicy}` });
    response.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>독서실 로그인</title><style>${statusStyle}</style></head><body><main class="status-panel" aria-labelledby="entry-title"><div class="status-brand"><span class="status-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h6l2 2 2-2h6v14h-6l-2 2-2-2H4zM12 7v14"/></svg></span>독서실</div><h1 id="entry-title">Google로 로그인</h1><p class="status-copy">전용 인증 창에서 로그인을 진행해 주세요.</p><button id="continue-auth" class="status-action" type="button" data-authorize="${escapeAttribute(authorizationUrl)}">Google로 계속</button><p id="browser-error" class="status-note" role="alert" hidden>인증 창을 열지 못했어요. 다시 눌러 주세요.</p><p class="status-note">로그인 후 독서실 앱에서 공부를 이어가세요.</p></main><script>${entryScript}</script></body></html>`);
  };
  const server = http.createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000 }, async (request, response) => {
    let code;
    try {
      if (closed || request.method !== 'GET' || request.headers.host !== host || request.headers.origin
        || typeof request.url !== 'string' || request.url.length > 4096
        || request.url.includes('#') || request.headers['transfer-encoding'] || Number(request.headers['content-length'] ?? 0) !== 0) throw Error();
      if (request.url === entryPath && authorizationUrl) {
        if (entryServed || consumed) { reply(response, 409); return; }
        entryServed = true;
        replyEntry(response);
        return;
      }
      if (!request.url.startsWith(`${pathname}?`)) throw Error();
      const query = new URLSearchParams(request.url.slice(pathname.length + 1));
      code = query.get('code');
      if ([...query.keys()].length !== 1 || !query.has('code') || typeof code !== 'string'
        || code.length === 0 || code.length > 2048 || /[\x00-\x20\x7f]/.test(code)) throw Error();
    } catch { reply(response, 400); return; }
    if (consumed) { reply(response, 409); return; }
    consumed = true;
    // HTTP completion contains no callback URL or credential. Keep the active response
    // alive while auth consumes its intent and closes the listening socket.
    try { await onCallback(code); reply(response, 200, true); }
    catch { reply(response, 400); }
    finally { close(); }
  });
  server.maxRequestsPerSocket = 1;
  server.on('clientError', (_error, socket) => socket.destroy());
  function close() {
    if (closed) return;
    closed = true;
    authorizationUrl = null;
    clearTimeout(timer);
    rejectReady?.(Error('AUTH_CHANGED'));
    server.close();
    server.closeIdleConnections();
  }
  const ready = new Promise((resolve, reject) => {
    rejectReady = reject;
    server.on('error', () => { reject(Error('AUTH_FAILED')); close(); });
    server.listen(0, '127.0.0.1', () => {
      if (closed) { server.close(); return; }
      host = `127.0.0.1:${server.address().port}`;
      timer = setTimeout(() => { close(); try { onExpire(); } catch { /* No raw diagnostics. */ } }, Math.min(300000, Math.max(1, ttlMs)));
      timer.unref?.();
      resolve(`http://${host}${pathname}`);
    });
  });
  // Cancellation may precede the owner's await; avoid an unhandled rejected promise.
  void ready.catch(() => {});
  function authorizationEntry(value) {
    if (closed || consumed || authorizationUrl || !host) throw Error('AUTH_CHANGED');
    let url;
    try {
      if (typeof value !== 'string' || value.length > 4096 || /[\x00-\x20\x7f]/.test(value)) throw Error();
      url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw Error();
    } catch { throw Error('AUTH_FAILED'); }
    authorizationUrl = url.href;
    return `http://${host}${entryPath}`;
  }
  return { ready, close, authorizationEntry };
}
