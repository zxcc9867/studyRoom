# 동일 계정 다중 기기 공부 상태 동기화

## 승인 범위

사용자가2026-10-18 영상 공유를 제외하고 상태 동기화를 구현하도록 승인했다. PC 카메라로 공부 중 모바일은 같은 공부·휴식·시간·현재 할 일·감지 상태를 표시하고 추가 카메라 인증/잘못된 Slack 경고를 보내지 않아야 한다. 기존 학습 기록은 보존한다.

## 계약

- 계정당 기존 활성 세션 하나와 기존 서버 인정 시간을 사용한다. 새 개인 세션/중복 공부 시간/별도 앱 DB를 만들지 않는다.
- 카메라 감시는 세션당 한 문서(client UUID)가 담당한다. 서버 세대 번호와45초 유효 시간을 사용하고 담당은10초마다 상태를 확인한다.
- 다른 기기의 접속 자체는 담당권을 얻거나 카메라/권한 창을 열거나 감지/제외/경고를 쓰지 않는다.
- ‘이 기기에서 이어서 공부’라는 명시적 버튼에서만 정상 카메라 준비 후 담당권을 넘긴다. 기존 기기는 새 세대를 관찰하면 카메라를 정리한다. 늦은 이전 세대 신호는 무시한다.
- 연결 불명/만료/카메라 오류는 상반신 부재로 취급하지 않는다. 기존5분 부재 경고/10분 이후 제외/10분 경고 쿨다운을 유지한다.
- 서버가 확인한 담당·현재 세대·신선한 감지 상태에 대해서만 Slack 경고 이벤트를 원자적으로 허용한다. 구형/필드누락/관찰기기 경고는 성공 형식의 suppressed 결과이며 이벤트/Slack을 만들지 않는다.
- 기존 학습 테이블은 삭제/초기화/과거 내용 변경하지 않는다. 새 조정 테이블/RPC를 추가하며 카메라 제외는 기존 checkpoint 경로만 사용한다.
- 로그인/출석/회복/04시 공부일/lease/DND/앱 설치 정책을 우회하지 않는다. 영상·프레임·포즈 원본·음성은 전송/저장하지 않는다.
- 공통 snapshot은 활성 세션 없음도 반영한다. 기존 인증 사용자 필터/RLS의 Realtime 변경 신호와15초 foreground fallback을 사용한다. 오류 시 마지막 확인 상태를 보존하고 연결 확인 필요를 표시한다.
- 초기 동기화 전 관찰/담당 여부가 불명이면 카메라 팝업·경고·브라우저 inactivity 종료를 실행하지 않는다. 현재 기기가 시작/이어받은 세션에만 로컬 카메라/활동 종료 정책을 적용한다.
- 신규 서버 상태가 없는 기존 실행 탭은 상태 확인 필요로 표시한다. 운영 배포가 진행 중인 사용자의 PC를 강제 새로고침하지 않는다.
- 관찰 기기의 ‘공부 계속하기’는 공통 휴식 상태만 재개하고 카메라 담당을 가져오지 않는다. 기존 담당은 저장된 본인 감시 의도로 복구한다. 다른 문서가 담당이면 유효 시간이 지났어도 자동 복구로 담당권을 가져오지 않는다.
- 조정된 세션은 구형 checkpoint·pause·preview·confirm·end·complete의 클라이언트 제외값을 무시하고 같은 서버 확정/증명 가능한 제외값을 사용한다. 미조정 세션의 기존 공개 시그니처·시간 정책은 유지한다. private 원본 함수는 일반 API에서 실행할 수 없다.
- 관찰 타이머는 서버 시각 차이를 보정한다. 자동 제외는 last_seen_at과 auto_paused_at 중 늦은 시각부터 유효 시간/lease까지만 투영하며 만료 시 누적 투영이 사라지지 않는다. 늦은 응답은 server_now·세대·계정·로컬 액션 revision으로 차단한다.

## 완료 기준

- 카메라 담당 기기의 로컬 휴식은 영상만 중지하고 같은 세션의 재연결 의도를 보존한다. 긴 공부 후에도 실제 live 카메라를 휴식으로 끄는 순간 의도 시각을 갱신한다. 기존15분 자동복구 유효기간·담당권 검증은 유지한다.
- 관찰 기기에서 재개하면 기존 담당 기기가 저장된 의도로 카메라를 복구하고, 관찰 기기는 카메라 요청·담당권 이전을 하지 않는다. 사용자의 명시적 카메라 끄기·세션 종료는 의도를 삭제하므로 자동으로 다시 켜지지 않는다.

- DB: 동일 계정A/B 담당 경쟁/명시 전환/이전 세대/만료/휴식/종료/다른 계정/RLS/경고 쿨다운·원자적 이벤트/기존 기록 불변을 실제 PostgreSQL 의미 테스트로 검증한다.
- 웹 mounted: PC 담당 중 모바일 관찰은 카메라 요청/인증 모달/경고/제외 checkpoint/로컬 inactivity 종료0회. 시작/휴식/재개/종료·현재 할 일·시간·오류/복귀를 동기화한다.
- Android16 APK0.2.4에서 운영 공통 웹의 같은 계정/담당 snapshot을 실제로 관찰한다. 계정/회복 대기 또는 사용자 진행 중 공부 때문에 확인 못 한 범위는 별도 기록한다.
- npm.cmd test, npm.cmd run test:edge, npm.cmd run mobile:check, npm.cmd run build, npm.cmd run docs:check, ai.ps1 verify 및 독립 검토. 제품 변경은 기존 GitHub Actions feature-ref 경로로 production READY/HTTP200까지 확인한다.

## 공개 인터페이스

- study_device_snapshot(p_client_id uuid): {server_now, active_session, session, tracking, camera}. session은 활성 또는 마지막 세션, active_session은 활성만. camera는 세션 없으면null.
- study_camera_action(p_action text,p_client_id uuid,p_session_id uuid,p_generation bigint default null,p_status text default 'watching',p_excluded_seconds integer default null,p_takeover boolean default false,p_device_type text default 'browser'): snapshot과accepted boolean. action은claim/report. camera에는 session_id/owner_client_id/generation/device_type/status/last_seen_at/expires_at/absence_seconds/excluded_seconds/auto_paused_at/is_owner.
- claim_study_camera_warning(p_user_id uuid,p_session_id uuid,p_client_id uuid,p_generation bigint,p_event_type text): service_role전용 {allowed,event_id,absence_warning_count}. 공개 인증 클라이언트는 호출 불가.
