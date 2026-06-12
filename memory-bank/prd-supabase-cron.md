# PRD: Supabase Cron Alarm Automation

## 1. Problem

정적 호스팅 앱은 사용자가 닫거나 컴퓨터를 꺼도 정해진 시간에 알림을 보낼 수 없다. 알림과 결석 처리는 서버 측에서 주기적으로 실행되어야 한다.

## 2. Target Users

독서실 앱을 개인 MVP로 운영하면서 AWS Lambda 없이 Supabase만으로 알림 자동 처리를 먼저 완성하려는 운영자.

## 3. Goals

- Supabase Cron이 매분 `attendance-cron` Edge Function을 호출한다.
- Edge Function이 알림 대상자를 조회하고 웹푸시/이메일/Expo Push 발송을 시도한다.
- 알림 시각에는 1차 알림을 보내고, 15분 내 타이머 시작 기록이 없으면 재촉 알림을 한 번 더 보낸다.
- 알림 후 30분까지 타이머 시작 기록이 없으면 `missed`로 처리한다.
- 브라우저 웹푸시는 현재 VAPID 공개키와 맞는 subscription으로 저장된다.

## 4. Non-goals

- Resend 계정/API key 발급은 이번 범위가 아니다.
- Expo EAS project 생성은 이번 범위가 아니다.
- AWS EventBridge/Lambda를 삭제하지 않는다.

## 5. User Stories

```md
- As an operator, I want Supabase to run the reminder worker every minute, so that reminders work without my local server.
- As a web user, I want computer notification registration to refresh stale push subscriptions, so that web push delivery uses the current VAPID key.
- As a student, I want missed attendance to be marked automatically, so that the app reflects my actual habit.
```

## 6. User Scenarios

### Normal Flow

1. 사용자가 웹앱에서 알림 시간을 저장한다.
2. 웹앱이 `profiles.reminder_time`과 `notification_targets`를 저장한다.
3. Supabase Cron이 매분 `attendance-cron`을 호출한다.
4. Edge Function이 `get_due_reminders`와 `mark_missed_attendance`를 실행한다.
5. 알림 시각에는 `reminder_stage = initial` 알림이 발송되고 `attendance_days.status = pending`이 저장된다.
6. 15분 뒤에도 출석 타이머 시작이 없으면 `reminder_stage = nudge` 재촉 알림이 발송된다.
7. 30분 뒤에도 출석 타이머 시작이 없으면 `attendance_days.status = missed`로 바뀐다.
8. 발송 결과가 `notification_deliveries`에 저장된다.

### Edge Cases

* VAPID key가 바뀐 경우 기존 브라우저 subscription을 해제하고 다시 구독한다.
* 지금 보낼 알림이 없으면 Edge Function은 200과 `dueReminderCount: 0`을 반환한다.

### Error Cases

* `CRON_SECRET`이 다르면 Edge Function은 401을 반환한다.
* Resend API key가 없으면 email target 발송은 실패로 기록될 수 있다.
* Expo token이 없으면 휴대폰 알림은 발송 대상이 없다.

## 7. Functional Requirements

* [x] Edge Function secrets에 `CRON_SECRET`을 설정한다.
* [x] Edge Function secrets에 Web Push VAPID key pair를 설정한다.
* [x] Vault에 `project_url`, `cron_secret`을 설정한다.
* [x] `study-room-attendance-cron` cron job을 등록한다.
* [x] `get_due_reminders` SQL ambiguity를 수정한다.
* [x] 웹푸시 구독이 현재 VAPID 공개키와 다르면 재구독한다.
* [x] `get_due_reminders`가 `initial`과 `nudge` reminder stage를 구분한다.
* [x] 알림 후 15분에 재촉 알림을 발송하고, 알림 후 30분에 결석 처리한다.

## 8. Non-functional Requirements

* 성능: cron은 매분 1회만 실행한다.
* 보안: `cron_secret`은 Vault와 Edge Function secret에만 저장한다.
* 접근성: 기존 웹 UI 흐름은 유지한다.
* 확장성: AWS Lambda invoker와 Supabase Cron 중 하나를 선택할 수 있게 유지한다.
* 유지보수성: SQL 회귀 테스트와 Web Push key 유틸 테스트를 포함한다.

## 9. Dependencies

* 내부 의존성: `attendance-cron` Edge Function, `notification_targets`
* 외부 의존성: Supabase Cron, Supabase Vault, pg_net
* Supabase: project `bqohkdzvxbrokkmuhysx`
* API: Expo Push, Web Push, Resend
* 환경 변수: `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`, Edge Function secrets

## 10. Success Metrics

* 자동 cron 호출이 `net._http_response`에서 200을 반환한다.
* `npm.cmd test`가 통과한다.
* `npm.cmd run build`가 통과한다.

## 11. Rollout Plan

* 개발: SQL/Web Push 보강
* 테스트: 로컬 테스트 및 원격 RPC 분리 검증
* 배포: Supabase Management API로 secrets/Vault/cron 적용
* 모니터링: `net._http_response`, `notification_deliveries` 확인

## 12. Open Questions

* Resend API key를 언제 설정할지 결정해야 한다.
* Expo EAS project id를 언제 설정할지 결정해야 한다.
