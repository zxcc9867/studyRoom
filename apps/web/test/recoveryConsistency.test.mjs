import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

async function loadTypeScript(path) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { loadDashboardData } = await loadTypeScript("apps/web/src/dashboardData.ts");
const { createRecoveryRequest } = await loadTypeScript("supabase/functions/_shared/recovery.ts");

// Keep Supabase's query builder real; replace only the external PostgREST transport.
function recoveryDatabase(initialRows) {
  const rows = structuredClone(initialRows);
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const table = url.pathname.split("/").at(-1);
    if (table !== "study_recovery_requests") return Response.json([]);
    const query = url.searchParams;
    const matches = (row) => [...query].every(([key, value]) => {
      if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
      if (value.startsWith("in.(")) return value.slice(4, -1).split(",").map((item) => item.replaceAll('"', "")).includes(row[key]);
      return true;
    });
    let selected = rows.filter(matches);
    if (init.method === "POST") {
      const value = JSON.parse(init.body);
      if (value.trigger_type === "missed_attendance" && rows.some((row) => row.user_id === value.user_id && row.trigger_type === value.trigger_type && row.status === "pending")) {
        return Response.json({ code: "23505", message: "one pending attendance recovery" }, { status: 409 });
      }
      const created = { id: `created-${rows.length}`, created_at: "2026-08-28T12:00:00Z", ...value };
      rows.push(created);
      selected = [created];
    } else if (init.method === "PATCH") {
      const value = JSON.parse(init.body);
      selected.forEach((row) => Object.assign(row, value));
    }
    if (query.get("order")?.includes("created_at.desc")) selected.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const offset = Number(query.get("offset") ?? 0);
    const limit = Number(query.get("limit") ?? selected.length);
    selected = selected.slice(offset, offset + limit);
    const fields = query.get("select");
    const projected = selected.map((row) => fields && fields !== "*"
      ? Object.fromEntries(fields.split(",").map((field) => [field, row[field]]))
      : row);
    const accept = new Headers(init.headers).get("accept") ?? "";
    return Response.json(accept.includes("vnd.pgrst.object") ? projected[0] ?? null : projected);
  };
  return {
    rows,
    client: createClient("https://recovery-fixture.supabase.co", "fixture-key", {
      global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

const aggregate = {
  id: "attendance-aggregate", user_id: "owner", local_date: "2026-06-17",
  covered_start_date: "2026-06-17", covered_end_date: "2026-08-27", covered_missed_days: 72,
  trigger_type: "missed_attendance", status: "pending", reason: null,
  makeup_todo_title: null, pledge_todo_title: null,
  slack_channel_id: null, slack_message_ts: null, followup_sent_at: null,
  created_at: "2026-06-17T12:00:00Z",
};

test("dashboard restores the same aggregate on each device without consolidated audit rows", async () => {
  const database = recoveryDatabase([
    aggregate,
    ...Array.from({ length: 71 }, (_, index) => ({ ...aggregate, id: `audit-${index}`, status: "consolidated" })),
    { ...aggregate, id: "other-owner", user_id: "someone-else" },
  ]);
  for (let device = 0; device < 2; device += 1) {
    const { recoveryData } = await loadDashboardData(database.client, "owner");
    assert.deepEqual(recoveryData.map((row) => row.id), ["attendance-aggregate"]);
    assert.equal(recoveryData[0].covered_missed_days, 72);
    assert.equal(recoveryData[0].covered_start_date, "2026-06-17");
    assert.equal(recoveryData[0].covered_end_date, "2026-08-27");
  }
});

test("an older pending recovery remains visible beyond 500 newer submitted requests", async () => {
  const database = recoveryDatabase([
    aggregate,
    ...Array.from({ length: 601 }, (_, index) => ({ ...aggregate, id: `submitted-${index}`, status: "submitted", created_at: "2026-08-28T12:00:00Z" })),
  ]);
  const { recoveryData } = await loadDashboardData(database.client, "owner");
  assert.equal(recoveryData.length, 602);
  assert.equal(recoveryData.filter((row) => row.status === "pending").length, 1);
  assert.equal(recoveryData.at(-1).id, "attendance-aggregate");
});

test("a new missed day extends the existing aggregate once instead of hitting the unique constraint", async () => {
  const database = recoveryDatabase([aggregate]);
  const input = { userId: "owner", localDate: "2026-08-28", triggerType: "missed_attendance" };
  const first = await createRecoveryRequest(database.client, input);
  const repeated = await createRecoveryRequest(database.client, input);
  assert.equal(first.created, false);
  assert.equal(first.request.id, "attendance-aggregate");
  assert.equal(first.request.covered_missed_days, 73);
  assert.equal(first.request.covered_end_date, "2026-08-28");
  assert.equal(repeated.request.covered_missed_days, 73);
  assert.equal(database.rows.length, 1);
});

test("camera recovery stays separate from attendance and does not duplicate on a repeated trigger", async () => {
  const database = recoveryDatabase([aggregate]);
  const input = { userId: "owner", localDate: "2026-08-28", triggerType: "camera_absence_repeat" };
  const created = await createRecoveryRequest(database.client, input);
  const repeated = await createRecoveryRequest(database.client, input);
  assert.equal(created.created, true);
  assert.equal(repeated.created, false);
  assert.equal(database.rows.length, 2);
  assert.equal(database.rows[0].covered_missed_days, 72);
  assert.equal(created.request.covered_start_date, "2026-08-28");
  assert.equal(created.request.covered_end_date, "2026-08-28");
});
