import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
const root = fileURLToPath(new URL('../', import.meta.url));
const req = createRequire(path.join(root, 'apps/mobile/package.json'));
function compile(file) {
  const code = req('@babel/core').transformSync(readFileSync(path.join(root, file), 'utf8'), {
    filename: file, babelrc: false, configFile: false, presets: [req.resolve('@babel/preset-typescript')],
    plugins: [req.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = { exports: {}, URL, setTimeout, clearTimeout, require() { throw Error('Unexpected runtime import'); } };
  runInNewContext(code, context); return context.exports;
}
const origin = 'https://study-room-attendance.vercel.app';
function probeHarness() {
  let current = { active: true, owner: 'owner', ownerRevision: 1, authenticatedOwner: 'owner', authenticatedOwnerRevision: 1,
    document: 1, nativeDocument: 1, navigation: 1, url: `${origin}/#settings`, cameraPermissionBusy: false };
  const injected = [];
  const { createDeviceStudyProbe } = compile('apps/mobile/src/deviceStudyProbe.ts');
  const p = createDeviceStudyProbe({ current: () => current, inject: value => injected.push(value), timeoutMs: 20 });
  return { p, injected, change: patch => { current = { ...current, ...patch }; }, reply: (state = 'allowed', patch = {}) => {
    let request;
    const window = { location: { href: current.url }, dispatchEvent: event => { request = event.detail; } }; window.top = window;
    // Execute the actual injected script, not a duplicate parser of its source text.
    runInNewContext(injected.at(-1), { window, CustomEvent: class { constructor(_name, options) { this.detail = options.detail; } } });
    if (!request) { p.invalidate(); return; }
    p.receive({ type: 'STUDY_WEB_DEVICE_STUDY_STATE', requestId: request.requestId, state },
      { url: current.url, isTopFrame: true, sourceOrigin: origin, studySettingsDocumentId: current.nativeDocument, ...patch });
  } };
}
test('fresh authenticated device probe permits PC-only session and blocks phone activity', async () => {
  for (const state of ['allowed', 'studying', 'unknown']) {
    const h = probeHarness(); const pending = h.p.read({ id: 'pc-session', paused: false });
    assert.equal(h.injected.length, 1); h.reply(state); assert.equal(await pending, state);
  }
});
test('device proof rejects subframes, wrong origins, legacy epochs, reload and account ABA', async () => {
  for (const patch of [{ isTopFrame: false }, { isTopFrame: undefined }, { sourceOrigin: 'https://evil.test' }, { studySettingsDocumentId: undefined }]) {
    const h = probeHarness(); const pending = h.p.read(null); h.reply('allowed', patch); assert.equal(await pending, 'unknown');
  }
  for (const change of [{ document: 2 }, { nativeDocument: 2 }, { ownerRevision: 3 }, { authenticatedOwner: null }, { navigation: 3 }, { active: false }]) {
    const h = probeHarness(); const pending = h.p.read(null); h.change(change); h.reply(); assert.equal(await pending, 'unknown');
  }
  const legacy = probeHarness(); legacy.change({ nativeDocument: null }); assert.equal(await legacy.p.read(null), 'unknown'); assert.equal(legacy.injected.length, 0);
  const camera = probeHarness(); camera.change({ cameraPermissionBusy: true }); assert.equal(await camera.p.read(null), 'studying');
});
test('timed-out, malformed, mismatched, overlapping and disposed probes fail closed', async () => {
  const h = probeHarness(), wait = h.p.read(null);
  h.p.receive({ type: 'STUDY_WEB_DEVICE_STUDY_STATE', requestId: 'wrong', state: 'allowed' }, {});
  assert.equal(await h.p.read(null), 'unknown'); assert.equal(await wait, 'unknown');
  const disposed = probeHarness(), pending = disposed.p.read(null); disposed.p.invalidate(); assert.equal(await pending, 'unknown');
});
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
const state = (overrides = {}) => ({ userId: 'owner', ready: true, session: { id: 's', paused: false }, cameraActive: false, operationPending: false, ...overrides });
test('web execution tracker distinguishes PC-only from locally started or camera-adopted study across reload', async () => {
  const { createDeviceStudyTracker } = await import('../apps/web/src/deviceStudyActivity.mjs');
  const store = storage(), tracker = createDeviceStudyTracker(store);
  assert.equal(tracker.check(state(), { id: 's', paused: false }), 'allowed');
  tracker.mark('owner', 's');
  assert.equal(tracker.check(state(), { id: 's', paused: false }), 'studying');
  assert.equal(createDeviceStudyTracker(store).check(state(), { id: 's', paused: false }), 'studying');
  assert.equal(tracker.check(state({ cameraActive: true }), { id: 's', paused: false }), 'studying');
  assert.equal(tracker.check(state({ session: null, operationPending: true }), null), 'studying');
});
test('pause closes local participation without changing server session and unknown state never grants install', async () => {
  const { createDeviceStudyTracker } = await import('../apps/web/src/deviceStudyActivity.mjs');
  const tracker = createDeviceStudyTracker(storage()); tracker.mark('owner', 's');
  tracker.observe('owner', { id: 's', paused: true });
  assert.equal(tracker.check(state({ session: { id: 's', paused: true } }), { id: 's', paused: true }), 'allowed');
  assert.equal(tracker.check(state(), { id: 's', paused: false }), 'allowed'); // PC resumes after the observed pause.
  assert.equal(tracker.check(state({ ready: false }), { id: 's', paused: false }), 'unknown');
  assert.equal(tracker.check(state(), { id: 'other', paused: false }), 'unknown');
  const broken = createDeviceStudyTracker({ getItem() { throw Error('storage denied'); } });
  assert.equal(broken.check(state(), { id: 's', paused: false }), 'unknown');
  const quota = { getItem: () => null, setItem() { throw Error('QuotaExceededError'); }, removeItem() {} };
  const failedWrite = createDeviceStudyTracker(quota); failedWrite.mark('owner', 's');
  assert.equal(failedWrite.check(state(), { id: 's', paused: false }), 'studying');
  assert.equal(createDeviceStudyTracker(quota).check(state(), { id: 's', paused: false }), 'unknown');
});
test('existing phone camera intent protects legacy active study even when camera restoration fails', async () => {
  const { createDeviceStudyTracker } = await import('../apps/web/src/deviceStudyActivity.mjs');
  const store = storage(); store.setItem('study-room-camera-monitoring-intent:owner', JSON.stringify({ userId: 'owner', sessionId: 's', savedAtMs: 1 }));
  const tracker = createDeviceStudyTracker(store);
  assert.equal(tracker.check(state(), { id: 's', paused: false }), 'studying');
  assert.equal(tracker.prepare('owner', false), true);
  tracker.observe('owner', { id: 's', paused: false }); // Failed restore must not erase legacy participation.
  assert.equal(tracker.check(state(), { id: 's', paused: false }), 'studying');
  tracker.observe('owner', { id: 's', paused: true });
  assert.equal(tracker.check(state({ session: { id: 's', paused: true } }), { id: 's', paused: true }), 'allowed');
  // Observed pause releases participation; the separate camera preference is preserved for existing UX.
  assert.ok(store.getItem('study-room-camera-monitoring-intent:owner'));
  assert.equal(createDeviceStudyTracker(store).check(state(), { id: 's', paused: false }), 'allowed');
});

test('durable pending participation survives a larger marker write failure and storage recovery', async () => {
  const { createDeviceStudyTracker } = await import('../apps/web/src/deviceStudyActivity.mjs');
  const store = storage(), write = store.setItem;
  let quota = true;
  store.setItem = (key, value) => {
    if (quota && value.length > 7) throw Error('QuotaExceededError');
    write(key, value);
  };
  const id = 'a2345678-1234-1234-1234-123456789abc';
  const tracker = createDeviceStudyTracker(store);
  tracker.mark('owner', id);
  assert.equal(tracker.check(state({ session: { id, paused: false } }), { id, paused: false }), 'studying');
  quota = false;
  assert.equal(createDeviceStudyTracker(store).check(state({ session: { id, paused: false } }), { id, paused: false }), 'unknown');
});

test('participation must be durably prepared before local execution can begin', async () => {
  const { createDeviceStudyTracker } = await import('../apps/web/src/deviceStudyActivity.mjs');
  const store = storage(), write = store.setItem;
  store.setItem = () => { throw Error('QuotaExceededError'); };
  const tracker = createDeviceStudyTracker(store);
  assert.equal(tracker.prepare('owner'), false);
  store.setItem = write;
  assert.equal(tracker.prepare('owner'), true);
  assert.equal(createDeviceStudyTracker(store).check(state(), { id: 's', paused: false }), 'unknown');
  const reloaded = createDeviceStudyTracker(store);
  reloaded.observe('owner', { id: 's', paused: true });
  assert.equal(reloaded.check(state({ session: { id: 's', paused: true } }), { id: 's', paused: true }), 'unknown');
  reloaded.mark('owner', 's');
  reloaded.observe('owner', { id: 's', paused: true });
  assert.equal(reloaded.check(state({ session: { id: 's', paused: true } }), { id: 's', paused: true }), 'allowed');
});

test('uncertain commit latch is not released by a pre-commit idle or paused snapshot after reload', async () => {
  const { createDeviceStudyTracker } = await import('../apps/web/src/deviceStudyActivity.mjs');
  for (const oldSession of [null, { id: 's', paused: true }]) {
    const store = storage(), tracker = createDeviceStudyTracker(store);
    assert.equal(tracker.prepare('owner'), true);
    const reloaded = createDeviceStudyTracker(store);
    reloaded.observe('owner', oldSession);
    assert.equal(reloaded.check(state({ session: { id: 's', paused: false } }), { id: 's', paused: false }), 'unknown');
  }
});

test('cancelled camera-only preparation can release, but never downgrades existing execution or uncertain commit', async () => {
  const { createDeviceStudyTracker } = await import('../apps/web/src/deviceStudyActivity.mjs');
  const store = storage(), tracker = createDeviceStudyTracker(store);
  assert.equal(tracker.prepare('owner', false), true);
  tracker.observe('owner', { id: 's', paused: false }); // Caller has proved camera and operations are idle.
  assert.equal(tracker.check(state(), { id: 's', paused: false }), 'allowed');
  tracker.mark('owner', 's');
  assert.equal(tracker.prepare('owner', false), true);
  tracker.observe('owner', { id: 's', paused: false });
  assert.equal(tracker.check(state(), { id: 's', paused: false }), 'studying');
  assert.equal(tracker.prepare('owner'), true);
  assert.equal(tracker.prepare('owner', false), true);
  tracker.observe('owner', null);
  assert.equal(createDeviceStudyTracker(store).check(state(), { id: 's', paused: false }), 'unknown');
});

test('lost participation upgrade during camera acquisition remains unknown after reload and repeated preparation', async () => {
  const { createDeviceStudyTracker } = await import('../apps/web/src/deviceStudyActivity.mjs');
  const store = storage(), write = store.setItem, tracker = createDeviceStudyTracker(store);
  assert.equal(tracker.prepare('owner', false), true);
  store.setItem = () => { throw Error('QuotaExceededError'); };
  tracker.mark('owner', 's');
  assert.equal(tracker.check(state(), { id: 's', paused: false }), 'studying');
  store.setItem = write;
  const reloaded = createDeviceStudyTracker(store);
  reloaded.observe('owner', { id: 's', paused: false });
  assert.equal(reloaded.check(state(), { id: 's', paused: false }), 'unknown');
  assert.equal(reloaded.prepare('owner', false), true);
  reloaded.observe('owner', { id: 's', paused: false });
  assert.equal(reloaded.check(state(), { id: 's', paused: false }), 'unknown');
});
test('web install probe replies only in native top document for matching account with exact read-only schema', async () => {
  const { bindDeviceStudyCheck } = await import('../apps/web/src/deviceStudyActivity.mjs');
  const listeners = new Set(), sent = [];
  const host = { top: null, location: { origin }, ReactNativeWebView: { postMessage: raw => sent.push(JSON.parse(raw)) },
    addEventListener: (_event, fn) => listeners.add(fn), removeEventListener: (_event, fn) => listeners.delete(fn) }; host.top = host;
  const tracker = (await import('../apps/web/src/deviceStudyActivity.mjs')).createDeviceStudyTracker(storage());
  const dispose = bindDeviceStudyCheck(host, () => state(), tracker);
  const message = { type: 'STUDY_NATIVE_DEVICE_STUDY_CHECK', requestId: 'request', userId: 'owner', session: { id: 's', paused: false } };
  const emit = detail => [...listeners].forEach(fn => fn({ detail }));
  emit({ ...message, userId: 'other' }); emit({ ...message, install: true }); assert.equal(sent.length, 0);
  host.top = {}; emit(message); assert.equal(sent.length, 0); host.top = host;
  emit(message); assert.deepEqual(sent, [{ type: 'STUDY_WEB_DEVICE_STUDY_STATE', requestId: 'request', state: 'allowed' }]);
  dispose(); assert.equal(listeners.size, 0);
});
