import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIdentityPayload,
  getAuthCodeFromUrl,
  getAuthErrorFromUrl,
  getAuthRedirectTo,
  getImplicitOAuthSessionFromUrl,
  isAuthCallbackUrl,
} from "../src/authProviders.mjs";

test("builds local OAuth callback redirect URLs", () => {
  assert.equal(getAuthRedirectTo("http://127.0.0.1:5177"), "http://127.0.0.1:5177/auth/callback");
  assert.equal(getAuthRedirectTo("http://127.0.0.1:5177/"), "http://127.0.0.1:5177/auth/callback");
});

test("detects auth callback URLs", () => {
  assert.equal(isAuthCallbackUrl("http://127.0.0.1:5177/auth/callback?code=abc"), true);
  assert.equal(isAuthCallbackUrl("http://127.0.0.1:5177/auth/callback?error=access_denied"), true);
  assert.equal(
    isAuthCallbackUrl("http://127.0.0.1:5177/auth/callback#access_token=access&refresh_token=refresh"),
    true,
  );
  assert.equal(isAuthCallbackUrl("http://127.0.0.1:5177/auth/callback#error=access_denied"), true);
  assert.equal(isAuthCallbackUrl("http://127.0.0.1:5177/auth/callback"), false);
  assert.equal(isAuthCallbackUrl("http://127.0.0.1:5177/"), false);
});

test("extracts an OAuth callback code", () => {
  assert.equal(getAuthCodeFromUrl("http://127.0.0.1:5177/auth/callback?code=abc123"), "abc123");
  assert.equal(getAuthCodeFromUrl("http://127.0.0.1:5177/auth/callback?error=access_denied"), null);
});

test("extracts implicit OAuth session tokens from hash callbacks", () => {
  assert.deepEqual(
    getImplicitOAuthSessionFromUrl(
      "http://127.0.0.1:5177/auth/callback#access_token=access-token&refresh_token=refresh-token&expires_in=3600",
    ),
    {
      access_token: "access-token",
      refresh_token: "refresh-token",
    },
  );
  assert.equal(getImplicitOAuthSessionFromUrl("http://127.0.0.1:5177/auth/callback#access_token=only"), null);
  assert.equal(getImplicitOAuthSessionFromUrl("http://127.0.0.1:5177/auth/callback?code=abc123"), null);
});

test("extracts OAuth callback errors from query or hash", () => {
  assert.equal(
    getAuthErrorFromUrl("http://127.0.0.1:5177/auth/callback?error_description=Denied"),
    "Denied",
  );
  assert.equal(
    getAuthErrorFromUrl("http://127.0.0.1:5177/auth/callback#error=access_denied"),
    "access_denied",
  );
  assert.equal(getAuthErrorFromUrl("http://127.0.0.1:5177/auth/callback?code=abc123"), null);
});

test("normalizes Supabase user identity metadata", () => {
  assert.deepEqual(
    buildIdentityPayload({
      id: "user-1",
      email: "study@example.com",
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: {
        provider_id: "google-user-1",
        full_name: "Study User",
        avatar_url: "https://example.com/avatar.png",
      },
    }),
    {
      user_id: "user-1",
      provider: "google",
      provider_user_id: "google-user-1",
      email: "study@example.com",
      display_name: "Study User",
      avatar_url: "https://example.com/avatar.png",
    },
  );
});
