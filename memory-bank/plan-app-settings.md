# 웹·앱 공통 설정 탭 Implementation Plan

Goal: 상단 업데이트 바를 제거하고 기존 설정과 실제 앱 버전·업데이트를 공통 설정 탭으로 모은다.
Architecture: 단일 웹 화면의 #settings와 현재 네이티브 updater controller를 재사용한다. 웹은 읽기 전용 설정 snapshot과 명시적 네이티브 설정창 열기만 브리지로 요청하며 설치·다운로드는 네이티브 창에서만 실행한다.
Spec: memory-bank/prd-app-settings.md 및 사용자가 승인한 2026-10-06 계획.

## Global Constraints

- 운영 배포·공개 APK/출시 JSON 변경·커밋·푸시 없음. 기존 사용자 변경 보존.
- DB/RLS/인증·출석·공부일·타이머·카메라·집중 정책 변경 없음.
- 새 라이브러리/권한/다크 모드/언어/데이터 삭제 없음. 기존 디자인 토큰 유지.
- 375/1440px, 최소44px 조작, 일반 글자 AA 대비, 명시적 버튼·읽기 전용 권한 확인.
- 기존 updater 상태·무결성/서명 검증·설치 직전 공부 상태 gate 유지.

### Task 1: Native settings surface and bridge

Ownership: apps/mobile (source/config), apps/web/src/nativeAppSettings.mjs 및 .d.mts, scripts/mobile-app-settings.test.mjs, 필요한 기존 native updater/bridge 테스트.

- [x] 먼저 실패 테스트: 업데이트 상시 바가 없고 별도 진입점에서 기존 modal이 열림, 설정 조회/열기 메시지의 strict schema, 신뢰 출처·인증·최상위/현재문서 guard, 구형 capability fallback, 설정 조회가 권한 요청/세션 변경/다운로드를 하지 않음.
- [x] App 최상위 useAppUpdate 유지. AppUpdatePanel을 modal-only로 전환하고 로그인/로딩/네이티브 fallback에 작은 설정 진입점 추가.
- [x] NativeAppSettingsPanel은 실제 버전·업데이트 진입과 카메라/알림/방해금지 권한 상태·Android 설정·기존 푸시 등록을 제공. 로그인 전 계정 조작/등록은 제한.
- [x] 메시지 계약: STUDY_WEB_SETTINGS_INFO {requestId}, STUDY_WEB_OPEN_SETTINGS {requestId,target:'update'|'focus'|'permissions'}, 응답 STUDY_NATIVE_SETTINGS_INFO {requestId,snapshot}. window.studyRoomNativeSettings=true capability. Snapshot은 versionName/versionCode, updater status, camera/notifications/focus permission만 포함하며 token/개인정보/URL 없음.
- [x] 현재 신뢰된 최상위 #settings 문서·인증 완료·동일 소유자에만 응답/열기를 허용. stale 응답 폐기. 웹 메시지로 설치·다운로드하지 않음.
- [x] web helper getNativeSettingsInfo(host, timeoutMs=5000), openNativeSettings(host,target). capability 없음은 즉시 unsupported; timeout은 failure. 알려진 타입만 수용.
- [x] 설정 modal을 닫거나 탭 변경해도 WebView/updater controller를 재생성하지 않음. 집중 상태 바와 기존 설정창의 상태/동작 보존.
- [x] 앱 버전0.2.2/code5 준비, 공개 manifest는 수정하지 않음. focused 테스트와 mobile typecheck 실행, report 기록. 커밋하지 않음.

### Task 2: Common settings page and navigation

Ownership: apps/web (Task1 helper 제외), 관련 mounted/browser 테스트.

- [x] 실패 테스트: 하단 다섯번째가 설정, 데스크톱 이름 표시, #settings 유지, 내 페이지 학습 이력 유지·시간대 editor는 설정에만 존재.
- [x] 계정·공부/화면·알림·휴대폰·앱 정보 구역을 기존 handler/state/API로 구성. 내 페이지/로그아웃/화면 구성은 설정에 제공. 긴 알림은 details로 접기.
- [x] native settings helper를 소비하는 작은 앱정보/기기 component 추가. 일반 웹은 웹 자동 반영 설명과 Android 설치 안내, 구형 embedded APK는 업데이트 안내, 새 APK는 실제 버전·상태와 updater modal 열기.
- [x] 휴대폰 웹은 기존 서버 확인 상태·재확인만 제공. Android 연결/해제/권한·푸시 조작은 기존 네이티브 설정창에서 제공한다.
- [x] 기존 appTheme 토큰으로 375/1440px, 읽기 순서·focus-visible·44px·명확한 오류/확인중 상태. 설정 진입은 기기 권한 요청/공부 변경을 하지 않음.
- [x] focused 실제 mounted 테스트, 스크린샷 및 web build 실행, report 기록. 커밋하지 않음.

### Task 3: Integration verification and documentation

Ownership: root coordinator의 검증과 memory-bank (worker 코드 변경하지 않음; 검토 수정은 담당 worker로 반환).

- [x] Native/Web 각각 task review + 최종 integration review. 미커밋 diff와 new file을 실제 파일 목록으로 전달.
- [x] npm.cmd test / mobile:check / build / docs:check 및 Android release/lint 검사. browser runtime이 없으면 생략 수를 명시하고 가능한 런타임으로 재검증.
- [x] Android16 에뮬레이터에서 기존 로그인 데이터 보존 조건으로 새 APK 업데이트 후 메뉴·설정·버전·업데이트 창·권한 조회/취소/복귀 확인. 실제 학습 데이터 생성·삭제나 자동 권한 허용하지 않음.
- [x] 실제 설치 검증이 불가하면 이유와 남은 항목 명시. 공개 운영 설정/링크는 수정하지 않음.
- [x] PRD-android-app-updates의 상단·웹 bridge 제외 정책을 이번 승인으로 개정. active-context/progress/implementation-plan 및 오류 발생 시 trouble-shooting 부분 갱신. 문서의 이전 작업 기록 보존.

## Completion Evidence — 2026-10-06

- 전체1083/1083·실패0·생략0, mobile:check/build/docs:check 및 Android release/lint 통과. 각 task와 최종 통합 review C0/I0/M0; Jev 근거 점검3건 verified/auto.
- APK0.2.2/code5를 동일 패키지·서명으로 로컬 준비하고 Android16 install-r/로그인 유지 및 설정창·권한 조회·OS 복귀를 확인했다. 375/1440px/200%글자·AA·44px·focus도 실제 Chromium에서 확인했다.
- 최신버전 네트워크 재확인은12초 timeout/failure를 확인했으며 성공으로 기록하지 않는다. native/OS 복귀 DOMfocus0이므로 자동 정보 갱신은 보장하지 않고 명시적 재확인을 제공한다. 실제 공부 중 카메라·DND·설치 흐름 및 실휴대폰/OEM 검증은 남아 있다.
- 운영/공개 APK/출시 JSON/고정 링크는 미변경이며 커밋·푸시·배포는 별도 요청 후 진행한다. 로컬 변경·검증 증거·작업 폴더는 보존한다.

## Follow-up Release — 2026-10-06

- 사용자의 별도 ‘배포해줘야지’ 요청으로 출시 단계를 승인했다. 구현 단계의 미배포 기록은 당시 사실로 보존한다.
- 후보5와 공개4의 버전·동일 signer·실제 크기/해시를 재확인하고, GitHub APK 게시/익명 검증 → main/GitHub Actions → Vercel READY/고정 안내·출시 JSON·APK 검증 순서로 진행한다. private/generated/output 전체는 커밋하거나 공개하지 않는다.
