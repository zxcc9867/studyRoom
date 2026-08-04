# PRD: Daily Habit Loop

## 1. Problem

현재 독서실은 출석 마감과 2·4시간 목표를 강하게 보여 주지만, 짧게 다시 시작한 날의 성공을 인정하지 않는다. 세션 종료 때 저장한 `다음 행동`도 내 페이지 회고에만 남아 다음 세션 시작으로 연결되지 않는다.

## 2. Target Users

완벽한 목표 달성보다 매일 다시 앉는 습관을 먼저 만들고 싶은 개인 학습자.

## 3. Goals

- 10분 공부를 오늘 습관의 최소 성공으로 명확히 인정한다.
- 기존 2·4시간 출석 목표와 할 일 완료를 더 높은 성장 단계로 유지한다.
- 가장 최근 회고의 `다음 행동`을 오늘 화면에서 바로 세션 계획으로 이어 간다.
- 출석 판정과 기존 공부 시간 데이터의 의미는 바꾸지 않는다.

## 4. Non-goals

- 출석 `present`/`missed` 정책 변경.
- 새로운 테이블 또는 보상 재화 추가.
- 사용자의 확인 없이 회고 문구를 todo로 자동 저장하거나 세션을 즉시 시작.
- 이번 단계에서 Expo 모바일 화면 변경.

## 5. User Stories

- As a learner, I want a 10-minute start to count as a habit success, so that a difficult day does not become a zero day.
- As a learner, I want to see the next growth milestone, so that I know whether to keep studying or complete one useful task.
- As a learner, I want to reuse my last next action, so that the next session starts without deciding again.

## 6. User Scenarios

### Normal Flow

1. 사용자는 오늘 화면에서 현재 단계를 확인한다.
2. 공부가 10분 미만이면 10분까지 남은 시간을 본다.
3. 10분 이상이면 습관 성공을 확인하고 기존 일일 목표까지 남은 시간을 본다.
4. 일일 목표를 달성하면 오늘 할 일 하나를 완료해 최종 단계를 만든다.
5. 최근 회고에 `다음 행동`이 있으면 최상단 단일 시작 버튼이 `이어서 준비하기`로 바뀌며, 사용자는 그 버튼을 누른다.
6. 같은 제목의 오늘 미완료 todo가 있으면 미리 선택되고, 없으면 빠른 추가 입력에 문구가 채워진다.
7. 카메라·회복 루틴·todo 선택 등 기존 시작 게이트를 모두 통과한 뒤 세션을 시작한다.

### Edge Cases

- 최근 회고가 없거나 `next_action`이 비어 있으면 이어하기 영역을 숨긴다.
- 대소문자·연속 공백만 다른 오늘 todo는 같은 다음 행동으로 인식한다.
- 진행 중이거나 휴식 중인 세션이 있으면 시작 전용 안내를 숨기고 최상단 버튼은 각각 `잠시 쉬기` 또는 `공부 계속하기`를 유지한다.
- 회복 루틴이나 카메라 준비가 필요하면 제안 문구를 잃지 않고 기존 흐름을 계속한다.

### Error Cases

- 최신 회고 조회 실패는 기존 대시보드 오류 경로로 사용자에게 표시한다.
- todo 추가 실패 시 세션 계획 모달을 유지하고 Supabase 오류를 표시한다.

## 7. Functional Requirements

- [x] `0~9분`, `10분 이상`, `일일 목표 달성`, `일일 목표+todo 완료` 상태를 결정적 helper로 계산한다.
- [x] 오늘 화면에 단계·남은 목표·세 가지 milestone을 표시한다.
- [x] 사용자 최신 non-null `next_action` 회고 1건만 조회한다.
- [x] 최상단 단일 시작 액션이 동일 오늘 todo를 미리 선택하거나 빠른 추가 입력을 채운다.
- [x] 기존 카메라·회복·세션 todo 시작 정책을 우회하지 않는다.
- [x] 시작 전용 카드 안내는 비활성 세션에서만 보이며 데스크톱과 모바일 웹에서 overflow 없이 재배치된다.

## 8. Non-functional Requirements

- 성능: `(user_id, created_at desc)` 기존 인덱스로 최신 회고 1건만 조회한다.
- 보안: 기존 user-scoped RLS와 authenticated SELECT 권한을 그대로 사용한다.
- 접근성: 단계 목록과 현재 상태를 텍스트로 제공하고 최상단 단일 버튼에 명확한 이름을 사용한다.
- 확장성: 단계 계산을 React 밖의 순수 helper로 유지한다.
- 유지보수성: 출석 상태와 습관 상태를 별도 개념으로 유지한다.

## 9. Dependencies

- 내부 의존성: `study_sessions`, `study_todos`, `study_session_reflections`.
- 외부 의존성: Supabase PostgREST, React, 기존 Lucide 아이콘.
- Supabase: 기존 테이블·RLS·`study_session_reflections_user_created_idx`; 스키마 변경 없음.
- API: 최신 회고 1건 SELECT.
- 환경 변수: 추가 없음.

## 10. Success Metrics

- 오늘 10분 공부 후 습관 성공 상태가 즉시 표시된다.
- 최신 다음 행동이 있는 사용자는 두 번 이하의 명시적 조작으로 세션 todo를 준비할 수 있다.
- 최상단 단일 시작 액션 사용 시 기존 세션 시작 게이트가 모두 유지된다.
- helper 테스트와 production build가 통과한다.

## 11. Rollout Plan

- 개발: helper와 source-contract 테스트를 먼저 추가하고 Today UI를 연결한다.
- 테스트: 단계 경계값, todo 매칭, 최신 회고 조회 wiring, 반응형 CSS, production build를 확인한다.
- 배포: 사용자가 명시적으로 요청할 때 기존 GitHub Actions/Vercel 경로를 사용한다.
- 모니터링: 최신 회고 조회 오류와 이어하기 todo 추가 오류를 기존 메시지 UI로 확인한다.

## 12. Open Questions

- 습관 단계를 공부의 숲 보상에도 연결할지는 실제 사용 후 결정한다.
- 10분 기준을 사용자별로 조정 가능하게 할지는 후속 데이터로 판단한다.

## 13. 2026-07-21 Update: First Ten-Minute Checkpoint

- [x] 활성 세션에서 오늘 누적 10분까지의 유효 공부시간과 남은 시간을 표시한다.
- [x] 이전 완료 공부가 10분 미만일 때 활성 세션으로 임계점을 넘는 경우에만 완료 카드를 표시한다.
- [x] 휴식·카메라 부재·lease 초과 시간은 기존 active-time 계산을 통해 제외한다.
- [x] `조금 더 이어가기` 확인은 사용자·세션·현지 날짜별 localStorage key에 저장한다.
- [x] `오늘은 마무리`는 기존 todo 완료·회고 종료 모달을 사용한다.
- [x] 출석 2·4시간 정책과 Supabase·Expo 데이터 경로는 변경하지 않는다.

### Success Evidence

- Helper와 source contract 6개, 전체 Node 테스트 300개, TypeScript/Vite production build가 통과한다.
- 실제 Chrome 1440px 완료 상태와 390px 진행·완료 상태에서 콘텐츠 overflow가 없고, 모바일 선택 버튼은 한 열로 재배치되며 콘솔·페이지 오류가 없다.
