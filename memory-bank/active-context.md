# Active Context

## Current Work

- Task name: Mobile light-theme hardening.
- Task purpose: Make the mobile web UI render with the same light palette as PC even when the mobile OS/browser is in dark mode.
- Related PRD: `memory-bank/prd-user-profile.md`
- Related files:
  - `apps/web/index.html`
  - `apps/web/src/styles.css`
  - `apps/web/test/mobileTheme.test.mjs`

## Recent Decisions

- Decision: Harden the existing light-theme opt-out instead of changing the visual design.
- Reason: The product direction is still the Animal Crossing-style light UI, and the user specifically wants mobile to match PC.
- Alternative: Add a dark theme. This was rejected because it conflicts with the current request.
- Impact: Mobile browsers receive stronger light-only hints and CSS dark-mode overrides.

- Decision: Add HTML-level pre-paint styles in addition to the stylesheet.
- Reason: Some mobile browsers apply page-level dark styling before external CSS finishes loading.
- Alternative: Only update `styles.css`. This was rejected because it may still allow a dark flash or mobile UA auto styling.
- Impact: The initial document background and text color are light before React mounts.

## Current Status

- Done: Changed `meta name="color-scheme"` to `only light`.
- Done: Added `meta name="supported-color-schemes" content="light"`.
- Done: Added HTML pre-paint light background and text style.
- Done: Added CSS `@media (prefers-color-scheme: dark)` override to keep app background/text light.
- Done: Expanded `mobileTheme.test.mjs`.
- Done: `node --test apps\web\test\mobileTheme.test.mjs` passed.
- Done: `npm.cmd test` passed 37 tests.
- Done: `npm.cmd run build` passed and dist contains the light-only metadata/CSS.
- Done: Created commit `6dd1953 Harden mobile light theme`.
- Done: Pushed the mobile light-theme fix to `origin/main`.

## Cautions

- If a user has enabled an aggressive browser extension or vendor-specific forced dark mode, the browser may still transform pages outside normal CSS controls.
- Do not introduce a dark theme unless the user explicitly asks for it.
- Remote `origin/main` is the publish target for this project.
