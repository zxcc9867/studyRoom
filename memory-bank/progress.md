# Progress

| 기능 | 상태 | 현재 근거 / 다음 단계 |
|---|---|---|
| 개인 공부·실제 시간 배분·휴식·회복·04시 공부일 | 기존 운영 기능 유지 | 이번 팀 기능이 정책/기록을 변경하지 않음. 이전 검증은 보관본 각 최신 항목 참고 |
| 웹·Android 공통 UI·설정·계정 동기화 | 기존 운영 연결 | hosted WebView 공통 화면. 실휴대폰 OEM/DND E2E는 별도 미확인 항목 유지 |
| APK 내부 업데이트·고정 공개 링크 | 기존 운영 연결 |0.2.4/code7·기기 단위 설치 제한·변경 요약. 이번 native 변경 없음 |
| 기술 피드 한국어 번역·요약 재시도·Markdown 표시 | 기존 운영 연결 | 무료 Developer 한도·월45만 유지. 본문 기호 개선 운영2782dda, main통합 f363eca |
| 카메라 없는 팀 공부 목업 | 설계 승인 | 개인 기본 진입·팀 책상·집중 시간 제안·숲 단일 탭. 기존 별도 작업 공간 목업 보존 |
| 등록 계정 전용 팀·링크/공개 태그 초대 | 구현·DB 운영 적용 | 추가 migration remote20261012235920 권한/auth audit 완료, 웹 배포 대기 |
| 팀원 서버 상태·선택적 제목 공유 | 로컬 구현·검증 완료 | 개인 세션 status/pause/lease가 권위. 연결 끊김을 자리비움/회복으로 처리하지 않음 |
| 공동25/50분 집중·인정 시간 팀 숲 | 로컬 구현·검증 완료 | 기존 공식 콜백·checkpoint·종료 후 정산, 중복/휴식/제외 실제 SQL75/75 |
| 신규 팀 화면 실사용 검증 | 부분 | 실제 React/Chrome375·1440 집중22/22,44px·200%·대표 대비 최소5.7066:1. 최종 전체 Chrome1205/1205. 실제 2계정·Android16 별도·adb 연결0 |
| 팀 운영 배포 | 진행 | 신규 migration만 MCP 적용/audit 완료 → feature branch Actions 배포 → READY/HTTP200 |

## 검증 상태

- 새 worktree 기본 npm.cmd test:1044통과/99선택 브라우저 생략/0실패(1143개). 실제 Chrome 포함 같은 전체 목록 concurrency2 재실행1143/1143·실패0·생략0(183559ms). 아직 새 팀 기능 완료 근거가 아니다.
- 의존성 설치 sandbox npm 실패는 escalation clean install로 성공. lockfile/패키지 버전 변경 없음.
- 최종 fix 후 ai.ps1 verify 통과: Dune0위반, npm test/test:edge/mobile:check/build/docs:check exit0. 전체 실제 Chrome1205/1205·실패0·생략0·289651ms. 팀 집중22/22·helper16/16·기존 카메라/lease6/6. Task1·Task2·최종fix 재검토PASS. 운영 DB 적용/audit 완료; 웹 배포 필요.
- 실기기/배포 검증은 완료 후 갱신한다. Git·DB·APK·production을 확인 없이 완료로 표시하지 않는다.

## 보관

상한을 초과한 이전 상태·날짜별 상세 이력은 [progress202610 보관본](archive/progress-202610.md)에 바이트 동일 보관했다. 최신 운영 통합 근거는 [2026-10-11 GitHub 동기화](verification/2026-10-11-github-sync.md)이며 과거 대기 항목은 이후 완료 기록과 함께 해석한다.
