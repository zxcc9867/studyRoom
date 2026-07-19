export type StudySessionBreakState = {
  paused_at?: string | null;
  paused_seconds?: number | null;
};

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
