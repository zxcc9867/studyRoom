import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoachingService, parseCoaching, summarizeStudy, ruleCoaching } from './coaching.mjs';
import { createHandler } from '../../api/study-coaching.mjs';
import { createCoachingStore } from './coaching-store.mjs';
const todoId = '00000000-0000-4000-8000-000000000001';
const coachingId = '00000000-0000-4000-8000-000000000002';
const input = { todo: { title: '자료 복습', is_completed: false }, sessions: [{local_date:'2026-09-01',status:'completed',duration_seconds:600}], todos: [{is_completed:false}], reflections: [] };
function fixture(overrides = {}) {
  const calls = [];
  const store = { load: async () => input, reserveAiCall: async () => true, mutate: async (payload) => { calls.push(payload); return payload.operation === 'reserve' ? {status:'reserved',id:coachingId,lease:'lease'} : {status:'saved'}; }, ...overrides };
  return { store, calls };
}
test('summary counts records without equating todo check with study', () => {
  const summary = summarizeStudy(input);
  assert.equal(summary.recordedStudyDays,1);
  assert.match(ruleCoaching(summary,'복습').evidence[1], /아니에요/);
  assert.match(ruleCoaching(summary,'복습').evidence[2], /판단하지/);
});
test('free AI unavailable returns saved deterministic coaching', async () => {
  const {store,calls} = fixture();
  const result = await createCoachingService({store,env:{}})('owner',{action:'generate',todoId});
  assert.equal(result.source,'rules');
  assert.equal(calls[1].operation,'finish');
});
test('shared career budget exhaustion prevents legacy model calls and preserves rules', async () => {
  const {store} = fixture({reserveAiCall: async () => false});
  const result = await createCoachingService({store, generate: () => assert.fail('must not call model')})('owner',{action:'generate',todoId});
  assert.equal(result.source,'rules');
});
test('missing model configuration does not reserve shared quota', async () => {
  const {store} = fixture({reserveAiCall: () => assert.fail('no actual AI call')});
  assert.equal((await createCoachingService({store,env:{}})('owner',{action:'generate',todoId})).source,'rules');
});
test('shared quota RPC uses the authenticated caller and accepts only true', async () => {
  for (const allowed of [true,false,{},null]) {
    const store=createCoachingStore({env:{SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public'},token:'test',fetchImpl:async(url,options)=>{
      assert.ok(url.endsWith('/rpc/coach_reserve_ai'));
      assert.equal(options.headers.Authorization,'Bearer test');
      assert.equal(options.body,'{}');
      return Response.json(allowed);
    }});
    assert.equal(await store.reserveAiCall(),allowed===true);
  }
});
test('AI receives only aggregate and selected title, fixed evidence retained', async () => {
  const {store} = fixture();
  const result = await createCoachingService({store,generate:async ({messages}) => {
    const data = JSON.parse(messages[1].content);
    assert.deepEqual(Object.keys(data),['todoTitle','summary']);
    assert.equal(JSON.stringify(data).includes('owner'),false);
    return {text:JSON.stringify({firstAction:'자료의 첫 단락을 읽고 핵심 단어를 적어보세요.'})};
  }})('owner',{action:'generate',todoId});
  assert.equal(result.source,'ai');
  assert.match(result.firstAction,/^10분/);
});
test('invalid model JSON, extra fields and numeric assertions fall back', async () => {
  for (const text of ['not json','{"firstAction":"지난 28일 실패했어요"}','{"firstAction":"자료를 먼저 펼쳐보세요.","evidence":["거짓"]}']) {
    const {store} = fixture();
    assert.equal((await createCoachingService({store,generate:async()=>({text})})('owner',{action:'generate',todoId})).source,'rules');
  }
  assert.throws(()=>parseCoaching('{"firstAction":"의지가 부족하니 공부하세요"}',{}));
});
test('quota and pending response never call AI', async () => {
  for (const [status,code] of [['limit',429],['pending',409]]) {
    const {store} = fixture({mutate:async()=>({status})});
    await assert.rejects(createCoachingService({store,generate:()=>assert.fail()})('owner',{action:'generate',todoId}),{status:code});
  }
});
test('missing or completed owned todo cannot generate', async () => {
  for (const todo of [undefined,{...input.todo,is_completed:true}]) {
    const {store} = fixture({load:async()=>({...input,todo})});
    await assert.rejects(createCoachingService({store})('owner',{action:'generate',todoId}),{status:404});
  }
});
test('user override rejected and feedback ownership required', async () => {
  const {store} = fixture({mutate:async()=>({status:'missing'})});
  const service = createCoachingService({store});
  await assert.rejects(service('owner',{action:'generate',todoId,userId:'victim'}),{status:400});
  await assert.rejects(service('owner',{action:'feedback',coachingId,feedback:'helpful'}),{status:404});
});
test('failed save does not report successful generation', async () => {
  const {store} = fixture({mutate:async(p)=>p.operation==='reserve'?{status:'reserved',id:coachingId,lease:'lease'}:{status:'missing'}});
  await assert.rejects(createCoachingService({store,env:{}})('owner',{action:'generate',todoId}),{status:503});
});
test('signed cache reused without AI and tampered cache becomes deterministic', async () => {
  const {store,calls} = fixture();
  const env={OPENROUTER_API_KEY:'test-secret'};
  await createCoachingService({store,env,generate:async()=>({text:'{"firstAction":"자료의 첫 단락을 읽고 한 줄로 적어보세요."}'})})('owner',{action:'generate',todoId});
  const persisted=Object.fromEntries(Object.entries(calls[1].result).reverse());
  const cached=fixture({mutate:async()=>({status:'cached',id:coachingId,result:persisted})}).store;
  const result=await createCoachingService({store:cached,env,generate:()=>assert.fail()})('owner',{action:'generate',todoId});
  assert.equal(result.source,'ai');
  assert.equal(result.signature,undefined);
  persisted.firstAction='위조된 응답';
  assert.equal((await createCoachingService({store:cached,env,generate:()=>assert.fail()})('owner',{action:'generate',todoId})).source,'rules');
});
function response() { return {setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}}; }
test('API rejects unauthenticated requests and malformed JSON', async () => {
  const handler = createHandler({fetchImpl:()=>assert.fail()});
  const res = response();
  await handler({method:'POST',headers:{},body:{}},res);
  assert.equal(res.code,401);
  await handler({method:'POST',headers:{authorization:'Bearer test'},body:'{'},res);
  assert.equal(res.code,400);
});
test('API rejects anonymous and expired auth before loading records', async () => {
  for (const auth of [new Response('{}',{status:401}),Response.json({id:'owner',is_anonymous:true})]) {
    const handler = createHandler({env:{SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public'},fetchImpl:async()=>auth});
    const res=response();
    await handler({method:'POST',headers:{authorization:'Bearer test'},body:{action:'generate',todoId}},res);
    assert.equal(res.code,401);
  }
});
test('store scopes all rows to owner and local 28 dates, excluding future todos', async () => {
  const urls=[];
  const store=createCoachingStore({env:{SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public'},token:'test',fetchImpl:async(url)=>{
    urls.push(new URL(url));
    if(url.includes('/profiles?')) return Response.json([{time_zone:'Asia/Tokyo'}]);
    return Response.json([]);
  }});
  const result=await store.load('owner',todoId,'2026-09-06T15:10:00.000Z');
  assert.equal(result.todo,undefined);
  for(const url of urls) assert.equal(url.searchParams.get('user_id'),'eq.owner');
  const selected=urls.find((url)=>url.searchParams.has('id'));
  assert.equal(selected.searchParams.get('local_date'),'lte.2026-09-07');
  const sessions=urls.find((url)=>url.pathname.endsWith('/study_sessions'));
  assert.equal(sessions.searchParams.get('or'),'(and(local_date.gte.2026-08-11,local_date.lte.2026-09-07))');
  assert.equal(urls.some((url)=>url.searchParams.get('select')?.includes('note')),false);
});
test('history at cap fails instead of silently summarizing partial data', async () => {
  const store=createCoachingStore({env:{SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public'},token:'test',fetchImpl:async()=>Response.json(Array(1000).fill({}))});
  await assert.rejects(store.load('owner',todoId,'2026-09-06T15:10:00Z'),{status:503});
});
