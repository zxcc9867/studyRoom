import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { getStudyReportPeriods } from "../src/studyReports.mjs";
import * as reports from "../src/studyReports.mjs";
import * as data from "../src/studyReportData.mjs";

test("report date uses the current owner's stored zone before choosing the week", async () => {
  assert.equal(typeof data.loadStudyReportProfile, "function");
  assert.equal(typeof reports.getStudyReportTodayDate, "function");
  const requests = [];
  const client = createClient("https://report-test.invalid", "public-fixture-key", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input)); requests.push(url);
    return new Response(JSON.stringify({ time_zone: "America/Los_Angeles" }), { headers: { "Content-Type": "application/json" } });
  } } });
  const profile = await data.loadStudyReportProfile(client, "current-owner");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get("user_id"), "eq.current-owner");
  const todayDateKey = reports.getStudyReportTodayDate(Date.parse("2026-09-07T04:00:00Z"), profile.timeZone);
  assert.equal(todayDateKey, "2026-09-06");
  assert.equal(getStudyReportPeriods({ todayDateKey }).currentRange.startDate, "2026-08-31");
  assert.equal(reports.getStudyReportTodayDate(Date.parse("2026-09-07T04:00:00Z"), "Asia/Tokyo"), "2026-09-07");
});

test("missing profile zone follows RPC UTC default; failed or invalid profile never invents a browser zone", async () => {
  assert.equal(typeof data.loadStudyReportProfile, "function");
  const client = response => createClient("https://report-test.invalid", "public-fixture-key", { auth: { persistSession: false }, global: { fetch: async () => response } });
  const json = value => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  assert.deepEqual(await data.loadStudyReportProfile(client(json(null)), "owner"), { timeZone: "UTC" });
  await assert.rejects(() => data.loadStudyReportProfile(client(json({ time_zone: "Invalid/Zone" })), "owner"));
  await assert.rejects(() => data.loadStudyReportProfile(client(new Response("failed", { status: 503 })), "owner"));
});

test("failed request aborts its remaining sibling queries", async () => {
  const runner = data.createStudyReportRequest();
  let siblingSignal;
  await runner.run("period", signal => { siblingSignal = signal; return Promise.all([Promise.reject(new Error("failed")), new Promise(() => {})]); }, () => {});
  assert.equal(siblingSignal.aborted, true);
});
