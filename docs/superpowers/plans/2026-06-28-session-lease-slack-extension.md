# Session Lease Slack Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change study session lease duration to 1 hour, send Slack 5 minutes before lease expiry, and let the user extend the active session by 1 hour from Slack.

**Architecture:** Store session lease state in Supabase so server-side cron can send alerts even when the browser is closed. Keep the existing Slack Interactivity URL by routing the new session action through `slack-recovery-interactions`. The web app reads `study_sessions.lease_expires_at` first and keeps localStorage only as a compatibility fallback.

**Tech Stack:** Vite React, Supabase Postgres/RPC, Supabase Edge Functions, Slack Bot API, Node test runner.

---

### Task 1: Failing Tests For 1-Hour Lease And Server Session Alerts

**Files:**
- Modify: `apps/web/test/sessionLease.test.mjs`
- Modify: `packages/core/test/sql-migrations.test.mjs`

- [ ] Change the session lease test to expect `SESSION_LEASE_DURATION_SECONDS === 60 * 60`.
- [ ] Add SQL/source tests that require:
  - `study_sessions.lease_expires_at`
  - `study_sessions.lease_warning_sent_at`
  - `get_due_session_lease_warnings(p_now)`
  - `extend_study_session_lease(p_session_id, p_extension_minutes)`
  - `attendance-cron` dispatching due session lease warnings.
  - `slack-recovery-interactions` handling `extend_session_lease_60`.
- [ ] Run `node --test apps\web\test\sessionLease.test.mjs packages\core\test\sql-migrations.test.mjs`.
- [ ] Expected result: tests fail because the duration is still 2 hours and server lease functions/actions do not exist.

### Task 2: Supabase Migration

**Files:**
- Create: `supabase/migrations/<timestamp>_session_lease_slack_warnings.sql`

- [ ] Use `npx.cmd supabase migration new session_lease_slack_warnings`.
- [ ] Add nullable columns to `study_sessions`:
  - `lease_expires_at timestamptz`
  - `lease_warning_sent_at timestamptz`
- [ ] Backfill active sessions with `coalesce(lease_expires_at, started_at + interval '1 hour')`.
- [ ] Update `start_study_session()` so newly created sessions set `lease_expires_at = now() + interval '1 hour'`.
- [ ] Add `extend_study_session_lease(p_session_id uuid, p_extension_minutes integer default 60)` as `SECURITY DEFINER`, checking:
  - authenticated user owns the active session, or service role call can extend via Slack.
  - extension minutes must be exactly 60 for this MVP.
  - new deadline is `greatest(existing lease_expires_at, now()) + interval '60 minutes'`.
  - `lease_warning_sent_at = null` after extension.
- [ ] Add `get_due_session_lease_warnings(p_now timestamptz default now())` returning active sessions whose `lease_expires_at` is within 5 minutes and warning is unsent, joined to enabled Slack target.
- [ ] Grant execute to `authenticated` for `extend_study_session_lease`; grant execute to `service_role` for both new functions; revoke from public.

### Task 3: Edge Functions

**Files:**
- Modify: `supabase/functions/attendance-cron/index.ts`
- Modify: `supabase/functions/slack-recovery-interactions/index.ts`

- [ ] In `attendance-cron`, call `get_due_session_lease_warnings`.
- [ ] For each due warning, send Slack `chat.postMessage` with text and Block Kit button:
  - title: `⏰ 세션 종료 5분 전`
  - button: `1시간 연장`
  - action_id: `extend_session_lease_60`
  - value: `session_lease_extension|{session_id}|60`
- [ ] After successful Slack send, set `study_sessions.lease_warning_sent_at = now`.
- [ ] In `slack-recovery-interactions`, detect `extend_session_lease_60`, call `extend_study_session_lease`, and reply ephemerally that the session was extended by 1 hour.

### Task 4: Web App Lease Behavior

**Files:**
- Modify: `apps/web/src/sessionLease.mjs`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/test/sessionLease.test.mjs`

- [ ] Change `SESSION_LEASE_DURATION_SECONDS` to `60 * 60`.
- [ ] Prefer `activeSession.lease_expires_at` over localStorage when deriving the deadline.
- [ ] Update the in-app `세션 유지` button to call `extend_study_session_lease` with 60 minutes, then refresh the active session deadline locally.
- [ ] Change visible text from 2 hours to 1 hour.

### Task 5: Docs, Verification, Deploy

**Files:**
- Modify: `memory-bank/active-context.md`
- Modify: `memory-bank/progress.md`
- Modify: `memory-bank/implementation-plan.md`
- Modify: `memory-bank/prd-session-activity-heartbeat.md`
- Modify: `memory-bank/prd-slack-notifications.md`

- [ ] Update docs to state the lease is now 1 hour and server-side Slack warning is available 5 minutes before expiry.
- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Apply migration to Supabase project `bqohkdzvxbrokkmuhysx`.
- [ ] Deploy `attendance-cron` and `slack-recovery-interactions`.
- [ ] Commit, push `main`, and verify Vercel production URL returns HTTP 200.

## Execution Result

- RED tests were added and observed failing for the old two-hour lease and missing server/Slack lease wiring.
- Supabase migration `20260628093258_session_lease_slack_warnings.sql` was created and applied to project `bqohkdzvxbrokkmuhysx`.
- `attendance-cron` v24 and `slack-recovery-interactions` v7 were deployed.
- `npm.cmd test` passed 187 tests.
- `npm.cmd run build` passed with the existing chunk-size warning.