# 함께 집중 시간·공부 종료·목표 공유

## 승인된 동작

- 제한 없음 또는 1~1440분 직접 설정;25/50분 빠른 선택 유지.
- 지정 시간 완료는 공부방/팀 숲 공통 화면 알림만 제공한다. 개인 공부·팀 연결·멤버십은 유지한다. 소유자/제안자는 완료 알림을 닫거나 새 집중을 제안할 수 있다. 기존 개인 lease/출석/회복/카메라 정책 불변.
- 오늘 공부 종료는 기존 회고/개인 종료 경로. 팀과 목표·공동 숲은 남고 다음 날 새 세션을 연결할 수 있다.
- 영구 탈퇴/소유자 해산은 접힌 팀 관리에서 별도 확인한다.
- 별도 짧은 팀 목표와 현재 할 일 제목은 각각 공유 선택. 개인 전체 목표/이력은 자동 노출하지 않는다.

## 구조와 마이그레이션

- UI/controller: TeamStudySection(.tsx/.css), teamStudyClient(.mjs/.d.mts), teamStudyPresentation(.mjs/.d.mts).
- 공식 Supabase CLI2.120.0의 `migration new team_focus_options`로 `20261013081052_team_focus_options.sql` 생성. 과거 배포 migration은 편집하지 않았다.
- 대상: 확인된 Supabase `bqohkdzvxbrokkmuhysx`. rounds.duration_minutes nullable +1~1440 검증, members.goal/share_goal 추가.
- guarded public action에 set_goal 추가, propose_round를 private mutate_focus에 위임. 기존 connect/disconnect/개인 종료·정산 함수는 유지한다. snapshot에 opt-in goal과 완료 round를 제공.
- 원격 적용 전 실제 SQL/RLS·브라우저·타입/빌드·독립 검토. 전체 db push/이력 repair/사용자 데이터 변경 없음.
- DB 확장→웹 순서. 롤백은 이전 웹 복원, 새 goal/round 데이터를 삭제하지 않는 전진형 호환 전략이다. 오래된 웹에서는 새 목표 편집·무제한 표시가 제한되므로 최종 검증된 웹을 재배포한다.

## 검증과 출시 상태

- RED: 신규7개 SQL/controller/helper 검사 및375/1440 폼 검사가 기존 코드에서 기능 부재로 실패.
- 최종 GREEN: 전체 실제 Chrome1220/1220·실패0·생략0·199276ms(팀30/30 포함), SQL/controller/helper45/45.375/1440 시간·목표 흐름, representative contrast7.6968:1 이상/44px. 로컬 서버/외부 공급자는 fixture이며 실계정2개·Android16 검증과 구분한다.
- 최초 전체 게이트: Dune0위반, mobile:check/docs:check 통과. build는 누락된 helper 선언, test/test:edge는 sandbox EACCES/ENOTFOUND로 실패. 선언 보완 및 동일 게이트 허용 환경 재실행 exit0.
- 독립 shared-reviewer는 팀 숲에서 완료 알림 누락(P2)/완료 구간 닫기 부재(P3)를 지적했다. 공통 role=status와 guarded cancel_round 버튼으로 보완, 숲 이동→만료→닫기→개인 세션/팀 유지 Chrome1/1 통과 후 재검토 PASS.
- 운영 적용 전 읽기 전용 감사: 기존 rounds는25/50분 NOT NULL, goal/share_goal 없음, 기존 migration remote20261012235920. public2RPC는 authenticated 실행/anon 거절 및 빈 search_path 유지. 전체 db push/이력 repair 없이 새 추가 migration만 적용한다.
- 최종 ai.ps1 verify PASS: Dune0위반, npm test/test:edge/mobile:check/build/docs:check 모두 exit0. 별도 lint 명령 없음.
- 운영 DB 적용 성공: local20261013081052→remote20261013084053(team_focus_options). nullable duration과1~1440 check,160자 goal/share_goal=false, public RPC authenticated 허용/anon 거절, private mutate_focus 두 역할 모두 실행 불가, opt-in goal projection과 dispatch를 MCP로 확인했다. 개인/팀 사용자 데이터 생성·변경 없음.
- Security advisor는 기존 경고를 유지한다. 팀 private [RLS no-policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)와 guarded public [definer 실행](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)은 직접 권한/인증 감사와 구분한다. ‘all clean’으로 보고하지 않는다.
- 운영 웹 출시 완료: 제품9cffc74fc782b37539e419d285e14dd3e5672e95, [Actions38371768257](https://github.com/zxcc9867/studyRoom/actions/runs/38371768257) success, Vercel dpl_6qvESW5Tjj3io7ZKqH3M4dDhgNuR READY/exactSHA. 기존 production alias https://study-room-attendance.vercel.app 연결·HTTP200. Vercel framework 설정은null이며 기존 Vite 웹 빌드 사용, buildingAt→ready49.641초.
- 운영 공개 실제 Chrome375/1440: 초대 로그인 필요/명시적 취소 확인. TeamStudySection-DY4jysCG.js HTTP200와 시간 제한 없음/직접 설정/오늘 공부 종료/팀 관리/목표 공유/알림 닫기 표시 코드 제공 확인. 인증 후 운영2계정 저장/동기화 수용은 하지 않았고 완료로 보고하지 않는다.
- 새 deployment의2026-10-13T08:51:19Z 이후 error/fatal runtime 로그 그룹 조회는 행이 없었다. 출시 직후 짧은 관찰이며 실제 장시간 이용/모든 RPC 성공 증명은 아니다.
- feature 브랜치 commit/push·기존 workflow_dispatch만 수행. main 직접 수정/머지 없음. native/APK/서명/다운로드 manifest 변경 없음. 기존0.2.4/code7 hosted WebView는 새 웹 로드 시 반영하며 새 APK 설치는 필요 없다.

## 변경 파일

- 화면: apps/web/src/TeamStudySection.tsx, TeamStudySection.css — 집중 설정·공통 완료 알림·일일 종료/팀 관리·목표/현재 공부.
- 안전한 조회와 타입: apps/web/src/teamStudyClient.mjs, teamStudyClient.d.mts — 회원 목표 최소 projection와 자기 목표 편집 허용.
- 표시 helper와 선언: apps/web/src/teamStudyPresentation.mjs, teamStudyPresentation.d.mts — 서버 시각 기준 유한 집중 완료 판정.
- DB: supabase/migrations/20261013081052_team_focus_options.sql — 추가형 nullable duration·목표/공유·guarded dispatch/snapshot.
- 검증: apps/web/test/team-study-client.test.mjs, team-study-presentation.test.mjs, team-study-mounted.test.mjs; packages/core/test/team-study-db.test.mjs, fixtures/team-study-db.mjs — 사생활·시간·숲 탭 알림·일일 종료·다음 날 팀 유지.
- 계약/결정/인계: docs/team-study/server-contract.md, 본 문서; memory-bank/active-context.md, progress.md, prd-social-study-room.md, architecture-map.md, trouble-shooting.md.

## 실행한 완료 게이트

- `& C:/jini-dev/.ai/scripts/ai.ps1 verify --project C:/jini-dev/worktrees/study-room-team`: Dune 및 선언5명령 PASS.
- `node --test --test-concurrency=2 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`: FEED_BROWSER_MODULE/EXECUTABLE에 기존 설치 Playwright/Chrome을 명시,1220/1220.
- `node output/team-study/focus-release-public-check.mjs`: 운영 HTTP200/새 chunk/375·1440 공개 로그인·초대 취소 PASS. 산출물은 Git에 넣지 않았다.
- `git diff --check`, `npm.cmd run docs:check`: 문서 후속 변경 포함 PASS. 실제2계정 Realtime/Android16/동시 PostgreSQL은 별도 미확인.
