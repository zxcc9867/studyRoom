import test from 'node:test';
import assert from 'node:assert/strict';
import {runBriefing,briefingView,buildBriefingInput} from './tech-feed-briefing.mjs';

const env={TECH_FEED_ENABLED:'true',OPENROUTER_API_KEY:'synthetic',OPENROUTER_MODEL:'openrouter/free'};
const insight={title:'오늘의 변화',body:'소개에 나온 구현 이야기',study_angle:'설계 비교',source_ids:['a']};
const highlight={article_id:'b',reason:'실제 장애 복구 절차를 설명합니다.',learning:'타임아웃과 재시도의 설계 기준'};
function fixture(highlights=[highlight]){
 const snapshot={local_date:'2026-09-21',time_zone:'Asia/Tokyo',receiving:true,input_hash:'hash',prompt:'AWS SecretProject',articles:['a','b'].map(id=>({id,title:id==='b'?'AWS 장애 복구 설계':'새 도구 소개',url:'https://example.com/'+id,excerpt:'실제 구현과 설계 선택을 설명하는 충분한 기술 소개입니다. '.repeat(10),eligible:true,discovered_at:'2026-09-21T02:00:00Z',sources:[{value:'host:example.com',label:'example.com'}]}))};
 let calls=0,saved;
 const store={briefingSnapshot:async()=>structuredClone(snapshot),claimBriefing:async()=>({status:'claimed',lease:'l'}),reserveBriefing:async()=>({status:'reserved'}),finishBriefing:async(_l,result,error)=>{if(!error){saved=result;snapshot.cache={result,generated_at:'2026-09-21T03:00:00Z',stale:false};}return true;}};
 const ask=async(_messages,_signal,reserve)=>{assert.ok(await reserve());calls++;return{text:JSON.stringify({insights:[insight],highlights})};};
 return{snapshot,store,ask,get calls(){return calls;},get saved(){return saved;}};
}
test('one generation stores ranked picks and themes together; reuse makes no second AI call',async()=>{
 const f=fixture();const result=await runBriefing({...f,env,generate:true});
 assert.equal(result.status,'ready');assert.equal(result.highlights[0].source.id,'b');
 assert.equal(result.highlights[0].source.url,'https://example.com/b');assert.equal(result.highlights[0].source.title,'AWS 장애 복구 설계');
 assert.equal(result.highlights[0].reason,highlight.reason);assert.equal(f.saved.highlights.length,1);
 await runBriefing({...f,env,generate:true});assert.equal(f.calls,1);
});
test('no qualifying picks is a valid outcome, not an invented recommendation',async()=>{
 const f=fixture([]);const result=await runBriefing({...f,env,generate:true});assert.equal(result.status,'ready');assert.deepEqual(result.highlights,[]);
});
test('forged, repeated, oversized and URL-bearing picks cannot enter the response',async()=>{
 for(const picks of [[{...highlight,article_id:'unknown'}],[highlight,highlight],[{...highlight,url:'https://forged.test'}],Array.from({length:4},()=>highlight),[{...highlight,reason:'x'.repeat(401)}]]){
  const result=await runBriefing({...fixture(picks),env,generate:true});assert.equal(result.status,'unavailable');assert.deepEqual(result.highlights,[]);
 }
});
test('revoked recommendation evidence hides the complete cached result',()=>{
 const f=fixture();f.snapshot.cache={result:{insights:[insight],highlights:[highlight],analyzed_count:2},generated_at:'2026-09-21T03:00:00Z'};
 f.snapshot.articles[1].eligible=false;const result=briefingView(f.snapshot);assert.deepEqual(result.highlights,[]);assert.deepEqual(result.insights,[]);
});
test('interest affinity is a boolean based on evidence; private prompt is not sent to AI',()=>{
 const input=buildBriefingInput(fixture().snapshot);const data=JSON.parse(input.messages[1].content);
 assert.equal(data.articles.find(a=>a.id==='b').interest_match,true);assert.equal(data.articles.find(a=>a.id==='a').interest_match,false);
 assert.doesNotMatch(JSON.stringify(input.messages),/SecretProject|https:\/\/example/);
});

test('the complete JSON example in the prompt is accepted by the actual response parser',async()=>{
 const f=fixture();
 const ask=async(messages,_signal,reserve)=>{
  const example=messages[0].content.match(/Return JSON only: (.+)\n/);
  assert.ok(example,'one complete JSON example must include both root fields');
  const answer=JSON.parse(example[1]);
  assert.deepEqual(Object.keys(answer).sort(),['highlights','insights']);
  answer.insights[0].source_ids=['a'];answer.highlights[0].article_id='b';
  assert.ok(await reserve());return{text:JSON.stringify(answer)};
 };
 const result=await runBriefing({...f,ask,env,generate:true});
 assert.equal(result.status,'ready');assert.equal(result.highlights[0].source.id,'b');
});

test('malformed cached picks are rejected even when enough other eligible evidence remains',()=>{
 for(const picks of [false,null,'',{bad:true},[{...highlight,article_id:'revoked'}],[highlight,highlight]]){
  const f=fixture();f.snapshot.articles.push({...f.snapshot.articles[0],id:'c'});
  f.snapshot.cache={result:{insights:[insight],highlights:picks,analyzed_count:2},generated_at:'2026-09-21T03:00:00Z'};
  const result=briefingView(f.snapshot);assert.deepEqual(result.insights,[]);assert.deepEqual(result.highlights,[]);
 }
});

test('revoked highlight ID is rejected independently of the cached sample-size guard',()=>{
 const f=fixture();f.snapshot.articles.push({...f.snapshot.articles[0],id:'c'});
 f.snapshot.articles[1].eligible=false;
 f.snapshot.cache={result:{insights:[insight],highlights:[highlight],analyzed_count:2},generated_at:'2026-09-21T03:00:00Z'};
 const result=briefingView(f.snapshot);assert.equal(result.eligible_count,2);assert.deepEqual(result.highlights,[]);assert.deepEqual(result.insights,[]);
});
