import test from "node:test";
import assert from "node:assert/strict";

import {
  ATTENDANCE_WINDOW_MINUTES,
  DEFAULT_WEEKDAY_REMINDER_TIME,
  DEFAULT_WEEKEND_REMINDER_TIME,
  NUDGE_AFTER_MINUTES,
  EMAIL_OTP_LENGTH,
  calculateFocusSeconds,
  calculateTodoCompletion,
  evaluateAttendance,
  getDailyAttendanceGoalSeconds,
  getDateKey,
  getEffectiveReminderTime,
  isValidEmailOtp,
  normalizeEmailOtp,
} from "../src/index.mjs";

test("keeps attendance pending until the study day ends, independently of reminder time", () => {
  for (const now of ["2026-06-03T11:44:00Z", "2026-06-03T12:20:00Z", "2026-06-03T12:30:00Z", "2026-06-03T18:59:59Z"]) {
    const result = evaluateAttendance({ now, reminderTime: "21:00", timeZone: "Asia/Tokyo", sessions: [] });
    assert.equal(result.status, "pending");
    assert.equal(result.dateKey, "2026-06-03");
    assert.equal(result.deadlineIso, "2026-06-03T19:00:00.000Z");
  }
});

test("a completed morning start earns attendance without meeting the weekend four-hour goal", () => {
  const result = evaluateAttendance({
    now: "2026-10-25T06:01:00Z", reminderTime: "20:30", timeZone: "Asia/Tokyo",
    sessions: [{ local_date: "2026-10-25", status: "completed", started_at: "2026-10-25T00:47:49Z", ended_at: "2026-10-25T01:47:50Z", duration_seconds: 3601 }],
  });
  assert.equal(result.status, "present");
  assert.equal(result.attendanceReason, "study_session_started");
  assert.equal(result.qualifyingSessionStartedAt, "2026-10-25T00:47:49.000Z");
  assert.equal(getDailyAttendanceGoalSeconds(result.dateKey), 14400);
});

test("an active one-second start earns attendance before or after the reminder", () => {
  for (const startedAt of ["2026-06-03T01:00:00Z", "2026-06-03T13:00:00Z", "2026-06-03T18:59:59Z"]) {
    const result = evaluateAttendance({ now: startedAt, reminderTime: "21:00", timeZone: "Asia/Tokyo", sessions: [{ startedAt, status: "active" }] });
    assert.equal(result.status, "present");
    assert.equal(result.attendanceReason, "study_session_started");
  }
});

test("invalid, future, cancelled, and another study day's sessions cannot earn attendance", () => {
  const result = evaluateAttendance({
    now: "2026-06-03T12:30:00Z", reminderTime: "21:00", timeZone: "Asia/Tokyo",
    sessions: [
      { startedAt: "invalid", status: "active" },
      { startedAt: "2026-06-03T12:30:01Z", status: "active" },
      { startedAt: "2026-06-03T10:00:00Z", status: "cancelled" },
      { startedAt: "2026-06-02T12:04:00Z", durationSeconds: 14400 },
    ],
  });
  assert.equal(result.status, "pending");
});

test("a missed day is final only at the next local 04:00 with no study start", () => {
  const base = { studyDateKey: "2026-06-03", reminderTime: "21:00", timeZone: "Asia/Tokyo", sessions: [] };
  assert.equal(evaluateAttendance({ ...base, now: "2026-06-03T18:59:59Z" }).status, "pending");
  const result = evaluateAttendance({ ...base, now: "2026-06-03T19:00:00Z" });
  assert.equal(result.status, "missed");
  assert.equal(result.dateKey, "2026-06-03");
  assert.equal(result.minutesRemaining, 0);
});

test("a start after 04:00 belongs only to the new study day", () => {
  const sessions = [{ startedAt: "2026-06-03T19:00:00Z", status: "active" }];
  const base = { now: "2026-06-03T19:00:01Z", reminderTime: "21:00", timeZone: "Asia/Tokyo", sessions };
  assert.equal(evaluateAttendance({ ...base, studyDateKey: "2026-06-03" }).status, "missed");
  assert.equal(evaluateAttendance(base).status, "present");
});

test("stored session study dates remain authoritative across timezone changes", () => {
  const result = evaluateAttendance({
    now: "2026-06-03T18:30:00Z", reminderTime: "21:00", timeZone: "Asia/Tokyo",
    sessions: [{ local_date: "2026-06-02", started_at: "2026-06-03T01:00:00Z", status: "completed", duration_seconds: 14400 }],
  });
  assert.equal(result.status, "pending");
});

test("uses weekend reminders while keeping two/four hour study goals separate", () => {
  const result = evaluateAttendance({ now: "2026-06-14T05:00:00Z", reminderTime: "20:30", timeZone: "Asia/Tokyo", sessions: [] });
  assert.equal(DEFAULT_WEEKDAY_REMINDER_TIME, "20:30");
  assert.equal(DEFAULT_WEEKEND_REMINDER_TIME, "14:00");
  assert.equal(getEffectiveReminderTime("2026-06-14", "20:30"), "14:00");
  assert.equal(getDailyAttendanceGoalSeconds("2026-06-14"), 14400);
  assert.equal(getDailyAttendanceGoalSeconds("2026-06-15"), 7200);
  assert.equal(result.status, "pending");
  assert.equal(result.reminderIso, "2026-06-14T05:00:00.000Z");
  assert.equal(result.deadlineIso, "2026-06-14T19:00:00.000Z");
});

test("study-day attendance deadlines follow local 04:00 across DST", () => {
  for (const [studyDateKey, now, deadlineIso] of [
    ["2026-03-07", "2026-03-08T07:30:00Z", "2026-03-08T08:00:00.000Z"],
    ["2026-10-31", "2026-11-01T08:30:00Z", "2026-11-01T09:00:00.000Z"],
  ]) {
    const result = evaluateAttendance({ now, studyDateKey, reminderTime: "20:30", timeZone: "America/New_York", sessions: [] });
    assert.equal(result.status, "pending");
    assert.equal(result.deadlineIso, deadlineIso);
  }
});

test("calculates focus seconds from completed sessions and ignores invalid ranges", () => {
  const total = calculateFocusSeconds([
    {
      startedAt: "2026-06-03T12:00:00.000Z",
      endedAt: "2026-06-03T12:25:30.000Z",
    },
    {
      startedAt: "2026-06-03T13:00:00.000Z",
      endedAt: "2026-06-03T13:10:00.000Z",
    },
    {
      startedAt: "2026-06-03T15:00:00.000Z",
      endedAt: "2026-06-03T14:00:00.000Z",
    },
  ]);

  assert.equal(total, 2130);
});

test("calculates todo checklist completion percentage", () => {
  assert.deepEqual(
    calculateTodoCompletion([
      { isCompleted: true },
      { isCompleted: false },
      { isCompleted: true },
    ]),
    { total: 3, completed: 2, percent: 67 },
  );
  assert.deepEqual(calculateTodoCompletion([]), { total: 0, completed: 0, percent: 0 });
});

test("formats date keys in the requested time zone", () => {
  assert.equal(getDateKey(new Date("2026-06-03T15:10:00.000Z"), "Asia/Tokyo"), "2026-06-04");
  assert.equal(ATTENDANCE_WINDOW_MINUTES, 30);
  assert.equal(NUDGE_AFTER_MINUTES, 15);
});

test("normalizes and validates eight digit email OTP codes", () => {
  assert.equal(EMAIL_OTP_LENGTH, 8);
  assert.equal(normalizeEmailOtp(" 0022 4379 "), "00224379");
  assert.equal(isValidEmailOtp("00224379"), true);
  assert.equal(isValidEmailOtp("123456"), false);
  assert.equal(isValidEmailOtp("123456789"), false);
  assert.equal(isValidEmailOtp("1234567a"), false);
});
