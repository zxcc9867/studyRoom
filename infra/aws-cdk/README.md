# Study Room AWS CDK

This CDK app deploys only the AWS resources needed to host the existing study-room MVP cheaply.

## Architecture

- S3 private bucket stores the Vite `apps/web/dist` build.
- CloudFront serves the web dashboard with Origin Access Control.
- EventBridge invokes a 128 MB ARM Lambda every minute.
- Lambda calls the existing Supabase `attendance-cron` Edge Function.
- Supabase keeps Auth, DB, RLS, notification targets, and actual reminder delivery logic.

No Secrets Manager secret is created by default. `CronSecret` is a CloudFormation `NoEcho` parameter and is passed to Lambda as an encrypted environment variable. This avoids the fixed monthly Secrets Manager charge for a personal MVP.

## Commands

Run from `C:\jini-dev\project\study-room-attendance`.

```powershell
npm.cmd --prefix infra/aws-cdk install
npm.cmd run infra:test
npm.cmd run infra:synth
npm.cmd --prefix infra/aws-cdk run deploy -- --parameters CronSecret=<same-value-as-supabase-edge-function>
```

If your Supabase project URL changes, override the default function URL:

```powershell
npm.cmd --prefix infra/aws-cdk run deploy -- --parameters AttendanceCronUrl=https://<project-ref>.supabase.co/functions/v1/attendance-cron --parameters CronSecret=<same-value-as-supabase-edge-function>
```

## Cost Notes

- The stack avoids NAT Gateway, EC2, RDS, API Gateway, and Secrets Manager.
- S3, CloudFront, Lambda, and EventBridge should stay in free-tier or tiny-cost territory for a personal MVP.
- CloudWatch Logs retention is set to one week to limit log storage.
- Destroying the stack deletes the static website bucket objects to avoid stranded S3 storage cost.

## Prerequisites

- AWS credentials configured locally.
- CDK bootstrap already run in the target account and region.
- `apps/web/.env.local` has the production Supabase values before deployment build.
- Supabase `attendance-cron` Edge Function has the same `CRON_SECRET` value passed to this stack.
