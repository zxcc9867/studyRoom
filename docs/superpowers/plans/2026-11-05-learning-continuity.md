# Learning Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 할 일별 다음 시작점과 직접 작성한 오늘 결과를 기존 시작/회고/기록 흐름에 통합한다.
**Architecture:** 기존 회고 note/next_action 한 행이 입력 원천이다. 추가 메타데이터와 호환 RPC는 소유자·연결 검증을 담당하고 실제 종료는 기존 RPC에 위임한다. 새 웹 client는 격리 조회/명시 mutation만, main은 기존 공부/카메라/초안/계정 소유권을 유지한다.
**Tech Stack:** React19/Vite/TypeScript, 기존 Supabase/PostgreSQL, Node test/PGlite/Playwright. 버전/의존성 변경 없음.
**Spec:** memory-bank/prd-learning-continuity.md

## Global Constraints
- 기존 기록 일괄 UPDATE/DELETE·백필 없음. 구형 complete_study_session 서명/기존 정책·정산/RLS/로그인/네이티브 불변.
- note/next_action 재사용, 옛 note_kind=memo 보존. 새 명시 작성만 learning_result. 점수 미입력은 null이며 평균에서 제외.
- A/B 할 일 ID별 분리, 같은 제목 합치기 금지, 최신 빈 값으로 옛 시작점 부활 금지. 선택만으로 mutation 금지.
- 지난날 미완료 할 일은 일정 확인 후 날짜만 오늘로 이동한다. 원래 계획 snapshot/학습/회고 보존, 자동 todo 생성/완료 없음.
- 새 탭/별도 입력 시스템 없음. 기본2입력·선택 자료·기존 상태/할 일 완료 접기. 초안/실패/계정/늦은 응답 격리.
- worker는 할당 경로만 claim하고 타인 변경을 되돌리지 않는다. 구현 subagent 중첩 금지. 원격 DB/계정/앱 조작·푸시·배포는 controller만 한다.

## Task 1: Reflection continuity persistence and client contract
**Files:**
- Create migration via Supabase CLI: learning_continuity, under supabase/migrations.
- Create scripts/learning-continuity-sql.test.mjs, apps/web/src/learningContinuity.mjs, learningContinuity.d.mts, apps/web/test/learningContinuity.test.mjs.
- Modify apps/web/src/weeklyReview.mjs and covering unit test only for nullable score averages.
**Interfaces:**
- Produces loadLearningContinuity(client,studyDate,{signal}={}) returning {version:1,bookmarks:LearningBookmark[],results:LearningResult[]}.
- Produces completeLearningSession(client,{sessionId,excludedSeconds,completedTodoIds,reflection}), saveLearningReflection(client,{sessionId,reflection,expectedUpdatedAt?}), updateLearningBookmark(client,{reflectionId,expectedUpdatedAt,nextAction,resourceUrl,resourcePosition}), prepareLearningTodo(client,{todoId,expectedLocalDate,expectedUpdatedAt}). Each throws on error and returns validated committed data, never a fake success. New reflection creation can omit expectedUpdatedAt; editing an existing reflection requires the exact expected timestamp or fails without writes.
- Reflection payload camelCase client fields focusScore/energyScore nullable, interruptionReason nullable, note,nextAction,contextTodoId,resourceUrl,resourcePosition. Keep SQL translation confined to this client. New RPC endpoint names/parameter shapes are documented in report/.d.mts for Task2.
- Bookmark includes reflectionId,sessionId,todoId,todoTitle,localDate,startTime,endTime,todoUpdatedAt,updatedAt,nextAction,resourceUrl,resourcePosition. Result includes reflectionId,sessionId,todoId,todoTitle,localDate,startedAt,endedAt,note,nextAction,resourceUrl,resourcePosition,focusScore,energyScore,interruptionReason,updatedAt.
- snapshot derives latest per task BEFORE filtering blank, no deleted/completed task bookmark. Results restricted to completed owner sessions at requested study date and explicit learning_result nonempty note. All RPCs deny anon/cross owner and validate linked context.
- RPC completion calls existing complete_study_session in SAME transaction; additional metadata failure rolls everything back. Nullable DB scores preserve old numeric callers; all direct write policy/trigger surfaces enforce new context ownership.
- prepare only owned incomplete past todo, expected date/update match, no active owner study, server calendar-today target; dates only. Existing original plan/segments unchanged. Repeated timed todo occurrence moves independently, never whole series.
- Safe HTTP(S) URL max2048 and position max160, no file uploads/network fetch. note500/nextAction160, existing score1..5 or null.
- Snapshot/mutations must use bounded/abort-aware requests; no timer/polling. Missing schema/error is explicit unavailable, not empty ready data.
- Exports pure selection/validation helpers as needed; keep assertions behavioral and inputs literal.
- [x] **Step1 RED:** SQL test boots real existing schema in PGlite, creates synthetic A/B accounts/todos/linked sessions, calls proposed RPC. Assert A/B bookmarks isolated; latest blank clears only that task; new result note reuses reflection; old row columns unchanged; no fake scores; invalid context/URL/completion rollback; prepare date-only and stale denial. Client tests call real wrapper with boundary fake transport and verify validated values/args/errors/abort, not mock existence.
```js
test('null unentered scores do not dilute explicit ratings',()=>{
 const metrics=buildRangeMetrics(range,sessions,[],[],[
  {session_id:'s1',focus_score:4,energy_score:2},
  {session_id:'s2',focus_score:null,energy_score:null}
 ]);
 assert.equal(metrics.averageFocus,4); assert.equal(metrics.averageEnergy,2);
});
```
- [x] **Step2:** Run new SQL/client and covering score tests, record expected missing RPC/column/export and wrong average RED evidence.
- [x] **Step3 GREEN:** Add nullable/additive schema, owner validation, snapshot/mutation wrappers and validated client implementation. Existing legacy end functions untouched; no old-row rewrite. Implement average using only finite numeric1..5 values.
- [x] **Step4:** Run focused SQL/client/score tests and build; inspect diff/security/legacy compatibility. Save tests/commands/counts/report. Commit ONLY owned files if these gates pass; no push/remote apply. Release claims.

## Task 2: Shared start/finish/result UI and regressions
**Files:**
- Modify apps/web/src/main.tsx, SessionReflectionModal.tsx, dashboardData.ts and nullable reflection prop declarations in studyReportData.d.mts, weeklyReview.d.mts, WeeklyReviewSection.tsx. Existing appTheme.css tokens are consumed, not redefined; feature-scoped styling lives in the new learningContinuity.css.
- Create apps/web/src/LearningContinuityView.tsx, useLearningContinuity.ts, learningContinuity.css, apps/web/test/learningContinuityMounted.test.mjs (reuse actual-study fixture boundary). The hook owns only the new read/draft/mutation state; it never starts/stops study or camera. Main retains official lifecycle callbacks. The View suffix avoids Windows extensionless resolution colliding with learningContinuity.mjs.
- Modify existing fixture/test files only where new RPC/data contract requires truthful adaptation, preserve all assertions and record why.
**Interfaces:** Consumes exact Task1 exports/types/report. New component is display + drafts/callbacks only; main owns existing start/end/reflection and user/session generations. No new native/server SDK imports in view.
- Approved visual references: output/mockups/learning-continuity-20261105/01-start.png, 02-finish.png, 03-results.png. Match their hierarchy with existing app tokens/fonts/icons; no global font/palette/navigation redesign. Live timer/goal context stays real, not mockup example totals.
- [x] **Step1 RED:** Mount REAL App at375/1440 with synthetic data labeled as test. A/B starts choose existing todo IDs, wrong title matches never occur; changing selection shows matching point, no auto new title. Ending A saves null untouched scores and same reflection note; B leaves A bookmark; same result edits same reflection; reload/04-date attribution/legacy memo excluded; URL safe; optional details retain draft; failures retain session/camera and draft; late account responses ignored. Test past date confirm cancel leaves all records, approve changes same todo date only then normal start gates.
- [x] **Step2:** Run focused mounted tests for missing UI/behavior RED. Keep root module tests intact and inspect each expected failure.
- [x] **Step3 GREEN:** Add capability-aware request state separate from critical dashboard. Fetch at user/date/load transitions with cancellation/identity; current-user guarded late results and mutations participate in desktop pending counters. No fast repeated polling. Render start point within existing start widget, retain same-position different-task selector; remove duplicate global next-action card in supported mode. Selection only prepares existing gates.
- [x] **Step4:** Reorder existing reflection to optional note/nextAction first; nullable unentered scores; resource fields collapsed; existing focus/energy/interruption/completion details mounted when collapsed; busy closes blocked. Pick current linked todo as context, permit choosing another linked todo. Existing completion/followup use new validated RPC only when support loaded; errors never silently drop metadata. Result edit is same modal/row and supplies snapshot updatedAt, not a second journal; a stale edit preserves draft and asks for recheck, never blind retries. Legacy schema fallback preserves old form/RPC with no fake new save.
- [x] **Step5:** Single result card in existing Today record tab; uses existing canonical day totals, only explicit notes. Old memo/history preserved. Start point edit reuses same owner-protected reflection data. No result means no large empty card. UI tokens/light-dark/375/1440/200%/keyboard/44px/contrast and no duplicate navigation.
- [x] **Step6:** Run new focused mounted, affected old session/reflection/source-contract tests, type/build. Record changed old tests without weakening and TDD output; self review. Commit ONLY owned files on pass, no push/deploy/real account changes. Release claims; report concerns.

## Release checklist (controller)
- [x] Task-scoped review after each task; final independent whole-feature review. Resolve important/security/data blockers before release.
- [x] ai.ps1 verify --project . (official7 + Dune), full real Chrome suite with explicit executable/module; diff/security/immutable hashes.
- [ ] Remote schema/policies inspect before applying reviewed additive migration; keep old-column count/digest and grants, apply via MCP, compare originals and advisors; no real account test writes.
- [ ] Feature branch push, existing Actions production workflow, exact SHA success/READY/alias/HTTP200/new markers, native actual reload only with fresh idle approval. Docs/progress/troubleshooting/architecture updates, explicit residual acceptance limits.
