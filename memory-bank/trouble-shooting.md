# Troubleshooting

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
