import test from 'node:test';
import assert from 'node:assert/strict';
import * as feed from '../src/techFeed.mjs';
test('shared polling preserves provider failure rather than claiming success',async()=>{
 const result=await feed.refreshFeedNow(async action=>action==='refresh'?{state:'running'}:{state:'idle',search:{state:'quota_exhausted'}},1,{wait:async()=>{}});
 assert.equal(result.search.state,'quota_exhausted');assert.match(feed.manualRefreshMessage(result),/무료 한도/);
 assert.match(feed.manualRefreshMessage({state:'cooldown',search:{state:'quota_exhausted'}}),/무료 한도/);
});

test('refresh requests collection once rather than listing previously saved rows',async()=>{
 const calls=[];const result=await feed.refreshFeedNow(async(action,payload)=>{calls.push([action,payload]);return{state:'ready'};},7);
 assert.equal(result.state,'ready');assert.deepEqual(calls,[['refresh',{expected_revision:7}]]);
});
test('shared running collection is polled without issuing another search',async()=>{
 const actions=[];let polls=0;
 const result=await feed.refreshFeedNow(async(action)=>{actions.push(action);return{state:action==='refresh'||++polls<2?'running':'idle'};},1,{wait:async()=>{}});
 assert.equal(result.state,'shared');assert.deepEqual(actions,['refresh','refresh_status','refresh_status']);
});
test('cooldown and missing configuration return without polling or consuming calls',async()=>{
 for(const state of ['cooldown','paused','not_configured']){let calls=0;const result=await feed.refreshFeedNow(async()=>{calls++;return{state,retry_after:240};},1);assert.equal(calls,1);assert.equal(result.state,state);}
});
test('unending shared collection stops polling at the bounded limit',async()=>{
 let calls=0;const result=await feed.refreshFeedNow(async()=>{calls++;return{state:'running'};},1,{wait:async()=>{},maxPolls:2});assert.equal(calls,3);assert.equal(result.state,'running');
});
test('account change aborts pending refresh before delivering its result',async()=>{
 const controller=new AbortController();
 await assert.rejects(feed.refreshFeedNow(async()=>{controller.abort();return{state:'ready'};},1,{signal:controller.signal}),{name:'AbortError'});
});
test('refresh notices distinguish free quota, missing key, and actual checked results',()=>{
 assert.match(feed.manualRefreshMessage({state:'partial',search:{state:'quota_exhausted'},rss:{collected:1}}),/무료 한도/);
 assert.match(feed.manualRefreshMessage({state:'not_configured'}),/연결/);
 assert.match(feed.manualRefreshMessage({state:'paused'}),/중지/);
 assert.match(feed.manualRefreshMessage({state:'cooldown',retry_after:121}),/3분/);
 assert.doesNotMatch(feed.manualRefreshMessage({state:'running'}),/완료/);
});
