// Free models routinely answer with correct JSON wrapped in a markdown fence even
// when told to return JSON only. Unwrapping that fence is a transport concern: the
// caller still validates the shape, the field lengths and every citation, so this
// never widens what counts as an acceptable answer.
const FENCE = /```[ \t]*[A-Za-z]*[ \t]*\r?\n([\s\S]*?)(?:\r?\n[ \t]*```|$)/;

export function parseModelJson(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  // Only the first fenced block is considered; trailing prose or a second block
  // must not be concatenated into one value.
  const fenced = FENCE.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}
