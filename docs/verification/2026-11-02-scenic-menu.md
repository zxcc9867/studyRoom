# 풍경 메뉴·라이브 조작·설정창 통일 검증

## 범위와 보존
- 기준 HEAD `e7fd6fa8ddfe963f2245ad097158a68261194c39`, `fix/study-dashboard-clarity`.
- 사용자 승인: 기존 복귀 버튼을 hover/focus/touch 햄버거로 교체하고 기존 메뉴로 이동, 라이브 상태/직접 조작, 사진의 예전 설정 UI 통일.
- `ScenicStudyView.tsx`, `scenicStudy.css`, `DashboardNavigation.tsx`, `main.tsx`와 mounted 회귀만 변경한다. native/DB/Auth/학습 정책과 실제 계정·설치앱·카메라를 조작하지 않는다. 기존 테마검증2문서/.serena/output 미커밋 변경은 제외한다.
- 기존 `AtmosphereSettings`의 독립 초안/적용·취소와 `atmosphere` 저장/OS·비활성 정지 계약을 재사용한다. 새 영상/서버/의존성/설치본 없음. 라이브 지원은 별빛 바다/비 오는 서재 2종이다.

## 재현과 수정
- RED6: 햄버거/직접 라이브 없음, 설정의 변경 버튼 `rgb(191,151,54) 0px 5px 0px` 그림자. `output/scenic-menu-red.log`.
- 첫 GREEN6 뒤 스크린샷에서 모달 뒤 도크가 앞에 그려짐을 발견했다. inert/DOM 클릭 검사만으로 paint 오류를 검출하지 못함을 확인하고 backdrop>scene 실제 computed layer 검사 RED1로 재현했다. `output/scenic-menu-layer-red.log`.
- 공통 토큰 버튼/요약·편집/헤더 닫기, scoped scene80/modal90과 중립 스크림을 적용했다. 메뉴 선택 즉시 닫아 미니 복원 오류 후 확대를 가리지 않는다.
- 기존 Escape 검사1건은 Tab이 새 메뉴로 순환한 뒤 메뉴 닫기→풍경 닫기의 승인된 두 단계 동작으로 보강했다. 타이머/기존 assert/timeout은 완화하지 않았다.
- 독립 검토에서 hover로 열고 키보드 초점을 옮기지 않은 메뉴의 Esc가 풍경까지 닫는 문제를 발견했다. 실제 scene0/기대1 RED로 재현 후 문서 키보드 handler가 최신 메뉴 상태부터 처리하도록 수정했다. 미니에서 실제 라이브 정지 사유가 숨겨지는 누락도 RED2로 확인해 배경 이름만 숨기도록 교정했다.
- 첫 전체 Chrome 실행은 검토 수정 전에 중단했으며 완료 결과로 계산하지 않는다. `output/scenic-menu-full-chrome-interrupted.log`, `scenic-menu-hover-escape-red.log`, `scenic-menu-mini-status-red.log`를 보존한다.

## 검증 상태
- 최종 실제 Chrome 전체1583/1583, 실패/생략/취소0·850388ms·exit0. `node --test --test-concurrency=1 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`, FEED_BROWSER_MODULE/FEED_BROWSER_EXECUTABLE은 기존 Playwright와 로컬 Chrome을 지정했다. `output/scenic-menu-full-chrome-final.log`.
- 집중23/23 및 검토수정3/3은 중복 합산하지 않는다. 모바일 touch, hover/focus, 모든 기존 destination href, 바깥 클릭/Escape, 같은 학습 데이터·카메라 트랙/추가 요청 없음·다시 부착, 기존 시작/휴식/재개/모달/미니 복원 실패를 포함한다.
- 설정375/1440·100/200%·라이트/다크에서 실제 스타일/명도대비4.5·14px·44px·가로 넘침·클릭 위치·paint 순서, 실제 라이브/정지/OS 정지와 초안 취소를 검사한다.
- `ai.ps1 verify --project <root>` 최종7명령(`desktop:check`, `desktop:test`, `test`, `test:edge`, `mobile:check`, `build`, `docs:check`) 모두exit0/Dune위반0. 공식 test의 브라우저 환경 미설정 범위는 별도 전체 실제 Chrome 검사로 보완했다. `output/scenic-menu-official-verify.log`.
- 독립 shared-reviewer 최초C0/I1/M1→위 두 수정과 직접 Chrome3/3 재검토 후C0/I0/M0. 제품/테스트5파일의 검증 전후 SHA256차이0·`git diff --check` 통과. 운영배포는 아직 대기다.
- 합성 화면은 `output/scenic-fixture/scenic-settings-menu-*.png`, `scenic-menu-1440.png`, `scenic-menu-375-touch.png`에 ‘합성 테스트 · 예시 데이터’를 표시한다. 실제 설치앱/Android 에뮬레이터·물리 카메라·서버 전체 digest 검증이 아니다.

## 출시
- 프로젝트 규칙에 따라 검증 후 기존 Actions production workflow로 배포한다. 정확 SHA/READY/운영alias/HTML·새 JS/CSS200 확인 전에는 완료로 표시하지 않는다.
