import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getActiveStudySecondsForDate,
  getActiveStudySecondsForMonth,
  getActiveStudySecondsInWindow,
} from "../src/studyTimeSummary.mjs";
import * as studyTimeSummary from "../src/studyTimeSummary.mjs";

function withDeviceTimeZone(timeZone, run) {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try { return run(); } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

test("uses the profile date when the device is UTC at Tokyo's next-day boundary", () => {
  withDeviceTimeZone("UTC", () => {
    assert.equal(getActiveStudySecondsForDate({
      startedAtMs: Date.parse("2026-09-30T16:54:16Z"),
      nowMs: Date.parse("2026-09-30T16:56:18Z"),
      dateKey: "2026-10-01",
      timeZone: "Asia/Tokyo",
    }), 122);
  });
});

test("splits profile months at Tokyo midnight instead of the device's month boundary", () => {
  withDeviceTimeZone("UTC", () => {
    const input = {
      startedAtMs: Date.parse("2026-09-30T14:50:00Z"),
      nowMs: Date.parse("2026-09-30T15:10:00Z"),
      timeZone: "Asia/Tokyo",
    };
    assert.equal(getActiveStudySecondsForMonth({ ...input, monthKey: "2026-09" }), 600);
    assert.equal(getActiveStudySecondsForMonth({ ...input, monthKey: "2026-10" }), 600);
  });
});

test("keeps profile study totals identical on devices in different time zones", () => {
  for (const deviceTimeZone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
    withDeviceTimeZone(deviceTimeZone, () => {
      const input = {
        startedAtMs: Date.parse("2026-09-30T15:00:00Z"),
        nowMs: Date.parse("2026-09-30T15:10:00Z"),
        timeZone: "Asia/Seoul",
        excludedSeconds: 90,
      };
      assert.equal(getActiveStudySecondsForDate({ ...input, dateKey: "2026-10-01" }), 510);
      assert.equal(getActiveStudySecondsForMonth({ ...input, monthKey: "2026-10" }), 510);
    });
  }
});

test("uses both real midnight boundaries on a 23-hour daylight-saving day", () => {
  withDeviceTimeZone("UTC", () => {
    assert.equal(getActiveStudySecondsForDate({
      startedAtMs: Date.parse("2026-03-08T05:00:00Z"),
      nowMs: Date.parse("2026-03-09T04:30:00Z"),
      dateKey: "2026-03-08",
      timeZone: "America/New_York",
    }), 23 * 3600);
  });
});

test("includes the repeated hour on a 25-hour daylight-saving day", () => {
  withDeviceTimeZone("UTC", () => {
    assert.equal(getActiveStudySecondsForDate({
      startedAtMs: Date.parse("2026-11-01T04:00:00Z"),
      nowMs: Date.parse("2026-11-02T05:00:00Z"),
      dateKey: "2026-11-01",
      timeZone: "America/New_York",
    }), 25 * 3600);
  });
});

test("supports profile time zones with non-hour offsets", () => {
  withDeviceTimeZone("UTC", () => {
    assert.equal(getActiveStudySecondsForDate({
      startedAtMs: Date.parse("2026-09-30T18:00:00Z"),
      nowMs: Date.parse("2026-09-30T18:30:00Z"),
      dateKey: "2026-10-01",
      timeZone: "Asia/Kathmandu",
    }), 900);
  });
});

test("selects the current study month in the profile time zone", () => {
  withDeviceTimeZone("UTC", () => {
    const now = new Date("2026-09-30T16:54:16Z");
    assert.equal(studyTimeSummary.getStudyMonthKey(now, "Asia/Tokyo"), "2026-10");
    assert.equal(studyTimeSummary.getStudyMonthKey(now, "America/Los_Angeles"), "2026-09");
  });
});

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
