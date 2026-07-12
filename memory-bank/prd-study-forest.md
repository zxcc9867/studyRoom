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

## 4. Non-goals

- No server-rendered game scene, physics engine, multiplayer, or persistent character inventory in this version.
- No new Supabase schema in this version.
- No copied game assets, external 3D models, or external image dependency.

## 5. User Stories

- As a learner, I want 7-day attendance streaks to grow visible trees, so that studying feels rewarding.
- As a learner, I want completed trees to remain after a later miss, so that past progress is not erased.
- As a learner, I want to move my character or let it wander, so that the page feels alive.
- As a learner, I want the character to respect water and scenery, so that the island feels like a believable place.
- As a learner, I want to enter the cottage, so that my reward space feels explorable.
- As a learner, I want to preview the next streak upgrade, so that I know what continued attendance will change.

## 6. User Scenarios

### Normal Flow

1. User opens the sidebar Study Forest page.
2. App reads already loaded attendance days.
3. App derives completed tree count, current tree stage, and current streak.
4. User moves the character with arrow keys, WASD, or touch buttons.
5. If the user stops controlling the character, it resumes automatic walking.
6. Cross-river movement follows the bridge and clicks on water or solid props show a short blocked-movement hint.
7. Clicking the cottage door or the accessible cottage action opens a low-poly study room; the exit action returns to the island.
8. The status panel shows the current milestone, the next milestone, remaining attendance days, and the visual upgrade.

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
- [x] Render an original low-poly cottage interior with study furniture and a visible exit action.
- [x] Show 1/3/5/7-day level milestones and describe the next visible forest update.

## 8. Non-functional Requirements

- Performance: use raw Three.js without post-processing; cap device pixel ratio, shadow resolution, geometry counts, and animation work for mobile.
- Security: no new secrets or backend write path.
- Accessibility: route content is keyboard focusable, movement controls have labels, reduced-motion is respected, and a text fallback explains WebGL failure.
- Maintainability: streak/tree math stays in studyForest.mjs rather than inside React JSX.

## 9. Dependencies

- Internal: attendance_days rows already loaded by the dashboard.
- External: three runtime only; no model loader or external asset CDN.
- Supabase: no schema change.
- API: no new API.
- Environment variables: none.

## 10. Success Metrics

- User can open #forest and see a real WebGL 3D forest state derived from attendance history, with the avatar, trees, cottage, river, bridge, and decorative props visibly rendered with depth.
- Desktop and mobile users can move the avatar by keyboard, touch controls, or clicking/tapping the island without excessive GPU resolution.
- The avatar cannot finish or visually travel through water/solid scenery, and cross-river routes visibly use the bridge.
- The cottage interior can be opened and closed with pointer and keyboard-accessible controls.
- The next streak milestone and its reward are understandable without inferring them from the progress percentage.
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
