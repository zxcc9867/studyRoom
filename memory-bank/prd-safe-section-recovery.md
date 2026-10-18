# PRD: 공부 상태를 보존하는 화면 연결 복구

## 1. Problem / Target Users

배포 전부터 열린 PC·Android hosted 화면에서 이전 lazy chunk가 HTML로 응답해 React 전체가 비었다. 메뉴 로딩 실패가 공부·카메라 제어까지 제거해서는 안 된다.

## 2. Goals / Non-goals

- 실패한 영역만 안내로 대체하고 대시보드·학습 상태 소유자를 유지한다.
- 자동 새로고침, 자동 공부 종료·휴식, 카메라 재인증·담당 전환을 추가하지 않는다.
- DB/API/네이티브/APK·기존 카메라 판정·출석·회복 정책과 저장 기록은 변경하지 않는다.

## 3. User Scenarios

1. 피드·팀·숲·리포트·설정 하위 영역 로딩이 실패하면 해당 영역에 연결 안내를 표시한다.
2. 사용자는 오늘의 집중 화면으로 돌아가 공부를 계속한다. 회고 화면 실패는 닫기로 기존 공부에 복귀한다.
3. 공부 중(휴식 포함), 초기 학습 조회·변경 처리 중에는 전체 새로고침을 막는다.
4. 유휴 상태에서만 입력 손실 안내를 확인하고 명시적으로 새 화면을 불러온다. 저장된 기록은 유지한다.

## 4. Requirements

- React.lazy 실패는 가장 가까운 영역 boundary에서 격리하며 DashboardApp·camera controller를 재마운트하지 않는다.
- 필수 공부 종료·회고 UI는 entry와 함께 로드한다. 종료에 필요한 화면이 누락된 lazy 파일에 의존해 무한히 막히지 않게 한다. 회고·정상 종료 계약을 생략하거나 기본값을 자동 제출하지 않는다.
- 기존 Suspense 로딩 표시를 유지한다. 실패한 lazy Promise를 무한 재시도하지 않는다.
- 실패 메시지에 원시 오류·인증값·자산 URL을 출력하지 않는다.
- 복구 버튼은 최신 props로 재검증한다. 실패 후 공부가 시작되면 새로고침도 차단된다.
- 회고 오류는 기존 AccessibleDialog의 Escape·초점 복귀·키보드 순환을 사용한다.
- 375/1440px, 글자 확대, 대비·44px 터치 영역을 검증한다.

## 5. Dependencies / Architecture

웹 UI의 RecoverableSection만 오류 상태를 소유한다. 공부 상태와 공식 변경 API는 기존 DashboardApp이 유지한다. 외부 의존성·환경 변수·DB 변경 없음.

## 6. Acceptance / Rollout

- 실제 main.tsx mounted Chrome에서 lazy chunk 실패를 주입해 RED→GREEN, 공부/카메라/형제 입력 보존·오늘 복귀·회고 닫기·유휴 명시 새로고침을 검증한다.
- ai.ps1 verify(Dune·Node·Edge·mobile·build·docs), 전체 Chrome, 독립 검토 후 production 배포 및 PC/Android 확인.
- 작업 브랜치 fix/study-room-update-recovery. 이전 feat/team-study-room과 전용 rollback/study-room-before-recovery-20261019에 ce7704a8b85b209d12df9969e2c71e5567dd4b9b를 보존한다. 이 SHA의 제품 소스는 기존 운영72b5434와 동일하다. 롤백은 기존 workflow를 보존된 ref로 실행하며 학습 DB는 되돌리지 않는다.
- 실제 이전 배포 자산의 영구 보존·자동 무중단 갱신·service worker·전체 앱 런타임 오류 복구는 범위 밖이다.

## 7. Open Questions

없음. 사용자가 후속 개선의 선정·구현을 위임한 범위에서 실제 재현된 장애를 우선한다.
