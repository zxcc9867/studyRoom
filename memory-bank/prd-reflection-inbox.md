# PRD: Reflection Inbox

## 1. Problem

자동 lease 종료나 회고 모달을 닫은 완료 세션은 회고와 `다음 행동` 없이 남는다. 실제 익명 집계에서도 회고 연결이 습관 루프의 가장 약한 단계였기 때문에, 사용자가 다음 방문에서 최근 세션 하나를 짧게 정리할 복구 경로가 필요하다.

## 2. Target Users

- 공부 세션은 완료했지만 종료 시점에 회고하지 못한 사용자
- 지난 집중을 다음 행동으로 연결하고 싶은 사용자
- 회고를 처벌이나 필수 절차가 아닌 짧은 정리로 사용하려는 사용자

## 3. Goals

- My Page에서 최근 7일의 회고 없는 완료 세션을 최대 3개 보여 준다.
- 기존 회고 입력 UI를 재사용해 집중도·에너지·방해 요인·메모·다음 행동을 나중에 저장한다.
- 새 `다음 행동`을 Today의 기존 단일 시작 흐름에 즉시 연결한다.
- reflection 쓰기가 반드시 사용자 소유의 완료 세션에만 연결되도록 RLS를 강화한다.

## 4. Non-goals

- 회고 미작성에 대한 벌점, 출석 실패, 강제 팝업 또는 알림
- 이미 완료된 세션의 공부 시간·상태·todo 완료 결과 변경
- 회고 내용의 AI 분석이나 외부 전송
- Expo 모바일 UI 추가

## 5. User Stories

- As a learner, I want to finish a missed reflection later, so that one rushed ending does not break my study loop.
- As a learner, I want my saved next action to appear in the next start flow, so that I can resume without deciding again.
- As a learner, I want the inbox to disappear after I reflect, so that it feels like a finite gentle cleanup.

## 6. User Scenarios

### Normal Flow

1. 사용자가 My Page에 들어간다.
2. 앱이 reflection 이력을 불러온 뒤 최근 7일 완료 세션 중 회고가 없는 세션을 계산한다.
3. 사용자가 한 세션의 `회고 남기기`를 누른다.
4. 후속 회고 모달에서 상태와 다음 행동을 저장한다.
5. 저장된 세션은 인박스에서 사라지고 새 다음 행동은 Today의 시작 제안에 반영된다.

### Edge Cases

- reflection 로딩 전에는 미작성 세션을 추정해 표시하지 않는다.
- 최근 7일 경계의 완료 세션은 포함하고 그 이전 세션은 표시하지 않는다.
- 후보가 3개보다 많으면 가장 최근 종료 세션 3개만 표시한다.
- 이미 reflection이 있으면 동일 세션을 표시하지 않는다.
- 저장 중 modal close와 중복 제출을 막는다.

### Error Cases

- 저장 실패 시 modal과 작성 내용을 유지하고 사용자에게 오류를 표시한다.
- 다른 사용자의 세션, active/cancelled 세션, 존재하지 않는 세션에는 reflection을 insert/update할 수 없다.

## 7. Functional Requirements

- [x] 최근 7개 현지 날짜의 완료·미회고 세션을 결정적으로 계산한다.
- [x] 가장 최근 세션부터 최대 3개를 날짜·공부시간과 함께 My Page에 표시한다.
- [x] reflection 데이터 로딩 완료 전에는 인박스를 숨긴다.
- [x] 기존 `SessionReflectionModal`에 todo 변경이 없는 follow-up 모드를 추가한다.
- [x] follow-up 저장은 `study_session_reflections`에 session 단위 upsert한다.
- [x] 저장 성공 후 reflection 목록과 최신 다음 행동 상태를 즉시 갱신한다.
- [x] insert/update RLS migration은 `auth.uid() = user_id`와 완료 세션 소유권을 모두 검사한다.
- [x] anon/public 테이블 권한과 기존 원자적 세션 종료 RPC 계약을 변경하지 않는다.

## 8. Non-functional Requirements

- 성능: 새 Supabase read 요청 없이 이미 로드된 세션·reflection을 사용한다.
- 보안: RLS가 session ownership과 completed 상태를 검증하고 raw user content를 로그에 남기지 않는다.
- 접근성: 인박스는 이름 있는 section/list이고 각 버튼은 대상 날짜·시간을 포함한 접근 가능한 이름을 가진다.
- 확장성: 후보 계산은 React 밖의 순수 helper로 유지한다.
- 유지보수성: 기존 종료 회고와 follow-up 회고의 필드 컴포넌트를 공유하되 저장 의미는 분리한다.

## 9. Dependencies

- 내부 의존성: `study_sessions`, `study_session_reflections`, `SessionReflectionModal`, My Page
- 외부 의존성: Supabase Postgres, PostgREST, React
- Supabase: 기존 reflection table과 authenticated insert/update/select
- API: `study_session_reflections` upsert
- 환경 변수: 없음

## 10. Success Metrics

- 최근 7일 미회고 후보 필터·정렬·상한 경계 테스트가 통과한다.
- 저장 후 선택한 세션이 인박스에서 사라지고 next action 상태가 갱신된다.
- RLS source/remote 검증에서 다른 사용자 또는 미완료 세션 연결이 차단된다.
- 1440px과 390px에서 목록·버튼·모달이 가로로 넘치지 않는다.

## 11. Rollout Plan

- 개발: helper·migration source test를 먼저 RED로 고정한 뒤 UI와 저장 흐름을 구현한다.
- 테스트: 집중 테스트, 전체 Node 테스트, production build, 실제 Chrome 반응형·상호작용 검증을 수행한다.
- 배포: 사용자의 명시적 요청 후 migration을 Supabase에 적용하고 웹을 기존 CI로 배포한다.
- 모니터링: 회고 인박스 노출 수와 저장 후 다음 행동 사용 경험을 개인 데이터 외부 전송 없이 관찰한다.

## 12. Open Questions

- 7일보다 오래된 회고를 별도 기록 화면에서 지원할 필요가 있는가?
- Expo 모바일에도 같은 인박스를 제공할지는 웹 사용성 확인 후 결정한다.

## 13. Implementation Evidence

- 순수 helper 테스트는 최근 7일 경계, completed 상태, 기존 reflection 제외, 최신 종료순, 최대 3개, 잘못된 입력의 fail-closed를 고정한다.
- My Page는 reflection 이력 로딩 성공 후에만 인박스를 표시하고, 저장 중 닫기·중복 제출을 막는다.
- 실제 Chromium에서 3개 후보 표시, follow-up 모달, 저장 후 2개로 감소, 주간 리뷰 반영, Today `이어서 준비하기`와 다음 행동 안내를 확인했다.
- 390×844에서 문서와 모달의 가로 overflow가 없고 모든 인박스 버튼 높이가 44px였다.
- 전체 Node 테스트 321개와 TypeScript/Vite production build가 통과했다.
- `20260720182136_add_reflection_inbox.sql`은 authenticated SELECT·INSERT·UPDATE만 다시 부여하고, reflection row와 연결된 completed session의 소유권을 함께 검사한다.
- 원격 프로젝트는 아직 기존 user-row 소유권 정책을 사용한다. 사용자가 배포를 명시적으로 요청할 때 migration 적용과 원격 RLS 검증을 먼저 수행한다.
