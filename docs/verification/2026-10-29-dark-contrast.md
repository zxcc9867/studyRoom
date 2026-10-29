# 다크 모드 내부 대비 검증 — 2026-10-29

## 범위·보존
- 요청: Windows 앱의 공부 시작 전 선택창에서 안 보이는 글자를 재현하고 전체 다크 UI를 점검한다.
- 시작점: 실제 운영 dpl_J2pc51wrLCiXBAbnf52xFczcakdV/source42098dc, 최신 작업 bc858e3. 제품7dd5a14의 계획표/숲/내 페이지/한국어 피드 변경을 보존한다. 원래 study-room-desktop-current의 native/auth/lock 미커밋 변경은 이번 출시에서 제외한다.
- redesign-existing-projects와 systematic-debugging/TDD/E2E를 사용한다. 기존 글꼴·팔레트·스택을 유지하며 DB/Auth/API·공부/카메라 정책·실제 사용자 데이터·APK/Windows 설치파일은 변경하지 않는다.
- architecture-map의 공통 표시/기기 테마 경계 안에서 CSS만 수정한다. 새 상태 소유권·브리지·서버 경계는 추가하지 않는다.

## 재현·수정
- 실제 main/CSS의 공부 시작 선택창 RED4: 보조 설명2.129:1, 안쪽 라이트 카드와 다크 제목 충돌. sessionTodoModal.css private --color-*와 only light를 공통 --study-*로 연결한다.
- 확장 검사 RED2: 현재 공부 상태1.20·일정1.59·목표 개수1.61·피드 안내2.27~3.09, 펼친 계정 strong1.07 등. --actual-*와 compact/strong/span의 고정 색을 의미 토큰으로 연결했다.
- 피드 설정에서 잘못된 관심 내용의 검증 안내도 고정 어두운 빨강으로 RED2였다. 같은 실제 입력으로 재검증하며 공통 danger 토큰 한 줄로 교정해 GREEN2. 저장 버튼이 비활성이며 실제 저장 요청은 하지 않는다.
- 장식 orb의 문자는 내부 aria-hidden이며 이름은 별도 b에 있다. 부모 wrapper에 포함된 장식을 중복 문자로 세지 않도록 직접 text node+aria-hidden 경계를 검사한다. 원본 꾸미기/3D 색은 변경하지 않는다.
- 첫 최종 일괄1507건 중1505통과/2실패: 라이트 모드 actual-study 보조 설명의 기존7:1 계약에서 공통 muted가6.46이었다. 기준을 낮추지 않고 --actual-* 별칭을 다크에서만 적용해 라이트의 기존 팔레트를 보존한다. 이 실패 실행은 완료 근거가 아니다.
- 스크린샷은 ignored output/playwright/dark-start-picker-*.png. 테스트 입력은 [테스트] 다크 모드 가독성, 실제 사용자 공부·회복·출석은 작성하거나 삭제하지 않는다.

## 검증·출시
- 집중: picker 빈/선택375/1440×1/2x8개, 전체 탭의 펼친 보조 영역2/2, 다중 집중/radio·저장 중·오류2/2, 피드 입력 검증2/2. Windows native bridge 모의 경로+실제 main/CSS1/1. 마지막 경로는 설치된 실제 앱/Google 로그인 수용이 아니다.
- 독립 shared-reviewer: 기존 라이트 회귀4/4·node --check·diff --check, desktop 추가분까지 C/I/M0. 첫 sandbox loopback 차단은 제품 실패로 세지 않으며 허용된 같은 명령 실행에서 통과했다. desktop 대비는 불투명 공통 배경과 실제 RGB 휘도비를 직접 계산한다.
- 전체 런타임: FEED_BROWSER_MODULE=C:/jini-dev/project/study-notes/node_modules/playwright/index.mjs, FEED_BROWSER_EXECUTABLE=C:/Program Files/Google/Chrome/Application/chrome.exe. 모든 packages/core/test·apps/web/test·server/ai·scripts·supabase/functions/_shared의 *.test.mjs를 실행한다. 보완 전 full.log는 중지, full-final.log는 위 라이트2실패이며 완료 근거가 아니다.
- 최종본은 actualStudyMounted를 이름 앞부분별A/B/C의 양수 목록으로 분할하고 other는 같은 전체 파일 목록에서 actualStudyMounted만 제외한다. C의 초기 부정패턴이 중복 실행을 포함하여 중지했고, 최종은 C 양수목록만 사용한다. 최종 로그 dark-contrast-shard-a/b/c-positive/other.log의 총합과 실패·생략·중복을 대조한다.
- 최종 결과: A70/70(400611ms), B71/71(377596ms), C48/48(187409ms), other1318/1318(277016ms), 모두exit0. 전체1507/1507·실패/생략/취소0, actualStudy189개 이름 중복0. 라이트의 기존7:1 검사2건도 동일 assert로 통과했다.
- 재현 명령: A는 `^(?:dashboard clarity:|dark contrast:|stable study navigation:|appearance:|dark appearance:|session todo time edit:|session todo time recovery:|app settings:|app theme:)`, B는 `^(?:dashboard redesign:|camera return:|settings redesign:|full UI audit:|continuation advice:|section recovery:|device sync:|device install:)`, C는 `^(?:attendance and study goal remain separate|HIG layout keeps|HIG login canvas|design completeness:|mounted actual study panel:|mounted main:|mounted session plan:|zero-change review:)`를 `node --test --test-name-pattern=<pattern> apps/web/test/actualStudyMounted.test.mjs`에 적용한다. other는 위 전체 globs의 파일에서 actualStudyMounted만 제외, `node --test --test-concurrency=2 <files>`로 실행한다.
- 공식 첫 실행은 Dune0, desktop:check/mobile:check/build/docs:check 통과. desktop:test의 샌드박스 임시 파일 rename EPERM, test의127.0.0.1 EACCES, test:edge의 레지스트리 ENOTFOUND로 실패했다(output/dark-contrast-verify.log). 같은 `ai.ps1 verify --project .` 정상권한 재실행과 마지막 피드 오류색까지 포함한 최종 소스 모두7명령/Dune0통과(output/dark-contrast-verify-final.log, dark-contrast-verify-release.log/exit0). 첫 실패와 중지 실행은 통과로 세지 않는다. 커밋/푸시/배포는 전체 Chrome까지 최종 통과 후 수행한다.
- 다크 한정 selector 최종본의 verify-sharded-final.log는6명령통과/1실패: 병렬 실행 중 기존 mobile-focus-status의 VM1초 제한(ERR_SCRIPT_EXECUTION_TIMEOUT). 제품/테스트 제한은 변경하지 않으며 병렬 검사가 끝난 뒤 동일 전체 게이트를 순차 재확인한다.
- 최종 수용: 같은 소스/제한 그대로 순차 `ai.ps1 verify --project .`7명령 통과·Dune0·exit0(output/dark-contrast-verify-acceptance.log). VM1초 제한을 늘리거나 실패 테스트를 생략하지 않았다.

## 변경 파일
- 제품: apps/web/src/appTheme.css33줄. 기존 의미 색의 연결만 보완한다.
- 회귀: apps/web/test/actualStudyMounted.test.mjs, desktopMounted.test.mjs. 서버·감지기는 테스트 경계만 모의화하고 실제 main/CSS/상태 UI를 실행한다.
- 확인: memory-bank/prd-hig-ui.md·architecture-map.md·trouble-shooting.md. 갱신: HIG PRD·active-context·progress·trouble-shooting 및 본 검증 문서. 기존 운영 배포 경로만 사용한다.

## 운영 출시
- 제품68ce558a4a4d03d527e85aacab32de099940783d commit/push, 기존 workflow Actions40875906255 completed/success. 배포 CI의 test/mobile/docs/Edge/build 및 기존 합성 무료 AI 확인도 통과했다.
- Vercel dpl_4Vch7TxQAaGVydkuvJpxiyoQUzbe production/READY·정확 source SHA·prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g·study-room-attendance.vercel.app 운영 alias 확인.
- https://study-room-attendance.vercel.app HTML·/assets/index-t4IpUVLS.js·/assets/index-DGwJC61_.css 모두HTTP200. 모달 토큰·다크 한정actual토큰·피드 오류색·계정strong과 기존 계획표/요약 스타일을 확인했다. CSS custom property는 압축 시 공백이 보존되므로 공백 허용 정규식으로 대조한다.
- 배포 직후5분 error/fatal 집계 그룹은 없었다. 이는 장기 오류 없음의 보장은 아니다. 새 APK/Windows 설치파일 없이 hosted UI만 배포했다.
- 사용 중인 앱을 강제 종료/새로고침하거나 실제 사용자 공부를 시작·종료하지 않았다. 공부 종료 후 트레이에서 앱을 완전히 종료하고 재실행하면 새 화면을 불러온다. X 숨김은 같은 문서를 유지한다. 설치 앱/물리 기기 전체 수용은 별도다.
