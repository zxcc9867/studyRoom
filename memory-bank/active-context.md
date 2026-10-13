# Active Context

- 갱신: 2026-10-13 · 도구: codex
- 브랜치: feat/team-study-room · 제품 커밋: b9ab3ec6bc154d983865b13588417c306154afdc · 출시 근거는 문서 후속 커밋으로 기록
- 목표 / 완료 기준: 등록 계정 전용 함께 공부방 구현·검증·DB→웹 운영 배포. 기존 개인 인증/출석/회복/카메라/DND/공부일 정책 유지.
- 완료: 링크 로그인/가입→공유 범위 확인→명시적 수락, 정확한 공개 태그 초대, 팀6명/1팀, 서버 공부/휴식 책상, 선택적 제목 공유, 공동25/50분, 확정 인정시간 팀 숲.
- 완료: 개인 오늘 기본/전역5메뉴 유지; #together 진입. 개인 준비 후 명시적 팀 연결. private 카메라 모니터는 유지하되 영상 비공유; 운영 오류/lease 경고·연장은 보임.
- 완료: Task1/Task2/최종 전체+단일 fix wave 독립 spec/quality PASS. dense JSX는 비차단 유지보수 유보.
- 검증 상태: ai.ps1 verify PASS(Dune0위반, npm test/test:edge/mobile:check/build/docs:check exit0). 전체 실제 Chrome1205/1205·실패0·생략0·289651ms. 실제 SQL75/75·팀22/22·helper16/16·기존 카메라/lease6/6.
- 완료: Supabase bqohkdzvxbrokkmuhysx에 검증 migration만 적용(remote20261012235920/local20261012143354). RLS/grants/auth/search_path/3trigger/신호 publication 감사 완료. 실제 Auth 테스트 계정/팀·개인 데이터 생성/변경 없음.
- 완료: 기능 브랜치 push→Actions38325255408 success→Vercel dpl_42PCK6fVoqU6CMXx1YrtSCRyeciu READY/exactSHA/운영 alias HTTP200. 공개 Chrome375/1440 초대 로그인·취소 확인. main 직접 변경/머지 없음.
- 다음 단계: 본인+초대받은 정식 계정으로 실제 Realtime 상태/제목 동기화·팀 연결/개인 종료 후 숲 정산을 확인. Android16은 연결 기기0이라 별도 수용 필요; fixture 결과로 대체하지 않음.
- 주의: 숲은 개인 세션 종료 후 확정하고 과거 개인 시간을 소급하지 않음. 기존 정수 segment내림으로 split당1초 미만 기여 손실 가능; 개인 시간/출석 불변. 실제 동시 PostgreSQL race 수용 미확인.
- 주의: security advisor 기존 WARN 유지; 신규 private no-policy7INFO/guarded definer2WARN은 직접 권한/인증 감사와 분리 기록. ‘all clean’ 아님. 추가 Jev 호출은 외부 메타데이터 전송 정책으로 차단, 결과 없음/우회 안 함.
- 앱: 기존0.2.4/code7 hosted WebView에 공통 웹 반영. native/APK/서명/공개 설치 정보 변경 없음.
- 문서: prd-social-study-room.md, architecture-map.md, implementation-plan.md, docs/team-study/server-contract.md·verification-20261013.md, docs/superpowers/plans/2026-10-12-team-study-room.md.
- 작업 공간: C:/jini-dev/worktrees/study-room-team 및 로컬 검토 산출물 보존. 기존 study-room-recovery-audit/목업/별도 세션은 건드리지 않음.
- 이전 이력: 상한 초과 원본을 [202610 보관본](archive/active-context-202610.md)에 바이트 동일 보관. Git 실제 상태와 최신 progress/출시 증거를 우선.
