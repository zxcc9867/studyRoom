import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../src/desktopLifecycle.mjs').catch(() => ({}));
function lifecycle(options = {}) {
  assert.equal(typeof module.createDesktopLifecycle, 'function', 'desktop lifecycle feature must exist');
  return module.createDesktopLifecycle(options);
}
const state = (changes = {}) => ({ userId: 'u', ready: true, session: null,
  cameraActive: false, operationPending: false, activity: 'allowed', ...changes });

test('an observer can quit without requesting remote study termination', () => {
  const life = lifecycle({ now: () => 1000 });
  life.update(state({ session: { id: 'remote', paused: false } }));
  assert.deepEqual(life.requestQuit(), { action: 'quit' });
});

test('local engagement survives pause and clears only after verified idle', () => {
  const life = lifecycle({ now: () => 1000 });
  life.update(state({ session: { id: 'local', paused: false }, activity: 'studying' }));
  life.update(state({ session: { id: 'local', paused: true } }));
  const decision = life.requestQuit();
  assert.equal(decision.action, 'request-web');
  assert.equal(life.view().localEngagement, true);
  assert.equal(life.cancelQuit('wrong'), false);
  assert.equal(life.cancelQuit(decision.requestId), true);
  life.update(state());
  assert.deepEqual(life.requestQuit(), { action: 'quit' });
});

test('camera preparation and unresolved writes require existing web cleanup', () => {
  for (const changes of [{ cameraActive: true }, { operationPending: true }]) {
    const life = lifecycle({ now: () => 1000 });
    life.update(state(changes));
    const decision = life.requestQuit();
    assert.equal(decision.action, 'request-web');
    assert.deepEqual(life.requestQuit(), decision);
  }
});

test('unknown, invalidated and stale proofs never authorize normal quit', () => {
  let clock = 1000;
  const life = lifecycle({ now: () => clock });
  assert.equal(life.requestQuit().action, 'blocked');
  life.update(state({ activity: 'unknown' }));
  assert.equal(life.requestQuit().action, 'blocked');
  life.update(state());
  clock = 12001;
  assert.equal(life.requestQuit().action, 'blocked');
  life.update(state());
  life.invalidate();
  assert.equal(life.requestQuit().action, 'blocked');
});

test('signed-out known idle is not trapped but pending writes remain protected', () => {
  const life = lifecycle({ now: () => 1000 });
  life.update(state({ userId: null }));
  assert.equal(life.requestQuit().action, 'quit');
  life.update(state({ userId: null, operationPending: true }));
  assert.equal(life.requestQuit().action, 'request-web');
});

test('safe persisted engagement survives restart and cannot attach to another user', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const first = lifecycle({ now: () => 1000, storage });
  first.update(state({ session: { id: 'local', paused: false }, activity: 'studying' }));
  assert.deepEqual(JSON.parse([...values.values()][0]), { userId: 'u', sessionId: 'local' });
  const resumed = lifecycle({ now: () => 1000, storage });
  resumed.update(state({ session: { id: 'local', paused: true } }));
  assert.equal(resumed.requestQuit().action, 'request-web');
  resumed.update(state({ userId: 'other', session: { id: 'local', paused: true } }));
  assert.equal(resumed.requestQuit().action, 'quit');
});

test('pending persistence blocks safe exit until the safe metadata operation settles', async () => {
  let settle;
  const gate = new Promise(resolve => { settle = resolve; });
  const storage = { getItem: () => null, setItem: () => gate, removeItem: () => gate };
  const life = lifecycle({ now: () => 1000, storage });
  life.update(state({ session: { id: 'local', paused: false }, activity: 'studying' }));
  life.update(state());
  assert.notEqual(life.requestQuit().action, 'quit');
  settle();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(life.requestQuit().action, 'quit');
});

test('bootstrap unknown identity cannot erase persisted local paused engagement', () => {
  const values = new Map([['desktop-local-engagement-v1', JSON.stringify({ userId: 'u', sessionId: 'local' })]]);
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const life = lifecycle({ now: () => 1000, storage });
  life.update(state({ userId: null, ready: false, activity: 'unknown' }));
  life.update(state({ session: { id: 'local', paused: true } }));
  assert.equal(life.requestQuit().action, 'request-web');
});

test('inconsistent studying without a session never authorizes safe exit', () => {
  const life = lifecycle({ now: () => 1000 });
  life.update(state({ activity: 'studying' }));
  assert.equal(life.requestQuit().action, 'blocked');
});
