import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const mainSource = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const tabsSource = await readFile(new URL("../src/TodayDomainTabs.tsx", import.meta.url), "utf8");

test("today dashboard separates focus, plan, and record domains", () => {
  assert.match(tabsSource, /id: "focus"/);
  assert.match(tabsSource, /id: "plan"/);
  assert.match(tabsSource, /id: "record"/);
  assert.match(mainSource, /todayDomain === "focus"/);
  assert.match(mainSource, /todayDomain === "plan"/);
  assert.match(mainSource, /todayDomain === "record"/);
});

test("weekly habit record is rendered outside the focus header", () => {
  assert.match(mainSource, /<WeeklyHabitRhythmPanel/);
  assert.doesNotMatch(mainSource, /<section className="weekly-habit-rhythm"/);
});
