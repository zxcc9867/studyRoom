import type { SupabaseClient } from '@supabase/supabase-js';
export type LearningInterruptionReason = 'none' | 'phone' | 'environment' | 'fatigue' | 'schedule' | 'other' | null;
export interface LearningReflection {
  focusScore: number | null; energyScore: number | null; interruptionReason: LearningInterruptionReason;
  note: string; nextAction: string; contextTodoId: string | null; resourceUrl: string; resourcePosition: string;
}
export interface LearningBookmark {
  reflectionId: string; sessionId: string; todoId: string; todoTitle: string; localDate: string;
  startTime: string | null; endTime: string | null; todoUpdatedAt: string; updatedAt: string;
  nextAction: string; resourceUrl: string; resourcePosition: string;
}
export interface LearningResult {
  reflectionId: string; sessionId: string; todoId: string | null; todoTitle: string | null; localDate: string;
  startedAt: string; endedAt: string; note: string; nextAction: string; resourceUrl: string; resourcePosition: string;
  focusScore: number | null; energyScore: number | null; interruptionReason: LearningInterruptionReason; updatedAt: string;
}
export interface LearningContinuitySnapshot { version: 1; bookmarks: LearningBookmark[]; results: LearningResult[] }
export interface LearningCompletedSession {
  id: string; user_id: string; status: 'completed'; local_date: string; started_at: string; ended_at: string;
  duration_seconds: number; paused_at: string | null; paused_seconds: number; lease_expires_at: string | null;
  lease_warning_sent_at: string | null; created_at: string; updated_at: string;
  [key: string]: unknown;
}
export interface PreparedLearningTodo { version: 1; todoId: string; localDate: string; startTime: string | null; endTime: string | null; updatedAt: string }
export interface LearningRequestOptions { signal?: AbortSignal }
/** RPC learning_continuity_snapshot(p_study_date date). Throws on schema/transport/validation errors. */
export function loadLearningContinuity(client: SupabaseClient, studyDate: string, options?: LearningRequestOptions): Promise<LearningContinuitySnapshot>;
/** RPC complete_learning_session(p_session_id uuid,p_excluded_seconds integer,p_completed_todo_ids uuid[],p_reflection jsonb).
 * p_reflection uses snake_case keys corresponding to LearningReflection. One transaction with the legacy completion RPC. */
export function completeLearningSession(client: SupabaseClient, input: { sessionId: string; excludedSeconds: number; completedTodoIds: string[]; reflection: LearningReflection }, options?: LearningRequestOptions): Promise<{version: 1; session: LearningCompletedSession; reflection: LearningResult}>;
/** RPC save_learning_reflection(p_session_id uuid,p_reflection jsonb,p_expected_updated_at timestamptz default null).
 * Existing rows REQUIRE matching expectedUpdatedAt; omitted/null is valid only for creation. */
export function saveLearningReflection(client: SupabaseClient, input: { sessionId: string; reflection: LearningReflection; expectedUpdatedAt?: string | null }, options?: LearningRequestOptions): Promise<LearningResult>;
/** RPC update_learning_bookmark(p_reflection_id uuid,p_expected_updated_at timestamptz,p_next_action text,p_resource_url text,p_resource_position text). */
export function updateLearningBookmark(client: SupabaseClient, input: { reflectionId: string; expectedUpdatedAt: string; nextAction: string; resourceUrl: string; resourcePosition: string }, options?: LearningRequestOptions): Promise<LearningResult>;
/** RPC prepare_learning_todo(p_todo_id uuid,p_expected_local_date date,p_expected_updated_at timestamptz). Server chooses calendar-today.
 * Errors retain server code; 55P03 indicates contention requiring an explicit retry, never an automatic mutation retry. */
export function prepareLearningTodo(client: SupabaseClient, input: { todoId: string; expectedLocalDate: string; expectedUpdatedAt: string }, options?: LearningRequestOptions): Promise<PreparedLearningTodo>;
export function normalizeLearningReflection(value: Partial<LearningReflection>): LearningReflection;
export function validateLearningResourceUrl(value: string | null | undefined): string;
