# 화면 순서 편집 이탈 회귀

## 요청과 범위
- 사용자는 수정 없이 화면 순서 편집을 나간 뒤 메인보드에 편집 UI가 남지 않도록 요청했다.
- 기준 HEAD02f67e9, 기능 브랜치 fix/study-dashboard-clarity. main.tsx/DashboardNavigation.tsx/기존 mounted 테스트와 관련 문서만 변경한다.
- 기존 학습·카메라·인증·native·DB/API/프로필 저장 계약을 유지한다. 실제 사용자 계정/설치앱/기기 조작과 DB 쓰기는 수행하지 않는다. 다른 작업의 기존 테마/Windows 설치/피드 문서 미커밋 변경은 보존한다.

## 원인과 수정
- sectionOrderEditing은 DashboardApp에 남는데 route/domain 이탈 정리가 없었다. 설정의 화면 구성은 #today로 이동하므로 뒤로 가기 후 돌아와도 편집 상태가 계속 true였다.
- 실제 Chrome RED5:375/1440의 Back→설정→오늘, 목표/팀→오늘, 오늘 하위 탭에서 편집창이1개(기대0)였다. `output/layout-editor-exit-red.log`.
- 이탈 effect로 오늘/집중 밖의 편집/드래그 상태만 닫았다. 설정 진입은 hash/activeSection/todayDomain을 today/focus로 함께 맞춰 새 편집이 즉시 닫히는 경합을 피한다. 새로 열 때는 저장된 순서를 복사한다.
- 추가 RED2: 이미 #today일 때 같은 오늘 링크는 hashchange가 없어 편집이 계속 남았다. DashboardNavigation의 명시적 이동 callback이 기존 cancelTodaySectionOrderEditing을 호출하도록 연결했다. `output/layout-editor-exit-same-route-red.log`.
- 취소/이탈에서 profiles upsert·학습 RPC를 호출하지 않는다. 명시적 순서 저장과 다른 설정 분류의 초안 보존은 그대로다.
- 독립 검토 I1: modifier 클릭에도 nav 취소가 실행돼 새 탭을 열어도 현재 미저장 미리보기가 사라졌다. 실제 Ctrl+클릭 새 탭 RED1(편집창0/기대1) 후 기본 동작이 허용된 무수정 primary 클릭만 취소하도록 보완했다. `output/layout-editor-exit-modified-red.log`.

## 검증 상태
- 최종 집중11/11·실패/생략/취소0·exit0: 새 이탈8(실제 새 탭 초안 보존 포함) + 기존 저장/로그아웃1 + 기존 공부 우선 레이아웃375/1440 2. `output/layout-editor-exit-focused-final.log`.
- 합성 세션/할 일·카메라 요청 수가 동일하고, 이탈 시 profiles.today_section_order 쓰기0을 확인했다. 저장된 순서 재진입과 미저장 미리보기 취소를 실제 UI로 확인했다.
- 스크린샷 `output/scenic-fixture/layout-editor-exit-375.png`, `layout-editor-exit-1440.png`은 ‘합성 테스트 · 예시 데이터’를 표시한다. 실제 설치앱/물리 기기 수용이 아니다.
- 최종 실제 Chrome 전체1591/1591·실패/생략/취소0·1029763ms·exit0. `node --test --test-concurrency=1 packages/core/test/*.test.mjs apps/web/test/*.test.mjs server/ai/*.test.mjs scripts/*.test.mjs supabase/functions/_shared/*.test.mjs`와 기존 FEED_BROWSER_MODULE/FEED_BROWSER_EXECUTABLE을 사용했다. `output/layout-editor-exit-full-chrome.log`.
- 최초 공식7/Dune0은 modifier 보완 전 통과했다. 보완 후 최종 공식7(`desktop:check`, `desktop:test`, `test`, `test:edge`, `mobile:check`, `build`, `docs:check`)/Dune0도 통과했다. 공식 test의 브라우저 미설정 범위는 별도 전체 실제Chrome로 보완했다. `output/layout-editor-exit-official-final.log`.
- 독립 최초C0/I1/M0→modifier 가드 후 재검토C0/I0/M0·직접3/3. 제품/테스트3파일 검증 전후SHA256차이0·`git diff --check` 통과. 집중11과 검토3은 전체1591에 중복 합산하지 않는다.
- 운영배포는 검증 후 기존 workflow로 진행한다. READY/정확SHA/운영alias/HTTP200 전에는 출시 완료로 표시하지 않는다.
