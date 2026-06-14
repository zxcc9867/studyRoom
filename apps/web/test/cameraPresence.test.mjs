import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  ABSENCE_PAUSE_SECONDS,
  ABSENCE_WARNING_SECONDS,
  WARNING_COOLDOWN_SECONDS,
  canStartStudySessionWithCamera,
  createPresenceState,
  getActiveStudySeconds,
  getCurrentExcludedSeconds,
  markPresenceWarningSent,
  updatePresenceState,
} from "../src/cameraPresence.mjs";

test("camera presence state does not warn while upper body presence is visible", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const state = createPresenceState(start);

  const next = updatePresenceState(state, {
    presenceDetected: true,
    nowMs: start + ABSENCE_WARNING_SECONDS * 1000,
  });

  assert.equal(next.absenceSeconds, 0);
  assert.equal(next.warningDue, false);
  assert.equal(next.absenceStartedAtMs, null);
});

test("camera presence state warns after 5 minutes without upper body presence", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const state = updatePresenceState(createPresenceState(start), {
    presenceDetected: false,
    nowMs: start,
  });

  const next = updatePresenceState(state, {
    presenceDetected: false,
    nowMs: start + ABSENCE_WARNING_SECONDS * 1000,
  });

  assert.equal(next.absenceSeconds, ABSENCE_WARNING_SECONDS);
  assert.equal(next.warningDue, true);
});

test("camera presence state resets absence timing when upper body presence returns", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const absent = updatePresenceState(createPresenceState(start), {
    presenceDetected: false,
    nowMs: start + 120_000,
  });

  const returned = updatePresenceState(absent, {
    presenceDetected: true,
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
      presenceDetected: false,
      nowMs: start,
    }),
    {
      presenceDetected: false,
      nowMs: start + ABSENCE_WARNING_SECONDS * 1000,
    },
  );
  const sent = markPresenceWarningSent(warning, { nowMs: start + ABSENCE_WARNING_SECONDS * 1000 });

  const duringCooldown = updatePresenceState(sent, {
    presenceDetected: false,
    nowMs: start + (ABSENCE_WARNING_SECONDS + WARNING_COOLDOWN_SECONDS - 1) * 1000,
  });
  const afterCooldown = updatePresenceState(sent, {
    presenceDetected: false,
    nowMs: start + (ABSENCE_WARNING_SECONDS + WARNING_COOLDOWN_SECONDS) * 1000,
  });

  assert.equal(duringCooldown.warningDue, false);
  assert.equal(afterCooldown.warningDue, true);
});

test("camera absence warns after 5 minutes but keeps counting study time during the grace period", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const absent = updatePresenceState(createPresenceState(start), {
    presenceDetected: false,
    nowMs: start,
  });
  const beforePause = updatePresenceState(absent, {
    presenceDetected: false,
    nowMs: start + (ABSENCE_WARNING_SECONDS - 1) * 1000,
  });
  const paused = updatePresenceState(absent, {
    presenceDetected: false,
    nowMs: start + ABSENCE_WARNING_SECONDS * 1000,
  });

  assert.equal(beforePause.timerPaused, false);
  assert.equal(getCurrentExcludedSeconds(beforePause), 0);
  assert.equal(paused.warningDue, true);
  assert.equal(paused.timerPaused, false);
  assert.equal(paused.autoEndDue, false);
  assert.equal(getCurrentExcludedSeconds(paused), 0);
  assert.equal(
    getActiveStudySeconds({
      startedAtMs: start,
      nowMs: start + ABSENCE_WARNING_SECONDS * 1000,
      excludedSeconds: getCurrentExcludedSeconds(paused),
    }),
    ABSENCE_WARNING_SECONDS,
  );
});

test("camera absence pauses counted study time after 10 minutes and excludes only the paused interval", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const absent = updatePresenceState(createPresenceState(start), {
    presenceDetected: false,
    nowMs: start,
  });
  const paused = updatePresenceState(absent, {
    presenceDetected: false,
    nowMs: start + (ABSENCE_PAUSE_SECONDS + 60) * 1000,
  });

  assert.equal(paused.timerPaused, true);
  assert.equal(paused.autoEndDue, false);
  assert.equal(getCurrentExcludedSeconds(paused), 60);
  assert.equal(
    getActiveStudySeconds({
      startedAtMs: start,
      nowMs: start + (ABSENCE_PAUSE_SECONDS + 60) * 1000,
      excludedSeconds: getCurrentExcludedSeconds(paused),
    }),
    ABSENCE_PAUSE_SECONDS,
  );
});

test("camera absence resumes counted study time when upper body presence returns", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const absent = updatePresenceState(createPresenceState(start), {
    presenceDetected: false,
    nowMs: start,
  });
  const paused = updatePresenceState(absent, {
    presenceDetected: false,
    nowMs: start + (ABSENCE_PAUSE_SECONDS + 60) * 1000,
  });
  const returned = updatePresenceState(paused, {
    presenceDetected: true,
    nowMs: start + (ABSENCE_PAUSE_SECONDS + 60) * 1000,
  });

  assert.equal(returned.timerPaused, false);
  assert.equal(returned.autoEndDue, false);
  assert.equal(returned.excludedSeconds, 60);
  assert.equal(returned.absenceSeconds, 0);
  assert.equal(
    getActiveStudySeconds({
      startedAtMs: start,
      nowMs: start + (ABSENCE_PAUSE_SECONDS + 180) * 1000,
      excludedSeconds: getCurrentExcludedSeconds(returned),
    }),
    ABSENCE_PAUSE_SECONDS + 120,
  );
});

test("camera absence does not request automatic session end after 10 minutes", () => {
  const start = Date.UTC(2026, 5, 13, 20, 30, 0);
  const absent = updatePresenceState(createPresenceState(start), {
    presenceDetected: false,
    nowMs: start,
  });
  const paused = updatePresenceState(absent, {
    presenceDetected: false,
    nowMs: start + ABSENCE_PAUSE_SECONDS * 1000,
  });

  assert.equal(paused.timerPaused, true);
  assert.equal(paused.autoEndDue, false);
  assert.equal(getCurrentExcludedSeconds(paused), 0);
});

test("study session start is blocked when camera monitoring is required but off", () => {
  assert.deepEqual(
    canStartStudySessionWithCamera({
      activeSession: null,
      cameraEnabled: false,
      cameraRequired: true,
    }),
    {
      allowed: false,
      reason: "camera-required",
    },
  );
});

test("study session start is allowed after camera monitoring is enabled", () => {
  assert.deepEqual(
    canStartStudySessionWithCamera({
      activeSession: null,
      cameraEnabled: true,
      cameraRequired: true,
    }),
    {
      allowed: true,
      reason: "ready",
    },
  );
});

test("web app wires upper body camera monitoring to active sessions and warning Edge Function", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const warningSource = readFileSync("apps/web/src/cameraWarning.mjs", "utf8");

  assert.match(appSource, /카메라 감시 켜기/);
  assert.match(appSource, /canStartStudySessionWithCamera/);
  assert.match(appSource, /cameraSetupPrompt/);
  assert.match(appSource, /sendCameraRequiredWarning/);
  assert.doesNotMatch(appSource, /autoEndAbsenceSession/);
  assert.match(appSource, /p_excluded_seconds/);
  assert.match(appSource, /getCurrentExcludedSeconds/);
  assert.match(appSource, /camera_required_warning/);
  assert.match(appSource, /activeSession/);
  assert.match(appSource, /createUpperBodyPresenceDetector/);
  assert.match(appSource, /presenceDetected/);
  assert.match(appSource, /getCameraStreamHealth/);
  assert.match(appSource, /getCameraFrameHealth/);
  assert.match(appSource, /cameraHealthMessage/);
  assert.match(appSource, /sendCameraPresenceWarning\(session/);
  assert.match(warningSource, /\/functions\/v1\/camera-presence-warning/);
  assert.match(warningSource, /authorization: `Bearer \$\{session\.access_token\}`/);
});

test("today focus layout keeps one study timer and one camera status copy", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const sectionStart = appSource.indexOf('<section className="daily-visual"');
  const sectionEnd = appSource.indexOf('<section className="today-task-panel"', sectionStart);
  const dailyVisualSource = appSource.slice(sectionStart, sectionEnd);

  assert.ok(sectionStart > 0);
  assert.ok(sectionEnd > sectionStart);
  assert.doesNotMatch(dailyVisualSource, /formatTimerClock\(todaySeconds\)/);
  assert.doesNotMatch(dailyVisualSource, /formatTimerClock\(activeElapsedSeconds\)/);
  assert.doesNotMatch(dailyVisualSource, /session-caption/);
  assert.match(dailyVisualSource, /cameraStatus !== "watching"/);
});
