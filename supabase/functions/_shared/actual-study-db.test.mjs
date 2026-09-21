import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const owner = '00000000-0000-4000-8000-000000000101';
const other = '00000000-0000-4000-8000-000000000102';
const todoA = '00000000-0000-4000-8000-000000000201';
const todoB = '00000000-0000-4000-8000-000000000202';
const todoC = '00000000-0000-4000-8000-000000000203';
const request = '00000000-0000-4000-8000-000000000301';
let db;
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0]?.value;
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const at = async time => db.query("select set_config('test.now',$1,false)", [time]);
async function auth(user = owner) {
  await db.exec('reset role');
  await db.query("select set_config('request.uid',$1,false)", [user]);
  await db.exec('set role authenticated');
}
async function admin(work) { await db.exec('reset role'); const result = await work(); await auth(); return result; }
async function fixture(work) {
  await db.exec('begin');
  try { await at('2026-09-21T09:00:00Z'); await auth(); await work(); }
  finally { await db.exec('rollback; reset role'); }
}
async function todo(id, start = '16:00', end = '18:00', date = '2026-09-21', completed = false, user = owner) {
  await admin(() => db.query(`insert into study_todos(id,user_id,local_date,title,start_time,end_time,is_completed)
    values($1::uuid,$2,$3,$1::text,$4,$5,$6)`, [id,user,date,start,end,completed]));
}
async function preview(action = 'start', current = todoA, ids = [current], session = null, excluded = 0) {
  return scalar('select preview_actual_study_action($1,$2::uuid[],$3,$4,$5) value', [action,ids,current,session,excluded]);
}
async function confirm(p, id = request) {
  return scalar('select confirm_actual_study_action($1::jsonb,$2) value', [JSON.stringify(p),id]);
}
async function start(current = todoA, ids = [current]) { return confirm(await preview('start',current,ids)); }
async function state(session) { return scalar('select get_actual_study_state($1) value',[session]); }
function existingFunction(file, name) {
  const source = readFileSync(`supabase/migrations/${file}`, 'utf8');
  const match = source.match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'i'));
  assert.ok(match, `fixture must execute the real ${name} body`);
  return match[0];
}
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    create or replace function pg_catalog.now() returns timestamptz language sql stable as $$select current_setting('test.now')::timestamptz$$;
    select set_config('test.now','2026-09-21T00:00:00Z',false);
    create table profiles(user_id uuid primary key references auth.users,time_zone text not null default 'Asia/Tokyo',reminder_time time not null default '21:00');
    create table study_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users,local_date date not null,
      started_at timestamptz not null default now(),ended_at timestamptz,duration_seconds integer not null default 0,status text not null default 'active',
      created_at timestamptz not null default now(),updated_at timestamptz not null default now(),lease_expires_at timestamptz,lease_warning_sent_at timestamptz,
      paused_at timestamptz,paused_seconds integer not null default 0,unique(id,user_id),check(duration_seconds>=0));
    create unique index study_sessions_one_active_per_user_idx on study_sessions(user_id) where status='active';
    create table study_todos(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users,local_date date not null,title text not null,
      start_time time,end_time time,is_completed boolean not null default false,position integer not null default 0,
      repeat_group_id uuid,repeat_mode text not null default 'single',repeat_weekdays smallint[] not null default '{}',repeat_until date,repeat_forever boolean not null default false,
      coach_start_at timestamptz,coach_end_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id),
      constraint study_todos_time_window_check check((start_time is null and end_time is null)or(start_time is not null and end_time is not null and start_time<>end_time)));
    create table study_recovery_requests(id uuid primary key default gen_random_uuid(),user_id uuid,status text);
    create table attendance_days(user_id uuid,local_date date,status text,reminder_at timestamptz,deadline_at timestamptz,qualifying_session_id uuid,marked_at timestamptz,primary key(user_id,local_date));
    create function local_reminder_at(d date,t time,z text)returns timestamptz language sql as $$select(d+t)at time zone z$$;
    create function effective_reminder_time(d date,t time)returns time language sql as $$select t$$;
    create table study_session_reflections(user_id uuid,session_id uuid primary key,focus_score integer,energy_score integer,interruption_reason text,note text,next_action text,updated_at timestamptz);
    grant select on study_session_reflections to authenticated;
    create table attendance_calls(user_id uuid,local_date date,session_id uuid);
    create function promote_attendance_by_daily_study_total(u uuid,d date,n timestamptz,s uuid)returns void language sql as $$insert into public.attendance_calls values(u,d,s)$$;
    insert into auth.users values('${owner}'),('${other}'); insert into profiles(user_id)values('${owner}'),('${other}');
    alter table study_sessions enable row level security; create policy session_owner on study_sessions to authenticated using(auth.uid()=user_id)with check(auth.uid()=user_id);
    alter table study_todos enable row level security; create policy todo_owner on study_todos to authenticated using(auth.uid()=user_id)with check(auth.uid()=user_id);
    grant select,insert,update,delete on study_sessions,study_todos to authenticated; grant select on profiles to authenticated;`);
  await db.exec(readFileSync('supabase/migrations/20260621083000_study_session_todo_links.sql','utf8'));
  await db.exec(existingFunction('20260712142233_sustainable_study_loop.sql','complete_study_session'));
  await db.exec(existingFunction('20260712142233_sustainable_study_loop.sql','start_study_session'));
  for (const name of ['pause_study_session','resume_study_session']) await db.exec(existingFunction('20260719134726_add_study_session_breaks.sql',name));
  for (const name of ['end_study_session','close_expired_study_sessions']) await db.exec(existingFunction('20260804133546_enforce_session_lease_expiry.sql',name));
  await db.exec(readFileSync('supabase/migrations/20260921095213_actual_study_tracking.sql','utf8'));
});
after(async () => db?.close());

test('16-18 original becomes 18-20, preview is read-only and first delay is two hours', () => fixture(async () => {
  await todo(todoA);
  const p = await preview();
  assert.equal(p.blocking_error,null); assert.equal(p.remaining_seconds,7200); assert.equal(p.cascade_complete,true);
  assert.equal(p.changes[0].after.start_at,'2026-09-21T09:00:00+00:00');
  assert.equal(p.changes[0].after.end_at,'2026-09-21T11:00:00+00:00');
  assert.equal(await scalar('select count(*)::int value from study_sessions'),0);
  const result = await confirm(p);
  assert.equal(result.tracking.todos[0].target_seconds,7200);
  assert.equal(result.tracking.todos[0].original_start_at,'2026-09-21T07:00:00+00:00');
  assert.equal((await rows('select start_time,end_time from study_todos'))[0].start_time,'18:00:00');
  const report = await scalar("select get_actual_study_report('2026-09-21','2026-09-21') value");
  assert.equal(report.plans[0].delay_minutes,120); assert.equal(report.on_time_ratio,0);
}));

test('30 minutes then a break retains 90 minutes and first-start adherence', () => fixture(async () => {
  await at('2026-09-21T07:00:00Z'); await todo(todoA); const r = await start(); const sid=r.session.id;
  await at('2026-09-21T07:30:00Z'); await scalar('select pause_study_session($1) value',[sid]);
  await scalar('select pause_study_session($1) value',[sid]);
  await admin(()=>db.query("update study_sessions set lease_expires_at='2026-09-21T12:00:00Z' where id=$1",[sid]));
  await at('2026-09-21T09:00:00Z'); const p=await preview('resume',todoA,[todoA],sid);
  assert.equal(p.remaining_seconds,5400); assert.equal(p.changes[0].after.end_at,'2026-09-21T10:30:00+00:00');
  const resumed=await confirm(p,'00000000-0000-4000-8000-000000000302');
  assert.equal(resumed.tracking.todos[0].known_seconds,1800);
  assert.equal(resumed.session.paused_seconds,5400);
  const report=await scalar("select get_actual_study_report('2026-09-21','2026-09-21') value");
  assert.equal(report.plans[0].delay_minutes,0); assert.equal(report.on_time_ratio,1);
}));

test('cascade preserves gaps, completed tasks and repeat metadata across midnight', () => fixture(async () => {
  await at('2026-09-21T14:00:00Z'); await todo(todoA,'20:00','22:00'); await todo(todoB,'00:30','01:30','2026-09-22'); await todo(todoC,'04:00','05:00','2026-09-22');
  await admin(()=>db.query("update study_todos set repeat_mode='weekly',repeat_group_id=$1,repeat_weekdays='{1}',repeat_forever=true where id=$2",[request,todoB]));
  const p=await preview(); assert.equal(p.changes.length,2);
  assert.equal(p.changes[0].after.end_date,'2026-09-22');
  assert.equal(p.changes[1].after.start_time,'01:00:00'); assert.equal(p.changes[1].after.end_time,'02:00:00');
  await confirm(p); const b=(await rows('select * from study_todos where id=$1',[todoB]))[0];
  assert.equal(b.repeat_group_id,request); assert.equal(b.repeat_forever,true);
  assert.equal((await rows('select start_time from study_todos where id=$1',[todoC]))[0].start_time,'04:00:00');
}));

test('completed overlapping schedules do not move', () => fixture(async()=>{
  await todo(todoA);await todo(todoB,'18:30','19:30','2026-09-21',true);
  const p=await preview();assert.equal(p.changes.length,1);await confirm(p);
  assert.equal((await rows('select start_time from study_todos where id=$1',[todoB]))[0].start_time,'18:30:00');
}));

test('untimed todo has no fabricated target, remaining seconds or schedule end', () => fixture(async()=>{
  await todo(todoA,null,null);const p=await preview();assert.equal(p.remaining_seconds,null);assert.deepEqual(p.changes,[]);
  const r=await confirm(p);assert.equal(r.tracking.todos[0].target_seconds,null);assert.equal(r.tracking.todos[0].remaining_seconds,null);
}));

test('same request retry returns identical result without second session or adjustment', () => fixture(async()=>{
  await todo(todoA);const p=await preview();const r=await confirm(p);await at('2026-09-21T09:03:00Z');
  assert.deepEqual(await confirm(p),r);
  assert.equal(await scalar('select count(*)::int value from study_sessions'),1);
  assert.equal(await scalar('select count(*)::int value from study_schedule_adjustments'),1);
}));

test('phantom insert makes preview stale and leaves schedule/session untouched', () => fixture(async()=>{
  await todo(todoA);const p=await preview();await todo(todoB,'19:00','20:00');
  await assert.rejects(confirm(p),/ACTUAL_STUDY_STALE_PREVIEW/);
}));

test('ownership and pending recovery gates cannot be bypassed by confirm', () => fixture(async()=>{
  await todo(todoA);await auth(other);const foreign=await preview();assert.notEqual(foreign.blocking_error,null);
  await auth();const p=await preview();await admin(()=>db.query("insert into study_recovery_requests(user_id,status)values($1,'pending')",[owner]));
  await assert.rejects(confirm(p),/Recovery routine required|ACTUAL_STUDY_STALE_PREVIEW/);
}));

test('seconds within captured minute confirm, next-minute proposal requires refresh', () => fixture(async()=>{
  await todo(todoA);const p=await preview();await at('2026-09-21T09:00:45Z');await confirm(p);
}));

test('expired preview cannot silently accept a changed schedule', () => fixture(async()=>{
  await todo(todoA);const p=await preview();await at('2026-09-21T09:01:00Z');await assert.rejects(confirm(p),/ACTUAL_STUDY_STALE_PREVIEW/);
}));

test('switch and camera checkpoint allocate disjoint segments with no double exclusion', () => fixture(async()=>{
  await todo(todoA,null,null);await todo(todoB,null,null);const r=await start(todoA,[todoA,todoB]);const sid=r.session.id;
  await at('2026-09-21T09:10:00Z');const p=await preview('switch',todoB,[todoA,todoB],sid,120);
  await confirm(p,'00000000-0000-4000-8000-000000000302');
  await at('2026-09-21T09:20:00Z');await scalar('select pause_actual_study_session($1,180) value',[sid]);
  const s=await state(sid);assert.equal(s.todos.find(t=>t.id===todoA).known_seconds,480);assert.equal(s.todos.find(t=>t.id===todoB).known_seconds,540);
  await at('2026-09-21T09:30:00Z');await scalar('select end_study_session($1,180) value',[sid]);
  assert.equal(await scalar('select sum(accepted_seconds)::int value from study_todo_segments'),1020);
  assert.equal(await scalar('select duration_seconds value from study_sessions'),1020);
  assert.equal(await scalar('select count(*)::int value from study_todo_segments where ended_at is null'),0);
}));

test('legacy resume opens only forward tracking and repeated resume/pause do not duplicate intervals', () => fixture(async()=>{
  await todo(todoA,null,null);const r=await start();const sid=r.session.id;
  await at('2026-09-21T09:10:00Z');await scalar('select pause_study_session($1) value',[sid]);
  await at('2026-09-21T09:20:00Z');await scalar('select resume_study_session($1) value',[sid]);await scalar('select resume_study_session($1) value',[sid]);
  await at('2026-09-21T09:30:00Z');await scalar('select end_study_session($1,0) value',[sid]);
  assert.equal(await scalar('select sum(accepted_seconds)::int value from study_todo_segments'),1200);
  assert.equal(await scalar('select count(*)::int value from study_todo_segments'),2);
}));

test('expiry closes at lease and preserves known camera exclusions', () => fixture(async()=>{
  await todo(todoA,null,null);const r=await start();const sid=r.session.id;
  await at('2026-09-21T09:10:00Z');await scalar('select checkpoint_actual_study_exclusion($1,120) value',[sid]);
  await at('2026-09-21T11:00:00Z');await admin(()=>db.query('select * from close_expired_study_sessions()'));
  assert.equal(await scalar('select duration_seconds value from study_sessions'),3480);
  assert.equal(await scalar('select sum(accepted_seconds)::int value from study_todo_segments'),3480);
  assert.equal(await scalar('select count(*)::int value from study_todo_segments where ended_at is null'),0);
}));

test('legacy unassigned time is not retro-distributed after first focus selection', () => fixture(async()=>{
  await todo(todoA,null,null);const session=await scalar('select to_jsonb(start_study_session($1::uuid[])) value',[[todoA]]);
  await at('2026-09-21T09:10:00Z');const p=await preview('switch',todoA,[todoA],session.id);const r=await confirm(p);
  assert.equal(r.tracking.unknown_allocation,true);assert.equal(r.tracking.todos[0].known_seconds,0);
  await at('2026-09-21T09:20:00Z');await scalar('select end_study_session($1,0) value',[session.id]);
  assert.equal(await scalar('select sum(accepted_seconds)::int value from study_todo_segments'),600);
}));

test('owner-read RLS and revoked direct writes protect actual time and immutable plan', () => fixture(async()=>{
  await todo(todoA);await start();await auth(other);
  assert.equal(await scalar('select count(*)::int value from study_todo_segments'),0);
  await assert.rejects(db.query('update study_todo_plans set target_seconds=1'),/permission denied/);
}));

test('unstarted report excludes future, untimed and historical pretracking dates', () => fixture(async()=>{
  await todo(todoA);await todo(todoB,null,null);await todo(todoC,'16:00','18:00','2026-09-20');
  const report=await scalar("select get_actual_study_report('2026-09-20','2026-09-22') value");
  assert.equal(report.scheduled_count,1);assert.equal(report.unstarted_count,1);assert.equal(report.on_time_ratio,null);
}));

test('camera counter cannot be negative, regress or exceed server-observed nonpaused time', () => fixture(async()=>{
  await todo(todoA,null,null);const r=await start();
  await assert.rejects(scalar('select checkpoint_actual_study_exclusion($1,999) value',[r.session.id]),/EXCLUSION/);
}));

async function rejectedWithoutAborting(work, pattern) {
  await db.exec('savepoint expected_error');
  try { await assert.rejects(work(),pattern); } finally { await db.exec('rollback to savepoint expected_error; release savepoint expected_error'); }
}

test('switch proposal stays valid within its minute even when old focus remaining changes live', () => fixture(async()=>{
  await todo(todoA);await todo(todoB,'19:00','20:00');const r=await start(todoA,[todoA,todoB]);
  await at('2026-09-21T09:10:00Z');const p=await preview('switch',todoB,[todoA,todoB],r.session.id);
  await at('2026-09-21T09:10:25Z');await confirm(p,'00000000-0000-4000-8000-000000000302');
}));

test('failure after schedule/session writes rolls back every write and permits same request retry', () => fixture(async()=>{
  await todo(todoA);const p=await preview();
  await admin(()=>db.exec("create function public.reject_adjustment_test()returns trigger language plpgsql as $$begin raise exception 'forced adjustment failure';end$$;create trigger reject_adjustment_test before insert on study_schedule_adjustments for each row execute function public.reject_adjustment_test()"));
  await rejectedWithoutAborting(()=>confirm(p),/forced adjustment failure/);
  assert.equal(await scalar('select count(*)::int value from study_sessions'),0);
  assert.equal(await scalar('select count(*)::int value from study_todo_segments'),0);
  assert.equal((await rows('select start_time from study_todos where id=$1',[todoA]))[0].start_time,'16:00:00');
  await admin(()=>db.exec('drop trigger reject_adjustment_test on study_schedule_adjustments'));
  await confirm(p);
}));

test('untimed todo captures its first manually entered time once, later moves preserve original target', () => fixture(async()=>{
  await todo(todoA,null,null);
  await db.query("update study_todos set start_time='16:00',end_time='18:00' where id=$1",[todoA]);
  assert.equal(await scalar('select target_seconds value from study_todo_plans where todo_id=$1',[todoA]),7200);
  await db.query("update study_todos set start_time='17:00',end_time='20:00' where id=$1",[todoA]);
  assert.equal(await scalar('select target_seconds value from study_todo_plans where todo_id=$1',[todoA]),7200);
  assert.equal((await preview()).remaining_seconds,7200);
}));

test('partially studied other todo cascades only its remaining plan and never moves actual intervals', () => fixture(async()=>{
  await at('2026-09-21T07:00:00Z');await todo(todoA);await todo(todoB,'17:00','18:00');const r=await start(todoA,[todoA,todoB]);
  await at('2026-09-21T07:30:00Z');const p=await preview('switch',todoB,[todoA,todoB],r.session.id);
  assert.equal(p.changes.length,2);assert.equal(p.changes[1].after.start_time,'17:30:00');assert.equal(p.changes[1].after.end_time,'19:00:00');
  await confirm(p,'00000000-0000-4000-8000-000000000302');
  assert.equal((await state(r.session.id)).todos.find(t=>t.id===todoA).known_seconds,1800);
  const segment=(await rows('select started_at,ended_at from study_todo_segments where todo_id=$1',[todoA]))[0];
  assert.equal(segment.started_at.toISOString(),'2026-09-21T07:00:00.000Z');
  assert.equal(segment.ended_at.toISOString(),'2026-09-21T07:30:00.000Z');
}));

test('paused expiry excludes the break once and preserves the camera checkpoint', () => fixture(async()=>{
  await todo(todoA,null,null);const r=await start();await at('2026-09-21T09:10:00Z');
  await scalar('select pause_actual_study_session($1,120) value',[r.session.id]);
  await at('2026-09-21T11:00:00Z');await admin(()=>db.query('select * from close_expired_study_sessions()'));
  assert.equal(await scalar('select duration_seconds value from study_sessions'),480);
  assert.equal(await scalar('select sum(accepted_seconds)::int value from study_todo_segments'),480);
}));

test('late legacy exclusion never lets todo totals exceed accepted session seconds', () => fixture(async()=>{
  await todo(todoA,null,null);const r=await start();
  await at('2026-09-21T09:10:00Z');await scalar('select pause_study_session($1) value',[r.session.id]);
  await at('2026-09-21T09:20:00Z');await scalar('select resume_study_session($1) value',[r.session.id]);
  await at('2026-09-21T09:30:00Z');await scalar('select end_study_session($1,900) value',[r.session.id]);
  assert.equal(await scalar('select sum(accepted_seconds)::int value from study_todo_segments'),300);
  assert.equal(await scalar('select duration_seconds value from study_sessions'),300);
  await rejectedWithoutAborting(()=>scalar('select end_study_session($1,900) value',[r.session.id]),/Active study session not found/);
  assert.equal(await scalar('select sum(accepted_seconds)::int value from study_todo_segments'),300);
}));

test('same UUID with another intent is rejected and snapshots remain owner-only', () => fixture(async()=>{
  await todo(todoA);const p=await preview();const r=await confirm(p);
  await rejectedWithoutAborting(()=>confirm({...p,excluded_seconds:1}),/ACTUAL_STUDY_REQUEST_REUSED/);
  await auth(other);assert.equal(await scalar('select count(*)::int value from study_todo_plans'),0);
  await rejectedWithoutAborting(()=>scalar('select get_actual_study_state($1) value',[r.session.id]),/Study session not found/);
}));

test('finite cascade guard rejects complete transaction rather than committing a partial shift', () => fixture(async()=>{
  await todo(todoA);
  await admin(()=>db.exec("insert into study_todos(user_id,local_date,title,start_time,end_time)select '"+owner+"',('2026-09-21 18:00'::timestamp+n*interval '1 minute')::date,'chain',('2026-09-21 18:00'::timestamp+n*interval '1 minute')::time,('2026-09-21 18:01'::timestamp+n*interval '1 minute')::time from generate_series(0,2000)n"));
  const p=await preview();assert.equal(p.cascade_complete,false);assert.equal(p.blocking_error,'CASCADE_LIMIT');
  await rejectedWithoutAborting(()=>confirm(p),/ACTUAL_STUDY_STALE_PREVIEW/);
  assert.equal(await scalar('select count(*)::int value from study_sessions'),0);
  assert.equal(await scalar('select count(*)::int value from study_schedule_adjustments'),0);
}));

test('legacy linked study makes first-start adherence unknown instead of inventing late start', () => fixture(async()=>{
  await todo(todoA);const session=await scalar('select to_jsonb(start_study_session($1::uuid[])) value',[[todoA]]);
  await at('2026-09-21T09:10:00Z');const r=await confirm(await preview('switch',todoA,[todoA],session.id));
  assert.equal(r.tracking.todos[0].unknown_allocation,true);
  assert.equal(r.tracking.todos[0].evaluation_eligible,false);
  const report=await scalar("select get_actual_study_report('2026-09-21','2026-09-21') value");
  assert.equal(report.scheduled_count,0);
}));

test('a linked next-day todo can complete through the existing reflection RPC after cascade', () => fixture(async()=>{
  await at('2026-09-21T14:00:00Z');await todo(todoA,'20:00','22:00');await todo(todoB,'22:30','23:30');const r=await start(todoA,[todoA,todoB]);
  assert.equal((await rows('select local_date::text date from study_todos where id=$1',[todoB]))[0].date,'2026-09-22');
  await at('2026-09-21T14:10:00Z');
  await scalar('select to_jsonb(complete_study_session($1,0,$2::uuid[],3,3)) value',[r.session.id,[todoB]]);
  assert.equal(await scalar('select is_completed value from study_todos where id=$1',[todoB]),true);
}));

test('many historical/future repeat rows do not block a short cascade that ends at a gap', () => fixture(async()=>{
  await todo(todoA);
  await admin(()=>db.exec("insert into study_todos(user_id,local_date,title,start_time,end_time)select '"+owner+"','2026-09-20','past','10:00','11:00' from generate_series(1,2001);insert into study_todos(user_id,local_date,title,start_time,end_time)select '"+owner+"',('2026-09-22'::date+(n/6)::integer),'future','10:00','11:00' from generate_series(1,2200)n"));
  const p=await preview();assert.equal(p.blocking_error,null);assert.equal(p.cascade_complete,true);assert.equal(p.changes.length,1);await confirm(p);
}));

test('unknown legacy allocation exposes no fabricated first start', () => fixture(async()=>{
  await todo(todoA);const s=await scalar('select to_jsonb(start_study_session($1::uuid[])) value',[[todoA]]);
  await at('2026-09-21T09:10:00Z');const r=await confirm(await preview('switch',todoA,[todoA],s.id));
  assert.equal(r.tracking.todos[0].first_started_at,null);
  assert.equal(r.tracking.todos[0].first_tracked_at,'2026-09-21T09:10:00+00:00');
}));

test('DST unrepresentable focused interval blocks the whole preview and leaves all rows unchanged', () => fixture(async()=>{
  await admin(()=>db.query("update profiles set time_zone='America/New_York' where user_id=$1",[owner]));
  await at('2026-11-01T08:00:00Z');await todo(todoA,'00:30','00:00','2026-11-01');
  assert.equal(await scalar('select target_seconds value from study_todo_plans where todo_id=$1',[todoA]),88200);
  const p=await preview();assert.equal(p.blocking_error,'UNREPRESENTABLE_SCHEDULE');assert.equal(p.cascade_complete,false);assert.deepEqual(p.changes,[]);
  await rejectedWithoutAborting(()=>confirm(p),/ACTUAL_STUDY_STALE_PREVIEW/);
  assert.equal(await scalar('select count(*)::int value from study_sessions'),0);
  assert.equal(await scalar('select count(*)::int value from study_schedule_adjustments'),0);
  assert.deepEqual((await rows('select local_date::text local_date,start_time,end_time from study_todos where id=$1',[todoA]))[0],
    {local_date:'2026-11-01',start_time:'00:30:00',end_time:'00:00:00'});
}));

test('DST unrepresentable cascaded interval rejects the entire otherwise representable focus move', () => fixture(async()=>{
  await admin(()=>db.query("update profiles set time_zone='America/New_York' where user_id=$1",[owner]));
  await at('2026-11-01T08:00:00Z');await todo(todoA,'00:00','00:30','2026-11-01');await todo(todoB,'00:30','00:00','2026-11-01');
  const p=await preview();assert.equal(p.remaining_seconds,1800);assert.equal(p.blocking_error,'UNREPRESENTABLE_SCHEDULE');
  assert.equal(p.cascade_complete,false);assert.deepEqual(p.changes,[]);
  await rejectedWithoutAborting(()=>confirm(p),/ACTUAL_STUDY_STALE_PREVIEW/);
  assert.equal(await scalar('select count(*)::int value from study_sessions'),0);
  assert.equal(await scalar('select count(*)::int value from study_schedule_adjustments'),0);
}));

test('missing-profile recovery uses Tokyo for original snapshot and start at the UTC date boundary', () => fixture(async()=>{
  await admin(()=>db.query('delete from profiles where user_id=$1',[owner]));
  await at('2026-09-21T15:30:00Z');await todo(todoA,'00:00','01:00','2026-09-22');
  const original=(await rows('select original_start_at,time_zone from study_todo_plans where todo_id=$1',[todoA]))[0];
  assert.equal(original.time_zone,'Asia/Tokyo');assert.equal(original.original_start_at.toISOString(),'2026-09-21T15:00:00.000Z');
  const p=await preview();assert.equal(p.blocking_error,null);assert.equal(p.time_zone,'Asia/Tokyo');
  assert.equal(p.changes[0].after.local_date,'2026-09-22');assert.equal(p.changes[0].after.start_time,'00:30:00');
  const r=await confirm(p);assert.equal(r.session.local_date,'2026-09-22');
  assert.equal(await scalar('select time_zone value from profiles where user_id=$1',[owner]),'Asia/Tokyo');
  assert.equal(r.tracking.todos[0].original_start_at,'2026-09-21T15:00:00+00:00');
}));

for(const {excluded,remaining} of [{excluded:120,remaining:0},{excluded:420,remaining:120}]){
  test('outgoing over-target focus applies pending camera exclusion before remaining clamp: '+excluded,()=>fixture(async()=>{
    await todo(todoA,'18:00','18:10');await todo(todoB,'18:15','18:45');await todo(todoC,'18:45','19:15');
    const r=await start(todoA,[todoA,todoB]);
    await db.query("update study_todos set start_time='18:10',end_time='18:20' where id=$1",[todoA]);
    await at('2026-09-21T09:15:00Z');
    const p=await preview('switch',todoB,[todoA,todoB],r.session.id,excluded);
    const outgoing=p.changes.find(c=>c.todo_id===todoA);
    if(remaining===0){assert.deepEqual(p.changes,[]);}
    else{
      assert.ok(outgoing);assert.equal(outgoing.after.start_time,'18:45:00');assert.equal(outgoing.after.end_time,'18:47:00');
      assert.equal(p.changes.find(c=>c.todo_id===todoC).after.start_time,'18:47:00');
    }
    const switched=await confirm(p,'00000000-0000-4000-8000-000000000302');
    const tracked=switched.tracking.todos.find(t=>t.id===todoA);
    assert.equal(tracked.known_seconds,900-excluded);assert.equal(tracked.remaining_seconds,remaining);
  }));
}
