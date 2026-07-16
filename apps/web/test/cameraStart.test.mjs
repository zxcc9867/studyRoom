import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  isCameraStartTimeoutError,
  requestCameraStreamWithTimeout,
} from "../src/cameraStart.mjs";

test("camera stream request clears its timeout after a successful start", async () => {
  const stream = { getTracks: () => [] };
  let clearedTimer = null;

  const result = await requestCameraStreamWithTimeout(
    () => Promise.resolve(stream),
    {
      timeoutMs: 100,
      setTimer: () => 17,
      clearTimer: (timer) => {
        clearedTimer = timer;
      },
    },
  );

  assert.equal(result, stream);
  assert.equal(clearedTimer, 17);
});

test("camera stream request times out and stops a stream that arrives too late", async () => {
  let resolveRequest;
  let timeoutCallback;
  let stopped = false;
  const lateStream = {
    getTracks: () => [{ stop: () => { stopped = true; } }],
  };
  const pendingRequest = new Promise((resolve) => {
    resolveRequest = resolve;
  });

  const result = requestCameraStreamWithTimeout(
    () => pendingRequest,
    {
      timeoutMs: 100,
      setTimer: (callback) => {
        timeoutCallback = callback;
        return 21;
      },
      clearTimer: () => undefined,
    },
  );

  timeoutCallback();
  await assert.rejects(result, (error) => isCameraStartTimeoutError(error));
  resolveRequest(lateStream);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(stopped, true);
});

test("web camera start invalidates stale attempts and keeps the inactive-session button responsive", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /cameraStartAttemptRef/);
  assert.match(appSource, /requestCameraStreamWithTimeout/);
  assert.match(appSource, /isCameraStartTimeoutError/);
  assert.doesNotMatch(appSource, /disabled=\{!activeSession \|\|/);
});
