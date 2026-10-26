# PRD: Windows 독서실 앱

- 상태: 2026-10-25 사용자 서면 설계 승인·구현 진행. [구현 계획](../docs/superpowers/plans/2026-10-25-windows-desktop.md)을 따른다.
- 최종 검토 상태: 10/26 사용자 승인으로 R1 actual SDK 회귀와 정리 소유권을 보완, 집중7/7·인증44/44·native116/116/check11·독립 scoped 검토 ADDRESSED/새 중요결함0. 기존tree 웹1404/1404, 현재Electron/NSIS 재확인 중. 최신main9f381ab의후속출석/저장복구를보존한별도통합tree 자동3way는clean이며최종gate/배포대기다. 실계정·실제 웹캠 수용은 별도이며 완료로 표시하지 않는다.
- 상세 설계: [Windows desktop design](../docs/superpowers/specs/2026-10-24-windows-desktop-design.md)

## 1. Problem

브라우저 탭 대신 Windows 설치형 앱으로 독서실을 실행하고 싶다. 별도 화면·기록 체계를 만들면 웹/Android와 디자인 및 학습 상태가 달라진다. X로 창을 닫을 때 공부와 카메라가 끊기지 않아야 한다.

## 2. Target Users

기존 독서실 계정으로 Windows PC·웹·Android를 함께 사용하는 사용자.

## 3. Goals

- 기존 Vercel 화면과 Supabase 계정·학습 기록을 재사용하는 Electron Windows 앱.
- X는 트레이 숨김, 공부·카메라 유지. 완전 종료는 별도 명시적 메뉴.
- 기존 출석·회복·단일 세션·카메라 담당·기기 단위 참여 정책 보존.
- Windows 설치·로그인·재실행·공부·다중 기기 상태 동기화의 실제 검증.

## 4. Non-goals

오프라인·새 서버/DB·별도 대시보드·영상 공유·카메라 판정 변경·Windows 방해금지/자동 시작/절전 변경·스토어/공개 Release 게시·유료 서비스·네이티브 자동 업데이트는 제외한다.

## 5. User Stories

- Windows 아이콘으로 열어 기존 웹과 같은 공부·목표·팀·피드·숲·설정을 사용한다.
- X를 누르면 트레이로 숨겨 집중을 계속하고, 필요할 때 같은 창을 복원한다.
- PC/Android에서 같은 계정의 상태와 기록을 확인하되 별도 카메라를 강요받지 않는다.
- 공부를 끝내고 앱을 종료할 때 기존 회고·저장을 정상 완료한다.

## 6. User Scenarios

### Normal Flow

1. per-user x64 설치 파일로 설치 후 실행한다.
2. 공통 디자인에서 시스템 브라우저 Google 또는 기존 8자리 코드로 로그인한다. 현재 운영 GitHub 제공자는 꺼져 있으므로 새 로그인 버튼/제공자 설정은 추가하지 않는다. 네이티브 PKCE 계약은 GitHub도 지원한다.
3. 기존 공부 시작·카메라 준비 흐름을 완료한다.
4. X로 숨기고 트레이 상태와 다른 기기의 동기화를 확인한다.
5. 트레이에서 복원하거나 기존 공부 종료/회고 완료 후 앱을 종료한다.

### Edge Cases

- 중복 실행은 기존 창 복원. 카메라 담당을 추가 생성하지 않는다.
- 다른 기기 공부의 관찰자면 Windows 앱 종료로 원격 공부를 끝내지 않는다.
- 종료 취소는 실행 유지. 시스템 절전·강제 종료는 기존 서버 복구 정책을 따른다.

### Error Cases

- 트레이 실패 시 숨기지 않는다. 카메라 거부·통신 오류·인증 취소는 명확한 재시도 경로를 제공한다.
- 상태를 확인하지 못한 종료는 성공 저장으로 위장하지 않는다. 명시적 경고 후 프로세스만 종료할 수 있다.
- 암호화 저장이 불가능하면 토큰을 평문 저장하지 않는다.

## 7. Functional Requirements

- [ ] Windows 네이티브 창에 기존 production 웹 UI를 재사용한다.
- [ ] X→hide는 문서·카메라·공부/담당을 유지하며 최초 안내를 제공한다.
- [ ] 트레이 열기·신선한 기기 상태·완전 종료, 단일 인스턴스를 지원한다.
- [ ] 종료는 기존 웹/서버 경로로만 처리하고 미완료 저장을 확인한다.
- [ ] OAuth PKCE·8자리 로그인·일회용 웹 세션 연결·로그아웃·재실행을 지원한다.
- [ ] 동일 계정 서버 기록 공유·단일 카메라 담당·관찰 기기 무인증 정책을 유지한다.
- [ ] 신뢰 최상위 HTTPS 화면만 좁은 브리지/비디오 전용 권한을 사용한다.
- [ ] 설정에 Windows 버전을 표시하고 Android 전용 기능과 구분한다.
- [ ] 로컬 NSIS 설치 파일을 만들고 동일 앱 ID/userData로 업데이트 설치한다.

## 8. Non-functional Requirements

- 성능: 숨김 시 프레임·감지·heartbeat 유지. 실제 CPU/메모리를 측정하며 불필요한 창/중복 세션을 만들지 않는다.
- 보안: sandbox/contextIsolation·Node 차단·origin+mainFrame+문서 세대 검사·암호화 네이티브 인증 저장·비밀 로그 금지. Windows renderer의 별도 웹 세션은 메모리에만 유지하고 기존 웹/Android의 저장 정책은 보존한다. 종료 증거에는 시간대·공개 태그 등 실제 설정 저장 중 상태도 포함한다.
- 접근성: 기존 웹 포커스·대비·반응형 유지, Windows 배율과 트레이 접근 확인.
- 유지보수성: Electron은 창/OS만, DashboardApp/서버는 기존 학습 상태만 소유한다. 버전/브리지 capability를 명시한다.

## 9. Dependencies

- 내부: 공통 웹 DashboardApp·인증 게이트·deviceStudyActivity·카메라 담당·앱 설정·기존 아이콘.
- 외부: 지원 버전을 고정한 Electron·electron-builder, Windows x64.
- Supabase: 기존 Auth/RLS/API/`mobile-web-auth` 재사용. DB 변경 없음.
- 운영 설정: `studyroom-desktop://auth/callback` redirect 추가 완료. 사전 안내·단일 속성 diff·기존7개 주소와 나머지13개 설정 보존 확인. 실제 OAuth 로그인 수용은 별도다.
- 환경: 공개 Supabase URL/anon key와 정확한 production origin만 패키지 설정에 사용. 서비스 역할 키는 앱에 포함하지 않는다.

## 10. Success Metrics / 완료 기준

- desktop 단위/실제 Electron 통합 검사, 웹 mounted 회귀, 기존 test/test:edge/mobile:check/build/docs:check·Dune·diff 검사를 통과한다.
- 실제 Windows 설치·인증·공부 4단계·6분 숨김 카메라·트레이/종료·재실행·업데이트 설치를 확인한다.
- 같은 계정 웹/Android16에서 상태/서버 기록 일치, 관찰 기기 추가 인증/잘못된 경고 없음, 기존 행 보존을 검증한다.
- 자동 영상 fixture와 실제 웹캠 착석, 웹 배포와 설치 파일 게시의 수용 경계를 구분한다.
- 독립 검토의 차단 결함을 해결한다. 상세 매트릭스는 설계 §9를 따른다.

## 11. Rollout Plan

- 개발: 서면 설계 승인 → 구현 계획 → 테스트 우선 구현. Windows 초기 버전 `0.1.0`, Android 버전 불변.
- 테스트: 식별 가능한 `[테스트] Windows ...` 항목만 추가. 기존 학습·회복 기록 보존·잠금 우회 금지.
- 배포: 웹 변경은 프로젝트 규칙의 production 배포까지. Windows는 로컬 설치 파일 검증, 공개 게시/고정 링크는 별도 요청.
- 서명: 인증서 미제공 시 미서명/SmartScreen 한계를 보고하고 보호 기능을 끄거나 유료 구매하지 않는다.
- 모니터링: 비밀 없는 로컬 진단과 기존 서버 상태 확인. 새 유료/상시 감시 서비스는 추가하지 않는다.

## 12. Open Questions

사용자가 A 방식과 서면 설계를 승인했다. 추가 제품 선택은 없다. OAuth callback 설정은 보존 검증까지 완료했으며, 실제 로그인·실제 웹캠 착석은 별도 수용 단계다. 운영 GitHub 제공자 활성화·Windows 공개 게시·서명 인증서·자동 업데이트는 후속 요청 범위이며 이번 구현에서 추가하지 않는다.
