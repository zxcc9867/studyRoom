import assert from "node:assert/strict";
import { test } from "node:test";

const reports = await import("../src/studyReports.mjs").catch(() => ({}));
function periods(input) {
  assert.equal(typeof reports.getStudyReportPeriods, "function", "report period selection is missing");
  return reports.getStudyReportPeriods(input);
}

test("current week compares elapsed weekdays and a completed week keeps all seven days", () => {
  const current = periods({ todayDateKey: "2026-09-10", mode: "week" });
  assert.deepEqual(current.currentRange, { startDate: "2026-09-07", endDate: "2026-09-10", coveredDayCount: 4 });
  assert.deepEqual(current.previousRange, { startDate: "2026-08-31", endDate: "2026-09-03", coveredDayCount: 4 });
  assert.equal(current.isCurrentPeriod, true);
  assert.equal(current.canGoForward, false);
  const completed = periods({ todayDateKey: "2026-09-10", mode: "week", anchorDate: "2026-09-02" });
  assert.deepEqual(completed.currentRange, { startDate: "2026-08-31", endDate: "2026-09-06", coveredDayCount: 7 });
  assert.deepEqual(completed.previousRange, { startDate: "2026-08-24", endDate: "2026-08-30", coveredDayCount: 7 });
  assert.equal(completed.nextAnchor, "2026-09-07");
  assert.equal(completed.canGoForward, true);
});

test("month reports cover leap days, year rollover and unequal prior-month lengths", () => {
  const leap = periods({ todayDateKey: "2026-09-10", mode: "month", anchorDate: "2024-02-15" });
  assert.deepEqual(leap.currentRange, { startDate: "2024-02-01", endDate: "2024-02-29", coveredDayCount: 29 });
  assert.deepEqual(leap.previousRange, { startDate: "2024-01-01", endDate: "2024-01-31", coveredDayCount: 31 });
  const january = periods({ todayDateKey: "2026-01-10", mode: "month" });
  assert.deepEqual(january.previousRange, { startDate: "2025-12-01", endDate: "2025-12-10", coveredDayCount: 10 });
  const march = periods({ todayDateKey: "2026-03-30", mode: "month" });
  assert.deepEqual(march.previousRange, { startDate: "2026-02-01", endDate: "2026-02-28", coveredDayCount: 28 });
  assert.equal(march.currentRange.coveredDayCount, 30);
});

test("report period selection rejects impossible dates and future periods", () => {
  periods({ todayDateKey: "2026-09-10", mode: "week" });
  for (const anchorDate of ["2026-02-30", "2026-13-01", "not-a-date", "2026-09-11"]) {
    assert.throws(() => reports.getStudyReportPeriods({ todayDateKey: "2026-09-10", mode: "month", anchorDate }));
  }
});

test("monthly metrics use canonical midnight-split seconds and preserve reflection actions", () => {
  assert.equal(typeof reports.buildStudyReport, "function", "monthly aggregation is missing");
  const data = {
    currentSummary: { completedSeconds: 3600, completedSessionCount: 2, crossDateSessionCount: 1, anomalySessionCount: 0 },
    previousSummary: { completedSeconds: 7200, completedSessionCount: 2, crossDateSessionCount: 1, anomalySessionCount: 0 },
    sessions: [{ id: "aug", local_date: "2026-08-31", status: "completed", duration_seconds: 7200 }, { id: "sep", local_date: "2026-09-01", status: "completed", duration_seconds: 0 }],
    todos: [{ local_date: "2026-09-02", is_completed: true }, { local_date: "2026-09-03", is_completed: false }],
    attendanceDays: [{ local_date: "2026-09-01", status: "present" }],
    reflections: [{ session_id: "sep", focus_score: 4, energy_score: 3, next_action: "오답 한 문제", created_at: "2026-09-01T09:00:00Z", interruption_reason: "phone" }],
  };
  const result = reports.buildStudyReport(periods({ todayDateKey: "2026-09-10", mode: "month" }), data);
  assert.equal(result.current.studySeconds, 3600);
  assert.equal(result.current.sessionCount, 2);
  assert.equal(result.current.completionRate, 50);
  assert.equal(result.current.presentDays, 1);
  assert.equal(result.current.averageFocus, 4);
  assert.deepEqual(result.current.nextActions, ["오답 한 문제"]);
  assert.equal(result.studySecondsChange, -3600);
});
