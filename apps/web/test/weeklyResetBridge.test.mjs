import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildWeeklyActionPlanItems } from "../src/weeklyReview.mjs";

test("weekly reflection actions match only unfinished todos after text normalization", () => {
  const items = buildWeeklyActionPlanItems({
    nextActions: ["  AWS   기출 1회  ", "오답 노트 복습", "   "],
    todos: [
      { id: "planned", title: "aws 기출 1회", local_date: "2026-07-24", is_completed: false },
      { id: "done", title: "오답 노트 복습", local_date: "2026-07-23", is_completed: true },
    ],
  });

  assert.deepEqual(items, [
    {
      action: "AWS 기출 1회",
      status: "planned",
      todoId: "planned",
      localDate: "2026-07-24",
      dateLabel: "07.24",
    },
    {
      action: "오답 노트 복습",
      status: "unplanned",
      todoId: null,
      localDate: null,
      dateLabel: null,
    },
  ]);
});

test("weekly action state preserves planned status when an existing todo date is invalid", () => {
  assert.deepEqual(
    buildWeeklyActionPlanItems({
      nextActions: ["Chapter 4"],
      todos: [{ id: "bad-date", title: " chapter 4 ", local_date: "not-a-date", is_completed: false }],
    }),
    [{
      action: "Chapter 4",
      status: "planned",
      todoId: "bad-date",
      localDate: "not-a-date",
      dateLabel: null,
    }],
  );
});

test("weekly review connects reflection actions to the existing todo create and edit modal", () => {
  const section = readFileSync(new URL("../src/WeeklyReviewSection.tsx", import.meta.url), "utf8");
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(section, /buildWeeklyActionPlanItems/);
  assert.match(section, /다음 공부로 이어가기/);
  assert.match(section, /<h4 id="weekly-action-plan-title"/);
  assert.match(section, /계획에 넣기/);
  assert.match(section, /계획 보기/);
  assert.match(section, /onPlanAction/);
  assert.match(section, /onOpenPlannedTodo/);

  assert.match(main, /function openWeeklyReviewActionPlan/);
  assert.match(main, /resetTodoDraftForDate\(todayDateKey\)/);
  assert.match(main, /setTodoDraft\(normalizedAction\)/);
  assert.match(main, /onPlanAction=\{openWeeklyReviewActionPlan\}/);
  assert.match(main, /onOpenPlannedTodo=\{openWeeklyReviewPlannedTodo\}/);

  assert.match(styles, /\.weekly-action-plan-list/);
  assert.match(styles, /\.weekly-action-plan-item/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*\.weekly-action-plan-item/);
});
