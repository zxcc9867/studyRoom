# Kakao Notification Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add KakaoTalk "send to me" as a server-side reminder channel for the study room app.

**Architecture:** The web app links Kakao to the current Supabase user with `talk_message` scope, captures the one-time provider token from the OAuth callback, and sends it to a JWT-protected Edge Function. Supabase stores raw Kakao tokens in a service-role-only table, while `attendance-cron` uses a `kakao_memo` notification target to refresh tokens and call Kakao's "send to me" REST API.

**Tech Stack:** Vite React, Supabase Auth, Supabase Postgres/RLS, Supabase Edge Functions, Kakao REST API.

---

### Task 1: Schema And Constraint Coverage

**Files:**
- Create: `supabase/migrations/0007_kakao_message_notifications.sql`
- Modify: `packages/core/test/sql-migrations.test.mjs`

- [ ] Add a migration that creates `public.kakao_message_connections` with `user_id`, Kakao token fields, scope, enabled state, and timestamps.
- [ ] Keep raw Kakao tokens out of direct client-readable tables by enabling RLS and adding no authenticated table policies.
- [ ] Extend `notification_targets_kind_check`, `notification_targets_payload_check`, and `notification_deliveries_channel_check` to include `kakao_memo`.
- [ ] Add tests that assert the migration creates the token table, includes `kakao_memo`, and does not add user-facing select policies for the token table.

### Task 2: OAuth Helper Coverage

**Files:**
- Modify: `apps/web/src/authProviders.mjs`
- Modify: `apps/web/src/authProviders.d.mts`
- Modify: `apps/web/test/authProviders.test.mjs`

- [ ] Add `KAKAO_PROVIDER`, `KAKAO_MESSAGE_SCOPES`, and `getKakaoNotificationConnectOptions(origin)`.
- [ ] Test that Kakao OAuth includes `talk_message` and uses `/auth/callback`.

### Task 3: Kakao Token Edge Function

**Files:**
- Create: `supabase/functions/kakao-token/index.ts`

- [ ] Implement authenticated `GET` for token connection status without returning raw tokens.
- [ ] Implement authenticated `POST` that verifies a Kakao provider token, stores access/refresh tokens with service role, and upserts `notification_targets.kind = 'kakao_memo'`.
- [ ] Implement authenticated `DELETE` that disables the Kakao connection and notification target.

### Task 4: Cron Kakao Delivery

**Files:**
- Modify: `supabase/functions/attendance-cron/index.ts`

- [ ] Extend `NotificationTarget.kind` to include `kakao_memo`.
- [ ] Add Kakao token loading, refresh, and `POST https://kapi.kakao.com/v2/api/talk/memo/default/send` delivery.
- [ ] Record failures in `notification_deliveries` through the existing delivery result path.

### Task 5: Web UI Integration

**Files:**
- Create: `apps/web/src/kakaoNotifications.mjs`
- Create: `apps/web/src/kakaoNotifications.d.mts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] Add helpers to fetch Kakao status, save provider tokens, and disable the connection via Edge Function.
- [ ] Add a Settings button for "카카오톡 알림 연결".
- [ ] Capture provider tokens only when a local pending Kakao connection flag exists.
- [ ] Show a compact connection status and a clear message if Supabase manual identity linking is disabled.

### Task 6: Verification And Deployment

**Files:**
- Modify memory-bank docs after verification.

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Apply the Supabase migration with Supabase MCP.
- [ ] Deploy `kakao-token` with JWT verification enabled.
- [ ] Deploy `attendance-cron` with JWT verification disabled because it already checks `x-cron-secret`.
- [ ] Report required user-side settings: Kakao consent item `talk_message`, Supabase Manual Linking, Edge Function secrets `KAKAO_REST_API_KEY` and optional `KAKAO_CLIENT_SECRET`.
