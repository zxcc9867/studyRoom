# Architecture Map

## 적용 상태

- Dune 원칙 문서: `C:/jini-dev/.ai/dune/README.md`.
- 현재 변경 범위인 기술 피드 번역의 경계를 아래에 기록했다. 다른 기능의 상세 경계는 관련 PRD와 implementation-plan을 따른다.
- `.ai/dune/rules.json`은 피드 UI의 서버 모듈 직접 import를 금지한다. 이 정적 검사는 제품 테스트·RLS·실기기 검증을 대신하지 않는다.

## 기능과 공식 진입점

| 기능 | 담당 폴더 | 공개 진입점 | 의존할 수 있는 계층 | 관련 PRD |
|---|---|---|---|---|
| 피드 화면 | apps/web/src/TechFeedSection.tsx, FeedDailyBriefing.tsx | techFeed.mjs 인증 클라이언트 | 공개 core helpers, 웹 client | prd-tech-feed.md |
| 피드 API/수집 | supabase/functions/tech-feed, tech-feed-worker | Edge handler / runFeedWorker | _shared 서버 어댑터, service_role RPC | prd-tech-feed.md |
| 무료 번역 | supabase/functions/_shared/tech-feed-translation.mjs, tech-feed-translation-worker.mjs | createDeepLTranslation / runTranslationWorker | 고정 무료 endpoint, store RPC | prd-tech-feed.md, docs/tech-feed/korean-translation.md |
| Android 공통 화면 | apps/mobile/App.tsx | 인증된 hosted WebView | 웹 화면과 동일 서버 API | prd-android-web-parity.md |

## 영속 상태의 수정 경로

| 상태 | 소유 모듈 또는 서비스 | 공식 수정 API | 호출하는 모듈 | 금지된 우회 |
|---|---|---|---|---|
| 번역 캐시·문자 예산·lease | Supabase translation 테이블 / tech-feed-store.ts | claimTranslations, reserveTranslation, finishTranslation | 서버 번역 worker | 브라우저 직접 쓰기·로컬 예산 초기화 |
| 관심 설정·저장·할 일 연결 | Supabase 소유자 데이터 / tech-feed-store.ts | tech-feed 인증 API와 기존 RPC | techFeed.mjs | 별도 앱 로컬 피드 DB·service_role 노출 |
| 공급자 무료 요금제 선택 | Edge runtime 환경 | DEEPL_API_PLAN=free 또는 명시적 developer | createDeepLTranslation | 임의 숫자 상한·유료 endpoint·월별 lifetime 초기화 |

같은 상태를 여러 곳에서 직접 수정하지 않는다. 파일 claim은 편집 충돌을 줄이는 수단이며 실행 중 상태의 단일 수정 경로를 보장하지는 않는다.

## 검증 명령

- 타입/테스트/빌드: npm.cmd test, npm.cmd run test:edge, npm.cmd run mobile:check, npm.cmd run build, npm.cmd run docs:check. 별도 린트 스크립트는 없다.
- 의존성 경계: ai.ps1 dune check --project <actual-checkout>.
- 실제 플로우: 로그인 → 기술 피드 → 한국어 제목/소개·접힌 원문·원문 링크 → 저장/공부할 일 연결. 실제 세션 진행 중 새 탭 unload가 세션을 종료할 수 있으므로 사용자의 공부 탭을 새로고침/닫지 않는다.
- CI: 기존 vercel-production.yml이 Node/Edge/mobile/docs/build를 실행한다. Dune은 로컬 검사이며 CI를 새로 연결하지 않았다.

## 예외와 아키텍처 변경

| 날짜 | 대상 규칙 | 변경 이유와 관련 요구사항 | 적용 범위 | 대체 검증 |
|---|---|---|---|---|
| 2026-10-10 | 무료 번역 상한 | 검증된 무료 Developer 100만 자 lifetime 지원 승인 | 서버의 명시적 developer 선택만 | provider/worker 회귀·실제 usage/번역 저장 확인 |

검사 통과만을 목적으로 예외를 추가하지 않는다. 프로젝트 경계를 바꿀 때 PRD와 implementation-plan을 함께 검토한다.
