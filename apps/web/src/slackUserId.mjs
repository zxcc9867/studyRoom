export function normalizeSlackUserId(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  const mentionMatch = normalized.match(/^<@([UW][A-Z0-9]{2,})(?:\|[^>]+)?>$/);
  return mentionMatch ? mentionMatch[1] : normalized;
}

export function isValidSlackUserId(value) {
  const normalized = normalizeSlackUserId(value);
  return /^[UW][A-Z0-9]{8,}$/.test(normalized);
}

export function buildSlackUserMention(value) {
  const normalized = normalizeSlackUserId(value);
  return isValidSlackUserId(normalized) ? `<@${normalized}>` : "";
}
