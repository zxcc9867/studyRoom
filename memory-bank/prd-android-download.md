# PRD: 고정 Android 다운로드 주소

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
