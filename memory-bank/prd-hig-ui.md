# PRD: HIG 기반 공통 UI와 로그인 오류 안내

- 상태: 2026-10-26 데스크톱·모바일 목업 사용자 승인, 기존 화면의 한정된 개선.
- 목표: 타이머·현재 할 일을 우선하고 웹·Windows·Android hosted 화면에 같은 정보 위계와 시각 토큰을 적용한다.
- 화면: 넓은 창은 5개 주요 메뉴와 내 페이지의 사이드 내비게이션, 작은 창은 기존 5개 하단 메뉴. 개인 공부 기본·팀 공부 전환·계획·기록 진입은 보존한다.
- 오늘: 세션 타이머/기존 조작과 오늘 총 공부/목표를 별도 그룹으로 구분한다. 출석과 시간 목표는 다른 상태이며 기존 출석·04시 공부일 정책은 변경하지 않는다. 숲은 전용 탭에서 제공하고 중복 미리보기는 제거한다.
- 공통: 흰 콘텐츠 면·옅은 세이지 배경·짙은 녹색 강조, 대비·초점·44px 이상 조작 영역·안전 여백·글자 확대 대응. 불필요한 영문 라벨/긴 로그인 설명을 줄인다. Apple UI 복제나 접근성 인증을 주장하지 않는다.
- 인증: Windows `sendCode`의 공급자 오류는 raw message 대신 허용한 고정 코드만 전달한다. 이메일 시간 한도/짧은 요청 제한/통신 실패를 구분하고 기존 재요청 대기와 암호화·세션 격리·PKCE를 유지한다. 서버 로그에서 429 `over_email_send_rate_limit`를 확인했으나 특정 사용자 요청과의 일대일 대응이나 Google 로딩 원인으로 확대하지 않는다.
- 비범위: DB/기록/계정 초기화, 요금제·SMTP·제공자 설정 변경, 영상 공유·판정 변경·새 로그인 제공자·전체 리팩터링.
- 검증: 실제 Chrome 375/1440/글자 확대·키보드·상태 전환·공통 화면/대비, native 인증 오류 회귀·기존 전체 테스트·desktop/mobile/build/docs 및 Dune. 실제 Google·이메일 인증은 사용자 직접 진행 후 별도 수용한다.
- 출시: 웹 변경은 기존 production workflow, 네이티브 변경은 새 Windows 설치 파일을 구분한다. Android hosted UI는 웹을 재사용하며 네이티브 로그인 수정이 있으면 APK가 별도로 필요하다.
- 근거: [HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [기존 Windows 계약](prd-windows-desktop.md).
