# PRD: Vercel CI Pipeline

## 1. Problem

Manual Vercel CLI deployment is unreliable on this Windows environment because local CLI authentication can be missing or blocked by the non-ASCII hostname user-agent issue.

## 2. Target Users

- Project owner who pushes changes to GitHub.
- AI coding agent maintaining the study room app.

## 3. Goals

- Deploy the web app to Vercel production automatically when `main` is pushed.
- Require tests to pass before production deployment.
- Keep Vercel credentials out of source control.

## 4. Non-goals

- Do not store or rotate secrets from code.
- Do not deploy Supabase Edge Functions from this GitHub Actions workflow.
- Do not change the existing Vercel project settings automatically.

## 5. User Stories

```md
- As a project owner, I want pushes to main to deploy the web app to Vercel, so that production updates do not depend on local CLI login.
- As a project owner, I want tests to run before deploy, so that broken changes are less likely to reach production.
```

## 6. User Scenarios

### Normal Flow

1. User creates `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` GitHub secrets.
2. User pushes to `main`.
3. GitHub Actions installs dependencies and runs tests.
4. GitHub Actions builds and deploys the Vercel prebuilt output to production.

### Edge Cases

- Vercel Git integration is still enabled and creates a duplicate deployment.
- A required GitHub secret is missing.

### Error Cases

- `vercel pull` fails because `VERCEL_TOKEN` is missing or expired.
- `npm test` fails and deployment is blocked.
- `vercel build` fails because Vercel environment variables are incomplete.

## 7. Functional Requirements

- [x] Add a GitHub Actions workflow for production Vercel deployment.
- [x] Run tests before deploy.
- [x] Use GitHub secrets for Vercel token, org ID, and project ID.
- [x] Pin the Vercel CLI version used by CI.
- [x] Document how to create and register `VERCEL_TOKEN`.

## 8. Non-functional Requirements

- Security: never commit Vercel tokens.
- Maintainability: keep workflow steps explicit and short.
- Reliability: use `vercel build` plus `vercel deploy --prebuilt` so the tested build artifact is deployed.

## 9. Dependencies

- Internal dependencies: root `npm test`, `vercel.json`.
- External dependencies: GitHub Actions, Vercel CLI.
- Supabase: Vercel production environment variables must already be configured in Vercel.
- API: Vercel deployment API through CLI.
- Environment variables: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## 10. Success Metrics

- Push to `main` creates a successful GitHub Actions run.
- Vercel production receives the new deployment.
- Failed tests block production deployment.

## 11. Rollout Plan

- Development: add workflow and documentation.
- Test: run local test/build commands and inspect workflow syntax.
- Deployment: push to GitHub after secrets are configured.
- Monitoring: check GitHub Actions run and Vercel deployment status after first push.

## 12. Open Questions

- Whether to keep Vercel Git integration enabled or make GitHub Actions the only production deployment source.
