export const GOOGLE_PROVIDER = "google";

export function getAuthRedirectTo(origin) {
  return `${String(origin ?? "").replace(/\/+$/, "")}/auth/callback`;
}

export function isAuthCallbackUrl(value) {
  const url = new URL(String(value ?? ""), "http://localhost");
  const hashParams = getHashParams(url);

  return (
    url.pathname === "/auth/callback" &&
    (url.searchParams.has("code") ||
      url.searchParams.has("error") ||
      url.searchParams.has("error_description") ||
      hashParams.has("access_token") ||
      hashParams.has("error") ||
      hashParams.has("error_description"))
  );
}

export function getAuthCodeFromUrl(value) {
  const url = new URL(String(value ?? ""), "http://localhost");
  return url.searchParams.get("code");
}

export function getAuthErrorFromUrl(value) {
  const url = new URL(String(value ?? ""), "http://localhost");
  const hashParams = getHashParams(url);
  return (
    url.searchParams.get("error_description") ??
    url.searchParams.get("error") ??
    hashParams.get("error_description") ??
    hashParams.get("error")
  );
}

export function getImplicitOAuthSessionFromUrl(value) {
  const url = new URL(String(value ?? ""), "http://localhost");
  const hashParams = getHashParams(url);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export function buildIdentityPayload(user) {
  const appMetadata = user?.app_metadata ?? {};
  const userMetadata = user?.user_metadata ?? {};
  const provider = appMetadata.provider || appMetadata.providers?.[0] || "email";

  return {
    user_id: user.id,
    provider,
    provider_user_id: userMetadata.provider_id || userMetadata.sub || user.id,
    email: user.email ?? userMetadata.email ?? null,
    display_name: userMetadata.full_name || userMetadata.name || userMetadata.user_name || null,
    avatar_url: userMetadata.avatar_url || userMetadata.picture || null,
  };
}

function getHashParams(url) {
  return new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
}
