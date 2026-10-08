# PRD: 고정 Android 다운로드 주소

## 최신 출시 확인 — 2026-10-08 0.2.4/code7

- 공개 GitHub android-v0.2.4-build7 APK61994067bytes/SHA256a473233cd309f5e69e8ceb071e7a45f628873b977a28f075da92fdddfb42218b·기존 package/signer 동일. 공개6 파일은 유지하고 고정 안내/JSON/307만7로 함께 갱신했다.
- 제품96a47086/Actions37736495450 success/Vercel dpl_E2fGguFGbUem9PJ4agrjxPvbbKJC READY/production alias·동일SHA. 운영 웹200/실제Settings bundle, 안내 두 경로200/no-store·이번변경사항3건, JSON200/application-json/no-store·실제APK 전체필드, 파일307/no-store→같은GitHub7 APK·익명 전체200/크기/해시 일치 확인.
- 기존 앱 설정→앱정보→앱업데이트→최신버전 다시확인→다운로드/설치→Android 승인을 사용한다. 이 고정 안내 링크도 계속 유지되며 앱 삭제/무인 설치/OTA는 없다. 실제 기기 UI/installer는 이번 게시에서 새로 실행하지 않았다.

## 1. Problem / Target Users
- APK 빌드별 Expo 링크가 바뀌어 설치자가 최신 주소를 다시 받아야 한다. 기존·신규 Android 사용자가 같은 주소에서 최신 검증 APK를 다운로드한다.

## 2. Goals / Non-goals
- 고정 안내 주소 `/download/android`와 고정 파일 진입 주소 `/download/android.apk`를 제공한다.
- 앱 삭제 없이 업데이트하는 방법과 최초 설치 안내를 제공한다. 로그인 없이 모바일·PC에서 접근한다.
- 자동 설치/OTA/Play 출시/서명·패키지·사용자 데이터 변경은 제외한다. 2026-10-04 승인된 앱 내부 업데이트 후속 범위에서 새 APK 빌드·출시 JSON을 추가하며 상세 계약은 prd-android-app-updates.md를 따른다.

## 3. User Stories / Scenarios
- 사용자는 고정 안내 주소를 저장하고 다음 업데이트에도 재사용한다.
- 다운로드 버튼 → 고정 APK 주소 → 현재 검증된 공개 GitHub Release APK → Android에서 설치/업데이트 확인. 최초 updater APK는 이 경로로 한 번 수동 업데이트하고 다음 버전부터 앱 버튼을 사용한다.
- 설치 실패 시 기존 앱 삭제/데이터 초기화를 지시하지 않는다. 브라우저 다운로드 제한이 있으면 외부 브라우저로 같은 주소를 연다.

## 4. Functional / Non-functional Requirements
- [x] 정적 안내 페이지를 앱의 study 토큰·키보드 focus·44px 이상 링크·375px/1440px 반응형으로 제공한다.
- [x] APK 연결은 307 임시 리디렉션과 no-store로 이전 APK 주소의 영구 캐싱을 방지한다.
- [x] APK 주소는 검증된 공개 HTTPS artifact만 사용하며 요청 매개변수로 목적지를 바꾸지 않는다. 후속 업데이트의 고정 원본은 github.com/zxcc9867/studyRoom/releases/download 경로다.
- [x] 기존 SPA/API 라우팅을 유지한다.
- [x] 배포 후 안내 HTTP200·APK307·목적지 HTTP200/파일 형식/크기를 확인한다.

## 5. Dependencies / Rollout / Release Maintenance
- 2026-10-08 후속 승인으로 변경사항 화면0.2.4/code7을 새 immutable android-v0.2.4-build7에 게시한다. 실제 APK는61994067bytes/SHA256a473233cd309f5e69e8ceb071e7a45f628873b977a28f075da92fdddfb42218b·같은 package/signer다. JSON/고정307/안내를7로 함께 갱신하고 기존6 원본을 유지한다. 실제 운영 완료는 progress의 후속 증거를 기준으로 한다.
- 2026-10-08 사용자 승인으로 검증된0.2.3/code6을 공개한다. 고정 안내/JSON/APK307은 같은 GitHub6 파일을 가리키며 기존5는 immutable 이력으로 유지한다. 실제 결과는 progress에 기록한다.
- Vite public 정적 파일, 기존 vercel.json routes, 기존 GitHub Actions production 배포. Supabase/새 비밀값/계정은 필요하지 않다.
- 매번 동일 서명 로컬 release 빌드 성공 또는 EAS FINISHED와 공개 다운로드·기존 서명·기능 검증을 통과한 뒤에만 공개 출시 JSON/고정 APK route Location/안내 페이지를 함께 갱신하고 웹을 배포한다.
- 기존 EAS 링크 자체는 덮어쓰지 않는다. 고정 주소가 가장 최근에 검증·게시한 APK를 가리키는 방식이며 새 빌드 완료만으로 자동 갱신되지는 않는다.
- 테스트 → 웹 빌드 → main 배포 → production HTTP/브라우저 점검. 고정 주소는 유지하며 이미 높은 빌드를 설치한 기기에 낮은 빌드를 제안하지 않는다. 복구 APK도 새 높은 versionCode로 검증한다.

## 6. Success Metrics / Open Questions
- 공개 고정 주소와 버튼이 최신 검증된 APK를 제공하며 설치자가 링크를 매번 교체할 필요가 없다.
- 실휴대폰 브라우저별 설치 확인은 OS 동작이며 자동 업데이트와 구분한다.

## 출시 확인 — 2026-10-04
- 제품5d5acb0·Actions37203826300 success·Vercel dpl_34DnnRMr9ZKgoneUvEdTezbDwTt2 READY.
- 안내 https://study-room-attendance.vercel.app/download/android HTTP200/no-store·끝 slash/CSS200.
- 파일 주소 https://study-room-attendance.vercel.app/download/android.apk 307/no-store→현재 아이콘 APK11afaede. 실제 다운로드200·61,942,571bytes·검증된 APK SHA256 일치. 실제 화면4/4, 기존 로컬890/CI865통과·0실패, 선택 브라우저77생략은 별도 기록한다.

## 최신 출시 확인 — 2026-10-05

- updater0.2.0/code3의 고정 안내/JSON/alias를 dfc44c3로 게시했다. Actions37214626793 success/Vercel dpl_8LrYU7JzJHAoKPHYDMeVa2AYs7j1 READY. 고정 JSON200/application-json/no-store/전체 필드 일치·안내200·파일307/no-store→공개 GitHub Release android-v0.2.0-build3 APK200.
- 실제 파일61,975,731bytes/SHA256 c077f6815fc80be82dfb4cddc393797574df4543665108688219cca45d392b62 일치. 앱 안에서 이 파일을 다운로드하여 Android16 OS 승인으로2→3 업데이트/동일 로그인6메뉴 유지까지 확인했다. 최초 updater APK 한 번 수동 설치 후 앱 버튼을 사용하며 강제/무인 설치는 없다.

## 최신 출시 확인 — 2026-10-08

- 공개0.2.3/code6 GitHub Release android-v0.2.3-build6·APK61993631bytes/SHA2569ec58c88c5972d8b9780101d804800ac46c95d46cc43d4599cc0533c6f6bea40, 기존 signer/패키지 동일. 고정 안내/JSON/307을 같은GitHub6파일로 갱신했다.
- main3422df35/Actions37721915811 success/Vercel dpl_2kJxzFg3ytsWohr8XVNgCJ3LomtN READY. 운영 안내 두 경로200/no-store·0.2.3/code6, JSON200/application-json/no-store·전체필드, 파일307/no-store→익명 전체200·크기/해시 일치 확인. 앱 설정→앱정보→앱업데이트에서 새 버전을 확인한다.
- 첫5→6은 기존guard가 적용되어 PC공부 중 막히면 잠시 쉬거나 이 안내를 사용한다. 설치 이후6은 기기 단위 제한이다. 새 실기기 설치 검증·무인 설치/OTA를 추가하지 않았다.
