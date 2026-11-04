# 테마 종류별 설정과 Windows의 이전 목록

## 보고된 현상과 원인

사용자 사진에는 기존 ‘별빛 바다’ 이미지 효과가 선택됐는데 ‘라이브’와 영상 반복 안내가 표시됐고, 새 ‘별빛 바다와 유성’은 없다고 보고됐다.

1. 운영 배포/소스의 anime-sea 등록과 실제 설치앱에 로드된 문서는 다르다. 설치앱의 접근성 목록은 이전14종만 있었고 anime-sea는 없었다. 사용자 공부·카메라 미사용/새로고침 승인 뒤 Ctrl+R로 기존 문서를 새로 불러오고 설정에 재진입하니15종/별빛 바다와 유성이 확인됐다. 캐시 초기화·재설치·테마 적용을 하지 않았다.
2. AtmosphereSettings는 CSS 이미지 효과와 실제 영상의 motion/live 값을 동일한 라벨로 표시했고, 영상 반복 안내를 무조건 표시했다. intensity도 영상에서는 실제 playbackRate0.75/1이므로 ‘움직임 강도’ 대신 속도를 표시해야 한다.

## 최소 수정과 보존

| 초안 종류/모드 | 표시 |
|---|---|
| 이미지 효과 | 이미지 효과 끄기/켜기, 켰을 때 기존 강도, 영상이 아님 안내 |
| 영상 라이브 | 영상 재생 정적 이미지/영상 라이브, 실제0.75배/1배 속도, 지원화질, 무음 반복 안내 |
| 정적 이미지 또는 영상 정적 모드 | 불필요한 강도/화질/영상 재생 안내 없음 |

- apps/web/src/AtmosphereSettings.tsx의 표시 조건·라벨만 수정했다. static/live/intensity/quality 값·기기 저장·controller/player·영상/카메라 소유권·공부 정책은 그대로다.
- 새 영상/서버/API/DB/native/설치본은 추가하지 않는다. ‘별빛 바다와 유성’은 기존에 배포한24초 영상이며 현재 카탈로그는15종이다.
- apps/web/test/actualStudyMounted.test.mjs에서 기존 이미지 옵션 조작명4곳만 라이브→켜기로 바꾸고 행동 assertions는 유지했다. 새 테스트6개는 실제 React 앱을 mount하고 서버/카메라 경계에만 기존 합성 fixture를 사용한다.

## 검증

| 검사 | 결과 |
|---|---|
| 이미지 종류/설정·풍경375/1440 RED | 4건 모두 ‘이미지 효과’ 그룹 누락으로 실패 |
| 정적 안내·영상 속도 RED | 2건 각각 잘못된 영상 안내/속도 그룹 누락으로 실패 |
| 수정 뒤 집중 검사 | 6/6·실패/생략/취소0·15601ms·exit0 |
| 최종 보강 Chrome | 종류8(다크200%2건 추가)+lease14=22/22·실패/생략/취소0·57027ms·exit0 |
| 계정 전환 키보드 반복 | 3/3·각 실행 실패/생략/취소0·3035/3156/3158ms·exit0 |
| 집중 보존 |15종 도달, 초안에서 영상 다운로드0·취소 뒤 설정/학습/회복/할 일 동일, 풍경의 카메라 node/stream/track 동일·추가 요청0 |
| 독립 shared-reviewer | C0/I0/M0; 실제 playbackRate 의미/기존 assertions·375px 화면·문법/diff 확인 |
| 공식7/Dune | 최종 테스트 보강 뒤 재실행도7/7 통과·Dune 위반0·exit0 |
| 최초 전체 실제 Chrome |1674건·1673통과/1실패·생략/취소0·1552389ms·exit1. 실패는 baseline owner-B pointer hit-test |
| 같은 소스 pointer 단독 재실행 |1/1·실패/생략/취소0·5872ms·exit0; 간헐성 확인이며 원인 해결 완료 아님 |
| 최종 분할 범위 | 원전체1673/1674 + 최종집중22/22, 중복19건 제외 coverage1676건. 제품 원해시 동일·최종 제품/테스트2해시/diff·독립C/I/M0. 단일 전체명령 exit0 아님 |
| 실제 Windows | 배포 전 승인 Ctrl+R 뒤15종/새 영상 확인. 배포 뒤 추가 승인 Ctrl+R·설정 재진입으로15종/별빛 바다와 유성·새 이미지효과 끄기/켜기·정확한 영상아님 안내 확인, 잘못된 영상 반복 안내 없음. 로그인/기존 별빛 바다 유지·적용 없이 닫기 확인 |

예시 캡처는 ‘합성 테스트 · 예시 데이터’로 표시했다. 초기 실제 Windows 캡처는 다른 앱에 가려져 접근성 목록/현재 값으로 대조했다. 배포 뒤에는 창을 활성화해 설정 화면과 배경 편집 화면을 캡처하고 UIA 목록/종류별 안내를 확인했다. 테마 선택/적용 없이 편집을 닫은 뒤 저장 요약 ‘별빛 바다 · 이미지 효과’가 동일했다. 전경 영상 재생을 검증했다고 주장하지 않는다. 실제 앱의 테마 적용·공부 시작/휴식/종료·회복 제출·서버 기록 쓰기는 하지 않았다. Android 에뮬레이터·물리 카메라·장시간 GPU/배터리·DB 전체 digest 수용은 미실행이다.

네이티브 입력 중 coordinate input geometry is unavailable은 반환된 창을 다시 선택·활성화하고 새 관측으로 회복했다. 긴 편집 영역의 취소 버튼은 화면 밖 좌표로 거부됐으며 입력 결과를 재관측한 뒤 화면에 보이는 ‘닫기’ 버튼으로 닫았다. 거부된 입력을 성공으로 기록하거나 이전 좌표를 반복 사용하지 않았다.

### 전체 검사 중 발견한 기존 포인터 시험 경합

- owner-B lease 격리 시험이 B의 두 번째 연장 RPC 전에 ‘공부 화면 열기’ pointer click에서 실패했다. 버튼은 visible/enabled지만 고정 헤더→하단 내비게이션→인접 버튼이 차례로 가로챘고 scroll/위치 안정화가 반복됐다. 실패 txt/png에는 정상 B 세션·활성 버튼·모달 없음이 확인됐다.
- html smooth scroll·상단 여백22px/고정헤더64px·풍경/모달 종료 focus의 preventScroll 미사용이 확인돼 focus/scroll 경합이 유력하다. 정확한 시간선이 없어 단일 원인이나 병행 부하의 영향을 확정하지 않는다. 본 테마 표시 패치로 해당 Dashboard 코드/레이아웃을 변경하지 않았다.
- 독립검토는 격리 시험의 B 재진입을 visible/enabled→focus/activeElement 확인→실제 Enter로 검증하는 것이 동일 native button/onClick을 사용해 목적에 적합하다고 확인했다. 전체 종료 뒤 해당 입력만 변경했고 owner/request assertions는 그대로 유지한다. 같은 소스의 pointer 단독 재실행도1/1 통과해 간헐성을 확인했다. 원 pointer 실패를 삭제하거나 키보드 통과를 포인터 경로 원인 해결/수용 완료로 보고하지 않는다.

근거: output/theme-controls-1104/red.log, kind-red.log, green.log, official.log, official-final.log, full-chrome.log, pointer-rerun.log, final-focused.log, keyboard-repeat-1/2/3.log, frozen-hashes.json, final-frozen-hashes.json. 화면: output/scenic-fixture/theme-type-image-scenic-375.png 및 theme-type-video-scenic-375.png, theme-type-video-dark-375-2x.png 등. ignored 산출물은 커밋하지 않는다.

```powershell
$env:FEED_BROWSER_MODULE='C:/jini-dev/project/study-notes/node_modules/playwright/index.mjs'
$env:FEED_BROWSER_EXECUTABLE='C:/Program Files/Google/Chrome/Application/chrome.exe'
node --test --test-name-pattern='theme type controls:' apps/web/test/actualStudyMounted.test.mjs
node --test --test-name-pattern='scenic lease:|theme type controls:' apps/web/test/actualStudyMounted.test.mjs
node --test --test-concurrency=1 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs
Remove-Item Env:FEED_BROWSER_MODULE,Env:FEED_BROWSER_EXECUTABLE -ErrorAction SilentlyContinue
& C:/jini-dev/.ai/scripts/ai.ps1 verify --project .
```

## 출시

- 제품 커밋: 75ab1da6a52f193c3997e8256d5d275a14947171, feature branch fix/study-dashboard-clarity push 완료.
- GitHub Actions: [41777453429](https://github.com/zxcc9867/studyRoom/actions/runs/41777453429) completed/success·정확 headSha.
- Vercel: dpl_66HWEKw4b9cVwccfByXLJEJfvm1u, production READY·동일 SHA·운영 alias 확인. React/Vite 빌드40.821초.
- [운영 주소](https://study-room-attendance.vercel.app): HTML, index-CvQtVoEd.js, index-D96r8R7A.css, anime 포스터 모두200. 공개JS의 새 종류별 문구/별빛 바다와 유성 확인. anime720/1080 영상은 각2048바이트 Range 요청206·전체크기1610136/3579940바이트. 근거 output/theme-controls-1104/production-http.json.
- 출시 직후5분 error/fatal 집계는 행 없음이며 장시간/클라이언트 무오류 보증은 아니다. Drains 조회404로 연결 상태 미확인·운영 설정 변경 없음.
- 추가 사용자 유휴/미저장없음 승인 뒤 실제 Windows 앱을 새로고침해15종과 새 이미지효과 메뉴까지 확인했다. 테마·학습/회복/할 일 쓰기·native/설치 변경 없음, 로그인/저장 요약 유지.

새APK/EXE는 필요 없다. 기존에 열린 앱 문서는 새로고침 전까지 이전 코드일 수 있으므로 실제 설치앱의 로드 여부를 배포 상태와 구분한다. 이번 Ctrl+R 보존을 Windows 정상 종료/cold 재실행 시 테마 소실 원인 해결로 확대하지 않는다.
