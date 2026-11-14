import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createDesktopAuth } from '../src/desktopAuth.mjs';
import { createLoopbackCallback } from '../src/desktopLoopback.mjs';

for (const provider of ['google', 'github']) {
  test(`public SDK ${provider} authorize keeps PKCE and applies only the intended account-picker option`, async t => {
    const values = new Map();
    const storage = { getItem: async key => values.get(key) ?? null,
      setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
    let requests = 0;
    const sdk = createClient('https://project.supabase.co', 'sb_publishable_synthetic_test_only', {
      global: { fetch: async () => { requests += 1; assert.fail('authorize preparation must not authenticate remotely'); } },
      auth: { storage, flowType: 'pkce', persistSession: true, detectSessionInUrl: false, autoRefreshToken: false },
    });
    const opened = [];
    const client = createDesktopAuth({ supabase: sdk, storage, openExternal: async url => opened.push(url) });
    t.after(async () => { client.dispose(); await sdk.auth.stopAutoRefresh(); });
    assert.deepEqual(await client.signInProvider(provider), { opened: true });
    assert.equal(opened.length, 1);
    const url = new URL(opened[0]);
    assert.equal(url.origin, 'https://project.supabase.co');
    assert.equal(url.pathname, '/auth/v1/authorize');
    assert.equal(url.searchParams.get('provider'), provider);
    assert.equal(url.searchParams.get('redirect_to'), 'studyroom-desktop://auth/callback');
    assert.equal(url.searchParams.get('code_challenge_method'), 's256');
    assert.match(url.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43,128}$/);
    assert.equal(url.searchParams.get('prompt'), provider === 'google' ? 'select_account' : null);
    assert.equal(values.has('sb-project-auth-token-code-verifier'), true);
    assert.equal(values.has('sb-project-auth-token'), false);
    assert.equal(requests, 0);
  });
}

test('pinned SDK exchanges a loopback code using its own stored verifier and issues the existing web ticket', async t => {
  const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
  const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: 4000000000 })}.synthetic`;
  const paths = [];
  let exchangedVerifier;
  const sdk = createClient('https://project.supabase.co', 'sb_publishable_synthetic_test_only', {
    auth: { storage, flowType: 'pkce', persistSession: true, detectSessionInUrl: false, autoRefreshToken: false },
    global: { fetch: async (input, options) => {
      const url = new URL(typeof input === 'string' ? input : input.url);
      paths.push(url.pathname);
      if (url.pathname === '/auth/v1/token') {
        const body = JSON.parse(options.body);
        assert.equal(body.auth_code, 'synthetic-loopback-pkce');
        assert.equal(url.searchParams.get('grant_type'), 'pkce');
        exchangedVerifier = body.code_verifier;
        return Response.json({ access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user });
      }
      if (url.pathname === '/auth/v1/user') return Response.json(user);
      if (url.pathname === '/functions/v1/mobile-web-auth') return Response.json({ user_id: user.id, verification_type: 'magiclink', token_hash: 'synthetic-ticket' });
      assert.fail(`unexpected synthetic SDK endpoint ${url.pathname}`);
    } },
  });
  let browserEntry;
  let completed = 0;
  const client = createDesktopAuth({ supabase: sdk, storage, createProviderCallback: createLoopbackCallback,
    openExternal: async url => { browserEntry = url; }, onProviderComplete: () => { completed += 1; } });
  t.after(async () => { client.dispose(); await sdk.auth.stopAutoRefresh(); });
  await client.signInProvider('google');
  assert.match(browserEntry, /^http:\/\/127\.0\.0\.1:\d+\/auth\/start\/[a-f0-9]{64}$/);
  const entryHtml = await (await fetch(browserEntry)).text();
  const authorize = new URL(entryHtml.match(/data-authorize="([^"]+)"/)[1].replaceAll('&amp;', '&'));
  const redirect = authorize.searchParams.get('redirect_to');
  assert.match(redirect, /^http:\/\/127\.0\.0\.1:\d+\/auth\/callback\/[a-f0-9]{64}$/);
  assert.equal(authorize.searchParams.get('code_challenge_method'), 's256');
  const verifier = values.get('sb-project-auth-token-code-verifier');
  assert.ok(verifier);
  assert.deepEqual(paths, []);
  const response = await fetch(`${redirect}?code=synthetic-loopback-pkce`);
  assert.equal(response.status, 200);
  assert.equal(exchangedVerifier, JSON.parse(verifier));
  assert.equal(completed, 1);
  assert.deepEqual(await client.status(), { userId: user.id });
  assert.equal((await client.webTicket('synthetic-request')).tokenHash, 'synthetic-ticket');
  assert.equal(values.has('desktop-pkce-pending-v1'), false);
  assert.equal(values.has('sb-project-auth-token-code-verifier'), false);
  assert.ok(values.has('sb-project-auth-token'));
});
