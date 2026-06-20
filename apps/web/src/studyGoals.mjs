const activeStatusRank = {
  active: 0,
  completed: 1,
  archived: 2,
};

function dateKeyToUtcMs(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getGoalStartDateKey(goal) {
  return String(goal.created_at ?? "").slice(0, 10);
}

export function formatDdayLabel(todayDateKey, targetDateKey) {
  const todayMs = dateKeyToUtcMs(todayDateKey);
  const targetMs = dateKeyToUtcMs(targetDateKey);
  const dayDiff = Math.round((targetMs - todayMs) / 86_400_000);

  if (dayDiff === 0) return "D-day";
  if (dayDiff > 0) return `D-${dayDiff}`;
  return `D+${Math.abs(dayDiff)}`;
}

export function sortStudyGoals(goals) {
  return [...goals].sort((left, right) => {
    const leftRank = activeStatusRank[left.status] ?? 99;
    const rightRank = activeStatusRank[right.status] ?? 99;
    if (leftRank !== rightRank) return leftRank - rightRank;
    if (left.target_date !== right.target_date) {
      return left.target_date.localeCompare(right.target_date);
    }
    return String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""));
  });
}

export function getActiveStudyGoal(goals) {
  return sortStudyGoals(goals).find((goal) => goal.status === "active") ?? null;
}

export function getGoalLinkedTodos(goalId, todos) {
  return todos.filter((todo) => todo.goal_id === goalId);
}

export function calculateGoalStudySeconds({
  goal,
  sessions,
  activeSessionId = null,
  activeElapsedSeconds = 0,
}) {
  const startDateKey = getGoalStartDateKey(goal);
  return sessions
    .filter((session) => session.local_date >= startDateKey && session.local_date <= goal.target_date)
    .reduce((sum, session) => {
      if (session.status === "active") {
        return session.id === activeSessionId ? sum + Math.max(0, activeElapsedSeconds) : sum;
      }
      return sum + Math.max(0, session.duration_seconds ?? 0);
    }, 0);
}

export function calculateGoalProgress({ goal, linkedTodos, studiedSeconds }) {
  const linkedTodoCount = linkedTodos.length;
  const completedTodoCount = linkedTodos.filter((todo) => todo.is_completed).length;
  const todoPercent = linkedTodoCount === 0 ? 0 : clampPercent((completedTodoCount / linkedTodoCount) * 100);
  const targetStudySeconds = Math.max(0, goal.target_study_seconds ?? 0);
  const studyPercent = targetStudySeconds === 0 ? 0 : clampPercent((studiedSeconds / targetStudySeconds) * 100);

  let percent = 0;
  if (linkedTodoCount > 0 && targetStudySeconds > 0) {
    percent = clampPercent((todoPercent + studyPercent) / 2);
  } else if (linkedTodoCount > 0) {
    percent = todoPercent;
  } else if (targetStudySeconds > 0) {
    percent = studyPercent;
  }

  return {
    linkedTodoCount,
    completedTodoCount,
    todoPercent,
    studyPercent,
    percent,
  };
}
