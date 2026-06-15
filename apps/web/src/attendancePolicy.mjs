export const DEFAULT_WEEKDAY_REMINDER_TIME = "20:30";
export const WEEKEND_REMINDER_TIME = "14:00";
export const WEEKDAY_ATTENDANCE_GOAL_SECONDS = 2 * 60 * 60;
export const WEEKEND_ATTENDANCE_GOAL_SECONDS = 4 * 60 * 60;

export function getDailyAttendanceGoalSeconds(dateKey) {
  return isWeekendDateKey(dateKey) ? WEEKEND_ATTENDANCE_GOAL_SECONDS : WEEKDAY_ATTENDANCE_GOAL_SECONDS;
}

export function getEffectiveReminderTime(dateKey, weekdayReminderTime = DEFAULT_WEEKDAY_REMINDER_TIME) {
  if (isWeekendDateKey(dateKey)) {
    return WEEKEND_REMINDER_TIME;
  }

  return normalizeReminderTime(weekdayReminderTime) ?? DEFAULT_WEEKDAY_REMINDER_TIME;
}

export function getAttendanceRuleLabel(dateKey, weekdayReminderTime = DEFAULT_WEEKDAY_REMINDER_TIME) {
  const dayType = isWeekendDateKey(dateKey) ? "주말" : "평일";
  return `${dayType} ${getEffectiveReminderTime(dateKey, weekdayReminderTime)} 알림 · ${formatAttendanceGoalHours(
    getDailyAttendanceGoalSeconds(dateKey),
  )} 목표`;
}

export function formatAttendanceGoalHours(goalSeconds) {
  const hours = goalSeconds / 3600;
  return Number.isInteger(hours) ? `${hours}시간` : `${hours.toFixed(1)}시간`;
}

function isWeekendDateKey(dateKey) {
  const normalized = String(dateKey ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return false;
  }

  const day = new Date(`${normalized}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function normalizeReminderTime(value) {
  const normalized = String(value ?? "").slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : null;
}
