# Team Study Room Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registered-account-only invitation teams, server-derived desks, opt-in subject sharing, shared focus proposals, and an accepted-time cooperative forest, without changing personal study policy.

**Spec:** memory-bank/prd-social-study-room.md
**Architecture:** Add one dedicated Supabase boundary and one dedicated web feature. Hosted Android consumes the same UI. main.tsx integrates routing and existing personal callbacks only.

## Global Constraints

- Work only in C:/jini-dev/worktrees/study-room-team, feature branch feat/team-study-room. Other worktrees/user files are not ours.
- Existing Auth, study-session actions, recovery/camera gates, DND and attribution policies remain authoritative. No auto start/stop/pause on team navigation.
- Max6/team, one team/user, owner-controlled link issuance; exact public tag invites require recipient acceptance. No guests/anonymous accounts/email lookup.
- DB writes through guarded RPC only; member snapshots reveal no emails/private titles/recovery/raw study rows. RLS/grants/search_path/security must be tested with real SQL.
- No service role in client, no secrets/credentials in logs, no public mutation tests on production accounts.
- Do not edit outside owned files or revert others. Local edits via apply_patch. No worker subagents, remote mutation, commits or pushes; controller runs full verification/review first.
- Snapshot contract: public team_study_snapshot() returns JSON object {tag: string|null, team: null|{id,name,owner_id,time_zone,member_count}, members: array of {user_id,display_name,state:ready|studying|resting,title:string|null,started_at,paused_seconds}, invitations: received targeted invite previews, round:null|{id,duration_minutes,proposed_by,started_at,ends_at,joined}, connection:null|{id,session_id}, forest:{accepted_seconds,pending_sessions,trees,progress_seconds}, server_now}. No confidential fields. Extra documented safe fields permitted.
- Actions use public team_study_action(p_action text,p_payload jsonb default '{}') returning {ok:boolean,error?:code,...safe result}; preview/accept link use explicit actions. Safe error codes map to Korean copy. Rate-limited attempts persist even if an invalid tag/token is supplied (do not lose counters in rolled-back exception paths).
- Client layer wraps .rpc only and listens to public.team_study_signals(team_id,revision) UPDATE. Realtime failure fallback bounded poll and server refresh; no per-second writes. Member RLS on signals. Logout/owner changes cancel stale requests.

## Task 1: Server authority, invitations and accepted contributions

**Ownership:** supabase/migrations/20261012143354_team_study_room.sql (created by official CLI migration new); packages/core/test/team-study-db.test.mjs; packages/core/test/fixtures/team-study-db.mjs; docs/team-study/server-contract.md.

- [x] Read existing actual-study SQL/SQL fixture patterns; write PGlite behavioral tests first and run RED.
- [x] Create additional team/membership/public-tag/invitation/round/connection/signals tables in a single migration. Private data tables have no direct authenticated writes; JSON RPC has guarded auth and membership.
- [x] Implement actions set_tag, lookup_tag, create_team, create_invite, revoke_invite, preview_invite, accept_invite, invite_tag, respond_invite, leave_team (successor or explicit close for owner), set_share_title, propose_round, cancel_round, connect, disconnect. All payloads validated and concurrent membership/round/connect decisions row-locked.
- [x] Snapshot derives personal state from server lease/status/pause, title only opt-in, round and current connection. Teams never become a personal session writer.
- [x] On explicit connect/disconnect, checkpoint existing actual-study segment under session/tracking row locks. Preserve accepted totals and camera deduction behavior. Already connected is idempotent; session end closes connection, personal start can attach after success. Page navigation does nothing.
- [x] Forest sums only ended-session accepted segments within server checkpointed links, caps appropriately, never double counts. In-progress contribution is pending; no fabricated/missing tracking contribution. Signals invalidate on membership, team action and personal session transition; no user data inside signal.
- [x] Test two accounts plus outsider/anon, tag normalization/rates, invalid token/expiry/revoke, 6-cap/one-team/idempotency, server state/title privacy, owner leave/close, round single-start, contribution before join/pause/exclusion/end/lease/reconnect and no individual-session corruption.
- [x] Run focused node test, migration syntax/permission tests, diff check; write implementer report with RED/GREEN commands, contract, remaining risks. No production migration application.

## Task 2: Authentication-safe shared web/app experience

**Ownership:** apps/web/src/TeamStudySection.tsx, TeamStudySection.css, teamStudyClient.mjs/.d.mts, teamStudyInvite.mjs/.d.mts, teamStudyPresentation.mjs/.d.mts; apps/web/test/team-study*.test.mjs; apps/web/src/main.tsx, dashboardRoute.mjs/.d.mts, DashboardNavigation.tsx; corresponding route tests. Do not modify other feature components.

- [x] Read Task1 contract, existing auth redirect and dashboard callbacks/tokens; write client/invite behavioral tests RED first.
- [x] Keep invite token through login/signup redirect with a bounded fragment/sessionStorage helper, clear on join/cancel/logout as appropriate, no auto join. Invalid tokens rejected before RPC. Login page shows an invite explanation without exposing token.
- [x] Add #together route (Today navigation stays active), small team entrypoint on Today; personal Today stays default and existing 5-tab mobile navigation unchanged.
- [x] Dedicated room UI: create/team-less, received invites, public-tag edit/search/confirm/send, owner link copy/revoke, explicit link preview/join, actual member desks (no sample people), opt-in title sharing, owner-safe leave/close.
- [x] One personal study action via existing start/resume/pause/end callbacks. Team connection only after confirmed active server session. Current active session can connect without restarting. Explain private camera policy if prompt needed. Do not embed duplicate native screens.
- [x] Shared 25/50 proposal/select then personal action/connect; server starts shared time only after valid connect. No personal auto stop at round end. Dedicated forest tab only, final accepted totals and pending indication.
- [x] Read-only snapshot controller with identity/request revision guards, cleanup realtime on route/logout, debounced invalidation and bounded poll when not connected; recover reload without duplicate personal action/contribution.
- [x] Accessible responsive styling using existing tokens; error/focus/loading/empty states, keyboard dialog/inline form management, touch44px. Avoid pointless copy and duplicated forest preview.
- [x] Actual mounted browser tests with safe fake RPC boundary for login/invite/create/team1/desk state/update/round/forest/errors/route/viewport and stale identity; don't claim mock transport as real two-account production sync.
- [x] Focused tests/build/diff; implementer report with executed evidence and no remote writes/commits.

## Task 3: Integration, verification, documentation and release

**Ownership:** controller integrates contracts; memory-bank active-context/progress/architecture-map/implementation-plan/trouble-shooting, docs/team-study verification; changes from review assigned back to relevant worker.

- [x] Independent review after each task, bounded fixes, final integration review; no review self-approval.
- [x] Run full npm.cmd test, test:edge, mobile:check, build, docs:check and available Dune gate. Capture actual375/1440 UI; inspect Android16 availability and report real-vs-fixture acceptance accurately.
- [x] Apply only verified migration through Supabase MCP; verify actual schema/RPC/RLS/grants/realtime publication and security advisors. No Auth users/sample teams created in production.
- [x] Update actual project memory bank, preserving archived/history documents. Compact oversized active/progress with archives, not deletion.
- [x] Commit own files to feat/team-study-room; push this branch; workflow_dispatch production using feature ref, not main direct commit/merge. Verify action success, READY and productionHTTP200.
- [x] Report scope, files, actual checks/deployment and remaining two-real-account/Android acceptance if unavailable. No new APK unless native change proves necessary.
