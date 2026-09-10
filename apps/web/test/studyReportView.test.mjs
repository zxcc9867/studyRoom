import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getStudyReportPeriods } from "../src/studyReports.mjs";

const require = createRequire(import.meta.url);
const module = { exports: {} };
try {
  const result = await build({ entryPoints: [new URL("../src/StudyReportSection.tsx", import.meta.url).pathname.replace(/^\/(\w:)/, "$1")], bundle: true, write: false, format: "cjs", platform: "node", packages: "external", jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent" });
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
} catch {}
const periods = getStudyReportPeriods({ todayDateKey: "2026-09-10", mode: "month", anchorDate: "2024-02-01" });
const summary = { completedSeconds: 3600, completedSessionCount: 1, anomalySessionCount: 0, crossDateSessionCount: 1 };
const data = { currentSummary: summary, previousSummary: { ...summary, completedSeconds: 7200 }, sessions: [], todos: [], attendanceDays: [], reflections: [], plannedTodos: [] };
function render(state) {
  assert.equal(typeof module.exports.StudyReportContent, "function", "report state view is missing");
  return renderToStaticMarkup(React.createElement(module.exports.StudyReportContent, { periods, todayDateKey: "2026-09-10", state, onRetry() {} }));
}

test("loading and error reports never render provisional zero or stale metric cards", () => {
  const loading = render({ key: "period", status: "loading" });
  assert.match(loading, /role="status"/);
  assert.doesNotMatch(loading, /weekly-review-metric|꾸준함 점수|0분/);
  const error = render({ key: "period", status: "error" });
  assert.match(error, /role="alert"/);
  assert.match(error, /다시 불러오기/);
  assert.doesNotMatch(error, /weekly-review-metric|꾸준함 점수|0분/);
});

test("ready monthly report names both full periods and uses canonical hours", () => {
  const html = render({ key: "period", status: "ready", data });
  assert.match(html, /2024년 2월 학습 리포트/);
  assert.match(html, /2024\.02\.01/);
  assert.match(html, /2024\.01\.31/);
  assert.match(html, /1시간 0분/);
  assert.match(html, /이전 달보다 -1시간 0분/);
  assert.match(html, /일평균/);
  assert.doesNotMatch(html, /이번 주|지난주/);
  assert.match(html, /시작한 날짜/);
});

test("a valid empty response explains the selected period has no records", () => {
  const empty = { ...data, currentSummary: { ...summary, completedSeconds: 0, completedSessionCount: 0, crossDateSessionCount: 0 } };
  const html = render({ key: "period", status: "ready", data: empty });
  assert.match(html, /이 기간에는 아직 기록이 없어요/);
  assert.match(html, /weekly-review-metric/);
});
