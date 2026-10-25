## 2026-09-21 승인 개정

아래 기존 MVP의 할 일별 시간 배분 비목표는 신규 기능 이후 측정 구간에 한해 [실제 공부와 계획 PRD](prd-actual-study-plan.md)로 대체한다. 과거 세션 시간을 임의 배분하지 않는다. 여러 할 일을 연결하되 현재 집중할 일은 하나이며, 새 웹 시작 흐름은 세션/연결/일정 조정을 원자적으로 확정한다. 제목만 있는 할 일도 시작 가능하고 시간 입력은 선택이다. 기존 API는 호환 유지한다.

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

## 2026-10-24 - 세션 할 일 시간 재편집

- 사용자가 승인한 범위: 선택 목록 각 행의 `시간 편집`으로 기존 시작/종료를 불러오고 `시간 저장`/`취소`를 제공한다. 새 할 일 입력과 편집 초안은 분리한다.
- 인증된 기존 Data API/RLS로 클릭한 할 일 한 건의 `start_time`/`end_time`만 갱신한다. 제목·날짜·목표·반복 그룹/다른 날짜·선택 상태·과거 공부 구간은 변경하지 않는다. 기존 원래 계획 snapshot/미지정 첫 시간 지정 및 향후 알림 정리는 기존 DB 트리거를 따른다.
- 취소·입력 오류·서버 오류는 기존 저장값을 유지한다. 빈 응답/네트워크 예외는 성공으로 처리하지 않고 초안을 남겨 재시도를 제공한다. 동일 시작/종료는 기존 시간 검증으로 차단하고 자정 넘김은 지원한다.
- 편집 중 삭제·세션 시작을 막고, 저장 중 중복 요청/입력/모달 닫기를 막는다. 계정 변경 시 초안을 버리고 이전 응답을 새 계정 UI에 적용하지 않는다. 저장/취소 후 포커스를 해당 편집 버튼으로 돌린다.
- 375px/1440px·44px 조작 영역·명도 대비·키보드·실제 Android hosted WebView를 확인한다. 공통 웹 배포로 반영하며 APK/DB migration/인증·출석 정책 변경은 없다.

## 2026-10-25 - 시간 저장 무응답 복구

- 시간 수정 요청과 결과 확인 조회는 기존 `runBoundedRequest`의 15초 제한 및 AbortSignal을 사용한다. 응답이 없더라도 저장 중 상태가 영구 유지되지 않는다.
- 쓰기 응답 누락·오류·네트워크 예외는 곧바로 재전송하지 않는다. 동일 소유자의 해당 할 일 한 건을 다시 읽고 `HH:MM`과 서버의 `HH:MM:SS`를 정규화해 확인한다. 입력한 두 시간이 이미 저장돼 있으면 추가 UPDATE 없이 성공 처리한다.
- 결과 확인도 실패하거나 응답이 없으면 초안을 유지하고 `다시 확인`을 제공한다. 이 동작은 조회만 수행한다. 취소하거나 선택창을 닫았다 다시 편집해도 같은 문서·계정에서는 미확인 의도를 기억해 중복 UPDATE를 차단한다.
- 조회가 성공해 실제 저장값이 입력과 다름을 확인하면 서버값을 표시 목록에 반영하고 초안은 유지하며 `다시 저장`을 제공한다. 새 쓰기는 사용자의 명시적인 선택으로만 수행하며 자동 재전송하지 않는다.
- 최초 쓰기 중에는 기존 중복 저장·닫기·시작 잠금을 유지한다. 15초 후 결과 확인 단계에서는 편집 취소·선택창 닫기를 즉시 허용한다. 확인 조회 자체도 최대 15초 후 잠금을 해제한다. 계정 변경·화면 종료·확인 취소 뒤 늦은 응답은 현재 화면을 변경하지 않는다.
- 변경은 클릭한 발생분의 두 시간 필드에만 한정하며 반복 그룹·선택·학습/회고 기록·DB/권한/APK는 유지한다. 단, 네트워크 취소는 서버에서 이미 수행한 저장을 되돌리는 기능이 아니며 전체 페이지 재시작 이후에는 기존 서버 저장값을 기준으로 편집한다.
