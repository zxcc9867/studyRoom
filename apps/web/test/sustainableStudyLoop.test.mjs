import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  getForestCustomizationCatalog,
  normalizeForestPreferences,
} from "../src/forestCustomization.mjs";
import { getAdaptiveReminderRecommendation } from "../src/adaptiveReminder.mjs";
import { buildWeeklyStudyReview, getStudyWeekRange } from "../src/weeklyReview.mjs";

test("forest customization unlocks rewards by completed tree count and rejects locked choices", () => {
  const initial = getForestCustomizationCatalog(0);
  const advanced = getForestCustomizationCatalog(2);

  assert.equal(initial.themes.find((option) => option.id === "harvest").unlocked, false);
  assert.equal(initial.themes.find((option) => option.id === "harvest").symbol, "\u25c6");
  assert.equal(initial.rewards.find((option) => option.id === "birdhouse").remainingTrees, 1);
  assert.equal(advanced.themes.find((option) => option.id === "moonlight").unlocked, true);
  assert.equal(advanced.rewards.find((option) => option.id === "picnic").unlocked, true);
  assert.deepEqual(
    normalizeForestPreferences(
      { island_theme: "moonlight", cottage_accent: "honey", featured_reward: "campfire" },
      1,
    ),
    { islandTheme: "spring", cottageAccent: "mint", featuredReward: "none" },
  );
});

test("weekly review compares Monday-to-Sunday study, completion, attendance, and reflections", () => {
  assert.deepEqual(getStudyWeekRange("2026-07-15"), {
    startDate: "2026-07-13",
    endDate: "2026-07-19",
  });

  const review = buildWeeklyStudyReview({
    todayDateKey: "2026-07-15",
    sessions: [
      { id: "current-a", local_date: "2026-07-13", status: "completed", duration_seconds: 3600 },
      { id: "current-b", local_date: "2026-07-14", status: "completed", duration_seconds: 1800 },
      { id: "previous", local_date: "2026-07-10", status: "completed", duration_seconds: 1200 },
    ],
    todos: [
      { local_date: "2026-07-13", is_completed: true },
      { local_date: "2026-07-14", is_completed: false },
      { local_date: "2026-07-10", is_completed: true },
    ],
    attendanceDays: [
      { local_date: "2026-07-13", status: "present" },
      { local_date: "2026-07-14", status: "present" },
      { local_date: "2026-07-10", status: "present" },
    ],
    reflections: [
      {
        session_id: "current-a",
        focus_score: 4,
        energy_score: 3,
        next_action: "Review chapter notes",
        created_at: "2026-07-13T10:00:00Z",
      },
    ],
  });

  assert.equal(review.current.studySeconds, 5400);
  assert.equal(review.current.completionRate, 50);
  assert.equal(review.current.presentDays, 2);
  assert.equal(review.current.averageFocus, 4);
  assert.deepEqual(review.current.nextActions, ["Review chapter notes"]);
  assert.equal(review.studySecondsChange, 4200);
  assert.equal(review.completionRateChange, -50);
});

test("adaptive reminders use a 28-day first-session median rounded to 15 minutes", () => {
  const sessions = [
    { status: "completed", local_date: "2026-07-13", started_at: "2026-07-13T09:08:00Z" },
    { status: "completed", local_date: "2026-07-14", started_at: "2026-07-14T09:22:00Z" },
    { status: "completed", local_date: "2026-07-15", started_at: "2026-07-15T09:29:00Z" },
    { status: "completed", local_date: "2026-07-15", started_at: "2026-07-15T11:00:00Z" },
  ];
  const recommendation = getAdaptiveReminderRecommendation({
    sessions,
    todayDateKey: "2026-07-15",
    timeZone: "UTC",
    currentReminderTime: "08:00:00",
  });

  assert.equal(recommendation.status, "recommended");
  assert.equal(recommendation.recommendedTime, "09:15");
  assert.equal(recommendation.sampleSize, 3);
  assert.equal(recommendation.deltaMinutes, 75);
  assert.equal(
    getAdaptiveReminderRecommendation({
      sessions: sessions.slice(0, 2),
      todayDateKey: "2026-07-15",
      timeZone: "UTC",
      currentReminderTime: "08:00:00",
    }).status,
    "insufficient-data",
  );
});

test("web and mobile source wire the sustainable session policy and lazy feature boundaries", () => {
  const main = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const mobile = readFileSync(new URL("../../mobile/App.tsx", import.meta.url), "utf8");
  const vite = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

  assert.match(main, /lazy\(\(\) => import\("\.\/StudyForestSection"\)\)/);
  assert.match(main, /lazy\(\(\) => import\("\.\/SessionReflectionModal"\)\)/);
  assert.match(main, /lazy\(\(\) => import\("\.\/WeeklyReviewSection"\)\)/);
  assert.match(main, /lazy\(\(\) => import\("\.\/AdaptiveReminderCard"\)\)/);
  assert.match(main, /rpc\("start_study_session", \{\s*p_todo_ids:/s);
  assert.match(main, /rpc\("complete_study_session"/);

  assert.match(mobile, /p_todo_ids: selectedSessionTodoIds/);
  assert.match(mobile, /function addQuickTodo\(\)/);
  assert.match(mobile, /function toggleSessionTodo\(todoId: string\)/);
  assert.match(mobile, /Alert\.alert\([^\n]+formatError\(error\)/);
  assert.equal((mobile.match(/<StatusBar barStyle="dark-content"/g) ?? []).length, 3);

  assert.match(vite, /manualChunks\(id\)/);
  assert.match(vite, /chunkSizeWarningLimit: 550/);
  assert.match(vite, /return "three"/);
  assert.match(vite, /supabase/);
  assert.match(vite, /vision/);
});

test("sustainable study migration applies RLS, least privilege, atomic session RPCs, and adaptive refresh", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20260712142233_sustainable_study_loop.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.study_session_reflections/i);
  assert.match(sql, /alter table public\.study_session_reflections enable row level security/i);
  assert.match(sql, /revoke all on table public\.study_session_reflections from public, anon, authenticated/i);
  assert.match(sql, /create table if not exists public\.study_forest_preferences/i);
  assert.match(sql, /alter table public\.study_forest_preferences enable row level security/i);
  assert.match(sql, /revoke all on table public\.study_forest_preferences from public, anon, authenticated/i);
  assert.match(sql, /create function public\.start_study_session\(p_todo_ids uuid\[\]\)/i);
  assert.match(sql, /insert into public\.study_session_todos/i);
  assert.match(sql, /create or replace function public\.complete_study_session/i);
  assert.match(sql, /insert into public\.study_session_reflections/i);
  assert.match(sql, /create trigger study_sessions_refresh_adaptive_reminder/i);
  assert.match(sql, /revoke all on function public\.refresh_adaptive_reminder_after_session\(\) from public, anon, authenticated/i);
});
