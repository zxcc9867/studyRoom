import { getZonedDateBoundaryMs, shiftHabitDateKey } from "./weeklyHabit.mjs";

function toFiniteMs(value) {
  return Number.isFinite(value) ? value : null;
}

function resolveTimeZone(timeZone) {
  return timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getDateWindow(dateKey, nextDateKey, timeZone) {
  try {
    const zone = resolveTimeZone(timeZone);
    return {
      windowStartMs: getZonedDateBoundaryMs(dateKey, zone),
      windowEndMs: getZonedDateBoundaryMs(nextDateKey, zone),
    };
  } catch { return null; }
}

export function getStudyMonthKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone), year: "numeric", month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}`;
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

export function getActiveStudySecondsForDate({ startedAtMs, nowMs, dateKey, timeZone, excludedSeconds = 0 }) {
  let nextDateKey;
  try { nextDateKey = shiftHabitDateKey(dateKey, 1); } catch { return 0; }
  const window = getDateWindow(dateKey, nextDateKey, timeZone);
  if (!window) return 0;

  return getActiveStudySecondsInWindow({
    startedAtMs,
    nowMs,
    ...window,
    excludedSeconds,
  });
}

export function getActiveStudySecondsForMonth({ startedAtMs, nowMs, monthKey, timeZone, excludedSeconds = 0 }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthKey))) return 0;
  const [year, month] = monthKey.split("-").map(Number);
  const nextDateKey = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const window = getDateWindow(`${monthKey}-01`, nextDateKey, timeZone);
  if (!window) return 0;

  return getActiveStudySecondsInWindow({
    startedAtMs,
    nowMs,
    ...window,
    excludedSeconds,
  });
}
