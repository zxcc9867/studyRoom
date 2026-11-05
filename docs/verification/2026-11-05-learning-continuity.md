# 다음 시작점·학습 결과 구현 검증

## 범위와 승인
- 작업 시작 HEAD123c835, feature branch fix/study-dashboard-clarity, 운영 선행75ab1da. 기존 dirty 문서·output은 보존한다.
- 사용자 승인: 목업3장, 할 일 A/B 자유 선택·북마크 분리, 지난날 미완료는 일정 확인 후 동일 할 일 날짜만 오늘로 이동. 기존 기록/정책은 유지한다.
- 정식 요구사항: memory-bank/prd-learning-continuity.md. 실행 계획: docs/superpowers/plans/2026-11-05-learning-continuity.md.
- 진행 상태: 로컬 구현·검증·최종 독립검토 완료. 운영 기록 무결성 조회 동의 대기이며 원격 migration/배포는 아직 하지 않았다.

## 사전 확인
- linked worktree/기능 branch 확인, git fetch 성공. 기존 관련 회고·리포트 단위16/16·실패/생략/취소0·exit0.
- 운영 next-js(bqohkdzvxbrokkmuhysx) ACTIVE_HEALTHY, MCP 읽기 접근 가능. legacy reflection의 focus/energy NOT NULL, note500/next_action160, owner RLS.
- 원격 reflection RLS는 user_id 소유 검사뿐이며 더 엄격한 local20260720 정책과 차이가 있다. 새 기능은 로컬 정책에 의존하지 않고 직접 쓰기와 RPC의 session/context 소유·연결 검증을 별도로 추가한다.
- 원격 선행 정의 해시: complete_study_session7ba01528e52255d6db904f98aa0bd743, end_study_session16bac6547b61a3024744104b6240ee0f, preview_actual_study_action63cce108d9b72c5b28ccab5293deaee8, confirm_actual_study_action0e0f556c99f3fe37dea55297f567c82e, snapshot_todoc74d77c344eaad1371427fa6be5f1a75. 적용 전후 재확인한다.
- 기존 security advisors: INFO RLS 정책없음26(서버전용 포함); WARN mutable search_path2, public extension1, authenticated SECURITY DEFINER21(기존 guarded API), leaked-password-protection1. 이번 요청으로 설정/권한을 광범위하게 변경하지 않는다.
- 공식 Supabase 변경 색인/RLS/invoker 문서 확인. web 도구 markdown 형식 불가 및 제한환경 DNS 실패 뒤 같은 공개URL의 허용된 HTTP200 조회로 확인했다. 이 기능에 필요한 SDK/DB 업그레이드는 발견하지 않았다.

## 보존 원칙
- 새 metadata는 확장형 migration으로 추가하고 옛 회고의 note/next_action/점수를 일괄 변환하지 않는다.
- nullable 미입력은 평균에서 제외한다. 새 작성 note만 learning_result, 결과 수정은 같은 회고 행·expectedUpdatedAt 일치 때만 한다.
- 새 완료 wrapper는 기존 종료/정산을 한 트랜잭션에서 호출한다. 추가 저장 실패 시 세션 종료·할 일 완료까지 rollback되어야 한다.
- 실제 계정 테스트 입력/앱 종료·새로고침/테마·카메라·학습 조작은 하지 않았다. 원격 migration은 독립 검토·검증 후 적용한다.
- 운영 문제가 생기면 이전 웹 배포를 선택하고 확장 DB/새 입력은 유지한다. 파괴적 schema DOWN·미입력 점수 백필·과거 데이터 덮어쓰기를 자동 수행하지 않는다.

## 현재 남은 게이트
- Task1 로컬 완료f3a3517: 집중30/30·확장116/116·build/Dune0. 독립 shared-reviewer spec준수/품질승인·C0/I0/M0, 세션 cascade 삭제 의심은 메모리 전용 단일 사례 SESSION_DELETE_OK/exit0로 해소. 원격/실계정 쓰기는 없다.
- 운영 추가 사전확인: reflection 사용자 trigger 없음, session links UNIQUE(session_id,todo_id)와 기존 owner composite FK 존재, 신규 private schema 미존재. 기존 정책·함수를 변경하지 않고 확장할 수 있는 구조다.
- PostgreSQL17.6 확인. todo에는 기존 snapshot/coach/touch_updated_at trigger가 있으며 날짜 이동에서 파생 coach 시각·revision은 그 경로를 따른다. title signal과 완료/시간 변경 알림 trigger는 확장하지 않는다.
- 잠금 한계: 날짜 이동은 짧은 TABLE-WIDE session 쓰기 fence/NOWAIT 뒤 todo table/row NOWAIT다. 실제 multi-connection 지연·경합은 PGlite로 검증하지 않았고 deadlock-free 입증으로 표현하지 않는다. UI는55P03을 명시 재시도로 처리해야 한다.
- Task2 실제 Chrome 최초9건은 localhost ERR_NETWORK_ACCESS_DENIED 환경 실패였으며 RED로 세지 않는다. 같은 허용 실행은9/9가 신규 영역/입력/재시도 미구현으로 실패·생략0·72.59초(의도한 RED). 구현7ac8418 신규34/34(생략0·75.49초), 기존관련14/14, 계약25/25, 실제build1758modules 통과. 합성 화면375/1440·light/dark·CSS글자200% 증거이며 물리 OS 확대 수용은 아니다.
- Task2 독립검토 C0/I2/M2: active/record 조회오류 안내·재시도, 미지원 전환 capability 해제, 공통 radius 토큰, 날짜이동 revision 재확인. fix53a6598의 신규6RED→6GREEN/Chrome44/44·기존적응16/16 확인 후 scoped reviewer 모두 ADDRESSED/new C/I/M0. 전역 appTheme.css 재정의 대신 feature-scoped CSS가 기존 토큰을 소비한다.
- 공식 첫 실행 Dune0위반·desktop check/test·edge·mobile·build·docs 6게이트 통과, npm test1730중1264pass/6fail/460skip. data-URL import harness2/추출 함수 의존성2/변경된 화면 source 계약2 실패를 원 worker가 기존 행동 검사를 보존해 수정 중이다. 로그 output/learning-continuity-official-20261105.log 및 learning-continuity-npm-test-20261105.log.
- 위 회귀는 실제 모듈 절대URL·추출handler 환경·신규/legacy 양쪽 분기 검사로 보완했으며 기존 assertions를 제거하지 않았다. 제한환경 localhost EACCES1은 환경 실패다. 허용 npm1747중1277pass/0fail/470skip, 기본 생략470은 실제 수용으로 세지 않는다. ai.ps1 verify7/Dune0 exit0(53a6598), output/learning-continuity-official-final-20261105.log.
- Whole-feature 검토 C0/I1/M0: 원격/만료로 원래 세션이 회고 없이 완료되면 보존 초안 저장이 무동작. 실제 handler 추출 진단(브라우저 재현 아님) 뒤 ONE final fix76815b3에서 원래 세션의 소유/상태 조회→명시 승인→동일 mounted 초안 follow-up 생성으로 복구했다. 재조회·모드 전환은 쓰기0건, 새 활성 세션/정산/할 일은 변경하지 않는다. 신규48/48·기존14/14·read11/11, scoped 재검토 ADDRESSED/Ready Yes/new C/I/M0. 최종 공식7/Dune0 exit0 재확인.
- 전체Chrome53a는 command/PID로 소유를 확인한 test tree83148만 중단했다(exit1); partial output은 완료 근거가 아니다. 최종76815b3의 exact repository suite/max2 isolated files/no retries는 output/learning-continuity-full-chrome-76815b3-20261105.log로 새 실행 중이다. 모든 source를 고정하며 종료/총계까지 확인한다.
- 현재 runtime 한계: Windows GUI 도구 없음·ADB 복구 후 연결0/AVD꺼짐·Electron 로컬 실행파일 미설치. 사용자 설치앱/실제 프로필을 격리 테스트 대용으로 사용하거나 새로고침하지 않는다. 물리 카메라·실제 다중 연결 경합·설치 앱 acceptance는 별도로 남긴다.
- 최종76815b3 공식7/Dune0 exit0, output/learning-continuity-official-76815b3-20261105.log. 실제 Chrome 전체1751/1751·실패/생략/취소0·exit0·1115845.6014ms(max2 isolated test files), output/learning-continuity-full-chrome-76815b3-20261105.log. 보호 범위 desktop/mobile/core/카메라 판정/Edge diff0, 최종 source uncommitted diff0. Whole-feature+ONE fix scoped review Ready Yes/new C/I/M0.
- 운영 보존 검증의8종 건수·원문 기반 무결성 해시 조회는 도구가 민감 파생정보의 명시 동의 부재로 거부했다. 실제 값은 반환받지 않았고 다른 도구/SQL로 우회하지 않았다. 원문·사용자ID·이메일 없는 건수/비교 지문 조회의 별도 동의를 요청했으며, 승인 전 원격DDL/배포는 보류한다.
- 원격 기존 열 count/digest·기존 함수/권한 비교, reviewed migration 적용/관계/권한/advisor 확인.
- feature branch push·정확 SHA Actions success/Vercel READY/운영HTTP200/new UI는 미실행. 로컬 제품f3a3517/7ac8418/53a6598/76815b3, 새 기능 운영 변경은 없다.
