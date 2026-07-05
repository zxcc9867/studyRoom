# Active Context

## Current Work

- Task: Notification diagnostics UI and CI production build gate.
- Purpose: Make the settings screen show whether browser push, Slack target storage, and recent notification deliveries are healthy, and prevent Vercel production deploys from skipping the web production build.
- Related PRD:
  - memory-bank/prd-slack-notifications.md
- Related files:
  - .github/workflows/vercel-production.yml
  - apps/web/src/main.tsx
  - apps/web/src/notificationDiagnostics.mjs
  - apps/web/src/notificationDiagnostics.d.mts
  - apps/web/src/styles.css
  - apps/web/test/ciWorkflow.test.mjs
  - apps/web/test/notificationDiagnostics.test.mjs
  - apps/web/test/slackNotifications.test.mjs

## Recent Decisions

- Decision: Keep notification diagnostics read-only and based on already available browser status, saved Slack target status, and the five latest notification_deliveries rows.
- Reason: The user needs to see whether notifications are configured without adding another active notification path or changing server dispatch behavior.
- Alternative: Add a new Edge Function diagnostics endpoint; deferred because Supabase row reads are enough for MVP visibility.
- Impact: The settings screen now has one diagnostics card and keeps Kakao out of the active UI path.

## Current Status

- Completed: Added notification diagnostics helper and regression tests.
- Completed: Settings now fetches recent notification_deliveries and renders browser, Slack, last-delivery, and legacy-channel states.
- Completed: GitHub Actions production workflow now runs npm run build after npm test and before Vercel deploy.
- Completed: npm.cmd test passed 218 tests.
- Completed: npm.cmd run build passed with the existing Vite chunk-size warning.
- Next: Commit, push, and verify Vercel production deployment.

## Notes

- No Supabase schema or Edge Function change is required. The feature reads existing notification_deliveries and notification_targets state.

---

## Current Work

- Task: Todo linking and planner detail editing cleanup.
- Purpose: Make the daily checklist modal checkbox mean schedule-link selection instead of completion, keep all selected-date todos visible while editing, and move edit/delete controls to the planner detail todo list.
- Related PRD:
  - memory-bank/prd-daily-planner-dashboard.md
  - memory-bank/prd-session-todo-links.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/src/styles.css
  - apps/web/test/slackNotifications.test.mjs

## Recent Decisions

- Decision: Keep study_todos as the single data source and allow the same title to be scheduled multiple times on the same date when the time window differs.
- Reason: The user may study the same subject in separate blocks, such as a long Python session and another later Python block.
- Alternative: Add a separate todo template/schedule table; deferred because the current dated-row model already supports multiple timed rows.
- Impact: The schedule-link checkbox inserts a new timed row for the selected todo title instead of overwriting or hiding existing scheduled rows.

## Current Status

- Completed: Added regression coverage for all same-day todos remaining visible in the schedule-link modal.
- Completed: Removed edit/delete actions from the modal link list and added a clear `?? ??` label.
- Completed: Added a planner detail todo list with schedule labels plus row-level edit/delete actions.
- Completed: `npm.cmd test` passed 213 tests.
- Completed: `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Next: Commit, push, and verify Vercel production deployment.

## Notes

- No Supabase schema change is required. This is a frontend state/UI policy change on top of existing study_todos rows.

# Active Context

## Current Work

- Task: Paginate My Page recovery routine history.
- Purpose: Avoid rendering long recovery history lists at once; show five recovery routines per page with previous/next controls.
- Related PRD:
  - memory-bank/prd-slack-recovery-routines.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/src/recoverySummary.mjs
  - apps/web/src/recoverySummary.d.mts
  - apps/web/src/styles.css
  - apps/web/test/recoverySummary.test.mjs
  - apps/web/test/recoveryRoutine.test.mjs

## Recent Decisions

- Decision: Keep all recovery requests sorted newest-first, then paginate the My Page history view in five item pages.
- Reason: The user specifically wants 13 records to be browsed as pages instead of listing every item.
- Alternative: Keep the previous eight-item recent-history slice; rejected because older records were hidden and there was no page navigation.
- Impact: Recovery history now uses `paginateRecoveryHistory()` and displays previous/next controls only when there are more than five records.

## Current Status

- Completed: Added deterministic recovery history pagination helper and type declarations.
- Completed: Added tests for five-item pages and web UI wiring.
- Completed: Updated My Page recovery history to render only the current page.
- Completed: `npm.cmd test` passed 212 tests.
- Completed: `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Next: Commit, push, and verify Vercel production deployment.

## Notes

- No Supabase schema or Edge Function change is required for this pagination-only UI update.

---# Active Context

## Current Work

- Task: Rule-based recovery routine history and weekly Slack summary.
- Purpose: Show recovery routine history and cause summaries without using paid AI APIs, and send a weekly Slack summary after each week ends.
- Related PRD:
  - memory-bank/prd-slack-recovery-routines.md
  - memory-bank/prd-slack-notifications.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/src/recoverySummary.mjs
  - apps/web/test/recoverySummary.test.mjs
  - supabase/functions/attendance-cron/index.ts
  - supabase/functions/_shared/recovery_summary.ts
  - supabase/migrations/20260705090000_recovery_weekly_reports.sql

## Recent Decisions

- Decision: Use deterministic keyword categories instead of AI summarization.
- Reason: The user wants no AI API cost. Keyword categories are predictable, testable, and good enough for the MVP accountability loop.
- Alternative: OpenAI/LLM weekly natural-language summaries; deferred because it adds API cost and secret management.
- Impact: My Page and Slack weekly summary show counts, top cause, and next-action text based on fixed rules such as 수면/피로, 업무/일정, 알림/습관, and 환경/자리 비움.

## Current Status

- Completed: Added recovery summary helper and tests.
- Completed: Added My Page recovery summary/history UI and Today pre-start recovery check card.
- Completed: Added `study_recovery_weekly_reports` with RLS and duplicate-safe one-report-per-user-week storage.
- Completed: Updated `attendance-cron` to send Monday 08:00 local-time weekly Slack recovery summaries for submitted recovery routines.
- Completed: Applied Supabase migration to project `bqohkdzvxbrokkmuhysx`.
- Completed: Deployed `attendance-cron` Edge Function version 25 and verified ACTIVE status.
- Completed: `npm.cmd test` passed 210 tests.
- Completed: `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Next: Commit, push, and verify Vercel production deployment.

## Notes

- Weekly summaries are sent only when submitted recovery routines exist for the previous Monday-Sunday week.
- The weekly Slack summary does not call OpenAI, Anthropic, Gemini, or any other AI API.

---
## Current Work

- Task: Cross-day active session today study timer fix.
- Purpose: Keep the study timer flowing independently from the one-hour session lease countdown when an active session crosses midnight.
- Related PRD:
  - memory-bank/prd-session-activity-heartbeat.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/src/studyTimeSummary.mjs
  - apps/web/test/studyTimeSummary.test.mjs
  - apps/web/test/sessionLease.test.mjs

## Recent Decisions

- Decision: Active session display time is split by local date/month windows instead of checking only study_sessions.local_date.
- Reason: A session that started before midnight can still be actively counting after midnight; today's card must show only the part that overlaps today while the lease countdown remains its own deadline timer.
- Alternative: Reassign the active session local_date after midnight; rejected because the persisted session date should remain the start date and completed duration is still saved when the session ends.
- Impact: Today study and selected-month totals add only the active elapsed segment overlapping their local date/month window.

## Current Status

- Completed: Confirmed the root cause: main.tsx used activeSession.local_date === todayDateKey, so a June 30 active session did not contribute to the July 1 today timer.
- Completed: Added studyTimeSummary helpers and regression tests for same-day, cross-midnight, month split, and clamped windows.
- Completed: Updated dashboard summary calculations to use date/month overlap helpers while leaving session lease countdown logic unchanged.
- Completed: npm.cmd test passed 204 tests.
- Completed: npm.cmd run build passed with the existing Vite chunk-size warning.
- Completed: Commit d162deb2b71286ae35bb59fad9c72328288ea0a3 was pushed to origin/main.
- Completed: GitHub Actions deployment run 28455578261 completed successfully.
- Completed: Vercel deployment dpl_GVKLJAgshZMt678W4WWbTtg4PVZ1 reached READY and production URL returned HTTP 200.

## Notes

- No Supabase schema or Edge Function change is required. The fix is a frontend summary-calculation bug.
- If a live active session crosses midnight, the Today card should show the post-midnight elapsed study time while the session lease card continues to count down from lease_expires_at.

## Current Work

- Task: Sync Slack session lease extension into the open web dashboard.
- Purpose: When the user extends a study-session lease from a Slack button, the already-open app should update the remaining session time without requiring a browser refresh.
- Related PRD:
  - memory-bank/prd-session-activity-heartbeat.md
  - memory-bank/prd-slack-notifications.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/test/sessionLease.test.mjs

## Recent Decisions

- Decision: Poll only the current active study session row every 15 seconds and also refresh on window focus or visibilitychange to visible.
- Reason: Slack interactivity updates Supabase outside the browser, and the static SPA has no push channel for that row. A narrow row refresh is lower risk than reloading the full dashboard repeatedly.
- Alternative: Supabase Realtime subscription for study_sessions; deferred because polling one active row is enough for this MVP and avoids adding a realtime lifecycle path.
- Impact: `lease_expires_at` changes made by Slack `extend_study_session_lease` are reflected in `studySessions`, which then updates the existing session lease countdown.

## Current Status

- Completed: Confirmed root cause from source: in-app lease extension updated local state, Slack extension updated only the server row.
- Completed: Added RED regression coverage for externally changed active-session lease deadlines.
- Completed: Added open-dashboard active-session lease refresh every 15 seconds plus focus/visible refresh.
- Completed: `node --test apps\web\test\sessionLease.test.mjs` passed 9 tests.
- Completed: `npm.cmd test` passed 200 tests.
- Completed: `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Next: Commit, push, and verify Vercel production deployment.

## Notes

- No Supabase schema or Edge Function change is required. Slack already updates `study_sessions.lease_expires_at`; the missing piece was frontend state synchronization.
- The fix does not make Slack extension instantaneous push. It updates within the next 15-second poll, or immediately when the browser window gains focus / becomes visible.

## Current Work

- Task: Stale active session cleanup after manual End.
- Purpose: Fix the case where the user presses End, Supabase reports `Active study session not found`, but the browser keeps a stale active session that leaves the End button enabled and keeps the monthly timer moving.
- Related PRD:
  - memory-bank/prd-session-activity-heartbeat.md
  - memory-bank/prd-session-todo-links.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/src/sessionEnd.mjs
  - apps/web/test/sessionEnd.test.mjs
  - apps/web/test/sessionActivity.test.mjs

## Recent Decisions

- Decision: Treat `Active study session not found` from `end_study_session` as a stale local active-session state, not as a user-blocking failure.
- Reason: The DB session is already no longer active, so leaving local `studySessions` unchanged is what keeps the lease UI, End button, and monthly active elapsed seconds alive.
- Impact: `endTimer()` now guards duplicate end requests per session, captures the ending session id before awaiting RPC, clears local lease/activity/camera intent for stale-not-found responses, closes the completion modal state, and reloads dashboard data.

## Current Status

- Completed: Added RED regression coverage for stale active-session end errors.
- Completed: Added `sessionEnd.mjs` helper and wired stale end cleanup in `endTimer()`.
- Completed: `npm.cmd test` passed 199 tests.
- Completed: `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Next: Commit, push, and verify Vercel production deployment.

## Notes

- No Supabase schema change is required. This is a frontend stale-state handling fix around the existing `end_study_session` RPC.

## Current Work

- Task: Selected-date planner and multi-date plan copy.
- Purpose: Let the Today Tasks planner inspect and edit not only today, but also yesterday, tomorrow, or any selected calendar date, and apply the same selected-date plan to multiple calendar dates at once.
- Related PRD:
  - memory-bank/prd-daily-planner-dashboard.md
  - memory-bank/prd-recurring-todos.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/src/plannerDate.mjs
  - apps/web/test/plannerDate.test.mjs
  - apps/web/test/slackNotifications.test.mjs

## Recent Decisions

- Decision: Keep `study_todos.local_date` as the source of truth and drive the planner from `selectedTodoDate` instead of only `todayDateKey`.
- Reason: The attendance calendar already exposes per-date todo counts, so the least disruptive path is to let date selection change the planner data source while preserving the existing todo modal and Supabase Data API path.
- Impact: Clicking a calendar date now changes the visible planner date. The todo modal still edits the selected date, and the new copy modal creates duplicate-safe single-date rows for selected target dates.

## Current Status

- Completed: Added planner-date helper tests for label normalization, multi-date target normalization, and duplicate-safe copy-row construction.
- Completed: Added source-level regression coverage that verifies planner state follows `selectedTodoDate` and invokes `buildPlanCopyRows`.
- Completed: Updated the Today Tasks card with date shortcuts, a date input, and a multi-date apply modal.
- Completed: `npm.cmd test` passed 197 tests and `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Completed: Committed feature commit `2a28bdb0a6caea11bdb1edaa74fcbd436fc56bd4`, pushed to `origin/main`, and verified GitHub Actions production deploy run `28327080831` completed successfully.
- Completed: Production URL `https://study-room-attendance.vercel.app/` returned HTTP 200 and served the new Vite asset `assets/index-DiCFa9HK.js`.
- Next: Production smoke-test the selected-date planner and multi-date copy flow in the browser.

## Notes

- No Supabase schema change is required. Multi-date apply inserts additional `study_todos` rows and clears repeat metadata so copied plans behave as explicit one-day schedules.

## Current Work

- Task: Daily planner direct todo completion outside active sessions.
- Purpose: Let users mark selected planner todos and untimed planner todos complete from the Today task area when no study session is active.
- Related PRD:
  - memory-bank/prd-daily-planner-dashboard.md
  - memory-bank/prd-session-todo-links.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/test/slackNotifications.test.mjs
  - docs/superpowers/plans/2026-06-28-daily-planner-completion.md

## Recent Decisions

- Decision: Direct completion is allowed only when there is no active study session.
- Reason: During an active study session, completion must still be captured by the End-session completion modal so the session-to-todo record remains accurate.
- Impact: The planner detail panel now shows a completion toggle, and untimed planner/list checkboxes toggle completion outside sessions. During active sessions, these controls are disabled and point users to the End flow.

## Current Status

- Completed: Added regression tests for planner detail completion and untimed planner todo checkboxes.
- Completed: Reused setTodosCompleted() for direct completion toggles.
- Completed: npm.cmd test passed 193 tests.
- Completed: npm.cmd run build passed with the existing Vite chunk-size warning.
- Next: Commit, push, and verify Vercel production deployment.

## Notes

- No Supabase schema change is required. The feature reuses study_todos.is_completed and the existing authenticated update path.
## Current Work

- Task: Reschedule Slack todo reminders after timed todo schedule changes.
- Purpose: When a timed todo is moved or extended, future Slack start/end-soon reminder locks for the changed todo must be cleared so the next cron run uses the current schedule time.
- Related PRD:
  - memory-bank/prd-slack-notifications.md
  - memory-bank/prd-daily-planner-dashboard.md
- Related files:
  - supabase/migrations/20260628174500_clear_future_todo_schedule_deliveries.sql
  - packages/core/test/sql-migrations.test.mjs

## Recent Decisions

- Decision: Keep reminder dispatch as computed-on-cron from current study_todos, but add a DB trigger to invalidate future study_todo_schedule_deliveries rows whenever start_time, end_time, or is_completed changes.
- Reason: Reminder duplicate locks include scheduled_at, but stale future locks can still block or confuse rescheduled alerts when a todo moves away and back to a previously locked time.
- Impact: Schedule edits from the web app and schedule shifts from Slack extension both clear future locks for changed rows. Already-sent past reminders remain historical records.

## Current Status

- Completed: Added RED SQL migration test for future schedule-delivery invalidation.
- Completed: Added migration 20260628174500_clear_future_todo_schedule_deliveries.sql.
- Completed: Applied the SQL to Supabase project bqohkdzvxbrokkmuhysx through npx supabase db query --linked --file because MCP auth was expired and db push was blocked by remote migration-history mismatch.
- Completed: Remote verification returned function_exists=true and trigger_exists=true.
- Completed: npm.cmd test passed 191 tests.
- Completed: npm.cmd run build passed with the existing Vite chunk-size warning.
- Next: Commit, push, and confirm Vercel production workflow if required.

## Notes

- A reminder that was already sent before a schedule change cannot be unsent. The fix affects future reminders after the schedule row changes.

## Current Work

- Task: Separate todo scheduling selection from todo completion.
- Purpose: In the daily todo modal, checking an existing todo should load or apply the configured schedule time to that todo instead of marking it complete. Actual completion should happen when the user ends a study session.
- Related PRD:
  - `memory-bank/prd-daily-planner-dashboard.md`
  - `memory-bank/prd-session-todo-links.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/sessionTodoLinks.mjs`
  - `apps/web/src/sessionTodoLinks.d.mts`
  - `apps/web/test/sessionTodoLinks.test.mjs`
  - `apps/web/test/slackNotifications.test.mjs`

## Recent Decisions

- Decision: Keep `study_todos` as the single source for scheduled and unscheduled tasks, but make the calendar/todo modal checkbox mean "schedule this existing task with the current time fields".
- Reason: The user wants to bring existing todos into the schedule without accidentally completing them.
- Decision: Move completion to an end-session modal.
- Reason: The user wants completion to be recorded only after pressing the session End button and choosing which today's tasks were actually completed.
- Impact: Daily checklist and active session task checkboxes are read-only for completion during the session; completion is batched when ending the session.

## Current Status

- Completed: Added tests for end-session completion candidates, schedule-modal checkbox behavior, and the End button opening a completion modal.
- Completed: Added `getEndSessionCompletionCandidates()` so session-linked incomplete todos appear first, followed by other incomplete today todos.
- Completed: Updated the web UI so existing todo checkboxes in the date modal apply schedule times or open edit mode, not completion.
- Completed: Updated the End button to open a completion modal before calling `endTimer()`.
- Completed: `npm.cmd test` passed 190 tests.
- Completed: `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Completed: Committed and pushed application commit `903296d` to `origin/main`.
- Completed: Vercel production deployment `dpl_7vUrWPLW3K1oGJ1BSYmW1zL1TcVZ` is `READY` for commit `903296d95c700f9795868515d10d2b1a5588cfd8`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200 from Vercel.
- Next: Production smoke-test the schedule-existing-todo and end-session completion flow while logged in.

## Notes

- No Supabase schema change is required. The change reuses `study_todos.start_time`, `study_todos.end_time`, and existing `study_session_todos.completed_during_session`.

## Current Work

- Task: Shift selected todo when extending a Slack schedule reminder.
- Purpose: A Slack `5/10 minute extension` should move the selected todo's whole time window, not only its end time. Example: `18:45-19:45 + 10` becomes `18:55-19:55`.
- Related PRD:
  - `memory-bank/prd-slack-notifications.md`
- Related files:
  - `supabase/migrations/20260628102000_shift_selected_todo_schedule.sql`
  - `supabase/migrations/20260628064614_study_todo_schedule_reminders.sql`
  - `packages/core/test/sql-migrations.test.mjs`

## Recent Decisions

- Decision: Keep using the existing `extend_todo_schedule` RPC and replace its implementation with a new migration.
- Reason: Slack buttons already call this RPC through `slack-recovery-interactions`; changing the RPC fixes current Slack interactions without changing the Slack App Interactivity URL.
- Decision: Duplicate prevention continues to key schedule reminders by `(todo_id, target_id, reminder_type, scheduled_at)`.
- Reason: Once start/end times are shifted, the new `scheduled_at` value is different, so the next start or 5-minute-before-end reminder can be sent at the updated time.

## Current Status

- Completed: Added a regression test proving the selected todo start time must shift with its end time.
- Completed: Added and remotely applied `20260628102000_shift_selected_todo_schedule.sql` to Supabase project `bqohkdzvxbrokkmuhysx`.
- Completed: Remote verification confirmed the old fixed-start branch is absent and the shifted start assignment exists.
- Completed: `npm.cmd test`, `npm.cmd run build`, and `git diff --check` passed.
- Completed: Committed and pushed `615a3be` to `origin/main`.
- Completed: Vercel production deployment `dpl_9xWy7RSnUGgTKMPhZWGAQ4bZbpNh` is `READY` and `https://study-room-attendance.vercel.app/` returned HTTP 200.
- Next: Live Slack smoke test if the user wants to confirm the shifted schedule in their account.

## Notes

- No Edge Function redeploy is required for this fix because the already deployed Slack interactivity function calls `extend_todo_schedule` dynamically.
- Completed todos remain excluded from extension and reminder processing.
## Current Work

- Task: Slack schedule extension from timed todo reminders.
- Purpose: Let a user extend a timed todo from Slack by 5 minutes, 10 minutes, or a custom 1-120 minute value, then move every later incomplete timed todo on the same local date by the same amount.
- Related PRD:
  - `memory-bank/prd-slack-notifications.md`
  - `memory-bank/prd-daily-planner-dashboard.md`
- Related files:
  - `supabase/migrations/20260628080450_extend_todo_schedule.sql`
  - `supabase/functions/attendance-cron/index.ts`
  - `supabase/functions/slack-recovery-interactions/index.ts`
  - `packages/core/test/sql-migrations.test.mjs`

## Recent Decisions

- Decision: Use the existing `slack-recovery-interactions` Edge Function as the Slack Interactivity router instead of adding a second request URL.
- Reason: Slack Apps have one Interactivity Request URL; replacing it with a schedule-only endpoint would break recovery routine buttons.
- Decision: Extension shifts all later same-day incomplete timed todos together. Completed todos are never shifted or extended.
- Decision: Preset buttons use 5 and 10 minutes; custom input accepts 1-120 minutes through a Slack modal.

## Current Status

- Completed: Added TDD coverage for `extend_todo_schedule` and Slack schedule extension actions.
- Completed: Added `extend_todo_schedule(p_todo_id, p_extension_minutes)` migration locally.
- Completed: Added Slack Block Kit extension buttons to timed todo schedule reminder messages.
- Completed: Extended the existing Slack interactivity Edge Function to handle schedule extension buttons and custom modal submissions.
- Completed: Full local verification passed, Supabase migration was applied, and `attendance-cron`/`slack-recovery-interactions` were deployed to production Supabase.
- Completed: GitHub push and Vercel production deployment verification are complete.
- Next: Monitor a real Slack schedule extension interaction if the user wants a live receipt test.

## Notes

- The Slack App Interactivity URL should continue pointing at `/functions/v1/slack-recovery-interactions`.
- If a user extends a schedule after an earlier reminder was already sent, the shifted time can create a new future reminder because duplicate locks include `scheduled_at`.

## Current Work

- Task: Send Slack reminders for timed daily planner todos.
- Purpose: When a `study_todos` row has `start_time` and `end_time`, Supabase Cron should send Slack at the todo start time and 5 minutes before the todo end time, even if the browser or computer is closed.
- Related PRD:
  - `memory-bank/prd-slack-notifications.md`
  - `memory-bank/prd-daily-planner-dashboard.md`
- Related files:
  - `supabase/migrations/20260628064614_study_todo_schedule_reminders.sql`
  - `supabase/functions/attendance-cron/index.ts`
  - `packages/core/test/sql-migrations.test.mjs`

## Recent Decisions

- Decision: Extend the existing 1-minute Supabase Cron -> `attendance-cron` path instead of creating a second cron function.
- Reason: The app already has a server-side scheduler, Slack Bot API path, and per-user `notification_targets.kind = 'slack'` target model.
- Alternative: A separate `todo-schedule-cron` Edge Function; rejected for this MVP because it adds another scheduled job without a clear operational benefit.
- Impact: `attendance-cron` now calls `get_due_todo_schedule_reminders()` and records duplicate-safe locks in `study_todo_schedule_deliveries` before sending Slack.

## Current Status

- Completed: Added `study_todo_schedule_deliveries` with RLS, unique duplicate protection, and status/error tracking.
- Completed: Added `get_due_todo_schedule_reminders(p_now)` to select incomplete timed todos due for `start` or `end_soon` reminders.
- Completed: Updated `attendance-cron` to send readable Slack messages for schedule start and 5-minute end warnings.
- Completed: Applied the migration to remote Supabase project `bqohkdzvxbrokkmuhysx`.
- Completed: Deployed `attendance-cron` version 22 with `verify_jwt=false`; function is `ACTIVE` and protected by `x-cron-secret` internally.
- Completed: `npm.cmd test` and `npm.cmd run build` passed.
- Next: Commit, push, and confirm deployment pipeline if required by repository policy.

## Notes

- Completed todos are excluded from schedule reminders.
- End-soon reminders are skipped for schedules shorter than 5 minutes so a todo is not warned before it starts.
- Slack delivery still requires a saved enabled Slack Channel ID for the current Supabase user and a valid Slack bot token secret.
## Current Work

- Task: Separate login session persistence from counted study time after browser or computer close.
- Purpose: Keep Supabase auth logged in for the existing 2-hour app flow, while excluding time when an active study session was not actually running in an open browser.
- Related PRD:
  - memory-bank/prd-session-activity-heartbeat.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/src/sessionActivity.mjs
  - apps/web/src/sessionActivity.d.mts
  - apps/web/test/sessionActivity.test.mjs

## Recent Decisions

- Decision: Add a client-side study-session activity heartbeat in localStorage instead of changing Supabase Auth persistence.
- Reason: The user wants login persistence and study-time counting to be separate. Auth state should remain, but stale active sessions should stop adding closed-browser time.
- Alternative: End on pagehide/beforeunload; rejected again because refresh and tab switching cannot be reliably distinguished and previous work intentionally removed that behavior.
- Impact: Active sessions write a per-user/per-session activity timestamp every 15 seconds. If the app later restores that session and the timestamp is stale by more than 5 minutes, the app ends the session and passes the inactive gap as excluded seconds.

## Current Status

- Completed: Added sessionActivity helper and tests.
- Completed: Wired active sessions to persist heartbeat, refresh it on visible tab return, and clear it on session end.
- Completed: Reconnection with a stale heartbeat now ends the active session and excludes inactive time from saved duration.
- Completed: npm.cmd test and npm.cmd run build passed.
- Next: Commit, push, and verify Vercel production deployment.

## Notes

- This is a same-browser client heartbeat. Cross-device/server-enforced cleanup would require a future DB heartbeat or scheduled stale-session cleanup.


# Active Context

## Current Work

- Task: Scope the todo edit modal checklist to the edited item.
- Purpose: When the user opens a todo from the planner/checklist for editing, the modal should not show unrelated same-day todos such as other schedules below the edit form.
- Related PRD:
  - memory-bank/prd-recurring-todos.md
  - memory-bank/prd-daily-planner-dashboard.md
- Related files:
  - apps/web/src/main.tsx
  - apps/web/test/slackNotifications.test.mjs

## Recent Decisions

- Decision: Keep the existing date checklist modal, but derive visibleTodoModalItems from editingTodo when edit mode is active.
- Reason: The current modal combines create/edit fields with the selected date's full checklist. In edit mode this made the user think unrelated todos were part of the edited item.
- Alternative: Build a separate edit-only modal. Deferred because the requested fix is the confusing extra list, not a wider modal redesign.
- Impact: Create mode still shows all todos for the selected date. Edit mode shows only the edited todo and its per-item completion summary.

## Current Status

- Completed: Added a source-level regression test for edit-modal checklist scoping.
- Completed: Updated main.tsx to render visibleTodoModalItems instead of selectedDateTodos in the modal list.
- Completed: Targeted test apps/web/test/slackNotifications.test.mjs passes.

## Notes

- A PowerShell rewrite attempt briefly corrupted Korean text while editing; the affected files were restored from HEAD before reapplying the minimal UTF-8-safe changes.


# Active Context

## Current Work

- Task: Resume study start after in-app recovery unlock.
- Purpose: When the user clicks `입장하고 시작`, gets blocked by a pending recovery routine, submits the in-app recovery form, the modal should close and the original study-start flow should continue automatically.
- Related PRD:
  - `memory-bank/prd-slack-recovery-routines.md`
  - `memory-bank/prd-session-todo-links.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/recoveryStartResume.mjs`
  - `apps/web/src/recoveryStartResume.d.mts`
  - `apps/web/test/recoveryStartResume.test.mjs`

## Recent Decisions

- Decision: Store a short-lived `resumeStartAfterRecoveryUnlock` flag only when `startTimer()` is blocked by pending recovery.
- Reason: Submitting a recovery modal opened automatically after login should only unlock the app, while submitting a recovery modal opened from a blocked start should resume the user's original start intent.
- Alternative: Always start a session after any recovery submission; rejected because some recovery submissions happen during login or manual cleanup without an explicit start action.
- Impact: After the last pending recovery request is submitted, the app reloads dashboard data, closes the recovery modal, and resumes the normal start flow. Camera and session-todo gates still run as usual.

## Current Status

- Completed: Added `shouldResumeStartAfterRecoveryUnlock()` helper and regression tests.
- Completed: Wired `startTimer()` to remember when recovery blocked a user-initiated start.
- Completed: Wired a React effect to resume `startTimer()` only after no blocking recovery remains, the modal is closed, no active session exists, and dashboard refresh is done.
- Completed: `node --test apps\web\test\recoveryStartResume.test.mjs` passed.
- Completed: Related recovery/session/slack tests passed.
- Completed: `npm.cmd test` passed 173 tests.
- Completed: `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Next: Commit, push, and verify the Vercel production deployment.

## Notes

- Closing the recovery modal manually clears the pending auto-start intent, so `나중에` remains a real postpone action.
- The resumed start still respects camera-required and session-todo selection gates.

## Current Work

- Task: Recovery pledge should not become a todo.
- Purpose: Keep the final recovery-routine pledge field as a promise/note so phrases like `9시에 시작` do not appear in the session todo picker or daily task list.
- Related PRD:
  - `memory-bank/prd-slack-recovery-routines.md`
  - `memory-bank/prd-slack-notifications.md`
- Related files:
  - `supabase/functions/slack-recovery-interactions/index.ts`
  - `supabase/migrations/20260625115531_recovery_pledge_note_only.sql`
  - `apps/web/test/recoveryRoutine.test.mjs`
  - `packages/core/test/sql-migrations.test.mjs`
  - `memory-bank/implementation-plan.md`

## Recent Decisions

- Decision: Keep `pledge_todo_title` as required recovery-request text, but stop creating a `study_todos` row or `pledge_todo_id` for it.
- Reason: The field is a next-day commitment, not an actionable todo item to select for a focus session.
- Alternative: Keep creating tomorrow's pledge todo and rely on the user to delete it; rejected because it pollutes the todo list with appointment-style promises.
- Impact: Recovery submission still blocks/unblocks study as before, but new submissions create only one makeup todo.

## Current Status

- Completed: Added RED regression coverage showing pledge must be stored without todo creation.
- Completed: Added migration `20260625115531_recovery_pledge_note_only.sql`.
- Completed: Updated Slack recovery submission to create only the makeup todo and set `pledge_todo_id: null`.
- Completed: Updated recovery PRDs and implementation notes to remove the old pledge-todo requirement.
- Completed: Applied the RPC change to Supabase project `bqohkdzvxbrokkmuhysx` with MCP SQL and verified the remote function no longer inserts a next-day pledge todo.
- Completed: Deployed `slack-recovery-interactions` version 5 with `verify_jwt=false`; a live unsigned POST returned HTTP 401.
- Completed: `npm.cmd test` passed 170 tests and `npm.cmd run build` passed with the existing Vite chunk-size warning.
- Completed: Committed and pushed `4c56b67b608ad08b6b9ec1bae0730695e34bba9b` to `origin/main`.
- Completed: Vercel production deployment `dpl_Fsy5Nkqveewz14dJCcPtwyw36Apk` is `READY` for commit `4c56b67b608ad08b6b9ec1bae0730695e34bba9b`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200 from Vercel.
- Next: Manually submit a real recovery routine with a pledge such as `9시에 시작` to confirm no next-day todo row appears in the user account.

## Notes

- Existing pledge todos already created by older recovery submissions are not automatically deleted by this change.

## Current Work

- Task: Forever recurring todos and repeat-group deletion.
- Purpose: Let the user create weekday-repeat todos without choosing an end date and remove all generated dates for a repeated task such as `회사` from one delete action.
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
  - `supabase/migrations/20260623143000_study_todo_repeat_forever.sql`

## Recent Decisions

- Decision: Keep the materialized `study_todos` model and represent no-end weekly repeats with `repeat_forever = true`.
- Reason: The current app, reminders, planner, history, and session todo selection all read dated `study_todos` rows directly.
- Alternative: Add a separate recurrence-rule table now; rejected for this change because it would require broader query, reminder, and UI rewiring.
- Impact: The web app creates a rolling one-year set of rows for forever repeats and stores them in one repeat group. The row metadata has no `repeat_until`, so the UI labels the group as `영구 반복`.

- Decision: Deleting a repeated todo asks whether to delete the whole repeat group.
- Reason: A task such as `회사` should be removable from every generated date, not only the clicked calendar date.
- Alternative: Always delete only one row; rejected because it leaves many unwanted generated rows behind.
- Impact: Confirming the delete removes every row with the same `repeat_group_id`; cancelling removes only the selected date.

## Current Status

- Completed: Added `repeat_forever` to local and remote `study_todos`.
- Completed: Replaced `study_todos_repeat_consistency_check` so weekly rows may have either `repeat_until` or `repeat_forever = true`.
- Completed: Added `영구 반복` UI in the todo modal.
- Completed: Added one-year rolling generation for no-end weekly repeats.
- Completed: Added repeat-group delete behavior.
- Completed: `npm.cmd test` passed 169 tests.
- Completed: `npm.cmd run build` passed.
- Completed: Supabase project `bqohkdzvxbrokkmuhysx` shows migration `20260623134937 study_todo_repeat_forever`.
- In progress: Commit, push, and verify Vercel production deployment.

## Notes

- This is still a materialized-row MVP, not a recurrence-rule engine. Forever repeats generate rows one year ahead and are marked with `repeat_forever`.
- The local `npx.cmd supabase migration new study_todo_repeat_forever` attempt timed out, so the migration file was created manually and applied through Supabase MCP.

## Current Work

- Task: Daily planner task view and Today dashboard order personalization.
- Purpose: Let the user view today's timed todos as an Animal Crossing-style circular life planner and customize the order of Today sections.
- Related PRD:
  - `memory-bank/prd-daily-planner-dashboard.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/src/dailyPlanner.mjs`
  - `apps/web/src/dailyPlanner.d.mts`
  - `apps/web/test/dailyPlanner.test.mjs`
  - `apps/web/src/dashboardLayout.mjs`
  - `apps/web/src/dashboardLayout.d.mts`
  - `apps/web/test/dashboardLayout.test.mjs`
  - `packages/core/test/sql-migrations.test.mjs`
  - `supabase/migrations/20260623131001_dashboard_planner_preferences.sql`

## Recent Decisions

- Decision: Reuse existing `study_todos` for the circular planner instead of introducing a new schedule table.
- Reason: The app already stores dated todos with optional start/end times, repeat metadata, completion state, and goal links.
- Alternative: Create a separate daily schedule table; rejected because it would duplicate todo state and complicate reminders.
- Impact: Checklist and planner stay in sync automatically because both render the same todo rows.

- Decision: Store user UI preferences on `profiles`.
- Reason: `profiles` is already user-scoped and loaded at dashboard startup.
- Alternative: Store preferences only in localStorage; rejected because the user wants the setting to survive next login and device changes.
- Impact: Migration adds `today_task_view` and `today_section_order` with constraints.

## Current Status

- Completed: Added RED tests for planner math, task view normalization, section order normalization, and profile migration coverage.
- Completed: Added `dailyPlanner.mjs` and `dashboardLayout.mjs`.
- Completed: Wired the Today task card to switch between checklist and circular planner views.
- Completed: Added planner click-to-create and segment click-to-edit using the existing todo modal.
- Completed: Added task view pinning through `profiles.today_task_view`.
- Completed: Added Today section order editor with drag-and-drop and up/down buttons, saved through `profiles.today_section_order`.
- Completed: `node --test apps\web\test\dailyPlanner.test.mjs apps\web\test\dashboardLayout.test.mjs apps\web\test\cameraPresence.test.mjs packages\core\test\sql-migrations.test.mjs` passed.
- Completed: `npm.cmd test` passed 167 tests.
- Completed: `npm.cmd --workspace apps/web run build` passed.
- Completed: Applied Supabase migration `dashboard_planner_preferences` to project `bqohkdzvxbrokkmuhysx`; remote migration list shows version `20260623132728`.
- Completed: Committed and pushed feature commit `c08f06dd3a533b457ea74325886f68b34c705685` to `origin/main`.
- Completed: Vercel production deployment `dpl_78NJgmwGrS1fezbevW2bNR2MEcw2` is `READY` for commit `c08f06dd3a533b457ea74325886f68b34c705685`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200 and served `assets/index-BzeR6gEr.js`.

## Notes

- Existing source tests expect the literal `className="daily-visual"` and `className="today-task-panel"` strings, so section ordering is applied with inline `style.order` while preserving those class names.

## Current Work

- Task: Hard block pending recovery routines.
- Purpose: Align the web app and Supabase RPC with the Slack recovery message so users cannot keep studying while any recovery routine is pending.
- Related PRD:
  - `memory-bank/prd-slack-recovery-routines.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/test/recoveryRoutine.test.mjs`
  - `apps/web/test/slackNotifications.test.mjs`
  - `packages/core/test/sql-migrations.test.mjs`
  - `supabase/migrations/20260623123718_hard_block_pending_recovery_requests.sql`

## Recent Decisions

- Decision: Same-day `missed_attendance` recovery requests are no longer soft late-study actions.
- Reason: Slack tells the user that recovery must be submitted before the next study session, and the latest user report showed that allowing study to continue undermines the forced-attendance loop.
- Alternative: Keep late-study recovery as a soft path; rejected because it contradicts the recovery routine consequence.
- Impact: Every pending recovery request blocks `start_study_session()`, disables the web start button, and ends an already-active web session when detected.

## Current Status

- Completed: Added migration `20260623123718_hard_block_pending_recovery_requests.sql`.
- Completed: Applied the migration to Supabase project `bqohkdzvxbrokkmuhysx`.
- Completed: Verified remote `start_study_session()` checks pending recovery and no longer has the same-day missed exception.
- Completed: Updated web UI and tests for hard-block recovery behavior.
- Completed: `npm.cmd test` passed 157 tests and `npm.cmd run build` passed.
- Completed: Committed and pushed `b38118518c2ee8942a0eaded97087c0b79126cd9` to `origin/main`.
- Completed: Vercel production deployment `dpl_G83faqJ6ppEGU2grthT3TtTJUd7j` is `READY` for commit `b38118518c2ee8942a0eaded97087c0b79126cd9`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200 and served `assets/index-DzLaOTTB.js`.
- Next: Refresh existing browser tabs before testing the recovery blocker because already-open tabs may still run older JS.

## Notes

- Existing active browser tabs may need a refresh to load the new auto-end behavior.

## Current Work

- Task: Quick-add todos from the session planning modal.
- Purpose: Let the user start a focused session even when they forgot to pre-register today's schedule by adding a plain today todo directly inside the session selection modal.
- Related PRD:
  - `memory-bank/prd-session-todo-links.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/src/sessionTodoLinks.mjs`
  - `apps/web/src/sessionTodoLinks.d.mts`
  - `apps/web/test/sessionTodoLinks.test.mjs`

## Recent Decisions

- Decision: Reuse the existing `study_todos` table and session selection modal instead of opening the calendar todo modal when no incomplete todo exists.
- Reason: The user is already in the session-start flow and needs the smallest possible path to create a plan and start studying.
- Alternative: Keep redirecting to the full calendar todo modal; rejected because it makes starting a session depend on pre-registration and extra navigation.
- Impact: A quick-added todo is saved for today's local date with no time or recurrence metadata, linked to the active goal when one exists, and selected automatically for the pending session.

## Current Status

- Completed: Added quick-add state and UI to the session planning modal.
- Completed: Changed the no-todos start gate to open the session planning modal instead of the calendar todo modal.
- Completed: Added helper coverage for quick-add title normalization and start-button disabling while saving.
- Completed: `node --test apps\web\test\sessionTodoLinks.test.mjs`, `npm.cmd test`, and `npm.cmd run build` passed.
- Completed: Committed and pushed `902724e82a83c3c86e1496e851282f41152635a9` to `origin/main`.
- Completed: Vercel production deployment `dpl_7f1F9ZJsgYFJDHEuXrCmjHPy1d1B` is `READY` for commit `902724e82a83c3c86e1496e851282f41152635a9`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200 and served asset `assets/index-HNuTwUZy.js`.
- Next: Production smoke-test the session modal quick-add flow with a logged-in account.

## Notes

- This change does not require a Supabase schema migration. Quick-added session todos are ordinary `study_todos` rows for `todayDateKey`.
- Existing full todo scheduling, time, weekday repeat, and recurrence editing remain in the calendar todo modal.

## Current Work

- Task: Link study sessions to selected todos.
- Purpose: Prevent timer-only study sessions by requiring the user to select at least one incomplete daily todo before starting a new focused session.
- Related PRD:
  - `memory-bank/prd-session-todo-links.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/src/sessionTodoLinks.mjs`
  - `apps/web/src/sessionTodoLinks.d.mts`
  - `apps/web/test/sessionTodoLinks.test.mjs`
  - `packages/core/test/sql-migrations.test.mjs`
  - `supabase/migrations/20260621083000_study_session_todo_links.sql`

## Recent Decisions

- Decision: Add a separate `study_session_todos` link table instead of storing todo ids directly on `study_sessions`.
- Reason: One session can include multiple todos and one todo may need reliable user-scoped ownership checks.
- Alternative: Store a JSON array of todo ids on the session row; rejected because it would weaken FK/RLS checks and make future history queries harder.
- Impact: New sessions require a selected todo plan, active sessions show a dedicated session task list, and refreshes can restore the linked task list from Supabase.

## Current Status

- Completed: Added TDD coverage for session todo selection, link row construction, active-session linked todo lookup, and end-summary text.
- Completed: Added `study_session_todos` migration with user-scoped composite foreign keys, RLS policies, indexes, and explicit authenticated grants.
- Completed: Applied the migration to Supabase project `bqohkdzvxbrokkmuhysx` and verified RLS, grants, and 4 policies.
- Completed: Added web UI for selecting session todos before start and showing active session tasks.
- Completed: `npm.cmd test` and `npm.cmd run build` passed.
- Completed: Committed and pushed `2dd1fc37de7b74529db28537863f5293698eca4e` to `origin/main`.
- Completed: Vercel production deployment `dpl_A64oVi2NBr7bKUynwQbRSFKxiueo` is `READY` for commit `2dd1fc37de7b74529db28537863f5293698eca4e`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200.
- Next: Production smoke-test the session todo selection flow with a logged-in account.

## Notes

- The selection modal is shown after recovery and camera checks. If no incomplete todo exists for today, the app opens today's todo modal instead.
- If the user enabled the camera only for a pending start and then closes the todo-selection modal, camera monitoring is stopped without creating a camera event.

## Current Work

- Task: Auto-dismiss success status messages.
- Purpose: Prevent success banners such as `목표를 만들었습니다.` from staying visible indefinitely after the action has completed.
- Related PRD:
  - `memory-bank/prd-study-goals.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/appMessage.mjs`
  - `apps/web/src/appMessage.d.mts`
  - `apps/web/test/appMessage.test.mjs`

## Recent Decisions

- Decision: Auto-dismiss only success-style status messages after 5 seconds while keeping validation, permission, and failure messages visible.
- Reason: Success banners are transient feedback, but error and required-action messages may need to remain available until the user acts.
- Alternative: Clear every message after a timeout; rejected because it can hide important login, permission, or setup guidance.
- Impact: Goal creation success no longer leaves a permanent message banner on the dashboard.

## Current Status

- Completed: Added an `appMessage` helper that classifies auto-dismissable success messages.
- Completed: Wired the dashboard `message` state to clear success messages with cleanup.
- Completed: `node --test apps\web\test\appMessage.test.mjs`, `npm.cmd test`, and `npm.cmd run build` passed.
- In progress: Commit, push, and verify Vercel production deployment.
- Next: Verify production responds after deployment.

## Notes

- This is a frontend state cleanup fix. No Supabase schema or Edge Function change is required.

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
- Completed: Committed and pushed `7904f7071d25cad285928ba48235208f2985a760`.
- Completed: Vercel production deployment `dpl_85PvEfUeYkJL42QJKUi3FcpUeEFR` is `READY` for commit `7904f7071d25cad285928ba48235208f2985a760`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200.
- Next: Visually verify the simplified goal card with a logged-in browser session.

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
- Blocked: GitHub push failed because the environment cannot connect to `github.com:443`.
- Blocked: Direct Vercel CLI deploy failed because there is no `VERCEL_TOKEN` in the shell and no local Vercel login session.
- Next: Push local commit `9974e2e` when GitHub network access is available, or provide `VERCEL_TOKEN`/Vercel login for direct production deploy.

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

- Decision: Keep Slack recovery buttons, but add an authenticated in-app fallback modal that submits the same reason, makeup task, and pledge fields.
- Reason: The user wants Slack submission and direct URL submission to both unblock study, and Slack interactivity can fail due to Signing Secret or Slack app configuration.
- Alternative: Force the user to fix Slack before any recovery; rejected because it can permanently block study when Slack is misconfigured.
- Impact: Pending recovery requests still block study start, but the app now gives the logged-in user a first-party way to submit the recovery routine, create the makeup todo, and store the pledge.

## Current Status

- Completed: Added web modal state, auto-open behavior for pending recovery requests, manual `회복 루틴 작성` buttons, and RPC submission from the app.
- Completed: Added `submit_study_recovery_request` migration to validate `auth.uid()`, lock the pending request, create recovery todos, and mark the request submitted. As of 2026-06-25, only makeup is created as a todo and pledge is stored on the recovery request.
- Completed: Added source-level regression coverage in `apps/web/test/recoveryRoutine.test.mjs`.
- Completed: Applied Supabase migrations `in_app_recovery_submission` and `revoke_anon_recovery_submission`.
- Completed: `npm.cmd test` and `npm.cmd run build` passed.
- Completed: Committed and pushed `1230076056739485f5acdc4ddf889726736706df`; GitHub Actions run `27760013203` succeeded and Vercel deployment `dpl_5wQdvFgqWzAbaJa1UTEEN5iKoFWC` is `READY`.
- Next: If a pending recovery request exists, verify the in-app modal with a logged-in browser session.

## Notes

- The app fallback does not remove Slack. Slack remains the notification and modal path when correctly configured.
- Do not store Slack signing secret or bot token values in memory-bank or committed files.

## Current Work

- Task: Diagnose why 2026-06-18 showed missed even though the user thought they started before 21:00.
- Purpose: Confirm whether the attendance failure came from deadline logic, session start persistence, or stale dashboard totals.
- Related PRD:
  - `memory-bank/prd-user-profile.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `supabase/migrations/0021_late_study_goal_attendance_policy.sql`
  - `supabase/functions/attendance-cron/index.ts`

## Recent Decisions

- Decision: Treat the issue as a missing persisted study session unless new browser-side evidence shows otherwise.
- Reason: Production Supabase has a `missed` attendance row at the 21:00 JST deadline, but no `study_sessions` row for 2026-06-18 and no nearby session before the deadline.
- Alternative: Assume the deadline comparison is wrong; rejected because the recorded deadline is 2026-06-18 12:00 UTC / 21:00 JST and the DB had no qualifying session to promote.
- Impact: The likely product fix is clearer start-success feedback and dashboard cleanup for stale/old long sessions, not changing the deadline window itself.

## Current Status

- Completed: Queried production `attendance_days` for 2026-06-18 and confirmed status `missed`, reminder 20:30 JST, deadline 21:00 JST, marked at 21:00 JST.
- Completed: Queried production `study_sessions` and confirmed there is no 2026-06-18 study session and no session near the 21:00 deadline.
- Completed: Confirmed DB completed study seconds for 2026-06-18 is 0 against a 7200 second weekday goal.
- Completed: Found the large displayed study time likely came from an older abandoned 2026-06-16 completed session with a 24-hour-level duration, not a valid 2026-06-18 session.
- Next: Add UI safeguards so users can distinguish camera/app open from a successfully persisted study session start.

## Notes

- Opening the app or camera does not count as attendance unless `start_study_session()` succeeds and a `study_sessions` row is created.
- Same-day missed recovery can still become present after completing the weekday 2-hour goal, but there must be completed same-day `study_sessions` duration in the DB.

## Current Work

- Task: Add a two-hour study session lease timer.
- Purpose: Prevent forgotten active study sessions from running overnight by showing an in-app session-expiry countdown and requiring the user to press a keep-alive button every 2 hours.
- Related PRD:
  - `memory-bank/prd-user-profile.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/sessionLease.mjs`
  - `apps/web/src/sessionLease.d.mts`
  - `apps/web/src/styles.css`
  - `apps/web/test/sessionLease.test.mjs`

## Recent Decisions

- Decision: Store the active session lease deadline in browser localStorage per user/session and fall back to `started_at + 2 hours` when an old active session has no stored lease.
- Reason: This preserves refresh continuity without adding a DB migration, and it lets old abandoned active sessions auto-end instead of blocking the next day.
- Alternative: Add a `lease_deadline_at` column to `study_sessions`; deferred because the requested MVP can be enforced in the web app and existing stale sessions need a no-migration fallback.
- Impact: The web app caps displayed active time at the lease deadline, adds lease overrun seconds to `p_excluded_seconds` on auto-end, and only adds active elapsed time to today's total when the active row's `local_date` is today.

## Current Status

- Completed: Added `sessionLease.mjs` helper and tests for two-hour deadlines, extension, countdown, stale-session capping, and localStorage keying.
- Completed: Added topbar session lease UI with a `세션 유지` button and 5-minute warning styling.
- Completed: Wired automatic `end_study_session` when the lease expires.
- Completed: `npm.cmd test` passed 135 tests.
- Completed: `npm.cmd run build` passed.
- Completed: Committed and pushed `257e8ea135d312b9189b80eeeb3fa78c6982edf8` to `origin/main`.
- Completed: GitHub Actions run `27687938261` succeeded for the Vercel production workflow.
- Completed: Vercel production deployment `dpl_3TxZyd6k9Q1m5hq5dzdiCdfD9aYF` is `READY` for commit `257e8ea135d312b9189b80eeeb3fa78c6982edf8`.
- Completed: `https://study-room-attendance.vercel.app/` returned HTTP 200 and served `assets/index-B1_8AaYG.js` / `assets/index-BlOsAQsR.css`.
- Completed: Production JS contains the session lease code (`study-room-session-lease` and the keep-alive UI string).
- Completed: Vercel production runtime error-log query returned no `error` or `fatal` logs in the checked one-hour window.
- Next: Verify the countdown and keep-alive button with a logged-in active session in the browser.

## Notes

- This change does not use browser lifecycle events to end sessions. Tab switching and refresh still preserve the active session, but the two-hour lease eventually closes abandoned sessions.
- Server-side cleanup for users who never reopen the web app is still a separate future improvement.

## Current Work

- Task: Re-test Slack recovery routine after the user updated `SLACK_SIGNING_SECRET`.
- Purpose: Explain the Windows `npx.cmd` convention and provide a fresh Slack recovery routine button message for verification.
- Related PRD:
  - `memory-bank/prd-slack-recovery-routines.md`
  - `memory-bank/prd-slack-notifications.md`
- Related files:
  - `supabase/functions/slack-recovery-interactions/index.ts`
  - `supabase/functions/slack-test-alarm/index.ts`
  - `memory-bank/trouble-shooting.md`

## Recent Decisions

- Decision: A new Slack recovery routine test message is required after updating `SLACK_SIGNING_SECRET`.
- Reason: The previous failure was a Slack signature 401. The only meaningful end-to-end verification is a real Slack button click against the signed interactivity endpoint.
- Alternative: Simulate a Slack request locally; rejected because the secret value is not exposed to the local shell and real Slack request headers are the trusted path.
- Impact: The latest Slack message with `messageTs=1781620566.269929` should be used for the next click test.

## Current Status

- Completed: Explained that `npx.cmd` is the Windows command-wrapper form used to run local package CLIs reliably from PowerShell.
- Completed: Sent a fresh recovery routine test message to Slack channel `C0BAFS1CSV8`.
- Completed: Supabase async request `13371` returned HTTP 200 with `ok=true` for `recoveryRequestId=df8694be-5eae-4529-adfe-d97942112542`.
- Completed: After the user set the Slack Signing Secret, sent another recovery routine test message. Supabase async request `13379` returned HTTP 200 with `ok=true` and Slack `messageTs=1781620988.738379`.
- Next: User should click the new Slack `회복 루틴 작성` button. If it still fails, inspect the newest `slack-recovery-interactions` Edge Function log entry.

## Notes

- The fresh test message only verifies Slack posting. The actual fix is verified only when the Slack button request returns 200 instead of 401.
- Do not log or store the actual Slack signing secret in code, documents, or memory-bank.

## Current Work

- Task: Diagnose Slack recovery routine button failure.
- Purpose: Confirm why clicking the Slack `회복 루틴 작성` button does not open or submit the recovery modal, and verify Slack test alarm delivery.
- Related PRD:
  - `memory-bank/prd-slack-recovery-routines.md`
  - `memory-bank/prd-slack-notifications.md`
- Related files:
  - `supabase/functions/slack-recovery-interactions/index.ts`
  - `supabase/functions/slack-test-alarm/index.ts`
  - `memory-bank/trouble-shooting.md`

## Recent Decisions

- Decision: Treat the current recovery button failure as a Slack signing-secret mismatch/configuration issue rather than a Slack delivery issue.
- Reason: Supabase Edge Function logs show recent `POST | 401` requests to `slack-recovery-interactions`, while Slack message delivery and `slack-test-alarm` still return `ok=true`.
- Alternative: Change the recovery modal code immediately; rejected because the remote function receives the request and rejects it before payload handling due to signature verification.
- Impact: The user must set `SLACK_SIGNING_SECRET` to the Signing Secret from the same Slack App that owns the bot token and has Interactivity enabled.

## Current Status

- Completed: Confirmed remote `slack-recovery-interactions` v2 is `ACTIVE` with `verify_jwt=false`.
- Completed: Confirmed Slack button clicks reached Supabase but returned `401` three times from `slack-recovery-interactions`.
- Completed: Confirmed `SLACK_SIGNING_SECRET` secret name exists, so the likely issue is value mismatch with the Slack App's actual Signing Secret.
- Completed: Sent Slack test alarm to channel `C0BAFS1CSV8` through `slack-test-alarm`; request id `13350` returned HTTP 200 and `ok=true` with Slack `messageTs=1781619471.681719`.
- Completed: Added and deployed a cron-secret protected recovery routine test path to `slack-test-alarm` v7.
- Completed: Sent a recovery routine test message to Slack channel `C0BAFS1CSV8`; request id `13360` returned HTTP 200 and `ok=true` with Slack `messageTs=1781620002.856819`.
- Blocked: Correct Slack Signing Secret is only visible in the user's Slack App dashboard and cannot be derived from the bot token or Supabase.
- Next: Update Supabase `SLACK_SIGNING_SECRET` with the correct Slack App `Basic Information > App Credentials > Signing Secret`, keep Interactivity Request URL pointing to `/functions/v1/slack-recovery-interactions`, then click the recovery button again.

## Notes

- Slack 401 on interactivity plus successful `chat.postMessage` means the bot token/channel path is healthy, but signed Slack interactivity requests are failing authentication.
- Slack may retry failed interactivity requests, which explains multiple close-together `401` log entries for one button click.
- The recovery routine test message uses existing pending request `df8694be-5eae-4529-adfe-d97942112542` and action id `open_recovery_routine`; it does not run attendance marking or reminder cron logic.

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
- Completed: Supabase secrets list confirmed `SLACK_SIGNING_SECRET` is configured for project `bqohkdzvxbrokkmuhysx`.
- Next: After explicit approval, redeploy `camera-presence-warning` so repeated camera absence can create recovery requests remotely.
- Next: Configure Slack App Interactivity Request URL if needed, then test the recovery modal from the real Slack `회복 루틴 작성` button.

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

## 2026-06-28 - Session lease Slack extension

### Current Work

- Task: 세션 종료 5분 전 Slack 알림과 1시간 연장 버튼 추가
- Purpose: 기본 공부 세션 유지 시간을 2시간에서 1시간으로 줄이고, 만료 5분 전에 Slack에서 바로 1시간 연장할 수 있게 한다.
- Related PRD:
  - `memory-bank/prd-session-activity-heartbeat.md`
  - `memory-bank/prd-slack-notifications.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/sessionLease.mjs`
  - `supabase/migrations/20260628093258_session_lease_slack_warnings.sql`
  - `supabase/functions/attendance-cron/index.ts`
  - `supabase/functions/slack-recovery-interactions/index.ts`

### Recent Decisions

- Decision: 세션 lease 기준 시간은 서버의 `study_sessions.lease_expires_at`을 우선하고, localStorage는 과거 세션 호환 fallback으로만 유지한다.
- Reason: 브라우저가 닫혀 있어도 Supabase Cron/Edge Function이 만료 5분 전 Slack 알림을 보낼 수 있어야 한다.
- Alternative: 브라우저 localStorage 기반 1시간 타이머만 줄이는 방식.
- Impact: 새 세션은 시작 시점부터 1시간 lease를 DB에 저장하고, Slack 버튼 또는 앱의 `세션 유지` 버튼은 같은 RPC로 1시간 연장한다.

### Current Status

- Completed: `study_sessions.lease_expires_at`, `lease_warning_sent_at` migration을 원격 Supabase 프로젝트 `bqohkdzvxbrokkmuhysx`에 적용했다.
- Completed: `start_study_session()`이 새 active session에 `now() + interval '1 hour'`를 저장한다.
- Completed: `extend_study_session_lease(p_session_id, 60)` RPC를 추가해 앱과 Slack 버튼이 같은 서버 경로로 1시간 연장한다.
- Completed: `attendance-cron`이 `get_due_session_lease_warnings()`를 호출하고 만료 5분 전 Slack 메시지와 `1시간 연장` 버튼을 보낸다.
- Completed: `slack-recovery-interactions`가 `extend_session_lease_60` 액션을 처리한다.
- Completed: `npm.cmd test`와 `npm.cmd run build`가 통과했다.
- Next: 변경사항 커밋/푸시 후 Vercel production 배포 상태를 확인한다.

### Notes

- Slack App Interactivity Request URL은 기존 `slack-recovery-interactions` Edge Function을 그대로 사용한다.
- Edge Function secrets에는 기존 Slack bot token과 signing secret이 필요하며, 민감한 값은 문서에 기록하지 않는다.