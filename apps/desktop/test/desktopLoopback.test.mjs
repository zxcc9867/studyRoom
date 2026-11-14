import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const feature = await import('../src/desktopLoopback.mjs').catch(() => ({}));
function start(options) {
  assert.equal(typeof feature.createLoopbackCallback, 'function', 'loopback callback transport must exist');
  return feature.createLoopbackCallback(options);
}
const request = (url, options = {}) => new Promise((resolve, reject) => {
  const req = http.request(url, { agent: false, ...options }, response => {
    let body = '';
    response.setEncoding('utf8').on('data', value => { body += value; });
    response.on('end', () => resolve({ status: response.statusCode, body, headers: response.headers }));
  });
  req.on('error', reject); req.end();
});
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('loopback accepts one matching navigation and never reflects its private code', async t => {
  const codes = [];
  const receiver = start({ onCallback: async code => { codes.push(code); } });
  t.after(() => receiver.close());
  const redirect = await receiver.ready;
  const url = new URL(redirect);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.protocol, 'http:');
  assert.ok(Number(url.port) > 0);
  assert.match(url.pathname, /^\/auth\/callback\/[a-f0-9]{64}$/);
  const response = await request(`${redirect}?code=synthetic-private-code`);
  assert.equal(response.status, 200);
  assert.deepEqual(codes, ['synthetic-private-code']);
  assert.match(response.body, /로그인이 완료/);
  assert.equal(response.body.includes('synthetic-private-code'), false);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.match(response.headers['content-security-policy'], /default-src 'none'/);
  await tick();
  await assert.rejects(request(`${redirect}?code=replay`));
});

test('invalid Host, method, path, Origin and query do not consume the waiting callback', async t => {
  let exchanges = 0;
  const receiver = start({ onCallback: async () => { exchanges += 1; } });
  t.after(() => receiver.close());
  const redirect = await receiver.ready;
  const base = new URL(redirect);
  const invalid = [
    [`${redirect}?code=x`, { headers: { Host: 'evil.test' } }],
    [`${redirect}?code=x`, { method: 'POST' }],
    [`${base.origin}/auth/callback/wrong?code=x`, {}],
    [`${redirect}?code=x`, { headers: { Origin: 'https://evil.test' } }],
    [`${redirect}?code=x&code=y`, {}], [`${redirect}?code=x&extra=y`, {}],
    [`${redirect}?code=`, {}], [`${redirect}?code=bad%20code`, {}],
    [`${redirect}?error=private-error`, {}],
    [`${redirect}?code=${'a'.repeat(4097)}`, {}],
    [`${redirect}?code=x`, { path: `/auth/callback/../callback/${base.pathname.split('/').pop()}?code=x` }],
  ];
  for (const [url, options] of invalid) assert.ok((await request(url, options)).status >= 400);
  assert.equal(exchanges, 0);
  assert.equal((await request(`${redirect}?code=good`)).status, 200);
  assert.equal(exchanges, 1);
});

test('replay cannot exchange again while the first callback is still pending', async t => {
  let settle;
  let received;
  const started = new Promise(resolve => { received = resolve; });
  const gate = new Promise(resolve => { settle = resolve; });
  let exchanges = 0;
  const receiver = start({ onCallback: async () => { exchanges += 1; received(); await gate; } });
  t.after(() => receiver.close());
  const redirect = await receiver.ready;
  const first = request(`${redirect}?code=first`);
  await started;
  assert.equal((await request(`${redirect}?code=second`)).status, 409);
  settle();
  assert.equal((await first).status, 200);
  assert.equal(exchanges, 1);
});

test('failed exchange returns fixed failure HTML without leaking provider details', async t => {
  const receiver = start({ onCallback: async () => { throw new Error('private-provider-detail'); } });
  t.after(() => receiver.close());
  const redirect = await receiver.ready;
  const response = await request(`${redirect}?code=private-code`);
  assert.equal(response.status, 400);
  assert.equal(response.body.includes('private'), false);
  assert.match(response.body, /완료하지 못/);
});

test('expiry closes the port and informs its owner once', async () => {
  let expired;
  const expiry = new Promise(resolve => { expired = resolve; });
  let count = 0;
  const receiver = start({ ttlMs: 25, onCallback: async () => assert.fail('expired'), onExpire: () => { count += 1; expired(); } });
  const redirect = await receiver.ready;
  await expiry;
  assert.equal(count, 1);
  await assert.rejects(request(`${redirect}?code=late`));
  receiver.close();
});

test('explicit close cancels both a ready receiver and one still starting', async () => {
  const first = start({ onCallback: async () => assert.fail('closed') });
  const redirect = await first.ready;
  first.close(); first.close();
  await assert.rejects(request(`${redirect}?code=late`));
  const second = start({ onCallback: async () => assert.fail('cancelled') });
  second.close();
  await assert.rejects(second.ready, { message: 'AUTH_CHANGED' });
});

test('a new receiver uses a new nonce instead of reusing a previous callback', async t => {
  const a = start({ onCallback: async () => {} });
  const b = start({ onCallback: async () => {} });
  t.after(() => { a.close(); b.close(); });
  const [x, y] = await Promise.all([a.ready, b.ready]);
  assert.notEqual(new URL(x).pathname, new URL(y).pathname);
});

test('only a successful exchange includes the exact CSP-hashed close script', async t => {
  for (const result of ['success', 'failure', 'cancel']) {
    const receiver = start({ onCallback: async () => { if (result === 'failure') throw Error('synthetic-failure'); } });
    t.after(() => receiver.close());
    const redirect = await receiver.ready;
    const response = await request(`${redirect}?${result === 'cancel' ? 'error=access_denied' : 'code=synthetic-code'}`);
    const scripts = [...response.body.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    const csp = response.headers['content-security-policy'];
    const styles = [...response.body.matchAll(/<style>([\s\S]*?)<\/style>/g)];
    assert.equal(styles.length, 1, 'every completion state uses the fixed local theme');
    const styleDigest = createHash('sha256').update(styles[0][1]).digest('base64');
    assert.ok(csp.includes(`style-src 'sha256-${styleDigest}'`));
    assert.match(response.body, /<main class="status-panel" aria-labelledby="status-title">/);
    assert.doesNotMatch(response.body, /https?:\/\//, 'the private callback loads no remote assets');
    assert.equal(scripts.length, result === 'success' ? 1 : 0);
    if (result === 'success') {
      const digest = createHash('sha256').update(scripts[0][1]).digest('base64');
      assert.ok(csp.includes(`script-src 'sha256-${digest}'`));
      assert.match(response.body, /이 탭은 닫아도 됩니다/);
    } else assert.equal(csp.includes('script-src'), false);
    assert.equal(csp.includes('unsafe-inline'), false);
    assert.equal(csp.includes('unsafe-eval'), false);
    assert.equal(response.body.includes('synthetic-code'), false);
  }
});

test('Windows CRLF checkout hashes the LF-normalized HTML style content', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'study-room-style-test-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const source = await readFile(new URL('../src/desktopLoopback.mjs', import.meta.url), 'utf8');
  const style = (await readFile(new URL('../src/desktopStatus.css', import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
  await writeFile(join(folder, 'desktopLoopback.mjs'), source);
  await writeFile(join(folder, 'desktopStatus.css'), style.replace(/\n/g, '\r\n'));
  const { createLoopbackCallback } = await import(pathToFileURL(join(folder, 'desktopLoopback.mjs')).href);
  const receiver = createLoopbackCallback({ onCallback: async () => {} });
  t.after(() => receiver.close());
  const response = await request(`${await receiver.ready}?code=synthetic-crlf-test`);
  const embedded = response.body.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.equal(embedded, style, 'HTML parsing normalizes CRLF before CSP validation');
  assert.ok(response.headers['content-security-policy'].includes(`style-src 'sha256-${createHash('sha256').update(style).digest('base64')}'`));
});

test('owned browser entry is single-use, CSP-hashed and does not exchange a session', async t => {
  let exchanges = 0;
  const receiver = start({ onCallback: async () => { exchanges += 1; } });
  t.after(() => receiver.close());
  const redirect = await receiver.ready;
  assert.equal(typeof receiver.authorizationEntry, 'function');
  const entry = receiver.authorizationEntry('https://project.supabase.co/auth/v1/authorize?provider=google&prompt=select_account');
  assert.equal(entry, redirect.replace('/auth/callback/', '/auth/start/'));
  const result = await request(entry);
  assert.equal(result.status, 200);
  assert.match(result.body, /Google로 계속/);
  assert.ok(result.body.includes('provider=google&amp;prompt=select_account'));
  const script = result.body.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.ok(result.headers['content-security-policy'].includes(`script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`));
  assert.doesNotMatch(result.headers['content-security-policy'], /unsafe-inline|unsafe-eval/);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['referrer-policy'], 'no-referrer');
  assert.equal((await request(entry)).status, 409);
  assert.equal(exchanges, 0);
  assert.equal((await request(`${redirect}?code=synthetic-complete`)).status, 200);
  assert.equal(exchanges, 1);
});

test('browser entry rejects hostile requests and unsafe URLs without consuming the callback', async t => {
  const receiver = start({ onCallback: async () => {} });
  t.after(() => receiver.close());
  const redirect = await receiver.ready;
  assert.equal(typeof receiver.authorizationEntry, 'function');
  for (const url of ['javascript:alert(1)', 'http://example.test', 'https://user:pass@example.test', 'https://example.test/#fragment']) {
    assert.throws(() => receiver.authorizationEntry(url));
  }
  const entry = receiver.authorizationEntry('https://example.test/authorize');
  assert.throws(() => receiver.authorizationEntry('https://example.test/second'));
  for (const [url, options] of [[entry, { method: 'POST' }], [entry, { headers: { Host: 'evil.test' } }], [entry, { headers: { Origin: 'https://evil.test' } }], [entry + '?extra=1', {}]]) {
    assert.equal((await request(url, options)).status, 400);
  }
  assert.equal((await request(entry)).status, 200);
  assert.equal((await request(`${redirect}?code=synthetic-complete`)).status, 200);
});
