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
 for(const name of readdirSync('supabase/migrations').filter(n=>/_tech_feed(?:_web_search|_manual_refresh|_immediate_refresh|_korean_translation|_media)?\.sql$/.test(n)).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
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

test('media cache leases are shared, source-bound and private',()=>tx(async()=>{
 const id=await seed();const jobs=await rpc('tech_feed_media_claim',[a],3);assert.equal(jobs.length,1);
 const job=jobs[0];assert.equal(await rpc('tech_feed_media_allowed',id,job.lease),true);
 assert.deepEqual(await rpc('tech_feed_media_claim',[a],3),[]);
 assert.equal(await rpc('tech_feed_media_finish',id,job.lease,{image_url:'https://cdn.example.com/a.png',video:{provider:'youtube',id:'M7lc1UVf-VE'}},null),true);
 const item=(await rpc('tech_feed_list',a)).items[0];assert.equal(item.media.image_url,'https://cdn.example.com/a.png');
 assert.equal((await rpc('tech_feed_list',b)).items.length,0);await configure(b);
 assert.deepEqual(await rpc('tech_feed_media_claim',[b],3),[]);assert.equal((await rpc('tech_feed_list',b)).items[0].media.video.provider,'youtube');
 await db.query("update tech_feed_articles set url='https://example.com/changed'where id=$1",[id]);
 assert.equal((await rpc('tech_feed_list',a)).items[0].media,null);
 assert.equal((await rpc('tech_feed_media_claim',[a],3)).length,1);
}));
test('pause, stale lease and failed metadata retain text without repeated fetching',()=>tx(async()=>{
 const id=await seed();let [job]=await rpc('tech_feed_media_claim',[a],3);
 await rpc('tech_feed_receiving',a,false,1);assert.equal(await rpc('tech_feed_media_allowed',id,job.lease),false);
 await rpc('tech_feed_media_finish',id,job.lease,{},'deferred');
 await rpc('tech_feed_receiving',a,true,2);[job]=await rpc('tech_feed_media_claim',[a],3);
 assert.equal(await rpc('tech_feed_media_finish',id,'00000000-0000-4000-8000-000000000099',{},null),false);
 await rpc('tech_feed_media_finish',id,job.lease,{},'media_unavailable');assert.deepEqual(await rpc('tech_feed_media_claim',[a],3),[]);
 const item=(await rpc('tech_feed_list',a)).items[0];assert.equal(item.title,'AI update');assert.equal(item.media,null);
 for(const role of ['anon','authenticated']){
  assert.equal((await db.query("select has_table_privilege($1,'tech_feed_media','SELECT')ok",[role])).rows[0].ok,false);
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname like 'tech_feed_media_%'and has_function_privilege($1,oid,'execute')",[role])).rows[0].n,0);
 }
}));
