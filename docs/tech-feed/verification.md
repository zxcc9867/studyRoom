# 기술 피드 검증 기록 — 2026-09-12

로컬 체크아웃: `worktrees/study-room-recovery-audit`, 기준 HEAD `024b45b`. 커밋·푸시·운영 변경 없음.

## 확인한 사용자 흐름

- 실제 React 컴포넌트를 합성 데이터로 실행: 최신20개 → 더 보기23개, 저장/저장 목록, 저장 해제 후 빈 상태, RSS 미리 보기/추가, 실패 후 재시도.
- 23번째 글의 할 일 연결 결과를 반영한 뒤에도 카드23개·동일한 마지막 글·페이지 순서 유지. 연결 버튼은 추가 완료 상태.
- 390×844 모바일: 가로 넘침 없음, 밝은 배경 RGB255/249/228. 1366×900 PC: 두 열 각493px, 가로 넘침 없음. 브라우저 오류 목록 비어 있음.
- 서버 없이 실행한 픽스처이므로 운영 로그인·실DB 기기 간 동기화·main.tsx 전체 모달 E2E를 입증하지 않음. 기존 모달 연결은 코드 검토/타입 빌드와 원자적 서버 SQL 테스트로 교차 확인.

## 회귀 및 안전성

- 프론트엔드 관련16개 테스트 통과: URL/HTML 안전성, 페이지 중복 제거, 출처/AI 구분, 긴 제목180자, 계정 전환 전후 확인, 실제 Supabase SDK Authorization 토큰 고정, 시간대 독립 경로.
- 서버 테스트는 실제 RSS/Atom parser, PGlite SQL/RLS/트랜잭션, 고정 IP TLS transport, worker adapter를 실행함. 외부 HTTP/AI는 합성 응답이며 실서비스 호출 아님.
- Deno 6개 테스트 및 새/기존 Edge 진입점10개 타입 검사 통과. 실제 Deno HTTPS가 커스텀 연결 검사를 거치는 것까지 검증하되 외부 네트워크 권한은 부여하지 않음.
- 웹 TypeScript/Vite 빌드, Expo 호환성+타입 검사, README 이미지 참조24개/3언어 검사를 실행해 통과.
- 커리어 원본 보존: 삭제 경로28개와 교체된 서버 진입점4개의 archive 스냅샷을 HEAD와 대조했으며 텍스트 불일치 없음(줄바꿈 정규화).

## 독립 검토와 수정

- UI 검토: 계정 전환 시 실제 요청 토큰 고정, 할 일 생성 후 목록 유지, 저장 해제 행 제거를 수정하고 재검토 승인.
- 서버 검토: 소스별 매시간 수집 처리량, 50개 초과 증분 누락, AI 한도 소진 시 다른 소유자 선택/보류 처리, 소스 등록자 비공개 컬럼 접근을 보완.
- 예약기는 매분 대기 작업을 확인하지만 각 소스는 시간 단위 `run_after`와 실패 백오프를 따름. 동시에 전 소스를 호출하지 않음. HN 묶음은 DB 체크포인트로 나눠 처리함.
- 수집/요약/보류 카운터는 서버 전용 실행 기록에 구분해서 저장함.

## 경고 및 아직 확인하지 않은 항목

- npm audit: 기존 의존성28건(low1/moderate12/high14/critical1). 신규 fast-xml-parser는 감사 경고 대상이 아님. Critical tar@7.5.16 경로는 Expo CLI. 강제 업그레이드는 요청 범위 밖으로 수행하지 않음.
- Deno의 고정 Supabase SDK에서 `punycode` 폐기 경고가 나오나 검사/테스트는 통과. Windows Git의 LF/CRLF 안내와 도구 ACL 제약은 trouble-shooting에 기록.
- 권한/라이선스 검토, 운영 Edge DNS/TLS, 원격 RLS/마이그레이션 advisor, 실제 Cron 두 주기, 브라우저 종료 후 수집, 기기 간 실제 동기화, 무료 AI 한국어 품질/지연, 동시 PostgREST 부하 검증은 별도 승인된 출시 단계에서 수행.
- 추천 소스8개는 검토 대기, worker/사용자 기능 플래그는 기본 꺼짐, 새 Cron도 비활성 생성. 이 기록을 운영 배포 완료로 해석하지 말 것.

## 최종 확정 결과

- `npm test`: 489 passed, 0 failed, 0 skipped. 이 중 기술 피드 서버58개.
- `npm run test:edge`: Edge 진입점10개 검사와 Deno6개 테스트 통과.
- `npm run build`, `npm run mobile:check`, `npm run docs:check`: 모두 exit0. README24개 이미지 참조/3언어 확인.
- 최종 독립 통합 검토에서 발견한 AI 배열 null 처리/리디렉션 상대 URL 결함2개 수정. 검토자가 최신 수정의 focused5개 테스트를 재실행하고 로컬 인계 승인. 남은 Critical/Important/actionable Minor 없음.
- AI 비정상 응답에도 후속 소유자 처리와 cleanup/run finalization이 계속된다. 301/302 same-/cross-origin 상대 URL 테스트는 실제 고정 TLS transport를 합성 응답으로 실행하고 검증된 최종 URL·validator 제거를 확인한다.
- `git diff --check` 통과. HEAD024b45b 유지, 커밋·푸시·운영 변경 없음.

로컬 구현 완료와 운영 출시 완료를 구분한다. 위의 미검증 출시 항목은 그대로 남아 있으며 소스/플래그/Cron은 자동 활성화하지 않았다.
