import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const ts = require('typescript');
const owner = 'user-1';
const day = '2026-10-01';
const sessionId = 'a75a57df-abbe-487e-b43d-3cd4947ad4af';

// Run the actual Edge handler and shared recovery code; replace only DB/auth/Slack I/O.
function setup({ events = [], slack = false } = {}) {
  const tables = {
    study_sessions: [{ id: sessionId, user_id: owner, local_date: day, status: 'active' }],
    study_presence_events: structuredClone(events),
    study_recovery_requests: [],
    notification_targets: slack ? [{ id: 'target-1', user_id: owner, kind: 'slack', enabled: true, destination: 'channel-1' }] : [],
    notification_deliveries: [],
  };
  const messages = [];
  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select(_fields, options = {}) { this.countOnly = options.head; return this; }
    eq(key, value) { this.filters.push(row => row[key] === value); return this; }
    contains(key, values) { this.filters.push(row => Object.entries(values).every(([k, v]) => row[key]?.[k] === v)); return this; }
    not(key, _operator, value) { this.filters.push(row => row[key] !== value); return this; }
    order() { return this; }
    limit(value) { this.limitValue = value; return this; }
    insert(value) { this.inserting = value; return this; }
    update(value) { this.updating = value; return this; }
    async maybeSingle() { return this.execute(true); }
    async single() { return this.execute(true); }
    then(resolve, reject) { return Promise.resolve(this.execute(false)).then(resolve, reject); }
    execute(single) {
      const rows = tables[this.table];
      assert.ok(rows, `Unexpected table: ${this.table}`);
      if (this.inserting) {
        const row = { id: `${this.table}-${rows.length + 1}`, slack_message_ts: null, ...this.inserting };
        rows.push(row);
        return { data: single ? row : [row], error: null };
      }
      const matches = rows.filter(row => this.filters.every(filter => filter(row)));
      if (this.updating) matches.forEach(row => Object.assign(row, this.updating));
      const limited = matches.slice(0, this.limitValue ?? matches.length);
      return { data: single ? limited[0] ?? null : limited, count: matches.length, error: null };
    }
  }
  const admin = {
    auth: { getUser: async token => ({ data: { user: token === 'valid-test-token' ? { id: owner } : null }, error: null }) },
    from: table => new Query(table),
  };
  let handler;
  const runtime = {
    Request, Response, Date, console,
    Deno: {
      env: { get: key => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only', SLACK_BOT_TOKEN: 'test-only' })[key] },
      serve: callback => { handler = callback; },
    },
    fetch: async (url, options) => {
      assert.equal(url, 'https://slack.com/api/chat.postMessage');
      messages.push(JSON.parse(options.body));
      return Response.json({ ok: true, ts: `message-${messages.length}` });
    },
  };
  function load(relativePath, imports = {}) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const context = { ...runtime, exports: {}, require: name => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    } };
    runInNewContext(compiled, context, { timeout: 1000 });
    return context.exports;
  }
  const recovery = load('./recovery.ts');
  load('../camera-presence-warning/index.ts', {
    'jsr:@supabase/functions-js/edge-runtime.d.ts': {},
    'jsr:@supabase/supabase-js@2.57.4': { createClient: () => admin },
    '../_shared/recovery.ts': recovery,
  });
  return {
    tables, messages,
    async warn(eventType = 'absence_warning', token = 'valid-test-token') {
      const response = await handler(new Request('https://test.invalid/camera-presence-warning', {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, eventType, absenceSeconds: eventType === 'absence_warning' ? 300 : 0 }),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

const warning = (userId = owner, localDate = day, eventType = 'absence_warning') => ({
  user_id: userId, event_type: eventType, metadata: { localDate },
});

test('first and second same-day absence warnings do not create recovery', async () => {
  const app = setup();
  for (const count of [1, 2]) {
    const { status, body } = await app.warn();
    assert.equal(status, 200);
    assert.equal(body.absenceWarningCount, count);
    assert.equal(body.recoveryResult, null, `warning ${count} must not block study`);
    assert.equal(app.tables.study_recovery_requests.length, 0);
  }
});

test('third warning creates one recovery and later warnings reuse it', async () => {
  const app = setup({ events: [warning(), warning()] });
  const third = await app.warn();
  assert.equal(third.body.absenceWarningCount, 3);
  assert.equal(app.tables.study_recovery_requests.length, 1);
  assert.equal(app.tables.study_recovery_requests[0].trigger_type, 'camera_absence_repeat');
  const fourth = await app.warn();
  assert.equal(fourth.body.absenceWarningCount, 4);
  assert.equal(fourth.body.recoveryResult.recoveryRequestId, third.body.recoveryResult.recoveryRequestId);
  assert.equal(app.tables.study_recovery_requests.length, 1);
});

test('absence count excludes other users, dates, and camera setup warnings', async () => {
  const app = setup({ events: [warning(), warning('user-2'), warning(owner, '2026-09-30'), warning(owner, day, 'camera_required_warning')] });
  const { body } = await app.warn();
  assert.equal(body.absenceWarningCount, 2);
  assert.equal(body.recoveryResult, null);
  assert.equal(app.tables.study_recovery_requests.length, 0);
});

test('camera-required warning never creates recovery, even after three absence warnings', async () => {
  const app = setup({ events: [warning(), warning(), warning()] });
  const { body } = await app.warn('camera_required_warning');
  assert.equal(body.absenceWarningCount, 0);
  assert.equal(body.recoveryResult, null);
  assert.equal(app.tables.study_recovery_requests.length, 0);
});

test('third-warning Slack recovery explains three or more and is not sent twice', async () => {
  const app = setup({ events: [warning(), warning()], slack: true });
  await app.warn();
  await app.warn();
  const recoveryMessages = app.messages.filter(message => message.blocks);
  assert.equal(recoveryMessages.length, 1);
  assert.match(recoveryMessages[0].blocks[0].text.text, /3회 이상/);
  assert.doesNotMatch(recoveryMessages[0].blocks[0].text.text, /2회/);
});

test('unauthenticated requests do not record warnings or create recovery', async () => {
  const app = setup();
  const { status } = await app.warn('absence_warning', 'invalid-test-token');
  assert.equal(status, 401);
  assert.equal(app.tables.study_presence_events.length, 0);
  assert.equal(app.tables.study_recovery_requests.length, 0);
});
