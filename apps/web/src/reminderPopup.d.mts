type ReminderAttendanceDay = {
  local_date: string;
  status: "pending" | "present" | "missed" | string;
};

type ReminderStudySession = {
  local_date: string;
  status: "active" | "completed" | "cancelled" | string;
} | null;

export function shouldShowStudyReminderPopup(params: {
  nowMs: number;
  reminderTime: string | null | undefined;
  todayDateKey: string;
  attendanceDays?: ReminderAttendanceDay[];
  activeSession?: ReminderStudySession;
  hasPopupRecord?: boolean;
  timeZone?: string;
}): boolean;
