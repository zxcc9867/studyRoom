# Technology Feed Freshness and Continuous Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show genuinely recent individual technology articles in a continuous feed while keeping older resources accessible and dates honest.

**Architecture:** The existing Supabase RPC remains the owner-filtered cursor source. A new `deep_read` view separates older/unknown-date material, while collection narrows web-search results and rejects dated catalog pages. The React feed renders all loaded cursor chunks, discovers more near the bottom, and defers newly arrived posts behind a stable banner.

**Tech Stack:** Vite/React/TypeScript, shared JavaScript modules, Supabase Postgres/Edge Functions, PGlite, Node test runner.

**Spec:** `memory-bank/prd-tech-feed.md` section `2026-09-27 설계 검토안 — 최신 기술 흐름을 읽는 피드`.

**2026-09-27 rollout status:** The user explicitly requested deployment. The reviewed implementation and AWS Startups catalog regression are released in commit `827b148`; all 812 Node/browser tests, Edge, web-build, mobile and docs checks passed locally. Migration `20260927092206`, feed Edge v39/worker v37, and Vercel production `dpl_8nDELXLQbzQ7F1rMr2G8q14FV7Ax` are applied/READY. Signed-in manual refresh and the next scheduled collection remain unverified.

## Global Constraints

- `최신` means an individually authored article with a non-future provider/source date in the prior 30 days. No publication date means `깊이 읽기`, never `최신`.
- All card dates include a year; web-search dates say `검색 제공 날짜`, not verified original publication.
- Keep bookmarks, linked todos, existing owner RLS, RSS permission review, one-search-per-refresh, free-only provider limits, and no full-page crawling.
- Do not automatically reorder cards during reading. No search/duplicate/provider counts in reader-facing notices.
- Browser receives no server keys. Roll out DB/RPC, Edge, then web; verify production only after tests.

---

### Task 1: Server-side feed views and cursor parity

**Files:**
- Create: `supabase/migrations/20260927092206_tech_feed_fresh_views.sql`
- Modify: `supabase/functions/_shared/tech-feed-api.mjs`
- Modify: `supabase/functions/_shared/tech-feed-store.ts`
- Modify: `supabase/functions/_shared/tech-feed-briefing.mjs`
- Test: `supabase/functions/_shared/tech-feed-briefing-db.test.mjs`
- Test: `supabase/functions/_shared/tech-feed-api.test.mjs`

**Interfaces:** `view` accepts `latest | deep_read | saved`; existing `tech_feed_list` arguments/response and owner-only visibility stay compatible. `tech_feed_filter_candidates` applies the same view predicate as the list before topic/language filtering. Briefing candidate articles exclude old/unknown-date items from insight/highlight selection while statistics retain their truthful discovery counts.

- [ ] **Step 1: Add RED PGlite tests.** Seed a recent, 2025-dated, undated, future-dated, saved, and other-owner article. At a fixed database timestamp, call `tech_feed_list(owner,'latest')`, `tech_feed_list(owner,'deep_read')`, and `tech_feed_list(owner,'saved')`. Assert IDs, total, cursor stability over 20+ records, and saved/other-owner isolation. Assert `tech_feed_filter_candidates` matches each view. Add API tests accepting `deep_read` and rejecting unknown views.
- [ ] **Step 2: Run** `node --test supabase/functions/_shared/tech-feed-briefing-db.test.mjs supabase/functions/_shared/tech-feed-api.test.mjs` **and confirm missing view behavior fails.**
- [ ] **Step 3: Create migration with** `npx.cmd supabase migration new tech_feed_fresh_views`. Keep `tech_feed_visible('latest')` as the existing owner-filtered discovery universe because the daily briefing uses it for truthful discovery statistics. Extend its owner predicate to accept `deep_read` identically to `latest`, then apply the mutually exclusive 30-day publication-date predicate inside `tech_feed_list` and `tech_feed_filter_candidates` only. Preserve the `saved` owner predicate, `(discovered_at,id)` cursor order, and JSON shape. Extend API/store view validation and briefing candidate selection accordingly.
- [ ] **Step 4: Run focused tests and confirm GREEN**, then run the full PGlite feed discovery/briefing tests. No production migration yet.

### Task 2: Fresh search results and catalog rejection

**Files:**
- Modify: `supabase/functions/_shared/tech-feed-search.mjs`
- Modify: `supabase/functions/_shared/tech-feed-query.mjs`
- Modify: `packages/core/src/feedContent.mjs`
- Test: `supabase/functions/_shared/tech-feed-search.test.mjs`
- Test: `supabase/functions/_shared/tech-feed-query.test.mjs`
- Test: `supabase/functions/_shared/tech-feed-content.test.mjs`

**Interfaces:** `createTavilySearch().search(query,signal)` still returns at most five sanitized items; `focusedSearchQuery(topic,cursor)` still rotates interests; `feedContentKind(url,title)` adds narrow catalog-path detection without excluding individual `/tutorials/<slug>` articles.

- [ ] **Step 1: Add RED tests** for `time_range:'month'`, publication dates older than 30 days/missing/future excluded, `https://academy.claude.com/tutorials` classified as listing, and `https://academy.claude.com/tutorials/real-lesson` retained. Add one release/change intent and one Korean implementation intent rotation assertion.
- [ ] **Step 2: Run** `node --test supabase/functions/_shared/tech-feed-search.test.mjs supabase/functions/_shared/tech-feed-query.test.mjs supabase/functions/_shared/tech-feed-content.test.mjs` **and confirm expected failures.**
- [ ] **Step 3: Change only search payload, date guard, catalog rule, and rotating query text.** Preserve request size/time limits, free-plan validation, provider mutex, URL deduplication, and no page-body fetching.
- [ ] **Step 4: Run focused tests to GREEN** and search-worker regression tests.

### Task 3: Honest, scannable article cards and notices

**Files:**
- Modify: `apps/web/src/TechFeedSection.tsx`
- Modify: `apps/web/src/feedPresentation.mjs`
- Modify: `apps/web/src/techFeed.mjs`
- Modify: `apps/web/src/techFeed.css`
- Test: `apps/web/test/techFeedView.test.mjs`
- Test: `apps/web/test/feedPresentation.test.mjs`
- Test: `apps/web/test/techFeedRefresh.test.mjs`

**Interfaces:** `FeedArticleCard` continues to take `article,timeZone,busy,onSave,onPlan`; `feedExcerptView` returns the existing `{full,preview,expandable}` shape. `manualRefreshMessage` no longer displays provider/search/dedup counts.

- [ ] **Step 1: Add RED tests** asserting `2025.12.19` appears for the photographed article, web-search date label is `검색 제공 날짜`, RSS date label is `발행일`, undated articles say `날짜 미확인`, and a concatenated `# / ## / ###` catalog excerpt has no literal heading markers in its preview. Assert the refresh notice has no `N건` provider count.
- [ ] **Step 2: Run** `node --test apps/web/test/techFeedView.test.mjs apps/web/test/feedPresentation.test.mjs apps/web/test/techFeedRefresh.test.mjs` **and confirm RED.**
- [ ] **Step 3: Add a year to the Korean formatter, separate date provenance by `origin`, clean only card previews, and use an honest source-link fallback for contents with no meaningful sentences.** Keep safe expanded Markdown and article URL unchanged. Adjust card CSS for date/title/excerpt hierarchy within existing tokens.
- [ ] **Step 4: Run focused tests to GREEN** and check 375px/1440px card wrapping.

### Task 4: Continuous scroll without surprise reordering

**Files:**
- Modify: `apps/web/src/TechFeedSection.tsx`
- Modify: `apps/web/src/feedPresentation.mjs`
- Modify: `apps/web/src/techFeedTypes.ts`
- Modify: `apps/web/src/techFeed.css`
- Test: `apps/web/test/feedPresentation.test.mjs`
- Test: `apps/web/test/feedSavedPagination.test.mjs`
- Test: `apps/web/test/feedResponsiveBrowser.test.mjs`

**Interfaces:** `FeedPage` remains `{items,next_cursor,total}`. The list loads one 20-item chunk at a time and merges by ID. A visible bottom sentinel requests the next cursor once; a button offers keyboard/no-IntersectionObserver retry. Filters, account, and view reset the generation/abort guard. A low-frequency head-only list check flags new IDs; user activation, not background polling, re-renders from the top.

- [ ] **Step 1: Add RED tests** for 43 loaded items remaining visible in order, deduped overlap, saved removal, `deep_read` switch reset, bottom sentinel one-request guard, and top new-post banner preserving current cards until clicked. Browser tests cover 375px and 1440px; the fallback button remains keyboard reachable.
- [ ] **Step 2: Run focused tests and confirm RED.**
- [ ] **Step 3: Replace numbered pagination with accumulated cursor list, `IntersectionObserver` sentinel, retry/fallback button, and non-reordering top banner.** Keep existing `generation`/`settingsGeneration` abort safeguards; poll the head only while visible or on focus, without invoking the collection endpoint.
- [ ] **Step 4: Run focused tests to GREEN**, then `npm.cmd run build` and browser tests where configured.

### Task 5: Documentation, full verification, staged rollout

**Files:**
- Modify: `memory-bank/prd-tech-feed.md`
- Modify: `memory-bank/active-context.md`
- Modify: `memory-bank/progress.md`
- Modify: `memory-bank/implementation-plan.md`
- Modify: `memory-bank/trouble-shooting.md` if an actual new failure is found

- [x] **Step 1: Reconcile the approved PRD section with final implementation and record actual database/RPC/API changes.** Preserve older decisions as history, marking superseded rules explicitly.
- [x] **Step 2: Run** `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:edge`, `npm.cmd run mobile:check`, `npm.cmd run docs:check`, and relevant 375px/1440px browser checks; report skips explicitly.
- [x] **Step 3: Review the exact diff, commit only scoped files, apply the generated migration, deploy both feed Edge functions, then push the web commit for the repository's production workflow.** Do not include pre-existing `.playwright-cli`, `0`, or `output/` artifacts.
- [ ] **Step 4: Verify Supabase migration/function versions, one real scheduled/manual outcome without spending paid credits, Vercel deployment `READY`, production HTTP 200, and latest/deep-reading behavior.** Migration/function versions, Vercel READY/HTTP 200, and database list separation are verified; the next real scheduled/manual collection and signed-in UI remain unverified and are recorded in `memory-bank/progress.md`.
