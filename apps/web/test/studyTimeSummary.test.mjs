import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getActiveStudySecondsForDate,
  getActiveStudySecondsForMonth,
  getActiveStudySecondsInWindow,
} from "../src/studyTimeSummary.mjs";

test("counts same-day active study seconds inside the requested date", () => {
  assert.equal(
    getActiveStudySecondsForDate({
      startedAtMs: new Date("2026-07-01T00:05:00").getTime(),
      nowMs: new Date("2026-07-01T00:20:00").getTime(),
      dateKey: "2026-07-01",
    }),
    15 * 60,
  );
});

test("counts only the post-midnight part of an active session for today's study timer", () => {
  assert.equal(
    getActiveStudySecondsForDate({
      startedAtMs: new Date("2026-06-30T23:50:00").getTime(),
      nowMs: new Date("2026-07-01T00:10:00").getTime(),
      dateKey: "2026-07-01",
    }),
    10 * 60,
  );
});

test("splits active study seconds by month instead of assigning all elapsed time to the start month", () => {
  const startedAtMs = new Date("2026-06-30T23:50:00").getTime();
  const nowMs = new Date("2026-07-01T00:10:00").getTime();

  assert.equal(getActiveStudySecondsForMonth({ startedAtMs, nowMs, monthKey: "2026-06" }), 10 * 60);
  assert.equal(getActiveStudySecondsForMonth({ startedAtMs, nowMs, monthKey: "2026-07" }), 10 * 60);
});

test("clamps invalid or excluded active study windows to zero", () => {
  assert.equal(
    getActiveStudySecondsInWindow({
      startedAtMs: new Date("2026-07-01T10:00:00").getTime(),
      nowMs: new Date("2026-07-01T10:05:00").getTime(),
      windowStartMs: new Date("2026-07-01T11:00:00").getTime(),
      windowEndMs: new Date("2026-07-01T12:00:00").getTime(),
    }),
    0,
  );

  assert.equal(
    getActiveStudySecondsInWindow({
      startedAtMs: new Date("2026-07-01T10:00:00").getTime(),
      nowMs: new Date("2026-07-01T10:05:00").getTime(),
      windowStartMs: new Date("2026-07-01T10:00:00").getTime(),
      windowEndMs: new Date("2026-07-01T11:00:00").getTime(),
      excludedSeconds: 10 * 60,
    }),
    0,
  );
});
