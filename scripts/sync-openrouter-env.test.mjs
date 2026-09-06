import assert from "node:assert/strict";
import { test } from "node:test";
import { syncOpenRouterEnvironment } from "./sync-openrouter-env.mjs";

const env = { OPENROUTER_API_KEY: "test-secret-never-print", OPENROUTER_MODEL: "provider/model", VERCEL_TOKEN: "vercel-test-token", VERCEL_PROJECT_ID: "project", VERCEL_ORG_ID: "team" };
test("missing optional AI setup skips writes and incomplete setup fails before writing", () => {
  const noRun = () => assert.fail("unexpected external mutation");
  assert.deepEqual(syncOpenRouterEnvironment({}, noRun), { skipped: true, count: 0 });
  assert.throws(() => syncOpenRouterEnvironment({ OPENROUTER_API_KEY: "secret" }, noRun), /both/);
  assert.throws(() => syncOpenRouterEnvironment({ ...env, OPENROUTER_TIMEOUT_MS: "bad" }, noRun));
});
test("API key goes to stdin as sensitive production env, never an argument", () => {
  const calls = [];
  const result = syncOpenRouterEnvironment(env, (...args) => { calls.push(args); return { status: 0 }; });
  assert.equal(result.count, 6);
  const [, args, options] = calls[0];
  assert.ok(args.includes("--sensitive"));
  assert.ok(args.includes("production"));
  assert.ok(!args.includes(env.OPENROUTER_API_KEY));
  assert.equal(options.input, env.OPENROUTER_API_KEY);
  assert.equal(calls[1][2].input, env.OPENROUTER_MODEL);
});
test("failed sync stops immediately and never exposes upstream output", () => {
  let calls = 0;
  assert.throws(() => syncOpenRouterEnvironment(env, () => {
    calls += 1;
    return { status: 1, stdout: env.OPENROUTER_API_KEY, stderr: env.VERCEL_TOKEN };
  }), (error) => !error.message.includes(env.OPENROUTER_API_KEY) && !error.message.includes(env.VERCEL_TOKEN));
  assert.equal(calls, 1);
});
