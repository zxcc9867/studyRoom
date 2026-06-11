import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateTodoHistoryStats,
  getCompletedTodoHistory,
  paginateTodoHistory,
} from "../src/todoHistory.mjs";

function todo(overrides) {
  return {
    id: "todo-id",
    local_date: "2026-06-01",
    title: "AWS study",
    is_completed: false,
    position: 0,
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

test("completed todo history filters incomplete todos and sorts newest first", () => {
  const result = getCompletedTodoHistory([
    todo({ id: "old", title: "Old done", is_completed: true, local_date: "2026-05-30", created_at: "2026-05-30T01:00:00.000Z" }),
    todo({ id: "incomplete", title: "Not done", is_completed: false, local_date: "2026-06-10", created_at: "2026-06-10T01:00:00.000Z" }),
    todo({ id: "same-day-later", title: "Later", is_completed: true, local_date: "2026-06-11", created_at: "2026-06-11T12:00:00.000Z" }),
    todo({ id: "same-day-earlier", title: "Earlier", is_completed: true, local_date: "2026-06-11", created_at: "2026-06-11T08:00:00.000Z" }),
  ]);

  assert.deepEqual(
    result.map((item) => item.id),
    ["same-day-later", "same-day-earlier", "old"],
  );
});

test("todo history pagination returns fixed pages and clamps out-of-range requests", () => {
  const items = Array.from({ length: 23 }, (_, index) =>
    todo({ id: `done-${index + 1}`, is_completed: true, local_date: "2026-06-01" }),
  );

  const pageTwo = paginateTodoHistory(items, 2, 10);
  const pageTooHigh = paginateTodoHistory(items, 99, 10);
  const pageTooLow = paginateTodoHistory(items, -1, 10);

  assert.equal(pageTwo.items.length, 10);
  assert.equal(pageTwo.currentPage, 2);
  assert.equal(pageTwo.totalPages, 3);
  assert.equal(pageTwo.hasPrevious, true);
  assert.equal(pageTwo.hasNext, true);
  assert.equal(pageTooHigh.currentPage, 3);
  assert.equal(pageTooHigh.items.length, 3);
  assert.equal(pageTooLow.currentPage, 1);
});

test("todo history stats count completed totals and selected month completions", () => {
  const stats = calculateTodoHistoryStats(
    [
      todo({ id: "may-done", is_completed: true, local_date: "2026-05-31" }),
      todo({ id: "june-done-1", is_completed: true, local_date: "2026-06-01" }),
      todo({ id: "june-done-2", is_completed: true, local_date: "2026-06-12" }),
      todo({ id: "june-open", is_completed: false, local_date: "2026-06-13" }),
    ],
    "2026-06",
  );

  assert.deepEqual(stats, {
    totalTodos: 4,
    completedTodos: 3,
    completionPercent: 75,
    monthCompletedTodos: 2,
  });
});
