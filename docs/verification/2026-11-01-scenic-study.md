# 풍경 집중 화면·Windows 미니 창 검증

## 범위와 상태
- 승인: 풍경 우선 집중 화면 및 같은 Windows 창을 줄이는 미니 모드. 원래 다른 작업 트리의 0.1.9 로그인·종료 수정 검토·보존 통합 후 0.1.10 준비 승인. 실제 덮어설치는 별도 확인한다.
- 작업 루트: `C:/jini-dev/worktrees/study-dashboard-clarity`, 시작 HEAD `d47dae1dbf30ff04a53e1e08d2a091f37dd89da5`.
- PRD: [풍경 집중](../../memory-bank/prd-scenic-study.md), [실행 계획](../superpowers/plans/2026-11-01-scenic-study.md).
- 현재 상태: 풍경·미니 구현과 자동 검증 완료, Windows0.1.10 설치본 준비 완료. 웹 운영 배포와 실제 덮어설치·실기기 수용은 대기 중이다. 아래 사전 검사와 최종 기능 수용을 혼동하지 않는다.

## 사전 검사
- 출시 대상 재확인: team `team_LaN4bwvH4msrzoQtIw3fqsUj` / project `prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g` / `study-room-attendance.vercel.app`. 작업 중 운영은 기존 ac3ef7c / dpl_5TvVYovr7xPhNnQZXggS9XD8oJW7 READY/production alias로 유지됨을 MCP로 확인했다. GitHub workflow294915408은 active이며 아직 새 배포를 실행하지 않았다.
- 기존 theme 단위 19/19, 실패·생략·취소0.
- 현재 작업 트리의 기존 native0.1.1 `desktop:test`119/119. 아직 0.1.9 통합/풍경/미니 동작 결과가 아니다.
- 기존 실제 Windows/Android 테마 검증과 설정 복원은 [기기 검증](2026-11-01-theme-device-acceptance.md)에 보존한다. 이번 기능은 실계정 공부·회복·카메라·서버 행을 직접 조작하지 않고 합성 fixture부터 검증한다.

## 이후 기록할 근거
- 0.1.9 통합 파일/원본 보존·회귀 결과.
- 풍경/미니 RED→GREEN 및 실제 Chrome/Electron 합성 흐름.
- 공식7개/Dune·전체 Chrome·독립 검토·최종 diff.
- Windows0.1.10 설치본의 identity/version/패키징 확인(실설치 별도).
- 정확 source SHA의 Actions/Vercel READY/운영 alias/HTTP200/자산 확인.

## 풍경·미니 구현 및 RED→GREEN
- ScenicStudyView/scenicStudy.css·main의 수동 진입/파생 props/기존 콜백, 기존 atmosphere scrim 표시 범위, mode-only desktopBridge/desktopPolicy/desktopRuntime/desktopPresentation만 연결했다. 기존 Dashboard 자식·video node/stream/320x240 layout, 초안과 서버 소유 상태는 유지한다.
- 새 native owner/capability 부재3건 및 scenic entry 부재3건 RED 후 구현했다. inline 확인창 닫기 초점, 전역 px 규칙에 막힌200% header, 자식 설정창 동시 unmount의 body overflow:hidden 누수,13.6px 보조 라벨은 실제 재현 RED→GREEN을 남겼다. 최종 header는 computed32px/200%, 보조14px 이상이다.
- 기존 scene 진입 전 timer 문자열과 이후 문자열을 비교하던 테스트는 정상1초 tick을 실패로 오인했다. 같은 JS task에서 canonical dashboard clock/scenic clock을 읽어 엄격 동일성을 검증하도록 테스트만 바꿨다. 제품 clock을 얼리거나 임의 허용오차를 넣지 않았다. focused4/4·9528ms·exit0.
- 새 진입 버튼47px+flex gap24px가 timerY를71px 밀어 first-screen 회귀를 만들었다. 해당 버튼만 숨긴 단일 변수 측정:375px769.34375→698.34375,1440px736.359375→665.359375. 기존 y<700 검사는 그대로 두고 버튼을 기존 조작부 뒤로 한 줄 이동했다. dashboard2/team Today2/scenic15 집중19/19·실패/생략/취소0·41072ms·exit0(`output/scenic-placement-focused-final.log`).
- mode-only 범위 native단위168/168·14파일check 통과, 실제 새 Electron mini1/1: window/webContents id1/count1·같은 합성 track live·X hide/tray restore·반복 mini·정상/최대화 및 unmaximize 복원·reload cleanup·alwaysOnTop setter 호출 없음. 요청420x560은 scale2에서421x560, normal1284x752은 workarea clamp 후1282x752로 관측되어 통합은 비클라이언트/DPI4DIP 한정오차, pure 단위는 정확 좌표를 검증한다.
- 합성 실제 렌더링6장은 output/scenic-fixture/ 아래 보존하며 ‘합성 테스트 · 예시 데이터’ 표시를 넣었다. 이전 old pin 이미지와 혼동하지 않도록 현재 목록은 scenic-1440-960-1x/2x, scenic-375-700-1x, scenic-375-420-2x, mini-420-520-1x, mini-375-420-2x다. 새 원격 이미지나 실계정 화면이 아니며 좁은 .gitignore 경로로 제외한다.

## 전체 검증 — 최초 실패와 후속을 구분
- 첫 official verify7/Dune0·exit0은 통과했다. 이후 위 한 줄 배치/테스트 동시읽기 수정 뒤 최종 재확인을 진행한다.
- 최초 full Chrome `output/scenic-full-chrome-final.log`:1575중1561통과/14실패/생략·취소0·758371ms·exit1. clock3·first-screen4는 위 원인으로 수정했다. 나머지7은 기존 mobile VM3파일의1000ms ERR_SCRIPT_EXECUTION_TIMEOUT이며 제품 모바일 소스는 변경하지 않았다.
- 같은 mobile3파일을 `node --test --test-concurrency=1 scripts/mobile-focus-status.test.mjs scripts/mobile-recovery.test.mjs scripts/mobile-web-features.test.mjs`로 별도 대조해36/36·실패/생략/취소0·3314ms·exit0. timeout을 늘리거나 검사를 제거하지 않았다. 동시 부하와의 연관을 분리하며 이 결과만으로 전체 검증 완료로 쓰지 않는다.
- 최초 full native `output/scenic-full-native-final.log`:35중33통과/실패0/취소2/생략0·472606ms·exit1. heartbeat oracle parent60000ms와 마지막 false-accepted child가 취소됐다. 같은 baseline의 기존 순차 통과와 구분하고 source/timeout 변경 없이 재실행한다.
- 최종 native→Chrome은 겹치지 않는 순서이며 Chrome 파일 실행도 --test-concurrency=1로 제한했다. native35/35·실패/취소/생략0·412681ms·exit0, Chrome1575/1575·실패/취소/생략0·892921ms·exit0 통과. 기존timeout/assertion은 완화하지 않았다. 로그 scenic-full-native-sequential-final.log / scenic-full-chrome-sequential-final.log. source16개 고정해시를 완료·커밋 전 다시 확인해 차이0이다.
- 최종 official `ai.ps1 verify` 재실행도7개passed/exit0·Dune0위반·exit0(`output/scenic-verify-release.log`). 별도 lint명령은 없다. 제품 커밋43b563e는 검토한16경로만 포함하고 인계/docs/output은 포함하지 않는다. task검토 C0/I0/M0이며 전체 커밋 범위 검토는 별도다.
- Task2 독립 spec/quality 검토는 고정된16파일 worktree patch에서C0/I0/M0 승인. 미통과 검사 상태에서 커밋하지 않는 프로젝트 규칙을 지키면서 선검토했으며, 커밋 전 byte hash 대조와 이후 전체 커밋 범위 검토가 필수다. 작은350x430 논리 작업영역은 pure unit, 실제 Electron은 현재 모니터/DPI 조건의 수용으로 구분한다.
- 빌드 사전 준비: 기존 readonly 원본의 공개 public-config에서 origin/URL/anon키만 기존 prepareDesktop에 전달하여 현재 ignored resources를 운영 공개 설정으로 준비했다. 동일값/정확 production origin 확인, 원본·비밀값·서버 설정 변경/출력 없음. 설치 빌드 때도 같은 공개값만 사용한다.

## Windows0.1.10 설치본 준비
- 기존 `apps/desktop/scripts/run.mjs build`로 NSIS/x64/per-user 설치본 빌드exit0. 공개 설정값은 argv에 넣지 않고 자식 프로세스 환경에만 전달했다. 별도서버/프로바이더/인증설정·의존성 변경·게시·설치 없음. 로그 `output/scenic-desktop-build-0.1.10.log`.
- 설치 파일: `apps/desktop/dist/StudyRoom-Setup-0.1.10-x64.exe`,123059756bytes, SHA256 `21d4b243852c94a8c30c570cbc6f8ca46279542c05bd767cfece09e10d1bd69c`. 패키지@study-room/desktop0.1.10·appId app.studyroom.desktop·executable StudyRoom.exe·product 독서실·고정Electron45.0.0/builder26.18.0 유지. FileVersion0.1.10/ProductVersion0.1.10.0.
- ASAR533entries: main/preload/error 및 모든 native src의13파일을 현재 소스 바이트와 비교해 차이0. 새 presentation와 기존 loopback/diagnostics/status CSS 포함, 소유 test/output/memory-bank/.git/.serena/.env 경로0. public-config는 origin/URL/anon3필드만 있고 기존 운영 공개 설정과 동일하다(값 출력 없음).
- 코드 서명 인증서가 없어 NotSigned다. 서명/보안 설정을 변경하지 않았으며 Windows 경고 가능성을 숨기지 않는다. 기존 package/userData/암호화저장 계약을 유지하지만 실제 무삭제 덮어설치·실계정 로그인/실카메라 수용은 아직 수행하지 않았다.

## 0.1.9 기준선 보존 통합
- 커밋 `d39e06a0fc81adce4c2396a5224d6006f345e33c`, native18파일+root lock의 desktop version1항목만 통합. 원본 `study-room-desktop-current` HEAD305b587+기존 dirty를 읽기 전용으로 비교했다. 가져온18파일은 LF 정규화 시 원본과 동일하다.
- 기존 loopback/PKCE·소유 인증창 정리·인증 후 창 복귀·파기된 webContents 종료 정리를 보존했다. appId/executable/userData/persistent partition 및 암호화 저장·서버 계약 불변. 원본 dirty40파일 SHA256/porcelain 및 현재 web332파일 SHA256 무변경 확인.
- import 전 기존 회귀 검사:74중46통과/28실패(없는 새 module/restoreAfterProvider 및 구 runtime의 destroyed-object 오류). 이것은 기존 수정 보존 증거이며 새 기능 TDD로 계산하지 않는다.
- `desktop:check`13파일 통과. sandbox 단위164중13건 localhost EACCES 후 동일 source 제한 밖 재실행164/164·실패/생략/취소0. Dune17파일/4경계/위반0.
- 최초 Electron34중30통과/4실패: 현재 트리에 ignored resources/icon 부재로 Tray 생성 실패. 기존 prepareDesktop에 합성 공개 설정만 주어 아이콘을 준비하고 source/테스트 변경 없이 재실행했다. 최종34/34·실패/생략/취소0·408210ms·exit0, `output/scenic-native-baseline-integration-prepared.log`.
- 6분 숨김360275ms: 같은 process/webContents/document·합성 영상7213frame·heartbeat361시도/361ACK·오류/대기/timeout0·track live. 물리 카메라/실계정 공부 검증은 아니다.
- Task1 종료 당시 ignored public-config는 합성 시험 설정이었다. 최종 설치본 빌드 전 기존 production 공개 설정으로 교체·동일값 확인 및 패키징 검증을 완료했으며 Git에는 포함하지 않았다. Task1에서 실제 앱/인증 provider/브라우저/Supabase 설정·학습 행은 조작하지 않았다.
- 독립 task 검토: spec/quality 승인·Critical0/Important0/Minor0. 컨트롤러도 단위164/164를 새로 실행하고 원본18파일 LF 동일18/18·현재 tracked web clean을 확인했다. 구현자의 작업 전 도구 변수 스냅샷을 별도 JSON으로 보존한 뒤 baseline/완료 직전 original40+web332해시/porcelain 일치를 직접 대조했고, 현재 원본40개 바이트도 baseline 대비 차이0이다. 이 스냅샷에는 수집 시각이 없고 최종 raw snapshot은 보존되지 않았다는 한계를 명시했다.

## 보존 한계
- 단위/합성 browser/Electron 통과는 실제 Google 계정 로그인·물리 카메라·사용자 서버 기록 전후 digest·GPU/배터리 성능 수용을 대신하지 않는다.
- 기존 학습/회복/출석 정책과 원래 작업 트리 dirty는 변경하지 않는다. 실제 앱 재로드/설치는 별도 미사용 확인 후에만 수행한다.

## 구현 중 실제 API 차단 항목 — Windows 항상 위
- 실제 Electron45 초안 helper 검사에서 mini420x560·동일 window/webContents는 확인했지만 `setAlwaysOnTop(true)` 뒤 `isAlwaysOnTop()`이 false다. 초안에는 실측 mismatch→`WINDOW_PRESENTATION_FAILED` 회귀를 추가했으며, 사용자 보류 승인 후 고정 UI/API/owner 경로와 긍정 수용 테스트 자체를 출시 범위에서 제거했다. 고정 성공으로 계산하지 않는다.
- require_escalated 실행에서 runtime/mini/탐색·resize 전 정상 창의 직접 호출도 false. visible/focused true, max/min false, 다중 DPI2/1.5/1 환경을 기록했다. cross-DPI bounds 이동 제거·명시 floating도 같은 결과다.
- runtime/fixture/Playwright를 모두 뺀 ignored `output/pin-diagnostic.cjs` 최소앱도 같은 결과: 별도 userData·420x560 primary scale1, constructor alwaysOnTop:true→false, setter false→true 직후 및250ms settled 모두 false. 제품 helper나 특정 DPI 이동이 원인이라는 가설과 맞지 않지만 OS/API 내부 원인을 확정하지 않는다.
- [공식 Electron 문서](https://www.electronjs.org/docs/latest/api/browser-window#winsetalwaysontopflag-level-relativelevel)는 Windows setAlwaysOnTop/isAlwaysOnTop 계약을 지원한다. 공개 검색에서 발견된 이전 버전/Wayland 이슈를 이 Windows45 원인으로 단정하지 않았다. 보안/OS/브라우저/레지스트리/의존성 변경·Win32 우회는 하지 않는다.
- 사용자에게 질문한 결과2026-11-02 ‘풍경·미니 먼저, 고정은 보류’를 선택했다. 이번 출시에서는 고정 버튼/요청을 제거하고 native mode-only 브리지로 좁힌다. 고정 성공 검사로 바꾸거나 성공으로 주장하지 않으며 실패 근거는 그대로 보존한다. 새 기능은 항상 위 상태를 변경하지 않는다.
