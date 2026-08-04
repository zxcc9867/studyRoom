import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getStudyStartAction } from "../src/dailyHabit.mjs";

test("reflection action has priority and becomes the suggested todo", () => {
  assert.deepEqual(
    getStudyStartAction({
      latestNextAction: "  AWS   모의고사 1회  ",
      primaryActionLabel: "10분 시작 준비",
      fallbackTodoTitle: "영어 단어",
    }),
    {
      label: "이어서 준비하기",
      suggestedTodoTitle: "AWS 모의고사 1회",
      source: "reflection",
    },
  );
});

test("weekly goal controls the label while the first todo remains the suggestion", () => {
  assert.deepEqual(
    getStudyStartAction({
      latestNextAction: " ",
      primaryActionLabel: " 오늘 목표 이어가기 ",
      fallbackTodoTitle: "  파이썬   복습 ",
    }),
    {
      label: "오늘 목표 이어가기",
      suggestedTodoTitle: "파이썬 복습",
      source: "weekly-goal",
    },
  );
});

test("todo-only and empty states keep the stable entry label", () => {
  assert.deepEqual(
    getStudyStartAction({ fallbackTodoTitle: "  SQL   실습 " }),
    {
      label: "입장하고 시작",
      suggestedTodoTitle: "SQL 실습",
      source: "today-todo",
    },
  );
  assert.deepEqual(getStudyStartAction(), {
    label: "입장하고 시작",
    suggestedTodoTitle: "",
    source: "default",
  });
});

test("Today routes one adaptive persistent start action and leaves habit cards informational", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(main, /const studyStartAction = getStudyStartAction\(/);
  assert.match(main, /startTimer\(false, undefined, studyStartAction\.suggestedTodoTitle\)/);
  assert.match(main, /!activeSession \? studyStartAction\.label/);
  assert.equal(
    main.match(/startTimer\(false, undefined, studyStartAction\.suggestedTodoTitle\)/g)?.length,
    1,
  );
  assert.doesNotMatch(main, /className="secondary weekly-habit-action"/);
  assert.doesNotMatch(main, /startTimer\(false, undefined, latestNextAction/);
  assert.match(main, /daily-habit-next-action-cue/);
  assert.match(main, /weekly-habit-action-note/);
  assert.doesNotMatch(styles, /\.daily-habit-next-action button/);
  assert.doesNotMatch(styles, /\.weekly-habit-action\s*\{/);
  assert.match(styles, /\.weekly-habit-action-note/);
});
