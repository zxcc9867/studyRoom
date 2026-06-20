export type StudyGoalStatus = "active" | "completed" | "archived";

export type StudyGoalLike = {
  id: string;
  user_id: string;
  title: string;
  target_date: string;
  target_study_seconds: number;
  status: StudyGoalStatus;
  created_at: string;
  updated_at?: string;
};

export type GoalTodoLike = {
  goal_id: string | null;
  is_completed: boolean;
};

export type GoalSessionLike = {
  id: string;
  local_date: string;
  status: string;
  duration_seconds: number;
};

export function formatDdayLabel(todayDateKey: string, targetDateKey: string): string;

export function sortStudyGoals<T extends StudyGoalLike>(goals: T[]): T[];

export function getActiveStudyGoal<T extends StudyGoalLike>(goals: T[]): T | null;

export function getGoalLinkedTodos<T extends GoalTodoLike>(goalId: string, todos: T[]): T[];

export function calculateGoalStudySeconds(options: {
  goal: StudyGoalLike;
  sessions: GoalSessionLike[];
  activeSessionId?: string | null;
  activeElapsedSeconds?: number;
}): number;

export function calculateGoalProgress(options: {
  goal: StudyGoalLike;
  linkedTodos: GoalTodoLike[];
  studiedSeconds: number;
}): {
  linkedTodoCount: number;
  completedTodoCount: number;
  todoPercent: number;
  studyPercent: number;
  percent: number;
};
