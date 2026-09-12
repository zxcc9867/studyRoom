import test from 'node:test';
import assert from 'node:assert/strict';
import {runFeedWorker,workerAuthorized} from './tech-feed-worker-core.mjs';
const pilot='00000000-0000-4000-8000-000000000101';
test('worker isolates failures, honors permission and finalizes with actual lease',async()=>{
 const finished=[];let calls=0;
 const store={claimSources:async()=>[{id:'bad',lease:'l1',permission_status:'approved',url:'https://example.com/bad'},{id:'good',lease:'l2',permission_status:'approved',url:'https://example.com/good',last_success_at:'2026-09-11'}],finishSource:async(...args)=>{finished.push(args);return true;},claimSummaries:async()=>[],cleanup:async()=>0};
 const result=await runFeedWorker({store,pilotIds:[pilot],transport:async url=>{calls++;if(url.includes('bad'))throw Error('upstream token secret');return{status:200,headers:{},text:'<rss><channel><title>Feed</title><item><title>AI release</title><link>https://example.com/a</link><description>Public</description></item></channel></rss>'};},ask:async()=>{throw Error('must not run')}});
 assert.equal(result.failed,1);assert.equal(result.collected,1);assert.equal(calls,2);assert.equal(finished[0][1],'l1');assert.equal(finished[0][3],'source_failed');assert.equal(finished[1][2][0].interests[0],'ai');
});
test('worker never fetches pending source even if malformed DB claim returns it',async()=>{
 let calls=0;const store={claimSources:async()=>[{id:'pending',permission_status:'pending',url:'https://example.com/'}],claimSummaries:async()=>[],cleanup:async()=>0};
 await runFeedWorker({store,pilotIds:[pilot],transport:async()=>calls++});assert.equal(calls,0);
});
test('worker groups AI by sponsoring owner, excludes unapproved text and caches failure',async()=>{
 const finished=[];const store={claimSources:async()=>[],claimSummaries:async()=>[{user_id:pilot,lease:'lease',article:{id:'article',title:'AI',excerpt:'x'.repeat(200),permission_status:'approved'}}],finishSummary:async(...args)=>finished.push(args),cleanup:async()=>0};
 await runFeedWorker({store,pilotIds:[pilot],ask:async owner=>{assert.equal(owner,pilot);return null;}});
 assert.equal(finished[0][0],'article');assert.equal(finished[0][1],'lease');assert.equal(finished[0][4],'failed');
});
test('worker secret comparison refuses missing/short/incorrect secrets',()=>{
 assert.equal(workerAuthorized('',''),false);assert.equal(workerAuthorized('abc','abc'),false);assert.equal(workerAuthorized('a'.repeat(32),'b'.repeat(32)),false);assert.equal(workerAuthorized('a'.repeat(32),'a'.repeat(32)),true);
});

test('worker finalizes malformed AI response and continues mixed valid next owner group through cleanup',async()=>{
 const other='00000000-0000-4000-8000-000000000102',finished=[],asked=[],runs=[];let cleaned=0;
 const store={
  startRun:async()=> 'run',finishRun:async(...args)=>runs.push(args),
  claimSources:async()=>[],
  claimSummaries:async()=>[pilot,other].map((user_id,i)=>({user_id,lease:'lease-'+i,article:{id:'article-'+i,excerpt:'x'.repeat(200),permission_status:'approved'}})),
  finishSummary:async(...args)=>{finished.push(args);return true;},
  cleanup:async()=>{cleaned++;return 0;}
 };
 const result=await runFeedWorker({store,pilotIds:[pilot,other],ask:async owner=>{
  asked.push(owner);
  return{text:JSON.stringify({items:owner===pilot?[null]:[null,[],{id:'article-1',technology:'기술',change:'변경',usage:'활용',category:'news'},false]})};
 }});
 assert.deepEqual(asked,[pilot,other]);assert.equal(finished.length,2);
 assert.deepEqual(finished[0],['article-0','lease-0',pilot,null,'failed',null]);
 assert.equal(finished[1][0],'article-1');assert.equal(finished[1][4],'ready');assert.equal(finished[1][5],'news');
 assert.equal(result.summary_failed,1);assert.equal(result.summarized,1);assert.equal(cleaned,1);
 assert.equal(runs.length,1);assert.equal(runs[0][2],null);assert.deepEqual(runs[0][1],result);
});
