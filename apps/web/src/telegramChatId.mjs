export function normalizeTelegramChatId(value) {
  return String(value ?? "").trim();
}

export function isValidTelegramChatId(value) {
  const normalized = normalizeTelegramChatId(value);
  return /^-?\d{5,20}$/.test(normalized) || /^@[A-Za-z0-9_]{5,32}$/.test(normalized);
}
