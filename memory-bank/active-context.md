# Active Context

- 갱신: 2026-10-15 · 도구: codex
- 브랜치: feat/team-study-room · 제품616f38c05ccd9f0d620d4ef50963393f9e1d6f91 push/배포 완료. 출시 근거는 문서 후속 커밋에 기록. 기존 .serena/output 보존.
- 목표 / 완료 기준: 회원 개인 공부 자동 팀 집계·목표 저장 즉시 공유·팀장 표시·탈퇴 모달. 기존 개인 라이프사이클 보존·SQL/실제Chrome/전체게이트·독립 검토·DB/웹 배포 확인.
- 완료(운영): 기존 private 연결/실제 공부 구간 재사용. 팀 화면 미마운트에도 시작/재개 자동 반영, 공부 중 가입/생성은 checkpoint부터. 출시 당시 활성 회원도 출시 이후만 집계.
- 완료(운영): 목표 입력/저장만, 새 저장은 공유. 이전 비공개 목표·현재 할 일 제목 opt-in·개인 전체 이력 비공개 유지. 긴 안내/수동 연결 삭제, 팀장 배지, AccessibleDialog 탈퇴/위임/해산.
- 보존: 개인 오늘 기본·전역5메뉴·공개 태그는 설정. 개인 카메라/회복/lease/04시 공부일/출석/DND·실제 인정 시간·종료 회고·회원 유지 불변. native/APK0.2.4/code7 변경 없음.
- 검증: 새 SQL13/13 PASS(초기 red7)·최신04시 시작/preview. 모달4/4(초기 red2), 전체 실제 Chrome1237/1237·실패0·생략0·272313ms. 최종 ai.ps1 verify PASS(Dune0·5명령 exit0). 독립 검토 잠금 역순/가입 경합 보완 후 재검토PASS.
- 서버 보강: INSERT/가입 공통 사용자 advisory, UPDATE에는 적용 금지. 개인 BEFORE 재개 후 AFTER 자동 연결. 시작 신호는 팀 잠금 이후. 사전 잠금 외 세션 발견 시 RETRY와 전체 mutation rollback.
- DB 적용: 추가 local20261015035420→remote20261015041209. 실제 grants/search_path/trigger/guards 감사·계정 없는 요청 거절 확인. advisors 전후 WARN/INFO 건수 불변. 실계정/팀 테스트 데이터 생성 없음.
- 출시 완료: Actions38680437289 success·Vercel dpl_2BFELdQyR6kYZeF1X95C4E8pAaN4 production READY/exactSHA/alias HTTP200. 공개 Chrome375/1440 로그인 필요·초대 취소·새 chunk200/이전 수동 UI 문구 부재. 출시 직후 error/fatal 그룹 행 없음은 단기 근거뿐.
- 다음 단계: 실제 두 정식 계정에서 공부/휴식 상태·목표·팀장 위임과 Android16 수용. 공부 중 가입·재개 경합의 실제 PostgreSQL 다중 연결 부하 검증은 별도. main 직접 수정/머지 없음.
- 미확인: 실제2계정 Realtime·Android16·동시 PostgreSQL 연결 수용. PGlite 역할/인위적 경합·mounted fixture를 실제 수용과 혼동하지 않음.
- 운영 주소: https://study-room-attendance.vercel.app. 이전 배포 Actions38371768257 / dpl_6qvESW5Tjj3io7ZKqH3M4dDhgNuR은 rollback 참고. 서버 자동 정책/새 데이터는 웹 rollback만으로 삭제하지 않음.
- 문서: prd-social-study-room·architecture-map·server-contract·automatic-study-20261015·progress. 6천 줄 troubleshooting은 archive/trouble-shooting-202610.md로 보존하고 요약본 사용.
- 작업 공간: C:/jini-dev/worktrees/study-room-team. owner codex-team-auto-20261015 claim은 작업 종료 시 해제. 다른 worktree/목업 보존. [기존 Active 보관본](archive/active-context-202610.md).
