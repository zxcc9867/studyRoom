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
