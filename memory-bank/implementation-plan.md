## 2026-10-04 — 고정 APK 다운로드 게시 계약

- 사용자 공개 주소는 `/download/android`이며 Vite public의 독립 설치 안내를 로그인 없이 제공한다. 버튼은 `/download/android.apk`를 사용한다.
- 기존 vercel.json routes의 filesystem/SPA보다 앞에서 안내 파일을 rewrite하고 APK는 검증된 HTTPS Expo artifact로307/no-store 처리한다. 요청 파라미터/사용자 입력으로 redirect 목적지를 만들지 않는다.
- 새 APK 검증 완료 후 route Location과 출시 안내 정보를 함께 갱신하고 기존 production 웹 배포를 수행한다. EAS artifact 링크는 immutable이며 이 방식은 최신 **게시한** 파일의 별칭이지 자동 APK 빌드/OTA/설치 기능이 아니다.
- Supabase/API/비밀값/서명/패키지 변화 없음. 회귀는 route 계약·기존 SPA/API·375/1440px 화면/키보드/AA 대비·운영307→APK 다운로드로 확인한다.
- 출시 확인: 5d5acb0/Actions37203826300 success/Vercel dpl_34DnnRMr9ZKgoneUvEdTezbDwTt2 READY. 고정 안내200/no-store, 고정 APK307/no-store→파일200/61,942,571bytes/기존 검증 SHA256일치. 기존 미커밋 native 변경은 배포 커밋에서 제외했다.

## 2026-10-04 — 공통 알림·앱 아이콘 표시 계약

- AppNotice는 로그인 전후 message를 표시하는 작은 컴포넌트다. 순수 getAppMessagePresentation은 알려진 세션 코드/단독 기계 코드/실패/성공/검증/정보 순으로 분류한다. 원래 message 상태와 성공5초 자동 숨김 useEffect는 변경하지 않는다.
- appTheme의 범위 선택자가 이전 styles.css 메시지 장식을 덮어쓴다. 역할/아이콘/제목/본문으로 구분하고 CSS는 기존 의미 색·간격·텍스트 토큰을 사용한다. 새 세션 처리나 DB/API 변경 없음.
- mobile app.json의 icon/Android adaptiveIcon foreground는 저장소 PNG 자산을 가리킨다. 앱 패키지/버전/서명/권한을 유지하며 icon prebuild 결과는 새 APK에 포함된다. 웹 재배포만으로 launcher 아이콘이 바뀌지 않는다.
- 검증/배포: 알림·아이콘 제품93d1d4d는 main/GitHub Actions37201107595/Vercel dpl_CCBSdQr6Xp97HgMzq4EMJgGXCzRV READY·HTTP200 확인. 무료 preview APK11afaede FINISHED·공개 HTTP200·기존 서명/동일 JS bundle·Android16 install -r 및 아이콘/로그인 유지 확인. 이전 미커밋 native 집중 상태 코드는 APK 아카이브에 유지하지만 이번 웹 배포 커밋에는 포함하지 않는다. 최종 브라우저 포함 전체963/963, Edge21, 모바일 타입/웹 빌드 통과.

## 2026-10-04 — APK 배포와 웹 업데이트 구분

- 실제 앱은 native App/FocusStatusPanel/Android module과 Vercel origin의 단일 WebFeatureScreen으로 구성된다. 웹 UI·자료는 서버 배포/재로드로 바뀌며 앱 로그인·상단 집중 설정·OS 권한/브리지는 설치한 APK의 코드다.
- 현재 mobile 의존성에 expo-updates가 없고 app.json/eas.json에 updates URL/runtimeVersion/channel이 없다. EAS Build는 새 설치 파일을 만드는 경로이며 설치된 APK 자동 업데이트를 뜻하지 않는다. OTA 도입은 이번 공개 링크 갱신 범위 밖이다.
- native 공개 배포는 앱 폴더에서 EAS preview APK/free internal 및 기존 원격 서명을 사용한다. 업로드 전 .easignore 기반 archive 파일/최신 소스 해시 검사, 완료 후 HTTP 다운로드/인증서 일치/adb install -r·화면 검증을 수행한다. 미커밋 소스 업로드의 gitCommitHash는 기준 HEAD 메타데이터이며 실제 소스 내용은 아카이브/산출물로 검증한다.
- 2026-10-04 공개 APK는 preview de8fb01c FINISHED·HTTP200·기존 인증서 및 로컬 검증 JS bundle 해시 일치를 확인했다. 빌드별 URL을 새로 제공하며 과거 URL의 파일을 자동 교체하지 않는다. 설치 시 삭제/데이터 초기화 없이 같은 패키지·서명 업데이트로 적용한다. 현재 versionName0.1.0/versionCode1을 이번 링크 갱신에서 임의 변경하지 않았다.

## 2026-10-04 — Android 집중 상태 UI·적용 확인 계약

- `FocusStatusPanel.tsx`는 기존 mobilePalette를 사용하여 상단 상태/확인 시각과 상세 모달을 공유한다. `focusStatus.ts`의 순수 표시 함수는 작업·오류·지원·권한·revision·ACK 신선도·lease·로컬 앱 규칙을 순서대로 확인한다. 새 색상 체계/웹 화면 복제는 하지 않는다.
- `App.runFocusAction`은 연결/확인/해제 진행을 공부 busy와 분리한다. 동시 확인을 하나의 후속 요청으로 합치고 계정이 바뀐 뒤 끝난 결과는 UI에 반영하지 않는다. 로그아웃의 해제/인증 종료도 같은 작업 순서에 포함하고 확인 도중의 명시적 로그아웃은 소유자별 콜백으로 우선 예약한다. 로컬 status/설정 호출 실패는 복구 메시지로 표시한다.
- 기존 화면 복귀/공부 상태 변경 재확인과 foreground 60초 확인을 사용하며 background polling은 하지 않는다. 재확인은 `reconcileStudyFocus`만 호출하여 Expo 토큰/기기 등록과 분리한다.
- `reconcileStudyFocus`는 적용 직후 현재 권한으로 ACK하고 성공 뒤 서버 snapshot을 다시 읽는다. 변경 revision은 최대2회 재조정하며 다른 installation/해제 기기는 null로 반환한다. ACK 시각을 클라이언트에서 만들어내지 않는다.
- 운영 snapshot/ACK 함수 정의는 Supabase MCP 읽기로 확인했다. DB/RLS/RPC/Edge/마이그레이션/Android 규칙 구현은 변경하지 않았다. 앱 UI 변경이므로 새 APK가 필요하고 Vercel 자동 웹 배포 대상이 아니다.
- actual App/컴포넌트/서비스의 Babel 실행 테스트는 RN host·native/transport 경계만 대체한다. OS 방해금지/푸시 성공은 실제 휴대폰 검증으로 분리한다.

## 2026-10-04 — Android 설정 복귀 카메라 복구 계약

- visibilitychange/focus와 기존5초 health 검사에서 foreground만 검사한다. ended/no-track 즉시1회, muted/no-frame15초 후1회 복구. visible-frame 확인 시만 예산 초기화. in-flight/attempt ID로 오래된 요청이 새 UI/자원을 정리하지 못하게 한다.
- 자동 복구 전후 study_sessions 기존 RLS query로 소유권/active/ended_at/paused_at/lease_expires_at 검증. 현재 사용자/세션/카메라 의도/lease/전환 중 상태를 async 경계마다 재검증. 새 DB/RPC/Edge/마이그레이션 없음.
- 추가 요청: `{type:"STUDY_WEB_CAMERA_PERMISSION_CHECK",requestId}` (정확히2필드). 기존 STUDY_NATIVE_CAMERA_PERMISSION 응답/ID 재사용. capability studyRoomNativeCameraPermissionCheck가 없는 APK에는 interactive 메시지를 보내지 않고 수동 복구 안내. native PermissionsAndroid.check만 실행한다.
- react-native-webview patch exact first-party/video-only 정책에 OS CAMERA 미허용/중간 철회 fail-closed 추가. 권한 요청은 기존 명시적 설명→request 버튼에만 둔다. Android 권한·DND 설정 변경 없음.
- 오류/배경 전환은 제외시간 보존 후 presence 초기화하며 자리비움 경고를 만들지 않는다. 원격 휴식 관찰은 영상 정리, 이미 휴식 중인 explicit resume preparation은 보존한다.
- 실제 마운트 main의 transport/검출기 경계만 예시화한다. native callback은 설치 Java 코드에서 추출해 granted/denied/철회 경쟁 실행. Android16 실제 미디어·예시 세션 검증과 실사용 검증을 구분한다.
- 웹 GitHub Actions production, native CHECK/Java 정책은 같은 서명 새 APK에 반영하고 설치 후 확인한다.

## 2026-10-04 — 전체 페이지·인증 전/네이티브 디자인 누락 보완

- 기존 색상/간격/크기 토큰을 :root에 선언해 dashboard와 login-shell이 재사용한다. 레이아웃/페이지 스타일은 .dashboard-redesign/.login-shell 범위로 유지하고 lazy CSS보다 명시적 컴포넌트 선택자를 우선한다.
- 조건부 휴식/복귀/시작 전 카드와 편집·회고·기록·피드/숲 보조 문자도 외곽과 동일한 토큰을 사용한다. 주요 버튼44px, 보조14px, AA 대비를 실제 computed style로 검사한다. 작은 checkbox/radio 그림과 label 조작 영역은 구분한다.
- 네이티브 최초 로그인/연결/fallback은 별도 화면 구현을 유지하며 mobilePalette/StyleSheet를 같은 semantic 값에 맞춘다. 로그인 ScrollView/입력 이름/disabled 색/회고 선택 최소44px는 표시·접근성 변경이다. 인증/API/권한/카메라/DND 이벤트는 바꾸지 않는다.
- actualStudyMounted의 실제 entrypoint/예시 transport로1440/375px와 기존 세션 동작을 검증하고, native actual component 렌더 트리 및 팔레트 비교로 디자인 계약을 검사한다. OS 실기기 검증과 혼동하지 않는다.
- 배포 경계:웹 CSS는 운영 웹 배포 후 기존 APK WebView에 적용된다. 네이티브 스타일은 새 APK가 필요하다. 이번 변경은 로컬 수정만이며 커밋/푸시/운영 배포/새 APK 설치는 별도 요청 후 진행한다. Supabase/DB/RLS/RPC/Edge/인증 설정 변경 없음.

## 2026-10-02 — 전체 페이지 공통 테마

- main.tsx의 마지막 appTheme.css가 기존 CSS 위에 로그인 후 페이지/모달을 .dashboard-redesign 범위로 통일한다. 기존 primary/surface/ink/muted/border/semantic/spacing/radius 토큰에 글자 크기 14/15/16/20/24/30px, line 1.65, motion 160ms를 더한다. lazy 피드/리포트 CSS보다 범위 선택자 우선순위를 높여 테마 재혼합을 막는다.
- 기능 컴포넌트를 복제하지 않고 카드/폼/페이지 헤더·상태 배지의 표시만 변경한다. AccessibleDialog의 focus trap/ESC/포커스 복귀는 그대로다.
- StudyForestSection은 방향 패드 마크업만 제거하고 기존 handler·3D target callbacks를 유지한다. 작은 입력 안내/aria-describedby 및 성장 단계 details를 사용한다. 실제 환경 색과 보상 아이템을 지우지 않는다.
- Chromium은 main 실제 컴포넌트와 API 스키마를 따르는 transport fixture를 사용한다. 회복 모달·카메라 대비·각 탭/계획/기록·PC1440/모바일375·기존 세션 행동을 확인한다. 실제 Android 운영 확인은 별도다.
- DB/RPC/API/권한/모바일 번들 변경 없음. 웹 production 배포 후 기존 Android WebView 재조회로 적용한다.

## 2026-10-02 — 공통 대시보드 디자인

- DashboardNavigation와 dashboardRedesign.css는 로그인 후 웹 셸에서만 사용한다. PC 800px 초과는 상단 메뉴/2열 집중, 800px 이하는 하단 메뉴/1열이며 safe-area 여백을 적용한다. 네이티브 단일 WebView는 같은 배포를 재사용하고 별도 토큰/데이터를 복제하지 않는다.
- 실제 공부 패널 compact 옵션은 현재 제목/누적/남은 분량을 먼저 표시하고 상세 구간/원래 계획/반복/연결 목표를 details에 보존한다. timer 역할은 기존 window helper로 계산한 세션 인정 시간이며 오늘/월 누적과 구분한다.
- 카메라 DOM을 접힌 details 안에도 유지하고 오류/만료/회복 차단을 밖에 배치한다. 상태 정책과 서버 API는 변경하지 않는다. 기존 dashboard section order 선호를 카드에 재사용한다.
- UI 검증은 main을 esbuild로 렌더링하고 백엔드 transport만 fixture로 대체한다. FEED_BROWSER_MODULE/FEED_BROWSER_EXECUTABLE로 별도 Chromium 테스트를 실행한다. 375/1440 스크린샷·가독성·탐색·휴식·카메라 단일 표시·lease 경고를 확인한다.
- DB/RLS/RPC/마이그레이션/네이티브 번들 변경 없음. main production 배포 후 앱 WebView 재조회로 디자인 반영을 확인한다.

## 2026-10-01 — Android OAuth 및 카메라 권한 브리지

- 네이티브 Auth는 AsyncStorage에 PKCE verifier/session을 보존하고 expo-web-browser SDK53 호환 모듈로 외부 Google 인증을 연다. exact `studyroom://auth/callback` 단일 code만 교환하고 URL access/refresh token을 받지 않는다. 재시작 초기 URL은 로그인 세션이 없을 때만 처리하며 중복 code 교환은 한 번으로 합친다. OTP 8자리와 동일 사용자 WebView 티켓은 유지한다.
- 카메라 사전 확인은 기존 exact-origin 웹 브리지에 요청 ID가 있는 두 메시지(permission/settings)만 추가한다. native check→설명→request, granted/denied/blocked/cancelled 응답. 웹은 상태를 확인한 후 video-only getUserMedia를 실행한다. timeout/구 APK는 기존 OS 경로로 복구한다. 앱 설정은 고정 OS 앱 설정만 열고 임의 URL을 받지 않는다.
- Expo plugin/의존성 변경은 새 APK가 필요하다. 웹 버튼만 배포해서 네이티브 Google/권한 개선이 적용됐다고 보고하지 않는다.
- native WebCrypto는 기존 expo-crypto random/SHA256 adapter로 보완한다. authorize URL은 s256만 허용하고 Hermes TextEncoder를 사용한다. 새 APK 권한 응답 timeout은 cancelled로 중단하며 구 APK의 브리지 부재만 기존 OS 경로로 복구한다.
- 운영 확인: config 재조회에서 선언한 redirect 변경 0건·미선언 13개 보존, Google authorize 302→accounts.google.com. 실제 사용자 인증 완료와 이 읽기 전용 진입 확인을 구분한다.

## Supabase 변경 이력

### 2026-10-01 — 모바일 Google OAuth redirect

- 변경 대상: 프로젝트 bqohkdzvxbrokkmuhysx Auth `additional_redirect_urls`.
- 변경 내용/이유: 기존 6개 웹/개발 주소를 보존하고 `studyroom://auth/callback` 하나 추가, 시스템 브라우저에서 앱으로 복귀.
- 관련 기능: Android Google PKCE. 마이그레이션 파일 없음(DB/RLS/RPC 변경 없음).
- 확인 방법: Supabase CLI config pull/diff/push, 실제 push 1 property와 13 remote-only unchanged 확인, 적용 후 diff 재검증.
- 주의 사항: Google provider/client/secret·OTP 길이·site URL 변경 없음. 사용자 데이터나 기존 계정을 병합하지 않는다.

## 2026-10-01 — 선택적 클린 배포와 APK 업데이트

- CI의 boolean `workflow_dispatch.inputs.clean_build`는 기본 false다. 정상 push는 캐시를 유지하고 true 수동 실행만 `vercel deploy --force`로 이전 캐시 없이 재설치한다. 입력은 환경 변수로 전달하며 셸 명령 문자열에 직접 삽입하지 않는다. YAML 파싱/실제 수동 CI 성공 확인.
- preview APK는 기존 EAS keystore를 `--freeze-credentials`로 유지한다. 수정 카메라 패치 포함/로컬 비밀 제외를 확인하고 최종 APK와 이전 APK의 인증서 일치 후 `adb install -r`로 데이터 유지 업데이트했다. Play Store 제출/결제/새 키 생성 없음.

## 2026-10-01 — 리포트 출석 복합 키와 APK 아카이브

- 출석 리포트 조회는 소유자/기간 필터와 `local_date.asc` 정렬을 사용한다. `attendance_days` PK `(user_id, local_date)`에는 id가 없으므로 다른 테이블의 id 기반 pagination builder를 사용하지 않는다. DB/RLS/RPC/마이그레이션 변경 없음.
- `.easignore`는 기존 Git 제외 규칙을 유지하고 `output`, 로컬 테스트 캡처, 서명키/credentials, 생성 빌드 및 환경 비밀 파일을 EAS 아카이브에서 제외한다. `google-services.json`의 공개 앱 구성, 로컬 Expo 모듈 소스, 카메라 patch-package 파일은 포함한다. 아카이브 확인 후 기존 서명을 동결한 preview APK를 만든다.

## Supabase 변경 이력 — 2026-10-01 자리 비움 회복 경고 3회 기준

- 변경 대상: `camera-presence-warning` Edge Function 및 함께 번들되는 `_shared/recovery.ts`의 Slack 설명. 기존 사용자/세션 날짜 필터는 유지한다.
- 변경 내용/이유: 사용자 명시 지시로 생성 조건을 `absence_warning && absenceWarningCount >= 3`으로 변경하고 문구를 `3회 이상`으로 통일한다. 카메라 설정 경고는 계속 제외하며 같은 날짜 pending은 기존 helper로 재사용한다.
- 마이그레이션 파일: 없음. DB/RLS/인덱스/RPC/기존 데이터 변경 없음. API 요청/응답 구조와 카메라 제외 시간 정책은 바꾸지 않는다.
- 서버 인증: 기존 `verify_jwt=false`와 함수 내부 Bearer `auth.getUser`/세션 소유권 검증을 그대로 유지한다. 문턱 변경에 인증 설정 변경을 섞지 않는다.
- 확인 방법: MCP 배포 v22 ACTIVE와 원격 파일 일치, 무인증 POST 401, 실제 handler의 1·2회 미생성/3회 생성/4회 재사용/타계정·타날짜 제외/Slack 안내 회귀 테스트. SDK·runtime 버전 변경 없음.
- 주의 사항: 예정 알람 시각과 무관한 실제 세션 부재 경고 정책이다. 기존 2회 기준에서 만들어진 pending은 자동 해제하지 않는다. 개인 계정에 인위적 경고를 보내 배포 테스트하지 않는다.

## 2026-10-01 — 프로필 시간대 기준 공부 집계 수정

- 일·월 실시간 공부량의 경계는 `weeklyHabit.mjs`의 기존 `getZonedDateBoundaryMs(dateKey, timeZone)`를 공유한다. 다음 날짜의 실제 자정을 별도로 구하여 DST 날짜를 고정 24시간으로 가정하지 않는다.
- `studyTimeSummary` 일·월 API는 선택적인 `timeZone`을 추가한다. 웹 대시보드는 프로필 지역을 전달하며 기존 미지정 호출은 기기 지역을 사용해 호환된다. 세션 제외 시간 계산은 변경하지 않는다.
- 달력의 명시적 사용자 선택 월은 별도 nullable 상태로 보존한다. 선택하지 않았을 때만 `getStudyMonthKey(now, profileZone)`를 사용해 프로필 로드와 지역 월 변경을 반영한다.
- DB/RPC/Edge·Android 네이티브 변경이나 저장 기록 재작성은 없다. 웹 배포 후 기존 단일 WebView 앱을 재실행하여 수정된 화면을 받는다. 다른 기기 지역, 월/자정 경계, DST 23/25시간, 휴식 제외를 회귀 테스트한다.

## Supabase 변경 이력 — 2026-10-01 Android 앱·웹 단일 로그인 운영 반영

- 변경 대상/이유: 앱과 웹 로그인 저장소 차이를 안전한 일회용 티켓으로 연결하는 기존 로컬 설계를 운영에 적용했다. 기존 출석·타이머·회복 데이터/정책 변경 없음.
- 마이그레이션 파일: `supabase/migrations/20260930152103_mobile_web_auth_limit.sql`; Supabase MCP 적용 버전과 파일명 일치. 함수는 `service_role`만 실행 가능, 테이블 RLS 활성화와 인증 사용자 읽기/실행 금지 확인.
- 서버: `mobile-web-auth` v1 ACTIVE, `verify_jwt=true`, SHA256 `ca73a33a9c58584e24e9f56ab4f952b99cb7f3634026cd1fd3634a70411ea705`.
- Android 검사: `expo-device.isDevice`가 false인 에뮬레이터에서만 WebView 원격 검사를 허용한다. 실기기 APK는 검사 비활성화. 검사용 프로퍼티는 로그인·카메라 권한 정책을 우회하지 않는다.
- 카메라 origin: Android canonical URI의 끝 `/` 유무 두 정확한 표기를 허용한다. `startsWith`나 하위 도메인 허용으로 넓히지 않고, 비디오 단일 리소스만 기존 조건대로 허용한다. 설치된 Java guard를 컴파일/실행하는 회귀 테스트로 검증한다.
- 확인: 웹 운영 배포와 실제 에뮬레이터 6개 메뉴/앱 재실행의 동일 계정 Auth 교환을 확인했다. 카메라 권한과 진단용 영상 스트림도 확인했다. 세션 전 과정·계정 전환·티켓 재사용/만료·실기기 방해금지는 별도 검증이 남아 있다. 티켓·키·개인 기록은 로그에 출력하지 않는다.

## 2026-10-01 — 승인된 동일 서명 로컬 APK 검증

- 기존 기본 Keystore는 사용자 승인 후 EAS 프로젝트/패키지/기본 자격증명 이름을 제한한 읽기 전용 조회로만 다운로드한다. 키·비밀번호는 저장소 밖 ACL 제한 비공개 경로에 두고 Gradle에는 프로세스 환경변수로만 전달한다. 원격 키 생성·변경·삭제는 하지 않는다.
- 로컬 공개 Supabase 연결 설정은 배포된 클라이언트 번들의 anon/publishable 설정만 사용하며 서비스 키나 사용자 세션을 내려받지 않는다.
- Windows 모노레포 release 번들링은 생성된 Gradle `react.root`를 앱 폴더로 명시하고 로컬 빌드 프로세스에 `EXPO_NO_METRO_WORKSPACE_ROOT=1`, `NODE_ENV=production`을 적용했다. x86_64/arm64-v8a APK를 생성했고 설치 전 기존 인증서 일치를 검사한다. `adb install -r`만 사용하며 앱 데이터 삭제/재설치는 하지 않는다.
- WebGL 장면은 CDP `Page.captureScreenshot`에서 빠질 수 있으므로 ADB 전체 화면 캡처로 렌더링·이동을 검증한다. 카메라 진단은 로컬 임시 영상만 생성하고 스트림을 명시적으로 종료한다.
- 생성 Android 폴더·output·키 경로는 제품 커밋이나 EAS 업로드에 포함하지 않는다. 테스트 APK 설치 성공과 공개 EAS 배포 링크 갱신은 구분한다.

## Supabase 변경 이력 — 2026-09-30 Android 앱·웹 단일 로그인 (당시 로컬 구현)

- 변경 대상: `public.mobile_web_auth_limits`, `public.try_issue_mobile_web_auth_ticket(uuid)`, `mobile-web-auth` Edge Function.
- 변경 내용/이유: 네이티브 사용자 access token을 `auth.getUser`로 재검증하고 동일 계정의 `magiclink` 일회용 해시를 발급한다. 사용자별 5분 창에서 10회까지만 발급한다. 웹은 앱 WebView의 연결 nonce와 사용자 ID를 확인한 뒤 `verifyOtp(type='magiclink')`로 세션을 만든다. 장기 네이티브 토큰은 웹/URL에 전달하지 않는다.
- 마이그레이션 파일: `supabase/migrations/20260930000000_mobile_web_auth_limit.sql`. 소유자 기준 RLS가 켜져 있고 일반 `anon`/`authenticated` 테이블 접근과 함수 실행은 철회했으며 함수는 `service_role` 전용이다. 새 스키마는 아직 운영에 적용하지 않았다.
- API 요청/응답: `POST /functions/v1/mobile-web-auth` + 네이티브 `Authorization: Bearer <access token>` → `{token_hash,user_id,verification_type:'magiclink'}`. 401/429/503 오류와 모든 응답에 `Cache-Control: no-store`; 브라우저 CORS는 열지 않는다. Edge의 서비스 역할 키는 서버에만 둔다.
- 앱 구조: Android는 로그인 후 `https://study-room-attendance.vercel.app/#today` 한 WebView에서 웹 6개 섹션을 사용한다. 웹 임베드 게이트는 이전 웹 세션을 로컬에서 지우고 티켓 교환 전 보호 화면을 숨긴다. 웹 공부 상태 알림은 권위 있는 명령이 아니라 네이티브가 서버 세션·집중 상태를 재조회하는 힌트다. 연결 오류에는 네이티브 공부방 fallback을 제공한다.
- 카메라: `CAMERA`만 선언한다. `patch-package`가 `react-native-webview@13.13.5`의 Android `onPermissionRequest`에 정확한 첫 번째 HTTPS 출처와 단일 `RESOURCE_VIDEO_CAPTURE` 검사/거부를 적용한다. 오디오와 외부 프레임 카메라를 허용하지 않는다.
- 확인 방법: 신규 Edge/Deno·PGlite·웹·모바일 테스트, 전체 Node/웹 빌드/모바일 타입 검사, Android debug APK 컴파일·Java bytecode의 guard 확인. 운영 DB/Edge/웹/Auth 통합 및 Android 16 사용 흐름은 배포 전이므로 미검증이다.
- 주의 사항: 기존 운영 및 서명된 앱은 아직 이 코드가 아니다. 서비스 키·티켓 해시를 로그/문서에 기록하지 않으며, EAS 설치 앱을 다른 서명의 로컬 debug APK로 덮어쓰지 않는다.

## 2026-09-29 — Android 회복루틴·웹 기능 재사용

- Android 앱은 기존 Supabase Auth/세션·집중 모드 경로를 유지한다. 로그인/화면 복귀 및 시작 직전에 소유자의 `study_recovery_requests` 미제출 항목을 조회하고 기존 `submit_study_recovery_request` RPC로 제출한다. 서버 시작 RPC의 회복 요구와 화면 상태가 경합하면 목록을 다시 조회한다. 모든 요청이 해소된 뒤에만 선택한 할 일로 `start_study_session`을 다시 호출한다.
- 기술 피드·공부의 숲은 별도 네이티브 복제 대신 앱 안의 `react-native-webview`로 Vercel HTTPS `#feed`/`#forest`를 연다. 같은 출처만 WebView에 남기고 외부 HTTPS 원문은 OS 브라우저로 보낸다. 앱의 AsyncStorage 인증 토큰을 URL/스크립트로 전달하지 않으므로 웹 화면은 같은 계정으로 별도 로그인이 필요할 수 있다. 웹 화면에서 공부방으로 돌아올 때 서버 세션·기기 집중 상태를 다시 조회한다.
- 변경 위치: `apps/mobile/App.tsx`, `apps/mobile/src/WebFeatureScreen.tsx`, 모바일 의존성 및 Node 회귀 테스트. DB 스키마·RLS·RPC·Edge·웹 번들 변경 없음. EAS `preview` Android APK를 다시 빌드하여 배포한다.
- 확인: `scripts/mobile-otp.test.mjs`, `scripts/mobile-recovery.test.mjs`, `scripts/mobile-web-features.test.mjs`, `mobile:check`, 전체 `npm test`, 웹 빌드, 문서 검사. APK 컴파일 성공과 실제 휴대폰 로그인·회복 제출·3D 렌더링 확인은 구분한다.

## Supabase 변경 이력 — 2026-09-28 Android 집중 모드

- 변경 대상: `public.study_focus_state`, `public.study_focus_devices`, `study_sessions` 상태 전이 트리거, 기기 등록·확인·해제·상태 조회 RPC, `focus-sync` Edge, `attendance-cron` Edge.
- 변경 내용: 소유자별 서버 revision과 앱 적용 확인을 분리하고, 활성·비휴식·lease 내 세션일 때만 집중을 요청한다. 출석 Cron은 데이터 전용 Expo 신호를 보내며 기기는 수신 신호가 아닌 서버 최신 상태를 재조회한다. 기기 직접 변경은 RLS/권한으로 금지하고 본인 RPC만 허용한다.
- 변경 이유: 웹 중심 공부 상태를 Android 앱의 전용 방해금지 규칙에 안전하게 반영하고, 푸시 미전달·권한 거부 시에도 공부 기록을 유지하기 위해서다.
- 관련 기능: `memory-bank/prd-android-focus-mode.md`; Expo preview APK/Android 15+ 앱 소유 AutomaticZenRule.
- 마이그레이션 파일: `supabase/migrations/20260927150154_android_focus_mode.sql`, 운영 프로젝트 `bqohkdzvxbrokkmuhysx`에 같은 버전으로 추가형 적용. 기존 데이터 삭제 없음.
- 확인 방법: PGlite 상태/RLS 테스트 3건, Edge 테스트 12건, 전체 Node 815건 중 790 통과/25 환경 건너뜀/실패 0, live 트리거 1·소유자 정책 2·인증 사용자 직접 UPDATE 차단·상태 RPC 실행 확인. `focus-sync` CORS preflight 204, 무인증 POST 401.
- 주의 사항: FCM 서비스 계정 개인 키는 저장소·문서에 넣지 않는다. Android 푸시/알람은 즉시 실행이 보장되지 않아 실기기 확인 전 성공으로 표시하지 않는다. 새 기기 연결 전 운영 기기 수 0은 정상이다.

## Supabase 변경 이력 — 2026-09-24 기술 피드 발견순 목록과 부가 작업 분리

- 변경 대상: `public.tech_feed_list` RPC, tech-feed/tech-feed-worker Edge 진입점과 공유 수집 파이프라인, 웹 기사 카드.
- 변경 내용/이유: 목록과 커서의 정렬 기준을 `discovered_at DESC,id DESC`로 통일한다. 원문 발행일은 별도 메타데이터로 유지한다. 원문이 오래된 신규 발견 글이 발행일순으로 뒤에 묻히던 문제를 해결한다.
- 마이그레이션 파일: `supabase/migrations/20260923160433_tech_feed_discovery_order.sql` (추가형 함수 교체; 기존 `tech_feed_article_discovered` 인덱스 사용). 운영 Supabase에 20260923160433 버전으로 적용했고 함수 정의에서 발견순 정렬을 확인했다.
- 수집 완료: 정시 실행과 수동 새 글 확인은 발견·저장 결과와 run/refresh lease를 먼저 확정한다. 번역·미디어는 EdgeRuntime.waitUntil에 등록한 선택적 부가 작업으로 분리하며 각각 20초·12초 제한을 둔다. 수집 성공은 번역·미디어 성공을 보장하지 않는다.
- 확인 방법: PGlite의 20건 커서/저장 목록·오래된 발행일 신규 발견, 수동·정시 미디어 지연 격리, 백그라운드 번역, 카드의 두 날짜, 전체 테스트/Edge 검사/웹 빌드. 운영에서 RPC 정렬·run 종료·무인증 함수 응답을 재검증한다.
- 주의 사항: 원문 링크의 재조회는 별도 신규 발견으로 만들지 않고 최초 `discovered_at`을 유지한다. 기존 보존 정책·RLS·무료 사용량 한도·RSS 승인 상태는 유지한다.

## 2026-09-23 — 세션 할 일 모달의 로컬 디자인 토큰

- 웹은 기존 Vite/React 구조를 유지한다. 세션 모달에만 영향을 주도록 sessionTodoModal.css를 styles.css와 improvements.css 뒤에 import한다.
- 모달 내부에 primary·표면·텍스트·상태 색, 타이포그래피·간격·모서리·그림자·모션 변수를 정의한다. 앱 전체 전역 테마나 API는 변경하지 않는다.
- 세션 할 일 JSX는 기존 저장/선택 핸들러를 그대로 두고 제목 입력 라벨, 시간 fieldset, dialog 설명 연결을 보완한다.
- 검증은 실제 main.tsx를 마운트한 합성 로그인 브라우저 테스트를 375px·1440px에서 실행하고, 전체 테스트·TypeScript/Vite 빌드를 확인한다. 저장소에 lint 스크립트가 없어 린트 실행은 별도 스크립트 도입 전까지 불가하다.

## Supabase 변경 이력 — 2026-09-23 기술 피드 원문 언어

- 변경 대상: tech-feed/tech-feed-worker Edge 공유 코드와 웹 화면. DB 테이블·RLS·RPC·cron 변경 없음; 마이그레이션 파일 없음.
- 변경 내용/이유: 원문 제목·소개에서 언어를 판별하고 기존 tech_feed_filter_candidates의 사용자 가시 항목을 언어·주제로 거른 뒤 tech_feed_list(p_article_ids)에 전달한다. 기존 페이지 20개·total·cursor가 필터 전체에서 일치한다.
- 수집: focusedSearchQuery의 한 주제 순환 5단계 중 2단계에 한국어 기술 사례/실무 구현 검색어를 사용한다. 검색 호출 수와 비용 경계는 그대로다. RSS 이용조건 대기 상태는 변경하지 않는다.
- 확인 방법: core 언어 판별, API 입력 제한, 20건 초과 후보 필터, 검색어 순환, 웹 카드·모바일 검증, 배포 후 Edge 버전/인증 상태 확인.

## Supabase 변경 이력 — 2026-09-23 기술 피드 추천 보완

- 변경 대상: tech-feed Edge의 공유 tech-feed-briefing.mjs.
- 변경 내용/이유: AI JSON 예시에 insights와 highlights를 함께 명시해 엄격한 응답 검증과 일치시켰다. 잘못된 falsy 캐시는 추천 없음으로 은폐하지 않고 거절한다. 구형 undefined highlights만 호환한다.
- 관련 기능: 일일 브리핑과 최대 3개 하이라이트. 기존 한 번의 요청·유효 캐시 재사용·무료 예산 정책 유지.
- 마이그레이션 파일: 없음. DB/RLS/cron/worker 변경 없음. tech-feed만 배포한다.
- 확인 방법: 전체 787건 및 Edge 11건 통과, PC/390px 브라우저 검증. 운영 배포 결과는 progress에 기록한다.

## Supabase 변경 이력 — 2026-09-21 실제 공부/일정 연결 (운영 적용 완료)

- 변경 대상: study_todo_plans, study_actual_sessions, study_todo_segments, study_schedule_adjustments 및 private 요청 멱등성 기록. 세션 상태 전환 trigger와 preview/confirm/state/report/checkpoint/pause wrapper RPC.
- 이유: 원래 계획을 보존하면서 현재 집중할 일별 실제 구간을 기록하고, 충돌 연쇄 변경과 세션 시작/재개/전환을 원자적으로 확정한다.
- 마이그레이션: supabase/migrations/20260921095213_actual_study_tracking.sql. 상세 API 계약: docs/session-plan/session-api.md.
- 보안: 소유자 SELECT RLS, 구간/이력 직접 수정 권한 없음, SECURITY DEFINER 고정 search_path/소유권 검증, 사용자당 열린 구간 유일성.
- 호환: 기존 start/pause/resume/end/expiry 경로 유지. complete_study_session의 완료 대상은 원래 날짜 또는 세션 연결 항목으로 좁게 확장해 자정 이후 이동 항목도 완료할 수 있다.
- 일관성: 요청 UUID 재사용, 전체 일정 revision 재검증, 사용자 advisory/세션 row/짧은 todo-link table lock,3초 lock timeout,실제 연쇄2,000건 guard. 비충돌 미래 반복 항목 수는 guard를 소모하지 않는다.
- 정밀도: 제안 시각은 서버 분 단위, 실제 구간은 정확한 확정 시각. 기존 날짜/두 시각 표현으로 역변환되지 않는 DST 구간은 전체 차단한다.
- 과거: 배분 미확인은 유지하고 최초 시작 지연 평가에서 제외. first_tracked_at을 진짜 최초 시작으로 간주하지 않는다. 제목만 있던 할 일은 최초 시간 입력 시 원래 계획을 캡처한다.
- 검증: SQL34/34,초기구현전체748/748,리뷰3건수정후 재리뷰통과,수정 SQL에 실제 PostgreSQL18 별도연결 경합4/4통과.
- 주의: 짧은 table lock은 다른 사용자 일정 쓰기도 잠깐 직렬화한다. 브라우저가 아직 전송하지 않은 카메라 부재 시간은 서버가 복구할 수 없으므로 웹이 경계/기존동기화주기에 checkpoint한다. 2026-09-21 운영 적용 완료. 적용 시 study_todo_plans 242건이 backfill됐고(timed 49, eligible 6) 기존 활성 세션은 tracking row가 없어 trigger가 즉시 return하므로 영향이 없다. 적용된 이력 version은 20260921135457로 기록돼 파일명 20260921095213과 다르다.

## Supabase 변경 이력 — 2026-09-15 AI 호출 예산 재조정 (운영 적용 완료)

- 변경 대상: `public.coach_ai_usage`, `coaching_private.reserve_ai`, `coaching_private.refund_ai`(신규), `public.coach_reserve_ai`, `public.coach_refund_ai`(신규), `public.tech_feed_begin_summary_attempt`, cron `study-room-tech-feed-hourly`.
- 변경 내용: attempts CHECK 6→15, 환급 불가 `calls` 칼럼(0~40) 추가, reserve에 `p_cap` 인자 추가(기본 15·워커 12), 실패 환급 함수 추가, cron 스케줄 `* * * * *`→`0 * * * *`.
- 변경 이유: 공유 예산 6회를 매분 도는 수집 워커가 수 분 만에 소진해 사용자 브리핑이 호출을 얻지 못했고, 수집 30건/일을 요약 18건/일 역량으로 따라잡을 수 없었다.
- 관련 기능: 기술 피드 기사 요약, 일일 브리핑, 재시작 코치(예산 공유).
- 마이그레이션 파일: `supabase/migrations/20260915020000_tech_feed_ai_budget.sql`
- 확인 방법: `node --test supabase/functions/_shared/tech-feed-ai-budget-db.test.mjs` (PGlite 5건). 운영 적용 후 `coach_ai_usage.calls` 증가와 cron 스케줄을 재확인한다.
- 적용 결과(2026-09-15 02:06~02:22 UTC): Management API로 마이그레이션 실행, `supabase_migrations.schema_migrations`에 20260915020000 기록. attempts CHECK 0~15, calls 칼럼 생성, 기존 행 calls=attempts 백필(6). 함수 4개 재생성 확인, `tech_feed_begin_summary_attempt`에 cap 12 반영 확인. cron jobid 5 스케줄 `* * * * *`→`0 * * * *` 확인(02:06 이후 매분 실행 중단).
- Edge 배포: tech-feed v23, tech-feed-worker v25 ACTIVE(중간 v22/v24는 환급 버그 수정 전 배포). 무인증 POST 401 유지.
- 배포 후 발견·수정한 결함: `refundAiCall`이 store에 바인딩된 owner를 쓰지 않아 브리핑 경로에서 `p_user_id`가 undefined로 전달돼 환급이 항상 실패했다(운영에서 attempts 6→7로 확인). 기본값을 owner로 고치고 Deno store 테스트 1건 추가 후 재배포. 재검증에서 calls 7→8·attempts 7 유지로 환급 동작 확인.
- 주의 사항: 기존 1인자 호출(`coaching-store.mjs` 빈 본문 RPC, `tech_feed_briefing_reserve`)은 기본값으로 해석된다. 운영 브리핑 클릭이 정상적으로 claim/reserve/finish까지 도달함을 확인했다.


## Supabase 변경 이력 — 2026-09-15 기술 피드 일일 브리핑 (DB·Edge 적용)

- 변경 대상: tech_feed_articles 분류 provenance/version/topics/lease, 개인 tech_feed_briefings 캐시, service 전용 visibility/list/facets/snapshot/claim/reserve/finish RPC 및 기존 cleanup 경로.
- 변경 이유: 요약 성공과 분류를 분리하고, 전체 가시성 기준 보기 필터·오늘 통계와 버튼형 AI 인사이트를 제공한다.
- 마이그레이션 파일: supabase/migrations/20260914164719_tech_feed_daily_briefing.sql. MCP 운영 적용 완료. CLI 최초 생성번호20260914153404에서 MCP 기록번호로 파일명만 동기화했으며 SQL SHA256은5AE41C98F61C2A09824B8D100D8BB97A5D4D11EA2BA9919D5654CDFA4D1994E3으로 동일.
- API: list에 topic/source_key 및 필터 적용 후 total 추가; facets는 latest/saved 전체 가시성의 주제·실제 출처별 count; briefing은 읽기 전용, briefing_generate만 AI 호출. 원래5개 RPC 인자는 유지하고 마지막2개 default 인자로 단일 함수 시그니처를 사용한다.
- 시간/근거: 서버 프로필 시간대의 discovered_at 반개구간, 전체 통계와 최대24개/소개160~2000자 표본 분리. 전체 메시지는32000자 안으로 조정하며 사용자 관심 문장을 AI에 전달하거나 공유 태그로 저장하지 않는다.
- 권한/쿼터: owner RLS, 브리핑 본문 직접 SELECT 차단(무해한 소유자 메타데이터만 허용), 모든 분석 표본 권한을 읽기·예약·저장 시 재검증. 기존6회 실제 호출 공유,90초 lease/20초 provider/30초 request. 새 cron/유료 fallback 없음.
- 확인 방법: 독립 리뷰 spec PASS/quality APPROVED, parent194/194 회귀. 로컬 PGlite1000/5000개 saved scale에서 list11/38ms, facets SQL47/197ms + JS28/120ms; 후보 JSON1.12/5.61MB. 실제 운영 네트워크/무한 기록 규모 보장은 아니며 후보 로드는 기록 수에 선형 증가한다.
- 운영 확인 완료: RLS/grants·구버전5인자 RPC·실측 list11.915ms/facets4.358ms/daily cold836.367ms, 무인증 API401. 상세 배포 근거는 docs/tech-feed/daily-briefing-verification.md. 분류RPC 취소 전달은 기존10초fetch상한에 의존하는 Minor 잔여 항목이다.


## Supabase 변경 이력 — 2026-09-14 운영 재시작

- 변경 대상: 독서실 프로젝트 next-js (bqohkdzvxbrokkmuhysx) 서비스 런타임.
- 변경 내용/이유: 사용자 승인 후 Auth/REST/관리 지표 지연 복구 목적으로 공식 Management API restart1회. CLI/MCP에서 프로젝트 확인 및 SQL 전후 검사.
- 마이그레이션 파일: 없음. 스키마/정책/함수/cron/키/과금 변경 없음.
- 확인 방법:14:03:47UTC 요청200→RESTARTING→14:07:45UTC DB 실제 기동→14:08UTC Auth healthy 및 공개REST/SQL 성공, metrics/disk/util 조회 회복.
- 주의 사항: 운영 재시작은 웹 재배포와 별개. 짧은 서비스 중단 발생; cron 재개는 확인했지만 재시작 중 개별 알림 전달과 실제 사용자 UI는 미검증. 정확한 최초 자원 원인은 미확정.


## 2026-09-14 — 대시보드 조회와 회복 제출 대기 분리

- dashboardData.ts runBoundedRequest는 기본15초 전체 작업 deadline. AbortSignal을8종 PostgREST 쿼리와 페이지에 전달하며 signal을 보지 않는 auth/transport 대기도 race로 종료한다. RPC 회복 제출/세션 시작도 같은 경계 사용.
- main.tsx dashboardLoading은 mutation busy와 독립. latest attempt+userId로 오래된 결과를 무시하고 계정 이탈 시 abort. 초기 미조회는 시작 허용하지 않되 실패/재시도 안내. 기존 성공 데이터가 있으면 배경 실패 시 유지.
- 회복 pending 상태가 있으면 시작 액션은 회복폼을 열고 start_study_session 호출 전 차단. RPC 성공 때만 제출 처리, 전체 재조회는 비차단. 응답 유실은 성공 단정 없이 입력 보존 및 서버 상태 재검증.
- DB/RLS/RPC 계약/서버 함수/cron 변경 없음. 기존 main→GitHub Actions→Vercel 배포 경로 사용.


## 2026-09-14 — 현재 미디어 운영 버전

- DB20260913162410 + APIv19/workerv21 + main5946f98, Vercel dpl_4k2TKx7giQ4jsqxMooyjR1RPzHxs READY.
- 기존 main→GitHub Actions→Vercel 경로 최종34768906400 success. 운영root/미디어chunk/CSS200 및 API무인증401.
- 예약 실행은 기존cron 그대로, 실제원문 이미지·영상 캐시 및 소유자목록 반환 확인. 별도 키/유료API/cron/검색quota 변경 없음.
- 장애재발방지: hosted Edge에 없는 전역 Buffer를 가정하지 않으며 실제body수신회귀를 Deno subprocess로검증. 성공확인은 deploy명령이 아니라 run완료/캐시/API출력까지 수행.


## 2026-09-14 — 미디어 Edge 운영 호환성 보정

- 현재 APIv19/workerv21 ACTIVE, verify_jwt=true. node:buffer 명시 import로 운영 Deno2.1.4 body decode 복구.
- 기본 Node 테스트 외에 전역 Buffer 없는 Deno subprocess 응답 수신 완료를 Edge 검사에 추가(총9개).
- 정기16:30/16:31UTC 연속 completed, 실제 이미지와영상 캐시 ready. source별 차단/크기/시간 제한 실패는 failed/backoff로 유지.
- DB migration20260913162410, 새로운 스키마 변경 없음. 초기 기능웹80555d8 / Vercel dpl_4HdauodMr5XhWhdGfYJFKbt8fbBx READY. 호환성 패치 후속커밋/최종배포는 progress 참조.


## 2026-09-14 — 미디어 운영 DB·함수 적용

- MCP apply_migration 성공. 운영 버전20260913162410에 맞춰 파일을 supabase/migrations/20260913162410_tech_feed_media.sql로 정렬(아래 초안 파일명은 이력).
- tech-feed v18 / tech-feed-worker v20 ACTIVE, verify_jwt=true. CLI2.117.0 --use-api로 두 함수만 배포, feedMedia 공용 모듈 번들 업로드 확인.
- 운영 media 테이블 RLS=true, authenticated SELECT=false/claim EXECUTE=false. 정기 worker가 별도 수동 DB 작업 없이 기존 영상 기사 media ready를 기록(16:25:11UTC).
- 최종620/620·Edge8/8·웹 빌드 통과, 모바일/README 검사 통과. 웹 main 푸시/Actions 배포는 진행 중.


## Supabase 변경 이력 — 2026-09-14 피드 미디어

- 변경 대상: tech_feed_media 테이블, media_claim/allowed/finish RPC, tech_feed_list 반환 media 필드, tech-feed/tech-feed-worker 공유 모듈.
- 이유: 기존/새 기사에 원문 대표 이미지와 클릭형 첨부 영상을 연결하고 중복 수집을 줄임.
- 마이그레이션: supabase/migrations/20260913155837_tech_feed_media.sql (로컬 작성, 운영 적용 결과는 후속 기록).
- 캐시 article_id FK cascade/PK + sponsor_user_id FK/index. RLS 활성, anon/authenticated/PUBLIC 테이블 및 RPC 접근 금지, service_role만 허용. 기존 목록 개인별 가시성과 커서 유지.
- 짧은 advisory transaction lock으로 claim 직렬화, 최대3개/90초 lease, 원문 URL snapshot 일치, 수신중지 재검증, 성공·없음7일/오류1일 backoff. 미디어 실패는 텍스트 수집/번역/요약 실패로 전파하지 않음.
- 기존 transport로 원문 HTML만 제한적으로 확인. 미디어 단계12초/개별6초,1MiB, HTTPS/DNS/TLS pin/리디렉션 재검증. 외부 HTML/스크립트 삽입 없음, 허용 제공자 ID로 iframe URL 재구성.
- 정기/수동 수집의 번역과 미디어를 병렬 실행. 수동 RSS 하위 실행에서는 미디어를 끄고 최종1회만 실행. 신규 cron/키/AI예산 변경 없음.
- API media:null|{image_url,video:{provider,id}|null}; 브라우저는 URL 재검증, 이미지 지연 로드·no-referrer, 클릭 후 iframe, autoplay=0, 종료 시 iframe 제거.
- 확인 방법: PGlite 전체 feed migration/RLS/공유 lease/캐시 격리 테스트; scripts/feed-media-browser-check.js를 로컬 feed-ui-preview + Playwright CLI run-code --filename으로 실행.


## 2026-09-14 — 기술 블로그 피드 운영 버전 확정

- APIv17/workerv19, 웹 기능커밋 f520c2f, Vercel dpl_7DoZZV5fwKzE3oR7eaEiDjcy7Ykw READY. 기존 main→Actions34766565479 배포 경로 사용.
- 운영도메인/새피드chunk/CSS HTTP200. 별도스키마/cron/환경변수 변경 없음. 문서완료기록은 [skip ci]로 남겨 같은 웹을 재배포하지 않음.
- 정기 worker실행 completed는 확인했으나 신규수집0건이므로 모든 관심 주제의 새글도착/번역완료를 보장하지 않는다. 실제 계정에서 새 글 확인으로 현재 관심의 다음 의도 검색 가능.


## Supabase 변경 이력 — 2026-09-14 기술 블로그 피드

- 대상: tech-feed, tech-feed-worker 두 Edge Function 공유 검색/텍스트 정책.
- CLI2.117.0 functions deploy 두이름 --project-ref bqohkdzvxbrokkmuhysx --use-api 로 배포. config.toml 없는 기존 구조에서도 명시 대상/기본JWT로 정상 배포.
- 확인: MCP list_edge_functions에서 v17/v19 ACTIVE·verify_jwt=true. 새로운 packages/core/src/feedContent.mjs 상대 의존성도 업로드 확인.
- migration 없음. DB 스키마/RLS/함수권한/cron/비밀값/무료예산 변경 없음. 웹은 기존 GitHub Actions 경로 사용.


## 2026-09-14 — 기술 블로그 검색·콘텐츠 품질

- tech-feed-query.mjs가 관심별3종 검색 의도(블로그/사례/가이드)를 순환한다. query_cursor는 기존 실제 예약 때만 증가하며 별도 검색 호출이나 DB 필드를 추가하지 않는다.
- Tavily 기본검색: time_range:year, include_published_date:true, 알려진 영상 domain 제외. 기존5개 결과/시간제한/응답크기/무료계정 검증 유지. 원문 페이지를 추가 요청하지 않는다.
- packages/core/src/feedContent.mjs는 순수 공용 정책이다. Edge 수집 전 신규 소개를 정제하고 웹에서는 기존 기록에도 안전한 표시를 적용한다. Deno/웹이 같은 모듈을 상대 경로로 번들링하며 비밀값 의존은 없다.
- 수집 후 DeepL은 기존 원문 snapshot/문자 예산을 그대로 사용한다. 기존 DB 텍스트를 일괄 덮어쓰거나 저장·할일 연결을 삭제하지 않는다.
- Supabase 변경 대상: 두 Edge 진입점이 공유하는 검색 어댑터. 스키마/RLS/인덱스/권한/cron/비밀값 변경 없음, migration 없음. 배포 시 tech-feed와 tech-feed-worker 모두 반영해야 한다.
- UI는 피드 CSS에만 고정 버전 Pretendard CDN을 로드하고 네트워크 실패 시 시스템 고딕으로 대체한다. 출처·제목은 safeFeedUrl을 통과한 같은 원문 링크를 사용한다.
- 공식 API 옵션: https://docs.tavily.com/documentation/api-reference/endpoint/search ; 폰트: https://github.com/orioncactus/pretendard .


## 2026-09-14 — 웹 운영 버전 확정

- 번역·페이지형 피드 코드 b4ed456을 기존 main→GitHub Actions34764366095 경로로 배포, Vercel dpl_FCNMA6k5hHrybKEsnT3QrteMeLGr READY. 운영 URL HTTP200 및 실제 새피드chunk의 페이지/한국어/펼치기 확인.
- 이번 배포는 웹 배포와 기존 운영 DB/서버 코드의 Git 정합화만 수행. DB20260913140137/APIv16/workerv18을 다시 적용하거나 Cron/비밀값을 변경하지 않았다.
- 이하 웹 미배포/승인대기 기록은 이전 상태다. 배포 직후 오류조회0, 운영 계정 E2E는 별도 미검증.

## 2026-09-13 — 피드 페이지와 읽기 구성

- API/DB 변경 없음. 기존20개 커서 응답 캐시를 feedPageView로20개씩 렌더링. 방문한 번호(최대5개 주변)와 이전/다음, 아직 조회하지 않은 전체 페이지 수는 추정하지 않음.
- 저장 해제는 캐시 saved:false 슬롯을 유지하고 페이지 표시에서만 제외. 다음 미열람 글이 이전 빈칸에 섞이지 않게 함. 다음 커서가 없으면 끝쪽 빈 저장 페이지 보정.
- 계정/필터/revision 변경은 페이지1·캐시 초기화. generation/AbortSignal/저장 응답 계정 guard 유지. 실패 시 현재 내용 보존, 이동 성공 시 목록 제목 포커스 복원.
- feedExcerptView는260 Unicode codepoint 소개와 전체 텍스트 분리. React escaping, 번역 성공 조건, 서버 원문URL 유지. 원문 details는 line-clamp 미사용.
- 출처 이니셜·태그는 기존 메타데이터로 표현하며 새 이미지 크롤링/가짜 소셜 수치는 없음.
- scripts/feed-ui-preview.mjs: 실제 컴포넌트+apps/web/test/fixtures/feed-ui.tsx 메모리 API를 번들링, fixture HTML 복사. 운영 빌드 제외, output/playwright는 생성 결과.390px/1440px 브라우저 검증.

## Supabase 최종 확인 — 2026-09-13 번역

- 마이그레이션20260913140137, tech-feed v16/worker v18 ACTIVE·JWT true. 실제 일반Cron으로7건 한국어 번역 완료 및 source snapshot일치, POST3회/7259자 별도예산 확인.
- DB/서버 배포는 완료됐지만 커밋·main푸시가 승인 시스템에서 거절되어 웹배포는 미완료. 로컬 코드와 운영함수의 Git반영은 다음 사용자승인 단계에서 수행한다. 운영 데이터를 지우거나 서버를 롤백할 이유는 없으며 원문 피드는 호환된다.

## Supabase 운영 검증 — 2026-09-13 번역 성공

- DB20260913140137, 서버 고정Free client 적용 후14:17UTC 실제 번역3건/POST1회/3007자 저장. source snapshot 일치 결과만 기존 list로 반환.
- 사용량 응답은 양의 안전정수 한도를 검증하고 실제잔여 계산시 reported_limit을500000으로 clamp한다. 숫자가크다는이유로 Free 응답 자체를 거부하지 않으며 app450000 원자예산/Freehost/:fx/Pro필드거부는 유지한다.
- 운영검증에서 POST0이던 failed7건과 활성lease없는 provider 대기를한번복구. 번역예산/출석/검색백오프/구독설정은 변경하지 않았다.

## Supabase 변경 이력 — 2026-09-13 번역 운영 적용

- 사용자 운영 배포 명시 승인 후 MCP로 tech_feed_korean_translation을 적용했다. 실제 migration20260913140137, CLI 생성 로컬 파일은 이 버전으로 이름만 정합화(SQL 내용 동일).
- 번역3테이블 RLS=true, authenticated SELECT=false, anon/authenticated 번역RPC EXECUTE0 확인. 출석/피드 기존분단위Cron 활성 상태 유지.
- security advisor 신규3개 RLS-no-policy INFO는 service_role 전용의 의도한 차단이며 브라우저권한없음 직접검증. 기존 touch_updated_at/local_reminder_at search_path·public pg_net·7session SECURITY DEFINER·leaked password 설정 경고는 기존범위로 별도 유지한다.
- 실제 공급자 사전확인 오류를 구분하는 제한된 error_code 추가. 정규식 allowlist에 없는 값, 비밀키/원문응답/임의오류 메시지는 클라이언트로 반환하지 않는다. 무료예약/반환원문/코칭예산 정책 불변.

## Supabase 상태 보완 — 2026-09-13 번역

- 20260913131900_tech_feed_korean_translation.sql은 로컬 검증만 완료. MCP apply_migration이 별도 운영 배포 승인 필요로 거부되어 적용되지 않았고 list_migrations에서 미적용 확인. 서버/웹 변경도 없음.
- reservation RPC 반환은 jsonb {state:reserved|quota_exhausted|deferred}. 취소는 전역 공급자 오류/한도 backoff를 만들지 않는다. DB+worker 결합 회귀로 다른 사용자 즉시 처리 확인.
- 전체 Node589/589·Edge8/8·독립 재검토 승인. 추후 승인 시 해당 파일만 적용하고 원격 버전과 정합화한다. 기존 출석 Cron/RLS/데이터는 변경하지 않는다.

## Supabase 변경 이력 — 2026-09-13 한국어 번역

- 대상: tech_feed_translations(원문 snapshot/번역/lease), translation_provider(공용 잠금/상태), translation_budget(UTC월 문자/시도). 세 테이블 RLS, 브라우저 접근/EXECUTE 차단, service_role 전용 SECURITY INVOKER RPC.
- 이유: 코칭6회와 분리된 DeepL Free 번역 예산 및 사용자 간 성공 캐시 재사용. 원문과 snapshot이 같을 때만 list에 title_ko/excerpt_ko/translation_status 제공.
- API: state.translation_service 추가. 번역 키가 없으면 not_configured, 번역 실패가 검색/RSS를 중단하지 않음. 카드 한국어/접힌 원문/원문링크 불변.
- worker: 수동·정기 실행에서 최대3개, 소스 승인/수신 권한 유지, 예약 시 owner lock 재검증, Free GET usage→DB문자예약→POST1회→lease결과 저장. 유료 fallback/POST자동재시도 없음.
- migration: 20260913131900_tech_feed_korean_translation.sql(로컬 생성; 원격 적용 버전은 배포 기록에서 정합화). 확인: PGlite 실제 SQL/RLS/캐시/한도 및 Edge/전체 테스트. blanket db push 금지.
- 주의: 공급자 사용량은 지연될 수 있어 앱450000자 여유 상한도 적용한다. 앱 UTC월과 공급자 결제기간은 다르며 실제 제공자 잔여량도 매번 확인한다. 운영 전용 Free 키 필요. 상세 docs/tech-feed/korean-translation.md.

## Supabase 변경 이력 — 2026-09-13 즉시 수집

- 대상/이유: 명시적 수동 확인마다 수집하기 위한 refresh_begin/claim_search/claim_sources freshness 제거. 활성90초 lease/owner advisory/revision/실패 backoff 유지.
- 추가: tech_feed_search_topics.query_cursor nonnegative integer default0; 정기/수동 claim 반환. reserve에서 무료 예산 차감과 원자적으로1증가, 같은 lease 재차감/진행 금지. 원래 canonical/membership/RLS/ACL 불변.
- migration: 20260913122656_tech_feed_immediate_refresh.sql MCP 적용 완료. CREATE OR REPLACE SECURITY INVOKER로 기존 실행 권한 유지, 클라이언트 노출0 확인. 로컬 CLI 파일명은 원격 버전으로 정합화. blanket db push 없이 지정 migration만 적용.
- API: 미실행 deferred,0건 검색 성공 ready 구분. 이전 cooldown 응답은 롤아웃 호환을 위해 웹에서만 해석. 실패 run은 기존 허용 코드 worker_failed.
- 검증: PGlite 실SQL/권한/즉시 반복/정기 직후/중복/커서/한도 및 Node570·Edge8·웹/모바일 통과. 실제 운영 결과는 후속 기록.

## Supabase 운영 확인 — 2026-09-13 최종

- API v11/worker v12 ACTIVE·JWT true, 수집true/월900/피드Cronactive. 연속Cron HTTP200/캐시 중복검색0 및 수동서버경로1회 검증. 스키마/RLS/출석Cron 변경 없음.
- 실제검색 총2회/저장0건. 제공자HTTP목록 응답 제외는 기존HTTPS 정책이며 관련 안전검사를 완화하지 않았다. 일회성 collection-probe 삭제. 배포·미검증 범위는 docs/tech-feed/collection-live-20260913.md 기준.

## Supabase 변경 이력 — 2026-09-13 무료 수집 활성화

- 대상/이유: 사용자 카드 미등록 무료 계정 확인 후 활성화 승인. tech-feed/worker 사용량 검증 개정 및 재배포/JWT 유지.
- 정책: 명시적 null 한도는 무료 plan 잔여량+앱 월900으로 제한. null을 결제 비활성 증거라고 해석하지 않는다. 유료/누락/잘못된 타입/양수 paygo는 계속 거부.
- 설정: TECH_FEED_ENABLED=true, cap900 유지, 피드Cron만active. 기존 실패로 미성공이며 활성lease 없는 topic/provider 대기만 즉시 재개.
- 마이그레이션: 없음(스키마/권한 불변). 검증: Node564/564·Edge8/8·실제검색158523 ready/1회/0건; 최종 실수집/예약 증거는 docs/tech-feed/collection-live-20260913.md에 추가.

## Supabase 변경 이력 — 2026-09-13 운영 인증 준비

- 대상/이유: 사용자의 검색 키 등록 후 피드 가동 검증. TAVILY_API_KEY 인증은200 확인.
- 변경: Edge TECH_FEED_WORKER_SECRET와 Vault tech_feed_worker_secret, Vault tech_feed_gateway_anon 추가. 피드 Cron에 Authorization 추가, 전용 secret 비교와 verify_jwt=true 유지. 출석 secret/Cron 불변.
- 함수: worker에서 전역 Buffer 대신 TextEncoder를 사용해 Edge 인증500 해결. 최종 원격 목록 worker v10/tech-feed v9, JWT true. DB schema 및 migration 변경 없음(기존 Cron 운영 command만 갱신).
- 검증: 잘못된 인증401, 정상 worker200, GET /usage Researcher/1000 확인. key.limit/paygo_limit=null로 무료 조건 미충족, 검색0회/기사0건.
- 현재 스위치 false/Cron inactive. 무료 조건 확인 후만 활성화. 진단 함수 삭제. 비밀값은 코드/문서에 보관하지 않는다. 상세 docs/tech-feed/activation-20260913.md.

## Supabase 변경 이력 — 2026-09-13 수동 수집

- 변경 대상/이유: 인증된 새 글 확인을 위한 서버 전용 tech_feed_refresh_requests와 소스/주제 manual_requested_at, refresh_begin/status/finish/claim_search/claim_sources RPC.
- 관련 마이그레이션: 20260912161611_tech_feed_manual_refresh.sql MCP 적용 완료. 함수2개 v5 JWT true와 웹38f1c18 production READY. 추가형이며 기존 데이터·출석 Cron 불변. 상세 docs/tech-feed/manual-refresh-verification.md.
- 권한: RLS 활성, anon/authenticated 테이블·RPC 접근 없음, service_role만 쓰기. Edge 인증 사용자로 owner 고정.
- 원자성: 계정5분 요청/90초 lease, 주제·출처5분 중복 제한. begin 및 claim은 설정 변경과 같은 owner advisory lock, provider→topic row lock 순서. 주제 revision을 다시 확인한다.
- API: refresh(expected_revision), refresh_status. RSS 최대4개와 주제1개 독립 수집, 제공자 mutex 경합은2초마다 제한 재시도하며 사용량 예약은 실제 검색 직전1회만 한다. 공유 작업을 읽는 폴링은 제공자 호출 없음.
- 서버40초 네트워크 예산, 웹 요청60초/클라이언트65초. 수동 AI는 호출하지 않으며 정기 공유6회 예산 유지. 오래된 계정 응답은 abort/generation으로 제거.
- 확인 방법/주의: PGlite 권한·중복·revision 테스트와 PC/390px 합성 흐름, Node/Edge/웹/모바일 검사. hosted 다중 연결 실험 및 실제 제공자 가동은 별도. 키·Cron/JWT 설정은 보존한다.

## Supabase 변경 이력 — 2026-09-13

- 변경 대상/이유: 승인된 관심 입력·공유 검색 캐시·무료 사용량 기능의 운영 반영.
- 마이그레이션: 20260912150427_tech_feed_web_search.sql. MCP 적용 버전에 로컬 파일명 정합화(SQL 불변).
- 함수/설정: tech-feed/worker v4 verify_jwt=true, self_service, 수집 false, 검색 월 상한900. 출석/기존 데이터/Cron 불변.
- 확인: 신규5테이블 RLS/소유자 정책,23 RPC 클라이언트 직접 실행 차단, 기존 advisor WARN 불변. 서버 전용3개 policy없음 INFO는 의도한 권한 차단.
- 주의: 과거 원격 마이그레이션이 로컬에 모두 없으므로 무조건 db push/repair하지 않는다. 이번 추가 SQL만 적용. 실제 수집은 키/인증/소스 승인 후 별도 검증. docs/tech-feed/deployment-20260913.md 참고.

## 2026-09-12 Architecture — 관심 내용 기반 공개 웹 검색 (구현 중)

- 기준 명세: docs/tech-feed/web-search-spec.md. 기존 RSS/API 수집에 별도 검색 어댑터·공유 주제 큐를 추가하며 출석/타이머/커리어 보관 코드는 유지한다.
- 개인 선호(원문 관심 내용·수신 여부·revision)와 공통 정규화 검색문/캐시/기사 연결을 분리한다. 소유자 이외에 개인 입력과 주제 구독자를 공개하지 않는다.
- API state/topics_save/receiving은 전역 수집 스위치와 분리한다. expected_revision으로 동시 수정 충돌을409로 응답한다. self_service 모드는 DB 수신 동의를 사용한다.
- 제공자 실행 lease와 월간 시도 예약은 DB 원자적 연산이다. 앱 전체 월 상한900회, 성공 캐시1시간, 실패/불명확한 호출도 계산한다. 제공자 무료 계정/키·종량제0을 실제 검색 전 재검증한다.
- Tavily 고정 HTTPS 엔드포인트에 기본 검색만 요청한다. 요청 시간/응답 크기 제한과 리디렉션 거부; 반환된 원문 페이지를 다시 크롤링하지 않는다.
- 검색 결과는 search_snippet 출처로 저장하고 기존 RSS evidence를 약한 소개로 덮어쓰지 않는다. 기사 URL은 서버 결과를 사용한다. AI는 충분한 실제 근거에만 기존 무료6회 공유 예산을 적용한다.
- 검색 실패와 RSS 실패는 독립 처리한다. 게시물 목록은 소유자 가시성·필터·중복 제거 후20개 단위로 제공하며 저장한 글은 수신 중지 후에도 보존한다.
- 추가형 마이그레이션은 CLI 생성 후 검증한다. 원격 적용/함수 버전/웹 배포/실제 Cron 가동 여부는 완료 후 별도 이력에 기록한다. 기존 JWT 설정을 임의로 바꾸지 않는다.
- 운영 전제와 중지 상태: docs/tech-feed/search-provider.md. 키 미등록이면 검색을 가동하지 않으며 UI 테스트 데이터를 운영 기사로 사용하지 않는다.

## Supabase 변경 이력

### 2026-09-12 — 기술 피드 runtime 재배포

- 변경 대상: tech-feed/tech-feed-worker v2, 공통 XML parser import.
- 변경 내용/이유: Edge bundle 그래프가 추적 가능한 literal npm import로 분리해 모듈 초기화500 해결.
- 관련 기능: 기술 피드 API/worker. 마이그레이션 파일: 없음(DB·권한·Cron·환경 변수 변경 없음).
- 확인 방법: graph 회귀2개, Deno8개, 운영 OPTIONS204와 내부 인증401. 두 함수 verify_jwt=true 보존.
- 주의 사항: Node/Deno 공용 의존성은 로컬 실행뿐 아니라 배포 그래프 포함 여부 검사. 기술 피드 활성화와 실제 사용자 인증 검증은 별도.

## Supabase 변경 이력 — 2026-09-12 (배포 완료)

- 대상/내용: 기술 피드 schema와 비활성 scheduler, 신규2개/기존5개 Edge 함수, Vercel 웹 배포 완료.
- 이유: 승인된 기술 피드 전환과 커리어 자동 실행 중지. 기존 출석 데이터/함수/Cron 보존.
- 파일/원격 버전: `20260912104353_tech_feed.sql`, `20260912105541_tech_feed_cron_disabled.sql`. 최초 로컬 생성 번호를 MCP 적용 번호에 맞춰 변경했으며 SQL 내용은 동일.
- 확인: 원격 migration 조회, 함수410/401, Cron4개 활성 상태, RLS/권한, CI 성공/웹 READY/HTTP200.
- 현재 설정: tech-feed와 worker verify_jwt=true; 기존5개는 사용자 명시적 승인으로 false 유지. TECH_FEED_ENABLED=false, 피드 Cron false, 커리어2개 false, 출석 true.
- 주의: 신규 worker 예약 호출은 현재 JWT 게이트에 차단되므로 승인 없이 켜지 말 것. source permission/무료 AI/worker secret/Vault/파일럿 구성과 hosted TLS·실사용 검증 후 별도 활성화.
- 상세/복구: `docs/tech-feed/deployment-20260912.md`. 아래 기록은 배포 전/중간 이력이다.

## Supabase 운영 적용 이력 — 2026-09-12 (부분)

- 변경 대상/이유: 시간별 기술 피드 추가 스키마와 인증 API/worker 배포. 기존 데이터 보존.
- 원격 migration: `20260912104353` (`tech_feed`), 로컬 원본 `20260912104353_tech_feed.sql`. 같은 SQL 재적용 금지, 후속 Git 정리 시 버전 일치 필요.
- 신규 함수2개 v1 verify_jwt=true. TECH_FEED_ENABLED=false. 기존5개 false 유지 재배포는 보안 승인 차단.
- 확인: 테이블10개 RLS/anon SELECT 차단, 소스8개 pending, 함수401, 웹200, security advisor 신규 WARN 없음.
- 주의: Cron migration/웹/기존 함수 변경 아직 미적용. worker의 secret 기반 예약 호출에는 향후 JWT 설정 승인이 필요.
- 자세한 상태/재개 절차: `docs/tech-feed/deployment-20260912.md`. 아래 로컬 설계 상태와 구분.

## 2026-09-12 Architecture — 기술 피드 (로컬, 운영 미적용)

- Web: `#feed` lazy TechFeedSection, 독립 API client, latest/saved cursor20, 기존 할 일 편집 모달 재사용. 사용자 전환 시 취소/응답 identity 검증. 시간대는 독립 `tech-feed/timezone` action.
- Server: `tech-feed` 인증 API와 `tech-feed-worker` secret 예약 진입점 분리. RSS/Atom과 HN adapter, bounded IP-pinned TLS transport, leases/backoff/dedup/summary cache.
- Data: 공통 소스/기사와 소유자 구독·관심·저장·할 일 링크 분리. 브라우저 쓰기 제한과 owner RLS. 글-할 일 원자적 idempotent RPC, 기존 야간 일정 허용 유지.
- AI: 기존 무료 서버 클라이언트와 사용자별 actual6/day 공유 RPC 유지. 한번에 최대3개, 부족한 내용은 소개만 표시. 모든 소스 permission pending 기본값.
- Career: 전용 코드·테스트는 `archive/career-coach/`, 기존4개 엔드포인트는410. 공유 restart coaching/AI/profile/출석·타이머는 유지.
- 검증/출시/복구: `docs/tech-feed/implementation.md`, `release.md`, `verification.md` 참조. DB → 함수 → 웹 → 승인 소스/Cron 순, 기존 Cron 불변.

- 예약기는 매분 due 작업을 분배하고 각 소스는 시간별 run_after/백오프/lease로 제한한다. HN snapshot/tail 체크포인트로 50개 묶음을 이어 처리하며 초기50개 제한을 증분 RSS에 적용하지 않는다.
- 피드는 최초 discovered_at + id 순서의 인덱스/커서를 사용한다. 원문 published_at은 별도 표시용 메타데이터다. 수집·요약·보류 실행 기록은 서버 전용으로30일 보관한다.
- source 조회는 safe-column grant로 제한해 created_by/내부 컬럼을 숨긴다. 무료 AI는 실제 호출 직전 공유 쿼터와 시도 횟수를 원자적으로 예약하고 한도 보류는 실패 시도로 세지 않는다.
- AI category는 성공한 요약에만 엄격한 enum을 적용한다. 비정상 배열 요소는 무시하며 피드 상대 링크는 검증된 최종 redirect URL을 기준으로 해석한다.

## Supabase 변경 이력

### 2026-09-12
- 변경 대상: 기술 피드 테이블·정책·원자적 함수·독립 Cron과 커리어 전용 예약 작업 중지(로컬 마이그레이션만 작성).
- 변경 이유: 시간별 서버 수집과 기기 간 동기화, 중복 할 일 방지 및 사용자 데이터 격리.
- 관련 기능: 기술 피드, 시간대 독립 저장.
- 마이그레이션 파일: `20260912104353_tech_feed.sql`, `20260912105541_tech_feed_cron_disabled.sql`.
- 확인 방법: PGlite 실제 SQL/RLS 회귀 테스트, Node/Deno 검사. 운영 적용/실제 Cron 실행은 미수행.
- 주의 사항: 과거 DB 데이터를 삭제하지 않음. 아래 커리어 설계는 보관 기록이다.

# Implementation Plan

## Architecture

- Web frontend: Vite React static build can be deployed to S3/CloudFront or another static host.
- Current web hosting: Vercel production deployment serves the static Vite app at `https://study-room-attendance.vercel.app`.
- Primary scheduler: Supabase Cron invokes `attendance-cron` Edge Function every minute through `pg_cron` and `pg_net`.
- Optional AWS scheduler: EventBridge + Lambda can invoke the same Supabase Edge Function when AWS-managed scheduling is preferred.
- Backend: Supabase remains responsible for Auth, DB, RLS, notification targets, attendance decisions, and actual push/email dispatch.
- Auth session persistence and recovery: the browser Supabase client stores the Supabase session under `study-room-attendance-auth-session` with `persistSession=true` and `autoRefreshToken=true`. OAuth URL handling stays manual with `detectSessionInUrl=false`. Initial `getSession()` or OAuth callback work is bounded by `authInitialization.mjs` at 12 seconds; timeout/error renders the normal login form with an accessible retry notice instead of indefinite loading. Retry attempts are numbered so only the newest attempt updates initialization state, while the synchronous `onAuthStateChange` subscription remains active and may restore a late valid session. The fallback never deletes tokens, signs out, or changes Supabase Auth policy.
- Study session refresh persistence: browser lifecycle events such as `visibilitychange`, `pagehide`, and `beforeunload` do not end active study sessions. Active sessions continue to be restored from Supabase after refresh.
- Break return plan: while a web session is paused, `sessionBreak.mjs` derives 10/20/40-minute return deadlines, due state, and whether the session lease ends first. The deadline is stored only in user/session-scoped localStorage and driven by the existing one-second `nowMs` clock. Resume, successful end, stale-end refresh, or an externally observed unpaused state clears it. This layer never resumes the session, starts the camera, extends the lease, changes counted break time, or adds a Supabase request.
- Study time display windows: active study-session elapsed time is split by local date and selected-month windows for summary cards. A cross-midnight active session contributes only the post-midnight segment to today's study timer, while the one-hour session lease countdown remains based on `study_sessions.lease_expires_at`.
- Study session end idempotency: the web app treats `Active study session not found` from `end_study_session` as a stale local active-session signal. It clears local lease/activity/camera intent, closes end-completion state, and reloads dashboard data instead of leaving the stale active row in UI state.
- Study session lease: every active web study session starts with a 1-hour server-backed lease in `study_sessions.lease_expires_at`. The in-app and Slack `세션 유지` actions request a 60-minute extension through `extend_study_session_lease`, but the RPC caps the resulting deadline at `now() + interval '2 hours'`; 30 minutes remaining becomes 90 minutes, while 90 minutes remaining becomes 120 minutes. `lease_warning_sent_at` prevents duplicate warnings and resets after an extension. The web dashboard prefers the server deadline, polls the active row every 15 seconds, and uses the same capped pure helper only as a client fallback. The `SECURITY DEFINER` RPC validates the authenticated owner, allows service-role Slack handling, and explicitly revokes `public/anon` execution. If the lease expires while the app is open, `end_study_session` excludes lease-overrun seconds from saved study time. Existing sessions without a server deadline fall back to `started_at + 1 hour`.
- Open dashboard lease sync: while an active session exists, the web app refetches only that `study_sessions` row every 15 seconds and on focus/visible events. This picks up `lease_expires_at` changes made outside the browser, such as Slack session-extension buttons, without a full dashboard reload.
- Study session todo links: before a new web study session starts, the app requires the user to choose at least one incomplete todo for the current local date. If no suitable todo was pre-registered, the same session planning modal can quick-add a plain today todo and auto-select it. The selection is persisted in `study_session_todos`, and the active Today Focus card shows only the todos linked to the current session. Todo completion is not toggled from the daily checklist or active-session list while the session is running; pressing End opens a completion modal, and selected todos update `study_todos.is_completed` plus `study_session_todos.completed_during_session` for linked rows.
- Kakao notification channel: deprecated for active product behavior. Legacy `kakao_memo` rows and `kakao_message_connections` are retained for history, but enabled targets/connections are disabled and `attendance-cron` no longer sends Kakao Memo messages.
- Slack notification channel: the web app stores a user-specific Slack Channel ID in `notification_targets.destination`, while Slack Edge Functions read `SLACK_BOT_TOKEN` or fallback alias `STUDY_ALERT_SLACK_BOT_TOKEN` from Edge Function secrets and call Slack Bot API `chat.postMessage`.
- Timed todo schedule reminders: `attendance-cron` also calls `get_due_todo_schedule_reminders(p_now)` every minute. Incomplete timed `study_todos` send Slack at `start_time` and 5 minutes before `end_time`; completed todos are skipped. Sent/failed locks are stored in `study_todo_schedule_deliveries` with unique `(todo_id, target_id, reminder_type, scheduled_at)` duplicate protection.
- Slack schedule extension actions: timed todo Slack reminders include `5분 연장`, `10분 연장`, and custom 1-120 minute extension actions. The existing `slack-recovery-interactions` Edge Function routes these schedule actions because the Slack App has one Interactivity Request URL. It calls `extend_todo_schedule`, which shifts the selected todo start and end time together, then shifts every later same-day incomplete timed todo by the same number of minutes; completed todos are excluded. Schedule reminder locks include `scheduled_at`, so shifted times can trigger fresh future start/end-soon reminders.
- Slack recovery routines: missed attendance and repeated same-day camera absence create `study_recovery_requests` rows. Every pending recovery request blocks `start_study_session()` and the web start button until the user submits a Slack or in-app recovery modal with a reason, makeup todo, and next-day pledge.
- Recovery routine summaries: the web app derives My Page recovery summaries from loaded `study_recovery_requests` using deterministic keyword categories, not AI APIs. `attendance-cron` sends a Monday 08:00 local-time Slack weekly summary for the previous Monday-Sunday range and records one row per user/week in `study_recovery_weekly_reports` to avoid duplicate sends.
- In-app recovery routine fallback: the web app opens a recovery modal after login when pending `study_recovery_requests` exist. Same-day `missed_attendance` requests are no longer soft late-study exceptions; if a pending recovery request is detected while a session is already active, the web app ends that session and requires recovery submission before study can restart. The app submits reason, makeup todo, and pledge fields through authenticated RPC `submit_study_recovery_request`, immediately marks the submitted request locally, and shows the next remaining pending request with its date/count so users do not mistake multiple pending requests for a failed submission. If the user reached the modal by pressing `입장하고 시작`, the app remembers that start intent, waits for dashboard recovery data to refresh after the final submission, then resumes the normal start flow while preserving camera and session-todo gates.
- Slack interactivity: `slack-recovery-interactions` is deployed with `verify_jwt=false` and authenticates Slack requests by verifying `X-Slack-Signature` and `X-Slack-Request-Timestamp` with `SLACK_SIGNING_SECRET`. It opens the modal through Slack `views.open` and creates dated `study_todos` on submission.
- Notification diagnostics: the settings screen reads the five latest notification_deliveries rows for the logged-in user and combines them with browser push status and saved Slack target status. This is a read-only UI visibility feature and does not change notification dispatch.
- Vercel production gate: the GitHub Actions production workflow must run npm test and npm run build before invoking vercel deploy --prod, so TypeScript/build errors block production deployment.
- Slack test channel: `slack-test-alarm` is a manually invoked Edge Function. Server/admin calls use `x-cron-secret`; they can either send to a direct `channelId` for setup verification, send a recovery routine test button for a specific `recoveryRequestId`, or use the latest enabled Slack target. Browser calls use the logged-in user's Supabase JWT and are limited to that user's Slack target. It sends one test Slack message and records DB delivery results only when a saved target is used.
- In-app popup: when the dashboard is open at the configured reminder minute, the web app shows a modal reminder popup. This is separate from OS/browser push and does not work when the browser is closed.
- In-app popup suppression: if the user already has an active same-day study session at the configured reminder minute, the web app does not show the reminder modal.
- My Page: the web dashboard uses hash-based client routing (`#me`) to render My Page as a separate SPA page while reusing loaded profile and `study_todos` data to show account summary and completed todo history.
- Study Forest: the web dashboard uses hash-based client routing (`#forest`) to render a client-only 2.5D reward space. It derives completed trees, current tree growth, and wilted state from already loaded `attendance_days` data through `apps/web/src/studyForest.mjs`; it does not add a Supabase table or send game-state writes in the MVP. The forest JSX and CSS class names must stay aligned for tree/avatar parts, and the scene should keep visible 2.5D depth through perspective, rotated ground/pond/path layers, drop shadows, village props, flowers/stones, tree sparkles, and an avatar z-index above terrain. The avatar should have visible face/body/arm/leg/backpack parts, a friendly smiling expression, subtle CSS motion, percent-based meadow movement, click/touch-to-walk, y-position scale/z-index depth, and deterministic idle waypoint walking. The scene should read as a cozy study island with CSS-only distant hills, river, bridge, garden bed, lanterns, fireflies, foreground grass, water shimmer, drifting clouds, and leaf sway while remaining static-host friendly.
- Study goals: the web dashboard uses hash-based client routing (`#goals`) to render a dedicated goal page. Goals are stored in `study_goals`, shown as a D-day card in the dashboard topbar, and can be linked to dated `study_todos` through `study_todos.goal_id`.
- Recurring todos: weekday repetition is materialized into dated `study_todos` rows on save, and each generated weekly row stores lightweight repeat metadata (`repeat_group_id`, `repeat_mode`, `repeat_weekdays`, `repeat_until`, `repeat_forever`) so the group can be edited later from the calendar modal. `repeat_forever = true` means no user-selected end date; the current MVP generates a rolling one-year set of rows while preserving the no-end metadata. This keeps reminders, today's tasks, and completed history on the existing date-based data path without adding a separate recurrence-rule table.
- Scheduled todos: `study_todos` can optionally store `start_time` and `end_time`. If one is present, both must be present. Same-day schedules use `start_time < end_time`; overnight schedules use `end_time < start_time`; equal start/end times are invalid.
- Reminder todo enrichment: `attendance-cron` loads `study_todos` for each due reminder's `user_id` and `local_date`, then appends a compact `오늘 할 일` summary to server-side notification bodies. The open web app also renders the same date's todos in the reminder popup from already loaded dashboard state.
- Two-step attendance enforcement: `get_due_reminders()` atomically claims an initial reminder at the effective reminder time for both pending and already-present days. It claims a `nudge` 15 minutes later only for `pending` days with no qualifying timer start or completed daily goal. Weekdays use the saved profile reminder time with a `20:30` default; weekends use fixed `14:00`. `mark_missed_attendance()` marks only still-pending days missed at reminder time + 30 minutes.
- Daily attendance goals: weekdays require 2 hours of completed saved study time, weekends require 4 hours. If the user misses the 30-minute check-in window but later ends sessions whose same-day total reaches the goal, `end_study_session()` promotes `attendance_days.status` to `present`.
- Pre-reminder active attendance: if a study session spans the configured reminder timestamp or the daily study goal is already complete, Supabase marks the day `present` and still emits the configured-time initial reminder with `attendance_already_present = true`. It suppresses the nudge and missed transition.
- Camera presence warning: web study sessions require camera monitoring before the timer can start. MediaPipe PoseLandmarker runs in the browser only, and the server receives only camera event metadata through `camera-presence-warning`.
- Camera video health: before running PoseLandmarker absence checks, the web app verifies the camera stream has a live unmuted enabled video track and that the current video frame is visible. Missing, muted, ended, disabled, unavailable, or nearly black frames are treated as camera errors instead of user absence.
- Camera stalled-frame recovery: if a live camera stream stops producing a current frame or reports zero video size for 15 seconds, the web app attempts one same-session camera reconnect. If the reconnect still cannot produce frames, the app releases the stream and asks the user to turn camera monitoring on again.
- Camera refresh resume: when camera monitoring is enabled for an active session, the web app stores a short-lived per-user/per-session camera intent in browser storage and attempts one automatic camera reconnect for the same active session after refresh.
- Camera upper-body presence: the web app treats the user as present when one head landmark and both shoulder landmarks are visible with enough confidence. For cropped webcam views, head plus one visible shoulder and the same-side hip also counts as seated upper-body presence. This allows upper body detection instead of requiring a full face detection.
- Camera absence enforcement: if no upper body pose is detected for 5 minutes, the web app sends an in-app/Slack warning. If the user is still absent 5 minutes after that warning, the web timer enters auto-pause and excludes only the paused interval from displayed and saved study time.
- Camera monitor UI: the top summary cards are the single source for today's study time and monthly accumulated time. The camera section does not render a second timer; it shows goal progress, one camera status line, a larger local preview, the camera control, and a compact client-only diagnosis strip for support, permission, stream, frame, absence, loading, paused, and healthy states.

## Daily Planner Dashboard Notes

- Today task views: the Today task card supports `checklist` and `planner`. The planner is a browser-rendered SVG life planner built from already loaded `study_todos`.
- Selected-date planner scope: the Today task card can render any selected local date by filtering `study_todos.local_date` with `selectedTodoDate`; real attendance/session gates still use the actual `todayDateKey`. The planner previous/next buttons move relative to `selectedTodoDate`, while the today button jumps back to the real current local date.
- Planner data source: timed todos use `study_todos.start_time` and `study_todos.end_time`; untimed todos remain in a separate list below the wheel. Overnight todos wrap across midnight and overlapping todos show a warning state.
- Planner overlap details: `dailyPlanner.mjs` computes per-segment `overlapDetails` containing the counterpart todo title/schedule plus the exact intersection range. Midnight-edge intersections are merged into one readable overnight conflict before React renders the alert list.
- Planner interactions: clicking an empty wheel area opens the existing todo modal with a default one-hour time block; clicking a segment opens the same modal for editing that todo.
- Multi-date plan copy: the planner copy modal creates explicit single-date `study_todos` rows for selected target dates, skips duplicate title/date/time rows, resets copied rows to incomplete, and clears repeat metadata so the copies do not unexpectedly edit the original recurrence group.
- Existing todo scheduling: inside the todo modal, checking an existing todo means "link this todo into the current time window" and inserts a new timed row when the selected date/title/time is not an exact duplicate. Already scheduled todos remain visible and can be scheduled again for another time block. These checkboxes do not mark todos complete and no longer expose edit/delete actions inside the link list.
- Planner detail list: the planner selected-detail panel also renders the selected date's todo list with time/repeat/goal chips and row-level edit/delete actions. This is the main editing surface for scheduled rows in planner view.
- Planner todo completion: outside active study sessions, the Today checklist/planner can toggle `study_todos.is_completed` directly through the existing authenticated update path. During active sessions, direct completion controls stay disabled and completion remains part of the End-session completion modal.
- Preference storage: `profiles.today_task_view` stores the pinned task view, and `profiles.today_section_order` stores the Today section order for `topbar`, `attendance`, `focus`, and `tasks`.
- Client helpers: daily-planner math belongs in `apps/web/src/dailyPlanner.mjs`; task-view and section-order normalization belongs in `apps/web/src/dashboardLayout.mjs`.
- API shape: no new server API is required. The web app persists preferences through Supabase Data API upsert on `profiles`.
- DB shape: migration `20260623131001_dashboard_planner_preferences.sql` adds the two `profiles` columns and constraints.
- Tests: use `apps/web/test/dailyPlanner.test.mjs`, `apps/web/test/dashboardLayout.test.mjs`, and SQL migration coverage in `packages/core/test/sql-migrations.test.mjs`.

## Study Forest 3D Notes

- Runtime: the authenticated #forest route lazy-loads StudyForest3D.tsx and the Three.js chunk only when the user opens the reward page.
- Scene: raw Three.js primitives build an original low-poly island, layered terrain, river, bridge, cottage, garden, lanterns, fireflies, completed trees, current growth tree, and smiling avatar. No external model, texture, or copied game asset is used.
- State boundary: attendance streak/tree calculations and keyboard/touch/idle avatar state remain in studyForest.mjs and main.tsx. The renderer receives derived counts/stage/position through props.
- Interaction: a Three.js Raycaster intersects an invisible ground plane and converts the world point back to the existing percent-based avatar coordinate model.
- Navigation: normalized client collision zones reject water and solid scenery. Cross-river destinations are expanded into bridge entry/exit waypoints so the renderer follows the deck rather than a straight line through water. Keyboard, touch, click, and idle movement share the same resolver.
- Cottage interior: React owns an island/interior scene mode. The renderer rebuilds the lightweight scene on mode changes, pauses outdoor walking inside, and exposes both a clickable cottage door and semantic enter/exit buttons. Interior furniture uses original Three.js primitives only.
- Growth preview: studyForest.mjs owns deterministic 1/3/5/7-day milestone metadata and next-upgrade copy; main.tsx renders the roadmap from derived attendance state.
- Performance: Three.js is a lazy chunk, device pixel ratio is capped at 1.5, shadow maps are 1024 square, completed tree geometry is capped for display density, post-processing is disabled, and obsolete CSS 2.5D scene rules were removed.
- Resilience: WebGL constructor failure renders an accessible text fallback; reduced-motion disables bobbing and ambient motion; ResizeObserver keeps the orthographic camera and drawing buffer aligned with the container.
- Cleanup: animation loop, pointer listener, ResizeObserver, geometries, materials, renderer, and canvas are disposed when the component unmounts or the derived forest scene is rebuilt.
## Tech Stack

- Vite React
- Supabase
- MediaPipe Tasks Vision
- Slack Bot API
- AWS CDK v2
- AWS S3
- AWS CloudFront
- AWS EventBridge
- AWS Lambda Node.js 20
- Vercel static hosting

## Folder Structure

```txt
.github/workflows/
  vercel-production.yml
docs/
  vercel-ci.md
```

```txt
infra/aws-cdk/
  bin/study-room-aws.ts
  src/study-room-aws-stack.ts
  lambda/attendance-cron-invoker/index.mjs
  lambda/attendance-cron-invoker/index.test.mjs
  test/study-room-aws-stack.test.ts
  README.md
```

```txt
vercel.json
apps/web/dist/
```

```txt
apps/web/src/todoHistory.mjs
apps/web/src/todoHistory.d.mts
apps/web/test/todoHistory.test.mjs
apps/web/src/todoRecurrence.mjs
apps/web/src/todoRecurrence.d.mts
apps/web/test/todoRecurrence.test.mjs
apps/web/src/dashboardRoute.mjs
apps/web/src/dashboardRoute.d.mts
apps/web/test/dashboardRoute.test.mjs
apps/web/src/studyGoals.mjs
apps/web/src/studyGoals.d.mts
apps/web/test/studyGoals.test.mjs
apps/web/src/sessionTodoLinks.mjs
apps/web/src/sessionTodoLinks.d.mts
apps/web/test/sessionTodoLinks.test.mjs
apps/web/src/plannerDate.mjs
apps/web/src/plannerDate.d.mts
apps/web/test/plannerDate.test.mjs
```

```txt
apps/web/src/cameraPresence.mjs
apps/web/src/cameraDiagnostics.mjs
apps/web/src/cameraWarning.mjs
apps/web/src/bodyPresenceDetection.mjs
apps/web/src/cameraVideoHealth.mjs
apps/web/src/sessionExit.mjs
apps/web/test/cameraPresence.test.mjs
apps/web/test/cameraDiagnostics.test.mjs
apps/web/test/upperBodyPresence.test.mjs
apps/web/test/cameraVideoHealth.test.mjs
apps/web/test/sessionExit.test.mjs
supabase/functions/camera-presence-warning/index.ts
supabase/functions/slack-recovery-interactions/index.ts
supabase/functions/_shared/recovery.ts
supabase/migrations/0011_study_presence_events.sql
supabase/migrations/0012_camera_required_warning.sql
supabase/migrations/0013_exclude_camera_absence_from_sessions.sql
supabase/migrations/0019_study_recovery_requests.sql
```

```txt
docs/infrastructure-architecture.md
docs/images/study-room-thumbnail.png
```

## Code Conventions

- Work from `C:\jini-dev\project\study-room-attendance` for this app repository. Do not treat the parent workspace `C:\jini-dev\project` as the app root when updating app-local instructions or memory-bank files.
- Read the app-local `AGENTS.md` and relevant app-local `memory-bank` documents before product, architecture, provider, AI-analysis, automation, auth, notification, DB, or deployment changes.
- Keep AWS infrastructure code isolated under `infra/aws-cdk`.
- Keep Lambda logic dependency-free unless a real integration requires an SDK.
- Prefer deploy-time parameters for MVP secrets to avoid fixed Secrets Manager cost.
- Never put Supabase service-role keys in frontend code or committed docs.
- The web app intentionally uses a light cozy-forest theme. Keep `color-scheme` fixed to light in HTML/CSS so mobile browsers do not auto-darken the UI.
- The Expo app uses the same green/cream/gold palette through `mobilePalette` in `apps/mobile/App.tsx`. Keep Expo `userInterfaceStyle` set to `light`, use a dark-content status bar, and keep the Android adaptive-icon background aligned with the web canvas color.
- Keep todo history filtering, stats, and pagination in `todoHistory.mjs` instead of expanding the large React component with data logic.

## Design Patterns

- Static web hosting uses private S3 bucket plus CloudFront Origin Access Control.
- Scheduled execution is an invoker pattern: AWS only triggers Supabase Edge Function.
- SPA fallback maps CloudFront `403` and `404` to `/index.html`.
- Web study sessions are explicitly ended by button click or by true page-exit events using a `keepalive` RPC request. `visibilitychange` from browser tab switching is not a page-exit event and must not end the session.
- Web study sessions are ended by the explicit `종료` button or by the in-app 2-hour session lease expiry. Browser lifecycle events are not used for automatic session end because refresh/reload cannot be reliably distinguished from leaving the page, and ending on refresh caused study time loss.
- Auth initialization waits for `supabase.auth.getSession()` before showing the login form, so a stored browser session can restore the dashboard without a misleading login flash.

## API Conventions

- Supabase Cron sends `POST` to `/functions/v1/attendance-cron`.
- Supabase Cron sends `x-cron-secret` from Vault secret `cron_secret`.
- Kakao notification APIs are deprecated. The web app no longer calls a Kakao token endpoint and `attendance-cron` no longer calls Kakao Memo APIs.
- `attendance-cron` sends Slack messages to `https://slack.com/api/chat.postMessage`.
- `slack-test-alarm` sends a protected one-off Slack test message and includes same-day `study_todos` in the message body when a saved target is used. Browser requests must include `Authorization: Bearer {supabase_access_token}`. Cron-secret protected admin requests may pass `{ "channelId": "C..." }` or `{ "channelId": "G..." }` for direct Slack channel verification.
- `camera-presence-warning` receives `POST /functions/v1/camera-presence-warning` from the browser with `Authorization: Bearer {supabase_access_token}` and body `{ sessionId, absenceSeconds, detectedAt, eventType }`.
- `camera-presence-warning` validates that `study_sessions.user_id` matches the authenticated Supabase user before inserting `study_presence_events` or sending Slack.
- `submit_study_recovery_request(p_request_id uuid, p_reason text, p_makeup_todo_title text, p_pledge_todo_title text)` is called by the web app with the logged-in Supabase session. It verifies `auth.uid()`, locks the user's pending recovery request, inserts only the makeup todo, stores the pledge on `study_recovery_requests.pledge_todo_title` without creating a todo row, marks the request submitted, and returns the updated recovery request.
- `end_study_session` receives `{ p_session_id, p_excluded_seconds }`; `p_excluded_seconds` is the camera absence time that should not be counted as study duration.
- `attendance-cron` Slack notification bodies use emoji-led plain-text sections. Pending initial/nudge reminders include `출석 마감`, `오늘 할 일`, `지금 할 일`, and `앱 열기`; already-present initial reminders use `출석 상태`, explicitly say attendance is complete, and omit deadline/missed warnings.
- `get_due_reminders()` returns `reminder_stage = 'initial' | 'nudge'` and `attendance_already_present`. `attendance-cron` uses both fields to choose the message, and push payloads include `reminderStage` and `attendanceAlreadyPresent`.
- Lambda sends `POST` to `AttendanceCronUrl`.
- Lambda sends `x-cron-secret` header from `CronSecret`.
- Lambda body includes `source: "aws-eventbridge"` and `triggeredAt`.
- The page-exit session termination helper remains available for explicit future use, but current browser lifecycle events do not call it. Normal session termination sends `end_study_session` from the explicit `종료` action or the in-app 2-hour session lease expiry.
- My Page does not call a new API. It derives completed todo history from `study_todos` already loaded by the dashboard and is selected through the `#me` hash route.
- Study goals do not call a new server API route. The web app reads and writes `study_goals` through the Supabase Data API, and links existing todos by updating `study_todos.goal_id`.
- Recurring todo save/edit does not call a new API route. The web app computes target dates locally and inserts, updates, or deletes rows in `study_todos` through Supabase Data API.
- Session todo linking does not call a new server API route. The web app creates the study session through `start_study_session()` and then inserts selected todo links into `study_session_todos` through the Supabase Data API.

## Database Conventions

- No AWS database is introduced.
- Supabase remains the source of truth.
- RLS remains the user-data isolation boundary.
- Legacy Kakao access/refresh tokens remain only in `kakao_message_connections` for historical compatibility. Active Kakao targets/connections are disabled by migration `0018_disable_kakao_notifications.sql`.
- `notification_targets.kind = 'kakao_memo'` is retained only for legacy history and is not included in active notification dispatch.
- `kakao_message_connections` remains RLS-protected and is no longer used by the active web app or `attendance-cron`.
- `notification_targets.kind = 'slack'` stores only the user's Slack Channel ID in `destination`.
- `notification_targets.kind = 'telegram'` is retained only for legacy delivery history and is disabled by the Slack migration.
- `start_study_session()` creates a `study_sessions` row at any start time, but it only marks `attendance_days.status = 'present'` when the current timestamp is between the effective `reminder_at` and `deadline_at`.
- `start_study_session()` blocks all pending recovery requests, including same-day `missed_attendance` requests. The Slack message and app behavior must match: users must submit the recovery routine before another session can start.
- Timer starts before the configured reminder time do not create a `present` attendance row immediately. At the reminder minute, a session spanning `reminder_at` is converted to `present`, but the configured-time initial reminder is still claimed and sent with completion-safe copy.
- Attendance deadline is `reminder_at + interval '30 minutes'`. Timer starts qualify only when `started_at >= reminder_at` and `started_at < deadline_at`; starts at the exact deadline or later do not qualify through the check-in window, but the day can still become `present` when completed study total reaches the weekday/weekend goal.
- `mark_missed_attendance()` also checks pre-reminder sessions that span `reminder_at` before marking a pending day missed, and updates such days to `present` with `qualifying_session_id`.
- `attendance_days.initial_reminder_claimed_at` and `nudge_reminder_claimed_at` are atomic dispatch claims. The initial UPSERT preserves `present`; the nudge UPDATE and missed UPDATE require `status = 'pending'`.
- The 15-minute nudge is not a separate attendance status. It is derived by `get_due_reminders()` from an existing `attendance_days.status = 'pending'` row and the absence of a qualifying `study_sessions.started_at`.
- `study_presence_events` stores camera presence events only: `camera_started`, `camera_stopped`, `absence_warning`, `camera_permission_denied`, and `camera_required_warning`.
- `study_presence_events.metadata` must not contain `image`, `video`, `frame`, `faceEmbedding`, or `landmarks` keys.
- Users can select and insert only their own `study_presence_events`; Edge Functions use the service role after validating session ownership.
- `end_study_session(p_session_id uuid, p_excluded_seconds integer default 0)` stores `duration_seconds` as elapsed seconds minus non-negative excluded seconds. This keeps camera auto-paused absence time out of saved study totals.
- `end_study_session()` calls `promote_attendance_by_daily_study_total()` after saving duration. If same-day completed study seconds reach `study_attendance_goal_seconds(local_date)`, the function upserts `attendance_days.status = 'present'`; pending recovery still requires explicit recovery routine submission before another new session can start.
- `submit_study_recovery_request()` is an authenticated `security definer` RPC in `public` because the existing app RPC path is exposed through Supabase Data API. It must always check `auth.uid()` against the locked `study_recovery_requests.user_id` before creating todos or changing recovery status.
- `study_goals` stores one row per user goal with `title`, `target_date`, `target_study_seconds`, and `status`. RLS policies restrict select/insert/update/delete to `auth.uid() = user_id`, and the table has explicit authenticated Data API grants.
- `study_todos.goal_id` is nullable and references `(study_goals.id, study_goals.user_id)` so a todo cannot be linked to another user's goal.
- `study_session_todos` stores one row per selected session todo with `user_id`, `session_id`, `todo_id`, `linked_at`, and `completed_during_session`. Composite foreign keys reference `(study_sessions.id, study_sessions.user_id)` and `(study_todos.id, study_todos.user_id)` so a user cannot link another user's session or todo. RLS and explicit authenticated grants allow users to manage only their own link rows.
- Recurring todo rows are stored in `study_todos` with one row per target `local_date`. Weekly rows share `repeat_group_id` and repeat metadata so editing one generated row can update the group, add newly selected dates, and delete removed dates. Forever repeats store `repeat_forever = true` and `repeat_until = null`; finite repeats store `repeat_forever = false` and a `repeat_until` date. Duplicate title/date/time rows are skipped in the client before new inserts.
- Scheduled todo rows use nullable `start_time` and `end_time`; the DB check constraint allows both null or both non-null with `start_time <> end_time`, so overnight schedules such as `23:00` to `01:00` are valid.
- Todo duplicate filtering uses date, normalized title, and optional time range so the same task title can be scheduled in different time blocks on the same day.

## Testing Strategy

- Use Node test runner for Lambda behavior.
- Use `aws-cdk-lib/assertions` for synthesized template assertions.
- Use `npm.cmd run infra:synth` as deployment-shape verification.
- Use pure state-machine tests for camera absence timing and warning cooldown.
- Use pure state-machine tests for camera auto-pause, auto-end, and excluded study seconds.
- Use upper-body pose tests for head/shoulder landmark based seated presence detection.
- Use pure helper tests for recurring todo date calculation, duplicate filtering, and dashboard hash route parsing.
- Use pure helper tests for study goal D-day labels, active-goal selection, linked todo filtering, and goal progress calculation.
- Use pure helper tests for session todo selection gates, link row construction, active-session linked todo lookup, and end-session summary text.
- Use pure helper tests for selected planner date labels, multi-date copy target normalization, and duplicate-safe copy row construction.
- Use SQL migration tests for `study_goals` RLS, explicit authenticated grants, and owner-safe todo goal links.
- Use SQL migration tests for `study_session_todos` RLS, explicit authenticated grants, and user-scoped composite foreign keys.
- Use SQL/source tests to verify `study_presence_events` RLS and `camera-presence-warning` session ownership checks.

## Deployment Strategy

1. Configure `apps/web/.env.local` with production Supabase values.
2. Build the web app with `npm.cmd run build` for local verification.
3. Set Vercel project environment variables for public Vite build values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`, and `VITE_GOOGLE_AUTH_ENABLED`.
4. Deploy the static web app to Vercel using `vercel.json`.
5. For repeatable GitHub-based production deploys, configure GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`, then let `.github/workflows/vercel-production.yml` run `npm test` and `vercel deploy --prod` on `main` pushes.
6. If Vercel Git integration remains enabled, monitor for duplicate deployments and keep only one deployment path as the source of truth.
7. Deploy `attendance-cron` Edge Function with `verify_jwt=false`.
8. Deploy `camera-presence-warning` Edge Function with `verify_jwt=false`; the function performs its own Supabase JWT and session ownership validation.
9. Set Edge Function secrets: `CRON_SECRET`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, optionally `RESEND_API_KEY`, for Slack either `SLACK_BOT_TOKEN` or `STUDY_ALERT_SLACK_BOT_TOKEN`, and `APP_ORIGIN`.
10. Store `project_url` and `cron_secret` in Supabase Vault.
11. Run `supabase/cron.sql` or equivalent SQL to register `study-room-attendance-cron`.
12. Verify `net._http_response` shows 200 responses from automatic cron calls.
13. Optional AWS deployment: run `npm.cmd run infra:synth` and `cdk deploy`.

## Security Notes

- Supabase Cron uses Vault-stored secrets and never exposes `cron_secret` to the client.
- `slack-test-alarm` is deployed with `verify_jwt=false` only because it performs its own `x-cron-secret` or Supabase JWT validation before reading any target or sending any message.
- `camera-presence-warning` is deployed with `verify_jwt=false` only because it handles CORS preflight and then validates the Supabase JWT with `admin.auth.getUser(jwt)`.
- Camera frames never leave the browser. The app sends only `sessionId`, `absenceSeconds`, `detectedAt`, and `eventType` to the Edge Function.
- `study_presence_events` has a DB check constraint that rejects media-like metadata keys.
- Pose landmarks are used only in memory inside the browser and are not sent to Supabase.
- Legacy Kakao raw tokens are not exposed through frontend local storage or public RLS policies. The active product path no longer writes or refreshes Kakao tokens.
- Slack bot tokens are never stored in frontend code or user-managed DB rows.
- `CronSecret` is a CloudFormation `NoEcho` parameter and Lambda environment variable.
- For production with multiple operators, migrate `CronSecret` to Secrets Manager despite small fixed cost.
- CloudFront is the only public entry point for the static site bucket.
- CloudWatch Logs retention is one week.
- Vercel deployment stores only public Vite build-time values in the frontend bundle; service role keys and provider tokens remain in Supabase secrets or server-side tables.
- GitHub Actions Vercel deployment uses only GitHub Secrets for `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`; none of those values should be stored in frontend code.

## Supabase 변경 이력

### 2026-06-25

- 변경 대상: `public.submit_study_recovery_request`, `slack-recovery-interactions`, `study_recovery_requests`, `study_todos`
- 변경 내용: 회복 루틴 제출 시 `p_pledge_todo_title` / Slack pledge 입력값은 `study_recovery_requests.pledge_todo_title`에만 저장하고, `study_todos`에는 오늘 보충 과제 1건만 생성하도록 변경했다. 새 제출의 `pledge_todo_id`는 `null`로 남긴다.
- 변경 이유: 마지막 입력칸인 내일 재도전 약속에는 `9시에 시작` 같은 시간 문구가 자주 들어가며, 이를 다음날 할 일로 자동 생성하면 실제 처리할 todo 목록이 약속 문장으로 오염되기 때문이다.
- 관련 기능: Slack 회복 루틴, 앱 내부 회복 루틴 모달, todo 자동 생성, 세션 시작 차단 해제
- 마이그레이션 파일: `supabase/migrations/20260625115531_recovery_pledge_note_only.sql`
- 확인 방법: `node --test apps\web\test\recoveryRoutine.test.mjs apps\web\test\slackNotifications.test.mjs packages\core\test\sql-migrations.test.mjs`
- 주의 사항: 기존 과거 제출에서 이미 생성된 pledge todo는 자동 삭제하지 않는다. 이 변경은 새 회복 루틴 제출부터 적용된다.

### 2026-06-23

- 변경 대상: `public.study_todos`
- 변경 내용: `repeat_forever boolean not null default false` 컬럼을 추가하고, `study_todos_repeat_consistency_check`를 교체해 weekly 반복이 `repeat_until` 또는 `repeat_forever = true` 중 하나를 가질 수 있게 했다.
- 변경 이유: 사용자가 요일 반복 todo를 종료일 없이 계속 유지하고, 나중에 같은 반복 그룹 전체를 삭제할 수 있어야 하기 때문이다.
- 관련 기능: 출석 캘린더 todo, 영구 반복 일정, 반복 그룹 삭제
- 마이그레이션 파일: `supabase/migrations/20260623143000_study_todo_repeat_forever.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260623134937 study_todo_repeat_forever` 확인, SQL에서 `repeat_forever_exists=true` 및 updated consistency check 확인
- 주의 사항: 현재 구현은 반복 규칙 전용 테이블이 아니라 dated row materialization을 유지한다. `repeat_forever = true`는 종료일 없음 메타데이터이고, 웹 앱은 저장 시 1년치 dated rows를 먼저 생성한다.

### 2026-06-18

- 변경 대상: `public.submit_study_recovery_request`
- 변경 내용: 앱에서 pending `study_recovery_requests`를 직접 제출할 수 있도록 인증 사용자용 RPC를 추가했다. RPC는 `auth.uid()`로 소유자를 확인하고, pending 요청을 lock한 뒤 오늘 보충 todo와 내일 재도전 todo를 생성하고 recovery request를 `submitted`로 변경한다. 후속 migration으로 `anon` 실행 권한을 제거하고 `authenticated`만 실행 가능하게 보강했다.
- 변경 이유: Slack interactivity가 실패하거나 사용자가 앱 URL로 직접 접속한 경우에도 회복 루틴을 제출하고 공부 시작 차단을 해제할 수 있어야 하기 때문이다.
- 관련 기능: Slack 회복 루틴, 앱 내부 회복 루틴 모달, 공부 시작 차단 해제, todo 자동 생성
- 마이그레이션 파일: `supabase/migrations/20260618121536_in_app_recovery_submission.sql`, `supabase/migrations/20260618123154_revoke_anon_recovery_submission.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `in_app_recovery_submission`과 `revoke_anon_recovery_submission` 확인, SQL 권한 확인에서 `anon_can_execute=false`, `authenticated_can_execute=true`, 익명 PostgREST 호출이 `permission denied for function submit_study_recovery_request`로 401 반환
- 주의 사항: 이 RPC는 Slack 모달을 대체하지 않는다. Slack modal submit과 앱 modal submit 모두 같은 recovery request를 `submitted`로 만들고 같은 todo 생성 효과를 가진다.

### 2026-06-16

- 변경 대상: `public.profiles`, `public.get_due_reminders`, `public.mark_missed_attendance`, `public.start_study_session`, `public.end_study_session`, `attendance-cron`
- 변경 내용: profile reminder default를 `20:30`으로 맞추고, `study_attendance_goal_seconds`, `effective_reminder_time`, `daily_completed_study_seconds`, `promote_attendance_by_daily_study_total` 함수를 추가했다. 평일은 2시간, 주말은 4시간 누적 공부 목표를 출석 인정 조건으로 추가했고, 주말 알림은 14:00으로 고정했다. `attendance-cron` Slack/WebPush/Email 본문에는 목표 시간 회복 경로를 포함했다.
- 변경 이유: 사용자가 30분 출석 창을 놓쳐도 당일 목표 공부 시간을 채우면 출석으로 인정하고, 주말 알림 시간을 오후 2시로 분리하기를 요청했다.
- 관련 기능: 강제 출석, Supabase Cron 알림, Slack 알림, 회복 루틴, 공부 시간 누적.
- 마이그레이션 파일: `supabase/migrations/0021_late_study_goal_attendance_policy.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260615161759 late_study_goal_attendance_policy` 확인, Supabase Edge Function list에서 `attendance-cron` version 18 ACTIVE 확인.
- 주의 사항: 늦은 공부 출석 승격은 세션 종료 후 `duration_seconds`가 저장되는 시점에 평가된다. 진행 중인 active session만으로는 DB 출석 상태가 즉시 바뀌지 않는다.

### 2026-06-16

- 변경 대상: `public.study_todos`
- 변경 내용: 반복 todo 편집을 위해 `repeat_group_id`, `repeat_mode`, `repeat_weekdays`, `repeat_until` 컬럼을 추가했다. weekly todo는 같은 `repeat_group_id`로 묶고, single todo는 repeat metadata를 비운 상태로 유지한다. `study_todos_repeat_mode_check`, `study_todos_repeat_weekdays_check`, `study_todos_repeat_consistency_check`, `study_todos_repeat_group_idx`를 추가했다.
- 변경 이유: 캘린더 모달에서 이미 등록된 할 일의 시간, 요일, 반복 종료일을 다시 열어 수정할 수 있어야 하기 때문이다.
- 관련 기능: 출석 캘린더 todo 편집, 요일 반복 todo, 선택형 시간 todo
- 마이그레이션 파일: `supabase/migrations/0020_study_todo_repeat_metadata.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260615152037 study_todo_repeat_metadata` 확인
- 주의 사항: 반복 규칙 전용 테이블은 아직 없다. 기존 date-based `study_todos` 행을 유지하되, weekly row에만 가벼운 반복 메타데이터를 저장한다.

### 2026-06-14

- 변경 대상: `public.notification_targets`, `public.kakao_message_connections`, `attendance-cron`
- 변경 내용: `0018_disable_kakao_notifications.sql`로 enabled `kakao_memo` target과 enabled Kakao connection을 비활성화했다. `attendance-cron`에서는 Kakao Memo API 발송 분기를 제거하고 Slack/WebPush/Email/Expo 경로만 유지했다. 원격 `attendance-cron` version 15를 ACTIVE로 배포했고, legacy `kakao-token`과 `telegram-test-alarm` Edge Function은 삭제했다.
- 변경 이유: 알림 채널을 Slack Bot API 중심으로 정리하고, 사용하지 않는 Kakao OAuth/토큰/발송 경로로 인한 설정 혼동을 제거하기 위해서다.
- 관련 기능: Slack 알림, 예약 출석 알림, 카메라 경고 알림, Kakao 알림 폐기
- 마이그레이션 파일: `supabase/migrations/0018_disable_kakao_notifications.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `disable_kakao_notifications` 확인, Supabase Edge Function list에서 `attendance-cron` v15 ACTIVE 및 legacy 함수 삭제 확인
- 주의 사항: 과거 Kakao delivery 기록과 legacy schema는 보존한다. 활성 제품 경로에서는 Kakao target을 조회하거나 발송하지 않는다.

### 2026-06-14

- 변경 대상: `public.study_todos`, `attendance-cron`, `slack-test-alarm`
- 변경 내용: `study_todos`에 선택형 `start_time`, `end_time` 컬럼과 `study_todos_time_window_check` 제약을 추가했다. `attendance-cron`과 `slack-test-alarm`은 todo 조회 시 시간 컬럼을 포함하고, Slack/WebPush/이메일 알림 본문에 시간 범위를 포함하도록 변경했다.
- 변경 이유: 사용자가 Google Calendar처럼 하루 todo에 선택형 시작/종료 시간을 설정하고, 반복 요일 등록에도 같은 시간 범위를 적용하기 원했기 때문이다.
- 관련 기능: 할 일 등록, 요일 반복 todo, 오늘 할 일 표시, Slack/WebPush/이메일 알림 본문
- 마이그레이션 파일: `supabase/migrations/0016_study_todo_time_window.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260614115454 study_todo_time_window` 확인, Edge Function list에서 `attendance-cron` v12와 `slack-test-alarm` v2 ACTIVE 확인
- 주의 사항: 기존 todo는 시간 컬럼이 null이므로 기존 표시와 동작이 유지된다.

### 2026-06-14

- 변경 대상: `public.get_due_reminders`, `public.mark_missed_attendance`
- 변경 내용: 알림 시간 이전에 시작한 공부 세션이 `reminder_at` 시각을 지나 계속 열려 있거나, `reminder_at` 이후에 종료된 경우 출석 충족 세션으로 인정한다. 이 경우 초기 알림과 15분 재촉 알림을 보내지 않고, pending 출석은 결석 처리 전에 `present`로 보정한다.
- 변경 이유: 사용자가 이미 공부 중인데 20:30 알림 모달과 서버 알림이 다시 발생하는 문제를 막기 위해서다.
- 관련 기능: 강제 출석 알림, Slack/WebPush 예약 알림, 출석/결석 자동 처리
- 마이그레이션 파일: `supabase/migrations/0015_pre_reminder_active_session_attendance.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP migration list에서 `20260614114124 pre_reminder_active_session_attendance` 확인
- 주의 사항: 시작 순간에는 pre-reminder 세션을 즉시 `present`로 만들지 않고, 알림 시각 cron에서 세션이 `reminder_at`을 실제로 걸쳤을 때만 보정한다.

### 2026-06-14

- 변경 대상: `public.notification_targets`, `public.notification_deliveries`, `attendance-cron`, `camera-presence-warning`, `slack-test-alarm`
- 변경 내용: `slack` 알림 채널을 추가하고, 기존 enabled Telegram target을 비활성화하는 migration을 추가했다. `attendance-cron`과 `camera-presence-warning`은 Slack Bot API `chat.postMessage`를 사용하도록 전환했고, 수동 테스트 함수는 `slack-test-alarm`으로 교체했다.
- 변경 이유: 사용자가 Telegram 대신 Slack bot 기반 알림을 원하고, 기존 예약 알림/오늘 할 일/카메라 경고를 Slack으로 받아야 하기 때문이다.
- 관련 기능: Slack 알림, Slack 테스트 알림, 카메라 자리 비움 경고, 강제 출석 알림
- 마이그레이션 파일: `supabase/migrations/0014_slack_notification_targets.sql`
- 확인 방법: `npm.cmd test`에서 Slack migration, `attendance-cron`, `camera-presence-warning`, `slack-test-alarm` source test 통과. 원격 Supabase migration list에서 `20260614112431 slack_notification_targets`를 확인했고, Edge Function list에서 `attendance-cron` version 11, `camera-presence-warning` version 3, `slack-test-alarm` version 1 ACTIVE를 확인했다.
- 주의 사항: 실제 Slack 발송에는 Supabase Edge Function secret `SLACK_BOT_TOKEN` 또는 `STUDY_ALERT_SLACK_BOT_TOKEN` 설정과 Slack bot의 채널 초대가 필요하다.

### 2026-06-14

- 변경 대상: `apps/web/src/cameraPresence.mjs`, `public.end_study_session`
- 변경 내용: 카메라 미감지 5분에는 경고만 보내고, 총 10분 미감지부터 타이머를 자동 일시정지하도록 변경했다. 제외 시간은 10분 이후의 자동 일시정지 구간만 계산한다.
- 변경 이유: 사용자가 경고 후 5분 복귀 유예 시간을 원했고, 해당 유예 시간은 공부 시간에 포함하기로 결정했기 때문이다.
- 관련 기능: 카메라 기반 자리 비움 경고, 공부 시간 자동 일시정지, 공부 시간 제외
- 마이그레이션 파일: 없음
- 확인 방법: `npm.cmd test`에서 5분 경고/10분 일시정지/제외 시간 계산 테스트 통과.
- 주의 사항: 10분 미복귀 자동 종료는 더 이상 새 정책에 포함되지 않는다.

### 2026-06-14

- 변경 대상: `public.study_presence_events`, `camera-presence-warning`
- 변경 내용: `study_presence_events_event_type_check` constraint에 `camera_required_warning`을 추가했다. `camera-presence-warning` Edge Function version 2는 request body의 `eventType`을 파싱하고, `camera_required_warning`에는 `absenceSeconds=0`을 허용하며 Telegram 경고 문구를 별도로 보낸다.
- 변경 이유: 공부 세션 시작 전 카메라 감시를 필수화하고, 활성 세션 중 카메라가 꺼진 경우 앱/Telegram 경고를 기록하기 위해서다.
- 관련 기능: 카메라 필수 출석 게이트, Telegram 카메라 꺼짐 경고
- 마이그레이션 파일: `supabase/migrations/0012_camera_required_warning.sql`
- 확인 방법: Supabase SQL verification에서 `camera_required_warning_allowed=true`, Edge Function list에서 `camera-presence-warning` version 2 ACTIVE 확인.

### 2026-06-14

- 변경 대상: `public.end_study_session`
- 변경 내용: `end_study_session` RPC를 `p_excluded_seconds integer default 0` 인자를 받도록 교체하고, `duration_seconds`를 전체 경과 시간에서 제외 초를 뺀 값으로 저장하도록 했다.
- 변경 이유: 5분 이상 상반신 미감지로 자동 일시정지된 시간과 10분 미복귀 자동 종료 전의 자리 비움 시간을 공부 시간에서 제외하기 위해서다.
- 관련 기능: 카메라 미감지 자동 일시정지, 10분 미복귀 자동 종료, 공부 시간 제외
- 마이그레이션 파일: `supabase/migrations/0013_exclude_camera_absence_from_sessions.sql`
- 확인 방법: `npm.cmd test`, `npm.cmd run build`, Supabase MCP `_apply_migration` success, migration list의 `exclude_camera_absence_from_sessions` 확인.
- 주의 사항: `verify_jwt=false`는 CORS preflight 때문에 유지하지만 함수 내부에서 Supabase JWT와 세션 소유권을 검증한다.

### 2026-06-13

- 변경 대상: `public.study_presence_events`, `camera-presence-warning`
- 변경 내용: 카메라 감시 이벤트 테이블을 추가하고 RLS/metadata no-media 제약을 설정했다. `camera-presence-warning` Edge Function version 1을 배포해 Supabase JWT와 `study_sessions.user_id`를 검증한 뒤 `absence_warning` 이벤트와 Telegram 경고를 처리한다.
- 변경 이유: 활성 공부 세션 중 5분 동안 얼굴이 감지되지 않으면 경고하되, 사진/영상/얼굴 특징값은 저장하지 않기 위해서다.
- 관련 기능: 카메라 기반 자리 비움 경고, Telegram 경고, 공부 습관 강제 장치
- 마이그레이션 파일: `supabase/migrations/0011_study_presence_events.sql`
- 확인 방법: Supabase SQL verification에서 `table_exists=true`, `rls_enabled=true`, `policy_count=2`, `metadata_no_media_check_exists=true`, `event_type_check_exists=true`를 확인했다. Edge Function list에서 `camera-presence-warning` version 1 ACTIVE를 확인했다.
- 주의 사항: Vercel production에는 아직 웹 UI 변경이 배포되지 않았다. `VERCEL_TOKEN` 또는 CLI login/device auth가 필요하다.

### 2026-06-13

- 변경 대상: `public.get_due_reminders(timestamptz)`, `public.mark_missed_attendance(timestamptz)`, `public.start_study_session()`, `attendance-cron`, `telegram-test-alarm`
- 변경 내용: 출석 마감을 알림 후 30분으로 확장하고, 알림 후 15분에 `reminder_stage = 'nudge'` 재촉 알림을 발송하도록 변경했다. `attendance-cron`은 `initial`/`nudge` stage에 따라 제목/본문을 다르게 만들고 push payload에 `reminderStage`를 포함한다.
- 변경 이유: 사용자가 8:30 1차 알림, 8:45 재촉 알림, 9:00 결석 처리 흐름을 요청했다.
- 관련 기능: 강제 출석, Telegram 알림, Web Push 컴퓨터 알림, 이메일 fallback, 앱 내부 알림 팝업
- 마이그레이션 파일: `supabase/migrations/0010_two_step_attendance_deadline.sql`
- 확인 방법: Supabase migration history에 `two_step_attendance_deadline` 확인, 원격 함수 정의의 `reminder_stage`/`nudge`/`interval '30 minutes'` 조건 확인, `attendance-cron` version 10 ACTIVE 및 `telegram-test-alarm` version 3 ACTIVE 확인.
- 주의 사항: 8:45 재촉 알림은 `attendance_days.status = 'pending'`이 존재해야 발송된다. 따라서 8:30 initial reminder cron이 정상 실행되어 pending row를 만들어야 한다.

### 2026-06-11

- 변경 대상: `public.start_study_session()`
- 변경 내용: `attendance_days.status = 'present'` 쓰기를 `now() >= reminder_at and now() <= deadline_at` 조건 안으로 이동했다.
- 변경 이유: 알림 시간 전에 타이머를 짧게 시작해도 당일이 `present`가 되어, 실제 알림 시간에는 `get_due_reminders()`가 사용자를 제외하는 문제가 있었다.
- 관련 기능: 강제 출석, Telegram 알림, Web Push 컴퓨터 알림
- 마이그레이션 파일: `supabase/migrations/0009_start_session_attendance_window.sql`
- 확인 방법: Supabase MCP `_apply_migration` 성공, migration history의 `start_session_attendance_window` 확인, 원격 함수 정의의 `function_guard=True` 확인.
- 주의 사항: 기존에 잘못 생성된 `present` 행은 이 migration이 자동 보정하지 않는다.

### 2026-06-11

- 변경 대상: `telegram-test-alarm` Edge Function
- 변경 내용: version 2를 배포했다. 기존 `x-cron-secret` 관리자 호출은 유지하면서, 브라우저에서 Supabase JWT로 호출할 수 있게 CORS와 JWT 검증을 추가했다. JWT 호출은 `admin.auth.getUser(jwt)`로 사용자를 확인하고 `notification_targets.user_id`가 로그인 사용자와 일치하는 Telegram target만 사용한다.
- 변경 이유: 사용자가 웹 설정 화면에서 직접 Telegram 테스트 알림을 보내고, 오늘 todo 포함 여부를 확인할 수 있어야 하기 때문이다.
- 관련 기능: Telegram 테스트 알림, todo 포함 알림, 웹 설정 화면
- 마이그레이션 파일: 없음
- 확인 방법: Supabase MCP `_deploy_edge_function`으로 `telegram-test-alarm` version 2 ACTIVE 확인, 인증 없는 POST 호출이 `401`을 반환함 확인.
- 주의 사항: `CRON_SECRET`과 `TELEGRAM_BOT_TOKEN`은 브라우저에 노출하지 않는다. 운영 웹 UI 반영은 Vercel production 배포가 필요하다.

### 2026-06-11

- 변경 대상: `telegram-test-alarm` Edge Function, `notification_deliveries`
- 변경 내용: `x-cron-secret`으로 보호되는 Telegram 테스트 발송 Edge Function을 추가하고 version 1 ACTIVE로 배포했다. 함수는 최신 enabled Telegram target 1개를 조회하고, 해당 사용자의 오늘 `study_todos`를 메시지에 포함한 뒤 Telegram Bot API `sendMessage`를 호출한다.
- 변경 이유: 기존 `attendance-cron`은 실제 due reminder 처리용이라 수동 테스트 1회 발송에 적합하지 않고, 로컬에서 bot token을 직접 다루면 secret 노출 위험이 있기 때문이다.
- 관련 기능: Telegram 테스트 알림, todo 포함 알림, 알림 발송 기록
- 마이그레이션 파일: 없음
- 확인 방법: Supabase MCP `_deploy_edge_function`으로 `telegram-test-alarm` version 1 ACTIVE 확인, Edge Function 호출 결과 `local_date=2026-06-11`, `todo_count=0`, `message_id=5` 확인.
- 주의 사항: `verify_jwt=false` 배포지만 함수 내부에서 `CRON_SECRET`을 검증한다. Telegram bot token과 cron secret 원문은 문서화하지 않는다.

### 2026-06-11

- 변경 대상: `attendance-cron`
- 변경 내용: due reminder 대상자의 `study_todos`를 `user_id`와 `local_date` 기준으로 조회하고, 알림 본문에 `오늘 할 일` 요약을 포함하도록 변경했다.
- 변경 이유: Telegram 및 컴퓨터 알림을 받을 때 그날 작성한 todo list도 함께 확인해야 하기 때문이다.
- 관련 기능: Telegram 알림, Web Push 컴퓨터 알림, 앱 내부 알림 팝업, todo list
- 마이그레이션 파일: 없음
- 확인 방법: `npm.cmd test` 31개 통과, `npm.cmd run build` 통과, Supabase `attendance-cron` version 9 ACTIVE 배포 확인, Vercel latest deployment READY 및 배포 JS에 `reminder-todos` UI 포함 확인.
- 주의 사항: 실제 알림 본문은 알림 시간이 도래해 Supabase Cron이 `attendance-cron`을 호출할 때 생성된다. 실수신 검증은 알림 시간을 현재 시각 기준 2~3분 뒤로 설정해 확인한다.

### 2026-06-11

- 변경 대상: Supabase Auth URL config, Edge Function secrets
- 변경 내용: Vercel 운영 URL `https://study-room-attendance.vercel.app`를 Supabase Auth `site_url`과 redirect allow list에 추가했고, Edge Function secret `APP_ORIGIN`을 같은 URL로 설정했다.
- 변경 이유: Vercel 배포 환경에서 Google OAuth callback과 Telegram 메시지의 앱 링크가 운영 URL을 사용해야 하기 때문이다.
- 관련 기능: Vercel 정적 배포, Google 로그인, Telegram 알림 링크
- 마이그레이션 파일: 없음
- 확인 방법: Vercel URL과 `/auth/callback`이 200을 반환했고, 배포된 JS 번들에 Supabase 프로젝트 URL이 포함되며 Google 로그인 비활성화 문구와 placeholder가 없음을 확인했다. Supabase Google authorize endpoint가 Vercel callback 기준 `302 Found`를 반환함도 확인했다.
- 주의 사항: Vercel CLI 최신 버전은 한글 Windows hostname이 `user-agent`에 들어가 실패하므로 OAuth device login과 `vercel@48.6.0 --token` 경로를 사용했다.

### 2026-06-11

- 변경 대상: `notification_targets`, `notification_deliveries`, `attendance-cron`, Edge Function secrets
- 변경 내용: `telegram` 알림 채널을 추가하고, `attendance-cron` Edge Function에 Telegram Bot API `sendMessage` 발송 분기를 추가했다. Edge Function secrets에는 `RESEND_API_KEY`와 `TELEGRAM_BOT_TOKEN`이 설정되어 있음을 확인했다.
- 변경 이유: 이메일 fallback을 복구하고, Kakao OAuth보다 단순한 개인용 메시지 알림 채널을 제공하기 위해서.
- 관련 기능: Telegram 알림, 이메일 fallback, 앱 내부 팝업 알림
- 마이그레이션 파일: `supabase/migrations/0008_telegram_notification_targets.sql`
- 확인 방법: 원격 DB constraint가 `telegram`을 허용하는지 확인했고, `attendance-cron` version 6 ACTIVE 배포를 확인했다. `npm.cmd test`와 `npm.cmd run build`가 통과했다.
- 주의 사항: 실제 Telegram 발송에는 사용자가 bot에게 먼저 메시지를 보내고 Chat ID를 앱 설정에 저장해야 한다. `APP_ORIGIN`은 아직 배포 URL이 없어 missing이다.

### 2026-06-08

- 변경 대상: `kakao_message_connections`, `notification_targets`, `notification_deliveries`, `kakao-token`, `attendance-cron`
- 변경 내용: `kakao_message_connections` 토큰 저장 테이블을 추가하고, 알림 대상/발송 기록 체크 제약에 `kakao_memo` 채널을 추가했다. `kakao-token` Edge Function을 추가해 Kakao provider token을 서버 측에 저장하고, `attendance-cron` Edge Function에 Kakao Talk Message API 나에게 보내기 발송 분기를 추가했다.
- 변경 이유: 사용자가 이메일/Google 로그인 계정을 유지하면서 카카오톡 나에게 보내기 알림만 별도로 연결할 수 있어야 하기 때문이다.
- 관련 기능: 카카오톡 알림 연결, Supabase Cron 기반 서버 측 알림, 컴퓨터가 꺼져 있어도 동작하는 알림
- 마이그레이션 파일: `supabase/migrations/0007_kakao_message_notifications.sql`
- 확인 방법: 원격 DB에서 `public.kakao_message_connections` 존재와 `kakao_memo` constraint 포함을 확인했다. Edge Function 목록에서 `kakao-token` version 2 ACTIVE, `attendance-cron` version 4 ACTIVE를 확인했다. `kakao-token` CORS preflight는 204, 인증 없는 GET은 함수 내부 401을 반환했다.
- 주의 사항: Supabase Auth `security_manual_linking_enabled`가 아직 false이므로 사용자가 직접 Manual Linking을 켜야 한다. Edge Function secrets `KAKAO_REST_API_KEY`, 필요 시 `KAKAO_CLIENT_SECRET`, 배포 URL 확정 시 `APP_ORIGIN`도 아직 설정해야 한다.

### 2026-06-08

- 변경 대상: Supabase Auth Kakao Provider
- 변경 내용: 원격 프로젝트 `bqohkdzvxbrokkmuhysx`의 `external_kakao_enabled`를 `true`로 설정했다. Kakao Client ID/Secret은 이미 설정되어 있었고, `external_kakao_email_optional`은 `false`로 유지했다.
- 변경 이유: Kakao OAuth 요청이 `Unsupported provider: provider is not enabled` 오류로 실패했기 때문이다.
- 관련 기능: 카카오 로그인, 카카오톡 나에게 보내기 알림 연동 준비
- 마이그레이션 파일: 없음
- 확인 방법: `/auth/v1/authorize?provider=kakao&redirect_to=http://127.0.0.1:5177/auth/callback` 요청이 `302 Found`와 Kakao OAuth URL을 반환함. `scopes=talk_message ...` 파라미터를 넣으면 Kakao OAuth URL의 scope에 `talk_message`가 포함됨.
- 주의 사항: 현재 앱 UI와 `attendance-cron`에는 아직 Kakao 연결/발송 채널이 없다.

### 2026-06-08

- 변경 대상: Supabase Auth Google Provider
- 변경 내용: 원격 프로젝트 `bqohkdzvxbrokkmuhysx`의 `external_google_enabled`를 `true`로 설정했다. Google Client ID/Secret은 이미 등록되어 있었고, `uri_allow_list`에는 `http://127.0.0.1:5177/auth/callback`, `http://localhost:5177/auth/callback`이 포함되어 있음을 확인했다.
- 변경 이유: Google OAuth 요청이 `Unsupported provider: provider is not enabled` 오류로 실패했기 때문이다.
- 관련 기능: Google 로그인, Supabase Auth OAuth callback
- 마이그레이션 파일: 없음
- 확인 방법: `/auth/v1/authorize?provider=google&redirect_to=http://127.0.0.1:5177/auth/callback` GET 요청이 `302 Found`와 Google OAuth URL을 반환함.
- 주의 사항: Google Cloud OAuth Client의 Authorized redirect URI에는 Supabase callback `https://bqohkdzvxbrokkmuhysx.supabase.co/auth/v1/callback`이 필요하다.

### 2026-06-07

- 변경 대상: Supabase Edge Function secrets, Vault, pg_cron, `get_due_reminders`
- 변경 내용: `CRON_SECRET`과 VAPID key pair를 설정하고, Vault `project_url`/`cron_secret` 및 `study-room-attendance-cron`을 등록했다. `get_due_reminders`의 PL/pgSQL column ambiguity를 `attendance_days_pkey` constraint와 `dn.*` alias로 수정했다.
- 변경 이유: S3/정적 앱에서도 서버 측 알림/출석 자동 처리를 Supabase만으로 수행하기 위해서.
- 관련 기능: 알림 발송, 결석 처리, 웹 푸시
- 마이그레이션 파일: `supabase/migrations/0006_fix_due_reminders_ambiguity.sql`
- 확인 방법: `net._http_response` 최신 자동 cron 응답이 200이고, content가 `{"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}` 형태로 반환됨.
- 주의 사항: `RESEND_API_KEY`와 Expo `EXPO_PUBLIC_EAS_PROJECT_ID`는 아직 별도 설정 필요.

## Session Activity Heartbeat

- Auth session persistence and study-session activity are separate concerns. Supabase Auth continues to use persistent browser storage, while counted study time uses a separate per-user/per-study-session heartbeat.
- Web active sessions store localStorage key study-room-session-activity:{userId}:{sessionId}.
- The heartbeat interval is 15 seconds. A missing heartbeat for more than 5 minutes is treated as browser/computer inactivity, not as valid study time.
- On active-session restore, stale activity calls end_study_session with p_excluded_seconds equal to the existing camera/lease exclusion plus the inactive gap.
- pagehide and beforeunload only update the final activity timestamp; they still do not directly end the session.
- visibilitychange to visible refreshes the activity timestamp so ordinary tab switching is not mistaken for browser close.
- This MVP is same-browser only. A server-side heartbeat or Supabase Cron cleanup would be needed for cross-device enforcement.

## Timed Todo Reminder Rescheduling

- Timed todo Slack reminders are still computed by Supabase Cron from current study_todos rows through get_due_todo_schedule_reminders(p_now).
- study_todo_schedule_deliveries remains the duplicate-lock table keyed by todo_id, target_id, reminder_type, and scheduled_at.
- Migration 20260628174500_clear_future_todo_schedule_deliveries.sql adds clear_future_todo_schedule_deliveries(p_todo_ids, p_changed_at) and an AFTER UPDATE trigger on study_todos(start_time, end_time, is_completed).
- When a schedule changes, future reminder locks for that todo are deleted so the next cron evaluation can send according to the current start/end time.
- Past sent reminders are retained as delivery history and cannot be unsent.

## 2026-07-05 CI Build Script Note

- Root build script: package.json build uses npm --workspace apps/web run build so GitHub Actions ubuntu-latest can run npm run build. Local Windows operators should continue invoking it as npm.cmd run build from PowerShell.

## Slack Session Lease User Mentions

- notification_targets can store an optional slack_user_id for Slack targets.
- The value is a Slack member ID beginning with U or W, such as U123ABC456. It is not a Slack display name or email.
- Web settings normalize and validate the value before saving it. Blank values are allowed and keep the existing channel-only behavior.
- get_due_session_lease_warnings(p_now) returns slack_user_id together with channel_id so attendance-cron can render a mention in the same message.
- attendance-cron prepends <@SlackUserId> only to the active session lease warning that is sent 5 minutes before lease_expires_at.
- Scheduled study alarms, todo reminders, camera warnings, and recovery routines continue to use channel delivery without forced user mentions unless a future PRD expands that scope.


## Study Forest Interior Navigation and Time Environment (2026-07-12)

### Architecture

- 야외와 실내는 `forestSceneMode`로 전환하되 캐릭터 상태는 `forestAvatar`와 `forestInteriorAvatar`로 분리한다.
- 실내 입력은 `studyForest.mjs`의 순수 helper가 정규화 좌표, 가구 충돌, 출구 영역을 판정하고 Three.js는 좌표를 월드 공간으로 변환해 보간한다.
- 집 진입은 야외 문 클릭 또는 입구에서 위쪽 이동으로, 집 퇴장은 실내 아래쪽 문 영역 통과로만 수행한다. 별도 퇴장 버튼은 두지 않는다.
- 시간대는 브라우저 로컬 시각을 1분마다 확인해 아침, 낮, 해질녘, 밤 중 하나로 파생하며 서버 상태나 환경 변수에 저장하지 않는다.
- 출석 인테리어 보상은 현재 성장 일수와 완성 나무 수에서 순수하게 파생한다. 완성 나무가 있으면 이전 주기의 해금 아이템은 유지한다.

### Design Patterns

- 이동 가능 여부와 보상 해금 계산은 React/Three.js에서 분리된 결정적 helper로 유지한다.
- Three.js animation loop는 React 상태를 직접 갱신하지 않고 ref에 저장된 목표 위치와 방향을 보간한다.
- 실내 가구 배치와 충돌 상수는 같은 공간 모델을 공유하므로 가구 위치 변경 시 helper 테스트를 함께 갱신한다.

### Testing Strategy

- helper 테스트로 실내 한 칸 이동, 가구 충돌, 입구/출구 판정, 시간 경계, 단계별 보상 보존을 검증한다.
- UI 소스 계약 테스트로 실내 props 연결, 퇴장 버튼 제거, 방향 회전 부호, 시간대 배지, 보상 오브젝트 이름을 고정한다.
- 전체 `npm test`, `npm run build`, 로컬 HTTP 200을 배포 전 게이트로 사용한다.

### Deployment Strategy

- 이번 변경은 클라이언트 전용이며 Supabase 스키마/API 변경이 없다.
- 사용자의 명시적 요청 전에는 커밋, 푸시, Vercel 배포를 수행하지 않는다.

## Physics-aware Bridge Layout (2026-07-17)

### Architecture

- `studyForest.mjs`의 `forestBridgePhysics`가 다리 위치, 회전, 데크 크기, 난간 간격, 난간 기둥, 캐릭터 반경을 단일 기준으로 제공한다.
- `StudyForest3D.tsx`는 같은 값을 사용해 mesh를 만들고, 순수 충돌 helper는 이를 기본 월드 좌표로 변환해 통과 가능 영역을 계산한다.
- 고정된 저폴리 구조물에는 별도 rigid-body 라이브러리를 추가하지 않고 결정적 static collider를 사용해 모바일 번들 및 프레임 비용을 억제한다.

### Collision Model

- 다리 로컬 X축은 이동 방향, 로컬 Z축은 폭 방향이다. 난간은 로컬 Z 양쪽에 배치하고 beam과 post 열은 로컬 X축을 따른다.
- 캐릭터 중심의 안전 통로는 난간 안쪽 면에서 실제 캐릭터 반경을 뺀 값으로 계산한다.
- 데크 위이지만 안전 통로 밖이면 `bridge-rail`, 데크 밖의 강이면 `water`를 반환한다.

### Testing and Deployment

- helper 테스트는 안전 통로 경계, 난간 충돌, 강물 충돌, 중앙 경로를 검증한다.
- UI 소스 계약 테스트는 난간 축, 양쪽 배치, 기둥 열, 열린 입구와 출구를 고정한다.
- 이 변경은 클라이언트 전용이며 Supabase 변경이 없다. 커밋, 푸시, 배포는 사용자 요청이 있을 때만 수행한다.


## Reward-aware Cottage Collision (2026-07-12)

- Permanent furniture collision areas are always active.
- Attendance reward furniture collision areas must carry the same reward key used by `getForestInteriorRewards()`.
- Keyboard, touch-button, and click-to-walk movement must pass the current reward map into the same pure collision helpers.
- A hidden or locked reward prop must never reserve invisible floor space.

## Sustainable Study Loop and Feature Bundles (2026-07-15)

### Architecture

- 전역 인증, 공통 조회, 라우팅 조정은 `main.tsx`에 두고 숲, 세션 회고, 주간 리뷰, 적응형 알림 UI는 각각 지연 로딩되는 독립 컴포넌트로 분리한다.
- 주간 리뷰와 적응형 알림 계산은 React 밖의 결정적 helper에서 수행한다.
- `start_study_session(uuid[])`는 인증 사용자의 미완료 당일 할 일을 검증하고 세션과 링크를 한 트랜잭션으로 만든다.
- `complete_study_session(...)`는 선택한 할 일 완료, 세션 종료, 링크 완료 표시, 회고 저장을 한 트랜잭션으로 처리한다.
- `study_session_reflections`와 `study_forest_preferences`는 사용자 소유 RLS와 최소 테이블 권한을 사용한다.
- 적응형 알림 트리거는 최근 28일의 날짜별 첫 완료 세션 시작 시각 중앙값을 15분 단위로 보정하며 최소 3일 표본을 요구한다.

### Mobile Policy

- Expo 앱도 웹과 동일하게 하나 이상의 사용자 소유 미완료 당일 할 일을 선택해야 세션을 시작할 수 있다.
- 비동기 인증, 조회, 저장, 세션 RPC는 사용자에게 오류를 표시하고 `finally`에서 busy/loading 상태를 해제한다.
- 모든 화면 상태는 밝은 캔버스와 `dark-content` StatusBar를 사용한다.

### Bundle Strategy

- Three.js, Supabase SDK, MediaPipe, React 런타임을 수동 청크로 분리한다.
- 숲, 회고, 주간 리뷰, 적응형 알림 컴포넌트는 `React.lazy`로 필요할 때만 로드한다.
- Three.js는 패키지 배포 단위 자체가 약 520 kB인 지연 청크이므로 경고 한도를 550 kB로 두고, 메인 앱 청크는 약 152 kB로 유지한다.

### Testing and Deployment

- helper 단위 테스트, UI 소스 계약 테스트, SQL 마이그레이션 계약 테스트, 모바일 typecheck, 전체 테스트, Vite production build를 배포 게이트로 사용한다.
- 스키마 변경은 Supabase MCP로 적용하고 RLS, 정책 수, 역할 권한, 함수 실행 권한, advisors를 확인한다.

## Supabase 변경 이력

### 2026-07-16

- 변경 대상: `public.extend_study_session_lease(uuid, integer)`, `attendance-cron`, `slack-recovery-interactions`
- 변경 내용: 60분 연장 후의 마감 시각을 `least(기존 마감 + 60분, now() + 2시간)`으로 제한하고 `public/anon` 함수 실행 권한을 회수했다. 웹 fallback과 Slack 안내 문구도 같은 정책으로 맞췄다.
- 변경 이유: 잔여 1시간 30분 상태에서 연장 시 2시간 30분이 되던 문제를 막고, 익명 역할이 SECURITY DEFINER RPC를 호출할 수 있던 권한을 차단하기 위해서다.
- 관련 기능: 웹 `세션 유지`, Slack 세션 만료 경고/유지 버튼
- 마이그레이션 파일: `supabase/migrations/20260716132227_cap_session_lease_remaining_time.sql`
- 확인 방법: 원격 migration `20260716132549_cap_session_lease_remaining_time`, 함수 정의의 2시간 `least` 상한, anon=false/authenticated=true/service_role=true, 90분 잔여 예시=7,200초를 확인했다. `attendance-cron` v27과 `slack-recovery-interactions` v8은 ACTIVE다.
- 주의 사항: authenticated SECURITY DEFINER advisor 경고는 앱 사용자가 자신의 세션을 연장해야 하므로 의도된 공개 범위다. 함수 내부 소유권 검사와 입력 60분 제한을 유지해야 한다.

## Study Forest Surface Model and Camera Start Lifecycle (2026-07-17)

### Architecture

- `studyForest.mjs`는 정규화 좌표 기준의 물/다리 충돌, 다리 경유 경로, 지형 높이를 함께 소유한다.
- `StudyForest3D.tsx`는 같은 helper 결과를 월드 좌표의 Y 값으로 사용하고 animation loop에서 X/Z와 별도로 높이를 보간한다.
- 다리 mesh는 강 흐름에 직교하도록 Y축 90도 회전을 사용하며, 충돌 corridor는 회전된 데크의 실제 폭에 맞춘다.
- 실내 출구는 `isCottageExitPosition()` 포털과 `cottage-exit-door`, `cottage-exit-threshold`, `cottage-exit-marker` 오브젝트를 같은 아래쪽 출구 영역에 둔다.
- 커스터마이징 데이터는 기존 Supabase preference enum을 유지하고 presentation 전용 `symbol`만 클라이언트 catalog에서 파생한다.
- `cameraStart.mjs`는 `getUserMedia` 시작 제한과 늦은 MediaStream 정리를 담당한다. React는 증가하는 attempt ref로 세션 종료/중지 이후의 stale 비동기 결과를 거절한다.

### Design Patterns

- 지형 높이와 충돌은 Three.js mesh를 역으로 검사하지 않고 같은 결정적 좌표 모델에서 계산한다.
- 잠긴 꾸미기 항목의 실제 심볼과 이름은 렌더링하지 않고 `?`와 해금 조건만 표시한다.
- 카메라 중지는 stream/detector 자원 정리와 함께 attempt를 무효화해야 한다.
- 활성 세션이 없는 카메라 클릭은 disabled 무반응 대신 조건 안내로 처리한다.

### Testing Strategy

- helper 테스트로 다리 가장자리/중앙/잔디의 높이 차이와 실제 다리 corridor의 통과 여부를 검증한다.
- UI 소스 계약 테스트로 출구 오브젝트 이름, 다리 90도 회전, Y 보간, 아이템 그리드와 잠금 `?`를 고정한다.
- 카메라 helper 테스트는 성공 시 timer 해제, timeout rejection, timeout 후 늦은 stream track 정지를 검증한다.
- 전체 `npm test`, TypeScript를 포함한 `npm run build`, 로컬 Playwright의 content/overlay/mobile overflow 검증을 배포 전 게이트로 사용한다.

### Deployment Strategy

- 이번 변경은 클라이언트와 문서/테스트 전용이며 Supabase 스키마, RLS, RPC, Edge Function 변경이 없다.
- 사용자의 명시적 요청 전에는 커밋, 푸시, Vercel 배포를 수행하지 않는다.

## Weekly Review Time Presentation (2026-07-17)

### Architecture

- `weeklyReview.mjs` owns both weekly calculations and pure study-duration presentation helpers so React only composes labels.
- `formatStudyDuration()` rounds the completed-session aggregate to the nearest minute and renders hours plus minutes.
- `formatStudyDurationChange()` preserves the comparison sign but renders large differences as hours plus minutes; a zero difference uses an explicit equality message.
- `WeeklyReviewSection.tsx` labels the value as a completed-session total, includes the completed-session count, and shows the current as-of date alongside the full Monday-to-Sunday range.

### Data and Deployment

- The weekly aggregate continues to use completed `study_sessions.duration_seconds` rows in the selected `local_date` range.
- Historical rows are not capped, rewritten, or deleted by the presentation layer.
- Verification uses a read-only Supabase aggregate query. There is no schema, RLS, RPC, or Edge Function change.
- Commit, push, and deployment require an explicit user request.

## Study Period Summary and Client Reliability (2026-07-19)

### Architecture

- `get_study_period_summary(date, date)` is the canonical authenticated source for completed study totals. It converts the requested local-date range through the user's profile time zone and proportionally allocates counted duration for sessions that cross the range boundary.
- `daily_completed_study_seconds(uuid, date)` uses the same allocation model, and `end_study_session` evaluates every local date touched by a cross-midnight session for attendance promotion.
- `dashboardData.ts` owns explicit query errors and pagination. Core dashboard data loads eagerly, while reflections and notification delivery diagnostics load only on their routes.
- `weeklyReview.mjs` compares Monday-to-today with the previous Monday-to-the-same-weekday and accepts canonical server summaries.
- `AccessibleDialog.tsx` centralizes dialog focus trapping, initial focus, Escape close, body scroll lock, and focus restoration.
- Expo mobile uses `complete_study_session` for atomic reflection/todo completion and `extend_study_session_lease` for the server-capped lease policy.

### Security Notes

- Internal attendance, reminder, delivery cleanup, and auth trigger helpers revoke `EXECUTE` from `public`, `anon`, and `authenticated`; only `service_role` retains direct execution.
- User-facing summary and session functions require `authenticated`, validate `(select auth.uid())`, and use `set search_path = ''`.
- Long historical sessions are not rewritten. The summary reports 12-hour-plus and cross-date counts for transparent review.

### Testing and Deployment

- Contract tests cover comparable week ranges, server summary overrides, anomaly metadata, RPC privilege SQL, web/mobile wiring, and route-scoped data loading.
- Required gates are the full Node test suite, Vite production build, Expo TypeScript check, remote migration list, role privilege matrix, and Supabase security/performance Advisors.
- Commit, push, and Vercel deployment still require an explicit user request.

### Supabase 변경 이력

#### 2026-07-19

- 변경 대상: `daily_completed_study_seconds`, `get_study_period_summary`, `end_study_session`, 내부 cron/trigger helper RPC 실행 권한
- 변경 내용: 사용자 시간대 기반 기간 집계와 자정 경과 분할을 추가하고, 장기/자정 경과 세션 건수를 함께 반환하며, 내부 함수의 익명·인증 사용자 직접 실행 권한을 회수했다.
- 변경 이유: 주간·오늘 합계의 날짜 왜곡과 기본 PUBLIC 함수 실행 권한 노출을 제거하기 위해서다.
- 관련 기능: 웹 오늘/월간/주간 통계, Expo 오늘 통계, 자정 경과 출석 승격, 주간 데이터 품질 안내
- 마이그레이션 파일: `supabase/migrations/20260719045940_secure_rpc_and_study_period_summary.sql`
- 확인 방법: 원격 migration `20260719052739`, 인증 컨텍스트 RPC 실행, anon/authenticated/service 역할 권한 행렬, Supabase Advisors
- 주의 사항: 사용자용 SECURITY DEFINER 함수는 `auth.uid()` 검사와 고정 `search_path`를 유지해야 한다. 공유 프로젝트의 다른 테이블 Advisor 경고는 별도 범위로 다룬다.

## Todo Time Picker Interaction (2026-07-19)

### Architecture

- `timeInputPicker.mjs` owns the guarded native picker invocation and activation-key predicate.
- The todo modal keeps semantic `input[type="time"]` controls and calls the helper from click, double-click, Enter, and Space events.
- Unsupported or blocked `showPicker()` calls fall back to focus/direct editing instead of replacing the native control with a custom dropdown.

### Accessibility and Styling

- Start and end fields have explicit Korean `aria-label` and interaction title text.
- Pointer hover and `focus-visible` states communicate that the whole field is interactive.
- Disabled fields never focus or open the picker.

### Testing and Deployment

- Unit tests cover successful picker opening, unsupported/blocked fallback, disabled behavior, and activation keys.
- Source contract tests require both fields to expose click, double-click, keyboard, labels, and pointer styling.
- No Supabase or environment change is required; full tests and production build remain the release gates.

## Study Session Manual Breaks (2026-07-19)

### Architecture

- `study_sessions.paused_at`은 진행 중인 명시적 휴식의 시작 시각, `paused_seconds`는 완료된 휴식 구간의 누적 초를 저장한다.
- 휴식 중에도 세션은 `status = 'active'`를 유지해 기존 사용자별 active 세션 제약과 조회 경로를 그대로 사용한다.
- `pause_study_session(uuid)`와 `resume_study_session(uuid)`는 인증 사용자의 본인 active 세션만 원자적으로 변경하는 idempotent RPC다.
- `end_study_session(uuid, integer)`은 카메라 제외 시간과 서버에 누적된 수동 휴식 시간을 각각 한 번만 차감하고 진행 중 휴식도 종료 시 확정한다.
- 웹은 휴식 시 카메라 감시를 정리하고 재개 전 카메라를 다시 시작한다. Expo는 카메라 기능 없이 같은 RPC와 버튼 상태 모델을 사용한다.
- 휴식 중에는 브라우저 inactivity와 페이지 이탈 자동 종료를 건너뛰지만 `lease_expires_at`은 계속 감소하고 복귀 시 만료 세션을 정리한다.

### Security Notes

- pause/resume 함수는 `security invoker`, 빈 `search_path`, `auth.uid()` 소유권 검사와 RLS를 함께 사용한다.
- `public`과 `anon`의 실행 권한을 회수하고 `authenticated`와 `service_role`에만 필요한 실행 권한을 부여한다.
- 원격 Supabase migration은 사용자의 명시적 승인 후 프로젝트 `bqohkdzvxbrokkmuhysx`에 적용했다.

### Testing Strategy

- 순수 helper 테스트로 유효한 pause 상태, 현재 휴식 초, 누적+진행 중 휴식 합계를 검증한다.
- SQL 계약 테스트로 컬럼, 제약, RPC, 종료 시간 차감, 역할별 grant/revoke를 고정한다.
- 소스 회귀 테스트로 휴식 중 페이지 새로고침이 종료 RPC를 전송하지 않는 조건을 고정한다.
- 전체 Node 테스트, 웹 production build, Expo TypeScript 검사를 릴리즈 게이트로 사용한다.

### Supabase 변경 이력

#### 2026-07-19

- 변경 대상: `public.study_sessions`, `pause_study_session`, `resume_study_session`, `end_study_session`
- 변경 내용: 수동 휴식 시작 시각과 누적 초, 소유자 전용 휴식/재개 RPC, 종료 시 휴식 제외 계산을 추가했다.
- 변경 이유: 식사·외출 시간을 공부 시간에 포함하지 않고 같은 세션으로 복귀할 수 있게 하기 위해서다.
- 관련 기능: 웹·Expo `잠시 쉬기`, `공부 계속하기`, 휴식 경과 표시, 최종 공부 시간
- 마이그레이션 파일: `supabase/migrations/20260719134726_add_study_session_breaks.sql`
- 확인 방법: 전체 Node 테스트 279개, 웹 build, Expo typecheck 통과. 원격 migration `20260719140751`, 컬럼·제약, invalid rows 0건, pause/resume anon=false·authenticated=true·service_role=true, end anon=false·authenticated=true, SECURITY INVOKER와 빈 search_path를 확인했다. security/performance Advisors도 확인했다.
- 주의 사항: 원격 DB 적용은 완료됐지만 클라이언트 코드는 아직 배포되지 않았다. 휴식 중에도 세션 lease는 계속 감소한다.

## Daily Habit Loop (2026-07-20)

### Architecture

- `apps/web/src/dailyHabit.mjs` owns deterministic daily habit stage calculation, duration copy, next-action normalization, and same-title todo matching outside React.
- The habit state is derived from today's counted study seconds, the existing weekday/weekend goal, and completed-todo count. It does not write or reinterpret `attendance_days.status`.
- `loadDashboardData()` fetches only the newest non-null `study_session_reflections.next_action`; full reflection history remains lazy-loaded for My Page.
- The Today card passes a normalized suggestion through existing recovery, camera, and session-todo gates. It never starts a session or inserts a todo without the user's confirmation.
- Cancelling a recovery or camera start prompt clears the pending suggestion so a later ordinary session cannot inherit stale intent.

### Data and Security

- No Supabase schema, RLS, RPC, Edge Function, or environment-variable change is required.
- The latest reflection read includes an explicit `user_id` filter in addition to existing authenticated, owner-scoped RLS.
- The query uses `study_session_reflections_user_created_idx (user_id, created_at desc)`, `order(created_at desc)`, `limit(1)`, and `maybeSingle()`.
- The remote plan is an Index Scan with startup cost `0.15` and total cost `1.82`.

### Accessibility and Responsive Design

- The three milestones use an ordered list, visible text, Lucide icons, and `aria-current="step"` for the active milestone.
- The warm cream, forest green, seed yellow, and terracotta accents extend the existing organic study-forest visual language.
- At `860px` the card and next-action row become single-column; at `720px` the three milestones become single-column.

### Testing and Deployment

- Pure helper tests cover `0`, `10 minutes`, full goal, goal plus completed todo, duration rounding, and normalized todo matching.
- Source-contract tests cover Today wiring, one-row reflection filtering, responsive selectors, and recovery-cancel cleanup.
- Full Node tests `283/283`, TypeScript/Vite production build, `git diff --check`, remote RLS/index verification, and Chrome rendering at `1440px` and `390px` are required before handoff.
- No commit, push, or Vercel deployment occurs without an explicit user request.

## Weekly Habit Rhythm (2026-07-20)

### Architecture

- `apps/web/src/weeklyHabit.mjs` owns rolling civil-date generation, timezone boundary conversion, completed-session allocation, streak calculation, stage labels, and coaching copy outside React.
- The rolling range always contains seven local dates ending on `todayDateKey`; it is intentionally separate from the Monday-to-today comparison on My Page.
- Each date reuses `getDailyAttendanceGoalSeconds()` and `getDailyHabitState()` so weekday/weekend targets and `ready·seed·tree·bloom` semantics cannot drift.
- `main.tsx` recalculates the live rhythm only when the visible Today minute changes. This preserves exact minute milestones without scanning full history every second.

### Data Conventions

- Past completed sessions use the same server formula: `overlap_seconds * least(1, counted_seconds / elapsed_seconds)`, summed and rounded per local date.
- Timezone midnight boundaries are derived with `Intl.DateTimeFormat`; an invalid client timezone falls back to UTC instead of rendering corrupt dates.
- Today's derived total is overwritten with the existing canonical Today completed summary plus current active-session seconds.
- Completed todos are grouped by their stored `local_date`; no new table, RPC, query, RLS policy, environment variable, or background job is introduced.
- When today has not reached ten minutes, the displayed streak scans backward from yesterday. Once today succeeds, it includes today.

### Accessibility and Responsive Design

- The seven dates are an ordered list. Every item exposes date, weekday, stage, and study duration as text and an accessible label; color and icon are secondary cues.
- The organic trail uses connected circular markers on desktop, then removes the line and switches to a two-column readable grid below `720px`.
- The summary changes from three columns to one column on mobile, and coaching copy wraps without truncation.

### Testing and Deployment

- Helper tests cover year/month rollover, Seoul cross-midnight proportional allocation, a 23-hour DST date, duration capping, canonical Today override, weekend goals, bloom, and the today-in-progress streak rule.
- Source-contract tests require accessible labels and the `7→2` path and `3→1` summary responsive selectors.
- Release gates are all 289 Node tests, TypeScript/Vite production build, `git diff --check`, and Chrome rendering at `1440px` and `390px` with content-level overflow checks.
- No Supabase migration or remote mutation is required. Commit, push, and deployment still require an explicit user request.

## Flexible Weekly Start Goal (2026-07-20)

### Architecture

- `weeklyHabit.mjs` owns `WEEKLY_HABIT_TARGET_DAYS = 5`, `WEEKLY_HABIT_REST_ALLOWANCE_DAYS = 2`, target-state calculation, non-punitive coaching, and the current-day primary action label outside React.
- Target credit is clamped to five for the progress UI, while the weekly rhythm still retains and displays all seven day records and the actual start-success count.
- `main.tsx` renders the target as a forest wooden sign above the path. Five seed markers expose `progressbar` min, max, current, and value text so progress is not color-only.

### Action Routing

- Before ten minutes, the weekly context label is `10분 시작 준비`; after ten minutes and before the daily goal it is `오늘 목표 이어가기`; `getStudyStartAction()` applies that context to the one inactive-session topbar button after reflection priority.
- While a study session is active or paused, start-only daily and weekly guidance is hidden and the topbar becomes `잠시 쉬기` or `공부 계속하기`.
- The single topbar action passes the newest normalized reflection `next_action`, falling back to the first incomplete today todo title, into the existing `startTimer()` path.
- Recovery submission, camera readiness, todo selection, quick-add confirmation, and the server session-start RPC remain authoritative; the target card stays non-interactive and never bypasses or duplicates those gates.

### Data, Security, and Performance

- The target is derived from the existing `weeklyHabitRhythm` and in-memory today todo list. It adds no Supabase query, table, column, RLS policy, RPC, Edge Function, environment variable, or background job.
- The five-of-seven target does not change `attendance_days.status`, the ten-minute habit threshold, or weekday/weekend two/four-hour study goals.
- Target helpers are deterministic and typed through `weeklyHabit.d.mts` so a future user preference can replace constants without rewriting UI logic.

### Responsive and Visual Design

- The visual direction stays organic and toy-like: a warm wooden sign, cream paper surface, forest green completion state, an upward information cue, and five circular seed tokens.
- Desktop uses copy and seed progress columns. Below `720px`, the sign becomes one column, the information cue wraps safely, and all five seeds remain visible without horizontal scrolling.

### Testing and Deployment

- Unit coverage fixes 0, 4, 5, and 7 start boundaries, completed-target rest coaching, and primary-action labels.
- Source contracts cover `progressbar` semantics, single-topbar routing, active/paused start-guidance hiding, and the mobile one-column selector.
- Release gates include focused weekly and single-start tests, all 314 Node tests, TypeScript/Vite production build, `git diff --check`, and actual Chrome rendering at `1440px` and `390px` with content-level overflow measurements.
- No commit, push, Supabase mutation, or Vercel deployment occurs without an explicit user request.

## Weekly Forest Reward (2026-07-20)

### Architecture

- `weeklyHabit.mjs` owns persistent reward derivation because it already owns the ten-minute success threshold, target count, time-zone boundaries, and proportional completed-session allocation rules.
- `getWeeklyHabitRewardHistory()` walks each valid completed session only across the local dates it overlaps, marks dates with at least ten counted minutes, and awards on the fifth successful date inside a trailing seven-day window.
- After an award, the next eligible earned date is seven days later. This prevents a continuous streak from generating one reward for every overlapping trailing window while still allowing a new weekly reward.
- The returned history contains deterministic IDs, earned dates, source window dates, successful date keys, the latest earned date, and the cumulative count.

### UI and Three.js Integration

- `main.tsx` passes the existing live `weeklyHabitRhythm.target`, full already-loaded session array, and profile time zone into the lazy Study Forest section.
- `StudyForestSection.tsx` computes reward history only while the forest feature is mounted, renders an accessible five-seed progressbar, explains remaining starts, and shows the cumulative wreath count.
- `StudyForest3D.tsx` builds five low-poly seed pods around the current tree. Credited starts add stems and leaves; target completion adds an emissive five-firefly halo; any earned history adds a permanent golden flower keepsake.
- The reward group uses world anchor `(3.15, 0.5, -1.2)`, which maps to the existing normalized current-tree collider around `(75, 55)`. No new walkable obstruction or collider rule is introduced.
- Halo rotation and bobbing run only when `prefers-reduced-motion` is false. Static seed and keepsake geometry remain visible in reduced-motion mode.

### Data, Security, and Performance

- No additional Supabase request is made. The forest receives the `study_sessions` array already paged into dashboard memory under user-scoped RLS.
- Only `status = completed` rows with valid start/end times and positive counted duration participate. Active sessions can affect live 5/7 progress but cannot mint a permanent reward before completion.
- Invalid or more-than-ten-year single-session spans are ignored as malformed input to prevent an unbounded client loop.
- No table, migration, policy, RPC, Edge Function, preference write, environment variable, or Expo change is required.

### Testing and Deployment

- Unit tests cover two rewards across twelve continuous starts, seven-day duplicate spacing, and preservation of an old reward when the current rolling target is zero.
- Source tests require main-to-forest target wiring, reward-history use, accessible progress semantics, Three.js seed/halo/keepsake builders, reduced-motion gating, and five-column mobile seed layout.
- Release gates are all 294 Node tests, TypeScript/Vite production build, `git diff --check`, and actual Chrome at 1440px and 390px with WebGL ready, one canvas, `2→1` forest grid columns, and document/card/seeds/scene overflow measurements.
- No commit, push, Supabase mutation, or Vercel deployment occurs without an explicit user request.

## First Ten-Minute Checkpoint (2026-07-21)

### Architecture

- `dailyHabit.mjs` reuses `DAILY_HABIT_SEED_SECONDS` and owns deterministic checkpoint eligibility, threshold crossing, progress, remaining time, and acknowledgement storage helpers outside React.
- `main.tsx` supplies the canonical completed-today total and existing lease-aware active-today total. The active total already excludes persisted/current breaks, camera absence, and lease overflow.
- `TenMinuteCheckpoint.tsx` owns the progress and completion presentations so the state can be verified independently without duplicating Today business logic.
- The component is mounted only for an active session. A prior completed total at or above ten minutes makes the checkpoint ineligible for later sessions that day.

### Interaction and Persistence

- Before ten minutes, the card exposes a `0..600` progressbar, rounded remaining-time copy, and a paused explanation when the active session is resting.
- On the first active-session threshold crossing, `조금 더 이어가기` stores an acknowledgement and leaves the session running unchanged.
- `오늘은 마무리` opens the existing end-session todo/reflection modal; cancelling that modal does not acknowledge or discard the checkpoint.
- The acknowledgement key is scoped to user ID, session ID, and local date. Only the literal acknowledgement marker is stored; session data, tokens, study seconds, and todo data are not copied to localStorage.
- localStorage read/write failures degrade to the current in-memory state and never affect the study session.

### Data, Security, and Performance

- No Supabase query, table, column, migration, RLS policy, RPC, Edge Function, environment variable, timer interval, or Expo change is introduced.
- The existing one-second Today clock drives rendering; checkpoint calculation is constant-time and adds no history scan.
- Ten-minute habit success remains separate from weekday two-hour/weekend four-hour `present` policy.

### Accessibility, Responsive Design, and Testing

- Visible copy, progressbar values, polite completion announcement, and two named buttons make state and choices available without relying on color.
- The visual language uses the existing cream paper, forest green, seed yellow, and hand-shaped organic borders; reduced motion removes progress-width animation.
- Desktop keeps the two choices inline. At `720px` the card metadata and actions become one column and fill the available width.
- Release gates are six focused tests, all 300 Node tests, TypeScript/Vite production build, `git diff --check`, and actual Chrome at 1440px/390px with interaction, responsive, content-overflow, console, and page-error checks.
- No commit, push, Supabase mutation, or Vercel deployment occurs without an explicit user request.

## Weekly Reset Bridge (2026-07-21)

### Architecture

- `weeklyReview.mjs` owns deterministic normalization, incomplete-todo matching, planned/unplanned status, and safe `MM.DD` labels outside React.
- `WeeklyReviewSection.tsx` converts up to three already-derived reflection actions into an accessible action list without changing weekly metric calculation.
- `main.tsx` routes an unplanned action to the existing todo modal after resetting it for today and prefilling the normalized title.
- A matching incomplete todo routes to the existing `startTodoEditing()` flow; stale IDs surface a user message instead of creating a duplicate.

### Data, Security, and Performance

- Matching compares normalized titles case-insensitively and ignores completed todos. An invalid stored date keeps planned status but omits its date label.
- Opening either action performs no write. Only the existing authenticated `saveTodo()` or update flow can mutate `study_todos` under its current RLS policy.
- The feature scans at most three actions against the already-loaded in-memory todo array and adds no query, table, column, migration, RPC, RLS, Edge Function, environment variable, timer, or Expo change.

### Accessibility and Responsive Design

- Each row includes visible action text and planned/unplanned copy; color and icon are secondary cues.
- Buttons include the action title in their accessible name and use the existing keyboard-accessible todo modal.
- The organic paper-and-seed design extends the existing cream, forest, yellow, and terracotta visual language. At `620px`, the action and button become a full-width two-row layout without horizontal scrolling.

### Testing and Deployment

- TDD starts with a missing helper export, then covers normalization, completed-todo exclusion, invalid dates, and source wiring.
- Release gates are three focused tests, all 309 Node tests, TypeScript/Vite production build, `git diff --check`, and actual Chrome at `1440px` and `390px` with create/edit prefill, plan date, responsive columns, content bounds, console, and page-error checks.
- No Supabase mutation, commit, push, or Vercel deployment occurs without an explicit user request.

## Single Adaptive Study Start Action (2026-07-21)

### Architecture

- `dailyHabit.mjs` owns `getStudyStartAction()`, which normalizes and prioritizes the latest reflection action, weekly habit action label, and first incomplete today todo outside React.
- The helper returns one visible label, one optional suggested todo title, and a diagnostic source of `reflection`, `weekly-goal`, `today-todo`, or `default`.
- `main.tsx` keeps the existing topbar session control as the only persistent Today start surface. Its inactive branch passes the derived suggestion into the existing `startTimer()` path.
- Active and paused branches remain `잠시 쉬기` and `공부 계속하기`; End and reminder-dialog actions are outside this consolidation.

### Interaction Rules

- A normalized reflection next action has first priority, labels the button `이어서 준비하기`, and becomes the todo suggestion.
- Without reflection, the weekly helper label (`10분 시작 준비`, `10분으로 다시 잇기`, or `오늘 목표 이어가기`) controls the button while the first incomplete today todo remains the suggestion.
- Without a weekly label, the stable `입장하고 시작` label remains; a first incomplete today todo may still be suggested.
- Daily reflection and weekly target cards are non-interactive context only while no session is active. They point upward to the single start control when inactive, then disappear during active or paused sessions instead of pointing at Pause or Resume.
- Recovery, camera, todo selection, quick add, stale-suggestion cleanup, and server start transactions are unchanged.

### Data, Security, and Performance

- Derivation is constant-time and uses values already held by Today. No request, table, migration, RLS policy, RPC, Edge Function, environment variable, timer, localStorage key, or Expo change is introduced.
- The helper never creates a todo or starts a session; the existing explicit user click and authenticated flow remain authoritative.

### Accessibility, Responsive Design, and Testing

- One active button exposes the single accessible action name; supporting cards use readable copy and decorative upward cues rather than disabled controls.
- Desktop keeps the wooden weekly sign in three readable columns. Below `720px`, it becomes one column and the note left-aligns without creating another hit target.
- Release gates are focused priority/source tests, existing daily/weekly habit regressions, the full Node suite, TypeScript/Vite build, `git diff --check`, and actual Chrome at 1440px/390px for one-button count, suggestion routing, content bounds, console, and page errors.
- No commit, push, Supabase mutation, or Vercel deployment occurs without an explicit user request.

## Gentle Restart Cue (2026-07-21)

### Architecture

- `weeklyHabit.mjs` derives `isGentleRestart` from the fixed seven-day rhythm outside React: today and yesterday are below ten minutes, at least one earlier day succeeded, and the five-start target is not yet reached.
- The same helper selects `다시 잇는 날` coaching and `10분으로 다시 잇기`; `main.tsx` only renders the returned state in the existing target sign and single topbar start flow.
- The weekly sign remains informational. No new click handler, modal, button, session transition, or state store is introduced.

### Interaction Rules

- No prior success keeps the first-start guidance; yesterday's success keeps streak guidance; today's success moves to the existing next stage; a reached five-start target keeps optional-rest guidance.
- A latest reflection next action still outranks the restart label in `getStudyStartAction()` and carries its todo suggestion into the existing preparation flow.
- Active and paused sessions keep Pause and Resume. Restart copy never starts or resumes a session automatically.

### Data, Security, and Performance

- Calculation reuses the existing seven-element in-memory day array and is O(7).
- No Supabase query, table, migration, RLS policy, RPC, Edge Function, environment variable, timer, localStorage key, or Expo change is introduced.

### Accessibility, Responsive Design, and Testing

- The target sign exposes visible `다시 잇는 날` text rather than relying on the green state alone; the label is supporting context, not another focus target.
- The existing wooden sign changes from three columns to one below `720px`, so the compact restart badge remains within the same responsive contract.
- Release gates are focused restart and single-action tests, the full Node suite, TypeScript/Vite production build, `git diff --check`, and actual Chromium at 1440px/390px for restart/non-restart states, one start action, content bounds, console, and page errors.
- No commit, push, Supabase mutation, or Vercel deployment occurs without an explicit user request.

## Reflection Inbox (2026-07-21)

### Architecture

- `reflectionInbox.mjs` owns deterministic candidate selection outside React: the seven local dates ending today, completed rows only, existing reflection exclusion, newest ending first, and a maximum of three.
- `main.tsx` loads reflection history only on My Page, marks it loaded only after a successful response, and derives the inbox from already-loaded study sessions and reflections.
- `ReflectionInboxCard.tsx` renders an accessible organic “forest postbox” list. `SessionReflectionModal.tsx` shares the same fields through `completion` and `follow-up` modes while keeping todo completion exclusive to the completion mode.
- Follow-up saving uses a session-keyed PostgREST upsert, updates the in-memory reflection list, and promotes a non-empty next action to the existing Today and weekly reset flows.

### Data, Security, and Performance

- No new table, column, read request, RPC, Edge Function, environment variable, timer, localStorage key, or Expo change is introduced.
- The browser writes `user_id`, selected completed `session_id`, bounded scores/text, and `updated_at`; Postgres remains authoritative for uniqueness, constraints, and RLS.
- `20260720182136_add_reflection_inbox.sql` replaces reflection policies with `TO authenticated` policies that require reflection-row ownership and an owned linked session. INSERT and UPDATE additionally require `study_sessions.status = 'completed'`.
- UPDATE has both `USING` and `WITH CHECK`; SELECT is retained because Postgres RLS requires it for update/upsert. Public and anon keep no table privileges; authenticated is reset to SELECT·INSERT·UPDATE.
- The existing `complete_study_session(...)` SECURITY DEFINER RPC still validates the active session owner and remains unchanged.

### Accessibility and Responsive Design

- The inbox is a named section with a list; each action's accessible name includes the session date and readable duration.
- The forest-postbox visual uses the existing cream, forest green, seed yellow, terracotta, irregular borders, and fixed hit targets without moving-button animation.
- Below 620px, each letter becomes a two-column summary with a full-width 44px action; the follow-up modal stays inside the viewport and scrolls vertically.

### Testing and Deployment

- Focused tests cover selection boundaries and source wiring; all 321 Node tests and the TypeScript/Vite production build pass.
- Actual Chromium verifies candidate display, follow-up save, immediate inbox/weekly/Today updates, desktop behavior, and 390×844 responsive bounds.
- The remote migration and Vercel deployment are intentionally deferred until the user explicitly requests deployment.

## Supabase 변경 이력

### 2026-07-22

- 변경 대상: `public.attendance_days`, `public.get_due_reminders(timestamptz)`, `public.mark_missed_attendance(timestamptz)`, `attendance-cron`
- 변경 내용: 초기·재촉 알림 claim 열을 추가하고, 이미 `present`인 날에도 설정 시각 초기 알림을 1회 반환하는 `attendance_already_present` 계약을 추가했다. 재촉과 결석은 `pending`에만 적용하며 Edge Function은 출석 완료 전용 문구를 사용한다.
- 변경 이유: 오늘 목표를 이미 달성해 출석 보정된 사용자가 설정한 20:30 알림을 받지 못한 문제를 해결하고 출석 판정과 알림 시간 약속을 분리하기 위해서다.
- 관련 기능: Supabase Cron 출석 알림, Slack/Web Push/Expo/Email, 출석·결석 자동 처리
- 마이그레이션 파일: `supabase/migrations/20260722133736_send_initial_reminder_when_present.sql`
- 원격 적용: `20260722133736_send_initial_reminder_when_present`, `attendance-cron` v28
- 확인 방법: 원격 rollback 시나리오에서 출석 완료 초기 1·중복 0·재촉 0·결석 0·최종 present, 미출석 초기 1·재촉 1·결석 1을 확인했다. 전체 331개 테스트, production build, Cron v28 200 응답, 권한 행렬을 확인했다.
- 주의 사항: claim 시각은 발송 시도를 나타내며 실제 채널 성공은 `notification_deliveries`로 확인한다. `get_due_reminders`와 `mark_missed_attendance`는 `service_role`만 실행할 수 있고 고정 빈 `search_path`를 유지한다.

### 2026-07-21

- 변경 대상: `public.study_session_reflections` RLS와 테이블 권한
- 변경 내용: 로컬 migration에서 SELECT·INSERT·UPDATE 정책에 linked session ownership을 추가하고 INSERT·UPDATE는 completed session만 허용한다.
- 변경 이유: follow-up upsert가 다른 사용자의 session ID 또는 미완료 session에 연결되는 BOLA/IDOR 경로를 차단한다.
- 관련 기능: My Page 회고 인박스
- 마이그레이션 파일: `supabase/migrations/20260720182136_add_reflection_inbox.sql`
- 확인 방법: source contract, 현재 원격 정책 read-only 조회, 전체 테스트·build, 명시적 배포 후 원격 `pg_policies`·grants·Advisors 재확인
- 주의 사항: migration은 아직 원격 프로젝트에 적용하지 않았다. 웹 배포보다 먼저 적용해야 한다.

## Weekly Friction Plan (2026-07-21)

### Architecture

- `weeklyReview.mjs` owns the deterministic interruption aggregation and reason-specific copy outside React.
- `buildRangeMetrics()` first filters reflections through completed session IDs in the requested range, then derives `frictionPlan` from that range only.
- `buildWeeklyFrictionPlan()` scans the reflection array once, ignores `none` and unknown values, and requires a count of at least two.
- Candidate selection sorts by count descending, latest valid `created_at` descending, then the fixed order `phone → environment → fatigue → schedule → other`.
- `WeeklyReviewSection.tsx` renders the current plan independently from the anomaly/cross-date data-quality note and before the existing next-action plan.

### Data, Security, and Performance

- The feature reuses `studySessionReflections` and `studySessions` already loaded for My Page. It adds no network request or server write.
- No Supabase table, column, migration, RLS policy, RPC, Edge Function, environment variable, timer, localStorage key, or Expo change is required.
- Invalid reasons are ignored and invalid timestamps fall back to the stable reason order rather than breaking rendering.
- Runtime work is linear in the already-filtered current-week reflection count with a constant five-reason sort.

### Accessibility and Visual Design

- The plan exposes reason, weekly count, title, concrete action, and cue as visible text; color and icon are secondary.
- The component is an `aside` labelled by a heading and contains no button, preserving the single adaptive start surface.
- The organic design uses a forest-green trail sign, warm paper, seed-yellow shield accent, directional desktop clip-path, and a calm non-punitive tone.
- Desktop uses two columns. At `620px` the sign and note become one column and remove the directional clip-path.

### Testing and Deployment

- TDD covers helper absence, repeated and one-off reasons, invalid values, tie-breaking, current-range filtering, independent conditions, no new button, and non-nested mobile CSS.
- Release evidence is five focused tests, all 326 Node tests, production build, `git diff --check`, and actual Chromium at 1440px/390px with computed columns, bounds, overflow, console, and page-error checks.
- All browser Supabase requests are stubbed. No remote mutation, commit, push, or deployment occurs without an explicit user request.

## Session Lease Expiry Enforcement (2026-08-04)

- `study_sessions.lease_expires_at` is the server-owned upper bound for each persistence operation. User-facing manual completion remains authenticated and ownership-checked; reflection completion delegates to the same guarded end RPC.
- `close_expired_study_sessions(p_now)` is service-role-only and runs in the existing every-minute `attendance-cron` Edge Function before reminder work. It selects no more than 100 eligible active rows ordered by expiry and uses `FOR UPDATE SKIP LOCKED` to avoid duplicate cleanup under concurrent invocations.
- `study_sessions_active_lease_expiry_idx` is a partial index over active sessions with a lease, keeping the frequent expiry lookup narrow.
- Both manual and automatic end paths calculate at the effective end timestamp, accumulate an in-progress break only up to that timestamp, then promote attendance only for local dates the corrected session actually overlaps.
- Rows without a lease use the original `started_at + interval '1 hour'` fallback only for backward compatibility.
## Documentation Convention

- `README.md` is the English default document.
- `README.ko.md` preserves the Korean documentation.
- `README.ja.md` provides the Japanese documentation.
- Every README starts with relative links to all three language files.
- Features, commands, environment variables, security notes, and project limitations must remain consistent with the repository.
## 2026-09-06 - Goal achievement badges

- main.tsx shares updateGoalStatus between Today and Goals. Mutations filter by goal ID and authenticated user ID, and update local state only after a successful single-row response. try/finally restores the busy state.
- GoalAchievementBadges.tsx derives My Page badges from completed study_goals via goalAchievements.mjs. No duplicate badge table, localStorage reward, or invented completion timestamp.
- dashboardData.ts loads every goal using the existing fetchAllPages utility, ordered by status/target_date/id. Goal history is no longer truncated at 100 rows.
- Supabase inspection confirmed status constraint and ownership SELECT/INSERT/UPDATE/DELETE RLS. No remote mutation or schema change was needed.

## 2026-09-06 - OpenRouter server foundation

- server/ai/openrouter.mjs is a server-only, dependency-free fetch client; no web/mobile import or public HTTP route is added. API key and exact model ID come from server environment.
- scripts/sync-openrouter-env.mjs runs only in the deployment step with the GitHub secret/key and Variables settings. Vercel CLI 48.6.0 --force/--sensitive options were verified. Missing key/model pair skips without clearing Vercel-managed values; partial pair fails before writing.
- Key values use stdin, child output is suppressed, and configuration is validated before eight sequential env writes. A failed write stops deployment; rerun after correction. Runtime env changes take effect in the next deployment.
- npm run ai:check loads optional root .env.local, prints readiness only and makes no API calls. npm test includes provider and deployment adapter mocks. See docs/openrouter-setup.md and prd-ai-integration.md.

## 2026-09-06 - Dynamic OpenRouter routing

- Server default auto sends openrouter/auto with auto-router cost_tier (default medium); fixed uses configured OPENROUTER_MODEL. No local catalog ranking or hidden fallback.
- CI synchronizes optional OPENROUTER_ROUTING_MODE and OPENROUTER_AUTO_COST_TIER; omitted token/timeout still use 1024/20000. Result model preserves provider-selected model.

## 2026-09-06 - Free restart coaching

- Supersedes earlier auto/medium routing: openrouter/free or strict :free model, provider.max_price prompt/completion/request=0, data_collection=deny. Legacy paid configuration cannot activate paid inference.
- api/study-coaching.mjs validates Supabase user then queries owned records using anon/publishable key + bearer token. 50s overall deadline, AI cap20s, DB request cap8s. Vercel filesystem routing preserves API before SPA fallback; function cap60s.
- coaching.mjs computes facts, asks for one short prospective action, validates JSON and uses deterministic fallback. HMAC seals cached content; signature serialization uses fixed fields to survive PostgreSQL JSONB ordering. Feedback is mutable separately.
- study_coaching: owner SELECT/RLS, no direct client INSERT/UPDATE/DELETE; private definer/public invoker RPC enforces advisory-locked daily3 attempts, fingerprint cache, 90s reservation lease. Untrusted direct RPC results cannot become trusted AI cache without server HMAC.
- Migration 20260906064942_study_restart_coaching applied via Supabase MCP; real DB transactional tests for pending/cache/feedback/quota/ownership rolled back, rows remaining0. Security advisors reported no new coaching object issues; pre-existing unrelated Book/Review and legacy function findings remain out of scope.
- Frontend StudyRestartCoach uses explicit request, cancel/request identity and user key, safe response parsing, editable existing todo draft and feedback. No original study record mutations from AI.

## 2026-09-06 — Career coach v2 architecture

- PRD: prd-studyroom-v2.md; interface contract: studyroom-v2-contract.md; runtime setup: ../docs/studyroom-v2-setup.md.
- React UI calls four Supabase Edge functions. Browser credentials never read OAuth secrets. Google and GitHub callbacks bind short-lived one-use state to the signed-in user; atomic completion prevents disconnect races.
- Service-role mutations run after authenticated user/pilot validation. Postgres owner RLS covers public-facing data; tokens/OAuth state/quota/pilot allowlist have no browser grants. UTC instants remain stable, date-only values remain dates, repeated windows use selected IANA zone with DST checks.
- Leased worker jobs carry input versions; final result RPCs check current lease and enabled state. Provider work has a shared 50-second deadline, requests a 12-second bound and streaming 2MiB response cap. Git analyzes one selected repository per job with at most four source files; large Google snapshots above999 events fail closed.
- Notifications have independent adapters and per-event/channel/target idempotency. Explicitly enabled and connected channels only. Ambiguous outcomes do not trigger blind resend or cross-channel fallback.
- Deploy additive migration before new functions and web; retain existing attendance cron. Production application is pending explicit remote project approval. Pilot allowlist alone never opts a user into coaching or notifications.

## Supabase 변경 이력

### 2026-09-09 - Recovery source and migration consistency

- 변경 대상: dashboard recovery query, shared recovery creation, Slack recovery submission; existing aggregate schema.
- 변경 내용: coverage fields in web/shared types and queries; pending/submitted-only stable pagination; reuse and extend pending attendance aggregate; separate camera requests; makeup todo dated in profile time zone.
- 변경 이유: prior DB/Edge changes remained outside Git main and the later Slack coach release restored the older date behavior.
- 관련 기능: cross-device recovery queue and app/Slack makeup planning.
- 마이그레이션 파일: restored exact remote SQL in `20260827144548_consolidate_pending_attendance_recovery.sql` and `20260827145316_index_consolidated_recovery_reference.sql`.
- 확인 방법: compare remote history statements with local files; test real Supabase queries through a synthetic REST transport, shared create/extend behavior, and real Slack submission with fixed time zones.
- 주의 사항: restored recovery migrations are already applied; do not run the consolidation data update again. Other historical migration version differences remain outside this release.
- The separate, user-approved unused table deletion `20260909141751_drop_unused_book_review_tables.sql` removed Book (12 rows) and Review (56 rows). Remote verification found both absent and the other 30 public tables unchanged.

### Edge reproducibility

- The attendance/camera/test-alarm functions now share the pinned Supabase SDK 2.57.4 used by the coach-compatible Slack handler.
- Use explicit SupabaseClient types instead of ReturnType over generic createClient; response helpers use explicit success/error unions.
- test:edge covers all eight Edge entrypoints, not only the coach subset, so older notification functions cannot bypass the build gate.

### 2026-09-09 - Verified deployed recovery runtime

- Changed targets: attendance-cron v33, camera-presence-warning v10, slack-recovery-interactions v15, slack-test-alarm v10.
- Deployment used the Supabase CLI API path for the four functions only. Existing verify_jwt=false values were preserved, not newly disabled.
- Authorization remains in function code: cron secret, authenticated user checks or verified Slack signatures. All four unauthenticated probes returned 401 after deployment.
- Vercel production deployment `dpl_78wFkC5ZxAHVPk5RS3WXbRnei2hh` serves commit `01d157b`; CI `34365469581` succeeded and public page/entry asset returned 200.
- Previously applied recovery migrations were not replayed. The approved Book/Review deletion migration `20260909141751` remains recorded and both unused tables are absent.

## 2026-09-10 - Report data boundary and native dependency isolation

### Architecture / API Conventions

- StudyReportSection first reads owned profiles.time_zone through the authenticated client (missing/null zone follows the existing RPC's UTC fallback). Parent profile zone is an invalidation hint, not a date authority.
- studyReports.mjs computes UTC date-key calendar boundaries from the user's saved local today. It reuses weekly metric aggregation with mandatory canonical summaries; no active/paused timer estimate enters reports.
- studyReportData.mjs queries the two selected ranges through get_study_period_summary and stable 500-row pages of owner-filtered attendance, completed sessions and todos. Reflection session IDs are batched in 100s, with owner checks and pagination. Owned incomplete todos are loaded separately for action matching.
- Requests have a 15-second deadline, identity/version guard, abort cleanup and explicit loading/error/ready states. New owner/time-zone/period/revision keys hide old data synchronously before effects.
- Main no longer fetches unused current/previous-week summaries; Today/month dashboard totals retain their existing separate implementation.
- Pure modules, typed declarations, presentational existing weekly view and a small scoped stylesheet keep the report lazy-loaded. Native date/month inputs preserve browser partial-segment editing and synchronize external period navigation.

### Tech Stack / Testing Strategy

- Expo 53.0.27 uses mobile-local React 19.0.0, a single RN 0.79.6 anchored by root devDependency, and AsyncStorage 2.1.2. Web React/DOM stay 19.2.7.
- Android/iOS-only Metro aliases keep hoisted Expo imports on native React/JSX/RN; other imports/platform resolution are unchanged. Mobile-local index.js registers App.
- mobile:check executes installed compatibility guards/Metro resolution and TypeScript; CI includes it. Android/iOS export is distinct from device/native-toolchain validation.

## 2026-09-27 — Android 집중 모드 APK 도구 및 Expo 프로젝트

- 사용자 동의에 따라 Android SDK API 35, Build Tools 35.0.0, ADB 37.0.1, NDK 27.1.12297006을 `E:\Android\Sdk`에 설치했다. 사용자 `ANDROID_HOME`은 이 SDK를, `GRADLE_USER_HOME`은 `E:\Android\Gradle`을 가리킨다. 에뮬레이터는 설치하지 않았다.
- `apps/mobile/app.json`의 `extra.eas.projectId`는 가입한 개인 계정의 실제 독서실 EAS 프로젝트 ID로 연결됐다. 이는 푸시 토큰을 프로젝트에 귀속시키는 공개 식별자이며 비밀 키가 아니다.
- 계정 연결은 FCM V1 자격 증명 설정, 앱의 방해금지 권한, 네이티브 모듈, APK 빌드/서명/설치 성공을 뜻하지 않는다. 이 단계들은 `plan-android-focus-mode.md` 순서로 따로 검증한다.
- Report tests exercise real Supabase query construction with synthetic fetch, period arithmetic, canonical validation, request races and actual React rendering. Run node scripts/serve-study-report-fixture.mjs for a local no-credentials browser fixture at 127.0.0.1:4179.

### Database / Deployment / Security Notes

- Supabase query consumers changed only; no table/policy/function/migration/environment changes or remote record writes.
- The existing authenticated RPC and RLS remain authoritative. No new secret, AI request or scheduled notification.
- npm audit findings remain documented, not automatically fixed. No forced/major dependency upgrade.
- Latest shared instructions require explicit commit/push/deploy requests; this implementation remains local.

## 2026-09-27 - 기술 피드 최신성 및 연속 읽기 (운영 적용)

### Supabase 변경 이력

- 변경 대상: `tech_feed_visible`, `tech_feed_list`, `tech_feed_filter_candidates`, `tech_feed_briefing_excerpt_allowed`.
- 변경 내용: `deep_read` 보기 추가. 소유자별 가시성은 유지하고 목록/필터 후보에서만 서버 시각 기준 최근 30일의 날짜가 확인된 글을 `latest`로 분리한다. 저장 목록은 날짜 제한이 없다. 오늘 발견 통계의 가시성 함수는 그대로 유지하고 브리핑 AI 후보만 최신 글로 제한한다.
- 변경 이유: 오래된/발행일 불명 자료가 발견 시각만으로 최신 뉴스로 보이던 문제.
- 관련 기능: 기술 피드, 오늘 브리핑.
- 마이그레이션 파일: `supabase/migrations/20260927092206_tech_feed_fresh_views.sql` (운영 적용 이력 버전에 파일명을 맞춤).
- 확인 방법: PGlite `tech-feed-briefing-db.test.mjs`의 보기·필터 후보·저장·소유권·커서 검증, 전체 Node 테스트, Edge 검사. 운영 적용 후 피드 계정 목록 RPC에서 최신 18건·깊이 읽기 177건을 확인했고 두 예시 목록 URL은 최신에서 제외됐다.
- 주의 사항: 웹/Edge는 마이그레이션 적용 뒤 전환한다. 기존 `tech_feed_visible('latest')`는 일일 발견 통계 용도여서 날짜로 걸러내지 않는다. 새 RPC도 `security invoker`, service_role 전용 실행 권한을 유지한다.

### API / Web / Collection

- `list`와 `facets`의 `view` 입력은 `latest | deep_read | saved`다. 응답의 JSON 구조와 20개 커서 단위는 유지한다.
- Tavily 검색은 기본 검색 `time_range=month`이고 제공 날짜가 없거나 미래·30일 초과면 신규 기사로 수집하지 않는다. 무료 계정/호출 제한 및 안전한 URL 검증은 기존대로 유지한다.
- 웹은 20개 청크를 누적하며 하단 관찰자와 접근 가능한 버튼으로 다음 커서를 읽는다. 백그라운드 목록 확인은 수집/검색 API를 호출하지 않고 새 글 배너만 표시한다.
- 날짜 레이블은 RSS/API `발행일`, 웹 검색 `검색 제공 날짜`로 구분한다. 카드에는 연도를 포함한다.
- 검색 결과 분류는 `startups.aws.com/(언어/)?build` 자료 모음 경로를 목록으로 처리하며 하위 개별 가이드 경로는 유지한다. Supabase CLI의 일반 `db push` 드라이런은 과거 원격 이력 불일치로 중단되어 이번 DDL만 MCP 마이그레이션으로 적용했고, 저장소 SQL 파일명은 실제 적용된 버전 `20260927092206`과 일치시켰다. 무관한 과거 이력은 수정하지 않았다.
- 배포 순서: 해당 DB 마이그레이션 → JWT 검증을 유지한 `tech-feed`/`tech-feed-worker` Edge → main 푸시로 Vercel 웹 배포. 출석/타이머/다른 함수·비밀값·RSS 승인 상태는 변경하지 않았다.
