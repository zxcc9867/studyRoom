import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

export const users = Array.from({ length: 9 }, (_, i) => `00000000-0000-4000-8000-${String(i + 101).padStart(12, '0')}`);
export const todoId = '00000000-0000-4000-8000-000000000201';
export async function createTeamDb({ teamMigration = true } = {}) {
  const db = new PGlite();
  const sql = async (query, params = []) => (await db.query(query, params)).rows;
  const scalar = async (query, params = []) => (await sql(query, params))[0]?.value;
  const at = async time => scalar("select set_config('test.now',$1,false) value", [time]);
  const auth = async (user = users[0], role = 'authenticated') => {
    await db.exec('reset role');
    await scalar("select set_config('request.uid',$1,false) value", [user ?? '']);
    await db.exec(`set role ${role}`);
  };
  const admin = async work => { await db.exec('reset role'); try { return await work(); } finally { await auth(); } };
  const existing = (file, name) => {
    const source = readFileSync(`supabase/migrations/${file}`, 'utf8');
    const match = source.match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'i'));
    if (!match) throw new Error(`Missing real SQL fixture function ${name}`);
    return match[0];
  };
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,is_anonymous boolean default false);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    create or replace function pg_catalog.now() returns timestamptz language sql stable as $$select current_setting('test.now')::timestamptz$$;
    select set_config('test.now','2026-10-12T09:00:00Z',false);
    create table profiles(user_id uuid primary key references auth.users,time_zone text default 'Asia/Tokyo',reminder_time time default '21:00',email text);
    create table study_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users,local_date date not null,
      started_at timestamptz default now(),ended_at timestamptz,duration_seconds integer default 0,status text default 'active',
      created_at timestamptz default now(),updated_at timestamptz default now(),lease_expires_at timestamptz,lease_warning_sent_at timestamptz,
      paused_at timestamptz,paused_seconds integer default 0,unique(id,user_id));
    create unique index study_sessions_one_active_per_user_idx on study_sessions(user_id) where status='active';
    create table study_todos(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users,local_date date not null,title text not null,
      start_time time,end_time time,is_completed boolean default false,position integer default 0,
      repeat_group_id uuid,repeat_mode text default 'single',repeat_weekdays smallint[] default '{}',repeat_until date,repeat_forever boolean default false,
      coach_start_at timestamptz,coach_end_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),unique(id,user_id));
    create table study_recovery_requests(id uuid primary key default gen_random_uuid(),user_id uuid,status text,local_date date,trigger_type text,reason text,submitted_at timestamptz,followup_sent_at timestamptz);
    create table attendance_days(user_id uuid,local_date date,status text,reminder_at timestamptz,deadline_at timestamptz,qualifying_session_id uuid,marked_at timestamptz,
      initial_reminder_claimed_at timestamptz,nudge_reminder_claimed_at timestamptz,primary key(user_id,local_date));
    create function local_reminder_at(d date,t time,z text) returns timestamptz language sql as $$select(d+t)at time zone z$$;
    create function effective_reminder_time(d date,t time) returns time language sql as $$select t$$;
    create function promote_attendance_by_daily_study_total(p_user_id uuid,p_local_date date,p_now timestamptz default now(),p_qualifying_session_id uuid default null)returns boolean language sql as $$select true$$;
    create table study_session_reflections(user_id uuid,session_id uuid primary key,focus_score integer,energy_score integer,interruption_reason text,note text,next_action text,updated_at timestamptz);
    alter table study_sessions enable row level security;
    create policy session_owner on study_sessions to authenticated using(auth.uid()=user_id)with check(auth.uid()=user_id);
    alter table study_todos enable row level security;
    create policy todo_owner on study_todos to authenticated using(auth.uid()=user_id)with check(auth.uid()=user_id);
    grant select,insert,update,delete on study_sessions,study_todos to authenticated; grant select on profiles to authenticated;`);
  for (const user of users) await db.query('insert into auth.users(id) values($1);', [user]);
  await db.query('update auth.users set is_anonymous=true where id=$1', [users[8]]);
  for (const user of users) await db.query('insert into profiles(user_id) values($1)', [user]);
  await db.exec(readFileSync('supabase/migrations/20260621083000_study_session_todo_links.sql', 'utf8'));
  for (const name of ['complete_study_session','start_study_session']) await db.exec(existing('20260712142233_sustainable_study_loop.sql', name));
  for (const name of ['pause_study_session','resume_study_session']) await db.exec(existing('20260719134726_add_study_session_breaks.sql', name));
  for (const name of ['end_study_session','close_expired_study_sessions']) await db.exec(existing('20260804133546_enforce_session_lease_expiry.sql', name));
  await db.exec(readFileSync('supabase/migrations/20260921095213_actual_study_tracking.sql', 'utf8'));
  if (teamMigration) {
    await db.exec(readFileSync('supabase/migrations/20261012143354_team_study_room.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/20261013081052_team_focus_options.sql', 'utf8'));
  }
  await auth();
  const action = (name, payload = {}) => scalar('select public.team_study_action($1,$2::jsonb) value', [name, JSON.stringify(payload)]);
  const snapshot = () => scalar('select public.team_study_snapshot() value');
  const start = async (user = users[0], id = todoId, localDate = '2026-10-12') => {
    await admin(() => db.query("insert into study_todos(id,user_id,local_date,title) values($1,$2,$3,'Private title')", [id, user, localDate]));
    await auth(user);
    const p = await scalar("select preview_actual_study_action('start',$1::uuid[],$2,null,0) value", [[id], id]);
    return (await scalar('select confirm_actual_study_action($1::jsonb,gen_random_uuid()) value', [JSON.stringify(p)])).session;
  };
  return { db, sql, scalar, at, auth, admin, action, snapshot, start };
}
