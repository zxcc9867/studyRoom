import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const owner = '00000000-0000-4000-8000-000000000101';
const other = '00000000-0000-4000-8000-000000000102';
const a = '00000000-0000-4000-8000-000000000201';
const b = '00000000-0000-4000-8000-000000000202';
const c = '00000000-0000-4000-8000-000000000203';
const old = '00000000-0000-4000-8000-000000000301';
let db, baseline, sessionSequence = 0;
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
async function auth(user = owner) { await db.exec('reset role'); await db.query("select set_config('request.uid',$1,false)", [user]); await db.exec('set role authenticated'); }
async function admin(fn) { await db.exec('reset role'); try { return await fn(); } finally { await auth(); } }
async function fixture(fn) { await db.exec('begin'); try { await auth(); await fn(); } finally { await db.exec('rollback; reset role'); } }
async function denied(fn, pattern = /LEARNING_|permission denied|check constraint|row-level security/) { await db.exec('savepoint denied'); try { await assert.rejects(fn, pattern); } finally { await db.exec('rollback to denied'); } }
function source(file) { return readFileSync(`supabase/migrations/${file}`, 'utf8'); }
function existingFunction(file, name) {
  const match = source(file).match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'i'));
  assert.ok(match, `real ${name} fixture`); return match[0];
}
const reflection = (context = a, overrides = {}) => ({ context_todo_id: context, focus_score: null, energy_score: null, interruption_reason: null, note: 'Learned joins', next_action: 'Continue joins', resource_url: 'https://example.com/lesson', resource_position: 'p. 12', ...overrides });
const snap = () => scalar("select learning_continuity_snapshot('2026-11-05') value");
const save = (id, payload, updated = null) => scalar('select save_learning_reflection($1,$2::jsonb,$3) value', [id, JSON.stringify(payload), updated]);
async function session(todo = a, status = 'completed', user = owner) {
  return admin(async () => {
    const id = await scalar(`insert into study_sessions(user_id,local_date,started_at,ended_at,status,lease_expires_at)
      values($1,'2026-11-05','2026-11-05T00:00Z'::timestamptz + $3 * interval '1 second',case when $2='completed' then '2026-11-05T00:30Z'::timestamptz end,$2,'2026-11-05T03:00Z') returning id value`, [user,status,++sessionSequence]);
    await db.query('insert into study_session_todos(user_id,session_id,todo_id) values($1,$2,$3)', [user,id,todo]);
    return id;
  });
}
async function digest() {
  return scalar(`select jsonb_build_object('reflections',(select jsonb_agg(jsonb_build_array(id,user_id,session_id,focus_score,energy_score,interruption_reason,note,next_action,created_at,updated_at) order by id) from study_session_reflections),
    'sessions',(select jsonb_agg(to_jsonb(s) order by id) from study_sessions s),
    'plans',(select jsonb_agg(to_jsonb(p) order by todo_id) from study_todo_plans p),
    'segments',(select jsonb_agg(to_jsonb(s) order by id) from study_todo_segments s)) value`);
}
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    create or replace function pg_catalog.now() returns timestamptz language sql stable as $$select current_setting('test.now')::timestamptz$$;
    select set_config('test.now','2026-11-05T01:00Z',false);
    create table profiles(user_id uuid primary key references auth.users,time_zone text default 'Asia/Tokyo',reminder_time time default '21:00');
    create table study_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users,local_date date not null,
      started_at timestamptz default now(),ended_at timestamptz,duration_seconds integer default 0,status text default 'active',
      created_at timestamptz default now(),updated_at timestamptz default now(),lease_expires_at timestamptz,lease_warning_sent_at timestamptz,
      paused_at timestamptz,paused_seconds integer default 0,unique(id,user_id));
    create unique index one_active on study_sessions(user_id) where status='active';
    create table study_recovery_requests(id uuid,user_id uuid,status text);
    create function promote_attendance_by_daily_study_total(uuid,date,timestamptz,uuid) returns boolean language sql as $$select true$$;
    create function touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new;end$$;
    insert into auth.users values('${owner}'),('${other}'); insert into profiles(user_id)values('${owner}'),('${other}');
    alter table study_sessions enable row level security;
    create policy owner_session on study_sessions to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
    grant select,insert,update on study_sessions to authenticated; grant select on profiles to authenticated;`);
  for (const file of ['0004_study_todos.sql','0016_study_todo_time_window.sql','0020_study_todo_repeat_metadata.sql','20260621083000_study_session_todo_links.sql']) await db.exec(source(file));
  // Execute the real reflection DDL/policies, intentionally including the weak legacy owner-only policies.
  await db.exec(source('20260712142233_sustainable_study_loop.sql').split('create table if not exists public.study_forest_preferences')[0]);
  await db.exec('alter table study_todos add column coach_start_at timestamptz, add column coach_end_at timestamptz; grant select,insert,update,delete on study_todos to authenticated;');
  await db.exec(existingFunction('20260906083030_studyroom_v2_coach.sql','coach_sync_todo_instants'));
  await db.exec('create trigger coach_sync_todo_instants before update on study_todos for each row execute function coach_sync_todo_instants()');
  await db.exec(existingFunction('20260804133546_enforce_session_lease_expiry.sql','end_study_session'));
  await db.exec(source('20260921095213_actual_study_tracking.sql'));
  for (const file of ['0011_study_presence_events.sql','0012_camera_required_warning.sql','20261018100359_study_device_camera_sync.sql']) await db.exec(source(file));
  await db.exec(`insert into study_todos(id,user_id,local_date,title,start_time,end_time,repeat_group_id,repeat_mode,repeat_until,repeat_weekdays)
    values('${a}','${owner}','2026-11-04','Same title','10:00','11:00','${a}','weekly','2026-12-31','{3}'),
    ('${b}','${owner}','2026-11-04','Same title','11:00','12:00','${a}','weekly','2026-12-31','{3}'),
    ('${c}','${other}','2026-11-04','Other user','12:00','13:00',null,'single',null,'{}');
    insert into study_sessions(id,user_id,local_date,started_at,ended_at,status) values('${old}','${owner}','2026-11-04','2026-11-04T00:00Z','2026-11-04T00:30Z','completed');
    insert into study_session_todos(user_id,session_id,todo_id)values('${owner}','${old}','${a}');
    insert into study_session_reflections(user_id,session_id,focus_score,energy_score,note,next_action) values('${owner}','${old}',4,2,'Old memo','Old action');
    insert into study_todo_segments(user_id,session_id,todo_id,started_at,ended_at,accepted_seconds)values('${owner}','${old}','${a}','2026-11-04T00:00Z','2026-11-04T00:30Z',1800);`);
  baseline = await digest();
  const migration = readdirSync('supabase/migrations').find(file => file.endsWith('_learning_continuity.sql'));
  if (migration) await db.exec(source(migration));
});
after(() => db?.close());

test('migration preserves old columns and leaves legacy memo out of results', () => fixture(async () => {
  assert.deepEqual(await admin(digest), baseline);
  assert.deepEqual(await snap(), { version: 1, bookmarks: [], results: [] });
}));
test('A/B same-title bookmarks stay isolated; latest blank clears only A; results reuse same row', () => fixture(async () => {
  const sa = await session(a); const sb = await session(b);
  const first = await save(sa, reflection(a)); await save(sb, reflection(b, { next_action: 'B next' }));
  let snapshot = await snap(); assert.equal(snapshot.bookmarks.length, 2); assert.equal(snapshot.results.length, 2);
  const edited = await save(sa, reflection(a, { note: 'Revised result' }), first.updatedAt);
  assert.equal(edited.reflectionId, first.reflectionId);
  await denied(() => save(sa, reflection(a)), /LEARNING_STALE/);
  await denied(() => save(sa, reflection(a), first.updatedAt), /LEARNING_STALE/);
  await save(await session(a), reflection(a, { note: '', next_action: '', resource_url: '', resource_position: '' }));
  snapshot = await snap(); assert.deepEqual(snapshot.bookmarks.map(x => x.todoId), [b]);
  assert.equal(snapshot.results.length, 2); assert.equal(snapshot.results.find(x => x.sessionId === sa).note, 'Revised result');
  assert.equal(edited.focusScore, null); assert.equal(edited.energyScore, null);
  await auth(other); assert.deepEqual(await snap(), { version: 1, bookmarks: [], results: [] });
}));
test('completed/deleted todos have no bookmark, results remain with nullable context after deletion', () => fixture(async () => {
  await save(await session(a), reflection(a)); await save(await session(b), reflection(b));
  await db.query('update study_todos set is_completed=true where id=$1', [a]);
  await db.query('delete from study_todos where id=$1', [b]);
  const snapshot = await snap(); assert.equal(snapshot.bookmarks.length, 0); assert.equal(snapshot.results.length, 2);
  assert.equal(snapshot.results.find(x => x.todoId === null).todoTitle, null);
}));
test('RPC and direct writes reject cross-owner/session context and unsafe URLs', () => fixture(async () => {
  const own = await session(); const foreign = await session(c, 'completed', other);
  await denied(() => save(foreign, reflection(null)));
  for (const payload of [reflection(c), reflection(b), reflection(a,{resource_url:'javascript:alert(1)'}), reflection(a,{resource_url:'https://user:pass@example.com'}), reflection(a,{resource_position:'x'.repeat(161)}),reflection(a,{note:'x'.repeat(501)}),reflection(a,{focus_score:0})]) await denied(() => save(own,payload));
  await denied(() => db.query('insert into study_session_reflections(user_id,session_id,focus_score,energy_score,context_todo_id)values($1,$2,3,3,$3)',[owner,own,c]));
  await denied(() => db.query('insert into study_session_reflections(user_id,session_id,focus_score,energy_score)values($1,$2,3,3)',[owner,foreign]));
  const row = await save(own,reflection());
  await denied(() => db.query('update study_session_reflections set context_todo_id=$1 where id=$2',[b,row.reflectionId]));
  await auth(''); await denied(() => snap(), /LEARNING_AUTH/);
  await db.exec('set role anon'); await denied(() => snap(), /permission denied/);
}));
test('completion metadata rejection rolls back real completion, todo completion, segments and reflection', () => fixture(async () => {
  const s = await session(a,'active');
  await admin(() => db.query('insert into study_actual_sessions(session_id,user_id,current_todo_id) values($1,$2,$3)',[s,owner,a]));
  await admin(() => db.query("insert into study_todo_segments(user_id,session_id,todo_id,started_at) values($1,$2,$3,'2026-11-05T00:00Z')",[owner,s,a]));
  const before = await admin(digest);
  const complete = payload => scalar('select complete_learning_session($1,0,$2::uuid[],$3::jsonb) value',[s,[a],JSON.stringify(payload)]);
  for (const payload of [reflection(c),reflection(a,{resource_url:'javascript:alert(1)'}),reflection(a,{note:'x'.repeat(501)})]) {
    await denied(() => complete(payload));
    assert.deepEqual(await admin(digest), before); assert.equal(await scalar('select is_completed value from study_todos where id=$1',[a]),false);
  }
  const result = await complete(reflection());
  assert.equal(result.session.status,'completed'); assert.equal(result.reflection.focusScore,null);
  assert.equal(await scalar('select is_completed value from study_todos where id=$1',[a]),true);
  assert.equal(await scalar('select count(*)::int value from study_todo_segments where session_id=$1 and ended_at is null',[s]),0);
}));
test('legacy numeric completion still works and remains memo', () => fixture(async () => {
  const s = await session(a,'active');
  const result = await scalar("select to_jsonb(complete_study_session($1,0,'{}',4,2,null,'legacy','next')) value",[s]);
  assert.equal(result.status,'completed');
  assert.deepEqual(await scalar('select jsonb_build_array(focus_score,energy_score,note_kind) value from study_session_reflections where session_id=$1',[s]),[4,2,'memo']);
}));
test('bookmark edit uses revision and preserves result and scores', () => fixture(async () => {
  const r = await save(await session(),reflection(a,{focus_score:5}));
  const edit = stamp => scalar('select update_learning_bookmark($1,$2,$3,$4,$5) value',[r.reflectionId,stamp,'New next','https://example.com/new','2:30']);
  const updated = await edit(r.updatedAt); assert.equal(updated.note,'Learned joins'); assert.equal(updated.focusScore,5); assert.equal(updated.nextAction,'New next');
  await denied(() => edit(r.updatedAt),/LEARNING_STALE/);
  await auth(other); await denied(() => edit(updated.updatedAt));
}));
test('prepare moves only one past occurrence calendar-date and preserves originals, segments and other fields', () => fixture(async () => {
  const before = await scalar('select to_jsonb(t) value from study_todos t where id=$1',[a]);
  const history = await admin(digest);
  await db.query("select set_config('test.now','2026-11-05T16:00Z',false)"); // Calendar Nov6, study day Nov5.
  const result = await scalar('select prepare_learning_todo($1,$2,$3) value',[a,'2026-11-04',before.updated_at]);
  assert.equal(result.todoId,a); assert.equal(result.localDate,'2026-11-06');
  const after = await scalar('select to_jsonb(t) value from study_todos t where id=$1',[a]);
  const {local_date: d1, updated_at: u1, ...keepBefore} = before;
  const {local_date: d2, updated_at: u2, ...keepAfter} = after;
  assert.deepEqual(keepAfter,keepBefore); assert.equal(await scalar('select local_date::text value from study_todos where id=$1',[b]),'2026-11-04');
  assert.deepEqual(await admin(digest), history);
  await denied(() => scalar('select prepare_learning_todo($1,$2,$3) value',[a,'2026-11-04',before.updated_at]),/LEARNING_STALE/);
}));
test('prepare rejects active study, stale edits, completed/future and cross-owner todos', () => fixture(async () => {
  const stamp = await scalar('select updated_at::text value from study_todos where id=$1',[a]);
  const prepare = (id=a,date='2026-11-04',version=stamp) => scalar('select prepare_learning_todo($1,$2,$3) value',[id,date,version]);
  await denied(() => prepare(c)); await denied(() => prepare(a,'2026-11-03')); await denied(() => prepare(a,'2026-11-04','2020-01-01Z'));
  await session(a,'active'); await denied(() => prepare(),/LEARNING_ACTIVE/);
  await admin(() => db.exec("update study_sessions set status='completed' where status='active'"));
  await db.query('update study_todos set is_completed=true where id=$1',[a]); await denied(() => prepare());
  await db.query("update study_todos set local_date='2026-11-07',is_completed=false where id=$1",[a]); await denied(() => prepare(a,'2026-11-07'));
}));
test('trusted todo deletion can null context without an end-user JWT while preserving the result', () => fixture(async () => {
  const r = await save(await session(),reflection());
  await db.exec('reset role'); await db.query("select set_config('request.uid','',false)");
  await db.query('delete from study_todos where id=$1',[a]);
  await auth();
  const result = (await snap()).results.find(item => item.reflectionId === r.reflectionId);
  assert.equal(result.todoId,null); assert.equal(result.note,'Learned joins');
}));
test('all public RPCs deny anon and snapshots retain requested study-date and account boundaries', () => fixture(async () => {
  const signatures = ['learning_continuity_snapshot(date)','save_learning_reflection(uuid,jsonb,timestamp with time zone)','complete_learning_session(uuid,integer,uuid[],jsonb)','update_learning_bookmark(uuid,timestamp with time zone,text,text,text)','prepare_learning_todo(uuid,date,timestamp with time zone)'];
  for(const name of signatures) assert.equal(await scalar("select has_function_privilege('anon',$1,'execute') value",[name]),false);
  const s = await session(a); await save(s,reflection());
  assert.equal((await scalar("select learning_continuity_snapshot('2026-11-04') value")).results.length,0);
  const otherSession = await session(c,'completed',other); await auth(other); await save(otherSession,reflection(c,{note:'Other result'}));
  const otherSnapshot = await snap(); assert.deepEqual(otherSnapshot.bookmarks.map(item=>item.todoId),[c]); assert.deepEqual(otherSnapshot.results.map(item=>item.note),['Other result']);
  await auth(); assert.deepEqual((await snap()).results.map(item=>item.note),['Learned joins']);
}));
test('coach carry changes derived instants only while original plan and credits stay fixed', () => fixture(async () => {
  await db.query("update study_todos set coach_start_at='2026-11-04T01:00Z',coach_end_at='2026-11-04T02:00Z' where id=$1",[a]);
  const stamp = await scalar('select updated_at::text value from study_todos where id=$1',[a]);
  const history = await admin(digest);
  await scalar('select prepare_learning_todo($1,$2,$3) value',[a,'2026-11-04',stamp]);
  assert.deepEqual(await scalar('select jsonb_build_array(start_time,end_time,coach_start_at,coach_end_at) value from study_todos where id=$1',[a]),['10:00:00','11:00:00','2026-11-05T01:00:00+00:00','2026-11-05T02:00:00+00:00']);
  assert.deepEqual(await admin(digest),history);
}));
test('removing a session link cannot leave an unlinked context bookmark', () => fixture(async () => {
  const s = await session(a); await save(s,reflection());
  await db.query('delete from study_session_todos where session_id=$1 and todo_id=$2',[s,a]);
  const data = await snap(); assert.deepEqual(data.bookmarks,[]); assert.equal(data.results[0].todoId,null); assert.equal(data.results[0].note,'Learned joins');
}));
test('new completion retains current coordinated-camera exclusion authority', () => fixture(async () => {
  const s = await session(a,'active');
  await admin(async()=>{
    await db.query("update study_sessions set started_at='2026-11-05T00:00Z' where id=$1",[s]);
    await db.query('insert into study_actual_sessions(session_id,user_id,current_todo_id,excluded_seconds) values($1,$2,$3,120)',[s,owner,a]);
    await db.query("insert into study_todo_segments(user_id,session_id,todo_id,started_at) values($1,$2,$3,'2026-11-05T00:00Z')",[owner,s,a]);
  });
  await scalar("select study_camera_action('claim',$1,$2) value",[b,s]);
  const data = await scalar("select complete_learning_session($1,999,'{}',$2::jsonb) value",[s,JSON.stringify(reflection())]);
  assert.equal(data.session.duration_seconds,3480);
  assert.equal(await scalar('select excluded_seconds value from study_actual_sessions where session_id=$1',[s]),120);
  assert.equal(data.reflection.note,'Learned joins');
}));
