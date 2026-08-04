# PRD: Weekly Habit Rhythm

## 1. Problem

오늘의 습관 카드는 지금 무엇을 하면 되는지는 알려 주지만, 공부가 며칠 동안 얼마나 꾸준히 이어졌는지는 보여 주지 않는다. 총 공부 시간만 비교하면 긴 하루 한 번이 짧은 시작을 여러 날 반복한 것보다 더 중요해 보여, 매일 다시 앉는 습관을 만들기 어렵다.

## 2. Target Users

완벽한 장시간 공부보다 작은 시작을 여러 날 반복해 안정적인 공부 리듬을 만들고 싶은 개인 학습자.

## 3. Goals

- 오늘을 포함한 최근 7일의 시작 성공을 한눈에 보여 준다.
- 10분 시작, 기존 일일 목표, 오늘 할 일 완료를 날짜별 성장 단계로 구분한다.
- 오늘이 아직 진행 중이면 어제까지 이어진 연속 시작을 실패로 끊지 않는다.
- 죄책감이나 감점 대신 다음 한 번의 작은 행동을 안내한다.
- 기존에 로드한 세션과 할 일만 사용해 Supabase 요청 부하를 늘리지 않는다.

## 4. Non-goals

- 출석 `present`/`missed` 판정 또는 평일 2시간·주말 4시간 목표 변경.
- 주간 순위, 벌점, 경쟁형 스트릭 또는 보상 재화 추가.
- 새로운 Supabase 테이블, RPC, 인덱스 또는 스케줄 작업 추가.
- 이번 단계에서 Expo 모바일 화면 변경.

## 5. User Stories

- As a learner, I want to see how many of the last seven days I started for ten minutes, so that I value consistency rather than one long session.
- As a learner, I want today to remain in progress until I have a chance to study, so that opening the app early does not feel like a failure.
- As a learner, I want one gentle next-step message, so that the review leads directly to action.

## 6. User Scenarios

### Normal Flow

1. 사용자는 Today 화면에서 오늘 습관 카드 아래의 최근 7일 숲길을 확인한다.
2. 각 날짜는 `쉼`, `10분`, `목표`, `꽃` 중 하나의 텍스트 단계로 표시된다.
3. 요약에서 시작 성공 일수, 이어온 시작, 목표 달성 일수를 확인한다.
4. 오늘 10분을 채우지 못했다면 문맥이 반영된 최상단 단일 시작 액션으로 다음 행동을 시작한다.

### Edge Cases

- 오늘이 아직 10분 미만이면 연속 시작은 어제부터 과거 방향으로 계산한다.
- 오늘이 10분 이상이면 오늘을 포함해 연속 시작을 계산한다.
- 자정을 넘긴 완료 세션은 각 현지 날짜와 겹친 실제 시간 비율로 `duration_seconds`를 배분한다.
- 휴식·제외 시간으로 `duration_seconds`가 실제 경과 시간보다 짧으면 각 날짜에 같은 비율로 반영한다.
- 비정상적으로 기록 시간이 경과 시간보다 길면 서버 집계처럼 경과 시간까지만 반영한다.
- 유효하지 않거나 완료되지 않은 세션은 과거 날짜 집계에서 제외한다.

### Error Cases

- 유효하지 않은 날짜 키는 명시적인 오류로 처리해 잘못된 주간 표시를 만들지 않는다.
- 유효하지 않은 시간대 값은 클라이언트 집계를 중단하지 않고 UTC 경계로 안전하게 대체한다.

## 7. Functional Requirements

- [x] 오늘을 포함한 최근 7개 현지 날짜를 결정적으로 생성한다.
- [x] 완료 세션 시간을 서버 RPC와 같은 비례 규칙으로 날짜별 배분한다.
- [x] 오늘 시간은 기존 서버 기준 Today 합계와 활성 세션 합계를 최종값으로 사용한다.
- [x] 날짜별 `ready`, `seed`, `tree`, `bloom` 단계를 기존 일일 습관 helper로 계산한다.
- [x] 시작 성공 일수, 일일 목표 달성 일수, 꽃피움 일수와 현재 연속 시작을 계산한다.
- [x] Today 화면에 텍스트 상태가 포함된 7일 숲길과 비징벌적 코칭 문구를 표시한다.
- [x] 데스크톱과 모바일 웹에서 가로 overflow 없이 재배치된다.

## 8. Non-functional Requirements

- 성능: 이미 메모리에 로드된 최근 세션·할 일 배열을 사용하고 추가 네트워크 요청을 만들지 않는다.
- 보안: 사용자별 RLS로 받은 기존 데이터만 사용하며 권한이나 스키마를 변경하지 않는다.
- 접근성: 날짜, 단계, 공부 시간을 텍스트로 제공하고 색상만으로 상태를 구분하지 않는다.
- 확장성: 날짜 배분·연속 기록·코칭 계산을 React 밖의 순수 helper로 유지한다.
- 유지보수성: 기존 일일 습관 단계와 출석 정책 helper를 재사용한다.

## 9. Dependencies

- 내부 의존성: `dailyHabit.mjs`, `attendancePolicy.mjs`, 이미 로드된 `study_sessions`, `study_todos`.
- 외부 의존성: React, 기존 Lucide 아이콘.
- Supabase: 기존 조회 결과만 사용하며 변경 없음.
- API: 추가 없음.
- 환경 변수: 추가 없음.

## 10. Success Metrics

- 자정 교차·제외 시간·오늘 진행 중·월/연도 경계 테스트가 통과한다.
- 사용자가 최근 7일의 시작 성공 일수와 오늘의 다음 행동을 한 화면에서 이해할 수 있다.
- 390px와 데스크톱 폭에서 문서·카드·날짜 항목에 가로 overflow가 없다.
- 전체 테스트와 production build가 통과한다.

## 11. Rollout Plan

- 개발: 순수 집계 helper와 경계값 테스트를 먼저 작성한 뒤 Today UI에 연결한다.
- 테스트: helper 단위 테스트, source contract, 전체 테스트, production build, 1440px·390px 렌더링을 확인한다.
- 배포: 사용자가 명시적으로 요청할 때 기존 GitHub Actions/Vercel 경로를 사용한다.
- 모니터링: 실제 인증 계정에서 자정 교차 세션과 오늘 활성 세션의 단계 일치를 확인한다.

## 12. Open Questions

- 최근 7일 시작 성공이 공부의 숲 장식 해금에도 영향을 줄지는 실제 사용 후 결정한다.
- 10분 기준을 사용자별로 조정 가능하게 할지는 후속 사용 데이터로 판단한다.

## 13. 2026-07-20 Update: Flexible Five-of-Seven Goal

최근 7일 리듬은 관찰에서 끝나지 않고, 휴식 여백이 있는 다음 행동으로 연결된다. 상세 요구사항은 `memory-bank/prd-flexible-weekly-start-goal.md`를 기준으로 한다.

### Functional Requirements

- [x] 최근 7일 중 다섯 번의 10분 시작을 기본 목표로 표시한다.
- [x] 이틀을 실패가 아닌 명시적인 휴식 여백으로 안내한다.
- [x] 5개 씨앗 마커와 progressbar 텍스트로 현재 진행도를 표시한다.
- [x] 오늘 단계 문맥을 최상단 단일 시작 액션에 반영해 기존 세션 준비 흐름을 연다.
- [x] 목표 달성 후 오늘 미시작 상태에서는 휴식을 허용하는 코칭을 우선한다.
- [x] 추가 Supabase 요청·스키마·출석 의미 변경 없이 기존 로드 데이터만 사용한다.

### Success Evidence

- 목표 0·4·5·7회 경계, 목표 달성 후 선택적 휴식, 화면 source contract를 포함한 집중 테스트 8개가 통과한다.
- 전체 Node 테스트 291개, TypeScript/Vite production build, `git diff --check`, 1440px·390px 실제 Chrome overflow 검증이 통과한다.
