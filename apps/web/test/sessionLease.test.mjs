import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SESSION_LEASE_DURATION_MS,
  SESSION_LEASE_DURATION_SECONDS,
  createSessionLeaseDeadlineMs,
  getLeaseAwareActiveNowMs,
  getSessionLeaseExcludedSeconds,
  getSessionLeaseRemainingSeconds,
  getSessionLeaseStorageKey,
  getStoredSessionLeaseDeadlineMs,
  isSessionLeaseExpired,
  parseSessionLeaseDeadlineMs,
} from "../src/sessionLease.mjs";

test("session lease uses a one hour duration", () => {
  assert.equal(SESSION_LEASE_DURATION_SECONDS, 60 * 60);
  assert.equal(SESSION_LEASE_DURATION_MS, 60 * 60 * 1000);
});

test("creates and extends a session lease deadline from the current time", () => {
  const nowMs = Date.UTC(2026, 5, 17, 20, 30, 0);

  assert.equal(createSessionLeaseDeadlineMs(nowMs), nowMs + SESSION_LEASE_DURATION_MS);
  assert.equal(createSessionLeaseDeadlineMs(nowMs + 30 * 60 * 1000), nowMs + 30 * 60 * 1000 + SESSION_LEASE_DURATION_MS);
});

test("falls back to started_at plus one hour when no valid stored deadline exists", () => {
  const startedAtMs = Date.UTC(2026, 5, 17, 20, 30, 0);

  assert.equal(getStoredSessionLeaseDeadlineMs({ rawValue: null, startedAtMs }), startedAtMs + SESSION_LEASE_DURATION_MS);
  assert.equal(getStoredSessionLeaseDeadlineMs({ rawValue: "not-a-number", startedAtMs }), startedAtMs + SESSION_LEASE_DURATION_MS);
  assert.equal(getStoredSessionLeaseDeadlineMs({ rawValue: String(startedAtMs - 1), startedAtMs }), startedAtMs + SESSION_LEASE_DURATION_MS);
  assert.equal(getStoredSessionLeaseDeadlineMs({ rawValue: String(startedAtMs + 90_000), startedAtMs }), startedAtMs + 90_000);
});

test("calculates remaining and expired lease state", () => {
  const deadlineMs = Date.UTC(2026, 5, 17, 22, 30, 0);

  assert.equal(getSessionLeaseRemainingSeconds({ deadlineMs, nowMs: deadlineMs - 90_001 }), 91);
  assert.equal(getSessionLeaseRemainingSeconds({ deadlineMs, nowMs: deadlineMs - 90_000 }), 90);
  assert.equal(getSessionLeaseRemainingSeconds({ deadlineMs, nowMs: deadlineMs }), 0);
  assert.equal(isSessionLeaseExpired({ deadlineMs, nowMs: deadlineMs - 1 }), false);
  assert.equal(isSessionLeaseExpired({ deadlineMs, nowMs: deadlineMs }), true);
});

test("caps active display time and excludes only time after the lease deadline", () => {
  const startedAtMs = Date.UTC(2026, 5, 17, 20, 30, 0);
  const deadlineMs = startedAtMs + SESSION_LEASE_DURATION_MS;
  const nowMs = deadlineMs + 15 * 60 * 1000;

  assert.equal(getLeaseAwareActiveNowMs({ deadlineMs, nowMs }), deadlineMs);
  assert.equal(
    getSessionLeaseExcludedSeconds({
      deadlineMs,
      nowMs,
      baseExcludedSeconds: 120,
    }),
    15 * 60 + 120,
  );
});

test("uses a per-user and per-session storage key", () => {
  assert.equal(
    getSessionLeaseStorageKey({ userId: "user-1", sessionId: "session-1" }),
    "study-room-session-lease:user-1:session-1",
  );
});

test("web dashboard wires session lease UI and avoids adding stale active sessions to today's study time", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");

  assert.match(appSource, /sessionLeaseRemainingSeconds/);
  assert.match(appSource, /extendSessionLease/);
  assert.match(appSource, /lease_expires_at/);
  assert.match(appSource, /extend_study_session_lease/);
  assert.match(appSource, /session-lease/);
  assert.match(appSource, /activeSession\?\.local_date === todayDateKey/);
});

test("parses only finite positive lease deadlines", () => {
  assert.equal(parseSessionLeaseDeadlineMs(null), null);
  assert.equal(parseSessionLeaseDeadlineMs(""), null);
  assert.equal(parseSessionLeaseDeadlineMs("0"), null);
  assert.equal(parseSessionLeaseDeadlineMs("-1"), null);
  assert.equal(parseSessionLeaseDeadlineMs("12345"), 12345);
});
