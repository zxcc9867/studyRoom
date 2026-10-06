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
const appPath = path.join(root, 'apps/mobile/App.tsx');
const todoId = '11111111-1111-4111-8111-111111111111';
const recoveryId = '22222222-2222-4222-8222-222222222222';

function mountApp({ pending = [], startError = null, latePending = null } = {}) {
  const { transformSync } = mobileRequire('@babel/core');
  const compiled = transformSync(readFileSync(appPath, 'utf8'), {
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
  const refs = [];
  let effects = [];
  const calls = { start: 0, submit: 0, startArgs: null, submitArgs: null, alerts: [] };
  let hookIndex = 0;
  let refIndex = 0;
  const element = (type, props) => ({ type, props });
  const react = {
    useState(initial) {
      const index = hookIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect(callback) { effects.push(callback); },
    useMemo(callback) { return callback(); },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
  };
  const native = {
    ActivityIndicator: 'ActivityIndicator', Alert: { alert(...args) { calls.alerts.push(args); } },
    AppState: {}, Modal: 'Modal', Pressable: 'Pressable', SafeAreaView: 'SafeAreaView',
    ScrollView: 'ScrollView', StyleSheet: { create: (styles) => styles },
    StatusBar: 'StatusBar', Text: 'Text', TextInput: 'TextInput', View: 'View',
  };
  const recoveryRows = [...pending];
  const supabase = {
    from(table) {
      const rows = {
        study_recovery_requests: recoveryRows,
        profiles: { user_id: 'user-1', time_zone: 'UTC', reminder_time: '20:30:00' },
        attendance_days: null,
        study_sessions: [],
        study_todos: states[9] ?? [],
        study_session_todos: [],
      };
      assert.ok(table in rows, `Unexpected table: ${table}`);
      const result = { data: rows[table], error: null };
      const query = {
        select() { return query; }, eq() { return query; }, in() { return query; }, order() { return query; },
        limit() { return query; }, maybeSingle() { return Promise.resolve(result); },
        then(resolve) { return Promise.resolve(result).then(resolve); },
      };
      return query;
    },
    functions: { async invoke() { return { error: null }; } },
    async rpc(name, args) {
      if (name === 'start_study_session') {
        calls.start += 1;
        calls.startArgs = args;
        if (startError && latePending) recoveryRows.push(latePending);
        return { data: null, error: startError };
      }
      if (name === 'submit_study_recovery_request') {
        calls.submit += 1;
        calls.submitArgs = args;
        const index = recoveryRows.findIndex((row) => row.id === args.p_request_id);
        if (index >= 0) recoveryRows.splice(index, 1);
        return { data: { status: 'submitted' }, error: null };
      }
      if (name === 'get_study_period_summary') return { data: [{ completed_seconds: 0 }], error: null };
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const context = {
    exports: {},
    require(name) {
      if (name === '../../packages/core/src/index.mjs') return studyCore;
      if (name === 'expo-web-browser') return { maybeCompleteAuthSession() {} };
      if (name === './src/mobileOAuth') return mobileRequire('./src/mobileOAuth.ts');
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (name === 'react-native') return native;
      if (name === './src/supabase') return { supabase };
      if (name === './src/focus') return { async reconcileStudyFocus() { return null; } };
      if (name === './src/notifications') return {};
      if (name === './src/WebFeatureScreen') return { WebFeatureScreen: 'WebFeatureScreen' };
      if (name === './src/FocusStatusPanel') return { FocusStatusPanel: 'FocusStatusPanel' };
      if (name === './src/AppUpdatePanel') return { AppUpdatePanel: 'AppUpdatePanel' };
      if (name === './src/NativeAppSettingsPanel') return { NativeAppSettingsPanel: 'NativeAppSettingsPanel' };
      if (name === './src/readAppSettingsSnapshot') return { readAppSettingsSnapshot: async () => null };
      if (name === './src/useAppUpdate') return { useAppUpdate: () => ({}) };
      throw new Error(`Unexpected App import: ${name}`);
    },
  };
  runInNewContext(compiled, context, { timeout: 1000 });
  const App = context.exports.default;
  const render = () => { hookIndex = 0; refIndex = 0; effects = []; return App(); };
  render();
  states[0] = { user: { id: 'user-1' } };
  states[9] = [{ id: todoId, user_id: 'user-1', local_date: new Date().toISOString().slice(0, 10), title: '클로드 공부', is_completed: false, position: 0 }];
  states[12] = [todoId];
  states[22] = false;
  states[33] = true; // Exercise the retained native study fallback.
  return { render, calls, states, runSessionEffect: async () => { effects[1](); await new Promise((resolve) => setImmediate(resolve)); } };
}

function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';
  return [node.props?.children].flat(Infinity).map(textOf).join('');
}

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}

test('pending recovery opens its form before a mobile study session is started', async () => {
  const app = mountApp({ pending: [{ id: recoveryId, local_date: '2026-06-16', status: 'pending', trigger_type: 'missed_attendance', covered_start_date: '2026-06-16', covered_end_date: '2026-09-28', covered_missed_days: 104 }] });
  const start = find(app.render(), (node) => node.type === 'Pressable' && textOf(node).includes('입장하고 타이머 시작'));
  assert.ok(start);
  await start.props.onPress();
  const modal = find(app.render(), (node) => node.type === 'Modal' && node.props.visible && textOf(node).includes('회복 루틴'));
  assert.ok(modal, 'A pending recovery should be actionable in the app');
  assert.equal(app.calls.start, 0, 'Starting must wait for the recovery submission');
});

test('plain server error objects display their message instead of object Object', async () => {
  const app = mountApp({ startError: { message: 'Session todos must be owned, incomplete, and scheduled for today', code: 'P0001' } });
  const start = find(app.render(), (node) => node.type === 'Pressable' && textOf(node).includes('입장하고 타이머 시작'));
  await start.props.onPress();
  assert.equal(app.calls.start, 1);
  assert.equal(app.calls.alerts.length, 1);
  assert.doesNotMatch(app.calls.alerts[0][1], /\[object Object\]/);
  assert.match(app.calls.alerts[0][1], /할 일|today/i);
});

test('submitting the last recovery resumes the selected study task once', async () => {
  const app = mountApp({ pending: [{ id: recoveryId, local_date: '2026-06-16', status: 'pending', trigger_type: 'missed_attendance', covered_start_date: '2026-06-16', covered_end_date: '2026-09-28', covered_missed_days: 104 }] });
  const start = find(app.render(), (node) => node.type === 'Pressable' && textOf(node).includes('입장하고 타이머 시작'));
  await start.props.onPress();
  let modal = find(app.render(), (node) => node.type === 'Modal' && node.props.visible && textOf(node).includes('회복 루틴'));
  for (const [placeholder, value] of [
    ['결석/이탈 사유', '식사 후 시간을 놓쳤습니다'],
    ['오늘 보충 과제', '클로드 코드 30분 보충'],
    ['내일 재도전 약속', '20시 전에 입장'],
  ]) {
    const input = find(modal, (node) => node.type === 'TextInput' && node.props.placeholder?.includes(placeholder));
    assert.ok(input, `${placeholder} input is required`);
    input.props.onChangeText(value);
    modal = find(app.render(), (node) => node.type === 'Modal' && node.props.visible && textOf(node).includes('회복 루틴'));
  }
  const submit = find(modal, (node) => node.type === 'Pressable' && textOf(node).includes('제출하고'));
  assert.ok(submit);
  await submit.props.onPress();
  assert.equal(app.calls.submit, 1);
  assert.equal(app.calls.submitArgs.p_request_id, recoveryId);
  assert.equal(app.calls.start, 1);
  assert.deepEqual([...app.calls.startArgs.p_todo_ids], [todoId]);
});

test('closing recovery form leaves the session stopped', async () => {
  const app = mountApp({ pending: [{ id: recoveryId, local_date: '2026-06-16', status: 'pending', trigger_type: 'missed_attendance' }] });
  const start = find(app.render(), (node) => node.type === 'Pressable' && textOf(node).includes('입장하고 타이머 시작'));
  await start.props.onPress();
  const modal = find(app.render(), (node) => node.type === 'Modal' && node.props.visible && textOf(node).includes('회복 루틴'));
  find(modal, (node) => node.type === 'Pressable' && textOf(node).includes('나중에')).props.onPress();
  assert.equal(app.calls.start, 0);
  assert.equal(app.calls.submit, 0);
  assert.equal(find(app.render(), (node) => node.type === 'Modal' && node.props.visible && textOf(node).includes('회복 루틴')), null);
});

test('multiple pending routines must all be submitted before the selected study starts', async () => {
  const secondId = '33333333-3333-4333-8333-333333333333';
  const app = mountApp({ pending: [
    { id: recoveryId, local_date: '2026-09-27', status: 'pending', trigger_type: 'missed_attendance' },
    { id: secondId, local_date: '2026-09-28', status: 'pending', trigger_type: 'missed_attendance' },
  ] });
  await find(app.render(), (node) => node.type === 'Pressable' && textOf(node).includes('입장하고 타이머 시작')).props.onPress();
  for (const [requestId, submitCount] of [[recoveryId, 1], [secondId, 2]]) {
    let modal = find(app.render(), (node) => node.type === 'Modal' && node.props.visible && textOf(node).includes('회복 루틴'));
    assert.ok(modal);
    for (const [placeholder, value] of [
      ['결석/이탈 사유', '사유'], ['오늘 보충 과제', '보충 공부'], ['내일 재도전 약속', '다시 시작'],
    ]) {
      find(modal, (node) => node.type === 'TextInput' && node.props.placeholder?.includes(placeholder)).props.onChangeText(value);
      modal = find(app.render(), (node) => node.type === 'Modal' && node.props.visible && textOf(node).includes('회복 루틴'));
    }
    await find(modal, (node) => node.type === 'Pressable' && textOf(node).includes('제출하고')).props.onPress();
    assert.equal(app.calls.submit, submitCount);
    assert.equal(app.calls.submitArgs.p_request_id, requestId);
    assert.equal(app.calls.start, submitCount === 1 ? 0 : 1);
  }
});

test('login data load opens a pending recovery without a manual refresh', async () => {
  const app = mountApp({ pending: [{ id: recoveryId, local_date: '2026-06-16', status: 'pending', trigger_type: 'missed_attendance', covered_start_date: '2026-06-16', covered_end_date: '2026-09-28', covered_missed_days: 104 }] });
  app.render();
  await app.runSessionEffect();
  find(app.render(), (node) => node.type === 'WebFeatureScreen').props.onFallback();
  await new Promise((resolve) => setImmediate(resolve));
  const modal = find(app.render(), (node) => node.type === 'Modal' && node.props.visible && textOf(node).includes('회복 루틴'));
  assert.ok(modal);
  assert.match(textOf(modal), /104/);
  assert.equal(app.calls.start, 0);
});

test('a recovery created between the preflight read and start RPC still opens the form', async () => {
  const latePending = { id: recoveryId, local_date: '2026-09-29', status: 'pending', trigger_type: 'missed_attendance' };
  const app = mountApp({ startError: { message: 'Recovery routine required', code: 'P0001' }, latePending });
  const start = find(app.render(), (node) => node.type === 'Pressable' && textOf(node).includes('입장하고 타이머 시작'));
  await start.props.onPress();
  assert.equal(app.calls.start, 1);
  assert.ok(find(app.render(), (node) => node.type === 'Modal' && node.props.visible && textOf(node).includes('회복 루틴')));
});
