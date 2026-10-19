# Mobile lifecycle and stale continuation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the remaining directly testable Android flows without changing existing learning history, and remove stale reflection continuation advice.

**Architecture:** Keep DashboardApp as study/camera state owner and hosted Android as the same authenticated web client. Select the latest reflection including an empty next action; never delete or rewrite historical reflections.

**Tech Stack:** React/TypeScript, Supabase, Node test runner, Playwright, installed Android16 APK0.2.4/code7.

**Spec:** memory-bank/prd-cross-device-study.md and memory-bank/prd-sustainable-study-loop.md.

## Global Constraints

- Existing learning/recovery records, camera criteria, 5/10-minute rules, single-owner generation, and membership remain unchanged.
- Normal UI only for real study; new values must be prefixed `[테스트]`. Do not submit a fabricated recovery routine or bypass its gate.
- Actual physical posture and real-phone OEM/DND acceptance are not proven by fixtures or the emulator.
- Preserve the pre-existing dirty operational/evidence files and rollback refs.

### Task 1: Baseline and installed Android lifecycle

**Files:** docs/cross-device-study/mobile-lifecycle-20261019.md; existing output/android-024-20261018/ui.mjs (read-only).

**Interfaces:** Reads actual UI, package version, camera AppOps and owner-scoped SQL aggregates. Produces dated, bounded acceptance evidence.

- [x] Fetch remote, inspect worktree/claims; create fix/mobile-camera-lifecycle from1d7a7c0.
- [x] Boot existing AVD without wiping data; compare displayed account fingerprints and collect pre-test history counts/digests.
- [x] Verify settings/tabs, HOME→foreground and COLD restart preserve login/history and do not request camera.
- [x] Conditional study check evaluated: user selected other checks first;10/19 recovery remains pending. Retain gate, no new study/todo or fabricated recovery.

### Task 2: Stop reviving old next actions

**Files:** apps/web/src/dashboardData.ts; apps/web/src/main.tsx; apps/web/test/dashboardDataBehavior.test.mjs; apps/web/test/actualStudyMounted.test.mjs; memory-bank/prd-sustainable-study-loop.md.

**Interfaces:** loadDashboardData(client,userId) returns latestReflectionData, including next_action:null; Dashboard follow-up save uses the same latest-reflection contract.

- [x] Add a real query-boundary regression: old non-empty action plus a newer empty reflection returns the newer reflection. Also test owner isolation and a newer non-empty action.
- [x] Run `node --test apps/web/test/dashboardDataBehavior.test.mjs`; confirm stale-action RED.
- [x] Remove only the non-null filter; update saved reflection selection even when the new action is blank, without replacing a newer reflection when editing an older inbox entry.
- [x] Add mounted coverage for the visible Today advice and preserved reflection history; focused5/5, verify Dune0/all5exit0, full actual-Chrome1348/1348.

### Task 3: Review, release and preservation

**Files:** docs/cross-device-study/mobile-lifecycle-20261019.md; memory-bank/active-context.md; memory-bank/progress.md; memory-bank/trouble-shooting.md.

- [x] Independent shared-reviewer review of the bounded diff and verification evidence; no Critical/Important issue.
- [x] Commit only owned source/tests/docs as3312ad0; preserve mixed pre-existing memory diffs with scoped staging.
- [x] Push feature branch and dispatch vercel-production.yml; Actions39271816694 success, exact-SHA Vercel production READY, site/JavaScriptHTTP200.
- [x] Recheck actual PC/Android stale advice, recovery gate, login/history and pre-existing row digests; no new learning rows and all4baseline digests equal. Physical and recovery-blocked acceptance remains explicitly separate.
