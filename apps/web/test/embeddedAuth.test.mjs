import assert from 'node:assert/strict';
import test from 'node:test';
import { beginEmbeddedAuthentication, consumeEmbeddedTicket, isEmbeddedStudyApp, parseEmbeddedTicket } from '../src/embeddedAuth.mjs';

test('regular browser never enters embedded login mode', () => {
  assert.equal(isEmbeddedStudyApp({ location: { origin: 'https://study-room-attendance.vercel.app' } }), false);
});

test('a matching one-use ticket creates only the expected user session', async () => {
  const calls = [];
  const session = { user: { id: 'user-1' }, access_token: 'web-access', refresh_token: 'web-refresh' };
  const supabase = { auth: {
    async verifyOtp(input) { calls.push(input); return { data: { user: session.user, session }, error: null }; },
    async signOut() { throw new Error('a matching session must not be cleared'); },
  } };
  const result = await consumeEmbeddedTicket(supabase, {
    type: 'STUDY_WEB_AUTH_TICKET', requestId: 'ready-1', userId: 'user-1', tokenHash: 'one-use-hash',
  }, 'ready-1');
  assert.equal(result, session);
  assert.deepEqual(calls, [{ token_hash: 'one-use-hash', type: 'magiclink' }]);
});

test('a ticket with the wrong ready nonce is discarded before auth exchange', async () => {
  let verified = false;
  const supabase = { auth: {
    async verifyOtp() { verified = true; throw new Error('must not run'); },
    async signOut() {},
  } };
  await assert.rejects(() => consumeEmbeddedTicket(supabase, {
    type: 'STUDY_WEB_AUTH_TICKET', requestId: 'old', userId: 'user-1', tokenHash: 'hash',
  }, 'ready-2'), /invalid ticket/i);
  assert.equal(verified, false);
});

test('wrong returned user is signed out locally and never rendered', async () => {
  const signOutScopes = [];
  const supabase = { auth: {
    async verifyOtp() { return { data: { user: { id: 'user-2' }, session: { user: { id: 'user-2' } } }, error: null }; },
    async signOut(options) { signOutScopes.push(options); },
  } };
  await assert.rejects(() => consumeEmbeddedTicket(supabase, {
    type: 'STUDY_WEB_AUTH_TICKET', requestId: 'ready-1', userId: 'user-1', tokenHash: 'hash',
  }, 'ready-1'), /account mismatch/i);
  assert.deepEqual(signOutScopes, [{ scope: 'local' }]);
});

test('malformed native messages never expose a token to auth verification', () => {
  assert.equal(parseEmbeddedTicket({ type: 'STUDY_WEB_AUTH_TICKET', tokenHash: 'secret' }), null);
  assert.equal(parseEmbeddedTicket('not an object'), null);
  assert.equal(parseEmbeddedTicket({ type: 'other', requestId: 'r', userId: 'u', tokenHash: 'secret' }), null);
});

test('embedded login clears a stale browser session before requesting a native ticket', async () => {
  const order = [];
  const host = {
    location: { origin: 'https://study-room-attendance.vercel.app' },
    ReactNativeWebView: { postMessage(value) { order.push(JSON.parse(value)); } },
  };
  await beginEmbeddedAuthentication({
    auth: { async signOut(options) { assert.deepEqual(options, { scope: 'local' }); order.push('cleared'); } },
  }, host, 'ready-7');
  assert.deepEqual(order, ['cleared', { type: 'STUDY_WEB_READY', requestId: 'ready-7' }]);
});
