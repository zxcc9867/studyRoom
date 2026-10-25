# main 최신 통합·시간 저장 복구 출시 — 2026-10-25

## 범위와 실제 기준

- 사용자: 최신 개선 진행 승인, 실제 Android/OEM 검증은 나중에 수행하기로 선택.
- 저장소 `https://github.com/zxcc9867/studyRoom`, 통합 checkout `C:/jini-dev/studyRoom`, 대상 `main`.
- 시작 `f363eca97360d4b979e24e62bfd9da341b60e370` → 운영 branch의 24개 커밋을 `ea6c56e0e1f7fa43ecffed12e5aeeeaeca9fe5e8`까지 fast-forward.
- 복구 코드 `f9439ab`: UPDATE/확인 SELECT 각15초, 서버 재조회·읽기 전용 다시 확인·명시 재저장·초안 보존·확인 중 닫기·계정/늦은 응답 격리. [상세](../session-todo-time-edit/timeout-recovery-20261025.md).
- README/QA `e8a7885`: 3언어와 실제 React/로컬 합성 데이터 화면7장. [촬영 기록](../readme-update-20261025.md), [실기기·팀 수용 현황](device-team-readiness-20261025.md).
- 서버/DB/정책/Edge/APK 변경은 없다. 실제 사용자 세션·팀·외부 알림·로컬 실모델 호출은 생성하지 않았다. 기존 배포 workflow의 무료 합성 AI smoke는 그대로 유지한다.
- 사용자 선행 DUNE 문서7개는 byte 백업·stash `296811916fdc380daec14955e7b3446364981bd3`로 보존했다. 이전 전체 active/progress를 최신 문서 위에 덮어쓰지 않고 원래 추가분을 복원한다. untracked DUNE/output 파일은 이번 커밋에서 제외한다. 공용 환경 watcher 실행 없음.

## 분담·검증 경계

- 프론트엔드: 별도 `codex/session-todo-time-recovery-20261025` worktree에서 RED 재현→구현→실제 Chrome 집중14/14(실패/생략0), 강화 취소·재진입·닫기1/1, 웹 빌드 통과.
- UX/문서: 별도 `codex/readme-current-20261025` worktree에서 실제 UI 1440/375 캡처·저장/선택 보존·무응답 재확인 쓰기0·가로 넘침0·pageerror0 확인. 개인정보 없는 fixture 사용.
- QA: 팀 SQL/controller/helper 좁은60/60(실패/생략0). 실제 두 로그인/Realtime/Android/OEM/다중 PostgreSQL 수용을 대신하지 않는다.
- 독립 리뷰: recovery diff의 소유자 필터·기한·중단·상태와 늦은 응답 검사에서 차단할 결함 없음. 추가 문서 검토에서도 팀 계약·3언어·현재 무료 모델/라우터·1024/2048 토큰 구분·실기기 미실행 표현·촬영 스크립트에 차단할 오류 없음. 리뷰는 읽기 전용이며 실행 검증은 메인 결과와 구분한다.

## 최종 통합 검증

- 실제 Chrome를 활성화한 전체 고정 입력 스위트: **1,347 PASS / 0 FAIL / 0 SKIP / 0 CANCEL**, 1,729,927ms, 종료 코드0. 실행 명령은 기존 `dune.config.json`의 Node test globs와 `--test-concurrency=1`이다. 기존 기록의 과거 집계값을 복사하지 않고 이번 실행의 실제 집계를 기록한다.
- 별도 `npm.cmd run test:edge`: Edge 진입점 타입 검사와 **23 PASS / 0 FAIL**, 종료 코드0. 실제 제공자/운영 DB 호출은 하지 않았다.
- `mobile:check`: 호환성·Expo/mobile TypeScript 통과(20.4초). `docs:check`: 3언어 이미지 참조 **45건 통과**(1.86초). 통합 문서 로컬 링크172개 누락0.
- 웹 `build`: TypeScript/Vite 통과(31.89초, 1,741 modules). source 변경 후 전체 검증을 반복하지 않았으며 이후 변경은 문서·수용 기록뿐이다.
- DUNE `--verify --json`: **passed**, 287 source files / 589 edges / 새 위반0 / baseline0 / stale0, 구성된5개 검증 종료 코드 모두0. `tech-feed-core.mjs`의 computed module target 수동 검토 경고1개는 시작 baseline과 동일하며 새 위반으로 숨기거나 예외를 추가하지 않았다. DUNE 도구 자체는 기존 사용자 untracked 파일로 보존해 이번 배포 커밋에 넣지 않는다.
- 원본 DUNE checker·설정·판정 기준은 바꾸지 않았다. 기본적으로 버려지는 하위 명령 stdout/stderr만 로컬 wrapper로 보존했다(`output/verification-20261025/`). 구조/구문 검증과 실제 사용자 수용은 구분한다.

## 원격 출시

미실행. 검증 후 normal main push·Actions 성공·동일 SHA의 Vercel production READY·공개 URL/JavaScript 응답을 확인하여 갱신한다. 이전 기준은 제품 `7133dc4`, Actions `40090165734`, `dpl_41HSC42E3A4zReiEoiuJdWmx1w6T`이며 새 배포의 증거로 사용하지 않는다.

## 후속

사용자 선택에 따라 명시 카메라 담당 이전·Android 신규 담당·6분 실제 자세·장시간 활성 background/offline·물리 휴대폰 OEM/DND·두 정식 계정·실제 PostgreSQL 다중 연결을 나중에 검증한다. 기본 PC↔Android·유휴 lifecycle의 10/19 실제 PASS는 유지한다.
