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

export type StudyForestAvatarFacing = "left" | "right" | "up" | "down";

export type StudyForestAvatarPosition = {
  x: number;
  y: number;
  facing?: StudyForestAvatarFacing;
};

export type StudyForestAvatarBounds = {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  step?: number;
};

export type StudyForestScenePointInput = {
  clientX: number;
  clientY: number;
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">;
};

export type StudyForestAvatarSceneStyle = {
  left: string;
  top: string;
  "--forest-avatar-scale": string;
  zIndex: string;
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
  bounds?: StudyForestAvatarBounds,
): StudyForestAvatarPosition & { facing: StudyForestAvatarFacing };

export function getNextAutoAvatarStep(
  position: StudyForestAvatarPosition,
  tick: number,
  bounds?: StudyForestAvatarBounds,
): StudyForestAvatarPosition & { facing: StudyForestAvatarFacing };

export function getAvatarPositionFromScenePoint(
  input: StudyForestScenePointInput,
  bounds?: StudyForestAvatarBounds,
): Pick<StudyForestAvatarPosition, "x" | "y">;

export function getAvatarFacing(
  fromPosition: StudyForestAvatarPosition,
  toPosition: Pick<StudyForestAvatarPosition, "x" | "y">,
): StudyForestAvatarFacing;

export function getAvatarSceneStyle(
  position: StudyForestAvatarPosition,
  bounds?: StudyForestAvatarBounds,
): StudyForestAvatarSceneStyle;
