import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readme = readFileSync("README.md", "utf8");

test("README documents the current study loop, forest, mobile policy, and lease cap", () => {
  assert.match(readme, /세션 회고/);
  assert.match(readme, /주간 리뷰/);
  assert.match(readme, /지난주 시간·분 비교 및 오늘 기준 표시/);
  assert.match(readme, /적응형 알림/);
  assert.match(readme, /Three\.js/);
  assert.match(readme, /공부의 숲/);
  assert.match(readme, /최대 2시간/);
  assert.match(readme, /강을 직교해 건너는 다리/);
  assert.match(readme, /진행 방향 양옆 난간과 캐릭터 반경 기반 중앙 통로/);
  assert.match(readme, /잠금 항목은 이름 대신 `\?`/);
  assert.match(readme, /카메라 시작 응답을 15초/);
  assert.match(readme, /Expo 모바일/);
  assert.match(readme, /memory-bank\/prd-/);
});
