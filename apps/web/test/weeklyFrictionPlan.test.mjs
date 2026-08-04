import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildWeeklyFrictionPlan, buildWeeklyStudyReview } from "../src/weeklyReview.mjs";

const reflection = (reason, createdAt) => ({
  interruption_reason: reason,
  created_at: createdAt,
});

test("weekly friction plan recommends one concrete environment change after a reason repeats", () => {
  assert.deepEqual(
    buildWeeklyFrictionPlan([
      reflection("phone", "2026-07-20T09:00:00Z"),
      reflection("phone", "2026-07-21T10:00:00Z"),
    ]),
    {
      reason: "phone",
      label: "휴대폰",
      count: 2,
      title: "휴대폰을 시야 밖에 두기",
      action: "다음 공부를 시작하기 전에 집중 모드를 켜고 휴대폰을 손이 닿지 않는 곳에 두세요.",
      cue: "시작 전 30초",
    },
  );
});

test("weekly friction plan stays quiet for one-off, none, and unknown interruptions", () => {
  assert.equal(buildWeeklyFrictionPlan([
    reflection("phone", "2026-07-21T10:00:00Z"),
    reflection("none", "2026-07-21T11:00:00Z"),
    reflection("unknown", "2026-07-21T12:00:00Z"),
    null,
  ]), null);
});

test("weekly friction plan resolves tied counts by the most recent occurrence, then stable reason order", () => {
  const recentFatigue = buildWeeklyFrictionPlan([
    reflection("fatigue", "2026-07-19T10:00:00Z"),
    reflection("phone", "2026-07-20T10:00:00Z"),
    reflection("phone", "2026-07-20T11:00:00Z"),
    reflection("fatigue", "2026-07-21T10:00:00Z"),
  ]);
  assert.equal(recentFatigue?.reason, "fatigue");

  const stableTie = buildWeeklyFrictionPlan([
    reflection("environment", "2026-07-21T10:00:00Z"),
    reflection("phone", "2026-07-21T10:00:00Z"),
    reflection("environment", "2026-07-21T10:00:00Z"),
    reflection("phone", "2026-07-21T10:00:00Z"),
  ]);
  assert.equal(stableTie?.reason, "phone");
});

test("weekly review derives friction only from completed sessions inside the current range", () => {
  const review = buildWeeklyStudyReview({
    todayDateKey: "2026-07-21",
    sessions: [
      { id: "current-a", local_date: "2026-07-20", status: "completed", duration_seconds: 600 },
      { id: "current-b", local_date: "2026-07-21", status: "completed", duration_seconds: 600 },
      { id: "active", local_date: "2026-07-21", status: "active", duration_seconds: 0 },
      { id: "previous", local_date: "2026-07-13", status: "completed", duration_seconds: 600 },
    ],
    reflections: [
      { session_id: "current-a", focus_score: 3, energy_score: 3, interruption_reason: "schedule", next_action: null, created_at: "2026-07-20T10:00:00Z" },
      { session_id: "current-b", focus_score: 3, energy_score: 3, interruption_reason: "schedule", next_action: null, created_at: "2026-07-21T10:00:00Z" },
      { session_id: "active", focus_score: 3, energy_score: 3, interruption_reason: "phone", next_action: null, created_at: "2026-07-21T12:00:00Z" },
      { session_id: "previous", focus_score: 3, energy_score: 3, interruption_reason: "phone", next_action: null, created_at: "2026-07-13T12:00:00Z" },
    ],
  });

  assert.equal(review.current.frictionPlan?.reason, "schedule");
  assert.equal(review.current.frictionPlan?.count, 2);
  assert.equal(review.previous.frictionPlan, null);
});

test("weekly review renders the friction plan as guidance without another action button", () => {
  const section = readFileSync(new URL("../src/WeeklyReviewSection.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(section, /current\.frictionPlan/);
  assert.match(section, /weekly-friction-plan/);
  assert.match(section, /숲길 정비 노트/);
  assert.doesNotMatch(section, /weekly-friction-plan-button/);
  assert.match(styles, /\.weekly-friction-plan/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*\.weekly-friction-plan/);
  assert.match(section, /\)\}\s*\{current\.frictionPlan && \(/);
  assert.match(styles, /\.adaptive-reminder-card\s*\{\s*grid-template-columns:\s*1fr;\s*\}\s*\.weekly-friction-plan\s*\{\s*grid-template-columns:\s*1fr;/s);
});
