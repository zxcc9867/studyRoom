export const REFLECTION_INBOX_WINDOW_DAYS: number;
export const REFLECTION_INBOX_LIMIT: number;

export type ReflectionInboxSession = {
  id: string;
  local_date: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  status: string;
};

export type ReflectionInboxRecord = {
  session_id: string;
};

export function getPendingReflectionSessions<T extends ReflectionInboxSession>(options: {
  todayDateKey: string;
  sessions: T[];
  reflections: ReflectionInboxRecord[];
  windowDays?: number;
  limit?: number;
}): T[];
