# 기술 피드 운영 연결 확인 — 2026-09-13

## 결과

사용자의 `등록했어` 응답 후 Supabase next-js (`bqohkdzvxbrokkmuhysx`)에서 Tavily 키 등록과 인증 성공을 확인했다. **실제 검색 수집 활성화는 미완료**다. 제공자 무료 한도를 검증하지 못하여 검색 POST 0회, 기사 0건이며 전체 스위치 false / 피드 Cron inactive로 복구했다.

## 실제 검증

- CLI Secrets 목록으로 TAVILY_API_KEY 존재 확인. 비밀값은 출력하거나 저장소에 기록하지 않았다.
- 서버 전용 무작위 48바이트 secret을 Edge Secrets `TECH_FEED_WORKER_SECRET` 및 Vault `tech_feed_worker_secret`에 저장했다. 출석 secret과 분리했다.
- 기존 verify_jwt=true를 유지하고 Vault `tech_feed_gateway_anon`의 legacy anon JWT를 Cron Authorization 헤더에 연결했다. worker 자체 secret 검증도 유지한다. 출석 Cron active는 변경하지 않았다.
- 첫 실제 worker 요청(net request158490)은 HTTP500, 실행 기록 없음. 잘못된 nonempty secret도500, secret 누락은401이었다.
- 전역 Buffer가 없는 환경에서 `Buffer is not defined`를 재현했다. 표준 TextEncoder의 Uint8Array로 비교하도록 수정하고 timingSafeEqual/길이 검증은 보존했다.
- 수정 worker 배포 후 잘못된 secret401, 정상 secret 요청158495는 HTTP200. 최종 목록의 worker v10 / tech-feed v9는 JWT true/ACTIVE이며 진단 함수는 없다. 검색 결과는 unavailable / attempted0이며 무료 조건 검사에서 중단됐다. HTTP200 또는 runs.status=completed만으로 검색 성공이라 보고하면 안 된다.
- JWT와 전용 secret으로 보호된 일회성 preflight 함수에서 GET /usage만 호출했다. 응답158497: 인증200, Researcher, plan_usage0, plan_limit1000, paygo_usage0, paygo_limit=null, key_usage0, key_limit=null. 진단 함수는 사용 직후 삭제했다.
- null을 무료 종량제 비활성화로 추정하지 않는다. 기존 무료 조건 검사는 변경하지 않았다. 키 한도 1~1000 및 명시적 paygo_limit0이 검증되어야 검색한다. 권장 키 한도900; 카드 추가/유료 활성화는 하지 않는다.
- 추천 RSS8개는 이용 조건 pending 유지. AI 요약/실제 로그인 수동 수집/연속 예약 수집은 미검증이다.

## 검증 명령

- 신규 테스트 RED: 전역 Buffer 제거 시 ReferenceError. 수정 후 관련6/6 통과.
- npm.cmd test: 560/560 통과.
- npm.cmd run test:edge: 10진입점 검사 및8/8 통과. 기존 punycode deprecation 경고 있음.
- npm.cmd run build / mobile:check / docs:check 통과, README24참조 정상. 인증 수정 독립 검토 지적 없음.
- 웹 배포 결과는 후속 기록에 추가한다.

## 다음 단계

1. 사용자가 Tavily에서 전용 키 월 한도를900으로 설정하고 Pay-as-you-go 비활성 상태를 확인한다. 설정 항목이 없으면 화면을 확인하며, null을0으로 간주하여 우회하지 않는다.
2. 무료 사용량 검사를 재실행하고 정상일 때 수집 스위치 활성화 → 최초 실제 검색/DB 기사 저장 확인 → 피드 Cron 활성화 순서로 진행한다.
3. 사용자 로그인 상태의 새 글 확인, 예약 실행 두 번과 중복 방지, 검색/요약 성공 여부를 별도로 확인한다.

참고: [Tavily usage](https://docs.tavily.com/documentation/api-reference/endpoint/usage), [요금](https://docs.tavily.com/documentation/api-credits), [Supabase 예약 실행](https://supabase.com/docs/guides/functions/schedule-functions).
