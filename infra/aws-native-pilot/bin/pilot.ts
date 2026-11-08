import { resolve } from 'node:path';
import { App } from 'aws-cdk-lib';
import { PilotStack } from '../lib/pilot-stack.js';
import { validateStackSettings } from '../scripts/guard.js';

const app = new App();
const settings = {
  account:app.node.tryGetContext('account'),
  region:app.node.tryGetContext('region'),
  stage:app.node.tryGetContext('stage'),
  model:app.node.tryGetContext('model')
};
validateStackSettings(settings);
const {account, region, stage, model} = settings;
new PilotStack(app, `StudyRoom-${stage}`, {
  env: {account, region}, stage, model, asset: resolve('.pilot-build/lambda')
});
app.synth();
