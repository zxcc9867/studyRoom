# PRD: Study Goals

## 1. Problem

사용자는 매일 공부 시간을 확인할 수 있지만, 시험일이나 자격증 마감일처럼 장기 목표까지 남은 시간을 한눈에 보기 어렵다. 목표와 관련된 할 일을 따로 관리하면 오늘 공부가 장기 목표에 어떻게 연결되는지 약해진다.

## 2. Target Users

- 독서실 앱으로 매일 공부 습관을 만들고 싶은 개인 사용자
- 시험, 자격증, 프로젝트 마감일처럼 날짜가 정해진 목표를 준비하는 사용자

## 3. Goals

- 사용자가 목표명과 목표 날짜를 설정할 수 있다.
- 목표 진행률은 연결된 todo 완료율을 기준으로 표시한다.
- 대표 활성 목표의 D-day를 대시보드 상단에서 바로 볼 수 있다.
- 목표와 기존 todo를 연결하고, 목표별 완료율을 확인할 수 있다.
- 목표 목록 페이지에서 목표를 생성, 편집, 완료, 삭제할 수 있다.

## 4. Non-goals

- 목표별 서버 알림 분리
- 목표 공유 또는 그룹 목표
- Google Calendar 양방향 동기화
- 목표별 세부 통계 리포트

## 5. User Stories

- As a student, I want to register an exam date, so that I can see D-day every time I open the study room app.
- As a student, I want to link todos to a goal, so that daily tasks contribute to a larger target.
- As a student, I want to mark a goal completed, so that finished targets no longer dominate the dashboard.

## 6. User Scenarios

### Normal Flow

1. 사용자가 사이드바의 `목표` 페이지로 이동한다.
2. `새 목표`를 눌러 목표명과 목표 날짜를 입력한다.
3. 관련 todo를 선택해 목표와 연결한다.
4. 대시보드 상단에서 대표 목표의 D-day와 진행률을 확인한다.
5. 목표가 끝나면 `완료`로 표시한다.

### Edge Cases

- 연결된 todo가 없으면 진행률은 0%로 표시하고, 연결된 할 일이 없다는 안내를 보여준다.
- 목표 날짜가 지나면 `D+N`으로 표시한다.

### Error Cases

- 목표명이 비어 있으면 저장하지 않는다.
- 목표 날짜가 비어 있으면 저장하지 않는다.
- Supabase 저장 실패 시 앱 메시지 영역에 오류를 표시한다.

## 7. Functional Requirements

- [x] `study_goals` 테이블을 추가한다.
- [x] 목표 데이터는 RLS로 본인만 접근할 수 있어야 한다.
- [x] `study_todos.goal_id`로 todo와 목표를 연결할 수 있어야 한다.
- [x] 대시보드 상단에 활성 목표 D-day 카드를 표시한다.
- [x] 목표 페이지를 hash route `#goals`로 제공한다.
- [x] 목표 생성/수정 모달에서 연결할 todo를 선택할 수 있어야 한다.
- [x] 목표 카드는 D-day, 진행률, 연결 todo 수를 표시한다.

## 8. Non-functional Requirements

- 성능: 목표와 todo는 기존 대시보드 로딩에서 함께 조회한다.
- 보안: 목표 행은 `auth.uid()` 기준 RLS로 격리한다.
- 접근성: 목표 생성/수정은 dialog 역할과 명확한 버튼 라벨을 사용한다.
- 확장성: 목표별 알림이나 목표별 통계를 추가할 수 있도록 `study_goals`를 별도 테이블로 둔다.
- 유지보수성: D-day와 진행률 계산은 `studyGoals.mjs` helper로 분리한다.

## 9. Dependencies

- 내부 의존성:
  - `apps/web/src/main.tsx`
  - `apps/web/src/studyGoals.mjs`
  - `apps/web/src/dashboardRoute.mjs`
- 외부 의존성:
  - Supabase Database
- Supabase:
  - `public.study_goals`
  - `public.study_todos.goal_id`
- API:
  - Supabase Data API 직접 insert/update/delete/select
- 환경 변수:
  - 기존 Supabase URL/anon key 사용

## 10. Success Metrics

- 목표 생성 후 새로고침해도 목표가 유지된다.
- D-day가 목표 날짜 기준으로 정확히 표시된다.
- 목표에 연결한 todo 완료 상태가 목표 진행률에 반영된다.
- 다른 사용자의 목표는 조회/수정할 수 없다.

## 11. Rollout Plan

- 개발: helper와 SQL migration 테스트 작성 후 UI 구현
- 테스트: `npm.cmd test`, `npm.cmd run build`
- 배포: Supabase migration 적용 후 Vercel production 배포
- 모니터링: 목표 저장/조회 오류와 Vercel production 200 응답 확인

## 12. Open Questions

- 목표별 알림을 별도로 둘지 여부
- 목표별 공부 세션을 수동으로 태깅할지 여부
- 완료 목표를 My Page 이력에 통합할지 여부
