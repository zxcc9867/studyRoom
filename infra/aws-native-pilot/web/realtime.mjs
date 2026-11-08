import { base64url } from './oauth.mjs';

export function subscribeToStudy({
  httpUrl, realtimeUrl, token, subject, onEvent = () => {}, onStatus = () => {}, socket = WebSocket
}) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(subject ?? '')) throw new Error('Invalid channel subject');
  const authorization = {host:new URL(httpUrl).host, Authorization:token};
  const ws = new socket(realtimeUrl, ['aws-appsync-event-ws', 'header-' + base64url(JSON.stringify(authorization))]);
  const id = crypto.randomUUID();
  let timer, done = false, subscribed = false, initialized = false, idleMs;
  let accept, deny;
  const ready = new Promise((resolve, reject) => { accept = resolve; deny = reject; });
  const send = data => ws.send(JSON.stringify(data));
  function finish(code = 'connection_closed') {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (!subscribed) deny(Object.assign(new Error('AppSync subscription did not open'), {code}));
    if (ws.readyState <= 1) ws.close();
    onStatus('offline');
  }
  function watch(ms) {
    clearTimeout(timer);
    timer = setTimeout(() => finish('timeout'), ms);
  }
  watch(12_000);
  ws.addEventListener('open', () => send({type:'connection_init'}));
  ws.addEventListener('error', () => finish('connection_error'));
  ws.addEventListener('close', () => finish());
  ws.addEventListener('message', ({data}) => {
    if (done) return;
    let message;
    try { message = JSON.parse(data); } catch { return; }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'connection_ack' && !initialized) {
      initialized = true;
      idleMs = Number.isFinite(message.connectionTimeoutMs) ?
        Math.max(1000, Math.min(600_000, message.connectionTimeoutMs)) : 300_000;
      send({type:'subscribe', id, channel:'/study/' + subject, authorization});
    } else if (message.type === 'connection_error') {
      finish('connection_error');
    } else if (message.type === 'subscribe_error' && message.id === id) {
      finish('subscription_denied');
    } else if (message.type === 'subscribe_success' && message.id === id && initialized) {
      subscribed = true;
      watch(idleMs);
      accept();
      onStatus('connected');
    } else if (message.type === 'ka' && subscribed) {
      watch(idleMs);
    } else if (message.type === 'data' && message.id === id && subscribed && Array.isArray(message.event)) {
      for (const item of message.event) {
        let signal;
        try { signal = JSON.parse(item); } catch { continue; }
        if (typeof signal?.id === 'string' && ['record','coaching'].includes(signal.kind)) onEvent(signal);
      }
    }
  });
  return {ready, close:() => finish()};
}
