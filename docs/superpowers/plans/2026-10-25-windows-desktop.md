# Windows 독서실 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 기존 웹/Android와 같은 화면·서버 기록을 사용하는 Windows 설치형 앱을 만들고 X→트레이에서 공부·카메라를 유지한다.

**Architecture:** Electron main은 창·트레이·권한·네이티브 인증만 소유한다. 기존 DashboardApp과 Supabase가 모든 공부 상태·시간·카메라 담당을 계속 소유한다. 검증된 최상위 문서의 좁은 preload 브리지로 연결한다.

**Tech Stack:** Electron 45.0.0, electron-builder 26.18.0, Supabase JS(현재 설치된 정확한 버전 확인 후 고정), 기존 React19/Vite/TypeScript, Node test, 실제 Electron 통합 검사, NSIS x64.

**Spec:** `docs/superpowers/specs/2026-10-24-windows-desktop-design.md`

## Global Constraints

- X는 창을 트레이로 숨긴다. 창과 웹 문서를 파괴하거나 새로 불러오지 않는다.
- 내부 화면은 기존 Vercel 웹앱을 재사용한다. 별도 대시보드나 학습 DB를 만들지 않는다.
- production origin은 `https://study-room-attendance.vercel.app`, callback은 `studyroom-desktop://auth/callback`, Windows 버전은 `0.1.0`이다.
- 기존 출석·회복·단일 세션·카메라 담당·기기 단위 참여 정책을 보존한다. Android 버전은 변경하지 않는다.
- 활성화된 OAuth 제공자는 시스템 브라우저 PKCE, 이메일은 기존 8자리 코드를 제공한다. 현재 운영은 Google·이메일이며 GitHub는 비활성화라 공통 UI에 새 버튼을 만들지 않는다(네이티브 계약은 GitHub 지원). 장기 네이티브 토큰은 웹·URL·로그에 전달하지 않는다.
- IPC는 정확한 origin·현재 mainFrame·문서 세대·요청 ID를 검증하고 비동기 작업 후 재검증한다. 카메라는 최상위 video-only 요청만 허용한다.
- per-user NSIS x64 설치. 자동 시작·절전 변경·오프라인·자체 자동 업데이트·공개 Windows Release 게시·유료 구매는 제외한다.
- 테스트 항목은 `[테스트] Windows ...`로 식별하고 기존 학습·회복 기록을 삭제하거나 잠금을 우회하지 않는다.
- 선행 dirty 파일을 보존한다. task 단위 중간 커밋/푸시는 하지 않고 전체 검증·독립 검토 후 이번 경로만 커밋한다(프로젝트 Git 규칙 우선).

## Shared bridge contract

`window.studyRoomDesktop`은 `protocolVersion:1`, `request({id, action, payload})`, `onEvent(listener):unsubscribe`만 제공한다. `request`는 아래 action만 받아 `Promise<{id,ok,value?,error?}>`를 반환한다. 오류는 비밀 없는 고정 코드다. 구체 handler가 입력 스키마를 검증하며 알 수 없는 필드는 거부한다.

| Action | payload | value |
|---|---|---|
| info | `{}` | `{platform:'windows',version,build,protocolVersion:1,secureStorage:boolean}` |
| authStatus | `{}` | `{userId:string|null}` |
| sendCode | `{email}` | `{sent:true}` |
| verifyCode | `{email,code}` | `{userId}` |
| signInProvider | `{provider:'google'|'github'}` | `{opened:true}` |
| webTicket | `{}` | `{type:'STUDY_WEB_AUTH_TICKET',requestId:id,userId,tokenHash}` |
| signOut | `{}` | `{signedOut:true}` |
| cameraConsent | `{}` | `{allowed:boolean}` |
| openCameraSettings | `{}` | `{opened:true}` |
| studyState | `{userId,ready,session:{id,paused}|null,cameraActive,operationPending,activity:'studying'|'allowed'|'unknown'}` | `{accepted:true}` |
| cancelQuit | `{requestId}` | `{cancelled:true}` |

Native events are `{type:'auth-changed'}` / `{type:'quit-requested',requestId,userId,sessionId,localEngagement}` / `{type:'state-requested',requestId}`. Quit context is captured from that matching verified probe; userId/sessionId are nullable identifiers and localEngagement is a boolean. Web validates current user/session before completion and can finish a locally engaged paused session without treating an observer's pending write as participation. Each document subscribes once and removes listeners on cleanup. Web calls have a bounded timeout. Main authorizes studyState.userId against its verified current user, records receipt time, and does not accept renderer-supplied timestamps. Main invalidates document proof and cached state on real navigation (not hash changes). Explicit quit first sends state-requested and waits up to5s for a studyState with envelope.id===requestId from the current document, then decides. Periodic cached idle alone cannot authorize quitting.

For desktop only, `activity` proves execution participation separately from current camera/pending flags: evaluate tracker with a copy of state whose cameraActive/operationPending are false, while publishing the real flags unchanged. This prevents an observer's transient write or camera-only preparation from latching a remote session as locally engaged. Unknown readiness/storage stays unknown; native still blocks pending operations and requests camera cleanup using the real flags.

Exception limited to camera-only preparation: ready+session:null+cameraActive+no actual asynchronous work may publish activity allowed, because the existing tracker preparing latch otherwise yields unknown despite there being no session to end. Keep cameraActive true so this requests web stop cleanup, never direct quit. The desktop-only pending snapshot may exclude stable pre-study selection waiting for the user, but must retain busy/starting/recovery/server-start/unresolved actual-intent work. Shared Android snapshot/tracker behavior is unchanged; after stopping camera a fresh independently known idle is still required.

## Task 1: Desktop policy, encrypted authentication and lifecycle units

**Files:** Create `apps/desktop/src/desktopPolicy.mjs`, `desktopAuth.mjs`, `desktopStorage.mjs`, `desktopLifecycle.mjs` and corresponding `apps/desktop/test/*.test.mjs`.

**Interfaces:**
- `createDesktopPolicy({origin})`: `isTrustedUrl(url)`, `isTrustedSender(event,webContents)`, `parseRequest(value)`, `parseAuthCallback(url)`, `allowPermission(kind,details)`.
- `createEncryptedStorage({safeStorage,read,write,remove})`: Supabase `getItem/setItem/removeItem`, plus `secure` boolean. All disk content encrypted; unavailable encryption uses memory only.
- `createDesktopAuth({supabase,storage,openExternal,now,onChange})`: `status()`, `sendCode(email)`, `verifyCode(email,code)`, `signInProvider(provider)`, `handleCallback(url)`, `webTicket(requestId)`, `signOut()`, `dispose()`. Supply one pending persisted PKCE attempt, deduplicate callbacks, no stale identity ticket after logout.
- `createDesktopLifecycle({now})`: `update(state)`, `invalidate()`, `view()`, `requestQuit()`, `cancelQuit(id)`. Returns decisions, never touches server. Retains a locally engaged session through pause; observer sessions never acquire that engagement. Persist only safe local engagement metadata through injected storage when needed.

- [x] Write behavior tests first. For example:

```js
assert.equal(policy.isTrustedUrl('https://study-room-attendance.vercel.app.evil.test'), false);
assert.equal(policy.allowPermission('media', {isMainFrame:true,mediaTypes:['video','audio']}), false);
const life = createDesktopLifecycle({now:()=>1000});
life.update({userId:'u',ready:true,session:{id:'s',paused:false},cameraActive:false,operationPending:false,activity:'allowed'});
assert.equal(life.requestQuit().action, 'quit'); // observing another device
```

- [x] Run `node --test apps/desktop/test/*.test.mjs`, capture expected missing-feature RED. Use dynamic import with an asserted feature availability if needed so missing modules fail an assertion rather than an unrelated syntax error.
- [x] Implement pure policies with URL parsing/exact origin; no filesystem/shell in policy. Validate exact payload keys, bounded strings, booleans and session. Reject token fragments and duplicate query parameters in auth callbacks. OAuth URL must match the configured Supabase HTTPS authorize path, not an arbitrary returned link.
- [x] Auth uses existing `mobile-web-auth`: current native `getUser` → authenticated function call → same-user ticket validation, bounded timeout; no raw error/token output. PKCE pending state survives normal app restart encrypted, expires after 5 minutes, is canceled by logout/account change. `safeStorage` fallback never writes plaintext.
- [x] Test logout during ticket issue/code exchange, malformed ticket/other user, replay/unpending/expired callback, storage unavailable/failure, paused local versus remote observer, stale/unknown state and unresolved write. Then GREEN command above and `git diff --check`; self-review. Report without commit.

## Task 2: Electron runtime, secure IPC, tray and Windows packaging

**Files:** Create `apps/desktop/main.cjs`, `preload.cjs`, `package.json`, `scripts/prepare.mjs`, `src/desktopRuntime.mjs`, `src/desktopRuntime.test.mjs` (tests may instead live in `test/`), local error page; modify root `package.json`, `package-lock.json`, `.gitignore`, `.ai/dune/rules.json`, `.github/workflows/vercel-production.yml` install environment only and `memory-bank/architecture-map.md` Windows section only.

**Interfaces:** Consumes Task1 factories and shared bridge contract. Produces launchable workspace `@study-room/desktop`, root `desktop:check`, `desktop:test`, `desktop:start`, `desktop:build`. Build output `apps/desktop/dist/`, appId `app.studyroom.desktop`, productName `독서실`, executableName `StudyRoom`, artifact `StudyRoom-Setup-0.1.0-x64.exe`.

- [x] Write runtime tests first using Electron adapters: trusted current frame only, navigation epoch invalidation after awaited handler, X never destroys/reloads/stops, tray creation failure retains window, duplicate launch restores, late quit state rejected, blocked permission never reaches confirmation, explicit permission dialog cancel, renderer crash recovery.
- [x] Run focused tests RED, then implement runtime with one BrowserWindow:

```js
const webPreferences = {
  preload: preloadPath, sandbox:true, contextIsolation:true,
  nodeIntegration:false,nodeIntegrationInSubFrames:false,webSecurity:true,
  backgroundThrottling:false,partition:'persist:study-room-desktop',
};
window.on('close', event => { if (!quitting) { event.preventDefault(); hideToTray(); } });
```

- [x] Guard all IPC before/after async work. Permission check and request handlers require same webContents + exact requesting origin + main frame + video only. Only the explicit cameraConsent action opens the camera purpose confirmation and grants current-document consent. Permission handlers themselves never open UI; they only allow already-consented video and otherwise deny. Automatic camera recovery/settings entry must not prompt. Deny mic/display/unknown. External HTTPS links open via safe system browser; navigation stays production, dev loopback only in explicit unpackaged mode.
- [x] Create tray with existing `apps/mobile/assets/study-room-icon.png`; first-hide notice, fresh status, show, explicit exit. Before any safe quit, require the current-document state-requested probe with matching response ID within5s; a recently cached idle may precede a just-started write. Restore window for existing web completion; when renderer fails/unknown offer retry/cancel and an explicitly warned process-only exit. No server end RPC from native. Retain local engagement through pause/restart and clear on verified idle/account change. Do not trap users when logged out. Test cached-idle/current-pending, probe timeout and old/mismatched response rejection.
- [x] Prepare only public Supabase URL/anon key from existing local environment into ignored packaged config, validate key role/publishable form and refuse secret/service-role values. Copy existing PNG icon (no image redesign). Pin Electron45.0.0/builder26.18.0 and actual installed Supabase version. `electron-builder --win nsis --x64 --publish never`; per-user, no auto start/admin. Do not package `.env`, tests, logs, test fixtures, arbitrary repo files, or private build material.
- [x] Add desktop-only import boundaries and focused checks to Dune without removing existing rules. Run desktop focused tests/check, root build/mobile:check and diff check. Self-review and report without commit.
- [x] Web-only GitHub Actions install sets `ELECTRON_SKIP_BINARY_DOWNLOAD: '1'` so adding the workspace does not download an unused desktop binary during every web deployment. Actual local Windows install/build does not set this flag. Pure desktop unit/adapter tests remain runnable without a binary; actual Electron integration has its own command and explicit executable requirement.

## Task 3: Common web login, settings and existing study completion bridge

**Files:** Create `apps/web/src/desktopBridge.mjs`, `desktopBridge.d.mts`, `DesktopAuthGate.tsx`, `DesktopDeviceSettings.tsx`, and web desktop tests; modify `main.tsx` only desktop mount/auth/logout/study integration points, `AppDeviceSettings.tsx` platform branch.

**Interfaces:** Consumes shared bridge contract. `isDesktopStudyApp(host)`, `desktopRequest(host,action,payload,{id}?)`, `subscribeDesktop(host,listener)`. Optional id is only used to echo native state-requested probes; otherwise generate a fresh UUID. Gate hides protected children until main identity and ticket-exchanged web identity agree. Existing server API unchanged. Desktop settings use installed Windows info, not APK data.

- [x] Add helper and mounted tests first: spoofed/old/subframe bridges unavailable; request timeout/mismatched ID; same-user ticket only; logout during exchange; startup stale web identity hidden; common login OTP length8, enabled Google invokes native; failure/cancel/retry; Windows settings has no Android install/update claim. Native helper contract can still dispatch GitHub, but no disabled provider button is introduced.
- [x] Run RED focused tests, implement helpers and gate. Reuse the existing App login markup and route its handlers to desktop actions, keeping common `login-shell/login-panel` tokens and screen structure. Do not duplicate dashboard or a divergent login screen. Preserve enabled Google label, email code flow and accessibility; ordinary web and Android stay unchanged.
- [x] Mount desktop gate before App, separately from Android gate. Route desktop logout to native then clear local web session, never fall through to ordinary browser-only signout. Gate subscriptions use request/auth generation to discard late responses and account ABA.
- [x] Bind current `readDeviceStudyRef`/tracker to periodic native studyState (max3s), plus immediate state changes. Pass the desktop participation-only tracker snapshot defined above to distinguish observer; publish real pending/camera flags unchanged. Native quit context must match current user/session; localEngagement authorizes paused local completion. Event opens existing `openEndSessionCompletionModal`; `closeEndSessionCompletionModal` sends cancelQuit. Camera-only local preparation is cleaned with existing explicit stop path, no new study mutation. Bootstrap/loading/error stay unknown and pending flags prevent safe exit.
- [x] Before manual desktop camera start call cameraConsent and map allowed=false to cancelled. Preserve current `requestNativeCameraPermission` for Android/web. Automatic desktop recovery never invokes cameraConsent; it uses existing browser camera-permission query and denies silently if consent is unavailable. Windows permission settings uses openCameraSettings, not an Android APK action. Cover this in mounted tests.
- [x] On state-requested, immediately send current readDeviceStudyRef/tracker snapshot using its requestId as request envelope id; do not open completion UI merely to answer. While gate is signed out, send a known signed-out/idle state (userId/session null, no camera/pending writes, activity allowed); connecting/error remain unknown. Cover cached-state race, signed-out quit and mismatched probe IDs.

```js
const state = readState();
await desktopRequest(host,'studyState',{
  ...state, activity: tracker.check({...state,cameraActive:false,operationPending:false},state.session),
});
```

- [x] Windows settings show actual version/build, X→tray guidance, permission settings action and secure-storage warning. Keep common account/timezone/notifications and server phone connection status, but no Windows APK updater. Opening settings cannot request permission/start/end study.
- [x] Run desktop/web focused mounted tests, root tests/build/mobile:check. Existing core lifecycle tests remain unchanged except added Windows scenarios. Self-review and report without commit.

## Task 4: Actual Electron acceptance, installer, final review and release gates

**Files:** Create `apps/desktop/test/integration/*.mjs` and `docs/windows-desktop/verification-20261025.md`; update Windows PRD, implementation-plan, active-context/progress and trouble-shooting when a real failure is fixed. Controller owns operational validation/deployment and final staging.

**Interfaces:** Uses Task1–3 entrypoints and packaged config. Actual runtime tests launch Electron with a dedicated temporary userData path and controlled local fixture only in unpackaged mode. No test flags/auth bypass in installed release.

- [x] Write real Electron tests: load controlled local trusted top frame, prove `process/require` not exposed; same-process hide/reopen keeps document counter and camera video frame progression; deny microphone/subframe/foreign IPC; external links do not navigate app; quit cancellation/idle exit.
- [x] RED on missing runtime behavior, then focused fixes through original implementer. Use Electron executable and CDP/Playwright only through documented APIs. Never expose debugging port on installed production app. Run 6-minute hidden fake video test and record exact frame/heartbeat progression separately from real webcam acceptance.
- [ ] Build NSIS with `npm.cmd run desktop:build`, inspect contents/config for secrets and verify `.exe` exists/hash. Install in a local test destination without deleting existing apps/data; run startup/tray/restart and same-installer update validation. Actual webcam/login acceptance may require user login; report separately instead of claiming fixture equivalence.
- [x] Before OAuth operation add, tell user exact callback/target. Use Supabase MCP/CLI to read/append preserving existing redirect list, verify. No DB/recovery/policy mutation. If credentials unavailable, continue all local checks and request only missing authority/input.
- [x] Verify production web behavior with existing 375/1440 mounted Chrome suite; run `ai.ps1 verify --project C:\jini-dev\worktrees\study-room-desktop-current` and desktop checks/build. Independently review task and full feature; fix blocking defects with covering tests.
- [ ] Stage only this feature's files/selected hunks after tests pass; no unrelated dirty operations/package script. Conventional commit and feature-branch push, invoke existing `.github/workflows/vercel-production.yml`, verify exact SHA/READY/HTTP200. No public Windows asset publication. Final report separates installer/local flow, production web, authenticated real-device/camera cases and remaining limitations.

## Task 5: Current-main integration safeguard (2026-10-26)

- [x] Preserve newer main9f381ab attendance-start policy and todo-save timeout/reconciliation rather than deploying ancestor ea6c56e.
- [x] Use a separate named feature worktree; retain the original dirty tree. Apply only the reviewed Windows49 code/config paths automatically; no actual conflict or manual resolution.
- [x] Preserve current core/server/migrations/Android. Confirm native R1 bytes, root desktop-only scripts, and pending-write lifetime across the current reconciliation path.
- [x] Run native116/116, full Chrome1417/1417, verify7/Dune0, build/package inspection; scoped integration review PASS.
- [ ] Finish feature-branch release and installed first-launch. Real-account/physical-camera/multi-device acceptance remains separately user-assisted.
