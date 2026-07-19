# Active Context

## 현재 작업

- 작업명: todo 시간 입력 전체 영역에서 시간 선택기 열기
- 작업 목적: 시계 아이콘뿐 아니라 오전/오후와 시간 숫자, 입력 여백을 클릭·더블클릭하거나 키보드로도 시작·종료 시간을 설정할 수 있게 한다.
- 관련 PRD: `memory-bank/prd-daily-planner-dashboard.md`
- 관련 파일: `apps/web/src/main.tsx`, `apps/web/src/timeInputPicker.mjs`, `apps/web/src/timeInputPicker.d.mts`, `apps/web/src/styles.css`, `apps/web/test/timeInputPicker.test.mjs`

## 최근 결정 사항

- 결정: native `input[type="time"]`을 유지하고 사용자 이벤트에서 `showPicker()`를 호출한다.
- 이유: 현재 브라우저 시간 선택 UI와 저장 형식을 유지하면서 아이콘에 한정된 클릭 문제만 해결할 수 있다.
- 대안: `showPicker()` 미지원 또는 보안상 호출이 차단되면 입력에 포커스하고 기존 직접 입력을 유지한다.
- 영향 범위: todo 생성·수정 모달의 시작/종료 시간 입력과 해당 hover/focus 스타일.

## 현재 상태

- 완료: 시작·종료 입력의 클릭, 더블클릭, Enter, Space 연결.
- 완료: disabled, 미지원, 호출 차단 fallback helper 및 테스트 추가.
- 완료: 대상 테스트 10개, 전체 테스트 274개, Vite production build 통과.
- 완료: 기능 커밋 `0efe399 fix: open todo time picker from full field`를 `origin/main`에 푸시.
- 진행 중: 없음.
- 막힌 부분: 없음.
- 완료: GitHub Actions workflow `29681074536`과 Vercel production 배포 성공 확인.
- 완료: 운영 별칭 HTTP 200 및 번들 `index-BM6z3ySG.js`에서 `showPicker`, `시작 시간 선택`, `종료 시간 선택` 확인.
- 다음 작업: 실제 Chrome과 모바일 브라우저에서 native picker 동작을 수동 확인한다.

## 주의할 점

- 이번 변경은 클라이언트 UI 전용이며 Supabase 스키마, RPC, Edge Function 변경이 없다.
- 모바일 브라우저는 각 OS의 native 시간 선택 UI를 사용한다.
- 브라우저 자동 시각 검증은 기존 Windows sandbox ACL 제한이 재현될 수 있으므로 테스트와 build를 필수 게이트로 유지한다.
