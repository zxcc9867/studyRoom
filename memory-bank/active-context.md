# Active Context
- 2026-11-14 · codex-scenic-current-1114 · 풍경 제목에서 이전 회고를 분리한다. 일치하는 활성 세션의 현재 할 일만 표시, 준비 상태에서는 중립 안내와 새 할 일 선택. 회고/기존 시작점·출석·카메라·서버 기록 불변. [PRD](prd-scenic-study.md).
- 운영 완료: 제품 `b8bbf6d` feature push, Chrome18/18·공식7/Dune0·독립 검토. Actions43599321054 success, Vercel `dpl_2prYTVBV5sNmGRDsDkMnVAwGSAuU` READY/exactSHA/alias/HTML·JS200. [검증](../docs/verification/2026-11-14-scenic-current-task.md).
- 2026-11-12 · codex-attendance-timing-1112 · fix/study-dashboard-clarity: 사용자 승인으로 기록의 출석 캘린더에 날짜별 출석·첫 시작·목표 표시. 저장된 일자 알림 +15분 전 정시/이후 늦음, 출석과 분리한다. 기존 04:00 미시작 결석/Slack·회복과 목표 미달 미알림 유지. DB·Edge·기존 학습 기록 불변. [PRD](prd-attendance-start.md).
- 운영 완료: 제품 `17b131d` feature push, Chrome7/7·집중39/39·공식7/Dune0·독립 재검토. Actions43241985708 success, Vercel `dpl_BxF4s3o8M5qbxw68RAArimfrkEq2` READY/exactSHA/alias/HTML·JS·CSS200. 실계정/알림 시험 발송 없음. [검증](../docs/verification/2026-11-12-attendance-timing.md).
- 2026-11-09 · codex-scenic-entry-1109 · fix/study-dashboard-clarity: ‘다른 할 일 선택’ 시작 성공 시 풍경 자동 진입, 같은 활성 세션에만 배경 ID 공유. 기기 기본 배경·재생 설정 및 카메라 소유권·기존 기록은 유지한다. ‘잠시 쉬기’는 촬영을 멈추되 기존 담당 PC를 유지하며, 다른 PC에서 재개 후 상태·설정의 명시적 이어서 공부로 넘긴다.
- 운영 완료: 제품 `724eb70` feature push, migration 로컬 `20261109104251`/운영 `20261109105756`의 활성 소유자 권한 및 기존 함수 지문 일치. Chrome45/45·집중96/96·공식7/Dune0·독립 재검토 통과. Actions42605218484 success, Vercel `dpl_Ch97PGBi5yLF8gQisDSJEZtyrC5f` READY/exactSHA/alias/HTML·JS·CSS200. 실제 계정/물리 카메라 미검증, AWS PR #2·기본 브랜치·네이티브 변경 없음. [검증](../docs/verification/2026-11-09-session-scenery.md).
- 2026-11-07 · codex-anime-lighthouse-1107 · fix/study-dashboard-clarity 제품 `4bfead1` 푸시·운영배포 완료: 승인된 고리 행성 없는 ‘은하가 비치는 등대’ 24초 무음 영상, 720/1080 WebM·포스터·썸네일. 11-08 09:00 JST/KST AWS PR #2 Slack 1회 개인 알림은 예약 완료, 중복 생성 금지.
- [원본/재현](../docs/media/anime-lighthouse/README.md). HyperFrames check a194d00f 오류0(무음 의도)·로컬 GPU 720프레임, FFmpeg 두 파일 프레임/경계·SHA·독립 검토 통과. 최종 영상 Chrome 375/1440 실제 움직임·loop·auto 720/1080·crop·공부 데이터 보존 확인. 공식7/Dune0·전체 Chrome 분할 1,774 고유 항목 통과(15→16 기대 수정 6개 재검증)·기본 npm 실패0·14해시 일치.
- 출시: Actions42382436784 success/정확 SHA·Vercel dpl_CA42yf7DjLo46PwjFqGw3bU3u2E4 READY/운영 alias/HTTP200·영상2Range206·공개4해시/운영Chrome loop2/2. 필수 후속 없음. 실제설치/물리카메라 미검증, 공부 기록·카메라·계정·DB·네이티브 및 기존 dirty 문서·output 보존. 회귀 시 이전 웹 배포 dpl_FHQj4t1MSVsoxMUum5cwnnzBVyjJ가 롤백 후보다.
- 2026-11-07 · codex-camera-recovery-1107: 사용자 승인 회복 정책 구현·운영배포 완료. 기존 공부일 안에서 서버가 5분 이상 확인한 별도 미감지 구간 3회, 기존 제출 포함 하루 1회. 감지·경고·제외·기록/결석 유지. 구 정책 및 미리보기 출시는 아래 이력.
- 변경/검증: 20261107053852 SQL 비공개 구간·heartbeat·legacy INSERT fence, camera-presence-warning 전달 전용. 집중 73/73·계약 48/48·공식7/Dune0·독립 I2 해결/최종 C/I/M0·diff 통과. 제품 `1af2f23` feature push; Edge25 ACTIVE/파일 일치/OPTIONS204/비인증401 → DB 운영20261107055421/트리거·본문·권한 확인/기존11함수 지문 동일·새 보안 advisory0 → Actions42344753270 success/정확 SHA, Vercel dpl_FHQj4t1MSVsoxMUum5cwnnzBVyjJ READY/alias/HTML·JS·CSS200. [검증](../docs/verification/2026-11-07-camera-recovery.md).
- 미감지 후속 질문: 감지 모델의 머리·양어깨 또는 머리·어깨·골반 조건/5초 단위 문구와 5분 경고의 차이 안내. 사용자 실제 프레임은 미저장·미확인, 감지 코드나 시간 정산을 바꾸지 않음.

## 2026-11-06 카메라 미리보기 (이력)
- 갱신: 2026-11-06 · 도구: codex · 현재 owner: codex-scenic-camera-1106
- 현재 목표/완료: 풍경 HUD ‘카메라 감시 중’ 클릭→같은 로컬 stream 미리보기·닫기 구현·검증·운영배포 완료. 기존 기록/감지/카메라 소유권 유지. PRD/architecture/검증문서 갱신. 회복 평가주기 후속만 정책 선택 대기다.
- 현재 브랜치/기준: fix/study-dashboard-clarity / 제품0b1da142ccedd512baa144d3cd912cba81c98079 커밋·feature push완료. 다른 dirty 8종/output/.serena 보존, main/태그 변경 없음. 이번 main/ScenicStudyView/scenicStudy.css/actualStudyMounted 및 관련 문서만 claim했다.
- 현재 진행/출시완료: 최종13/13·전체Chrome1764/1764실패/생략/취소0·exit0·1444949.4589ms·공식7/Dune0·독립C/I/M0·4해시/diff통과. Actions42064095014 success/exact0b1da14, dpl_69MieswPS5gZdURwYkXnkWPFTMC3 productionREADY/운영alias/aliasError없음. HTML/index-Buln7JHk.js/index-BBcuqMHI.css200·미리보기5마커true. 출시뒤짧은오류집계0,Drains404미확인.
- 추가 최신 요청: 자리 비움 회복루틴 평가주기 개선. systematic-debugging·Supabase 스킬로 운영 DB함수+Edge24/ACTIVE의index/helper 읽기 전용 재확인: 5분 이후10분 간격 경고를 날짜별 누적3회로 평가하며 helper는 pending만 중복 방지한다. 기존PRD는 경고행 집계라고 명시했다. 실제 원문/계정/기록은 조회·수정하지 않았다. 주의: Edge24 helper의 결석경로는createOrExtendAttendanceRecoveryRequest, 로컬은ensure_missed_attendance_recovery RPC라 통째배포시별도범위검토필요.
- 정책 승인 대기: 기존5분 경고/10분 시간 제외/상반신 판정 유지, 독립5분 이상 미감지 구간3회+공부일(04시) 한 번 제출 또는 하루 한 번만 변경할지 async 질문했다. 이전 ‘유지’ 결정과 충돌을 고지했으며 회복/DB/Edge는 답변 전에 수정하지 않는다.
- 다음: 미리보기 추가필수작업없음. 출시증거문서만commit/push(재배포없음)·claims해제. 회복 요청 답변이 오면 prd-slack-recovery-routines.md의경고3회정책을선택대로개정하고별도경계/TDD/DB검증후승인범위만출시한다. 기존미제출/제출/학습기록을삭제·조용히해제하지않는다. 웹되돌리기후보40cbe73,DB변경없음.
- 보호: 실제 설치앱/물리카메라/로그인·회복 해제·현재설정 조작 없음. 새APK/EXE 불필요. 카메라 실제 촬영·계정 시험은 새 승인 필요. 현재 신규 테스트는 합성 예시 데이터만 쓴다.

## 이전 완료 출시 맥락 (현재 작업 상태와 구분)
- 갱신: 2026-11-05 17:03 · 도구: codex
- 사용자 최신 승인: 다음 시작점·오늘 결과 출시, 별도 원문/이메일/ID 없는8종 count/digest 조회 승인. 회복·카메라 판정 정책은 그대로 유지한다.
- 브랜치: fix/study-dashboard-clarity · 제품76815b3/출시40cbe737b9ea7456ac3ff8d679fd08bab688fd8f · 마지막 확인40cbe73 · feature push완료. 기존 사용자 dirty/output 보존, 기본branch/태그 변경 없음.
- 목표 / 완료 기준: 기존 시작·회고·기록에 할 일 ID별 시작점·직접 작성 결과 통합·검증·DB보존·운영출시 완료. [PRD](prd-learning-continuity.md), [계획](../docs/superpowers/plans/2026-11-05-learning-continuity.md), [검증](../docs/verification/2026-11-05-learning-continuity.md).
- 진행 원장: .superpowers/sdd/2026-11-05-learning-continuity/progress.md. 완료 Task1은 다시 구현하지 않는다. root owner codex-continuity-1105는 문서/원격/배포만; /root/continuity_ui_1105 owner codex-continuity-ui-1105가 Task2 소스/테스트만 소유한다. 중첩/병렬 구현 금지.
- 완료 Task1: f3a3517 저장 계층·집중30/30/확장116/116/build/Dune0·독립C/I/M0. local20261104153953→remote20261105074906/learning_continuity 적용 성공. 기존8종 count/digest 일치,6핵심함수/ACL/RLS/policy/기존trigger 동일. 실제 비교값은 Git에 공개하지 않는다.
- Task2 완료7ac8418+fix53a6598: Chrome44/44·관련14/14·계약25/25·적응기존16/16·build통과. I2/M2와 공식회귀6건 수정, scoped reviewer 전부 ADDRESSED/new C/I/M0. source claims해제. report: .superpowers/sdd/2026-11-05-learning-continuity/task-2-report.md.
- 승인 흐름: 이전 할 일 이어가기 또는 다른 할 일 선택, A/B ID별 시작점 보존. 과거 미완료는 일정 확인·승인 후 동일 ID 날짜만 오늘로 이동. 원래 snapshot/구간/회고·다른 반복 항목 유지. 새 todo 자동생성/완료/제목 자동채움 없음.
- UI/저장 계약: note/next_action 한 행 재사용; 과거 memo 백필 없음; 신규 명시 결과만 카드; 미입력 점수 null·평균 제외. 상세 입력은 접어도 mounted/초안 유지. 기존 시작/회복/카메라/실제 정산·계정 generation·desktop pending write 소유권 유지.
- 결정4건: exact revision(동시 수정 재확인), session fence+todo NOWAIT(경합 재시도), View 접미사(일회 import/doc 변경), 신규 FK색인INFO2는 규모별 후속(이력 증가 시 부모삭제/변경 scan 비용). 원장 Ruling4건 최종 보고에 포함. 실제 다중 연결 경합 미검증.
- 원격: next-js PostgreSQL17.6, reflection14열/score nullable·제약5validated·새trigger·public5/private2 invoker/빈searchpath/anon차단 확인. 기존legacy 함수·정책·권한 유지. security/WARN 동일, INFO는 FK covering2·미사용 신설index1 추가(문서화), 새index 임의삭제 없음.
- 최종76815b3: 회고 없는 외부완료는 원래 세션 상태 확인→명시 승인→동일 초안 follow-up 생성으로 복구, 새 세션/정산/할 일 미변경. Chrome48/48+기존14/14+read11/11, 최종 scoped review Ready Yes/new C/I/M0. 공식7/Dune0 exit0 재확인. npm1751/1277pass/0fail/474skip는 기본브라우저생략이다.
- 전체 Chrome76815b3 완료:1751/1751·실패/생략/취소0·exit0·1115845.6014ms(max2 files), output/learning-continuity-full-chrome-76815b3-20261105.log. 앞선53a 중단 partial과 구분. source고정·보호범위diff0, 공식7/최종독립검토도 통과.
- 출시 완료: Actions41990690435 success/exact40cbe73, dpl_HBSod2Y6wQ8FEr6fsYUwiNS6Zpx8 production READY·운영alias/aliasError없음. HTML·index-7kQ9ZGiy.js·index-BqrjglLU.css200, 새기능/CSS6마커true/probe exit0. 출시직후 짧은 오류집계0, Drains404미확인. 첫 HTTP검사 도우미 Contains오류는 판정식만 고쳐 동일조회 재통과했다.
- 실기기 한계: GUI 도구 없음; E:/Android/Sdk ADB 복구됐지만 연결0/AVD꺼짐, Electron 로컬 바이너리 미설치로 integration 미실행. 실제 설치앱/프로필로 대체하지 않았으며 별도 유휴/초안 승인 후 수용한다.
- 실행: npm.cmd 사용, rg 없음(Select-String). 공식 & C:/jini-dev/.ai/scripts/ai.ps1 verify --project .; Chrome FEED_BROWSER_MODULE=C:/jini-dev/project/study-notes/node_modules/playwright/index.mjs / FEED_BROWSER_EXECUTABLE=C:/Program Files/Google/Chrome/Application/chrome.exe. 전체 브라우저는 안정 소스에서 실행하고 로그/exit/count까지 확인한다.
- 네이티브: Android0.2.4/Windows0.1.10이 hosted 공통 화면 사용. 이번에는 새 APK/EXE·의존성 변경 없음. 실제 앱 새로고침/종료/계정·카메라·테마 조작은 fresh 유휴/초안 승인을 받은 뒤만 한다. 미승인 실계정 쓰기/회복 해제/시간정정 없음.
- 이전 운영 rollback후보: 75ab1da/dpl_66HWEKw4b9cVwccfByXLJEJfvm1u. 문제 시 웹만 복귀하고 추가DB/새기록 유지. 종류별 메뉴15종 Windows 수용은 이전 검증 참고, 이번 실제 설치앱 수용으로 확대하지 않는다.
- 기존 미해결/보류: 설치 Windows cold 테마 유지 원인 미확정, 원래 owner-B pointer 간헐 실패(키보드 검사와 별개), Android/물리 카메라/장시간 GPU·배터리 수용 미완료. always-on-top 사용자 승인 보류. 이번 기능 완료로 확대하지 않는다.
- 카메라 회복 분석: 공부일 누적 경고>=3와 pending-only 중복방지로 같은 유형 제출 뒤 재생성; 같은 연속 구간 경고도 각각 집계. 기존24/24/합성 재현, 원영상 미저장이라 실제 자세 오탐 원인 미확정. [분석](../docs/verification/2026-11-05-camera-recovery-analysis.md). 사용자가 현재대로 유지 선택, 수정/배포 금지.
- stage 제외: theme-device-acceptance/theme-editor-alignment, prd-tech-feed/prd-windows-desktop, desktop-install-acceptance, .serena/다른output. 기존 사용자 변경을 되돌리지 않는다. prior 간단 검사의 untracked 문서는 새 기능의 fresh 완료 근거가 아니다.
- 다음 단계/인계: 요청 기능의 필수 구현·출시 게이트 완료, 코드 추가작업 없음. 원하면 별도 유휴/초안 승인 후 실제 설치 앱 수용을 진행한다. 최초 count/hash 거부는 우회 없이 사용자 승인 뒤 재개, 실제 값은 Git에 넣지 않았다. SDD scratch/tree는 삭제 승인 없어 보존·Ruling4건 최종보고. 출시증거만 문서 커밋/푸시하며 재배포하지 않는다.
