# 오늘 화면 디자인 목업 · 2026-10-02

이 폴더의 HTML은 사용자 검토용 제안으로 예시 데이터만 사용한다. HTML 목업의 타이머는 실제로 흐르지 않고 카메라 권한·로그인·저장·방해금지·외부 요청을 실행하지 않는다. 2026-10-02 사용자 승인 후 별도로 실제 제품 컴포넌트에 적용했다. 적용 요구사항/검증은 `memory-bank/prd-main-dashboard-redesign.md`와 progress에 기록한다.

## 실제 적용

- main.tsx, DashboardNavigation.tsx, ActualStudyPanel.tsx 및 dashboardRedesign.css에서 동일 녹색/표면/정보 위계를 재사용한다. Android 단일 WebView에도 같은 운영 웹 디자인이 적용되며 이번 변경은 새 APK를 요구하지 않는다.
- 기존 서버/출석/카메라/휴식/회복/일정 조정 규칙은 유지한다. PC/모바일 mounted main 테스트의 수정 전후 캡처는 `output/playwright/dashboard-{before,after}-{1440,375}.png`에 생성된다. 예시 백엔드 캡처와 실제 운영 에뮬레이터 증거는 구분한다.
- 운영 배포와 앱 반영 완료 여부는 프로젝트 active-context의 최신 항목을 확인한다. 아래 ‘적용 전 남은 결정’은 목업 작성 당시 기록이다.

## 제안

- 현재 집중할 일과 이번 세션 시간을 하나의 주 화면에 합친다. 오늘 누적/목표는 작은 진행도로 구분한다.
- 시작/재개/휴식은 한 개의 주 버튼을 상태에 따라 바꾼다. 종료는 진행 중인 세션에서만 보조 버튼으로 표시한다. 기존 완료·회고 확인 흐름을 바꾸려는 제안이 아니다.
- PC는 집중 영역 + 간략 계획의 2열, 모바일은 집중 먼저·계획 아래의 1열이다.
- 집중·계획·기록은 유지한다. 월간 통계·대표 목표 편집·습관 설명을 집중 화면에 반복하지 않는다.
- 카메라·휴대폰·세션 lease는 상태 한 줄과 펼칠 수 있는 상세 영역으로 묶는다. 회복루틴·조회 실패는 접힌 영역에 숨기지 않는다. 경고/만료 임박의 최종 배치는 실제 제품 적용 설계에서 재검토한다.
- 숲 성장 미리보기는 보조 영역이다. 별도의 시작 CTA를 추가하지 않는다.
- PC 상단/모바일 하단 메뉴 배치는 제안일 뿐이다. 모바일 ‘더 보기’에 내 페이지·알림·화면 구성·로그아웃 접근을 보존한다.
- 시각 변수는 기존 sessionTodoModal.css의 녹색/따뜻한 표면/텍스트 계열을 참고해 목업 내부에만 정의했다. Pretendard를 새로 설치하거나 외부에서 로드하지 않으며 현재 OS 한글 폰트로 fallback한다.

## 확인 방법

`index.html`을 브라우저로 연다. 위의 상태 선택에서 집중 중·시작 전·휴식 중·회복 필요·연결 오류를 비교할 수 있다. 집중/계획/기록 탭과 상태 상세 펼치기, 할 일 선택 dialog는 디자인 검토용이다. 모든 클릭은 로컬 예시 상태만 바꾼다.

`capture.mjs`는 로컬에 설치된 Playwright와 Chromium을 사용한다. 다른 환경에서는 `MOCKUP_PLAYWRIGHT_MODULE`, `MOCKUP_BROWSER_EXECUTABLE`에 설치된 런타임 경로를 지정한다.

```powershell
node docs/mockups/main-dashboard-20261002/capture.mjs
```

## 검증

- 1440px 및 375px 실제 Chromium 렌더링, 가로 넘침 없음, JavaScript 오류 0, HTTP 외부 요청 0.
- 41개 assertion: 휴식/재개에서 표시 시간 유지, 시작 전 종료 숨김, 할 일 선택 dialog에서 서버 시작 없음, 회복 경고 노출, 조회 실패 시작 비활성/재시도, 탭 방향키, Escape 닫기, 모바일 더 보기.
- 명도 대비 계산: 본문/표면 12.30:1, 보조문자/표면 7.02:1, 흰 글자/주 버튼 6.28:1, 상태문자/상태표면 6.07:1. 모든 요소에 대한 접근성 인증을 의미하지 않는다.
- 상태 스크린샷: desktop-1440.png, mobile-375.png, mobile-first-screen-375.png, idle/break/recovery-{1440,375}.png.

## ECC 설치 확인

사용자 로컬 SKILL.md에서 `metadata.origin: ECC`가 명시된 스킬 13개를 확인했다: api-design, backend-patterns, coding-standards, database-migrations, e2e-testing, frontend-patterns, nestjs-patterns, nextjs-turbopack, postgres-patterns, prisma-patterns, search-first, tdd-workflow, verification-loop. ECC 이름의 전용 플러그인 등록은 설치 목록에서 확인되지 않았다. 플러그인/스킬/설정을 설치하거나 변경하지 않았다. 이번 검증에는 verification-loop의 범위·보안·diff 검토를 사용했다.

## 적용 전 남은 결정

레이아웃 승인 후 별도 구현 범위를 정한다. 세션·카메라·출석·회복·알림·모바일 연결 계약은 유지해야 한다. 사용자 개인화 순서와 경고 우선순위, 실제 API loading/partial error, 장문 할 일/확대 글자/키보드, 390px Android WebView 등은 운영 컴포넌트 적용 단계에서 검증한다. 현재 목업 검증은 실제 앱 수정·배포 완료가 아니다.
