# Web-search technology feed Implementation Plan

Status2026-09-12: Tasks1/2 implemented and independently reviewed after scoped fixes; whole-change review and its single documentation fix re-review are approved. Local integration533/533+Edge/build/mobile/docs and staged whitespace checks passed. Task3 local verification/documentation is complete; operational steps remain unapplied: explicit commit/push/deploy approval, dedicated free search key and collector authentication are outstanding. Checkboxes below retain the original execution checklist; current evidence is in web-search-verification.md and memory-bank/progress.md.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Users configure interests on the website and receive shared-cache, free-only web search plus RSS/API feed.
**Architecture:** Extend existing Supabase feed API/worker/store with a shared search-topic queue and atomic provider budget. React remains the consumer of authenticated state/list and owner settings; no provider secret reaches browser.
**Tech Stack:** Vite React TypeScript, Supabase PostgreSQL/Edge Deno, Node test/PGlite, Tavily HTTPS API.
**Spec:** docs/tech-feed/web-search-spec.md

## Global Constraints
- No paid fallback or billing changes; missing/unknown account free status fails closed.
- Local search attempt budget900/month, clamp0..900; provider free allowance<=1000, paygo disabled, one provider execution lease.
- RSS/API must continue independently of web search exhaustion/error; never weaken SSRF/XXE/auth.
- Shared canonical query cache one hour; one user active query3..300 chars; page20, max search results5.
- Free AI actual6/user/day shared with existing restart coaching, failures count, max3/articles per call.
- No keys/PII in output, logs, docs, Git, or frontend. Prompt sent to provider only after explicit receiving consent.
- Additive migrations; no unrelated changes. Preserve attendance/timer/forest/timezone/todo.
- Workers do not spawn subagents, push, deploy, or mutate remote DB. Commits confined to owned files after tests; controller owns operational deployment and memory-bank.
- Existing dirty memory-bank/topic design belongs to this task's earlier planning and must be preserved.

## Task 1: Server shared search, quota, owner preferences and feed integration
**Ownership:** supabase/functions/_shared/tech-feed* (existing and new), supabase/functions/tech-feed/index.ts, supabase/functions/tech-feed-worker/index.ts, new migration via CLI. Do not touch apps/web, README, package.json, other non-feed functions, memory-bank.
**New focused modules:** tech-feed-topics.mjs, tech-feed-search.mjs, tech-feed-search-worker.mjs with matching .test.mjs. Existing core/store/API/worker integration may be edited. Schema and integration tests in tech-feed-search-db.test.mjs (reuse existing PGlite setup by extracting a shared test helper if needed). Keep implementation modules single-responsibility; no giant pasted generic framework.
**Interfaces:** Exact external API from Spec Data and API contract. Internal adapter exports createTavilySearch({env,fetchImpl}) returning availability()/search(query,signal), canonicalTopic(prompt) returns {prompt,canonical}. Worker export runSearchWorker({store,search,signal,now}) returns structured counts/status; no exception may skip RSS collection. Store methods may be designed here and must be documented in report for frontend; external API contract is fixed.

- [ ] Write focused failing tests before implementation:
```js
assert.equal(canonicalTopic('  AWS   Lambda  ').canonical,
             canonicalTopic('aws lambda').canonical);
assert.throws(()=>canonicalTopic('person@example.com'),/invalid_input/);
assert.equal((await apiCall('topics_save',{prompt:'AWS Lambda',receiving:true,expected_revision:0})).status,200);
assert.equal((await apiCall('topics_save',{prompt:'Python',receiving:true,expected_revision:0})).status,409);
```
Use actual handler and seeded DB, not a mock that implements the missing behavior. Existing test helper API naming is illustrative: define apiCall as real Request -> createTechFeedHandler path in test, not production.

- [ ] Create new migration with discovered CLI `supabase migration new tech_feed_web_search`. Extend preferences and create private/shared topic+mapping+budget tables with server-only write grants and owner RLS. Use atomic transactions and row locks for topic and provider lease/quota. Add owner-safe state, configure, list/access, saved/todo and summary eligibility integration. Query matching/filtering must precede LIMIT20; cursor keyed timestamp+UUID. Preserve existing identifiers and old data.
- [ ] Implement canonical input and fixed-provider adapter. POST https://api.tavily.com/search uses exact free request settings in spec, redirect:error, bounded body<=1MiB, timeout15s. GET https://api.tavily.com/usage must validate strict free account constraints; no user-configurable endpoints. Missing key => not_configured/no request. Domain/string URL normalization uses existing safe helpers; never fetch returned pages. Parse title/content/date defensively and mark snippet provenance.
- [ ] Implement shared topic jobs, provider mutex and atomic monthly reserve; one request even concurrent duplicate worker, preserve cached success on failure. Expired/failed requests use backoff and cannot spend above cap. Never refund ambiguous attempted requests. Account usage check before POST, no API configuration for billing.
- [ ] Run RSS worker independently and catch search errors locally. Ensure global false remains honest paused state while owner config endpoints work. Add self_service mode from TECH_FEED_ACCESS_MODE, defaultpilot for safe existing deployment; configured mode self_service uses DB recipients. Receiving users auto-subscribe only approved recommended source rows not previously manually chosen.
- [ ] Reuse free AI client for eligible search snippets; preserve source origin so existing RSS content isn't overwritten by weaker search snippets. Invalid/short evidence remains description. Search request URL always server-derived, not AI-generated.
- [ ] Add real PGlite/RLS tests for cross-owner isolation, visibility of search articles, duplicate subscriptions, save/todo after pause, expected_revision conflict, last-credit race/lease,900/901, failure count/month rollover. Add adapter tests for /usage unknown/missing/paid/paygo/429, forced basic payload, timeout/malformed/private URLs. Worker test asserts real combined pipeline still processes RSS when search throws or quota exhausted.
- [ ] Run `node --test supabase/functions/_shared/tech-feed*.test.mjs`, `npm.cmd run test:edge`, then `npm.cmd test` once. If new Deno check inputs needed ask controller to add package.json. Record RED/GREEN command/output in report.
- [ ] Self-review, commit only owned files, report actual interfaces, migration filename, tests and operational prerequisites. No remote writes.

## Task 2: Website self-service interest feed
**Ownership:** apps/web/src/TechFeedSection.tsx, techFeedTypes.ts, techFeed.mjs/d.mts, techFeed.css, new FeedInterestSettings.tsx, corresponding apps/web/test/*tech-feed* tests, scripts/serve-tech-feed-fixture.mjs only. Do not edit backend, package.json, memory-bank or other UI modules.
**Inputs:** Task1 external API from spec. Read Task1 report's final state type before implementation.
**Output:** User can configure/start/pause interest feed without entering API keys or site accounts. Missing provider key/quota/service pause are human-readable status; RSS state described honestly.

- [ ] Add tests RED for settings validation/status copy and state transitions using real helper exports and React rendering where existing tests support it. Browser fixture must exercise real React controls, not a screenshot-only static duplicate.
```js
assert.equal(searchStatusLabel({state:'quota_exhausted'}),'웹 검색 무료 한도를 모두 사용했어요');
assert.notEqual(searchStatusLabel({state:'not_configured'}),searchStatusLabel({state:'waiting'}));
```
Wording tests alone are insufficient: also assert state/handler requests and matching response handling.

- [ ] Implement interest component with labelled textarea maxlength300, examples, primary 소식 받아보기/관심 내용 변경, and pause/resume. Explicit notice: entered public technology interests sent to search service; don't enter personal/confidential info. Query submission saves receiving=true, expected_revision from current state. Do not require registration with provider.
- [ ] Keep input usable while service disabled; state after save explains collection unavailable honestly. 409 reloads latest preferences without silently replacing typed unsaved text, offers retry. Disable duplicate actions, cancel/ignore old-account responses.
- [ ] Move existing source controls under 고급 설정: 수집 출처. Preserve filters/latest/saved/manual more, no automatic list shuffle. Topic update deliberately resets paging; resume can show cached results.
- [ ] Card displays web-search origin/search-result intro vs actual AI summary accurately, original URL and source host; missing published date labelled발견. Render text, never rawHTML.
- [ ] Light forest style with390px no horizontal overflow, keyboard focus, labels and status live region.
- [ ] Run focused Node frontend tests, TypeScript/web build. Verify real fixture at PC/390px: enter, save, pause/resume,429-quota state, not_configured, saved articles, stale revision/retry, account switch.
- [ ] Self-review and commit only owned files. Report test/browser evidence and exact omissions, no remote writes.

## Task 3: Integration, documentation, release verification (controller)
**Ownership:** memory-bank, docs/tech-feed, README three languages, package.json only if needed for new Edge tests. Coordinate fixes through original task implementers/review.
**Inputs:** Task1 and2 reviewed commits. Existing deployment pipeline/production Supabase IDs in memory-bank.
- [ ] Final review entire code range, resolve Critical/Important findings through a single scoped fix task.
- [ ] Run full npm test, test:edge, build, mobile:check, docs:check, git diff --check. Verify documentation accurately distinguishes implemented from operational.
- [ ] Update PRD/design/implementation-plan/progress/trouble-shooting and README sections. Original career archive remains unchanged.
- [ ] Inspect project/migration/backup/secrets names through MCP/CLI. Do not print values. Apply additive migration/functions in approved scope, keep auth checks. If auth change or missing credential requires user action, stop that operational step and continue unaffected verification.
- [ ] Configure app search only after dedicated TAVILY_API_KEY freeaccount/paygo0 verification. Without key, verify no outgoing call and display not_configured. Do not buy a plan, enablebilling, invent articles or borrow another project's key.
- [ ] Push reviewed code to main and wait GitHubActions success + Vercel READY + HTTP200. Test authenticated state and interest save if a user session is available; distinguish synthetic fixture from actual login.
- [ ] Only activate collector after source permission/secret/runtime checks. Verify live articles and two scheduler executions when authorized/configured; otherwise report concrete remaining credential/auth constraint, not completion of live collection.
- [ ] Release claims; final report concise implementation, verification, deployment and remaining activation prerequisites.

## Implementation rulings
- Tavily selected as the documented provider from the preceding discussion; no alternate paid provider.
- Same topic sharing means canonical normalization-equivalent query, not speculative semantic clustering. This avoids leaking unrelated intent or producing wrong cache matches.
- End users opt in from website; operator secrets remain unavoidable app infrastructure, never requested per end user.
