import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  getCurrentStudyBreakSeconds,
  getTotalStudyBreakSeconds,
  isStudySessionPaused,
} from "../src/sessionBreak.mjs";

test("study session break state detects only valid pause timestamps", () => {
  assert.equal(isStudySessionPaused({ paused_at: "2026-07-19T10:00:00.000Z" }), true);
  assert.equal(isStudySessionPaused({ paused_at: null }), false);
  assert.equal(isStudySessionPaused({ paused_at: "invalid" }), false);
  assert.equal(isStudySessionPaused(null), false);
});

test("current break seconds increase from paused_at and never go negative", () => {
  assert.equal(getCurrentStudyBreakSeconds({
    pausedAt: "2026-07-19T10:00:00.000Z",
    nowMs: Date.parse("2026-07-19T10:12:34.900Z"),
  }), 754);
  assert.equal(getCurrentStudyBreakSeconds({
    pausedAt: "2026-07-19T10:00:00.000Z",
    nowMs: Date.parse("2026-07-19T09:59:59.000Z"),
  }), 0);
});

test("total break seconds combine persisted and current break intervals", () => {
  assert.equal(getTotalStudyBreakSeconds({
    pausedSeconds: 300,
    pausedAt: "2026-07-19T10:00:00.000Z",
    nowMs: Date.parse("2026-07-19T10:05:30.000Z"),
  }), 630);
  assert.equal(getTotalStudyBreakSeconds({ pausedSeconds: -10, pausedAt: null }), 0);
  assert.equal(getTotalStudyBreakSeconds({ pausedSeconds: Number.NaN, pausedAt: "invalid" }), 0);
});

test("paused sessions survive page refresh without sending an exit end request", () => {
  const source = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

  assert.match(source, /if \(!activeSessionId \|\| activeSessionPaused \|\| !accessToken/);
  assert.match(source, /\[activeSession\?\.id, activeSession\?\.paused_at, session\?\.access_token/);
});
