# Daily briefing verification

## Scope and status

2026-09-15. Local implementation and independent reviews passed; DB and Edge are deployed, and web production rollout is verified below. The [design](daily-briefing-design.md) and [implementation plan](daily-briefing-implementation.md) define the feature. Attendance, recovery, authentication, study sessions, paid-routing policy and existing data are unchanged.

## Verified before final integration

- Pure classification/Markdown tests: 19/19. Preserves valid AI provenance, conservative unknowns, evidence-only tags, code literals and bounded AST tails. Four scoped review rounds fixed tail loss and preview/code-wrapper edge cases.
- Parent feed/core server regression: 194/194. Database fixtures cover full-page scope, owner isolation, saved filters, duplicate origins, Japan midnight, a 25-hour DST day, lease races, quota/cache behavior, actual excerpt-source permissions and uncited sample revocation.
- UI implementation baseline: 387 web tests and TypeScript/Vite build passed. Independent review identified two effect-lifetime gaps: same-scope refresh failures lost statistics, and same-day reactivation did not revalidate. Both are fixed and re-reviewed in the final section.
- Parent Edge check: all configured entrypoints typecheck, 10 tests passed. Existing Node punycode deprecation warning remains; no new failing check.
- Parent mobile compatibility and native TypeScript checks passed. README asset checker verified 24 references across three languages.

## Browser method and evidence

An isolated local fixture renders the actual TechFeed React components with synthetic API data. It never connects to a production account or real AI provider. It contains 32 articles, a Rust topic only beyond the first 20, two owners, saved/latest views, citation/cache counters, delayed responses and injectable failures.

390px and 1440px checks passed for clean previews, structured headings/lists/code, inert HTML, private-prompt suppression, no horizontal overflow, collapsed complete-scope facets, topic/source intersection, saved parity, pagination reset and zero automatic AI calls. Generation checks passed for explicit-only calls, separate 24/32 sample labels, server-provided source links, cached API revalidation without another provider call, collection stale state, explicit regeneration, failure/retry and late prior-owner response rejection. Screenshots were visually inspected; they are local test artifacts, not production screenshots.

The independent reviewer confirmed the two revalidation gaps using these browser reproductions. Tests of helper functions alone did not cover effect lifetimes; mounted-component event/revision regression tests were added and passed.

## Scale and privacy checks

PGlite synthetic saved-history probe (not a production benchmark):

| Articles | List SQL | Facet SQL + JS | Candidate JSON |
| --- | --- | --- | --- |
| 1,000 | 11ms | 47ms + 28ms | 1.12MB |
| 5,000 | 38ms | 197ms + 120ms | 5.61MB |

At 5,000 historical rows the daily subset of 55 was read in 19ms. Facet candidate transfer remains linear in visible history; these measurements do not establish arbitrarily large-history or network performance. Read-only production preflight found 63 articles, 50 collected in the preceding 24 hours, no dependency on the old list RPC signature, and existing list/cleanup grants limited to postgres/service_role.

Cache content must be returned by the access-revalidating API, not direct table SELECT. The database grants owner-only harmless metadata access and keeps content/input/lease columns server-only. All sampled IDs, including uncited ones, are checked before cached results are served.

## Implementation clarification

Same-day window/tab reactivation also performs a bounded read-only refresh, with focus/visibility events coalesced and no AI generation or collection. The original design described date-change reactivation; the implementation task required broader refresh. The broader behavior handles articles collected in another browser. Its cost is one extra read per reactivation, not an AI call. Same-account/day errors preserve observed statistics but hide unvalidated insights; account/date changes clear prior scope.

## Final local integration — 2026-09-15

- Both UI findings fixed with real mounted Chromium tests: RED three failures/one pass, then four passes. Same-day focus and visibility coalesce to one read; active generation completes before one queued read. Same-scope refresh errors keep observed statistics while hiding unvalidated insights.
- Parent reran `npm.cmd test` with the optional browser module/executable explicitly configured: **685 passed, 0 failed, 0 skipped**. This includes all four mounted lifecycle cases. Default CI has no browser runtime and clearly skips those four optional cases; they must be run explicitly for lifecycle changes.
- Parent fresh `npm.cmd run build` succeeded (1713 modules, TechFeed chunk44.49kB/16.16kB gzip). `npm.cmd run test:edge` passed all entrypoint checks and10tests; mobile compatibility/types and README24asset references passed.
- Both parent real-browser scenario groups reran successfully after fixes, including1200-character unbroken SQL code at390px. Separate reactivation/error probe: three events→one read,32→33articles, later read failure retains33, AIcalls0. Cached generation uses API revalidation without an additional provider call.
- Independent scoped re-review and final whole-change review approved the implementation with no Critical/Important findings.

## Remaining gates

- No remaining release blocker; production verification is recorded below.
- Real authenticated-owner/provider generation only if a genuine owner session is available. Synthetic results must not be represented as that live verification.
- Minor deferred server item: classification RPCs rely on the existing 10-second fetch limit rather than forwarding worker cancellation; version/content leases still protect completion.

## Production DB and Edge — 2026-09-15

- Migration20260914164719 applied by Supabase MCP. Local untracked migration filename aligned to MCP's assigned version; SQL SHA256 stayed5AE41C98F61C2A09824B8D100D8BB97A5D4D11EA2BA9919D5654CDFA4D1994E3. DB regression14/14 passed after rename.
- tech-feed v20 and tech-feed-worker v22 ACTIVE, verify_jwt true. No other functions, cron or auth settings changed. Unauthenticated briefing POST returns401.
- RLS enabled; authenticated cache result SELECT denied, owner-only harmless metadata allowed, anon SELECT denied. No public/anon/authenticated execute on service feed RPCs. Single7-argument list signature retains legacy5-argument calls via defaults.
- Live read-only outer EXPLAIN ANALYZE: legacy list11.915ms, saved facet candidates4.358ms, daily snapshot cold836.367ms. These are observed function execution times, not an assertion about every nested query plan or unlimited scale.
- All65 current articles backfilled to rules_version1: deep_dive7/practice15/news1/unknown42. Unknowns remain conservative and their card badge is hidden. Existing scheduled runs completed; this does not claim AI generation.
- Security advisor finding counts unchanged from preflight. Actual authenticated-owner/provider generation has not been performed.

## Production web — verified 2026-09-15

- Feature commit6ea0d95182dcf50954aa5dc076f0c944376bac97 pushed to main; GitHub Actions34871802491 completed successfully.
- Vercel deployment dpl_2Gpsv3NdJ7a2tZFCABKMM8RPnBHW READY with matching commit and production alias. https://study-room-attendance.vercel.app returnsHTTP200.
- Live index-WOrXYlXe.js references TechFeedSection-BFR8zyll.js; both fetched successfully and the feed chunk includes the daily panel, briefing_generate and source_key.
- Implementation, scoped/final review, migration, server release, local/browser/CI checks and web rollout gates are complete. No genuine authenticated-owner AI generation was performed; this remains a clearly bounded live-user verification limitation.
- Preexisting Supabase outage notes remain unstaged; no authentication, attendance, recovery, session, cron or paid fallback policy changes were bundled.
