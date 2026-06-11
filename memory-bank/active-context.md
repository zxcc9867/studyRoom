# Active Context

## Current Work

- Task name: Infrastructure architecture documentation.
- Task purpose: Add an infrastructure architecture document with diagrams, link it from README, and push the documentation update to GitHub.
- Related PRD: `memory-bank/prd-user-profile.md`, `memory-bank/prd-supabase-cron.md`, `memory-bank/prd-aws-cdk-deployment.md`
- Related files:
  - `docs/infrastructure-architecture.md`
  - `README.md`
  - `memory-bank/active-context.md`
  - `memory-bank/progress.md`
  - `memory-bank/implementation-plan.md`

## Recent Decisions

- Decision: Use Mermaid diagrams in Markdown for the infrastructure diagram.
- Reason: GitHub renders Mermaid directly, so the diagram stays reviewable and editable without a separate drawing tool.
- Alternative: Generate a static PNG diagram. This was rejected for now because the architecture is still changing and text-based diagrams are easier to maintain.
- Impact: The infrastructure diagram is version-controlled as plain Markdown.

- Decision: Document both the current recommended Supabase Cron architecture and the optional AWS architecture.
- Reason: The MVP currently relies on Supabase for scheduled alarm processing, while AWS CDK remains an optional deployment path.
- Alternative: Only document AWS. This was rejected because it would hide the simpler current operating path.
- Impact: README now points users to the full infrastructure architecture doc.

## Current Status

- Done: Added `docs/infrastructure-architecture.md`.
- Done: Added diagrams for current recommended architecture, alarm/attendance sequence, data boundary, and optional AWS configuration.
- Done: Linked README system architecture section to the new document.
- Done: Verified README link and Mermaid block count with a Node script.
- Done: `npm.cmd test` passed 37 tests.
- Done: Created commit `dd1f7b8 Document infrastructure architecture`.
- Done: Pushed documentation update to `origin/main`.

## Cautions

- Keep secrets out of architecture docs. Use only environment variable names.
- Do not imply Vercel or S3 sends scheduled alarms. Scheduled alarm processing is handled by Supabase Cron/Edge Function or optional AWS EventBridge/Lambda invoking Supabase.
- Remote `origin/main` is the publish target for this project.
