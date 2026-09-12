import {runFeedWorker} from './tech-feed-worker-core.mjs';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const owner='00000000-0000-4000-8000-000000000101',other='00000000-0000-4000-8000-000000000102';
let db;
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema coaching_private;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('role',current_setting('role',true),'sub',auth.uid(),'is_anonymous',false)$$;
 create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
 grant usage on schema auth,public,coaching_private to anon,authenticated,service_role;
 create table profiles(user_id uuid primary key references auth.users,time_zone text);
 create table study_goals(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users);
 create table study_todos(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,local_date date not null,title text not null check(length(btrim(title))>0),start_time time,end_time time,goal_id uuid references study_goals,check((start_time is null and end_time is null)or(start_time is not null and end_time is not null and start_time<>end_time)));
 grant all on profiles,study_todos,study_goals to service_role;
 insert into auth.users values('${owner}'),('${other}');insert into profiles values('${owner}','Asia/Seoul'),('${other}','Asia/Seoul');`);
 await db.exec(readFileSync('supabase/migrations/20260906083030_studyroom_v2_coach.sql','utf8'));
 for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('_tech_feed.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
});
after(async()=>await db?.close());
async function tx(run){await db.exec('begin');try{await run();}finally{await db.exec('rollback');}}
async function role(name,user=owner){await db.exec(`set local role ${name};select set_config('request.uid','${user}',true)`);}
async function seed(){
 const source=(await db.query("insert into tech_feed_sources(name,url,permission_status,summary_allowed) values('Public','https://example.com/rss','approved',true) returning *")).rows[0];
 await db.query('insert into tech_feed_subscriptions(user_id,source_id) values($1,$2)',[owner,source.id]);
 const article=(await db.query("insert into tech_feed_articles(title,url,excerpt,excerpt_source_id)values('Article','https://example.com/a','public excerpt',$1)returning *",[source.id])).rows[0];
 await db.query("insert into tech_feed_article_sources(article_id,source_id,guid)values($1,$2,'one')",[article.id,source.id]);return{source,article};
}
test('migration installs server-owned pending catalog and no browser write grants',async()=>tx(async()=>{
 assert.equal((await db.query("select count(*)::int n from pg_tables where tablename='tech_feed_sources'")).rows[0].n,1);
 const rows=(await db.query('select * from tech_feed_sources')).rows;assert.equal(rows.length,8);assert.ok(rows.every(x=>x.permission_status==='pending'&&!x.summary_allowed));
 for(const name of ['tech_feed_sources','tech_feed_articles','tech_feed_subscriptions','tech_feed_bookmarks','tech_feed_todo_links'])assert.equal((await db.query("select has_table_privilege('authenticated',$1,'INSERT') ok",[name])).rows[0].ok,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','tech_feed_mutate(uuid,text,jsonb)','execute') ok")).rows[0].ok,false);
}));
test('RLS owner isolation covers subscriptions, saves, custom catalog and article access',async()=>tx(async()=>{
 const{article}=await seed();await db.query('insert into tech_feed_bookmarks(user_id,article_id)values($1,$2)',[owner,article.id]);
 await db.query("insert into tech_feed_sources(name,url,created_by)values('Private catalog','https://example.org/rss',$1)",[owner]);
 await role('authenticated',other);
 assert.equal((await db.query('select * from tech_feed_subscriptions')).rows.length,0);assert.equal((await db.query('select * from tech_feed_bookmarks')).rows.length,0);assert.equal((await db.query('select * from tech_feed_articles')).rows.length,0);
 assert.equal((await db.query("select id from tech_feed_sources where recommended=false")).rows.length,0);
}));
test('atomic todo link is idempotent and preserves existing overnight/overlap behavior',async()=>tx(async()=>{
 const{article}=await seed();await role('service_role');
 const input={article_id:article.id,title:'Study article',local_date:'2026-09-13',start_time:'23:00',end_time:'01:00'};
 const first=(await db.query("select tech_feed_mutate($1,'add_todo',$2) result",[owner,input])).rows[0].result;
 const second=(await db.query("select tech_feed_mutate($1,'add_todo',$2) result",[owner,input])).rows[0].result;
 assert.equal(first.todo_id,second.todo_id);assert.equal((await db.query('select count(*)::int n from study_todos')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from tech_feed_todo_links')).rows[0].n,1);
}));
test('cross-owner article cannot be saved or converted and invalid time rolls back todo link',async()=>tx(async()=>{
 const{article}=await seed();await role('service_role');
 await db.exec('savepoint denied');await assert.rejects(db.query("select tech_feed_mutate($1,'save',$2)",[other,{article_id:article.id,saved:true}]),/not_found/);await db.exec('rollback to denied');
 await db.exec('savepoint invalid');await assert.rejects(db.query("select tech_feed_mutate($1,'add_todo',$2)",[owner,{article_id:article.id,title:'Bad',local_date:'2026-09-13',start_time:'10:00',end_time:'10:00'}]),/invalid_input|check constraint/);await db.exec('rollback to invalid');
 assert.equal((await db.query('select count(*)::int n from study_todos')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from tech_feed_todo_links')).rows[0].n,0);
}));
test('saved articles survive unsubscribe and 90-day cleanup',async()=>tx(async()=>{
 const{source,article}=await seed();await role('service_role');
 await db.query("select tech_feed_mutate($1,'save',$2)",[owner,{article_id:article.id,saved:true}]);await db.query("select tech_feed_mutate($1,'subscribe',$2)",[owner,{source_id:source.id,subscribed:false}]);
 await db.query("update tech_feed_articles set discovered_at=now()-interval '100 days' where id=$1",[article.id]);await db.query('select tech_feed_cleanup()');
 const data=(await db.query("select tech_feed_list($1,'saved',null,null,null) result",[owner])).rows[0].result;assert.equal(data.items.length,1);assert.equal(data.items[0].saved,true);
}));
test('source leases deny pending/blocked/unsubscribed sources and reject stale finalization',async()=>tx(async()=>{
 const{source}=await seed();await role('service_role');
 assert.equal((await db.query('select * from tech_feed_claim_sources($1,2)',[[other]])).rows.length,0);
 const lease=(await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows[0];assert.equal(lease.id,source.id);
 assert.equal((await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows.length,0);
 const stale=(await db.query("select tech_feed_finish_source($1,$2,'[]',null,null,null) ok",[source.id,other])).rows[0].ok;assert.equal(stale,false);
 await db.query("update tech_feed_sources set lease_until=now()-interval '1 second' where id=$1",[source.id]);
 assert.equal((await db.query("select tech_feed_finish_source($1,$2,'[]',null,null,null) ok",[source.id,lease.lease])).rows[0].ok,false);
}));
test('lease finalization deduplicates GUID and normalized URL with multi-source attribution',async()=>tx(async()=>{
 const{source}=await seed();await role('service_role');const lease=(await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows[0];
 const item={guid:'new',title:'New',url:'https://example.com/new',excerpt:'Public',published_at:'2026-09-11T10:00:00Z',interests:['ai']};
 assert.equal((await db.query('select tech_feed_finish_source($1,$2,$3,null,null,null) ok',[source.id,lease.lease,[item,item]])).rows[0].ok,true);
 assert.equal((await db.query("select count(*)::int n from tech_feed_articles where url='https://example.com/new'")).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from tech_feed_article_sources where guid='new'")).rows[0].n,1);
}));
test('custom source limit and permission are server-controlled including resubscribe',async()=>tx(async()=>{
 await role('service_role');for(let n=0;n<10;n++)await db.query("select tech_feed_mutate($1,'add_source',$2)",[owner,{url:'https://example.com/feed'+n,name:'Custom',permission_status:'approved'}]);
 assert.equal((await db.query('select count(*)::int n from tech_feed_sources where created_by=$1 and permission_status=\'approved\'',[owner])).rows[0].n,0);
 await assert.rejects(db.query("select tech_feed_mutate($1,'add_source',$2)",[owner,{url:'https://example.com/eleventh',name:'X'}]),/source_limit/);
}));

test('cleanup tombstones prevent rediscovered old GUID or URL from receiving a new discovery date',async()=>tx(async()=>{
 const{source}=await seed();await role('service_role');
 let lease=(await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows[0];
 const item={guid:'old-guid',title:'Old',url:'https://example.com/old',excerpt:'Public',published_at:'2020-01-01T00:00:00Z'};
 await db.query('select tech_feed_finish_source($1,$2,$3,null,null,null)',[source.id,lease.lease,[item]]);
 await db.query("update tech_feed_articles set discovered_at=now()-interval '100 days' where url=$1",[item.url]);
 await db.query('select tech_feed_cleanup()');
 await db.query("update tech_feed_sources set run_after=now()where id=$1",[source.id]);
 lease=(await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows[0];
 await db.query('select tech_feed_finish_source($1,$2,$3,null,null,null)',[source.id,lease.lease,[item,{...item,guid:'renamed-guid'}]]);
 assert.equal((await db.query('select count(*)::int n from tech_feed_articles where url=$1',[item.url])).rows[0].n,0);
}));
test('preview budget is owner-isolated and bounded by server time',async()=>tx(async()=>{
 await role('service_role');
 for(let i=0;i<5;i++)assert.equal((await db.query('select tech_feed_preview_reserve($1) ok',[owner])).rows[0].ok,true);
 assert.equal((await db.query('select tech_feed_preview_reserve($1) ok',[owner])).rows[0].ok,false);
 assert.equal((await db.query('select tech_feed_preview_reserve($1) ok',[other])).rows[0].ok,true);
}));
test('summary leases reject stale tokens, unknown permissions, and malformed output; failures retry with bound',async()=>tx(async()=>{
 const{article,source}=await seed();await db.query("update tech_feed_articles set excerpt=repeat('a',200)where id=$1",[article.id]);await role('service_role');
 const claim=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows[0];
 assert.equal(claim.article.id,article.id);
 assert.equal((await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows.length,0);
 assert.equal((await db.query("select tech_feed_finish_summary($1,$2,$3,null,'failed') ok",[article.id,other,owner])).rows[0].ok,false);
 await db.exec('savepoint invalid');await assert.rejects(db.query("select tech_feed_finish_summary($1,$2,$3,$4,'ready')",[article.id,claim.lease,owner,{technology:'a'}]),/invalid_input/);await db.exec('rollback to invalid');
 await db.query("update tech_feed_sources set permission_status='pending',summary_allowed=false where id=$1",[source.id]);
 assert.equal((await db.query("select tech_feed_finish_summary($1,$2,$3,$4,'ready') ok",[article.id,claim.lease,owner,{technology:'a',change:'b',usage:'c'}])).rows[0].ok,false);
}));

test('cursor pages are stable at twenty items and filter owner-visible source/interests',async()=>tx(async()=>{
 const{source}=await seed();
 await db.query("delete from tech_feed_articles");
 for(let i=0;i<25;i++){
  const row=(await db.query("insert into tech_feed_articles(title,url,discovered_at,interests)values($1,$2,'2026-09-12'::timestamptz+($3||' seconds')::interval,array['ai'])returning id",['Article '+i,'https://example.com/page'+i,i])).rows[0];
  await db.query('insert into tech_feed_article_sources(article_id,source_id,guid)values($1,$2,$3)',[row.id,source.id,String(i)]);
 }
 await role('authenticated');assert.equal((await db.query('select * from tech_feed_articles')).rows.length,25);
 await role('service_role');
 const first=(await db.query("select tech_feed_list($1,'latest','ai',$2,null) result",[owner,source.id])).rows[0].result;
 assert.equal(first.items.length,20);assert.ok(first.next_cursor);assert.equal(first.items[0].title,'Article 24');
 const second=(await db.query("select tech_feed_list($1,'latest','ai',$2,$3) result",[owner,source.id,first.next_cursor])).rows[0].result;
 assert.equal(second.items.length,5);assert.equal(second.next_cursor,null);assert.equal(second.items[0].title,'Article 4');
 assert.equal((await db.query("select tech_feed_list($1,'latest','cloud',null,null) result",[owner])).rows[0].result.items.length,0);
}));
test('additional source preserves attribution and can improve an insufficient public excerpt without redating',async()=>tx(async()=>{
 const{source,article}=await seed();
 await db.query("update tech_feed_articles set summary_status='insufficient' where id=$1",[article.id]);
 const second=(await db.query("insert into tech_feed_sources(name,url,permission_status)values('Second','https://example.com/other','approved')returning id")).rows[0];
 await db.query('insert into tech_feed_subscriptions(user_id,source_id)values($1,$2)',[owner,second.id]);
 await role('service_role');
 const claims=(await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows;
 const claim=claims.find(x=>x.id===second.id);
 await db.query('select tech_feed_finish_source($1,$2,$3,null,null,null)',[second.id,claim.lease,[{guid:'second-guid',title:'Alternate',url:article.url,excerpt:'r'.repeat(200),published_at:'2026-09-11T00:00:00Z',interests:['ai']}]]);
 const result=(await db.query("select tech_feed_list($1,'latest',null,null,null) result",[owner])).rows[0].result.items[0];
 assert.equal(result.sources.length,2);assert.equal(result.id,article.id);assert.equal(result.title,article.title);assert.equal(result.summary_status,'pending');assert.equal(result.excerpt.length,200);assert.equal(result.published_at,article.published_at);assert.equal(new Date(result.discovered_at).toISOString(),new Date(article.discovered_at).toISOString());
 assert.equal((await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows.length,0,'may not borrow the first source AI permission for second source excerpt');
}));
test('source failures back off and keep safe errors instead of raw provider details',async()=>tx(async()=>{
 const{source}=await seed();await role('service_role');
 const claim=(await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows[0];
 await db.query("select tech_feed_finish_source($1,$2,'[]','private provider token',null,null)",[source.id,claim.lease]);
 const row=(await db.query('select *,run_after>now() later from tech_feed_sources where id=$1',[source.id])).rows[0];assert.equal(row.failures,1);assert.equal(row.later,true);assert.doesNotMatch(row.last_error,/private provider token/);
 assert.equal((await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows.length,0);
}));

for(const count of [8,18])test('minute dispatcher drains '+count+' due sources fairly within '+Math.ceil(count/2)+' ticks without early refetch',async()=>tx(async()=>{
 const ids=[];
 for(let i=0;i<count;i++){
  const source=(await db.query("insert into tech_feed_sources(name,url,permission_status,run_after)values($1,$2,'approved',now()-($3||' minutes')::interval)returning id",['Cadence '+i,'https://example.com/cadence/'+i,i])).rows[0];
  ids.push(source.id);await db.query('insert into tech_feed_subscriptions(user_id,source_id)values($1,$2)',[owner,source.id]);
 }
 await role('service_role');
 const calls=[];
 const store={
  claimSources:async(pilots,limit)=>(await db.query('select * from tech_feed_claim_sources($1,$2)',[pilots,limit])).rows,
  finishSource:async(id,lease,items,error,etag,modified)=>(await db.query('select tech_feed_finish_source($1,$2,$3,$4,$5,$6) ok',[id,lease,items,error,etag,modified])).rows[0].ok,
  claimSummaries:async pilots=>(await db.query('select * from tech_feed_claim_summaries($1)',[pilots])).rows,
  cleanup:async()=>(await db.query('select tech_feed_cleanup()')).rows[0],
 };
 const transport=async url=>{calls.push(url);return{status:200,headers:{},text:'<rss><channel><title>Cadence feed</title></channel></rss>'};};
 for(let tick=0;tick<Math.ceil(count/2);tick++){
  const result=await runFeedWorker({store,pilotIds:[owner],transport,ask:async()=>{throw Error('no article should request AI')}});
  assert.equal(result.collected,2);assert.equal(result.failed,0);
 }
 assert.equal(calls.length,count);assert.equal(new Set(calls).size,count);
 assert.deepEqual(calls.slice(0,2).sort(),['https://example.com/cadence/'+(count-1),'https://example.com/cadence/'+(count-2)].sort(),'oldest due sources run first, not newest');
 assert.equal((await db.query('select count(*)::int n from tech_feed_sources where id=any($1)and last_success_at is not null and run_after>=now()+interval \'1 hour\'',[ids])).rows[0].n,count);
 assert.equal((await runFeedWorker({store,pilotIds:[owner],transport})).collected,0);
 assert.equal(calls.length,count,'the next minute tick must not refetch any healthy source before one hour');
}));

test('incremental RSS persists more than fifty available entries in one bounded transaction',async()=>tx(async()=>{
 const{source}=await seed();await role('service_role');
 const claim=(await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows[0];
 const items=Array.from({length:75},(_,i)=>({guid:'bulk'+i,title:'Bulk '+i,url:'https://example.com/bulk'+i,excerpt:'Public',published_at:null}));
 assert.equal((await db.query('select tech_feed_finish_source($1,$2,$3,null,null,null) ok',[source.id,claim.lease,items])).rows[0].ok,true);
 assert.equal((await db.query("select count(*)::int n from tech_feed_articles where title like 'Bulk %'")).rows[0].n,75);
}));
test('summary sponsor skips exhausted owner and deferred leases never burn article attempts',async()=>tx(async()=>{
 const{source,article}=await seed();await db.query("update tech_feed_articles set excerpt=repeat('x',200) where id=$1",[article.id]);
 await db.query('insert into tech_feed_subscriptions(user_id,source_id)values($1,$2)',[other,source.id]);
 await db.query("insert into coach_ai_usage(user_id,local_date,attempts)values($1,(now()at time zone 'Asia/Seoul')::date,6)",[owner]);await role('service_role');
 for(let i=0;i<4;i++){
  const claim=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner,other]])).rows[0];assert.equal(claim.user_id,other);
  assert.equal((await db.query("select tech_feed_finish_summary($1,$2,$3,null,'deferred') ok",[article.id,claim.lease,other])).rows[0].ok,true);
  await db.query('update tech_feed_articles set summary_retry_at=now()where id=$1',[article.id]);
 }
 const row=(await db.query('select summary_status,summary_attempts from tech_feed_articles where id=$1',[article.id])).rows[0];
 assert.equal(row.summary_status,'pending');assert.equal(row.summary_attempts,0);
}));
test('actual AI reservation atomically charges one shared call and only attempted article retries',async()=>tx(async()=>{
 const{article}=await seed();await db.query("update tech_feed_articles set excerpt=repeat('x',200)where id=$1",[article.id]);await role('service_role');
 const claim=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows[0];
 assert.equal((await db.query('select summary_attempts from tech_feed_articles where id=$1',[article.id])).rows[0].summary_attempts,0);
 assert.equal((await db.query('select tech_feed_begin_summary_attempt($1,$2,$3) ok',[[article.id],[claim.lease],owner])).rows[0].ok,true);
 assert.equal((await db.query('select summary_attempts from tech_feed_articles where id=$1',[article.id])).rows[0].summary_attempts,1);
 assert.equal((await db.query('select attempts from coach_ai_usage where user_id=$1',[owner])).rows[0].attempts,1);
 await db.query('update coach_ai_usage set attempts=6 where user_id=$1',[owner]);
 assert.equal((await db.query('select tech_feed_begin_summary_attempt($1,$2,$3) ok',[[article.id],[claim.lease],owner])).rows[0].ok,false);
 assert.equal((await db.query('select summary_attempts from tech_feed_articles where id=$1',[article.id])).rows[0].summary_attempts,1);
}));

test('collection remains eligible when the same owner has exhausted AI quota',async()=>tx(async()=>{
 const{source}=await seed();await db.query("insert into coach_ai_usage(user_id,local_date,attempts)values($1,(now()at time zone 'Asia/Seoul')::date,6)",[owner]);await role('service_role');
 assert.equal((await db.query('select * from tech_feed_claim_sources($1,2)',[[owner]])).rows[0]?.id,source.id);
}));
function sqlWorkerStore(){
 return{
  startRun:async()=>(await db.query('select tech_feed_start_run()id')).rows[0].id,
  finishRun:async(id,counts,error)=>(await db.query('select tech_feed_finish_run($1,$2,$3)ok',[id,counts,error])).rows[0].ok,
  claimSources:async(pilots,limit)=>(await db.query('select * from tech_feed_claim_sources($1,$2)',[pilots,limit])).rows,
  finishSummary:async(id,lease,user,summary,status,category=null)=>(await db.query('select tech_feed_finish_summary($1,$2,$3,$4,$5,$6)ok',[id,lease,user,summary,status,category])).rows[0].ok,
  stageHn:async(id,lease,ids,high)=>(await db.query('select tech_feed_stage_hn($1,$2,$3,$4)ok',[id,lease,ids,high])).rows[0].ok,
  finishSource:async(id,lease,items,error,etag,modified,checkpoint)=>checkpoint===undefined?(await db.query('select tech_feed_finish_source($1,$2,$3,$4,$5,$6)ok',[id,lease,items,error,etag,modified])).rows[0].ok:(await db.query('select tech_feed_finish_source($1,$2,$3,$4,$5,$6,$7)ok',[id,lease,items,error,etag,modified,checkpoint])).rows[0].ok,
  claimSummaries:async pilots=>(await db.query('select * from tech_feed_claim_summaries($1)',[pilots])).rows,
  cleanup:async()=>(await db.query('select tech_feed_cleanup()')).rows[0],
 };
}
test('HN incremental snapshot resumes fifty-item checkpoints until all 120 available IDs are stored',async()=>tx(async()=>{
 const source=(await db.query("update tech_feed_sources set permission_status='approved',last_success_at=now()-interval '2 hours' where kind='hn' returning id")).rows[0];
 await db.query('insert into tech_feed_subscriptions(user_id,source_id)values($1,$2)',[owner,source.id]);await role('service_role');
 let snapshots=0;const fetched=[];
 const transport=async url=>{
  if(url.endsWith('/newstories.json')){snapshots++;return{status:200,headers:{},text:JSON.stringify(Array.from({length:120},(_,i)=>120-i))};}
  const id=Number(url.match(/item\/(\d+)/)[1]);fetched.push(id);
  return{status:200,headers:{},text:JSON.stringify({id,type:'story',title:'HN '+id,time:Math.floor(Date.now()/1000)})};
 };
 for(let i=0;i<3;i++)await runFeedWorker({store:sqlWorkerStore(),pilotIds:[owner],transport});
 assert.equal(snapshots,1);assert.equal(fetched.length,120);assert.equal(new Set(fetched).size,120);
 assert.equal((await db.query("select count(*)::int n from tech_feed_articles where title like 'HN %'")).rows[0].n,120);
 const state=(await db.query('select hn_pending_ids,hn_high_water,run_after>now()later from tech_feed_sources where id=$1',[source.id])).rows[0];
 assert.deepEqual(state.hn_pending_ids,[]);assert.equal(Number(state.hn_high_water),120);assert.equal(state.later,true);
 await runFeedWorker({store:sqlWorkerStore(),pilotIds:[owner],transport});assert.equal(snapshots,1);assert.equal(fetched.length,120);
}));

test('worker persists private run history with separate counters and sanitized partial/fatal errors',async()=>tx(async()=>{
 assert.equal((await db.query("select count(*)::int n from pg_tables where tablename='tech_feed_runs'")).rows[0].n,1);
 const{source}=await seed();
 const second=(await db.query("insert into tech_feed_sources(name,url,permission_status)values('Other','https://example.com/other','approved')returning id")).rows[0];
 await db.query('insert into tech_feed_subscriptions(user_id,source_id)values($1,$2)',[owner,second.id]);await role('service_role');
 const store=sqlWorkerStore();
 await runFeedWorker({store,pilotIds:[owner],transport:async url=>{if(url.endsWith('/rss'))throw Error('PRIVATE_KEY');return{status:200,headers:{},text:'<rss><channel><title>Empty</title></channel></rss>'};}});
 let rows=(await db.query('select * from tech_feed_runs order by started_at,id')).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].status,'partial');assert.equal(rows[0].collection_success,1);assert.equal(rows[0].collection_failed,1);assert.equal(rows[0].summary_success,0);assert.equal(rows[0].error_code,'source_failed');assert.ok(rows[0].finished_at);
 await assert.rejects(runFeedWorker({store:{...store,claimSources:async()=>{throw Error('PRIVATE_KEY')}},pilotIds:[owner]}),/PRIVATE_KEY/);
 rows=(await db.query("select * from tech_feed_runs where status='failed'")).rows;assert.equal(rows.length,1);assert.equal(rows[0].error_code,'worker_failed');assert.doesNotMatch(JSON.stringify(rows),/PRIVATE_KEY/);
 await db.exec('reset role');assert.equal((await db.query("select has_table_privilege('authenticated','tech_feed_runs','SELECT')ok")).rows[0].ok,false);
 await db.query("update tech_feed_runs set started_at=now()-interval '40 days'");await db.query('select tech_feed_cleanup()');assert.equal((await db.query('select * from tech_feed_runs')).rows.length,0);
}));

test('HN item failure retains staged snapshot through backoff and retry without relisting',async()=>tx(async()=>{
 const source=(await db.query("update tech_feed_sources set permission_status='approved',last_success_at=now()-interval '2 hours'where kind='hn'returning id")).rows[0];
 await db.query('insert into tech_feed_subscriptions(user_id,source_id)values($1,$2)',[owner,source.id]);await role('service_role');
 let listed=0,fail=true;
 const transport=async url=>{
  if(url.endsWith('/newstories.json')){listed++;if(listed>1)throw Error('must resume staged snapshot');return{status:200,headers:{},text:JSON.stringify(Array.from({length:80},(_,i)=>80-i))};}
  const id=Number(url.match(/item\/(\d+)/)[1]);if(fail&&id===20)return{status:500,headers:{},text:''};
  return{status:200,headers:{},text:JSON.stringify({id,type:'story',title:'Retry '+id,time:Math.floor(Date.now()/1000)})};
 };
 assert.equal((await runFeedWorker({store:sqlWorkerStore(),pilotIds:[owner],transport})).failed,1);
 assert.equal((await db.query('select cardinality(hn_pending_ids)n from tech_feed_sources where id=$1',[source.id])).rows[0].n,80);
 assert.equal((await db.query('select count(*)::int n from tech_feed_articles')).rows[0].n,0);
 fail=false;await db.query('update tech_feed_sources set run_after=now()where id=$1',[source.id]);
 for(let i=0;i<2;i++)await runFeedWorker({store:sqlWorkerStore(),pilotIds:[owner],transport});
 assert.equal(listed,1);assert.equal((await db.query('select count(*)::int n from tech_feed_articles')).rows[0].n,80);
}));

test('shared custom source never exposes original registrant or collection internals to another subscriber',async()=>tx(async()=>{
 await role('service_role');
 const input={url:'https://shared.example.com/rss',name:'Shared'};
 await db.query("select tech_feed_mutate($1,'add_source',$2)",[owner,input]);
 await db.query("select tech_feed_mutate($1,'add_source',$2)",[other,input]);
 await role('authenticated',other);
 assert.equal((await db.query("select id,name,url from tech_feed_sources where url='https://shared.example.com/rss'")).rows.length,1);
 for(const column of ['created_by','permission_note','lease','lease_until','summary_allowed','hn_pending_ids']){
  await db.exec('savepoint private_column');
  await assert.rejects(db.query('select '+column+' from tech_feed_sources'),/permission denied/);
  await db.exec('rollback to private_column');
 }
 await db.exec('savepoint all_columns');await assert.rejects(db.query('select * from tech_feed_sources'),/permission denied/);await db.exec('rollback to all_columns');
}));

for(const category of ['news','practice','deep_dive','invalid',null])test('successful summary persists category '+String(category)+' with strict enum fallback',async()=>tx(async()=>{
 const{article}=await seed();await db.query("update tech_feed_articles set excerpt=repeat('x',200)where id=$1",[article.id]);await role('service_role');
 const claim=(await db.query('select * from tech_feed_claim_summaries($1)',[[owner]])).rows[0];
 assert.equal((await db.query('select tech_feed_begin_summary_attempt($1,$2,$3)ok',[[article.id],[claim.lease],owner])).rows[0].ok,true);
 assert.equal((await db.query("select tech_feed_finish_summary($1,$2,$3,$4,'ready',$5)ok",[article.id,claim.lease,owner,{technology:'기술',change:'변경',usage:'활용'},category])).rows[0].ok,true);
 const row=(await db.query('select summary,summary_status,category from tech_feed_articles where id=$1',[article.id])).rows[0];
 assert.equal(row.summary_status,'ready');assert.equal(row.category,['news','practice','deep_dive'].includes(category)?category:null);assert.deepEqual(Object.keys(row.summary).sort(),['change','technology','usage']);
}));

test('real worker stores AI category in the same summary call without an extra quota reservation',async()=>tx(async()=>{
 const{article}=await seed();await db.query("update tech_feed_articles set excerpt=repeat('x',200)where id=$1",[article.id]);await role('service_role');let calls=0;
 const result=await runFeedWorker({store:sqlWorkerStore(),pilotIds:[owner],transport:async()=>({status:304,headers:{},text:''}),
  ask:async(user,messages,signal,claims)=>{
   calls++;assert.equal((await db.query('select tech_feed_begin_summary_attempt($1,$2,$3)ok',[claims.map(x=>x.article.id),claims.map(x=>x.lease),user])).rows[0].ok,true);
   return{text:JSON.stringify({items:[{id:article.id,technology:'기술',change:'변경',usage:'활용',category:'deep_dive'}]})};
  }});
 assert.equal(result.summarized,1);assert.equal(calls,1);assert.equal((await db.query('select category from tech_feed_articles where id=$1',[article.id])).rows[0].category,'deep_dive');
 assert.equal((await db.query('select attempts from coach_ai_usage where user_id=$1',[owner])).rows[0].attempts,1);
}));

test('latest uses publication time with undated discovery fallback and stable pagination',async()=>tx(async()=>{
 const{source}=await seed();await db.query('delete from tech_feed_articles');
 for(let i=0;i<26;i++){
  const id='40000000-0000-0000-0000-'+String(i+1).padStart(12,'0');
  const row=(await db.query("insert into tech_feed_articles(id,title,url,published_at)values($1,$2,$3,case when $4::int=25 then null else '2020-01-01'::timestamptz+((25-$4::int)||' days')::interval end)returning id",[id,'Published '+i,'https://example.com/published-'+i,i])).rows[0];
  await db.query('insert into tech_feed_article_sources(article_id,source_id,guid)values($1,$2,$3)',[row.id,source.id,'published-'+i]);
 }
 assert.equal((await db.query('select count(distinct discovered_at)::int n from tech_feed_articles')).rows[0].n,1);
 await role('service_role');
 const first=(await db.query("select tech_feed_list($1,'latest',null,null,null) result",[owner])).rows[0].result;
 assert.deepEqual(first.items.map(x=>x.title),['Published 25',...Array.from({length:19},(_,i)=>'Published '+i)]);
 const second=(await db.query("select tech_feed_list($1,'latest',null,null,$2) result",[owner,first.next_cursor])).rows[0].result;
 assert.deepEqual(second.items.map(x=>x.title),Array.from({length:6},(_,i)=>'Published '+(i+19)));
 assert.equal(second.next_cursor,null);
 const index=(await db.query("select indexdef from pg_indexes where indexname='tech_feed_article_order'")).rows[0].indexdef;
 assert.match(index,/COALESCE\(published_at, discovered_at\).*DESC, id DESC/i);
}));
