# 2026-10-31 main 통합

## 범위

- 사용자 승인: 최신 `fix/study-dashboard-clarity`를 main에 통합해 기본 저장소와 운영 코드를 맞춘다.
- repository: `https://github.com/zxcc9867/studyRoom`; main base `9f381ab49034abf173306b857328fae850698f47`; source `d83dabbecdf6f740f1c56aad99d002b51362a0f4` (18 commits).
- 로컬 main을 fast-forward했고 3개 언어 README 기능 설명을 보완했다. 기존 운영 제품 SHA `bda9e895553fab9a9117421824de8b69ad783802`의 제품 동작을 변경하지 않는다.
- 기존 미커밋 tracked 7개는 검증된 외부 백업과 stash로 분리했으며 기존 untracked 135개 파일의 해시를 보관했다. 개인정보·키·기존 사용자 수정은 이번 커밋에 포함하지 않는다.

## 검증

- 통합 전 source 확인: main은 source의 조상이며 충돌 없는 fast-forward. Supabase/Edge/server/core diff 없음.
- 독립 사전 검토: main push CI 경로 유지, desktop manifest/lock pin 일치. Windows 후속 소스 누락은 기존 후속으로 구분한다.
- `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund`: 성공·949패키지/잠금 변경 없음. 새 Electron 바이너리나 설치 파일을 받지 않았다. 설치 스크립트 정책으로 일부 패키지 hook이 차단됐다는 경고를 유지하며 정책을 변경하지 않았다. 이후 실제 빌드·검사는 통과했다.
- `npm run desktop:check`: 문법·고정 버전11파일 통과. `npm run desktop:test`: **119/119**, 실패·생략0. 앞선 읽기 전용 감사에서 의존성 미설치로 미확인이던 storage 검사도 포함한다.
- `python .dune/check.py --root . --verify --json`: **passed**,296파일/616간선·위반0·baseline0·stale0. syntax·fixed-input tests(기존 concurrency1)·mobile:check·docs:check·build **5명령 모두 exit0**. 기존 computed-module 경고2건은 소스가 동일하며 이전 수동 검토 범위를 유지한다. 이 로컬 설정의 source graph와 별도 desktop 검사 범위를 구분한다.
- `npm run test:edge`: 기존12개 Edge 진입점의 타입 검사 및 **23/23** 격리 검사 통과. 운영 배포·실계정·외부 알림을 실행하지 않았다.
- README 검사 **54개 이미지 참조/3언어** 통과. README 독립 검토는 새 문서/이미지9종 존재와 사실·범위 일치를 확인했으며 차단 사항이 없다. `git diff --check` 통과.
- 10/29 기록의 최종 Chrome1519항목은 최초1518/1실패 뒤 해당 파일201/201 재검증과 나머지1318의 합이다. 이번에는 제품 소스가 동일함을 확인하고 기존 필수 게이트를 실행했으며 전체 실제 Chrome 수용을 새로 반복한 것으로 표시하지 않는다.
- README의 기존 합성 React 캡처를 재사용했다. 이번 통합을 실계정 로그인·실휴대폰·Electron 설치판의 새 수용으로 표시하지 않는다.

## 원격 확인

- 통합 전 운영: Actions40894773028 success; Vercel `dpl_uV9N15iRrjaHZtCziq5cnNN1Ffsg` READY/production, exact source `bda9e89`, alias `study-room-attendance.vercel.app`.
- 공개 운영 HTML, `/assets/index-ByIyBLyx.js`, `/assets/index-CwvhYFyG.css` HTTP200; 새 appearance와 기존 출석/목표 UI 포함.
- main push와 이후 배포의 실제 SHA·CI·READY·alias·HTTP 결과는 완료 후 갱신한다.

## 남은 범위

- Git의 Windows 앱은 0.1.1이며 문서의 별도 설치판0.1.9 후속 native 수정/검증 자료는 이 PC에서 확보하지 못했다. 이번 통합은 해당 수정의 복원이나 설치 파일 게시가 아니다.
- 번역은 10/29 무료 공급자/앱 한도 소진 관측 이력이 있다. 이번 작업은 키·예산·공급자를 변경하거나 현재 번역 복구를 확인하지 않는다.
- 실휴대폰의 장시간 배경·카메라 담당 이전·물리 착석·DND, 두 정식 계정과 격리 PostgreSQL 다중 연결 수용은 후속이다.
