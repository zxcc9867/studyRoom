# PRD: Session Lease Expiry Enforcement

## 1. Problem

An active study session can remain open when the browser is closed or offline. If it is manually ended later, the server currently stores all elapsed wall-clock time, which can inflate study totals and incorrectly affect attendance.

## 2. Target Users

Learners using the Study Room timer on web who may close a tab, lose connection, or leave a session unattended.

## 3. Goals

- Persist no study time after a session's server-owned lease expiry.
- Close expired active sessions without relying on an open browser.
- Keep an intentional pause excluded when a session expires while paused.
- Preserve the existing one-hour extension action and two-hour maximum remaining lease policy.
- Repair the known historical overcount and any attendance records caused solely by it.

## 4. Non-goals

- Do not impose a lifetime session-duration cap; the learner can keep studying by explicitly extending the lease.
- Do not change break, camera-presence, or reflection product flows.
- Do not alter attendance rules for legitimate sessions.

## 5. User Stories

- As a learner, I want an unattended session to end at its displayed lease deadline so that my reports remain trustworthy.
- As a learner, I want an expired paused session to exclude my break time so that only focused time is counted.
- As an operator, I want automatic expiry to run server-side so browser shutdown cannot create an endless timer.

## 6. User Scenarios

### Normal Flow

1. A learner starts a session with a one-hour lease.
2. The learner may extend the remaining lease by one hour, up to two hours remaining.
3. At expiry, the minute cron closes the active session at the stored deadline.
4. The stored duration subtracts paused time and any client-reported camera exclusion.
5. The web UI refreshes and no longer shows an active session.

### Edge Cases

- A manual end request after expiry persists the lease deadline rather than the request time.
- Concurrent cron invocations lock different rows and safely skip already-claimed sessions.
- Legacy active rows without a lease use the original one-hour fallback from their start time.

## 7. Functional Requirements

- [x] Add an active-session lease-expiry index.
- [x] Cap `end_study_session` at `lease_expires_at`.
- [x] Add a service-role-only batched expiry RPC.
- [x] Run the expiry RPC from the existing once-per-minute attendance cron.
- [x] Update the web auto-end to rely on the server cap for lease overrun.
- [x] Repair the confirmed historical session and affected attendance records after deployment.

## 8. Non-functional Requirements

- Performance: process bounded batches and use row locks with `SKIP LOCKED`.
- Security: keep cleanup RPC service-role-only; keep manual ending authenticated and ownership-checked.
- Reliability: functions must be idempotent for completed sessions.
- Observability: cron response includes the number of expired sessions closed.

## 9. Dependencies

- Internal: `study_sessions`, `attendance_days`, `profiles`, existing attendance promotion helpers.
- External: Supabase Postgres, existing `attendance-cron` Edge Function, pg_cron schedule.

## 10. Success Metrics

- An overdue session is completed with `ended_at <= lease_expires_at`.
- No completed duration exceeds its valid lease window because of delayed manual termination.
- Browser shutdown no longer produces multi-hour overcounting.

## 11. Rollout Plan

- Development: migration/source contract tests and production build.
- Deployment: apply migration, deploy the existing cron Edge Function, then verify a transaction-scoped expiry simulation.
- Monitoring: inspect cron output and active sessions with expired leases.

## 12. Open Questions

- Whether the mobile timer should add the same active-session refresh cadence in a separate mobile-focused change.