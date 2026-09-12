# PRD: 시간별 기술 피드

User approved 2026-09-12. Replaces active career-driven StudyRoom 2.0 with a simple technology learning feed. Implementation only; no commits, push, remote migrations or deployments without a separate request.

## Problem / Goals
Discover current technology without complex career setup: discover → Korean summary → original source → explicit study todo. Desktop and mobile web; keep Today as default.

## User scenarios and requirements
- Hourly server collection of subscribed public RSS/Atom and Hacker News API; no three-items-per-day cap.
- Eight recommended sources: GeekNews, Hacker News, Hugging Face, Simon Willison, AWS What's New, GitHub Changelog, Toss, Woowahan.
- Latest/saved views, interest/source filters, collapsible subscriptions; 20-item cursor pages, no automatic reorder while reading.
- Interests: ai, frontend, backend, cloud, tools. Categories: news, practice, deep_dive; null means unclassified.
- Show source, published time, excerpt/summary provenance, last successful collection and partial failure. No external notifications.
- Preview public HTTPS RSS/Atom before subscribing; max 10 custom sources per user; no authenticated/private/token-bearing feed URLs.
- Persist subscriptions, interests, saves and todo links server-side with owner isolation across devices.
- Open existing todo editor with title/date/time; explicit save creates todo and original-article link atomically/idempotently.

## Collection / AI / safety
- Shared collection per normalized source; seven-day/50-item initial import; later incremental collection, no re-dating old posts.
- Source GUID and normalized original URL deduplication, preserving multiple source attributions.
- Conditional GET, bounded responses/time/concurrency, leased jobs, failure backoff, 90-day unreferenced article retention.
- Public excerpts only; no arbitrary original-page crawling or paywall bypass. Insufficient text stays unsummarized.
- Free-only existing OpenRouter client, six actual calls/user/day shared with restart coaching including failed calls; up to three articles per call, cached results. No paid fallback.
- Summary: what technology / key change / application. Validate output shape; URLs always server-owned. Article text is untrusted data, never instructions.
- Block SSRF (including DNS/redirects), XXE, oversized bodies and unsafe HTML. RLS isolates subscriptions/saves/custom feeds. Server-only writes for collection and AI.
- Source permission review is distinct from RSS availability. Unknown permission remains disabled; no claim all eight are launch-ready.

## Career archive / compatibility
Archive dedicated career UI/server/tests with restore instructions; keep DB/migration history and shared free AI/quota. Tombstone old entrypoints to prevent stale clients scheduling work. Disable only career cron at separately approved rollout. Extract timezone saving from career API. Preserve timer, attendance, todos, reports, forest, restart coaching.

## Release and validation
Owner-only pilot feature flag; additive migration → Edge handlers → web → hourly Cron activation, only on separate authorization. Kill switch stops feed only. Verify parser/adapters, RLS/SSRF/idempotency/leases, AI fallbacks and 390px browser interactions; existing test/build/Edge/mobile/docs checks. Production cron and actual AI quality are separate from synthetic/local verification.

## Non-goals
General web search, SNS OAuth, private content, video summarization, Expo feed UI, external notifications, paid inference.
