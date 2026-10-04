import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobileRequire = createRequire(path.join(root, 'apps/mobile/package.json'));
const filePath = path.join(root, 'apps/mobile/src/mobileWebBridge.ts');

function bridge() {
  const { transformSync } = mobileRequire('@babel/core');
  const code = transformSync(readFileSync(filePath, 'utf8'), {
    filename: filePath, babelrc: false, configFile: false,
    presets: [[mobileRequire.resolve('@babel/preset-typescript'), { allExtensions: true }]],
    plugins: [mobileRequire.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = { exports: {}, URL, require() { throw new Error('unexpected import'); } };
  runInNewContext(code, context, { timeout: 1000 });
  return context.exports;
}

test('ticket request requires a matching live native user and returns only a one-use hash', async () => {
  const { requestMobileWebTicket } = bridge();
  const calls = [];
  const client = {
    auth: {
      async getSession() { return { data: { session: { access_token: 'native-secret', user: { id: 'user-1' } } }, error: null }; },
      async getUser() { return { data: { user: { id: 'user-1' } }, error: null }; },
    },
    functions: { async invoke(name, options) {
      calls.push({ name, options });
      return { data: { token_hash: 'one-use-hash', user_id: 'user-1', verification_type: 'magiclink' }, error: null };
    } },
  };
  const ticket = await requestMobileWebTicket(client, 'user-1');
  assert.deepEqual({ ...ticket }, { tokenHash: 'one-use-hash', userId: 'user-1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'mobile-web-auth');
  assert.equal(JSON.stringify(calls[0].options), '{"body":{}}');
});

test('account switch refuses a ticket before calling the endpoint', async () => {
  const { requestMobileWebTicket } = bridge();
  let called = false;
  const client = {
    auth: {
      async getSession() { return { data: { session: { user: { id: 'user-2' } } }, error: null }; },
      async getUser() { return { data: { user: { id: 'user-2' } }, error: null }; },
    },
    functions: { async invoke() { called = true; return { data: null, error: null }; } },
  };
  await assert.rejects(() => requestMobileWebTicket(client, 'user-1'), /account changed/i);
  assert.equal(called, false);
});

test('wrong-user endpoint result is never injected', async () => {
  const { requestMobileWebTicket } = bridge();
  const client = {
    auth: {
      async getSession() { return { data: { session: { user: { id: 'user-1' } } }, error: null }; },
      async getUser() { return { data: { user: { id: 'user-1' } }, error: null }; },
    },
    functions: { async invoke() {
      return { data: { token_hash: 'wrong', user_id: 'user-2', verification_type: 'magiclink' }, error: null };
    } },
  };
  await assert.rejects(() => requestMobileWebTicket(client, 'user-1'), /account mismatch/i);
});

test('only the exact first-party HTTPS origin can receive the ticket', () => {
  const { isTrustedWebUrl, buildTicketInjection } = bridge();
  assert.equal(isTrustedWebUrl('https://study-room-attendance.vercel.app/#feed'), true);
  assert.equal(isTrustedWebUrl('https://study-room-attendance.vercel.app.evil.test/'), false);
  assert.equal(isTrustedWebUrl('http://study-room-attendance.vercel.app/'), false);
  assert.equal(isTrustedWebUrl('https://example.com/'), false);
  const script = buildTicketInjection({ requestId: 'r1', userId: 'user-1', tokenHash: 'one-use-hash' });
  assert.match(script, /study-room-native-message/);
  assert.match(script, /one-use-hash/);
  assert.doesNotMatch(script, /native-secret|refresh_token/);
});

test('native bridge ignores unknown messages and incomplete sign-out requests', () => {
  const { parseNativeBridgeMessage } = bridge();
  assert.equal(parseNativeBridgeMessage('{"type":"STUDY_WEB_SIGN_OUT","userId":"other"}'), null);
  assert.equal(parseNativeBridgeMessage('{"type":"UNKNOWN"}'), null);
  assert.deepEqual({ ...parseNativeBridgeMessage('{"type":"STUDY_WEB_READY","requestId":"ready-1"}') }, {
    type: 'STUDY_WEB_READY', requestId: 'ready-1',
  });
});

test('passive camera check accepts only a request ID and never extra settings or tokens',()=>{
 const {parseNativeBridgeMessage}=bridge();
 assert.deepEqual({...parseNativeBridgeMessage('{"type":"STUDY_WEB_CAMERA_PERMISSION_CHECK","requestId":"check"}')},{type:'STUDY_WEB_CAMERA_PERMISSION_CHECK',requestId:'check'});
 for(const extra of ['"url":"https://evil.test"','"permission":"audio"','"access_token":"not-a-secret"']){
  assert.equal(parseNativeBridgeMessage('{"type":"STUDY_WEB_CAMERA_PERMISSION_CHECK","requestId":"check",'+extra+'}'),null);
 }
});
