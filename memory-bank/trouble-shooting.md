# Troubleshooting

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
