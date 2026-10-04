# Android 앱 내부 APK 업데이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 앱에서 검증된 새 APK를 확인·다운로드하고 사용자 승인으로 Android 설치 화면을 연다.
**Architecture:** 공개 Vercel 출시 JSON과 공개 GitHub Release APK를 사용한다. Expo 로컬 Android updater가 설치 버전·제한 다운로드·무결성/서명 검사·설치 화면을 맡고, RN의 독립 업데이트 패널이 상태와 명시적 사용자 액션을 제공한다. 공부 상태는 설치 직전 기존 조회 경로로 확인하며 updater가 공부/인증 데이터를 수정하지 않는다.
**Tech Stack:** Expo53, RN0.79, TypeScript, Kotlin, Android PackageManager/FileProvider, Node test, 기존 Gradle release 빌드, GitHub Releases, Vite/Vercel.
**Spec:** memory-bank/prd-android-app-updates.md (2026-10-04 상세 설계·GitHub 게시 승인).

## Global Constraints

- 패키지 com.jini9867.studyroomattendance와 현재 배포된 APK 서명 인증서를 유지한다. 비밀값/keystore/환경 파일은 Git·리뷰 파일·APK release에 넣지 않는다.
- 기존 로그인·6개 메뉴·공부·카메라·집중 모드 변경을 보존한다. Supabase DB/RLS/함수·권한 정책을 수정하지 않는다.
- 업데이트 성공은 실제 설치 versionCode로 판단한다. 표시 날짜·versionName·설치 화면 진입은 성공 근거가 아니다.
- 출시 schemaVersion=1, JSON 최대16KiB, 전체 확인 제한12초, APK 최대150MiB, SHA256 64자리 hex, versionCode 정수1..2100000000.
- apkUrl은 query/fragment/userinfo 없는 https://github.com/zxcc9867/studyRoom/releases/download/<tag>/<filename>.apk. 리디렉션 최대5회, github.com과 release-assets.githubusercontent.com의 HTTPS/443만 허용한다. CDN 서명 query는 전송에만 사용하고 로그에 남기지 않는다.
- APK 접속15초·읽기30초·총10분 제한, 진행 상태 전송250ms 이상 간격, 전용 cache child에만 쓰고 취소/실패/24시간 지난 파일만 정리한다.
- 파일 크기·해시·패키지·versionCode·동일 signer 검증 후 설치하며 설치 직전 다시 검증한다. 낮은/같은 빌드를 설치하지 않는다.
- 설치 권한 설정과 설치 화면은 사용자 버튼으로만 연다. 설정 복귀·앱 시작·백그라운드에서 설치/다운로드/공부를 자동 시작하지 않는다.
- 공부 중/공부 상태 조회 실패이면 설치를 미룬다. 로그인 전 업데이트 확인은 허용하고 현재 로그인 계정이 없으면 서버 인증 조회를 요구하지 않는다.
- 첫 updater APK는 수동 설치가 필요하다. OTA/Play/강제 업데이트는 제외한다.
- 수정은 apply_patch로 한다. 경로 claim 후 최신 내용을 읽고 수정한다. 다른 작업의 dirty 변경을 되돌리지 않는다. Task worker는 다른 agent를 만들지 않으며 독립 리뷰는 controller가 맡는다.
- 작업트리는 C:/jini-dev/worktrees/study-room-recovery-audit, branch codex/recovery-consistency. 리뷰용 diff에는 비밀값을 넣지 않는다. 커밋은 controller가 최종 배포 의존성을 확인해 수행하고 worker는 허가한 경로만 수정한다.

## Task 1: 네이티브 안전 다운로드·설치 모듈

**Files:**
- Create: apps/mobile/modules/my-module/android/src/main/java/expo/modules/studyfocusmode/StudyAppUpdateModule.kt
- Create: 같은 디렉터리 UpdatePolicy.kt, StudyAppUpdateFileProvider.kt, 필요하면 독립 UpdateDownloader.kt/UpdateStorage.kt (책임 분리용, 다른 모듈은 변경하지 않는다)
- Create: apps/mobile/modules/my-module/android/src/main/res/xml/study_update_paths.xml
- Create: apps/mobile/modules/my-module/android/src/test/java/expo/modules/studyfocusmode/UpdatePolicyTest.kt
- Create: apps/mobile/modules/my-module/src/StudyAppUpdateModule.ts
- Modify: 같은 모듈 android/build.gradle, AndroidManifest.xml, expo-module.config.json

**Interfaces:**
```ts
type AndroidRelease = { schemaVersion: 1; packageName: string; versionName: string; versionCode: number; releasedAt: string; releaseNotes: string[]; apkUrl: string; sha256: string; sizeBytes: number };
type InstalledVersion = { supported: boolean; packageName: string; versionName: string; versionCode: number };
type NativeUpdateState = { phase: 'idle'|'downloading'|'verifying'|'ready'|'failed'|'cancelled'|'install_pending'|'installed'; downloadedBytes: number; totalBytes: number; versionCode: number|null; errorCode: string|null; release: AndroidRelease|null };
// requireOptionalNativeModule<StudyAppUpdate>('StudyAppUpdate') default export
// Events onUpdateState payload: NativeUpdateState
getInstalledVersion(): InstalledVersion;
getState(): NativeUpdateState;
fetchLatestRelease(): Promise<AndroidRelease>; // 固定 manifest URL only, no argument
downloadRelease(release: AndroidRelease): Promise<NativeUpdateState>;
cancelDownload(): NativeUpdateState;
canInstall(): boolean;
openInstallPermissionSettings(): void;
installDownloaded(): Promise<NativeUpdateState>; // no URL/path argument
addListener('onUpdateState', listener: (state: NativeUpdateState)=>void): { remove(): void };
```

- [ ] Step 1 RED: write JVM tests of real UpdatePolicy validation and bounded read/hash helpers. Hand-derived fixtures cover accepted release URL, wrong repo/HTTP/userinfo/query/encoded traversal, redirect host mismatch, fractional/low/same version, empty/oversize/invalid SHA, byte overflow/truncation, cancelled read, exact hash mismatch. Example:
```kotlin
@Test fun rejectsForeignRepository() {
  assertThrows(IllegalArgumentException::class.java) {
    UpdatePolicy.validateArtifactUrl("https://github.com/attacker/repo/releases/download/v1/app.apk")
  }
}
@Test fun acceptsOwnedRelease() {
  assertEquals("github.com", UpdatePolicy.validateArtifactUrl("https://github.com/zxcc9867/studyRoom/releases/download/android-v0.2.0-build3/study-room.apk").host)
}
```
- [ ] Step 2: run the module Gradle unit test using the existing output/android-local-build project with E:/Android/Sdk, JDK21, existing Gradle cache. Before production module exists, verify missing behavior failure; do not treat a missing SDK as the intended RED.
- [ ] Step 3 GREEN: implement policy, private updater storage, single background download, bounded HTTPS redirects, cancellation that does not queue behind the download, temporary files, progress and recovery. Native fetchLatestRelease reads only the fixed Vercel URL with16KiB/12s limit, then validates every schema field.
```kotlin
private const val RELEASE_URL = "https://study-room-attendance.vercel.app/download/android-release.json"
private const val MAX_APK_BYTES = 150L * 1024L * 1024L
// Manifest provider must expose only cacheDir/study-updates/, exported=false.
// Before install: verify installed code < target, exact package and complete signer-set match.
```
- [ ] Step 4: add REQUEST_INSTALL_PACKAGES and non-exported provider, register StudyAppUpdate module without removing StudyFocusMode. Get installed version with PackageManager, not the module library version. canInstall uses Android canRequestPackageInstalls. Open source settings for only this package. FileProvider APK ACTION_VIEW with temporary read grant opens the OS confirmation; return install_pending, never installed. On next native state read, verify actual native version to detect completion.
- [ ] Step 5: unit tests GREEN, mobile typecheck, module compile/merged manifest verification. Add exact output and RED/GREEN evidence to task report. No commit/push or native focus implementation edits by worker.

## Task 2: 출시 검증·상태 hook·앱 업데이트 UI

**Files:**
- Create: apps/mobile/src/appUpdate.ts, useAppUpdate.ts, AppUpdatePanel.tsx
- Create: scripts/mobile-app-update.test.mjs (real TS/Babel and RN component behavior)
- Modify: apps/mobile/App.tsx, app.json, eas.json
- Modify as needed: scripts/mobile-otp.test.mjs, mobile-recovery.test.mjs, mobile-timer.test.mjs, mobile-web-features.test.mjs, mobile-focus-status.test.mjs import harnesses only; preserve existing assertions.

**Consumes:** Task1 default native module and exact type/method/event contract above. Existing App.refreshData/read ownership/active session and mobilePalette are reused.
**Produces:**
```ts
export function validateAndroidRelease(value: unknown): AndroidRelease;
export function isNewerRelease(release: AndroidRelease, installed: InstalledVersion): boolean;
export function getUpdateErrorMessage(error: unknown): string;
export function useAppUpdate(beforeInstall: ()=>Promise<'allowed'|'studying'|'unknown'>): AppUpdateController;
export function AppUpdatePanel(props: { palette: StudyPalette; beforeInstall: ()=>Promise<'allowed'|'studying'|'unknown'> }): React.ReactElement|null;
// AppUpdateController encapsulates current/version/status/error/progress, open/close/check/download/cancel/install/settings actions.
```

- [ ] Step 1 RED: write real source tests with boundary double only for Android native/OS and RN host. Mutation-sensitive behaviors: currentcode3 + release2/3 no update; current2 + release3 update; versionName999/current3 + release0.2.0/code4 still update; wrong schema/origin/repo/query/NaN/fraction/size/SHA/notes/date rejects; check timeout/failure not latest. Example:
```js
assert.equal(api.isNewerRelease(release({versionCode:3}), {supported:true,packageName:'com.jini9867.studyroomattendance',versionName:'9.9.9',versionCode:2}), true);
assert.throws(()=>api.validateAndroidRelease(release({apkUrl:'https://github.com/other/repo/releases/download/v1/app.apk'})));
```
- [ ] Step 2: run node --test scripts/mobile-app-update.test.mjs to prove missing behavior. Then implement schema checks and normalized Korean errors without raw native/server messages or artifact signed URLs.
- [ ] Step 3 RED/GREEN UI: actual AppUpdatePanel/useAppUpdate rendering and actions. Login/foreground entry remains usable; initial check once; manual check; native progress; cancel; duplicate buttons; native error; outdated async result/unmount; server studying/unknown installation gate; permission settings requires user press; returning does not install; explicit installPending never success; installed actual code success. Add dynamic type/scroll/44dp/accessible dialog/live text contract. Use existing palette and restrained layout; no new fonts/menu redesign.
- [ ] Step 4: wire a shared controller/panel in App login + WebView/fallback branches without resetting native Auth/WebView. Native installation guard re-reads existing current owner's active session at button time (error => unknown, active unpaused => studying, no user => allowed), rechecks owner after await, and performs no write.
- [ ] Step 5: app.json version0.2.0/android.versionCode3 and eas.json cli.appVersionSource local. Internal updater bootstrap2 is built only in generated output; never edit committed product version down to2 or publish it as latest. Compile/RN focused tests and mobile:check GREEN. Report exact files/diff/test evidence, do not stage App wholesale or remove pre-existing focus changes.

## Task 3: 출시 JSON·고정 설치 안내 게시 계약

**Files:**
- Create: scripts/android-release.mjs, scripts/android-release.test.mjs
- Create when final APK exists: apps/web/public/download/android-release.json
- Modify: vercel.json, apps/web/public/download/android.html, scripts/android-download.test.mjs

**Interfaces:**
```js
export function buildAndroidRelease({versionName,versionCode,releasedAt,releaseNotes,apkUrl,apkBytes}) { /* returns schema1 manifest using actual Buffer SHA256/length */ }
// No key, token, local path or guessed EAS date in public manifest.
```

- [ ] Step 1 RED: test builder with literal Buffer('apk-fixture') -> hand-checked size/hash; invalid GitHub owner/code/date/notes rejected. Simulated route serves application/json and no-store before SPA and APK route307 points to same apkUrl as manifest. The fixture must not be posted as product metadata.
```js
const route = routes.find(r => r.src && new RegExp(`^${r.src}$`).test('/download/android-release.json'));
assert.equal(route.dest, '/download/android-release.json');
assert.equal(route.headers['Cache-Control'], 'no-store');
```
- [ ] Step 2 GREEN: implement builder and new route. Until verified candidate APK exists, do not invent production release JSON or change fixed APK Location. Download page explains first manual updater APK install, later app update button, OS source permission/user confirmation, deletion-free update and version0.2.0/build3. Current page has no JS needed.
- [ ] Step 3: after Task4 candidate is verified, use actual bytes/hash/version and final GitHub release URL to create JSON with apply_patch; update fixed alias and page together. Add contract tests for matching fields/url/header routes and existing API/SPA.
- [ ] Step 4: run focused release/download tests and actual375/1440 browser with bundled Chromium, web build, docs check. No generic web redesign or study API changes.

## Task 4: Android16 실제 설치·공개 APK·웹 배포

**Owner:** controller handles private signing/build/deployment and project memory-bank, not external reviewers. This task changes generated output and release publication only after source task gates.
**Files:** generated output/android-local-build; final output/study-room-0.2.0-build3.apk; updater bootstrap output/study-room-updater-bootstrap2.apk; Task3 final manifest; active-context/progress/implementation-plan/trouble-shooting/PRD.

- [ ] Step 1: run full npm.cmd test, mobile:check, web build, docs:check, Edge tests. Record pass/fail/skips separately; no lint script means not claim lint passed.
- [ ] Step 2: use existing JDK21/SDK E:/Android/Sdk and private same-signing credentials, do not log values. Existing generated Gradle project points to current App.tsx/modules. Update generated versionCode2/versionName0.2.0 for bootstrap, build release, verify signer/package/version, adb install -r; verify login retained and panel entry. Build same source code3 for final release, verify code3/icon/signer and native permissions/provider.
```powershell
$env:ANDROID_HOME='E:/Android/Sdk'
$env:GRADLE_USER_HOME='E:/Android/Gradle'
# private signing env is populated from existing approved private file without printing it
& ./gradlew.bat :app:assembleRelease --no-daemon --console=plain
& E:/Android/Sdk/platform-tools/adb.exe install -r <verified-bootstrap-apk>
```
- [ ] Step 3: user authorized public GitHub Release android-v0.2.0-build3. Draft release -> upload only verified final APK -> publish -> anonymous HTTP/hash/size check. No APK/source signature secret/credential attachments. Verify immutable file rather than reusing/replacing a previous release tag. EAS is optional build route; local release uses same existing key.
```powershell
gh release create android-v0.2.0-build3 --repo zxcc9867/studyRoom --target <verified-source-commit> --title '독서실 Android 0.2.0 (3)' --draft --notes '앱에서 업데이트 확인·다운로드·Android 설치 확인을 지원합니다. 최초 한 번은 APK를 수동 설치하세요.'
gh release upload android-v0.2.0-build3 output/study-room-0.2.0-build3.apk --repo zxcc9867/studyRoom
gh release edit android-v0.2.0-build3 --repo zxcc9867/studyRoom --draft=false
```
- [ ] Step 4: finalize Task3 manifest/alias/page, verify tests, scoped commit/push main under existing web deployment authorization, wait for .github/workflows/vercel-production.yml success, Vercel READY and production HTTP200/JSON200/no-store/alias307->APK200/hash match. Never count deployment requested as completed.
- [ ] Step 5: bootstrap2 app checks production code3, user-triggered actual download + cancel/retry, permission explanation -> Android source settings -> return with no automatic install -> install button -> OS update confirmation -> real code3. ADB/UIAutomator screenshots and UI dumps, no login secret capture. Verify native/web session and6tabs retained after install. Do not create study/recovery writes or toggle DND in these tests. If a study gate is active, use controlled mounted test for that condition rather than modifying user study data.
- [ ] Step 6: final whole-branch review and fix gate, memory-bank exact checks/deployment IDs/limitations, release claims. Do not delete source worktree, existing output or other task's scratch. Remove only this plan's scratch if appropriate after evidence survives in git/docs.

## Preflight coverage / dependency checks

- Task1 native fetch/state/type methods feed Task2 only; Task2 uses exactly the contract above, not an arbitrary URL/path installer bridge.
- Task3 waits for Task4 final actual APK to publish fields; its builder/route tests can be reviewed before candidate exists. Task4 depends on1/2 code gates and3 contract tests, then finalizes3 with actual values.
- Task2 app/version and4 generated bootstrap are different scopes; committed source always code3, internal code2 never public latest.
- Task2 touches dirty App/tests; preserve prior focus improvements and include their already deployed necessary imports/files in final commit without unrelated untracked output.
- Reviewer artifacts in this plan's .superpowers/sdd directory; source commits are controller-gated. Spec is authoritative; record any implementation ruling and its cost in ledger.
