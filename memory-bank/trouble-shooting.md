# Trouble Shooting

## 2026-06-28 - Slack schedule extension kept selected todo start fixed

### Situation

The user clicked a Slack `10 minute extension` button for a timed todo such as `Python study 18:45-19:45`. The app changed it to approximately `18:45-19:55`; the selected todo start time stayed fixed while only the end time moved.

### Error Message

```txt
User-visible symptom:
- Selected schedule start time remains unchanged after Slack extension.
- Only the selected schedule end time and later todos move.
```

### Cause

`public.extend_todo_schedule` intentionally special-cased the selected todo with `when st.id = selected_todo.id then st.start_time`. That older policy extended the selected block duration instead of moving the selected schedule window. Later todos already shifted because they used the general `start_time + extension` calculation.

### Fix

Added migration `20260628102000_shift_selected_todo_schedule.sql` to replace the RPC. The selected todo now uses the same start/end shift expression as later incomplete timed todos. The existing reminder duplicate lock includes `scheduled_at`, so a shifted start time or shifted end-soon time creates a different reminder key and can be sent at the new time.

### Related Files

- `supabase/migrations/20260628102000_shift_selected_todo_schedule.sql`
- `supabase/migrations/20260628080450_extend_todo_schedule.sql`
- `supabase/migrations/20260628064614_study_todo_schedule_reminders.sql`
- `packages/core/test/sql-migrations.test.mjs`

### Prevention

Schedule extension tests must assert both selected start and selected end move together. When changing reminder timing, verify duplicate protection includes the concrete scheduled timestamp instead of only todo id and reminder type.
## 2026-06-28 - Slack schedule extension must reuse the existing Interactivity URL

### Situation

While adding Slack buttons for timed todo schedule extension, a separate `slack-schedule-interactions` Edge Function was considered.

### Error Message

No runtime error was emitted yet. The likely user-visible failure would be one of the Slack button families not responding, depending on which endpoint was configured in Slack App Interactivity.

### Cause

A Slack App has a single Interactivity Request URL. The product already uses `/functions/v1/slack-recovery-interactions` for recovery routine buttons and modals. Adding a second schedule-only request URL would require changing Slack App settings and would break recovery routine actions.

### Fix

Keep `/functions/v1/slack-recovery-interactions` as the single Slack interaction router. Route schedule extension actions and `study_schedule_extension` modal submissions inside the same function, while preserving existing recovery routine action handling.

### Related Files

- `supabase/functions/slack-recovery-interactions/index.ts`
- `supabase/functions/attendance-cron/index.ts`
- `packages/core/test/sql-migrations.test.mjs`

### Prevention

Before adding Slack interactive features, check whether they can be routed through the existing Slack Interactivity endpoint. Add a new function only if it is called by the existing router or if the Slack App configuration is intentionally redesigned.

## 2026-06-28 - Todo edit modal showed unrelated same-day todos

### Situation

The user edited a todo such as React study from the daily planner, but the modal still displayed other same-day todos such as Excel study and stock automation bot below the edit form.

### Error Message

No runtime error. User-visible symptom: unrelated todos appear in the edit modal.

### Cause

The app reused the selected date checklist modal for both create and edit flows. The form entered edit mode through editingTodoId, but the checklist below the form always rendered selectedDateTodos.

### Fix

Added visibleTodoModalItems. In create mode it uses selectedDateTodos. In edit mode it uses [editingTodo], so the modal list and completion summary only reflect the todo being edited.

### Related Files

- apps/web/src/main.tsx
- apps/web/test/slackNotifications.test.mjs

### Prevention

When a shared create/edit modal includes contextual lists, derive visible list data from the current mode instead of always rendering the parent date collection.

## 2026-06-28 - PowerShell rewrite corrupted Korean strings during todo modal patch

### Situation

While applying the fix, a PowerShell Set-Content based edit rewrote main.tsx and converted many Korean strings into mojibake.

### Error Message

The git diff showed hundreds of unrelated Korean string changes in apps/web/src/main.tsx.

### Cause

PowerShell text decoding/encoding did not preserve the existing UTF-8 content during whole-file rewrite.

### Fix

Restored the affected files from HEAD, then reapplied the patch through a UTF-8-safe Node script using ASCII search patterns only.

### Related Files

- apps/web/src/main.tsx
- apps/web/test/slackNotifications.test.mjs

### Prevention

For UTF-8 TSX files with Korean UI text, avoid PowerShell Get-Content/Set-Content whole-file rewrites. Prefer apply_patch. If apply_patch is unavailable due sandbox ACLs, use Node fs.readFileSync/writeFileSync with UTF-8 and ASCII-only replacement patterns.


# Trouble Shooting

## 2026-06-28 - Recovery submit did not resume blocked start

### Situation

The user clicked `입장하고 시작`, was blocked by a pending in-app recovery routine, filled in the recovery reason and plan, and expected the modal to close and the study session to start. The app only submitted the recovery request and left the user without a resumed start flow.

### Error Message

```txt
User-visible symptom:
- The recovery routine modal appears to remain part of the flow after submit.
- A study session does not start automatically after clicking "제출하고 잠금 해제".
```

### Cause

`startTimer()` opened the recovery modal when pending recovery existed, but it did not persist that the user had originally attempted to start a study session. After `submitRecoveryRoutine()` succeeded, the code marked the recovery request as submitted and reloaded dashboard data, but no code resumed the original start action.

### Fix

Added `shouldResumeStartAfterRecoveryUnlock()` and a short-lived `resumeStartAfterRecoveryUnlock` state. `startTimer()` sets this state only when pending recovery blocks a user-initiated start. After successful recovery submission, the app waits for dashboard data refresh, closes the recovery modal, clears the blocker, and a React effect calls `startTimer()` again when no pending recovery remains.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/recoveryStartResume.mjs`
* `apps/web/test/recoveryStartResume.test.mjs`

### Prevention

Any future modal gate that blocks a user-initiated start should either resume the original action after successful unlock or explicitly clear the start intent when the user chooses `나중에`.

## 2026-06-25 - Recovery pledge was created as a todo

### Situation

The user entered a recovery routine after going to the study room. When the final `내일 재도전 약속` field contained phrases such as `8시30분에 시작` or `9시에 시작`, that pledge appeared as a todo in the next session planning list.

### Error Message

```txt
User-visible symptom:
- The recovery pledge field is reflected as a todo.
- Appointment-style text appears in the session todo selection modal.
```

### Cause

Both recovery submission paths treated the pledge as a task. The app RPC `submit_study_recovery_request` inserted `p_pledge_todo_title` into `study_todos` for the next local date, and Slack `slack-recovery-interactions` created a second todo from `pledgeTodoTitle`.

### Fix

Keep `pledge_todo_title` as required recovery-request text, but create only the makeup todo. The new migration `20260625115531_recovery_pledge_note_only.sql` redefines the RPC to store the pledge and set `pledge_todo_id = null`; the Slack Edge Function now creates only the makeup todo and updates `pledge_todo_id: null`.

### Related Files

* `apps/web/test/recoveryRoutine.test.mjs`
* `supabase/functions/slack-recovery-interactions/index.ts`
* `supabase/migrations/20260625115531_recovery_pledge_note_only.sql`
* `memory-bank/prd-slack-recovery-routines.md`

### Prevention

Treat recovery pledge text as a promise/note, not a session-selectable task. If future recovery fields are added, decide explicitly whether each field should create a `study_todos` row.

## 2026-06-23 - Supabase migration new timed out

### Situation

While adding forever recurring todo support, `npx.cmd supabase migration new study_todo_repeat_forever` was attempted from the repository root.

### Error Message

```txt
command timed out after 60269 milliseconds
```

### Cause

The local Supabase CLI invocation did not finish in this Windows environment. No migration file was created under `supabase/migrations`.

### Fix

Created `supabase/migrations/20260623143000_study_todo_repeat_forever.sql` manually and applied the DDL to project `bqohkdzvxbrokkmuhysx` with Supabase MCP `_apply_migration`.

### Related Files

* `supabase/migrations/20260623143000_study_todo_repeat_forever.sql`
* `packages/core/test/sql-migrations.test.mjs`

### Prevention

If `supabase migration new` hangs again, check whether a file was actually created. If not, create a clearly named migration file manually, then use Supabase MCP for remote DDL and verify with `_list_migrations` plus SQL schema checks.

## 2026-06-23 - Camera source tests failed after adding layout-order classes

### Situation

While wiring the Today dashboard section order editor, the camera layout source tests failed even though the camera UI behavior had not changed.

### Error Message

```txt
AssertionError [ERR_ASSERTION]: assert.ok(sectionStart > 0)
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /camera-diagnostic/. Input: ''
```

### Cause

`apps/web/test/cameraPresence.test.mjs` locates the Today Focus block by searching for the literal source string `<section className="daily-visual"` and the following `<section className="today-task-panel"`. Changing those opening tags to multiline tags or changing the literal class start to `daily-visual today-ordered-section` made the source slice empty.

### Fix

Kept the original `className="daily-visual"` and `className="today-task-panel"` literals intact, and applied dashboard section ordering through inline `style.order` instead of adding an extra class to those two sections.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/test/cameraPresence.test.mjs`

### Prevention

Before changing Today Focus or Today Task section opening tags, check source-based tests that use `indexOf()` against literal JSX strings. Prefer preserving those literals or update the test intentionally in the same change.

## 2026-06-23 - Same-day missed recovery did not block study

### Situation

After the 21:00 missed-attendance deadline, Slack sent a recovery routine message saying the user must submit reason and makeup plan before the next study session. The web app still allowed a same-day late study session to continue.

### Error Message

```txt
Slack: 회복 루틴이 아직 제출되지 않았습니다.
Web symptom: active study timer continued while a missed_attendance recovery request was pending.
```

### Cause

The previous late-study policy intentionally treated same-day `missed_attendance` recovery requests as a soft action. The web app filtered them out of `blockingRecoveryRequests`, rendered a `lateStudyRecoveryRequests` soft card, and the Supabase `start_study_session()` RPC allowed them with `rr.trigger_type <> 'missed_attendance' or rr.local_date <> v_local_date`.

This contradicted the Slack recovery message and the newer product expectation that recovery submission is mandatory before studying again.

### Fix

Removed the same-day missed-attendance exception. The web app now treats every pending recovery request as blocking, removes the soft late-study card, auto-opens the recovery modal, and ends an already-active web session if pending recovery appears. Supabase migration `20260623123718_hard_block_pending_recovery_requests.sql` redefines `start_study_session()` so any pending recovery request raises `Recovery routine required`.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/styles.css`
* `apps/web/test/recoveryRoutine.test.mjs`
* `apps/web/test/slackNotifications.test.mjs`
* `packages/core/test/sql-migrations.test.mjs`
* `supabase/migrations/20260623123718_hard_block_pending_recovery_requests.sql`
* `memory-bank/prd-slack-recovery-routines.md`

### Prevention

Keep Slack copy, web blockers, and `start_study_session()` policy aligned. If the message says recovery is required before studying, do not add a frontend or RPC exception for late same-day study.

## 2026-06-20 - Success message banner stayed visible

### Situation

After creating a study goal, the dashboard continued to show the success banner `목표를 만들었습니다.`.

### Error Message

```txt
목표를 만들었습니다.
```

### Cause

The web app stored action feedback in a single `message` state and rendered it in the dashboard, but successful actions did not clear that state after the user had seen the feedback.

### Fix

Added `appMessage.mjs` to classify success-style messages and wired `main.tsx` to clear only those messages after 5 seconds with `window.setTimeout` cleanup. Validation, required-action, permission, and failure messages stay visible.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/appMessage.mjs`
* `apps/web/test/appMessage.test.mjs`

### Prevention

When adding a new transient success `setMessage(...)`, make sure it matches the success-message classifier or use a dedicated typed notification state if message behavior becomes more complex.

## 2026-06-20 - Goal feature deployment blocked by GitHub network and missing Vercel credentials

### Situation

After implementing the study goal D-day dashboard and applying the Supabase migration, local verification passed and commit `9974e2e Add study goal D-day dashboard` was created. The final deployment step could not complete from the current Codex environment.

### Error Message

```txt
fatal: unable to access 'https://github.com/zxcc9867/studyRoom.git/': Failed to connect to github.com port 443
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### Cause

The environment could not connect to GitHub over HTTPS, so `git push origin main` could not trigger the GitHub Actions Vercel workflow. Direct Vercel CLI deployment also failed because `VERCEL_TOKEN` was not present in the shell and there was no local Vercel login session.

### Fix

The code, tests, migration, and local commit are complete, and the Supabase migration is already applied to project `bqohkdzvxbrokkmuhysx`. Deployment still requires one of the following:

* Restore GitHub network access and run `git push origin main`.
* Set `VERCEL_TOKEN` in the shell and run `npx.cmd --cache .\.npm-cache vercel@48.6.0 deploy --prod --yes --token $env:VERCEL_TOKEN`.
* Run `vercel login` locally, then run `npx.cmd --cache .\.npm-cache vercel@48.6.0 deploy --prod --yes`.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/studyGoals.mjs`
* `supabase/migrations/20260620071258_study_goals.sql`
* `memory-bank/prd-study-goals.md`

### Prevention

Before claiming a Vercel deployment, verify both GitHub push connectivity and one available Vercel credential path. Vercel MCP deployment listing can confirm existing deployments but does not upload this project by itself.

## 2026-06-18 - Recovery routine looked like it was still required after submission

### Situation

The user submitted a recovery routine but the app continued to show the recovery routine prompt.

### Error Message

```txt
User-visible symptom:
- The recovery routine modal still appeared after submitting a routine.
- The user interpreted this as the submitted routine not being accepted.
```

### Cause

Supabase showed the user's 2026-06-18 `missed_attendance` recovery request was correctly `submitted` with reason, makeup todo, pledge todo, and created todo ids. However, an older 2026-06-17 `missed_attendance` request for the same user was still `pending`, so the app correctly had another blocking recovery request.

The UI made this confusing because automatic modal opening used all `pendingRecoveryRequests`, and the modal did not prominently show the recovery request date, queue position, or remaining count.

### Fix

The web app now sorts pending recovery requests oldest first, auto-opens only blocking recovery requests, and treats same-day missed-attendance recovery as a soft late-study action. After successful submission, the app marks the submitted request locally before reloading the dashboard and shows a message plus the next blocking request if one remains. The modal displays the recovery date, trigger type, queue position, and remaining count.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/styles.css`
* `apps/web/test/recoveryRoutine.test.mjs`
* `memory-bank/prd-slack-recovery-routines.md`

### Prevention

When multiple pending recovery requests exist, show which date and trigger the user is submitting. Do not infer that a submitted request failed until checking the specific `study_recovery_requests.id` status in Supabase.

## 2026-06-18 - Missed attendance despite perceived pre-deadline start

### Situation

The user reported that 2026-06-18 showed `missed` even though they believed they turned the app on at 20:59 JST, before the 21:00 deadline.

### Error Message

```txt
User-visible symptom:
- Attendance calendar 2026-06-18 showed missed.
- The dashboard also displayed a large today-study value, which made it look as if study time existed for the day.
```

### Cause

Production Supabase showed the 2026-06-18 attendance row was marked missed at 2026-06-18 12:00 UTC / 21:00 JST, with reminder 20:30 JST and deadline 21:00 JST. There was no `study_sessions` row for 2026-06-18 and no session near the deadline window, so the cron job had no persisted start record to qualify. `daily_completed_study_seconds()` for the day returned 0 against the 7200 second weekday goal.

The large dashboard study time appears to come from an older completed 2026-06-16 session with a very large duration, not from a saved 2026-06-18 start. Opening the app or camera is not enough; attendance requires a successful `start_study_session()` RPC and a persisted `study_sessions` row.

### Fix

No code fix was applied in this diagnosis step. Recommended product fixes:

* Make the UI clearly show "study session saved" only after `start_study_session()` succeeds.
* Keep the latest two-hour lease and stale-session cleanup behavior visible so old sessions cannot keep confusing today's totals.
* Consider adding a local warning when the user turns on camera but has not yet created a study session.

### Related Files

* `apps/web/src/main.tsx`
* `supabase/migrations/0021_late_study_goal_attendance_policy.sql`
* `supabase/functions/attendance-cron/index.ts`

### Prevention

When debugging attendance failures, first compare `attendance_days`, same-day `study_sessions`, and `daily_completed_study_seconds()`. Do not infer a successful start from camera state or a dashboard timer alone.

## 2026-06-17 - Previous-day active session kept today's status pending

### Situation

The user pressed `입장하고 시작`, but the attendance calendar still showed today's date as `대기`. The top summary also showed an abnormally large `오늘 공부` value.

### Error Message

```txt
User-visible symptoms:
- Attendance calendar date 2026-06-17 remained `대기`.
- Top summary showed more than 21 hours of today study time.
- Supabase showed an active study_sessions row from 2026-06-16 with ended_at = null.
```

### Cause

The app intentionally stopped ending sessions on `pagehide`, `beforeunload`, or `visibilitychange` to avoid losing study time on refresh or tab switches. That preserved active sessions, but it also let forgotten sessions remain `active` across days. The dashboard selected the latest `status = 'active'` row regardless of local date, and `todaySeconds` added its elapsed time even when `activeSession.local_date` was not today's date.

### Fix

Added a two-hour in-app session lease. Active sessions now have a per-user/per-session localStorage deadline, the UI shows a countdown and `세션 유지` button, and expired sessions automatically call `end_study_session`. If an old active session has no stored lease, the app falls back to `started_at + 2 hours`, so previous-day abandoned sessions auto-end after load. The dashboard also only adds active elapsed time to today's summary when the active row's `local_date` matches today's local date.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/sessionLease.mjs`
* `apps/web/test/sessionLease.test.mjs`

### Prevention

Refresh persistence and abandoned-session cleanup must be separate policies. Do not reintroduce browser lifecycle auto-end for tab switches or refresh; use the tested session lease or a future server-side stale-session cleanup job.

## 2026-06-16 - Slack recovery button returns 401

### Situation

The user clicked the Slack `회복 루틴 작성` button, but the recovery modal did not work. The user also requested a Slack test alarm.

### Error Message

```txt
Supabase Edge Function logs:
POST | 401 | https://bqohkdzvxbrokkmuhysx.supabase.co/functions/v1/slack-recovery-interactions
POST | 401 | https://bqohkdzvxbrokkmuhysx.supabase.co/functions/v1/slack-recovery-interactions
POST | 401 | https://bqohkdzvxbrokkmuhysx.supabase.co/functions/v1/slack-recovery-interactions
```

### Cause

The Slack interactivity request reached the correct Supabase Edge Function, but `verifySlackSignature()` rejected it before payload handling. `SLACK_SIGNING_SECRET` exists as a Supabase Edge Function secret, so the likely root cause is that the stored value does not match the Signing Secret from the Slack App that sent the interactive button request.

This is distinct from Slack message delivery. `slack-test-alarm` and existing recovery messages can post to channel `C0BAFS1CSV8`, so the bot token, channel id, and bot channel membership are working.

### Fix

Update Supabase Edge Function secret `SLACK_SIGNING_SECRET` with the Slack App value from:

```txt
Slack App Dashboard > Basic Information > App Credentials > Signing Secret
```

Confirm the same Slack App has:

```txt
Interactivity & Shortcuts: On
Request URL: https://bqohkdzvxbrokkmuhysx.supabase.co/functions/v1/slack-recovery-interactions
```

Then click the same recovery button again. No code change is required if the Signing Secret comes from the correct Slack App.

### Related Files

* `supabase/functions/slack-recovery-interactions/index.ts`
* `supabase/functions/slack-test-alarm/index.ts`
* `memory-bank/prd-slack-recovery-routines.md`

### Prevention

Do not confuse Slack `Client Secret`, `Verification Token`, `Bot User OAuth Token`, or app-level secrets from a different Slack App with the Signing Secret. Recovery interactivity requires the Signing Secret from the exact Slack App that owns the installed bot token and sent the message button.

## 2026-06-16 - New `.mjs` helper missing TypeScript declaration

### Situation

After adding `apps/web/src/attendancePolicy.mjs` and importing it from `main.tsx`, `npm.cmd run build` failed during `tsc -b`.

### Error Message

```txt
src/main.tsx(36,8): error TS7016: Could not find a declaration file for module './attendancePolicy.mjs'.
```

### Cause

The web app compiles TypeScript with `strict: true` and `allowJs: false`. A newly added `.mjs` helper imported by a `.tsx` file needs an adjacent declaration file or TypeScript treats the module as implicitly `any`.

### Fix

Added `apps/web/src/attendancePolicy.mjs.d.ts` with explicit exports for the attendance policy constants and helper functions.

### Related Files

* `apps/web/src/attendancePolicy.mjs`
* `apps/web/src/attendancePolicy.mjs.d.ts`
* `apps/web/src/main.tsx`

### Prevention

When adding a new `.mjs` helper that is imported by TypeScript, add the matching declaration file in the same change before running the production build.

## 2026-06-15 - Camera monitoring stuck in ready state

### Situation

The user showed an active study timer while the camera monitoring panel stayed in `카메라 감시 · 준비 중` with a blank preview and the message `카메라 영상을 불러오는 중입니다. 잠시 기다려주세요.` The user reported that the camera seemed to turn off automatically.

### Error Message

```txt
User-visible symptoms:
- 카메라 감시 · 준비 중
- 카메라 영상을 불러오는 중입니다. 잠시 기다려주세요.
- Preview area is blank while the timer keeps running.
```

### Cause

The camera stream could remain logically enabled while the attached `<video>` element stopped exposing a current frame or valid video size. The app treated `no-current-frame` and `no-video-size` as temporary loading states, but there was no timeout, recovery, or failure transition. If the browser or device stalled, the UI could stay in `준비 중` indefinitely and look like the camera turned itself off.

### Fix

Added a camera frame recovery state machine. If `no-current-frame` or `no-video-size` continues for 15 seconds, the app attempts one same-session camera reconnect. If the reconnect still cannot produce frames, the app releases the stream, resets camera monitoring, and shows a retryable camera error instead of counting absence. The camera control also remains usable while an already-enabled camera is in `준비 중`, so the user can stop monitoring manually.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/cameraFrameRecovery.mjs`
* `apps/web/src/cameraFrameRecovery.d.mts`
* `apps/web/test/cameraFrameRecovery.test.mjs`

### Prevention

Treat camera frame availability as a recoverable device/browser state, not as user absence and not as an infinite loading state. Keep transient camera health reasons behind tested timeout logic, and always leave a user-visible retry path when automatic reconnect fails.

## 2026-06-14 - Slack target hidden save, refresh-ended sessions, and camera stream reload

### Situation

The user reported that Slack was supposedly configured but camera warnings still said Slack was not registered. They also reported that refreshing or reopening the app could make an active timer show less accumulated study time, and that camera monitoring did not reliably come back after refresh.

### Error Message

```txt
User-visible symptoms:
- 자리 비움 이벤트를 기록했습니다. Slack은 아직 등록되지 않았습니다.
- After refresh/re-login, an active session total can look smaller than before.
- Camera monitoring was on before refresh, but the real camera preview/monitoring state is not restored.
```

### Cause

Slack server secrets and direct channel tests do not create a per-user notification target. The web app only saved Slack as a side effect of the general computer notification save button, so users could enter a Channel ID without an obvious action that created `notification_targets.kind = 'slack'` for the logged-in account.

For timer loss, `pagehide` and `beforeunload` fired during refresh/reload and the app sent a keepalive `end_study_session` request. That closed the active session even though the user intended to continue. Browser lifecycle events cannot reliably distinguish refresh from leaving the page.

For camera reload, browser media streams cannot survive a page refresh. The app needed to store only the user's camera-monitoring intent for the same active session and reacquire the camera after reload.

### Fix

Added a dedicated `Slack 채널 저장` button and validation. Removed Kakao UI/linking and Kakao Memo sending from the active product path, and disabled legacy enabled Kakao targets/connections through migration `0018_disable_kakao_notifications.sql`. Deployed the updated `attendance-cron` and deleted legacy remote `kakao-token` and `telegram-test-alarm` Edge Functions from Supabase production.

Changed `shouldEndStudySessionForPageEvent()` so `visibilitychange`, `pagehide`, and `beforeunload` do not automatically end the study session. Added camera monitoring intent helpers and one-shot camera auto-restore for the same active session after refresh.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/sessionExit.mjs`
* `apps/web/src/cameraResume.mjs`
* `apps/web/test/cameraResume.test.mjs`
* `apps/web/test/sessionExit.test.mjs`
* `apps/web/test/slackNotifications.test.mjs`
* `supabase/functions/attendance-cron/index.ts`
* `supabase/migrations/0018_disable_kakao_notifications.sql`

### Prevention

Treat server-level Slack setup and user-level Slack target setup as separate states. Do not end study sessions from browser lifecycle events unless there is a tested, user-approved policy for abandoned sessions. Camera stream restoration after refresh must reacquire the device; never assume a previous `MediaStream` object remains usable.

## 2026-06-14 - Camera black preview counted as upper-body absence

### Situation

The user showed the web app with an active timer, a black camera preview, and a camera status saying upper body was not detected. After enough time, the app showed a seat-away warning and auto-paused even though the user was present.

### Error Message

```txt
User-visible symptom: camera preview is black, app says 상반신 미감지, and warning popup says Slack is not registered.
```

### Cause

The web app treated any PoseLandmarker "no upper body" result as user absence. It did not first verify that the camera stream and video frame were healthy. Therefore a black, muted, ended, stalled, or not-yet-ready camera feed could be interpreted as absence. The upper-body detector also required both shoulders, which was brittle for cropped webcam framing.

The Slack warning path was implemented, but the current user's warning response had `slackMissing=true`, which means no enabled `notification_targets.kind = 'slack'` row was found for that logged-in Supabase user. A server-side direct Slack test does not create this per-user target.

### Fix

Added `cameraVideoHealth.mjs` and wired it into the camera loop before PoseLandmarker detection. Unhealthy camera stream/frame states now reset absence timing and show a camera-specific error instead of accumulating absence. Relaxed upper-body detection so head + one shoulder + same-side hip counts as seated presence. Updated Slack missing-target copy to say the current account needs a saved Slack Channel ID.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/cameraVideoHealth.mjs`
* `apps/web/src/bodyPresenceDetection.mjs`
* `apps/web/test/cameraVideoHealth.test.mjs`
* `apps/web/test/upperBodyPresence.test.mjs`
* `apps/web/test/slackNotifications.test.mjs`

### Prevention

Before counting absence, verify camera stream health and visible frame health separately from pose detection. Keep Slack setup language clear: Edge Function token/channel direct tests validate server capability, but camera warnings require the logged-in user to save a Slack Channel ID target in app settings.

## 2026-06-14 - AGENTS update applied to parent workspace instead of app repo

### Situation

The user asked to add memory-bank workflow instructions to the AGENTS file for the study-room app. The previous update was applied to `C:\jini-dev\project\AGENTS.md`, while the app repository's own `C:\jini-dev\project\study-room-attendance\AGENTS.md` still only contained the minimal Spec Kit block.

### Error Message

```txt
User-visible symptom: C:\jini-dev\project\study-room-attendance\AGENTS.md did not contain the requested memory-bank rules.
```

### Cause

The shell working directory was `C:\jini-dev\project`, and `apply_patch` paths were relative to that parent workspace. Using `AGENTS.md` without the `study-room-attendance/` prefix edited the parent workspace file instead of the app-local file.

### Fix

Restored the parent workspace `AGENTS.md` to generic workspace rules and updated `study-room-attendance/AGENTS.md` directly with app-specific Memory Bank, Supabase, validation, Vercel deployment, Git, Spec Kit, and final response rules.

### Related Files

* `AGENTS.md`
* `memory-bank/active-context.md`
* `memory-bank/progress.md`
* `memory-bank/implementation-plan.md`

### Prevention

For this app, run commands with `workdir = C:\jini-dev\project\study-room-attendance` or use explicit paths prefixed with `study-room-attendance/` when operating from the parent workspace. Before editing app-local instructions, verify both `C:\jini-dev\project\AGENTS.md` and `C:\jini-dev\project\study-room-attendance\AGENTS.md` if the current working directory is ambiguous.

## 2026-06-14 - Overnight todo schedule did not save

### Situation

The user selected a todo schedule from `23:00` to `01:00`, enabled weekday repeat, and clicked save. The modal did not close and the todo appeared not to save.

### Error Message

```txt
User-visible symptom: schedule save stays in the modal and no todo appears.
Frontend validation returned: 종료 시간은 시작 시간보다 늦어야 합니다.
Remote DB constraint before fix: start_time < end_time
```

### Cause

The schedule crosses midnight. The frontend treated every `end_time < start_time` range as invalid, and the remote Supabase `study_todos_time_window_check` constraint also required `start_time < end_time`. Because validation failed before insert, the modal stayed open. If the frontend had allowed it, the database would still have rejected the row.

### Fix

Changed the frontend validation to allow `end_time < start_time` as an overnight schedule and reject only equal start/end times. Added migration `0017_allow_overnight_study_todo_times.sql` to replace the DB check with `start_time <> end_time` when both times are present. Applied the same migration to Supabase project `bqohkdzvxbrokkmuhysx`.

### Related Files

* `apps/web/src/todoSchedule.mjs`
* `apps/web/test/todoSchedule.test.mjs`
* `supabase/migrations/0017_allow_overnight_study_todo_times.sql`
* `packages/core/test/sql-migrations.test.mjs`

### Prevention

For schedule-like inputs, decide whether `end < start` means invalid or next-day before adding frontend and DB constraints. Keep frontend validation and database check constraints equivalent so users do not see a save failure after passing client validation.

## 2026-06-14 - Timed weekday-repeat todos looked unsaved

### Situation

The user reported that saving a todo with weekday selection and time settings did not appear to persist.

### Error Message

```txt
User-visible symptom: after selecting weekdays/time and saving, the expected todo was not visible in the calendar's selected-day todo list.
```

### Cause

There were two UI-side causes:

1. Supabase `time` columns return values such as `09:00:00`, while `formatTodoWithSchedule()` only accepted exact `HH:mm` values. Timed todos could be saved but lose their time label in the UI.
2. Weekly repeat materializes todos only on the selected weekdays. If the user opened a date that was not one of those weekdays, rows were saved on generated dates but the modal closed while the current visible date stayed empty, making the save look like it failed.

The remote Supabase database already had `study_todos.start_time` and `study_todos.end_time`, and migration `study_todo_time_window` was applied.

### Fix

Updated schedule formatting to accept Supabase `HH:mm:ss` time values and normalize them to `HH:mm`. Added `getTodoSaveFocusDate()` so the UI stays on the selected date when a todo is created there, or moves to the first created date when the repeat rule skipped the selected date.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/todoRecurrence.mjs`
* `apps/web/src/todoSchedule.mjs`
* `apps/web/test/todoRecurrence.test.mjs`
* `apps/web/test/todoSchedule.test.mjs`

### Prevention

When reading Supabase `time` columns in the browser, normalize both `HH:mm` and `HH:mm:ss`. For materialized recurring todos, make the post-save visible state point to an actual created date so users can immediately see the saved row.

## 2026-06-14 - GitHub Actions failed reminder popup test in UTC

### Situation

After pushing commit `309481c` to deploy the current app through GitHub Actions, the `Deploy Web to Vercel` workflow failed before the Vercel deploy step.

### Error Message

```txt
test at apps/web/test/reminderPopup.test.mjs:27:1
study reminder popup is shown at reminder minute when no active or final attendance exists
AssertionError [ERR_ASSERTION]: false !== true
```

### Cause

`shouldShowStudyReminderPopup()` accepts a `timeZone` parameter and the web app passes the user's profile timezone. The test omitted `timeZone`, so it used the runtime default timezone. On the local machine the default timezone matched the app expectation, but GitHub Actions ran in UTC, converting `2026-06-14T20:30:15+09:00` to `11:30` for the reminder comparison.

### Fix

Updated `apps/web/test/reminderPopup.test.mjs` to pass `timeZone: "Asia/Tokyo"` in all reminder popup assertions. Reproduced the failure with `TZ=UTC` before the fix and verified the targeted test passes after the fix.

### Related Files

* `apps/web/src/reminderPopup.mjs`
* `apps/web/test/reminderPopup.test.mjs`
* `.github/workflows/vercel-production.yml`

### Prevention

Any test that compares local date or local time must pass an explicit timezone or run under a fixed `TZ` value. Do not rely on the developer machine's timezone matching CI.

## 2026-06-14 - Refresh required login because Supabase session persistence was disabled

### Situation

The user reported that refreshing the web app forced them to log in again instead of preserving the authenticated session.

### Error Message

```txt
User-visible symptom: after refresh, the app shows the login screen again.
```

### Cause

`apps/web/src/supabase.ts` created the Supabase client with `persistSession: false`. That prevents `supabase-js` from storing the access token JWT and refresh token in browser storage. After a refresh, `supabase.auth.getSession()` had no stored session to restore.

The app also had no initial session-loading state, so the login form could render before the session restoration check completed.

### Fix

Added `apps/web/src/authSession.mjs` and changed the Supabase client auth options to:

```txt
persistSession: true
autoRefreshToken: true
detectSessionInUrl: false
```

`detectSessionInUrl` remains disabled because the app manually handles OAuth callbacks. The dashboard now waits for the initial `getSession()` call before rendering the login form.

### Related Files

* `apps/web/src/authSession.mjs`
* `apps/web/src/authSession.d.mts`
* `apps/web/src/supabase.ts`
* `apps/web/src/main.tsx`
* `apps/web/test/authSession.test.mjs`

### Prevention

Keep Supabase Auth browser-session options behind a tested helper. Do not disable `persistSession` unless the login flow intentionally requires stateless, per-refresh authentication. Configure strict maximum session age or inactivity timeout in Supabase Auth session settings instead of relying on the frontend as the security boundary.

## 2026-06-14 - Browser tab switch stopped timer and camera monitoring

### Situation

The user reported that moving to another browser tab turned off camera monitoring and stopped the study timer. The expected behavior is that tab switching still counts as study time, and only actual seat absence should trigger warnings and pause/exclude study time.

### Error Message

```txt
User-visible symptom: switching browser tabs stops the active study timer and camera monitoring.
```

### Cause

The dashboard registered `visibilitychange` and called `sendExitRequest()` when `document.visibilityState === "hidden"`. Browsers fire that event when the user simply switches tabs. The keepalive `end_study_session` RPC ended the active session, and the camera lifecycle effect then stopped camera monitoring because there was no active session left.

### Fix

Added `shouldEndStudySessionForPageEvent()` in `apps/web/src/sessionExit.mjs` and changed `main.tsx` so tab visibility changes do not end the session. Automatic exit termination remains active for `pagehide` and `beforeunload`.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/sessionExit.mjs`
* `apps/web/src/sessionExit.d.mts`
* `apps/web/test/sessionExit.test.mjs`

### Prevention

Keep browser lifecycle event handling behind a tested helper. `visibilitychange` should be treated as page visibility state only, not as proof that the user left the study room. Use camera presence state to decide warnings and auto-pause.

## 2026-06-14 - Slack bot token secret name mismatch

### Situation

The user configured the Slack bot token as `STUDY_ALERT_SLACK_BOT_TOKEN` and asked to send a test alarm to Slack channel `C0BAFS1CSV8`.

### Error Message

```txt
Existing Edge Functions only read SLACK_BOT_TOKEN.
Old source tests expected requiredEnv("SLACK_BOT_TOKEN").
```

### Cause

The Slack implementation originally documented and coded a single Edge Function secret name, `SLACK_BOT_TOKEN`. The user configured a project-specific secret name instead. Without a fallback alias, `attendance-cron`, `camera-presence-warning`, and `slack-test-alarm` would fail at runtime even though a valid bot token exists under another secret name.

### Fix

Added `getSlackBotToken()` to all Slack-sending Edge Functions. It reads `SLACK_BOT_TOKEN` first and falls back to `STUDY_ALERT_SLACK_BOT_TOKEN`. `slack-test-alarm` also accepts a cron-secret protected direct `channelId` payload so admins can verify a Slack channel without first creating a user-specific notification target row.

Redeployed:

- `slack-test-alarm` v4 ACTIVE
- `attendance-cron` v14 ACTIVE
- `camera-presence-warning` v5 ACTIVE

Tested with Supabase `net.http_post` and channel `C0BAFS1CSV8`; response id `10360` returned HTTP 200 and `ok=true`.

### Related Files

* `supabase/functions/slack-test-alarm/index.ts`
* `supabase/functions/attendance-cron/index.ts`
* `supabase/functions/camera-presence-warning/index.ts`
* `apps/web/test/slackNotifications.test.mjs`
* `packages/core/test/sql-migrations.test.mjs`

### Prevention

When adding provider secrets, keep the documented secret name and any user-provided project-specific alias synchronized in both code and tests. Do not print or store token values in source, docs, or memory-bank.

## 2026-06-14 - Supabase Management API metadata JSON이 PowerShell에서 계속 깨짐

### 상황

`attendance-cron` Edge Function을 Supabase Management API로 배포할 때 `--form-string`으로 metadata JSON을 전달했지만 PowerShell 인자 처리로 JSON key 따옴표가 깨졌다.

### 에러 메시지

```txt
{"message":"Invalid metadata JSON payload (reason: key must be a string at line 1 column 2)"}
{"message":"Invalid metadata JSON payload (reason: expected value at line 1 column 1)"}
```

### 원인

PowerShell에서 curl native 인자로 JSON을 직접 넘기면 double quote가 손상될 수 있다. 또한 `Set-Content -Encoding utf8`로 metadata 파일을 만들면 Windows PowerShell에서 BOM이 붙어 Supabase API가 JSON 시작 문자를 읽지 못할 수 있다.

### 해결 방법

BOM 없는 ASCII metadata 파일을 만든 뒤 `curl -F "metadata=<file"`로 form field 내용을 전달했다.

```powershell
$metadataPath = Join-Path $env:TEMP 'supabase-attendance-cron-metadata.json'
$metadata = '{"entrypoint_path":"index.ts","name":"attendance-cron","verify_jwt":false}'
[System.IO.File]::WriteAllText($metadataPath, $metadata, [System.Text.Encoding]::ASCII)
curl.exe --fail-with-body -sS -X POST "https://api.supabase.com/v1/projects/{project-ref}/functions/deploy?slug=attendance-cron" `
  -H "Authorization: Bearer $env:SUPABASE_ACCESS_TOKEN" `
  -F "metadata=<$metadataPath" `
  -F "file=@supabase/functions/attendance-cron/index.ts"
```

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`

### 재발 방지

PowerShell에서 Supabase Management API multipart deploy를 할 때는 metadata JSON을 직접 command line 문자열로 넘기지 말고 BOM 없는 임시 파일을 사용한다.

## 2026-06-14 - 알림 시간 이전 공부 중에도 입장 알림 모달이 표시됨

### 상황

사용자가 20:30 알림 시간 이전에 이미 독서실에 입장해 공부 세션을 시작했고, 20:30 이후에도 세션이 활성 상태였지만 웹 앱에 "독서실 입장 시간입니다" 모달이 표시됐다.

### 에러 메시지

```txt
독서실 입장 시간입니다
20:30 알림이 도착했습니다. 15분 뒤 한 번 더 재촉하고, 30분 안에 타이머를 시작하면 오늘 출석으로 인정됩니다.
```

### 원인

웹 팝업 조건이 현재 시간이 설정된 알림 시간인지와 오늘 출석 상태가 `present`/`missed`인지 여부만 확인했고, 이미 같은 날짜의 `active` 공부 세션이 있는지는 확인하지 않았다. 서버 측 `get_due_reminders()`와 `mark_missed_attendance()`도 알림 시간 이후에 시작한 세션만 출석 충족으로 보아, 알림 시간 이전에 시작해서 알림 시각을 지나 계속 열린 세션을 알림/결석 정책에서 제외하지 못했다.

### 해결 방법

`apps/web/src/reminderPopup.mjs`에 `shouldShowStudyReminderPopup()` helper를 추가하고, 같은 날짜의 `active` 세션이 있으면 웹 모달을 표시하지 않도록 했다. `supabase/migrations/0015_pre_reminder_active_session_attendance.sql`을 추가해 알림 시간 이전 시작 세션이 `reminder_at`을 지나 열려 있으면 `present`로 보정하고 초기/재촉 알림 및 결석 처리에서 제외하도록 했다. 원격 Supabase 프로젝트에는 `20260614114124 pre_reminder_active_session_attendance` migration을 적용했다.

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/reminderPopup.mjs`
* `apps/web/test/reminderPopup.test.mjs`
* `supabase/migrations/0015_pre_reminder_active_session_attendance.sql`
* `packages/core/test/sql-migrations.test.mjs`

### 재발 방지

알림 정책을 변경할 때는 클라이언트 인앱 모달 조건과 Supabase cron 함수 조건을 함께 확인한다. `npm.cmd test`의 `reminderPopup.test.mjs`와 `sql-migrations.test.mjs`를 통해 활성 pre-reminder 세션이 중복 알림과 결석 처리로 이어지지 않는지 확인한다.

## 2026-06-14 - Supabase Edge Function deploy metadata quoting on PowerShell

### 상황

Slack 전환 후 `attendance-cron`, `camera-presence-warning`, `slack-test-alarm` Edge Function을 Supabase Management API deploy endpoint로 배포했다.

### 에러 메시지

```txt
{"message":"Invalid metadata JSON payload (reason: key must be a string at line 1 column 2)"}
curl: (22) The requested URL returned error: 400
```

### 원인

PowerShell에서 `curl.exe -F "metadata={...}"` 형태로 JSON을 넘기면 native executable 인자 전달 과정에서 JSON double quote가 제거되어 `{entrypoint_path:index.ts,...}` 형태로 전달됐다.

### 해결 방법

`metadata`는 `--form-string`으로 보내고 JSON 내부 double quote는 PowerShell backtick으로 escape했다.

```powershell
curl.exe --fail-with-body -sS -X POST "https://api.supabase.com/v1/projects/{project-ref}/functions/deploy?slug={function-name}" `
  -H "Authorization: Bearer $env:SUPABASE_ACCESS_TOKEN" `
  --form-string "metadata={`"entrypoint_path`":`"index.ts`",`"name`":`"{function-name}`",`"verify_jwt`":false}" `
  -F "file=@supabase/functions/{function-name}/index.ts"
```

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`
* `supabase/functions/camera-presence-warning/index.ts`
* `supabase/functions/slack-test-alarm/index.ts`

### 재발 방지

PowerShell에서 Supabase Management API multipart deploy를 사용할 때는 로컬에서 `node -e "console.log(process.argv)" -- ...`로 argv를 먼저 확인한다.

## 2026-06-14 - Vercel production deploy blocked by missing local CLI/token

### 상황

Slack UI 변경을 Vercel production에 배포하려고 했으나 MCP deploy 도구는 CLI 안내만 반환했고, 로컬에는 `vercel` 명령과 `VERCEL_TOKEN`이 없었다.

### 에러 메시지

```txt
vercel : 'vercel' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다.
VERCEL_TOKEN=not set
```

### 원인

현재 세션에서 직접 Vercel production 배포를 실행할 인증 수단이 없다. 프로젝트는 `.vercel/project.json`으로 연결되어 있지만, 직접 배포에는 Vercel CLI 로그인 또는 `VERCEL_TOKEN`이 필요하다.

### 해결 방법

이번 작업에서는 Vercel production 최신 배포가 이전 커밋 `c61c95c` 기준임을 확인하고, 웹 배포는 보류했다. 배포하려면 다음 중 하나가 필요하다.

* `VERCEL_TOKEN`을 세션 환경 변수로 제공하고 `vercel deploy --prod`를 실행한다.
* 변경 사항을 커밋/푸시해 기존 GitHub Actions/Vercel Git integration pipeline을 사용한다.

### 관련 파일

* `.vercel/project.json`
* `vercel.json`
* `.github/workflows/vercel-production.yml`

### 재발 방지

Vercel production 반영까지 필요한 작업은 시작 전에 `VERCEL_TOKEN` 또는 push 기반 배포 허용 여부를 확인한다.

## 2026-06-14 - endTimer 옵션 인자 변경 후 React onClick 타입 오류

### Situation

카메라 미감지 제외 시간을 `endTimer()`에 전달하도록 함수 시그니처를 바꾼 뒤 `npm.cmd run build`를 실행했다.

### Error Message

```txt
src/main.tsx(1397,42): error TS2322: Type '(options?: { excludedSeconds?: number | undefined; successMessage?: string | undefined; }) => Promise<void>' is not assignable to type 'MouseEventHandler<HTMLButtonElement>'.
```

### Cause

기존 종료 버튼이 `onClick={endTimer}`로 함수를 직접 넘기고 있었다. `endTimer`가 옵션 객체를 받을 수 있게 바뀌면서 React mouse event handler signature와 호환되지 않았다.

### Fix

종료 버튼을 `onClick={() => { void endTimer(); }}` 형태로 감싸서 React 이벤트 객체가 `endTimer` 옵션 인자로 전달되지 않게 했다.

### Related Files

* `apps/web/src/main.tsx`

### Prevention

이벤트 핸들러로 직접 넘기던 함수에 도메인 옵션 인자를 추가할 때는 버튼 콜백을 명시적으로 래핑한다.

## 2026-06-14 - Supabase CLI unavailable for local migration creation

### Situation

While adding `camera_required_warning`, the Supabase skill recommended using Supabase CLI for migration commands. The local Windows environment did not have the CLI available.

### Error Message

```txt
supabase : 'supabase' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다.
```

### Cause

The Supabase CLI is not installed or not on `PATH` in this shell session.

### Fix

Kept the repository's existing numbered migration naming pattern and created `supabase/migrations/0012_camera_required_warning.sql`. Applied the DDL remotely through Supabase MCP `_apply_migration`, then verified the remote check constraint with `_execute_sql`.

### Related Files

* `supabase/migrations/0012_camera_required_warning.sql`
* `supabase/functions/camera-presence-warning/index.ts`

### Prevention

For future Supabase schema work in this environment, check `supabase --version` first. If unavailable, use Supabase MCP `_apply_migration` for DDL and record the local migration file manually using the repo's current naming pattern.

## 2026-06-13 - Vercel CI Deployment Path Added

### Situation

The user wanted repeatable Vercel production deployment without relying on local CLI login.

### Error Message

```txt
No existing credentials found. Please run `vercel login` or pass "--token"
```

### Cause

Local Vercel CLI deployment depends on an interactive login or a provided token. This Windows environment previously also hit a Vercel CLI login issue caused by a non-ASCII hostname being placed in the user-agent header.

### Fix

Added a GitHub Actions workflow that uses GitHub Secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. The workflow runs tests, builds with Vercel, and deploys the prebuilt output to production on `main` pushes.

### Related Files

* `.github/workflows/vercel-production.yml`
* `docs/vercel-ci.md`
* `memory-bank/prd-vercel-ci.md`

### Prevention

Use GitHub Actions or another CI environment with `VERCEL_TOKEN` for repeatable deployments. Do not depend on local Vercel CLI credentials for production releases.

## 2026-06-13 - GitHub Actions Vercel Prebuilt Build Failed On Node 24

### Situation

After GitHub Secrets were configured, commit `0d54fa7` was pushed to `origin/main` and GitHub Actions run `27435664940` started.

### Error Message

```txt
Error: Found invalid Node.js Version: "24.x". Please set Node.js Version to 22.x in your Project Settings to use Node.js 22.
```

### Cause

The workflow used `vercel build --prod` locally in GitHub Actions. The Vercel project setting currently reports Node.js `24.x`, and local Vercel build rejects that project setting even though Vercel remote deployments have previously succeeded.

### Fix

Changed the workflow to keep `npm test` as the quality gate, then run `vercel deploy --prod --yes --token="$VERCEL_TOKEN"` so Vercel performs the production build remotely with the project's own settings.

### Related Files

* `.github/workflows/vercel-production.yml`
* `docs/vercel-ci.md`
* `memory-bank/prd-vercel-ci.md`

### Prevention

If the project should return to prebuilt deploys, first change the Vercel project Node.js version to a local-build-compatible version such as `22.x`, then reintroduce `vercel build --prod` and `vercel deploy --prebuilt --prod`.

## 2026-06-13 - Camera presence UI could not be deployed to Vercel without credentials

### Situation

After implementing the camera-based absence warning MVP, the Supabase migration and Edge Function were deployed successfully. The web UI still needed a Vercel production deployment.

### Error Message

```txt
Vercel CLI 48.6.0
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### Cause

The local shell has `.vercel/project.json`, but it does not have Vercel credentials or `VERCEL_TOKEN`. The Vercel MCP deployment helper returned CLI guidance only, so it could not deploy the current working tree by itself.

### Fix

No deployment was completed in this pass. To deploy the camera UI, provide a valid `VERCEL_TOKEN` or complete Vercel CLI login/device authorization, then run:

```txt
npx.cmd vercel@48.6.0 deploy --prod --yes --token <redacted>
```

Do not commit or document the token value.

### Related Files

* `.vercel/project.json`
* `vercel.json`
* `apps/web/src/main.tsx`
* `apps/web/src/styles.css`

### Prevention

Set up Vercel Git integration or CI secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) so frontend changes deploy from Git without manual device authorization.

## 2026-06-13 - Two-step attendance deployment required Vercel device auth again

### Situation

After implementing the 8:30 initial reminder, 8:45 nudge, and 9:00 missed-attendance flow, the web copy and service worker needed a Vercel production deployment.

### Error Message

```txt
Vercel CLI 48.6.0
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### Cause

The project is still deployed from the Vercel CLI, and the local CLI credential store is empty. `.vercel/project.json` links the project, but it does not contain authentication credentials.

### Fix

Used OAuth device authorization with an ASCII user-agent, approved the device login in Vercel, and passed the returned temporary token only to the deployment command. The token was not printed or stored in source files.

The resulting production deployment is `dpl_DZUe2FPk3HW5K9wqaFE4aFS916gq`, and `study-room-attendance.vercel.app` aliases to it.

### Related Files

* `.vercel/project.json`
* `vercel.json`
* `apps/web/src/main.tsx`
* `apps/web/public/service-worker.js`

### Prevention

For repeatable deployment, configure Vercel Git integration or CI secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). Until then, expect manual OAuth device authorization for each CLI production deployment.

## 2026-06-13 - Vercel production still serves old mobile-dark artifact

### Situation

The user reported that the deployed mobile app at `https://study-room-attendance.vercel.app` still looked dark even after the mobile light-theme fix was pushed to GitHub.

### Error Message

```txt
User-visible symptom: production mobile page still appears dark.
Vercel CLI deploy error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### Cause

The mobile light-theme fix exists in local source, built `apps/web/dist/index.html`, and `origin/main`, but the Vercel production domain still serves an older deployment. The active Vercel production alias points to CLI deployment `dpl_D5L7trvBoiVTjn1B65TtRYcpU79X`, and the public HTML response has `Last-Modified: Thu, 11 Jun 2026 05:35:49 GMT`. GitHub push alone did not trigger a fresh production deployment because this project is currently deployed from CLI, not an active Git integration. A manual CLI deployment was attempted, but local Vercel credentials were missing.

### Fix

Generated a Vercel OAuth device authorization request manually with an ASCII `user-agent`, because `vercel login` fails when the Windows hostname contains non-ASCII characters. After the user approved the device login in Vercel, used the returned temporary access token for a one-time production deployment:

```txt
npx.cmd -y vercel@48.6.0 deploy --prod --yes --token <redacted> --scope astars-projects-c2f42587
```

The public production alias now points to READY deployment `dpl_88BcosEtVBhBKyddjNC3k9c9vjo5`, and the production HTML contains `only light` and `supported-color-schemes`.

### Related Files

* `.vercel/project.json`
* `vercel.json`
* `apps/web/index.html`
* `apps/web/dist/index.html`

### Prevention

After pushing frontend fixes, verify the production HTML contains the expected marker strings before checking the mobile UI. For this issue the markers are `only light` and `supported-color-schemes`. Do not assume `git push` updates Vercel unless Git integration or CI deployment is confirmed. For future manual deploys on this Windows host, avoid `vercel login`; use ASCII-header OAuth device authorization plus `--token`, or configure Vercel Git/CI deployment.

## 2026-06-13 - Mobile browser still rendered the light UI as dark

### Situation

The user reported that the study-room app still looked dark on mobile, while PC showed the intended light UI.

### Error Message

```txt
User-visible symptom: mobile page appears dark even though the PC page is light.
```

### Cause

The previous fix used document and CSS `color-scheme` hints, but the HTML meta still declared only `content="light"` and the app did not include a `prefers-color-scheme: dark` override. Some mobile browsers can apply automatic darkening or native control styling more aggressively when the OS/browser is in dark mode.

### Fix

Changed the HTML color-scheme meta to `only light`, added `supported-color-schemes=light`, added a small pre-paint inline light background/text style, and added a CSS `@media (prefers-color-scheme: dark)` override to keep the app background and text colors on the same light palette.

### Related Files

* `apps/web/index.html`
* `apps/web/src/styles.css`
* `apps/web/test/mobileTheme.test.mjs`

### Prevention

Keep both HTML metadata and CSS in sync when changing the app theme. The regression test must verify `only light`, the Safari-compatible supported color scheme meta, pre-paint style, and the dark-preference override.

## 2026-06-12 - GitHub push blocked by missing local/remote repository setup

### Situation

The user asked to push the current study-room app work to GitHub. The project folder was not a git repository, and the parent `C:\jini-dev\project` folder was not a git repository either.

### Error Message

```txt
fatal: not a git repository (or any of the parent directories): .git
gh : 'gh' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다.
```

After `git init`, git also required a safe-directory registration:

```txt
fatal: detected dubious ownership in repository at 'C:/jini-dev/project/study-room-attendance'
git config --global --add safe.directory C:/jini-dev/project/study-room-attendance
```

### Cause

The app had been developed in a normal folder without `.git`. No `origin` remote was configured, `gh` CLI was not installed, and the GitHub connector did not expose a matching `study-room-attendance` repository.

### Fix

Initialized a local git repository on `main`, registered the project path as a safe directory, refreshed README/thumbnail files, and created local commit `6f7fb40 Initial study room attendance app`.

### Related Files

* `README.md`
* `.gitignore`
* `docs/images/study-room-thumbnail.png`
* `memory-bank/active-context.md`
* `memory-bank/progress.md`

### Prevention

Before future push requests, check `git status -sb`, `git remote -v`, and `gh --version` or the GitHub connector repository list. Do not push into an unrelated GitHub repository without explicit confirmation.

## 2026-06-12 - Headless Chrome failed while creating README thumbnail

### Situation

The README thumbnail needed to be captured from the local Vite preview app.

### Error Message

```txt
GPU process isn't usable. Goodbye.
Chrome screenshot failed with exit code
```

### Cause

Chrome headless could not start a usable GPU process in this Windows session.

### Fix

Retried with Microsoft Edge headless using a dedicated local user data dir and GPU/sandbox related flags. Edge wrote `docs/images/study-room-thumbnail.png`.

### Related Files

* `docs/images/study-room-thumbnail.png`
* `README.md`

### Prevention

Use Edge headless with `--headless=new`, `--disable-gpu`, `--disable-software-rasterizer`, `--no-sandbox`, and a project-local temporary profile when Chrome headless fails.

## 2026-06-12 - Browser plugin blocked local app URL during UI verification

### Situation

After adding the My Page todo history UI, code tests and build passed, but in-app Browser verification could not open the local Vite URL.

### Error Message

```txt
Browser Use cannot open http://127.0.0.1:5177 in tab 1. Browser reported: net::ERR_BLOCKED_BY_CLIENT
Browser Use cannot open http://localhost:5177 in tab 1. Browser reported: net::ERR_BLOCKED_BY_CLIENT
```

### Cause

The Browser plugin blocked navigation to the local development URL in this session. This did not come from Vite, TypeScript, or the app bundle.

### Fix

Kept verification to deterministic checks: `node --test apps\web\test\todoHistory.test.mjs`, `npm.cmd test`, `npm.cmd run build`, and `rg` against `apps/web/dist` to confirm the My Page strings/classes were included in the production bundle.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/styles.css`
* `apps/web/src/todoHistory.mjs`
* `apps/web/test/todoHistory.test.mjs`

### Prevention

If this appears again, treat it as a browser automation environment issue first. Verify the app through tests/build/dist output, or use a manually opened browser after ensuring the local server is running.

## 2026-06-12 - Mobile browser shows light UI as dark

### Situation

The user reported that the study-room web UI looked dark when viewed on mobile.

### Error Message

```txt
mobileTheme.test.mjs failed because apps/web/index.html did not include:
<meta name="color-scheme" content="light" />
```

Local dev server verification also hit the existing Windows shell issue:

```txt
Start-Process : An item with the same key has already been added. Key being added: 'PATH'
```

### Cause

The app uses a light visual palette, but the document did not explicitly opt out of mobile/browser automatic dark theming. Some mobile browsers can darken backgrounds or native controls when the OS is in dark mode. Local browser verification was blocked by the known Windows `Path/PATH` duplicate environment issue when using `Start-Process`.

### Fix

Added light color-scheme metadata to `apps/web/index.html`, added `color-scheme: only light` and explicit root background/color CSS, and set native controls to light color-scheme. Added `apps/web/test/mobileTheme.test.mjs` to prevent regression.

### Related Files

* `apps/web/index.html`
* `apps/web/src/styles.css`
* `apps/web/test/mobileTheme.test.mjs`

### Prevention

Keep the web app's document-level `color-scheme` and `theme-color` in sync with the light UI palette. After local fixes, deploy to Vercel before checking on a phone pointed at the production URL.

## 2026-06-11 - Reminder skipped because early timer start marked the day present

### Situation

The user reported that the configured 9 PM reminder did not arrive through Telegram or computer Web Push on 2026-06-11.

### Error Message

```txt
cron_at_reminder status=200 content={"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}
delivery_window_count=0
target_state reminder_time=21:00:00 timezone=Asia/Tokyo today_status=present
study_today started_local=2026-06-11 01:39:36.618665 duration_seconds=2
```

### Cause

`start_study_session()` marked `attendance_days.status = 'present'` whenever a timer started, even before the configured reminder time. On 2026-06-11, a 2-second study session at 01:39 local marked the day `present`. At the configured 21:00 local reminder time, `get_due_reminders()` excluded the user because it skips days already marked `present` or `missed`. Therefore Telegram and Web Push were never attempted.

### Fix

Added and applied `supabase/migrations/0009_start_session_attendance_window.sql`. The function now creates a study session at any time, but only marks attendance `present` when `now()` is between `reminder_at` and `deadline_at`.

### Related Files

* `supabase/migrations/0009_start_session_attendance_window.sql`
* `packages/core/test/sql-migrations.test.mjs`
* `supabase/functions/attendance-cron/index.ts`

### Prevention

When reminders do not arrive, check `cron.job`, `net._http_response`, `get_due_reminders()` behavior, `attendance_days.status`, and `notification_deliveries` in that order. If `dueReminderCount` is 0 at the reminder minute, inspect why the user was excluded before debugging Telegram or Web Push providers.

## 2026-06-11 - Vercel production deploy blocked by missing local credentials

### 상황

웹 설정 화면에 `Telegram 테스트 알림` 버튼을 추가한 뒤 Vercel production 배포를 시도했다.

### 에러 메시지

```txt
Vercel CLI 48.6.0
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### 원인

현재 Codex 세션에는 `VERCEL_TOKEN` 환경 변수가 없고, 로컬 Vercel CLI 인증 파일도 사용할 수 없는 상태였다. `.vercel/project.json`에는 project/team 연결 정보가 있지만, 배포 인증에는 별도 로그인 또는 token이 필요하다.

### 해결 방법

이번 턴에서는 Supabase Edge Function 배포와 로컬 빌드 검증까지 완료했다. 운영 웹 배포는 사용자가 `vercel login`을 완료하거나 Vercel token을 제공한 뒤 아래 명령으로 다시 진행한다.

```txt
npx.cmd vercel@48.6.0 deploy --prod --yes --scope astars-projects-c2f42587
```

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/telegramNotifications.mjs`
* `.vercel/project.json`

### 재발 방지

Vercel 배포 작업 전에는 `VERCEL_TOKEN=set` 여부와 로컬 CLI 로그인 상태를 먼저 확인한다. token 원문은 문서나 채팅에 기록하지 않는다.

## 2026-06-11 - Telegram test send uses Edge runtime secret, not Management API secret value

### 상황

Telegram 테스트 알림을 즉시 보내기 위해 Supabase Management API로 secret 목록을 확인한 뒤 로컬 PowerShell에서 Telegram Bot API를 직접 호출하려고 했다.

### 에러 메시지

```txt
telegram_getMe=failed status=404
{"ok":false,"error_code":404,"description":"Not Found"}
```

### 원인

Supabase Management API `/secrets` 응답의 `value` 필드는 실제 `TELEGRAM_BOT_TOKEN` 원문으로 사용할 수 없는 placeholder 성격이었다. 해당 값을 Telegram Bot API URL에 넣으면 유효하지 않은 bot token이 되어 404가 반환된다.

추가로 todo 조회 SQL 초안에서 `target.local_date`를 text로 만들고 `study_todos.local_date` date와 직접 비교해 아래 타입 오류가 발생했다.

```txt
ERROR: 42883: operator does not exist: text = date
```

### 해결 방법

로컬에서 bot token 값을 직접 사용하지 않고, `CRON_SECRET` 헤더로 보호되는 `telegram-test-alarm` Edge Function을 추가했다. 이 함수는 Supabase Edge Function 런타임에서 실제 `TELEGRAM_BOT_TOKEN` secret을 읽고 Telegram Bot API `sendMessage`를 호출한다.

SQL 타입 오류는 테스트 스크립트에서 `target.local_date::date = st.local_date`로 수정했다.

### 관련 파일

* `supabase/functions/telegram-test-alarm/index.ts`
* `memory-bank/implementation-plan.md`

### 재발 방지

Secret API에서 반환된 값을 실제 secret 원문이라고 가정하지 않는다. Telegram/Resend/Kakao 등 provider token은 Edge Function 런타임 또는 배포 secret 설정 경로에서만 사용한다. 날짜 문자열과 date 컬럼을 비교할 때는 명시적으로 cast한다.

## 2026-06-11 - Todo notification TDD red test and matcher refinement

### 상황

알림 본문에 날짜별 todo를 포함하는 기능을 TDD로 추가하면서 먼저 `packages/core/test/sql-migrations.test.mjs`에 실패 테스트를 작성했다.

### 에러 메시지

```txt
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /type StudyTodo = \{/
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /formatTodoSummary\(todos\)/
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /buildReminderBody\(reminder, todos\)/
```

### 원인

첫 번째 실패는 기능이 아직 구현되지 않았기 때문에 발생한 정상적인 RED 단계였다. 이후 두 실패는 실제 구현이 `maxTodos` 옵션을 받는 형태였는데 테스트가 옵션 없는 정확한 호출 형태만 허용해서 발생했다.

### 해결 방법

`attendance-cron`에 `StudyTodo`, `loadTodosByReminder`, `buildReminderBody`, `formatTodoSummary`를 구현했다. 테스트는 호출 형태가 아니라 todo summary와 reminder body 사용 여부를 검증하도록 matcher를 완화했다.

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`
* `packages/core/test/sql-migrations.test.mjs`

### 재발 방지

소스 패턴 테스트는 구현 세부 옵션까지 과하게 고정하지 않고, 사용자 요구와 직접 연결되는 동작 경계만 확인한다.

## 2026-06-11 - Vercel remote build misses Vite public environment variables

### 상황

Vercel production 배포 후 운영 URL은 열렸지만, 배포된 JS 번들에서 Google 로그인 비활성화 분기가 남아 있었다.

### 에러 메시지

```txt
Google 로그인을 사용하려면 Supabase Auth에서 Google Provider를 켜고 Client ID/Secret을 등록한 뒤 VITE_GOOGLE_AUTH_ENABLED=true로 바꿔야 합니다.
```

### 원인

Vercel 원격 빌드는 `apps/web/.env.local`을 자동으로 가져가지 않는다. Vite의 `VITE_*` 값은 빌드 시점에 번들에 주입되므로, Vercel 프로젝트 환경변수에 public build 변수를 별도로 등록해야 한다.

### 해결 방법

Vercel 프로젝트 환경변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`, `VITE_GOOGLE_AUTH_ENABLED`를 `production`, `preview`, `development` 대상으로 등록하고 production을 재배포했다. 이후 배포된 JS 번들에서 Supabase 프로젝트 URL 포함, Google 비활성화 문구 제거, placeholder 미포함을 확인했다.

### 관련 파일

* `vercel.json`
* `apps/web/.env.local`
* `memory-bank/implementation-plan.md`

### 재발 방지

Vercel 배포 후에는 HTML 200만 확인하지 말고 배포된 asset을 조회해 `VITE_*` 값이 반영됐는지 패턴으로 확인한다. 비밀값은 출력하지 않고 `set/missing` 또는 boolean 검증 결과만 기록한다.

## 2026-06-11 - Vercel CLI fails when Windows hostname contains non-ASCII characters

### 상황

독서실 웹 앱을 Vercel에 배포하려고 `npx.cmd vercel deploy --prod --yes`를 실행했다.

### 에러 메시지

```txt
TypeError: 지니 @ vercel 54.11.1 node-v24.13.0 win32 (x64) is not a legal HTTP header value
The specified token is not valid. Use `vercel login` to generate a new token.
```

### 원인

Vercel CLI 최신 버전이 Windows hostname을 `user-agent` header에 포함한다. 현재 hostname이 한글이라 HTTP header 값 검증에서 실패했다. 기존 로컬 Vercel auth 파일의 access token은 만료됐고, refresh token은 새 토큰으로 교체되는 일회성 흐름이라 재인증이 필요했다.

### 해결 방법

Vercel OAuth device authorization을 ASCII `user-agent`로 직접 시작하고, 사용자가 Vercel 승인 페이지에서 승인한 뒤 갱신된 access token을 로컬 auth 파일에 저장했다. 이후 최신 CLI 대신 `vercel@48.6.0`에 `--token`과 `--scope astars-projects-c2f42587`를 전달해 배포했다.

배포 후 Vercel 운영 URL은 `https://study-room-attendance.vercel.app`이고, Supabase Auth `site_url`/redirect allow list 및 Edge Function secret `APP_ORIGIN`도 해당 URL로 설정했다.

### 관련 파일

* `vercel.json`
* `.vercel/project.json`
* `memory-bank/implementation-plan.md`

### 재발 방지

Windows hostname이 한글인 환경에서 Vercel CLI 최신 버전이 같은 오류를 내면 `vercel whoami`나 `vercel deploy`를 반복하지 말고, device authorization으로 token을 갱신한 뒤 `vercel@48.6.0 --token` 경로를 사용한다. 토큰 값은 문서나 코드에 기록하지 않는다.

## 2026-06-11 - Local Vite server start fails because of Path/PATH environment collision

### 상황

독서실 웹 앱을 `http://127.0.0.1:5177/`에서 실행하려고 했다.

### 에러 메시지

```txt
Start-Process : 항목이 이미 추가되었습니다. 사전에 있는 키: 'Path'  추가되는 키: 'PATH'
'vite'은(는) 내부 또는 외부 명령, 실행할 수 있는 프로그램, 또는 배치 파일이 아닙니다.
```

### 원인

현재 Windows PowerShell 프로세스 환경에 `Path`와 `PATH`가 동시에 존재해 `Start-Process`와 `Get-ChildItem Env:`가 실패했다. 중복 문제를 피하려고 `PATH`를 비우면 npm workspace script가 자식 프로세스에서 `vite`를 찾지 못했다.

### 해결 방법

`npm.cmd --workspace apps/web run dev` 대신 `node.exe`로 Vite JS 엔트리를 직접 실행했다. 실행 포트는 3000번을 피하고 기존 독서실 앱 포트인 5177을 사용했다.

```powershell
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' `
  -ArgumentList @('C:\jini-dev\project\study-room-attendance\node_modules\vite\bin\vite.js','--host','127.0.0.1','--port','5177','--strictPort') `
  -WorkingDirectory 'C:\jini-dev\project\study-room-attendance\apps\web' `
  -RedirectStandardOutput 'C:\jini-dev\project\study-room-attendance\web-dev.log' `
  -RedirectStandardError 'C:\jini-dev\project\study-room-attendance\web-dev.err' `
  -WindowStyle Hidden
```

### 관련 파일

* `apps/web/package.json`
* `web-dev.log`
* `web-dev.err`

### 재발 방지

Windows에서 npm workspace dev server가 환경 변수 문제로 실패하면 npm script를 고집하지 말고 `node.exe node_modules/vite/bin/vite.js` 직접 실행으로 확인한다. 3000번 포트는 다른 앱이 사용할 수 있으므로 독서실 앱은 `5177` 포트를 우선 사용한다.

## 2026-06-11 - Telegram target requires chat ID after bot token secret is set

### 상황

`RESEND_API_KEY`와 `TELEGRAM_BOT_TOKEN`을 Supabase Edge Function secrets에 추가하고 Telegram 알림 채널을 구현했다.

### 에러 메시지

```txt
APP_ORIGIN=missing
notification_targets.kind = 'telegram' target not created yet
Telegram Bot API getUpdates update_count=0
```

### 원인

Telegram bot token은 서버 secret으로 설정됐지만, 사용자별 Telegram chat ID는 앱 설정 화면에서 별도로 저장해야 한다. Telegram bot은 사용자가 먼저 bot에게 메시지를 보내야 대화를 시작할 수 있고, 그 이후 `getUpdates` 등을 통해 chat ID를 확인할 수 있다. 새 bot token을 Supabase secret에 덮어쓴 뒤 `getUpdates`를 조회했지만 update 결과가 0건이어서 아직 저장할 Chat ID가 없다. 또한 앱 URL을 Telegram 메시지에 정확히 넣으려면 배포 후 `APP_ORIGIN` secret이 필요하다.

### 해결 방법

사용자는 Telegram에서 bot에게 먼저 `/start` 또는 아무 메시지나 보내고 chat ID를 확인한 뒤, 웹 앱 설정의 `Telegram Chat ID` 필드에 저장해야 한다. 사용자가 메시지를 보낸 다음에는 `getUpdates`를 다시 조회해 Chat ID를 찾고 `notification_targets.kind = 'telegram'` 대상으로 저장한다. 배포 URL이 생기면 Supabase Edge Function secret `APP_ORIGIN`도 설정한다. 비밀값은 코드, `.env.example`, `memory-bank`에 기록하지 않는다.

2026-06-11에 사용자가 bot에게 메시지를 보낸 뒤 `getUpdates`에서 private chat ID 후보를 확인했고, 해당 Chat ID를 `p64***@gmail.com` / `A스타` 프로필의 `notification_targets.kind = 'telegram'` 대상으로 저장했다. Telegram Bot API `sendMessage` 테스트는 `ok=true`로 성공했고, 원격 DB에서도 Telegram target이 `enabled=true`임을 확인했다.

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/telegramNotifications.mjs`
* `supabase/functions/attendance-cron/index.ts`
* `supabase/migrations/0008_telegram_notification_targets.sql`

### 재발 방지

알림 채널을 추가할 때는 provider secret 설정과 사용자별 `notification_targets` 생성을 분리해서 확인한다. Telegram 발송 문제는 `TELEGRAM_BOT_TOKEN`, `notification_targets.kind = 'telegram'`, `notification_deliveries.channel = 'telegram'` 순서로 본다.

## 2026-06-08 - Cron runs but user does not receive alarm

### 상황

사용자가 독서실 앱이 알람을 보내지 않는다고 보고했다.

### 에러 메시지

```txt
net._http_response: {"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}
notification_deliveries email: RESEND_API_KEY is required
notification_deliveries web_push: Received unexpected response code
Supabase Auth security_manual_linking_enabled=False
RESEND_API_KEY=missing
KAKAO_REST_API_KEY=missing
```

### 원인

Supabase Cron과 `attendance-cron` Edge Function은 정상 실행 중이다. 현재 미수신의 직접 원인은 발송 채널 준비가 완료되지 않은 것이다. 등록된 대상은 `email` 2개와 `web_push` 2개뿐이고, 휴대폰 Expo Push 대상과 `kakao_memo` 대상은 없다. 이메일은 `RESEND_API_KEY`가 없어 실패하고, 카카오는 Manual Linking과 Kakao secrets가 없어 연결/발송을 완료할 수 없다. 웹푸시는 한 건은 push service까지 `sent`로 기록됐지만, 다른 한 건은 stale subscription 또는 권한/푸시 서비스 문제로 실패했다.

### 해결 방법

사용하려는 알림 채널별로 준비를 완료해야 한다.

- 이메일: Edge Function secret `RESEND_API_KEY`를 설정한다.
- 카카오톡: Supabase Manual Linking을 켜고 `KAKAO_REST_API_KEY`, 필요 시 `KAKAO_CLIENT_SECRET`, `APP_ORIGIN`을 설정한 뒤 웹 앱에서 카카오톡 알림을 연결한다.
- 휴대폰 Expo Push: 실제 모바일 앱에서 Expo Push Token 등록 흐름을 실행해 `notification_targets.kind = 'expo'` 대상을 만든다.
- 컴퓨터 웹푸시: 브라우저 알림 권한을 허용하고 컴퓨터 알림을 다시 등록해 stale subscription을 갱신한다.

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`
* `supabase/functions/kakao-token/index.ts`
* `apps/web/src/webPush.ts`
* `apps/web/src/main.tsx`

### 재발 방지

알림 미수신을 볼 때는 `cron.job`, `net._http_response`, `get_due_reminders(now())`, `notification_targets`, `notification_deliveries`, Edge Function secrets를 순서대로 확인한다. `dueReminderCount: 0`이면 스케줄러 문제가 아니라 현재 분에 보낼 대상이 없다는 뜻이다.

## 2026-06-08 - Kakao notification deployment blocked by Manual Linking and secrets

### 상황

카카오톡 알림 연결 UI, `kakao-token` Edge Function, `attendance-cron`의 `kakao_memo` 발송 분기를 구현하고 원격 Supabase에 배포했다.

### 에러 메시지

```txt
Supabase Auth security_manual_linking_enabled=false
KAKAO_REST_API_KEY secret not found
APP_ORIGIN secret not found
```

### 원인

기존 Supabase 사용자 계정에 Kakao identity를 추가하려면 Supabase Auth Manual Linking이 켜져 있어야 한다. 이 설정은 계정 연결 보안에 영향을 주는 영구 Auth 설정이라 자동 변경 승인이 거절됐다. 또한 Kakao access token이 만료된 뒤 refresh하려면 Edge Function secret `KAKAO_REST_API_KEY`가 필요하고, 운영 링크를 정확히 만들려면 `APP_ORIGIN`도 필요하다.

### 해결 방법

코드와 DB/Edge Function 배포는 완료했다. 사용자가 Supabase Dashboard에서 Manual Linking을 직접 켜고, Edge Function secrets에 `KAKAO_REST_API_KEY`, 필요 시 `KAKAO_CLIENT_SECRET`, 배포 URL 확정 후 `APP_ORIGIN`을 설정해야 실제 연결/발송 검증이 가능하다.

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/kakaoNotifications.mjs`
* `supabase/functions/kakao-token/index.ts`
* `supabase/functions/attendance-cron/index.ts`
* `supabase/migrations/0007_kakao_message_notifications.sql`

### 재발 방지

OAuth identity linking 기능을 추가할 때는 Supabase Provider enabled 여부와 별도로 Manual Linking 설정을 확인한다. Edge Function 배포 후에는 코드 배포 상태와 필요한 secrets 설정 상태를 분리해서 확인한다.

## 2026-06-08 - Supabase MCP migration required reauthentication

### 상황

`kakao_message_connections` migration을 Supabase MCP로 적용하려고 했다.

### 에러 메시지

```txt
This app connection requires reauthentication before other actions on this app can succeed.
```

### 원인

현재 세션의 Supabase MCP 앱 연결이 재인증을 요구하는 상태였다. MCP 도구 자체는 보였지만 실제 변경 작업은 진행할 수 없었다.

### 해결 방법

`SUPABASE_ACCESS_TOKEN` 존재를 확인한 뒤 Supabase Management API의 database query endpoint로 migration SQL을 적용했다. 이후 같은 Management API SQL 조회로 `public.kakao_message_connections`와 `kakao_memo` check constraint가 원격 DB에 반영된 것을 확인했다.

### 관련 파일

* `supabase/migrations/0007_kakao_message_notifications.sql`

### 재발 방지

Supabase 변경 전에는 MCP 도구 표시 여부만 보지 말고 실제 `_execute_sql` 또는 `_apply_migration` 호출이 가능한지 확인한다. 재인증 오류가 나오면 Supabase MCP 재로그인 또는 Management API/CLI fallback을 사용한다.

## 2026-06-08 - Edge Function JWT gateway blocks browser CORS preflight

### 상황

웹 앱에서 `kakao-token` Edge Function을 호출하려면 브라우저가 먼저 `OPTIONS` preflight 요청을 보낸다.

### 에러 메시지

```txt
401 Unauthorized
```

### 원인

Edge Function을 `verify_jwt=true`로 배포하면 Supabase gateway가 `OPTIONS` preflight 요청도 JWT 없이 차단할 수 있다. 그러면 함수 내부 CORS 처리까지 요청이 도달하지 못한다.

### 해결 방법

`kakao-token`을 `verify_jwt=false`로 재배포하고, 함수 내부에서 `Authorization` bearer token을 직접 `admin.auth.getUser(jwt)`로 검증하도록 유지했다. `OPTIONS` 요청은 204로 응답하고, 인증 없는 GET은 함수 내부 401을 반환하는 것을 확인했다.

### 관련 파일

* `supabase/functions/kakao-token/index.ts`

### 재발 방지

브라우저에서 직접 호출하는 Edge Function은 CORS preflight 경로를 따로 검증한다. `verify_jwt=false`를 사용할 경우 반드시 함수 내부에서 Supabase JWT를 검증한다.

## 2026-06-08 - Kakao provider disabled and no Kakao delivery channel

### 상황

카카오 설정 후 카카오톡 나에게 보내기 알림을 보낼 수 있는지 확인했다.

### 에러 메시지

```txt
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

### 원인

Supabase Auth Kakao Provider가 아직 활성화되어 있지 않다. 또한 현재 `attendance-cron` Edge Function은 `expo`, `web_push`, `email`만 처리하고, DB 체크 제약도 해당 세 채널만 허용한다. 따라서 Kakao Developers 설정만으로는 현재 앱에서 카카오톡 메시지를 보낼 수 없다.

### 해결 방법

Supabase Auth Providers에서 Kakao를 ON으로 설정하고 Client ID/Secret을 저장해야 한다. 이후 카카오를 로그인 수단이 아니라 알림 채널로 쓰려면 별도 토큰 저장 테이블과 `attendance-cron`의 `kakao_memo` 발송 분기를 구현해야 한다.

2026-06-08에 Management API로 `external_kakao_enabled=True`를 적용했고, authorize endpoint가 `302 Found`로 Kakao OAuth URL을 반환하는 것을 확인했다. 단, 실제 카카오톡 나에게 보내기 알림은 아직 앱/DB/Edge Function 구현이 필요하다.

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`
* `supabase/migrations/0001_study_room_mvp.sql`
* `apps/web/src/main.tsx`

### 재발 방지

Kakao Developers 설정 완료와 Supabase Provider 활성화는 별개로 확인한다. 발송 가능 여부는 Provider endpoint, DB 채널 제약, Edge Function 발송 분기를 모두 확인한다.

## 2026-06-08 - 서버 알림 자동화는 동작하지만 휴대폰 Expo 대상이 없음

### 상황

Supabase Cron + Edge Function으로 로컬 컴퓨터가 꺼져도 알림 발송이 가능한지 확인했다.

### 에러 메시지

```txt
RESEND_API_KEY is required
Received unexpected response code
```

### 원인

원격 `attendance-cron` Edge Function과 `study-room-attendance-cron` cron job은 active 상태였지만, `notification_targets`에 `expo` 종류가 아직 없었다. 즉 휴대폰 푸시를 받을 Expo Push Token이 등록되지 않았다. 이메일 fallback은 `RESEND_API_KEY` secret이 없어 실패했고, web push는 브라우저 구독 또는 푸시 서비스 응답 문제로 실패 기록이 있었다.

### 해결 방법

서버 측 자동 실행은 유지한다. 휴대폰 알림을 활성화하려면 `apps/mobile/.env.local`에 `EXPO_PUBLIC_EAS_PROJECT_ID`를 설정하고, 실제 기기에서 모바일 앱의 푸시 등록 흐름을 실행해 `notification_targets.kind = 'expo'` 행을 생성해야 한다. 이메일 fallback을 쓰려면 Edge Function secret `RESEND_API_KEY`를 설정해야 한다.

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`
* `supabase/cron.sql`
* `apps/mobile/src/notifications.ts`
* `apps/mobile/.env.local`

### 재발 방지

알림 문제를 볼 때는 cron/Edge Function 실행 여부와 실제 발송 대상 등록 여부를 분리해서 확인한다. `cron.job`, `net._http_response`, `notification_targets`, `notification_deliveries`를 함께 조회한다.

## 2026-06-08 - Google OAuth hash callback ignored

### 상황

Google 계정 인증은 완료됐지만 앱이 로그인 대시보드로 들어가지 않고 다시 기본 로그인 화면으로 돌아갔다.

### 에러 메시지

```txt
명시적인 에러는 없고 callback URL이 /auth/callback#access_token=... 형태로 돌아왔지만 앱 세션이 설정되지 않음
```

### 원인

기존 앱은 `/auth/callback?code=...` PKCE callback만 auth callback으로 인식했다. 실제 Supabase Google OAuth 응답은 URL hash에 `access_token`, `refresh_token`을 담는 implicit callback 형태였고, `isAuthCallbackUrl`이 이 URL을 callback으로 인식하지 못했다.

### 해결 방법

`apps/web/src/authProviders.mjs`에 hash callback 감지와 token 추출 함수를 추가했다. `finishOAuthCallback`은 hash callback이면 `supabase.auth.setSession`으로 세션을 설정하고, callback URL의 token hash를 `history.replaceState`로 제거한다.

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/authProviders.mjs`
* `apps/web/test/authProviders.test.mjs`

### 재발 방지

OAuth callback 처리 테스트에는 query `code`, query/hash error, hash `access_token` 케이스를 모두 포함한다. 토큰이 URL에 남지 않도록 callback 처리 시작 시 주소를 정리한다.

## 2026-06-08 - Google OAuth provider disabled

### 상황

웹 앱에서 Google 로그인을 누르면 Supabase Auth authorize endpoint가 400을 반환했다.

### 에러 메시지

```txt
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

### 원인

Supabase Auth 설정에 Google Client ID/Secret은 등록되어 있었지만 `external_google_enabled`가 `false`였다. 로컬 앱은 `VITE_GOOGLE_AUTH_ENABLED=true`로 Google OAuth를 호출하고 있었으나, Supabase 프로젝트에서 Provider 자체가 꺼져 있어 요청이 거부됐다.

### 해결 방법

Supabase Management API로 프로젝트 `bqohkdzvxbrokkmuhysx`의 `external_google_enabled`를 `true`로 변경했다. 이후 authorize URL이 400이 아니라 Google OAuth URL로 `302 Found`를 반환하는 것을 확인했다.

### 관련 파일

* `apps/web/.env.local`
* `memory-bank/implementation-plan.md`

### 재발 방지

Google 로그인을 켤 때는 로컬 `VITE_GOOGLE_AUTH_ENABLED=true`뿐 아니라 Supabase Auth Provider의 enabled 값, Client ID/Secret 존재 여부, `uri_allow_list`, Google Cloud Authorized redirect URI를 함께 확인한다.

## 2026-06-07 - 페이지 이탈 후 집중 세션이 계속 누적됨

### 상황

사용자가 집중 세션을 시작한 뒤 종료 버튼을 누르지 않고 페이지를 벗어나면 활성 세션이 계속 열려 있어 공부 시간이 계속 증가했다.

### 에러 메시지

```txt
명시적인 런타임 에러는 없고, 활성 `study_sessions` 행의 `ended_at`이 null로 남아 시간이 계속 누적됨
```

### 원인

웹 앱은 `endTimer()`를 종료 버튼 클릭에서만 호출했다. `pagehide`, `beforeunload`, `visibilitychange` 같은 페이지 이탈 이벤트에서는 `end_study_session` RPC를 호출하지 않았다.

### 해결 방법

`apps/web/src/sessionExit.mjs`를 추가해 `keepalive` fetch로 `/rest/v1/rpc/end_study_session`을 호출하도록 했다. `apps/web/src/main.tsx`는 활성 세션이 있을 때 페이지 이탈 이벤트 리스너를 등록하고, 이벤트가 여러 번 발생해도 종료 요청을 한 번만 보낸다.

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/sessionExit.mjs`
* `apps/web/test/sessionExit.test.mjs`

### 재발 방지

브라우저 unload 계열 이벤트에서는 일반 async 요청 완료가 보장되지 않으므로, 짧은 본문과 `keepalive` 요청을 사용한다.

## 2026-06-07 - get_due_reminders user_id ambiguity

### 상황

Supabase Cron이 `attendance-cron` Edge Function을 호출했지만 Edge Function 응답이 500이었다.

### 에러 메시지

```txt
{"error":"column reference \"user_id\" is ambiguous"}
```

### 원인

`get_due_reminders`는 `returns table (user_id uuid, ...)` 구조라 PL/pgSQL 안에서 `user_id`가 출력 변수로도 존재한다. 기존 SQL의 `insert ... select user_id`와 `on conflict (user_id, local_date)`가 출력 변수와 테이블 컬럼 사이에서 모호해졌다.

### 해결 방법

`supabase/migrations/0006_fix_due_reminders_ambiguity.sql`을 추가해 `due_now`를 `dn` alias로 참조하고, `on conflict on constraint attendance_days_pkey`를 사용하도록 수정했다.

### 관련 파일

* `supabase/migrations/0006_fix_due_reminders_ambiguity.sql`
* `packages/core/test/sql-migrations.test.mjs`

### 재발 방지

PL/pgSQL `returns table` 함수 안에서는 출력 컬럼명과 같은 이름을 unqualified column으로 사용하지 않는다.

## 2026-06-07 - VAPID key rotation requires browser resubscribe

### 상황

서버 발송용 VAPID private key가 로컬에 없어 새 VAPID key pair를 생성했다.

### 에러 메시지

```txt
기존 브라우저 구독은 이전 VAPID 공개키를 기준으로 만들어져 있어 새 private key와 맞지 않을 수 있음
```

### 원인

Web Push 구독은 생성 당시의 application server key와 묶인다. 서버 VAPID key pair를 바꾸면 기존 브라우저 subscription은 새 private key로 발송할 수 없다.

### 해결 방법

`apps/web/src/webPush.ts`가 기존 subscription의 `applicationServerKey`를 현재 공개키와 비교하고, 다르면 unsubscribe 후 재구독하도록 수정했다.

### 관련 파일

* `apps/web/src/webPush.ts`
* `apps/web/src/webPushKeys.mjs`
* `apps/web/test/webPushKeys.test.mjs`

### 재발 방지

VAPID key pair를 회전한 뒤에는 사용자가 컴퓨터 알림을 다시 등록해야 한다.

## 2026-06-07 - Context7 AWS CDK 문서 조회 실패

### 상황

AWS CDK v2 문법을 확인하기 위해 Context7 문서를 조회했다.

### 에러 메시지

```txt
Invalid or expired OAuth token. Please re-authenticate to obtain a new token.
```

### 원인

현재 세션의 Context7 OAuth 토큰이 만료되어 문서 조회 도구가 사용할 수 없었다.

### 해결 방법

이미 설치된 `aws-cdk-lib` 패키지 버전 정보를 확인하고, CDK 테스트 및 `cdk synth`로 실제 템플릿 합성을 검증했다.

### 관련 파일

* `infra/aws-cdk/src/study-room-aws-stack.ts`

### 재발 방지

CDK API가 불확실할 때는 Context7 토큰 상태를 먼저 확인하고, 도구가 막히면 로컬 패키지 타입과 `cdk synth`를 기준으로 검증한다.

## 2026-06-07 - CDK RED 테스트의 모듈 없음 오류

### 상황

TDD 순서에 따라 CDK/Lambda 테스트를 먼저 추가하고 실행했다.

### 에러 메시지

```txt
ERR_MODULE_NOT_FOUND
```

### 원인

테스트가 아직 작성되지 않은 구현 파일을 import하고 있었다.

### 해결 방법

`infra/aws-cdk/lambda/attendance-cron-invoker/index.mjs`와 `infra/aws-cdk/src/study-room-aws-stack.ts`를 구현한 뒤 테스트를 통과시켰다.

### 관련 파일

* `infra/aws-cdk/lambda/attendance-cron-invoker/index.test.mjs`
* `infra/aws-cdk/test/study-room-aws-stack.test.ts`

### 재발 방지

이 오류는 RED 단계에서 의도된 실패다. 실패 원인이 오타가 아니라 구현 부재인지 확인한 뒤 GREEN 단계로 넘어간다.
## 2026-06-15 - Broad Supabase no-JWT function deploy command rejected

### Situation

While deploying the Slack recovery routine feature, a single Supabase CLI command attempted to deploy `attendance-cron`, `camera-presence-warning`, and `slack-recovery-interactions` together with `--no-verify-jwt`.

### Error Message

```txt
Sandbox escalation was rejected by the execution approval reviewer because the command disabled JWT verification broadly across multiple functions.
```

### Cause

`attendance-cron` and `camera-presence-warning` are intentionally deployed with `verify_jwt=false` and perform their own internal authentication, but the broad command looked risky because it applied that flag to all listed functions at once.

### Resolution

Use a narrower deployment path:

- Deploy only the new Slack interactivity function with `verify_jwt=false` because Slack cannot send Supabase JWTs.
- Redeploy existing no-JWT functions only through an explicitly approved, per-function deployment step or a Supabase MCP deployment that preserves the documented function configuration.

### Related Files

- `supabase/functions/attendance-cron/index.ts`
- `supabase/functions/camera-presence-warning/index.ts`
- `supabase/functions/slack-recovery-interactions/index.ts`
- `memory-bank/implementation-plan.md`

### Prevention

Avoid broad `supabase functions deploy ... --no-verify-jwt` commands that cover multiple functions. Prefer one function per deploy when `verify_jwt=false` is involved, and document why the function has its own authentication boundary.

## 2026-06-15 - Slack recovery modal secret missing

### Situation

`slack-recovery-interactions` was deployed, but Slack modal submissions require request verification with a Slack signing secret.

### Error Message

```txt
SLACK_SIGNING_SECRET is required
```

### Cause

Supabase Edge Function secrets include `STUDY_ALERT_SLACK_BOT_TOKEN`, but not `SLACK_SIGNING_SECRET`.

### Resolution

Add the Slack App signing secret to Supabase Edge Function secrets as `SLACK_SIGNING_SECRET`, then configure the Slack App Interactivity Request URL:

```txt
https://bqohkdzvxbrokkmuhysx.supabase.co/functions/v1/slack-recovery-interactions
```

### Related Files

* `supabase/functions/slack-recovery-interactions/index.ts`

### Prevention

For Slack interactive components, always check both bot-token and signing-secret secrets. Bot token is enough for sending messages, but not enough for receiving signed Slack interactivity payloads.

## 2026-06-28 - Active study session kept counting after browser or PC restart

### Situation

The user wanted login to remain available for the existing session flow, but study time should stop when the browser or computer is closed. The app restored active study_sessions rows and recalculated elapsed time from started_at, so closed-browser time could appear as study time.

### Error Message

No runtime exception. User-visible symptom: after reopening the browser or computer, an active study timer continues as if the closed time was studied.

### Cause

Supabase Auth persistence and study session persistence were coupled by the active-session restore path. The app restored status = active rows from Supabase and only capped by the 2-hour lease. Browser lifecycle events intentionally no longer ended sessions because refresh/tab switching must not lose study time.

### Fix

Added a separate client-side study-session activity heartbeat. Active sessions update localStorage every 15 seconds and on pagehide/beforeunload. When the app restores an active session, it checks the last activity timestamp before refreshing it. If the gap is more than 5 minutes, it calls end_study_session and passes the inactive gap through p_excluded_seconds. visibilitychange to visible refreshes activity so normal tab switching remains valid study time.

### Related Files

- apps/web/src/main.tsx
- apps/web/src/sessionActivity.mjs
- apps/web/test/sessionActivity.test.mjs

### Prevention

Keep Auth persistence separate from study-time persistence. Do not reintroduce lifecycle-based session ending for pagehide/beforeunload; use heartbeat cleanup or a future server-side stale-session cleanup instead.

## 2026-06-28 - Slack schedule reminders could use stale future reminder locks

### Situation

The user observed that after changing a timed schedule, Slack still appeared to send the old 5-minute-before reminder time. Example: moving a task end from 10:00 to 10:10 should move the end-soon reminder from 09:55 to 10:05.

### Error Message

    User-visible symptom:
    - Slack end-soon reminder appears at the previous schedule time after a schedule change.

### Cause

The scheduler computes due reminders from current study_todos rows, but duplicate locks in study_todo_schedule_deliveries are persistent. If a future lock exists for a schedule that is later changed, that lock is not automatically invalidated by the schedule update. This can make changed schedules fail to behave like a clean reschedule, especially when a todo moves away from and back to a previously locked scheduled_at.

### Fix

Added migration 20260628174500_clear_future_todo_schedule_deliveries.sql. It creates clear_future_todo_schedule_deliveries(p_todo_ids, p_changed_at) and a trigger on study_todos. Updates to start_time, end_time, or is_completed delete future delivery locks for the changed todo while preserving past sent delivery history.

### Related Files

- supabase/migrations/20260628174500_clear_future_todo_schedule_deliveries.sql
- supabase/migrations/20260628064614_study_todo_schedule_reminders.sql
- packages/core/test/sql-migrations.test.mjs

### Prevention

When schedule timing changes, include both current-row due calculation and duplicate-lock invalidation in tests. Remote Supabase MCP auth may expire; if so, use npx supabase db query --linked --file after linking the project, and record that db push can be blocked by migration-history mismatch.
