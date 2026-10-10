import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBriefingInput,briefingView,feedFacets,classifyListItem,matchingFeedArticleIds,runBriefing} from './tech-feed-briefing.mjs';
const env={TECH_FEED_ENABLED:'true',TECH_FEED_ACCESS_MODE:'self_service',OPENROUTER_API_KEY:'synthetic',OPENROUTER_MODEL:'openrouter/free'};
function article(i,source='host:example.test') {return{id:'id-'+i,title:'AWS release '+i,url:'https://example.test/'+i,excerpt:'AWS release implementation details. '.repeat(20),eligible:true,discovered_at:'2026-09-14T03:00:00Z',category:null,category_method:null,summary_status:'pending',sources:[{value:source,label:source.replace('host:','')} ]};}
function fixture(count=2){
 const snapshot={local_date:'2026-09-14',time_zone:'Asia/Tokyo',articles:Array.from({length:count},(_,i)=>article(i)),prompt:'SecretProject',input_hash:'hash',receiving:true,cache:null,generating:false};
 let calls=0,reservations=0;const completions=[];
 const store={briefingSnapshot:async()=>structuredClone(snapshot),claimBriefing:async(version,hash,ids)=>{assert.equal(hash,'hash');assert.ok(ids.length>=2);return{status:'claimed',lease:'lease'};},reserveBriefing:async()=>{reservations++;return{status:'reserved'};},finishBriefing:async(lease,result,error)=>{
  completions.push({lease,result,error});if(!error)snapshot.cache={result,generated_at:'2026-09-14T04:00:00Z',stale:false};return true;
 }};
 const ask=async(messages,signal,reserve)=>{assert.ok(await reserve());calls++;assert.equal(messages.some(m=>m.content.includes('SecretProject')),false);return{text:JSON.stringify({highlights:[],insights:[{title:'새로운 기능',body:'소개에서 확인한 흐름',study_angle:'구현 관점 비교',source_ids:['id-0','id-1']}]})};};
 return{snapshot,store,ask,completions,get calls(){return calls;},get reservations(){return reservations;}};
}
test('0/1 eligible articles, readonly, paused, cached and active lease never trigger provider or quota',async()=>{
 for(const n of [0,1]){const f=fixture(n);assert.equal((await runBriefing({...f,env,generate:true})).status,'insufficient');assert.equal(f.calls,0);assert.equal(f.reservations,0);}
 const f=fixture();assert.equal((await runBriefing({...f,env})).status,'idle');assert.equal(f.calls,0);
 f.snapshot.receiving=false;assert.equal((await runBriefing({...f,env,generate:true})).status,'paused');assert.equal(f.calls,0);
 f.snapshot.receiving=true;f.snapshot.generating=true;assert.equal((await runBriefing({...f,env,generate:true})).status,'generating');assert.equal(f.reservations,0);
});
test('successful response is cited using server URLs and cached with no second call; internal fields never leak',async()=>{
 const f=fixture();let result=await runBriefing({...f,env,generate:true});assert.equal(result.status,'ready');assert.equal(result.analyzed_count,2);
 assert.deepEqual(result.insights[0].sources.map(x=>x.url),['https://example.test/0','https://example.test/1']);
 assert.deepEqual(Object.keys(result).sort(),['failure_reason','retry_at','can_retry','analyzed_count','categories','eligible_count','generated_at','highlights','insights','local_date','source_count','stale','status','time_zone','topics','total'].sort());
 result=await runBriefing({...f,env,generate:true});assert.equal(result.status,'ready');assert.equal(f.calls,1);assert.equal(f.reservations,1);
});
test('malformed output, unknown citations, forged URLs and provider failure reject whole insight result',async()=>{
 const outputs=[null,{text:'not json'},{text:'{"insights":[]}'},{text:JSON.stringify({highlights:[],insights:[{title:'t',body:'b',study_angle:'s',source_ids:['forged']}]})},{text:JSON.stringify({highlights:[],insights:[{title:'t',body:'b',study_angle:'s',source_ids:['id-0'],url:'https://forged.test'}]})}];
 for(const output of outputs){const f=fixture();f.ask=async(_m,_s,reserve)=>{await reserve();return output;};const result=await runBriefing({...f,env,generate:true});assert.equal(result.status,'unavailable');assert.deepEqual(result.insights,[]);assert.equal(f.completions.at(-1).error,'unavailable');}
});
test('quota, provider configuration and changed receiving are distinct and cannot call provider',async()=>{
 const f=fixture();let provider=0;f.store.reserveBriefing=async()=>({status:'quota_exhausted'});f.ask=async(_m,_s,reserve)=>{if(!await reserve())return{deferred:true};provider++;return null;};
 assert.equal((await runBriefing({...f,env,generate:true})).status,'quota_exhausted');assert.equal(provider,0);
 assert.equal((await runBriefing({...fixture(),env:{...env,OPENROUTER_API_KEY:''},generate:true})).status,'unavailable');
 assert.equal((await runBriefing({...fixture(),env:{...env,TECH_FEED_ENABLED:'false'},generate:true})).status,'paused');
 const g=fixture();g.store.reserveBriefing=async()=>({status:'paused'});g.ask=f.ask;assert.equal((await runBriefing({...g,env,generate:true})).status,'paused');
});
test('aborted/hung provider is bounded and a late result is never persisted as success',async()=>{
 const f=fixture(),controller=new AbortController();f.ask=async(_m,_s,reserve)=>{await reserve();return new Promise(()=>{});};
 const job=runBriefing({...f,env,generate:true,signal:controller.signal});setTimeout(()=>controller.abort(),15);
 const result=await job;assert.equal(result.status,'unavailable');assert.equal(f.completions.some(x=>x.result),false);
});
test('revoked access after provider work hides prior result before return',async()=>{
 const f=fixture(),ask=f.ask;f.ask=async(...args)=>{const out=await ask(...args);f.snapshot.articles=[];f.snapshot.input_hash='changed';return out;};
 f.store.finishBriefing=async()=>false;const result=await runBriefing({...f,env,generate:true});assert.equal(result.status,'unavailable');assert.deepEqual(result.insights,[]);assert.equal(result.total,0);
});
test('malformed cache analysis count is never exposed as a ready DTO',()=>{
 const s=fixture().snapshot;s.cache={generated_at:'2026-09-14T00:00:00Z',stale:false,result:{analyzed_count:'forged',insights:[{title:'t',body:'b',study_angle:'s',source_ids:['id-0']}]}};
 const response=briefingView(s);assert.equal(response.status,'idle');assert.equal(response.analyzed_count,0);assert.deepEqual(response.insights,[]);
});
test('source round-robin is deterministic, 24 max, with serialization budget including escaped metadata',()=>{
 const many=Array.from({length:40},(_,i)=>article(i,i<30?'host:a.test':'host:b.test'));
 for(const a of many){a.title='"\\'.repeat(150);a.excerpt='"\\'.repeat(1000);}
 const input=buildBriefingInput({...fixture().snapshot,articles:many});assert.equal(input.articles.length,24);
 assert.equal(input.articles[0].id.startsWith('id-'),true);assert.ok(input.articles.some(a=>Number(a.id.slice(3))>=30));
 assert.ok(input.messages.reduce((n,m)=>n+m.content.length,0)<=32000);assert.ok(input.articles.every(a=>a.excerpt.length>=160&&a.excerpt.length<=2000));
 const raw=input.messages.map(x=>x.content).join('');assert.doesNotMatch(raw,/https:\/\/example|SecretProject|user_id|email/);
 assert.deepEqual(buildBriefingInput({...fixture().snapshot,articles:[...many].reverse()}).articles,input.articles);
});
test('facets use all visible articles and private exact evidence matches without persisting prompt',()=>{
 const items=Array.from({length:25},(_,i)=>({...article(i),title:i===24?'FluxDB tutorial':'AWS release',excerpt:'Neutral actual introduction. '.repeat(10),sources:[{value:'host:example.test',label:'example.test'}]}));
 const facets=feedFacets({items,prompt:'FluxDB'});assert.equal(facets.total,25);assert.equal(facets.topics.find(x=>x.value==='FluxDB').count,1);assert.equal(facets.sources[0].count,25);
 assert.equal(classifyListItem(items[24],'FluxDB').category,'practice');assert.deepEqual(classifyListItem(items[24],'OtherPrivate').topics.includes('FluxDB'),false);
 const view=briefingView({...fixture().snapshot,articles:items});assert.equal(view.total,25);assert.equal(view.categories.reduce((n,x)=>n+x.count,0),25);
});
test('read without provider configuration reports unavailable before offering the button; cached, insufficient and paused keep their status',async()=>{
 const missing={...env,OPENROUTER_API_KEY:''};
 const f=fixture();assert.equal((await runBriefing({...f,env:missing})).status,'unavailable');assert.equal(f.calls,0);assert.equal(f.reservations,0);
 const g=fixture();assert.equal((await runBriefing({...g,env,generate:true})).status,'ready');assert.equal((await runBriefing({...g,env:missing})).status,'ready');
 assert.equal((await runBriefing({...fixture(1),env:missing})).status,'insufficient');
 const h=fixture();h.snapshot.receiving=false;assert.equal((await runBriefing({...h,env:missing})).status,'paused');
 // A malformed provider setting is a configuration problem, not a crash of the read path.
 assert.equal((await runBriefing({...fixture(),env:{...env,OPENROUTER_MODEL:'bad model'}})).status,'unavailable');
});

test('a briefing refunds the reserved call when the provider gives nothing usable',async()=>{
 const f=fixture();const refunds=[];f.store.refundAiCall=async()=>{refunds.push(1);return true;};
 f.ask=async(_m,_s,reserve)=>{assert.ok(await reserve());return null;};
 assert.equal((await runBriefing({...f,env,generate:true})).status,'unavailable');
 assert.equal(refunds.length,1,'the wasted reservation is returned');
 // A quota refusal never reserved anything, so refunding would create budget.
 const g=fixture();const none=[];g.store.refundAiCall=async()=>{none.push(1);return true;};
 g.store.reserveBriefing=async()=>({status:'quota_exhausted'});
 g.ask=async(_m,_s,reserve)=>{await reserve();return null;};
 assert.equal((await runBriefing({...g,env,generate:true})).status,'quota_exhausted');
 assert.deepEqual(none,[]);
 // A successful generation is charged.
 const h=fixture();const charged=[];h.store.refundAiCall=async()=>{charged.push(1);return true;};
 assert.equal((await runBriefing({...h,env,generate:true})).status,'ready');
 assert.deepEqual(charged,[]);
});

test('a reservation lost to a timeout or abort is refunded like any other wasted call',async()=>{
 // bounded() rejects before the response is ever inspected, so a refund must not
 // depend on reaching the answer check.
 const f=fixture();const refunds=[];f.store.refundAiCall=async()=>{refunds.push(1);return true;};
 f.ask=async(_m,_s,reserve)=>{assert.ok(await reserve());throw Error('cancelled');};
 assert.equal((await runBriefing({...f,env,generate:true})).status,'unavailable');
 assert.equal(refunds.length,1,'a timed-out call still charged the owner');
 // A store failure after a usable answer was already persisted must not refund twice.
 const g=fixture();const none=[];g.store.refundAiCall=async()=>{none.push(1);return true;};
 assert.equal((await runBriefing({...g,env,generate:true})).status,'ready');
 assert.deepEqual(none,[]);
});

test('a roundup title keeps an article out of the briefing sample even with a normal article URL',()=>{
 const roundup={id:'id-roundup',title:'Top AI Blogs Every Software Developer Must Follow in 2026',url:'https://example.test/blog/roundup',excerpt:'x'.repeat(200),eligible:true,discovered_at:'2026-09-14T03:00:00Z',category:null,category_method:null,summary_status:'pending',sources:[{value:'host:example.test',label:'example.test'}]};
 const snapshot={local_date:'2026-09-14',time_zone:'Asia/Tokyo',prompt:'',articles:[article(0),article(1),roundup]};
 const input=buildBriefingInput(snapshot);
 assert.equal(input.articles.some(a=>a.id==='id-roundup'),false);
 assert.equal(input.articles.length,2);
});

test('language counts and filters use every visible original before the 20-item page',()=>{
 const english=Array.from({length:30},(_,i)=>({...article(i),title:'AWS architecture case study '+i,excerpt:'This article explains the architecture and implementation in production.'}));
 const korean=[{...article(30),title:'AWS 아키텍처를 개선한 사례',excerpt:'실제 서비스에서 적용한 구조와 장애 대응 방법을 설명합니다.'},{...article(31),title:'Claude Code로 개발 자동화하기',excerpt:'팀의 실무 구현 방법과 변경 사항을 소개합니다.'}];
 const candidates={items:[...english,...korean],prompt:'AWS'};
 const ids=matchingFeedArticleIds(candidates,null,'ko');
 assert.deepEqual(ids,['id-30','id-31']);
 assert.equal(matchingFeedArticleIds(candidates,'AWS','ko').length,1);
 const facets=feedFacets(candidates);
 assert.equal(facets.languages.find(x=>x.value==='ko').count,2);
 assert.equal(facets.languages.find(x=>x.value==='en').count,30);
 assert.equal(classifyListItem(korean[0]).original_language,'ko');
});


test('provider errors are classified safely and only fast gateway failures permit automatic retry',async()=>{
 const {briefingAiFailure,briefingRetryAfter}=await import('./tech-feed-briefing.mjs');
 const cases=[[{code:'upstream',status:502},'provider_unavailable',true],[{code:'upstream',status:503},'provider_unavailable',true],[{code:'upstream',status:504},'provider_unavailable',true],[{code:'rate_limit',status:429},'rate_limited',false],[{code:'upstream',status:401},'configuration_error',false],[{code:'timeout'},'timeout',false],[{code:'invalid_response'},'invalid_response',false],[{code:'network'},'network_error',false]];
 for(const [cause,reason,retry]of cases){const out=briefingAiFailure({...cause,message:'private raw body',token:'synthetic-secret'});assert.equal(out.failure_reason,reason);assert.equal(out.automatic_retry,retry);assert.equal(JSON.stringify(out).includes('synthetic-secret'),false);}
 const now=Date.parse('2026-10-10T00:00:00Z');
 assert.equal(briefingRetryAfter('180',now),180000);assert.equal(briefingRetryAfter('Sat, 10 Oct 2026 00:02:00 GMT',now),120000);
 for(const value of [null,'invalid','-1','0','Fri, 09 Oct 2026 00:00:00 GMT'])assert.equal(briefingRetryAfter(value,now),null);
 assert.equal(briefingRetryAfter('999999',now),3600000);
 assert.equal(briefingAiFailure({code:'upstream',status:503,retry_after_ms:180000}).automatic_retry,false);
});
function retryFixture(){
 const f=fixture(),state={refunds:0,retries:0,completed:[]};f.store.retryBriefing=async()=>{state.refunds++;state.retries++;return{status:'retry'};};
 f.store.completeBriefing=async(lease,result,error,_signal,attempt,hint)=>{
  state.completed.push({result,error,attempt,hint});
  if(error){if(f.reservations>state.refunds)state.refunds++;f.snapshot.last_error='unavailable';f.snapshot.failure_reason=error;f.snapshot.retry_at='2099-10-10T00:01:00Z';return true;}
  return f.store.finishBriefing(lease,result,error);
 };
 return{f,state};
}
test('502 retries once in the same lease, reserves each call, and stores the successful answer',async()=>{
 const {briefingAiFailure}=await import('./tech-feed-briefing.mjs');const{f,state}=retryFixture(),success=f.ask;let calls=0;
 f.ask=async(...args)=>{if(++calls===1){assert.ok(await args[2]());return{failure:briefingAiFailure({code:'upstream',status:502})};}return success(...args);};
 const result=await runBriefing({...f,env,generate:true});assert.equal(result.status,'ready');assert.equal(calls,2);assert.equal(f.reservations,2);assert.equal(state.refunds,1);assert.equal(state.retries,1);assert.equal(state.completed[0].attempt,1);assert.equal(result.failure_reason,null);
});
test('two gateway failures refund both reservations, stop retrying, and report the persisted cooldown on read',async()=>{
 const {briefingAiFailure}=await import('./tech-feed-briefing.mjs');const{f,state}=retryFixture();let calls=0;
 f.ask=async(_m,_s,reserve)=>{assert.ok(await reserve());calls++;return{failure:briefingAiFailure({code:'upstream',status:502})};};
 const out=await runBriefing({...f,env,generate:true});assert.equal(out.status,'unavailable');assert.equal(out.failure_reason,'provider_unavailable');assert.equal(out.can_retry,true);assert.equal(calls,2);assert.equal(state.refunds,2);assert.equal(state.retries,1);
 const read=await runBriefing({...f,env});assert.equal(read.retry_at,out.retry_at);assert.equal(read.failure_reason,out.failure_reason);assert.equal(calls,2);
});
test('429, authentication, malformed answers, timeout, network and Retry-After 503 do not automatically call again',async()=>{
 const {briefingAiFailure}=await import('./tech-feed-briefing.mjs');
 for(const cause of [{code:'rate_limit',status:429},{code:'upstream',status:401},{code:'invalid_response'},{code:'timeout'},{code:'network'},{code:'upstream',status:503,retry_after_ms:180000}]){
  const{f,state}=retryFixture();let calls=0;f.ask=async(_m,_s,reserve)=>{await reserve();calls++;return{failure:briefingAiFailure(cause)};};
  const out=await runBriefing({...f,env,generate:true});assert.equal(calls,1);assert.equal(state.retries,0);assert.equal(state.refunds,1);assert.equal(out.failure_reason,briefingAiFailure(cause).failure_reason);assert.equal(out.can_retry,cause.status!==401);
  if(cause.retry_after_ms)assert.equal(state.completed[0].hint,180000);
 }
});
test('slow gateway failures and cancellation during backoff cannot start another provider call',async()=>{
 const {briefingAiFailure}=await import('./tech-feed-briefing.mjs');
 const{f,state}=retryFixture();const realNow=Date.now;let clock=realNow();Date.now=()=>clock;
 try{
  f.ask=async(_m,_s,reserve)=>{await reserve();clock+=5001;return{failure:briefingAiFailure({code:'upstream',status:502})};};
  await runBriefing({...f,env,generate:true});assert.equal(state.retries,0);
 }finally{Date.now=realNow;}
 const g=retryFixture(),controller=new AbortController();let calls=0;
 g.f.ask=async(_m,_s,reserve)=>{await reserve();calls++;setTimeout(()=>controller.abort(),20);return{failure:briefingAiFailure({code:'upstream',status:502})};};
 await runBriefing({...g.f,env,generate:true,signal:controller.signal});assert.equal(calls,1);assert.equal(g.state.refunds,1);assert.equal(g.state.completed.at(-1).result,null);
});
