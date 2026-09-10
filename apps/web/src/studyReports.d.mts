import type { WeeklyReviewMetrics } from "./weeklyReview.mjs";
import type { StudyReportData } from "./studyReportData.mjs";

export type StudyReportRange = { startDate: string; endDate: string; coveredDayCount: number };
export type StudyReportPeriods = {
  mode: "week" | "month";
  currentRange: StudyReportRange;
  previousRange: StudyReportRange;
  isCurrentPeriod: boolean;
  previousAnchor: string;
  nextAnchor: string;
  canGoForward: boolean;
  comparisonLabel: string;
};
export type StudyReport = {
  current: WeeklyReviewMetrics;
  previous: WeeklyReviewMetrics;
  studySecondsChange: number;
  completionRateChange: number;
  consistencyChange: number;
};
export function getStudyReportTodayDate(nowMs: number, timeZone: string): string;
export function getStudyReportPeriods(input: { todayDateKey: string; mode?: "week" | "month"; anchorDate?: string }): StudyReportPeriods;
export function buildStudyReport(periods: StudyReportPeriods, data: StudyReportData): StudyReport;
