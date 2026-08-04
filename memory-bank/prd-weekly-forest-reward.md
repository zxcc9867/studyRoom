# PRD: Weekly Forest Reward

## 1. Problem

최근 7일 5/7 시작 목표가 Today 화면의 숫자와 문구로만 끝나면 공부의 숲 보상 공간과 습관 행동 사이의 연결이 약하다. 반대로 현재 이동 7일이 바뀔 때 완성 보상을 다시 잠그면 사용자는 이미 얻은 성취를 빼앗겼다고 느낄 수 있다.

## 2. Target Users

완벽한 매일 출석보다 일주일에 여러 번 작은 시작을 반복하고, 그 성취가 시각적으로 남는 것을 동기로 삼는 개인 학습자.

## 3. Goals

- 현재 최근 7일의 0~5회 시작 진행도를 공부의 숲에서 다섯 씨앗 조명으로 보여 준다.
- 7일 범위 안에서 다섯 번째 10분 시작을 완료하면 반딧불 화환 1개를 획득한다.
- 획득한 화환은 이후 현재 7일 진행도가 낮아져도 누적 보상으로 남긴다.
- 한 번의 연속 기록으로 같은 기간에 화환이 매일 중복 생성되지 않도록 획득 사이에 7일 간격을 둔다.
- 새 3D 오브젝트를 기존 현재 나무 충돌 영역 안에 배치해 캐릭터가 장식을 통과하는 문제를 만들지 않는다.

## 4. Non-goals

- 출석 `present`/`missed`, 10분 습관 성공, 평일 2시간·주말 4시간 목표를 변경하지 않는다.
- 화환을 화폐·상점·랜덤 뽑기·경쟁 순위로 확장하지 않는다.
- 새 Supabase 테이블, 컬럼, RPC, RLS, Edge Function 또는 네트워크 요청을 추가하지 않는다.
- Expo 모바일에 Three.js 보상 공간을 추가하지 않는다.
- 과거에 획득한 화환을 현재 7일 미달 때문에 회수하지 않는다.

## 5. User Stories

- As a learner, I want my five-of-seven starts to light five seeds in the forest, so that weekly effort feels tangible.
- As a learner, I want a completed firefly wreath to remain, so that a later rest day does not erase earned progress.
- As a learner, I want to know how many starts remain for the next wreath, so that the forest suggests one clear next action.

## 6. User Scenarios

### Normal Flow

1. 사용자가 공부의 숲을 연다.
2. 현재 나무 둘레의 다섯 씨앗 중 최근 7일 시작 횟수만큼 불이 들어온다.
3. 상태 카드에서 `새 반딧불 화환까지 N번`과 누적 화환 수를 확인한다.
4. 다섯 번째 10분 시작을 완료하면 씨앗 조명이 모두 켜지고 나무 위 반딧불 화환이 빛난다.
5. 다음 7일 리듬이 시작되어 진행도가 낮아져도 이미 획득한 화환 수와 영구 꽃 표식은 남는다.

### Edge Cases

- 완료 세션이 자정을 넘으면 사용자 시간대의 날짜별 실제 공부 시간 비율로 나눈다.
- 동일한 7일 범위가 여러 날짜에서 계속 5회 조건을 만족해도 화환을 중복 획득하지 않는다.
- 활성 세션이 10분을 넘으면 현재 씨앗 진행도는 즉시 반영할 수 있지만 영구 화환은 완료 세션 저장 후 확정한다.
- 기록이 없으면 0/5 씨앗과 첫 화환 안내를 표시한다.
- 매우 오래된 기록도 이미 로드된 완료 세션 범위 안에서는 획득 이력에 포함한다.

### Error Cases

- 잘못된 세션 시각, 완료되지 않은 세션, 0 이하 경과 시간은 화환 계산에서 제외한다.
- 유효하지 않은 시간대는 기존 주간 습관 규칙과 같이 UTC로 안전하게 대체한다.
- WebGL을 열 수 없어도 텍스트 상태 카드에서 진행도와 누적 화환을 확인할 수 있다.

## 7. Functional Requirements

- [x] 완료 세션을 사용자 현지 날짜에 배분해 10분 성공 날짜를 계산한다.
- [x] 이동 7일 안의 다섯 번째 성공 날짜에 화환을 1개 획득한다.
- [x] 획득 날짜 사이를 최소 7일로 제한해 겹치는 창의 중복 보상을 막는다.
- [x] 현재 5/7 목표 상태와 누적 화환 수를 숲 섹션에 전달한다.
- [x] 상태 카드에 다섯 씨앗 progressbar, 남은 시작 수, 누적 화환 수를 표시한다.
- [x] Three.js 현재 나무 충돌 영역에 다섯 씨앗 조명, 완성 반딧불 화환, 영구 꽃 표식을 렌더링한다.
- [x] 목표 달성 애니메이션은 reduced-motion에서 정지한다.
- [x] 데스크톱과 모바일 웹에서 카드와 씨앗에 가로 overflow가 없다.

## 8. Non-functional Requirements

- 성능: 이미 메모리에 로드된 완료 세션만 한 번 순회하고 세션이 실제로 걸친 날짜만 배분한다.
- 보안: 사용자별 RLS로 읽은 기존 세션 배열만 사용하며 새 저장 경로를 만들지 않는다.
- 접근성: 현재값·최댓값·남은 횟수·누적 화환을 텍스트와 progressbar ARIA로 제공한다.
- 확장성: 획득 이력 계산은 React와 Three.js 밖의 순수 helper로 유지한다.
- 유지보수성: 10분·5회 기준은 기존 `weeklyHabit` 상수를 재사용한다.

## 9. Dependencies

- 내부 의존성: `weeklyHabit.mjs`, `StudyForestSection.tsx`, `StudyForest3D.tsx`, 이미 로드된 `study_sessions`.
- 외부 의존성: React, Three.js, 기존 Lucide 아이콘.
- Supabase: 기존 세션 조회 결과만 사용하며 변경 없음.
- API: 추가 없음.
- 환경 변수: 추가 없음.

## 10. Success Metrics

- 5개 성공 날짜가 있는 첫 7일에서 화환 1개를 획득한다.
- 같은 연속 기록에서 7일 이내 중복 화환이 생성되지 않는다.
- 과거 화환 획득 후 현재 7일이 5회 미만이어도 누적 화환 수가 유지된다.
- 3D 장식이 기존 현재 나무 collider와 같은 위치를 사용한다.
- 전체 테스트, production build, 1440px·390px 브라우저 검증이 통과한다.

## 11. Rollout Plan

- 개발: 화환 이력 helper 테스트를 먼저 고정하고 숲 상태 카드와 Three.js 장면에 연결한다.
- 테스트: 날짜 배분·중복 방지·영구 보존 단위 테스트, source contract, 전체 회귀, build, 실제 Chrome을 확인한다.
- 배포: 사용자가 명시적으로 요청할 때 기존 GitHub Actions/Vercel 경로를 사용한다.
- 모니터링: 5/7 달성 후 숲 방문 여부와 다음 10분 시작까지의 간격을 관찰한다.

## 12. Open Questions

- 누적 화환 수에 따라 별도 섬 구역이나 계절 장식을 해금할지는 실제 사용 후 결정한다.
- Expo 모바일에서는 3D 대신 같은 화환 진행도를 2D 카드로 보여 줄지 별도 PRD로 검토한다.
