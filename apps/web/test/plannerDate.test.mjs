import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPlanCopyRows,
  getPlannerDateLabel,
  normalizePlanCopyTargetDates,
} from "../src/plannerDate.mjs";

const baseTodo = {
  id: "source-1",
  user_id: "user-1",
  local_date: "2026-06-29",
  title: "React study",
  is_completed: true,
  position: 3,
  start_time: "09:00",
  end_time: "10:00",
  goal_id: "goal-1",
  repeat_group_id: "repeat-1",
  repeat_mode: "weekly",
  repeat_weekdays: [1, 3],
  repeat_until: "2026-07-31",
  repeat_forever: false,
  created_at: "2026-06-29T00:00:00.000Z",
};

test("labels planner dates relative to today", () => {
  assert.equal(getPlannerDateLabel("2026-06-28", "2026-06-29"), "어제 할 일");
  assert.equal(getPlannerDateLabel("2026-06-29", "2026-06-29"), "오늘 할 일");
  assert.equal(getPlannerDateLabel("2026-06-30", "2026-06-29"), "내일 할 일");
  assert.equal(getPlannerDateLabel("2026-07-03", "2026-06-29"), "7월 3일 할 일");
});

test("normalizes plan copy targets without the source date", () => {
  assert.deepEqual(
    normalizePlanCopyTargetDates({
      sourceDate: "2026-06-29",
      selectedDates: ["2026-06-30", "2026-06-29", "bad", "2026-06-30", "2026-07-01"],
    }),
    ["2026-06-30", "2026-07-01"],
  );
});

test("builds plain copied todo rows and skips duplicate target schedules", () => {
  const rows = buildPlanCopyRows({
    sourceTodos: [baseTodo],
    targetDates: ["2026-06-30", "2026-07-01"],
    existingTodos: [
      {
        ...baseTodo,
        id: "duplicate",
        local_date: "2026-06-30",
        is_completed: false,
      },
      {
        ...baseTodo,
        id: "last",
        local_date: "2026-07-01",
        title: "Other",
        position: 7,
      },
    ],
    userId: "user-1",
  });

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    user_id: "user-1",
    local_date: "2026-07-01",
    title: "React study",
    start_time: "09:00",
    end_time: "10:00",
    goal_id: "goal-1",
    repeat_group_id: null,
    repeat_mode: "single",
    repeat_weekdays: [],
    repeat_until: null,
    repeat_forever: false,
    is_completed: false,
    position: 8,
  });
});
