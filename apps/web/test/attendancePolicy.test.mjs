import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getDailyAttendanceGoalSeconds,
  getEffectiveReminderTime,
  getAttendanceRuleLabel,
} from "../src/attendancePolicy.mjs";

test("uses a 2 hour attendance goal on weekdays and 4 hours on weekends", () => {
  assert.equal(getDailyAttendanceGoalSeconds("2026-06-15"), 2 * 60 * 60);
  assert.equal(getDailyAttendanceGoalSeconds("2026-06-14"), 4 * 60 * 60);
});

test("uses profile reminder time on weekdays and 14:00 on weekends", () => {
  assert.equal(getEffectiveReminderTime("2026-06-15", "20:30"), "20:30");
  assert.equal(getEffectiveReminderTime("2026-06-14", "20:30"), "14:00");
});

test("builds a clear attendance rule label for the current day", () => {
  assert.equal(getAttendanceRuleLabel("2026-06-15", "20:30"), "평일 20:30 알림 · 2시간 목표");
  assert.equal(getAttendanceRuleLabel("2026-06-14", "20:30"), "주말 14:00 알림 · 4시간 목표");
});
