function normalizeSeconds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function parseTimestampMs(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
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
