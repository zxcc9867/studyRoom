# HIG 공통 상태 화면·UI 점검

## 범위와 보존 계약

- 사용자 승인: 로그인 완료/실패/연결 실패 통일, 이어서 기존 앱 전체 UI/UX 점검·표적 개선. 0.1.6 무삭제 덮어설치는 공부·카메라 미사용 조건으로 승인됨.
- redesign-existing-projects로 기존 화면/스택/동작 보존, ui-ux-pro-max의 reduced-motion/keyboard 참고와 [Apple HIG Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)을 적용했다. Apple UI 복제/접근성 인증이 아니다.
- DB/API/Auth 설정/계정/학습·회복·출석·팀·04시 공부일/카메라 판정은 변경하지 않는다. 실제 계정 로그아웃이나 테스트 공부 기록 생성 없음.

## 변경

- desktopStatus.css: 흰 카드·세이지 배경·공통 녹색·한글 폰트·가독성 있는 제목/본문·반응형 폭·안전 여백·키보드 초점. 성공/오류 아이콘 외에도 문구로 상태 구별.
- desktopLoopback.mjs: 고정 CSS를 한 번 읽어 LF 정규화 후 SHA256 CSP로 허용·삽입. 외부 자산 요청/코드·계정·콜백 주소 반사 없음. 기존 성공 전용 close/실패·취소 유지/PKCE·일회성·5분 경계 보존.
- error.html: 같은 CSS와 실제 다시 연결 링크. 공부 종료/서버 저장 완료가 아님 및 트레이 종료 안내 유지. unsafe-inline 제거, local self stylesheet만 허용.
- appTheme.css: 로그인 전 화면도 동작 줄이기 적용. 입력창 초점은 기존 구현이 정상이어서 제품 수정 없음.
- Windows0.1.6 package/lock·CSS 패키징. 신규 의존성/새 APK 없음.

## 전체 화면 감사

| 대상 | 실행한 확인 | 결과/경계 |
|---|---|---|
| 오늘·목표·계획·기록 | 실제 main.tsx/공통 CSS를 마운트한 Chrome375/1440, 정보 위계·내비게이션·조작 영역·저장/취소 | 기존 자동 테스트 통과, 합성 서버 데이터 |
| 팀·피드·숲 | 마운트된 실제 컴포넌트·상태/설정/오류·가독성·공통 표면·방향 패드 부재 | 전체 Chrome 회귀 통과, 실계정/물리 기기 수용과 구분 |
| 설정·로그인·회복·회고·카메라 진단 | 키보드·모달·실패/재시도·대비·타이머/카메라 보존 | 기존 전체 회귀 통과 |
| 로컬 완료·실패·연결 실패 | 실제 Chrome375/1440, 200% root 글자·짧은 창·키보드·고정 CSS/CSP | 새6개 화면 회귀 통과 |
| 동작 줄이기 | 실제 공통 CSS의 로그인/대시보드 입력 초점·transition | RED: 로그인160ms → GREEN:0ms |

전체 앱의 OS 글자 확대/스크린리더·실제 Android/iOS/물리 카메라·실제 계정 재인증을 모두 완료했다고 주장하지 않는다. 이전 감사의 강제 계산 글꼴2배/375px 타이머 넘침 제한은 이번 로컬 상태 화면200% 검사와 별개다.

## 검증

- Chrome 전체1424/1424·실패/생략/취소0,358739ms. 기존 공부·휴식·재개·종료·기록 보존/설정·팀·피드·숲·회복·대비/조작 포함. `output/hig-chrome-full.log`.
- Native155/155·실패/생략/취소0. `output/hig-native-final.log`.
- 실제 Chrome status10/10: 성공 닫힘/정책 거부 안내·실패/취소 유지 + 새3상태×2폭. 전체 native integration27/27·407272ms·실패/생략/취소0. `output/hig-electron.log`.
- 실제 Electron 숨김360174ms: 합성 영상7209프레임·heartbeat361/ACK361·오류/timeout/pending0·같은 프로세스/문서/트랙live. 합성 로컬 검사이며 물리 착석/원격 서버 수용 아님.
- 독립 review Important1: CRLF 원문 hash와 HTML LF 정규화 불일치. 실제 CRLF checkout RED→LF 정규화 GREEN9/9. 재검토 Critical/Important/Minor0, 독립 Chrome LF/CRLF×성공/실패4/4·CSP 오류0. 최종 수정 후 Chrome10/10 및 실제 Electron Google loopback1/1 재실행 통과.
- Dune0·선언7명령 검증 통과. 최종 문서/패키지 검사 및 출시 결과는 아래에 기록한다.
- Native 새 화면 최초 baseline은 main 부재 timeout으로 실패했고 수정 후 통과. 제한 sandbox의 connect EACCES는 host 재실행과 구분하며 앱 결함으로 수정하지 않았다.

## 설치 파일과 적용

- 최종 NSIS0.1.6 build exit0.123057962bytes, SHA256 `C1FFF2EDD8122AD5BFE1C2C868638D9A4A5FB76C0A36211108E2478A6D29168D`, NotSigned. 보안 경고 우회/인증서 구매 없음.
- ASAR532항목·금지0·native12파일 소스 일치·공개 설정origin/supabaseUrl/supabaseAnonKey만. ASAR SHA256 `74a8899ba5dc85b6e54b110e55e095429e299d0d3150ffc62c8bf8f73ba08239`.
- 로컬/원격0.1.6 태그 충돌 없음. 승인된 기존 경로 덮어설치exit0, encrypted-auth1파일 전후 byte digest 동일·기존 프로필 보존·설치 ASAR 후보 일치. 첫 검사에서 ProductVersion을3자리로 잘못 기대해 중단했으나, 실제 FileVersion0.1.6/ProductVersion0.1.6.0/패키지0.1.6으로 정상 설치 확인 후 재실행했다. 설치 재시도/초기화/로그아웃 없음.
- 최종 `ai.ps1 verify` Dune0·선언7명령 모두exit0. `output/hig-verify-final.log`.
- 웹은 기존 feature-ref workflow로 배포하고 정확 SHA/READY/공개HTTP200을 확인한다. 기존 native 로그인 수정 미커밋 파일은 웹 배포 커밋에 임의로 포함하지 않는다.
