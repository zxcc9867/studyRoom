# Actual study plan — verification record

## Baseline (2026-09-21)

Worktree: `C:/jini-dev/worktrees/study-room-recovery-audit`, branch `codex/recovery-consistency`, base `53cd701d17e777cef279e9d7bab91d1b756294b4`.

Existing authorized highlight work was present at baseline; no new session implementation was included in these runs.

| Check | Result |
|---|---|
| `npm.cmd test` | 719 tests: 715 pass, 4 optional browser skips, 0 fail |
| Same command with installed `FEED_BROWSER_MODULE` / `FEED_BROWSER_EXECUTABLE` | 719/719 pass, no skips |
| `npm.cmd run build` | Passed, 1713 modules transformed |
| `npm.cmd run mobile:check` | Dependency compatibility + Expo TypeScript passed |
| `npm.cmd run docs:check` | 24 image references across 3 languages passed |
| `npm.cmd run test:edge` | Type checks + 11 runtime tests passed; existing Deno dependency punycode deprecation warning |

Read-only Supabase Advisors baseline (09:59 UTC, before session migration): security INFO no-policy16; WARN mutable search_path2, public extension1, authenticated security-definer exposure7, password protection1. Performance INFO unindexed FK20, unused index20, table bloat1; WARN RLS initplan7, multiple permissive policies7. These predate this task and are not automatically changed as part of session UX.

## Server implementation and first review

- Initial server commit `3429c93`: real SQL29/29 and full748/748 tests passed, including optional browser checks.
- Review found3 important defects: lossy DST clock projection, missing-profile timezone fallback mismatch, pending camera subtraction order.
- Fix commit `9526b85`:5 new regressions reproduced failures before changes and passed afterwards; SQL34/34passed. Full-suite748 result is the earlier baseline, not fresh evidence for this fix.
- Unrepresentable date/two-clock projection now blocks the whole preview, never silently truncates a day. Missing profile uses existing Asia/Tokyo default. Pending exclusion subtracts from known seconds before target clamping.

## Actual PostgreSQL18 multi-connection validation

A separate localhost-only PostgreSQL18 cluster was created under output/actual-study-pg18 on127.0.0.1:55439. No production keys, user records or network service were used. The fixture executes existing lifecycle RPC bodies and the actual new migration.

Command: `node output/actual-study-pg-concurrency.mjs` (second run with `ACTUAL_PG_DATABASE=actual_study_round1`).

Both initial and fixed migration passed4/4:

1. Two concurrent confirmations with same UUID return identical JSON; exactly one session and adjustment set.
2. Same preview with distinct concurrent UUIDs starts once; other request is stale.
3. Legacy concurrent todo edit holds its row; confirmation waits, recomputes and rejects stale proposal; session stays paused.
4. A conflicting table lock times out at bounded wait; no session/schedule mutation.

The first repeat-fixture setup failed because roles are cluster-global, then the JavaScript string replacement reduced SQL dollar delimiters. The fixture now conditionally creates roles and uses a replacement callback to preserve dollar delimiters. Final4/4 evidence is after those fixture-only corrections. These were not application failures.

## Release gate

Server fix re-review is clean. Web integration passed a full775/775 run (no skips) before the additional legacy-empty-selection compatibility case was identified; this is not the final release evidence. Current-tree rerun/review, highlights completion/review and production rollout remain pending. No operational session migration has been applied yet.

## Production preflight and visual inspection

- Live PostgreSQL17.6 confirmed. Preflight snapshot count242todos,88session links,0active sessions; these are point-in-time aggregates, not a permanent guarantee.
- Reviewed auth-user/todo/session triggers before preparing an isolated synthetic transaction. The smoke fixture uses no email destination and rolls back all inserted data. It has not run against production yet.
- Parent inspected viewport390px panel and conflict-dialog screenshots. Explicit cream surface/dark text corrected low-contrast inheritance from the blue parent focus panel; dates, metadata and both actions fit.
- Real camera hardware/media inference was not exercised by the mounted fixture. Synthetic media errors are not evidence of a production camera failure.

## Handoff rerun on the current tree (2026-09-21, Claude session)

The original Codex session stopped mid-Task 3 when its credits were exhausted. A Claude session took over
at commit `9bb654c` with the highlights work still uncommitted, released the stale
`codex-highlights-20260921` claim after the user confirmed that session had ended, and re-ran every gate on
the current tree.

| Check | Result |
|---|---|
| `npm.cmd test` with `FEED_BROWSER_MODULE`/`FEED_BROWSER_EXECUTABLE` | 782 tests, 782 pass, 0 fail, 0 skip |
| `npm.cmd test` without the browser variables | 782 tests, 765 pass, 0 fail, 17 optional browser skips |
| `npm.cmd run build` | Passed |
| `npm.cmd run test:edge` | Type checks plus 11 runtime tests passed; the known Deno punycode deprecation warning remains |
| `npm.cmd run mobile:check` | Dependency compatibility plus Expo TypeScript passed |
| `npm.cmd run docs:check` | 24 image references across 3 languages passed |
| `git diff --check` | Clean after removing the trailing blank line at the end of `techFeed.css` |

The browser module path is `playwright/index.mjs`; `index.js` imports without a `chromium` named export and
silently skips the mounted tests, which is what produced the 17 skips in the first run.

Task 3 is now local commit `ff026e5` (`feat(feed): rank up to three highlight picks in the daily briefing`),
covering the briefing prompt/parser, the `FeedDailyBriefing` hero-plus-secondary rendering, the type and CSS
changes, and 8 focused highlight tests. `BRIEFING_ANALYZER_VERSION` moves to 2, so existing cached briefings
are regenerated on the next explicit request rather than rendered without picks.

### Focused review of the web integration

This was a targeted review of the highest-risk surfaces, not a line-by-line re-review of all 435 changed
`main.tsx` lines. Reviewed: the `actualStudy.mjs` helpers, the prepare/confirm intent flow including
idempotency-UUID reuse and stale-preview refresh, the pause/resume/end and camera-prompt coordination, and
the migration's RLS, grants, locking and idempotency structure. No defect was found that changes behavior.
Two release-relevant observations:

- `DB/RPC before web` is a hard ordering requirement, not a preference. While an active session exists whose
  tracking state has not loaded, the start/pause control and the end control are both disabled, and
  `endTimer` returns early. If the web ships before the migration, a user with an open session cannot pause
  or end it from the browser until `get_actual_study_state` succeeds. The lease-refresh poll does rehydrate
  tracking, so the UI recovers by itself once the RPC works.
- `actual_study_private.requests` has no retention or cleanup. It grows by one row per confirmed action and
  should get a pruning job or a retention window as a separate follow-up.

### Still pending

Production rollout has not started. This session's Supabase MCP connector is unauthenticated and the worktree
has no `supabase/config.toml` or linked project ref, so the migration could not be applied from here. The user
chose to authenticate Supabase and resume the rollout afterwards. `origin/main` is still `53cd701`, so the
release remains a clean fast-forward. No production schema, Edge Function, deployment or user record has been
changed by this session.
