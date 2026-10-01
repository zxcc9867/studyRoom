import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('Android camera permission is declared without microphone permission', () => {
  const config = JSON.parse(readFileSync(path.join(root, 'apps/mobile/app.json'), 'utf8'));
  assert.ok(config.expo.android.permissions.includes('CAMERA'));
  assert.equal(config.expo.android.permissions.includes('RECORD_AUDIO'), false);
});

test('Android WebView allows canonical first-party video origin and rejects other resources and origins', () => {
  const installed = readFileSync(path.join(root, 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebChromeClient.java'), 'utf8');
  const methodStart = installed.indexOf('public void onPermissionRequest(final PermissionRequest request) {');
  const guardStart = installed.indexOf('{', methodStart) + 1;
  const guardEnd = installed.indexOf('grantedPermissions = new ArrayList<>();', guardStart);
  assert.ok(methodStart >= 0 && guardEnd > guardStart);
  const guard = installed.slice(guardStart, guardEnd);
  const directory = mkdtempSync(path.join(tmpdir(), 'study-webview-policy-'));
  const java = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    : process.platform === 'win32' ? 'C:/Program Files/Microsoft/jdk-21.0.12.8-hotspot/bin/java.exe' : 'java';
  try {
    const source = path.join(directory, 'PermissionPolicy.java');
    writeFileSync(source, `
import java.net.URI;
class PermissionPolicy {
static class PermissionRequest {
  static final String RESOURCE_VIDEO_CAPTURE = "video";
  URI origin; String[] resources; boolean denied;
  PermissionRequest(String origin, String[] resources) { this.origin = origin == null ? null : URI.create(origin); this.resources = resources; }
  URI getOrigin() { return origin; }
  String[] getResources() { return resources; }
  void deny() { denied = true; }
}
  static void check(PermissionRequest request) { ${guard} }
  static void result(String origin, String[] resources) {
    PermissionRequest request = new PermissionRequest(origin, resources);
    check(request); System.out.println(request.denied);
  }
  public static void main(String[] args) {
    result("https://study-room-attendance.vercel.app", new String[]{"video"});
    result("https://study-room-attendance.vercel.app/", new String[]{"video"});
    result("https://study-room-attendance.vercel.app.evil.test/", new String[]{"video"});
    result("http://study-room-attendance.vercel.app/", new String[]{"video"});
    result("https://study-room-attendance.vercel.app/", new String[]{"audio"});
    result("https://study-room-attendance.vercel.app/", new String[]{"video", "audio"});
    result("https://study-room-attendance.vercel.app/", new String[]{});
    result(null, new String[]{"video"});
  }
}`);
    const result = spawnSync(java, [source], { encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), ['false', 'false', 'true', 'true', 'true', 'true', 'true', 'true']);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
