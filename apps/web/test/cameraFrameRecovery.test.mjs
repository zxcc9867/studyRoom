import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  cameraFrameRecoveryTimeoutMs,
  createCameraFrameRecoveryState,
  updateCameraFrameRecoveryState,
} from "../src/cameraFrameRecovery.mjs";

test("camera frame recovery waits briefly before restarting a stalled video frame", () => {
  let recovery = createCameraFrameRecoveryState();

  const first = updateCameraFrameRecoveryState(recovery, {
    reason: "no-current-frame",
    nowMs: 1000,
  });
  assert.equal(first.action, "wait");
  assert.equal(first.state.loadingStartedAtMs, 1000);
  assert.equal(first.state.restartAttempts, 0);

  const beforeTimeout = updateCameraFrameRecoveryState(first.state, {
    reason: "no-video-size",
    nowMs: 1000 + cameraFrameRecoveryTimeoutMs - 1,
  });
  assert.equal(beforeTimeout.action, "wait");
  assert.equal(beforeTimeout.state.restartAttempts, 0);

  const timedOut = updateCameraFrameRecoveryState(beforeTimeout.state, {
    reason: "no-video-size",
    nowMs: 1000 + cameraFrameRecoveryTimeoutMs,
  });
  assert.equal(timedOut.action, "restart");
  assert.equal(timedOut.state.loadingStartedAtMs, 1000 + cameraFrameRecoveryTimeoutMs);
  assert.equal(timedOut.state.restartAttempts, 1);
});

test("camera frame recovery stops retrying after one automatic restart", () => {
  const afterRestart = {
    loadingStartedAtMs: 10_000,
    restartAttempts: 1,
  };

  const result = updateCameraFrameRecoveryState(afterRestart, {
    reason: "no-current-frame",
    nowMs: 10_000 + cameraFrameRecoveryTimeoutMs,
  });

  assert.equal(result.action, "fail");
  assert.equal(result.state.restartAttempts, 1);
});

test("camera frame recovery resets when a visible frame arrives", () => {
  const state = {
    loadingStartedAtMs: 10_000,
    restartAttempts: 1,
  };

  const result = updateCameraFrameRecoveryState(state, {
    reason: "visible-frame",
    nowMs: 12_000,
  });

  assert.equal(result.action, "reset");
  assert.deepEqual(result.state, createCameraFrameRecoveryState());
});

test("web app wires stalled camera frame recovery and allows stopping while starting", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /updateCameraFrameRecoveryState/);
  assert.match(appSource, /restartCameraMonitoring/);
  assert.doesNotMatch(appSource, /disabled=\{cameraStatus === "starting" \|\| !activeSession\}/);
});
