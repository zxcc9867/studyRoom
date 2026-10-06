import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import * as studyCore from '../packages/core/src/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobileRequire = createRequire(path.join(root, 'apps/mobile/package.json'));

function compile(relativePath, imports) {
  const filePath = path.join(root, relativePath);
  const { transformSync } = mobileRequire('@babel/core');
  const compiled = transformSync(readFileSync(filePath, 'utf8'), {
    filename: filePath,
    babelrc: false,
    configFile: false,
    presets: [[mobileRequire.resolve('@babel/preset-typescript'), { allExtensions: true, isTSX: true }]],
    plugins: [
      [mobileRequire.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }],
      mobileRequire.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  }).code;
  const context = { exports: {}, URL, setTimeout, clearTimeout, require(name) {
    if (name === '../../packages/core/src/index.mjs') return studyCore;
    if (name === './src/AppUpdatePanel') return { AppUpdatePanel: 'AppUpdatePanel' };
    if (name === './src/NativeAppSettingsPanel') return { NativeAppSettingsPanel: 'NativeAppSettingsPanel' };
    if (name === './src/readAppSettingsSnapshot') return { readAppSettingsSnapshot: async () => null };
    if (name === './nativeAppSettings') return compile('apps/mobile/src/nativeAppSettings.ts', imports);
    if (name === './deviceStudyProbe') return compile('apps/mobile/src/deviceStudyProbe.ts', imports);
    if (name === './src/useAppUpdate') return { useAppUpdate: () => ({}) };
    if (name === './src/FocusStatusPanel') return compile('apps/mobile/src/FocusStatusPanel.tsx', imports);
    if (name === './focusStatus') return compile('apps/mobile/src/focusStatus.ts', imports);
    if (name === 'expo-web-browser') return { maybeCompleteAuthSession() {} };
    if (name === './src/mobileOAuth') return mobileRequire('./src/mobileOAuth.ts');
    if (name === './cameraPermission') return mobileRequire('./src/cameraPermission.ts');
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  } };
  runInNewContext(compiled, context, { timeout: 1000 });
  return context.exports;
}

const element = (type, props) => typeof type === 'function' ? type(props) : ({ type, props });
const native = {
  ActivityIndicator: 'ActivityIndicator', Alert: { alert() {} }, AppState: {},
  Linking: { async openURL() {} }, Modal: 'Modal', Pressable: 'Pressable',
  SafeAreaView: 'SafeAreaView', ScrollView: 'ScrollView',
  StyleSheet: { create: (styles) => styles }, StatusBar: 'StatusBar',
  Text: 'Text', TextInput: 'TextInput', View: 'View',
};

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}

function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';
  return [node.props?.children].flat(Infinity).map(textOf).join('');
}

test('native first login renders the shared readable theme with scroll and accessible controls', () => {
  let stateIndex = 0;
  const states = { 3: true, 22: false };
  const react = {
    useState(initial) {
      const index = stateIndex++;
      return [index in states ? states[index] : typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useRef(initial) { return { current: initial }; },
    useEffect() {},
    useMemo(callback) { return callback(); },
  };
  const { default: App } = compile('apps/mobile/App.tsx', {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': native,
    './src/supabase': { supabase: {} },
    './src/focus': {},
    './src/notifications': {},
    './src/WebFeatureScreen': { WebFeatureScreen: 'WebFeatureScreen' },
  });
  const tree = App();
  const scroll = find(tree, (node) => node.type === 'ScrollView');
  assert.ok(scroll, 'small screens and the keyboard must not trap login controls');
  assert.equal(scroll.props.contentContainerStyle.flexGrow, 1);
  const panel = find(tree, (node) => node.type === 'View' && node.props.style?.maxWidth === 560);
  assert.equal(panel.props.style.borderWidth, 1);
  assert.equal(panel.props.style.borderRadius, 16);
  assert.equal(panel.props.style.backgroundColor, '#fffdf5');
  const title = find(tree, (node) => node.type === 'Text' && textOf(node) === '독서실에 로그인');
  assert.equal(title.props.style.fontSize, 30);
  assert.equal(title.props.style.lineHeight, 41);
  const description = find(tree, (node) => node.type === 'Text' && /웹에서 쓰던 같은 Google/.test(textOf(node)));
  assert.equal(description.props.style.fontSize, 15);
  assert.equal(description.props.style.lineHeight, 25);
  assert.equal(description.props.style.color, '#4e5b50');
  for (const label of ['이메일', '8자리 인증 코드']) {
    const input = find(tree, (node) => node.type === 'TextInput' && node.props.accessibilityLabel === label);
    assert.ok(input, label);
    assert.ok(input.props.style.minHeight >= 44, label);
  }
  for (const label of ['Google로 계속하기', '코드 다시 받기', '코드로 로그인']) {
    const button = find(tree, (node) => node.type === 'Pressable' && textOf(node) === label);
    assert.ok(button, label);
    assert.equal(button.props.accessibilityRole, 'button');
    const style = Object.assign({}, ...[button.props.style].flat().filter(Boolean));
    assert.ok(style.minHeight >= 44, label);
  }
});

test('Android login opens the full web shell while preserving native focus and study fallback', () => {
  const states = [];
  const refs = [];
  const tablesRead = [];
  let stateIndex = 0;
  let refIndex = 0;
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect() {},
    useMemo(callback) { return callback(); },
  };
  const { default: App } = compile('apps/mobile/App.tsx', {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': native,
    './src/supabase': { supabase: {
      from(table) {
        tablesRead.push(table);
        const data = table === 'profiles'
          ? { user_id: 'user-1', time_zone: 'UTC', reminder_time: '20:30:00' }
          : table === 'attendance_days' ? null : [];
        const result = { data, error: null };
        const query = {
          select() { return query; }, eq() { return query; }, order() { return query; },
          limit() { return query; }, maybeSingle() { return Promise.resolve(result); },
          then(resolve) { return Promise.resolve(result).then(resolve); },
        };
        return query;
      },
      async rpc() { return { data: [{ completed_seconds: 0 }], error: null }; },
    } },
    './src/focus': {},
    './src/notifications': {},
    './src/WebFeatureScreen': { WebFeatureScreen: 'WebFeatureScreen' },
  });
  const render = () => { stateIndex = 0; refIndex = 0; return App(); };
  render();
  states[0] = { user: { id: 'user-1' } };
  states[22] = false;
  const tree = render();
  const webScreen = find(tree, (node) => node.type === 'WebFeatureScreen');
  assert.equal(webScreen?.props.sessionUserId, 'user-1');
  assert.ok(find(tree, (node) => node.type === 'Text' && textOf(node) === '휴대폰 집중 모드'));
  for (const label of ['휴대폰 연결', '집중 설정', '로그아웃']) {
    const action = find(tree, (node) => node.type === 'Pressable' && textOf(node) === label);
    const style = Object.assign({}, ...[action.props.style].flat().filter(Boolean));
    assert.ok(style.minHeight >= 44, label);
    const text = find(action, (node) => node.type === 'Text');
    const textStyle = Object.assign({}, ...[text.props.style].flat().filter(Boolean));
    assert.ok(textStyle.fontSize >= 14, label);
  }
  webScreen.props.onFallback();
  assert.equal(find(render(), (node) => node.type === 'WebFeatureScreen'), null);
  assert.ok(tablesRead.includes('profiles'), 'native fallback must continue refreshing server study data');
  states[13] = true;
  const reflection = find(render(), (node) => node.type === 'Modal' && node.props.visible);
  assert.ok(reflection);
  for (const label of ['방해 없음', '휴대폰', '기타']) {
    const reason = find(reflection, (node) => node.type === 'Pressable' && textOf(node) === label);
    const style = Object.assign({}, ...[reason.props.style].flat().filter(Boolean));
    assert.ok(style.minHeight >= 44, label);
  }
});

test('signed-in app reuses one first-party web dashboard with all six sections and no second login hint', async () => {
  const opened = [];
  const device = { __esModule: true, isDevice: false };
  const react = { useState(initial) { return [initial, () => {}]; }, useRef(initial) { return { current: initial }; }, useEffect() {} };
  const { WebFeatureScreen } = compile('apps/mobile/src/WebFeatureScreen.tsx', {
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-native': { ...native, Linking: { async openURL(url) { opened.push(url); } } },
    'react-native-webview': { __esModule: true, default: 'WebView' },
    'expo-device': device,
    './supabase': { supabase: {} },
    './mobileWebBridge': {
      studyWebOrigin: 'https://study-room-attendance.vercel.app',
      isTrustedWebUrl(url) { return new URL(url).origin === 'https://study-room-attendance.vercel.app'; },
      parseNativeBridgeMessage() { return null; },
      requestMobileWebTicket: async () => ({ userId: 'user-1', tokenHash: 'one-use-hash' }),
      buildTicketInjection: () => 'safe-injection',
    },
  });
  const tree = WebFeatureScreen({ sessionUserId: 'user-1', onStudyStateChanged() {}, onNativeSignOut() {}, onFallback() {} });
  const webView = find(tree, (node) => node.type === 'WebView');
  assert.ok(webView);
  assert.equal(webView.props.source.uri, 'https://study-room-attendance.vercel.app/#today');
  assert.equal(webView.props.webviewDebuggingEnabled, true, 'emulator supports inspection of the actual rendered page');
  device.isDevice = true;
  const physicalTree = WebFeatureScreen({ sessionUserId: 'user-1', onStudyStateChanged() {}, onNativeSignOut() {}, onFallback() {} });
  assert.equal(find(physicalTree, (node) => node.type === 'WebView').props.webviewDebuggingEnabled, false, 'physical devices never expose WebView inspection');
  assert.deepEqual([...webView.props.originWhitelist], ['https://study-room-attendance.vercel.app']);
  assert.equal(webView.props.onShouldStartLoadWithRequest({ url: webView.props.source.uri }), true);
  assert.equal(webView.props.onShouldStartLoadWithRequest({ url: 'https://study-room-attendance.vercel.app/#goals' }), true);
  assert.equal(webView.props.onShouldStartLoadWithRequest({ url: 'https://study-room-attendance.vercel.app.evil.test/' }), false);
  assert.equal(webView.props.onShouldStartLoadWithRequest({ url: 'https://example.com/article' }), false);
  assert.doesNotMatch(textOf(tree), /한 번 더 로그인/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(opened, [
    'https://study-room-attendance.vercel.app.evil.test/', 'https://example.com/article',
  ]);
});

test('automatic camera check in native WebView does not show explanation or OS request',async()=>{
 const injected=[];let requests=0,alerts=0;
 const refs=[];const react={useState:initial=>[initial,()=>{}],useRef(initial){const ref={current:initial};refs.push(ref);return ref;},useEffect(){}};
 const {WebFeatureScreen}=compile('apps/mobile/src/WebFeatureScreen.tsx',{
  react,'react/jsx-runtime':{jsx:element,jsxs:element},
  'react-native':{...native,Platform:{OS:'android'},Alert:{alert(){alerts++;}},PermissionsAndroid:{PERMISSIONS:{CAMERA:'camera'},check:async()=>false,request:async()=>{requests++;return 'granted';}}},
  'react-native-webview':{__esModule:true,default:'WebView'},'expo-device':{isDevice:false},'./supabase':{supabase:{}},
  './mobileWebBridge':{studyWebOrigin:'https://study-room-attendance.vercel.app',isTrustedWebUrl:url=>url==='https://study-room-attendance.vercel.app/',parseNativeBridgeMessage:JSON.parse,buildCameraPermissionInjection:(id,status)=>JSON.stringify({id,status})},
 });
 const view=find(WebFeatureScreen({sessionUserId:'owner',onStudyStateChanged(){},onNativeSignOut(){},onFallback(){}}),node=>node.type==='WebView');
 refs[0].current={injectJavaScript:script=>injected.push(JSON.parse(script))};refs[1].current='https://study-room-attendance.vercel.app/';
 await view.props.onMessage({nativeEvent:{url:'https://study-room-attendance.vercel.app/',data:JSON.stringify({type:'STUDY_WEB_CAMERA_PERMISSION_CHECK',requestId:'check'})}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(JSON.parse(JSON.stringify(injected)),[{id:'check',status:'denied'}]);assert.equal(requests,0);assert.equal(alerts,0);
});
