# Telegram and In-App Popup Notifications Design

## Context

The study-room app already sends scheduled reminders through Supabase Cron and the `attendance-cron` Edge Function. Email delivery depends on Resend, web push depends on browser and OS notification permission, and Kakao requires OAuth linking. The user wants a simpler message channel and a visible computer-side popup.

## Decision

Implement Telegram first. Slack can be added later as another destination-based channel if needed.

Telegram is simpler for a personal MVP because it only needs a bot token stored as an Edge Function secret and a user-specific chat ID stored in `notification_targets.destination`. The frontend never stores or sends the bot token.

## Architecture

- Add `telegram` to `notification_targets.kind` and `notification_deliveries.channel`.
- Store Telegram chat IDs as `notification_targets.destination`.
- Store the bot token only in the Supabase Edge Function secret `TELEGRAM_BOT_TOKEN`.
- Extend `attendance-cron` to call Telegram Bot API `sendMessage` for `telegram` targets.
- Add a Telegram Chat ID field and status badge to the settings panel.
- Add an in-app modal popup that appears at the configured reminder minute when the dashboard is open.

## Data Flow

1. User enters a Telegram chat ID in settings.
2. Web app validates the ID and upserts a `telegram` notification target.
3. Supabase Cron calls `attendance-cron` every minute.
4. `get_due_reminders` returns users due in that minute.
5. `attendance-cron` loads enabled targets and sends Telegram messages.
6. Delivery success or failure is recorded in `notification_deliveries`.

## Popup Behavior

The in-app popup is not a system popup and cannot work when the browser is closed. It is a dashboard modal shown when:

- the user is logged in,
- the app is open,
- the local current time matches the saved reminder time,
- the day is not already `present` or `missed`,
- the same reminder has not already been dismissed for that user/date/time.

## Error Handling

- Invalid Telegram chat IDs are rejected in the settings UI.
- Missing `TELEGRAM_BOT_TOKEN` causes delivery failure and is recorded in `notification_deliveries`.
- Telegram API non-2xx or `{ ok: false }` responses are recorded as failed deliveries.

## Testing

- SQL migration test confirms `telegram` is accepted as a destination-based channel.
- Source-level Edge Function test confirms the Telegram branch uses `TELEGRAM_BOT_TOKEN` and `sendMessage`.
- Web helper tests validate Telegram chat ID normalization and validation.
- Full verification uses `npm.cmd test` and `npm.cmd run build`.
