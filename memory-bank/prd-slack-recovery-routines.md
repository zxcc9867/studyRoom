# PRD: Slack Recovery Routines

## 1. Problem

The app currently records missed attendance and camera absence warnings, but failure does not force the user to acknowledge what happened or create a recovery plan. A forced-attendance study app needs a lightweight consequence loop.

## 2. Target Users

Students using the Slack notification channel who want stronger accountability after missing attendance or leaving the seat repeatedly during a study session.

## 3. Goals

- Create a pending recovery request after missed attendance.
- Create a pending recovery request after the second same-day camera absence warning.
- Send a Slack button that opens a recovery modal.
- Show an in-app recovery modal when a logged-in user opens the app with blocking pending recovery requests.
- Treat every pending recovery request as blocking, including same-day missed-attendance requests.
- Require reason, today's makeup task, and tomorrow's pledge before another session can start or continue.
- Create one dated todo from the submitted makeup task; keep tomorrow's pledge on the recovery request only, not as a todo.
- Send one follow-up if the pending request is not submitted for 30 minutes.

## 4. Non-goals

- Do not change a missed day back to present.
- Do not require Slack as the only recovery submission path.
- Do not map Slack users to Supabase users by Slack OAuth.
- Do not include camera-required setup warnings as recovery triggers.

## 5. User Stories

- As a student, I want Slack to ask for a recovery routine after a missed attendance, so that I must acknowledge the failure before studying again.
- As a student, I want repeated camera absence to require a recovery plan, so that leaving the seat has a concrete consequence.
- As a student, I want the submitted makeup task to become a todo, so that the actionable recovery work is visible in the app.
- As a student, I want tomorrow's pledge to be stored as a promise, not as a todo, so that time phrases such as `9시에 시작` do not clutter the task list.
- As a student, I want to submit the recovery routine inside the app when I open the URL directly, so that Slack configuration problems do not permanently block study.

## 6. User Scenarios

### Normal Flow

1. Attendance is missed or the second same-day camera absence warning is recorded.
2. Supabase creates a pending recovery request.
3. Slack receives a message with a `회복 루틴 작성` button.
4. The web app also opens a recovery routine modal after login when blocking pending requests exist.
5. The user submits the recovery routine through Slack or the app modal.
6. Supabase marks the request submitted, creates today's makeup todo, and stores tomorrow's pledge on the recovery request without creating a todo.
7. The app allows the next study session to start.

### Edge Cases

- If the same trigger fires again while a pending request exists, no duplicate pending request is created.
- If Slack target is missing, the recovery request remains pending but the app modal still lets the logged-in user submit the routine.
- If the user waits 30 minutes, one follow-up message is sent.
- If a pending recovery request is detected while a web study session is already active, the app ends that session and opens the recovery modal.
- If the user dismisses the auto-opened modal, the app still shows a manual `회복 루틴 작성` action while the request remains pending.

### Error Cases

- Invalid Slack signatures return 401.
- Missing modal fields return Slack field errors.
- Pending recovery causes `start_study_session()` to raise `Recovery routine required`.
- Invalid app modal submission returns the Supabase RPC validation error and leaves the request pending.

## 7. Functional Requirements

- [x] Add `study_recovery_requests`.
- [x] Allow users to read only their own recovery requests.
- [x] Keep recovery creation and submission on the service-role Edge Function path.
- [x] Block session start while a pending request exists.
- [x] Create only the makeup todo on Slack modal submit and store the pledge as recovery-request text.
- [x] Add missed-attendance and repeated-camera-absence trigger paths.
- [x] Add one-time 30-minute follow-up.
- [x] Show pending recovery in the web app and disable the start button.
- [x] End an already-active web session when a pending recovery request appears.
- [x] Add an in-app recovery modal that submits through an authenticated Supabase RPC.
- [x] Create only the makeup todo when the app modal is submitted and store the pledge as recovery-request text.

## 8. Non-functional Requirements

- Security: Slack requests must be verified with `SLACK_SIGNING_SECRET`.
- Privacy: No camera image, video, or landmark data is stored.
- Reliability: Duplicate pending requests are prevented by a partial unique index.
- Maintainability: Slack recovery message creation is shared by cron and camera functions.
- Availability: The app can submit a pending recovery even if Slack interactivity is unavailable.

## 9. Dependencies

- Supabase: `study_recovery_requests`, `study_todos`, `notification_targets`, `notification_deliveries`, Edge Functions.
- Supabase RPC: `submit_study_recovery_request(p_request_id, p_reason, p_makeup_todo_title, p_pledge_todo_title)`.
- Slack API: `chat.postMessage`, `views.open`, signed interactivity requests.
- Environment variables: `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN` or `STUDY_ALERT_SLACK_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ORIGIN`.

## 10. Success Metrics

- Missed attendance creates exactly one pending recovery request per user/date/trigger.
- The second same-day absence warning creates exactly one pending camera recovery request.
- Pending recovery blocks web and RPC session starts, including same-day missed-attendance recovery.
- Pending recovery stops an already-active web session when the app detects it.
- Slack modal submission creates one makeup todo, stores the pledge without a todo row, and unblocks study start.
- App modal submission creates one makeup todo, stores the pledge without a todo row, and unblocks study start.

## 11. Rollout Plan

- Develop migration, Edge Function, UI, and tests.
- Apply Supabase migration.
- Apply the authenticated app submission RPC migration.
- Deploy `slack-recovery-interactions`, `attendance-cron`, and `camera-presence-warning`.
- Configure Slack App Interactivity Request URL.
- Deploy the web app to Vercel and verify production.

## 12. Open Questions

- Whether repeated recovery failures should create stronger penalties later.
