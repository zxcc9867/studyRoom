import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { RDSClient, DescribeOrderableDBInstanceOptionsCommand } from '@aws-sdk/client-rds';
import { BedrockClient, GetFoundationModelCommand } from '@aws-sdk/client-bedrock';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { fromIni } from '@aws-sdk/credential-providers';
import { engineVersion } from '../lib/pilot-stack.js';
import { assertTarget, parseDeployment } from './guard.js';
import { smoke, type PilotPublicConfig } from './smoke.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cdk = join(root, 'node_modules', 'aws-cdk', 'bin', 'cdk');
const usage = 'npm run deploy -- --profile <sandbox-profile> --account <12-digit-id> --region <region> --stage pilot-<name> --model <regional-model-id> --allow-cost';
const costNotice = 'Review Aurora, RDS Proxy, NAT, S3 and retained resources. See README.md → 유지 비용과 종료; no automatic stack teardown.';
const assets = {
  'index.html':'text/html; charset=utf-8', 'styles.css':'text/css; charset=utf-8',
  'app.mjs':'text/javascript; charset=utf-8', 'oauth.mjs':'text/javascript; charset=utf-8',
  'realtime.mjs':'text/javascript; charset=utf-8'
};

function runNode(args: readonly string[], env = process.env) {
  const result = spawnSync(process.execPath, args, {cwd:root, env, stdio:'inherit'});
  if (result.status !== 0) throw new Error('Local command failed; see the preceding output.');
}

async function describeStack(cloudFormation: CloudFormationClient, name: string) {
  try {
    const result = await cloudFormation.send(new DescribeStacksCommand({StackName:name}));
    return result.Stacks?.[0];
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError' && error.message.includes('does not exist')) return undefined;
    throw error;
  }
}

function safeOutput(output: ReadonlyMap<string, string>, region: string) {
  const get = (key: string) => {
    const value = output.get(key);
    if (!value) throw new Error(`CloudFormation did not return ${key}.`);
    return value;
  };
  const webUrl = get('WebUrl');
  const config: PilotPublicConfig = {
    apiUrl:get('ApiUrl'), cognitoDomain:get('CognitoDomain'), clientId:get('WebClientId'),
    appSyncHttpUrl:get('AppSyncHttpUrl'), appSyncRealtimeUrl:get('AppSyncRealtimeUrl')
  };
  const expected = [
    [webUrl, 'https:', '.cloudfront.net', '/'],
    [config.apiUrl, 'https:', `.execute-api.${region}.amazonaws.com`, '/'],
    [config.cognitoDomain, 'https:', `.auth.${region}.amazoncognito.com`, '/'],
    [config.appSyncHttpUrl, 'https:', `.appsync-api.${region}.amazonaws.com`, '/event'],
    [config.appSyncRealtimeUrl, 'wss:', `.appsync-realtime-api.${region}.amazonaws.com`, '/event/realtime']
  ];
  for (const [value, protocol, domain, pathname] of expected) {
    const url = new URL(value);
    if (url.protocol !== protocol || !url.hostname.endsWith(domain) || url.port ||
        url.pathname !== pathname || url.username || url.password || url.search || url.hash) {
      throw new Error('CloudFormation returned an invalid pilot endpoint.');
    }
  }
  const smokeClientId = get('SmokeClientId');
  if (!/^[a-z0-9]+$/.test(config.clientId) || !/^[a-z0-9]+$/.test(smokeClientId)) {
    throw new Error('CloudFormation returned an invalid pilot client ID.');
  }
  return {
    config, webUrl, smokeClientId, userPoolId:get('UserPoolId'),
    initializeFunction:get('InitializeFunction'), siteBucket:get('SiteBucket')
  };
}

let phase = 'argument validation';
try {
  if (process.argv.slice(2).join(' ') === '--help') {
    console.log(usage);
  } else {
    const settings = parseDeployment(process.argv.slice(2));
    const {profile, account, region, stage, model} = settings;
    const name = `StudyRoom-${stage}`;
    phase = 'local build, tests and synthesis';
    runNode(['dist/scripts/build.js']);
    runNode(['--test', 'dist/test/*.test.js', 'runtime/*.test.mjs', 'web/*.test.mjs']);
    const context = Object.entries({account, region, stage, model}).flatMap(([key,value]) => ['-c', `${key}=${value}`]);
    // Use the selected profile, not unrelated ambient credentials or configured endpoint overrides.
    for (const key of [
      'AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_SECURITY_TOKEN',
      'AWS_ROLE_ARN','AWS_WEB_IDENTITY_TOKEN_FILE','AWS_ROLE_SESSION_NAME','CDK_DEFAULT_ACCOUNT','CDK_DEFAULT_REGION'
    ]) delete process.env[key];
    process.env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS = 'true';
    process.env.AWS_PROFILE = profile;
    process.env.AWS_DEFAULT_PROFILE = profile;
    process.env.AWS_REGION = region;
    process.env.AWS_DEFAULT_REGION = region;
    const env = {...process.env};
    runNode([cdk, 'synth', name, '--no-lookups', '--quiet', ...context], env);

    phase = 'read-only AWS preflight (STS, CDK bootstrap, region/model, stack tags)';
    const credentials = fromIni({profile});
    const aws = {region, credentials, ignoreConfiguredEndpointUrls:true};
    const identity = await new STSClient(aws).send(new GetCallerIdentityCommand({}));
    if (identity.Account !== account) throw new Error('STS account does not match the approved pilot.');
    const bootstrap = await new SSMClient(aws).send(new GetParameterCommand({Name:'/cdk-bootstrap/hnb659fds/version'}));
    assertTarget(settings, identity, bootstrap.Parameter?.Value);
    const capacity = await new RDSClient(aws).send(new DescribeOrderableDBInstanceOptionsCommand({
      Engine:'aurora-postgresql', EngineVersion:engineVersion.auroraPostgresFullVersion, DBInstanceClass:'db.serverless'
    }));
    const zones = new Set((capacity.OrderableDBInstanceOptions ?? []).flatMap(option =>
      (option.AvailabilityZones ?? []).map(zone => zone.Name).filter(Boolean)));
    if (zones.size < 2) throw new Error('The pinned Aurora engine has fewer than two orderable AZs in this region.');
    const foundation = await new BedrockClient(aws).send(new GetFoundationModelCommand({modelIdentifier:model}));
    if (!foundation.modelDetails?.inferenceTypesSupported?.includes('ON_DEMAND') ||
        !foundation.modelDetails?.inputModalities?.includes('TEXT') ||
        !foundation.modelDetails?.outputModalities?.includes('TEXT')) {
      throw new Error('The selected region does not advertise direct on-demand text inference for this model.');
    }
    const cfn = new CloudFormationClient(aws);
    const previous = await describeStack(cfn, name);
    if (previous) {
      const tags = Object.fromEntries((previous.Tags ?? []).map(t => [t.Key,t.Value]));
      if (tags.Application !== 'study-room-native-pilot' || tags.Stage !== stage) {
        throw new Error('A non-pilot stack already uses this name.');
      }
    }

    phase = 'CDK deploy';
    console.log(`Deploying ${name} in account ${account}, ${region}. Pilot resources incur AWS charges.`);
    runNode([cdk, 'deploy', name, '--no-lookups', '--profile', profile, '--require-approval', 'broadening', ...context], env);
    const deployed = await describeStack(cfn, name);
    const outputs = new Map<string, string>();
    for (const {OutputKey, OutputValue} of deployed?.Outputs ?? []) {
      if (OutputKey && OutputValue) outputs.set(OutputKey, OutputValue);
    }
    const out = safeOutput(outputs, region);

    phase = 'database initialization';
    const result = await new LambdaClient(aws).send(new InvokeCommand({
      FunctionName:out.initializeFunction, Payload:Buffer.from('{}')
    }));
    if (result.FunctionError || result.StatusCode !== 200 ||
        JSON.parse(Buffer.from(result.Payload ?? []).toString()).ok !== true) {
      throw new Error('Pilot schema initialization did not succeed.');
    }

    phase = 'static website and public config';
    const s3 = new S3Client(aws);
    for (const [Key,ContentType] of Object.entries(assets)) {
      await s3.send(new PutObjectCommand({
        Bucket:out.siteBucket, ExpectedBucketOwner:account, Key, ContentType,
        CacheControl:'no-store', Body:await readFile(join(root,'web',Key))
      }));
    }
    await s3.send(new PutObjectCommand({
      Bucket:out.siteBucket, ExpectedBucketOwner:account, Key:'config.json', ContentType:'application/json',
      CacheControl:'no-store', Body:JSON.stringify(out.config)
    }));
    const site = await fetch(out.webUrl + '/config.json', {cache:'no-store', redirect:'error', signal:AbortSignal.timeout(15_000)});
    if (!site.ok || (await site.json()).clientId !== out.config.clientId) throw new Error('CloudFront did not return this pilot configuration.');

    phase = 'two-user synthetic smoke including one Bedrock request';
    await smoke(new CognitoIdentityProviderClient(aws), out, out.config);
    console.log(`Pilot automatic smoke passed: ${out.webUrl}`);
    console.log('Managed browser login still needs separate manual acceptance. Resources remain running and incur charges.');
    console.log(costNotice);
  }
} catch (error) {
  const mayHaveResources = !['argument validation','local build, tests and synthesis','read-only AWS preflight (STS, CDK bootstrap, region/model, stack tags)'].includes(phase);
  const detail = error instanceof Error ? (error.name === 'Error' ? error.message : error.name) : 'Unexpected failure.';
  console.error(`Pilot failed during ${phase}. ${detail}`);
  if (phase === 'argument validation') console.error(usage);
  if (mayHaveResources) console.error(costNotice);
  process.exitCode = 1;
}
