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
