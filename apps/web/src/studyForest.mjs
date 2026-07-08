const DEFAULT_MEADOW_WIDTH = 12;
const DEFAULT_MEADOW_HEIGHT = 8;

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
  const width = bounds.width ?? DEFAULT_MEADOW_WIDTH;
  const height = bounds.height ?? DEFAULT_MEADOW_HEIGHT;
  const current = {
    x: clampInteger(position?.x ?? 0, 0, width - 1),
    y: clampInteger(position?.y ?? 0, 0, height - 1),
  };

  if (key === "ArrowLeft" || key === "a" || key === "A") {
    return { x: clampInteger(current.x - 1, 0, width - 1), y: current.y, facing: "left" };
  }
  if (key === "ArrowRight" || key === "d" || key === "D") {
    return { x: clampInteger(current.x + 1, 0, width - 1), y: current.y, facing: "right" };
  }
  if (key === "ArrowUp" || key === "w" || key === "W") {
    return { x: current.x, y: clampInteger(current.y - 1, 0, height - 1), facing: "up" };
  }
  if (key === "ArrowDown" || key === "s" || key === "S") {
    return { x: current.x, y: clampInteger(current.y + 1, 0, height - 1), facing: "down" };
  }
  return { ...current, facing: position?.facing ?? "down" };
}

export function getNextAutoAvatarStep(position, tick, bounds = {}) {
  const pattern = ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowLeft", "ArrowUp"];
  const key = pattern[Math.abs(Number(tick) || 0) % pattern.length];
  return getAvatarStep(position, key, bounds);
}

function getForestStatusMessage({ isLatestMissed, currentStreak, completedTrees }) {
  if (isLatestMissed) return "결석으로 성장 중인 나무가 시들었습니다.";
  if (currentStreak >= 7 && currentStreak % 7 === 0) return "7일 연속 출석! 작은 공부 숲이 자랐어요.";
  if (currentStreak > 0) return `${currentStreak}일 연속 출석 중입니다. 나무가 자라고 있어요.`;
  if (completedTrees > 0) return "완성한 나무가 개인 공간에 남아 있습니다.";
  return "첫 출석을 하면 씨앗이 심어집니다.";
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.trunc(Number(value) || 0)));
}
