export type StudyPeriodSummary = {
  completedSeconds: number;
  completedSessionCount: number;
  anomalySessionCount: number;
  crossDateSessionCount: number;
};

export const EMPTY_STUDY_PERIOD_SUMMARY: Readonly<StudyPeriodSummary>;

export function fetchStudyPeriodSummary(
  client: { rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> },
  startDate: string,
  endDate: string,
): Promise<StudyPeriodSummary>;

export function normalizeStudyPeriodSummary(row: unknown): StudyPeriodSummary;
export function getMonthDateRange(monthKey: string): { startDate: string; endDate: string };
