# Actual Study Session Plan Implementation

Spec: memory-bank/prd-actual-study-plan.md (approved user plan 2026-09-21).

## Global Constraints

- Preserve original plan, adjusted schedule and actual study separately. No retrospective invented allocation.
- Exactly one focused todo/open study interval per user. Multiple linked session todos remain supported.
- Preserve attendance, camera exclusions, pause, lease expiry, completion and forest rewards. No penalty.
- Preview then atomic confirmation; cancel has no changes. Idempotency, ownership and concurrency checks are mandatory.
- Cascade only overlapping incomplete future schedules; preserve duration, repeat rule and already-studied intervals. Cross-midnight must be complete or rejected.
- No unrelated refactor, no secrets, no remote writes by workers. Parent owns memory-bank updates and release.
- Existing uncommitted highlights belong to this approved task: preserve them. Never stage unrelated .playwright-cli, output, or 0 files.
- Work in C:/jini-dev/worktrees/study-room-recovery-audit. Claim paths before editing; use apply_patch (if ACL blocks update, apply_patch creates a diff file then elevated git apply).
- TDD required. Commit scoped implementation locally for review, do not push/deploy. Do not spawn any subagents.

## Task 1: Server tracking and transactional scheduling

Own new Supabase migration(s), related SQL/Node behavioral tests, and a small server-contract document docs/session-plan/session-api.md. Do not edit frontend/highlights/memory-bank (parent does docs).

Read AGENTS.md, memory-bank/README.md, prd-actual-study-plan.md, prd-session-todo-links.md, prd-study-session-breaks.md, implementation-plan.md, active-context.md before implementation; read TDD and Supabase skills. Use Supabase MCP/CLI for read-only schema and latest function inspection (project bqohkdzvxbrokkmuhysx). Discover latest overrides, not only old migrations. Do not mutate production.

Implement additive schema for immutable original schedule/target, adjusted date/time projection used by existing planner, todo actual-study segments and adjustment history. Forward tracking only: old session times remain explicitly unknown. Untimed todo has null target and no fabricated end. Use profile timezone, dates across midnight, and keep recurrence metadata unchanged. Document exact APIs/DTOs for Task 2.

Implement read-only preview RPC and atomic confirm RPC for start/resume/switch. Input selected todo IDs, current todo, action, session ID where applicable, exclusion checkpoint as needed; output proposed current todo, remaining seconds, all before/after adjusted intervals, state/schedule revision, and any blocking error. Confirmation takes preview/revision and request UUID; rechecks ownership, state, server time, affected schedule state including phantom edits, and uses row/advisory locks plus unique constraints. Same request retried returns same result, never duplicated shifts/sessions. Stale state requires new preview, no silent acceptance. Avoid unstable exact-second fingerprints making every confirmation stale: capture start minute/window and reject/refresh only materially changed proposal. Cascade through all dates with explicit complete/incomplete status and finite guard that rejects rather than partial commit.

Track actual intervals on all lifecycle paths, including legacy pause/resume/end/expiry RPC callers. At most one open user interval. Net allocated seconds cannot exceed accepted session seconds, camera exclusion and pauses not counted twice. Existing client camera excluded counter must have a documented checkpoint contract; elapsed while unassigned remains unknown, never retro-distributed. Preserve existing camera/lease policies and attendance gates. Legacy calls must remain callable, including Expo. Do not add unvalidated arbitrary backdating or trusted client duration. New direct write grants restricted; owner-read RLS and SECURITY DEFINER fixed search_path/auth checks.

Report RPC/view or computed result must expose first actual start, delay minutes against original plan (not latest resume), on-time ratio, adjustment count, unstarted scheduled plans; exclude untimed/historical pretracking dates. No score changes.

Tests must execute relevant behavior (prefer local PostgreSQL/PGlite if available in repo, otherwise clearly report missing actual SQL execution). Red/green for 16-18 to18-20; 30m+pause+90m; switch/repeated pause/end/expiry/camera exclusion; cascade, gaps, complete tasks, repeat identity, midnight, ownership, stale change, duplicate request and rollback. Run focused tests iteratively and full npm.cmd test once. Report any unverified database behavior honestly, parent handles local/remote rollout tests after review.

Deliver local scoped commit, docs/session-plan/session-api.md with exact function signatures/DTOs/frontend integration notes, and task report with RED/GREEN commands/output, changed files, concerns. Do not exceed scope via broad existing code refactor.

## Task 2: Web session UX and planning report

Own apps/web session-related source/tests, excluding FeedDailyBriefing.tsx, techFeed.css, techFeedTypes.ts and feedHighlights.test.mjs. Consume Task 1 contract docs/session-plan/session-api.md. Parent owns memory docs. Read approved PRD and existing dashboard guards before editing. TDD and frontend-design skills apply.

Use existing session todo panel, no duplicate card. Title/state primary; actual start/resume, cumulative known seconds, goal remaining then adjusted/original schedule. Display legacy unknown allocation explicitly. One current todo selection, next todos collapsed, confirm switch. Title-only quick add allowed, time optional. One selected todo auto-focus; multiple require radio choice. Start/resume without collision confirms via existing button; collision modal lists ALL before/after dates/times and count; cancel changes nothing. Disable duplicates, reuse UUID across retry of same intent, refresh stale preview. Current progress must pause and survive refresh/device change from server. Include next-day/current linked todos not only today's list.

Coordinate camera state with server transaction: no phantom active session on cancelled preview; keep recovery/auth/dashboard loading guards. Pass camera exclusion checkpoints and update sessions/todos/links from committed response then bounded reload. Don’t let local stale optimistic updates overwrite concurrent server plan. Keep legacy Expo untouched.

Integrate planning adherence in existing report separately from study score: initial delay, on-time rate, adjustment count and unstarted plans; no rewards/attendance penalties. Preserve current report date ranges and unknown-history semantics. Add pure helpers/types focused components to avoid growing main.tsx unnecessarily, but no unrelated restructuring.

Tests: time formatting, remaining progress/pause, first late vs resume, multiple focus selection, modal before/after/midnight/cancel/stale/retry, error guards, report exclusions. Mounted browser PC+390px with keyboard/focus/escape. Run npm.cmd test/build/test:edge/mobile:check/docs:check as appropriate. Deliver local scoped commit and full report with test evidence.

## Task 3: Finish tech-feed highlights

Own existing dirty FeedDailyBriefing.tsx, techFeed.css, techFeedTypes.ts, feedHighlights.test.mjs and supabase/functions/_shared/tech-feed-briefing*.mjs plus tech-feed-highlights.test.mjs. Preserve authorized implementation, inspect and finish, no new AI call/quota or unrelated feed edits. Existing summary call chooses maximum 3 actual eligible articles, validates IDs and URLs server-side, reuses cache and omits recommendations on insufficient evidence. First hero then secondary cards, clean error state, mobile readability. Check malformed cached data/source permissions and prompt schema consistency; fix trailing blank EOF in techFeed.css. Baseline focused35tests/full719(715pass4skip) passed before task.

Use focused tests and browser mounted verification, then scoped local commit/report. Do not touch session files or parent memory docs.

## Task 4: Integration, documentation and release (controller)

Review each committed task and resolve important findings; broad final review. Update related PRD overrides, active-context/progress/implementation-plan/troubleshooting with actual results, not guesses. Full tests/build/Edge/mobile/docs and desktop390px browser checks. Apply reviewed migration through Supabase MCP, verify schema/RLS/RPC semantics (transaction rollback tests without altering real user records), deploy changed Edge function, then push release using existing GitHub Actions workflow and verify Vercel READY and HTTP200. Record deployment IDs and remaining limitations. Never claim browser/remote behavior tested if only static tests ran.
