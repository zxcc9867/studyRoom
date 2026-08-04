import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  DAILY_HABIT_SEED_SECONDS,
  findMatchingNextActionTodo,
  formatHabitDuration,
  getDailyHabitState,
  getLatestNextAction,
} from "../src/dailyHabit.mjs";

test("daily habit stages preserve the full attendance goal while recognizing a ten-minute start", () => {
  const ready = getDailyHabitState({ studySeconds: 0, goalSeconds: 7200, completedTodoCount: 0 });
  assert.equal(ready.stage, "ready");
  assert.equal(ready.remainingToSeedSeconds, DAILY_HABIT_SEED_SECONDS);
  assert.equal(ready.milestones[0].completed, false);

  const seed = getDailyHabitState({ studySeconds: 600, goalSeconds: 7200, completedTodoCount: 0 });
  assert.equal(seed.stage, "seed");
  assert.equal(seed.habitSuccess, true);
  assert.equal(seed.goalReached, false);
  assert.equal(seed.remainingToGoalSeconds, 6600);

  const tree = getDailyHabitState({ studySeconds: 7200, goalSeconds: 7200, completedTodoCount: 0 });
  assert.equal(tree.stage, "tree");
  assert.equal(tree.goalReached, true);
  assert.equal(tree.milestones[2].completed, false);

  const bloom = getDailyHabitState({ studySeconds: 9000, goalSeconds: 7200, completedTodoCount: 1 });
  assert.equal(bloom.stage, "bloom");
  assert.equal(bloom.milestones.every((milestone) => milestone.completed), true);
});

test("habit duration rounds remaining partial minutes up for actionable copy", () => {
  assert.equal(formatHabitDuration(1), "1분");
  assert.equal(formatHabitDuration(3599), "1시간");
  assert.equal(formatHabitDuration(3660), "1시간 1분");
});

test("latest next action is normalized and matches an incomplete today todo", () => {
  assert.equal(getLatestNextAction({ next_action: "  AWS   기출 1회  " }), "AWS 기출 1회");
  assert.equal(getLatestNextAction({ next_action: "   " }), "");

  const match = findMatchingNextActionTodo({
    nextAction: "aws   기출 1회",
    todos: [
      { id: "completed", title: "AWS 기출 1회", is_completed: true },
      { id: "active", title: "AWS 기출 1회", is_completed: false },
    ],
  });
  assert.equal(match?.id, "active");
});

test("today screen wires the habit card, one-row reflection query, and responsive styles", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const data = readFileSync(new URL("../src/dashboardData.ts", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(main, /getDailyHabitState/);
  assert.match(main, /daily-habit-card/);
  assert.match(main, /지난 세션에서 이어하기/);
  assert.match(main, /studyStartAction\.suggestedTodoTitle/);
  assert.match(main, /daily-habit-next-action-cue/);
  assert.match(main, /sessionTodoSuggestionRef/);
  assert.match(main, /function closeRecoveryRoutineModal\(\)[\s\S]*?sessionTodoSuggestionRef\.current = null;/);
  assert.match(data, /study_session_reflections/);
  assert.match(data, /\.not\("next_action", "is", null\)/);
  assert.match(data, /\.limit\(1\)/);
  assert.match(styles, /\.daily-habit-card/);
  assert.match(styles, /\.daily-habit-next-action/);
});
