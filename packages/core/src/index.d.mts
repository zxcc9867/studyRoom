export function getStudyDateKey(date: Date | string, timeZone: string): string;
export function getSessionStudyDateKey(session: {
  local_date?: string; localDate?: string; started_at?: string; startedAt?: string;
}, timeZone: string): string;
export function getDateKey(date: Date, timeZone: string): string;
