import assert from "node:assert/strict";
import { test } from "node:test";
import { getGoalAchievements } from "../src/goalAchievements.mjs";

function goal(id, status = "completed", target_date = "2026-09-06") {
  return { id, title: `목표 ${id}`, status, target_date };
}

test("badges include only explicitly completed goals", () => {
  assert.deepEqual(getGoalAchievements([goal("active", "active"), goal("done"), goal("archived", "archived")]).map((item) => item.id), ["done"]);
  assert.deepEqual(getGoalAchievements([]), []);
});

test("badges sort deterministically by target date then id without mutating input", () => {
  const input = Object.freeze([Object.freeze(goal("b")), Object.freeze(goal("old", "completed", "2026-01-01")), Object.freeze(goal("a"))]);
  assert.deepEqual(getGoalAchievements(input).map((item) => item.id), ["a", "b", "old"]);
  assert.deepEqual(getGoalAchievements([...input].reverse()).map((item) => item.id), ["a", "b", "old"]);
  assert.deepEqual(input.map((item) => item.id), ["b", "old", "a"]);
});

test("a completed goal contributes at most one badge", () => {
  assert.equal(getGoalAchievements([goal("same"), goal("same")]).length, 1);
});

test("reopening or deleting a goal removes its badge from current state", () => {
  const completed = [goal("one"), goal("two")];
  assert.equal(getGoalAchievements(completed).length, 2);
  const reopened = completed.map((item) => item.id === "one" ? { ...item, status: "active" } : item);
  assert.deepEqual(getGoalAchievements(reopened).map((item) => item.id), ["two"]);
  assert.deepEqual(getGoalAchievements(completed.filter((item) => item.id !== "one")).map((item) => item.id), ["two"]);
});
