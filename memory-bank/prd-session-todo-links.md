# PRD: Session Todo Links

## 1. Problem

The study timer can run without an explicit plan for what the user will study in that session. This weakens the forced-attendance goal because the user can start the timer without committing to a concrete task.

## 2. Target Users

- A logged-in study-room user who manages daily todos and starts focused study sessions.

## 3. Goals

- Require at least one incomplete todo before starting a new study session.
- Let the user choose which of today's incomplete todos belong to the current session.
- Show the selected session todos while the timer is active.
- Let the user mark completed todos when ending the session, not during the middle of the session.
- Record the session-to-todo relationship in Supabase so refreshes and future history can reconstruct what was studied in each session.

## 4. Non-goals

- This MVP does not generate AI study plans.
- This MVP does not split one session's elapsed time across individual todos.
- This MVP does not replace the existing date-based todo checklist.

## 5. User Stories

- As a student, I want to select today's task before the timer starts, so that the study session has a concrete purpose.
- As a student, I want to choose completed tasks when ending the session, so that completion reflects what I actually finished.
- As a student, I want the app to remember which tasks were linked to a session after refresh, so that session history is not lost.

## 6. User Scenarios

### Normal Flow

1. User clicks `입장하고 시작`.
2. App checks camera/recovery gates first.
3. App opens a session-todo selection modal.
4. If today has no incomplete todos, user can quick-add a timed today todo inside the same session modal. The start and end times are saved on the todo so it appears in Today's time schedule.
5. User selects one or more todos. Quick-added todos are selected automatically.
6. App creates a `study_sessions` row, inserts `study_session_todos` link rows, and shows the session task list in Today Focus.

### Edge Cases

- Existing active session: start is still blocked by the existing active-session guard.
- Todo completion at session end: selected todos are marked `study_todos.is_completed = true`, and linked rows for the active session update `completed_during_session`.
- Refresh: the dashboard reloads `study_session_todos` and shows linked todos for the active session.

### Error Cases

- Link insert fails after session creation: the app keeps the session active but shows the link failure message.
- User closes the selection modal after camera was started only for the pending start: camera monitoring is stopped without recording a camera event.

## 7. Functional Requirements

- [x] New `study_session_todos` table links users, sessions, and todos.
- [x] RLS allows users to read/write only their own link rows.
- [x] App blocks a new session when there are no incomplete todos for today.
- [x] App requires selecting at least one incomplete todo before starting.
- [x] App lets the user quick-add a today todo from the session planning modal when no plan was pre-registered.
- [x] Session quick-add collects start and end time and persists the todo as a scheduled item for Today's planner.
- [x] App shows active session linked todos separately from the full daily todo list.
- [x] App opens a completion modal when the user ends a session.
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
- Users can see session-linked todos during study and mark completed work when ending the session without losing the full daily checklist.

## 11. Rollout Plan

- Development: add helper tests, SQL migration test, UI flow, and styles.
- Test: run `npm.cmd test` and `npm.cmd run build`.
- Deploy: apply Supabase migration, push to GitHub, and verify Vercel production deployment.
- Monitoring: check that `study_session_todos` rows are created for new sessions.

## 12. Open Questions

- Should completed session todos later appear in My Page as session-grouped history?
- Should a completed linked todo automatically end the session when all selected todos are done?

## 2026-09-06 - 세션 계획 수정 편의

- 세션 시작 선택 목록 각 행에서 기존 할 일 삭제 기능을 사용할 수 있다.
- 삭제 성공 시 세션 선택 ID, 목표 연결 선택 ID와 로컬 세션 링크에서 해당 할 일을 제거한다. 실패 시 항목을 유지하고 재시도가 가능하다.
- 삭제 중 체크박스와 시작 버튼을 잠가 삭제 요청과 세션 시작이 겹치지 않게 한다. 반복 일정은 기존 전체/당일 삭제 정책을 유지한다.
- 시간 입력칸 클릭 시 showPicker를 강제하지 않는다. 숫자 직접 입력, 시계 아이콘 선택, Enter/Space 선택을 함께 지원한다. 일반 할 일 편집에도 동일하게 적용한다.
