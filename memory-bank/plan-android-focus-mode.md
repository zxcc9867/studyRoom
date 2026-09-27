# Android 집중 모드 APK 구현 계획 (2026-09-27)

> 2026-09-28 진행: 서버·Android·웹 구현과 운영 DB/Edge 적용 완료. 최종 소스의 preview APK 빌드 `2f66ac03-6500-45a3-a39e-940e0dd908ba` 성공. 웹 production 반영, 실기기 방해금지/푸시 검증은 남음.

## 범위와 완료 조건

- `prd-android-focus-mode.md`의 APK 우선 검증안을 구현한다. Google Play 공개와 다른 앱 차단은 범위 밖이다.
- 공부 세션 시작·재개 때 Android 앱 전용 방해금지 규칙을 켜고, 휴식·종료·lease 만료 때 끈다. 웹 조작도 같은 서버 상태를 사용한다.
- 웹은 휴대폰의 실제 적용 확인 전에는 성공을 표시하지 않는다. 권한 거부·푸시 지연은 공부 세션을 막지 않는다.
- APK 생성과 휴대폰 설치·실제 방해금지 동작은 각각 독립적으로 검증·보고한다.

## 1. 서버 계약과 회귀 테스트

대상: `supabase/migrations/`, `supabase/functions/attendance-cron/`, `supabase/functions/_shared/`, 관련 `test/`.

1. 실패하는 테스트로 활성/휴식/완료/만료/lease 연장 상태의 `desired_focus`와 revision, 늦은 알림·중복 알림, 다른 사용자 기기 접근을 명시한다.
2. 소유자별 집중 상태와 단일 Android 기기 등록·확인 테이블을 추가한다. `study_sessions`의 서버 확정 전이로 revision을 올리고, lease 만료 시 현재 시각으로 `desired_focus=false`를 평가한다. 두 테이블 모두 RLS를 적용한다.
3. 기기 등록/적용 확인은 인증된 본인만 할 수 있고, 확인 revision은 현재 서버 revision보다 앞설 수 없다. Expo 토큰은 기존 `notification_targets`를 재사용하며 공개 조회에 포함하지 않는다.
4. 출석 Cron에서 변경된 revision을 Expo 데이터 푸시로 전달한다. 푸시는 깨우기 신호만 담고, 세션 상태·비밀키를 싣지 않는다. 개별 푸시 실패는 출석 Cron을 실패시키지 않으며 재시도 가능하게 남긴다.
5. SQL/RLS/Edge 테스트와 기존 세션·출석 테스트를 실행한다. 운영 DB 변경은 로컬 검증 완료 후에만 수행한다.

## 2. Android APK

대상: `apps/mobile/app.json`, `apps/mobile/package.json`, `apps/mobile/index.js`, `apps/mobile/App.tsx`, `apps/mobile/src/`, 신규 `apps/mobile/modules/focus-mode/`, `apps/mobile/eas.json` 및 테스트.

1. 순수 상태 해석 함수 테스트를 먼저 작성한다. `active && !paused && lease>now`만 켜짐이며, 이전 revision·로그아웃·권한 거부는 잘못된 성공 확인을 만들지 않아야 한다.
2. `NotificationManager`로 앱 소유 `AutomaticZenRule`만 생성·전환하는 Kotlin 로컬 Expo 모듈을 추가한다. Android 15+에서 전역 방해금지 변경 API를 사용하지 않는다. 지원하지 않는 OS/API에는 명시적 오류를 반환한다.
3. 권한 상태/시스템 설정 열기/앱 소유 규칙 켜기·끄기 API를 JS에 노출한다. 권한 요청은 사용자 버튼 동작에서만 시작한다.
4. `expo-task-manager` 기반 데이터 푸시 수신 시 서버 최신 상태를 재조회한다. 앱 실행·로그인·포그라운드 복귀 때도 재조정한다. 푸시 데이터 자체로 켜고 끄지 않는다.
5. 설치/연결/권한/적용 확인 상태를 앱에서 표시한다. 로그아웃 시 앱 규칙 해제와 본인 기기 등록 해제를 시도한다. 서버가 불가하면 성공을 표시하지 않는다.
6. 모바일 타입 검사 및 Android 네이티브 컴파일을 확인한다. 로컬 Android SDK 설치는 사용자가 승인한 뒤 E:에 진행한다. SDK가 없으면 APK 생성 완료를 주장하지 않는다.

## 3. 웹 상태 표시

대상: `apps/web/src/main.tsx` 및 해당 스타일·테스트.

1. 미연결/권한 필요/동기화 중/켜짐/꺼짐/확인 실패 상태에 대한 표시 테스트를 먼저 작성한다.
2. 기존 공부 제어 옆에 휴대폰 집중 모드 상태와 앱 설치·권한 안내를 간결히 표시한다. 미확인 상태에서 공부 시작·휴식·종료 버튼을 막지 않는다.
3. 데스크톱과 375px 모바일에서 상태 문구와 오류 복구 동선을 확인한다.

## 4. 출시 및 문서

1. PRD 체크박스와 `memory-bank/active-context.md`, `progress.md`, `implementation-plan.md`, 필요 시 `trouble-shooting.md`를 실제 구현 결과로 갱신한다. 운영 스키마 적용 결과와 테스트 명령을 기록한다.
2. 전체 테스트·웹 빌드·Edge 검사·모바일 타입 검사·문서 검사를 새 결과로 실행한다.
3. DB → Edge → 웹(Vercel production) 순으로 적용하고 운영 상태를 읽기 전용으로 재확인한다. 기존 출석·타이머가 유지되는지 스모크 테스트한다.
4. 빌드 도구가 준비되면 Play 계정 없이 직접 설치형 APK를 만든다. 실제 휴대폰 설치/권한 승인/시작·휴식·재개·종료 테스트는 기기 연결 후 수행한다. APK 산출물만으로 실기기 동작을 검증했다고 주장하지 않는다.

## 안전 경계

- 포그라운드 앱은 서버 상태를 재조회해 순서가 뒤바뀐 푸시를 무시한다. 휴대폰 오프라인/강제 종료 시 즉시 해제는 보장되지 않으므로 적용 확인 시각을 노출한다.
- 앱이 소유하지 않은 수동 방해금지 규칙은 절대 변경하지 않는다.
- 작업 전 현재 checkout의 타인 변경을 보존하고, 커밋·푸시는 별도 요청 없이는 수행하지 않는다. 이번 요청의 `배포`는 검증된 운영 반영과 APK 산출까지이며 Play 공개를 뜻하지 않는다.
