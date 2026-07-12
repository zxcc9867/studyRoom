import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("planner overlap warning identifies both schedules and the exact overlap range", () => {
  assert.match(mainSource, /selectedPlannerSegment\.overlapDetails\.map/);
  assert.match(mainSource, /\\uACB9\\uCE58\\uB294 \\uC2DC\\uAC04/);
  assert.match(mainSource, /overlapWrapsMidnight/);
  assert.match(cssSource, /\.planner-overlap-list/);
  assert.match(cssSource, /\.planner-overlap-time/);
});
