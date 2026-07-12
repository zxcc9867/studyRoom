const DEFAULT_MEADOW_BOUNDS = {
  minX: 8,
  maxX: 92,
  minY: 42,
  maxY: 84,
  step: 4,
};

const AUTO_WALK_WAYPOINTS = [
  { x: 64, y: 56 },
  { x: 82, y: 74 },
  { x: 53, y: 81 },
  { x: 27, y: 64 },
  { x: 45, y: 50 },
];

const FOREST_RIVER_BAND = { minY: 61.8, maxY: 73.2 };
const FOREST_BRIDGE_CORRIDOR = { minX: 42, maxX: 68, northY: 60.8, southY: 73.2, centerX: 55 };
const FOREST_SOLID_AREAS = [
  { reason: "cottage", minX: 12, maxX: 35, minY: 42, maxY: 57 },
  { reason: "garden", minX: 69, maxX: 92, minY: 45, maxY: 56 },
];

const DEFAULT_COTTAGE_BOUNDS = {
  minX: 10,
  maxX: 90,
  minY: 15,
  maxY: 90,
  step: 4,
};

const COTTAGE_SOLID_AREAS = [
  { minX: 12, maxX: 42, minY: 18, maxY: 40 },
  { minX: 14, maxX: 40, minY: 42, maxY: 64 },
  { minX: 68, maxX: 90, minY: 15, maxY: 34 },
  { minX: 60, maxX: 77, minY: 67, maxY: 86 },
  { minX: 80, maxX: 92, minY: 70, maxY: 90 },
];

export const forestLevelMilestones = [
  {
    days: 1,
    label: "\uC0C8\uC2F9",
    update: "\uC528\uC557 \uC704\uB85C \uCCAB \uC0C8\uC2F9\uACFC \uC791\uC740 \uC78E\uC774 \uC62C\uB77C\uC635\uB2C8\uB2E4.",
    interiorUnlock: "\uD654\uBD84\uACFC \uC791\uC740 \uAD00\uC5FD\uC2DD\uBB3C",
  },
  {
    days: 3,
    label: "\uC5B4\uB9B0 \uB098\uBB34",
    update: "\uC904\uAE30\uAC00 \uB192\uC544\uC9C0\uACE0 \uC0C8 \uC78E\uC774 \uD3BC\uCCD0\uC9D1\uB2C8\uB2E4.",
    interiorUnlock: "\uCC45\uC7A5\uACFC \uCEEC\uB7EC \uCC45 \uC138\uD2B8",
  },
  {
    days: 5,
    label: "\uD48D\uC131\uD55C \uB098\uBB34",
    update: "\uC218\uAD00\uC774 \uD48D\uC131\uD574\uC9C0\uACE0 \uC791\uC740 \uC5F4\uB9E4\uAC00 \uB9FA\uD78D\uB2C8\uB2E4.",
    interiorUnlock: "\uB7EC\uADF8\uC640 \uB530\uB73B\uD55C \uB3C5\uC11C\uB4F1",
  },
  {
    days: 7,
    label: "\uC644\uC131 \uB098\uBB34",
    update: "\uC644\uC131\uB41C \uB098\uBB34\uAC00 \uC232\uC5D0 \uC601\uAD6C \uBC30\uCE58\uB418\uACE0 \uB2E4\uC74C \uC528\uC557\uC774 \uC5F4\uB9BD\uB2C8\uB2E4.",
    interiorUnlock: "\uBCBD\uC2DC\uACC4\uC640 \uCD9C\uC11D \uD2B8\uB85C\uD53C",
  },
];


export const treeStageLabels = {
  seed: "씨앗",
  sprout: "새싹",
  young: "어린 나무",
  leafy: "풍성해지는 나무",
  complete: "완성 나무",
  wilted: "시든 나무",
};

export function getTreeStageForProgress(progressDays) {
  const safeProgress = Math.max(0, Math.min(7, Number(progressDays) || 0));
  if (safeProgress >= 7) return "complete";
  if (safeProgress >= 5) return "leafy";
  if (safeProgress >= 3) return "young";
  if (safeProgress >= 1) return "sprout";
  return "seed";
}

export function buildStudyForestState({ todayDateKey, attendanceDays }) {
  const sortedDays = [...(attendanceDays ?? [])]
    .filter((day) => day?.local_date && day?.status)
    .sort((left, right) => left.local_date.localeCompare(right.local_date));

  let segmentStreak = 0;
  let completedTrees = 0;
  let lastTrackedStatus = "none";
  let lastTrackedDate = todayDateKey ?? null;

  for (const day of sortedDays) {
    if (day.status === "present") {
      segmentStreak += 1;
      lastTrackedStatus = "present";
    } else if (day.status === "missed") {
      completedTrees += Math.floor(segmentStreak / 7);
      segmentStreak = 0;
      lastTrackedStatus = "missed";
    }
    lastTrackedDate = day.local_date;
  }

  completedTrees += Math.floor(segmentStreak / 7);
  const latestDay = sortedDays.at(-1) ?? null;
  const isLatestMissed = latestDay?.status === "missed";
  const currentStreak = isLatestMissed ? 0 : segmentStreak;
  const currentCycleProgress = isLatestMissed
    ? 0
    : currentStreak > 0 && currentStreak % 7 === 0
      ? 7
      : currentStreak % 7;
  const currentStage = isLatestMissed ? "wilted" : getTreeStageForProgress(currentCycleProgress);

  return {
    todayDateKey,
    currentStreak,
    completedTrees,
    lastTrackedDate,
    lastTrackedStatus,
    currentTree: {
      stage: currentStage,
      label: treeStageLabels[currentStage],
      progressDays: currentStage === "wilted" ? 0 : currentCycleProgress,
      remainingDays: currentStage === "complete" ? 0 : Math.max(0, 7 - currentCycleProgress),
    },
    placedTrees: buildPlacedTrees(completedTrees),
    statusMessage: getForestStatusMessage({ isLatestMissed, currentStreak, completedTrees }),
  };
}

export function buildPlacedTrees(count) {
  const placements = [
    { x: 18, y: 46, variant: "apple" },
    { x: 66, y: 38, variant: "pear" },
    { x: 35, y: 68, variant: "orange" },
    { x: 78, y: 66, variant: "apple" },
    { x: 52, y: 51, variant: "cedar" },
    { x: 23, y: 78, variant: "pear" },
  ];

  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `tree-${index + 1}`,
    weekNumber: index + 1,
    ...placements[index % placements.length],
  }));
}

export function getAvatarStep(position, key, bounds = {}) {
  const meadow = getAvatarBounds(bounds);
  const current = normalizeAvatarPosition(position, meadow);
  const step = meadow.step;
  let target = { ...current };
  let facing = position?.facing ?? "down";

  if (key === "ArrowLeft" || key === "a" || key === "A") {
    target.x = clampNumber(current.x - step, meadow.minX, meadow.maxX);
    facing = "left";
  } else if (key === "ArrowRight" || key === "d" || key === "D") {
    target.x = clampNumber(current.x + step, meadow.minX, meadow.maxX);
    facing = "right";
  } else if (key === "ArrowUp" || key === "w" || key === "W") {
    target.y = clampNumber(current.y - step, meadow.minY, meadow.maxY);
    facing = "up";
  } else if (key === "ArrowDown" || key === "s" || key === "S") {
    target.y = clampNumber(current.y + step, meadow.minY, meadow.maxY);
    facing = "down";
  }

  return { ...resolveForestAvatarTarget(current, target, meadow), facing };
}

export function getNextAutoAvatarStep(position, tick, bounds = {}) {
  const meadow = getAvatarBounds(bounds);
  const current = normalizeAvatarPosition(position, meadow);
  const target = AUTO_WALK_WAYPOINTS[Math.abs(Math.trunc(Number(tick) || 0)) % AUTO_WALK_WAYPOINTS.length];
  const waypoint = getForestNavigationPath(current, target, meadow)[0] ?? current;
  return moveAvatarTowardTarget(current, waypoint, meadow);
}

export function getAvatarPositionFromScenePoint({ clientX, clientY, rect }, bounds = {}) {
  const meadow = getAvatarBounds(bounds);
  const width = Number(rect?.width) || 1;
  const height = Number(rect?.height) || 1;
  const rawX = ((Number(clientX) - Number(rect?.left ?? 0)) / width) * 100;
  const rawY = ((Number(clientY) - Number(rect?.top ?? 0)) / height) * 100;

  return {
    x: clampNumber(Math.round(rawX), meadow.minX, meadow.maxX),
    y: clampNumber(Math.round(rawY), meadow.minY, meadow.maxY),
  };
}

export function getAvatarFacing(fromPosition, toPosition) {
  const dx = Number(toPosition?.x) - Number(fromPosition?.x);
  const dy = Number(toPosition?.y) - Number(fromPosition?.y);
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}


export function getCottageAvatarStep(position, key, bounds = {}) {
  const cottage = getCottageBounds(bounds);
  const current = normalizeAvatarPosition(position, cottage);
  let target = { ...current };
  let facing = position?.facing ?? "up";

  if (key === "ArrowLeft" || key === "a" || key === "A") {
    target.x = clampNumber(current.x - cottage.step, cottage.minX, cottage.maxX);
    facing = "left";
  } else if (key === "ArrowRight" || key === "d" || key === "D") {
    target.x = clampNumber(current.x + cottage.step, cottage.minX, cottage.maxX);
    facing = "right";
  } else if (key === "ArrowUp" || key === "w" || key === "W") {
    target.y = clampNumber(current.y - cottage.step, cottage.minY, cottage.maxY);
    facing = "up";
  } else if (key === "ArrowDown" || key === "s" || key === "S") {
    target.y = clampNumber(current.y + cottage.step, cottage.minY, cottage.maxY);
    facing = "down";
  }

  return { ...resolveCottageAvatarTarget(current, target, cottage), facing };
}

export function isCottagePositionWalkable(position, bounds = {}) {
  const cottage = getCottageBounds(bounds);
  const current = normalizeAvatarPosition(position, cottage);
  if (
    Number(position?.x) < cottage.minX
    || Number(position?.x) > cottage.maxX
    || Number(position?.y) < cottage.minY
    || Number(position?.y) > cottage.maxY
  ) {
    return false;
  }
  return !COTTAGE_SOLID_AREAS.some(
    (area) =>
      current.x >= area.minX
      && current.x <= area.maxX
      && current.y >= area.minY
      && current.y <= area.maxY,
  );
}

export function resolveCottageAvatarTarget(currentPosition, targetPosition, bounds = {}) {
  const cottage = getCottageBounds(bounds);
  const current = normalizeAvatarPosition(currentPosition, cottage);
  const target = normalizeAvatarPosition(targetPosition, cottage);
  return isCottagePositionWalkable(target, cottage) ? target : current;
}

export function isCottageExitPosition(position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  return x >= 42 && x <= 58 && y >= 86;
}

export function isCottageEntrancePosition(position) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  return x >= 22 && x <= 32 && y >= 57 && y <= 61;
}

export function getForestTimePhase(hour = new Date().getHours()) {
  const currentHour = Math.max(0, Math.min(23, Math.trunc(Number(hour) || 0)));
  if (currentHour >= 6 && currentHour < 12) return "morning";
  if (currentHour >= 12 && currentHour < 17) return "afternoon";
  if (currentHour >= 17 && currentHour < 20) return "sunset";
  return "night";
}

export function getForestInteriorRewards(progressDays, completedTrees = 0) {
  const progress = Math.max(0, Math.min(7, Math.trunc(Number(progressDays) || 0)));
  const effectiveProgress = Number(completedTrees) > 0 ? 7 : progress;
  return {
    plant: effectiveProgress >= 1,
    bookshelf: effectiveProgress >= 3,
    rug: effectiveProgress >= 5,
    readingLamp: effectiveProgress >= 5,
    wallClock: effectiveProgress >= 7,
    trophy: effectiveProgress >= 7,
  };
}

export function getForestBlockedReason(position, bounds = {}) {
  const meadow = getAvatarBounds(bounds);
  const current = normalizeAvatarPosition(position, meadow);
  if (
    Number(position?.x) < meadow.minX
    || Number(position?.x) > meadow.maxX
    || Number(position?.y) < meadow.minY
    || Number(position?.y) > meadow.maxY
  ) {
    return "edge";
  }

  const insideRiver = current.y >= FOREST_RIVER_BAND.minY && current.y <= FOREST_RIVER_BAND.maxY;
  const insideBridge = current.x >= FOREST_BRIDGE_CORRIDOR.minX && current.x <= FOREST_BRIDGE_CORRIDOR.maxX;
  if (insideRiver && !insideBridge) return "water";

  const solidArea = FOREST_SOLID_AREAS.find(
    (area) =>
      current.x >= area.minX
      && current.x <= area.maxX
      && current.y >= area.minY
      && current.y <= area.maxY,
  );
  if (solidArea) return solidArea.reason;

  const currentTreeDistance = Math.hypot((current.x - 75) / 5.5, (current.y - 55) / 4.5);
  if (currentTreeDistance <= 1) return "tree";
  return null;
}

export function isForestAvatarPositionWalkable(position, bounds = {}) {
  return getForestBlockedReason(position, bounds) === null;
}

export function resolveForestAvatarTarget(currentPosition, targetPosition, bounds = {}) {
  const meadow = getAvatarBounds(bounds);
  const current = normalizeAvatarPosition(currentPosition, meadow);
  const target = normalizeAvatarPosition(targetPosition, meadow);
  return isForestAvatarPositionWalkable(target, meadow) ? target : current;
}

export function getForestNavigationPath(fromPosition, targetPosition, bounds = {}) {
  const meadow = getAvatarBounds(bounds);
  const from = normalizeAvatarPosition(fromPosition, meadow);
  const target = normalizeAvatarPosition(targetPosition, meadow);
  if (!isForestAvatarPositionWalkable(target, meadow)) return [];

  const fromSide = getForestRiverSide(from.y);
  const targetSide = getForestRiverSide(target.y);
  const path = [];

  if (fromSide === 0 && targetSide !== 0) {
    path.push({
      x: FOREST_BRIDGE_CORRIDOR.centerX,
      y: targetSide < 0 ? FOREST_BRIDGE_CORRIDOR.northY : FOREST_BRIDGE_CORRIDOR.southY,
    });
  } else if (fromSide !== 0 && targetSide !== 0 && fromSide !== targetSide) {
    path.push({
      x: FOREST_BRIDGE_CORRIDOR.centerX,
      y: fromSide < 0 ? FOREST_BRIDGE_CORRIDOR.northY : FOREST_BRIDGE_CORRIDOR.southY,
    });
    path.push({
      x: FOREST_BRIDGE_CORRIDOR.centerX,
      y: targetSide < 0 ? FOREST_BRIDGE_CORRIDOR.northY : FOREST_BRIDGE_CORRIDOR.southY,
    });
  }

  path.push(target);
  return path;
}

export function getNextForestLevelUpdate(progressDays) {
  const progress = Math.max(0, Math.min(7, Math.trunc(Number(progressDays) || 0)));
  const nextMilestone = forestLevelMilestones.find((milestone) => milestone.days > progress);
  if (nextMilestone) {
    return {
      targetDays: nextMilestone.days,
      remainingDays: nextMilestone.days - progress,
      title: nextMilestone.days === 1
        ? "\uC0C8\uC2F9\uC774 \uAE68\uC5B4\uB098\uC694"
        : nextMilestone.label,
      description: nextMilestone.update,
      interiorUnlock: nextMilestone.interiorUnlock,
    };
  }
  return {
    targetDays: 8,
    remainingDays: 1,
    title: "\uB2E4\uC74C \uB098\uBB34\uB97C \uC2DC\uC791\uD574\uC694",
    description: "\uC644\uC131 \uB098\uBB34\uB294 \uC232\uC5D0 \uB0A8\uACE0, \uB2E4\uC74C \uCD9C\uC11D\uBD80\uD130 \uC0C8 \uC528\uC557\uC774 \uC790\uB77C\uAE30 \uC2DC\uC791\uD569\uB2C8\uB2E4.",
    interiorUnlock: "\uC0C8 \uC8FC\uAC04 \uC2DC\uC98C \uC7A5\uC2DD",
  };
}

function getForestRiverSide(y) {
  if (y < FOREST_RIVER_BAND.minY) return -1;
  if (y > FOREST_RIVER_BAND.maxY) return 1;
  return 0;
}

export function getAvatarSceneStyle(position, bounds = {}) {
  const meadow = getAvatarBounds(bounds);
  const current = normalizeAvatarPosition(position, meadow);
  const depth = (current.y - meadow.minY) / Math.max(1, meadow.maxY - meadow.minY);
  const scale = 0.84 + depth * 0.24;

  return {
    left: String(current.x) + "%",
    top: String(current.y) + "%",
    "--forest-avatar-scale": scale.toFixed(3),
    zIndex: String(Math.round(32 + depth * 58)),
  };
}

function getForestStatusMessage({ isLatestMissed, currentStreak, completedTrees }) {
  if (isLatestMissed) return "결석으로 성장 중인 나무가 시들었습니다.";
  if (currentStreak >= 7 && currentStreak % 7 === 0) return "7일 연속 출석! 작은 공부 숲이 자랐어요.";
  if (currentStreak > 0) return `${currentStreak}일 연속 출석 중입니다. 나무가 자라고 있어요.`;
  if (completedTrees > 0) return "완성한 나무가 개인 공간에 남아 있습니다.";
  return "첫 출석을 하면 씨앗이 심어집니다.";
}

function getAvatarBounds(bounds) {
  return {
    minX: Number.isFinite(Number(bounds?.minX)) ? Number(bounds.minX) : DEFAULT_MEADOW_BOUNDS.minX,
    maxX: Number.isFinite(Number(bounds?.maxX)) ? Number(bounds.maxX) : DEFAULT_MEADOW_BOUNDS.maxX,
    minY: Number.isFinite(Number(bounds?.minY)) ? Number(bounds.minY) : DEFAULT_MEADOW_BOUNDS.minY,
    maxY: Number.isFinite(Number(bounds?.maxY)) ? Number(bounds.maxY) : DEFAULT_MEADOW_BOUNDS.maxY,
    step: Number.isFinite(Number(bounds?.step)) ? Number(bounds.step) : DEFAULT_MEADOW_BOUNDS.step,
  };
}

function getCottageBounds(bounds) {
  return {
    minX: Number.isFinite(Number(bounds?.minX)) ? Number(bounds.minX) : DEFAULT_COTTAGE_BOUNDS.minX,
    maxX: Number.isFinite(Number(bounds?.maxX)) ? Number(bounds.maxX) : DEFAULT_COTTAGE_BOUNDS.maxX,
    minY: Number.isFinite(Number(bounds?.minY)) ? Number(bounds.minY) : DEFAULT_COTTAGE_BOUNDS.minY,
    maxY: Number.isFinite(Number(bounds?.maxY)) ? Number(bounds.maxY) : DEFAULT_COTTAGE_BOUNDS.maxY,
    step: Number.isFinite(Number(bounds?.step)) ? Number(bounds.step) : DEFAULT_COTTAGE_BOUNDS.step,
  };
}

function normalizeAvatarPosition(position, bounds) {
  return {
    x: clampNumber(Number(position?.x ?? 52), bounds.minX, bounds.maxX),
    y: clampNumber(Number(position?.y ?? 64), bounds.minY, bounds.maxY),
  };
}

function moveAvatarTowardTarget(position, target, bounds) {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const x = Math.abs(dx) <= bounds.step ? target.x : position.x + Math.sign(dx) * bounds.step;
  const y = Math.abs(dy) <= bounds.step ? target.y : position.y + Math.sign(dy) * bounds.step;
  const candidate = {
    x: clampNumber(x, bounds.minX, bounds.maxX),
    y: clampNumber(y, bounds.minY, bounds.maxY),
  };
  return {
    ...resolveForestAvatarTarget(position, candidate, bounds),
    facing: getAvatarFacing(position, candidate),
  };
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Math.round((Number(value) || 0) * 10) / 10));
}
