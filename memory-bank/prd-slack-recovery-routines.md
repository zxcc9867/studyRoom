# PRD: Slack Recovery Routines

## 1. Problem

The app currently records missed attendance and camera absence warnings, but failure does not force the user to acknowledge what happened or create a recovery plan. A forced-attendance study app needs a lightweight consequence loop.

## 2. Target Users

Students using the Slack notification channel who want stronger accountability after missing attendance or leaving the seat repeatedly during a study session.

## 3. Goals

- Create a pending recovery request after missed attendance.
- Create a pending recovery request after the second same-day camera absence warning.
- Send a Slack button that opens a recovery modal.
- Require reason, today's makeup task, and tomorrow's pledge before another session can start.
- Create dated todos from submitted recovery content.
- Send one follow-up if the pending request is not submitted for 30 minutes.

## 4. Non-goals

- Do not change a missed day back to present.
- Do not build an in-app recovery form in v1.
- Do not map Slack users to Supabase users by Slack OAuth.
- Do not include camera-required setup warnings as recovery triggers.

## 5. User Stories

- As a student, I want Slack to ask for a recovery routine after a missed attendance, so that I must acknowledge the failure before studying again.
- As a student, I want repeated camera absence to require a recovery plan, so that leaving the seat has a concrete consequence.
- As a student, I want submitted recovery tasks to become todos, so that the plan is visible in the app.

## 6. User Scenarios

### Normal Flow

1. Attendance is missed or the second same-day camera absence warning is recorded.
2. Supabase creates a pending recovery request.
3. Slack receives a message with a `회복 루틴 작성` button.
4. The user clicks the button and submits a modal.
5. Supabase marks the request submitted and creates today/tomorrow todos.
6. The app allows the next study session to start.

### Edge Cases

- If the same trigger fires again while a pending request exists, no duplicate pending request is created.
- If Slack target is missing, the recovery request remains pending and the app still blocks study start.
- If the user waits 30 minutes, one follow-up message is sent.

### Error Cases

- Invalid Slack signatures return 401.
- Missing modal fields return Slack field errors.
- Pending recovery causes `start_study_session()` to raise `Recovery routine required`.

## 7. Functional Requirements

- [x] Add `study_recovery_requests`.
- [x] Allow users to read only their own recovery requests.
- [x] Keep recovery creation and submission on the service-role Edge Function path.
- [x] Block session start while a pending request exists.
- [x] Create makeup and pledge todos on Slack modal submit.
- [x] Add missed-attendance and repeated-camera-absence trigger paths.
- [x] Add one-time 30-minute follow-up.
- [x] Show pending recovery in the web app and disable the start button.

## 8. Non-functional Requirements

- Security: Slack requests must be verified with `SLACK_SIGNING_SECRET`.
- Privacy: No camera image, video, or landmark data is stored.
- Reliability: Duplicate pending requests are prevented by a partial unique index.
- Maintainability: Slack recovery message creation is shared by cron and camera functions.

## 9. Dependencies

- Supabase: `study_recovery_requests`, `study_todos`, `notification_targets`, `notification_deliveries`, Edge Functions.
- Slack API: `chat.postMessage`, `views.open`, signed interactivity requests.
- Environment variables: `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN` or `STUDY_ALERT_SLACK_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ORIGIN`.

## 10. Success Metrics

- Missed attendance creates exactly one pending recovery request per user/date/trigger.
- The second same-day absence warning creates exactly one pending camera recovery request.
- Pending recovery blocks web and RPC session starts.
- Slack modal submission creates two todos and unblocks study start.

## 11. Rollout Plan

- Develop migration, Edge Function, UI, and tests.
- Apply Supabase migration.
- Deploy `slack-recovery-interactions`, `attendance-cron`, and `camera-presence-warning`.
- Configure Slack App Interactivity Request URL.
- Deploy the web app to Vercel and verify production.

## 12. Open Questions

- Whether to add an optional in-app fallback recovery form if Slack is unavailable.
- Whether repeated recovery failures should create stronger penalties later.
