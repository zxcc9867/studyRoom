# 관심 내용 기반 기술 피드 배포 — 2026-09-13 JST

## 승인 및 범위

- 사용자 `배포해줘` 요청에 따라 검토 완료된 웹 검색 피드의 DB → 서버 → 웹 배포를 진행한다.
- 기존 출석·타이머·알림·숲은 변경하지 않는다. 수집 활성화, 결제 설정, JWT 해제는 포함하지 않는다.

## DB / 서버 적용 완료

- Supabase `next-js` (`bqohkdzvxbrokkmuhysx`)에 추가형 `20260912150427_tech_feed_web_search.sql` 적용 성공. UTC 버전 번호이며 현지 작업일은 9월13일이다.
- CLI dry-run은 과거 원격 마이그레이션의 로컬 파일 누락으로 중단됐다. 과거 이력 repair/reset 없이 MCP로 이번 SQL만 적용했다. 로컬 최초 번호 `20260912122630`을 실제 원격 번호로 변경했으며 SQL 본문은 동일하다.
- 새 테이블5개 RLS 활성, anon SELECT 불가. 개인 연결2개만 authenticated SELECT + 소유자 정책; 내부3개는 클라이언트 권한 없음. 피드 RPC23개 모두 anon/authenticated 직접 실행 불가.
- 보안 advisor의 기존 WARN은 변함없다. 내부 서버 전용3개 테이블의 policy 없음 INFO는 의도한 deny-by-default 구조이다. [RLS advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- `tech-feed`, `tech-feed-worker` v4 ACTIVE, `verify_jwt=true` 유지.
- `TECH_FEED_ACCESS_MODE=self_service`, `TECH_FEED_ENABLED=false`, `TECH_FEED_SEARCH_MONTHLY_CAP=900` 적용.
- 출석 Cron active, 피드 Cron inactive, 커리어 Cron2개 inactive 유지.
- Tavily/무료 AI/전용 worker secret은 미등록 상태. 키나 사용자 데이터를 문서·Git에 저장하지 않았다.

## 배포 전 재검증

- Node533/533, Edge10진입점 타입·8/8, 웹 TypeScript/Vite 빌드, 모바일 호환성/타입, README24이미지 참조 통과.
- 기존 Deno punycode deprecation 경고는 비차단이며 숨기지 않았다.
- 실제 로그인 사용자/기기 동기화/외부 검색/예약2회 검증은 별도다. 이전 합성 PC/390px 검증은 운영 수집 증거가 아니다.

## 웹 배포

- main 푸시 및 GitHub Actions/Vercel 결과 확인 진행 중. 완료 결과는 아래에 추가한다.

## 가동 전 남은 조건

- 앱 전용 무료 Tavily 키 및 종량제 비활성 검증, 승인된 RSS 소스, collector 인증 구성과 실제 예약 실행 검증.
- 일반 사용자는 웹에서 관심 내용을 설정한다. 개인 API 키나 SNS 연결을 요구하지 않는다.
- 수집 중지 상태를 RSS/API가 가동 중인 것으로 설명하지 않는다. 코드 배포와 실제 소식 수집은 구분한다.
