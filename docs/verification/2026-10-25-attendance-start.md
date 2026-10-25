# 공부 시작 출석과 하루 목표 분리 검증

## 계약과 구현

- [PRD](../../memory-bank/prd-attendance-start.md): 프로필 시간대의 04:00 공부일에 유효한 세션을 시작하면 즉시 출석이다. 평일 2시간·주말 4시간 목표는 별도 진척이며 목표 미달은 회복 사유가 아니다.
- 현재 공부일 무시작은 대기다. 공부일 종료 후 무시작이면 결석이며, 예약 작업 재개 시 이미 생성된 종료일의 대기도 최종화한다. 확정된 과거 행이나 누락된 모든 과거 날짜를 일괄 재작성하지 않는다.
- 시스템 해제는 `resolved/resolved_at/resolution_reason`으로 남기고 사용자 제출·보충 할 일을 만들지 않는다. 누적 회복에 과거 결석이 남으면 해당 범위와 개수를 유지한다.
- 인증·카메라·실제 시간·세션 유지·팀 기여·기존 회복 잠금과 무료 AI 정책은 유지한다. 네이티브 기능/APK 버전은 변경하지 않는다. Expo 대체 화면의 새 문구는 다음 APK에 포함한다.

## 검증 경로

- SQL은 실제 기존 04시·실제 공부·팀 함수에 선행/정책 migration을 순서대로 적용하는 PGlite fixture로 검사한다. 새로운 출석·회복 함수의 실행 결과를 확인하며 과거 migration 문자열 검사만으로 동작을 주장하지 않는다.
- 시작 전 오전 학습에서 출석 행이 없던 RED를 확인한 뒤, 시작 즉시 출석·2/4시간 분리를 구현했다. 취소/미래 세션, 새벽 경계·DST, 가입일, 회복 누적·시스템 해제·권한·중복 제출·팀 기여와 예약 작업 중단을 검사한다.
- 실제 React/Chrome의 375/1440px 합성 화면에서 출석 완료·공부 2시간·목표 4시간·진척 50%·회복 요청 없음과 문구 대비를 확인한다. README의 [PC](../images/attendance-study-goal-current-1440.png)·[모바일](../images/attendance-study-goal-current-375.png) 이미지는 실제 실행 화면이다.
- 기존 사용자 DUNE 설정/문서 변경은 보존하고 이번 커밋에 포함하지 않는다. 실제 휴대폰 추가 수용은 사용자가 연기한 범위로 유지한다. 실계정에서 새 세션·보충 할 일 생성이나 테스트 알림 발송을 하지 않는다.

## 운영 전환 순서

1. `20261025065931_atomic_slack_recovery_submission.sql`의 기존 스키마 호환 RPC 두 개를 적용한다. 서버 역할만 실행하며 원래 공개 함수 권한을 넓히지 않는다.
2. 새 `attendance-cron`·`slack-recovery-interactions`를 배포하고 ACTIVE·실제 소스 일치·원래 custom-secret/서명 검증을 확인한다.
3. 두 함수의 마지막 확인 시점부터 400초 이상 경과한 뒤 다음 단계로 간다. [Supabase 문서](https://supabase.com/docs/guides/functions/limits)의 최대 worker 수명(유료 400초, 무료 150초)을 보수적인 경계로 사용한다. READY만으로 이전 실행 요청의 종료를 주장하지 않는다. 이 시간에는 통합 검증을 수행한다.
4. `20261025065937_attendance_on_study_day_start.sql`을 적용한다. 현재 공부일만 보정하고, 데이터 보존·함수 권한·RLS·migration 등록·기존 예약 작업을 확인한다.
5. main의 기존 GitHub Actions로 웹을 배포하고, exact commit/READY/공개 HTML·JS와 본인 계정의 출석·목표·회복 표시를 확인한다.

## 실행 결과

- 통합 집중 검사: 실제 SQL 17개·Cron 2개·Slack 전송 경계 2개, 총 **21/21**, 실패·생략 0. 분담 checkout의 관련 확장 검사는 **162/162**였다. 웹 담당의 실제 Chrome 6/6과 관련 JS 46/46, README 이미지 참조 48개도 확인했다.
- 구조 검사에서 테스트가 스캔 밖 공용 fixture를 가져오는 새 위반을 발견했다. DB 테스트를 기존 SQL fixture 옆 `packages/core/test/attendance-start-db.test.mjs`로 이동하고 import만 수정했다. 같은 필수 테스트 glob에 계속 포함되며, 규칙·baseline·사용자 DUNE 설정은 바꾸지 않았다. 독립 리뷰가 본문 17개 테스트의 동일성을 확인했다.
- 선행 migration 적용 성공: local `20261025065931` → remote **`20261025070303`**, name `atomic_slack_recovery_submission`. 원격 자동 버전 차이를 기록하며 과거 이력 repair나 전체 `db push`는 하지 않았다. 두 새 RPC 모두 `search_path=''`, anon/authenticated 실행 불가, service_role만 실행 가능이다.
- Edge: **attendance-cron v47 / slack-recovery-interactions v29 ACTIVE**, 원격 소스 각 4/1파일 일치. 기존 `verify_jwt=false`와 본문 custom-secret/Slack 서명 검증을 유지했고 두 무인증 POST가 401이다. CLI 인증이 없어서 기존 인증된 Supabase MCP로 배포했으며 새 자격 증명을 만들지 않았다.
- 두 함수 마지막 확인 시각 **2026-10-25 07:04:18 UTC**부터 이전 worker 종료 경계를 계산한다. 이후 운영 로그에 Cron v47의 정상 200 응답 2건과 두 무인증 검사 401을 확인했다. 매분 예약 작업은 기존 설정 그대로 활성 상태다.
- 전체 Edge 타입·서버 검사 **23/23**, 실패 0. 최신 전체 실행은 실제 Chrome 포함 **1370/1370**, 실패·취소·생략 0이다. Python/JS 구문 132파일·모바일 타입·README 자산·웹 빌드도 통과했다. DUNE는 288파일/594간선·위반/기존예외/낡은예외 0이며 5개 검증 명령이 모두 exit0이다. 기존 동적 모듈 경고와 새 Cron 테스트의 고정 소스 transpile/data-import 경고는 수동 검토했으며 검사 규칙을 완화하지 않았다.
- 첫 전체 Chrome 실행에서는 기존 375px 설정 영역 복구 검사 1건이 실패했다. 같은 항목의 단독 TAP 실행은 1/1 통과했으며 원인은 아직 재현되지 않았다. 실패한 전체 실행을 통과로 계산하지 않고 중단했다. 합성 fixture의 실패 즉시 stack/DOM/화면을 남기도록 보강하고 동일 assertion·제한 시간·테스트 목록으로 전체 검증을 새로 실행한다. 최초 로그는 `output/attendance-start-verification-20261025/`, 재실행은 `output/attendance-start-verification-20261025-rerun/`에 분리했다.
- 재실행에서는 앞서 실패했던 375px 복구와 1440px 복구, 새 출석/목표 UI를 모두 통과했다. 초기 실패의 원인은 재현되지 않았으며 통과를 위해 assertion·시간 제한·검사 목록을 바꾸지 않았다.
- 마지막 Edge 확인 이후 **1413초** 경과 및 모든 통합 검증 성공 뒤 정책 migration 적용 성공: local **`20261025065937`** → remote **`20261025072758`**, name `attendance_on_study_day_start`. 6개 관련 함수의 역할 행렬·빈 search_path, 3개 테이블 RLS, 새 pending 인덱스를 실제 원격에서 확인했다. Advisor 조회의 기존 경고는 그대로이며 모든 보안 경고가 해소됐다고 주장하지 않는다.
- 정책 적용 직전/직후 **9개 학습 테이블 + 과거 확정 출석·제출 회복·카메라 회복**, 총 **12개 범위의 건수·내용 해시가 모두 동일**하다. 원본 학습·할 일·회고를 삭제하거나 수정하지 않았다. 내부 해시 보고서는 ignored 출력에만 보관한다.
- 본인 계정의 현재 공부일이 `present`이며 목표 미달인 기존 누적 시간·목표와 선택 시간대를 유지한다. 현재 pending 회복은 0개다. 해당 날짜의 회복은 정책 적용 전에 이미 제출되어 있어 그대로 보존했다. 미제출 누적 회복은 실제 남은 과거 결석을 유지하도록 현재 공부일만 제외한다. 검증을 위해 실계정 세션이나 보충 할 일을 임의로 생성하지 않았다.

## 웹 출시·실제 계정 확인

- 기능 커밋 **`c5eac1e3d518309b9dd88927a98dc158caa170ce`**, 저장소 `zxcc9867/studyRoom`, `main` 일반 push·원격 SHA 일치 확인.
- [GitHub Actions 40173077774](https://github.com/zxcc9867/studyRoom/actions/runs/40173077774) **success**. 테스트·모바일 타입·README·Edge·빌드와 기존 무료 코칭/브리핑 합성 확인을 모두 통과했다. CI의 선택 브라우저 생략 여부와 로컬 Chrome 1370/1370 결과는 구분한다.
- Vercel **`dpl_D8rDG15x7gFk2cBz8Riez72o43Jy` / READY / production**, 프로젝트 `prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g`·branch main·배포 SHA가 위 기능 커밋과 정확히 일치한다.
- [운영 URL](https://study-room-attendance.vercel.app/) **HTTP200**, 새 `/assets/index-Dp7H8nXC.js` **HTTP200 / application/javascript**, 290949bytes와 새 `focus-goal-status` UI 코드 확인. 기존 alias가 새 배포를 가리킨다.
- 운영 브라우저에서 유휴 상태와 입력 폼이 없음을 확인한 뒤 새 화면을 불러왔다. 기존 본인 로그인으로 **출석 완료·공부 2시간·목표 4시간·진척 50%·공부 목표 진행 중**이 동시에 표시되며, 회복 요청 모달과 이전 자동 종료 메시지가 다시 나타나지 않는다. 새 공부·실제 알림 발송·회복 대리 제출은 하지 않았다.
- README 3개 언어의 기능 설명·실제 합성 화면과 PRD/설계/구현/진행/문제 해결 문서를 갱신했다. 초기 미재현 검사 실패와 실제 휴대폰 수용 보류를 숨기지 않는다. 원격 DB 다중 연결 경합·실휴대폰 추가 수용은 이번 결과로 완료를 주장하지 않는다.
- 이 기록의 후속 커밋은 문서만 갱신하며 `[skip ci]`로 위 기능 배포를 유지한다. 최신 Git HEAD와 실제 배포 코드 SHA가 다를 수 있으며, 운영 소스 기준은 위 기능 SHA다.
