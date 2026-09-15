import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
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
 for(const name of readdirSync('supabase/migrations').filter(n=>/_tech_feed(?:_web_search|_manual_refresh|_immediate_refresh|_korean_translation|_media|_daily_briefing|_ai_budget)?\.sql$/.test(n)).sort())await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
});
after(async()=>db?.close());
async function tx(work){await db.exec(`begin;set local role service_role`);try{await work();}finally{await db.exec('rollback');}}
const call=async(sql,...args)=>(await db.query(sql,args)).rows[0]?.value;
const usage=async user=>(await db.query('select attempts,calls from public.coach_ai_usage where user_id=$1',[user])).rows[0]||{attempts:0,calls:0};

test('the shared daily budget is 15 actual calls, not the legacy 6',async()=>{
 await tx(async()=>{
  for(let i=1;i<=15;i++)assert.equal(await call('select public.coach_reserve_ai($1) value',owner),true,'call '+i+' must be allowed');
  assert.equal(await call('select public.coach_reserve_ai($1) value',owner),false,'the 16th user call is refused');
  const row=await usage(owner);
  assert.equal(row.attempts,15);
  assert.equal(row.calls,15,'every reservation also counts one non-refundable provider call');
 });
});

test('the background worker stops at its own lower cap so user actions keep budget',async()=>{
 await tx(async()=>{
  // The worker passes an explicit cap; a shared 15 budget must still reserve room for clicks.
  for(let i=1;i<=12;i++)assert.equal(await call('select public.coach_reserve_ai($1,12) value',owner),true,'worker call '+i);
  assert.equal(await call('select public.coach_reserve_ai($1,12) value',owner),false,'worker cannot pass its cap');
  // The user-initiated path still has the remainder of the shared budget.
  for(let i=13;i<=15;i++)assert.equal(await call('select public.coach_reserve_ai($1) value',owner),true,'user call '+i);
  assert.equal(await call('select public.coach_reserve_ai($1) value',owner),false);
 });
});

test('a refunded failure returns budget but never forgets the actual provider call',async()=>{
 await tx(async()=>{
  assert.equal(await call('select public.coach_reserve_ai($1) value',owner),true);
  assert.equal(await call('select public.coach_reserve_ai($1) value',owner),true);
  assert.deepEqual(await usage(owner),{attempts:2,calls:2});
  assert.equal(await call('select public.coach_refund_ai($1) value',owner),true);
  const row=await usage(owner);
  assert.equal(row.attempts,1,'a provider/validation failure is not charged to the user');
  assert.equal(row.calls,2,'the call still happened and stays counted');
 });
});

test('refunding never goes below zero and a ceiling still bounds an endless retry loop',async()=>{
 await tx(async()=>{
  assert.equal(await call('select public.coach_refund_ai($1) value',owner),false,'nothing to refund yet');
  assert.equal((await usage(owner)).attempts,0);
  // Reserve-then-refund forever would be unbounded without a non-refundable ceiling.
  let allowed=0;
  for(let i=0;i<60;i++){
   if(await call('select public.coach_reserve_ai($1) value',owner)){allowed++;await call('select public.coach_refund_ai($1) value',owner);}
   else break;
  }
  assert.equal(allowed,40,'the hard provider-call ceiling stops the loop at 40');
  assert.equal((await usage(owner)).calls,40);
 });
});

test('budget stays isolated per owner and per local date',async()=>{
 await tx(async()=>{
  for(let i=1;i<=15;i++)await call('select public.coach_reserve_ai($1) value',owner);
  assert.equal(await call('select public.coach_reserve_ai($1) value',owner),false);
  assert.equal(await call('select public.coach_reserve_ai($1) value',other),true,'another owner is unaffected');
  assert.equal((await usage(other)).attempts,1);
 });
});
