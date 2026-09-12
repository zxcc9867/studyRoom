## 승인 후 재개 (최신 상태)

사용자가 기존5개 함수 인증 설정 유지 배포를 명시적으로 승인했다. 배포 성공 후 커리어4개410, Slack 무서명401을 확인했다. 신규 함수는 JWT 검사를 계속 활성으로 유지한다.

로컬 스키마 파일은 `20260912104353_tech_feed.sql`로 변경하여 원격 적용 이력과 일치시켰다. SQL 재적용은 하지 않았다. 전체 Node489/489, Deno6/6, 웹 빌드/모바일/README 검사 통과. 웹 배포와 마지막 Cron 단계 진행 중.
아래 내용은 첫 배포 시도의 역사이며 현재 승인 대기는 해소되었다.

# 2026-09-12 기술 피드 부분 배포 — 추가 승인 대기

## 사용자 요청과 상태

사용자가 로컬 구현 이후 배포를 요청했다. Supabase 추가 스키마와 신규 함수만 배포되었으며 기존 함수 갱신은 자동 보안 승인에서 차단되었다. 웹/커밋/푸시/Cron 변경은 아직 수행하지 않았다.

## 적용 완료

- 대상: Supabase `next-js` (`bqohkdzvxbrokkmuhysx`), ACTIVE_HEALTHY.
- MCP로 `tech_feed` 스키마 적용. 원격 migration version `20260912104353`, 로컬 원본 `20260912081621_tech_feed.sql`과 같은 SQL. **재개 시 재적용 금지. 로컬 버전을 원격 이력에 맞춰 정리한 후 Git에 반영할 것.**
- 신규 테이블10개 모두 RLS 활성, anon SELECT 불가 확인. 추천 소스8개 모두 permission pending/summary 비허용.
- `TECH_FEED_ENABLED=false` 설정. worker secret/파일럿/AI 설정 및 Vault는 새로 등록하지 않음.
- `tech-feed` v1, `tech-feed-worker` v1 ACTIVE. 두 함수 모두 플랫폼 verify_jwt=true 유지, 무인증 GET401 확인.
- 기존 함수는 콘텐츠 해시/entrypoint 변경 없음. secret 설정 후 목록의 version 숫자만 올라간 것을 코드 배포로 해석하지 말 것.

## 승인 차단

- 첫 배포 명령의 신규/기존7개 `--no-verify-jwt` 적용이 자동 보안 검토에서 거부됨.
- 안전 대안으로 신규2개는 옵션 없이 JWT 활성 배포 완료.
- 기존5개는 원격에서 이미 verify_jwt=false임을 확인하고 동일 설정 보존임을 설명했으나, 보안 검토가 명시적 사용자 승인을 요구하며 거부함. 다른 경로로 우회하지 않음.
- 승인 대상: `career-coach`, `coach-worker`, `coach-integrations`, `coach-notifications`, `slack-recovery-interactions`의 기존 verify_jwt=false를 유지한 코드 재배포. 커리어4개는 데이터 접근 없는410 응답으로 바꾸고 Slack은 기존 HMAC 서명 검증을 유지한다. 플랫폼 JWT 대신 앱 수준의 검증/차단 응답을 사용하는 범위다.
- 향후 신규 worker의 플랫폼 JWT 해제/secret 인증 전환도 별도 승인 대상이며 이번에 수행하지 않음.

## 검증 및 운영 영향

- 배포 직전 Node489/489 통과. 신규 함수401, 기존 production 웹 HTTP200.
- 기존 Vercel production `dpl_9Pq4cjqx7xiyMbZVjcoL7ZcyEogV` READY. 이번 웹 배포는 아직 없음.
- 기존 출석/커리어 Cron3개 모두 기존 활성 상태 그대로. 새 Cron 마이그레이션 미적용. 피드 수집/AI 실제 호출 없음.
- 보안 advisor 신규 WARN 없음. 신규 INFO3개는 서버 전용 preview_usage/runs/seen의 의도된 RLS 무정책·브라우저 접근 차단. 기존 search_path/공개 extension/기존 RPC/Auth 경고는 별도 범위.
- 백업 조회: walg_enabled=true, pitr_enabled=false, 열람 가능한 물리 백업 목록 없음. 백업이 있다고 주장하지 않는다. 이번 SQL은 기존 데이터 삭제/변경 없는 추가형 스키마다.
- HEAD024b45b 유지. 배포 승인 재개 전 사용자에게 위 기존5개 함수 보안 설정 유지 범위를 확인한다.

## 재개 순서

1. 명시적 승인 후 기존5개 코드 배포 및410/Slack 무서명401 검증.
2. 로컬 migration 파일명/참조를 적용된 원격 version에 맞춰 정리하고 전체 검사.
3. 필요한 커밋/푸시 → 기존 GitHub Actions → Vercel READY/HTTP200 확인.
4. 마지막 Cron 마이그레이션으로 커리어2개만 중지하고 피드 Cron은 비활성 등록. 원격 version도 로컬과 대조.
5. 소스 권한/AI 설정/실제 동기화/호스팅 TLS 등 미검증 출시 게이트는 그대로 유지. 피드를 활성화하지 않는다.
