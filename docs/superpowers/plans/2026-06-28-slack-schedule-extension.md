# Slack Schedule Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Slack schedule reminders to extend a timed todo by 5 or 10 minutes and push every later incomplete timed todo on the same date by the same amount.

**Architecture:** Keep Supabase Cron as the sender. Add Slack Block Kit actions to timed todo reminder messages and route those actions through the existing `slack-recovery-interactions` Edge Function, which already owns the Slack App Interactivity Request URL. The RPC updates the selected todo and every later incomplete timed todo for the same user/date in one transaction-like function.

**Tech Stack:** Supabase Postgres, Supabase Edge Functions, Slack Bot API Block Kit, Node test runner.

---

### Task 1: SQL RPC and Source Tests

**Files:**
- Create: `supabase/migrations/<timestamp>_extend_todo_schedule.sql`
- Modify: `packages/core/test/sql-migrations.test.mjs`

- [ ] Add a failing test that asserts an `extend_todo_schedule` function exists, accepts a todo id and extension minutes, validates allowed minute values, skips completed todos, and updates all later incomplete same-date timed todos.
- [ ] Run `node --test packages/core/test/sql-migrations.test.mjs` and verify failure.
- [ ] Add the migration with `supabase migration new extend_todo_schedule` and implement the function.
- [ ] Re-run the targeted test and verify pass.

### Task 2: Slack Message Buttons and Interaction Function

**Files:**
- Modify: `supabase/functions/attendance-cron/index.ts`
- Modify: `supabase/functions/slack-recovery-interactions/index.ts`
- Modify: `packages/core/test/sql-migrations.test.mjs`

- [ ] Add failing source tests that schedule Slack reminders send `blocks` with `extend_schedule_5`, `extend_schedule_10`, and `extend_schedule_custom` actions, and that `slack-recovery-interactions` verifies Slack signatures, routes schedule actions, opens the custom extension modal, and calls `extend_todo_schedule`.
- [ ] Run the targeted test and verify failure.
- [ ] Add Block Kit action buttons to schedule reminder Slack messages.
- [ ] Extend the existing Slack interactivity Edge Function for 5/10 minute button handling and custom 1-120 minute modal input.
- [ ] Re-run the targeted test and verify pass.

### Task 3: Docs, Remote Deploy, and Verification

**Files:**
- Modify: `memory-bank/active-context.md`
- Modify: `memory-bank/progress.md`
- Modify: `memory-bank/implementation-plan.md`
- Modify: `memory-bank/prd-slack-notifications.md`

- [ ] Update memory-bank docs with the extension policy: later incomplete same-day timed todos move together; completed todos are ignored.
- [ ] Run `npm.cmd test` and `npm.cmd run build`.
- [ ] Apply the migration to Supabase project `bqohkdzvxbrokkmuhysx` and deploy `attendance-cron` plus `slack-recovery-interactions`.
- [ ] Commit, push, and verify Vercel production status if the workflow triggers.