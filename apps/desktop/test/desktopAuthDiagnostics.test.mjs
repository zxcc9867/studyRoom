import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../src/desktopAuthDiagnostics.mjs').catch(() => ({}));
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(write) {
  assert.equal(typeof module.createAuthDiagnostics, 'function', 'fixed-stage native diagnostics must exist');
  const writes = [];
  return { writes, record: module.createAuthDiagnostics({ now: () => 1000,
    write: write ?? (value => writes.push(JSON.parse(value))) }) };
}

test('auth diagnostics persist only fixed stages and timestamps, never arguments or unknown data', async () => {
  const f = fixture();
  f.record('callback.received', { code: 'private-code', email: 'private@example.test' });
  f.record('studyroom-desktop://auth/callback?code=private-code');
  f.record('callback.failed.private-provider-message');
  await tick();
  assert.deepEqual(f.writes, [{ version: 1, events: [{ at: 1000, stage: 'callback.received' }] }]);
});

test('auth diagnostics retain at most 32 fixed events', async () => {
  const f = fixture();
  for (let index = 0; index < 40; index++) f.record('provider.opened');
  await tick();
  assert.equal(f.writes.at(-1).events.length, 32);
});

test('diagnostic filesystem failure cannot block authentication', () => {
  const f = fixture(() => { throw Error('private filesystem error'); });
  assert.doesNotThrow(() => f.record('callback.received'));
});

test('diagnostic writes are deferred until after the caller returns', async () => {
  const order = [];
  const f = fixture(() => order.push('write'));
  f.record('callback.received');
  order.push('returned');
  await tick();
  assert.deepEqual(order, ['returned', 'write']);
});

test('never-settling diagnostic write cannot overlap writes or queue unbounded snapshots', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const writes = [];
  const f = fixture(value => { writes.push(JSON.parse(value)); return writes.length === 1 ? gate : Promise.resolve(); });
  try {
    f.record('app.ready');
    await tick();
    for (let index = 0; index < 40; index++) f.record('provider.opened');
    await tick();
    assert.equal(writes.length, 1);
    release();
    await tick();
    assert.equal(writes.length, 2);
    assert.equal(writes[1].events.length, 32);
  } finally { release(); }
});

test('rejected diagnostic write is contained and later stages can still persist', async () => {
  let calls = 0;
  const f = fixture(async () => { if (++calls === 1) throw Error('private asynchronous filesystem error'); });
  f.record('app.ready');
  await tick();
  f.record('callback.received');
  await tick();
  assert.equal(calls, 2);
});
