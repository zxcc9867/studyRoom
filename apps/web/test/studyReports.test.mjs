import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRangeMetrics } from "../src/weeklyReview.mjs";

test("null and invalid unentered scores do not dilute explicit ratings", () => {
  const range = { startDate: "2026-11-05", endDate: "2026-11-05", coveredDayCount: 1 };
  const sessions = ["s1", "s2", "s3"].map(id => ({ id, status: "completed", local_date: "2026-11-05" }));
  const metrics = buildRangeMetrics(range, sessions, [], [], [
    { session_id: "s1", focus_score: 4, energy_score: 2 },
    { session_id: "s2", focus_score: null, energy_score: null },
    { session_id: "s3", focus_score: "5", energy_score: 0 },
  ]);
  assert.equal(metrics.averageFocus, 4);
  assert.equal(metrics.averageEnergy, 2);
  assert.equal(buildRangeMetrics(range, sessions, [], [], [{ session_id: "s1", focus_score: NaN }]).averageFocus, null);
});

const reports = await import("../src/studyReports.mjs").catch(() => ({}));

const recapHistory = {
  nowMs: Date.parse("2026-05-31T19:15:00Z"),
  timeZone: "Asia/Tokyo",
  sessions: [
    { local_date: "2026-05-31", started_at: "2026-05-31T17:30:00Z", ended_at: "2026-05-31T19:05:00Z", duration_seconds: 3600, status: "completed" },
    { local_date: "2026-05-02", started_at: "2026-05-02T01:00:00Z", ended_at: "2026-05-02T01:30:00Z", duration_seconds: 9999, status: "completed" },
  ],
  attendanceDays: [{ local_date: "2026-05-31", status: "present" }, { local_date: "2026-05-30", status: "missed" }],
  todos: [{ local_date: "2026-05-26", is_completed: true }, { local_date: "2026-05-29", is_completed: false }],
};

test("study period recap uses the entire previous week and month after the local 04:00 crossover", () => {
  assert.deepEqual(reports.getStudyPeriodRecaps(recapHistory).map(({ mode, periodStart, range, studySeconds, presentDays, completedTodos }) =>
    [mode, periodStart, range.startDate, range.endDate, studySeconds, presentDays, completedTodos]), [
    ["week", "2026-06-01", "2026-05-25", "2026-05-31", 3600, 1, 1],
    ["month", "2026-06-01", "2026-05-01", "2026-05-31", 5400, 1, 1],
  ]);
  assert.deepEqual(reports.getStudyPeriodRecaps({ ...recapHistory, nowMs: Date.parse("2026-05-31T18:59:00Z") }), []);
});

test("study period recap skips periods independently after a recorded start or a previous display", () => {
  const input = {
    ...recapHistory,
    nowMs: Date.parse("2026-06-09T04:00:00Z"),
    sessions: [...recapHistory.sessions, { local_date: "2026-06-05", started_at: "2026-06-05T01:00:00Z", ended_at: "2026-06-05T01:20:00Z", duration_seconds: 1200, status: "completed" }],
  };
  assert.deepEqual(reports.getStudyPeriodRecaps(input).map(({ mode }) => mode), ["week"]);
  assert.deepEqual(reports.getStudyPeriodRecaps({ ...input, seen: { week: "2026-06-08" } }), []);
  assert.deepEqual(reports.getStudyPeriodRecaps({ ...recapHistory, seen: { month: "2026-06-01" } }).map(({ mode }) => mode), ["week"]);
});

test("study period recap skips empty history and ignores unfinished task records", () => {
  assert.deepEqual(reports.getStudyPeriodRecaps({
    ...recapHistory,
    sessions: [],
    attendanceDays: [{ local_date: "2026-05-31", status: "missed" }],
    todos: [{ local_date: "2026-05-31", is_completed: false }],
  }), []);
});

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
