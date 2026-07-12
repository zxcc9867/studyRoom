import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDailyPlannerSegments,
  plannerAngleToTime,
  timeToPlannerAngle,
} from "../src/dailyPlanner.mjs";

const baseTodo = {
  id: "todo-1",
  local_date: "2026-06-23",
  title: "AWS study",
  start_time: null,
  end_time: null,
  is_completed: false,
};

test("converts 24 hour times to clockwise planner angles from midnight", () => {
  assert.equal(timeToPlannerAngle("00:00"), 0);
  assert.equal(timeToPlannerAngle("06:00"), 90);
  assert.equal(timeToPlannerAngle("12:00"), 180);
  assert.equal(timeToPlannerAngle("18:00"), 270);
});

test("snaps planner click angles back to 30 minute time labels", () => {
  assert.equal(plannerAngleToTime(0), "00:00");
  assert.equal(plannerAngleToTime(90), "06:00");
  assert.equal(plannerAngleToTime(352.5), "23:30");
  assert.equal(plannerAngleToTime(361), "00:00");
});

test("builds a one hour daily planner segment from scheduled todos", () => {
  const result = buildDailyPlannerSegments(
    [
      {
        ...baseTodo,
        start_time: "09:00",
        end_time: "10:00",
      },
    ],
    "2026-06-23",
  );

  assert.equal(result.segments.length, 1);
  assert.equal(result.unscheduledTodos.length, 0);
  assert.deepEqual(
    {
      title: result.segments[0].title,
      startMinute: result.segments[0].startMinute,
      endMinute: result.segments[0].endMinute,
      durationMinutes: result.segments[0].durationMinutes,
      startAngle: result.segments[0].startAngle,
      endAngle: result.segments[0].endAngle,
      wrapsMidnight: result.segments[0].wrapsMidnight,
      overlaps: result.segments[0].overlaps,
    },
    {
      title: "AWS study",
      startMinute: 540,
      endMinute: 600,
      durationMinutes: 60,
      startAngle: 135,
      endAngle: 150,
      wrapsMidnight: false,
      overlaps: false,
    },
  );
});

test("builds overnight planner segments and separates unscheduled todos", () => {
  const result = buildDailyPlannerSegments(
    [
      {
        ...baseTodo,
        id: "overnight",
        title: "Sleep",
        start_time: "23:00",
        end_time: "01:00",
      },
      {
        ...baseTodo,
        id: "unscheduled",
        title: "Read notes",
      },
    ],
    "2026-06-23",
  );

  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].durationMinutes, 120);
  assert.equal(result.segments[0].wrapsMidnight, true);
  assert.equal(result.unscheduledTodos.length, 1);
  assert.equal(result.unscheduledTodos[0].title, "Read notes");
});

test("marks overlapping planner segments", () => {
  const result = buildDailyPlannerSegments(
    [
      {
        ...baseTodo,
        id: "first",
        start_time: "09:00",
        end_time: "10:00",
      },
      {
        ...baseTodo,
        id: "second",
        title: "React study",
        start_time: "09:30",
        end_time: "11:00",
      },
    ],
    "2026-06-23",
  );

  assert.equal(result.segments.length, 2);
  assert.equal(result.segments.every((segment) => segment.overlaps), true);
  assert.deepEqual(result.segments[0].overlapDetails, [
    {
      todoId: "second",
      title: "React study",
      startTime: "09:30",
      endTime: "11:00",
      overlapStartTime: "09:30",
      overlapEndTime: "10:00",
      overlapWrapsMidnight: false,
    },
  ]);
  assert.deepEqual(result.segments[1].overlapDetails, [
    {
      todoId: "first",
      title: "AWS study",
      startTime: "09:00",
      endTime: "10:00",
      overlapStartTime: "09:30",
      overlapEndTime: "10:00",
      overlapWrapsMidnight: false,
    },
  ]);
});

test("describes an overlap that continues across midnight as one readable range", () => {
  const result = buildDailyPlannerSegments(
    [
      {
        ...baseTodo,
        id: "night-reading",
        title: "Night reading",
        start_time: "23:00",
        end_time: "02:00",
      },
      {
        ...baseTodo,
        id: "late-review",
        title: "Late review",
        start_time: "22:30",
        end_time: "01:00",
      },
    ],
    "2026-06-23",
  );

  const lateReview = result.segments.find((segment) => segment.id === "late-review");
  const nightReading = result.segments.find((segment) => segment.id === "night-reading");

  assert.deepEqual(lateReview.overlapDetails, [
    {
      todoId: "night-reading",
      title: "Night reading",
      startTime: "23:00",
      endTime: "02:00",
      overlapStartTime: "23:00",
      overlapEndTime: "01:00",
      overlapWrapsMidnight: true,
    },
  ]);
  assert.deepEqual(nightReading.overlapDetails[0], {
    todoId: "late-review",
    title: "Late review",
    startTime: "22:30",
    endTime: "01:00",
    overlapStartTime: "23:00",
    overlapEndTime: "01:00",
    overlapWrapsMidnight: true,
  });
});
