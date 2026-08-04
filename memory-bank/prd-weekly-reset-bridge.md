# PRD: Weekly Reset Bridge

## 1. Problem

주간 리뷰는 공부 시간, 출석, 할 일 완료율과 세션 회고의 `다음 행동`을 보여 주지만, 사용자가 그 문장을 실제 날짜와 시간에 배치하려면 다시 Today 플래너로 이동해 같은 내용을 입력해야 한다. 회고가 읽기에서 끝나면 다음 공부를 시작하기 위한 구체적인 실행 신호가 만들어지지 않는다.

## 2. Target Users

- 세션 종료 회고에 다음 행동을 남기는 웹 사용자
- 한 주의 결과를 확인한 직후 다음 공부 계획을 잡고 싶은 사용자
- 같은 할 일을 중복 등록하지 않고 기존 계획을 확인·수정하려는 사용자

## 3. Goals

- 주간 리뷰의 각 다음 행동을 기존 todo 작성 모달에 한 번에 옮긴다.
- 기존 미완료 todo와 제목이 같으면 중복 추가 대신 예정 날짜를 보여 주고 기존 계획을 연다.
- 사용자가 저장하기 전에는 서버 데이터를 변경하지 않는다.
- 회고 → 날짜·시간 지정 → 기존 플래너 저장의 연결을 한 화면 안에서 완성한다.

## 4. Non-goals

- 다음 행동을 자동으로 todo로 저장하지 않는다.
- 날짜나 시간을 시스템이 강제로 결정하지 않는다.
- 새 Supabase 테이블·컬럼·RPC·RLS 정책을 추가하지 않는다.
- 주간 리뷰 계산, 출석 상태, 공부 시간 또는 5/7 습관 목표를 변경하지 않는다.
- Expo 모바일 UI를 이번 범위에서 변경하지 않는다.

## 5. User Stories

- As a learner, I want to turn a reflection action into a concrete plan without retyping it, so that my review leads to the next study session.
- As a learner, I want to see when the same unfinished action is already planned, so that I do not create duplicates.
- As a learner, I want to review and edit the existing plan, so that I can move its date or time when circumstances change.

## 6. User Scenarios

### Normal Flow

1. 사용자가 내 페이지의 이번 주 학습 리뷰를 연다.
2. `다음 공부로 이어가기` 영역에서 회고의 다음 행동을 확인한다.
3. `계획에 넣기`를 누르면 오늘 날짜와 해당 문장이 미리 입력된 기존 todo 모달이 열린다.
4. 사용자가 날짜·시간·반복·목표 연결을 조정하고 기존 저장 버튼을 누른다.
5. 저장된 미완료 todo는 이후 리뷰에서 `계획됨` 날짜와 `계획 보기`로 표시된다.

### Edge Cases

- 앞뒤·연속 공백과 대소문자만 다른 미완료 todo는 같은 계획으로 본다.
- 같은 제목의 완료 todo만 있으면 새 계획을 만들 수 있다.
- 잘못된 날짜를 가진 기존 todo는 날짜 배지를 표시하지 않되 계획됨 상태는 유지한다.
- 주간 다음 행동이 없으면 회고 작성 안내만 표시한다.
- 최대 세 개의 기존 다음 행동 제한을 유지한다.

### Error Cases

- todo 저장 실패는 기존 모달 오류 흐름을 사용하고 리뷰 데이터는 바꾸지 않는다.
- 콜백이 없는 렌더링 환경에서도 리뷰 지표와 다음 행동 문장은 그대로 읽을 수 있다.

## 7. Functional Requirements

- [x] 다음 행동을 공백 정규화·대소문자 무시 방식으로 미완료 todo와 매칭한다.
- [x] 각 다음 행동에 미계획·계획됨 상태와 기존 todo ID·날짜를 결정적으로 계산한다.
- [x] 미계획 행동의 `계획에 넣기`가 오늘 날짜의 기존 todo 모달을 제목 prefill 상태로 연다.
- [x] 계획된 행동의 날짜를 표시하고 `계획 보기`가 기존 todo 편집 모달을 연다.
- [x] 저장 전에는 Supabase write를 호출하지 않는다.
- [x] 다음 행동이 없을 때 기존 회고 안내를 유지한다.
- [x] 390px 모바일 웹에서 문장과 버튼이 한 열로 배치되고 가로 overflow가 없다.
- [x] 버튼은 실제 `button`과 문맥을 포함한 접근 가능한 이름을 사용한다.

## 8. Non-functional Requirements

- 성능: 이미 메모리에 있는 최대 세 개 다음 행동과 todo 배열만 비교하며 새 query를 만들지 않는다.
- 보안: 데이터 저장은 기존 인증·RLS가 적용된 `saveTodo`·편집 흐름만 사용한다.
- 접근성: 계획 상태를 색상뿐 아니라 날짜·문구로 전달하고 키보드로 모든 동작을 실행할 수 있다.
- 확장성: 매칭과 표시 상태는 React 밖의 순수 helper로 유지한다.
- 유지보수성: 새로운 todo 작성 폼이나 저장 로직을 복제하지 않는다.

## 9. Dependencies

- 내부 의존성: `weeklyReview.mjs`, `WeeklyReviewSection.tsx`, 기존 todo 모달 초기화·편집 흐름.
- 외부 의존성: React, Lucide React, 기존 Supabase `study_todos` API.
- Supabase: 기존 `study_todos`와 RLS만 재사용하며 변경 없음.
- API: 추가 없음.
- 환경 변수: 추가 없음.

## 10. Success Metrics

- 다음 행동 매칭·완료 todo 제외·날짜 표시 helper 테스트가 통과한다.
- `계획에 넣기`가 문장을 다시 입력하지 않고 todo 모달을 연다.
- 기존 계획은 중복 생성 CTA 대신 편집 CTA를 제공한다.
- 전체 테스트와 production build가 통과한다.
- 1440px·390px 실제 Chrome에서 미계획·계획됨 상호작용과 overflow·브라우저 오류를 검증한다.

## 11. Rollout Plan

- 개발: PRD와 실패 테스트 후 순수 helper, 리뷰 UI, main callback 순서로 구현한다.
- 테스트: helper 경계, source contract, 전체 회귀, build, 실제 Chrome 반응형 상호작용을 확인한다.
- 배포: 사용자가 명시적으로 요청할 때 기존 GitHub Actions/Vercel 경로를 사용한다.
- 모니터링: 다음 행동별 `계획에 넣기` 사용률과 계획 후 실제 세션 시작 여부는 별도 분석 요구가 생길 때 검토한다.

## 12. Open Questions

- 실제 사용에서 오늘 prefill보다 다음 학습 가능일 추천이 필요한지 관찰한다.
- 다음 행동 계획 완료율을 주간 리뷰에 표시할지는 데이터 사용 경험을 먼저 확인한다.

## 13. Evidence

- Implementation-intention 연구는 목표 행동에 구체적인 상황·시간 신호를 연결하면 의도를 행동으로 옮기는 데 도움이 될 수 있음을 보고한다.
- 이 기능은 회고 문장을 자동 저장하지 않고 기존 날짜·시간 모달로 옮겨 사용자가 구체적인 실행 계획을 확정하도록 돕는 좁은 적용이다.
- 구현 전 helper export 부재 RED를 확인한 뒤 집중 테스트 3개와 전체 Node 테스트 309개가 통과했다.
- TypeScript/Vite production build가 통과했다.
- 실제 Chrome 1440px에서 새 계획·기존 계획 callback과 제목 prefill, `07.24 · 계획됨`, 문서·카드 overflow 없음이 확인됐다.
- 실제 Chrome 390px에서 액션 행은 두 열, 버튼은 전체 너비 행으로 재배치되고 가로 overflow가 없었다.
- 최종 브라우저 시나리오의 console error와 page error는 모두 0건이었다.
