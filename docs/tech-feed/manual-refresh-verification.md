# 새 글 확인 즉시 수집 — 2026-09-13 JST

## 승인 및 구현 범위

- 사용자 `진행해줘` 승인: 정기 한 시간 캐시에 명시적 수동 수집 예외를 추가한다. 일반 페이지 로딩은 외부 검색을 호출하지 않는다.
- 웹 `새 글 확인` → 인증된 `refresh(expected_revision)` → 현재 주제1개/승인된 구독 RSS·API 최대4개 → 결과 상태/목록 재조회.
- 계정5분 요청 제한과 주제·출처5분 공유 제한,90초 lease, 기존 실패 백오프와 앱 전체 월900회/무료 제공자 검증을 유지한다. 실패한 실제 검색도 차감하며 유료 전환·추가 AI 요약 호출 없음.
- 같은 계정 중복 요청은 진행 중 작업을 공유한다. RSS와 검색은 독립 실행하고, 다른 주제의 provider mutex는2초 간격으로 제한 재시도한다. 대기 자체는 제공자 호출/예산 예약을 하지 않는다.
- 서버 수집 네트워크 예산40초, 웹 HTTP60초/전체65초, 공유 상태 최대20회 폴링. DB 작업 완료까지 정확히40초를 보장한다는 뜻은 아니다. 조회 중 실패/한도 상태를 유지하고 lease 부재를 성공으로 단정하지 않는다.
- 설정 변경과 claim은 같은 owner advisory lock을 사용하며 revision을 재검증한다. 계정 전환의 이전 응답은 abort/generation으로 배제한다.

## 로컬 검증

- 전체 Node **559/559** 통과(16.53초). 수동 수집 신규26개: API 인증, DB 권한/lease/중복/revision, 실제 수집 파이프라인의 외부 I/O 합성 경계, 무료 한도/RSS 분리, provider 대기 취소, 웹 폴링·계정 수명.
- 중요 리뷰 발견3건을 재현 테스트 RED→GREEN으로 수정, 독립 재검토 승인. 추가 취소 회귀도 통과.
- Edge10개 진입점 타입 검사, Deno **8/8**, 웹 TypeScript/Vite production 빌드, Expo 호환성/타입, README **24개 이미지 참조/3언어** 검사 통과.
- 기존 Deno `punycode` deprecation 경고는 비차단이며 남아 있다.
- Playwright CLI 합성 React 화면: PC1440px/모바일390×844에서 버튼 진행·비활성화·중복 호출1회·새 기사 반영,5분 대기, 공유 작업 폴링, 무료 한도/키 없음/전체 중지 안내 확인.
- 모바일 요청 중 계정 전환 후 이전 알림·기사 미노출 및 새 계정 수집 확인. 가로 넘침 없음, 브라우저 오류0. `output/playwright/manual-refresh-mobile.png`를 실제 열어 밝은 테마/버튼 가독성 확인(로컬 증거, Git 제외).
- PGlite는 순차 DB 동작 검증이다. hosted 다중 연결 트랜잭션 interleaving, 실제 로그인/외부 제공자/연속 예약 수집을 검증했다고 주장하지 않는다.

## Supabase 적용

- 프로젝트 `next-js` / `bqohkdzvxbrokkmuhysx`.
- `20260912161611_tech_feed_manual_refresh.sql` MCP 적용 성공. CLI 생성 번호20260912154751은 운영 버전과 일치하도록 파일명만 변경했다. SQL 본문 불변, 기존 migration 이력 repair/reset 없음.
- 신규 서버 전용 `tech_feed_refresh_requests`: RLS ON, anon/authenticated SELECT 불가. 신규5 RPC는 SECURITY INVOKER/search_path 고정, service_role만 EXECUTE 가능. 운영 SQL 조회로 확인.
- 보안 advisor 기존 WARN 불변. 서버 전용 테이블의 RLS policy 없음 INFO는11→12이며 의도한 클라이언트 접근 차단이다. [Advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- `tech-feed`, `tech-feed-worker` **v5 ACTIVE**, `verify_jwt=true` 유지. 공유 모듈도 함께 배포했다.
- 서버 smoke: tech-feed OPTIONS204, 무인증 POST401; worker 무인증 POST401. 실제 사용자 JWT를 이용한 운영 수동 요청은 미검증.
- 출석 Cron active, 피드/커리어 Cron inactive 유지. 추천8소스 pending, 운영 기사0. Secrets 목록의 검색 키/전용 worker 인증/무료 AI 미등록 상태와 기존 self_service/수집 false/월900 설정을 유지했다. 비밀값 변경 없음.

## 웹 배포

- 프로젝트 AGENTS의 사용자 표시 기능 자동 production 배포 규칙에 따라 코드 커밋 `38f1c18bbc9df4beb93f2a21843b09db3b21f084`를 main에 fast-forward 푸시했다.
- [GitHub Actions34704876130](https://github.com/zxcc9867/studyRoom/actions/runs/34704876130) **success**. Linux CI의 테스트·모바일·README·Edge·웹 검사와 production 배포 완료.
- Vercel `dpl_FEhgUzGeoQyuzdM6aSt9UQgwhkdP`, **production READY**, 빌드27.1초, alias 오류 없음. [운영 사이트](https://study-room-attendance.vercel.app) HTTP200.
- 운영 `index-GysfiDi0.js`/`TechFeedSection-G9C7NOau.js` HTTP200. 공통 번들의 refresh_status/대기·공유 문구, 화면 번들의 새 소식 찾는 중 표시를 확인했다.
- READY 후85초 경과 시 해당 배포의 error/fatal 로그 조회(UTC16:21:21~16:22:47) 결과 없음. 짧은 관찰 범위이며 지속 모니터링/실사용 수집 성공의 증거가 아니다. Drains 설정은 확인하지 않았다.
- 후속 완료 기록은 `[skip ci]` 문서 커밋으로 남긴다. 배포된 기능 코드는 위38f1c18이다. 원본 checkout과 다른 작업 변경은 건드리지 않았다.

## 남은 운영 조건

- **코드 배포와 실제 소식 수집 활성화는 다르다.** 현재 전체 수집 OFF 및 Tavily 키 미등록으로 즉시 검색은 가동하지 않는다. 버튼은 이 상태를 안내한다.
- 앱 전용 무료 검색 키와 종량제0 확인, RSS 이용 조건 승인, 예약 수집 인증 구성 후 별도로 실제 가동을 검증해야 한다. 일반 사용자는 개인 API 키나 SNS 연동을 하지 않는다.
- 새 글 없음/무료 한도 소진/실패 대기는 정상적으로 가능한 결과이며, 매시간 새로운 뉴스나 모든 기사의 즉시 AI 요약을 보장하지 않는다.
