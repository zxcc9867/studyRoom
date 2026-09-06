import type { SupabaseClient } from '@supabase/supabase-js';
export type CoachingFeedback = 'helpful' | 'difficult';
export type StudyCoaching = { id: string; source: 'ai' | 'rules'; title: string; firstAction: string; reason: string; evidence: string[]; createdAt: string; feedback: CoachingFeedback | null };
export function parseStudyCoaching(data: unknown): StudyCoaching;
export function requestStudyCoaching(options: { supabase: SupabaseClient; userId: string; payload: {action: 'generate'; todoId: string} | {action: 'feedback'; coachingId: string; feedback: CoachingFeedback}; signal?: AbortSignal; fetchImpl?: typeof fetch }): Promise<StudyCoaching | {ok: true}>;
