import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const sectionSource = readFileSync(new URL("../src/StudyForestSection.tsx", import.meta.url), "utf8");
const componentUrl = new URL("../src/StudyForest3D.tsx", import.meta.url);
const componentSource = existsSync(componentUrl) ? readFileSync(componentUrl, "utf8") : "";

test("study forest page lazy loads its feature section and keeps accessible movement controls", () => {
  assert.match(mainSource, /lazy\(\(\) => import\("\.\/StudyForestSection"\)\)/);
  assert.match(mainSource, /<Suspense/);
  assert.match(mainSource, /<StudyForestSection/);
  assert.match(sectionSource, /<StudyForest3D/);
  assert.match(sectionSource, /completedTreeCount=\{completedTreeCount\}/);
  assert.match(sectionSource, /currentTreeStage=\{forestState\.currentTree\.stage\}/);
  assert.match(sectionSource, /avatar=\{avatar\}/);
  assert.match(sectionSource, /onMoveTarget=\{moveAvatarTo\}/);
  assert.match(sectionSource, /aria-label="[^"]+"/);
  assert.match(sectionSource, /moveAvatar\("ArrowUp"\)/);
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
  assert.match(componentSource, /getForestNavigationPath/);
  assert.match(componentSource, /isForestAvatarPositionWalkable/);
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

test("Study Forest blocks scenery, opens the cottage interior, and previews the next level", () => {
  assert.match(componentSource, /function createCottageInterior/);
  assert.match(componentSource, /cottage-entry-door/);
  assert.match(componentSource, /sceneMode === "interior"/);
  assert.match(componentSource, /onSceneModeChange/);
  assert.match(sectionSource, /getNextForestLevelUpdate/);
  assert.match(sectionSource, /forest-next-level-card/);
  assert.match(sectionSource, /forest-level-roadmap/);
  assert.match(cssSource, /\.forest-next-level-card/);
});

test("cottage movement, facing, rewards, time phases, and customization stay wired", () => {
  assert.match(sectionSource, /interiorAvatar=\{interiorAvatar\}/);
  assert.match(sectionSource, /onInteriorMoveTarget=\{moveInteriorAvatarTo\}/);
  assert.match(sectionSource, /isCottageExitPosition/);
  assert.match(sectionSource, /customization=\{preferences\}/);
  assert.match(sectionSource, /study_forest_preferences/);
  assert.match(componentSource, /interiorTargetToWorldPoint/);
  assert.match(componentSource, /onInteriorMoveTargetRef\.current/);
  assert.doesNotMatch(componentSource, /study-forest-scene-action/);
  assert.match(componentSource, /if \(facing === "left"\) return -Math\.PI \/ 2/);
  assert.match(componentSource, /if \(facing === "right"\) return Math\.PI \/ 2/);
  assert.match(componentSource, /function createCelestialDetails/);
  assert.match(componentSource, /data-time-phase=\{timePhase\}/);
  assert.match(componentSource, /function createFeaturedReward/);
  assert.match(componentSource, /customization\.featuredReward/);
  assert.match(cssSource, /\.forest-interior-unlock/);
  assert.match(cssSource, /\.study-forest-time-badge/);
});