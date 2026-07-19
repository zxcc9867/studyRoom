import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  buildComparableWeeklyStudyReview,
  getComparableStudyWeekRanges,
} from "../src/weeklyReview.mjs";

test("weekly review compares the same elapsed weekdays before Sunday", () => {
  assert.deepEqual(getComparableStudyWeekRanges("2026-07-15"), {
    currentRange: { startDate: "2026-07-13", endDate: "2026-07-15", coveredDayCount: 3 },
    previousRange: { startDate: "2026-07-06", endDate: "2026-07-08", coveredDayCount: 3 },
  });

  const review = buildComparableWeeklyStudyReview({
    todayDateKey: "2026-07-15",
    sessions: [
      { id: "current", local_date: "2026-07-15", status: "completed", duration_seconds: 60 },
      { id: "future", local_date: "2026-07-18", status: "completed", duration_seconds: 9999 },
      { id: "previous-same-day", local_date: "2026-07-08", status: "completed", duration_seconds: 30 },
      { id: "previous-later-day", local_date: "2026-07-10", status: "completed", duration_seconds: 9999 },
    ],
    attendanceDays: [
      { local_date: "2026-07-13", status: "present" },
      { local_date: "2026-07-14", status: "present" },
      { local_date: "2026-07-15", status: "present" },
    ],
  });

  assert.equal(review.current.studySeconds, 60);
  assert.equal(review.previous.studySeconds, 30);
  assert.equal(review.current.presentDays, 3);
  assert.equal(review.current.coveredDayCount, 3);
});

test("weekly review uses canonical server study summaries and exposes quality counts", () => {
  const review = buildComparableWeeklyStudyReview({
    todayDateKey: "2026-07-19",
    currentStudySummary: {
      completedSeconds: 7235,
      completedSessionCount: 3,
      anomalySessionCount: 0,
      crossDateSessionCount: 1,
    },
    previousStudySummary: {
      completedSeconds: 116881,
      completedSessionCount: 8,
      anomalySessionCount: 1,
      crossDateSessionCount: 2,
    },
  });

  assert.equal(review.current.studySeconds, 7235);
  assert.equal(review.previous.studySeconds, 116881);
  assert.equal(review.previous.anomalySessionCount, 1);
  assert.equal(review.current.crossDateSessionCount, 1);
});

test("security and period summary migration enforces least privilege", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20260719045940_secure_rpc_and_study_period_summary.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /create or replace function public\.get_study_period_summary/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /status = 'completed'/i);
  assert.match(sql, /least\(1, period_sessions\.counted_seconds \/ period_sessions\.elapsed_seconds\)/i);
  assert.match(sql, /revoke all on function public\.mark_missed_attendance\(timestamptz\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.get_study_period_summary\(date, date\) to authenticated/i);
});

test("web and mobile wire the audited reliability improvements", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const mobile = readFileSync(new URL("../../mobile/App.tsx", import.meta.url), "utf8");
  const dataService = readFileSync(new URL("../src/dashboardData.ts", import.meta.url), "utf8");
  const dialog = readFileSync(new URL("../src/AccessibleDialog.tsx", import.meta.url), "utf8");

  assert.match(main, /fetchStudyPeriodSummary/);
  assert.match(main, /loadDashboardData/);
  assert.ok((main.match(/<AccessibleDialog/g) ?? []).length >= 8);
  assert.match(dataService, /fetchAllPages/);
  assert.match(dataService, /assertQuerySucceeded/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /previouslyFocused\?\.focus\(\)/);

  assert.match(mobile, /rpc\("complete_study_session"/);
  assert.match(mobile, /rpc\("extend_study_session_lease"/);
  assert.match(mobile, /rpc\("get_study_period_summary"/);
  assert.match(mobile, /\.eq\("local_date", localDate\)/);
  assert.match(mobile, /visible=\{reflectionOpen\}/);
  assert.doesNotMatch(mobile, /rpc\("end_study_session"/);
});
