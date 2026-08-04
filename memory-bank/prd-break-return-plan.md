# PRD: Break Return Plan

## 1. Problem

공부 세션을 `잠시 쉬기`로 멈출 수는 있지만 언제 돌아올지 정하지 않으면 식사나 외출이 무기한 휴식으로 길어질 수 있다. 사용자는 세션을 끝내고 싶지 않으면서도 휴식에서 다시 책상으로 돌아오는 명확한 신호가 필요하다.

## 2. Target Users

식사·외출·짧은 휴식 뒤 같은 공부 세션과 할 일로 돌아오고 싶은 웹 사용자.

## 3. Goals

- 휴식 중 10·20·40분 뒤의 복귀 시각을 한 번에 정한다.
- 남은 시간과 약속 시각을 보여 주어 휴식 종료 신호를 명확히 만든다.
- 약속 시간이 지나면 죄책감 대신 즉시 `공부 계속하기`를 선택할 수 있는 상태를 만든다.
- 새로고침 뒤에도 같은 사용자·세션의 복귀 약속을 복원한다.
- 기존 휴식·카메라·세션 lease·공부 시간 계산을 변경하지 않는다.

## 4. Non-goals

- 약속 시간이 되면 세션을 자동 재개하거나 카메라를 자동 활성화하지 않는다.
- 브라우저 알림·소리·이메일·Slack 알림을 새로 보내지 않는다.
- 복귀 약속을 Supabase에 저장하거나 다른 기기와 동기화하지 않는다.
- 휴식 사유를 필수 입력받거나 복귀 지연에 벌점·경고 점수를 부여하지 않는다.
- 세션 lease를 자동 연장하거나 복귀 약속에 맞춰 정지하지 않는다.

## 5. User Stories

- As a learner, I want to choose when I will return before a break drifts, so that I can resume the same session with less deliberation.
- As a learner, I want to see the exact return time and countdown, so that another activity does not erase my study intention.
- As a learner, I want a late return to remain recoverable, so that missing the planned minute does not make me abandon the session.

## 6. User Scenarios

### Normal Flow

1. 사용자가 활성 세션에서 `잠시 쉬기`를 누른다.
2. 기존 휴식 카드에 `10분`, `20분`, `40분` 복귀 약속 선택지가 나타난다.
3. 하나를 누르면 현지 복귀 시각과 남은 시간이 표시된다.
4. 시간이 되면 카드가 `돌아올 시간이 됐어요` 상태로 바뀐다.
5. 사용자는 기존 `공부 계속하기`를 눌러 카메라 준비와 resume RPC를 통과한 뒤 같은 세션을 이어 간다.

### Edge Cases

- 약속을 정한 뒤 `10분 더`를 누르면 현재 시각과 기존 마감 중 늦은 시각을 기준으로 10분 연장한다.
- 약속을 지우면 휴식 자체는 유지되고 프리셋 선택 상태로 돌아간다.
- 복귀 약속이 세션 lease보다 늦으면 세션 유지 시간이 먼저 끝날 수 있음을 안내한다.
- 새로고침 시 사용자 ID·세션 ID가 같은 복귀 약속만 복원한다.
- 세션 재개·종료·교체 시 해당 세션의 로컬 복귀 약속을 제거한다.
- localStorage를 사용할 수 없어도 현재 탭에서는 약속 상태가 동작하고 서버 세션에는 영향이 없다.

### Error Cases

- 잘못된 저장값·시각·시간대는 복귀 약속 없음으로 안전하게 처리한다.
- localStorage 읽기·쓰기·삭제 실패는 휴식·재개 RPC를 막지 않는다.
- resume RPC 또는 카메라 준비 실패 시 기존 휴식 상태와 복귀 약속을 유지한다.

## 7. Functional Requirements

- [x] 10·20·40분 프리셋과 복귀 deadline을 결정적 helper로 계산한다.
- [x] 복귀 예정·복귀 시각 도달·lease 선행 만료 상태를 결정적 helper로 계산한다.
- [x] 사용자·세션별 localStorage key로 deadline을 저장·복원·삭제한다.
- [x] 휴식 카드 안에 프리셋, 약속 시각, 카운트다운, 10분 연장, 약속 지우기를 표시한다.
- [x] 복귀 시간이 되면 비징벌적인 완료 문구를 표시하고 기존 재개 동작을 유지한다.
- [x] 재개 또는 종료 성공 시 복귀 약속을 제거한다.
- [x] 데스크톱과 390px 모바일 웹에서 버튼과 문구가 overflow 없이 재배치된다.
- [x] reduced-motion 사용자는 상태 강조 애니메이션을 보지 않는다.

## 8. Non-functional Requirements

- 성능: 기존 1초 `nowMs` 갱신을 재사용하고 새 interval·네트워크 요청을 추가하지 않는다.
- 보안: 사용자·세션 ID는 localStorage key 범위 지정에만 쓰며 인증 판단에 사용하지 않는다.
- 접근성: 프리셋과 관리 버튼은 실제 `button`을 사용하고 약속 상태를 텍스트로 제공한다.
- 확장성: deadline·storage·상태 계산은 React 밖의 순수 helper로 유지한다.
- 유지보수성: 기존 `pause_study_session`·`resume_study_session`·카메라 재개 흐름을 복제하지 않는다.

## 9. Dependencies

- 내부 의존성: `sessionBreak.mjs`, 활성 세션·lease·카메라 재개 흐름, 기존 1초 시계.
- 외부 의존성: React, 브라우저 localStorage, 기존 Lucide 아이콘.
- Supabase: 기존 휴식 RPC만 사용하며 스키마·RLS·RPC 변경 없음.
- API: 추가 없음.
- 환경 변수: 추가 없음.

## 10. Success Metrics

- 프리셋·연장·마감 경계·storage 실패 helper 테스트가 통과한다.
- 새로고침 뒤 같은 세션의 복귀 약속이 복원된다.
- 재개 실패는 약속을 유지하고 재개 성공은 약속을 제거한다.
- 전체 테스트와 production build가 통과한다.
- 1440px·390px 실제 Chrome에서 예정·도달 상태와 버튼 상호작용에 overflow·콘솔 오류가 없다.

## 11. Rollout Plan

- 개발: helper와 source-contract 실패 테스트를 먼저 추가한 뒤 독립 React 컴포넌트와 Today 화면을 연결한다.
- 테스트: helper 경계, storage 실패, 전체 회귀, build, 실제 Chrome 반응형 상호작용을 확인한다.
- 배포: 사용자가 명시적으로 요청할 때 기존 GitHub Actions/Vercel 경로를 사용한다.
- 모니터링: 실제 사용에서 복귀 약속 선택률, 약속 도달 후 재개 여부, 반복 연장 빈도를 관찰한다.

## 12. Open Questions

- 복귀 시각 알림을 Web Push로 확장할지는 브라우저 내 상태 사용 경험을 먼저 확인한 뒤 결정한다.
- 다른 기기 동기화가 실제로 필요하면 localStorage 대신 별도 break-return 저장 모델을 검토한다.

## 13. Evidence

- Peter M. Gollwitzer의 implementation intention 연구는 목표만 정하는 것보다 미래 상황의 `언제·어디서·어떻게`와 행동을 연결하는 구체적 계획이 시작 문제를 줄일 수 있음을 설명한다: https://prospectivepsych.org/sites/default/files/pictures/Gollwitzer_Implementation-intentions-1999.pdf
- 복귀 약속은 이 원리를 `휴식 마감 시각이 되면 기존 공부 계속하기를 누른다`는 좁은 실행 신호로 적용하며, 자동 실행이나 처벌로 확대하지 않는다.
