# Editable Recurring Todos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users see and edit the time, weekday repeat settings, and repeat period of existing calendar todos.

**Architecture:** Keep `study_todos` as the materialized date-based todo table, but add lightweight repeat metadata columns so future recurring saves can be edited as a group. The web modal reuses the existing add controls as an edit form, with legacy rows falling back to single-row editing.

**Tech Stack:** Vite React, Supabase Postgres/RLS, Node test runner, Vercel static deployment.

---

### Task 1: Repeat Metadata Schema

**Files:**
- Create: `supabase/migrations/0020_study_todo_repeat_metadata.sql`
- Modify: `packages/core/test/sql-migrations.test.mjs`

- [ ] Add a failing SQL source test that expects `repeat_group_id`, `repeat_mode`, `repeat_weekdays`, `repeat_until`, RLS-safe grants, and a repeat metadata index on `study_todos`.
- [ ] Run `node --test packages\core\test\sql-migrations.test.mjs` and confirm the new test fails.
- [ ] Add the migration with nullable metadata columns, constraints, comments, and explicit `authenticated` grants.
- [ ] Re-run the migration test and confirm it passes.

### Task 2: Repeat Metadata Helpers

**Files:**
- Modify: `apps/web/src/todoRecurrence.mjs`
- Modify: `apps/web/src/todoRecurrence.d.mts`
- Modify: `apps/web/test/todoRecurrence.test.mjs`

- [ ] Add failing helper tests for repeat metadata labels and sanitized weekday arrays.
- [ ] Run `node --test apps\web\test\todoRecurrence.test.mjs` and confirm failure.
- [ ] Implement `normalizeTodoRepeatWeekdays`, `formatTodoRepeatLabel`, and `isWeeklyTodo`.
- [ ] Re-run the helper tests and confirm they pass.

### Task 3: Modal Edit Flow

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/test/slackNotifications.test.mjs` or a new focused web source test

- [ ] Add failing source tests that expect `editingTodoId`, `startTodoEditing`, `saveTodo`, repeat metadata insert/update fields, and visible metadata chips.
- [ ] Run the focused web test and confirm failure.
- [ ] Add repeat metadata to the `StudyTodo` type and loaded/select fields.
- [ ] Replace `addTodo()` form submission with `saveTodo()` that branches into add or edit.
- [ ] On add, write repeat metadata for weekly todos and generate a shared `repeat_group_id`.
- [ ] On edit, update a repeat group when `repeat_group_id` exists; otherwise update the selected row and optionally create a new repeat group when weekly mode is selected.
- [ ] Render time/repeat/period chips and an edit button for every todo row.
- [ ] Add compact modal styles that keep the Animal Crossing-style design.
- [ ] Re-run focused web tests.

### Task 4: Verification, Docs, Deploy

**Files:**
- Modify: `memory-bank/active-context.md`
- Modify: `memory-bank/progress.md`
- Modify: `memory-bank/implementation-plan.md`
- Modify: `memory-bank/prd-recurring-todos.md`

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git diff --check`.
- [ ] Apply the Supabase migration to project `bqohkdzvxbrokkmuhysx`.
- [ ] Update memory-bank docs with the new repeat metadata/editing behavior.
- [ ] Commit and push to `origin/main`.
- [ ] Verify Vercel production deployment is `READY` and production URL returns HTTP 200.
