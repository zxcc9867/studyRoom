import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDashboardData } from "../src/dashboardData.ts";

function fixtureClient(goals, failureOnSecondPage = false) {
  const calls = [];
  return {
    calls,
    from(table) {
      let range = [0, 499];
      const query = {
        select() { return query; },
        eq(field, value) { if (table === "study_goals") calls.push(["eq", field, value]); return query; },
        order(field) { if (table === "study_goals") calls.push(["order", field]); return query; },
        not() { return query; },
        limit() { return query; },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        range(from, to) { range = [from, to]; if (table === "study_goals") calls.push(["range", from, to]); return query; },
        then(resolve, reject) {
          return Promise.resolve(table === "study_goals"
            ? { data: goals.slice(range[0], range[1] + 1), error: failureOnSecondPage && range[0] > 0 ? { message: "goal page failed" } : null }
            : { data: [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test("goal history loads beyond the old 100-goal cutoff and a full page", async () => {
  const goals = Array.from({ length: 601 }, (_, id) => ({ id: String(id), status: "completed" }));
  const client = fixtureClient(goals);
  const result = await loadDashboardData(client, "current-user");
  assert.deepEqual(result.goalData, goals);
  assert.deepEqual(client.calls.filter(([kind]) => kind === "range"), [["range", 0, 499], ["range", 500, 999]]);
  assert.ok(client.calls.some(([kind, field, value]) => kind === "eq" && field === "user_id" && value === "current-user"));
  assert.ok(client.calls.some(([kind, field]) => kind === "order" && field === "id"));
});

test("failed later goal page rejects instead of silently hiding earned badges", async () => {
  const client = fixtureClient(Array.from({ length: 501 }, (_, id) => ({ id })), true);
  await assert.rejects(loadDashboardData(client, "current-user"), /goal page failed/);
});
