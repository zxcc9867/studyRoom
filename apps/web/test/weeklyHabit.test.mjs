import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  allocateCompletedStudySecondsByDate,
  getRollingHabitDateKeys,
  getWeeklyHabitRhythm,
  getWeeklyHabitRewardHistory,
  getWeeklyHabitTargetState,
  shiftHabitDateKey,
} from "../src/weeklyHabit.mjs";

test("rolling habit dates include today and cross month and year boundaries", () => {
  assert.deepEqual(getRollingHabitDateKeys("2026-01-02"), [
    "2025-12-27",
    "2025-12-28",
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
  ]);
  assert.equal(shiftHabitDateKey("2026-03-01", -1), "2026-02-28");
  assert.throws(() => getRollingHabitDateKeys("2026-02-30"), /Invalid date key/);
});

test("completed study seconds are proportionally split across local midnight", () => {
  const totals = allocateCompletedStudySecondsByDate({
    timeZone: "Asia/Seoul",
    dateKeys: ["2026-07-13", "2026-07-14"],
    sessions: [
      {
        started_at: "2026-07-13T14:00:00.000Z",
        ended_at: "2026-07-13T16:00:00.000Z",
        duration_seconds: 5_400,
        status: "completed",
      },
    ],
  });

  assert.deepEqual(totals, {
    "2026-07-13": 2_700,
    "2026-07-14": 2_700,
  });
});

test("allocation matches server caps and daylight-saving day boundaries", () => {
  const totals = allocateCompletedStudySecondsByDate({
    timeZone: "America/New_York",
    dateKeys: ["2026-03-08"],
    sessions: [
      {
        started_at: "2026-03-08T05:00:00.000Z",
        ended_at: "2026-03-09T04:00:00.000Z",
        duration_seconds: 99_999,
        status: "completed",
      },
      {
        started_at: "2026-03-08T12:00:00.000Z",
        ended_at: null,
        duration_seconds: 600,
        status: "active",
      },
    ],
  });

  assert.equal(totals["2026-03-08"], 23 * 60 * 60);
});

test("weekly rhythm uses canonical today time and preserves yesterday streak while today is in progress", () => {
  const rhythm = getWeeklyHabitRhythm({
    todayDateKey: "2026-07-19",
    timeZone: "Asia/Seoul",
    todayStudySeconds: 9 * 60,
    sessions: [
      completedSession("2026-07-16", 10 * 60),
      completedSession("2026-07-17", 2 * 60 * 60),
      completedSession("2026-07-18", 10 * 60),
      completedSession("2026-07-19", 3 * 60 * 60),
    ],
    todos: [{ local_date: "2026-07-17", is_completed: true }],
  });

  assert.equal(rhythm.days.length, 7);
  assert.equal(rhythm.days.at(-1).studySeconds, 9 * 60);
  assert.equal(rhythm.days.at(-1).stage, "ready");
  assert.equal(rhythm.days.at(-1).stageLabel, "시작 전");
  assert.equal(rhythm.startSuccessDays, 3);
  assert.equal(rhythm.goalDays, 1);
  assert.equal(rhythm.bloomDays, 1);
  assert.equal(rhythm.currentStreakDays, 3);
  assert.match(rhythm.coach.description, /어제까지 3일/);
  assert.equal(rhythm.target.remainingTargetDays, 2);
  assert.equal(rhythm.target.progressPercent, 60);
  assert.equal(rhythm.primaryActionLabel, "10분 시작 준비");
});

test("weekly rhythm includes today in the streak and distinguishes seed, goal, and bloom", () => {
  const rhythm = getWeeklyHabitRhythm({
    todayDateKey: "2026-07-19",
    timeZone: "UTC",
    todayStudySeconds: 4 * 60 * 60,
    sessions: [
      completedSession("2026-07-17", 10 * 60),
      completedSession("2026-07-18", 4 * 60 * 60),
    ],
    todos: [{ local_date: "2026-07-19", is_completed: true }],
  });

  const stages = rhythm.days.slice(-3).map((day) => day.stage);
  assert.deepEqual(stages, ["seed", "tree", "bloom"]);
  assert.equal(rhythm.currentStreakDays, 3);
  assert.equal(rhythm.startSuccessDays, 3);
  assert.equal(rhythm.goalDays, 2);
  assert.equal(rhythm.bloomDays, 1);
  assert.equal(rhythm.days.at(-1).stageLabel, "꽃");
  assert.match(rhythm.coach.title, /꽃/);
  assert.equal(rhythm.primaryActionLabel, null);
});

test("flexible weekly target caps credit at five starts and leaves two rest days", () => {
  assert.deepEqual(getWeeklyHabitTargetState(0), {
    targetDays: 5,
    restAllowanceDays: 2,
    creditedStartDays: 0,
    remainingTargetDays: 5,
    targetReached: false,
    progressPercent: 0,
  });
  assert.equal(getWeeklyHabitTargetState(4).remainingTargetDays, 1);
  assert.equal(getWeeklyHabitTargetState(4).progressPercent, 80);
  assert.equal(getWeeklyHabitTargetState(5).targetReached, true);
  assert.equal(getWeeklyHabitTargetState(5).progressPercent, 100);
  assert.equal(getWeeklyHabitTargetState(7).creditedStartDays, 5);
  assert.equal(getWeeklyHabitTargetState(7).progressPercent, 100);
});

test("five starts inside seven days earn one persistent firefly wreath without overlapping duplicates", () => {
  const sessions = Array.from({ length: 12 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      started_at: `2026-07-${day}T09:00:00.000Z`,
      ended_at: `2026-07-${day}T09:10:00.000Z`,
      duration_seconds: 600,
      status: "completed",
    };
  });

  const history = getWeeklyHabitRewardHistory({
    todayDateKey: "2026-07-12",
    timeZone: "UTC",
    sessions,
  });

  assert.equal(history.earnedCount, 2);
  assert.deepEqual(history.earnedRewards.map((reward) => reward.earnedDateKey), ["2026-07-05", "2026-07-12"]);
  assert.equal(history.earnedRewards[0].windowStartDateKey, "2026-06-29");
  assert.equal(history.latestEarnedDateKey, "2026-07-12");
});

test("an earned wreath remains after the current rolling target falls below five starts", () => {
  const sessions = Array.from({ length: 5 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      started_at: `2026-07-${day}T23:00:00.000Z`,
      ended_at: `2026-07-${day}T23:10:00.000Z`,
      duration_seconds: 600,
      status: "completed",
    };
  });

  const history = getWeeklyHabitRewardHistory({
    todayDateKey: "2026-07-20",
    timeZone: "UTC",
    sessions,
  });
  const currentRhythm = getWeeklyHabitRhythm({
    todayDateKey: "2026-07-20",
    timeZone: "UTC",
    sessions,
  });

  assert.equal(history.earnedCount, 1);
  assert.equal(history.latestEarnedDateKey, "2026-07-05");
  assert.equal(currentRhythm.target.targetReached, false);
  assert.equal(currentRhythm.target.creditedStartDays, 0);
});

test("reaching five starts allows today to remain an optional rest day", () => {
  const rhythm = getWeeklyHabitRhythm({
    todayDateKey: "2026-07-19",
    timeZone: "UTC",
    todayStudySeconds: 0,
    sessions: [
      completedSession("2026-07-13", 10 * 60),
      completedSession("2026-07-14", 10 * 60),
      completedSession("2026-07-15", 10 * 60),
      completedSession("2026-07-16", 10 * 60),
      completedSession("2026-07-17", 10 * 60),
    ],
  });

  assert.equal(rhythm.target.targetReached, true);
  assert.equal(rhythm.target.remainingTargetDays, 0);
  assert.equal(rhythm.days.at(-1).habitSuccess, false);
  assert.match(rhythm.coach.title, /5번 시작/);
  assert.match(rhythm.coach.description, /쉬어도/);
  assert.equal(rhythm.primaryActionLabel, "10분 시작 준비");
});

test("a learner with an earlier start gets a gentle restart cue after a rest day", () => {
  const rhythm = getWeeklyHabitRhythm({
    todayDateKey: "2026-07-19",
    timeZone: "UTC",
    todayStudySeconds: 0,
    sessions: [
      completedSession("2026-07-14", 10 * 60),
      completedSession("2026-07-16", 10 * 60),
      completedSession("2026-07-17", 10 * 60),
    ],
  });

  assert.equal(rhythm.days.at(-2).habitSuccess, false);
  assert.equal(rhythm.isGentleRestart, true);
  assert.equal(rhythm.primaryActionLabel, "10분으로 다시 잇기");
  assert.equal(rhythm.coach.title, "다시 잇는 날");
  assert.match(rhythm.coach.description, /어제 쉬었어도/);
  assert.match(rhythm.coach.description, /오늘 10분/);
});

test("gentle restart does not replace first-start, active streak, or earned-rest guidance", () => {
  const firstStart = getWeeklyHabitRhythm({
    todayDateKey: "2026-07-19",
    timeZone: "UTC",
    todayStudySeconds: 0,
  });
  const activeStreak = getWeeklyHabitRhythm({
    todayDateKey: "2026-07-19",
    timeZone: "UTC",
    todayStudySeconds: 0,
    sessions: [completedSession("2026-07-18", 10 * 60)],
  });
  const earnedRest = getWeeklyHabitRhythm({
    todayDateKey: "2026-07-19",
    timeZone: "UTC",
    todayStudySeconds: 0,
    sessions: [
      completedSession("2026-07-13", 10 * 60),
      completedSession("2026-07-14", 10 * 60),
      completedSession("2026-07-15", 10 * 60),
      completedSession("2026-07-16", 10 * 60),
      completedSession("2026-07-17", 10 * 60),
    ],
  });

  assert.equal(firstStart.isGentleRestart, false);
  assert.equal(firstStart.primaryActionLabel, "10분 시작 준비");
  assert.equal(activeStreak.isGentleRestart, false);
  assert.match(activeStreak.coach.description, /어제까지 1일/);
  assert.equal(earnedRest.isGentleRestart, false);
  assert.equal(earnedRest.target.targetReached, true);
  assert.match(earnedRest.coach.description, /쉬어도/);
});

test("Today exposes the gentle restart cue as guidance without adding another action", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../src/WeeklyHabitRhythmPanel.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(main, /<WeeklyHabitRhythmPanel/);
  assert.match(panel, /rhythm\.isGentleRestart/);
  assert.match(panel, /weekly-habit-restart-cue/);
  assert.match(styles, /\.weekly-habit-target\.restart/);
  assert.match(styles, /\.weekly-habit-restart-cue/);
  assert.doesNotMatch(panel, /startTimer\(/);
});

test("today screen renders the accessible responsive seven-day forest path", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../src/WeeklyHabitRhythmPanel.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const helper = readFileSync(new URL("../src/weeklyHabit.mjs", import.meta.url), "utf8");

  assert.match(main, /getWeeklyHabitRhythm/);
  assert.match(main, /<WeeklyHabitRhythmPanel/);
  assert.match(panel, /최근 7일 숲길/);
  assert.match(panel, /aria-label="최근 7일 날짜별 공부 습관"/);
  assert.match(panel, /weekly-habit-day-/);
  assert.match(panel, /role="progressbar"/);
  assert.match(panel, /aria-valuemax=\{rhythm\.target\.targetDays\}/);
  assert.match(helper, /10분 시작 준비/);
  assert.match(panel, /weekly-habit-action-note/);
  assert.match(main, /startTimer\(false, undefined, studyStartAction\.suggestedTodoTitle\)/);
  assert.doesNotMatch(panel, /className="secondary weekly-habit-action"/);
  assert.match(styles, /\.weekly-habit-path/);
  assert.match(styles, /\.weekly-habit-target-seeds/);
  assert.match(styles, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.weekly-habit-path[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.weekly-habit-target[\s\S]*?grid-template-columns: 1fr/);
});

function completedSession(dateKey, durationSeconds) {
  return {
    started_at: `${dateKey}T10:00:00.000Z`,
    ended_at: `${dateKey}T${String(10 + Math.ceil(durationSeconds / 3600)).padStart(2, "0")}:00:00.000Z`,
    duration_seconds: durationSeconds,
    status: "completed",
  };
}
