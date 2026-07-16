export const SESSION_LEASE_DURATION_SECONDS = 60 * 60;
export const SESSION_LEASE_DURATION_MS = SESSION_LEASE_DURATION_SECONDS * 1000;
export const SESSION_LEASE_MAX_REMAINING_SECONDS = 2 * 60 * 60;
export const SESSION_LEASE_MAX_REMAINING_MS = SESSION_LEASE_MAX_REMAINING_SECONDS * 1000;

export function createSessionLeaseDeadlineMs(nowMs, durationMs = SESSION_LEASE_DURATION_MS) {
  return Math.floor(Number(nowMs)) + durationMs;
}

export function getExtendedSessionLeaseDeadlineMs({
  currentDeadlineMs,
  nowMs,
  extensionMs = SESSION_LEASE_DURATION_MS,
  maxRemainingMs = SESSION_LEASE_MAX_REMAINING_MS,
}) {
  const safeNowMs = Math.floor(Number(nowMs));
  const parsedCurrentDeadlineMs = Number(currentDeadlineMs);
  const activeDeadlineMs = Number.isFinite(parsedCurrentDeadlineMs) && parsedCurrentDeadlineMs > safeNowMs
    ? Math.floor(parsedCurrentDeadlineMs)
    : safeNowMs;
  const safeExtensionMs = Math.max(0, Math.floor(Number(extensionMs) || 0));
  const safeMaxRemainingMs = Math.max(0, Math.floor(Number(maxRemainingMs) || 0));

  return Math.min(activeDeadlineMs + safeExtensionMs, safeNowMs + safeMaxRemainingMs);
}

export function parseSessionLeaseDeadlineMs(rawValue) {
  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
}

export function getStoredSessionLeaseDeadlineMs({ rawValue, startedAtMs }) {
  const storedDeadlineMs = parseSessionLeaseDeadlineMs(rawValue);
  const fallbackDeadlineMs = createSessionLeaseDeadlineMs(startedAtMs);

  if (!storedDeadlineMs || storedDeadlineMs < startedAtMs) {
    return fallbackDeadlineMs;
  }

  return storedDeadlineMs;
}

export function getSessionLeaseRemainingSeconds({ deadlineMs, nowMs }) {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function isSessionLeaseExpired({ deadlineMs, nowMs }) {
  return nowMs >= deadlineMs;
}

export function getLeaseAwareActiveNowMs({ deadlineMs, nowMs }) {
  return Math.min(nowMs, deadlineMs);
}

export function getSessionLeaseExcludedSeconds({ deadlineMs, nowMs, baseExcludedSeconds = 0 }) {
  const leaseOverrunSeconds = Math.max(0, Math.floor((nowMs - deadlineMs) / 1000));
  return Math.max(0, Math.floor(Number(baseExcludedSeconds) || 0)) + leaseOverrunSeconds;
}

export function getSessionLeaseStorageKey({ userId, sessionId }) {
  return `study-room-session-lease:${userId}:${sessionId}`;
}
