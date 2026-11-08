import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeployment, assertTarget } from '../scripts/guard.js';

const args = '--profile sandbox --account 111111111111 --region us-east-1 --stage pilot-review --model amazon.nova-lite-v1:0 --allow-cost'.split(' ');

test('no paid operation can proceed without explicit consent, stage and account', () => {
  assert.throws(() => parseDeployment(args.slice(0, -1)));
  assert.throws(() => parseDeployment(args.map(arg => arg === 'pilot-review' ? 'production' : arg)));
  assert.throws(() => parseDeployment([...args, '--region', 'eu-west-1']));
  assert.throws(() => parseDeployment(args.map(arg => arg === 'amazon.nova-lite-v1:0' ? 'arn:aws:bedrock:us-east-1:222222222222:inference-profile/other' : arg)));
  assert.deepEqual(parseDeployment(args), {
    profile: 'sandbox', account: '111111111111', region: 'us-east-1',
    stage: 'pilot-review', model: 'amazon.nova-lite-v1:0'
  });
});

test('wrong STS account, nonstandard partitions and unknown bootstrap stop before deploy', () => {
  const target = parseDeployment(args);
  assert.throws(() => assertTarget(target, {Account:'222222222222', Arn:'arn:aws:iam::222222222222:role/Test'}, '30'));
  assert.throws(() => assertTarget(target, {Account:target.account, Arn:'arn:aws-cn:iam::111111111111:role/Test'}, '30'));
  assert.throws(() => assertTarget(target, {Account:target.account, Arn:'arn:aws:iam::111111111111:role/Test'}, undefined));
  assert.doesNotThrow(() => assertTarget(target, {Account:target.account, Arn:'arn:aws:iam::111111111111:role/Test'}, '30'));
});
