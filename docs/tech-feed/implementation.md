# Technology feed implementation

Spec: memory-bank/prd-tech-feed.md. User approved 2026-09-12. No commit/push/deployment or remote DB mutations. Baseline 501 tests pass on codex/recovery-consistency. Existing isolated worktree reused; pre-existing audit documentation preserved.

## Global constraints
Hourly RSS/API, free-only six actual AI calls/user/day shared with existing restart coaching, max3 articles/call; no external notifications, default Today. Owner pilot, per-user RLS, custom feeds max10, page20, initial7days/50, unreferenced retention90days. Source permissions default unknown/disabled. Preserve all attendance/timer/report/forest behavior. No subprocess/subagents by implementer; no commits or remote writes.

## Task 1: Backend collection, API, SQL and source safety
Ownership: new supabase/functions/tech-feed*, new supabase/functions/_shared/tech-feed* modules/tests, new migration(s) only, docs/tech-feed/backend-report.md. Do NOT change main.tsx, package.json, existing career files or memory-bank (controller owns these). Claim assigned files with owner codex-tech-feed-backend-20260912.

Read spec first. Implement SQL schema, server API and hourly worker end-to-end using existing pinned Supabase imports and free AI client. Use Supabase CLI migration new (inspect CLI help first). Local migrations only; validate real SQL with PGlite per current DB test patterns. No remote execute or migrations. Pure helpers in .mjs so Node tests can exercise real code. RSS parser must be robust (dependency use coordinated with controller) and XXE disabled. SSRF must handle DNS rebinding; use a pinned validated public IP connection with TLS hostname verification if supported, otherwise fail closed for unsupported transport, never silently unsafe fetch. Source permission flags server-controlled; unknown sources cannot be fetched by scheduled worker or summarized. Preview only explicit user requests and bounded public feeds.

Contract (coordinate changes before implementing): authenticated POST tech-feed JSON action:
- state → {enabled:boolean,sources:Source[],interests:string[],last_success_at:string|null}. Source {id,name,url,kind:'rss'|'hn',recommended:boolean,subscribed:boolean,permission_status:'approved'|'pending'|'blocked',last_success_at:string|null,last_error:string|null}.
- list {view:'latest'|'saved',interest?:string,source_id?:string,cursor?:string} → {items:Article[],next_cursor:string|null}. Article {id,title,url,published_at:string|null,discovered_at:string,excerpt:string,summary:null|{technology:string,change:string,usage:string},summary_status:'pending'|'ready'|'insufficient'|'failed',category:null|'news'|'practice'|'deep_dive',interests:string[],sources:{id,name}[],saved:boolean,todo_id:string|null}.
- subscribe {source_id,subscribed:boolean} → {ok:true}; interests {interests:string[]} → {ok:true}.
- preview {url} → {url,name,items:{title,url}[]}; add_source {url} → {source:Source} (revalidate server-side; preview not authorization).
- save {article_id,saved:boolean} → {ok:true}.
- add_todo {article_id,title,local_date,start_time:null|string,end_time:null|string,goal_id?:null|string} → {todo_id:string}; title max180, validate optional goal ownership, re-use study_todos time/overlap behavior and transactionally store link keyed owner/article. Repeat returns original ID. Only explicit user action.
- timezone {time_zone:string} → {ok:true}; independent of feed feature flag, authenticated nonanonymous users, valid IANA zone; persist profiles.time_zone directly safely, no career state reads/mutations. Controller wires profile UI.
Feed feature flag via server TECH_FEED_ENABLED=true and TECH_FEED_PILOT_USER_IDS comma-separated IDs (empty denies); state disabled returns empty sources/interests, others403 except timezone. No flag in browser needed. API all errors {error:string}, safe localized message; never raw backend errors/secrets.

Use a separate minute-dispatch scheduler with hourly per-source eligibility but do not enable job by default: install disabled Cron entry after handler readiness, explicit enable at deployment. The same final scheduler migration retires only the two dedicated career jobs. Expose worker secret-auth guard. Use bounded leased source processing; one bad source must not break others. SQL storage shared articles + source mappings and private owner subscriptions/bookmarks/todo links. Saved rows outlive unsubscribes and cleanup; unavailable pending sources remain visible in catalog and cannot become authorized through custom add. AI summaries not eligible without permission; reuse coach_reserve_ai and free client (do not rename it). Per-user summary consent via enabling feed pilot is explicit at rollout, no live AI test calls.

TDD: failing tests first for real parsers, URL safety/normalization, conditional304, field mapping, insufficient summaries/invalidJSON/freequota failure, retries/leases, SQL RLS duplicate todo atomicity and owner isolation. Run focused Node and Deno checks; report exact commands/results, failures and limitations. Write report to docs/tech-feed/backend-report.md with concise final summary.

## Task 2: Frontend and career archiving (controller)
Implement TechFeed lazy view + typed API/client helpers; sidebar routing, source preview/settings, pagination/cancellation, save/todo editor integration. Preserve profile timezone via independent action. Archive career-only files and tombstone endpoints; keep shared quota/client/restart coaching. Local additive retirement migration disables old scheduling only when deployed. Update README/model/docs/test configuration carefully.

## Task 3: Verification and release documentation
Task-scoped backend review, UI SSR/browser fixtures, full suite/build/edge/mobile/docs, final whole-change independent review. Fix findings before report. No production execution; docs distinguish locally complete from unverified runtime cron, rights review, AI quality and deployment.
