import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {runBriefing} from './tech-feed-briefing.mjs';
const owner='00000000-0000-4000-8000-000000000101',other='00000000-0000-4000-8000-000000000102';
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
 insert into auth.users values('${owner}'),('${other}');insert into profiles values('${owner}','Asia/Tokyo'),('${other}','Asia/Tokyo');`);
 await db.exec(readFileSync('supabase/migrations/20260906083030_studyroom_v2_coach.sql','utf8'));
 for(const name of readdirSync('supabase/migrations').filter(n=>/_tech_feed(?:_web_search|_manual_refresh|_immediate_refresh|_korean_translation|_media|_daily_briefing)?\.sql$/.test(n)).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
});
after(async()=>db?.close());
async function tx(work){await db.exec(`begin;set local role service_role`);try{await work();}finally{await db.exec('rollback');}}
async function rpc(name,...args){return(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}
async function seed(count=21){
 const source=(await db.query("insert into tech_feed_sources(name,url,permission_status,summary_allowed)values('Fixture','https://fixture.test/rss','approved',true)returning id")).rows[0].id;
 await db.query('insert into tech_feed_subscriptions(user_id,source_id)values($1,$2)',[owner,source]);
 const ids=[];for(let i=0;i<count;i++){
  const id=(await db.query(`insert into tech_feed_articles(url,title,excerpt,excerpt_source_id,discovered_at,published_at,interests)
   values($1,$2,$3,$4,'2026-09-13T15:00:00Z','2020-01-01',array['cloud'])returning id`,['https://fixture.test/a'+i,'AWS release '+i,'AWS infrastructure release. '.repeat(10),source])).rows[0].id;
  await db.query('insert into tech_feed_article_sources values($1,$2,$3)',[id,source,String(i)]);ids.push(id);
 }
 return{source,ids};
}
const snapshot=(user=owner,now='2026-09-14T03:00:00Z')=>rpc('tech_feed_briefing_snapshot',user,1,now);
async function todaySeed(count=2){const data=await seed(count);await db.exec('update tech_feed_articles set discovered_at=now()');return data;}
test('real SQL orchestration returns cited cache, no automatic calls, and one shared reservation',()=>tx(async()=>{
 await todaySeed(4);let calls=0;
 const store={briefingSnapshot:(version)=>rpc('tech_feed_briefing_snapshot',owner,version),
 claimBriefing:(version,hash,ids)=>rpc('tech_feed_briefing_claim',owner,version,hash,ids),
 reserveBriefing:(lease)=>rpc('tech_feed_briefing_reserve',owner,lease),
 finishBriefing:(lease,result,error)=>rpc('tech_feed_briefing_finish',owner,lease,result,error)};
 const env={TECH_FEED_ENABLED:'true',OPENROUTER_API_KEY:'synthetic',OPENROUTER_MODEL:'openrouter/free'};
 const ask=async(messages,signal,reserve)=>{assert.equal(await reserve(),true);calls++;const input=JSON.parse(messages[1].content);
 return{text:JSON.stringify({insights:[{title:'릴리즈',body:'실제 소개의 공통 변경',study_angle:'구현 비교',source_ids:[input.articles[0].id]}]})};};
 assert.equal((await runBriefing({store,ask,env})).status,'idle');assert.equal(calls,0);
 const result=await runBriefing({store,ask,env,generate:true});assert.equal(result.status,'ready');assert.equal(result.total,4);assert.equal(result.analyzed_count,4);assert.equal(result.insights[0].sources.length,1);
 assert.equal((await runBriefing({store,ask,env,generate:true})).status,'ready');assert.equal(calls,1);
}));
test('web-search source facets expose normalized host and saved/latest source filters agree',()=>tx(async()=>{
 await rpc('tech_feed_configure',owner,'AWS Lambda','aws lambda',true,0);const search=await rpc('tech_feed_search_claim',[owner]);await rpc('tech_feed_search_reserve',search.id,search.lease,900);
 await rpc('tech_feed_search_finish',search.id,search.lease,[{title:'AWS release',url:'https://Example.COM/blog/article',excerpt:'A substantive public introduction. '.repeat(10),interests:['cloud']}],null);
 const all=await rpc('tech_feed_filter_candidates',owner,'latest');assert.deepEqual(all.items[0].sources,[{value:'host:example.com',label:'example.com'}]);
 const id=all.items[0].id;await db.query('insert into tech_feed_bookmarks(user_id,article_id)values($1,$2)',[owner,id]);
 for(const view of ['saved','latest'])assert.equal((await rpc('tech_feed_list',owner,view,'cloud',null,null,'host:example.com',null)).total,1);
 assert.equal((await rpc('tech_feed_filter_candidates',other,'latest')).items.length,0);
}));
test('cleanup removes only a bounded hundred old briefing snapshots and retains recent rows',()=>tx(async()=>{
 await db.query("insert into tech_feed_briefings(user_id,local_date,time_zone,analyzer_version,updated_at)select $1,current_date-i,'Asia/Tokyo',1,now()-interval '91 days'from generate_series(1,105)i",[owner]);
 await db.query("insert into tech_feed_briefings(user_id,local_date,time_zone,analyzer_version)values($1,current_date,'Asia/Tokyo',1)",[owner]);
 await rpc('tech_feed_cleanup');assert.equal((await db.query('select count(*)::int n from tech_feed_briefings')).rows[0].n,6);
}));
test('today spans the server zone DST boundary rather than a fixed 24-hour interval',()=>tx(async()=>{
 const {source}=await seed(0);await db.query("update profiles set time_zone='America/New_York'where user_id=$1",[owner]);
 for(const [label,date]of [['before','2026-11-01T03:59:59Z'],['start','2026-11-01T04:00:00Z'],['late','2026-11-02T04:59:59Z'],['next','2026-11-02T05:00:00Z']]){
  const id=(await db.query('insert into tech_feed_articles(title,url,discovered_at)values($1,$2,$3)returning id',[label,'https://fixture.test/'+label,date])).rows[0].id;
  await db.query('insert into tech_feed_article_sources values($1,$2,$3)',[id,source,label]);
 }
 const value=await snapshot(owner,'2026-11-01T16:00:00Z');assert.equal(value.local_date,'2026-11-01');assert.deepEqual(value.articles.map(a=>a.title).sort(),['late','start']);
}));
test('daily interval uses owner timezone and discovered_at, excludes boundaries and deduplicates origins beyond 20 rows',()=>tx(async()=>{
 const {source,ids}=await seed();
 await db.query("insert into tech_feed_articles(url,title,discovered_at)values('https://fixture.test/old','Old','2026-09-13T14:59:00Z'),('https://fixture.test/next','Next','2026-09-14T15:00:00Z')");
 await db.query("insert into tech_feed_article_sources select id,$1,url from tech_feed_articles where title in('Old','Next')",[source]);
 const second=(await db.query("insert into tech_feed_sources(name,url)values('Duplicate','https://duplicate.test/rss')returning id")).rows[0].id;
 await db.query('insert into tech_feed_subscriptions values($1,$2,true,now());',[owner,second]);
 await db.query('insert into tech_feed_article_sources values($1,$2,$3)',[ids[0],second,'dup']);
 const s=await snapshot();assert.equal(s.local_date,'2026-09-14');assert.equal(s.time_zone,'Asia/Tokyo');assert.equal(s.articles.length,21);
 assert.equal((await snapshot(other)).articles.length,0);
 const first=await rpc('tech_feed_list',owner);assert.equal(first.items.length,20);
 const page=await rpc('tech_feed_list',owner,'latest',null,null,first.next_cursor);assert.equal(page.items.length,3);
 assert.equal((await rpc('tech_feed_filter_candidates',owner,'latest')).items.length,23);
}));
test('saved legacy and new source/id filters match latest while retaining media/translation mapping',()=>tx(async()=>{
 const {source,ids}=await seed(2);await db.query('insert into tech_feed_bookmarks(user_id,article_id)select $1,unnest($2::uuid[])',[owner,ids]);
 const filtered=await rpc('tech_feed_list',owner,'saved','frontend',null,null,null,null);assert.equal(filtered.items.length,0);
 const page=await rpc('tech_feed_list',owner,'saved','cloud',source,null,'rss:'+source,[ids[0]]);assert.equal(page.items.length,1);assert.equal(page.items[0].id,ids[0]);
 assert.equal(page.items[0].sources[0].name,'Fixture');assert.equal(page.items[0].translation_status,'pending');assert.equal(page.items[0].media,null);
 assert.ok(Array.isArray(page.items[0].topics));
 assert.equal((await rpc('tech_feed_list',owner,'saved',null,null,null,'host:unrelated.test',null)).items.length,0);
}));
test('classification claims are capped at 50, leased, content-revalidated and version-idempotent',()=>tx(async()=>{
 await seed(55);const jobs=await rpc('tech_feed_classification_claim',1,90);assert.equal(jobs.length,50);
 assert.equal((await rpc('tech_feed_classification_claim',1,90)).length,5);
 const j=jobs[0];await db.query("update tech_feed_articles set title='changed'where id=$1",[j.id]);
 assert.equal(await rpc('tech_feed_classification_finish',j.id,j.lease,1,'news','rules',['AWS']),false);
 for(const job of jobs.slice(1))assert.equal(await rpc('tech_feed_classification_finish',job.id,job.lease,1,'news','rules',['AWS']),true);
 assert.equal((await rpc('tech_feed_classification_claim',1,50)).length,0);
}));
test('later AI classification replaces rules provenance and is not downgraded by a stale rules job',()=>tx(async()=>{
 const{ids}=await todaySeed();let[j]=await rpc('tech_feed_classification_claim',1,1);
 await rpc('tech_feed_classification_finish',j.id,j.lease,1,'news','rules',['AWS']);
 await db.query("update tech_feed_articles set summary_lease=gen_random_uuid(),summary_lease_until=now()+interval '90 seconds',summary_attempt_lease=null where id=$1",[j.id]);
 await db.query('update tech_feed_articles set summary_attempt_lease=summary_lease where id=$1',[j.id]);
 const lease=(await db.query('select summary_lease from tech_feed_articles where id=$1',[j.id])).rows[0].summary_lease;
 assert.equal(await rpc('tech_feed_finish_summary',j.id,lease,owner,{technology:'A',change:'B',usage:'C'},'ready','practice'),true);
 const row=(await db.query('select category,category_method from tech_feed_articles where id=$1',[j.id])).rows[0];assert.deepEqual(row,{category:'practice',category_method:'ai'});
}));
test('classification batch finishes at most 50 current leased records in one RPC',()=>tx(async()=>{
 await seed(3);const jobs=await rpc('tech_feed_classification_claim',1,50);
 const result=await rpc('tech_feed_classification_finish_batch',jobs.map(j=>({...j,rules_version:1,category:'news',method:'rules',tags:['AWS']})));
 assert.deepEqual(result,{classified:3,stale:0});assert.deepEqual(await rpc('tech_feed_classification_claim',1,50),[]);
}));
test('readonly snapshot is free; claim coalesces leases and success cache never reserves again',()=>tx(async()=>{
 const{ids}=await todaySeed();const s=await rpc('tech_feed_briefing_snapshot',owner,1);
 assert.equal((await db.query('select count(*)::int n from coach_ai_usage')).rows[0].n,0);
 const claim=await rpc('tech_feed_briefing_claim',owner,1,s.input_hash,ids);assert.equal(claim.status,'claimed');
 assert.equal((await rpc('tech_feed_briefing_claim',owner,1,s.input_hash,ids)).status,'generating');
 assert.equal((await rpc('tech_feed_briefing_reserve',owner,claim.lease)).status,'reserved');
 assert.equal((await rpc('tech_feed_briefing_reserve',owner,claim.lease)).status,'generating');
 const result={insights:[{title:'흐름',body:'설명',study_angle:'관점',source_ids:ids}],analyzed_count:2};
 assert.equal(await rpc('tech_feed_briefing_finish',owner,claim.lease,result,null),true);
 assert.equal((await rpc('tech_feed_briefing_claim',owner,1,s.input_hash,ids)).status,'ready');
 assert.equal((await db.query('select attempts from coach_ai_usage where user_id=$1',[owner])).rows[0].attempts,1);
 assert.equal((await rpc('tech_feed_briefing_snapshot',other,1)).cache,null);
}));
test('revoked excerpt permission cannot be substituted with another approved mapping; stale completion fails',()=>tx(async()=>{
 const{source,ids}=await todaySeed();const s=await rpc('tech_feed_briefing_snapshot',owner,1);
 const claim=await rpc('tech_feed_briefing_claim',owner,1,s.input_hash,ids);await rpc('tech_feed_briefing_reserve',owner,claim.lease);
 await db.query('update tech_feed_subscriptions set subscribed=false where source_id=$1',[source]);
 assert.equal(await rpc('tech_feed_briefing_finish',owner,claim.lease,{insights:[],analyzed_count:2},null),false);
 assert.equal((await rpc('tech_feed_briefing_snapshot',owner,1)).cache,null);
 assert.equal((await rpc('tech_feed_briefing_reserve',owner,claim.lease)).status,'unavailable');
}));
test('uncited sample permission loss hides a cached briefing; pausing alone preserves it without quota',()=>tx(async()=>{
 const {source,ids}=await todaySeed(3);const s=await rpc('tech_feed_briefing_snapshot',owner,1);
 const c=await rpc('tech_feed_briefing_claim',owner,1,s.input_hash,ids);await rpc('tech_feed_briefing_reserve',owner,c.lease);
 await rpc('tech_feed_briefing_finish',owner,c.lease,{insights:[{title:'t',body:'b',study_angle:'s',source_ids:[ids[0]]}],analyzed_count:3},null);
 await rpc('tech_feed_configure',owner,'AWS Lambda','aws lambda',false,0);
 let read=await rpc('tech_feed_briefing_snapshot',owner,1);assert.equal(read.receiving,false);assert.ok(read.cache);
 assert.equal((await rpc('tech_feed_briefing_claim',owner,1,read.input_hash,ids)).status,'paused');
 const another=(await db.query("insert into tech_feed_sources(name,url,permission_status,summary_allowed)values('Other','https://other.test/rss','approved',false)returning id")).rows[0].id;
 await db.query('insert into tech_feed_subscriptions(user_id,source_id)values($1,$2)',[owner,another]);
 await db.query('insert into tech_feed_article_sources values($1,$2,$3)',[ids[2],another,'other']);
 await db.query('update tech_feed_articles set excerpt_source_id=$1 where id=$2',[another,ids[2]]);
 assert.equal((await rpc('tech_feed_list',owner)).items.length,3);
 assert.equal((await rpc('tech_feed_briefing_snapshot',owner,1)).cache,null);
 assert.equal((await db.query('select attempts from coach_ai_usage where user_id=$1',[owner])).rows[0].attempts,1);
}));
test('existing six-call quota caps briefing and expired/replaced leases cannot finish',()=>tx(async()=>{
 const{ids}=await todaySeed();for(let i=0;i<6;i++)assert.equal(await rpc('coach_reserve_ai',owner),true);
 const s=await rpc('tech_feed_briefing_snapshot',owner,1);const c=await rpc('tech_feed_briefing_claim',owner,1,s.input_hash,ids);
 assert.equal((await rpc('tech_feed_briefing_reserve',owner,c.lease)).status,'quota_exhausted');
 await db.query("update tech_feed_briefings set lease_until=now()-interval '1 second'where user_id=$1",[owner]);
 const newer=await rpc('tech_feed_briefing_claim',owner,1,s.input_hash,ids);assert.notEqual(newer.lease,c.lease);
 assert.equal(await rpc('tech_feed_briefing_finish',owner,c.lease,null,'unavailable'),false);
 assert.equal((await db.query('select attempts from coach_ai_usage where user_id=$1',[owner])).rows[0].attempts,6);
}));
test('cache is stale on new content but hidden after access removal, and owner table has no client write grant',()=>tx(async()=>{
 const{source,ids}=await todaySeed();let s=await rpc('tech_feed_briefing_snapshot',owner,1);
 const c=await rpc('tech_feed_briefing_claim',owner,1,s.input_hash,ids);await rpc('tech_feed_briefing_reserve',owner,c.lease);
 await rpc('tech_feed_briefing_finish',owner,c.lease,{insights:[{title:'a',body:'b',study_angle:'c',source_ids:ids}],analyzed_count:2},null);
 await db.query("update tech_feed_articles set excerpt=excerpt||' new'where id=$1",[ids[0]]);
 s=await rpc('tech_feed_briefing_snapshot',owner,1);assert.equal(s.cache.stale,true);
 await db.query('update tech_feed_subscriptions set subscribed=false where source_id=$1',[source]);
 assert.equal((await rpc('tech_feed_briefing_snapshot',owner,1)).cache,null);
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query("select has_table_privilege($1,'tech_feed_briefings','INSERT,UPDATE,DELETE')ok",[role])).rows[0].ok,false);
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname like 'tech_feed_briefing_%'and has_function_privilege($1,oid,'execute')",[role])).rows[0].n,0);
 }
 await db.exec(`set local role authenticated;set local "request.uid"='${other}'`);assert.equal((await db.query('select user_id from tech_feed_briefings')).rows.length,0);
 assert.equal((await db.query("select has_column_privilege('authenticated','tech_feed_briefings','result','SELECT')ok")).rows[0].ok,false);
}));
