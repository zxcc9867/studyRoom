# PRD: Study Session Breaks

## 1. Problem

사용자는 공부를 완전히 끝내지 않았지만 식사, 외출, 짧은 휴식 때문에 공부 시간 계산을 잠시 멈추고 나중에 같은 세션을 이어갈 필요가 있다. 현재는 `종료`만 명시적으로 제공되어 휴식 시간을 공부 시간에서 즉시 제외할 수 없다.

## 2. Target Users

- 웹 또는 Expo 모바일에서 장시간 공부 세션을 진행하는 사용자
- 식사·외출 후 같은 할 일과 세션 맥락으로 돌아오려는 사용자

## 3. Goals

- 버튼을 추가하지 않고 기존 시작 버튼을 `잠시 쉬기`와 `공부 계속하기`로 전환한다.
- 휴식 시작 시 공부 시간 계산을 즉시 멈추고 재개 시 다시 계산한다.
- 새로고침, 앱 재실행, 다른 클라이언트에서도 휴식 상태와 누적 휴식 시간을 유지한다.
- 휴식 중에도 세션 유지 lease는 계속 감소하고 최대 2시간 상한을 유지한다.

## 4. Non-goals

- 휴식 사유를 시작할 때마다 필수 입력받지 않는다.
- 휴식 중 세션 lease를 자동 연장하거나 정지하지 않는다.
- `study_sessions.status`에 `paused` 값을 추가하지 않는다.

## 5. User Stories

- As a user, I want to pause a running study session, so that meals and errands are not counted as study time.
- As a user, I want to resume the same session, so that linked todos and session context remain intact.
- As a user, I want a paused session to survive refresh, so that accidental navigation does not restart the timer.

## 6. User Scenarios

### Normal Flow

1. 공부 중 왼쪽 버튼의 `잠시 쉬기`를 누른다.
2. 공부 시간은 멈추고 화면에 `휴식 중`과 현재 휴식 시간이 표시된다.
3. 왼쪽 버튼이 `공부 계속하기`로 바뀐다.
4. 웹은 카메라 감시를 다시 준비한 뒤, 모바일은 즉시 같은 세션을 재개한다.

### Edge Cases

- 휴식 또는 재개 요청을 중복 호출해도 누적 시간이 중복되지 않는다.
- 휴식 중 종료하면 현재 휴식 구간까지 최종 공부 시간에서 제외한다.
- 휴식 중 lease가 만료되면 세션을 종료하되 lease 초과 시간과 휴식 시간을 중복 제외하지 않는다.
- 휴식 중에는 브라우저 inactivity 종료가 실행되지 않고 서버 lease 정책이 종료 상한을 담당한다.

### Error Cases

- pause/resume RPC 실패 시 현재 UI 상태를 유지하고 오류를 표시한다.
- 웹에서 카메라 재시작이 실패하면 휴식 상태를 유지한다.

## 7. Functional Requirements

- [x] `study_sessions.paused_at`에 현재 휴식 시작 시각을 저장한다.
- [x] `study_sessions.paused_seconds`에 완료된 휴식 구간을 누적한다.
- [x] 인증 사용자 본인의 active 세션만 pause/resume RPC로 변경한다.
- [x] `end_study_session`은 누적 휴식과 진행 중 휴식을 `duration_seconds`에서 제외한다.
- [x] 웹과 Expo에서 시작 전/공부 중/휴식 중 3상태 버튼 문구를 제공한다.
- [x] 웹 휴식 중에는 카메라 감시를 끄고, 재개 전에 다시 켠다.
- [x] 휴식 중에도 `세션 유지 남은 시간`을 계속 표시한다.

## 8. Non-functional Requirements

- 성능: 기존 15초 active-session 동기화에 휴식 컬럼을 포함하고 별도 polling을 추가하지 않는다.
- 보안: RPC는 `public`·`anon` 실행을 취소하고 `authenticated` 사용자 소유권을 검증한다.
- 접근성: 버튼 이름과 `휴식 중` 상태를 텍스트 및 `aria-live`로 전달한다.
- 유지보수성: 휴식 시간 계산은 순수 helper와 SQL migration 테스트로 고정한다.

## 9. Dependencies

- 내부 의존성: active session 조회, 세션 lease, 카메라 감시, 세션 종료 회고
- 외부 의존성: Supabase Postgres RPC
- Supabase: `study_sessions`, `pause_study_session`, `resume_study_session`, `end_study_session`
- API: Supabase JavaScript `rpc()`
- 환경 변수: 추가 없음

## 10. Success Metrics

- 휴식 중 오늘/월간 진행 시간이 증가하지 않는다.
- 종료 후 저장된 `duration_seconds`에 휴식 시간이 포함되지 않는다.
- 새로고침 후에도 휴식 표시와 재개 버튼이 유지된다.
- 웹·모바일 테스트, 웹 build, 모바일 typecheck가 통과한다.

## 11. Rollout Plan

- 개발: migration, 순수 helper, 웹/Expo UI를 함께 구현한다.
- 테스트: helper, SQL migration, 전체 Node 테스트, 웹 build, Expo typecheck를 수행한다.
- 배포: 원격 migration `20260719140751_add_study_session_breaks` 적용 완료. 프론트 배포는 별도 요청 시 진행한다.
- 모니터링: RPC 권한, 컬럼·제약, 데이터 위반 0건, security/performance Advisors를 원격에서 확인했다.

## 12. Open Questions

- 장기적으로 휴식 사유별 통계가 필요하면 별도 break interval 테이블을 검토한다.
