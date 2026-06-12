# Vercel CI Deployment

This project can deploy to Vercel automatically from GitHub Actions.

## Required GitHub Secrets

Add these secrets in GitHub:

Repository -> Settings -> Secrets and variables -> Actions -> New repository secret

```txt
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Current project identifiers:

```txt
VERCEL_ORG_ID=team_LaN4bwvH4msrzoQtIw3fqsUj
VERCEL_PROJECT_ID=prj_u2Q9FKwNeVjwwtVOjuXNMZRpkR3g
```

Do not commit `VERCEL_TOKEN` to the repository.

## How To Create VERCEL_TOKEN

1. Open Vercel Account Settings.
2. Go to Tokens.
3. Create a new token.
4. Set a clear name, for example `study-room-attendance-github-actions`.
5. Choose an expiration date.
6. Copy the token once and save it as the GitHub secret `VERCEL_TOKEN`.

Token page:

```txt
https://vercel.com/account/settings/tokens
```

## Workflow

The workflow file is:

```txt
.github/workflows/vercel-production.yml
```

It runs on:

- `main` branch push
- manual `workflow_dispatch`

Pipeline steps:

1. Install dependencies with `npm ci`.
2. Run `npm test`.
3. Install pinned Vercel CLI `vercel@48.6.0`.
4. Pull Vercel production environment with `vercel pull`.
5. Build with `vercel build --prod`.
6. Deploy the prebuilt output with `vercel deploy --prebuilt --prod`.

## Duplicate Deployment Note

This repository is already connected to Vercel Git integration. If Vercel Git integration remains enabled, a push to `main` may create two production deployments:

- one from Vercel Git integration
- one from GitHub Actions

Use one deployment path as the source of truth. If GitHub Actions should be the only deploy pipeline, disable Vercel automatic Git deployment for this project in the Vercel dashboard or disconnect the Git integration.
