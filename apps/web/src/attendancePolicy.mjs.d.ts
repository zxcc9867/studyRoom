export const DEFAULT_WEEKDAY_REMINDER_TIME: string;
export const WEEKEND_REMINDER_TIME: string;
export const WEEKDAY_ATTENDANCE_GOAL_SECONDS: number;
export const WEEKEND_ATTENDANCE_GOAL_SECONDS: number;

export function getDailyAttendanceGoalSeconds(dateKey: string): number;
export function getEffectiveReminderTime(dateKey: string, weekdayReminderTime?: string): string;
export function getAttendanceRuleLabel(dateKey: string, weekdayReminderTime?: string): string;
export function getAttendanceStartLabel(
  attendance: { local_date: string; status: string; reminder_at: string | null } | undefined,
  sessions: readonly { local_date: string; status: string; started_at: string }[],
  nowMs?: number,
): "정시 시작" | "늦게 시작" | null;
export function formatAttendanceGoalHours(goalSeconds: number): string;
