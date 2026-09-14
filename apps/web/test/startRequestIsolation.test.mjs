import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Execute the actual start handler; replace external RPC and already-passed UI gates only.
const source = readFileSync('apps/web/src/main.tsx', 'utf8');
const start = source.indexOf('  async function startTimer(');
const end = source.indexOf('  function planStudyBreakReturn', start);
const { outputText } = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});

function fixture() {
  const writes = [];
  let rejectRequest;
  const response = new Promise((_resolve, reject) => { rejectRequest = reject; });
  const noop = () => {};
  const env = {
    dashboardReady: true,
    currentUserIdRef: { current: 'old-user' },
    session: { user: { id: 'old-user' } },
    sessionStartRequestRef: { current: null },
    dashboardAbortRef: { current: new AbortController() },
    dashboardAttemptRef: { current: 1 },
    setDashboardLoading: noop,
    setDashboardLoadedUserId: (value) => writes.push(['ready', value]),
    setDashboardError: (value) => writes.push(['error', value]),
    normalizeHabitText: (value) => value || '',
    sessionTodoSuggestionRef: { current: null },
    blockingRecoveryRequests: [], activeSession: null, cameraEnabled: true,
    canStartStudySessionWithCamera: () => ({ allowed: true }),
    shouldRequestSessionTodoSelection: () => ({ required: false }),
    incompleteTodayTodos: [{ id: 'todo-1' }],
    setBusy: noop,
    runBoundedRequest: (task) => task(new AbortController().signal),
    supabase: { rpc: () => ({ abortSignal: () => response }) },
    formatError: (error) => error.message,
    setMessage: (value) => writes.push(['message', value]),
    cameraSessionStartingRef: { current: false },
  };
  const handler = new Function(...Object.keys(env), outputText + '; return startTimer;')(...Object.values(env));
  return { env, writes, handler, rejectRequest };
}

test('starting a session invalidates the pre-start dashboard snapshot', async () => {
  const f = fixture();
  const request = f.handler(true, ['todo-1']);
  f.rejectRequest(new Error('simulated disconnected RPC'));
  await request;
  assert.equal(f.env.dashboardAbortRef.current.signal.aborted, true);
  assert.equal(f.env.dashboardAttemptRef.current, 2);
});

test('old-account start failure cannot clear readiness or show errors on the new account', async () => {
  const f = fixture();
  const request = f.handler(true, ['todo-1']);
  f.env.currentUserIdRef.current = 'new-user';
  f.rejectRequest(new Error('late timeout'));
  await request;
  assert.deepEqual(f.writes, []);
});
