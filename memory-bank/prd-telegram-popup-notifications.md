# PRD: Telegram and In-App Popup Notifications

## 1. Problem

Email fallback requires a Resend API key and web push depends on browser or OS notification permission. The user wants a simpler external notification channel, a visible in-app popup when the study-room page is open, and a direct way to test Telegram delivery from the app.

## 2. Target Users

Personal MVP users who want reliable reminders through Telegram and a visible browser-page popup while the dashboard is open.

## 3. Goals

- Add Telegram as a server-side notification target.
- Keep Telegram bot token in Supabase Edge Function secrets only.
- Let the user save a Telegram chat ID from the web settings screen.
- Let the user send a Telegram test alarm from the web settings screen after saving a Telegram chat ID.
- Send Telegram messages from `attendance-cron` at the daily reminder time.
- Show an in-app popup modal at the reminder time when the web app is open.
- Include reminder-date todo list items in Telegram, Web Push computer notifications, and the in-app popup when any todos exist for that date.

## 4. Non-goals

- Slack is not implemented in this iteration.
- Telegram bot creation and chat ID discovery are not automated.
- A website cannot force a browser popup window when the app is closed.
- Browser code must not know `CRON_SECRET` or `TELEGRAM_BOT_TOKEN`.

## 5. User Stories

```md
- As a student, I want Telegram reminders, so that I can receive alerts on my phone without Kakao OAuth.
- As a student, I want to send a Telegram test alarm from settings, so that I can verify the setup without asking Codex to trigger it.
- As a student, I want a visible in-app popup when the dashboard is open, so that I notice the reminder even if OS notifications are quiet.
```

## 6. User Scenarios

### Normal Flow

1. User creates a Telegram bot and sends a message to it.
2. User obtains the Telegram chat ID.
3. User enters the chat ID in the web app settings and saves.
4. User clicks `Telegram test alarm` to send a one-off test message to their saved Telegram target.
5. Supabase Cron invokes `attendance-cron`.
6. `attendance-cron` sends a Telegram `sendMessage` request when the reminder is due.
7. If todos exist for the reminder date, the notification includes a compact today-tasks summary.
8. If the web app is open at reminder time, an in-app modal popup appears with the same date's todos.

### Edge Cases

- If no Telegram chat ID is saved, no Telegram target is created.
- If no Telegram chat ID is connected, the Telegram test alarm button is disabled or shows a save-first message.
- If the bot token secret is missing, Telegram delivery fails and is recorded in `notification_deliveries`.
- If the user already dismissed today's popup, it does not repeatedly appear in the same minute.
- If the reminder date has no todos, notification text stays focused on the study-room check-in instruction.
- If the date has more todos than fit in a compact notification body, the message shows the first few and summarizes the remaining count.

### Error Cases

- Invalid chat ID causes Telegram API failure.
- Browser or app is closed, so only server-side notification channels can alert the user.
- Authenticated test alarm requests without a saved Telegram target return a user-facing error.
- Unauthenticated `telegram-test-alarm` requests return `401`.

## 7. Functional Requirements

- [x] Add `telegram` to notification target and delivery channel constraints.
- [x] Add Telegram chat ID save flow to the web settings UI.
- [x] Add authenticated Telegram test alarm button to the web settings UI.
- [x] Add Telegram send branch to `attendance-cron`.
- [x] Add app-open reminder popup modal.
- [x] Add tests for migration, Telegram API branch, and authenticated test alarm UI.
- [x] Include reminder-date todos in server-side notification bodies and the app-open reminder popup.

## 8. Non-functional Requirements

- Security: Telegram bot token must not be stored in frontend code or memory-bank.
- Security: Browser test alarm requests must use the user's Supabase JWT and must not expose `CRON_SECRET`.
- Maintainability: Telegram notification registration follows the existing `notification_targets` model.
- Reliability: Delivery failures are recorded with error messages.

## 9. Dependencies

- Supabase: `notification_targets`, `notification_deliveries`, Edge Function secrets
- Supabase: `study_todos`
- API: Telegram Bot API `sendMessage`
- Environment variable: `TELEGRAM_BOT_TOKEN`
- Environment variable: `CRON_SECRET`

## 10. Success Metrics

- `notification_targets.kind = 'telegram'` can be saved.
- `attendance-cron` records Telegram delivery status.
- `telegram-test-alarm` allows an authenticated user to send a test alarm only to their own Telegram target.
- Notifications include reminder-date todo titles when `study_todos` rows exist for that date.
- `npm.cmd test` and `npm.cmd run build` pass.

## 11. Rollout Plan

- Development: SQL, Edge Function, web UI, popup modal.
- Test: local Node tests and build.
- Deploy: apply migration, redeploy `attendance-cron`, redeploy `telegram-test-alarm`, and deploy the web app.
- Monitor: `notification_deliveries` and `net._http_response`.

## 12. Open Questions

- Whether Slack should be added later as a separate channel.
