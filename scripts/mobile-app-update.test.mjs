import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import * as studyCore from '../packages/core/src/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const req = createRequire(path.join(root, 'apps/mobile/package.json'));
function compile(file, imports = {}, globals = {}) {
  const filename = path.join(root, file);
  const code = req('@babel/core').transformSync(readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    presets: [[req.resolve('@babel/preset-typescript'), { allExtensions: true, isTSX: true }]],
    plugins: [[req.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }], req.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = { exports: {}, URL, Date, setTimeout, clearTimeout, ...globals,
    require(name) {
      if (name === '../../packages/core/src/index.mjs') return studyCore;
      if (name in imports) return imports[name];
      const local = { './appUpdate': 'appUpdate.ts', './useAppUpdate': 'useAppUpdate.ts' }[name];
      if (local) return compile(`apps/mobile/src/${local}`, imports, globals);
      throw new Error(`Unexpected import ${name}`);
    } };
  runInNewContext(code, context);
  return context.exports;
}
const release = (overrides = {}) => ({ schemaVersion: 1, packageName: 'com.jini9867.studyroomattendance',
  versionName: '0.2.0', versionCode: 3, releasedAt: '2026-10-04T12:00:00Z', releaseNotes: ['앱 업데이트 지원'],
  apkUrl: 'https://github.com/zxcc9867/studyRoom/releases/download/v0.2.0/study-room.apk', sha256: 'a'.repeat(64), sizeBytes: 1000, ...overrides });
const installed = (versionCode = 2) => ({ supported: true, packageName: 'com.jini9867.studyroomattendance', versionName: '9.9.9', versionCode });
const idle = { phase: 'idle', downloadedBytes: 0, totalBytes: 0, versionCode: null, errorCode: null, release: null };
const api = () => compile('apps/mobile/src/appUpdate.ts', { '../modules/my-module/src/StudyAppUpdateModule': { __esModule: true, default: null } });

test('actual installed code alone determines newer builds, never display name or date', () => {
  const a = api();
  assert.equal(a.isNewerRelease(release({ versionCode: 2 }), installed(3)), false);
  assert.equal(a.isNewerRelease(release(), installed(3)), false);
  assert.equal(a.isNewerRelease(release(), installed()), true);
  assert.equal(a.isNewerRelease(release({ versionCode: 4 }), installed(3)), true);
});
for (const [name, value] of Object.entries({ schema: { schemaVersion: 2 }, package: { packageName: 'other' },
  origin: { apkUrl: 'http://github.com/zxcc9867/studyRoom/releases/download/a/b.apk' },
  repo: { apkUrl: 'https://github.com/other/repo/releases/download/a/b.apk' },
  query: { apkUrl: release().apkUrl + '?token=secret' }, fragment: { apkUrl: release().apkUrl + '#x' },
  credentials: { apkUrl: 'https://u@github.com/zxcc9867/studyRoom/releases/download/a/b.apk' },
  path: { apkUrl: 'https://github.com/zxcc9867/studyRoom/releases/download/a/../b.apk' },
  nan: { versionCode: NaN }, fraction: { versionCode: 3.1 }, zero: { versionCode: 0 }, max: { versionCode: 2100000001 },
  size: { sizeBytes: 150 * 1024 * 1024 + 1 }, sizeFraction: { sizeBytes: 1.1 }, hash: { sha256: 'g'.repeat(64) },
  notes: { releaseNotes: ['x'.repeat(201)] }, noteCount: { releaseNotes: Array(9).fill('x') },
  blankNote: { releaseNotes: [''] }, whitespaceNote: { releaseNotes: [' \t\r\n'] },
  longFraction: { releasedAt: '2026-10-04T12:00:00.1234567890Z' }, hour24: { releasedAt: '2026-10-04T24:00:00Z' },
  date: { releasedAt: '2026-02-30T12:00:00Z' }, timezone: { releasedAt: '2026-10-04T12:00:00' },
  name: { versionName: 'x'.repeat(33) },
})) test(`release validation rejects ${name}`, () => assert.throws(() => api().validateAndroidRelease(release(value))));
test('safe Korean errors do not expose arbitrary native or signed URL messages', () => {
  assert.match(api().getUpdateErrorMessage(new Error('https://host/file?secret=token')), /확인|업데이트/);
  assert.ok(!api().getUpdateErrorMessage(new Error('https://host/file?secret=token')).includes('secret'));
});

for (const code of ['install_failed', 'install_unavailable']) test(`${code} explains OS restrictions without bypass or deletion`, () => {
  const message = api().getUpdateErrorMessage({ code, message: 'https://host/?secret=token' });
  assert.match(message, /Android.*보안.*정책|Android.*보안.*제한/);
  assert.match(message, /우회하지/);
  assert.match(message, /삭제하지/);
  assert.ok(!message.includes('인터넷'));
  assert.ok(!message.includes('secret'));
});

// Only Android/OS and React Native host boundaries are doubled; real hook and panel execute.
function harness(options = {}) {
  let current = installed(), state = { ...idle }, listener, foreground;
  let downloads = 0, installs = 0, settings = 0, checks = 0;
  const native = {
    getInstalledVersion: () => current, getState: () => state,
    fetchLatestRelease: () => { checks++; return options.fetch ? options.fetch() : Promise.resolve(release()); },
    downloadRelease: async (r) => { downloads++; if (options.download) return options.download(r); state = { ...idle, phase: 'ready', release: r, versionCode: r.versionCode }; return state; },
    cancelDownload: () => (state = { ...idle, phase: 'cancelled' }), canInstall: () => options.permission !== false,
    openInstallPermissionSettings: () => { settings++; },
    installDownloaded: async () => { installs++; return state = { ...state, phase: 'install_pending' }; },
    addListener: (_event, cb) => { listener = cb; return { remove() { listener = null; } }; },
  };
  const values = [], refs = [], effects = [], pending = [], cleanups = [];
  let vi = 0, ri = 0, ei = 0, mounted = true;
  const react = {
    useState(initial) { const i = vi++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], (v) => { if (mounted) values[i] = typeof v === 'function' ? v(values[i]) : v; }]; },
    useRef(initial) { return refs[ri++] ??= { current: initial }; },
    useEffect(fn, deps) { const i = ei++; if (!effects[i] || deps?.some((v, j) => v !== effects[i][j])) { effects[i] = deps; pending.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); } },
    useCallback: (fn) => fn,
  };
  const timers = new Map(); let timerId = 0;
  const globals = { setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); } };
  const element = (type, props) => ({ type, props });
  const rn = Object.fromEntries(['Modal', 'Pressable', 'ScrollView', 'Text', 'View', 'ActivityIndicator'].map(n => [n, n]));
  const links = [], alerts = [];
  rn.Linking = { async openURL(url) { links.push(url); if (options.linkFailure) throw new Error('signed-secret'); } };
  rn.Alert = { alert(...args) { alerts.push(args); } };
  rn.StyleSheet = { create: x => x };
  rn.AppState = { currentState: 'active', addEventListener(_event, cb) { foreground = cb; return { remove() { foreground = null; } }; } };
  const imports = { react, 'react/jsx-runtime': { jsx: element, jsxs: element }, 'react-native': rn,
    '../modules/my-module/src/StudyAppUpdateModule': { __esModule: true, default: native } };
  const hook = compile('apps/mobile/src/useAppUpdate.ts', imports, globals).useAppUpdate;
  const Panel = compile('apps/mobile/src/AppUpdatePanel.tsx', imports, globals).AppUpdatePanel;
  const palette = { surface: '#fffdf5', canvas: '#f3f4ed', primary: '#2f6b52', primarySoft: '#edf3ea', border: '#d7ddd2', text: '#28372e', muted: '#4e5b50', coral: '#9a3f33' };
  const gate = options.gate ?? (() => Promise.resolve('allowed'));
  let controller;
  function render() { vi = ri = ei = 0; controller = hook(gate); while (pending.length) pending.shift()(); return controller; }
  return { render, panel: () => Panel({ palette, beforeInstall: gate, controller }), native,
    emit(s) { state = { ...state, ...s }; listener?.(state); }, foreground: () => foreground?.('active'),
    current(code) { current = installed(code); }, links, alerts, timeout() { for (const fn of [...timers.values()]) fn(); },
    unmount() { mounted = false; cleanups.forEach(fn => fn?.()); }, remount() { mounted = true; effects.length = 0; render(); }, counts: () => ({ downloads, installs, settings, checks }) };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function all(tree, predicate, found = []) { if (!tree || typeof tree !== 'object') return found; if (predicate(tree)) found.push(tree);
  for (const child of [tree.props?.children].flat(Infinity)) all(child, predicate, found); return found; }
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node && typeof node === 'object' ? [node.props?.children].flat(Infinity).map(textOf).join('') : '';

test('release changes are readable in their own section before download, separate from installation guidance', async () => {
  const notes = ['[추가] 공부 기록을 한눈에 확인할 수 있어요.', '[수정] 일정 표시 오류를 해결했어요.'];
  const h = harness({ fetch: async () => release({ releaseNotes: notes }) });
  h.render(); await flush(); h.render().open(); h.render();
  const tree = h.panel();
  const section = title => all(tree, n => n.type === 'View').find(n =>
    [n.props?.children].flat(Infinity).some(child => child?.type === 'Text' && child.props.accessibilityRole === 'header' && textOf(child) === title));
  const changes = section('이번 업데이트 내용'), guidance = section('설치 안내');
  assert.ok(changes, 'version-specific changes need a named section');
  assert.ok(guidance, 'common installation guidance needs a separate section');
  for (const note of notes) {
    const rendered = all(changes, n => n.type === 'Text').find(n => textOf(n) === `• ${note}`);
    assert.ok(rendered, 'the publisher-provided change is shown as plain text');
    assert.ok([rendered.props.style].flat(Infinity).some(style => style?.color === '#28372e' && style?.lineHeight >= 24));
    assert.ok(!textOf(guidance).includes(note));
  }
  assert.ok(!textOf(changes).includes('기존 앱을 삭제할 필요'));
  assert.ok(textOf(guidance).includes('이 휴대폰'));
  const content = all(tree, n => n.type === 'ScrollView')[0].props.children.flat(Infinity).filter(Boolean);
  assert.ok(content.indexOf(changes) < content.findIndex(n => n.type === 'Pressable' && textOf(n) === '업데이트 다운로드'));
  assert.equal(h.counts().downloads, 0); assert.equal(h.counts().installs, 0); assert.equal(h.counts().settings, 0);
});

test('missing release changes are disclosed without inventing improvements', async () => {
  const h = harness({ fetch: async () => release({ releaseNotes: [] }) });
  h.render(); await flush(); h.render().open(); h.render();
  const tree = h.panel();
  assert.ok(textOf(tree).includes('이번 업데이트 내용'));
  assert.ok(textOf(tree).includes('이 버전의 변경 내용이 아직 제공되지 않았어요.'));
  assert.equal(h.counts().downloads, 0); assert.equal(h.counts().installs, 0);
});

for (const phase of ['failed', 'permission_required']) test(`fixed install guide in ${phase} opens only by user choice`, async () => {
  const h = harness(); h.render(); await flush(); h.render().open();
  h.emit({ phase, errorCode: phase === 'failed' ? 'install_unavailable' : null }); h.render();
  const button = all(h.panel(), n => n.type === 'Pressable').find(n => textOf(n) === '설치 안내 보기');
  assert.ok(button); assert.equal(button.props.disabled, false);
  assert.deepEqual(h.links, []); assert.equal(h.counts().downloads, 0); assert.equal(h.counts().installs, 0);
  await button.props.onPress();
  assert.deepEqual(h.links, ['https://study-room-attendance.vercel.app/download/android']);
  assert.equal(h.counts().downloads, 0); assert.equal(h.counts().installs, 0); assert.equal(h.counts().settings, 0);
});

test('failed install-guide opening is handled with safe usable guidance', async () => {
  const h = harness({ linkFailure: true }); h.render(); await flush(); h.render().open(); h.render();
  const button = all(h.panel(), n => n.type === 'Pressable').find(n => textOf(n) === '설치 안내 보기');
  assert.ok(button); await assert.doesNotReject(() => button.props.onPress());
  assert.equal(h.alerts.length, 1); assert.match(h.alerts[0].join(' '), /브라우저|설치 안내/);
  assert.ok(!h.alerts[0].join(' ').includes('signed-secret'));
  assert.equal(h.render().isOpen, true); assert.equal(h.counts().downloads, 0); assert.equal(h.counts().installs, 0);
});

test('initial check once, manual check and progress/cancel preserve a usable entry', async () => {
  const h = harness(); h.render(); await flush(); let c = h.render();
  assert.equal(c.status, 'available'); h.render(); assert.equal(h.counts().checks, 1);
  c.open(); c = h.render(); assert.equal(c.isOpen, true);
  await c.check(); assert.equal(h.counts().checks, 2);
  const download = c.download(); c.download(); await download; assert.equal(h.counts().downloads, 1);
  h.emit({ phase: 'downloading', downloadedBytes: 500, totalBytes: 1000 }); c = h.render();
  assert.equal(c.progress, 50); c.cancel(); assert.equal(h.render().status, 'cancelled');
});
test('foreground native idle retains available modal status and usable explicit download', async () => {
  const h = harness(); h.render(); await flush(); h.render().open(); h.render();
  h.foreground(); const c = h.render(), tree = h.panel();
  assert.equal(c.status, 'available'); assert.match(textOf(tree), /새 버전이 있어요/);
  const button = all(tree, n => n.type === 'Pressable').find(n => textOf(n) === '업데이트 다운로드');
  assert.ok(button); assert.equal(button.props.disabled, false); assert.equal(h.counts().downloads, 0);
  assert.equal(h.counts().checks, 1); await button.props.onPress(); assert.equal(h.counts().downloads, 1);
});
test('foreground native idle preserves pending manual check and its busy controls', async () => {
  let resolve, count = 0;
  const h = harness({ fetch: () => ++count === 1 ? Promise.resolve(release()) : new Promise(r => resolve = r) });
  h.render(); await flush(); const pending = h.render().check(); h.foreground();
  const c = h.render(); assert.equal(c.status, 'checking'); assert.equal(c.busy, true);
  const button = all(h.panel(), n => n.type === 'Pressable').find(n => textOf(n) === '최신 버전 다시 확인');
  assert.equal(button.props.disabled, true); await c.check(); assert.equal(h.counts().checks, 2);
  resolve(release({ versionCode: 4 })); await pending; assert.equal(h.render().status, 'available'); assert.equal(h.render().release.versionCode, 4);
});
test('foreground native idle does not erase a failed check or fabricate latest', async () => {
  const h = harness({ fetch: () => Promise.reject(new Error('failure')) }); h.render(); await flush();
  const error = h.render().error; h.foreground(); assert.equal(h.render().status, 'failed'); assert.equal(h.render().error, error);
});
test('foreground native ready keeps fresh install guard busy until its explicit request resolves', async () => {
  let resolve, gates = 0;
  const h = harness({ gate: () => { gates++; return new Promise(r => resolve = r); } }); h.render(); await flush(); await h.render().download();
  const pending = h.render().install(); h.foreground(); const c = h.render();
  assert.equal(c.status, 'ready'); assert.equal(c.busy, true);
  const button = all(h.panel(), n => n.type === 'Pressable').find(n => textOf(n) === '업데이트 설치');
  assert.equal(button.props.disabled, true); await c.install(); assert.equal(gates, 1); assert.equal(h.counts().installs, 0);
  resolve('unknown'); await pending; assert.equal(h.render().busy, false); assert.equal(h.counts().installs, 0); assert.match(h.render().error, /상태/);
});
test('failed and timed out checks never claim latest and stale async checks are discarded', async () => {
  let resolve;
  const h = harness({ fetch: () => new Promise(r => resolve = r) }); h.render();
  h.timeout(); await flush(); assert.equal(h.render().status, 'failed');
  resolve(release()); await flush(); assert.equal(h.render().status, 'failed');
  const failed = harness({ fetch: () => Promise.reject(new Error('raw-secret')) }); failed.render(); await flush();
  assert.equal(failed.render().status, 'failed'); assert.ok(!failed.render().error.includes('raw-secret'));
  const unmounted = harness({ fetch: () => new Promise(r => resolve = r) }); unmounted.render(); unmounted.unmount(); resolve(release()); await flush();
  assert.equal(unmounted.render().release, null);
});
test('effect remount invalidates abandoned initial check without leaving its lock stuck', async () => {
  const resolvers = [];
  const h = harness({ fetch: () => new Promise(r => resolvers.push(r)) }); h.render(); h.unmount(); h.remount();
  assert.equal(h.counts().checks, 2); resolvers[0](release({ versionCode: 9 })); resolvers[1](release()); await flush();
  assert.equal(h.render().release.versionCode, 3);
});
test('native failure is normalized and cancelled download cannot repaint ready after its late promise', async () => {
  let resolve;
  const h = harness({ download: () => new Promise(r => resolve = r) }); h.render(); await flush();
  const pending = h.render().download(); h.render().cancel(); resolve({ ...idle, phase: 'ready', release: release(), versionCode: 3 }); await pending;
  assert.equal(h.render().status, 'cancelled');
  h.emit({ phase: 'failed', errorCode: 'https://host/?signed-secret=x' });
  assert.equal(h.render().status, 'failed'); assert.ok(!h.render().error.includes('signed-secret'));
});
for (const gate of ['studying', 'unknown']) test(`fresh ${gate} gate blocks installation without side effects`, async () => {
  const h = harness({ gate: async () => gate }); h.render(); await flush(); await h.render().download(); await h.render().install();
  assert.equal(h.counts().installs, 0); assert.match(h.render().error, gate === 'studying' ? /공부|휴식/ : /상태|확인/);
});
test('permission settings are explicit and foreground return never installs', async () => {
  const h = harness({ permission: false }); h.render(); await flush(); await h.render().download(); await h.render().install();
  assert.equal(h.render().status, 'permission_required'); assert.equal(h.counts().settings, 0);
  h.render().settings(); assert.equal(h.counts().settings, 1); h.foreground(); await flush();
  assert.equal(h.counts().installs, 0);
});
test('installer entry and spoofed installed event are not success until actual installed code changes', async () => {
  const h = harness(); h.render(); await flush(); await h.render().download();
  const a = h.render().install(); h.render().install(); await a; assert.equal(h.counts().installs, 1);
  assert.equal(h.render().status, 'install_pending');
  h.emit({ phase: 'installed' }); assert.notEqual(h.render().status, 'installed');
  h.emit({ phase: 'ready' }); h.foreground(); assert.equal(h.render().status, 'ready');
  h.current(3); h.emit({ phase: 'idle', release: null }); h.foreground(); assert.equal(h.render().status, 'installed');
});
test('actual panel renders scrolling accessible details and explicit user actions', async () => {
  const h = harness(); h.render(); await flush(); h.render().open(); h.render(); const tree = h.panel();
  assert.ok(all(tree, n => n.type === 'ScrollView').length);
  assert.ok(all(tree, n => n.props?.accessibilityViewIsModal).length);
  assert.ok(all(tree, n => n.props?.accessibilityLiveRegion === 'polite').length);
  const buttons = all(tree, n => n.type === 'Pressable');
  for (const b of buttons) { assert.equal(b.props.accessibilityRole, 'button'); assert.ok([b.props.style].flat(Infinity).some(s => s?.minHeight >= 44)); }
  assert.match(textOf(tree), /현재 버전.*9\.9\.9/); assert.match(textOf(tree), /2026/); assert.match(textOf(tree), /앱 업데이트 지원/);
  await buttons.find(b => textOf(b) === '업데이트 다운로드').props.onPress(); h.render(); assert.equal(h.render().status, 'ready');
  all(h.panel(), n => n.type === 'Modal')[0].props.onRequestClose(); assert.equal(h.render().isOpen, false);
});

test('closed updater has no persistent status bar or entry but existing controller opens its modal', async () => {
  const h = harness(); h.render(); await flush(); h.render();
  assert.equal(h.panel().type, 'Modal'); assert.equal(h.panel().props.visible, false);
  h.render().open(); h.render(); assert.equal(h.panel().props.visible, true);
  h.emit({ phase: 'downloading', downloadedBytes: 500, totalBytes: 1000 }); h.render().close();
  h.render().open(); assert.equal(h.render().progress, 50); assert.equal(h.counts().downloads, 0);
});

function appGuardHarness(result = { data: [], error: null }) {
  const states = [], refs = []; let si = 0, ri = 0, guard;
  const calls = [], timers = [];
  const react = { useState(initial) { const i = si++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], v => states[i] = typeof v === 'function' ? v(states[i]) : v]; },
    useRef(initial) { return refs[ri++] ??= { current: initial }; }, useEffect() {}, useMemo: fn => fn() };
  const element = (type, props) => ({ type, props });
  const query = { select(fields) { calls.push(['select', fields]); return this; }, eq(key, value) { calls.push(['eq', key, value]); return this; },
    then(resolve, reject) { return Promise.resolve(typeof result === 'function' ? result() : result).then(resolve, reject); } };
  const rn = Object.fromEntries(['Modal', 'Pressable', 'ScrollView', 'Text', 'View', 'ActivityIndicator', 'SafeAreaView', 'StatusBar', 'TextInput'].map(n => [n, n]));
  Object.assign(rn, { StyleSheet: { create: x => x }, Alert: {}, AppState: {}, Linking: {} });
  const imports = { react, 'react/jsx-runtime': { jsx: element, jsxs: element }, 'react-native': rn,
    'expo-web-browser': { maybeCompleteAuthSession() {} }, './src/mobileOAuth': {}, './src/notifications': {},
    './src/focus': { getLocalFocusStatus: () => null }, './src/FocusStatusPanel': { FocusStatusPanel: 'FocusStatusPanel' },
    './src/WebFeatureScreen': { WebFeatureScreen: 'WebFeatureScreen' }, './src/AppUpdatePanel': { AppUpdatePanel: 'AppUpdatePanel' },
    './src/NativeAppSettingsPanel': { NativeAppSettingsPanel: 'NativeAppSettingsPanel' },
    './src/readAppSettingsSnapshot': { readAppSettingsSnapshot: async () => null },
    './src/useAppUpdate': { useAppUpdate(fn) { guard = fn; return {}; } },
    './src/supabase': { supabase: { from(table) { calls.push(['from', table]); assert.equal(table, 'study_sessions'); return query; } } },
  };
  const App = compile('apps/mobile/App.tsx', imports, { setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {} }).default;
  const render = () => { si = ri = 0; return App(); };
  render();
  return { render, calls, states, gate: () => guard(), timeout: () => timers.forEach(fn => fn()), owner(id) { states[0] = id ? { user: { id } } : null; render(); } };
}
test('PC-only active study permits phone installation after fresh device proof without session writes', async () => {
  const h = appGuardHarness({ data: [{ id: 's', status: 'active', paused_at: null, lease_expires_at: null }], error: null });
  h.owner('owner'); h.states[22] = false;
  const web = all(h.render(), n => n.type === 'WebFeatureScreen')[0];
  web.props.onDeviceStudyReader?.(async () => 'allowed');
  assert.equal(await h.gate(), 'allowed');
  assert.deepEqual(h.calls, [['from', 'study_sessions'], ['select', 'id,status,paused_at,lease_expires_at'], ['eq', 'user_id', 'owner'], ['eq', 'status', 'active']]);
  h.states[22] = false;
  for (const signedIn of [false, true]) for (const fallback of [false, true]) {
    h.owner(signedIn ? 'owner' : null); h.states[33] = fallback;
    assert.equal(all(h.render(), n => n.type === 'AppUpdatePanel').length, 1);
  }
});
test('logged-out installation needs no server query and paused/no active study allows installation', async () => {
  const loggedOut = appGuardHarness(); assert.equal(await loggedOut.gate(), 'allowed'); assert.equal(loggedOut.calls.length, 0);
  const empty = appGuardHarness(); empty.owner('owner'); empty.states[22] = false;
  all(empty.render(), n => n.type === 'WebFeatureScreen')[0].props.onDeviceStudyReader?.(async () => 'allowed');
  assert.equal(await empty.gate(), 'allowed');
  const paused = appGuardHarness({ data: [{ id: 's', status: 'active', paused_at: '2026-10-04T10:00:00Z', lease_expires_at: null }], error: null });
  paused.owner('owner'); paused.states[22] = false;
  all(paused.render(), n => n.type === 'WebFeatureScreen')[0].props.onDeviceStudyReader?.(async () => 'allowed');
  assert.equal(await paused.gate(), 'allowed');
});

test('phone study/camera, missing device proof and stale account proof never allow installation', async () => {
  for (const proof of ['studying', 'unknown', null]) {
    const h = appGuardHarness({ data: [{ id: 's', status: 'active', paused_at: null, lease_expires_at: null }], error: null });
    h.owner('owner'); h.states[22] = false;
    const web = all(h.render(), n => n.type === 'WebFeatureScreen')[0];
    web.props.onDeviceStudyReader?.(proof ? async () => proof : null);
    assert.equal(await h.gate(), proof ?? 'unknown');
  }
  let resolve;
  const h = appGuardHarness(); h.owner('owner'); h.states[22] = false;
  all(h.render(), n => n.type === 'WebFeatureScreen')[0].props.onDeviceStudyReader?.(() => new Promise(r => resolve = r));
  const pending = h.gate(); await flush(); h.owner('other'); h.owner('owner'); resolve('allowed');
  assert.equal(await pending, 'unknown');
});

test('App loading/login/fallback offer small settings entry while WebView settings use same controller without remount', () => {
  const h = appGuardHarness();
  for (const [loading, owner, fallback] of [[true, null, false], [false, null, false], [false, 'owner', true]]) {
    h.states[22] = loading; h.owner(owner); h.states[33] = fallback; const tree = h.render();
    assert.ok(all(tree, n => n.type === 'Pressable' && textOf(n) === '설정').length);
    assert.equal(all(tree, n => n.type === 'NativeAppSettingsPanel').length, 1);
  }
  h.states[33] = false; const tree = h.render(); const web = all(tree, n => n.type === 'WebFeatureScreen')[0];
  assert.equal(typeof web.props.onOpenNativeSettings, 'function'); web.props.onOpenNativeSettings('permissions');
  const after = h.render(); assert.equal(all(after, n => n.type === 'WebFeatureScreen')[0].props.sessionUserId, 'owner');
  assert.equal(all(after, n => n.type === 'NativeAppSettingsPanel')[0].props.visible, true);
});
test('read error, malformed response, timeout and account changes fail closed', async () => {
  for (const result of [{ data: null, error: { message: 'secret' } }, { data: null, error: null }, { data: [{}], error: null }]) {
    const h = appGuardHarness(result); h.owner('owner'); assert.equal(await h.gate(), 'unknown');
  }
  let resolve;
  const changed = appGuardHarness(() => new Promise(r => resolve = r)); changed.owner('old');
  const checking = changed.gate(); await flush(); changed.owner('new'); resolve({ data: [], error: null }); assert.equal(await checking, 'unknown');
  const returned = appGuardHarness(() => new Promise(r => resolve = r)); returned.owner('old');
  const originalRead = returned.gate(); await flush(); returned.owner('new'); returned.owner('old'); resolve({ data: [], error: null }); assert.equal(await originalRead, 'unknown');
  const hung = appGuardHarness(() => new Promise(() => {})); hung.owner('owner'); const bounded = hung.gate(); hung.timeout(); assert.equal(await bounded, 'unknown');
});
