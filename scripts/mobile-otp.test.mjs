import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobileRequire = createRequire(path.join(root, 'apps/mobile/package.json'));
const appPath = path.join(root, 'apps/mobile/App.tsx');

test('mobile login keeps all eight OTP digits and verifies that exact code', async () => {
  const { transformSync } = mobileRequire('@babel/core');
  const source = readFileSync(appPath, 'utf8');
  const compiled = transformSync(source, {
    filename: appPath,
    babelrc: false,
    configFile: false,
    presets: [[mobileRequire.resolve('@babel/preset-typescript'), { allExtensions: true, isTSX: true }]],
    plugins: [
      [mobileRequire.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }],
      mobileRequire.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  }).code;

  const states = [];
  let hookIndex = 0;
  const refs = [];
  let refIndex = 0;
  let verifiedToken = null;
  const element = (type, props) => ({ type, props });
  const react = {
    useState(initial) {
      const index = hookIndex++;
      if (!(index in states)) states[index] = initial === true ? false : initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect() {},
    useMemo(callback) { return callback(); },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
  };
  const native = {
    ActivityIndicator: 'ActivityIndicator', Alert: { alert() {} }, AppState: {}, Modal: 'Modal',
    Pressable: 'Pressable', SafeAreaView: 'SafeAreaView', ScrollView: 'ScrollView',
    StyleSheet: { create: (styles) => styles }, StatusBar: 'StatusBar', Text: 'Text',
    TextInput: 'TextInput', View: 'View',
  };
  const supabase = {
    auth: {
      async signInWithOtp() { return { error: null }; },
      async verifyOtp({ token }) { verifiedToken = token; return { error: null }; },
    },
  };
  const context = {
    exports: {},
    require(name) {
      if (name === 'expo-web-browser') return { maybeCompleteAuthSession() {} };
      if (name === './src/mobileOAuth') return mobileRequire('./src/mobileOAuth.ts');
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (name === 'react-native') return native;
      if (name === './src/supabase') return { supabase };
      if (name === './src/focus') return {};
      if (name === './src/notifications') return {};
      if (name === './src/WebFeatureScreen') return { WebFeatureScreen: 'WebFeatureScreen' };
      throw new Error(`Unexpected App import: ${name}`);
    },
  };
  runInNewContext(compiled, context, { timeout: 1000 });
  const App = context.exports.default;
  const render = () => { hookIndex = 0; refIndex = 0; return App(); };
  const find = (tree, predicate) => {
    if (!tree || typeof tree !== 'object') return null;
    if (predicate(tree)) return tree;
    for (const child of [tree.props?.children].flat(Infinity)) {
      const match = find(child, predicate);
      if (match) return match;
    }
    return null;
  };

  let screen = render();
  find(screen, (node) => node.type === 'TextInput' && node.props.keyboardType === 'email-address')
    .props.onChangeText('reader@example.com');
  screen = render();
  await find(screen, (node) => node.type === 'Pressable' && node.props.children?.props?.children === '코드 받기')
    .props.onPress();
  screen = render();
  find(screen, (node) => node.type === 'TextInput' && node.props.textContentType === 'oneTimeCode')
    .props.onChangeText('00224379');
  screen = render();
  const otpInput = find(screen, (node) => node.type === 'TextInput' && node.props.textContentType === 'oneTimeCode');
  assert.equal(otpInput.props.value, '00224379');
  assert.equal(otpInput.props.placeholder, '12345678');
  await find(screen, (node) => node.type === 'Pressable' && node.props.children?.props?.children === '코드로 로그인')
    .props.onPress();
  assert.equal(verifiedToken, '00224379');
});
