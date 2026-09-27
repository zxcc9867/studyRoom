import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const owner = '00000000-0000-4000-8000-000000000101';
const other = '00000000-0000-4000-8000-000000000102';
const installation = '00000000-0000-4000-8000-000000000201';
let db;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.uid', true), '')::uuid$$;
    grant usage on schema auth, public to authenticated, service_role;
    create table public.study_sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id),
      started_at timestamptz not null default now(),
      status text not null default 'active',
      paused_at timestamptz,
      lease_expires_at timestamptz,
      updated_at timestamptz not null default now()
    );
    grant select, insert, update on public.study_sessions to authenticated;
    insert into auth.users values ('${owner}'), ('${other}');
  `);
  await db.exec(readFileSync('supabase/migrations/20260927150154_android_focus_mode.sql', 'utf8'));
});
after(async () => await db?.close());

async function inTransaction(fn) {
  await db.exec('begin');
  try { await fn(); } finally { await db.exec('rollback'); }
}
async function asUser(userId) {
  await db.exec(`set local role authenticated; select set_config('request.uid', '${userId}', true)`);
}

test('start, pause, resume and expiry update server revision without rewriting study history', async () => inTransaction(async () => {
  const started = (await db.query(
    "insert into study_sessions(user_id,lease_expires_at) values($1,now()+interval '2 hours') returning id", [owner],
  )).rows[0].id;
  let state = (await db.query('select * from study_focus_state where user_id=$1', [owner])).rows[0];
  assert.equal(state.desired_focus, true);
  const firstRevision = Number(state.revision);
  await db.query('update study_sessions set paused_at=now() where id=$1', [started]);
  state = (await db.query('select * from study_focus_state where user_id=$1', [owner])).rows[0];
  assert.equal(state.desired_focus, false);
  assert.equal(Number(state.revision), firstRevision + 1);
  await db.query('update study_sessions set paused_at=null where id=$1', [started]);
  state = (await db.query('select * from study_focus_state where user_id=$1', [owner])).rows[0];
  assert.equal(state.desired_focus, true);
  await db.query('update study_sessions set lease_expires_at=now()-interval \'1 minute\' where id=$1', [started]);
  state = (await db.query('select * from study_focus_state where user_id=$1', [owner])).rows[0];
  assert.equal(state.desired_focus, false);
}));

test('another user cannot inspect or acknowledge the owner device', async () => inTransaction(async () => {
  await db.query("insert into study_sessions(user_id,lease_expires_at) values($1,now()+interval '2 hours')", [owner]);
  await asUser(owner);
  await db.query('select register_study_focus_device($1,$2,true,true)', [installation, 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]']);
  const revision = Number((await db.query('select revision from study_focus_state')).rows[0].revision);
  assert.equal((await db.query('select ack_study_focus_device($1,$2,true,true,null) ok', [installation, revision])).rows[0].ok, true);
  await db.exec('reset role');
  await asUser(other);
  assert.equal((await db.query('select * from study_focus_devices')).rows.length, 0);
  assert.equal((await db.query('select * from study_focus_state')).rows.length, 0);
  assert.equal((await db.query('select ack_study_focus_device($1,$2,true,true,null) ok', [installation, revision])).rows[0].ok, false);
  assert.equal((await db.query('select has_table_privilege(\'authenticated\',\'study_focus_devices\',\'UPDATE\') ok')).rows[0].ok, false);
}));

test('stale acknowledgement cannot report applied success', async () => inTransaction(async () => {
  await db.query("insert into study_sessions(user_id,lease_expires_at) values($1,now()+interval '2 hours')", [owner]);
  await asUser(owner);
  await db.query('select register_study_focus_device($1,$2,true,true)', [installation, 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaa]']);
  const revision = Number((await db.query('select revision from study_focus_state')).rows[0].revision);
  assert.equal((await db.query('select ack_study_focus_device($1,$2,false,true,null) ok', [installation, revision])).rows[0].ok, false);
  assert.equal((await db.query('select ack_study_focus_device($1,$2,true,true,null) ok', [installation, revision - 1])).rows[0].ok, false);
}));
