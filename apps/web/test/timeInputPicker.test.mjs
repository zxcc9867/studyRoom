import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { isTimeInputPickerKey, openTimeInputPicker } from "../src/timeInputPicker.mjs";

test("opens the native time picker from the full enabled input surface", () => {
  const calls = [];
  const input = {
    disabled: false,
    focus(options) { calls.push(["focus", options]); },
    showPicker() { calls.push(["showPicker"]); },
  };

  assert.equal(openTimeInputPicker(input), true);
  assert.deepEqual(calls, [["focus", { preventScroll: true }], ["showPicker"]]);
});

test("keeps focus fallback when showPicker is unavailable or blocked", () => {
  let focusCount = 0;
  const fallbackInput = { focus() { focusCount += 1; } };
  const blockedInput = {
    focus() { focusCount += 1; },
    showPicker() { throw new Error("not allowed"); },
  };

  assert.equal(openTimeInputPicker(fallbackInput), false);
  assert.equal(openTimeInputPicker(blockedInput), false);
  assert.equal(openTimeInputPicker({ disabled: true, focus() { focusCount += 1; } }), false);
  assert.equal(focusCount, 2);
});

test("recognizes keyboard actions that should open a time picker", () => {
  assert.equal(isTimeInputPickerKey("Enter"), true);
  assert.equal(isTimeInputPickerKey(" "), true);
  assert.equal(isTimeInputPickerKey("Tab"), false);
});

test("todo start and end fields open from click, double click, and keyboard", () => {
  const appSource = readFileSync("apps/web/src/main.tsx", "utf8");
  const styleSource = readFileSync("apps/web/src/styles.css", "utf8");
  const start = appSource.indexOf('className="todo-time-details"');
  const end = appSource.indexOf('</div>', start);
  const timeFields = appSource.slice(start, end);

  assert.equal((timeFields.match(/onClick=\{\(event\) => openTimeInputPicker\(event\.currentTarget\)\}/g) ?? []).length, 2);
  assert.equal((timeFields.match(/onDoubleClick=\{\(event\) => openTimeInputPicker\(event\.currentTarget\)\}/g) ?? []).length, 2);
  assert.equal((timeFields.match(/isTimeInputPickerKey\(event\.key\)/g) ?? []).length, 2);
  assert.match(timeFields, /aria-label="시작 시간 선택"/);
  assert.match(timeFields, /aria-label="종료 시간 선택"/);
  assert.match(styleSource, /\.todo-time-details input\[type="time"\][\s\S]*cursor: pointer/);
});
