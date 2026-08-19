import assert from "node:assert/strict";
import { test } from "node:test";

import { getSuggestedSessionTodoSchedule } from "../src/sessionTodoSchedule.mjs";

test("suggests a one-hour session schedule rounded up to the next half hour", () => {
  assert.deepEqual(
    getSuggestedSessionTodoSchedule(new Date(2026, 7, 9, 9, 14, 40)),
    { startTime: "09:30", endTime: "10:30" },
  );
});

test("keeps a valid overnight end time for a late session", () => {
  assert.deepEqual(
    getSuggestedSessionTodoSchedule(new Date(2026, 7, 9, 23, 46, 0)),
    { startTime: "00:00", endTime: "01:00" },
  );
});
