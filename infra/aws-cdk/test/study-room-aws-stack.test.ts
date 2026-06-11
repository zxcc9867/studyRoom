import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { StudyRoomAwsStack } from "../src/study-room-aws-stack.js";

test("creates private static hosting through S3 and CloudFront", () => {
  const template = synthTemplate();

  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
    BucketEncryption: {
      ServerSideEncryptionConfiguration: Match.arrayWith([
        Match.objectLike({
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: "AES256",
          },
        }),
      ]),
    },
  });

  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: Match.objectLike({
      DefaultRootObject: "index.html",
      Enabled: true,
      PriceClass: "PriceClass_100",
      DefaultCacheBehavior: Match.objectLike({
        Compress: true,
        ViewerProtocolPolicy: "redirect-to-https",
      }),
      CustomErrorResponses: Match.arrayWith([
        Match.objectLike({
          ErrorCode: 403,
          ResponseCode: 200,
          ResponsePagePath: "/index.html",
        }),
        Match.objectLike({
          ErrorCode: 404,
          ResponseCode: 200,
          ResponsePagePath: "/index.html",
        }),
      ]),
    }),
  });

  template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
});

test("creates a low-cost EventBridge schedule and Lambda invoker", () => {
  const template = synthTemplate();

  template.hasResourceProperties("AWS::Lambda::Function", {
    Architectures: ["arm64"],
    Handler: "index.handler",
    MemorySize: 128,
    Runtime: "nodejs20.x",
    Timeout: 15,
    Environment: {
      Variables: Match.objectLike({
        ATTENDANCE_CRON_URL: Match.anyValue(),
        CRON_SECRET: Match.anyValue(),
        USER_AGENT: "study-room-attendance-aws-scheduler",
      }),
    },
  });

  template.hasResourceProperties("AWS::Events::Rule", {
    ScheduleExpression: "rate(1 minute)",
    State: "ENABLED",
    Targets: Match.arrayWith([
      Match.objectLike({
        Arn: {
          "Fn::GetAtt": [Match.stringLikeRegexp("AttendanceCronInvokerFunction"), "Arn"],
        },
      }),
    ]),
  });
});

test("defines deploy-time parameters without storing a paid Secrets Manager secret", () => {
  const template = synthTemplate();
  const json = template.toJSON();

  assert.equal(json.Parameters.AttendanceCronUrl.Type, "String");
  assert.equal(json.Parameters.CronSecret.NoEcho, true);
  template.resourceCountIs("AWS::SecretsManager::Secret", 0);
});

function synthTemplate() {
  const app = new App();

  const stack = new StudyRoomAwsStack(app, "TestStudyRoomAwsStack", {
    webDistPath: createWebDistFixture(),
  });

  return Template.fromStack(stack);
}

function createWebDistFixture() {
  const distPath = mkdtempSync(path.join(tmpdir(), "study-room-web-dist-"));
  writeFileSync(path.join(distPath, "index.html"), "<main>Study Room</main>");
  return distPath;
}
