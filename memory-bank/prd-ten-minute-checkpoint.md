# PRD: Ten-Minute Study Checkpoint

## 1. Problem

오늘 10분 공부는 이미 습관 성공으로 계산되지만, 사용자는 진행 중에는 남은 시간을 체감하기 어렵고 달성 순간에도 같은 장시간 목표 화면만 본다. 이 때문에 `10분만 시작`이라는 약속이 실제 경험으로 이어지지 않고, 2·4시간을 채우지 못할 날에는 시작 자체를 미룰 수 있다.

## 2. Target Users

공부를 시작하기가 어렵거나 완벽하게 오래 공부하지 못할 것 같으면 하루 전체를 포기하는 개인 학습자.

## 3. Goals

- 진행 중인 유효 공부시간이 오늘 누적 10분을 향해 가는 과정을 실시간으로 보여 준다.
- 오늘 누적 10분을 처음 넘는 활성 세션에서만 체크포인트를 보여 준다.
- 10분 달성 후 `조금 더 이어가기`와 `오늘은 마무리`를 비징벌적인 동등한 선택으로 제공한다.
- 이어가기를 선택한 체크포인트는 같은 사용자·세션·현지 날짜에서 새로고침 후 다시 나타나지 않게 한다.
- 기존 출석 2·4시간 목표, 카메라, 회복 루틴, todo 선택, 휴식, lease, 종료 회고를 그대로 유지한다.

## 4. Non-goals

- 10분을 출석 `present`로 인정하지 않는다.
- 세션을 10분에 자동 종료하거나 자동 일시정지하지 않는다.
- 기존 세션 시작 게이트를 우회하는 별도 빠른 시작 RPC를 만들지 않는다.
- 새 Supabase 테이블·컬럼·RPC·RLS·Edge Function을 추가하지 않는다.
- 이번 단계에서 Expo 모바일 UI를 변경하지 않는다.

## 5. User Stories

- As a learner, I want to see the first ten minutes getting closer, so that starting feels finite.
- As a learner, I want a clear success moment at ten minutes, so that a short study day is not treated as zero.
- As a learner, I want to choose whether to continue or finish, so that the app supports consistency without pressuring me into an all-or-nothing target.

## 6. User Scenarios

### Normal Flow

1. 오늘 완료 공부시간이 10분 미만인 사용자가 기존 절차로 세션을 시작한다.
2. Daily Habit 카드에서 `첫 10분 체크포인트` 진행도와 남은 시간을 본다.
3. 휴식·카메라 제외 시간을 뺀 오늘 유효 공부시간이 누적 10분에 도달한다.
4. 체크포인트가 `오늘의 시작은 이미 성공했어요`로 바뀐다.
5. `조금 더 이어가기`를 누르면 세션은 그대로 진행되고 해당 체크포인트를 확인한 것으로 저장한다.
6. `오늘은 마무리`를 누르면 기존 todo 완료·회고 종료 모달을 연다.

### Edge Cases

- 이전 완료 세션이 8분이면 새 활성 세션의 유효 공부시간 2분 뒤에 체크포인트를 달성한다.
- 오늘 완료 공부시간이 이미 10분 이상이면 이후 세션에서는 체크포인트를 다시 만들지 않는다.
- 새로고침 전에 10분을 넘었더라도 같은 세션에서 확인하지 않았다면 체크포인트를 복원한다.
- 자정을 넘긴 활성 세션은 현재 사용자 현지 날짜에 배분된 시간만 사용한다.
- 휴식·카메라 부재·lease 초과 시간은 체크포인트 진행도에 포함하지 않는다.
- 휴식 중에는 진행도가 멈추고 완료 선택 카드는 재개 후 표시한다.

### Error Cases

- localStorage를 읽거나 쓸 수 없으면 현재 탭 상태만 사용하고 세션 자체에는 영향을 주지 않는다.
- 종료 모달을 취소하면 체크포인트를 유지한다.
- 세션 종료·자동 종료 시 활성 세션이 없어지므로 체크포인트도 숨긴다.

## 7. Functional Requirements

- [x] 오늘 완료 공부시간과 현재 활성 세션의 유효 공부시간으로 10분 진행도를 계산한다.
- [x] 이전 완료 공부시간이 10분 미만이고 활성 세션에서 임계점을 넘을 때만 완료 체크포인트를 표시한다.
- [x] 활성 세션 전 진행도와 남은 시간을 accessible progressbar로 표시한다.
- [x] 완료 카드에 `조금 더 이어가기`와 `오늘은 마무리`를 제공한다.
- [x] 이어가기 확인 상태를 사용자·세션·현지 날짜별 localStorage key로 저장하고 복원한다.
- [x] 오늘은 마무리가 기존 종료 회고 흐름을 사용한다.
- [x] 데스크톱과 모바일 웹에서 overflow 없이 재배치된다.

## 8. Non-functional Requirements

- 성능: 기존 1초 화면 시계와 이미 계산된 오늘·활성 세션 시간만 사용하며 네트워크 요청을 추가하지 않는다.
- 보안: 세션 데이터나 토큰을 localStorage에 추가하지 않고 확인 여부 boolean만 저장한다.
- 접근성: 진행도 값·남은 시간·달성 메시지·두 선택을 텍스트와 ARIA로 전달한다.
- 확장성: 임계점과 표시 조건을 React 밖의 순수 helper로 유지한다.
- 유지보수성: 10분 상수는 기존 `DAILY_HABIT_SEED_SECONDS`를 재사용한다.

## 9. Dependencies

- 내부 의존성: `dailyHabit.mjs`, Today Daily Habit 카드, 기존 종료 회고 모달, 오늘 canonical 공부시간 계산.
- 외부 의존성: React, browser localStorage, 기존 Lucide 아이콘.
- Supabase: 변경 없음.
- API: 추가 없음.
- 환경 변수: 추가 없음.

## 10. Success Metrics

- 0분·9분 59초에는 완료 체크포인트가 나타나지 않고, 활성 세션으로 누적 10분을 넘는 순간 한 번 나타난다.
- 완료 8분과 활성 2분의 조합도 같은 체크포인트를 만든다.
- 이어가기 확인 후 새로고침해도 같은 세션·날짜에서는 다시 나타나지 않는다.
- 오늘 완료 공부가 이미 10분이면 새 세션에서 체크포인트가 나타나지 않는다.
- 전체 테스트, production build, 1440px·390px 실제 Chrome 검증이 통과한다.

## 11. Rollout Plan

- 개발: 순수 helper와 storage 계약 테스트를 먼저 고정하고 Today 카드에 연결한다.
- 테스트: 임계값·부분 누적·휴식·확인 복원·source contract·전체 회귀·build·실제 Chrome을 확인한다.
- 배포: 사용자가 명시적으로 요청할 때 기존 GitHub Actions/Vercel 경로를 사용한다.
- 모니터링: 10분 체크포인트의 이어가기/마무리 선택과 다음날 재시작 여부를 실제 사용에서 관찰한다.

## 12. Open Questions

- 체크포인트 이후 `10분 더` 같은 두 번째 짧은 구간을 제공할지는 실제 이어가기 선택률을 보고 결정한다.
- Expo 모바일에도 같은 UI를 추가할지는 웹 사용성 확인 후 별도 PRD로 진행한다.
