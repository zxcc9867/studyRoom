import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fetchStudyPeriodSummary,
  getMonthDateRange,
  normalizeStudyPeriodSummary,
} from "../src/studyPeriodSummary.mjs";

test("normalizes timezone-aware period summary RPC rows", () => {
  assert.deepEqual(
    normalizeStudyPeriodSummary({
      completed_seconds: "7235",
      completed_session_count: 3,
      anomaly_session_count: 1,
      cross_date_session_count: 2,
    }),
    {
      completedSeconds: 7235,
      completedSessionCount: 3,
      anomalySessionCount: 1,
      crossDateSessionCount: 2,
    },
  );
  assert.deepEqual(normalizeStudyPeriodSummary(null), {
    completedSeconds: 0,
    completedSessionCount: 0,
    anomalySessionCount: 0,
    crossDateSessionCount: 0,
  });
});

test("loads one authenticated study period summary", async () => {
  const calls = [];
  const result = await fetchStudyPeriodSummary(
    {
      async rpc(name, params) {
        calls.push({ name, params });
        return { data: [{ completed_seconds: 3600, completed_session_count: 1 }], error: null };
      },
    },
    "2026-07-13",
    "2026-07-19",
  );

  assert.deepEqual(calls, [{
    name: "get_study_period_summary",
    params: { p_start_date: "2026-07-13", p_end_date: "2026-07-19" },
  }]);
  assert.equal(result.completedSeconds, 3600);
});

test("builds exact calendar month boundaries", () => {
  assert.deepEqual(getMonthDateRange("2026-02"), { startDate: "2026-02-01", endDate: "2026-02-28" });
  assert.deepEqual(getMonthDateRange("2028-02"), { startDate: "2028-02-01", endDate: "2028-02-29" });
});
