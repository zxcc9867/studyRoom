# 인프라 구성도

이 문서는 강제 출석형 독서실 앱의 현재 권장 인프라와 선택적 AWS 확장 구성을 정리한다.

## 현재 권장 구성

현재 MVP의 기본 운영 구조는 `Vercel 정적 웹 호스팅 + Supabase Auth/DB/Cron/Edge Function`이다. 웹 앱은 정적 파일로 배포되지만, 알림 발송과 출석/결석 자동 처리는 Supabase 서버 측 실행 환경에서 처리한다.

```mermaid
flowchart LR
  user["사용자<br/>PC 브라우저 / 모바일 브라우저"]
  mobile["Expo 모바일 앱"]
  vercel["Vercel<br/>Vite 정적 웹 앱"]
  supaAuth["Supabase Auth<br/>Email OTP / Google OAuth"]
  supaApi["Supabase REST/RPC<br/>RLS 적용"]
  db[("Supabase Postgres<br/>profiles<br/>study_sessions<br/>attendance_days<br/>study_todos<br/>notification_targets<br/>notification_deliveries")]
  cron["Supabase Cron<br/>pg_cron + pg_net"]
  edge["Edge Function<br/>attendance-cron"]
  webPush["Web Push<br/>컴퓨터 브라우저 알림"]
  telegram["Telegram Bot API<br/>개인 채팅 알림"]
  resend["Resend<br/>이메일 보완 알림"]
  expo["Expo Push<br/>모바일 푸시"]

  user -->|"접속"| vercel
  user -->|"로그인"| supaAuth
  mobile -->|"로그인"| supaAuth
  vercel -->|"설정/타이머/todo 저장"| supaApi
  mobile -->|"토큰/세션 저장"| supaApi
  supaApi --> db
  cron -->|"매분 호출"| edge
  edge -->|"알림 대상/오늘 todo 조회"| db
  edge -->|"발송 기록 저장"| db
  edge --> webPush
  edge --> telegram
  edge --> resend
  edge --> expo
  webPush --> user
  telegram --> user
  resend --> user
  expo --> mobile
```

## 알림과 출석 처리 흐름

```mermaid
sequenceDiagram
  autonumber
  participant U as 사용자
  participant W as 웹/모바일 앱
  participant S as Supabase DB
  participant C as Supabase Cron
  participant E as attendance-cron Edge Function
  participant N as Web Push / Telegram / Email / Expo

  U->>W: 알림 시간, 알림 대상, todo 저장
  W->>S: profiles / notification_targets / study_todos 저장
  C->>E: 매분 서버 측 호출
  E->>S: 현재 시각 기준 알림 대상 조회
  E->>S: 해당 날짜 todo 조회
  E->>N: "입장 시간 + 오늘 할 일" 알림 발송
  E->>S: notification_deliveries 기록
  U->>W: 15분 안에 입장하고 타이머 시작
  W->>S: start_study_session RPC 호출
  S-->>S: 출석 가능 시간 안이면 attendance_days = present
  E->>S: 15분 초과 미시작 사용자는 missed 처리
```

## 데이터 경계

```mermaid
flowchart TB
  client["클라이언트<br/>Vite Web / Expo App"]
  anon["Supabase anon key<br/>브라우저 공개 가능"]
  rls["RLS 정책<br/>auth.uid() 기준 본인 행만 접근"]
  service["Service role key<br/>Edge Function 전용"]
  secrets["Edge Function secrets<br/>CRON_SECRET<br/>TELEGRAM_BOT_TOKEN<br/>RESEND_API_KEY<br/>VAPID private key"]
  db[("Supabase Postgres")]

  client --> anon
  anon --> rls
  rls --> db
  service --> db
  secrets --> service
```

- 프론트엔드에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`처럼 공개 가능한 값만 들어간다.
- `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `CRON_SECRET`은 Edge Function secret 또는 서버 측 환경에만 둔다.
- 사용자 데이터 접근은 Supabase RLS가 `auth.uid()` 기준으로 제한한다.

## 선택적 AWS 구성

AWS CDK 코드는 선택적 구성이다. 비용을 최소화하려면 기본적으로 Supabase Cron을 사용하고, AWS 운영을 원할 때만 EventBridge/Lambda 또는 S3/CloudFront를 사용한다.

```mermaid
flowchart LR
  route["사용자"]
  cf["CloudFront<br/>선택적 정적 호스팅"]
  s3["S3 private bucket<br/>Vite build output"]
  event["EventBridge Scheduler<br/>선택적 스케줄러"]
  lambda["Lambda<br/>attendance-cron invoker"]
  edge["Supabase Edge Function<br/>attendance-cron"]
  db[("Supabase Postgres")]

  route --> cf
  cf --> s3
  event --> lambda
  lambda -->|"x-cron-secret"| edge
  edge --> db
```

AWS 선택 구성의 역할은 두 가지뿐이다.

- 정적 웹 파일을 S3/CloudFront로 제공한다.
- EventBridge/Lambda가 Supabase `attendance-cron` Edge Function을 호출한다.

데이터베이스, 인증, RLS, 알림 대상 관리, 실제 알림 발송 판단은 계속 Supabase가 담당한다.

## 운영 메모

- 컴퓨터가 꺼져 있으면 브라우저 Web Push는 받을 수 없다. 이 경우 Telegram, 이메일, 모바일 Expo Push 같은 외부 채널이 보완 역할을 한다.
- Vercel/S3 같은 정적 호스팅은 화면 제공만 담당한다. 정해진 시간 알림은 Supabase Cron 또는 AWS EventBridge 같은 서버 측 스케줄러가 담당해야 한다.
- Telegram 알림에는 해당 날짜 todo가 있으면 같이 포함된다.
- `attendance-cron`은 알림 발송뿐 아니라 15분 미입장 사용자의 결석 처리도 수행한다.
