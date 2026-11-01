import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesktopAuth } from '../src/desktopAuth.mjs';
import { createLoopbackCallback } from '../src/desktopLoopback.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(t, { ttlMs = 300000 } = {}) {
  const values = new Map();
  const opened = [];
  const codes = [];
  const receivers = [];
  const requestedRedirects = [];
  let user = null;
  let listener;
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
  const sdk = { supabaseUrl: 'https://project.supabase.co', auth: {
    onAuthStateChange: fn => { listener = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    getUser: async () => ({ data: { user }, error: null }),
    signInWithOAuth: async ({ provider, options }) => { requestedRedirects.push(options.redirectTo); return { data: { url: `https://project.supabase.co/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(options.redirectTo)}&code_challenge=syntheticChallenge&code_challenge_method=s256` }, error: null }; },
    signInWithOtp: async () => ({ data: {}, error: null }),
    exchangeCodeForSession: async code => { codes.push(code); user = { id: 'test-user' }; return { data: { user, session: { user } }, error: null }; },
    signOut: async () => { user = null; listener?.('SIGNED_OUT', null); return { error: null }; },
  } };
  const dependencies = { supabase: sdk, storage, openExternal: async url => { opened.push(url); },
    createProviderCallback: options => { const receiver = createLoopbackCallback({ ...options, ttlMs }); receivers.push(receiver); return receiver; } };
  const auth = createDesktopAuth(dependencies);
  t.after(() => { auth.dispose(); for (const receiver of receivers) receiver.close(); });
  return { auth, dependencies, sdk, storage, values, opened, codes, receivers,
    redirect: () => requestedRedirects.at(-1) };
}

test('Google opens only its owned browser entry while PKCE keeps the original callback', async t => {
  const f = fixture(t);
  await f.auth.signInProvider('google');
  assert.equal(f.opened.length, 1);
  assert.equal(f.opened[0], f.redirect().replace('/auth/callback/', '/auth/start/'));
  assert.match(f.opened[0], /^http:\/\/127\.0\.0\.1:\d+\/auth\/start\/[a-f0-9]{64}$/);
  const entry = await fetch(f.opened[0]);
  assert.equal(entry.status, 200);
  assert.match(await entry.text(), /Google로 계속/);
  assert.deepEqual(f.codes, []);
  assert.equal((await fetch(`${f.redirect()}?code=synthetic-entry-login`)).status, 200);
  assert.deepEqual(f.codes, ['synthetic-entry-login']);
});

test('an expired receiver cannot fall back to an unmanaged provider browser tab', async t => {
  const f = fixture(t, { ttlMs: 20 });
  const original = f.sdk.auth.signInWithOAuth;
  const started = deferred(), release = deferred();
  f.sdk.auth.signInWithOAuth = async args => { const result = await original(args); started.resolve(); await release.promise; return result; };
  const operation = f.auth.signInProvider('google');
  await started.promise;
  await new Promise(resolve => setTimeout(resolve, 50));
  release.resolve();
  await assert.rejects(operation, { message: 'AUTH_CHANGED' });
  assert.deepEqual(f.opened, []);
  assert.deepEqual(f.codes, []);
  assert.equal(f.values.has('desktop-pkce-pending-v1'), false);
});

test('Google uses its owned dynamic callback and exchanges only through that live listener', async t => {
  const f = fixture(t);
  await f.auth.signInProvider('google');
  assert.match(f.redirect(), /^http:\/\/127\.0\.0\.1:\d+\/auth\/callback\/[a-f0-9]{64}$/);
  await assert.rejects(f.auth.handleCallback('studyroom-desktop://auth/callback?code=unbound'), { message: 'INVALID_CALLBACK' });
  assert.deepEqual(f.codes, []);
  const response = await fetch(`${f.redirect()}?code=synthetic-loopback-code`);
  assert.equal(response.status, 200);
  assert.deepEqual(f.codes, ['synthetic-loopback-code']);
  assert.deepEqual(await f.auth.status(), { userId: 'test-user' });
});

for (const action of ['signOut', 'sendCode', 'dispose', 'storageFailed']) {
  test(`${action} closes the pending loopback without authenticating`, async t => {
    const f = fixture(t);
    await f.auth.signInProvider('google');
    const redirect = f.redirect();
    assert.match(redirect, /^http:\/\/127\.0\.0\.1:/);
    if (action === 'sendCode') await f.auth.sendCode('test@example.test');
    else await f.auth[action]();
    await assert.rejects(fetch(`${redirect}?code=late-code`));
    assert.deepEqual(f.codes, []);
  });
}

test('expiry clears intent and a fresh Google request gets a different callback', async t => {
  const f = fixture(t, { ttlMs: 30 });
  await f.auth.signInProvider('google');
  const old = f.redirect();
  assert.match(old, /^http:\/\/127\.0\.0\.1:/);
  await new Promise(resolve => setTimeout(resolve, 50));
  await assert.rejects(fetch(`${old}?code=expired`));
  assert.equal(f.values.has('desktop-pkce-pending-v1'), false);
  await f.auth.signInProvider('google');
  assert.notEqual(f.redirect(), old);
});

test('logout during a loopback exchange cannot restore a late native session', async t => {
  const f = fixture(t);
  const gate = deferred(); const started = deferred();
  f.sdk.auth.exchangeCodeForSession = async () => { started.resolve(); return gate.promise; };
  await f.auth.signInProvider('google');
  assert.match(f.redirect(), /^http:\/\/127\.0\.0\.1:/);
  const callback = fetch(`${f.redirect()}?code=synthetic-delayed-code`);
  await started.promise;
  await f.auth.signOut();
  gate.resolve({ data: { user: { id: 'test-user' }, session: { user: { id: 'test-user' } } }, error: null });
  assert.equal((await callback).status, 400);
  assert.deepEqual(await f.auth.status(), { userId: null });
  assert.equal(f.values.get('desktop-signed-out-v1'), '1');
});

test('a loopback pending intent cannot be consumed as a legacy callback after restart', async t => {
  const f = fixture(t);
  await f.auth.signInProvider('google');
  assert.match(f.redirect(), /^http:\/\/127\.0\.0\.1:/);
  f.auth.dispose();
  const next = createDesktopAuth(f.dependencies);
  t.after(() => next.dispose());
  await assert.rejects(next.handleCallback('studyroom-desktop://auth/callback?code=old-flow'), { message: 'INVALID_CALLBACK' });
  assert.deepEqual(f.codes, []);
});

test('authorization URL tampering cannot replace the owned callback or open the browser', async t => {
  const f = fixture(t);
  f.sdk.auth.signInWithOAuth = async ({ options }) => {
    assert.match(options.redirectTo, /^http:\/\/127\.0\.0\.1:/);
    return { data: { url: 'https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2F127.0.0.1%3A9%2Fauth%2Fcallback%2Fwrong&code_challenge=x&code_challenge_method=s256' }, error: null };
  };
  await assert.rejects(f.auth.signInProvider('google'), { message: 'AUTH_FAILED' });
  assert.equal(f.opened.length, 0);
  await assert.rejects(fetch(`${await f.receivers[0].ready}?code=x`));
});

test('a receiver startup failure does not strand auth or prevent a deliberate retry', async t => {
  const f = fixture(t);
  f.auth.dispose();
  let first = true;
  const next = createDesktopAuth({ ...f.dependencies, createProviderCallback: options => {
    if (first) { first = false; throw Error('synthetic-listen-failure'); }
    return f.dependencies.createProviderCallback(options);
  } });
  t.after(() => next.dispose());
  await assert.rejects(next.signInProvider('google'), { message: 'AUTH_FAILED' });
  await next.signInProvider('google');
  assert.match(f.redirect(), /^http:\/\/127\.0\.0\.1:/);
});

test('a stale callback preflight cannot clear a newer Google intent or close its receiver', async t => {
  const f = fixture(t);
  const gate = deferred(); const checking = deferred();
  let reads = 0;
  f.sdk.auth.getUser = async () => {
    reads += 1;
    if (reads === 2) { checking.resolve(); return gate.promise; }
    return { data: { user: null }, error: null };
  };
  await f.auth.signInProvider('google');
  const old = fetch(`${f.redirect()}?code=synthetic-stale-code`);
  await checking.promise;
  await f.auth.signInProvider('google');
  const current = f.redirect();
  gate.resolve({ data: { user: null }, error: null });
  assert.equal((await old).status, 400);
  assert.equal(f.values.has('desktop-pkce-pending-v1'), true);
  assert.equal((await fetch(`${current}?code=synthetic-current-code`)).status, 200);
  assert.deepEqual(f.codes, ['synthetic-current-code']);
});
