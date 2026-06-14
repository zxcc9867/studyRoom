# PRD: Camera Presence Warning

## 1. Problem

사용자가 공부 타이머를 켜 둔 채 자리를 비우면 공부 습관 형성 효과가 약해진다. 다만 사진, 영상, 얼굴/포즈 특징값을 저장하는 방식은 개인정보 리스크가 크므로 MVP에서는 브라우저 안에서 상반신 포즈 존재 여부만 판단해야 한다.

## 2. Target Users

매일 같은 시간에 독서실 앱에 접속하고, 실제 자리에 앉아 공부를 이어가도록 가벼운 압박 장치가 필요한 개인 사용자.

## 3. Goals

- 활성 공부 세션 중 사용자가 직접 카메라 감시를 켤 수 있다.
- 브라우저 안에서 머리와 좌우 어깨가 포함된 상반신 포즈 존재 여부만 판단한다.
- 카메라 스트림이 검은 화면, 중단, 음소거, 비활성 상태이면 자리 비움으로 누적하지 않고 카메라 오류로 안내한다.
- 5분 동안 상반신이 감지되지 않으면 앱 팝업과 Slack 경고를 보낸다.
- 경고 후 5분 동안 계속 상반신이 감지되지 않으면 공부 타이머를 자동 일시정지한다.
- 경고 후 5분 유예 시간은 공부 시간에 포함하고, 자동 일시정지 이후 시간만 공부 시간에서 제외한다.
- 경고 후 10분 쿨다운으로 중복 Slack 발송을 막는다.

## 4. Non-goals

- 사진, 영상, 프레임, 얼굴/포즈 특징값 저장.
- 서버 측 얼굴 인식 또는 자세 분석.
- 자동 결석 처리.
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
5. 상반신 포즈가 계속 감지되면 경고 없이 감시 상태를 유지한다.
6. 상반신이 5분 동안 감지되지 않으면 앱 팝업을 표시하고 `camera-presence-warning` Edge Function을 호출한다.
7. 경고 후 5분 유예 시간 안에 상반신이 다시 감지되면 타이머는 계속 진행된다.
8. 총 10분 동안 상반신이 감지되지 않으면 UI는 현재 세션 타이머를 자동 일시정지 상태로 표시한다.
9. 상반신이 다시 감지되면 10분 이후의 제외 시간을 누적하고 타이머를 다시 진행한다.
10. Edge Function이 세션 소유자를 확인하고 Slack target이 있으면 경고를 발송한다.

### Edge Cases

- 활성 세션이 없으면 카메라 감시 버튼은 비활성화된다.
- 상반신이 다시 보이면 미감지 타이머는 0으로 초기화된다.
- 카메라 프레임이 검은 화면이거나 스트림이 중단된 경우에는 미감지 타이머를 초기화하고 카메라 상태 확인 메시지를 표시한다.
- 5분 미만의 짧은 상반신 미감지는 공부 시간에서 제외하지 않는다.
- 경고 후 10분 이내에는 중복 경고를 보내지 않는다.
- Slack target이 없으면 이벤트만 기록하고 실패로 처리하지 않는다.

### Error Cases

- 카메라 권한을 거부하면 `camera_permission_denied` 이벤트를 기록하고 안내 메시지를 표시한다.
- MediaPipe detector 로딩 실패 시 카메라를 정리하고 오류 메시지를 표시한다.
- 다른 사용자의 `study_sessions.id`로 Edge Function을 호출하면 403을 반환한다.

## 7. Functional Requirements

- [x] `Today Focus`에 카메라 감시 토글과 상태를 추가한다.
- [x] `navigator.mediaDevices.getUserMedia()`로 사용자 카메라 권한을 요청한다.
- [x] `@mediapipe/tasks-vision` PoseLandmarker를 사용한다.
- [x] 머리 랜드마크 1개 이상과 좌우 어깨 랜드마크가 보이면 사람이 앉아 있는 것으로 판단한다.
- [x] 웹캠 구도상 한쪽 어깨가 잘린 경우, 머리 + 한쪽 어깨 + 같은 쪽 골반이 보이면 앉아 있는 것으로 판단한다.
- [x] 검은 프레임, 중단/음소거/비활성 카메라 트랙은 자리 비움으로 판정하지 않고 카메라 오류로 표시한다.
- [x] 5분 미감지 시 앱 팝업을 표시한다.
- [x] 5분 미감지 시 Slack/앱 경고를 보낸다.
- [x] 총 10분 미감지 시 현재 세션 타이머를 자동 일시정지하고 10분 이후 미감지 시간만 제외한다.
- [x] 세션 종료 시 제외 초를 `end_study_session` RPC로 전달해 저장 공부 시간에서 제외한다.
- [x] 10분 경고 쿨다운을 적용한다.
- [x] `study_presence_events` 테이블을 추가한다.
- [x] `camera-presence-warning` Edge Function을 추가한다.
- [x] Slack target이 있으면 경고 메시지를 보낸다.

## 8. Non-functional Requirements

- 성능: PoseLandmarker는 사용자가 감시를 켤 때 동적으로 로드한다.
- 보안: 이미지, 영상, 프레임, 얼굴/포즈 특징값과 랜드마크 원본은 저장하거나 서버로 보내지 않는다.
- 접근성: 카메라 감시 버튼은 일반 button이며 활성 세션이 없을 때 disabled 상태를 사용한다.
- 확장성: 모바일 카메라 감시는 별도 PRD로 분리한다.
- 유지보수성: 경고 상태 머신은 `cameraPresence.mjs`에 순수 함수로 둔다.

## 9. Dependencies

- 내부 의존성: `study_sessions`, `notification_targets`, `notification_deliveries`
- 외부 의존성: MediaPipe Tasks Vision, Slack Bot API
- Supabase: `study_presence_events`, `camera-presence-warning`
- API: `POST /functions/v1/camera-presence-warning`
- 환경 변수: `SLACK_BOT_TOKEN`, `APP_ORIGIN`, Supabase 기본 Edge Function secrets

## 10. Success Metrics

- 활성 세션 중 카메라 감시를 켤 수 있다.
- 5분 상반신 미감지 시 앱 팝업이 표시된다.
- Slack target이 있는 사용자는 경고 메시지를 받는다.
- DB에는 이벤트 metadata만 남고 media payload는 저장되지 않는다.

## 11. Rollout Plan

- 개발: 웹 MVP 먼저 적용한다.
- 테스트: 상태 머신, SQL migration, Edge Function 연결 테스트를 통과시킨다.
- 배포: Supabase migration과 Edge Function을 먼저 배포하고, Vercel 웹 UI를 배포한다.
- 모니터링: `study_presence_events`, `notification_deliveries`, Edge Function logs를 확인한다.

## 12. Open Questions

- 상반신이 계속 감지되지 않는 환경에서 경고 문구를 더 강하게 만들지 여부.
- 카메라 감시 이력을 사용자에게 My Page에서 보여줄지 여부.
- 모바일 앱에도 동일한 기능을 넣을지 여부.

## 13. 2026-06-14 Update: Camera Required Start Gate

### Decision

- 웹 앱에서는 공부 타이머 시작 전에 카메라 감시를 필수로 켠다.
- 카메라가 꺼진 상태에서 `입장하고 시작`을 누르면 Supabase `start_study_session` RPC를 호출하지 않고 카메라 인증 팝업을 먼저 띄운다.
- `카메라 켜고 시작`을 누르면 브라우저 카메라 권한을 받은 뒤 공부 세션을 생성한다.
- 활성 세션 중 카메라가 꺼져 있으면 `camera_required_warning` 이벤트를 기록하고 Slack target이 있으면 경고를 보낸다.
- `camera_required_warning`은 출석 상태나 공부 시간에는 직접 영향을 주지 않고, 경고 이벤트로만 기록한다.

### Added Functional Requirements

- [x] 카메라 감시가 꺼져 있으면 공부 세션 시작을 차단한다.
- [x] 카메라 인증 팝업에서 카메라를 켠 뒤에만 세션 시작 RPC를 호출한다.
- [x] 활성 세션 중 카메라가 꺼져 있으면 앱 팝업과 Slack 경고를 보낸다.
- [x] 카메라 꺼짐 경고는 `camera_required_warning` 이벤트 타입으로 기록한다.
- [x] 사진, 영상, 프레임, 얼굴/포즈 특징값과 랜드마크 원본은 계속 저장하거나 서버로 보내지 않는다.

## 14. 2026-06-14 Update: Absence Warning Grace and Auto Pause

### Decision

- 상반신이 5분 이상 감지되지 않으면 경고만 보낸다.
- 경고 후 5분 유예 시간 안에 복귀하지 않으면 UI는 현재 세션을 `자동 일시정지` 상태로 표시한다.
- 유예 시간 5분은 공부 시간에 포함한다.
- 총 10분 이후의 자동 일시정지 시간만 제외 시간으로 계산한다.
- 상반신이 다시 감지되면 제외 시간을 누적하고 타이머를 다시 진행한다.
- 자동 종료는 더 이상 수행하지 않는다.
- 수동 종료는 `p_excluded_seconds`를 `end_study_session` RPC에 전달한다.

### Added Functional Requirements

- [x] 5분 이상 상반신 미감지 시 경고만 보내고 타이머는 계속 진행한다.
- [x] 총 10분 이상 상반신 미감지 시 현재 세션/오늘 공부 시간 표시에서 자동 일시정지 이후 시간을 제외한다.
- [x] 상반신 복귀 시 제외 시간을 누적하고 세션 타이머를 재개한다.
- [x] DB 저장 시간도 제외되도록 `end_study_session` RPC에서 `p_excluded_seconds`를 반영한다.
- [x] 수동 종료 요청은 제외 초를 전달한다.

## 16. 2026-06-14 Update: Tab Switch Policy

### Decision

- Browser tab switching is normal study behavior and must not end the active study session.
- `visibilitychange` is only a visibility signal. It is not treated as proof that the user left the study room.
- Automatic page-exit session termination is disabled because refresh/reload cannot be reliably separated from leaving the page.
- Camera monitoring should not be intentionally stopped by a tab switch. If the browser throttles camera frame callbacks in the background, the app still relies on camera presence state rather than session-exit logic.
- Study time should continue during tab switches. Only camera absence auto-pause can exclude time from the study total.

### Added Functional Requirements

- [x] Switching to another browser tab does not call `end_study_session`.
- [x] Switching tabs does not intentionally stop camera monitoring.
- [x] Refreshing, closing, or leaving the page does not send automatic `end_study_session`; the explicit `종료` button is the supported session-end action.
- [x] The tab-switch policy is covered by `sessionExit` regression tests.

## 15. 2026-06-14 Update: Upper Body Presence Detection

### Decision

- 얼굴만 감지하는 `FaceDetector` 대신 `PoseLandmarker`를 사용한다.
- 머리 랜드마크 중 1개 이상과 좌우 어깨 랜드마크가 일정 confidence 이상으로 보이면 사람이 앉아 있는 것으로 판단한다.
- 좌우 어깨가 모두 보이지 않더라도 머리, 한쪽 어깨, 같은 쪽 골반이 보이면 웹캠 crop 환경의 상반신 감지로 인정한다.
- 포즈 랜드마크는 브라우저 메모리 안에서만 사용하고 Supabase나 Edge Function으로 보내지 않는다.

### Added Functional Requirements

- [x] 몸/상반신이 보이는 경우 얼굴 정면이 아니어도 자리 있음으로 판정한다.
- [x] 좌우 어깨와 머리 위치가 없으면 자리 비움으로 판정한다.
- [x] 머리와 한쪽 어깨/골반이 보이는 crop 환경도 자리 있음으로 판정한다.
- [x] 기존 5분 경고, 10분 자동 일시정지, 제외 시간 저장 로직은 상반신 미감지 기준으로 동작한다.

## 17. 2026-06-14 Update: Camera Video Health

### Decision

- 카메라 프리뷰가 검은 화면이거나 스트림 트랙이 중단/음소거/비활성 상태이면 사용자가 자리를 비운 것으로 보지 않는다.
- 이 경우 미감지 누적 시간을 초기화하고 `카메라 오류` 상태와 원인 안내 문구를 보여준다.
- 실제 영상 프레임이 보이는 경우에만 PoseLandmarker 기반 상반신 감지를 실행한다.

### Added Functional Requirements

- [x] live/unmuted/enabled video track이 없으면 상반신 미감지 시간을 누적하지 않는다.
- [x] 현재 프레임이 없거나 video size가 0이면 상반신 미감지 시간을 누적하지 않는다.
- [x] 거의 검은 프레임은 자리 비움이 아니라 카메라 화면 문제로 안내한다.

## 18. 2026-06-14 Update: Refresh Camera Resume

### Decision

- 브라우저 새로고침은 실제 카메라 스트림을 유지할 수 없다.
- 대신 앱은 활성 세션에서 카메라 감시가 켜져 있었다는 intent만 사용자/세션 단위로 짧게 저장한다.
- 새로고침 후 같은 사용자의 같은 active session이 복원되면 한 번만 카메라 재연결을 자동 시도한다.
- 자동 재연결이 실패하면 카메라 켜기 팝업으로 사용자가 직접 권한/장치 상태를 확인하게 한다.

### Added Functional Requirements

- [x] 카메라 감시가 켜진 active session의 userId/sessionId intent를 브라우저 저장소에 보관한다.
- [x] 저장된 intent가 같은 사용자, 같은 active session, 최근 intent일 때만 카메라 자동 복원을 시도한다.
- [x] 자동 복원은 한 세션 로드에서 한 번만 시도해 반복 권한 요청을 막는다.
- [x] 세션을 수동 종료하거나 카메라 감시를 수동으로 끄면 저장된 intent를 삭제한다.

## 19. 2026-06-15 Update: Stalled Frame Recovery

### Decision

- 카메라 트랙이 live 상태여도 `<video>`가 current frame 또는 video size를 제공하지 못하면 일시적인 로딩/스톨 상태로 본다.
- `no-current-frame`, `no-video-size` 상태가 15초 이상 계속되면 같은 공부 세션 안에서 카메라를 한 번 자동 재연결한다.
- 자동 재연결 후에도 프레임을 얻지 못하면 카메라 스트림을 정리하고 오류 상태로 전환해 사용자가 직접 다시 켜도록 한다.
- 이 상태는 자리 비움으로 계산하지 않고, Slack 경고나 공부 시간 자동 일시정지의 근거로 사용하지 않는다.
- 이미 카메라 감시가 켜진 상태에서 `준비 중`으로 전환되어도 사용자는 카메라 감시 끄기 버튼으로 스트림을 정리할 수 있어야 한다.

### Added Functional Requirements

- [x] 15초 이상 프레임 스톨이 계속되면 자동 재연결을 1회 시도한다.
- [x] 자동 재연결 실패 후에는 카메라 감시를 꺼진 상태로 돌리고 재시도 안내를 표시한다.
- [x] 프레임 스톨 중에는 자리 비움 누적 시간을 증가시키지 않는다.
- [x] 카메라가 이미 켜져 있으면 `준비 중` 상태에서도 사용자가 감시를 끌 수 있다.
- [x] 프레임 스톨 복구 정책은 순수 함수 테스트로 검증한다.

## 20. 2026-06-15 Update: Camera Monitor UI Simplification

### Decision

- 오늘 공부 시간과 월 누적 시간은 상단 요약 카드에서만 보여준다.
- `Today Focus` 카메라 영역에서는 별도 타이머를 렌더링하지 않고, 목표 진행률과 카메라 감시 카드만 보여준다.
- 카메라 감시 카드는 상태 문구를 한 줄로만 보여준다. 정상 감시 중 기본 메시지인 `카메라 감시 중`은 하단에 반복하지 않는다.
- 카메라 프리뷰는 이전보다 크게 보여주고, 버튼은 같은 카드 안에서 보조 동작으로 유지한다.

### Added Functional Requirements

- [x] `daily-visual` 섹션 안에서 `todaySeconds`와 `activeElapsedSeconds` 타이머를 렌더링하지 않는다.
- [x] 정상 감시 중에는 카메라 상태 문구가 중복 표시되지 않는다.
- [x] 카메라 프리뷰는 데스크톱에서 더 넓은 폭을 사용하고, 모바일에서는 세로 레이아웃으로 안전하게 줄어든다.
- [x] UI 구조 변경은 기존 카메라 감시, 경고, 자동 일시정지 로직을 변경하지 않는다.
