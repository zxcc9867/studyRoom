export const DAILY_HABIT_SEED_SECONDS: number;

export type DailyHabitStage = "ready" | "seed" | "tree" | "bloom";
export type DailyHabitMilestoneId = "seed" | "goal" | "bloom";

export type DailyHabitMilestone = {
  id: DailyHabitMilestoneId;
  label: string;
  detail: string;
  completed: boolean;
};

export type DailyHabitState = {
  stage: DailyHabitStage;
  title: string;
  description: string;
  habitSuccess: boolean;
  goalReached: boolean;
  coreTaskCompleted: boolean;
  remainingToSeedSeconds: number;
  remainingToGoalSeconds: number;
  currentMilestoneId: DailyHabitMilestoneId | null;
  milestones: DailyHabitMilestone[];
};

export type TenMinuteCheckpointState = {
  eligible: boolean;
  reached: boolean;
  visible: boolean;
  thresholdSeconds: number;
  creditedSeconds: number;
  remainingSeconds: number;
  progressPercent: number;
};

export type TenMinuteCheckpointStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type StudyStartActionSource = "reflection" | "weekly-goal" | "today-todo" | "default";

export type StudyStartAction = {
  label: string;
  suggestedTodoTitle: string;
  source: StudyStartActionSource;
};

export function normalizeHabitText(value: unknown): string;
export function getTenMinuteCheckpointState(input: {
  completedTodaySeconds: unknown;
  activeTodaySeconds: unknown;
  hasActiveSession: unknown;
  activeSessionPaused?: unknown;
  acknowledged?: unknown;
}): TenMinuteCheckpointState;
export function getTenMinuteCheckpointStorageKey(input?: {
  userId?: unknown;
  sessionId?: unknown;
  dateKey?: unknown;
}): string;
export function readTenMinuteCheckpointAcknowledged(
  storage: TenMinuteCheckpointStorage | null | undefined,
  key: string,
): boolean;
export function persistTenMinuteCheckpointAcknowledged(
  storage: TenMinuteCheckpointStorage | null | undefined,
  key: string,
): boolean;
export function getLatestNextAction(reflection: { next_action?: string | null } | null | undefined): string;
export function getStudyStartAction(input?: {
  latestNextAction?: unknown;
  primaryActionLabel?: unknown;
  fallbackTodoTitle?: unknown;
}): StudyStartAction;
export function findMatchingNextActionTodo<T extends { title: string; is_completed?: boolean }>({
  nextAction,
  todos,
}: {
  nextAction: unknown;
  todos?: T[];
}): T | null;
export function formatHabitDuration(seconds: unknown): string;
export function getDailyHabitState(input: {
  studySeconds: unknown;
  goalSeconds: unknown;
  completedTodoCount?: unknown;
}): DailyHabitState;
