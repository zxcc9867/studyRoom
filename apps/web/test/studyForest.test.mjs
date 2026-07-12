import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStudyForestState,
  getForestInteriorRewards,
  getForestNavigationPath,
  getForestTimePhase,
  getNextForestLevelUpdate,
  getCottageAvatarStep,
  isCottageEntrancePosition,
  isCottageExitPosition,
  isCottagePositionWalkable,
  getAvatarPositionFromScenePoint,
  getAvatarSceneStyle,
  getAvatarStep,
  getNextAutoAvatarStep,
  getTreeStageForProgress,
  isForestAvatarPositionWalkable,
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
  assert.deepEqual(getAvatarStep({ x: 52, y: 62 }, "ArrowLeft"), { x: 48, y: 62, facing: "left" });
  assert.deepEqual(getAvatarStep({ x: 8, y: 42 }, "ArrowUp"), { x: 8, y: 42, facing: "up" });
  assert.deepEqual(getAvatarStep({ x: 92, y: 84 }, "ArrowRight"), { x: 92, y: 84, facing: "right" });
});

test("moves avatar to clicked scene points instead of a fixed grid", () => {
  const next = getAvatarPositionFromScenePoint({
    clientX: 330,
    clientY: 260,
    rect: { left: 30, top: 20, width: 600, height: 400 },
  });

  assert.deepEqual(next, { x: 50, y: 60 });
});

test("uses avatar y position to create 2.5D depth", () => {
  const back = getAvatarSceneStyle({ x: 52, y: 42, facing: "up" });
  const front = getAvatarSceneStyle({ x: 52, y: 84, facing: "down" });

  assert.equal(back.left, "52%");
  assert.equal(back.top, "42%");
  assert.equal(front.left, "52%");
  assert.equal(front.top, "84%");
  assert.ok(Number(front["--forest-avatar-scale"]) > Number(back["--forest-avatar-scale"]));
  assert.ok(Number(front.zIndex) > Number(back.zIndex));
});

test("auto walk heads toward scenic waypoints instead of pacing one row", () => {
  const next = getNextAutoAvatarStep({ x: 52, y: 62, facing: "down" }, 0);

  assert.ok(next.x > 52);
  assert.ok(next.y < 62);
  assert.equal(next.facing, "right");
});



test("blocks water and solid scenery while keeping the bridge walkable", () => {
  assert.equal(isForestAvatarPositionWalkable({ x: 24, y: 66 }), false);
  assert.equal(isForestAvatarPositionWalkable({ x: 55, y: 66 }), true);
  assert.equal(isForestAvatarPositionWalkable({ x: 24, y: 50 }), false);
  assert.equal(isForestAvatarPositionWalkable({ x: 80, y: 50 }), false);
  assert.equal(isForestAvatarPositionWalkable({ x: 74, y: 78 }), true);
  assert.deepEqual(getAvatarStep({ x: 24, y: 60, facing: "down" }, "ArrowDown"), {
    x: 24,
    y: 60,
    facing: "down",
  });
});

test("routes cross-river destinations through bridge entry and exit waypoints", () => {
  const path = getForestNavigationPath({ x: 24, y: 56 }, { x: 78, y: 78 });

  assert.deepEqual(path.slice(0, 2), [
    { x: 55, y: 60.8 },
    { x: 55, y: 73.2 },
  ]);
  assert.deepEqual(path.at(-1), { x: 78, y: 78 });
  assert.equal(path.every((point) => isForestAvatarPositionWalkable(point)), true);
});

test("describes the next visible streak upgrade", () => {
  assert.deepEqual(getNextForestLevelUpdate(0), {
    targetDays: 1,
    remainingDays: 1,
    title: "\uC0C8\uC2F9\uC774 \uAE68\uC5B4\uB098\uC694",
    description: "\uC528\uC557 \uC704\uB85C \uCCAB \uC0C8\uC2F9\uACFC \uC791\uC740 \uC78E\uC774 \uC62C\uB77C\uC635\uB2C8\uB2E4.",
    interiorUnlock: "\uD654\uBD84\uACFC \uC791\uC740 \uAD00\uC5FD\uC2DD\uBB3C",
  });
  assert.equal(getNextForestLevelUpdate(4).targetDays, 5);
  assert.equal(getNextForestLevelUpdate(7).targetDays, 8);
});

test("moves inside the cottage, blocks furniture, and recognizes the doorway exit", () => {
  assert.deepEqual(getCottageAvatarStep({ x: 50, y: 80, facing: "up" }, "ArrowLeft"), {
    x: 46,
    y: 80,
    facing: "left",
  });
  assert.equal(isCottagePositionWalkable({ x: 24, y: 28 }), false);
  assert.equal(isCottagePositionWalkable({ x: 50, y: 72 }), true);
  assert.equal(isCottageExitPosition({ x: 50, y: 88 }), true);
  assert.equal(isCottageExitPosition({ x: 64, y: 88 }), false);
  assert.equal(isCottageEntrancePosition({ x: 27, y: 59 }), true);
});

test("maps local hours to morning, afternoon, sunset, and night", () => {
  assert.equal(getForestTimePhase(5), "night");
  assert.equal(getForestTimePhase(6), "morning");
  assert.equal(getForestTimePhase(11), "morning");
  assert.equal(getForestTimePhase(12), "afternoon");
  assert.equal(getForestTimePhase(16), "afternoon");
  assert.equal(getForestTimePhase(17), "sunset");
  assert.equal(getForestTimePhase(19), "sunset");
  assert.equal(getForestTimePhase(20), "night");
});

test("unlocks cottage decorations with streak milestones and preserves them after a completed tree", () => {
  assert.deepEqual(getForestInteriorRewards(0, 0), {
    plant: false,
    bookshelf: false,
    rug: false,
    readingLamp: false,
    wallClock: false,
    trophy: false,
  });
  assert.equal(getForestInteriorRewards(1, 0).plant, true);
  assert.equal(getForestInteriorRewards(3, 0).bookshelf, true);
  assert.equal(getForestInteriorRewards(5, 0).readingLamp, true);
  assert.equal(getForestInteriorRewards(7, 0).trophy, true);
  assert.equal(getForestInteriorRewards(0, 1).wallClock, true);
});
