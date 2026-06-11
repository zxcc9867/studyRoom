# Implementation Plan

## Architecture

- Web frontend: Vite React static build can be deployed to S3/CloudFront or another static host.
- Current web hosting: Vercel production deployment serves the static Vite app at `https://study-room-attendance.vercel.app`.
- Primary scheduler: Supabase Cron invokes `attendance-cron` Edge Function every minute through `pg_cron` and `pg_net`.
- Optional AWS scheduler: EventBridge + Lambda can invoke the same Supabase Edge Function when AWS-managed scheduling is preferred.
- Backend: Supabase remains responsible for Auth, DB, RLS, notification targets, attendance decisions, and actual push/email dispatch.
- Kakao notification channel: the web app links the current Supabase account to Kakao OAuth with `talk_message` scope, `kakao-token` stores Kakao provider tokens server-side, and `attendance-cron` sends Kakao Memo messages when a `kakao_memo` target is enabled.
- Telegram notification channel: the web app stores a user-specific Telegram chat ID in `notification_targets.destination`, while `attendance-cron` reads `TELEGRAM_BOT_TOKEN` from Edge Function secrets and calls Telegram Bot API `sendMessage`.
- Telegram test channel: `telegram-test-alarm` is a manually invoked Edge Function. Server/admin calls use `x-cron-secret`; browser calls use the logged-in user's Supabase JWT and are limited to that user's Telegram target. It sends one test Telegram message and records the result in `notification_deliveries`.
- In-app popup: when the dashboard is open at the configured reminder minute, the web app shows a modal reminder popup. This is separate from OS/browser push and does not work when the browser is closed.
- My Page: the web dashboard includes an in-page `me` section that reuses loaded profile and `study_todos` data to show account summary and completed todo history.
- Reminder todo enrichment: `attendance-cron` loads `study_todos` for each due reminder's `user_id` and `local_date`, then appends a compact `오늘 할 일` summary to server-side notification bodies. The open web app also renders the same date's todos in the reminder popup from already loaded dashboard state.

## Tech Stack

- Vite React
- Supabase
- Kakao Talk Message API
- Telegram Bot API
- AWS CDK v2
- AWS S3
- AWS CloudFront
- AWS EventBridge
- AWS Lambda Node.js 20
- Vercel static hosting

## Folder Structure

```txt
infra/aws-cdk/
  bin/study-room-aws.ts
  src/study-room-aws-stack.ts
  lambda/attendance-cron-invoker/index.mjs
  lambda/attendance-cron-invoker/index.test.mjs
  test/study-room-aws-stack.test.ts
  README.md
```

```txt
vercel.json
apps/web/dist/
```

```txt
apps/web/src/todoHistory.mjs
apps/web/src/todoHistory.d.mts
apps/web/test/todoHistory.test.mjs
```

```txt
docs/infrastructure-architecture.md
docs/images/study-room-thumbnail.png
```

## Code Conventions

- Keep AWS infrastructure code isolated under `infra/aws-cdk`.
- Keep Lambda logic dependency-free unless a real integration requires an SDK.
- Prefer deploy-time parameters for MVP secrets to avoid fixed Secrets Manager cost.
- Never put Supabase service-role keys in frontend code or committed docs.
- The web app intentionally uses a light Animal Crossing-style theme. Keep `color-scheme` fixed to light in HTML/CSS so mobile browsers do not auto-darken the UI.
- Keep todo history filtering, stats, and pagination in `todoHistory.mjs` instead of expanding the large React component with data logic.

## Design Patterns

- Static web hosting uses private S3 bucket plus CloudFront Origin Access Control.
- Scheduled execution is an invoker pattern: AWS only triggers Supabase Edge Function.
- SPA fallback maps CloudFront `403` and `404` to `/index.html`.
- Web study sessions are explicitly ended by button click or by page-exit events using a `keepalive` RPC request.

## API Conventions

- Supabase Cron sends `POST` to `/functions/v1/attendance-cron`.
- Supabase Cron sends `x-cron-secret` from Vault secret `cron_secret`.
- `kakao-token` accepts authenticated `GET`, `POST`, and `DELETE` requests from the web app. It returns connection status only and never returns raw Kakao tokens.
- `attendance-cron` sends Kakao Memo requests to `https://kapi.kakao.com/v2/api/talk/memo/default/send`.
- `attendance-cron` sends Telegram messages to `https://api.telegram.org/bot{token}/sendMessage`.
- `telegram-test-alarm` sends a protected one-off Telegram test message and includes same-day `study_todos` in the message body. Browser requests must include `Authorization: Bearer {supabase_access_token}`.
- `attendance-cron` notification bodies include up to a compact subset of reminder-date todo titles and mark completed items with a check indicator.
- Lambda sends `POST` to `AttendanceCronUrl`.
- Lambda sends `x-cron-secret` header from `CronSecret`.
- Lambda body includes `source: "aws-eventbridge"` and `triggeredAt`.
- Page-exit session termination sends `POST` to `/rest/v1/rpc/end_study_session` with the current user access token and anon key.
- My Page does not call a new API. It derives completed todo history from `study_todos` already loaded by the dashboard.

## Database Conventions

- No AWS database is introduced.
- Supabase remains the source of truth.
- RLS remains the user-data isolation boundary.
- Raw Kakao access/refresh tokens are stored only in `kakao_message_connections`.
- `notification_targets.kind = 'kakao_memo'` stores only the target marker and does not store Kakao raw tokens.
- `kakao_message_connections` has RLS enabled but no user-facing select/update policies. Client access must go through the `kakao-token` Edge Function.
- `notification_targets.kind = 'telegram'` stores only the user's Telegram chat ID in `destination`.
- `start_study_session()` creates a `study_sessions` row at any start time, but it only marks `attendance_days.status = 'present'` when the current timestamp is between the user's `reminder_at` and `deadline_at`.
- Timer starts before the configured reminder time must not create a `present` attendance row, because `get_due_reminders()` excludes days that are already `present` or `missed`.

## Testing Strategy

- Use Node test runner for Lambda behavior.
- Use `aws-cdk-lib/assertions` for synthesized template assertions.
- Use `npm.cmd run infra:synth` as deployment-shape verification.

## Deployment Strategy

1. Configure `apps/web/.env.local` with production Supabase values.
2. Build the web app with `npm.cmd run build` for local verification.
3. Set Vercel project environment variables for public Vite build values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`, and `VITE_GOOGLE_AUTH_ENABLED`.
4. Deploy the static web app to Vercel using `vercel.json`.
5. Deploy `attendance-cron` Edge Function with `verify_jwt=false`.
6. Set Edge Function secrets: `CRON_SECRET`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, optionally `RESEND_API_KEY`, for Telegram `TELEGRAM_BOT_TOKEN`, and for Kakao refresh/link behavior `KAKAO_REST_API_KEY`, optional `KAKAO_CLIENT_SECRET`, and `APP_ORIGIN`.
7. Store `project_url` and `cron_secret` in Supabase Vault.
8. Run `supabase/cron.sql` or equivalent SQL to register `study-room-attendance-cron`.
9. Verify `net._http_response` shows 200 responses from automatic cron calls.
10. Optional AWS deployment: run `npm.cmd run infra:synth` and `cdk deploy`.

## Security Notes

- Supabase Cron uses Vault-stored secrets and never exposes `cron_secret` to the client.
- `telegram-test-alarm` is deployed with `verify_jwt=false` only because it performs its own `x-cron-secret` or Supabase JWT validation before reading any target or sending any message.
- Kakao raw tokens are never stored in frontend local storage by app code and are not exposed through public RLS policies.
- Telegram bot tokens are never stored in frontend code or user-managed DB rows.
- `kakao-token` is deployed with `verify_jwt=false` only to allow browser CORS preflight; the function validates the Supabase JWT itself before doing any user-specific work.
- Supabase Auth Manual Linking must be enabled before `linkIdentity` can attach Kakao to an existing email/Google account.
- `CronSecret` is a CloudFormation `NoEcho` parameter and Lambda environment variable.
- For production with multiple operators, migrate `CronSecret` to Secrets Manager despite small fixed cost.
- CloudFront is the only public entry point for the static site bucket.
- CloudWatch Logs retention is one week.
- Vercel deployment stores only public Vite build-time values in the frontend bundle; service role keys and provider tokens remain in Supabase secrets or server-side tables.

## Supabase 변경 이력

### 2026-06-11

- 변경 대상: `public.start_study_session()`
- 변경 내용: `attendance_days.status = 'present'` 쓰기를 `now() >= reminder_at and now() <= deadline_at` 조건 안으로 이동했다.
- 변경 이유: 알림 시간 전에 타이머를 짧게 시작해도 당일이 `present`가 되어, 실제 알림 시간에는 `get_due_reminders()`가 사용자를 제외하는 문제가 있었다.
- 관련 기능: 강제 출석, Telegram 알림, Web Push 컴퓨터 알림
- 마이그레이션 파일: `supabase/migrations/0009_start_session_attendance_window.sql`
- 확인 방법: Supabase MCP `_apply_migration` 성공, migration history의 `start_session_attendance_window` 확인, 원격 함수 정의의 `function_guard=True` 확인.
- 주의 사항: 기존에 잘못 생성된 `present` 행은 이 migration이 자동 보정하지 않는다.

### 2026-06-11

- 변경 대상: `telegram-test-alarm` Edge Function
- 변경 내용: version 2를 배포했다. 기존 `x-cron-secret` 관리자 호출은 유지하면서, 브라우저에서 Supabase JWT로 호출할 수 있게 CORS와 JWT 검증을 추가했다. JWT 호출은 `admin.auth.getUser(jwt)`로 사용자를 확인하고 `notification_targets.user_id`가 로그인 사용자와 일치하는 Telegram target만 사용한다.
- 변경 이유: 사용자가 웹 설정 화면에서 직접 Telegram 테스트 알림을 보내고, 오늘 todo 포함 여부를 확인할 수 있어야 하기 때문이다.
- 관련 기능: Telegram 테스트 알림, todo 포함 알림, 웹 설정 화면
- 마이그레이션 파일: 없음
- 확인 방법: Supabase MCP `_deploy_edge_function`으로 `telegram-test-alarm` version 2 ACTIVE 확인, 인증 없는 POST 호출이 `401`을 반환함 확인.
- 주의 사항: `CRON_SECRET`과 `TELEGRAM_BOT_TOKEN`은 브라우저에 노출하지 않는다. 운영 웹 UI 반영은 Vercel production 배포가 필요하다.

### 2026-06-11

- 변경 대상: `telegram-test-alarm` Edge Function, `notification_deliveries`
- 변경 내용: `x-cron-secret`으로 보호되는 Telegram 테스트 발송 Edge Function을 추가하고 version 1 ACTIVE로 배포했다. 함수는 최신 enabled Telegram target 1개를 조회하고, 해당 사용자의 오늘 `study_todos`를 메시지에 포함한 뒤 Telegram Bot API `sendMessage`를 호출한다.
- 변경 이유: 기존 `attendance-cron`은 실제 due reminder 처리용이라 수동 테스트 1회 발송에 적합하지 않고, 로컬에서 bot token을 직접 다루면 secret 노출 위험이 있기 때문이다.
- 관련 기능: Telegram 테스트 알림, todo 포함 알림, 알림 발송 기록
- 마이그레이션 파일: 없음
- 확인 방법: Supabase MCP `_deploy_edge_function`으로 `telegram-test-alarm` version 1 ACTIVE 확인, Edge Function 호출 결과 `local_date=2026-06-11`, `todo_count=0`, `message_id=5` 확인.
- 주의 사항: `verify_jwt=false` 배포지만 함수 내부에서 `CRON_SECRET`을 검증한다. Telegram bot token과 cron secret 원문은 문서화하지 않는다.

### 2026-06-11

- 변경 대상: `attendance-cron`
- 변경 내용: due reminder 대상자의 `study_todos`를 `user_id`와 `local_date` 기준으로 조회하고, 알림 본문에 `오늘 할 일` 요약을 포함하도록 변경했다.
- 변경 이유: Telegram 및 컴퓨터 알림을 받을 때 그날 작성한 todo list도 함께 확인해야 하기 때문이다.
- 관련 기능: Telegram 알림, Web Push 컴퓨터 알림, 앱 내부 알림 팝업, todo list
- 마이그레이션 파일: 없음
- 확인 방법: `npm.cmd test` 31개 통과, `npm.cmd run build` 통과, Supabase `attendance-cron` version 9 ACTIVE 배포 확인, Vercel latest deployment READY 및 배포 JS에 `reminder-todos` UI 포함 확인.
- 주의 사항: 실제 알림 본문은 알림 시간이 도래해 Supabase Cron이 `attendance-cron`을 호출할 때 생성된다. 실수신 검증은 알림 시간을 현재 시각 기준 2~3분 뒤로 설정해 확인한다.

### 2026-06-11

- 변경 대상: Supabase Auth URL config, Edge Function secrets
- 변경 내용: Vercel 운영 URL `https://study-room-attendance.vercel.app`를 Supabase Auth `site_url`과 redirect allow list에 추가했고, Edge Function secret `APP_ORIGIN`을 같은 URL로 설정했다.
- 변경 이유: Vercel 배포 환경에서 Google OAuth callback과 Telegram 메시지의 앱 링크가 운영 URL을 사용해야 하기 때문이다.
- 관련 기능: Vercel 정적 배포, Google 로그인, Telegram 알림 링크
- 마이그레이션 파일: 없음
- 확인 방법: Vercel URL과 `/auth/callback`이 200을 반환했고, 배포된 JS 번들에 Supabase 프로젝트 URL이 포함되며 Google 로그인 비활성화 문구와 placeholder가 없음을 확인했다. Supabase Google authorize endpoint가 Vercel callback 기준 `302 Found`를 반환함도 확인했다.
- 주의 사항: Vercel CLI 최신 버전은 한글 Windows hostname이 `user-agent`에 들어가 실패하므로 OAuth device login과 `vercel@48.6.0 --token` 경로를 사용했다.

### 2026-06-11

- 변경 대상: `notification_targets`, `notification_deliveries`, `attendance-cron`, Edge Function secrets
- 변경 내용: `telegram` 알림 채널을 추가하고, `attendance-cron` Edge Function에 Telegram Bot API `sendMessage` 발송 분기를 추가했다. Edge Function secrets에는 `RESEND_API_KEY`와 `TELEGRAM_BOT_TOKEN`이 설정되어 있음을 확인했다.
- 변경 이유: 이메일 fallback을 복구하고, Kakao OAuth보다 단순한 개인용 메시지 알림 채널을 제공하기 위해서.
- 관련 기능: Telegram 알림, 이메일 fallback, 앱 내부 팝업 알림
- 마이그레이션 파일: `supabase/migrations/0008_telegram_notification_targets.sql`
- 확인 방법: 원격 DB constraint가 `telegram`을 허용하는지 확인했고, `attendance-cron` version 6 ACTIVE 배포를 확인했다. `npm.cmd test`와 `npm.cmd run build`가 통과했다.
- 주의 사항: 실제 Telegram 발송에는 사용자가 bot에게 먼저 메시지를 보내고 Chat ID를 앱 설정에 저장해야 한다. `APP_ORIGIN`은 아직 배포 URL이 없어 missing이다.

### 2026-06-08

- 변경 대상: `kakao_message_connections`, `notification_targets`, `notification_deliveries`, `kakao-token`, `attendance-cron`
- 변경 내용: `kakao_message_connections` 토큰 저장 테이블을 추가하고, 알림 대상/발송 기록 체크 제약에 `kakao_memo` 채널을 추가했다. `kakao-token` Edge Function을 추가해 Kakao provider token을 서버 측에 저장하고, `attendance-cron` Edge Function에 Kakao Talk Message API 나에게 보내기 발송 분기를 추가했다.
- 변경 이유: 사용자가 이메일/Google 로그인 계정을 유지하면서 카카오톡 나에게 보내기 알림만 별도로 연결할 수 있어야 하기 때문이다.
- 관련 기능: 카카오톡 알림 연결, Supabase Cron 기반 서버 측 알림, 컴퓨터가 꺼져 있어도 동작하는 알림
- 마이그레이션 파일: `supabase/migrations/0007_kakao_message_notifications.sql`
- 확인 방법: 원격 DB에서 `public.kakao_message_connections` 존재와 `kakao_memo` constraint 포함을 확인했다. Edge Function 목록에서 `kakao-token` version 2 ACTIVE, `attendance-cron` version 4 ACTIVE를 확인했다. `kakao-token` CORS preflight는 204, 인증 없는 GET은 함수 내부 401을 반환했다.
- 주의 사항: Supabase Auth `security_manual_linking_enabled`가 아직 false이므로 사용자가 직접 Manual Linking을 켜야 한다. Edge Function secrets `KAKAO_REST_API_KEY`, 필요 시 `KAKAO_CLIENT_SECRET`, 배포 URL 확정 시 `APP_ORIGIN`도 아직 설정해야 한다.

### 2026-06-08

- 변경 대상: Supabase Auth Kakao Provider
- 변경 내용: 원격 프로젝트 `bqohkdzvxbrokkmuhysx`의 `external_kakao_enabled`를 `true`로 설정했다. Kakao Client ID/Secret은 이미 설정되어 있었고, `external_kakao_email_optional`은 `false`로 유지했다.
- 변경 이유: Kakao OAuth 요청이 `Unsupported provider: provider is not enabled` 오류로 실패했기 때문이다.
- 관련 기능: 카카오 로그인, 카카오톡 나에게 보내기 알림 연동 준비
- 마이그레이션 파일: 없음
- 확인 방법: `/auth/v1/authorize?provider=kakao&redirect_to=http://127.0.0.1:5177/auth/callback` 요청이 `302 Found`와 Kakao OAuth URL을 반환함. `scopes=talk_message ...` 파라미터를 넣으면 Kakao OAuth URL의 scope에 `talk_message`가 포함됨.
- 주의 사항: 현재 앱 UI와 `attendance-cron`에는 아직 Kakao 연결/발송 채널이 없다.

### 2026-06-08

- 변경 대상: Supabase Auth Google Provider
- 변경 내용: 원격 프로젝트 `bqohkdzvxbrokkmuhysx`의 `external_google_enabled`를 `true`로 설정했다. Google Client ID/Secret은 이미 등록되어 있었고, `uri_allow_list`에는 `http://127.0.0.1:5177/auth/callback`, `http://localhost:5177/auth/callback`이 포함되어 있음을 확인했다.
- 변경 이유: Google OAuth 요청이 `Unsupported provider: provider is not enabled` 오류로 실패했기 때문이다.
- 관련 기능: Google 로그인, Supabase Auth OAuth callback
- 마이그레이션 파일: 없음
- 확인 방법: `/auth/v1/authorize?provider=google&redirect_to=http://127.0.0.1:5177/auth/callback` GET 요청이 `302 Found`와 Google OAuth URL을 반환함.
- 주의 사항: Google Cloud OAuth Client의 Authorized redirect URI에는 Supabase callback `https://bqohkdzvxbrokkmuhysx.supabase.co/auth/v1/callback`이 필요하다.

### 2026-06-07

- 변경 대상: Supabase Edge Function secrets, Vault, pg_cron, `get_due_reminders`
- 변경 내용: `CRON_SECRET`과 VAPID key pair를 설정하고, Vault `project_url`/`cron_secret` 및 `study-room-attendance-cron`을 등록했다. `get_due_reminders`의 PL/pgSQL column ambiguity를 `attendance_days_pkey` constraint와 `dn.*` alias로 수정했다.
- 변경 이유: S3/정적 앱에서도 서버 측 알림/출석 자동 처리를 Supabase만으로 수행하기 위해서.
- 관련 기능: 알림 발송, 결석 처리, 웹 푸시
- 마이그레이션 파일: `supabase/migrations/0006_fix_due_reminders_ambiguity.sql`
- 확인 방법: `net._http_response` 최신 자동 cron 응답이 200이고, content가 `{"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}` 형태로 반환됨.
- 주의 사항: `RESEND_API_KEY`와 Expo `EXPO_PUBLIC_EAS_PROJECT_ID`는 아직 별도 설정 필요.
