import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('existing shared SQL quota permits six total user/server calls and isolates owners',async()=>{
 const db=new PGlite(),owner='00000000-0000-4000-8000-000000000101',other='00000000-0000-4000-8000-000000000102';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema coaching_private;create table auth.users(id uuid primary key);
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid()returns uuid language sql stable as $$select(auth.jwt()->>'sub')::uuid$$;
 create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
 grant usage on schema auth,public,coaching_private to anon,authenticated,service_role;
 create table profiles(user_id uuid primary key references auth.users,time_zone text default 'Asia/Seoul');
 create table study_todos(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,local_date date,title text,is_completed boolean default false,start_time time,end_time time);
 grant all on profiles,study_todos to service_role;insert into auth.users values('${owner}'),('${other}');insert into profiles(user_id)values('${owner}'),('${other}');`);
 await db.exec(readFileSync('supabase/migrations/20260906083030_studyroom_v2_coach.sql','utf8'));
 await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claims','{"role":"authenticated","sub":"${owner}","is_anonymous":false}',true);`);
 for(let i=0;i<2;i++)assert.equal((await db.query('select coach_reserve_ai($1) ok',[other])).rows[0].ok,true);
 await db.exec(`reset role;set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);`);
 for(let i=0;i<4;i++)assert.equal((await db.query('select coach_reserve_ai($1) ok',[owner])).rows[0].ok,true);
 assert.equal((await db.query('select coach_reserve_ai($1) ok',[owner])).rows[0].ok,false);
 assert.equal((await db.query('select coach_reserve_ai($1) ok',[other])).rows[0].ok,true);
 assert.equal((await db.query('select attempts from coach_ai_usage where user_id=$1',[owner])).rows[0].attempts,6);
 await db.exec('rollback');
 }finally{await db.close();}
});
