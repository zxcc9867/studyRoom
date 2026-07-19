export type WeeklyStudySummary = {
  completedSeconds: number;
  completedSessionCount: number;
  anomalySessionCount: number;
  crossDateSessionCount: number;
};

export type WeeklyReviewMetrics = {
  startDate: string;
  endDate: string;
  coveredDayCount: number;
  studySeconds: number;
  sessionCount: number;
  anomalySessionCount: number;
  crossDateSessionCount: number;
  plannedTodoCount: number;
  completedTodoCount: number;
  completionRate: number;
  presentDays: number;
  reflectionCount: number;
  averageFocus: number | null;
  averageEnergy: number | null;
  consistencyScore: number;
  nextActions: string[];
};

export function getStudyWeekRange(dateKey: string, weekOffset?: number): { startDate: string; endDate: string };
export function getComparableStudyWeekRanges(dateKey: string): {
  currentRange: { startDate: string; endDate: string; coveredDayCount: number };
  previousRange: { startDate: string; endDate: string; coveredDayCount: number };
};
export function formatStudyDuration(seconds: number): string;
export function formatStudyDurationChange(seconds: number): string;
export function buildWeeklyStudyReview(input: WeeklyReviewInput): WeeklyReview;
export function buildComparableWeeklyStudyReview(input: WeeklyReviewInput): WeeklyReview;

type WeeklyReviewInput = {
  todayDateKey: string;
  sessions?: Array<{ id: string; local_date: string; status: string; duration_seconds: number }>;
  todos?: Array<{ local_date: string; is_completed: boolean }>;
  attendanceDays?: Array<{ local_date: string; status: string }>;
  reflections?: Array<{ session_id: string; focus_score: number; energy_score: number; next_action: string | null; created_at: string }>;
  currentStudySummary?: WeeklyStudySummary | null;
  previousStudySummary?: WeeklyStudySummary | null;
};

type WeeklyReview = {
  current: WeeklyReviewMetrics;
  previous: WeeklyReviewMetrics;
  studySecondsChange: number;
  completionRateChange: number;
  consistencyChange: number;
};
