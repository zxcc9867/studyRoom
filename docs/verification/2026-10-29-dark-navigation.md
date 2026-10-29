# 공부 전환 위치·공통 다크 모드 — 2026-10-29

## 승인·범위

- 사용자 승인: 전환 위치 통일/중복 링크 제거/전체 공통 화면 다크 테마/기존 학습 기록 유지/검증 후 배포.
- 기존 분류형 설정의 공부와 화면에 시스템·라이트·다크를 추가한다. 기본은 시스템, 전용 기기 저장 키만 사용한다. 저장 실패는 현재 적용을 유지하고 안내한다. 서버/API/계정/공부·카메라/updater 상태는 건드리지 않는다.
- redesign-existing-projects로 기존 토큰·스택·글꼴을 유지한다. ui-ux-pro-max UX catalog의 Contrast Readability/Color Contrast(High)와 Focus Appearance(Medium)를 참고했고 실제 계산 대비/초점/44px/375·1440/200%를 검사한다. 플러그인·라이브러리 추가 없음.
- OS 권한창·외부 제공자 로그인 화면은 OS/제공자 소유다. 숲의 3D 시간대·사용자 꾸미기/기록은 보존한다. native 설치 파일·공개 APK 링크는 이번 공통 웹 출시와 분리한다.

## 재현·검증

- 최초 로컬 Chrome 실행은 네트워크 접근 제한으로 실패했으며 제품 RED 근거로 쓰지 않는다. 허용된 격리 Chrome에서 전환 좌표 이동2/2와 미구현 테마6/6을 재현했다.
- 수정 후 첫 실행은 전환/저장3통과, 내부 글자 대비5실패였다. 흰색 고정/옛 녹색 글자·브라우저 강제 라이트 규칙을 의미 토큰과 명시적 테마로 교체했다.
- 저장소 읽기 실패를 성공으로 표시하던 새 상태를 단위 RED→GREEN으로 수정했다. 표시/저장/시스템 변경/다른 키 무시/구독 해제·초기 paint 11/11 통과.
- 실제 계정 공부/회복/출석 기록을 작성하거나 삭제하지 않는다. 최종 전체 회귀와 운영 배포는 아래 결과로 구분한다.
- 확장 집중14/14 통과: 개인↔팀 좌표, 전체 페이지375/1440×기본/200%, 로그인/회복/시간/알림/목표/회고/탈퇴, 공부방↔팀 숲 좌표·그라데이션 대비를 포함한다. CSS 색상 전환은 완료를 기다리며 전체 정적 대비는 동작 줄이기 모드로 측정한다.
- 독립 shared-reviewer C0/I0/M0 Ready. 팀 탭 RED2→GREEN2, 개인/팀·저장/재로드3/3, 단위11/11을 별도로 실행했다. 초기 발견한 팀 탭 이동·숲 그라데이션 대비·저장 실패 후 재진입 안내를 수정했다. 실제 OS/외부 로그인/물리 기기 수용은 포함하지 않는다.
- 전체 스크린샷에서 공통 하단 세션 유지 안내의 밝은 면을 추가 발견했다. 카드 밖 안내를 검사하는 RED1→GREEN1로 보정했으며 공부 연장/세션 상태는 바꾸지 않았다. 라디오 방향키·초점과 저장 덮어쓰기 실패 후 이전 설정 복원을 추가 검사했다.
- 첫 최종 전체 실행은1475중1469통과/6실패였다. 6건 모두 기존 터치 검사에서 새 라디오의20px 원만 측정한 것으로, 연결된44px 라벨을 측정하고 원 밖5px 위치의 실제 클릭→checked/테마 변경을 검증하도록 보완했다. 관련7/7 재통과, 독립 추가 검토C/I/M0. 이 실패 실행과 중지된 앞선 실행은 전체 완료 근거로 쓰지 않는다.
- 제품 최종 소스의 `ai.ps1 verify --project .`: desktop:check/desktop:test/test/test:edge/mobile:check/build/docs:check 7명령 통과, Dune 위반0 (`output/dark-nav-verify-final.log`). 터치 검사 보완 후 최종 전체 Chrome1475/1475·실패/생략/취소0·426214.7091ms·exit0 (`output/dark-nav-release-verified.log`).
- 전체 명령: `node --test --test-concurrency=2 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`. FEED_BROWSER_MODULE은 로컬 Playwright, FEED_BROWSER_EXECUTABLE은 설치된 Chrome을 지정했다. 테스트는 격리된 합성 데이터만 사용한다.

## 변경 파일·출시

- 공통 화면: apps/web/index.html, src/main.tsx, TeamStudySection.tsx, appearance.mjs, appearance.d.mts, AppearanceSettings.tsx, appTheme.css, dashboardRedesign.css, styles.css.
- 회귀: apps/web/test/appearance.test.mjs, mobileTheme.test.mjs, actualStudyMounted.test.mjs, team-study-mounted.test.mjs. 관련 설정/HIG PRD·architecture-map·progress·trouble-shooting·로컬 active-context를 갱신한다. 기존 native/auth/종료 미커밋 변경과 package-lock은 이번 출시에서 제외한다.
- 제품 `2d55e11e63be5eda96e5e242f6573bdcb6749dd5` commit/push, Actions40852672515 completed/success. Vercel `dpl_zxVX7jwPPj4nr5QxF3PD1TS6xt6v` production/READY·project prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g·동일 source SHA·운영 alias를 확인했다.
- https://study-room-attendance.vercel.app HTML·/assets/index-DI5B6auN.js·/assets/index-Td8-Wuez.css 모두HTTP200. 초기 테마·light dark 선언·전용 저장키·화면 테마·dark token·새 전환/라디오 스타일을 운영 자산에서 확인했다. 배포 직후5분 error/fatal 그룹은 없었으며 장기 장애 없음의 보장은 아니다.
- 웹 새로고침/공부 종료 후 앱 재실행으로 hosted UI를 갱신한다. 새 APK/Windows 설치 파일은 없다. 실제 Android/iOS·OS 권한창과 외부 제공자 화면 전체 수용은 별도다.
