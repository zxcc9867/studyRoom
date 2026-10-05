import test from 'node:test';
import assert from 'node:assert/strict';
import { getActiveStudySecondsForDate, getActiveStudySecondsForMonth } from '../src/studyTimeSummary.mjs';
import { allocateCompletedStudySecondsByDate } from '../src/weeklyHabit.mjs';
import { getStudyReportTodayDate } from '../src/studyReports.mjs';

const session = { local_date: '2026-10-05', status: 'completed', started_at: '2026-10-05T14:00:00Z', ended_at: '2026-10-05T16:30:00Z', duration_seconds: 9000 };
test('completed midnight sessions count once on their persisted study day', () => {
  assert.deepEqual(allocateCompletedStudySecondsByDate({ sessions: [session], dateKeys: ['2026-10-05', '2026-10-06'], timeZone: 'Asia/Tokyo' }), { '2026-10-05': 9000, '2026-10-06': 0 });
  assert.deepEqual(allocateCompletedStudySecondsByDate({ sessions: [session], dateKeys: ['2026-10-05', '2026-10-06'], timeZone: 'America/New_York' }), { '2026-10-05': 9000, '2026-10-06': 0 });
});
test('active sessions stay on their starting day across 04:00 and month boundaries; exclusions are retained', () => {
  const input = { localDate: '2026-09-30', startedAtMs: Date.parse('2026-09-30T14:00:00Z'), nowMs: Date.parse('2026-09-30T19:30:00Z'), timeZone: 'Asia/Tokyo', excludedSeconds: 1800 };
  assert.equal(getActiveStudySecondsForDate({ ...input, dateKey: '2026-09-30' }), 18000);
  assert.equal(getActiveStudySecondsForDate({ ...input, dateKey: '2026-10-01' }), 0);
  assert.equal(getActiveStudySecondsForMonth({ ...input, monthKey: '2026-09' }), 18000);
  assert.equal(getActiveStudySecondsForMonth({ ...input, monthKey: '2026-10' }), 0);
});
test('reports use the 04:00 study day rather than the calendar date', () => {
  assert.equal(getStudyReportTodayDate(Date.parse('2026-10-05T16:30:00Z'), 'Asia/Tokyo'), '2026-10-05');
});
