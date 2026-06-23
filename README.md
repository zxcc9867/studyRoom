# 강제 출석형 독서실

매일 정해진 시간에 독서실에 입장하고 공부 세션을 시작하도록 압박하는 개인용 학습 습관 앱입니다. 웹 대시보드는 Vercel에 정적 앱으로 배포되고, 인증/DB/알림/출석 자동 처리는 Supabase가 담당합니다.

[운영 앱 열기](https://study-room-attendance.vercel.app/)

![강제 출석형 독서실 썸네일](docs/images/study-room-thumbnail.png)

## 핵심 흐름

1. 사용자는 이메일 OTP 또는 Google OAuth로 로그인합니다.
2. 매일 알림 시간이 되면 Supabase Cron이 Edge Function을 호출해 알림을 보냅니다.
3. 알림 후 15분에는 한 번 더 재촉 알림을 보내고, 30분 안에 세션을 시작하지 않으면 결석 처리합니다.
4. 세션 시작 전에는 오늘 할 일을 1개 이상 선택해야 합니다. 미리 등록하지 않았어도 세션 계획 모달에서 바로 추가할 수 있습니다.
5. 공부 중에는 카메라 감시가 상반신 존재 여부를 브라우저 안에서만 판정합니다. 사진/영상/랜드마크 원본은 저장하지 않습니다.
6. 결석 또는 반복 자리 비움이 발생하면 Slack 회복 루틴을 통해 사유, 보충 과제, 내일 약속을 남깁니다.

## 주요 기능

- Supabase Auth 기반 이메일 OTP 로그인과 Google OAuth 로그인
- 평일 알림 시간 설정, 주말 고정 알림 시간
- 알림 후 30분 출석 창과 15분 재촉 알림
- 평일 2시간, 주말 4시간 목표 기반 늦은 출석 회복
- 오늘 공부 시간, 월 누적 공부 시간, 출석 캘린더
- 날짜별 todo, 선택 시간, 요일 반복, 반복 그룹 편집
- 세션 시작 전 todo 선택과 세션 모달 내 빠른 todo 추가
- 목표/D-day 관리와 목표별 todo 연결
- 내 페이지에서 계정 정보와 완료한 todo 이력 확인
- 카메라 기반 상반신 감지, 5분 경고, 10분 자동 일시정지
- Web Push 컴퓨터 알림, Slack Bot 알림, Resend 이메일 보완 알림
- Supabase Cron + Edge Function 기반 서버 측 알림/결석 자동 처리
- 선택적 AWS CDK 인프라: S3/CloudFront 정적 호스팅과 EventBridge/Lambda 호출자

## 프로젝트 구조

```txt
apps/
  web/             Vite React 웹 대시보드
  mobile/          Expo React Native 모바일 앱
packages/
  core/            출석 판정, 날짜, OTP, 알림 보조 로직
supabase/
  migrations/      DB 테이블, RLS, RPC 마이그레이션
  functions/       attendance-cron, camera-presence-warning,
                   slack-recovery-interactions, slack-test-alarm
infra/
  aws-cdk/         선택적 AWS 배포 인프라
memory-bank/       제품/설계/진행 문서
docs/
  images/          README 썸네일과 문서 이미지
```

## 시스템 구성

웹 앱은 정적 Vite 앱으로 빌드되어 Vercel 또는 S3/CloudFront 같은 정적 호스팅에 올릴 수 있습니다. 사용자별 데이터, 인증, RLS, 알림 대상, 출석 기록은 Supabase가 관리합니다.

정해진 시간 알림은 브라우저가 꺼져 있어도 동작해야 하므로 클라이언트가 직접 예약하지 않습니다. Supabase Cron이 `attendance-cron` Edge Function을 주기적으로 호출하고, Edge Function이 알림 대상자를 조회해 Web Push, Slack, 이메일 fallback을 발송합니다.

카메라 감시는 웹 브라우저에서만 수행합니다. 서버에는 `camera_started`, `absence_warning` 같은 이벤트 메타데이터만 저장하고, 이미지/영상/얼굴 특징값은 저장하지 않습니다.

자세한 인프라 구성도와 알림/출석 처리 흐름은 [인프라 구성도](docs/infrastructure-architecture.md)를 참고합니다.

## 환경 변수

`.env.example`을 기준으로 로컬 `.env` 또는 배포 환경 변수를 설정합니다. 실제 키와 토큰은 커밋하지 않습니다.

```txt
# Web dashboard
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_WEB_PUSH_VAPID_PUBLIC_KEY
VITE_GOOGLE_AUTH_ENABLED

# Supabase Edge Functions / scheduler
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
WEB_PUSH_VAPID_PUBLIC_KEY
WEB_PUSH_VAPID_PRIVATE_KEY
WEB_PUSH_SUBJECT
RESEND_API_KEY
RESEND_FROM_EMAIL
SLACK_BOT_TOKEN
SLACK_SIGNING_SECRET
APP_ORIGIN

# Expo mobile
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_EAS_PROJECT_ID
```

## 로컬 실행

```bash
npm.cmd install
npm.cmd run dev:web
```

웹 앱 기본 주소는 Vite 설정에 따라 `http://127.0.0.1:5177` 또는 사용 가능한 다음 포트가 됩니다.

모바일 앱은 Expo로 실행합니다.

```bash
npm.cmd run dev:mobile
```

## 검증

```bash
npm.cmd test
npm.cmd run build
```

테스트는 출석 정책, OTP/OAuth, Web Push, Slack 알림, 카메라 감시, 세션 lease, todo 반복/시간 설정, 목표, 회복 루틴, 세션-todo 연결, SQL migration 검증을 포함합니다.

## 배포

### Vercel

1. Vercel 프로젝트에 `apps/web` Vite 빌드 환경 변수를 설정합니다.
2. `vercel.json` 기준으로 정적 웹 앱을 배포합니다.
3. Supabase Auth redirect URL에 배포 URL과 `/auth/callback`을 등록합니다.

### Supabase

1. `supabase/migrations` SQL을 적용합니다.
2. `attendance-cron`, `camera-presence-warning`, `slack-recovery-interactions`, `slack-test-alarm` Edge Function을 배포합니다.
3. Edge Function secrets에 `CRON_SECRET`, VAPID 키, Resend 키, Slack bot token, Slack signing secret 등을 설정합니다.
4. Supabase Vault에 `project_url`, `cron_secret`을 저장합니다.
5. `supabase/cron.sql`로 pg_cron 일정을 등록합니다.

### AWS 선택 구성

`infra/aws-cdk`는 정적 호스팅과 Supabase Edge Function 호출자를 AWS로 운영하고 싶을 때 사용합니다. MVP에서는 Supabase Cron만으로도 알림 자동 처리가 가능합니다.

```bash
npm.cmd run infra:synth
```

## 보안 메모

- Supabase service role key, Slack bot token, Slack signing secret, Resend key, VAPID private key는 프론트엔드에 넣지 않습니다.
- 사용자 데이터는 Supabase RLS를 기준으로 본인 데이터만 접근하도록 제한합니다.
- Slack Channel ID는 사용자별 `notification_targets`에 저장하고, bot token은 Edge Function secret으로만 관리합니다.
- 카메라 사진/영상/얼굴 특징값/포즈 랜드마크 원본은 저장하지 않습니다.
- README나 memory-bank에 실제 토큰, Chat ID, Channel ID, 개인 이메일을 기록하지 않습니다.
