import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  STUDY_SESSION_ACTIVITY_HEARTBEAT_MS,
  STUDY_SESSION_INACTIVITY_GRACE_MS,
  getStudySessionActivityExcludedSeconds,
  getStudySessionActivityStorageKey,
  parseStudySessionActivityMs,
  shouldEndStudySessionForInactivity,
} from "../src/sessionActivity.mjs";

test("study session activity uses a short heartbeat and five minute close grace", () => {
  assert.equal(STUDY_SESSION_ACTIVITY_HEARTBEAT_MS, 15 * 1000);
  assert.equal(STUDY_SESSION_INACTIVITY_GRACE_MS, 5 * 60 * 1000);
});

test("uses a per-user and per-session activity storage key", () => {
  assert.equal(
    getStudySessionActivityStorageKey({ userId: "user-1", sessionId: "session-1" }),
    "study-room-session-activity:user-1:session-1",
  );
});

test("parses only finite positive activity timestamps", () => {
  assert.equal(parseStudySessionActivityMs(null), null);
  assert.equal(parseStudySessionActivityMs(""), null);
  assert.equal(parseStudySessionActivityMs("0"), null);
  assert.equal(parseStudySessionActivityMs("-1"), null);
  assert.equal(parseStudySessionActivityMs("abc"), null);
  assert.equal(parseStudySessionActivityMs("12345"), 12345);
});

test("does not end fresh or unknown active sessions as inactive", () => {
  const nowMs = Date.UTC(2026, 5, 28, 10, 0, 0);

  assert.equal(shouldEndStudySessionForInactivity({ lastActivityMs: null, nowMs }), false);
  assert.equal(
    shouldEndStudySessionForInactivity({
      lastActivityMs: nowMs - STUDY_SESSION_INACTIVITY_GRACE_MS,
      nowMs,
    }),
    false,
  );
});

test("ends an active session when browser activity has been absent beyond grace", () => {
  const nowMs = Date.UTC(2026, 5, 28, 10, 0, 0);
  const lastActivityMs = nowMs - STUDY_SESSION_INACTIVITY_GRACE_MS - 1;

  assert.equal(shouldEndStudySessionForInactivity({ lastActivityMs, nowMs }), true);
});

test("calculates inactive seconds to exclude from saved study time", () => {
  const nowMs = Date.UTC(2026, 5, 28, 10, 0, 0);
  const lastActivityMs = nowMs - 17 * 60 * 1000 - 999;

  assert.equal(getStudySessionActivityExcludedSeconds({ lastActivityMs, nowMs }), 17 * 60);
  assert.equal(getStudySessionActivityExcludedSeconds({ lastActivityMs: null, nowMs }), 0);
});

test("web dashboard wires study session activity without changing auth session persistence", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const authSessionSource = readFileSync("apps/web/src/authSession.mjs", "utf8");

  assert.match(appSource, /STUDY_SESSION_ACTIVITY_HEARTBEAT_MS/);
  assert.match(appSource, /shouldEndStudySessionForInactivity/);
  assert.match(appSource, /getStudySessionActivityExcludedSeconds/);
  assert.match(appSource, /persistStudySessionActivity\(startedSession\.id/);
  assert.match(appSource, /forgetStudySessionActivity\(activeSession\.id/);
  assert.match(appSource, /document\.addEventListener\("visibilitychange", persistVisibleActivity\)/);
  assert.match(appSource, /document\.removeEventListener\("visibilitychange", persistVisibleActivity\)/);
  assert.match(authSessionSource, /study-room-attendance-auth-session/);
});
