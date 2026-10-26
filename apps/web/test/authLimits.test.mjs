import test from "node:test";
import assert from "node:assert/strict";

import {
  EMAIL_SEND_RATE_LIMIT_COOLDOWN_MS,
  OTP_RETRY_COOLDOWN_MS,
  formatRetryWait,
  getAuthRetryCooldownMs,
  isEmailSendRateLimitError,
  isRateLimitError,
} from "../src/authLimits.mjs";

test("distinguishes Supabase built-in email send limits from short OTP retry limits", () => {
  assert.equal(isEmailSendRateLimitError("Email rate limit exceeded"), true);
  assert.equal(isEmailSendRateLimitError("over_email_send_rate_limit"), true);
  assert.equal(isEmailSendRateLimitError("Request rate limit reached"), false);
  assert.equal(isRateLimitError("Email rate limit exceeded"), true);
  assert.equal(isRateLimitError("Request rate limit reached"), true);
});

test("returns conservative retry cooldowns for auth rate limits", () => {
  assert.equal(getAuthRetryCooldownMs("Email rate limit exceeded"), EMAIL_SEND_RATE_LIMIT_COOLDOWN_MS);
  assert.equal(getAuthRetryCooldownMs("Request rate limit reached"), OTP_RETRY_COOLDOWN_MS);
  assert.equal(formatRetryWait(59_000), "59초");
  assert.equal(formatRetryWait(3_600_000), "1시간");
});

test("native safe error codes retain the correct resend cooldown", () => {
  assert.equal(isRateLimitError("AUTH_EMAIL_RATE_LIMIT"), true);
  assert.equal(isRateLimitError("AUTH_RATE_LIMIT"), true);
  assert.equal(isEmailSendRateLimitError("AUTH_EMAIL_RATE_LIMIT"), true);
  assert.equal(getAuthRetryCooldownMs("AUTH_EMAIL_RATE_LIMIT"), 3_600_000);
  assert.equal(getAuthRetryCooldownMs("AUTH_RATE_LIMIT"), 60_000);
  assert.equal(isRateLimitError("AUTH_NETWORK_ERROR"), false);
});
