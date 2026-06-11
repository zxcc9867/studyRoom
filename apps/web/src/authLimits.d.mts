export const OTP_RETRY_COOLDOWN_MS: number;
export const EMAIL_SEND_RATE_LIMIT_COOLDOWN_MS: number;
export const MAX_AUTH_RETRY_COOLDOWN_MS: number;

export function isEmailSendRateLimitError(message: unknown): boolean;

export function isRateLimitError(message: unknown): boolean;

export function getAuthRetryCooldownMs(message: unknown): number;

export function formatRetryWait(milliseconds: number): string;
