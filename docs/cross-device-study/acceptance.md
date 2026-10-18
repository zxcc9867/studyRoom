# 동일 계정 공부·카메라 상태 동기화 검증

## 범위와 결과

- 사용자 승인: 영상 공유 제외, PC 담당 감시를 모바일에 상태로 반영, 추가 카메라 인증·잘못된 Slack 경고 차단, 기존 학습 기록 보존.
- 구현: 계정 공통 snapshot, 단일 문서 담당·generation,10초 heartbeat/45초 유효 상태, Realtime3테이블+15초 foreground fallback. 영상·프레임·랜드마크·음성 전송 없음.
- 관찰 기기는 카메라 요청/감지/제외 checkpoint/경고/로컬 inactivity·lease 자동 종료를 실행하지 않는다. 일반 재개는 공통 세션만 변경한다. 명시적 이어서 공부 버튼만 담당을 전환한다.
- 서버/웹 독립 검토 보완 후 PASS. 운영 DB·Edge·웹 배포 완료, 실제 동일계정 Android 수용은 사용자 로그인 보류로 미완이다.

## 로컬 검증

- 최종 실제 Chrome 전체:1326/1326, 실패0·생략0,203867ms. 명령은 기존 npm test와 같은 전체 파일 목록에 `node --test --test-concurrency=2`, 실제 Chrome 모듈/실행 파일을 지정했다. 선행 미커밋 운영 테스트15개도 이 로컬 목록에 포함된다.
- `ai.ps1 verify --project C:/jini-dev/worktrees/study-room-team`: Dune0위반, npm test/test:edge/mobile:check/build/docs:check 모두exit0. 선택적 브라우저 검사는 위 실제 실행으로 별도 입증했다.
- 담당/경고/구형 lifecycle/일정 정규화 SQL+실제 Edge handler+기존 실제 공부:87/87. helper16/16. 관찰·전환·취소·원격 휴식·기존 카메라 복귀를 실제 main 마운트로 검사했다.
- RED 근거: missing RPC8, legacy observer 제외값/직접 경고 INSERT5, 시간 지정 재개19:05→19:00, camera:null 재개 claim누락, 늦은claim이 새track종료, 이전report가 새generation덮어쓰기,600초 경계/lease 만료 제외값, 복구 후 원격휴식 재개를 각각 재현 후 GREEN.
- 초기 제한환경 DNS/loopback 실패는 허용환경 동일 검사로 구분했다. 전체 Chrome 첫 실행의 외부 폰트 CDN 대기는 테스트 transport에서 폰트 CSS만 고정하고 DOM/실제 컨트롤 준비를 기다리도록 수정했다. 제품의 UI/서버 성공 조건은 생략하지 않았다.
- 기존 mounted harness를 재사용하고 worker 원문 보고서는 ignored SDD workspace에 보관했다. 별도 중복 harness/제품 구조를 만들지 않았다.

## 운영 DB·Edge

- 대상: 독서실 Supabase `bqohkdzvxbrokkmuhysx`만 사용했다.
- MCP apply가 두 번 `Invalid or expired requestState`로 실패했고 두 번 모두 미적용을 조회했다. 공식 CLI의 명시 프로젝트 `db query --linked`로 migration 소스와 새 history20261018100359/name study_device_camera_sync를 한 트랜잭션으로 적용했다. 과거 history repair/전체 db push는 하지 않았다.
- 추가 테이블 `study_camera_sessions`,3RPC, 잠긴 private 원본 함수, 기존 공개 checkpoint/end/preview 진입점 wrapper, warning INSERT 정책을 적용했다. 과거 학습 행 DML/초기화 없음.
- 적용 전10:52:42UTC→후11:34:42UTC, 아래13테이블 count/content MD5가 모두 동일했다. 숫자는 실행 시점 전체 행수이며 이후 정상 공부로 증가할 수 있다.

| 테이블 | 행수 |
|---|---:|
| profiles |3|
| attendance_days |283|
| study_sessions |165|
| study_todos / study_todo_plans |279 /279|
| study_goals |2|
| study_session_todos |143|
| study_actual_sessions |44|
| study_todo_segments |150|
| study_schedule_adjustments |5|
| study_session_reflections |14|
| study_recovery_requests |152|
| study_presence_events |490|

- 원격 감사: RLS=true, authenticated SELECT=true/INSERT=false, private schema USAGE=false, warning RPC authenticated EXECUTE=false/service_role=true, Realtime3테이블 등록. migration 직후 camera행0: 단순 조회/배포가 담당권을 만들지 않았다.
- Edge `camera-presence-warning` v24 ACTIVE, SHA256 `5cb4f29b5f3cd22d8a525de69739896e44b2f606fca12cc1f716d786c2346671`. 기존 verify_jwt=false와 내부 auth.getUser 검증 유지. 무인증POST401.
- Security advisor INFO1/WARN4 그룹 건수는 전후 동일. 새 guarded public definer RPC는 기존 authenticated-definer WARN 그룹에 포함되므로 ‘신규 보안 경고 없음/완전 깨끗함’으로 확대하지 않는다. 의도된 경계는 RLS·auth·실행 권한으로 확인했다. [공식 경고 설명](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## 출시·실제 기기 경계

- 웹 제품 커밋 `2cc16ae2e91c9aba71f778b94f1b6ba8c7540d99`, feature 브랜치 커밋·push 완료. [Actions39124089277](https://github.com/zxcc9867/studyRoom/actions/runs/39124089277) success. Vercel `dpl_3SeFFy37p24zH8SqCAzGdqgYtBaS` production READY, project/ref/exactSHA/alias 일치. 운영HTTP200·새 `/assets/index-B0R1KYaX.js`200·공통snapshot/담당권/이어받기 코드 포함 확인.
- 새 APK/native 변경 없음. 기존0.2.4/code7의 hosted 웹 재연결로 반영한다. APK 버전·서명·최초설치일은 변경하지 않았다.
- Android16 기존0.2.4/code7·기존 로그인 상태를 확인하고, 사용자 승인 후 미저장 회복 초안만 닫았다. 서버 회복/학습 기록은 수정하지 않았다.
- 설정의 계정 지문 대조 결과 에뮬레이터와 현재PC 계정이 달랐다. 사용자가 ‘로그인은 나중에 진행’을 선택했으므로 계정 전환/회복 대리 제출/기록 우회를 하지 않는다.
- 배포 후 앱을 앞으로 가져와 버전0.2.4/code7·최초설치9/29 유지와 native 로그인 화면을 확인했다. WebView 대상이 없어 인증 후 새 hosted웹 재조회까지 확인한 것으로 기록하지 않는다. 로그아웃 발생 원인은 이번 관찰만으로 단정하지 않는다. 재로그인은 사용자 선택대로 진행하지 않았다.
- 동일 계정 실제 PC→에뮬레이터 카메라 감시 동기화, 실제5분 Slack 무발송 관찰, 담당 전환 실기기 수용은 아직 미완이다. 로컬 mounted/SQL 통과를 실제 기기 수용으로 표현하지 않는다.
- 사용자 PC 진행 중 공부·카메라는 제어/종료/강제 새로고침하지 않았다. 구형 실행 탭에는 담당 신호가 없으므로 새 화면에서 ‘감시 상태 확인 필요’가 표시될 수 있다. 새 코드는 다음 안전한 재접속 후 사용한다.
