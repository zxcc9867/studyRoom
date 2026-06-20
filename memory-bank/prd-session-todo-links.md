# PRD: Session Todo Links

## 1. Problem

The study timer can run without an explicit plan for what the user will study in that session. This weakens the forced-attendance goal because the user can start the timer without committing to a concrete task.

## 2. Target Users

- A logged-in study-room user who manages daily todos and starts focused study sessions.

## 3. Goals

- Require at least one incomplete todo before starting a new study session.
- Let the user choose which of today's incomplete todos belong to the current session.
- Show the selected session todos while the timer is active.
- Record the session-to-todo relationship in Supabase so refreshes and future history can reconstruct what was studied in each session.

## 4. Non-goals

- This MVP does not generate AI study plans.
- This MVP does not split one session's elapsed time across individual todos.
- This MVP does not replace the existing date-based todo checklist.

## 5. User Stories

- As a student, I want to select today's task before the timer starts, so that the study session has a concrete purpose.
- As a student, I want to check off session tasks while studying, so that I can see progress inside the current session.
- As a student, I want the app to remember which tasks were linked to a session after refresh, so that session history is not lost.

## 6. User Scenarios

### Normal Flow

1. User clicks `입장하고 시작`.
2. App checks camera/recovery gates first.
3. If today has no incomplete todos, app opens today's todo modal and asks the user to add one.
4. If incomplete todos exist, app opens a session-todo selection modal.
5. User selects one or more todos.
6. App creates a `study_sessions` row, inserts `study_session_todos` link rows, and shows the session task list in Today Focus.

### Edge Cases

- Existing active session: start is still blocked by the existing active-session guard.
- Todo checked during an active linked session: `study_todos.is_completed` and the link's `completed_during_session` are updated together.
- Refresh: the dashboard reloads `study_session_todos` and shows linked todos for the active session.

### Error Cases

- Link insert fails after session creation: the app keeps the session active but shows the link failure message.
- User closes the selection modal after camera was started only for the pending start: camera monitoring is stopped without recording a camera event.

## 7. Functional Requirements

- [x] New `study_session_todos` table links users, sessions, and todos.
- [x] RLS allows users to read/write only their own link rows.
- [x] App blocks a new session when there are no incomplete todos for today.
- [x] App requires selecting at least one incomplete todo before starting.
- [x] App shows active session linked todos separately from the full daily todo list.
- [x] App records whether a linked todo was completed during the session.

## 8. Non-functional Requirements

- Performance: dashboard loads link rows with the existing dashboard data batch.
- Security: composite user-scoped foreign keys and RLS prevent cross-user session/todo links.
- Accessibility: modal uses a dialog role and native checkbox inputs.
- Maintainability: pure selection/link logic lives in `sessionTodoLinks.mjs`.

## 9. Dependencies

- Internal: `study_sessions`, `study_todos`, camera gate, recovery gate.
- Supabase: `study_session_todos` table, RLS policies, authenticated grants.
- API: Supabase Data API for select/insert/update.

## 10. Success Metrics

- Every new study session from the web app has at least one linked todo.
- Users can see and complete session-linked todos without losing the full daily checklist.

## 11. Rollout Plan

- Development: add helper tests, SQL migration test, UI flow, and styles.
- Test: run `npm.cmd test` and `npm.cmd run build`.
- Deploy: apply Supabase migration, push to GitHub, and verify Vercel production deployment.
- Monitoring: check that `study_session_todos` rows are created for new sessions.

## 12. Open Questions

- Should completed session todos later appear in My Page as session-grouped history?
- Should a completed linked todo automatically end the session when all selected todos are done?
