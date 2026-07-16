# 강제 출석형 독서실

매일 정해진 시간에 입장해 공부를 시작하도록 압박하고, 계획 → 집중 → 회고 → 조정 → 보상으로 이어지는 개인용 학습 습관 앱입니다. 웹은 Vite/React와 Three.js, 모바일은 Expo React Native, 인증·데이터·RPC·알림 자동화는 Supabase를 사용합니다.

[운영 앱 열기](https://study-room-attendance.vercel.app/) · [프로덕션 배포 workflow](https://github.com/zxcc9867/studyRoom/actions)

![강제 출석형 독서실 썸네일](docs/images/study-room-thumbnail.png)

> 현재 구현 기준: 2026-07-16. 사용자 기능과 운영 구조의 요약은 이 README에, 세부 요구사항·결정·진행 이력은 `memory-bank`에 기록합니다.

## 핵심 학습 흐름

1. 이메일 OTP 또는 선택적으로 Google OAuth로 로그인합니다.
2. 날짜별 todo, 시간 계획, 반복 일정, 목표/D-day를 구성합니다.
3. 평일 사용자 알림 시각 또는 주말 고정 시각에 Supabase Cron이 Web Push, Slack, 이메일 보완 알림을 발송합니다.
4. 알림 후 15분에는 재촉 알림을 보내고, 30분 안에 세션을 시작하지 않으면 결석 처리합니다.
5. 웹과 Expo 모바일 모두 미완료 당일 todo를 1개 이상 선택해야 세션을 시작할 수 있으며, 계획 화면에서 todo를 바로 추가할 수 있습니다.
6. 새 세션은 1시간 유지 시간으로 시작합니다. `세션 유지`는 1시간씩 연장하지만 현재 시각 기준 남은 시간은 최대 2시간을 넘지 않습니다.
7. 웹 카메라 감시는 상반신 존재 여부를 브라우저 안에서만 판정하고, 5분 경고와 10분 이후 공부 시간 일시정지를 적용합니다.
8. 수동 종료 시 세션 회고에서 집중도, 에너지, 방해 요인, 메모, 다음 행동과 완료 todo를 저장합니다.
9. 내 페이지의 주간 리뷰가 이번 주와 지난주를 비교하고, 설정의 적응형 알림이 최근 28일 공부 시작 패턴을 반영합니다.
10. 출석 연속일은 공부의 숲 나무·가구·야외 보상으로 이어지고, 결석이나 반복 자리 비움은 회복 루틴으로 연결됩니다.

## 세션 유지 정책

- 기본 유지 시간: 세션 시작 시 1시간
- 유지 버튼: 1회 누를 때 1시간 연장 요청
- 잔여 상한: 현재 시각 기준 최대 2시간
- 예시: 30분 남음 → 1시간 30분, 1시간 30분 남음 → 2시간
- 웹과 Slack 버튼은 같은 `extend_study_session_lease` RPC를 사용하므로 서버에서 동일하게 상한을 강제합니다.
- 만료 5분 전 Slack 경고를 보내고, 열린 웹 앱은 15초마다 서버 마감 시각을 동기화합니다.
- 유지 시간이 만료되면 앱이 세션을 종료하고 만료 이후 시간은 공부 시간에서 제외합니다.

## 주요 기능

### 계획과 공부 세션

- 날짜별 todo, 시작/종료 시각, 자정 경과 일정, 요일 반복, 무기한 반복 그룹 편집
- 원형 데일리 플래너, 일정 겹침 대상과 정확한 겹침 시간 표시
- 여러 날짜로 계획 복사, todo 직접 완료, 완료 이력과 월별 통계
- 목표/D-day, 목표별 todo 연결과 진행률
- 서버 원자적 세션 시작·종료: todo 링크, todo 완료, 세션 종료, 회고를 일관되게 저장

### 지속 학습 루프

- 세션 회고: 집중도, 에너지, 방해 요인, 메모, 다음 행동
- 주간 리뷰: 월요일~일요일 기준 공부 시간, 완료율, 출석, 회고 지표와 지난주 비교
- 적응형 알림: 최근 28일 중 날짜별 첫 완료 세션 시작 시각의 중앙값을 15분 단위로 추천
- 최소 3일 표본이 있을 때 추천하며, 사용자가 켜면 서버가 평일 알림 시각을 지속적으로 조정

### 공부의 숲

- Three.js 기반 저폴리 3D 섬, 강, 다리, 집, 정원, 조명, 반딧불이와 시간대 환경
- 물·집·가구·주요 오브젝트 충돌과 다리 경유 이동
- 키보드/WASD, 모바일 방향 버튼, 클릭·터치 이동과 자동 산책
- 집 출입, 실내 이동, 실제 문을 통한 퇴장
- 7일 연속 출석마다 완성 나무 1개, 정확한 7일차 중복 방지, 날짜 공백 시 연속일 중단
- 1/3/5/7일 실내 보상과 완성 나무 수 기반 새집·피크닉·모닥불 보상
- 섬 테마, 집 포인트 색상, 대표 야외 보상을 사용자별 Supabase 설정으로 저장
- 아침, 낮, 해질녘, 밤에 따라 하늘·안개·조명·해와 달이 변화

### 출석, 카메라와 회복

- 평일 2시간, 주말 4시간 목표와 늦은 공부 합계에 따른 출석 회복
- 웹 카메라 상반신 감지, 5분 자리 비움 경고, 10분 이후 공부 시간 제외
- 사진, 영상, 얼굴 특징값, 포즈 랜드마크 원본은 저장하지 않고 이벤트 메타데이터만 저장
- 결석/반복 자리 비움 회복 요청, 앱·Slack 회복 루틴, 보충 todo와 내일 약속
- 회복 이력, 주간 회복 요약, 원인 분류

### 알림과 진단

- Web Push 컴퓨터 알림, Slack Bot 채널 알림, Resend 이메일 fallback
- Slack 테스트 알림, Channel ID/User ID 저장, 세션 만료 경고와 사용자 멘션
- todo 시작·종료 임박 알림과 Slack 일정 연장
- 브라우저 권한, Slack 설정, 최근 발송 결과를 보여주는 알림 진단
- Supabase Cron + Edge Function 기반 서버 발송이므로 브라우저나 PC가 꺼져 있어도 예약 알림 처리 가능
- Kakao와 Telegram은 현재 활성 UI/발송 경로에서 제외하고 과거 데이터만 보존

### 웹과 Expo 모바일

- 웹: 전체 플래너, 카메라 감시, 회복 루틴, 주간 리뷰, 적응형 알림, Three.js 공부의 숲
- Expo 모바일: 이메일 OTP, 오늘 출석/세션, 당일 todo 선택·빠른 추가, 동일한 세션 시작 정책, 알림 시간 저장
- 모바일의 모든 로딩/저장/RPC 오류는 사용자에게 표시하고 busy 상태를 해제
- 모바일 카메라 감시는 별도 PRD 승인 전까지 지원하지 않음

## 프로젝트 구조

```txt
apps/
  web/             Vite React 웹 대시보드와 Three.js 공부의 숲
  mobile/          Expo React Native 모바일 앱
packages/
  core/            출석 판정, 날짜, OTP, 알림, SQL migration 테스트
supabase/
  migrations/      테이블, RLS, RPC, 트리거 마이그레이션
  functions/       attendance-cron, camera-presence-warning,
                   slack-recovery-interactions, slack-test-alarm
infra/
  aws-cdk/         선택적 S3/CloudFront/EventBridge/Lambda 인프라
memory-bank/       PRD, 설계, 현재 맥락, 진행, 문제 해결 기록
docs/
  images/          README 이미지
```

## 시스템 구성

- 웹 앱은 정적 Vite 앱으로 Vercel에 배포되며 기능 단위 `React.lazy`와 React/Supabase/MediaPipe/Three.js vendor 청크를 사용합니다.
- Expo 앱은 동일한 Supabase 프로젝트와 RPC를 사용합니다.
- 사용자 데이터는 Supabase Postgres에 저장되고 RLS와 명시적 권한으로 사용자별 접근을 제한합니다.
- 세션 시작·완료·유지, 회복 제출, 일정 연장은 Postgres RPC로 처리합니다.
- Supabase Cron이 `attendance-cron` Edge Function을 호출하고, Edge Function이 Web Push·Slack·이메일을 발송합니다.
- `main` 푸시는 GitHub Actions에서 `npm ci`, 전체 테스트, 웹 build 후 Vercel production을 배포합니다.

자세한 구성은 [인프라 구성도](docs/infrastructure-architecture.md)와 [구현 계획](memory-bank/implementation-plan.md)을 참고합니다.

## 주요 데이터

- `profiles`: 시간대, 평일 알림, 적응형 알림 설정
- `attendance_days`: 일별 출석 상태
- `study_todos`, `study_goals`: 계획, 반복, 목표
- `study_sessions`, `study_session_todos`: 세션, lease, 연결 todo
- `study_session_reflections`: 세션 회고
- `study_forest_preferences`: 공부의 숲 사용자 설정
- `study_recovery_requests`, `study_recovery_weekly_reports`: 회복 루틴
- `notification_targets`, `notification_deliveries`: 알림 대상과 발송 이력
- `study_presence_events`: 미디어가 아닌 카메라 상태 이벤트

## 환경 변수

실제 키와 토큰은 커밋하지 않습니다. 로컬은 `.env.example`을 참고합니다.

```txt
# Web
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_WEB_PUSH_VAPID_PUBLIC_KEY
VITE_GOOGLE_AUTH_ENABLED

# Expo mobile
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_EAS_PROJECT_ID

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
```

## 로컬 실행

```bash
npm.cmd install
npm.cmd run dev:web
```

웹 기본 주소는 `http://127.0.0.1:5173`이며 포트가 사용 중이면 Vite가 다음 포트를 선택합니다.

```bash
npm.cmd run dev:mobile
```

## 검증

```bash
npm.cmd test
npm.cmd run build
npm.cmd --workspace apps/mobile run typecheck
```

전체 테스트는 출석 정책, OAuth/OTP, 카메라, session lease, todo/플래너, Slack, 회복, 지속 학습, 공부의 숲, README와 SQL migration 계약을 포함합니다.

## 배포

### GitHub Actions / Vercel

- `.github/workflows/vercel-production.yml`은 `main` push에서 Node.js 24로 테스트와 웹 build를 실행합니다.
- 성공하면 Vercel CLI 48.6.0으로 production을 배포합니다.
- Vercel output은 `apps/web/dist`이며 SPA route는 `index.html`로 rewrite됩니다.

### Supabase

1. `supabase/migrations`의 신규 SQL을 Supabase MCP 또는 CLI로 적용합니다.
2. 변경된 Edge Function만 기존 JWT/서명 정책을 유지해 배포합니다.
3. Edge Function secret과 Supabase Vault 값은 저장소 문서에 실제 값으로 기록하지 않습니다.
4. 배포 후 RLS, 함수 실행 권한, migration 목록, advisors와 주요 RPC 결과를 확인합니다.

### AWS 선택 구성

`infra/aws-cdk`는 정적 호스팅과 Supabase Edge Function 호출자를 AWS로 운영할 때만 사용합니다.

```bash
npm.cmd run infra:synth
```

## 보안 원칙

- service role key, Slack token/signing secret, Resend key, VAPID private key는 프론트엔드에 넣지 않습니다.
- 공개 스키마 테이블은 RLS와 사용자 소유권 정책을 사용합니다.
- `SECURITY DEFINER` RPC는 입력·소유권을 검사하고 `public/anon` 실행 권한을 제거합니다.
- 카메라 미디어와 생체 특징은 저장하지 않습니다.
- README와 `memory-bank`에 실제 사용자 ID, 채널 ID, 이메일, 토큰을 기록하지 않습니다.

## 상세 문서

README는 현재 사용자 기능과 운영 구조의 요약입니다. 요구사항, 설계 결정, 변경 이력은 다음 문서가 기준입니다.

- [지속 학습 루프 PRD](memory-bank/prd-sustainable-study-loop.md)
- [공부의 숲 PRD](memory-bank/prd-study-forest.md)
- [세션 활동/lease PRD](memory-bank/prd-session-activity-heartbeat.md)
- [Slack 알림 PRD](memory-bank/prd-slack-notifications.md)
- [사용자 프로필 PRD](memory-bank/prd-user-profile.md)
- [구현 계획](memory-bank/implementation-plan.md)
- [현재 작업 맥락](memory-bank/active-context.md)
- [진행 이력](memory-bank/progress.md)
- [문제 해결 기록](memory-bank/trouble-shooting.md)
