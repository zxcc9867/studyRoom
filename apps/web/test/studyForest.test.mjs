import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStudyForestState,
  getAvatarStep,
  getTreeStageForProgress,
} from "../src/studyForest.mjs";

test("builds one completed tree for a seven day attendance streak", () => {
  const state = buildStudyForestState({
    todayDateKey: "2026-07-07",
    attendanceDays: [
      { local_date: "2026-07-07", status: "present" },
      { local_date: "2026-07-06", status: "present" },
      { local_date: "2026-07-05", status: "present" },
      { local_date: "2026-07-04", status: "present" },
      { local_date: "2026-07-03", status: "present" },
      { local_date: "2026-07-02", status: "present" },
      { local_date: "2026-07-01", status: "present" },
    ],
  });

  assert.equal(state.currentStreak, 7);
  assert.equal(state.completedTrees, 1);
  assert.equal(state.currentTree.stage, "complete");
  assert.equal(state.currentTree.progressDays, 7);
  assert.equal(state.placedTrees.length, 1);
});

test("keeps completed trees and wilts the current tree after a miss", () => {
  const state = buildStudyForestState({
    todayDateKey: "2026-07-09",
    attendanceDays: [
      { local_date: "2026-07-09", status: "missed" },
      { local_date: "2026-07-08", status: "present" },
      { local_date: "2026-07-07", status: "present" },
      { local_date: "2026-07-06", status: "present" },
      { local_date: "2026-07-05", status: "present" },
      { local_date: "2026-07-04", status: "present" },
      { local_date: "2026-07-03", status: "present" },
      { local_date: "2026-07-02", status: "present" },
      { local_date: "2026-07-01", status: "present" },
    ],
  });

  assert.equal(state.completedTrees, 1);
  assert.equal(state.currentStreak, 0);
  assert.equal(state.currentTree.stage, "wilted");
  assert.equal(state.statusMessage, "\uACB0\uC11D\uC73C\uB85C \uC131\uC7A5 \uC911\uC778 \uB098\uBB34\uAC00 \uC2DC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4.");
});

test("uses a new growing tree after completed seven day cycles", () => {
  const attendanceDays = Array.from({ length: 10 }, (_, index) => ({
    local_date: `2026-07-${String(10 - index).padStart(2, "0")}`,
    status: "present",
  }));

  const state = buildStudyForestState({
    todayDateKey: "2026-07-10",
    attendanceDays,
  });

  assert.equal(state.completedTrees, 1);
  assert.equal(state.currentStreak, 10);
  assert.equal(state.currentTree.progressDays, 3);
  assert.equal(state.currentTree.stage, "young");
});

test("maps progress days to visible tree stages", () => {
  assert.equal(getTreeStageForProgress(0), "seed");
  assert.equal(getTreeStageForProgress(2), "sprout");
  assert.equal(getTreeStageForProgress(4), "young");
  assert.equal(getTreeStageForProgress(6), "leafy");
  assert.equal(getTreeStageForProgress(7), "complete");
});

test("moves avatar by keyboard step while clamping to the meadow", () => {
  assert.deepEqual(getAvatarStep({ x: 5, y: 4 }, "ArrowLeft"), { x: 4, y: 4, facing: "left" });
  assert.deepEqual(getAvatarStep({ x: 0, y: 0 }, "ArrowUp"), { x: 0, y: 0, facing: "up" });
  assert.deepEqual(getAvatarStep({ x: 11, y: 7 }, "ArrowRight"), { x: 11, y: 7, facing: "right" });
});


