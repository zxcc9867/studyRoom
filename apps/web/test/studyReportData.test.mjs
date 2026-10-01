import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

const reports = await import("../src/studyReportData.mjs").catch(() => ({}));
const ranges = {
  currentRange: { startDate: "2024-02-01", endDate: "2024-02-29", coveredDayCount: 29 },
  previousRange: { startDate: "2024-01-01", endDate: "2024-01-31", coveredDayCount: 31 },
};
const summary = { completed_seconds: 3600, completed_session_count: 1, anomaly_session_count: 0, cross_date_session_count: 1 };

function fixture({ badSummary = false, failTable = null, periods = ranges, attendanceRows = null } = {}) {
  const rows = {
    attendance_days: [{ user_id: "owner", local_date: "2024-02-15", status: "present" }, { user_id: "other", local_date: "2024-02-15", status: "present" }, ...Array.from({ length: 400 }, (_, i) => ({ user_id: "owner", local_date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10), status: "present" }))],
    study_todos: Array.from({ length: 501 }, (_, i) => ({ id: `todo-${String(i).padStart(3, "0")}`, title: "공부", user_id: "owner", local_date: "2024-02-15", is_completed: true })).concat({ id: "planned", title: "다음 행동", user_id: "owner", local_date: "2026-09-10", is_completed: false }),
    study_sessions: [{ id: "session", user_id: "owner", local_date: "2024-02-15", status: "completed", duration_seconds: 3600 }],
    study_session_reflections: [{ id: "reflection", user_id: "owner", session_id: "session", focus_score: 4, energy_score: 3, interruption_reason: "none", next_action: "다음 행동", created_at: "2024-02-15T09:00:00Z" }, { id: "leak", user_id: "other", session_id: "session", focus_score: 1 }],
  };
  const calls = [];
  if (attendanceRows) rows.attendance_days = attendanceRows;
  const fetch = async (input, init = {}) => {
    const url = new URL(input); calls.push(url);
    const table = url.pathname.split("/").at(-1);
    if (table === "get_study_period_summary") {
      const body = JSON.parse(init.body);
      const range = [periods.currentRange, periods.previousRange].find(range => range.startDate === body.p_start_date);
      assert.ok(range);
      assert.equal(body.p_end_date, range.endDate);
      return Response.json(badSummary ? [] : [summary]);
    }
    if (table === failTable) return Response.json({ message: "fixture unavailable" }, { status: 400 });
    // Production attendance_days has a composite (user_id, local_date) key, not id.
    if (table === "attendance_days" && (url.searchParams.get("select").split(",").includes("id") || url.searchParams.get("order").split(",").some(order => order.startsWith("id.")))) {
      return Response.json({ code: "42703", message: "column attendance_days.id does not exist" }, { status: 400 });
    }
    let selected = (rows[table] ?? []).filter(row => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
      if (value.startsWith("gte.")) return row[key] >= value.slice(4);
      if (value.startsWith("lte.")) return row[key] <= value.slice(4);
      if (value.startsWith("in.(")) return value.slice(4, -1).split(",").map(v => v.replaceAll('"', "")).includes(row[key]);
      return true;
    }));
    selected.sort((a,b) => table === "attendance_days" ? a.local_date.localeCompare(b.local_date) : a.id.localeCompare(b.id));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? selected.length);
    return Response.json(selected.slice(offset, offset + limit));
  };
  return { calls, client: createClient("https://report-fixture.supabase.co", "fixture", { global: { fetch }, auth: { persistSession: false, autoRefreshToken: false } }) };
}

test("report loads composite-key historical attendance, all todo pages and owned reflections", async () => {
  assert.equal(typeof reports.loadStudyReportData, "function", "period-scoped report loading is missing");
  const { client, calls } = fixture();
  const data = await reports.loadStudyReportData(client, "owner", ranges);
  assert.deepEqual(data.attendanceDays.map(row => [row.local_date, row.status]), [["2024-02-15", "present"]]);
  assert.equal(data.todos.length, 501);
  assert.deepEqual(data.reflections.map(row => row.id), ["reflection"]);
  assert.deepEqual(data.plannedTodos.map(row => row.id), ["planned"]);
  assert.equal(data.currentSummary.completedSeconds, 3600);
  const tableCalls = calls.filter(url => !url.pathname.includes("/rpc/"));
  assert.ok(tableCalls.every(url => url.searchParams.get("user_id") === "eq.owner"));
  assert.ok(tableCalls.filter(url => !url.pathname.endsWith("/attendance_days")).every(url => url.searchParams.get("order")?.includes("id.")));
  const attendanceQuery = tableCalls.find(url => url.pathname.endsWith("/attendance_days"));
  assert.equal(attendanceQuery.searchParams.get("order"), "local_date.asc");
});

test("empty canonical response or failed reflection load is an error, not a zero report", async () => {
  assert.equal(typeof reports.loadStudyReportData, "function");
  await assert.rejects(reports.loadStudyReportData(fixture({ badSummary: true }).client, "owner", ranges));
  await assert.rejects(reports.loadStudyReportData(fixture({ failTable: "study_session_reflections" }).client, "owner", ranges));
});

test("composite-key attendance paging returns every owned day without duplicates or other owners", async () => {
  const periods = {
    previousRange: { startDate: "2024-01-01", endDate: "2024-12-31" },
    currentRange: { startDate: "2025-01-01", endDate: "2025-08-31" },
  };
  const attendanceRows = Array.from({ length: 601 }, (_, i) => ({
    user_id: "owner", local_date: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10), status: "present",
  })).concat({ user_id: "other", local_date: "2024-01-01", status: "missed" });
  const { client, calls } = fixture({ periods, attendanceRows });
  const data = await reports.loadStudyReportData(client, "owner", periods);
  assert.equal(data.attendanceDays.length, 601);
  assert.equal(new Set(data.attendanceDays.map(row => row.local_date)).size, 601);
  assert.ok(data.attendanceDays.every(row => row.user_id === "owner"));
  assert.equal(data.attendanceDays[0].local_date, "2024-01-01");
  assert.equal(data.attendanceDays.at(-1).local_date, "2025-08-23");
  assert.deepEqual(calls.filter(url => url.pathname.endsWith("/attendance_days")).map(url => Number(url.searchParams.get("offset"))), [0, 500]);
});

test("new requests hide stale data and cannot be overwritten by an older user's response", async () => {
  assert.equal(typeof reports.createStudyReportRequest, "function", "request identity protection is missing");
  const controller = reports.createStudyReportRequest();
  const states = []; let finishOld;
  const old = controller.run("user-a:week", () => new Promise(resolve => { finishOld = resolve; }), state => states.push(state));
  await controller.run("user-b:month", async () => ({ value: "new" }), state => states.push(state));
  finishOld({ value: "old" }); await old;
  assert.deepEqual(states.map(state => [state.key, state.status]), [["user-a:week", "loading"], ["user-b:month", "loading"], ["user-b:month", "ready"]]);
  assert.equal(states.at(-1).data.value, "new");
  assert.equal(reports.getStudyReportState(states.at(-1), "another-period").status, "loading");
});

test("failed or timed-out requests allow a successful retry; cancellation emits no stale result", async () => {
  assert.equal(typeof reports.createStudyReportRequest, "function");
  const controller = reports.createStudyReportRequest({ timeoutMs: 5 }); const states = [];
  await controller.run("month", async () => { throw new Error("failure"); }, state => states.push(state));
  assert.equal(states.at(-1).status, "error");
  await controller.run("month", () => new Promise(() => {}), state => states.push(state));
  assert.equal(states.at(-1).status, "error");
  await controller.run("month", async () => ({ count: 0 }), state => states.push(state));
  assert.equal(states.at(-1).status, "ready");
  assert.equal(states.at(-1).data.count, 0);
  const pending = controller.run("gone", () => new Promise(() => {}), state => states.push(state));
  controller.cancel(); await pending;
  assert.equal(states.at(-1).status, "loading");
});
