# PRD: Recurring Todos

## 2026-06-16 Update: Editable Scheduled Recurring Todos

- Existing todos in the calendar modal can be edited, not only deleted and recreated.
- A todo row shows saved schedule and repeat metadata when configured.
- Editing a single todo updates only that row.
- Editing a weekly todo updates rows in the same `repeat_group_id`, creates newly selected dates, and removes dates no longer selected.
- Weekly repeat metadata is stored directly on each generated `study_todos` row through `repeat_group_id`, `repeat_mode`, `repeat_weekdays`, and `repeat_until`.
- A separate recurrence-rule table remains out of scope for this MVP.

## 2026-06-14 Update: Overnight Scheduled Todos

- The todo modal supports optional schedule times that cross midnight.
- A schedule such as `23:00` to `01:00` is valid and means the todo starts on the selected local date and ends on the next day.
- `start_time` and `end_time` must still be both null or both set.
- Equal start and end times remain invalid because they represent a zero-length schedule.
- Supabase constraint `study_todos_time_window_check` allows both null or both non-null with `start_time <> end_time`.

## 2026-06-14 추가 요구사항: 선택형 시간 설정

- 할 일 등록 모달은 기존 하루만/요일 반복 선택에 더해 `시간 없음`과 `시간 설정` 선택지를 제공한다.
- `시간 설정`을 선택하면 시작 시간과 종료 시간을 모두 입력해야 하며, 종료 시간은 시작 시간보다 늦어야 한다.
- 시간 정보는 `study_todos.start_time`, `study_todos.end_time`에 저장한다.
- 시간 없는 todo는 두 컬럼을 모두 `null`로 저장한다.
- 같은 날짜와 같은 제목이라도 시간 범위가 다르면 별도 todo로 등록할 수 있다.
- 오늘 할 일, 선택 날짜 할 일, 완료 이력, Slack/WebPush/이메일 알림 본문은 시간 범위가 있으면 `09:00-10:30 제목` 형식으로 표시한다.

## 1. Problem

사용자는 매번 같은 공부 항목을 날짜마다 직접 추가해야 한다. 주중 반복 공부나 특정 요일 루틴을 빠르게 등록할 수 있어야 한다.

## 2. Target Users

개인 MVP 사용자가 주간 공부 루틴을 관리할 때 사용한다.

## 3. Goals

- 캘린더 날짜 모달에서 하루만 등록하거나 요일 반복으로 등록할 수 있다.
- 요일 반복은 시작일, 종료일, 선택 요일을 기준으로 날짜별 `study_todos` 행을 생성한다.
- 기존 알림과 오늘 할 일 화면이 별도 변경 없이 반복 생성된 todo를 읽을 수 있게 한다.

## 4. Non-goals

- 서버가 매주 자동으로 미래 todo를 무한 생성하는 규칙 엔진은 이번 범위에서 제외한다.
- 별도 `todo_recurrence_rules` 테이블은 이번 범위에서 만들지 않는다. 대신 편집 가능한 weekly group metadata만 `study_todos`에 저장한다.

## 5. User Stories

- As a user, I want to add the same todo on selected weekdays, so that weekly study routines are visible on the calendar.
- As a user, I want duplicate title/date rows to be skipped, so that repeated saves do not clutter the same day.

## 6. User Scenarios

### Normal Flow

1. 사용자가 캘린더에서 시작 날짜를 클릭한다.
2. 사용자가 할 일을 입력하고 `요일 반복`을 선택한다.
3. 사용자가 반복 종료일과 요일을 선택한다.
4. 앱은 해당 날짜들에 `study_todos` 행을 생성하고 모달을 닫는다.

### Edge Cases

- 선택 요일이 없거나 종료일이 시작일보다 빠르면 저장하지 않고 안내 메시지를 보여준다.
- 같은 날짜에 같은 제목의 todo가 이미 있으면 해당 날짜는 건너뛴다.

### Error Cases

- Supabase insert 오류가 발생하면 모달을 유지하고 오류 메시지를 보여준다.

## 7. Functional Requirements

* [x] 하루만/요일 반복 저장 모드를 제공한다.
* [x] 반복 종료일을 선택할 수 있다.
* [x] 반복 요일을 다중 선택할 수 있다.
* [x] 반복 날짜를 `study_todos` 행으로 materialize한다.
* [x] 같은 날짜와 같은 제목의 기존 todo는 중복 생성하지 않는다.
* [x] 기존 todo의 제목, 시간, 반복 요일, 반복 종료일을 모달에서 다시 편집할 수 있다.
* [x] weekly 반복 todo는 같은 repeat group 안에서 추가/수정/삭제를 일괄 반영한다.

## 8. Non-functional Requirements

* 성능: 반복 저장은 클라이언트에서 날짜 목록을 계산하고 한 번의 bulk insert로 처리한다.
* 보안: 기존 `study_todos` RLS와 authenticated user insert 정책을 그대로 사용한다.
* 접근성: 반복 모드와 요일 버튼은 `aria-pressed` 상태를 제공한다.
* 확장성: 무한 반복이 필요하면 후속으로 `todo_recurrence_rules`를 추가할 수 있게 순수 함수로 날짜 계산을 분리하고, 현재는 `study_todos`의 repeat group metadata로 편집 가능한 MVP를 유지한다.
* 유지보수성: 반복 날짜 계산은 `todoRecurrence.mjs`에서 테스트한다.

## 9. Dependencies

* 내부 의존성: `apps/web/src/main.tsx`, `apps/web/src/todoRecurrence.mjs`
* 외부 의존성: 없음
* Supabase: `study_todos` 테이블과 repeat metadata columns
* API: Supabase Data API insert/select
* 환경 변수: 기존 Supabase Vite 환경 변수

## 10. Success Metrics

* 사용자가 선택 요일의 날짜들에 todo를 한 번에 만들 수 있다.
* 알림 본문과 오늘 할 일 화면이 생성된 날짜별 todo를 그대로 표시한다.

## 11. Rollout Plan

* 개발: 순수 함수 테스트 후 UI 연결
* 테스트: `npm.cmd test`, `npm.cmd run build`
* 배포: GitHub/Vercel production pipeline
* 모니터링: 반복 저장 후 `study_todos` row 생성 여부와 알림 본문 포함 여부 확인

## 12. Open Questions

* 장기적으로 별도 반복 규칙 테이블을 만들고 매월/매주 서버에서 자동 생성할지 여부
