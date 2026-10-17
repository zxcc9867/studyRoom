# 일정 변경0개 확인창 개선

## 요청과 원인

- 승인: 2026-10-17 최신 상태 확인은 유지하되 실제 변경 일정0개면 확인창 없이 공부 시작,1개 이상일 때만 확인창 표시 및 운영 배포.
- 기존 동작: preview가 분 경계에 만료되거나 카메라 제외 시간이 변하거나 서버가 stale을 반환하면 무조건 새 제안 review. 전환도 변경 유무와 무관하게 확인창 표시.
- 따라서 시간 미지정 할 일처럼 실제 일정 변경이 없는데도 `0개 일정`과 재확인 버튼이 노출됐다. 이 증상은 회복 루틴이나 DB 장애를 의미하지 않는다.

## 변경과 안전 경계

- `main.tsx`: 처음 받은 제안도 실제 changes1개 이상일 때만 일정 확인창 표시. 현재 할 일1개만 이동해도 확인 필요.
- `actualStudy.mjs`: 만료/카메라 제외/stale이면 최신 제안 재조회. 실제 변경이 없으면 서버 confirm을 진행하고, 변경이 생기면 확정 전에 동의를 기다린다. stale 자동 확정 시도는 최대3회.
- `ActualStudyDialogs.tsx`: 통신 결과가 불확실할 때의 결과 복구창과 일정 변경창을 구분한다. 무변경 결과 복구에 `0개 일정`은 표시하지 않는다.
- 최신 확정 요청 UUID/preview를 보존하여 불확실한 결과 확인은 같은 요청을 사용한다. 회복/계정/취소/소유권/카메라/서버 시각 검증을 생략하지 않는다.
- DB/RPC/API 계약·학습 기록·출석·집중 모드·native/APK 변경 없음. Android는 같은 hosted 웹을 사용하므로 별도 APK 빌드 대상이 아니다.

## 검증

- TDD: 단위 초기13통과/4실패 → 수정 후17/17. mounted 신규 초기1통과/5실패 → 수정 후6/6. 독립 검토 후 무변경 재개를 추가한 집중7/7(12166ms).
- Chrome 실제 main mounted 최종 전체92/92·실패0·생략0(245609ms). 375/1440px 무변경 stale 시작, 무변경 전환/재개, 현재 일정만 변경, 재검증 중 변경 발생, 불확실 결과 동일 요청을 검증했다.
- `ai.ps1 verify --project C:/jini-dev/worktrees/study-room-team`: Dune0, `npm.cmd test`, `test:edge`, `mobile:check`, `build`, `docs:check` 모두exit0.
- 독립 shared-reviewer: 지정 생산 코드/테스트/PRD에서 Critical/Important/Minor0, 단위17/17 독립 실행. 추가 권장 재개 사례와 근거 문서까지 재검토 후 결함0.
- 제한환경 재실행의 Chrome `ERR_NETWORK_ACCESS_DENIED`7건은 localhost 초기접속 차단이었다. 허용환경에서 같은 집중 명령7/7. 제품 코드나 테스트 timeout 우회로 해결하지 않았다.
- 실제 운영 사용자의 공부/카메라/할 일/회복 데이터는 이 검증에서 조작하지 않았다. 운영 로그인 후 lifecycle/실휴대폰 수용과 로컬 fixture 검증은 구분한다.

## 출시

- 기능 브랜치 `feat/team-study-room`, 제품 커밋 `593fb483b5e51fa924fcd72408705193f5882e1c` 범위 지정 커밋·푸시 완료. 선행 운영 개선/수용 기록 등 다른 미커밋 파일은 포함하지 않았다.
- 기존 `vercel-production.yml` workflow_dispatch [Actions39035949437](https://github.com/zxcc9867/studyRoom/actions/runs/39035949437) success(3분2초). 테스트/Edge/모바일 호환성/빌드/기존 무료 AI synthetic 검사 통과.
- Vercel `dpl_Ak1Lt5yHAbRdQGJX1iXFwNvuJbHK`: production `READY`, 프로젝트 `prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g`/`study-room-attendance`, GitHub `zxcc9867/studyRoom`, 위 정확한SHA와 기능ref 확인.
- 고정 운영 주소 [독서실](https://study-room-attendance.vercel.app) HTTP200. `/assets/index-Cv249cbL.js` HTTP200 및 신규 재검증 제한 코드 marker 확인. 이 파일 확인은 운영 실계정 lifecycle 검증을 대신하지 않는다.
- 기존 공부 중인 사용자 화면은 강제 새로고침하지 않았다. 공부를 마친 뒤 웹 새로고침/앱 웹 화면 재연결로 최신 화면을 불러오면 된다. 새 APK 설치는 필요하지 않다.
