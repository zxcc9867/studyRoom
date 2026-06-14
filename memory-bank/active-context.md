# Active Context

## 현재 작업

- 작업명: 상반신 기반 카메라 감시 Vercel 운영 배포
- 작업 목적: 얼굴만 보이지 않아도 머리와 좌우 어깨가 감지되면 사용자가 자리에 앉아 공부 중인 것으로 판정하고, 이 변경사항을 운영 웹 앱에 반영한다.
- 관련 PRD: `memory-bank/prd-camera-presence.md`
- 관련 파일:
  - `apps/web/src/main.tsx`
  - `apps/web/src/cameraPresence.mjs`
  - `apps/web/src/bodyPresenceDetection.mjs`
  - `apps/web/test/cameraPresence.test.mjs`
  - `apps/web/test/upperBodyPresence.test.mjs`

## 최근 결정 사항

- 결정: MediaPipe `PoseLandmarker`를 사용해 머리 랜드마크 1개 이상과 좌우 어깨 랜드마크를 기준으로 상반신 존재 여부를 판정한다.
- 이유: 사용자는 얼굴 전체가 아니라 상반신, 어깨, 머리 위치까지 감지해 공부 중 여부를 판단하기를 원했다.
- 대안: 얼굴 감지만 유지하는 방식은 사용자의 최신 요구사항을 충족하지 못한다.
- 영향 범위: 브라우저 내 카메라 감시, 5분 미감지 자동 일시정지, 10분 미복귀 자동 종료, Telegram 경고 문구, 운영 Vercel 번들.

## 현재 상태

- 완료: 커밋 `c61c95c`를 `origin/main`에 push했다.
- 완료: GitHub Actions Vercel production run `27495238934`가 `success`로 완료됐다.
- 완료: 운영 URL `https://study-room-attendance.vercel.app/`가 `/assets/index-a73GJLH-.js`를 서빙하고, 해당 JS에 `PoseLandmarker`, `pose_landmarker_lite`, `상반신`, `p_excluded_seconds`, `자동 일시정지` 문자열이 포함된 것을 확인했다.
- 완료: `npm.cmd test`는 58개 테스트 통과, `npm.cmd run build`는 성공했다.
- 진행 중: 실제 카메라가 있는 브라우저에서 상반신만 보이는 조건, 5분 자동 일시정지, 10분 자동 종료를 수동 검증해야 한다.
- 막힌 부분: 없음.
- 다음 작업: 실제 운영 URL에서 로그인 후 `입장하고 시작`을 눌러 카메라 권한 허용, 상반신 감지, 미감지 자동 제어 흐름을 확인한다.

## 주의할 점

- 사진, 영상, 프레임, 랜드마크 원본, 얼굴 특징값은 저장하거나 서버로 보내지 않는다.
- 상반신 감지는 정적 웹 번들 안의 브라우저 JS에서 수행되고, 서버는 경고 이벤트 기록과 Telegram 발송만 담당한다.
- 카메라 기능은 HTTPS 또는 localhost의 secure context에서만 동작한다.
- 운영 배포 검증은 문자열 기반 번들 확인이므로, 실제 카메라 동작은 물리 카메라가 있는 브라우저에서 별도로 확인해야 한다.
