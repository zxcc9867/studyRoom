import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/index.mjs';

test('study day changes at local 04:00, including month/year and DST boundaries', () => {
  assert.equal(typeof core.getStudyDateKey, 'function');
  for (const [instant, zone, expected] of [
    ['2026-10-05T18:59:59Z', 'Asia/Tokyo', '2026-10-05'],
    ['2026-10-05T19:00:00Z', 'Asia/Tokyo', '2026-10-06'],
    ['2026-09-30T16:30:00Z', 'Asia/Tokyo', '2026-09-30'],
    ['2026-12-31T18:59:59Z', 'Asia/Tokyo', '2026-12-31'],
    ['2026-03-08T07:30:00Z', 'America/New_York', '2026-03-07'],
    ['2026-03-08T08:00:00Z', 'America/New_York', '2026-03-08'],
    ['2026-11-01T08:59:59Z', 'America/New_York', '2026-10-31'],
    ['2026-11-01T09:00:00Z', 'America/New_York', '2026-11-01'],
  ]) assert.equal(core.getStudyDateKey(new Date(instant), zone), expected);
  assert.equal(core.getDateKey(new Date('2026-10-05T16:30:00Z'), 'Asia/Tokyo'), '2026-10-06');
});

test('late-night attendance credits the starting study day, not the next date', () => {
  const sessions = [{ localDate: '2026-10-05', startedAt: '2026-10-05T14:00:00Z', endedAt: '2026-10-05T16:30:00Z', durationSeconds: 9000 }];
  const result = core.evaluateAttendance({ now: '2026-10-05T16:30:00Z', timeZone: 'Asia/Tokyo', reminderTime: '20:30', sessions });
  assert.equal(result.dateKey, '2026-10-05');
  assert.equal(result.status, 'present');
  assert.equal(result.attendanceReason, 'daily_study_goal');
  assert.equal(core.evaluateAttendance({ now: '2026-10-05T19:00:00Z', timeZone: 'Asia/Tokyo', reminderTime: '20:30', sessions }).status, 'pending');
});
