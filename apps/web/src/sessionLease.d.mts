export const SESSION_LEASE_DURATION_SECONDS: number;
export const SESSION_LEASE_DURATION_MS: number;
export const SESSION_LEASE_MAX_REMAINING_SECONDS: number;
export const SESSION_LEASE_MAX_REMAINING_MS: number;

export function createSessionLeaseDeadlineMs(nowMs: number, durationMs?: number): number;
export function getExtendedSessionLeaseDeadlineMs(input: {
  currentDeadlineMs: number | null | undefined;
  nowMs: number;
  extensionMs?: number;
  maxRemainingMs?: number;
}): number;
export function parseSessionLeaseDeadlineMs(rawValue: string | null | undefined): number | null;
export function getStoredSessionLeaseDeadlineMs(input: {
  rawValue: string | null | undefined;
  startedAtMs: number;
}): number;
export function getSessionLeaseRemainingSeconds(input: {
  deadlineMs: number;
  nowMs: number;
}): number;
export function isSessionLeaseExpired(input: {
  deadlineMs: number;
  nowMs: number;
}): boolean;
export function getLeaseAwareActiveNowMs(input: {
  deadlineMs: number;
  nowMs: number;
}): number;
export function getSessionLeaseExcludedSeconds(input: {
  deadlineMs: number;
  nowMs: number;
  baseExcludedSeconds?: number;
}): number;
export function getSessionLeaseStorageKey(input: {
  userId: string;
  sessionId: string;
}): string;
