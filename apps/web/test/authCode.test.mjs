import test from "node:test";
import assert from "node:assert/strict";

import {
  EMAIL_OTP_LENGTH,
  extractEmailOtpCandidate,
  isValidEmailOtp,
  sanitizeEmailOtp,
} from "../src/authCode.mjs";

test("extracts an eight digit OTP from pasted text", () => {
  assert.equal(EMAIL_OTP_LENGTH, 8);
  assert.equal(sanitizeEmailOtp(" 0022 4379 "), "00224379");
  assert.equal(sanitizeEmailOtp("002243791234"), "00224379");
  assert.equal(extractEmailOtpCandidate("Your login code is 00224379."), "00224379");
  assert.equal(extractEmailOtpCandidate("Code: 0022 4379"), "00224379");
  assert.equal(extractEmailOtpCandidate("No code here"), "");
  assert.equal(isValidEmailOtp("00224379"), true);
  assert.equal(isValidEmailOtp("0022437"), false);
});
