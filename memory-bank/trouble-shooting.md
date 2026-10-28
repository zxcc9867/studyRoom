# Troubleshooting

## 설정 분류·요약 편집과 익명 로딩 표시 — 2026-10-29

- 기존 설정은 모든 편집 필드를 세로 나열했다. SettingsLayout의 분류 표시만 바꾸고 하위 컴포넌트는 유지해 초안/진행 중 쓰기를 분류 이동으로 해제하지 않는다.
- 태그는 익명 계정에서 조회하지 않아 loading이 해소되지 않는다. 새 요약은 registered=false를 먼저 구분해 ‘정식 계정 전용’을 표시하고 조회/편집을 실행하지 않는다. 실제 컴포넌트 RED→GREEN 회귀를 유지한다.
- 기존 Windows controller fixture는 CSS를 생략했다. 새 분류/표시 검사는 실제 bundled CSS를 켜서 검증하고, 기존 무스타일 controller 검사를 시각 수용 근거로 쓰지 않는다. 옛 위치 일시 원복 시도는 차단되어 적용하지 않았다.
- 새 내용 면은 settings-content다. 공통 면 검사는 해당 면을 검사하고, 알림 키보드는 summary Enter→편집 조작 Tab 순서를 검증한다. 상세 결과는 docs/verification/2026-10-29-settings-redesign.md.

## 공통 UI 외곽 검사만 통과하고 내부 구형 스타일 잔류 — 2026-10-29

- 회복 요약/이력의 노란 점선·두꺼운 배지/영문과 숲/화면 구성의 입체 효과가 남았다. 기존 전체 탭 검사는 외곽 면만 검증해 자식 스타일 누락을 잡지 못했다.
- appTheme.css의 자식 컴포넌트를 기존 토큰에 연결하고 중복 영문만 제거한다. 경고/출석 등 의미 있는 상태는 별도 팔레트를 유지하며 데이터/콜백/서버 정책은 바꾸지 않는다.
- 모바일 달력은7열/6px 간격 때문에 날짜가39px였다. 좁은 화면 간격0·날짜 최소44px로 가로 넘침 없이 수정한다.
- :is()는 가장 강한 분기의 specificity를 사용한다. calendar-day와 legend span을 묶으면 span의 weight가 상태 색을 덮으므로 분리하고, 회복 본문은 기존 workspace selector와 우선순위를 맞춘다.
- 실제 Chrome에서 자식 배지/안내/팀 모달/확대/상태별 계산 색상/기록 보존을 검사한다. 초기RED8·설치면RED1·상태색/본문RED를 근거로 남기며 최종 결과는 docs/verification/2026-10-29-full-ui-audit.md를 따른다.

## 로컬 상태 화면 CSS와 Windows 줄바꿈 — 2026-10-28

- 로그인 완료·실패 HTML과 연결 실패 화면이 기본 글꼴/큰 제목으로 분리돼 있었다. desktopStatus.css로 공통 색·한글 폰트·폭·간격을 제공하고 callback은 고정 CSS SHA256만 허용한다.
- core.autocrlf의 CRLF 원문을 해시하면 HTML 파싱의 LF 정규화와 달라 Chrome이 스타일을 거부한다. CSS를 읽을 때 LF로 정규화한 뒤 같은 문자열을 해시·삽입한다.
- CRLF 임시 checkout 회귀 RED→GREEN, 실제 Chrome375/1440·200%·키보드 검증. 외부 자산 요청/unsafe-inline/eval·인증값 반사는 금지한다. 연결 오류는 공부 종료/저장 완료가 아님을 유지한다.
- 웹 로그인은 reduced-motion 범위에서 빠져160ms transition이 남았다. 로그인/대시보드와 pseudo-element를 같은 접근성 규칙으로 처리하고 실제 CSS 테스트를 유지한다.

## 로그인 완료 브라우저 탭 자동 닫기 — 2026-10-27

- 0.1.4는 CSP default-src none의 정적 HTML만 반환해 인증 완료 뒤에도 탭이 남았다. 사용자 승인으로 성공 응답에만 고정 window.close 스크립트/SHA256 CSP를 추가한다.
- 스크립트가 만든 창 또는 허용된 이력의 탭만 닫을 수 있다. 실제 Chrome에서 닫히는 popup과 다중 이력 탭의 정책 거부를 분리 검증한다. 거부 시 안내를 유지하며 browser policy/다른 탭/보안 설정은 건드리지 않는다.
- 실패·취소 응답에는 script/CSP허용을 넣지 않고 기존 검증/학습 경계를 유지한다. docs/verification/2026-10-27-auth-tab-close.md.

## Windows loopback 콜백과 새 로그인 의도 경합 — 2026-10-27

- Chrome custom handler 미발견과 정상 Windows 조회 불일치는 환경 세부 원인 미확정이다. 사용자 승인으로 RFC8252 loopback을 추가하며 보안 프로그램/브라우저 보호를 끄거나 alias를 만들지 않는다.
- 늦은 이전 콜백이 verifiedUser 대기 뒤 새 intent를 발견하면 무조건 clearPending하던 경합을 실제 HTTP RED로 재현했다. pending/receiver 소유권이 같은 경우에만 정리하고 stale 콜백은 자신만 거부하도록 수정했다.
- 수신기 생성 예외 때 receiver가 null일 수 있어 optional cleanup으로 새 인증 재시도를 보존한다. 신규 회귀와 독립 재검토 통과. 실제 Chrome/설치 수용은 별도다.
- loopback은 127.0.0.1·임시 port·난수 path·5분·1회다. 기존8주소/다른13설정을 보존한 좁은패턴1개만 추가했으며 DB/기록 변경 없음. docs/verification/2026-10-27-desktop-loopback.md.

## OAuth302와 앱 복귀 성공을 구분 — 2026-10-27

- 허용URL 등록/서버 코드 발급·302만으로 실제 Location 또는 앱 수신을 확인한 것으로 쓰지 않는다. 사용자 제공 실제 callback 응답의 비밀 query를 제외한 Location과 native 고정 stage를 대조한다.
- 이번09:28UTC 응답은 정확한 Windows callback인데 native 수신0이었다. URL 누락/오등록·Site URL fallback은 이 시도와 맞지 않지만 CSP sandbox 존재만으로 Chrome 차단 이유를 확정하지 않는다. Console의 등록handler/사용자조작/정책 오류를 구분한다.
- Windows UI 도구가URL 판별 불가로 중단되면 우회하지 않는다. 사용자에게 해당 header/오류의 비민감 부분만 요청한다. HAR/전체URL/Cookie를 받거나 코드/토큰을 재사용하지 않는다. 이미 제공된 원문은 문서/Git/외부 조사에 복사하지 않는다.
- 네트워크 제한의 health READ_FAILED·무인증401는 실제 OAuth 실패의 원인이 아니다. 이번 공개health 비교는 callback CSP 차이를 증명하지 않아 근거에서 제외했다. 기존 학습·인증 설정은 변경하지 않았다.

## Chrome handler없음과 Windows 등록 조회 불일치 — 2026-10-27 조사중

- 실제Console의 scheme does not have a registered handler는 동일Chrome155소스에서 앱이름조회빈값분기다. Supabase의정확한Location과구분하고 Self-XSS/WebGPU/aria경고나CSP헤더만으로원인을추정하지않는다.
- HKCR URL Protocol/AssocQueryString(FRIENDLYAPPNAME,IS_PROTOCOL)/root·command fallback까지대조한다. host·32/64뷰·실제Chrome사용자/세션을구분하며HKCU명령한개만으로완료하지않는다. 이번조회는정상이었고Chrome실제판정과불일치했다.
- Microsoft의연결변경알림1회는등록값을바꾸지않았지만 실제재시도는실패했다. 캐시원인/해결확정으로쓰지않는다. 다음은미저장작업·공부/카메라없을때사용자가Chrome완전재시작만비교한다.
- 프로필/세션삭제·전체browser강제종료·HKLM/기본앱/보안정책수정은하지않는다. 현재원인세부/실제로그인은미해결이다.

## Electron 하위 프레임 보안 테스트가 공격 준비에서 멈춤 — 2026-10-27

- 증상: stronger-attacker fixture의 /frame 제목은 표시되지만 attackRequest가 undefined라 실제 senderFrame 차단 검사 전에5초 timeout. 빌드 없는 단독 실행에서도 재현했다.
- 원인/근거: 새 iframe의 contentDocument/contentWindow를 탐색 전 poll하면 preload를 막을 수 있는 Electron 이슈[#34727](https://github.com/electron/electron/issues/34727)와 일치한다. 새 Google 옵션은 이 fixture에서 호출하지 않는다.
- 조치: integration/windows-electron.mjs에서 정확한 /frame의 framenavigated를 기다린 뒤 해당 frame 안에서 준비를 확인한다. runtime/preload·생산 sandbox·실제 owning subframe IPC와 UNTRUSTED_DOCUMENT 단언은 유지한다.
- 검증: 기존 단독 RED→동일 Electron45 단독 GREEN/실제 하위 프레임 IPC 관측. 최종 전체16/16·실패/생략0/6분 숨김 유지와 독립 재검토C/I/M0 통과. 이 테스트 통과를 실제 Google 로그인 성공으로 해석하지 않는다.

## 2026-10-25 공부를 시작했는데 출석 실패가 된 경우 — 시작 기준으로 개정

- 원인: 기존 판정은 알림 시각에 공부 중이거나 알림 후 30분 안에 시작했을 때 출석이며, 그 외에는 완료 시간이 평일 2시간·주말 4시간에 도달해야 출석으로 승격했다. 일요일 오전에 약 2시간 공부 후 종료한 실제 기록은 이 정책 때문에 오후에 결석·회복으로 처리됐다.
- 새 요구: 공부일 내 유효 시작이면 즉시 출석, 목표 달성은 별도다. 당일 시작 기회를 막지 않도록 결석을 다음 04:00 이후 판정한다. [PRD](prd-attendance-start.md).
- 전환: 현재 공부일의 오판정만 정정하고 미제출 출석 회복을 시스템 해제로 남긴다. 사용자가 작성한 것처럼 제출하거나 보충 할 일을 만들지 않는다. 과거·카메라 기록을 일괄 해제하지 않는다.
- Chrome전체1370/1370·Edge23/23·모바일/docs/build·DUNE 통과 후 선행RPC→새Cron/Slack→1413초/전체검증→정책 순으로 서버 반영했다. 실제 계정의 출석 present·누적 시간/목표 불변·회복pending0, 과거/학습/회복12범위 해시 일치를 확인했다. 이미 제출한 회복은 보존한다. 웹 배포는 [실행 기록](../docs/verification/2026-10-25-attendance-start.md)을 따른다. 아래 기존 정책 조사 기록은 변경 전 원인 증거다.

## 피드 수집·화면·번역·요약의 실패를 구분 — 2026-10-25

- 로컬 서버 미실행/미로그인은 피드 화면 접근 실패이며 서버 정기 수집 중단의 증거가 아니다. 운영 검색 topic의 enabled/ready·마지막 성공·실패 횟수와 기사 최초 발견 시각을 별도로 확인한다. 이번 읽기 전용 조사에서는 수집 활성·최근 정기 검색 성공·실패0과 당일 저장된 기사가 확인됐다.
- `tech_feed_runs.error_code=summary_failed` 또는 기사 summary pending/failed는 요약 단계 상태다. `collection_failed`와 함께 해석하고 모든 수집이 실패했다고 보고하지 않는다. 번역 provider의 `quota_exhausted`도 원문 수집 중단과 분리한다. 상세 계정 정보·관심 입력·인증값은 기록하지 않는다.
- 새 글0건과 미실행/오류도 구분한다. 검색 재실행 성공이 새로운 URL의 최초 발견을 보장하지 않으며, 중복을 다시 발견한 시각으로 기존 발견일을 바꾸지 않는다. 이번 확인은 저장 이력/상태 조회와 기존 PRD/worker 경계 대조이며 추가 검색·AI/번역 호출·설정 변경은 하지 않았다.

## 알림 전에 공부를 마쳤는데 출석 회복이 요구됨 — 2026-10-25

- 현재 출석은 공부일에 한 번 시작했다는 사실만으로 인정하지 않는다. 같은 공부일에서 알림 시각에 걸쳐 있는 세션, `[알림, 30분 마감)`에 시작한 세션, 완료 누적 목표(평일2시간/주말4시간) 중 하나가 필요하다. 예를 들어 주말14시 알림 전에2시간을 완료하고 세션을 종료한 경우 마감까지 다른 조건이 없으면 missed/출석 회복 대상이다. 이 예시는 정책 설명이며 실사용 계정의 상세 기록을 공개하지 않는다.
- 미달 목표만으로 기존 present를 missed로 내리지 않는다. 최신 `mark_missed_attendance`는 pending에만 작동하며 세션 자격과 완료 합계를 먼저 검사한다. 04시 공부일 귀속과 다른 날짜/사유의 pending 회복도 분리한다. 알림 전 종료와 알림 시각에 진행 중인 경우를 같은 것으로 해석하지 않는다.
- 확인: 본인 계정의 필요한 날짜/필드만 읽기 전용 조회하고 운영 `get_due_reminders`, `mark_missed_attendance`, `promote_attendance_by_daily_study_total`, `study_attendance_goal_seconds` 정의를 대조했다. 별도 백엔드 검토도 같은 조건을 확인했다. 개인 식별자·세션 상세·회복 사유·토큰은 이 기록에 저장하지 않았다.
- 근거: `prd-supabase-cron.md`, `prd-slack-recovery-routines.md`, `prd-study-day.md`, SQL `20260722133736`의 결석 판정과 `20261005131830`의 공부일/시작/완료 합계·승격, `attendance-cron`의 결석 후 회복 생성 순서. 학습 기록 누락과 현재 정책이 사용자의 기대와 다른 경우를 구분한다.
- 이번 조사는 출석/회복 행·설정·서버 함수를 변경하거나 회복을 대리 제출하지 않았다. 알림과 관계없이 시작하면 출석으로 인정하도록 바꾸는 것은 별도의 제품 정책 결정이며 소급 정정 범위도 함께 정해야 한다.

## 로컬 기술 피드가 표시되지 않음 — 2026-10-25

- 실제 연결 탭은 `http://localhost:5173/`의 로그인 화면이었다. `main.tsx`는 세션이 없으면 로그인 화면을 반환하고, 로그인 후 `#feed`에서만 `TechFeedSection`을 마운트한다. 운영 사이트와 로컬 origin의 로그인 상태는 별개다. 인증 저장소·토큰을 열람하거나 복사하지 않았다.
- 콘솔의 Vite WebSocket 실패를 확인한 뒤 로컬 서버를 별도로 조사했다. 샌드박스 소켓 거부는 서버 장애 증거와 구분했다. 허용된 직접 IPv4 HTTP 진단에서는 `ECONNREFUSED`, netstat에는5173 listener가 없었다. 현재 브라우저에 남은 이전 화면과 서버 응답을 혼동하지 않는다. 서버가 종료된 경위까지 확정한 것은 아니다.
- `apps/web/.env.local`과 셸의 필수 VITE 설정도 없었다. 기존 Supabase 프로젝트의 URL·활성 publishable key를 MCP로 조회하여 gitignored 로컬 파일에만 복원했다. 공개 Auth settings HTTP200·Google/email 사용 가능을 검증했다. 서버 비밀키·로그인 세션·DB/Auth 설정은 변경하지 않았다.
- 기존 Vite를 명시한 앱 checkout/port에서 Node로 실행하고 `Start-Process -WindowStyle Hidden`과 파일 로그를 사용했다. 공용 환경 watcher·시작프로그램·자동 동기화는 실행하지 않았다. 런타임 정보/로그는 git에서 제외한 `output/dev-server/current.json`에 있다.
- 복원 후 앱 HTTP200, 실제 Vite 진입점, `/src/TechFeedSection.tsx` HTTP200·JavaScript를 확인하고 로그인 화면의 탭을1회 새로고침했다. 현재 화면은 정상 로그인 대기이며 사용자에게 로컬 로그인을 요청했다. **로그인 후 실제 피드 데이터/요약 표시 성공은 아직 확인하지 않았다.** 코드·패키지·운영 웹 변경 없이 로컬 실행을 복구한 작업이다.
- 후속 실제 확인: 사용자가 로그인 완료를 알린 뒤 기존 탭이 **운영 origin**으로 이동한 것을 확인했다. 자동 회복 안내는 닫기만 하고 `기술 피드` 메뉴로 이동했다. `https://study-room-attendance.vercel.app/#feed`에서 전체133건·오늘12건과 기사 목록·언어 필터·저장/할 일 추가 버튼을 실제로 확인했고 콘솔 error/warn은0건이었다. **운영 피드 표시 수용이며 로컬 로그인 유지나 새 AI 생성 성공의 증거는 아니다.** Google 로그인 후 운영으로 이동한 원인 설정은 변경/확정하지 않았다.
- 화면 증거는 개인 계정의 실제 화면이므로 Git 제외 `output/tech-feed-live-20261025.jpg`에만 저장했다. 인증 URL/토큰·개인 일정은 기록하지 않았다. 새 요약 생성·기사 저장·할 일 추가·회복 제출 버튼을 누르지 않았고 현재 탭을 피드 화면에 남겼다.

## 시간 저장 응답 누락으로 편집창이 계속 잠김 — 2026-10-25

- 원인: `saveSessionTodoTime`의 직접 UPDATE에 시간 제한/AbortSignal이 없어 응답이 오지 않으면 `finally`에 도달하지 못했다. 저장 ref와 todoBusy가 계속 유지되어 취소·닫기·시작이 잠겼다. 전역 Supabase 요청 제한도 설정되어 있지 않았다.
- 해결: 기존 `runBoundedRequest`로 쓰기·소유자 scoped 확인 조회에 각각 15초를 적용한다. SDK builder의 `.abortSignal(signal)`은 `.single()` 앞에 둔다. 시간 초 표현은 분으로 정규화해 비교한다.
- 응답 누락을 실패 확정으로 해석해 자동 UPDATE를 재시도하지 않는다. 서버 일치→성공, 다른 값→초안 유지/명시적 다시 저장, 읽기 실패→초안 유지/읽기 전용 다시 확인. 확인 중 취소·닫기는 controller와 요청 identity를 해제하며 같은 문서에서 재진입해도 불명확 초안을 보존한다. 취소가 이미 반영된 서버값을 되돌리지는 않는다.
- 무응답 쓰기 RED와 확인 중 취소 잠금 RED를 각각 재현했다. 가상 시계·실제 Chrome 집중14/14, 강화 닫기1/1·빌드·읽기 전용 독립 검토 통과. 전체 검사/배포는 [통합 기록](../docs/verification/2026-10-25-main-integration.md), 세부 계약은 [복구 검증](../docs/session-todo-time-edit/timeout-recovery-20261025.md).

## 세션 할 일 시간 재편집 진입점 누락

- 원인: 선택 목록에는 체크/삭제만 있고 기존 일반 편집은 반복 그룹까지 변경할 수 있어 시간 전용 동작에 재사용하면 안 된다.
- 해결: 별도 인라인 시작/종료와 시간2필드 소유자 scoped update. 실패/취소/계정 전환은 저장값과 학습 기록을 유지하며 저장 중 시작/닫기/중복 요청을 막는다.
- 편집 중 삭제는 stale todoId로 시작을 잠글 수 있어 편집 종료까지 삭제를 막는다. 저장 후 포커스는 busy 해제 후 effect에서 복원한다. 각 RED 재현 후 mounted8/8·독립 재검토 통과.
- 전체 게이트 중 기존 피드 정렬 테스트의 고정 발행일이 최근30일 밖으로 나가는19!=20을 분리 재현했다. 운영 SQL이 아닌 해당 fixture 날짜만 now() 기준으로 바꾸고23/23 확인.
- Android16 실제 WebView 격리 UI 수용과 운영 서버 저장 수용은 구분한다. 근거 docs/session-todo-time-edit/verification-20261024.md.


## 최신 빈 회고 뒤에도 오래된 다음 행동이 계속 표시됨

- 실제 PC/Android에서 장고245페이지 표시, 최신13번째 회고는next_action=null. 조회가null을건너뛰어 옛값을부활시키고 follow-up저장도빈값상태갱신을생략했다.
- 최신회고1건은null포함선택하고 새/동일/더최근회고저장을즉시반영한다. 기존회고/학습행 삭제·값수정·DB/API/native변경없음.
- 단위RED1·mounted화면/저장RED3→집중5/5·Chrome전체1348/1348·verify/Dune/독립검토차단결함없음. 기존nonnull조회고정문자열검사는실제조회경계/화면동작검사로대체.3312ad0 운영READY/HTTP200·실제PC/Android안내제거/회복잠금/기존4종digest동일확인.
- Android부팅직후응답지연1회뒤프로세스종료는exit-info에서WebView패키지업데이트에의한종료로확인했다. 부팅후COLD복원정상과구분하고 이증거로응답지연최초원인까지단정하지않는다. docs/cross-device-study/mobile-lifecycle-20261019.md.


## 배포 전부터 열린 탭의 설정 진입 시 빈 화면

- 증상: 10/18 PC 설정 진입 후 본문 비움, `Failed to fetch dynamically imported module: AdaptiveReminderCard-Cdyk3cG1.js`.
- 확인: 옛 chunk 경로가 HTTP200이지만 JavaScript가 아닌 HTML(924바이트)을 반환했다. HTTP200만으로 자산 정상 판정 금지.
- 복구: 활성 공부0/카메라 꺼짐/입력 없음 확인 후 사용자에게 알리고1회 새로고침. 기존 로그인·학습 화면 복원 후 사용자가 새 공부 시작. 진행 중 공부 강제 새로고침 없음.
- 재발 방지: RecoverableSection으로 lazy 영역만 격리하고 DashboardApp/카메라 유지. 자동 reload 없음·공부/휴식/조회/기존 Dashboard 저장 중 차단, 유휴 명시 reload만 허용·입력 손실 안내. 필수 종료/회고는 eager import로 rejected lazy에 갇히는 종료 불가를 방지한다.
- 검증: blank RED3·필수종료 RED1·목표저장 guard RED1→집중10/10·Chrome1343/1343·verify/독립검토PASS.225fd82 운영READY/200, Android16 실제HTML200 실패→명시복구·COLD로그인/학습유지·추가카메라없음. docs/safe-section-recovery-20261019.md. 과거 수동 복구 docs/cross-device-study/live-acceptance-20261018.md.


## 다른 기기 접속 시 로컬 카메라 꺼짐으로 중복 경고 — 상태 동기화 구현

- 10/18 실제PC 카메라 시작 후 camera_required_warning 추가 확인. main은 공통activeSession+로컬cameraOff로 경고·Edge는 사용자/세션만 확인한다. 담당기기/heartbeat가 없어 기기 간 감시 상태를 구분하지 못한다.
- 최근6시간5분absence_warning은 미발견·발신기기식별불가. 로컬 inactivity/제외시간의 기기 간 경합은 추가검증 대상이지 실제 기록손실 확정이 아니다.
- 10/18 영상 제외 승인 후 단일 담당·generation·shared snapshot·관찰 실행 차단을 구현했다. Edge 원자적 경고 허가와 legacy suppression, 직접 warning INSERT 차단, 기존 lifecycle의 서버 제외값 정규화를 함께 적용한다. 운영/실기기 최종 상태는 docs/cross-device-study/acceptance.md.
- 주의: snapshot 테스트가 담당권을 자동 생성하면 실제 camera:null 재개 누락을 숨긴다. 늦은 claim은 시도별 자원만 정리하고, 응답 시각/세대 역전·600초/lease 경계·원격 휴식 후 복구를 회귀 검사한다. 기존 영상비전송·학습/출석/회복 정책 보존.


기존 상세 항목은 [2026-10 보관본](archive/trouble-shooting-202610.md)에 보존했다. 기존 6천 줄 초과 문서를 공통 지침에 맞춰 요약했다.

## 자동 팀 연결의 시작/가입 경합과 재개 시점

- 증상: 동시 시작/가입 기여 누락 가능, BEFORE 재개 구간 hook은 이전 paused 행을 읽음.
- 원인: 미커밋 세션/멤버십 상호 비가시성·BEFORE UPDATE 조회, 팀 잠금 후 새 세션 발견의 역순.
- 해결: 새 세션 INSERT와 가입에 같은 사용자 advisory 직렬화(UPDATE에는 금지). AFTER 재개 연결, 초기 신호 지연. 사전 잠근 ID 외 세션 발견은 예외→RETRY로 mutation 전체 rollback.
- 방지: migration20261015035420·자동 SQL13개/독립 검토. 실제 PostgreSQL 다중 연결 수용은 미검증.

## mounted RPC wrapper의 abortSignal 보존

- 증상: 팀 테스트 fake를 Promise로 감싼 뒤 개인 시작/제어 실패.
- 원인/해결: builder의 abortSignal 소실. confirm만 then/abortSignal 보존 wrapper, 다른 RPC는 원래 값 반환.
- 방지: 카메라 준비→확인→자동 팀 반영→휴식/재개 Chrome 회귀. 제품 개인 로직을 우회하지 않음.

## 공부 종료와 팀 탈퇴 혼동

- 개인 onEnd는 회고/종료, 종료 trigger는 연결만 닫고 멤버십 유지. 시간 만료는 알림만.
- 탈퇴는 별도 AccessibleDialog에서 확인. 팀장은 위임 또는 해산 선택. 카드에 팀장 표시.
- select는 별도 htmlFor/id label로 option 문구가 접근성 이름에 섞이지 않게 한다.

## 팀 연결 checkpoint의 소수 초

- 기존 close_segment는 구간별 초를 floor해 split마다 1초 미만 배분 손실 가능.
- 개인 duration/출석은 불변. 확정 segment만 보수 합산하며 시간을 만들어 보상하지 않음.
- 보관본의 fractional 회귀: 개인1800초·segment1799초·수동 팀599초.

## Supabase migration 응답 불명

- 요청 상태 만료 등 응답만으로 적용 여부 추측 금지. list_migrations와 실제 schema/함수로 확인 후 재시도.
- local/remote 자동 version 차이를 기록하고 파일명 변경·history repair·전체 db push는 하지 않음.

## 팀 밖의 기존 오류

- 카메라·집중 모드·업데이트·회복·피드·인증 등 과거 근거는 보관본에서 해당 기능명으로 검색한다.
- 수정 전 현재 공식 PRD/architecture-map과 실제 코드·배포를 먼저 대조한다.

## Windows 인증 취소·지연 응답 복구

- 실패한 SDK local logout 뒤 새 OTP 실패나 OAuth timeout이 이전 자격/PKCE verifier를 되살릴 수 있었다. 실패 SDK가 아직 실행 중인데 busy를 풀거나 signed-out barrier를 지우는 경합이었다.
- `desktopAuth.mjs`는 취소된 동작을 SDK settle까지 격리하고 encrypted logout tombstone을 유지한다. 새 검증 로그인만 해제하며 늦은 ticket/accountABA는 무효화한다. Task1 회귀42/42·독립 재검토.
- 초기 getUser의 identity announcement는 runtime auth 세대를 한 번 바꿀 수 있다. 단일 flight+최대2회 post-event 검증으로 첫 authStatus/OTP를 유지하되 stale user proof는 금지한다. heartbeat마다 getUser polling하지 않는다.

## Windows 종료 상태 캐시·재확인

- 최근 idle 캐시 직후 새 저장이 시작되면 캐시만으로 프로세스를 끝낼 위험이 있었다. 매번 현재 문서·native user·requestID 일치5초 probe를 받고 최신 pending은 안전 상태를 낮출 수만 있게 했다.
- 정상 renderer의 probe timeout 뒤 Retry가 failed 분기에서만 동작해 무반응이었다. dialog guard 해제 후 새 probe를 예약하고 문서 재로드 없이 재검사한다. 이전 ID는 종료 증거가 아니다.
- `desktopRuntime.test.mjs` RED→GREEN·runtime28/28/desktop75/75·독립 재검토 통과. 실제 Windows/웹 완료 흐름 수용은 별도로 기록한다.

## Windows renderer 인증 저장·부팅 오류

- 네이티브 암호화와 별개로 티켓 교환한 웹 SDK가 refresh credential을 localStorage에 저장할 수 있었다. SDK 생성 전에 desktop만 메모리 전용 옵션을 선택하고 정확한 legacy auth key 하나를 정리한다. 일반 웹/Android·다른 학습/설정 키는 보존한다.
- 정리 실패를 모듈 초기화에서 throw하면 React 오류 UI도 mount되지 않았다. 빈 메모리 client만 구성하고 gate의 정리 latch로 native/SDK 인증을 막으며 오류/명시 재시도·unknown/pending probe를 제공한다. 성공한 재시도만 해제한다.
- 실제 main+설치 SDK 번들 RED→GREEN·최종 집중41/41·독립 재검토 I1/N1 해결. 실제 계정/Windows 암호화 수용과는 구분한다.

## Windows 종료와 설정 저장·카메라 준비

- 시간대 등 저장이 기존 busy flag 밖에서 실행되어 종료 probe가 idle을 반환할 수 있었다. desktop 전용 동기 pending counter를 시간대/태그/알림 저장의 첫 await 전과 finally에 연결해 겹침/실패도 보존한다. 기존 서버 경로/Android snapshot은 불변이다.
- 카메라 동의 취소 뒤 기존 tracker의 preparing latch가 남는 경우, 완료된 취소·세션/카메라/실제 commit 없음일 때만 기존 observe로 정리한다. unresolved write/storage는 unknown으로 남기며 camera-only 종료는 기존 stop→신선한 idle 증거를 요구한다.
- mounted 실제 Chrome의 같은 turn 저장/겹침/실패/카메라 취소 회귀와 독립 검토 통과. 실제 Windows 숨김/카메라 수용은 별도다.

## Windows 실제 카메라 권한 출처 직렬화

- 실제 Electron45 request는 securityOrigin을 끝 `/`가 있는 URL로 전달했다. raw origin 문자열 비교가 명시 동의 후에도 같은 출처의 video-only 요청을 거부했다.
- runtime에서 root-only URL 형태를 검증한 뒤 URL.origin으로 비교한다. optional securityOrigin 부재는 API대로 유지하되 제공된 null/빈 값/외부·잘못된 origin은 거부한다. 필수 현재 문서/소유 창/최상위/requestingUrl/영상/명시 동의 조건은 보존한다.
- 실제 입력형 RED3→GREEN3/3, desktop86/86, 독립 검토와 실제 Electron 권한·6분 모의 영상 포함4/4 통과. Task1 정책·제품 CSS는 수정하지 않았다.

## 가상 JS clock과 CSS 전환 색상 검사

- page.clock.runFor(200) 후에도 compositor 색상 전환 시간이0/16ms여서 enabled 버튼을 disabled 회색으로 읽는 기존 검사 실패를 재현했다. 전환 endpoint는 정상 녹색이었다.
- 해당 최종 색상/대비 검사에만 reduced-motion 조건을 주고 기존 구분·AA assertion을 유지했다. 제품 CSS/다른 테스트 clock·학습 로직은 변경하지 않았다. 집중2/2·최종 Chrome1396/1396 통과.

## Windows 암호화 불가 후 이전 계정 복원

- SDK 초기화는 읽을 수 없는 session을 null로 보지만 이전 ciphertext를 삭제하지 않는다. fallback 메모리 계정 B가 성공한 뒤 secure 재실행하면 옛 A가 복원되는 실제 SDK 합성 회귀를 재현했다.
- auth 초기화와 새 insecure 전환 후 명시 인증 전에 SDK local sign-out으로 SDK credential만 정리한다. null identity를 먼저 알리고 실패 시 진행을 막으며 정상 secure session/native pending·logout barrier는 보존한다.
- 실제 SDK+합성 HTTP/AES 회귀8/8·desktop94/94. 실제 Windows DPAPI 실패를 강제하거나 기존 계정/학습을 초기화하지 않는다. 해당 native 세션 local logout과 global/다른 기기 logout을 구분한다.

## Windows 자동 로그인 갱신의 중복 rejection

- pinned SDK는 refresh 저장의 일반 Error를 내부 deferred에서도 reject해 primary catch와 별도 미처리 rejection을 만들었다. 실제 자동 tick 합성 검사로 재현했다.
- SDK 전용 storage만 공개 AuthRetryableFetchError로 실패를 전달하고 native storageFailed가 identity 무효화·refresh 정지·단일 local cleanup을 소유한다. 성공을 위장하거나 전역 rejection handler/SDK 내부 patch를 넣지 않는다. 명시적 메모리 로그인 성공 후 refresh를 재개한다.
- 공개 SDK 자동 refresh 검사와 실제 Electron 동일 PID/문서·복구 안내가 통과했다. test fixture는 미처리 rejection이면 exit91이므로 무시하는 검사가 아니다. 실제 서비스/Windows 암호화를 고장내지 않았다.
- R1 원인/해결: verifyCode 저장 실패의 storageFailed 정리와 stale 보상 정리가 중복되고 timeout 뒤 늦은 logout이 새 로그인을 해제했다. active auth별 raw settle 후 단일 cleanup promise를 소유하고, rawlogout Set이 실제 종료 전 새SDKmutation을 차단한다. 실패는 failclosed, 먼저 끝난 logout 뒤 늦은 인증의 최종보상 정리는 보존한다. 10/26 actualSDK RED2!==1→집중7/7·전체116/116·독립검토ADDRESSED, r1-approved-review.md. timeout은SDK종료가아니다.

## Windows 팀·피드 저장 중 종료와 Tray 복구

- child-local pending만 사용한 팀/피드 저장은 Dashboard probe에서 idle로 보였다. 문서/window pending owner를 첫 await 전에 획득해 탭/계정 부모 unmount 뒤에도 finally까지 보존하며 로그아웃 probe에도 합친다.
- Tray 생성 실패는 창만 남겨 설명/종료가 없었다. 복구 경고·재시도·기존 requestQuit fallback을 추가했고 X는 계속 안전하게 창을 유지한다. fresh tray에 로컬 카메라 상태를 표시한다.
- 실제 mounted 같은-turn/겹침/실패/unmount와 Electron 실패 Tray·같은 문서·안전 종료/취소를 검증했다. bounds/첫 안내는 별도 shell 설정이며 기존 학습/Android 정책과 무관하다.

## Chrome handler 조회 정상 대조와 재시작 관측

- 증상: 실제 Chrome은 handler없음이지만 Windows RegOpenKeyEx/RegQueryValueEx·AssocQueryString은 두 앱 모두 성공한다. 원인은 아직 미확정이다.
- 권한 대조: 두 key root/open-command owner/DACL/상속/무결성 라벨 동일. Chrome/진단 모두 medium/x64·가상화/AppContainer0으로 권한 차이의 근거가 없었다. 설정을 낮추지 않는다.
- 초기 재시작 보고 때 root PID26400이 유지됐지만 이후 직접 restart로 PID43188/10:19:30UTC 교체를 확인했다. 새 로그인10:21:06에도 callback0/로딩 지속이라 재시작 해결 가설은 효과 없었다. 재시작/재설치를 반복하거나 캐시 원인을 단정하지 않는다. Chrome 실제 registry 조회의 제한된 공식 도구 추적은 별도 승인 후 수행한다.
- Opus의 통합검사 등록 덮어쓰기 주장은 fixture가 main을 import만 하고 require.main guard로 bootstrap을 실행하지 않아 반증됐다. 일반 dev start와 테스트를 혼동해 불필요한 패치를 만들지 않는다.
- 관리자 도구의 Sky 입력이 반영되지 않을 때 helper 권한/직접UIAutomation/보안 변경으로 우회하지 않는다. 승인된 Process Monitor는 NoConnect/PagingFile·실제 capture disabled를 확인하고 사용자 직접 필터를 설정한 뒤에만 수집한다.
- 제한 Procmon에서는 실제 Chrome RegOpenKey12개가 모두 NAME NOT FOU...였다. 정확 요청 경로는 Event탭으로 확인하고 화면상 철자 추정이나 잘린 Result만으로 alias/권한 변경을 만들지 않는다. 같은시각 flow referrer/s256/발급 집계는 최종302 Location의 직접 관측과 구분한다.
- 근거/후속: docs/verification/2026-10-27-opus-handler-review.md 및2026-10-27-procmon-handler.md. 실제 Chrome→설치앱 로그인 수용과 학습 기록 보존을 유지한다.

## Windows 이메일 코드 요청이 일반 오류로만 표시됨

- 증상: '코드 받기' 실패가 AUTH_FAILED→일반 안내로만 보였다. 최근 운영 auth 집계에 이메일 한도429가 있지만 특정 사용자 요청의 원인으로 단정하지 않는다.
- 원인/수정: desktopAuth가 SDK 오류를 모두 숨겨 분류도 잃었다. 고정 이메일 한도/요청 제한/통신 실패 코드만 허용하고 runtime/Web의 기존 재요청 대기와 연결했다. raw 공급자 오류/개인정보는 여전히 숨긴다.
- 검증: native sendCode/IPC/web 대기 안내 RED→GREEN, unknown 오류 은닉·기존 auth119/119 유지. Google 계정 선택 화면 정지는 별도 미해결이며 Chrome 지원/인증 저장을 초기화하지 않는다.

## HIG 회고 외곽만 통일되고 내부에 옛 디자인이 남음

- 원인: appTheme.css가 실제 .reflection-inbox 외곽만 덮어써서 내부 item/stamp/button의 styles.css 점선·우표·입체 그림자가 남았다. 일부 .reflection-inbox-card 선택자는 실제 컴포넌트 이름과도 달랐다.
- 해결: 실제 컴포넌트 자식에 공통 구분선/색/보조 버튼/초점을 연결하고 중복 영문·장식을 줄였다. 인접 리포트 입력/비활성/빈 상태도 같은 토큰을 사용한다. 서버·회고 저장 콜백은 불변이다.
- 예방: 실제 React/CSS 순서의 Chrome 검사에서 기본/hover 그림자, 구분선,375/1440·글자200%·대비4.5·44px·키보드를 확인한다. 패널 외곽 검사만으로 전체 통일을 주장하지 않는다. docs/verification/2026-10-28-ui-unification.md.

## HIG 전환 시 메뉴 높이·초기 배경·색상 계약 불일치

- 원인: 가로 메뉴 링크의 height100%가 세로 레일에서 전체 높이로 늘었고, 옛 첫 paint/다크 fallback·native 팔레트가 새 의미 토큰과 달랐다.
- 수정/예방: 링크 height:auto·조작/뷰포트 검사, index/base/dark와 mobilePalette를 공통 토큰에 일치. 기존 cream 값 단정 검사는 렌더된 의미 토큰/네이티브 공통 팔레트 계약으로 바꿨다. 실제375/1440/다크 검사를 함께 수행한다.

## Electron 검사 일부가 실행 파일 override를 무시함

- 증상/원인: 실제 integration14개는 통과했지만 final-fixes2개는 Process failed to launch. 이 파일만 존재하지 않는 로컬 node_modules 바이너리를 고정하여 공식 STUDY_ROOM_ELECTRON_EXECUTABLE을 무시했다.
- 수정: 다른 integration/runner와 같은 환경 변수 우선 경로를 사용한다. 테스트 설정만 고쳤으며 제품 Electron/권한/SDK/사용자 프로필은 변경하지 않는다. 재실행 결과는 HIG 검증 문서에 기록한다.

## Google 계정 선택의 로딩과 Windows 복귀를 구분

- 실제0.1.1에서도 Google busy/progress가 유지되고 앱은 로그인 대기 만료였다. URI handler 등록/공개 도메인 응답은 정상이어도 실제 콜백 전달 성공을 뜻하지 않는다.
- 같은 시각 Google login302가 있어도 callback referer 분류가 web이면 같은 native 요청 완료라고 단정하지 않는다. 계정/토큰/전체 OAuth URL 대신 고정 경로·시간·상태만 대조한다.
- Google 탭 새로고침으로 busy가 풀렸지만 인증 성공이 아니다. 원인 미확정 상태에서 쿠키/확장/보안 설정을 초기화하거나 재설치 반복으로 해결을 주장하지 않는다. HTTPS 명시적 복귀 비교는 계약 변경 승인 후 수행한다.
- 근거/다음: docs/verification/2026-10-27-google-return.md. 기존 기록/네이티브 PKCE/암호화 저장 보존.
- 추가 근거: auth.flow_state의 민감 값 없이 집계한 native flow2건은 정확 복귀 주소/s256/코드 발급 완료였다. callback302 뒤 token 요청 없음·실제 pending 유지로 인증 이후/교환 이전까지 좁혔다. Chrome 전달과 앱 수신 거부를 혼동하지 않는다. ProcessStartTrace 권한 거부는 성공 증거가 아니다.
- 사용자가 정상 Study Notes를 비교한 첨부를 잘못된 요청 혼동으로 해석한 것은 오류였다. 프로젝트 주소 차이는 정상 비교이며 이 해석은 철회한다. 최신 앱 provider 단계/서버 발급/OS 대조를 같은 시각에 묶어 확인하고 전체 URL/state/코드/계정은 기록하지 않는다.
- 사용자 요청의 Claude Code Opus5.5 읽기 전용 검토는 정상 네트워크에서 성공했다. sandbox ENOTFOUND를 모델 미지원으로 단정하거나 권한 우회로 해결하지 않는다. 설치 앱 새 요청 시각/provider 단계/브라우저 callback host를 묶어 수용한다.
- 새0.1.2 실제 Google 발급 후 callback0, OS ShellExecute 수신 통과/Chrome 직접 링크 수신0으로 구간을 분리했다. prompt 차이·하이픈·저장된 브라우저 차단을 증거 없이 원인으로 쓰지 않는다. 승인한 Default/공통 protocol_handler 두 항목 없음도 Chrome live 거부 부재의 증명이 아니다.
