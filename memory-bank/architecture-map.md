# Architecture Map

## 적용 상태

- 공용 DUNE 원칙 문서: `C:/jini-dev/docs/dune-architecture.md`. 이 checkout의 기능 지도와 실행 계약은 `docs/dune.md`, `dune.config.json`, `.dune/check.py`를 따른다.
- 현재 변경 범위인 기술 피드 번역의 경계를 아래에 기록했다. 다른 기능의 상세 경계는 관련 PRD와 implementation-plan을 따른다.
- `.ai/dune/rules.json`은 이전 도구의 피드 UI→서버 import 금지 선언이다. 현재 `.dune/check.py`가 읽는 설정은 `dune.config.json`이며, 이전 선언 파일이 현재 검사기에 연결됐다고 간주하지 않는다. 현재 `web-no-mobile-or-server` 경계가 해당 금지를 포함한다. 정적 검사는 제품 테스트·RLS·실기기 검증을 대신하지 않는다.
- 공용 DUNE 파일은 이번 동기화 전에 존재한 별도 미커밋 작업으로 보존했다. GitHub의 이 통합만으로 공용 검사기·설정·CI가 배포되는 것은 아니다. 새 checkout은 공용 루트의 `python agents/apply-dune.py --check --project studyRoom`으로 적용 상태를 확인하고, 검사 파일이 실제 존재할 때 아래 명령을 실행한다.

## 기능과 공식 진입점

| 기능 | 담당 폴더 | 공개 진입점 | 의존할 수 있는 계층 | 관련 PRD |
|---|---|---|---|---|
| HIG 기반 공통 표시 | apps/web/src/DashboardNavigation.tsx, dashboardRedesign.css, appTheme.css; apps/mobile/App.tsx의 기존 mobilePalette | 기존 DashboardApp/인증 화면의 표시·내비게이션 | 기존 UI 토큰/공식 콜백만. 세션/카메라/학습 상태 소유권 불변 | prd-hig-ui.md |
| Windows 로컬 상태 화면 | apps/desktop/src/desktopStatus.css, desktopLoopback.mjs, error.html | loopback 고정 HTML 응답 / 기존 로드 실패 화면 | CSS만 공유. 인증·세션·공부 lifecycle 소유권 불변, callback은 로컬 CSS의 SHA256 CSP만 허용 | prd-hig-ui.md |
| 공부 보존 화면 복구 | apps/web/src/RecoverableSection.tsx, RecoverableSection.css | Dashboard의 기존 화면 경계·필수 회고 eager import | UI 오류 상태만 소유, Dashboard의 학습/카메라 lifecycle은 유지 | prd-safe-section-recovery.md |
| 피드 화면 | apps/web/src/TechFeedSection.tsx, FeedDailyBriefing.tsx | techFeed.mjs 인증 클라이언트 | 공개 core helpers, 웹 client | prd-tech-feed.md |
| 피드 본문 표시 | packages/core/src/feedMarkdown.mjs, apps/web/src/feedPresentation.mjs, FeedArticleText.tsx | feedMarkdownPreview / parseFeedMarkdown | 공개 core 표시 helpers | prd-tech-feed.md |
| 피드 API/수집 | supabase/functions/tech-feed, tech-feed-worker | Edge handler / runFeedWorker | _shared 서버 어댑터, service_role RPC | prd-tech-feed.md |
| 무료 번역 | supabase/functions/_shared/tech-feed-translation.mjs, tech-feed-translation-worker.mjs | createDeepLTranslation / runTranslationWorker | 고정 무료 endpoint, store RPC | prd-tech-feed.md, docs/tech-feed/korean-translation.md |
| Android 공통 화면 | apps/mobile/App.tsx | 인증된 hosted WebView | 웹 화면과 동일 서버 API | prd-android-web-parity.md |
| 동일 계정 공부·카메라 동기화 | apps/web/src/studyDeviceSync.mjs, main.tsx, supabase/migrations/20261018100359_study_device_camera_sync.sql | study_device_snapshot / study_camera_action / service 전용 claim_study_camera_warning | 기존 actual tracking·카메라 감지·계정 RLS | prd-cross-device-study.md |
| 함께 공부방 화면 | apps/web/src/TeamStudySection.tsx, teamStudyClient.mjs, teamStudyInvite.mjs, teamStudyPresentation.mjs | team_study_snapshot / team_study_action 인증 RPC | 웹 공개 client·표시 helpers·Dashboard 개인 콜백 | prd-social-study-room.md |
| 계정 공개 태그 편집 | apps/web/src/PublicTagSettings.tsx, PublicTagSettings.css | 설정 계정 구역→기존 teamStudyClient의 snapshot / set_tag | guarded 인증 RPC·공개 태그 정규화 helper | prd-app-settings.md, prd-social-study-room.md |
| 팀 권한·초대·공동 집중·목표·숲 | supabase/migrations/20261012143354_team_study_room.sql, 20261013081052_team_focus_options.sql, 20261015035420_team_automatic_study.sql | guarded team_study_action / team_study_snapshot | team private 상태·실제 공부 checkpoint. 무제한/1~1440분, 회원 공부 자동 기여·새 목표 저장 시 공유 | prd-social-study-room.md |

## 영속 상태의 수정 경로

| 상태 | 소유 모듈 또는 서비스 | 공식 수정 API | 호출하는 모듈 | 금지된 우회 |
|---|---|---|---|---|
| 번역 캐시·문자 예산·lease | Supabase translation 테이블 / tech-feed-store.ts | claimTranslations, reserveTranslation, finishTranslation | 서버 번역 worker | 브라우저 직접 쓰기·로컬 예산 초기화 |
| 관심 설정·저장·할 일 연결 | Supabase 소유자 데이터 / tech-feed-store.ts | tech-feed 인증 API와 기존 RPC | techFeed.mjs | 별도 앱 로컬 피드 DB·service_role 노출 |
| 공급자 무료 요금제 선택 | Edge runtime 환경 | DEEPL_API_PLAN=free 또는 명시적 developer | createDeepLTranslation | 임의 숫자 상한·유료 endpoint·월별 lifetime 초기화 |
| 팀·멤버십·태그·초대·round·연결 | Supabase team private 경계 | team_study_action | 팀 전용 web client | 직접 테이블 쓰기·타 계정 세션 시작/종료·전체 개인 조회 |
| 팀 공부/휴식 표시 | 기존 study_sessions와 actual tracking | team_study_snapshot의 멤버 제한 projection | 팀 전용 화면 | 웹 로컬 타이머를 인정시간으로 저장·연결 손실을 자리비움으로 추정 |
| 같은 계정 담당·감지 상태·제외값 | study_camera_sessions와 study_device_private | 인증된 claim/report, 기존 lifecycle의 authoritative exclusion wrapper | Dashboard shared controller·guarded Edge | 관찰 기기 카메라/경고/로컬 자동 종료·구형 caller 제외 덮어쓰기·직접 warning INSERT |
| 팀 목표·완료 알림 | private members의 goal/share_goal, private rounds의 서버 종료 시각 | guarded set_goal/propose_round → 회원 제한 snapshot | TeamStudySection과 표시 helper. 새 목표 저장 시 공유·이전 비공개 보존, 지정 시간 완료는 알림만 | 개인 전체 목표 자동 공유·시간 만료로 개인 공부 종료·매일 팀 탈퇴 |
| 공동 숲 확정 기여 | 서버 종료/정산된 study_todo_segments + 팀 연결 경계 | member-only snapshot aggregate | 팀 숲 한 곳 | 활성 잠정 시간으로 성장 확정·과거/중복 시간 합산 |

팀 연결 경계의 checkpoint는 세션→actual tracking 순서로 잠그고 기존 close_segment를 통해 구간을 분리하는 공식 서버 경로를 사용한다. 개인 시작/재개/휴식/종료·카메라/회복 검증은 DashboardApp의 기존 액션이 소유한다. 팀 모듈은 이 상태를 직접 수정하지 않는다. 운영 DB version20261012235920 권한/RLS/RPC/publication 및 제품b9ab3ec 웹 feature-ref 배포 완료. 실계정/기기 수용은 docs/team-study/verification-20261013.md의 미확인 범위를 따른다.

같은 상태를 여러 곳에서 직접 수정하지 않는다. 파일 claim은 편집 충돌을 줄이는 수단이며 실행 중 상태의 단일 수정 경로를 보장하지는 않는다.

태그 편집은 설정 화면에만 마운트하며 클라이언트 인증 소유자·dispose 검증을 재사용한다. DashboardApp은 개인/팀 진입 탭과 설정 컴포넌트를 연결할 뿐 태그 영속 상태를 소유하지 않는다. 개인 기본 화면은 팀 RPC를 요구하지 않고 기존 공식 공부 시작을 바로 제공한다. 팀 없는 정상 snapshot에는 생성/받은 초대만 보이며, 팀 조회 실패 때는 기존 개인 제어·운영 경고를 유지한다.

무제한/직접 시간은 local20261013081052→remote20261013084053·웹9cffc74로 제공한다. 자동 기여 확장은 추가20261015035420_team_automatic_study.sql의 private auto_connect·실제 구간/초점/재개 trigger와 기존 team_study_action이 소유한다. 시작/재개는 개인 공식 경로, 팀 가입/집중 제안은 ordered session/tracking prelock 후 checkpoint를 사용한다. 최초 start signal은 팀 잠금 이후 발행해 signal→team 역순을 피한다. 최종 인정 segment·출석 정책은 불변이다. 목표 저장 기본 공유(과거 비공개 보존), 팀장 배지·AccessibleDialog 탈퇴는 TeamStudySection에서 처리한다. 개인 종료는 onEnd, 영구 가입 변경은 leave_team에 한정한다. 검증/출시는 docs/team-study/automatic-study-20261015.md 참고.

## 검증 명령

- 타입/테스트/빌드: npm.cmd test, npm.cmd run test:edge, npm.cmd run mobile:check, npm.cmd run build, npm.cmd run docs:check. 별도 린트 스크립트는 없다.
- 새 팀 기능의 정적 경계/반복 검증 원본은 추적된 .ai/dune/rules.json이다. `ai.ps1 verify --project <root>`가 팀 UI→서버/네이티브 직접 import 금지와 위5명령을 실행한다. SQL/RLS는 PGlite와 원격 MCP 확인, 실제 UI는 Chrome 선택 런타임을 활성화한 전체 목록(concurrency2)으로 별도 검증한다. 기존2파일 검사 결과만으로 새 팀 경계를 통과했다고 표시하지 않는다.
- 의존성 경계: `python .dune/check.py --root .`. 공통 완료 게이트: `python .dune/check.py --root . --verify` (검사기와 설정이 있는 checkout에서 실행).
- 실제 플로우: 로그인 → 기술 피드 → 한국어 제목/소개·접힌 원문·원문 링크 → 저장/공부할 일 연결. 사용자의 공부 탭은 조작하지 않는다. 기존 sessionExit는 pagehide/beforeunload/visibilitychange 종료 요청을 막으며 production 함수와 관련 회귀4/4로 확인했다. 추가 검증 탭을 닫는 것을 서버 세션 종료로 추정하지 않는다.
- CI: 기존 vercel-production.yml이 Node/Edge/mobile/docs/build를 실행한다. 로컬의 별도 `.github/workflows/dune.yml`은 미커밋 상태이며, 이번 통합에서 원격 실행이나 필수 상태 검사 연결을 완료로 기록하지 않는다.

## 예외와 아키텍처 변경

| 날짜 | 대상 규칙 | 변경 이유와 관련 요구사항 | 적용 범위 | 대체 검증 |
|---|---|---|---|---|
| 2026-10-10 | 무료 번역 상한 | 검증된 무료 Developer 100만 자 lifetime 지원 승인 | 서버의 명시적 developer 선택만 | provider/worker 회귀·실제 usage/번역 저장 확인 |

검사 통과만을 목적으로 예외를 추가하지 않는다. 프로젝트 경계를 바꿀 때 PRD와 implementation-plan을 함께 검토한다.

## Windows 데스크톱 경계

- loopback 성공 응답은 인증 callback이 resolve한 뒤 현재 인증 탭의 `window.close()`만 시도한다. 고정 스크립트의 SHA256 CSP만 허용하고 unsafe-inline/eval·외부 script·다른 탭 조작은 없다. 실패/취소 응답에는 script를 넣지 않고, Chrome의 닫기 거부는 완료 안내 fallback으로 남긴다. 기존 PKCE/수신기 수명·native 창 복원·학습 상태 소유권은 불변이다.

- Google OAuth 수신은 승인된 `desktopLoopback.mjs`의 127.0.0.1 임시 HTTP transport를 main에서 auth에 주입한다. 32바이트 nonce/정확 Host·원문 path·GET·단일 code·5분·일회성만 허용하며 auth가 자원 수명을 소유한다. SDK PKCE·identity·generation·암호화·기존 웹 티켓은 desktopAuth가 계속 소유한다. loopback intent는 restart/legacy URI로 소비하지 않는다. 일반 웹 origin의 loopback 개발 허용과 이 native OAuth 수신기는 별개다. [승인 설계](../docs/superpowers/specs/2026-10-27-desktop-loopback-design.md).

- 이메일 요청 실패는 native auth→기존 IPC→공통 로그인 안내의 고정 허용 코드만 전달한다. `AUTH_EMAIL_RATE_LIMIT`/`AUTH_RATE_LIMIT`/`AUTH_NETWORK_ERROR`는 인증 우회나 성공이 아니며 기존 쿨다운을 선택한다. Google 대기 시각은 웹 표시 상태이고 실제 사용자/PKCE/티켓 상태는 기존 소유자만 검증한다. 프로필은 `%APPDATA%/@study-room/desktop`이며 변경하지 않는다.
- desktopAuthDiagnostics.mjs는 main의 비동기 best-effort writer를 통해 최근32개 고정 OAuth 단계/시각만 로컬 기록한다. 한 쓰기+최신 snapshot만 유지하고 호출자가 디스크를 기다리지 않는다. runtime의 OS 수신/검증과 auth의 pending 소비/교환 경계를 관찰할 뿐 영속 인증 상태·브리지·서버 API를 소유하지 않는다. 비밀·URL·원문은 허용하지 않는다.

- 진입점: `apps/desktop/main.cjs` → `src/desktopRuntime.mjs`, `preload.cjs`의 protocolVersion1 `studyRoomDesktop.request/onEvent`. production은 정확히 `https://study-room-attendance.vercel.app`만 로드한다. loopback/격리 userData 옵션은 unpackaged 개발 실행에만 허용한다.
- main/runtime는 단일 창·트레이·출처/현재 mainFrame/문서 세대 검증·명시적 카메라 동의·OS 설정·단일 인스턴스를 소유한다. X는 같은 창/문서를 숨길 뿐 카메라·학습 종료를 호출하지 않는다. `backgroundThrottling:false`를 유지한다.
- native 인증은 `desktopAuth.mjs`의 검증된 사용자/PKCE/기존 `mobile-web-auth` 일회용 티켓이 공식 경로다. SDK 세션·verifier·pending·logout barrier는 동일 `desktopStorage.mjs`와 Windows safeStorage 암호문 어댑터를 사용한다. renderer에는 원시 토큰/파일/Node API를 노출하지 않는다.
- insecure 저장소의 SDK 소유 credential 정리는 `desktopAuth.mjs`가 초기화/명시적 새 인증 전에 local scope로 소유한다. 이전 암호문 계정 복원을 막고 null identity 이벤트로 runtime proof를 무효화한다. native pending/logout barrier와 정상 secure session, 기존 학습 상태는 이 정리의 대상이 아니다.
- SDK에만 `desktopStorage.mjs/createSdkStorage`를 연결해 실제 저장 실패를 공개 AuthRetryableFetchError로 전달한다. 직접 native barrier storage는 원래 실패 의미를 유지한다. native auth의 storageFailed가 즉시 identity를 무효화하고 refresh 정지/단일 local cleanup을 소유하며, 명시적 성공 로그인 뒤 refresh를 재개한다. runtime은 같은 창에 복구 안내를 제공한다.
- active 인증의 저장 실패/세대 무효화는 raw SDK 인증이 resolve/reject한 뒤 operation별 단일 최종 cleanup에 합친다. bounded caller timeout과 raw settlement를 분리하며, 모든 raw local logout이 끝나기 전 OTP/provider/verify/exchange successor를 차단한다. 선행 logout 이후 늦게 만들어진 세션은 별도 최종보상을 유지한다. 실패한 isolation은 native barrier와 null identity를 보존한다.
- 공통 웹 연결은 `desktopBridge.mjs`·`DesktopAuthGate.tsx`가 소유한다. native+웹 동일 사용자 검증 전 protected App을 막고, `authSession.mjs`의 desktop bootstrap은 SDK 생성 전 메모리 전용 저장과 정확한 legacy auth key 정리를 선택한다. 정리 실패는 빈 메모리 client만 만들고 오류/명시 재시도·unknown 종료 증거를 유지한다. 일반 웹/Android 저장은 변경하지 않는다.
- `studyState`는 native 검증 사용자와 일치해야 하며 수신 시각은 main이 기록한다. 3초 웹 heartbeat가 Auth 네트워크 polling을 만들지 않도록 검증 identity는 auth 이벤트/문서 교체에 동기 무효화하고 명시적 authStatus에서 재검증한다. lifecycle의 종료 증거는10초까지만 유효하다.
- 트레이 명시 종료는10초 표시 캐시만으로 결정하지 않는다. `state-requested/requestId` 이벤트 뒤5초 이내 같은 envelope ID·현재 문서/사용자의 `studyState` 응답을 요구한다. timeout/탐색/인증변화는 기존 경고 경로로 처리하고 다른 주기 heartbeat나 늦은 응답으로 종료하지 않는다.
- 영속 학습/카메라 담당/회복/회고/서버 종료는 기존 Dashboard/서버가 소유한다. `desktopLifecycle.mjs`는 검증된 local engagement metadata만 보존하며 pause/재실행에도 유지한다. native 종료는 기존 웹 completion 요청 또는 경고된 프로세스 종료일 뿐 학습 RPC를 직접 호출하지 않는다.
- `main.tsx`의 desktop snapshot은 참여 증거와 실제 camera/pending을 분리하며 시간대·공개 태그·기존 알림 저장을 동기 counter로 포함한다. 종료 이벤트의 probe-captured user/session/localEngagement를 확인한 뒤 기존 completion/카메라 stop 경로만 사용한다. `DesktopDeviceSettings.tsx`는 Windows 정보/OS 카메라 설정만 제공하고 Android APK 버튼을 표시하지 않는다.
- 팀/피드의 mutation은 첫 await 전에 pending owner를 얻고 finally에서 해제한다. desktopBridge의 문서/window WeakMap은 탭·Dashboard·인증 부모 unmount를 넘어 미완료 소유권을 유지하고 일반/로그아웃 probe 양쪽에 합친다. observer 참여 판정과 Android tracker는 변경하지 않는다.
- `desktopShellSettings.mjs`는 창 bounds와 첫 숨김 안내 확인만 검증한다. main의 별도 userData/shell-settings.json atomic 저장에는 credential/학습 데이터를 넣지 않는다. runtime은 현재 모니터 work area로 복원/재배치하고, Tray 실패 시 같은 창의 복구·재시도·기존 requestQuit 경로를 제공한다.
- 카메라 권한 check/request는 소유 webContents·정확한 requesting origin·mainFrame·video-only·현재 문서의 명시적 동의가 모두 참일 때만 허용한다. 동의 UI는 `cameraConsent` action만 열고 자동 복구/설정 진입/권한 handler는 열지 않는다. 기존 팀 초대 복사만 보존하기 위해 `clipboard-sanitized-write`는 신뢰 최상위 문서·visible/focused 창에 한정 허용한다. clipboard-read·마이크·화면 공유·기타 권한은 거부하며 native push를 추가하지 않는다.
- 설정 준비: `desktop:start`/`desktop:build -- --env-file=<절대경로>` 또는 공개 `VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY` 환경 변수. ignored `apps/desktop/resources/public-config.json`에는 HTTPS URL/anon 또는 publishable key만 기록하며 기존 mobile PNG를 그대로 복사한다. `.env`·테스트·로그·repo 전체는 설치 패키지에 넣지 않는다.
- 검증: `npm.cmd run desktop:check`, `npm.cmd run desktop:test`, `ai.ps1 dune check --project <root>`; 실제 Electron binary 요구 검사는 별도 `npm.cmd run desktop:integration`. 설치 빌드 `npm.cmd run desktop:build -- --env-file=<path>`는 고정 Electron45.0.0/builder26.18.0·NSIS x64·per-user·appId `app.studyroom.desktop`·StudyRoom executable을 사용한다. 설치/실계정/실카메라 수용은 controller 검증 문서에서 별도 확인한다.
