import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const owner = '00000000-0000-4000-8000-000000000101';
const other = '00000000-0000-4000-8000-000000000102';
let db;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'), ('${other}');
  `);
  await db.exec(readFileSync('supabase/migrations/20260930152103_mobile_web_auth_limit.sql', 'utf8'));
});
after(async () => await db?.close());

async function rollbackAfter(fn) {
  await db.exec('begin');
  try { await fn(); } finally { await db.exec('rollback'); }
}

test('one user may issue at most ten tickets in five minutes without exhausting another user', async () => rollbackAfter(async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { rows } = await db.query('select public.try_issue_mobile_web_auth_ticket($1) as allowed', [owner]);
    assert.equal(rows[0].allowed, true);
  }
  assert.equal((await db.query('select public.try_issue_mobile_web_auth_ticket($1) as allowed', [owner])).rows[0].allowed, false);
  assert.equal((await db.query('select public.try_issue_mobile_web_auth_ticket($1) as allowed', [other])).rows[0].allowed, true);
  await db.query("update public.mobile_web_auth_limits set window_started_at = now() - interval '6 minutes' where user_id=$1", [owner]);
  assert.equal((await db.query('select public.try_issue_mobile_web_auth_ticket($1) as allowed', [owner])).rows[0].allowed, true);
}));

test('browser roles cannot read limits or invoke the privileged issue gate', async () => rollbackAfter(async () => {
  const { rows } = await db.query(`
    select
      has_table_privilege('anon', 'public.mobile_web_auth_limits', 'SELECT') as anon_read,
      has_table_privilege('authenticated', 'public.mobile_web_auth_limits', 'SELECT') as user_read,
      has_function_privilege('anon', 'public.try_issue_mobile_web_auth_ticket(uuid)', 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', 'public.try_issue_mobile_web_auth_ticket(uuid)', 'EXECUTE') as user_execute,
      has_function_privilege('service_role', 'public.try_issue_mobile_web_auth_ticket(uuid)', 'EXECUTE') as service_execute
  `);
  assert.deepEqual(rows[0], {
    anon_read: false, user_read: false, anon_execute: false, user_execute: false, service_execute: true,
  });
  await db.exec('set local role authenticated');
  await assert.rejects(() => db.query('select public.try_issue_mobile_web_auth_ticket($1)', [owner]), /permission denied/);
}));
