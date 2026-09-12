import test from 'node:test';
import assert from 'node:assert/strict';
import {createTechFeedHandler} from './tech-feed-api.mjs';
const user='00000000-0000-4000-8000-000000000101';
const enabled={TECH_FEED_ENABLED:'true',TECH_FEED_PILOT_USER_IDS:user};
const req=data=>new Request('https://local.test/tech-feed',{method:'POST',body:JSON.stringify(data)});
function setup({env=enabled,auth=true,store={},transport=async()=>({status:200,headers:{},text:'<rss><channel><title>Feed</title><item><title>Hello</title><link>https://example.com/a</link></item></channel></rss>'})}={}){
 const writes=[];
 const handler=createTechFeedHandler({env:()=>env,authenticate:async()=>{if(!auth)throw Error('unauthorized');return{id:user,store:{state:async()=>({enabled:true,sources:[],interests:[],last_success_at:null}),saveTimezone:async zone=>writes.push(['zone',zone]),previewAllowed:async()=>true,mutate:async(action,data)=>{writes.push([action,data]);return{ok:true};},...store}};},transport});return{handler,writes};
}
test('API authenticates, denies nonpilots, and timezone remains independent of feed flag',async()=>{
 assert.equal((await setup({auth:false}).handler(req({action:'state'}))).status,401);
 const f=setup({env:{}});assert.deepEqual(await(await f.handler(req({action:'state'}))).json(),{enabled:false,sources:[],interests:[],last_success_at:null,preferences:{prompt:'',receiving:false,revision:0},search_status:{state:'paused',last_success_at:null},service_available:false});
 assert.equal((await f.handler(req({action:'save',article_id:user,saved:true}))).status,403);
 assert.equal((await f.handler(req({action:'timezone',time_zone:'Asia/Tokyo'}))).status,200);assert.deepEqual(f.writes,[['zone','Asia/Tokyo']]);
 assert.equal((await f.handler(req({action:'timezone',time_zone:'invalid/zone'}))).status,400);
});
test('API validates mutation input before persistence, preserves goal, and hides raw failures',async()=>{
 const f=setup();for(const data of [{action:'subscribe',source_id:user,subscribed:'true'},{action:'interests',interests:['secret']},{action:'add_todo',article_id:user,title:'X',local_date:'2026-02-30',start_time:null,end_time:null}])assert.equal((await f.handler(req(data))).status,400);
 assert.equal(f.writes.length,0);
 const data={action:'add_todo',article_id:user,title:'Study',local_date:'2026-09-12',start_time:'23:00',end_time:'01:00',goal_id:user};
 assert.equal((await f.handler(req(data))).status,200);assert.equal(f.writes[0][1].goal_id,user);
 const failed=await setup({store:{state:async()=>{throw Error('PRIVATE_KEY=secret')}}}).handler(req({action:'state'}));assert.equal(failed.status,500);assert.doesNotMatch(await failed.text(),/PRIVATE_KEY|secret/);
});
test('preview is bounded public feed parsing and add-source repeats server validation without permission flags',async()=>{
 const f=setup();const preview=await(await f.handler(req({action:'preview',url:'https://example.com/rss'}))).json();assert.deepEqual(preview,{url:'https://example.com/rss',name:'Feed',items:[{title:'Hello',url:'https://example.com/a'}]});
 await f.handler(req({action:'add_source',url:'https://example.com/rss',permission_status:'approved',summary_allowed:true}));
 assert.deepEqual(f.writes,[['add_source',{url:'https://example.com/rss',name:'Feed'}]]);
 assert.equal((await f.handler(req({action:'preview',url:'https://127.0.0.1/rss'}))).status,400);
 const bad=setup({transport:async()=>({status:200,headers:{},text:'not XML'})});assert.equal((await bad.handler(req({action:'add_source',url:'https://example.com/rss'}))).status,400);assert.equal(bad.writes.length,0);
});
test('API rejects oversized JSON and unsupported methods before authentication writes',async()=>{
 const f=setup();assert.equal((await f.handler(new Request('https://x/',{method:'GET'}))).status,405);
 assert.equal((await f.handler(req({action:'state',extra:'x'.repeat(17000)}))).status,400);
});
