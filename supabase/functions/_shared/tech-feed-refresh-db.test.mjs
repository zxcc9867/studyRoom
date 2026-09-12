import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createTechFeedHandler} from './tech-feed-api.mjs';
test('a leased RSS source must not suppress an independent manual web search',()=>tx(async()=>{
 await configure();const id=(await db.query("insert into tech_feed_sources(name,url,permission_status,lease,lease_until)values('Busy source','https://example.com/busy','approved',gen_random_uuid(),now()+interval '1 minute')returning id")).rows[0].id;
 await db.query('insert into tech_feed_subscriptions(user_id,source_id,subscribed)values($1,$2,true)',[a,id]);
 const gate=await begin();assert.equal(gate.state,'started');assert.ok(await rpc('tech_feed_refresh_claim_search',a,gate.lease));
}));
test('eligible unrelated search reports provider contention instead of a cache hit',()=>tx(async()=>{
 await configure();await configure(b,'Rust async');const busy=await rpc('tech_feed_search_claim',[b]);assert.ok(busy);
 const gate=await begin();assert.deepEqual(await rpc('tech_feed_refresh_claim_search',a,gate.lease),{busy:true});
}));
test('topic changes after manual reservation cannot spend on a different query',()=>tx(async()=>{
 await configure();const first=await begin();await configure(a,'PostgreSQL',1);
 assert.equal(await rpc('tech_feed_refresh_claim_search',a,first.lease),null);
 assert.deepEqual(await rpc('tech_feed_refresh_claim_sources',a,first.lease),[]);
 assert.equal((await db.query('select count(*)::int n from tech_feed_search_budget')).rows[0].n,0);
}));
const a='00000000-0000-4000-8000-000000000101',b='00000000-0000-4000-8000-000000000102';
let db;
before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema coaching_private;create table auth.users(id uuid primary key);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('role',current_setting('role',true),'sub',auth.uid(),'is_anonymous',false)$$;
 create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
 grant usage on schema auth,public,coaching_private to anon,authenticated,service_role;
 create table profiles(user_id uuid primary key references auth.users,time_zone text);
 create table study_goals(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users);
 create table study_todos(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,local_date date not null,title text not null,start_time time,end_time time,goal_id uuid references study_goals);
 grant all on profiles,study_todos,study_goals to service_role;
 insert into auth.users values('${a}'),('${b}');insert into profiles values('${a}','Asia/Seoul'),('${b}','Asia/Seoul');`);
 await db.exec(readFileSync('supabase/migrations/20260906083030_studyroom_v2_coach.sql','utf8'));
 for(const name of readdirSync('supabase/migrations').filter(n=>/_tech_feed(?:_web_search|_manual_refresh)?\.sql$/.test(n)).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
});
after(async()=>db?.close());
async function tx(work){await db.exec('begin');try{await work();}finally{await db.exec('rollback');}}
async function rpc(name,...args){return(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}
async function configure(user=a,topic='AWS Lambda',revision=0){return rpc('tech_feed_configure',user,topic,topic.toLowerCase(),true,revision);}
async function begin(user=a,revision=1){return rpc('tech_feed_refresh_begin',user,revision);}
async function finish(user,lease){return rpc('tech_feed_refresh_finish',user,lease,{state:'ready'});}

test('manual refresh owns a durable five-minute account lease across topic changes',()=>tx(async()=>{
 await configure();const first=await begin();assert.equal(first.state,'started');
 assert.equal((await begin()).state,'running');
 assert.equal(await finish(a,b),false);assert.equal(await finish(a,first.lease),true);
 await configure(a,'PostgreSQL',1);
 const repeated=await begin(a,2);assert.equal(repeated.state,'cooldown');assert.equal(repeated.retry_after,300);
 await db.exec("update tech_feed_refresh_requests set requested_at=now()-interval '301 seconds'");
 assert.equal((await begin(a,2)).state,'started');
}));
test('manual search bypasses hourly cache only after five minutes and keeps provider mutex',()=>tx(async()=>{
 await configure();await configure(b);let initial=await rpc('tech_feed_search_claim',[a]);
 await rpc('tech_feed_search_reserve',initial.id,initial.lease,900);await rpc('tech_feed_search_finish',initial.id,initial.lease,[],null);
 const first=await begin();assert.equal(await rpc('tech_feed_refresh_claim_search',a,first.lease),null);
 await db.exec("update tech_feed_search_topics set last_attempt_at=now()-interval '301 seconds',last_success_at=now()-interval '301 seconds'");
 const job=await rpc('tech_feed_refresh_claim_search',a,first.lease);assert.equal(job.id,initial.id);
 const other=await begin(b);assert.equal(other.state,'started');
 assert.equal(await rpc('tech_feed_refresh_claim_search',b,other.lease),null);
 assert.equal((await rpc('tech_feed_refresh_status',b)).state,'running');
 assert.equal(await rpc('tech_feed_search_claim',[b]),null);
 assert.equal(await rpc('tech_feed_search_reserve',job.id,job.lease,900),true);
 assert.equal(await rpc('tech_feed_search_reserve',job.id,job.lease,900),false);
 await rpc('tech_feed_search_finish',job.id,job.lease,[],null);await finish(a,first.lease);
 assert.equal(await rpc('tech_feed_refresh_claim_search',b,other.lease),null);
 assert.equal((await db.query('select attempts from tech_feed_search_budget')).rows[0].attempts,2);
}));
test('manual refresh preserves backoff, paused owners and revision conflict',()=>tx(async()=>{
 await configure();const first=await begin();const job=await rpc('tech_feed_refresh_claim_search',a,first.lease);
 await rpc('tech_feed_search_reserve',job.id,job.lease,900);await rpc('tech_feed_search_finish',job.id,job.lease,[],'unavailable');await finish(a,first.lease);
 await db.exec("update tech_feed_refresh_requests set requested_at=now()-interval '301 seconds';update tech_feed_search_topics set last_attempt_at=now()-interval '301 seconds'");
 const next=await begin();assert.equal(await rpc('tech_feed_refresh_claim_search',a,next.lease),null);
 await rpc('tech_feed_receiving',a,false,1);
 assert.equal(await rpc('tech_feed_refresh_claim_search',a,next.lease),null);
 assert.equal((await begin(a,2)).state,'paused');
 await db.exec('savepoint conflict');await assert.rejects(begin(a,1),/revision_conflict/);await db.exec('rollback to conflict');
}));
test('manual source claims are subscribed approved only and share five-minute cooldown',()=>tx(async()=>{
 await configure();await configure(b);
 const id=(await db.query("insert into tech_feed_sources(name,url,permission_status,last_success_at,run_after)values('Public','https://example.com/feed','approved',now()-interval '6 minutes',now()+interval '1 hour')returning id")).rows[0].id;
 await db.query('insert into tech_feed_subscriptions(user_id,source_id,subscribed)values($1,$3,true),($2,$3,true)',[a,b,id]);
 const first=await begin();const sources=await rpc('tech_feed_refresh_claim_sources',a,first.lease);assert.equal(sources.length,1);assert.equal(sources[0].id,id);
 const next=await begin(b);assert.equal(next.state,'started');
 assert.deepEqual(await rpc('tech_feed_refresh_claim_sources',b,next.lease),[]);
 assert.equal((await rpc('tech_feed_refresh_status',b)).state,'running');
 await rpc('tech_feed_finish_source',id,sources[0].lease,[],null,null,null);await finish(a,first.lease);
 assert.deepEqual(await rpc('tech_feed_refresh_claim_sources',b,next.lease),[]);
 await finish(b,next.lease);
 assert.equal((await rpc('tech_feed_refresh_status',a)).state,'idle');
}));
test('new refresh RPC and request state cannot be accessed by other client roles',()=>tx(async()=>{
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query('select has_table_privilege($1,\'tech_feed_refresh_requests\',\'SELECT\') ok',[role])).rows[0].ok,false);
  const exposed=await db.query("select proname from pg_proc where proname like 'tech_feed_refresh_%' and has_function_privilege($1,oid,'EXECUTE')",[role]);assert.equal(exposed.rows.length,0);
 }
 assert.equal((await db.query("select relrowsecurity from pg_class where relname='tech_feed_refresh_requests'")).rows[0].relrowsecurity,true);
}));
test('refresh endpoint returns missing provider state without creating a paid or fake collection',()=>tx(async()=>{
 await configure();
 const handler=createTechFeedHandler({authenticate:async()=>({id:a,store:{state:()=>rpc('tech_feed_state',a)}}),env:()=>({TECH_FEED_ACCESS_MODE:'self_service',TECH_FEED_ENABLED:'true'}),transport:async()=>{throw Error('unexpected fetch');}});
 const response=await handler(new Request('https://example.com/feed',{method:'POST',body:'{"action":"refresh","expected_revision":1}'}));
 assert.equal(response.status,200);assert.equal((await response.json()).state,'not_configured');
}));
