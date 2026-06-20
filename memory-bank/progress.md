# Progress

## Timeline

### 2026-06-20 - Study goal D-day dashboard

#### Completed Work

- Added a study goal feature so users can create D-day based long-term goals.
- Added `study_goals` with user-scoped RLS and linked `study_todos.goal_id` for optional todo-to-goal association.
- Added a top dashboard goal card that shows the nearest active goal's D-day, target date, linked todo completion, and study progress.
- Added a dedicated hash-routed `#goals` page for creating, editing, completing, and deleting goals.
- Added goal linking controls to the todo modal and goal modal.
- Applied the Supabase migration to project `bqohkdzvxbrokkmuhysx` and verified the remote table, RLS, policies, todo column, and FK.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/studyGoals.mjs`
- `apps/web/src/studyGoals.d.mts`
- `apps/web/src/dashboardRoute.mjs`
- `apps/web/src/dashboardRoute.d.mts`
- `apps/web/test/studyGoals.test.mjs`
- `apps/web/test/dashboardRoute.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/migrations/20260620071258_study_goals.sql`
- `memory-bank/prd-study-goals.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`

#### Verification

- RED: `node --test apps\web\test\studyGoals.test.mjs apps\web\test\dashboardRoute.test.mjs packages\core\test\sql-migrations.test.mjs` failed before the helper, route, and migration existed.
- GREEN: `node --test apps\web\test\studyGoals.test.mjs apps\web\test\dashboardRoute.test.mjs packages\core\test\sql-migrations.test.mjs` passed after implementation.
- `npm.cmd test` passed 145 tests.
- `npm.cmd run build` passed.
- Supabase SQL verification returned `study_goals_exists=true`, `study_goals_rls_enabled=true`, `study_todos_goal_id_exists=true`, `study_goal_policy_count=4`, and `study_todos_goal_fk_exists=true`.

#### Remaining Work

- Commit, push, and verify Vercel production deployment.

#### Next Priority

- Production smoke-test goal creation and todo linking with a logged-in account.

### 2026-06-18 - Recovery prompt loop clarification

#### Completed Work

- Investigated why the app kept asking for a recovery routine after the user submitted one.
- Confirmed the submitted 2026-06-18 request was correctly marked `submitted` in Supabase.
- Confirmed an older 2026-06-17 `missed_attendance` recovery request for the same user remained `pending`, which continued to block study start.
- Changed automatic in-app recovery modal opening to use only blocking recovery requests.
- Added recovery modal date, request type, queue position, and remaining request count.
- Updated submit handling to mark the submitted request locally before dashboard reload and show the next remaining blocking request explicitly.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/test/recoveryRoutine.test.mjs`
- `memory-bank/prd-slack-recovery-routines.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- Supabase SQL query for recent `study_recovery_requests`.
- `node --test apps\web\test\recoveryRoutine.test.mjs`
- `npm.cmd test` passed 137 tests.
- `npm.cmd run build` passed.

#### Remaining Work

- Commit, push, and verify Vercel production deployment.

#### Next Priority

- In production, submit the remaining older recovery request or confirm the modal no longer appears once no blocking pending requests remain.
### 2026-06-18 - In-app recovery routine submission

#### Completed Work

- Added an in-app recovery routine modal for pending `study_recovery_requests`.
- The modal auto-opens after login when pending recovery exists and can also be opened manually from recovery blocker cards.
- Added authenticated Supabase RPC `submit_study_recovery_request` so the logged-in user can submit reason, makeup todo, and pledge directly from the web app.
- The RPC creates today's makeup todo and tomorrow's pledge todo, then marks the recovery request submitted.
- Updated Slack recovery PRD and implementation notes so Slack and app modal are both valid submission paths.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/test/recoveryRoutine.test.mjs`
- `supabase/migrations/20260618121536_in_app_recovery_submission.sql`
- `supabase/migrations/20260618123154_revoke_anon_recovery_submission.sql`
- `docs/superpowers/plans/2026-06-18-in-app-recovery-routine.md`
- `memory-bank/prd-slack-recovery-routines.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`

#### Verification

- RED: `node --test apps\web\test\slackNotifications.test.mjs` failed before the modal/RPC source markers existed.
- GREEN: `node --test apps\web\test\slackNotifications.test.mjs` passed after the first implementation.
- `node --test apps\web\test\recoveryRoutine.test.mjs` passed.
- `node --test apps\web\test\slackNotifications.test.mjs` passed.
- `npm.cmd test` passed 136 tests.
- `npm.cmd run build` passed.
- Supabase MCP migration list confirmed `20260618122857 in_app_recovery_submission` and `20260618123154 revoke_anon_recovery_submission`.
- Supabase SQL confirmed `submit_study_recovery_request` has `authenticated_can_execute=true`, `anon_can_execute=false`, uses `auth.uid()`, and locks the pending request.
- Anonymous PostgREST RPC call returned HTTP 401 with `permission denied for function submit_study_recovery_request`.
- Committed and pushed `1230076056739485f5acdc4ddf889726736706df` to `origin/main`.
- GitHub Actions run `27760013203` completed successfully for the Vercel production workflow.
- Vercel production deployment `dpl_5wQdvFgqWzAbaJa1UTEEN5iKoFWC` is `READY` for commit `1230076056739485f5acdc4ddf889726736706df`.
- `https://study-room-attendance.vercel.app/` returned HTTP 200 and served `/assets/index-a8DUvK7H.js`.
- Production JS contains `submit_study_recovery_request`, `recovery-modal`, `recoveryReason`, `makeupTodoTitle`, and `pledgeTodoTitle`.
- Vercel production runtime error-log query returned no `error` or `fatal` logs in the checked 30-minute window.

#### Remaining Work

- Manual browser check with a real pending recovery request can confirm the modal opens automatically after login.

#### Next Priority

- If Slack interactivity still fails, use the in-app modal to unblock study and then inspect Slack signing-secret configuration separately.
### 2026-06-16 - Weekday/weekend attendance goals and late study recovery

#### Completed Work

- Added a date-based attendance policy: weekdays require 2 hours of completed study, weekends require 4 hours.
- Set weekday reminders to use the saved profile reminder time with a `20:30` default, and weekend reminders to use fixed `14:00`.
- Added Supabase helper functions for daily study goal seconds, effective reminder time, completed study totals, and late-study attendance promotion.
- Updated `get_due_reminders()` and `mark_missed_attendance()` to suppress reminders or missed marking when the daily study goal is already complete.
- Updated `end_study_session()` so ending a session that reaches the daily goal promotes the day to `present`, even after an earlier `missed` status.
- Adjusted `start_study_session()` and the web UI so same-day `missed_attendance` recovery does not block late recovery study, while camera-repeat and old recovery requests still block.
- Updated Slack/Web Push/Email reminder bodies to mention the daily study-goal recovery path.
- Updated web and mobile UI copy to show weekday/weekend reminder and goal rules.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/attendancePolicy.mjs`
- `apps/web/src/attendancePolicy.mjs.d.ts`
- `apps/web/test/attendancePolicy.test.mjs`
- `apps/web/test/slackNotifications.test.mjs`
- `apps/mobile/App.tsx`
- `packages/core/src/index.mjs`
- `packages/core/test/attendance.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/functions/attendance-cron/index.ts`
- `supabase/migrations/0021_late_study_goal_attendance_policy.sql`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-supabase-cron.md`
- `memory-bank/prd-user-profile.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- RED: new attendance policy tests failed before `attendancePolicy.mjs` and migration `0021_late_study_goal_attendance_policy.sql` existed.
- GREEN: `npm.cmd test` passed 127 tests.
- `npm.cmd run build` passed.
- Supabase MCP migration list confirmed remote migration `20260615161759 late_study_goal_attendance_policy`.
- Supabase Edge Function list confirmed `attendance-cron` version 18 is `ACTIVE` with `verify_jwt=false`.
- Committed and pushed `ac8d6ff4d822664faa4d9664679b8858a56a2188` to `origin/main`.
- GitHub Actions run `27560595135` completed successfully for the Vercel production workflow.
- `https://study-room-attendance.vercel.app/` returned HTTP 200 and served the post-deploy asset `index-CcuqWrmS.js`.

#### Remaining Work

- Production smoke-test a weekday and weekend policy scenario with a logged-in account if manual verification is needed.

#### Next Priority

- Production smoke-test a weekday and weekend policy scenario with a logged-in account if manual verification is needed.

### 2026-06-16 - Editable scheduled recurring todos

#### Completed Work

- Added repeat metadata columns to `study_todos`: `repeat_group_id`, `repeat_mode`, `repeat_weekdays`, and `repeat_until`.
- Added constraints and an index so weekly recurring todos are grouped and single todos remain clean default rows.
- Added explicit Supabase Data API grants for authenticated access to `study_todos`.
- Added todo recurrence helpers for weekday normalization, weekly metadata detection, and repeat label formatting.
- Added edit support in the calendar todo modal: existing todos now prefill title, optional time, repeat mode, weekdays, and repeat end date.
- Added group update behavior for recurring todos: save updates existing dates, inserts newly selected dates, and deletes removed dates in the same repeat group.
- Added compact metadata chips plus edit/delete controls to todo list rows.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/todoRecurrence.mjs`
- `apps/web/src/todoRecurrence.d.mts`
- `apps/web/test/todoRecurrence.test.mjs`
- `apps/web/test/slackNotifications.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/migrations/0020_study_todo_repeat_metadata.sql`
- `docs/superpowers/plans/2026-06-16-editable-recurring-todos.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-recurring-todos.md`

#### Verification

- RED: targeted todo recurrence, SQL migration, and web source tests failed before the helper/schema/UI implementation existed.
- GREEN: `node --test packages\core\test\sql-migrations.test.mjs`, `node --test apps\web\test\todoRecurrence.test.mjs apps\web\test\slackNotifications.test.mjs` passed after implementation.
- `npm.cmd test` passed 119 tests.
- `npm.cmd run build` passed.
- Supabase MCP migration list confirmed remote migration `20260615152037 study_todo_repeat_metadata` is applied to project `bqohkdzvxbrokkmuhysx`.
- Committed and pushed `3d763c39564a7985052783cd72e2c905d6208d79` to `origin/main`.
- Vercel production deployment `dpl_36noV75oS5vakytBrPCiFHWfsdyL` is `READY` for commit `3d763c39564a7985052783cd72e2c905d6208d79`.
- `https://study-room-attendance.vercel.app/` returned HTTP 200.
- Vercel production runtime error-log query for deployment `dpl_36noV75oS5vakytBrPCiFHWfsdyL` returned no `error` or `fatal` logs in the checked 30-minute window.

#### Remaining Work

- Verify in production with a real logged-in account that editing a scheduled weekly todo closes the modal and updates all generated dates.

#### Next Priority

- Verify in production with a real logged-in account that editing a scheduled weekly todo closes the modal and updates all generated dates.

### 2026-06-15 - Slack recovery routine enforcement

#### Completed Work

- Added a recovery routine data model for missed attendance and repeated camera absence.
- Added server-side blocking so `start_study_session()` rejects new sessions while a pending recovery request exists.
- Added Slack recovery button messages and Slack modal submission handling.
- Added automatic creation of today's makeup todo and tomorrow's pledge todo when the Slack modal is submitted.
- Added missed-attendance recovery creation from `attendance-cron`.
- Added repeated camera absence recovery creation when the second same-day `absence_warning` is recorded.
- Added 30-minute one-time pending recovery follow-up messages.
- Added a web Today Focus blocker that disables `입장하고 시작` until the pending recovery is submitted.
- Added regression coverage for SQL, Slack interactivity source behavior, trigger paths, and web blocking UI.

#### Changed Files

- `supabase/migrations/0019_study_recovery_requests.sql`
- `supabase/functions/_shared/recovery.ts`
- `supabase/functions/attendance-cron/index.ts`
- `supabase/functions/camera-presence-warning/index.ts`
- `supabase/functions/slack-recovery-interactions/index.ts`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `packages/core/test/sql-migrations.test.mjs`
- `apps/web/test/slackNotifications.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-slack-notifications.md`
- `memory-bank/prd-slack-recovery-routines.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- RED: targeted tests first failed because recovery schema and UI/function hooks did not exist.
- GREEN: targeted migration and Slack notification tests passed after implementation.
- `npm.cmd test` passed 115 tests.
- `npm.cmd run build` passed.
- `git diff --check` passed with only existing LF-to-CRLF warnings.
- Supabase migration `study_recovery_requests` was applied to project `bqohkdzvxbrokkmuhysx`.
- Supabase Edge Function list confirmed `slack-recovery-interactions` v1 and `attendance-cron` v17 ACTIVE with `verify_jwt=false`.
- Supabase Edge Function list confirmed `camera-presence-warning` remains ACTIVE at v6; the local recovery-trigger update is not deployed yet because the per-function no-JWT deploy command needs explicit user approval.
- Committed and pushed `6cf4cad084bdd6d6a2d23380d3e5ad9f425fd119` to `origin/main`.
- Vercel production deployment `dpl_2P8wuQNyPh9qgEov37rAkvzzqctZ` is `READY` for commit `6cf4cad084bdd6d6a2d23380d3e5ad9f425fd119`.
- `https://study-room-attendance.vercel.app/` returned HTTP 200.
- Vercel production runtime error-log query for deployment `dpl_2P8wuQNyPh9qgEov37rAkvzzqctZ` returned no `error` or `fatal` logs in the checked one-hour window.
- Supabase secrets list confirmed `STUDY_ALERT_SLACK_BOT_TOKEN` exists, but `SLACK_SIGNING_SECRET` is not configured yet.

#### Remaining Work

- Redeploy `camera-presence-warning` after explicit approval for the documented `verify_jwt=false` setting.
- Add `SLACK_SIGNING_SECRET` before testing Slack recovery modal submissions.
- Configure Slack App Interactivity Request URL if not already configured.

#### Next Priority

- Validate the real Slack modal flow from a recovery button click after Supabase function deployment.

### 2026-06-15 - Readable Slack alarm messages

#### Completed Work

- Added readable Slack message sections for scheduled reminders, Slack test alarms, and camera warnings.
- Scheduled reminders now show an emoji title, attendance deadline, today's todos, immediate action, and app link.
- Slack test alarms now show the test purpose, date, today's todos, setup confirmation, and app link.
- Camera warnings now distinguish camera-off and absence-warning states with status and next-action sections.
- Kept the existing Slack Bot API, target lookup, secret names, and delivery recording behavior unchanged.

#### Changed Files

- `supabase/functions/attendance-cron/index.ts`
- `supabase/functions/slack-test-alarm/index.ts`
- `supabase/functions/camera-presence-warning/index.ts`
- `.gitignore`
- `packages/core/test/sql-migrations.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-slack-notifications.md`

#### Verification

- RED: `node --test packages\core\test\sql-migrations.test.mjs` failed because the Edge Functions did not yet contain the new Slack message sections.
- GREEN: `node --test packages\core\test\sql-migrations.test.mjs` passed after the Slack message update.
- `npm.cmd test` passed 110 tests.
- `npm.cmd run build` passed.
- `git diff --check` passed.
- Supabase Edge Function list confirmed `attendance-cron` v16, `slack-test-alarm` v5, and `camera-presence-warning` v6 ACTIVE with `verify_jwt=false`.
- Supabase SQL `net.http_post` invoked `slack-test-alarm` with direct channel `C0BAFS1CSV8`; response id `10977` returned HTTP 200, `ok=true`, and Slack `messageTs=1781477126.922689`.
- Committed and pushed `47387bcfceabbf560f01fd8a63053cae036b062b` to `origin/main`.
- Vercel production deployment `dpl_FnM3zWh3Js9mt68NagH6esCE5z4z` is `READY` for commit `47387bcfceabbf560f01fd8a63053cae036b062b`.
- `https://study-room-attendance.vercel.app/` returned HTTP 200.
- Vercel production runtime error-log query for deployment `dpl_FnM3zWh3Js9mt68NagH6esCE5z4z` returned no `error` or `fatal` logs in the checked one-hour window.

#### Remaining Work

- None for the Slack readability change.

#### Next Priority

- Send a Slack test alarm after deployment to confirm the message is readable in the real channel.

### 2026-06-15 - Editable saved alarm settings UI

#### Completed Work

- Added a settings-screen `설정된 알람` card that shows the current daily reminder time, email fallback state, computer notification state, and Slack state.
- Added an `알람 편집` mode with time input, email fallback checkbox, `알람 저장`, and `취소`.
- Split simple alarm profile editing from the existing computer notification registration action so editing the time does not trigger browser push permission prompts.
- Moved Slack Channel ID save, computer notification registration, and Slack test alarm into a separate `알림 수단` card.
- Added a focused regression test for the editable alarm card wiring.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/test/alarmSettings.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`

#### Verification

- RED: `npm.cmd test -- apps/web/test/alarmSettings.test.mjs` failed because the app did not expose `alarmEditing`, `saveAlarmSettings`, or the editable alarm card.
- GREEN: `npm.cmd test -- apps/web/test/alarmSettings.test.mjs` passed after implementation.
- `npm.cmd test` passed 108 tests.
- `npm.cmd run build` passed.
- Local HTTP check: `http://127.0.0.1:5177/` returned `HTTP 200`.
- Playwright navigation to `http://127.0.0.1:5177/#settings` loaded the app; settings UI was not reachable in that browser context because it was logged out. The only console error observed was the existing `favicon.ico` 404.
- Committed and pushed `ba79f122c5519853bb28449b62599ab06c1e4686`.
- GitHub Actions run `27504823847` completed successfully.
- Vercel deployment `dpl_AN5vRFoQQb74EqgWmuLKT9XgkJ2d` is `READY` for production.
- `https://study-room-attendance.vercel.app` returned `HTTP 200` and served `index-CO0CemFs.js` / `index-p2a7-PoR.css`.
- Production JS asset contains the new `설정된 알람`, `알람 편집`, and `알람 저장` UI strings.
- Vercel production runtime error-log query for deployment `dpl_AN5vRFoQQb74EqgWmuLKT9XgkJ2d` returned no `error` or `fatal` logs in the checked one-hour window.

#### Remaining Work

- Verify the production settings screen with the user's logged-in account.

#### Next Priority

- Log in on production and confirm the saved alarm card enters edit mode, saves the new time, and returns to read mode.

### 2026-06-15 - Camera status diagnosis UI

#### Completed Work

- Added a client-only camera diagnostic helper that maps browser support, permission, stream, frame, absence, loading, paused, and healthy states to a clear title, detail, and checklist.
- Wired the Today Focus camera card to track the latest camera diagnostic reason from `getCameraSupport`, `getCameraStreamHealth`, `getCameraFrameHealth`, permission errors, and upper-body absence timing.
- Rendered a compact camera diagnosis strip inside the existing camera monitor card without adding a separate modal or server-side media flow.
- Added regression tests for diagnostic copy/state mapping and UI wiring.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/cameraDiagnostics.mjs`
- `apps/web/src/cameraDiagnostics.d.mts`
- `apps/web/test/cameraDiagnostics.test.mjs`
- `apps/web/test/cameraPresence.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-camera-presence.md`

#### Verification

- RED: `node --test apps\web\test\cameraDiagnostics.test.mjs` failed because `cameraDiagnostics.mjs` did not exist.
- RED: `node --test apps\web\test\cameraPresence.test.mjs` failed because `main.tsx` did not import `getCameraDiagnostic` or render `.camera-diagnostic`.
- GREEN: `node --test apps\web\test\cameraDiagnostics.test.mjs` passed.
- GREEN: `node --test apps\web\test\cameraPresence.test.mjs` passed.
- `npm.cmd test` passed 107 tests.
- `npm.cmd run build` passed.
- Local HTTP check: `http://127.0.0.1:5177/` returned `HTTP 200`.
- Browser screenshot verification was not available because the in-app Browser MCP target page/context was closed.
- Committed and pushed `6ea6911511ab4a41dea1aa93e43976a4ae356108`.
- GitHub Actions run `27504384773` completed successfully.
- Vercel deployment `dpl_3bUuQKGfXrxGLNhCobnYUxELFVjZ` is `READY` for production.
- `https://study-room-attendance.vercel.app` returned `HTTP 200` and served the latest `index-x8Eql_J7.js` / `index-ChfxTS4e.css` assets.
- Vercel production runtime error-log query for deployment `dpl_3bUuQKGfXrxGLNhCobnYUxELFVjZ` returned no `error` or `fatal` logs in the checked one-hour window.

#### Remaining Work

- Verify the production camera diagnostic strip with the user's actual browser/camera permission state.

#### Next Priority

- Verify the production camera diagnostic strip with the user's actual browser and camera permission state.

### 2026-06-15 - Today Focus camera UI simplification

#### Completed Work

- Removed the duplicate Today Focus timer from the camera-focused section so today's study time is shown through the top summary card only.
- Removed the duplicate normal camera status detail message while preserving guidance messages for starting, warning, and error states.
- Enlarged the camera preview and let the camera monitor card use the available content width.
- Added a regression test that prevents `daily-visual` from rendering `todaySeconds`, `activeElapsedSeconds`, or duplicated camera status copy.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/test/cameraPresence.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-camera-presence.md`

#### Verification

- RED: `node --test apps\web\test\cameraPresence.test.mjs` failed because the Today Focus section still rendered `formatTimerClock(todaySeconds)` and `formatTimerClock(activeElapsedSeconds)`.
- GREEN: `node --test apps\web\test\cameraPresence.test.mjs` passed after the UI change.
- `npm.cmd test` passed 103 tests.
- `npm.cmd run build` passed.
- `git diff --check` passed.
- Committed and pushed `d033a4a0e02a83c83883114ea1ac134bd3ffb4b3`.
- GitHub Actions run `27503647487` completed successfully.
- Vercel deployment `dpl_A2JSVSmAHuVcpyEjtiK94ndfJ3U4` is `READY`.
- `https://study-room-attendance.vercel.app` returned `HTTP 200`.
- Vercel runtime logs for the deployment had no `error` or `fatal` entries in the checked window.

#### Remaining Work

- Verify the production camera card with an actual logged-in camera session on the user's browser.

#### Next Priority

- Verify the production camera card with an actual logged-in camera session and decide whether to add a user-facing camera health checklist for permission/device conflicts.

### 2026-06-15 - Camera stalled frame recovery

#### Completed Work

- Investigated the screenshot where camera monitoring showed `준비 중` and `카메라 영상을 불러오는 중입니다` while the timer kept running.
- Found that `no-current-frame` and `no-video-size` were treated as indefinite loading states.
- Added a camera frame recovery state machine for transient video frame loading failures.
- Added one automatic camera reconnect after 15 seconds of missing current frame/video size.
- Added a safe failure path after one reconnect attempt so the user can manually turn camera monitoring on again.
- Kept the camera toggle usable when an already-enabled camera falls back to `준비 중`.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/cameraFrameRecovery.mjs`
- `apps/web/src/cameraFrameRecovery.d.mts`
- `apps/web/test/cameraFrameRecovery.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-camera-presence.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- RED: `node --test apps\web\test\cameraFrameRecovery.test.mjs` failed because `cameraFrameRecovery.mjs` did not exist.
- GREEN: `node --test apps\web\test\cameraFrameRecovery.test.mjs` passed.
- `node --test apps\web\test\cameraFrameRecovery.test.mjs apps\web\test\cameraVideoHealth.test.mjs apps\web\test\cameraPresence.test.mjs apps\web\test\cameraResume.test.mjs` passed.
- `npm.cmd test` passed 102 tests.
- `npm.cmd run build` passed.
- `git diff --check` passed.
- Committed and pushed `6fa480a477a9bfc7217bd113f932ed58952515ea`.
- GitHub Actions run `27503047022` completed successfully.
- Vercel deployment `dpl_6hrGHJAkV4zkGfkma9sCuQCanaEo` is `READY`.
- `https://study-room-attendance.vercel.app` returned `HTTP 200`.

#### Remaining Work

- Test camera monitoring on the production page with the actual browser/camera device.

#### Next Priority

- After deployment, test camera monitoring on the production page. If the device still stalls, check browser camera permission, privacy shutter, and whether another app is holding the camera.

### 2026-06-14 - Slack setup UX, Kakao removal, refresh-safe timer, and camera resume

#### Completed Work

- Added a dedicated Slack Channel ID save action so the logged-in user can create/update their own `notification_targets.kind = 'slack'` row before sending a Slack test alarm.
- Removed Kakao OAuth/link UI helpers and removed Kakao Memo sending from the active `attendance-cron` path.
- Added migration `0018_disable_kakao_notifications.sql` to disable legacy enabled Kakao notification targets/connections while preserving historical rows and old delivery records.
- Changed page lifecycle session policy so `visibilitychange`, `pagehide`, and `beforeunload` no longer end active study sessions. This preserves running study time across refresh/reload.
- Added camera monitoring intent persistence and one-shot camera auto-restore for the same active session after refresh.
- Applied Supabase migration `disable_kakao_notifications` to project `bqohkdzvxbrokkmuhysx`.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/sessionExit.mjs`
- `apps/web/src/cameraResume.mjs`
- `apps/web/src/cameraResume.d.mts`
- `apps/web/src/authProviders.mjs`
- `apps/web/src/authProviders.d.mts`
- `apps/web/test/cameraResume.test.mjs`
- `apps/web/test/sessionExit.test.mjs`
- `apps/web/test/slackNotifications.test.mjs`
- `apps/web/test/authProviders.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/functions/attendance-cron/index.ts`
- `supabase/migrations/0018_disable_kakao_notifications.sql`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-slack-notifications.md`
- `memory-bank/prd-camera-presence.md`
- `memory-bank/prd-kakao-notifications.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- RED: `node --test apps\web\test\slackNotifications.test.mjs` failed before implementation because the app had no clear Slack save action and still referenced Kakao.
- RED: `node --test apps\web\test\sessionExit.test.mjs` failed before implementation because `pagehide` and `beforeunload` still ended the session.
- RED: `node --test apps\web\test\cameraResume.test.mjs` failed before implementation because `cameraResume.mjs` did not exist.
- RED: `node --test packages\core\test\sql-migrations.test.mjs` failed before implementation because `attendance-cron` still contained the Kakao path and migration `0018_disable_kakao_notifications.sql` did not exist.
- GREEN: targeted tests passed after implementation.
- `npm.cmd test` passed 98 tests.
- `npm.cmd run build` passed.
- Supabase migration list confirmed `disable_kakao_notifications`.
- Supabase Edge Function deploy confirmed `attendance-cron` version 15 ACTIVE.
- Supabase Management API deleted legacy `kakao-token` and `telegram-test-alarm` Edge Functions.
- Supabase Edge Function list confirmed only `attendance-cron`, `camera-presence-warning`, and `slack-test-alarm` remain ACTIVE.
- Pushed the app changes to `origin/main`.
- GitHub Actions production workflow succeeded.
- Vercel production deployment is READY.
- `https://study-room-attendance.vercel.app` returned HTTP 200.
- Vercel production runtime error-log query returned no matching errors.

#### Remaining Work

- None for this change.

#### Next Priority

- After deployment, save Slack Channel ID from the app settings for the logged-in user, then run the in-app Slack test alarm.

### 2026-06-14 - Camera black preview false absence fixed

#### Completed Work

- Investigated the screenshot where the timer kept running, camera preview was black, and the app reported upper body absence.
- Added camera video health checks before PoseLandmarker absence detection.
- Treat missing, ended, muted, disabled, not-yet-ready, zero-size, or nearly black camera frames as camera errors instead of user absence.
- Reset absence timing when the camera feed is unhealthy so false black-frame absence does not continue to auto-pause the timer.
- Relaxed upper-body detection for cropped webcam views: head plus one shoulder and same-side hip now counts as seated presence.
- Clarified Slack missing-target text so it says the current account has no saved Slack Channel ID.
- Confirmed remote Supabase Edge Functions `attendance-cron`, `camera-presence-warning`, and `slack-test-alarm` are ACTIVE.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/bodyPresenceDetection.mjs`
- `apps/web/src/cameraVideoHealth.mjs`
- `apps/web/src/cameraVideoHealth.d.mts`
- `apps/web/test/cameraVideoHealth.test.mjs`
- `apps/web/test/cameraPresence.test.mjs`
- `apps/web/test/upperBodyPresence.test.mjs`
- `apps/web/test/slackNotifications.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-camera-presence.md`
- `memory-bank/prd-slack-notifications.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- RED: `node --test apps\web\test\cameraVideoHealth.test.mjs` failed because `cameraVideoHealth.mjs` did not exist.
- RED: `node --test apps\web\test\cameraPresence.test.mjs` failed because the app was not wired to camera video health helpers.
- RED: `node --test apps\web\test\upperBodyPresence.test.mjs` failed because head + one shoulder + hip was not accepted.
- RED: `node --test apps\web\test\slackNotifications.test.mjs` failed because the app did not explain missing per-account Slack target.
- GREEN: all targeted tests passed.
- `npm.cmd test` passed 92 tests.
- `npm.cmd run build` passed.
- Supabase MCP `_list_edge_functions` confirmed Slack/camera functions ACTIVE.
- Pushed commit `52dd9cd` to `origin/main`.
- GitHub Actions run `27501945457` succeeded.
- Vercel production deployment `dpl_C1TQMz28PMtYnYRuftEPnx9WDc67` is `READY`.
- `curl.exe -I https://study-room-attendance.vercel.app` returned HTTP 200.
- Vercel production runtime error log query for deployment `dpl_C1TQMz28PMtYnYRuftEPnx9WDc67` returned no logs.

#### Remaining Work

- The user still needs a saved Slack Channel ID target for the logged-in account to receive Slack camera warnings.

#### Next Priority

- After deployment, restart camera monitoring in the production app. If the preview remains black, check browser camera permission, privacy shutter, and whether another app is using the camera.

### 2026-06-14 - App-local AGENTS memory-bank rules added

#### Completed Work

- Confirmed the previous AGENTS update had been applied to the parent workspace `C:\jini-dev\project\AGENTS.md`, not the app repository's `C:\jini-dev\project\study-room-attendance\AGENTS.md`.
- Restored the parent workspace `AGENTS.md` to generic workspace rules.
- Expanded the app-local `AGENTS.md` from the minimal Spec Kit block into full study-room workflow rules.
- Added app-local Memory Bank, Supabase, validation, Vercel production deployment, Git, Spec Kit, and final response rules.
- Preserved the Spec Kit marker block in the app-local `AGENTS.md`.

#### Changed Files

- `AGENTS.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/trouble-shooting.md`
- `..\AGENTS.md`

#### Verification

- `Get-Content -Encoding UTF8 -LiteralPath C:\jini-dev\project\AGENTS.md`
- `Get-Content -Encoding UTF8 -LiteralPath C:\jini-dev\project\study-room-attendance\AGENTS.md`
- `Select-String` checks for `memory-bank/ko`, `memory-bank/ja`, `/ko`, `/ja`

#### Remaining Work

- None for this documentation update.

#### Next Priority

- Future work inside the app repo should use `C:\jini-dev\project\study-room-attendance` as the working directory and read the app-local `AGENTS.md` plus app-local `memory-bank` documents.

### 2026-06-14 - Overnight scheduled todo save fixed

#### Completed Work

- Investigated why the todo modal did not close and the todo appeared not to save for a schedule like `23:00` to `01:00`.
- Found the frontend rejected `end_time < start_time`, and the remote Supabase `study_todos_time_window_check` constraint also required `start_time < end_time`.
- Changed the frontend rule so `end_time < start_time` is treated as an overnight schedule and only equal start/end times are rejected.
- Added Supabase migration `0017_allow_overnight_study_todo_times.sql` to allow same-day and overnight schedules while rejecting zero-length schedules.
- Applied remote Supabase migration `allow_overnight_study_todo_times`; the live constraint now checks `start_time <> end_time`.

#### Changed Files

- `apps/web/src/todoSchedule.mjs`
- `apps/web/test/todoSchedule.test.mjs`
- `supabase/migrations/0017_allow_overnight_study_todo_times.sql`
- `packages/core/test/sql-migrations.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-recurring-todos.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- `node --test apps\web\test\todoSchedule.test.mjs`
- `node --test packages\core\test\sql-migrations.test.mjs`
- Supabase MCP constraint query confirmed `start_time <> end_time`
- `npm.cmd test`
- `npm.cmd run build`
- `git diff --check`
- GitHub Actions run `27501233411`: success
- Vercel deployment `dpl_AKeaHsZ1kgMz3DvkN8TRdbd9Ny9p`: READY
- `curl -I https://study-room-attendance.vercel.app`: HTTP 200
- Vercel production runtime logs, level error, since 1h: no logs found

#### Remaining Work

- None for this fix.

#### Next Priority

- If the modal still stays open, capture the browser console error and Supabase insert response for the exact logged-in user.

### 2026-06-14 - Scheduled recurring todo save display fixed

#### Completed Work

- Investigated why todos with weekday selection and time settings appeared not to save.
- Confirmed remote Supabase `study_todos` already has `start_time` and `end_time`, so the issue was not a missing database column.
- Fixed todo schedule formatting so Supabase `time` values like `09:00:00` render as `09:00`.
- Added save-focus behavior so if weekday repeat creates rows on dates other than the currently open date, the calendar moves to the first created date instead of leaving the visible list empty.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/todoRecurrence.mjs`
- `apps/web/src/todoRecurrence.d.mts`
- `apps/web/src/todoSchedule.mjs`
- `apps/web/test/todoRecurrence.test.mjs`
- `apps/web/test/todoSchedule.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- `node --test apps\web\test\todoRecurrence.test.mjs apps\web\test\todoSchedule.test.mjs`
- `npm.cmd test`
- `npm.cmd run build`
- `git diff --check`
- GitHub Actions run `27500758093`: success
- Vercel deployment `dpl_2x21QLKb9TNXp4NGS8W2j5bybzwN`: READY
- `curl -I https://study-room-attendance.vercel.app`: HTTP 200
- Vercel production runtime logs, level error, since 1h: no logs found

#### Remaining Work

- None for this fix.

#### Next Priority

- If the issue reproduces, capture the exact selected calendar date, selected weekdays, repeat end date, start time, and end time.

### 2026-06-14 - Vercel production deployment completed

#### Completed Work

- Pushed CI timezone fix commit `9e5b8d3` to `origin/main`.
- Confirmed GitHub Actions run `27500448036` completed successfully.
- Confirmed Vercel production deployment `dpl_AE995CdmFTzXne3qAdGV1fnBRfMz` is `READY`.
- Confirmed `https://study-room-attendance.vercel.app` returns HTTP 200.
- Confirmed Vercel production error log query for the last hour returned no matching error logs.

#### Changed Files

- `memory-bank/active-context.md`
- `memory-bank/progress.md`

#### Verification

- GitHub Actions run `27500448036`: success
- Vercel deployment `dpl_AE995CdmFTzXne3qAdGV1fnBRfMz`: READY
- `curl -I https://study-room-attendance.vercel.app`: HTTP 200
- Vercel production runtime logs, level error, since 1h: no logs found

#### Remaining Work

- Local direct Vercel CLI deploy still requires `VERCEL_TOKEN` or `vercel login`; current deploy path is GitHub Actions through `main` pushes.

#### Next Priority

- Treat Vercel production verification as the final step for future user-visible app changes.

### 2026-06-14 - Vercel deployment pipeline timezone fix

#### Completed Work

- Pushed commit `309481c` to `origin/main` to trigger the Vercel production GitHub Actions workflow.
- Confirmed workflow run `27500348234` failed in the `Run tests` step before deployment.
- Identified the CI-only failure as a timezone-dependent `reminderPopup` test.
- Fixed `apps/web/test/reminderPopup.test.mjs` to pass `timeZone: "Asia/Tokyo"` explicitly, matching the app's runtime call path.

#### Changed Files

- `apps/web/test/reminderPopup.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- `TZ=UTC node --test apps\web\test\reminderPopup.test.mjs`
- `npm.cmd test`
- `npm.cmd run build`

#### Remaining Work

- Push the timezone fix and confirm the next Vercel production workflow run succeeds.

#### Next Priority

- Verify the resulting Vercel deployment is `READY` and mapped to `https://study-room-attendance.vercel.app`.

### 2026-06-14 - Optional todo time and weekly recurrence verified

#### Completed Work

- Verified the todo creation modal supports optional start/end time entry.
- Verified the todo creation modal supports optional weekly repeat mode, repeat end date, and weekday selection.
- Confirmed repeated todos are materialized into `study_todos` rows for the selected dates.
- Confirmed duplicate prevention uses local date, normalized title, and optional time range, so the same title can be scheduled separately at different times.
- Confirmed `study_todos.start_time` and `study_todos.end_time` are covered by the time-window migration.

#### Changed Files

- `memory-bank/active-context.md`
- `memory-bank/progress.md`

#### Verification

- `node --test apps\web\test\todoRecurrence.test.mjs apps\web\test\todoSchedule.test.mjs`
- `npm.cmd test`
- `npm.cmd run build`
- `git diff --check`

#### Remaining Work

- Production users will see this UI only after the current web app changes are deployed.
- A future version can store reusable recurrence rules if the app needs indefinite weekly schedules instead of materialized date rows.

#### Next Priority

- Deploy the current web build when the user wants the Vercel production URL updated.

### 2026-06-14 - Slack direct channel test succeeded

#### Completed Work

- Confirmed remote Supabase Edge Functions are active:
  - `slack-test-alarm` v4 ACTIVE
  - `attendance-cron` v14 ACTIVE
  - `camera-presence-warning` v5 ACTIVE
- Invoked `slack-test-alarm` through Supabase `net.http_post` with the cron secret from Vault and direct channel `C0BAFS1CSV8`.
- Verified response id `10391` returned HTTP 200 with Slack `ok=true`.
- The function returned `localDate=2026-06-14`, `todoCount=0`, and Slack `messageTs=1781442017.534459`.

#### Changed Files

- `memory-bank/active-context.md`
- `memory-bank/progress.md`

#### Verification

- Supabase MCP `_list_edge_functions`
- Supabase SQL `net.http_post` to `/functions/v1/slack-test-alarm`
- Supabase SQL read of `net._http_response where id = 10391`

#### Remaining Work

- The direct channel test proves the Slack bot token, channel ID, bot membership, and Edge Function path.
- Scheduled reminders still require the logged-in user's app settings to save a user-scoped `notification_targets.kind = 'slack'` row.

#### Next Priority

- In the web app settings, save Slack Channel ID `C0BAFS1CSV8` and use the in-app Slack test button to verify the user-scoped target path.

### 2026-06-14 - Supabase auth session persists after refresh

#### Completed Work

- Confirmed the refresh-login bug was caused by the Supabase browser client setting `persistSession: false`.
- Added `authSession.mjs` to centralize Supabase Auth session options.
- Enabled `persistSession: true` and `autoRefreshToken: true` while keeping `detectSessionInUrl: false` for the app's manual OAuth callback flow.
- Added an initial session-loading state so the login form is not shown before `supabase.auth.getSession()` finishes restoring a stored session.
- Added regression tests for session persistence options.

#### Changed Files

- `apps/web/src/authSession.mjs`
- `apps/web/src/authSession.d.mts`
- `apps/web/src/supabase.ts`
- `apps/web/src/main.tsx`
- `apps/web/test/authSession.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-user-profile.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- RED: `node --test apps\web\test\authSession.test.mjs` failed because `authSession.mjs` did not exist.
- GREEN: `node --test apps\web\test\authSession.test.mjs` passed.
- `npm.cmd test` passed 80 tests.
- `npm.cmd run build` passed.

#### Remaining Work

- Production Vercel still needs redeployment before the deployed URL keeps sessions across refreshes.
- Strict session lifetime or inactivity timeout should be configured in Supabase Auth session settings if required.

#### Next Priority

- Deploy the web app when the user wants production updated, then verify refresh keeps the user on the dashboard.

### 2026-06-14 - Tab switching no longer ends study session

#### Completed Work

- Confirmed the active-session bug was caused by treating `visibilitychange: hidden` as a page-exit event.
- Added a `shouldEndStudySessionForPageEvent()` helper so exit-event decisions are tested outside React.
- Updated the dashboard to send the keepalive `end_study_session` request only for `pagehide` and `beforeunload`.
- Kept tab switching as valid study time; camera monitoring is no longer intentionally stopped by a tab switch.
- Added regression coverage that proves `visibilitychange` does not end the study session while `pagehide` and `beforeunload` still do.

#### Changed Files

- `apps/web/src/main.tsx`
- `apps/web/src/sessionExit.mjs`
- `apps/web/src/sessionExit.d.mts`
- `apps/web/test/sessionExit.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`
- `memory-bank/prd-camera-presence.md`
- `memory-bank/implementation-plan.md`

#### Verification

- RED: `node --test apps\web\test\sessionExit.test.mjs` failed before implementation because `shouldEndStudySessionForPageEvent` was not exported.
- GREEN: `node --test apps\web\test\sessionExit.test.mjs` passed.
- `npm.cmd test` passed 78 tests.
- `npm.cmd run build` passed.

#### Remaining Work

- The production Vercel app still needs a deployment if this local change should be reflected on `https://study-room-attendance.vercel.app`.

#### Next Priority

- Deploy the web app when the user asks for production update, then verify the production bundle contains the new session-exit behavior.

### 2026-06-14 - Slack token alias and direct channel test

#### Completed Work

- Added Slack bot token fallback support for `STUDY_ALERT_SLACK_BOT_TOKEN` while preserving `SLACK_BOT_TOKEN`.
- Updated `slack-test-alarm` so cron-secret protected calls can send a direct test message to a provided `channelId`.
- Redeployed Supabase Edge Functions:
  - `slack-test-alarm` v4 ACTIVE
  - `attendance-cron` v14 ACTIVE
  - `camera-presence-warning` v5 ACTIVE
- Sent a direct Slack test alarm to channel `C0BAFS1CSV8`; Supabase `net._http_response` returned HTTP 200 and function content returned `ok=true`.

#### Changed Files

- `supabase/functions/slack-test-alarm/index.ts`
- `supabase/functions/attendance-cron/index.ts`
- `supabase/functions/camera-presence-warning/index.ts`
- `apps/web/test/slackNotifications.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### Verification

- `npm.cmd test`
- `npm.cmd run build`
- Supabase Management API deploy responses confirmed ACTIVE function versions.
- Supabase SQL `net.http_post` invoked `slack-test-alarm` with `channelId = C0BAFS1CSV8`; response id `10360` returned HTTP 200 and Slack `messageTs`.

#### Remaining Work

- Scheduled Slack reminders still require a user-scoped `notification_targets.kind = 'slack'` row saved from the web app settings.
- Cross-user confirmation of whether `C0BAFS1CSV8` is already saved was rejected by security review and should not be retried without user-scoped context.

#### Next Priority

- Ask the user to save Slack Channel ID in the app settings, or provide the specific account identifier if server-side target setup is requested.

### 2026-06-14 - 반복 할 일 선택형 시간 설정

#### 완료한 작업

- 할 일 등록 모달에 `시간 없음` / `시간 설정` 토글과 시작/종료 시간 입력을 추가했다.
- `시간 설정`을 켠 경우 시작/종료 시간을 검증하고, 종료 시간이 시작 시간보다 늦을 때만 저장하도록 했다.
- 요일 반복 등록 시 선택한 시간 범위를 생성되는 모든 날짜의 todo에 함께 저장하도록 했다.
- 같은 날짜와 제목이라도 시간 범위가 다르면 별도 todo로 등록될 수 있게 중복 판단을 변경했다.
- 오늘 할 일, 알림 팝업, 완료 이력에 시간 배지를 표시하도록 했다.
- `attendance-cron`과 `slack-test-alarm`이 todo 시간 범위를 Slack/WebPush/이메일 알림 본문에 포함하도록 변경했다.
- 원격 Supabase 프로젝트 `bqohkdzvxbrokkmuhysx`에 `20260614115454 study_todo_time_window` migration을 적용했다.
- Supabase Edge Function `attendance-cron` v12, `slack-test-alarm` v2를 ACTIVE로 배포했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/todoRecurrence.mjs`
- `apps/web/src/todoRecurrence.d.mts`
- `apps/web/src/todoSchedule.mjs`
- `apps/web/src/todoSchedule.d.mts`
- `apps/web/test/todoRecurrence.test.mjs`
- `apps/web/test/todoSchedule.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/migrations/0016_study_todo_time_window.sql`
- `supabase/functions/attendance-cron/index.ts`
- `supabase/functions/slack-test-alarm/index.ts`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/prd-recurring-todos.md`
- `memory-bank/progress.md`

#### 검증 방법

- RED 확인: `todoSchedule.mjs` 없음, 시간별 중복 판단 미지원, `0016_study_todo_time_window.sql` 없음으로 테스트 실패 확인
- `npm.cmd test` 통과: 77개 테스트
- `npm.cmd run build` 통과
- Supabase MCP `_list_migrations`에서 `20260614115454 study_todo_time_window` 확인
- Supabase Edge Function list에서 `attendance-cron` v12, `slack-test-alarm` v2 ACTIVE 확인

#### 남은 작업

- Vercel production 배포 전까지 운영 URL에는 새 시간 설정 UI가 보이지 않을 수 있다.
- 실제 Slack 테스트 알림에서 시간 포함 todo가 표시되는지 운영 채널에서 한 번 더 확인한다.

#### 다음 우선순위

- production 웹 배포 후 모바일/데스크톱에서 todo 모달의 시간 입력 레이아웃을 확인한다.

### 2026-06-14 - 알림 시간 이전 활성 세션의 입장 알림 억제

#### 완료한 작업

- 웹 인앱 리마인더 팝업 조건을 `shouldShowStudyReminderPopup` helper로 분리했다.
- 같은 날짜에 `active` 공부 세션이 있으면 알림 시간이어도 "독서실 입장 시간입니다" 모달을 표시하지 않도록 했다.
- Supabase `get_due_reminders()`가 알림 시간 이전 시작 세션이 `reminder_at`을 지나 열려 있으면 `attendance_days.status = 'present'`로 보정하고, 초기/재촉 알림 대상에서 제외하도록 했다.
- Supabase `mark_missed_attendance()`가 결석 처리 전에 pre-reminder 세션이 `reminder_at`을 걸쳤는지 확인하고, 해당 pending 행은 `present`로 보정하도록 했다.
- 원격 Supabase 프로젝트 `bqohkdzvxbrokkmuhysx`에 `20260614114124 pre_reminder_active_session_attendance` migration을 적용했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/reminderPopup.mjs`
- `apps/web/src/reminderPopup.d.mts`
- `apps/web/test/reminderPopup.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/migrations/0015_pre_reminder_active_session_attendance.sql`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- `npm.cmd test` 통과: 71개 테스트
- `npm.cmd run build` 통과
- `git diff --check` 통과: whitespace error 없음, LF/CRLF warning만 출력
- Supabase MCP `_list_migrations`에서 `20260614114124 pre_reminder_active_session_attendance` 확인

#### 남은 작업

- 웹 인앱 팝업 변경은 Vercel production에 배포해야 배포 URL에 반영된다.
- 실제 20:30 cron 시간에 Slack/WebPush가 억제되는지 운영 데이터로 한 번 더 확인한다.

#### 다음 우선순위

- Vercel production 배포를 실행하거나 GitHub/Vercel 자동 배포 상태를 확인한다.

### 2026-06-14 - Slack Bot notification switch final status

#### 완료한 작업

- Slack notification target/channel migration을 Supabase 원격 DB에 적용했다.
- 기존 enabled Telegram target을 migration에서 비활성화하도록 했다.
- 웹 설정 화면을 Slack Channel ID 저장과 Slack 테스트 알림 중심으로 전환했다.
- `attendance-cron`의 Telegram 발송 분기를 Slack Bot API `chat.postMessage` 분기로 교체했다.
- `telegram-test-alarm`을 제거하고 `slack-test-alarm` Edge Function을 추가했다.
- `camera-presence-warning`을 Slack 경고 발송으로 전환했다.
- 카메라 미감지 5분에는 경고만 보내고, 총 10분 미감지부터 타이머가 자동 일시정지되도록 변경했다.
- 총 10분 이후 자동 일시정지 구간만 공부 시간에서 제외되도록 계산을 변경했다.
- Supabase Edge Function `attendance-cron` v11, `camera-presence-warning` v3, `slack-test-alarm` v1을 ACTIVE로 배포했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/slackChannelId.mjs`
- `apps/web/src/slackChannelId.d.mts`
- `apps/web/src/slackNotifications.mjs`
- `apps/web/src/slackNotifications.d.mts`
- `apps/web/src/cameraPresence.mjs`
- `apps/web/src/cameraPresence.d.mts`
- `apps/web/src/cameraWarning.mjs`
- `apps/web/src/cameraWarning.d.mts`
- `apps/web/test/slackNotifications.test.mjs`
- `apps/web/test/cameraPresence.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/functions/attendance-cron/index.ts`
- `supabase/functions/camera-presence-warning/index.ts`
- `supabase/functions/slack-test-alarm/index.ts`
- `supabase/migrations/0014_slack_notification_targets.sql`
- `memory-bank/prd-slack-notifications.md`
- `memory-bank/prd-camera-presence.md`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`
- `memory-bank/trouble-shooting.md`

#### 검증 방법

- Edge Function TypeScript parse check 통과: `attendance-cron`, `camera-presence-warning`, `slack-test-alarm`.
- `npm.cmd test` 통과: 66개 테스트.
- `npm.cmd run build` 통과.
- Supabase migration list에 `20260614112431 slack_notification_targets`가 추가됨을 확인했다.
- Supabase Edge Function list에서 `attendance-cron` v11, `camera-presence-warning` v3, `slack-test-alarm` v1 ACTIVE를 확인했다.
- Vercel production latest deployment는 아직 이전 커밋 `c61c95c` 기준임을 확인했다.

#### 남은 작업

- Supabase Edge Function secret `SLACK_BOT_TOKEN` 설정.
- Slack bot을 대상 `C...` 또는 `G...` 채널에 초대하고 앱 설정에서 Channel ID 저장.
- 실제 Slack 테스트 알림과 예약 알림 수신 확인.
- Vercel CLI token 또는 GitHub push pipeline으로 웹앱 production 배포.

#### 다음 우선순위

- `SLACK_BOT_TOKEN` secret 설정 후 `slack-test-alarm`을 호출해 `notification_deliveries.channel = 'slack'`, `status = 'sent'`를 확인한다.

### 2026-06-14 - Slack Bot 알림 전환과 카메라 미복귀 일시정지

#### 완료한 작업

- `slack` notification target과 delivery channel을 허용하는 migration을 추가했다.
- 기존 enabled Telegram target을 비활성화하도록 migration에 반영했다.
- 웹 설정 화면을 Slack Channel ID 저장과 Slack 테스트 알림 중심으로 전환했다.
- `attendance-cron`의 Telegram 발송 분기를 Slack Bot API `chat.postMessage` 분기로 교체했다.
- `telegram-test-alarm`을 제거하고 `slack-test-alarm` Edge Function을 추가했다.
- `camera-presence-warning`을 Slack 경고 발송으로 전환했다.
- 카메라 미감지 5분은 경고만 보내고, 총 10분 미감지부터 타이머가 자동 일시정지되도록 상태 머신을 변경했다.
- 총 10분 이후의 자동 일시정지 시간만 공부 시간에서 제외하도록 계산을 변경했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/slackChannelId.mjs`
- `apps/web/src/slackNotifications.mjs`
- `apps/web/src/cameraPresence.mjs`
- `apps/web/src/cameraWarning.mjs`
- `apps/web/test/slackNotifications.test.mjs`
- `apps/web/test/cameraPresence.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/functions/attendance-cron/index.ts`
- `supabase/functions/camera-presence-warning/index.ts`
- `supabase/functions/slack-test-alarm/index.ts`
- `supabase/migrations/0014_slack_notification_targets.sql`
- `memory-bank/prd-slack-notifications.md`
- `memory-bank/prd-camera-presence.md`
- `memory-bank/active-context.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/progress.md`

#### 검증 방법

- `npm.cmd test` 통과: 66개 테스트.
- `npm.cmd run build` 실행 예정.

#### 남은 작업

- Supabase 원격 DB에 migration 적용.
- Supabase Edge Function secret `SLACK_BOT_TOKEN` 설정.
- `attendance-cron`, `camera-presence-warning`, `slack-test-alarm` 배포.
- Vercel 웹 앱 배포.
- 실제 Slack 테스트 알림과 예약 알림 수신 확인.

#### 다음 우선순위

- build 통과 후 배포 권한과 Slack bot token을 확인한다.

### 2026-06-14 - 반복 todo 등록과 My Page 해시 페이지

#### 완료한 작업

- 캘린더 todo 모달에 `하루만`/`요일 반복` 저장 모드를 추가했다.
- 요일 반복 모드에서 반복 종료일과 요일 다중 선택을 지원하도록 했다.
- 반복 저장 시 선택 기간과 요일에 맞는 날짜별 `study_todos` 행을 bulk insert하도록 했다.
- 같은 날짜에 같은 제목의 todo가 이미 있으면 해당 날짜는 건너뛰도록 했다.
- `#me`, `#today`, `#settings` 해시를 기준으로 해당 화면만 렌더링해 My Page를 별도 페이지처럼 구성했다.
- My Page 요약 카드와 완료 이력 영역 스타일을 별도 화면에 맞게 보강했다.
- 정적 웹 앱에서도 클라이언트 라우팅으로 페이지 구현이 가능하다는 구조 판단을 active context에 기록했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/todoRecurrence.mjs`
- `apps/web/src/todoRecurrence.d.mts`
- `apps/web/src/dashboardRoute.mjs`
- `apps/web/src/dashboardRoute.d.mts`
- `apps/web/test/todoRecurrence.test.mjs`
- `apps/web/test/dashboardRoute.test.mjs`
- `memory-bank/prd-recurring-todos.md`
- `memory-bank/active-context.md`
- `memory-bank/progress.md`
- `memory-bank/implementation-plan.md`
- `memory-bank/design-document.md`
- `memory-bank/prd-my-page-todo-history.md`

#### 검증 방법

- RED: `node --test apps\web\test\todoRecurrence.test.mjs` failed because `todoRecurrence.mjs` did not exist.
- GREEN: `node --test apps\web\test\todoRecurrence.test.mjs` passed 4 tests.
- RED: `node --test apps\web\test\dashboardRoute.test.mjs` failed because `dashboardRoute.mjs` did not exist, then caught the `me` without `#` fallback case.
- GREEN: `node --test apps\web\test\dashboardRoute.test.mjs apps\web\test\todoRecurrence.test.mjs` passed 6 tests.
- `npm.cmd test` passed 64 tests.
- `npm.cmd run build` passed.
- Local Vite server returned HTTP 200 at `http://127.0.0.1:5177/`.
- Browser check reached the login page at `http://127.0.0.1:5177/#me`; dashboard-specific visual verification was blocked because the local browser had no logged-in session.
- Built output contains `요일 반복`, `반복 종료일`, `하루만`, and the hash route wiring.

#### 남은 작업

- 로그인된 브라우저에서 실제 `요일 반복` 저장 후 Supabase `study_todos`에 날짜별 row가 생성되는지 확인한다.
- 운영 배포가 필요하면 커밋 후 Vercel pipeline으로 배포한다.

#### 다음 우선순위

- 반복 todo를 실제 공부 알림 시간에 Telegram/Web Push 본문에 포함하는 end-to-end 확인을 수행한다.

### 2026-06-14 - 상반신 감시 운영 배포

#### 완료한 작업

- 상반신 기반 카메라 감시 변경 커밋 `c61c95c`를 `origin/main`에 push했다.
- GitHub Actions Vercel production run `27495238934`가 완료될 때까지 확인했다.
- 운영 URL `https://study-room-attendance.vercel.app/`가 새 번들 `/assets/index-a73GJLH-.js`를 서빙하는 것을 확인했다.
- 운영 JS 번들에 `PoseLandmarker`, `pose_landmarker_lite`, `상반신`, `p_excluded_seconds`, `자동 일시정지`가 포함된 것을 확인했다.

#### 변경된 파일

- `memory-bank/active-context.md`
- `memory-bank/progress.md`

#### 검증 방법

- `git diff --check`
- `npm.cmd test` passed 58 tests.
- `npm.cmd run build` passed.
- GitHub Actions API 확인: run `27495238934`, job `Test and deploy production`, conclusion `success`.
- 운영 URL 직접 확인: `https://study-room-attendance.vercel.app/` HTML과 `/assets/index-a73GJLH-.js` 번들 fetch.

#### 남은 작업

- 실제 카메라가 있는 브라우저에서 상반신만 보이는 조건, 5분 미감지 자동 일시정지, 10분 미복귀 자동 종료를 수동 검증한다.

#### 다음 우선순위

- 운영 URL에서 로그인 후 실제 공부 세션을 시작하고 카메라 감시 흐름을 확인한다.

### 2026-06-14

#### 완료한 작업

- 카메라 감시가 꺼진 상태에서는 `입장하고 시작`이 바로 Supabase `start_study_session` RPC를 호출하지 못하도록 차단했다.
- 카메라가 꺼져 있으면 `카메라 인증이 필요합니다` 팝업을 띄우고, `카메라 켜고 시작`을 눌렀을 때만 카메라 권한 요청 후 공부 세션을 시작하도록 했다.
- 활성 공부 세션 중 카메라 감시가 꺼져 있으면 앱 팝업을 다시 띄우고 `camera_required_warning` 이벤트를 Edge Function으로 보낸다.
- `camera_required_warning` Telegram 경고는 10분 쿨다운을 적용해 중복 발송을 막는다.
- `study_presence_events.event_type` check constraint에 `camera_required_warning`을 추가하는 migration을 만들고 원격 Supabase에 적용했다.
- `camera-presence-warning` Edge Function을 version 2 ACTIVE로 배포했다.
- 커밋 `e726c34`를 `origin/main`에 push해 GitHub Actions Vercel production 배포를 실행했다.
- GitHub Actions run `27472648244`가 성공했고, Vercel production URL이 최신 카메라 필수 시작 UI 번들을 서빙하는 것을 확인했다.
- 5분 이상 상반신이 감지되지 않으면 현재 세션 타이머가 자동 일시정지 상태가 되고, 해당 미감지 구간은 오늘 공부 시간과 현재 세션 시간에서 제외되도록 했다.
- 상반신이 다시 감지되면 제외 시간을 누적하고 현재 세션 타이머가 다시 진행되도록 했다.
- 10분 이상 상반신이 감지되지 않으면 세션을 자동 종료하고, `end_study_session` RPC에 `p_excluded_seconds`를 전달해 DB 저장 시간에서도 제외되도록 했다.
- 페이지 이탈 자동 종료 요청도 `p_excluded_seconds`를 전달하도록 수정했다.
- `end_study_session` RPC를 `p_excluded_seconds integer default 0` 인자로 확장하는 migration을 만들고 원격 Supabase에 적용했다.
- 커밋 `a461228`를 `origin/main`에 push해 GitHub Actions Vercel production 배포를 실행했다.
- GitHub Actions run `27473367753`이 성공했고, Vercel production URL이 최신 카메라 자동 일시정지/자동 종료 UI 번들을 서빙하는 것을 확인했다.
- 얼굴만 감지하던 `FaceDetector` 기반 카메라 감시를 `PoseLandmarker` 기반 상반신 감지로 교체했다.
- 머리 랜드마크 1개 이상과 좌우 어깨 랜드마크가 일정 confidence 이상이면 사람이 앉아 있는 것으로 판단하도록 했다.
- 상반신 감지 순수 함수와 앱 연결 테스트를 추가했다.

#### 변경된 파일

- `apps/web/src/main.tsx`
- `apps/web/src/cameraPresence.mjs`
- `apps/web/src/cameraPresence.d.mts`
- `apps/web/src/bodyPresenceDetection.mjs`
- `apps/web/src/bodyPresenceDetection.d.mts`
- `apps/web/src/cameraWarning.mjs`
- `apps/web/src/cameraWarning.d.mts`
- `apps/web/src/sessionExit.mjs`
- `apps/web/src/sessionExit.d.mts`
- `apps/web/test/cameraPresence.test.mjs`
- `apps/web/test/upperBodyPresence.test.mjs`
- `apps/web/test/sessionExit.test.mjs`
- `packages/core/test/sql-migrations.test.mjs`
- `supabase/functions/camera-presence-warning/index.ts`
- `supabase/migrations/0012_camera_required_warning.sql`
- `supabase/migrations/0013_exclude_camera_absence_from_sessions.sql`
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
- `git push origin main` succeeded for commit `e726c34`.
- GitHub Actions run `27472648244` completed with conclusion `success`.
- Production HTML at `https://study-room-attendance.vercel.app/` serves `/assets/index-VZ129eqe.js`.
- Production JS verification returned `camera_required_warning=true`, `카메라 인증이 필요합니다=true`, `카메라 켜고 시작=true`, and `자리 비움 경고=true`.
- RED: `node --test apps\web\test\cameraPresence.test.mjs apps\web\test\sessionExit.test.mjs packages\core\test\sql-migrations.test.mjs` failed because `ABSENCE_AUTO_END_SECONDS`, excluded RPC payloads, and `0013_exclude_camera_absence_from_sessions.sql` were missing.
- GREEN: `node --test apps\web\test\cameraPresence.test.mjs apps\web\test\sessionExit.test.mjs packages\core\test\sql-migrations.test.mjs` passed 25 tests.
- `npm.cmd test` passed 54 tests.
- `npm.cmd run build` passed after wrapping the `endTimer()` button handler.
- Supabase MCP `_apply_migration` returned `success=true` for `exclude_camera_absence_from_sessions`.
- Supabase migration list includes `20260613170021 exclude_camera_absence_from_sessions`.
- `git push origin main` succeeded for commit `a461228`.
- GitHub Actions run `27473367753` completed with conclusion `success`.
- Production HTML at `https://study-room-attendance.vercel.app/` serves `/assets/index-BFOVTlgA.js`.
- Production JS verification returned `자동 일시정지=true`, `자동 종료=true`, and `p_excluded_seconds=true`.
- RED: `node --test apps\web\test\upperBodyPresence.test.mjs apps\web\test\cameraPresence.test.mjs` failed because `hasSeatedUpperBodyPose` and `createUpperBodyPresenceDetector` were missing.
- GREEN: `node --test apps\web\test\upperBodyPresence.test.mjs apps\web\test\cameraPresence.test.mjs` passed 14 tests.

#### 남은 작업

- Manual browser verification with a real camera is still needed: click `입장하고 시작`, allow camera, confirm timer starts, move so upper body is visible without a full face, confirm the timer continues, then hide upper body for 5 minutes and confirm auto-pause/excluded timer.

#### 다음 우선순위

- Manually verify the deployed camera auto-pause and auto-end flow in a real browser session.

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
