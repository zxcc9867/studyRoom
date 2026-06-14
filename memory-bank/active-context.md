# Active Context

## 현재 작업

- 작업명: 상반신 기반 카메라 감시
- 작업 목적: 사용자가 공부 타이머를 켠 뒤 얼굴만이 아니라 머리와 좌우 어깨가 포함된 상반신 포즈가 5분 동안 감지되지 않으면 공부 시간 카운트를 자동 일시정지하고, 10분 동안 돌아오지 않으면 세션을 자동 종료하며, 미감지 시간은 `study_sessions.duration_seconds`에서 제외한다.
- 관련 PRD: `memory-bank/prd-camera-presence.md`
- 관련 파일:
  - `apps/web/src/main.tsx`
  - `apps/web/src/cameraPresence.mjs`
  - `apps/web/src/cameraPresence.d.mts`
  - `apps/web/src/bodyPresenceDetection.mjs`
  - `apps/web/src/bodyPresenceDetection.d.mts`
  - `apps/web/src/cameraWarning.mjs`
  - `apps/web/src/cameraWarning.d.mts`
  - `apps/web/src/sessionExit.mjs`
  - `apps/web/src/sessionExit.d.mts`
  - `apps/web/test/cameraPresence.test.mjs`
  - `apps/web/test/upperBodyPresence.test.mjs`
  - `apps/web/test/sessionExit.test.mjs`
  - `packages/core/test/sql-migrations.test.mjs`
  - `supabase/functions/camera-presence-warning/index.ts`
  - `supabase/migrations/0012_camera_required_warning.sql`
  - `supabase/migrations/0013_exclude_camera_absence_from_sessions.sql`

## 최근 결정 사항

- 결정: MediaPipe `PoseLandmarker`로 머리 랜드마크와 좌우 어깨 랜드마크를 확인해 상반신이 보이면 사람이 앉아 있는 것으로 판정한다.
- 이유: 사용자의 최신 지시가 얼굴만이 아니라 상반신, 어깨, 머리 위치를 기준으로 공부 중 여부를 판단하는 방향이었기 때문이다.
- 대안: UI 타이머만 멈추는 방식이 있었으나 DB에 저장되는 `duration_seconds`와 불일치하므로 제외했다.
- 영향 범위: 웹 카메라 감지 모델, `Today Focus` 타이머 계산, 카메라 상태 머신, 페이지 이탈 종료 요청, `end_study_session` RPC signature.

## 현재 상태

- 완료: 카메라 없이 `입장하고 시작`을 누르면 카메라 인증 팝업이 뜨고 RPC 호출은 막힌다.
- 완료: `카메라 켜고 시작`을 누르면 카메라 권한을 받은 뒤 공부 세션을 만들고 `camera_started` 이벤트를 기록한다.
- 완료: 활성 세션 중 카메라가 꺼지면 `camera_required_warning` 이벤트와 Telegram 경고를 10분 쿨다운으로 보낸다.
- 완료: Supabase 원격 DB migration `camera_required_warning` 적용 성공.
- 완료: `camera-presence-warning` Edge Function version 2 ACTIVE 배포 성공.
- 완료: 커밋 `e726c34`를 `origin/main`에 push했고 GitHub Actions run `27472648244`가 성공했다.
- 완료: Vercel production URL `https://study-room-attendance.vercel.app/`이 `/assets/index-VZ129eqe.js`를 서빙하고 최신 카메라 필수 시작/자리 비움 경고 문구를 포함하는 것을 확인했다.
- 완료: 5분 상반신 미감지 시 UI 타이머가 자동 일시정지 상태가 되고 미감지 시간이 현재 세션/오늘 공부 시간에서 제외되도록 했다.
- 완료: 상반신이 다시 감지되면 제외 시간을 누적하고 타이머가 다시 진행되도록 했다.
- 완료: 10분 상반신 미감지 시 `end_study_session` RPC를 자동 호출하고 `p_excluded_seconds`로 제외 초를 저장하도록 했다.
- 완료: Supabase 원격 DB migration `exclude_camera_absence_from_sessions` 적용 성공.
- 완료: 커밋 `a461228`를 `origin/main`에 push했고 GitHub Actions run `27473367753`이 성공했다.
- 완료: Vercel production URL `https://study-room-attendance.vercel.app/`이 `/assets/index-BFOVTlgA.js`를 서빙하고 `자동 일시정지`, `자동 종료`, `p_excluded_seconds`가 포함된 것을 확인했다.
- 완료: `FaceDetector` 기반 얼굴 판정을 `PoseLandmarker` 기반 상반신 판정으로 교체했다.
- 완료: 머리 랜드마크 1개 이상과 좌우 어깨 랜드마크가 일정 confidence 이상이면 상반신이 보이는 것으로 판단한다.
- 막힌 부분: 실제 모바일/PC 브라우저에서 물리 카메라로 상반신 감지, 5분 일시정지, 10분 자동 종료 플로우를 수동 확인해야 한다.
- 다음 작업: 테스트/빌드 검증 후 원하면 Vercel production에 배포한다.

## 주의할 점

- 사진, 영상, 프레임, 얼굴/포즈 특징값과 랜드마크 원본은 계속 저장하거나 서버로 보내면 안 된다.
- `camera-presence-warning`은 `verify_jwt=false`이지만 함수 내부에서 Supabase JWT와 `study_sessions.user_id` 소유권을 검증한다.
- `camera_required_warning`은 `absenceSeconds=0`을 허용하지만 기존 `absence_warning`은 300초 이상 조건을 유지한다.
- `end_study_session`은 이제 `p_excluded_seconds`를 받아 저장 duration에서 제외한다. 클라이언트 종료 경로는 이 값을 항상 전달해야 한다.
- Supabase CLI는 현재 Windows 환경에 설치되어 있지 않아 원격 DDL은 Supabase MCP `_apply_migration`으로 적용했다.
