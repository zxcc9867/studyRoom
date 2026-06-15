# PRD: Slack Bot Notifications

## 2026-06-15 Update: Recovery Routine Buttons and Modal

- Slack is now the active recovery workflow after missed attendance or repeated camera absence.
- Recovery messages use Block Kit buttons because the user must submit a structured Slack modal.
- `slack-recovery-interactions` verifies Slack signatures, opens a `views.open` modal, and stores submitted recovery details.
- Recovery submission creates a makeup todo for the recovery date and a pledge todo for the next local date.
- Pending recovery requests block new study sessions until submitted.
- `SLACK_SIGNING_SECRET` is required in Supabase Edge Function secrets, and the Slack App Interactivity Request URL must point to `/functions/v1/slack-recovery-interactions`.

## 2026-06-15 Update: Readable Slack Message Format

- Slack scheduled reminders, test alarms, and camera warnings must be easy to scan in Slack.
- Use emoji-led plain-text sections in `chat.postMessage.text`; do not introduce Block Kit for this MVP.
- Scheduled reminders must include `출석 마감`, `오늘 할 일`, `지금 할 일`, and `앱 열기` sections.
- Slack test alarms must include setup confirmation, today's todo summary, and the app link.
- Camera warnings must include the camera/absence status, next action, and the app link.
- This message-format update must not change Slack token storage, Channel ID storage, notification target lookup, or DB schema.

## 2026-06-14 Update: Clear Per-User Save Action and Kakao Removal

- The settings screen must expose a clear `Slack 채널 저장` action next to the Slack Channel ID field.
- Saving the channel must create or update the logged-in user's `notification_targets.kind = 'slack'` row.
- The Slack test alarm button must remain separate from saving; testing is meaningful only after the per-user target exists.
- Kakao notification UI and active sending are removed from the product path. Legacy Kakao DB rows are preserved but disabled.
- Legacy remote `kakao-token` and `telegram-test-alarm` Edge Functions are removed from Supabase production.
- If Slack warnings say no target is registered, the user should save the Slack Channel ID from the app settings for the current account.

## 2026-06-14 Update: Secret Alias and Direct Test

- Slack Edge Functions must read `SLACK_BOT_TOKEN` first and fall back to `STUDY_ALERT_SLACK_BOT_TOKEN`.
- `STUDY_ALERT_SLACK_BOT_TOKEN` exists because the user configured the Slack bot token with a project-specific secret name.
- `slack-test-alarm` must support cron-secret protected direct test calls with `{ "channelId": "C..." }` or `{ "channelId": "G..." }`.
- Direct channel tests verify Slack bot token, channel ID, and bot channel membership, but they do not replace the user-specific `notification_targets.kind = 'slack'` row needed for scheduled reminders.
- If camera warnings say Slack is missing, it means the logged-in Supabase account has no enabled Slack notification target. The user must save Slack Channel ID in the app settings even if the server bot token direct test already succeeded.
- Token values must never be printed, committed, or stored in memory-bank.

## 1. Problem

Telegram 알림은 개인 MVP에서 동작했지만, 사용자는 Slack bot 기반 알림을 원한다. 알림은 로컬 브라우저나 컴퓨터가 꺼져 있어도 Supabase Cron과 Edge Function을 통해 서버 측에서 발송되어야 한다.

## 2. Target Users

Slack workspace를 사용하는 개인 사용자. 정해진 시간에 독서실 앱에 들어오고, 재촉 알림과 카메라 경고를 Slack 채널에서 받고 싶어 한다.

## 3. Goals

- Slack Bot API `chat.postMessage`로 독서실 알림을 보낸다.
- Slack bot token은 Supabase Edge Function secret에만 저장한다.
- 웹 설정 화면에서 Slack Channel ID를 명확한 저장 버튼으로 저장한다.
- 웹 설정 화면에서 Slack 테스트 알림을 보낼 수 있다.
- 예약 알림, 15분 재촉 알림, 오늘 할 일 요약을 Slack으로 보낸다.
- 카메라 자리 비움/카메라 켜기 경고도 Slack으로 보낸다.
- Telegram/Kakao UI와 새 발송 경로는 제거한다.

## 4. Non-goals

- Slack Incoming Webhook 방식.
- Slack DM 발송.
- Slack OAuth 설치 플로우 자동화.
- 과거 Telegram delivery 기록 삭제.
- 과거 Kakao delivery 기록 또는 legacy schema 삭제.

## 5. User Stories

- As a student, I want Slack reminders, so that I can receive study-room check-in alerts in my workspace.
- As a student, I want a Slack test alarm button, so that I can verify setup from the app.
- As a student, I want camera warnings in Slack, so that I notice when I leave my seat too long.

## 6. User Scenarios

### Normal Flow

1. 사용자가 Slack 앱을 만들고 bot token을 Supabase secret에 설정한다.
2. 사용자가 Slack 채널에 bot을 초대한다.
3. 사용자가 웹 설정 화면에 `C...` 또는 `G...` Channel ID를 저장한다.
4. 사용자가 `Slack 테스트 알림`을 눌러 수동 발송을 확인한다.
5. Supabase Cron이 `attendance-cron`을 호출한다.
6. `attendance-cron`이 due reminder를 찾고 Slack 메시지를 보낸다.
7. 오늘 할 일이 있으면 Slack 본문에 compact todo summary를 포함한다.
8. 카메라 경고가 발생하면 `camera-presence-warning`이 같은 Slack target으로 메시지를 보낸다.

### Edge Cases

- Slack Channel ID가 없으면 Slack target을 만들지 않는다.
- Channel ID가 `C...` 또는 `G...` 형식이 아니면 저장하지 않는다.
- Slack bot이 채널에 없거나 권한이 부족하면 Slack API 실패를 `notification_deliveries`에 기록한다.
- Telegram target은 migration에서 disabled 처리하되 과거 delivery 기록은 보존한다.
- Kakao target과 connection은 migration에서 disabled 처리하되 과거 DB 기록은 보존한다.

### Error Cases

- `SLACK_BOT_TOKEN`이 없으면 Slack delivery가 failed로 기록된다.
- Slack API가 `ok: false`를 반환하면 실패로 기록된다.
- 인증 없는 `slack-test-alarm` 요청은 401을 반환한다.

## 7. Functional Requirements

- [x] `notification_targets.kind`와 `notification_deliveries.channel`에 `slack`을 추가한다.
- [x] 기존 enabled Telegram target을 비활성화한다.
- [x] Slack Channel ID 저장 helper와 validation을 추가한다.
- [x] 설정 화면에 Slack 상태, Channel ID 입력, `Slack 채널 저장`, 테스트 버튼을 추가한다.
- [x] `attendance-cron`에 Slack Bot API 발송 분기를 추가한다.
- [x] `slack-test-alarm` Edge Function을 추가한다.
- [x] `camera-presence-warning`을 Slack 발송으로 전환한다.
- [x] Telegram UI와 새 발송 경로를 제거한다.
- [x] Kakao UI와 active sending path를 제거하고 legacy Kakao targets/connections를 비활성화한다.

## 8. Non-functional Requirements

- 보안: `SLACK_BOT_TOKEN`은 frontend, DB row, memory-bank에 기록하지 않는다.
- 유지보수성: Slack도 기존 `notification_targets` 모델을 사용한다.
- 신뢰성: 모든 Slack 발송 결과는 `notification_deliveries`에 기록한다.

## 9. Dependencies

- Supabase: `notification_targets`, `notification_deliveries`, Edge Function secrets
- API: Slack Bot API `chat.postMessage`
- 환경 변수: `SLACK_BOT_TOKEN`, `APP_ORIGIN`

## 10. Success Metrics

- `notification_targets.kind = 'slack'` target이 저장된다.
- Slack 테스트 알림이 `notification_deliveries.channel = 'slack'`로 기록된다.
- 예약 알림과 카메라 경고가 Slack으로 발송된다.
- `npm.cmd test`와 `npm.cmd run build`가 통과한다.

## 11. Rollout Plan

- 개발: SQL migration, Edge Functions, web UI, tests.
- 배포: Supabase migration 적용, Edge Function 배포, `SLACK_BOT_TOKEN` secret 설정, Vercel 배포.
- 모니터링: `notification_deliveries`, Edge Function logs, `net._http_response`.

## 12. Open Questions

- Slack DM 발송을 후속 기능으로 추가할지 여부.
