const DAY_MS = 24 * 60 * 60 * 1000;

export function getStudyWeekRange(dateKey, weekOffset = 0) {
  const date = parseDateKey(dateKey);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(date.getTime() + (mondayOffset + weekOffset * 7) * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return { startDate: formatDateKey(start), endDate: formatDateKey(end) };
}

export function getComparableStudyWeekRanges(todayDateKey) {
  const fullCurrentRange = getStudyWeekRange(todayDateKey, 0);
  const fullPreviousRange = getStudyWeekRange(todayDateKey, -1);
  const elapsedDays = Math.floor(
    (parseDateKey(todayDateKey).getTime() - parseDateKey(fullCurrentRange.startDate).getTime()) / DAY_MS,
  );
  return {
    currentRange: {
      startDate: fullCurrentRange.startDate,
      endDate: todayDateKey,
      coveredDayCount: elapsedDays + 1,
    },
    previousRange: {
      startDate: fullPreviousRange.startDate,
      endDate: formatDateKey(new Date(parseDateKey(fullPreviousRange.startDate).getTime() + elapsedDays * DAY_MS)),
      coveredDayCount: elapsedDays + 1,
    },
  };
}

export function buildWeeklyStudyReview(input) {
  return buildComparableWeeklyStudyReview(input);
}

export function buildComparableWeeklyStudyReview({
  todayDateKey,
  sessions = [],
  todos = [],
  attendanceDays = [],
  reflections = [],
  currentStudySummary = null,
  previousStudySummary = null,
}) {
  const { currentRange, previousRange } = getComparableStudyWeekRanges(todayDateKey);
  const current = buildRangeMetrics(currentRange, sessions, todos, attendanceDays, reflections, currentStudySummary);
  const previous = buildRangeMetrics(previousRange, sessions, todos, attendanceDays, reflections, previousStudySummary);

  return {
    current,
    previous,
    studySecondsChange: current.studySeconds - previous.studySeconds,
    completionRateChange: current.completionRate - previous.completionRate,
    consistencyChange: current.consistencyScore - previous.consistencyScore,
  };
}

export function formatStudyDuration(seconds) {
  const totalMinutes = Math.max(0, Math.round((Number(seconds) || 0) / 60));
  return formatStudyMinutes(totalMinutes);
}

export function formatStudyDurationChange(seconds) {
  const numericSeconds = Number(seconds) || 0;
  if (numericSeconds === 0) return "지난주와 같아요";

  const totalMinutes = Math.round(Math.abs(numericSeconds) / 60);
  return `지난주보다 ${numericSeconds > 0 ? "+" : "-"}${formatStudyMinutes(totalMinutes)}`;
}

function buildRangeMetrics(range, sessions, todos, attendanceDays, reflections, studySummary) {
  const inRange = (dateKey) => dateKey >= range.startDate && dateKey <= range.endDate;
  const rangeSessions = sessions.filter((session) => session.status === "completed" && inRange(session.local_date));
  const rangeTodos = todos.filter((todo) => inRange(todo.local_date));
  const rangeAttendance = attendanceDays.filter((day) => inRange(day.local_date));
  const sessionIds = new Set(rangeSessions.map((session) => session.id));
  const rangeReflections = reflections.filter((reflection) => sessionIds.has(reflection.session_id));
  const plannedTodoCount = rangeTodos.length;
  const completedTodoCount = rangeTodos.filter((todo) => todo.is_completed).length;
  const completionRate = plannedTodoCount > 0 ? Math.round((completedTodoCount / plannedTodoCount) * 100) : 0;
  const presentDays = new Set(rangeAttendance.filter((day) => day.status === "present").map((day) => day.local_date)).size;
  const reflectedSessionRate = rangeSessions.length > 0 ? rangeReflections.length / rangeSessions.length : 0;
  const consistencyScore = Math.round(
    Math.min(1, presentDays / range.coveredDayCount) * 50
      + (completionRate / 100) * 35
      + Math.min(1, reflectedSessionRate) * 15,
  );

  return {
    ...range,
    studySeconds: studySummary?.completedSeconds
      ?? rangeSessions.reduce((sum, session) => sum + Math.max(0, Number(session.duration_seconds) || 0), 0),
    sessionCount: studySummary?.completedSessionCount ?? rangeSessions.length,
    anomalySessionCount: studySummary?.anomalySessionCount ?? 0,
    crossDateSessionCount: studySummary?.crossDateSessionCount ?? 0,
    plannedTodoCount,
    completedTodoCount,
    completionRate,
    presentDays,
    reflectionCount: rangeReflections.length,
    averageFocus: average(rangeReflections.map((reflection) => reflection.focus_score)),
    averageEnergy: average(rangeReflections.map((reflection) => reflection.energy_score)),
    consistencyScore,
    nextActions: rangeReflections
      .filter((reflection) => typeof reflection.next_action === "string" && reflection.next_action.trim())
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
      .map((reflection) => reflection.next_action.trim())
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 3),
  };
}

function average(values) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) * 10) / 10;
}

function formatStudyMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  return `${hours}시간 ${minutes}분`;
}

function parseDateKey(dateKey) {
  const parsed = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid date key");
  return parsed;
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}
