export function validTimeZone(value) {
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return Boolean(value); } catch { return false; }
}

export function timeZoneChoices() {
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC', 'America/New_York', 'Europe/London'];
  return [...new Set(['Asia/Seoul', 'Asia/Tokyo', ...supported])];
}

export function localParts(instant, timeZone) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('시간 형식을 확인해 주세요.');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Resolve wall time in the selected zone, never the browser zone. A repeated DST
// hour uses its first occurrence; a nonexistent hour must be corrected by the user.
export function wallTimeToInstant(value, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validTimeZone(timeZone)) throw new Error('날짜와 시간대를 확인해 주세요.');
  const naive = Date.parse(value + ':00Z');
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== value) throw new Error('날짜와 시간을 확인해 주세요.');
  const matches = new Set();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = naive + hours * 3600000;
    const offset = Date.parse(localParts(sample, timeZone) + ':00Z') - sample;
    const candidate = naive - offset;
    if (localParts(candidate, timeZone) === value) matches.add(candidate);
  }
  if (!matches.size) throw new Error('서머타임 전환으로 존재하지 않는 시각입니다. 다른 시간을 선택해 주세요.');
  return new Date(Math.min(...matches)).toISOString();
}

export function shiftDate(value, days) {
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function eventsOnDate(events, dateKey, timeZone) {
  return events.filter(event => {
    const start = event.all_day ? event.start_date : event.start_at && localParts(event.start_at, timeZone).slice(0, 10);
    const end = event.all_day ? event.end_date : event.end_at && localParts(Date.parse(event.end_at) - 1, timeZone).slice(0, 10);
    if (!start || !end) return false;
    if (!event.repeat_weekdays?.length) return dateKey >= start && (event.all_day ? dateKey < end : dateKey <= end);
    // Map the displayed day to the recurrence's own wall-clock zone, including
    // events whose local start belongs to the preceding/following display date.
    const originalStart = event.all_day ? event.start_date : localParts(event.start_at, event.time_zone).slice(0,10);
    const originalEnd = event.all_day ? event.end_date : localParts(event.end_at, event.time_zone).slice(0,10);
    const spanDays = Math.max(0, Math.min(366, Math.round((Date.parse(originalEnd) - Date.parse(originalStart))/86400000)));
    for (let dayOffset = -spanDays - 1; dayOffset <= 1; dayOffset++) {
      const anchor = shiftDate(dateKey, dayOffset);
      const original = event.all_day ? event.start_date : localParts(event.start_at, event.time_zone).slice(0, 10);
      if (anchor < original || (event.repeat_until && anchor > event.repeat_until)) continue;
      if (!event.repeat_weekdays.includes(new Date(anchor + 'T12:00:00Z').getUTCDay())) continue;
      if (event.all_day) { if (dateKey >= anchor && dateKey < shiftDate(anchor, spanDays)) return true; continue; }
      try {
        const recurring = wallTimeToInstant(`${anchor}T${localParts(event.start_at, event.time_zone).slice(11)}`, event.time_zone);
        const recurringEnd = Date.parse(wallTimeToInstant(`${shiftDate(anchor,spanDays)}T${localParts(event.end_at,event.time_zone).slice(11)}`,event.time_zone));
        if (dateKey >= localParts(recurring, timeZone).slice(0, 10) && dateKey <= localParts(recurringEnd - 1, timeZone).slice(0, 10)) return true;
      } catch { /* A DST gap has no occurrence. */ }
    }
    return false;
  });
}
