import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRecurringTodoDates,
  filterNewTodoDates,
  getDefaultRepeatEndDate,
  getTodoSaveFocusDate,
} from "../src/todoRecurrence.mjs";

test("builds recurring todo dates from selected weekdays inside an inclusive range", () => {
  const dates = buildRecurringTodoDates({
    startDate: "2026-06-04",
    endDate: "2026-06-14",
    weekdays: [1, 3, 5],
  });

  assert.deepEqual(dates, ["2026-06-05", "2026-06-08", "2026-06-10", "2026-06-12"]);
});

test("returns an empty recurrence when end date is before the start date or weekdays are empty", () => {
  assert.deepEqual(
    buildRecurringTodoDates({
      startDate: "2026-06-10",
      endDate: "2026-06-09",
      weekdays: [3],
    }),
    [],
  );
  assert.deepEqual(
    buildRecurringTodoDates({
      startDate: "2026-06-10",
      endDate: "2026-06-20",
      weekdays: [],
    }),
    [],
  );
});

test("filters duplicate recurring todos by date and normalized title", () => {
  const result = filterNewTodoDates({
    dates: ["2026-06-05", "2026-06-08", "2026-06-10"],
    title: " AWS 공부 ",
    existingTodos: [
      { local_date: "2026-06-08", title: "aws 공부" },
      { local_date: "2026-06-10", title: "수학" },
    ],
  });

  assert.deepEqual(result, ["2026-06-05", "2026-06-10"]);
});

test("filters duplicate recurring todos by date, title, and optional time range", () => {
  const result = filterNewTodoDates({
    dates: ["2026-06-08", "2026-06-10"],
    title: "AWS study",
    startTime: "10:00",
    endTime: "11:00",
    existingTodos: [
      { local_date: "2026-06-08", title: "AWS study", start_time: "09:00", end_time: "10:00" },
      { local_date: "2026-06-10", title: "AWS study", start_time: "10:00", end_time: "11:00" },
    ],
  });

  assert.deepEqual(result, ["2026-06-08"]);
});

test("defaults repeat end date to the last day of the selected month", () => {
  assert.equal(getDefaultRepeatEndDate("2026-02-11"), "2026-02-28");
  assert.equal(getDefaultRepeatEndDate("2024-02-11"), "2024-02-29");
});

test("focuses the selected date after save when a todo was created there", () => {
  assert.equal(
    getTodoSaveFocusDate({
      selectedDate: "2026-06-14",
      targetDates: ["2026-06-14", "2026-06-21"],
    }),
    "2026-06-14",
  );
});

test("focuses the first created date when weekday repeat skipped the selected date", () => {
  assert.equal(
    getTodoSaveFocusDate({
      selectedDate: "2026-06-14",
      targetDates: ["2026-06-15", "2026-06-22"],
    }),
    "2026-06-15",
  );
});
