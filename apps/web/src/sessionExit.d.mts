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
  fetch?: ExitFetch;
}): boolean;
