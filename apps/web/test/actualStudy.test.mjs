import test from 'node:test';
import assert from 'node:assert/strict';
import { formatActualDuration, formatActualInterval, resolveCurrentTodo, getActualProgress, reconcileCameraCounter, createActualStudyFlow, actualStudyErrorMessage, loadPlanningAdherence, firstStartDelayMinutes } from '../src/actualStudy.mjs';

const preview = (overrides = {}) => ({ version:1, action:'start', session_id:null, todo_ids:['a'], current_todo_id:'a', excluded_seconds:0, proposed_at:'2026-09-21T09:00:00Z', expires_at:'2026-09-21T09:01:00Z', time_zone:'Asia/Tokyo', remaining_seconds:7200, revision:'one', changes:[], cascade_complete:true, blocking_error:null, ...overrides });

test('first-start delay never uses resume or unknown forward-tracking timestamps', () => {
  const todo={original_start_at:'2026-09-21T07:00:00Z',first_started_at:'2026-09-21T09:00:00Z',open_started_at:'2026-09-21T11:00:00Z',evaluation_eligible:true,unknown_allocation:false};
  assert.equal(firstStartDelayMinutes(todo),120);
  assert.equal(firstStartDelayMinutes({...todo,first_started_at:null,first_tracked_at:'2026-09-21T09:00:00Z',unknown_allocation:true}),null);
  assert.equal(firstStartDelayMinutes({...todo,evaluation_eligible:false}),null);
});
test('hydration uses receipt elapsed rather than clock-skewed server time', () => {
  assert.equal(getActualProgress({known_seconds:1800,target_seconds:7200,open_started_at:'2026-09-21T09:00:00Z'},{server_now:'2026-09-21T09:00:00Z',received_at_ms:Date.parse('2026-09-21T10:00:00Z'),excluded_seconds:0},Date.parse('2026-09-21T10:00:05Z'),0).known,1805);
});

test('lease cutoff uses server lease duration even when client clock is ahead', () => {
 const todo={known_seconds:1800,target_seconds:7200,open_started_at:'2026-09-21T09:00:00Z'};
 const tracking={server_now:'2026-09-21T09:00:00Z',received_at_ms:Date.parse('2026-09-21T10:00:00Z'),excluded_seconds:0};
 assert.equal(getActualProgress(todo,tracking,Date.parse('2026-09-21T10:02:00Z'),0,'2026-09-21T09:01:00Z').known,1860);
});
test('duration and midnight interval retain seconds and both local dates', () => {
  assert.equal(formatActualDuration(5432), '1시간 30분 32초');
  assert.equal(formatActualDuration(0), '0초');
  assert.equal(formatActualInterval({local_date:'2026-09-21',end_date:'2026-09-22',start_time:'23:30:00',end_time:'01:00:00'}), '2026.09.21 23:30 → 2026.09.22 01:00');
});
test('single selection focuses automatically but multiple require explicit selected radio', () => {
  assert.equal(resolveCurrentTodo(['a'],null),'a');
  assert.equal(resolveCurrentTodo(['a','b'],null),null);
  assert.equal(resolveCurrentTodo(['a','b'],'b'),'b');
  assert.equal(resolveCurrentTodo(['a','b'],'removed'),null);
});
test('known progress advances only open interval, subtracts pending exclusion once, and pauses', () => {
  const todo={known_seconds:1800,target_seconds:7200,open_started_at:'2026-09-21T09:00:00Z'};
  assert.deepEqual(getActualProgress(todo,{server_now:'2026-09-21T09:00:00Z',excluded_seconds:60},Date.parse('2026-09-21T09:01:00Z'),80),{known:1840,remaining:5360});
  assert.deepEqual(getActualProgress({...todo,open_started_at:null},{server_now:'2026-09-21T09:00:00Z',excluded_seconds:80},Date.parse('2026-09-21T10:00:00Z'),80),{known:1800,remaining:5400});
  assert.equal(getActualProgress({...todo,target_seconds:null},{server_now:'2026-09-21T09:00:00Z',excluded_seconds:0},Date.parse('2026-09-21T09:00:00Z'),0).remaining,null);
});
test('camera hydration is monotonic, idempotent and does not double-count local absence', () => {
  assert.equal(reconcileCameraCounter(0,0,60),60);
  assert.equal(reconcileCameraCounter(0,20,60,true),60);
  assert.equal(reconcileCameraCounter(60,20,80),60);
  assert.equal(reconcileCameraCounter(60,20,80),60);
  assert.equal(reconcileCameraCounter(60,20,70),60);
  assert.equal(reconcileCameraCounter(60,20,100),80);
});
test('preview cancellation requires no write and unrepresentable schedule blocks confirmation', async () => {
  const calls=[];
  const flow=createActualStudyFlow({rpc:async(name)=>{calls.push(name);return preview({cascade_complete:false,blocking_error:'UNREPRESENTABLE_SCHEDULE'});}});
  await assert.rejects(flow.prepare({action:'start',todoIds:['a'],currentTodoId:'a',sessionId:null,excludedSeconds:0}),/시간표/);
  assert.deepEqual(calls,['preview_actual_study_action']);
  assert.match(actualStudyErrorMessage('UNREPRESENTABLE_SCHEDULE'),/일정/);
});
test('confirmation transport retry reuses exact preview and request id even after expiry', async () => {
  let tries=0, now=Date.parse('2026-09-21T09:00:05Z'); const calls=[];
  const flow=createActualStudyFlow({now:()=>now,uuid:()=> 'request-one',rpc:async(name,args)=>{calls.push([name,args]);if(name==='preview_actual_study_action')return preview();if(++tries===1)throw new TypeError('network lost');return {session:{id:'session'},tracking:{todos:[]}};}});
  const intent=await flow.prepare({action:'start',todoIds:['a'],currentTodoId:'a',excludedSeconds:0});
  await assert.rejects(flow.confirm(intent,0),/network lost/);
  now+=120000;
  assert.equal((await flow.confirm(intent,30)).kind,'committed');
  assert.deepEqual(calls[1],calls[2]);
  assert.equal(calls.length,3);
});
test('stale preview and newly accrued camera exclusion return fresh intent for renewed review', async () => {
  let ids=0;const calls=[];
  const flow=createActualStudyFlow({now:()=>Date.parse('2026-09-21T09:00:05Z'),uuid:()=>String(++ids),rpc:async(name,args)=>{calls.push([name,args]);if(name==='confirm_actual_study_action')throw {message:'ACTUAL_STUDY_STALE_PREVIEW',code:'P0001'};return preview({excluded_seconds:args.p_excluded_seconds});}});
  const original=await flow.prepare({action:'switch',sessionId:'s',todoIds:['a'],currentTodoId:'a',excludedSeconds:10});
  const refreshed=await flow.confirm(original,20);
  assert.equal(refreshed.kind,'review');assert.equal(calls.length,2);assert.equal(refreshed.intent.preview.excluded_seconds,20);
  assert.notEqual(refreshed.intent.requestId,original.requestId);
  const stale=await flow.confirm(refreshed.intent,20);
  assert.equal(stale.kind,'review');assert.equal(calls.length,4);
});
test('definitive permission errors remain cancellable rather than an uncertain transport retry', async () => {
 const flow=createActualStudyFlow({now:()=>Date.parse('2026-09-21T09:00:05Z'),uuid:()=> 'permission',rpc:async name=>{if(name==='preview_actual_study_action')return preview();throw {code:'PGRST301',message:'permission denied'};}});
 const intent=await flow.prepare({action:'start',todoIds:['a'],currentTodoId:'a',excludedSeconds:0});
 await assert.rejects(flow.confirm(intent,0));
 assert.equal(intent.uncertain,false);
});
test('planning report uses inclusive chosen range without reconstructing excluded historical plans', async () => {
  const calls=[];const dto={scheduled_count:1,started_count:1,on_time_count:0,on_time_ratio:0,adjustment_count:2,unstarted_count:0,plans:[{todo_id:'a',title:'Focus',original_start_at:'2026-09-21T07:00:00Z',first_started_at:'2026-09-21T09:00:00Z',delay_minutes:120,adjustment_count:2,is_unstarted:false}]};
  const client={rpc(name,args){calls.push([name,args]);return {abortSignal:async()=>({data:dto,error:null})};}};
  assert.deepEqual(await loadPlanningAdherence(client,{startDate:'2026-09-21',endDate:'2026-09-27'}),dto);
  assert.deepEqual(calls,[['get_actual_study_report',{p_start_date:'2026-09-21',p_end_date:'2026-09-27'}]]);
});
