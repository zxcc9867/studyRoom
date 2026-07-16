# PRD: Session Activity Heartbeat

## 1. Problem

Active study sessions are restored from Supabase after browser or computer restart. This keeps the login session usable, but it can make study time continue while the browser or computer was off.

## 2. Target Users

Users who study through the web app and expect authentication persistence to be separate from counted study time.

## 3. Goals

- Keep the Supabase browser auth session persistent.
- Stop counting study time when the browser or computer has been inactive for longer than a short grace period.
- Preserve tab-switch and quick-refresh behavior so normal browser navigation does not end a study session.

## 4. Non-goals

- Do not add a server-side heartbeat table in this MVP.
- Do not end sessions merely because the tab became hidden.
- Do not add a dedicated server-side heartbeat table in this MVP. The separate session lease is now a 1-hour server-backed keep-alive deadline.

## 5. User Stories

- As a user, I want to stay logged in after reopening the app so I do not have to authenticate every refresh.
- As a user, I want study time to exclude time while my browser or computer was closed.
- As a user, I want switching to another tab to continue counting as study time.

## 6. Functional Requirements

- Store a per-user/per-study-session activity timestamp in browser localStorage.
- Refresh the activity timestamp while an active session is open.
- On restoring an active session, if the stored activity timestamp is older than the inactivity grace, call end_study_session and pass the inactive seconds as excluded time.
- Update activity when a hidden tab becomes visible so tab switching does not look like a closed browser.
- Clear activity storage after manual or automatic session end.
- If `end_study_session` says `Active study session not found`, refresh dashboard state and clear local activity/lease state because the browser is holding a stale active session.

## 7. Non-functional Requirements

- Privacy: no additional server-side tracking or media storage.
- Reliability: keep existing lease and camera absence exclusions additive.
- Compatibility: work in the static Vite app without adding a backend route.

## 8. Dependencies

- Browser localStorage.
- Existing Supabase RPC end_study_session(p_session_id, p_excluded_seconds).

## 9. Success Metrics

- Closing the browser for longer than the grace period no longer adds that closed time to saved duration.
- Refreshing quickly or switching tabs does not end the session.
- Full app tests and production build pass.

## 10. Open Questions

- A future server-side heartbeat could enforce this across browsers/devices, but it is outside this MVP.

## 2026-06-28 Addendum: 1-hour server-backed session lease

- Default active study session lease is now 1 hour, not 2 hours.
- New sessions store `study_sessions.lease_expires_at = now() + interval '1 hour'`.
- The web app prefers the server deadline and keeps browser localStorage only as a compatibility fallback.
- Five minutes before `lease_expires_at`, `attendance-cron` sends a Slack warning with a `1시간 연장` button.
- The Slack button and in-app `세션 유지` button both call `extend_study_session_lease(p_session_id, 60)`.
- `lease_warning_sent_at` prevents duplicate session-expiry warnings for the same lease window and is cleared when the lease is extended.
## 2026-06-30 Addendum: Open dashboard lease synchronization

- Slack session-extension buttons update the server-side active `study_sessions.lease_expires_at` value outside the browser.
- The open web dashboard must not require a full page refresh to observe that update.
- While an active session exists, the app refreshes the current active session row every 15 seconds and whenever the browser window regains focus or returns to visible state.
- The refresh is intentionally narrow: it reads only the active `study_sessions` row and updates local `studySessions` state, letting the existing lease countdown effect derive the new remaining time.
- This is a client sync path only; no Supabase schema, Cron, or Edge Function change is required.

## 2026-07-16 Addendum: Two-hour maximum remaining lease

- A keep-alive action still requests a 60-minute extension.
- The resulting `lease_expires_at` must never exceed the current server time plus 2 hours.
- Example: 30 minutes remaining becomes 90 minutes; 90 minutes remaining becomes 120 minutes, not 150 minutes.
- The cap is enforced inside `extend_study_session_lease`, so web and Slack use the same rule.
- The web fallback helper mirrors the server calculation but is not the authority.
- `public` and `anon` cannot execute the `SECURITY DEFINER` extension RPC; `authenticated` and `service_role` remain allowed.
- The UI and Slack copy must state that the extension is up to a maximum of 2 hours remaining.
