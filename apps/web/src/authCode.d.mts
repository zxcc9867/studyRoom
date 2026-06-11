export const EMAIL_OTP_LENGTH: number;

export function sanitizeEmailOtp(value: unknown, length?: number): string;

export function extractEmailOtpCandidate(value: unknown, length?: number): string;

export function isValidEmailOtp(value: unknown): boolean;
