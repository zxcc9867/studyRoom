# AWS CDK Deployment Design

## Goal

Deploy the study-room MVP with minimal recurring AWS cost while keeping the existing Supabase-backed product model.

## Architecture

The web dashboard remains a static Vite React build. AWS hosts only the static files and the scheduler invoker:

- S3 private bucket stores `apps/web/dist`.
- CloudFront serves the bucket through Origin Access Control.
- EventBridge runs once per minute.
- A 128 MB ARM Lambda receives the EventBridge event and calls Supabase `attendance-cron`.
- Supabase continues to own Auth, DB, RLS, notification targets, attendance logic, and notification delivery.

## Cost Decision

The stack does not create Secrets Manager by default. `CronSecret` is a CloudFormation `NoEcho` parameter and is passed to Lambda as an encrypted environment variable. This is less ideal than Secrets Manager for a multi-operator production environment, but it avoids fixed monthly cost for a personal MVP.

The stack also avoids NAT Gateway, EC2, RDS, API Gateway, and always-on compute.

## Components

- `infra/aws-cdk/src/study-room-aws-stack.ts`: CDK stack for S3, CloudFront, EventBridge, Lambda, and outputs.
- `infra/aws-cdk/bin/study-room-aws.ts`: CDK app entrypoint.
- `infra/aws-cdk/lambda/attendance-cron-invoker/index.mjs`: Lambda handler that calls Supabase.
- `infra/aws-cdk/test/study-room-aws-stack.test.ts`: CloudFormation template assertions.
- `infra/aws-cdk/lambda/attendance-cron-invoker/index.test.mjs`: Lambda behavior tests.

## Data Flow

1. User opens the CloudFront URL.
2. CloudFront serves static files from the private S3 bucket.
3. The web app talks directly to Supabase with the public anon key.
4. EventBridge invokes Lambda every minute.
5. Lambda posts to `https://<project-ref>.supabase.co/functions/v1/attendance-cron` with `x-cron-secret`.
6. Supabase Edge Function decides which reminders are due and sends Expo/Web Push/Email through the existing implementation.

## Error Handling

Lambda fails fast when `ATTENDANCE_CRON_URL` or `CRON_SECRET` is missing. If Supabase returns a non-2xx response, Lambda throws with the status code and a short body preview so CloudWatch Logs show the concrete failure.

CloudFront maps `403` and `404` to `/index.html` so React routes do not break on refresh.

## Testing

- Lambda tests verify request method, headers, body, missing env handling, and non-2xx handling.
- CDK tests verify private S3 hosting, CloudFront OAC, SPA fallback, EventBridge schedule, Lambda sizing, and absence of Secrets Manager.
- `npm.cmd run infra:synth` verifies web build, CDK build, and CloudFormation synthesis.
