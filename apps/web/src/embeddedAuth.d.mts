import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type EmbeddedTicket = {
  type: 'STUDY_WEB_AUTH_TICKET';
  requestId: string;
  userId: string;
  tokenHash: string;
};

export function isEmbeddedStudyApp(host: unknown): boolean;
export function parseEmbeddedTicket(value: unknown): EmbeddedTicket | null;
export function consumeEmbeddedTicket(
  supabase: SupabaseClient,
  value: unknown,
  expectedRequestId: string,
): Promise<Session>;
export function postEmbeddedMessage(host: unknown, message: Record<string, unknown>): boolean;
export function beginEmbeddedAuthentication(
  supabase: SupabaseClient,
  host: unknown,
  requestId: string,
): Promise<void>;
