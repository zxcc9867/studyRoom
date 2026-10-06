import { cameraMonitoringIntentKey, parseCameraMonitoringIntent } from './cameraResume.mjs';
const origin = 'https://study-room-attendance.vercel.app';
const key = userId => `study-room:device-study:${userId}`;
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
function validSession(value) {
  return value === null || value && typeof value === 'object' && Object.keys(value).length === 2
    && validId(value.id) && typeof value.paused === 'boolean';
}
// Local execution participation is independent of camera preference and account-wide timer display.
// It survives a reload/camera-off, but an observed pause or completed session releases this device.
export function createDeviceStudyTracker(storage) {
  const local = new Map();
  const cancellablePreparation = new Set();
  function prepare(userId, committing = true) {
    if (!validId(userId)) return false;
    try {
      // Write-ahead latch: never acquire a camera or commit local study before this
      // is durable. A later, larger session-id write may fail without losing safety.
      const participation = read(userId);
      if (!participation.known) return false;
      const previous = participation.id;
      const latch = committing ? 'pending' : previous && previous !== 'idle' ? previous : 'preparing';
      storage.setItem(key(userId), latch);
      if (storage.getItem(key(userId)) !== latch) return false;
      local.set(userId, latch);
      if (!committing && (!previous || previous === 'idle')) cancellablePreparation.add(userId);
      else if (committing || latch !== 'preparing') cancellablePreparation.delete(userId);
      return true;
    } catch { return false; }
  }
  function read(userId) {
    try {
      const saved = local.get(userId) ?? storage.getItem(key(userId));
      if (saved === 'idle') return { known: true, id: null };
      if (saved !== null) return { known: true, id: saved };
      const legacy = storage.getItem(cameraMonitoringIntentKey(userId));
      if (!legacy) return { known: true, id: null };
      const intent = parseCameraMonitoringIntent(legacy);
      return intent?.userId === userId && validId(intent.sessionId)
        ? { known: true, id: intent.sessionId } : { known: false, id: null };
    }
    catch { return { known: false, id: local.get(userId) ?? null }; }
  }
  return {
    prepare,
    mark(userId, sessionId) {
      if (!validId(userId) || !validId(sessionId)) return;
      cancellablePreparation.delete(userId);
      if (local.get(userId) !== 'pending') prepare(userId);
      local.set(userId, sessionId);
      try { storage.setItem(key(userId), sessionId); } catch { /* In-memory activity still blocks installation. */ }
    },
    observe(userId, session) {
      if (!validId(userId) || !validSession(session)) return;
      const previous = read(userId);
      // A pending server commit can complete after a reload and an idle/paused
      // snapshot. Only a resolved session-id marker may be released by a snapshot.
      const cancelledHere = previous.id === 'preparing' && cancellablePreparation.has(userId);
      const resolved = previous.id && previous.id !== 'pending' && previous.id !== 'preparing';
      if (cancelledHere || resolved && (!session || session.paused || previous.id !== session.id)) {
        local.set(userId, 'idle');
        cancellablePreparation.delete(userId);
        try { storage.setItem(key(userId), 'idle'); } catch { /* Health validation remains fail-closed. */ }
      }
    },
    check(state, expectedSession) {
      if (!state || !validId(state.userId)) return 'unknown';
      if (state.cameraActive === true || state.operationPending === true) return 'studying';
      if (state.ready !== true || state.cameraActive !== false || state.operationPending !== false
        || !validSession(state.session) || !validSession(expectedSession)) return 'unknown';
      if (state.session?.id !== expectedSession?.id || state.session?.paused !== expectedSession?.paused) return 'unknown';
      const participation = read(state.userId);
      if (state.session && !state.session.paused && participation.id === state.session.id) return 'studying';
      if (participation.id === 'pending' || participation.id === 'preparing') return 'unknown';
      if (!participation.known || participation.id !== null && !validId(participation.id)) return 'unknown';
      // Readable storage is not necessarily writable (e.g. quota exceeded). Do not mistake
      // missing participation after a reload for idle when recording it cannot succeed.
      try {
        const checkKey = `${key(state.userId)}:check`;
        storage.setItem(checkKey, 'ready');
        if (storage.getItem(checkKey) !== 'ready') return 'unknown';
        storage.removeItem(checkKey);
      } catch { return 'unknown'; }
      return 'allowed';
    },
  };
}
export function bindDeviceStudyCheck(host, readState, tracker) {
  const trusted = () => host?.top === host && host.location?.origin === origin && typeof host.ReactNativeWebView?.postMessage === 'function';
  const receive = event => {
    const m = event.detail;
    if (!trusted() || !m || typeof m !== 'object' || Object.keys(m).length !== 4
      || m.type !== 'STUDY_NATIVE_DEVICE_STUDY_CHECK' || !validId(m.requestId) || !validId(m.userId) || !validSession(m.session)) return;
    try {
      const state = readState();
      if (m.userId !== state?.userId) return;
      host.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STUDY_WEB_DEVICE_STUDY_STATE', requestId: m.requestId, state: tracker.check(state, m.session) }));
    } catch { /* Native request times out closed; a failed bridge never changes study state. */ }
  };
  host.addEventListener('study-room-native-message', receive);
  return () => host.removeEventListener('study-room-native-message', receive);
}
