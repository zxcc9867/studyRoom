import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  ABSENCE_WARNING_SECONDS,
  WARNING_COOLDOWN_SECONDS,
  createPresenceState,
  markPresenceWarningSent,
  updatePresenceState,
} from "../src/cameraPresence.mjs";

test("camera presence state does not warn while a face is visible", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const state = createPresenceState(start);

  const next = updatePresenceState(state, {
    faceDetected: true,
    nowMs: start + ABSENCE_WARNING_SECONDS * 1000,
  });

  assert.equal(next.absenceSeconds, 0);
  assert.equal(next.warningDue, false);
  assert.equal(next.absenceStartedAtMs, null);
});

test("camera presence state warns after 5 minutes without a face", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const state = updatePresenceState(createPresenceState(start), {
    faceDetected: false,
    nowMs: start,
  });

  const next = updatePresenceState(state, {
    faceDetected: false,
    nowMs: start + ABSENCE_WARNING_SECONDS * 1000,
  });

  assert.equal(next.absenceSeconds, ABSENCE_WARNING_SECONDS);
  assert.equal(next.warningDue, true);
});

test("camera presence state resets absence timing when a face returns", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const absent = updatePresenceState(createPresenceState(start), {
    faceDetected: false,
    nowMs: start + 120_000,
  });

  const returned = updatePresenceState(absent, {
    faceDetected: true,
    nowMs: start + 180_000,
  });

  assert.equal(returned.absenceSeconds, 0);
  assert.equal(returned.absenceStartedAtMs, null);
  assert.equal(returned.warningDue, false);
});

test("camera presence state suppresses duplicate warnings during cooldown", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const warning = updatePresenceState(
    updatePresenceState(createPresenceState(start), {
      faceDetected: false,
      nowMs: start,
    }),
    {
      faceDetected: false,
      nowMs: start + ABSENCE_WARNING_SECONDS * 1000,
    },
  );
  const sent = markPresenceWarningSent(warning, { nowMs: start + ABSENCE_WARNING_SECONDS * 1000 });

  const duringCooldown = updatePresenceState(sent, {
    faceDetected: false,
    nowMs: start + (ABSENCE_WARNING_SECONDS + WARNING_COOLDOWN_SECONDS - 1) * 1000,
  });
  const afterCooldown = updatePresenceState(sent, {
    faceDetected: false,
    nowMs: start + (ABSENCE_WARNING_SECONDS + WARNING_COOLDOWN_SECONDS) * 1000,
  });

  assert.equal(duringCooldown.warningDue, false);
  assert.equal(afterCooldown.warningDue, true);
});

test("web app wires camera monitoring to active sessions and warning Edge Function", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const warningSource = readFileSync("apps/web/src/cameraWarning.mjs", "utf8");

  assert.match(appSource, /카메라 감시 켜기/);
  assert.match(appSource, /activeSession/);
  assert.match(appSource, /createFacePresenceDetector/);
  assert.match(appSource, /sendCameraPresenceWarning\(session/);
  assert.match(warningSource, /\/functions\/v1\/camera-presence-warning/);
  assert.match(warningSource, /authorization: `Bearer \$\{session\.access_token\}`/);
});
