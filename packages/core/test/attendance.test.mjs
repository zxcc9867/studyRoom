import test from "node:test";
import assert from "node:assert/strict";

import {
  ATTENDANCE_WINDOW_MINUTES,
  NUDGE_AFTER_MINUTES,
  EMAIL_OTP_LENGTH,
  calculateFocusSeconds,
  calculateTodoCompletion,
  evaluateAttendance,
  getDateKey,
  isValidEmailOtp,
  normalizeEmailOtp,
} from "../src/index.mjs";

test("marks the reminder as pending before the configured daily time", () => {
  const result = evaluateAttendance({
    now: new Date("2026-06-03T11:44:00.000Z"),
    reminderTime: "21:00",
    timeZone: "Asia/Tokyo",
    sessions: [],
  });

  assert.equal(result.status, "pending");
  assert.equal(result.dateKey, "2026-06-03");
  assert.equal(result.deadlineIso, "2026-06-03T12:30:00.000Z");
});

test("opens attendance for 30 minutes after the reminder time", () => {
  const result = evaluateAttendance({
    now: new Date("2026-06-03T12:20:00.000Z"),
    reminderTime: "21:00",
    timeZone: "Asia/Tokyo",
    sessions: [],
  });

  assert.equal(result.status, "checkin_open");
  assert.equal(result.minutesRemaining, 10);
});

test("marks the day present when a timer starts within the attendance window", () => {
  const result = evaluateAttendance({
    now: new Date("2026-06-03T12:20:00.000Z"),
    reminderTime: "21:00",
    timeZone: "Asia/Tokyo",
    sessions: [{ startedAt: "2026-06-03T12:04:00.000Z" }],
  });

  assert.equal(result.status, "present");
  assert.equal(result.qualifyingSessionStartedAt, "2026-06-03T12:04:00.000Z");
});

test("marks the day missed when no timer starts before the 30 minute deadline", () => {
  const result = evaluateAttendance({
    now: new Date("2026-06-03T12:30:00.000Z"),
    reminderTime: "21:00",
    timeZone: "Asia/Tokyo",
    sessions: [{ startedAt: "2026-06-03T12:30:00.000Z" }],
  });

  assert.equal(result.status, "missed");
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
