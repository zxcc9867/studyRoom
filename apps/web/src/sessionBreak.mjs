function normalizeSeconds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function parseTimestampMs(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const BREAK_RETURN_PRESET_MINUTES = Object.freeze([10, 20, 40]);
const BREAK_RETURN_STORAGE_PREFIX = "study-room:break-return";

function normalizeTimestampMs(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function normalizeDurationMinutes(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

export function isStudySessionPaused(session) {
  return parseTimestampMs(session?.paused_at) !== null;
}

export function getCurrentStudyBreakSeconds({ pausedAt, nowMs = Date.now() }) {
  const pausedAtMs = parseTimestampMs(pausedAt);
  const safeNowMs = Number(nowMs);
  if (pausedAtMs === null || !Number.isFinite(safeNowMs)) return 0;
  return Math.max(0, Math.floor((safeNowMs - pausedAtMs) / 1000));
}

export function getTotalStudyBreakSeconds({ pausedSeconds, pausedAt, nowMs = Date.now() }) {
  return normalizeSeconds(pausedSeconds) + getCurrentStudyBreakSeconds({ pausedAt, nowMs });
}

export function getStudyBreakReturnStorageKey({ userId, sessionId } = {}) {
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
  const normalizedSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!normalizedUserId || !normalizedSessionId) return "";
  return `${BREAK_RETURN_STORAGE_PREFIX}:${normalizedUserId}:${normalizedSessionId}`;
}

export function createStudyBreakReturnDeadlineMs({ nowMs = Date.now(), durationMinutes } = {}) {
  const normalizedNowMs = normalizeTimestampMs(nowMs);
  const normalizedDurationMinutes = normalizeDurationMinutes(durationMinutes);
  if (normalizedNowMs === null || normalizedDurationMinutes === null) return null;
  return normalizedNowMs + normalizedDurationMinutes * 60_000;
}

export function extendStudyBreakReturnDeadlineMs({
  deadlineMs,
  nowMs = Date.now(),
  durationMinutes = 10,
} = {}) {
  const normalizedNowMs = normalizeTimestampMs(nowMs);
  const normalizedDurationMinutes = normalizeDurationMinutes(durationMinutes);
  if (normalizedNowMs === null || normalizedDurationMinutes === null) return null;
  const normalizedDeadlineMs = normalizeTimestampMs(deadlineMs);
  return Math.max(normalizedNowMs, normalizedDeadlineMs ?? normalizedNowMs)
    + normalizedDurationMinutes * 60_000;
}

export function getStudyBreakReturnPlanState({
  deadlineMs,
  nowMs = Date.now(),
  leaseDeadlineMs = null,
} = {}) {
  const normalizedDeadlineMs = normalizeTimestampMs(deadlineMs);
  const normalizedNowMs = normalizeTimestampMs(nowMs);
  const normalizedLeaseDeadlineMs = normalizeTimestampMs(leaseDeadlineMs);
  if (normalizedDeadlineMs === null || normalizedNowMs === null) {
    return {
      planned: false,
      due: false,
      deadlineMs: null,
      remainingSeconds: 0,
      leaseExpiresBeforeReturn: false,
    };
  }

  return {
    planned: true,
    due: normalizedDeadlineMs <= normalizedNowMs,
    deadlineMs: normalizedDeadlineMs,
    remainingSeconds: Math.max(0, Math.ceil((normalizedDeadlineMs - normalizedNowMs) / 1000)),
    leaseExpiresBeforeReturn:
      normalizedLeaseDeadlineMs !== null && normalizedLeaseDeadlineMs < normalizedDeadlineMs,
  };
}

export function readStudyBreakReturnDeadlineMs(storage, key) {
  if (!key || !storage || typeof storage.getItem !== "function") return null;
  try {
    return normalizeTimestampMs(storage.getItem(key));
  } catch {
    return null;
  }
}

export function persistStudyBreakReturnDeadlineMs(storage, key, deadlineMs) {
  const normalizedDeadlineMs = normalizeTimestampMs(deadlineMs);
  if (!key || normalizedDeadlineMs === null || !storage || typeof storage.setItem !== "function") return false;
  try {
    storage.setItem(key, String(normalizedDeadlineMs));
    return true;
  } catch {
    return false;
  }
}

export function clearStudyBreakReturnDeadline(storage, key) {
  if (!key || !storage || typeof storage.removeItem !== "function") return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
