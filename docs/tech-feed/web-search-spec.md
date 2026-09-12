# 관심 내용 + 공개 웹 검색 기술 피드
Date: 2026-09-12. Status: implementation authorized by user's latest request.
Supersedes the unresolved search boundary in topic-feed-design.md and the old PRD's General web search Non-goal. Other unrelated product behavior is unchanged.

## Binding requirements
1. Website users enter a public technology-interest description and click 소식 받아보기. No user API key, SNS login or operator per-user allowlisting in self-service mode.
2. Search public indexed web via app-owned Tavily basic search in addition to RSS/Atom/HN. This is not exhaustive crawling or access to private/paywalled text.
3. Normalize the full query (Unicode NFKC, case, whitespace); identical canonical queries share one leased cache/job independent of subscriber count. No claim arbitrary paraphrases are semantically identical.
4. One saved active query per user, 3..300 characters, saved server-side. A user's original query and memberships are private. Reject URLs, emails, credential-shaped tokens, control characters; display privacy notice that the query is sent to a search provider. No user ID/email is sent with queries.
5. User may edit or pause. Pausing preserves saved articles and todo links. Other subscribers may keep a shared query fresh.
6. Scheduled query cache TTL remains one hour. User-approved amendment (2026-09-13): explicit `새 글 확인` calls authenticated `refresh`, not just cached list reload. A manual request may bypass hourly freshness after a durable five-minute account AND topic/source cooldown. Leases, failure backoff, free-only validation and monthly cap remain binding. Ordinary page loads never trigger provider calls. At most one topic and four eligible subscribed RSS/API sources are checked per manual request; a click does not promise new articles or all sources.
7. Free-only search: no billing/subscription/paid fallback APIs. Tavily request fixed basic, auto_parameters false, include_answer false, include_raw_content false, include_images false, include_usage true, max_results 5, topic general, time_range week.
8. GET /usage validates free account before a search: current_plan Free/Researcher (case-insensitive), finite nonnegative usage/limits, positive plan_limit<=1000, positive key.limit<=1000, paygo_limit=0 and paygo_usage=0, room in both plan/key. Missing/unknown/paid account or unreachable usage endpoint fails closed.
9. Local atomic monthly attempt budget defaults900, clamped0..900. Reserve before actual POST, failed/ambiguous calls count, no automatic refund/retry or new key/provider on failure. One shared provider execution lease prevents race between account usage check and search. Dedicated app key with provider pay-as-you-go disabled is an operational requirement; app code cannot prevent an unrelated client spending the same account.
10. Search key missing, quota exhausted, provider unavailable, service paused are distinct states. Only web search pauses: existing eligible RSS/API collection, saved articles, attendance and timer continue. Never report RSS is running if globally disabled or no permitted sources.
11. AI only receives actual source excerpts/search-result snippets, never invented URLs. Existing free-only actual6 calls/user/day shared quota including failures; max3 articles/call. Insufficient/failed AI retains snippet+link. Search snippets are labelled 搜索/search-result introductions, not verified full original article text. No free call to synthesize missing evidence.
12. Source-specific RSS approvals remain required. Search results' minimal snippets are stored separately by provenance; do not silently mark a publisher RSS approved because search returned a page. No unbounded original-page extraction/crawl.
13. Stable chronological pagination20 with owner-visible shared search results union RSS results and URL dedup; no reordering an already-reading list. Null/missing publication date is shown as discovery date. Topic changes reset cursor. Saved view ignores current topic filters.
14. Existing new XML import graph regression, DNS/IP-pinned TLS/XXE boundaries, source lease/GUID/URL dedup, atomic todo link, timezone auth remain intact.
15. Web self-service configuration is separate from runtime availability. Authenticated non-anonymous users can save interests even if global collection is disabled. Do not claim actual search activation until real provider and browser/worker checks succeed.
16. Additive DB migrations only via Supabase CLI; owner RLS and server-only write RPCs; no existing user data deletion. JWT settings are not silently changed.
17. Desktop/390px light forest theme. Primary interest box + receive/update/pause; source selection folded into advanced settings; no AI/API setup form for end users.
18. Deployment follows DB -> functions -> web -> collector activation after operational checks. If provider credential is absent, ship verified code and explicitly report web search not active rather than fake results.

## Data and API contract
POST tech-feed remains authenticated. State and topics configuration do not depend on collection being enabled.
- refresh {expected_revision:number} => state started internally; public result ready/partial/running/cooldown/paused/not_configured/no_sources/unavailable, optional rss/search outcomes and retry_after seconds. Account identity comes only from authentication. Current preference revision is revalidated under the owner lock when claiming work.
- refresh_status {} => running/idle plus current search status. No provider call. Client polls shared work at two-second intervals with a bounded deadline; idle is not treated as proof of successful collection. Details: manual-refresh-verification.md.
- topics_save {prompt:string,receiving:boolean,expected_revision:number} => {preferences,search_status}
- receiving {receiving:boolean,expected_revision:number} => same; cannot resume empty query
- state => existing state plus preferences:{prompt,receiving,revision}, search_status:{state:'not_configured'|'paused'|'waiting'|'ready'|'quota_exhausted'|'unavailable',last_success_at:string|null}, service_available:boolean
- list response keeps items,next_cursor. Article adds origin:'rss'|'web_search', matched_topics:string[], excerpt_provenance:'source_excerpt'|'search_snippet'. Existing RSS and saved old rows retain sensible defaults.
- expected_revision mismatch409; authenticated token is sole owner source. Source/subscription state is never inferred from another user.
- One provider topic table with canonical query unique + run_after/lease/status; owner topic-membership table; topic-article map; provider monthly budget/reservation state. All operational/query internals server-only except owner-safe state.
- Preferences add prompt/receiving/revision, retain existing interests. Existing subscriptions remain manual and are not reenrolled if explicitly disabled. Starting interest feed auto-subscribes approved recommended sources only where no prior manual choice exists.
- Existing list/access/RLS/AI eligibility paths must recognize owner-visible search articles, preserve save/todo access after pause and avoid disclosing another user's private topic.
- In self_service mode active recipients come from DB opt-in, never unbounded user-ID env lists. Preserve pilot mode compatibility and kill switch.

## Acceptance cases
- Two users save normalization-equivalent prompt: same topic, scheduled hourly cache, manual five-minute shared cooldown, independent private settings. Busy RSS does not suppress independent search; unrelated provider contention waits without consuming quota; cancellation finalizes the request.
- Two simultaneous reservations with one credit left: one search at most; duplicate worker cannot double claim; month rollover cannot bypass provider remaining quota.
- Missing API key, /usage error, unknown/paid plan, paygo enabled,429/432/433/timeout/malformed JSON: search stops safely, RSS worker still called.
- Local900 attempts exhausted: no request901. Failed POST consumes reservation. Cache hits/validation rejection do not consume credit.
- API payload cannot opt into advanced search, extraction, paid provider, answer generation, arbitrary endpoint.
- Search malicious URL/HTML/future dates/duplicate canonical URL handled; empty results produce genuine empty-state.
- Summaries grounded to snippet; insufficient snippet no AI call; six shared calls boundary/failed calls tested; pause disqualifies quota sponsor.
- Cross-owner reads/writes fail; topic revision stale result rejected; account changes drop pending response.
- Input/start/pause/restart/change/filter/page/save/todo on PC and390px; original timer/attendance/forest unaffected.
- Actual live checks only when app-owned key and account free policy confirmed; no credential printed or committed.

## Provider references verified for implementation
- https://docs.tavily.com/documentation/api-reference/endpoint/search
- https://docs.tavily.com/documentation/api-reference/endpoint/usage
- https://docs.tavily.com/documentation/api-credits
- https://www.tavily.com/terms
Sources justify API parameters/usage detection, not a claim that every publisher permits full-text reuse.
