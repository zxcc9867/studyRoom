# Daily Planner Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mark daily planner and untimed todos complete when no study session is active, while preserving end-session completion during active sessions.

**Architecture:** Reuse the existing `setTodosCompleted()` Supabase update path. Add a small UI wrapper in `apps/web/src/main.tsx` that blocks direct completion while `activeSession` exists and otherwise updates `study_todos.is_completed`.

**Tech Stack:** Vite React, Supabase Data API, Node test runner.

---

### Task 1: Add Regression Tests

**Files:**
- Modify: `apps/web/test/slackNotifications.test.mjs`

- [ ] **Step 1: Write failing source-level tests**

Add tests that require:
- `toggleTodoCompletion(todo)` wrapper.
- `renderTodoList()` checkbox `onChange` to call `toggleTodoCompletion(todo)`.
- `renderTodoList()` checkbox disabled only when `todoBusy || Boolean(activeSession)`.
- `renderDailyPlanner()` selected plan actions to include a completion button.

- [ ] **Step 2: Run targeted test**

Run: `node --test apps\web\test\slackNotifications.test.mjs`

Expected: FAIL because these UI hooks do not exist yet.

### Task 2: Implement UI Completion Toggle

**Files:**
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Add `toggleTodoCompletion(todo)`**

Use `setTodosCompleted([todo.id], !todo.is_completed)` and catch errors through `formatNotificationError`.

- [ ] **Step 2: Update untimed todo list checkboxes**

`renderTodoList()` should keep completion read-only during active sessions but call `toggleTodoCompletion(todo)` when no session is active.

- [ ] **Step 3: Update selected planner detail actions**

Add a `완료 체크` / `미완료로 변경` button next to edit/delete. Disable it during active sessions.

- [ ] **Step 4: Run targeted test**

Run: `node --test apps\web\test\slackNotifications.test.mjs`

Expected: PASS.

### Task 3: Verify And Ship

**Files:**
- Modify: `memory-bank/active-context.md`
- Modify: `memory-bank/progress.md`
- Modify if needed: `memory-bank/implementation-plan.md`

- [ ] **Step 1: Run full tests**

Run: `npm.cmd test`

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`

- [ ] **Step 3: Update memory-bank**

Record the direct-completion behavior and the active-session guard.

- [ ] **Step 4: Commit, push, and verify Vercel**

Push to `origin/main`, wait for GitHub Actions Vercel production deploy, and confirm `https://study-room-attendance.vercel.app/` returns HTTP 200.