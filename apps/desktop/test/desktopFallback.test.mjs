import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createDesktopAuth } from '../src/desktopAuth.mjs';
import { createEncryptedStorage } from '../src/desktopStorage.mjs';
import * as storageModule from '../src/desktopStorage.mjs';

const origin = 'https://desktop-fallback.synthetic.invalid';
const sessionKey = 'sb-desktop-fallback-auth-token';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function syntheticDisk() {
  const files = new Map();
  const operations = [];
  const key = randomBytes(32);
  let failSessionRemoval = false;
  let failNextSessionWrite = false;
  return {
    files, operations,
    setRemovalFailure(value) { failSessionRemoval = value; },
    failNextSessionWrite() { failNextSessionWrite = true; },
    storage(available) {
      return createEncryptedStorage({
        safeStorage: {
          isEncryptionAvailable: () => available,
          encryptString(value) {
            const iv = randomBytes(12);
            const cipher = createCipheriv('aes-256-gcm', key, iv);
            const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
            return Buffer.concat([iv, cipher.getAuthTag(), body]);
          },
          decryptString(value) {
            const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
            decipher.setAuthTag(value.subarray(12, 28));
            return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
          },
        },
        read: async name => { operations.push(['read', name]); return files.get(name) ?? null; },
        write: async (name, value) => {
          operations.push(['write', name]);
          if (failNextSessionWrite && name === sessionKey) {
            failNextSessionWrite = false;
            throw new Error('synthetic write failure');
          }
          files.set(name, value);
        },
        remove: async name => {
          operations.push(['remove', name]);
          if (failSessionRemoval && name === sessionKey) throw new Error('synthetic removal failure');
          files.delete(name);
        },
      });
    },
  };
}

function syntheticAuthHttp() {
  const requests = [];
  const events = [];
  const nativeEvents = [];
  const tokens = new Map();
  let verifyHold = null;
  const logoutHolds = [];
  let observeRefresh = () => {};
  let expirySeconds = 3600;
  const users = {
    A: { id: 'synthetic-user-A', aud: 'authenticated', role: 'authenticated', email: 'a@synthetic.invalid',
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z' },
    B: { id: 'synthetic-user-B', aud: 'authenticated', role: 'authenticated', email: 'b@synthetic.invalid',
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z' },
  };
  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { 'content-type': 'application/json' },
  });
  function session(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + expirySeconds })).toString('base64url');
    const access = `${header}.${payload}.synthetic-not-a-real-signature`;
    tokens.set(access, user);
    return { access_token: access, refresh_token: `synthetic-refresh-${user.id}`,
      token_type: 'bearer', expires_in: expirySeconds, expires_at: Math.floor(Date.now() / 1000) + expirySeconds, user };
  }
  return {
    requests, events, nativeEvents,
    setExpirySeconds(value) { expirySeconds = value; },
    observeRefresh(callback) { observeRefresh = callback; },
    holdVerification(email) {
      const started = deferred();
      const gate = deferred();
      verifyHold = { email, started, gate };
      return { started: started.promise, release: gate.resolve };
    },
    holdLogout() {
      const started = deferred();
      const gate = deferred();
      logoutHolds.push({ started, gate });
      return { started: started.promise, release: gate.resolve };
    },
    async fetch(input, init = {}) {
      const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
      assert.equal(url.origin, origin, 'all SDK requests must use the synthetic injected transport');
      requests.push({ method: init.method, path: url.pathname, scope: url.searchParams.get('scope') });
      if (url.pathname === '/auth/v1/verify' && init.method === 'POST') {
        const body = JSON.parse(init.body);
        assert.equal(body.type, 'email');
        assert.equal(body.token, '12345678');
        const user = body.email === users.A.email ? users.A : body.email === users.B.email ? users.B : null;
        assert.ok(user, 'only synthetic accounts are accepted');
        if (verifyHold?.email === body.email) {
          const hold = verifyHold;
          verifyHold = null;
          hold.started.resolve();
          await hold.gate.promise;
        }
        return json(session(user));
      }
      if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
        observeRefresh();
        const body = JSON.parse(init.body);
        const user = Object.values(users).find(value => body.refresh_token === `synthetic-refresh-${value.id}`);
        assert.ok(user, 'only synthetic refresh credentials are accepted');
        return json(session(user));
      }
      if (url.pathname === '/auth/v1/user') {
        const headers = new Headers(init.headers);
        const user = tokens.get(headers.get('authorization')?.replace(/^Bearer /, ''));
        return user ? json(user) : json({ error: 'invalid synthetic identity' }, 401);
      }
      if (url.pathname === '/auth/v1/logout' && init.method === 'POST') {
        assert.equal(url.searchParams.get('scope'), 'local', 'other devices must not be signed out');
        if (logoutHolds.length) {
          const hold = logoutHolds.shift();
          hold.started.resolve();
          await hold.gate.promise;
        }
        return new Response(null, { status: 204 });
      }
      assert.fail(`unexpected synthetic endpoint: ${url.pathname}`);
    },
  };
}

function native(storage, http, options = {}) {
  let auth;
  const sdkStorage = options.sdkBoundary ? storageModule.createSdkStorage({ storage, onFailure: () => auth?.storageFailed() }) : storage;
  const sdk = createClient(origin, 'sb_publishable_synthetic_test_only', {
    global: { fetch: http.fetch },
    auth: { storage: sdkStorage, storageKey: sessionKey, persistSession: true, flowType: 'pkce',
      detectSessionInUrl: false, autoRefreshToken: false },
  });
  const observer = sdk.auth.onAuthStateChange(event => { http.events.push(event); });
  auth = createDesktopAuth({ supabase: sdk, storage,
    ...options,
    onChange: event => http.nativeEvents.push(event.type),
    openExternal: async () => assert.fail('no provider browser in this test') });
  return {
    auth, sdk,
    async dispose() {
      auth.dispose();
      observer.data.subscription.unsubscribe();
      await sdk.auth.stopAutoRefresh();
    },
  };
}

test('public SDK automatic refresh contains encrypted-write failure and explicitly isolates retry/restart', async t => {
  const disk = syntheticDisk(), http = syntheticAuthHttp(), storage = disk.storage(true);
  const first = native(storage, http, { sdkBoundary: true });
  t.after(() => first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid', '12345678');
  // Alter only the synthetic persisted expiry, then use the public automatic-refresh API.
  const session = JSON.parse(await storage.getItem(sessionKey));
  session.expires_at = Math.floor(Date.now()/1000) + 30;
  await storage.setItem(sessionKey, JSON.stringify(session));
  disk.failNextSessionWrite();
  await first.sdk.auth.startAutoRefresh();
  const deadline = Date.now() + 3000;
  while (storage.secure && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(storage.secure, false);
  assert.deepEqual(await first.auth.status(), { userId: null });
  await assert.rejects(first.auth.webTicket('after-degradation'), { message: 'AUTH_CHANGED' });
  assert.equal(disk.files.has(sessionKey), false, 'owned local cleanup removes stale encrypted A before any retry');
  const beforeRetryRestart = native(disk.storage(true), http, { sdkBoundary: true });
  assert.deepEqual(await beforeRetryRestart.auth.status(), { userId: null });
  await beforeRetryRestart.dispose();
  http.setExpirySeconds(30);
  const before = http.requests.filter(r => r.path === '/auth/v1/token').length;
  assert.deepEqual(await first.auth.verifyCode('b@synthetic.invalid', '12345678'), { userId: 'synthetic-user-B' });
  assert.deepEqual(await first.auth.status(), { userId: 'synthetic-user-B' });
  const retryDeadline = Date.now() + 3000;
  while (http.requests.filter(r => r.path === '/auth/v1/token').length === before && Date.now() < retryDeadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(http.requests.filter(r => r.path === '/auth/v1/token').length > before, 'deliberate memory-only login resumes automatic refresh through public API');
  assert.deepEqual(await first.auth.status(), { userId: 'synthetic-user-B' });
  await first.dispose();
  const restarted = native(disk.storage(true), http, { sdkBoundary: true });
  t.after(() => restarted.dispose());
  assert.deepEqual(await restarted.auth.status(), { userId: null });
});

test('SDK boundary storage degradation quarantines failed cleanup before any deliberate account retry', async t => {
  const disk=syntheticDisk(),http=syntheticAuthHttp(),storage=disk.storage(true);
  const first=native(storage,http,{sdkBoundary:true});t.after(()=>first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid','12345678');
  disk.setRemovalFailure(true);disk.failNextSessionWrite();
  const result=await first.sdk.auth.refreshSession();
  assert.equal(result.error?.message,'STORAGE_UNAVAILABLE');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await first.auth.status(),{userId:null});
  const before=http.requests.length;
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid','12345678'),{message:'AUTH_FAILED'});
  assert.equal(http.requests.slice(before).some(r=>r.path==='/auth/v1/verify'),false);
  assert.equal(http.requests.some(r=>r.scope==='global'||r.scope==='others'),false);
});

test('SDK boundary timed-out cleanup blocks overlap and late cleanup cannot erase deliberate successor',async t=>{
  const disk=syntheticDisk(),http=syntheticAuthHttp(),storage=disk.storage(true);
  const first=native(storage,http,{sdkBoundary:true,timeoutMs:40});t.after(()=>first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid','12345678');
  const hold=http.holdLogout();t.after(()=>hold.release());
  disk.failNextSessionWrite();const refresh=await first.sdk.auth.refreshSession();assert.equal(refresh.error?.message,'STORAGE_UNAVAILABLE');
  await hold.started;await new Promise(resolve=>setTimeout(resolve,50));
  const before=http.requests.length;
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid','12345678'),{message:'AUTH_TIMEOUT'});
  assert.equal(http.requests.slice(before).some(r=>r.path==='/auth/v1/verify'),false);
  hold.release();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await first.auth.verifyCode('b@synthetic.invalid','12345678'),{userId:'synthetic-user-B'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await first.auth.status(),{userId:'synthetic-user-B'});
  assert.equal(http.requests.filter(r=>r.path==='/auth/v1/logout').length,1);
});

test('R1 SDK boundary verification-write failure owns one post-settlement logout and preserves accepted successor',{timeout:5000},async t=>{
  const disk=syntheticDisk(),http=syntheticAuthHttp(),storage=disk.storage(true);
  const first=native(storage,http,{sdkBoundary:true,timeoutMs:120});
  t.after(()=>first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid','12345678');
  const owned=http.holdLogout(),redundant=http.holdLogout();
  t.after(()=>{owned.release();redundant.release();});
  disk.failNextSessionWrite();
  const failed=first.auth.verifyCode('b@synthetic.invalid','12345678').then(value=>({value}),error=>({error:error.message}));
  await owned.started;
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(http.requests.filter(r=>r.path==='/auth/v1/logout').length,1,'storage degradation and stale verification must share the same authoritative logout');
  owned.release();
  assert.deepEqual(await failed,{error:'AUTH_CHANGED'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await first.auth.verifyCode('b@synthetic.invalid','12345678'),{userId:'synthetic-user-B'});
  redundant.release();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await first.auth.status(),{userId:'synthetic-user-B'});
  assert.equal(http.requests.filter(r=>r.path==='/auth/v1/logout').length,1);
  await first.dispose();
  const restarted=native(disk.storage(true),http,{sdkBoundary:true});t.after(()=>restarted.dispose());
  assert.deepEqual(await restarted.auth.status(),{userId:null});
});

test('R1 native verification timeout quarantines the raw owned logout until actual settlement',{timeout:5000},async t=>{
  const disk=syntheticDisk(),http=syntheticAuthHttp(),storage=disk.storage(true);
  const first=native(storage,http,{sdkBoundary:true,timeoutMs:40});t.after(()=>first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid','12345678');
  const cleanup=http.holdLogout();t.after(()=>cleanup.release());
  disk.failNextSessionWrite();
  const failed=first.auth.verifyCode('b@synthetic.invalid','12345678').then(value=>({value}),error=>({error:error.message}));
  await cleanup.started;
  assert.deepEqual(await failed,{error:'AUTH_TIMEOUT'});
  assert.deepEqual(await first.auth.status(),{userId:null});
  await assert.rejects(first.auth.webTicket('raw-cleanup-pending'),{message:'AUTH_CHANGED'});
  const before=http.requests.length;
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid','12345678'),{message:'AUTH_BUSY'});
  await assert.rejects(first.auth.sendCode('b@synthetic.invalid'),{message:'AUTH_BUSY'});
  await assert.rejects(first.auth.signInProvider('google'),{message:'AUTH_BUSY'});
  assert.equal(http.requests.length,before,'no successor SDK mutation may start before the raw cleanup settles');
  cleanup.release();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await first.auth.verifyCode('b@synthetic.invalid','12345678'),{userId:'synthetic-user-B'});
  assert.deepEqual(await first.auth.status(),{userId:'synthetic-user-B'});
  assert.equal(http.requests.filter(r=>r.path==='/auth/v1/logout').length,1);
});

for(const secure of [true,false])test(`R1 genuinely late SDK session still requires post-settlement cleanup after earlier logout (secure=${secure})`,{timeout:5000},async t=>{
  const disk=syntheticDisk(),http=syntheticAuthHttp(),storage=disk.storage(secure);
  const first=native(storage,http,{sdkBoundary:true,timeoutMs:60});t.after(()=>first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid','12345678');
  const verification=http.holdVerification('b@synthetic.invalid');t.after(()=>verification.release());
  const abandoned=first.auth.verifyCode('b@synthetic.invalid','12345678').then(value=>({value}),error=>({error:error.message}));
  await verification.started;
  await first.auth.signOut();
  assert.equal(await storage.getItem(sessionKey),null,'the earlier explicit logout completed before late B creation');
  const lateCleanup=http.holdLogout();t.after(()=>lateCleanup.release());
  verification.release();await lateCleanup.started;
  assert.equal(JSON.parse(await storage.getItem(sessionKey)).user.id,'synthetic-user-B','the real SDK created late B after the early logout, even on an already isolated fallback');
  assert.deepEqual(await abandoned,{error:'AUTH_TIMEOUT'});
  const before=http.requests.length;
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid','12345678'),{message:'AUTH_BUSY'});
  assert.equal(http.requests.length,before);
  lateCleanup.release();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(disk.files.has(sessionKey),false);
  assert.equal(await storage.getItem('desktop-signed-out-v1'),'1');
  const restarted=native(disk.storage(true),http,{sdkBoundary:true});t.after(()=>restarted.dispose());
  assert.deepEqual(await restarted.auth.status(),{userId:null});
  assert.deepEqual(await first.auth.verifyCode('b@synthetic.invalid','12345678'),{userId:'synthetic-user-B'});
  assert.deepEqual(await first.auth.status(),{userId:'synthetic-user-B'});
  assert.equal(http.requests.filter(r=>r.path==='/auth/v1/logout').length,2,'one early explicit logout and one necessary late compensation, not blanket deduplication');
});

test('R1 failed verification isolation remains fail-closed and preserves native cancellation metadata',{timeout:5000},async t=>{
  const disk=syntheticDisk(),http=syntheticAuthHttp(),storage=disk.storage(true);
  const first=native(storage,http,{sdkBoundary:true});t.after(()=>first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid','12345678');
  const verification=http.holdVerification('b@synthetic.invalid');t.after(()=>verification.release());
  const failed=first.auth.verifyCode('b@synthetic.invalid','12345678').then(value=>({value}),error=>({error:error.message}));
  await verification.started;
  await storage.setItem('desktop-signed-out-v1','1');
  const pending=JSON.stringify({provider:'google',createdAt:Date.now(),userId:'synthetic-user-A'});
  await storage.setItem('desktop-pkce-pending-v1',pending);
  disk.setRemovalFailure(true);disk.failNextSessionWrite();verification.release();
  assert.deepEqual(await failed,{error:'AUTH_FAILED'});
  assert.deepEqual(await first.auth.status(),{userId:null});
  await assert.rejects(first.auth.webTicket('failed-isolation'),{message:'AUTH_CHANGED'});
  assert.equal(await storage.getItem('desktop-signed-out-v1'),'1');
  assert.equal(await storage.getItem('desktop-pkce-pending-v1'),pending);
  assert.equal(disk.files.has('desktop-signed-out-v1'),true);assert.equal(disk.files.has('desktop-pkce-pending-v1'),true);
  const before=http.requests.length;
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid','12345678'),{message:'AUTH_FAILED'});
  assert.equal(http.requests.length,before);
  assert.equal(http.requests.filter(r=>r.path==='/auth/v1/logout').length,1);
});

test('R1 explicit logout timeout without active authentication still gates every successor SDK mutation',{timeout:5000},async t=>{
  const disk=syntheticDisk(),http=syntheticAuthHttp(),storage=disk.storage(true);
  const first=native(storage,http,{sdkBoundary:true,timeoutMs:40});t.after(()=>first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid','12345678');
  const cleanup=http.holdLogout();t.after(()=>cleanup.release());
  const failed=first.auth.signOut().then(value=>({value}),error=>({error:error.message}));
  await cleanup.started;assert.deepEqual(await failed,{error:'AUTH_TIMEOUT'});
  const before=http.requests.length;
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid','12345678'),{message:'AUTH_BUSY'});
  await assert.rejects(first.auth.sendCode('b@synthetic.invalid'),{message:'AUTH_BUSY'});
  await assert.rejects(first.auth.signInProvider('google'),{message:'AUTH_BUSY'});
  assert.equal(http.requests.length,before);
  assert.deepEqual(await first.auth.status(),{userId:null});
  cleanup.release();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(await first.auth.verifyCode('b@synthetic.invalid','12345678'),{userId:'synthetic-user-B'});
  assert.deepEqual(await first.auth.status(),{userId:'synthetic-user-B'});
});

test('SDK memory-only B login cannot revive earlier encrypted identity A on secure restart', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const first = native(disk.storage(true), http);
  t.after(() => first.dispose());
  assert.deepEqual(await first.auth.verifyCode('a@synthetic.invalid', '12345678'), { userId: 'synthetic-user-A' });
  assert.equal(disk.files.has(sessionKey), true);
  await first.dispose();

  const fallbackStorage = disk.storage(false);
  const fallback = native(fallbackStorage, http);
  t.after(() => fallback.dispose());
  assert.deepEqual(await fallback.auth.status(), { userId: null });
  assert.deepEqual(await fallback.auth.verifyCode('b@synthetic.invalid', '12345678'), { userId: 'synthetic-user-B' });
  assert.deepEqual(await fallback.auth.status(), { userId: 'synthetic-user-B' });
  assert.equal(fallbackStorage.secure, false);
  await fallback.dispose();

  const restarted = native(disk.storage(true), http);
  t.after(() => restarted.dispose());
  assert.deepEqual(await restarted.auth.status(), { userId: null },
    'fallback B is memory-only; restarting may require login but MUST NOT restore previous A');
  assert.equal(http.requests.some(request => request.scope === 'global'), false);
});

test('failed old-session cleanup blocks fallback readiness and new verification before SDK login', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const first = native(disk.storage(true), http);
  t.after(() => first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid', '12345678');
  await first.dispose();
  disk.setRemovalFailure(true);
  const start = http.requests.length;
  const fallback = native(disk.storage(false), http);
  t.after(() => fallback.dispose());
  await assert.rejects(fallback.auth.status(), { message: 'AUTH_FAILED' });
  await assert.rejects(fallback.auth.verifyCode('b@synthetic.invalid', '12345678'), { message: 'AUTH_FAILED' });
  assert.equal(http.requests.slice(start).some(request => request.path === '/auth/v1/verify'), false,
    'new login must not succeed before stale encrypted credentials can be removed');
  assert.equal(disk.files.has(sessionKey), true, 'cleanup failure must not be hidden');
});

test('normal encrypted SDK login still restores the latest verified account after restart', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const first = native(disk.storage(true), http);
  t.after(() => first.dispose());
  await first.auth.verifyCode('b@synthetic.invalid', '12345678');
  await first.dispose();
  const restarted = native(disk.storage(true), http);
  t.after(() => restarted.dispose());
  assert.deepEqual(await restarted.auth.status(), { userId: 'synthetic-user-B' });
});

test('SDK local signout on an unreadable fallback storage removes its prior disk session without remote logout', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const first = native(disk.storage(true), http);
  t.after(() => first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid', '12345678');
  await first.dispose();
  const fallback = native(disk.storage(false), http);
  t.after(() => fallback.dispose());
  const start = http.requests.length;
  assert.equal((await fallback.sdk.auth.signOut({ scope: 'local' })).error, null);
  assert.equal(disk.files.has(sessionKey), false);
  assert.equal(http.events.includes('SIGNED_OUT'), true);
  assert.equal(http.requests.slice(start).some(request => request.path === '/auth/v1/logout'), false);
});

test('fallback initialization removes only SDK credentials and preserves encrypted desktop cancellation barriers', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const secure = disk.storage(true);
  const first = native(secure, http);
  t.after(() => first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid', '12345678');
  await first.dispose();
  await secure.setItem('desktop-signed-out-v1', '1');
  await secure.setItem('desktop-pkce-pending-v1', JSON.stringify({ provider: 'google', createdAt: Date.now(), userId: 'synthetic-user-A' }));
  const fallback = native(disk.storage(false), http);
  t.after(() => fallback.dispose());
  assert.deepEqual(await fallback.auth.status(), { userId: null });
  assert.equal(disk.files.has(sessionKey), false, 'fallback readiness requires old SDK credentials to be absent');
  assert.equal(disk.files.has('desktop-signed-out-v1'), true, 'initial cleanup must not delete a durable cancellation barrier');
  assert.equal(disk.files.has('desktop-pkce-pending-v1'), true, 'initial cleanup must not generically delete native pending metadata');
});

test('first fallback verification awaits cleanup without a bootstrap SIGNED_OUT epoch race', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const first = native(disk.storage(true), http);
  t.after(() => first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid', '12345678');
  await first.dispose();
  const fallback = native(disk.storage(false), http);
  t.after(() => fallback.dispose());
  assert.deepEqual(await fallback.auth.verifyCode('b@synthetic.invalid', '12345678'), { userId: 'synthetic-user-B' });
  assert.equal(disk.files.has(sessionKey), false);
  assert.deepEqual(await fallback.auth.status(), { userId: 'synthetic-user-B' });
});

test('newly degraded storage is cleaned before a deliberate successful retry so restart cannot restore A', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const storage = disk.storage(true);
  const first = native(storage, http);
  t.after(() => first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid', '12345678');
  disk.failNextSessionWrite();
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid', '12345678'), { message: 'AUTH_FAILED' });
  assert.equal(storage.secure, false);
  assert.deepEqual(await first.auth.verifyCode('b@synthetic.invalid', '12345678'), { userId: 'synthetic-user-B' });
  assert.deepEqual(await first.auth.status(), { userId: 'synthetic-user-B' });
  await first.dispose();
  const restarted = native(disk.storage(true), http);
  t.after(() => restarted.dispose());
  assert.deepEqual(await restarted.auth.status(), { userId: null });
  assert.equal(http.requests.some(request => request.scope === 'global' || request.scope === 'others'), false);
});

test('newly degraded credential cleanup failure blocks a deliberate retry before new SDK verification', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const storage = disk.storage(true);
  const first = native(storage, http);
  t.after(() => first.dispose());
  await first.auth.verifyCode('a@synthetic.invalid', '12345678');
  disk.failNextSessionWrite();
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid', '12345678'), { message: 'AUTH_FAILED' });
  disk.setRemovalFailure(true);
  const start = http.requests.length;
  const nativeChanges = http.nativeEvents.length;
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid', '12345678'), { message: 'AUTH_FAILED' });
  assert.equal(http.requests.slice(start).some(request => request.path === '/auth/v1/verify'), false);
  assert.equal(disk.files.has(sessionKey), true);
  assert.deepEqual(await first.auth.status(), { userId: null });
  assert.equal(http.nativeEvents.length > nativeChanges, true, 'native identity consumers must invalidate cached A even if cleanup fails');
});

async function degradeDuringVerification(nativeClient, disk, http) {
  await nativeClient.auth.verifyCode('a@synthetic.invalid', '12345678');
  const hold = http.holdVerification('b@synthetic.invalid');
  const outcome = nativeClient.auth.verifyCode('b@synthetic.invalid', '12345678')
    .then(value => ({ value }), error => ({ error: error.message }));
  await hold.started;
  disk.failNextSessionWrite();
  // SDK2.107.0 rejects an internal shared deferred as well as the public call on non-AuthError storage failure.
  // Observe that exact duplicate only; unrelated global rejections remain visible to Node's test runner.
  let duplicate;
  http.observeRefresh(() => {
    duplicate = nativeClient.sdk.auth.refreshingDeferred.promise.then(value => ({ value }), error => ({ error }));
  });
  const refresh = await nativeClient.sdk.auth.refreshSession().then(value => ({ value }), error => ({ error }));
  assert.equal(refresh.error?.message, 'STORAGE_UNAVAILABLE');
  assert.equal((await duplicate).error, refresh.error, 'only the same expected SDK storage-failure rejection is consumed');
  return { outcome, release: hold.release };
}

test('refresh-write degradation after B preflight cannot return unsafe B success or restore old A', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const storage = disk.storage(true);
  const first = native(storage, http);
  t.after(() => first.dispose());
  const held = await degradeDuringVerification(first, disk, http);
  assert.equal(storage.secure, false);
  held.release();
  const outcome = await held.outcome;
  const status = await first.auth.status();
  await first.dispose();
  const restarted = native(disk.storage(true), http);
  t.after(() => restarted.dispose());
  assert.deepEqual(await restarted.auth.status(), { userId: null }, 'a concurrent refresh must not leave previous A restorable after B verification');
  assert.deepEqual(outcome, { error: 'AUTH_CHANGED' }, 'new degradation invalidates the current login; an explicit retry may follow safe isolation');
  assert.deepEqual(status, { userId: null });
  assert.equal(http.requests.some(request => request.scope === 'global' || request.scope === 'others'), false);
});

test('post-verification isolation removal failure rejects B and blocks later verification', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const first = native(disk.storage(true), http);
  t.after(() => first.dispose());
  const held = await degradeDuringVerification(first, disk, http);
  disk.setRemovalFailure(true);
  held.release();
  assert.deepEqual(await held.outcome, { error: 'AUTH_FAILED' });
  assert.deepEqual(await first.auth.status(), { userId: null });
  const before = http.requests.length;
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid', '12345678'), { message: 'AUTH_FAILED' });
  assert.equal(http.requests.slice(before).some(request => request.path === '/auth/v1/verify'), false);
});

test('post-verification isolation timeout rejects B and cannot allow a new login before late cleanup', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const first = native(disk.storage(true), http, { timeoutMs: 100 });
  t.after(() => first.dispose());
  const held = await degradeDuringVerification(first, disk, http);
  const logout = http.holdLogout();
  held.release();
  assert.deepEqual(await held.outcome, { error: 'AUTH_TIMEOUT' });
  assert.deepEqual(await first.auth.status(), { userId: null });
  const before = http.requests.length;
  await assert.rejects(first.auth.verifyCode('b@synthetic.invalid', '12345678'), { message: 'AUTH_BUSY' });
  assert.equal(http.requests.slice(before).some(request => request.path === '/auth/v1/verify'), false);
  logout.release();
  await new Promise(resolve => setImmediate(resolve));
  await first.dispose();
  const restarted = native(disk.storage(true), http);
  t.after(() => restarted.dispose());
  assert.deepEqual(await restarted.auth.status(), { userId: null });
});

test('timed-out isolation owns one cleanup so no second late logout can erase an intentional B retry', async t => {
  const disk = syntheticDisk();
  const http = syntheticAuthHttp();
  const first = native(disk.storage(true), http, { timeoutMs: 40 });
  t.after(() => first.dispose());
  const held = await degradeDuringVerification(first, disk, http);
  const isolationLogout = http.holdLogout();
  const duplicateLogout = http.holdLogout();
  t.after(() => { isolationLogout.release(); duplicateLogout.release(); });
  const before = http.requests.length;
  held.release();
  assert.deepEqual(await held.outcome, { error: 'AUTH_TIMEOUT' });
  isolationLogout.release();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await first.auth.verifyCode('b@synthetic.invalid', '12345678'), { userId: 'synthetic-user-B' });
  assert.deepEqual(await first.auth.status(), { userId: 'synthetic-user-B' });
  duplicateLogout.release();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await first.auth.status(), { userId: 'synthetic-user-B' }, 'an abandoned duplicate cleanup must not sign out the later successful retry');
  assert.equal(http.requests.slice(before).filter(request => request.path === '/auth/v1/logout').length, 1);
});
