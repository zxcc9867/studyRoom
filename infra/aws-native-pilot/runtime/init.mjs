import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { createPool, readCredentials, transaction } from './store.mjs';

function roleVerifier(password) {
  // Secrets Manager generates a printable ASCII password, so PostgreSQL SASLprep is identity.
  if (typeof password !== 'string' || !/^[\x21-\x7e]{16,128}$/.test(password)) throw new Error('invalid_app_password');
  const salt = randomBytes(16);
  const salted = pbkdf2Sync(password, salt, 4096, 32, 'sha256');
  const key = label => createHmac('sha256', salted).update(label).digest();
  const stored = createHash('sha256').update(key('Client Key')).digest('base64');
  const server = key('Server Key').toString('base64');
  return `SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
}

export async function initialize(client, { username, password }) {
  if (typeof username !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(username)) {
    throw new Error('invalid_app_username');
  }
  const role = `"${username}"`;
  const verifier = roleVerifier(password);
  await transaction(client, async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(1834719210)');
    const { rows } = await tx.query(`
      SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls OR NOT rolcanlogin
        OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member = role.oid) AS elevated
      FROM pg_catalog.pg_roles role WHERE rolname = $1`, [username]);
    // DDL does not accept parameter placeholders for roles or passwords. The identifier is allowlisted;
    // the literal is a locally derived SCRAM verifier (base64), never the Secrets Manager password.
    if (rows[0]?.elevated) throw new Error('unsafe_existing_app_role');
    const action = rows.length ? `ALTER ROLE ${role}` : `CREATE ROLE ${role} LOGIN`;
    await tx.query(`${action} PASSWORD '${verifier}'`);
    await tx.query('CREATE SCHEMA IF NOT EXISTS study_pilot');
    await tx.query(`CREATE TABLE IF NOT EXISTS study_pilot.records (
      id uuid PRIMARY KEY,
      owner uuid NOT NULL,
      minutes integer NOT NULL CHECK (minutes BETWEEN 1 AND 240),
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await tx.query(`CREATE TABLE IF NOT EXISTS study_pilot.coaching (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner uuid NOT NULL,
      status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
      result text CHECK (length(result) <= 1000),
      created_at timestamptz NOT NULL DEFAULT now(),
      dispatch_after timestamptz NOT NULL DEFAULT now(),
      dispatch_attempts integer NOT NULL DEFAULT 0,
      dispatched_at timestamptz,
      claimed_at timestamptz,
      CHECK ((status = 'done') = (result IS NOT NULL))
    )`);
    await tx.query('CREATE INDEX IF NOT EXISTS records_owner_created_idx ON study_pilot.records (owner, created_at DESC, id DESC)');
    await tx.query('CREATE INDEX IF NOT EXISTS coaching_created_idx ON study_pilot.coaching (created_at)');
    await tx.query(`CREATE INDEX IF NOT EXISTS coaching_dispatch_idx ON study_pilot.coaching (dispatch_after)
      WHERE status = 'queued' AND dispatched_at IS NULL`);
    await tx.query(`REVOKE ALL ON SCHEMA study_pilot FROM PUBLIC`);
    await tx.query(`GRANT USAGE ON SCHEMA study_pilot TO ${role}`);
    await tx.query(`GRANT SELECT, INSERT ON study_pilot.records TO ${role}`);
    await tx.query(`GRANT SELECT, INSERT ON study_pilot.coaching TO ${role}`);
    await tx.query(`GRANT UPDATE (status, result, dispatch_after, dispatch_attempts, dispatched_at, claimed_at)
      ON study_pilot.coaching TO ${role}`);
  });
}

export async function handler() {
  let pool;
  let client;
  try {
    if (!process.env.NODE_EXTRA_CA_CERTS) throw new Error('missing_aurora_ca');
    const [admin, app] = await Promise.all([
      readCredentials(process.env.DB_SECRET_ARN), readCredentials(process.env.DB_APP_SECRET_ARN),
    ]);
    if (admin.username === app.username) throw new Error('shared_db_role');
    pool = await createPool(admin);
    client = await pool.connect();
    await initialize(client, app);
    return { ok: true };
  } catch {
    throw new Error('pilot_init_failed');
  } finally {
    client?.release();
    await pool?.end();
  }
}
