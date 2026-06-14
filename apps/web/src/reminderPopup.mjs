export function shouldShowStudyReminderPopup({
  nowMs,
  reminderTime,
  todayDateKey,
  attendanceDays = [],
  activeSession = null,
  hasPopupRecord = false,
  timeZone,
}) {
  const configuredReminderTime = normalizeReminderTime(reminderTime);
  if (!configuredReminderTime || !todayDateKey || hasPopupRecord) {
    return false;
  }

  const currentTime = getLocalHourMinute(new Date(nowMs), timeZone);
  if (currentTime !== configuredReminderTime) {
    return false;
  }

  const todayAttendance = attendanceDays.find((day) => day.local_date === todayDateKey);
  if (todayAttendance?.status === "present" || todayAttendance?.status === "missed") {
    return false;
  }

  if (activeSession?.status === "active" && activeSession.local_date === todayDateKey) {
    return false;
  }

  return true;
}

function normalizeReminderTime(reminderTime) {
  const value = String(reminderTime ?? "").slice(0, 5);
  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

function getLocalHourMinute(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    ...(timeZone ? { timeZone } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return `${hour}:${minute}`;
}
