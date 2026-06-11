# PRD: AWS CDK Deployment

## 1. Problem

정적 호스팅만으로는 독서실 앱의 예약 알림 요구사항을 만족할 수 없다. 사용자가 컴퓨터를 꺼도 설정된 시간에 알림이 발송되려면 서버 측 스케줄 실행 환경이 필요하다.

## 2. Target Users

개인용 MVP를 저비용으로 배포하려는 앱 운영자.

## 3. Goals

- Vite 웹 대시보드를 AWS에 배포할 수 있어야 한다.
- 매분 서버 측 스케줄러가 Supabase `attendance-cron` Edge Function을 호출해야 한다.
- AWS 고정 비용을 만들 수 있는 리소스를 피해야 한다.
- CDK 코드로 재현 가능한 인프라를 구성해야 한다.

## 4. Non-goals

- Supabase DB/Auth를 AWS로 이전하지 않는다.
- 모바일 앱 빌드/배포는 이번 범위가 아니다.
- 커스텀 도메인/ACM 인증서는 이번 범위가 아니다.
- Secrets Manager는 기본 사용하지 않는다.

## 5. User Stories

```md
- As an operator, I want to deploy the web dashboard as static files, so that I do not need to run a server.
- As an operator, I want AWS to call the Supabase cron function every minute, so that reminders are sent even when my local computer is off.
- As an operator, I want infrastructure as code, so that I can recreate or destroy the environment safely.
```

## 6. User Scenarios

### Normal Flow

1. 운영자가 웹앱 환경 변수를 설정한다.
2. 운영자가 `npm.cmd run infra:synth`로 템플릿을 확인한다.
3. 운영자가 `cdk deploy`에 `CronSecret`을 전달한다.
4. AWS가 CloudFront URL과 Lambda 스케줄러를 생성한다.
5. EventBridge가 매분 Lambda를 호출한다.
6. Lambda가 Supabase `attendance-cron`을 호출한다.

### Edge Cases

* `AttendanceCronUrl`이 다른 Supabase 프로젝트를 가리키면 deploy parameter로 override한다.
* 웹 라우트 새로고침 시 CloudFront `403`/`404`를 `/index.html`로 fallback한다.

### Error Cases

* `CronSecret`이 Supabase Edge Function과 다르면 Lambda 호출은 실패한다.
* Supabase Edge Function이 비정상 응답을 반환하면 Lambda가 에러를 던지고 CloudWatch Logs에 남긴다.

## 7. Functional Requirements

* [x] S3 private bucket을 생성한다.
* [x] CloudFront OAC로만 S3 객체를 읽을 수 있게 한다.
* [x] Vite `apps/web/dist`를 S3에 배포한다.
* [x] EventBridge rule을 1분 주기로 생성한다.
* [x] Lambda가 Supabase `attendance-cron`에 POST 요청을 보낸다.
* [x] `CronSecret`은 NoEcho parameter로 받는다.
* [x] Secrets Manager 리소스를 기본 생성하지 않는다.

## 8. Non-functional Requirements

* 성능: CloudFront 캐시와 gzip/brotli 압축을 사용한다.
* 보안: S3 bucket public access를 차단한다.
* 접근성: 기존 웹 UI 변경은 하지 않는다.
* 확장성: 추후 커스텀 도메인과 Secrets Manager를 추가할 수 있는 구조를 유지한다.
* 유지보수성: CDK stack test와 Lambda unit test를 포함한다.

## 9. Dependencies

* 내부 의존성: `apps/web` Vite build
* 외부 의존성: AWS account, AWS CDK bootstrap
* Supabase: `attendance-cron` Edge Function, `CRON_SECRET`
* API: Supabase Edge Function HTTP endpoint
* 환경 변수: `apps/web/.env.local`

## 10. Success Metrics

* `npm.cmd run infra:test` 성공
* `npm.cmd run infra:build` 성공
* `npm.cmd run infra:synth` 성공
* 배포 후 CloudFront URL에서 웹앱 접속 가능
* 배포 후 Lambda CloudWatch Logs에서 Supabase cron 호출 성공 확인

## 11. Rollout Plan

* 개발: CDK 코드와 테스트 작성
* 테스트: 로컬 synth 검증
* 배포: AWS credential 설정 후 `cdk deploy`
* 모니터링: Lambda CloudWatch Logs 확인

## 12. Open Questions

* 운영 도메인을 CloudFront 기본 도메인으로 쓸지 커스텀 도메인을 연결할지 결정해야 한다.
* MVP 이후 `CronSecret`을 Secrets Manager로 옮길지 결정해야 한다.
