## 2026-09-14 승인 개정 — 원문 썸네일·첨부 영상

- 사용자 "진행하고 작업이 끝났으면 배포해"로 원문 미디어 표시와 완료 후 운영 배포 승인.
- 원문의 Open Graph/Twitter 대표 이미지 1개와 허용 제공자(YouTube/Vimeo) 첨부 영상 식별자를 확인한다. 기존 영상 원문 링크도 안전한 플레이어로 연결하되 새 검색의 영상 도메인 제외는 유지한다.
- 이미지 지연 로딩·전체 비율 유지·no-referrer, 영상은 버튼 클릭 후 외부 플레이어 로드/자동재생 없음/닫기 제공. 미지원 영상·접근 차단·미디어 없음/실패는 원문 읽기와 텍스트 유지.
- 원문 HTML은 제한된 메타데이터 추출에만 일시 사용하고 전체 본문/이미지 바이너리를 DB에 저장하지 않는다. 관련 없는 이미지 검색·AI 이미지·추가 유료 API 없음.
- 매 수동/정기 작업 최대3개(미디어 단계12초, 개별6초), 공용90초 lease 캐시. 성공/없음7일·실패1일 후 재확인, 기존 글도 최신순 처리. 모든 글의 썸네일/영상 재생은 보장하지 않는다.
- 원문 요청은 기존 DNS/TLS 검증·1MiB·리디렉션 검증 transport. robots noindex/noimageindex/미리보기 none 존중. 서비스 전용 RLS/RPC, 수신 중지 재검증, 원문 URL 변경 시 낡은 캐시 숨김.
- 외부 이미지 서버/플레이어가 방문자의 네트워크 정보를 받을 수 있으며 영상은 클릭 전 요청하지 않는다. 출처의 재사용 권한을 대신 승인하지 않는다.


## 2026-09-14 승인 개정 — 일반 기술 블로그 중심의 읽기 피드

- 사용자 진행 승인 및 정정: AWS 아키텍처/기업 블로그/Claude Code 스킬은 예시다. 특정 업체·도구 목록으로 제한하지 않고 사용자가 입력한 관심 기술의 블로그·실무 사례·해설·활용 가이드를 찾는다.
- 관심 주제별 블로그 → 사례 분석 → 활용 가이드 순환. 공유 query_cursor와 요청당 기본검색1회·최대5개 결과는 유지하며 검색 기간은 최근1주에서1년으로 확장한다. 실제 발행일을 보존하고 날짜를 추정하지 않는다.
- 공개 검색 소개와 승인된 RSS/API가 제공한 텍스트만 사용한다. 전체 본문 크롤링·영상 요약·SNS 인증·스킬 자동 설치·유료 전환은 추가하지 않는다.
- 영상 및 명백한 목록 페이지는 새 검색 수집에서 제외한다. query 기반 실제 글은 보존하고 기술 장애 타임라인을 영상 시간표로 오인하지 않는다.
- 명확한 홍보 문장/챕터 목록만 정리한다. 문장 경계가 불명확하면 기술 본문을 보존하며 근거 부족 시 원문 안내를 표시한다. 기존 영상 기록은 삭제하지 않고 링크·저장·할 일 연결을 보존한다.
- 제목과 소개 바로 아래 출처가 서버의 원문 URL로 연결된다. 검색 소개 출처와 원문 발췌 출처, AI 요약은 구분한다.
- 피드 전용 Pretendard Variable(고정v1.3.9 CDN, 시스템 고딕 fallback), 본문PC17px/모바일16px, 보조텍스트13px 이상 및44px 링크 터치영역. 밝은 숲 테마와20개 페이지 흐름 유지.
- 검색 월900/공유AI6회/DeepL월45만자, RSS 사용조건 승인, 사용자별 저장 격리 불변. DB migration 없음. 로컬 구현/운영 배포 상태는 progress.md를 따른다.


## 2026-09-13 — 페이지형 SNS 읽기 화면 승인

- 사용자 "구현해줘"로 짧은 화면안 승인. 기존20개씩 더 보기/누적 표시는20개 페이지 전환으로 대체.
- 기존 커서 기반 이전/다음·방문 페이지 번호·캐시 복귀. 자동 재정렬 금지. 필터/계정/명시적 새 글 확인 후1페이지 조회.
- Threads형 단일 열: 출처 이니셜·이름·시간, 관심 태그, 한국어 제목·짧은 소개, 전체 소개/AI3항목 요약 펼치기, 원문 텍스트 별도 접기, 원문/저장/공부할일 행동.
- PC 중앙 읽기 영역, 모바일 한 열·44px 터치 영역, 밝은 크림/숲색 유지. 관심·수집 설정 패널은 접되 첫 입력과 설정 충돌 시 관심 패널 열기.
- 수집하지 않은 본문·이미지·반응 수치 생성 금지. 기존 번역/무료 제한/출처 권한/공부 기능 불변.
- 저장 해제로 미열람 글 건너뛰기/다음 페이지 접근 불가가 발생하지 않아야 함. 조회 실패 시 현재 내용 유지, 계정 전환 시 이전 요청/내용 차단.

## 2026-09-13 — DeepL 한국어 번역 구현 승인

- 최신 사용자 "구현해줘"로 DeepL API Free 제목·소개 번역을 확정한다. 아래 공급자 미확정/확인 대기는 이전 이력이다.
- 원문 제목·소개만 번역하며 본문 크롤링·원문 사이트 전체 번역은 하지 않는다. 한국어를 기본 표시하고 원문 텍스트는 접어서 제공한다. 원문 URL은 변경하지 않는다.
- 기존 글도 대상이며 같은 기사 번역은 구독자 간 재사용한다. 원문이 바뀌면 기존 번역을 숨기고 다시 처리한다.
- 코칭/요약의 사용자당 실제6회/일은 그대로 유지한다. 번역은 별도 앱 공용 UTC월450000자 원자적 예산과 DeepL Free 실제 잔여량을 함께 검사한다. 실패한 POST도 예약 문자를 환급하지 않는다.
- 서버 DEEPL_API_KEY만 사용하고 api-free.deepl.com 고정, 유료키/유료 endpoint/fallback 금지. 키 미등록·중지·한도·오류는 원문과 정확한 상태를 제공한다.
- 수동/정기 수집마다 최대3개 순차 번역, 전체 즉시 번역은 보장하지 않는다. 출처 승인/구독 권한 및 요청 시 수신중지 재검증을 유지한다. 상세 docs/tech-feed/korean-translation.md.

## 2026-09-13 — 번역 예산 분리 승인

- 사용자 승인으로 제목·소개 번역에는 코칭의 사용자당 하루6회 제한을 그대로 적용하지 않는다. 번역 공급자의 실제 무료 한도 내 별도 예산/중복 캐시로 관리한다. 코칭 기존 동작은 유지한다.
- 유료 자동 전환 금지, 한도/장애 시 원문+번역 대기. 공급자(번역API vs AI) 선택은 비교 후 확인 중이며 아직 제품 코드/운영에 적용하지 않았다.

## 2026-09-13 — 승인된 매 클릭 즉시 수집 개정

- 사용자 진행 승인. 아래 수동5분 조건을 대체: 완료 후 다음 명시적 클릭은 즉시 수집. 실행 중 중복 요청만 lease로 합친다. 정기1시간 TTL, 실패 backoff, 무료 검증/월900은 유지한다.
- 복합 관심은 쉼표·세미콜론·및·그리고·and 기준으로 나누고 중복 제거 후 한 번에 하나씩 순환 검색한다. 요청당 기본검색1회. 실제 사용량 예약 때만 공유 query_cursor 증가(실패 포함). 저장 입력과 구독 identity는 바꾸지 않는다.
- 단일 주제는 그대로 검색. 보안 URL 필터/무료 AI 제한 불변.0건/미실행/오류를 구분하고 새 글 도착을 보장하지 않는다.

## 2026-09-13 승인 개정 — 카드 미등록 무료 계정 수집 활성화

- 사용자 카드 미등록 확인과 수집 활성화 승인으로, null 한도를 무조건 거부하던 조건을 개정한다. Free/Researcher·무료 잔여량·paygo 사용0·앱900회 원자적 제한을 유지한다.
- key.limit의 명시적 null은 무료 계정 잔여량 기준으로 제한한다. 숫자 한도는 추가 상한이며0이면 소진이다. paygo_limit은 null 또는0만 허용; null을 결제 비활성화 증거라고 주장하지 않는다.
- 필드 누락/잘못된 타입/유료 요금제/양수 paygo 한도·사용량/한도 소진은 차단한다. 전용 카드 미등록 계정 사용, 기본검색1크레딧, 제공자 작업 잠금, 앱 전체 월900회 유지. 유료 설정을 변경하지 않는다.
- 서버2개 재배포 후 실제 검색·기사 저장·별도 Cron을 검증한다. 아래 예전 명시적 한도 필수 조건은 이 개정으로 대체한다.

## 2026-09-13 승인 개정 — 새 글 확인 즉시 수집

- 사용자가 짧은 설계에 `진행해줘`로 승인했다. 기존 시간당1회 캐시는 자동 수집에 유지하고, 명시적 버튼 요청에만 수동 예외를 둔다.
- 새 글 확인은 목록 재조회가 아니라 인증된 즉시 수집 요청이다. 요청 중 상태/버튼 비활성화, 완료 후 목록 반영, 공유 작업 상태 확인을 제공한다.
- 계정 및 같은 주제·출처5분 제한, 기존 작업 lease/실패 백오프/무료 계정 검증/앱 전체 월900회 상한을 유지한다. 관심 내용 변경으로 계정 제한을 우회하지 않는다.
- 현재 관심 주제1개와 승인된 구독 RSS/API 최대4개를 확인한다. 매번 새 글이 있거나 전체 출처를 즉시 확인한다고 보장하지 않는다. 수동 요청은 AI 추가 호출 없이 실제 소개/원문부터 제공한다.
- 미연결·중지·한도·부분 실패·실행 중·최근 요청 대기를 구분한다. 계정 전환/설정 revision 충돌의 오래된 요청을 반영하지 않는다.
- 서버 비밀값/수집 활성화/출처 승인은 자동 변경하지 않는다. 운영 가동과 코드 배포를 별도 검증한다.
- 세부 API 및 검증: docs/tech-feed/web-search-spec.md, manual-refresh-verification.md. 아래 한 시간 공유 설명은 정기 수집 기준이다.

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
