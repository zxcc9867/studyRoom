import test from 'node:test';
import assert from 'node:assert/strict';
const api = await import('../src/learningContinuity.mjs').catch(() => ({}));
const id = '00000000-0000-4000-8000-000000000201';
const sid = '00000000-0000-4000-8000-000000000301';
const rid = '00000000-0000-4000-8000-000000000401';
const stamp = '2026-11-05T01:00:00+00:00';
const input = {focusScore:null,energyScore:null,interruptionReason:null,note:'Learned joins',nextAction:'Next query',contextTodoId:id,resourceUrl:'https://example.com/lesson',resourcePosition:'p. 2'};
const result = {reflectionId:rid,sessionId:sid,todoId:id,todoTitle:'SQL',localDate:'2026-11-05',startedAt:'2026-11-05T00:00:00Z',endedAt:stamp,note:'Learned joins',nextAction:'Next query',resourceUrl:'https://example.com/lesson',resourcePosition:'p. 2',focusScore:null,energyScore:null,interruptionReason:null,updatedAt:stamp};
const bookmark = {reflectionId:rid,sessionId:sid,todoId:id,todoTitle:'SQL',localDate:'2026-11-05',startTime:'10:00:00',endTime:'11:00:00',todoUpdatedAt:stamp,updatedAt:stamp,nextAction:'Next query',resourceUrl:'https://example.com/lesson',resourcePosition:'p. 2'};
const wire = {focus_score:null,energy_score:null,interruption_reason:null,note:'Learned joins',next_action:'Next query',context_todo_id:id,resource_url:'https://example.com/lesson',resource_position:'p. 2'};
const completedSession = {id:sid,user_id:'00000000-0000-4000-8000-000000000101',status:'completed',local_date:'2026-11-05',started_at:'2026-11-05T00:00:00Z',ended_at:stamp,duration_seconds:3600,created_at:'2026-11-05T00:00:00Z',updated_at:stamp,paused_at:null,paused_seconds:0,lease_expires_at:'2026-11-05T02:00:00Z',lease_warning_sent_at:null};
function transport(name, args, data, error=null) {
  let calls=0;
  return {rpc(actual, payload) {
    calls++; assert.equal(calls,1); assert.equal(actual,name); assert.deepEqual(payload,args);
    return {abortSignal(signal) { assert.ok(signal instanceof AbortSignal); return Promise.resolve({data,error}); }};
  }};
}
function fn(name) { assert.equal(typeof api[name],'function',`${name} implementation missing`); return api[name]; }
test('snapshot validates committed camelCase fields and supplies bounded abort signal', async()=>{
  const data={version:1,bookmarks:[bookmark],results:[result]};
  assert.deepEqual(await fn('loadLearningContinuity')(transport('learning_continuity_snapshot',{p_study_date:'2026-11-05'},data),'2026-11-05'),data);
});
test('completion translates payload once and returns server session plus reflection without fake scores',async()=>{
  const data={version:1,session:completedSession,reflection:result};
  const client=transport('complete_learning_session',{p_session_id:sid,p_excluded_seconds:0,p_completed_todo_ids:[id],p_reflection:wire},data);
  assert.deepEqual(await fn('completeLearningSession')(client,{sessionId:sid,excludedSeconds:0,completedTodoIds:[id],reflection:input}),data);
});
test('save forwards optimistic edit revision; bookmark edit preserves server result',async()=>{
  assert.deepEqual(await fn('saveLearningReflection')(transport('save_learning_reflection',{p_session_id:sid,p_reflection:wire,p_expected_updated_at:stamp},result),{sessionId:sid,reflection:input,expectedUpdatedAt:stamp}),result);
  assert.deepEqual(await fn('updateLearningBookmark')(transport('update_learning_bookmark',{p_reflection_id:rid,p_expected_updated_at:stamp,p_next_action:'Next query',p_resource_url:'https://example.com/lesson',p_resource_position:'p. 2'},result),{reflectionId:rid,expectedUpdatedAt:stamp,nextAction:input.nextAction,resourceUrl:input.resourceUrl,resourcePosition:input.resourcePosition}),result);
});
test('prepare sends expected date/revision, never a client chosen target date',async()=>{
  const data={version:1,todoId:id,localDate:'2026-11-05',startTime:null,endTime:null,updatedAt:stamp};
  assert.deepEqual(await fn('prepareLearningTodo')(transport('prepare_learning_todo',{p_todo_id:id,p_expected_local_date:'2026-11-04',p_expected_updated_at:stamp},data),{todoId:id,expectedLocalDate:'2026-11-04',expectedUpdatedAt:stamp}),data);
});
test('schema absence and malformed server data never become empty ready data',async()=>{
  const load=fn('loadLearningContinuity');
  await assert.rejects(()=>load(transport('learning_continuity_snapshot',{p_study_date:'2026-11-05'},null,{code:'PGRST202',message:'function missing'}),'2026-11-05'),/unavailable/i);
  for(const data of [null,{version:1,bookmarks:[],results:[{...result,focusScore:0}]},{version:1,bookmarks:[{...bookmark,resourceUrl:'javascript:alert(1)'}],results:[]},{version:1,bookmarks:[],results:[{...result,endedAt:null}]},{version:1,bookmarks:[],results:[{...result,resourceUrl:undefined}]}]) {
    await assert.rejects(()=>load(transport('learning_continuity_snapshot',{p_study_date:'2026-11-05'},data),'2026-11-05'),/invalid/i);
  }
});
test('a hung transport times out without fabricating committed data',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let signal;
  const request=fn('loadLearningContinuity')({rpc(){return {abortSignal(value){signal=value;return new Promise(()=>{});}};}},'2026-11-05');
  t.mock.timers.tick(15_000);
  await assert.rejects(()=>request,/timed out.*unknown/i);
  assert.equal(signal.aborted,true);
});
test('input validation rejects unsafe URL, oversized values, fake scores and impossible dates before transport',async()=>{
  const client={rpc(){assert.fail('invalid input reached transport');}};
  for(const reflection of [{...input,focusScore:0},{...input,focusScore:'3'},{...input,resourceUrl:'https://user:pass@example.com'},{...input,resourceUrl:'file:///a'},{...input,resourcePosition:'x'.repeat(161)},{...input,note:'x'.repeat(501)}]) await assert.rejects(()=>fn('saveLearningReflection')(client,{sessionId:sid,reflection}),/invalid/i);
  await assert.rejects(()=>fn('loadLearningContinuity')(client,'2026-02-30'),/invalid/i);
});
test('pre-aborted and in-flight aborted requests reject even if transport settles late',async()=>{
  const abort=new AbortController(); abort.abort();
  await assert.rejects(()=>fn('loadLearningContinuity')({rpc(){assert.fail('aborted request started');}},'2026-11-05',{signal:abort.signal}),{name:'AbortError'});
  const live=new AbortController(); let started;
  const began=new Promise(resolve=>{started=resolve;});
  const request=fn('loadLearningContinuity')({rpc(){return {abortSignal(signal){assert.notEqual(signal,live.signal);started();return new Promise(()=>{});}};}},'2026-11-05',{signal:live.signal});
  await began; live.abort(); await assert.rejects(()=>request,{name:'AbortError'});
});
test('mismatched committed identities and falsely active completion are rejected',async()=>{
  await assert.rejects(()=>fn('saveLearningReflection')(transport('save_learning_reflection',{p_session_id:sid,p_reflection:wire,p_expected_updated_at:null},{...result,sessionId:id}),{sessionId:sid,reflection:input}),/invalid/i);
  const data={version:1,session:{...completedSession,status:'active',ended_at:null,duration_seconds:0},reflection:result};
  await assert.rejects(()=>fn('completeLearningSession')(transport('complete_learning_session',{p_session_id:sid,p_excluded_seconds:0,p_completed_todo_ids:[],p_reflection:wire},data),{sessionId:sid,excludedSeconds:0,completedTodoIds:[],reflection:input}),/invalid/i);
});
test('completion rejects incomplete session state instead of breaking downstream lifecycle consumers',async()=>{
  const data={version:1,session:{...completedSession,paused_seconds:undefined},reflection:result};
  await assert.rejects(()=>fn('completeLearningSession')(transport('complete_learning_session',{p_session_id:sid,p_excluded_seconds:0,p_completed_todo_ids:[],p_reflection:wire},data),{sessionId:sid,excludedSeconds:0,completedTodoIds:[],reflection:input}),/invalid/i);
});
test('prepare lock contention is a retryable error without a hidden second mutation',async()=>{
  const input=Object.freeze({todoId:id,expectedLocalDate:'2026-11-04',expectedUpdatedAt:stamp});
  await assert.rejects(()=>fn('prepareLearningTodo')(transport('prepare_learning_todo',{p_todo_id:id,p_expected_local_date:'2026-11-04',p_expected_updated_at:stamp},null,{code:'55P03',message:'could not obtain lock'}),input),error=>error.code==='55P03');
  assert.deepEqual(input,{todoId:id,expectedLocalDate:'2026-11-04',expectedUpdatedAt:stamp});
});
