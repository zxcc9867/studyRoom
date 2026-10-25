# README와 실제 화면 검증 — 2026-10-25

## 범위

- 기준 checkout: `C:/jini-dev/.worktrees/studyroom-docs-20261025`, branch `codex/readme-current-20261025`, 시작 커밋 `ea6c56e0e1f7fa43ecffed12e5aeeeaeca9fe5e8`.
- 최종 7장 촬영은 `README_SOURCE_ROOT=C:/jini-dev/.worktrees/studyroom-review-20261025`를 지정해 시간 무응답 복구 담당자의 실제 수정 `main.tsx`와 fixture를 읽었다. 해당 소스는 이 문서 담당자가 수정하지 않았다. 통합 전 소스 참조이며 통합 후에는 기본 현재 checkout으로 재현한다.
- README 세 언어의 팀 공부·발생분 시간 편집·PC/Android 동기화·화면 복구·현재 AI 설정 설명을 최신 구현과 맞춘다. 배포·DB·개인 기록·네이티브 권한·실계정은 변경하지 않는다. 통합·커밋·최종 검증은 메인 담당이다.
- 화면은 목업이나 이미지 생성 결과가 아니다. 기존 `actualStudyMounted.test.mjs`의 backend와 `team-study-mounted.test.mjs`의 team boundary를 재사용하고 실제 `apps/web/src/main.tsx` 및 `TeamStudySection`을 esbuild로 실행했다. 코드 경계 문자열이 사라지면 스크립트가 실패하도록 검사한다.
- `scripts/serve-readme-fixture.mjs`는 로컬 서버 전용이고 `scripts/capture-readme-current.mjs`는 새 Chrome 프로필을 만들어 캡처 후 브라우저·서버를 정리한다. 기존 사용자의 브라우저 탭·프로필에는 연결하지 않는다.

## 촬영 조건과 결과

- 촬영일: 2026-10-25. 재현 가능한 fixture 시계는 `2026-09-21T14:30:00Z`, fixture 시간대는 `Asia/Tokyo`다. 화면의 날짜·이름·공부/숲 합계는 테스트 값이다.
- Chrome `C:/Program Files/Google/Chrome/Application/chrome.exe`, Playwright는 준비된 로컬 런타임의 `index.mjs`를 사용했다. 실제 카메라 대신 테스트 미디어를 사용하고 상반신 감지 경계는 기존 mounted 테스트 stub으로 교체했다.
- `127.0.0.1` 이외의 브라우저 요청을 전부 차단했다. Supabase·AI·알림·실제 외부 글 요청은 없으며 인증 토큰·이메일·개인 일정·비공개 코드는 이미지에 없다. fixture의 테스트 전용 가짜 인증값은 이미지에 표시하지 않는다.
- 1440×960, 375×960에서 실제 UI 촬영. 팀 생성→목표 저장→합성 친구 상태 반영→팀 숲→새 세션 준비→시간 편집→시간 저장을 실행했다.
- 두 폭 모두 `pageerror` 0건, 팀 화면 가로 넘침 0건. `22:30–00:45` 저장 후 선택된 할 일을 유지하고 세션 생성 0건을 확인했다. 로컬 결과: `output/readme-current/capture.json` (Git 제외).
- 375px에서는 추가로 시간 저장 응답을 영원히 대기시키고 확인 SELECT를 실패시켰다. 가상 시계15,001ms 후 실제 오류 안내·`다시 확인`을 촬영했다. 재확인은 UPDATE를 추가하지 않았고 `22:45–00:55` 초안과 활성화된 취소를 확인했다. 이것은 합성 통신 실패이며 실제 운영 장애가 아니다.

| 화면 | 1440px | 375px |
| --- | --- | --- |
| 팀 공부 | [실제 화면](images/team-study-current-1440.png) | [실제 화면](images/team-study-current-375.png) |
| 공동 숲 | [실제 화면](images/team-forest-current-1440.png) | [실제 화면](images/team-forest-current-375.png) |
| 발생분 시간 편집 | [실제 화면](images/session-todo-time-edit-current-1440.png) | [실제 화면](images/session-todo-time-edit-current-375.png) |
| 무응답·읽기 재확인 | — | [실제 화면](images/session-todo-time-recovery-current-375.png) |

README 세 언어는 같은 실제 이미지에 번역된 대체 텍스트와 사용 설명을 연결한다. 앱 언어를 바꿔 촬영한 것이 아니라 한국어 UI를 각 문서에서 설명한 것이다.

## 재현

저장소 root에서 잠금 파일에 맞는 의존성을 준비한다. `FEED_BROWSER_MODULE`에는 사용 가능한 Playwright ES module의 절대 경로, `FEED_BROWSER_EXECUTABLE`에는 Chrome 실행 파일을 지정한다. 비밀 환경변수는 필요 없다.

```powershell
$env:FEED_BROWSER_MODULE = '<local-playwright-directory>/index.mjs'
$env:FEED_BROWSER_EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:README_CAPTURE_RECOVERY = 'true'
# 통합 전 다른 checkout의 실제 소스를 읽을 때만 지정한다.
# $env:README_SOURCE_ROOT = '<checkout-with-timeout-recovery>'
node scripts/capture-readme-current.mjs
npm.cmd run docs:check
node --check scripts/serve-readme-fixture.mjs
node --check scripts/capture-readme-current.mjs
```

캡처는 기본 포트4185를 사용하며 `README_FIXTURE_PORT`로 바꿀 수 있다. 화면만 직접 열려면 별도로 `node scripts/serve-readme-fixture.mjs`를 실행해 `http://127.0.0.1:4184/?mode=start#together`로 접근한다. 실제 날짜를 자동 추종하는 앱이므로 재현용 고정 시계는 캡처 스크립트가 설정한다. 수동 촬영을 자동 검증과 혼동하지 않는다.

## 근거와 검증의 경계

- 팀 계약: `memory-bank/prd-social-study-room.md`, `apps/web/src/TeamStudySection.tsx`. 6명/한 팀/초대·태그·자동 기여·직접 시간·누적 숲·선택적 제목 공유와 별도 탈퇴를 설명했다.
- 이미 수용한 기본 PC↔Android 상태 공유는 [명시적 테스트 수용 기록](cross-device-study/labeled-acceptance-20261019.md)을 우선한다. [Android lifecycle 후속](cross-device-study/mobile-lifecycle-20261019.md)은 유휴 HOME/COLD·짧은 끊김·이전 회고 안내 수정을 확인했다. 과거 progress의 보류 문구로 이 PASS를 되돌리지 않는다.
- 실제 두 정식 계정 팀 수용·명시 카메라 담당 이전·Android 신규 담당 시작·활성 공부의 장시간 배경/오프라인·물리 휴대폰 OEM/DND·평소 자세 감지는 이 로컬 촬영에서 수행하지 않았다. 팀원의 다른 상태와 숲 합계는 fixture 값이며 서버 실시간 전파나 기여 정산의 증거가 아니다.
- AI는 `server/ai/openrouter.mjs`, `supabase/functions/_shared/coach-openrouter.mjs`, `supabase/functions/_shared/tech-feed-store.ts`와 기존 피드 복구 문서를 대조했다. 공통 client 기본1024토큰/20000ms, 피드 명시2048토큰/20000ms를 구분하고 무료 라우터와 실제 응답 모델 ID를 구분한다. 이전 6회 커리어 파일럿 예산은 보관 기록으로 표시한다. 이번 작업에서 새 실모델 호출이나 무료 공급자 가용성 확인은 하지 않았다.
- 최종 이미지 checker 결과: `README image references verified: 45 across 3 languages.` 문서 링크·PNG 파일 유효성의 검증이며 앱 전체 회귀나 배포 성공을 대신하지 않는다.
- 기존 README 계약3개와 새 스크립트 syntax2개·`git diff --check`가 통과했다. 최종 로컬링크161개는 누락0(단, README 세 곳이 참조하는 `timeout-recovery-20261025.md`는 담당자의 review checkout에서 존재를 확인했으며 통합이 필요하다). 이 문서를 복사·수정해 다른 담당자의 소유권을 침범하지 않았다. 메인은 통합된 checkout에서 경로를 다시 확인해야 한다.
