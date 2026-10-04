import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobileRequire = createRequire(path.join(root, 'apps/mobile/package.json'));

function renderStudyRoom(session, nowMs) {
  const filePath = path.join(root, 'apps/mobile/App.tsx');
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
  const states = [];
  const refs = [];
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
  const element = (type, props) => ({ type, props });
  const native = {
    ActivityIndicator: 'ActivityIndicator', Alert: { alert() {} }, AppState: {},
    Modal: 'Modal', Pressable: 'Pressable', SafeAreaView: 'SafeAreaView',
    ScrollView: 'ScrollView', StyleSheet: { create: (styles) => styles },
    StatusBar: 'StatusBar', Text: 'Text', TextInput: 'TextInput', View: 'View',
  };
  const context = {
    exports: {},
    require(name) {
      if (name === 'expo-web-browser') return { maybeCompleteAuthSession() {} };
      if (name === './src/mobileOAuth') return mobileRequire('./src/mobileOAuth.ts');
      const imports = {
        react,
        'react/jsx-runtime': { jsx: element, jsxs: element },
        'react-native': native,
        './src/supabase': { supabase: {} },
        './src/focus': {},
        './src/notifications': {},
        './src/WebFeatureScreen': { WebFeatureScreen: 'WebFeatureScreen' },
        './src/FocusStatusPanel': { FocusStatusPanel: 'FocusStatusPanel' },
        './src/AppUpdatePanel': { AppUpdatePanel: 'AppUpdatePanel' },
        './src/useAppUpdate': { useAppUpdate: () => ({}) },
      };
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
  };
  runInNewContext(compiled, context, { timeout: 1000 });
  const App = context.exports.default;
  stateIndex = 0;
  App();
  states[0] = { user: { id: 'user-1' } };
  states[5] = nowMs;
  states[8] = session ? [session] : [];
  states[22] = false;
  states[33] = true; // Exercise the retained native study fallback.
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return App();
  };
  return { render, setNow(value) { states[5] = value; } };
}

function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';
  return [node.props?.children].flat(Infinity).map(textOf).join('');
}

const baseSession = {
  id: 'study-1', started_at: '2026-09-29T12:00:00.000Z',
  ended_at: null, duration_seconds: 0, status: 'active',
  lease_expires_at: '2026-09-29T12:10:00.000Z',
  paused_at: null, paused_seconds: 0,
};

test('active Android session shows a ticking study clock, not just completed study', () => {
  const room = renderStudyRoom(baseSession, Date.parse('2026-09-29T12:01:30.000Z'));
  assert.match(textOf(room.render()), /00:01:30.*현재 세션 공부/s);
  room.setNow(Date.parse('2026-09-29T12:01:31.000Z'));
  assert.match(textOf(room.render()), /00:01:31.*현재 세션 공부/s);
});

test('Android session study clock excludes elapsed and ongoing breaks', () => {
  const room = renderStudyRoom({
    ...baseSession,
    paused_at: '2026-09-29T12:01:00.000Z',
    paused_seconds: 15,
  }, Date.parse('2026-09-29T12:01:10.000Z'));
  assert.match(textOf(room.render()), /00:00:45.*현재 세션 공부/s);
  room.setNow(Date.parse('2026-09-29T12:01:30.000Z'));
  assert.match(textOf(room.render()), /00:00:45.*현재 세션 공부/s);
});

test('Android session study clock stops at the server lease deadline', () => {
  const room = renderStudyRoom({
    ...baseSession,
    lease_expires_at: '2026-09-29T12:01:00.000Z',
  }, Date.parse('2026-09-29T12:02:00.000Z'));
  assert.match(textOf(room.render()), /00:01:00.*현재 세션 공부/s);
});
