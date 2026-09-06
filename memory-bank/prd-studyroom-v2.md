# StudyRoom 2.0 PRD

User-approved 2026-09-06. Career-driven automatic recommendations for consistent study. First pilot for the owner's account, per-user isolation from day one. One active IT/development career; editable skill roadmap and evidence-based project tasks. Automatic suggestions, explicit acceptance into existing todos. Free AI only. Web first.

## User experience
Searchable IANA timezone selection prioritizes Seoul/Tokyo; preserve explicit profile zone across browser/settings changes. Instants remain UTC; wall-clock recurring settings and date-only tasks retain their semantics. No rewrites of historical attendance/badges.

Career setup captures role, experience, target date, interests, available windows/rest. Roadmap editable/confirmable; progress not inferred from time or commits. Today shows one primary and up to two alternatives, reasons, duration, skill and acceptance criteria. Long disclosure moves to setup/settings; no generation button in everyday flow. Accept transactionally rechecks schedule; feedback modifies future suggestions.

Internal life calendar supports recurring/all-day events. Google selected calendars read-only, current/next month refreshed every 15min and before opportunity notifications; failed partial sync never replaces snapshot. Calendar titles not sent to AI. Default buffer10min and minimum slot15min, configurable. Disconnect cancels dependent work.

Slack/Web Push/email are explicit opt-in only, no channel means no external delivery, no fallback to disabled channels. Daily summary + at most one opportunity10min before slot; quiet hours, active sessions, acceptance/skips, old attendance messages suppress duplicates. Channel adapters; Slack plan link/snooze30min/mute today. No automatic Discord/Telegram/Expo expansion.

Selected GitHub App public/private repos read-only; initial then daily changed-HEAD analysis. Private AI analysis separately enabled. Max3 tasks with verified SHA/path/line evidence and analysis scope; exclude secrets/generated/dependencies/binaries; never execute repo instructions or modify code.

## AI, security, rollout
Deterministic time/conflict/ranking/history processing; bounded AI tasks1024tokens/20sec; free price0 and no data collection, no paid fallback. User daily shared actual-call quota6 including failures/legacy. Store actual model vs configured router, prompt version/time; no raw private code/prompt logs. OAuth encrypted server-only; per-user RLS; transactional accept/leases/idempotency.

New optional feature flag keeps legacy users unchanged. Additive migrations, kill switch. Test30 synthetic scenarios, zero conflicts/fake citations/paid requests, >=80% relevance/time/actionability review or restrict failing kind to rules. Preserve legacy timer/attendance/todos/goals/badges. Actual authenticated integrations, notification device delivery, and two-week pilot must be reported separately from fixture tests.

## Delivery
Backend/frontend/integrations work in separate worktrees. Main integrates/reviews/tests/deploys. Update multilingual READMEs with real fixture screenshots, current model policy and connection setup; root AGENTS requires this for all projects. Google/GitHub app registration and user/device consent may require external setup; document accurately, no simulated live success.
