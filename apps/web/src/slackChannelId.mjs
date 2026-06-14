export function normalizeSlackChannelId(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function isValidSlackChannelId(value) {
  const normalized = normalizeSlackChannelId(value);
  return /^[CG][A-Z0-9]{8,}$/.test(normalized);
}
