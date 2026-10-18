import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const user = '00000000-0000-4000-8000-000000000101';
const other = '00000000-0000-4000-8000-000000000102';
const session = '00000000-0000-4000-8000-000000000201';
const a = '00000000-0000-4000-8000-000000000301';
const b = '00000000-0000-4000-8000-000000000302';
let db;
let learningBaseline;
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
const at = time => db.query("select set_config('test.now',$1,false)", [`2026-10-18T09:${time}Z`]);
async function auth(id = user) { await db.exec('reset role'); await db.query("select set_config('request.uid',$1,false)", [id]); await db.exec('set role authenticated'); }
async function admin(work) { await db.exec('reset role'); try { return await work(); } finally { await auth(); } }
async function fixture(work) { await db.exec('begin'); try { await at('00:00'); await auth(); await work(); } finally { await db.exec('rollback;reset role'); } }
const action = (kind, client = a, generation = null, status = 'watching', excluded = null, takeover = false) => scalar('select study_camera_action($1,$2,$3,$4,$5,$6,$7) value', [kind,client,session,generation,status,excluded,takeover]);
const snapshot = (client = a) => scalar('select study_device_snapshot($1) value',[client]);
const warn = (client = a, generation = 1, type = 'camera_required_warning') => admin(() => scalar('select claim_study_camera_warning($1,$2,$3,$4,$5) value',[user,session,client,generation,type]));
async function learningDigest() {
  const result={};
  for(const table of ['study_sessions','study_todos','study_todo_plans','study_session_todos','study_actual_sessions','study_todo_segments','study_schedule_adjustments','study_presence_events']) {
    result[table]=await scalar(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text) value from ${table} t`);
  }
  return result;
}
async function denied(work, pattern) { await db.exec('savepoint denied'); try { await assert.rejects(work, pattern); } finally { await db.exec('rollback to denied'); } }
function existingFunction(file,name) {
  const match=readFileSync(`supabase/migrations/${file}`,'utf8').match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\$\\$;`,'i'));
  assert.ok(match);return match[0];
}

before(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
    create or replace function pg_catalog.now() returns timestamptz language sql stable as $$select current_setting('test.now')::timestamptz$$;
    select set_config('test.now','2026-10-18T09:00:00Z',false);
    grant usage on schema auth,public to authenticated,service_role;
    create table profiles(user_id uuid primary key,time_zone text default 'Asia/Tokyo');
    create table study_sessions(id uuid primary key,user_id uuid references auth.users,local_date date,started_at timestamptz,ended_at timestamptz,
      duration_seconds integer default 0,status text default 'active',paused_at timestamptz,paused_seconds integer default 0,lease_expires_at timestamptz,updated_at timestamptz default now(),unique(id,user_id));
    create table study_todos(id uuid primary key,user_id uuid,local_date date,title text,start_time time,end_time time,is_completed boolean default false,coach_start_at timestamptz,coach_end_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),unique(id,user_id));
    create table study_recovery_requests(id uuid,user_id uuid,status text);
    create table study_session_reflections(session_id uuid primary key,user_id uuid,focus_score integer,energy_score integer,interruption_reason text,note text,next_action text,updated_at timestamptz);
    create function promote_attendance_by_daily_study_total(uuid,date,timestamptz,uuid) returns boolean language sql as $$select true$$;
    insert into auth.users values('${user}'),('${other}');
    insert into profiles values('${user}','Asia/Tokyo'),('${other}','Asia/Tokyo');
    insert into study_sessions(id,user_id,local_date,started_at,lease_expires_at) values('${session}','${user}','2026-10-18',now(),now()+interval '1 hour');
    alter table study_sessions enable row level security;
    create policy owner_read on study_sessions for select to authenticated using(auth.uid()=user_id);
    create policy owner_update on study_sessions for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
    grant select,update on study_sessions to authenticated;
  `);
  for (const file of ['20260621083000_study_session_todo_links.sql','20260921095213_actual_study_tracking.sql','0011_study_presence_events.sql','0012_camera_required_warning.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  }
  await db.exec(existingFunction('20260804133546_enforce_session_lease_expiry.sql','end_study_session'));
  for(const name of ['pause_study_session','resume_study_session']) await db.exec(existingFunction('20260719134726_add_study_session_breaks.sql',name));
  await db.exec(existingFunction('20261005131830_study_day_four_am.sql','study_day_at'));
  const latestPreview=readFileSync('supabase/migrations/20261005131830_study_day_four_am.sql','utf8').match(/CREATE OR REPLACE FUNCTION actual_study_private\.preview\([\s\S]*?end \$function\$;/i);
  assert.ok(latestPreview);await db.exec(latestPreview[0]);
  await db.exec(`insert into study_sessions(id,user_id,local_date,started_at,ended_at,duration_seconds,status)
    values('00000000-0000-4000-8000-000000000209','${user}','2026-10-10','2026-10-10T08:00Z','2026-10-10T10:00Z',7170,'completed');
    insert into study_todos(id,user_id,local_date,title) values('00000000-0000-4000-8000-000000000401','${user}','2026-10-10','preserve historical note');
    insert into study_session_todos(user_id,session_id,todo_id) values('${user}','00000000-0000-4000-8000-000000000209','00000000-0000-4000-8000-000000000401');
    insert into study_actual_sessions(session_id,user_id,current_todo_id,excluded_seconds) values('00000000-0000-4000-8000-000000000209','${user}','00000000-0000-4000-8000-000000000401',30);
    insert into study_todo_segments(user_id,session_id,todo_id,started_at,ended_at,accepted_seconds,excluded_seconds)
    values('${user}','00000000-0000-4000-8000-000000000209','00000000-0000-4000-8000-000000000401','2026-10-10T08:00Z','2026-10-10T10:00Z',7170,30);
    insert into study_presence_events(user_id,session_id,event_type,metadata)
    values('${user}','00000000-0000-4000-8000-000000000209','absence_warning','{"localDate":"2026-10-10"}');`);
  learningBaseline=await learningDigest();
  const migration = readdirSync('supabase/migrations').find(file => file.endsWith('_study_device_camera_sync.sql'));
  if (migration) await db.exec(readFileSync(`supabase/migrations/${migration}`,'utf8'));
});
after(() => db?.close());

test('additive migration preserves byte-equivalent existing learning row content', () => fixture(async () => {
  assert.deepEqual(await admin(learningDigest),learningBaseline);
  await action('claim');
  assert.deepEqual(await admin(learningDigest),learningBaseline);
}));

test('fresh owner cannot be stolen, explicit takeover fences old reports without learning mutations', () => fixture(async () => {
  const initial = await action('claim'); assert.equal(initial.accepted,true); assert.equal(initial.camera.generation,1);
  const cameraBefore=JSON.stringify(initial.camera);
  const before = await admin(() => scalar('select md5(row_to_json(s)::text) value from study_sessions s where id=$1',[session]));
  assert.equal((await action('claim',b)).accepted,false);
  assert.equal((await action('report',b,1,'absent',999)).accepted,false);
  assert.equal(JSON.stringify((await snapshot()).camera),cameraBefore);
  const switched = await action('claim',b,null,'present',null,true);
  assert.equal(switched.camera.generation,2);assert.equal(switched.camera.is_owner,true);
  assert.equal((await action('report',a,1,'absent',999)).accepted,false);
  assert.equal(await admin(() => scalar('select md5(row_to_json(s)::text) value from study_sessions s where id=$1',[session])),before);
  assert.equal((await snapshot(a)).camera.is_owner,false);
}));

test('server absence resets on an expired heartbeat and never trusts client seconds', () => fixture(async () => {
  await action('claim',a,null,'absent');
  for (let seconds=30;seconds<=300;seconds+=30) { await at(`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`); await action('report',a,1,'absent'); }
  assert.equal((await snapshot()).camera.absence_seconds,300);
  assert.equal((await warn(a,1,'absence_warning')).allowed,true);
  assert.equal((await warn(a,1,'absence_warning')).allowed,false);
  await at('06:00');assert.equal((await snapshot()).camera.status,'stale');
  assert.equal((await warn(a,1,'absence_warning')).allowed,false);
  assert.equal((await action('report',a,1,'absent')).camera.absence_seconds,0);
}));

test('owner off warning is atomic, cooldown enforced, and missing identity creates no event', () => fixture(async () => {
  await action('claim',a,null,'off');
  assert.equal((await warn(null)).allowed,false);
  assert.equal(await admin(() => scalar('select count(*)::int value from study_presence_events where session_id=$1',[session])),0);
  const first = await warn();assert.equal(first.allowed,true);assert.ok(first.event_id);
  assert.equal((await warn()).allowed,false);
  assert.equal(await admin(() => scalar('select count(*)::int value from study_presence_events where session_id=$1',[session])),1);
}));

for (const kind of ['paused','ended','lease']) test(`${kind} sessions reject reporting, ownership and warnings`, () => fixture(async () => {
  await action('claim',a,null,'off');
  await admin(() => db.exec((kind==='paused' ? `update study_sessions set paused_at=now()` : kind==='ended' ? `update study_sessions set status='completed',ended_at=now()` : `update study_sessions set lease_expires_at=now()`)+` where id='${session}'`));
  assert.equal((await action('report',a,1,'absent')).accepted,false);
  assert.equal((await action('claim',b,null,'watching',null,true)).accepted,false);
  assert.equal((await warn()).allowed,false);
  const s = await snapshot();assert.equal(s.session.id,session);assert.equal(s.active_session?.id ?? null,kind==='ended'?null:session);
}));

test('RLS and RPC ownership hide other users and authenticated callers cannot claim warnings or write camera state', () => fixture(async () => {
  await action('claim');await auth(other);
  assert.equal((await snapshot(b)).session,null);
  assert.equal((await action('claim',b)).accepted,false);
  assert.equal(await scalar('select count(*)::int value from study_camera_sessions'),0);
  await denied(() => db.exec('update study_camera_sessions set generation=100'), /permission denied/);
  await denied(() => scalar('select claim_study_camera_warning($1,$2,$3,1,$4) value',[user,session,a,'absence_warning']), /permission denied/);
}));

test('exclusion is owner-only, monotonic and clamped through the real checkpoint, preserved on takeover', () => fixture(async () => {
  await action('claim');await at('10:00');
  // Heartbeat gap breaks the absence episode; it cannot itself cause exclusion.
  await action('report',a,1,'present',99999);
  assert.equal((await snapshot()).camera.excluded_seconds,600);
  assert.equal((await snapshot()).tracking.excluded_seconds,600);
  await action('report',a,1,'present',0);assert.equal((await snapshot()).camera.excluded_seconds,600);
  assert.equal((await action('claim',b,null,'present',null,true)).camera.excluded_seconds,600);
  await action('report',a,1,'absent',99999);assert.equal((await snapshot(b)).tracking.excluded_seconds,600);
}));

test('fresh server absence derives auto-paused after ten minutes and cooldown survives takeover', () => fixture(async () => {
  await action('claim',a,null,'absent');
  for (let seconds=30;seconds<=900;seconds+=30) {
    await at(`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`);
    await action('report',a,1,'absent');
    if(seconds===300) assert.equal((await warn(a,1,'absence_warning')).allowed,true);
    if(seconds===600) {
      const camera=(await snapshot()).camera;
      assert.equal(camera.status,'auto_paused');assert.equal(camera.auto_paused_at,'2026-10-18T09:10:00+00:00');
      assert.equal(camera.excluded_seconds,0,'snapshot never projects exclusion twice');
    }
  }
  assert.equal((await warn(a,1,'absence_warning')).allowed,true);
  await action('claim',b,null,'off',null,true);
  assert.equal((await warn(a,1,'camera_required_warning')).allowed,false);
  assert.equal((await warn(b,2,'camera_required_warning')).allowed,true);
  await action('claim',a,null,'error',null,true);
  assert.equal((await warn(a,3,'camera_required_warning')).allowed,false);
  assert.equal((await warn(null,3,'camera_required_warning')).allowed,false);
}));

test('expired owner can be replaced nonforce, and rejected stale generation cannot refresh it', () => fixture(async () => {
  await action('claim');await at('00:46');
  const r=await action('claim',b);assert.equal(r.accepted,true);assert.equal(r.camera.generation,2);
  const seen=r.camera.last_seen_at;await at('00:50');
  assert.equal((await action('report',a,1,'off')).accepted,false);
  assert.equal((await snapshot(b)).camera.last_seen_at,seen);
}));

test('snapshot selects latest active then latest ended, and service role alone can atomically record', () => fixture(async () => {
  await action('claim',a,null,'error');
  await db.exec('reset role;set role service_role');
  const r=await scalar('select claim_study_camera_warning($1,$2,$3,1,$4) value',[user,session,a,'camera_required_warning']);assert.equal(r.allowed,true);
  await auth();
  await admin(() => db.exec(`insert into study_sessions(id,user_id,local_date,started_at,ended_at,status,duration_seconds)
    values('00000000-0000-4000-8000-000000000299','${user}','2026-10-18',now()+interval '1 minute',now()+interval '2 minutes','completed',60)`));
  assert.equal((await snapshot()).session.id,session);
  await admin(() => db.exec(`update study_sessions set status='completed',ended_at=now() where id='${session}'`));
  const s=await snapshot();assert.equal(s.active_session,null);assert.equal(s.session.id,'00000000-0000-4000-8000-000000000299');assert.equal(s.camera,null);
}));

test('a real session pause breaks continuous camera absence even when resume is within heartbeat freshness', () => fixture(async () => {
  await action('claim',a,null,'absent');
  await at('00:10');await action('report',a,1,'absent');
  await at('00:15');await admin(() => db.query('update study_sessions set paused_at=now() where id=$1',[session]));
  await at('00:25');await admin(() => db.query('update study_sessions set paused_at=null,paused_seconds=10 where id=$1',[session]));
  assert.equal((await action('report',a,1,'absent')).camera.absence_seconds,0);
  assert.equal((await warn(a,1,'absence_warning')).allowed,false);
}));

test('legacy checkpoint cannot debit a coordinated session after takeover', () => fixture(async () => {
  await action('claim');await action('claim',b,null,'watching',null,true);await at('10:00');
  const result=await scalar('select checkpoint_actual_study_exclusion($1,300) value',[session]);
  assert.equal(result.excluded_seconds,0);
  assert.equal((await snapshot(b)).camera.excluded_seconds,0);
}));

for(const api of ['pause_actual_study_session','end_study_session','complete_study_session']) test(`${api} preserves signature but cannot trust exclusion from an observer`, () => fixture(async () => {
  await action('claim');await action('claim',b,null,'watching',null,true);await at('10:00');
  const query=api==='complete_study_session' ? 'select to_jsonb(complete_study_session($1,300,$2::uuid[],3,3)) value' : `select to_jsonb(${api}($1,300)) value`;
  const result=await scalar(query,api==='complete_study_session'?[session,[]]:[session]);
  if(api==='pause_actual_study_session') { assert.ok(result.paused_at);assert.equal((await snapshot(b)).tracking.excluded_seconds,0); }
  else { assert.equal(result.duration_seconds,600);assert.equal(result.status,'completed'); }
}));

test('uncoordinated legacy checkpoint and end preserve original explicit-exclusion semantics', () => fixture(async () => {
  await at('10:00');
  assert.equal((await scalar('select checkpoint_actual_study_exclusion($1,100) value',[session])).excluded_seconds,100);
  const ended=await scalar('select to_jsonb(end_study_session($1,150)) value',[session]);
  assert.equal(ended.duration_seconds,450);
}));

test('authenticated telemetry cannot inject either warning type into recovery counts', () => fixture(async () => {
  for(const type of ['absence_warning','camera_required_warning']) {
    await denied(() => db.query('insert into study_presence_events(user_id,session_id,event_type,metadata) values($1,$2,$3,$4)',[user,session,type,JSON.stringify({localDate:'2026-10-18'})]),/row-level security/);
  }
  for(const type of ['camera_started','camera_stopped','camera_permission_denied']) await db.query('insert into study_presence_events(user_id,session_id,event_type) values($1,$2,$3)',[user,session,type]);
  await action('claim',a,null,'absent');
  for(let sec=30;sec<=300;sec+=30) {await at(`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`);await action('report',a,1,'absent');}
  assert.equal((await warn(a,1,'absence_warning')).absence_warning_count,1);
}));

async function absentForTenMinutes() {
  await action('claim',a,null,'absent');
  for(let sec=30;sec<=600;sec+=30) {await at(`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`);await action('report',a,1,'absent');}
}

test('identity-less checkpoint projects only proven absence, never renews freshness and cannot double-debit', () => fixture(async () => {
  await absentForTenMinutes();const expires=(await snapshot()).camera.expires_at;
  await at('10:20');assert.equal((await scalar('select checkpoint_actual_study_exclusion($1,99999) value',[session])).excluded_seconds,20);
  let c=(await snapshot()).camera;assert.equal(c.last_seen_at,'2026-10-18T09:10:20+00:00');assert.equal(c.expires_at,expires);
  await at('10:25');assert.equal((await scalar('select checkpoint_actual_study_exclusion($1,-999) value',[session])).excluded_seconds,25);
  await at('12:00');assert.equal((await scalar('select checkpoint_actual_study_exclusion($1,99999) value',[session])).excluded_seconds,45);
  assert.equal((await scalar('select checkpoint_actual_study_exclusion($1,99999) value',[session])).excluded_seconds,45);
  c=(await snapshot()).camera;assert.equal(c.expires_at,expires);assert.equal(c.status,'stale');
  assert.equal((await warn(a,1,'absence_warning')).allowed,false);
  assert.equal((await action('report',a,1,'absent',0)).camera.excluded_seconds,45);
}));

test('coordinated pause and reflection end use server exclusion once and preserve break duration', () => fixture(async () => {
  await absentForTenMinutes();await at('10:20');
  await scalar('select to_jsonb(pause_actual_study_session($1,99999)) value',[session]);
  assert.equal((await snapshot()).tracking.excluded_seconds,20);
  await at('10:30');const ended=await scalar('select to_jsonb(complete_study_session($1,99999,$2::uuid[],3,3)) value',[session,[]]);
  assert.equal(ended.duration_seconds,600);assert.equal(ended.paused_seconds,10);
  assert.equal((await snapshot()).tracking.excluded_seconds,20);
}));

test('coordinated end projection is bounded by server lease even after camera expiry', () => fixture(async () => {
  await absentForTenMinutes();await admin(() => db.query("update study_sessions set lease_expires_at='2026-10-18T09:10:15Z' where id=$1",[session]));
  await at('12:00');const ended=await scalar('select to_jsonb(end_study_session($1,99999)) value',[session]);
  assert.equal(ended.ended_at,'2026-10-18T09:10:15+00:00');assert.equal(ended.duration_seconds,600);
  assert.equal((await snapshot()).tracking.excluded_seconds,15);
}));

test('private preserved checkpoint and end implementations are not callable by authenticated users', () => fixture(async () => {
  assert.equal(await scalar("select has_schema_privilege(current_user,'study_device_private','USAGE') value"),false);
  for(const name of ['checkpoint_actual_study_exclusion','end_study_session']) await denied(() => scalar(`select study_device_private.${name}($1,300) value`,[session]),/permission denied/);
}));

for(const kind of ['takeover','healthy report']) test(`${kind} settles proven old-owner auto-pause before replacing absence state`, () => fixture(async () => {
  await absentForTenMinutes();await at('10:20');
  const result=kind==='takeover' ? await action('claim',b,null,'watching',null,true) : await action('report',a,1,'watching',null);
  assert.equal(result.camera.excluded_seconds,20);assert.equal(result.tracking.excluded_seconds,20);
  assert.equal(result.camera.status,'watching');assert.equal(result.camera.absence_seconds,0);
}));

test('actual-study preview/confirm cannot route observer exclusion through an internal checkpoint', () => fixture(async () => {
  const focus='00000000-0000-4000-8000-000000000402';
  await admin(() => db.query("insert into study_todos(id,user_id,local_date,title) values($1,$2,'2026-10-18','new focus')",[focus,user]));
  await action('claim');await action('claim',b,null,'watching',null,true);await at('10:00');
  const preview=await scalar('select preview_actual_study_action($1,$2::uuid[],$3,$4,300) value',['switch',[focus],focus,session]);
  assert.equal(preview.blocking_error,null);
  const result=await scalar('select confirm_actual_study_action($1::jsonb,$2) value',[JSON.stringify(preview),'00000000-0000-4000-8000-000000000501']);
  assert.equal(result.tracking.excluded_seconds,0);assert.equal(result.tracking.current_todo_id,focus);
}));

async function timedPausedSession(coordinated=true) {
  const focus='00000000-0000-4000-8000-000000000403';
  await admin(async () => {
    await db.query("update study_sessions set started_at='2026-10-18T08:50Z' where id=$1",[session]);
    await db.query("insert into study_todos(id,user_id,local_date,title,start_time,end_time) values($1,$2,'2026-10-18','60 minute focus','17:50','18:50')",[focus,user]);
    await db.query('insert into study_session_todos(user_id,session_id,todo_id) values($1,$2,$3)',[user,session,focus]);
    await db.query("insert into study_actual_sessions(session_id,user_id,current_todo_id,tracking_started_at) values($1,$2,$3,'2026-10-18T08:50Z')",[session,user,focus]);
    await db.query("insert into study_todo_segments(user_id,session_id,todo_id,started_at) values($1,$2,$3,'2026-10-18T08:50Z')",[user,session,focus]);
  });
  if(coordinated) await action('claim',a,null,'watching');
  await scalar('select to_jsonb(pause_study_session($1)) value',[session]);await at('10:00');
  return focus;
}

test('timed coordinated resume uses server exclusion for preview and confirmed schedule, not observer300', () => fixture(async () => {
  const focus=await timedPausedSession();
  const preview=await scalar('select preview_actual_study_action($1,$2::uuid[],$3,$4,300) value',['resume',[focus],focus,session]);
  assert.equal(preview.blocking_error,null);
  const result=await scalar('select confirm_actual_study_action($1::jsonb,$2) value',[JSON.stringify(preview),'00000000-0000-4000-8000-000000000502']);
  assert.equal(await admin(() => scalar('select end_time::text value from study_todos where id=$1',[focus])),'19:00:00');
  assert.equal(preview.excluded_seconds,0);assert.equal(preview.remaining_seconds,3000);
  assert.equal(result.tracking.excluded_seconds,0);assert.equal(result.tracking.todos.find(t=>t.id===focus).known_seconds,600);
}));

test('uncoordinated timed resume retains legacy explicit-exclusion schedule semantics', () => fixture(async () => {
  const focus=await timedPausedSession(false);
  const preview=await scalar('select preview_actual_study_action($1,$2::uuid[],$3,$4,300) value',['resume',[focus],focus,session]);
  assert.equal(preview.remaining_seconds,3300);assert.equal(preview.excluded_seconds,300);
  const result=await scalar('select confirm_actual_study_action($1::jsonb,$2) value',[JSON.stringify(preview),'00000000-0000-4000-8000-000000000503']);
  assert.equal(await admin(() => scalar('select end_time::text value from study_todos where id=$1',[focus])),'19:05:00');
  assert.equal(result.tracking.excluded_seconds,300);
}));

test('coordinated preview is read-only and normalizes arbitrary exclusion before schedule arithmetic', () => fixture(async () => {
  const focus=await timedPausedSession();const before=await admin(learningDigest);
  for(const input of [null,-999,300,999999]) {
    const preview=await scalar('select preview_actual_study_action($1,$2::uuid[],$3,$4,$5) value',['resume',[focus],focus,session,input]);
    assert.equal(preview.blocking_error,null);assert.equal(preview.excluded_seconds,0);assert.equal(preview.remaining_seconds,3000);
    assert.equal(preview.changes[0].after.end_time,'19:00:00');
  }
  assert.deepEqual(await admin(learningDigest),before);
}));

test('confirm rejects a forged timed preview computed with observer exclusion before any learning write', () => fixture(async () => {
  const focus=await timedPausedSession();
  const forged=await admin(() => scalar("select actual_study_private.preview_uncoordinated($1,$2::uuid[],$3,$4,300,date_trunc('minute',now())) value",['resume',[focus],focus,session]));
  assert.equal(forged.remaining_seconds,3300);assert.equal(forged.changes[0].after.end_time,'19:05:00');
  const before=await admin(learningDigest);
  await denied(() => scalar('select confirm_actual_study_action($1::jsonb,$2) value',[JSON.stringify(forged),'00000000-0000-4000-8000-000000000504']),/ACTUAL_STUDY_STALE_PREVIEW/);
  assert.deepEqual(await admin(learningDigest),before);
}));
