# Scenic Study Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development for this plan. Spec: memory-bank/prd-scenic-study.md.

**Goal:** Implement the approved scenery-first study presentation and same-window Windows mini mode without changing study/auth/data ownership.
**Architecture:** DashboardApp owns all study/camera/actual tracking. A new scenic presentation consumes existing derived values and callbacks, leaving the existing tree mounted. Native runtime owns only window geometry through a strictly validated trusted top-frame bridge. Reuse existing atmosphere controller/assets and existing modal workflows. User approved deferring always-on-top after minimum-app API failure on2026-11-02; omit pin button/new pin requests and retain diagnostic evidence.
**Stack:** React/TypeScript/CSS, pure JS helpers/node:test, existing real Chrome mounted fixture, Electron 45 / NSIS.

## Global Constraints
- Work only in C:/jini-dev/worktrees/study-dashboard-clarity, branch fix/study-dashboard-clarity. Preserve all preexisting dirty files. The original C:/jini-dev/worktrees/study-room-desktop-current is read-only; never modify/stage/clean it.
- Existing learning records, server/API/RLS, attendance/recovery/camera detection policies, authentication/quit lifecycle, package identity and userData are unchanged. No real-account study/camera mutations. Synthetic fixtures only.
- No second authenticated BrowserWindow/webContents, timer, camera acquisition, frame loop, or study RPC. Presentation changes are manual and do not start/end study. Existing preparation/recovery/task/end confirmations remain accessible.
- Keep existing Dashboard descendants mounted so drafts/video state survive. Scenic text/controls must remain readable above any backdrop with opaque charcoal surfaces. 375/1440px, 200% text, keyboard focus and 44px targets are required.
- Mini support is capability-gated. Old EXE/APK/web get working scenic presentation without dead native controls. Native bridge is strict typed/exact-key, trusted top-frame/current epoch; no arbitrary geometry/files/URLs/OS commands.
- Same native window is resized; expand restores prior bounds/maximized state with work-area clamping. The new feature never changes always-on-top. Mini geometry never overwrites stored normal bounds. Existing X-to-tray and quit cleanup remain intact. Destroyed-window cleanup is safe/idempotent.
- Use apply_patch for local text edits. Read applicable AGENTS/memory-bank/skills. Take nonoverlapping claims. No subagents from implementers. Do not push/deploy/install; controller handles final gates/release. Stage explicit owned paths only; no generated assets, secrets, output or .serena.
- TDD for new behavior, behavioral tests not source-text grep. Reports include RED/GREEN commands and output. Native import is preservation of existing behavior and must run imported regression tests, not claim newly invented TDD evidence.

## Task 1: Integrate the reviewed 0.1.9 native baseline

**Owner:** apps/desktop existing source/tests/package and only the necessary root package-lock entries. Do not touch web or memory-bank. Parent owns docs. Claim these paths as codex-scenic-native-baseline-20261101.

**Inputs:** Read the original worktree's dirty diff/status and relevant native evidence docs, especially docs/verification/2026-10-28-auth-window-lifecycle.md, 2026-10-28-desktop-quit-cleanup.md, 2026-10-28-login-foreground.md. Compare current source to original; the original remains untouched. User explicitly approved review/preserve/integrate the known 0.1.9 auth/loopback/foreground/quit fixes for a future 0.1.10 build.

**Steps:**
1. Review exact diff and required new modules. Integrate only the 0.1.9 native baseline: main.cjs, error.html, desktopAuth.mjs, desktopRuntime.mjs, necessary desktopAuthDiagnostics/desktopLoopback/desktopStatus.css, regression and integration tests, packaging file list/version. Do not overwrite unrelated current changes or import output/.serena/old memory-bank docs. Use apply_patch, not source Copy-Item.
2. Preserve package/appId/executable/userData and the approved loopback+PKCE, owned auth popup/launch tab lifecycle and destroyed-object quit guards. Do not invent new auth policy or alter Chrome/Supabase settings.
3. Native source version should remain 0.1.9 baseline in this task; Task 2 bumps to 0.1.10. Update only necessary package-lock version entries consistently (no dependency upgrades).
4. Run desktop:check, desktop:test, relevant desktop:integration synthetic tests. Inspect all imported files for secrets/debug exposure. Record exact files imported/provenance and any discrepancy between original/current. If an important auth/security/correctness blocker is reproduced, stop and report; do not hide or import it knowingly.
5. Self-review and commit only owned native source/tests/lock paths after native gates pass. No push. Release claim. Write full report with commands/counts/skips and original-worktree-preservation verification.

**Validation:** imported native tests pass; checks/integration status explicit. Existing current web files unchanged, original dirty source unchanged. Do not claim actual user login or live installation acceptance.

## Task 2: Implement scenic presentation and native mini capability

**Owner:** new scenic web component/CSS/helper/tests, minimal main.tsx integration, atmosphere CSS scoped presentation changes, desktop bridge types/helpers/tests, native presentation helper/runtime/policy/tests/integration, desktop package version 0.1.10 and corresponding lock entries. Parent owns memory-bank/release docs. Claim owned paths as codex-scenic-feature-20261101, never another owner's paths.

**Design:** Approved references are C:/Users/zxcc9/.codex/generated_images/019f55f2-2f54-7891-bc45-d091cad8e764/exec-bbb921ea-19ab-4d5f-8e45-d584281eaa8a.png and exec-dd74be15-2fc2-4e09-be22-f94384b48aba.png (inspect with view_image). Implement their hierarchy, not baked PNG UI. Reuse actual selected themes. Full view is scenery with compact top controls and bottom task/timer/action dock; mini is scenery plus compact task/timer/actions. Do not redesign global navigation.

**Web steps:**
1. Add focused presentation component(s), e.g. ScenicStudyView.tsx/.css, and narrowly scoped helpers if needed. Add ‘풍경으로 집중’ on Today focus. Display current task, existing derived currentSessionSeconds, study/paused/checking state and honest camera/shared-camera status. Reuse exact existing requestAdaptiveStudyStart/requestResumeTimer/pauseTimer/openEndSessionCompletionModal callbacks and existing disabled predicates; no duplicated study logic.
2. Keep Dashboard descendants/camera video mounted and layout-safe while covering standard UI. Existing AccessibleDialog is inline (not a portal): do not inert/aria-hide an ancestor of required dialogs. Either explicitly scope underlying surface inert while preserving all dialogs, or provide a minimal clearly justified presentation structure. Ensure required dialogs are above scene and keyboard reachable; restore entry focus on back, Escape only closes scene when no required modal is active. Avoid body scroll leaks. No background tabbable invisible controls.
3. Scope scenery/light-scrim changes only to active scenic presentation; normal dashboard contrast remains. Reuse existing atmosphere effects/controller unchanged in ownership and saved values. Avoid an opaque duplicated background that hides live effects. Settings control can open existing atmosphere editor in a dialog with independent UI draft; no new storage keys. Keep apply/cancel semantics. Image failure/charcoal remain usable.
4. Capability-gate native mini controls by info.capabilities.windowPresentation === true. For supported native, support mini/expand with error handling. Omit pin UI entirely (user approved deferral). Do not unmount scene into a tiny unusable window if restore fails. On logout/navigation/unmount native cleanup restores normal, not a duplicate renderer. Unsupported/failed info gives scenic only. Do not repeatedly probe native/server on each timer tick.

**Native steps:**
5. Add pure/injected same-window presentation owner (e.g. desktopPresentation.mjs). Runtime info advertises capabilities.windowPresentation true. Add empty-payload windowPresentationStatus and strict windowPresentation request with exact {mode:'normal'|'mini'}. Presentation returns {mode}. Reject extra pinned keys. Require existing trusted top-frame/current epoch guard but do not require server identity for local geometry cleanup. Keep protocolVersion 1 backward compatibility.
6. Mini sizing approximately 420x560 outer bounds, responsive minimum no larger than 375x460 and monitor work area. Capture normal bounds/maximized before first enter, safely unmaximize/clamp, restore normal/maximized. Do not call always-on-top setters in this new owner. No persistence of mini bounds: runtime normal save hooks consult presentation mode. Restore on invalidating navigation/disposal when safe; destroyed-window guards. Native helper must never call auth/study/camera.
7. Extend Electron fixture to prove SAME window/webContents and X/tray continuity, no extra camera/start/stop calls, prior bounds/maximized restoration and always-on-top nonmutation, reload cleanup, small display clamping. Preserve imported auth/quit fixes and add no security setting changes. Version 0.1.10 + matching root lock only, no dependency changes. Keep original positive pin failure in diagnostic/report evidence, not as a released feature acceptance claim.

**TDD acceptance:**
- RED then GREEN mounted main tests for entry/back and existing timer/task/camera state/drafts unchanged; active/paused/start/finish dialogs and existing RPC paths; keyboard focus/Escape/required dialogs; 375/1440 and 200% no overlap/overflow and 44px controls; backdrop/themed static/live animation/reduced-motion state unchanged; old native/web/mobile no mini button.
- Native tests for strict invalid payloads/untrusted frames/stale epochs, mini/normal restoration incl maximized/offscreen monitor/destroyed cleanup and always-on-top nonmutation, no stored-mini bounds, idempotence, and integration same-window identity. Info/capability failures and native restore error have visible recoverable UI.
- Run desktop:check/test, browser focused tests during iteration. Before commit run full native test/integration scope and real Chrome web suite plus official verification (controller may run final aggregate but report any unexecuted step truthfully). Do not claim physical camera or actual account results.
- Self-review, commit owned source/tests only after passing gates, no push/deploy/install. Release claim. Full report includes exact files, commands/counts, TDD and concerns.

## Controller final gates and release

- Independent shared-reviewer per task then final broad review. Follow SDD fix loops. Parent updates architecture-map, prd-study-themes/prd-windows-desktop, implementation-plan, active-context/progress/trouble-shooting and verification doc with final evidence, preserving prior real-device evidence.
- Run official ai.ps1 verify/Dune and full real Chrome suite on final source, git diff --check, inspect diff/secrets. Build same-identity Windows0.1.10 NSIS with existing public config only; verify archive/version/packaging, do not install yet.
- Commit/push explicit paths on feature branch and dispatch existing production Actions workflow. Verify exact SHA READY/production alias/HTTP200/assets. No main push/merge.
- Report website availability, new EXE-required mini support and installer path, what was not physically validated, ask separate overwrite-install approval. No new APK for hosted scenic screen.
