# Active Context

## 현재 작업

- 작업명: 카메라 필수 출석 게이트 및 카메라 꺼짐 경고
- 작업 목적: 사용자가 공부 타이머를 시작하기 전에 카메라 감시를 반드시 켜도록 막고, 활성 공부 세션 중 카메라가 꺼져 있으면 앱 팝업과 Telegram 경고 이벤트를 보내도록 한다.
- 관련 PRD: `memory-bank/prd-camera-presence.md`
- 관련 파일:
  - `apps/web/src/main.tsx`
  - `apps/web/src/cameraPresence.mjs`
  - `apps/web/src/cameraPresence.d.mts`
  - `apps/web/src/cameraWarning.mjs`
  - `apps/web/src/cameraWarning.d.mts`
  - `apps/web/test/cameraPresence.test.mjs`
  - `packages/core/test/sql-migrations.test.mjs`
  - `supabase/functions/camera-presence-warning/index.ts`
  - `supabase/migrations/0012_camera_required_warning.sql`

## 최근 결정 사항

- 결정: `start_study_session` RPC를 호출하기 전에 웹 앱에서 카메라 감시 상태를 검사한다.
- 이유: 사용자의 최신 지시가 카메라가 꺼져 있으면 공부 시작과 출석 인정을 막는 방향이었기 때문이다.
- 대안: 타이머 시작 후 카메라 미사용을 경고만 하는 방식이 있었으나, 강제 출석 앱 목적에는 약하다.
- 영향 범위: 웹 `Today Focus` 시작 흐름, 카메라 감시 UI, `camera-presence-warning` Edge Function, `study_presence_events.event_type` check constraint.

## 현재 상태

- 완료: 카메라 없이 `입장하고 시작`을 누르면 카메라 인증 팝업이 뜨고 RPC 호출은 막힌다.
- 완료: `카메라 켜고 시작`을 누르면 카메라 권한을 받은 뒤 공부 세션을 만들고 `camera_started` 이벤트를 기록한다.
- 완료: 활성 세션 중 카메라가 꺼지면 `camera_required_warning` 이벤트와 Telegram 경고를 10분 쿨다운으로 보낸다.
- 완료: Supabase 원격 DB migration `camera_required_warning` 적용 성공.
- 완료: `camera-presence-warning` Edge Function version 2 ACTIVE 배포 성공.
- 완료: 커밋 `e726c34`를 `origin/main`에 push했고 GitHub Actions run `27472648244`가 성공했다.
- 완료: Vercel production URL `https://study-room-attendance.vercel.app/`이 `/assets/index-VZ129eqe.js`를 서빙하고 최신 카메라 필수 시작/자리 비움 경고 문구를 포함하는 것을 확인했다.
- 막힌 부분: 실제 모바일/PC 브라우저에서 카메라 권한을 허용한 뒤 물리 카메라로 시작/경고 플로우를 수동 확인해야 한다.
- 다음 작업: 실제 브라우저에서 `입장하고 시작` -> `카메라 켜고 시작` -> 타이머 시작 -> 카메라 끄기 -> 앱/Telegram 경고 수신을 확인한다.

## 주의할 점

- 사진, 영상, 프레임, 얼굴 특징값은 계속 저장하거나 서버로 보내면 안 된다.
- `camera-presence-warning`은 `verify_jwt=false`이지만 함수 내부에서 Supabase JWT와 `study_sessions.user_id` 소유권을 검증한다.
- `camera_required_warning`은 `absenceSeconds=0`을 허용하지만 기존 `absence_warning`은 300초 이상 조건을 유지한다.
- Supabase CLI는 현재 Windows 환경에 설치되어 있지 않아 원격 DDL은 Supabase MCP `_apply_migration`으로 적용했다.
