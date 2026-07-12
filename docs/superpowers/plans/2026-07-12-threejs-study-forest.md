# Three.js Study Forest Plan

## Goal

Replace the CSS 2.5D meadow with a real, original low-poly WebGL study island while preserving attendance-derived trees, avatar movement, idle walking, and the existing authenticated route.

## Visual Direction

- Cozy toy-island composition with rounded low-poly geometry.
- Original cottage, bridge, river, garden, lanterns, rocks, flowers, fruit trees, and smiling learner avatar.
- Fixed isometric camera with warm daylight, soft fog, restrained shadows, and subtle ambient motion.
- No copied characters, meshes, textures, logos, or external art assets.

## Architecture

1. Add three as the only new runtime dependency.
2. Create StudyForest3D.tsx as an isolated renderer component.
3. Keep streak/tree math and avatar target state in the existing helpers and dashboard.
4. Map percentage avatar coordinates to bounded world coordinates.
5. Use Raycaster against an invisible ground plane for click/touch movement.
6. Cap DPR and shadow map size; avoid post-processing and model loaders.
7. Expose a WebGL fallback and reduced-motion behavior.
8. Replace the old scene JSX while retaining accessible HTML movement controls and status cards.

## Verification

- Helper/source contract tests for Three.js setup, low-poly primitives, Raycaster movement, mobile DPR cap, cleanup, and fallback.
- Existing Study Forest state/movement tests.
- Expo typecheck, full web test suite, production build.
- Desktop and mobile viewport browser screenshots with console-error checks.
- Production deployment and live HTTP/browser smoke test.

## Result

- Implemented and visually verified on desktop and mobile.
- Three.js is lazy-loaded and uses no external visual assets.
- Full tests, typecheck, build, interaction verification, and web runtime audit passed.
