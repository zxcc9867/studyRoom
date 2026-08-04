import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  BREAK_RETURN_PRESET_MINUTES,
  clearStudyBreakReturnDeadline,
  createStudyBreakReturnDeadlineMs,
  extendStudyBreakReturnDeadlineMs,
  getStudyBreakReturnPlanState,
  getStudyBreakReturnStorageKey,
  persistStudyBreakReturnDeadlineMs,
  readStudyBreakReturnDeadlineMs,
} from "../src/sessionBreak.mjs";

test("break return presets create an exact future deadline", () => {
  const nowMs = Date.parse("2026-07-21T10:00:00.000Z");
  assert.deepEqual(BREAK_RETURN_PRESET_MINUTES, [10, 20, 40]);
  assert.equal(createStudyBreakReturnDeadlineMs({ nowMs, durationMinutes: 20 }), nowMs + 20 * 60_000);
  assert.equal(createStudyBreakReturnDeadlineMs({ nowMs, durationMinutes: 0 }), null);
  assert.equal(createStudyBreakReturnDeadlineMs({ nowMs: Number.NaN, durationMinutes: 10 }), null);
});

test("break return state distinguishes upcoming and due plans", () => {
  const nowMs = Date.parse("2026-07-21T10:00:00.000Z");
  const deadlineMs = nowMs + 10 * 60_000;
  const upcoming = getStudyBreakReturnPlanState({ deadlineMs, nowMs });
  assert.equal(upcoming.planned, true);
  assert.equal(upcoming.due, false);
  assert.equal(upcoming.remainingSeconds, 600);

  const due = getStudyBreakReturnPlanState({ deadlineMs, nowMs: deadlineMs + 1 });
  assert.equal(due.due, true);
  assert.equal(due.remainingSeconds, 0);

  assert.deepEqual(getStudyBreakReturnPlanState({ deadlineMs: null, nowMs }), {
    planned: false,
    due: false,
    deadlineMs: null,
    remainingSeconds: 0,
    leaseExpiresBeforeReturn: false,
  });
});

test("break return state warns when the session lease ends first", () => {
  const nowMs = Date.parse("2026-07-21T10:00:00.000Z");
  const deadlineMs = nowMs + 40 * 60_000;
  const state = getStudyBreakReturnPlanState({
    deadlineMs,
    nowMs,
    leaseDeadlineMs: nowMs + 30 * 60_000,
  });
  assert.equal(state.leaseExpiresBeforeReturn, true);
});

test("ten more minutes extends from the later of now or the current promise", () => {
  const nowMs = Date.parse("2026-07-21T10:00:00.000Z");
  assert.equal(extendStudyBreakReturnDeadlineMs({
    deadlineMs: nowMs + 5 * 60_000,
    nowMs,
    durationMinutes: 10,
  }), nowMs + 15 * 60_000);
  assert.equal(extendStudyBreakReturnDeadlineMs({
    deadlineMs: nowMs - 1,
    nowMs,
    durationMinutes: 10,
  }), nowMs + 10 * 60_000);
});

test("break return storage is scoped per user and session and fails safely", () => {
  const key = getStudyBreakReturnStorageKey({ userId: "user-1", sessionId: "session-1" });
  assert.equal(key, "study-room:break-return:user-1:session-1");
  assert.equal(getStudyBreakReturnStorageKey({ userId: "", sessionId: "session-1" }), "");

  const values = new Map();
  const storage = {
    getItem: (itemKey) => values.get(itemKey) ?? null,
    setItem: (itemKey, value) => values.set(itemKey, value),
    removeItem: (itemKey) => values.delete(itemKey),
  };
  const deadlineMs = Date.parse("2026-07-21T10:20:00.000Z");
  assert.equal(persistStudyBreakReturnDeadlineMs(storage, key, deadlineMs), true);
  assert.equal(readStudyBreakReturnDeadlineMs(storage, key), deadlineMs);
  assert.equal(clearStudyBreakReturnDeadline(storage, key), true);
  assert.equal(readStudyBreakReturnDeadlineMs(storage, key), null);

  const brokenStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.equal(readStudyBreakReturnDeadlineMs(brokenStorage, key), null);
  assert.equal(persistStudyBreakReturnDeadlineMs(brokenStorage, key, deadlineMs), false);
  assert.equal(clearStudyBreakReturnDeadline(brokenStorage, key), false);
});

test("web app wires the break return plan into the existing pause and resume flow", () => {
  const component = readFileSync(new URL("../src/BreakReturnPlan.tsx", import.meta.url), "utf8");
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(component, /언제 다시 앉을까요/);
  assert.match(component, /돌아올 시간이 됐어요/);
  assert.match(component, /10분 더/);
  assert.match(main, /getStudyBreakReturnStorageKey/);
  assert.match(main, /readStudyBreakReturnDeadlineMs/);
  assert.match(main, /persistStudyBreakReturnDeadlineMs/);
  assert.match(main, /clearStudyBreakReturnDeadline/);
  assert.match(main, /<BreakReturnPlan/);
  assert.match(main, /activeSessionPaused/);
  assert.match(styles, /\.break-return-plan/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.break-return-actions/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.break-return-plan\.due/);
});
