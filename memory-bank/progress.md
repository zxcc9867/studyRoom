# Progress

## Timeline

### 2026-06-14

#### 완료한 작업

- 카메라 감시가 꺼진 상태에서는 `입장하고 시작`이 바로 Supabase `start_study_session` RPC를 호출하지 못하도록 차단했다.
- 카메라가 꺼져 있으면 `카메라 인증이 필요합니다` 팝업을 띄우고, `카메라 켜고 시작`을 눌렀을 때만 카메라 권한 요청 후 공부 세션을 시작하도록 했다.
- 활성 공부 세션 중 카메라 감시가 꺼져 있으면 앱 팝업을 다시 띄우고 `camera_required_warning` 이벤트를 Edge Function으로 보낸다.
- `camera_required_warning` Telegram 경고는 10분 쿨다운을 적용해 중복 발송을 막는다.
- `study_presence_events.event_type` check constraint에 `camera_required_warning`을 추가하는 migration을 만들고 원격 Supabase에 적용했다.
- `camera-presence-warning` Edge Function을 version 2 ACTIVE로 배포했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/cameraPresence.mjs`
- `apps/web/src/cameraPresence.d.mts`
- `apps/web/src/cameraWarning.mjs`
- `apps/web/src/cameraWarning.d.mts`
- `apps/web/test/cameraPresence.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/functions/camera-presence-warning/index.ts`
- `supabase/migrations/0012_camera_required_warning.sql`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-camera-presence.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- RED: `node --test apps\web\test\cameraPresence.test.mjs packages\core\test\sql-migrations.test.mjs` failed because `canStartStudySessionWithCamera`, `0012_camera_required_warning.sql`, and `camera_required_warning` Edge Function handling were missing.
- GREEN: `node --test apps\web\test\cameraPresence.test.mjs packages\core\test\sql-migrations.test.mjs` passed 18 tests.
- `npm.cmd test` passed 49 tests.
- `npm.cmd run build` passed.
- Supabase MCP `_apply_migration` returned `success=true` for `camera_required_warning`.
- Supabase SQL verification returned `camera_required_warning_allowed=true`.
- Supabase Edge Function list shows `camera-presence-warning` version 2 ACTIVE with `verify_jwt=false`.

#### 남은 작업

- Vercel production UI deployment has not been performed in this step.
- Manual browser verification with a real camera is still needed: click `입장하고 시작`, allow camera, confirm timer starts, then turn camera off and confirm the warning.

#### 다음 우선순위

- If the user wants the production site updated, commit and push to `origin/main` so GitHub Actions can deploy to Vercel.

### 2026-06-13

#### Completed Work

- Added a GitHub Actions production deployment pipeline for Vercel.
- Configured the workflow to run on `main` pushes and manual `workflow_dispatch`.
- Configured the workflow to install dependencies, run `npm test`, pull Vercel production environment, and deploy with `vercel deploy --prod`.
- Documented how to create `VERCEL_TOKEN` and which GitHub Secrets are required.
- Added `memory-bank/prd-vercel-ci.md` for the CI deployment requirements.
- Updated the implementation plan with the GitHub Actions deployment path and duplicate deployment warning.
- Pushed commit `0d54fa7` to `origin/main` and triggered GitHub Actions run `27435664940`.
- Diagnosed that the first workflow run failed because local `vercel build --prod` rejected the Vercel project Node.js version `24.x`.
- Changed the workflow to use Vercel remote production build through `vercel deploy --prod`.
- Pushed commit `e5a2730` to `origin/main` and triggered GitHub Actions run `27435801823`.
- Verified GitHub Actions run `27435801823` completed successfully.
- Verified Vercel production deployment `dpl_BXM4358PWNe4zDy3mVy9KYkRwrf9` is READY for commit `e5a2730`.
- Verified `https://study-room-attendance.vercel.app/` serves the new production HTML and asset `/assets/index-_N2PZqno.js`.
- Verified the deployed production JS contains `카메라 감시`, `자리 비움`, `camera-presence-warning`, and `30분`.

#### Changed Files

- `.github/workflows/vercel-production.yml`
- `docs/vercel-ci.md`
- `memory-bank/prd-vercel-ci.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- `npm.cmd test` passed 46 tests.
- `npm.cmd run build` passed.
- Workflow syntax was kept to standard GitHub Actions YAML with `actions/checkout@v4`, `actions/setup-node@v4`, and pinned `vercel@48.6.0`.
- GitHub Actions run `27435664940` reached `npm test` successfully but failed at local `vercel build --prod` with `Found invalid Node.js Version: "24.x"`.
- GitHub Actions run `27435801823` completed with conclusion `success`.
- Vercel deployment list shows `dpl_BXM4358PWNe4zDy3mVy9KYkRwrf9` as `READY` and `target=production`.
- Production URL fetch returned HTTP 200 and includes `color-scheme` `only light`.
- Production asset check returned `cameraToggle=true`, `absenceWarning=true`, `cameraFunction=true`, and `thirtyMinute=true`.
- Vercel runtime error/fatal log scan for the last hour returned no logs.

#### Remaining Work

- Decide whether to disable Vercel Git integration to avoid duplicate deployments.

#### Next Priority

- After secrets are configured, verify the GitHub Actions run and Vercel production deployment URL.

### 2026-06-13

#### Completed Work

- Implemented the web MVP for camera-based absence warning during active study sessions.
- Added browser-side presence state logic with 5-minute absence detection and 10-minute warning cooldown.
- Added dynamic MediaPipe Tasks Vision FaceDetector loading through `@mediapipe/tasks-vision`.
- Added `Today Focus` camera monitoring UI, camera status, small camera preview, and absence warning popup.
- Added `sendCameraPresenceWarning(session, payload)` helper for authenticated Edge Function calls.
- Added `recordCameraPresenceEvent()` helper for `camera_started`, `camera_stopped`, and `camera_permission_denied` client-side events.
- Added Supabase migration `0011_study_presence_events.sql`.
- Applied remote Supabase migration `study_presence_events` to project `bqohkdzvxbrokkmuhysx`.
- Added and deployed `camera-presence-warning` Edge Function version 1 ACTIVE.
- Verified remote DB has `study_presence_events`, RLS enabled, 2 policies, event type check, and metadata no-media check.
- Confirmed Vercel production deployment is blocked by missing local Vercel credentials.

#### Changed Files

- `apps/web/package.json`
- `package-lock.json`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/cameraPresence.mjs`
- `apps/web/src/cameraPresence.d.mts`
- `apps/web/src/cameraWarning.mjs`
- `apps/web/src/cameraWarning.d.mts`
- `apps/web/src/faceDetection.mjs`
- `apps/web/src/faceDetection.d.mts`
- `apps/web/test/cameraPresence.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/migrations/0011_study_presence_events.sql`
- `supabase/functions/camera-presence-warning/index.ts`
- `memory-bank/prd-camera-presence.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- RED: `node --test apps\web\test\cameraPresence.test.mjs packages\core\test\sql-migrations.test.mjs` failed before implementation because `cameraPresence.mjs`, `0011_study_presence_events.sql`, and `camera-presence-warning/index.ts` were missing.
- GREEN: `node --test apps\web\test\cameraPresence.test.mjs packages\core\test\sql-migrations.test.mjs` passed 15 tests.
- `npm.cmd test` passed 46 tests.
- `npm.cmd run build` passed and produced a separate MediaPipe `vision_bundle` chunk.
- Browser smoke check loaded the built app at `http://127.0.0.1:5177/` with title `강제 출석 독서실`.
- Supabase `_apply_migration` returned success for `study_presence_events`.
- Supabase SQL verification returned `table_exists=true`, `rls_enabled=true`, `policy_count=2`, `metadata_no_media_check_exists=true`, `event_type_check_exists=true`.
- Supabase Edge Function list shows `camera-presence-warning` version 1 ACTIVE with `verify_jwt=false`.
- Vercel deploy attempt failed with `No existing credentials found. Please run vercel login or pass "--token"`.

#### Remaining Work

- Deploy the updated web UI to Vercel production after providing `VERCEL_TOKEN` or completing Vercel CLI login/device auth.
- Manually verify camera permission, face detection, 5-minute warning, and Telegram receipt in a real browser session with an active study session.

#### Next Priority

- Decide whether camera warning history should appear in My Page or remain an internal event log.

### 2026-06-13

#### Completed Work

- Changed the attendance rule from a single 15-minute deadline to a two-step flow: initial reminder at the configured time, nudge reminder after 15 minutes, and missed attendance after 30 minutes.
- Updated core attendance logic so check-in remains open for 30 minutes and a timer start exactly at or after the deadline no longer qualifies as present.
- Added regression tests for 30-minute attendance, 15-minute nudge stage, and 30-minute missed handling.
- Added Supabase migration `0010_two_step_attendance_deadline.sql`.
- Applied remote Supabase migration `two_step_attendance_deadline` to project `bqohkdzvxbrokkmuhysx`.
- Redeployed `attendance-cron` Edge Function as version 10 ACTIVE with `reminder_stage = initial | nudge` support.
- Redeployed `telegram-test-alarm` Edge Function as version 3 ACTIVE with the new 30-minute/test-nudge wording.
- Updated web, mobile, and service worker user-facing copy for the 30-minute deadline and 15-minute nudge behavior.
- Deployed Vercel production deployment `dpl_DZUe2FPk3HW5K9wqaFE4aFS916gq`.
- Verified `https://study-room-attendance.vercel.app/` points to the new deployment and serves updated HTML, JS, and `service-worker.js`.

#### Changed Files

- `apps/mobile/App.tsx`
- `apps/web/public/service-worker.js`
- `apps/web/src/main.tsx`
- `packages/core/src/index.mjs`
- `packages/core/test/attendance.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/functions/attendance-cron/index.ts`
- `supabase/functions/telegram-test-alarm/index.ts`
- `supabase/migrations/0010_two_step_attendance_deadline.sql`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-supabase-cron.md`
- `memory-bank/prd-telegram-popup-notifications.md`

#### Verification

- RED: `node --test packages\core\test\attendance.test.mjs` failed before implementation because `NUDGE_AFTER_MINUTES` was not exported.
- RED: `node --test packages\core\test\sql-migrations.test.mjs` failed before implementation because `reminder_stage` and the new migration were missing.
- GREEN: `node --test packages\core\test\attendance.test.mjs packages\core\test\sql-migrations.test.mjs` passed 16 tests.
- `npm.cmd test` passed 39 tests.
- `npm.cmd run build` passed.
- Supabase migration history includes `two_step_attendance_deadline`.
- Remote SQL function check returned true for `reminder_stage`, `nudge`, `interval '30 minutes'`, `p_now >= ad.deadline_at`, `ss.started_at < ad.deadline_at`, and `now() < v_deadline_at`.
- Supabase Edge Function list shows `attendance-cron` version 10 ACTIVE and `telegram-test-alarm` version 3 ACTIVE.
- Vercel deployment list shows `dpl_DZUe2FPk3HW5K9wqaFE4aFS916gq` READY with target `production`.
- Vercel production HTML uses asset `/assets/index-Ll22Nhok.js`, and the deployed JS contains the 30-minute attendance copy and 15-minute nudge popup copy.
- Vercel production `service-worker.js` contains `첫 알림 후 30분 안에 입장하고 타이머를 시작하세요.`

#### Remaining Work

- Observe the next real scheduled reminder window and confirm Telegram/Web Push deliveries at T+0 and T+15.
- Confirm `attendance_days.status = 'missed'` is written at T+30 when no qualifying timer start exists.

#### Next Priority

- Add absence-reason collection through Telegram after a missed day if the user wants the next force-habit step.

### 2026-06-13

#### Completed Work

- Checked why the mobile production page still renders dark after the light-theme fix.
- Verified local source and built output contain `only light` and `supported-color-schemes`.
- Verified `https://study-room-attendance.vercel.app/` still serves old production HTML without the light-only metadata.
- Confirmed Vercel production alias points to CLI deployment `dpl_D5L7trvBoiVTjn1B65TtRYcpU79X`.
- Attempted Vercel CLI production deployment and found local CLI credentials are missing.
- Retried deployment with explicit `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`, but Vercel CLI still required login or `--token`.
- Generated a Vercel OAuth device authorization request with an ASCII user-agent to avoid the Windows non-ASCII hostname header bug.
- Deployed the current app to Vercel production as `dpl_88BcosEtVBhBKyddjNC3k9c9vjo5`.
- Verified `study-room-attendance.vercel.app` points to the new deployment and includes mobile light-only HTML metadata.

#### Changed Files

- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- `git log -1 --oneline` returned `0390ba4 Record mobile light theme push`.
- `curl.exe -s -I https://study-room-attendance.vercel.app/` returned `Last-Modified: Thu, 11 Jun 2026 05:35:49 GMT`.
- Production HTML did not include `only light`, `supported-color-schemes`, `theme-color`, or `color-scheme`.
- Local `apps/web/index.html` and `apps/web/dist/index.html` both include `only light` and `supported-color-schemes`.
- `npx.cmd -y vercel@48.6.0 deploy --prod --yes` failed with `No existing credentials found`.
- `VERCEL_TOKEN` was missing, and `AppData\Roaming\com.vercel.cli\Data\auth.json` was only 3 bytes, indicating no usable local Vercel login.
- Vercel OAuth device authorization produced a temporary access token after user approval.
- `npx.cmd -y vercel@48.6.0 deploy --prod --yes --token <redacted> --scope astars-projects-c2f42587` completed successfully.
- Vercel MCP reported `study-room-attendance.vercel.app` is aliased to READY deployment `dpl_88BcosEtVBhBKyddjNC3k9c9vjo5`.
- `curl.exe -s -I https://study-room-attendance.vercel.app/` returned `Last-Modified: Fri, 12 Jun 2026 16:27:31 GMT`.
- Production HTML contains `meta name="color-scheme" content="only light"` and `meta name="supported-color-schemes" content="light"`.

#### Remaining Work

- User should refresh the mobile browser and verify the page now renders with the light palette.
- For repeatable future deploys, configure Vercel Git integration or CI secrets instead of relying on manual OAuth device authorization.

#### Next Priority

- Confirm the mobile browser no longer shows the dark transformed UI.

### 2026-06-13

#### Completed Work

- Hardened mobile light-theme handling so mobile browsers should render the same light palette as PC.
- Changed HTML color-scheme metadata from `light` to `only light`.
- Added `supported-color-schemes=light`.
- Added pre-paint HTML background/text styles.
- Added `prefers-color-scheme: dark` CSS override that keeps the app background and text light.
- Expanded the mobile theme regression test.

#### Changed Files

- `apps/web/index.html`
- `apps/web/src/styles.css`
- `apps/web/test/mobileTheme.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- `node --test apps\web\test\mobileTheme.test.mjs` passed.
- `npm.cmd test` passed 37 tests.
- `npm.cmd run build` passed.
- `rg` confirmed built `apps/web/dist` includes `only light`, `supported-color-schemes`, `prefers-color-scheme: dark`, and `#d9f0e3`.

#### Remaining Work

- None for the mobile light-theme fix request.

#### Next Priority

- Confirm the deployed mobile page after the host finishes redeploying.

### 2026-06-12

#### Completed Work

- Added infrastructure architecture documentation.
- Added Mermaid diagrams for the current Supabase Cron architecture, alarm/attendance sequence, data boundary, and optional AWS configuration.
- Linked README to the infrastructure architecture document.
- Updated memory-bank context and implementation plan for the new architecture document.

#### Changed Files

- `docs/infrastructure-architecture.md`
- `README.md`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`

#### Verification

- Node script confirmed README links to `docs/infrastructure-architecture.md`.
- Node script confirmed the architecture document contains 4 Mermaid blocks.
- `npm.cmd test` passed 37 tests.

#### Remaining Work

- None for the infrastructure architecture documentation request.

#### Next Priority

- Continue feature work or deploy the latest pushed source.

### 2026-06-12

#### Completed Work

- Added `origin` remote `https://github.com/zxcc9867/studyRoom.git`.
- Pushed local `main` to GitHub `origin/main`.
- Updated memory-bank to record the successful push status.

#### Changed Files

- `memory-bank/active-context.md`
- `memory-bank/progress.md`

#### Verification

- `git push -u origin main` succeeded.
- `origin/main` tracking was configured.

#### Remaining Work

- None for the GitHub push request.

#### Next Priority

- Continue app feature work or deploy the latest pushed source.

### 2026-06-12

#### Completed Work

- Added a README thumbnail at `docs/images/study-room-thumbnail.png`.
- Rewrote `README.md` with current project features, architecture, environment variables, deployment notes, and security notes.
- Added generated log/cache ignore rules to `.gitignore`.
- Initialized a local git repository on `main`.
- Created local commit `6f7fb40 Initial study room attendance app`.

#### Changed Files

- `README.md`
- `.gitignore`
- `docs/images/study-room-thumbnail.png`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- `node` UTF-8 read confirmed the README title and thumbnail Markdown are valid.
- `rg -l` secret-pattern scan returned no matching files.
- `npm.cmd test` passed 37 tests.
- `npm.cmd run build` passed.
- Edge headless wrote `docs/images/study-room-thumbnail.png`; Chrome headless failed with a GPU process error first.

#### Remaining Work

- Push to GitHub after the user provides a target repository URL or installs/configures `gh` for repository creation.

#### Next Priority

- Add `origin` remote and push `main` once the GitHub target is confirmed.

### 2026-06-12

#### Completed Work

- Added an in-dashboard `내 페이지` section.
- Added user profile summary cards for email, login provider, reminder time, time zone, total completed todos, and current-month completed todos.
- Added completed todo history sorted by newest date first.
- Added 10-item pagination with previous/next controls for completed todo history.
- Added pure helper module `todoHistory.mjs` and type declarations.
- Added unit tests for completed todo filtering, sorting, pagination, and stats.
- Added design and implementation plan docs for the feature.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/todoHistory.mjs`
- `apps/web/src/todoHistory.d.mts`
- `apps/web/test/todoHistory.test.mjs`
- `docs/superpowers/specs/2026-06-12-my-page-todo-history-design.md`
- `docs/superpowers/plans/2026-06-12-my-page-todo-history.md`
- `memory-bank/prd-my-page-todo-history.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/design-document.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- RED: `node --test apps\web\test\todoHistory.test.mjs` failed because `todoHistory.mjs` did not exist.
- GREEN: `node --test apps\web\test\todoHistory.test.mjs` passed 3 tests.
- `npm.cmd test` passed 37 tests.
- `npm.cmd run build` passed.
- Browser plugin verification was blocked by `net::ERR_BLOCKED_BY_CLIENT` for `127.0.0.1:5177` and `localhost:5177`.
- Build output contains `내 페이지`, `completed tasks`, `todo-history`, and `profile-summary-grid`.

#### Remaining Work

- Deploy to Vercel after a valid Vercel token or login is available.
- Confirm My Page behavior on the actual mobile browser after deployment.

#### Next Priority

- Continue medium-force habit system design or deploy the current local web changes.

### 2026-06-12

#### Completed Work

- Fixed the web app to opt out of mobile browser automatic dark theming.
- Added `color-scheme` and `theme-color` meta tags to the web HTML.
- Added `color-scheme: only light` and explicit root background/color CSS.
- Added light color-scheme handling for native form controls.
- Added a regression test for mobile light-theme enforcement.

#### Changed Files

- `apps/web/index.html`
- `apps/web/src/styles.css`
- `apps/web/test/mobileTheme.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- RED: `node --test apps\web\test\mobileTheme.test.mjs` failed because `color-scheme` meta was missing.
- GREEN: `node --test apps\web\test\mobileTheme.test.mjs` passed.
- `npm.cmd test` passed 34 tests.
- `npm.cmd run build` passed.

#### Remaining Work

- Deploy to Vercel after a valid Vercel token or login is available.
- Confirm on the actual mobile browser after deployment.

#### Next Priority

- Continue the medium-force habit system design after the mobile theme fix is visible on the user's phone.

### 2026-06-12

#### Completed Work

- Continued brainstorming the next medium-force study habit system.
- Chose to treat timer starts between T+15 and T+30 as `present`.
- Chose 2 nudge reminders before final missed handling.
- Chose Telegram absence reason collection with category buttons plus optional note.
- Updated the latest Telegram-linked user's Supabase profile reminder time from `21:00:00` to `20:30:00` in `Asia/Tokyo`.

#### Changed Files

- `memory-bank/active-context.md`
- `memory-bank/progress.md`

#### Verification

- Supabase profile query before update returned `reminder_time=21:00:00`.
- Supabase profile update returned `reminder_time=20:30:00`.
- Supabase profile query after update returned `reminder_time=20:30:00`.

#### Remaining Work

- Write a design spec for the medium-force habit system.
- Implement T+15 nudge, T+30 final missed threshold, and Telegram absence reason webhook after the design is approved.

#### Next Priority

- Decide the exact Telegram wording and button categories for nudge and absence-reason messages.

### 2026-06-11

#### Completed Work

- Diagnosed why the configured 21:00 local reminder did not send to Telegram or computer Web Push.
- Confirmed Supabase Cron was active and returning HTTP 200 every minute.
- Confirmed the latest enabled Telegram target has `reminder_time = 21:00:00` and `time_zone = Asia/Tokyo`.
- Confirmed the 2026-06-11 21:00 local cron window returned `dueReminderCount:0` and created no notification delivery rows.
- Found the root cause: a 2-second study session at 2026-06-11 01:39:36 local had already marked the day `present`, so `get_due_reminders()` excluded the user at 21:00.
- Added migration `0009_start_session_attendance_window.sql` so `start_study_session()` only marks attendance `present` inside the reminder-to-deadline window.
- Applied the migration to Supabase project `bqohkdzvxbrokkmuhysx` with MCP `_apply_migration`.
- Verified the remote function definition contains the reminder-window guard.

#### Changed Files

- `supabase/migrations/0009_start_session_attendance_window.sql`
- `packages/core/test/sql-migrations.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- Remote migration history includes `start_session_attendance_window`.
- Remote SQL check returned `function_guard=True`.
- Remote cron check returned `study-room-attendance-cron schedule=* * * * * active=True`.
- 21:00 local cron window had 5 HTTP 200 responses and all returned `{"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}`.
- 21:00 local notification delivery window had 0 delivery rows.
- `node --test packages\core\test\sql-migrations.test.mjs` passed 6 tests.
- `npm.cmd test` passed 33 tests.
- `npm.cmd run build` passed.

#### Remaining Work

- If Vercel production must receive local file changes, rerun deployment after Vercel credentials are available.

#### Next Priority

- Test tomorrow or set a near-future reminder to verify that Telegram/Web Push send normally when the day has not already been marked `present`.

### 2026-06-11

#### 완료한 작업

- 웹 설정 화면에 `Telegram 테스트 알림` 버튼을 추가했다.
- `sendTelegramTestAlarm(session)` helper를 추가해 브라우저에서 Supabase JWT로 `telegram-test-alarm` Edge Function을 호출하게 했다.
- `telegram-test-alarm` Edge Function을 업데이트해 cron-secret 호출과 사용자 JWT 호출을 모두 지원하도록 했다.
- 사용자 JWT 호출은 `admin.auth.getUser(jwt)`로 검증하고 `notification_targets.user_id`를 로그인 사용자로 제한한다.
- Edge Function 한글 알림 문구는 배포 인코딩 문제를 피하기 위해 Unicode escape 문자열로 정리했다.
- `telegram-test-alarm` version 2를 ACTIVE로 배포했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/telegramNotifications.mjs`
- `apps/web/src/telegramNotifications.d.mts`
- `apps/web/test/telegramNotifications.test.mjs`
- `supabase/functions/telegram-test-alarm/index.ts`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`
- `memory-bank/prd-telegram-popup-notifications.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- RED: `node --test apps\web\test\telegramNotifications.test.mjs` 실패 확인
- GREEN: `node --test apps\web\test\telegramNotifications.test.mjs` 3개 통과
- `npm.cmd test` 32개 통과
- `npm.cmd run build` 통과
- Supabase MCP `_deploy_edge_function`으로 `telegram-test-alarm` version 2 ACTIVE 확인
- 인증 없는 Edge Function 호출 결과: `401`
- 로컬 build asset에서 `Telegram 테스트 알림`과 `telegram-test-alarm` 문자열 포함 확인

#### 남은 작업

- Vercel production 배포가 필요하다.
- 현재 로컬 Vercel CLI 인증이 없어 `No existing credentials found. Please run vercel login or pass "--token"` 오류로 배포가 막혔다.

#### 다음 우선순위

- `vercel login`을 완료하거나 Vercel token을 제공받은 뒤 production 배포를 수행한다.

### 2026-06-11

#### 완료한 작업

- Telegram 테스트 알림을 다시 발송했다.
- `telegram-test-alarm` Edge Function을 `x-cron-secret`으로 호출했고, Telegram Bot API 응답에서 `message_id=6`을 확인했다.
- 이번 발송 시 오늘 todo는 `0개`라 알림 본문에 `오늘 할 일` 목록은 포함되지 않았다.

#### 변경된 파일

- `memory-bank/progress.md`

#### 검증 방법

- Edge Function 호출 결과: `telegram_test_function=ok local_date=2026-06-11 todo_count=0 message_id=6`
- 원격 DB 최신 `notification_deliveries` 조회 결과: `channel=telegram`, `status=sent`, `local_date=2026-06-11`, `has_error=False`

#### 남은 작업

- 사용자가 Telegram 앱에서 테스트 메시지 수신 여부를 확인한다.
- 오늘 todo를 추가한 뒤 다시 테스트하면 `오늘 할 일` 목록이 알림에 포함되는지 확인할 수 있다.

#### 다음 우선순위

- 필요하면 웹 설정 화면에 Telegram 테스트 알림 버튼을 추가한다.

### 2026-06-11

#### 완료한 작업

- `telegram-test-alarm` Supabase Edge Function을 추가하고 version 1 ACTIVE로 배포했다.
- 등록된 Telegram 알림 대상에게 테스트 메시지를 실제 발송했다.
- 테스트 메시지는 서버 측 `TELEGRAM_BOT_TOKEN` secret을 Edge Function 런타임에서만 사용했고, 로컬 또는 문서에 secret 값을 출력하지 않았다.
- 테스트 발송 결과가 `notification_deliveries.channel = 'telegram'`으로 기록되도록 구성했다.
- Supabase Management API `/secrets`의 `value`는 실제 Telegram token으로 사용할 수 없는 placeholder 성격임을 확인했다.

#### 변경된 파일

- `supabase/functions/telegram-test-alarm/index.ts`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- Supabase MCP `_deploy_edge_function`으로 `telegram-test-alarm` version 1 ACTIVE 배포 확인
- Supabase Vault `cron_secret`을 내부 변수로만 읽어 `https://bqohkdzvxbrokkmuhysx.functions.supabase.co/telegram-test-alarm` 호출
- 호출 결과: `telegram_test_function=ok local_date=2026-06-11 todo_count=0 message_id=5`
- 원격 DB 최신 `notification_deliveries` 조회 결과: `channel=telegram`, `status=sent`, `local_date=2026-06-11`, `has_error=False`
- `npm.cmd test` 31개 테스트 통과
- `npm.cmd run build` 통과
- Supabase Management API function 조회 결과: `telegram-test-alarm` status `ACTIVE`, version `1`

#### 남은 작업

- 사용자가 Telegram 앱에서 테스트 메시지 수신 여부를 확인한다.
- 필요하면 웹 설정 화면에 "Telegram 테스트 알림 보내기" 버튼을 추가한다.

#### 다음 우선순위

- 실제 예약 알림 시간에 `attendance-cron`이 같은 todo 포함 본문으로 Telegram/Web Push를 보내는지 `notification_deliveries`에서 확인한다.

### 2026-06-11

#### 완료한 작업

- Telegram 및 Web Push 컴퓨터 알림 본문에 알림 날짜의 `study_todos` 제목을 포함하도록 `attendance-cron`을 수정했다.
- `attendance-cron`에서 due reminder 사용자/날짜를 기준으로 todo를 한 번에 조회하고 사용자+날짜별로 grouping하도록 구현했다.
- 알림 본문에 `오늘 할 일` 섹션을 추가하고 완료 항목은 체크 표시, 미완료 항목은 빈 체크 표시로 나타나게 했다.
- 웹앱이 열려 있을 때 표시되는 내부 알림 팝업에도 알림 날짜 todo list를 읽기 전용으로 표시하도록 수정했다.
- 원격 Supabase `attendance-cron` Edge Function을 version 9 ACTIVE로 배포했다.
- Vercel production을 재배포해 최신 배포 `dpl_D5L7trvBoiVTjn1B65TtRYcpU79X`를 READY 상태로 만들었다.
- 운영 URL이 최신 JS/CSS asset을 반환하고, 배포 JS에 `reminder-todos` UI가 포함됨을 확인했다.

#### 변경된 파일

- `supabase/functions/attendance-cron/index.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `packages/core/test/sql-migrations.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`
- `memory-bank/prd-telegram-popup-notifications.md`

#### 검증 방법

- `node --test packages\core\test\sql-migrations.test.mjs`
- `npm.cmd test`
- `npm.cmd run build`
- Supabase MCP `_deploy_edge_function`으로 `attendance-cron` version 9 ACTIVE 확인
- Vercel CLI `vercel@48.6.0 deploy --prod --yes --token ... --scope astars-projects-c2f42587`
- Vercel MCP `_web_fetch_vercel_url`로 운영 URL과 `/auth/callback` 200 확인
- 배포 asset 조회로 `has_reminder_todos_ui=True`, `has_today_tasks_label=True`, `has_supabase_project=True` 확인

#### 남은 작업

- 운영 URL에서 알림 시간을 현재 시각 기준 2~3분 뒤로 저장한 뒤, 실제 Telegram/Web Push 수신 메시지에 todo가 포함되는지 확인한다.

#### 다음 우선순위

- 실수신 검증 후 `notification_deliveries`에서 `telegram`/`web_push` 발송 결과와 에러 메시지를 확인한다.

### 2026-06-11

#### 완료한 작업

- Vercel 배포용 `vercel.json`을 추가했다.
- 로컬 `npm.cmd run build`가 통과함을 확인했다.
- Vercel 팀 `Astar's projects`에 `study-room-attendance` 프로젝트를 생성하고 프로덕션 배포를 완료했다.
- Vercel 운영 URL `https://study-room-attendance.vercel.app`이 200을 반환함을 확인했다.
- `/auth/callback` 경로가 SPA fallback으로 `index.html`을 반환함을 확인했다.
- Supabase Auth `site_url`과 redirect allow list에 Vercel 운영 URL을 반영했다.
- Supabase Edge Function secret `APP_ORIGIN`을 Vercel 운영 URL로 설정했다.
- Vercel 프로젝트 환경변수에 public Vite build 변수 4개를 등록했다.
- Vercel production을 재배포해 최신 배포 `dpl_CvZnRucR3njoPZFnPZLRjQDHX4jG`를 READY 상태로 만들었다.
- 배포된 JS 번들 `index-DkPm8Vbp.js`에서 Supabase 프로젝트 URL 포함, Google 로그인 비활성화 문구 제거, placeholder 미포함을 확인했다.
- Supabase Google authorize endpoint가 Vercel callback 기준 `302 Found`를 반환함을 확인했다.
- 인앱 브라우저를 Vercel 운영 URL로 이동했고 페이지 제목 `강제 출석 독서실`을 확인했다.

#### 변경된 파일

- `vercel.json`
- `.gitignore`
- `.vercel/project.json`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- `npm.cmd run build`
- Vercel CLI `vercel@48.6.0 deploy --prod --yes --token ... --scope astars-projects-c2f42587`
- Vercel REST API `/v10/projects/{projectId}/env?upsert=true`로 환경변수 등록
- Vercel MCP `_web_fetch_vercel_url`로 운영 URL과 `/auth/callback` 200 확인
- Supabase Management API로 Auth URL config와 `APP_ORIGIN=set` 확인
- 배포 asset 조회로 `has_supabase_project=True`, `has_google_disabled_message=False`, `has_missing_supabase_placeholder=False` 확인
- Supabase authorize GET 요청이 `302 Found`를 반환하는지 확인
- Browser MCP `browser_navigate`로 운영 URL 페이지 제목 확인

#### 남은 작업

- 운영 URL에서 실제 Google 로그인 완료 여부를 브라우저로 확인한다.
- 알림 시간을 현재 시각 기준 2~3분 뒤로 설정해 Telegram 자동 발송 기록을 확인한다.

#### 다음 우선순위

- 운영 URL 기준 로그인 -> 알림 설정 저장 -> Telegram 자동 알림 수신 플로우를 검증한다.

### 2026-06-11

#### 완료한 작업

- 독서실 웹 앱 dev server를 3000번이 아닌 `5177` 포트로 실행했다.
- `http://127.0.0.1:5177/` HTTP 응답이 200임을 확인했다.
- 인앱 브라우저를 `http://127.0.0.1:5177/`로 이동했고 페이지 제목 `강제 출석 독서실`을 확인했다.
- Windows 환경 변수 `Path/PATH` 중복과 npm workspace `.bin` 경로 문제로 `npm.cmd --workspace apps/web run dev`가 실패해, `node.exe node_modules/vite/bin/vite.js` 직접 실행 방식으로 우회했다.

#### 변경된 파일

- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- `Invoke-WebRequest http://127.0.0.1:5177/`
- Browser MCP `browser_navigate`로 `http://127.0.0.1:5177/` 이동

#### 남은 작업

- 로그인 후 실제 알림 시간 변경 및 Telegram 자동 발송 기록을 확인한다.

#### 다음 우선순위

- 알림 시간을 현재 시각 기준 2~3분 뒤로 설정해 Supabase Cron 기반 Telegram 자동 알림을 검증한다.

### 2026-06-11

#### 완료한 작업

- Resend API key와 Telegram bot token을 Supabase Edge Function secrets에 추가하고 set 상태를 확인했다.
- Telegram 알림 채널 PRD와 Superpowers 설계 문서를 작성했다.
- `notification_targets`와 `notification_deliveries`에 `telegram` 채널을 허용하는 migration을 추가했다.
- 웹 설정 화면에 Telegram 상태 배지와 Chat ID 입력 필드를 추가했다.
- Telegram Chat ID 정규화/검증 helper와 테스트를 추가했다.
- `attendance-cron` Edge Function에 Telegram Bot API `sendMessage` 발송 분기를 추가했다.
- 앱이 열려 있을 때 알림 시간에 표시되는 내부 팝업 모달을 추가했다.
- 원격 Supabase DB에 Telegram migration을 적용했다.
- 원격 `attendance-cron` Edge Function version 6을 ACTIVE로 배포했다.
- 사용자가 새로 발급한 Telegram bot token을 Supabase Edge Function secret `TELEGRAM_BOT_TOKEN`에 덮어썼고 set 상태를 확인했다.
- Telegram `getUpdates`를 조회했지만 update 결과가 0건이라 아직 Chat ID 후보를 얻지 못했다.
- 사용자가 bot에게 메시지를 보낸 뒤 Telegram `getUpdates`에서 private chat ID 후보를 확인했다.
- 확인한 Chat ID를 `p64***@gmail.com` / `A스타` 프로필의 `notification_targets.kind = 'telegram'` 대상으로 저장했다.
- Telegram Bot API `sendMessage` 테스트 메시지 발송이 성공했고, DB에서 Telegram target이 `enabled=true`임을 확인했다.

#### 변경된 파일

- `.env.example`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/telegramChatId.mjs`
- `apps/web/src/telegramChatId.d.mts`
- `apps/web/src/telegramNotifications.mjs`
- `apps/web/src/telegramNotifications.d.mts`
- `apps/web/test/telegramNotifications.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/migrations/0008_telegram_notification_targets.sql`
- `supabase/functions/attendance-cron/index.ts`
- `docs/superpowers/specs/2026-06-11-telegram-popup-notifications-design.md`
- `memory-bank/prd-telegram-popup-notifications.md`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`

#### 검증 방법

- `npm.cmd test`
- `npm.cmd run build`
- Supabase `_apply_migration`
- Supabase `_deploy_edge_function`
- Supabase `_execute_sql`로 `telegram` constraint 확인
- Supabase secret 목록에서 `RESEND_API_KEY=set`, `TELEGRAM_BOT_TOKEN=set` 확인
- Supabase `_list_edge_functions`에서 `attendance-cron` version 6 ACTIVE 확인
- Telegram Bot API `getUpdates` 조회 결과 `update_count=0` 확인
- Telegram Bot API `getUpdates` 재조회로 private chat 후보 1건 확인
- Supabase `_execute_sql`로 `notification_targets.kind = 'telegram'` 저장 및 enabled 상태 확인
- Telegram Bot API `sendMessage` 테스트 응답 `ok=true` 확인

#### 남은 작업

- 배포 URL이 생기면 `APP_ORIGIN` Edge Function secret을 설정해야 한다.
- Slack 알림이 필요하면 별도 `slack_webhook` 채널로 후속 구현한다.

#### 다음 우선순위

- 알림 시간을 현재 시각 기준 2~3분 뒤로 설정해 Supabase Cron -> `attendance-cron` -> Telegram 자동 발송 기록을 확인한다.

### 2026-06-11

#### 완료한 작업

- 독서실 앱의 Vercel 배포 여부를 확인했다.
- 로컬 프로젝트에 `.vercel/project.json`과 `vercel.json`이 없음을 확인했다.
- Vercel 팀 `Astar's projects` 프로젝트 목록을 조회했다.
- Vercel에는 `stock-dashboard`, `movie-site`, `movie-site-tnwx`, `todo-list`, `emotion-project`만 있고 `study-room-attendance` 또는 독서실 앱으로 보이는 프로젝트는 없음을 확인했다.
- memory-bank 기준 AWS CDK 정적 호스팅 코드는 작성되어 있지만 실제 AWS 배포는 남은 작업으로 기록되어 있음을 확인했다.

#### 변경된 파일

- `memory-bank/active-context.md`
- `memory-bank/progress.md`

#### 검증 방법

- 로컬 파일 조회: `.vercel/project.json`, `vercel.json`
- Vercel MCP `_list_teams`
- Vercel MCP `_list_projects`
- `rg`로 Vercel/AWS 배포 관련 기록 확인

#### 남은 작업

- 사용자가 원하면 Vercel 신규 프로젝트 배포를 진행한다.
- 배포 후 Supabase Auth redirect URL과 OAuth provider redirect URL에 Vercel URL을 추가해야 한다.
- `APP_ORIGIN` Edge Function secret도 배포 URL로 설정해야 한다.

#### 다음 우선순위

- Vercel로 갈지, 기존 AWS CDK S3/CloudFront 경로로 갈지 결정한다.

### 2026-06-08

#### 완료한 작업

- 독서실 앱 알림 미수신 원인을 원격 Supabase 기준으로 진단했다.
- `attendance-cron` Edge Function version 4와 `kakao-token` version 2가 ACTIVE임을 확인했다.
- `study-room-attendance-cron` cron job이 매분 실행 중이고, 최신 `net._http_response`가 200임을 확인했다.
- 현재 시각 기준 `get_due_reminders(now())`가 0건이라 지금 즉시 발송 대상은 없음을 확인했다.
- `notification_targets`에는 `email` 2개, `web_push` 2개만 있고 `expo`, `kakao_memo` 대상은 없음을 확인했다.
- 최근 발송 기록에서 이메일은 `RESEND_API_KEY is required`로 실패하고, 웹푸시는 한 건 실패와 한 건 성공 기록이 있음을 확인했다.
- Edge Function secrets에서 `RESEND_API_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `APP_ORIGIN`이 missing임을 확인했다.
- Supabase Auth 설정에서 `external_kakao_enabled=True`, `security_manual_linking_enabled=False`임을 확인했다.

#### 변경된 파일

- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- Supabase MCP `_list_edge_functions`
- Supabase MCP `_execute_sql`
  - `cron.job`
  - `net._http_response`
  - `public.get_due_reminders(now())`
  - `public.notification_targets`
  - `public.notification_deliveries`
- Supabase Management API secret/auth config 조회

#### 남은 작업

- 사용자가 `RESEND_API_KEY`를 설정해야 이메일 알림이 발송된다.
- 사용자가 Supabase Manual Linking과 Kakao secrets를 설정한 뒤 카카오톡 알림 연결을 다시 수행해야 한다.
- 휴대폰 푸시는 모바일 Expo Push Token 대상이 등록되어야 한다.
- 웹푸시는 브라우저 권한이 허용 상태인지 확인하고 컴퓨터 알림을 다시 등록해야 한다.

#### 다음 우선순위

- 먼저 사용할 알림 채널을 결정한다. 개인용 MVP에서는 카카오톡 알림 또는 웹푸시 중 하나를 정상화하는 것이 우선이다.

### 2026-06-08

#### 완료한 작업

- 웹 앱 설정 화면에 카카오톡 알림 상태 배지와 `카카오톡 알림 연결` 버튼을 추가했다.
- Kakao OAuth 연결 요청에 `talk_message account_email profile_image profile_nickname` scope를 포함했다.
- OAuth callback 직후 Supabase session의 `provider_token`/`provider_refresh_token`을 `kakao-token` Edge Function으로 저장하는 흐름을 추가했다.
- `kakao_message_connections` 테이블을 추가하고 Kakao raw token을 사용자 직접 조회 대상인 `notification_targets`에서 분리했다.
- `notification_targets`와 `notification_deliveries` check constraint에 `kakao_memo` 채널을 추가했다.
- `attendance-cron` Edge Function에 Kakao "나에게 보내기" API 호출과 access token refresh 로직을 추가했다.
- 원격 Supabase DB에 Kakao migration SQL을 적용했다.
- 원격 Edge Function `kakao-token` version 2를 ACTIVE로 배포했다.
- 원격 Edge Function `attendance-cron` version 4를 ACTIVE로 배포했다.
- `kakao-token` CORS preflight가 204로 응답하고, 인증 없는 GET이 함수 내부 401을 반환하는 것을 확인했다.
- 최신 `net._http_response` 3건이 모두 200이고 `{"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}`를 반환하는 것을 확인했다.

#### 변경된 파일

- `.env.example`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/authProviders.mjs`
- `apps/web/src/authProviders.d.mts`
- `apps/web/src/kakaoNotifications.mjs`
- `apps/web/src/kakaoNotifications.d.mts`
- `apps/web/test/authProviders.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/migrations/0007_kakao_message_notifications.sql`
- `supabase/functions/kakao-token/index.ts`
- `supabase/functions/attendance-cron/index.ts`
- `docs/superpowers/plans/2026-06-08-kakao-notification-channel.md`
- `memory-bank/prd-kakao-notifications.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- `node --test packages/core/test/sql-migrations.test.mjs apps/web/test/authProviders.test.mjs`
- `npm.cmd test`
- `npm.cmd run build`
- Supabase Management API SQL로 `public.kakao_message_connections`와 `kakao_memo` constraints 확인
- Supabase Edge Function 목록에서 `kakao-token` version 2 ACTIVE, `attendance-cron` version 4 ACTIVE 확인
- `curl.exe -i -X OPTIONS https://bqohkdzvxbrokkmuhysx.supabase.co/functions/v1/kakao-token`로 CORS preflight 204 확인
- Supabase `net._http_response` 최신 cron 응답 200 확인

#### 남은 작업

- Supabase Auth 설정에서 `security_manual_linking_enabled`를 사용자가 직접 true로 변경해야 한다.
- Edge Function secrets에 `KAKAO_REST_API_KEY`, 필요 시 `KAKAO_CLIENT_SECRET`, 배포 URL 확정 후 `APP_ORIGIN`을 설정해야 한다.
- Kakao Developers에서 `talk_message` 동의항목이 활성화되어 있는지 확인해야 한다.
- 실제 웹 UI에서 `카카오톡 알림 연결`을 눌러 token 저장과 `kakao_memo` target 생성 여부를 확인해야 한다.

#### 다음 우선순위

- 사용자가 Manual Linking과 Kakao secrets를 설정한 뒤 실제 Kakao 연결/발송 테스트를 수행한다.

### 2026-06-08

#### 완료한 작업

- Supabase Management API로 `external_kakao_enabled=False`였음을 확인했다.
- Kakao Client ID/Secret은 이미 설정되어 있었으므로 `external_kakao_enabled=True`로 변경했다.
- Kakao authorize endpoint가 `302 Found`로 `kauth.kakao.com/oauth/authorize`에 리다이렉트되는 것을 확인했다.
- `scopes=talk_message account_email profile_image profile_nickname` 요청 시 Kakao OAuth URL scope에 `talk_message`가 포함되는 것을 확인했다.

#### 변경된 파일

- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`

#### 검증 방법

- Supabase Management API auth config 조회/수정
- `curl.exe`로 Supabase Kakao authorize endpoint 확인

#### 남은 작업

- 웹 앱에 Kakao 연결 버튼 추가
- Kakao OAuth 요청에 `talk_message` scope 포함
- 카카오 provider token/refresh token 저장 테이블 구현
- `attendance-cron`에 카카오 나에게 보내기 발송 채널 추가

#### 다음 우선순위

- 카카오톡 알림을 실제 발송하려면 앱/DB/Edge Function 구현을 진행한다.

### 2026-06-08

#### 완료한 작업

- 카카오톡 나에게 보내기 알림 가능 여부를 확인했다.
- Supabase authorize endpoint가 Kakao provider에 대해 `Unsupported provider: provider is not enabled`를 반환하는 것을 확인했다.
- 원격 `attendance-cron` Edge Function이 `expo`, `web_push`, `email`만 처리하고 카카오 발송 분기는 없는 것을 확인했다.
- 원격 DB의 `notification_targets_kind_check`, `notification_deliveries_channel_check`가 `expo`, `web_push`, `email`만 허용하는 것을 확인했다.
- 현재 `notification_targets`에는 `email`, `web_push` 대상만 있고 `kakao` 또는 `kakao_memo` 대상은 없는 것을 확인했다.

#### 변경된 파일

- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- `curl.exe -s -i https://bqohkdzvxbrokkmuhysx.supabase.co/auth/v1/authorize?provider=kakao...`
- Supabase MCP `_get_edge_function`
- Supabase MCP `_execute_sql`

#### 남은 작업

- Supabase Auth Kakao Provider 활성화
- 웹 앱에 Kakao 연결 버튼 추가
- 카카오 OAuth provider token/refresh token 저장 구조 추가
- `attendance-cron`에 카카오 나에게 보내기 API 호출 분기 추가

#### 다음 우선순위

- 카카오 연동을 알림 채널로 구현할지 확정한 뒤 별도 PRD와 마이그레이션을 작성한다.

### 2026-06-08

#### 완료한 작업

- Supabase MCP로 원격 `attendance-cron` Edge Function이 `ACTIVE`, `verify_jwt=false`, version 3 상태임을 확인했다.
- Supabase SQL로 `study-room-attendance-cron`이 `* * * * *` 스케줄, `active=true`로 등록된 것을 확인했다.
- 최근 `net._http_response`가 HTTP 200과 `{"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}` 형태로 기록되는 것을 확인했다.
- `notification_targets`에는 `email` 2개, `web_push` 2개가 있고, `expo` 대상은 아직 없는 것을 확인했다.
- 최근 `notification_deliveries` 실패 원인은 `RESEND_API_KEY is required`와 `Received unexpected response code`인 것을 확인했다.

#### 변경된 파일

- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- Supabase MCP `_list_edge_functions`
- Supabase MCP `_get_edge_function`
- Supabase MCP `_execute_sql`:
  - `cron.job`
  - `net._http_response`
  - `public.notification_targets`
  - `public.notification_deliveries`

#### 남은 작업

- `apps/mobile/.env.local`의 `EXPO_PUBLIC_EAS_PROJECT_ID` 설정
- 실제 휴대폰에서 Expo Push Token 등록
- 이메일 fallback을 사용하려면 `RESEND_API_KEY` Edge Function secret 설정
- stale web push subscription 재등록 또는 차단된 브라우저 권한 해제

#### 다음 우선순위

- 휴대폰 알림을 기본 경로로 쓰기 위해 Expo EAS project id를 발급하고 모바일 앱에서 푸시 등록을 검증한다.

### 2026-06-08

#### 완료한 작업

- Google 인증 후 Supabase가 `#access_token` hash callback을 반환할 때 앱이 다시 로그인 기본 화면으로 돌아가던 문제를 수정했다.
- OAuth callback 판별이 query `?code=`뿐 아니라 hash `#access_token`, hash error도 인식하도록 했다.
- hash callback의 access token/refresh token을 `supabase.auth.setSession`으로 세션화하도록 했다.
- callback URL의 token hash를 `history.replaceState`로 즉시 제거하는 흐름을 유지했다.
- OAuth callback helper 테스트를 보강했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/authProviders.mjs`
- `apps/web/src/authProviders.d.mts`
- `apps/web/test/authProviders.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- `node --test apps/web/test/authProviders.test.mjs`
- `npm.cmd test`
- `npm.cmd run build`

#### 남은 작업

- 실제 브라우저에서 Google 로그인 재시도 후 대시보드 진입 확인

#### 다음 우선순위

- OAuth callback URL에 토큰이 남지 않는지 브라우저에서 확인

### 2026-06-08

#### 완료한 작업

- Supabase Auth Google Provider가 꺼져 있어 Google 로그인이 `Unsupported provider: provider is not enabled`로 실패하던 문제를 확인했다.
- 원격 프로젝트 `bqohkdzvxbrokkmuhysx`에서 `external_google_enabled=true`로 변경했다.
- Google Client ID/Secret이 Supabase Auth 설정에 존재하는 것을 확인했다.
- 로컬 OAuth callback URL이 `uri_allow_list`에 들어 있는 것을 확인했다.
- `apps/web/.env.local`에서 중복된 `VITE_GOOGLE_AUTH_ENABLED=false` 줄을 제거했다.

#### 변경된 파일

- `apps/web/.env.local`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- Supabase Management API로 `external_google_enabled=true` 확인
- Supabase authorize URL GET 요청이 `302 Found`와 Google OAuth URL을 반환하는 것 확인

#### 남은 작업

- 브라우저에서 실제 Google 계정 선택 후 앱 callback 로그인 완료 확인

#### 다음 우선순위

- 배포 도메인이 생기면 Google Cloud Authorized JavaScript origins와 Supabase URL allow list에 운영 URL 추가

### 2026-06-07

#### 완료한 작업

- 페이지를 닫거나 벗어날 때 활성 집중 세션이 계속 누적되지 않도록 자동 종료 요청을 추가했다.
- `pagehide`, `beforeunload`, `visibilitychange` 이벤트에서 `keepalive` fetch로 `end_study_session` RPC를 호출하도록 했다.
- 종료 요청에 필요한 Supabase URL/anon key를 프론트 설정 모듈에서 재사용할 수 있게 export했다.
- 페이지 이탈 자동 종료 요청의 단위 테스트를 추가했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/sessionExit.mjs`
- `apps/web/src/sessionExit.d.mts`
- `apps/web/src/supabase.ts`
- `apps/web/test/sessionExit.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`
- `memory-bank/prd-user-profile.md`

#### 검증 방법

- `node --test apps/web/test/sessionExit.test.mjs`
- `npm.cmd test`
- `npm.cmd run build`

#### 남은 작업

- 실제 브라우저에서 세션 시작 후 탭 닫기/페이지 이탈 시 Supabase 세션이 종료되는지 수동 확인

#### 다음 우선순위

- 브라우저 알림이 `denied`인 사용자를 위한 권한 재허용 안내 개선

### 2026-06-07

#### 완료한 작업

- Supabase 원격 프로젝트 `bqohkdzvxbrokkmuhysx`에 알림 자동 처리 설정을 적용했다.
- Edge Function secrets에 `CRON_SECRET`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`를 설정했다.
- Supabase Vault에 `project_url`, `cron_secret`을 설정했다.
- `study-room-attendance-cron`을 `* * * * *` 스케줄로 등록했다.
- `get_due_reminders`의 `column reference "user_id" is ambiguous` 오류를 수정했다.
- 웹푸시 VAPID 공개키 변경 시 기존 브라우저 구독을 해제하고 재구독하도록 보강했다.
- 자동 cron 호출이 200 응답을 반환하는 것을 확인했다.

#### 변경된 파일

- `apps/web/.env.local`
- `apps/web/src/webPush.ts`
- `apps/web/src/webPushKeys.mjs`
- `apps/web/src/webPushKeys.d.mts`
- `apps/web/test/webPushKeys.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/cron.sql`
- `supabase/migrations/0006_fix_due_reminders_ambiguity.sql`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`
- `memory-bank/prd-supabase-cron.md`

#### 검증 방법

- `node --test packages/core/test/sql-migrations.test.mjs`
- `node --test apps/web/test/webPushKeys.test.mjs`
- `npm.cmd test`
- `npm.cmd run build`
- 원격 `get_due_reminders(now())`, `mark_missed_attendance(now())` 분리 실행
- 원격 `net._http_response`에서 자동 cron 200 응답 확인

#### 남은 작업

- Resend API key 설정
- Expo EAS project id 설정 및 휴대폰 Expo Push Token 등록
- 웹 브라우저에서 컴퓨터 알림 재등록

#### 다음 우선순위

- 웹 UI에서 `저장하고 컴퓨터 알림 켜기`를 다시 눌러 새 VAPID 키로 구독 갱신
- 모바일 앱 `.env.local`의 `EXPO_PUBLIC_EAS_PROJECT_ID` 설정

### 2026-06-07

#### 완료한 작업

- AWS CDK 하위 프로젝트 `infra/aws-cdk`를 추가했다.
- S3 private bucket + CloudFront OAC 기반 정적 웹 호스팅 스택을 작성했다.
- EventBridge 1분 스케줄 + 128 MB ARM Lambda invoker를 작성했다.
- Lambda가 Supabase `attendance-cron` Edge Function을 호출하도록 구현했다.
- Secrets Manager를 기본 사용하지 않고 `CronSecret` NoEcho 파라미터를 사용하도록 비용 최소화 구성을 선택했다.
- CDK/배포 README와 Superpowers 설계/계획 문서를 작성했다.

#### 변경된 파일

- `package.json`
- `.gitignore`
- `infra/aws-cdk/package.json`
- `infra/aws-cdk/package-lock.json`
- `infra/aws-cdk/cdk.json`
- `infra/aws-cdk/tsconfig.json`
- `infra/aws-cdk/README.md`
- `infra/aws-cdk/bin/study-room-aws.ts`
- `infra/aws-cdk/src/study-room-aws-stack.ts`
- `infra/aws-cdk/lambda/attendance-cron-invoker/index.mjs`
- `infra/aws-cdk/lambda/attendance-cron-invoker/index.test.mjs`
- `infra/aws-cdk/test/study-room-aws-stack.test.ts`
- `docs/superpowers/specs/2026-06-07-aws-cdk-deployment-design.md`
- `docs/superpowers/plans/2026-06-07-aws-cdk-deployment.md`
- `memory-bank/*`

#### 검증 방법

- `node --test infra\aws-cdk\lambda\attendance-cron-invoker\index.test.mjs`
- `npm.cmd --prefix infra\aws-cdk run test:cdk`
- `npm.cmd run infra:test`
- `npm.cmd run infra:build`
- `npm.cmd run infra:synth`

#### 남은 작업

- 실제 AWS 계정에서 `cdk bootstrap` 실행
- 실제 `CronSecret` 값으로 `cdk deploy`
- 배포 후 Supabase Auth redirect URL에 CloudFront 도메인 추가
- 휴대폰 알림을 위해 Expo Push Token 등록 흐름 점검

#### 다음 우선순위

- AWS credential 확인 후 배포
- 배포된 CloudFront URL로 로그인/알림 등록 플로우 검증
