import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PilotStack } from '../lib/pilot-stack.js';

function template(stage = 'pilot-test') {
  return Template.fromStack(new PilotStack(new App(), 'PilotTest', {
    env: { account: '111111111111', region: 'us-east-1' },
    stage, model: 'amazon.nova-lite-v1:0', asset: 'test'
  }));
}

test('private CDN origin and explicit web client and API trust boundary', () => {
  const t = template();
  t.hasResourceProperties('AWS::S3::Bucket', { PublicAccessBlockConfiguration: {
    BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true
  }});
  t.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
    OriginAccessControlConfig: { SigningBehavior: 'always', OriginAccessControlOriginType: 's3' }
  });
  t.hasResourceProperties('AWS::Cognito::UserPool', { AdminCreateUserConfig: { AllowAdminCreateUserOnly: true } });
  t.hasResourceProperties('AWS::Cognito::UserPoolClient', { AllowedOAuthFlows: ['code'], GenerateSecret: false });
  t.hasResourceProperties('AWS::Cognito::UserPoolClient', {
    AllowedOAuthFlowsUserPoolClient: false, ExplicitAuthFlows: Match.arrayWith(['ALLOW_ADMIN_USER_PASSWORD_AUTH'])
  });
  t.hasResourceProperties('AWS::ApiGatewayV2::Api', {
    CorsConfiguration: { AllowOrigins: Match.arrayWith([Match.objectLike({'Fn::Join': Match.anyValue()})]) }
  });
  t.resourceCountIs('AWS::ApiGatewayV2::Route', 5);
  for (const route of Object.values(t.findResources('AWS::ApiGatewayV2::Route'))) {
    assert.equal(route.Properties.AuthorizationType, 'JWT');
  }
});

test('encrypted and non-public data path, bounded queue and Cognito-only subscribe / IAM-only publish', () => {
  const t = template();
  t.hasResource('AWS::RDS::DBCluster', {
    DeletionPolicy:'Snapshot', Properties:{StorageEncrypted:true, DeletionProtection:true}
  });
  t.hasResourceProperties('AWS::RDS::DBInstance', { PubliclyAccessible:false, DBInstanceClass:'db.serverless' });
  t.hasResourceProperties('AWS::RDS::DBProxy', { RequireTLS:true, DBProxyName:'study-room-pilot-test' });
  t.hasResourceProperties('AWS::SQS::Queue', { RedrivePolicy: { maxReceiveCount: 3 } });
  t.hasResourceProperties('AWS::AppSync::ChannelNamespace', {
    Name:'study', PublishAuthModes:[{AuthType:'AWS_IAM'}], SubscribeAuthModes:[{AuthType:'AMAZON_COGNITO_USER_POOLS'}],
    CodeHandlers: Match.stringLikeRegexp('ctx.info.channel.path !== "/study/" [+] ctx.identity.sub')
  });
  t.resourceCountIs('AWS::EC2::NatGateway', 1);
  t.hasResourceProperties('AWS::Lambda::Function', {
    Handler:'dispatcher.handler', Environment:{Variables:{APPSYNC_HTTP_URL:Match.anyValue()}}
  });
});

test('a second pilot stage has a different account-local proxy name', () => {
  template('pilot-other').hasResourceProperties('AWS::RDS::DBProxy', {DBProxyName:'study-room-pilot-other'});
});
