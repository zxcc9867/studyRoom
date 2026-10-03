# 전체 페이지 디자인 누락 보완 — 2026-10-04

## 결과와 범위

`design-audit-20261003.md`에서 확인한 공통 테마 누락을 수정했다. 새 디자인을 도입하지 않고 기존 차분한 녹색/따뜻한 종이 표면을 조건부 카드와 내부 컨트롤까지 확장했다. 공부·출석·회복·카메라·DND·Google/8자리 OTP·서버 API/DB 동작은 변경하지 않았다.

2026-10-04 사용자의 재배포 요청으로 웹과 새 APK 배포까지 완료했다. 배포는 이번 디자인 코드·회귀 테스트·관련 문서만 대상으로 하며, 운영 웹과 네이티브 로그인/연결 화면용 APK를 구분한다. 아래 출시 결과는 실제 운영 및 새 APK 확인에 근거한다.

- 휴식/복귀 약속: 진한 노랑·두꺼운 테두리·장식 곡선을 제거하고 의미 색상과 공통 1px 카드/44px 버튼 적용. 휴식 중 상단 배지를 실제 휴식 상태로 표시.
- 공부 시작 전 체크: 3px 녹색 테두리·하드 그림자·점선 내부를 공통 부드러운 표면/1px 카드로 교체.
- 카메라 상세: 헤더·메시지·세션 유지 안내를 짙은 글자와 최소14px로 교체. 스트림 획득/중단/복귀 로직은 그대로.
- 할 일/목표 편집: 시간·반복·요일 선택 및 연결 목록에 AA 대비와 44px 조작 영역 적용.
- 회고: 제목 옆 닫기 버튼, 읽을 수 있는 점수 그룹, 공통 입력/선택 상태. 기존 focus trap/ESC/종료 흐름 유지.
- 기록/목표/내 페이지/알림: 내부 요약·마일스톤·날짜·범례도 같은 표면과 보조 글자 체계 사용.
- 기술 피드: 언어 필터·원문 링크·출처·설정·브리핑을 최소14px로 통일. 기존 카드 본문/수집/추천/무한 목록 동작 유지.
- 공부 숲: 장면 LIVE/ROOM 글자 대비/크기 보완. 환경 렌더링과 아이템 색상 샘플, 이동 방법은 유지.
- 웹/네이티브 로그인: 같은 팔레트/30px 제목/15px 설명/1px 카드, 명확한 비활성 스타일. 네이티브 입력 접근성 이름과 작은 화면용 스크롤 제공. 네이티브 연결 바·로딩/오류/fallback·회고 선택 영역도 보완.

## 변경 파일과 이유

| 파일 | 이유 |
|---|---|
| `apps/web/src/dashboardRedesign.css` | 토큰을 인증 전에도 사용하도록 :root로 이동, 대시보드 보조 글자를14px 토큰으로 교체 |
| `apps/web/src/appTheme.css` | 조건부 카드·편집/회고 내부·기록·로그인·상태/선택/포커스·피드/숲 누락 보완 |
| `apps/web/src/techFeed.css` | 기존12/13px 보조 글자와 원문 링크의 !important 크기 강제를 토큰으로 교체 |
| `apps/web/src/SessionReflectionModal.tsx` | 제목/닫기 버튼을 같은 헤더에 정렬; 기존 이벤트/접근성 연결 보존 |
| `apps/web/src/main.tsx` | 로그인 제목을 간결하게 통일, 휴식 중 배지 표시만 교정 |
| `apps/mobile/App.tsx` | 네이티브 팔레트/StyleSheet·로그인 스크롤/입력 이름/비활성 상태·연결 바·회고 터치 영역 |
| `apps/mobile/src/WebFeatureScreen.tsx` | 웹 연결 전후 로딩/오류/fallback의 색상·타이포그래피 일치 |
| `apps/web/test/actualStudyMounted.test.mjs` | 실제 main entrypoint에서16개 디자인 회귀 사례 추가 및 기존 세션 동작 검증 유지 |
| `apps/web/test/mobileNativeTheme.test.mjs` | 웹/네이티브 실제 팔레트 값 비교와 AA 대비 계산 |
| `scripts/mobile-web-features.test.mjs` | 실제 네이티브 렌더 트리의 로그인/연결 버튼/회고 선택 크기와 접근성 계약 |

## 수정 전·후 비교

PC1440×960/모바일375×812에서 동일 예시 데이터·시각을 사용했다. 전체 페이지 캡처이므로 이미지 높이는 내용에 따라 다르다. 스크린샷의 날짜/기사/목표는 운영 데이터가 아니다. 아래 링크는 로컬 진단 파일이며 배포 파일이 아니다.

| 화면 / 동일 뷰포트 | 수정 전 | 수정 후 |
|---|---|---|
| 휴식/복귀 약속 · PC1440 | [전](../output/design-audit-20261003/paused-1440.png) | [후](../output/design-fix-20261003/paused-1440.png) |
| 시작 전 체크 · 모바일375 | [전](../output/design-audit-20261003/precheck-375.png) | [후](../output/design-fix-20261003/precheck-375.png) |
| 카메라 상세 · 모바일375 | [전](../output/design-audit-20261003/camera-tools-375.png) | [후](../output/design-fix-20261003/camera-tools-375.png) |
| 회고 모달 · 모바일375 | [전](../output/design-audit-20261003/end-reflection-modal-375.png) | [후](../output/design-fix-20261003/end-reflection-modal-375.png) |
| 기술 피드 · PC1440 | [전](../output/design-audit-20261003/feed-1440.png) | [후](../output/design-fix-20261003/feed-1440.png) |
| 웹 로그인 · 모바일375 | [전](../output/design-audit-20261003/login-375.png) | [후](../output/design-fix-20261003/login-375.png) |

## 대비와 조작 기준

| 텍스트/표면 | 확인한 대비 |
|---|---|
| 기본 글자 `#28372e` / 종이 `#fffdf5` | 12.30:1 |
| 보조 글자 `#4e5b50` / 종이 | 7.02:1 |
| Primary `#2f6b52` / 종이 (또는 역조합) | 6.16:1 |
| Primary / 부드러운 표면 `#edf3ea` | 5.56:1 |

카메라 헤더의 이전1.04:1, 시간/반복 선택3.54:1, 회고 점수4.36:1 문제를 해결했다. 본문16px/설명15px/보조14px를 사용하며, 주요 버튼 높이44px 이상과 포커스 표시를 유지한다. 작은 checkbox/radio의 그림 크기와 label 선택 영역은 구분한다.

숲의 밤 표시 `☾`와 민트 색상 샘플 `●`는 각각 읽을 수 있는 텍스트 레이블과 함께 쓰는 장식/색상 견본이다. 이 둘은 일반 본문 대비 통과 주장에 포함하지 않았다. 3D 환경 색은 UI 본문 토큰으로 덮어쓰지 않는다.

## 검증 결과

- `npm.cmd test`: 전체903건 중845통과/58선택 브라우저 생략/0실패. 생략된58건을 아래 별도 실행에서 모두 확인했다.
- 실제 main mounted 브라우저:51/51통과/0생략/0실패. 그 중16건은 이번 디자인 회귀 사례이며 시작/휴식/재개/충돌 취소/계정 경계 등의 기존 동작 검사를 보존했다.
- 피드 브리핑·언어·반응형 브라우저:7/7통과/0생략/0실패.375/390/1440/2200px 관련 사례 포함.
- `npm.cmd run build`: TypeScript/Vite 성공,1726모듈.
- `npm.cmd run mobile:check`: Expo/React Native 호환성 및 TypeScript 성공.
- `npm.cmd run docs:check`: README3언어/이미지24건 성공.
- 60개 화면 상태 캡처(중복 포함):26기본+22모달/상세+12추가, 진입 미완료0/가로 넘침0/14px 미만 보이는 글자0/44px 미만 높이 버튼0. 모달 Tab/ESC 검사 실패0.
- 읽기 전용 코드 리뷰: Critical/Important 없음. 앱 상단13px 글자와 회고 선택 영역44px 보장을 추가 회귀 검사 후 보완했다.
- 린트: 저장소에 lint 스크립트가 없어 실행하지 않았다. Edge/API/DB 변경이 없어 운영 서버 검증이나 마이그레이션을 수행하지 않았다.

로그: `output/design-fix-20261003/{unit,browser,feed-browser}.log`. 시각 근거: 같은 폴더의 `{evidence,dialogs-evidence,additional-evidence}.json`과 PNG. 최종 수정은Oct4지만 작업 시작일 기준 출력 폴더명을 유지했다.

## 검증 경계와 출시

- 제품 커밋 d3f28ae7a167adeb317a2df8a1ce2ca0c99b94d9 main 푸시. [Actions37133451775](https://github.com/zxcc9867/studyRoom/actions/runs/37133451775) success, Vercel dpl_Au6gUJVnfsvsTTSef6EGBwxmbEVx READY/동일 commit. [운영 웹](https://study-room-attendance.vercel.app) HTTP200 및 새 CSS index-C86GTzPf 확인. 운영 로그인1440/375px 넘침0·30px 제목 확인.
- 무료 EAS preview dd0a8955-690d-4cd4-be10-0a6bd3216de4 FINISHED/동일 commit. [새 APK 다운로드](https://expo.dev/artifacts/eas/Xu2X_xH-3wJ7-UP2C7SO_6YAPDczNRiDQ2R3COcBabk.apk) HTTP200/61,568,522bytes, 기존 패키지·인증서 일치·adb install -r 성공. 앱/로그인 데이터를 삭제하지 않았다.
- 새 APK의 Android16 에뮬레이터에서 기존 로그인 유지·6개 메뉴 진입·411px 넘침0·공통 테마와 새 native 연결 바를 확인했다. 회복 본문15px/7.02:1·닫기44px, 카메라 안내14px/5.56~7.02:1. 학습 세션 생성이나 회복 제출 없이 마지막은 오늘/카메라 해제 상태다.
- 로그인 후 웹 화면은 웹 배포로 기존 APK WebView에도 적용되지만, 최초 네이티브 로그인/연결 바/fallback 스타일은 새 APK가 필요하다.
- 최초 네이티브 로그인은 타입·팔레트·실제 컴포넌트 렌더 트리 계약 검사이며 실제 계정 Google/OTP 재인증은 하지 않았다. 실휴대폰 키보드·확대 글꼴·안전 영역·OS 권한/DND 테스트는 수행하지 않았다.
- 집중 연결 설정 복귀 후 종료된 카메라 트랙의 자동 재획득 문제는 이번 디자인 범위에서 수정하지 않았다. 기존 진단과 후속 작업을 memory-bank에 유지했다.
- 실제 사용자 공부/회복/구독/기기 데이터와 OS 설정은 변경하지 않았다. 기존 dirty/untracked 파일도 보존했다.
