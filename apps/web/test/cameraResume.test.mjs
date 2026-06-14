import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  cameraMonitoringIntentKey,
  createCameraMonitoringIntent,
  parseCameraMonitoringIntent,
  shouldRestoreCameraMonitoring,
} from "../src/cameraResume.mjs";

test("creates a per-user camera monitoring intent for an active study session", () => {
  assert.equal(cameraMonitoringIntentKey("user-1"), "study-room-camera-monitoring-intent:user-1");
  assert.deepEqual(
    createCameraMonitoringIntent({
      userId: "user-1",
      sessionId: "session-1",
      savedAtMs: 1781448000000,
    }),
    {
      userId: "user-1",
      sessionId: "session-1",
      savedAtMs: 1781448000000,
    },
  );
});

test("parses only complete camera monitoring intent payloads", () => {
  assert.deepEqual(
    parseCameraMonitoringIntent('{"userId":"user-1","sessionId":"session-1","savedAtMs":1781448000000}'),
    {
      userId: "user-1",
      sessionId: "session-1",
      savedAtMs: 1781448000000,
    },
  );
  assert.equal(parseCameraMonitoringIntent("not-json"), null);
  assert.equal(parseCameraMonitoringIntent('{"userId":"user-1"}'), null);
});

test("restores camera monitoring only for the same recent active session", () => {
  const savedAtMs = 1781448000000;
  const intent = createCameraMonitoringIntent({
    userId: "user-1",
    sessionId: "session-1",
    savedAtMs,
  });

  assert.equal(
    shouldRestoreCameraMonitoring({
      intent,
      userId: "user-1",
      activeSessionId: "session-1",
      nowMs: savedAtMs + 30_000,
    }),
    true,
  );
  assert.equal(
    shouldRestoreCameraMonitoring({
      intent,
      userId: "user-1",
      activeSessionId: "session-2",
      nowMs: savedAtMs + 30_000,
    }),
    false,
  );
  assert.equal(
    shouldRestoreCameraMonitoring({
      intent,
      userId: "user-1",
      activeSessionId: "session-1",
      nowMs: savedAtMs + 20 * 60_000,
    }),
    false,
  );
});

test("web app stores camera monitoring intent and attempts restore for a reloaded active session", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /createCameraMonitoringIntent/);
  assert.match(appSource, /shouldRestoreCameraMonitoring/);
  assert.match(appSource, /cameraAutoRestoreAttemptedRef/);
});
