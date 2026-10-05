import { getStudyDateKey } from "../../../packages/core/src/index.mjs";

function toFiniteMs(value) {
  return Number.isFinite(value) ? value : null;
}

function resolveTimeZone(timeZone) {
  return timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
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

export function getActiveStudySecondsForDate({ startedAtMs, nowMs, dateKey, localDate, timeZone, excludedSeconds = 0 }) {
  if (!Number.isFinite(startedAtMs)) return 0;
  let studyDate;
  try { studyDate = localDate ?? getStudyDateKey(new Date(startedAtMs), resolveTimeZone(timeZone)); } catch { return 0; }
  if (studyDate !== dateKey) return 0;
  return getActiveStudySecondsInWindow({
    startedAtMs,
    nowMs,
    windowStartMs: startedAtMs,
    windowEndMs: nowMs,
    excludedSeconds,
  });
}

export function getActiveStudySecondsForMonth({ startedAtMs, nowMs, monthKey, localDate, timeZone, excludedSeconds = 0 }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthKey))) return 0;
  if (!Number.isFinite(startedAtMs)) return 0;
  let studyDate;
  try { studyDate = localDate ?? getStudyDateKey(new Date(startedAtMs), resolveTimeZone(timeZone)); } catch { return 0; }
  if (studyDate.slice(0, 7) !== monthKey) return 0;
  return getActiveStudySecondsInWindow({
    startedAtMs,
    nowMs,
    windowStartMs: startedAtMs,
    windowEndMs: nowMs,
    excludedSeconds,
  });
}
