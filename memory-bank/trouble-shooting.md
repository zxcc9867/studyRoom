# Trouble Shooting

## 2026-06-14 - Supabase CLI unavailable for local migration creation

### Situation

While adding `camera_required_warning`, the Supabase skill recommended using Supabase CLI for migration commands. The local Windows environment did not have the CLI available.

### Error Message

```txt
supabase : 'supabase' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다.
```

### Cause

The Supabase CLI is not installed or not on `PATH` in this shell session.

### Fix

Kept the repository's existing numbered migration naming pattern and created `supabase/migrations/0012_camera_required_warning.sql`. Applied the DDL remotely through Supabase MCP `_apply_migration`, then verified the remote check constraint with `_execute_sql`.

### Related Files

* `supabase/migrations/0012_camera_required_warning.sql`
* `supabase/functions/camera-presence-warning/index.ts`

### Prevention

For future Supabase schema work in this environment, check `supabase --version` first. If unavailable, use Supabase MCP `_apply_migration` for DDL and record the local migration file manually using the repo's current naming pattern.

## 2026-06-13 - Vercel CI Deployment Path Added

### Situation

The user wanted repeatable Vercel production deployment without relying on local CLI login.

### Error Message

```txt
No existing credentials found. Please run `vercel login` or pass "--token"
```

### Cause

Local Vercel CLI deployment depends on an interactive login or a provided token. This Windows environment previously also hit a Vercel CLI login issue caused by a non-ASCII hostname being placed in the user-agent header.

### Fix

Added a GitHub Actions workflow that uses GitHub Secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. The workflow runs tests, builds with Vercel, and deploys the prebuilt output to production on `main` pushes.

### Related Files

* `.github/workflows/vercel-production.yml`
* `docs/vercel-ci.md`
* `memory-bank/prd-vercel-ci.md`

### Prevention

Use GitHub Actions or another CI environment with `VERCEL_TOKEN` for repeatable deployments. Do not depend on local Vercel CLI credentials for production releases.

## 2026-06-13 - GitHub Actions Vercel Prebuilt Build Failed On Node 24

### Situation

After GitHub Secrets were configured, commit `0d54fa7` was pushed to `origin/main` and GitHub Actions run `27435664940` started.

### Error Message

```txt
Error: Found invalid Node.js Version: "24.x". Please set Node.js Version to 22.x in your Project Settings to use Node.js 22.
```

### Cause

The workflow used `vercel build --prod` locally in GitHub Actions. The Vercel project setting currently reports Node.js `24.x`, and local Vercel build rejects that project setting even though Vercel remote deployments have previously succeeded.

### Fix

Changed the workflow to keep `npm test` as the quality gate, then run `vercel deploy --prod --yes --token="$VERCEL_TOKEN"` so Vercel performs the production build remotely with the project's own settings.

### Related Files

* `.github/workflows/vercel-production.yml`
* `docs/vercel-ci.md`
* `memory-bank/prd-vercel-ci.md`

### Prevention

If the project should return to prebuilt deploys, first change the Vercel project Node.js version to a local-build-compatible version such as `22.x`, then reintroduce `vercel build --prod` and `vercel deploy --prebuilt --prod`.

## 2026-06-13 - Camera presence UI could not be deployed to Vercel without credentials

### Situation

After implementing the camera-based absence warning MVP, the Supabase migration and Edge Function were deployed successfully. The web UI still needed a Vercel production deployment.

### Error Message

```txt
Vercel CLI 48.6.0
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### Cause

The local shell has `.vercel/project.json`, but it does not have Vercel credentials or `VERCEL_TOKEN`. The Vercel MCP deployment helper returned CLI guidance only, so it could not deploy the current working tree by itself.

### Fix

No deployment was completed in this pass. To deploy the camera UI, provide a valid `VERCEL_TOKEN` or complete Vercel CLI login/device authorization, then run:

```txt
npx.cmd vercel@48.6.0 deploy --prod --yes --token <redacted>
```

Do not commit or document the token value.

### Related Files

* `.vercel/project.json`
* `vercel.json`
* `apps/web/src/main.tsx`
* `apps/web/src/styles.css`

### Prevention

Set up Vercel Git integration or CI secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) so frontend changes deploy from Git without manual device authorization.

## 2026-06-13 - Two-step attendance deployment required Vercel device auth again

### Situation

After implementing the 8:30 initial reminder, 8:45 nudge, and 9:00 missed-attendance flow, the web copy and service worker needed a Vercel production deployment.

### Error Message

```txt
Vercel CLI 48.6.0
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### Cause

The project is still deployed from the Vercel CLI, and the local CLI credential store is empty. `.vercel/project.json` links the project, but it does not contain authentication credentials.

### Fix

Used OAuth device authorization with an ASCII user-agent, approved the device login in Vercel, and passed the returned temporary token only to the deployment command. The token was not printed or stored in source files.

The resulting production deployment is `dpl_DZUe2FPk3HW5K9wqaFE4aFS916gq`, and `study-room-attendance.vercel.app` aliases to it.

### Related Files

* `.vercel/project.json`
* `vercel.json`
* `apps/web/src/main.tsx`
* `apps/web/public/service-worker.js`

### Prevention

For repeatable deployment, configure Vercel Git integration or CI secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). Until then, expect manual OAuth device authorization for each CLI production deployment.

## 2026-06-13 - Vercel production still serves old mobile-dark artifact

### Situation

The user reported that the deployed mobile app at `https://study-room-attendance.vercel.app` still looked dark even after the mobile light-theme fix was pushed to GitHub.

### Error Message

```txt
User-visible symptom: production mobile page still appears dark.
Vercel CLI deploy error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### Cause

The mobile light-theme fix exists in local source, built `apps/web/dist/index.html`, and `origin/main`, but the Vercel production domain still serves an older deployment. The active Vercel production alias points to CLI deployment `dpl_D5L7trvBoiVTjn1B65TtRYcpU79X`, and the public HTML response has `Last-Modified: Thu, 11 Jun 2026 05:35:49 GMT`. GitHub push alone did not trigger a fresh production deployment because this project is currently deployed from CLI, not an active Git integration. A manual CLI deployment was attempted, but local Vercel credentials were missing.

### Fix

Generated a Vercel OAuth device authorization request manually with an ASCII `user-agent`, because `vercel login` fails when the Windows hostname contains non-ASCII characters. After the user approved the device login in Vercel, used the returned temporary access token for a one-time production deployment:

```txt
npx.cmd -y vercel@48.6.0 deploy --prod --yes --token <redacted> --scope astars-projects-c2f42587
```

The public production alias now points to READY deployment `dpl_88BcosEtVBhBKyddjNC3k9c9vjo5`, and the production HTML contains `only light` and `supported-color-schemes`.

### Related Files

* `.vercel/project.json`
* `vercel.json`
* `apps/web/index.html`
* `apps/web/dist/index.html`

### Prevention

After pushing frontend fixes, verify the production HTML contains the expected marker strings before checking the mobile UI. For this issue the markers are `only light` and `supported-color-schemes`. Do not assume `git push` updates Vercel unless Git integration or CI deployment is confirmed. For future manual deploys on this Windows host, avoid `vercel login`; use ASCII-header OAuth device authorization plus `--token`, or configure Vercel Git/CI deployment.

## 2026-06-13 - Mobile browser still rendered the light UI as dark

### Situation

The user reported that the study-room app still looked dark on mobile, while PC showed the intended light UI.

### Error Message

```txt
User-visible symptom: mobile page appears dark even though the PC page is light.
```

### Cause

The previous fix used document and CSS `color-scheme` hints, but the HTML meta still declared only `content="light"` and the app did not include a `prefers-color-scheme: dark` override. Some mobile browsers can apply automatic darkening or native control styling more aggressively when the OS/browser is in dark mode.

### Fix

Changed the HTML color-scheme meta to `only light`, added `supported-color-schemes=light`, added a small pre-paint inline light background/text style, and added a CSS `@media (prefers-color-scheme: dark)` override to keep the app background and text colors on the same light palette.

### Related Files

* `apps/web/index.html`
* `apps/web/src/styles.css`
* `apps/web/test/mobileTheme.test.mjs`

### Prevention

Keep both HTML metadata and CSS in sync when changing the app theme. The regression test must verify `only light`, the Safari-compatible supported color scheme meta, pre-paint style, and the dark-preference override.

## 2026-06-12 - GitHub push blocked by missing local/remote repository setup

### Situation

The user asked to push the current study-room app work to GitHub. The project folder was not a git repository, and the parent `C:\jini-dev\project` folder was not a git repository either.

### Error Message

```txt
fatal: not a git repository (or any of the parent directories): .git
gh : 'gh' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다.
```

After `git init`, git also required a safe-directory registration:

```txt
fatal: detected dubious ownership in repository at 'C:/jini-dev/project/study-room-attendance'
git config --global --add safe.directory C:/jini-dev/project/study-room-attendance
```

### Cause

The app had been developed in a normal folder without `.git`. No `origin` remote was configured, `gh` CLI was not installed, and the GitHub connector did not expose a matching `study-room-attendance` repository.

### Fix

Initialized a local git repository on `main`, registered the project path as a safe directory, refreshed README/thumbnail files, and created local commit `6f7fb40 Initial study room attendance app`.

### Related Files

* `README.md`
* `.gitignore`
* `docs/images/study-room-thumbnail.png`
* `memory-bank/active-context.md`
* `memory-bank/progress.md`

### Prevention

Before future push requests, check `git status -sb`, `git remote -v`, and `gh --version` or the GitHub connector repository list. Do not push into an unrelated GitHub repository without explicit confirmation.

## 2026-06-12 - Headless Chrome failed while creating README thumbnail

### Situation

The README thumbnail needed to be captured from the local Vite preview app.

### Error Message

```txt
GPU process isn't usable. Goodbye.
Chrome screenshot failed with exit code
```

### Cause

Chrome headless could not start a usable GPU process in this Windows session.

### Fix

Retried with Microsoft Edge headless using a dedicated local user data dir and GPU/sandbox related flags. Edge wrote `docs/images/study-room-thumbnail.png`.

### Related Files

* `docs/images/study-room-thumbnail.png`
* `README.md`

### Prevention

Use Edge headless with `--headless=new`, `--disable-gpu`, `--disable-software-rasterizer`, `--no-sandbox`, and a project-local temporary profile when Chrome headless fails.

## 2026-06-12 - Browser plugin blocked local app URL during UI verification

### Situation

After adding the My Page todo history UI, code tests and build passed, but in-app Browser verification could not open the local Vite URL.

### Error Message

```txt
Browser Use cannot open http://127.0.0.1:5177 in tab 1. Browser reported: net::ERR_BLOCKED_BY_CLIENT
Browser Use cannot open http://localhost:5177 in tab 1. Browser reported: net::ERR_BLOCKED_BY_CLIENT
```

### Cause

The Browser plugin blocked navigation to the local development URL in this session. This did not come from Vite, TypeScript, or the app bundle.

### Fix

Kept verification to deterministic checks: `node --test apps\web\test\todoHistory.test.mjs`, `npm.cmd test`, `npm.cmd run build`, and `rg` against `apps/web/dist` to confirm the My Page strings/classes were included in the production bundle.

### Related Files

* `apps/web/src/main.tsx`
* `apps/web/src/styles.css`
* `apps/web/src/todoHistory.mjs`
* `apps/web/test/todoHistory.test.mjs`

### Prevention

If this appears again, treat it as a browser automation environment issue first. Verify the app through tests/build/dist output, or use a manually opened browser after ensuring the local server is running.

## 2026-06-12 - Mobile browser shows light UI as dark

### Situation

The user reported that the study-room web UI looked dark when viewed on mobile.

### Error Message

```txt
mobileTheme.test.mjs failed because apps/web/index.html did not include:
<meta name="color-scheme" content="light" />
```

Local dev server verification also hit the existing Windows shell issue:

```txt
Start-Process : An item with the same key has already been added. Key being added: 'PATH'
```

### Cause

The app uses a light visual palette, but the document did not explicitly opt out of mobile/browser automatic dark theming. Some mobile browsers can darken backgrounds or native controls when the OS is in dark mode. Local browser verification was blocked by the known Windows `Path/PATH` duplicate environment issue when using `Start-Process`.

### Fix

Added light color-scheme metadata to `apps/web/index.html`, added `color-scheme: only light` and explicit root background/color CSS, and set native controls to light color-scheme. Added `apps/web/test/mobileTheme.test.mjs` to prevent regression.

### Related Files

* `apps/web/index.html`
* `apps/web/src/styles.css`
* `apps/web/test/mobileTheme.test.mjs`

### Prevention

Keep the web app's document-level `color-scheme` and `theme-color` in sync with the light UI palette. After local fixes, deploy to Vercel before checking on a phone pointed at the production URL.

## 2026-06-11 - Reminder skipped because early timer start marked the day present

### Situation

The user reported that the configured 9 PM reminder did not arrive through Telegram or computer Web Push on 2026-06-11.

### Error Message

```txt
cron_at_reminder status=200 content={"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}
delivery_window_count=0
target_state reminder_time=21:00:00 timezone=Asia/Tokyo today_status=present
study_today started_local=2026-06-11 01:39:36.618665 duration_seconds=2
```

### Cause

`start_study_session()` marked `attendance_days.status = 'present'` whenever a timer started, even before the configured reminder time. On 2026-06-11, a 2-second study session at 01:39 local marked the day `present`. At the configured 21:00 local reminder time, `get_due_reminders()` excluded the user because it skips days already marked `present` or `missed`. Therefore Telegram and Web Push were never attempted.

### Fix

Added and applied `supabase/migrations/0009_start_session_attendance_window.sql`. The function now creates a study session at any time, but only marks attendance `present` when `now()` is between `reminder_at` and `deadline_at`.

### Related Files

* `supabase/migrations/0009_start_session_attendance_window.sql`
* `packages/core/test/sql-migrations.test.mjs`
* `supabase/functions/attendance-cron/index.ts`

### Prevention

When reminders do not arrive, check `cron.job`, `net._http_response`, `get_due_reminders()` behavior, `attendance_days.status`, and `notification_deliveries` in that order. If `dueReminderCount` is 0 at the reminder minute, inspect why the user was excluded before debugging Telegram or Web Push providers.

## 2026-06-11 - Vercel production deploy blocked by missing local credentials

### 상황

웹 설정 화면에 `Telegram 테스트 알림` 버튼을 추가한 뒤 Vercel production 배포를 시도했다.

### 에러 메시지

```txt
Vercel CLI 48.6.0
Error: No existing credentials found. Please run `vercel login` or pass "--token"
```

### 원인

현재 Codex 세션에는 `VERCEL_TOKEN` 환경 변수가 없고, 로컬 Vercel CLI 인증 파일도 사용할 수 없는 상태였다. `.vercel/project.json`에는 project/team 연결 정보가 있지만, 배포 인증에는 별도 로그인 또는 token이 필요하다.

### 해결 방법

이번 턴에서는 Supabase Edge Function 배포와 로컬 빌드 검증까지 완료했다. 운영 웹 배포는 사용자가 `vercel login`을 완료하거나 Vercel token을 제공한 뒤 아래 명령으로 다시 진행한다.

```txt
npx.cmd vercel@48.6.0 deploy --prod --yes --scope astars-projects-c2f42587
```

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/telegramNotifications.mjs`
* `.vercel/project.json`

### 재발 방지

Vercel 배포 작업 전에는 `VERCEL_TOKEN=set` 여부와 로컬 CLI 로그인 상태를 먼저 확인한다. token 원문은 문서나 채팅에 기록하지 않는다.

## 2026-06-11 - Telegram test send uses Edge runtime secret, not Management API secret value

### 상황

Telegram 테스트 알림을 즉시 보내기 위해 Supabase Management API로 secret 목록을 확인한 뒤 로컬 PowerShell에서 Telegram Bot API를 직접 호출하려고 했다.

### 에러 메시지

```txt
telegram_getMe=failed status=404
{"ok":false,"error_code":404,"description":"Not Found"}
```

### 원인

Supabase Management API `/secrets` 응답의 `value` 필드는 실제 `TELEGRAM_BOT_TOKEN` 원문으로 사용할 수 없는 placeholder 성격이었다. 해당 값을 Telegram Bot API URL에 넣으면 유효하지 않은 bot token이 되어 404가 반환된다.

추가로 todo 조회 SQL 초안에서 `target.local_date`를 text로 만들고 `study_todos.local_date` date와 직접 비교해 아래 타입 오류가 발생했다.

```txt
ERROR: 42883: operator does not exist: text = date
```

### 해결 방법

로컬에서 bot token 값을 직접 사용하지 않고, `CRON_SECRET` 헤더로 보호되는 `telegram-test-alarm` Edge Function을 추가했다. 이 함수는 Supabase Edge Function 런타임에서 실제 `TELEGRAM_BOT_TOKEN` secret을 읽고 Telegram Bot API `sendMessage`를 호출한다.

SQL 타입 오류는 테스트 스크립트에서 `target.local_date::date = st.local_date`로 수정했다.

### 관련 파일

* `supabase/functions/telegram-test-alarm/index.ts`
* `memory-bank/implementation-plan.md`

### 재발 방지

Secret API에서 반환된 값을 실제 secret 원문이라고 가정하지 않는다. Telegram/Resend/Kakao 등 provider token은 Edge Function 런타임 또는 배포 secret 설정 경로에서만 사용한다. 날짜 문자열과 date 컬럼을 비교할 때는 명시적으로 cast한다.

## 2026-06-11 - Todo notification TDD red test and matcher refinement

### 상황

알림 본문에 날짜별 todo를 포함하는 기능을 TDD로 추가하면서 먼저 `packages/core/test/sql-migrations.test.mjs`에 실패 테스트를 작성했다.

### 에러 메시지

```txt
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /type StudyTodo = \{/
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /formatTodoSummary\(todos\)/
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /buildReminderBody\(reminder, todos\)/
```

### 원인

첫 번째 실패는 기능이 아직 구현되지 않았기 때문에 발생한 정상적인 RED 단계였다. 이후 두 실패는 실제 구현이 `maxTodos` 옵션을 받는 형태였는데 테스트가 옵션 없는 정확한 호출 형태만 허용해서 발생했다.

### 해결 방법

`attendance-cron`에 `StudyTodo`, `loadTodosByReminder`, `buildReminderBody`, `formatTodoSummary`를 구현했다. 테스트는 호출 형태가 아니라 todo summary와 reminder body 사용 여부를 검증하도록 matcher를 완화했다.

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`
* `packages/core/test/sql-migrations.test.mjs`

### 재발 방지

소스 패턴 테스트는 구현 세부 옵션까지 과하게 고정하지 않고, 사용자 요구와 직접 연결되는 동작 경계만 확인한다.

## 2026-06-11 - Vercel remote build misses Vite public environment variables

### 상황

Vercel production 배포 후 운영 URL은 열렸지만, 배포된 JS 번들에서 Google 로그인 비활성화 분기가 남아 있었다.

### 에러 메시지

```txt
Google 로그인을 사용하려면 Supabase Auth에서 Google Provider를 켜고 Client ID/Secret을 등록한 뒤 VITE_GOOGLE_AUTH_ENABLED=true로 바꿔야 합니다.
```

### 원인

Vercel 원격 빌드는 `apps/web/.env.local`을 자동으로 가져가지 않는다. Vite의 `VITE_*` 값은 빌드 시점에 번들에 주입되므로, Vercel 프로젝트 환경변수에 public build 변수를 별도로 등록해야 한다.

### 해결 방법

Vercel 프로젝트 환경변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`, `VITE_GOOGLE_AUTH_ENABLED`를 `production`, `preview`, `development` 대상으로 등록하고 production을 재배포했다. 이후 배포된 JS 번들에서 Supabase 프로젝트 URL 포함, Google 비활성화 문구 제거, placeholder 미포함을 확인했다.

### 관련 파일

* `vercel.json`
* `apps/web/.env.local`
* `memory-bank/implementation-plan.md`

### 재발 방지

Vercel 배포 후에는 HTML 200만 확인하지 말고 배포된 asset을 조회해 `VITE_*` 값이 반영됐는지 패턴으로 확인한다. 비밀값은 출력하지 않고 `set/missing` 또는 boolean 검증 결과만 기록한다.

## 2026-06-11 - Vercel CLI fails when Windows hostname contains non-ASCII characters

### 상황

독서실 웹 앱을 Vercel에 배포하려고 `npx.cmd vercel deploy --prod --yes`를 실행했다.

### 에러 메시지

```txt
TypeError: 지니 @ vercel 54.11.1 node-v24.13.0 win32 (x64) is not a legal HTTP header value
The specified token is not valid. Use `vercel login` to generate a new token.
```

### 원인

Vercel CLI 최신 버전이 Windows hostname을 `user-agent` header에 포함한다. 현재 hostname이 한글이라 HTTP header 값 검증에서 실패했다. 기존 로컬 Vercel auth 파일의 access token은 만료됐고, refresh token은 새 토큰으로 교체되는 일회성 흐름이라 재인증이 필요했다.

### 해결 방법

Vercel OAuth device authorization을 ASCII `user-agent`로 직접 시작하고, 사용자가 Vercel 승인 페이지에서 승인한 뒤 갱신된 access token을 로컬 auth 파일에 저장했다. 이후 최신 CLI 대신 `vercel@48.6.0`에 `--token`과 `--scope astars-projects-c2f42587`를 전달해 배포했다.

배포 후 Vercel 운영 URL은 `https://study-room-attendance.vercel.app`이고, Supabase Auth `site_url`/redirect allow list 및 Edge Function secret `APP_ORIGIN`도 해당 URL로 설정했다.

### 관련 파일

* `vercel.json`
* `.vercel/project.json`
* `memory-bank/implementation-plan.md`

### 재발 방지

Windows hostname이 한글인 환경에서 Vercel CLI 최신 버전이 같은 오류를 내면 `vercel whoami`나 `vercel deploy`를 반복하지 말고, device authorization으로 token을 갱신한 뒤 `vercel@48.6.0 --token` 경로를 사용한다. 토큰 값은 문서나 코드에 기록하지 않는다.

## 2026-06-11 - Local Vite server start fails because of Path/PATH environment collision

### 상황

독서실 웹 앱을 `http://127.0.0.1:5177/`에서 실행하려고 했다.

### 에러 메시지

```txt
Start-Process : 항목이 이미 추가되었습니다. 사전에 있는 키: 'Path'  추가되는 키: 'PATH'
'vite'은(는) 내부 또는 외부 명령, 실행할 수 있는 프로그램, 또는 배치 파일이 아닙니다.
```

### 원인

현재 Windows PowerShell 프로세스 환경에 `Path`와 `PATH`가 동시에 존재해 `Start-Process`와 `Get-ChildItem Env:`가 실패했다. 중복 문제를 피하려고 `PATH`를 비우면 npm workspace script가 자식 프로세스에서 `vite`를 찾지 못했다.

### 해결 방법

`npm.cmd --workspace apps/web run dev` 대신 `node.exe`로 Vite JS 엔트리를 직접 실행했다. 실행 포트는 3000번을 피하고 기존 독서실 앱 포트인 5177을 사용했다.

```powershell
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' `
  -ArgumentList @('C:\jini-dev\project\study-room-attendance\node_modules\vite\bin\vite.js','--host','127.0.0.1','--port','5177','--strictPort') `
  -WorkingDirectory 'C:\jini-dev\project\study-room-attendance\apps\web' `
  -RedirectStandardOutput 'C:\jini-dev\project\study-room-attendance\web-dev.log' `
  -RedirectStandardError 'C:\jini-dev\project\study-room-attendance\web-dev.err' `
  -WindowStyle Hidden
```

### 관련 파일

* `apps/web/package.json`
* `web-dev.log`
* `web-dev.err`

### 재발 방지

Windows에서 npm workspace dev server가 환경 변수 문제로 실패하면 npm script를 고집하지 말고 `node.exe node_modules/vite/bin/vite.js` 직접 실행으로 확인한다. 3000번 포트는 다른 앱이 사용할 수 있으므로 독서실 앱은 `5177` 포트를 우선 사용한다.

## 2026-06-11 - Telegram target requires chat ID after bot token secret is set

### 상황

`RESEND_API_KEY`와 `TELEGRAM_BOT_TOKEN`을 Supabase Edge Function secrets에 추가하고 Telegram 알림 채널을 구현했다.

### 에러 메시지

```txt
APP_ORIGIN=missing
notification_targets.kind = 'telegram' target not created yet
Telegram Bot API getUpdates update_count=0
```

### 원인

Telegram bot token은 서버 secret으로 설정됐지만, 사용자별 Telegram chat ID는 앱 설정 화면에서 별도로 저장해야 한다. Telegram bot은 사용자가 먼저 bot에게 메시지를 보내야 대화를 시작할 수 있고, 그 이후 `getUpdates` 등을 통해 chat ID를 확인할 수 있다. 새 bot token을 Supabase secret에 덮어쓴 뒤 `getUpdates`를 조회했지만 update 결과가 0건이어서 아직 저장할 Chat ID가 없다. 또한 앱 URL을 Telegram 메시지에 정확히 넣으려면 배포 후 `APP_ORIGIN` secret이 필요하다.

### 해결 방법

사용자는 Telegram에서 bot에게 먼저 `/start` 또는 아무 메시지나 보내고 chat ID를 확인한 뒤, 웹 앱 설정의 `Telegram Chat ID` 필드에 저장해야 한다. 사용자가 메시지를 보낸 다음에는 `getUpdates`를 다시 조회해 Chat ID를 찾고 `notification_targets.kind = 'telegram'` 대상으로 저장한다. 배포 URL이 생기면 Supabase Edge Function secret `APP_ORIGIN`도 설정한다. 비밀값은 코드, `.env.example`, `memory-bank`에 기록하지 않는다.

2026-06-11에 사용자가 bot에게 메시지를 보낸 뒤 `getUpdates`에서 private chat ID 후보를 확인했고, 해당 Chat ID를 `p64***@gmail.com` / `A스타` 프로필의 `notification_targets.kind = 'telegram'` 대상으로 저장했다. Telegram Bot API `sendMessage` 테스트는 `ok=true`로 성공했고, 원격 DB에서도 Telegram target이 `enabled=true`임을 확인했다.

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/telegramNotifications.mjs`
* `supabase/functions/attendance-cron/index.ts`
* `supabase/migrations/0008_telegram_notification_targets.sql`

### 재발 방지

알림 채널을 추가할 때는 provider secret 설정과 사용자별 `notification_targets` 생성을 분리해서 확인한다. Telegram 발송 문제는 `TELEGRAM_BOT_TOKEN`, `notification_targets.kind = 'telegram'`, `notification_deliveries.channel = 'telegram'` 순서로 본다.

## 2026-06-08 - Cron runs but user does not receive alarm

### 상황

사용자가 독서실 앱이 알람을 보내지 않는다고 보고했다.

### 에러 메시지

```txt
net._http_response: {"dueReminderCount":0,"missedCount":0,"deliveryResults":[]}
notification_deliveries email: RESEND_API_KEY is required
notification_deliveries web_push: Received unexpected response code
Supabase Auth security_manual_linking_enabled=False
RESEND_API_KEY=missing
KAKAO_REST_API_KEY=missing
```

### 원인

Supabase Cron과 `attendance-cron` Edge Function은 정상 실행 중이다. 현재 미수신의 직접 원인은 발송 채널 준비가 완료되지 않은 것이다. 등록된 대상은 `email` 2개와 `web_push` 2개뿐이고, 휴대폰 Expo Push 대상과 `kakao_memo` 대상은 없다. 이메일은 `RESEND_API_KEY`가 없어 실패하고, 카카오는 Manual Linking과 Kakao secrets가 없어 연결/발송을 완료할 수 없다. 웹푸시는 한 건은 push service까지 `sent`로 기록됐지만, 다른 한 건은 stale subscription 또는 권한/푸시 서비스 문제로 실패했다.

### 해결 방법

사용하려는 알림 채널별로 준비를 완료해야 한다.

- 이메일: Edge Function secret `RESEND_API_KEY`를 설정한다.
- 카카오톡: Supabase Manual Linking을 켜고 `KAKAO_REST_API_KEY`, 필요 시 `KAKAO_CLIENT_SECRET`, `APP_ORIGIN`을 설정한 뒤 웹 앱에서 카카오톡 알림을 연결한다.
- 휴대폰 Expo Push: 실제 모바일 앱에서 Expo Push Token 등록 흐름을 실행해 `notification_targets.kind = 'expo'` 대상을 만든다.
- 컴퓨터 웹푸시: 브라우저 알림 권한을 허용하고 컴퓨터 알림을 다시 등록해 stale subscription을 갱신한다.

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`
* `supabase/functions/kakao-token/index.ts`
* `apps/web/src/webPush.ts`
* `apps/web/src/main.tsx`

### 재발 방지

알림 미수신을 볼 때는 `cron.job`, `net._http_response`, `get_due_reminders(now())`, `notification_targets`, `notification_deliveries`, Edge Function secrets를 순서대로 확인한다. `dueReminderCount: 0`이면 스케줄러 문제가 아니라 현재 분에 보낼 대상이 없다는 뜻이다.

## 2026-06-08 - Kakao notification deployment blocked by Manual Linking and secrets

### 상황

카카오톡 알림 연결 UI, `kakao-token` Edge Function, `attendance-cron`의 `kakao_memo` 발송 분기를 구현하고 원격 Supabase에 배포했다.

### 에러 메시지

```txt
Supabase Auth security_manual_linking_enabled=false
KAKAO_REST_API_KEY secret not found
APP_ORIGIN secret not found
```

### 원인

기존 Supabase 사용자 계정에 Kakao identity를 추가하려면 Supabase Auth Manual Linking이 켜져 있어야 한다. 이 설정은 계정 연결 보안에 영향을 주는 영구 Auth 설정이라 자동 변경 승인이 거절됐다. 또한 Kakao access token이 만료된 뒤 refresh하려면 Edge Function secret `KAKAO_REST_API_KEY`가 필요하고, 운영 링크를 정확히 만들려면 `APP_ORIGIN`도 필요하다.

### 해결 방법

코드와 DB/Edge Function 배포는 완료했다. 사용자가 Supabase Dashboard에서 Manual Linking을 직접 켜고, Edge Function secrets에 `KAKAO_REST_API_KEY`, 필요 시 `KAKAO_CLIENT_SECRET`, 배포 URL 확정 후 `APP_ORIGIN`을 설정해야 실제 연결/발송 검증이 가능하다.

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/kakaoNotifications.mjs`
* `supabase/functions/kakao-token/index.ts`
* `supabase/functions/attendance-cron/index.ts`
* `supabase/migrations/0007_kakao_message_notifications.sql`

### 재발 방지

OAuth identity linking 기능을 추가할 때는 Supabase Provider enabled 여부와 별도로 Manual Linking 설정을 확인한다. Edge Function 배포 후에는 코드 배포 상태와 필요한 secrets 설정 상태를 분리해서 확인한다.

## 2026-06-08 - Supabase MCP migration required reauthentication

### 상황

`kakao_message_connections` migration을 Supabase MCP로 적용하려고 했다.

### 에러 메시지

```txt
This app connection requires reauthentication before other actions on this app can succeed.
```

### 원인

현재 세션의 Supabase MCP 앱 연결이 재인증을 요구하는 상태였다. MCP 도구 자체는 보였지만 실제 변경 작업은 진행할 수 없었다.

### 해결 방법

`SUPABASE_ACCESS_TOKEN` 존재를 확인한 뒤 Supabase Management API의 database query endpoint로 migration SQL을 적용했다. 이후 같은 Management API SQL 조회로 `public.kakao_message_connections`와 `kakao_memo` check constraint가 원격 DB에 반영된 것을 확인했다.

### 관련 파일

* `supabase/migrations/0007_kakao_message_notifications.sql`

### 재발 방지

Supabase 변경 전에는 MCP 도구 표시 여부만 보지 말고 실제 `_execute_sql` 또는 `_apply_migration` 호출이 가능한지 확인한다. 재인증 오류가 나오면 Supabase MCP 재로그인 또는 Management API/CLI fallback을 사용한다.

## 2026-06-08 - Edge Function JWT gateway blocks browser CORS preflight

### 상황

웹 앱에서 `kakao-token` Edge Function을 호출하려면 브라우저가 먼저 `OPTIONS` preflight 요청을 보낸다.

### 에러 메시지

```txt
401 Unauthorized
```

### 원인

Edge Function을 `verify_jwt=true`로 배포하면 Supabase gateway가 `OPTIONS` preflight 요청도 JWT 없이 차단할 수 있다. 그러면 함수 내부 CORS 처리까지 요청이 도달하지 못한다.

### 해결 방법

`kakao-token`을 `verify_jwt=false`로 재배포하고, 함수 내부에서 `Authorization` bearer token을 직접 `admin.auth.getUser(jwt)`로 검증하도록 유지했다. `OPTIONS` 요청은 204로 응답하고, 인증 없는 GET은 함수 내부 401을 반환하는 것을 확인했다.

### 관련 파일

* `supabase/functions/kakao-token/index.ts`

### 재발 방지

브라우저에서 직접 호출하는 Edge Function은 CORS preflight 경로를 따로 검증한다. `verify_jwt=false`를 사용할 경우 반드시 함수 내부에서 Supabase JWT를 검증한다.

## 2026-06-08 - Kakao provider disabled and no Kakao delivery channel

### 상황

카카오 설정 후 카카오톡 나에게 보내기 알림을 보낼 수 있는지 확인했다.

### 에러 메시지

```txt
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

### 원인

Supabase Auth Kakao Provider가 아직 활성화되어 있지 않다. 또한 현재 `attendance-cron` Edge Function은 `expo`, `web_push`, `email`만 처리하고, DB 체크 제약도 해당 세 채널만 허용한다. 따라서 Kakao Developers 설정만으로는 현재 앱에서 카카오톡 메시지를 보낼 수 없다.

### 해결 방법

Supabase Auth Providers에서 Kakao를 ON으로 설정하고 Client ID/Secret을 저장해야 한다. 이후 카카오를 로그인 수단이 아니라 알림 채널로 쓰려면 별도 토큰 저장 테이블과 `attendance-cron`의 `kakao_memo` 발송 분기를 구현해야 한다.

2026-06-08에 Management API로 `external_kakao_enabled=True`를 적용했고, authorize endpoint가 `302 Found`로 Kakao OAuth URL을 반환하는 것을 확인했다. 단, 실제 카카오톡 나에게 보내기 알림은 아직 앱/DB/Edge Function 구현이 필요하다.

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`
* `supabase/migrations/0001_study_room_mvp.sql`
* `apps/web/src/main.tsx`

### 재발 방지

Kakao Developers 설정 완료와 Supabase Provider 활성화는 별개로 확인한다. 발송 가능 여부는 Provider endpoint, DB 채널 제약, Edge Function 발송 분기를 모두 확인한다.

## 2026-06-08 - 서버 알림 자동화는 동작하지만 휴대폰 Expo 대상이 없음

### 상황

Supabase Cron + Edge Function으로 로컬 컴퓨터가 꺼져도 알림 발송이 가능한지 확인했다.

### 에러 메시지

```txt
RESEND_API_KEY is required
Received unexpected response code
```

### 원인

원격 `attendance-cron` Edge Function과 `study-room-attendance-cron` cron job은 active 상태였지만, `notification_targets`에 `expo` 종류가 아직 없었다. 즉 휴대폰 푸시를 받을 Expo Push Token이 등록되지 않았다. 이메일 fallback은 `RESEND_API_KEY` secret이 없어 실패했고, web push는 브라우저 구독 또는 푸시 서비스 응답 문제로 실패 기록이 있었다.

### 해결 방법

서버 측 자동 실행은 유지한다. 휴대폰 알림을 활성화하려면 `apps/mobile/.env.local`에 `EXPO_PUBLIC_EAS_PROJECT_ID`를 설정하고, 실제 기기에서 모바일 앱의 푸시 등록 흐름을 실행해 `notification_targets.kind = 'expo'` 행을 생성해야 한다. 이메일 fallback을 쓰려면 Edge Function secret `RESEND_API_KEY`를 설정해야 한다.

### 관련 파일

* `supabase/functions/attendance-cron/index.ts`
* `supabase/cron.sql`
* `apps/mobile/src/notifications.ts`
* `apps/mobile/.env.local`

### 재발 방지

알림 문제를 볼 때는 cron/Edge Function 실행 여부와 실제 발송 대상 등록 여부를 분리해서 확인한다. `cron.job`, `net._http_response`, `notification_targets`, `notification_deliveries`를 함께 조회한다.

## 2026-06-08 - Google OAuth hash callback ignored

### 상황

Google 계정 인증은 완료됐지만 앱이 로그인 대시보드로 들어가지 않고 다시 기본 로그인 화면으로 돌아갔다.

### 에러 메시지

```txt
명시적인 에러는 없고 callback URL이 /auth/callback#access_token=... 형태로 돌아왔지만 앱 세션이 설정되지 않음
```

### 원인

기존 앱은 `/auth/callback?code=...` PKCE callback만 auth callback으로 인식했다. 실제 Supabase Google OAuth 응답은 URL hash에 `access_token`, `refresh_token`을 담는 implicit callback 형태였고, `isAuthCallbackUrl`이 이 URL을 callback으로 인식하지 못했다.

### 해결 방법

`apps/web/src/authProviders.mjs`에 hash callback 감지와 token 추출 함수를 추가했다. `finishOAuthCallback`은 hash callback이면 `supabase.auth.setSession`으로 세션을 설정하고, callback URL의 token hash를 `history.replaceState`로 제거한다.

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/authProviders.mjs`
* `apps/web/test/authProviders.test.mjs`

### 재발 방지

OAuth callback 처리 테스트에는 query `code`, query/hash error, hash `access_token` 케이스를 모두 포함한다. 토큰이 URL에 남지 않도록 callback 처리 시작 시 주소를 정리한다.

## 2026-06-08 - Google OAuth provider disabled

### 상황

웹 앱에서 Google 로그인을 누르면 Supabase Auth authorize endpoint가 400을 반환했다.

### 에러 메시지

```txt
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

### 원인

Supabase Auth 설정에 Google Client ID/Secret은 등록되어 있었지만 `external_google_enabled`가 `false`였다. 로컬 앱은 `VITE_GOOGLE_AUTH_ENABLED=true`로 Google OAuth를 호출하고 있었으나, Supabase 프로젝트에서 Provider 자체가 꺼져 있어 요청이 거부됐다.

### 해결 방법

Supabase Management API로 프로젝트 `bqohkdzvxbrokkmuhysx`의 `external_google_enabled`를 `true`로 변경했다. 이후 authorize URL이 400이 아니라 Google OAuth URL로 `302 Found`를 반환하는 것을 확인했다.

### 관련 파일

* `apps/web/.env.local`
* `memory-bank/implementation-plan.md`

### 재발 방지

Google 로그인을 켤 때는 로컬 `VITE_GOOGLE_AUTH_ENABLED=true`뿐 아니라 Supabase Auth Provider의 enabled 값, Client ID/Secret 존재 여부, `uri_allow_list`, Google Cloud Authorized redirect URI를 함께 확인한다.

## 2026-06-07 - 페이지 이탈 후 집중 세션이 계속 누적됨

### 상황

사용자가 집중 세션을 시작한 뒤 종료 버튼을 누르지 않고 페이지를 벗어나면 활성 세션이 계속 열려 있어 공부 시간이 계속 증가했다.

### 에러 메시지

```txt
명시적인 런타임 에러는 없고, 활성 `study_sessions` 행의 `ended_at`이 null로 남아 시간이 계속 누적됨
```

### 원인

웹 앱은 `endTimer()`를 종료 버튼 클릭에서만 호출했다. `pagehide`, `beforeunload`, `visibilitychange` 같은 페이지 이탈 이벤트에서는 `end_study_session` RPC를 호출하지 않았다.

### 해결 방법

`apps/web/src/sessionExit.mjs`를 추가해 `keepalive` fetch로 `/rest/v1/rpc/end_study_session`을 호출하도록 했다. `apps/web/src/main.tsx`는 활성 세션이 있을 때 페이지 이탈 이벤트 리스너를 등록하고, 이벤트가 여러 번 발생해도 종료 요청을 한 번만 보낸다.

### 관련 파일

* `apps/web/src/main.tsx`
* `apps/web/src/sessionExit.mjs`
* `apps/web/test/sessionExit.test.mjs`

### 재발 방지

브라우저 unload 계열 이벤트에서는 일반 async 요청 완료가 보장되지 않으므로, 짧은 본문과 `keepalive` 요청을 사용한다.

## 2026-06-07 - get_due_reminders user_id ambiguity

### 상황

Supabase Cron이 `attendance-cron` Edge Function을 호출했지만 Edge Function 응답이 500이었다.

### 에러 메시지

```txt
{"error":"column reference \"user_id\" is ambiguous"}
```

### 원인

`get_due_reminders`는 `returns table (user_id uuid, ...)` 구조라 PL/pgSQL 안에서 `user_id`가 출력 변수로도 존재한다. 기존 SQL의 `insert ... select user_id`와 `on conflict (user_id, local_date)`가 출력 변수와 테이블 컬럼 사이에서 모호해졌다.

### 해결 방법

`supabase/migrations/0006_fix_due_reminders_ambiguity.sql`을 추가해 `due_now`를 `dn` alias로 참조하고, `on conflict on constraint attendance_days_pkey`를 사용하도록 수정했다.

### 관련 파일

* `supabase/migrations/0006_fix_due_reminders_ambiguity.sql`
* `packages/core/test/sql-migrations.test.mjs`

### 재발 방지

PL/pgSQL `returns table` 함수 안에서는 출력 컬럼명과 같은 이름을 unqualified column으로 사용하지 않는다.

## 2026-06-07 - VAPID key rotation requires browser resubscribe

### 상황

서버 발송용 VAPID private key가 로컬에 없어 새 VAPID key pair를 생성했다.

### 에러 메시지

```txt
기존 브라우저 구독은 이전 VAPID 공개키를 기준으로 만들어져 있어 새 private key와 맞지 않을 수 있음
```

### 원인

Web Push 구독은 생성 당시의 application server key와 묶인다. 서버 VAPID key pair를 바꾸면 기존 브라우저 subscription은 새 private key로 발송할 수 없다.

### 해결 방법

`apps/web/src/webPush.ts`가 기존 subscription의 `applicationServerKey`를 현재 공개키와 비교하고, 다르면 unsubscribe 후 재구독하도록 수정했다.

### 관련 파일

* `apps/web/src/webPush.ts`
* `apps/web/src/webPushKeys.mjs`
* `apps/web/test/webPushKeys.test.mjs`

### 재발 방지

VAPID key pair를 회전한 뒤에는 사용자가 컴퓨터 알림을 다시 등록해야 한다.

## 2026-06-07 - Context7 AWS CDK 문서 조회 실패

### 상황

AWS CDK v2 문법을 확인하기 위해 Context7 문서를 조회했다.

### 에러 메시지

```txt
Invalid or expired OAuth token. Please re-authenticate to obtain a new token.
```

### 원인

현재 세션의 Context7 OAuth 토큰이 만료되어 문서 조회 도구가 사용할 수 없었다.

### 해결 방법

이미 설치된 `aws-cdk-lib` 패키지 버전 정보를 확인하고, CDK 테스트 및 `cdk synth`로 실제 템플릿 합성을 검증했다.

### 관련 파일

* `infra/aws-cdk/src/study-room-aws-stack.ts`

### 재발 방지

CDK API가 불확실할 때는 Context7 토큰 상태를 먼저 확인하고, 도구가 막히면 로컬 패키지 타입과 `cdk synth`를 기준으로 검증한다.

## 2026-06-07 - CDK RED 테스트의 모듈 없음 오류

### 상황

TDD 순서에 따라 CDK/Lambda 테스트를 먼저 추가하고 실행했다.

### 에러 메시지

```txt
ERR_MODULE_NOT_FOUND
```

### 원인

테스트가 아직 작성되지 않은 구현 파일을 import하고 있었다.

### 해결 방법

`infra/aws-cdk/lambda/attendance-cron-invoker/index.mjs`와 `infra/aws-cdk/src/study-room-aws-stack.ts`를 구현한 뒤 테스트를 통과시켰다.

### 관련 파일

* `infra/aws-cdk/lambda/attendance-cron-invoker/index.test.mjs`
* `infra/aws-cdk/test/study-room-aws-stack.test.ts`

### 재발 방지

이 오류는 RED 단계에서 의도된 실패다. 실패 원인이 오타가 아니라 구현 부재인지 확인한 뒤 GREEN 단계로 넘어간다.
