export const OTP_RETRY_COOLDOWN_MS = 60 * 1000;
export const EMAIL_SEND_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;
export const MAX_AUTH_RETRY_COOLDOWN_MS = EMAIL_SEND_RATE_LIMIT_COOLDOWN_MS;

export function isEmailSendRateLimitError(message) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("email rate limit") ||
    normalized.includes("email send rate limit") ||
    normalized.includes("over_email_send_rate_limit")
  );
}

export function isRateLimitError(message) {
  return String(message ?? "").toLowerCase().includes("rate limit");
}

export function getAuthRetryCooldownMs(message) {
  return isEmailSendRateLimitError(message) ? EMAIL_SEND_RATE_LIMIT_COOLDOWN_MS : OTP_RETRY_COOLDOWN_MS;
}

export function formatRetryWait(milliseconds) {
  const seconds = Math.max(1, Math.ceil(Number(milliseconds ?? 0) / 1000));

  if (seconds >= 3600) {
    const hours = Math.ceil(seconds / 3600);
    return `${hours}시간`;
  }

  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}분`;
  }

  return `${seconds}초`;
}
