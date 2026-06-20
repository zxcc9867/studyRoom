import assert from "node:assert/strict";
import { test } from "node:test";

import { getDashboardSectionFromHash } from "../src/dashboardRoute.mjs";

test("maps dashboard hash routes to page sections", () => {
  assert.equal(getDashboardSectionFromHash("#today"), "today");
  assert.equal(getDashboardSectionFromHash("#goals"), "goals");
  assert.equal(getDashboardSectionFromHash("#me"), "me");
  assert.equal(getDashboardSectionFromHash("#settings"), "settings");
});

test("falls back to today for empty or unknown hashes", () => {
  assert.equal(getDashboardSectionFromHash(""), "today");
  assert.equal(getDashboardSectionFromHash("#unknown"), "today");
  assert.equal(getDashboardSectionFromHash("me"), "today");
});
