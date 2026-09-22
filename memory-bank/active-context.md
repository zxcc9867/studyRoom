## 2026-09-23 — 기술 피드 추천 후속 보완

- 현재 작업: 기존 배포된 하이라이트를 보존하고 생성 프롬프트와 캐시 검증을 보완했다. 관련 PRD: prd-tech-feed.md.
- 결정: 오늘 요약 한 번으로 최대 3개 추천, 추천 이유·읽을 포인트·서버 원문 링크 제공. CTA를 `오늘 요약·추천 보기`로 명확히 했다. 별도 AI 호출·유료 전환·DB 변경 없음.
- 완료: 전체 787/787 테스트(skip 0), Edge 11건, 웹 build, mobile:check, docs:check 통과. 1440px/390px 브라우저 검증 및 스크린샷 확인.
- 다음 작업: tech-feed Edge와 웹 production 배포 및 상태 확인. 기존 세션 UX와 미해결 migration 이력은 이번 범위에서 변경하지 않는다.

## 2026-09-21 — 실제 공부/계획 연결 기능 운영 배포 완료 (DB → Edge → 웹)

### 현재 작업

- 작업명: 인수받은 실제 공부·계획 연결 기능의 운영 배포. 사용자가 지정한 DB/RPC → Edge → 웹 순서를 그대로 지켰다.
- 작업 목적: 로컬 검증까지 끝난 릴리스를 운영에 반영하고 각 단계 결과를 증거와 함께 기록한다.
- 관련 PRD: prd-actual-study-plan.md, prd-tech-feed.md. 관련 문서: docs/session-plan/verification.md.

### 최근 결정 사항

- 배포 직전 운영에 활성 세션 1건이 있었다(lease 13:51Z). migration은 tracking row가 없는 세션에 대해 trigger가 즉시 return하므로 무영향임을 확인하고 그대로 진행했다.
- migration 본문을 손으로 옮겨 적는 위험을 없애기 위해, 먼저 `select md5(...)`로 전송된 본문의 md5가 저장소 파일(LF 기준 `99506e6d2782ca3d1892faee925b706d`, 33670자)과 일치하는지 검증한 뒤 적용했다.
- Edge는 MCP로 21개 파일을 붙여넣는 대신, 이미 로그인되어 있던 Supabase CLI로 소스에서 직접 배포했다. 전사 오류 가능성이 사라졌다.
- 웹은 tip 커밋의 `[skip ci]` 때문에 push만으로는 배포되지 않아 `workflow_dispatch`로 동일 워크플로를 실행했다. CI 게이트는 전부 통과 후 배포됐다.

### 현재 상태

- 완료: migration 적용(study_todo_plans 242건 backfill, trigger 2, private 함수 9, RLS 정책 4), Edge `tech-feed` v35 / `tech-feed-worker` v34 ACTIVE(verify_jwt true, 무인증 401 유지), main `53cd701..eddc1df` 푸시, Actions 35609593667 success, Vercel 운영 배포, 사이트 HTTP 200.
- 완료: 배포 전 현재 트리 전체 게이트 재실행 — 브라우저 포함 782/782(skip 0), build, test:edge 11건, mobile:check, docs:check 통과. CI는 765 pass + 17 선택 브라우저 skip으로 로컬과 일치한다.
- 완료: 운영 데이터로 `get_actual_study_state` 직접 호출 검증. tracking row가 없는 기존 활성 세션도 `session_id`를 그대로 반환해 웹의 시작/일시정지·종료 버튼이 활성 상태를 유지한다.
- 막힌 부분: 적용된 migration 이력 version이 `20260921135457`로 기록됐고, 저장소 파일명 `20260921095213`과 맞추는 UPDATE는 권한 분류기에 막혔다. 기능 영향은 없다.

### 주의할 점

- 이력 version 불일치는 기록 정합성 문제다. 저장소 파일명을 적용된 값으로 바꾸거나 DB 이력 row를 수정하는 것 중 하나를 사용자가 선택해야 한다.
- `[skip ci]`가 tip 커밋에 있으면 push로는 Vercel 배포가 실행되지 않는다. 문서 커밋을 마지막에 두는 릴리스에서 반복될 수 있다.
- `actual_study_private.requests`는 여전히 보존 정책이 없다. 확정 1건당 1행이 쌓인다.
- 배포 전부터 있던 활성 세션은 `unknown_allocation=true`, `evaluation_eligible=false`로 남는다. 의도된 보수적 동작이며 해당 세션은 준수 평가에서 제외된다.
- Supabase advisors 증가분은 전부 의도된 신규 표면이다(private 테이블 1건 deny-all, 신규 RPC 6건 authenticated 노출). mutable search_path는 2건 그대로다.

## 2026-09-21 — Codex 중단 작업 인수, 검증 완료 (배포 대기)

### 현재 작업

- 작업명: 실제 공부와 계획을 연결하는 세션 UX — Codex 세션 크레딧 소진으로 Task 3 중간에 끊긴 작업의 인수·마무리.
- 작업 목적: 남은 하이라이트 구현을 커밋 가능한 상태로 마무리하고, 현재 트리 전체 회귀로 출시 준비 상태를 확정한다.
- 관련 PRD: prd-actual-study-plan.md, prd-tech-feed.md. 관련 문서: docs/session-plan/verification.md, session-api.md.

### 최근 결정 사항

- 사용자가 인수를 요청했다. 로컬 커밋은 승인, Supabase 인증 후 배포 재개를 선택했다.
- 죽은 Codex 세션의 `codex-highlights-20260921` claim은 사용자가 종료를 확인해 준 뒤 해제하고 `claude-opus5-20260921`로 다시 claim했다.
- 하이라이트의 엄격한 root 스키마(`insights`,`highlights` 정확히 2개)는 기존 insights 계약과 같은 수준이므로 그대로 유지했다. 모델이 `highlights`를 누락하면 요약 전체가 거절되고 예산이 환급된다.

### 현재 상태

- 완료: Task 1(3429c93, 9526b85), Task 2(9bb654c), Task 3(ff026e5 — 브리핑 프롬프트/파서, hero+보조 카드, 타입·CSS, 집중 테스트 8건).
- 완료: 현재 트리 전체 게이트 — 브라우저 마운트 포함 782/782, build, test:edge 11건, mobile:check, docs:check, `git diff --check` 통과.
- 완료: techFeed.css 끝 빈 줄 제거. 마운트 테스트가 조용히 skip되던 원인은 `playwright/index.js`에 `chromium` named export가 없는 것이었고 `index.mjs`로 해결했다.
- 완료: 웹 통합 집중 리뷰. 동작을 바꾸는 결함은 없었고 출시 관련 관찰 2건을 verification.md에 기록했다.
- 막힌 부분: 이 세션의 Supabase MCP가 미인증이고 worktree에 CLI 링크가 없어 migration을 적용할 수 없다.
- 다음 작업: Supabase 인증 후 migration `20260921095213` 적용 → Edge → main 푸시 → Actions/Vercel 검증.

### 주의할 점

- DB/RPC를 웹보다 먼저 적용해야 한다. 활성 세션의 tracking 상태가 없으면 시작/휴식 버튼과 종료 버튼이 모두 비활성화되고 `endTimer`가 조기 반환한다. 순서가 뒤바뀌면 진행 중인 세션을 브라우저에서 종료할 수 없다.
- `actual_study_private.requests`에 보존 정책이 없다. 확정 1건당 1행이 쌓이므로 별도 후속으로 정리 작업이 필요하다.
- `BRIEFING_ANALYZER_VERSION`이 2로 올라가 기존 캐시 브리핑은 다음 명시적 요청에서 재생성된다.
- 검증 부산물 `output/`, `.playwright-cli/`, `0`, `.superpowers/`는 .gitignore에 없으므로 출시 커밋에 절대 staged하지 않는다.
- `origin/main`은 아직 `53cd701`이며 릴리스는 깨끗한 fast-forward다. 운영 스키마·Edge·배포·사용자 데이터는 이 세션에서 변경하지 않았다.

## 2026-09-21 — 서버 리뷰 통과, 웹 세션 UX 연결 중

- 완료: additive DB/RPC 로컬 구현3429c93 및 리뷰수정9526b85. SQL34/34,실제 PostgreSQL18 경합4/4 통과.
- 진행 중: 기존 이번 세션 할 일 패널에서 하나의 현재 집중할 일, 누적/남은 분량, 조정/원래 일정 및 충돌 확인 연결. 계획 준수는 기존 리포트의 별도 항목.
- 확정 계약: docs/session-plan/session-api.md. unknown 과거 최초시작은 평가 제외, 기존 시간표가 표현하지 못하는 DST 구간은 전체 차단.
- 다음: 웹/하이라이트 리뷰→전체 회귀→Supabase DB/RPC→Edge→GitHub Actions/Vercel 배포. 아직 운영 미적용.

## 2026-09-21 — 실제 공부와 계획을 연결하는 세션 UX 구현 중

- 작업명: 원래 계획 보존 + 현재 집중할 일 + 실제 공부 구간 + 충돌 연쇄 이동 + 계획 준수 리포트.
- 관련 PRD: prd-actual-study-plan.md. 사용자가 전체 구현과 검증 후 DB/RPC → 웹 배포를 승인했다.
- 최근 결정: 지연은 최초 시작만 평가하고, 출석/공부시간/숲 보상 감점은 없다. 과거 시간 배분은 추정하지 않는다.
- 현재 상태: 기준 전체 테스트 719/719(선택 브라우저 검사 포함), 기존 웹 빌드 통과. 서버 구현 시작. 새 기능의 운영 적용은 아직 하지 않았다.
- 승인된 기술 피드 하이라이트 변경도 보존해 함께 검증/출시한다. 기존 요약 요청 1회에서 최대 3건을 선정한다.
- 작업 위치: codex/recovery-consistency 격리 worktree. output/.playwright-cli/0 등 검증 부산물은 출시 커밋에서 제외한다.

## 2026-09-15 — 피드 품질 2차: 검색 질의 교체 + 블로그 메타 필터

- 사용자가 AWS 블로그 개설글 사례를 추가 제시. 조사 결과 근본 원인은 필터가 아니라 검색 질의('engineering blog 기술 블로그')가 블로그 자체를 찾고 있던 것이었다. 수집의 1/3이 여기에 해당했다.
- 질의를 'engineering deep dive internals 동작 원리'로 교체하고, 블로그 개설/홈/N선 패턴을 필터에 추가했다. 영어 사이트명 접미사 오탐(CloudQuery)도 함께 수정했다.
- 운영 76건 대조: 9건 차단, 전부 정당. 전체 711건(707 pass), test:edge 11/11, build/docs/mobile 통과. Edge 배포 완료.
- 남은 이슈: 커리어/마케팅 페이지는 관심사 프롬프트의 'fde' 때문에 유입되는 측면이 있어 프롬프트 조정 권고. 태그 페이지는 제목만으론 판별 불가.
- 커밋·푸시 대기.


## 2026-09-15 — 목록형(roundup) 규칙 필터 배포 완료

- 사용자가 실제 링크로 지적한 오분류(다른 블로그 소개 글이 'practice'로 표시)를 조사해 근본 원인(규칙 분류기가 발췌문 단어만 봄)을 확정하고, 예산 제약상 1단계(규칙만, AI 미사용)로 범위를 좁혀 승인받았다.
- 구현: feedIsRoundupTitle(제목 전용, 발췌문 미검사) → 분류기·수집기·브리핑 자격 3곳에 적용, rules_version 1→2로 기존 글 자동 재분류 트리거.
- 검증: 신규 테스트 8건, 전체 707건(703 pass), test:edge 11/11, build/docs/mobile 통과. Edge tech-feed/tech-feed-worker 배포 완료.
- 별도로 기록할 사고: python heredoc으로 정규식 ``를 다루다 백스페이스 바이트를 파일에 심는 실수를 했고 od -c로 발견해 문자열 연결 방식으로 재작성했다. 상세: trouble-shooting.md.
- 미검증: 실제 zencoder.ai 글의 재분류는 다음 정시(hourly) 워커 실행에서 반영되며 이 세션에서 즉시 확인하지 않았다.
- 2단계(AI가 기존 요약 호출에 장르 판단을 얹는 방식)는 사용자가 이번엔 보류했다. 필요 시 후속 요청으로 진행한다.
- 커밋·푸시는 별도 확인 후 진행한다.


## 2026-09-15 — 기술 피드 AI 요약 정상 동작 확인 (종료)

- 최종 원인은 두 가지였다: (1) OpenRouter API 키 만료 (2) 모델이 JSON을 마크다운 코드펜스로 감싸 반환해 `JSON.parse`가 실패. 사용자가 키를 교체하고 `parseModelJson()`을 추가해 해결했다.
- 운영 검증 완료: 실제 소유자 계정에서 인사이트 3건 생성·표시, `전체 14건 중 13건 분석`, DB has_result=true·last_error=null.
- 사용자 요청 (a) 모델 고정과 (b) 타이밍 계측을 모두 수행했다. (a)는 원인이 아니었으나 Supabase `OPENROUTER_MODEL`을 GitHub과 동일한 `google/gemma-4-26b-a4b-it:free`로 맞춰 두었다(무작위 라우터 대비 지연·변동 감소). (b)가 원인 규명의 결정적 수단이었다.
- 함께 고친 것: 타임아웃 호출이 환급되지 않던 결함, `parseInsights` 거부 게이트 명명.
- 남은 관찰 대상: 기사별 요약(`summarizeBatch`)에도 같은 수정을 적용했으나 워커는 매시간 실행이라 다음 주기에 확인한다. 현재 요약 완료 기사는 3건, pending 55건.


## 2026-09-15 — 실패 원인 API 키 만료로 확정, 사용자 키 교체 대기

- CI 프로브 4종 전부 `HTTP 401 "API key expired."`. 라우팅 제약(data_collection/max_price/provider)과 모델 선택은 모두 원인이 아님이 증명됐다. 상세: trouble-shooting.md.
- 진단 로깅은 커밋 f7a684b로 배포했고, 원인 확정 후 임시 프로브만 제거했다. code+status 로깅과 Edge의 feed_ai_failed 로그는 영구 유지한다.
- **다음 작업은 사용자 몫**: OpenRouter 새 키 발급 후 Supabase Edge 시크릿과 GitHub Secret 양쪽에 등록. 그 뒤 브리핑 1회 클릭으로 재검증한다.
- 미확정 잔여 증상: Edge 경로는 401이 아니라 20초 타임아웃(`cancelled`)으로 끝난다(표본 2건). 키 교체 후 이 증상이 남는지 재측정해야 한다.
- 예산 개편은 정상 동작 중: calls 12 / attempts 10 → 실패 2건이 환급됐다.


## 2026-09-15 — 커밋·푸시 완료 및 OpenRouter 실패 원인 좁힘

- 사용자 지시 "배포해줘"로 커밋 307ce05를 main에 푸시(4bd6bf4..307ce05). GitHub Actions 34921744811 success, Vercel production 배포 완료, 사이트 HTTP200. CI 테스트 693건(689 pass·0 fail·4 skip)로 로컬과 일치.
- 커밋에는 이전부터 미커밋이던 Codex의 2026-09-14 Supabase 재시작 진단 기록도 함께 포함됐다. 같은 memory-bank 파일에 누적돼 분리 커밋이 불가능했다.
- **CI 로그에서 그동안 못 보던 오류 코드를 확보했다**: `Free coaching live check: rules fallback required (upstream).` 응답까지 0.24초로, 모델 추론이 아니라 OpenRouter가 즉시 비 2xx를 반환한 것이다. `upstream`은 429가 아닌 HTTP 오류 또는 응답 본문의 error를 뜻한다.
- 새로 확인한 사실: GitHub Variable `OPENROUTER_MODEL`은 `google/gemma-4-26b-a4b-it:free`로 **특정 모델 고정**이며, Supabase Edge 시크릿의 `openrouter/free`(무작위 라우터)와 다르다. 두 모델 모두 공개 목록에 실재하고 gemma 엔드포인트는 Google AI Studio·24시간 가동률 99.2%다. 따라서 **모델 선택은 원인이 아니다.**
- 남은 후보: 401/403(키 상태), 402(크레딧), 404(`provider.max_price {0,0,0}` 또는 `data_collection:deny`가 모든 무료 공급자를 걸러냄). 01:17에 1회 성공한 이력이 있어 키 자체 무효는 가능성이 낮다. 공개 API는 엔드포인트별 데이터 정책을 노출하지 않아 외부에서 확정 불가.
- 확정하려면 실제 HTTP 상태코드와 응답 본문이 필요하다: (a) 사용자가 본인 키로 1회 curl (b) 오류 코드를 last_error에 남기는 진단 배포.


## 2026-09-15 — AI 예산 개편 운영 적용 완료 (요약 생성은 여전히 미성공)

- 사용자 지시 "운영에 적용해줘"로 마이그레이션·Edge 배포 수행. 마이그레이션 20260915020000 적용 및 이력 기록, cron `0 * * * *` 확인, Edge tech-feed v23/worker v25 ACTIVE, 무인증 401 유지.
- 배포 후 환급 결함 1건 발견·수정·재배포(상세: trouble-shooting.md). 운영에서 환급 동작 확인(calls는 증가, attempts는 유지).
- 현재 예산 상태: attempts 8/15, calls 10/40. 워커 cap 12, 사용자 여유 7회.
- **남은 문제: `openrouter/free` 무작위 모델이 쓸 만한 출력을 거의 못 낸다.** 오늘 실제 호출 약 8회 중 성공 1회(01:17, 기사 3건 요약). 브리핑은 4회 시도 모두 실패했고 화면은 계속 "AI 요약 연결을 확인하지 못했어요"다.
- 실패 원인은 여전히 미확정이다. OpenRouterError 코드가 askFeedAi→runBriefing 3중 catch에 삼켜져 401/404/429/형식오류를 구분할 수 없다. 다음 후보: (a) 사용자가 자기 키로 직접 1회 호출해 상태코드 확인 (b) 임시 진단 로깅 배포 (c) 특정 :free 모델 고정.
- 커밋·푸시는 하지 않았다. 웹(apps/web) 변경이 없어 Vercel 배포는 불필요했다.


## 2026-09-15 — AI 예산 15 + 워커 12 + 실패 환급 구현 완료 (운영 미적용)

- 작업명: 기술 피드 AI 요약 미동작 해소. 관련 PRD: prd-tech-feed.md의 2026-09-15 승인 개정.
- 사용자 결정 경위: (1) 시크릿 누락 아님이 확인됨 → (2) 할당량 경합이 원인 → (3) 6이 OpenRouter 제한이 아니라 자체 값이고 OpenRouter 무료 한도는 50/일임을 확인 → **한도 상향(6→15) + cron 정상화 + 실패 환급**으로 확정. 앞서 논의된 on-demand 요약안은 채택하지 않았다.
- 구현: 마이그레이션 20260915020000_tech_feed_ai_budget.sql(attempts 6→15, 환급 불가 calls 0~40, reserve p_cap 인자, refund 함수, 워커 cap 12, cron `0 * * * *`), tech-feed-store.ts refundAiCall, tech-feed-core.mjs callFailed, tech-feed-worker-core.mjs·tech-feed-briefing.mjs 환급 호출.
- 검증: 전체 693건(689 pass·0 fail·4 optional browser skip), test:edge 10/10, build, docs 24참조, mobile typecheck 통과. 신규 테스트 7건(예산 DB 5, 환급 2), 기존 6회 전제 테스트 1건을 새 동작으로 갱신.
- **아직 운영에 적용하지 않았다.** 커밋·푸시·마이그레이션 적용·함수 배포 모두 안 함. 오늘 운영 할당량은 6/6 소진 상태이며, 적용 시 calls=attempts 백필로 today 행이 attempts 6·calls 6이 되어 사용자 몫 9회가 즉시 생긴다.
- 주의: coach_reserve_ai/reserve_ai를 DROP 후 재생성하므로 배포 후 기존 1인자 호출 경로(coaching-store.mjs 빈 본문 RPC, tech_feed_briefing_reserve)를 실제로 확인해야 한다. db push는 원격 이력 37건이 로컬에 없어 실패하므로 Codex가 써온 Supabase MCP 경로가 필요하다(이 세션은 supabase MCP 미인증).
- 별도 미조사 이슈: 내 페이지 학습 리포트 `리포트를 불러오지 못했어요`.


## 2026-09-15 — [정정] AI 요약 원인: 시크릿 누락이 아니라 할당량 6회 고갈로 확정

- 사용자가 01:12:22 UTC에 OPENROUTER_API_KEY/MODEL 등록 완료. **API는 정상 작동**하며 01:17 워커 실행에서 AI 요약 3건이 실제 생성됐다(`category_method='ai'`).
- 실제 지속 원인 2가지: (1) 하루 6회 공유 할당량을 매분 도는 cron 워커가 5분 만에 독식(현재 6/6, 남은 0) (2) `openrouter/free` 무작위 모델 선택으로 5회 중 4회 출력 검증 실패, 실패도 할당량 차감.
- 6의 출처: 2026-09-06 커리어 코치 마이그레이션(1376fc6). 기술 피드보다 6일 앞서며 근거 주석 없이 한 번도 개정되지 않았다.
- 사용자 승인: 실패 시 환급 + 재시도. 할당량 경합 해결 방향은 확인 대기.
- 아래 같은 날짜 `Edge 시크릿 누락` 항목은 등록 이전 관측으로 유효하되, 현재 블로커는 이 항목이다. 상세: trouble-shooting.md.


## 2026-09-15 — 기술 피드 AI 요약 미동작 원인 확정 (Edge 시크릿 누락)

- 현재 작업: 실제 소유자 AI 인사이트 검증 이어받기(Claude). 클릭 재현 결과 unavailable. 원인은 운영 Edge 시크릿에 OPENROUTER_API_KEY/OPENROUTER_MODEL 부재. 관련 PRD: prd-tech-feed.md.
- 결정: 읽기 경로에서 provider 미설정을 unavailable로 보고(코드 4줄 + 회귀 테스트 1건). 사용자가 시크릿을 넣어야 실제 생성이 가능하며 키 값은 기록하지 않는다.
- 완료: 코드·테스트·문서(daily-briefing-verification.md, trouble-shooting.md). 전체 686(682 pass·4 optional skip)·Edge 10/10. 미커밋, 배포 안 함.
- 다음: 사용자가 시크릿 설정 → 브라우저에서 오늘 요약 보기 재클릭 → 인사이트·캐시 생성 확인 → 커밋/배포는 별도 지시.
- 주의: 내 페이지 학습 리포트가 "리포트를 불러오지 못했어요"로 실패한 화면을 관찰(미조사, 별도 이슈). 기존 장애 복구 문서의 미커밋 변경은 계속 분리 보존.


## 2026-09-15 — 기술 피드 개선 운영 배포 완료

- 완료: 자동 규칙 분류/기존 글 백필, Markdown 가독성, 자유 입력 중심 설정·접힌 동적 보기 필터, 전체 오늘 통계와 버튼형 AI 인사이트. 탭 복귀는 읽기 전용 갱신이며 추가 AI 호출 없음.
- 코드6ea0d95182dcf50954aa5dc076f0c944376bac97 main 푸시. Actions34871802491 success, Vercel dpl_2Gpsv3NdJ7a2tZFCABKMM8RPnBHW READY, https://study-room-attendance.vercel.app HTTP200.
- 실제 운영 assets/index-WOrXYlXe.js 및 TechFeedSection-BFR8zyll.js HTTP200, 새 오늘 패널/briefing_generate/source_key 포함 확인. DB20260914164719, Edge tech-feed20/worker22 적용.
- 검증: 전체685/685(브라우저4 포함), Edge10/10·DB재확인14/14·build·mobile·README24참조,390/1440px 흐름. CI 기본4browser skip은 명시적 로컬 실행으로 보완.
- 한계: 실제 로그인 사용자 계정에서 AI 인사이트 생성은 미검증(임의 계정 가장/쿼터 소비 없음). 출처 소개 부족 시 인사이트 생성 불가/보수적 분류 유지. 상세 근거 docs/tech-feed/daily-briefing-verification.md.
- 기존 장애 복구 문서4개의 미커밋 변경은 이번 기능과 분리 보존. 이후 장애가 서버 때문인지 앱 때문인지 이번 피드 배포만으로 새로 단정하지 않는다.


## 2026-09-15 — 기술 피드 서버 적용·최종 리뷰 완료

- 전체 변경 독립 리뷰 승인(중요 지적 없음), 로컬685/685·Edge10/10·build·mobile·README 검사 통과. 마이그레이션 파일명 동기화 후 DB14/14 재확인.
- Supabase migration20260914164719 적용, tech-feed v20 / tech-feed-worker v22 ACTIVE, JWT검증 유지. 새 cron이나 인증/출석/타이머 변경 없음.
- 운영 RLS/직접 본문 SELECT 차단/service RPC 권한 및 기존5인자 list 호출 확인. 실제 읽기 실행 list11.915ms/saved facets4.358ms/daily cold836.367ms, 무인증 API401.
- 기존65개 글 모두 rules_version1 백필 완료: 사례·심층7, 실무15, 소식1, 근거 부족42개는 억지 분류하지 않고 미분류 배지를 숨김. 수집 주기 정상 완료 확인.
- 다음: 이 기능만 커밋·푸시하여 웹 배포 검증. 기존 장애 복구 미커밋 문서는 별도 보존. 실제 로그인 사용자 AI생성은 미검증.

## 2026-09-15 — 기술 피드 개선 로컬 구현·검증 완료

- 현재 작업: 보수적 분류/짧은 태그, 안전한 Markdown 읽기, 자유 입력 중심 설정과 전체 동적 필터, 오늘 전체 통계·명시적 AI 인사이트. 관련 PRD: prd-tech-feed.md; 설계/검증: docs/tech-feed/daily-briefing-*.md.
- 최근 결정: 같은 날 창 복귀에도 읽기 전용 통계 확인, focus/visibility 중복 합침. AI 생성 중에는 중단하지 않고 완료 후 한 번 재조회. 추가 비용은 복귀 시 API/DB 읽기이며 AI 호출은 없다.
- 완료: 공통/서버/UI 단계별 독립 검토와 UI2개 회귀 수정. 전체685/685(실제 mounted browser4개 포함), Edge10/10+타입, 모바일 호환/타입, 웹 build, README24경로 검사 통과.390/1440px 가독성·긴 코드·필터/저장·캐시/오류·계정 전환 확인.
- 진행 중: 최종 전체 변경 리뷰와 운영 DB→Edge→웹 배포. 아직 새 기능의 운영 배포 완료를 뜻하지 않는다.
- 주의: 브라우저 lifecycle4개는 설치된 Playwright를 명시해 로컬 검증; 기본CI는 runtime 없으면4skip을 표시한다. 실제 사용자 계정/provider생성은 별도. 기존 장애 기록은 분리 보존한다.


## 2026-09-15 — 기술 피드 콘텐츠 모델 완료, 서버 구현 중

- 공용 분류·주제 태그와 안전한 Markdown AST/260자 미리보기 구현. 기존 AI 분류 우선, 보수적 null fallback, 실제 문구와 일치하는 짧은 태그를 제공한다.
- 독립 검토에서 발견한 AST 한도 이후 tail 유실, preview 기호 잔존, 코드 리터럴 변조, 코드가 포함된 외부 Markdown 조합을 모두 수정했다. 최종 focused19/19 직접 재실행 및 scoped review 중요 지적 없음.
- 서버 담당은 가시성 공통화, 기존 글 분류 백필, 전체 facets, 서버 시간대 일일 통계와 명시적 AI 브리핑을 구현 중이다. 운영 변경은 아직 없다.
- parent는 output/playwright의 격리 React fixture를 준비했다.32개 글/2개 계정/페이지 밖 Rust 주제/캐시/AI 호출 카운터를 사용하며 실제 서버·AI 연결 없음. 기존 화면20개 카드, 브라우저 오류0, providerCalls0 확인. 새 UI의 E2E 완료를 뜻하지 않는다.


## 2026-09-14 — 기술 피드 브리핑 구현 시작

- 최신 사용자 지시 "구현해줘"로 상세 설계 승인. `docs/tech-feed/daily-briefing-implementation.md`에 순수 콘텐츠 모델 → 서버 집계/권한/캐시 → React UI → 검증/배포 순서 기록.
- 격리 worktree `codex/recovery-consistency`, 기준 `f288887`; 기존 626개 테스트 통과. 분류/Markdown 모델부터 실패 테스트 작성 후 구현 중.
- AI 입력은 기존 공용 클라이언트의 전체 32000자 제한 안에서 대표 표본을 구성한다. 글당 2000자와 최대24개는 상한이며 전체 직렬화 입력도 제한한다.
- 제품 운영 DB/함수/웹은 아직 변경하지 않았다. 기존 장애 복구 문서와 출력 파일을 보존하며 단계별 검토 후 배포한다.


## 2026-09-14 — 기술 피드 브리핑 상세 설계

- 사용자 진행 승인으로 분류/오늘 브리핑/본문/관심 UI4개 개선 방향 확정.
- docs/tech-feed/daily-briefing-design.md 작성 및 prd-tech-feed 개정. 기존 구현에서 category와 요약 결합, 줄바꿈 손실, 고정 관심 필터, 서버 discovered_at/사용자 가시성 경로 확인.
- 통계 자동/AI버튼 생성, 개인 스냅샷 캐시와 공유6회 예산, 전체 통계와 최대24개 AI근거 표본 분리, dynamic태그/접힌필터, 기존 데이터 보존 설계.
- 상태: 상세 설계 자체 검토 완료, 사용자 상세 문서 검토 후 실행 계획 및 TDD 구현. 브레인스토밍 architectural 경로의 문서 검토 단계에서 멈춤. 제품 코드/DB/운영 설정 변경·커밋·배포 없음.
- 이전 Supabase 복구 진단4개 문서의 미커밋 기록과 output/.playwright-cli를 보존했다. 이번 문서와 이전 운영 기록을 혼동하지 않는다.


## 2026-09-14 — 승인된 Supabase 재시작 및 응답 복구

- 사용자 승인으로 공식 POST /v1/projects/bqohkdzvxbrokkmuhysx/restart 1회 실행. 2026-09-14T14:03:47Z HTTP200, RESTARTING 관측, DB 실제 기동14:07:45Z,14:08:02Z 프로젝트와Auth ACTIVE_HEALTHY.
- 재시작 직전 SELECT now()/pg_postmaster_start_time도 connection timeout. 이후 SQL 성공(세션112/회복131건), 공개 Auth health200(0.929초), profiles/recovery/sessions limit0 REST 모두200(0.210/0.114/0.126초).
- 공식 metrics와disk/util 조회도200으로 회복. 재시작 후 디스크 사용731873280/2077073408 bytes, 가용1345200128 bytes. 이 사후 값만으로 장애 당시 CPU/메모리/I/O 하위원인을 확정하지 않음.
- 출석/기술피드 cron14:08UTC 실행 succeeded 확인(HTTP 전송 예약의 성공이며 실제 알림 전달 전체 성공을 뜻하지 않음). 비활성 커리어cron 유지.
- 데이터 삭제/복원/스키마·RLS·키·요금제·cron 설정/제품 코드 변경 없음. 운영 재시작만 수행, 웹 재배포 없음. 실제 사용자 저장 로그인과 화면 E2E 및 장기 재발 여부는 미검증.
- 다음: 웹의 학습 정보 다시 확인으로 실제 계정 화면 재확인. 재발 시 복구된 지표에서 장애 시간대 자원을 확보하고 원인 진단; 재시작 성공을 영구 원인 해결로 표현하지 않음.


## 2026-09-14 — 학습 정보 timeout 운영 재진단 (미해결)

- 사용자 화면의15초 timeout은 이전 패치의 안전장치이며 서버 가용성 복구가 아님. 최초 학습 정보 확인 실패로 시작 버튼이 안전하게 차단된 상태.
- 운영 공개 Auth health200에도0.37~8.85초 편차, REST profiles limit0도1.25~7.53초 및12초 timeout. DNS/TCP/TLS는 빠르고 최초응답 지연이 관측됨. IPv4 원인으로 단정하지 않음.
- Management health(auth) healthy=false/UNHEALTHY, 오류 Failed to retrieve project's auth service health. metrics 및 disk/util도 조회 실패. MCP 진단 요청1건504. 정확한 CPU/메모리/I/O 원인은 미확정.
- DB 스냅샷에서 별도 장기 실행 쿼리/lock wait 없음. cron.job_run_details371MB/net._http_response110MB 및 누적 pg_net cleanup 비용은 정리 후보이지 현재 장애의 확정 원인이 아님.
- 활성 cron은 출석/기술피드 각 매분, 과거 커리어2개는 비활성. 운영 데이터/설정/코드 변경, 삭제, 재시작, 유료 업그레이드 없음. 다음: 짧은 운영 중단을 수반하는 프로젝트 재시작 승인 후 상태/조회 재검증 또는 Supabase 지원 진단.


## 2026-09-14 — 회복루틴 잠금 수정 운영 배포 완료

- 코드9eff7ccd503a4f28181636108971c10e8f91a450 main 푸시, Actions34850127211 success. 서버 CI 테스트/모바일/README/Edge/빌드/배포 모두 성공.
- Vercel dpl_DtYX9kx2ZM8AYimfgLQnhVvtvXJ3 production READY, study-room-attendance.vercel.app alias 정상. 운영 root 및 /assets/index-DBTh0ZXp.js HTTP200; 회복폼 연결/재조회/RequestTimeoutError 코드 포함 확인.
- 최종626개 테스트 통과, 독립 재리뷰 중요 지적 없음. 로컬 가상 응답의 저장직후 해제/배경지연/입력보존/응답유실 재확인 및390/1440px 검증 성공. 실제 사용자 저장세션의 운영 E2E는 미검증.
- DB/서버함수/cron 변경 없음. 서버 가용성 자체 개선과 UI 대기 복구를 구분. 운영 DB 후속 조회는 성공했으나 원래 지연의 자원/네트워크 하위원인은 미확정.
- 검증용 브라우저/서버 종료. output/.playwright-cli는 커밋 제외. 배포 완료 문서만 [skip ci] 후속 반영.


## 2026-09-14 — 최종 리뷰 및 검증 완료

- 독립 리뷰의 P2 2건(세션 시작 전 조회가 새 세션을 덮는 경합, 이전 계정 시작 실패가 새 계정 상태를 오염)을 수정. 시작 mutation 전 조회 취소/버전 무효화, RPC 중 조회 억제, 계정별 시작 요청 abort/결과 가드 적용.
- 실제 startTimer를 실행하는 startRequestIsolation 회귀2건 RED→GREEN. 독립 재검토 중요 지적 없음, 전체626/626 및 웹빌드 통과. 기존 모바일/README 검사와390/1440 브라우저 검증 통과.
- 회복 RPC 응답 유실 시 입력 유지·저장 성공 단정 금지·재조회로 committed 상태 반영 후 모달 해제까지 확인. 운영 DB/함수/cron 변경 없음.
- 웹 배포를 위해 변경 코드·테스트·관련 진단문서만 커밋/푸시. output 및 브라우저 임시파일은 제외. 실제 배포 결과는 후속 기록.


## 2026-09-14 — 회복루틴 제출 후 시작 잠금 수정

- 사용자 수정 승인. dashboardData 전체 조회·회복 제출·세션 시작에 15초 제한과 AbortSignal 적용. SDK 인증 대기 등 signal 미관찰 단계도 Promise.race로 UI 대기를 종료.
- 조회 loading과 mutation busy 분리. 저장 성공 후 제출 상태를 즉시 반영하고 배경 재조회가 시작 버튼을 잠그지 않음. 최초 미조회는 시작을 안전하게 막고 로딩/오류/재시도와 확인 필요 표시.
- 최신 조회·계정 가드로 취소/늦은 응답의 상태 덮어쓰기 방지. 계정 변경 시 회복·세션·할 일·목표·프로필 초기화. pending 시작 액션은 비활성 대신 회복폼으로 연결하며 실제 세션 차단은 유지.
- 회복 저장 응답 실패 시 입력과 오류 유지, 재조회로 서버에서 이미 제출된 상태를 확인하면 모달 해제. 세션 시작 결과 불명 시 재확인 전 중복 시작 차단.
- 검증: 신규 4건 RED→GREEN, 전체624 통과, 웹빌드·모바일·README 검사 통과. 격리 브라우저 지연→오류→재시도→회복 저장→배경지연에도 시작 활성→카메라 단계,390/1440 overflow0/runtime0 확인.
- 운영 DB는 후속 읽기 재점검에서 응답 회복. 자원고갈 여부/실제 사용자 브라우저 요청 하위원인은 확정하지 않음. 제품 패치는 서버 장애 자체를 해결한다고 주장하지 않음.
- 배포: 필수 독립 리뷰 및 GitHub Actions production 반영 대기. DB/함수/cron/키 변경 없음.


## 2026-09-14 — 회복루틴 제출 후 시작 비활성화 진단

- 진단만 수행. 시작 버튼은 busy 또는 pending recovery로 차단. 제출 성공 시 submitted 로컬 반영 후 loadDashboard 재조회가 busy=true로 전체 8종 조회를 기다림.
- dashboardData.ts Promise.all/페이지 조회에 제한시간이 없어 미완료 요청이 있으면 finally의 busy 해제에 도달하지 않음. 최초 조회 미완료라면 회복 목록과 공부시간도 초기 빈 상태일 수 있음.
- 운영 MCP 회복 상태 집계 및 select now() 모두 연결 timeout. 공개키 Auth health도 15초 timeout. ACTIVE_HEALTHY 상태와 앞선 21:50 정상 결과만으로 현재 정상 단정 불가.
- 실제 제출 상태와 사용자 브라우저 대기 요청은 미확인. 서버 지연+무기한 로딩 경로 유력, 자원고갈 등 하위 원인 미확정. 0초를 데이터 소실로 해석하지 않음.
- 다음: DB 복구 후 제출 상태 및 브라우저 요청 확인. 승인 후 제한시간/재시도/로딩·오류 표시와 회복 제출 후 전체 재조회 잠금 분리 검토. 제품/운영/세션 변경 없음.


## 2026-09-14 21:50 JST — 로그인 인증 불가 읽기 진단

- 사용자 인증 불가 확인 요청. 제품코드/운영/세션 변경 없음.
- 현재 운영웹200, 공개publishable키로 Auth health200(약1.75초)/settings200(약1.29초), Google/email 활성. DB active1/lock wait0, Vercel최근1시간오류0.
- 새 Playwright 프로필의 로그인화면 정상/console0. 실제 저장세션 복구·OTP/OAuth 성공은 미검증. 최근 미디어배포에서 인증초기화/설정코드 변경없음.
- Auth/edge로그와 audit24시간집계는 빈결과, 장애없음의 확정근거로 사용하지 않음.
- CUA sandbox 시작실패로 사용자 기존브라우저 상태는 읽지 못함. 정확한화면문구/스크린샷 요청 중. 현재원인미확정, 일시지연/세션갱신/브라우저잠금 등을 추정해 수정하지 않음.


## 2026-09-14 — 피드 미디어 최종 배포 완료

- 사용자 요청 구현·배포 완료. 기능80555d8 + Edge 호환성5946f98 main 반영.
- 최종 Actions34768906400 success, Vercel dpl_4k2TKx7giQ4jsqxMooyjR1RPzHxs production READY/기존 도메인 alias 정상.
- 운영 웹HTTP200, index-C2Kk5TNN.js→TechFeedSection-BFzqhK4x.js/CVm6jngp.css에 미디어 표시 코드 확인. 무인증 피드API401.
- DB20260913162410, APIv19/workerv21 ACTIVE·JWTtrue. 실제 개인목록 SQL 반환의 이미지·영상 필드와 정기수집 연속completed 확인.
- 전체620개/Edge9개/웹빌드/모바일/README검사/390·1440px UI 통과.16:30:30UTC 이후 짧은관찰의 Supabase 오류로그 및 Vercel runtime오류0.
- 기존 글도 최대3개씩 점진적으로 미디어 보강. 외부 사이트 이미지/임베드 제한은 텍스트·원문으로 복구. 로그인된 운영 UI와 모든 제공자의 실제영상재생은 별도 미검증.
- 임시 브라우저/로컬서버 종료. 완료기록만 [skip ci] 추가 푸시하며 output/.playwright-cli는 제외. 아래 진행/대기기록은 이전이력.


## 2026-09-14 — 미디어 운영 수집 복구 확인

- 최초 웹80555d8 배포 성공(Actions34768586596, Vercel dpl_4HdauodMr5XhWhdGfYJFKbt8fbBx READY).
- 운영의 Buffer 전역 누락을 로그로 확인, 명시 import 및 Deno subprocess 회귀 추가. APIv19/workerv21 재배포 완료.
- 정기16:30/16:31UTC 연속정상완료, 원문 NEXT IAS/AI Business 대표이미지 및 기존 YouTube영상ID cache ready. 실제 기사 메타데이터 저장 검증 완료.
- 다음: 호환성 코드/원인기록 후속커밋과 최종웹 CI 완료, 운영HTTP/자산 확인. 아래 서버반영초기기록은 이전버전임.


## 2026-09-14 — 미디어 서버 반영, 웹 배포 진행

- DB migration20260913162410 적용, 로컬파일명 동기화·PGlite 재검증 통과.
- APIv18/workerv20 ACTIVE·JWTtrue. 운영 RLS/권한 확인 및 정기 실행의 영상 캐시 ready 확인.
- 최종620개 테스트,Edge8개,웹빌드,모바일·문서검사 통과. 미디어 버튼 위치 충돌 수정 후390/1440 실제 UI 검증 통과.
- 다음: 명시 범위 커밋/main 푸시, GitHub Actions/Vercel READY, 실제 대표 이미지 캐시 및 배포 자산 확인.


## 2026-09-14 — 피드 미디어 구현·배포 준비

- 현재 작업: 승인된 원문 썸네일/영상 표시 구현 완료, 운영 반영 전 최종 검증 중. 아래 설계 대기는 이전 이력.
- 관련 PRD: prd-tech-feed.md. 핵심 파일: feedMedia.mjs, tech-feed-media.mjs/SQL, FeedArticleMedia.tsx, worker/store/refresh.
- 완료: 안전한 원문 메타데이터·공용 캐시·API·이미지/클릭영상 UI. 독립 리뷰 P1/P2 없음. 전체619개/Edge8개/웹/모바일/문서 검사 통과 후 직접 영상 링크 테스트1개 추가 통과.
- 브라우저:390/1440px 이미지 표시·실패 시 원문 유지·클릭 전 iframe없음·닫기·autoplay0·오버플로0·runtime error0. 제공자 재생은 격리된 로컬 fixture로 확인했으며 실제 모든 영상 재생을 보장하지 않음.
- 다음: 최종620개 재검증, DB → 두 Edge Function → main/웹 배포 및 운영 캐시/HTTP 확인.
- 주의: 미디어 없는 글/접근 차단 사이트는 텍스트 유지. 기존 글은 최대3개씩 순차 반영. 출석/타이머/무료예산/기존 수집정책 불변.


## 2026-09-14 — 피드 썸네일·영상 표시 설계 확인

- 사용자: 피드 내용에 사진/썸네일 또는 영상이 있으면 보이도록 요청.
- 확인: FeedArticle 타입과 RSS/검색 어댑터에 미디어 필드 없음, 검색 include_images:false. UI만 변경해서는 실제 미디어가 제공되지 않음.
- 제안: 원문에 연결된 대표 이미지1개, 글에 연결된 허용 제공자 영상은 클릭 후 재생/자동재생없음, 차단/없음/오류는 텍스트와원문링크 유지. 출처 메타데이터만 제한적으로 확인하고 AI사진/무관한 검색사진/유료API 추가 없음.
- 기술 블로그 중심 수집과 별개로 글에 딸린 미디어 표시를 추가하는 짧은 설계 확인 단계. 기존 영상 도메인 제외 규칙을 임의 해제하거나 일반영상 수집으로 확장하지 않음.
- 제품코드/DB/배포 변경 없음. 사용자 설계 승인 후 PRD·수집/저장/API/카드·보안/모바일검증 반영 예정.


## 2026-09-14 — 기술 블로그 피드 배포 완료

- 기능 커밋 f520c2f513848b464860b8a20545a7dd79bc6b36 main 푸시. Actions34766565479 성공(1분58초), Vercel dpl_7DoZZV5fwKzE3oR7eaEiDjcy7Ykw production READY, 기존 도메인 alias 정상.
- 운영 https://study-room-attendance.vercel.app HTTP200. /assets/index-9rg1pVMN.js→TechFeedSection-BxhJ9q6y.js 및 피드CSS HTTP200, 출처링크/영상안내/Pretendard 포함 확인.
- 서버 tech-feed v17 / worker v19 ACTIVE·JWT true, 무인증 POST401. 배포 후 정기 실행15:45~15:46UTC completed/오류null. 이번 관찰에서 신규수집0건으로 새 기술글 실제 도착 검증을 주장하지 않는다.
- 전체609/609·Edge8/8·웹빌드 및 CI 모바일/문서/Edge/웹/배포 통과. Vercel15:47UTC 이후 짧은 오류조회0건, 로그인 사용자 조작은 로컬 검증 외 운영에서 별도 확인 필요.
- 현재 작업 배포 완료. 아래 배포 전/진행 기록은 이전 이력. README3개 언어판/코드/회귀 테스트 함께 반영. 완료기록 docs-only [skip ci]로 추가 푸시.


## 2026-09-14 — 기술 블로그 피드 운영 배포 진행

- 사용자 "배포해줘"로 필요한 커밋·main푸시·서버/웹 운영 반영 승인.
- 배포 직전 전체609/609·Edge8/8·웹빌드 재검증 통과. 원격main a279b59와 작업 기준 일치.
- CLI2.117.0 --use-api로 tech-feed v17 / tech-feed-worker v19 ACTIVE, verify_jwt=true 유지 확인. 공용 feedContent 모듈 업로드 포함.
- 다음: GitHub Actions 웹 배포 READY·운영HTTP/자산·수집 상태 확인. 아래 배포 전 기록은 이전 이력.


# Active Context — 2026-09-14 기술 블로그 피드 품질 개선

## 현재 작업

- 작업명: 일반 기술 블로그 중심 수집과 가독성·출처 개선.
- 관련 PRD: prd-tech-feed.md 최신 승인 개정. AWS/Claude 등은 예시이며 고정 대상이 아니다.
- 관련 파일: tech-feed-query/search/core, packages/core/src/feedContent, TechFeedSection/techFeed.css 및 테스트.

## 최근 결정 사항

- 모든 관심 기술에 블로그/사례/가이드 의도를 순환 적용. 최근1년 검색, 기본검색1회·5결과 유지.
- 영상/명백한 목록만 신규 수집 제외, query permalink/기술 타임라인/실제 문단 보존. 기존 영상은 링크·저장·할일 기록 유지.
- 피드 한글 웹폰트, 본문16/17px, 소개 곁 출처 링크. 공유 모듈은 순수 코드이며 DB/권한/예산 변경 없음.

## 현재 상태

- 완료: 구현·통합 회귀, 390px/1440px 실제 브라우저 가로넘침0·폰트로드·출처44px 확인, 페이지/저장/필터/계정 전환 검증.
- 검증 완료: 전체609/609·Edge8/8·웹빌드·모바일호환·README24개자산·diff검사 통과. 독립 재검토 Important3건 재현/수정 후 추가발견 없음.
- 다음 작업: 별도 운영 배포 승인 후 두 Edge 함수와 웹 반영 및 실제 검색 결과 확인. 현재 변경은 로컬이며 운영 수집 내용 변경을 주장하지 않는다.

## 주의할 점

- 전체 본문 크롤링/새 RSS 승인/유료 전환/예산확대 없음. 제공된 소개가 부족하면 원문 확인 안내.
- CDN 차단 시 시스템 고딕 fallback. output/.playwright-cli는 로컬 검증 자료이며 커밋 대상 아님.
- 아래 승인 대기 진단은 이번 사용자 진행 승인으로 대체된 이력이다.


## 2026-09-14 — 피드 가독성·출처·수집 품질 진단

- 사용자: 폰트 가독성, 본문 옆 발췌 링크, 타임스탬프/목차 오염 제거, 뉴스 외 AWS 기업 아키텍처 사례·기술 해설·Claude Code 스킬 활용·기술블로그 수집 요청.
- 확인: 운영 Bloomberg 글 URL은 YouTube, 검색 소개에 구독 홍보/방송 시간표 포함, DeepL 그대로 번역ready/AI요약pending. 서버에서 텍스트 태그 제거만 하며 콘텐츠 품질 필터 없음.
- 코드: 복합 관심 검색문에 technology news 추가, Tavily time_range:week 고정. UI 시스템폰트 상속, 본문15/모바일14px, 출처10px 일반텍스트/원문링크는카드아래. 추천RSS8개 여전히permission pending.
- 제안: 한글 고딕·크기/대비 개선, 본문 옆 출처링크, 영상/색인/홍보성 설명 필터와 정제, 관심별 뉴스/기업사례/해설/도구활용 순환검색. 무료횟수/RSS승인/자동설치금지 유지.
- 상태: 읽기 진단만 완료, 짧은 설계 승인 전 제품코드·DB·배포 변경 없음. 이번 기록은 로컬 문서만 갱신.

## 2026-09-14 — 번역·페이지형 피드 운영 배포 완료

- main 기능 커밋 b4ed456be0da96ad40f6a9a99367d8e96bc8e6d1 푸시 완료. Actions34764366095 성공(1m45s), Vercel dpl_FCNMA6k5hHrybKEsnT3QrteMeLGr READY/production, 기존URL alias 정상.
- https://study-room-attendance.vercel.app HTTP200, 운영assets/index-zZ8T5yA9.js→TechFeedSection-DG7DTGKY.js HTTP200, 실제 피드chunk에서 페이지/한국어title_ko/펼치기 확인.15:03:30UTC 이후 짧은 오류조회0건.
- 배포 전 전체600/600·Edge8/8·웹빌드 통과 및 CI 테스트/모바일/README/Edge/빌드/배포 모두 성공. 기존 번역 DB·서버/Cron은 재적용하지 않음.
- 아래 로컬완료/승인대기 기록은 이전 이력이다. 사용자 배포 요청 후 필요한 Git+기존 배포 경로가 승인되어 실행됐다. 임시output/.playwright-cli는 제외.
- 운영 로그인 계정으로 새UI 조작은 별도 미검증(로컬 실제 Chromium 시나리오 검증은 완료). 런타임 오류0은 배포 직후 관찰 범위이며 장기간 무오류 보장은 아님.

## 2026-09-14 — 번역·페이지형 피드 웹 배포 진행

- 사용자가 로컬 구현 완료 보고 후 "배포해줘" 요청. 기존 GitHub Actions main 배포 경로로 한국어 번역 UI와 SNS형 페이지 피드를 함께 반영한다.
- 배포 전 전체600/600·웹빌드·Edge8/8/진입점 타입 검사 통과. 원격main은1d38625로 작업 기준과 일치, 임시output/.playwright-cli는 배포 커밋에서 제외.
- 이전 번역 DB/함수는 이미 적용되어 이번 요청에서 재적용하지 않는다. 실제 Git/Actions/Vercel 결과는 후속 완료 기록으로 확정한다.

## 2026-09-13 — 페이지형 기술 피드 UI 로컬 완료

- 사용자 승인한20개 페이지 전환·Threads형 읽기 UI 구현. 중앙 한 열, 출처 배지/주제 태그, 한국어 소개·AI/원문 펼치기, 관심/수집 설정 접기. 기존 번역 변경 보존, DB·함수·Cron·무료 한도 변경 없음.
- 기존 커서와 방문 페이지 번호(최대5개)를 사용한다. 전체 페이지 수는 추정하지 않으며 이전 페이지는 캐시로 복귀. 필터·계정·새 글 확인 시1페이지 초기화.
- 저장 해제 시 캐시 슬롯을 보존해 미열람 글 건너뛰기 방지. 빈 페이지도 다음 커서 탐색 유지, 마지막 빈 저장 페이지는 이전 페이지로 보정.
- 전체600/600·웹 빌드·모바일·README·diff 검사 통과. 실제 Chromium390px 가로넘침0/20카드, PC1440px/콘솔 오류0. 예시 API+실제 컴포넌트로 페이지/필터/오류/계정/펼치기/저장/할일 검증, 독립 재검토 승인.
- 커밋·푸시·웹배포는 이전 승인 거부 및 별도 승인 대기 유지. 운영 계정의 새UI 검증은 배포 후 필요. output/playwright/feed-ui-mobile.png, feed-ui-desktop.png는 로컬 예시 화면이다.

## 2026-09-13 — 번역 서버 가동 완료 / Git·웹 배포 승인 대기

- 최종 운영: DB20260913140137, tech-feed v16/worker v18 ACTIVE·JWT true. 원문7건 모두 한국어 번역 ready, POST3회/7259자. 샘플 제목·소개 한국어 및 source snapshot일치7건 확인. 출석/피드 Cron 유지.
- 웹 배포를 위한 git commit+push main 명령은 승인 시스템이 별도 Git 승인이 없다고 거부. 전체 셸 실행 전 거부라 stage/commit/push 모두 미실행, HEAD1d38625 그대로 확인. 다른 배포 경로로 우회하지 않았다.
- 현재 웹은 기존 버전이며 새 한국어 기본표시 UI는 아직 미반영. 사용자에게 변경사항 커밋·main푸시·Vercel웹배포 승인을 요청해야 한다. 서버 번역 데이터는 보존된다.
- 로컬 전체591/591·Edge8/8·웹/모바일/README·독립 검토 통과. 관련 docs/tech-feed/korean-translation.md. 아래 웹배포 진행은 거부 전 상태다.

## 2026-09-13 — 실제 DeepL 번역 성공 / 웹 배포 진행

- 사용자 명시적 운영 배포 승인에 따라 DB20260913140137 및 서버 적용. 키 등록·Free 고정 연결 확인.14:17UTC 일반Cron 번역3건 ready/잔여4건 pending, 실제POST1회/3007자 차감 확인.
- 원인 해결: usage.character_limit>500000을 오류로 간주하던 자체 검증. 실제 고정 Free endpoint가 큰 상한을 반환함을 안전code로 확인하고 min(500000,provider_limit)으로 계산하도록 수정. 앱월450000·무료키·Pro필드차단·유료fallback금지 불변.
- 사전확인 실패로 POST가 없던7건(attempts0/lease없음)만 정상 재시도로 복구; 무료예산 환급/삭제 없음. 신규endpoint/비밀값노출 없음.
- 최종 Node591/591·Edge8/8·웹/모바일/README 및 독립 재검토 통과. 다음은 Gitmain 웹배포 READY/HTTP확인과 최종 기록이다. 아래 미연결/오류 기록은 해결 전 이력.

## 2026-09-13 — 사용자 배포 승인 / DB·서버 적용, DeepL 진단

- 사용자 키 저장 확인 후 운영 DB+서버+웹 배포 질문에 "진행해줘"로 명시 승인. 아래 승인 대기/키 없음 기록은 이전 이력이다.
- DB20260913140137 적용, 번역3테이블 RLS/브라우저 SELECT·RPC EXECUTE 차단 확인. 로컬 migration명도 원격과 정합화. 출석/피드 Cron 기존 설정 유지.
- 키 등록은 CLI로 이름 존재만 확인(값 미노출). 서버 배포 후 실제Cron usage 사전확인 단계에서 unavailable/usage_invalid_limit 발생. POST0·차감0, 원문7기사 보존. 무료조건을 완화하지 않고 고정 안전코드로 세부 원인을 수집 중.
- 전체590/590·Edge8/8·웹/모바일/문서 검사 통과. 진단 코드 독립 검토 승인. 웹 배포 및 실제 번역 성공 확인은 진행 중이다.

## 2026-09-13 — 번역 로컬 검증 완료 / 운영 적용 승인 대기

- 완료: DeepL Free 번역 구현, 전체 Node589/589·Edge8/8·웹 빌드·모바일·README 검증, 독립 검토 승인. 수신중지 경쟁이 전역 한도 차단으로 오인되던 결함 수정 및 실SQL+worker 회귀 추가.
- 차단: Supabase apply_migration 승인 시스템이 production DB/RLS/function 변경에는 별도 배포 요청이 필요하다고 거부. 도구/CLI 우회 없이 중단했고 list_migrations로 미적용 확인. 서버/웹 배포, 커밋/푸시도 하지 않았다.
- 다음: 사용자에게 운영 DB 변경+서버/웹 배포 승인을 요청한다. 승인 후 정확한 새 migration만 적용→API/worker→웹 검증. DEEPL_API_KEY는 별도 서버 등록 필요하며 실제 번역은 아직 미검증.
- 아래 배포 검증 진행 문구는 시도 전 기록이다. 현재 모든 변경은 이 worktree 로컬에만 있다.

## 2026-09-13 — DeepL 번역 구현 / 배포 검증 진행

- 현재 작업: 사용자 승인한 제목·소개 한국어 번역. 코칭6회 제한과 독립된 Free 문자 예산, 공통 캐시, 원문 접기, 실패 대기 구현.
- 완료: SQL5개·서버/UI 기본7개 및 제공자7개 포함 전체 Node587/587, Edge8/8/entrypoint 타입 검사, 웹 빌드, 모바일 호환성 통과. 독립 코드검토 진행 중.
- 운영 키 확인: DEEPL_API_KEY 없음. 코드 배포 후에도 실제 번역은 연결 준비 중이며 키 발급/등록·실제 공급자 품질 검증은 별도 필요하다. 키를 채팅이나 Git에 저장하지 않는다.
- 관련: prd-tech-feed.md, docs/tech-feed/korean-translation.md, tech-feed-translation 모듈/마이그레이션/TechFeedSection. 다음은 검토 수정→DB→서버→웹 배포 및 상태 확인.

## 2026-09-13 — 번역 별도 예산 승인 / DeepL 제안

- 사용자: 번역과 코칭 한도 분리에 동의, 번역API와 AI 중 추천 요청. 기존 하루6회 번역 적용 제안은 철회하고 PRD에 분리 원칙 반영.
- 공식 조사: DeepL API Free 월500000자(https://developers.deepl.com/docs/resources/usage-limits), 개발자 페이지 카드 없이 시작 안내(https://www.deepl.com/en/developers). OpenRouter 무료 기본50회/일은 공급자 한도이며 앱6회와 다름(https://openrouter.ai/docs/faq). Azure F0 무료량 비교도 조사했으나 아직 공급자 미확정.
- 추천(미구현): 제목/소개는 DeepL API Free, 요약/학습 설명은 기존 AI. 번역 성공공유캐시/별도문자예산/원문보존/실패대기/유료fallback금지. 실제 품질 우열은 기술기사 표본으로 검증해야 함.
- 추가 서비스 선택 및 앱운영용 키 준비 확인 필요. 가입·결제·키발급·외부연결·제품코드·배포 없음. 키를 채팅에 요청하지 말고 서버 secret에 보관.

## 2026-09-13 — 한국어 피드 번역 요청 / 설계 확인 대기

- 사용자: 글이 표시됨을 확인했으나 영어이므로 번역 API/AI로 한국어 제공 가능한지 질문. 기사 도착은 사용자 보고이며 별도 실측은 아님.
- 코드 확인: FeedArticleCard는 title을 원문 출력, summary 없으면 excerpt 원문 출력. summarizeBatch는 한국어 technology/change/usage만 생성하며 제목/소개 번역 저장 경로 없음.
- 제안: 기존 무료 AI 호출에서 한국어 제목·소개를 함께 생성/공유 캐시, 기본 한국어와 접힌 원문 텍스트, 원문 URL 불변. 이미 수집한 글도 대상. 사용자당 기존 하루 실제6회/호출당3개·실패포함/유료전환 금지 유지; 한도/장애 시 원문+번역 대기. 원문 사이트 전체 번역/무단 본문 크롤링 제외.
- brainstorming bounded 설계 확인 대기. 제품 코드/PRD/운영/배포 변경 없음. 승인 시 PRD와 실제 AI 운영 준비부터 확인하고 구현한다.

## 2026-09-13 — 즉시 수집 배포 완료 / 실제 클릭 확인 필요

- 완료: main e9c6bde, Actions34757248807 success, Vercel dpl_5WaKa5rU3Fe1aYgqeyFdW3gDwsqj READY/HTTP200. DB20260913122656, API v12/worker v13 JWT true. Node570/570·Edge8/8·웹/모바일/README·독립검토 통과.
- 검증 한계: 임시 운영 진단 엔드포인트 추가는 승인 시스템 거부, CUA는 ACL 런타임 오류로 시작 실패. 우회하지 않음.12:32UTC articles0/cursor0로 새 코드의 실제 검색 미실행, 일반 Cron3회 정상/캐시 대기 확인.
- 다음: 사용자가 운영 웹 새로고침→새 글 확인을 누른 후 일반 실행 기록/기사 저장을 확인. 클릭마다 새 기사를 보장하지 않음. 상세 docs/tech-feed/immediate-refresh-verification.md. 아래 미구현/배포 대기는 이전 이력.

## 2026-09-13 — 즉시 수집 구현·배포 검증 진행

- 사용자 설계 승인 후 구현: 수동5분 freshness 제거, compound 관심 순환 검색/공유 cursor,0건과 deferred 표시, 실패 실행 기록 코드 수정.
- 로컬 Node570/570·Edge8/8·웹 빌드·모바일·README 통과. 신규 핵심15개 RED→GREEN. 독립 코드검토 및 운영 배포/실제기사 저장 검증 진행 중.
- migration20260913122656_tech_feed_immediate_refresh.sql 운영 적용, API v12/worker v13 ACTIVE·JWT true. 기존 출석/RLS/무료900/provider lease/실패 backoff/사용자 관심 원문 불변. 아래 승인 대기는 이전 이력.

## 2026-09-13 — 매 클릭 즉시 수집 / 설계 승인 대기

- 사용자 요청은 기존 PRD의 계정·주제·출처5분 대기와 충돌. refresh_begin/claim_search/claim_sources freshness가 최근 정기 실행 뒤에도 수동 수집을 생략한다.
- 실측12:15UTC: attempts4/articles0, 마지막 수동12:10:40/검색성공12:10:43. 이전 raw1/accepted0 진단과 함께 검색 품질 개선도 필요하다.
- 제안(미구현): 수동 freshness 제거·활성 lease/실패 backoff/무료900 유지. 구분자로 나눈 관심사를 한 번에 하나씩 순환 검색해 요청당1크레딧 유지. 원래 입력/공유 membership 보존.0건과 미실행 구분.
- brainstorming bounded 승인 게이트로 구현 전 확인 대기. 코드/운영/PRD/커밋/배포 변경 없음. 승인 후 TDD→추가형 migration→독립검토→배포/실제기사 저장 검증.

## 2026-09-13 — 수집 활성화·배포 검증 완료

- 완료: collector true/Cron active, API v11·worker v12/JWT true. main a5ec757, Actions34754299449 success, Vercel dpl_GS3oNd5fHNPhoB34AZdyQrsFjU2W READY/HTTP200. 전체564/564·Edge8/8·웹·모바일·README 통과.
- 실측: 정기·수동경로 검색 각1회 ready, 연속Cron 성공/중복검색0. 기사0건은 제공자 결과가HTTP 목록1개여서 필터 제외된 결과. 유효기사 저장/실제 브라우저 클릭은 미검증이며 도착했다고 보고하지 않는다.
- 다음: 필요하면 관심별 검색 품질 개선. RSS pending/AI 별도. 상세 docs/tech-feed/collection-live-20260913.md. 일회성 진단 삭제; 출석/사용자 입력/안전필터 불변.

## 2026-09-13 — 무료 계정 수집 활성화 진행

- 사용자 승인으로 nullable 무료 한도 처리 개정, 코드/문서 변경, 전체564/564·Edge8/8·웹·모바일·README 및 독립 검토 통과.
- 서버2개 재배포/JWT 유지, 수집true/월900, 피드Cron active. 첫 실검색158523 ready/attempted1/collected0. 결과0 원인과 연속 자동/수동 경로 추가 확인 중.
- 출석Cron/개인 관심 문장/RSS 승인 불변. docs/tech-feed/collection-live-20260913.md 기준으로 이어간다. 아래 중지/설정 대기는 이전 이력이다.

## 2026-09-13 — 인증 수정 운영 배포 완료

- main8690c3d / Actions34753217322 success / Vercel dpl_4yYDA7TjBLkgmJPS7m5vQgNhWqi2 READY / 운영 URL HTTP200. Node560/560·Edge8/8·웹·모바일·README 통과. 실제 검색은 무료 조건 설정 확인 대기로 중지 유지; docs/tech-feed/activation-20260913.md 참고.

## 2026-09-13 — 검색 키 연결 확인 / 무료 한도 설정 대기

- 사용자 키 등록 후 인증200 확인. worker 인증의 전역 Buffer 의존성 오류를 TextEncoder로 수정하고 배포; 최종 목록 worker v10/JWT true. 잘못된 secret401/정상 요청200 검증.
- Tavily Researcher/plan1000/usage0이나 key.limit 및 account.paygo_limit=null. 무료 조건을 추정하지 않고 검색0회/기사0건, collector false/Cron inactive 유지. 사용자에게 키 한도900/종량제 비활성 확인 요청.
- 예약 인증은 Edge/Vault 전용 secret + Vault anon JWT Authorization으로 준비. 출석 Cron 불변. 일회성 usage 진단 함수 삭제 완료.
- 검증 Node560/560, Edge8/8. 변경/다음 작업: docs/tech-feed/activation-20260913.md. 실제 수집 성공/연속 Cron은 아직 아니다.

## 2026-09-13 — 피드 미도착 운영 진단

- 사용자 요청: 피드가 도착하지 않는 원인 확인(수정/운영 활성화 요청 아님).
- 실측: TECH_FEED_ENABLED=false, TAVILY_API_KEY/TECH_FEED_WORKER_SECRET 없음, 피드 Cron inactive, 추천8소스 pending. 수신 동의 계정1개이나 기사/수집 실행/수동 요청 DB 기록 모두0.
- 판단: 사용자 관심 설정은 존재하지만 운영 수집 경로가 아직 가동되지 않았다. 자동1시간/수동 버튼 모두 수집할 수 없는 상태이며 단순 새 글 없음이나5분 제한이 원인이 아니다.
- 다음: 별도 가동 단계에서 앱 전용 무료 키·무료 정책 확인 또는 이용 조건 확인된 RSS 출처 준비, 수집 스위치/예약 인증 활성화 후 실제 수집을 검증한다. 진단 중 코드·설정·DB 데이터·배포 변경 없음.

# Active Context — 2026-09-13 수동 수집

## 현재 작업

- 작업명/목적: 새 글 확인에서 저장 목록만 새로 읽는 대신 외부 소식 수집을 즉시 요청.
- 관련 PRD/파일: prd-tech-feed.md, docs/tech-feed/web-search-spec.md, tech-feed-refresh 모듈/마이그레이션, TechFeedSection.tsx.

## 최근 결정 사항

- 사용자 승인으로 정기1시간 캐시에 수동5분 예외를 추가한다. 무료 한도·주제 공유·실패 백오프와 운영 중지 상태를 유지한다.
- 별도 worker 호출 대신 인증된 사용자 API에서 제한된 수집을 실행한다. 임의 JWT/키/Cron 변경 없음.

## 현재 상태

- 완료: 구현·독립 재검토 승인, 신규26개/전체559개·Edge8개·웹/모바일/README 검증, PC/390px 브라우저 흐름·계정 전환 검증.
- 배포: DB20260912161611, 피드 함수2개 v5 JWT true, main38f1c18, Actions34704876130 success, Vercel dpl_FEhgUzGeoQyuzdM6aSt9UQgwhkdP READY, 운영/새 번들 HTTP200. 배포 직후 오류 로그 없음(짧은 구간).
- 진행 중: 없음(승인된 구현·코드 배포 완료).
- 막힌 부분/다음: 운영 검색 키·소스 승인·collector 준비가 없어 실제 수집은 중지 유지. 배포 결과는 manual-refresh-verification.md에 기록한다.

아래 승인 대기 및 이전 배포 항목은 당시 이력이며 현재 판단을 대체하지 않는다.

## 현재 요청 — 새 글 확인에서 즉시 수집 (2026-09-13, 설계 승인 대기)

- 사용자: 1시간마다 뉴스가 오는지 질문하고 새 글 확인 클릭 시 즉시 찾도록 요청.
- 확인: TechFeedSection.tsx의 버튼은 revision 증가 → state/list 재조회만 수행. 외부 수집 요청 API는 없다. 직전 배포에서 collector false/Cron inactive/검색 키 없음.
- 충돌: docs/tech-feed/web-search-spec.md #6의 같은 주제 시간당1회 및 프론트 새로고침 제공자 호출 금지. 수동 요청 예외로 PRD/명세 개정 필요.
- 제안: 정기1시간 확인 유지 + 인증된 수동 수집 요청/완료 후 목록 갱신, 같은 주제·동일 계정5분 재요청 제한과 실행 중 작업 공유, 기존 월900/무료 검증/AI근거 제한 유지. 키 없음/중지/무료 소진은 구분 표시.
- 현재: 코드·운영 설정 변경 없음. brainstorming bounded 설계 승인 대기. 승인 후 API/DB 원자적 제한/웹 상태와 회귀 검증 구현. 실제 가동에는 운영 키·인증·소스 준비가 별도 필요.

## 현재 상태 — 공개 웹 검색 피드 코드 운영 배포 완료 (2026-09-13)

- 완료: DB20260912150427, tech-feed/worker v4 JWT true, main8a6f48c, Actions34701374352 success, Vercel dpl_5zWa8UdsFgkHZLVwqcFikp92vPx1 READY.
- 확인: 운영 홈페이지/index/기술 피드 번들 HTTP200 및 관심 설정 문구, Node533/533·Edge8/8·웹/모바일/README, 배포 직후 error/fatal 로그 없음(짧은 범위).
- 결정: self_service로 웹 관심 설정 경로 제공. TECH_FEED_ENABLED=false/피드 Cron inactive, 검색 키·AI·worker 인증 미설정. 자동 수집 가동 완료가 아니다. 출석 Cron 유지.
- 다음: 전용 무료 Tavily 키/종량제0·worker 인증·소스 승인 준비 후 실제 로그인 동기화 및 연속 예약 수집 확인. 키를 채팅으로 받지 않는다.
- 상세/변경 파일: docs/tech-feed/deployment-20260913.md. 아래 배포 진행/승인 대기 내용은 이전 시점 기록이다.

## 현재 작업 — 웹 검색 기술 피드 운영 배포 (2026-09-13)

- 사용자 배포 승인에 따라 DB20260912150427 적용 및 피드 함수2개 v4/JWT true 배포 완료. 웹 main 푸시·CI 확인 진행 중.
- self_service 설정으로 일반 계정의 관심 설정 경로를 제공한다. 전역 수집 false/피드 Cron inactive 유지. 검색 키·무료 AI·worker 인증 미설정이며 실제 수집은 아직 아니다.
- Node533/533, Edge10개·8/8, 웹/모바일/README 검증 재통과. 기존 출석 Cron active 유지.
- 상세: docs/tech-feed/deployment-20260913.md. 아래 로컬 완료/승인 대기 기록은 이전 이력이다.

## 웹 검색 기술 피드 — 로컬 구현·검증·최종 검토 완료 (2026-09-12)

- 현재 작업: 관심 내용 기반 공개 웹 검색 피드. 관련 PRD prd-tech-feed.md, 확정 기준 docs/tech-feed/web-search-spec.md.
- 완료: 서버/웹 구현, 작업별 검토, 전체42개 파일 최종 검토, 문서 수정 단일 wave 재검토 승인. 중요 미해결 사항 없음. README3개 언어판·설계·PRD·운영 안내·오류 기록 갱신.
- 검증: 전체 Node533/533, Edge10진입점 타입·8/8, 웹 TypeScript/Vite 빌드, 모바일 호환성/타입, README24참조, 전체 staged diff 검사 통과. PC/390px 합성 브라우저 흐름과 계정·주제 전환 회귀 검증.
- 주의: 기존 Deno punycode 경고는 비차단 후속 관리. 실제 로그인·운영 제공자·연속 예약 실행·hosted 다중 연결 검증은 아직 수행하지 않았다.
- 운영: HEAD7504b59 유지, 커밋·푸시·DB/함수/Cron/웹 배포 없음. 커밋 시 승인 검토에서 명시적 허가를 요구하여 추가 승인을 요청했고, 운영 Tavily 키도 미등록 상태다.
- 다음: 명시적 승인 후 검증된 변경을 DB→함수→웹 순서로 적용. 앱 전용 무료 키/종량제0 설정, collector 인증과 소스 이용 조건 승인 후 실제 수집을 검증한다. 일반 사용자는 별도 API 키/SNS 계정을 연결하지 않는다.
- 인계: worktrees/study-room-recovery-audit의 staged42개 파일과 검토 증거를 보존한다. 아직 병합된 이력이 없으므로 worktree와 .superpowers 작업 기록을 삭제하지 않는다. 상세 docs/tech-feed/web-search-verification.md.

## 웹 검색 추가 — 서버·화면 검토 승인 / 전체 변경 검토 중 (2026-09-12)

- Task1 서버 및 Task2 화면을 각각 독립 검토하고 모든 중요 발견 사항을 해결했다. 화면 검토2차 수정까지 재검토 승인, 보류된 UI 문제 없음.
- 최종 전체533/533(16.46초), Edge10개 타입·8/8 테스트, 웹 타입/빌드, 모바일 호환성/타입, README24참조 검사 통과. 기존 Deno punycode 경고는 남아 있다.
- 수신 재개 후 authoritative 상태 재조회,409/수신과 겹친 관심사 변경 시 새 첫 페이지 로딩, 계정 변경의 pending/failed 상태에서 이전 사용자 설정 차단을 검증했다.
- 이제 전체 변경 최종 검토만 남았다. HEAD7504b59 유지, 운영 DB·함수·Cron·웹 변경 없음. 커밋·푸시·배포 승인 및 운영 Tavily 키 확인은 답변 대기.
- 최종 증거와 남은 운영 조건은 docs/tech-feed/web-search-verification.md를 기준으로 본다. 아래 항목은 단계별 이력이다.

## 웹 검색 추가 — 로컬 통합 검사 통과 / 최종 검토 중 (2026-09-12)

- 관심 설정 화면·서버 구현 완료. 계정 전환의 이전 요청이 새 계정의 오류/로딩 상태를 바꾸지 않도록 요청 세대와 수명을 캡처한다.
- 최종 코드 기준 전체 Node530/530, 웹 TypeScript·Vite 빌드 통과. Edge10개 타입/8개 테스트, 모바일 호환성, README24참조도 통과했다.
- 합성 PC1280x900/모바일390x844에서 입력/시작/변경/중지/재개/409 초안 보존/계정 전환/저장/필터/20→23페이지/할 일 연결 검증. 브라우저 오류0, 가로 넘침 없음.
- 독립 UI 검토와 전체 변경 최종 검토가 남아 있다. 운영 변경·커밋·푸시 없음, 명시적 승인과 운영 검색 키는 답변 대기.
- 세부 증거·운영 미검증 범위: docs/tech-feed/web-search-verification.md. 아래 기록은 이전 단계 이력이다.

## 웹 검색 추가 — 서버 검토 완료 / 화면 구현 중 (2026-09-12)

- 서버14개 파일을 로컬 구현하고 독립 검토2회 수정 후 승인받았다. 실제 검색 태그 누락, 소개 갱신과 RSS 본문 소유 구분을 회귀 테스트로 보완했다.
- 검증: 초기 최종 서버512/512와 Edge8/8, 이후 수정54/54와 마지막 DB17/17. 최종 전체 통합 검증은 UI 완료 후 수행한다.
- 현재 UI 담당 /root/websearch_frontend가 관심 입력·수신 시작/중지·상태/출처 표기를 구현한다. 서버 담당은 claims 유지, root는 memory-bank/README/운영 문서를 담당한다.
- HEAD7504b59 유지. 서버 커밋이 자동 승인 검토에서 거절되어 명시적 커밋·푸시·배포 승인을 사용자에게 비동기로 요청했다. 승인 전 재시도/원격 변경은 하지 않는다.
- Tavily 키 보유 여부도 답변 대기. 코드 검증과 실제 검색 연결은 별개이며 운영 DB·함수·Cron은 이번 요청에서 아직 변경하지 않았다.
- 원장 .superpowers/sdd/web-search-implementation/progress.md에서 Task1 complete/Task2 in progress를 기준으로 이어간다. 재압축 후 서버 작업을 처음부터 반복하지 않는다.

## 웹 검색 포함 맞춤 피드 구현 — 2026-09-12 (최신)

- 최신 요청: 동일 주제 결과 공유, 무료 한도 소진 시 검색만 중지/RSS 유지, 유료 전환 금지, 실제 근거만 AI 요약을 구현.
- 기준: docs/tech-feed/web-search-spec.md, web-search-implementation.md. 앞선 범위 질문은 사용자 답변으로 해소됨.
- 현재: Node489 기준선 통과, 기존 격리 worktree 재사용, 서버 작업→검토→웹 작업→전체 검증/배포 순으로 진행.
- 운영 Tavily 키 미등록 확인. 사용자에게 보유 여부를 비동기로 질문; 키 없이 코드 구현 계속. 비밀값을 채팅/문서에 받지 않는다.
- 상태 원장: .superpowers/sdd/web-search-implementation/progress.md. 미등록 키/인증 등 운영 제약이 남으면 실제 검색 가동 완료로 주장하지 않는다.

## 관심 내용 기반 피드 설계 — 2026-09-12 (최신)

- 사용자 요청: 웹에서 관심 정보를 입력하면 앱이 API/AI를 이용해 소식을 모으고, 외부 계정 연동/API 키 입력/계정별 수동 운영 등록 없이 이용하게 진행.
- 수행: 기존 UI/API/SQL/출시 문서를 확인하고 docs/tech-feed/topic-feed-design.md에 설계 검토안 작성. 코드/DB/운영 설정 변경 없음.
- 제안: 관심 입력·수신 시작/중지·개인 설정 동기화·관련 태그 선별, 출처 선택은 고급 설정. self-service와 서버 중지 스위치를 분리.
- 열린 결정: 첫 버전이 기존 공개 기술 소스에서의 선별인지, 입력 주제의 일반 웹 검색까지인지 확인 필요. 후자는 기존 PRD Non-goals와 다르며 검색 공급자/비용 정책을 함께 개정해야 한다.
- 다음: 수집 범위 확인 → 관련 PRD 확정/구체 구현 계획 → TDD 구현/검증/운영 가동. 화면 배포만으로 가동 완료라 보고하지 않는다.
- 아래 runtime hotfix 기록은 이미 완료된 작업이며 별도다.

## 기술 피드 실행 오류 수정 — 2026-09-12 (최신)

- 사용자 수정·재배포 승인에 따라 XML 파서 import만 수정했다. 조건식 import는 Edge 의존성 그래프에서 빠졌고, literal npm import로 분리하자 포함되었다.
- 서버 tech-feed/worker v2 배포 완료(JWT true 유지). 운영 OPTIONS 500→204, anon JWT POST는 두 함수 내부 인증401로 정상화. import.meta.main은 원인이 아니어서 수정하지 않았다.
- Node489/489, Deno8/8(신규 의존성 그래프 회귀2개 RED→GREEN), Edge10개, 웹/모바일/README 검사 및 독립 검토 통과. Linux CI도 성공.
- 수정 커밋33dd05e main, Actions34690369024 성공, Vercel dpl_GRwDhE6fRroTwPvNzednW96aWBiQ READY/production HTTP200/로그인 화면 확인. 실제 브라우저 CORS POST도 내부401 정상 응답. 해당 배포 짧은 error/fatal 조회 결과 없음.
- TECH_FEED_ENABLED=false/수집 Cron 비활성/소스 검토 대기 유지. 실제 사용자 JWT의 state200/시간대 저장과 파일럿 활성화 검증은 아직 별도 미확인.
- 아래 진단 미해결 기록은 수정 전 이력이다.

# Active Context

## 기술 피드 연결 오류 진단 — 2026-09-12 (최신)

- 사용자 요청은 확인/진단이며 코드 수정·운영 설정 변경은 하지 않았다.
- 운영 tech-feed OPTIONS와 공개 anon JWT로 호출한 tech-feed/worker POST 모두500 WORKER_ERROR (`Function exited due to an error`) 재현. 비활성 state 정상200까지 도달하지 못함.
- UI는 정상 disabled state에 준비 중 안내가 있으나 서버500을 공통 연결 오류로 표시한다. 이전 무인증401은 gateway 응답이라 함수 내부 정상 실행의 증거가 아니었다.
- 내부 예외 상세는 아직 미확인. import.meta.main/Deno.serve 초기화 및 runtime 의존성이 조사 후보. import 방식 로컬 재현은 HTTP 등록0개였으나 이것만으로 운영 원인을 단정하지 않는다(공식 runtime은 main module 로딩 경로도 있음).
- 다음: 실제 Edge 실행 로그 확보 → 초기화/실행 예외 수정 → OPTIONS204와 authenticated state200, 독립 시간대 경로 검증. 피드 활성화/JWT 해제와 이500 문제를 분리한다.

## 운영 배포 완료 — 2026-09-12 (현재 상태)

- 웹 코드6d7ee57 main 푸시, Actions34689621569 성공, Vercel dpl_DhGtsKswX6Tq52B4as6x1bH3Q1zQ READY, production HTTP200/브라우저 로그인 렌더링 확인.
- Supabase schema20260912104353 및 scheduler20260912105541 적용 완료. 로컬 파일명도 원격과 일치. 커리어4개410/Slack 무서명401, 신규2개 JWT 활성401 확인.
- 기존 커리어 Cron2개 중지, 출석 Cron 활성 유지. 기술 피드 Cron 비활성, TECH_FEED_ENABLED=false. 소스8개 permission pending, 서버 AI/worker secret/파일럿 미설정.
- 검증: Node489/489, Deno6/6, 웹/모바일/README 검사 및 CI 전체 성공. Vercel 최근 오류 로그 없음(짧은 관찰 범위). 실제 로그인 후 피드/시간대/기기 동기화는 미검증.
- 다음 작업: 이용 조건 승인, 무료 AI 설정, 신규 worker 인증 설정 별도 승인과 hosted TLS/실사용 검증 후 파일럿 활성화. 코드 배포를 수집 활성화로 해석하지 말 것.
- 상세: `docs/tech-feed/deployment-20260912.md`. 아래 중단/재개/로컬 상태는 이전 단계 기록이다.

## 승인 후 배포 재개 — 2026-09-12 (최신)

- 사용자가 기존5개 함수 verify_jwt=false 유지 재배포를 명시적으로 승인했다. 커리어4개410/Slack 무서명401 확인 완료.
- 신규 tech-feed/worker는 JWT 활성, 피드 비활성 유지. 스키마 로컬 파일명을 원격20260912104353과 일치시켰다.
- Node489/489, Deno6/6 및 웹/모바일/README 검사 재통과. 이제 Git/웹 배포와 마지막 비활성 Cron 등록을 진행한다.
- 아래 승인 대기/로컬 기록은 과거 시점이다. 최종 결과는 `docs/tech-feed/deployment-20260912.md`에 추가 기록한다.

## 배포 진행 상태 — 2026-09-12 (최신)

- 사용자 배포 요청으로 추가 스키마와 신규 tech-feed/worker v1만 운영 적용. 피드 비활성, 신규 JWT 검사 활성 유지.
- 기존5개 함수의 기존 verify_jwt=false 보존 재배포가 자동 보안 검토에서 차단되어 명시적 승인 대기. 웹/커밋/푸시/Cron 변경 미수행.
- 원격 tech_feed migration20260912104353 적용됨. 로컬20260912081621과 같은 SQL이므로 재적용하지 말고 재개 시 파일명/참조 정리.
- 신규 함수401, 웹200, Node489/489, RLS10개/anon 차단 확인. 기존 출석과 운영 웹 그대로.
- 상세 적용/승인 범위/재개 순서: `docs/tech-feed/deployment-20260912.md`. 아래 로컬 구현 당시 상태보다 이 항목이 우선한다.

## 현재 작업 — 2026-09-12

- 작업명: 독서실 2.0 시간별 기술 피드 구현
- 목적: 기술 발견 → 한국어 요약/소개 → 원문 → 공부할 일로 단순화
- 관련 PRD: `prd-tech-feed.md`; 기존 `prd-studyroom-v2.md`는 커리어 보관 기록
- 관련 파일: `apps/web/src/TechFeedSection.tsx`, `supabase/functions/tech-feed*`, `docs/tech-feed/`

## 최근 결정 사항

- 사용자 승인에 따라 커리어 전용 UI/자동 실행 코드를 archive/career-coach로 보관하고 과거 URL은 410 응답으로 전환한다. 데이터/마이그레이션 이력은 보존한다.
- 시간대 저장과 공부 재시작 코칭, 무료 AI·6회 공유 쿼터는 활성 기능으로 유지한다.
- 추천 8개 소스의 이용 조건은 미승인 상태로 시작한다. RSS 응답 확인을 재가공 허가로 간주하지 않는다.
- 운영 적용은 별도 요청 필요. 현재 체크아웃은 `worktrees/study-room-recovery-audit`, 원본 체크아웃의 다른 변경은 건드리지 않는다.

## 현재 상태

- 완료: 피드 UI/할 일 편집 연결/커리어 보관, 수집·RLS·API 구현, 독립 UI/서버/최종 통합 검토 승인 및 로컬 검증
- 현재 상태: 로컬 구현 완료. 전체 Node489/489, Deno6/6, Edge10개 검사, 웹 빌드·모바일 호환성·README 검사 통과. `docs/tech-feed/verification.md` 참조
- 다음 작업: 별도 승인된 운영 출시. 소스 이용 조건, 실제 예약 수집·다른 기기 동기화·운영 DNS/TLS·AI 품질 검증 필요. 커밋·푸시·운영 적용 없음
- 주의: 아래 항목들은 이전 작업의 역사이며 이번 로컬 변경의 배포 완료를 의미하지 않는다.

## 2026-09-06 — Production deployment verified

- Deployed app commit8daa2d40dcc737420581889667cb2d56b63e0705 via GitHub Actions34022526519 (success): https://github.com/zxcc9867/studyRoom/actions/runs/34022526519.
- Vercel deployment dpl_9Fx5ZpVAT8FhVD34BAZw6W4q38Sz is READY; production alias https://study-room-attendance.vercel.app returned HTTP200 and points to that deployment. Build completed2026-09-06T08:42:29Z.
- Backend migrations, five Edge functions, one-owner pilot gate and separate worker/notification cron are active. Latest cron calls200, no failed jobs or coaching deliveries. Existing attendance remains200. Auth/signature rejection401 verified for all five updated functions.
- CI passed470 tests, Edge typechecks and3 pilot tests,24 README asset references and web build. Synthetic live free-coaching check used configured google/gemma-4-26b-a4b-it:free but returned invalid_action; tested rules fallback is required, no paid retry. This is not a successful AI-quality score or proof of the Edge runtime key configuration.
- Remaining user flow: opt into coaching, save career and study windows, verify Google/GitHub Edge Secrets and connect accounts, explicitly enable desired channels and verify real receipt. Thirty actual-model scenarios and two-week pilot outcomes remain pending. Registered OAuth apps alone do not establish runtime configuration or account authorization.
- Updated documents: active-context, progress, trouble-shooting, setup guide and root handoff. Deployment-readiness documents were reviewed; private values/user schedule data were not recorded.
## 2026-09-06 — Approved production backend rollout

- User explicitly approved next-js/bqohkdzvxbrokkmuhysx schema, functions, cron and web deployment after automatic review requested exact scope.
- Applied migrations20260906083030_studyroom_v2_coach and20260906083337_studyroom_v2_coach_cron. Seeded one owner pilot; coaching enabled/channel settings were not changed. Existing attendance cron remains active.
- Deployed career-coach v3, coach-worker v2, coach-integrations v2, coach-notifications v2, slack-recovery-interactions v14. All five reject unsigned/unauthenticated requests with401. Latest scheduled worker and notifier return200 with completed0/failed0 and sent0.
- Initial boot failure was reproduced as the server-only AI guard mistaking Deno1 window for browser. Both free-client copies now check DOM presence; regression added. All Supabase client imports in new handlers aligned to pinned JSR2.57.4. Slack snooze now loads pilot IDs after signature/owner verification.
- Local Node tests470 pass. Security advisors: server-only coach token/state/quota/pilot tables intentionally have RLS with no browser policies; existing unrelated RPC/search-path/Auth warnings remain outside this rollout.
- Web production push/deployment verification is in progress. OAuth secret configuration, real connected accounts/device receipt and live model30-scenario quality evaluation remain unverified; no external alerts sent during verification.
## 2026-09-06 — StudyRoom 2.0 implementation, awaiting remote approval

- Implemented career/skill roadmap editing, automatic recommendations, acceptance with atomic schedule recheck, feedback, life events, profile time-zone picker, optional channel controls and Google/GitHub connection UI.
- Added authenticated Edge handlers, private encrypted OAuth storage, service-only writes and owner RLS, shared free-only six-actual-call budget, versioned leased jobs and guarded integration result writes. Pilot defaults off; channel defaults off.
- Independent backend, frontend, integration and review work ran in separate worktrees. Review fixes include expired-lease writes, OAuth disconnect/reconnect races, repository selection races, bounded streaming, and readable skill/code evidence controls.
- Local verification: Node suite 469 passed; real migration executed in isolated PGlite with 17 database regressions; five Edge entrypoints type checked; three pilot tests passed. Browser synthetic fixtures verified recommendation acceptance, life event add/delete, Tokyo selection, disabled channels and 390px layout. DB-time roundtrip normalization was tested against the real server validator; final web build passed (1703 modules).
- README EN/KO/JA and actual fixture screenshots updated. Root AGENTS.md requires feature explanations/screenshots/model policy for all projects. Setup: docs/studyroom-v2-setup.md.
- NOT DEPLOYED: remote migration on Supabase next-js (bqohkdzvxbrokkmuhysx) was rejected by automatic approval review because that specific remote mutation lacked explicit authorization. A concrete project/migration/functions/cron/web deployment approval question is pending. No new remote DB/function/cron or production web changes were made.
- Google OAuth client and GitHub App are registered per user. Runtime key location is still unconfirmed; registered apps do not prove connected accounts. Supabase CLI is unauthenticated and dashboard opens login. Do not expose keys or assume GitHub Secrets configure Edge runtime.
- Remaining release verification: real OAuth roundtrips/revocation, actual notification receipt on enabled devices/channels, live free-model evaluation of 30 scenarios (80% quality target not measured), production regression and two-week pilot metrics. No external test messages have been sent.
# Active Context

## 2026-08-09 - Timed session planning and production deployment

- The start-study session modal now collects a title plus start/end time for a quick-added task.
- Quick-added session tasks are saved with `study_todos.start_time` and `study_todos.end_time`, selected automatically, and therefore appear in Today's time schedule.
- The default is the next half-hour through one hour later; the learner can edit both values before adding the task.
- Production deployment completed at commit `2c3e3b0`; the production URL returned HTTP 200.
- README now documents the split Today domains and the timed session quick-add flow.
- Session lease controls now say `+1시간 연장` and explain that two hours is a cap on remaining time from the current time.

## 현재 작업

- 작업명: 출석 완료 상태의 정시 알림 정책 구현 및 Supabase 적용
- 작업 목적: 이미 출석인 날에도 설정 시각 초기 알림을 보내고, 해당 상태에서는 재촉이나 결석 전환이 발생하지 않도록 출석 판정과 알림 발송을 분리한다.
- 관련 PRD: `memory-bank/prd-supabase-cron.md`, `memory-bank/prd-slack-notifications.md`, `memory-bank/prd-user-profile.md`
- 관련 파일: `supabase/migrations/20260722133736_send_initial_reminder_when_present.sql`, `supabase/functions/attendance-cron/index.ts`, `packages/core/test/sql-migrations.test.mjs`, `README.md`

## 최근 결정 사항

- 결정: 설정 시각의 초기 알림은 출석 여부와 관계없이 1회 발송하고, 이미 `present`이면 출석 완료 전용 문구를 사용한다.
- 이유: 출석 판정은 학습 기록의 결과이고 설정 알림은 사용자가 요청한 시간 약속이므로 서로 독립적으로 유지해야 한다.
- 대안: 출석 완료 시 모든 알림을 억제하는 기존 정책은 사용자 요청으로 폐기했다.
- 영향 범위: `attendance_days` 알림 claim 열, `get_due_reminders()` 반환 계약, Edge Function 채널별 문구·payload, SQL 회귀 테스트, PRD·README가 변경됐다.

## 현재 상태

- 완료: 초기·재촉 알림 claim 열과 원자적 UPSERT/UPDATE를 포함한 migration을 추가했다.
- 완료: `get_due_reminders()`가 `attendance_already_present`를 반환하고, 이미 출석이면 초기 알림만 1회 claim하며 재촉과 결석에서 제외하도록 변경했다.
- 완료: Slack·Web Push·Expo·Email이 출석 완료 문맥을 전달하고 Slack에는 결석 경고 없는 전용 한국어 문구를 적용했다.
- 완료: Supabase 원격 migration `20260722133736_send_initial_reminder_when_present`와 `attendance-cron` v28을 적용했다.
- 완료: 원격 롤백 시나리오에서 출석 완료와 미출석 흐름, 중복 방지, 최종 상태를 검증했고 전체 331개 테스트와 production build를 통과했다.
- 막힌 부분: 없음.
- 다음 작업: 다음 설정 시각의 실제 Slack `notification_deliveries`가 `sent`로 기록되는지 운영 확인한다.

## 주의할 점

- `initial_reminder_claimed_at`과 `nudge_reminder_claimed_at`은 발송 시도 claim이며 실제 채널 성공 여부는 `notification_deliveries`로 확인한다.
- 이미 출석인 초기 알림에는 출석 마감이나 결석 경고를 표시하지 않는다.
- `present`는 `mark_missed_attendance()`의 `pending` 조건 때문에 결석으로 강등되지 않는다.
- 별도 20:00 계정에서 확인된 Resend 403과 Web Push 오류는 이번 출석 완료 알림 억제 문제와 다른 운영 이슈다.
- 원격 reflection 정책은 아직 user-row ownership만 검사하므로 회고 인박스 UI 배포 전 해당 migration을 먼저 적용한다.
- 작업공간에는 이전 기능의 사용자 변경이 함께 있으므로 관련 없는 파일을 되돌리거나 정리하지 않는다.
- 이번 요청으로 Supabase migration과 Edge Function은 적용했지만 Git 커밋·푸시와 Vercel 배포는 수행하지 않았다.

## 2026-08-04 진단 메모 — 세션 종료·월간 누적 시간

- 원격 DB 확인: 8월 2일 11:56(KST)에 시작한 세션이 8월 4일 22:17(KST)에 종료되며 `58시간 20분 50초`가 완료 시간으로 저장됐다. 해당 세션의 lease는 8월 2일 18:56(KST)에 이미 만료됐다.
- 원인: 웹의 lease 자동 종료는 브라우저가 열려 있을 때만 실행된다. 또한 수동 종료와 회고 종료 경로는 lease 초과 시간을 `p_excluded_seconds`에 포함하지 않고, 현재 서버의 `end_study_session()`도 lease 시각을 상한으로 사용하지 않는다.
- 현재 상태: 8월 4일 22:17(KST)에 새 활성 세션이 시작됐으며 lease 만료 예정은 23:17(KST)이다. 이 세션은 진단 시점에 약 4분 경과했으며, 장기 기록의 원인이 아니다.
- 다음 작업 후보: 서버 종료 RPC에서 `lease_expires_at`을 종료 시각 상한으로 강제하고, 오래 열린 세션을 Cron 또는 재접속 시 안전하게 종료한다. 기존 과대 기록의 보정은 사용자의 별도 승인 후 수행한다.
## 2026-08-04 - 서버 lease 만료 강제 및 과대 기록 보정 완료

## 현재 작업

- 작업명: 세션 lease 만료 서버 강제 및 누적 공부 시간 보정
- 작업 목적: 브라우저 종료·오프라인 상태에서도 lease 이후의 시간이 공부 기록으로 저장되지 않도록 한다.
- 관련 PRD: `memory-bank/prd-session-lease-expiry.md`
- 관련 파일: `supabase/migrations/20260804133546_enforce_session_lease_expiry.sql`, `supabase/functions/attendance-cron/index.ts`, `apps/web/src/main.tsx`

## 최근 결정 사항

- 결정: 수동 종료와 회고 종료를 포함한 `end_study_session`은 `lease_expires_at`을 종료 시각 상한으로 사용한다. 만료된 활성 세션은 기존 1분 Cron이 service-role 전용 `close_expired_study_sessions()` RPC로 최대 100건씩 종료한다.
- 이유: 열린 브라우저에 의존한 자동 종료만으로는 탭을 닫은 세션의 경과 시간이 무제한 저장될 수 있다.
- 대안: 클라이언트에서 초과 시간을 제외하는 방식은 브라우저가 닫히면 실행되지 않아 채택하지 않았다.
- 영향 범위: 세션 종료 시간, paused 시간 제외, 월간/주간 집계, 출석 승격, Slack lease 안내 문구.

## 현재 상태

- 완료: 원격 migration `20260804133546_enforce_session_lease_expiry`, `attendance-cron` Edge Function v29, 과거 과대 세션과 해당 출석 보정.
- 완료: agent/multilingual-readmes 브랜치 푸시 및 Draft PR #1 생성 (https://github.com/zxcc9867/studyRoom/pull/1)
- 진행 중: 없음.
- 막힌 부분: 없음.
- 다음 작업: 실제 만료 시각 이후 Cron 응답의 `expiredSessionCount`를 운영 중 확인한다.

## 주의할 점

- lease는 세션 전체 시간 상한이 아니라 현재 시각 기준의 유지 가능 시간 상한이다. 사용자가 명시적으로 연장하면 정상적으로 계속 공부할 수 있다.
- 현재 활성 세션은 보정하지 않았으며, 서버 Cron이 만료 시각에 별도로 종료한다.

## 2026-08-09 - Today 화면 도메인 분리

- 결정: 긴 Today 단일 대시보드를 집중·계획·기록 화면으로 분리한다.
- 이유: 최근 7일 습관, 출석 캘린더, 계획표가 집중 세션보다 아래에 길게 누적돼 모바일과 데스크톱 모두에서 탐색 비용이 컸다.
- 범위: 웹 UI와 컴포넌트 분리만 변경하며 Supabase 쿼리, 출석 정책, 카메라 판정, 세션 RPC는 변경하지 않는다.
- 다음 작업: 프로덕션 빌드와 브라우저 전환을 확인한 뒤 Vercel 배포 상태를 검증한다.

## 2026-08-19 - 다국어 README 구성

### 현재 작업

- 작업명: GitHub 기본 README 다국어화
- 작업 목적: 영어 기본 문서와 한국어·일본어 문서를 연결해 글로벌 채용 담당자와 엔지니어가 프로젝트를 평가할 수 있게 한다.
- 관련 PRD: `memory-bank/prd-multilingual-readme.md`
- 관련 파일: `README.md`, `README.ko.md`, `README.ja.md`, `apps/web/test/readme.test.mjs`

### 최근 결정 사항

- 결정: `README.md`는 영어 기본 문서, `README.ko.md`와 `README.ja.md`는 상단 언어 링크로 연결한다.
- 이유: 기존 한국어 운영 문서를 보존하면서 영어·일본어 독자의 첫 진입 경험을 개선하기 위함이다.
- 영향 범위: README 문서와 README 계약 테스트만 변경하며 애플리케이션 런타임·Supabase·배포 동작은 변경하지 않는다.

### 현재 상태

- 완료: 세 언어 README 작성, 언어 전환 링크·핵심 용어·상대 링크·diff 공백 검사, README 계약을 포함한 전체 334개 테스트.
- 완료: agent/multilingual-readmes 브랜치 푸시 및 Draft PR #1 생성 (https://github.com/zxcc9867/studyRoom/pull/1)
- 완료: Draft PR #1을 main에 squash merge (merge SHA 81b20025b7b833fd142c337946d885b753e7a2ba)
- 진행 중: 없음.
- 막힌 부분: 없음.
- 다음 작업: 없음. 원격 문서 브랜치 삭제는 사용자가 별도로 승인하는 경우에만 수행한다.

### 주의할 점

- 문서 전용 변경이므로 Vercel 프로덕션 배포 대상이 아니다.
- 실제 사용자 데이터와 키·토큰은 README에 포함하지 않는다.

## 2026-09-06 - 할 일 삭제, 시간 직접 입력, 목표 삭제

- 사용자 요청: 세션 계획 목록에서 할 일 삭제, 시간 직접 입력과 선택 병행, Today 목표 편집에서 삭제 제공.
- 구현: 기존 삭제 함수 재사용 및 선택 상태 정리, 삭제 실패 후 busy 해제, 시간 클릭의 강제 picker 제거, 목표 삭제 확인·모달 닫기, 목표 수정 시 기존 상태 유지.
- DB schema/RPC 변경 없음. 제품 변경 범위는 웹이다.
- 관련 문서: prd-session-todo-links.md, prd-study-goals.md.

- 최종 로컬 검증: 339개 테스트, 웹 TypeScript/Vite build, diff --check 통과. agent-browser 로그인 화면 렌더/오류 없음 확인. Chromium fixture에서 목표 삭제 취소/확인과 todo 보존, 직접 입력 09:45~10:30 저장, 삭제 실패 후 재시도, 마지막 선택 삭제 시 시작 비활성화, 390px 모달 경계 및 pageerror 없음 확인.
- 브라우저 검증은 가짜 Supabase 응답/세션을 사용했으며 세션 목록 접근을 위해 카메라 필수 게이트만 로컬 응답에서 우회했다. 실제 카메라·운영 DB 삭제 검증은 하지 않았다.

## 2026-09-06 - 계획 편집 개선 production 배포 완료

- 사용자 명시적 배포 승인 후 커밋/푸시: c45177c600576798d8596e90998d235d48c28469. 이전 시도의 자동 승인 검토 차단은 사용자 승인으로 해소됐다.
- GitHub Actions: https://github.com/zxcc9867/studyRoom/actions/runs/34008373792 성공 (1m13s). 전체 테스트와 웹 빌드 포함.
- Vercel deployment: dpl_DoBuXBkcAePa4M6xhiJfxFjbPj3k, READY, production, 위 커밋 일치 및 alias 확인.
- 운영 URL: https://study-room-attendance.vercel.app/ HTTP 200. /assets/index-CnQ4T_vO.js HTTP 200 및 직접 시간 입력 안내/목표 삭제 UI 포함 확인.
- 운영 사용자 데이터를 삭제하는 검증은 수행하지 않았다. 이전 로컬 브라우저 fixture 검증 결과를 유지한다.
- 배포 결과 기록은 로컬 memory-bank에 추가했다. 앱 변경 추가 없음.

## 2026-09-06 - 목표 달성과 마이페이지 배지

- 구현: Today/목표 목록의 목표 달성, 성공 저장 후 마이페이지 메달 배지, 기존 완료 목표 포함, 재개/삭제 시 배지 제거 및 안내.
- 데이터: 기존 study_goals.status 사용, DB 변경 없음. 전체 목표 페이지 조회로 100개 제한 제거. 할 일 완료 상태는 변경하지 않는다.
- 검증: 345개 테스트, 웹 build, 독립 리뷰 및 fixture 브라우저 흐름 검증. 실제 계정에 목표 달성을 대신 기록하지 않았다.
- 배포: AGENTS.md §5에 따라 production 배포 진행. 최종 결과는 로컬 인수인계 기록 및 progress 후속 기록 참조.

## 2026-09-06 - 목표 배지 production 배포 완료

- commit: f00f9752e210828d604908ced4aecd71e4befb93 (main push 완료).
- GitHub Actions 34015586132: success, 테스트/빌드/배포 통과.
- Vercel: dpl_4CK7isy9Hs2BuzLMxJWvevZ7D9bB, production, READY. commit 일치 및 production alias 확인.
- https://study-room-attendance.vercel.app HTTP 200, 새 entry asset HTTP 200 및 배지 UI 포함 확인.
- 전체 345 tests/build 및 fixture 브라우저 확인 완료. 실제 사용자 계정의 목표는 변경하지 않았다. DB migration 없음.
- 자세한 인수인계: C:/jini-dev/memory-bank/handoffs/2026-09-06-studyroom-goal-badges.md.

## 2026-09-06 - OpenRouter 기반 준비

- 서버 공용 client, key/model/토큰/timeout 설정, CI의 GitHub Secret → Vercel production sensitive env 동기화, 로컬 ai:check, 사용 가이드를 작성했다.
- 공개 AI API/화면/실제 생성은 아직 없음. 키·모델 미설정 상태에서 비활성화되며 기존 웹앱은 유지된다.
- 359개 테스트 및 독립 코드 리뷰 통과. 실 API 호출/과금은 수행하지 않았다. CI env 전송은 mock 검증이며 실제 값 등록은 사용자가 GitHub 설정에서 수행한다.
- 관련: prd-ai-integration.md, implementation-plan.md, docs/openrouter-setup.md. 배포 완료 결과는 후속 기록 참조.

## 2026-09-06 - OpenRouter 준비 구조 배포 완료

- commit e31c6f162be995c846ec1702d2f5989ad7d7111a, Actions 34015981690 success.
- Vercel dpl_Hr2zyLerB3MYu3dS4Zh226ps4cz2 production READY, https://study-room-attendance.vercel.app HTTP 200.
- 실제 CI 로그에서 키/모델 미등록으로 환경변수 동기화 skip 확인. 이번 실행에 비밀값 전송/AI 호출/과금 없음.
- 사용자가 나중에 GitHub Secret OPENROUTER_API_KEY 및 Variable OPENROUTER_MODEL을 등록하고 재배포한다. 사용 방법: docs/openrouter-setup.md.
- 로컬 배포 결과 기록과 기존 미커밋 문서는 보존했다. 앱 기능 추가는 별도 후속 작업이다.

## 2026-09-06 - OpenRouter dynamic routing

- 기본 auto 라우팅: 요청별 모델 선택은 OpenRouter에 위임, medium 비용 등급. fixed 모드는 기존 모델 환경변수를 사용한다.
- 미설정 토큰/timeout은 1024/20000 유지. 선택 설정 2개를 CI에서 전달한다. 실제 응답 모델 반환, 앱 자동 재시도 없음.
- 검증: 전체 361 tests, 독립 리뷰 관련 16 tests 통과. 실 AI 요청 없음. 배포 결과는 후속 기록 참조.

- 배포 상태: 자동 승인 검토가 GitHub OpenRouter Secret의 Vercel 전송에 대한 사용자 명시승인 부족을 이유로 commit/push를 차단함. 아직 배포되지 않았으며 사용자 승인 대기. 전체361 tests 및 build 통과.

## 2026-09-06 - AI 기능 후보 검토

- 실제 UI/데이터/helper와 PM 독립 검토를 종합해 ai-feature-opportunities.md 작성. 추천 순서: 주간 AI 코치 → 목표 계획 초안 → 자연어 일정 입력. 재계획/회고 도우미/자료 기반 퀴즈도 비교.
- 기존 통계/방해 사유별 조언/알림 추천과 신규 AI 가치를 구분. API route/사용량 제한/구조화 출력은 후속 기능 구현 시 필요하다.
- 이번 작업은 검토 문서만 변경. 실 AI 호출/앱 변경/배포 없음. 이전 동적 라우팅 배포 차단은 해결되었다고 가정하지 않았다.

## 2026-09-06 - 본인 기록 분석 및 무료 재시작 코치

- 이메일로 본인 계정을 확인한 후 해당 사용자 데이터만 읽었다. 구체적 이메일/UUID/회고 원문/개인 통계는 저장소에 기록하지 않았다. 시작 공백·체크표시/공부의 불일치·회고 희소성에 따라 Today 10분 첫 행동 코치를 선택했다.
- 구현: StudyRestartCoach/UI helper, authenticated API, 최소집계/짧은AI행동/규칙fallback, 무료전용 가격0 제약, 캐시HMAC, 피드백 및 하루3회 DB한도. 관련 PRD prd-restart-coaching.md 및 docs/openrouter-setup.md 갱신.
- 검증: 378 tests 및 build, 독립 리뷰 수정확인. 실제 Chromium 합성fixture에서 기본조언/피드백/계획초안콜백/390px overflow없음, 브라우저 오류 없음. 실제 전체앱 로그인→AI→DB 통합은 배포 후 검증 필요.
- DB migration 20260906064942 적용 완료. 테스트 변경은 rollback, study_coaching 0행 확인. RLS/무인증거부/directDML거부/동시예약논리/일한도/캐시/피드백/타인차단 검증. 실제 동시 병렬 부하는 미측정.
- 실 AI 요청/과금 없음. 키는 GitHub에만 등록된 것으로 이전에 확인했으며 원문 조회하지 않았다. 웹/API production은 아직 미배포: 기존 자동 승인 검토가 GitHub Secret→Vercel 전송에 대한 명시승인 부족으로 차단한 상태가 지속됨. 사용자 승인 후 커밋/푸시/배포 및 실제 연동검증을 이어가야 한다.

## 2026-09-06 - 무료 재시작 코치 production 배포 완료

- 사용자 명시승인(수행해줘)에 따라 GitHub OpenRouter 키를 동일 앱 Vercel production sensitive env로 전달. CI에서6개 환경변수 sync 성공, 값은 출력하지 않음.
- 구현 commit01dcf388c32d65dd0aba67fd6ec91dc122602c04, 무료AI실연결검증 commit27e82c71c8e89428be47068ee3d3a05c78bbccc8.
- 최종 Actions34017811415 success, 378 tests/build 통과. CI 합성예제로 실제무료AI응답 및 코칭액션검증 통과. 개인자료/DB쓰기 없이 실행, 유료재시도 없음.
- Vercel dpl_FrZiMZ2itomPvuXThNGEk6mC1Be2 production READY, commit/alias일치. https://study-room-attendance.vercel.app HTTP200, 새entry200 및10분코치UI포함.
- 운영POST /api/study-coaching 무인증401/no-store, 잘못된토큰401 확인. 로그인 사용자 전체브라우저흐름은 합성fixture검증이며 실본인세션으로 생성/저장하지 않았다. DB RPC는 앞선 rollback검증 완료.
- runtime/DB/무료provider 각 경로 검증 완료. 최초genericfallback값 외 AI품질·지속습관효과는 출시후평가 필요. 피드백은 저장되며 다음코칭자동학습은 후속범위.

## 2026-09-06 - 사용자 요청에 따른 최신 main 재배포 완료

- 코드 변경 없이 commit 27e82c71c8e89428be47068ee3d3a05c78bbccc8 재배포. Actions 34018618686 success, 테스트 및 빌드 통과.
- 무료 AI 합성 입력 실연결/액션 검증 통과. 개인 데이터 및 DB 쓰기 없음.
- Vercel dpl_9W9pnmKaprmPcsyeMGPnG3kLN4de production READY, HEAD 및 production alias 일치.
- https://study-room-attendance.vercel.app HTTP 200, entry asset 200, 10분 재시작 코치 UI 포함 확인. 무인증 coaching POST 401/no-store 확인.
- 기존 변경 및 CLAUDE.md 보존. 로그인 사용자 전체 운영 흐름 검증 범위는 이전 기록과 동일.

## 2026-09-09 - Recovery consistency audit and release

### Current work

- Reconcile recovery behavior across production DB, latest main, and deployed Slack code after the approved cross-device recovery fix.
- Worktree: `C:/jini-dev/worktrees/study-room-recovery-audit`, branch `codex/recovery-consistency`, based on `e42b2a9`. The original dirty checkout is preserved.
- Relevant PRD: `prd-slack-recovery-routines.md`.

### Decisions and evidence

- Production has the aggregate recovery schema, but latest main lacked the coverage fields, audit-row filter, and aggregate creation logic.
- Deployed Slack v14 preserved coach actions but had regressed makeup todo dates to the historical missed date.
- Dashboard recovery loading now pages all pending/submitted records with stable created_at/id ordering.
- Merge preserves the newer goal pagination and coach integration. New tests execute real data loading/shared recovery/Slack submission logic with only external transports stubbed.
- Restore the exact remote recovery migrations `20260827144548` and `20260827145316`; these are source-history repairs, not new production schema operations.
- The approved Book/Review deletion is already applied as `20260909141751`; its exact SQL is also retained in this branch.

### Status

- Baseline: 470 tests passed on latest main.
- Regression evidence: four recovery data/creation tests and three timezone submission tests failed against the old behavior and passed after the fixes.
- Remaining: full tests, build, Edge checks, source review, production deployment and final verification.
- Broader goal next candidates: monthly study report, dependency/security findings, and focused mobile parity after the current consistency fix is released.

### Release validation

- Full Node suite: 477 passed, 0 failed. Web TypeScript/Vite build passed; README assets check verified 24 references across three languages.
- Edge gate now covers all eight deployed functions plus three coach pilot isolation tests; all passed.
- Fixed pre-existing rebuild failures in attendance/camera/test-alarm: pin Supabase SDK to the existing 2.57.4 compatibility version, use SupabaseClient types, explicitly type response unions and the profile map.
- Exact normalized SQL equality confirmed for all three restored remote migrations. No recovery data migration will be re-applied.
- Deployment is the remaining release step.

### Production verification completed

- Code commit `01d157b0d6bdb1043954caae65498c20f44cf4fe` is on origin/main; GitHub Actions `34365469581` succeeded, including tests, Edge checks, build and deployment.
- Vercel `dpl_78wFkC5ZxAHVPk5RS3WXbRnei2hh` is production READY with matching commit and `study-room-attendance.vercel.app` alias.
- Production page and `/assets/index-gy4oKZiu.js` returned HTTP 200; the deployed bundle contains recovery coverage fields.
- Supabase ACTIVE versions: attendance-cron 33, camera-presence-warning 10, slack-recovery-interactions 15, slack-test-alarm 10. All four rejected unauthenticated empty POST requests with 401.
- Approved legacy deletion rechecked: Book and Review are absent, 30 other public tables remain, migration `20260909141751` is recorded. No deletion or recovery data migration was repeated.
- Real signed-in browser submissions and real Slack notifications were not triggered; behavioral tests use synthetic transport.
- Original dirty checkout remains preserved. These final verification notes are local documentation updates; no additional commit or push was performed in this continuation.

## 2026-09-09 - Study report audit

- Current work: verify weekly/monthly report coverage against the user request; see report-feature-audit.md and prd-sustainable-study-loop.md.
- Found: current-week review exists; completed-week navigation and a monthly report do not. Attendance archive coverage is limited to 370 dashboard rows.
- Reproduced: a cross-midnight fixture renders 0 minutes before canonical data, then one hour after it arrives, without a data-loading indicator. Review also does not gate on reflectionHistoryLoaded.
- Verification: 18 existing report-related tests passed, exposing a missing loading/error regression scenario rather than proving that scenario correct.
- Decision: propose a bounded extension of the existing review (week/month, historical periods, accurate loading/error states, selected-period data coverage), retaining deterministic free summaries and the existing todo planning bridge.
- Status: design approval question sent; no report implementation or remote mutation yet. Brainstorming skill requires the design decision before implementation. Investigation documentation is local and uncommitted.

## 2026-09-10 - Offline dependency and native compatibility audit

- npm audit was rejected before execution because it can send dependency metadata to the registry. Requested specific consent; no alternate transport or retry was used.
- Offline graph inspection distinguishes the small web runtime closure from the larger Expo workspace/tooling graph; root warning counts cannot be treated as web exploit counts.
- Reproduced a native renderer version error: mobile resolves React 19.2.7 while React Native's actual version guard requires 19.0.0. This is separate from mobile-browser UI.
- Mobile typecheck still passes, exposing a runtime verification gap. No Android/iOS launch or current advisory scan was completed.
- Detailed evidence: dependency-compatibility-audit.md. No package, code, lockfile, remote data, commit or deployment changes. Report design and audit egress consent remain pending.

## 2026-09-10 - Goal handoff: user decision required

- Revalidated HEAD and documentation-only worktree changes; no report/mobile implementation or package update has occurred.
- Previous goal turn was progress: it established dependency boundaries and reproduced the native renderer mismatch. This continuation found no new design approval or registry-audit consent.
- The report design gate remains unresolved across three consecutive goal turns: report investigation, offline dependency investigation, and this revalidation. Safe independent diagnostics have established actionable causes for the identified changes.
- Remaining implementation requires the user's design decision under the brainstorming skill; the separate npm metadata-egress rejection also requires explicit consent and must not be bypassed.
- Mark the broad goal blocked, not complete. Resume after the user's response with the existing report proposal and scoped native compatibility repair; preserve web React and all user data. Recheck advisories only if registry inspection is authorized.

## 2026-09-10 - Approved study reports and native compatibility implemented

### 현재 작업

- 작업명: 주간·월간 학습 리포트 및 Expo 네이티브 호환성.
- 작업 목적: 지난 기간 회고와 정확한 로딩 상태, 네이티브 시작 오류 해결.
- 관련 PRD: prd-study-reports.md, prd-mobile-compatibility.md.
- 관련 파일: apps/web/src/StudyReportSection.tsx, studyReports.mjs, studyReportData.mjs, apps/mobile/{package.json,index.js,metro.config.cjs}, scripts/mobile-compatibility.mjs.

### 최근 결정 사항

- 사용자의 `진행해`가 리포트 설계·최소 모바일 수정·공식 npm 감사 메타데이터 전송을 승인했다. 이전 승인 대기 기록은 이 결정으로 해소됐다.
- 리포트는 현재 owner의 저장된 시간대를 먼저 조회하고, 선택 기간의 완료 시간·출석·할 일·회고를 별도로 가져온다. 초기 대시보드/브라우저 시간대나 370일 출석 제한에 의존하지 않는다.
- 기존 회고 액션과 방해 조정 안내는 유지하며 추가 AI 비용·자동 알림·DB 변경은 없다.
- 모바일 React 19.0.0/RN 0.79.6/AsyncStorage 2.1.2를 Expo 53에 맞추고 웹 React/DOM 19.2.7은 유지했다.

### 현재 상태

- 완료: 주/월·과거 기간 탐색, 비교 범위·월 일평균, 로딩/오류/재시도, stale 응답 차단, 프로필 시간대 선행 조회, 모바일 resolver/entry/CI 검사.
- 검증: 전체 501 tests, 웹 TypeScript/Vite build, mobile:check, README 자산 24개 통과. 보고서 14개·네이티브 10개 회귀 및 별도 코드 리뷰 통과.
- 브라우저: 합성 데이터로 주/월 전환·지난 달·윤년·키보드 월 변경·오류 재시도·계획 callback·프로필 3초 지연/LA 날짜 경계 확인. 390px/dark preference에서 overflow 0, 44px 미만 컨트롤 0, page error 0.
- 미완료: 실계정 브라우저 흐름과 물리 기기/에뮬레이터 검증, 별도 취약점 완화 계획, 사용자가 요청하는 커밋·푸시·배포.

### 주의할 점

- 최신 공유 AGENTS.md는 요청 없는 커밋·푸시·배포를 금지한다. 이번 변경은 로컬이며 원격 상태를 바꾸지 않았다.
- 기존 dirty checkout은 보존. 현재 worktree: C:/jini-dev/worktrees/study-room-recovery-audit.
- 감사 수치는 root 28/mobile 27/web 전체 5/web omit-dev 3으로 수정 전후 동일. 웹 runtime closure 내 취약 노드 0은 제한된 그래프 근거이며 보안 문제 전체 해결을 의미하지 않는다.
- 광범위한 개선 목표 전체를 완료했다고 보지 않는다. 남은 공급망/기기 검증 범위는 dependency-compatibility-audit.md 참조.

## 2026-09-10 - Production deployment authorized

- The user explicitly requested deployment of the approved reports and native compatibility changes.
- Fresh preflight passed: 501 Node tests, web build, mobile compatibility/typecheck, 24 README assets, eight Edge checks and three pilot tests, git diff --check.
- Fetched origin/main and confirmed it matches the worktree base 01d157b. The original dirty checkout remains untouched.
- Release path: normal fast-forward push to main, existing GitHub Actions workflow, then Vercel production verification. No Supabase migration or Edge redeployment is required.
- Deployment is pending; success will be recorded only after CI and live checks complete. Physical-device validation and dependency-security follow-up remain separate.

### Production verification completed

- Application commit 0f23f752e7d88fb09d5ac085f0b879749ba67e30 was pushed to main; GitHub Actions 34488632591 completed successfully, including all gates and the synthetic free-coaching check.
- Vercel dpl_9Pq4cjqx7xiyMbZVjcoL7ZcyEogV is production READY with the matching application commit and study-room-attendance.vercel.app alias. Vercel build duration was approximately 33 seconds.
- Live checks passed: page, index-D8Em-tMe.js, StudyReportSection-enyNap4v.js and StudyReportSection-D4Vrp-PI.css returned HTTP 200 with correct content types. Unauthenticated coaching POST returned 401/no-store.
- After more than 60 seconds from READY, Vercel runtime-error clusters and deployment-scoped error/fatal logs returned no matches for the initial observation window. This is not a claim about long-term or signed-in user behavior.
- Account is on Hobby; external drain/integration configuration was not established by the available tools. No new monitoring integration was installed.
- No Supabase schema/data or Edge deployment changes, no real-account submissions, and no app-store release. Original checkout remains untouched.
- Final verification notes are recorded in a documentation-only follow-up commit with [skip ci], following the existing repository convention; the deployed application commit remains the one above.

## 2026-09-12 - Career coach implementation status audit

- Request: verify whether StudyRoom 2.0 career setup and career-helpful AI task recommendations are implemented. This is an inspection, not approval to enable features, send data to AI, connect accounts or deploy.
- Read prd-studyroom-v2.md, studyroom-v2-contract.md, setup guide and existing rollout records; inspected UI, API, roadmap/recommendation worker and ranking code.
- Implemented: user-entered career/experience/interests, AI-assisted editable roadmap, confirmed-roadmap tasks, available-slot selection, up to three alternatives, explicit acceptance into todos and feedback. AI is hybrid: rule candidates/slots plus a rewritten first task, not a conversational career-discovery agent or semantic career-priority ranking.
- Candidate order currently places up to three untimed existing todos before roadmap/repository tasks; this can crowd out career-specific recommendations. No corrective implementation was requested.
- Live read-only aggregate checks: pilot rows 1, enabled coaches 0, active careers 1, confirmed roadmaps 0; jobs/recommendations/accepted recommendations 0; Google/GitHub connections and selected repositories 0. No personal IDs, titles, schedules or credentials were retrieved.
- Deployed career-coach v3 and three supporting coach functions v2 are ACTIVE; downloaded v3 source confirms the hybrid AI/pilot/enable gates. Web production remains application commit 0f23f75 READY.
- Both coach cron jobs are active and latest SQL scheduler runs succeeded; scheduler success alone is not proof of HTTP/provider success. Edge AI secret configuration, actual AI response quality and signed-in recommendation acceptance were not verified.
- Focused synthetic tests: 76 passed, 0 failed. Next user steps: enable coaching with study windows, receive/review/confirm roadmap, then inspect recommendations and actual model provenance. Optional provider connections and real AI verification remain separate.
- Only local active-context/progress notes changed. No app code, production settings/data, commit, push or deployment changes.
