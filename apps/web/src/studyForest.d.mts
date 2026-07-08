export type StudyForestAttendanceStatus = "pending" | "present" | "missed";

export type StudyForestAttendanceDay = {
  local_date: string;
  status: StudyForestAttendanceStatus;
};

export type StudyForestTreeStage = "seed" | "sprout" | "young" | "leafy" | "complete" | "wilted";

export type StudyForestTree = {
  stage: StudyForestTreeStage;
  label: string;
  progressDays: number;
  remainingDays: number;
};

export type StudyForestPlacedTree = {
  id: string;
  weekNumber: number;
  x: number;
  y: number;
  variant: string;
};

export type StudyForestState = {
  todayDateKey?: string;
  currentStreak: number;
  completedTrees: number;
  lastTrackedDate: string | null;
  lastTrackedStatus: string;
  currentTree: StudyForestTree;
  placedTrees: StudyForestPlacedTree[];
  statusMessage: string;
};

export type StudyForestAvatarPosition = {
  x: number;
  y: number;
  facing?: "left" | "right" | "up" | "down";
};

export const treeStageLabels: Record<StudyForestTreeStage, string>;

export function getTreeStageForProgress(progressDays: number): StudyForestTreeStage;

export function buildStudyForestState(input: {
  todayDateKey?: string;
  attendanceDays: StudyForestAttendanceDay[];
}): StudyForestState;

export function buildPlacedTrees(count: number): StudyForestPlacedTree[];

export function getAvatarStep(
  position: StudyForestAvatarPosition,
  key: string,
  bounds?: { width?: number; height?: number },
): StudyForestAvatarPosition & { facing: "left" | "right" | "up" | "down" };

export function getNextAutoAvatarStep(
  position: StudyForestAvatarPosition,
  tick: number,
  bounds?: { width?: number; height?: number },
): StudyForestAvatarPosition & { facing: "left" | "right" | "up" | "down" };
