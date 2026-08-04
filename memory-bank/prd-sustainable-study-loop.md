# PRD: Sustainable Study Loop

## 1. Problem

The app is strong at forcing a study start, but it does not yet connect the end of one session to the next session. Web and mobile also use different session-planning gates, and fixed reminder times do not learn from actual study behavior.

## 2. Target Users

Personal learners who need a repeatable plan-focus-reflect-adjust loop rather than a timer alone.

## 3. Goals

- Capture a short reflection whenever a user manually completes a study session.
- Show a current-week review with comparison to the previous week.
- Recommend and optionally maintain a weekday reminder time from recent successful starts.
- Require at least one owned, incomplete, same-day todo when starting from web or mobile.
- Keep manual session completion, todo completion, and reflection storage atomic.

## 4. Non-goals

- No paid AI summary API.
- No social ranking or multiplayer accountability.
- No camera requirement on Expo mobile until a mobile camera-presence PRD is approved.

## 5. User Stories

- As a learner, I want to record focus, energy, interruptions, and my next action when I finish, so that the next session starts clearly.
- As a learner, I want to compare this week with last week, so that I can adjust before a bad pattern becomes a missed week.
- As a learner, I want reminders to follow when I actually begin studying, so that alerts are timely rather than noisy.
- As a mobile learner, I want the same session todo requirement as web, so that my study records follow one policy.

## 6. User Scenarios

### Normal Flow

1. User selects one or more incomplete todos and starts a session.
2. User ends the session and records focus, energy, optional interruption context, note, and next action.
3. The server ends the session, completes selected todos, marks session links, and saves the reflection in one transaction.
4. My Page shows the current weekly review and previous-week comparison.
5. Settings shows an adaptive reminder recommendation after at least three completed study days.
6. When adaptive reminders are enabled, future completed sessions keep the weekday reminder aligned to the recent median start time.

### Edge Cases

- Automatic lease/inactivity/recovery endings may end without a reflection.
- Fewer than three completed study days produce an insufficient-data recommendation.
- A todo that is not owned, is completed, or is not for the user's current local date cannot start a session.

### Error Cases

- A failed atomic completion keeps the active session and reflection form open.
- Mobile query or RPC errors must be visible and must always release the busy state.

## 7. Functional Requirements

- [x] Add user-scoped session reflection storage with RLS.
- [x] Add an authenticated atomic manual-completion RPC.
- [x] Add deterministic weekly review and adaptive reminder helpers with tests.
- [x] Add web reflection, weekly review, and adaptive reminder UI.
- [x] Make session todo links part of the server-side start transaction.
- [x] Add mobile todo selection/quick-add and robust async error handling.
- [x] Add adaptive reminder profile state and server maintenance trigger.

## 8. Non-functional Requirements

- Performance: fetch canonical timezone-aware study totals through one authenticated period-summary RPC and page large client datasets without silent row truncation.
- Security: explicit grants, RLS ownership policies, authenticated-only RPC execution.
- Accessibility: labeled dialog controls, keyboard-operable score choices, readable trend text.
- Maintainability: keep review and reminder math outside React components.

## 9. Dependencies

- Internal: `study_sessions`, `study_todos`, `study_session_todos`, `attendance_days`, `profiles`.
- External: Supabase Postgres and existing Vite/Expo clients.
- Environment variables: none.

## 10. Success Metrics

- Manual session completion stores one reflection and selected todo results atomically.
- Web and mobile cannot start without at least one valid same-day todo.
- Weekly review numbers are deterministic for Monday-to-today and the previous Monday-to-the-same-weekday comparison ranges.
- Adaptive reminder recommendation requires at least three distinct completed days and rounds to 15 minutes.

## 11. Rollout Plan

- Development: local migration, helper tests, web build, mobile typecheck.
- Deployment: apply the reviewed migration through Supabase MCP, then publish web through the existing CI workflow when explicitly requested.
- Monitoring: Supabase advisors and manual web/mobile smoke tests.

## 12. Open Questions

- Whether Expo should later add the same camera presence requirement as web.
- Whether weekly review history should become a persisted snapshot instead of a live calculation.

## 13. 2026-07-17 Update: Weekly Study Time Clarity

### Data Contract

- Current-week study time comes from the authenticated period-summary RPC for Monday through today in the user time zone.
- Active and cancelled sessions are not included in this review total.
- The comparison excludes future weekdays: the current range is Monday through today and the previous range is the previous Monday through the same weekday.
- Aggregated seconds are rounded to the nearest minute for presentation; stored session data is not changed.

### Functional Requirements

- [x] Show the study-time comparison in hours and minutes instead of an unbounded minute count.
- [x] Label the metric as a completed-session total and show the completed session count.
- [x] Show the current date next to the Monday-to-Sunday range.
- [x] Keep current and previous weekly calculations deterministic and covered by helper tests.

## 14. 2026-07-19 Update: Canonical Study Totals and Mobile Completion

### Functional Requirements

- [x] Allocate completed study time by the user's local date, including proportional splitting for sessions that cross midnight.
- [x] Compare an in-progress week only with the same elapsed weekdays of the previous week.
- [x] Show cross-date and 12-hour-plus session counts as data-quality context without deleting or silently capping stored records.
- [x] Load reflections only on My Page and notification delivery diagnostics only on Settings.
- [x] Expose query failures instead of replacing failed responses with empty arrays.
- [x] Give Expo mobile the server-capped session lease extension and the same atomic reflection/todo completion RPC as web.
- [x] Use one accessible dialog primitive for focus trapping, Escape close, scroll locking, and focus restoration.

### Security and Data Rules

- Internal cron and trigger helper RPCs are executable only by `service_role`.
- User-facing period summary and manual session RPCs require `authenticated`; functions validate `auth.uid()` and use an empty fixed `search_path`.
- Historical long sessions remain unchanged. The UI labels them for review and the period aggregate remains the source of truth.

### Release Criteria

- Full web/core tests, web production build, mobile typecheck, remote migration registration, RPC role matrix, and Supabase Advisor review must pass before commit or deployment.

## 2026-07-20 - Daily Habit Entry Layer

The sustainable loop now adds a low-friction entry layer without weakening attendance rules.

- [x] Recognize ten counted study minutes as a separate daily habit success.
- [x] Keep the existing weekday two-hour and weekend four-hour targets as the next milestone.
- [x] Use one completed same-day todo as the final daily bloom milestone.
- [x] Surface the latest non-null reflection `next_action` on Today.
- [x] Match the next action to an incomplete same-day todo or prefill quick add after explicit user action.
- [x] Preserve recovery, camera, and session-todo gates before starting study.
- [x] Keep all habit state client-derived; do not add schema or alter `present`/`missed` semantics.

### Success Evidence

- Helper boundaries, source wiring, full regression tests, production build, remote index/RLS verification, and 1440px/390px browser layout checks pass.

## 2026-07-20 - Weekly Habit Rhythm Layer

The Today entry layer now shows consistency across days without turning the existing weekly review into a punitive score.

- [x] Show the rolling seven local dates ending today.
- [x] Reuse the ten-minute start, weekday/weekend full goal, and completed-todo bloom stages for every date.
- [x] Allocate cross-midnight completed study time with the same proportional rule as the canonical period-summary RPC.
- [x] Override today's derived value with the canonical Today total plus active study time.
- [x] Count a current streak through yesterday while today is still in progress, then include today after ten minutes.
- [x] Show visible `rest·ten minutes·goal·bloom` text, study duration, start days, goal days, bloom days, and gentle next-step copy.
- [x] Avoid any new Supabase query, schema, attendance-semantic, or Expo change.

### Success Evidence

- Six focused tests cover calendar rollover, timezone boundaries, DST, proportional exclusions, weekend goals, canonical Today override, streaks, and UI source contracts.
- All 289 Node tests and the TypeScript/Vite production build pass.
- Actual Chrome rendering at 1440px and 390px proves `7→2` date columns, `3→1` summary columns, and no document or content overflow.

## 2026-07-20 - Flexible Five-of-Seven Start Goal

The weekly rhythm now turns observation into a forgiving, concrete action target.

- [x] Set the default target to five ten-minute starts in the rolling seven-day window.
- [x] Name the other two days as available rest rather than missed or failed days.
- [x] Cap displayed target credit at five while preserving all seven daily records.
- [x] Show five accessible seed markers, remaining starts, and a completed state.
- [x] Offer `10분 시작 준비` before habit success and `오늘 목표 이어가기` before the full daily goal.
- [x] Route the latest reflection action or first incomplete today todo through the existing recovery, camera, and todo-selection gates.
- [x] Present that context through the single topbar start action; keep the weekly card non-interactive and preserve active-session Pause/Resume behavior.
- [x] Keep attendance semantics, Supabase schema, RPCs, queries, and Expo unchanged.

### Success Evidence

- Eight focused tests cover target boundaries at 0, 4, 5, and 7 starts, optional rest after target completion, and the UI/action source contract.
- All 291 Node tests, the TypeScript/Vite production build, and `git diff --check` pass.
- Actual Chrome rendering at 1440px and 390px proves the target sign changes from three columns to one, all five seed markers remain visible, the CTA fills the mobile row, and no content overflows.

## 2026-07-21 - Gentle Restart After Rest

The five-of-seven rhythm now names the first useful action after a rest day without turning rest into failure.

- [x] Derive restart only when today and yesterday are below ten minutes, an earlier rolling-window day succeeded, and the five-start target remains incomplete.
- [x] Show `다시 잇는 날` and suggest `10분으로 다시 잇기` through the existing weekly sign and single topbar action.
- [x] Preserve first-start, active-streak, today's-success, and earned optional-rest guidance.
- [x] Keep reflection priority plus the existing recovery, camera, todo-selection, Pause, Resume, and End paths.
- [x] Add no button, punishment, automatic start, Supabase request/schema/RPC/RLS change, local storage, timer, or Expo behavior.

### Success Evidence

- Focused tests cover restart eligibility and exclusion for first start, yesterday success, and completed five-of-seven target.
- Source contracts require visible non-interactive restart copy and prohibit a second restart action.
- Full regression, production build, diff hygiene, and actual desktop/mobile browser evidence are recorded in `memory-bank/progress.md`.

## 2026-07-20 - Persistent Weekly Forest Reward

The flexible five-of-seven target now produces a visible reward without taking earned progress away on a later rest week.

- [x] Allocate all completed sessions only across the local dates they actually overlap.
- [x] Earn one firefly wreath on the fifth ten-minute start inside a moving seven-day window.
- [x] Require seven days between earned dates to prevent overlapping windows from producing daily duplicates.
- [x] Recompute earned wreaths from existing completed-session history so rewards survive refresh and lower current progress.
- [x] Show five accessible seed lights, starts remaining, and permanent wreath count in Study Forest.
- [x] Render the live seed ring, completed firefly halo, and permanent flower keepsake around the current low-poly tree.
- [x] Keep the new geometry inside the current tree collider and stop halo motion for reduced-motion users.
- [x] Add no Supabase query, schema, RPC, RLS, Edge Function, environment variable, or Expo change.

### Success Evidence

- Focused weekly/forest/UI tests cover reward acquisition, duplicate prevention, persistence after a lower current target, WebGL wiring, collider anchor, and responsive source contracts.
- All 294 Node tests and the TypeScript/Vite production build pass.
- Actual Chrome at 1440px and 390px reports WebGL ready, one canvas, `2→1` grid columns, five visible seeds, and no document, card, seed, or scene overflow; screenshots confirm the complete and 3/5 visual states.

## 2026-07-21 - First Ten-Minute Checkpoint

The low-friction entry promise now has a visible in-session completion moment without weakening the full attendance target.

- [x] Combine canonical completed-today seconds with lease-aware, break- and camera-excluded active seconds.
- [x] Show a live accessible progressbar only while a first ten-minute success is still possible in the active session.
- [x] Show the completion choice only when the active session crosses today's first ten-minute threshold.
- [x] Let the learner continue without changing the session, or open the existing todo/reflection completion flow.
- [x] Persist only the acknowledgement flag per user, session, and local date.
- [x] Restore an unacknowledged completion after refresh and avoid repeating it after acknowledgement.
- [x] Keep attendance, session, recovery, camera, lease, Supabase, and Expo semantics unchanged.

### Success Evidence

- Six focused tests cover the threshold, partial prior study, prior success suppression, pause, acknowledgement, storage failure, and source wiring.
- All 300 Node tests and the TypeScript/Vite production build pass.
- Actual Chrome at 1440px and 390px confirms progress/complete states, two desktop choices, one-column mobile choices, acknowledgement interaction, content-level overflow checks, and zero console/page errors.

## 2026-07-21 - Break Return Plan

The sustainable loop now keeps an intentional pause from becoming an unbounded exit.

- [x] Offer 10, 20, and 40 minute return promises only while a web study session is paused.
- [x] Show the exact local return time, live countdown, due state, ten-minute extension, and clear action.
- [x] Warn when the session lease ends before the promised return time without extending it automatically.
- [x] Restore the deadline from user/session-scoped localStorage and degrade to tab state when storage fails.
- [x] Clear the deadline only after resume/end success or when the active session is observed unpaused.
- [x] Keep camera preparation, pause/resume RPCs, lease countdown, and break exclusion semantics unchanged.
- [x] Avoid new intervals, Supabase requests, schema, RPC, RLS, Edge Function, environment variable, and Expo changes.

### Evidence

- The interaction design applies Gollwitzer's implementation-intention principle as a narrow time cue: when the promised break time arrives, use the existing resume action.
- Six focused return-plan tests plus four existing break tests pass.
- All 306 Node tests and the TypeScript/Vite production build pass.
- Actual Chrome at 1440px and 390px verifies preset, extension, clear, due, lease-warning, responsive layout, content bounds, and zero console/page errors.

## 2026-07-21 - Weekly Reset Bridge

The weekly review now turns reflection into a concrete next-session plan instead of ending at retrospective metrics.

- [x] Normalize up to three reflection actions and match them case-insensitively to incomplete todos.
- [x] Ignore completed todos so a finished action can be planned again when it reappears in reflection.
- [x] Open the existing todo modal for today with the selected action already entered.
- [x] Show a readable planned date and open the existing edit modal when a matching todo already exists.
- [x] Keep an invalid-date todo planned while omitting only its unsafe date label.
- [x] Perform no server write until the user confirms the existing todo form.
- [x] Stack each action button below its copy at 390px and keep contextual accessible names.
- [x] Add no query, schema, RPC, RLS, Edge Function, environment variable, timer, or Expo change.

### Success Evidence

- Three focused tests cover normalized matching, completed-todo exclusion, invalid-date fallback, modal callbacks, and responsive source contracts.
- All 309 Node tests and the TypeScript/Vite production build pass.
- Actual Chrome at 1440px and 390px verifies create and edit title prefill, `07.24 · 계획됨`, desktop `34px 786.781px 111.219px` and mobile `34px 208px` row columns, full-width mobile action, no horizontal overflow, and zero console/page errors.

## 2026-07-21 - Single Adaptive Start Surface

The daily-entry layers now share one persistent execution point instead of competing start buttons.

- [x] Keep the topbar session control as the only persistent inactive-session start CTA on Today.
- [x] Prioritize reflection continuation, then weekly habit copy, then the stable default label.
- [x] Preserve the first incomplete today todo as a suggestion when no reflection action exists.
- [x] Route the derived suggestion through the unchanged recovery, camera, and todo-selection gates.
- [x] Turn daily reflection and weekly target actions into readable non-interactive cues only for inactive sessions, and hide them during active or paused sessions.
- [x] Preserve Pause, Resume, End, and temporary reminder-dialog actions.
- [x] Add no query, schema, RPC, RLS, Edge Function, environment variable, timer, localStorage, or Expo change.

### Success Evidence

- Focused helper/source tests, all 314 Node tests, TypeScript/Vite production build, and `git diff --check` pass.
- Actual Chrome at 1440px and 390px verifies all four label/suggestion states, one persistent start CTA, zero card start buttons, no overflow, and zero console/page errors.

## 2026-07-21 - Reflection Inbox Recovery

The sustainable loop now lets a rushed or automatic ending reconnect to reflection without penalties or a forced popup.

- [x] Derive completed sessions without reflections from the seven local dates ending today.
- [x] Show at most the three most recently ended candidates in My Page only after reflection history loads successfully.
- [x] Reuse the session reflection fields in a follow-up mode without changing todo completion.
- [x] Upsert one reflection per session and immediately remove the saved session from the inbox.
- [x] Feed a newly saved non-empty next action into the existing single Today start surface and weekly reset bridge.
- [x] Add a local migration that requires both reflection-row ownership and ownership of the linked completed session for INSERT and UPDATE.
- [x] Keep the existing atomic manual-completion RPC, study duration, attendance, todo completion, environment variables, and Expo UI unchanged.

### Success Evidence

- Four focused inbox tests and the existing sustainable/weekly/single-start regressions pass.
- All 321 Node tests and the TypeScript/Vite production build pass.
- Actual Chromium verifies the full `3 candidates → follow-up save → 2 candidates → weekly action → Today continuation` flow.
- At 390×844 the document and modal have no horizontal overflow and inbox actions retain 44px hit targets.
- The local migration has not been applied remotely; production rollout requires an explicit user request followed by remote policy and advisor verification.

## 2026-07-21 - Weekly Friction Plan

The weekly review now turns repeated interruption context into one small setup change without adding another start surface.

- [x] Count only valid interruption reasons attached to completed sessions inside the current Monday-to-today range.
- [x] Stay quiet until one non-`none` reason appears at least twice.
- [x] Choose one reason by count, latest occurrence, then a stable reason order.
- [x] Map phone, environment, fatigue, schedule, and other to deterministic Korean setup guidance outside React.
- [x] Render the result as a non-interactive forest trail maintenance note before the existing next-action plan.
- [x] Keep the data-quality warning and friction plan as independent conditions.
- [x] Use two columns on desktop and one column at 390px without overflow.
- [x] Add no Supabase query, schema, RPC, RLS, write, timer, localStorage, environment variable, or Expo change.

### Success Evidence

- Five focused tests cover repeated, one-off, invalid, tied, current-range, no-new-button, independent-condition, and mobile-selector contracts.
- All 326 Node tests, the TypeScript/Vite production build, and `git diff --check` pass.
- Actual Chromium with fully stubbed Supabase requests shows one phone plan for two reflections, no new button, no auth message, and zero console/page errors.
- At 1440px the card uses two columns; at 390px it uses one `246px` column with no document, card, or descendant overflow.

## 2026-07-21 - Study Habit Loop Completion Audit

The product-level habit objective is complete in the current worktree. Completion means a sustainable loop, not an ever-growing set of widgets.

### Completion Requirements

- [x] Plan: connect today todos, long-term goals, and reflection next actions to the next session.
- [x] Start: expose one persistent context-aware start action and preserve recovery, camera, and todo gates.
- [x] Focus: recognize the first ten counted minutes without weakening the two/four-hour attendance target.
- [x] Recover: support intentional pause and a non-punitive 10/20/40-minute return plan.
- [x] Reflect: atomically finish a session with todo results and reflection, plus recover missed reflections later.
- [x] Adjust: compare weeks, adapt reminder timing, and translate repeated interruptions into one setup change.
- [x] Restart: preserve two rest days in a five-of-seven target and offer a gentle return after a rest day.
- [x] Reward: keep earned forest progress and firefly wreaths instead of taking rewards away after rest.
- [x] Simplicity: keep one persistent start CTA, no punishment score, no automatic start, and no competing habit actions.
- [x] Quality: pass full web/core tests, web production build, mobile typecheck, and actual desktop/mobile Chrome checks.

### Authoritative Evidence

- All related PRD functional requirements are checked and map to dedicated helper or source-contract tests.
- `npm test` passes all 329 Node tests.
- `npm run build` passes TypeScript and Vite production build with 1,684 transformed modules.
- `npm.cmd --workspace apps/mobile run typecheck` passes.
- Actual Chromium at 1440×1000 and 390×844 shows exactly one persistent restart action, no habit-card button, one accessible weekly progressbar, 44px start hit target, `light only` color scheme, no document overflow, and zero final console/page errors.
- Clicking the real `10분으로 다시 잇기` action opens the existing camera gate; cancelling returns to the unchanged single-start state without starting a session.
- Supabase requests were fully stubbed for browser verification, so this audit did not mutate remote data or settings.

### Scope Boundary

- This audit proves the current worktree's product behavior; it does not claim that the latest local changes are deployed.
- Remote rollout still requires explicit user approval, the pending reflection-inbox RLS migration, remote policy/advisor checks, and the existing CI deployment gate.
- Future habit changes require observed usage or a concrete user request. Do not add more scores, streak pressure, persistent CTAs, or rewards merely to make the feature set larger.
