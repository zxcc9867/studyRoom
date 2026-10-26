import { createDesktopPolicy } from './desktopPolicy.mjs';

const ENGAGEMENT_KEY = 'desktop-local-engagement-v1';
const validMetadata = value => value && typeof value.userId === 'string' && value.userId.length > 0
  && value.userId.length <= 128 && typeof value.sessionId === 'string' && value.sessionId.length > 0
  && value.sessionId.length <= 128 && Object.keys(value).length === 2;

export function createDesktopLifecycle({ now = Date.now, storage } = {}) {
  const policy = createDesktopPolicy();
  let state = null;
  let receivedAt = null;
  let engagement = null;
  let hydrated = !storage;
  let persistencePending = 0;
  let persistenceError = false;
  let persisted = null;
  let writeTail = null;
  let quitPending = null;
  let sequence = 0;

  function persist() {
    if (!storage || !hydrated) return;
    const next = engagement ? JSON.stringify(engagement) : null;
    if (next === persisted) return;
    persisted = next;
    const operation = () => next === null ? storage.removeItem(ENGAGEMENT_KEY) : storage.setItem(ENGAGEMENT_KEY, next);
    try {
      const result = writeTail ? writeTail.then(operation) : operation();
      if (result && typeof result.then === 'function') {
        persistencePending += 1;
        const settled = Promise.resolve(result).catch(() => { persistenceError = true; }).finally(() => { persistencePending -= 1; });
        writeTail = settled;
        void settled.then(() => { if (writeTail === settled) writeTail = null; });
      }
    } catch { persistenceError = true; }
  }

  function reconcile() {
    if (!state || !hydrated) return;
    if (state.ready && state.activity !== 'unknown') {
      if (engagement && engagement.userId !== state.userId) engagement = null;
      if (state.userId && state.session && state.activity === 'studying') {
        engagement = { userId: state.userId, sessionId: state.session.id };
      } else if (!state.session || (engagement && engagement.sessionId !== state.session.id)) {
        engagement = null;
      }
    }
    persist();
  }

  function restore(value) {
    try {
      const decoded = value === null ? null : JSON.parse(value);
      engagement = validMetadata(decoded) ? { userId: decoded.userId, sessionId: decoded.sessionId } : null;
      persisted = engagement ? JSON.stringify(engagement) : null;
    } catch { engagement = null; }
    hydrated = true;
    reconcile();
  }
  if (storage) {
    try {
      const value = storage.getItem(ENGAGEMENT_KEY);
      if (value && typeof value.then === 'function') {
        void Promise.resolve(value).then(restore, () => { hydrated = true; persistenceError = true; });
      } else restore(value);
    } catch { hydrated = true; persistenceError = true; }
  }

  function view() {
    const age = receivedAt === null ? Infinity : now() - receivedAt;
    const fresh = state !== null && age >= 0 && age <= 10000;
    const consistent = state?.activity !== 'studying' || Boolean(state.userId && state.session);
    const known = fresh && state.ready && state.activity !== 'unknown' && consistent && hydrated && !persistenceError;
    return {
      fresh, known, localEngagement: Boolean(engagement),
      status: !known ? 'unknown' : !state.userId ? 'signed-out' : state.session
        ? state.session.paused ? 'paused' : 'studying' : 'idle',
      cameraActive: Boolean(fresh && state?.cameraActive),
      operationPending: Boolean(state?.operationPending || persistencePending),
      quitPending: quitPending?.requestId ?? null,
    };
  }

  return {
    update(value) {
      state = policy.parseRequest({ id: 'state', action: 'studyState', payload: value }).payload;
      receivedAt = now();
      reconcile();
      return { accepted: true };
    },
    invalidate() { state = null; receivedAt = null; quitPending = null; },
    view,
    requestQuit() {
      const current = view();
      if (!current.known || persistencePending) return { action: 'blocked' };
      if (!engagement && !state.cameraActive && !state.operationPending) {
        quitPending = null;
        return { action: 'quit' };
      }
      if (!quitPending) quitPending = { action: 'request-web', requestId: `quit-${++sequence}` };
      return { ...quitPending };
    },
    cancelQuit(id) {
      if (!quitPending || id !== quitPending.requestId) return false;
      quitPending = null;
      return true;
    },
  };
}
