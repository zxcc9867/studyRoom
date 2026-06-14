export const GOOGLE_PROVIDER: "google";

export type IdentityPayload = {
  user_id: string;
  provider: string;
  provider_user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export function getAuthRedirectTo(origin: string): string;

export function isAuthCallbackUrl(value: string): boolean;

export function getAuthCodeFromUrl(value: string): string | null;

export function getAuthErrorFromUrl(value: string): string | null;

export function getImplicitOAuthSessionFromUrl(value: string): {
  access_token: string;
  refresh_token: string;
} | null;

export function buildIdentityPayload(user: {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): IdentityPayload;
