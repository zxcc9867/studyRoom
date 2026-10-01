import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobileRequire = createRequire(path.join(root, 'apps/mobile/package.json'));
function load(name) {
  const file = path.join(root, `apps/mobile/src/${name}.ts`);
  const code = mobileRequire('@babel/core').transformSync(readFileSync(file, 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    presets: [[mobileRequire.resolve('@babel/preset-typescript'), { allExtensions: true }]],
    plugins: [mobileRequire.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = { exports: {}, URL, Error, Promise, require() { throw new Error('unexpected import'); } };
  runInNewContext(code, context);
  return context.exports;
}

test('OAuth callback accepts only the exact app callback and one PKCE code, never URL tokens', () => {
  const { getMobileOAuthCode } = load('mobileOAuth');
  assert.equal(getMobileOAuthCode('studyroom://auth/callback?code=valid-code'), 'valid-code');
  for (const url of ['https://evil.test/?code=x', 'studyroom://auth/other?code=x',
    'studyroom://auth/callback?code=x&code=y', 'studyroom://auth/callback#access_token=x',
    'studyroom://auth/callback?code=x&access_token=y', 'studyroom://auth/callback?error=access_denied']) {
    assert.throws(() => getMobileOAuthCode(url));
  }
});

test('OAuth requests Google PKCE in the system browser, cancellation never exchanges a code', async () => {
  const { signInWithMobileGoogle } = load('mobileOAuth');
  let exchanges = 0;
  const client = { auth: {
    async signInWithOAuth(args) {
      assert.equal(JSON.stringify(args), JSON.stringify({ provider: 'google', options: {
        redirectTo: 'studyroom://auth/callback', skipBrowserRedirect: true,
      } }));
      return { data: { url: 'https://bqohkdzvxbrokkmuhysx.supabase.co/auth/v1/authorize?provider=google&code_challenge_method=s256' }, error: null };
    },
    async exchangeCodeForSession(code) { exchanges++; assert.equal(code, 'real-code'); return { data: { session: {} }, error: null }; },
  } };
  const cancel = await signInWithMobileGoogle(client, async (url, redirect) => {
    assert.equal(redirect, 'studyroom://auth/callback');
    assert.ok(url.startsWith('https://bqohkdzvxbrokkmuhysx.supabase.co/'));
    return { type: 'cancel' };
  }, 'https://bqohkdzvxbrokkmuhysx.supabase.co');
  assert.equal(cancel, false);
  assert.equal(exchanges, 0);
  assert.equal(await signInWithMobileGoogle(client, async () => ({ type: 'success', url: 'studyroom://auth/callback?code=real-code' }), 'https://bqohkdzvxbrokkmuhysx.supabase.co'), true);
  assert.equal(exchanges, 1);
});

test('OAuth refuses a foreign authorization URL without opening it', async () => {
  const { signInWithMobileGoogle } = load('mobileOAuth');
  let opened = false;
  const client = { auth: { async signInWithOAuth() { return { data: { url: 'https://evil.test/' }, error: null }; } } };
  await assert.rejects(() => signInWithMobileGoogle(client, async () => { opened = true; }, 'https://bqohkdzvxbrokkmuhysx.supabase.co'));
  assert.equal(opened, false);
});

test('a cold-start OAuth callback exchanges its code at most once across duplicate delivery', async () => {
  const { completeMobileOAuthCallback } = load('mobileOAuth');
  let calls = 0;
  const client = { auth: { async exchangeCodeForSession(code) {
    calls++; assert.equal(code, 'cold-start'); return { data: { session: {} }, error: null };
  } } };
  await Promise.all([completeMobileOAuthCallback(client, 'studyroom://auth/callback?code=cold-start'),
    completeMobileOAuthCallback(client, 'studyroom://auth/callback?code=cold-start')]);
  assert.equal(calls, 1);
});

test('native crypto supplies secure random and SHA256 so Supabase never falls back to plain PKCE', async () => {
  const { installNativePKCECrypto } = load('pkceCrypto');
  const host = {};
  installNativePKCECrypto(host, {
    getRandomValues: array => webcrypto.getRandomValues(array),
    digest: data => webcrypto.subtle.digest('SHA-256', data),
  });
  const random = new Uint32Array(56);
  host.crypto.getRandomValues(random);
  assert.ok(random.some(value => value !== 0));
  const hash = new Uint8Array(await host.crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc')));
  assert.equal(Buffer.from(hash).toString('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await assert.rejects(() => host.crypto.subtle.digest('MD5', new Uint8Array()), /Unsupported/);
});

test('real Supabase OAuth client emits S256 using the native crypto adapter and persisted verifier', async () => {
  const { installNativePKCECrypto } = load('pkceCrypto');
  const host = {};
  installNativePKCECrypto(host, {
    getRandomValues: array => webcrypto.getRandomValues(array),
    digest: data => webcrypto.subtle.digest('SHA-256', data),
  });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: host.crypto, configurable: true });
  const storage = new Map();
  try {
    const { createClient } = mobileRequire('@supabase/supabase-js');
    const client = createClient('https://bqohkdzvxbrokkmuhysx.supabase.co', 'synthetic-public-key', { auth: {
      flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    } });
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'studyroom://auth/callback', skipBrowserRedirect: true } });
    assert.equal(error, null);
    const url = new URL(data.url);
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    assert.equal(url.searchParams.get('redirect_to'), 'studyroom://auth/callback');
    assert.equal(url.searchParams.get('code_challenge').length, 43);
    const verifier = [...storage.entries()].find(([key]) => key.endsWith('-code-verifier'))?.[1];
    assert.ok(verifier); assert.notEqual(url.searchParams.get('code_challenge'), verifier);
  } finally { Object.defineProperty(globalThis, 'crypto', previous); }
});

test('camera preflight skips permission prompts when granted and respects rationale cancellation', async () => {
  const { prepareCameraPermission } = load('cameraPermission');
  let prompts = 0, requests = 0;
  const ports = { check: async () => true, explain: async () => { prompts++; return false; }, request: async () => { requests++; return 'granted'; } };
  assert.equal(await prepareCameraPermission(ports), 'granted');
  ports.check = async () => false;
  assert.equal(await prepareCameraPermission(ports), 'cancelled');
  assert.equal(prompts, 1); assert.equal(requests, 0);
});

test('camera preflight distinguishes denied and permanent denial and never opens settings itself', async () => {
  const { prepareCameraPermission } = load('cameraPermission');
  for (const [result, expected] of [['denied', 'denied'], ['never_ask_again', 'blocked'], ['granted', 'granted']]) {
    const order = [];
    assert.equal(await prepareCameraPermission({
      check: async () => { order.push('check'); return false; },
      explain: async () => { order.push('explain'); return true; },
      request: async () => { order.push('request'); return result; },
    }), expected);
    assert.deepEqual(order, ['check', 'explain', 'request']);
  }
});

test('camera bridge accepts only narrow request messages and correlates status responses', () => {
  const { parseNativeBridgeMessage, buildCameraPermissionInjection } = load('mobileWebBridge');
  assert.equal(parseNativeBridgeMessage('{"type":"STUDY_WEB_CAMERA_PERMISSION","requestId":"r","url":"https://evil.test"}'), null);
  assert.equal(parseNativeBridgeMessage('{"type":"STUDY_WEB_OPEN_APP_SETTINGS"}'), null);
  assert.equal(parseNativeBridgeMessage('{"type":"STUDY_WEB_CAMERA_PERMISSION","requestId":"r"}').type, 'STUDY_WEB_CAMERA_PERMISSION');
  const script = buildCameraPermissionInjection('r', 'blocked');
  const events = [];
  runInNewContext(script, { window: { dispatchEvent(event) { events.push(event.detail); } }, CustomEvent: function(type, init) { this.detail = init.detail; } });
  assert.equal(JSON.stringify(events), '[{"type":"STUDY_NATIVE_CAMERA_PERMISSION","requestId":"r","status":"blocked"}]');
});
