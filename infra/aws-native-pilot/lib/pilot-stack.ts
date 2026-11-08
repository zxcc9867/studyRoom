import {
  ArnFormat, CfnOutput, Duration, Fn, RemovalPolicy, Stack, Tags, type StackProps,
  aws_apigatewayv2 as api, aws_apigatewayv2_authorizers as authorizers,
  aws_apigatewayv2_integrations as integrations, aws_appsync as appsync,
  aws_cloudfront as cloudfront, aws_cloudfront_origins as origins,
  aws_cognito as cognito, aws_ec2 as ec2, aws_iam as iam, aws_lambda as lambda,
  aws_lambda_event_sources as sources, aws_logs as logs, aws_rds as rds,
  aws_s3 as s3, aws_scheduler as scheduler, aws_scheduler_targets as targets,
  aws_secretsmanager as secretsmanager, aws_sqs as sqs
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export const engineVersion = rds.AuroraPostgresEngineVersion.VER_16_8;

interface PilotStackProps extends StackProps {
  stage: string;
  model: string;
  asset: string;
}

interface RuntimeOptions {
  admin?: boolean;
  timeout?: number;
  concurrency?: number;
  extra?: Record<string, string>;
}

export class PilotStack extends Stack {
  override get availabilityZones(): string[] {
    // Resolve AZs in CloudFormation instead of making an account lookup at synthesis.
    return [Fn.select(0, Fn.getAzs()), Fn.select(1, Fn.getAzs())];
  }

  constructor(scope: Construct, id: string, {stage, model, asset, ...props}: PilotStackProps) {
    super(scope, id, props);
    Tags.of(this).add('Application', 'study-room-native-pilot');
    Tags.of(this).add('Stage', stage);

    const site = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN
    });
    const distribution = new cloudfront.Distribution(this, 'Web', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // A small pilot must consistently receive its current public config.
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS
      }
    });
    const webUrl = `https://${distribution.distributionDomainName}`;
    const pool = new cognito.UserPool(this, 'PilotUsers', {
      selfSignUpEnabled: false, signInAliases: {username: true},
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      passwordPolicy: {minLength: 12}, removalPolicy: RemovalPolicy.RETAIN
    });
    const domain = pool.addDomain('LoginDomain', {
      cognitoDomain: {domainPrefix: `studyroom-${stage}-${this.account}-${this.region}`},
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN
    });
    const webClient = pool.addClient('WebLogin', {
      generateSecret: false, preventUserExistenceErrors: true, disableOAuth: false,
      authFlows: {},
      oAuth: {
        flows: {authorizationCodeGrant: true}, scopes: [cognito.OAuthScope.OPENID],
        callbackUrls: [`${webUrl}/`], logoutUrls: [`${webUrl}/`]
      }
    });
    new cognito.CfnManagedLoginBranding(this, 'Branding', {
      userPoolId: pool.userPoolId, clientId: webClient.userPoolClientId, useCognitoProvidedValues: true
    });
    const smokeClient = pool.addClient('SmokeLogin', {
      generateSecret: false, preventUserExistenceErrors: true, disableOAuth: true,
      authFlows: {adminUserPassword: true}
    });
    const audiences = [webClient.userPoolClientId, smokeClient.userPoolClientId];
    const userAuth = {authType: 'AMAZON_COGNITO_USER_POOLS'};
    const serverAuth = {authType: 'AWS_IAM'};
    const eventApi = new appsync.CfnApi(this, 'Events', {
      name: `study-room-${stage}`,
      eventConfig: {
        authProviders: [serverAuth, {...userAuth, cognitoConfig: {
          userPoolId: pool.userPoolId, awsRegion: this.region,
          appIdClientRegex: `^(${audiences.join('|')})$`
        }}],
        connectionAuthModes: [userAuth], defaultSubscribeAuthModes: [userAuth],
        defaultPublishAuthModes: [serverAuth]
      }
    });
    new appsync.CfnChannelNamespace(this, 'StudyChannels', {
      apiId: eventApi.attrApiId, name: 'study',
      publishAuthModes: [serverAuth], subscribeAuthModes: [userAuth],
      codeHandlers: [
        "import { util } from '@aws-appsync/utils';",
        'export function onSubscribe(ctx) {',
        '  if (!ctx.identity || !ctx.identity.sub || ctx.info.channel.path !== "/study/" + ctx.identity.sub) {',
        '    util.unauthorized();',
        '  }',
        '}'
      ].join('\n')
    });
    const appSyncHttpUrl = `https://${eventApi.attrDnsHttp}/event`;
    const appSyncRealtimeUrl = `wss://${eventApi.attrDnsRealtime}/event/realtime`;

    const vpc = new ec2.Vpc(this, 'Network', {
      availabilityZones: this.availabilityZones,
      natGateways: 1,
      subnetConfiguration: [
        {name:'PublicEgress', subnetType: ec2.SubnetType.PUBLIC, cidrMask:24},
        {name:'App', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask:24},
        {name:'Database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask:24}
      ]
    });
    const dbSubnets = {subnetType: ec2.SubnetType.PRIVATE_ISOLATED};
    const appSubnets = {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS};
    const group = (name: string) => new ec2.SecurityGroup(this, name, {vpc, allowAllOutbound:false});
    const dbGroup = group('DatabaseSecurity');
    const proxyGroup = group('ProxySecurity');
    const appGroup = group('RuntimeSecurity');
    const initGroup = group('InitializerSecurity');
    for (const sg of [appGroup, initGroup]) {
      sg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'AWS API egress via NAT');
    }
    const pg = ec2.Port.tcp(5432);
    proxyGroup.connections.allowFrom(appGroup, pg);
    dbGroup.connections.allowFrom(proxyGroup, pg);
    dbGroup.connections.allowFrom(initGroup, pg);

    const databaseName = 'study_pilot';
    const cluster = new rds.DatabaseCluster(this, 'Database', {
      vpc, vpcSubnets: dbSubnets, securityGroups:[dbGroup],
      engine:rds.DatabaseClusterEngine.auroraPostgres({version:engineVersion}),
      writer:rds.ClusterInstance.serverlessV2('Writer', {publiclyAccessible:false}),
      serverlessV2MinCapacity:0.5, serverlessV2MaxCapacity:2,
      defaultDatabaseName:databaseName, credentials:rds.Credentials.fromGeneratedSecret('pilot_admin'),
      storageEncrypted:true, deletionProtection:true, removalPolicy:RemovalPolicy.SNAPSHOT,
      backup:{retention:Duration.days(1)}
    });
    const adminSecret = cluster.secret;
    if (!adminSecret) throw new Error('Pilot cluster requires a generated administrator secret.');
    adminSecret.applyRemovalPolicy(RemovalPolicy.RETAIN);
    const appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      generateSecretString:{
        secretStringTemplate: JSON.stringify({username:'pilot_app'}),
        generateStringKey:'password', passwordLength:40, excludePunctuation:true
      },
      removalPolicy: RemovalPolicy.RETAIN
    });
    const proxy = cluster.addProxy('Proxy', {
      vpc, vpcSubnets:dbSubnets, securityGroups:[proxyGroup], secrets:[appSecret],
      dbProxyName:`study-room-${stage}`,
      requireTLS:true, idleClientTimeout:Duration.minutes(2), borrowTimeout:Duration.seconds(5)
    });

    const dead = new sqs.Queue(this, 'DeadJobs', {encryption:sqs.QueueEncryption.SQS_MANAGED});
    const queue = new sqs.Queue(this, 'Jobs', {
      encryption:sqs.QueueEncryption.SQS_MANAGED, visibilityTimeout:Duration.seconds(180),
      deadLetterQueue:{queue:dead, maxReceiveCount:3}
    });
    const code = lambda.Code.fromAsset(asset);
    const runtime = (name: string, handler: 'api' | 'init' | 'worker' | 'dispatcher',
      {admin = false, timeout = 15, concurrency = 2, extra = {}}: RuntimeOptions = {}) => {
      const secret = admin ? adminSecret : appSecret;
      const func = new lambda.Function(this, name, {
        runtime: lambda.Runtime.NODEJS_22_X, architecture: lambda.Architecture.ARM_64,
        code, handler: `${handler}.handler`, timeout:Duration.seconds(timeout),
        memorySize:256, reservedConcurrentExecutions:concurrency,
        vpc, vpcSubnets:appSubnets, securityGroups:[admin ? initGroup : appGroup],
        logGroup:new logs.LogGroup(this, `${name}Logs`, {retention:logs.RetentionDays.ONE_WEEK}),
        environment:{
          DB_HOST:admin ? cluster.clusterEndpoint.hostname : proxy.endpoint,
          DB_NAME:databaseName, DB_SECRET_ARN:secret.secretArn, ...extra
        }
      });
      secret.grantRead(func);
      return func;
    };
    const init = runtime('Initialize', 'init', {admin:true, concurrency:1, timeout:45, extra:{
      DB_APP_SECRET_ARN:appSecret.secretArn, NODE_EXTRA_CA_CERTS:'/var/runtime/ca-cert.pem'
    }});
    appSecret.grantRead(init);
    const backend = runtime('ApiHandler', 'api', {concurrency:5, extra:{APPSYNC_HTTP_URL:appSyncHttpUrl}});
    const worker = runtime('CoachingWorker', 'worker', {timeout:30, extra:{
      APPSYNC_HTTP_URL:appSyncHttpUrl, BEDROCK_MODEL_ID:model
    }});
    const dispatcher = runtime('DispatchJobs', 'dispatcher', {timeout:30, concurrency:1, extra:{
      QUEUE_URL:queue.queueUrl, APPSYNC_HTTP_URL:appSyncHttpUrl
    }});
    const publishArn = this.formatArn({
      service:'appsync', resource:'apis', resourceName:`${eventApi.attrApiId}/channelNamespace/study`,
      arnFormat:ArnFormat.SLASH_RESOURCE_NAME
    });
    for (const fn of [backend, worker, dispatcher]) {
      fn.addToRolePolicy(new iam.PolicyStatement({actions:['appsync:EventPublish'], resources:[publishArn]}));
    }
    worker.addToRolePolicy(new iam.PolicyStatement({
      actions:['bedrock:InvokeModel'],
      resources:[`arn:${this.partition}:bedrock:${this.region}::foundation-model/${model}`]
    }));
    queue.grantSendMessages(dispatcher);
    worker.addEventSource(new sources.SqsEventSource(queue, {batchSize:1, reportBatchItemFailures:true}));
    new scheduler.Schedule(this, 'PollOutbox', {
      schedule:scheduler.ScheduleExpression.rate(Duration.minutes(1)),
      target:new targets.LambdaInvoke(dispatcher, {retryAttempts:0})
    });

    const http = new api.HttpApi(this, 'Http', {
      corsPreflight:{
        allowOrigins:[webUrl], allowHeaders:['authorization','content-type'],
        allowMethods:[api.CorsHttpMethod.GET, api.CorsHttpMethod.POST, api.CorsHttpMethod.OPTIONS]
      },
      defaultAuthorizer:new authorizers.HttpJwtAuthorizer(
        'PilotIssuer', `https://cognito-idp.${this.region}.${this.urlSuffix}/${pool.userPoolId}`,
        {jwtAudience:audiences}
      )
    });
    const stageResource = http.defaultStage?.node.defaultChild;
    if (!(stageResource instanceof api.CfnStage)) throw new Error('Pilot HTTP API requires a default stage.');
    stageResource.defaultRouteSettings = {throttlingBurstLimit:10, throttlingRateLimit:5};
    const integration = new integrations.HttpLambdaIntegration('ApiIntegration', backend);
    for (const [method, path] of [
      ['GET','/records'], ['POST','/records'], ['GET','/records/{id}'],
      ['POST','/coaching'], ['GET','/coaching/{id}']
    ] as const) http.addRoutes({path, methods:[api.HttpMethod[method]], integration});

    for (const [key, value] of Object.entries({
      WebUrl:webUrl, SiteBucket:site.bucketName, UserPoolId:pool.userPoolId,
      WebClientId:webClient.userPoolClientId, SmokeClientId:smokeClient.userPoolClientId,
      CognitoDomain:domain.baseUrl(), ApiUrl:http.apiEndpoint,
      AppSyncHttpUrl:appSyncHttpUrl, AppSyncRealtimeUrl:appSyncRealtimeUrl,
      InitializeFunction:init.functionName
    })) new CfnOutput(this, key, {value});
  }
}
