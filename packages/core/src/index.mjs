export const ATTENDANCE_WINDOW_MINUTES = 30;
export const NUDGE_AFTER_MINUTES = 15;
export const EMAIL_OTP_LENGTH = 8;

const minuteMs = 60 * 1000;
const emailOtpPattern = new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`);

export function getDateKey(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function evaluateAttendance({ now, reminderTime, timeZone, sessions }) {
  const current = asDate(now);
  const dateKey = getDateKey(current, timeZone);
  const reminderAt = zonedTimeToUtc(dateKey, reminderTime, timeZone);
  const deadlineAt = new Date(reminderAt.getTime() + ATTENDANCE_WINDOW_MINUTES * minuteMs);
  const qualifyingSession = sessions
    .map((session) => ({ ...session, startedAtDate: asDate(session.startedAt) }))
    .find((session) => session.startedAtDate >= reminderAt && session.startedAtDate < deadlineAt);

  if (qualifyingSession) {
    return {
      status: "present",
      dateKey,
      reminderIso: reminderAt.toISOString(),
      deadlineIso: deadlineAt.toISOString(),
      qualifyingSessionStartedAt: qualifyingSession.startedAtDate.toISOString(),
      minutesRemaining: 0,
    };
  }

  if (current < reminderAt) {
    return buildResult("pending", dateKey, reminderAt, deadlineAt, current);
  }

  if (current < deadlineAt) {
    return buildResult("checkin_open", dateKey, reminderAt, deadlineAt, current);
  }

  return buildResult("missed", dateKey, reminderAt, deadlineAt, current);
}

export function calculateFocusSeconds(sessions) {
  return sessions.reduce((total, session) => {
    if (!session.startedAt || !session.endedAt) {
      return total;
    }

    const startedAt = asDate(session.startedAt);
    const endedAt = asDate(session.endedAt);
    const seconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    return seconds > 0 ? total + seconds : total;
  }, 0);
}

export function calculateTodoCompletion(todos) {
  const total = todos.length;
  const completed = todos.filter((todo) => Boolean(todo.isCompleted)).length;

  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function isValidReminderTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizeEmailOtp(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

export function isValidEmailOtp(value) {
  return emailOtpPattern.test(normalizeEmailOtp(value));
}

function buildResult(status, dateKey, reminderAt, deadlineAt, now) {
  return {
    status,
    dateKey,
    reminderIso: reminderAt.toISOString(),
    deadlineIso: deadlineAt.toISOString(),
    minutesRemaining: Math.max(0, Math.ceil((deadlineAt.getTime() - now.getTime()) / minuteMs)),
  };
}

function zonedTimeToUtc(dateKey, localTime, timeZone) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let utcMs = targetAsUtc;

  for (let i = 0; i < 4; i += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const projectedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
    const diff = projectedAsUtc - targetAsUtc;
    if (diff === 0) {
      break;
    }
    utcMs -= diff;
  }

  return new Date(utcMs);
}

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const values = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function asDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function pad(value) {
  return String(value).padStart(2, "0");
}
