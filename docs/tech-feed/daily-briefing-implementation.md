# Daily briefing implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute each task with RED/GREEN evidence and task-scoped review. Do not spawn nested agents.

**Goal:** Implement approved classification, safe formatted introductions, dynamic view filters and on-demand daily insight.
**Architecture:** Pure content helpers shared by web and worker; server-owned visibility, facets and daily snapshots; React components consume bounded APIs independently of study controls.
**Tech Stack:** Existing React/Vite/TypeScript, Node tests, Supabase PostgreSQL/Edge Deno, PGlite, existing free OpenRouter client.
**Spec:** docs/tech-feed/daily-briefing-design.md (approved by latest user "구현해줘").

## Global Constraints

- Preserve timer/attendance/recovery/auth, all existing records and source permissions. No paid fallback. Existing search900/month, DeepL450000 chars/month and shared AI6 actual calls/user/day remain.
- Classifier fallback: preserve valid AI category, conservative rules, unknown null; no forced classification. Existing rows batch50, version and lease bounded.
- Preview260 chars, safe headings/paragraph/list/emphasis/code, no raw HTML/iframe/image execution; preserve C# and #include.
- Daily statistics cover all currently visible latest articles by discovered_at in server profile timezone, independent of page/filter. AI sample at most24, excerpt160 minimum/2000 maximum, non-video and permission-approved; at least2 items, max3 insight entries, each cites1–3 input IDs.
- Cache scoped to user/date/timezone/content/version; generation explicit only, shared quota reservation immediately before actual call; cache hit and duplicate lease consume no AI.20s provider/30s request/90s lease,90day retention. Revalidate access before save/serve. No added frequent cron.
- Source/identity input from client is not trusted. Service-role RPCs are not public APIs. Private prompt must not become shared tags or AI payload.
- One implementation agent at a time. Main owns docs and release. Agents claim owned paths, do not revert others, do not commit/push/deploy; main performs scoped release commits after reviews. Existing unrelated doc changes/output are preserved.

## Task 1: Pure classification and formatted-text model

**Files:** Create packages/core/src/feedClassification.mjs (+.d.mts), packages/core/src/feedMarkdown.mjs (+.d.mts), packages/core/test/feedClassification.test.mjs, packages/core/test/feedMarkdown.test.mjs. Own these only. Read existing feedContent.mjs; do not modify it in this task.

**Interfaces:**
```ts
classifyFeedArticle(article:{title?:string;excerpt?:string;category?:string|null;summary_status?:string;category_method?:string|null}, prompt?:string): {category:'news'|'practice'|'deep_dive'|null;method:'ai'|'rules'|null;rules_version:number;tags:string[]}
feedTopicTags(title:string,excerpt:string,prompt?:string):string[]
feedMarkdownPreview(text:string,limit?:number):string
parseFeedMarkdown(text:string):FeedBlock[]
// FeedBlock and inline tokens must be exported in the declaration and report;
// they carry escaped-by-React text, never HTML strings.
```

- [x] Write tests first; catches forcing unrelated text into news, overwriting AI classification, publishing private prompt whole, erasing C#/#include, markdown markers in preview, executable unsafe links/rawHTML. Examples:
```js
assert.equal(classifyFeedArticle({title:'Introducing PostgreSQL 18',excerpt:'New release available'}).category,'news');
assert.equal(classifyFeedArticle({title:'A walk in the park'}).category,null);
assert.equal(feedMarkdownPreview('### Title\n\nUse **C#** and `#include`.'),'Title Use C# and #include.');
assert.ok(!feedTopicTags('Backend with Redis','Cache tutorial','private unrelated prompt').includes('private unrelated prompt'));
```
- [x] Run node --test packages/core/test/feedClassification.test.mjs packages/core/test/feedMarkdown.test.mjs; prove missing behavior RED. Use namespace imports/dynamic checks if missing module errors prevent behavioral assertion.
- [x] Implement deterministic conservative rules, alias-aware technical tags, user tokens only on actual textual match, max concise label length. Implement small bounded safe Markdown AST parser and plain preview. Do not fetch URLs or add dependencies. Max text input bounded to stored/excerpt scale; protect nested/malformed input from pathological complexity.
```js
export function classifyFeedArticle(article,prompt='') {
  // Preserve valid ready AI result first; derive local fallback and tags from text.
  // Treat category_method=rules as rules rather than AI.
}
```
- [x] GREEN tests, add literal Korean/English/mixed/conflict/code/list/link fixtures and AST expectations. Document actual tokens in report for Task3. Run core tests once and report mutation-sensitive assertions.
- [x] Self-review then report; no commit. Task reviewer receives staged-free diff including new files through no-index diff package.

## Task 2: Server facets, classification persistence and daily insight

**Files:** New migration generated via CLI; new supabase/functions/_shared/tech-feed-briefing.mjs + tests, classification worker module + tests; modify tech-feed-api.mjs/store.ts/worker-core.mjs/tech-feed index.ts as needed; own only supabase/ files. Use Task1 helpers, no modifications to web/core.

**Interfaces consumed:** classifyFeedArticle, feedTopicTags. **Public API DTO:**
```ts
// existing action=list gains optional topic,source_key; old inputs remain compatible.
// source_key is "rss:<uuid>" or "host:<normalized hostname>"; no network access.
type Facets={total:number;topics:{value:string;label:string;count:number}[];sources:{value:string;label:string;count:number}[]};
// action=facets accepts view latest|saved, returns Facets for unfiltered visible universe.
type Briefing={local_date:string;time_zone:string;total:number;source_count:number;
 categories:{value:string;label:string;count:number}[];topics:{value:string;label:string;count:number}[];
 eligible_count:number;analyzed_count:number;generated_at:string|null;
 status:'idle'|'ready'|'generating'|'insufficient'|'quota_exhausted'|'unavailable'|'paused';stale:boolean;
 insights:{title:string;body:string;study_angle:string;sources:{id:string;title:string;url:string}[]}[]};
// action=briefing is read only; action=briefing_generate explicitly creates/cache-reads.
// list items add topics:string[],category_method and rules_version; preserve existing fields.
```

- [x] First write PGlite tests using existing migration harness for daily date interval,21+ rows/pages, duplicate origins, foreign owner access, cache hit/no quota, lease exclusivity, stale completions, revoked subscription, readonly stats, saved filter parity. RED before schema implementation.
```js
// Hand fixture: discovered at 2026-09-13T15:00Z is Sep14 in Asia/Tokyo;
// one minute earlier excluded; published_at unrelated.
assert.equal(result.total,21);
assert.equal(otherOwnerResult.total,0);
assert.equal(secondClaim.status,'generating');
```
- [x] Generate additive migration with npx.cmd supabase migration new tech_feed_daily_briefing; inspect live structure/permissions through MCP before operational changes, not private data. Reuse one visibility implementation across list/facets/daily; keep existing DTO mapping and20+1 cursor behavior. Facets are server-wide visible scope, not only page. Include host sources for web search and filter latest/saved identically.
- [x] Persist rule classification/version/topics with bounded50row claim/finish lease and current article content revalidation. Preserve ready AI category. Private prompt-dependent tags stay per-user query results; do not write them into shared article metadata. Worker cleanup integration versioned and no new cron.
- [x] Implement daily server stats and source-round-robin selection. Store personal snapshot/lease/result in RLS table; authenticated owner SELECT only; service-role claim/finish RPC with revoked public/anon/authenticated grants. Enforce user/date lease,90day batched cleanup, no network in SQL transaction. Cache invalidation by eligible/current-visible input content and analyzer version; removed access hides prior cache. Full total is independent of sample and list filters.
- [x] Add orchestration tests first: provider failure/timeout/malformed/citation forgery, no-call for0/1/cached/paused/quota; response allowlist with server URL mapping.
```js
assert.equal(response.status,'insufficient');assert.equal(providerCalls,0);
assert.equal(cached.status,'ready');assert.equal(providerCalls,1);
assert.equal(forgedCitation.status,'unavailable');
```
- [x] Implement handler/store/API wiring with existing askFeedAi and quota reserve callback.20sec AI and30sec request limit,90sec lease. Recheck receiving/access before call, persist, return. AI input is only ID/title/excerpt/stats, no personal prompt/userId/email. Failure distinction, no new automatic AI scheduling.
- [x] Run focused tests GREEN, existing Edge/core feed regression; report migration filename and DTO examples. No deployment or commit. Parent does operations after review.

## Task 3: React reading, filters and briefing integration

**Files:** apps/web/src/FeedArticleText.tsx, FeedDailyBriefing.tsx, FeedViewFilters.tsx (+testable helpers if needed); modify TechFeedSection.tsx, techFeedTypes.ts, techFeed.mjs/declarations, feedPresentation.mjs/declarations, techFeed.css, relevant apps/web/test files. Own apps/web only.

**Consumes:** Task1 AST/preview/classification; Task2 API DTO above. Retain safeFeedUrl and existing media components. Daily panel receives api,userId,timeZone,refresh revision independently of view/page/topic/source.

- [x] RED tests on real SSR/render/component integration for preview markers, structured expanded text, disabled HTML/javascript media, categories without repeated unknown badges, custom tag facet beyond old5 options and whole-prompt suppression. Test real UI with fixture API, not source grep.
```js
assert.match(html,/오늘 수집된 내 피드/);
assert.doesNotMatch(html,/<script|href="javascript:/);
assert.match(html,/실무·튜토리얼/);
```
- [x] Implement AST to React elements, accessible expand/link semantics, bounded code scroll and safe URL rendering. Keep original text/source accessible; preview is cleaned before truncation. Preserve content-policy video/promotion/chapter safeguards.
- [x] Replace fixed visible interest controls with collapsed dynamic filters and summary/count/reset. Remove fixed interest checkbox UI without DB deletion. source_key supports actual web hosts. Facets read complete visible scope; filters apply both latest and saved. Existing cursor/page reset and stale-request guards remain.
- [x] Implement independent daily panel: auto stats on entry/refresh completion/timezone/day change or tab reactivation; button generation, cache/stale timestamps and analyzed/total labels, cited original links. No generation on mount/filter change or automatic request loops. State/error independent of feed save/todo/study controls. Handle account-switch cleanup, pending/error/insufficient/quota/paused with safe retained data.
- [x] GREEN tests, build and390/1440px browser cases: all4 improvements, more than20 facets, next-page/saved filter parity, API errors/retry, cached generation without new call, day/account change, no horizontal overflow or JS errors.
- [x] Report focused test/browser evidence, no commit/deploy. Parent final integration review follows.

## Task 4: Integration, documentation and release (parent)

- [ ] Review all three task diffs against spec; all Important/Critical findings resolved before release. Run npm.cmd test, run build, run test:edge, run mobile:check, run docs:check. Recheck frontend at390/1440 and source citations with isolated fixture browser.
- [ ] Update approved design status, README3languages and memory-bank actual results; claim docs and reread before patching. Keep preexisting server diagnosis changes separate from this feature's release commit.
- [ ] Deploy additive DB migration through MCP, verify RLS/grants/query plan. Deploy only tech-feed API/worker via verified CLI, then scoped commit/push per local AGENTS and GitHub Actions production workflow.
- [ ] Verify API authorization rejection, bounded backfill, stats/list contract, valid source-link rendering, Actions success/Vercel READY/rootHTTP200. Generate AI in owner scope only if current authenticated owner available; otherwise mark actual-user AI generation unverified, never impersonate arbitrary users.
- [ ] Report tested implementation and deployment separately from unavailable live-user checks. Keep all decisions in project records and release path claims.
