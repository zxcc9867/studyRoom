# Tech-feed AI retry verification — 2026-10-10

## Scope and baseline
User authorized free-only OpenRouter 502 guidance/retry improvement and verification/deployment. Main baseline 2c68ecd07ba3399cade4071a74fcb89bcf947d78. Existing production web product 96a47086e99b98f8e6fb6e0c216fed07fece02c8; tech-feed v39 and worker v37. APK 0.2.4/code7 is unchanged.

## Implemented contract
- Fast first 502/503/504 may retry once after 500ms, only with enough of the 30s deadline; each provider attempt remains 20s.
- Other errors have no automatic retry. Retry-After, reason-specific guidance, persisted cooldown and explicit retry apply.
- Existing free client, zero-price policy, output2048 and shared budget15/day (worker12), actual-attempt40 remain. Each retry reserves; failed reservations refund once to the original date.
- Atomic service-only RPCs, input/source permission revalidation, account/timezone request cancellation and no generation on read remain.
- Configuration recovery requires a valid current config, expired cooldown and explicit status read.

## Completed verification
- Backend unit + real PGlite migration/RPC regressions: 44 passed.
- Edge type checks and configured Deno suite: 23 passed, 0 failed.
- Frontend actual Chromium fixtures verified cooldown, manual retry, scope changes and restored config; 390px screenshot uses synthetic articles and a mocked 502.
- Independent reviewer: C/I/M 0/0/0; final-error/config-recovery regressions separately passed.
- README asset validation: 27 references, three languages.
- Initial full local test used stale node_modules after a 102-commit fast-forward and failed on missing XML parser/native storage mismatch. npm ci restored the tracked lockfile and WebView patch successfully; no dependency or lockfile change.

## Operational DB
Applied tech_feed_briefing_retry, remote/local version 20261010102102. New failure_reason/retry_at/retry_count/reserved_date columns verified. Snapshot, claim, reserve-attempt, retry and complete RPCs allow service_role and deny anon/authenticated. Existing learning records retained.

## Pending at record creation
Fresh full suite completed: 1130 total, 1034 passed, 0 failed, 96 optional-browser skipped (concurrency2, 146801ms). The earlier unconstrained run had seven baseline 1s VM timeouts, all resolved without changing tests. Web build1731 and mobile compatibility/types passed. Edge tech-feed v40 and worker v38 ACTIVE, verify_jwt=true and unauthenticated401 verified. Authenticated operating-account generation, web rollout and exact-SHA/HTTP verification remain. CI synthetic provider results must distinguish ready from unavailable: a safe failure outcome does not prove successful AI generation.

## Final integrated browser evidence
23 scenarios exercised with installed Chromium, no skipped tests: 22 passed in the complete run; the first navigation exceeded its existing 15s deadline during cold startup. That isolated scenario passed 1/1 on rerun without code/test-timeout changes (see output/feed-ai-retry-browser-cold-start-rerun.log). Retry countdown, no automatic generation, recovered config, double-click protection and scope changes passed in the complete run. The README screenshot was recaptured from integrated main at390px with synthetic input; no user data/provider-success claim.

## Operational completion
- Product SHA bdd91162db7e40b4a9ef03e781cc07cdc1ce3e38; Actions38045602474 completed success. CI matches local totals:1034 passed,0 failed,96 optional browser skipped; mobile/docs/Edge/build steps successful.
- Vercel dpl_7GcgWBB31tC4GnVQ3S5rWJY24i5m READY, same Git SHA, production alias https://study-room-attendance.vercel.app. HTTP200/index-DNK2EAMX.js/TechFeedSection-COPY15eD.js checked; new provider message, retry label and DTO contract present. Public release JSON remains0.2.4/code7.
- Actual free provider check at2026-10-10T10:40:37Z: status ready, configured and response model google/gemma-4-26b-a4b-it:free, calls1/refunds0. Synthetic input/no user data/no DB writes; this verifies the provider client and briefing pipeline, not authenticated operating-account Edge generation. No fixed-model or always-best guarantee.
- Edge v40/v38 ACTIVE/JWT enabled/unauthenticated401; all22 files in each remotely deployed function equal the tested local bundle. DB migration/ACL previously verified.
- Remaining scope: optional signed-in operating-account end-to-end confirmation and real Android interaction were not performed. No known unresolved code/review/test finding; supplier availability can still vary. Rollback can restore archived prior Edge bundles (v39/v37) and the prior Vercel deployment while keeping compatible additive DB changes.
