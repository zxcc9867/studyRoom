import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_TODAY_SECTION_ORDER,
  normalizeTodaySectionOrder,
  normalizeTodayTaskView,
} from "../src/dashboardLayout.mjs";

test("normalizes today task view preferences", () => {
  assert.equal(normalizeTodayTaskView("planner"), "planner");
  assert.equal(normalizeTodayTaskView("checklist"), "checklist");
  assert.equal(normalizeTodayTaskView("unknown"), "checklist");
  assert.equal(normalizeTodayTaskView(null), "checklist");
});

test("normalizes dashboard section order and appends missing defaults", () => {
  assert.deepEqual(normalizeTodaySectionOrder(["tasks", "topbar"]), [
    "tasks",
    "topbar",
    "attendance",
    "focus",
  ]);
});

test("drops unknown and duplicate dashboard sections", () => {
  assert.deepEqual(normalizeTodaySectionOrder(["tasks", "unknown", "tasks", "focus"]), [
    "tasks",
    "focus",
    "topbar",
    "attendance",
  ]);
});

test("falls back to the default dashboard section order", () => {
  assert.deepEqual(normalizeTodaySectionOrder(null), DEFAULT_TODAY_SECTION_ORDER);
  assert.deepEqual(normalizeTodaySectionOrder("bad"), DEFAULT_TODAY_SECTION_ORDER);
});
