# Immediate refresh verification — 2026-09-13

## Implemented

- Explicit completed refreshes no longer wait five minutes; active work still coalesces. Scheduled TTL stays one hour, failure backoff and free-only monthly900 cap remain.
- Compound interests rotate a focused query with one search POST/reservation per request. Shared cursor advances atomically with budget reservation, including failed attempts; saved canonical query and private memberships are unchanged.
- UI distinguishes accepted0 search results, deferred collection, quota and failures. Existing successful URLs are deduplicated, not counted as guaranteed new articles.
- Manual error logging uses the existing supported worker_failed code instead of invalid manual_refresh_failed.

## Local evidence

- TDD: four SQL and five worker/UI failures reproduced first; corrected behavior15/15 pass. Full Node570/570; Edge8/8 and all10 entrypoint checks; web build; mobile compatibility/typecheck; README24 references pass.
- Independent read-only reviewer verified immediate requests, cursor/quota/lease/revision/ACL behavior; no important findings, own15/15 tests passed.
- Local SQL numeric/WHERE whitespace error found before deployment and corrected. Existing Deno punycode deprecation warning remains nonblocking.

## Production evidence

- MCP migration applied as20260913122656_tech_feed_immediate_refresh; local CLI-created filename aligned to remote version without SQL changes.
- tech-feed v12, tech-feed-worker v13 ACTIVE, verify_jwt=true. Modified functions exposed to anon/authenticated:0. Both attendance and feed Cron remain active.
- Pre-change live observation: attempts4, articles0; last manual12:10:40UTC/search12:10:43UTC. This is not evidence of post-change delivery.
- Existing security advisor warnings remain (legacy functions, pg_net public, password protection); server-only RLS/no-policy INFO is intentional. No new client privileges were granted. [Advisor reference](https://supabase.com/docs/guides/database/database-linter).
- A proposed secret-protected temporary verification endpoint was rejected by the approval system because it would add an operational endpoint and trigger live collection. It was not created or called; no bypass attempted. Function listing confirms no probe.
- Existing browser verification was attempted via CUA but runtime failed before inventory with `apply deny-read ACLs`. No browser action or login change occurred.
- Actual post-change provider results/browser consecutive-click verification remain pending. Ask the user to click the existing production button after web deployment; inspect normal run records without inventing successful delivery.
- Web commit/CI/deployment verification is recorded in the follow-up section after completion.

## Remaining boundary

No click can guarantee that the provider has a new article. Pending RSS permissions and absent AI configuration are not silently enabled. Free exhaustion pauses web search without paid fallback; eligible RSS remains independent.
