import { randomUUID } from 'node:crypto';

export function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

let secrets;
export async function readCredentials(secretId) {
  if (!secretId) throw new Error('missing_secret_id');
  secrets ??= import('@aws-sdk/client-secrets-manager').then(({ SecretsManagerClient, GetSecretValueCommand }) =>
    ({ client: new SecretsManagerClient({ maxAttempts: 1 }), GetSecretValueCommand }));
  const { client, GetSecretValueCommand } = await secrets;
  const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: secretId }),
    { abortSignal: AbortSignal.timeout(3000) });
  const { username, password } = JSON.parse(SecretString);
  if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
    throw new Error('invalid_db_secret');
  }
  return { username, password };
}

export async function createPool(credentials) {
  const host = process.env.DB_HOST;
  const database = process.env.DB_NAME;
  if (!host || !database) throw new Error('missing_db_endpoint');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    host, database, port: 5432, user: credentials.username, password: credentials.password,
    ssl: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    max: 2, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000,
    query_timeout: 5000, allowExitOnIdle: true,
  });
  pool.on('error', () => {}); // Idle connections can close between invocations; do not log driver details.
  return pool;
}

let poolPromise;
function applicationPool() {
  poolPromise ??= readCredentials(process.env.DB_SECRET_ARN).then(createPool).catch(error => {
    poolPromise = undefined;
    throw error;
  });
  return poolPromise;
}

export async function transaction(client, work) {
  await client.query('BEGIN');
  try {
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

export function createStore(getPool) {
  const query = async (sql, args = []) => (await (await getPool()).query(sql, args)).rows;
  return {
    listRecords: owner => query(
      'SELECT id, minutes FROM study_pilot.records WHERE owner = $1 ORDER BY created_at DESC, id DESC LIMIT 100', [owner]),
    getRecord: async (owner, id) => (await query(
      'SELECT id, minutes FROM study_pilot.records WHERE owner = $1 AND id = $2', [owner, id]))[0] ?? null,
    insertRecord: async (owner, minutes) => (await query(
      'INSERT INTO study_pilot.records (owner, id, minutes) VALUES ($1, $2, $3) RETURNING id, minutes',
      [owner, randomUUID(), minutes]))[0],
    async getJob(owner, id) {
      const [row] = await query('SELECT id, status, result FROM study_pilot.coaching WHERE owner = $1 AND id = $2', [owner, id]);
      if (!row) return null;
      const job = { id: row.id, status: row.status };
      if (row.status === 'done') job.result = row.result;
      if (row.status === 'failed') job.error = 'coaching_failed';
      return job;
    },
    async insertJob(owner) {
      const client = await (await getPool()).connect();
      let failure;
      try {
        return await transaction(client, async tx => {
          // Use a separate statement after the transaction lock so READ COMMITTED sees prior inserts.
          await tx.query('SELECT pg_advisory_xact_lock(1834719211)');
          const { rows } = await tx.query(
            `INSERT INTO study_pilot.coaching (owner)
             SELECT $1 WHERE EXISTS (
               SELECT 1 FROM study_pilot.coaching
               WHERE created_at >= date_trunc('day', statement_timestamp(), 'UTC')
               HAVING COUNT(*) FILTER (WHERE owner = $1) < $2 AND COUNT(*) < $3
             ) RETURNING id`, [owner, 3, 30]);
          return rows[0] ?? null;
        });
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        client.release(failure);
      }
    },
    expireJobs: () => query(
      `UPDATE study_pilot.coaching SET status = 'failed'
       WHERE id IN (
         SELECT id FROM study_pilot.coaching
         WHERE (status = 'queued' AND (created_at <= now() - interval '15 minutes'
           OR (dispatched_at IS NULL AND dispatch_attempts >= 5 AND dispatch_after <= now())))
           OR (status = 'running' AND claimed_at <= now() - interval '2 minutes')
         ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 30
       ) RETURNING id, owner`),
    reserveDispatch: () => query(
      `UPDATE study_pilot.coaching SET dispatch_after = now() + interval '45 seconds',
         dispatch_attempts = dispatch_attempts + 1
       WHERE id IN (
         SELECT id FROM study_pilot.coaching WHERE status = 'queued' AND dispatched_at IS NULL
           AND dispatch_after <= now() AND dispatch_attempts < 5 AND created_at > now() - interval '15 minutes'
         ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 10
       ) RETURNING id`),
    markDispatched: id => query('UPDATE study_pilot.coaching SET dispatched_at = now() WHERE id = $1', [id]),
    claimJob: async id => (await query(
      `UPDATE study_pilot.coaching SET status = 'running', claimed_at = now()
       WHERE id = $1 AND status = 'queued' AND created_at > now() - interval '15 minutes'
       RETURNING id, owner`, [id]))[0] ?? null,
    finishJob: async (id, status, result) => (await query(
      `UPDATE study_pilot.coaching SET status = $2, result = $3 WHERE id = $1 AND status = 'running' RETURNING id`,
      [id, status, result])).length === 1,
  };
}

export const store = createStore(applicationPool);
