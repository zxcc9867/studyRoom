# PRD: 독서실 앱 아이콘

## 1. Problem
설치한 앱을 홈 화면에서 독서실 서비스로 쉽게 식별할 수 있어야 한다.

## 2. Target Users
기존 Android APK를 업데이트하여 사용하는 독서실 사용자.

## 3. Goals
사용자가 승인한 초록 배경·아이보리 책·금색 스탠드 디자인을 launcher 아이콘으로 적용한다.

## 4. Non-goals
앱 이름/패키지/서명 변경, Play 공개, OTA 도입, 새로운 권한, 알림 발송 정책 변경은 제외한다.

## 5. User Stories
- 사용자는 홈 화면의 아이콘으로 독서실 앱을 알아본다.
- 기존 앱을 삭제하지 않고 새 APK를 설치하여 아이콘과 기존 기능을 함께 유지한다.

## 6. User Scenarios
- 일반: APK 다운로드 → 같은 패키지·서명으로 업데이트 → launcher에서 아이콘 확인.
- 예외: launcher 마스크가 원형 또는 둥근 사각형이어도 책·조명이 잘리지 않아야 한다.
- 오류: 서명/설치 실패 시 데이터 초기화·앱 삭제를 자동 안내하지 않는다.

## 7. Functional Requirements
- [x] Expo icon은 assets/study-room-icon.png를 사용한다.
- [x] Android adaptiveIcon은 여백이 넓은 study-room-adaptive-icon.png와 초록 backgroundColor를 사용한다.
- [ ] 공개 APK의 실제 launcher 아이콘과 삭제 없는 설치를 확인한다.

## 8. Non-functional Requirements
- 외부 이미지 URL/런타임 다운로드 없이 APK에 자산을 포함한다.
- 원본은 imagegen 내장 도구로 제작한다. PNG 원본1254px는 Expo 빌드에서 기기 밀도별 크기로 변환한다.
- 투명 추출 시안은 가장자리 품질 때문에 채택하지 않고 깨끗한 불투명·넓은 여백 foreground를 사용한다. 동일 초록 배경과 함께 마스킹한다.

## 9. Dependencies
Expo53 icon prebuild 플러그인, 기존 EAS preview APK, 기존 원격 서명. DB/API/새 환경 변수 없음.

## 10. Success Metrics
서명 일치/adb install -r 성공, 로그인 유지, 실제 launcher 아이콘 확인.

## 11. Rollout Plan
설정·자산 검사 → EAS 아카이브 검증 → 무료 preview APK 빌드 → 공개 HTTP 다운로드 → 서명·에뮬레이터 검증 → 새 링크 제공.

## 12. Open Questions
실제 휴대폰 제조사별 launcher 캐시는 에뮬레이터 검증과 별개다. 앱 업데이트 구조는 기존과 같다.

## 제작 프롬프트 / 도구
- 내장 imagegen 사용. 원본: forest green #2F6B52, warm ivory open book and desk line, small warm-gold desk lamp, minimal bold silhouette, no text/border/tile.
- adaptive: 같은 승인 디자인을 보존하고 전체 책·조명·책상선을 줄여 중앙에 배치, 가장자리에는 넓은 초록 여백, 원형 mask가 그림을 자르지 않게 한다.
