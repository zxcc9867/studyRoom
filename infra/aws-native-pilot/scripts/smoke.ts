import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  AdminCreateUserCommand, AdminDeleteUserCommand, AdminInitiateAuthCommand, AdminSetUserPasswordCommand,
  type CognitoIdentityProviderClient
} from '@aws-sdk/client-cognito-identity-provider';
import { tokenSubject } from '../web/oauth.mjs';
import { subscribeToStudy } from '../web/realtime.mjs';

export interface PilotPublicConfig {
  apiUrl: string;
  cognitoDomain: string;
  clientId: string;
  appSyncHttpUrl: string;
  appSyncRealtimeUrl: string;
}

interface PilotAuthSettings {userPoolId: string; smokeClientId: string}
interface SmokeAccount {access: string; id: string; subject: string}
interface TemporaryUser {UserPoolId: string; Username: string}
interface StudySignal {kind: 'record' | 'coaching'; id: string}
interface StudySubscriptionOptions {
  httpUrl: string;
  realtimeUrl: string;
  token: string;
  subject: string;
  onEvent?: (event: StudySignal) => void;
}

// The shared browser helper already validates the signal kind and ID on receipt.
const subscribe = subscribeToStudy as (options: StudySubscriptionOptions) => {ready: Promise<void>; close(): void};

async function createUser(cognito: CognitoIdentityProviderClient, out: PilotAuthSettings, created: TemporaryUser[]): Promise<SmokeAccount> {
  const Username = 'smoke-' + randomUUID();
  const input = {UserPoolId:out.userPoolId, Username};
  await cognito.send(new AdminCreateUserCommand({...input, MessageAction:'SUPPRESS'}));
  created.push(input);
  const Password = 'Aa1!' + randomBytes(27).toString('base64url');
  await cognito.send(new AdminSetUserPasswordCommand({...input, Password, Permanent:true}));
  const {AuthenticationResult: auth} = await cognito.send(new AdminInitiateAuthCommand({
    UserPoolId:input.UserPoolId, ClientId:out.smokeClientId, AuthFlow:'ADMIN_USER_PASSWORD_AUTH',
    AuthParameters:{USERNAME:Username, PASSWORD:Password}
  }));
  if (!auth?.AccessToken || !auth.IdToken) throw new Error('Smoke Cognito login did not return both tokens.');
  const subject: unknown = tokenSubject(auth.AccessToken);
  requireCheck(typeof subject === 'string' && subject.length > 0, 'Smoke Cognito token has no subject.');
  return {access:auth.AccessToken, id:auth.IdToken, subject};
}

function requireCheck(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function api(config: PilotPublicConfig, token: string | null, path: string,
  {payload, allowed}: {payload?: Record<string, unknown>; allowed: number[]}): Promise<Record<string, unknown>> {
  const response = await fetch(config.apiUrl + path, {
    method:payload === undefined ? 'GET' : 'POST',
    headers:{...(token ? {authorization:'Bearer ' + token} : {}), ...(payload === undefined ? {} : {'content-type':'application/json'})},
    ...(payload === undefined ? {} : {body:JSON.stringify(payload)}),
    cache:'no-store', redirect:'error', signal:AbortSignal.timeout(12_000)
  });
  requireCheck(allowed.includes(response.status), `Unexpected API status ${response.status}.`);
  return response.json();
}

async function expectSubscriptionDenial(config: PilotPublicConfig, access: string, subject: string) {
  const sub = subscribe({
    httpUrl:config.appSyncHttpUrl, realtimeUrl:config.appSyncRealtimeUrl, token:access, subject
  });
  try {
    const denial = await sub.ready.then(() => undefined, error => error.code);
    requireCheck(denial === 'subscription_denied', 'Another account was not explicitly denied by the channel.');
  } finally { sub.close(); }
}

async function runChecks(config: PilotPublicConfig, a: SmokeAccount, b: SmokeAccount) {
  requireCheck(a.subject && b.subject && a.subject !== b.subject, 'Smoke accounts are not distinct.');
  await api(config, null, '/records', {allowed:[401,403]});
  await api(config, a.id, '/records', {allowed:[401,403]});
  const events: StudySignal[] = [];
  const observer = subscribe({
    httpUrl:config.appSyncHttpUrl, realtimeUrl:config.appSyncRealtimeUrl,
    token:a.access, subject:a.subject, onEvent:signal => { if (events.length < 50) events.push(signal); }
  });
  try {
    await observer.ready;
    await expectSubscriptionDenial(config, b.access, a.subject);
    const row = await api(config, a.access, '/records', {payload:{minutes:25}, allowed:[201]});
    requireCheck(typeof row.id === 'string' && row.minutes === 25, 'Synthetic record write failed.');
    for (let i = 0; i < 16 && !events.some(e => e.kind === 'record' && e.id === row.id); i++) await delay(500);
    requireCheck(events.some(e => e.kind === 'record' && e.id === row.id), 'No real-time record signal was received.');
    const own = await api(config, a.access, '/records/' + row.id, {allowed:[200]});
    requireCheck(own.id === row.id && own.minutes === 25, 'Record was not present after the signal.');
    await api(config, b.access, '/records/' + row.id, {allowed:[404]});
    const other = await api(config, b.access, '/records', {allowed:[200]});
    requireCheck(Array.isArray(other.records) && other.records.length === 0, 'Other account can read smoke data.');
    const job = await api(config, a.access, '/coaching', {payload:{}, allowed:[202]});
    requireCheck(typeof job.id === 'string', 'Coaching job was not created.');
    await api(config, b.access, '/coaching/' + job.id, {allowed:[404]});
    const deadline = Date.now() + 210_000;
    while (Date.now() < deadline) {
      const result = await api(config, a.access, '/coaching/' + job.id, {allowed:[200]});
      if (result.status === 'done') {
        requireCheck(typeof result.result === 'string' && result.result.trim(), 'Bedrock returned no test result.');
        return;
      }
      requireCheck(result.status === 'queued' || result.status === 'running', 'Bedrock test reached a failed or unexpected state.');
      await delay(3000);
    }
    throw new Error('Timed out waiting for the Bedrock test job.');
  } finally { observer.close(); }
}

export async function smoke(cognito: CognitoIdentityProviderClient, out: PilotAuthSettings, config: PilotPublicConfig) {
  const created: TemporaryUser[] = [];
  let failed = false;
  try {
    const a = await createUser(cognito, out, created);
    const b = await createUser(cognito, out, created);
    await runChecks(config, a, b);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    // These exact random accounts were created by this invocation; no pre-existing user is removed.
    const cleanup = await Promise.allSettled(created.map(input => cognito.send(new AdminDeleteUserCommand(input))));
    if (cleanup.some(result => result.status === 'rejected')) {
      console.error('Could not remove a temporary smoke user; inspect users with the smoke- prefix in this pilot pool.');
      if (!failed) throw new Error('Smoke user cleanup failed.');
    }
  }
}
