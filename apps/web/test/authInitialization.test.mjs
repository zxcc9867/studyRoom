import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AUTH_INITIALIZATION_TIMEOUT_MS,
  isAuthInitializationTimeoutError,
  runAuthInitializationWithTimeout,
} from "../src/authInitialization.mjs";

test("auth initialization returns the stored-session result and clears its deadline", async () => {
  let scheduledCallback = null;
  let clearedTimer = null;
  const timer = { id: "auth-init" };

  const result = await runAuthInitializationWithTimeout(
    async () => ({ data: { session: { user: { id: "user-1" } } }, error: null }),
    {
      timeoutMs: AUTH_INITIALIZATION_TIMEOUT_MS,
      setTimer(callback) {
        scheduledCallback = callback;
        return timer;
      },
      clearTimer(value) {
        clearedTimer = value;
      },
    },
  );

  assert.equal(result.data.session.user.id, "user-1");
  assert.equal(typeof scheduledCallback, "function");
  assert.equal(clearedTimer, timer);
});

test("auth initialization rejects with a recognizable timeout and clears its deadline", async () => {
  let scheduledCallback = null;
  let clearedTimer = null;
  const timer = { id: "auth-timeout" };
  const pending = runAuthInitializationWithTimeout(() => new Promise(() => {}), {
    timeoutMs: 12_000,
    setTimer(callback) {
      scheduledCallback = callback;
      return timer;
    },
    clearTimer(value) {
      clearedTimer = value;
    },
  });

  scheduledCallback();

  await assert.rejects(pending, (error) => {
    assert.equal(isAuthInitializationTimeoutError(error), true);
    assert.match(error.message, /12초/);
    return true;
  });
  assert.equal(clearedTimer, timer);
});

test("web app leaves infinite loading with a retryable auth recovery notice", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(main, /runAuthInitializationWithTimeout/);
  assert.match(main, /authInitializationError/);
  assert.match(main, /role="alert"/);
  assert.match(main, /로그인 상태 다시 확인/);
  assert.match(main, /void initializeSession\(\)/);
  assert.match(styles, /\.auth-recovery-notice/);
});
