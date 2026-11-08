const fields = ['profile', 'account', 'region', 'stage', 'model'];

type StackSettings = {account: string; region: string; stage: string; model: string};
type DeploymentSettings = StackSettings & {profile: string};

export function validateStackSettings(settings: Record<keyof StackSettings, unknown>): asserts settings is StackSettings {
  const {account, region, stage, model} = settings;
  if (typeof account !== 'string' || !/^[0-9]{12}$/.test(account)) throw new Error('Expected a 12-digit AWS account.');
  if (typeof region !== 'string' || !/^(?:us|eu|ap|ca|sa|me|af|il|mx)-(?!gov-)[a-z]+-\d$/.test(region)) throw new Error('Expected a commercial AWS region.');
  if (typeof stage !== 'string' || !/^pilot-[a-z][a-z0-9-]{0,15}$/.test(stage) || stage.endsWith('-')) throw new Error('Stage must be pilot-<name> (up to 16 characters after pilot-).');
  if (typeof model !== 'string' || !/^[a-z][a-z0-9-]+\.[a-z0-9.-]+(?::[a-z0-9-]+)?$/.test(model) ||
      /^(?:us|eu|apac|global|jp|au)\./.test(model)) {
    throw new Error('Pass a direct regional foundation model ID, not an ARN or cross-region profile.');
  }
}

export function parseDeployment(argv: readonly string[]): DeploymentSettings {
  const options = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith('--')) throw new Error('Unexpected deployment argument.');
    const key = flag.slice(2);
    if (options.has(key)) throw new Error('Duplicate deployment argument.');
    if (key === 'allow-cost') { options.set(key, true); continue; }
    if (!fields.includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Unknown or incomplete deployment option.');
    options.set(key, argv[++i]);
  }
  if (!options.has('allow-cost')) throw new Error('Deployment can incur charges; --allow-cost is required.');
  const profile = options.get('profile');
  if (typeof profile !== 'string' || !/^[\w.-]+$/.test(profile)) throw new Error('Pass an explicit named AWS profile.');
  const settings = {account:options.get('account'), region:options.get('region'), stage:options.get('stage'), model:options.get('model')};
  validateStackSettings(settings);
  return {profile, ...settings};
}

export function assertTarget({account}: Pick<StackSettings, 'account'>, identity: {Account?: string; Arn?: string} | undefined, bootstrap: string | undefined) {
  if (identity?.Account !== account || !identity.Arn?.startsWith('arn:aws:')) {
    throw new Error('STS account or partition does not match the explicitly selected pilot.');
  }
  if (!/^\d+$/.test(bootstrap ?? '') || Number(bootstrap) < 6) {
    throw new Error('Run modern CDK bootstrap in the approved account and region first.');
  }
}
