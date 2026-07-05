import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Vercel production workflow runs a production build before deploy", () => {
  const workflow = readFileSync(".github/workflows/vercel-production.yml", "utf8");
  const testIndex = workflow.indexOf("run: npm test");
  const buildIndex = workflow.indexOf("run: npm run build");
  const deployIndex = workflow.indexOf("vercel deploy --prod");

  assert.ok(testIndex > 0, "workflow should run tests");
  assert.ok(buildIndex > testIndex, "workflow should build after tests");
  assert.ok(deployIndex > buildIndex, "workflow should deploy only after build");
});


test("root build script is cross-platform for Linux CI", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  assert.equal(packageJson.scripts.build, "npm --workspace apps/web run build");
  assert.doesNotMatch(packageJson.scripts.build, /npm\.cmd/);
});
