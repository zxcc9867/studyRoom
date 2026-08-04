# PRD: User Profile

## 2026-06-14 Update: Browser Session Persistence

- After a successful email OTP or OAuth login, the web app should keep the user signed in across normal browser refreshes.
- The client should restore an existing Supabase session before displaying the login form.
- Initial session restoration must stop waiting after 12 seconds and show the normal login form with a retryable recovery notice.
- The recovery notice must not expose tokens or raw backend errors, and login buttons must remain usable after timeout.
- Retrying the stored-session check must invalidate older UI attempts without deleting the stored Supabase session.
- A valid session received later through `onAuthStateChange` should still restore the signed-in dashboard.
- Detailed requirements are defined in `memory-bank/prd-auth-initialization-recovery.md`.
- The stored session consists of the Supabase access token JWT and refresh token managed by `supabase-js`.
- Session maximum lifetime and inactivity timeout are server-side Auth policy concerns and should be configured in Supabase Auth session settings when a stricter expiry is required.
- Signing out must still clear the stored browser session.

## 1. 문제 정의

사용자는 매일 정해진 시간에 독서실 앱에 들어오고 공부 타이머를 시작해야 출석으로 인정되는 습관 형성 도구가 필요하다.

## 2. 지원해야 할 시나리오

- 사용자는 웹 또는 모바일에서 로그인한다.
- 사용자는 매일 알림 시간을 설정한다.
- 사용자는 평일 20:30 기본 알림, 주말 14:00 알림을 받는다.
- 사용자는 이미 출석한 날에도 설정 시각의 초기 알림을 한 번 받는다.
- 이미 출석한 날의 알림은 출석 완료 상태를 알려주며 재촉이나 결석 경고를 만들지 않는다.
- 사용자는 알림 이후 30분 안에 타이머를 시작하면 즉시 출석으로 인정된다.
- 사용자가 출석 창을 놓쳐도 같은 날짜에 평일 2시간 또는 주말 4시간 이상 공부를 완료하면 출석으로 전환된다.
- 아직 출석하지 않은 사용자는 기존처럼 15분 재촉과 30분 결석 판정을 적용받는다.
- 사용자가 공부 중 페이지를 벗어나면 시스템은 활성 공부 세션을 자동 종료한다.
- 사용자는 식사·외출 등으로 잠시 쉬고 같은 세션을 재개할 수 있으며, 휴식 시간은 공부 시간에서 제외된다.
- 휴식 중 페이지를 벗어나도 세션은 lease 만료 전까지 유지되고 복귀 후 재개할 수 있다.
- 사용자는 오늘 공부 시간, 월 공부 시간, 출석 캘린더, todo 달성률을 본다.
- 사용자는 10분 공부를 최소 습관 성공으로 확인하고 기존 일일 목표와 todo 완료까지의 다음 단계를 본다.
- 사용자는 활성 세션에서 오늘 누적 첫 10분까지 남은 유효 공부시간을 보고, 달성 후 조금 더 이어가거나 기존 회고 흐름으로 마무리할 수 있다.
- 사용자는 최근 세션 회고의 다음 행동을 오늘 세션 계획으로 이어 갈 수 있다.
- 사용자는 주간 리뷰의 다음 행동을 기존 날짜·시간 todo 모달로 옮기고, 이미 계획된 미완료 행동의 날짜를 확인·수정할 수 있다.
- 사용자는 최근 7일의 10분 시작 일수와 연속 시작을 날짜별 성장 단계로 확인하며, 오늘이 진행 중일 때 어제까지의 기록을 잃지 않는다.
- 사용자는 최근 7일 중 5번 시작을 유연 목표로 확인하고 이틀을 쉴 수 있으며, 오늘 단계 문맥이 반영된 최상단 단일 시작 액션으로 기존 세션 준비 흐름을 연다.
- 사용자는 하루 쉰 뒤에도 이전 시작을 실패로 잃지 않고, 목표 미달일 때 오늘 10분으로 숲길을 다시 잇는 안내를 받는다.
- 사용자는 5/7 시작 진행도를 공부의 숲 씨앗 조명으로 확인하고, 완료 세션으로 획득한 반딧불 화환을 이후 휴식 주에도 누적 보유한다.
- 시스템은 서버 측 스케줄러로 알림을 발송한다.

## 3. 만들어야 할 것

- 정적 웹 대시보드
- Supabase Auth/DB/RLS
- Supabase Edge Function 기반 알림 처리
- 출석 판정과 분리된 단계형 오늘 습관 및 회고 다음 행동 이어하기
- 오늘 완료 시간과 활성 세션 유효 시간을 합산하고 확인 여부만 로컬에 저장하는 첫 10분 체크포인트
- 주간 회고 문장을 중복 없이 기존 todo 계획으로 전환하는 주간 리셋 연결
- 이미 로드된 세션·todo로 계산하는 비징벌적 최근 7일 습관 리듬
- 이틀의 휴식 여백과 최상단 단일 시작 액션 문맥을 제공하는 5/7 유연 시작 목표
- 기존 7일 리듬에서 결정적으로 계산하고 두 번째 CTA를 만들지 않는 부드러운 복귀 신호
- 기존 완료 세션에서 결정적으로 재계산하는 5/7 반딧불 화환 누적 보상
- AWS CDK 기반 정적 호스팅 및 예약 실행 인프라

## 4. 측정 및 출시 계획

- MVP는 개인용으로 먼저 배포한다.
- 배포 기준은 웹 대시보드 접속, 로그인, 공부 기록 저장, 예약 Lambda 호출 성공이다.

## 5. 열린 질문

- 실제 운영 도메인을 CloudFront 기본 도메인으로 쓸지 별도 커스텀 도메인을 연결할지 결정해야 한다.
- Supabase 이메일 발송 제한을 피하기 위해 SMTP/Resend Auth 설정을 할지 결정해야 한다.

## 2026-07-21 Update: Break Return Plan

- 웹 사용자는 휴식 중 10·20·40분 뒤 복귀 약속을 정하고 현지 복귀 시각과 남은 시간을 본다.
- 복귀 약속이 지나도 실패나 벌점으로 표시하지 않고 기존 `공부 계속하기`로 같은 세션에 돌아간다.
- `10분 더`는 현재 시각과 기존 약속 중 늦은 시각부터 10분을 더하고, 약속 지우기는 휴식 자체를 끝내지 않는다.
- 복귀 약속이 session lease보다 늦으면 유지 시간이 먼저 끝날 수 있음을 안내한다.
- 복귀 deadline은 사용자·세션별 브라우저 localStorage에만 저장하며 서버 데이터와 다른 기기에는 동기화하지 않는다.
- 재개·종료 성공 시 deadline을 제거하고, 카메라 준비나 resume RPC 실패 시 기존 약속을 유지한다.

## 2026-07-21 Update: Weekly Reset Bridge

- 웹 사용자는 주간 리뷰의 다음 행동에서 `계획에 넣기`를 눌러 오늘 날짜와 정규화된 제목이 채워진 기존 todo 모달을 연다.
- 같은 제목의 미완료 todo가 있으면 새 계획 CTA 대신 저장된 날짜와 `계획 보기`를 제공한다.
- 완료 todo는 새 계획을 막지 않으며, 잘못된 기존 날짜는 날짜 문구만 숨기고 계획됨 상태는 유지한다.
- 모달을 여는 것만으로 서버 데이터를 쓰지 않고 기존 저장·편집·RLS 흐름만 재사용한다.
- 새 Supabase 요청·스키마·RPC·정책·환경 변수·Expo 변경은 없다.

## 2026-07-21 Update: Reflection Inbox

- 웹 사용자는 내 페이지에서 최근 7일의 완료·미회고 세션을 최근순 최대 3개까지 확인한다.
- 회고 데이터가 성공적으로 로드되기 전에는 미회고 여부를 추정하지 않는다.
- 사용자는 기존 집중도·에너지·방해 요인·메모·다음 행동 필드를 사용해 나중 회고를 저장한다.
- 나중 회고는 todo 완료나 세션 시간을 바꾸지 않으며 벌점·출석 실패·강제 팝업을 만들지 않는다.
- 저장한 세션은 인박스에서 사라지고 non-null 다음 행동은 Today의 단일 시작 제안과 주간 리셋에 즉시 반영된다.
- reflection 쓰기는 사용자 자신이 소유한 completed session에만 연결돼야 한다.
- Expo 모바일 인박스는 웹 사용성을 확인한 뒤 별도 결정한다.

## 2026-07-21 Update: Weekly Friction Plan

- 웹 사용자는 이번 주 완료 세션에서 같은 방해 요인을 두 번 이상 기록했을 때 주간 리뷰에서 한 가지 환경 조정안을 본다.
- 한 번뿐인 방해, `방해 없음`, null, 알 수 없는 값은 문제로 단정하거나 표시하지 않는다.
- 여러 요인이 반복되면 가장 많은 횟수, 가장 최근 발생, 고정 순서로 하나만 선택한다.
- 안내는 휴대폰·소음/환경·피로·일정·기타에 맞는 제목, 구체적 준비 행동, 짧은 실행 단서를 텍스트로 제공한다.
- 안내는 새 버튼, 자동 todo, 벌점, 알림 또는 서버 쓰기를 만들지 않고 기존 단일 시작 CTA를 유지한다.
- 이미 로드된 세션·회고만 재사용하며 Supabase와 Expo 계약을 변경하지 않는다.
- 상세 요구사항과 검증 근거는 `memory-bank/prd-weekly-friction-plan.md`를 따른다.

## 2026-07-21 Update: Gentle Restart Cue

- 오늘과 어제가 10분 미만이고 더 이른 최근 7일에 성공 기록이 있으며 5/7 목표 미달일 때 `다시 잇는 날`을 표시한다.
- 복귀 상태에서는 기존 주간 문맥을 `10분으로 다시 잇기`로 바꾸되 회고의 다음 행동이 있으면 `이어서 준비하기` 우선순위를 유지한다.
- 처음 시작, 어제 성공, 오늘 10분 달성, 5/7 목표 달성 후 휴식에는 복귀 상태를 적용하지 않는다.
- 복귀 안내는 비대화형 텍스트이며 기존 최상단 시작 버튼 외에 새 CTA를 추가하지 않는다.
- 벌점, 연속일 초기화, 자동 세션 시작, 새 Supabase 요청·스키마·RPC·RLS·Edge Function·환경 변수·localStorage·Expo 변경은 없다.
- 상세 요구사항은 `memory-bank/prd-gentle-restart-cue.md`를 따른다.
