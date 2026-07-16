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

- Performance: derive weekly summaries from already loaded bounded rows.
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
- Weekly review numbers are deterministic for current and previous Monday-Sunday ranges.
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

- Current-week study time is the sum of `duration_seconds` for completed sessions whose `local_date` is inside the Monday-to-Sunday range.
- Active and cancelled sessions are not included in this review total.
- The range remains the complete calendar week, while the UI must also show the current as-of date so future dates are not mistaken for recorded time.
- Aggregated seconds are rounded to the nearest minute for presentation; stored session data is not changed.

### Functional Requirements

- [x] Show the study-time comparison in hours and minutes instead of an unbounded minute count.
- [x] Label the metric as a completed-session total and show the completed session count.
- [x] Show the current date next to the Monday-to-Sunday range.
- [x] Keep current and previous weekly calculations deterministic and covered by helper tests.
