import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REFLECTION_INBOX_LIMIT,
  REFLECTION_INBOX_WINDOW_DAYS,
  getPendingReflectionSessions,
} from "../src/reflectionInbox.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDir, "..");
const repoRoot = path.resolve(webRoot, "../..");

function session({
  id,
  localDate,
  endedAt,
  status = "completed",
  durationSeconds = 1800,
}) {
  return {
    id,
    local_date: localDate,
    started_at: endedAt.replace("10:30", "10:00"),
    ended_at: endedAt,
    status,
    duration_seconds: durationSeconds,
  };
}

test("reflection inbox keeps only recent completed sessions without reflections", () => {
  const result = getPendingReflectionSessions({
    todayDateKey: "2026-07-21",
    sessions: [
      session({ id: "recent", localDate: "2026-07-21", endedAt: "2026-07-21T10:30:00.000Z" }),
      session({ id: "reflected", localDate: "2026-07-20", endedAt: "2026-07-20T10:30:00.000Z" }),
      session({ id: "boundary", localDate: "2026-07-15", endedAt: "2026-07-15T10:30:00.000Z" }),
      session({ id: "old", localDate: "2026-07-14", endedAt: "2026-07-14T10:30:00.000Z" }),
      session({ id: "active", localDate: "2026-07-21", endedAt: "2026-07-21T11:30:00.000Z", status: "active" }),
    ],
    reflections: [{ session_id: "reflected" }],
  });

  assert.equal(REFLECTION_INBOX_WINDOW_DAYS, 7);
  assert.deepEqual(result.map((item) => item.id), ["recent", "boundary"]);
});

test("reflection inbox sorts newest endings first and limits the gentle queue", () => {
  const sessions = Array.from({ length: 5 }, (_, index) =>
    session({
      id: `session-${index + 1}`,
      localDate: "2026-07-21",
      endedAt: `2026-07-21T10:${String(30 + index).padStart(2, "0")}:00.000Z`,
    }),
  );

  const result = getPendingReflectionSessions({
    todayDateKey: "2026-07-21",
    sessions,
    reflections: [],
  });

  assert.equal(REFLECTION_INBOX_LIMIT, 3);
  assert.deepEqual(result.map((item) => item.id), ["session-5", "session-4", "session-3"]);
});

test("reflection inbox fails closed for invalid dates and incomplete rows", () => {
  assert.deepEqual(
    getPendingReflectionSessions({
      todayDateKey: "not-a-date",
      sessions: [session({ id: "session-1", localDate: "2026-07-21", endedAt: "2026-07-21T10:30:00.000Z" })],
      reflections: [],
    }),
    [],
  );

  assert.deepEqual(
    getPendingReflectionSessions({
      todayDateKey: "2026-07-21",
      sessions: [{ id: "broken", status: "completed" }],
      reflections: [],
    }),
    [],
  );
});

test("My Page wires a loaded reflection inbox and secure follow-up save", () => {
  const main = readFileSync(path.join(webRoot, "src/main.tsx"), "utf8");
  const inbox = readFileSync(path.join(webRoot, "src/ReflectionInboxCard.tsx"), "utf8");
  const modal = readFileSync(path.join(webRoot, "src/SessionReflectionModal.tsx"), "utf8");
  const styles = readFileSync(path.join(webRoot, "src/styles.css"), "utf8");
  const migrationName = readdirSync(path.join(repoRoot, "supabase/migrations"))
    .find((name) => name.endsWith("_add_reflection_inbox.sql"));

  assert.ok(migrationName, "reflection inbox migration should exist");
  const migration = readFileSync(path.join(repoRoot, "supabase/migrations", migrationName), "utf8");

  assert.match(main, /getPendingReflectionSessions/);
  assert.match(main, /reflectionHistoryLoaded/);
  assert.match(main, /<ReflectionInbox/);
  assert.match(main, /\.from\("study_session_reflections"\)/);
  assert.match(main, /\.upsert\(/);
  assert.match(main, /mode="follow-up"/);
  assert.match(inbox, /className="reflection-inbox"/);
  assert.match(inbox, /회고 남기기/);
  assert.match(modal, /mode = "completion"/);
  assert.match(modal, /mode === "follow-up"/);
  assert.match(styles, /\.reflection-inbox/);
  assert.match(migration, /Users can insert owned completed session reflections/);
  assert.match(migration, /Users can update owned completed session reflections/);
  assert.match(migration, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(migration, /session\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /session\.status = 'completed'/);
  assert.match(migration, /revoke all on table public\.study_session_reflections from public, anon/);
  assert.match(migration, /revoke all on table public\.study_session_reflections from authenticated/);
  assert.match(migration, /grant select, insert, update on table public\.study_session_reflections to authenticated/);
});
