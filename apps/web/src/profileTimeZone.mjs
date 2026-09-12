export function validTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try { new Intl.DateTimeFormat('en', {timeZone:value}).format(); return true; } catch { return false; }
}
export function timeZoneChoices() {
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC','America/New_York','Europe/London'];
  return [...new Set(['Asia/Seoul','Asia/Tokyo',...supported])];
}
