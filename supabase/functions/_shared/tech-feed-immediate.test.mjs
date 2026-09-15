import test from 'node:test';
import assert from 'node:assert/strict';
import {runSearchWorker} from './tech-feed-search-worker.mjs';
import {runManualRefresh} from './tech-feed-refresh.mjs';
import {manualRefreshMessage} from '../../../apps/web/src/techFeed.mjs';

test('compound interests rotate focused queries without multiplying paid requests',async()=>{
 const queries=[];let reservations=0;
 for(let cursor=0;cursor<5;cursor++){
  const result=await runSearchWorker({store:{
   claimSearch:async()=>({id:'topic',lease:'lease',canonical:'ai 및 aws, 클라우드, fde에 대해',query_cursor:cursor}),
   reserveSearch:async()=>{reservations++;return true;},finishSearch:async()=>true,
  },search:{availability:()=> 'waiting',checkUsage:async()=>{},search:async query=>{queries.push(query);return[];}}});
  assert.equal(result.attempted,1);
 }
 assert.deepEqual(queries,['ai engineering deep dive internals 동작 원리','aws engineering deep dive internals 동작 원리','클라우드 engineering deep dive internals 동작 원리','fde engineering deep dive internals 동작 원리','ai engineering case study architecture']);
 assert.equal(reservations,5);
});

test('single topic identities stay intact and duplicate compound interests are skipped',async()=>{
 for(const [canonical,query_cursor,want] of [['aws lambda',7,'aws lambda engineering case study architecture'],['React, react, Rust',1,'Rust engineering deep dive internals 동작 원리'],['C++ and C#',1,'C# engineering deep dive internals 동작 원리']]){
  let actual;
  await runSearchWorker({store:{claimSearch:async()=>({id:'t',lease:'l',canonical,query_cursor}),reserveSearch:async()=>true,finishSearch:async()=>true},search:{availability:()=> 'waiting',checkUsage:async()=>{},search:async query=>{actual=query;return[];}}});
  assert.equal(actual,want);
 }
});

function fixture(){
 return {userId:'owner',expectedRevision:1,env:{TECH_FEED_ENABLED:'true',TAVILY_API_KEY:'test-only'},
 store:{state:async()=>({preferences:{prompt:'aws',receiving:true},sources:[]}),beginRefresh:async()=>({state:'started',lease:'r'}),
 claimManualSearch:async()=>null,finishRefresh:async()=>true,refreshStatus:async()=>({state:'idle'})},
 search:{availability:()=> 'waiting'},transport:async()=>{throw Error('unexpected RSS');}};
}
test('a skipped claim is reported as deferred rather than an invented five-minute cooldown',async()=>{
 const result=await runManualRefresh(fixture());assert.equal(result.state,'deferred');assert.equal(result.retry_after,undefined);
 assert.doesNotMatch(manualRefreshMessage(result),/5분|최신 소식 확인을 마쳤/);
});
test('empty successful search is not presented as new articles arriving',()=>{
 assert.match(manualRefreshMessage({state:'ready',search:{attempted:1,collected:0},rss:{collected:0}}),/검색.*새 글.*없/);
});
test('failed manual runs record a database-supported error code',async()=>{
 const f=fixture();let code;
 f.store.startRun=async()=> 'run';f.store.finishRun=async(_,__,error)=>{code=error;};
 f.store.claimManualSearch=async()=>{throw Error('unavailable');};
 const result=await runManualRefresh(f);assert.equal(result.state,'unavailable');assert.equal(code,'worker_failed');
});
