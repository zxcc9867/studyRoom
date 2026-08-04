import type { DailyHabitStage } from "./dailyHabit.mjs";

export const WEEKLY_HABIT_TARGET_DAYS: number;
export const WEEKLY_HABIT_REST_ALLOWANCE_DAYS: number;

export type WeeklyHabitSession = {
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  status: string;
};

export type WeeklyHabitTodo = {
  local_date: string;
  is_completed: boolean;
};

export type WeeklyHabitDay = {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
  isToday: boolean;
  studySeconds: number;
  studyLabel: string;
  completedTodoCount: number;
  goalSeconds: number;
  stage: DailyHabitStage;
  stageLabel: string;
  habitSuccess: boolean;
  goalReached: boolean;
  bloomReached: boolean;
};

export type WeeklyHabitTargetState = {
  targetDays: number;
  restAllowanceDays: number;
  creditedStartDays: number;
  remainingTargetDays: number;
  targetReached: boolean;
  progressPercent: number;
};

export type WeeklyHabitReward = {
  id: string;
  earnedDateKey: string;
  windowStartDateKey: string;
  windowEndDateKey: string;
};

export type WeeklyHabitRewardHistory = {
  earnedCount: number;
  latestEarnedDateKey: string | null;
  successfulDateKeys: string[];
  earnedRewards: WeeklyHabitReward[];
};

export type WeeklyHabitRhythm = {
  days: WeeklyHabitDay[];
  rangeLabel: string;
  startSuccessDays: number;
  goalDays: number;
  bloomDays: number;
  currentStreakDays: number;
  target: WeeklyHabitTargetState;
  isGentleRestart: boolean;
  primaryActionLabel: string | null;
  coach: {
    title: string;
    description: string;
  };
};

export function getWeeklyHabitTargetState(startSuccessDays: unknown): WeeklyHabitTargetState;
export function getWeeklyHabitRewardHistory(input: {
  todayDateKey: string;
  timeZone?: string | null;
  sessions?: WeeklyHabitSession[];
}): WeeklyHabitRewardHistory;
export function shiftHabitDateKey(dateKey: string, offsetDays: number): string;
export function getRollingHabitDateKeys(todayDateKey: string, dayCount?: number): string[];
export function allocateCompletedStudySecondsByDate(input: {
  sessions?: WeeklyHabitSession[];
  dateKeys: string[];
  timeZone?: string | null;
}): Record<string, number>;
export function getWeeklyHabitRhythm(input: {
  todayDateKey: string;
  timeZone?: string | null;
  sessions?: WeeklyHabitSession[];
  todos?: WeeklyHabitTodo[];
  todayStudySeconds?: number | null;
}): WeeklyHabitRhythm;
