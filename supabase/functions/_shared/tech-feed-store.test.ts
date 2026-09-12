import assert from 'node:assert/strict';
import {createClient} from 'jsr:@supabase/supabase-js@2.57.4';
import {createFeedStore,askFeedAi,authenticateFeed} from './tech-feed-store.ts';
const owner='00000000-0000-4000-8000-000000000101';
const env={OPENROUTER_API_KEY:'synthetic-key',OPENROUTER_MODEL:'paid/model',TECH_FEED_ENABLED:'true',TECH_FEED_PILOT_USER_IDS:owner};
function client(transport:typeof fetch){return createClient('https://fixture.example','synthetic',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});}
Deno.test('real SDK store binds owner to queries and timezone writes only profiles',async()=>{
 const calls:{url:URL;body:any;method:string}[]=[];
 const admin=client(async(input,init)=>{const url=new URL(String(input));calls.push({url,body:JSON.parse(String(init?.body||'{}')),method:String(init?.method)});return new Response(JSON.stringify(url.pathname.includes('/profiles')?[{user_id:owner}]:{ok:true}),{headers:{'Content-Type':'application/json'}});});
 const store=createFeedStore(admin,owner);
 await store.state();await store.list('latest','ai',null,null);await store.saveTimezone('Asia/Tokyo');await store.mutate('save',{article_id:owner,saved:true});
 assert.equal(calls[0].body.p_user_id,owner);assert.equal(calls[1].body.p_user_id,owner);assert.equal(calls[1].body.p_interest,'ai');
 assert.equal(calls[2].url.pathname,'/rest/v1/profiles');assert.equal(calls[2].url.searchParams.get('user_id'),'eq.'+owner);assert.deepEqual(calls[2].body,{time_zone:'Asia/Tokyo'});
 assert.equal(calls[3].body.p_user_id,owner);assert.ok(calls.every(c=>!c.url.pathname.includes('coach_')));
 await store.finishSummary(owner,owner,owner,{technology:'기술',change:'변경',usage:'활용'},'ready','practice');assert.equal(calls[4].body.p_category,'practice');assert.deepEqual(Object.keys(calls[4].body.p_summary).sort(),['change','technology','usage']);
});
Deno.test('actual free client charges failed calls, honors quota rejection, and cannot route paid',async()=>{
 let reservations=0,providerCalls=0;
 const admin=client(async(input,init)=>{assert.equal(new URL(String(input)).pathname,'/rest/v1/rpc/coach_reserve_ai');assert.equal(JSON.parse(String(init?.body)).p_user_id,owner);return new Response(JSON.stringify(++reservations<=6),{headers:{'Content-Type':'application/json'}});});
 const provider:typeof fetch=async(_input,init)=>{providerCalls++;const body=JSON.parse(String(init?.body));assert.equal(body.model,'openrouter/free');assert.deepEqual(body.provider.max_price,{prompt:0,completion:0,request:0});return new Response('{"error":"synthetic"}',{status:429});};
 for(let i=0;i<6;i++)assert.equal(await askFeedAi(admin,owner,[{role:'user',content:'Synthetic public excerpt'}],undefined,env,provider),null);
 assert.deepEqual(await askFeedAi(admin,owner,[{role:'user',content:'Synthetic public excerpt'}],undefined,env,provider),{deferred:true});
 assert.equal(reservations,7);assert.equal(providerCalls,6);
});
Deno.test('no configured AI or nonpilot produces no reservation/provider call',async()=>{
 let calls=0;const admin=client(async()=>{calls++;throw Error('must not call')});
 assert.deepEqual(await askFeedAi(admin,owner,[{role:'user',content:'test'}],undefined,{}),{deferred:true});
 assert.deepEqual(await askFeedAi(admin,'00000000-0000-4000-8000-000000000102',[{role:'user',content:'test'}],undefined,env),{deferred:true});assert.equal(calls,0);
});
Deno.test('authentication validates token through Auth and rejects anonymous users',async()=>{
 const req=new Request('https://fixture.example/',{headers:{authorization:'Bearer synthetic'}});
 const admin=client(async()=>new Response(JSON.stringify({id:owner,is_anonymous:true}),{headers:{'Content-Type':'application/json'}}));
 await assert.rejects(authenticateFeed(req,admin),/unauthorized/);
 await assert.rejects(authenticateFeed(new Request('https://fixture.example/'),admin),/unauthorized/);
});
