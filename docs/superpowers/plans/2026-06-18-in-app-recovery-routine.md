# In-App Recovery Routine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users submit pending recovery routines either from Slack or directly inside the web app after opening the app URL.

**Architecture:** Add a Supabase RPC that authenticated users can call for their own pending `study_recovery_requests`. The web app will automatically surface an in-app recovery modal for pending requests, submit through the RPC, refresh dashboard data, and unblock study start.

**Tech Stack:** Vite React, Supabase Postgres RPC, Supabase Data API, Node test runner, Vercel GitHub Actions deployment.

---

### Task 1: PRD And Docs

**Files:**
- Modify: `memory-bank/prd-slack-recovery-routines.md`
- Modify: `memory-bank/implementation-plan.md`
- Modify: `memory-bank/active-context.md`
- Modify: `memory-bank/progress.md`

- [ ] Update the PRD non-goals so in-app fallback is no longer excluded.
- [ ] Document the app modal as a second submission path beside Slack.
- [ ] Record that Slack remains supported and app submission uses authenticated Supabase RPC.

### Task 2: Recovery Submit RPC

**Files:**
- Modify: `supabase/migrations/20260618121536_in_app_recovery_submission.sql`

- [ ] Create `public.submit_study_recovery_request(p_request_id uuid, p_reason text, p_makeup_todo_title text, p_pledge_todo_title text)`.
- [ ] Validate `auth.uid()` and request ownership.
- [ ] Accept only pending requests.
- [ ] Trim and validate required fields: reason 1-400 chars, todo titles 1-120 chars.
- [ ] Mark the request submitted and create today's makeup todo plus tomorrow's pledge todo.
- [ ] Grant execute to `authenticated`.

### Task 3: Web Modal

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] Add local modal state for the selected pending recovery request.
- [ ] Automatically open the modal when dashboard loads with pending requests.
- [ ] Add buttons on the recovery blocker and soft recovery sections to open the modal manually.
- [ ] Submit form values through `supabase.rpc("submit_study_recovery_request", ...)`.
- [ ] On success, reload dashboard data and allow the start button if no blockers remain.

### Task 4: Tests

**Files:**
- Modify or create: `apps/web/test/slackNotifications.test.mjs`

- [ ] Add source-level tests that verify the app calls `submit_study_recovery_request`.
- [ ] Verify the modal contains the three required field names.
- [ ] Verify start blocking still exists for pending blocking recovery requests.
- [ ] Run targeted tests first, then full `npm.cmd test` and `npm.cmd run build`.

### Task 5: Deploy

**Files:**
- Migration applied remotely through Supabase MCP.
- Web app deployed through GitHub Actions/Vercel.

- [ ] Apply the migration to Supabase project `bqohkdzvxbrokkmuhysx`.
- [ ] Verify the RPC exists and rejects unauthenticated calls.
- [ ] Commit and push the app change to `origin/main`.
- [ ] Confirm GitHub Actions succeeds.
- [ ] Confirm Vercel deployment is `READY`.
- [ ] Confirm production URL returns HTTP 200 and contains the in-app recovery modal code.
