import test from 'node:test';
import assert from 'node:assert/strict';
import {runFeedWorker} from './tech-feed-worker-core.mjs';
test('combined pipeline still collects actual RSS when search preflight throws or quota is exhausted',async()=>{
 for(const reason of ['unavailable','quota_exhausted']){
  let saved=[];const store={claimSearch:async()=>({id:'topic',lease:'lease',canonical:'AWS Lambda'}),finishSearch:async()=>true,claimSources:async()=>[{id:'source',lease:'rss',url:'https://example.com/rss',permission_status:'approved'}],finishSource:async(_,__,items)=>{saved=items;return true;},claimSummaries:async()=>[],cleanup:async()=>{}};
  const result=await runFeedWorker({store,pilotIds:['owner'],search:{availability:()=> 'waiting',checkUsage:async()=>{throw Error(reason);}},transport:async()=>({status:200,headers:{},text:'<rss><channel><title>News</title><item><title>AWS News</title><link>https://example.com/rss-article</link><pubDate>'+new Date().toUTCString()+'</pubDate></item></channel></rss>'}),ask:async()=>null});
  assert.equal(result.search.state,reason);assert.equal(result.collected,1);assert.equal(saved[0].url,'https://example.com/rss-article');
 }
});
test('search worker checks usage before reserving and attempts only one POST',async()=>{
 const {runSearchWorker}=await import('./tech-feed-search-worker.mjs');const calls=[];
 const store={claimSearch:async()=>({id:'topic',lease:'lease',canonical:'aws lambda'}),reserveSearch:async()=>{calls.push('reserve');return true;},finishSearch:async(_,__,items,error)=>{calls.push(error||'finish');return true;}};
 const result=await runSearchWorker({store,search:{availability:()=> 'waiting',checkUsage:async()=>{calls.push('usage');},search:async(query)=>{assert.equal(query,'aws lambda');calls.push('post');throw Error('unavailable');}}});
 assert.deepEqual(calls,['usage','reserve','post','unavailable']);assert.equal(result.attempted,1);assert.equal(result.state,'unavailable');
});
test('missing key and reservation exhaustion make no search POST',async()=>{
 const {runSearchWorker}=await import('./tech-feed-search-worker.mjs');let calls=0;
 assert.equal((await runSearchWorker({store:{},search:{availability:()=> 'not_configured'}})).state,'not_configured');
 const result=await runSearchWorker({store:{claimSearch:async()=>({id:'x',lease:'y',canonical:'aws'}),reserveSearch:async()=>false,finishSearch:async()=>true},search:{availability:()=> 'waiting',checkUsage:async()=>{},search:async()=>{calls++;}}});
 assert.equal(result.state,'quota_exhausted');assert.equal(calls,0);
});
