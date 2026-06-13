# PRD: Camera Presence Warning

## 1. Problem

사용자가 공부 타이머를 켜 둔 채 자리를 비우면 공부 습관 형성 효과가 약해진다. 다만 사진, 영상, 얼굴 특징값을 저장하는 방식은 개인정보 리스크가 크므로 MVP에서는 브라우저 안에서 얼굴 존재 여부만 판단해야 한다.

## 2. Target Users

매일 같은 시간에 독서실 앱에 접속하고, 실제 자리에 앉아 공부를 이어가도록 가벼운 압박 장치가 필요한 개인 사용자.

## 3. Goals

- 활성 공부 세션 중 사용자가 직접 카메라 감시를 켤 수 있다.
- 브라우저 안에서 얼굴 존재 여부만 판단한다.
- 5분 동안 얼굴이 감지되지 않으면 앱 팝업과 Telegram 경고를 보낸다.
- 경고는 기록만 하고 출석 상태나 공부 시간에는 직접 영향을 주지 않는다.
- 경고 후 10분 쿨다운으로 중복 Telegram 발송을 막는다.

## 4. Non-goals

- 사진, 영상, 프레임, 얼굴 특징값 저장.
- 서버 측 얼굴 인식 또는 자세 분석.
- 공부 시간 차감, 자동 종료, 자동 결석 처리.
- Expo 모바일 카메라 지원.

## 5. User Stories

- As a student, I want to turn on camera monitoring during a study session, so that I can keep myself accountable.
- As a student, I want a warning if I leave my seat for 5 minutes, so that I return to studying.
- As a student, I want my camera data to stay in the browser, so that private media is not stored.

## 6. User Scenarios

### Normal Flow

1. 사용자가 로그인한다.
2. 사용자가 `입장하고 시작`으로 공부 세션을 시작한다.
3. 사용자가 `카메라 감시 켜기`를 누른다.
4. 브라우저가 카메라 권한을 요청한다.
5. 얼굴이 계속 감지되면 경고 없이 감시 상태를 유지한다.
6. 얼굴이 5분 동안 감지되지 않으면 앱 팝업을 표시하고 `camera-presence-warning` Edge Function을 호출한다.
7. Edge Function이 세션 소유자를 확인하고 Telegram target이 있으면 경고를 발송한다.

### Edge Cases

- 활성 세션이 없으면 카메라 감시 버튼은 비활성화된다.
- 얼굴이 다시 보이면 미감지 타이머는 0으로 초기화된다.
- 경고 후 10분 이내에는 중복 경고를 보내지 않는다.
- Telegram target이 없으면 이벤트만 기록하고 실패로 처리하지 않는다.

### Error Cases

- 카메라 권한을 거부하면 `camera_permission_denied` 이벤트를 기록하고 안내 메시지를 표시한다.
- MediaPipe detector 로딩 실패 시 카메라를 정리하고 오류 메시지를 표시한다.
- 다른 사용자의 `study_sessions.id`로 Edge Function을 호출하면 403을 반환한다.

## 7. Functional Requirements

- [x] `Today Focus`에 카메라 감시 토글과 상태를 추가한다.
- [x] `navigator.mediaDevices.getUserMedia()`로 사용자 카메라 권한을 요청한다.
- [x] `@mediapipe/tasks-vision` FaceDetector를 사용한다.
- [x] 5분 미감지 시 앱 팝업을 표시한다.
- [x] 10분 경고 쿨다운을 적용한다.
- [x] `study_presence_events` 테이블을 추가한다.
- [x] `camera-presence-warning` Edge Function을 추가한다.
- [x] Telegram target이 있으면 경고 메시지를 보낸다.

## 8. Non-functional Requirements

- 성능: FaceDetector는 사용자가 감시를 켤 때 동적으로 로드한다.
- 보안: 이미지, 영상, 프레임, 얼굴 특징값은 저장하거나 서버로 보내지 않는다.
- 접근성: 카메라 감시 버튼은 일반 button이며 활성 세션이 없을 때 disabled 상태를 사용한다.
- 확장성: 모바일 카메라 감시는 별도 PRD로 분리한다.
- 유지보수성: 경고 상태 머신은 `cameraPresence.mjs`에 순수 함수로 둔다.

## 9. Dependencies

- 내부 의존성: `study_sessions`, `notification_targets`, `notification_deliveries`
- 외부 의존성: MediaPipe Tasks Vision, Telegram Bot API
- Supabase: `study_presence_events`, `camera-presence-warning`
- API: `POST /functions/v1/camera-presence-warning`
- 환경 변수: `TELEGRAM_BOT_TOKEN`, `APP_ORIGIN`, Supabase 기본 Edge Function secrets

## 10. Success Metrics

- 활성 세션 중 카메라 감시를 켤 수 있다.
- 5분 얼굴 미감지 시 앱 팝업이 표시된다.
- Telegram target이 있는 사용자는 경고 메시지를 받는다.
- DB에는 이벤트 metadata만 남고 media payload는 저장되지 않는다.

## 11. Rollout Plan

- 개발: 웹 MVP 먼저 적용한다.
- 테스트: 상태 머신, SQL migration, Edge Function 연결 테스트를 통과시킨다.
- 배포: Supabase migration과 Edge Function을 먼저 배포하고, Vercel 웹 UI를 배포한다.
- 모니터링: `study_presence_events`, `notification_deliveries`, Edge Function logs를 확인한다.

## 12. Open Questions

- 얼굴이 계속 감지되지 않는 환경에서 경고 문구를 더 강하게 만들지 여부.
- 카메라 감시 이력을 사용자에게 My Page에서 보여줄지 여부.
- 모바일 앱에도 동일한 기능을 넣을지 여부.

## 13. 2026-06-14 Update: Camera Required Start Gate

### Decision

- 웹 앱에서는 공부 타이머 시작 전에 카메라 감시를 필수로 켠다.
- 카메라가 꺼진 상태에서 `입장하고 시작`을 누르면 Supabase `start_study_session` RPC를 호출하지 않고 카메라 인증 팝업을 먼저 띄운다.
- `카메라 켜고 시작`을 누르면 브라우저 카메라 권한을 받은 뒤 공부 세션을 생성한다.
- 활성 세션 중 카메라가 꺼져 있으면 `camera_required_warning` 이벤트를 기록하고 Telegram target이 있으면 경고를 보낸다.
- `camera_required_warning`은 출석 상태나 공부 시간에는 직접 영향을 주지 않고, 경고 이벤트로만 기록한다.

### Added Functional Requirements

- [x] 카메라 감시가 꺼져 있으면 공부 세션 시작을 차단한다.
- [x] 카메라 인증 팝업에서 카메라를 켠 뒤에만 세션 시작 RPC를 호출한다.
- [x] 활성 세션 중 카메라가 꺼져 있으면 앱 팝업과 Telegram 경고를 보낸다.
- [x] 카메라 꺼짐 경고는 `camera_required_warning` 이벤트 타입으로 기록한다.
- [x] 사진, 영상, 프레임, 얼굴 특징값은 계속 저장하거나 서버로 보내지 않는다.
