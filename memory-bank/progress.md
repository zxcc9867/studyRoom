# Progress

## 계획표·내 페이지·숲 정보 명료화

- 상태: 구현·집중24/forest34/feed30 통과, 최초 전체1492중2건(모바일 타이머·접힌 리포트 준비 순서) 보완 뒤 최종 Chrome1492/1492·실패/생략/취소0·verify7/Dune0·독립P1/P2없음. 제품7dd5a14 push완료·운영배포는 자동 승인 검토 거절로 사용자 명시승인 대기. 원형 내부 공통테마·날짜 글자·04시 갱신·요약/접기·한국어 소개 우선/상태를 개선한다. 무료 예산449642/450000·provider quota_exhausted 관측은 별도이며 한도/키/DB/학습 정책 불변. 기존 native dirty는 원래 worktree에 보존. [검증](../docs/verification/2026-10-29-dashboard-clarity.md).

## HIG 공통 UI·Windows 로그인 안내

- 공부 전환·다크 모드: 상단 동일 좌표/중복 링크 제거·팀 숲 탭 공통 grid, 시스템/라이트/다크·기기 저장·OS/storage event·초기 paint·전체 공통 팔레트. Chrome1475/1475(실패/생략/취소0)·verify7/Dune0·독립C/I/M0·44px라벨/실제클릭/키보드/저장실패 통과.2d55e11 push·Actions40852672515 success·Vercel dpl_zxVX7jwPPj4nr5QxF3PD1TS6xt6v READY/exactSHA/운영alias·HTML/JS/CSS200/새테마 확인. 기록/API/native 미커밋·APK/Windows 설치파일 보존. [검증](../docs/verification/2026-10-29-dark-navigation.md).

- 설정 UX 재구성: 승인된5분류/현재값+변경/명시적 편집·취소·저장, 분류 간 초안/저장 중 상태 보존. UI 상태만 SettingsLayout이 소유하고 기존 서버/API·학습/계정·네이티브 updater는 유지한다. Chrome1449/1449(실패/생략/취소0)·집중10/10·익명1/1·기존대시보드2/2·verify7/Dune0·독립C/I/M0. be90bea push·Actions40733635247 success·Vercel dpl_J8QqGT1Q4EQNnTpGZoxCzGjkwNp8 READY/exactSHA/alias·HTML/JS/CSS200/새nav·editor 확인. 새APK/Windows 설치파일 없음. [검증](../docs/verification/2026-10-29-settings-redesign.md).

- 전체 내부 UI 통일: 회복 요약/이력·목표/습관/숲·설정 편집·출석 달력·로그인/모달·Android 고정 설치 안내를 공통 토큰으로 정리했다. 외곽 검사의 누락·달력39px·상태색/본문 CSS 우선순위 재현/수정. Chrome1441/1441(실패/생략0)·집중13/13·verify7/Dune0·독립C/I/M0·375/1440/200%/44px/대비/기존흐름 통과.7773466 push·Actions40722576237 success·Vercel dpl_6GJQa7bTarDxzqtUJGR84zwBz2j4 READY/exactSHA/alias·HTML/JS/CSS/설치안내200/새스타일 확인. 학습/인증/카메라/DB·APK0.2.4 불변. [검증](../docs/verification/2026-10-29-full-ui-audit.md).

- 내 페이지 UI 통일: 회고 목록의 노란 점선/우표 순번/입체 버튼과 리포트 중복 영문 라벨 제거, 기간 입력/초점/빈 상태·rem 글자 크기를 공통 토큰에 연결했다. Chrome1429/1429(실패/생략0)·신규5/5·관련13/13·verify7/Dune0·독립 최종C/I/M0.375/1440·200%·44px·대비4.5·키보드·기존 회고 저장/학습 회귀 통과.8ac9325 push·Actions40709394959 success·Vercel dpl_4mjwm9cBxwkvcDp1VkYTCfiroqJA READY/exactSHA/alias·HTML/JS/CSS200/새 문구·스타일 확인. native 인증 후속과 별개다. [검증](../docs/verification/2026-10-28-ui-unification.md).

- 현재 UI 점검(0.1.6): 완료/오류/연결 실패를 고정 로컬 CSS·공통 팔레트/한글 폰트/반응형 카드로 통일, 로그인 동작 줄이기 누락 수정. Chrome1424/1424·native155/155·통합27/27/6분숨김·verify7/Dune0·독립 최종 차단0. CRLF/CSP 문제 RED→GREEN 및 독립 Chrome4/4. 승인된0.1.6 무삭제 설치exit0/ASAR일치/암호문1파일동일/재실행 완료, 웹 배포는 진행 중. 기존 학습/서버 정책 불변. [새 검증 기록](../docs/verification/2026-10-27-hig-completeness.md). 이전 Google 무한 로딩 조사 항목은0.1.4 실제 로그인 성공 이전의 이력이다.

- 로그인 탭 자동 닫기(0.1.5): 승인된 성공응답 고정 close script/SHA256 CSP. 실제 격리 Chrome4개·native154/154·통합21/21/6분숨김·verify7/Dune0·독립차단0. 승인된0.1.5 무삭제 덮어설치exit0/ASAR일치/기존암호화1파일동일/app.ready 확인. 본인 Chrome탭의 이력상 거부 가능/fallback 유지. 자동로그아웃 없이 다음 직접 로그인부터 적용한다. [검증](../docs/verification/2026-10-27-auth-tab-close.md).

- Windows 로그인 복귀(0.1.4): 승인 loopback·CLI 패턴1개/기존8주소·다른13설정 보존. native153/Chrome1423/Electron17/숨김6분·verify7/Dune0·독립차단0·무삭제설치/암호문·학습7테이블동일. 이후 사용자 앱 로그인 성공 보고+실제native callback.completed(13:19:24.445UTC) 확인. AX/재실행은 Esc중단으로 미검증이다. [검증](../docs/verification/2026-10-27-desktop-loopback.md).

- 구현/웹 배포: 승인 목업의 정보 위계·사이드/하단 메뉴·세션/하루 목표 분리·공통 로그인/초기 배경/Android 팔레트. 208a12c·Actions40347306976 success·Vercel dpl_7xgEEA2RtEiWDrwEqnbQAipsYfZC READY/exactSHA·HTML/JS/CSS200. native 이메일 오류 분류/Google 대기 안내는 실제 Google 해결과 구분한다. DB/학습 정책 변경 없음. [PRD](prd-hig-ui.md).
- 검증: native119/119·Chrome1423/1423·실제Electron16/16(숨김6분 영상/성공ACK 유지)·verify7/Dune0·375/1440 공통 화면/대비/조작 영역·독립 검토 차단 결함0. 실패 코호트/실제 수용과 [검증 기록](../docs/verification/2026-10-26-hig-ui-auth.md)을 구분한다.
- Windows0.1.1 빌드·승인된 같은 경로 덮어설치exit0/asar일치·기존프로필/새 로그인 화면 확인·미서명. 공개 게시/실계정 로그인은 미수용. Google 무한 로딩은 새 설치에서도 재현되며 [복귀 경로 조사](../docs/verification/2026-10-27-google-return.md) 중이다. 이메일 운영 한도429는 특정 요청 원인과 일대일 대응 미확정. Chrome 지원/프로필/기록은 보존한다.
- Android 설치/공개 APK0.2.4/code7 유지. 공통 hosted UI와 새 native 로그인 팔레트 소스 반영은 구분한다. 새 APK 배포는 후속이다.
- Google 원인 조사: 새10/27 02:01UTC 시도의 앱 provider.started/opened·정확 native return/s256·서버 코드 발급1/callback302·token0, 앱 callback0을 확인했다. 같은 날 OS 무인증 전달은 실제 handler까지 통과하지만 Chrome 직접 링크는 사용자 무반응/수신0이다. Chrome→OS 전달 경로를 조사하며 정확한 원인은 아직 미확정이다. 구조/운영 설정 변경 없음.
- 원인 추적0.1.2 로컬 설치: 인증 동작 불변인 비동기 고정 단계 로그만 추가했다. 진단12/12·native131/131/check12·verify7/Dune0·실제Electron16/16/숨김6분·독립 재검토 차단0·패키지/무삭제 설치/기존 암호문 보존 확인. OS URI가 실제 앱 callback handler까지 도달하는 무인증 대조도 확인했다. 실제 Google 재시도 결과 대기이며 원인 해결로 표시하지 않는다. 운영 웹/DB/APK 변경 없음.
- 비교 정정/Claude: yh는 정상 Study Notes의 의도된 비교 화면이다. 잘못된 로그인 요청 혼동 해석 철회. Opus5.5 두 차례 읽기 전용 검토 exit0, Notes의 prompt 차이는 원인 미확정. Windows 두 앱 연결 조회는 정상, 사용자 승인한 Default/공통 Chrome 프로토콜 설정에 저장된 두 scheme 항목은 없었다. 임시 양쪽 링크 비교는 종료했으며 실제 로그인 검증을 대신하지 않는다. 제품 코드/추가 배포/학습·노트 기록 변경 없음.
- Opus 수정 담당 위임 결과: 제한된 native 코드 수정 권한으로 추가 조사했으나 재현 가능한 코드 결함/수정 패치 없음. check12/native131통과는 실제 로그인 성공이 아니다. [Opus 보고/부모 검토](../docs/verification/2026-10-27-opus-oauth-fix.md). 사용자가 올바른 Supabase 계정으로 연 실제 URL 설정에서 정확한 Windows callback 포함8주소를 확인했다. 목록 누락은 아니며 계정·설정·키/학습 변경 없음. 실제 원인·로그인은 미해결이다.
- 0.1.3 단일 옵션 호환성 시험 실패: Google만 prompt=select_account, PKCE/콜백/TTL/저장소/티켓/학습 불변. 실제 SDK RED2→GREEN3·native134/134·verify7/Dune0·독립 C/I/M0·NSIS/ASAR 검증 완료. Electron 테스트 준비 오류 수정 후 최종16/16·6분 숨김·재실행·재검토 통과. 승인된 무삭제 설치exit0/asar일치/암호문 불변이지만 실제 Google 로그인은 여전히 실패했다. 04:52UTC 앱opened후callback0·서버callback302/발급/정확주소/s256각1/token0. 자동 검사를 실제 성공으로 쓰지 않는다. loopback 직접 수신 대안은 설계/원격 allowlist 변경 승인 대기이며 미구현·운영 변경 없음. [근거](../docs/verification/2026-10-27-google-return.md).
- 실제 Location 확인: 사용자 제공 DevTools의09:28:53UTC GET302는 정확한 studyroom-desktop://auth/callback으로 반환했다(query제외). 이 시도의 허용URL 누락/오등록·웹 fallback은 제외하며 native09:26UTC opened뒤 수신0과 구분한다. CSP sandbox만으로 원인을 확정하지 않고 현재 Console의 외부 앱 오류 이유를 URL제외로 요청했다. Windows UI 도구의URL확인 중단을 우회하지 않았으며 원문 코드/Cookie는 사용·문서화하지 않는다. 구조/설정/학습/설치 변경 없음.
- Chrome handler 오류 미해결: 실제 재시작도 효과 없음. Opus5.5 재검토/host 등록·권한/Win32 정상 대조 뒤 승인된 Procmon4.12/메모리 보관에서 Include4+Drop Filtered Events 체크 확인→사용자 새 로그인/중지 보고. ChromePID43188 RegOpenKey12행 모두 NAME NOT FOU...를 관측, 정확 HKCR 경로/철자를 Event탭으로 확인 요청 중이다. 같은11:54–11:58UTC 서버flow는 정확desktop referrer/s256/발급/연결 각1, native11:54:57 opened후callback0. 아직 alias/등록·보안·코드 변경이나 실제 해결로 쓰지 않는다. [제한 진단](../docs/verification/2026-10-27-procmon-handler.md). 원시 trace·인증값 저장/학습·앱 설치·배포 변경 없음.

## 2026-10-25 공부 시작 출석 분리 — 운영 배포 완료

- 사용자 승인된 정책 변경: 공부일 내 시작 → 출석, 하루 목표는 별도 진척. 알림 후 30분·목표 달성 대체 출석을 제거하며, 무시작 결석은 다음 04:00에 판정한다. [PRD](prd-attendance-start.md).
- 별도 worktree 구현·독립 검토 완료. Chrome전체1370/1370·실패/생략0, Edge23/23·모바일/docs/build·DUNE0위반/5게이트 통과. 본인 계정 현재 출석 present/회복pending0, 제출된 회복 이력 보존. 선행RPC remote070303·Cron47/Slack29·정책 remote072758 적용, 원격 권한/RLS·12범위 count/digest 동일 확인. 기능c5eac1e main push·Actions40173077774 success·Vercel dpl_D8rDG15x7gFk2cBz8Riez72o43Jy production READY/exactSHA·HTML/JS200·본인 화면 출석완료/목표50% 동시표시 확인. [검증 기록](../docs/verification/2026-10-25-attendance-start.md).

## 2026-10-25 통합·복구

- `main`에 기존 운영 branch의 24개 커밋(`ea6c56e`까지)과 시간 저장 복구 `f9439ab`, README/QA `e8a7885`를 통합했다. 전체 검증·원격 CI·Vercel 상태는 [통합 출시 기록](../docs/verification/2026-10-25-main-integration.md)을 기준으로 확인한다.
- 무응답 UPDATE/SELECT는 각각15초 제한, 응답 불명확 시 읽기 전용 확인, 명시적 재저장과 초안 보존을 구현했다. 집중 Chrome14/14·전체1347/1347(실패/생략0)·Edge23/23・mobile/docs/build・DUNE0위반/5게이트·독립 코드/문서 검토 통과. README3언어·실제 fixture 화면7장·모델/라우터·현재 제한 정보를 갱신했고 이미지 참조45/로컬 링크172 누락0을 확인했다.
- 실기기 검증은 사용자 선택으로 후속 진행한다. 기존 실제 기본 동기화 PASS와 이번 로컬 fixture 검증을 구분한다. 운영 DB·APK·무료 AI 설정은 변경하지 않는다.

| 기능 | 상태 | 현재 근거 / 다음 단계 |
|---|---|---|
| Windows 데스크톱 공통 화면·학습 기록 | 로컬 설치 완료·웹 연결 출시 중 | R1 actualSDK RED→집중7/7·인증44/44·native116/116/check11·독립 검토 중요결함0. 승인 native Electron16/16·6분 영상+7194/성공ACK+360/오류0. 최신 main9f381ab 출석·저장 복구 보존·자동 통합49경로 clean·Chrome1417/1417·verify7/Dune0·통합 검토 PASS. NSIS 검사/무삭제 덮어설치 exit0·asar일치·첫 실행0. 커밋/운영 배포/실계정은 후속. 원본 dirty/학습 보존·DB 변경없음. 합성 검사는 착석 수용 아님 |
| 세션 할 일 시간 재편집 | 운영 배포·수용 완료 | 해당 발생분 시간2필드만 수정·제목/반복/선택/기존학습 보존. Chrome1357/1357·hover포함집중8/8·verify/독립재검토 통과. 7133dc4/Actions40090165734 success·Vercel READY/exactSHA/HTTP200. Android16/0.2.4 실제운영저장·취소·재로드수용, 테스트항목정리·기존5종count/digest동일. docs/session-todo-time-edit/verification-20261024.md |
| Android 유휴 lifecycle·오래된 회고 안내 | 운영 배포·실제 수용 완료(범위 한정) | 설치0.2.4/code7 같은계정·탭콘텐츠·HOME/COLD/Android설정복귀·18초offline복귀 PASS·카메라사용불변. 최신빈회고선택 RED4→집중5/5·Chrome1348/1348·verify/독립검토차단결함0.3312ad0/Actions39271816694 success·production READY/200·실제PC/Android옛안내없음·기존4종digest동일. 새공부/담당전환은회복잠금유지해보류·실폰DND/착석별도. docs/cross-device-study/mobile-lifecycle-20261019.md |
| 공부 상태 보존 화면 복구 | 운영 배포·실제 수용 완료(범위 한정) | 영역 격리·유휴 명시reload·필수회고 eager, 집중10/10·Chrome1343/1343·verify/독립검토PASS.225fd82/Actions39148327299·production READY/200. Android16 실제HTML200 실패→복구·COLD로그인/학습보존, PC설정/오늘 정상. APK0.2.4 그대로·DB변경없음·전용rollback branch보존. docs/safe-section-recovery-20261019.md |
| 동일 계정 다중 기기 공부·카메라 상태 | 운영 배포·기본 실제 동기화 수용 완료, 확장 수용 후속 | 10/19 같은 계정 PC 시작→Android 관찰·양방향 휴식/재개·원격 종료/완료·COLD 로그인 PASS. 단일 담당/영상 비전송 유지. 담당 이전·Android 신규 담당·장시간 활성 배경·물리 자세/DND는 미실행. 이전 로그인 보류를 현재 전체 미검증으로 해석하지 않는다. docs/cross-device-study/labeled-acceptance-20261019.md 및 docs/verification/device-team-readiness-20261025.md |
| 개인 공부·실제 시간 배분·휴식·회복·04시 공부일 | 기존 운영 기능 유지 | 이번 팀 기능이 정책/기록을 변경하지 않음. 이전 검증은 보관본 각 최신 항목 참고 |
| 웹·Android 공통 UI·설정·계정 동기화 | 기존 운영 연결 | hosted WebView 공통 화면. 실휴대폰 OEM/DND E2E는 별도 미확인 항목 유지 |
| APK 내부 업데이트·고정 공개 링크 | 기존 운영 연결 |0.2.4/code7·기기 단위 설치 제한·변경 요약. 이번 native 변경 없음 |
| 기술 피드 한국어 번역·요약 재시도·Markdown 표시 | 기존 운영 연결 | 무료 Developer 한도·월45만 유지. 본문 기호 개선 운영2782dda, main통합 f363eca |
| 카메라 없는 팀 공부 목업 | 설계 승인 | 개인 기본 진입·팀 책상·집중 시간 제안·숲 단일 탭. 기존 별도 작업 공간 목업 보존 |
| 개인/팀 진입·공개 태그 설정 분리 | 운영 배포 완료 | 개인 기본은 팀 RPC 선행 없음. 내 공부/팀 공부 탭, 팀 없음 생성/받은 초대, 설정 계정에서만 태그 편집.0165b38·최종 Chrome1210/1210·팀27/27·독립 검토PASS |
| 등록 계정 전용 팀·링크/공개 태그 초대 | 운영 배포 완료 | migration remote20261012235920·권한/auth audit·제품b9ab3ec·공개 로그인/취소 확인 |
| 팀원 서버 상태·선택적 제목 공유 | 운영 배포 완료·실계정 수용 대기 | 개인 세션 status/pause/lease가 권위. 연결 끊김을 자리비움/회복으로 처리하지 않음 |
| 회원 개인 공부 자동 기여·간결한 목표·탈퇴 모달 | 운영 배포 완료·실계정 수용 대기 | local20261015035420→remote20261015041209 권한 감사. 자동 SQL13/13·전체 Chrome1237/1237. Dune/5명령·독립 재검토PASS.616f38c·Actions38680437289·production READY/HTTP200 |
| 함께 집중 무제한/직접 시간·인정 시간 팀 숲 | 운영 배포 완료·실계정 수용 대기 | 제한 없음/1~1440분·25/50 빠른 선택. 종료 알림만, 공부/팀 유지. local20261013081052→remote20261013084053. 기존 checkpoint/정산 불변 |
| 오늘 공부 종료와 영구 팀 관리 분리·팀 목표 | 운영 배포 완료·실계정 수용 대기 | 개인 종료는 멤버/숲 유지. 목표 새 저장 즉시 공유·과거 비공개 유지, 현재 제목 opt-in. 탈퇴 모달에서 일반 탈퇴·팀장 위임/해산. 팀장 배지 |
| 신규 팀 화면 실사용 검증 | 부분 | 실제 React/Chrome375·1440·키보드·44px·AA 대비. 최종 전체 Chrome1237/1237. 실제2계정·Android16·PostgreSQL 동시 연결 수용 별도 |
| 팀 운영 배포 | 완료 | 현재616f38c/Actions38680437289 success/Vercel dpl_2BFELdQyR6kYZeF1X95C4E8pAaN4 READY·exactSHA·HTTP200. DB 감사/공개 Chrome 새 chunk 확인·native 불변 |

## 검증 상태

- 새 worktree 기본 npm.cmd test:1044통과/99선택 브라우저 생략/0실패(1143개). 실제 Chrome 포함 같은 전체 목록 concurrency2 재실행1143/1143·실패0·생략0(183559ms). 아직 새 팀 기능 완료 근거가 아니다.
- 의존성 설치 sandbox npm 실패는 escalation clean install로 성공. lockfile/패키지 버전 변경 없음.
- 선행 팀 기능 검증(2026-10-15): ai.ps1 verify Dune0위반, npm test/test:edge/mobile:check/build/docs:check exit0. 당시 전체 실제 Chrome1220/1220·실패0·생략0·199276ms. 팀30/30·신규 SQL/controller/helper45/45·기존 카메라/lease 검사 유지. 독립 재검토PASS. 운영 추가 DB 권한/함수/제약 감사·웹 출시 완료.
- 운영 공개 Chrome375/1440 HTTP200·초대 로그인 필요·명시적 취소·새 집중/목표/종료 UI chunk HTTP200 확인. 새 deployment 출시 직후 error/fatal 그룹 조회 행 없음은 장시간 수용과 구분. 실계정 저장/팀 변경은 하지 않음. 실제2계정 Realtime/Android16/동시PostgreSQL 검증은 미확인. native/APK 변경 없음. 이전 추가 Jev 전송은 정책 차단으로 결과 없음.

## 보관

상한을 초과한 이전 상태·날짜별 상세 이력은 [progress202610 보관본](archive/progress-202610.md)에 바이트 동일 보관했다. 최신 운영 통합 근거는 [2026-10-11 GitHub 동기화](verification/2026-10-11-github-sync.md)이며 과거 대기 항목은 이후 완료 기록과 함께 해석한다.
