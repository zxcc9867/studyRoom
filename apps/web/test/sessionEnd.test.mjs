import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isStaleActiveSessionEndError } from "../src/sessionEnd.mjs";

test("detects stale active-session end errors", () => {
  assert.equal(isStaleActiveSessionEndError({ message: "Active study session not found" }), true);
  assert.equal(isStaleActiveSessionEndError({ message: "active study session not found" }), true);
  assert.equal(isStaleActiveSessionEndError({ message: "Network request failed" }), false);
  assert.equal(isStaleActiveSessionEndError(null), false);
});

test("web dashboard refreshes stale active session after end RPC not found", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const start = appSource.indexOf("async function endTimer");
  const end = appSource.indexOf("function cleanupCameraResources");
  const endTimerSource = appSource.slice(start, end);

  assert.match(appSource, /endSessionInFlightRef/);
  assert.match(endTimerSource, /const endingSession = activeSession/);
  assert.match(endTimerSource, /isStaleActiveSessionEndError\(error\)/);
  assert.match(endTimerSource, /forgetSessionLease\(endingSession\.id\)/);
  assert.match(endTimerSource, /forgetStudySessionActivity\(endingSession\.id\)/);
  assert.match(endTimerSource, /await loadDashboard\(session\.user\.id\)/);
});
