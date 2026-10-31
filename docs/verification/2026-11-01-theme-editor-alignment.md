# 테마 편집 정렬 보완 — 2026-11-01

## 범위와 원인
- 사용자 사진의 테마 카드 제목·움직임/강도 선택 그룹만 보완한다. 기존 공통 색·설정 위치·controller 저장/초안/효과 lifecycle, 학습·카메라·인증·서버/DB·native 코드는 변경하지 않는다.
- 기존 CSS는 viewport만으로 3/2열을 고르고, 제목에 anywhere 줄바꿈과 체크 표시 폭을 함께 사용했다. floated legend와 flex-wrap/가변폭 선택 라벨이 작은 폭에서 비대칭 줄바꿈을 만들었다.
- AtmosphereSettings.tsx는 라디오 쌍에 grid wrapper만 추가했다. atmosphere.css는 패널 container query·3/2/1열·keep-all·선택 표시 모서리 배치, 제목 아래 동일 폭 옵션을 사용한다. 200%의 좁은 폭에서는 같은 왼쪽선의 전폭 행으로 재배치한다.

## 재현과 집중 검사
- RED: `FEED_BROWSER_MODULE=C:/jini-dev/project/study-notes/node_modules/playwright/index.mjs`, `FEED_BROWSER_EXECUTABLE=C:/Program Files/Google/Chrome/Application/chrome.exe`; `node --test --test-name-pattern='atmosphere: editor alignment dark 476px 2x' apps/web/test/actualStudyMounted.test.mjs`. 수정 전 `paired options stay on one row` assertion 실패, 0/1. `theme-editor-red.log`.
- GREEN: `--test-name-pattern='atmosphere: editor alignment'` 16/16·실패/생략/취소0, 43386ms. 375/476/868/1440 × light/dark × 100/200%. 쌍 옵션은 동일 행 또는 동일 왼쪽선의 전폭 열인지, 폭 동일·제목 위·44px·가로 넘침·한글 단어 분리·대비·취소·합성 학습/카메라 요청 불변을 검사했다. `theme-editor-green.log`.
- 합성 화면 PNG를 직접 검토한 뒤 200% 체크 표시가 원 밖으로 커지지 않도록 장식 glyph 크기/line-height를 고정하고 실제 glyph bounds 검사를 추가했다. 이 후속 변경을 포함한 전체 검사는 아래에서 별도 확인한다.
- `output/playwright/theme-editor-alignment-*`는 가짜 학습 데이터가 들어간 로컬 검사 이미지다. 실제 계정/인증·실제 기기 화면은 저장/업로드하지 않는다.

## 최종 검증·출시
- 전체 Chrome: `node --test --test-concurrency=2 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`를 위 Chrome 환경으로 실행했다. `theme-editor-full.log`: 1559/1559·실패/생략/취소0·617606ms·exit0. 체크 glyph bounds 보완을 포함한다.
- 독립 shared-reviewer: controller·callback/저장 경계 불변과 합성 3/2/1열 화면 직접 검토, 단위8/8·문법/diff 통과. 카드 열 개수 assertion 누락 경미1을 실제 bbox 개수 검사로 보완했고 재검토 Critical0/Important0/Minor0. 추가 assertion을 포함한 최종16/16·실패/생략/취소0·41255ms·exit0을 `theme-editor-alignment-final.log`에서 재확인했다. 반복16건을 전체1559개에 더해 중복 집계하지 않는다.
- 공식 `& C:/jini-dev/.ai/scripts/ai.ps1 verify --project C:/jini-dev/worktrees/study-dashboard-clarity`: Dune0/7명령 모두 passed/exit0. desktop:check, desktop:test, test, test:edge, mobile:check, build, docs:check. 공식 명령의 환경 의존 브라우저 생략을 위 별도 전체 Chrome 결과로 대체하지 않고 구분한다. `theme-editor-verify.log`.
- 운영 배포: 아직 대기. 기존 feature branch→GitHub Actions production workflow의 정확 SHA READY/alias/공개 HTTP200 확인 후 갱신한다.
- 실제 Windows/Android 기기 수용과 원복은 [별도 문서](2026-11-01-theme-device-acceptance.md)를 따른다. 이번 정렬 자동화 결과를 실제 기기 새 수용으로 표현하지 않는다. Windows 기존 시험 설정 원복은 도구 활성화 실패로 여전히 대기 중이다.
- hosted 웹 변경으로 새 APK/EXE·버전·서명·설치 링크 변경은 필요 없다. 운영 반영 후 기존 앱의 웹 화면을 다시 불러오면 사용한다.
