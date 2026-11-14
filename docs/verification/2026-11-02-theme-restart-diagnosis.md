# Windows 테마 재실행 조사 — 2026-11-02

## 요청과 범위
- 사용자는 Windows 독서실 앱에서 테마 설정 후 재실행하면 그대로 적용되지 않는다고 보고했다. 웹/Android는 사용자도 아직 확인하지 않았다.
- checkout은 fix/study-dashboard-clarity, HEAD3d0ddc8. 원격 fetch 후 ahead/behind0/0. 제품 코드·설치본·서버/DB/Auth·학습 정책은 변경하지 않는다.
- 실제 앱은 0.1.10이며 사용자가 테마 시험·정상 재실행·원복을 승인했다. 계정/토큰/실제 화면을 증거 파일에 저장하거나 업로드하지 않는다.

## 확인된 저장 경로
- appearance.mjs는 study-room-appearance, atmosphere.mjs는 study-room-atmosphere만 localStorage에 저장하고 초기 head와 controller가 재사용한다. 후자는 배경·움직임·강도·명시적 pause만 정규화한다.
- desktopRuntime은 persist:study-room-desktop 파티션을 사용하며 정상 종료는 app.quit이다. 조사 범위에서 테마 키 삭제·clearStorageData 호출은 발견하지 않았다. 이것만으로 실제 디스크 저장 성공을 단정하지 않는다.
- main.tsx의 scenicOpen은 useState(false)이며 풍경 진입 상태는 영속화하지 않는다. 따라서 재실행 시 풍경 화면 대신 대시보드가 보이는 동작과 배경 선택값의 소실은 별개다. 이 차이가 사용자의 현상과 같은지 아직 확인되지 않았다.

## 현재 실행 결과
- node --test apps/web/test/appearance.test.mjs apps/web/test/atmosphere.test.mjs:13/13·실패/생략/취소0.
- 격리 Electron45 + 기존 electron-main.cjs의 실제 desktopRuntime + 현재 두 controller를 별도 시험 userData/localhost에서 사용했다. 정상 종료/재실행 후 다크·별빛 바다/라이브/보통/재생과 라이트·비 오는 서재/라이브/잔잔하게/명시 pause의 저장 복원을 각각 확인했다. 2/2·exit0이며 첫 경우는 PID 변경도 명시 확인했다. 실제 계정/카메라/네트워크 인증 없음.
- 최초 제한 환경의 Electron 실행은 Process failed to launch로 실패했다. 같은 스크립트·런타임의 승인된 제한 밖 실행은2/2 통과했으며 두 결과를 구분한다. 스크립트는 ignored output/playwright/theme-restart-diagnostic-20261102.mjs이다. 이는 전체 React UI·설치 앱의 cold 시작 수용을 대신하지 않는다.
- 실제 설치 앱은 시작 준비·카메라 꺼짐을 UI에서 확인했다. 원래 시스템 설정·새벽 도시/정적/잔잔하게를 관찰하고 별빛 바다/라이브/잔잔하게를 명시 적용했다. 저장 실패 안내 없이 화면/요약/재생 조작이 바뀌었다. 학습·할 일·카메라·로그아웃 조작은 하지 않았다.
- Computer Use는 앱 창은 제어하지만 트레이는 target window로 노출하지 않았다. 강제 종료로 대체하지 않고 사용자에게 트레이의 독서실 종료를 요청했다. 아직 실제 설치 프로세스 종료/재실행은 검증하지 않았다.
- 대기 중 시험 설정을 남기지 않도록 UI에서 원래 시스템 설정·새벽 도시/정적/잔잔하게로 복원했다. 요약·라이브 조작 제거와 저장 실패 안내 없음을 확인했다. 복원 뒤 cold 재실행 검증은 대기 중이다.

## 판정과 다음 단계
- 저장 소실의 원인은 아직 확정하지 못했다. 단위13/13·격리 cold2/2와 실제 적용/원복은 정상이며, 풍경 진입 상태의 비영속화는 코드로 확인했다. 이를 저장 오류 해결 완료로 표현하지 않는다.
- 다음은 사용자 정상 트레이 종료 후 같은 설치 EXE를 재실행해 새 창/로그인 유지/원래 테마를 읽고, 실패한다면 어떤 선택값이 달라지는지 한 변수씩 확인하는 것이다. 인증 저장소/전체 localStorage를 읽지 않고 테마 전용 UI 또는 승인된 최소 키만 대조한다.
- 새 공부·카메라·학습 기록·서버 쓰기·재설치·제품 수정/배포/커밋·푸시는 하지 않았다. 원인 불명 상태의 추측 패치는 보류한다.
