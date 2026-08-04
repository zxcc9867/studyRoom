import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  DAILY_HABIT_SEED_SECONDS,
  getTenMinuteCheckpointState,
  getTenMinuteCheckpointStorageKey,
  persistTenMinuteCheckpointAcknowledged,
  readTenMinuteCheckpointAcknowledged,
} from "../src/dailyHabit.mjs";

test("ten minute checkpoint appears only when the active session crosses today's first threshold", () => {
  const before = getTenMinuteCheckpointState({
    completedTodaySeconds: 0,
    activeTodaySeconds: DAILY_HABIT_SEED_SECONDS - 1,
    hasActiveSession: true,
  });
  assert.equal(before.eligible, true);
  assert.equal(before.reached, false);
  assert.equal(before.visible, false);
  assert.equal(before.remainingSeconds, 1);

  const reached = getTenMinuteCheckpointState({
    completedTodaySeconds: 0,
    activeTodaySeconds: DAILY_HABIT_SEED_SECONDS,
    hasActiveSession: true,
  });
  assert.equal(reached.reached, true);
  assert.equal(reached.visible, true);
  assert.equal(reached.progressPercent, 100);
});

test("completed study and active study combine without repeating after an earlier success", () => {
  const combined = getTenMinuteCheckpointState({
    completedTodaySeconds: 8 * 60,
    activeTodaySeconds: 2 * 60,
    hasActiveSession: true,
  });
  assert.equal(combined.visible, true);
  assert.equal(combined.creditedSeconds, DAILY_HABIT_SEED_SECONDS);

  const alreadySucceeded = getTenMinuteCheckpointState({
    completedTodaySeconds: DAILY_HABIT_SEED_SECONDS,
    activeTodaySeconds: 30,
    hasActiveSession: true,
  });
  assert.equal(alreadySucceeded.eligible, false);
  assert.equal(alreadySucceeded.visible, false);
});

test("paused or acknowledged checkpoints stay hidden without changing earned progress", () => {
  const paused = getTenMinuteCheckpointState({
    completedTodaySeconds: 0,
    activeTodaySeconds: DAILY_HABIT_SEED_SECONDS,
    hasActiveSession: true,
    activeSessionPaused: true,
  });
  assert.equal(paused.reached, true);
  assert.equal(paused.visible, false);

  const acknowledged = getTenMinuteCheckpointState({
    completedTodaySeconds: 0,
    activeTodaySeconds: DAILY_HABIT_SEED_SECONDS,
    hasActiveSession: true,
    acknowledged: true,
  });
  assert.equal(acknowledged.reached, true);
  assert.equal(acknowledged.visible, false);
});

test("checkpoint acknowledgement uses a user, session, and local-date scoped key", () => {
  const key = getTenMinuteCheckpointStorageKey({
    userId: "user-1",
    sessionId: "session-1",
    dateKey: "2026-07-21",
  });
  assert.equal(key, "study-room:ten-minute-checkpoint:user-1:session-1:2026-07-21");
  assert.equal(getTenMinuteCheckpointStorageKey({ userId: "", sessionId: "session-1", dateKey: "2026-07-21" }), "");

  const values = new Map();
  const storage = {
    getItem: (storageKey) => values.get(storageKey) ?? null,
    setItem: (storageKey, value) => values.set(storageKey, value),
  };
  assert.equal(readTenMinuteCheckpointAcknowledged(storage, key), false);
  assert.equal(persistTenMinuteCheckpointAcknowledged(storage, key), true);
  assert.equal(readTenMinuteCheckpointAcknowledged(storage, key), true);
});

test("checkpoint storage failures do not affect the study session", () => {
  const brokenStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  assert.equal(readTenMinuteCheckpointAcknowledged(brokenStorage, "key"), false);
  assert.equal(persistTenMinuteCheckpointAcknowledged(brokenStorage, "key"), false);
});

test("today screen wires the live checkpoint, acknowledgement, and existing finish flow", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../src/TenMinuteCheckpoint.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(main, /getTenMinuteCheckpointState/);
  assert.match(main, /completedTodaySeconds: todayCompletedSeconds/);
  assert.match(main, /activeTodaySeconds/);
  assert.match(main, /readTenMinuteCheckpointAcknowledged/);
  assert.match(main, /persistTenMinuteCheckpointAcknowledged/);
  assert.match(main, /<TenMinuteCheckpoint/);
  assert.match(main, /onContinue=\{acknowledgeTenMinuteCheckpoint\}/);
  assert.match(main, /onFinish=\{\(\) => void openEndSessionCompletionModal\(\)\}/);
  assert.match(component, /aria-label="첫 10분 체크포인트"/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /오늘의 시작은 이미 성공했어요/);
  assert.match(component, /onClick=\{onContinue\}/);
  assert.match(component, /onClick=\{onFinish\}/);
  assert.match(component, /10분 습관 성공과 출석 2·4시간 목표는 서로 다른 기록/);
  assert.match(styles, /\.ten-minute-checkpoint/);
  assert.match(styles, /\.ten-minute-checkpoint\.complete/);
  assert.match(styles, /\.ten-minute-checkpoint-actions/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.ten-minute-checkpoint-actions/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.ten-minute-checkpoint-track/);
});
