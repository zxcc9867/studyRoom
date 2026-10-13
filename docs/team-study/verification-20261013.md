# Together study room verification

Worktree: C:/jini-dev/worktrees/study-room-team · branch feat/team-study-room · base f363eca.
Status: implementation/final scoped spec+quality review/full local regression passed; production DB and web applied/verified. Real two-account Realtime/Android16/concurrent PostgreSQL acceptance remains unverified.

Target verified read-only: public production origin https://study-room-attendance.vercel.app respondedHTTP200 and its built asset uses https://bqohkdzvxbrokkmuhysx.supabase.co. Vercel project study-room-attendance/prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g in team_LaN4bwvH4msrzoQtIw3fqsUj. This is a pre-release target check, not evidence of the new feature deployed.

## Evidence completed

| Check | Actual result | Boundary |
|---|---|---|
| Existing baseline npm test | 1044 pass,99 optional browser skips,0fail | Not full browser acceptance |
| Existing baseline with actual Chrome, concurrency2 | 1143/1143 pass,0skip,0fail,183559ms | Before team UI |
| New team and existing actual SQL | 75/75 pass,0skip,0fail,7174ms | PGlite real SQL, not multi-connection PostgreSQL |
| Task1 independent review | Two Important findings fixed; scoped rereview PASS | Unicode tag and close-lock-set guard |
| Baseline mobile:check/build/docs:check | Passed | Before team UI integration |
| Existing Edge checks and regression | 23/23 pass,0fail | Before team UI integration; no Edge entrypoint modified |
| ADB devices | Zero connected devices | Android16 acceptance not executed |
| Task2 fix-round focused Chrome | 18/18 pass,0skip,0fail,51861.8361ms | Actual mounted Dashboard; safe fake Auth/RPC, fake camera device |
| Helper/route/unchanged single-start | 16/16 pass,0skip,0fail | Final revision/token guards and official callback invariant |
| Existing settings375 startup reproduction | 1/1 pass,0skip,0fail,4274.3972ms | Charset-safe Hangul regex fix; original fixture unchanged |
| Round1 ai.ps1 verify | Passed; Dune0violations; test/Edge/mobile/build/docs exit0 | Not full actual Chrome acceptance |
| Round1 full actual Chrome | 1201total,1199pass,2fail,0skip,232032ms | Existing1440 first-screen timer and Team exact24:58 countdown wait; round2 pending |
| Round2 full actual Chrome (before final fix) | 1203/1203 pass,0fail,0skip,275405ms | Existing app + Team mounted tests, safe fake Auth/RPC/camera boundaries |
| Round2 ai.ps1 verify (before final fix) | Passed; Dune0violations; test/Edge/mobile/build/docs exit0 | No standalone lint command exists |
| Final Task2 focused/browser review | Team20/20,helpers16/16,existing/covering5/5; both fix-round re-reviews spec/quality PASS | Four Important findings plus layout/test-clock regressions addressed |
| Historical responsive/accessibility samples | 375/1440,44px controls,200% text enlargement,keyboard focus; round1 minimum5.3632:1, round2 minimum5.1223:1 | Different actual primary-button transition frames; not current final-fix measurements |
| Final-fix focused mounted UI | Team22/22 pass,0skip,51808.527ms; targeted Team7/7; unchanged existing lease/camera/settings4/4 + camera recovery/permission2/2 | Visible operational warnings/extension, private live video hidden and preserved; no production/device acceptance |
| Current final-fix responsive/accessibility sample | Same 375/1440 and touch/text checks; minimum sampled5.7066:1, primary5.7878/5.8018:1, gradient7.6887:1 | Actual computed styles in this run; scoped samples, not whole-app WCAG certification |
| Final full actual Chrome after sole fix wave | 1205/1205 pass,0fail,0skip,289651.4861ms | Complete existing/new mounted suite; safe Auth/RPC/camera fixtures, not production accounts |
| Final ai.ps1 verify after sole fix wave | Passed; Dune0violations; npm test22.9s,Edge27.3s,mobile7.4s,build13.9s,docs2.1s, all exit0 | Declared local gate, not device/OAuth acceptance |

SQL fixtures run existing personal start/pause/resume/end and accepted-segment bodies. They verify registered/anonymous/outsider access, invitations and limits, title opt-in, round first start, conservative team contribution after explicit connection, pause/camera/lease exclusions, idempotency and owner close. `A스타#지니` is exercised through set → exact lookup → invite → explicit recipient acceptance.

The close guard is tested with real SQL set containment and a controlled failure proving RETRY before checkpoint/membership mutation. It is not a reproduced multi-connection scheduling test. Future concurrent load acceptance must retain this distinction.

## Remaining release gates

- Task2 rounds1/2 scoped re-reviews PASS; full Chrome and ai.ps1 verify passed.
- Final independent whole-feature review found one Important operational-visibility issue; sole final fix, complete local gate and fresh scoped spec/quality review PASS. Dense JSX remains a nonblocking maintenance deferral.
- Reviewed migration alone applied with Supabase MCP; actual functions/auth checks/grants/RLS/publication/advisors verified with zero team rows and no production Auth/team creation.
- Feature-ref GitHub workflow_dispatch success, Vercel READY for exact code commit, productionHTTP200 and deployed public invite/login UI verified below.
- Real two-account Realtime and Android16 acceptance remain unverified if no accounts/device are available. Fixture transport cannot establish these.

## Operational audit intent

Public SECURITY DEFINER RPCs are deliberately guarded and grant only authenticated execution; private raw tables have RLS and no direct authenticated grants. Empty search_path and registered/nonanonymous auth checks are mandatory. A Supabase advisory about an exposed definer is not automatically waived: compare the exact function grants/body and documented auth tests. Do not change to an unsafe invoker/direct grant merely to silence the advisor.

Team signals contain team_id/revision only, with member SELECT policy and no authenticated write grant. Realtime publication membership must be checked remotely. No individual session/todo/profile table is added to publication by this migration.

## Implementation rulings

- Existing personal camera gate remains; team has no video. Cost: camera setup can still be needed for personal study.
- Forest grows only after personal final settlement. Cost: active team time remains pending.
- Initial six-person/one-team/25or50-minute/120-minute-tree defaults are bounded. Cost: future expansion needs a documented migration.
- Existing integer segment floor is preserved, even if explicit split loses less than one allocation second. Cost: conservative team total; personal duration/attendance must not change.
- Public tag accepts2–20 Hangul/ASCII letters/digits/_/- on each side. Cost: a wider public identifier namespace, still exact lookup only.
- Personal preparation and explicit team connection are two stages of one primary control. Cost: another confirmation tap after personal start; avoids stale cancelled-start auto-connection.
- Only private camera presentation stays hidden on Together, while its live monitoring node remains mounted. Camera/DND operational errors and near-expiry warnings stay visible; the lease strip and existing extension callback are available without opening the camera tools. Cost: local camera processing continues during team study; no team video stream is added.

No raw invite token, credential, private user data or service key is recorded here. Native binary is unchanged; hosted Android consumes the deployed web feature.

## Production database evidence

- Target bqohkdzvxbrokkmuhysx. Local reviewed20261012143354_team_study_room.sql applied as MCP-generated remote20261012235920/team_study_room. No full db push, history repair, old migration edit or local renaming.
- First apply response was Invalid or expired requestState; read-only migration/schema checks proved no application. Exact same reviewed SQL retried once and returned success; history then contains only one new team migration.
- Actual audit:7private tables+public signal all RLS=true; private direct anon/authenticated SELECT/INSERT/UPDATE/DELETE denied, signal authenticated SELECT only under member_read policy. All10team functions empty search_path, anon/PUBLIC EXECUTE denied; authenticated allowed only2public RPC+private is_member helper.3new triggers and supabase_realtime/public.team_study_signals verified.
- Existing personal/raw tables were not added to publication. Team/member/identity/invitation/round/connection counts were0. Nonexistent registered-claim UUID under authenticated returned ACCOUNT_REQUIRED from snapshot and create_team action in a rolled-back transaction; no Auth account or team was created.
- Security advisor baseline→after: RLS/no-policy INFO18→25, authenticated definer WARN17→19. New7private tables intentionally deny raw access;2new definer RPCs require registered account/membership and no anon/PUBLIC execution. See [RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [definer advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Existing WARNs unchanged: mutable search_path2, public pg_net1, leaked-password protection disabled1. Follow [search_path guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [extension guidance](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Unrelated configuration was not changed; this is not an all-clean advisor claim.
- Rollback candidate before release: dpl_GqqguL8PZfGz447w772qgSwFAod9 (code2782dda28c60a67f12ac6aa139af5a98783456c1). Retain team data if rolling back the web.

## Production web release

- Product commit b9ab3ec6bc154d983865b13588417c306154afdc pushed to feat/team-study-room; main not directly changed or merged. Existing [Actions38325255408](https://github.com/zxcc9867/studyRoom/actions/runs/38325255408) completed success for exact headSha in2m48s.
- Vercel dpl_42PCK6fVoqU6CMXx1YrtSCRyeciu READY; meta.githubCommitSha matches product commit, aliases include study-room-attendance.vercel.app. Production [Together entry](https://study-room-attendance.vercel.app/#together) respondedHTTP200.
- Isolated real Chrome public check at375/1440: new invite asset/notice present, invite requires login, explicit cancel removes notice. Used a synthetic non-real invite in an unauthenticated new browser; no sign-in/email/account/team mutation. Screenshots output/team-study/production-invite-login-{375,1440}.png are local/uncommitted.
- CI tests/Edge/mobile/docs/build and existing synthetic free coaching/briefing checks all passed. Annotation about Node20 action metadata running on Node24 and upcoming Ubuntu26 label remains informational; workflow unchanged.
- No APK/native/runtime/release JSON/signature change. Existing hosted Android receives the common web feature on reload. This does not establish Android16/device or actual two-account transport acceptance.
- Additional Jev completion check was policy-rejected for sending internal deployment/database metadata to an external destination. No result or bypass; direct checks and independent reviewers remain the completion evidence. No private records/credentials were included in documents.

## Evidence limitations and corrected artifacts

Historical sampled normal-text minima were5.3632:1 in round1 and5.1223:1 in round2 (primary-button transition frames). Current final-fix run sampled minimum5.7066:1 (error text), primary5.7878/5.8018:1 and forest gradient text7.6887:1. These are actual separate runs, not interchangeable palette calculations. Today entry99.734×44px; timer top579.75px at375 and643.75px at1440. The synthetic Today captures contain an existing unmocked camera-warning fetch error to fixture.invalid; they establish layout/touch sizing, not healthy production camera/network operation.

Final-fix lease-warning/lease-extended captures at375/1440 explicitly inject camera-warning HTTP503 and a fake DND error. They prove those operational errors are visible while private video is hidden, then the existing extension callback requests60minutes and updates the lease without pause/confirm/end. The fake extension response cannot establish deployed database lease correctness. No expiry/auto-stop/camera policy body or old mounted test was changed.

The controller's first round2 full-source capture was truncated. It was rejected, not used as exact-diff evidence. Re-review used a lossless current read plus the worker's recorded single applied hunk to transparently reconstruct the previous main source, and original lossless test baseline. Whole-feature tracked diff against f363eca is independently lossless. No product edit or test weakening was performed to repair review artifacts.
