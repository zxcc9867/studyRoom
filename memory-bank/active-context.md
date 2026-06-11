# Active Context

## Current Work

- Task name: GitHub publish preparation and README refresh.
- Task purpose: Commit the current study-room app work, add a README thumbnail, refresh README content, and prepare for GitHub push.
- Related PRD: `memory-bank/prd-user-profile.md`, `memory-bank/prd-my-page-todo-history.md`
- Related files:
  - `README.md`
  - `.gitignore`
  - `docs/images/study-room-thumbnail.png`
  - `.git`

## Recent Decisions

- Decision: Use a public login-screen thumbnail instead of a logged-in dashboard screenshot.
- Reason: The dashboard requires authentication and can expose personal email, Telegram state, or todo data. README should avoid user-specific data.
- Alternative: Capture an authenticated dashboard screenshot. This was rejected for README safety.
- Impact: The README thumbnail shows the app identity and login flow without exposing private data.

- Decision: Initialize a local git repository on `main` and create an initial commit.
- Reason: `C:\jini-dev\project\study-room-attendance` was not a git repository, and the parent folder was not a git repository either.
- Alternative: Push through an existing unrelated GitHub repository. This was rejected because no matching `study-room-attendance` repo was found in accessible GitHub repositories.
- Impact: Local commit exists, but push needs a target GitHub repository URL or a repo creation path.

## Current Status

- Done: Rewrote `README.md` in UTF-8 Korean and added current feature, architecture, env, deployment, and security notes.
- Done: Added `docs/images/study-room-thumbnail.png`.
- Done: Added `.codex-logs/`, `*.log`, `*.err`, and `*.tsbuildinfo` to `.gitignore`.
- Done: Verified no likely committed secret file matches with filename-only `rg -l` scan.
- Done: Ran `npm.cmd test`; 37 tests passed.
- Done: Ran `npm.cmd run build`; Vite production build passed.
- Done: Initialized local git repository on `main`.
- Done: Created local commit `6f7fb40 Initial study room attendance app`.
- Blocked: GitHub push is not complete because no remote is configured and `gh` CLI is not installed.
- Blocked: GitHub connector listed accessible repositories, but no matching `study-room-attendance` repository was available.

## Cautions

- Do not push this project into an unrelated repository such as `next-js` without explicit user confirmation.
- Do not record Telegram bot tokens, chat IDs, cron secrets, Vercel tokens, Supabase access tokens, or service-role keys in code, docs, or final messages.
- If the user provides a GitHub repository URL, add it as `origin` and push `main`.
