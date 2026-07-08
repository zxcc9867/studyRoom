const DEFAULT_MEADOW_BOUNDS = {
  minX: 8,
  maxX: 92,
  minY: 42,
  maxY: 84,
  step: 4,
};

const AUTO_WALK_WAYPOINTS = [
  { x: 72, y: 56 },
  { x: 82, y: 74 },
  { x: 53, y: 81 },
  { x: 27, y: 64 },
  { x: 45, y: 50 },
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

  if (key === "ArrowLeft" || key === "a" || key === "A") {
    return { x: clampNumber(current.x - step, meadow.minX, meadow.maxX), y: current.y, facing: "left" };
  }
  if (key === "ArrowRight" || key === "d" || key === "D") {
    return { x: clampNumber(current.x + step, meadow.minX, meadow.maxX), y: current.y, facing: "right" };
  }
  if (key === "ArrowUp" || key === "w" || key === "W") {
    return { x: current.x, y: clampNumber(current.y - step, meadow.minY, meadow.maxY), facing: "up" };
  }
  if (key === "ArrowDown" || key === "s" || key === "S") {
    return { x: current.x, y: clampNumber(current.y + step, meadow.minY, meadow.maxY), facing: "down" };
  }
  return { ...current, facing: position?.facing ?? "down" };
}

export function getNextAutoAvatarStep(position, tick, bounds = {}) {
  const meadow = getAvatarBounds(bounds);
  const current = normalizeAvatarPosition(position, meadow);
  const target = AUTO_WALK_WAYPOINTS[Math.abs(Math.trunc(Number(tick) || 0)) % AUTO_WALK_WAYPOINTS.length];
  return moveAvatarTowardTarget(current, target, meadow);
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
  return {
    x: clampNumber(x, bounds.minX, bounds.maxX),
    y: clampNumber(y, bounds.minY, bounds.maxY),
    facing: getAvatarFacing(position, { x, y }),
  };
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Math.round((Number(value) || 0) * 10) / 10));
}
