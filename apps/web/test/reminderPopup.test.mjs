import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldShowStudyReminderPopup } from "../src/reminderPopup.mjs";

const reminderTime = "20:30";
const todayDateKey = "2026-06-14";
const nowMs = new Date("2026-06-14T20:30:15+09:00").getTime();
const timeZone = "Asia/Tokyo";

test("study reminder popup is suppressed when a same-day session is already active", () => {
  assert.equal(
    shouldShowStudyReminderPopup({
      nowMs,
      reminderTime,
      todayDateKey,
      attendanceDays: [],
      activeSession: {
        local_date: todayDateKey,
        status: "active",
      },
      hasPopupRecord: false,
      timeZone,
    }),
    false,
  );
});

test("study reminder popup is shown at reminder minute when no active or final attendance exists", () => {
  assert.equal(
    shouldShowStudyReminderPopup({
      nowMs,
      reminderTime,
      todayDateKey,
      attendanceDays: [],
      activeSession: null,
      hasPopupRecord: false,
      timeZone,
    }),
    true,
  );
});

test("study reminder popup is suppressed after present or missed attendance is final", () => {
  for (const status of ["present", "missed"]) {
    assert.equal(
      shouldShowStudyReminderPopup({
        nowMs,
        reminderTime,
        todayDateKey,
        attendanceDays: [{ local_date: todayDateKey, status }],
        activeSession: null,
        hasPopupRecord: false,
        timeZone,
      }),
      false,
    );
  }
});

test("study reminder popup is suppressed outside the configured reminder minute", () => {
  assert.equal(
    shouldShowStudyReminderPopup({
      nowMs: new Date("2026-06-14T20:31:00+09:00").getTime(),
      reminderTime,
      todayDateKey,
      attendanceDays: [],
      activeSession: null,
      hasPopupRecord: false,
      timeZone,
    }),
    false,
  );
});
