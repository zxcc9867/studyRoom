export const REFLECTION_INBOX_WINDOW_DAYS = 7;
export const REFLECTION_INBOX_LIMIT = 3;

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(dateKey) {
  if (typeof dateKey !== "string" || !dateKeyPattern.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function shiftDateKey(dateKey, days) {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getSessionEndTimestamp(session) {
  const timestamp = Date.parse(session?.ended_at ?? session?.started_at ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isCompleteSessionRow(session) {
  return Boolean(
    session
    && typeof session.id === "string"
    && session.id.trim()
    && session.status === "completed"
    && parseDateKey(session.local_date)
    && Number.isFinite(Number(session.duration_seconds))
    && Number(session.duration_seconds) >= 0,
  );
}

export function getPendingReflectionSessions({
  todayDateKey,
  sessions,
  reflections,
  windowDays = REFLECTION_INBOX_WINDOW_DAYS,
  limit = REFLECTION_INBOX_LIMIT,
}) {
  const safeWindowDays = Math.max(1, Math.floor(Number(windowDays) || 0));
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 0));
  const startDateKey = shiftDateKey(todayDateKey, -(safeWindowDays - 1));
  if (!startDateKey || !parseDateKey(todayDateKey)) return [];

  const reflectedSessionIds = new Set(
    (Array.isArray(reflections) ? reflections : [])
      .map((reflection) => reflection?.session_id)
      .filter((sessionId) => typeof sessionId === "string" && sessionId.trim()),
  );

  return (Array.isArray(sessions) ? sessions : [])
    .filter((session) =>
      isCompleteSessionRow(session)
      && session.local_date >= startDateKey
      && session.local_date <= todayDateKey
      && !reflectedSessionIds.has(session.id),
    )
    .sort((left, right) => {
      const timeDifference = getSessionEndTimestamp(right) - getSessionEndTimestamp(left);
      if (timeDifference !== 0) return timeDifference;
      return right.id.localeCompare(left.id);
    })
    .slice(0, safeLimit);
}
