import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  SCALE,
  worldX,
  worldZ,
  terrainHeight,
  regionAt,
  DISCOVERY_SITES,
  campResidentAt,
} from './world';
import { createLandscape } from './landscape';
import { createDemonArm, poseDemonArm, mountAtHandGrip } from './hands3d';
import {
  createCreatureLimbEnd,
  type CreatureLimbEnd,
  demonLimbGeometry,
  demonPelvisGeometry,
  demonShoulderGeometry,
  demonTorsoGeometry,
} from './demon-anatomy3d';
import { acquireRealmTextures, textureSurface } from './realm-textures';
import { createStructureModel } from './structures3d';
import {
  buildingHeightScale,
  plannedBuilding,
  placementIssue,
} from './structures';
import { createLootRenderer } from './loot3d';
import { createHazardRenderer } from './hazards3d';
import {
  weaponAppearance,
  type Equipment,
  type WeaponAppearance,
  type WorldLoot,
} from './items';
import {
  adaptiveRenderScale,
  DEFAULT_PREFERENCES,
  qualityProfile,
  type GamePreferences,
  type RenderPerformance,
} from './preferences';
import {
  creatureAttackImpactProgress,
  creatureAttackPose,
  type CreatureAttackPose,
  type MonsterMotionKind,
} from './creature-motion';

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
type MonsterKind = MonsterMotionKind;
const MONSTER_KINDS: MonsterKind[] = [
  'imp',
  'beast',
  'insect',
  'golem',
  'flying',
  'plant',
  'slime',
  'armored',
  'aberration',
];
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
  kind?: MonsterKind;
  variant?: number;
  home: string;
  attackAnim?: number;
  attackTotal?: number;
  attackCd?: number;
  attackHit?: boolean;
  attackTarget?: number;
  hitAnim?: number;
  deathAnim?: number;
  dead?: boolean;
  recruitTime?: number;
  working?: boolean;
  workYaw?: number;
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
  kind: string;
  name: string;
  progress: number;
  duration: number;
  complete: boolean;
  workers: number;
};
export type RenderWorld = {
  preferences?: GamePreferences;
  worldTime: number;
  loot: WorldLoot[];
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  job: string;
  equipment?: Pick<Equipment, 'weapon'>;
  rank: number;
  guarding: boolean;
  dodgeTime: number;
  attackAnim: number;
  attackTotal: number;
  attackKind: 'none' | 'normal' | 'heavy' | 'skill';
  hitAnim: number;
  buildAnim: number;
  buildMode: boolean;
  buildYaw: number;
  selectedBuilding: string;
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

const sharedGeometry = new Set<THREE.BufferGeometry>(Object.values(geo));
const sharedMaterial = new Set<THREE.Material>(Object.values(mats));
let graphicsOwners = 0;
function acquireGraphics(renderer: THREE.WebGLRenderer) {
  const lease = acquireRealmTextures(renderer.capabilities.getMaxAnisotropy());
  for (const name of ['stone', 'stoneDark', 'stoneLight'] as const)
    textureSurface(mats[name], lease.textures.stone, 0.035);
  textureSurface(mats.wood, lease.textures.wood, 0.02);
  textureSurface(mats.woodCut, lease.textures.wood, 0.012);
  graphicsOwners++;
  let released = false;
  return {
    textures: lease.textures,
    release() {
      if (released) return;
      released = true;
      lease.release();
      if (--graphicsOwners === 0) {
        sharedGeometry.forEach((geometry) => geometry.dispose());
        sharedMaterial.forEach((material) => material.dispose());
      }
    },
  };
}
function releaseModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  root.traverse((part) => {
    if (
      !(
        part instanceof THREE.Mesh ||
        part instanceof THREE.Points ||
        part instanceof THREE.Line
      )
    )
      return;
    if (!sharedGeometry.has(part.geometry)) geometries.add(part.geometry);
    for (const material of Array.isArray(part.material)
      ? part.material
      : [part.material])
      if (!sharedMaterial.has(material)) materials.add(material);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}

function keepSharedAnatomy<T extends THREE.BufferGeometry>(geometry: T): T {
  sharedGeometry.add(geometry);
  return geometry;
}

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

function defaultWeaponAppearance(job: string): WeaponAppearance {
  if (job === 'mage' || job === 'nightseer') return 'staff';
  if (job === 'lancer' || job === 'dragoon') return 'spear';
  if (job === 'shadow') return 'dagger';
  if (job === 'berserker' || job === 'warlock') return 'axe';
  if (job === 'ruler') return 'sigil';
  return job ? 'sword' : 'bare';
}

function buildWeapon(source: string, color: number) {
  const kind = (
    ['bare', 'sword', 'axe', 'staff', 'dagger', 'spear', 'sigil'].includes(
      source,
    )
      ? source
      : defaultWeaponAppearance(source)
  ) as WeaponAppearance;
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
  const blade = (
    width: number,
    length: number,
    thickness: number,
    y: number,
    parent: THREE.Object3D = root,
  ) => {
    const shape = new THREE.Shape();
    shape.moveTo(-width * 0.5, 0);
    shape.lineTo(width * 0.5, 0);
    shape.lineTo(width * 0.43, length * 0.82);
    shape.lineTo(0, length);
    shape.lineTo(-width * 0.43, length * 0.82);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: thickness * 0.2,
      bevelThickness: thickness * 0.2,
      bevelSegments: 1,
      steps: 1,
    });
    geometry.translate(0, 0, -thickness * 0.5);
    mesh(geometry, magic, [1, 1, 1], [0, y, 0], parent);
  };
  if (kind === 'bare') {
    root.userData.magicMaterial = magic;
    return root;
  }
  if (kind === 'staff') {
    mesh(geo.cylinder, mats.wood, [0.045, 1.17, 0.045], [0, 0.27, 0], root);
    mesh(geo.cylinder, mats.gold, [0.065, 0.1, 0.065], [0, 0.83, 0], root);
    mesh(geo.sphere, magic, [0.17, 0.17, 0.17], [0, 1, 0], root);
    mesh(
      new THREE.TorusGeometry(0.22, 0.025, 6, 14),
      mats.gold,
      [1, 1, 1],
      [0, 1, 0],
      root,
    ).rotation.x = Math.PI / 2;
  } else if (kind === 'spear') {
    mesh(geo.cylinder, mats.wood, [0.035, 1.58, 0.035], [0, 0.415, 0], root);
    mesh(geo.cone, magic, [0.11, 0.45, 0.11], [0, 1.4, 0], root);
    mesh(geo.cylinder, mats.gold, [0.065, 0.09, 0.065], [0, 1.17, 0], root);
  } else if (kind === 'dagger') {
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
      blade(0.075, 0.45, 0.025, 0.18, dagger);
      mesh(geo.box, mats.gold, [0.17, 0.035, 0.05], [0, 0.16, 0], dagger);
      dagger.rotation.z = side * 0.12;
      root.add(dagger);
    }
  } else if (kind === 'axe') {
    handle();
    mesh(geo.cylinder, mats.iron, [0.045, 0.18, 0.045], [0, 0.44, 0], root);
    blade(0.18, 0.96, 0.055, 0.5);
    mesh(geo.box, mats.iron, [0.54, 0.22, 0.1], [0, 1.48, 0], root);
    mesh(geo.box, mats.gold, [0.32, 0.055, 0.11], [0, 0.57, 0], root);
  } else if (kind === 'sigil') {
    mesh(geo.cylinder, mats.iron, [0.03, 0.97, 0.03], [0, 0.395, 0], root);
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
    mesh(geo.cylinder, mats.iron, [0.04, 0.12, 0.04], [0, 0.41, 0], root);
    blade(0.095, 0.79, 0.03, 0.45);
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
  endStyle: CreatureLimbEnd = 'hand',
  endMaterial: THREE.Material = mats.skin,
  endAccent: THREE.Material = mats.iron,
): JointLimb {
  const upper = new THREE.Group();
  upper.position.set(...origin);
  parent.add(upper);
  mesh(
    keepSharedAnatomy(demonLimbGeometry(upperLength, radius)),
    material,
    [1, 1, 1],
    [0, 0, 0],
    upper,
  );
  const lower = new THREE.Group();
  lower.position.y = -upperLength;
  upper.add(lower);
  mesh(
    keepSharedAnatomy(demonLimbGeometry(lowerLength, radius * 0.88, true)),
    material,
    [1, 1, 1],
    [0, 0, 0],
    lower,
  );
  const end = new THREE.Group();
  end.position.y = -lowerLength;
  lower.add(end);
  const limbEnd = createCreatureLimbEnd(
    endStyle,
    endMaterial,
    endAccent,
    side,
    radius,
  );
  limbEnd.traverse((part) => {
    if (part instanceof THREE.Mesh) sharedGeometry.add(part.geometry);
  });
  end.add(limbEnd);
  return { upper, lower, end, side };
}

function buildRiggedPlayer(
  job: string,
  rank = 0,
  equippedWeapon?: string | null,
) {
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
  const rankRatio = rank / 7,
    skinColor = new THREE.Color(0x9564a5).lerp(
      new THREE.Color(0x4c315f),
      rankRatio,
    ),
    demonSkin = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.68 - rankRatio * 0.16,
      metalness: rank >= 6 ? 0.08 : 0.01,
    }),
    hornMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x34313b).lerp(
        new THREE.Color(0x130f19),
        rankRatio,
      ),
      roughness: 0.34,
      metalness: 0.24 + rankRatio * 0.18,
    }),
    bodyGlow = new THREE.MeshStandardMaterial({
      color: 0xb876ff,
      emissive: 0x6922c7,
      emissiveIntensity: 1.2 + rank * 0.55,
      roughness: 0.25,
    }),
    cloth = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).lerp(
        new THREE.Color(0x17131f),
        0.28 + rankRatio * 0.32,
      ),
      roughness: 0.9 - rankRatio * 0.16,
    }),
    hairMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x211b27).lerp(
        new THREE.Color(0x09070d),
        rankRatio * 0.72,
      ),
      roughness: 0.72,
      metalness: 0.04,
    }),
    mouthMaterial = new THREE.MeshStandardMaterial({
      color: 0x26131f,
      roughness: 0.78,
    });
  const armor =
    rank < 3 || job === 'mage' || job === 'ruler' || job === 'shadow'
      ? mats.leather
      : mats.iron;
  mesh(
    keepSharedAnatomy(demonPelvisGeometry(rank)),
    cloth,
    [1, 1, 1],
    [0, 0, 0],
    pelvis,
  );
  const legs = [
    createJointLimb(
      pelvis,
      [-0.2, 0, 0],
      0.52,
      0.46,
      0.115,
      cloth,
      -1,
      'boot',
      mats.skin,
      mats.leather,
    ),
    createJointLimb(
      pelvis,
      [0.2, 0, 0],
      0.52,
      0.46,
      0.115,
      cloth,
      1,
      'boot',
      mats.skin,
      mats.leather,
    ),
  ];
  const torso = new THREE.Group();
  torso.position.y = 0.02;
  pelvis.add(torso);
  mesh(
    keepSharedAnatomy(demonTorsoGeometry(rank)),
    cloth,
    [1, 1, 1],
    [0, 0, 0],
    torso,
  );
  if (rank > 0)
    mesh(
      new RoundedBoxGeometry(0.67, 0.5, 0.12 + rank * 0.006, 2, 0.04),
      armor,
      [1, 1, 1],
      [0, 0.49, 0.27],
      torso,
    );
  else {
    for (const side of [-1, 1]) {
      const strap = mesh(
        new RoundedBoxGeometry(0.09, 0.69, 0.055, 2, 0.018),
        mats.leather,
        [1, 1, 1],
        [side * 0.15, 0.46, 0.235],
        torso,
      );
      strap.rotation.z = side * -0.27;
    }
    mesh(
      new RoundedBoxGeometry(0.5, 0.115, 0.07, 3, 0.025),
      mats.leather,
      [1, 1, 1],
      [0, 0.29, 0.24],
      torso,
    );
  }
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
  for (const arm of arms) {
    mesh(
      keepSharedAnatomy(demonShoulderGeometry(0.105, rank)),
      rank >= 3 ? armor : cloth,
      [1, 1, 1],
      [0, 0, 0],
      arm.upper,
    );
    if (rank >= 2)
      mesh(
        geo.sphere,
        rank >= 5 ? mats.silver : armor,
        [0.18 + rank * 0.008, 0.14 + rank * 0.006, 0.21],
        [0, 0, 0],
        arm.upper,
      );
    arm.end.traverse((part) => {
      if (part instanceof THREE.Mesh && part.material === mats.skin)
        part.material = demonSkin;
    });
    if (rank >= 1)
      for (let claw = -1; claw <= 1; claw++) {
        const talon = mesh(
          geo.cone,
          hornMaterial,
          [0.018, 0.11 + rank * 0.008, 0.018],
          [claw * 0.035, -0.09, 0.035],
          arm.end,
        );
        talon.rotation.x = Math.PI / 2.8;
      }
  }
  const head = new THREE.Group();
  head.position.y = 1.05;
  torso.add(head);
  mesh(
    new THREE.CylinderGeometry(0.12, 0.145, 0.23, 14),
    demonSkin,
    [1, 1, 1],
    [0, -0.165, -0.01],
    head,
  );
  mesh(
    new THREE.SphereGeometry(1, 24, 16),
    demonSkin,
    [0.285, 0.325, 0.275],
    [0, 0.035, 0.005],
    head,
  );
  // A separate jaw, nose and facial planes prevent the head reading as a ball.
  mesh(
    new THREE.SphereGeometry(1, 18, 12),
    demonSkin,
    [0.215, 0.17, 0.23],
    [0, -0.16, 0.055],
    head,
  );
  const nose = mesh(
    new THREE.ConeGeometry(1, 1, 8),
    demonSkin,
    [0.04, 0.115, 0.05],
    [0, -0.015, 0.31],
    head,
  );
  nose.rotation.x = Math.PI / 2;
  mesh(
    new RoundedBoxGeometry(0.115, 0.012, 0.014, 2, 0.004),
    mouthMaterial,
    [1, 1, 1],
    [0, -0.145, 0.285],
    head,
  );
  for (const side of [-1, 1]) {
    const ear = mesh(
      new THREE.ConeGeometry(1, 1, 8),
      demonSkin,
      [0.055, 0.16 + rank * 0.006, 0.035],
      [side * 0.305, 0.035, 0.01],
      head,
    );
    ear.rotation.z = side * -Math.PI * 0.5;
    ear.rotation.y = side * 0.15;
    const brow = mesh(
      new RoundedBoxGeometry(0.105, 0.027, 0.025, 2, 0.007),
      hornMaterial,
      [1, 1, 1],
      [side * 0.095, 0.095, 0.284],
      head,
    );
    brow.rotation.z = side * -0.13;
  }
  mesh(
    new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMaterial,
    [0.34, 0.28, 0.32],
    [0, 0.13, -0.01],
    head,
  );
  for (let lock = -2; lock <= 2; lock++) {
    const hairLock = mesh(
      geo.cone,
      hairMaterial,
      [0.045 + (2 - Math.abs(lock)) * 0.008, 0.24 + rank * 0.012, 0.045],
      [lock * 0.09, 0.18, -0.25],
      head,
    );
    hairLock.rotation.x = -0.18;
    hairLock.rotation.z = lock * 0.055;
  }
  addEyes(head, 0.035, 0.285, 0.095, 0.032);
  if (rank >= 2)
    for (const side of [-1, 1])
      mesh(
        new THREE.TorusGeometry(0.052, 0.009, 6, 16),
        bodyGlow,
        [1, 1, 1],
        [side * 0.105, 0.02, 0.286],
        head,
        false,
      );
  for (const side of [-1, 1]) {
    const horn = mesh(
      geo.cone,
      hornMaterial,
      [0.075 + rank * 0.008, 0.24 + rank * 0.065, 0.075 + rank * 0.008],
      [side * (0.21 + rank * 0.006), 0.38, -0.01],
      head,
    );
    horn.rotation.z = side * (-0.27 - rank * 0.045);
    horn.rotation.x = -rank * 0.035;
    if (rank >= 3) {
      const crownBranch = mesh(
        geo.cone,
        hornMaterial,
        [0.045 + rank * 0.004, 0.2 + rank * 0.035, 0.045 + rank * 0.004],
        [side * (0.29 + rank * 0.018), 0.5 + rank * 0.035, -0.08],
        head,
      );
      crownBranch.rotation.z = side * (-0.72 - rank * 0.025);
      crownBranch.rotation.x = -0.2;
    }
    if (rank === 7) {
      const finalBranch = mesh(
        geo.cone,
        hornMaterial,
        [0.052, 0.32, 0.052],
        [side * 0.36, 0.62, -0.11],
        head,
      );
      finalBranch.rotation.z = side * -1.08;
      finalBranch.rotation.x = -0.32;
    }
  }
  if (rank >= 2) {
    for (const side of [-1, 1]) {
      const cheekMark = mesh(
        geo.box,
        bodyGlow,
        [0.012, 0.12 + rank * 0.008, 0.012],
        [side * 0.2, -0.02, 0.286],
        head,
        false,
      );
      cheekMark.rotation.z = side * 0.32;
    }
    for (const side of [-1, 1])
      mesh(
        geo.box,
        bodyGlow,
        [0.016, 0.22 + rank * 0.015, 0.012],
        [side * 0.22, 0.38, 0.337],
        torso,
        false,
      ).rotation.z = side * -0.22;
  }
  const cape = mesh(
    new RoundedBoxGeometry(0.62, 0.84, 0.045, 2, 0.02),
    cloth,
    [1, 1, 1],
    [0, 0.36, -0.27],
    torso,
  );
  cape.rotation.x = -0.08;
  if (rank >= 4) {
    const tail = mesh(
      geo.cone,
      demonSkin,
      [0.085 + rank * 0.006, 0.85 + rank * 0.06, 0.085 + rank * 0.006],
      [0, 0.08, -0.33],
      pelvis,
    );
    tail.rotation.x = -1.12;
    tail.rotation.z = 0.18;
    mesh(
      geo.octa,
      hornMaterial,
      [0.12, 0.2, 0.08],
      [0, -0.62, -0.98],
      pelvis,
    ).rotation.x = 0.28;
    for (const side of [-1, 1]) {
      const mantle = mesh(
        geo.cone,
        rank >= 6 ? hornMaterial : armor,
        [0.09 + rank * 0.008, 0.45 + rank * 0.05, 0.09 + rank * 0.008],
        [side * 0.58, 0.74, -0.02],
        torso,
      );
      mantle.rotation.z = side * -0.92;
    }
    mesh(
      geo.octa,
      bodyGlow,
      [0.1 + rank * 0.006, 0.13 + rank * 0.008, 0.055],
      [0, 0.5, 0.35],
      torso,
    );
  }
  if (rank >= 5) {
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.32, 0.63, -0.22);
      torso.add(wing);
      const wingBlade = mesh(
        new THREE.ConeGeometry(1, 1, 3),
        rank >= 6 ? hornMaterial : cloth,
        [0.72 + rank * 0.07, 0.045, 0.58 + rank * 0.05],
        [side * 0.55, 0.05, -0.22],
        wing,
      );
      wingBlade.rotation.z = (side * -Math.PI) / 2;
      wingBlade.rotation.x = -0.35;
    }
  }
  const weaponKind = weaponAppearance(equippedWeapon),
    weapon = buildWeapon(weaponKind, color);
  weapon.position.set(0, -0.04, 0.02);
  weapon.rotation.z = -0.24;
  arms[1].end.add(weapon);
  if (weaponKind === 'dagger') {
    const leftDagger = weapon.children[0];
    arms[0].end.add(leftDagger);
    leftDagger.position.set(0, -0.04, 0.02);
    leftDagger.rotation.z = 0.24;
    weapon.children[0].position.x = 0;
  }
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
  aura.visible = rank >= 2;
  (aura.material as THREE.MeshBasicMaterial).opacity =
    rank >= 2 ? 0.1 + rank * 0.035 : 0;
  aura.scale.setScalar(1 + rank * 0.12);
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
    rank,
    bodyGlow,
    gait: 0,
    speedBlend: 0,
    guardBlend: 0,
    yaw: 0,
    prevX: Number.NaN,
    prevY: Number.NaN,
  };
  return root;
}

function buildFirstPersonRig(
  job: string,
  rank = 0,
  equippedWeapon?: string | null,
) {
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
  const color = jobColors[job] || 0x5d3b79,
    rankRatio = rank / 7;
  const sleeve = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x26272a).lerp(new THREE.Color(0x16171b), rankRatio),
    roughness: 0.88 - rankRatio * 0.18,
    depthTest: true,
    depthWrite: true,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x6e625b).lerp(new THREE.Color(0x56505a), rankRatio),
    roughness: 0.67,
    vertexColors: true,
    depthTest: true,
    depthWrite: true,
  });
  const demonHard = new THREE.MeshStandardMaterial({
    color: rank >= 5 ? 0x17141d : 0x38313e,
    roughness: 0.31,
    metalness: 0.36 + rankRatio * 0.24,
    depthTest: true,
    depthWrite: true,
  });
  const runeMaterial = new THREE.MeshBasicMaterial({
    color: rank >= 6 ? 0xd8adff : 0xa866ee,
    transparent: true,
    opacity: rank >= 2 ? 0.34 + rankRatio * 0.46 : 0,
    depthTest: false,
    depthWrite: false,
  });
  const makeArm = (side: -1 | 1) => {
    const arm = createDemonArm(side, rank, {
      skin,
      cloth: sleeve,
      leather: mats.leather,
      metal: mats.iron,
      keratin: demonHard,
      rune: runeMaterial,
    });
    arm.position.set(side * 0.3, -0.31, -0.58);
    root.add(arm);
    return arm;
  };
  const leftArm = makeArm(-1),
    rightArm = makeArm(1);
  const weaponKind = weaponAppearance(equippedWeapon),
    armed = weaponKind !== 'bare',
    weapon = buildWeapon(weaponKind, color);
  const offhand = new THREE.Group();
  if (weaponKind === 'dagger') {
    const dagger = weapon.children[0];
    offhand.add(dagger);
    dagger.position.x = 0;
    weapon.children[0].position.x = 0;
    mountAtHandGrip(offhand, 0.02, -1);
    leftArm.add(offhand);
  }
  // Grip-centred pivot keeps the handle inside the fingers during each swing.
  mountAtHandGrip(
    weapon,
    weaponKind === 'dagger'
      ? 0.02
      : weaponKind === 'sigil'
        ? 0.25
        : weaponKind === 'staff'
          ? 0.1
          : weaponKind === 'spear'
            ? 0.15
            : 0.18,
  );
  weapon.rotation.set(-0.18, 0, -0.22);
  [weapon, offhand].forEach((group) =>
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const original = child.material as THREE.MeshStandardMaterial;
      if (
        child.geometry === geo.cylinder &&
        (original === mats.leather || original === mats.wood)
      ) {
        child.scale.x *= 0.66;
        child.scale.z *= 0.66;
      }
      child.material = original.clone();
      const material = child.material as THREE.MeshStandardMaterial;
      if (
        original === weapon.userData.magicMaterial &&
        !['staff', 'sigil'].includes(weaponKind)
      ) {
        material.color.set(rank >= 4 ? 0x798ba6 : 0x8b9299);
        material.emissiveIntensity = 0;
        material.roughness = 0.42;
        material.metalness = 0.84;
      }
      material.depthTest = true;
      material.depthWrite = true;
      material.metalness = Math.min(
        1,
        (material.metalness || 0) + rankRatio * 0.22,
      );
      if (rank >= 4) {
        material.emissive = new THREE.Color(color).multiplyScalar(
          0.16 + rankRatio * 0.12,
        );
        material.emissiveIntensity = 0.5 + rankRatio;
      }
      child.renderOrder = 20;
    }),
  );
  rightArm.add(weapon);
  const hammer = makeHammer(rightArm);
  mountAtHandGrip(hammer, 0.18);
  hammer.rotation.set(-0.18, 0, -0.22);
  hammer.visible = false;
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
  const rankAura = new THREE.Group();
  rankAura.position.set(0, -0.17, -0.7);
  root.add(rankAura);
  if (rank >= 4)
    for (let i = 0; i < Math.min(3, rank - 3); i++) {
      const ring = mesh(
        new THREE.RingGeometry(0.18 + i * 0.08, 0.19 + i * 0.08, 28),
        runeMaterial,
        [1, 1, 1],
        [0, i * -0.035, i * -0.045],
        rankAura,
        false,
      );
      ring.renderOrder = 22;
    }
  root.userData = {
    leftArm,
    rightArm,
    weapon,
    spellGlow,
    hammer,
    offhand,
    rankAura,
    armed,
    rank,
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
    spellGlow = data.spellGlow as THREE.Mesh,
    rankAura = data.rankAura as THREE.Group,
    rank = data.rank as number;
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
  // A full left/right stride advances with distance, without phase jumps when
  // speed changes. Airborne movement does not add footsteps.
  data.gait +=
    dt * Math.min(speedScene, 5) * 2.1 * (world.height > 0.05 ? 0 : 1);
  const locomotion = data.speedBlend as number,
    phase = data.gait as number,
    motion = world.preferences?.weaponMotion ?? 1,
    bobX = Math.sin(phase) * 0.012 * locomotion * motion,
    bobY = Math.cos(phase * 2) * 0.006 * locomotion * motion;
  rig.position.set(bobX, -bobY, 0);
  rig.rotation.set(0, 0, -bobX * 0.45);
  const breath = Math.sin(elapsed * 1.85) * 0.004 * motion;
  leftArm.position.set(-0.27, -0.46 + breath, -0.55);
  rightArm.position.set(0.3, -0.31 - breath * 0.6, -0.58);
  leftArm.rotation.set(0.08, 0.3, -0.12);
  rightArm.rotation.set(0, -0.22, 0.08);
  weapon.rotation.set(-0.1, 0, 0);
  const guard = data.guardBlend as number;
  const working = world.buildAnim > 0 && !world.attackAnim && !world.guarding;
  const armed = data.armed as boolean;
  const offhand = data.offhand as THREE.Group;
  offhand.visible = !working;
  poseDemonArm(
    rightArm,
    working
      ? 0.62
      : armed
        ? 1
        : world.guarding ||
            (world.attackKind !== 'skill' && world.attackAnim > 0)
          ? 0.92
          : 0.38,
    dt,
  );
  poseDemonArm(
    leftArm,
    offhand.children.length && !working
      ? 1
      : world.attackKind === 'skill' && world.attackAnim > 0
        ? 0.03
        : world.guarding
          ? 0.9
          : working
            ? 0.62
            : 0.75,
    dt,
  );
  weapon.visible = armed && !working;
  (data.hammer as THREE.Group).visible = working;
  rightArm.position.lerp(new THREE.Vector3(0.08, -0.18, -0.48), guard);
  rightArm.rotation.x -= guard * 0.45;
  rightArm.rotation.z += guard * 0.85;
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
      rightArm.position.x -= wind * 0.14 + strike * 0.14;
      rightArm.position.y += (wind * 0.38 - strike * 0.12) * heavy;
      rightArm.position.z += wind * 0.03 - strike * 0.1;
      // Pitch the arm and its mounted weapon together: overhead preparation,
      // downward cut through the reticle, then a smooth return to the stance.
      rightArm.rotation.x += (0.85 * wind - 1.18 * strike) * heavy;
      rightArm.rotation.y += 0.22 * (wind + strike);
      rightArm.rotation.z -= 0.08 * (wind + strike);
      leftArm.position.y -= strike * 0.04;
    }
  }
  if (working) {
    const cycle = (elapsed * 1.25) % 1;
    const wind =
      smoothRange(0, 0.3, cycle) * (1 - smoothRange(0.34, 0.48, cycle));
    const strike =
      smoothRange(0.3, 0.52, cycle) * (1 - smoothRange(0.62, 0.96, cycle));
    rightArm.position.y += wind * 0.12 - strike * 0.14;
    rightArm.position.z += wind * 0.08 - strike * 0.24;
    rightArm.rotation.x += -0.6 * wind + 0.65 * strike;
    leftArm.position.z -= strike * 0.1;
    leftArm.rotation.x -= 0.2 * strike;
  }
  if (world.dodgeTime > 0) {
    const arc = Math.sin(clamp01(1 - world.dodgeTime / 0.48) * Math.PI);
    rig.position.y -= arc * 0.15 * motion;
    rig.rotation.z -= arc * 0.22 * motion;
  }
  const attackMotion = 0.3 + 0.7 * motion;
  rightArm.position.lerp(
    new THREE.Vector3(0.3, -0.31, -0.58),
    (1 - attackMotion) * (1 - guard),
  );
  leftArm.position.lerp(
    new THREE.Vector3(-0.27, -0.46, -0.55),
    (1 - attackMotion) * (1 - guard),
  );
  rightArm.rotation.x *= attackMotion;
  rightArm.rotation.z *= attackMotion;
  weapon.rotation.x *= attackMotion;
  weapon.rotation.z *= attackMotion;
  if (offhand.children.length)
    offhand.rotation.set(weapon.rotation.x, 0, -weapon.rotation.z);
  const glow = spellGlow.material as THREE.MeshBasicMaterial;
  const passiveGlow = rank >= 2 ? Math.min(0.28, 0.025 * rank) : 0;
  glow.opacity =
    world.attackKind === 'skill' && world.attackAnim > 0
      ? 0.72
      : passiveGlow + impact * 0.35;
  spellGlow.scale.setScalar(1 + Math.sin(elapsed * 8) * 0.08 + impact * 1.2);
  rankAura.rotation.z = elapsed * (0.12 + rank * 0.025);
  rankAura.children.forEach((ring, index) => {
    ring.rotation.z = elapsed * (index % 2 ? -0.5 : 0.45) + index;
    ring.scale.setScalar(1 + Math.sin(elapsed * 2.4 + index) * 0.05);
  });
}

function buildFieldBase(site: RenderBase, ghost = false) {
  return createStructureModel(
    site,
    {
      stone: mats.stone,
      wood: mats.wood,
      iron: mats.iron,
      cloth: mats.cloth,
      glow: mats.crystal,
      fire: mats.lava,
    },
    geo,
    ghost,
  );
}

function buildRiggedMob(mob: RenderMob) {
  const root = new THREE.Group();
  const kind: MonsterKind =
      mob.kind ||
      (/スライム|粘体/.test(mob.name)
        ? 'slime'
        : /ウルフ|ハウンド|サラマンダー|獣/.test(mob.name)
          ? 'beast'
          : 'imp'),
    variant = mob.variant ?? mob.id % 5,
    tierScale = [0.58, 0.68, 0.82, 1.03, 1.3, 1.62, 1.95][
      Math.max(0, Math.min(6, mob.tier))
    ],
    kindScale: Record<MonsterKind, number> = {
      imp: 0.82,
      beast: 1,
      insect: 0.92,
      golem: 1.34,
      flying: 1.02,
      plant: 1.18,
      slime: 0.86,
      armored: 1.28,
      aberration: 1.08,
    },
    scale = mob.boss
      ? (2.75 + Math.min(mob.tier, 8) * 0.1) * kindScale[kind]
      : tierScale * kindScale[kind],
    shapeScale = new THREE.Vector3(
      0.93 + (variant % 3) * 0.07,
      0.96 + ((variant + 2) % 3) * 0.055,
      0.94 + ((variant + 1) % 3) * 0.06,
    ),
    palette: Record<string, number[]> = {
      ruins: [0x6f536e, 0x765344, 0x455061],
      forest: [0x315e3c, 0x5a5531, 0x234e45],
      mountain: [0x777580, 0x544d5d, 0x6b6f62],
      citadel: [0x383c4c, 0x4f2934, 0x222632],
      ashland: [0x4e4269, 0x343750, 0x684650],
      waste: [0x87523b, 0x6d4630, 0x775c42],
      village: [0x70445e, 0x554063, 0x68434b],
      cave: [0x34465c, 0x3e5360, 0x50426b],
      volcano: [0x732d25, 0x4f2926, 0x8b3d22],
      castle: [0x3b294f, 0x292e43, 0x4a263c],
    },
    bodyColor = (palette[mob.home] || palette.ruins)[variant % 3],
    baseMat = mob.ally
      ? mats.ally
      : new THREE.MeshStandardMaterial({
          color: bodyColor,
          roughness:
            kind === 'insect' || kind === 'armored' || kind === 'golem'
              ? 0.38
              : 0.76,
          metalness: kind === 'armored' ? 0.65 : kind === 'golem' ? 0.15 : 0,
        }),
    accentMat = mob.ally
      ? mats.gold
      : new THREE.MeshStandardMaterial({
          color: new THREE.Color(bodyColor).offsetHSL(
            variant % 2 ? 0.08 : -0.07,
            0.08,
            variant % 3 === 0 ? 0.18 : -0.12,
          ),
          roughness: kind === 'insect' ? 0.3 : 0.7,
          metalness: kind === 'insect' ? 0.28 : 0.04,
        }),
    glowColor =
      mob.home === 'volcano'
        ? 0xff4a16
        : mob.home === 'forest'
          ? 0x70e079
          : 0xaf75ff,
    glowMat = new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: mob.boss ? 4.2 : 2.2,
      roughness: 0.22,
    });
  addShadow(root, (mob.boss ? 1.6 : 0.46) * Math.max(0.72, scale));
  const motion = new THREE.Group();
  root.add(motion);
  let torso: THREE.Group | undefined,
    head: THREE.Group | undefined,
    pelvis: THREE.Group | undefined,
    legs: JointLimb[] = [],
    arms: JointLimb[] = [],
    tail: THREE.Object3D | undefined,
    slimeBody: THREE.Mesh | undefined,
    core: THREE.Mesh | undefined;
  const wings: THREE.Group[] = [],
    tentacles: THREE.Object3D[] = [],
    extras: THREE.Object3D[] = [];
  let flightHeight = 0;
  if (kind === 'beast') {
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
          baseMat,
          side,
          'paw',
          baseMat,
          accentMat,
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
    for (let i = 0; i < 1 + (variant % 3); i++) {
      const spine = mesh(
        geo.cone,
        variant === 4 ? glowMat : accentMat,
        [0.07, 0.24 + i * 0.04, 0.07],
        [0, 0.34, 0.25 - i * 0.35],
        torso,
      );
      spine.rotation.x = -0.18;
      extras.push(spine);
    }
  } else if (kind === 'insect') {
    torso = new THREE.Group();
    torso.position.y = 0.56;
    motion.add(torso);
    mesh(geo.lowSphere, baseMat, [0.42, 0.31, 0.65], [0, 0, -0.28], torso);
    mesh(geo.lowSphere, accentMat, [0.38, 0.34, 0.4], [0, 0.02, 0.26], torso);
    head = new THREE.Group();
    head.position.set(0, 0.03, 0.62);
    torso.add(head);
    mesh(geo.lowSphere, baseMat, [0.3, 0.27, 0.3], [0, 0, 0], head);
    addEyes(head, 0.04, 0.28, 0.14, 0.055);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const leg = createJointLimb(
          torso,
          [side * 0.27, -0.06, 0.34 - i * 0.36],
          0.38 + i * 0.04,
          0.32,
          0.045,
          accentMat,
          side,
          'claw',
          accentMat,
          variant === 4 ? glowMat : mats.iron,
        );
        leg.upper.rotation.z = side * (0.86 + i * 0.1);
        leg.lower.rotation.z = side * -0.52;
        leg.upper.userData.restZ = leg.upper.rotation.z;
        leg.lower.userData.restZ = leg.lower.rotation.z;
        legs.push(leg);
      }
      const mandible = mesh(
        geo.cone,
        variant === 4 ? glowMat : mats.iron,
        [0.065, 0.34, 0.065],
        [side * 0.17, -0.06, 0.28],
        head,
      );
      mandible.rotation.x = 1.16;
      mandible.rotation.z = side * 0.25;
      extras.push(mandible);
    }
    for (let i = 0; i < 1 + (variant % 3); i++)
      mesh(
        geo.sphere,
        variant >= 3 ? glowMat : accentMat,
        [0.06, 0.025, 0.09],
        [0, 0.31, -0.46 + i * 0.29],
        torso,
      );
  } else if (kind === 'golem') {
    pelvis = new THREE.Group();
    pelvis.position.y = 0.92;
    motion.add(pelvis);
    mesh(geo.rock, accentMat, [0.48, 0.32, 0.4], [0, 0, 0], pelvis);
    legs = [-1, 1].map((side) =>
      createJointLimb(
        pelvis!,
        [side * 0.34, -0.08, 0],
        0.54,
        0.48,
        0.19,
        baseMat,
        side,
        'stone',
        baseMat,
        accentMat,
      ),
    );
    torso = new THREE.Group();
    pelvis.add(torso);
    mesh(geo.rock, baseMat, [0.82, 0.72, 0.52], [0, 0.62, 0], torso);
    mesh(geo.rock, accentMat, [0.53, 0.34, 0.58], [0, 0.71, 0.12], torso);
    arms = [-1, 1].map((side) =>
      createJointLimb(
        torso!,
        [side * 0.78, 0.72, 0],
        0.58,
        0.52,
        0.22,
        accentMat,
        side,
        'stone',
        accentMat,
        baseMat,
      ),
    );
    head = new THREE.Group();
    head.position.set(0, 1.38, 0.08);
    torso.add(head);
    mesh(geo.rock, baseMat, [0.37, 0.32, 0.34], [0, 0, 0], head);
    core = mesh(geo.octa, glowMat, [0.16, 0.2, 0.1], [0, 0.7, 0.53], torso);
    addEyes(head, 0, 0.34, 0, 0.07);
    for (let i = 0; i < variant; i++) {
      const spike = mesh(
        geo.cone,
        variant === 4 ? glowMat : mats.stoneLight,
        [0.1, 0.42, 0.1],
        [(i % 2 ? 1 : -1) * (0.25 + i * 0.08), 1.25, -0.18],
        torso,
      );
      spike.rotation.z = (i % 2 ? -1 : 1) * 0.45;
    }
  } else if (kind === 'flying') {
    flightHeight = mob.boss ? 1.7 : 1.15;
    torso = new THREE.Group();
    torso.position.y = 0.72;
    motion.add(torso);
    mesh(geo.lowSphere, baseMat, [0.46, 0.34, 0.7], [0, 0, 0], torso);
    head = new THREE.Group();
    head.position.set(0, 0.05, 0.67);
    torso.add(head);
    mesh(geo.lowSphere, accentMat, [0.32, 0.28, 0.36], [0, 0, 0], head);
    addEyes(head, 0.04, 0.33, 0.13, 0.055);
    tail = mesh(geo.cone, baseMat, [0.13, 0.8, 0.13], [0, 0, -0.65], torso);
    tail.rotation.x = -Math.PI / 2;
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.36, 0.11, -0.05);
      torso.add(wing);
      const sail = mesh(
        new THREE.ConeGeometry(1, 1, 3),
        variant === 4 ? glowMat : baseMat,
        [0.9 + variant * 0.08, 0.06, 0.72],
        [side * 0.65, 0, -0.08],
        wing,
      );
      sail.rotation.z = (side * -Math.PI) / 2;
      sail.rotation.y = side * 0.22;
      mesh(
        geo.cylinder,
        accentMat,
        [0.035, 0.9, 0.035],
        [side * 0.44, 0, 0],
        wing,
      ).rotation.z = (side * Math.PI) / 2;
      wings.push(wing);
    }
    for (let i = 0; i < 1 + (variant % 2); i++) {
      const horn = mesh(
        geo.cone,
        accentMat,
        [0.07, 0.3, 0.07],
        [(i ? 1 : -1) * 0.16, 0.25, -0.04],
        head,
      );
      horn.rotation.z = (i ? -1 : 1) * 0.35;
    }
  } else if (kind === 'plant') {
    torso = new THREE.Group();
    torso.position.y = 0.78;
    motion.add(torso);
    mesh(geo.cylinder, mats.wood, [0.3, 0.95, 0.3], [0, 0.18, 0], torso);
    mesh(geo.lowSphere, baseMat, [0.55, 0.52, 0.48], [0, 0.78, 0], torso);
    head = new THREE.Group();
    head.position.set(0, 1.25, 0.08);
    torso.add(head);
    mesh(geo.lowSphere, accentMat, [0.39, 0.34, 0.4], [0, 0, 0], head);
    addEyes(head, 0.02, 0.4, 0.12, 0.055);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const petal = mesh(
        geo.cone,
        baseMat,
        [0.16, 0.48, 0.12],
        [Math.sin(angle) * 0.33, Math.cos(angle) * 0.3, -0.08],
        head,
      );
      petal.rotation.z = -angle;
      petal.userData.baseScale = petal.scale.clone();
      extras.push(petal);
    }
    arms = [-1, 1].map((side) =>
      createJointLimb(
        torso!,
        [side * 0.38, 0.7, 0],
        0.58,
        0.54,
        0.075,
        mats.wood,
        side,
        'root',
        mats.wood,
        variant === 4 ? glowMat : baseMat,
      ),
    );
    for (let i = 0; i < 4 + (variant % 3); i++) {
      const angle = (i / (4 + (variant % 3))) * Math.PI * 2;
      const rootLeg = mesh(
        geo.cone,
        mats.wood,
        [0.09, 0.72, 0.09],
        [Math.sin(angle) * 0.34, -0.52, Math.cos(angle) * 0.34],
        torso,
      );
      rootLeg.rotation.z = Math.sin(angle) * 0.55;
      rootLeg.rotation.x = Math.cos(angle) * 0.55;
      tentacles.push(rootLeg);
    }
    core = mesh(geo.sphere, glowMat, [0.1, 0.1, 0.08], [0, 0.8, 0.47], torso);
  } else if (kind === 'aberration') {
    flightHeight = mob.boss ? 1.35 : 0.75;
    torso = new THREE.Group();
    torso.position.y = 1.08;
    motion.add(torso);
    mesh(geo.lowSphere, baseMat, [0.66, 0.64, 0.58], [0, 0, 0], torso);
    core = mesh(geo.sphere, glowMat, [0.29, 0.29, 0.12], [0, 0, 0.55], torso);
    for (let i = 0; i < 3 + (variant % 3); i++) {
      const angle = (i / (3 + (variant % 3))) * Math.PI * 2;
      const eye = mesh(
        geo.sphere,
        mats.eye,
        [0.075, 0.075, 0.045],
        [Math.sin(angle) * 0.48, Math.cos(angle) * 0.42, 0.37],
        torso,
      );
      extras.push(eye);
    }
    const ring = mesh(
      new THREE.TorusGeometry(0.84, 0.045, 6, 24),
      accentMat,
      [1, 1, 1],
      [0, 0, 0],
      torso,
    );
    ring.rotation.x = Math.PI / 2.8;
    extras.push(ring);
    for (let i = 0; i < 5 + (variant % 3); i++) {
      const angle = (i / (5 + (variant % 3))) * Math.PI * 2;
      const tendril = mesh(
        geo.cone,
        baseMat,
        [0.08, 0.75 + (i % 2) * 0.25, 0.08],
        [Math.sin(angle) * 0.38, -0.64, Math.cos(angle) * 0.38],
        torso,
      );
      tendril.rotation.z = Math.sin(angle) * 0.35;
      tendril.rotation.x = Math.cos(angle) * 0.35;
      tentacles.push(tendril);
    }
  } else if (kind === 'slime') {
    slimeBody = mesh(
      new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.78),
      baseMat,
      [
        0.62 + variant * 0.035,
        0.52 + (variant % 2) * 0.08,
        0.62 - variant * 0.018,
      ],
      [0, 0.12, 0],
      motion,
    );
    slimeBody.userData.baseScale = slimeBody.scale.clone();
    addEyes(motion, 0.48, 0.54, 0.16, 0.055);
    core = mesh(
      geo.octa,
      glowMat,
      [0.13, 0.16, 0.1],
      [variant % 2 ? 0.18 : -0.18, 0.25, 0.18],
      motion,
    );
    for (let i = 0; i < variant; i++) {
      const bubble = mesh(
        geo.sphere,
        accentMat,
        [0.09, 0.09, 0.09],
        [-0.3 + i * 0.17, 0.42 + (i % 2) * 0.08, -0.12],
        motion,
      );
      extras.push(bubble);
    }
  } else {
    const large = kind === 'armored';
    pelvis = new THREE.Group();
    pelvis.position.y = large ? 1.0 : 0.76;
    motion.add(pelvis);
    const anatomyRank = Math.max(0, Math.min(7, mob.tier + (large ? 2 : 0)));
    mesh(
      keepSharedAnatomy(demonPelvisGeometry(anatomyRank)),
      baseMat,
      [large ? 1.08 : 0.76, large ? 1 : 0.78, large ? 1.05 : 0.8],
      [0, large ? 0.02 : 0, 0],
      pelvis,
    );
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
        'boot',
        baseMat,
        large ? accentMat : mats.leather,
      ),
      createJointLimb(
        pelvis,
        [large ? 0.26 : 0.2, 0, 0],
        upperLeg,
        lowerLeg,
        large ? 0.15 : 0.11,
        baseMat,
        1,
        'boot',
        baseMat,
        large ? accentMat : mats.leather,
      ),
    ];
    torso = new THREE.Group();
    pelvis.add(torso);
    mesh(
      keepSharedAnatomy(demonTorsoGeometry(anatomyRank)),
      baseMat,
      [large ? 1.08 : 0.74, large ? 1.02 : 0.79, large ? 1.06 : 0.82],
      [0, 0, 0],
      torso,
    );
    if (large)
      mesh(
        new RoundedBoxGeometry(0.75, 0.42, 0.1, 2, 0.04),
        accentMat,
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
        'hand',
        baseMat,
        large ? accentMat : mats.iron,
      ),
      createJointLimb(
        torso,
        [large ? 0.5 : 0.38, armY, 0],
        large ? 0.46 : 0.34,
        large ? 0.42 : 0.31,
        large ? 0.13 : 0.095,
        baseMat,
        1,
        'hand',
        baseMat,
        large ? accentMat : mats.iron,
      ),
    ];
    if (large)
      for (const arm of arms)
        mesh(geo.sphere, accentMat, [0.24, 0.18, 0.26], [0, 0, 0], arm.upper);
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
    const hornSides = variant === 0 && !large ? [-1] : [-1, 1];
    for (const side of hornSides) {
      const horn = mesh(
        geo.cone,
        variant === 4 ? glowMat : accentMat,
        [
          large ? 0.13 : 0.07 + variant * 0.012,
          large ? 0.48 : 0.22 + variant * 0.06,
          large ? 0.13 : 0.07 + variant * 0.012,
        ],
        [side * (large ? 0.3 : 0.21), large ? 0.38 : 0.28, 0],
        head,
      );
      horn.rotation.z = side * -0.42;
    }
    if (large) {
      const shield = mesh(
        new THREE.CylinderGeometry(0.5, 0.42, 0.14, 8),
        accentMat,
        [1, 1, 1],
        [0, 0.04, 0.08],
        arms[0].end,
      );
      shield.rotation.x = Math.PI / 2;
      for (let i = 0; i < 2 + (variant % 3); i++) {
        const shoulderSpike = mesh(
          geo.cone,
          variant === 4 ? glowMat : mats.iron,
          [0.08, 0.35 + i * 0.04, 0.08],
          [(i % 2 ? 1 : -1) * 0.65, 0.82 + i * 0.08, 0],
          torso,
        );
        shoulderSpike.rotation.z = (i % 2 ? -1 : 1) * 0.68;
      }
    } else {
      for (const side of [-1, 1]) {
        const ear = mesh(
          geo.cone,
          accentMat,
          [0.09, 0.34 + (variant % 2) * 0.11, 0.05],
          [side * 0.29, 0.04, 0],
          head,
        );
        ear.rotation.z = side * Math.PI * 0.44;
      }
      tail = mesh(
        geo.cone,
        baseMat,
        [0.07, 0.58, 0.07],
        [0, 0.2, -0.35],
        torso,
      );
      tail.rotation.x = -1.1;
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
  let bossAura: THREE.Group | undefined;
  if (mob.boss || mob.tier >= 5) {
    bossAura = new THREE.Group();
    bossAura.position.y = 1.25 * scale;
    root.add(bossAura);
    const shardCount = mob.boss ? 8 : 4,
      auraRadius = mob.boss ? 1.15 : 0.78;
    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * Math.PI * 2;
      mesh(
        geo.octa,
        glowMat,
        [0.07 * scale, (mob.boss ? 0.22 : 0.14) * scale, 0.07 * scale],
        [
          Math.sin(angle) * auraRadius * scale,
          Math.sin(i * 2.1) * 0.22 * scale,
          Math.cos(angle) * auraRadius * scale,
        ],
        bossAura,
      );
    }
  }
  if (core) core.userData.baseScale = core.scale.clone();
  motion.scale.set(
    scale * shapeScale.x,
    scale * shapeScale.y,
    scale * shapeScale.z,
  );
  const bar = buildHealthBar(!!mob.boss);
  const heightByKind: Record<MonsterKind, number> = {
    imp: 2.05,
    beast: 1.55,
    insect: 1.42,
    golem: 2.72,
    flying: 3.18,
    plant: 2.8,
    slime: 1.2,
    armored: 2.82,
    aberration: 2.75,
  };
  bar.position.y = heightByKind[kind] * scale;
  root.add(bar);
  const surrender = mesh(
    new THREE.RingGeometry(0.34, 0.42, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffcf68,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    [1, 1, 1],
    [0, 0.08, 0],
    root,
    false,
  );
  surrender.rotation.x = -Math.PI / 2;
  surrender.visible = false;
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
    core,
    wings,
    tentacles,
    extras,
    flightHeight,
    bossAura,
    variant,
    bar,
    surrender,
    ally: !!mob.ally,
    baseScale: scale,
    shapeScale,
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
  const baseScale = data.baseScale as number,
    shapeScale = data.shapeScale as THREE.Vector3;
  motion.scale.set(
    baseScale * shapeScale.x,
    baseScale * shapeScale.y,
    baseScale * shapeScale.z,
  );
  const bossAura = data.bossAura as THREE.Group | undefined,
    core = data.core as THREE.Mesh | undefined;
  if (bossAura) {
    bossAura.rotation.y = elapsed * 0.48;
    bossAura.rotation.x = Math.sin(elapsed * 0.42) * 0.12;
  }
  if (core) {
    const baseCoreScale = core.userData.baseScale as THREE.Vector3;
    core.scale
      .copy(baseCoreScale)
      .multiplyScalar(1 + Math.sin(elapsed * 5.5 + mob.id) * 0.12);
  }
  const attackProgress =
      (mob.attackAnim || 0) > 0
        ? clamp01(1 - (mob.attackAnim || 0) / (mob.attackTotal || 0.78))
        : -1,
    attackPose =
      attackProgress >= 0
        ? creatureAttackPose(
            data.kind as MonsterKind,
            attackProgress,
            !!mob.boss,
            data.attackPose as CreatureAttackPose | undefined,
          )
        : undefined;
  if (attackPose) data.attackPose = attackPose;
  if (data.kind === 'imp' || data.kind === 'armored') {
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
    if (attackPose) {
      const wind = attackPose.anticipation,
        strike = attackPose.strike;
      pelvis.position.y -= wind * 0.11 + attackPose.impact * 0.035;
      motion.position.z += attackPose.lunge * 0.3;
      torso.rotation.y += attackPose.twist * 0.58;
      torso.rotation.x += wind * 0.2 - strike * 0.32;
      arms[1].upper.rotation.x += -1.15 * wind + 1.48 * strike;
      arms[1].upper.rotation.z += -0.65 * wind + 0.5 * strike;
      arms[1].lower.rotation.x += -0.55 * wind + 0.28 * strike;
      arms[0].upper.rotation.x += -0.28 * wind + 0.4 * strike;
      legs[0].lower.rotation.x += attackPose.compression * 0.45;
    }
  } else if (data.kind === 'beast') {
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
    if (attackPose) {
      torso.position.y -= attackPose.compression * 0.45;
      motion.position.z += attackPose.lunge * 0.42;
      motion.position.y += attackPose.lift * 0.28;
      head.rotation.x -= attackPose.anticipation * 0.35;
      head.rotation.x += attackPose.strike * 0.48;
      legs.forEach(
        (leg) => (leg.lower.rotation.x += attackPose.compression * 1.55),
      );
    }
  } else if (data.kind === 'insect') {
    const torso = data.torso as THREE.Group,
      head = data.head as THREE.Group,
      legs = data.legs as JointLimb[],
      extras = data.extras as THREE.Object3D[];
    torso.position.y =
      0.56 + Math.abs(Math.sin(phase * 3)) * 0.025 * locomotion;
    torso.rotation.set(
      Math.sin(phase * 2) * 0.025 * locomotion,
      0,
      Math.sin(phase * 3) * 0.055 * locomotion,
    );
    legs.forEach((leg, index) => {
      const wave = Math.sin(
          phase * 1.45 + (index % 3) * 1.9 + (index > 2 ? Math.PI : 0),
        ),
        restUpper = leg.upper.userData.restZ as number,
        restLower = leg.lower.userData.restZ as number;
      leg.upper.rotation.x = wave * 0.52 * locomotion;
      leg.upper.rotation.z = restUpper + wave * 0.12 * locomotion;
      leg.lower.rotation.x = -wave * 0.46 * locomotion;
      leg.lower.rotation.z = restLower;
    });
    head.rotation.set(
      Math.sin(elapsed * 2.3 + mob.id) * 0.035,
      Math.sin(elapsed * 1.1 + mob.id) * 0.2 * (1 - locomotion),
      0,
    );
    extras.slice(0, 2).forEach((mandible, index) => {
      mandible.rotation.z += Math.sin(elapsed * 5 + index * Math.PI) * 0.08;
    });
    if (attackPose) {
      motion.position.z += attackPose.lunge * 0.48;
      torso.rotation.x +=
        attackPose.anticipation * 0.12 - attackPose.strike * 0.28;
      legs.forEach((leg) => {
        leg.upper.rotation.z *= 1 - attackPose.compression * 0.22;
        leg.lower.rotation.x -= attackPose.strike * 0.18;
      });
      extras.slice(0, 2).forEach((mandible, index) => {
        mandible.rotation.z +=
          (index ? -1 : 1) *
          (-attackPose.anticipation * 0.24 + attackPose.impact * 0.58);
      });
    }
  } else if (data.kind === 'golem') {
    const pelvis = data.pelvis as THREE.Group,
      torso = data.torso as THREE.Group,
      head = data.head as THREE.Group,
      legs = data.legs as JointLimb[],
      arms = data.arms as JointLimb[];
    data.pelvisBase ??= pelvis.position.y;
    const weightStep = Math.sin(phase * 0.72),
      lifted = Math.abs(Math.sin(phase * 0.72));
    pelvis.position.set(0, data.pelvisBase + lifted * 0.045 * locomotion, 0);
    pelvis.rotation.set(0, weightStep * 0.045 * locomotion, 0);
    torso.rotation.set(0, 0, -weightStep * 0.035 * locomotion);
    legs.forEach((leg, index) => {
      const wave = Math.sin(phase * 0.72 + index * Math.PI);
      leg.upper.rotation.x = wave * 0.31 * locomotion;
      leg.lower.rotation.x = Math.max(0, -wave) * 0.34 * locomotion;
    });
    arms.forEach((arm, index) => {
      const wave = Math.sin(phase * 0.72 + index * Math.PI);
      arm.upper.rotation.set(-wave * 0.18 * locomotion, 0, arm.side * 0.16);
      arm.lower.rotation.x = -0.18;
    });
    head.rotation.y =
      Math.sin(elapsed * 0.34 + mob.id) * 0.13 * (1 - locomotion);
    if (attackPose) {
      const raise = attackPose.anticipation,
        slam = attackPose.strike;
      pelvis.position.y -= attackPose.impact * 0.2;
      torso.rotation.x = raise * -0.18 + slam * 0.32;
      arms.forEach((arm, index) => {
        arm.upper.rotation.x = -raise * 1.75 + slam * 1.25;
        arm.upper.rotation.z = (index ? 1 : -1) * (0.35 - raise * 0.2);
        arm.lower.rotation.x = -raise * 0.65 + slam * 0.28;
      });
      motion.position.z += attackPose.lunge * 0.28;
      motion.rotation.x += attackPose.impact * 0.08;
    }
  } else if (data.kind === 'flying') {
    const torso = data.torso as THREE.Group,
      head = data.head as THREE.Group,
      wings = data.wings as THREE.Group[],
      tail = data.tail as THREE.Object3D,
      baseScale = data.baseScale as number,
      flightHeight = data.flightHeight as number;
    const flap = Math.sin(elapsed * (locomotion > 0.15 ? 10.5 : 5.8) + mob.id),
      hover = Math.sin(elapsed * 2.1 + mob.id) * 0.1;
    motion.position.y = flightHeight * Math.max(0.75, baseScale * 0.68) + hover;
    torso.rotation.set(
      -0.12 * locomotion,
      0,
      Math.sin(phase) * 0.04 * locomotion,
    );
    wings.forEach((wing, index) => {
      wing.rotation.z = (index ? -1 : 1) * (0.22 + flap * 0.58);
      wing.rotation.y = (index ? 1 : -1) * 0.12 * locomotion;
    });
    head.rotation.x = 0.12 * locomotion - hover * 0.12;
    head.rotation.y =
      Math.sin(elapsed * 0.9 + mob.id) * 0.12 * (1 - locomotion);
    tail.rotation.z = Math.sin(elapsed * 3.4 + mob.id) * 0.3;
    if (attackPose) {
      motion.position.y -=
        attackPose.lift * (0.75 + baseScale * 0.18) -
        attackPose.anticipation * 0.12;
      motion.position.z += attackPose.lunge * 0.62;
      torso.rotation.x +=
        attackPose.strike * 0.72 - attackPose.anticipation * 0.16;
      wings.forEach((wing, index) => {
        const side = index ? -1 : 1;
        wing.rotation.z =
          side *
          (0.12 + attackPose.anticipation * 0.52 - attackPose.strike * 0.08);
      });
    }
  } else if (data.kind === 'plant') {
    const torso = data.torso as THREE.Group,
      head = data.head as THREE.Group,
      arms = data.arms as JointLimb[],
      roots = data.tentacles as THREE.Object3D[],
      extras = data.extras as THREE.Object3D[];
    const sway = Math.sin(elapsed * 1.1 + mob.id) * 0.055;
    torso.position.y = 0.78;
    torso.rotation.set(sway * 0.45, sway, sway * 0.8);
    head.rotation.y = Math.sin(elapsed * 0.63 + mob.id) * 0.16;
    arms.forEach((arm, index) => {
      arm.upper.rotation.set(
        -0.35 + Math.sin(elapsed * 1.4 + index * 2.2 + mob.id) * 0.18,
        0,
        arm.side * 0.72,
      );
      arm.lower.rotation.x = -0.46 + Math.sin(elapsed * 1.8 + index) * 0.13;
    });
    roots.forEach((root, index) => {
      root.rotation.y = Math.sin(elapsed * 1.7 + index) * 0.14;
    });
    extras.forEach((petal, index) => {
      const basePetalScale = petal.userData.baseScale as THREE.Vector3;
      petal.scale.copy(basePetalScale);
      petal.scale.y *= 1 + Math.sin(elapsed * 2 + index) * 0.06;
    });
    if (attackPose) {
      torso.rotation.x +=
        attackPose.anticipation * 0.24 - attackPose.strike * 0.42;
      torso.rotation.y += attackPose.twist * 0.18;
      motion.position.z += attackPose.lunge * 0.3;
      arms.forEach((arm, index) => {
        const delay = index ? 0.86 : 1;
        arm.upper.rotation.x +=
          attackPose.anticipation * 0.34 - attackPose.strike * 0.98 * delay;
        arm.lower.rotation.x += attackPose.strike * 0.78 * delay;
      });
      roots.forEach((root, index) => {
        root.rotation.z += Math.sin(index * 1.7) * attackPose.impact * 0.22;
      });
      head.rotation.x += attackPose.strike * 0.34;
    }
  } else if (data.kind === 'aberration') {
    const torso = data.torso as THREE.Group,
      tentacles = data.tentacles as THREE.Object3D[],
      extras = data.extras as THREE.Object3D[],
      baseScale = data.baseScale as number,
      flightHeight = data.flightHeight as number;
    motion.position.y =
      flightHeight * Math.max(0.82, baseScale * 0.5) +
      Math.sin(elapsed * 1.65 + mob.id) * 0.13;
    torso.rotation.y = elapsed * 0.18 + mob.id;
    torso.rotation.z = Math.sin(elapsed * 0.72 + mob.id) * 0.08;
    tentacles.forEach((tendril, index) => {
      tendril.rotation.y = Math.sin(elapsed * 2.1 + index * 0.9) * 0.3;
      tendril.rotation.z += Math.sin(elapsed * 1.7 + index) * 0.08;
    });
    extras.forEach((part, index) => {
      part.rotation.y += (index % 2 ? -1 : 1) * dt * 0.12;
    });
    if (attackPose) {
      motion.scale.multiplyScalar(
        1 - attackPose.compression * 0.24 + attackPose.strike * 0.18,
      );
      motion.position.z += attackPose.lunge * 0.34;
      torso.rotation.y +=
        attackPose.anticipation * 0.8 + attackPose.twist * 0.16;
      tentacles.forEach((tendril, index) => {
        tendril.rotation.x +=
          -attackPose.anticipation * 0.25 +
          attackPose.strike * (0.35 + (index % 3) * 0.08);
      });
    }
  } else {
    const slimeBody = data.slimeBody as THREE.Mesh;
    const bounce = Math.sin(phase * 2),
      slimeBase = slimeBody.userData.baseScale as THREE.Vector3;
    slimeBody.scale.copy(slimeBase);
    slimeBody.scale.x *= 1 - bounce * 0.08 * locomotion;
    slimeBody.scale.y *= 1 + Math.abs(bounce) * 0.18 * locomotion;
    slimeBody.scale.z *= 1 - bounce * 0.08 * locomotion;
    motion.position.y = Math.max(0, bounce) * 0.12 * locomotion;
    if (attackPose) {
      const squash = attackPose.compression,
        stretch = attackPose.strike;
      slimeBody.scale.y *= 1 - squash * 0.36 + stretch * 0.58;
      slimeBody.scale.x *= 1 + squash * 0.24 - stretch * 0.18;
      slimeBody.scale.z *= 1 + squash * 0.24 - stretch * 0.18;
      motion.position.z += attackPose.lunge * 0.36;
      motion.position.y += attackPose.lift * 0.08;
    }
  }
  const working = !!mob.working && !mob.dead && !(mob.attackAnim || 0);
  if (data.workHammer) (data.workHammer as THREE.Group).visible = working;
  if (working) {
    const cycle =
      (elapsed * (data.kind === 'golem' ? 0.7 : 1.2) + mob.id * 0.17) % 1;
    const wind =
      smoothRange(0, 0.3, cycle) * (1 - smoothRange(0.34, 0.48, cycle));
    const strike =
      smoothRange(0.3, 0.52, cycle) * (1 - smoothRange(0.62, 0.94, cycle));
    if (data.kind === 'imp' || data.kind === 'armored') {
      const arms = data.arms as JointLimb[];
      data.workHammer ||= makeHammer(arms[1].end);
      (data.workHammer as THREE.Group).visible = true;
      (data.torso as THREE.Group).rotation.x = 0.12 * wind - 0.28 * strike;
      arms[1].upper.rotation.set(-1.5 * wind + 1.2 * strike, 0, 0.18);
      arms[1].lower.rotation.set(-0.88 * wind + 0.3 * strike, 0, 0);
      arms[0].upper.rotation.x = -0.45 + strike * 0.3;
    } else if (data.kind === 'beast' || data.kind === 'insect') {
      // Paws excavate; arthropod forelegs rake material, without human tools.
      (data.legs as JointLimb[]).slice(0, 2).forEach((leg, index) => {
        const rake = Math.sin(cycle * Math.PI * 2 + index * Math.PI);
        leg.upper.rotation.x += rake * 0.45;
        leg.lower.rotation.x -= Math.max(0, rake) * 0.55;
      });
      (data.head as THREE.Group).rotation.x += 0.2 + strike * 0.12;
    } else if (data.kind === 'golem' || data.kind === 'plant') {
      (data.arms as JointLimb[]).forEach((arm, index) => {
        arm.upper.rotation.x += -wind * (index ? 1 : 0.6) + strike * 0.65;
        arm.lower.rotation.x -= wind * 0.4;
      });
      motion.rotation.x += strike * 0.1;
    } else if (data.kind === 'flying') {
      motion.position.y -= strike * 0.35;
      (data.torso as THREE.Group).rotation.x += strike * 0.25;
    } else if (data.kind === 'aberration') {
      (data.tentacles as THREE.Object3D[]).forEach((part, index) => {
        part.rotation.x = -0.35 + Math.sin(cycle * Math.PI * 2 + index) * 0.2;
      });
    } else {
      (data.slimeBody as THREE.Mesh).scale.y *= 1 - strike * 0.22;
      (data.slimeBody as THREE.Mesh).scale.x *= 1 + strike * 0.15;
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
  const surrender = data.surrender as THREE.Mesh;
  surrender.visible = !!mob.dead && !mob.boss && (mob.recruitTime || 0) > 0;
  if (surrender.visible) {
    surrender.rotation.z = elapsed * 1.8;
    surrender.scale.setScalar(0.86 + Math.sin(elapsed * 4 + mob.id) * 0.09);
    (surrender.material as THREE.MeshBasicMaterial).opacity =
      0.35 + Math.min(0.45, (mob.recruitTime || 0) / 22);
  }
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

// oxlint-disable-next-line no-unused-vars -- retained until new landscape visual validation completes
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
    terrainHeight(region.x + region.w * 0.68, region.y + region.h * 0.5),
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
  onPerformance?: (sample: RenderPerformance) => void,
) {
  let mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
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
  const textureLease = acquireGraphics(renderer);
  const textures = textureLease.textures;
  const lightingStudio = new RoomEnvironment();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const reflectionMap = environmentGenerator.fromScene(lightingStudio, 0.04);
  scene.environment = reflectionMap.texture;
  scene.environmentIntensity = 0.35;
  lightingStudio.dispose();
  environmentGenerator.dispose();
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
    groundMat.color.lerp(new THREE.Color(0xa6a2aa), 0.65);
    textureSurface(groundMat, textures.soil, 0.035);
    const groundGeo = new THREE.PlaneGeometry(
        region.w * SCALE,
        region.h * SCALE,
        128,
        180,
      ),
      positions = groundGeo.attributes.position;
    for (let p = 0; p < positions.count; p++) {
      const x = region.x + region.w / 2 + positions.getX(p) / SCALE,
        y = region.y + region.h / 2 - positions.getY(p) / SCALE;
      positions.setZ(p, terrainHeight(x, y));
      groundGeo.attributes.uv.setXY(p, (x * SCALE) / 2.5, (y * SCALE) / 2.5);
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
    const before = scene.children.length;
    addLandmark(scene, region, i);
    landmarks.push(scene.children[before] as THREE.Group);
  });
  const landscape = createLandscape(scene, textures);
  const lootRenderer = createLootRenderer(scene);
  const hazardRenderer = createHazardRenderer(scene);
  const residents = new Map<string, { model: THREE.Group; mob: RenderMob }>();
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
  let firstPersonRig = buildFirstPersonRig('', 0, null),
    playerJob = '',
    playerRank = -1,
    playerWeapon: string | null | undefined = undefined;
  camera.add(firstPersonRig);
  const mobs = new Map<number, THREE.Group>(),
    nodes = new Map<number, THREE.Group>(),
    bases = new Map<number, THREE.Group>();
  let ghostKind = 'hideout',
    buildGhost = buildFieldBase(
      {
        id: -1,
        x: 0,
        y: 0,
        yaw: 0,
        level: 1,
        kind: ghostKind,
        name: '',
        progress: 0,
        duration: 1,
        complete: false,
        workers: 0,
      },
      true,
    );
  buildGhost.visible = false;
  scene.add(buildGhost);
  const armyBody = new THREE.InstancedMesh(geo.cylinder, mats.ally, 48),
    armyHead = new THREE.InstancedMesh(geo.lowSphere, mats.skin, 48),
    armyDummy = new THREE.Object3D();
  armyBody.castShadow = armyHead.castShadow = !mobile;
  armyBody.frustumCulled = armyHead.frustumCulled = false;
  scene.add(armyBody, armyHead);
  const enemyProxyCapacity = mobile ? 32 : 64;
  const enemyProxyShape: Record<
    MonsterKind,
    {
      body: THREE.BufferGeometry;
      feature: THREE.BufferGeometry;
      bodySize: [number, number, number];
      bodyHeight: number;
      featureSize: [number, number, number];
      featureHeight: number;
      featureForward?: number;
      flying?: boolean;
      bodyPitch?: number;
    }
  > = {
    imp: {
      body: geo.cylinder,
      feature: geo.cone,
      bodySize: [0.22, 0.64, 0.22],
      bodyHeight: 0.32,
      featureSize: [0.28, 0.38, 0.28],
      featureHeight: 1.36,
    },
    beast: {
      body: geo.cylinder,
      feature: geo.lowSphere,
      bodySize: [0.28, 0.66, 0.3],
      bodyHeight: 0.3,
      featureSize: [0.27, 0.24, 0.34],
      featureHeight: 0.65,
      featureForward: 0.68,
      bodyPitch: Math.PI / 2,
    },
    insect: {
      body: geo.lowSphere,
      feature: geo.cone,
      bodySize: [0.42, 0.22, 0.58],
      bodyHeight: 0.22,
      featureSize: [0.2, 0.45, 0.2],
      featureHeight: 0.68,
      featureForward: 0.52,
    },
    golem: {
      body: geo.rock,
      feature: geo.lowSphere,
      bodySize: [0.48, 0.72, 0.4],
      bodyHeight: 0.72,
      featureSize: [0.3, 0.3, 0.3],
      featureHeight: 1.55,
    },
    flying: {
      body: geo.lowSphere,
      feature: geo.box,
      bodySize: [0.3, 0.2, 0.48],
      bodyHeight: 1.75,
      featureSize: [0.88, 0.06, 0.34],
      featureHeight: 1.78,
      flying: true,
    },
    plant: {
      body: geo.cylinder,
      feature: geo.cone,
      bodySize: [0.3, 0.86, 0.3],
      bodyHeight: 0.43,
      featureSize: [0.62, 0.78, 0.62],
      featureHeight: 1.68,
    },
    slime: {
      body: geo.sphere,
      feature: geo.lowSphere,
      bodySize: [0.5, 0.38, 0.5],
      bodyHeight: 0.36,
      featureSize: [0.09, 0.09, 0.09],
      featureHeight: 0.61,
      featureForward: 0.35,
    },
    armored: {
      body: geo.box,
      feature: geo.lowSphere,
      bodySize: [0.43, 0.76, 0.36],
      bodyHeight: 0.38,
      featureSize: [0.34, 0.31, 0.33],
      featureHeight: 1.62,
    },
    aberration: {
      body: geo.octa,
      feature: geo.sphere,
      bodySize: [0.48, 0.62, 0.48],
      bodyHeight: 1.2,
      featureSize: [0.22, 0.22, 0.22],
      featureHeight: 1.94,
      flying: true,
    },
  };
  const enemyProxies = new Map<
    MonsterKind,
    { body: THREE.InstancedMesh; feature: THREE.InstancedMesh }
  >();
  const enemyProxyBuckets = new Map<MonsterKind, RenderMob[]>();
  for (const kind of MONSTER_KINDS) {
    const shape = enemyProxyShape[kind],
      body = new THREE.InstancedMesh(
        shape.body,
        mats.enemy,
        enemyProxyCapacity,
      ),
      feature = new THREE.InstancedMesh(
        shape.feature,
        kind === 'plant'
          ? mats.foliage
          : kind === 'golem' || kind === 'armored'
            ? mats.stoneLight
            : mats.crystal,
        enemyProxyCapacity,
      );
    body.count = feature.count = 0;
    body.castShadow = feature.castShadow = !mobile;
    body.frustumCulled = feature.frustumCulled = false;
    enemyProxies.set(kind, { body, feature });
    enemyProxyBuckets.set(kind, []);
    scene.add(body, feature);
  }
  let elapsed = 0,
    lastX = Number.NaN,
    lastY = Number.NaN;
  let currentQuality = '',
    adaptiveScale = 1,
    slowSamples = 0,
    fastSamples = 0,
    pendingDt = 0,
    lastDraw = 0;
  let sampleStarted = performance.now(),
    sampleFrames = 0,
    sampleTime = 0;
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
    const preferences = world.preferences || DEFAULT_PREFERENCES;
    mobile =
      matchMedia('(pointer: coarse)').matches || canvas.clientWidth < 760;
    const profile = qualityProfile(preferences.quality, mobile);
    const qualityKey = `${preferences.quality}:${mobile}`;
    if (currentQuality !== qualityKey) {
      currentQuality = qualityKey;
      adaptiveScale = 1;
      slowSamples = fastSamples = 0;
      renderer.setPixelRatio(
        Math.min(devicePixelRatio, profile.pixelRatio * adaptiveScale),
      );
      renderer.shadowMap.enabled = profile.shadowSize > 0;
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(
        Math.max(1, profile.shadowSize),
        Math.max(1, profile.shadowSize),
      );
      sun.shadow.needsUpdate = true;
      starGeo.setDrawRange(0, profile.particles);
      (scene.fog as THREE.FogExp2).density = 0.002 + 8 / profile.distance;
    }
    const now = performance.now();
    pendingDt += dt;
    if (now - lastDraw < 1000 / profile.fps - 1) return;
    lastDraw = now;
    dt = Math.min(pendingDt, 0.1);
    pendingDt = 0;
    elapsed += dt;
    ensureSize();
    const equippedWeapon = world.equipment?.weapon ?? null;
    if (
      world.job !== playerJob ||
      world.rank !== playerRank ||
      equippedWeapon !== playerWeapon
    ) {
      camera.remove(firstPersonRig);
      releaseModel(firstPersonRig);
      firstPersonRig = buildFirstPersonRig(
        world.job,
        world.rank,
        equippedWeapon,
      );
      camera.add(firstPersonRig);
      playerJob = world.job;
      playerRank = world.rank;
      playerWeapon = equippedWeapon;
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
    firstPersonRig.scale.setScalar(0.72 * Math.min(1, camera.aspect + 0.28));
    firstPersonRig.position.y -= 0.12;
    firstPersonRig.position.z = -0.45;
    const headBob =
      Math.cos(firstPersonRig.userData.gait * 2) *
      0.004 *
      firstPersonRig.userData.speedBlend *
      (world.height > 0.05 ? 0 : 1) *
      preferences.cameraMotion;
    const groundHeight = terrainHeight(world.x, world.y);
    camera.position.set(px, groundHeight + 1.68 + world.height + headBob, pz);
    landscape.update(world.x, world.y, elapsed, profile.distance, world.bases);
    hazardRenderer.update(
      world.x,
      world.y,
      world.worldTime || 0,
      profile.enemyDistance,
    );
    for (const site of DISCOVERY_SITES) {
      if (site.kind !== 'camp') continue;
      const at = campResidentAt(site),
        near = Math.hypot(at.x - world.x, at.y - world.y) < 1100;
      let resident = residents.get(site.id);
      if (!resident && near) {
        const mob: RenderMob = {
          id: 20000 + residents.size,
          ...at,
          hp: 100,
          max: 100,
          name: '道守り',
          tier: 2,
          kind:
            site.region === 'cave'
              ? 'golem'
              : site.region === 'forest'
                ? 'plant'
                : 'imp',
          home: site.region,
          ally: true,
          variant: 1,
        };
        const model = buildRiggedMob(mob);
        resident = { model, mob };
        residents.set(site.id, resident);
        scene.add(model);
      }
      if (!resident) continue;
      resident.model.visible = near;
      if (!near) continue;
      resident.model.position.set(
        worldX(at.x),
        terrainHeight(at.x, at.y),
        worldZ(at.y),
      );
      animateMobRig(
        resident.model,
        resident.mob,
        dt,
        elapsed,
        0,
        Math.atan2(world.x - at.x, world.y - at.y),
      );
      (resident.model.userData.bar as THREE.Group).visible = false;
    }
    lootRenderer.update(
      world.loot || [],
      world.x,
      world.y,
      elapsed,
      profile.enemyDistance,
    );
    const environment = regionAt(world.x, world.y);
    (scene.background as THREE.Color).lerp(
      new THREE.Color(environment.sky),
      Math.min(1, dt * 0.5),
    );
    (scene.fog as THREE.FogExp2).color.lerp(
      new THREE.Color(environment.mist),
      Math.min(1, dt * 0.5),
    );
    camera.rotation.set(world.viewPitch, Math.PI + world.viewYaw, 0);
    let cameraRoll =
        Math.sin(firstPersonRig.userData.gait) *
        0.0007 *
        firstPersonRig.userData.speedBlend,
      cameraKick = 0;
    if (world.attackAnim > 0 && world.attackTotal > 0) {
      const progress = clamp01(1 - world.attackAnim / world.attackTotal);
      cameraKick = Math.max(0, 1 - Math.abs(progress - 0.53) / 0.12);
      cameraRoll +=
        Math.sin(progress * Math.PI) *
        (world.attackKind === 'heavy' ? 0.026 : 0.014);
    }
    if (world.hitAnim > 0) cameraRoll += Math.sin(elapsed * 36) * 0.018;
    camera.rotation.x += cameraKick * 0.009 * preferences.cameraMotion;
    camera.rotation.z = cameraRoll * preferences.cameraMotion;
    const sprintFov =
      preferences.fov +
      (playerSpeedScene > 4.1 ? 6 * preferences.cameraMotion : 0);
    camera.fov = THREE.MathUtils.damp(camera.fov, sprintFov, 7, dt);
    camera.updateProjectionMatrix();
    const activeBases = new Set(world.bases.map((base) => base.id));
    for (const [id, base] of bases)
      if (!activeBases.has(id)) {
        scene.remove(base);
        releaseModel(base);
        bases.delete(id);
      }
    world.bases.forEach((site) => {
      let base = bases.get(site.id);
      if (base && base.userData.kind !== site.kind) {
        scene.remove(base);
        releaseModel(base);
        bases.delete(site.id);
        base = undefined;
      }
      if (!base) {
        base = buildFieldBase(site);
        bases.set(site.id, base);
        scene.add(base);
      }
      base.position.set(
        worldX(site.x),
        terrainHeight(site.x, site.y),
        worldZ(site.y),
      );
      base.rotation.y = site.yaw;
      base.scale.y = buildingHeightScale(site);
      base.visible = Math.hypot(site.x - world.x, site.y - world.y) < 4200;
    });
    if (world.buildMode && ghostKind !== world.selectedBuilding) {
      scene.remove(buildGhost);
      releaseModel(buildGhost);
      ghostKind = world.selectedBuilding;
      buildGhost = buildFieldBase(
        {
          id: -1,
          x: world.x,
          y: world.y,
          yaw: world.buildYaw,
          level: world.rank + 1,
          kind: ghostKind,
          name: '',
          progress: 0,
          duration: 1,
          complete: false,
          workers: 0,
        },
        true,
      );
      scene.add(buildGhost);
    }
    buildGhost.visible = world.buildMode;
    if (world.buildMode) {
      const planned = plannedBuilding(world);
      const invalid = placementIssue(
        planned,
        world.bases,
        world,
        world.nodes.filter((node) => node.n > 0),
      );
      const ghostMaterial = buildGhost.userData
        .ghostMaterial as THREE.MeshStandardMaterial;
      ghostMaterial.color.set(invalid ? 0xe96862 : 0x69dcb2);
      ghostMaterial.emissive.set(invalid ? 0x681a19 : 0x164c40);
      buildGhost.position.set(
        worldX(planned.x),
        terrainHeight(planned.x, planned.y) + 0.02,
        worldZ(planned.y),
      );
      buildGhost.rotation.y = planned.yaw;
    }
    const activeIds = new Set(world.mobs.map((m) => m.id));
    for (const [id, obj] of mobs)
      if (!activeIds.has(id)) {
        scene.remove(obj);
        releaseModel(obj);
        mobs.delete(id);
      }
    const detailedAllyLimit = profile.allies;
    const detailedIds = new Set<number>();
    for (const bucket of enemyProxyBuckets.values()) bucket.length = 0;
    const nearestAllies = new Set(
      world.mobs
        .filter((m) => m.ally && !m.dead)
        .sort(
          (a, b) =>
            Math.hypot(a.x - world.x, a.y - world.y) -
            Math.hypot(b.x - world.x, b.y - world.y),
        )
        .slice(0, detailedAllyLimit)
        .map((m) => m.id),
    );
    world.mobs.forEach((mob) => {
      const dx = mob.x - world.x,
        dy = mob.y - world.y,
        dist = Math.hypot(dx, dy),
        visibleRange = mob.boss
          ? profile.distance + 800
          : profile.enemyDistance,
        allyAllowed = !mob.ally || nearestAllies.has(mob.id),
        enemyDetailed =
          !!mob.ally ||
          !!mob.boss ||
          dist < profile.enemyDetailDistance ||
          (!!mobs.get(mob.id) && dist < profile.enemyDetailDistance * 1.16);
      let obj = mobs.get(mob.id);
      if (
        obj &&
        (obj.userData.ally !== !!mob.ally ||
          dist > visibleRange * 1.35 ||
          !enemyDetailed)
      ) {
        scene.remove(obj);
        releaseModel(obj);
        mobs.delete(mob.id);
        obj = undefined;
      }
      if (!obj && (dist >= visibleRange || !allyAllowed || !enemyDetailed)) {
        if (!mob.ally && !mob.boss && !mob.dead && dist < visibleRange) {
          const bucket = enemyProxyBuckets.get(mob.kind || 'imp')!;
          if (bucket.length < enemyProxyCapacity) bucket.push(mob);
        }
        return;
      }
      if (!obj) {
        obj = buildRiggedMob(mob);
        mobs.set(mob.id, obj);
        scene.add(obj);
      }
      obj.visible = dist < visibleRange && allyAllowed;
      if (!obj.visible) return;
      if (mob.ally) detailedIds.add(mob.id);
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
        mob.working && mob.workYaw !== undefined
          ? mob.workYaw
          : moved > 0.02
            ? Math.atan2(velocityX, velocityY)
            : Math.atan2(world.x - mob.x, world.y - mob.y);
      obj.position.set(
        worldX(mob.x),
        terrainHeight(mob.x, mob.y),
        worldZ(mob.y),
      );
      animateMobRig(obj, mob, dt, elapsed, speedScene, desiredYaw);
      const bar = obj.userData.bar as THREE.Group;
      bar.visible = !mob.dead;
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
    for (const kind of MONSTER_KINDS) {
      const units = enemyProxyBuckets.get(kind)!,
        proxy = enemyProxies.get(kind)!,
        shape = enemyProxyShape[kind];
      proxy.body.count = proxy.feature.count = units.length;
      units.forEach((unit, index) => {
        const tierScale = [0.58, 0.68, 0.82, 1.03, 1.3, 1.62, 1.95][
            Math.max(0, Math.min(6, unit.tier))
          ],
          ground = terrainHeight(unit.x, unit.y),
          bob = shape.flying
            ? Math.sin(elapsed * 2.1 + unit.id) * 0.09
            : Math.sin(elapsed * 3.2 + unit.id) * 0.018,
          yaw = Math.atan2(world.x - unit.x, world.y - unit.y),
          forwardX = Math.sin(yaw) * (shape.featureForward || 0) * tierScale,
          forwardZ = Math.cos(yaw) * (shape.featureForward || 0) * tierScale;
        armyDummy.position.set(
          worldX(unit.x),
          ground + shape.bodyHeight * tierScale + bob,
          worldZ(unit.y),
        );
        armyDummy.rotation.set(shape.bodyPitch || 0, yaw, 0);
        armyDummy.scale.set(
          shape.bodySize[0] * tierScale,
          shape.bodySize[1] * tierScale,
          shape.bodySize[2] * tierScale,
        );
        armyDummy.updateMatrix();
        proxy.body.setMatrixAt(index, armyDummy.matrix);
        armyDummy.position.set(
          worldX(unit.x) + forwardX,
          ground + shape.featureHeight * tierScale + bob,
          worldZ(unit.y) + forwardZ,
        );
        armyDummy.rotation.set(0, yaw, 0);
        armyDummy.scale.set(
          shape.featureSize[0] * tierScale,
          shape.featureSize[1] * tierScale,
          shape.featureSize[2] * tierScale,
        );
        armyDummy.updateMatrix();
        proxy.feature.setMatrixAt(index, armyDummy.matrix);
      });
      proxy.body.instanceMatrix.needsUpdate = true;
      proxy.feature.instanceMatrix.needsUpdate = true;
    }
    // LOD models represent real units at their actual positions, never invented troops.
    const proxyUnits = world.mobs
      .filter(
        (m) =>
          m.ally &&
          !m.dead &&
          !detailedIds.has(m.id) &&
          Math.hypot(m.x - world.x, m.y - world.y) < profile.distance,
      )
      .slice(0, mobile ? 24 : 48);
    const proxyCount = proxyUnits.length;
    armyBody.count = armyHead.count = proxyCount;
    for (let i = 0; i < proxyCount; i++) {
      const unit = proxyUnits[i],
        scale =
          unit.kind === 'armored'
            ? 1.6
            : unit.kind === 'golem'
              ? 1.3
              : unit.kind === 'imp'
                ? 0.65
                : 1,
        ground = terrainHeight(unit.x, unit.y),
        march = Math.sin(elapsed * 3 + unit.id) * 0.012,
        ax = worldX(unit.x),
        az = worldZ(unit.y);
      armyDummy.position.set(ax, ground + (0.72 + march) * scale, az);
      armyDummy.rotation.set(
        0,
        Math.atan2(world.x - unit.x, world.y - unit.y),
        0,
      );
      armyDummy.scale.set(0.3 * scale, 0.72 * scale, 0.3 * scale);
      armyDummy.updateMatrix();
      armyBody.setMatrixAt(i, armyDummy.matrix);
      armyDummy.position.y = ground + (1.38 + march) * scale;
      armyDummy.scale.setScalar(0.24 * scale);
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
        Math.hypot(node.x - world.x, node.y - world.y) <
        profile.enemyDistance * 0.65;
      obj.position.set(
        worldX(node.x),
        terrainHeight(node.x, node.y),
        worldZ(node.y),
      );
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
      const impact = creatureAttackImpactProgress(mob.kind || 'imp', true);
      return (
        progress > impact - 0.045 &&
        progress < impact + 0.045 &&
        Math.hypot(mob.x - world.x, mob.y - world.y) < 180
      );
    });
    if (bossImpact) {
      camera.position.x +=
        Math.sin(elapsed * 53) * 0.025 * preferences.cameraMotion;
      camera.position.y +=
        Math.cos(elapsed * 47) * 0.018 * preferences.cameraMotion;
    }
    sun.position.set(px - 8, groundHeight + 14, pz + 7);
    sun.target.position.set(px, groundHeight, pz);
    sun.target.updateMatrixWorld();
    embers.position.set(px, groundHeight, pz);
    embers.rotation.y = elapsed * 0.015;
    renderer.render(scene, camera);
    sampleFrames++;
    sampleTime += performance.now() - now;
    if (now - sampleStarted >= 1500) {
      const sampledFps = (sampleFrames * 1000) / (now - sampleStarted),
        sampledFrameMs = sampleTime / sampleFrames,
        frameBudget = 1000 / profile.fps,
        overloaded =
          sampledFps < profile.fps * 0.82 ||
          sampledFrameMs > frameBudget * 0.92,
        comfortable =
          sampledFps >= profile.fps * 0.96 &&
          sampledFrameMs < frameBudget * 0.62;
      slowSamples = overloaded ? slowSamples + 1 : 0;
      fastSamples = comfortable ? fastSamples + 1 : 0;
      if (slowSamples >= 2 || fastSamples >= 3) {
        const nextScale = adaptiveRenderScale(
          adaptiveScale,
          sampledFps,
          profile.fps,
          sampledFrameMs,
          mobile ? 0.62 : 0.72,
        );
        if (nextScale !== adaptiveScale) {
          adaptiveScale = nextScale;
          renderer.setPixelRatio(
            Math.min(devicePixelRatio, profile.pixelRatio * adaptiveScale),
          );
        }
        slowSamples = fastSamples = 0;
      }
      onPerformance?.({
        fps: sampledFps,
        targetFps: profile.fps,
        frameMs: sampledFrameMs,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        resolutionScale: adaptiveScale,
      });
      sampleStarted = now;
      sampleFrames = 0;
      sampleTime = 0;
    }
  };
  const dispose = () => {
    textureLease.release();
    reflectionMap.dispose();
    landscape.dispose();
    lootRenderer.dispose();
    hazardRenderer.dispose();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    scene.traverse((o) => {
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Points ||
        o instanceof THREE.Line
      ) {
        if (o.geometry && !sharedGeometry.has(o.geometry))
          geometries.add(o.geometry);
        const material = o.material as THREE.Material | THREE.Material[];
        (Array.isArray(material) ? material : [material]).forEach(
          (m) => !sharedMaterial.has(m) && materials.add(m),
        );
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    renderer.dispose();
  };
  return { render, dispose };
}

export function createDemonPreview(
  canvas: HTMLCanvasElement,
  job: string,
  rank: number,
  equippedWeapon?: string | null,
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const textureLease = acquireGraphics(renderer);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(34, 1, 0.08, 30);
  camera.position.set(0, 1.35, 4.55);
  camera.lookAt(0, 1.12, 0);
  scene.add(new THREE.HemisphereLight(0x8e92c8, 0x24101f, 1.7));
  const keyLight = new THREE.DirectionalLight(0xffd1aa, 3.5);
  keyLight.position.set(-3.2, 5.4, 4.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(512, 512);
  scene.add(keyLight);
  const magicLight = new THREE.PointLight(
    rank >= 6 ? 0xc28cff : 0x7b4fc9,
    2.2 + rank * 0.45,
    8,
  );
  magicLight.position.set(2.2, 1.8, 1.7);
  scene.add(magicLight);
  const floor = mesh(
    new THREE.CircleGeometry(2.4, 42),
    new THREE.MeshStandardMaterial({
      color: 0x15101c,
      roughness: 0.84,
      metalness: 0.18,
    }),
    [1, 1, 1],
    [0, 0, 0],
    scene,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const demon = buildRiggedPlayer(job, rank, equippedWeapon);
  demon.rotation.y = -0.28;
  scene.add(demon);
  const reveal = new THREE.Group(),
    revealMaterial = new THREE.MeshBasicMaterial({
      color: rank >= 6 ? 0xe0b7ff : 0x9e62e8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
  scene.add(reveal);
  for (let i = 0; i < 24; i++) {
    const shard = mesh(
      geo.octa,
      revealMaterial,
      [0.035, 0.12 + (i % 3) * 0.03, 0.035],
      [0, 0, 0],
      reveal,
      false,
    );
    shard.userData.angle = (i / 24) * Math.PI * 2;
    shard.userData.height = 0.25 + (i % 7) * 0.25;
  }
  let frameId = 0,
    last = performance.now(),
    elapsed = 0,
    targetYaw = -0.28,
    dragging = false,
    dragX = 0;
  const resize = () => {
    const width = Math.max(1, canvas.clientWidth),
      height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const down = (event: PointerEvent) => {
    dragging = true;
    dragX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!dragging) return;
    targetYaw += (event.clientX - dragX) * 0.008;
    dragX = event.clientX;
  };
  const up = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const draw = (now: number) => {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    elapsed += dt;
    resize();
    const data = demon.userData,
      pelvis = data.pelvis as THREE.Group,
      torso = data.torso as THREE.Group,
      head = data.head as THREE.Group,
      arms = data.arms as JointLimb[],
      cape = data.cape as THREE.Mesh,
      aura = data.aura as THREE.Mesh,
      revealProgress = smooth01(Math.min(1, elapsed / 1.25)),
      breath = Math.sin(elapsed * 2.05);
    demon.rotation.y = dampAngle(demon.rotation.y, targetYaw, 8, dt);
    if (!dragging) targetYaw += dt * 0.08;
    demon.scale.setScalar(0.76 + revealProgress * 0.24);
    demon.position.y = -(1 - revealProgress) * 0.24;
    pelvis.position.y = 0.9 + Math.sin(elapsed * 1.7) * 0.008;
    torso.rotation.set(0, Math.sin(elapsed * 0.52) * 0.025, 0);
    torso.scale.set(1 - breath * 0.003, 1 + breath * 0.008, 1 - breath * 0.003);
    head.rotation.set(
      Math.sin(elapsed * 0.73) * 0.018,
      Math.sin(elapsed * 0.41) * 0.055,
      0,
    );
    arms.forEach((arm, index) => {
      arm.upper.rotation.set(
        -0.08 + Math.sin(elapsed * 1.1 + index * Math.PI) * 0.018,
        0,
        arm.side * 0.07,
      );
      arm.lower.rotation.x = -0.1;
    });
    cape.rotation.x = -0.08 + Math.sin(elapsed * 1.6) * 0.02;
    if (aura.visible) {
      aura.rotation.z = elapsed * 0.38;
      (aura.material as THREE.MeshBasicMaterial).opacity =
        (0.1 + rank * 0.035) * revealProgress;
    }
    const bodyGlow = data.bodyGlow as THREE.MeshStandardMaterial;
    bodyGlow.emissiveIntensity =
      1.2 + rank * 0.55 + Math.sin(elapsed * 3.4) * 0.35;
    const burst = Math.min(1, elapsed / 1.6);
    reveal.visible = burst < 1;
    revealMaterial.opacity = Math.max(0, 1 - burst) * 0.9;
    reveal.children.forEach((shard, index) => {
      const angle = shard.userData.angle as number,
        radius = 0.25 + Math.sin(burst * Math.PI) * (0.8 + (index % 4) * 0.12);
      shard.position.set(
        Math.sin(angle) * radius,
        (shard.userData.height as number) + burst * 0.38,
        Math.cos(angle) * radius,
      );
      shard.rotation.y = elapsed * 2 + angle;
    });
    magicLight.intensity = 2.2 + rank * 0.45 + (1 - burst) * 5;
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(draw);
  };
  frameId = requestAnimationFrame(draw);
  return {
    dispose() {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      releaseModel(scene);
      textureLease.release();
      renderer.dispose();
    },
  };
}
