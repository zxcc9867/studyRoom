# My Page Todo History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-dashboard My Page section with profile summary and paginated completed todo history.

**Architecture:** Reuse the existing single-page dashboard and Supabase `study_todos` data. Keep history filtering, statistics, and pagination in a small pure helper module so the large React file only handles rendering.

**Tech Stack:** Vite React, TypeScript, Supabase, Node test runner, CSS.

---

### Task 1: Todo History Helpers

**Files:**
- Create: `apps/web/src/todoHistory.mjs`
- Create: `apps/web/src/todoHistory.d.mts`
- Create: `apps/web/test/todoHistory.test.mjs`

- [ ] **Step 1: Write failing helper tests**

Create tests that assert completed todos are filtered and sorted by `local_date` descending, pagination returns 10 items per page and clamps invalid pages, and stats count total completed plus current-month completed.

- [ ] **Step 2: Run helper tests and confirm RED**

Run: `node --test apps\web\test\todoHistory.test.mjs`

Expected: fail because `apps/web/src/todoHistory.mjs` does not exist.

- [ ] **Step 3: Implement helper module**

Implement `getCompletedTodoHistory(todos)`, `paginateTodoHistory(items, page, pageSize)`, and `calculateTodoHistoryStats(todos, monthKey)`.

- [ ] **Step 4: Run helper tests and confirm GREEN**

Run: `node --test apps\web\test\todoHistory.test.mjs`

Expected: all helper tests pass.

### Task 2: Dashboard Integration

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Add My Page to dashboard sections**

Add `me` to `dashboardSections`, add the sidebar anchor, and compute helper-derived state from `studyTodos`.

- [ ] **Step 2: Render profile summary and history list**

Add a section with profile summary cards, completed todo stats, completed todo list, and pagination controls.

- [ ] **Step 3: Add focused CSS**

Add My Page classes that match the existing light Animal Crossing-style dashboard without nested decorative cards.

### Task 3: Verification and Documentation

**Files:**
- Modify: `memory-bank/active-context.md`
- Modify: `memory-bank/progress.md`
- Modify: `memory-bank/implementation-plan.md`

- [ ] **Step 1: Run full verification**

Run: `npm.cmd test`

Expected: all tests pass.

Run: `npm.cmd run build`

Expected: Vite production build succeeds.

- [ ] **Step 2: Update memory-bank**

Record the My Page feature, changed files, verification, and remaining deployment note.
