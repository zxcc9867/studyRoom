# AWS CDK Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AWS CDK infrastructure that deploys the Vite web dashboard and runs the reminder scheduler with minimal AWS recurring cost.

**Architecture:** Use S3 + CloudFront for static hosting and EventBridge + Lambda for scheduled calls into the existing Supabase `attendance-cron` Edge Function. Keep Supabase as the system of record for Auth, DB, RLS, notification targets, and delivery logic.

**Tech Stack:** AWS CDK v2, TypeScript, Node.js Lambda, EventBridge, S3, CloudFront, Supabase Edge Function.

---

### Task 1: Lambda Cron Invoker

**Files:**
- Create: `infra/aws-cdk/lambda/attendance-cron-invoker/index.test.mjs`
- Create: `infra/aws-cdk/lambda/attendance-cron-invoker/index.mjs`

- [x] Write tests for POST method, `x-cron-secret`, request body, missing environment variables, and non-2xx errors.
- [x] Run `node --test infra\aws-cdk\lambda\attendance-cron-invoker\index.test.mjs` and verify it fails before implementation.
- [x] Implement `invokeAttendanceCron` and `handler`.
- [x] Re-run the Lambda tests and verify they pass.

### Task 2: CDK Stack

**Files:**
- Create: `infra/aws-cdk/package.json`
- Create: `infra/aws-cdk/tsconfig.json`
- Create: `infra/aws-cdk/cdk.json`
- Create: `infra/aws-cdk/test/study-room-aws-stack.test.ts`
- Create: `infra/aws-cdk/src/study-room-aws-stack.ts`
- Create: `infra/aws-cdk/bin/study-room-aws.ts`

- [x] Add CDK package metadata and scripts.
- [x] Write CloudFormation template tests for private S3, CloudFront OAC, EventBridge, Lambda sizing, and no Secrets Manager resource.
- [x] Install CDK dependencies under `infra/aws-cdk`.
- [x] Run `npm.cmd --prefix infra\aws-cdk run test:cdk` and verify it fails before stack implementation.
- [x] Implement the stack.
- [x] Re-run CDK tests and verify they pass.

### Task 3: Root Scripts and Documentation

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `infra/aws-cdk/README.md`

- [x] Add root `infra:*` scripts.
- [x] Ignore CDK build output and `cdk.out`.
- [x] Document install, synth, deploy, cost notes, and prerequisites.

### Task 4: Verification

**Commands:**
- [x] `npm.cmd run infra:test`
- [x] `npm.cmd run infra:build`
- [x] `npm.cmd run infra:synth`

**Expected Result:** All commands exit with code 0. `infra:synth` also builds `apps/web/dist` and prints a CloudFormation template with S3, CloudFront, Lambda, and EventBridge resources.
