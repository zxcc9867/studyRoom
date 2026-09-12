import test from 'node:test';
import assert from 'node:assert/strict';
import {createTechFeedHandler} from './tech-feed-api.mjs';

// Catches a refresh button route that merely lists cached rows or bypasses auth.
test('authenticated refresh reports collection pause without contacting any provider',async()=>{
 const handler=createTechFeedHandler({authenticate:async()=>({id:'owner',store:{state:async()=>({preferences:{prompt:'AWS Lambda',receiving:true},sources:[]})}}),env:()=>({TECH_FEED_ACCESS_MODE:'self_service',TECH_FEED_ENABLED:'false'}),transport:async()=>{throw Error('must not fetch');}});
 const response=await handler(new Request('https://example.com/feed',{method:'POST',body:JSON.stringify({action:'refresh',expected_revision:1})}));
 assert.equal(response.status,200);
 assert.equal((await response.json()).state,'paused');
});

test('manual refresh requires authenticated identity before collection',async()=>{
 const handler=createTechFeedHandler({authenticate:async()=>{throw Error('unauthorized');},env:()=>({TECH_FEED_ACCESS_MODE:'self_service',TECH_FEED_ENABLED:'true'}),transport:async()=>{throw Error('must not fetch');}});
 assert.equal((await handler(new Request('https://example.com/feed',{method:'POST',body:'{"action":"refresh","expected_revision":1}'}))).status,401);
});
