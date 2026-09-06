# StudyRoom 2.0 connections and operations

This guide describes configuration, not proof that an account/device is connected. Rollout and verification results are recorded in `memory-bank/progress.md`.

## Where settings belong

- Web public configuration: existing `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, Web Push public VAPID key. Never expose private values through `VITE_` or `EXPO_PUBLIC_`.
- New coaching runs in Supabase Edge Functions. Its server keys must be configured there; setting a GitHub Secret alone does not configure that runtime.
- GitHub Actions Secrets hold deployment credentials only when the workflow consumes them. Do not store per-user refresh tokens in GitHub Secrets.
- Per-user Google OAuth credentials are encrypted in private server-owned storage. Disconnect removes access and associated synchronized data/pending work.

## Server environment

| Name | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Server-only OpenRouter credential |
| `OPENROUTER_MODEL` | Free model ID or `openrouter/free`; paid selection is rejected/normalized by the free-only client |
| `OPENROUTER_MAX_TOKENS` | Optional output cap, default 1024 |
| `OPENROUTER_TIMEOUT_MS` | Optional timeout, default 20000 |
| `COACH_PILOT_USER_IDS` | Optional comma-separated user UUID override. When absent, server-only `coach_pilot_users` controls rollout; an explicitly empty variable disables all pilots |
| `COACH_ENCRYPTION_KEY` | Base64-encoded 32 random bytes; server-only encryption key for integration credentials |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Web OAuth client registered for Calendar access |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG` | Selected-repository GitHub App |
| `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` | GitHub App user authorization credentials |
| `SITE_URL` | Production application origin: `https://study-room-attendance.vercel.app` |
| `CRON_SECRET` | Authenticates scheduled server entrypoints; use the existing project Vault/Edge secret consistently |

Existing Slack, Resend and Web Push secrets remain in the Edge Functions runtime. User notification preferences remain off until explicitly enabled. No email fallback to a disabled channel.

## Google Calendar

Enable Calendar API for the existing Google Cloud project. Use a Web application OAuth client and register `https://bqohkdzvxbrokkmuhysx.supabase.co/functions/v1/coach-integrations?provider=google` as the authorized redirect URI. Request offline access and the calendar-list/event read-only scopes, not write access. Add the pilot account to OAuth test users when the app is in testing mode. Testing-mode tokens and revoked grants may require reconnection; show that status rather than treating stale data as free time.

After configuration, connect from My Page, select calendars, and verify sync status. Selected calendars cover the current and next month. Event titles are display data, not AI input. Removing/cancelling events must be reflected before opportunity notifications.

## GitHub App

Install the app only on repositories to analyze. Repository permissions: Contents read-only and Metadata read-only. Enable user authorization during installation. Callback: `https://bqohkdzvxbrokkmuhysx.supabase.co/functions/v1/coach-integrations?provider=github`. Use a PEM private key (PKCS1 and PKCS8 are supported). Installation ownership and selected repository membership are verified server-side, not trusted from query parameters.

Private repository AI analysis is a separate per-repository choice. Stored output contains verified file/commit references and bounded findings, not a copy of private source files. Secrets, generated files and dependencies are excluded. The app never runs repository code or creates commits/PRs.

## Notifications and time zones

Set the preferred IANA time zone (Seoul/Tokyo are quick choices), study windows, rest, summary time and quiet hours. A device time-zone change must not overwrite the profile selection. Enable each desired channel separately; with no channels selected the coach is app-only. Web Push needs permission on each device; iOS/iPadOS needs an installed Home Screen web app. An API acceptance is not evidence of actual device receipt.

## Release verification

Apply reviewed additive migrations first, deploy authenticated functions, configure secrets, then schedule the separate worker and notification jobs. Verify the pilot gate before enabling. Deploy web only after tests/build and API contracts pass. Test Google connect/sync/revoke, public/private GitHub repository select/disconnect, recommendation acceptance and all enabled notification channels with the signed-in pilot account. Keep external-configuration and device-verification gaps explicit.

To stop coaching, turn off the user's coach setting (jobs and senders recheck it), disable channel preferences or remove the pilot allowlist. Preserve original timers, attendance, goals and badges. The two-week outcome evaluation begins only after real end-to-end operation is verified.
