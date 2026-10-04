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
static class Manifest { static class permission { static final String CAMERA = "camera"; } }
static class PackageManager { static final int PERMISSION_GRANTED = 1; }
static class ContextCompat { static int permission = 1; static int checkSelfPermission(Object context, String name) { return permission; } }
static class WebView { Object getThemedReactContext() { return this; } }
static WebView mWebView = new WebView();
static class PermissionRequest {
  static final String RESOURCE_VIDEO_CAPTURE = "video";
  URI origin; String[] resources; boolean denied;
  PermissionRequest(String origin, String[] resources) { this.origin = origin == null ? null : URI.create(origin); this.resources = resources; }
  URI getOrigin() { return origin; }
  String[] getResources() { return resources; }
  void deny() { denied = true; }
}
  void check(PermissionRequest request) { ${guard} }
  static void result(String origin, String[] resources) {
    PermissionRequest request = new PermissionRequest(origin, resources);
    new PermissionPolicy().check(request); System.out.println(request.denied);
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

test('native video callback never requests OS permission, including revocation after preflight',()=>{
 const installed=readFileSync(path.join(root,'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebChromeClient.java'),'utf8');
 const start=installed.indexOf('public void onPermissionRequest(final PermissionRequest request) {');
 const end=installed.indexOf('@Override',start);
 const method=installed.slice(start,end);
 const directory=mkdtempSync(path.join(tmpdir(),'study-camera-no-prompt-'));
 const java=process.platform==='win32'?'C:/Program Files/Microsoft/jdk-21.0.12.8-hotspot/bin/java.exe':'java';
 try {
  const file=path.join(directory,'NoPrompt.java');
  writeFileSync(file,`import java.net.URI; import java.util.ArrayList;
class NoPrompt {
static class Manifest { static class permission { static final String CAMERA="camera",RECORD_AUDIO="audio"; } }
static class PackageManager { static final int PERMISSION_GRANTED=1; }
static class ContextCompat { static int[] values; static int index; static int checkSelfPermission(Object c,String p){return values[Math.min(index++,values.length-1)];} }
static class WebView { Object getThemedReactContext(){return this;} } WebView mWebView=new WebView();
static class PermissionRequest { static final String RESOURCE_VIDEO_CAPTURE="video",RESOURCE_AUDIO_CAPTURE="audio",RESOURCE_PROTECTED_MEDIA_ID="protected"; boolean denied,granted; URI getOrigin(){return URI.create("https://study-room-attendance.vercel.app/");} String[] getResources(){return new String[]{"video"};} void deny(){denied=true;} void grant(String[] p){granted=true;} }
ArrayList<String> grantedPermissions; boolean mAllowsProtectedMedia; PermissionRequest permissionRequest; int osRequests;
void requestPermissions(ArrayList<String> permissions){osRequests++;}
${method}
static void check(int[] states){ContextCompat.values=states;ContextCompat.index=0;NoPrompt c=new NoPrompt();PermissionRequest r=new PermissionRequest();c.onPermissionRequest(r);System.out.println(r.denied+","+r.granted+","+c.osRequests);}
public static void main(String[] args){check(new int[]{1,1});check(new int[]{0,0});check(new int[]{1,0});}
}`);
  const result=spawnSync(java,[file],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stderr);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/),['false,true,0','true,false,0','true,false,0']);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
