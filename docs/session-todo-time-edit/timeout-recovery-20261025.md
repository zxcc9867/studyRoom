# 세션 할 일 시간 저장 무응답 복구 — 2026-10-25

## 원인과 범위

- 기준: `ea6c56e0e1f7fa43ecffed12e5aeeeaeca9fe5e8`, `codex/session-todo-time-recovery-20261025`, `C:/jini-dev/.worktrees/studyroom-review-20261025`.
- `saveSessionTodoTime`가 제한 없이 Supabase UPDATE 응답을 기다렸다. 응답이 영원히 오지 않으면 `finally`가 실행되지 않아 `todoBusy`/중복 요청 ref가 해제되지 않고 편집 취소·선택창 닫기·시작이 계속 차단됐다.
- 기존 `dashboardData.ts`의 15초 `runBoundedRequest`와 실제 Supabase builder의 AbortSignal을 재사용했다. 서버 함수·DB/RLS·APK·학습 판정 정책 변경은 없다.

## 사용자 동작

1. 시간 저장은 클릭한 항목의 `start_time`·`end_time`만 수정한다. 원 요청 중에는 중복 저장과 선택창 시작/닫기를 차단한다.
2. 응답 누락·오류 시 동일 `id`/`user_id`로 해당 할 일을 제한 시간 내 조회한다. 이미 저장된 시간이 초안과 일치하면 추가 UPDATE 없이 성공한다. 초/분 표현 차이는 비교 전에 정규화한다.
3. 결과를 확인하지 못하면 초안을 유지하고 `다시 확인`만 제공한다. 이 버튼은 읽기만 한다. 취소·선택창 닫기·다시 편집에서도 문서 내 미확인 의도는 유지된다.
4. 정상 조회에서 저장값이 다름을 확인하면 초안을 유지하며 `다시 저장`을 제공한다. 자동 재전송은 없으며 명시적인 선택이 새 UPDATE를 만든다.
5. 원 쓰기의 15초 제한 후 확인 중에는 편집 취소·모달 닫기가 가능하다. 확인 조회도 15초를 초과하면 오류 안내와 함께 잠금을 해제한다. 계정 변경·언마운트·확인 취소는 controller를 중단하고 이전 응답이 현재 화면을 갱신하지 못하도록 요청 identity를 해제한다.

## RED 재현

외부 계정·Slack·AI·운영 DB 없이 실제 React 앱을 로컬 fixture로 번들하고 Chrome에서 실행했다. Playwright 가상 시계를 사용해 15초를 실제로 기다리지 않는다.

- 초기 held UPDATE: 15,001ms 후에도 오류 안내가 없었다. `session todo time recovery: unresponsive save ...`의 alert 대기가 실패(0/1). 이를 확인한 뒤 구현했다.
- 초기 수정의 held 확인 SELECT: 15,001ms 후 확인 중 `취소`가 계속 disabled였다. `session todo time recovery: cancelling a pending result check ...`에서 false≠true로 실패(0/1). 확인 단계의 취소·닫기를 분리해 보완했다.
- 최초 sandbox 실행은 Chrome localhost `ERR_NETWORK_ACCESS_DENIED`로 기능에 도달하지 못했다. 동일 로컬 명령만 승인된 sandbox 예외에서 실행해 위의 제품 RED를 구분했다. OS 권한·프로그램 설치·외부 서비스는 변경하지 않았다.

## 실행 명령과 검증 범위

PowerShell, 위 checkout에서 실행:

```powershell
$env:FEED_BROWSER_MODULE='C:/Users/지니/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
$env:FEED_BROWSER_EXECUTABLE='C:/Program Files/Google/Chrome/Application/chrome.exe'
node --test --test-name-pattern='session todo time (edit|recovery)' apps/web/test/actualStudyMounted.test.mjs
npm.cmd run build
```

- 집중 검사: 정상 저장/한 발생분 보존(375px·1440px), 취소/동일시각 입력, 진행 중 중복/닫기/시작 차단, 명시 오류·네트워크 예외·빈 응답 재시도, 계정 전환, 영원히 대기하는 쓰기/조회, 이미 저장된 결과/서버 초 표현, 취소 후 재진입 중복 차단, 확인 중 취소, 명시 재저장, 확인 중 계정 전환을 다룬다.
- 브라우저 fixture는 응답 취소를 무시하는 비협조적 transport까지 사용해 race 정착을 검증한다. 이는 실제 운영 네트워크 장애·물리 Android 수용으로 확대하지 않는다.
- 미확인 의도는 현재 문서/계정의 메모리에만 보존한다. 전체 페이지 재시작 후에는 서버에서 받은 저장값이 기준이다. 취소는 이미 서버에 반영된 변경을 롤백하지 않는다.
- `docs/dune.md`/`dune.config.json`/`memory-bank/README.md`는 기준 checkout에 없다. 이 작업에서 구조 검사 파일을 만들어 검증을 통과한 것으로 표시하지 않는다. 전체 검사·README·스크린샷·통합·배포는 메인 담당 기록과 구분한다.

## 담당 구현 검증 결과

- 최종 집중 Chrome 검사: **14/14 통과**, 실패/생략 0, 77.1초. 가상 시간 15,001ms로 무응답 쓰기와 확인 조회를 각각 검증했다.
- 확인 중 취소→같은 항목 재진입→`다시 확인`→진행 중 선택창의 닫기 버튼을 누르는 강화 검사도 별도 **1/1 통과**, 실패/생략 0.
- `npm.cmd run build`: **통과**. 실제 Supabase 타입에서 `.abortSignal(signal)`을 `.single()` 앞에 배치했으며 타입/번들 검사 모두 통과했다. 첫 Vite 실행의 junction `realpath EPERM`은 sandbox 제약으로, 동일 명령을 승인된 예외에서 재실행했다.
- 실제 fixture 화면: `output/playwright/session-todo-time-edit-{375,1440}.png`, `output/playwright/session-todo-time-unconfirmed-375.png`. 후자는 확인 실패 안내/초안 유지/다시 확인·취소를 표시한다. 계정은 fixture 전용이며 실제 개인 이메일·일정·토큰은 없다. README와 `docs/images/` 반영은 메인이 수행한다.
- 전체 스위트/Edge/mobile/docs/DUNE·독립 검토·Git 통합·운영 배포는 메인 담당이다. 이 보고서의 집중 검사/로컬 빌드 결과를 해당 단계의 완료로 확대하지 않는다.
