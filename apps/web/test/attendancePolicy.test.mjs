import assert from "node:assert/strict";
import { test } from "node:test";
import * as attendancePolicy from "../src/attendancePolicy.mjs";

import {
  getDailyAttendanceGoalSeconds,
  getEffectiveReminderTime,
  getAttendanceRuleLabel,
} from "../src/attendancePolicy.mjs";

test("uses a 2 hour study goal on weekdays and 4 hours on weekends", () => {
  assert.equal(getDailyAttendanceGoalSeconds("2026-06-15"), 2 * 60 * 60);
  assert.equal(getDailyAttendanceGoalSeconds("2026-06-14"), 4 * 60 * 60);
});

test("uses profile reminder time on weekdays and 14:00 on weekends", () => {
  assert.equal(getEffectiveReminderTime("2026-06-15", "20:30"), "20:30");
  assert.equal(getEffectiveReminderTime("2026-06-14", "20:30"), "14:00");
});

test("builds a clear attendance rule label for the current day", () => {
  assert.equal(getAttendanceRuleLabel("2026-06-15", "20:30"), "공부 시작 시 출석 · 평일 20:30 알림 · 2시간 공부 목표");
  assert.equal(getAttendanceRuleLabel("2026-06-14", "20:30"), "공부 시작 시 출석 · 주말 14:00 알림 · 4시간 공부 목표");
});

test("first valid start uses the saved day's reminder and the 15-minute boundary, not the last session", () => {
  assert.equal(typeof attendancePolicy.getAttendanceStartLabel, "function", "the record needs a start label independent of attendance");
  const attendance = { local_date: "2026-11-12", status: "present", reminder_at: "2026-11-12T21:00:00+09:00" };
  const late = { local_date: attendance.local_date, status: "active", started_at: "2026-11-12T12:15:00Z" };
  const early = { ...late, status: "completed", started_at: "2026-11-12T12:14:59Z" };
  const cancelled = { ...early, status: "cancelled" };
  const previous = { ...early, local_date: "2026-11-11" };
  const future = { ...late, started_at: "2026-11-12T14:00:00Z" };
  const now = Date.parse("2026-11-12T13:00:00Z");
  assert.equal(attendancePolicy.getAttendanceStartLabel(attendance, [future, { ...late, started_at: "invalid" }], now), null);
  assert.equal(attendancePolicy.getAttendanceStartLabel(attendance, [late, early], now), "정시 시작");
  assert.equal(attendancePolicy.getAttendanceStartLabel(attendance, [late, cancelled, previous], now), "늦게 시작");
  assert.equal(attendancePolicy.getAttendanceStartLabel(attendance, [cancelled, previous], now), null);
  assert.equal(attendancePolicy.getAttendanceStartLabel({ ...attendance, reminder_at: null }, [early], now), null);
  assert.equal(attendancePolicy.getAttendanceStartLabel({ ...attendance, status: "missed" }, [early], now), null);
});
