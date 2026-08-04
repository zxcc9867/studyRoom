# PRD: Auth Initialization Recovery

## 1. Problem

Supabase Auth 또는 내부 Postgres 응답이 지연되면 웹 앱이 `로그인 상태 확인 중` 화면에 무기한 머물러 사용자가 공부 흐름을 시작할 수 없다. 일시적인 백엔드 장애가 영구적인 앱 고장처럼 보이지 않도록 제한 시간과 복구 경로가 필요하다.

## 2. Target Users

- 저장된 Supabase 세션으로 웹 독서실에 다시 들어오는 사용자
- 이메일 OTP 또는 Google OAuth로 새로 로그인하려는 사용자
- 일시적인 네트워크·Supabase 지연 후 스스로 앱 진입을 복구하려는 사용자

## 3. Goals

- 초기 저장 세션 확인이 끝나지 않아도 12초 안에 조작 가능한 로그인 화면을 제공한다.
- 사용자가 현재 화면에서 로그인 상태 확인을 다시 시도하거나 새 로그인을 진행할 수 있게 한다.
- 기존 세션 자동 저장·refresh와 Auth 상태 구독을 유지한다.

## 4. Non-goals

- Supabase Auth 세션 정책, JWT 수명, RLS, DB 스키마 또는 프로젝트 compute 설정 변경
- 진행 중인 Supabase 요청의 강제 취소
- 장애 원인 자동 진단이나 운영자용 리소스 모니터링 UI

## 5. User Stories

- As a returning user, I want the app to stop waiting after a reasonable time, so that I can recover without closing the browser.
- As a user, I want to retry the saved-login check, so that a transient outage does not force me to abandon my study routine.
- As a signed-in user, I want a late valid Auth event to restore my session, so that the recovery fallback does not discard my login.

## 6. User Scenarios

### Normal Flow

1. 앱이 저장된 Supabase 세션을 확인한다.
2. 12초 안에 응답하면 세션 유무에 따라 대시보드 또는 로그인 화면을 표시한다.
3. 이후 `onAuthStateChange`가 로그인·refresh 상태를 계속 동기화한다.

### Edge Cases

- 12초 후에도 요청이 끝나지 않으면 로그인 화면과 복구 안내를 표시한다.
- 사용자가 `로그인 상태 다시 확인`을 누르면 새 시도 번호로 다시 확인하고 이전 늦은 결과는 UI를 덮어쓰지 않는다.
- timeout 뒤 유효한 Auth 상태 이벤트가 도착하면 안내를 지우고 로그인 세션을 복구한다.
- OAuth callback 처리 중 timeout이 발생하면 잠긴 로그인 버튼 상태를 해제한다.

### Error Cases

- `getSession()`이 오류를 반환하면 원문 내부 오류를 노출하지 않고 재시도 가능한 일반 안내를 표시한다.
- 반복 실패해도 세션 또는 토큰을 임의 삭제하거나 자동 로그아웃하지 않는다.

## 7. Functional Requirements

- [x] 초기 `getSession()` 및 OAuth callback 처리에 12초 제한 시간을 적용한다.
- [x] timeout 또는 초기화 오류 후 로그인 화면을 표시한다.
- [x] 복구 안내는 `role="alert"`로 전달하고 `로그인 상태 다시 확인` 버튼을 제공한다.
- [x] timeout 뒤에도 이메일 OTP와 Google 로그인 조작을 사용할 수 있다.
- [x] 최신 초기화 시도만 세션·완료 상태를 갱신한다.
- [x] `onAuthStateChange` 구독으로 늦게 도착한 유효 세션을 복구한다.
- [x] 컴포넌트 해제 시 Auth 구독을 해제하고 진행 중 시도를 무효화한다.

## 8. Non-functional Requirements

- 성능: 정상 세션 복구 경로에는 추가 네트워크 요청을 만들지 않는다.
- 보안: service role 키, 세션 토큰, 내부 오류 원문을 UI나 문서에 노출하지 않는다.
- 접근성: 로딩 상태는 live status, 복구 실패는 alert로 보조 기술에 전달한다.
- 확장성: timeout helper를 Supabase 구현과 분리해 결정적으로 테스트한다.
- 유지보수성: 기존 Supabase SDK의 세션 저장·자동 refresh·Auth 이벤트 계약을 변경하지 않는다.

## 9. Dependencies

- 내부 의존성: `apps/web/src/main.tsx`, `apps/web/src/authInitialization.mjs`
- 외부 의존성: `@supabase/supabase-js`
- Supabase: Auth `getSession()`, `onAuthStateChange`, OAuth callback API
- API: 기존 Auth API만 사용하며 새 endpoint는 없다.
- 환경 변수: 기존 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 재사용한다.

## 10. Success Metrics

- 초기 Auth 응답이 영원히 pending이어도 12초 후 로그인 복구 UI가 나타난다.
- 정상 저장 세션, 세션 없음, timeout, 재시도, 늦은 Auth 이벤트 경로가 테스트 또는 실제 브라우저 검증을 통과한다.
- 데스크톱과 모바일에서 복구 안내와 로그인 조작이 화면 폭을 넘지 않는다.

## 11. Rollout Plan

- 개발: 순수 timeout helper와 React 복구 상태를 연결한다.
- 테스트: helper·source contract·기존 Auth 회귀 테스트를 실행한다.
- 배포: 전체 테스트와 production build 통과 후 사용자가 요청할 때 기존 Vercel workflow로 배포한다.
- 모니터링: 재발 시 Supabase Auth/API/Postgres 로그와 같은 시각의 compute 리소스 그래프를 함께 확인한다.

## 12. Open Questions

- 실제 운영 장애 빈도에 따라 12초 값을 조정할 필요가 있는가?
- 반복 timeout 횟수를 개인정보 없이 집계할 최소 운영 지표가 필요한가?
