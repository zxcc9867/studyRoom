# Implementation Plan

## Architecture

- Web frontend: Vite React static build can be deployed to S3/CloudFront or another static host.
- Current web hosting: Vercel production deployment serves the static Vite app at `https://study-room-attendance.vercel.app`.
- Primary scheduler: Supabase Cron invokes `attendance-cron` Edge Function every minute through `pg_cron` and `pg_net`.
- Optional AWS scheduler: EventBridge + Lambda can invoke the same Supabase Edge Function when AWS-managed scheduling is preferred.
- Backend: Supabase remains responsible for Auth, DB, RLS, notification targets, attendance decisions, and actual push/email dispatch.
- Auth session persistence: the browser Supabase client stores the Supabase session under `study-room-attendance-auth-session` with `persistSession=true` and `autoRefreshToken=true`. OAuth URL handling stays manual with `detectSessionInUrl=false`.
- Study session refresh persistence: browser lifecycle events such as `visibilitychange`, `pagehide`, and `beforeunload` do not end active study sessions. Active sessions continue to be restored from Supabase after refresh.
- Study time display windows: active study-session elapsed time is split by local date and selected-month windows for summary cards. A cross-midnight active session contributes only the post-midnight segment to today's study timer, while the one-hour session lease countdown remains based on `study_sessions.lease_expires_at`.
- Study session end idempotency: the web app treats `Active study session not found` from `end_study_session` as a stale local active-session signal. It clears local lease/activity/camera intent, closes end-completion state, and reloads dashboard data instead of leaving the stale active row in UI state.
- Study session lease: every active web study session has a 1-hour keep-alive lease stored server-side on `study_sessions.lease_expires_at`, with `lease_warning_sent_at` used to avoid duplicate Slack warnings. The web dashboard prefers the server deadline and keeps localStorage only as a compatibility fallback. Five minutes before expiry, Supabase `attendance-cron` sends Slack with a `1시간 연장` button, and `slack-recovery-interactions` calls `extend_study_session_lease(p_session_id, 60)`. If the lease expires while the app is open, the app calls `end_study_session` and adds lease-overrun seconds to `p_excluded_seconds` so forgotten time after the deadline is excluded from saved study duration. Existing active sessions without a server deadline fall back to `started_at + 1 hour`.
- Open dashboard lease sync: while an active session exists, the web app refetches only that `study_sessions` row every 15 seconds and on focus/visible events. This picks up `lease_expires_at` changes made outside the browser, such as Slack session-extension buttons, without a full dashboard reload.
- Study session todo links: before a new web study session starts, the app requires the user to choose at least one incomplete todo for the current local date. If no suitable todo was pre-registered, the same session planning modal can quick-add a plain today todo and auto-select it. The selection is persisted in `study_session_todos`, and the active Today Focus card shows only the todos linked to the current session. Todo completion is not toggled from the daily checklist or active-session list while the session is running; pressing End opens a completion modal, and selected todos update `study_todos.is_completed` plus `study_session_todos.completed_during_session` for linked rows.
- Kakao notification channel: deprecated for active product behavior. Legacy `kakao_memo` rows and `kakao_message_connections` are retained for history, but enabled targets/connections are disabled and `attendance-cron` no longer sends Kakao Memo messages.
- Slack notification channel: the web app stores a user-specific Slack Channel ID in `notification_targets.destination`, while Slack Edge Functions read `SLACK_BOT_TOKEN` or fallback alias `STUDY_ALERT_SLACK_BOT_TOKEN` from Edge Function secrets and call Slack Bot API `chat.postMessage`.
- Timed todo schedule reminders: `attendance-cron` also calls `get_due_todo_schedule_reminders(p_now)` every minute. Incomplete timed `study_todos` send Slack at `start_time` and 5 minutes before `end_time`; completed todos are skipped. Sent/failed locks are stored in `study_todo_schedule_deliveries` with unique `(todo_id, target_id, reminder_type, scheduled_at)` duplicate protection.
- Slack schedule extension actions: timed todo Slack reminders include `5분 연장`, `10분 연장`, and custom 1-120 minute extension actions. The existing `slack-recovery-interactions` Edge Function routes these schedule actions because the Slack App has one Interactivity Request URL. It calls `extend_todo_schedule`, which shifts the selected todo start and end time together, then shifts every later same-day incomplete timed todo by the same number of minutes; completed todos are excluded. Schedule reminder locks include `scheduled_at`, so shifted times can trigger fresh future start/end-soon reminders.
- Slack recovery routines: missed attendance and repeated same-day camera absence create `study_recovery_requests` rows. Every pending recovery request blocks `start_study_session()` and the web start button until the user submits a Slack or in-app recovery modal with a reason, makeup todo, and next-day pledge.
- Recovery routine summaries: the web app derives My Page recovery summaries from loaded `study_recovery_requests` using deterministic keyword categories, not AI APIs. `attendance-cron` sends a Monday 08:00 local-time Slack weekly summary for the previous Monday-Sunday range and records one row per user/week in `study_recovery_weekly_reports` to avoid duplicate sends.
- In-app recovery routine fallback: the web app opens a recovery modal after login when pending `study_recovery_requests` exist. Same-day `missed_attendance` requests are no longer soft late-study exceptions; if a pending recovery request is detected while a session is already active, the web app ends that session and requires recovery submission before study can restart. The app submits reason, makeup todo, and pledge fields through authenticated RPC `submit_study_recovery_request`, immediately marks the submitted request locally, and shows the next remaining pending request with its date/count so users do not mistake multiple pending requests for a failed submission. If the user reached the modal by pressing `입장하고 시작`, the app remembers that start intent, waits for dashboard recovery data to refresh after the final submission, then resumes the normal start flow while preserving camera and session-todo gates.
- Slack interactivity: `slack-recovery-interactions` is deployed with `verify_jwt=false` and authenticates Slack requests by verifying `X-Slack-Signature` and `X-Slack-Request-Timestamp` with `SLACK_SIGNING_SECRET`. It opens the modal through Slack `views.open` and creates dated `study_todos` on submission.
- Notification diagnostics: the settings screen reads the five latest notification_deliveries rows for the logged-in user and combines them with browser push status and saved Slack target status. This is a read-only UI visibility feature and does not change notification dispatch.
- Vercel production gate: the GitHub Actions production workflow must run npm test and npm run build before invoking vercel deploy --prod, so TypeScript/build errors block production deployment.
- Slack test channel: `slack-test-alarm` is a manually invoked Edge Function. Server/admin calls use `x-cron-secret`; they can either send to a direct `channelId` for setup verification, send a recovery routine test button for a specific `recoveryRequestId`, or use the latest enabled Slack target. Browser calls use the logged-in user's Supabase JWT and are limited to that user's Slack target. It sends one test Slack message and records DB delivery results only when a saved target is used.
- In-app popup: when the dashboard is open at the configured reminder minute, the web app shows a modal reminder popup. This is separate from OS/browser push and does not work when the browser is closed.
- In-app popup suppression: if the user already has an active same-day study session at the configured reminder minute, the web app does not show the reminder modal.
- My Page: the web dashboard uses hash-based client routing (`#me`) to render My Page as a separate SPA page while reusing loaded profile and `study_todos` data to show account summary and completed todo history.
- Study Forest: the web dashboard uses hash-based client routing (`#forest`) to render a client-only 2.5D reward space. It derives completed trees, current tree growth, and wilted state from already loaded `attendance_days` data through `apps/web/src/studyForest.mjs`; it does not add a Supabase table or send game-state writes in the MVP. The forest JSX and CSS class names must stay aligned for tree/avatar parts, and the scene should keep visible 2.5D depth through perspective, rotated ground/pond/path layers, drop shadows, village props, flowers/stones, tree sparkles, and an avatar z-index above terrain. The avatar should have visible face/body/arm/leg/backpack parts, a friendly smiling expression, subtle CSS motion, percent-based meadow movement, click/touch-to-walk, y-position scale/z-index depth, and deterministic idle waypoint walking. The scene should read as a cozy study island with CSS-only distant hills, river, bridge, garden bed, lanterns, fireflies, foreground grass, water shimmer, drifting clouds, and leaf sway while remaining static-host friendly.
- Study goals: the web dashboard uses hash-based client routing (`#goals`) to render a dedicated goal page. Goals are stored in `study_goals`, shown as a D-day card in the dashboard topbar, and can be linked to dated `study_todos` through `study_todos.goal_id`.
- Recurring todos: weekday repetition is materialized into dated `study_todos` rows on save, and each generated weekly row stores lightweight repeat metadata (`repeat_group_id`, `repeat_mode`, `repeat_weekdays`, `repeat_until`, `repeat_forever`) so the group can be edited later from the calendar modal. `repeat_forever = true` means no user-selected end date; the current MVP generates a rolling one-year set of rows while preserving the no-end metadata. This keeps reminders, today's tasks, and completed history on the existing date-based data path without adding a separate recurrence-rule table.
- Scheduled todos: `study_todos` can optionally store `start_time` and `end_time`. If one is present, both must be present. Same-day schedules use `start_time < end_time`; overnight schedules use `end_time < start_time`; equal start/end times are invalid.
- Reminder todo enrichment: `attendance-cron` loads `study_todos` for each due reminder's `user_id` and `local_date`, then appends a compact `오늘 할 일` summary to server-side notification bodies. The open web app also renders the same date's todos in the reminder popup from already loaded dashboard state.
- Two-step attendance enforcement: `get_due_reminders()` emits an initial reminder at the effective reminder time and a `nudge` reminder 15 minutes later if no qualifying timer start or completed daily goal exists. Weekdays use the saved profile reminder time with a `20:30` default; weekends use fixed `14:00`. `mark_missed_attendance()` marks the day missed at reminder time + 30 minutes only when no qualifying timer start and no completed daily goal exists.
- Daily attendance goals: weekdays require 2 hours of completed saved study time, weekends require 4 hours. If the user misses the 30-minute check-in window but later ends sessions whose same-day total reaches the goal, `end_study_session()` promotes `attendance_days.status` to `present`.
- Pre-reminder active attendance: if a study session started before the configured reminder time and is still open, or ended after crossing the reminder timestamp, Supabase treats it as a qualifying attendance session and suppresses initial/nudge reminders.
- Camera presence warning: web study sessions require camera monitoring before the timer can start. MediaPipe PoseLandmarker runs in the browser only, and the server receives only camera event metadata through `camera-presence-warning`.
- Camera video health: before running PoseLandmarker absence checks, the web app verifies the camera stream has a live unmuted enabled video track and that the current video frame is visible. Missing, muted, ended, disabled, unavailable, or nearly black frames are treated as camera errors instead of user absence.
- Camera stalled-frame recovery: if a live camera stream stops producing a current frame or reports zero video size for 15 seconds, the web app attempts one same-session camera reconnect. If the reconnect still cannot produce frames, the app releases the stream and asks the user to turn camera monitoring on again.
- Camera refresh resume: when camera monitoring is enabled for an active session, the web app stores a short-lived per-user/per-session camera intent in browser storage and attempts one automatic camera reconnect for the same active session after refresh.
- Camera upper-body presence: the web app treats the user as present when one head landmark and both shoulder landmarks are visible with enough confidence. For cropped webcam views, head plus one visible shoulder and the same-side hip also counts as seated upper-body presence. This allows upper body detection instead of requiring a full face detection.
- Camera absence enforcement: if no upper body pose is detected for 5 minutes, the web app sends an in-app/Slack warning. If the user is still absent 5 minutes after that warning, the web timer enters auto-pause and excludes only the paused interval from displayed and saved study time.
- Camera monitor UI: the top summary cards are the single source for today's study time and monthly accumulated time. The camera section does not render a second timer; it shows goal progress, one camera status line, a larger local preview, the camera control, and a compact client-only diagnosis strip for support, permission, stream, frame, absence, loading, paused, and healthy states.

## Daily Planner Dashboard Notes

- Today task views: the Today task card supports `checklist` and `planner`. The planner is a browser-rendered SVG life planner built from already loaded `study_todos`.
- Selected-date planner scope: the Today task card can render any selected local date by filtering `study_todos.local_date` with `selectedTodoDate`; real attendance/session gates still use the actual `todayDateKey`. The planner previous/next buttons move relative to `selectedTodoDate`, while the today button jumps back to the real current local date.
- Planner data source: timed todos use `study_todos.start_time` and `study_todos.end_time`; untimed todos remain in a separate list below the wheel. Overnight todos wrap across midnight and overlapping todos show a warning state.
- Planner interactions: clicking an empty wheel area opens the existing todo modal with a default one-hour time block; clicking a segment opens the same modal for editing that todo.
- Multi-date plan copy: the planner copy modal creates explicit single-date `study_todos` rows for selected target dates, skips duplicate title/date/time rows, resets copied rows to incomplete, and clears repeat metadata so the copies do not unexpectedly edit the original recurrence group.
- Existing todo scheduling: inside the todo modal, checking an existing todo means "link this todo into the current time window" and inserts a new timed row when the selected date/title/time is not an exact duplicate. Already scheduled todos remain visible and can be scheduled again for another time block. These checkboxes do not mark todos complete and no longer expose edit/delete actions inside the link list.
- Planner detail list: the planner selected-detail panel also renders the selected date's todo list with time/repeat/goal chips and row-level edit/delete actions. This is the main editing surface for scheduled rows in planner view.
- Planner todo completion: outside active study sessions, the Today checklist/planner can toggle `study_todos.is_completed` directly through the existing authenticated update path. During active sessions, direct completion controls stay disabled and completion remains part of the End-session completion modal.
- Preference storage: `profiles.today_task_view` stores the pinned task view, and `profiles.today_section_order` stores the Today section order for `topbar`, `attendance`, `focus`, and `tasks`.
- Client helpers: daily-planner math belongs in `apps/web/src/dailyPlanner.mjs`; task-view and section-order normalization belongs in `apps/web/src/dashboardLayout.mjs`.
- API shape: no new server API is required. The web app persists preferences through Supabase Data API upsert on `profiles`.
- DB shape: migration `20260623131001_dashboard_planner_preferences.sql` adds the two `profiles` columns and constraints.
- Tests: use `apps/web/test/dailyPlanner.test.mjs`, `apps/web/test/dashboardLayout.test.mjs`, and SQL migration coverage in `packages/core/test/sql-migrations.test.mjs`.

## Tech Stack

- Vite React
- Supabase
- MediaPipe Tasks Vision
- Slack Bot API
- AWS CDK v2
- AWS S3
- AWS CloudFront
- AWS EventBridge
- AWS Lambda Node.js 20
- Vercel static hosting

## Folder Structure

```txt
.github/workflows/
  vercel-production.yml
docs/
  vercel-ci.md
```

```txt
infra/aws-cdk/
  bin/study-room-aws.ts
  src/study-room-aws-stack.ts
  lambda/attendance-cron-invoker/index.mjs
  lambda/attendance-cron-invoker/index.test.mjs
  test/study-room-aws-stack.test.ts
  README.md
```

```txt
vercel.json
apps/web/dist/
```

```txt
apps/web/src/todoHistory.mjs
apps/web/src/todoHistory.d.mts
apps/web/test/todoHistory.test.mjs
apps/web/src/todoRecurrence.mjs
apps/web/src/todoRecurrence.d.mts
apps/web/test/todoRecurrence.test.mjs
apps/web/src/dashboardRoute.mjs
apps/web/src/dashboardRoute.d.mts
apps/web/test/dashboardRoute.test.mjs
apps/web/src/studyGoals.mjs
apps/web/src/studyGoals.d.mts
apps/web/test/studyGoals.test.mjs
apps/web/src/sessionTodoLinks.mjs
apps/web/src/sessionTodoLinks.d.mts
apps/web/test/sessionTodoLinks.test.mjs
apps/web/src/plannerDate.mjs
apps/web/src/plannerDate.d.mts
apps/web/test/plannerDate.test.mjs
```

```txt
apps/web/src/cameraPresence.mjs
apps/web/src/cameraDiagnostics.mjs
apps/web/src/cameraWarning.mjs
apps/web/src/bodyPresenceDetection.mjs
apps/web/src/cameraVideoHealth.mjs
apps/web/src/sessionExit.mjs
apps/web/test/cameraPresence.test.mjs
apps/web/test/cameraDiagnostics.test.mjs
apps/web/test/upperBodyPresence.test.mjs
apps/web/test/cameraVideoHealth.test.mjs
apps/web/test/sessionExit.test.mjs
supabase/functions/camera-presence-warning/index.ts
supabase/functions/slack-recovery-interactions/index.ts
supabase/functions/_shared/recovery.ts
supabase/migrations/0011_study_presence_events.sql
supabase/migrations/0012_camera_required_warning.sql
supabase/migrations/0013_exclude_camera_absence_from_sessions.sql
supabase/migrations/0019_study_recovery_requests.sql
```

```txt
docs/infrastructure-architecture.md
docs/images/study-room-thumbnail.png
```

## Code Conventions

- Work from `C:\jini-dev\project\study-room-attendance` for this app repository. Do not treat the parent workspace `C:\jini-dev\project` as the app root when updating app-local instructions or memory-bank files.
- Read the app-local `AGENTS.md` and relevant app-local `memory-bank` documents before product, architecture, provider, AI-analysis, automation, auth, notification, DB, or deployment changes.
- Keep AWS infrastructure code isolated under `infra/aws-cdk`.
- Keep Lambda logic dependency-free unless a real integration requires an SDK.
- Prefer deploy-time parameters for MVP secrets to avoid fixed Secrets Manager cost.
- Never put Supabase service-role keys in frontend code or committed docs.
- The web app intentionally uses a light Animal Crossing-style theme. Keep `color-scheme` fixed to light in HTML/CSS so mobile browsers do not auto-darken the UI.
- Keep todo history filtering, stats, and pagination in `todoHistory.mjs` instead of expanding the large React component with data logic.

## Design Patterns

- Static web hosting uses private S3 bucket plus CloudFront Origin Access Control.
- Scheduled execution is an invoker pattern: AWS only triggers Supabase Edge Function.
- SPA fallback maps CloudFront `403` and `404` to `/index.html`.
- Web study sessions are explicitly ended by button click or by true page-exit events using a `keepalive` RPC request. `visibilitychange` from browser tab switching is not a page-exit event and must not end the session.
- Web study sessions are ended by the explicit `종료` button or by the in-app 2-hour session lease expiry. Browser lifecycle events are not used for automatic session end because refresh/reload cannot be reliably distinguished from leaving the page, and ending on refresh caused study time loss.
- Auth initialization waits for `supabase.auth.getSession()` before showing the login form, so a stored browser session can restore the dashboard without a misleading login flash.

## API Conventions

- Supabase Cron sends `POST` to `/functions/v1/attendance-cron`.
- Supabase Cron sends `x-cron-secret` from Vault secret `cron_secret`.
- Kakao notification APIs are deprecated. The web app no longer calls a Kakao token endpoint and `attendance-cron` no longer calls Kakao Memo APIs.
- `attendance-cron` sends Slack messages to `https://slack.com/api/chat.postMessage`.
- `slack-test-alarm` sends a protected one-off Slack test message and includes same-day `study_todos` in the message body when a saved target is used. Browser requests must include `Authorization: Bearer {supabase_access_token}`. Cron-secret protected admin requests may pass `{ "channelId": "C..." }` or `{ "channelId": "G..." }` for direct Slack channel verification.
- `camera-presence-warning` receives `POST /functions/v1/camera-presence-warning` from the browser with `Authorization: Bearer {supabase_access_token}` and body `{ sessionId, absenceSeconds, detectedAt, eventType }`.
- `camera-presence-warning` validates that `study_sessions.user_id` matches the authenticated Supabase user before inserting `study_presence_events` or sending Slack.
- `submit_study_recovery_request(p_request_id uuid, p_reason text, p_makeup_todo_title text, p_pledge_todo_title text)` is called by the web app with the logged-in Supabase session. It verifies `auth.uid()`, locks the user's pending recovery request, inserts only the makeup todo, stores the pledge on `study_recovery_requests.pledge_todo_title` without creating a todo row, marks the request submitted, and returns the updated recovery request.
- `end_study_session` receives `{ p_session_id, p_excluded_seconds }`; `p_excluded_seconds` is the camera absence time that should not be counted as study duration.
- `attendance-cron` Slack notification bodies use emoji-led plain-text sections for `출석 마감`, `오늘 할 일`, `지금 할 일`, and `앱 열기`; they include up to a compact subset of reminder-date todo titles, mark completed items with a check indicator, and mention the 2-hour weekday or 4-hour weekend late-study recovery goal.
- `get_due_reminders()` returns `reminder_stage = 'initial' | 'nudge'`. `attendance-cron` uses this stage to choose the first-reminder or final-nudge title/body and includes `reminderStage` in push payload data.
- Lambda sends `POST` to `AttendanceCronUrl`.
- Lambda sends `x-cron-secret` header from `CronSecret`.
- Lambda body includes `source: "aws-eventbridge"` and `triggeredAt`.
- The page-exit session termination helper remains available for explicit future use, but current browser lifecycle events do not call it. Normal session termination sends `end_study_session` from the explicit `종료` action or the in-app 2-hour session lease expiry.
- My Page does not call a new API. It derives completed todo history from `study_todos` already loaded by the dashboard and is selected through the `#me` hash route.
- Study goals do not call a new server API route. The web app reads and writes `study_goals` through the Supabase Data API, and links existing todos by updating `study_todos.goal_id`.
- Recurring todo save/edit does not call a new API route. The web app computes target dates locally and inserts, updates, or deletes rows in `study_todos` through Supabase Data API.
- Session todo linking does not call a new server API route. The web app creates the study session through `start_study_session()` and then inserts selected todo links into `study_session_todos` through the Supabase Data API.

## Database Conventions

- No AWS database is introduced.
- Supabase remains the source of truth.
- RLS remains the user-data isolation boundary.
- Legacy Kakao access/refresh tokens remain only in `kakao_message_connections` for historical compatibility. Active Kakao targets/connections are disabled by migration `0018_disable_kakao_notifications.sql`.
- `notification_targets.kind = 'kakao_memo'` is retained only for legacy history and is not included in active notification dispatch.
- `kakao_message_connections` remains RLS-protected and is no longer used by the active web app or `attendance-cron`.
- `notification_targets.kind = 'slack'` stores only the user's Slack Channel ID in `destination`.
- `notification_targets.kind = 'telegram'` is retained only for legacy delivery history and is disabled by the Slack migration.
- `start_study_session()` creates a `study_sessions` row at any start time, but it only marks `attendance_days.status = 'present'` when the current timestamp is between the effective `reminder_at` and `deadline_at`.
- `start_study_session()` blocks all pending recovery requests, including same-day `missed_attendance` requests. The Slack message and app behavior must match: users must submit the recovery routine before another session can start.
- Timer starts before the configured reminder time must not create a `present` attendance row, because `get_due_reminders()` excludes days that are already `present` or `missed`.
- Timer starts before the configured reminder time are converted to `attendance_days.status = 'present'` by `get_due_reminders()` at the reminder minute only when the session spans the reminder timestamp.
- Attendance deadline is `reminder_at + interval '30 minutes'`. Timer starts qualify only when `started_at >= reminder_at` and `started_at < deadline_at`; starts at the exact deadline or later do not qualify through the check-in window, but the day can still become `present` when completed study total reaches the weekday/weekend goal.
- `mark_missed_attendance()` also checks pre-reminder sessions that span `reminder_at` before marking a pending day missed, and updates such days to `present` with `qualifying_session_id`.
- The 15-minute nudge is not a separate attendance status. It is derived by `get_due_reminders()` from an existing `attendance_days.status = 'pending'` row and the absence of a qualifying `study_sessions.started_at`.
- `study_presence_events` stores camera presence events only: `camera_started`, `camera_stopped`, `absence_warning`, `camera_permission_denied`, and `camera_required_warning`.
- `study_presence_events.metadata` must not contain `image`, `video`, `frame`, `faceEmbedding`, or `landmarks` keys.
- Users can select and insert only their own `study_presence_events`; Edge Functions use the service role after validating session ownership.
- `end_study_session(p_session_id uuid, p_excluded_seconds integer default 0)` stores `duration_seconds` as elapsed seconds minus non-negative excluded seconds. This keeps camera auto-paused absence time out of saved study totals.
- `end_study_session()` calls `promote_attendance_by_daily_study_total()` after saving duration. If same-day completed study seconds reach `study_attendance_goal_seconds(local_date)`, the function upserts `attendance_days.status = 'present'`; pending recovery still requires explicit recovery routine submission before another new session can start.
- `submit_study_recovery_request()` is an authenticated `security definer` RPC in `public` because the existing app RPC path is exposed through Supabase Data API. It must always check `auth.uid()` against the locked `study_recovery_requests.user_id` before creating todos or changing recovery status.
- `study_goals` stores one row per user goal with `title`, `target_date`, `target_study_seconds`, and `status`. RLS policies restrict select/insert/update/delete to `auth.uid() = user_id`, and the table has explicit authenticated Data API grants.
- `study_todos.goal_id` is nullable and references `(study_goals.id, study_goals.user_id)` so a todo cannot be linked to another user's goal.
- `study_session_todos` stores one row per selected session todo with `user_id`, `session_id`, `todo_id`, `linked_at`, and `completed_during_session`. Composite foreign keys reference `(study_sessions.id, study_sessions.user_id)` and `(study_todos.id, study_todos.user_id)` so a user cannot link another user's session or todo. RLS and explicit authenticated grants allow users to manage only their own link rows.
- Recurring todo rows are stored in `study_todos` with one row per target `local_date`. Weekly rows share `repeat_group_id` and repeat metadata so editing one generated row can update the group, add newly selected dates, and delete removed dates. Forever repeats store `repeat_forever = true` and `repeat_until = null`; finite repeats store `repeat_forever = false` and a `repeat_until` date. Duplicate title/date/time rows are skipped in the client before new inserts.
- Scheduled todo rows use nullable `start_time` and `end_time`; the DB check constraint allows both null or both non-null with `start_time <> end_time`, so overnight schedules such as `23:00` to `01:00` are valid.
- Todo duplicate filtering uses date, normalized title, and optional time range so the same task title can be scheduled in different time blocks on the same day.

## Testing Strategy

- Use Node test runner for Lambda behavior.
- Use `aws-cdk-lib/assertions` for synthesized template assertions.
- Use `npm.cmd run infra:synth` as deployment-shape verification.
- Use pure state-machine tests for camera absence timing and warning cooldown.
- Use pure state-machine tests for camera auto-pause, auto-end, and excluded study seconds.
- Use upper-body pose tests for head/shoulder landmark based seated presence detection.
- Use pure helper tests for recurring todo date calculation, duplicate filtering, and dashboard hash route parsing.
- Use pure helper tests for study goal D-day labels, active-goal selection, linked todo filtering, and goal progress calculation.
- Use pure helper tests for session todo selection gates, link row construction, active-session linked todo lookup, and end-session summary text.
- Use pure helper tests for selected planner date labels, multi-date copy target normalization, and duplicate-safe copy row construction.
- Use SQL migration tests for `study_goals` RLS, explicit authenticated grants, and owner-safe todo goal links.
- Use SQL migration tests for `study_session_todos` RLS, explicit authenticated grants, and user-scoped composite foreign keys.
- Use SQL/source tests to verify `study_presence_events` RLS and `camera-presence-warning` session ownership checks.

## Deployment Strategy

1. Configure `apps/web/.env.local` with production Supabase values.
2. Build the web app with `npm.cmd run build` for local verification.
3. Set Vercel project environment variables for public Vite build values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`, and `VITE_GOOGLE_AUTH_ENABLED`.
4. Deploy the static web app to Vercel using `vercel.json`.
5. For repeatable GitHub-based production deploys, configure GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`, then let `.github/workflows/vercel-production.yml` run `npm test` and `vercel deploy --prod` on `main` pushes.
6. If Vercel Git integration remains enabled, monitor for duplicate deployments and keep only one deployment path as the source of truth.
7. Deploy `attendance-cron` Edge Function with `verify_jwt=false`.
8. Deploy `camera-presence-warning` Edge Function with `verify_jwt=false`; the function performs its own Supabase JWT and session ownership validation.
9. Set Edge Function secrets: `CRON_SECRET`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, optionally `RESEND_API_KEY`, for Slack either `SLACK_BOT_TOKEN` or `STUDY_ALERT_SLACK_BOT_TOKEN`, and `APP_ORIGIN`.
10. Store `project_url` and `cron_secret` in Supabase Vault.
11. Run `supabase/cron.sql` or equivalent SQL to register `study-room-attendance-cron`.
12. Verify `net._http_response` shows 200 responses from automatic cron calls.
13. Optional AWS deployment: run `npm.cmd run infra:synth` and `cdk deploy`.

## Security Notes

- Supabase Cron uses Vault-stored secrets and never exposes `cron_secret` to the client.
- `slack-test-alarm` is deployed with `verify_jwt=false` only because it performs its own `x-cron-secret` or Supabase JWT validation before reading any target or sending any message.
- `camera-presence-warning` is deployed with `verify_jwt=false` only because it handles CORS preflight and then validates the Supabase JWT with `admin.auth.getUser(jwt)`.
- Camera frames never leave the browser. The app sends only `sessionId`, `absenceSeconds`, `detectedAt`, and `eventType` to the Edge Function.
- `study_presence_events` has a DB check constraint that rejects media-like metadata keys.
- Pose landmarks are used only in memory inside the browser and are not sent to Supabase.
- Legacy Kakao raw tokens are not exposed through frontend local storage or public RLS policies. The active product path no longer writes or refreshes Kakao tokens.
- Slack bot tokens are never stored in frontend code or user-managed DB rows.
- `CronSecret` is a CloudFormation `NoEcho` parameter and Lambda environment variable.
- For production with multiple operators, migrate `CronSecret` to Secrets Manager despite small fixed cost.
- CloudFront is the only public entry point for the static site bucket.
- CloudWatch Logs retention is one week.
- Vercel deployment stores only public Vite build-time values in the frontend bundle; service role keys and provider tokens remain in Supabase secrets or server-side tables.
- GitHub Actions Vercel deployment uses only GitHub Secrets for `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`; none of those values should be stored in frontend code.

## Supabase 변경 이력

### 2026-06-25

- 변경 대상: `public.submit_study_recovery_request`, `slack-recovery-interactions`, `study_recovery_requests`, `study_todos`
- 변경 내용: 회복 루틴 제출 시 `p_pledge_todo_title` / Slack pledge 입력값은 `study_recovery_requests.pledge_todo_title`에만 저장하고, `study_todos`에는 오늘 보충 과제 1건만 생성하도록 변경했다. 새 제출의 `pledge_todo_id`는 `null`로 남긴다.
- 변경 이유: 마지막 입력칸인 내일 재도전 약속에는 `9시에 시작` 같은 시간 문구가 자주 들어가며, 이를 다음날 할 일로 자동 생성하면 실제 처리할 todo 목록이 약속 문장으로 오염되기 때문이다.
- 관련 기능: Slack 회복 루틴, 앱 내부 회복 루틴 모달, todo 자동 생성, 세션 시작 차단 해제
- 마이그레이션 파일: `supabase/migrations/20260625115531_recovery_pledge_note_only.sql`
- 확인 방법: `node --test apps\web\test\recoveryRoutine.test.mjs apps\web\test\slackNotifications.test.mjs packages\core\test\sql-migrations.test.mjs`
- 주의 사항: 기존 과거 제출에서 이미 생성된 pledge todo는 자동 삭제하지 않는다. 이 변경은 새 회복 루틴 제출부터 적용된다.

### 2026-06-23

- 변경 대상: `public.study_todos`
- 변경 내용: `repeat_forever boolean not null default false` 컬럼을 추가하고, `study_todos_repeat_consistency_check`를 교체해 weekly 반복이 `repeat_until` 또는 `repeat_forever = true` 중 하나를 가질 수 있게 했다.
- 변경 이유: 사용자가 요일 반복 todo를 종료일 없이 계속 유지하고, 나중에 같은 반복 그룹 전체를 삭제할 수 있어야 하기 때문이다.
- 관련 기능: 출석 캘린더 todo, 영구 반복 일정, 반복 그룹 삭제
- 마이그레이션 파일: `supabase/migrations/20260623143000_study_todo_repeat_forever.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260623134937 study_todo_repeat_forever` 확인, SQL에서 `repeat_forever_exists=true` 및 updated consistency check 확인
- 주의 사항: 현재 구현은 반복 규칙 전용 테이블이 아니라 dated row materialization을 유지한다. `repeat_forever = true`는 종료일 없음 메타데이터이고, 웹 앱은 저장 시 1년치 dated rows를 먼저 생성한다.

### 2026-06-18

- 변경 대상: `public.submit_study_recovery_request`
- 변경 내용: 앱에서 pending `study_recovery_requests`를 직접 제출할 수 있도록 인증 사용자용 RPC를 추가했다. RPC는 `auth.uid()`로 소유자를 확인하고, pending 요청을 lock한 뒤 오늘 보충 todo와 내일 재도전 todo를 생성하고 recovery request를 `submitted`로 변경한다. 후속 migration으로 `anon` 실행 권한을 제거하고 `authenticated`만 실행 가능하게 보강했다.
- 변경 이유: Slack interactivity가 실패하거나 사용자가 앱 URL로 직접 접속한 경우에도 회복 루틴을 제출하고 공부 시작 차단을 해제할 수 있어야 하기 때문이다.
- 관련 기능: Slack 회복 루틴, 앱 내부 회복 루틴 모달, 공부 시작 차단 해제, todo 자동 생성
- 마이그레이션 파일: `supabase/migrations/20260618121536_in_app_recovery_submission.sql`, `supabase/migrations/20260618123154_revoke_anon_recovery_submission.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `in_app_recovery_submission`과 `revoke_anon_recovery_submission` 확인, SQL 권한 확인에서 `anon_can_execute=false`, `authenticated_can_execute=true`, 익명 PostgREST 호출이 `permission denied for function submit_study_recovery_request`로 401 반환
- 주의 사항: 이 RPC는 Slack 모달을 대체하지 않는다. Slack modal submit과 앱 modal submit 모두 같은 recovery request를 `submitted`로 만들고 같은 todo 생성 효과를 가진다.

### 2026-06-16

- 변경 대상: `public.profiles`, `public.get_due_reminders`, `public.mark_missed_attendance`, `public.start_study_session`, `public.end_study_session`, `attendance-cron`
- 변경 내용: profile reminder default를 `20:30`으로 맞추고, `study_attendance_goal_seconds`, `effective_reminder_time`, `daily_completed_study_seconds`, `promote_attendance_by_daily_study_total` 함수를 추가했다. 평일은 2시간, 주말은 4시간 누적 공부 목표를 출석 인정 조건으로 추가했고, 주말 알림은 14:00으로 고정했다. `attendance-cron` Slack/WebPush/Email 본문에는 목표 시간 회복 경로를 포함했다.
- 변경 이유: 사용자가 30분 출석 창을 놓쳐도 당일 목표 공부 시간을 채우면 출석으로 인정하고, 주말 알림 시간을 오후 2시로 분리하기를 요청했다.
- 관련 기능: 강제 출석, Supabase Cron 알림, Slack 알림, 회복 루틴, 공부 시간 누적.
- 마이그레이션 파일: `supabase/migrations/0021_late_study_goal_attendance_policy.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260615161759 late_study_goal_attendance_policy` 확인, Supabase Edge Function list에서 `attendance-cron` version 18 ACTIVE 확인.
- 주의 사항: 늦은 공부 출석 승격은 세션 종료 후 `duration_seconds`가 저장되는 시점에 평가된다. 진행 중인 active session만으로는 DB 출석 상태가 즉시 바뀌지 않는다.

### 2026-06-16

- 변경 대상: `public.study_todos`
- 변경 내용: 반복 todo 편집을 위해 `repeat_group_id`, `repeat_mode`, `repeat_weekdays`, `repeat_until` 컬럼을 추가했다. weekly todo는 같은 `repeat_group_id`로 묶고, single todo는 repeat metadata를 비운 상태로 유지한다. `study_todos_repeat_mode_check`, `study_todos_repeat_weekdays_check`, `study_todos_repeat_consistency_check`, `study_todos_repeat_group_idx`를 추가했다.
- 변경 이유: 캘린더 모달에서 이미 등록된 할 일의 시간, 요일, 반복 종료일을 다시 열어 수정할 수 있어야 하기 때문이다.
- 관련 기능: 출석 캘린더 todo 편집, 요일 반복 todo, 선택형 시간 todo
- 마이그레이션 파일: `supabase/migrations/0020_study_todo_repeat_metadata.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260615152037 study_todo_repeat_metadata` 확인
- 주의 사항: 반복 규칙 전용 테이블은 아직 없다. 기존 date-based `study_todos` 행을 유지하되, weekly row에만 가벼운 반복 메타데이터를 저장한다.

### 2026-06-14

- 변경 대상: `public.notification_targets`, `public.kakao_message_connections`, `attendance-cron`
- 변경 내용: `0018_disable_kakao_notifications.sql`로 enabled `kakao_memo` target과 enabled Kakao connection을 비활성화했다. `attendance-cron`에서는 Kakao Memo API 발송 분기를 제거하고 Slack/WebPush/Email/Expo 경로만 유지했다. 원격 `attendance-cron` version 15를 ACTIVE로 배포했고, legacy `kakao-token`과 `telegram-test-alarm` Edge Function은 삭제했다.
- 변경 이유: 알림 채널을 Slack Bot API 중심으로 정리하고, 사용하지 않는 Kakao OAuth/토큰/발송 경로로 인한 설정 혼동을 제거하기 위해서다.
- 관련 기능: Slack 알림, 예약 출석 알림, 카메라 경고 알림, Kakao 알림 폐기
- 마이그레이션 파일: `supabase/migrations/0018_disable_kakao_notifications.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `disable_kakao_notifications` 확인, Supabase Edge Function list에서 `attendance-cron` v15 ACTIVE 및 legacy 함수 삭제 확인
- 주의 사항: 과거 Kakao delivery 기록과 legacy schema는 보존한다. 활성 제품 경로에서는 Kakao target을 조회하거나 발송하지 않는다.

### 2026-06-14

- 변경 대상: `public.study_todos`, `attendance-cron`, `slack-test-alarm`
- 변경 내용: `study_todos`에 선택형 `start_time`, `end_time` 컬럼과 `study_todos_time_window_check` 제약을 추가했다. `attendance-cron`과 `slack-test-alarm`은 todo 조회 시 시간 컬럼을 포함하고, Slack/WebPush/이메일 알림 본문에 시간 범위를 포함하도록 변경했다.
- 변경 이유: 사용자가 Google Calendar처럼 하루 todo에 선택형 시작/종료 시간을 설정하고, 반복 요일 등록에도 같은 시간 범위를 적용하기 원했기 때문이다.
- 관련 기능: 할 일 등록, 요일 반복 todo, 오늘 할 일 표시, Slack/WebPush/이메일 알림 본문
- 마이그레이션 파일: `supabase/migrations/0016_study_todo_time_window.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260614115454 study_todo_time_window` 확인, Edge Function list에서 `attendance-cron` v12와 `slack-test-alarm` v2 ACTIVE 확인
- 주의 사항: 기존 todo는 시간 컬럼이 null이므로 기존 표시와 동작이 유지된다.

### 2026-06-14

- 변경 대상: `public.get_due_reminders`, `public.mark_missed_attendance`
- 변경 내용: 알림 시간 이전에 시작한 공부 세션이 `reminder_at` 시각을 지나 계속 열려 있거나, `reminder_at` 이후에 종료된 경우 출석 충족 세션으로 인정한다. 이 경우 초기 알림과 15분 재촉 알림을 보내지 않고, pending 출석은 결석 처리 전에 `present`로 보정한다.
- 변경 이유: 사용자가 이미 공부 중인데 20:30 알림 모달과 서버 알림이 다시 발생하는 문제를 막기 위해서다.
- 관련 기능: 강제 출석 알림, Slack/WebPush 예약 알림, 출석/결석 자동 처리
- 마이그레이션 파일: `supabase/migrations/0015_pre_reminder_active_session_attendance.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260614114124 pre_reminder_active_session_attendance` 확인
- 주의 사항: 시작 순간에는 pre-reminder 세션을 즉시 `present`로 만들지 않고, 알림 시각 cron에서 세션이 `reminder_at`을 실제로 걸쳤을 때만 보정한다.

### 2026-06-14

- 변경 대상: `public.notification_targets`, `public.notification_deliveries`, `attendance-cron`, `camera-presence-warning`, `slack-test-alarm`
- 변경 내용: `slack` 알림 채널을 추가하고, 기존 enabled Telegram target을 비활성화하는 migration을 추가했다. `attendance-cron`과 `camera-presence-warning`은 Slack Bot API `chat.postMessage`를 사용하도록 전환했고, 수동 테스트 함수는 `slack-test-alarm`으로 교체했다.
- 변경 이유: 사용자가 Telegram 대신 Slack bot 기반 알림을 원하고, 기존 예약 알림/오늘 할 일/카메라 경고를 Slack으로 받아야 하기 때문이다.
- 관련 기능: Slack 알림, Slack 테스트 알림, 카메라 자리 비움 경고, 강제 출석 알림
- 마이그레이션 파일: `supabase/migrations/0014_slack_notification_targets.sql`
- 확인 방법: `npm.cmd test`에서 Slack migration, `attendance-cron`, `camera-presence-warning`, `slack-test-alarm` source test 통과. 원격 Supabase migration list에서 `20260614112431 slack_notification_targets`를 확인했고, Edge Function list에서 `attendance-cron` version 11, `camera-presence-warning` version 3, `slack-test-alarm` version 1 ACTIVE를 확인했다.
- 주의 사항: 실제 Slack 발송에는 Supabase Edge Function secret `SLACK_BOT_TOKEN` 또는 `STUDY_ALERT_SLACK_BOT_TOKEN` 설정과 Slack bot의 채널 초대가 필요하다.

### 2026-06-14

- 변경 대상: `apps/web/src/cameraPresence.mjs`, `public.end_study_session`
- 변경 내용: 카메라 미감지 5분에는 경고만 보내고, 총 10분 미감지부터 타이머를 자동 일시정지하도록 변경했다. 제외 시간은 10분 이후의 자동 일시정지 구간만 계산한다.
- 변경 이유: 사용자가 경고 후 5분 복귀 유예 시간을 원했고, 해당 유예 시간은 공부 시간에 포함하기로 결정했기 때문이다.
- 관련 기능: 카메라 기반 자리 비움 경고, 공부 시간 자동 일시정지, 공부 시간 제외
- 마이그레이션 파일: 없음
- 확인 방법: `npm.cmd test`에서 5분 경고/10분 일시정지/제외 시간 계산 테스트 통과.
- 주의 사항: 10분 미복귀 자동 종료는 더 이상 새 정책에 포함되지 않는다.

### 2026-06-14

- 변경 대상: `public.study_presence_events`, `camera-presence-warning`
- 변경 내용: `study_presence_events_event_type_check` constraint에 `camera_required_warning`을 추가했다. `camera-presence-warning` Edge Function version 2는 request body의 `eventType`을 파싱하고, `camera_required_warning`에는 `absenceSeconds=0`을 허용하며 Telegram 경고 문구를 별도로 보낸다.
- 변경 이유: 공부 세션 시작 전 카메라 감시를 필수화하고, 활성 세션 중 카메라가 꺼진 경우 앱/Telegram 경고를 기록하기 위해서다.
- 관련 기능: 카메라 필수 출석 게이트, Telegram 카메라 꺼짐 경고
- 마이그레이션 파일: `supabase/migrations/0012_camera_required_warning.sql`
- 확인 방법: Supabase SQL verification에서 `camera_required_warning_allowed=true`, Edge Function list에서 `camera-presence-warning` version 2 ACTIVE 확인.

### 2026-06-14

- 변경 대상: `public.end_study_session`
- 변경 내용: `end_study_session` RPC를 `p_excluded_seconds integer default 0` 인자를 받도록 교체하고, `duration_seconds`를 전체 경과 시간에서 제외 초를 뺀 값으로 저장하도록 했다.
- 변경 이유: 5분 이상 상반신 미감지로 자동 일시정지된 시간과 10분 미복귀 자동 종료 전의 자리 비움 시간을 공부 시간에서 제외하기 위해서다.
- 관련 기능: 카메라 미감지 자동 일시정지, 10분 미복귀 자동 종료, 공부 시간 제외
- 마이그레이션 파일: `supabase/migrations/0013_exclude_camera_absence_from_sessions.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP `_apply_migration` success, migration list의 `exclude_camera_absence_from_sessions` 확인.
- 주의 사항: `verify_jwt=false`는 CORS preflight 때문에 유지하지만 함수 내부에서 Supabase JWT와 세션 소유권을 검증한다.

### 2026-06-13

- 변경 대상: `public.study_presence_events`, `camera-presence-warning`
- 변경 내용: 카메라 감시 이벤트 테이블을 추가하고 RLS/metadata no-media 제약을 설정했다. `camera-presence-warning` Edge Function version 1을 배포해 Supabase JWT와 `study_sessions.user_id`를 검증한 뒤 `absence_warning` 이벤트와 Telegram 경고를 처리한다.
- 변경 이유: 활성 공부 세션 중 5분 동안 얼굴이 감지되지 않으면 경고하되, 사진/영상/얼굴 특징값은 저장하지 않기 위해서다.
- 관련 기능: 카메라 기반 자리 비움 경고, Telegram 경고, 공부 습관 강제 장치
- 마이그레이션 파일: `supabase/migrations/0011_study_presence_events.sql`
- 확인 방법: Supabase SQL verification에서 `table_exists=true`, `rls_enabled=true`, `policy_count=2`, `metadata_no_media_check_exists=true`, `event_type_check_exists=true`를 확인했다. Edge Function list에서 `camera-presence-warning` version 1 ACTIVE를 확인했다.
- 주의 사항: Vercel production에는 아직 웹 UI 변경이 배포되지 않았다. `VERCEL_TOKEN` 또는 CLI login/device auth가 필요하다.

### 2026-06-13

- 변경 대상: `public.get_due_reminders(timestamptz)`, `public.mark_missed_attendance(timestamptz)`, `public.start_study_session()`, `attendance-cron`, `telegram-test-alarm`
- 변경 내용: 출석 마감을 알림 후 30분으로 확장하고, 알림 후 15분에 `reminder_stage = 'nudge'` 재촉 알림을 발송하도록 변경했다. `attendance-cron`은 `initial`/`nudge` stage에 따라 제목/본문을 다르게 만들고 push payload에 `reminderStage`를 포함한다.
- 변경 이유: 사용자가 8:30 1차 알림, 8:45 재촉 알림, 9:00 결석 처리 흐름을 요청했다.
- 관련 기능: 강제 출석, Telegram 알림, Web Push 컴퓨터 알림, 이메일 fallback, 앱 내부 알림 팝업
- 마이그레이션 파일: `supabase/migrations/0010_two_step_attendance_deadline.sql`
- 확인 방법: Supabase migration history에 `two_step_attendance_deadline` 확인, 원격 함수 정의의 `reminder_stage`/`nudge`/`interval '30 minutes'` 조건 확인, `attendance-cron` version 10 ACTIVE 및 `telegram-test-alarm` version 3 ACTIVE 확인.
- 주의 사항: 8:45 재촉 알림은 `attendance_days.status = 'pending'`이 존재해야 발송된다. 따라서 8:30 initial reminder cron이 정상 실행되어 pending row를 만들어야 한다.

### 2026-06-11

- 변경 대상: `public.start_study_session()`
- 변경 내용: `attendance_days.status = 'present'` 쓰기를 `now() >= reminder_at and now() <= deadline_at` 조건 안으로 이동했다.
- 변경 이유: 알림 시간 전에 타이머를 짧게 시작해도 당일이 `present`가 되어, 실제 알림 시간에는 `get_due_reminders()`가 사용자를 제외하는 문제가 있었다.
- 관련 기능: 강제 출석, Telegram 알림, Web Push 컴퓨터 알림
- 마이그레이션 파일: `supabase/migrations/0009_start_session_attendance_window.sql`
- 확인 방법: Supabase MCP `_apply_migration` 성공, migration history의 `start_session_attendance_window` 확인, 원격 함수 정의의 `function_guard=True` 확인.
- 주의 사항: 기존에 잘못 생성된 `present` 행은 이 migration이 자동 보정하지 않는다.

### 2026-06-11

- 변경 대상: `telegram-test-alarm` Edge Function
- 변경 내용: version 2를 배포했다. 기존 `x-cron-secret` 관리자 호출은 유지하면서, 브라우저에서 Supabase JWT로 호출할 수 있게 CORS와 JWT 검증을 추가했다. JWT 호출은 `admin.auth.getUser(jwt)`로 사용자를 확인하고 `notification_targets.user_id`가 로그인 사용자와 일치하는 Telegram target만 사용한다.
- 변경 이유: 사용자가 웹 설정 화면에서 직접 Telegram 테스트 알림을 보내고, 오늘 todo 포함 여부를 확인할 수 있어야 하기 때문이다.
- 관련 기능: Telegram 테스트 알림, todo 포함 알림, 웹 설정 화면
- 마이그레이션 파일: 없음
- 확인 방법: Supabase MCP `_deploy_edge_function`으로 `telegram-test-alarm` version 2 ACTIVE 확인, 인증 없는 POST 호출이 `401`을 반환함 확인.
- 주의 사항: `CRON_SECRET`과 `TELEGRAM_BOT_TOKEN`은 브라우저에 노출하지 않는다. 운영 웹 UI 반영은 Vercel production 배포가 필요하다.

### 2026-06-11

- 변경 대상: `telegram-test-alarm` Edge Function, `notification_deliveries`
- 변경 내용: `x-cron-secret`으로 보호되는 Telegram 테스트 발송 Edge Function을 추가하고 version 1 ACTIVE로 배포했다. 함수는 최신 enabled Telegram target 1개를 조회하고, 해당 사용자의 오늘 `study_todos`를 메시지에 포함한 뒤 Telegram Bot API `sendMessage`를 호출한다.
- 변경 이유: 기존 `attendance-cron`은 실제 due reminder 처리용이라 수동 테스트 1회 발송에 적합하지 않고, 로컬에서 bot token을 직접 다루면 secret 노출 위험이 있기 때문이다.
- 관련 기능: Telegram 테스트 알림, todo 포함 알림, 알림 발송 기록
- 마이그레이션 파일: 없음
- 확인 방법: Supabase MCP `_deploy_edge_function`으로 `telegram-test-alarm` version 1 ACTIVE 확인, Edge Function 호출 결과 `local_date=2026-06-11`, `todo_count=0`, `message_id=5` 확인.
- 주의 사항: `verify_jwt=false` 배포지만 함수 내부에서 `CRON_SECRET`을 검증한다. Telegram bot token과 cron secret 원문은 문서화하지 않는다.

### 2026-06-11

- 변경 대상: `attendance-cron`
- 변경 내용: due reminder 대상자의 `study_todos`를 `user_id`와 `local_date` 기준으로 조회하고, 알림 본문에 `오늘 할 일` 요약을 포함하도록 변경했다.
- 변경 이유: Telegram 및 컴퓨터 알림을 받을 때 그날 작성한 todo list도 함께 확인해야 하기 때문이다.
- 관련 기능: Telegram 알림, Web Push 컴퓨터 알림, 앱 내부 알림 팝업, todo list
- 마이그레이션 파일: 없음
- 확인 방법: `npm.cmd test` 31개 통과, `npm.cmd run build` 통과, Supabase `attendance-cron` version 9 ACTIVE 배포 확인, Vercel latest deployment READY 및 배포 JS에 `reminder-todos` UI 포함 확인.
- 주의 사항: 실제 알림 본문은 알림 시간이 도래해 Supabase Cron이 `attendance-cron`을 호출할 때 생성된다. 실수신 검증은 알림 시간을 현재 시각 기준 2~3분 뒤로 설정해 확인한다.

### 2026-06-11

- 변경 대상: Supabase Auth URL config, Edge Function secrets
- 변경 내용: Vercel 운영 URL `https://study-room-attendance.vercel.app`를 Supabase Auth `site_url`과 redirect allow list에 추가했고, Edge Function secret `APP_ORIGIN`을 같은 URL로 설정했다.
- 변경 이유: Vercel 배포 환경에서 Google OAuth callback과 Telegram 메시지의 앱 링크가 운영 URL을 사용해야 하기 때문이다.
- 관련 기능: Vercel 정적 배포, Google 로그인, Telegram 알림 링크
- 마이그레이션 파일: 없음
- 확인 방법: Vercel URL과 `/auth/callback`이 200을 반환했고, 배포된 JS 번들에 Supabase 프로젝트 URL이 포함되며 Google 로그인 비활성화 문구와 placeholder가 없음을 확인했다. Supabase Google authorize endpoint가 Vercel callback 기준 `302 Found`를 반환함도 확인했다.
- 주의 사항: Vercel CLI 최신 버전은 한글 Windows hostname이 `user-agent`에 들어가 실패하므로 OAuth device login과 `vercel@48.6.0 --token` 경로를 사용했다.

### 2026-06-11

- 변경 대상: `notification_targets`, `notification_deliveries`, `attendance-cron`, Edge Function secrets
- 변경 내용: `telegram` 알림 채널을 추가하고, `attendance-cron` Edge Function에 Telegram Bot API `sendMessage` 발송 분기를 추가했다. Edge Function secrets에는 `RESEND_API_KEY`와 `TELEGRAM_BOT_TOKEN`이 설정되어 있음을 확인했다.
- 변경 이유: 이메일 fallback을 복구하고, Kakao OAuth보다 단순한 개인용 메시지 알림 채널을 제공하기 위해서.
- 관련 기능: Telegram 알림, 이메일 fallback, 앱 내부 팝업 알림
- 마이그레이션 파일: `supabase/migrations/0008_telegram_notification_targets.sql`
- 확인 방법: 원격 DB constraint가 `telegram`을 허용하는지 확인했고, `attendance-cron` version 6 ACTIVE 배포를 확인했다. `npm.cmd test`와 `npm.cmd run build`가 통과했다.
- 주의 사항: 실제 Telegram 발송에는 사용자가 bot에게 먼저 메시지를 보내고 Chat ID를 앱 설정에 저장해야 한다. `APP_ORIGIN`은 아직 배포 URL이 없어 missing이다.

### 2026-06-08

- 변경 대상: `kakao_message_connections`, `notification_targets`, `notification_deliveries`, `kakao-token`, `attendance-cron`
- 변경 내용: `kakao_message_connections` 토큰 저장 테이블을 추가하고, 알림 대상/발송 기록 체크 제약에 `kakao_memo` 채널을 추가했다. `kakao-token` Edge Function을 추가해 Kakao provider token을 서버 측에 저장하고, `attendance-cron` Edge Function에 Kakao Talk Message API 나에게 보내기 발송 분기를 추가했다.
- 변경 이유: 사용자가 이메일/Google 로그인 계정을 유지하면서 카카오톡 나에게 보내기 알림만 별도로 연결할 수 있어야 하기 때문이다.
- 관련 기능: 카카오톡 알림 연결, Supabase Cron 기반 서버 측 알림, 컴퓨터가 꺼져 있어도 동작하는 알림
- 마이그레이션 파일: `supabase/migrations/0007_kakao_message_notifications.sql`
- 확인 방법: 원격 DB에서 `public.kakao_message_connections` 존재와 `kakao_memo` constraint 포함을 확인했다. Edge Function 목록에서 `kakao-token` version 2 ACTIVE, `attendance-cron` version 4 ACTIVE를 확인했다. `kakao-token` CORS preflight는 204, 인증 없는 GET은 함수 내부 401을 반환했다.
- 주의 사항: Supabase Auth `security_manual_linking_enabled`가 아직 false이므로 사용자가 직접 Manual Linking을 켜야 한다. Edge Function secrets `KAKAO_REST_API_KEY`, 필요 시 `KAKAO_CLIENT_SECRET`, 배포 URL 확정 시 `APP_ORIGIN`도 아직 설정해야 한다.

### 2026-06-08

- 변경 대상: Supabase Auth Kakao Provider
- 변경 내용: 원격 프로젝트 `bqohkdzvxbrokkmuhysx`의 `external_kakao_enabled`를 `true`로 설정했다. Kakao Client ID/Secret은 이미 설정되어 있었고, `external_kakao_email_optional`은 `false`로 유지했다.
- 변경 이유: Kakao OAuth 요청이 `Unsupported provider: provider is not enabled` 오류로 실패했기 때문이다.
- 관련 기능: 카카오 로그인, 카카오톡 나에게 보내기 알림 연동 준비
- 마이그레이션 파일: 없음
- 확인 방법: `/auth/v1/authorize?provider=kakao&redirect_to=http://127.0.0.1:5177/auth/callback` 요청이 `302 Found`와 Kakao OAuth URL을 반환함. `scopes=talk_message ...` 파라미터를 넣으면 Kakao OAuth URL의 scope에 `talk_message`가 포함됨.
- 주의 사항: 현재 앱 UI와 `attendance-cron`에는 아직 Kakao 연결/발송 채널이 없다.

### 2026-06-08

- 변경 대상: Supabase Auth Google Provider
- 변경 내용: 원격 프로젝트 `bqohkdzvxbrokkmuhysx`의 `external_google_enabled`를 `true`로 설정했다. Google Client ID/Secret은 이미 등록되어 있었고, `uri_allow_list`에는 `http://127.0.0.1:5177/auth/callback`, `http://localhost:5177/auth/callback`이 포함되어 있음을 확인했다.
- 변경 이유: Google OAuth 요청이 `Unsupported provider: provider is not enabled` 오류로 실패했기 때문이다.
- 관련 기능: Google 로그인, Supabase Auth OAuth callback
- 마이그레이션 파일: 없음
- 확인 방법: `/auth/v1/authorize?provider=google&redirect_to=http://127.0.0.1:5177/auth/callback` GET 요청이 `302 Found`와 Google OAuth URL을 반환함.
- 주의 사항: Google Cloud OAuth Client의 Authorized redirect URI에는 Supabase callback `https://bqohkdzvxbrokkmuhysx.supabase.co/auth/v1/callback`이 필요하다.

### 2026-06-07

- 변경 대상: Supabase Edge Function secrets, Vault, pg_cron, `get_due_reminders`
- 변경 내용: `CRON_SECRET`과 VAPID key pair를 설정하고, Vault `project_url`/`cron_secret` 및 `study-room-attendance-cron`을 등록했다. `get_due_reminders`의 PL/pgSQL column ambiguity를 `attendance_days_pkey` constraint와 `dn.*` alias로 수정했다.
- 변경 이유: S3/정적 앱에서도 서버 측 알림/출석 자동 처리를 Supabase만으로 수행하기 위해서.
- 관련 기능: 알림 발송, 결석 처리, 웹 푸시
- 마이그레이션 파일: `supabase/migrations/0006_fix_due_reminders_ambiguity.sql`
- 확인 방법: `net._http_response` 최신 자동 cron 응답이 200이고, content가 `{"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}` 형태로 반환됨.
- 주의 사항: `RESEND_API_KEY`와 Expo `EXPO_PUBLIC_EAS_PROJECT_ID`는 아직 별도 설정 필요.

## Session Activity Heartbeat

- Auth session persistence and study-session activity are separate concerns. Supabase Auth continues to use persistent browser storage, while counted study time uses a separate per-user/per-study-session heartbeat.
- Web active sessions store localStorage key study-room-session-activity:{userId}:{sessionId}.
- The heartbeat interval is 15 seconds. A missing heartbeat for more than 5 minutes is treated as browser/computer inactivity, not as valid study time.
- On active-session restore, stale activity calls end_study_session with p_excluded_seconds equal to the existing camera/lease exclusion plus the inactive gap.
- pagehide and beforeunload only update the final activity timestamp; they still do not directly end the session.
- visibilitychange to visible refreshes the activity timestamp so ordinary tab switching is not mistaken for browser close.
- This MVP is same-browser only. A server-side heartbeat or Supabase Cron cleanup would be needed for cross-device enforcement.

## Timed Todo Reminder Rescheduling

- Timed todo Slack reminders are still computed by Supabase Cron from current study_todos rows through get_due_todo_schedule_reminders(p_now).
- study_todo_schedule_deliveries remains the duplicate-lock table keyed by todo_id, target_id, reminder_type, and scheduled_at.
- Migration 20260628174500_clear_future_todo_schedule_deliveries.sql adds clear_future_todo_schedule_deliveries(p_todo_ids, p_changed_at) and an AFTER UPDATE trigger on study_todos(start_time, end_time, is_completed).
- When a schedule changes, future reminder locks for that todo are deleted so the next cron evaluation can send according to the current start/end time.
- Past sent reminders are retained as delivery history and cannot be unsent.

## 2026-07-05 CI Build Script Note

- Root build script: package.json build uses npm --workspace apps/web run build so GitHub Actions ubuntu-latest can run npm run build. Local Windows operators should continue invoking it as npm.cmd run build from PowerShell.

## Slack Session Lease User Mentions

- notification_targets can store an optional slack_user_id for Slack targets.
- The value is a Slack member ID beginning with U or W, such as U123ABC456. It is not a Slack display name or email.
- Web settings normalize and validate the value before saving it. Blank values are allowed and keep the existing channel-only behavior.
- get_due_session_lease_warnings(p_now) returns slack_user_id together with channel_id so attendance-cron can render a mention in the same message.
- attendance-cron prepends <@SlackUserId> only to the active session lease warning that is sent 5 minutes before lease_expires_at.
- Scheduled study alarms, todo reminders, camera warnings, and recovery routines continue to use channel delivery without forced user mentions unless a future PRD expands that scope.
