import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { ForestPreferences } from "./forestCustomization.mjs";

import {
  getForestBlockedReason,
  getForestInteriorRewards,
  getForestNavigationPath,
  getForestTimePhase,
  isCottagePositionWalkable,
  isForestAvatarPositionWalkable,
} from "./studyForest.mjs";
import type {
  StudyForestAvatarFacing,
  StudyForestAvatarPosition,
  StudyForestInteriorRewards,
  StudyForestTimePhase,
  StudyForestTreeStage,
} from "./studyForest.mjs";

type AvatarTarget = Pick<StudyForestAvatarPosition, "x" | "y">;

export type StudyForestSceneMode = "island" | "interior";

type StudyForest3DProps = {
  completedTreeCount: number;
  currentTreeStage: StudyForestTreeStage;
  currentTreeProgressDays: number;
  avatar: StudyForestAvatarPosition & { facing: StudyForestAvatarFacing };
  interiorAvatar: StudyForestAvatarPosition & { facing: StudyForestAvatarFacing };
  sceneMode: StudyForestSceneMode;
  customization: ForestPreferences;
  onMoveTarget: (target: AvatarTarget) => void;
  onInteriorMoveTarget: (target: AvatarTarget) => void;
  onSceneModeChange: (mode: StudyForestSceneMode) => void;
};

type WebglStatus = "loading" | "ready" | "fallback";

const AVATAR_BOUNDS = { minX: 8, maxX: 92, minY: 42, maxY: 84 };
const WORLD_BOUNDS = { minX: -5.35, maxX: 5.35, minZ: -3.5, maxZ: 3.75 };
const INTERIOR_AVATAR_BOUNDS = { minX: 10, maxX: 90, minY: 15, maxY: 90 };
const INTERIOR_WORLD_BOUNDS = { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };
const COMPLETED_TREE_POSITIONS = [
  [-4.7, -2.7],
  [-3.2, -3.55],
  [-1.1, -3.85],
  [1.2, -3.7],
  [3.4, -3.15],
  [4.9, -1.8],
  [-5.15, -0.8],
  [5.2, 0.25],
  [-4.85, 1.65],
  [4.65, 2.3],
  [-3.8, 3.05],
  [2.95, 3.35],
  [-1.55, 3.8],
  [0.55, 3.95],
] as const;

const palette = {
  sky: 0xbfe9f2,
  fog: 0xdff4e8,
  grass: 0x8bcf74,
  grassDark: 0x4f916f,
  soil: 0x986b48,
  sand: 0xe9c978,
  water: 0x73c9dc,
  waterLight: 0xb8edf2,
  path: 0xf0d58a,
  wood: 0x8e5d3c,
  woodLight: 0xc78a52,
  leaf: 0x5cad61,
  leafLight: 0x91d06d,
  cedar: 0x3f8062,
  fruit: 0xf29b4b,
  cream: 0xfff1c2,
  coral: 0xd86f51,
  roof: 0xe77758,
  window: 0x8ed8dc,
  dark: 0x3e352a,
  skin: 0xf6c99e,
  hair: 0x6b4934,
  shirt: 0x69a783,
  gold: 0xf3cf63,
} as const;

const FOREST_THEME_STYLES = {
  spring: {
    sky: 0xbfe9f2, fog: 0xdff4e8, grass: 0x8bcf74, grassDark: 0x4f916f,
    soil: 0x986b48, sand: 0xe9c978, water: 0x73c9dc, waterLight: 0xb8edf2, path: 0xf0d58a,
  },
  harvest: {
    sky: 0xf2d6a2, fog: 0xf5e5bf, grass: 0xc0b45c, grassDark: 0x7f8c4c,
    soil: 0x9f6941, sand: 0xf0d48b, water: 0x79bfd0, waterLight: 0xc2e9e8, path: 0xe9c27a,
  },
  moonlight: {
    sky: 0x667ea6, fog: 0x8295a9, grass: 0x6f9b79, grassDark: 0x405f5d,
    soil: 0x665a58, sand: 0xb8ae83, water: 0x5e8eaa, waterLight: 0x9cc4cf, path: 0xb9ad80,
  },
} as const;

const COTTAGE_ACCENT_COLORS = { mint: 0x69a783, coral: 0xd86f51, honey: 0xd9a441 } as const;

const TIME_ENVIRONMENTS: Record<StudyForestTimePhase, {
  sky: number;
  fog: number;
  hemisphereSky: number;
  hemisphereGround: number;
  sunlight: number;
  sunlightIntensity: number;
  exposure: number;
}> = {
  morning: {
    sky: 0xcdeef2,
    fog: 0xe8f6df,
    hemisphereSky: 0xfff2cf,
    hemisphereGround: 0x66896a,
    sunlight: 0xffd99a,
    sunlightIntensity: 2.7,
    exposure: 1.05,
  },
  afternoon: {
    sky: palette.sky,
    fog: palette.fog,
    hemisphereSky: 0xe7fbff,
    hemisphereGround: 0x5d7656,
    sunlight: 0xfff3cf,
    sunlightIntensity: 3.2,
    exposure: 1.04,
  },
  sunset: {
    sky: 0xf3b49e,
    fog: 0xf5d2ae,
    hemisphereSky: 0xffcfad,
    hemisphereGround: 0x70566f,
    sunlight: 0xff9b62,
    sunlightIntensity: 2.25,
    exposure: 0.98,
  },
  night: {
    sky: 0x263b66,
    fog: 0x405375,
    hemisphereSky: 0x718dc4,
    hemisphereGround: 0x253b38,
    sunlight: 0xa8bbff,
    sunlightIntensity: 1.25,
    exposure: 0.83,
  },
};

const TIME_PHASE_LABELS: Record<StudyForestTimePhase, string> = {
  morning: "\uC544\uCE68",
  afternoon: "\uB0AE",
  sunset: "\uD574\uC9C8\uB158",
  night: "\uBC24",
};

export function avatarTargetToWorldPoint(target: AvatarTarget) {
  const xRatio = (target.x - AVATAR_BOUNDS.minX) / (AVATAR_BOUNDS.maxX - AVATAR_BOUNDS.minX);
  const yRatio = (target.y - AVATAR_BOUNDS.minY) / (AVATAR_BOUNDS.maxY - AVATAR_BOUNDS.minY);
  return new THREE.Vector3(
    THREE.MathUtils.lerp(WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX, THREE.MathUtils.clamp(xRatio, 0, 1)),
    0.38,
    THREE.MathUtils.lerp(WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ, THREE.MathUtils.clamp(yRatio, 0, 1)),
  );
}

export function worldPointToAvatarTarget(point: THREE.Vector3): AvatarTarget {
  const xRatio = (point.x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
  const zRatio = (point.z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
  return {
    x: Math.round(
      THREE.MathUtils.lerp(AVATAR_BOUNDS.minX, AVATAR_BOUNDS.maxX, THREE.MathUtils.clamp(xRatio, 0, 1)) * 10,
    ) / 10,
    y: Math.round(
      THREE.MathUtils.lerp(AVATAR_BOUNDS.minY, AVATAR_BOUNDS.maxY, THREE.MathUtils.clamp(zRatio, 0, 1)) * 10,
    ) / 10,
  };
}

export function interiorTargetToWorldPoint(target: AvatarTarget) {
  const xRatio = (target.x - INTERIOR_AVATAR_BOUNDS.minX)
    / (INTERIOR_AVATAR_BOUNDS.maxX - INTERIOR_AVATAR_BOUNDS.minX);
  const yRatio = (target.y - INTERIOR_AVATAR_BOUNDS.minY)
    / (INTERIOR_AVATAR_BOUNDS.maxY - INTERIOR_AVATAR_BOUNDS.minY);
  return new THREE.Vector3(
    THREE.MathUtils.lerp(
      INTERIOR_WORLD_BOUNDS.minX,
      INTERIOR_WORLD_BOUNDS.maxX,
      THREE.MathUtils.clamp(xRatio, 0, 1),
    ),
    0.18,
    THREE.MathUtils.lerp(
      INTERIOR_WORLD_BOUNDS.minZ,
      INTERIOR_WORLD_BOUNDS.maxZ,
      THREE.MathUtils.clamp(yRatio, 0, 1),
    ),
  );
}

export function worldPointToInteriorTarget(point: THREE.Vector3): AvatarTarget {
  const xRatio = (point.x - INTERIOR_WORLD_BOUNDS.minX)
    / (INTERIOR_WORLD_BOUNDS.maxX - INTERIOR_WORLD_BOUNDS.minX);
  const zRatio = (point.z - INTERIOR_WORLD_BOUNDS.minZ)
    / (INTERIOR_WORLD_BOUNDS.maxZ - INTERIOR_WORLD_BOUNDS.minZ);
  return {
    x: Math.round(
      THREE.MathUtils.lerp(
        INTERIOR_AVATAR_BOUNDS.minX,
        INTERIOR_AVATAR_BOUNDS.maxX,
        THREE.MathUtils.clamp(xRatio, 0, 1),
      ) * 10,
    ) / 10,
    y: Math.round(
      THREE.MathUtils.lerp(
        INTERIOR_AVATAR_BOUNDS.minY,
        INTERIOR_AVATAR_BOUNDS.maxY,
        THREE.MathUtils.clamp(zRatio, 0, 1),
      ) * 10,
    ) / 10,
  };
}

function standardMaterial(
  color: number,
  options: Omit<THREE.MeshStandardMaterialParameters, "color"> = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0,
    flatShading: true,
    ...options,
  });
}

function enableShadows(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createIsland(scene: THREE.Scene, theme: (typeof FOREST_THEME_STYLES)[keyof typeof FOREST_THEME_STYLES]) {
  const island = new THREE.Group();
  island.name = "low-poly-study-island";

  const earth = new THREE.Mesh(
    new THREE.CylinderGeometry(7.15, 6.1, 1.5, 14),
    standardMaterial(theme.soil),
  );
  earth.position.y = -0.7;
  earth.receiveShadow = true;
  island.add(earth);

  const sand = new THREE.Mesh(
    new THREE.CylinderGeometry(7.25, 7.08, 0.34, 14),
    standardMaterial(theme.sand),
  );
  sand.position.y = -0.06;
  sand.receiveShadow = true;
  island.add(sand);

  const meadow = new THREE.Mesh(
    new THREE.CylinderGeometry(6.78, 6.95, 0.48, 14),
    standardMaterial(theme.grass),
  );
  meadow.position.y = 0.2;
  meadow.receiveShadow = true;
  island.add(meadow);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(6.82, 0.1, 5, 14),
    standardMaterial(theme.grassDark),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.47;
  island.add(rim);

  const pathMaterial = standardMaterial(theme.path);
  const pathPoints = [
    [-2.8, 2.9],
    [-2.1, 2.2],
    [-1.25, 1.55],
    [-0.25, 0.9],
    [0.65, 0.1],
    [1.35, -0.85],
    [2.2, -1.8],
  ];
  for (const [x, z] of pathPoints) {
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.08, 8), pathMaterial);
    stone.position.set(x, 0.5, z);
    stone.scale.z = 0.72;
    stone.receiveShadow = true;
    island.add(stone);
  }

  scene.add(island);
  return island;
}

function createRiver(scene: THREE.Scene, theme: (typeof FOREST_THEME_STYLES)[keyof typeof FOREST_THEME_STYLES]) {
  const river = new THREE.Group();
  river.name = "river";

  const waterMaterial = standardMaterial(theme.water, {
    roughness: 0.26,
    emissive: new THREE.Color(0x2f91a4),
    emissiveIntensity: 0.12,
  });
  const sections = [
    { x: -4.4, z: 0.8, width: 3.4, angle: -0.08 },
    { x: -1.45, z: 0.62, width: 3.1, angle: 0.04 },
    { x: 1.35, z: 0.76, width: 3.0, angle: -0.02 },
    { x: 4.15, z: 1.04, width: 3.1, angle: 0.12 },
  ];
  for (const section of sections) {
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(section.width, 0.09, 1.36),
      waterMaterial,
    );
    water.position.set(section.x, 0.51, section.z);
    water.rotation.y = section.angle;
    water.receiveShadow = true;
    river.add(water);
  }

  const sparkle = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 0.015, 0.08),
    new THREE.MeshBasicMaterial({ color: theme.waterLight, transparent: true, opacity: 0.72 }),
  );
  sparkle.position.set(-0.2, 0.57, 0.65);
  sparkle.rotation.y = 0.02;
  river.add(sparkle);

  scene.add(river);
  return river;
}

function createBridge(scene: THREE.Scene) {
  const bridge = new THREE.Group();
  bridge.name = "wooden-bridge";
  bridge.position.set(0.65, 0.68, 0.72);

  const plankMaterial = standardMaterial(palette.woodLight);
  for (let index = -4; index <= 4; index += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 2.15), plankMaterial);
    plank.position.x = index * 0.38;
    plank.position.y = Math.cos((index / 4) * Math.PI) * 0.14;
    plank.rotation.z = -Math.sin((index / 4) * Math.PI) * 0.04;
    bridge.add(plank);
  }

  const railMaterial = standardMaterial(palette.wood);
  for (const x of [-1.78, 1.78]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.15), railMaterial);
    rail.position.set(x, 0.68, 0);
    bridge.add(rail);
    for (const z of [-0.92, -0.46, 0, 0.46, 0.92]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.75, 6), railMaterial);
      post.position.set(x, 0.35, z);
      bridge.add(post);
    }
  }

  enableShadows(bridge);
  scene.add(bridge);
  return bridge;
}

function createCottage(scene: THREE.Scene, accentColor: number) {
  const cottage = new THREE.Group();
  cottage.name = "study-cottage";
  cottage.position.set(-3.55, 0.54, -2.25);
  cottage.rotation.y = 0.12;

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 1.7, 2.05),
    standardMaterial(palette.cream),
  );
  walls.position.y = 0.86;
  cottage.add(walls);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 1.35, 4),
    standardMaterial(accentColor),
  );
  roof.position.y = 2.05;
  roof.rotation.y = Math.PI / 4;
  cottage.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.08, 0.1),
    standardMaterial(palette.wood),
  );
  door.name = "cottage-entry-door";
  door.position.set(0.35, 0.55, 1.07);
  cottage.add(door);

  for (const x of [-0.66, 0.88]) {
    const windowFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.5, 0.08),
      standardMaterial(palette.window, { emissive: new THREE.Color(0x4b8d92), emissiveIntensity: 0.2 }),
    );
    windowFrame.position.set(x, 1.05, 1.075);
    cottage.add(windowFrame);
  }

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.9, 0.34),
    standardMaterial(palette.wood),
  );
  chimney.position.set(-0.72, 2.15, -0.35);
  cottage.add(chimney);

  enableShadows(cottage);
  scene.add(cottage);
  return { cottage, door };
}

function createCottageInterior(
  scene: THREE.Scene,
  rewards: StudyForestInteriorRewards,
  timePhase: StudyForestTimePhase,
  accentColor: number,
) {
  const room = new THREE.Group();
  room.name = "cozy-study-cottage-interior";

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(9.4, 0.3, 7.2),
    standardMaterial(0xc9905a),
  );
  floor.position.y = -0.08;
  floor.receiveShadow = true;
  room.add(floor);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(9.4, 3.6, 0.26),
    standardMaterial(0xffedc7),
  );
  backWall.position.set(0, 1.72, -3.45);
  room.add(backWall);

  const sideWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 3.6, 7.2),
    standardMaterial(0xf7dcae),
  );
  sideWall.position.set(-4.55, 1.72, 0);
  room.add(sideWall);

  if (rewards.rug) {
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.72, 16),
    standardMaterial(accentColor),
  );
  rug.name = "cottage-reading-rug";
  rug.rotation.x = -Math.PI / 2;
  rug.scale.z = 0.72;
  rug.position.set(0.2, 0.09, 0.45);
  room.add(rug);
  }

  const windowGlow = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.45, 0.08),
    standardMaterial(palette.window, {
      emissive: new THREE.Color(timePhase === "night" ? 0x8fb8e8 : 0x6dc7d2),
      emissiveIntensity: timePhase === "night" ? 0.28 : 0.48,
    }),
  );
  windowGlow.position.set(-1.35, 2.15, -3.28);
  room.add(windowGlow);
  for (const offset of [-0.52, 0.52]) {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(offset === -0.52 ? 0.08 : 2.25, offset === -0.52 ? 1.5 : 0.08, 0.09),
      standardMaterial(palette.wood),
    );
    frame.position.set(-1.35, 2.15 + (offset === -0.52 ? 0 : offset), -3.22);
    room.add(frame);
  }

  const desk = new THREE.Group();
  desk.name = "cottage-study-desk";
  desk.position.set(-2.25, 0.15, -1.65);
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.18, 1.15), standardMaterial(palette.woodLight));
  deskTop.position.y = 1.12;
  desk.add(deskTop);
  for (const x of [-1.05, 1.05]) {
    for (const z of [-0.4, 0.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.08, 0.14), standardMaterial(palette.wood));
      leg.position.set(x, 0.55, z);
      desk.add(leg);
    }
  }
  const notebook = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.68), standardMaterial(0xfff8df));
  notebook.position.set(0.2, 1.24, 0);
  notebook.rotation.y = -0.12;
  desk.add(notebook);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.28, 8), standardMaterial(accentColor));
  mug.position.set(-0.72, 1.37, -0.2);
  desk.add(mug);
  room.add(desk);

  const chair = new THREE.Group();
  chair.name = "cottage-study-chair";
  chair.position.set(-2.05, 0.15, 0.05);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, 1.0), standardMaterial(palette.shirt));
  seat.position.y = 0.72;
  chair.add(seat);
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.2, 0.14), standardMaterial(palette.shirt));
  chairBack.position.set(0, 1.25, 0.44);
  chair.add(chairBack);
  room.add(chair);

  if (rewards.bookshelf) {
  const shelf = new THREE.Group();
  shelf.name = "cottage-bookshelf";
  shelf.position.set(3.15, 0.1, -2.68);
  for (const x of [-1.05, 1.05]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.75, 0.65), standardMaterial(palette.wood));
    side.position.set(x, 1.38, 0);
    shelf.add(side);
  }
  for (const y of [0.15, 0.98, 1.8, 2.65]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.14, 0.7), standardMaterial(palette.woodLight));
    board.position.y = y;
    shelf.add(board);
  }
  const bookColors = [palette.coral, palette.gold, palette.shirt, 0x7ca7c8];
  for (let index = 0; index < 12; index += 1) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.14 + (index % 2) * 0.04, 0.5 + (index % 3) * 0.07, 0.48),
      standardMaterial(bookColors[index % bookColors.length]),
    );
    book.position.set(-0.84 + (index % 6) * 0.33, index < 6 ? 0.47 : 1.3, 0);
    shelf.add(book);
  }
  room.add(shelf);
  }

  if (rewards.readingLamp) {
  const readingLamp = new THREE.Group();
  readingLamp.name = "cottage-reading-lamp";
  readingLamp.position.set(1.65, 0.15, 1.65);
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.65, 7), standardMaterial(palette.wood));
  lampPost.position.y = 0.82;
  readingLamp.add(lampPost);
  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.46, 0.58, 8, 1, true),
    standardMaterial(palette.gold, { side: THREE.DoubleSide }),
  );
  lampShade.position.y = 1.72;
  readingLamp.add(lampShade);
  const lampLight = new THREE.PointLight(0xffd37d, 4.5, 7, 2);
  lampLight.position.y = 1.52;
  readingLamp.add(lampLight);
  room.add(readingLamp);
  }

  if (rewards.plant) {
  const plant = new THREE.Group();
  plant.name = "cottage-houseplant";
  plant.position.set(3.55, 0.12, 1.85);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.62, 8), standardMaterial(accentColor));
  pot.position.y = 0.3;
  plant.add(pot);
  for (const rotation of [-0.7, 0, 0.7]) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 6), standardMaterial(palette.leaf));
    leaf.position.set(Math.sin(rotation) * 0.28, 0.95, Math.cos(rotation) * 0.16);
    leaf.rotation.z = rotation * 0.35;
    plant.add(leaf);
  }
  room.add(plant);
  }

  if (rewards.wallClock) {
    const wallClock = new THREE.Group();
    wallClock.name = "cottage-wall-clock";
    wallClock.position.set(1.1, 2.25, -3.25);
    const clockFace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.1, 12),
      standardMaterial(0xfff4d4),
    );
    clockFace.rotation.x = Math.PI / 2;
    wallClock.add(clockFace);
    for (const [length, rotation] of [[0.23, -0.35], [0.17, 0.95]] as const) {
      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, length, 0.025),
        standardMaterial(palette.dark),
      );
      hand.position.set(Math.sin(rotation) * length * 0.45, Math.cos(rotation) * length * 0.45, 0.08);
      hand.rotation.z = -rotation;
      wallClock.add(hand);
    }
    room.add(wallClock);
  }

  if (rewards.trophy) {
    const trophy = new THREE.Group();
    trophy.name = "cottage-attendance-trophy";
    trophy.position.set(2.65, 0.14, -1.55);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.48), standardMaterial(palette.wood));
    base.position.y = 0.09;
    trophy.add(base);
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.16, 0.48, 8),
      standardMaterial(palette.gold, { metalness: 0.3, roughness: 0.48 }),
    );
    cup.position.y = 0.42;
    trophy.add(cup);
    const trophyLight = new THREE.PointLight(0xffd675, timePhase === "night" ? 1.8 : 0.6, 3);
    trophyLight.position.y = 0.75;
    trophy.add(trophyLight);
    room.add(trophy);
  }

  enableShadows(room);
  scene.add(room);
  return room;
}

function createLowPolyTree(
  variant: number,
  scale = 1,
  stage: StudyForestTreeStage = "complete",
) {
  const tree = new THREE.Group();
  tree.name = stage === "complete" ? "completed-attendance-tree" : "current-attendance-tree";

  const stageScale: Record<StudyForestTreeStage, number> = {
    seed: 0.16,
    sprout: 0.34,
    young: 0.62,
    leafy: 0.86,
    complete: 1,
    wilted: 0.72,
  };
  const resolvedScale = scale * stageScale[stage];

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.27, 1.55, 6),
    standardMaterial(stage === "wilted" ? 0x80634d : palette.wood),
  );
  trunk.position.y = 0.78;
  tree.add(trunk);

  if (stage === "seed") {
    const seed = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      standardMaterial(palette.soil),
    );
    seed.position.y = 0.18;
    tree.add(seed);
  } else {
    const leafColors = [palette.leaf, palette.leafLight, palette.cedar];
    const leafColor = stage === "wilted" ? 0xa79569 : leafColors[variant % leafColors.length];
    const crown = new THREE.Mesh(
      variant % 3 === 2
        ? new THREE.ConeGeometry(0.96, 1.72, 7)
        : new THREE.IcosahedronGeometry(0.9, 1),
      standardMaterial(leafColor),
    );
    crown.position.y = stage === "wilted" ? 1.55 : 1.75;
    crown.rotation.z = stage === "wilted" ? 0.2 : 0;
    tree.add(crown);

    if (variant % 3 !== 2 && stage !== "wilted" && stage !== "sprout") {
      for (const [x, y, z] of [
        [-0.42, 1.92, 0.62],
        [0.5, 1.67, 0.5],
        [0.08, 2.25, 0.63],
      ]) {
        const fruit = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.13, 0),
          standardMaterial(variant % 2 === 0 ? palette.fruit : palette.gold),
        );
        fruit.position.set(x, y, z);
        tree.add(fruit);
      }
    }
  }

  tree.scale.setScalar(resolvedScale);
  enableShadows(tree);
  return tree;
}

function createGarden(scene: THREE.Scene) {
  const garden = new THREE.Group();
  garden.name = "flower-garden";
  garden.position.set(3.75, 0.52, -2.15);
  garden.rotation.y = -0.08;

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, 0.16, 1.25),
    standardMaterial(0x8b6044),
  );
  garden.add(bed);

  const stemMaterial = standardMaterial(palette.grassDark);
  const bloomColors = [palette.coral, palette.gold, 0xf5a6a2, 0xffffff];
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const x = -1.05 + column * 0.42;
      const z = -0.32 + row * 0.64;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 5), stemMaterial);
      stem.position.set(x, 0.24, z);
      garden.add(stem);
      const bloom = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.1, 0),
        standardMaterial(bloomColors[(column + row) % bloomColors.length]),
      );
      bloom.position.set(x, 0.43, z);
      garden.add(bloom);
    }
  }

  enableShadows(garden);
  scene.add(garden);
  return garden;
}

function createFeaturedReward(scene: THREE.Scene, reward: ForestPreferences["featuredReward"], accentColor: number) {
  if (reward === "none") return null;
  const group = new THREE.Group();
  group.name = `forest-featured-reward-${reward}`;
  group.position.set(4.7, 0.55, -2.75);

  if (reward === "birdhouse") {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.75, 7), standardMaterial(palette.wood));
    post.position.y = 0.82;
    group.add(post);
    const house = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.7), standardMaterial(accentColor));
    house.position.y = 1.78;
    group.add(house);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.48, 4), standardMaterial(palette.cream));
    roof.position.y = 2.22;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    const opening = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10), standardMaterial(palette.dark));
    opening.rotation.x = Math.PI / 2;
    opening.position.set(0, 1.82, 0.37);
    group.add(opening);
  }

  if (reward === "picnic") {
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 1.45), standardMaterial(accentColor));
    blanket.position.y = 0.05;
    group.add(blanket);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.56), standardMaterial(palette.woodLight));
    basket.position.set(0.48, 0.3, 0.14);
    group.add(basket);
    for (const offset of [-0.45, 0]) {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.62), standardMaterial(offset < 0 ? palette.cream : palette.gold));
      book.position.set(offset, 0.15, -0.2);
      book.rotation.y = offset * 0.3;
      group.add(book);
    }
  }

  if (reward === "campfire") {
    for (const rotation of [-0.7, 0.7]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.35, 7), standardMaterial(palette.wood));
      log.rotation.z = Math.PI / 2;
      log.rotation.y = rotation;
      log.position.y = 0.18;
      group.add(log);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.0, 7),
      standardMaterial(palette.gold, { emissive: new THREE.Color(0xff7b3c), emissiveIntensity: 0.85 }),
    );
    flame.name = "forest-campfire-flame";
    flame.position.y = 0.78;
    group.add(flame);
    const glow = new THREE.PointLight(0xff914d, 4.2, 6, 2);
    glow.position.y = 1.15;
    group.add(glow);
  }

  enableShadows(group);
  scene.add(group);
  return group;
}

function createLantern(scene: THREE.Scene, x: number, z: number) {
  const lantern = new THREE.Group();
  lantern.name = "warm-lantern";
  lantern.position.set(x, 0.54, z);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.08, 1.18, 6),
    standardMaterial(palette.wood),
  );
  post.position.y = 0.59;
  lantern.add(post);

  const light = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    standardMaterial(palette.gold, {
      emissive: new THREE.Color(palette.gold),
      emissiveIntensity: 0.55,
    }),
  );
  light.position.y = 1.26;
  lantern.add(light);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.2, 6),
    standardMaterial(palette.dark),
  );
  cap.position.y = 1.48;
  lantern.add(cap);

  enableShadows(lantern);
  scene.add(lantern);
  return lantern;
}

function createAvatar() {
  const avatar = new THREE.Group();
  avatar.name = "smiling-study-avatar";

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 16),
    new THREE.MeshBasicMaterial({ color: 0x315844, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  avatar.add(shadow);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.48, 0.9, 8),
    standardMaterial(palette.shirt),
  );
  body.position.y = 0.72;
  avatar.add(body);

  const head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.48, 2),
    standardMaterial(palette.skin),
  );
  head.position.y = 1.47;
  avatar.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2),
    standardMaterial(palette.hair),
  );
  hair.position.y = 1.62;
  hair.rotation.x = -0.08;
  avatar.add(hair);

  for (const x of [-0.17, 0.17]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 6, 4),
      new THREE.MeshBasicMaterial({ color: palette.dark }),
    );
    eye.position.set(x, 1.51, 0.445);
    avatar.add(eye);
  }

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.018, 4, 10, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x9b4d43 }),
  );
  smile.position.set(0, 1.37, 0.46);
  smile.rotation.z = Math.PI;
  avatar.add(smile);

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.64, 0.24),
    standardMaterial(palette.coral),
  );
  backpack.position.set(0, 0.82, -0.43);
  avatar.add(backpack);

  for (const x of [-0.22, 0.22]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.34),
      standardMaterial(palette.dark),
    );
    foot.position.set(x, 0.16, 0.08);
    avatar.add(foot);
  }

  enableShadows(avatar);
  return avatar;
}

function createFireflies(scene: THREE.Scene) {
  const fireflies = new THREE.Group();
  fireflies.name = "fireflies";
  const material = new THREE.MeshBasicMaterial({ color: 0xfff09b });
  const positions = [
    [-4.2, 1.7, -0.5],
    [-2.8, 1.25, 2.2],
    [-0.8, 1.65, -2.5],
    [1.4, 1.4, 2.65],
    [3.1, 1.8, -1.25],
    [4.5, 1.25, 1.75],
    [0.15, 2.1, 3.25],
    [2.35, 1.15, 0.05],
  ];
  for (const [x, y, z] of positions) {
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), material);
    glow.position.set(x, y, z);
    fireflies.add(glow);
  }
  scene.add(fireflies);
  return fireflies;
}

function createCelestialDetails(scene: THREE.Scene, timePhase: StudyForestTimePhase) {
  const celestial = new THREE.Group();
  celestial.name = "forest-celestial-details";
  const isNight = timePhase === "night";
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(isNight ? 0.46 : 0.58, 12, 8),
    new THREE.MeshBasicMaterial({ color: isNight ? 0xe8efff : 0xffdc79 }),
  );
  orb.name = isNight ? "forest-moon" : "forest-sun";
  orb.position.set(
    timePhase === "morning" ? -5.7 : timePhase === "sunset" ? 5.5 : 3.8,
    timePhase === "afternoon" ? 7.6 : 5.8,
    -7.5,
  );
  celestial.add(orb);

  if (isNight) {
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xfff5c9 });
    const starPositions = [
      [-5.8, 6.9, -8.2],
      [-3.9, 7.7, -8.5],
      [-1.2, 6.5, -8.1],
      [1.4, 7.4, -8.6],
      [4.9, 6.8, -8.2],
      [6.1, 8.1, -8.8],
    ];
    for (const [x, y, z] of starPositions) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), starMaterial);
      star.position.set(x, y, z);
      celestial.add(star);
    }
  }

  scene.add(celestial);
  return celestial;
}

function facingRotation(facing: StudyForestAvatarFacing) {
  if (facing === "up") return Math.PI;
  if (facing === "left") return -Math.PI / 2;
  if (facing === "right") return Math.PI / 2;
  return 0;
}

export function StudyForest3D({
  completedTreeCount,
  currentTreeStage,
  currentTreeProgressDays,
  avatar,
  interiorAvatar,
  sceneMode,
  customization,
  onMoveTarget,
  onInteriorMoveTarget,
  onSceneModeChange,
}: StudyForest3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarTargetRef = useRef(avatarTargetToWorldPoint(avatar));
  const avatarWorldRef = useRef(avatarTargetToWorldPoint(avatar));
  const avatarPathRef = useRef<THREE.Vector3[]>([]);
  const avatarFacingRef = useRef<StudyForestAvatarFacing>(avatar.facing);
  const interiorAvatarTargetRef = useRef(interiorTargetToWorldPoint(interiorAvatar));
  const interiorAvatarWorldRef = useRef(interiorTargetToWorldPoint(interiorAvatar));
  const interiorAvatarFacingRef = useRef<StudyForestAvatarFacing>(interiorAvatar.facing);
  const onMoveTargetRef = useRef(onMoveTarget);
  const onInteriorMoveTargetRef = useRef(onInteriorMoveTarget);
  const onSceneModeChangeRef = useRef(onSceneModeChange);
  const [webglStatus, setWebglStatus] = useState<WebglStatus>("loading");
  const [interactionMessage, setInteractionMessage] = useState("");
  const [timePhase, setTimePhase] = useState<StudyForestTimePhase>(() =>
    getForestTimePhase(new Date().getHours()),
  );

  useEffect(() => {
    avatarTargetRef.current = avatarTargetToWorldPoint(avatar);
    avatarPathRef.current = getForestNavigationPath(
      worldPointToAvatarTarget(avatarWorldRef.current),
      avatar,
    ).map(avatarTargetToWorldPoint);
    avatarFacingRef.current = avatar.facing;
  }, [avatar]);

  useEffect(() => {
    interiorAvatarTargetRef.current = interiorTargetToWorldPoint(interiorAvatar);
    interiorAvatarFacingRef.current = interiorAvatar.facing;
  }, [interiorAvatar]);

  useEffect(() => {
    onMoveTargetRef.current = onMoveTarget;
    onInteriorMoveTargetRef.current = onInteriorMoveTarget;
    onSceneModeChangeRef.current = onSceneModeChange;
  }, [onInteriorMoveTarget, onMoveTarget, onSceneModeChange]);

  useEffect(() => {
    const updateTimePhase = () => setTimePhase(getForestTimePhase(new Date().getHours()));
    const timer = window.setInterval(updateTimePhase, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const environment = TIME_ENVIRONMENTS[timePhase];
    const interiorRewards = getForestInteriorRewards(currentTreeProgressDays, completedTreeCount);
    const themeStyle = FOREST_THEME_STYLES[customization.islandTheme];
    const accentColor = COTTAGE_ACCENT_COLORS[customization.cottageAccent];
    const themedSky = new THREE.Color(environment.sky).lerp(new THREE.Color(themeStyle.sky), 0.36).getHex();
    const themedFog = new THREE.Color(environment.fog).lerp(new THREE.Color(themeStyle.fog), 0.3).getHex();
    const sceneBackground = sceneMode === "interior"
      ? (timePhase === "night" ? 0x5d5268 : timePhase === "sunset" ? 0xe9b58f : 0xffe8bd)
      : themedSky;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglStatus("fallback");
      return;
    }

    setWebglStatus("ready");
    renderer.domElement.className = "study-forest-3d-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.setClearColor(sceneBackground, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = sceneMode === "interior"
      ? (timePhase === "night" ? 0.86 : 1.04)
      : environment.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(sceneBackground);
    scene.fog = sceneMode === "interior" ? null : new THREE.Fog(themedFog, 14, 28);

    const camera = new THREE.OrthographicCamera(-8, 8, 5.5, -5.5, 0.1, 60);
    if (sceneMode === "interior") {
      camera.position.set(9.4, 8.2, 10.8);
      camera.lookAt(0, 0.85, -0.45);
    } else {
      camera.position.set(11.5, 11.2, 13.8);
      camera.lookAt(0, 0.6, 0);
    }

    const hemisphere = new THREE.HemisphereLight(
      sceneMode === "interior" ? (timePhase === "night" ? 0x8395bd : 0xfff7df) : environment.hemisphereSky,
      sceneMode === "interior" ? 0x6d5544 : environment.hemisphereGround,
      sceneMode === "interior" ? (timePhase === "night" ? 1.45 : 2.7) : 2.25,
    );
    scene.add(hemisphere);

    const sunlight = new THREE.DirectionalLight(
      sceneMode === "interior" ? (timePhase === "night" ? 0xaec3ff : 0xffdca0) : environment.sunlight,
      sceneMode === "interior" ? (timePhase === "night" ? 1.2 : 2.4) : environment.sunlightIntensity,
    );
    sunlight.position.set(-7, 13, 8);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.width = 1024;
    sunlight.shadow.mapSize.height = 1024;
    sunlight.shadow.camera.left = -10;
    sunlight.shadow.camera.right = 10;
    sunlight.shadow.camera.top = 10;
    sunlight.shadow.camera.bottom = -10;
    sunlight.shadow.camera.near = 1;
    sunlight.shadow.camera.far = 35;
    sunlight.shadow.bias = -0.0008;
    scene.add(sunlight);

    let river: THREE.Group | null = null;
    let currentTree: THREE.Group | null = null;
    let cottageDoor: THREE.Mesh | null = null;
    let interactionPlane: THREE.Mesh | null = null;
    let fireflies: THREE.Group | null = null;
    const avatarGroup = createAvatar();

    if (sceneMode === "island") {
      createCelestialDetails(scene, timePhase);
      createIsland(scene, themeStyle);
      river = createRiver(scene, themeStyle);
      createBridge(scene);
      const cottage = createCottage(scene, accentColor);
      cottageDoor = cottage.door;
      createGarden(scene);
      createFeaturedReward(scene, customization.featuredReward, accentColor);
      createLantern(scene, -1.8, -1.25);
      createLantern(scene, 2.25, 2.15);
      if (timePhase === "sunset" || timePhase === "night") {
        fireflies = createFireflies(scene);
      }

      const visibleCompletedTrees = Math.min(completedTreeCount, 28);
      for (let index = 0; index < visibleCompletedTrees; index += 1) {
        const base = COMPLETED_TREE_POSITIONS[index % COMPLETED_TREE_POSITIONS.length];
        const ring = Math.floor(index / COMPLETED_TREE_POSITIONS.length);
        const tree = createLowPolyTree(index, Math.max(0.58, 0.92 - ring * 0.12));
        tree.position.set(base[0] * (1 - ring * 0.11), 0.48, base[1] * (1 - ring * 0.1));
        tree.rotation.y = (index * 1.7) % (Math.PI * 2);
        scene.add(tree);
      }

      currentTree = createLowPolyTree(
        currentTreeProgressDays,
        1.08,
        currentTreeStage,
      );
      currentTree.position.set(3.15, 0.48, -1.2);
      scene.add(currentTree);

      avatarGroup.position.copy(avatarWorldRef.current);
      avatarGroup.rotation.y = facingRotation(avatarFacingRef.current);

      interactionPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(12.2, 8.4),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      interactionPlane.name = "avatar-interaction-plane";
      interactionPlane.rotation.x = -Math.PI / 2;
      interactionPlane.position.y = 0.56;
      scene.add(interactionPlane);
    } else {
      createCottageInterior(scene, interiorRewards, timePhase, accentColor);
      avatarGroup.scale.setScalar(0.84);
      avatarGroup.position.copy(interiorAvatarWorldRef.current);
      avatarGroup.rotation.y = facingRotation(interiorAvatarFacingRef.current);

      interactionPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(8.2, 6.2),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      interactionPlane.name = "interior-interaction-plane";
      interactionPlane.rotation.x = -Math.PI / 2;
      interactionPlane.position.y = 0.2;
      scene.add(interactionPlane);
    }
    scene.add(avatarGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!interactionPlane) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);

      if (sceneMode === "island" && cottageDoor && raycaster.intersectObject(cottageDoor, false)[0]) {
        setInteractionMessage("");
        onSceneModeChangeRef.current("interior");
        return;
      }

      const intersection = raycaster.intersectObject(interactionPlane)[0];
      if (!intersection) return;

      if (sceneMode === "interior") {
        const interiorTarget = worldPointToInteriorTarget(intersection.point);
        if (!isCottagePositionWalkable(interiorTarget, {}, interiorRewards)) {
          setInteractionMessage("\uAC00\uAD6C\uAC00 \uC788\uB294 \uACF3\uC740 \uC9C0\uB098\uAC08 \uC218 \uC5C6\uC5B4\uC694.");
          return;
        }
        setInteractionMessage("");
        onInteriorMoveTargetRef.current(interiorTarget);
        return;
      }

      const target = worldPointToAvatarTarget(intersection.point);
      if (!isForestAvatarPositionWalkable(target)) {
        const reason = getForestBlockedReason(target);
        setInteractionMessage(
          reason === "water"
            ? "\uBB3C\uC5D0\uB294 \uB4E4\uC5B4\uAC08 \uC218 \uC5C6\uC5B4\uC694. \uB2E4\uB9AC\uB97C \uC774\uC6A9\uD574 \uC8FC\uC138\uC694."
            : "\uC774 \uACF3\uC740 \uC9C0\uB098\uAC08 \uC218 \uC5C6\uC5B4\uC694. \uC8FC\uBCC0 \uAE38\uB85C \uC774\uB3D9\uD574 \uC8FC\uC138\uC694.",
        );
        return;
      }

      setInteractionMessage("");
      onMoveTargetRef.current(target);
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const aspect = width / height;
      const viewHeight = 10.8;
      camera.left = -(viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const elapsed = clock.getElapsedTime();

      if (sceneMode === "island") {
        const pathTarget = avatarPathRef.current[0] ?? avatarTargetRef.current;
        avatarGroup.position.x = THREE.MathUtils.lerp(avatarGroup.position.x, pathTarget.x, 0.075);
        avatarGroup.position.z = THREE.MathUtils.lerp(avatarGroup.position.z, pathTarget.z, 0.075);
        avatarGroup.position.y = pathTarget.y + (prefersReducedMotion ? 0 : Math.sin(elapsed * 4.2) * 0.045);
        avatarWorldRef.current.set(avatarGroup.position.x, 0.38, avatarGroup.position.z);

        const dx = pathTarget.x - avatarGroup.position.x;
        const dz = pathTarget.z - avatarGroup.position.z;
        const movingRotation = Math.abs(dx) > Math.abs(dz)
          ? (dx < 0 ? -Math.PI / 2 : Math.PI / 2)
          : (dz < 0 ? Math.PI : 0);
        avatarGroup.rotation.y = THREE.MathUtils.lerp(
          avatarGroup.rotation.y,
          Math.hypot(dx, dz) > 0.08 ? movingRotation : facingRotation(avatarFacingRef.current),
          0.16,
        );

        if (Math.hypot(dx, dz) < 0.075 && avatarPathRef.current.length > 0) {
          avatarPathRef.current.shift();
        }
      } else {
        const interiorTarget = interiorAvatarTargetRef.current;
        avatarGroup.position.x = THREE.MathUtils.lerp(avatarGroup.position.x, interiorTarget.x, 0.11);
        avatarGroup.position.z = THREE.MathUtils.lerp(avatarGroup.position.z, interiorTarget.z, 0.11);
        avatarGroup.position.y = interiorTarget.y
          + (prefersReducedMotion ? 0 : Math.sin(elapsed * 4.2) * 0.035);
        interiorAvatarWorldRef.current.set(avatarGroup.position.x, 0.18, avatarGroup.position.z);

        const dx = interiorTarget.x - avatarGroup.position.x;
        const dz = interiorTarget.z - avatarGroup.position.z;
        const movingRotation = Math.abs(dx) > Math.abs(dz)
          ? (dx < 0 ? -Math.PI / 2 : Math.PI / 2)
          : (dz < 0 ? Math.PI : 0);
        avatarGroup.rotation.y = THREE.MathUtils.lerp(
          avatarGroup.rotation.y,
          Math.hypot(dx, dz) > 0.06
            ? movingRotation
            : facingRotation(interiorAvatarFacingRef.current),
          0.2,
        );
      }

      if (!prefersReducedMotion) {
        fireflies?.children.forEach((child, index) => {
          child.position.y += Math.sin(elapsed * 1.8 + index) * 0.0018;
        });
        if (river) river.position.y = Math.sin(elapsed * 1.2) * 0.012;
        if (currentTree) currentTree.rotation.z = Math.sin(elapsed * 0.8) * 0.012;
      }

      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const geometry = object.geometry;
        geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [
    completedTreeCount,
    currentTreeProgressDays,
    currentTreeStage,
    customization.cottageAccent,
    customization.featuredReward,
    customization.islandTheme,
    sceneMode,
    timePhase,
  ]);

  return (
    <div
      className="study-forest-3d-shell"
      data-webgl-status={webglStatus}
      data-scene-mode={sceneMode}
      data-time-phase={timePhase}
      aria-label={
        sceneMode === "interior"
          ? "\uC800\uD3F4\uB9AC \uACF5\uBD80 \uC9D1 \uB0B4\uBD80"
          : "\uC800\uD3F4\uB9AC 3D \uACF5\uBD80 \uC232 \uC7A5\uBA74"
      }
      role="group"
    >
      <div className="study-forest-3d-mount" ref={mountRef} />
      {webglStatus === "loading" && (
        <div className="study-forest-3d-loading" aria-live="polite">
          <span />
          {"3D \uACF5\uBD80 \uC232\uC744 \uC870\uC131\uD558\uB294 \uC911\uC774\uC5D0\uC694..."}
        </div>
      )}
      {webglStatus === "fallback" && (
        <div className="study-forest-3d-fallback" role="status">
          <strong>{"3D \uC7A5\uBA74\uC744 \uC5F4 \uC218 \uC5C6\uC5B4\uC694."}</strong>
          <span>
            {"\uD604\uC7AC \uBE0C\uB77C\uC6B0\uC800\uC758 WebGL 2 \uC124\uC815\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694. \uCD9C\uC11D\uACFC \uB098\uBB34 \uC131\uC7A5 \uAE30\uB85D\uC740 \uADF8\uB300\uB85C \uBCF4\uC874\uB429\uB2C8\uB2E4."}
          </span>
        </div>
      )}
      {webglStatus === "ready" && (
        <>
          <div className="study-forest-3d-badge" aria-hidden="true">
            <span>{sceneMode === "interior" ? "ROOM" : "LIVE"}</span>
            {sceneMode === "interior" ? "COZY STUDY COTTAGE" : "LOW-POLY 3D"}
          </div>
          <div className="study-forest-time-badge" aria-label={"\uD604\uC7AC \uC2DC\uAC04\uB300"}>
            <span aria-hidden="true">
              {timePhase === "night" ? "\u263E" : timePhase === "sunset" ? "\u25D0" : "\u2600"}
            </span>
            {TIME_PHASE_LABELS[timePhase]}
          </div>
          {interactionMessage && (
            <div className="study-forest-3d-notice" role="status">{interactionMessage}</div>
          )}
          <div className="study-forest-3d-hint">
            {sceneMode === "island"
              ? "\uC12C\uC744 \uB20C\uB7EC \uC0B0\uCC45\uD558\uACE0, \uC9D1 \uBB38\uC744 \uB20C\uB7EC \uC2E4\uB0B4\uB85C \uB4E4\uC5B4\uAC00\uC138\uC694"
              : "\uC9D1 \uC548\uC744 \uC0B0\uCC45\uD558\uACE0, \uC544\uB798\uCABD \uBB38\uC73C\uB85C \uAC78\uC5B4 \uB098\uAC00\uBA74 \uC12C\uC73C\uB85C \uB3CC\uC544\uAC00\uC694"}
          </div>
        </>
      )}
    </div>
  );
}
