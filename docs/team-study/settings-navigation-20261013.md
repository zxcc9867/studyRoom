# 개인/팀 진입과 공개 태그 설정 검증

## 승인 범위

- 기본 오늘 화면에서 기존 개인 공부 준비·시작을 즉시 이용한다. 팀 조회나 공개 태그 설정을 개인 시작 조건으로 추가하지 않는다.
- `내 공부 / 팀 공부` 두 진입 탭을 제공한다. 팀 없음→공부방 만들기, 받은 링크/태그 초대→명시적 수락, 팀 있음→친구 초대/공부 연결을 기존 API로 제공한다.
- 공개 태그의 현재 값·편집·저장은 설정의 계정 구역으로 옮긴다. 팀 대시보드에는 편집 폼 없이 필요한 설정 링크만 제공한다.
- 기존 전역5메뉴·초대·개인 인증/회복/카메라/DND/lease/출석 정책을 보존한다. DB/RPC/native/APK 변경 없음.

## 변경 파일

- apps/web/src/main.tsx: 개인/팀 공부 진입 탭과 설정 계정의 공개 태그 컴포넌트 연결.
- apps/web/src/TeamStudySection.tsx: 태그 편집 폼 제거, 정상 팀 없음의 생성/초대 우선 흐름, 기존 개인 제어 콜백 보존.
- apps/web/src/PublicTagSettings.tsx·PublicTagSettings.css: 기존 인증 RPC로 조회·저장하는 접근성·오류·계정 전환 보호 폼.
- apps/web/src/appTheme.css: 기존 토큰을 사용하는 공부 방식 탭 스타일.
- apps/web/test/team-study-mounted.test.mjs: 기존22건 유지·신규5건, .ai/dune/rules.json: 새 컴포넌트에 기존 서버/native 경계 적용.
- memory-bank/active-context.md·progress.md·prd-social-study-room.md·prd-app-settings.md·architecture-map.md·implementation-plan.md·trouble-shooting.md: 승인 범위·구조·검증·인계 정리.

## 검증

- RED: 실제 Chrome 새 요구사항3건이 공부 방식 탭/설정 입력 부재로 실패함을 확인한 뒤 구현했다.
- 신규 실제 mounted Dashboard:375/1440 개인 기본/팀 없음/설정 저장/팀 생성·초대, 입력 검증·저장 실패 초안 유지·조회 실패 재시도·계정 전환 늦은 저장 차단을 추가했다.
- 기존 팀 mounted22건은 개인 공식 시작/재개·카메라 track/node·lease 경고/연장·서버 상태·초대/집중 만료를 그대로 검사한다.
- 대표 새 대비: 태그 label12.3024:1, 설명7.0229:1, 비선택 공부 방식 탭6.3378:1.375/1440에44px 조작과 키보드 초점 확인. 기존200% 확대/가로 넘침 검사 유지.
- Dune 및5명령 전체 게이트 PASS: npm.cmd test, npm.cmd run test:edge, npm.cmd run mobile:check, npm.cmd run build, npm.cmd run docs:check. 별도 린트 명령 없음.
- 독립 shared-reviewer 검토 PASS: Critical/Important/Minor 모두0. 별도 검토의 diff 검사 통과. 실제 계정/기기/배포 검증은 이 판정에 포함하지 않는다.
- 최종 전체 실제 Chrome 회귀1210/1210 PASS·실패0·생략0·218810ms. 팀 mounted27/27(기존22+신규5), 실제 SQL75/75 포함. 초기 늦은 계정 전환 fixture 불일치와 페이지 로드 제한시간 실패 뒤 전체를 재실행했다. fixture의 실제 Auth 소유자를 일치시켰으며 제품 인증 guard는 완화하지 않았다. Chrome은 샌드박스 제한이 없는 실행 환경을 사용했다.

## 근거 경계

브라우저 테스트는 실제 React/Chrome에 외부 Auth/RPC 경계만 안전한 메모리 fixture를 사용한다. 개인/팀 화면 이동에서 실제 video track/node를 유지하는 검증이지 실기기 OEM/실계정 두 사용자 Realtime 검증은 아니다. 팀 없음 screenshot의 `Failed to fetch`는 기존 개인 fixture의 외부 카메라 경고 전송 실패이며 팀 RPC 오류가 아니다. 이 메시지를 숨겨 정상으로 보이게 하지 않았다.

로컬 산출물은 output/team-study/settings-browser-final.log·settings-browser.log·settings-verify-final.log와 settings-public-tag-{375,1440}.png·settings-navigation-teamless-{375,1440}.png에 둔다. 산출물은 Git에 넣지 않는다.

## 출시

- 제품 커밋0165b38469760bce37ffadac734996ce73ec3d10을 feat/team-study-room에 푸시했다. main 직접 커밋·푸시·머지 없음.
- [GitHub Actions38346320013](https://github.com/zxcc9867/studyRoom/actions/runs/38346320013) completed/success. 기존 테스트·mobile:check·docs:check·Edge·build·무료 AI synthetic·배포 단계 모두 성공.
- Vercel study-room-attendance / production: dpl_4n8SfxP7bYeWxxFHkPgSxN1nEbr5 READY. githubCommitSha가 제품 커밋과 동일하며 운영 alias에 연결됨을 MCP로 확인했다.
- [운영 사이트](https://study-room-attendance.vercel.app) HTTP200. 실제 공개 Chrome375/1440에서 초대 로그인 필요·명시적 취소 확인. 새 개인/팀 진입 메인 파일·공개 태그 lazy chunk 존재 및 chunk HTTP200 확인.
- 공개 검사는 실계정 태그 저장이나 팀 변경을 하지 않았다. 앱의 hosted WebView에도 동일 웹이 반영되므로 새 APK·서명·DB·설치 링크 변경 없음. 실제2계정 Realtime/Android16 수용은 별도다.
- 로컬 공개 검사: output/team-study/settings-release-public-check.mjs, production-settings-invite-login-{375,1440}.png. 산출물은 Git에 넣지 않는다. 출시 근거만 문서 후속 커밋에 남긴다.
