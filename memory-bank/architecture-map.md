# Architecture Map

## 적용 상태

- 공용 DUNE 원칙 문서: `C:/jini-dev/docs/dune-architecture.md`. 이 checkout의 기능 지도와 실행 계약은 `docs/dune.md`, `dune.config.json`, `.dune/check.py`를 따른다.
- 현재 변경 범위인 기술 피드 번역의 경계를 아래에 기록했다. 다른 기능의 상세 경계는 관련 PRD와 implementation-plan을 따른다.
- `.ai/dune/rules.json`은 이전 도구의 피드 UI→서버 import 금지 선언이다. 현재 `.dune/check.py`가 읽는 설정은 `dune.config.json`이며, 이전 선언 파일이 현재 검사기에 연결됐다고 간주하지 않는다. 현재 `web-no-mobile-or-server` 경계가 해당 금지를 포함한다. 정적 검사는 제품 테스트·RLS·실기기 검증을 대신하지 않는다.
- 공용 DUNE 파일은 이번 동기화 전에 존재한 별도 미커밋 작업으로 보존했다. GitHub의 이 통합만으로 공용 검사기·설정·CI가 배포되는 것은 아니다. 새 checkout은 공용 루트의 `python agents/apply-dune.py --check --project studyRoom`으로 적용 상태를 확인하고, 검사 파일이 실제 존재할 때 아래 명령을 실행한다.

## 기능과 공식 진입점

| 기능 | 담당 폴더 | 공개 진입점 | 의존할 수 있는 계층 | 관련 PRD |
|---|---|---|---|---|
| 피드 화면 | apps/web/src/TechFeedSection.tsx, FeedDailyBriefing.tsx | techFeed.mjs 인증 클라이언트 | 공개 core helpers, 웹 client | prd-tech-feed.md |
| 피드 본문 표시 | packages/core/src/feedMarkdown.mjs, apps/web/src/feedPresentation.mjs, FeedArticleText.tsx | feedMarkdownPreview / parseFeedMarkdown | 공개 core 표시 helpers | prd-tech-feed.md |
| 피드 API/수집 | supabase/functions/tech-feed, tech-feed-worker | Edge handler / runFeedWorker | _shared 서버 어댑터, service_role RPC | prd-tech-feed.md |
| 무료 번역 | supabase/functions/_shared/tech-feed-translation.mjs, tech-feed-translation-worker.mjs | createDeepLTranslation / runTranslationWorker | 고정 무료 endpoint, store RPC | prd-tech-feed.md, docs/tech-feed/korean-translation.md |
| Android 공통 화면 | apps/mobile/App.tsx | 인증된 hosted WebView | 웹 화면과 동일 서버 API | prd-android-web-parity.md |
| 함께 공부방 화면 | apps/web/src/TeamStudySection.tsx, teamStudyClient.mjs, teamStudyInvite.mjs, teamStudyPresentation.mjs | team_study_snapshot / team_study_action 인증 RPC | 웹 공개 client·표시 helpers·Dashboard 개인 콜백 | prd-social-study-room.md |
| 팀 권한·초대·공동 집중·숲 | supabase/migrations/20261012143354_team_study_room.sql | guarded team_study_action / team_study_snapshot | team private 상태·기존 서버 실제 공부 segment checkpoint | prd-social-study-room.md |

## 영속 상태의 수정 경로

| 상태 | 소유 모듈 또는 서비스 | 공식 수정 API | 호출하는 모듈 | 금지된 우회 |
|---|---|---|---|---|
| 번역 캐시·문자 예산·lease | Supabase translation 테이블 / tech-feed-store.ts | claimTranslations, reserveTranslation, finishTranslation | 서버 번역 worker | 브라우저 직접 쓰기·로컬 예산 초기화 |
| 관심 설정·저장·할 일 연결 | Supabase 소유자 데이터 / tech-feed-store.ts | tech-feed 인증 API와 기존 RPC | techFeed.mjs | 별도 앱 로컬 피드 DB·service_role 노출 |
| 공급자 무료 요금제 선택 | Edge runtime 환경 | DEEPL_API_PLAN=free 또는 명시적 developer | createDeepLTranslation | 임의 숫자 상한·유료 endpoint·월별 lifetime 초기화 |
| 팀·멤버십·태그·초대·round·연결 | Supabase team private 경계 | team_study_action | 팀 전용 web client | 직접 테이블 쓰기·타 계정 세션 시작/종료·전체 개인 조회 |
| 팀 공부/휴식 표시 | 기존 study_sessions와 actual tracking | team_study_snapshot의 멤버 제한 projection | 팀 전용 화면 | 웹 로컬 타이머를 인정시간으로 저장·연결 손실을 자리비움으로 추정 |
| 공동 숲 확정 기여 | 서버 종료/정산된 study_todo_segments + 팀 연결 경계 | member-only snapshot aggregate | 팀 숲 한 곳 | 활성 잠정 시간으로 성장 확정·과거/중복 시간 합산 |

팀 연결 경계의 checkpoint는 세션→actual tracking 순서로 잠그고 기존 close_segment를 통해 구간을 분리하는 공식 서버 경로를 사용한다. 개인 시작/재개/휴식/종료·카메라/회복 검증은 DashboardApp의 기존 액션이 소유한다. 팀 모듈은 이 상태를 직접 수정하지 않는다. 운영 DB version20261012235920 권한/RLS/RPC/publication 및 제품b9ab3ec 웹 feature-ref 배포 완료. 실계정/기기 수용은 docs/team-study/verification-20261013.md의 미확인 범위를 따른다.

같은 상태를 여러 곳에서 직접 수정하지 않는다. 파일 claim은 편집 충돌을 줄이는 수단이며 실행 중 상태의 단일 수정 경로를 보장하지는 않는다.

## 검증 명령

- 타입/테스트/빌드: npm.cmd test, npm.cmd run test:edge, npm.cmd run mobile:check, npm.cmd run build, npm.cmd run docs:check. 별도 린트 스크립트는 없다.
- 새 팀 기능의 정적 경계/반복 검증 원본은 추적된 .ai/dune/rules.json이다. `ai.ps1 verify --project <root>`가 팀 UI→서버/네이티브 직접 import 금지와 위5명령을 실행한다. SQL/RLS는 PGlite와 원격 MCP 확인, 실제 UI는 Chrome 선택 런타임을 활성화한 전체 목록(concurrency2)으로 별도 검증한다. 기존2파일 검사 결과만으로 새 팀 경계를 통과했다고 표시하지 않는다.
- 의존성 경계: `python .dune/check.py --root .`. 공통 완료 게이트: `python .dune/check.py --root . --verify` (검사기와 설정이 있는 checkout에서 실행).
- 실제 플로우: 로그인 → 기술 피드 → 한국어 제목/소개·접힌 원문·원문 링크 → 저장/공부할 일 연결. 사용자의 공부 탭은 조작하지 않는다. 기존 sessionExit는 pagehide/beforeunload/visibilitychange 종료 요청을 막으며 production 함수와 관련 회귀4/4로 확인했다. 추가 검증 탭을 닫는 것을 서버 세션 종료로 추정하지 않는다.
- CI: 기존 vercel-production.yml이 Node/Edge/mobile/docs/build를 실행한다. 로컬의 별도 `.github/workflows/dune.yml`은 미커밋 상태이며, 이번 통합에서 원격 실행이나 필수 상태 검사 연결을 완료로 기록하지 않는다.

## 예외와 아키텍처 변경

| 날짜 | 대상 규칙 | 변경 이유와 관련 요구사항 | 적용 범위 | 대체 검증 |
|---|---|---|---|---|
| 2026-10-10 | 무료 번역 상한 | 검증된 무료 Developer 100만 자 lifetime 지원 승인 | 서버의 명시적 developer 선택만 | provider/worker 회귀·실제 usage/번역 저장 확인 |

검사 통과만을 목적으로 예외를 추가하지 않는다. 프로젝트 경계를 바꿀 때 PRD와 implementation-plan을 함께 검토한다.
