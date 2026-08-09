# 강제 출석형 독서실

매일 정해진 시간에 입장해 공부를 시작하도록 압박하고, 계획 → 집중 → 회고 → 조정 → 보상으로 이어지는 개인용 학습 습관 앱입니다. 웹은 Vite/React와 Three.js, 모바일은 Expo React Native, 인증·데이터·RPC·알림 자동화는 Supabase를 사용합니다.

[운영 앱 열기](https://study-room-attendance.vercel.app/) · [프로덕션 배포 workflow](https://github.com/zxcc9867/studyRoom/actions)

![강제 출석형 독서실 썸네일](docs/images/study-room-thumbnail.png)

> 현재 구현 기준: 2026-08-09. 사용자 기능과 운영 구조의 요약은 이 README에, 세부 요구사항·결정·진행 이력은 `memory-bank`에 기록합니다.

## 핵심 학습 흐름

1. 앱은 저장된 Supabase 세션을 먼저 복원하고 이메일 OTP 또는 선택적으로 Google OAuth로 로그인합니다. 초기 확인이 12초 안에 끝나지 않으면 로그인 화면에서 상태 확인을 다시 시도하거나 새 로그인을 진행할 수 있습니다.
2. 날짜별 todo, 시간 계획, 반복 일정, 목표/D-day를 구성합니다.
3. 평일 사용자 알림 시각 또는 주말 고정 시각에 Supabase Cron이 Web Push, Slack, 이메일 보완 알림을 발송합니다. 이미 출석한 날에도 설정 시각의 초기 알림은 1회 발송됩니다.
4. 아직 출석하지 않은 날만 알림 후 15분에 재촉하고 30분 안에 세션을 시작하지 않으면 결석 처리합니다. 이미 출석한 날은 재촉하지 않고 결석으로 바꾸지 않습니다.
5. 웹과 Expo 모바일 모두 미완료 당일 todo를 1개 이상 선택해야 세션을 시작할 수 있습니다. 웹에서는 시작 모달에서 새 todo의 제목과 시작·종료 시간을 함께 입력하면 오늘 타임 스케줄에 즉시 반영되고 세션 할 일로 자동 선택됩니다. Expo 모바일의 빠른 추가는 현재 제목 입력만 지원합니다.
6. 새 세션은 1시간 유지 시간으로 시작합니다. `+1시간 연장`은 누를 때마다 1시간씩 연장하지만 현재 시각 기준 남은 시간은 최대 2시간을 넘지 않습니다.
7. 공부 중 왼쪽 버튼은 `잠시 쉬기`로 바뀌며, 휴식 중에는 `공부 계속하기`로 전환됩니다. 휴식 시간은 공부 시간에서 제외되고 새로고침 후에도 유지됩니다. 웹 휴식 카드에서는 10·20·40분 복귀 약속을 정하고 정확한 복귀 시각과 남은 시간을 볼 수 있습니다.
8. 웹 카메라 감시는 상반신 존재 여부를 브라우저 안에서만 판정하고, 5분 경고와 10분 이후 공부 시간 일시정지를 적용합니다.
9. 수동 종료 시 세션 회고에서 집중도, 에너지, 방해 요인, 메모, 다음 행동과 완료 todo를 저장합니다.
10. 종료 때 회고하지 못해도 내 페이지의 회고 인박스에서 최근 7일 완료 세션을 최대 3개까지 다시 돌아보고 다음 행동을 남길 수 있습니다.
11. 오늘 화면은 `10분 시작 → 일일 2·4시간 목표 → 할 일 1개 완료`를 별도 습관 성장 단계로 보여 주고, 최근 회고의 다음 행동을 세션 계획에 이어 줍니다.
12. Today는 긴 단일 대시보드 대신 `집중·계획·기록` 탭으로 나뉩니다. 집중에는 타이머·카메라, 계획에는 오늘 할 일·원형 타임 스케줄, 기록에는 최근 7일 숲길·출석 기록이 있습니다.
13. 활성 세션의 오늘 유효 공부시간이 첫 10분을 향해 가는 진행도를 보여 주고, 달성하면 `조금 더 이어가기` 또는 기존 회고 흐름으로 `오늘은 마무리`를 선택할 수 있습니다.
14. 같은 화면의 최근 7일 숲길은 날짜별 `쉼·10분·목표·꽃`, 시작 성공 일수와 이어온 시작을 보여 줍니다. 최근 7일 중 5번 시작을 기본 목표로 삼아 이틀의 휴식 여백을 허용합니다. 하루 쉰 뒤에는 기록을 실패로 초기화하지 않고 `다시 잇는 날`과 `10분으로 다시 잇기`를 기존 최상단 단일 시작 버튼 문맥에 반영합니다.
15. 내 페이지의 주간 리뷰가 이번 주와 지난주를 비교하고, 같은 방해 요인이 이번 주 완료 세션에서 2회 이상 반복되면 다음 세션 전에 바꿀 환경 한 가지를 안내합니다. 설정의 적응형 알림은 최근 28일 공부 시작 패턴을 반영합니다.
16. 출석 연속일은 공부의 숲 나무·가구·야외 보상으로 이어집니다. 5/7 작은 시작은 나무 둘레의 씨앗 조명과 회수되지 않는 누적 반딧불 화환이 되며, 결석이나 반복 자리 비움은 회복 루틴으로 연결됩니다.

## 세션 유지 정책

- 기본 유지 시간: 세션 시작 시 1시간
- 유지 버튼(`+1시간 연장`): 1회 누를 때 1시간 연장 요청
- 잔여 상한: 현재 시각 기준 최대 2시간
- 예시: 30분 남음 → 1시간 30분, 1시간 30분 남음 → 2시간
- 웹과 Slack 버튼은 같은 `extend_study_session_lease` RPC를 사용하므로 서버에서 동일하게 상한을 강제합니다.
- 만료 5분 전 Slack 경고를 보내고, 웹 앱은 15초마다 서버 마감 시각을 동기화합니다.
- 유지 시간이 만료되면 기존 분 단위 서버 Cron이 세션을 마감 시각에 자동 종료합니다. 브라우저가 닫혀 있어도 만료 이후 시간은 공부 시간에 저장되지 않습니다.

## 주요 기능

### 계획과 공부 세션

- Today의 계획 탭은 오늘 할 일과 원형 타임 스케줄을 함께 보여 줍니다. 시간 범위가 저장된 todo만 원형 스케줄에 표시됩니다.
- 웹의 `오늘의 공부 시작` 모달에서 새 할 일을 빠르게 추가할 때 시작·종료 시간을 함께 저장합니다. 기본값은 다음 30분 단위부터 1시간이며, 저장한 todo는 타임 스케줄과 이번 세션 선택 목록에 즉시 반영됩니다.
- 날짜별 todo, 시작/종료 시각, 자정 경과 일정, 요일 반복, 무기한 반복 그룹 편집
- todo 시작·종료 시간은 오전/오후와 숫자 표시 영역 어디를 클릭·더블클릭하거나 Enter/Space를 눌러도 시간 선택기가 열림
- 원형 데일리 플래너, 일정 겹침 대상과 정확한 겹침 시간 표시
- 여러 날짜로 계획 복사, todo 직접 완료, 완료 이력과 월별 통계
- 목표/D-day, 목표별 todo 연결과 진행률
- 서버 원자적 세션 시작·휴식·재개·종료: 휴식 누적, todo 링크, todo 완료, 세션 종료, 회고를 일관되게 저장
- 휴식 중 공부 시간은 멈추지만 세션 lease는 계속 감소하며, 종료 시 진행 중 휴식까지 자동 제외
- 웹 휴식 복귀 약속: 10·20·40분 프리셋, 현지 복귀 시각과 초 단위 카운트다운, `10분 더`, 약속 지우기, 세션 lease 선행 만료 안내. 사용자·세션별 localStorage에만 저장하며 자동 재개하지 않음

### 지속 학습 루프

- 세션 회고: 집중도, 에너지, 방해 요인, 메모, 다음 행동
- 회고 인박스: 내 페이지에서 최근 7일 완료·미회고 세션을 최근순 최대 3개까지 날짜와 공부시간으로 확인하고, 기존 회고 모달로 나중에 저장. 저장된 다음 행동은 Today의 단일 시작 제안과 주간 리셋에 즉시 반영
- 오늘 습관 단계: 10분 공부를 최소 습관 성공으로 인정하되 기존 평일 2시간·주말 4시간 출석 목표와 todo 완료를 더 높은 단계로 유지
- 첫 10분 체크포인트: 오늘 완료 시간과 현재 활성 세션의 유효 시간을 합산해 남은 시간을 보여 주고, 첫 10분 달성 시 `조금 더 이어가기`·`오늘은 마무리`를 선택. 확인 여부만 사용자·세션·현지 날짜별 localStorage에 저장
- 지난 세션 이어하기: 최신 non-null `next_action` 1건을 불러와 같은 오늘 todo를 선택하거나 빠른 추가 입력에 미리 채우며 카메라·회복·todo 시작 게이트는 그대로 적용
- 최근 7일 습관 리듬: 오늘까지의 이동 7일을 `쉼·10분·목표·꽃`으로 표시하고, 10분 시작 일수와 연속 시작을 총 공부 시간과 분리해 강조. 5/7 유연 목표와 이틀 휴식 안내는 유지하되, 실행은 회고·주간 목표·오늘 todo 맥락을 반영하는 최상단 시작 버튼 하나로 통합
- 부드러운 복귀 신호: 오늘·어제가 10분 미만이고 더 이른 최근 7일에 성공 기록이 있으며 5/7 목표 미달일 때만 `다시 잇는 날`을 표시. 처음 시작·어제 성공·목표 달성 후 휴식에는 적용하지 않고 새 CTA나 벌점을 만들지 않음
- 휴식 복귀 약속: 막연한 `나중에` 대신 돌아올 시각을 정하는 작은 실행 계획으로 휴식 이탈을 줄이고, 시간이 지나도 벌점 없이 기존 `공부 계속하기` 흐름으로 돌아감
- 주간 숲 보상: 완료 세션 기준 이동 7일 안의 다섯 번째 10분 시작마다 반딧불 화환을 획득하고, 겹치는 보상은 7일 간격으로 제한하며 이미 얻은 화환은 현재 진행도와 무관하게 누적 보존
- 주간 리뷰: 월요일부터 오늘까지의 완료 세션 공부 시간, 완료율, 출석, 회고 지표를 지난주 같은 요일까지 비교하며 지난주 시간·분 비교 및 오늘 기준 표시
- 주간 마찰 계획: 이번 주 완료 세션 회고에서 같은 방해가 2회 이상 반복될 때만 휴대폰·소음·피로·일정·기타 중 가장 빈번하고 최근인 한 가지를 골라, 새 버튼 없이 다음 시작 전 환경 조정을 안내
- 주간 리셋 연결: 회고의 `다음 행동`을 다시 입력하지 않고 기존 todo 날짜·시간 모달로 옮기며, 같은 미완료 계획이 있으면 날짜와 `계획 보기`를 표시해 중복 생성을 막음
- 적응형 알림: 최근 28일 중 날짜별 첫 완료 세션 시작 시각의 중앙값을 15분 단위로 추천
- 최소 3일 표본이 있을 때 추천하며, 사용자가 켜면 서버가 평일 알림 시각을 지속적으로 조정

### 공부의 숲

- Three.js 기반 저폴리 3D 섬, 강, 다리, 집, 정원, 조명, 반딧불이와 시간대 환경
- 물·집·가구·주요 오브젝트 충돌, 강을 직교해 건너는 다리, 진행 방향 양옆 난간과 캐릭터 반경 기반 중앙 통로
- 다리 데크의 아치 높이에 맞춰 캐릭터의 월드 높이를 부드럽게 보간
- 키보드/WASD, 모바일 방향 버튼, 클릭·터치 이동과 자동 산책
- 집 출입, 실내 이동, 열린 문·문턱·바닥 표식이 있는 실제 출구를 통한 퇴장
- 7일 연속 출석마다 완성 나무 1개, 정확한 7일차 중복 방지, 날짜 공백 시 연속일 중단
- 1/3/5/7일 실내 보상과 완성 나무 수 기반 새집·피크닉·모닥불 보상
- 최근 7일 5/7 진행도는 현재 나무 주변 다섯 씨앗으로 표시하고, 획득한 반딧불 화환은 완료 세션 이력에서 다시 계산해 영구 꽃 표식과 누적 수로 유지
- 섬 테마, 집 포인트 색상, 대표 야외 보상을 카테고리형 아이템 그리드에서 고르고 사용자별 Supabase 설정으로 저장
- 잠금 항목은 이름 대신 `?` 아이템으로 표시하고 필요한 완성 나무 수를 안내
- 아침, 낮, 해질녘, 밤에 따라 하늘·안개·조명·해와 달이 변화

### 출석, 카메라와 회복

- 평일 2시간, 주말 4시간 목표와 늦은 공부 합계에 따른 출석 회복
- 웹 카메라 상반신 감지, 5분 자리 비움 경고, 10분 이후 공부 시간 제외
- 카메라 시작 응답을 15초로 제한하고 세션 종료 시 진행 중 요청을 무효화하며, 세션이 없을 때는 버튼 잠금 대신 사용 조건을 안내
- 사진, 영상, 얼굴 특징값, 포즈 랜드마크 원본은 저장하지 않고 이벤트 메타데이터만 저장
- 결석/반복 자리 비움 회복 요청, 앱·Slack 회복 루틴, 보충 todo와 내일 약속
- 회복 이력, 주간 회복 요약, 원인 분류

### 알림과 진단

- Web Push 컴퓨터 알림, Slack Bot 채널 알림, Resend 이메일 fallback
- 출석 여부와 독립된 설정 시각 초기 알림 1회: 이미 출석이면 `오늘 출석 완료` 문구를 보내고 재촉·결석 처리를 생략
- `attendance_days`의 초기·재촉 claim 시각으로 매분 Cron 중복 발송 방지
- Slack 테스트 알림, Channel ID/User ID 저장, 세션 만료 경고와 사용자 멘션
- todo 시작·종료 임박 알림과 Slack 일정 연장
- 브라우저 권한, Slack 설정, 최근 발송 결과를 보여주는 알림 진단
- Supabase Cron + Edge Function 기반 서버 발송이므로 브라우저나 PC가 꺼져 있어도 예약 알림 처리 가능
- Kakao와 Telegram은 현재 활성 UI/발송 경로에서 제외하고 과거 데이터만 보존

### 웹과 Expo 모바일

- 웹: `집중·계획·기록`으로 분리한 Today, 단계형 오늘 습관, 첫 10분 실시간 체크포인트, 휴식 복귀 약속, 5/7 유연 목표가 포함된 최근 7일 숲길, 회고 인박스와 지난 세션 이어하기, 시간표가 포함된 전체 플래너, 카메라 감시, 회복 루틴, 주간 리뷰, 적응형 알림, Three.js 공부의 숲
- Expo 모바일: 이메일 OTP, 오늘 출석/세션, 당일 todo 선택·제목 기반 빠른 추가, 동일한 세션 시작·휴식·재개 정책, 세션 유지, 원자적 종료 회고와 완료 todo 저장, 알림 시간 저장
- 모바일의 모든 로딩/저장/RPC 오류는 사용자에게 표시하고 busy 상태를 해제
- 모바일 카메라 감시는 별도 PRD 승인 전까지 지원하지 않음

## 프로젝트 구조

```txt
apps/
  web/             Vite React 대시보드(집중·계획·기록 Today)와 Three.js 공부의 숲
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
- 웹의 세션 시작 빠른 추가는 `study_todos.start_time`·`end_time`을 저장하므로, 새 할 일은 별도 복사 없이 오늘 원형 타임 스케줄에 표시됩니다.
- 오늘·월간·주간 공부 시간은 사용자 시간대 기준으로 자정 경과 세션을 나누는 `get_study_period_summary` RPC를 단일 기준으로 사용하며, 12시간 초과 장기 기록은 삭제하지 않고 검토 필요 건수로 표시합니다.
- 주간 마찰 계획은 이미 My Page에 로드된 현재 주 완료 세션과 회고만 한 번 순회합니다. 1회·`none`·알 수 없는 값은 무시하고 추가 query·스키마·RPC·서버 쓰기를 만들지 않습니다.
- 최근 7일 숲길·5/7 목표·부드러운 복귀 신호·누적 반딧불 화환은 이미 사용자 범위로 로드된 세션·todo를 재사용합니다. 과거 날짜와 화환 획득일은 같은 시간대 비례 배분 규칙으로 계산하고, 목표 진행도·복귀 여부·CTA도 클라이언트에서 파생해 추가 API 부하를 만들지 않습니다.
- Supabase Cron이 `attendance-cron` Edge Function을 호출하고, Edge Function이 Web Push·Slack·이메일을 발송합니다.
- `main` 푸시는 GitHub Actions에서 `npm ci`, 전체 테스트, 웹 build 후 Vercel production을 배포합니다.
- 휴식 복귀 약속은 기존 1초 화면 시계를 재사용하고 사용자·세션별 브라우저 localStorage에 deadline만 저장합니다. Supabase 휴식 상태·lease·공부 시간의 원천 데이터는 변경하지 않습니다.

자세한 구성은 [인프라 구성도](docs/infrastructure-architecture.md)와 [구현 계획](memory-bank/implementation-plan.md)을 참고합니다.

## 주요 데이터

- `profiles`: 시간대, 평일 알림, 적응형 알림 설정
- `attendance_days`: 일별 출석 상태, 초기·재촉 알림의 1회 claim 시각
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

전체 테스트는 출석 정책, OAuth/OTP, 카메라, session lease, 휴식 복귀 약속, 첫 10분 체크포인트, 주간 마찰 계획, 주간 리셋 연결, todo/플래너, Slack, 회복, 지속 학습, 공부의 숲, README와 SQL migration 계약을 포함합니다.

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
- [인증 초기화 복구 PRD](memory-bank/prd-auth-initialization-recovery.md)
- [회고 인박스 PRD](memory-bank/prd-reflection-inbox.md)
- [단일 상태 적응형 시작 액션 PRD](memory-bank/prd-single-start-action.md)
- [단계형 오늘 습관 PRD](memory-bank/prd-daily-habit-loop.md)
- [최근 7일 습관 리듬 PRD](memory-bank/prd-weekly-habit-rhythm.md)
- [첫 10분 체크포인트 PRD](memory-bank/prd-ten-minute-checkpoint.md)
- [5/7 유연 시작 목표 PRD](memory-bank/prd-flexible-weekly-start-goal.md)
- [하루 쉰 뒤 부드러운 복귀 신호 PRD](memory-bank/prd-gentle-restart-cue.md)
- [5/7 공부의 숲 보상 PRD](memory-bank/prd-weekly-forest-reward.md)
- [공부의 숲 PRD](memory-bank/prd-study-forest.md)
- [휴식 복귀 약속 PRD](memory-bank/prd-break-return-plan.md)
- [주간 리셋 연결 PRD](memory-bank/prd-weekly-reset-bridge.md)
- [주간 마찰 계획 PRD](memory-bank/prd-weekly-friction-plan.md)
- [세션 활동/lease PRD](memory-bank/prd-session-activity-heartbeat.md)
- [세션 lease 만료 강제 PRD](memory-bank/prd-session-lease-expiry.md)
- [세션 휴식/재개 PRD](memory-bank/prd-study-session-breaks.md)
- [Slack 알림 PRD](memory-bank/prd-slack-notifications.md)
- [사용자 프로필 PRD](memory-bank/prd-user-profile.md)
- [세션 할 일 연결 PRD](memory-bank/prd-session-todo-links.md)
- [일일 플래너 대시보드 PRD](memory-bank/prd-daily-planner-dashboard.md)
- [구현 계획](memory-bank/implementation-plan.md)
- [현재 작업 맥락](memory-bank/active-context.md)
- [진행 이력](memory-bank/progress.md)
- [문제 해결 기록](memory-bank/trouble-shooting.md)
