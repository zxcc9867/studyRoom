export type StudySessionBreakState = {
  paused_at?: string | null;
  paused_seconds?: number | null;
};

export type StudyBreakReturnStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StudyBreakReturnPlanState = {
  planned: boolean;
  due: boolean;
  deadlineMs: number | null;
  remainingSeconds: number;
  leaseExpiresBeforeReturn: boolean;
};

export declare const BREAK_RETURN_PRESET_MINUTES: readonly number[];

export declare function isStudySessionPaused(session: StudySessionBreakState | null | undefined): boolean;

export declare function getCurrentStudyBreakSeconds(options: {
  pausedAt?: string | null;
  nowMs?: number;
}): number;

export declare function getTotalStudyBreakSeconds(options: {
  pausedSeconds?: number | null;
  pausedAt?: string | null;
  nowMs?: number;
}): number;

export declare function getStudyBreakReturnStorageKey(options?: {
  userId?: string | null;
  sessionId?: string | null;
}): string;

export declare function createStudyBreakReturnDeadlineMs(options?: {
  nowMs?: number;
  durationMinutes?: number;
}): number | null;

export declare function extendStudyBreakReturnDeadlineMs(options?: {
  deadlineMs?: number | null;
  nowMs?: number;
  durationMinutes?: number;
}): number | null;

export declare function getStudyBreakReturnPlanState(options?: {
  deadlineMs?: number | null;
  nowMs?: number;
  leaseDeadlineMs?: number | null;
}): StudyBreakReturnPlanState;

export declare function readStudyBreakReturnDeadlineMs(
  storage: Pick<StudyBreakReturnStorage, "getItem"> | null | undefined,
  key: string,
): number | null;

export declare function persistStudyBreakReturnDeadlineMs(
  storage: Pick<StudyBreakReturnStorage, "setItem"> | null | undefined,
  key: string,
  deadlineMs: number | null,
): boolean;

export declare function clearStudyBreakReturnDeadline(
  storage: Pick<StudyBreakReturnStorage, "removeItem"> | null | undefined,
  key: string,
): boolean;
