import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateGoalProgress,
  calculateGoalStudySeconds,
  formatDdayLabel,
  getActiveStudyGoal,
  getGoalLinkedTodos,
  sortStudyGoals,
} from "../src/studyGoals.mjs";

function goal(overrides) {
  return {
    id: "goal-id",
    user_id: "user-id",
    title: "정보처리기사 실기 합격",
    target_date: "2026-07-31",
    target_study_seconds: 7200,
    status: "active",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function todo(overrides) {
  return {
    id: "todo-id",
    user_id: "user-id",
    local_date: "2026-06-20",
    title: "기출 3회독",
    is_completed: false,
    position: 0,
    start_time: null,
    end_time: null,
    repeat_group_id: null,
    repeat_mode: "single",
    repeat_weekdays: null,
    repeat_until: null,
    goal_id: null,
    created_at: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

test("formats D-day labels from local date keys", () => {
  assert.equal(formatDdayLabel("2026-06-20", "2026-07-31"), "D-41");
  assert.equal(formatDdayLabel("2026-07-31", "2026-07-31"), "D-day");
  assert.equal(formatDdayLabel("2026-08-02", "2026-07-31"), "D+2");
});

test("sorts active goals before completed goals and nearest target first", () => {
  const result = sortStudyGoals([
    goal({ id: "completed", status: "completed", target_date: "2026-06-30" }),
    goal({ id: "far", status: "active", target_date: "2026-09-01" }),
    goal({ id: "near", status: "active", target_date: "2026-07-01" }),
  ]);

  assert.deepEqual(
    result.map((item) => item.id),
    ["near", "far", "completed"],
  );
});

test("selects the nearest active goal for the dashboard card", () => {
  const result = getActiveStudyGoal([
    goal({ id: "later", target_date: "2026-09-01" }),
    goal({ id: "archived", status: "archived", target_date: "2026-06-21" }),
    goal({ id: "next", target_date: "2026-07-01" }),
  ]);

  assert.equal(result?.id, "next");
});

test("filters todos linked to a goal", () => {
  const result = getGoalLinkedTodos("goal-a", [
    todo({ id: "linked", goal_id: "goal-a" }),
    todo({ id: "other", goal_id: "goal-b" }),
    todo({ id: "unlinked", goal_id: null }),
  ]);

  assert.deepEqual(
    result.map((item) => item.id),
    ["linked"],
  );
});

test("calculates goal progress from linked todos and study target", () => {
  const result = calculateGoalProgress({
    goal: goal({ target_study_seconds: 7200 }),
    linkedTodos: [
      todo({ id: "done", is_completed: true, goal_id: "goal-id" }),
      todo({ id: "open", is_completed: false, goal_id: "goal-id" }),
    ],
    studiedSeconds: 3600,
  });

  assert.deepEqual(result, {
    linkedTodoCount: 2,
    completedTodoCount: 1,
    todoPercent: 50,
    studyPercent: 50,
    percent: 50,
  });
});

test("uses study progress when a goal has no linked todos", () => {
  const result = calculateGoalProgress({
    goal: goal({ target_study_seconds: 3600 }),
    linkedTodos: [],
    studiedSeconds: 1800,
  });

  assert.equal(result.percent, 50);
  assert.equal(result.todoPercent, 0);
  assert.equal(result.studyPercent, 50);
});

test("calculates goal study seconds inside the goal date window", () => {
  const result = calculateGoalStudySeconds({
    goal: goal({
      created_at: "2026-06-10T00:00:00.000Z",
      target_date: "2026-06-30",
    }),
    sessions: [
      { id: "too-old", local_date: "2026-06-09", status: "completed", duration_seconds: 999 },
      { id: "inside", local_date: "2026-06-20", status: "completed", duration_seconds: 1800 },
      { id: "active", local_date: "2026-06-21", status: "active", duration_seconds: 0 },
      { id: "too-late", local_date: "2026-07-01", status: "completed", duration_seconds: 999 },
    ],
    activeSessionId: "active",
    activeElapsedSeconds: 600,
  });

  assert.equal(result, 2400);
});
