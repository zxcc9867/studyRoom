# Android-Web Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user has not requested subagents; execute inline. Project instructions override the skill's commit step: do not commit, push, or deploy without a separate user request.

**Goal:** An Android login opens the six web study sections without another login while preserving native focus-mode synchronization and enabling origin-restricted camera use.

**Architecture:** Native Supabase Auth remains authoritative for the Android account and background focus task. A protected Edge endpoint generates a one-use Auth token hash for that same user; the native app injects it into the trusted top-level WebView document, where the web app exchanges it for its own session before rendering protected content. One persistent WebView reuses the full web dashboard, and web session changes trigger native server-state reconciliation. Camera permission is additionally restricted in Android WebView's permission handler to the app's exact HTTPS origin and video resource.

**Tech Stack:** Expo 53, React Native 0.79, react-native-webview 13.13.5, Vite/React 19, Supabase Auth/Edge/Postgres, Node tests, Deno 2.9.6, Android 16 emulator.

**Spec:** `memory-bank/prd-android-web-parity.md`

## Global Constraints

- Do not copy a native access or refresh token into WebView storage, URL, logs, or analytics. Only a one-use generated token hash may cross the bridge.
- Keep native Supabase Auth and `focusBackground.ts` active. WebView messages are hints; native code must re-read server focus state.
- Preserve the currently dirty worktree, including user-owned files. Claim every edit path using `C:/jini-dev/.ai/scripts/ai.ps1`; reread memory-bank after claiming and release claims afterward.
- Do not remove existing database records or migrations. Supabase changes require CLI/MCP verification and `memory-bank/implementation-plan.md` and `progress.md` updates.
- No arbitrary WebView origin, iframe, audio capture, protected media, or other resource receives camera permission.
- Do not claim emulator testing proves Android DND operation on a real phone.
- The approved request is implementation and emulator verification, not an instruction to commit, push, or deploy.

## File ownership map

| Unit | Files | Responsibility |
| --- | --- | --- |
| Ticket rate gate | `supabase/migrations/20260930000000_mobile_web_auth_limit.sql`, DB tests | Per-user atomic issue cap, service-role-only access |
| Ticket endpoint | `supabase/functions/mobile-web-auth/index.ts`, `supabase/functions/_shared/mobile_web_auth.ts`, test | Verify native caller and issue one-use token for exactly that user |
| Web bridge | `apps/web/src/embeddedAuth.mjs`, `.d.mts`, `main.tsx`, tests | Keep stale web auth hidden, exchange token, account-match gate, logout signalling |
| Mobile bridge/shell | `apps/mobile/src/WebFeatureScreen.tsx`, `apps/mobile/src/mobileWebBridge.ts`, `App.tsx`, tests | One trusted WebView, six sections, ticket retrieval, native session/focus reconciliation |
| Camera gate | `apps/mobile/app.json`, Android WebView permission patch/config, test | Ask Android CAMERA permission only for first-party video request |
| Verification/docs | project scripts and memory-bank documents | Prove behavior and record deployed/undeployed state accurately |

## Task 1: Server-only one-use ticket issuance

**Files:**
- Create: `supabase/migrations/20260930000000_mobile_web_auth_limit.sql`
- Create: `supabase/functions/_shared/mobile_web_auth.ts`
- Create: `supabase/functions/_shared/mobile_web_auth.test.ts`
- Create: `supabase/functions/mobile-web-auth/index.ts`
- Modify: `package.json` (`test:edge` includes the new function and test)
- Test: new SQL/PGlite or direct Supabase CLI/MCP policy verification

**Interfaces:**
- HTTP `POST /functions/v1/mobile-web-auth` with native `Authorization: Bearer <access_token>` and no email/user ID body.
- Success JSON: `{ token_hash: string, user_id: string, verification_type: "magiclink" }`; failure has generic `{ error: string }` and no token.
- SQL `public.try_issue_mobile_web_auth_ticket(p_user_id uuid) returns boolean`, executable only by service role. A rolling five-minute window permits at most 10 attempts per user, atomically.

- [ ] **Step 1: Write red tests** for missing/invalid bearer, missing email, rate-limit denial, generated user mismatch, no service secret leak and successful exact-user token. A representative assertion is:

```ts
const result = await issueMobileWebTicket({
  token: "native-token",
  getUser: async () => ({ id: "user-1", email: "owner@example.com" }),
  allowIssue: async () => true,
  generateLink: async () => ({ user: { id: "user-1" }, properties: { hashed_token: "once" } }),
});
assertEquals(result, { token_hash: "once", user_id: "user-1", verification_type: "magiclink" });
```

- [ ] **Step 2: Run** `npx.cmd --yes deno@2.9.6 test --no-config --node-modules-dir=none --allow-env supabase/functions/_shared/mobile_web_auth.test.ts`; expect missing implementation failure.
- [ ] **Step 3: Implement** pure issuance logic with injected dependencies and the Edge wrapper using `auth.getUser(token)`. Check `data.user.id === caller.id` after `admin.auth.admin.generateLink({ type: "magiclink", email: caller.email })`. Never accept an email from the request. Apply the SQL atomic limit through service-role RPC before generating; revoke public/anon/authenticated EXECUTE and table access, enable RLS without user policies. Return 401/429/503 with generic messages, `cache-control: no-store`, and avoid body/token logging.

```ts
if (!caller.email || !await allowIssue(caller.id)) throw new TicketError("unavailable");
const generated = await generateLink(caller.email);
if (generated.user.id !== caller.id || !generated.properties.hashed_token) {
  throw new TicketError("unavailable");
}
return { token_hash: generated.properties.hashed_token, user_id: caller.id, verification_type: "magiclink" };
```

- [ ] **Step 4: Run** the targeted Deno test and `npm.cmd run test:edge`; both must pass. Verify table/RLS/function grants and migration history with Supabase CLI/MCP before any server rollout. Do not apply a production migration in this task without a deployment request.

## Task 2: Embedded web authentication gate

**Files:**
- Create: `apps/web/src/embeddedAuth.mjs`
- Create: `apps/web/src/embeddedAuth.d.mts`
- Create: `apps/web/test/embeddedAuth.test.mjs`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Native-to-web message: `{ type: "STUDY_WEB_AUTH_TICKET", requestId, userId, tokenHash }` delivered only to top-level first-party document.
- Web-to-native messages: `{ type: "STUDY_WEB_READY" }`, `{ type: "STUDY_WEB_AUTH_OK", requestId, userId }`, `{ type: "STUDY_WEB_AUTH_FAILED", requestId }`, `{ type: "STUDY_WEB_SIGN_OUT" }`, `{ type: "STUDY_WEB_STUDY_STATE_CHANGED" }`.
- `isEmbeddedStudyApp(window)` and `consumeEmbeddedTicket(supabase, message, expectedRequestId)` are pure/testable helpers; the latter returns verified `Session` or throws and signs out a mismatched user.

- [ ] **Step 1: Write red tests** for valid ticket exchange, rejected malformed/stale request ID, old account session cleared before showing content, wrong returned user ID, failed exchange, and ordinary browser login unchanged.

```js
const result = await consumeEmbeddedTicket(fakeSupabase, {
  type: "STUDY_WEB_AUTH_TICKET", requestId: "r1", userId: "user-1", tokenHash: "once",
}, "r1");
assert.equal(result.user.id, "user-1");
assert.deepEqual(verifyCalls, [{ token_hash: "once", type: "magiclink" }]);
```

- [ ] **Step 2: Run** `node --test apps/web/test/embeddedAuth.test.mjs`; expect the new module/behavior to fail.
- [ ] **Step 3: Implement** embedded initialization in `main.tsx`: detect the first-party native bridge, set `sessionInitialized=false`, clear any old *local* web session, send READY, receive ticket only through an event listener registered before READY, exchange through `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })`, compare user IDs, then set the verified session and render dashboard. Suppress the regular login panel during embedded connection and provide retry UI. Ordinary desktop initialization remains unchanged. Explicit web logout sends `STUDY_WEB_SIGN_OUT`; session state changes send only an advisory study-state message. On auth failure, hide protected content and request a new ticket, never retry the same hash.
- [ ] **Step 4: Run** targeted web tests and `npm.cmd run build`. Confirm the web bundle does not contain a service-role key or native access/refresh token. Verify account switching with two mocked users; user A content must not render after native switches to B.

## Task 3: Persistent Android web shell and focus adapter

**Files:**
- Create: `apps/mobile/src/mobileWebBridge.ts`
- Modify: `apps/mobile/src/WebFeatureScreen.tsx`
- Modify: `apps/mobile/App.tsx`
- Modify: `scripts/mobile-web-features.test.mjs`
- Create: `scripts/mobile-web-auth.test.mjs`

**Interfaces:**
- `requestMobileWebTicket(supabase, expectedUserId)` calls the Edge endpoint using the current native Auth session, checks its user ID, and returns the one-use ticket without persisting it.
- `WebFeatureScreen` takes `sessionUserId`, `onStudyStateChanged`, `onNativeSignOut`, and `onOpenFocusSettings`; it maintains one WebView instance while navigating all six first-party hash sections.
- `onStudyStateChanged` calls `refreshData(userId)` and `refreshFocus(userId)`/`reconcileStudyFocus`, not a state-changing RPC based on untrusted message payload.

- [ ] **Step 1: Write red mobile tests** for six visible section links, one WebView instance across section changes, no login hint, blocked off-origin URL, ticket fetched only after `STUDY_WEB_READY`, token injected only into allowed top-level origin, ticket never placed in URL, account-change remount/clear, web sign-out native sign-out, retry after error, and focus reconciliation after study-state hint.

```js
assert.equal(webView.props.source.uri, "https://study-room-attendance.vercel.app/#today");
assert.equal(webView.props.onShouldStartLoadWithRequest({ url: "https://evil.test/" }), false);
assert.equal(JSON.stringify(webView.props.source).includes("tokenHash"), false);
```

- [ ] **Step 2: Run** `node --test scripts/mobile-web-auth.test.mjs scripts/mobile-web-features.test.mjs`; expect test failures.
- [ ] **Step 3: Implement** a single persistent WebView shell for signed-in users. Keep native Auth restoration, `focusBackground.ts`, focus connect/disconnect/settings access, and server reconciliation. Do not unmount the WebView on section selection; navigation changes its hash inside the same trusted document. Use a request nonce so only the latest READY/request pair may receive a newly fetched ticket; inject JSON-escaped data into the first-party top-level document, never into the WebView URL or logs. Validate `onMessage` schema and current WebView URL; ignore unknown commands. Clear WebView and native state before rendering a different user. Keep a native study/focus fallback only when the web shell fails, without showing a second login flow.
- [ ] **Step 4: Run** mobile tests, `npm.cmd run mobile:check`, and the full `npm.cmd test`. If old native tab-shape tests need revision, update expected web-parity behavior rather than deleting coverage.

## Task 4: Origin-restricted Android camera

**Files:**
- Modify: `apps/mobile/app.json` (`android.permissions: ["CAMERA"]` and user-facing explanation where supported)
- Create: `patches/react-native-webview+13.13.5.patch`; add `patch-package` and its postinstall hook to root `package.json`/lockfile
- Create: `scripts/mobile-camera-permission.test.mjs`
- Modify: web camera UI only if permission/error states do not correctly explain WebView denial

**Interfaces:**
- Android `onPermissionRequest` grants exactly `PermissionRequest.RESOURCE_VIDEO_CAPTURE` only when `request.getOrigin().toString()` equals `https://study-room-attendance.vercel.app` and the request contains no other resources. Every other origin/resource invokes `request.deny()`.

- [ ] **Step 1: Write a failing test** that inspects the build-applied native WebView policy, not only app UI text, and rejects grant paths lacking both exact-origin and video-only checks. Add app manifest permission assertion. Include a test request model for first-party video allowed, first-party audio+video denied, and external iframe video denied.
- [ ] **Step 2: Run** `node --test scripts/mobile-camera-permission.test.mjs`; expect failure against current WebView 13.13.5 policy.
- [ ] **Step 3: Patch** WebView's Android `RNCWebChromeClient.onPermissionRequest` at the start of the method so off-origin and non-video requests return `request.deny()` before any runtime permission prompt; preserve existing Android CAMERA prompt for allowed video. Store the library diff in `patches/react-native-webview+13.13.5.patch`, run `patch-package` from the root `postinstall` script on clean installs/EAS builds, and verify that the script exits nonzero when the patch no longer applies. Add `CAMERA` to Expo Android configuration. Do not request `RECORD_AUDIO`.

```java
if (!"https://study-room-attendance.vercel.app".equals(request.getOrigin().toString())
    || request.getResources().length != 1
    || !PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(request.getResources()[0])) {
  request.deny();
  return;
}
```

- [ ] **Step 4: Run** the targeted policy test, `npm.cmd run mobile:check`, an Android debug/preview build and emulator camera allow/deny flows. Fail release if the patch is missing from the compiled native build or an external iframe can receive camera permission.

## Task 5: Cross-surface regression, emulator proof, documentation

**Files:**
- Modify: `memory-bank/prd-android-focus-mode.md`, `memory-bank/active-context.md`, `memory-bank/progress.md`, `memory-bank/implementation-plan.md`; `memory-bank/trouble-shooting.md` if failures occur
- Test: `scripts/mobile-otp.test.mjs`, `scripts/mobile-recovery.test.mjs`, `scripts/mobile-timer.test.mjs`, web/Edge targeted suites and full repository scripts

- [ ] **Step 1: Run** `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:edge`, `npm.cmd run mobile:check`, and `npm.cmd run docs:check`; record pass/fail counts and do not hide environmental skips.
- [ ] **Step 2: Install** the resulting build on `emulator-5554` (Android 16) and verify login once, six sections, no feed/forest login, same-account recovery state, start/pause/resume/end timer, WebView reload/app restart, explicit logout/account switch, external links, camera permission allowed/denied. Inspect only non-secret UI labels/logs. If server/web endpoints are not released, use a local/staging harness and mark production unverified.
- [ ] **Step 3: Verify** native DND trigger paths through unit/integration tests and server re-read; explicitly mark physical-device DND toggle as unverified until tested on a real phone. Confirm no duplicate study session or recovery submission during retries.
- [ ] **Step 4: Update** memory-bank with actual files, API contract, database migration/RLS if used, tests, emulator observations, unresolved risks, and deployed versus local-only state. Run `git diff --check` and inspect only scoped changes. Release claims. Do not commit, push, or deploy without a separate request.
