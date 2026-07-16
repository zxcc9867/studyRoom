import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readme = readFileSync("README.md", "utf8");

test("README documents the current study loop, forest, mobile policy, and lease cap", () => {
  assert.match(readme, /세션 회고/);
  assert.match(readme, /주간 리뷰/);
  assert.match(readme, /적응형 알림/);
  assert.match(readme, /Three\.js/);
  assert.match(readme, /공부의 숲/);
  assert.match(readme, /최대 2시간/);
  assert.match(readme, /Expo 모바일/);
  assert.match(readme, /memory-bank\/prd-/);
});
