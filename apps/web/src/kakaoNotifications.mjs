import { supabaseAnonKey, supabaseUrl } from "./supabase";

export const KAKAO_CONNECT_PENDING_KEY = "study-room-kakao-connect-pending";

export async function getKakaoNotificationStatus(session) {
  return requestKakaoTokenFunction("GET", session);
}

export async function saveKakaoProviderTokens(session) {
  const providerToken = normalizeToken(session?.provider_token);
  if (!providerToken) {
    throw new Error("Kakao provider token is missing from the OAuth callback");
  }

  return requestKakaoTokenFunction("POST", session, {
    provider_token: providerToken,
    provider_refresh_token: normalizeToken(session?.provider_refresh_token),
  });
}

export async function disconnectKakaoNotifications(session) {
  return requestKakaoTokenFunction("DELETE", session);
}

async function requestKakaoTokenFunction(method, session, body) {
  if (!session?.access_token) {
    throw new Error("Supabase session is required");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/kakao-token`, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? `Kakao notification request failed: ${response.status}`);
  }

  return normalizeStatus(payload);
}

function normalizeStatus(value) {
  return {
    connected: Boolean(value?.connected),
    enabled: Boolean(value?.enabled),
    connectedAt: typeof value?.connectedAt === "string" ? value.connectedAt : null,
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : null,
    scope: typeof value?.scope === "string" ? value.scope : null,
    needsTalkMessage: Boolean(value?.needsTalkMessage),
  };
}

function normalizeToken(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
