import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../src/desktopAuth.mjs').catch(() => ({}));
const callback = 'studyroom-desktop://auth/callback';
const authorize = 'https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=studyroom-desktop%3A%2F%2Fauth%2Fcallback&code_challenge=challenge&code_challenge_method=s256';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
  const values = new Map();
  let user = { id: 'user-1' };
  let listener;
  const calls = [];
  const storage = { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
  const supabase = { supabaseUrl: 'https://project.supabase.co',
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: user ? { user, access_token: 'native-private' } : null }, error: null }),
      signInWithOtp: async options => { calls.push(['send', options]); return { data: {}, error: null }; },
      verifyOtp: async options => { calls.push(['verify', options]); return { data: { user, session: { user } }, error: null }; },
      signInWithOAuth: async options => { calls.push(['oauth', options]); await storage.setItem('sb-project-auth-token-code-verifier', 'private-verifier'); return { data: { provider: options.provider, url: authorize }, error: null }; },
      exchangeCodeForSession: async code => { calls.push(['exchange', code]); return { data: { user, session: { user } }, error: null }; },
      signOut: async options => { calls.push(['out', options]); user = null; listener?.('SIGNED_OUT', null); return { error: null }; },
      onAuthStateChange: handler => { listener = handler; return { data: { subscription: { unsubscribe: () => { listener = null; } } } }; },
    },
    functions: { invoke: async (name, options) => {
      calls.push(['ticket', name, options]);
      return { data: { token_hash: 'one-use-hash', user_id: 'user-1', verification_type: 'magiclink' }, error: null };
    } },
  };
  return { supabase, storage, calls, values, opened: [], now: () => 1000,
    openExternal: async url => calls.push(['open', url]), onChange: () => calls.push(['change']),
    emit: (event, nextUser) => { user = nextUser; listener?.(event, nextUser ? { user: nextUser } : null); } };
}
function auth(deps) {
  assert.equal(typeof module.createDesktopAuth, 'function', 'desktop auth feature must exist');
  return module.createDesktopAuth(deps);
}

test('native status verifies the user and returns no tokens', async () => {
  const deps = fixture();
  const client = auth(deps);
  assert.deepEqual(await client.status(), { userId: 'user-1' });
  client.dispose();
});

test('email login uses 8-digit OTP and hides raw provider errors', async () => {
  const deps = fixture();
  const client = auth(deps);
  assert.deepEqual(await client.sendCode('user@example.test'), { sent: true });
  assert.deepEqual(await client.verifyCode('user@example.test', '12345678'), { userId: 'user-1' });
  assert.deepEqual(deps.calls.find(call => call[0] === 'verify')[1], { email: 'user@example.test', token: '12345678', type: 'email' });
  await assert.rejects(client.verifyCode('user@example.test', '123'), { message: 'BAD_REQUEST' });
  deps.supabase.auth.signInWithOtp = async () => ({ error: new Error('secret-provider-detail') });
  await assert.rejects(client.sendCode('user@example.test'), { message: 'AUTH_FAILED' });
  client.dispose();
});

test('ticket uses current verified identity and authenticated existing function', async () => {
  const deps = fixture();
  const client = auth(deps);
  assert.deepEqual(await client.webTicket('req-1'), { type: 'STUDY_WEB_AUTH_TICKET', requestId: 'req-1', userId: 'user-1', tokenHash: 'one-use-hash' });
  const call = deps.calls.find(call => call[0] === 'ticket');
  assert.equal(call[1], 'mobile-web-auth');
  assert.equal(call[2].headers.Authorization, 'Bearer native-private');
  client.dispose();
});

test('malformed or cross-user tickets and session mismatch fail closed', async () => {
  for (const ticket of [{ token_hash: '', user_id: 'user-1', verification_type: 'magiclink' },
    { token_hash: 'hash', user_id: 'other', verification_type: 'magiclink' },
    { token_hash: 'hash', user_id: 'user-1', verification_type: 'signup' }]) {
    const deps = fixture();
    deps.supabase.functions.invoke = async () => ({ data: ticket, error: null });
    const client = auth(deps);
    await assert.rejects(client.webTicket('req'), { message: 'AUTH_FAILED' });
    client.dispose();
  }
  const deps = fixture();
  deps.supabase.auth.getSession = async () => ({ data: { session: { user: { id: 'other' }, access_token: 'private' } }, error: null });
  const client = auth(deps);
  await assert.rejects(client.webTicket('req'), { message: 'AUTH_CHANGED' });
  assert.equal(deps.calls.some(call => call[0] === 'ticket'), false);
  client.dispose();
});

test('logout during ticket issuance never releases an old identity ticket', async () => {
  const deps = fixture();
  const gate = deferred();
  const started = deferred();
  deps.supabase.functions.invoke = async () => { started.resolve(); return gate.promise; };
  const client = auth(deps);
  const pending = client.webTicket('req');
  await started.promise;
  await client.signOut();
  gate.resolve({ data: { token_hash: 'hash', user_id: 'user-1', verification_type: 'magiclink' }, error: null });
  await assert.rejects(pending, { message: 'AUTH_CHANGED' });
  assert.deepEqual(await client.status(), { userId: null });
  client.dispose();
});

test('PKCE opens only the configured authorize endpoint with exact redirect', async () => {
  const deps = fixture();
  const client = auth(deps);
  assert.deepEqual(await client.signInProvider('google'), { opened: true });
  assert.equal(deps.calls.find(call => call[0] === 'oauth')[1].options.skipBrowserRedirect, true);
  assert.equal(deps.calls.find(call => call[0] === 'oauth')[1].options.redirectTo, callback);
  assert.equal(deps.calls.find(call => call[0] === 'open')[1], authorize);
  client.dispose();
  for (const url of ['https://evil.test/auth/v1/authorize', 'https://project.supabase.co/evil',
    authorize.replace('provider=google', 'provider=github'), authorize.replace('redirect_to=', 'wrong_redirect='),
    authorize.replace('https:', 'http:'), `${authorize}#access_token=private`]) {
    const bad = fixture();
    bad.supabase.auth.signInWithOAuth = async () => ({ data: { url }, error: null });
    const blocked = auth(bad);
    await assert.rejects(blocked.signInProvider('google'), { message: 'AUTH_FAILED' });
    assert.equal(bad.calls.some(call => call[0] === 'open'), false);
    blocked.dispose();
  }
});

test('one persisted pending PKCE attempt survives restart, exchanges once and rejects replay', async () => {
  const deps = fixture();
  const first = auth(deps);
  await first.signInProvider('google');
  first.dispose();
  const resumed = auth(deps);
  assert.deepEqual(await resumed.handleCallback(`${callback}?code=once`), { userId: 'user-1' });
  await assert.rejects(resumed.handleCallback(`${callback}?code=once`), { message: 'INVALID_CALLBACK' });
  assert.equal(deps.calls.filter(call => call[0] === 'exchange').length, 1);
  resumed.dispose();
});

test('callback without pending, expired attempt and account change never exchange', async () => {
  const empty = fixture();
  const noPending = auth(empty);
  await assert.rejects(noPending.handleCallback(`${callback}?code=once`), { message: 'INVALID_CALLBACK' });
  noPending.dispose();
  for (const change of ['expired', 'account']) {
    const deps = fixture();
    let clock = 1000;
    deps.now = () => clock;
    const client = auth(deps);
    await client.status();
    await client.signInProvider('google');
    if (change === 'expired') clock = 301001;
    else deps.emit('SIGNED_IN', { id: 'other' });
    await assert.rejects(client.handleCallback(`${callback}?code=once`), { message: 'INVALID_CALLBACK' });
    assert.equal(deps.calls.some(call => call[0] === 'exchange'), false);
    client.dispose();
  }
});

test('logout during code exchange discards response and clears restored native session', async () => {
  const deps = fixture();
  const gate = deferred();
  const started = deferred();
  deps.supabase.auth.exchangeCodeForSession = async () => { started.resolve(); return gate.promise; };
  const client = auth(deps);
  await client.signInProvider('google');
  const exchanging = client.handleCallback(`${callback}?code=once`);
  await started.promise;
  await client.signOut();
  gate.resolve({ data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } }, error: null });
  await assert.rejects(exchanging, { message: 'AUTH_CHANGED' });
  assert.deepEqual(await client.status(), { userId: null });
  assert.equal(deps.calls.filter(call => call[0] === 'out').length >= 2, true);
  client.dispose();
});

test('logout during email verification cannot revive the identity', async () => {
  const deps = fixture();
  const gate = deferred();
  deps.supabase.auth.verifyOtp = () => gate.promise;
  const client = auth(deps);
  const verifying = client.verifyCode('user@example.test', '12345678');
  await new Promise(resolve => setImmediate(resolve));
  await client.signOut();
  gate.resolve({ data: { user: { id: 'user-1' } }, error: null });
  await assert.rejects(verifying, { message: 'AUTH_CHANGED' });
  assert.deepEqual(await client.status(), { userId: null });
  client.dispose();
});

test('pending storage failure does not open provider and hung calls have bounded timeout', async () => {
  const deps = fixture();
  deps.storage.setItem = async () => { throw new Error('secret-disk-detail'); };
  const client = auth(deps);
  await assert.rejects(client.signInProvider('google'), { message: 'AUTH_FAILED' });
  assert.equal(deps.calls.some(call => call[0] === 'open'), false);
  client.dispose();
  const hung = fixture();
  hung.supabase.auth.getUser = () => new Promise(() => {});
  const bounded = auth({ ...hung, timeoutMs: 20 });
  await assert.rejects(bounded.webTicket('req'), { message: 'AUTH_TIMEOUT' });
  bounded.dispose();
});

test('logout while email verification is preparing cannot start a later authentication', async () => {
  const deps = fixture();
  const gate = deferred();
  const started = deferred();
  const remove = deps.storage.removeItem;
  let first = true;
  deps.storage.removeItem = async key => {
    if (first) { first = false; started.resolve(); await gate.promise; }
    return remove(key);
  };
  const client = auth(deps);
  const verifying = client.verifyCode('user@example.test', '12345678');
  await started.promise;
  await client.signOut();
  gate.resolve();
  await assert.rejects(verifying, { message: 'AUTH_CHANGED' });
  assert.equal(deps.calls.some(call => call[0] === 'verify'), false);
  client.dispose();
});

test('a timed-out authentication cleans a late SDK session and cannot overlap another login', async () => {
  const deps = fixture();
  const gate = deferred();
  deps.supabase.auth.verifyOtp = () => gate.promise;
  const client = auth({ ...deps, timeoutMs: 20 });
  await assert.rejects(client.verifyCode('user@example.test', '12345678'), { message: 'AUTH_TIMEOUT' });
  await assert.rejects(client.verifyCode('user@example.test', '12345678'), { message: 'AUTH_BUSY' });
  gate.resolve({ data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } }, error: null });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(deps.calls.some(call => call[0] === 'out'), true);
  assert.deepEqual(await client.status(), { userId: null });
  client.dispose();
});

test('R1 raw SDK rejection after invalidation still owns cleanup and cannot release its pending logout',{timeout:5000},async t=>{
  const deps=fixture();const started=deferred(),cleanupStarted=deferred(),cleanup=deferred();
  let rejectRaw;const raw=new Promise((_,reject)=>{rejectRaw=reject;});
  deps.supabase.auth.verifyOtp=()=>{started.resolve();return raw;};
  const initialSignOut=deps.supabase.auth.signOut;let outCount=0;
  deps.supabase.auth.signOut=async options=>{
    if(++outCount===2){cleanupStarted.resolve();await cleanup.promise;}
    return initialSignOut(options);
  };
  const client=auth({...deps,timeoutMs:40});t.after(()=>{cleanup.resolve();client.dispose();});
  const abandoned=client.verifyCode('user@example.test','12345678').then(value=>({value}),error=>({error:error.message}));
  await started.promise;await client.signOut();
  deps.emit('SIGNED_IN',{id:'late-user'});rejectRaw(Error('private SDK failure after side effects'));
  await cleanupStarted.promise;
  assert.deepEqual(await abandoned,{error:'AUTH_TIMEOUT'});
  await assert.rejects(client.verifyCode('user@example.test','12345678'),{message:'AUTH_BUSY'});
  assert.equal(outCount,2);assert.equal(deps.values.get('desktop-signed-out-v1'),'1');
  cleanup.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await client.status(),{userId:null});
  deps.supabase.auth.verifyOtp=async()=>{deps.emit('SIGNED_IN',{id:'deliberate-user'});return {data:{user:{id:'deliberate-user'}},error:null};};
  assert.deepEqual(await client.verifyCode('user@example.test','12345678'),{userId:'deliberate-user'});
  assert.deepEqual(await client.status(),{userId:'deliberate-user'});
});

test('logout still clears SDK credentials when pending-intent disk removal fails', async () => {
  const deps = fixture();
  deps.storage.removeItem = async () => { throw new Error('sensitive filesystem failure'); };
  const client = auth(deps);
  await assert.rejects(client.signOut(), { message: 'AUTH_FAILED' });
  assert.equal(deps.calls.some(call => call[0] === 'out'), true);
  assert.deepEqual(await client.status(), { userId: null });
  client.dispose();
});

test('a persisted logged-out marker prevents revival if SDK logout fails', async () => {
  const deps = fixture();
  deps.supabase.auth.signOut = async () => ({ error: new Error('private network failure') });
  const first = auth(deps);
  await assert.rejects(first.signOut(), { message: 'AUTH_FAILED' });
  first.dispose();
  const restarted = auth(deps);
  assert.deepEqual(await restarted.status(), { userId: null });
  await assert.rejects(restarted.webTicket('req'), { message: 'AUTH_CHANGED' });
  restarted.dispose();
});

test('pending callback cannot be exchanged twice concurrently', async () => {
  const deps = fixture();
  const gate = deferred();
  deps.supabase.auth.exchangeCodeForSession = async code => { deps.calls.push(['exchange', code]); return gate.promise; };
  const client = auth(deps);
  await client.signInProvider('google');
  const first = client.handleCallback(`${callback}?code=once`);
  const second = client.handleCallback(`${callback}?code=another`);
  const rejected = assert.rejects(second, { message: 'INVALID_CALLBACK' });
  await new Promise(resolve => setImmediate(resolve));
  gate.resolve({ data: { user: { id: 'user-1' } }, error: null });
  await Promise.all([first, rejected]);
  assert.equal(deps.calls.filter(call => call[0] === 'exchange').length, 1);
  client.dispose();
});

test('an account ABA event invalidates an already issued ticket response', async () => {
  const deps = fixture();
  const started = deferred();
  const gate = deferred();
  deps.supabase.functions.invoke = async () => { started.resolve(); return gate.promise; };
  const client = auth(deps);
  const ticket = client.webTicket('req');
  await started.promise;
  deps.emit('SIGNED_IN', { id: 'other' });
  deps.emit('SIGNED_IN', { id: 'user-1' });
  gate.resolve({ data: { token_hash: 'hash', user_id: 'user-1', verification_type: 'magiclink' }, error: null });
  await assert.rejects(ticket, { message: 'AUTH_CHANGED' });
  client.dispose();
});

test('failed OTP cannot release an explicit logout block or ticket stale SDK identity', async () => {
  const deps = fixture();
  deps.supabase.auth.signOut = async () => ({ error: new Error('network failure') });
  deps.supabase.auth.verifyOtp = async () => ({ data: { user: null, session: null }, error: new Error('invalid code') });
  const client = auth(deps);
  await assert.rejects(client.signOut(), { message: 'AUTH_FAILED' });
  await assert.rejects(client.verifyCode('user@example.test', '00000000'), { message: 'AUTH_FAILED' });
  assert.deepEqual(await client.status(), { userId: null });
  await assert.rejects(client.webTicket('stale'), { message: 'AUTH_CHANGED' });
  assert.equal(deps.calls.some(call => call[0] === 'ticket'), false);
  assert.equal(deps.values.get('desktop-signed-out-v1'), '1');
  deps.supabase.auth.verifyOtp = async () => ({ data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } }, error: null });
  assert.deepEqual(await client.verifyCode('user@example.test', '12345678'), { userId: 'user-1' });
  assert.equal(deps.values.has('desktop-signed-out-v1'), false);
  assert.deepEqual(await client.status(), { userId: 'user-1' });
  client.dispose();
});

test('OAuth timeout quarantines its shared verifier until late completion before allowing a retry', async () => {
  const deps = fixture();
  const gate = deferred();
  let attempts = 0;
  deps.supabase.auth.signInWithOAuth = async () => {
    const attempt = ++attempts;
    if (attempt === 1) await gate.promise;
    await deps.storage.setItem('sb-project-auth-token-code-verifier', `verifier-${attempt}`);
    return { data: { provider: 'google', url: authorize }, error: null };
  };
  const client = auth({ ...deps, timeoutMs: 20 });
  await assert.rejects(client.signInProvider('google'), { message: 'AUTH_TIMEOUT' });
  await assert.rejects(client.signInProvider('google'), { message: 'AUTH_BUSY' });
  await assert.rejects(client.verifyCode('user@example.test', '12345678'), { message: 'AUTH_BUSY' });
  await assert.rejects(client.sendCode('user@example.test'), { message: 'AUTH_BUSY' });
  assert.equal(attempts, 1);
  assert.equal(deps.calls.some(call => call[0] === 'open'), false);
  gate.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(deps.values.has('desktop-pkce-pending-v1'), false);
  await assert.rejects(client.handleCallback(`${callback}?code=late`), { message: 'INVALID_CALLBACK' });
  assert.deepEqual(await client.signInProvider('google'), { opened: true });
  assert.equal(deps.values.get('sb-project-auth-token-code-verifier'), 'verifier-2');
  assert.equal(deps.calls.filter(call => call[0] === 'open').length, 1);
  client.dispose();
});

test('OAuth failure releases quarantine only after SDK rejection and permits a clean retry', async () => {
  const deps = fixture();
  let rejectOld;
  const old = new Promise((_, reject) => { rejectOld = reject; });
  let attempts = 0;
  deps.supabase.auth.signInWithOAuth = async () => {
    if (++attempts === 1) return old;
    return { data: { provider: 'google', url: authorize }, error: null };
  };
  const client = auth({ ...deps, timeoutMs: 20 });
  await assert.rejects(client.signInProvider('google'), { message: 'AUTH_TIMEOUT' });
  await assert.rejects(client.signInProvider('google'), { message: 'AUTH_BUSY' });
  rejectOld(new Error('late provider failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await client.signInProvider('google'), { opened: true });
  client.dispose();
});

test('timed-out late authentication with failed SDK cleanup stays blocked across restart until deliberate success', async () => {
  const deps = fixture();
  deps.emit('SIGNED_OUT', null);
  const gate = deferred();
  deps.supabase.auth.verifyOtp = async () => {
    await gate.promise;
    deps.emit('SIGNED_IN', { id: 'late-user' });
    return { data: { user: { id: 'late-user' }, session: { user: { id: 'late-user' } } }, error: null };
  };
  deps.supabase.auth.signOut = async () => ({ error: new Error('cleanup unavailable') });
  const first = auth({ ...deps, timeoutMs: 20 });
  await assert.rejects(first.verifyCode('user@example.test', '12345678'), { message: 'AUTH_TIMEOUT' });
  gate.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await first.status(), { userId: null });
  first.dispose();
  const restarted = auth(deps);
  assert.deepEqual(await restarted.status(), { userId: null });
  assert.equal(deps.values.get('desktop-signed-out-v1'), '1');
  await assert.rejects(restarted.webTicket('cancelled'), { message: 'AUTH_CHANGED' });
  deps.supabase.auth.verifyOtp = async () => ({ data: { user: { id: 'late-user' }, session: { user: { id: 'late-user' } } }, error: null });
  assert.deepEqual(await restarted.verifyCode('user@example.test', '12345678'), { userId: 'late-user' });
  assert.deepEqual(await restarted.status(), { userId: 'late-user' });
  assert.equal(deps.values.has('desktop-signed-out-v1'), false);
  restarted.dispose();
});

test('timed-out email-code preparation retains verifier ownership until its SDK operation settles', async () => {
  const deps = fixture();
  const gate = deferred();
  deps.supabase.auth.signInWithOtp = async () => {
    await gate.promise;
    await deps.storage.setItem('sb-project-auth-token-code-verifier', 'email-verifier');
    return { data: {}, error: null };
  };
  const client = auth({ ...deps, timeoutMs: 20 });
  await assert.rejects(client.sendCode('user@example.test'), { message: 'AUTH_TIMEOUT' });
  await assert.rejects(client.signInProvider('google'), { message: 'AUTH_BUSY' });
  await assert.rejects(client.sendCode('user@example.test'), { message: 'AUTH_BUSY' });
  gate.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(deps.values.has('desktop-pkce-pending-v1'), false);
  assert.deepEqual(await client.signInProvider('google'), { opened: true });
  assert.equal(deps.values.get('sb-project-auth-token-code-verifier'), 'private-verifier');
  client.dispose();
});
