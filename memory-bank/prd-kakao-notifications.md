# PRD: Kakao Notifications

## 2026-06-14 Deprecation

Kakao notifications are no longer part of the active MVP product path.

- Web UI no longer exposes Kakao notification linking.
- The active auth provider helper no longer requests Kakao `talk_message` linking options.
- `attendance-cron` no longer sends Kakao Memo messages.
- Enabled `notification_targets.kind = 'kakao_memo'` rows and enabled `kakao_message_connections` rows are disabled by migration `0018_disable_kakao_notifications.sql`.
- Historical migrations, delivery records, and legacy rows remain for audit/history compatibility.
- Slack Bot API is the selected server-side message channel for the current MVP.

## 1. Problem

컴퓨터 웹 푸시는 브라우저/기기 상태에 영향을 받고, 사용자는 휴대폰 카카오톡 "나와의 채팅방"으로도 독서실 입장 알림을 받고 싶어 한다.

## 2. Target Users

개인용 MVP 사용자가 웹 대시보드에서 기존 Supabase 계정에 카카오 계정을 연결하고, 설정된 알림 시간에 카카오톡으로 입장 알림을 받는다.

## 3. Goals

- 웹 앱 설정 화면에 카카오톡 알림 연결 버튼을 제공한다.
- Kakao OAuth 요청에 `talk_message` scope를 포함한다.
- Kakao provider access/refresh token을 사용자 직접 조회 테이블이 아닌 서버 전용 테이블에 저장한다.
- `attendance-cron` Edge Function이 `kakao_memo` 알림 대상을 처리하고 Kakao "나에게 보내기" API를 호출한다.

## 4. Non-goals

- 친구에게 메시지 보내기는 구현하지 않는다.
- 카카오톡 채널 비즈 메시지는 구현하지 않는다.
- Kakao REST API key/client secret 발급과 카카오 개발자 콘솔 설정은 코드로 자동화하지 않는다.

## 5. User Stories

```md
- As a student, I want to connect KakaoTalk notifications to my current account, so that I can receive reminders on my phone.
- As an operator, I want Kakao tokens stored outside user-managed notification targets, so that raw provider tokens are not exposed through RLS-readable tables.
```

## 6. User Scenarios

### Normal Flow

1. 사용자가 로그인한다.
2. 설정 화면에서 `카카오톡 알림 연결`을 누른다.
3. Supabase Auth `linkIdentity`가 Kakao OAuth로 이동하며 `talk_message` scope를 요청한다.
4. OAuth callback에서 provider token을 받아 `kakao-token` Edge Function으로 보낸다.
5. Edge Function이 Kakao token을 검증하고 `kakao_message_connections`와 `notification_targets.kind = 'kakao_memo'`를 저장한다.
6. Supabase Cron이 `attendance-cron`을 호출하고, due reminder가 있으면 Kakao "나에게 보내기" API로 알림을 보낸다.

### Edge Cases

- Supabase Manual Linking이 꺼져 있으면 연결 버튼은 실패 메시지를 표시한다.
- Kakao access token이 만료되면 `attendance-cron`이 refresh token으로 갱신한다.
- `KAKAO_REST_API_KEY` secret이 없으면 만료 후 갱신이 실패한다.

### Error Cases

- `talk_message` 동의가 누락되면 Kakao 발송 API가 실패할 수 있다.
- refresh token이 없거나 revoke되면 `notification_deliveries`에 실패로 기록된다.

## 7. Functional Requirements

- [x] `kakao_message_connections` 테이블을 추가한다.
- [x] `notification_targets`와 `notification_deliveries`가 `kakao_memo`를 허용한다.
- [x] `kakao-token` Edge Function을 추가한다.
- [x] `attendance-cron`에 Kakao "나에게 보내기" 발송을 추가한다.
- [x] 웹 앱에 카카오톡 알림 상태와 연결 버튼을 추가한다.
- [ ] Supabase Auth Manual Linking을 운영자가 활성화한다.
- [ ] Edge Function secrets `KAKAO_REST_API_KEY`, 필요 시 `KAKAO_CLIENT_SECRET`, `APP_ORIGIN`을 운영자가 설정한다.

## 8. Non-functional Requirements

- 보안: Kakao raw token은 사용자 직접 select/update 정책이 없는 테이블에 저장한다.
- 유지보수성: Kakao token 저장은 `kakao-token`, 실제 알림 발송은 `attendance-cron`으로 분리한다.
- 확장성: 기존 `notification_targets` 채널 모델에 `kakao_memo`를 추가한다.

## 9. Dependencies

- 내부 의존성: Supabase Auth session, `notification_targets`, `attendance-cron`
- 외부 의존성: Kakao OAuth, KakaoTalk Message REST API
- Supabase: Edge Function secrets, Manual Linking
- API: `https://kapi.kakao.com/v2/api/talk/memo/default/send`
- 환경 변수: `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `APP_ORIGIN`

## 10. Success Metrics

- 카카오 연결 후 `notification_targets.kind = 'kakao_memo'`가 생성된다.
- `attendance-cron`이 카카오 대상 발송 결과를 `notification_deliveries`에 기록한다.
- `npm.cmd test`와 `npm.cmd run build`가 통과한다.

## 11. Rollout Plan

- 개발: 로컬 코드, 마이그레이션, Edge Function 작성
- 테스트: Node 테스트, Vite build, 원격 schema/function 상태 확인
- 배포: Supabase DB DDL 적용, `kakao-token`, `attendance-cron` 배포
- 모니터링: `notification_deliveries`, `net._http_response`, Edge Function logs 확인

## 12. Open Questions

- 운영 도메인 배포 후 `APP_ORIGIN`을 어떤 URL로 설정할지 정해야 한다.
