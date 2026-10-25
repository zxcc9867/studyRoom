# Active Context

## 현재 작업: 최신 main 통합·시간 저장 무응답 복구

- 갱신: 2026-10-25 · 도구 Codex · checkout `C:/jini-dev/studyRoom` · 브랜치 `main`.
- 사용자 승인: 최신 작업 확인 후 제안한 main 통합, 시간 저장 복구, 수용 상태 정리, 실제 화면 README 갱신과 웹 배포 진행. 실기기 검증은 사용자가 **나중에 진행**하기로 선택했다.
- 통합: `f363eca` 이후 `origin/fix/mobile-camera-lifecycle`의 24개 커밋을 `ea6c56e`까지 fast-forward했다. 팀 공부·단일 카메라 담당·영역 복구·최신 회고·시간 편집을 보존한다. 이번 복구 구현 `f9439ab`, README·QA 문서 `e8a7885`를 통합했다.
- 수정: 시간 UPDATE와 소유자 확인 SELECT를 각각 기존 15초 제한으로 실행한다. 응답 불명확 시 조회하며, 저장 일치면 추가 쓰기 없이 성공·다른 값이면 명시적 다시 저장·미확인이면 읽기 전용 다시 확인을 제공한다. 초안·불명확 상태를 현재 문서/계정에서 보존하고 확인 중 취소·닫기와 늦은 응답 차단을 검증했다.
- 분담/검증: 별도 worktree에서 프론트엔드 구현, UX/README·실제 fixture 화면7장, QA 수용표를 작성했다. 코드·문서 독립 검토에서 차단 결함 없음. 집중 Chrome14/14, 통합 전체 **1347/1347·실패/생략0**, Edge23/23·mobile/docs/build·DUNE0위반/5게이트 통과. 이미지 참조45·로컬 링크172 누락0. 원격 배포 결과는 [출시 검증 기록](../docs/verification/2026-10-25-main-integration.md)에 남긴다.
- 범위: DB/Edge/native/APK·무료 AI 정책 변경 없음. 실제 계정·팀·학습·외부 알림·실모델 로컬 호출 없음. 기존 DUNE 미커밋 변경은 별도 백업 후 복원하며 이번 커밋에서 제외한다. 공용 환경 watcher를 실행하지 않는다.
- 수용: 10/19 기본 PC↔Android·유휴 HOME/COLD/18초 단절 PASS를 유지한다. 담당 이전·Android 신규 담당·장시간 활성 배경·실휴대폰 OEM/DND·두 정식 계정·실제 PostgreSQL 경합은 후속이다. [QA 현황](../docs/verification/device-team-readiness-20261025.md).

## 현재 우선 요청: 세션 할 일 시간 편집
- 갱신: 2026-10-24 20:35JST · 도구codex · fix/mobile-camera-lifecycle·배포코드7133dc4·선행미커밋보존. 사용자 시간편집/기록보존/웹·앱검증/배포 승인.
- 완료: main.tsx/CSS에 시간편집·기존값·저장/취소. 해당 발생분 시간2필드만 소유자 DataAPI/RLS 갱신. 반복/제목/선택/기존공부 보존·실패재시도·계정전환차단·저장중시작/닫기/중복잠금·포커스복귀. PRD/트러블슈팅/검증문서 갱신.
- 검증: RED버튼누락/삭제경합/저장포커스/hover대비→집중8/8, Chrome전체1357/1357, 최종verify/Dune 통과·독립재검토 차단결함0. 기존피드날짜고정테스트만 상대날짜로 수정23/23. 운영SQL/정책/APK변경없음.
- Android16: 실제설치0.2.4/code7 격리fixture와 운영저장/취소/재로드 모두수용. [테스트]단일할일만생성/정리·세션미시작. 기존5종(할일285/계획285/세션171/구간351/회고17)count/digest동일·카메라off복귀. 물리착석판정 수용은 별도.
- 배포: fccaff6/7133dc4 기능branchpush, 최종Actions40090165734 success·dpl_41HSC42E3A4zReiEoiuJdWmx1w6T READY/exactSHA·production HTTP200/자산확인. 첫Actions취소에도비동기READY였으며최종배포로교체됨.
- 다음: 이번요청완료·웹새로고침/앱재실행으로진입. 별도 Windows 설계는 사용자선택대기. 선행운영변경·archive·다른세션기록을임의stage하지않는다. 근거 docs/session-todo-time-edit/verification-20261024.md.


<!-- mobile-lifecycle-acceptance:start -->
- 갱신: 2026-10-19 23:51 · 도구codex · 브랜치fix/mobile-camera-lifecycle · 제품3312ad089d5eb97b3b41eba6fc7c5f2ab22ccbde commit/push/운영배포 완료. 선행 미커밋ops/수용 변경과rollback ref 보존.
- 목표/현재: 남은 직접검증 우선·학습기록 보존. PC/앱 같은계정·active0·10/19 회복pending1. 사용자가 ‘다른 검사부터 진행’ 선택, 회복 대리제출/우회·새공부 생성 없음.
- 완료: Android16/설치0.2.4/code7 로그인복원·HOME복귀·COLD재실행·피드20글/숲canvas/목표/설정 실제콘텐츠·네이티브권한패널→Android설정→복귀 정상. 카메라AppOps1분18.729초 불변, 추가인증0. WebView만18초offline 실제snapshot실패1→복구8.4초후정상poll1·리로드/재로그인없음.
- 수정: dashboardData의non-null다음행동필터 때문에 오래된장고제안부활 재현. 최신빈회고도선택·새빈회고저장즉시반영, 과거회고삭제/DB/native변경없음. 단위RED1→2/2·mountedRED3→3/3·Chrome1348/1348 실패/생략0·verify Dune0/5명령exit0·독립검토Critical/Important0. docs/cross-device-study/mobile-lifecycle-20261019.md.
- 출시/보존: Actions39271816694 success·Vercel dpl_D82nR19hn1SY6iymQBcTJSDHtcgq production READY/exactSHA/project/ref·HTTP200/index-C57JTt4A.js JavaScript200. 실제Android14:49:47/PC14:50 새entry·장고안내없음·회복잠금/로그인/3/3유지·추가카메라없음.14:50:15 기존완료153/할일274/회고13/회복77 count+digest동일. 이번새학습행0·APK재설치불필요.
- 다음: 앱신규카메라담당/명시전환은 본인회복제출후. 평소자세6분/실휴대폰DND/장시간활성배경은 별도미검증. 에뮬레이터알림/DND접근미허용·임의변경없음. 보존된선행ops/수용diff는이번commit에포함하지않음.
<!-- mobile-lifecycle-acceptance:end -->

<!-- safe-section-recovery:start -->
- 갱신: 2026-10-19 02:17 · 도구codex · 브랜치 fix/study-room-update-recovery · 제품225fd82310b95de5827afd4abb90ac094f3668c5 commit/push/운영 배포 완료. 이전 feat/team-study-room 보존·선행 미커밋 ops/수용 변경 보존.
- 목표: 위임받은 후속 개선으로 실제 stale chunk 전체 빈화면을 우선. 영역 단위 오류 격리·오늘 복귀·명시 유휴 reload, 공부/휴식/학습조회/기존 Dashboard 저장 중 reload 차단. 필수 종료/회고는 eager import, 정상 회고·학습 정책/DB/native 불변.
- 구현: RecoverableSection·CSS, main.tsx의8곳 보호(선택 lazy6종/필수 회고2경로). PRD prd-safe-section-recovery.md. 최초 RED3·종료필수 RED1·저장중 guard RED1 후 집중10/10, 독립 재검토 결함없음. 옛 lazy 회고 고정 문자열 검사는 실제 종료창 수용 검사로 대체했다.
- 검증/출시: 집중10/10·최종Chrome1343/1343 실패/생략0·verify Dune0/5명령exit0·독립재검토 차단결함없음. Actions39148327299 success·Vercel dpl_6V7zDuYn3EKLkwkoPgSW7WjrZ1Yg production READY/exactSHA/project/ref/HTTP200·새 index-DYSG7zV-.js200/JavaScript 확인.
- 실제/다음: Android16 HTML200 실패1건→해당 영역 안내/메뉴유지→유휴 명시reload 정상복구·학습3시간19분/3/5완료 동일, COLD 재실행 로그인/학습 복원·추가카메라사용없음. PC 새entry/설정/오늘 동일표시. docs/safe-section-recovery-20261019.md. 평소자세6분/실휴대폰DND·장시간배경/담당전환·오래된이어서할일 안내는 후속. 이번 수용 새학습기록 생성 없음.
- 롤백: 전용 rollback/study-room-before-recovery-20261019와 기존 feat/team-study-room의 ce7704a 보존(제품 소스는 운영72b5434 동일). 이전 ref로 기존 production workflow 재실행, DB/학습 기록 rollback 없음. 현재 변경은 네이티브/APK 변경 아님.
<!-- safe-section-recovery:end -->

<!-- cross-device-state-sync:start -->
- 갱신: 2026-10-18 20:43 · 도구: codex · 현재 작업: 영상 제외 동일 계정 상태 동기화.
- 브랜치: feat/team-study-room · 제품2cc16ae2e91c9aba71f778b94f1b6ba8c7540d99 커밋·push·운영 배포 완료. 선행 ops·수용 미커밋 파일은 제외해 보존한다.
- 완료: shared snapshot/단일 카메라 담당·generation·관찰 실행 차단·명시 전환, 서버 원자적 warning·legacy suppression·공통 제외값 정규화. 원격20261018100359/Edge v24 ACTIVE·무인증401·학습13테이블 count/content digest 동일.
- 검증: 실제Chrome 전체1326/1326·실패/생략0, verify Dune0/5명령exit0, 서버87/87·helper16/16·독립 서버/웹 재검토PASS. docs/cross-device-study/acceptance.md.
- 출시: Actions39124089277 success·Vercel dpl_3SeFFy37p24zH8SqCAzGdqgYtBaS production READY/project/ref/exactSHA·HTTP200·새index-B0R1KYaX.js200/동기화 코드 확인. DB/Edge/기록 보존은 acceptance.md.
- 다음 단계: 사용자가 PC와 같은 계정으로 Android 로그인 후 실제 담당/관찰 상태·5분 무경고·휴식/재개·전환 수용. 배포후 앱은 native 로그인 화면/WebView 없음 확인, 인증 후 새 hosted웹 수용으로 확대하지 않는다. 재로그인 원인은 미확정.
- 주의: 사용자가 PC와 같은 계정의 에뮬레이터 로그인은 나중에 진행 선택. 실제 동일계정 동기화/5분 Slack 무발송/기기 전환은 미완. 기존PC공부 제어/새로고침·회복 대리제출·영상전송 없음. native/APK0.2.4/code7 불변.
<!-- cross-device-state-sync:end -->

- 갱신: 2026-10-15 · 도구: codex
- 브랜치: feat/team-study-room · 제품616f38c05ccd9f0d620d4ef50963393f9e1d6f91 push/배포 완료. 출시 근거는 문서 후속 커밋에 기록. 기존 .serena/output 보존.
- 목표 / 완료 기준: 회원 개인 공부 자동 팀 집계·목표 저장 즉시 공유·팀장 표시·탈퇴 모달. 기존 개인 라이프사이클 보존·SQL/실제Chrome/전체게이트·독립 검토·DB/웹 배포 확인.
- 완료(운영): 기존 private 연결/실제 공부 구간 재사용. 팀 화면 미마운트에도 시작/재개 자동 반영, 공부 중 가입/생성은 checkpoint부터. 출시 당시 활성 회원도 출시 이후만 집계.
- 완료(운영): 목표 입력/저장만, 새 저장은 공유. 이전 비공개 목표·현재 할 일 제목 opt-in·개인 전체 이력 비공개 유지. 긴 안내/수동 연결 삭제, 팀장 배지, AccessibleDialog 탈퇴/위임/해산.
- 보존: 개인 오늘 기본·전역5메뉴·공개 태그는 설정. 개인 카메라/회복/lease/04시 공부일/출석/DND·실제 인정 시간·종료 회고·회원 유지 불변. native/APK0.2.4/code7 변경 없음.
- 검증: 새 SQL13/13 PASS(초기 red7)·최신04시 시작/preview. 모달4/4(초기 red2), 전체 실제 Chrome1237/1237·실패0·생략0·272313ms. 최종 ai.ps1 verify PASS(Dune0·5명령 exit0). 독립 검토 잠금 역순/가입 경합 보완 후 재검토PASS.
- 서버 보강: INSERT/가입 공통 사용자 advisory, UPDATE에는 적용 금지. 개인 BEFORE 재개 후 AFTER 자동 연결. 시작 신호는 팀 잠금 이후. 사전 잠금 외 세션 발견 시 RETRY와 전체 mutation rollback.
- DB 적용: 추가 local20261015035420→remote20261015041209. 실제 grants/search_path/trigger/guards 감사·계정 없는 요청 거절 확인. advisors 전후 WARN/INFO 건수 불변. 실계정/팀 테스트 데이터 생성 없음.
- 출시 완료: Actions38680437289 success·Vercel dpl_2BFELdQyR6kYZeF1X95C4E8pAaN4 production READY/exactSHA/alias HTTP200. 공개 Chrome375/1440 로그인 필요·초대 취소·새 chunk200/이전 수동 UI 문구 부재. 출시 직후 error/fatal 그룹 행 없음은 단기 근거뿐.
- 다음 단계: 실제 두 정식 계정에서 공부/휴식 상태·목표·팀장 위임과 Android16 수용. 공부 중 가입·재개 경합의 실제 PostgreSQL 다중 연결 부하 검증은 별도. main 직접 수정/머지 없음.
- 미확인: 실제2계정 Realtime·Android16·동시 PostgreSQL 연결 수용. PGlite 역할/인위적 경합·mounted fixture를 실제 수용과 혼동하지 않음.
- 운영 주소: https://study-room-attendance.vercel.app. 이전 배포 Actions38371768257 / dpl_6qvESW5Tjj3io7ZKqH3M4dDhgNuR은 rollback 참고. 서버 자동 정책/새 데이터는 웹 rollback만으로 삭제하지 않음.
- 문서: prd-social-study-room·architecture-map·server-contract·automatic-study-20261015·progress. 6천 줄 troubleshooting은 archive/trouble-shooting-202610.md로 보존하고 요약본 사용.
- 작업 공간: C:/jini-dev/worktrees/study-room-team. owner codex-team-auto-20261015 claim은 작업 종료 시 해제. 다른 worktree/목업 보존. [기존 Active 보관본](archive/active-context-202610.md).
