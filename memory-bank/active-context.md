# Active Context

## 2026-08-09 - Timed session planning and production deployment

- The start-study session modal now collects a title plus start/end time for a quick-added task.
- Quick-added session tasks are saved with `study_todos.start_time` and `study_todos.end_time`, selected automatically, and therefore appear in Today's time schedule.
- The default is the next half-hour through one hour later; the learner can edit both values before adding the task.
- Production deployment completed at commit `2c3e3b0`; the production URL returned HTTP 200.
- README now documents the split Today domains and the timed session quick-add flow.
- Session lease controls now say `+1시간 연장` and explain that two hours is a cap on remaining time from the current time.

## 현재 작업

- 작업명: 출석 완료 상태의 정시 알림 정책 구현 및 Supabase 적용
- 작업 목적: 이미 출석인 날에도 설정 시각 초기 알림을 보내고, 해당 상태에서는 재촉이나 결석 전환이 발생하지 않도록 출석 판정과 알림 발송을 분리한다.
- 관련 PRD: `memory-bank/prd-supabase-cron.md`, `memory-bank/prd-slack-notifications.md`, `memory-bank/prd-user-profile.md`
- 관련 파일: `supabase/migrations/20260722133736_send_initial_reminder_when_present.sql`, `supabase/functions/attendance-cron/index.ts`, `packages/core/test/sql-migrations.test.mjs`, `README.md`

## 최근 결정 사항

- 결정: 설정 시각의 초기 알림은 출석 여부와 관계없이 1회 발송하고, 이미 `present`이면 출석 완료 전용 문구를 사용한다.
- 이유: 출석 판정은 학습 기록의 결과이고 설정 알림은 사용자가 요청한 시간 약속이므로 서로 독립적으로 유지해야 한다.
- 대안: 출석 완료 시 모든 알림을 억제하는 기존 정책은 사용자 요청으로 폐기했다.
- 영향 범위: `attendance_days` 알림 claim 열, `get_due_reminders()` 반환 계약, Edge Function 채널별 문구·payload, SQL 회귀 테스트, PRD·README가 변경됐다.

## 현재 상태

- 완료: 초기·재촉 알림 claim 열과 원자적 UPSERT/UPDATE를 포함한 migration을 추가했다.
- 완료: `get_due_reminders()`가 `attendance_already_present`를 반환하고, 이미 출석이면 초기 알림만 1회 claim하며 재촉과 결석에서 제외하도록 변경했다.
- 완료: Slack·Web Push·Expo·Email이 출석 완료 문맥을 전달하고 Slack에는 결석 경고 없는 전용 한국어 문구를 적용했다.
- 완료: Supabase 원격 migration `20260722133736_send_initial_reminder_when_present`와 `attendance-cron` v28을 적용했다.
- 완료: 원격 롤백 시나리오에서 출석 완료와 미출석 흐름, 중복 방지, 최종 상태를 검증했고 전체 331개 테스트와 production build를 통과했다.
- 막힌 부분: 없음.
- 다음 작업: 다음 설정 시각의 실제 Slack `notification_deliveries`가 `sent`로 기록되는지 운영 확인한다.

## 주의할 점

- `initial_reminder_claimed_at`과 `nudge_reminder_claimed_at`은 발송 시도 claim이며 실제 채널 성공 여부는 `notification_deliveries`로 확인한다.
- 이미 출석인 초기 알림에는 출석 마감이나 결석 경고를 표시하지 않는다.
- `present`는 `mark_missed_attendance()`의 `pending` 조건 때문에 결석으로 강등되지 않는다.
- 별도 20:00 계정에서 확인된 Resend 403과 Web Push 오류는 이번 출석 완료 알림 억제 문제와 다른 운영 이슈다.
- 원격 reflection 정책은 아직 user-row ownership만 검사하므로 회고 인박스 UI 배포 전 해당 migration을 먼저 적용한다.
- 작업공간에는 이전 기능의 사용자 변경이 함께 있으므로 관련 없는 파일을 되돌리거나 정리하지 않는다.
- 이번 요청으로 Supabase migration과 Edge Function은 적용했지만 Git 커밋·푸시와 Vercel 배포는 수행하지 않았다.

## 2026-08-04 진단 메모 — 세션 종료·월간 누적 시간

- 원격 DB 확인: 8월 2일 11:56(KST)에 시작한 세션이 8월 4일 22:17(KST)에 종료되며 `58시간 20분 50초`가 완료 시간으로 저장됐다. 해당 세션의 lease는 8월 2일 18:56(KST)에 이미 만료됐다.
- 원인: 웹의 lease 자동 종료는 브라우저가 열려 있을 때만 실행된다. 또한 수동 종료와 회고 종료 경로는 lease 초과 시간을 `p_excluded_seconds`에 포함하지 않고, 현재 서버의 `end_study_session()`도 lease 시각을 상한으로 사용하지 않는다.
- 현재 상태: 8월 4일 22:17(KST)에 새 활성 세션이 시작됐으며 lease 만료 예정은 23:17(KST)이다. 이 세션은 진단 시점에 약 4분 경과했으며, 장기 기록의 원인이 아니다.
- 다음 작업 후보: 서버 종료 RPC에서 `lease_expires_at`을 종료 시각 상한으로 강제하고, 오래 열린 세션을 Cron 또는 재접속 시 안전하게 종료한다. 기존 과대 기록의 보정은 사용자의 별도 승인 후 수행한다.
## 2026-08-04 - 서버 lease 만료 강제 및 과대 기록 보정 완료

## 현재 작업

- 작업명: 세션 lease 만료 서버 강제 및 누적 공부 시간 보정
- 작업 목적: 브라우저 종료·오프라인 상태에서도 lease 이후의 시간이 공부 기록으로 저장되지 않도록 한다.
- 관련 PRD: `memory-bank/prd-session-lease-expiry.md`
- 관련 파일: `supabase/migrations/20260804133546_enforce_session_lease_expiry.sql`, `supabase/functions/attendance-cron/index.ts`, `apps/web/src/main.tsx`

## 최근 결정 사항

- 결정: 수동 종료와 회고 종료를 포함한 `end_study_session`은 `lease_expires_at`을 종료 시각 상한으로 사용한다. 만료된 활성 세션은 기존 1분 Cron이 service-role 전용 `close_expired_study_sessions()` RPC로 최대 100건씩 종료한다.
- 이유: 열린 브라우저에 의존한 자동 종료만으로는 탭을 닫은 세션의 경과 시간이 무제한 저장될 수 있다.
- 대안: 클라이언트에서 초과 시간을 제외하는 방식은 브라우저가 닫히면 실행되지 않아 채택하지 않았다.
- 영향 범위: 세션 종료 시간, paused 시간 제외, 월간/주간 집계, 출석 승격, Slack lease 안내 문구.

## 현재 상태

- 완료: 원격 migration `20260804133546_enforce_session_lease_expiry`, `attendance-cron` Edge Function v29, 과거 과대 세션과 해당 출석 보정.
- 완료: agent/multilingual-readmes 브랜치 푸시 및 Draft PR #1 생성 (https://github.com/zxcc9867/studyRoom/pull/1)
- 진행 중: 없음.
- 막힌 부분: 없음.
- 다음 작업: 실제 만료 시각 이후 Cron 응답의 `expiredSessionCount`를 운영 중 확인한다.

## 주의할 점

- lease는 세션 전체 시간 상한이 아니라 현재 시각 기준의 유지 가능 시간 상한이다. 사용자가 명시적으로 연장하면 정상적으로 계속 공부할 수 있다.
- 현재 활성 세션은 보정하지 않았으며, 서버 Cron이 만료 시각에 별도로 종료한다.

## 2026-08-09 - Today 화면 도메인 분리

- 결정: 긴 Today 단일 대시보드를 집중·계획·기록 화면으로 분리한다.
- 이유: 최근 7일 습관, 출석 캘린더, 계획표가 집중 세션보다 아래에 길게 누적돼 모바일과 데스크톱 모두에서 탐색 비용이 컸다.
- 범위: 웹 UI와 컴포넌트 분리만 변경하며 Supabase 쿼리, 출석 정책, 카메라 판정, 세션 RPC는 변경하지 않는다.
- 다음 작업: 프로덕션 빌드와 브라우저 전환을 확인한 뒤 Vercel 배포 상태를 검증한다.

## 2026-08-19 - 다국어 README 구성

### 현재 작업

- 작업명: GitHub 기본 README 다국어화
- 작업 목적: 영어 기본 문서와 한국어·일본어 문서를 연결해 글로벌 채용 담당자와 엔지니어가 프로젝트를 평가할 수 있게 한다.
- 관련 PRD: `memory-bank/prd-multilingual-readme.md`
- 관련 파일: `README.md`, `README.ko.md`, `README.ja.md`, `apps/web/test/readme.test.mjs`

### 최근 결정 사항

- 결정: `README.md`는 영어 기본 문서, `README.ko.md`와 `README.ja.md`는 상단 언어 링크로 연결한다.
- 이유: 기존 한국어 운영 문서를 보존하면서 영어·일본어 독자의 첫 진입 경험을 개선하기 위함이다.
- 영향 범위: README 문서와 README 계약 테스트만 변경하며 애플리케이션 런타임·Supabase·배포 동작은 변경하지 않는다.

### 현재 상태

- 완료: 세 언어 README 작성, 언어 전환 링크·핵심 용어·상대 링크·diff 공백 검사, README 계약을 포함한 전체 334개 테스트.
- 완료: agent/multilingual-readmes 브랜치 푸시 및 Draft PR #1 생성 (https://github.com/zxcc9867/studyRoom/pull/1)
- 진행 중: 없음.
- 막힌 부분: 없음.
- 다음 작업: Draft PR 검토 후 병합 여부 결정한다.

### 주의할 점

- 문서 전용 변경이므로 Vercel 프로덕션 배포 대상이 아니다.
- 실제 사용자 데이터와 키·토큰은 README에 포함하지 않는다.
