# Active Context

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
- In progress: Commit, push, and verify the Vercel production pipeline.
- Blocked: None.
- Next: Verify production availability after push.

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
