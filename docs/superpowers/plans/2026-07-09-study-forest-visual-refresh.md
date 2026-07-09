# Study Forest Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Study Forest reward page feel like a richer cozy 2.5D study island without adding backend state or external assets.

**Architecture:** Keep the feature client-only in the existing Vite React dashboard. Add decorative JSX layers inside the current `study-forest-scene` block and expand CSS-only depth, props, and ambient motion. Preserve the existing `studyForest.mjs` streak/tree/avatar state model.

**Tech Stack:** Vite React, CSS, Node test runner, existing source-level UI tests.

---

### Task 1: Lock Visual Contracts With Tests

**Files:**
- Modify: `apps/web/test/studyForestUi.test.mjs`

- [ ] **Step 1: Add a failing source-level UI test**

Add assertions for new scene classes and animations:

```js
test("study forest scene renders richer island layers and ambient details", () => {
  assert.match(mainSource, /className="forest-distant-hill forest-distant-hill-left"/);
  assert.match(mainSource, /className="forest-distant-hill forest-distant-hill-right"/);
  assert.match(mainSource, /className="forest-river"/);
  assert.match(mainSource, /className="forest-bridge"/);
  assert.match(mainSource, /className="forest-garden-bed"/);
  assert.match(mainSource, /className="forest-lantern forest-lantern-left"/);
  assert.match(mainSource, /className="forest-firefly forest-firefly-one"/);
  assert.match(mainSource, /className="forest-foreground-grass"/);
  assert.match(cssSource, /\.forest-river\s*\{[\s\S]*linear-gradient/);
  assert.match(cssSource, /\.forest-bridge\s*\{[\s\S]*rotateX/);
  assert.match(cssSource, /\.forest-garden-bed\s*\{[\s\S]*repeating-linear-gradient/);
  assert.match(cssSource, /@keyframes forest-cloud-drift/);
  assert.match(cssSource, /@keyframes forest-water-shimmer/);
  assert.match(cssSource, /@keyframes forest-firefly-float/);
  assert.match(cssSource, /@keyframes forest-leaf-sway/);
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
node --test apps\web\test\studyForestUi.test.mjs
```

Expected: FAIL because the richer scene classes and keyframes do not exist yet.

### Task 2: Add Richer 2.5D Scene Layers

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Add decorative scene elements**

Inside the existing `study-forest-scene`, add distant hills, a river, bridge, garden bed, lanterns, fireflies, and foreground grass as aria-hidden decorative elements.

- [ ] **Step 2: Style the new elements**

Add CSS for island depth, water shimmer, warm light, garden texture, cloud drift, firefly movement, and leaf sway.

- [ ] **Step 3: Keep existing avatar movement intact**

Do not change `studyForest.mjs`, avatar state, keyboard controls, or click-to-walk behavior.

### Task 3: Verify, Document, Deploy

**Files:**
- Modify: `memory-bank/active-context.md`
- Modify: `memory-bank/progress.md`
- Modify: `memory-bank/implementation-plan.md`
- Modify: `memory-bank/prd-study-forest.md`

- [ ] **Step 1: Run targeted tests**

```powershell
node --test apps\web\test\studyForestUi.test.mjs apps\web\test\studyForest.test.mjs
```

- [ ] **Step 2: Run full verification**

```powershell
npm.cmd test
npm.cmd run build
git diff --check
```

- [ ] **Step 3: Update memory-bank**

Record that the forest page now uses a richer CSS-only 2.5D island scene with decorative layers and ambient animation.

- [ ] **Step 4: Commit, push, and verify Vercel**

Commit the web-visible change, push `origin/main`, wait for Vercel deployment to reach `READY`, and confirm `https://study-room-attendance.vercel.app/#forest` returns HTTP 200.
