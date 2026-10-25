# Progress

## 2026-10-25 공부 시작 출석 분리 — 운영 배포 완료

- 사용자 승인된 정책 변경: 공부일 내 시작 → 출석, 하루 목표는 별도 진척. 알림 후 30분·목표 달성 대체 출석을 제거하며, 무시작 결석은 다음 04:00에 판정한다. [PRD](prd-attendance-start.md).
- 별도 worktree 구현·독립 검토 완료. Chrome전체1370/1370·실패/생략0, Edge23/23·모바일/docs/build·DUNE0위반/5게이트 통과. 본인 계정 현재 출석 present/회복pending0, 제출된 회복 이력 보존. 선행RPC remote070303·Cron47/Slack29·정책 remote072758 적용, 원격 권한/RLS·12범위 count/digest 동일 확인. 기능c5eac1e main push·Actions40173077774 success·Vercel dpl_D8rDG15x7gFk2cBz8Riez72o43Jy production READY/exactSHA·HTML/JS200·본인 화면 출석완료/목표50% 동시표시 확인. [검증 기록](../docs/verification/2026-10-25-attendance-start.md).

## 2026-10-25 통합·복구

- `main`에 기존 운영 branch의 24개 커밋(`ea6c56e`까지)과 시간 저장 복구 `f9439ab`, README/QA `e8a7885`를 통합했다. 전체 검증·원격 CI·Vercel 상태는 [통합 출시 기록](../docs/verification/2026-10-25-main-integration.md)을 기준으로 확인한다.
- 무응답 UPDATE/SELECT는 각각15초 제한, 응답 불명확 시 읽기 전용 확인, 명시적 재저장과 초안 보존을 구현했다. 집중 Chrome14/14·전체1347/1347(실패/생략0)·Edge23/23・mobile/docs/build・DUNE0위반/5게이트·독립 코드/문서 검토 통과. README3언어·실제 fixture 화면7장·모델/라우터·현재 제한 정보를 갱신했고 이미지 참조45/로컬 링크172 누락0을 확인했다.
- 실기기 검증은 사용자 선택으로 후속 진행한다. 기존 실제 기본 동기화 PASS와 이번 로컬 fixture 검증을 구분한다. 운영 DB·APK·무료 AI 설정은 변경하지 않는다.

| 기능 | 상태 | 현재 근거 / 다음 단계 |
|---|---|---|
| 세션 할 일 시간 재편집 | 운영 배포·수용 완료 | 해당 발생분 시간2필드만 수정·제목/반복/선택/기존학습 보존. Chrome1357/1357·hover포함집중8/8·verify/독립재검토 통과. 7133dc4/Actions40090165734 success·Vercel READY/exactSHA/HTTP200. Android16/0.2.4 실제운영저장·취소·재로드수용, 테스트항목정리·기존5종count/digest동일. docs/session-todo-time-edit/verification-20261024.md |
| Android 유휴 lifecycle·오래된 회고 안내 | 운영 배포·실제 수용 완료(범위 한정) | 설치0.2.4/code7 같은계정·탭콘텐츠·HOME/COLD/Android설정복귀·18초offline복귀 PASS·카메라사용불변. 최신빈회고선택 RED4→집중5/5·Chrome1348/1348·verify/독립검토차단결함0.3312ad0/Actions39271816694 success·production READY/200·실제PC/Android옛안내없음·기존4종digest동일. 새공부/담당전환은회복잠금유지해보류·실폰DND/착석별도. docs/cross-device-study/mobile-lifecycle-20261019.md |
| 공부 상태 보존 화면 복구 | 운영 배포·실제 수용 완료(범위 한정) | 영역 격리·유휴 명시reload·필수회고 eager, 집중10/10·Chrome1343/1343·verify/독립검토PASS.225fd82/Actions39148327299·production READY/200. Android16 실제HTML200 실패→복구·COLD로그인/학습보존, PC설정/오늘 정상. APK0.2.4 그대로·DB변경없음·전용rollback branch보존. docs/safe-section-recovery-20261019.md |
| 동일 계정 다중 기기 공부·카메라 상태 | 운영 배포·기본 실제 동기화 수용 완료, 확장 수용 후속 | 10/19 같은 계정 PC 시작→Android 관찰·양방향 휴식/재개·원격 종료/완료·COLD 로그인 PASS. 단일 담당/영상 비전송 유지. 담당 이전·Android 신규 담당·장시간 활성 배경·물리 자세/DND는 미실행. 이전 로그인 보류를 현재 전체 미검증으로 해석하지 않는다. docs/cross-device-study/labeled-acceptance-20261019.md 및 docs/verification/device-team-readiness-20261025.md |
| 개인 공부·실제 시간 배분·휴식·회복·04시 공부일 | 기존 운영 기능 유지 | 이번 팀 기능이 정책/기록을 변경하지 않음. 이전 검증은 보관본 각 최신 항목 참고 |
| 웹·Android 공통 UI·설정·계정 동기화 | 기존 운영 연결 | hosted WebView 공통 화면. 실휴대폰 OEM/DND E2E는 별도 미확인 항목 유지 |
| APK 내부 업데이트·고정 공개 링크 | 기존 운영 연결 |0.2.4/code7·기기 단위 설치 제한·변경 요약. 이번 native 변경 없음 |
| 기술 피드 한국어 번역·요약 재시도·Markdown 표시 | 기존 운영 연결 | 무료 Developer 한도·월45만 유지. 본문 기호 개선 운영2782dda, main통합 f363eca |
| 카메라 없는 팀 공부 목업 | 설계 승인 | 개인 기본 진입·팀 책상·집중 시간 제안·숲 단일 탭. 기존 별도 작업 공간 목업 보존 |
| 개인/팀 진입·공개 태그 설정 분리 | 운영 배포 완료 | 개인 기본은 팀 RPC 선행 없음. 내 공부/팀 공부 탭, 팀 없음 생성/받은 초대, 설정 계정에서만 태그 편집.0165b38·최종 Chrome1210/1210·팀27/27·독립 검토PASS |
| 등록 계정 전용 팀·링크/공개 태그 초대 | 운영 배포 완료 | migration remote20261012235920·권한/auth audit·제품b9ab3ec·공개 로그인/취소 확인 |
| 팀원 서버 상태·선택적 제목 공유 | 운영 배포 완료·실계정 수용 대기 | 개인 세션 status/pause/lease가 권위. 연결 끊김을 자리비움/회복으로 처리하지 않음 |
| 회원 개인 공부 자동 기여·간결한 목표·탈퇴 모달 | 운영 배포 완료·실계정 수용 대기 | local20261015035420→remote20261015041209 권한 감사. 자동 SQL13/13·전체 Chrome1237/1237. Dune/5명령·독립 재검토PASS.616f38c·Actions38680437289·production READY/HTTP200 |
| 함께 집중 무제한/직접 시간·인정 시간 팀 숲 | 운영 배포 완료·실계정 수용 대기 | 제한 없음/1~1440분·25/50 빠른 선택. 종료 알림만, 공부/팀 유지. local20261013081052→remote20261013084053. 기존 checkpoint/정산 불변 |
| 오늘 공부 종료와 영구 팀 관리 분리·팀 목표 | 운영 배포 완료·실계정 수용 대기 | 개인 종료는 멤버/숲 유지. 목표 새 저장 즉시 공유·과거 비공개 유지, 현재 제목 opt-in. 탈퇴 모달에서 일반 탈퇴·팀장 위임/해산. 팀장 배지 |
| 신규 팀 화면 실사용 검증 | 부분 | 실제 React/Chrome375·1440·키보드·44px·AA 대비. 최종 전체 Chrome1237/1237. 실제2계정·Android16·PostgreSQL 동시 연결 수용 별도 |
| 팀 운영 배포 | 완료 | 현재616f38c/Actions38680437289 success/Vercel dpl_2BFELdQyR6kYZeF1X95C4E8pAaN4 READY·exactSHA·HTTP200. DB 감사/공개 Chrome 새 chunk 확인·native 불변 |

## 검증 상태

- 새 worktree 기본 npm.cmd test:1044통과/99선택 브라우저 생략/0실패(1143개). 실제 Chrome 포함 같은 전체 목록 concurrency2 재실행1143/1143·실패0·생략0(183559ms). 아직 새 팀 기능 완료 근거가 아니다.
- 의존성 설치 sandbox npm 실패는 escalation clean install로 성공. lockfile/패키지 버전 변경 없음.
- 선행 팀 기능 검증(2026-10-15): ai.ps1 verify Dune0위반, npm test/test:edge/mobile:check/build/docs:check exit0. 당시 전체 실제 Chrome1220/1220·실패0·생략0·199276ms. 팀30/30·신규 SQL/controller/helper45/45·기존 카메라/lease 검사 유지. 독립 재검토PASS. 운영 추가 DB 권한/함수/제약 감사·웹 출시 완료.
- 운영 공개 Chrome375/1440 HTTP200·초대 로그인 필요·명시적 취소·새 집중/목표/종료 UI chunk HTTP200 확인. 새 deployment 출시 직후 error/fatal 그룹 조회 행 없음은 장시간 수용과 구분. 실계정 저장/팀 변경은 하지 않음. 실제2계정 Realtime/Android16/동시PostgreSQL 검증은 미확인. native/APK 변경 없음. 이전 추가 Jev 전송은 정책 차단으로 결과 없음.

## 보관

상한을 초과한 이전 상태·날짜별 상세 이력은 [progress202610 보관본](archive/progress-202610.md)에 바이트 동일 보관했다. 최신 운영 통합 근거는 [2026-10-11 GitHub 동기화](verification/2026-10-11-github-sync.md)이며 과거 대기 항목은 이후 완료 기록과 함께 해석한다.
