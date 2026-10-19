import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDashboardData } from "../src/dashboardData.ts";

// Model only the external query boundary; the loader's filters/order/limit run unchanged.
function reflectionClient(reflections) {
  return {
    from(table) {
      let rows = table === "study_session_reflections" ? [...reflections] : [];
      let single = false;
      const query = {
        select() { return query; },
        abortSignal() { return query; },
        eq(field, value) { rows = rows.filter(row => row[field] === value); return query; },
        not(field, operator, value) {
          assert.equal(operator, "is");
          rows = rows.filter(row => row[field] !== value);
          return query;
        },
        in() { return query; },
        order(field, { ascending = true } = {}) {
          rows.sort((a, b) => String(a[field]).localeCompare(String(b[field])) * (ascending ? 1 : -1));
          return query;
        },
        limit(count) { rows = rows.slice(0, count); return query; },
        range(from, to) { rows = rows.slice(from, to + 1); return query; },
        maybeSingle() { single = true; return query; },
        then(resolve, reject) {
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

const old = { id: "old", user_id: "owner", next_action: "장고245페이지", created_at: "2026-08-01T01:00:00Z" };

test("latest blank reflection clears an older continuation without deleting either reflection", async () => {
  const reflections = [old, { id: "latest", user_id: "owner", next_action: null, created_at: "2026-10-19T01:00:00Z" }];
  const before = structuredClone(reflections);
  const result = await loadDashboardData(reflectionClient(reflections), "owner");
  assert.equal(result.latestReflectionData.id, "latest");
  assert.equal(result.latestReflectionData.next_action, null);
  assert.deepEqual(reflections, before);
});

test("latest continuation remains owner scoped and retains the newest explicit action", async () => {
  const reflections = [old,
    { id: "new", user_id: "owner", next_action: "[테스트] 새 공부", created_at: "2026-10-19T02:00:00Z" },
    { id: "foreign", user_id: "someone-else", next_action: "다른 계정", created_at: "2026-10-19T03:00:00Z" }];
  const result = await loadDashboardData(reflectionClient(reflections), "owner");
  assert.equal(result.latestReflectionData.id, "new");
  assert.equal(result.latestReflectionData.next_action, "[테스트] 새 공부");
});
