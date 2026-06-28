export const STUDY_SESSION_ACTIVITY_HEARTBEAT_MS: number;
export const STUDY_SESSION_INACTIVITY_GRACE_MS: number;

export function getStudySessionActivityStorageKey(input: {
  userId: string;
  sessionId: string;
}): string;
export function parseStudySessionActivityMs(rawValue: string | number | null | undefined): number | null;
export function shouldEndStudySessionForInactivity(input?: {
  lastActivityMs: string | number | null | undefined;
  nowMs: number;
  graceMs?: number;
}): boolean;
export function getStudySessionActivityExcludedSeconds(input?: {
  lastActivityMs: string | number | null | undefined;
  nowMs: number;
}): number;
