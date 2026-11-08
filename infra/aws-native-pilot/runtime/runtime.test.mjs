import assert from 'node:assert/strict';
import test from 'node:test';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const event = (routeKey, body, sub = owner, token_use = 'access') => ({
  routeKey, body, pathParameters: { id },
  requestContext: { authorizer: { jwt: { claims: { sub, token_use } } } },
});
async function runtime(file, name) {
  const module = await import(`./${file}.mjs`).catch(error => {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url?.endsWith(`/${file}.mjs`)) return {};
    throw error;
  });
  assert.equal(typeof module[name], 'function', `missing ${file} runtime: ${name}`);
  return module[name];
}

test('rejects ID tokens and invalid subjects without touching storage', async () => {
  const createApi = await runtime('api', 'createApi');
  const api = createApi({});
  assert.equal((await api(event('GET /records', undefined, owner, 'id'))).statusCode, 401);
  assert.equal((await api(event('GET /records', undefined, 'not-a-uuid'))).statusCode, 401);
});

test('write inputs reject extra properties, invalid minutes, and oversized or non-JSON payloads', async () => {
  const createApi = await runtime('api', 'createApi');
  const api = createApi({});
  for (const body of ['{"minutes":0}', '{"minutes":241}', '{"minutes":1.5}', '{"minutes":"15"}',
    '{"minutes":15,"owner":"other"}', 'null', 'not JSON', `${' '.repeat(2048)}{"minutes":15}`]) {
    assert.equal((await api(event('POST /records', body))).statusCode, 400, body.slice(0, 35));
  }
  for (const body of ['{"prompt":"free form"}', '[]', 'null', undefined]) {
    assert.equal((await api(event('POST /coaching', body))).statusCode, 400);
  }
});

test('owner-bound reads use the JWT subject and never return someone else’s ID', async () => {
  const createApi = await runtime('api', 'createApi');
  const getRecord = async (sub, recordId) => sub === owner && recordId === id ? { id, minutes: 15 } : null;
  const getJob = async (sub, jobId) => sub === owner && jobId === id ? { id, status: 'queued' } : null;
  const api = createApi({ db: { getRecord, getJob, listRecords: async sub => sub === owner ? [{ id, minutes: 15 }] : [] } });
  for (const route of ['GET /records/{id}', 'GET /coaching/{id}']) {
    assert.equal((await api(event(route, undefined, other))).statusCode, 404);
    assert.equal((await api(event(route))).statusCode, 200);
  }
  assert.deepEqual(JSON.parse((await api(event('GET /records', undefined, other))).body), { records: [] });
});

test('record commits before notification and notification failure does not change 201', async () => {
  const createApi = await runtime('api', 'createApi');
  const writes = [];
  const api = createApi({
    db: { insertRecord: async (...args) => { writes.push(['commit', ...args]); return { id, minutes: 15 }; } },
    publish: async (sub, payload) => { writes.push(['signal', sub, payload]); throw new Error('internal detail'); },
  });
  const response = await api(event('POST /records', '{"minutes":15}'));
  assert.equal(response.statusCode, 201);
  assert.deepEqual(JSON.parse(response.body), { id, minutes: 15 });
  assert.deepEqual(writes, [['commit', owner, 15], ['signal', owner, { kind: 'record', id }]]);
});

test('a failed DB write emits no signal and leaks no failure details', async () => {
  const createApi = await runtime('api', 'createApi');
  let signaled = false;
  const api = createApi({
    db: { insertRecord: async () => { throw new Error('sensitive error'); } },
    publish: async () => { signaled = true; },
  });
  const response = await api(event('POST /records', '{"minutes":15}'));
  assert.equal(response.statusCode, 500);
  assert.equal(signaled, false);
  assert.deepEqual(JSON.parse(response.body), { error: 'internal_error' });
});

test('coaching enqueue is a durable write, and exhausted quota is visible', async () => {
  const createApi = await runtime('api', 'createApi');
  const trace = [];
  const api = createApi({
    db: { insertJob: async sub => { trace.push(['commit', sub]); return trace.length === 1 ? { id } : null; } },
    publish: async (sub, payload) => { trace.push(['signal', sub, payload]); },
  });
  const request = event('POST /coaching', '{}');
  const accepted = await api(request);
  assert.equal(accepted.statusCode, 202);
  assert.deepEqual(JSON.parse(accepted.body), { id });
  assert.deepEqual(trace, [['commit', owner], ['signal', owner, { kind: 'coaching', id }]]);
  assert.equal((await api(request)).statusCode, 429);
  assert.equal(trace.length, 3);
});

test('dispatch is only marked after SQS acknowledgement, and a failed send can be retried', async () => {
  const createDispatcher = await runtime('dispatcher', 'createDispatcher');
  let dispatched = false;
  let sends = 0;
  const run = createDispatcher({
    db: {
      expireJobs: async () => [],
      reserveDispatch: async () => dispatched ? [] : [{ id }],
      markDispatched: async jobId => { assert.equal(jobId, id); dispatched = true; },
    },
    send: async jobId => { assert.equal(jobId, id); if (++sends === 1) throw new Error('network'); },
  });
  await run();
  assert.equal(dispatched, false);
  await run();
  assert.equal(dispatched, true);
  await run();
  assert.equal(sends, 2);
});

const message = { messageId: 'sqs-message', body: JSON.stringify({ id }) };

test('duplicate delivery cannot call the model again; signal failure does not retry completed jobs', async () => {
  const createWorker = await runtime('worker', 'createWorker');
  let state = 'queued';
  const trace = [];
  const run = createWorker({
    db: {
      claimJob: async jobId => {
        assert.equal(jobId, id);
        if (state !== 'queued') return null;
        state = 'running';
        return { id, owner };
      },
      finishJob: async (jobId, status, result) => {
        state = status;
        trace.push(['persist', jobId, status, result]);
        return true;
      },
    },
    generate: async () => { trace.push(['model']); return 'Take a short break.'; },
    publish: async (sub, payload) => { trace.push(['signal', sub, payload]); throw new Error('network'); },
  });
  const results = await Promise.all([run({ Records: [message] }), run({ Records: [message] })]);
  assert.deepEqual(results, [{ batchItemFailures: [] }, { batchItemFailures: [] }]);
  assert.equal(state, 'done');
  assert.deepEqual(trace, [['model'], ['persist', id, 'done', 'Take a short break.'],
    ['signal', owner, { kind: 'coaching', id }]]);
});

test('model failures persist only a sanitized terminal status and never retry the model', async () => {
  const createWorker = await runtime('worker', 'createWorker');
  let claims = 0;
  const statuses = [];
  const run = createWorker({
    db: {
      claimJob: async () => ++claims === 1 ? { id, owner } : null,
      finishJob: async (...args) => { statuses.push(args); return true; },
    },
    generate: async () => { throw new Error('model credentials or prompt'); },
    publish: async () => {},
  });
  assert.deepEqual(await run({ Records: [message, message] }), { batchItemFailures: [] });
  assert.deepEqual(statuses, [[id, 'failed', null]]);
});

test('AppSync IAM publication uses the full event URL and an encoded event on the owner channel', async () => {
  const createPublisher = await runtime('publisher', 'createPublisher');
  const url = 'https://example.test/event';
  const publish = createPublisher({
    url,
    sign: async request => {
      assert.deepEqual(JSON.parse(request.body), {
        channel: `/study/${owner}`, events: [JSON.stringify({ kind: 'record', id })],
      });
      assert.equal(request.path, '/event');
      return { headers: { authorization: 'test-signature' } };
    },
    request: async (target, options) => {
      assert.equal(target.href, url);
      assert.equal(options.headers.authorization, 'test-signature');
      assert.equal(options.method, 'POST');
      assert.equal(options.signal.aborted, false);
      return { ok: true, json: async () => ({ successful: [{}], failed: [] }) };
    },
  });
  await publish(owner, { kind: 'record', id });
});

test('signal deadline is enforced even if its transport never settles', async () => {
  const bestEffortSignal = await runtime('publisher', 'bestEffortSignal');
  await bestEffortSignal(() => new Promise(() => {}), owner, { kind: 'record', id }, 5);
});

test('record and coaching storage bind owner and resource ID in the real SQL', async () => {
  const createStore = await runtime('store', 'createStore');
  const queries = [];
  const store = createStore(async () => ({
    query: async (sql, args) => { queries.push({ sql, args }); return { rows: [] }; },
  }));
  assert.equal(await store.getRecord(other, id), null);
  assert.equal(await store.getJob(other, id), null);
  await store.listRecords(other);
  for (const { sql, args } of queries.slice(0, 2)) {
    assert.match(sql, /WHERE owner = \$1 AND id = \$2/i);
    assert.deepEqual(args, [other, id]);
  }
  assert.match(queries[2].sql, /WHERE owner = \$1/i);
  assert.deepEqual(queries[2].args, [other]);
});

test('quota is serialized and durable before insertJob reports the queued ID', async () => {
  const createStore = await runtime('store', 'createStore');
  const trace = [];
  const store = createStore(async () => ({
    connect: async () => ({
      query: async (sql, args) => {
        trace.push(sql);
        if (sql.includes('INSERT INTO')) {
          assert.deepEqual(args, [owner, 3, 30]);
          return { rows: [{ id }] };
        }
        return { rows: [] };
      },
      release: () => trace.push('release'),
    }),
  }));
  assert.deepEqual(await store.insertJob(owner), { id });
  assert.equal(trace[0], 'BEGIN');
  assert.match(trace[1], /pg_advisory_xact_lock/i);
  assert.match(trace[2], /INSERT INTO.*[\s\S]*WHERE.*[\s\S]*COUNT/i);
  assert.deepEqual(trace.slice(-2), ['COMMIT', 'release']);
});

test('job claim is an atomic queued-only update and stale running jobs never return to queued', async () => {
  const createStore = await runtime('store', 'createStore');
  const queries = [];
  const store = createStore(async () => ({
    query: async (sql, args) => { queries.push({ sql, args }); return { rows: [] }; },
  }));
  assert.equal(await store.claimJob(id), null);
  assert.deepEqual(await store.expireJobs(), []);
  assert.match(queries[0].sql, /UPDATE[\s\S]*SET status = 'running'[\s\S]*WHERE id = \$1 AND status = 'queued'[\s\S]*RETURNING/i);
  assert.deepEqual(queries[0].args, [id]);
  assert.match(queries[1].sql, /UPDATE[\s\S]*SET status = 'failed'[\s\S]*status = 'running'/i);
});

test('bootstrap rolls back partial schema and never embeds a plaintext role password', async () => {
  const initialize = await runtime('init', 'initialize');
  const trace = [];
  const secret = 'synthetic-$-password';
  const db = {
    query: async (sql, args) => {
      trace.push([sql, args]);
      if (sql.includes('pg_roles')) return { rows: [] };
      if (sql.includes('GRANT USAGE')) throw new Error('db failure');
      return { rows: [] };
    },
  };
  await assert.rejects(initialize(db, { username: 'synthetic_app', password: secret }), /db failure/);
  assert.match(trace.find(([sql]) => sql.includes('CREATE ROLE'))?.[0], /SCRAM-SHA-256\$4096:/);
  assert.equal(JSON.stringify(trace).includes(secret), false);
  assert.equal(trace[0][0], 'BEGIN');
  assert.equal(trace.at(-1)[0], 'ROLLBACK');
});

test('bootstrap rerun changes only the safe login password, without superuser-only attributes', async () => {
  const initialize = await runtime('init', 'initialize');
  const commands = [];
  const db = {
    query: async sql => {
      commands.push(sql);
      return { rows: sql.includes('pg_roles') ? [{ elevated: false }] : [] };
    },
  };
  await initialize(db, { username: 'synthetic_app', password: 'synthetic-$-password' });
  assert.match(commands.find(sql => sql.startsWith('ALTER ROLE')), /^ALTER ROLE "synthetic_app" PASSWORD /);
  assert.equal(commands.at(-1), 'COMMIT');
});
