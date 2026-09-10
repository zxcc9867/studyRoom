# PRD: Weekly and Monthly Study Reports

## 1. Problem

Users cannot revisit a completed week or read a monthly report. Pending or failed data loads can show provisional zero/stale totals as final results.

## 2. Target Users

Signed-in web learners, including mobile-browser users, reviewing their own study history.

## 3. Goals

- Extend the existing My Page review with week/month mode and historical-period selection.
- Preserve canonical user-time-zone completed-study totals and existing next-action planning.
- Distinguish loading/error/empty/ready states and prevent stale user/period data from appearing.

## 4. Non-goals

New AI charges, scheduled notifications, persisted report snapshots, PDFs, attendance policy changes or native Expo report UI.

## 5. User Stories

- As a learner, I can revisit a finished week/month and compare it with the previous period.
- As a learner, I can read study time, attendance, task completion, reflection averages, repeated interruptions and next actions without mistaking unloaded data for zero.

## 6. User Scenarios

- My Page initially opens the current week; switch to month, choose an earlier period, and return using next/previous controls.
- Current periods end today; compare only corresponding elapsed days, capped at the previous month's actual end. Completed periods compare their full ranges. Show both date ranges and daily averages when month lengths differ.
- A new week/month makes the previous completed period accessible automatically from existing records; reports are recalculated, not immutable snapshots.
- A failed request hides metrics, shows a retry action and keeps period controls usable. Switching user, time zone or period invalidates old results immediately.

## 7. Functional Requirements

- [x] Accessible week/month controls and date/month selection; no future-period navigation.
- [x] Selected-period study time and counts use the existing authenticated get_study_period_summary RPC.
- [x] Attendance, completed-session metadata, todos and reflections are owner-scoped and paginated for the actual current/comparison ranges, without the dashboard's 370-row attendance limit.
- [x] Reflection metrics remain assigned to the session's local start date; study time follows canonical midnight splitting. Explain this distinction.
- [x] Unknown, failed or malformed summary responses never become zero-valued reports.
- [x] Cancel/discard obsolete requests and hide stale data before effects run.
- [x] Preserve existing interruption guidance, data-quality note and action-to-todo callbacks.
- [x] Keep the forest palette, visible focus states, 44px controls and a non-overflowing mobile layout.
- [x] Read the current owner's saved profile time zone before computing report dates; missing/null zone follows the RPC UTC default.

## 8. Non-functional Requirements

- Reuse existing RLS and authenticated client; no credentials in report state or logs.
- Query only while the report is mounted. Cancel obsolete queries and refresh after source records change.
- Keep date math, aggregation and request-state logic outside React for behavioral tests.

## 9. Dependencies

Existing Vite/React UI, Supabase client, profiles.time_zone, study_sessions, study_todos, study_session_reflections, attendance_days and the period-summary RPC. No schema, grants, environment variable or remote data mutations.

## 10. Success Metrics

Week/month/year/leap-day boundaries, completed versus in-progress comparison, scoped/paginated queries, loading/error/retry and stale-response tests pass. Browser checks demonstrate actual period controls and mobile layout.

## 11. Rollout Plan

User approved the proposed scope with `진행해` on 2026-09-10. Implement test-first, run full regression/build and browser verification, preserve unrelated changes, and report release status accurately.

## 12. Open Questions

None blocking this approved scope. Snapshot exports and automatic report notifications remain separate future decisions.

## 2026-09-10 Verification / Release Status

- Report tests 14/14; full suite 501/501; web build, mobile:check and README assets passed.
- Synthetic browser checks cover saved-profile delay, timezone week boundaries, week/month navigation, archived periods, leap February, keyboard month input, error/retry, plan callback and 390px light palette under dark preference.
- Independent code review found no remaining Important/Critical issue after the profile gate and cancellation fixes.
- Implemented locally only. Per latest shared instructions, commit/push/deployment await an explicit request. Real signed-in account and native-device flows were not exercised.
