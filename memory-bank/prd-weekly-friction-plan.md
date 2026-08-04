# PRD: Weekly Friction Plan

## 1. Problem

세션 회고는 방해 요인을 저장하지만 주간 리뷰는 집중도·에너지와 다음 행동만 보여준다. 같은 방해가 반복되어도 사용자가 다음 세션의 환경을 어떻게 바꿀지 직접 해석해야 하므로 회고가 습관 조정으로 충분히 이어지지 않는다.

## 2. Target Users

- 휴대폰, 소음·환경, 피로, 일정 같은 방해가 반복되는 학습자
- 점수나 경고보다 작고 구체적인 환경 조정을 원하는 학습자

## 3. Goals

- 이번 주 완료 세션의 회고에서 같은 방해 요인이 2회 이상 반복될 때만 한 가지 조정안을 보여준다.
- 가장 자주 반복된 요인을 우선하고, 동률이면 가장 최근 기록과 고정 순서로 결정한다.
- 사용자가 바로 준비할 수 있는 환경 행동과 짧은 실행 단서를 제공한다.
- 기존 단일 시작 CTA와 주간 다음 행동 계획을 유지한다.

## 4. Non-goals

- 한 번 기록된 방해를 문제로 단정하지 않는다.
- AI 분석, 진단, 벌점, 알림 또는 자동 todo 생성을 추가하지 않는다.
- 새 Supabase query, schema, RPC, RLS, Edge Function 또는 환경 변수를 추가하지 않는다.
- Expo 모바일 UI를 이번 범위에서 변경하지 않는다.

## 5. User Stories

- As a learner, I want repeated interruptions translated into one small environment change, so that reflection improves my next study setup.
- As a learner, I want one-off interruptions ignored, so that the review does not overreact to normal variation.

## 6. User Scenarios

### Normal Flow

1. 사용자가 이번 주 완료 세션 두 개 이상에서 같은 방해 요인을 남긴다.
2. My Page 주간 리뷰가 반복 횟수와 한 가지 환경 조정안을 보여준다.
3. 사용자는 다음 세션 시작 전에 안내된 준비를 직접 적용한다.

### Edge Cases

- `none`, null, 알 수 없는 값은 집계하지 않는다.
- 모든 유효 방해 요인이 1회뿐이면 안내를 표시하지 않는다.
- 동률이면 가장 최근 발생 시각을 우선하고, 시각도 같으면 고정된 이유 순서를 사용한다.
- 이전 주, 활성 세션 또는 현재 주 범위 밖 세션의 회고는 현재 주 제안에 포함하지 않는다.

### Error Cases

- 잘못된 방해 요인이나 시각 값은 UI 오류를 만들지 않고 안전하게 무시하거나 고정 순서로 처리한다.
- 회고 조회 실패 시 기존 My Page 오류 처리 계약을 유지한다.

## 7. Functional Requirements

- [x] 유효한 방해 요인별 횟수와 최근 발생 시각을 결정적으로 집계한다.
- [x] 2회 이상 반복된 요인만 계획 후보가 된다.
- [x] 횟수, 최근성, 고정 순서로 하나의 후보를 선택한다.
- [x] 방해 요인별 한국어 라벨, 제목, 구체적 행동, 실행 단서를 반환한다.
- [x] 현재 주 완료 세션에 연결된 회고만 현재 주 계획에 반영한다.
- [x] 주간 리뷰에 반복 횟수와 조정안을 비대화형 안내로 표시한다.
- [x] 390px에서 가로 overflow 없이 한 열로 배치한다.
- [x] 새 시작 버튼이나 서버 쓰기를 만들지 않는다.

## 8. Non-functional Requirements

- 성능: 이미 메모리에 로드된 현재 주 회고만 한 번 순회한다.
- 보안: 기존 인증·RLS·조회 계약을 변경하지 않는다.
- 접근성: 색상 외에 이유·횟수·행동을 텍스트로 제공하고 의미 있는 제목 구조를 사용한다.
- 확장성: 이유별 문구와 우선순위를 React 밖 순수 helper에 둔다.
- 유지보수성: 결정 규칙을 집중 테스트로 고정한다.

## 9. Dependencies

- 내부 의존성: `weeklyReview.mjs`, `WeeklyReviewSection.tsx`, 기존 `studySessionReflections` 상태.
- 외부 의존성: React, Lucide React.
- Supabase: 기존 `study_session_reflections.interruption_reason` 조회값만 재사용하며 변경 없음.
- API: 추가 없음.
- 환경 변수: 추가 없음.

## 10. Success Metrics

- 반복·단발·무효 값·동률·현재 주 범위 테스트가 통과한다.
- 주간 리뷰에는 조건 충족 시 안내 하나만 나타나고 새 CTA가 없다.
- 전체 테스트와 production build가 통과한다.
- 실제 Chrome 1440px·390px에서 문구, 반응형 배치, overflow와 브라우저 오류를 확인한다.

## 11. Rollout Plan

- 개발: PRD, 실패 테스트, 순수 helper, 타입, 주간 리뷰 UI, 스타일 순서로 구현한다.
- 테스트: 집중 테스트, 전체 테스트, build, 실제 Chrome 데스크톱·모바일을 확인한다.
- 배포: 사용자가 명시적으로 요청할 때 기존 배포 경로를 사용한다.
- 모니터링: 실제 회고에서 2회 기준이 너무 민감하거나 둔한지 관찰한 뒤 증거가 있을 때만 조정한다.

## 12. Open Questions

- 실제 사용에서 2회 기준이 적절한가?
- 향후 사용자가 추천 문구를 직접 바꾸거나 숨길 필요가 있는가?

## 13. Evidence

- TDD RED에서 helper 미구현, JSX 조건 중첩, 모바일 CSS selector 중첩을 각각 확인한 뒤 회귀 테스트로 고정했다.
- 집중 테스트 5개와 전체 Node 테스트 326개가 통과했다.
- TypeScript/Vite production build와 `git diff --check`가 통과했다.
- 실제 Chromium에서 휴대폰 방해 2회가 `숲길 정비 노트` 한 개로 표시되고 새 버튼은 0개임을 확인했다.
- 1440px에서는 `405.281px 594.719px` 2열, 390px에서는 `246px` 1열로 계산됐다.
- 두 viewport 모두 document overflow, 카드 경계 이탈, 자식 overflow가 없었고 console warning/error와 page error는 0건이었다.
- 모든 Supabase 요청은 Playwright context route로 차단·스텁했으며 원격 read/write는 수행하지 않았다.
