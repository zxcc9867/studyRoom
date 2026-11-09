import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrations = new URL('../../migrations/', import.meta.url);
const owner = '10000000-0000-0000-0000-000000000001';
const other = '10000000-0000-0000-0000-000000000002';
const active = '20000000-0000-0000-0000-000000000001';
const foreign = '20000000-0000-0000-0000-000000000002';
const completed = '20000000-0000-0000-0000-000000000003';
const ended = '20000000-0000-0000-0000-000000000004';
const missing = '20000000-0000-0000-0000-000000000005';

test('scenery permits only active session owners to read, seed and change the theme', async (t) => {
  const files = (await readdir(migrations)).filter((file) => file.endsWith('_add_study_session_scenery.sql'));
  assert.equal(files.length, 1, 'expected one scenery migration');
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    alter default privileges in schema public grant all on tables to public, anon, authenticated, service_role;
    create schema auth;
    grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create table public.study_sessions (id uuid primary key, user_id uuid not null, status text not null, ended_at timestamptz);
    insert into public.study_sessions values
      ('${active}', '${owner}', 'active', null),
      ('${foreign}', '${other}', 'active', null),
      ('${completed}', '${owner}', 'completed', null),
      ('${ended}', '${owner}', 'active', now());
    alter table public.study_sessions enable row level security;
    create policy owner_read on public.study_sessions for select to authenticated using (auth.uid() = user_id);
  `);
  await db.exec(await readFile(new URL(files[0], migrations), 'utf8'));

  await t.test('overrides permissive default grants with only the three client privileges', async () => {
    const { rows } = await db.query(`
      select grantee, privilege_type
      from information_schema.table_privileges
      where table_schema = 'public' and table_name = 'study_session_scenery'
        and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      order by grantee, privilege_type
    `);
    assert.deepEqual(rows, ['INSERT', 'SELECT', 'UPDATE'].map((privilege_type) => ({
      grantee: 'authenticated',
      privilege_type,
    })));
  });

  const read = async (id) => (await db.query(
    'select theme_id from public.study_session_scenery where session_id = $1',
    [id],
  )).rows;
  const insert = 'insert into public.study_session_scenery (session_id, theme_id) values ($1, $2)';
  const seed = `${insert} on conflict (session_id) do nothing`;
  const upsert = `${insert} on conflict (session_id) do update set theme_id = excluded.theme_id`;
  const signIn = (user) => db.exec(`set role authenticated; set request.jwt.claim.sub = '${user}';`);
  await signIn(owner);

  await t.test('seeding preserves the existing theme and explicit upsert changes it', async () => {
    assert.deepEqual(await read(active), []);
    await db.query(seed, [active, 'forest-1']);
    await db.query(seed, [active, 'night']);
    assert.deepEqual(await read(active), [{ theme_id: 'forest-1' }]);
    await db.query(upsert, [active, 'a'.repeat(48)]);
    assert.deepEqual(await read(active), [{ theme_id: 'a'.repeat(48) }]);
  });

  await t.test('rejects invalid themes, foreign and inactive sessions, and deletion', async () => {
    for (const value of ['Forest', '1forest', 'forest_', 'forest\n', 'a'.repeat(49), '']) {
      await assert.rejects(db.query(upsert, [active, value]), { code: '23514' });
    }
    await assert.rejects(db.query(upsert, [active, null]), { code: '23502' });
    for (const id of [foreign, completed, ended, missing]) {
      await assert.rejects(db.query(seed, [id, 'forest']), { code: '42501' });
    }
    await assert.rejects(db.query(
      'update public.study_session_scenery set session_id = $1 where session_id = $2',
      [foreign, active],
    ), { code: '42501' });
    await assert.rejects(db.query('delete from public.study_session_scenery where session_id = $1', [active]), { code: '42501' });
  });

  await t.test('blocks a different account and anon from reading or overwriting the theme', async () => {
    await signIn(other);
    assert.deepEqual(await read(active), []);
    await assert.rejects(db.query(upsert, [active, 'night']), { code: '42501' });
    assert.deepEqual(await db.query(
      'update public.study_session_scenery set theme_id = $1 where session_id = $2 returning theme_id',
      ['night', active],
    ).then((result) => result.rows), []);
    await db.exec('set role anon');
    await assert.rejects(read(active), { code: '42501' });
    await assert.rejects(db.query(seed, [active, 'night']), { code: '42501' });
  });

  await t.test('ending a session hides its theme, and deleting its parent cascades', async () => {
    await db.exec('reset role');
    await db.query("update public.study_sessions set status = 'completed', ended_at = now() where id = $1", [active]);
    await signIn(owner);
    assert.deepEqual(await read(active), []);
    await assert.rejects(db.query(upsert, [active, 'night']), { code: '42501' });
    await db.exec('reset role');
    assert.deepEqual(await read(active), [{ theme_id: 'a'.repeat(48) }]);
    await db.query('delete from public.study_sessions where id = $1', [active]);
    assert.deepEqual(await read(active), []);
  });
});
