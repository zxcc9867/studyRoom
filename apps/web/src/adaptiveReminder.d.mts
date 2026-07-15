export type AdaptiveReminderRecommendation = {
  status: "insufficient-data" | "aligned" | "recommended";
  recommendedTime: string;
  sampleSize: number;
  deltaMinutes: number;
  reason: string;
};

export function getAdaptiveReminderRecommendation(input: {
  sessions?: Array<{ local_date: string; started_at: string; status: string }>;
  todayDateKey: string;
  timeZone: string;
  currentReminderTime: string;
  minimumDays?: number;
}): AdaptiveReminderRecommendation;
