import assert from "node:assert/strict";
import { test } from "node:test";

import { invokeAttendanceCron } from "./index.mjs";

test("posts to the attendance cron function with the cron secret", async () => {
  const calls = [];

  const result = await invokeAttendanceCron({
    env: {
      ATTENDANCE_CRON_URL: "https://example.supabase.co/functions/v1/attendance-cron",
      CRON_SECRET: "test-secret",
      USER_AGENT: "study-room-test",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => '{"ok":true}',
      };
    },
    now: new Date("2026-06-07T10:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.supabase.co/functions/v1/attendance-cron");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  assert.equal(calls[0].options.headers["x-cron-secret"], "test-secret");
  assert.equal(calls[0].options.headers["user-agent"], "study-room-test");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    source: "aws-eventbridge",
    triggeredAt: "2026-06-07T10:00:00.000Z",
  });
});

test("requires attendance cron URL and cron secret", async () => {
  await assert.rejects(
    () =>
      invokeAttendanceCron({
        env: {},
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => "",
        }),
      }),
    /ATTENDANCE_CRON_URL is required/,
  );

  await assert.rejects(
    () =>
      invokeAttendanceCron({
        env: {
          ATTENDANCE_CRON_URL: "https://example.supabase.co/functions/v1/attendance-cron",
        },
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => "",
        }),
      }),
    /CRON_SECRET is required/,
  );
});

test("throws when the attendance cron function returns an error", async () => {
  await assert.rejects(
    () =>
      invokeAttendanceCron({
        env: {
          ATTENDANCE_CRON_URL: "https://example.supabase.co/functions/v1/attendance-cron",
          CRON_SECRET: "test-secret",
        },
        fetchImpl: async () => ({
          ok: false,
          status: 500,
          text: async () => "edge function failed",
        }),
      }),
    /attendance-cron failed with status 500: edge function failed/,
  );
});
