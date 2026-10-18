# Cross-device Study State Implementation Plan (2026-10-18)

> For agentic workers: use superpowers:subagent-driven-development or executing-plans. Track the checked steps here; do not repeat completed tasks.

**Goal:** Mirror one account's authoritative study/camera state without video or observer-generated warnings.
**Architecture:** Add fenced camera ownership plus a shared authenticated snapshot; existing lifecycle and accepted-time storage remain authoritative. Hosted Android reuses web changes.
**Tech Stack:** React19/Vite, Supabase Postgres/RLS/Realtime/Edge, Expo53 Android16 WebView.
**Spec:** memory-bank/prd-cross-device-study.md

## Global Constraints

- No video, frames, landmarks, audio, credentials or recovery reasons in transport/logs.
- Preserve existing learning rows and the user's currently running study; no reset, fake camera, direct lifecycle mutation or recovery bypass.
- Owner heartbeat10seconds, freshness45seconds, foreground fallback15seconds; absence warning300seconds, camera exclusion600seconds, cooldown600seconds.
- No native dependency/version/package/signature change. No unrelated dirty files in commits.
- Caller auth.uid plus owner client UUID/generation fence; observers never publish camera state or local inactivity termination.

### Task 1: Server coordination and guarded warning

**Files:** new CLI-generated supabase/migrations/*_study_device_camera_sync.sql; supabase/functions/_shared/study-device-sync-db.test.mjs; supabase/functions/camera-presence-warning/index.ts; supabase/functions/_shared/camera-presence-warning.test.mjs.
**Produces:** The three exact RPC interfaces and camera JSON fields in the Spec. Public ownership state table has owner-only RLS SELECT/no direct writes. Realtime publication includes that table and study_sessions/study_actual_sessions only if publication exists.

- [x] Add PGlite RED tests using existing actual-study-db setup. Example assertions: after A claim, B non-takeover returns accepted=false; B report with A generation leaves digest unchanged; B explicit takeover increments generation; A late report is rejected; a warning with null client is denied and presence-event count unchanged; fresh owner off warning accepted once then cooldown denies; other auth.uid cannot read/claim A session.
- [x] Run `node --test supabase/functions/_shared/study-device-sync-db.test.mjs` and preserve expected missing RPC RED output.
- [x] Implement additive migration with session-first locking, generation fencing, server-time freshness/absence, no learning-row rewrites. Report exclusion uses existing checkpoint only for the current owner. Preserve counter across takeover. Paused/ended/lease-expired sessions cannot publish or warn.
- [x] Update Edge parser with optional clientId/generation; old callers are suppressed. Atomically validate/record via service-only RPC before Slack delivery; suppression does not create recovery or delivery records. Keep genuine warning/recovery behavior.
- [x] Run focused DB and Edge tests; write report including RED/GREEN evidence to the ignored SDD task-1-report.md (reviewed evidence is summarized in acceptance.md). No remote migration/deploy/commit by worker; controller verifies integration and performs deployment.

### Task 2: Shared web state and owner-only execution

**Files:** apps/web/src/studyDeviceSync.mjs + .d.mts; main.tsx; cameraWarning.mjs + .d.mts; apps/web/test/studyDeviceSync.test.mjs; existing actualStudyMounted.test.mjs (no duplicate harness).
**Consumes:** Task1 exact RPC contract.

- [x] RED helper tests: an observer snapshot yields localCameraRequired=false and canPublish=false; stale remote shows unknown not absent; remote auto-pause projects only to freshness deadline; generation mismatch fences delayed results.
- [x] Implement authenticated bounded requests with document-scoped UUID, shared snapshot retention, one in-flight refresh plus one coalesced followup, auth/dispose fences, three filtered Realtime tables and15second foreground fallback.
- [x] Replace active-only polling with shared snapshot hydration. Observers use server tracking/camera totals and do not checkpoint or auto-end for local inactivity. Do not overwrite local form drafts or pending actual-study intents.
- [x] Gate auto-restore, camera-required popup/Slack, detector/reporting and warning calls by current owner generation. New session or explicit takeover claims only after healthy local camera preparation. On lost ownership dispose local stream/detector; labels show remote monitoring without implying local camera is enabled.
- [x] Mounted RED/GREEN two-client scenarios: remote active/no local camera→no getUserMedia/popup/warning; remote pause/end closes owner camera; no-active observer sees later start; remote task/time changes update; error retains cached state; switching user ignores late result; takeover requires explicit button.
- [x] Run focused helper/mounted tests, then mobile:check/build.

### Task 3: Acceptance, preservation, review and production

**Files:** docs/cross-device-study/acceptance.md; related PRD/architecture-map/implementation-plan/progress/active-context/trouble-shooting only.

- [x] Independent reviewer checks task diff, server auth/RLS/lock order, legacy warning suppression, web generation/cancellation and untouched-learning-row invariant; fix findings and rerun covering tests.
- [x] Capture sanitized pre-migration existing-row counts/digests, apply migration via Supabase, verify grants/RLS/publication/function definitions and same existing-row digests (separate concurrent user activity).
- [x] Run `& C:/jini-dev/.ai/scripts/ai.ps1 verify --project C:/jini-dev/worktrees/study-room-team`, actual Chrome mounted suite, diff check. Do not claim skipped browser tests as passed.
- [x] Commit only verified scoped changes on feature branch, push and dispatch existing production workflow per project AGENTS. Deploy guarded Edge before web; verify READY/exactSHA/HTTP200 and migration/Edge release identity.
- [ ] Verify Android16 APK0.2.4 same-account observer against real source state without stopping the user's study; verify no extra camera permission/warning and record server state. If actual login/recovery is missing, request user completion without bypass.
- [x] Update memory-bank with implemented vs verified vs still-blocked facts; no new APK unless native source actually changes.
