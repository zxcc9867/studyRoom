# 공부 시작과 풍경 화면 진입 통합 — 2026-11-02

## 승인과 범위
- 사용자는 별도 ‘풍경으로 집중’ 버튼 제거, ‘오늘 목표 이어가기’의 공부 시작 성공 후 풍경 자동 진입, 실행 중 같은 위치의 ‘공부 화면 열기’ 재진입을 구현·검증·배포하도록 명시 승인했다.
- 기준 HEAD3d0ddc8, fix/study-dashboard-clarity. 제품 변경은 main.tsx의 표시 상태/진입 버튼과 atmosphere.css의 풍경 canvas fallback에 한정한다. 서버/DB/API/native/Auth·출석/회복/시간/카메라 판정·기존 저장 정책과 학습 mutation 입력은 변경하지 않는다.
- 실제 사용자 앱·계정·카메라·학습 기록은 이번 변경 검증에서 조작하지 않는다. 이전 테마 재실행 조사의 실제 시험/원복과 미확정 원인은 별도 진단 문서에 남긴다.

## 구현
- 주 버튼의 기존 준비 경로를 재사용하고, 로컬 runActualAction의 실제 start/resume 성공 뒤에만 표시 전용 풍경을 연다. 준비/확인 중, 취소, 실패, 불확실 결과 대기에는 열지 않는다.
- 주 버튼 클릭 시 표시 의도(사용자·화면 revision)를 만든다. 카메라/할 일/회복/일정 확인을 거쳐도 동일 의도만 인정한다. 경로 이탈/왕복·계정 전환·각 준비창 취소·확정 전 hard error에서 폐기하며, 불확실 결과의 같은 요청 재확인은 유지한다.
- 실행 중 주 버튼은 공부 화면 열기이며 새 학습/카메라 요청 없이 같은 세션을 보여준다. 대시보드의 기존 휴식/종료와 풍경의 기존 pause/resume/end 콜백, 햄버거 경로·기기별 배경/라이브 소유자는 그대로다.
- 서버 snapshot 복원·다른 기기 세션·재로그인만으로 자동 진입하지 않는다. 다른 화면에서 뒤늦게 끝난 요청이나 화면 왕복 후 옛 의도로 잠복 진입하지 않는다.

## 재현과 검증
- 최초 제한 환경의 Chrome localhost 접속은 ERR_NETWORK_ACCESS_DENIED였다. 같은 명령의 승인된 제한 밖 실행과 구분하며 기능 RED로 세지 않는다.
- 신규 기능 RED4:375/1440 시작 성공 후 풍경 미표시, 실행 중 primary 재진입 부재, 불확실 요청 재확인 성공 후 미표시. 기존 late navigation 음성 검사는 실제 DOM 선택자를 교정해1/1 기준 통과했다. 초기 선택자 오류는 기능 결함으로 세지 않는다.
- route 왕복·계정 전환 RED2, 독립 검토 I1의 카메라 준비 지연 중 왕복 RED1, 회복 취소 뒤 별도 알림 시작에서 표시 의도를 빌리는 RED1을 각각 확인하고 보완했다. 회복 재현 중 모달 교체/할 일 명시 선택을 빠뜨린 fixture 실패는 별도이며 최종 RED는 실제1/기대0이다.
- 초기 scenic32/32와 기존 공부/동기화 회귀43개 중34통과/9실패를 확인했다. 후자의9개는 새 풍경이 열린 뒤 숨겨진 메인 화면을 바로 찾거나 primary를 pause로 가정하던 테스트다. 기존 햄버거로 메인에 돌아오는 실제 UI 경로와 명시적 pause 대상을 사용해43/43 통과했으며 기존 RPC/기록 검증은 유지했다.
- 독립 소스 검토: 최초C0/I1/M0→카메라 준비 의도 보완→C0/I0/M1→회복 취소/hard error 정리 후C0/I0/M0. 검토자는 diff 검사·소스를 읽었으며 이 단계에서 Chrome은 별도로 실행하지 않았다.
- 집중34/34와 기존 공부/동기화43/43은 통과했다. 공식 첫 실행은 Dune0·6명령 통과, npm test의 기존 extracted-handler fixture2개가 새 표시 ref 미제공으로 실패했다. fixture에 표시 ref와 callback만 제공하고 기존 계정/요청 assertions를 유지해 직접2/2 통과했다.
- 실제 screenshot pixel에서 라이트+차콜 풍경이244/246/243으로 칠해지는 RED를 확인했다. root canvas의 기존 밝은 배경이 body의 차콜을 덮은 원인이다. scenic-active에만 root background/이미지 fallback을17/19/24로 한정하고 종료 시 원래 appearance로 돌아가게 했다. 저장값은 바꾸지 않는다.
- 추가 소스 검토C/I/M0이며 Chrome은 별도로 실행하지 않았다. 새35회귀 첫 실행에서34통과/1실패는 초기 자동 회복창이 뜨기 전에 count로 닫기 여부를 판단한 시험 타이밍이었다. 기존 회복창을 명시적으로 기다리고 Escape/닫힘을 확인하도록 보완했다. 재실행35/35·실패/생략/취소0·81615.4557ms·exit0(`output/scenic-start-focused-release-stable.log`). 마지막 fixture/문서 재검토도C/I/M0이다.
- 합성 스크린샷은 output/scenic-fixture/scenic-start-375.png와 scenic-start-1440.png에 ‘합성 테스트 · 예시 데이터’를 표시한다. 실제 계정/설치 기기 수용이 아니다.
- 최종 공식 게이트는7/7·각exit0, Dune 위반0이다. `ai.ps1 verify --project C:/jini-dev/worktrees/study-dashboard-clarity`, `output/scenic-start-official-release.log`. 명령은 desktop:check/desktop:test/test/test:edge/mobile:check/build/docs:check다.
- 최종 실제 Chrome 전체1603/1603·실패/생략/취소0·970897.2998ms·exit0. `node --test --test-concurrency=1 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`, 기존 FEED_BROWSER_MODULE/FEED_BROWSER_EXECUTABLE. `output/scenic-start-full-chrome-release.log`. 기본 npm test의 미설정 브라우저 범위도 보완했다. 집중35·메인43·격리2는 전체1603에 중복 합산하지 않는다.

## 출시 대기
- 최종 전체 검증과 독립 검토가 통과한 소스만 기능 브랜치에 커밋·푸시하고 기존 production workflow로 배포한다. 정확SHA·READY·운영alias·HTML/새JS/CSS HTTP 확인 뒤 출시 완료로 기록한다.
- hosted UI 변경이므로 새 APK/EXE가 필요하지 않다. 실제 앱 재시작/공부·물리 카메라 수용과 서버 전체 행 digest 검증은 별도다.
