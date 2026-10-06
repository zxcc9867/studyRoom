import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const req = createRequire(path.join(root, 'apps/mobile/package.json'));
function compile(file, imports = {}) {
  if (!existsSync(path.join(root, file))) return {};
  const code = req('@babel/core').transformSync(readFileSync(path.join(root, file), 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    presets: [[req.resolve('@babel/preset-typescript'), { allExtensions: true, isTSX: true }]],
    plugins: [[req.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }], req.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = { exports: {}, URL, require(name) { assert.ok(name in imports, name); return imports[name]; } };
  runInNewContext(code, context); return context.exports;
}
const bridge = () => compile('apps/mobile/src/mobileWebBridge.ts');
const settings = () => compile('apps/mobile/src/nativeAppSettings.ts');
const snapshot = { versionName: '0.2.2', versionCode: 5, updaterStatus: 'available', permissions: { camera: 'granted', notifications: 'denied', focus: 'granted' } };
const element = (type, props) => ({ type, props });
const nodes = (node, predicate, result = []) => { if (!node || typeof node !== 'object') return result; if (predicate(node)) result.push(node); for (const child of [node.props?.children].flat(Infinity)) nodes(child, predicate, result); return result; };
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node && typeof node === 'object' ? [node.props?.children].flat(Infinity).map(textOf).join('') : '';
test('native settings shows actual version/permissions with explicit update and login-gated push controls', () => {
  const states = [snapshot, '']; let index = 0; const actions = [];
  const rn = Object.fromEntries(['Modal', 'Pressable', 'ScrollView', 'Text', 'View', 'ActivityIndicator'].map(n => [n, n]));
  rn.StyleSheet = { create: value => value }; rn.AppState = {};
  const { NativeAppSettingsPanel } = compile('apps/mobile/src/NativeAppSettingsPanel.tsx', {
    react: { useState: initial => [states[index++] ?? initial, () => {}], useRef: initial => ({ current: initial }), useEffect() {} },
    'react/jsx-runtime': { jsx: element, jsxs: element }, 'react-native': rn,
  });
  assert.equal(typeof NativeAppSettingsPanel, 'function');
  const props = { visible: true, userId: null, palette: {}, readSnapshot: async () => snapshot,
    onClose() {}, onUpdate: () => actions.push('update'), onFocus: () => actions.push('focus'), onAppSettings: () => actions.push('permissions'), onRegisterPush: () => actions.push('push') };
  const loggedOut = NativeAppSettingsPanel(props); assert.match(textOf(loggedOut), /0\.2\.2.*5/); assert.match(textOf(loggedOut), /카메라.*허용/);
  const button = label => nodes(loggedOut, n => n.type === 'Pressable').find(n => textOf(n) === label);
  assert.ok(button('앱 업데이트')); assert.equal(button('휴대폰 푸시 알림 등록'), undefined); assert.equal(button('휴대폰 집중 설정'), undefined);
  assert.deepEqual(actions, []); button('앱 업데이트').props.onPress(); assert.deepEqual(actions, ['update']);
  index = 0; const signedIn = NativeAppSettingsPanel({ ...props, userId: 'owner' });
  assert.ok(nodes(signedIn, n => n.type === 'Pressable').find(n => textOf(n) === '휴대폰 푸시 알림 등록'));
  for (const b of nodes(signedIn, n => n.type === 'Pressable')) { assert.equal(b.props.accessibilityRole, 'button'); assert.ok([b.props.style].flat(Infinity).some(s => s?.minHeight >= 44)); }
});
const context = () => ({ active: true, owner: 'user1', authenticatedOwner: 'user1', document: 1, ownerRevision: 1, authenticatedOwnerRevision: 1, navigation: 1,
  url: 'https://study-room-attendance.vercel.app/#settings' });
test('settings parser accepts only exact read/open schemas and rejects commands and extra fields', () => {
  const parse = bridge().parseNativeBridgeMessage;
  assert.equal(parse(JSON.stringify({ type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'r1' }))?.type, 'STUDY_WEB_SETTINGS_INFO');
  assert.equal(parse(JSON.stringify({ type: 'STUDY_WEB_OPEN_SETTINGS', requestId: 'r2', target: 'update' }))?.target, 'update');
  for (const m of [{ type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'r', url: 'https://evil' },
    { type: 'STUDY_WEB_OPEN_SETTINGS', requestId: 'r', target: 'install' },
    { type: 'STUDY_WEB_OPEN_SETTINGS', requestId: '', target: 'focus' },
    { type: 'STUDY_WEB_OPEN_SETTINGS', requestId: 'r', target: 'permissions', download: true }]) assert.equal(parse(JSON.stringify(m)), null);
});
test('native settings read permits only trusted current top frame with authenticated same owner', async () => {
  const { handleNativeSettingsRequest } = settings(); assert.equal(typeof handleNativeSettingsRequest, 'function');
  for (const change of [{ active: false }, { authenticatedOwner: null }, { authenticatedOwner: 'other' }, { owner: null },
    { url: 'https://evil.test/#settings' }, { url: 'https://study-room-attendance.vercel.app/#today' }]) {
    let reads = 0, opens = 0; const current = { ...context(), ...change };
    await handleNativeSettingsRequest({ type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'r' }, { url: context().url, isTopFrame: true },
      { current: () => current, read: async () => { reads++; return snapshot; }, respond() {}, open() { opens++; } });
    assert.equal(reads, 0); assert.equal(opens, 0);
  }
  for (const event of [{ url: context().url, isTopFrame: false }, { url: context().url }, { url: 'https://evil.test', isTopFrame: true }]) {
    let reads = 0; await handleNativeSettingsRequest({ type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'r' }, event,
      { current: context, read: async () => { reads++; return snapshot; }, respond() {}, open() {} }); assert.equal(reads, 0);
  }
});
test('read snapshot is safe and late document or owner responses are discarded', async () => {
  const { handleNativeSettingsRequest } = settings(); assert.equal(typeof handleNativeSettingsRequest, 'function');
  for (const change of [{ document: 2 }, { owner: 'other' }, { ownerRevision: 2 }, { navigation: 2 }, { authenticatedOwner: null }, { url: 'https://study-room-attendance.vercel.app/#today' }]) {
    let current = context(), resolve, responses = 0;
    const pending = handleNativeSettingsRequest({ type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'r' }, { url: current.url, isTopFrame: true },
      { current: () => current, read: () => new Promise(r => resolve = r), respond() { responses++; }, open() { assert.fail('read must not open'); } });
    current = { ...current, ...change }; resolve(snapshot); await pending; assert.equal(responses, 0);
  }
  let response; await handleNativeSettingsRequest({ type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'r' }, { url: context().url, isTopFrame: true },
    { current: context, read: async () => ({ ...snapshot, token: 'secret', url: 'https://secret' }), respond(value) { response = value; }, open() { assert.fail('read must not open'); } });
  assert.deepEqual(JSON.parse(JSON.stringify(response)), { type: 'STUDY_NATIVE_SETTINGS_INFO', requestId: 'r', snapshot });
});
test('only explicit known open targets invoke native UI and never read/download/install', async () => {
  const { handleNativeSettingsRequest } = settings(); assert.equal(typeof handleNativeSettingsRequest, 'function');
  const opened = [];
  for (const target of ['update', 'focus', 'permissions']) await handleNativeSettingsRequest(
    { type: 'STUDY_WEB_OPEN_SETTINGS', requestId: 'r', target }, { url: context().url, isTopFrame: true },
    { current: context, read() { assert.fail('open must not read'); }, respond() { assert.fail('open must not respond'); }, open(value) { opened.push(value); } });
  assert.deepEqual(opened, ['update', 'focus', 'permissions']);
});
test('permission snapshot invokes read boundaries only and normalizes missing/errors without secrets', async () => {
  const { readNativeSettingsSnapshot } = settings(); assert.equal(typeof readNativeSettingsSnapshot, 'function');
  const value = await readNativeSettingsSnapshot({ version: () => ({ versionName: '0.2.2', versionCode: 5, packageName: 'private' }),
    updaterStatus: 'available', camera: async () => true, notifications: async () => 'denied', focus: () => ({ supported: true, hasAccess: true, active: true }) });
  assert.deepEqual(JSON.parse(JSON.stringify(value)), snapshot);
  const failed = await readNativeSettingsSnapshot({ version() { throw Error('secret'); }, updaterStatus: 'failed', camera: async () => { throw Error('secret'); }, notifications: async () => { throw Error('secret'); }, focus: () => null });
  assert.deepEqual(JSON.parse(JSON.stringify(failed)), { versionName: null, versionCode: null, updaterStatus: 'failed', permissions: { camera: 'unknown', notifications: 'unknown', focus: 'unsupported' } });
});
function host(supported = true) {
  const listeners = new Set(), sent = [];
  const h = { studyRoomNativeSettings: supported, top: null, location: { hash: '#settings' },
    crypto: { randomUUID: () => 'r1' }, ReactNativeWebView: { postMessage: raw => sent.push(JSON.parse(raw)) },
    addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) };
  h.top = h; return { h, sent, listeners, emit: detail => [...listeners].forEach(fn => fn({ detail })) };
}
test('web helper old APK is immediately unsupported with no listeners/messages and bad target is refused', async () => {
  const api = await import('../apps/web/src/nativeAppSettings.mjs').catch(() => ({})); assert.equal(typeof api.getNativeSettingsInfo, 'function');
  const { h, sent, listeners } = host(false); assert.deepEqual(await api.getNativeSettingsInfo(h), { status: 'unsupported' });
  assert.equal(api.openNativeSettings(h, 'update'), false); assert.equal(sent.length, 0); assert.equal(listeners.size, 0);
  const fresh = host(); assert.equal(api.openNativeSettings(fresh.h, 'install'), false); assert.equal(fresh.sent.length, 0);
});
test('web helper accepts only matching known safe snapshots and cleans up after success/timeout/navigation', async () => {
  const api = await import('../apps/web/src/nativeAppSettings.mjs').catch(() => ({})); assert.equal(typeof api.getNativeSettingsInfo, 'function');
  const { h, sent, listeners, emit } = host(); const pending = api.getNativeSettingsInfo(h, 100);
  assert.deepEqual(sent, [{ type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'r1' }]);
  emit({ type: 'OTHER', requestId: 'r1', snapshot }); emit({ type: 'STUDY_NATIVE_SETTINGS_INFO', requestId: 'old', snapshot });
  emit({ type: 'STUDY_NATIVE_SETTINGS_INFO', requestId: 'r1', snapshot: { ...snapshot, token: 'secret' } }); assert.equal(listeners.size, 1);
  emit({ type: 'STUDY_NATIVE_SETTINGS_INFO', requestId: 'r1', snapshot }); assert.deepEqual(await pending, { status: 'ready', snapshot }); assert.equal(listeners.size, 0);
  const timeout = host(); assert.deepEqual(await api.getNativeSettingsInfo(timeout.h, 1), { status: 'failure' }); assert.equal(timeout.listeners.size, 0);
  const stale = host(); const wait = api.getNativeSettingsInfo(stale.h, 1); stale.h.location.hash = '#today'; stale.emit({ type: 'STUDY_NATIVE_SETTINGS_INFO', requestId: 'r1', snapshot }); assert.deepEqual(await wait, { status: 'failure' });
});
test('Android WebMessageListener settings policy rejects subframes/untrusted/legacy while preserving old messages', () => {
  const source = readFileSync(path.join(root, 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java'), 'utf8');
  const start = source.indexOf('public static boolean settingsBridgeAllowed('), end = source.indexOf('\n    }', start);
  assert.ok(start >= 0 && end > start, 'native main-frame policy is missing');
  const directory = mkdtempSync(path.join(tmpdir(), 'settings-frame-policy-'));
  try {
    const file = path.join(directory, 'SettingsPolicy.java');
    writeFileSync(file, `class SettingsPolicy { ${source.slice(start, end + 6)}
      public static void main(String[] args) {
        String origin="https://study-room-attendance.vercel.app";
        System.out.println(settingsBridgeAllowed("STUDY_WEB_SETTINGS_INFO",origin,true));
        System.out.println(settingsBridgeAllowed("STUDY_WEB_OPEN_SETTINGS",origin,false));
        System.out.println(settingsBridgeAllowed("STUDY_WEB_SETTINGS_INFO","https://evil.test",true));
        System.out.println(settingsBridgeAllowed("STUDY_WEB_OPEN_SETTINGS",origin,null));
        System.out.println(settingsBridgeAllowed("STUDY_WEB_READY","https://evil.test",null));
        System.out.println(settingsBridgeAllowed("STUDY_WEB_CAMERA_PERMISSION",origin,false));
      }
    }`);
    const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java.exe') : 'C:/Program Files/Microsoft/jdk-21.0.12.8-hotspot/bin/java.exe';
    const result = spawnSync(java, [file], { encoding: 'utf8', timeout: 20000 }); assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), ['true', 'false', 'false', 'false', 'true', 'true']);
  } finally { rmSync(directory, { force: true, recursive: true }); }
});
function screenHarness(options = {}) {
  const values = [], refs = []; let vi = 0, ri = 0, reads = 0, owner = 'user1', documentId = 1; const opened = [], injected = [];
  const react = { useState(initial) { const i = vi++; if (!(i in values)) values[i] = initial; return [values[i], value => values[i] = value]; },
    useRef(initial) { return refs[ri++] ??= { current: initial }; }, useEffect() {} };
  const rn = Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'View'].map(n => [n, n]));
  Object.assign(rn, { StyleSheet: { create: x => x }, Linking: {}, Alert: {}, Platform: { OS: 'android' }, PermissionsAndroid: {} });
  const { WebFeatureScreen } = compile('apps/mobile/src/WebFeatureScreen.tsx', { react, 'react/jsx-runtime': { jsx: element, jsxs: element }, 'react-native': rn,
    'react-native-webview': { __esModule: true, default: 'WebView' }, 'expo-device': { isDevice: false }, './mobileWebBridge': bridge(),
    './nativeAppSettings': settings(), './cameraPermission': {}, './supabase': { supabase: { auth: {
      getSession: async () => ({ data: { session: { user: { id: 'user1' } } } }), getUser: async () => ({ data: { user: { id: 'user1' } } }),
    }, functions: { invoke: async () => ({ data: { user_id: 'user1', verification_type: 'magiclink', token_hash: 'test-hash' } }) } } } });
  const renderTree = () => { vi = ri = 0; return WebFeatureScreen({ sessionUserId: 'user1', getNativeOwner: () => owner,
    readSettingsSnapshot: async () => { reads++; return options.read ? await options.read() : snapshot; }, onOpenNativeSettings: value => opened.push(value), onStudyStateChanged() {}, onNativeSignOut() {}, onFallback() {} }); };
  const render = () => nodes(renderTree(), n => n.type === 'WebView')[0];
  let view = render(); refs[0].current = { injectJavaScript: value => injected.push(value) };
  view.props.onLoadStart?.({ nativeEvent: { url: 'https://study-room-attendance.vercel.app/#today', studySettingsDocumentId: documentId } });
  const message = async (body, metadata = {}) => { view.props.onMessage({ nativeEvent: { url: 'https://study-room-attendance.vercel.app/', sourceOrigin: 'https://study-room-attendance.vercel.app', isTopFrame: true, studySettingsDocumentId: documentId, data: JSON.stringify(body), ...metadata } }); await new Promise(r => setImmediate(r)); view = render(); };
  return { render, message, injected, opened, reads: () => reads, owner: value => owner = value, nav: url => view.props.onNavigationStateChange({ url }),
    load: (url = 'https://study-room-attendance.vercel.app/#settings') => { documentId++; view.props.onLoadStart?.({ nativeEvent: { url, studySettingsDocumentId: documentId } }); view.props.onNavigationStateChange({ url }); },
    hashNav: url => { view.props.onLoadStart?.({ nativeEvent: { url, studySettingsDocumentId: documentId } }); view.props.onNavigationStateChange({ url }); },
    retry() { view.props.onError(); const feedback = renderTree(); const button = nodes(feedback, n => n.type === 'Pressable' && textOf(n) === '다시 열기')[0]; assert.ok(button); button.props.onPress();
      documentId = 1; view = render(); view.props.onLoadStart({ nativeEvent: { url: 'https://study-room-attendance.vercel.app/#today', studySettingsDocumentId: documentId } }); view.props.onNavigationStateChange({ url: 'https://study-room-attendance.vercel.app/#today' }); },
    async auth() { await message({ type: 'STUDY_WEB_READY', requestId: 'auth1' }); await message({ type: 'STUDY_WEB_AUTH_OK', requestId: 'auth1', userId: 'user1' }); } };
}
test('actual WebView settings messages require current authenticated document and native frame proof', async () => {
  const h = screenHarness(); h.nav('https://study-room-attendance.vercel.app/#settings');
  const info = { type: 'STUDY_WEB_SETTINGS_INFO', requestId: 's1' };
  await h.message(info); assert.equal(h.reads(), 0); await h.auth();
  await h.message(info, { isTopFrame: false }); await h.message(info, { isTopFrame: undefined }); await h.message(info, { sourceOrigin: 'https://evil.test' }); assert.equal(h.reads(), 0);
  await h.message(info); assert.equal(h.reads(), 1); assert.match(h.injected.at(-1), /STUDY_NATIVE_SETTINGS_INFO/);
  await h.message({ type: 'STUDY_WEB_OPEN_SETTINGS', requestId: 's2', target: 'update' }); assert.deepEqual(h.opened, ['update']);
  h.owner('other'); await h.message(info); assert.equal(h.reads(), 1); h.owner('user1'); h.load(); await h.message(info); assert.equal(h.reads(), 1);
});

test('Android hash load-start then navigation preserves same-document auth for settings read/open', async () => {
  const h = screenHarness(); await h.auth();
  h.hashNav('https://study-room-attendance.vercel.app/#settings');
  await h.message({ type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'hash-read' }); assert.equal(h.reads(), 1);
  await h.message({ type: 'STUDY_WEB_OPEN_SETTINGS', requestId: 'hash-open', target: 'update' }); assert.deepEqual(h.opened, ['update']);
});

test('actual same-URL reload and fresh document reject previous proof and stale native epochs', async () => {
  const h = screenHarness(); await h.auth(); h.nav('https://study-room-attendance.vercel.app/#settings');
  const info = { type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'reload-read' }; await h.message(info); assert.equal(h.reads(), 1);
  h.load(); await h.message(info); assert.equal(h.reads(), 1);
  await h.message({ type: 'STUDY_WEB_OPEN_SETTINGS', requestId: 'reload-open', target: 'update' }); assert.deepEqual(h.opened, []);
  await h.auth(); await h.message(info, { studySettingsDocumentId: 1 }); await h.message(info, { studySettingsDocumentId: undefined }); assert.equal(h.reads(), 1);
  await h.message(info); assert.equal(h.reads(), 2);
  h.load('https://study-room-attendance.vercel.app/#today'); h.hashNav('https://study-room-attendance.vercel.app/#settings'); await h.message(info); assert.equal(h.reads(), 2);
});

test('native document-start callbacks advance epoch on page start but not visited hash/history', () => {
  const webSource = readFileSync(path.join(root, 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java'), 'utf8');
  const clientSource = readFileSync(path.join(root, 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java'), 'utf8');
  const method = (source, signature) => { const start = source.indexOf(signature), end = source.indexOf('\n    }', start); assert.ok(start >= 0 && end > start, `missing native method ${signature}`); return source.slice(start, end + 6); };
  const getter = method(webSource, 'public long getStudySettingsDocumentId(');
  const started = method(webSource, 'public void studySettingsDocumentStarted(');
  const page = method(clientSource, 'public void onPageStarted(');
  const history = method(clientSource, 'public void doUpdateVisitedHistory (');
  const event = method(clientSource, 'protected WritableMap createWebViewEvent(');
  const directory = mkdtempSync(path.join(tmpdir(), 'settings-document-policy-'));
  try {
    const file = path.join(directory, 'DocumentPolicy.java');
    writeFileSync(file, `import java.util.*;
class Bitmap {}
class WritableMap extends HashMap<String,Object> { void putDouble(String k,double v){put(k,v);} void putBoolean(String k,boolean v){put(k,v);} void putString(String k,String v){put(k,v);} }
class Arguments { static WritableMap createMap(){return new WritableMap();} }
class WebView { int getProgress(){return 100;} String getTitle(){return "study";} boolean canGoBack(){return false;} boolean canGoForward(){return false;} }
class WebViewClient { public void onPageStarted(WebView v,String u,Bitmap f){} public void doUpdateVisitedHistory(WebView v,String u,boolean r){} }
class RNCWebViewWrapper { static int getReactTagFromWebView(WebView v){return 1;} }
class TopLoadingStartEvent { WritableMap value; TopLoadingStartEvent(int tag,WritableMap v){value=v;} }
class RNCWebView extends WebView { private long studySettingsDocumentId=0; ArrayList<Double> epochs=new ArrayList<>(); int injected;
${getter}
${started}
void callInjectedJavaScriptBeforeContentLoaded(){injected++;} void dispatchEvent(WebView v,TopLoadingStartEvent e){epochs.add((Double)e.value.get("studySettingsDocumentId"));} }
class DocumentPolicy extends WebViewClient { boolean mLastLoadFailed=false;
${page}
${history}
${event}
public static void main(String[] a){DocumentPolicy c=new DocumentPolicy();RNCWebView v=new RNCWebView();
c.onPageStarted(v,"https://study-room-attendance.vercel.app/#today",null);
c.doUpdateVisitedHistory(v,"https://study-room-attendance.vercel.app/#today",false);
c.doUpdateVisitedHistory(v,"https://study-room-attendance.vercel.app/#settings",false);
c.onPageStarted(v,"https://study-room-attendance.vercel.app/#settings",null);
c.doUpdateVisitedHistory(v,"https://study-room-attendance.vercel.app/#settings",true);
System.out.println(v.epochs);System.out.println(v.injected);}}
`);
    const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java.exe') : 'C:/Program Files/Microsoft/jdk-21.0.12.8-hotspot/bin/java.exe';
    const compiled = spawnSync(java.replace(/java\.exe$/, 'javac.exe'), [file], { encoding: 'utf8', timeout: 20000 }); assert.equal(compiled.status, 0, compiled.stderr || compiled.error?.message);
    const result = spawnSync(java, ['-cp', directory, 'DocumentPolicy'], { encoding: 'utf8', timeout: 20000 }); assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), ['[1.0, 1.0, 1.0, 2.0, 2.0]', '2']);
  } finally { rmSync(directory, { force: true, recursive: true }); }
});

test('same-document tab ABA preserves auth but drops an earlier settings snapshot', async () => {
  let resolve; const h = screenHarness({ read: () => new Promise(r => resolve = r) }); await h.auth(); h.hashNav('https://study-room-attendance.vercel.app/#settings');
  const before = h.injected.length;
  await h.message({ type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'tab-aba' }); assert.equal(h.reads(), 1);
  h.hashNav('https://study-room-attendance.vercel.app/#today'); h.hashNav('https://study-room-attendance.vercel.app/#settings');
  resolve(snapshot); await new Promise(r => setImmediate(r)); assert.equal(h.injected.length, before);
  await h.message({ type: 'STUDY_WEB_OPEN_SETTINGS', requestId: 'tab-open', target: 'focus' }); assert.deepEqual(h.opened, ['focus']);
});

test('failed WebView retry discards proof and accepts fresh native epoch1 after previous epoch3', async () => {
  const h = screenHarness(); h.load(); h.load(); await h.auth(); h.hashNav('https://study-room-attendance.vercel.app/#settings');
  const info = { type: 'STUDY_WEB_SETTINGS_INFO', requestId: 'retry-read' }; await h.message(info); assert.equal(h.reads(), 1);
  h.retry(); h.hashNav('https://study-room-attendance.vercel.app/#settings'); await h.message(info); assert.equal(h.reads(), 1);
  await h.auth(); await h.message(info); assert.equal(h.reads(), 2);
});
