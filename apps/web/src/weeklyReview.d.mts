export type WeeklyReviewMetrics = {
  startDate: string;
  endDate: string;
  studySeconds: number;
  sessionCount: number;
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
export function buildWeeklyStudyReview(input: {
  todayDateKey: string;
  sessions?: Array<{ id: string; local_date: string; status: string; duration_seconds: number }>;
  todos?: Array<{ local_date: string; is_completed: boolean }>;
  attendanceDays?: Array<{ local_date: string; status: string }>;
  reflections?: Array<{ session_id: string; focus_score: number; energy_score: number; next_action: string | null; created_at: string }>;
}): {
  current: WeeklyReviewMetrics;
  previous: WeeklyReviewMetrics;
  studySecondsChange: number;
  completionRateChange: number;
  consistencyChange: number;
};
