import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("study forest avatar JSX uses the styled character part classes", () => {
  assert.match(mainSource, /className="forest-avatar-shadow"/);
  assert.match(mainSource, /className="forest-avatar-hair"/);
  assert.match(mainSource, /className="forest-avatar-head"/);
  assert.match(mainSource, /className="forest-avatar-body"/);
  assert.match(mainSource, /className="forest-avatar-leg forest-avatar-leg-left"/);
  assert.match(mainSource, /className="forest-avatar-leg forest-avatar-leg-right"/);
  assert.match(mainSource, /className="forest-avatar-face"/);
  assert.match(mainSource, /className="forest-avatar-arm forest-avatar-arm-left"/);
  assert.match(mainSource, /className="forest-avatar-arm forest-avatar-arm-right"/);
  assert.match(mainSource, /className="forest-avatar-backpack"/);
  assert.doesNotMatch(mainSource, /className="avatar-head"/);
  assert.doesNotMatch(mainSource, /className="avatar-body"/);
  assert.doesNotMatch(mainSource, /className="avatar-shadow"/);
});

test("study forest trees use the styled completed and current tree classes", () => {
  assert.match(mainSource, /forest-tree-2d forest-tree-/);
  assert.match(mainSource, /forest-stage-/);
  assert.match(mainSource, /className="forest-tree-top"/);
  assert.match(mainSource, /className="forest-current-soil"/);
  assert.match(mainSource, /className="forest-current-crown"/);
  assert.match(mainSource, /className="forest-current-trunk"/);
  assert.match(mainSource, /className="forest-current-sparkle forest-current-sparkle-a"/);
  assert.match(mainSource, /className="forest-current-sparkle forest-current-sparkle-b"/);
});

test("study forest scene has 2.5D depth and keeps the avatar above terrain", () => {
  const actorBlock = cssSource.match(/\.forest-tree-2d,\n\.forest-current-tree,\n\.forest-avatar\s*\{[^}]*\}/)?.[0] ?? "";
  const avatarBlock = cssSource.match(/\.forest-stage-wilted \.forest-current-trunk\s*\{[^}]*\}\n\n(?<block>\.forest-avatar\s*\{[^}]*\})/)?.groups?.block ?? "";

  assert.match(cssSource, /\.study-forest-scene\s*\{[\s\S]*perspective:/);
  assert.match(cssSource, /\.forest-ground\s*\{[\s\S]*rotateX/);
  assert.match(cssSource, /\.forest-pond\s*\{[\s\S]*rotateX/);
  assert.match(mainSource, /className="forest-cloud forest-cloud-one"/);
  assert.match(mainSource, /className="forest-flower-patch forest-flower-patch-one"/);
  assert.match(mainSource, /className="forest-cottage"/);
  assert.match(mainSource, /className="forest-fence forest-fence-back"/);
  assert.match(cssSource, /\.study-forest-scene\s*\{[\s\S]*radial-gradient\(circle at 18% 18%/);
  assert.match(cssSource, /\.forest-cottage\s*\{[\s\S]*z-index:\s*4/);
  assert.match(cssSource, /\.forest-flower-patch\s*\{[\s\S]*box-shadow:/);
  assert.match(cssSource, /@keyframes forest-avatar-bob/);
  assert.match(actorBlock, /position:\s*absolute/);
  assert.match(actorBlock, /transform:\s*translate\(-50%, -100%\)/);
  assert.match(avatarBlock, /z-index:\s*(?:1[2-9]|[2-9]\d)/);
  assert.match(avatarBlock, /filter:\s*drop-shadow/);
});
