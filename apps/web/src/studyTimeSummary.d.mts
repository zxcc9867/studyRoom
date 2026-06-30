export function getActiveStudySecondsInWindow(input: {
  startedAtMs: number | null;
  nowMs: number;
  windowStartMs: number;
  windowEndMs: number;
  excludedSeconds?: number;
}): number;

export function getActiveStudySecondsForDate(input: {
  startedAtMs: number | null;
  nowMs: number;
  dateKey: string;
  excludedSeconds?: number;
}): number;

export function getActiveStudySecondsForMonth(input: {
  startedAtMs: number | null;
  nowMs: number;
  monthKey: string;
  excludedSeconds?: number;
}): number;
