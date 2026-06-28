export const STUDY_SESSION_ACTIVITY_HEARTBEAT_MS = 15 * 1000;
export const STUDY_SESSION_INACTIVITY_GRACE_MS = 5 * 60 * 1000;

export function getStudySessionActivityStorageKey({ userId, sessionId }) {
  return `study-room-session-activity:${userId}:${sessionId}`;
}

export function parseStudySessionActivityMs(rawValue) {
  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
}

export function shouldEndStudySessionForInactivity({
  lastActivityMs,
  nowMs,
  graceMs = STUDY_SESSION_INACTIVITY_GRACE_MS,
} = {}) {
  const parsedLastActivityMs = parseStudySessionActivityMs(lastActivityMs);
  const parsedNowMs = Number(nowMs);
  const parsedGraceMs = Number(graceMs);

  if (!parsedLastActivityMs || !Number.isFinite(parsedNowMs) || !Number.isFinite(parsedGraceMs)) {
    return false;
  }

  return parsedNowMs - parsedLastActivityMs > parsedGraceMs;
}

export function getStudySessionActivityExcludedSeconds({ lastActivityMs, nowMs } = {}) {
  const parsedLastActivityMs = parseStudySessionActivityMs(lastActivityMs);
  const parsedNowMs = Number(nowMs);

  if (!parsedLastActivityMs || !Number.isFinite(parsedNowMs)) {
    return 0;
  }

  return Math.max(0, Math.floor((parsedNowMs - parsedLastActivityMs) / 1000));
}
