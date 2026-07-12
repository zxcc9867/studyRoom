import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const componentUrl = new URL("../src/StudyForest3D.tsx", import.meta.url);
const componentSource = existsSync(componentUrl) ? readFileSync(componentUrl, "utf8") : "";

test("study forest page mounts the Three.js renderer while keeping accessible movement controls", () => {
  assert.match(mainSource, /lazy\(\(\) =>[\s\S]*import\("\.\/StudyForest3D"\)/);
  assert.match(mainSource, /<Suspense/);
  assert.match(mainSource, /<StudyForest3D/);
  assert.match(mainSource, /completedTreeCount=\{studyForestState\.placedTrees\.length\}/);
  assert.match(mainSource, /currentTreeStage=\{studyForestState\.currentTree\.stage\}/);
  assert.match(mainSource, /avatar=\{forestAvatar\}/);
  assert.match(mainSource, /onMoveTarget=\{moveForestAvatarTo\}/);
  assert.match(mainSource, /aria-label=\{.*3D/);
  assert.match(mainSource, /moveForestAvatar\("ArrowUp"\)/);
  assert.doesNotMatch(mainSource, /className="study-forest-scene"/);
});

test("Three.js scene uses a responsive WebGL renderer with an isometric camera and mobile limits", () => {
  assert.match(componentSource, /import \* as THREE from "three"/);
  assert.match(componentSource, /new THREE\.WebGLRenderer/);
  assert.match(componentSource, /new THREE\.OrthographicCamera/);
  assert.match(componentSource, /renderer\.setAnimationLoop/);
  assert.match(componentSource, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
  assert.match(componentSource, /shadow\.mapSize\.(?:set|width)/);
  assert.match(componentSource, /new ResizeObserver/);
  assert.match(cssSource, /\.study-forest-3d-canvas/);
  assert.match(cssSource, /aspect-ratio:/);
});

test("Three.js scene builds original low-poly island props and an attendance forest", () => {
  for (const builder of [
    "createIsland",
    "createRiver",
    "createBridge",
    "createCottage",
    "createLowPolyTree",
    "createGarden",
    "createLantern",
    "createAvatar",
  ]) {
    assert.match(componentSource, new RegExp("function " + builder));
  }
  assert.match(componentSource, /flatShading:\s*true/);
  assert.match(componentSource, /completedTreeCount/);
  assert.match(componentSource, /currentTreeStage/);
  assert.doesNotMatch(componentSource, /GLTFLoader|TextureLoader|https?:\/\//);
});

test("Three.js scene maps click and touch input to the existing avatar coordinate model", () => {
  assert.match(componentSource, /new THREE\.Raycaster/);
  assert.match(componentSource, /raycaster\.setFromCamera/);
  assert.match(componentSource, /intersectObject\(interactionPlane/);
  assert.match(componentSource, /onMoveTargetRef\.current/);
  assert.match(componentSource, /worldPointToAvatarTarget/);
  assert.match(componentSource, /avatarTargetToWorldPoint/);
});

test("Three.js scene provides fallback, reduced motion, and GPU cleanup", () => {
  assert.match(componentSource, /webglStatus/);
  assert.match(componentSource, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(componentSource, /renderer\.setAnimationLoop\(null\)/);
  assert.match(componentSource, /renderer\.dispose\(\)/);
  assert.match(componentSource, /geometry\.dispose\(\)/);
  assert.match(componentSource, /material\.dispose\(\)/);
  assert.match(componentSource, /resizeObserver\.disconnect\(\)/);
  assert.match(cssSource, /\.study-forest-3d-fallback/);
});
