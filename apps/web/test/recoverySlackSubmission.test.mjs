import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const source = readFileSync("supabase/functions/slack-recovery-interactions/index.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
// Execute the real submission handler. Only its Edge runtime registration and
// unrelated coach imports are stubbed; Supabase still builds the actual requests.
runInNewContext(`${outputText}\nexports.submit = handleRecoverySubmission;`, {
  exports,
  require(name) {
    if (name === "jsr:@supabase/functions-js/edge-runtime.d.ts") return {};
    if (name === "jsr:@supabase/supabase-js@2.57.4") return { createClient };
    if (name === "../_shared/coach-notifications.ts" || name === "../_shared/coach-store.ts") return {};
    throw new Error(`Unexpected dependency: ${name}`);
  },
  Deno: { serve() {} }, Response, Intl,
  Date: class extends Date {
    constructor(...args) { super(...(args.length ? args : ["2026-08-28T16:00:00Z"])); }
  },
});

for (const [timeZone, expectedDate] of [
  ["Asia/Tokyo", "2026-08-29"],
  ["America/Los_Angeles", "2026-08-28"],
  [null, "2026-08-29"],
]) {
  test(`Slack makeup task uses today's local date (${timeZone ?? "default"}) instead of the old missed date`, async () => {
    const writes = [];
    const requestId = "22222222-2222-4222-8222-222222222222";
    const userId = "11111111-1111-4111-8111-111111111111";
    const client = createClient("https://recovery-fixture.supabase.co", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init = {}) => {
        const url = new URL(input);
        const table = url.pathname.split("/").at(-1);
        if (table === "study_recovery_requests" && init.method === "GET") {
          assert.equal(url.searchParams.get("id"), `eq.${requestId}`);
          return Response.json([{ id: requestId, user_id: userId, local_date: "2026-06-17", trigger_type: "missed_attendance", status: "pending" }]);
        }
        if (table === "profiles" && init.method === "GET") {
          assert.equal(url.searchParams.get("user_id"), `eq.${userId}`);
          return Response.json([{ time_zone: timeZone }]);
        }
        const body = JSON.parse(init.body);
        writes.push({ table, method: init.method, body });
        if (table === "study_todos" && init.method === "POST") return Response.json({ id: "makeup-todo", local_date: body.local_date });
        if (table === "study_recovery_requests" && init.method === "PATCH") return Response.json([]);
        throw new Error(`Unexpected request: ${init.method} ${table}`);
      } },
    });
    const field = (value) => ({ value });
    const response = await exports.submit(client, {
      type: "view_submission", user: { id: "slack-owner" },
      view: { private_metadata: requestId, state: { values: {
        reason: { reason: field("일정이 겹침") },
        makeup_todo_title: { makeup_todo_title: field("오늘 10분 복습") },
        pledge_todo_title: { pledge_todo_title: field("내일 다시 시작") },
      } } },
    });
    assert.deepEqual(await response.json(), { response_action: "clear" });
    const todos = writes.filter((write) => write.table === "study_todos");
    assert.equal(todos.length, 1);
    assert.equal(todos[0].body.local_date, expectedDate);
    assert.equal(todos[0].body.user_id, userId);
    assert.equal(todos[0].body.title, "오늘 10분 복습");
    const completed = writes.find((write) => write.table === "study_recovery_requests");
    assert.equal(completed.body.status, "submitted");
    assert.equal(completed.body.makeup_todo_id, "makeup-todo");
    assert.equal(completed.body.pledge_todo_id, null);
  });
}
