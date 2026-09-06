import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const owner='00000000-0000-4000-8000-000000000101';
const other='00000000-0000-4000-8000-000000000102';
let db;
before(async()=>{
  db=new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema coaching_private;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
    grant usage on schema auth,public,coaching_private to anon,authenticated,service_role;
    create table public.profiles(user_id uuid primary key references auth.users,time_zone text default 'Asia/Seoul');
    create table public.study_todos(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,local_date date,title text,is_completed boolean default false,start_time time,end_time time);
    grant all on public.profiles,public.study_todos to service_role;
    insert into auth.users values('${owner}'),('${other}');
    insert into public.profiles(user_id) values('${owner}'),('${other}');
  `);
  const folder=process.env.COACH_MIGRATIONS_DIR||resolve('supabase/migrations');
  // pg_cron/pg_net are production extensions, verified against Supabase after deployment.
  for(const name of readdirSync(folder).filter(n=>/studyroom_v2.*\.sql$/.test(n) && !n.endsWith('_cron.sql')).sort()) {
    await db.exec(readFileSync(resolve(folder,name),'utf8'));
  }
  const tables=await db.query("select count(*)::int n from pg_tables where tablename='coach_settings'");
  assert.equal(tables.rows[0].n,1,'new migrations were loaded');
});
after(async()=>{await db?.close();});
async function transaction(run){await db.exec('begin');try{await run();}finally{await db.exec('rollback');}}
async function asRole(role,user=owner){await db.exec(`set local role ${role}; select set_config('request.jwt.claims','${JSON.stringify({role,sub:user,is_anonymous:false})}',true);`);}
async function seed(){
  await db.exec(`insert into coach_settings(user_id,enabled,availability) values('${owner}',true,'[{"weekday":0,"start":"08:00","end":"20:00"},{"weekday":1,"start":"08:00","end":"20:00"},{"weekday":2,"start":"08:00","end":"20:00"},{"weekday":3,"start":"08:00","end":"20:00"},{"weekday":4,"start":"08:00","end":"20:00"},{"weekday":5,"start":"08:00","end":"20:00"},{"weekday":6,"start":"08:00","end":"20:00"}]');`);
  const career=(await db.query(`insert into coach_careers(user_id,title,confirmed) values($1,'API 개발',true) returning id`,[owner])).rows[0].id;
  const r=(await db.query(`insert into coach_recommendations(user_id,career_id,local_date,title,reason,acceptance,duration_minutes,start_at,end_at,source,payload)
    select $1,$2,(now() at time zone 'Asia/Seoul')::date+1,'테스트 작성','다음 실습','테스트 통과',25,
    (((now() at time zone 'Asia/Seoul')::date+1)+time '09:00') at time zone 'Asia/Seoul',
    (((now() at time zone 'Asia/Seoul')::date+1)+time '09:25') at time zone 'Asia/Seoul','rules','{"input_version":1}' returning *`,[owner,career])).rows[0];
  return r;
}
test('real SQL migration applies and token tables have no browser grants',async()=>transaction(async()=>{
  for(const role of ['anon','authenticated'])for(const table of ['coach_connections','coach_oauth_states','coach_ai_usage']){
    const r=await db.query(`select has_table_privilege($1,$2,'SELECT') permitted`,[role,table]);assert.equal(r.rows[0].permitted,false);
  }
  const r=await db.query("select has_function_privilege('authenticated','public.coach_mutate(uuid,text,jsonb)','EXECUTE') permitted");assert.equal(r.rows[0].permitted,false);
}));
test('owner reads are isolated by RLS and direct recommendation writes denied',async()=>transaction(async()=>{
  await seed();await asRole('authenticated',other);
  assert.equal((await db.query('select * from coach_recommendations')).rows.length,0);
  await db.exec('savepoint denied');
  await assert.rejects(db.query("update coach_recommendations set title='forged'"),/permission denied/);
  await db.exec('rollback to savepoint denied');
}));
test('actual shared AI budget permits six calls and rejects seventh and cross-user override',async()=>transaction(async()=>{
  await asRole('authenticated');
  for(let i=0;i<6;i++) assert.equal((await db.query('select coach_reserve_ai($1) allowed',[other])).rows[0].allowed,true);
  assert.equal((await db.query('select coach_reserve_ai() allowed')).rows[0].allowed,false);
  await db.exec('reset role');
  const rows=(await db.query('select user_id,attempts from coach_ai_usage')).rows;
  assert.deepEqual(rows.map(r=>[r.user_id,r.attempts]),[[owner,6]]);
}));
test('acceptance is atomic and duplicate acceptance returns the same todo',async()=>transaction(async()=>{
  const rec=await seed();await asRole('service_role');
  const accept=()=>db.query("select coach_mutate($1,'accept',$2::jsonb) result",[owner,JSON.stringify({id:rec.id})]);
  const first=(await accept()).rows[0].result,second=(await accept()).rows[0].result;
  assert.equal(first.todo_id,second.todo_id);assert.ok(first.todo_id);
  assert.equal((await db.query('select count(*)::int n from study_todos')).rows[0].n,1);
}));
test('acceptance rechecks an event added after recommendation',async()=>transaction(async()=>{
  const rec=await seed();
  await db.query(`insert into coach_events(user_id,title,start_at,end_at,time_zone) values($1,'약속',$2,$3,'Asia/Seoul')`,[owner,rec.start_at,rec.end_at]);
  await asRole('service_role');
  await assert.rejects(db.query("select coach_mutate($1,'accept',$2::jsonb)",[owner,JSON.stringify({id:rec.id})]),/schedule_conflict/);
}));
test('acceptance rechecks existing scheduled todo including buffer',async()=>transaction(async()=>{
  const rec=await seed();
  await db.query(`insert into study_todos(user_id,local_date,title,start_time,end_time) values($1,$2,'이전 작업','08:30','08:55')`,[owner,rec.local_date]);
  await asRole('service_role');
  await assert.rejects(db.query("select coach_mutate($1,'accept',$2::jsonb)",[owner,JSON.stringify({id:rec.id})]),/schedule_conflict/);
}));
test('timezone changes expire pending work without changing a date-only todo',async()=>transaction(async()=>{
  const rec=await seed();
  await db.query(`insert into study_todos(user_id,local_date,title) values($1,$2,'날짜만 있는 일')`,[owner,rec.local_date]);
  await asRole('service_role');
  await db.query("select coach_mutate($1,'settings','{\"time_zone\":\"America/New_York\"}')",[owner]);
  assert.equal((await db.query('select status from coach_recommendations where id=$1',[rec.id])).rows[0].status,'expired');
  assert.equal(String((await db.query('select local_date from study_todos')).rows[0].local_date),String(rec.local_date));
}));
test('expired lease cannot publish recommendation results',async()=>transaction(async()=>{
  await seed();await asRole('service_role');
  await db.query("select coach_enqueue($1,'recommendations')",[owner]);
  const job=(await db.query('select * from coach_claim_jobs(1)')).rows[0];
  await db.query("update coach_jobs set lease_until=now()-interval '1 second' where id=$1",[job.id]);
  const result=await db.query("select coach_save_result($1,$2,1,'{}') saved",[job.id,job.lease]);
  assert.equal(result.rows[0].saved,false);
}));
test('SQL wall-time resolver covers both DST folds and rejects missing times',async()=>transaction(async()=>{
  const r=await db.query("select coach_wall_at('2026-11-01','01:00','America/New_York',false) early,coach_wall_at('2026-11-01','01:00','America/New_York',true) late,coach_wall_at('2026-03-08','02:30','America/New_York',false) missing");
  assert.equal(new Date(r.rows[0].early).toISOString(),'2026-11-01T05:00:00.000Z');
  assert.equal(new Date(r.rows[0].late).toISOString(),'2026-11-01T06:00:00.000Z');
  assert.equal(r.rows[0].missing,null);
}));
test('adjacent study windows accept a recommendation spanning their union',async()=>transaction(async()=>{
  const rec=await seed();
  await db.query(`update coach_settings set availability=jsonb_build_array(jsonb_build_object('weekday',extract(dow from $2::date)::int,'start','09:00','end','09:15'),jsonb_build_object('weekday',extract(dow from $2::date)::int,'start','09:15','end','09:30')) where user_id=$1`,[owner,rec.local_date]);
  await asRole('service_role');
  const r=await db.query("select coach_mutate($1,'accept',$2::jsonb) result",[owner,JSON.stringify({id:rec.id})]);
  assert.ok(r.rows[0].result.todo_id);
}));
test('manual edit of a coach todo updates its instant before timezone changes',async()=>transaction(async()=>{
  const rec=await seed();await asRole('service_role');
  const id=(await db.query("select coach_mutate($1,'accept',$2::jsonb) result",[owner,JSON.stringify({id:rec.id})])).rows[0].result.todo_id;
  await db.query("update study_todos set start_time='11:00',end_time='11:25' where id=$1",[id]);
  const before=(await db.query('select coach_start_at,coach_end_at from study_todos where id=$1',[id])).rows[0];
  assert.equal(new Date(before.coach_start_at).getUTCHours(),2);
  await db.query("select coach_mutate($1,'settings','{\"time_zone\":\"America/New_York\"}')",[owner]);
  const after=(await db.query('select coach_start_at,coach_end_at from study_todos where id=$1',[id])).rows[0];
  assert.equal(String(after.coach_start_at),String(before.coach_start_at));
  assert.equal(String(after.coach_end_at),String(before.coach_end_at));
}));
test('all-day events keep their calendar date after changing timezone',async()=>transaction(async()=>{
  const rec=await seed();
  await db.query(`update profiles set time_zone='America/New_York' where user_id=$1`,[owner]);
  await db.query(`update coach_recommendations set start_at=($2::date+time '18:00') at time zone 'America/New_York',end_at=($2::date+time '18:25') at time zone 'America/New_York' where id=$1`,[rec.id,rec.local_date]);
  await db.query(`insert into coach_events(user_id,title,all_day,start_date,end_date,time_zone) values($1,'종일 약속',true,$2::date,$2::date+1,'Asia/Seoul')`,[owner,rec.local_date]);
  await asRole('service_role');
  await assert.rejects(db.query("select coach_mutate($1,'accept',$2::jsonb)",[owner,JSON.stringify({id:rec.id})]),/schedule_conflict/);
}));
test('OAuth completion cannot restore a disconnected authorization attempt',async()=>transaction(async()=>{
  await db.query(`insert into coach_oauth_states(id,user_id,provider,expires_at,config) values('state-test',$1,'google',now()+interval '10 minutes','{"claim_id":"claim-test"}')`,[owner]);
  await asRole('service_role');
  await db.query("select coach_disconnect($1,'google')",[owner]);
  const r=await db.query("select coach_complete_connection('state-test','claim-test','google','{}','encrypted-fixture') completed");
  assert.equal(r.rows[0].completed,false);
  assert.equal((await db.query('select count(*)::int n from coach_connections')).rows[0].n,0);
}));
test('OAuth completion is single use and disconnect clears stored credentials',async()=>transaction(async()=>{
  await db.query(`insert into coach_oauth_states(id,user_id,provider,expires_at,config) values('state-test',$1,'google',now()+interval '10 minutes','{"claim_id":"claim-test"}')`,[owner]);
  await asRole('service_role');
  for(const expected of [true,false])assert.equal((await db.query("select coach_complete_connection('state-test','claim-test','google','{}','encrypted-fixture') completed")).rows[0].completed,expected);
  await db.query("select coach_disconnect($1,'google')",[owner]);
  const r=(await db.query('select status,encrypted_credentials from coach_connections')).rows[0];
  assert.equal(r.status,'disconnected');assert.equal(r.encrypted_credentials,null);
}));

test('repository selection cannot resurrect a disconnected or replaced authorization',async()=>transaction(async()=>{
  await seed();
  const connection=(await db.query("insert into coach_connections(user_id,provider,status,config) values($1,'github','connected','{\"authorization_version\":\"current\"}') returning id",[owner])).rows[0].id;
  await asRole('service_role');
  const select=async(version,selected=true)=>(await db.query("select coach_select_repository($1,$2,$3::jsonb,'{\"owner\":\"fixture\",\"name\":\"demo\",\"private\":true,\"ai_enabled\":true}',$4) saved",[owner,connection,JSON.stringify({authorization_version:version}),selected])).rows[0].saved;
  assert.equal(await select('old'),false);
  assert.equal(await select('current'),true);
  assert.equal((await db.query('select count(*)::int n from coach_repositories')).rows[0].n,1);
  assert.equal(await select('current',false),true);
  assert.equal((await db.query('select count(*)::int n from coach_repositories')).rows[0].n,0);
  await db.query("select coach_disconnect($1,'github')",[owner]);
  assert.equal(await select('current'),false);
  assert.equal((await db.query('select count(*)::int n from coach_repositories')).rows[0].n,0);
}));

for(const provider of ['google','github']) test(`${provider} stale leases and disabled coach cannot publish integration results`,async()=>transaction(async()=>{
  await seed();
  const connection=(await db.query("insert into coach_connections(user_id,provider,status,config) values($1,$2,'connected','{\"authorization_version\":\"current\"}') returning id",[owner,provider])).rows[0].id;
  let repository;
  if(provider==='github') repository=(await db.query("insert into coach_repositories(user_id,connection_id,owner,name,ai_enabled) values($1,$2,'fixture','demo',true) returning id",[owner,connection])).rows[0].id;
  await asRole('service_role');
  await db.query('select coach_enqueue($1,$2)',[owner,provider==='google'?'google_sync':'github_analysis']);
  const job=(await db.query('select * from coach_claim_jobs(1)')).rows[0];
  const publish=async(lease=job.lease)=>{
    const result=provider==='google'
      ? await db.query("select coach_google_snapshot($1,$2,'[]','{\"authorization_version\":\"current\"}',$3,$4) saved",[owner,connection,job.id,lease])
      : await db.query("select coach_repository_result($1,$2,$3,'{\"authorization_version\":\"current\"}',true,'verified-sha','[]',$4,$5) saved",[owner,repository,connection,job.id,lease]);
    return result.rows[0].saved;
  };
  assert.equal(await publish(other),false,'wrong lease rejected');
  assert.equal(await publish(),true,'current lease accepted');
  await db.query("update coach_jobs set lease_until=clock_timestamp()-interval '1 second' where id=$1",[job.id]);
  assert.equal(await publish(),false,'expired lease rejected');
  await db.query("update coach_jobs set lease_until=clock_timestamp()+interval '1 minute' where id=$1",[job.id]);
  await db.query('update coach_settings set enabled=false where user_id=$1',[owner]);
  assert.equal(await publish(),false,'disabled coach rejected');
}));
