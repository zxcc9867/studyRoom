## 공개 웹 검색과 셀프서비스 — 승인된 추가 요구사항

- 웹에서 관심 내용 3~300자를 입력하여 수신 시작·수정·중지를 한다. 일반 사용자에게 SNS 연동이나 검색 API 키를 요구하지 않는다.
- 검색 제공자가 색인한 공개 웹 결과를 RSS/Atom/Hacker News와 함께 제공한다. 비공개 글·유료벽 우회·완전한 웹 크롤링은 지원하지 않는다.
- 정규화 후 동일한 전체 검색문은 사용자 수와 관계없이 한 시간 동안 캐시를 공유한다. 의미만 유사한 문장까지 자동으로 합친다고 보장하지 않는다.
- 입력한 관심 내용은 검색 제공자에 전달됨을 알린다. 사용자 ID·이메일은 전송하지 않으며, 민감한 정보 입력을 금지하고 URL·이메일·인증정보 형태를 검증한다.
- Tavily 기본 검색만 사용한다. 실제 요청 전 무료 계정/키의 남은 한도와 종량제 비활성화를 확인할 수 없으면 검색하지 않는다.
- 앱 전체 공용 월간 검색 시도 한도는 기본 900회, 상한 900회다. DB 잠금과 원자적 예약으로 동시 호출을 제어하며 실패한 호출도 계산한다. 검색량이 많으면 한 달 내내 매시간 수집을 보장할 수 없다.
- 검색 한도 소진·검색 장애는 웹 검색만 멈춘다. 승인된 활성 RSS/API는 독립적으로 유지하고, 전체 수집 중지나 미승인 소스를 정상 가동으로 표시하지 않는다.
- 유료 과금·고급 검색·유료 AI·다른 제공자로 자동 전환하지 않는다. 충분한 실제 검색 소개만 AI에 전달하고 부족하면 소개와 원문 링크만 제공한다.
- 검색 소개/AI 요약/원문 발췌의 출처를 구분한다. 검색에 나온 사이트를 자동으로 RSS 승인하지 않는다.
- 관심 내용·수신 상태·구독·저장·할 일 연결은 소유자별로 동기화한다. 수정 시 버전 충돌을 확인하고 다른 계정의 늦은 응답을 반영하지 않는다.
- self-service 모드에서는 웹 수신 동의가 기준이며 계정별 환경 변수 등록은 필요하지 않다. 전역 수집 중지와 사용자 설정 저장은 분리한다.
- 구현·운영 세부 기준: [명세](../docs/tech-feed/web-search-spec.md), [운영 가이드](../docs/tech-feed/search-provider.md). 코드 배포와 실제 키 연결/예약 수집 검증은 별도로 기록한다.

아래 2026-09-12 이전 설계 기록의 웹 검색 제외 및 소유자 파일럿 전용 조건은 이 개정으로 대체된다. 과거 진행 기록은 이력으로 유지한다.

## 2026-09-12 승인 개정 — 웹 검색 포함 맞춤 피드

사용자가 공개 웹 검색 포함 구현과 공유 검색 캐시, 무료 한도 소진 시 RSS/API 유지, 유료 자동 전환 금지, 근거 기반 요약 원칙을 명시적으로 승인했다. 이제 아래 옛 Non-goals의 General web search 제외와 설계 경계 미확정 기록은 적용하지 않는다.
현재 구현 기준: docs/tech-feed/web-search-spec.md. 실행 계획: docs/tech-feed/web-search-implementation.md. 일반 사용자는 웹에서 관심 내용/수신을 설정하며 외부 계정/API 키를 넣지 않는다. 운영 검색 키는 앱 서버에만 저장한다. 아직 구현 중이며 가동 완료가 아니다.

## 2026-09-12 후속 설계 검토 — 관심 내용 입력형 피드

사용자가 웹에서 원하는 정보를 입력하고 소식 수신을 직접 시작/중지하는 방향을 요청했다. 외부 계정 연동/API 키 입력은 요구하지 않는다. 세부 검토안은 docs/tech-feed/topic-feed-design.md에 있다.
기존 RSS/API 기반 맞춤 선별과 일반 웹 검색 추가는 구분한다. 첫 버전 범위 확인 전 아래 Non-goals와 운영 정책을 자동으로 변경하지 않는다. 아직 구현/운영에 적용되지 않은 설계안이다.

# PRD: 시간별 기술 피드

User approved 2026-09-12. Replaces active career-driven StudyRoom 2.0 with a simple technology learning feed. Implementation only; no commits, push, remote migrations or deployments without a separate request.

## Problem / Goals
Discover current technology without complex career setup: discover → Korean summary → original source → explicit study todo. Desktop and mobile web; keep Today as default.

## User scenarios and requirements
- Hourly server collection of subscribed public RSS/Atom and Hacker News API; no three-items-per-day cap.
- Eight recommended sources: GeekNews, Hacker News, Hugging Face, Simon Willison, AWS What's New, GitHub Changelog, Toss, Woowahan.
- Latest/saved views, interest/source filters, collapsible subscriptions; 20-item cursor pages, no automatic reorder while reading.
- Interests: ai, frontend, backend, cloud, tools. Categories: news, practice, deep_dive; null means unclassified.
- Show source, published time, excerpt/summary provenance, last successful collection and partial failure. No external notifications.
- Preview public HTTPS RSS/Atom before subscribing; max 10 custom sources per user; no authenticated/private/token-bearing feed URLs.
- Persist subscriptions, interests, saves and todo links server-side with owner isolation across devices.
- Open existing todo editor with title/date/time; explicit save creates todo and original-article link atomically/idempotently.

## Collection / AI / safety
- Shared collection per normalized source; seven-day/50-item initial import; later incremental collection, no re-dating old posts.
- Source GUID and normalized original URL deduplication, preserving multiple source attributions.
- Conditional GET, bounded responses/time/concurrency, leased jobs, failure backoff, 90-day unreferenced article retention.
- Public excerpts only; no arbitrary original-page crawling or paywall bypass. Insufficient text stays unsummarized.
- Free-only existing OpenRouter client, six actual calls/user/day shared with restart coaching including failed calls; up to three articles per call, cached results. No paid fallback.
- Summary: what technology / key change / application. Validate output shape; URLs always server-owned. Article text is untrusted data, never instructions.
- Block SSRF (including DNS/redirects), XXE, oversized bodies and unsafe HTML. RLS isolates subscriptions/saves/custom feeds. Server-only writes for collection and AI.
- Source permission review is distinct from RSS availability. Unknown permission remains disabled; no claim all eight are launch-ready.

## Career archive / compatibility
Archive dedicated career UI/server/tests with restore instructions; keep DB/migration history and shared free AI/quota. Tombstone old entrypoints to prevent stale clients scheduling work. Disable only career cron at separately approved rollout. Extract timezone saving from career API. Preserve timer, attendance, todos, reports, forest, restart coaching.

## Release and validation
Owner-only pilot feature flag; additive migration → Edge handlers → web → hourly Cron activation, only on separate authorization. Kill switch stops feed only. Verify parser/adapters, RLS/SSRF/idempotency/leases, AI fallbacks and 390px browser interactions; existing test/build/Edge/mobile/docs checks. Production cron and actual AI quality are separate from synthetic/local verification.

## Non-goals
General web search, SNS OAuth, private content, video summarization, Expo feed UI, external notifications, paid inference.
