import { getDailyAttendanceGoalSeconds } from "./attendancePolicy.mjs";
import { getDailyHabitState } from "./dailyHabit.mjs";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const formatterCache = new Map();
const HABIT_SUCCESS_SECONDS = 10 * 60;
const MAX_REWARD_SESSION_SPAN_DAYS = 3_660;
export const WEEKLY_HABIT_TARGET_DAYS = 5;
export const WEEKLY_HABIT_REST_ALLOWANCE_DAYS = 2;

function parseDateKey(dateKey) {
  const normalized = String(dateKey ?? "");
  if (!DATE_KEY_PATTERN.test(normalized)) {
    throw new TypeError(`Invalid date key: ${normalized || "(empty)"}`);
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year
    || utcDate.getUTCMonth() !== month - 1
    || utcDate.getUTCDate() !== day
  ) {
    throw new TypeError(`Invalid date key: ${normalized}`);
  }

  return { year, month, day, utcDate };
}

function toNonNegativeNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
}

function resolveTimeZone(timeZone) {
  const candidate = typeof timeZone === "string" && timeZone.trim() ? timeZone.trim() : "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return "UTC";
  }
}

function getZonedFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }));
  }
  return formatterCache.get(timeZone);
}

function getZonedParts(timestampMs, timeZone) {
  const values = Object.fromEntries(
    getZonedFormatter(timeZone)
      .formatToParts(new Date(timestampMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return values;
}

function getDateKeyAtTimestamp(timestampMs, timeZone) {
  const parts = getZonedParts(timestampMs, timeZone);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function getZonedDateBoundaryMs(dateKey, timeZone) {
  const { year, month, day } = parseDateKey(dateKey);
  const targetAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let utcMs = targetAsUtc;

  for (let index = 0; index < 6; index += 1) {
    const parts = getZonedParts(utcMs, timeZone);
    const projectedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0,
    );
    const differenceMs = projectedAsUtc - targetAsUtc;
    if (differenceMs === 0) break;
    utcMs -= differenceMs;
  }

  return utcMs;
}

export function shiftHabitDateKey(dateKey, offsetDays) {
  const { utcDate } = parseDateKey(dateKey);
  const normalizedOffset = Number(offsetDays);
  if (!Number.isInteger(normalizedOffset)) {
    throw new TypeError("offsetDays must be an integer");
  }

  utcDate.setUTCDate(utcDate.getUTCDate() + normalizedOffset);
  return utcDate.toISOString().slice(0, 10);
}

export function getRollingHabitDateKeys(todayDateKey, dayCount = 7) {
  parseDateKey(todayDateKey);
  const normalizedDayCount = Number(dayCount);
  if (!Number.isInteger(normalizedDayCount) || normalizedDayCount < 1 || normalizedDayCount > 31) {
    throw new RangeError("dayCount must be an integer between 1 and 31");
  }

  return Array.from(
    { length: normalizedDayCount },
    (_, index) => shiftHabitDateKey(todayDateKey, index - normalizedDayCount + 1),
  );
}

export function allocateCompletedStudySecondsByDate({ sessions = [], dateKeys, timeZone }) {
  if (!Array.isArray(dateKeys) || dateKeys.length === 0) {
    throw new TypeError("dateKeys must contain at least one date key");
  }

  const resolvedTimeZone = resolveTimeZone(timeZone);
  const totals = Object.fromEntries(dateKeys.map((dateKey) => {
    parseDateKey(dateKey);
    return [dateKey, 0];
  }));
  const windows = dateKeys.map((dateKey) => ({
    dateKey,
    startMs: getZonedDateBoundaryMs(dateKey, resolvedTimeZone),
    endMs: getZonedDateBoundaryMs(shiftHabitDateKey(dateKey, 1), resolvedTimeZone),
  }));

  for (const session of sessions) {
    if (session?.status !== "completed" || !session.ended_at) continue;

    const startedAtMs = Date.parse(session.started_at);
    const endedAtMs = Date.parse(session.ended_at);
    const elapsedSeconds = (endedAtMs - startedAtMs) / 1000;
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || elapsedSeconds <= 0) continue;

    const allocationRatio = Math.min(1, toNonNegativeNumber(session.duration_seconds) / elapsedSeconds);
    if (allocationRatio <= 0) continue;

    for (const window of windows) {
      const overlapMs = Math.max(
        0,
        Math.min(endedAtMs, window.endMs) - Math.max(startedAtMs, window.startMs),
      );
      totals[window.dateKey] += (overlapMs / 1000) * allocationRatio;
    }
  }

  return Object.fromEntries(
    Object.entries(totals).map(([dateKey, seconds]) => [dateKey, Math.round(seconds)]),
  );
}

function formatDateLabel(dateKey) {
  const { month, day } = parseDateKey(dateKey);
  return `${month}.${String(day).padStart(2, "0")}`;
}

function formatCompactDuration(seconds) {
  const totalMinutes = Math.floor(toNonNegativeNumber(seconds) / 60);
  if (totalMinutes < 60) return `${totalMinutes}분`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

function getStageLabel(stage, isToday) {
  if (stage === "bloom") return "꽃";
  if (stage === "tree") return "목표";
  if (stage === "seed") return "10분";
  return isToday ? "시작 전" : "쉼";
}

function getCurrentHabitStreak(days) {
  if (days.length === 0) return 0;

  let index = days.length - 1;
  if (!days[index].habitSuccess) index -= 1;

  let streak = 0;
  while (index >= 0 && days[index].habitSuccess) {
    streak += 1;
    index -= 1;
  }
  return streak;
}

export function getWeeklyHabitTargetState(startSuccessDays) {
  const completedStartDays = Math.floor(toNonNegativeNumber(startSuccessDays));
  const creditedStartDays = Math.min(WEEKLY_HABIT_TARGET_DAYS, completedStartDays);
  const remainingTargetDays = Math.max(0, WEEKLY_HABIT_TARGET_DAYS - creditedStartDays);

  return {
    targetDays: WEEKLY_HABIT_TARGET_DAYS,
    restAllowanceDays: WEEKLY_HABIT_REST_ALLOWANCE_DAYS,
    creditedStartDays,
    remainingTargetDays,
    targetReached: remainingTargetDays === 0,
    progressPercent: Math.round((creditedStartDays / WEEKLY_HABIT_TARGET_DAYS) * 100),
  };
}

function allocateCompletedStudySecondsAcrossRecordedDates({ sessions, todayDateKey, timeZone }) {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const totals = new Map();

  for (const session of sessions ?? []) {
    if (session?.status !== "completed" || !session.ended_at) continue;

    const startedAtMs = Date.parse(session.started_at);
    const endedAtMs = Date.parse(session.ended_at);
    const elapsedSeconds = (endedAtMs - startedAtMs) / 1000;
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || elapsedSeconds <= 0) continue;

    const allocationRatio = Math.min(1, toNonNegativeNumber(session.duration_seconds) / elapsedSeconds);
    if (allocationRatio <= 0) continue;

    const firstDateKey = getDateKeyAtTimestamp(startedAtMs, resolvedTimeZone);
    const lastDateKey = getDateKeyAtTimestamp(endedAtMs - 1, resolvedTimeZone);
    const firstDayMs = parseDateKey(firstDateKey).utcDate.getTime();
    const lastDayMs = parseDateKey(lastDateKey).utcDate.getTime();
    const sessionSpanDays = Math.floor((lastDayMs - firstDayMs) / 86_400_000) + 1;
    if (sessionSpanDays < 1 || sessionSpanDays > MAX_REWARD_SESSION_SPAN_DAYS || firstDateKey > todayDateKey) continue;

    const boundedLastDateKey = lastDateKey > todayDateKey ? todayDateKey : lastDateKey;
    let dateKey = firstDateKey;
    for (let index = 0; index < sessionSpanDays && dateKey <= boundedLastDateKey; index += 1) {
      const dayStartMs = getZonedDateBoundaryMs(dateKey, resolvedTimeZone);
      const dayEndMs = getZonedDateBoundaryMs(shiftHabitDateKey(dateKey, 1), resolvedTimeZone);
      const overlapMs = Math.max(0, Math.min(endedAtMs, dayEndMs) - Math.max(startedAtMs, dayStartMs));
      if (overlapMs > 0) {
        totals.set(dateKey, (totals.get(dateKey) ?? 0) + (overlapMs / 1000) * allocationRatio);
      }
      dateKey = shiftHabitDateKey(dateKey, 1);
    }
  }

  return new Map([...totals].map(([dateKey, seconds]) => [dateKey, Math.round(seconds)]));
}

export function getWeeklyHabitRewardHistory({ todayDateKey, timeZone, sessions = [] }) {
  parseDateKey(todayDateKey);
  const totals = allocateCompletedStudySecondsAcrossRecordedDates({ sessions, todayDateKey, timeZone });
  const successfulDateKeys = [...totals]
    .filter(([, seconds]) => seconds >= HABIT_SUCCESS_SECONDS)
    .map(([dateKey]) => dateKey)
    .sort();
  const earnedRewards = [];
  let windowStartIndex = 0;
  let nextEligibleDateKey = null;

  for (let index = 0; index < successfulDateKeys.length; index += 1) {
    const earnedDateKey = successfulDateKeys[index];
    const windowStartDateKey = shiftHabitDateKey(earnedDateKey, -6);
    while (successfulDateKeys[windowStartIndex] < windowStartDateKey) {
      windowStartIndex += 1;
    }

    if (nextEligibleDateKey && earnedDateKey < nextEligibleDateKey) continue;
    const successfulDaysInWindow = index - windowStartIndex + 1;
    if (successfulDaysInWindow < WEEKLY_HABIT_TARGET_DAYS) continue;

    earnedRewards.push({
      id: `weekly-firefly-wreath-${earnedDateKey}`,
      earnedDateKey,
      windowStartDateKey,
      windowEndDateKey: earnedDateKey,
    });
    nextEligibleDateKey = shiftHabitDateKey(earnedDateKey, 7);
  }

  return {
    earnedCount: earnedRewards.length,
    latestEarnedDateKey: earnedRewards.at(-1)?.earnedDateKey ?? null,
    successfulDateKeys,
    earnedRewards,
  };
}

function getWeeklyHabitCoach({ today, startSuccessDays, currentStreakDays, target, isGentleRestart }) {
  if (!today.habitSuccess) {
    if (target.targetReached) {
      return {
        title: "이번 7일의 5번 시작을 채웠어요",
        description: "오늘은 쉬어도 리듬은 그대로예요. 원한다면 10분을 가볍게 더 이어가도 좋아요.",
      };
    }

    if (isGentleRestart) {
      return {
        title: "다시 잇는 날",
        description: "어제 쉬었어도 숲길은 사라지지 않았어요. 오늘 10분이면 다시 이어져요.",
      };
    }

    return {
      title: "오늘은 아직 진행 중이에요",
      description: currentStreakDays > 0
        ? `어제까지 ${currentStreakDays}일 이어온 시작은 그대로예요. 5번 시작까지 ${target.remainingTargetDays}번 남았어요.`
        : startSuccessDays > 0
          ? `최근 7일 중 ${startSuccessDays}일 시작했어요. 5번 시작까지 ${target.remainingTargetDays}번 남았어요.`
          : "빈 주가 아니라 새로 시작할 수 있는 주예요. 오늘은 10분만 앉아 보세요.",
    };
  }

  if (today.goalReached && !today.bloomReached) {
    return {
      title: "오늘 공부 목표를 채웠어요",
      description: "오늘 할 일 하나를 완료하면 이번 숲길에 꽃이 피어요.",
    };
  }

  if (today.bloomReached) {
    return {
      title: "오늘 숲길에 꽃이 피었어요",
      description: currentStreakDays > 1
        ? `${currentStreakDays}일째 작은 시작을 이어왔어요. 내일도 10분부터 가볍게 시작해요.`
        : "시간과 할 일을 모두 지켰어요. 내일도 10분부터 가볍게 시작해요.",
    };
  }

  if (target.targetReached) {
    return {
      title: "이번 7일, 5번 시작 완료",
      description: "이틀의 여백을 둔 리듬을 지켰어요. 더 할 수 있다면 오늘 목표까지 천천히 키워요.",
    };
  }

  return {
    title: currentStreakDays > 1 ? `${currentStreakDays}일째 시작을 이어왔어요` : "오늘의 시작은 이미 성공이에요",
    description: "더 할 수 있다면 오늘 목표까지 천천히 키우고, 어렵다면 여기까지도 충분한 습관이에요.",
  };
}

export function getWeeklyHabitRhythm({
  todayDateKey,
  timeZone,
  sessions = [],
  todos = [],
  todayStudySeconds,
}) {
  const dateKeys = getRollingHabitDateKeys(todayDateKey, 7);
  const completedSecondsByDate = allocateCompletedStudySecondsByDate({ sessions, dateKeys, timeZone });
  const completedTodosByDate = Object.fromEntries(dateKeys.map((dateKey) => [dateKey, 0]));

  for (const todo of todos) {
    if (todo?.is_completed && Object.hasOwn(completedTodosByDate, todo.local_date)) {
      completedTodosByDate[todo.local_date] += 1;
    }
  }

  const canonicalTodaySeconds = Number(todayStudySeconds);
  if (todayStudySeconds !== null && todayStudySeconds !== undefined && Number.isFinite(canonicalTodaySeconds)) {
    completedSecondsByDate[todayDateKey] = Math.max(0, Math.floor(canonicalTodaySeconds));
  }

  const days = dateKeys.map((dateKey) => {
    const isToday = dateKey === todayDateKey;
    const studySeconds = completedSecondsByDate[dateKey] ?? 0;
    const completedTodoCount = completedTodosByDate[dateKey] ?? 0;
    const goalSeconds = getDailyAttendanceGoalSeconds(dateKey);
    const habit = getDailyHabitState({ studySeconds, goalSeconds, completedTodoCount });
    const { utcDate } = parseDateKey(dateKey);

    return {
      dateKey,
      weekdayLabel: KOREAN_WEEKDAYS[utcDate.getUTCDay()],
      dateLabel: formatDateLabel(dateKey),
      isToday,
      studySeconds,
      studyLabel: formatCompactDuration(studySeconds),
      completedTodoCount,
      goalSeconds,
      stage: habit.stage,
      stageLabel: getStageLabel(habit.stage, isToday),
      habitSuccess: habit.habitSuccess,
      goalReached: habit.goalReached,
      bloomReached: habit.goalReached && habit.coreTaskCompleted,
    };
  });

  const startSuccessDays = days.filter((day) => day.habitSuccess).length;
  const goalDays = days.filter((day) => day.goalReached).length;
  const bloomDays = days.filter((day) => day.bloomReached).length;
  const currentStreakDays = getCurrentHabitStreak(days);
  const today = days.at(-1);
  const target = getWeeklyHabitTargetState(startSuccessDays);
  const yesterday = days.at(-2);
  const isGentleRestart = !today.habitSuccess
    && !yesterday.habitSuccess
    && !target.targetReached
    && days.slice(0, -2).some((day) => day.habitSuccess);

  return {
    days,
    rangeLabel: `${days[0].dateLabel} - ${today.dateLabel}`,
    startSuccessDays,
    goalDays,
    bloomDays,
    currentStreakDays,
    target,
    isGentleRestart,
    primaryActionLabel: today.goalReached
      ? null
      : today.habitSuccess
        ? "오늘 목표 이어가기"
        : isGentleRestart ? "10분으로 다시 잇기" : "10분 시작 준비",
    coach: getWeeklyHabitCoach({ today, startSuccessDays, currentStreakDays, target, isGentleRestart }),
  };
}
