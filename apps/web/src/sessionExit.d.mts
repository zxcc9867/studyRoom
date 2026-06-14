type ExitFetch = (
  url: string,
  init: RequestInit & {
    keepalive: boolean;
  },
) => Promise<unknown>;

export function requestEndStudySessionOnExit(options: {
  supabaseUrl?: string | null;
  anonKey?: string | null;
  accessToken?: string | null;
  sessionId?: string | null;
  excludedSeconds?: number;
  fetch?: ExitFetch;
}): boolean;

export function shouldEndStudySessionForPageEvent(event?: {
  type?: string;
  visibilityState?: string;
}): boolean;
