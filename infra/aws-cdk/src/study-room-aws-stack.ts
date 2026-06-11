import path from "node:path";

import {
  CfnOutput,
  CfnParameter,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface StudyRoomAwsStackProps extends StackProps {
  lambdaAssetPath?: string;
  webDistPath: string;
  scheduleMinutes?: number;
}

export class StudyRoomAwsStack extends Stack {
  constructor(scope: Construct, id: string, props: StudyRoomAwsStackProps) {
    super(scope, id, props);

    const attendanceCronUrl = new CfnParameter(this, "AttendanceCronUrl", {
      type: "String",
      description: "Supabase attendance-cron Edge Function URL.",
      default: "https://bqohkdzvxbrokkmuhysx.supabase.co/functions/v1/attendance-cron",
    });
    const cronSecret = new CfnParameter(this, "CronSecret", {
      type: "String",
      description: "CRON_SECRET value configured on the Supabase attendance-cron Edge Function.",
      noEcho: true,
    });
    const scheduleMinutes = props.scheduleMinutes ?? 1;
    const lambdaAssetPath =
      props.lambdaAssetPath ?? path.join(process.cwd(), "lambda", "attendance-cron-invoker");

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const distribution = new cloudfront.Distribution(this, "WebsiteDistribution", {
      defaultBehavior: {
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
      ],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new s3deploy.BucketDeployment(this, "WebsiteDeployment", {
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"],
      memoryLimit: 128,
      prune: true,
      retainOnDelete: false,
      sources: [s3deploy.Source.asset(props.webDistPath)],
    });

    const invokerLogGroup = new logs.LogGroup(this, "AttendanceCronInvokerLogGroup", {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const invokerFunction = new lambda.Function(this, "AttendanceCronInvokerFunction", {
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(lambdaAssetPath),
      environment: {
        ATTENDANCE_CRON_URL: attendanceCronUrl.valueAsString,
        CRON_SECRET: cronSecret.valueAsString,
        USER_AGENT: "study-room-attendance-aws-scheduler",
      },
      handler: "index.handler",
      logGroup: invokerLogGroup,
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(15),
    });

    new events.Rule(this, "AttendanceCronScheduleRule", {
      description: "Invokes the Supabase attendance-cron Edge Function for due study-room reminders.",
      enabled: true,
      schedule: events.Schedule.rate(Duration.minutes(scheduleMinutes)),
      targets: [new targets.LambdaFunction(invokerFunction)],
    });

    new CfnOutput(this, "CloudFrontDomainName", {
      value: distribution.distributionDomainName,
      description: "CloudFront domain for the study-room web dashboard.",
    });
    new CfnOutput(this, "WebsiteBucketName", {
      value: websiteBucket.bucketName,
      description: "Private S3 bucket that stores the Vite web build.",
    });
    new CfnOutput(this, "AttendanceCronInvokerFunctionName", {
      value: invokerFunction.functionName,
      description: "Lambda function invoked by EventBridge.",
    });
  }
}
