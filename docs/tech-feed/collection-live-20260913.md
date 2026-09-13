## 최종 결과

- 수집 활성화 완료: TECH_FEED_ENABLED=true, 피드Cron active, API v11/worker v12 ACTIVE·JWT true. 출석Cron active 유지.
- 코드 main a5ec757, Actions34754299449 success. Vercel dpl_GS3oNd5fHNPhoB34AZdyQrsFjU2W production READY, 운영 URL HTTP200. 배포 직후 짧은 구간 Vercel runtime errors 없음.
- 자동 Cron11:21/11:22 및11:23/11:24 UTC 연속 succeeded, worker HTTP200/추가검색0 확인. 주제1시간 캐시를 지켜 매분 검색 크레딧을 소비하지 않았다.
- 최초 검색158523 및 표준 수동 수집 경로158534 모두 ready/attempted1. 누적 검색2회, 수동 요청1건, 저장 기사0건.
- 수동 검증의 실제 제공자 결과1개는 HTTP 뉴스 목록 페이지라 HTTPS 필터로 제외됐다. 연결 장애가 아니며 안전 필터/사용자 관심 문장은 임의 변경하지 않았다. 유효한 기사 저장 성공은 아직 실증하지 못했다.
- 수동 검증은 JWT+worker secret으로 보호한 일회성 함수에서 단일 수신 동의 계정의 기존 store/runManualRefresh를 호출했다. 기존 revision/5분 제한/lease/월 예산을 그대로 사용했으며 로그인 토큰을 만들거나 브라우저를 조작하지 않았다. 진단 함수 삭제 및 목록 부재 확인. 실제 로그인 브라우저 버튼 클릭과 다중 브라우저 동기화는 이번 실측에 포함하지 않는다.
- 관심별 검색문 분리/검색 품질 개선, RSS 승인 및 AI 요약은 별도 범위. 아래 진행 중 문구는 이 최종 결과로 정리한다.

# 기술 피드 무료 계정 수집 활성화 — 2026-09-13

## 승인 및 정책

- 사용자 카드 미등록 확인 후 수집 활성화 명시 승인. 기존 null 한도 무조건 거부 조건을 개정했다.
- 무료 Free/Researcher, plan_limit1~1000, 유효한 plan/key 사용량, paygo_usage0을 매 검색 전에 확인한다. key.limit이 명시적 null이면 무료 계정 잔여량을 사용하고, 숫자라면 추가 상한을 적용한다.
- paygo_limit은 명시적 null 또는0만 허용한다. null이 종량제 비활성화를 증명한다고 주장하지 않는다. 결제 수단·요금제 변경 없이 전용 무료 계정을 사용한다.
- 유료/누락/잘못된 타입/양수 paygo 한도·사용량은 차단. 기본검색 고정, 제공자 lease, 앱 전체 원자적 월900회 한도, 실패 호출도 계산, 잔여량 소진 시 중지 정책 유지.

## 구현 및 검증

- tech-feed-search.mjs의 사용량 검증만 변경. 신규 nullable 회귀4개 RED3실패 확인 후GREEN.
- 관련 단위13/13, 전체564/564, Edge10진입점+8테스트, 웹 빌드, 모바일 호환성/타입, README24참조 통과.
- 독립 검토 지적 없음. 검토자가 관련13/13 및 DB17/17 직접 확인.
- PRD·명세·운영 가이드 개정. 기존 출석/타이머/사용자 관심 문장 변경 없음.

## 운영 변경

- Supabase next-js bqohkdzvxbrokkmuhysx의 tech-feed/worker 재배포, JWT 유지.
- TECH_FEED_ENABLED=true, 월 상한900 유지. Vault worker secret/anon JWT 인증 준비 상태를 그대로 사용.
- 잘못된 무료 검증에서 남은 실패 대기는 활성 lease 없는 미성공 topic/provider만 due로 재설정했다. 성공 캐시/호출 예산/사용자 cooldown은 초기화하지 않았다.
- 실제 호출158523 HTTP200, search.ready / attempted1 / collected0. 최초 검색 응답 처리 성공이나 저장 글은0건이며, 검색 결과 미존재와 필터 제외를 추가 확인한다.
- 피드 Cron active=true. 기존 매분 due 큐 확인/주제별1시간 주기 유지. 출석 Cron은 변경하지 않았다.
- RSS8개는 이용 조건 pending 유지. 실제 AI 요약 성공/사용자 로그인 브라우저 버튼은 별도 확인 대상이다.
- 최종 예약·수동 경로·배포 결과는 후속 검증 기록으로 추가한다.
