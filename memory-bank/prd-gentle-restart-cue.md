# PRD: Gentle Restart Cue

## 1. Problem

최근 7일 중 5번 시작하는 유연 목표는 이틀의 휴식을 허용하지만, 실제로 하루를 쉰 다음 앱을 열면 오늘 안내가 일반적인 `10분 시작 준비`로 돌아간다. 이미 한 번 시작해 본 사용자는 기록이 끊겼다는 인상을 받을 수 있고, 쉬었던 하루를 실패가 아니라 다시 잇는 지점으로 받아들이기 어렵다.

## 2. Target Users

최근 7일 안에 10분 공부를 시작한 적이 있으나 어제는 쉬었고, 아직 5번 시작 목표를 채우지 못한 개인 학습자.

## 3. Goals

- 휴식 다음 날을 실패 복구가 아닌 숲길을 다시 잇는 날로 안내한다.
- 오늘의 최소 행동을 10분으로 유지해 재시작 마찰을 낮춘다.
- 새 CTA 없이 기존 최상단 단일 시작 액션에 복귀 문맥을 전달한다.
- 5/7 목표를 이미 달성한 사용자의 선택 가능한 휴식은 그대로 보호한다.

## 4. Non-goals

- 출석, 결석, 연속일, 일일 공부 목표 또는 10분 성공 기준 변경.
- 하루 휴식에 대한 감점, 경고색, 보상 회수 또는 죄책감 유발 문구.
- 자동 세션 시작, 자동 todo 생성 또는 두 번째 시작 버튼 추가.
- Supabase 스키마·RPC·RLS·Edge Function, 새 네트워크 요청, 타이머, localStorage 또는 Expo 변경.

## 5. User Stories

- As a learner returning after a rest day, I want the app to recognize that I am reconnecting, so that one missed day does not feel like starting from zero.
- As a learner, I want the same start button to offer a ten-minute restart, so that I can act without choosing between duplicate controls.
- As a learner who already completed five starts, I want rest guidance to remain optional, so that success does not create more pressure.

## 6. User Scenarios

### Normal Flow

1. 사용자는 최근 7일의 더 이른 날에 한 번 이상 10분 시작을 완료한다.
2. 어제와 오늘은 아직 10분 시작을 완료하지 않았고 5/7 목표도 미달이다.
3. 앱은 기존 주간 목표 표지판에 `다시 잇는 날`을 표시한다.
4. 활성 세션이 없고 회고 다음 행동이 없다면 최상단 단일 시작 버튼은 `10분으로 다시 잇기`가 된다.
5. 사용자는 기존 회복·카메라·todo 선택 게이트를 거쳐 직접 세션을 시작한다.

### Edge Cases

- 최근 7일에 성공 기록이 전혀 없으면 기존 첫 시작 안내를 유지한다.
- 어제 10분 시작에 성공했다면 기존 연속 시작 안내를 유지한다.
- 오늘 이미 10분을 채웠다면 복귀 신호를 종료하고 기존 다음 단계 안내를 사용한다.
- 5/7 목표를 달성했다면 복귀 신호 대신 선택 가능한 휴식 안내를 유지한다.
- 최근 회고의 다음 행동이 있으면 기존 우선순위에 따라 최상단 버튼은 `이어서 준비하기`를 유지하되, 주간 카드의 비대화형 복귀 문맥은 표시할 수 있다.
- 활성 또는 휴식 세션에서는 최상단 버튼이 기존 Pause 또는 Resume 동작을 유지하고 시작 전 안내를 숨긴다.

### Error Cases

- 잘못된 세션과 날짜 데이터는 기존 주간 습관 정규화 규칙으로 제외한다.
- 세션 시작 실패는 기존 대시보드 오류 메시지와 재시도 흐름을 사용한다.

## 7. Functional Requirements

- [x] 오늘과 어제가 10분 미만이고 더 이른 7일 구간에 성공이 있으며 목표 미달일 때만 `isGentleRestart`를 계산한다.
- [x] 복귀 상태의 코칭 제목은 `다시 잇는 날`, 설명은 어제의 휴식을 실패로 규정하지 않고 오늘 10분을 제안한다.
- [x] 복귀 상태의 주간 primary label은 `10분으로 다시 잇기`다.
- [x] 기존 목표 표지판에 접근 가능한 비대화형 복귀 신호를 표시한다.
- [x] 회고 다음 행동, Pause·Resume·End와 기존 세션 시작 게이트의 우선순위를 보존한다.
- [x] 처음 시작·연속 시작·목표 달성 후 휴식 상태에는 복귀 신호를 표시하지 않는다.

## 8. Non-functional Requirements

- 성능: 기존 7일 배열을 한 번 더 순회하는 O(7) 계산만 허용하고 요청을 추가하지 않는다.
- 보안: 기존 사용자별 로드 데이터만 사용하며 새 읽기·쓰기 권한을 만들지 않는다.
- 접근성: 텍스트로 복귀 상태를 전달하고 색상만으로 구분하지 않는다.
- 확장성: 복귀 여부 계산은 React 밖의 결정적 helper 결과에 포함한다.
- 유지보수성: 기존 `getStudyStartAction()`과 `startTimer()` 경로를 재사용한다.

## 9. Dependencies

- 내부 의존성: `weeklyHabit.mjs`, `dailyHabit.mjs`, 기존 Today 주간 숲길과 최상단 세션 제어.
- 외부 의존성: 기존 React와 Lucide 아이콘.
- Supabase: 변경 없음.
- API: 추가 없음.
- 환경 변수: 추가 없음.

## 10. Success Metrics

- 복귀·첫 시작·연속 시작·목표 달성 후 휴식 fixture가 각각 정확한 상태와 문구를 반환한다.
- Today에 persistent start CTA가 정확히 하나만 남는다.
- 1440px와 390px에서 복귀 표지판이 읽히고 가로 overflow가 없다.
- 전체 테스트와 production build가 통과한다.

## 11. Rollout Plan

- 개발: helper 실패 테스트를 먼저 추가한 뒤 타입, React, 스타일을 연결한다.
- 테스트: 집중 Node 테스트, 전체 테스트, production build, 실제 Chromium 데스크톱·모바일 검증을 수행한다.
- 배포: 사용자가 명시적으로 요청할 때 기존 GitHub Actions/Vercel 경로를 사용한다.
- 모니터링: 복귀 안내 이후 10분 시작 전환과 5/7 달성 변화를 관찰한다.

## 12. Open Questions

- 장기간 쉬었다 돌아온 사용자를 위한 별도 문구가 필요한지는 실제 사용 데이터를 본 뒤 결정한다.

## 13. Verification Evidence

### 2026-07-21

- 구현 전 새 테스트 3개가 실패했고 구현 후 주간 습관·단일 시작 집중 테스트 17개가 통과했다.
- 전체 Node 테스트 329개와 production build가 통과했다.
- 실제 Chromium 1440×1000과 390×844에서 복귀 안내, 단일 시작 버튼, 5개 씨앗, 가로 overflow 0을 확인했다.
- 비복귀 fixture에서는 복귀 신호가 없고 기존 `10분 시작 준비`가 유지됐다.
- 회고 우선 fixture에서는 `이어서 준비하기`가 최상단 버튼으로 유지되고 `10분으로 다시 잇기` 버튼은 추가되지 않았다.
- 최종 fixture의 console warning/error와 page error는 모두 0건이었다.
- Supabase 요청은 모두 브라우저 route로 격리했으며 원격 데이터나 설정을 변경하지 않았다.
