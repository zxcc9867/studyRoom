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
export type StudyForestTimePhase = "morning" | "afternoon" | "sunset" | "night";

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


export type StudyForestBlockedReason = "edge" | "water" | "cottage" | "garden" | "tree";

export type StudyForestLevelMilestone = {
  days: number;
  label: string;
  update: string;
  interiorUnlock: string;
};

export type StudyForestLevelUpdate = {
  targetDays: number;
  remainingDays: number;
  title: string;
  description: string;
  interiorUnlock: string;
};

export type StudyForestInteriorRewards = {
  plant: boolean;
  bookshelf: boolean;
  rug: boolean;
  readingLamp: boolean;
  wallClock: boolean;
  trophy: boolean;
};

export const forestLevelMilestones: StudyForestLevelMilestone[];

export function getCottageAvatarStep(
  position: StudyForestAvatarPosition,
  key: string,
  bounds?: StudyForestAvatarBounds,
  rewards?: Partial<StudyForestInteriorRewards>,
): StudyForestAvatarPosition & { facing: StudyForestAvatarFacing };

export function isCottagePositionWalkable(
  position: Pick<StudyForestAvatarPosition, "x" | "y">,
  bounds?: StudyForestAvatarBounds,
  rewards?: Partial<StudyForestInteriorRewards>,
): boolean;

export function resolveCottageAvatarTarget(
  currentPosition: Pick<StudyForestAvatarPosition, "x" | "y">,
  targetPosition: Pick<StudyForestAvatarPosition, "x" | "y">,
  bounds?: StudyForestAvatarBounds,
  rewards?: Partial<StudyForestInteriorRewards>,
): Pick<StudyForestAvatarPosition, "x" | "y">;

export function isCottageExitPosition(
  position: Pick<StudyForestAvatarPosition, "x" | "y">,
): boolean;

export function isCottageEntrancePosition(
  position: Pick<StudyForestAvatarPosition, "x" | "y">,
): boolean;

export function getForestTimePhase(hour?: number): StudyForestTimePhase;

export function getForestInteriorRewards(
  progressDays: number,
  completedTrees?: number,
): StudyForestInteriorRewards;

export function getForestBlockedReason(
  position: Pick<StudyForestAvatarPosition, "x" | "y">,
  bounds?: StudyForestAvatarBounds,
): StudyForestBlockedReason | null;

export function isForestAvatarPositionWalkable(
  position: Pick<StudyForestAvatarPosition, "x" | "y">,
  bounds?: StudyForestAvatarBounds,
): boolean;

export function resolveForestAvatarTarget(
  currentPosition: Pick<StudyForestAvatarPosition, "x" | "y">,
  targetPosition: Pick<StudyForestAvatarPosition, "x" | "y">,
  bounds?: StudyForestAvatarBounds,
): Pick<StudyForestAvatarPosition, "x" | "y">;

export function getForestNavigationPath(
  fromPosition: Pick<StudyForestAvatarPosition, "x" | "y">,
  targetPosition: Pick<StudyForestAvatarPosition, "x" | "y">,
  bounds?: StudyForestAvatarBounds,
): Array<Pick<StudyForestAvatarPosition, "x" | "y">>;

export function getNextForestLevelUpdate(progressDays: number): StudyForestLevelUpdate;

export function getAvatarSceneStyle(
  position: StudyForestAvatarPosition,
  bounds?: StudyForestAvatarBounds,
): StudyForestAvatarSceneStyle;
