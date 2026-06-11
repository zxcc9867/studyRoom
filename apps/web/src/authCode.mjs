export const EMAIL_OTP_LENGTH = 8;

const emailOtpPattern = new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`);

export function sanitizeEmailOtp(value, length = EMAIL_OTP_LENGTH) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, length);
}

export function extractEmailOtpCandidate(value, length = EMAIL_OTP_LENGTH) {
  const text = String(value ?? "");
  const exactRunPattern = new RegExp(`(?:^|\\D)(\\d{${length}})(?=\\D|$)`);
  const exactRun = text.match(exactRunPattern);

  if (exactRun?.[1]) {
    return exactRun[1];
  }

  return sanitizeEmailOtp(text, length);
}

export function isValidEmailOtp(value) {
  return emailOtpPattern.test(sanitizeEmailOtp(value));
}
