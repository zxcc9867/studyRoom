# Technology feed backend implementation report

2026-09-12. Local implementation only. No commit, push, deployment, remote SQL, actual feed collection, or live AI request was performed.

## Delivered

- Authenticated `tech-feed` POST API implements the task-1 wire contract: state/list/subscribe/interests/preview/add_source/save/add_todo/timezone. All errors use safe Korean text. Browser-supplied permission fields are discarded.
- `timezone` independently validates an IANA zone and updates only the owned `profiles.time_zone`; it does not load/mutate career state and works when the feed is disabled.
- `add_todo` accepts the controller-approved optional `goal_id`, verifies goal ownership, writes an ordinary `study_todos` row and original article link atomically, and returns the original todo ID on repetition. Date-only and overnight windows work. Existing overlap-allowed behavior is preserved; equal or half-null times remain invalid. Deleting a todo cascades its link, permitting a later explicit recreation.
- Service-owned shared sources/articles/attributions; owner-isolated subscriptions/preferences/bookmarks/todo links; no browser write grants. All exposed tables have RLS, all user-ID-accepting feed RPCs are service-role-only `SECURITY INVOKER` with empty search path. Private preview counters and hash-only dedup tombstones have no browser reads. Sources use explicit safe-column SELECT grants only (`id,name,url,kind,recommended,permission_status,last_success_at,last_error`); shared custom-source registration cannot expose another user's `created_by`, review notes, lease data, AI approval flag or HN checkpoint internals.
- Stable 20-item cursor pages use `coalesce(published_at,discovered_at) DESC, id DESC` for latest/saved, matching the expression index and opaque cursor key. This orders same-transaction first imports by publication time; undated entries use discovery time. Duplicate imports preserve both original timestamps. Source/interest filtering, source attribution and last success/partial failure are included. Saves survive unsubscription and cleanup.
- Pinned `fast-xml-parser@5.11.1` for real RSS/Atom parsing; CDATA, namespaces, Atom alternate links, relative URLs, entities. Rejects malformed XML, DOCTYPE/ENTITY, oversized responses; strips markup/scripts from display text. It does not crawl article pages.
- Pinned-IP TLS transport validates all DNS answers, connects to a public literal address, verifies the original hostname/certificate and actual peer before handing the socket to HTTP, and revalidates every redirect. No ordinary-fetch fallback exists. Unsupported TLS behavior fails closed. Rejects common credential/token URL forms, private/special IPv4/IPv6 ranges, compressed responses and oversized bodies.
- A minute-tick dispatcher takes at most two leased due sources per invocation (SQL hard cap four). Each healthy source remains due only one hour after success; failures retain one-to-24-hour exponential backoff. The SQL queue selects the oldest `run_after` first, with ID tie-breaker; within-pair UPDATE RETURNING order is immaterial. Eight initially due healthy sources drain in four ticks, and an owner pilot with 18 sources drains in at most nine ticks under healthy non-overlapping conditions. This does NOT fetch each source every minute.
- HN uses only the fixed official API adapter. Hourly list snapshots are bounded to 1000 available IDs, persisted before item I/O, and consumed in batches of 50 with four concurrent item requests. Pending snapshot tails continue on minute ticks; the next hourly list fetch is scheduled only after draining. Failures keep the staged snapshot through backoff. Story URLs are never fetched.
- Initial import is at most 50 dated items from the prior seven days. Undated initial items are intentionally excluded. The 50-item cap applies ONLY to initial import. Incremental RSS/Atom persists all available parser-accepted entries (at most 2000 within the 1 MiB response); it does not silently slice the feed at 50. Later imports preserve stored publication/discovery times. Ninety-day cleanup deletes at most 500 unreferenced articles; hash tombstones prevent old GUIDs/URLs from reappearing with a fresh discovery date. Tombstone hashes remain until their source is removed.
- Shared free AI client remains `coach-openrouter.mjs`; existing `coach_reserve_ai` is also used by restart coaching. Configured/nonpilot/denied cases do not call a provider. Up to three sufficiently long excerpts per call. Sponsorship selects a consenting subscribed pilot whose own local-day quota remains available, so an exhausted oldest subscriber cannot starve another eligible owner. `tech_feed_begin_summary_attempt` atomically reserves the existing shared call budget and increments only the claimed articles about to be attempted. Claiming alone costs no retry; no-config/quota/pre-call deferrals release the lease as pending with a 15-minute retry delay, not permanently failed. Actual provider failures use the three-attempt article bound and one-day retry delay. Korean summary fields are validated; no generated URLs or paid fallback. Failures remain unsummarized. `excerpt_source_id` binds AI eligibility to the exact source of the excerpt; another attribution cannot lend its AI permission.

- AI classification comes from the same bounded summary response: `news`, `practice` or `deep_dive` is validated separately from the unchanged three-field summary DTO. Missing/invalid category becomes null (unclassified); only a successfully validated, current-lease summary can persist it. No additional provider call or quota reservation is introduced. Domain, real SDK and real worker-to-SQL tests cover category propagation, all enum values and null fallback.
- Service-only `tech_feed_runs` durably records start/end/status and separate collection-success/failed plus summary-success/failed/deferred counters. `finally` finalizes normal, individual-source partial-failure and fatal runs with fixed safe error codes, never excerpts/secrets/raw exceptions. Cleanup marks abandoned runs after ten minutes and removes at most 500 run records older than 30 days per invocation.

## Files

- `supabase/functions/tech-feed/index.ts`
- `supabase/functions/tech-feed-worker/index.ts`
- `supabase/functions/_shared/tech-feed-{api,core,transport,worker-core}.mjs`
- `supabase/functions/_shared/tech-feed-store.ts`
- Associated `tech-feed*.test.mjs` and two `tech-feed*.test.ts` files
- `supabase/migrations/20260912104353_tech_feed.sql`
- `supabase/migrations/20260912081624_tech_feed_cron_disabled.sql`

No existing career entrypoint, package manifest/lockfile, frontend, or memory-bank file was edited by this worker. The controller added the exact XML parser dependency and owns shared documentation updates.

## Configuration and rollout gates

Required server environment:

- Existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `TECH_FEED_ENABLED=true` AND nonempty comma-separated `TECH_FEED_PILOT_USER_IDS`. Missing/false/empty denies all feed access. No browser feature flag is used. Pilot enrollment includes explicit summary processing consent at rollout.
- `TECH_FEED_WORKER_SECRET`: at least 32 characters; worker POST header `x-tech-feed-secret`. This is independent of attendance/career secrets.
- Existing `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` for AI. The existing client coerces paid model settings to `openrouter/free`, sends zero maximum prices and `data_collection=deny`. This worker uses 20-second AI timeout / 2048 max tokens.

Bounds: 16 KiB API JSON, five preview/add-source fetches per user per 15 minutes, 1 MiB uncompressed feed/API responses, 12-second DNS/TLS/body deadline, up to three redirects, worker 50-second work deadline, 90-second SQL leases, 10-second database request timeout. Outstanding database finalization may extend beyond the worker work deadline but cannot publish after its lease expires. RSS conditional validators are preserved on 304; cross-origin redirects do not inherit validators.

All eight recommended catalog sources are intentionally seeded `permission_status='pending'`, `summary_allowed=false`, with a review note. RSS availability is not reuse/AI permission. No source is claimed launch-ready. Custom source addition never approves collection or summarization. Scheduled worker and AI exclude pending/blocked sources.

After source-specific review and separately authorized rollout, an operator may update ONLY the reviewed source, for example (placeholder; not executed):

```sql
update public.tech_feed_sources
set permission_status = 'approved',
    summary_allowed = false,
    permission_note = 'Reviewer/date/evidence URL/scope: collection only'
where id = '<reviewed-source-uuid>';
```

Set `summary_allowed=true` only when that source's approved scope includes the AI processing. Revoke with `permission_status='blocked', summary_allowed=false`; lease finalization rechecks permission. Do not bulk-approve all catalog rows or treat preview success as authorization.

Deployment ordering remains schema -> handlers -> web -> scheduler. Apply `20260912104353_tech_feed.sql` before handlers/web. Apply `20260912081624_tech_feed_cron_disabled.sql` SEPARATELY LAST after handler readiness checks; do not indiscriminately apply both files before handler verification. The scheduler migration uses one atomic DO statement and `cron.alter_job` to:

1. Disable only `study-room-coach-worker` and `study-room-coach-notifications`.
2. Register `study-room-tech-feed-hourly` at `* * * * *` (minute dispatcher; the stable job identifier describes the per-source hourly cadence, not its tick interval).
3. Immediately set that new job inactive before commit.

It leaves attendance and all other jobs untouched. Provision Vault `project_url` and `tech_feed_worker_secret` outside migration SQL, using a secret value matching `TECH_FEED_WORKER_SECRET`; never paste values into SQL history or docs. After explicit rollout authorization and staging checks, activation is:

```sql
select cron.alter_job(jobid, active := true)
from cron.job where jobname = 'study-room-tech-feed-hourly';
```

Kill switch: `TECH_FEED_ENABLED=false`, and optionally the same `cron.alter_job` with `active := false` for only the feed job. Existing data and shared quota remain intact. Function deployment must allow requests to reach the in-handler authorization checks (configure the Edge gateway deliberately; no configuration was changed locally or remotely here).

## Verification evidence

- CLI discovery: `npx.cmd --yes supabase --help`, `migration --help`, `migration new --help`; both local migration placeholders were generated by `supabase migration new`, not invented filenames.
- TDD reds observed for domain/parser, API, worker, transport, initial schema and scheduler. Follow-up red regressions caught rediscovery after cleanup, missing preview budget, noncanonical IPv6 special ranges, insufficient excerpt upgrade, and direct Cron table writes.
- `node --test supabase/functions/_shared/tech-feed*.test.mjs`: **58 passed, 0 failed**.
- `npx.cmd --yes deno@2.9.6 check --no-config --node-modules-dir=none supabase/functions/tech-feed/index.ts supabase/functions/tech-feed-worker/index.ts`: **passed**.
- `npx.cmd --yes deno@2.9.6 test --no-config --node-modules-dir=none --allow-env supabase/functions/_shared/tech-feed-store.test.ts supabase/functions/_shared/tech-feed-transport-runtime.test.ts`: **6 passed, 0 failed**. No `--allow-net`; all SDK/provider transport responses are synthetic. The actual Deno HTTPS implementation was tested to honor the custom connection gate before DNS/HTTP.
- Real PGlite executes the full new schema and tests positive/negative owner RLS, grants, atomic todo linking, permission-preserving add source, duplicate GUID/URL, source/summarization leases, safe backoff, cleanup/tombstones, preview quota, pagination, source attribution and excerpt-source permission. A separate test executes the existing coach migration: two authenticated plus four service-sponsored calls exhaust the SAME user budget, seventh is denied, another owner remains eligible.
- Actual existing free client against synthetic 429 provider responses performs exactly six calls after reservations; a denied seventh reservation cannot call the provider or use a paid model.
- Additional real worker + SQL tests drain eight due sources in four dispatches and 18 in nine within the same hour, confirm oldest-due batch fairness and no early refetch, ingest 75 incremental RSS entries, drain 120 HN IDs over three persisted checkpoints, and preserve an 80-ID HN snapshot across item failure/backoff without relisting. Separate regressions cover quota-aware alternate ownership, four uncharged deferred attempts, actual-call retry accounting, collection independence from AI quota, private durable run counters, partial/fatal sanitization and run retention.
- Scheduler SQL runs against a local PostgreSQL registry adapter that rejects direct `cron.job.active` updates and exposes `cron.alter_job`. This tests migration intent/effects, not a running pg_cron/pg_net installation.
- `git diff --check`: passed. Existing controller-touched files emitted Windows LF/CRLF notices; no whitespace error. Deno's pinned SDK emitted a `punycode` deprecation warning; tests passed.

## Failures resolved / controller memory-bank notes

- Windows sandbox `apply deny-read ACLs` prevented reading/updating existing files through some tools. New-file `apply_patch` worked; existing-file updates used exact reviewed `git apply` patches with escalation. ACLs were not changed.
- A whole-file SQL replacement exceeded Windows command-line length; switched to compact exact hunks. One JavaScript replacement-string expansion reduced SQL `$$` delimiters; real PGlite rejected it, and literal replacements restored valid SQL. Current full SQL tests pass.
- Deno inferred the handler could return `undefined`; explicit terminal throw fixed the type error. A test's optional HTTPS callback typing was also corrected.
- Cleanup originally allowed old items to acquire fresh discovery times. Hash-only tombstones now preserve dedup after body retention cleanup.
- Alternate IPv6 zero spellings bypassed an early special-range regex; numeric hextet checks now reject them.
- Multi-source public excerpts now retain exact source provenance; improved text cannot borrow another source's AI permission.
- Controller review requested the official `cron.alter_job` API instead of direct Cron row mutation; a rejecting SQL trigger regression verified the corrected migration.
- Follow-up review confirmed an hourly invocation with a two-source bound would check eight sources only every four hours. The disabled scheduler now uses minute dispatch while preserving source-hourly `run_after`, backoff and leases; oldest-due selection prevents new sources from continually bypassing old due work.
- Re-review found that table-wide source SELECT exposed `created_by` to a second subscriber of the same custom URL. Explicit safe-column grants now deny private/internal columns and SELECT-star; a real two-owner PGlite regression verifies the denial while safe catalog reads still work.
- Follow-up review found shared-owner AI quota starvation and no-call deferrals consuming article attempts. Quota-aware sponsorship, atomic actual-attempt reservation and explicit deferred results corrected those paths without changing the shared free-only budget.
- Whole review reproduced a valid-JSON `{items:[null]}` response throwing outside the parse catch. Matching now rejects null, primitive and array entries before reading IDs; absent valid matches finalize as normal failed summaries, while mixed arrays can retain a single valid matching item. Domain and real-worker regressions verify failure finalization, later owner groups, cleanup/run finalization and unchanged call counts.
- Whole review reproduced relative article links resolving against the original feed URL after redirects. The pinned transport now returns its validated final URL and feed parsing uses that base without mutating catalog identity. Synthetic real-transport-to-parser regressions cover 301/302, same-origin path changes and cross-origin redirects, retain two-hop TLS checks, and verify validators are stripped across origins. No external request was made.
- Final review reproduced UUID-only first-batch ordering from identical discovery timestamps. Latest/saved now consistently use publication-time-or-discovery-time plus ID for the index, sorting and cursor. A deterministic 26-row same-transaction PGlite regression covers mixed publication dates, undated fallback and two-page traversal; duplicate ingestion still preserves original publication/discovery timestamps.
- Final review found the category field had no producer. The existing summary prompt now asks for a separate strict category enum, and worker/store/SQL finalization propagates it only with successful summaries. The TDD red showed extra category fields invalidating the summary DTO and the SQL signature missing; both are now resolved without changing summary DTO shape or AI bounds.
- Incremental RSS/HN no longer inherits the initial 50-item cap: bounded RSS persists all available entries and HN uses durable snapshots/tails/high-water checkpoints. Service-only run history now provides the originally requested durable collection/summary execution evidence.

## Remaining release verification (not claimed complete)

- Actual source endpoints, permission/license review and representative RSS/HN content quality have not been checked by live collection. No blanket approval is supplied.
- Hosted Supabase Edge TLS/DNS compatibility, certificate failure behavior, actual pg_cron/pg_net/Vault, migration advisor output and remote RLS behavior require separately approved staging/deployment checks. Unsupported transport has no unsafe fallback; strict peer comparison may reject otherwise-public alternate IPv6 spellings.
- PGlite tests are transaction/rollback tests in one database connection, not a production concurrency load test. Locks/unique constraints/lease predicates implement concurrency safety, but concurrent PostgREST stress remains a staging gate.
- Live free-model Korean quality, latency/rate limits, daily quota interaction with real restart-coach traffic, large HN feeds and long-running pilot metrics remain unmeasured. HN cannot recover IDs that have already fallen outside the provider's finite `newstories` list before the hourly snapshot is taken; the implementation preserves every ID in its accepted snapshot, not unavailable provider history.
- The controller performs repository-wide web/mobile/browser/build checks and updates project memory-bank. This report provides the backend schema/security/rollout/troubleshooting facts for that update.
