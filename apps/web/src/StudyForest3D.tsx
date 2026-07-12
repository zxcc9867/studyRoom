import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import type {
  StudyForestAvatarFacing,
  StudyForestAvatarPosition,
  StudyForestTreeStage,
} from "./studyForest.mjs";

type AvatarTarget = Pick<StudyForestAvatarPosition, "x" | "y">;

type StudyForest3DProps = {
  completedTreeCount: number;
  currentTreeStage: StudyForestTreeStage;
  currentTreeProgressDays: number;
  avatar: StudyForestAvatarPosition & { facing: StudyForestAvatarFacing };
  onMoveTarget: (target: AvatarTarget) => void;
};

type WebglStatus = "loading" | "ready" | "fallback";

const AVATAR_BOUNDS = { minX: 8, maxX: 92, minY: 42, maxY: 84 };
const WORLD_BOUNDS = { minX: -5.35, maxX: 5.35, minZ: -3.5, maxZ: 3.75 };
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

function createIsland(scene: THREE.Scene) {
  const island = new THREE.Group();
  island.name = "low-poly-study-island";

  const earth = new THREE.Mesh(
    new THREE.CylinderGeometry(7.15, 6.1, 1.5, 14),
    standardMaterial(palette.soil),
  );
  earth.position.y = -0.7;
  earth.receiveShadow = true;
  island.add(earth);

  const sand = new THREE.Mesh(
    new THREE.CylinderGeometry(7.25, 7.08, 0.34, 14),
    standardMaterial(palette.sand),
  );
  sand.position.y = -0.06;
  sand.receiveShadow = true;
  island.add(sand);

  const meadow = new THREE.Mesh(
    new THREE.CylinderGeometry(6.78, 6.95, 0.48, 14),
    standardMaterial(palette.grass),
  );
  meadow.position.y = 0.2;
  meadow.receiveShadow = true;
  island.add(meadow);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(6.82, 0.1, 5, 14),
    standardMaterial(palette.grassDark),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.47;
  island.add(rim);

  const pathMaterial = standardMaterial(palette.path);
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

function createRiver(scene: THREE.Scene) {
  const river = new THREE.Group();
  river.name = "river";

  const waterMaterial = standardMaterial(palette.water, {
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
    new THREE.MeshBasicMaterial({ color: palette.waterLight, transparent: true, opacity: 0.72 }),
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
  for (const z of [-1.08, 1.08]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.1), railMaterial);
    rail.position.set(0, 0.68, z);
    bridge.add(rail);
    for (const x of [-1.55, -0.75, 0, 0.75, 1.55]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.75, 6), railMaterial);
      post.position.set(x, 0.35, z);
      bridge.add(post);
    }
  }

  enableShadows(bridge);
  scene.add(bridge);
  return bridge;
}

function createCottage(scene: THREE.Scene) {
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
    standardMaterial(palette.roof),
  );
  roof.position.y = 2.05;
  roof.rotation.y = Math.PI / 4;
  cottage.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.08, 0.1),
    standardMaterial(palette.wood),
  );
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
  return cottage;
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

function facingRotation(facing: StudyForestAvatarFacing) {
  if (facing === "up") return Math.PI;
  if (facing === "left") return Math.PI / 2;
  if (facing === "right") return -Math.PI / 2;
  return 0;
}

export function StudyForest3D({
  completedTreeCount,
  currentTreeStage,
  currentTreeProgressDays,
  avatar,
  onMoveTarget,
}: StudyForest3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const avatarTargetRef = useRef(avatarTargetToWorldPoint(avatar));
  const avatarFacingRef = useRef<StudyForestAvatarFacing>(avatar.facing);
  const onMoveTargetRef = useRef(onMoveTarget);
  const [webglStatus, setWebglStatus] = useState<WebglStatus>("loading");

  useEffect(() => {
    avatarTargetRef.current = avatarTargetToWorldPoint(avatar);
    avatarFacingRef.current = avatar.facing;
  }, [avatar]);

  useEffect(() => {
    onMoveTargetRef.current = onMoveTarget;
  }, [onMoveTarget]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

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
    renderer.setClearColor(palette.sky, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.sky);
    scene.fog = new THREE.Fog(palette.fog, 14, 28);

    const camera = new THREE.OrthographicCamera(-8, 8, 5.5, -5.5, 0.1, 60);
    camera.position.set(11.5, 11.2, 13.8);
    camera.lookAt(0, 0.6, 0);

    const hemisphere = new THREE.HemisphereLight(0xe7fbff, 0x5d7656, 2.25);
    scene.add(hemisphere);

    const sunlight = new THREE.DirectionalLight(0xfff3cf, 3.2);
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

    createIsland(scene);
    const river = createRiver(scene);
    createBridge(scene);
    createCottage(scene);
    createGarden(scene);
    createLantern(scene, -1.8, -1.25);
    createLantern(scene, 2.25, 2.15);
    const fireflies = createFireflies(scene);

    const visibleCompletedTrees = Math.min(completedTreeCount, 28);
    for (let index = 0; index < visibleCompletedTrees; index += 1) {
      const base = COMPLETED_TREE_POSITIONS[index % COMPLETED_TREE_POSITIONS.length];
      const ring = Math.floor(index / COMPLETED_TREE_POSITIONS.length);
      const tree = createLowPolyTree(index, Math.max(0.58, 0.92 - ring * 0.12));
      tree.position.set(base[0] * (1 - ring * 0.11), 0.48, base[1] * (1 - ring * 0.1));
      tree.rotation.y = (index * 1.7) % (Math.PI * 2);
      scene.add(tree);
    }

    const currentTree = createLowPolyTree(
      currentTreeProgressDays,
      1.08,
      currentTreeStage,
    );
    currentTree.position.set(3.15, 0.48, -1.2);
    scene.add(currentTree);

    const avatarGroup = createAvatar();
    avatarGroup.position.copy(avatarTargetRef.current);
    avatarGroup.rotation.y = facingRotation(avatarFacingRef.current);
    scene.add(avatarGroup);

    const interactionPlane = new THREE.Mesh(
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

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const intersection = raycaster.intersectObject(interactionPlane)[0];
      if (!intersection) return;
      onMoveTargetRef.current(worldPointToAvatarTarget(intersection.point));
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
      avatarGroup.position.x = THREE.MathUtils.lerp(avatarGroup.position.x, avatarTargetRef.current.x, 0.075);
      avatarGroup.position.z = THREE.MathUtils.lerp(avatarGroup.position.z, avatarTargetRef.current.z, 0.075);
      avatarGroup.position.y = avatarTargetRef.current.y + (prefersReducedMotion ? 0 : Math.sin(elapsed * 4.2) * 0.045);
      avatarGroup.rotation.y = THREE.MathUtils.lerp(
        avatarGroup.rotation.y,
        facingRotation(avatarFacingRef.current),
        0.16,
      );

      if (!prefersReducedMotion) {
        fireflies.children.forEach((child, index) => {
          child.position.y += Math.sin(elapsed * 1.8 + index) * 0.0018;
        });
        river.position.y = Math.sin(elapsed * 1.2) * 0.012;
        currentTree.rotation.z = Math.sin(elapsed * 0.8) * 0.012;
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
  }, [completedTreeCount, currentTreeProgressDays, currentTreeStage]);

  return (
    <div
      className="study-forest-3d-shell"
      data-webgl-status={webglStatus}
      aria-label={"\uC800\uD3F4\uB9AC 3D \uACF5\uBD80 \uC232 \uC7A5\uBA74"}
      role="img"
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
            <span>LIVE</span>
            LOW-POLY 3D
          </div>
          <div className="study-forest-3d-hint">
            {"\uC12C\uC744 \uB204\uB974\uBA74 \uCE90\uB9AD\uD130\uAC00 \uADF8\uACF3\uC73C\uB85C \uC0B0\uCC45\uD574\uC694"}
          </div>
        </>
      )}
    </div>
  );
}
