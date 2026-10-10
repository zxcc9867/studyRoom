## 2026-10-10 개정 — 무료 API Developer 지원

- 실제 로그인 계정에서 API Developer / Free / 전체 1000000자, 사용499034자를 확인했다. 이전 500000자 clamp가 잔여966자로 계산해 묶음 번역을 중단한 것이 원인이다.
- 사용자 승인으로 `DEEPL_API_PLAN=developer`인 서버만 전체1000000자까지 인정한다. 누락/`free`는 기존500000자 제한을 유지하고 미지원/유료 요금제 설정은 호출하지 않는다. 계정 요금제·결제·키·사용량은 변경하지 않는다.
- Developer의100만 자는 **전체 이용 기간 한도이며 매월 초기화되지 않는다**. 앱 자체 공용 UTC월450000자 예산은 별도로 유지한다. 무료 잔여량이 부족하면 원문을 제공하며 유료로 전환하지 않는다.
- 카드에는 한도·일시중지·미연결·서비스 확인 상태를 구분한다. 기존 성공 번역과 한국어 원문은 계속 표시한다.
- 검증/운영 반영 결과는 아래 후속 기록에 남긴다. 이전 배포 기록은 당시 이력이다.

### 현재 복구 검증

- 관련27개 RED→GREEN, 전체1137/1137·생략0·실패0, Edge23/23·웹/build·mobile·docs·Dune 통과.
- 운영 서버 developer 설정과 tech-feed42/worker40 ACTIVE/JWT true 확인. 정상 worker HTTP200 뒤3건/POST1회3232자 번역 저장, provider ready/2026-10-10T13:26:01Z 확인. 월예산52438/450000자이며 초기화하지 않았다.
- 실제 로그인 웹에서 새 글 확인 → 새 글 배너 → 한국어 제목·소개/원문 접기·원문 URL 보존 확인. 웹 상태 문구의 새 배포와 Android 실기기 동기화 수용은 별도 확인한다. APK0.2.4/code7은 변경하지 않는다.

## 현재 운영 상태 — 2026-09-14

- 한국어 기본표시와 페이지형 피드 웹 배포 완료. 기능 커밋 b4ed456, [자동 배포 성공](https://github.com/zxcc9867/studyRoom/actions/runs/34764366095), Vercel dpl_FCNMA6k5hHrybKEsnT3QrteMeLGr READY.
- [운영 사이트](https://study-room-attendance.vercel.app)와 새피드chunk HTTP200, 번역·페이지·내용 펼치기 코드 반영 확인. 기존 번역 DB/서버는 재적용하지 않았다.
- 전체600테스트/Edge8/웹빌드 및 CI 통과. 로컬 예시 데이터 Chromium PC/모바일 동작 검증 완료, 운영 로그인 계정 조작은 별도 미검증. 아래 배포 기록의 승인대기·웹미반영 문장은 당시 이력이다.

# 기술 피드 한국어 번역

## 사용 흐름

- 제목·소개는 DeepL의 무료 API(기존 Free 또는 승인된 Developer)로 번역하고, 준비되면 한국어를 기본 표시한다. `원문 텍스트 보기`는 접힌 상태이며 원문 사이트 링크는 그대로다.
- AI 요약은 별도 기능이다. 번역은 기존 코칭/요약의 공유 AI 호출 예산(2026-09-15 개정 기준 하루15회)을 사용하지 않는다. 본문 전체 크롤링이나 원문 사이트 자체 번역은 하지 않는다.
- 수동 `새 글 확인`과 정기 작업이 기존 글을 포함해 한 번에 최대3개씩 번역한다. 공유된 기사 성공 결과를 재사용한다. 모든 글의 즉시 번역을 보장하지 않는다.
- 원문 변경 시 오래된 번역을 숨긴다. 키 미등록·한도·장애 시 원문과 상태를 표시하고 RSS/API/검색은 유지한다.

## 운영자 설정

1. [DeepL API](https://www.deepl.com/en/developers)에서 앱 전용 무료 키를 준비한다. 실제 계정이 무료인지 확인하며 유료 API 키는 지원하지 않는다.
2. 연결된 Supabase 프로젝트 `bqohkdzvxbrokkmuhysx`의 Edge Functions → Secrets에 `DEEPL_API_KEY`로 등록한다. 키 값은 채팅·Git·프론트엔드 환경변수에 넣지 않는다. 일반 이용자의 계정 연동이나 개인 키는 필요 없다.
3. 기본 `DEEPL_API_PLAN=free`는 기존 Free 월500000자다. 무료 API Developer임을 확인한 경우에만 운영자 승인 후 `developer`로 설정한다(전체1000000자, 초기화 없음). 다른 값은 안전하게 중단한다. `TECH_FEED_TRANSLATION_ENABLED=false`가 있다면 운영자 승인 후 제거하거나 true로 바꾼다. 전체 피드 중지 스위치도 존중한다.
4. 기존 앱에서 `새 글 확인`을 누르고 한국어 제목/소개, 원문 접기, 원문 URL을 확인한다. 기술용어 정확도는 실제 표본으로 확인한다. 기존 키 누락 상태에서는 이 실검증을 완료할 수 없다.

2026-09-13 사용자가 Free 키를 서버에 등록했고, 명시적 배포 승인 후 실제 번역 저장을 확인했다. 아래 배포 기록이 최종 상태다.

## 무료 한도와 보안

- 고정 endpoint는 `https://api-free.deepl.com/v2/usage`와 `/v2/translate`뿐이다. 키 suffix `:fx` 확인, Pro/임의 URL/유료 fallback/POST 자동 재시도 금지.
- 공급자 Free 월500000자 또는 Developer 전체1000000자와 별개로 앱은 공용 UTC월450000자를 원자적으로 예약한다. Unicode codepoint 기준이며 실패 POST도 환급하지 않는다. 사용량 조회는 번역 문자 예산을 차감하지 않는다.
- 실제 무료 잔여량을 POST 전에 확인한다. 제공자 상한과 선택한 무료 요금제 상한 중 작은 값을 인정한다. 응답이 더 커도 `free`는500000자, 명시적 `developer`는1000000자를 넘지 않는다. Pro 응답·알 수 없는 사용량은 거부한다. 공급자 사용량은 수분 지연될 수 있고 공급자 기간과 UTC월은 다르므로 두 제한을 모두 적용한다. 이 앱만 사용하는 무료 키를 권장한다.
- 제공자90초 lease로 동시 호출을 합치고 요청12초/응답128KiB/최대6텍스트를 제한한다. 작업 중지·사용자 구독/원문 변경·만료 lease를 재검증한다. 실패는 재시도 대기하며 서버 오류/키는 노출하지 않는다.
- 테이블과 RPC는 service_role 전용이다. 번역은 이미 허용된 원문을 볼 수 있는 사용자에게만 기존 목록 조회 경로로 제공한다. 외부 텍스트를 명령으로 실행하거나 새 링크를 만들지 않는다.
- 출처 RSS 재가공 승인은 기존 `summary_allowed`/승인 상태를 재사용한다. 이번 변경은 출처 허가를 자동으로 확대하지 않는다.

## 구현과 검증

- `_shared/tech-feed-translation.mjs`: Free 전용 클라이언트.
- `_shared/tech-feed-translation-worker.mjs`: 공통 번역 작업, 사용량 사전확인/예약/결과 처리.
- `tech_feed_translations`, `tech_feed_translation_provider`, `tech_feed_translation_budget`: 공유 snapshot 캐시, 공용 잠금, 별도 문자 예산.
- `tech_feed_list`의 `title_ko`, `excerpt_ko`, `translation_status`; `state.translation_service`는 원문/AI 상태와 분리한다.
- 검증 명령: `npm.cmd test`, `npm.cmd run test:edge`, `npm.cmd run build`, `npm.cmd run mobile:check`, `npm.cmd run docs:check`.
- 배포 순서: 추가형 DB migration → tech-feed/tech-feed-worker → 웹. 번역만 중지할 때는 `TECH_FEED_TRANSLATION_ENABLED=false`; 기존 번역/원문/출석/타이머 데이터는 삭제하지 않는다.

## 공식 근거

- [무료/유료 endpoint와 인증](https://developers.deepl.com/docs/getting-started/auth)
- [번역 요청과 응답](https://developers.deepl.com/api-reference/translate/request-translation)
- [사용량과 조회 지연](https://developers.deepl.com/api-reference/usage-and-quota/check-usage-and-limits)
- [무료 문자 한도](https://developers.deepl.com/docs/resources/usage-limits)
- [API 요금제: Developer 전체 한도와 기존 Free 월 한도](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans)

## 배포 기록

### 2026-10-10 — 승인된 무료 Developer 지원 및 운영 복구

- 실제 계정은 API Developer / Free / 전체1000000자였으며 사용499034자에서 기존500000자 clamp 때문에 묶음 번역이 중단됐다. 사용자 승인으로 명시적 DEEPL_API_PLAN=developer만1000000자까지 지원했다. 기본 Free500000·앱UTC월450000·고정 무료 endpoint·유료전환 금지는 유지한다. Developer 전체한도는 매월 초기화되지 않는다.
- tech-feed42/worker40 ACTIVE·JWT true/익명401. 정상 worker와 실제 새 글 확인으로 총6건/POST2회6692자 성공, ready261→267·자체예산49206→55898/450000자·provider ready 확인. 키/요금제/결제/DB스키마/RLS/출석Cron·기존 카운터 변경 없음.
- 제품0053ee16aa1a3bd7316473b7c8860fa119cc3310은 codex/recovery-consistency에 커밋·푸시했다. Actions [38056061319](https://github.com/zxcc9867/studyRoom/actions/runs/38056061319) success, Vercel dpl_BTkMuMZXo3D3AKy6ysfd11SZHKMM production READY·동일SHA·[운영 URL](https://study-room-attendance.vercel.app) HTTP200. main 직접 푸시/PR머지 없음.
- 전체1137/1137·실패0·생략0, Edge23/23, build/mobile/docs/Dune 및 실제 계정 한국어 카드·원문 접기/링크·저장 재조회/해제·할 일 편집창 확인/취소 완료. 실제 새 할 일은 생성하지 않았다. 증거: output/feed-translation-developer-production-20261010.jpg. ADB 기기 없음으로 실제 Android 동기화는 미확인이다. hosted UI/API 수정이므로 새 APK는 필요 없다.
- 아래 2026-09-13 당시 웹 배포 미실행 기록은 역사이며 현재 미배포 상태를 의미하지 않는다. 번역은 최대3건씩 순차 처리하고 모든 글의 즉시 번역을 보장하지 않는다.

### 2026-09-13 — 최초 번역 구현 당시 기록

- 사용자 명시적 운영 배포 승인 후 DB `20260913140137_tech_feed_korean_translation.sql`과 서버 함수를 적용했다. 출석/피드 Cron은 유지했고 번역테이블3개 RLS 및 브라우저 직접 접근차단을 확인했다.
- 전체591개 테스트·Edge8개·웹 빌드·모바일·README 및 독립 최종 리뷰 통과.
- 14:17UTC 일반Cron에서 실제 번역3건 저장, POST1회/3007자 기록. 잔여4건은 순차처리. Free 응답의 큰 문자상한을 무조건 거부하던 버그는500000자clamp로 수정했으며 무료 상한을 높이지 않았다.
- 최종 서버 tech-feed v16/worker v18 ACTIVE·JWT true. 원문7건 전체 번역ready, 실제POST3회/7259자. 원문과 snapshot이 일치하는 번역7건 및 샘플 한국어 제목/소개 확인.
- main 커밋·푸시 요청은 승인 시스템이 별도 Git 승인을 요구해 실행 전 거부했다. stage/commit/push 및 Vercel웹배포 미실행, HEAD1d38625 유지. 현재 운영 웹에는 새 번역UI가 아직 반영되지 않았다.
- 다음 사용자 명시적 커밋·main푸시·웹배포 승인 후 workflow/READY/HTTP200 및 로그인 브라우저 PC/모바일 조작을 확인한다. DB와 정상 번역 결과는 그대로 보존한다.
