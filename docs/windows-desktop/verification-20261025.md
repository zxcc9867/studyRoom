# Windows 독서실 앱 검증

## 현재 상태

2026-10-26: 사용자가 남은 R1 수정·재검증을 승인했다. actual SDK 재현 RED(중복 logout2개) 후 raw 인증 종료와 최종 정리 소유권을 보완했다. 집중7/7·인증44/44·native116/116/check11, 독립 scoped 검토에서 R1 ADDRESSED·새 중요결함0을 확인했다.

- 최신 배포된 출석 정책과 시간 저장 복구를 되돌리지 않도록 origin/main9f381ab 기반 `feat/windows-desktop-app` / `C:/jini-dev/worktrees/study-room-desktop-current`에 Windows 코드49경로를 자동 통합했다. 실제 충돌·수동 코드 충돌 해결은 없었고, 기존 core/server/Android/출석 보조 코드와 시간 저장·재확인 함수는 그대로다. 원본 dirty 작업 공간은 보존했다.
- 통합본 실제 Chrome **1417/1417·실패/생략/취소0·313013ms**. `ai.ps1 verify`는 Dune0위반/선언7명령 모두 exit0. 초기 제한환경 loopback 차단은 단일 재현/허용환경 통과로 분리했으며 제품 코드를 바꾸지 않았다.
- 승인된 동일 native로 실제 Electron **16/16·실패/생략/취소0·402609ms**. 6분 숨김360251ms/12샘플, 영상+7194프레임·성공ACK+360·pending/오류/timeout0·동일 문서/프로세스와 live track을 확인했다. 원시 증거는 원본tree `output/windows-electron-acceptance/1793018651709-9babf504-5f5f-472b-9847-309fff0ad5cc/`다. native auth는 통합본과 바이트 동일, 나머지 native도 줄끝 정규화 후 동일하다. 합성 카메라·로컬 IPC이며 실제 착석/서버/다중 기기 수용은 아니다.
- 현재 통합본 NSIS build exit0. `StudyRoom-Setup-0.1.0-x64.exe` **123053755bytes / SHA256 a7cbaffe07f251aa09882a636fef8dc08e09313c79a8b55036ac495585510b21**. ASAR529항목·금지파일0·모든 native 제품 파일이 현재 source 바이트와 일치, 공개 config는3필드만 있다. 인증서 없음(`NotSigned`), 공개 게시/보안 설정 변경 없음.
- 좁은 최신-main 통합 검토도 명세/품질 PASS·새 결함0이다. 검토자는 최신 출석 UI·시간 저장/불확실 결과 재확인과 desktop pending 수명, native/설정 파일 보존을 대조했다. 통합본에 별도 서버/DB/Android 제품 수정은 없다.
- 같은 설치 대상 `C:/jini-dev/apps/study-room-desktop`에 무삭제 덮어설치 exit0·설치 ASAR 해시 일치·바탕화면 바로가기·자동 실행0을 확인했다. 설치 전/후 userData는 없었으며 기존 사용자 데이터를 초기화하지 않았다. 첫 실행/운영 배포/본인 인증은 후속 단계다.
- 기본 monorepo npm audit의28건(critical2)은 기준 설치에도 있던 기존 결과다. workspace/omit-dev 감사도 monorepo 의존성5건(high4/critical1)을 보고했으나, 실제 ASAR의 의존성 목록과 교차 확인한5패키지(xmldom/brace-expansion/js-yaml/tar/undici)는 모두 설치판에 포함되지 않았다. 전체 제품 보안 감사를 완료하거나 취약점을 자동 수정했다고 주장하지 않는다.
- 실제 본인 로그인/OS 카메라 권한은 사용자가 직접 수행한다. Windows 작업에서 운영 학습/회복 기록을 삭제·변경하거나 출석 정책/DB를 변경하지 않았다. 아래10/25 증거는 당시 cohort로 보존하며 최신 결과를 대신하지 않는다.

## 범위와 보존

- 기존 production 화면·Supabase 계정/RLS/학습 API를 재사용한다. 새 서버/학습 DB·Android APK 변경 없음.
- X는 같은 문서를 트레이로 숨기며 공부/카메라를 종료하지 않는다. 완전 종료는 기존 웹의 공부 종료/회고 경로를 사용한다.
- 카메라 단일 담당·기기 단위 참여·출석/회복/감지 조건 유지. 실제 회복 잠금 우회·대리 작성 없음.
- 학습 테스트는 `[테스트] Windows ...`로 식별한다. 모의 영상과 실제 웹캠·운영 서버 수용은 별도다.

## 환경과 변경 전 기준

- linked worktree: `C:/jini-dev/worktrees/study-room-team`, `fix/mobile-camera-lifecycle`, base `ea6c56e0e1f7fa43ecffed12e5aeeeaeca9fe5e8`.
- 원격 fetch 성공·ahead/behind0. 기존 운영/수용 dirty 변경 보존.
- Windows NT10.0.26300, Node24.13.0. npm 공식 조회 Electron45.0.0 / electron-builder26.18.0, 설치된 Supabase JS2.107.0.
- 변경 전 `npm.cmd test`: 1357중1182통과/175브라우저생략/실패0, 21637ms.
- 변경 전 실제 Chrome 전체 기준: 1357/1357·실패0·생략0, 301405ms. `output/desktop-baseline-chrome.log`. 이는 새 Windows 코드의 검증이 아니다.
- 10/24 할 일 시간 편집의 기존 배포/Android 근거는 `docs/session-todo-time-edit/verification-20261024.md`이며 이번 Windows 수용으로 재사용하지 않는다.

## 공식 기술 확인

- [Electron Session](https://github.com/electron/electron/blob/main/docs/api/session.md): 권한 검사와 요청 handler 모두 필요, 영상 전용/최상위/출처 검증.
- [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow): 사용자 정의 storage와 단일 code 교환·유효기간. 기존 서비스의 PKCE/티켓 계약 보존.
- Supabase changelog의 [2026-10-12 CBC TLS 폐지 예고](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)를 확인했다. 기존 TLS1.3은 유지되며 새 Electron/Node의 TLS를 약화하거나 폐지 cipher를 활성화하지 않는다.
- CLI2.120.0 `config push --help` 확인: 로컬 선언 속성만 갱신·미선언 속성 보존, 적용 전 `config diff` 지원.
- 운영 Auth의 기존 redirect7개를 재조회·변경 없음 확인 후, 사용자에게 알리고 `studyroom-desktop://auth/callback`만 추가했다. 격리된 최소 config의 preview는 `auth.additional_redirect_urls`1개 update/나머지13개 remote_only였다. push 성공 후 diff는 update0/remote_only13, 기존7개+Windows1개와 일치하며 나머지13개 값도 동일하다. DB·provider·비밀값·요금제 변경 없음.
- 최초 CLI dry-run 실패는 로컬 config.toml 부재였으며 격리된 최소 config로 해결했다. 적용 후 동일 속성이 diff에서 사라지는 정상 동작 때문에 첫 결과 해석이 실패했으나, 후속 read-only diff의 update0과 나머지 값 동일로 검증했다. 운영 raw 응답/비밀값은 문서나 Git에 기록하지 않는다.

## 구현 단위와 설치 파일 빌드

- Task1 정책·암호화 인증·lifecycle42/42, 독립 재검토 통과. Task2 추가/종료Retry수정 후 desktop75/75, runtime28/28·check10파일·Dune14파일/4경계·웹 build·mobile:check 통과. Task2 독립 재검토 I1해결·새 차단결함0. 실제 OS 수용과 구분한다.
- 종료probe context 후속 수정 후 NSIS 로컬 재빌드 성공: `apps/desktop/dist/StudyRoom-Setup-0.1.0-x64.exe`,123050594bytes, SHA256`c3bbf8764a48cc26d53d84b7d123eae81ebef853384cd78440005ada651858e2`. 이후 native 변경 시 재빌드한다.
- app.asar528항목·금지 env/test/fixture/log/docs0·공개 설정3필드 확인. 최신 설치본 asar와 win-unpacked asar가 동일하다. 인증서가 없어 Authenticode NotSigned·SmartScreen 한계가 남는다. 공개 게시 없음.
- Task3 구현자 집중 결과: helper14+실제 mounted Chrome13=27/27·실패/생략0,74846ms. 루트 기본 실행1384중1196통과/188브라우저생략/실패0,build1744모듈·mobile/Dune/diff통과. 초기 stale identity/기본로그인/로그아웃/계정ABA/SDKtimeout·refresh/종료회고·동일turn pending/관찰·휴식/카메라취소·OS거부·자동복구를 포함한다. 독립 검토·전체 Chrome은 진행 중이며 native/운영 수용을 대체하지 않는다.
- 기존 tracker의 preparing latch로 카메라 동의 취소 뒤 idle이 unknown에 남는 결함을 RED로 확인했다. Windows 실패 continuation에서 완료된 취소/세션없음/카메라없음/commit없음일 때 기존 tracker.observe만 호출해 cancellable preparation을 정리했고, pending/저장불명은 유지했다. 새 학습/서버 종료 없이 fake tracks 종료·3초 재시작없음 검증. Android tracker/판정 정책은 변경하지 않았다.
- Task3의 종료 consumer가 요구하는 probe user/session/localEngagement producer 후속은 독립검토 승인·runtime36/36/desktop83/83/check통과. 위 최신 설치 파일에 포함했다.
- Controller의 전체 Chrome 실행1384/1384·실패/생략0·293260ms(`output/desktop-final-chrome.log`)는 I1/I2 수정 전 cohort다. 독립 검토가 발견한 renderer 웹 credential 저장/시간대 pending 보완 뒤 최종 전체 검증을 다시 실행한다.
- Task3 fix1은 실제 Supabase SDK를 번들한 Chrome 검사로 renderer session의 메모리 전용 저장과 정확한 legacy auth key 정리를 검증했다. 일반 웹/Android 저장은 유지하며, 시간대·공개 태그·기존 알림 설정 저장을 동기 pending counter에 포함했다. 집중40/40·기본 공개 태그3/3·build/mobile/Dune 통과 후 독립 재검토에서 I1/I2 해결로 판정됐다.
- 재검토의 새 Important N1은 legacy auth 정리 실패가 모듈 초기화에서 throw되어 오류 안내조차 mount되지 않는 경로였다. 실제 main+Supabase SDK 번들에서 빈 화면 RED→fail-closed 오류/명시 재시도/unknown probe GREEN을 확인했다. fault 제거만으로 자동 해제하지 않으며 성공한 재시도 뒤 공통 로그인·검증된 native 사용자로 복구된다. fix2 집중41/41·실패/생략0·build/mobile/Dune/diff 통과, 독립 재검토는 진행 중이다.
- Controller `ai.ps1 verify --project C:/jini-dev/worktrees/study-room-team`의 7개 명령은 fix1 기준 모두 통과했다(`output/desktop-verify.log`). 실제 Chrome 전체와 최종 accepted 코드의 재검증은 별도다.
- accepted fix2의 `output/desktop-verify-accepted.log`도 Dune 위반0/7개 명령 모두 통과했다. 실제 Chrome 전체는1396중1395통과/1실패/생략0(310219ms)이므로 최종 통과가 아니다. 기존 1440px 선택 시작 버튼의 색상 검사이며 집중 재현도 실패했다. 진단에서 가상 JS clock200ms 후 CSS 전환은0/16ms에 머물렀고 두 endpoint는 정상 회색→녹색이었다. compositor 전환만 완료한 진단은2/2통과, 제품 CSS 대신 해당 최종 색상 검사 조건을 안정화할 예정이다.
- 실제 Electron의 첫 권한 검사는 자동 요청 거부/Windows DPAPI 재실행 보존이 통과했지만, 명시적 동의 후 video-only 요청이 NotAllowedError로 거부됐다. 실제 Session callback 입력을 진단 중이며6분 숨김 검사는 아직 시작하지 않았다. native 수정이 필요하면 설치 파일 재빌드·재설치를 수행한다.

## 최종 수정본의 자동 검사·재빌드

- 실제 Electron request의 `securityOrigin`은 끝 `/`가 있는 origin 직렬화였다. runtime의 raw 문자열 비교가 같은 출처를 거부했으므로 root-only URL 검증 뒤 `URL.origin`으로 비교하도록 수정했다. 공식 API의 optional 필드는 유지하되 제공된 빈 값/null/외부 출처/자격정보/path/query/fragment 등은 거부한다. 현재 문서/소유 창/최상위/영상 전용/명시 동의는 그대로 필수다. [Electron45 권한 API](https://github.com/electron/electron/blob/v45.0.0/docs/api/session.md), [media request 형태](https://github.com/electron/electron/blob/v45.0.0/docs/api/structures/media-access-permission-request.md).
- 실제 입력형 adapter RED3→GREEN3/3·runtime39/39·desktop86/86·check 통과, 독립 `task-2-origin-review.md` 승인/결함0. 제품 CSS는 바꾸지 않았고 앞의 최종 색상 검사에만 reduced-motion 조건을 적용해 기존 모든 대비/구분 assertion을 유지했다.
- Controller 최종 실제 Chrome **1396/1396·실패/생략0**,323977ms(`output/desktop-final-chrome-stable.log`). 최종 `output/desktop-verify-final.log`은 Dune 위반0/7개 명령 모두 통과했다. 각 이전 실패 cohort는 위에 구분해 보존한다.
- 최신 NSIS는 `apps/desktop/dist/StudyRoom-Setup-0.1.0-x64.exe`,**123050529bytes**,SHA256`5124e34e41ea6e8813a7ffc47498624dc9a7b8409525f25051bdae9018b6d141`.528항목·금지 파일0·main/preload/runtime와 source 일치·공개 설정3필드만 포함한다. NotSigned이며 공개 게시하지 않았다. 이전 c3bb 설치 파일은 최종 수정본 근거가 아니다.
- 기존 로컬 설치는 StudyRoom 실행0·userData 부재 상태에서 새 NSIS로 덮어설치했다. exit0·설치 asar와 빌드 asar 일치·자동 실행false. 기존 설치/앱 데이터 삭제 없음. 아직 실제 production 앱 첫 실행은 후속이다.
- 실제 security 집중2/2 통과: production 옵션의 샌드박스/브리지·동의 영상/마이크·화면 공유 거부/외부 창·탐색·신선한 종료 probe·취소·로컬 휴식/관찰 구분. 원래 subframe에는 preload/Node/브리지가 없다. 추가 방어 검사는 별도 격리 공격자 launch에만 subframe preload를 허용해 실제 same-webContents 하위 프레임 IPC가 UNTRUSTED_DOCUMENT로 거부됨을 확인했다. 이 추가 검사를 production 옵션이라고 주장하지 않는다. 전체6분 runner는 진행 중이다.

## 로컬 설치 (첫 실행 전)

- 설치 전 정확한 별도 target `C:/jini-dev/apps/study-room-desktop` 부재·StudyRoom 실행0·기본 사용자 데이터 경로 부재 확인. 기존 폴더 삭제나 데이터 초기화 없이 위 로컬 NSIS를 `/S /D=...`로 설치했다. [NSIS 공식 명령행](https://nsis.sourceforge.io/Docs/Chapter3.html)의 대문자 옵션을 사용하며 CRC/보안 확인을 생략하지 않았다.
- Installer exit0·StudyRoom.exe존재·자동실행false·바탕화면 바로가기 생성·설치 asar==빌드 asar 확인. HKCU 제거 등록은 DisplayName `독서실 0.1.0`/DisplayVersion0.1.0/DisplayIcon 정확한 target이다. NSIS는 InstallLocation 필드가 없어 DisplayIcon으로 검증했다.
- sandbox 레지스트리 조회는 제한되어 정상 Windows 환경에서 읽기 전용 재확인했다. 커스텀 프로토콜은 아직 미등록이며 실제 main의 첫 실행 등록은 후속 수용으로 남긴다. 새 웹 bridge 배포 전이므로 설치 앱은 아직 실행하지 않았다. 로그인/공부/사용자 데이터 생성·업데이트 설치 수용도 미실행이다.

## 실제 Electron 자동 수용

- `npm.cmd run desktop:integration`: **4/4 통과·실패/생략/취소0**,371491ms. 실제 Electron45/운영 옵션·runtime/preload·Tray/Menu·safeStorage를 사용하며 Auth/서버/OS dialog·외부 브라우저 경계만 테스트용이다.
- 숨김360178ms 동안 영상10→7213(**+7203프레임**), local heartbeat 요청1→361(**+360회**), 기록된 오류0. 최대 요청 간격1011.5ms·프레임 간격66.1ms.30초 간격12개 sample 모두 같은 main/renderer/webContents/문서·live track·hidden 상태였다. second-instance 신호와 실제 트레이 메뉴 callback으로 같은 문서를 복원했다.
- 실제 Windows DPAPI 암호문/평문 미포함·프로세스 재실행 복호화·휴식 중 로컬 참여 복원도 다시 통과했다. fixture의 synthetic credential/session만 사용했고 운영 학습 변경은 없다.
- 근거: `output/windows-electron-acceptance/1792862987181-88c57644-ff09-45c6-bbdb-6d24bdefed29/`의 security-and-quit/adversarial-subframe/six-minute-hidden/encrypted-restart JSON. 테스트 fixture와 산출물은 설치 패키지에 포함하지 않는다.
- 영상은 모의 장치이며 heartbeat는 local fixture 상태 전송이다. 실제 웹캠 착석 판정·운영 서버 heartbeat·실계정 동기화가 통과했다고 확대하지 않는다. 다른 검사/빌드가 병행돼 CPU/메모리는 성능 수용 기준으로 사용하지 않는다.
- 독립 검토가 heartbeat 요청 전 증가하는 counter와 launch 실패 전 cleanup 미등록을 발견했다. 위 영상/프로세스 증거는 유지하지만 native accepted-ack 완료 수용으로 사용하지 않는다. 하니스 fix1에서 아래 성공 응답 기준으로 다시 검증했다.

### 성공 응답 기준 최종 자동 수용

- `npm.cmd run desktop:integration`: **14/14 통과·실패/생략/취소0**,400962.5ms. 거절·잘못된 id/응답·미완료/timeout 등을 주입한6개 하위 검사와 실행 실패 서버 정리 검사를 포함한다. 성공은 matching id/ok/accepted 응답 이후에만 집계하며, 실제 요청이 끝나기 전 pending을 지우지 않는다.
- 최종 숨김360173ms, 복원까지360241ms. 영상10→7213(+7203프레임), 요청1→361과 **native 성공 ACK1→361(+360회)**. 모든12개 sample과 최종값에서 pending/errors/timeouts/rejected/invalid0, 최대 ACK 간격1022.8ms·프레임 간격66ms·최종 ACK age192.4ms.
- native 창은 숨김 상태이지만 매 sample의 `document.visibilityState=visible`, `document.hidden=false`였다. 같은 main71140/renderer92924/webContents1/문서와 live track을 유지했고 실제 트레이 열기 뒤에도 동일성과 프레임 진행을 확인했다. 공통 웹의 visible 조건을 우회하거나 판정 정책을 바꾸지 않았다. [Electron Page Visibility](https://www.electronjs.org/docs/latest/api/browser-window#page-visibility).
- 추가 공격자 검사의 session preload 방식은 child 준비가 되지 않아 중단·진단했고, 문서화된 BrowserWindow preload를 격리 공격자 launch에만 사용해 재검증했다. production의 preload/보안 옵션은 바꾸지 않았다.
- 최종 근거: `output/windows-electron-acceptance/1792864398048-79f1ecf6-4c7a-49ac-bef2-9690c95d292d/`. Windows DPAPI 재시작·권한·신선한 종료 probe·하위 프레임 거부도 통과했다. 독립 `task-4-rereview1.md`은 I1/I2/M1 해결·새 Critical/Important0으로 승인했다. 모의 영상/local fixture와 실계정·실제 웹캠의 경계는 그대로 유지한다.

### 암호화 불가 전환 추가 회귀

실제 설치된 Supabase JS2.107.0과 합성 HTTP/암호화 Map 저장소로, 이전 암호문 A가 남은 상태에서 암호화 불가로 B에 메모리 로그인한 뒤 다시 정상 실행하면 A가 복원되는 결함을 재현했다. 초기5개 검사 중3개 예상 RED에서 확장8개 중6개 RED를 확인한 뒤 `desktopAuth.mjs`만 최소 수정했다. 실제 계정·네트워크·운영 학습은 사용하지 않았다.

- SDK 초기화 후와 새로 암호화 불가가 된 뒤의 명시적 인증 전에, SDK의 `signOut({scope:'local'})`으로 SDK 소유 credential만 정리한다. 완료 전 native identity를 null로 알리고 이전 cached proof를 무효화한다. 정리 실패는 안전하게 진행을 막으며, 기존 desktop pending/logout 암호문과 정상 암호화 로그인 보존은 유지한다. 성공한 메모리 로그인은 매 상태 조회마다 로그아웃하지 않는다.
- 초기 unreadable SDK에는 token이 없어 logout HTTP 요청이 없다. 실행 중 암호화가 실패해 SDK 메모리에 token이 있으면 해당 native 세션만 local scope로 취소할 수 있으며 global/others는 호출하지 않는다. 개발 검사는 합성 HTTP만 사용했다.
- 실제 SDK 회귀8/8, 전체 desktop94/94·check10파일·diff 통과. 첫 sandbox Temp atomic rename EPERM 실패1건은 source 변경 없이 workspace TEMP/TMP 재실행으로 통과했다. 별도 독립 검토는 진행 중이다.
- 이전6분 검사는 실제 auth factory·Windows DPAPI를 사용하지만 SDK 경계는 주입된 getUser/event다. 새 fallback 분기는 실제 SDK+AES Map 경계로 검증했으며, 실제 Windows 암호화 기능을 고의로 끄거나 사용자 credential을 조작하지 않았다. 변경하지 않은 camera/tray/DPAPI 메커니즘의 이전 증거와 최신 auth 검사 결과를 구분한다.

### 추가 인증 수정본 빌드·전체 게이트

- `output/desktop-verify-release.log`: Dune 위반0·선언7개 명령 전부 exit0. desktop94/94를 포함하고, 웹 소스는 최종 Chrome1396/1396 이후 변경하지 않았다. 검사 임시 파일만 workspace TEMP/TMP에 격리했다.
- 재빌드 NSIS `StudyRoom-Setup-0.1.0-x64.exe`는123050915bytes/SHA256`b5a5fdc582537a477310688190782a7c5b823775725bd4172da689a7deadbe20`.528항목·금지 파일0·main/preload/runtime/auth source 일치·공개 config3필드다. NotSigned이며 공개 게시 없음. 이전5124 파일은 auth 추가 수정 전이다.
- 기존 target에 앱 실행0·userData 부재 상태로 덮어설치 exit0·asar 일치·자동 실행false를 다시 확인했다. 첫 production 실행과 본인 로그인은 아직 하지 않았다. 인증 후속 독립 검토에서 추가 수정이 나오면 이 파일도 다시 빌드한다.

### 인증 후속 검토 경합

- 독립 실제 SDK 검사에서 요청 전 secure였어도 OTP 대기 중 refresh 저장 실패가 겹치면 B 성공 후 A 복원이 가능함을 추가 재현했다. SDK 응답 뒤 새 insecure 전환을 다시 검사해 로컬 정리 후 해당 시도는 취소하도록 수정했다. 합성 회귀11/11·native97/97·controller `desktop-verify-auth-final.log`의7명령/Dune0 통과.
- 좁은 재검토는 위 결함 해결을 확인했으나, 정리 timeout 뒤 catch가 두 번째 정리를 시작해 새 로그인까지 늦게 취소할 수 있는 I2를 추가 재현했다. fix2는 operation-local 정리 소유권으로 중복 SDK logout만 막고 나머지 보상 정리는 유지한다. 실제 SDK의 독립 logout2개 대기 회귀가 RED→GREEN, fallback12+auth22=34/34·native98/98·check10/diff 통과했다. `task-1-fallback-rereview2.md`은 I2 해결·새 결함0으로 승인했다. 전체 기능 최종 검토와 설치 파일 재빌드는 후속이다.
- 별도 SDK 관찰: 저장 실패 시 automatic refresh의 내부 deferred promise가 같은 오류를 중복 reject할 수 있었다. 합성 `_autoRefreshTokenTick`에서 primary 처리와 별도 unhandled rejection1개를 관찰했다. 실제 Electron 종료/대화창은 미확인이고, 전체 기능 최종 검토 대상으로 유지한다. 개발 테스트의 observer는 정확한 예상 오류 객체만 대조하며 production 전역 오류를 숨기는 handler는 추가하지 않았다.

## 미실행 수용

- 설치 앱 첫 실행·재실행·업데이트 설치(설치/파일 확인만 통과).
- 운영 로그인·동일 계정 웹/Android16 동기화·서버 기록 비교·실제 착석.
- 기능 전체 독립 검토와 Vercel production 배포.

## 전체 기능 최종 검토 보완

최종 전체 소스/계획 검토는 Critical0·Important3·Minor2로 `With fixes`였다. 실제 Electron 충돌이나 데이터 손실이 발생했다고 단정하지 않는다. 자동 SDK refresh 저장오류의 미처리 rejection, 팀·피드 독립 mutation의 desktop pending 누락, Tray 생성 실패 시 복구/안전 종료 UI 누락을 단일 보완 단계에서 수정한다. 승인 설계의 local-camera tray 표시·창 위치 검증/모니터 변경 복구·첫 숨김 안내 영속성도 함께 보완한다. 기존98개/Chrome1396개 결과는 이 보완 전 cohort이며, 보완 후 검증·설치 파일·배포를 별도로 기록한다.

- 단일 보완의 native109/109·check11·집중Chrome44/44·새 실제Electron2/2·mobile/build/Dune/diff 통과. 공개 SDK 오류 분류/단일 저장소 정리·실패 안내, 문서/window pending owner, Tray 복구/기존 안전 종료, 로컬 카메라 표시와 bounds/첫 안내 저장을 추가했다. shell-settings.json에는 bounds/boolean만 저장하며 credential/학습과 분리한다.
- Controller 전체 Chrome **1404/1404·실패/생략/취소0**,322727ms(`output/desktop-final-wave-chrome.log`). `desktop-final-wave-verify.log`은7명령/Dune0 통과, `desktop-final-wave-build.log`의 NSIS 빌드도 exit0이다. 아직 최종 설치 파일로 승인/설치/게시하지 않았다.
- 최종 재검토 `final-rereview.md`는 I2/I3/M1/M2 해결을 확인했지만, 새 R1을 재현했다. SDK 경계 오류가 시작한 local cleanup과 stale 인증 보상 cleanup이 중복되어 새 B 로그인 후 늦은 두 번째 정리가 B를 해제한다. 실제 SDK 합성 증거이며 실제 계정/학습 손상 사건이라고 주장하지 않는다. Important1로 최종 설치/커밋/게시를 보류하고 사용자에게 추가 집중 수정 승인을 요청했다.
- 이전 전체 Electron은16중15통과/1실패·410753ms였다. 추가 공격자 테스트의 child preload가 실행되지 않아 해당 cohort는 실패로 보존한다. 격리 복사본 비교 후 별도 공격자 fixture에만 sandboxfalse를 적용하고 일반 운영 보안 옵션은 sandboxtrue로 유지했다. 이 테스트 전용 수정은 좁은 검토에서 승인됐다.
- 최신 `npm.cmd run desktop:integration`은 **exit0·16/16·실패/생략/취소0·401812ms**다. 증거는 `output/windows-electron-acceptance/1792868147900-0e67eaca-ff05-40b8-8211-772d496b0733/`. 신규 오류복구2건·일반운영 보안·실제 child IPC 거부·DPAPI 재실행·정리 검사가 모두 통과했다.6분숨김 마지막sample360130ms/복원360231ms, 영상+7203프레임·성공ACK+360·전sample pending/오류/timeout0, 동일process/document/live track·document visible을 확인했다. 이는 합성카메라·로컬IPC이며 본인로그인·물리착석·서버/다중기기 수용을 대신하지 않는다. Auth R1은 여전히 미해결이며 최종 설치/커밋/배포 보류다.

## 운영 학습 기록 기준값

2026-10-25 구현 중 운영 SQL을 읽기 전용으로 조회했다. 아래는 원본 행을 공개하지 않는 건수/내용 해시다. 10/24 이후 사용자·정상 서버 활동으로 달라진 값은 이번 구현이 만든 테스트 데이터로 추정하지 않는다. Windows 제품에서 아직 운영 학습 변경은 수행하지 않았다.

| 테이블 | 건수 | 내용 digest |
|---|---:|---|
| study_todos | 285 | 9b0c9f7a4bc7c058768f3991dc35057f |
| study_todo_plans | 285 | 4cbd94b3f242089ab8032ab300e3dcb1 |
| study_sessions | 172 | 96541b6820ed55528fc497d92185879b |
| study_todo_segments | 352 | 84e72e6346289b1dc66a4814c906942a |
| study_session_reflections | 17 | ed3494c659f1c4dca583891608c2d99b |
| study_actual_sessions | 51 | 0c752b60542a7793ad8e96782fa5a10a |
| study_recovery_requests | 154 | 2d51edecc01f13dbde9073197df4c4dd |

최종 수정본 자동 검사 후 동일 SQL을 읽기 전용으로 재조회했다. 위7테이블의 건수와 내용 digest가 모두 작업 중 기준값과 동일했다. Windows 운영 공부/계정 테스트는 아직 수행하지 않았으며, 이 보존 확인을 실제 동일 계정 동기화 수용으로 확대하지 않는다.
