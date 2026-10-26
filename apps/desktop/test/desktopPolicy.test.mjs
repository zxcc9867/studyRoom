import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../src/desktopPolicy.mjs').catch(() => ({}));
const origin = 'https://study-room-attendance.vercel.app';
function policy() {
  assert.equal(typeof module.createDesktopPolicy, 'function', 'desktop policy feature must exist');
  return module.createDesktopPolicy({ origin });
}

test('trust requires exact origin without credentials or lookalike hosts', () => {
  const p = policy();
  assert.equal(p.isTrustedUrl(`${origin}/app#study`), true);
  for (const url of [`${origin}.evil.test`, 'http://study-room-attendance.vercel.app', `${origin}:444`,
    'https://name@study-room-attendance.vercel.app', 'file:///app', 'not a URL']) {
    assert.equal(p.isTrustedUrl(url), false);
  }
});

test('IPC trusts only the current top frame and owning webContents', () => {
  const p = policy();
  const mainFrame = { url: origin };
  const wc = { mainFrame, getURL: () => origin };
  assert.equal(p.isTrustedSender({ sender: wc, senderFrame: mainFrame }, wc), true);
  assert.equal(p.isTrustedSender({ sender: wc, senderFrame: { url: origin } }, wc), false);
  assert.equal(p.isTrustedSender({ sender: {}, senderFrame: mainFrame }, wc), false);
  mainFrame.url = 'https://evil.test';
  assert.equal(p.isTrustedSender({ sender: wc, senderFrame: mainFrame }, wc), false);
});

test('bridge parser accepts the contract and copies nested study state', () => {
  const p = policy();
  const input = { id: 'req-1', action: 'studyState', payload: {
    userId: 'user-1', ready: true, session: { id: 'session-1', paused: true },
    cameraActive: false, operationPending: false, activity: 'allowed',
  } };
  const parsed = p.parseRequest(input);
  input.payload.session.id = 'changed';
  assert.equal(parsed.payload.session.id, 'session-1');
  assert.deepEqual(p.parseRequest({ id: 'r', action: 'info', payload: {} }), { id: 'r', action: 'info', payload: {} });
  assert.equal(p.parseRequest({ id: 'r', action: 'verifyCode', payload: { email: 'user@example.test', code: '12345678' } }).payload.code, '12345678');
});

test('bridge parser rejects extra keys, malformed booleans, unbounded data and token input', () => {
  const p = policy();
  for (const value of [null, [], { id: 'r', action: 'info', payload: {}, extra: true },
    { id: 'r', action: 'unknown', payload: {} }, { id: 'r', action: 'info', payload: { token: 'secret' } },
    { id: 'x'.repeat(129), action: 'info', payload: {} },
    { id: 'r', action: 'verifyCode', payload: { email: 'user@example.test', code: '1234567' } },
    { id: 'r', action: 'signInProvider', payload: { provider: 'evil' } },
    { id: 'r', action: 'studyState', payload: { userId: null, ready: 'yes', session: null, cameraActive: false, operationPending: false, activity: 'allowed' } },
    { id: 'r', action: 'studyState', payload: { userId: 'u', ready: true, session: { id: 's', paused: false, extra: true }, cameraActive: false, operationPending: false, activity: 'studying' } },
  ]) assert.throws(() => p.parseRequest(value), { message: 'BAD_REQUEST' });
});

test('auth callbacks require exact target and one bounded code without fragments or duplicates', () => {
  const p = policy();
  assert.deepEqual(p.parseAuthCallback('studyroom-desktop://auth/callback?code=once'), { code: 'once' });
  for (const url of ['studyroom-desktop://auth/callback?code=a&code=b',
    'studyroom-desktop://auth/callback?code=a&other=b', 'studyroom-desktop://auth/callback?code=a#access_token=x',
    'studyroom-desktop://auth/callback/?code=a', 'studyroom-desktop://evil/callback?code=a',
    'studyroom-desktop://name@auth/callback?code=a', 'studyroom-desktop://auth:42/callback?code=a',
    'studyroom-desktop://auth/callback?code=', `studyroom-desktop://auth/callback?code=${'a'.repeat(2049)}`]) {
    assert.throws(() => p.parseAuthCallback(url), { message: 'INVALID_CALLBACK' });
  }
});

test('camera allows exact trusted top-frame video-only request and check forms', () => {
  const p = policy();
  const base = { requestingOrigin: origin, isMainFrame: true };
  assert.equal(p.allowPermission('media', { ...base, mediaTypes: ['video'] }), true);
  assert.equal(p.allowPermission('media', { ...base, mediaType: 'video' }), true);
  for (const details of [{ ...base, mediaTypes: ['video', 'audio'] }, { ...base, mediaTypes: [] },
    { ...base, mediaType: 'audio' }, { ...base, mediaType: 'unknown' },
    { ...base, mediaTypes: ['video'], mediaType: 'audio' },
    { ...base, mediaTypes: ['video'], isMainFrame: false }, { mediaTypes: ['video'], isMainFrame: true },
    { ...base, mediaTypes: ['video'], requestingOrigin: `${origin}.evil.test` }]) {
    assert.equal(p.allowPermission('media', details), false);
  }
  assert.equal(p.allowPermission('display-capture', { ...base, mediaTypes: ['video'] }), false);
});
