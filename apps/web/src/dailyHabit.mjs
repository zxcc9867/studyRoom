export const DAILY_HABIT_SEED_SECONDS = 10 * 60;
const TEN_MINUTE_CHECKPOINT_STORAGE_PREFIX = "study-room:ten-minute-checkpoint";
const TEN_MINUTE_CHECKPOINT_ACKNOWLEDGED = "acknowledged";

function toNonNegativeInteger(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

export function normalizeHabitText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function getTenMinuteCheckpointState({
  completedTodaySeconds,
  activeTodaySeconds,
  hasActiveSession,
  activeSessionPaused = false,
  acknowledged = false,
}) {
  const completedSeconds = toNonNegativeInteger(completedTodaySeconds);
  const activeSeconds = toNonNegativeInteger(activeTodaySeconds);
  const totalSeconds = completedSeconds + activeSeconds;
  const eligible = Boolean(hasActiveSession) && completedSeconds < DAILY_HABIT_SEED_SECONDS;
  const reached = eligible && totalSeconds >= DAILY_HABIT_SEED_SECONDS;
  const creditedSeconds = Math.min(DAILY_HABIT_SEED_SECONDS, totalSeconds);
  const remainingSeconds = Math.max(0, DAILY_HABIT_SEED_SECONDS - totalSeconds);

  return {
    eligible,
    reached,
    visible: reached && !Boolean(activeSessionPaused) && !Boolean(acknowledged),
    thresholdSeconds: DAILY_HABIT_SEED_SECONDS,
    creditedSeconds,
    remainingSeconds,
    progressPercent: Math.round((creditedSeconds / DAILY_HABIT_SEED_SECONDS) * 100),
  };
}

export function getTenMinuteCheckpointStorageKey({ userId, sessionId, dateKey } = {}) {
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
  const normalizedSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
  const normalizedDateKey = typeof dateKey === "string" ? dateKey.trim() : "";
  if (!normalizedUserId || !normalizedSessionId || !normalizedDateKey) return "";

  return `${TEN_MINUTE_CHECKPOINT_STORAGE_PREFIX}:${normalizedUserId}:${normalizedSessionId}:${normalizedDateKey}`;
}

export function readTenMinuteCheckpointAcknowledged(storage, key) {
  if (!key || !storage || typeof storage.getItem !== "function") return false;
  try {
    return storage.getItem(key) === TEN_MINUTE_CHECKPOINT_ACKNOWLEDGED;
  } catch {
    return false;
  }
}

export function persistTenMinuteCheckpointAcknowledged(storage, key) {
  if (!key || !storage || typeof storage.setItem !== "function") return false;
  try {
    storage.setItem(key, TEN_MINUTE_CHECKPOINT_ACKNOWLEDGED);
    return true;
  } catch {
    return false;
  }
}

export function getLatestNextAction(reflection) {
  return normalizeHabitText(reflection?.next_action);
}

export function getStudyStartAction({
  latestNextAction,
  primaryActionLabel,
  fallbackTodoTitle,
} = {}) {
  const normalizedNextAction = normalizeHabitText(latestNextAction);
  const normalizedPrimaryActionLabel = normalizeHabitText(primaryActionLabel);
  const normalizedFallbackTodoTitle = normalizeHabitText(fallbackTodoTitle);

  if (normalizedNextAction) {
    return {
      label: "이어서 준비하기",
      suggestedTodoTitle: normalizedNextAction,
      source: "reflection",
    };
  }

  if (normalizedPrimaryActionLabel) {
    return {
      label: normalizedPrimaryActionLabel,
      suggestedTodoTitle: normalizedFallbackTodoTitle,
      source: "weekly-goal",
    };
  }

  return {
    label: "입장하고 시작",
    suggestedTodoTitle: normalizedFallbackTodoTitle,
    source: normalizedFallbackTodoTitle ? "today-todo" : "default",
  };
}

export function findMatchingNextActionTodo({ nextAction, todos = [] }) {
  const normalizedAction = normalizeHabitText(nextAction).toLocaleLowerCase();
  if (!normalizedAction) return null;

  return todos.find((todo) => (
    !todo.is_completed
    && normalizeHabitText(todo.title).toLocaleLowerCase() === normalizedAction
  )) ?? null;
}

export function formatHabitDuration(seconds) {
  const totalMinutes = Math.max(0, Math.ceil(toNonNegativeInteger(seconds) / 60));
  if (totalMinutes < 60) return `${totalMinutes}분`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

export function getDailyHabitState({ studySeconds, goalSeconds, completedTodoCount = 0 }) {
  const studied = toNonNegativeInteger(studySeconds);
  const goal = Math.max(DAILY_HABIT_SEED_SECONDS, toNonNegativeInteger(goalSeconds));
  const completedTodos = toNonNegativeInteger(completedTodoCount);
  const habitSuccess = studied >= DAILY_HABIT_SEED_SECONDS;
  const goalReached = studied >= goal;
  const coreTaskCompleted = completedTodos > 0;
  const bloomReached = goalReached && coreTaskCompleted;
  const remainingToSeedSeconds = Math.max(0, DAILY_HABIT_SEED_SECONDS - studied);
  const remainingToGoalSeconds = Math.max(0, goal - studied);

  let stage;
  let title;
  let description;
  let currentMilestoneId;

  if (!habitSuccess) {
    stage = "ready";
    title = "10분만 시작하면 오늘 습관 성공";
    description = `완벽한 하루보다 다시 앉는 한 번을 만들어요. ${formatHabitDuration(remainingToSeedSeconds)} 남았어요.`;
    currentMilestoneId = "seed";
  } else if (!goalReached) {
    stage = "seed";
    title = "오늘의 공부 씨앗을 심었어요";
    description = `이미 습관은 지켰어요. 오늘 목표까지 ${formatHabitDuration(remainingToGoalSeconds)} 남았어요.`;
    currentMilestoneId = "goal";
  } else if (!coreTaskCompleted) {
    stage = "tree";
    title = "오늘 공부 목표를 채웠어요";
    description = "오늘 할 일 하나를 완료하면 공부 습관이 활짝 피어요.";
    currentMilestoneId = "bloom";
  } else {
    stage = "bloom";
    title = "오늘의 공부 습관이 활짝 피었어요";
    description = "공부 시간과 할 일을 모두 지켰어요. 내일도 작은 시작부터 이어가요.";
    currentMilestoneId = null;
  }

  return {
    stage,
    title,
    description,
    habitSuccess,
    goalReached,
    coreTaskCompleted,
    remainingToSeedSeconds,
    remainingToGoalSeconds,
    currentMilestoneId,
    milestones: [
      {
        id: "seed",
        label: "10분 시작",
        detail: "습관 성공",
        completed: habitSuccess,
      },
      {
        id: "goal",
        label: formatHabitDuration(goal),
        detail: "오늘 목표",
        completed: goalReached,
      },
      {
        id: "bloom",
        label: "할 일 1개",
        detail: "오늘 꽃피움",
        completed: bloomReached,
      },
    ],
  };
}
