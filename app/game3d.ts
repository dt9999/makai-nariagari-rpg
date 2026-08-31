import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type RenderRegion = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  biome: string;
  color: string;
  owner: 'unknown' | 'wild' | 'enemy' | 'own';
  landmark: string;
};
type RenderMob = {
  id: number;
  x: number;
  y: number;
  hp: number;
  max: number;
  name: string;
  tier: number;
  boss?: boolean;
  ally?: boolean;
  home: string;
  attackAnim?: number;
  attackTotal?: number;
  attackCd?: number;
  attackHit?: boolean;
  attackTarget?: number;
  hitAnim?: number;
  deathAnim?: number;
  dead?: boolean;
};
type RenderNode = {
  id: number;
  x: number;
  y: number;
  kind: 'wood' | 'ore';
  n: number;
};
type RenderBase = {
  id: number;
  x: number;
  y: number;
  yaw: number;
  level: number;
};
export type RenderWorld = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  job: string;
  guarding: boolean;
  dodgeTime: number;
  attackAnim: number;
  attackTotal: number;
  attackKind: 'none' | 'normal' | 'heavy' | 'skill';
  hitAnim: number;
  buildAnim: number;
  buildMode: boolean;
  buildYaw: number;
  bases: RenderBase[];
  minions: number;
  facingX: number;
  facingY: number;
  viewYaw: number;
  viewPitch: number;
  height: number;
  conquered: string[];
  mobs: RenderMob[];
  nodes: RenderNode[];
};

const SCALE = 0.018,
  CENTER_X = 8000,
  CENTER_Y = 4500;
const worldX = (x: number) => (x - CENTER_X) * SCALE;
const worldZ = (y: number) => (y - CENTER_Y) * SCALE;
const owner = (world: RenderWorld, region: RenderRegion) =>
  world.conquered.includes(region.id) ? 'own' : region.owner;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth01 = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const smoothRange = (start: number, end: number, value: number) =>
  smooth01((value - start) / Math.max(0.0001, end - start));
const dampAngle = (
  current: number,
  target: number,
  lambda: number,
  dt: number,
) => {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + delta * (1 - Math.exp(-lambda * dt));
};

const mats = {
  stone: new THREE.MeshStandardMaterial({
    color: 0x625e69,
    roughness: 0.98,
    metalness: 0.02,
  }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x302e39, roughness: 1 }),
  stoneLight: new THREE.MeshStandardMaterial({
    color: 0x8a8490,
    roughness: 0.93,
  }),
  wood: new THREE.MeshStandardMaterial({
    color: 0x5f331f,
    roughness: 0.9,
    metalness: 0,
  }),
  woodCut: new THREE.MeshStandardMaterial({ color: 0xb47b48, roughness: 0.78 }),
  iron: new THREE.MeshStandardMaterial({
    color: 0x48505c,
    roughness: 0.28,
    metalness: 0.88,
  }),
  silver: new THREE.MeshStandardMaterial({
    color: 0xa9b4c4,
    roughness: 0.2,
    metalness: 0.95,
  }),
  gold: new THREE.MeshStandardMaterial({
    color: 0xb77a27,
    roughness: 0.24,
    metalness: 0.88,
  }),
  leather: new THREE.MeshStandardMaterial({ color: 0x3e211b, roughness: 0.84 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0x482f60, roughness: 0.92 }),
  skin: new THREE.MeshStandardMaterial({ color: 0x8f5aa5, roughness: 0.72 }),
  eye: new THREE.MeshStandardMaterial({
    color: 0xffcf5b,
    emissive: 0xff5a10,
    emissiveIntensity: 2,
    roughness: 0.2,
  }),
  enemy: new THREE.MeshStandardMaterial({ color: 0x9d3143, roughness: 0.68 }),
  ally: new THREE.MeshStandardMaterial({ color: 0x319c7c, roughness: 0.66 }),
  foliage: new THREE.MeshStandardMaterial({ color: 0x193f35, roughness: 0.96 }),
  deadFoliage: new THREE.MeshStandardMaterial({
    color: 0x49372e,
    roughness: 1,
  }),
  lava: new THREE.MeshStandardMaterial({
    color: 0xff5b24,
    emissive: 0xff2400,
    emissiveIntensity: 2.8,
    roughness: 0.38,
  }),
  crystal: new THREE.MeshStandardMaterial({
    color: 0x9c68e8,
    emissive: 0x421983,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.15,
  }),
  shadow: new THREE.MeshBasicMaterial({
    color: 0x05030a,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  }),
};

const geo = {
  sphere: new THREE.SphereGeometry(1, 12, 9),
  lowSphere: new THREE.DodecahedronGeometry(1, 0),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
  cone: new THREE.ConeGeometry(1, 1, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  rock: new THREE.DodecahedronGeometry(1, 0),
  octa: new THREE.OctahedronGeometry(1, 0),
};

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  scale: [number, number, number],
  position: [number, number, number],
  parent: THREE.Object3D,
  cast = true,
) {
  const m = new THREE.Mesh(geometry, material);
  m.scale.set(...scale);
  m.position.set(...position);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function addShadow(parent: THREE.Object3D, r = 0.52) {
  const s = mesh(
    new THREE.CircleGeometry(r, 20),
    mats.shadow,
    [1, 0.46, 1],
    [0, 0.025, 0],
    parent,
    false,
  );
  s.rotation.x = -Math.PI / 2;
  s.receiveShadow = false;
  return s;
}

function addEyes(
  parent: THREE.Object3D,
  y: number,
  z: number,
  space = 0.1,
  size = 0.04,
) {
  mesh(
    geo.sphere,
    mats.eye,
    [size, size * 0.65, size * 0.45],
    [-space, y, z],
    parent,
    false,
  );
  mesh(
    geo.sphere,
    mats.eye,
    [size, size * 0.65, size * 0.45],
    [space, y, z],
    parent,
    false,
  );
}

function buildWeapon(job: string, color: number) {
  const root = new THREE.Group(),
    magic = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.55,
    });
  const handle = () => {
    const h = mesh(
      geo.cylinder,
      mats.leather,
      [0.045, 0.38, 0.045],
      [0, 0.18, 0],
      root,
    );
    return h;
  };
  if (job === 'mage' || job === 'nightseer') {
    mesh(geo.cylinder, mats.wood, [0.045, 0.83, 0.045], [0, 0.1, 0], root);
    mesh(geo.sphere, magic, [0.17, 0.17, 0.17], [0, 1, 0], root);
    mesh(
      new THREE.TorusGeometry(0.22, 0.025, 6, 14),
      mats.gold,
      [1, 1, 1],
      [0, 1, 0],
      root,
    ).rotation.x = Math.PI / 2;
  } else if (job === 'lancer' || job === 'dragoon') {
    mesh(geo.cylinder, mats.wood, [0.035, 1.05, 0.035], [0, 0.15, 0], root);
    mesh(geo.cone, magic, [0.11, 0.45, 0.11], [0, 1.4, 0], root);
    mesh(geo.cylinder, mats.gold, [0.08, 0.035, 0.08], [0, 0.94, 0], root);
  } else if (job === 'shadow') {
    for (const side of [-1, 1]) {
      const dagger = new THREE.Group();
      dagger.position.x = side * 0.12;
      mesh(
        geo.cylinder,
        mats.leather,
        [0.035, 0.16, 0.035],
        [0, 0.02, 0],
        dagger,
      );
      mesh(geo.box, magic, [0.07, 0.42, 0.025], [0, 0.34, 0], dagger);
      mesh(geo.box, mats.gold, [0.17, 0.035, 0.05], [0, 0.16, 0], dagger);
      dagger.rotation.z = side * 0.12;
      root.add(dagger);
    }
  } else if (job === 'berserker' || job === 'warlock') {
    handle();
    mesh(geo.box, magic, [0.14, 0.92, 0.065], [0, 0.96, 0], root);
    mesh(geo.box, mats.iron, [0.54, 0.22, 0.1], [0, 1.55, 0], root);
    mesh(geo.box, mats.gold, [0.32, 0.055, 0.11], [0, 0.57, 0], root);
  } else if (job === 'ruler') {
    mesh(geo.cylinder, mats.iron, [0.045, 0.68, 0.045], [0, 0.25, 0], root);
    mesh(
      new THREE.TorusGeometry(0.2, 0.045, 6, 16),
      magic,
      [1, 1, 1],
      [0, 1, 0],
      root,
    );
    mesh(geo.sphere, mats.eye, [0.08, 0.08, 0.08], [0, 1, 0], root);
  } else {
    handle();
    mesh(geo.box, magic, [0.1, 0.75, 0.035], [0, 0.86, 0], root);
    mesh(geo.box, mats.gold, [0.34, 0.055, 0.08], [0, 0.42, 0], root);
  }
  root.userData.magicMaterial = magic;
  return root;
}

// oxlint-disable-next-line no-unused-vars -- kept as a lightweight fallback model during animation development
function buildPlayer(job: string) {
  const root = new THREE.Group();
  addShadow(root, 0.57);
  const body = new THREE.Group();
  root.add(body);
  const jobColors: Record<string, number> = {
    blade: 0x8454c4,
    berserker: 0xc34738,
    mage: 0x4d66cc,
    shadow: 0x278f82,
    lancer: 0xb18235,
    ruler: 0xb85282,
    warlock: 0xd55236,
    nightseer: 0x5376cd,
    dragoon: 0xad8c35,
  };
  const color = jobColors[job] || 0x5d3b79,
    cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.88 }),
    armor =
      job === 'mage' || job === 'ruler' || job === 'shadow'
        ? mats.leather
        : mats.iron;
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const leg = mesh(
      new RoundedBoxGeometry(0.23, 0.56, 0.27, 2, 0.05),
      cloth,
      [1, 1, 1],
      [side * 0.18, 0.43, 0],
      body,
    );
    legs.push(leg);
    mesh(
      new RoundedBoxGeometry(0.27, 0.22, 0.38, 2, 0.05),
      mats.leather,
      [1, 1, 1],
      [side * 0.18, 0.16, 0.07],
      body,
    );
  }
  mesh(
    new RoundedBoxGeometry(0.72, 0.88, 0.44, 3, 0.08),
    cloth,
    [1, 1, 1],
    [0, 1.08, 0],
    body,
  );
  mesh(
    new RoundedBoxGeometry(0.65, 0.5, 0.12, 2, 0.04),
    armor,
    [1, 1, 1],
    [0, 1.2, 0.25],
    body,
  );
  mesh(geo.box, mats.leather, [0.4, 0.07, 0.27], [0, 0.76, 0], body);
  mesh(
    geo.cylinder,
    mats.gold,
    [0.055, 0.035, 0.055],
    [0, 0.76, 0.28],
    body,
  ).rotation.x = Math.PI / 2;
  const arms: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    mesh(geo.sphere, armor, [0.2, 0.16, 0.23], [side * 0.49, 1.38, 0], body);
    const arm = mesh(
      geo.cylinder,
      cloth,
      [0.105, 0.37, 0.105],
      [side * 0.52, 1.02, 0.02],
      body,
    );
    arm.rotation.z = side * 0.08;
    arms.push(arm);
    mesh(
      geo.sphere,
      mats.skin,
      [0.11, 0.11, 0.11],
      [side * 0.54, 0.67, 0.04],
      body,
    );
  }
  mesh(geo.sphere, mats.skin, [0.3, 0.34, 0.29], [0, 1.9, 0.02], body);
  mesh(
    new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
    cloth,
    [0.34, 0.28, 0.32],
    [0, 2.03, -0.01],
    body,
  );
  addEyes(body, 1.92, 0.285, 0.105, 0.045);
  for (const side of [-1, 1]) {
    const horn = mesh(
      geo.cone,
      mats.iron,
      [0.09, 0.36, 0.09],
      [side * 0.23, 2.29, 0],
      body,
    );
    horn.rotation.z = side * -0.34;
  }
  const cape = mesh(
    new RoundedBoxGeometry(0.61, 0.82, 0.045, 2, 0.02),
    cloth,
    [1, 1, 1],
    [0, 1.06, -0.26],
    body,
  );
  cape.rotation.x = -0.08;
  const weapon = buildWeapon(job, color);
  weapon.position.set(0.63, 0.67, 0.03);
  weapon.rotation.z = -0.32;
  body.add(weapon);
  const shield = new THREE.Group();
  shield.position.set(-0.62, 1.03, 0.24);
  const plate = mesh(
    new THREE.CylinderGeometry(0.34, 0.27, 0.12, 10),
    mats.iron,
    [1, 1, 1],
    [0, 0, 0],
    shield,
  );
  plate.rotation.x = Math.PI / 2;
  mesh(geo.sphere, mats.gold, [0.1, 0.1, 0.07], [0, 0, 0.1], shield);
  shield.visible = false;
  body.add(shield);
  const aura = mesh(
    new THREE.RingGeometry(0.55, 0.66, 28),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    [1, 1, 1],
    [0, 0.07, 0],
    root,
    false,
  );
  aura.rotation.x = -Math.PI / 2;
  aura.visible = false;
  root.userData = { body, legs, arms, weapon, shield, aura, cloth };
  return root;
}

function buildHealthBar(boss = false) {
  const root = new THREE.Group(),
    bg = mesh(
      geo.box,
      new THREE.MeshBasicMaterial({
        color: 0x130914,
        transparent: true,
        opacity: 0.88,
      }),
      [boss ? 1.25 : 0.7, 0.075, 0.025],
      [0, 0, 0],
      root,
      false,
    ),
    fill = mesh(
      geo.box,
      new THREE.MeshBasicMaterial({ color: boss ? 0xff375f : 0xe95872 }),
      [boss ? 1.18 : 0.64, 0.048, 0.03],
      [0, 0, 0.01],
      root,
      false,
    );
  bg.receiveShadow = false;
  fill.receiveShadow = false;
  root.userData.fill = fill;
  root.userData.full = boss ? 1.18 : 0.64;
  return root;
}

// oxlint-disable-next-line no-unused-vars -- kept as a lightweight fallback model during animation development
function buildMob(mob: RenderMob) {
  const root = new THREE.Group();
  addShadow(root, mob.boss ? 0.78 : 0.44);
  const body = new THREE.Group();
  root.add(body);
  const baseMat = mob.ally ? mats.ally : mats.enemy,
    scale = mob.boss ? 1.38 : 1 + Math.min(mob.tier, 6) * 0.045;
  if (/ウルフ|ハウンド|サラマンダー/.test(mob.name)) {
    mesh(geo.lowSphere, baseMat, [0.58, 0.34, 0.88], [0, 0.55, 0], body);
    mesh(geo.lowSphere, baseMat, [0.4, 0.38, 0.44], [0, 0.66, 0.69], body);
    addEyes(body, 0.72, 1.05, 0.13, 0.04);
    for (const side of [-1, 1])
      for (const z of [-0.42, 0.48])
        mesh(
          geo.cylinder,
          mats.leather,
          [0.09, 0.34, 0.09],
          [side * 0.36, 0.27, z],
          body,
        );
    const tail = mesh(
      geo.cone,
      baseMat,
      [0.12, 0.65, 0.12],
      [0, 0.72, -0.75],
      body,
    );
    tail.rotation.x = -1.08;
    for (const side of [-1, 1]) {
      const ear = mesh(
        geo.cone,
        mats.iron,
        [0.1, 0.28, 0.1],
        [side * 0.23, 1, 0.72],
        body,
      );
      ear.rotation.z = side * 0.18;
    }
  } else if (/スライム/.test(mob.name)) {
    mesh(
      new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.78),
      baseMat,
      [0.62, 0.52, 0.62],
      [0, 0.12, 0],
      body,
    );
    addEyes(body, 0.48, 0.54, 0.16, 0.055);
  } else {
    const large = mob.tier >= 3 || mob.boss;
    for (const side of [-1, 1]) {
      mesh(
        geo.cylinder,
        baseMat,
        [large ? 0.16 : 0.12, large ? 0.48 : 0.35, large ? 0.16 : 0.12],
        [side * (large ? 0.26 : 0.2), large ? 0.46 : 0.34, 0],
        body,
      );
      mesh(
        geo.sphere,
        mats.leather,
        [large ? 0.17 : 0.13, large ? 0.11 : 0.09, large ? 0.25 : 0.19],
        [side * (large ? 0.26 : 0.2), 0.1, 0.08],
        body,
      );
    }
    mesh(
      new RoundedBoxGeometry(
        large ? 0.82 : 0.58,
        large ? 0.85 : 0.66,
        large ? 0.48 : 0.38,
        2,
        0.07,
      ),
      baseMat,
      [1, 1, 1],
      [0, large ? 1.05 : 0.84, 0],
      body,
    );
    if (large) {
      mesh(
        new RoundedBoxGeometry(0.74, 0.42, 0.1, 2, 0.04),
        mats.iron,
        [1, 1, 1],
        [0, 1.16, 0.29],
        body,
      );
      for (const side of [-1, 1])
        mesh(
          geo.sphere,
          mats.iron,
          [0.24, 0.18, 0.26],
          [side * 0.48, 1.29, 0],
          body,
        );
    }
    mesh(
      geo.sphere,
      baseMat,
      [large ? 0.34 : 0.27, large ? 0.36 : 0.29, large ? 0.32 : 0.26],
      [0, large ? 1.72 : 1.38, 0.03],
      body,
    );
    addEyes(
      body,
      large ? 1.73 : 1.4,
      large ? 0.32 : 0.27,
      large ? 0.12 : 0.09,
      large ? 0.05 : 0.04,
    );
    for (const side of [-1, 1]) {
      const horn = mesh(
        geo.cone,
        mats.iron,
        [large ? 0.11 : 0.08, large ? 0.38 : 0.28, large ? 0.11 : 0.08],
        [side * (large ? 0.27 : 0.21), large ? 2.05 : 1.68, 0],
        body,
      );
      horn.rotation.z = side * -0.42;
      mesh(
        geo.cylinder,
        baseMat,
        [large ? 0.13 : 0.1, large ? 0.4 : 0.3, large ? 0.13 : 0.1],
        [side * (large ? 0.54 : 0.4), large ? 1.05 : 0.85, 0.02],
        body,
      );
    }
    if (mob.boss) {
      mesh(
        new THREE.TorusGeometry(0.35, 0.055, 6, 10),
        mats.gold,
        [1, 1, 1],
        [0, 2.06, 0],
        body,
      ).rotation.x = Math.PI / 2;
      const blade = mesh(
        geo.box,
        mats.silver,
        [0.12, 0.92, 0.045],
        [0.66, 1.05, 0.04],
        body,
      );
      blade.rotation.z = -0.22;
    }
  }
  body.scale.setScalar(scale);
  const bar = buildHealthBar(!!mob.boss);
  bar.position.y = (mob.boss ? 3.15 : 2.5) * scale;
  root.add(bar);
  root.userData = { body, bar };
  return root;
}

type JointLimb = {
  upper: THREE.Group;
  lower: THREE.Group;
  end: THREE.Group;
  side: number;
};

function createJointLimb(
  parent: THREE.Object3D,
  origin: [number, number, number],
  upperLength: number,
  lowerLength: number,
  radius: number,
  material: THREE.Material,
  side: number,
  foot = false,
): JointLimb {
  const upper = new THREE.Group();
  upper.position.set(...origin);
  parent.add(upper);
  mesh(
    geo.cylinder,
    material,
    [radius, upperLength, radius],
    [0, -upperLength / 2, 0],
    upper,
  );
  const lower = new THREE.Group();
  lower.position.y = -upperLength;
  upper.add(lower);
  mesh(
    geo.cylinder,
    material,
    [radius * 0.88, lowerLength, radius * 0.88],
    [0, -lowerLength / 2, 0],
    lower,
  );
  const end = new THREE.Group();
  end.position.y = -lowerLength;
  lower.add(end);
  if (foot) {
    mesh(
      new RoundedBoxGeometry(
        radius * 2.25,
        radius * 1.25,
        radius * 3.1,
        2,
        0.035,
      ),
      mats.leather,
      [1, 1, 1],
      [0, -radius * 0.2, radius * 0.55],
      end,
    );
  } else {
    mesh(geo.sphere, mats.skin, [radius, radius, radius], [0, 0, 0], end);
  }
  return { upper, lower, end, side };
}

// oxlint-disable-next-line no-unused-vars -- retained for a future optional third-person inspection mode
function buildRiggedPlayer(job: string) {
  const root = new THREE.Group();
  addShadow(root, 0.58);
  const motion = new THREE.Group();
  root.add(motion);
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.9;
  motion.add(pelvis);
  const jobColors: Record<string, number> = {
    blade: 0x8454c4,
    berserker: 0xc34738,
    mage: 0x4d66cc,
    shadow: 0x278f82,
    lancer: 0xb18235,
    ruler: 0xb85282,
    warlock: 0xd55236,
    nightseer: 0x5376cd,
    dragoon: 0xad8c35,
  };
  const color = jobColors[job] || 0x5d3b79;
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const armor =
    job === 'mage' || job === 'ruler' || job === 'shadow'
      ? mats.leather
      : mats.iron;
  const legs = [
    createJointLimb(pelvis, [-0.2, 0, 0], 0.52, 0.46, 0.115, cloth, -1, true),
    createJointLimb(pelvis, [0.2, 0, 0], 0.52, 0.46, 0.115, cloth, 1, true),
  ];
  const torso = new THREE.Group();
  torso.position.y = 0.02;
  pelvis.add(torso);
  mesh(
    new RoundedBoxGeometry(0.76, 0.87, 0.46, 3, 0.08),
    cloth,
    [1, 1, 1],
    [0, 0.43, 0],
    torso,
  );
  mesh(
    new RoundedBoxGeometry(0.67, 0.5, 0.12, 2, 0.04),
    armor,
    [1, 1, 1],
    [0, 0.49, 0.27],
    torso,
  );
  mesh(geo.box, mats.leather, [0.41, 0.07, 0.27], [0, 0.02, 0], torso);
  mesh(
    geo.cylinder,
    mats.gold,
    [0.055, 0.035, 0.055],
    [0, 0.02, 0.29],
    torso,
  ).rotation.x = Math.PI / 2;
  const arms = [
    createJointLimb(torso, [-0.5, 0.72, 0], 0.4, 0.36, 0.105, cloth, -1),
    createJointLimb(torso, [0.5, 0.72, 0], 0.4, 0.36, 0.105, cloth, 1),
  ];
  for (const arm of arms)
    mesh(geo.sphere, armor, [0.2, 0.16, 0.23], [0, 0, 0], arm.upper);
  const head = new THREE.Group();
  head.position.y = 1.05;
  torso.add(head);
  mesh(geo.sphere, mats.skin, [0.3, 0.34, 0.29], [0, 0, 0.02], head);
  mesh(
    new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
    cloth,
    [0.34, 0.28, 0.32],
    [0, 0.13, -0.01],
    head,
  );
  addEyes(head, 0.02, 0.285, 0.105, 0.045);
  for (const side of [-1, 1]) {
    const horn = mesh(
      geo.cone,
      mats.iron,
      [0.09, 0.36, 0.09],
      [side * 0.23, 0.39, 0],
      head,
    );
    horn.rotation.z = side * -0.34;
  }
  const cape = mesh(
    new RoundedBoxGeometry(0.62, 0.84, 0.045, 2, 0.02),
    cloth,
    [1, 1, 1],
    [0, 0.36, -0.27],
    torso,
  );
  cape.rotation.x = -0.08;
  const weapon = buildWeapon(job, color);
  weapon.position.set(0, -0.04, 0.02);
  weapon.rotation.z = -0.24;
  arms[1].end.add(weapon);
  const shield = new THREE.Group();
  const plate = mesh(
    new THREE.CylinderGeometry(0.34, 0.27, 0.12, 10),
    mats.iron,
    [1, 1, 1],
    [0, 0, 0],
    shield,
  );
  plate.rotation.x = Math.PI / 2;
  mesh(geo.sphere, mats.gold, [0.1, 0.1, 0.07], [0, 0, 0.1], shield);
  shield.position.set(0, 0, 0.1);
  shield.visible = false;
  arms[0].end.add(shield);
  const aura = mesh(
    new THREE.RingGeometry(0.58, 0.7, 30),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    [1, 1, 1],
    [0, 0.07, 0],
    root,
    false,
  );
  aura.rotation.x = -Math.PI / 2;
  aura.visible = false;
  root.userData = {
    motion,
    pelvis,
    torso,
    head,
    legs,
    arms,
    weapon,
    shield,
    aura,
    cape,
    gait: 0,
    speedBlend: 0,
    guardBlend: 0,
    yaw: 0,
    prevX: Number.NaN,
    prevY: Number.NaN,
  };
  return root;
}

function buildFirstPersonRig(job: string) {
  const root = new THREE.Group();
  const jobColors: Record<string, number> = {
    blade: 0x8454c4,
    berserker: 0xc34738,
    mage: 0x4d66cc,
    shadow: 0x278f82,
    lancer: 0xb18235,
    ruler: 0xb85282,
    warlock: 0xd55236,
    nightseer: 0x5376cd,
    dragoon: 0xad8c35,
  };
  const color = jobColors[job] || 0x5d3b79;
  const sleeve = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    depthTest: false,
    depthWrite: false,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0x9564a5,
    roughness: 0.7,
    depthTest: false,
    depthWrite: false,
  });
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3, -0.31, -0.58);
    const forearm = mesh(
      geo.cylinder,
      sleeve,
      [0.085, 0.34, 0.085],
      [0, -0.02, 0],
      arm,
      false,
    );
    forearm.rotation.x = -0.92;
    mesh(geo.sphere, skin, [0.095, 0.095, 0.11], [0, 0.25, -0.25], arm, false);
    root.add(arm);
    return arm;
  };
  const leftArm = makeArm(-1),
    rightArm = makeArm(1);
  const weapon = buildWeapon(job, color);
  weapon.position.set(0.02, 0.22, -0.25);
  weapon.rotation.set(-0.18, 0, -0.22);
  weapon.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const original = child.material as THREE.MeshStandardMaterial;
    child.material = original.clone();
    const material = child.material as THREE.MeshStandardMaterial;
    material.depthTest = false;
    material.depthWrite = false;
    child.renderOrder = 20;
  });
  rightArm.add(weapon);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const spellGlow = mesh(
    new THREE.RingGeometry(0.13, 0.2, 24),
    glowMaterial,
    [1, 1, 1],
    [0, 0.2, -0.38],
    leftArm,
    false,
  );
  spellGlow.renderOrder = 21;
  root.userData = {
    leftArm,
    rightArm,
    weapon,
    spellGlow,
    gait: 0,
    speedBlend: 0,
    guardBlend: 0,
  };
  root.visible = !!job;
  return root;
}

function animateFirstPersonRig(
  rig: THREE.Group,
  world: RenderWorld,
  dt: number,
  elapsed: number,
  speedScene: number,
) {
  const data = rig.userData;
  const leftArm = data.leftArm as THREE.Group,
    rightArm = data.rightArm as THREE.Group,
    weapon = data.weapon as THREE.Group,
    spellGlow = data.spellGlow as THREE.Mesh;
  data.speedBlend = THREE.MathUtils.damp(
    data.speedBlend,
    clamp01(speedScene / 3.9),
    10,
    dt,
  );
  data.guardBlend = THREE.MathUtils.damp(
    data.guardBlend,
    world.guarding ? 1 : 0,
    16,
    dt,
  );
  data.gait += dt * (2.4 + speedScene * 4.3);
  const locomotion = data.speedBlend as number,
    phase = data.gait as number,
    bobX = Math.sin(phase) * 0.018 * locomotion,
    bobY = Math.abs(Math.cos(phase * 2)) * 0.016 * locomotion;
  rig.position.set(bobX, -bobY, 0);
  rig.rotation.set(0, 0, -bobX * 0.45);
  leftArm.position.set(-0.3, -0.31, -0.58);
  rightArm.position.set(0.3, -0.31, -0.58);
  leftArm.rotation.set(0, 0, -0.08);
  rightArm.rotation.set(0, 0, 0.08);
  weapon.rotation.set(-0.18, 0, -0.22);
  const guard = data.guardBlend as number;
  rightArm.position.lerp(new THREE.Vector3(0.08, -0.18, -0.48), guard);
  rightArm.rotation.x -= guard * 0.45;
  weapon.rotation.z += guard * 0.85;
  leftArm.position.lerp(new THREE.Vector3(-0.12, -0.16, -0.5), guard);
  let impact = 0;
  if (world.attackAnim > 0 && world.attackTotal > 0) {
    const progress = clamp01(1 - world.attackAnim / world.attackTotal),
      heavy = world.attackKind === 'heavy' ? 1.25 : 1,
      windEnd = world.attackKind === 'heavy' ? 0.34 : 0.23,
      wind =
        smoothRange(0, windEnd, progress) *
        (1 - smoothRange(windEnd + 0.06, 0.52, progress)),
      strike =
        smoothRange(windEnd, 0.53, progress) *
        (1 - smoothRange(0.66, 0.96, progress));
    impact = Math.max(0, 1 - Math.abs(progress - 0.53) / 0.11);
    if (world.attackKind === 'skill') {
      const gather =
          smoothRange(0, 0.35, progress) *
          (1 - smoothRange(0.4, 0.58, progress)),
        release =
          smoothRange(0.36, 0.6, progress) *
          (1 - smoothRange(0.78, 1, progress));
      leftArm.position.x -= gather * 0.14;
      rightArm.position.x += gather * 0.12;
      leftArm.position.z -= release * 0.22;
      rightArm.position.z -= release * 0.18;
      rig.rotation.x -= gather * 0.05;
    } else {
      rightArm.position.x += wind * 0.18 - strike * 0.28;
      rightArm.position.y += wind * 0.12 + strike * 0.08;
      rightArm.position.z += wind * 0.13 - strike * 0.35;
      rightArm.rotation.x += (-0.55 * wind + 0.86 * strike) * heavy;
      rightArm.rotation.z += (-0.62 * wind + 0.74 * strike) * heavy;
      weapon.rotation.z += (0.88 * wind - 1.25 * strike) * heavy;
      weapon.rotation.x -= 0.35 * wind;
      leftArm.position.z -= strike * 0.12;
    }
  }
  if (world.dodgeTime > 0) {
    const arc = Math.sin(clamp01(1 - world.dodgeTime / 0.48) * Math.PI);
    rig.position.y -= arc * 0.15;
    rig.rotation.z -= arc * 0.22;
  }
  const glow = spellGlow.material as THREE.MeshBasicMaterial;
  glow.opacity =
    world.attackKind === 'skill' && world.attackAnim > 0 ? 0.72 : impact * 0.35;
  spellGlow.scale.setScalar(1 + Math.sin(elapsed * 8) * 0.08 + impact * 1.2);
}

function buildFieldBase(site: RenderBase, ghost = false) {
  const root = new THREE.Group();
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: 0x69dcb2,
    transparent: true,
    opacity: 0.32,
    roughness: 0.8,
    depthWrite: false,
  });
  const stone = ghost ? ghostMaterial : mats.stoneDark;
  const wood = ghost ? ghostMaterial : mats.wood;
  const width = 2.8 + Math.min(site.level, 6) * 0.16;
  mesh(
    new RoundedBoxGeometry(width, 0.3, 2.5, 2, 0.06),
    stone,
    [1, 1, 1],
    [0, 0.15, 0],
    root,
  );
  for (const x of [-width / 2 + 0.18, width / 2 - 0.18])
    mesh(geo.box, stone, [0.22, 1.7, 1.2], [x, 1.0, 0], root);
  mesh(geo.box, stone, [0.95, 1.7, 0.18], [-0.92, 1.0, -1.15], root);
  mesh(geo.box, stone, [0.95, 1.7, 0.18], [0.92, 1.0, -1.15], root);
  mesh(geo.box, stone, [width / 2, 0.18, 1.25], [0, 1.92, 0], root);
  for (const x of [-1.1, 1.1])
    mesh(geo.cylinder, wood, [0.07, 1.1, 0.07], [x, 1.05, 1.05], root);
  const banner = mesh(
    geo.box,
    ghost ? ghostMaterial : mats.cloth,
    [0.45, 0.6, 0.025],
    [0, 2.35, 0.05],
    root,
  );
  banner.castShadow = !ghost;
  root.position.set(worldX(site.x), 0, worldZ(site.y));
  root.rotation.y = site.yaw;
  root.userData.ghostMaterial = ghostMaterial;
  return root;
}

function buildRiggedMob(mob: RenderMob) {
  const root = new THREE.Group();
  addShadow(root, mob.boss ? 0.82 : 0.46);
  const motion = new THREE.Group();
  root.add(motion);
  const baseMat = mob.ally ? mats.ally : mats.enemy;
  const scale = mob.boss ? 1.35 : 1 + Math.min(mob.tier, 6) * 0.045;
  let kind: 'humanoid' | 'quadruped' | 'slime' = 'humanoid';
  let torso: THREE.Group | undefined,
    head: THREE.Group | undefined,
    pelvis: THREE.Group | undefined,
    legs: JointLimb[] = [],
    arms: JointLimb[] = [],
    tail: THREE.Object3D | undefined,
    slimeBody: THREE.Mesh | undefined;
  if (/ウルフ|ハウンド|サラマンダー/.test(mob.name)) {
    kind = 'quadruped';
    torso = new THREE.Group();
    torso.position.y = 0.66;
    motion.add(torso);
    mesh(geo.lowSphere, baseMat, [0.58, 0.34, 0.88], [0, 0, 0], torso);
    head = new THREE.Group();
    head.position.set(0, 0.08, 0.72);
    torso.add(head);
    mesh(geo.lowSphere, baseMat, [0.4, 0.38, 0.44], [0, 0, 0], head);
    addEyes(head, 0.06, 0.39, 0.13, 0.04);
    for (const side of [-1, 1]) {
      for (const z of [-0.48, 0.48]) {
        const limb = createJointLimb(
          torso,
          [side * 0.34, -0.1, z],
          0.34,
          0.28,
          0.085,
          mats.leather,
          side,
          true,
        );
        legs.push(limb);
      }
    }
    tail = mesh(geo.cone, baseMat, [0.12, 0.65, 0.12], [0, 0.08, -0.76], torso);
    tail.rotation.x = -1.08;
    for (const side of [-1, 1]) {
      const ear = mesh(
        geo.cone,
        mats.iron,
        [0.1, 0.28, 0.1],
        [side * 0.23, 0.34, 0],
        head,
      );
      ear.rotation.z = side * 0.18;
    }
  } else if (/スライム/.test(mob.name)) {
    kind = 'slime';
    slimeBody = mesh(
      new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.78),
      baseMat,
      [0.62, 0.52, 0.62],
      [0, 0.12, 0],
      motion,
    );
    addEyes(motion, 0.48, 0.54, 0.16, 0.055);
  } else {
    const large = mob.tier >= 3 || mob.boss;
    pelvis = new THREE.Group();
    pelvis.position.y = large ? 1.0 : 0.76;
    motion.add(pelvis);
    const upperLeg = large ? 0.52 : 0.4;
    const lowerLeg = large ? 0.48 : 0.36;
    legs = [
      createJointLimb(
        pelvis,
        [large ? -0.26 : -0.2, 0, 0],
        upperLeg,
        lowerLeg,
        large ? 0.15 : 0.11,
        baseMat,
        -1,
        true,
      ),
      createJointLimb(
        pelvis,
        [large ? 0.26 : 0.2, 0, 0],
        upperLeg,
        lowerLeg,
        large ? 0.15 : 0.11,
        baseMat,
        1,
        true,
      ),
    ];
    torso = new THREE.Group();
    pelvis.add(torso);
    mesh(
      new RoundedBoxGeometry(
        large ? 0.84 : 0.6,
        large ? 0.88 : 0.68,
        large ? 0.5 : 0.4,
        2,
        0.07,
      ),
      baseMat,
      [1, 1, 1],
      [0, large ? 0.43 : 0.34, 0],
      torso,
    );
    if (large)
      mesh(
        new RoundedBoxGeometry(0.75, 0.42, 0.1, 2, 0.04),
        mats.iron,
        [1, 1, 1],
        [0, 0.5, 0.29],
        torso,
      );
    const armY = large ? 0.7 : 0.54;
    arms = [
      createJointLimb(
        torso,
        [large ? -0.5 : -0.38, armY, 0],
        large ? 0.46 : 0.34,
        large ? 0.42 : 0.31,
        large ? 0.13 : 0.095,
        baseMat,
        -1,
      ),
      createJointLimb(
        torso,
        [large ? 0.5 : 0.38, armY, 0],
        large ? 0.46 : 0.34,
        large ? 0.42 : 0.31,
        large ? 0.13 : 0.095,
        baseMat,
        1,
      ),
    ];
    if (large)
      for (const arm of arms)
        mesh(geo.sphere, mats.iron, [0.24, 0.18, 0.26], [0, 0, 0], arm.upper);
    head = new THREE.Group();
    head.position.y = large ? 1.04 : 0.82;
    torso.add(head);
    mesh(
      geo.sphere,
      baseMat,
      [large ? 0.34 : 0.27, large ? 0.36 : 0.29, large ? 0.32 : 0.26],
      [0, 0, 0.03],
      head,
    );
    addEyes(
      head,
      0.01,
      large ? 0.32 : 0.27,
      large ? 0.12 : 0.09,
      large ? 0.05 : 0.04,
    );
    for (const side of [-1, 1]) {
      const horn = mesh(
        geo.cone,
        mats.iron,
        [large ? 0.11 : 0.08, large ? 0.38 : 0.28, large ? 0.11 : 0.08],
        [side * (large ? 0.27 : 0.21), large ? 0.34 : 0.28, 0],
        head,
      );
      horn.rotation.z = side * -0.42;
    }
    if (mob.boss) {
      mesh(
        new THREE.TorusGeometry(0.35, 0.055, 6, 10),
        mats.gold,
        [1, 1, 1],
        [0, 0.34, 0],
        head,
      ).rotation.x = Math.PI / 2;
      const blade = buildWeapon('berserker', 0xd84a3c);
      blade.position.set(0, -0.02, 0);
      arms[1].end.add(blade);
    }
  }
  motion.scale.setScalar(scale);
  const bar = buildHealthBar(!!mob.boss);
  bar.position.y =
    (mob.boss ? 3.25 : kind === 'quadruped' ? 1.85 : 2.55) * scale;
  root.add(bar);
  root.userData = {
    kind,
    motion,
    pelvis,
    torso,
    head,
    legs,
    arms,
    tail,
    slimeBody,
    bar,
    ally: !!mob.ally,
    baseScale: scale,
    gait: mob.id * 0.71,
    speedBlend: 0,
    yaw: 0,
    prevX: Number.NaN,
    prevY: Number.NaN,
  };
  return root;
}

function makeHammer(parent: THREE.Object3D) {
  const hammer = new THREE.Group();
  mesh(geo.cylinder, mats.wood, [0.035, 0.42, 0.035], [0, 0.2, 0], hammer);
  mesh(geo.box, mats.iron, [0.26, 0.13, 0.12], [0, 0.6, 0], hammer);
  hammer.position.set(0, -0.03, 0);
  parent.add(hammer);
  return hammer;
}

function buildConstructionCrew(mobile: boolean) {
  const root = new THREE.Group();
  for (const x of [-1.25, 1.25]) {
    mesh(geo.cylinder, mats.wood, [0.055, 1.4, 0.055], [x, 1.35, 0], root);
    mesh(geo.cylinder, mats.wood, [0.055, 1.4, 0.055], [x, 1.35, 1.05], root);
  }
  for (const y of [0.55, 1.55, 2.45]) {
    const beam = mesh(
      geo.cylinder,
      mats.wood,
      [0.045, 1.3, 0.045],
      [0, y, 0],
      root,
    );
    beam.rotation.z = Math.PI / 2;
  }
  const workers: THREE.Group[] = [];
  const positions = mobile
    ? [new THREE.Vector3(-0.8, 0, 1.15), new THREE.Vector3(0.85, 0, 1.25)]
    : [
        new THREE.Vector3(-0.9, 0, 1.15),
        new THREE.Vector3(0, 0, 1.45),
        new THREE.Vector3(0.9, 0, 1.15),
      ];
  positions.forEach((position, index) => {
    const worker = buildRiggedMob({
      id: -10 - index,
      x: 0,
      y: 0,
      hp: 1,
      max: 1,
      name: '建築インプ',
      tier: 1,
      ally: true,
      home: 'ruins',
    });
    worker.position.copy(position);
    worker.rotation.y = Math.PI;
    worker.scale.setScalar(0.82);
    worker.userData.bar.visible = false;
    const arms = worker.userData.arms as JointLimb[];
    worker.userData.hammer = makeHammer(arms[1].end);
    const dustMaterial = new THREE.MeshBasicMaterial({
      color: 0xd6ad7d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const dust = mesh(
      new THREE.RingGeometry(0.08, 0.22, 12),
      dustMaterial,
      [1, 1, 1],
      [0, 0.03, 0.62],
      worker,
      false,
    );
    dust.rotation.x = -Math.PI / 2;
    worker.userData.dust = dust;
    root.add(worker);
    workers.push(worker);
  });
  root.userData.workers = workers;
  root.visible = false;
  return root;
}

// oxlint-disable-next-line no-unused-vars -- paired with the retained third-person inspection rig
function animatePlayerRig(
  player: THREE.Group,
  world: RenderWorld,
  dt: number,
  elapsed: number,
  speedScene: number,
) {
  const data = player.userData;
  const motion = data.motion as THREE.Group,
    pelvis = data.pelvis as THREE.Group,
    torso = data.torso as THREE.Group,
    head = data.head as THREE.Group,
    legs = data.legs as JointLimb[],
    arms = data.arms as JointLimb[],
    weapon = data.weapon as THREE.Group,
    cape = data.cape as THREE.Mesh,
    aura = data.aura as THREE.Mesh;
  const targetSpeed = clamp01(speedScene / 3.45);
  data.speedBlend = THREE.MathUtils.damp(data.speedBlend, targetSpeed, 9, dt);
  data.guardBlend = THREE.MathUtils.damp(
    data.guardBlend,
    world.guarding ? 1 : 0,
    13,
    dt,
  );
  const locomotion = data.speedBlend as number;
  const runBlend = smoothRange(0.42, 0.9, locomotion);
  data.gait += dt * (2.2 + speedScene * 4.25);
  const phase = data.gait as number;
  const breath = Math.sin(elapsed * 2.15);
  motion.position.set(0, 0, 0);
  motion.rotation.set(0, 0, 0);
  pelvis.position.set(
    0,
    0.9 + Math.abs(Math.sin(phase * 2)) * 0.045 * locomotion,
    0,
  );
  pelvis.rotation.set(0, Math.sin(phase) * 0.075 * locomotion, 0);
  torso.position.set(0, 0.02 + breath * 0.008 * (1 - locomotion), 0);
  torso.rotation.set(
    -0.05 * runBlend,
    0,
    -Math.sin(phase) * 0.025 * locomotion,
  );
  torso.scale.set(1 - breath * 0.004, 1 + breath * 0.009, 1 - breath * 0.004);
  head.rotation.set(
    Math.sin(elapsed * 1.1) * 0.018 * (1 - locomotion),
    Math.sin(elapsed * 0.63) * 0.045 * (1 - locomotion),
    -torso.rotation.z * 0.65,
  );
  legs.forEach((leg, index) => {
    const wave = Math.sin(phase + index * Math.PI);
    leg.upper.rotation.set(wave * (0.42 + runBlend * 0.34) * locomotion, 0, 0);
    leg.lower.rotation.set(
      Math.max(0, -wave) * (0.56 + runBlend * 0.62) * locomotion,
      0,
      0,
    );
    leg.end.rotation.x = Math.max(0, wave) * -0.28 * locomotion;
  });
  arms.forEach((arm, index) => {
    const wave = Math.sin(phase + index * Math.PI);
    arm.upper.rotation.set(
      -wave * (0.25 + runBlend * 0.22) * locomotion,
      0,
      arm.side * 0.07,
    );
    arm.lower.rotation.set(-0.08 - Math.max(0, wave) * 0.18 * locomotion, 0, 0);
    arm.end.rotation.set(0, 0, 0);
  });
  weapon.rotation.set(0, 0, -0.24);
  cape.rotation.x =
    -0.08 -
    locomotion * (0.14 + runBlend * 0.12) +
    Math.sin(elapsed * 3.3) * 0.025;
  const guard = data.guardBlend as number;
  if (guard > 0.001) {
    arms[0].upper.rotation.x = THREE.MathUtils.lerp(
      arms[0].upper.rotation.x,
      -1.14,
      guard,
    );
    arms[0].upper.rotation.z = THREE.MathUtils.lerp(
      arms[0].upper.rotation.z,
      -0.33,
      guard,
    );
    arms[0].lower.rotation.x = THREE.MathUtils.lerp(
      arms[0].lower.rotation.x,
      -0.52,
      guard,
    );
    torso.rotation.y -= 0.18 * guard;
    pelvis.position.y -= 0.07 * guard;
  }
  data.shield.visible = guard > 0.04;
  let impact = 0;
  if (world.attackAnim > 0 && world.attackTotal > 0) {
    const progress = clamp01(1 - world.attackAnim / world.attackTotal);
    const heavy = world.attackKind === 'heavy' ? 1.28 : 1;
    const windEnd = world.attackKind === 'heavy' ? 0.34 : 0.24;
    const wind =
      smoothRange(0, windEnd, progress) *
      (1 - smoothRange(windEnd + 0.06, 0.54, progress));
    const strike =
      smoothRange(windEnd, 0.53, progress) *
      (1 - smoothRange(0.64, 0.94, progress));
    const step =
      smoothRange(windEnd * 0.65, 0.46, progress) *
      (1 - smoothRange(0.58, 0.92, progress));
    impact = Math.max(0, 1 - Math.abs(progress - 0.53) / 0.13);
    if (world.attackKind === 'skill') {
      const gather =
        smoothRange(0, 0.34, progress) *
        (1 - smoothRange(0.38, 0.56, progress));
      const release =
        smoothRange(0.34, 0.58, progress) *
        (1 - smoothRange(0.74, 1, progress));
      arms[0].upper.rotation.x -= 0.95 * gather;
      arms[1].upper.rotation.x -= 0.95 * gather;
      arms[0].upper.rotation.z -= 0.72 * gather + 0.48 * release;
      arms[1].upper.rotation.z += 0.72 * gather + 0.48 * release;
      torso.rotation.x -= 0.16 * gather;
      torso.rotation.x += 0.24 * release;
      pelvis.position.y -= 0.11 * gather;
      motion.position.y += 0.08 * release;
    } else {
      torso.rotation.y += (-0.48 * wind + 0.62 * strike) * heavy;
      torso.rotation.x += (0.12 * wind - 0.18 * strike) * heavy;
      pelvis.rotation.y += (-0.22 * wind + 0.28 * strike) * heavy;
      pelvis.position.y -= 0.1 * wind * heavy;
      motion.position.z += 0.3 * step * heavy;
      arms[1].upper.rotation.x += (-1.12 * wind + 1.38 * strike) * heavy;
      arms[1].upper.rotation.z += (-0.78 * wind + 0.52 * strike) * heavy;
      arms[1].lower.rotation.x += (-0.72 * wind + 0.3 * strike) * heavy;
      arms[0].upper.rotation.x += -0.34 * wind + 0.48 * strike;
      weapon.rotation.z += (0.94 * wind - 1.32 * strike) * heavy;
      legs[0].upper.rotation.x -= 0.28 * wind;
      legs[1].upper.rotation.x += 0.36 * step;
      legs[0].lower.rotation.x += 0.42 * wind;
    }
  }
  if (world.dodgeTime > 0) {
    const progress = clamp01(1 - world.dodgeTime / 0.48);
    const arc = Math.sin(progress * Math.PI);
    motion.rotation.z -= arc * 0.72;
    motion.rotation.x -= arc * 0.24;
    motion.position.y -= arc * 0.22;
    torso.rotation.x += arc * 0.42;
    legs.forEach((leg) => {
      leg.upper.rotation.x += arc * 0.5;
      leg.lower.rotation.x += arc * 0.75;
    });
    cape.rotation.x -= arc * 0.45;
  }
  if (world.hitAnim > 0) {
    const hit = Math.sin(clamp01(1 - world.hitAnim / 0.34) * Math.PI);
    torso.rotation.x += hit * 0.38;
    head.rotation.x -= hit * 0.22;
    motion.position.z -= hit * 0.13;
  }
  aura.visible = impact > 0.03 || world.attackKind === 'skill';
  const auraMaterial = aura.material as THREE.MeshBasicMaterial;
  const skillGlow =
    world.attackKind === 'skill' && world.attackAnim > 0 ? 0.45 : 0;
  auraMaterial.opacity = Math.min(0.82, impact * 0.75 + skillGlow);
  aura.scale.setScalar(1 + impact * 1.65 + skillGlow * 0.7);
}

function animateMobRig(
  object: THREE.Group,
  mob: RenderMob,
  dt: number,
  elapsed: number,
  speedScene: number,
  desiredYaw: number,
) {
  const data = object.userData;
  const motion = data.motion as THREE.Group;
  data.speedBlend = THREE.MathUtils.damp(
    data.speedBlend,
    mob.dead ? 0 : clamp01(speedScene / (mob.boss ? 1.15 : 1.65)),
    8,
    dt,
  );
  data.yaw = dampAngle(data.yaw, desiredYaw, mob.boss ? 5.5 : 9, dt);
  object.rotation.y = data.yaw;
  const locomotion = data.speedBlend as number;
  data.gait += dt * (2 + speedScene * (mob.boss ? 4.2 : 5.2));
  const phase = data.gait as number;
  motion.position.set(0, 0, 0);
  motion.rotation.set(0, 0, 0);
  motion.scale.setScalar(data.baseScale as number);
  if (data.kind === 'humanoid') {
    const pelvis = data.pelvis as THREE.Group,
      torso = data.torso as THREE.Group,
      head = data.head as THREE.Group,
      legs = data.legs as JointLimb[],
      arms = data.arms as JointLimb[];
    data.pelvisBase ??= pelvis.position.y;
    pelvis.position.set(
      0,
      data.pelvisBase + Math.abs(Math.sin(phase * 2)) * 0.035 * locomotion,
      0,
    );
    pelvis.rotation.set(0, Math.sin(phase) * 0.07 * locomotion, 0);
    torso.rotation.set(
      -0.05 * locomotion,
      0,
      -Math.sin(phase) * 0.035 * locomotion,
    );
    head.rotation.set(
      Math.sin(elapsed * 1.2 + mob.id) * 0.025 * (1 - locomotion),
      Math.sin(elapsed * 0.7 + mob.id) * 0.055 * (1 - locomotion),
      0,
    );
    legs.forEach((leg, index) => {
      const wave = Math.sin(phase + index * Math.PI);
      leg.upper.rotation.set(wave * 0.56 * locomotion, 0, 0);
      leg.lower.rotation.set(Math.max(0, -wave) * 0.78 * locomotion, 0, 0);
      leg.end.rotation.x = Math.max(0, wave) * -0.25 * locomotion;
    });
    arms.forEach((arm, index) => {
      const wave = Math.sin(phase + index * Math.PI);
      arm.upper.rotation.set(-wave * 0.32 * locomotion, 0, arm.side * 0.08);
      arm.lower.rotation.set(-0.12, 0, 0);
    });
    if ((mob.attackAnim || 0) > 0) {
      const progress = clamp01(
        1 - (mob.attackAnim || 0) / (mob.attackTotal || 0.78),
      );
      const wind =
        smoothRange(0, mob.boss ? 0.38 : 0.28, progress) *
        (1 - smoothRange(mob.boss ? 0.43 : 0.34, 0.54, progress));
      const strike =
        smoothRange(mob.boss ? 0.36 : 0.26, 0.56, progress) *
        (1 - smoothRange(0.68, 0.96, progress));
      const weight = mob.boss ? 1.38 : 1;
      pelvis.position.y -= wind * 0.11 * weight;
      motion.position.z +=
        smoothRange(0.25, 0.55, progress) *
        (1 - smoothRange(0.64, 0.95, progress)) *
        0.25 *
        weight;
      torso.rotation.y += (-0.38 * wind + 0.52 * strike) * weight;
      torso.rotation.x += (0.2 * wind - 0.32 * strike) * weight;
      arms[1].upper.rotation.x += (-1.15 * wind + 1.48 * strike) * weight;
      arms[1].upper.rotation.z += (-0.65 * wind + 0.5 * strike) * weight;
      arms[1].lower.rotation.x += -0.55 * wind + 0.28 * strike;
      arms[0].upper.rotation.x += -0.28 * wind + 0.4 * strike;
      legs[0].lower.rotation.x += wind * 0.45;
    }
  } else if (data.kind === 'quadruped') {
    const torso = data.torso as THREE.Group,
      head = data.head as THREE.Group,
      legs = data.legs as JointLimb[],
      tail = data.tail as THREE.Object3D;
    torso.position.y =
      0.66 + Math.abs(Math.sin(phase * 2)) * 0.035 * locomotion;
    torso.rotation.set(Math.sin(phase * 2) * 0.035 * locomotion, 0, 0);
    const offsets = [0, Math.PI, Math.PI, 0];
    legs.forEach((leg, index) => {
      const wave = Math.sin(phase + offsets[index]);
      leg.upper.rotation.x = wave * 0.62 * locomotion;
      leg.lower.rotation.x = Math.max(0, -wave) * 0.72 * locomotion;
    });
    head.rotation.set(
      -torso.rotation.x + Math.sin(elapsed * 1.7 + mob.id) * 0.025,
      0,
      0,
    );
    tail.rotation.z = Math.sin(elapsed * 4.2 + mob.id) * 0.28;
    if ((mob.attackAnim || 0) > 0) {
      const progress = clamp01(
        1 - (mob.attackAnim || 0) / (mob.attackTotal || 0.78),
      );
      const crouch =
        smoothRange(0, 0.3, progress) * (1 - smoothRange(0.36, 0.52, progress));
      const leap =
        smoothRange(0.28, 0.54, progress) *
        (1 - smoothRange(0.68, 0.96, progress));
      torso.position.y -= crouch * 0.18;
      motion.position.z += leap * 0.38;
      motion.position.y += leap * 0.12;
      head.rotation.x -= crouch * 0.35;
      head.rotation.x += leap * 0.48;
      legs.forEach((leg) => (leg.lower.rotation.x += crouch * 0.62));
    }
  } else {
    const slimeBody = data.slimeBody as THREE.Mesh;
    const bounce = Math.sin(phase * 2);
    slimeBody.scale.set(
      0.62 * (1 - bounce * 0.08 * locomotion),
      0.52 * (1 + Math.abs(bounce) * 0.18 * locomotion),
      0.62 * (1 - bounce * 0.08 * locomotion),
    );
    motion.position.y = Math.max(0, bounce) * 0.12 * locomotion;
    if ((mob.attackAnim || 0) > 0) {
      const progress = clamp01(
        1 - (mob.attackAnim || 0) / (mob.attackTotal || 0.78),
      );
      const squash =
        smoothRange(0, 0.34, progress) *
        (1 - smoothRange(0.42, 0.56, progress));
      const stretch =
        smoothRange(0.32, 0.58, progress) *
        (1 - smoothRange(0.7, 0.96, progress));
      slimeBody.scale.y *= 1 - squash * 0.36 + stretch * 0.58;
      slimeBody.scale.x *= 1 + squash * 0.24 - stretch * 0.18;
      slimeBody.scale.z *= 1 + squash * 0.24 - stretch * 0.18;
      motion.position.z += stretch * 0.32;
    }
  }
  if ((mob.hitAnim || 0) > 0 && !mob.dead) {
    const hit = Math.sin(clamp01(1 - (mob.hitAnim || 0) / 0.34) * Math.PI);
    motion.rotation.x += hit * 0.34;
    motion.position.z -= hit * 0.18;
  }
  if (mob.dead) {
    const death = smoothRange(0, 0.72, 1 - (mob.deathAnim || 0) / 1.15);
    motion.rotation.z = -death * Math.PI * 0.48;
    motion.rotation.x += death * 0.18;
    motion.position.y -= death * 0.24;
    motion.scale.y *= 1 - death * 0.12;
  }
}

function animateConstruction(
  crew: THREE.Group,
  world: RenderWorld,
  elapsed: number,
) {
  crew.visible = world.buildAnim > 0;
  if (!crew.visible) return;
  const workers = crew.userData.workers as THREE.Group[];
  workers.forEach((worker, index) => {
    const data = worker.userData,
      motion = data.motion as THREE.Group,
      torso = data.torso as THREE.Group,
      legs = data.legs as JointLimb[],
      arms = data.arms as JointLimb[],
      dust = data.dust as THREE.Mesh;
    const cycle = (elapsed * 1.35 + index * 0.29) % 1;
    const wind =
      smoothRange(0, 0.3, cycle) * (1 - smoothRange(0.34, 0.48, cycle));
    const strike =
      smoothRange(0.3, 0.52, cycle) * (1 - smoothRange(0.62, 0.9, cycle));
    const impact = Math.max(0, 1 - Math.abs(cycle - 0.53) / 0.075);
    motion.position.set(0, Math.sin(elapsed * 2 + index) * 0.01, 0);
    motion.rotation.set(0, 0, 0);
    torso.rotation.set(0.18 * wind - 0.36 * strike, -0.12 * wind, 0);
    arms[1].upper.rotation.set(-1.55 * wind + 1.35 * strike, 0, 0.18);
    arms[1].lower.rotation.set(-0.88 * wind + 0.34 * strike, 0, 0);
    arms[0].upper.rotation.set(-0.72 * wind + 0.52 * strike, 0, -0.18);
    arms[0].lower.rotation.set(-0.35, 0, 0);
    legs[0].upper.rotation.x = 0.18 * wind;
    legs[1].upper.rotation.x = -0.12 * wind;
    legs.forEach((leg) => (leg.lower.rotation.x = 0.32 * wind));
    const dustMaterial = dust.material as THREE.MeshBasicMaterial;
    dustMaterial.opacity = impact * 0.55;
    dust.scale.setScalar(0.6 + impact * 1.65);
  });
}

function buildResource(node: RenderNode) {
  const root = new THREE.Group();
  addShadow(root, 0.32);
  if (node.kind === 'wood') {
    for (let i = -1; i <= 1; i++) {
      const log = mesh(
        geo.cylinder,
        mats.wood,
        [0.13, 0.5, 0.13],
        [i * 0.18, 0.22, 0],
        root,
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = i * 0.18;
      mesh(
        geo.cylinder,
        mats.woodCut,
        [0.132, 0.012, 0.132],
        [i * 0.18 + 0.5, 0.22, 0],
        root,
      ).rotation.z = Math.PI / 2;
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const crystal = mesh(
        geo.octa,
        mats.crystal,
        [0.18 + i * 0.035, 0.48 - i * 0.07, 0.18 + i * 0.035],
        [(i - 1) * 0.22, 0.38, 0],
        root,
      );
      crystal.rotation.z = (i - 1) * 0.18;
    }
  }
  return root;
}

function seeded(n: number) {
  const x = Math.sin(n * 9283.17 + 17.3) * 43758.5453;
  return x - Math.floor(x);
}

function addScatter(scene: THREE.Scene, region: RenderRegion, index: number) {
  const forest = region.biome === '森',
    count = forest ? 120 : region.biome === '魔族集落' ? 42 : 68;
  if (forest) {
    const trunks = new THREE.InstancedMesh(geo.cylinder, mats.wood, count),
      tops = new THREE.InstancedMesh(geo.lowSphere, mats.foliage, count),
      o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x =
          region.x + 50 + seeded(index * 91 + i) * Math.max(1, region.w - 100),
        y =
          region.y +
          50 +
          seeded(index * 137 + i + 30) * Math.max(1, region.h - 100),
        s = 0.9 + seeded(i + index * 7) * 1.35;
      o.position.set(worldX(x), 0.55 * s, worldZ(y));
      o.scale.set(0.14 * s, 1.1 * s, 0.14 * s);
      o.updateMatrix();
      trunks.setMatrixAt(i, o.matrix);
      o.position.y = 1.45 * s;
      o.scale.set(0.55 * s, 0.72 * s, 0.55 * s);
      o.rotation.y = seeded(i + 77) * Math.PI;
      o.updateMatrix();
      tops.setMatrixAt(i, o.matrix);
    }
    trunks.receiveShadow = tops.receiveShadow = true;
    scene.add(trunks, tops);
    return;
  }
  const material =
      region.biome === '火山'
        ? mats.stoneDark
        : region.biome === '荒野'
          ? mats.deadFoliage
          : mats.stone,
    rocks = new THREE.InstancedMesh(geo.rock, material, count),
    o = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const x =
        region.x + 35 + seeded(index * 117 + i) * Math.max(1, region.w - 70),
      y =
        region.y +
        35 +
        seeded(index * 151 + i + 20) * Math.max(1, region.h - 70),
      s = 0.18 + seeded(i + index * 17) * 0.42;
    o.position.set(worldX(x), s * 0.45, worldZ(y));
    o.scale.set(s, s * (0.55 + seeded(i + 9)), s);
    o.rotation.set(
      seeded(i) * 0.4,
      seeded(i + 4) * Math.PI,
      seeded(i + 8) * 0.3,
    );
    o.updateMatrix();
    rocks.setMatrixAt(i, o.matrix);
  }
  rocks.receiveShadow = true;
  scene.add(rocks);
}

function tower(parent: THREE.Object3D, x: number, z: number, h = 1.8) {
  mesh(geo.cylinder, mats.stone, [0.55, h, 0.55], [x, h / 2, z], parent);
  mesh(
    geo.cylinder,
    mats.stoneDark,
    [0.68, 0.18, 0.68],
    [x, h + 0.08, z],
    parent,
  );
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(
      geo.box,
      mats.stone,
      [0.2, 0.28, 0.2],
      [x + Math.sin(a) * 0.55, h + 0.28, z + Math.cos(a) * 0.55],
      parent,
    );
  }
}

function hut(parent: THREE.Object3D, x: number, z: number, cloth = mats.cloth) {
  mesh(
    new RoundedBoxGeometry(1.05, 0.7, 0.85, 2, 0.06),
    mats.wood,
    [1, 1, 1],
    [x, 0.38, z],
    parent,
  );
  const roof = mesh(
    new THREE.ConeGeometry(0.85, 0.65, 4),
    cloth,
    [1, 1, 1],
    [x, 1.03, z],
    parent,
  );
  roof.rotation.y = Math.PI / 4;
  mesh(geo.box, mats.stoneDark, [0.18, 0.4, 0.05], [x, 0.38, z + 0.44], parent);
}

function addLandmark(scene: THREE.Scene, region: RenderRegion, index: number) {
  const root = new THREE.Group();
  root.position.set(
    worldX(region.x + region.w * 0.68),
    0.03,
    worldZ(region.y + region.h * 0.5),
  );
  scene.add(root);
  if (region.biome === '森') {
    hut(root, -1.1, 0.2);
    hut(root, 0.9, -0.5, mats.enemy);
    tower(root, 0, 1.1, 1.25);
  } else if (region.biome === '魔族集落') {
    hut(root, -1.25, 0.25, mats.enemy);
    hut(root, 0, -0.55, mats.cloth);
    hut(root, 1.25, 0.2, mats.enemy);
    mesh(geo.cylinder, mats.wood, [0.05, 0.75, 0.05], [0, 0.75, 0.8], root);
  } else if (region.biome === '火山') {
    const mountain = mesh(
      new THREE.ConeGeometry(2.4, 2.7, 10, 2, true),
      mats.stoneDark,
      [1, 1, 1],
      [0, 1.32, 0],
      root,
    );
    mountain.receiveShadow = true;
    const crater = mesh(
      new THREE.TorusGeometry(0.72, 0.18, 8, 18),
      mats.lava,
      [1, 1, 1],
      [0, 2.66, 0],
      root,
    );
    crater.rotation.x = Math.PI / 2;
    mesh(
      new THREE.CircleGeometry(0.68, 20),
      mats.lava,
      [1, 1, 1],
      [0, 2.65, 0],
      root,
    ).rotation.x = -Math.PI / 2;
  } else if (region.biome === '洞窟') {
    for (let i = 0; i < 9; i++) {
      const a = (Math.PI * i) / 8;
      mesh(
        geo.rock,
        mats.stoneDark,
        [0.38, 0.5, 0.35],
        [Math.cos(a) * 1.4, Math.sin(a) * 1.35 + 0.25, 0.15],
        root,
      );
    }
    mesh(
      geo.box,
      new THREE.MeshBasicMaterial({ color: 0x05030a }),
      [2.1, 1.5, 0.12],
      [0, 0.7, 0.25],
      root,
      false,
    );
  } else if (region.biome === '荒野') {
    tower(root, 0, 0, 2.15);
    mesh(geo.cylinder, mats.wood, [0.06, 1.1, 0.06], [-1, 0.9, 0.25], root);
  } else if (
    region.biome === '城' ||
    region.biome === '砦' ||
    region.biome === '岩山'
  ) {
    tower(root, -1.35, 0, region.biome === '城' ? 2.45 : 1.85);
    tower(root, 1.35, 0, region.biome === '城' ? 2.45 : 1.85);
    mesh(
      new RoundedBoxGeometry(2.1, 1.45, 0.75, 2, 0.06),
      mats.stoneDark,
      [1, 1, 1],
      [0, 0.78, 0],
      root,
    );
    mesh(geo.box, mats.iron, [0.62, 1.05, 0.08], [0, 0.56, 0.42], root);
  } else {
    for (let i = -2; i <= 2; i++)
      mesh(
        geo.box,
        i % 2 ? mats.stone : mats.stoneLight,
        [0.46, 0.65 + Math.abs(i) * 0.15, 0.38],
        [i * 0.62, 0.35, (Math.abs(i) % 2) * 0.4],
        root,
      );
    hut(root, 0, -1.1);
  }
  const pole = mesh(
      geo.cylinder,
      mats.iron,
      [0.035, 1.05, 0.035],
      [0, 1.05, -1.2],
      root,
    ),
    flagMat = new THREE.MeshStandardMaterial({
      color: 0xd94d57,
      roughness: 0.86,
      side: THREE.DoubleSide,
    }),
    flag = mesh(
      geo.box,
      flagMat,
      [0.62, 0.34, 0.025],
      [0.62, 1.72, -1.2],
      root,
    );
  pole.castShadow = flag.castShadow = true;
  const landmarkScale =
    region.biome === '火山'
      ? 7
      : region.biome === '城'
        ? 5.4
        : region.biome === '岩山'
          ? 5
          : region.biome === '砦'
            ? 4.6
            : region.biome === '洞窟'
              ? 4.4
              : region.biome === '荒野'
                ? 4.1
                : 3.4;
  root.scale.setScalar(landmarkScale);
  root.userData = { regionId: region.id, flagMat, index };
  return root;
}

export function createGame3D(
  canvas: HTMLCanvasElement,
  regions: RenderRegion[],
) {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.15 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x100d19);
  scene.fog = new THREE.FogExp2(0x171321, mobile ? 0.0082 : 0.0062);
  const camera = new THREE.PerspectiveCamera(mobile ? 72 : 68, 1, 0.04, 340);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0x8194c7, 0x241222, 1.65));
  const sun = new THREE.DirectionalLight(0xffd4a3, 3.1);
  sun.position.set(-8, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 35;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x7054b8, 0.85);
  rim.position.set(10, 5, -10);
  scene.add(rim);
  const grounds: {
      region: RenderRegion;
      mat: THREE.MeshStandardMaterial;
      line: THREE.LineBasicMaterial;
    }[] = [],
    landmarks: THREE.Group[] = [];
  regions.forEach((region, i) => {
    const base = new THREE.Color(region.color).multiplyScalar(1.18),
      groundMat = new THREE.MeshStandardMaterial({
        color: base,
        roughness: region.biome === '火山' ? 0.82 : 0.97,
        metalness: 0,
      });
    const groundGeo = new THREE.PlaneGeometry(
        region.w * SCALE,
        region.h * SCALE,
        8,
        6,
      ),
      positions = groundGeo.attributes.position;
    for (let p = 0; p < positions.count; p++) {
      const x = positions.getX(p),
        y = positions.getY(p),
        edge = Math.min(Math.abs(x), Math.abs(y));
      positions.setZ(
        p,
        (seeded(p + i * 31) - 0.5) * 0.13 + (edge < 0.1 ? 0 : 0),
      );
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(
      worldX(region.x + region.w / 2),
      -0.03,
      worldZ(region.y + region.h / 2),
    );
    ground.receiveShadow = true;
    scene.add(ground);
    const hw = (region.w * SCALE) / 2,
      hh = (region.h * SCALE) / 2,
      pts = [
        new THREE.Vector3(-hw, 0.035, -hh),
        new THREE.Vector3(hw, 0.035, -hh),
        new THREE.Vector3(hw, 0.035, hh),
        new THREE.Vector3(-hw, 0.035, hh),
      ],
      lineMat = new THREE.LineBasicMaterial({
        color: 0xa84655,
        transparent: true,
        opacity: 0.52,
      });
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      lineMat,
    );
    line.position.copy(ground.position);
    scene.add(line);
    grounds.push({ region, mat: groundMat, line: lineMat });
    addScatter(scene, region, i);
    const before = scene.children.length;
    addLandmark(scene, region, i);
    landmarks.push(scene.children[before] as THREE.Group);
  });
  const starGeo = new THREE.BufferGeometry(),
    starPos = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) {
    starPos[i * 3] = (seeded(i) - 0.5) * 46;
    starPos[i * 3 + 1] = 1 + seeded(i + 300) * 6;
    starPos[i * 3 + 2] = (seeded(i + 600) - 0.5) * 30;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const embers = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xd78b70,
      size: 0.045,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  scene.add(embers);
  let firstPersonRig = buildFirstPersonRig(''),
    playerJob = '';
  camera.add(firstPersonRig);
  const constructionCrew = buildConstructionCrew(mobile);
  scene.add(constructionCrew);
  const mobs = new Map<number, THREE.Group>(),
    nodes = new Map<number, THREE.Group>(),
    bases = new Map<number, THREE.Group>();
  const buildGhost = buildFieldBase(
    { id: -1, x: 0, y: 0, yaw: 0, level: 1 },
    true,
  );
  buildGhost.visible = false;
  scene.add(buildGhost);
  const armyBody = new THREE.InstancedMesh(
      geo.cylinder,
      mats.ally,
      mobile ? 24 : 48,
    ),
    armyHead = new THREE.InstancedMesh(
      geo.lowSphere,
      mats.skin,
      mobile ? 24 : 48,
    ),
    armyDummy = new THREE.Object3D();
  armyBody.castShadow = armyHead.castShadow = !mobile;
  armyBody.frustumCulled = armyHead.frustumCulled = false;
  scene.add(armyBody, armyHead);
  let elapsed = 0,
    lastX = Number.NaN,
    lastY = Number.NaN;
  const ensureSize = () => {
    const width = Math.max(1, canvas.clientWidth),
      height = Math.max(1, canvas.clientHeight);
    if (
      canvas.width !== Math.floor(width * renderer.getPixelRatio()) ||
      canvas.height !== Math.floor(height * renderer.getPixelRatio())
    ) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  };
  const render = (world: RenderWorld, dt: number) => {
    elapsed += dt;
    ensureSize();
    if (world.job !== playerJob) {
      camera.remove(firstPersonRig);
      firstPersonRig = buildFirstPersonRig(world.job);
      camera.add(firstPersonRig);
      playerJob = world.job;
      lastX = world.x;
      lastY = world.y;
    }
    const px = worldX(world.x),
      pz = worldZ(world.y),
      playerDistance = Number.isFinite(lastX)
        ? Math.hypot(world.x - lastX, world.y - lastY)
        : 0,
      playerSpeedScene = (playerDistance / Math.max(dt, 0.001)) * SCALE;
    lastX = world.x;
    lastY = world.y;
    animateFirstPersonRig(firstPersonRig, world, dt, elapsed, playerSpeedScene);
    const locomotion = clamp01(playerSpeedScene / 3.8),
      headBob =
        Math.abs(Math.sin(elapsed * (5.2 + playerSpeedScene * 1.5))) *
        0.025 *
        locomotion;
    camera.position.set(px, 1.68 + world.height + headBob, pz);
    camera.rotation.set(world.viewPitch, Math.PI + world.viewYaw, 0);
    let cameraRoll = Math.sin(elapsed * 5.4) * 0.0025 * locomotion,
      cameraKick = 0;
    if (world.attackAnim > 0 && world.attackTotal > 0) {
      const progress = clamp01(1 - world.attackAnim / world.attackTotal);
      cameraKick = Math.max(0, 1 - Math.abs(progress - 0.53) / 0.12);
      cameraRoll +=
        Math.sin(progress * Math.PI) *
        (world.attackKind === 'heavy' ? 0.026 : 0.014);
    }
    if (world.hitAnim > 0) cameraRoll += Math.sin(elapsed * 36) * 0.018;
    camera.rotation.x += cameraKick * 0.009;
    camera.rotation.z = cameraRoll;
    const sprintFov =
      playerSpeedScene > 4.1 ? (mobile ? 78 : 75) : mobile ? 72 : 68;
    camera.fov = THREE.MathUtils.damp(camera.fov, sprintFov, 7, dt);
    camera.updateProjectionMatrix();
    const buildSite = world.bases[world.bases.length - 1];
    if (buildSite) {
      constructionCrew.position.set(
        worldX(buildSite.x),
        0,
        worldZ(buildSite.y),
      );
      constructionCrew.rotation.y = buildSite.yaw;
    }
    animateConstruction(constructionCrew, world, elapsed);
    const activeBases = new Set(world.bases.map((base) => base.id));
    for (const [id, base] of bases)
      if (!activeBases.has(id)) {
        scene.remove(base);
        bases.delete(id);
      }
    world.bases.forEach((site) => {
      let base = bases.get(site.id);
      if (!base) {
        base = buildFieldBase(site);
        bases.set(site.id, base);
        scene.add(base);
      }
      base.position.set(worldX(site.x), 0, worldZ(site.y));
      base.rotation.y = site.yaw;
      base.visible = Math.hypot(site.x - world.x, site.y - world.y) < 4200;
    });
    buildGhost.visible = world.buildMode;
    if (world.buildMode) {
      buildGhost.position.set(
        worldX(world.x + world.facingX * 320),
        0.02,
        worldZ(world.y + world.facingY * 320),
      );
      buildGhost.rotation.y = world.buildYaw;
    }
    const activeIds = new Set(world.mobs.map((m) => m.id));
    for (const [id, obj] of mobs)
      if (!activeIds.has(id)) {
        scene.remove(obj);
        mobs.delete(id);
      }
    let visibleAllies = 0;
    const detailedAllyLimit = mobile ? 4 : 8;
    world.mobs.forEach((mob) => {
      let obj = mobs.get(mob.id);
      if (obj && obj.userData.ally !== !!mob.ally) {
        scene.remove(obj);
        mobs.delete(mob.id);
        obj = undefined;
      }
      if (!obj) {
        obj = buildRiggedMob(mob);
        mobs.set(mob.id, obj);
        scene.add(obj);
      }
      const dx = mob.x - world.x,
        dy = mob.y - world.y,
        dist = Math.hypot(dx, dy);
      const allyAllowed = !mob.ally || visibleAllies < detailedAllyLimit;
      obj.visible = dist < (mobile ? 1050 : 1650) && allyAllowed;
      if (!obj.visible) return;
      if (mob.ally) visibleAllies++;
      const mobData = obj.userData;
      const previousX = mobData.prevX as number,
        previousY = mobData.prevY as number,
        velocityX = Number.isFinite(previousX) ? mob.x - previousX : 0,
        velocityY = Number.isFinite(previousY) ? mob.y - previousY : 0,
        moved = Math.hypot(velocityX, velocityY),
        speedScene = (moved / Math.max(dt, 0.001)) * SCALE;
      mobData.prevX = mob.x;
      mobData.prevY = mob.y;
      const desiredYaw =
        moved > 0.02
          ? Math.atan2(velocityX, velocityY)
          : Math.atan2(world.x - mob.x, world.y - mob.y);
      obj.position.set(worldX(mob.x), 0, worldZ(mob.y));
      animateMobRig(obj, mob, dt, elapsed, speedScene, desiredYaw);
      const bar = obj.userData.bar as THREE.Group;
      const parentQuaternion = new THREE.Quaternion();
      obj.getWorldQuaternion(parentQuaternion);
      bar.quaternion.copy(
        parentQuaternion.invert().multiply(camera.quaternion),
      );
      const fill = bar.userData.fill as THREE.Mesh,
        full = bar.userData.full as number,
        pct = Math.max(0, mob.hp / mob.max);
      fill.scale.x = pct;
      fill.position.x = -(full * (1 - pct)) / 2;
      (fill.material as THREE.MeshBasicMaterial).color.set(
        mob.ally ? 0x4de0b2 : mob.boss ? 0xff375f : 0xe95872,
      );
    });
    const proxyCapacity = mobile ? 24 : 48,
      proxyCount = Math.min(
        proxyCapacity,
        Math.max(0, world.minions - visibleAllies),
      ),
      forwardX = Math.sin(world.viewYaw),
      forwardZ = Math.cos(world.viewYaw),
      rightX = Math.cos(world.viewYaw),
      rightZ = -Math.sin(world.viewYaw);
    armyBody.count = armyHead.count = proxyCount;
    for (let i = 0; i < proxyCount; i++) {
      const row = Math.floor(i / 5),
        column = (i % 5) - 2,
        march = Math.sin(elapsed * 5.4 + i * 0.9) * 0.035,
        ax = px - forwardX * (2.4 + row * 0.82) + rightX * column * 0.64,
        az = pz - forwardZ * (2.4 + row * 0.82) + rightZ * column * 0.64;
      armyDummy.position.set(ax, 0.72 + march, az);
      armyDummy.rotation.set(0, world.viewYaw, 0);
      armyDummy.scale.set(0.3, 0.72, 0.3);
      armyDummy.updateMatrix();
      armyBody.setMatrixAt(i, armyDummy.matrix);
      armyDummy.position.y = 1.38 + march;
      armyDummy.scale.set(0.24, 0.24, 0.24);
      armyDummy.updateMatrix();
      armyHead.setMatrixAt(i, armyDummy.matrix);
    }
    armyBody.instanceMatrix.needsUpdate = true;
    armyHead.instanceMatrix.needsUpdate = true;
    const activeNodes = new Set(
      world.nodes.filter((n) => n.n > 0).map((n) => n.id),
    );
    for (const [id, obj] of nodes)
      if (!activeNodes.has(id)) {
        scene.remove(obj);
        nodes.delete(id);
      }
    world.nodes.forEach((node) => {
      if (node.n <= 0) return;
      let obj = nodes.get(node.id);
      if (!obj) {
        obj = buildResource(node);
        nodes.set(node.id, obj);
        scene.add(obj);
      }
      obj.visible =
        Math.hypot(node.x - world.x, node.y - world.y) < (mobile ? 620 : 820);
      obj.position.set(worldX(node.x), 0, worldZ(node.y));
      obj.rotation.y = elapsed * 0.18 + node.id;
      obj.scale.setScalar(0.82 + node.n * 0.05);
    });
    grounds.forEach((item) => {
      const territory = owner(world, item.region),
        own = territory === 'own';
      item.mat.emissive.set(
        own ? 0x0d4a37 : territory === 'enemy' ? 0x3b0710 : 0x000000,
      );
      item.mat.emissiveIntensity = own
        ? 0.25
        : territory === 'enemy'
          ? 0.12
          : 0;
      item.line.color.set(
        own ? 0x43d5a3 : territory === 'enemy' ? 0xd44959 : 0xd39357,
      );
    });
    landmarks.forEach((mark) => {
      const region = regions.find((r) => r.id === mark.userData.regionId)!;
      const territory = owner(world, region);
      (mark.userData.flagMat as THREE.MeshStandardMaterial).color.set(
        territory === 'own'
          ? 0x2eb68a
          : territory === 'enemy'
            ? 0xb83248
            : 0xc7773a,
      );
    });
    const bossImpact = world.mobs.some((mob) => {
      if (!mob.boss || !mob.attackAnim || !mob.attackTotal) return false;
      const progress = 1 - mob.attackAnim / mob.attackTotal;
      return (
        progress > 0.49 &&
        progress < 0.59 &&
        Math.hypot(mob.x - world.x, mob.y - world.y) < 180
      );
    });
    if (bossImpact) {
      camera.position.x += Math.sin(elapsed * 53) * 0.025;
      camera.position.y += Math.cos(elapsed * 47) * 0.018;
    }
    sun.position.set(px - 8, 14, pz + 7);
    sun.target.position.set(px, 0, pz);
    sun.target.updateMatrixWorld();
    embers.position.set(px, 0, pz);
    embers.rotation.y = elapsed * 0.015;
    renderer.render(scene, camera);
  };
  const dispose = () => {
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    scene.traverse((o) => {
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Points ||
        o instanceof THREE.Line
      ) {
        if (o.geometry) geometries.add(o.geometry);
        const material = o.material as THREE.Material | THREE.Material[];
        (Array.isArray(material) ? material : [material]).forEach((m) =>
          materials.add(m),
        );
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    renderer.dispose();
  };
  return { render, dispose };
}
