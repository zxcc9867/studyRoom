# PRD: Study Forest Reward Space

## 1. Problem

Daily attendance pressure can feel punitive if the app only records misses, recovery routines, and warnings. The app needs a lightweight positive reward loop that makes streaks feel visible and personal.

## 2. Target Users

Personal MVP users who want a softer Animal Crossing-style reward for sustained study attendance.

## 3. Goals

- Show a separate Study Forest page from the dashboard sidebar.
- Convert attendance streaks into growing trees: 7 consecutive present days completes one tree.
- Keep completed trees in the personal space even after a future miss.
- Wilt only the current in-progress tree when the latest tracked day is missed.
- Let the user move a small character with keyboard or touch controls.
- Make the personal space feel like a cozy low-poly 3D forest village through original, non-infringing props and character details.
- Render a real WebGL scene with a toy-like island, river, bridge, cottage, garden, warm lights, fireflies, and ambient motion.
- Let the character walk automatically after a short period without user control.
- Let the user click or touch the meadow to move the character to that point.
- Make the avatar expression friendly and smiling, not tense or frowning.
- Use an isometric camera, real geometry, lighting, shadows, and depth so the space reads as 3D on desktop and mobile.
- Keep the avatar on walkable land, route cross-river movement over the bridge, and prevent movement through water or solid scenery.
- Let the user enter the cottage and inspect a cozy low-poly study interior.
- Explain the next streak milestone and the visible forest update it will unlock.
- Let the avatar walk inside the cottage and leave by walking through the physical doorway rather than pressing an exit button.
- Keep the avatar facing the actual movement direction for keyboard, touch, click, and routed movement.
- Unlock visible cottage furniture and decorations alongside tree growth.
- Change the island and cottage atmosphere for morning, afternoon, sunset, and night based on local time.
- Let the user persist a selected island theme, cottage accent, and one featured outdoor reward.
- Expand long-term rewards beyond indoor furniture with birdhouse, picnic, and campfire unlocks tied to completed seven-day trees.
- Treat missing calendar dates as a streak break and start the next seed immediately after an exact seven-day completion.

## 4. Non-goals

- No server-rendered game scene, physics engine, multiplayer, or full item inventory economy in this version.
- No copied game assets, external 3D models, or external image dependency.

## 5. User Stories

- As a learner, I want 7-day attendance streaks to grow visible trees, so that studying feels rewarding.
- As a learner, I want completed trees to remain after a later miss, so that past progress is not erased.
- As a learner, I want to move my character or let it wander, so that the page feels alive.
- As a learner, I want the character to respect water and scenery, so that the island feels like a believable place.
- As a learner, I want to enter the cottage, so that my reward space feels explorable.
- As a learner, I want to preview the next streak upgrade, so that I know what continued attendance will change.
- As a learner, I want to walk around the cottage and leave through its door, so that it feels like part of the same world.
- As a learner, I want my character to look where it walks, so that movement feels natural.
- As a learner, I want attendance to unlock furniture and decorations, so that rewards are not limited to trees.
- As a learner, I want the forest lighting to follow the time of day, so that the space feels alive.

## 6. User Scenarios

### Normal Flow

1. User opens the sidebar Study Forest page.
2. App reads already loaded attendance days.
3. App derives completed tree count, current tree stage, and current streak.
4. User moves the character with arrow keys, WASD, or touch buttons.
5. If the user stops controlling the character, it resumes automatic walking.
6. Cross-river movement follows the bridge and clicks on water or solid props show a short blocked-movement hint.
7. Clicking the cottage door or walking into the entrance opens a low-poly study room.
8. The same movement controls work indoors; walking through the interior doorway returns to the island.
9. The avatar keeps its head and body aligned with the current movement direction.
10. The status panel shows tree growth and the furniture or decoration unlocked at each milestone.
11. Scene colors and lights update for morning, afternoon, sunset, and night.

### Edge Cases

- No attendance history: show an empty land and a seed-stage current tree.
- Completed seven-day cycles: place one tree per completed cycle.
- Latest missed day: current tree becomes wilted and current streak becomes zero.

### Error Cases

- Missing or malformed attendance rows are ignored by the client helper.

## 7. Functional Requirements

- [x] Add a #forest dashboard route.
- [x] Add deterministic study forest helper logic with unit tests.
- [x] Render a Three.js WebGL scene with low-poly land, path, river, bridge, cottage, trees, flowers/stones, and a clearly visible detailed avatar.
- [x] Render richer 3D island details including garden beds, lanterns, fireflies, layered terrain, shadows, and ambient motion.
- [x] Support keyboard movement and touch button movement.
- [x] Resume automatic avatar walking when manual control is idle.
- [x] Support click/touch-to-walk inside the meadow.
- [x] Render a friendly smiling low-poly avatar with real scene depth and smooth target movement.
- [x] Provide a readable fallback when WebGL 2 is unavailable or context creation fails.
- [x] Block water, cottage walls, garden beds, and major tree props while allowing cross-river movement only through the bridge corridor.
- [x] Route long movement targets through bridge waypoints rather than interpolating across water.
- [x] Add an interactive cottage door and an accessible island/interior scene switch.
- [x] Render an original low-poly cottage interior with study furniture.
- [x] Show 1/3/5/7-day level milestones and describe the next visible forest update.
- [x] Support keyboard, touch, and click movement inside the cottage with furniture collision.
- [x] Enter and leave the cottage through doorway portals without an exit button.
- [x] Keep the avatar facing the actual movement direction.
- [x] Unlock non-tree interior props at the 1/3/5/7-day milestones and preserve them after a completed cycle.
- [x] Render morning, afternoon, sunset, and night environment variants from local time.

- [x] Persist user-scoped forest customization with RLS.
- [x] Add locked/unlocked theme, accent, and outdoor reward selectors.
- [x] Render the selected theme, cottage accent, and featured outdoor reward in Three.js.
- [x] Reset current-tree progress to a seed after an exact completed seven-day cycle without duplicating the completed tree.
- [x] Break the active streak when tracked present dates are not consecutive.
## 8. Non-functional Requirements

- Performance: use raw Three.js without post-processing; cap device pixel ratio, shadow resolution, geometry counts, and animation work for mobile.
- Security: user customization is stored behind ownership RLS and explicit least-privilege grants; no frontend secret is added.
- Accessibility: route content is keyboard focusable, movement controls have labels, reduced-motion is respected, and a text fallback explains WebGL failure.
- Maintainability: streak/tree math stays in studyForest.mjs rather than inside React JSX.

## 9. Dependencies

- Internal: attendance_days rows already loaded by the dashboard.
- External: three runtime only; no model loader or external asset CDN.
- Supabase: `study_forest_preferences` stores customization only; attendance remains the reward source of truth.
- API: no new API.
- Environment variables: none.

## 10. Success Metrics

- User can open #forest and see a real WebGL 3D forest state derived from attendance history, with the avatar, trees, cottage, river, bridge, and decorative props visibly rendered with depth.
- Desktop and mobile users can move the avatar by keyboard, touch controls, or clicking/tapping the island without excessive GPU resolution.
- The avatar cannot finish or visually travel through water/solid scenery, and cross-river routes visibly use the bridge.
- The cottage can be entered and exited through its door, and the interior supports the same keyboard, touch, and click movement controls.
- The avatar faces left, right, up, or down consistently with its active movement segment.
- The next streak milestone explains both tree growth and the interior item it unlocks.
- Time-phase boundaries deterministically select morning, afternoon, sunset, or night and visibly change the 3D environment.
- Unit tests cover tree completion, wilting, growth stages, and avatar movement bounds.
- npm.cmd test and npm.cmd run build pass.

## 11. Rollout Plan

- Development: ship a client-only Three.js page behind the existing authenticated dashboard while preserving streak/tree helper logic.
- Testing: unit tests plus production build.
- Deployment: Vercel production through existing GitHub/Vercel workflow.
- Monitoring: user feedback and visual inspection of the new page.

## 12. Open Questions

- Whether future versions should persist custom decorations or character position in Supabase.
- Whether future versions should add decoration placement or camera controls after mobile performance is validated.
- Whether future versions should persist the last island/interior location or unlock furniture customization.

## 13. 2026-07-17 Update: Surface Height, Exit Door, and Item Grid

### Decision

- 강은 가로축으로 흐르고 다리는 강을 직교해 건너도록 90도 회전한다. 이동 가능 corridor도 실제 회전된 데크 폭과 같은 범위만 허용한다.
- 야외 캐릭터의 월드 Y 좌표는 고정값이 아니라 `getForestTerrainHeight()`에서 결정한다. 다리 입구에서 중앙 아치까지 높아졌다가 반대편에서 다시 낮아지며 animation loop가 이 값을 보간한다.
- 실내 퇴장 포털은 기존 좌표 판정을 유지하되 열린 문짝, 문틀, 문턱, 바닥 표식, 시간대 조명으로 시각적으로 명확하게 표시한다.
- 숲 꾸미기는 테마·집 포인트·야외 보상 카테고리별 캡슐형 아이템 그리드를 사용한다.
- 잠긴 아이템은 실제 이름이나 심볼을 노출하지 않고 큰 `?`와 해금까지 필요한 완성 나무 수만 표시한다.
- 특정 상용 게임의 에셋이나 UI를 복제하지 않고, 기존 숲 팔레트와 원본 기하/심볼만 사용한다.

### Added Functional Requirements

- [x] 다리 3D 형상은 강 흐름과 직교한다.
- [x] 물 충돌 corridor는 실제 다리 폭만 통과시킨다.
- [x] 캐릭터는 다리 데크의 아치 높이를 따라 부드럽게 오르내린다.
- [x] 실내 출구는 문·문턱·바닥 표식으로 즉시 식별 가능하다.
- [x] 출구 버튼 없이 실내 아래쪽 문 영역을 걸어서 통과하면 섬으로 돌아간다.
- [x] 숲 꾸미기는 세 카테고리의 반응형 아이템 그리드로 표시한다.
- [x] 잠긴 아이템 카드는 `?`와 남은 완성 나무 수를 표시한다.
- [x] 지형 높이, 다리 방향, 출구 오브젝트, 아이템 그리드와 잠금 표시를 회귀 테스트로 고정한다.
