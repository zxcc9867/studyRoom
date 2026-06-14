import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatTodoScheduleLabel,
  formatTodoWithSchedule,
  normalizeTodoSchedule,
} from "../src/todoSchedule.mjs";

test("normalizes disabled todo schedule to null times", () => {
  assert.deepEqual(
    normalizeTodoSchedule({
      enabled: false,
      startTime: "09:00",
      endTime: "10:00",
    }),
    {
      ok: true,
      startTime: null,
      endTime: null,
    },
  );
});

test("accepts a valid todo start and end time", () => {
  assert.deepEqual(
    normalizeTodoSchedule({
      enabled: true,
      startTime: "09:00",
      endTime: "10:30",
    }),
    {
      ok: true,
      startTime: "09:00",
      endTime: "10:30",
    },
  );
});

test("rejects incomplete or reversed todo time ranges", () => {
  assert.equal(normalizeTodoSchedule({ enabled: true, startTime: "", endTime: "10:00" }).ok, false);
  assert.equal(normalizeTodoSchedule({ enabled: true, startTime: "10:00", endTime: "" }).ok, false);
  assert.equal(normalizeTodoSchedule({ enabled: true, startTime: "10:00", endTime: "09:00" }).ok, false);
  assert.equal(normalizeTodoSchedule({ enabled: true, startTime: "10:00", endTime: "10:00" }).ok, false);
});

test("formats todo schedule labels for UI and notifications", () => {
  const todo = {
    title: "AWS study",
    start_time: "09:00",
    end_time: "10:30",
  };

  assert.equal(formatTodoScheduleLabel(todo), "09:00-10:30");
  assert.equal(formatTodoWithSchedule(todo), "09:00-10:30 AWS study");
  assert.equal(formatTodoWithSchedule({ title: "No schedule", start_time: null, end_time: null }), "No schedule");
});
