import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobileRequire = createRequire(path.join(root, 'apps/mobile/package.json'));
function compile(relative, imports, globals = {}) {
  const file = path.join(root, relative);
  const { transformSync } = mobileRequire('@babel/core');
  const code = transformSync(readFileSync(file, 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    presets: [[mobileRequire.resolve('@babel/preset-typescript'), { allExtensions: true, isTSX: true }]],
    plugins: [[mobileRequire.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }], mobileRequire.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = { exports: {}, URL, Date, setTimeout: (callback) => { callback(); return 1; }, clearTimeout() {}, ...globals,
    require(name) {
      if (name in imports) return imports[name];
      if (name === './src/FocusStatusPanel') return compile('apps/mobile/src/FocusStatusPanel.tsx', imports);
      if (name === './focusStatus' || name === './src/focusStatus') return compile('apps/mobile/src/focusStatus.ts', imports);
      throw new Error(`Unexpected import: ${name}`);
    } };
  runInNewContext(code, context, { timeout: 1000 });
  return context.exports;
}
const now = Date.now();
const snapshot = {
  revision: 4, desired_focus: true, lease_expires_at: new Date(now + 3600000).toISOString(),
  device_connected: true, installation_id: 'installation', opted_in: true, permission_granted: true,
  applied_revision: 4, applied_focus: true, last_ack_at: new Date(now - 1000).toISOString(), last_error: null,
};
const local = { supported: true, hasAccess: true, active: true };

function focusHarness({ mismatch = false, revoked = false, changedRevision = false, ackError = false } = {}) {
  const storage = new Map([['study-focus-owner', 'owner'], ['study-focus-installation', 'installation']]);
  const calls = [];
  let afterApply = false;
  let acknowledged = false;
  let registrationCalls = 0;
  let active = true;
  let appliedRevision = snapshot.applied_revision;
  const status = () => ({ ...local, hasAccess: !(revoked && afterApply), active: active && !(revoked && afterApply) });
  const api = compile('apps/mobile/src/focus.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      async getItem(key) { return storage.get(key) ?? null; },
      async setItem(key, value) { storage.set(key, value); }, async removeItem(key) { storage.delete(key); },
    } },
    'expo-crypto': { randomUUID: () => 'installation' },
    '../modules/my-module/src/StudyFocusModeModule': { __esModule: true, default: {
      getStatus: status, setOwnRule(enabled) { afterApply = true; active = enabled; }, openPolicySettings() {},
    } },
    './notifications': { async registerExpoPushTarget() { registrationCalls++; return 'push-token'; } },
    './supabase': { supabase: { async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'ack_study_focus_device') {
        acknowledged = true; appliedRevision = args.p_revision;
        return { data: !ackError, error: ackError ? { message: 'ACK failed' } : null };
      }
      assert.equal(name, 'get_study_focus_snapshot');
      return { data: { ...snapshot, revision: changedRevision && acknowledged ? 5 : 4,
        desired_focus: !(changedRevision && acknowledged), applied_revision: appliedRevision,
        installation_id: mismatch ? 'other-device' : 'installation',
        last_ack_at: acknowledged ? new Date(now).toISOString() : new Date(now - 3600000).toISOString(),
        permission_granted: acknowledged ? status().hasAccess : true,
        applied_focus: acknowledged ? status().active : true,
        last_error: acknowledged && revoked ? '권한 해제' : null }, error: null };
    } } },
  });
  return { api, calls, registrationCalls: () => registrationCalls };
}

test('focus recheck returns the server-confirmed ACK time without registering a push token', async () => {
  const harness = focusHarness();
  const result = await harness.api.reconcileStudyFocus('owner');
  assert.equal(result.last_ack_at, new Date(now).toISOString());
  assert.equal(harness.registrationCalls(), 0);
});
test('permission revoked during application is acknowledged as revoked, not the old grant', async () => {
  const harness = focusHarness({ revoked: true });
  await harness.api.reconcileStudyFocus('owner');
  const ack = harness.calls.find((call) => call.name === 'ack_study_focus_device');
  assert.equal(ack.args.p_permission_granted, false);
});
test('another installation is not displayed as this phone being connected', async () => {
  const harness = focusHarness({ mismatch: true });
  assert.equal(await harness.api.reconcileStudyFocus('owner'), null);
});

test('a changed revision after ACK is reapplied before returning confirmed state', async () => {
  const harness = focusHarness({ changedRevision: true });
  const result = await harness.api.reconcileStudyFocus('owner');
  assert.equal(result.revision, 5);
  assert.equal(result.applied_revision, 5);
  assert.equal(result.desired_focus, false);
  assert.equal(result.applied_focus, false);
  assert.deepEqual(harness.calls.filter((call) => call.name === 'ack_study_focus_device').map((call) => call.args.p_revision), [4, 5]);
});

test('a failed ACK never returns a fabricated confirmed snapshot', async () => {
  const harness = focusHarness({ ackError: true });
  await assert.rejects(harness.api.reconcileStudyFocus('owner'), (error) => error.message === 'ACK failed');
});

const textOf = (node) => typeof node === 'string' || typeof node === 'number' ? String(node)
  : node && typeof node === 'object' ? [node.props?.children].flat(Infinity).map(textOf).join('') : '';
function all(tree, predicate, matches = []) {
  if (!tree || typeof tree !== 'object') return matches;
  if (predicate(tree)) matches.push(tree);
  for (const child of [tree.props?.children].flat(Infinity)) all(child, predicate, matches);
  return matches;
}
function appHarness({ error = '', ack = snapshot.last_ack_at, focus = {}, supabase = {} } = {}) {
  const states = [];
  const refs = [];
  let index = 0, refIndex = 0;
  const react = {
    useState(initial) { const key = index++; if (!(key in states)) states[key] = typeof initial === 'function' ? initial() : initial;
      return [states[key], (next) => { states[key] = typeof next === 'function' ? next(states[key]) : next; }]; },
    useRef(initial) { const key = refIndex++; return refs[key] ??= { current: initial }; },
    useEffect() {}, useMemo(fn) { return fn(); },
  };
  const element = (type, props) => typeof type === 'function' ? type(props) : ({ type, props });
  const native = Object.fromEntries(['ActivityIndicator', 'Modal', 'Pressable', 'SafeAreaView', 'ScrollView', 'StatusBar', 'Text', 'TextInput', 'View'].map((name) => [name, name]));
  Object.assign(native, { StyleSheet: { create: (styles) => styles }, Alert: { alert() {} }, AppState: {}, Linking: {} });
  const { default: App } = compile('apps/mobile/App.tsx', {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element }, 'react-native': native,
    'expo-web-browser': { maybeCompleteAuthSession() {} }, './src/mobileOAuth': {},
    './src/supabase': { supabase }, './src/notifications': {},
    './src/WebFeatureScreen': { WebFeatureScreen: 'WebFeatureScreen' },
    './src/focus': { getLocalFocusStatus: () => local, ...focus },
  });
  const render = () => { index = 0; refIndex = 0; return App(); };
  render();
  states[0] = { user: { id: 'owner' } }; states[22] = false;
  states[24] = { ...snapshot, last_ack_at: ack }; states[25] = error;
  return { render, states, refs };
}
test('connected phone shows its status and settings instead of a repeated connection button', () => {
  const tree = appHarness().render();
  const buttons = all(tree, (node) => node.type === 'Pressable').map(textOf);
  assert.ok(buttons.includes('집중 설정'));
  assert.ok(!buttons.some((name) => /다시 연결/.test(name)));
});
test('a failed refresh never leaves the old focus-on label as the current status', () => {
  const tree = appHarness({ error: '네트워크 응답 없음' }).render();
  assert.ok(!all(tree, (node) => node.type === 'Text').some((node) => /방해금지 켜짐/.test(textOf(node))));
});
test('an old ACK is marked unconfirmed instead of claiming focus is on now', () => {
  const tree = appHarness({ ack: new Date(now - 3600000).toISOString() }).render();
  assert.ok(!all(tree, (node) => node.type === 'Text').some((node) => /방해금지 켜짐/.test(textOf(node))));
});

const { getFocusDisplay } = compile('apps/mobile/src/focusStatus.ts', {});
const display = (changes = {}) => getFocusDisplay({ snapshot, local, error: '', action: null, paused: false, nowMs: now, ...changes });

test('study start and resume are on, while pause and end confirm only the app rule is off', () => {
  assert.equal(display().kind, 'active');
  const off = { ...snapshot, desired_focus: false, applied_focus: false, lease_expires_at: null };
  assert.match(display({ snapshot: off, local: { ...local, active: false }, paused: true }).label, /휴식 중.*꺼짐/);
  assert.match(display({ snapshot: off, local: { ...local, active: false } }).description, /수동으로 켠 다른 모드는 유지/);
  assert.equal(display().label, '방해금지 켜짐');
});

for (const [name, changes, label] of [
  ['local rule is off despite an on ACK', { local: { ...local, active: false } }, '상태 불일치'],
  ['permission revoked after the ACK', { local: { ...local, hasAccess: false } }, '권한 확인 필요'],
  ['a newer server revision is pending', { snapshot: { ...snapshot, revision: 5 } }, '적용 확인 중'],
  ['the lease expired after the ACK', { snapshot: { ...snapshot, lease_expires_at: new Date(now - 1).toISOString() } }, '상태 불일치'],
  ['the ACK is missing', { snapshot: { ...snapshot, last_ack_at: null } }, '최근 적용 확인 필요'],
  ['the ACK is in the future', { snapshot: { ...snapshot, last_ack_at: new Date(now + 60000).toISOString() } }, '최근 적용 확인 필요'],
  ['a device error overrides a successful ACK', { snapshot: { ...snapshot, last_error: 'Android 적용 실패' } }, '적용 확인 필요'],
]) test(name, () => assert.ok(display(changes).label.includes(label)));

test('detail recheck does not reconnect, and working actions have explicit loading and disabled states', () => {
  let checked = 0;
  let connected = 0;
  const harness = appHarness({ focus: {
    async reconcileStudyFocus() { checked++; return snapshot; },
    async connectStudyFocus() { connected++; return snapshot; },
  } });
  const tree = harness.render();
  all(tree, (node) => node.type === 'Pressable' && textOf(node) === '상태 다시 확인')[0].props.onPress();
  assert.equal(checked, 1);
  assert.equal(connected, 0);
  const busyTree = harness.render();
  assert.ok(all(busyTree, (node) => node.type === 'ActivityIndicator').length);
  const check = all(busyTree, (node) => node.type === 'Pressable' && textOf(node) === '확인 중…')[0];
  assert.equal(check.props.disabled, true);
  assert.equal(check.props.accessibilityState.busy, true);
});

test('multiple simultaneous checks coalesce into at most one follow-up and clear a disconnected snapshot', async () => {
  let checks = 0;
  let finish;
  const harness = appHarness({ focus: { reconcileStudyFocus() {
    checks++;
    return checks === 1 ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(null);
  } } });
  const check = all(harness.render(), (node) => node.type === 'Pressable' && textOf(node) === '상태 다시 확인')[0];
  check.props.onPress(); check.props.onPress(); check.props.onPress();
  assert.equal(checks, 1);
  finish(snapshot);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(checks, 2);
  assert.equal(harness.states[24], null);
  assert.equal(harness.states[34], null);
});

test('a check that finishes after account change cannot paint the previous account status', async () => {
  let finish;
  const harness = appHarness({ focus: { reconcileStudyFocus() { return new Promise((resolve) => { finish = resolve; }); } } });
  all(harness.render(), (node) => node.type === 'Pressable' && textOf(node) === '상태 다시 확인')[0].props.onPress();
  harness.states[0] = { user: { id: 'next-owner' } };
  harness.states[24] = null;
  harness.render();
  finish(snapshot);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.states[24], null);
});

test('a native status read failure does not crash initial login rendering', () => {
  const harness = appHarness({ focus: { getLocalFocusStatus() { throw new Error('Native status unavailable'); } } });
  assert.ok(harness.render());
});

test('Android settings launch failure is shown as a recoverable focus error', () => {
  const harness = appHarness({ focus: { openFocusPolicySettings() { throw new Error('Settings unavailable'); } } });
  const button = all(harness.render(), (node) => node.type === 'Pressable' && textOf(node) === 'Android 방해금지 설정')[0];
  assert.doesNotThrow(() => button.props.onPress());
  assert.match(harness.states[25], /Settings unavailable/);
});

test('logout serializes disconnect and sign-out before a simultaneous status check', async () => {
  const calls = [];
  let finish;
  const harness = appHarness({ focus: {
    disconnectStudyFocus() { calls.push('disconnect'); return new Promise((resolve) => { finish = resolve; }); },
    async reconcileStudyFocus() { calls.push('check'); return null; },
  }, supabase: { auth: { async signOut() { calls.push('sign-out'); return { error: null }; } } } });
  const tree = harness.render();
  all(tree, (node) => node.type === 'Pressable' && textOf(node) === '로그아웃')[0].props.onPress();
  all(tree, (node) => node.type === 'Pressable' && textOf(node) === '상태 다시 확인')[0].props.onPress();
  assert.deepEqual(calls, ['disconnect']);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls[1], 'sign-out');
});

test('an explicit logout while a check is pending is queued, not dropped', async () => {
  const calls = [];
  let finish;
  const harness = appHarness({ focus: {
    reconcileStudyFocus() { calls.push('check'); return new Promise((resolve) => { finish = resolve; }); },
    async disconnectStudyFocus() { calls.push('disconnect'); },
  }, supabase: { auth: { async signOut() { calls.push('sign-out'); return { error: null }; } } } });
  const tree = harness.render();
  all(tree, (node) => node.type === 'Pressable' && textOf(node) === '상태 다시 확인')[0].props.onPress();
  all(tree, (node) => node.type === 'Pressable' && textOf(node) === '로그아웃')[0].props.onPress();
  assert.deepEqual(calls, ['check']);
  finish(snapshot);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['check', 'disconnect', 'sign-out']);
});

test('the native fallback also exposes logout inside focus details', () => {
  const harness = appHarness();
  harness.states[33] = true;
  const tree = harness.render();
  assert.ok(all(tree, (node) => node.type === 'Modal' && /휴대폰 집중 설정.*로그아웃/.test(textOf(node))).length);
});

test('a queued logout is discarded if its account is no longer current', async () => {
  let finish;
  let signouts = 0;
  let disconnects = 0;
  const harness = appHarness({ focus: {
    reconcileStudyFocus() { return new Promise((resolve) => { finish = resolve; }); },
    async disconnectStudyFocus() { disconnects++; },
  }, supabase: { auth: { async signOut() { signouts++; return { error: null }; } } } });
  const tree = harness.render();
  all(tree, (node) => node.type === 'Pressable' && textOf(node) === '상태 다시 확인')[0].props.onPress();
  all(tree, (node) => node.type === 'Pressable' && textOf(node) === '로그아웃')[0].props.onPress();
  harness.states[0] = { user: { id: 'next-owner' } };
  harness.states[24] = null;
  harness.render();
  finish(snapshot);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(signouts, 0);
  assert.equal(disconnects, 0);
});
