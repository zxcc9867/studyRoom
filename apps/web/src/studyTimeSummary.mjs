const DAY_MS = 24 * 60 * 60 * 1000;

function toFiniteMs(value) {
  return Number.isFinite(value) ? value : null;
}

function getLocalDateStartMs(dateKey) {
  const timestamp = Date.parse(`${dateKey}T00:00:00`);
  return toFiniteMs(timestamp);
}

function getLocalMonthStartMs(monthKey) {
  const [yearText, monthText] = String(monthKey).split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1, 0, 0, 0, 0).getTime();
}

export function getActiveStudySecondsInWindow({
  startedAtMs,
  nowMs,
  windowStartMs,
  windowEndMs,
  excludedSeconds = 0,
}) {
  const startedAt = toFiniteMs(startedAtMs);
  const current = toFiniteMs(nowMs);
  const windowStart = toFiniteMs(windowStartMs);
  const windowEnd = toFiniteMs(windowEndMs);

  if (startedAt === null || current === null || windowStart === null || windowEnd === null) {
    return 0;
  }

  const effectiveStart = Math.max(startedAt, windowStart);
  const effectiveEnd = Math.min(current, windowEnd);

  if (effectiveEnd <= effectiveStart) {
    return 0;
  }

  const elapsedSeconds = Math.floor((effectiveEnd - effectiveStart) / 1000);
  return Math.max(0, elapsedSeconds - Math.max(0, Math.floor(excludedSeconds)));
}

export function getActiveStudySecondsForDate({ startedAtMs, nowMs, dateKey, excludedSeconds = 0 }) {
  const dayStartMs = getLocalDateStartMs(dateKey);

  if (dayStartMs === null) {
    return 0;
  }

  return getActiveStudySecondsInWindow({
    startedAtMs,
    nowMs,
    windowStartMs: dayStartMs,
    windowEndMs: dayStartMs + DAY_MS,
    excludedSeconds,
  });
}

export function getActiveStudySecondsForMonth({ startedAtMs, nowMs, monthKey, excludedSeconds = 0 }) {
  const monthStartMs = getLocalMonthStartMs(monthKey);

  if (monthStartMs === null) {
    return 0;
  }

  const [yearText, monthText] = String(monthKey).split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const monthEndMs = new Date(year, month, 1, 0, 0, 0, 0).getTime();

  return getActiveStudySecondsInWindow({
    startedAtMs,
    nowMs,
    windowStartMs: monthStartMs,
    windowEndMs: monthEndMs,
    excludedSeconds,
  });
}
