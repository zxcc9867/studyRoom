# Active Context

## Current Work

- Task: Simplify the study goal dashboard card.
- Purpose: Remove the moving study-time timer and target study-hour UI from the goal summary so the card focuses on D-day and linked todo progress.
- Related PRD:
  - `memory-bank/prd-study-goals.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/test/studyGoals.test.mjs`

## Recent Decisions

- Decision: Keep the legacy `study_goals.target_study_seconds` column for DB compatibility, but save `0` from the web UI and calculate visible goal progress from linked todo completion only.
- Reason: The user said the study-time timer and goal study-time target are unnecessary and the moving timer made the goal card noisy.
- Alternative: Hide only the timer while keeping the target-hour input; rejected because it would leave a hidden progress source that users cannot understand.
- Impact: The top goal card and goals page no longer show moving study time, and the goal form no longer asks for target study hours.

## Current Status

- Completed: Removed the target study-hour input from the goal modal.
- Completed: Removed active study-time display from the top goal card and goal list cards.
- Completed: Styled the `목표 보기` link as a stable button-like action.
- Completed: `node --test apps\web\test\studyGoals.test.mjs`, `npm.cmd test`, and `npm.cmd run build` passed.
- In progress: Commit, push, and verify Vercel production deployment.
- Next: Verify production shows the simplified goal card.

## Notes

- This change is UI/UX focused. No Supabase schema migration is required.
- Existing rows may still contain non-zero `target_study_seconds`, but the current web UI ignores that value for visible progress.

## Current Work

- Task: Add study goal setting with D-day display.
- Purpose: Let the user create long-term study goals, see the nearest active goal's D-day on the dashboard, and connect todos to goals so daily work is tied to a larger target.
- Related PRD:
  - `memory-bank/prd-study-goals.md`
- Related files:
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

## Recent Decisions

- Decision: Model goals as a separate `study_goals` table and link dated todos through nullable `study_todos.goal_id`.
- Reason: Goals have their own lifecycle and target date, while todos remain date-based for daily checklists, reminders, and history.
- Alternative: Store goal metadata directly on todos; rejected because a goal can exist before todos are attached and can span many dates.
- Impact: The dashboard loads `study_goals` with existing data, displays a representative active goal in the topbar, and adds a dedicated `#goals` page for full management.

## Current Status

- Completed: Added D-day/progress helper tests and implementation.
- Completed: Added `#goals` route and goal management UI.
- Completed: Added Supabase migration for `study_goals`, RLS, explicit authenticated grants, and `study_todos.goal_id`.
- Completed: Applied the remote Supabase migration to project `bqohkdzvxbrokkmuhysx` and verified table/RLS/policies/FK.
- Completed: `node --test apps\web\test\studyGoals.test.mjs apps\web\test\dashboardRoute.test.mjs packages\core\test\sql-migrations.test.mjs` passed.
- Completed: `npm.cmd test` passed 145 tests.
- Completed: `npm.cmd run build` passed.
- Next: Commit/push and verify the Vercel production deployment.

## Notes

- Supabase Data API access for the new `study_goals` table uses an explicit `grant select, insert, update, delete` to `authenticated`.
- Goal progress combines linked todo completion and target study time when both are present; if one side is absent, the available side is used.

## Current Work

- Task: Clarify repeated recovery routine prompts after submission.
- Purpose: Fix the UX where a submitted recovery routine looked as if it was still being requested, even though another older pending recovery request was the real blocker.
- Related PRD:
  - `memory-bank/prd-slack-recovery-routines.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/test/recoveryRoutine.test.mjs`

## Recent Decisions

- Decision: Auto-open only blocking recovery requests, not every pending recovery request.
- Reason: Same-day missed-attendance recovery is a soft late-study path and should not interrupt study start, while older missed requests and repeated camera absence still block.
- Alternative: Continue auto-opening every pending request; rejected because it makes successful submissions look like a loop when multiple pending requests exist.
- Impact: After submission, the app immediately marks the request submitted locally, shows the next remaining blocking request if one exists, and displays the modal date/count.

## Current Status

- Completed: Confirmed production Supabase shows the user's 2026-06-18 recovery request is `submitted`, while an older 2026-06-17 `missed_attendance` request remains `pending`.
- Completed: Updated the web modal to display recovery date, type, queue position, and remaining count.
- Completed: Updated auto-open behavior to use `blockingRecoveryRequests` only.
- Completed: Added regression coverage for non-blocking same-day missed recovery requests.
- Completed: `node --test apps\web\test\recoveryRoutine.test.mjs`, `npm.cmd test`, and `npm.cmd run build` passed.
- Next: Commit, push, and verify Vercel production deployment.

## Notes

- Multiple pending recovery requests are valid. The UI must make it clear when the next prompt is a different date/request.
- Do not treat same-day missed recovery as a hard blocker because it would prevent the late-study attendance recovery path.
## Current Work

- Task: Add in-app recovery routine submission.
- Purpose: Let users recover from a pending missed-attendance or repeated-absence request directly in the web app after opening the URL, instead of being blocked when Slack interactivity is unavailable.
- Related PRD:
  - `memory-bank/prd-slack-recovery-routines.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/test/recoveryRoutine.test.mjs`
  - `supabase/migrations/20260618121536_in_app_recovery_submission.sql`

## Recent Decisions

- Decision: Keep Slack recovery buttons, but add an authenticated in-app fallback modal that submits the same reason, makeup todo, and pledge fields.
- Reason: The user wants Slack submission and direct URL submission to both unblock study, and Slack interactivity can fail due to Signing Secret or Slack app configuration.
- Alternative: Force the user to fix Slack before any recovery; rejected because it can permanently block study when Slack is misconfigured.
- Impact: Pending recovery requests still block study start, but the app now gives the logged-in user a first-party way to submit the recovery routine and create the same todos.

## Current Status

- Completed: Added web modal state, auto-open behavior for pending recovery requests, manual `회복 루틴 작성` buttons, and RPC submission from the app.
- Completed: Added `submit_study_recovery_request` migration to validate `auth.uid()`, lock the pending request, create makeup/pledge todos, and mark the request submitted.
- Completed: Added source-level regression coverage in `apps/web/test/recoveryRoutine.test.mjs`.
- Completed: Applied Supabase migrations `in_app_recovery_submission` and `revoke_anon_recovery_submission`.
- Completed: `npm.cmd test` and `npm.cmd run build` passed.
- Completed: Committed and pushed `1230076056739485f5acdc4ddf889726736706df`; GitHub Actions run `27760013203` succeeded and Vercel deployment `dpl_5wQdvFgqWzAbaJa1UTEEN5iKoFWC` is `READY`.
- Next: If a pending recovery request exists, verify the in-app modal with a logged-in browser session.

## Notes

- The app fallback does not remove Slack. Slack remains the notification and modal path when correctly configured.
- Do not store Slack signing secret or bot token values in memory-bank or committed files.

## Current Work
- Task: Weekday/weekend attendance policy and late study recovery.
- Purpose: Keep the 30-minute forced check-in window, but allow a missed same-day attendance to become present when the user completes the daily study goal: 2 hours on weekdays and 4 hours on weekends.
- Related PRD:
  - `memory-bank/prd-user-profile.md`
  - `memory-bank/prd-supabase-cron.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/attendancePolicy.mjs`
  - `apps/web/src/attendancePolicy.mjs.d.ts`
  - `apps/mobile/App.tsx`
  - `packages/core/src/index.mjs`
  - `packages/core/test/attendance.test.mjs`
  - `packages/core/test/sql-migrations.test.mjs`
  - `supabase/functions/attendance-cron/index.ts`
  - `supabase/migrations/0021_late_study_goal_attendance_policy.sql`

## Recent Decisions

- Decision: Weekdays use the saved profile reminder time, defaulting to `20:30`, while weekends use a fixed `14:00` reminder time.
- Reason: The user explicitly wants weekday reminders from 20:30 and weekend reminders from 14:00.
- Alternative: Add a second editable profile column for weekend reminder time; deferred because the request specifies a fixed weekend time and the MVP already has a single editable weekday reminder field.
- Impact: `get_due_reminders()`, `mark_missed_attendance()`, `start_study_session()`, and the web UI all compute effective reminder time from the local date.

- Decision: Same-day pending `missed_attendance` recovery no longer blocks study start; camera-repeat recovery and old recovery requests still block.
- Reason: If a missed-attendance recovery blocks `start_study_session()`, the user cannot complete the requested late 2-hour/4-hour recovery study.
- Alternative: Require Slack recovery submission before late study; rejected because it conflicts with the new late-study attendance path.
- Impact: Ending a session that reaches the daily goal promotes `attendance_days.status` to `present` and auto-resolves same-day pending missed-attendance recovery as `submitted`.

## Current Status

- Completed: Added TDD coverage for weekday/weekend goals, weekend 14:00 reminders, late-study present promotion, and the adjusted recovery blocker.
- Completed: Added `0021_late_study_goal_attendance_policy.sql` and applied remote Supabase migration `20260615161759 late_study_goal_attendance_policy` to project `bqohkdzvxbrokkmuhysx`.
- Completed: Redeployed `attendance-cron` as Supabase Edge Function version 18 with `verify_jwt=false`.
- Completed: Updated the web dashboard and mobile copy so the UI no longer implies that only the 30-minute start window can produce attendance.
- Completed: `npm.cmd test` passed 127 tests.
- Completed: `npm.cmd run build` passed.
- Completed: Committed and pushed `ac8d6ff4d822664faa4d9664679b8858a56a2188` to `origin/main`.
- Completed: GitHub Actions run `27560595135` succeeded for the Vercel production workflow.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200 and served the post-deploy asset `index-CcuqWrmS.js`.
- Blocked: none.
- Next: Production smoke-test a weekday and weekend policy scenario with a logged-in account if manual verification is needed.

## Notes

- Late-study promotion is evaluated on completed saved study time. An active late session becomes attendance-eligible when it is ended and `duration_seconds` is persisted.
- Supabase changelog checked on 2026-06-16: new public tables should use explicit grants for Data API access. This change adds functions and no new Data API table.

## Current Work

- Task: Editable scheduled and recurring todos in the attendance calendar modal.
- Purpose: Let users click an existing todo, see its saved time/repeat metadata, edit title/time/weekdays/repeat end date, and save the changes without leaving stale recurring rows behind.
- Related PRD:
  - `memory-bank/prd-recurring-todos.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/src/todoRecurrence.mjs`
  - `apps/web/src/todoRecurrence.d.mts`
  - `apps/web/test/todoRecurrence.test.mjs`
  - `apps/web/test/slackNotifications.test.mjs`
  - `packages/core/test/sql-migrations.test.mjs`
  - `supabase/migrations/0020_study_todo_repeat_metadata.sql`

## Recent Decisions

- Decision: Keep dated `study_todos` rows, but persist lightweight repeat metadata on each generated row through `repeat_group_id`, `repeat_mode`, `repeat_weekdays`, and `repeat_until`.
- Reason: The app already depends on dated todo rows for daily checklists, notification enrichment, and todo history, while editing recurring rows requires knowing which rows belong to the same repeated item.
- Alternative: Add a separate recurrence-rule table and generate dated todos server-side; deferred because it is larger than the requested calendar modal editing scope.
- Impact: Existing single todos remain default `single` rows. Weekly recurring todos can now be edited as a group from any generated date.

## Current Status

- Completed: Added repeat metadata migration and applied remote Supabase migration `study_todo_repeat_metadata` to project `bqohkdzvxbrokkmuhysx`.
- Completed: Added repeat metadata helpers and tests for weekday normalization, weekly detection, and todo list labels.
- Completed: Added edit-state UI so an existing todo fills the modal with saved title, time, repeat mode, weekdays, and repeat end date.
- Completed: Added update logic for converting recurring rows to single rows, updating existing recurring rows, inserting newly selected dates, and deleting dates removed from the repeat rule.
- Completed: `npm.cmd test` passed 119 tests.
- Completed: `npm.cmd run build` passed.
- Completed: Committed and pushed `3d763c39564a7985052783cd72e2c905d6208d79` to `origin/main`.
- Completed: Vercel production deployment `dpl_36noV75oS5vakytBrPCiFHWfsdyL` for commit `3d763c39564a7985052783cd72e2c905d6208d79` is `READY`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200.
- Completed: Vercel production runtime error-log query for deployment `dpl_36noV75oS5vakytBrPCiFHWfsdyL` returned no `error` or `fatal` logs in the checked 30-minute window.
- Blocked: none.
- Next: Verify in production with a logged-in account that editing a scheduled weekly todo closes the modal and updates all generated dates.

## Notes

- This change updates `study_todos` schema and client-side todo editing only. It does not introduce a new API route or a server-side recurrence generator.
- Supabase Data API access remains explicit through `grant select, insert, update, delete on public.study_todos to authenticated`.

## Current Work

- Task: Slack recovery routine enforcement for missed attendance and repeated camera absence.
- Purpose: Require the user to submit a Slack modal with a reason, makeup task, and next-day pledge before a new study session can start after a missed attendance or repeated absence warnings.
- Related PRD:
  - `memory-bank/prd-slack-recovery-routines.md`
  - `memory-bank/prd-slack-notifications.md`
  - `memory-bank/prd-camera-presence.md`
- Related files:
  - `supabase/migrations/0019_study_recovery_requests.sql`
  - `supabase/functions/_shared/recovery.ts`
  - `supabase/functions/attendance-cron/index.ts`
  - `supabase/functions/camera-presence-warning/index.ts`
  - `supabase/functions/slack-recovery-interactions/index.ts`
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `packages/core/test/sql-migrations.test.mjs`
  - `apps/web/test/slackNotifications.test.mjs`

## Recent Decisions

- Decision: Slack recovery input uses a signed Slack button plus `views.open` modal instead of an in-app recovery form.
- Reason: The product goal is to force the user to acknowledge failures in the notification channel, and the user explicitly selected Slack modal submission as the v1 input path.
- Alternative: Build a web form in the app; deferred because the plan excludes an in-app recovery form for v1.
- Impact: `slack-recovery-interactions` must be configured as the Slack App Interactivity Request URL and must have `SLACK_SIGNING_SECRET`.

## Current Status

- Completed: Added `study_recovery_requests` schema with RLS read access, duplicate pending prevention, follow-up tracking, and `start_study_session()` blocking for pending recovery.
- Completed: Added Slack recovery button/modal handling and todo creation for submitted recovery routines.
- Completed: Wired missed attendance and second same-day camera absence warning to create recovery requests and Slack recovery messages.
- Completed: Added a Today Focus recovery blocker that disables study start while pending recovery exists.
- Completed: `npm.cmd test`, `npm.cmd run build`, and `git diff --check` passed locally.
- Completed: Supabase migration `study_recovery_requests` is applied to project `bqohkdzvxbrokkmuhysx`.
- Completed: Deployed `slack-recovery-interactions` v1 and `attendance-cron` v17; both are ACTIVE with `verify_jwt=false`.
- Completed: Committed and pushed `6cf4cad084bdd6d6a2d23380d3e5ad9f425fd119` to `origin/main`.
- Completed: Vercel production deployment `dpl_2P8wuQNyPh9qgEov37rAkvzzqctZ` for commit `6cf4cad084bdd6d6a2d23380d3e5ad9f425fd119` is `READY`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200.
- Completed: Vercel production runtime error-log query for deployment `dpl_2P8wuQNyPh9qgEov37rAkvzzqctZ` returned no `error` or `fatal` logs in the checked one-hour window.
- Blocked: `camera-presence-warning` redeploy was rejected by the execution approval reviewer because the per-function command still uses `--no-verify-jwt`; explicit user approval is required before trying again.
- Blocked: Supabase Edge Function secrets include `STUDY_ALERT_SLACK_BOT_TOKEN`, but `SLACK_SIGNING_SECRET` is not configured yet. Slack recovery modal submissions will fail request verification until the user adds the Slack app signing secret.
- Next: After explicit approval, redeploy `camera-presence-warning` so repeated camera absence can create recovery requests remotely.
- Next: Add `SLACK_SIGNING_SECRET` from Slack App `Basic Information > App Credentials > Signing Secret`, then test the recovery modal.

## Notes

- Slack tokens and signing secrets must stay in Supabase Edge Function secrets only.
- The Slack bot must be invited to the saved channel before recovery messages can be delivered.
- `camera_required_warning` remains a camera setup warning and does not trigger recovery.

## Current Work

- Task: Improve Slack alarm message readability.
- Purpose: Make scheduled reminders, Slack test alarms, and camera warnings easier to scan in Slack by adding emoji-led sections for deadline, todos, action, and app link.
- Related PRD:
  - `memory-bank/prd-slack-notifications.md`
  - `memory-bank/prd-supabase-cron.md`
- Related files:
  - `supabase/functions/attendance-cron/index.ts`
  - `supabase/functions/slack-test-alarm/index.ts`
  - `supabase/functions/camera-presence-warning/index.ts`
  - `packages/core/test/sql-migrations.test.mjs`

## Recent Decisions

- Decision: Keep Slack messages as plain `chat.postMessage.text` with mrkdwn-compatible text instead of introducing Block Kit.
- Reason: The current Edge Functions already use simple text bodies and the user asked for readability, not a new Slack interaction surface.
- Alternative: Use Slack Block Kit with sections and dividers; deferred because it adds payload complexity without changing alarm behavior.
- Impact: Slack reminders now show clear sections such as deadline, today's todos, next action, and app link while keeping the existing bot token, channel target, and delivery logging path.

## Current Status

- Completed: Added source-level regression tests for readable Slack message sections.
- Completed: Updated `attendance-cron`, `slack-test-alarm`, and `camera-presence-warning` Slack text bodies.
- Completed: `npm.cmd test`, `npm.cmd run build`, and `git diff --check` passed locally.
- Completed: Deployed `attendance-cron` v16, `slack-test-alarm` v5, and `camera-presence-warning` v6 to Supabase; all are ACTIVE with `verify_jwt=false`.
- Completed: Sent a direct Slack test alarm to channel `C0BAFS1CSV8`; request `10977` returned HTTP 200, `ok=true`, and Slack `messageTs=1781477126.922689`.
- Completed: Committed and pushed `47387bcfceabbf560f01fd8a63053cae036b062b` to `origin/main`.
- Completed: Vercel production deployment `dpl_FnM3zWh3Js9mt68NagH6esCE5z4z` for commit `47387bcfceabbf560f01fd8a63053cae036b062b` is `READY`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200.
- Completed: Vercel production runtime error-log query for deployment `dpl_FnM3zWh3Js9mt68NagH6esCE5z4z` returned no `error` or `fatal` logs in the checked one-hour window.
- Blocked: None.
- Next: If the user wants visual confirmation, compare the received Slack message with the new sectioned format in the target channel.

## Notes

- This change does not alter DB schema, Slack token names, Slack Channel ID storage, or notification target lookup.

## 현재 작업

- 작업명: 설정된 알람 편집 UI
- 작업 목적: 사용자가 이미 설정한 매일 알림을 읽기 전용 카드에서 확인하고, 필요할 때만 편집 모드로 전환해 알림 시간과 이메일 보완 여부를 수정할 수 있게 한다.
- 관련 PRD:
  - `memory-bank/prd-user-profile.md`
  - `memory-bank/prd-supabase-cron.md`
  - `memory-bank/prd-slack-notifications.md`
- 관련 파일:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/test/alarmSettings.test.mjs`

## 최근 결정 사항

- 결정: 알람 시간 편집은 `profiles.reminder_time`과 `email_reminders_enabled`만 저장하는 전용 액션으로 분리한다.
- 이유: 기존 `저장하고 컴퓨터 알림 켜기`는 브라우저 푸시 권한 요청과 테스트 알림까지 실행하므로, 단순 알람 편집과 섞이면 사용자가 어떤 설정이 바뀌었는지 알기 어렵다.
- 대안: 기존 입력 필드와 버튼을 그대로 유지하는 방법이 있었지만, 설정된 알람을 편집한다는 사용자의 요청과 맞지 않아 카드형 읽기/편집 구조로 바꿨다.
- 영향 범위: 웹 설정 화면 UI, 프로필 알림 시간 저장 UX, 이메일 보완 알림 토글 UX.

## 현재 상태

- 완료: 설정 화면에 `설정된 알람` 카드와 `알람 편집` / `알람 저장` / `취소` 흐름을 추가했다.
- 완료: 알림 수단 관리는 별도 `알림 수단` 영역으로 분리해 Slack 저장, 컴퓨터 알림 켜기, Slack 테스트 알림을 유지했다.
- 완료: `apps/web/test/alarmSettings.test.mjs`를 추가하고 RED/GREEN 순서로 검증했다.
- 완료: `npm.cmd test`, `npm.cmd run build`가 통과했다.
- 완료: 커밋 `ba79f122c5519853bb28449b62599ab06c1e4686`을 `origin/main`에 푸시했다.
- 완료: GitHub Actions run `27504823847`이 success로 완료됐다.
- 완료: Vercel deployment `dpl_AN5vRFoQQb74EqgWmuLKT9XgkJ2d`가 `READY`이고 production URL이 `HTTP 200`으로 응답했다.
- 진행 중: 배포 결과 기록 커밋을 푸시해야 한다.
- 막힌 부분: 없음.
- 다음 작업: 운영 브라우저에서 로그인 후 설정 화면의 알람 편집 UX를 실제 계정 데이터로 확인한다.

## 주의할 점

- 단순 알람 편집은 브라우저 푸시 권한 요청을 실행하지 않는다. 컴퓨터 알림 등록/갱신은 사용자가 `저장하고 컴퓨터 알림 켜기`를 누를 때 수행한다.
- Slack 알림 수신은 여전히 로그인 계정의 `notification_targets.kind = 'slack'` 저장 여부에 의존한다.

## Current Work

- Task: Build a camera status diagnosis UI in the Today Focus camera card.
- Purpose: Help users understand whether camera problems come from browser support, permissions, stream health, blank frames, loading/reconnect, or upper-body absence.
- Related PRD:
  - `memory-bank/prd-camera-presence.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/src/cameraDiagnostics.mjs`
  - `apps/web/src/cameraDiagnostics.d.mts`
  - `apps/web/test/cameraDiagnostics.test.mjs`
  - `apps/web/test/cameraPresence.test.mjs`

## Recent Decisions

- Decision: Add a client-only `cameraDiagnostics` helper instead of sending media or diagnostics to the server.
- Reason: The issue is user-facing explanation of existing browser-side camera state, and the privacy rule still says images, frames, pose landmarks, and video must stay in the browser.
- Alternative: Add a server-side diagnostic event stream; rejected because it would not help diagnose local permissions or device conflicts and would add unnecessary backend scope.
- Impact: The UI can explain `HTTPS 필요`, `권한 차단`, `검은 화면`, `영상 연결 확인 중`, `상반신 미감지`, and `카메라 정상` without Supabase schema changes.

- Decision: Render the diagnosis as a slim strip inside the existing camera card.
- Reason: The user needs the cause and next action at the point where the camera preview appears, but the card should not grow into another full nested card.
- Alternative: Add a separate modal or page; rejected because the user asked for a camera status diagnosis UI, and the camera card is the most direct place.
- Impact: The Today Focus card now shows one camera status header plus a small diagnosis area with concise next checks.

## Current Status

- Completed: Added RED tests for the new `cameraDiagnostics` helper and Today Focus diagnostic UI wiring.
- Completed: Added browser-side diagnostic mapping for support, permission, stream, frame, absence, loading, paused, and healthy states.
- Completed: Wired `main.tsx` to track the latest camera diagnostic reason and render the diagnosis checklist.
- Completed: Added focused CSS for a compact in-card diagnostic strip.
- Completed: `node --test apps\web\test\cameraDiagnostics.test.mjs`, `node --test apps\web\test\cameraPresence.test.mjs`, `npm.cmd test`, and `npm.cmd run build` pass locally.
- Completed: Committed and pushed `6ea6911511ab4a41dea1aa93e43976a4ae356108` to `origin/main`.
- Completed: GitHub Actions run `27504384773` succeeded, Vercel deployment `dpl_3bUuQKGfXrxGLNhCobnYUxELFVjZ` is `READY`, and `https://study-room-attendance.vercel.app` returned `HTTP 200`.

## Notes

- This is a frontend-only camera diagnosis change. It does not change Supabase data, camera warning Slack delivery, or study-time calculation.
- In-app Browser MCP was closed during this run, so live screenshot verification was not available from the browser tool. Local HTTP responded on `http://127.0.0.1:5177/`.

## Current Work

- Task: Fix camera monitoring stuck in `준비 중` after the camera stream stops producing frames.
- Purpose: Prevent camera monitoring from looking like it turned off automatically when the video track is still live but no current frame or video size is available.
- Related PRD:
  - `memory-bank/prd-camera-presence.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/cameraFrameRecovery.mjs`
  - `apps/web/src/cameraFrameRecovery.d.mts`
  - `apps/web/test/cameraFrameRecovery.test.mjs`

## Recent Decisions

- Decision: Treat `no-current-frame` and `no-video-size` as transient loading issues only for a limited time.
- Reason: The user's screenshot showed `카메라 감시 · 준비 중` with the message `카메라 영상을 불러오는 중입니다`, while the study timer kept running. The old state machine could stay in that state indefinitely.
- Alternative: Immediately mark this as a hard camera error; rejected because short metadata/frame delays are normal when a camera stream starts or resumes.
- Impact: The app waits up to 15 seconds, then attempts one automatic camera reconnect for the same active session.

- Decision: If the frame is still unavailable after one automatic reconnect, stop the broken stream and let the user manually turn camera monitoring on again.
- Reason: Repeating `getUserMedia()` forever can spam the browser/device and hide real permission/device failures.
- Alternative: Keep showing `준비 중`; rejected because the user has no way to recover.
- Impact: The camera button is no longer locked just because status is `starting` when monitoring was already enabled.

## Current Status

- Completed: Added a camera frame recovery state machine.
- Completed: Added regression tests for wait/restart/fail/reset camera frame recovery behavior.
- Completed: Wired the web app to reconnect once after 15 seconds of missing current frame/video size.
- Completed: The camera toggle remains usable when an already-enabled camera falls back to `준비 중`.
- Completed: `npm.cmd test`, `npm.cmd run build`, and `git diff --check` pass locally.
- Completed: Committed and pushed `6fa480a477a9bfc7217bd113f932ed58952515ea` to `origin/main`.
- Completed: GitHub Actions run `27503047022` succeeded, Vercel deployment `dpl_6hrGHJAkV4zkGfkma9sCuQCanaEo` is `READY`, and production URL returned `HTTP 200`.

## Notes

- This fix does not send images or frames to the server. It only changes browser-side recovery from a stalled video element.
- If the browser/device returns a muted, ended, disabled, blank, or blocked camera stream, the app still shows a camera error instead of treating it as attendance presence.

## Current Work

- Task: Add clear Slack Channel ID setup, remove Kakao alarm behavior, preserve active timers across refresh, and restore camera monitoring after refresh.
- Purpose: Make Slack alarm setup understandable for the current logged-in account, remove the unused Kakao path from product behavior, and stop refresh/reload from making an active study session look like it lost time or camera monitoring.
- Related PRD:
  - `memory-bank/prd-slack-notifications.md`
  - `memory-bank/prd-camera-presence.md`
  - `memory-bank/prd-kakao-notifications.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/sessionExit.mjs`
  - `apps/web/src/cameraResume.mjs`
  - `apps/web/src/authProviders.mjs`
  - `supabase/functions/attendance-cron/index.ts`
  - `supabase/migrations/0018_disable_kakao_notifications.sql`

## Recent Decisions

- Decision: Add a dedicated `Slack 채널 저장` action next to the Slack Channel ID field.
- Reason: Saving Slack was previously hidden behind the computer-notification save button, so users could enter a channel ID but still not create the per-user `notification_targets.kind = 'slack'` row.
- Alternative: Keep Slack save as a side effect of the general notification save; rejected because it made the missing Slack target message look like a server bug.
- Impact: Users can now save the Slack Channel ID first, then run the Slack test alarm for the same logged-in account.

- Decision: Remove Kakao from the active web UI and scheduled alarm path, while preserving legacy DB history.
- Reason: The product direction moved to Slack Bot API alarms; keeping Kakao OAuth/link UI and Kakao Memo sending increased setup confusion.
- Alternative: Keep Kakao as a second optional channel; rejected for the current MVP because Slack is the chosen alarm channel.
- Impact: Existing Kakao DB records remain for history, but enabled Kakao targets/connections are disabled and `attendance-cron` no longer sends Kakao messages.

- Decision: Do not end a study session on `pagehide`, `beforeunload`, or `visibilitychange`.
- Reason: Browser refresh fired page-exit handlers and closed the active session, so after logging back in the ongoing timer could appear to have lost previously accumulated time.
- Alternative: Try to distinguish refresh from tab/window close in lifecycle events; rejected because browser lifecycle signals are not reliable enough for that split.
- Impact: Active timers survive refresh. Users should end sessions explicitly with the `종료` button; a future heartbeat cleanup can handle abandoned sessions.

- Decision: Remember camera monitoring intent per user/session and attempt one automatic camera reconnect after refresh.
- Reason: Browser camera streams cannot survive page reload, but the app can remember that the same active session had camera monitoring on and ask the browser to reacquire the stream.
- Alternative: Always prompt manually after refresh; rejected because it makes refresh recovery feel broken.
- Impact: Camera monitoring can resume for the same active session if the stored intent is recent and browser permission still allows camera access.

## Current Status

- Completed: Added tests for Slack save UX, Kakao UI removal, page lifecycle no-end policy, camera monitoring resume intent, attendance-cron Kakao exclusion, and Kakao disable migration.
- Completed: Added `cameraResume.mjs` helpers and wired camera auto-restore into the web app.
- Completed: Added a clear Slack Channel ID save button and validation.
- Completed: Removed Kakao OAuth/linking UI helpers and removed Kakao sending from `attendance-cron`.
- Completed: Added Supabase migration `0018_disable_kakao_notifications.sql` and applied it to project `bqohkdzvxbrokkmuhysx`.
- Completed: `npm.cmd test` and `npm.cmd run build` pass locally.
- Completed: Deployed `attendance-cron` version 15 to Supabase and confirmed it is ACTIVE.
- Completed: Deleted legacy remote Edge Functions `kakao-token` and `telegram-test-alarm`; the remaining remote functions are `attendance-cron`, `camera-presence-warning`, and `slack-test-alarm`.
- Completed: Committed and pushed the app changes to `origin/main`.
- Completed: GitHub Actions production workflow succeeded and Vercel production deployment is READY.
- Completed: `https://study-room-attendance.vercel.app` returns HTTP 200 and Vercel production error-log query returned no matching errors.

## Notes

- The Slack server token/channel direct test only proves the bot can post to a channel. Scheduled reminders and camera warnings still require saving Slack Channel ID in the app for the logged-in Supabase user.
- Removing automatic page lifecycle session end fixes refresh loss, but it also means browser close is not treated as a reliable session end signal anymore.

## Current Work

- Task: Fix camera false absence when the camera preview is black and clarify Slack target setup.
- Purpose: Stop counting black/muted/stalled camera feeds as user absence, make upper-body detection more tolerant of webcam cropping, and make Slack missing-target messages clear.
- Related PRD:
  - `memory-bank/prd-camera-presence.md`
  - `memory-bank/prd-slack-notifications.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/bodyPresenceDetection.mjs`
  - `apps/web/src/cameraVideoHealth.mjs`
  - `apps/web/test/cameraVideoHealth.test.mjs`
  - `apps/web/test/cameraPresence.test.mjs`
  - `apps/web/test/upperBodyPresence.test.mjs`
  - `apps/web/test/slackNotifications.test.mjs`

## Recent Decisions

- Decision: Treat unhealthy camera video as a camera error instead of an absence signal.
- Reason: The user's screenshot showed a black preview while the app kept accumulating absence time and eventually auto-paused the timer.
- Alternative: Keep using PoseLandmarker absence for every frame; rejected because a black/muted/stalled feed is a camera health problem, not proof the user left the seat.
- Impact: Missing/ended/muted/disabled tracks, missing current frames, zero video size, and nearly black frames reset the absence timer and show a camera-specific instruction.

- Decision: Accept head plus one shoulder plus same-side hip as seated upper-body presence.
- Reason: Desktop webcam framing can crop one shoulder, causing false absence even when the user is seated.
- Alternative: Require both shoulders forever; rejected as too brittle for real webcam framing.
- Impact: The existing head + both shoulders case remains valid, and head-only still does not pass.

## Current Status

- Completed: Added camera stream/frame health checks to the web app.
- Completed: Added black-frame detection before PoseLandmarker absence checks.
- Completed: Relaxed upper-body detection for cropped webcam views.
- Completed: Clarified Slack missing-target messages so users know they must save Slack Channel ID for the current account.
- Completed: `npm.cmd test` and `npm.cmd run build` pass locally.
- Completed: Pushed commit `52dd9cd` to `origin/main`.
- Completed: GitHub Actions run `27501945457` succeeded.
- Completed: Vercel production deployment `dpl_C1TQMz28PMtYnYRuftEPnx9WDc67` is `READY` for commit `52dd9cd`.
- Completed: `https://study-room-attendance.vercel.app` returns HTTP 200.
- Next: User should hard refresh production and restart camera monitoring. If the preview is still black, check browser camera permission, privacy shutter, and whether another app is using the camera.

## Notes

- Supabase Edge Functions for Slack are ACTIVE. The screenshot message means the current Supabase user does not have an enabled `notification_targets.kind = 'slack'` row, not that the Slack bot token path is absent.
- A direct Slack channel test verifies server token/channel/bot membership, but scheduled and camera warnings require the app settings to save Slack Channel ID for the logged-in user.

## Current Work

- Task: Update the app-local `AGENTS.md` for `study-room-attendance`.
- Purpose: Ensure future Codex work in this repository reads the app's own `memory-bank` documents and follows the app's Vercel deployment rule, not only the parent workspace rule.
- Related PRD: none; this is an agent workflow/documentation update.
- Related files:
  - `AGENTS.md`
  - `memory-bank/active-context.md`
  - `memory-bank/progress.md`
  - `memory-bank/implementation-plan.md`
  - `memory-bank/trouble-shooting.md`

## Recent Decisions

- Decision: Expand `C:\jini-dev\project\study-room-attendance\AGENTS.md` directly instead of relying on the parent `C:\jini-dev\project\AGENTS.md`.
- Reason: The user pointed out the previous update was made in the parent workspace, while the relevant app repository has its own root `AGENTS.md`.
- Alternative: Keep only the parent workspace instruction; rejected because future sessions opened in the app repo may read only the app-local `AGENTS.md`.
- Impact: Future app work should consult app-local `memory-bank` documents, follow Supabase documentation rules, and deploy Vercel-backed user-visible changes through the existing production workflow.

## Current Status

- Completed: Replaced the minimal Spec Kit-only `AGENTS.md` with app-specific Memory Bank, Supabase, validation, Vercel deployment, Git, and final response rules.
- Completed: Preserved the Spec Kit marker block inside the expanded `AGENTS.md`.
- Completed: Restored the parent workspace `AGENTS.md` to generic workspace rules after an accidental edit.
- Next: Future app changes should start from `C:\jini-dev\project\study-room-attendance` and use this repository's `AGENTS.md`.

## Notes

- This update is documentation/workflow only and does not require Vercel deployment.

## Current Work

- Task: Fix todo save failure for overnight scheduled recurring todos.
- Purpose: Allow schedules such as `23:00` to `01:00` to save as next-day ending todo blocks.
- Related PRD:
  - `memory-bank/prd-recurring-todos.md`
- Related files:
  - `apps/web/src/todoSchedule.mjs`
  - `apps/web/test/todoSchedule.test.mjs`
  - `supabase/migrations/0017_allow_overnight_study_todo_times.sql`
  - `packages/core/test/sql-migrations.test.mjs`
  - `memory-bank/implementation-plan.md`
  - `memory-bank/progress.md`
  - `memory-bank/trouble-shooting.md`

## Recent Decisions

- Decision: Treat `end_time < start_time` as an overnight schedule ending on the next day.
- Reason: The user's screenshot uses `11:00 PM` to `1:00 AM`; the old frontend and DB constraint treated that as invalid and stopped the save before the modal could close.
- Alternative: Keep rejecting overnight schedules and show a clearer validation message; rejected because the UI should support Google Calendar-like schedules.
- Impact: Same-day schedules still work, overnight schedules save, and only equal start/end times remain invalid.

## Current Status

- Completed: Confirmed remote Supabase constraint was `start_time < end_time`.
- Completed: Added failing tests for overnight schedule validation and DB migration coverage.
- Completed: Updated frontend schedule validation to allow overnight ranges.
- Completed: Applied Supabase migration `allow_overnight_study_todo_times`; remote constraint now uses `start_time <> end_time`.
- Completed: `npm.cmd test`, `npm.cmd run build`, and `git diff --check` pass locally.
- Completed: Pushed commit `5afb350` to `origin/main`.
- Completed: GitHub Actions run `27501233411` succeeded.
- Completed: Vercel production deployment `dpl_AKeaHsZ1kgMz3DvkN8TRdbd9Ny9p` is `READY` for commit `5afb350`.
- Completed: `https://study-room-attendance.vercel.app` returns HTTP 200.
- Next: If the user still sees the modal stay open, inspect the browser console and Supabase insert response for the exact account/session.

## Notes

- The local Supabase CLI is not installed, so the migration file was created manually as `0017_allow_overnight_study_todo_times.sql` and applied through Supabase MCP.

## Current Work

- Task: Fix todo save visibility with optional time and weekday repeat.
- Purpose: Make scheduled recurring todos visibly appear after save and correctly format Supabase `time` column values.
- Related PRD:
  - `memory-bank/prd-recurring-todos.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/todoRecurrence.mjs`
  - `apps/web/src/todoRecurrence.d.mts`
  - `apps/web/src/todoSchedule.mjs`
  - `apps/web/test/todoRecurrence.test.mjs`
  - `apps/web/test/todoSchedule.test.mjs`

## Recent Decisions

- Decision: Keep the existing materialized row model, but after save focus the calendar on the selected date if it received a todo, otherwise on the first generated date.
- Reason: If the user opens one date and selects weekday repeat for another weekday, the todo is correctly saved to generated dates but the current date can remain empty, making it look like nothing saved.
- Alternative: Always keep the modal date selected and rely on a toast message; this is weaker because the visible list can still look empty.
- Impact: After saving a recurring todo, the user immediately sees one of the created todos.

## Current Status

- Completed: Verified remote Supabase `study_todos` includes `start_time` and `end_time`, and migration `study_todo_time_window` is applied.
- Completed: Fixed schedule formatting to handle Supabase time values such as `09:00:00`.
- Completed: Added todo save focus helper and tests for selected-date and first-generated-date behavior.
- Completed: `node --test apps\web\test\todoRecurrence.test.mjs apps\web\test\todoSchedule.test.mjs`, `npm.cmd test`, `npm.cmd run build`, and `git diff --check` pass locally.
- Completed: Pushed commit `5d0d936` to `origin/main`.
- Completed: GitHub Actions run `27500758093` succeeded.
- Completed: Vercel production deployment `dpl_2x21QLKb9TNXp4NGS8W2j5bybzwN` is `READY` for commit `5d0d936`.
- Completed: `https://study-room-attendance.vercel.app` returns HTTP 200.
- Next: If the user still cannot see saved todos, test the exact selected date, weekday selection, and time values from their browser session.

## Notes

- Supabase advisory reports RLS disabled on unrelated `public.Book` and `public.Review` tables. Do not change them automatically because enabling RLS without policies can block existing access.

## Current Work

- Task: Deploy current web app updates to Vercel.
- Purpose: Push the current Slack/camera/session/todo update set through the GitHub Actions Vercel production pipeline and fix any CI-only failures.
- Related PRD:
  - `memory-bank/prd-recurring-todos.md`
  - `memory-bank/prd-slack-notifications.md`
  - `memory-bank/prd-camera-presence.md`
- Related files:
  - `.github/workflows/vercel-production.yml`
  - `apps/web/src/main.tsx`
  - `apps/web/src/reminderPopup.mjs`
  - `apps/web/test/reminderPopup.test.mjs`
  - `memory-bank/trouble-shooting.md`

## Recent Decisions

- Decision: Use the existing GitHub Actions production workflow for Vercel deployment because local Vercel CLI has no credentials.
- Reason: `npx vercel@48.6.0 deploy --prod --yes` failed with `No existing credentials found`, while repository secrets are available in GitHub Actions.
- Alternative: Add a local `VERCEL_TOKEN` environment variable or run `vercel login`.
- Impact: Deployments from this environment require committing and pushing to `main`, then monitoring the workflow result.

## Current Status

- Completed: Commit `309481c` was pushed to `origin/main`, triggering GitHub Actions run `27500348234`.
- Found: The first workflow run failed during `npm test` because `apps/web/test/reminderPopup.test.mjs` did not pass a fixed `timeZone`, so CI's UTC default made the reminder time comparison fail.
- Completed: Reproduced the failure locally with `TZ=UTC`.
- Completed: Fixed the test to pass `timeZone: "Asia/Tokyo"`.
- Completed: `TZ=UTC node --test apps\web\test\reminderPopup.test.mjs`, `npm.cmd test`, and `npm.cmd run build` pass locally.
- Completed: Commit `9e5b8d3` was pushed to `origin/main`.
- Completed: GitHub Actions run `27500448036` succeeded.
- Completed: Vercel deployment `dpl_AE995CdmFTzXne3qAdGV1fnBRfMz` is `READY` for production and `https://study-room-attendance.vercel.app` returns HTTP 200.
- Next: For future app work, run tests/build, commit, push, and confirm Vercel production deployment as the final step.

## Notes

- Local direct Vercel deploy remains blocked until `VERCEL_TOKEN` is exported or `vercel login` is completed.
- Future work requests should include Vercel production deployment as a final step when the local change is intended for the live app.

## Current Work

- Task: Verify optional todo time, repeat, and weekday selection.
- Purpose: Ensure the todo creation modal supports optional start/end time, optional weekly recurrence, and optional weekday selection without duplicating existing implementation.
- Related PRD:
  - `memory-bank/prd-recurring-todos.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/todoRecurrence.mjs`
  - `apps/web/src/todoSchedule.mjs`
  - `apps/web/test/todoRecurrence.test.mjs`
  - `apps/web/test/todoSchedule.test.mjs`
  - `supabase/migrations/0016_study_todo_time_window.sql`

## Recent Decisions

- Decision: Keep recurrence as materialized `study_todos` rows instead of adding a separate recurrence-rule table for the MVP.
- Reason: The current UI, daily todo display, completion tracking, and notification body can all read dated todo rows directly.
- Alternative: Add a `todo_recurrence_rules` table and generate future todos server-side.
- Impact: A repeated todo creates rows for the selected dates up front, and duplicate prevention is handled by date, normalized title, and optional time range.

## Current Status

- Completed: The todo modal exposes optional `시간 설정` with start/end `time` inputs and stores them as `study_todos.start_time` / `study_todos.end_time`.
- Completed: The todo modal exposes optional `요일 반복`, repeat end date, and weekday selection.
- Completed: Recurrence tests verify inclusive date generation, empty invalid ranges, duplicate filtering, and time-aware duplicate rules.
- Completed: Schedule tests verify disabled schedules save null times, valid ranges normalize, invalid ranges are rejected, and formatted todo labels include time.
- Completed: `npm.cmd test`, `npm.cmd run build`, and `git diff --check` passed.
- Next: Deploy the current web build to Vercel when production needs the updated todo modal UI.

## Notes

- The optional time fields must be both null or both set, and when set `start_time < end_time`.
- The current implementation stores repeated todos as dated rows and does not persist a reusable recurrence rule.

## 현재 작업

- 작업명: 할 일 반복 등록과 선택형 시간 설정
- 작업 목적: 사용자가 캘린더 날짜에서 할 일을 만들 때 하루만 등록하거나 요일 반복으로 여러 날짜에 등록하고, 필요하면 Google Calendar처럼 시작/종료 시간을 선택해 일정형 todo로 볼 수 있게 한다.
- 관련 PRD:
  - `memory-bank/prd-recurring-todos.md`
  - `memory-bank/prd-slack-notifications.md`
- 관련 파일:
  - `apps/web/src/main.tsx`
  - `apps/web/src/todoRecurrence.mjs`
  - `apps/web/src/todoSchedule.mjs`
  - `apps/web/src/styles.css`
  - `supabase/migrations/0016_study_todo_time_window.sql`
  - `supabase/functions/attendance-cron/index.ts`
  - `supabase/functions/slack-test-alarm/index.ts`

## 최근 결정 사항

- 결정: 시간 설정은 선택 옵션으로 두고, 켰을 때만 `start_time`과 `end_time`을 함께 저장한다.
- 이유: 시간 없는 체크리스트와 시간 있는 일정형 todo를 같은 `study_todos` 테이블에서 단순하게 관리하기 위해서다.
- 대안: 별도 일정 테이블이나 반복 규칙 테이블을 만드는 방법이 있었지만, MVP에서는 기존 dated todo row를 유지하는 것이 구현과 알림 연동이 가장 작다.
- 영향 범위: todo 저장 UI, 중복 판단 기준, todo 목록 표시, Slack/WebPush/이메일 알림 본문, `study_todos` schema.

## 현재 상태

- 완료: 할 일 모달에 `시간 없음` / `시간 설정` 토글과 시작/종료 시간 입력을 추가했다.
- 완료: 반복 요일 등록 시 선택한 시간 범위가 모든 생성 날짜에 함께 저장된다.
- 완료: 같은 날짜와 제목이라도 시간 범위가 다르면 별도 todo로 등록할 수 있게 중복 판단을 바꿨다.
- 완료: 오늘 할 일, 알림 팝업, 내 페이지 완료 이력, Slack/WebPush/이메일 알림 본문에 시간 범위를 표시한다.
- 완료: 원격 Supabase 프로젝트 `bqohkdzvxbrokkmuhysx`에 `20260614115454 study_todo_time_window` migration을 적용했다.
- 완료: Supabase Edge Function `attendance-cron` v12, `slack-test-alarm` v2를 ACTIVE로 배포했다.
- 완료: `npm.cmd test`, `npm.cmd run build`가 통과했다.
- 막힌 부분: Vercel production 웹 배포는 이 작업에서 수행하지 않았다.
- 다음 작업: 운영 링크에서 시간 옵션 UI를 보려면 Vercel production 배포가 필요하다.

## 주의할 점

- `start_time`과 `end_time`은 둘 다 null이거나 둘 다 값이 있어야 하며, 값이 있으면 `start_time < end_time`이어야 한다.
- 이 구현은 반복 규칙 자체를 저장하지 않고, 선택한 날짜 범위에 해당하는 `study_todos` row를 미리 생성한다.
- 서버 알림 함수는 배포됐지만, 프론트엔드 UI 변경은 Vercel production 배포 전까지 운영 URL에는 보이지 않을 수 있다.
