# 설정 분류·요약/편집 UX 개선 — 2026-10-29

## 승인과 범위

- 사용자 승인: ‘분류형 + 요약·편집 분리’. 기존 계정/공부와 화면/알림/기기 연결/앱 정보 기능을 유지한다.
- redesign-existing-projects가 기존 흰색/세이지/녹색 토큰·스택을 유지하는 설계를 담당했다. ui-ux-pro-max의 로컬 UX catalog에서 Form Labels/Submit Feedback/ARIA Labels(High)를 참고해 항상 보이는 입력 라벨·저장 중/성공/실패·아이콘 접근성 이름을 유지했다. 처음 progressive-disclosure 검색의 상위 결과는 부적합해 설계 근거로 쓰지 않았다. 플러그인 설치/설정 변경 없음.
- SettingsLayout은 선택 분류만 소유한다. 숨긴 구역은 unmount하지 않아 초안·저장 중 상태를 보존하며, root userId key로 다른 계정에 전달하지 않는다. 기존 #settings·저장 RPC/브리지·업데이트 controller·학습/회복/출석 정책은 불변이다.
- 웹 공통 화면만 변경한다. APK/Windows 설치 파일·서명/DB/Auth/Chrome 설정·이전 native 미커밋 작업은 변경하지 않는다. 종료 안전 확인창의 실제 원인/해결은 이 UI 작업의 범위가 아니다.

## 구현

- PC 왼쪽, 모바일 상단5분류 버튼. 활성 분류만 표시하고 nav의 접근성 이름/pressed/controls·키보드 Tab·44px 조작 영역을 제공한다.
- 공개 태그/시간대는 현재 값+변경부터 표시한다. 편집 시 입력 라벨/도움말/저장·취소, 저장 성공 시 요약으로 복귀한다. 실패 시 초안을 유지하며 pending 동안 중복 저장/취소를 막는다.
- 알림은 저장된 평일/주말 시간을 먼저 표시하고 기존 알람·채널·적응형 설정을 펼쳐 편집한다. 기기 연결과 앱 버전/업데이트 구역을 분리하고 Windows 카메라 설정을 기기 연결에 배치했다. 기존 네이티브 API/권한 요청 시점은 동일하다.
- 독립 검토에서 익명 태그가 영구 ‘확인 중’이 되는 새 표시 문제를 발견해 조회 없는 정식 계정 안내로 수정했다.

## 검증

| 범위 | 실행/기준 |
|---|---|
| 새 분류·편집 | 실제 main/컴포넌트/CSS를 Chrome에 mounted,375/1440×1x/200%, 하나의 표시 구역·명확한 현재 값·명시적 입력·취소·분류 간 초안 보존 |
| 기존 저장 | 태그 정규화/실패/재시도/계정 전환, 시간대·알림 실제 콜백/요청값·학습 전후 보존 |
| pending | Windows same-turn 저장 카운트·분류 간 동시 태그/시간대 쓰기·완료/실패 후 해당 카운트만 해제 |
| 기기/업데이트 | Android ready/downloading/failed/failure/legacy·계정 전환, Windows 설치 버전/암호화/OS 카메라 설정 분류, 자동 다운로드/공부 시작 없음 |
| 접근성 | 44px·대비4.5·라벨/초점·알림 Enter→Tab·글자200%·가로 넘침 없음 |
| 익명 | 초기 안내를 닫고 설정 진입, 정식 계정 전용/aria-busy=false·태그 조회/편집 없음 |

- 신규6개 RED: 분류 nav 없음4, 읽기 요약 없음2 → GREEN6/6. Windows 위치 검사의 초기 실패는 CSS 누락 fixture 문제와 구분하고 실제 CSS를 포함한 최종 검사1/1을 확인했다. 되돌리기 진단 시도는 안전 검토에서 차단되어 적용하지 않았고 우회하지 않았다.
- 중간 focused35개 중33통과/2실패는 구형 ‘접힌 summary 다음 Tab’ 기대였으며 새 구조에 맞게 Enter로 연 뒤 Tab 검사로 수정해 관련2/2를 통과했다. 구형 settings 외곽 면 기대도 새 settings-content 면으로 변경했다.
- 최종 `ai.ps1 verify --project .` 통과: Dune 위반0, desktop:check/desktop:test/test/test:edge/mobile:check/build/docs:check 7개 명령 exit0. 최종 source의 실제 Chrome 전체 재검사1449/1449 통과(실패/생략/취소0,719481.6411ms). 명령: FEED_BROWSER_MODULE/FEED_BROWSER_EXECUTABLE을 설치 Chrome/Playwright로 지정하고 `node --test --test-concurrency=2 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`.
- 집중 재검사10/10(설정/공통 면), 명시적 초기 모달 종료 후 익명1/1, 기존 대시보드 설정 진입375/1440 2/2 통과. 익명 테스트의 준비 단계는 카메라 안내가 나타난 뒤 Escape→종료를 기다리도록 보정했다. 기존 대시보드 검사는 화면 구성 접근 전에 공부와 화면 분류를 선택한다.
- 독립 shared-reviewer 최종 C0/I0/M0(Ready). 실제 세 mounted 테스트 파일의 분류/편집 진입과 account 경계, 태그/시간대 pending·키보드 초점·Android updater failed/failure 분기까지 확인했다.
- 실제 OS 권한창·사용자 Google 로그인·물리 Android/iOS·스크린리더 전체 수용은 이번 검사와 구분한다. 합성 RPC/브리지 경계 밖의 운영 기록을 쓰지 않았다.

## 출시

최종 검증 통과. 기존 기능 브랜치/production workflow로 공통 웹만 배포하며 운영 결과는 게시 후 갱신한다.
