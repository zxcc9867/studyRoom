import {runTranslationWorker} from './tech-feed-translation-worker.mjs';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
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
 for(const name of readdirSync('supabase/migrations').filter(n=>/_tech_feed(?:_web_search|_manual_refresh|_immediate_refresh|_korean_translation)?\.sql$/.test(n)).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
});
after(async()=>db?.close());
async function tx(work){await db.exec('begin');try{await work();}finally{await db.exec('rollback');}}
async function rpc(name,...args){return(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}
async function configure(user=a,topic='AWS Lambda',revision=0){return rpc('tech_feed_configure',user,topic,topic.toLowerCase(),true,revision);}
async function begin(user=a,revision=1){return rpc('tech_feed_refresh_begin',user,revision);}
async function finish(user,lease){return rpc('tech_feed_refresh_finish',user,lease,{state:'ready'});}


async function seed(){
 await configure();const t=await rpc('tech_feed_search_claim',[a]);await rpc('tech_feed_search_reserve',t.id,t.lease,900);
 await rpc('tech_feed_search_finish',t.id,t.lease,[{title:'AI update',excerpt:'A public update 😀',url:'https://example.com/news',interests:['ai']}],null);
 return (await db.query('select id from tech_feed_articles')).rows[0].id;
}
const claim=()=>rpc('tech_feed_translation_claim',[a],3);
const reserve=(jobs,cap=450000)=>rpc('tech_feed_translation_reserve',jobs.map(x=>x.id),jobs[0].lease,cap);
const finishTranslations=(jobs,error=null)=>rpc('tech_feed_translation_finish',jobs.map(x=>x.id),jobs[0].lease,jobs.map(x=>({id:x.id,title_ko:'AI 업데이트',excerpt_ko:'공개 업데이트 😀'})),error);

test('translation is independently reserved, cached across subscribers and private in list',()=>tx(async()=>{
 const id=await seed();let jobs=await claim();assert.equal(jobs.length,1);assert.equal(jobs[0].id,id);
 assert.deepEqual(await claim(),[]);assert.equal((await reserve(jobs)).state,'reserved');assert.equal((await reserve(jobs)).state,'deferred');
 assert.equal(await finishTranslations(jobs),true);assert.deepEqual(await claim(),[]);
 const page=await rpc('tech_feed_list',a);assert.equal(page.items[0].title_ko,'AI 업데이트');assert.equal(page.items[0].translation_status,'ready');
 assert.equal((await rpc('tech_feed_list',b)).items.length,0);await configure(b);assert.deepEqual(await rpc('tech_feed_translation_claim',[b],3),[]);
 const budget=(await db.query('select * from tech_feed_translation_budget')).rows[0];assert.equal(budget.characters,26);assert.equal(budget.attempts,1);
 assert.equal((await db.query('select count(*)::int n from coach_ai_usage')).rows[0].n,0);
}));
test('changed original never displays stale translation and can be translated again',()=>tx(async()=>{
 const id=await seed();let jobs=await claim();await reserve(jobs);await finishTranslations(jobs);
 await db.query("update tech_feed_articles set title='Changed original'where id=$1",[id]);
 let item=(await rpc('tech_feed_list',a)).items[0];assert.equal(item.title_ko,null);assert.equal(item.translation_status,'pending');
 jobs=await claim();assert.equal(jobs[0].title,'Changed original');await reserve(jobs);
 await db.query("update tech_feed_articles set excerpt='Another change'where id=$1",[id]);
 await finishTranslations(jobs);item=(await rpc('tech_feed_list',a)).items[0];assert.equal(item.title_ko,null);
}));
test('translation quota, expired leases and paused owner prevent spending',()=>tx(async()=>{
 await seed();let jobs=await claim();assert.equal((await reserve(jobs,0)).state,'quota_exhausted');
 assert.equal((await db.query('select characters from tech_feed_translation_budget')).rows[0]?.characters||0,0);
 await rpc('tech_feed_receiving',a,false,1);assert.equal((await reserve(jobs)).state,'deferred');
 await db.exec("update tech_feed_translation_provider set lease_until=now()-interval '1 second'");assert.equal(await finishTranslations(jobs),false);
}));
test('failed translation backoff keeps originals and does not refund characters',()=>tx(async()=>{
 await seed();const jobs=await claim();await reserve(jobs);await finishTranslations(jobs,'unavailable');
 assert.deepEqual(await claim(),[]);assert.equal((await db.query('select characters from tech_feed_translation_budget')).rows[0].characters,26);
 const item=(await rpc('tech_feed_list',a)).items[0];assert.equal(item.title,'AI update');assert.equal(item.title_ko,null);assert.equal(item.translation_status,'failed');
}));
test('translation tables and RPCs are inaccessible to browser roles',()=>tx(async()=>{
 for(const role of ['anon','authenticated']){
  for(const table of ['tech_feed_translations','tech_feed_translation_provider','tech_feed_translation_budget'])assert.equal((await db.query('select has_table_privilege($1,$2,\'SELECT\') ok',[role,table])).rows[0].ok,false);
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname like 'tech_feed_translation_%'and has_function_privilege($1,oid,'execute')",[role])).rows[0].n,0);
 }
}));

test('pause between usage check and reservation releases work for another subscriber without global backoff',()=>tx(async()=>{
 await seed();await configure(b);let posts=0;
 const store={claimTranslations:()=>claim(),reserveTranslation:(ids,lease,cap)=>rpc('tech_feed_translation_reserve',ids,lease,cap),finishTranslation:(ids,lease,items,error)=>rpc('tech_feed_translation_finish',ids,lease,items,error)};
 const translator={availability:()=> 'waiting',checkUsage:async()=>{await rpc('tech_feed_receiving',a,false,1);return{remaining:500000};},translate:async()=>{posts++;return[];}};
 const result=await runTranslationWorker({store,pilotIds:[a],translator});
 assert.equal(result.state,'waiting');assert.equal(result.failed,0);assert.equal(posts,0);
 assert.equal((await db.query('select count(*)::int n from tech_feed_translation_budget')).rows[0].n,0);
 const next=await rpc('tech_feed_translation_claim',[b],3);assert.equal(next.length,1);
}));
