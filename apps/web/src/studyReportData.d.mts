import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyPeriodSummary } from "./studyPeriodSummary.mjs";
import type { StudyReportPeriods } from "./studyReports.mjs";

export type ReportSession = { id: string; local_date: string; status: string; duration_seconds: number };
export type ReportTodo = { id?: string; title?: string; local_date: string; is_completed: boolean };
export type ReportAttendance = { local_date: string; status: string };
export type ReportReflection = { session_id: string; focus_score: number; energy_score: number; interruption_reason: "none" | "phone" | "environment" | "fatigue" | "schedule" | "other" | null; next_action: string | null; created_at: string };
export type StudyReportData = {
  currentSummary: StudyPeriodSummary;
  previousSummary: StudyPeriodSummary;
  sessions: ReportSession[];
  todos: ReportTodo[];
  attendanceDays: ReportAttendance[];
  reflections: ReportReflection[];
  plannedTodos: ReportTodo[];
};
export type StudyReportState<T = StudyReportData> = { key: string; status: "loading" | "error" } | { key: string; status: "ready"; data: T };
export function loadStudyReportProfile(client: SupabaseClient, userId: string, signal?: AbortSignal): Promise<{ timeZone: string }>;
export function loadStudyReportData(client: SupabaseClient, userId: string, periods: StudyReportPeriods, signal?: AbortSignal): Promise<StudyReportData>;
export function getStudyReportState<T>(state: StudyReportState<T> | null, key: string): StudyReportState<T>;
export function createStudyReportRequest<T = StudyReportData>(options?: { timeoutMs?: number }): {
  cancel(): void;
  run(key: string, load: (signal: AbortSignal) => Promise<T>, emit: (state: StudyReportState<T>) => void): Promise<void>;
};
