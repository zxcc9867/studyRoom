import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync("apps/web/src/dashboardData.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const module = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const clientWith = (fetch) => createClient("https://fixture.supabase.co", "fixture-key", {
  global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
});
const observe = (promise) => Promise.race([
  promise.then(() => "success", (error) => error.name),
  new Promise((resolve) => setTimeout(() => resolve("still waiting"), 100)),
]);

test("dashboard releases a hung request even when transport ignores abort", async () => {
  const client = clientWith(() => new Promise(() => {}));
  assert.equal(await observe(module.loadDashboardData(client, "owner", { timeoutMs: 10 })), "RequestTimeoutError");
});

test("account change cancels pending dashboard work without waiting for timeout", async () => {
  const controller = new AbortController();
  const client = clientWith(() => new Promise(() => {}));
  const pending = module.loadDashboardData(client, "old-owner", { signal: controller.signal });
  controller.abort();
  assert.equal(await observe(pending), "AbortError");
});

test("timeout aborts every in-flight dashboard fetch", async () => {
  const signals = [];
  const client = clientWith((_input, init) => {
    signals.push(init.signal);
    return new Promise(() => {});
  });
  assert.equal(await observe(module.loadDashboardData(client, "owner", { timeoutMs: 10 })), "RequestTimeoutError");
  assert.equal(signals.length, 8);
  assert.ok(signals.every((signal) => signal?.aborted));
});

test("retry succeeds independently after a timed-out dashboard request", async () => {
  let stalled = true;
  const client = clientWith(() => stalled ? new Promise(() => {}) : Promise.resolve(Response.json([])));
  assert.equal(await observe(module.loadDashboardData(client, "owner", { timeoutMs: 10 })), "RequestTimeoutError");
  stalled = false;
  const data = await module.loadDashboardData(client, "owner", { timeoutMs: 1000 });
  assert.deepEqual(data.recoveryData, []);
  assert.deepEqual(data.sessionData, []);
});
