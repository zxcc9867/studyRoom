# PRD: User Profile

## 2026-06-14 Update: Browser Session Persistence

- After a successful email OTP or OAuth login, the web app should keep the user signed in across normal browser refreshes.
- The client should restore an existing Supabase session before displaying the login form.
- The stored session consists of the Supabase access token JWT and refresh token managed by `supabase-js`.
- Session maximum lifetime and inactivity timeout are server-side Auth policy concerns and should be configured in Supabase Auth session settings when a stricter expiry is required.
- Signing out must still clear the stored browser session.

## 1. 문제 정의

사용자는 매일 정해진 시간에 독서실 앱에 들어오고 공부 타이머를 시작해야 출석으로 인정되는 습관 형성 도구가 필요하다.

## 2. 지원해야 할 시나리오

- 사용자는 웹 또는 모바일에서 로그인한다.
- 사용자는 매일 알림 시간을 설정한다.
- 사용자는 평일 20:30 기본 알림, 주말 14:00 알림을 받는다.
- 사용자는 알림 이후 30분 안에 타이머를 시작하면 즉시 출석으로 인정된다.
- 사용자가 출석 창을 놓쳐도 같은 날짜에 평일 2시간 또는 주말 4시간 이상 공부를 완료하면 출석으로 전환된다.
- 사용자가 종료 버튼을 누르지 않고 페이지를 벗어나면 시스템은 활성 공부 세션을 자동 종료한다.
- 사용자는 오늘 공부 시간, 월 공부 시간, 출석 캘린더, todo 달성률을 본다.
- 시스템은 서버 측 스케줄러로 알림을 발송한다.

## 3. 만들어야 할 것

- 정적 웹 대시보드
- Supabase Auth/DB/RLS
- Supabase Edge Function 기반 알림 처리
- AWS CDK 기반 정적 호스팅 및 예약 실행 인프라

## 4. 측정 및 출시 계획

- MVP는 개인용으로 먼저 배포한다.
- 배포 기준은 웹 대시보드 접속, 로그인, 공부 기록 저장, 예약 Lambda 호출 성공이다.

## 5. 열린 질문

- 실제 운영 도메인을 CloudFront 기본 도메인으로 쓸지 별도 커스텀 도메인을 연결할지 결정해야 한다.
- Supabase 이메일 발송 제한을 피하기 위해 SMTP/Resend Auth 설정을 할지 결정해야 한다.
