# Progress

| 기능 | 상태 | 현재 근거 / 다음 단계 |
|---|---|---|
| Android 유휴 lifecycle·오래된 회고 안내 | 검증 완료·웹 수정 배포 전 | 설치0.2.4/code7 같은계정·실제탭콘텐츠·HOME/COLD/Android설정복귀·18초offline→정상poll복구 PASS, 카메라사용불변/추가인증0. 최신빈회고선택·즉시반영 RED4→집중5/5·Chrome1348/1348·verify/독립검토Critical/Important0. 새공부/담당전환은10/19회복잠금 유지해보류·실휴대폰DND/물리착석별도. docs/cross-device-study/mobile-lifecycle-20261019.md |
| 공부 상태 보존 화면 복구 | 운영 배포·실제 수용 완료(범위 한정) | 영역 격리·유휴 명시reload·필수회고 eager, 집중10/10·Chrome1343/1343·verify/독립검토PASS.225fd82/Actions39148327299·production READY/200. Android16 실제HTML200 실패→복구·COLD로그인/학습보존, PC설정/오늘 정상. APK0.2.4 그대로·DB변경없음·전용rollback branch보존. docs/safe-section-recovery-20261019.md |
| 동일 계정 다중 기기 공부·카메라 상태 | 운영 배포 완료·동일계정 실기기 수용 보류 | 영상 제외·단일 담당/generation·관찰 카메라/경고/자동종료 차단. Chrome1326/1326·verify·독립검토PASS. remote20261018100359/Edge24·학습13테이블 동일.2cc16ae/Actions39124089277·READY/exactSHA/HTTP200. Android 현재로그인화면·사용자 재로그인 추후 선택, 실제 동기화·5분 Slack은 미검증. docs/cross-device-study/acceptance.md |
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
