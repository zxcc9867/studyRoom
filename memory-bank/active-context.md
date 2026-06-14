# Active Context

## Current Work

- Task: Deploy current web app updates to Vercel.
- Purpose: Push the current Slack/camera/session/todo update set through the GitHub Actions Vercel production pipeline and fix any CI-only failures.
- Related PRD:
  - `memory-bank/prd-recurring-todos.md`
  - `memory-bank/prd-slack-notifications.md`
  - `memory-bank/prd-camera-presence.md`
- Related files:
  - `.github/workflows/vercel-production.yml`
  - `apps/web/src/main.tsx`
  - `apps/web/src/reminderPopup.mjs`
  - `apps/web/test/reminderPopup.test.mjs`
  - `memory-bank/trouble-shooting.md`

## Recent Decisions

- Decision: Use the existing GitHub Actions production workflow for Vercel deployment because local Vercel CLI has no credentials.
- Reason: `npx vercel@48.6.0 deploy --prod --yes` failed with `No existing credentials found`, while repository secrets are available in GitHub Actions.
- Alternative: Add a local `VERCEL_TOKEN` environment variable or run `vercel login`.
- Impact: Deployments from this environment require committing and pushing to `main`, then monitoring the workflow result.

## Current Status

- Completed: Commit `309481c` was pushed to `origin/main`, triggering GitHub Actions run `27500348234`.
- Found: The first workflow run failed during `npm test` because `apps/web/test/reminderPopup.test.mjs` did not pass a fixed `timeZone`, so CI's UTC default made the reminder time comparison fail.
- Completed: Reproduced the failure locally with `TZ=UTC`.
- Completed: Fixed the test to pass `timeZone: "Asia/Tokyo"`.
- Completed: `TZ=UTC node --test apps\web\test\reminderPopup.test.mjs`, `npm.cmd test`, and `npm.cmd run build` pass locally.
- Completed: Commit `9e5b8d3` was pushed to `origin/main`.
- Completed: GitHub Actions run `27500448036` succeeded.
- Completed: Vercel deployment `dpl_AE995CdmFTzXne3qAdGV1fnBRfMz` is `READY` for production and `https://study-room-attendance.vercel.app` returns HTTP 200.
- Next: For future app work, run tests/build, commit, push, and confirm Vercel production deployment as the final step.

## Notes

- Local direct Vercel deploy remains blocked until `VERCEL_TOKEN` is exported or `vercel login` is completed.
- Future work requests should include Vercel production deployment as a final step when the local change is intended for the live app.

## Current Work

- Task: Verify optional todo time, repeat, and weekday selection.
- Purpose: Ensure the todo creation modal supports optional start/end time, optional weekly recurrence, and optional weekday selection without duplicating existing implementation.
- Related PRD:
  - `memory-bank/prd-recurring-todos.md`
- Related files:
  - `apps/web/src/main.tsx`
  - `apps/web/src/todoRecurrence.mjs`
  - `apps/web/src/todoSchedule.mjs`
  - `apps/web/test/todoRecurrence.test.mjs`
  - `apps/web/test/todoSchedule.test.mjs`
  - `supabase/migrations/0016_study_todo_time_window.sql`

## Recent Decisions

- Decision: Keep recurrence as materialized `study_todos` rows instead of adding a separate recurrence-rule table for the MVP.
- Reason: The current UI, daily todo display, completion tracking, and notification body can all read dated todo rows directly.
- Alternative: Add a `todo_recurrence_rules` table and generate future todos server-side.
- Impact: A repeated todo creates rows for the selected dates up front, and duplicate prevention is handled by date, normalized title, and optional time range.

## Current Status

- Completed: The todo modal exposes optional `시간 설정` with start/end `time` inputs and stores them as `study_todos.start_time` / `study_todos.end_time`.
- Completed: The todo modal exposes optional `요일 반복`, repeat end date, and weekday selection.
- Completed: Recurrence tests verify inclusive date generation, empty invalid ranges, duplicate filtering, and time-aware duplicate rules.
- Completed: Schedule tests verify disabled schedules save null times, valid ranges normalize, invalid ranges are rejected, and formatted todo labels include time.
- Completed: `npm.cmd test`, `npm.cmd run build`, and `git diff --check` passed.
- Next: Deploy the current web build to Vercel when production needs the updated todo modal UI.

## Notes

- The optional time fields must be both null or both set, and when set `start_time < end_time`.
- The current implementation stores repeated todos as dated rows and does not persist a reusable recurrence rule.

## 현재 작업

- 작업명: 할 일 반복 등록과 선택형 시간 설정
- 작업 목적: 사용자가 캘린더 날짜에서 할 일을 만들 때 하루만 등록하거나 요일 반복으로 여러 날짜에 등록하고, 필요하면 Google Calendar처럼 시작/종료 시간을 선택해 일정형 todo로 볼 수 있게 한다.
- 관련 PRD:
  - `memory-bank/prd-recurring-todos.md`
  - `memory-bank/prd-slack-notifications.md`
- 관련 파일:
  - `apps/web/src/main.tsx`
  - `apps/web/src/todoRecurrence.mjs`
  - `apps/web/src/todoSchedule.mjs`
  - `apps/web/src/styles.css`
  - `supabase/migrations/0016_study_todo_time_window.sql`
  - `supabase/functions/attendance-cron/index.ts`
  - `supabase/functions/slack-test-alarm/index.ts`

## 최근 결정 사항

- 결정: 시간 설정은 선택 옵션으로 두고, 켰을 때만 `start_time`과 `end_time`을 함께 저장한다.
- 이유: 시간 없는 체크리스트와 시간 있는 일정형 todo를 같은 `study_todos` 테이블에서 단순하게 관리하기 위해서다.
- 대안: 별도 일정 테이블이나 반복 규칙 테이블을 만드는 방법이 있었지만, MVP에서는 기존 dated todo row를 유지하는 것이 구현과 알림 연동이 가장 작다.
- 영향 범위: todo 저장 UI, 중복 판단 기준, todo 목록 표시, Slack/WebPush/이메일 알림 본문, `study_todos` schema.

## 현재 상태

- 완료: 할 일 모달에 `시간 없음` / `시간 설정` 토글과 시작/종료 시간 입력을 추가했다.
- 완료: 반복 요일 등록 시 선택한 시간 범위가 모든 생성 날짜에 함께 저장된다.
- 완료: 같은 날짜와 제목이라도 시간 범위가 다르면 별도 todo로 등록할 수 있게 중복 판단을 바꿨다.
- 완료: 오늘 할 일, 알림 팝업, 내 페이지 완료 이력, Slack/WebPush/이메일 알림 본문에 시간 범위를 표시한다.
- 완료: 원격 Supabase 프로젝트 `bqohkdzvxbrokkmuhysx`에 `20260614115454 study_todo_time_window` migration을 적용했다.
- 완료: Supabase Edge Function `attendance-cron` v12, `slack-test-alarm` v2를 ACTIVE로 배포했다.
- 완료: `npm.cmd test`, `npm.cmd run build`가 통과했다.
- 막힌 부분: Vercel production 웹 배포는 이 작업에서 수행하지 않았다.
- 다음 작업: 운영 링크에서 시간 옵션 UI를 보려면 Vercel production 배포가 필요하다.

## 주의할 점

- `start_time`과 `end_time`은 둘 다 null이거나 둘 다 값이 있어야 하며, 값이 있으면 `start_time < end_time`이어야 한다.
- 이 구현은 반복 규칙 자체를 저장하지 않고, 선택한 날짜 범위에 해당하는 `study_todos` row를 미리 생성한다.
- 서버 알림 함수는 배포됐지만, 프론트엔드 UI 변경은 Vercel production 배포 전까지 운영 URL에는 보이지 않을 수 있다.
