import assert from 'node:assert/strict';
import test from 'node:test';
import { requestNativeCameraPermission } from '../src/nativeCameraPermission.mjs';
import { getCameraDiagnostic } from '../src/cameraDiagnostics.mjs';

function host() {
  const listeners = new Set();
  const sent = [];
  return { location: { origin: 'https://study-room-attendance.vercel.app' },
    crypto: { randomUUID: () => 'camera-1' }, ReactNativeWebView: { postMessage: raw => sent.push(JSON.parse(raw)) },
    addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn),
    reply: detail => listeners.forEach(fn => fn({ detail })), sent, listeners,
  };
}
test('desktop camera does not wait for a native bridge', async () => {
  assert.equal(await requestNativeCameraPermission({ location: { origin: 'http://localhost' } }), 'unavailable');
});
test('native camera response ignores unrelated auth and wrong request IDs, then cleans listeners', async () => {
  const h = host();
  const pending = requestNativeCameraPermission(h);
  assert.deepEqual(h.sent, [{ type: 'STUDY_WEB_CAMERA_PERMISSION', requestId: 'camera-1' }]);
  h.reply({ type: 'STUDY_WEB_AUTH_TICKET', requestId: 'camera-1', status: 'granted' });
  h.reply({ type: 'STUDY_NATIVE_CAMERA_PERMISSION', requestId: 'other', status: 'granted' });
  assert.equal(h.listeners.size, 1);
  h.reply({ type: 'STUDY_NATIVE_CAMERA_PERMISSION', requestId: 'camera-1', status: 'blocked' });
  assert.equal(await pending, 'blocked');
  assert.equal(h.listeners.size, 0);
});
test('old APK without new bridge times out to WebView OS permission fallback', async () => {
  const h = host();
  assert.equal(await requestNativeCameraPermission(h, 5), 'unavailable');
  assert.equal(h.listeners.size, 0);
});
test('new APK permission timeout never falls through to automatic camera access', async () => {
  const h = host(); h.studyRoomNativeCameraPermission = true;
  assert.equal(await requestNativeCameraPermission(h, 5), 'cancelled');
  assert.equal(h.listeners.size, 0);
});
test('embedded permission diagnostics guide to app settings, desktop keeps site permissions', () => {
  const input = { activeSession: false, cameraEnabled: false, cameraStatus: 'error', healthReason: 'permission-denied' };
  assert.match(getCameraDiagnostic({ ...input, embeddedAndroid: true }).checks.join(' '), /앱 설정/);
  assert.doesNotMatch(getCameraDiagnostic({ ...input, embeddedAndroid: true }).checks.join(' '), /주소창/);
  assert.match(getCameraDiagnostic(input).checks.join(' '), /주소창/);
});
