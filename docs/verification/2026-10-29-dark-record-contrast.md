# 기록 하위 화면 다크 모드 재점검

- 기준: `C:/jini-dev/worktrees/study-dashboard-clarity`, `fix/study-dashboard-clarity`,315ca11(제품68ce558). 운영도68ce558/READY임을 재확인했다.
- 범위: `appTheme.css` 표시만 수정. 실제 계정·학습·회복·Auth/API/DB·native/설치파일 변경 없음. 기존 다른 worktree의 변경은 보존한다.

## 원인과 재현

- 전역 화면 진입만으로는 Today 기본 집중/Settings 계정 분류만 검사됐다. 사용자 제보는 Today 기록 하위 화면으로 재현한다.
- 오늘/월 누적 strong1.1289:1·목표 p1.6124:1, 주간 날짜/배지/시간 약1.5:1, 계획 시간 배지1.6430:1, 집중 기기 상태2.4265:1, 달력 연속일/알림 추천시간1.6028:1을 실제 Chrome/CSS 합성 배경 위에서 관측했다.
- `dark-record-red.log/red2.log`: 최초 fixture가 focus 갱신으로 목표를 다시 읽는다고 가정해 timeout/단계 이름 오류. 제품 실패 증거가 아니며 초기 synthetic fixture로 수정했다.
- `dark-record-red3.log`: 초기 fixture·올바른 ready/seed/tree/bloom 상태에서 본래 대비 실패2건 재현. `dark-record-green.log`: 달력 배지 잔류와 설정 알림4개 문자를 추가 발견. 이 실행은 최종 통과가 아니다.
- `dark-record-focused-final.log`: 기록/계획/집중 mixed·complete375px/1x2/2 통과. 이후 캡처의 요약 구분선 과다를 별도 회귀로 추가했다.
- 독립 검토: 라이트 메타 배지5.74:1 회귀를 기존7:1 검사로 재현해 ink 토큰으로 교정했다. 독립12/12 통과. 중간 너비640px의 통계 구분선 방향 RED도 재현하여 기존 세로 배치와 같은720px로 보정했다. 최종 독립 C0/I0/M0·node--check/diff--check 통과.
- `dark-record-shard-*.log`: 병렬 브라우저 검사 중 여러 파일에서 초기 화면 진입/촬영·click 후 탐색 대기 timeout이 발생해 중지했다. 이 실행을 전체 통과로 집계하지 않는다. 실제 Chrome54개/여유 메모리 약24GB를 읽었지만 이 지표만으로 원인이나 OOM을 단정하지 않는다. 테스트 단언·시간 제한은 변경하지 않고 순차 재검증한다.
- 대량 대비 수집은 기존 직접 문자 필터·조상별 alpha 합성·휘도/4.5 기준을 동일하게 브라우저 한 번의 평가로 수집한다. 기존 단일 readableText와 제품 동작은 유지하며 독립 검토로 동등성을 확인했다.

## 검증 범위와 명령

- 실제 main/CSS를 Chrome에서 실행하며 서버/카메라 외부 경계만 합성 fixture로 대체한다. 데이터에 `[테스트]`를 명시하며 운영 서버에는 쓰지 않는다.
- 오늘 집중·계획 체크리스트·생활계획표·기록, 목표 있음/없음·주간 달성 전후·ready/seed/tree/bloom/오늘,375/640/1440px·글자200%,4.5:1·다크 면·넘침·기록 불변을 확인한다.
- 전역 탭과 설정5분류를 열고 details를 펼쳐 실제 직접 문자 노드를 검사한다. aria-hidden 그림은 반전하지 않는다. SVG/그림·네이티브 OS/실제 계정·설치 앱 전체 수용과 구분한다.
- 런타임: `FEED_BROWSER_MODULE=C:/jini-dev/project/study-notes/node_modules/playwright/index.mjs`, `FEED_BROWSER_EXECUTABLE=C:/Program Files/Google/Chrome/Application/chrome.exe`.
- 최종 명령: `node --test --test-concurrency=1 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs` → `output/dark-record-full-sequential.log`. 이후 `ai.ps1 verify --project .`를 순차 실행한다.
- 최초 순차 전체:1519중1518통과/1실패/생략·취소0,1110481ms. 실패는 `mounted session plan: old reflection cannot prefill a new task at 1440px`의 초기 topbar 준비5초 대기이며 실제 대비/할 일 단언에 도달하기 전이다. 이 실행 자체를 전체 통과로 표시하지 않는다. 해당 실제 화면 파일201개 전체를 단언/시간 제한 변경 없이 재검증 중(`dark-record-mounted-final.log`), 나머지1318개는 통과했다.
- 최종 Chrome 재검증: `node --test apps/web/test/actualStudyMounted.test.mjs` →201/201·실패/생략/취소0·529065ms·exit0(`dark-record-mounted-final.log`).201개 이름 중복0, 최초 전체의 해당 파일 통과200/실패1을 모두 대조했고 미확인 실패0이다. 나머지1318개와 합쳐 최종 모든1519항목이 통과했다. 최초 전체 실패와 재실행 통과는 구분한다.
- 공식 `ai.ps1 verify --project .`:7명령 모두 passed/exit0·Dune 위반0(`dark-record-verify.log`). desktop:check·desktop:test·npm test·test:edge·mobile:check·build·docs:check를 순차 실행했다. 위 Chrome 파일별 전체 검증과 별개다.
- 실제 Windows StudyRoom에서 사용자 승인 후 Ctrl+R로 새 배포를 불러왔다. 로그인 유지·기록 화면의 공부 요약 불변을 읽기 전용으로 대조했다. 시간 숫자/목표 설명·주간 날짜 카드/상태/요약·계획표·펼친 알림의 추천시간/보조문자를 실제 창에서 확인했다. 설정 값을 저장하거나 공부/카메라/회복을 조작하지 않았고, 원래 기록 탭으로 복귀했다. 개인 계정/학습 값·실제 창 이미지는 이 문서에 저장하지 않는다. Android/iOS 실기기 수용으로 확대하지 않는다.

## 운영 출시

- 제품 커밋 `bda9e895553fab9a9117421824de8b69ad783802`, 기능 브랜치 push 완료. main 직접 push/merge 없음.
- 기존 workflow_dispatch [Actions40894773028](https://github.com/zxcc9867/studyRoom/actions/runs/40894773028) completed/success·정확한 headSha. CI tests/mobile/docs/Edge/build·기존 합성 무료AI 검사2종도 success.
- Vercel `dpl_uV9N15iRrjaHZtCziq5cnNN1Ffsg` READY·정확한 제품 SHA·기존 운영 alias. 대상 `team_LaN4bwvH4msrzoQtIw3fqsUj` / `prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g` / [운영 URL](https://study-room-attendance.vercel.app).
- 운영 HTML·`/assets/index-ByIyBLyx.js`·`/assets/index-CwvhYFyG.css` HTTP200. 기록 strong·주간 divider·휴대폰 상태 새 규칙과 기존 planner/picker 토큰 보존 확인.
- 배포 직후 해당 deployment의 최근5분 error/fatal 그룹 없음. 짧은 관측이며 장기 무오류 보장은 아니다.
- 새 APK/Windows 설치파일 없이 공통 hosted UI를 반영했다. 로그와 합성 캡처는 ignored `output/`에 두며 `.serena/`와 기존 다른 worktree의 변경은 보존했다.
