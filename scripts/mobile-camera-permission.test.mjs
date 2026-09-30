import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Android camera permission is declared without microphone permission', () => {
  const config = JSON.parse(readFileSync(path.join(root, 'apps/mobile/app.json'), 'utf8'));
  assert.ok(config.expo.android.permissions.includes('CAMERA'));
  assert.equal(config.expo.android.permissions.includes('RECORD_AUDIO'), false);
});

test('the install-applied Android WebView policy rejects off-origin and non-video permission requests', () => {
  const patch = readFileSync(path.join(root, 'patches/react-native-webview+13.13.5.patch'), 'utf8');
  const installed = readFileSync(path.join(root, 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebChromeClient.java'), 'utf8');
  const source = `${patch}\n${installed}`;
  assert.match(source, /request\.getOrigin\(\)\.toString\(\)/);
  assert.match(source, /https:\/\/study-room-attendance\.vercel\.app/);
  assert.match(source, /RESOURCE_VIDEO_CAPTURE/);
  assert.match(source, /request\.deny\(\)/);
  assert.match(readFileSync(path.join(root, 'package.json'), 'utf8'), /"postinstall"\s*:\s*"patch-package"/);
});
