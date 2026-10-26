import { consumeEmbeddedTicket } from './embeddedAuth.mjs';

const origin = 'https://study-room-attendance.vercel.app';
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\x00-\x20\x7f]/.test(value);
// Document lifetime, not account/component lifetime: an old user's unresolved write
// must still block process exit after the auth gate unmounts its Dashboard.
const pendingWrites = new WeakMap();
export function beginDesktopWrite(host) {
  if (!isDesktopStudyApp(host)) return () => {};
  pendingWrites.set(host, (pendingWrites.get(host) ?? 0) + 1);
  let released = false;
  return () => { if (!released) { released = true; pendingWrites.set(host, Math.max(0, (pendingWrites.get(host) ?? 0) - 1)); } };
}
export function hasDesktopWrites(host) { return (pendingWrites.get(host) ?? 0) > 0; }
export function isDesktopStudyApp(host) {
  try {
    const bridge = host?.studyRoomDesktop;
    return host?.top === host && host.location?.origin === origin && bridge?.protocolVersion === 1
      && typeof bridge.request === 'function' && typeof bridge.onEvent === 'function';
  } catch { return false; }
}

export async function desktopRequest(host, action, payload = {}, { id, timeoutMs = action === 'cameraConsent' ? 120000 : 15000 } = {}) {
  if (!isDesktopStudyApp(host)) throw new Error('DESKTOP_UNAVAILABLE');
  id ??= host.crypto.randomUUID();
  if (!validId(id)) throw new Error('DESKTOP_REQUEST');
  let timer;
  try {
    const reply = await Promise.race([
      host.studyRoomDesktop.request({ id, action, payload }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DESKTOP_TIMEOUT')), timeoutMs); }),
    ]);
    if (!reply || reply.id !== id || typeof reply.ok !== 'boolean') throw new Error('DESKTOP_REPLY');
    if (!reply.ok) throw new Error(typeof reply.error === 'string' && /^[A-Z_]{1,64}$/.test(reply.error) ? reply.error : 'DESKTOP_FAILED');
    return reply.value;
  } finally { clearTimeout(timer); }
}

export function subscribeDesktop(host, listener) {
  if (!isDesktopStudyApp(host)) return () => {};
  return host.studyRoomDesktop.onEvent(event => {
    if (!isDesktopStudyApp(host) || !event || typeof event !== 'object') return;
    if (event.type === 'auth-changed' || (event.type === 'state-requested' && validId(event.requestId))
      || (event.type === 'quit-requested' && validId(event.requestId) && validId(event.userId)
        && (event.sessionId === null || validId(event.sessionId)) && typeof event.localEngagement === 'boolean')) listener(event);
  });
}

export function getDesktopStudyActivity(state, tracker) {
  // A live, cancellable pre-study camera is not a committed study session. This
  // exception authorizes cleanup only: the retained cameraActive bit blocks exit.
  // Once stopped, the real tracker must independently prove idle again.
  if (state.ready && state.session === null && state.cameraActive && !state.operationPending) return 'allowed';
  return tracker.check({ ...state, cameraActive: false, operationPending: false }, state.session);
}

export function bindDesktopStudy(host, readState, tracker, onQuit) {
  if (!isDesktopStudyApp(host)) return () => {};
  const publish = id => {
    try {
      const raw = readState();
      const state = { ...raw, operationPending: raw.operationPending || hasDesktopWrites(host) };
      return desktopRequest(host, 'studyState', { ...state, activity: getDesktopStudyActivity(state, tracker) }, { id }).catch(() => {});
    } catch { return Promise.resolve(); }
  };
  const unsubscribe = subscribeDesktop(host, event => {
    if (event.type === 'state-requested') void publish(event.requestId);
    if (event.type === 'quit-requested') {
      const state = readState();
      if (state.userId === event.userId && (state.session?.id ?? null) === event.sessionId) onQuit(event);
    }
  });
  void publish();
  const interval = setInterval(publish, 2500);
  return () => { clearInterval(interval); unsubscribe(); };
}

// All web SDK mutations share this queue. Native auth can invalidate immediately,
// but a late verifyOtp must finish before cleanup or another account's exchange.
export function createDesktopAuthSession(host, sdk, notify, { timeoutMs = 30000, assertReady = () => {} } = {}) {
  let generation = 0, disposed = false, loggingOut = false, queue = Promise.resolve();
  let watchdog;
  let state = { status: 'connecting', session: null };
  const set = next => { state = next; if (!disposed) notify(next); };
  const current = epoch => !disposed && generation === epoch;
  const enqueue = work => { queue = queue.catch(() => {}).then(work); return queue; };
  const clear = async () => {
    const result = await sdk.auth.signOut({ scope: 'local' });
    if (result?.error) throw new Error('DESKTOP_LOCAL_AUTH');
  };
  function refresh() {
    if (disposed || loggingOut) return queue;
    const epoch = ++generation;
    set({ status: 'connecting', session: null });
    clearTimeout(watchdog);
    const timer = watchdog = setTimeout(() => {
      if (!current(epoch)) return;
      ++generation;
      set({ status: 'error', session: null });
      // A timeout cannot cancel the SDK's internal session mutation. Keep the
      // late exchange and its cleanup ahead of every subsequent retry/login.
      void enqueue(() => clear().catch(() => {}));
    }, timeoutMs);
    return enqueue(async () => {
      if (!current(epoch)) return;
      try {
        try { assertReady(); }
        catch {
          if (current(epoch)) set({ status: 'error', session: null });
          return;
        }
        const identity = await desktopRequest(host, 'authStatus');
        if (!current(epoch)) return;
        if (!identity || !(identity.userId === null || validId(identity.userId))) throw new Error('DESKTOP_IDENTITY');
        await clear();
        if (!current(epoch)) return;
        if (identity.userId === null) { set({ status: 'signed-out', session: null }); return; }
        const id = host.crypto.randomUUID();
        const ticket = await desktopRequest(host, 'webTicket', {}, { id });
        if (!current(epoch)) return;
        if (ticket?.userId !== identity.userId) throw new Error('DESKTOP_IDENTITY');
        const session = await consumeEmbeddedTicket(sdk, ticket, id);
        if (!current(epoch)) return;
        const verified = await desktopRequest(host, 'authStatus');
        if (!current(epoch)) return;
        if (verified?.userId !== session.user.id) throw new Error('DESKTOP_IDENTITY');
        set({ status: 'ready', session });
      } catch {
        if (!current(epoch)) return;
        await clear().catch(() => {});
        if (current(epoch)) set({ status: 'error', session: null });
      } finally { clearTimeout(timer); }
    });
  }
  const unsubscribe = subscribeDesktop(host, event => {
    if (event.type === 'auth-changed') void refresh();
    if (event.type === 'state-requested' && state.status !== 'ready') {
      const signedOut = state.status === 'signed-out';
      void desktopRequest(host, 'studyState', { userId: null, ready: signedOut, session: null,
        cameraActive: false, operationPending: !signedOut || hasDesktopWrites(host), activity: signedOut ? 'allowed' : 'unknown' }, { id: event.requestId }).catch(() => {});
    }
  });
  const { data } = sdk.auth.onAuthStateChange((event, session) => {
    if ((state.status === 'ready' && session?.user.id !== state.session.user.id)
      || (state.status === 'signed-out' && session)) void refresh();
    else if (state.status === 'ready' && session && ['TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) set({ status: 'ready', session });
  });
  return {
    start: refresh, retry: refresh,
    async signOut() {
      loggingOut = true; ++generation; set({ status: 'connecting', session: null });
      clearTimeout(watchdog);
      // Revoke native immediately; cleanup stays behind any late SDK exchange.
      const native = desktopRequest(host, 'signOut').then(() => null, error => error);
      await enqueue(async () => {
        const error = await native;
        await clear(); loggingOut = false;
        if (!disposed) set({ status: error ? 'error' : 'signed-out', session: null });
      }).catch(() => { loggingOut = false; set({ status: 'error', session: null }); });
    },
    dispose() { disposed = true; ++generation; clearTimeout(watchdog); unsubscribe(); data.subscription.unsubscribe(); },
  };
}
