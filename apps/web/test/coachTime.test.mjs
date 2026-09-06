import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventsOnDate,localParts,shiftDate,timeZoneChoices,validTimeZone,wallTimeToInstant} from '../src/coachTime.mjs';

test('Seoul and Tokyo are first choices and preserve IANA values',()=>{
  assert.deepEqual(timeZoneChoices().slice(0,2),['Asia/Seoul','Asia/Tokyo']);
  assert.equal(validTimeZone('Asia/Seoul'),true);assert.equal(validTimeZone('Asia/Tokyo'),true);assert.equal(validTimeZone('서울'),false);
});
test('wall time resolves against selected region rather than browser time',()=>{
  assert.equal(wallTimeToInstant('2026-09-06T09:30','Asia/Seoul'),'2026-09-06T00:30:00.000Z');
  assert.equal(wallTimeToInstant('2026-09-06T09:30','Asia/Tokyo'),'2026-09-06T00:30:00.000Z');
  assert.equal(wallTimeToInstant('2026-09-06T09:30','America/New_York'),'2026-09-06T13:30:00.000Z');
});
test('midnight stays 00:00 and local day crosses UTC boundary',()=>{
  assert.equal(localParts('2026-09-05T15:00:00Z','Asia/Seoul'),'2026-09-06T00:00');
  assert.equal(wallTimeToInstant('2026-09-06T00:00','Asia/Tokyo'),'2026-09-05T15:00:00.000Z');
});
test('DST spring gap rejects nonexistent local input',()=>{
  assert.throws(()=>wallTimeToInstant('2026-03-08T02:30','America/New_York'),/서머타임/);
});
test('DST fall overlap explicitly chooses earliest occurrence',()=>{
  assert.equal(wallTimeToInstant('2026-11-01T01:30','America/New_York'),'2026-11-01T05:30:00.000Z');
});
test('invalid dates and empty timezones fail instead of silently rolling over',()=>{
  assert.throws(()=>wallTimeToInstant('2026-02-30T10:00','Asia/Seoul'));
  assert.throws(()=>wallTimeToInstant('2026-09-06T24:00','Asia/Seoul'));
  assert.throws(()=>wallTimeToInstant('2026-09-06T10:00',''));
});
test('date shifting preserves calendar semantics over month and leap boundaries',()=>{
  assert.equal(shiftDate('2028-02-28',1),'2028-02-29');assert.equal(shiftDate('2026-12-31',1),'2027-01-01');
});
const base={id:'event',all_day:false,repeat_weekdays:[],time_zone:'Asia/Seoul',start_at:'2026-09-06T14:00:00Z',end_at:'2026-09-06T15:00:00Z'};
test('event ending at midnight does not occupy the next day',()=>{
  assert.equal(eventsOnDate([base],'2026-09-06','Asia/Seoul').length,1);
  assert.equal(eventsOnDate([base],'2026-09-07','Asia/Seoul').length,0);
});
test('all-day dates remain fixed when profile timezone changes',()=>{
  const event={...base,all_day:true,start_date:'2026-09-06',end_date:'2026-09-08'};
  for(const zone of ['Asia/Seoul','America/Los_Angeles']){
    assert.equal(eventsOnDate([event],'2026-09-06',zone).length,1);
    assert.equal(eventsOnDate([event],'2026-09-07',zone).length,1);
    assert.equal(eventsOnDate([event],'2026-09-08',zone).length,0);
  }
});
test('weekly event remains anchored in event timezone across profile zones',()=>{
  const event={...base,start_at:'2026-09-06T00:00:00Z',end_at:'2026-09-06T01:00:00Z',repeat_weekdays:[0],repeat_until:'2026-09-30'};
  assert.equal(eventsOnDate([event],'2026-09-13','Asia/Seoul').length,1);
  assert.equal(eventsOnDate([event],'2026-09-12','America/Los_Angeles').length,1);
  assert.equal(eventsOnDate([event],'2026-09-13','America/Los_Angeles').length,0);
  assert.equal(eventsOnDate([event],'2026-10-04','Asia/Seoul').length,0);
});
test('multi-day recurring all-day event keeps full inclusive range',()=>{
  const event={...base,all_day:true,start_date:'2026-09-06',end_date:'2026-09-09',repeat_weekdays:[0],repeat_until:'2026-09-30'};
  assert.equal(eventsOnDate([event],'2026-09-14','Asia/Tokyo').length,1);
  assert.equal(eventsOnDate([event],'2026-09-15','Asia/Tokyo').length,1);
  assert.equal(eventsOnDate([event],'2026-09-16','Asia/Tokyo').length,0);
});
test('weekly DST gap skips only missing occurrence',()=>{
  const event={...base,time_zone:'America/New_York',start_at:'2026-03-01T07:30:00Z',end_at:'2026-03-01T08:30:00Z',repeat_weekdays:[0],repeat_until:'2026-03-31'};
  assert.equal(eventsOnDate([event],'2026-03-08','America/New_York').length,0);
  assert.equal(eventsOnDate([event],'2026-03-15','America/New_York').length,1);
});
