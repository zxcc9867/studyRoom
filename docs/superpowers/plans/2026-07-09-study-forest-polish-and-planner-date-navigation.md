# Study Forest Polish and Planner Date Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Study Forest page feel like a polished 2.5D cozy forest space and make the planner date controls move relative to the currently selected date.

**Architecture:** Keep the forest as a lightweight React/CSS 2.5D scene with no new backend state. Add a small planner-date helper for previous/next navigation and wire the Today Tasks buttons to the selected date instead of the real today date.

**Tech Stack:** Vite React, CSS, Node test runner, existing Supabase-backed static web app.

---

### Task 1: Planner Date Navigation

**Files:**
- Modify: `apps/web/src/plannerDate.mjs`
- Modify: `apps/web/test/plannerDate.test.mjs`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that calls `getAdjacentPlannerDate("2026-06-29", -1)` and expects `2026-06-28`, then calls it repeatedly from the returned value and expects another day back. Also test `+1`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps\web\test\plannerDate.test.mjs`
Expected: FAIL because `getAdjacentPlannerDate` is not exported.

- [ ] **Step 3: Implement minimal helper and UI wiring**

Export `getAdjacentPlannerDate(dateKey, offsetDays)` from `plannerDate.mjs`. Import it in `main.tsx` and change the date controls so the left button uses `selectedTodoDate - 1`, the right button uses `selectedTodoDate + 1`, and the middle button still jumps to `todayDateKey`.

- [ ] **Step 4: Verify**

Run: `node --test apps\web\test\plannerDate.test.mjs`
Expected: PASS.

### Task 2: Cozy 2.5D Forest Visual Polish

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/test/studyForestUi.test.mjs`

- [ ] **Step 1: Write the failing test**

Extend the Study Forest UI source test to require character detail parts, decorative scene props, layered sky/ground textures, and visible avatar animation/depth styles.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps\web\test\studyForestUi.test.mjs`
Expected: FAIL because the new decorative classes do not exist yet.

- [ ] **Step 3: Implement minimal React/CSS changes**

Add decorative scene elements in the forest JSX: clouds, flowers, stones, sign, house, fence, avatar face/arms/backpack. Update CSS with a more toy-like rounded visual language, layered hills, leaf textures, bouncy idle animation, larger avatar, and stronger 2.5D shadows.

- [ ] **Step 4: Verify**

Run: `node --test apps\web\test\studyForestUi.test.mjs`
Expected: PASS.

### Task 3: Full Verification and Deployment

**Files:**
- Modify memory-bank documents if implementation status or known failure modes change.

- [ ] **Step 1: Run targeted tests**

Run: `node --test apps\web\test\plannerDate.test.mjs apps\web\test\studyForestUi.test.mjs apps\web\test\studyForest.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run full tests and build**

Run: `npm.cmd test`
Expected: PASS.

Run: `npm.cmd run build`
Expected: PASS.

- [ ] **Step 3: Commit, push, and deploy**

Commit the logical change, push to `origin/main`, then verify Vercel deployment reaches `READY` and `https://study-room-attendance.vercel.app/` returns HTTP 200.
