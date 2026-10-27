# Active Context
- 갱신: 2026-10-28 00:10 JST · 도구: codex
- 루트/브랜치: C:/jini-dev/worktrees/study-room-desktop-current · feat/hig-ui-auth · HEAD208a12c · native/문서 미커밋 변경 있음. 원본 study-room-team 사용자/운영 dirty는 보존한다.
- 현재 요청: UI 스킬/HIG로 완료·오류·연결 실패 통일 후 앱 전체 점검·표적 개선·검증/적용. 기존 학습 기록 보존. 사용자0.1.6 유휴 덮어설치 승인.
- 완료(현재 UI): desktopStatus.css 공통 카드/색/한글/반응형/초점·fixed CSS SHA256 CSP·CRLF 정규화. 연결 실패 재연결/저장 미보장 안내 보존. 웹 로그인 reduced-motion 누락 수정. DB/서버/학습·카메라 정책 변경 없음.
- 현재 검증: Chrome전체1424/1424·native155/155·통합27/27/6분숨김·verify7/Dune0·독립 최종차단0. CRLF RED→GREEN 및 독립 Chrome4/4·최종status10/10·Electronloopback1/1. docs/verification/2026-10-27-hig-completeness.md.
- 현재 설치:0.1.6 무삭제 설치exit0·설치ASAR후보일치·encrypted-auth1파일 전후동일·프로필 보존·FileVersion0.1.6/ProductVersion0.1.6.0·앱 재실행 완료. 새 실제 본인 재인증은 자동로그아웃 없이 다음 사용자 로그인 때 확인한다.
- 다음 단계: 웹 appTheme.css/test와 관련 UI문서만 feature브랜치 commit/push 후 기존 production workflow dispatch·READY/exactSHA/공개200 확인. native 로그인 baseline dirty는 임의 stage하지 않는다. 검증된 설치본은 로컬 적용이며 공개 WindowsRelease/APK 신규 게시 아님.
- 현재 한계: Chrome 정책에 따른 자동닫기 거부는 우회하지 않는다. 실제 Android/iOS·물리 자세·전체OS글자확대/스크린리더 수용은 미실행. 이전 강제글꼴2배/375px 타이머 넘침은 로컬 상태 화면200% 통과와 별개다.

## 이전 인증 작업의 근거(아래 버전·출시는 과거 상태)
- 완료(원래 로그인):0.1.4 loopback 설치 후 사용자가 앱 로그인 성공 보고. 실제 native13:19:18.761UTC started→18.863 opened→23.897 callback수신/검증→23.900 intent소비→23.901 exchange시작→24.445 completed 확인. AX 화면 확인은 물리Esc 중단, 실제 재실행 유지 검사는 미실행이다.
- 구현(이번): desktopLoopback.mjs의 onCallback resolve 후 성공 응답에만 고정 window.close 스크립트와 정확한 SHA256 CSP 허용. unsafe-inline/eval·외부script·코드/계정 반사·다른 탭/브라우저 설정 조작 없음. 실패/취소 HTML은 script 없이 유지한다.
- 경계 보존: PKCE/identity/generation/암호화 저장/webTicket/콜백1회·5분/소켓 수명·native 같은창 복원/학습·카메라 정책은 불변. 이번 서버/DB/Vercel/Android 코드·운영 설정 변경 없음.
- TDD: HTTP CSP+Chrome 성공닫기/정책거부 RED3(총12중9pass)→GREEN12. 실제 격리 Chrome4개: closable popup닫기/원래탭유지·다중history 정책거부/안내·실패/취소 유지. 실제 본인 Google탭은 자동닫기100% 보장하지 않는다.
- 검증현재: native154/154·실패/생략/취소0·syntax13파일·ai.ps1 verify7명령/Dune0·docs/diff 통과. shared-reviewer C/I/M0·독립 loopback8/8. 전체 integration21/21·406036ms·실패/생략/취소0. 실제 Chrome4+Electron17·6분숨김영상+7203/성공ACK+360/오류0·same process/document·safeStorage 합성재실행 통과.
- 후보0.1.5: package/lock 일치·로컬/remote tag 충돌 없음. NSIS build0·123056673bytes/SHA256 A8AC410A164F9D18EC80FD2FA419AD683075ABFF6329D1835F9F6E07FDF53CFD·NotSigned. ASAR531/금지0/native11 source일치·공개config3필드.
- 설치완료: 같은 경로0.1.5 무삭제 덮어설치exit0·installed ASAR후보일치·profile보존·암호화1파일 전후digest AC5C4D7F26EC7D26B8AAFC600C9A6FF8D0C28882981EA1489933F1A9E4360FFE 동일. 실행파일0.1.5/app.ready13:57:15.650UTC 확인. 학습/계정/설정 초기화·자동로그아웃 없음.
- 수용경계/다음: 다음 사용자 직접 Google로그인부터 적용. 실제 본인 인증탭의 닫힘/재실행 로그인 유지 화면은 이번에 미확인이다. Chrome이 닫기를 거부할 수 있으므로 안내 fallback이 남는 것은 허용 계약이다. 검증을 위해 자동로그아웃/실제 공부 시작·종료하지 않는다.
- 현재 설치: C:/jini-dev/apps/study-room-desktop/StudyRoom.exe0.1.5. 실제 profile은 %APPDATA%/@study-room/desktop. 이동/삭제/초기화 금지.
- Git/출시: native-only는 프로젝트 규칙상 별도 요청 없이 commit/push하지 않는다. Windows 공개 Release/고정링크·서명 인증서는 이번 요청 밖이다. Vercel 재배포/새APK는 필요 없다.
- 이전0.1.4 gate: native153/Chrome1423/Electron17·6분숨김/verify7/Dune0·독립차단0. NSIS/무삭제 설치/암호문2파일·서버학습/회복7테이블 digest동일. 세부 docs/verification/2026-10-27-desktop-loopback.md.
- 이전 실패 경계: 실제 Supabase302는 정확 custom URI인데 Chrome155가 handler없음. Procmon canonical HKCU/KEY_READ/NAME NOT FOUND와 일반host성공 불일치. 오타/계정·권한 차이/단순 캐시 가설은 근거없음. AhnLab모듈 존재는 인과증명 아님. 보안 프로그램/Chrome 보호/등록값을 낮추거나 alias추가하지 않았다.
- 이전 Claude: claude-opus-5-5 실제5회 조사/비교·최신exit0/modelUsage확인. docs/verification/2026-10-27-opus-registry-observed.md. 이번 독립 검토는 shared-reviewer이며 Opus 새실행으로 표기하지 않는다.
- 운영 Auth: 승인된 CLI2.120.0 최소config로 loopback패턴1개 append 완료. 기존8→9주소/다른13설정 전후동일hash3DE5B777C0107921891943B70865C13D02370FD997F6B0D9E3E2A9D89499AEFA, postdiff update0. 이번 재변경 없음.
- 도구 경계: Google계정/비밀번호/코드·보안/UAC는 사용자 직접. chrome://conflicts/URL판별불가 차단은 우회하지 않는다. Procmon은 사용자 중지/원시trace미저장·마지막PID62036. 이전 Esc 후 같은턴Computer Use는 중단했다.
- 기존 출시: HIG208a12c·Actions40347306976success·Vercel dpl_7xgEEA2RtEiWDrwEqnbQAipsYfZC READY/exactSHA/HTTP200. Android0.2.4/code7 유지.
- 기존 제품 보존: 개인/팀 자동집계·단일카메라담당·04시공부일·출석시작인정·할일시간편집/저장복구·회복정책 유지. 합성영상/로컬IPC는 실제착석/다중기기 수용이 아니다.
- 문서: prd-windows-desktop.md·architecture-map.md·trouble-shooting.md·progress.md·docs/superpowers/specs/2026-10-27-desktop-loopback-design.md·docs/verification/2026-10-27-auth-tab-close.md.
- 이전 상세 인계/진단은 docs/verification/2026-10-27-google-return.md·procmon-handler.md·2026-10-26-hig-ui-auth.md 및 memory-bank/archive/active-context-pre-hig-20261026.md에 보존한다.
