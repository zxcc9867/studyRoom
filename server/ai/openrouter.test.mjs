import assert from 'node:assert/strict';
import test from 'node:test';
import { createOpenRouterClient, getOpenRouterConfig, OpenRouterError } from './openrouter.mjs';

const env = { OPENROUTER_API_KEY: 'test-secret-do-not-log', OPENROUTER_MODEL: 'test/model:free' };
const messages = [{ role: 'user', content: 'private study prompt' }];
const completion = { id: 'gen-test', model: 'test/model:free', choices: [{ message: { content: 'Study plan' } }], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8, other: 'private' } };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const client = (fetchImpl, settings = env) => createOpenRouterClient({ env: settings, fetchImpl });
const hasCode = (code) => (error) => {
  assert.ok(error instanceof OpenRouterError);
  assert.equal(error.code, code);
  assert.doesNotMatch(`${error.stack} ${JSON.stringify(error)}`, /test-secret-do-not-log|private study prompt|sensitive upstream/);
  assert.equal(error.cause, undefined);
  return true;
};

test('configuration defaults and optional missing credentials disable calls', async () => {
  assert.equal(getOpenRouterConfig(env).maxTokens, 1024);
  assert.equal(getOpenRouterConfig(env).timeoutMs, 20000);
  for (const settings of [{}, { OPENROUTER_MODEL: 'test/model' }, { OPENROUTER_API_KEY: 'test' }]) {
    assert.equal(getOpenRouterConfig(settings).enabled, false);
    await assert.rejects(client(() => assert.fail('must not fetch'), settings).generateText({ messages }), hasCode('disabled'));
  }
});

test('configuration rejects malformed or out-of-range limits and unsafe headers', () => {
  for (const value of ['-1', '0', '8193', '1.5', '12oops', '1e3', 'Infinity']) {
    assert.throws(() => getOpenRouterConfig({ ...env, OPENROUTER_MAX_TOKENS: value }), hasCode('configuration'));
  }
  for (const value of ['999', '55001', '2000ms', '1.5']) {
    assert.throws(() => getOpenRouterConfig({ ...env, OPENROUTER_TIMEOUT_MS: value }), hasCode('configuration'));
  }
  for (const settings of [
    { OPENROUTER_API_KEY: 'a\nb' }, { OPENROUTER_SITE_URL: 'javascript:alert(1)' },
    { OPENROUTER_SITE_URL: 'https://user:password@example.com' }, { OPENROUTER_APP_NAME: 'a\nb' },
    { OPENROUTER_MODEL: 'invalid model' },
  ]) assert.throws(() => getOpenRouterConfig({ ...env, ...settings }), hasCode('configuration'));
});

test('fixed endpoint, env model and limits, safe message fields and normalized result', async () => {
  let calls = 0;
  const result = await client(async (url, options) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization, `Bearer ${env.OPENROUTER_API_KEY}`);
    assert.equal(options.headers['HTTP-Referer'], 'https://study.example');
    assert.equal(options.headers['X-OpenRouter-Title'], 'Study Room');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { model: env.OPENROUTER_MODEL, provider: { max_price: { prompt: 0, completion: 0, request: 0 }, data_collection: 'deny' }, messages, stream: false, max_tokens: 128 });
    return json(completion);
  }, { ...env, OPENROUTER_ROUTING_MODE: 'fixed', OPENROUTER_MAX_TOKENS: '128', OPENROUTER_SITE_URL: 'https://study.example', OPENROUTER_APP_NAME: 'Study Room' })
    .generateText({ messages: [{ ...messages[0], extra: 'ignored' }], model: 'expensive/model' });
  assert.deepEqual(result, { id: 'gen-test', model: env.OPENROUTER_MODEL, text: 'Study plan', usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } });
  assert.equal(calls, 1);
});

test('message validation prevents all network calls', async () => {
  for (const invalid of [undefined, [], new Array(33).fill(messages[0]), [{ role: 'tool', content: 'x' }], [{ role: 'user', content: '' }], [{ role: 'user', content: 42 }], [{ role: 'user', content: 'x'.repeat(32001) }]]) {
    await assert.rejects(client(() => assert.fail('must not fetch')).generateText({ messages: invalid }), hasCode('invalid_input'));
  }
});

test('HTTP 429, 401 and 5xx have sanitized errors and no retries', async () => {
  for (const status of [429, 401, 500, 503]) {
    let calls = 0;
    await assert.rejects(client(async () => { calls++; return json({ error: 'sensitive upstream' }, status); }).generateText({ messages }), (error) => {
      assert.equal(error.status, status);
      return hasCode(status === 429 ? 'rate_limit' : 'upstream')(error);
    });
    assert.equal(calls, 1);
  }
});

test('200 embedded error, invalid JSON, missing fields and empty output are rejected', async () => {
  await assert.rejects(client(async () => json({ error: { message: 'sensitive upstream' } })).generateText({ messages }), hasCode('upstream'));
  for (const response of [new Response('sensitive upstream'), json({}), json({ ...completion, choices: [] }), json({ ...completion, choices: [{ message: { content: '  ' } }] })]) {
    await assert.rejects(client(async () => response).generateText({ messages }), hasCode('invalid_response'));
  }
});

test('network exceptions never retain upstream secrets or prompt', async () => {
  await assert.rejects(client(async () => { throw new Error(`${env.OPENROUTER_API_KEY} ${messages[0].content}`); }).generateText({ messages }), hasCode('network'));
});

test('pre-cancelled requests never fetch and active requests abort transport', async () => {
  const already = AbortSignal.abort('sensitive upstream');
  await assert.rejects(client(() => assert.fail('must not fetch')).generateText({ messages, signal: already }), hasCode('cancelled'));
  const controller = new AbortController();
  let transportSignal;
  const pending = client((_url, { signal }) => { transportSignal = signal; return new Promise(() => {}); }).generateText({ messages, signal: controller.signal });
  controller.abort('sensitive upstream');
  await assert.rejects(pending, hasCode('cancelled'));
  assert.equal(transportSignal.aborted, true);
});

test('timeout aborts transport even when a fetch implementation does not settle', async () => {
  let transportSignal;
  await assert.rejects(client((_url, { signal }) => { transportSignal = signal; return new Promise(() => {}); }, { ...env, OPENROUTER_TIMEOUT_MS: '1000' }).generateText({ messages }), hasCode('timeout'));
  assert.equal(transportSignal.aborted, true);
});

test('response body is bounded and a stalled response body can be cancelled', async () => {
  await assert.rejects(client(async () => new Response('x'.repeat(1024 * 1024 + 1))).generateText({ messages }), hasCode('invalid_response'));
  const controller = new AbortController();
  const body = new ReadableStream({ start() {} });
  const pending = client(async () => new Response(body)).generateText({ messages, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, hasCode('cancelled'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(body.locked, false);
});

test('browser runtime cannot import the server module', async () => {
  globalThis.window = {};
  try {
    await assert.rejects(import('./openrouter.mjs?browser-guard'), /only available on the server/);
  } finally { delete globalThis.window; }
});


test('free-only routing overrides legacy paid settings and caller overrides', async () => {
  for (const model of ['openrouter/auto', 'paid/model', 'test/model:free', 'openrouter/free']) {
    const result = await client(async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.model, model.endsWith(':free') || model === 'openrouter/free' ? model : 'openrouter/free');
      assert.deepEqual(body.provider, { max_price: { prompt: 0, completion: 0, request: 0 }, data_collection: 'deny' });
      assert.equal(body.plugins, undefined);
      assert.equal(body.models, undefined);
      return json({ ...completion, model: 'actual/free-model' });
    }, { ...env, OPENROUTER_MODEL: model, OPENROUTER_ROUTING_MODE: 'auto', OPENROUTER_AUTO_COST_TIER: 'max' })
      .generateText({ messages, model: 'paid/override', provider: { max_price: { prompt: 10 } } });
    assert.equal(result.model, 'actual/free-model');
  }
});

test('free model suffix tricks never pass as a configured free variant', () => {
  for (const model of ['paid/model:free:online', 'paid/model:free?x=1', 'paid/model:free/other']) {
    assert.equal(getOpenRouterConfig({ ...env, OPENROUTER_MODEL: model }).model, 'openrouter/free');
  }
});
