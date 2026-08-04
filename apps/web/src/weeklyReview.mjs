import { normalizeHabitText } from "./dailyHabit.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_FRICTION_MIN_COUNT = 2;
const WEEKLY_FRICTION_REASON_ORDER = ["phone", "environment", "fatigue", "schedule", "other"];
const WEEKLY_FRICTION_COPY = {
  phone: {
    label: "휴대폰",
    title: "휴대폰을 시야 밖에 두기",
    action: "다음 공부를 시작하기 전에 집중 모드를 켜고 휴대폰을 손이 닿지 않는 곳에 두세요.",
    cue: "시작 전 30초",
  },
  environment: {
    label: "소음·환경",
    title: "공부 자리를 먼저 고르기",
    action: "이어폰이나 귀마개를 준비하고, 가능하면 평소보다 조용한 자리에서 시작하세요.",
    cue: "자리에 앉기 전",
  },
  fatigue: {
    label: "피로",
    title: "첫 구간을 10분으로 낮추기",
    action: "에너지가 낮은 날에는 첫 목표를 10분으로 두고, 끝난 뒤 계속할지 다시 선택하세요.",
    cue: "무리한 만회 금지",
  },
  schedule: {
    label: "일정",
    title: "시작 시각 앞뒤를 비워두기",
    action: "다음 공부 시작 시각 앞뒤로 10분을 비우고, 할 일 하나만 먼저 잡아두세요.",
    cue: "캘린더에 먼저",
  },
  other: {
    label: "기타",
    title: "방해 하나를 이름 붙이기",
    action: "다음 세션 전에 방해가 된 것을 한 문장으로 적고, 없앨 수 있는 한 가지를 준비하세요.",
    cue: "한 번만 조정",
  },
};


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
export function buildWeeklyFrictionPlan(reflections = []) {
  const counts = new Map(WEEKLY_FRICTION_REASON_ORDER.map((reason) => [reason, { count: 0, latestAt: -Infinity }]));

  for (const reflection of Array.isArray(reflections) ? reflections : []) {
    const reason = reflection?.interruption_reason;
    const current = counts.get(reason);
    if (!current) continue;

    current.count += 1;
    const occurredAt = Date.parse(typeof reflection.created_at === "string" ? reflection.created_at : "");
    if (Number.isFinite(occurredAt)) current.latestAt = Math.max(current.latestAt, occurredAt);
  }

  const selected = WEEKLY_FRICTION_REASON_ORDER
    .map((reason, priority) => ({ reason, priority, ...counts.get(reason) }))
    .filter((candidate) => candidate.count >= WEEKLY_FRICTION_MIN_COUNT)
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      if (left.latestAt !== right.latestAt) return right.latestAt - left.latestAt;
      return left.priority - right.priority;
    })[0];

  if (!selected) return null;

  return {
    reason: selected.reason,
    label: WEEKLY_FRICTION_COPY[selected.reason].label,
    count: selected.count,
    title: WEEKLY_FRICTION_COPY[selected.reason].title,
    action: WEEKLY_FRICTION_COPY[selected.reason].action,
    cue: WEEKLY_FRICTION_COPY[selected.reason].cue,
  };
}


export function buildWeeklyActionPlanItems({ nextActions = [], todos = [] } = {}) {
  const seenActions = new Set();
  const normalizedActions = (Array.isArray(nextActions) ? nextActions : [])
    .map((action) => normalizeHabitText(action))
    .filter((action) => {
      const key = action.toLocaleLowerCase();
      if (!key || seenActions.has(key)) return false;
      seenActions.add(key);
      return true;
    })
    .slice(0, 3);
  const incompleteTodos = (Array.isArray(todos) ? todos : [])
    .filter((todo) => todo && !todo.is_completed)
    .map((todo) => ({
      ...todo,
      normalizedTitle: normalizeHabitText(todo.title).toLocaleLowerCase(),
    }));

  return normalizedActions.map((action) => {
    const normalizedAction = action.toLocaleLowerCase();
    const plannedTodo = incompleteTodos.find((todo) => todo.normalizedTitle === normalizedAction) ?? null;
    if (!plannedTodo) {
      return { action, status: "unplanned", todoId: null, localDate: null, dateLabel: null };
    }

    const localDate = typeof plannedTodo.local_date === "string" ? plannedTodo.local_date : null;
    return {
      action,
      status: "planned",
      todoId: typeof plannedTodo.id === "string" ? plannedTodo.id : null,
      localDate,
      dateLabel: formatActionPlanDate(localDate),
    };
  });
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
    frictionPlan: buildWeeklyFrictionPlan(rangeReflections),
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

function formatActionPlanDate(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const parsed = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateKey) return null;

  return `${dateKey.slice(5, 7)}.${dateKey.slice(8, 10)}`;
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
