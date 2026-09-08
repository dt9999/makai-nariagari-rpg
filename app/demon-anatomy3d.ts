import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { anatomicalLoft } from './hands3d.ts';

const geometryCache = new Map<string, THREE.BufferGeometry>();
function cachedGeometry<T extends THREE.BufferGeometry>(
  key: string,
  create: () => T,
): T {
  const cached = geometryCache.get(key);
  if (cached) return cached as T;
  const geometry = create();
  geometryCache.set(key, geometry);
  return geometry;
}

export function demonTorsoGeometry(rank: number) {
  const strength = THREE.MathUtils.clamp(rank, 0, 7) * 0.008;
  return cachedGeometry(`torso:${rank}`, () =>
    anatomicalLoft(
      [
        { at: [0, 0, 0], width: 0.27, depth: 0.18 },
        { at: [0, 0.16, 0], width: 0.34, depth: 0.215 },
        {
          at: [0, 0.48, 0],
          width: 0.395 + strength,
          depth: 0.235 + strength * 0.55,
        },
        {
          at: [0, 0.72, 0],
          width: 0.42 + strength,
          depth: 0.245 + strength * 0.6,
        },
        { at: [0, 0.86, 0], width: 0.275, depth: 0.18 },
      ],
      18,
    ),
  );
}

export function demonPelvisGeometry(rank: number) {
  const strength = THREE.MathUtils.clamp(rank, 0, 7) * 0.004;
  return cachedGeometry(`pelvis:${rank}`, () =>
    anatomicalLoft(
      [
        { at: [0, -0.14, 0], width: 0.255, depth: 0.18 },
        {
          at: [0, -0.04, 0],
          width: 0.32 + strength,
          depth: 0.215 + strength,
        },
        { at: [0, 0.11, 0], width: 0.31, depth: 0.205 },
        { at: [0, 0.18, 0], width: 0.275, depth: 0.18 },
      ],
      16,
    ),
  );
}

export function demonLimbGeometry(
  length: number,
  radius: number,
  lower = false,
) {
  const calf = lower ? 1 : 0;
  return cachedGeometry(
    `limb:${length.toFixed(4)}:${radius.toFixed(4)}:${lower}`,
    () =>
      anatomicalLoft(
        [
          { at: [0, 0, 0], width: radius * 1.04, depth: radius },
          {
            at: [0, -length * 0.28, 0],
            width: radius * (1.13 + calf * 0.03),
            depth: radius * 1.04,
          },
          {
            at: [0, -length * 0.68, 0],
            width: radius * (0.96 + calf * 0.12),
            depth: radius * (0.91 + calf * 0.08),
          },
          {
            at: [0, -length, 0],
            width: radius * 0.79,
            depth: radius * 0.75,
          },
        ],
        12,
      ),
  );
}

export function demonShoulderGeometry(radius: number, rank: number) {
  const development = THREE.MathUtils.clamp(rank, 0, 7) * 0.012;
  return cachedGeometry(`shoulder:${radius.toFixed(4)}:${rank}`, () =>
    anatomicalLoft(
      [
        {
          at: [0, radius * 0.25, 0],
          width: radius * (1.18 + development),
          depth: radius * 1.02,
        },
        {
          at: [0, -radius * 0.18, radius * 0.02],
          width: radius * (1.48 + development),
          depth: radius * (1.28 + development * 0.4),
        },
        {
          at: [0, -radius * 0.82, 0],
          width: radius * 1.22,
          depth: radius * 1.08,
        },
        {
          at: [0, -radius * 1.35, 0],
          width: radius * 0.92,
          depth: radius * 0.86,
        },
      ],
      14,
    ),
  );
}

export function createFullBodyDemonHand(
  skin: THREE.Material,
  keratin: THREE.Material,
  side: number,
  radius: number,
) {
  const root = new THREE.Group();
  root.name = side > 0 ? '右手・五指' : '左手・五指';
  const radiusKey = radius.toFixed(4),
    palm = new THREE.Mesh(
      cachedGeometry(`hand-palm:${radiusKey}`, () =>
        anatomicalLoft(
          [
            {
              at: [0, 0, 0],
              width: radius * 0.45,
              depth: radius * 0.31,
            },
            {
              at: [0, -radius * 0.28, radius * 0.015],
              width: radius * 0.62,
              depth: radius * 0.39,
            },
            {
              at: [0, -radius * 0.72, radius * 0.025],
              width: radius * 0.72,
              depth: radius * 0.42,
            },
            {
              at: [0, -radius * 1.16, 0],
              width: radius * 0.63,
              depth: radius * 0.35,
            },
          ],
          14,
        ),
      ),
      skin,
    );
  palm.name = '掌';
  palm.userData.anatomy = '手根・母指球を含む連続曲面';
  root.add(palm);
  for (let finger = 0; finger < 4; finger++) {
    const scale = [0.9, 1.04, 0.98, 0.78][finger],
      x = side * (-0.49 + finger * 0.33) * radius,
      length = radius * (0.76 + scale * 0.42),
      digit = new THREE.Mesh(
        cachedGeometry(`hand-finger:${radiusKey}:${finger}`, () =>
          anatomicalLoft(
            [
              {
                at: [0, 0, 0],
                width: radius * 0.14,
                depth: radius * 0.12,
              },
              {
                at: [0, -length * 0.31, radius * 0.025],
                width: radius * 0.15,
                depth: radius * 0.128,
              },
              {
                at: [0, -length * 0.64, radius * 0.045],
                width: radius * 0.126,
                depth: radius * 0.112,
              },
              {
                at: [0, -length, radius * 0.02],
                width: radius * 0.075,
                depth: radius * 0.068,
              },
            ],
            10,
          ),
        ),
        skin,
      );
    digit.name = ['人差し指', '中指', '薬指', '小指'][finger];
    digit.position.set(x, -radius * 1.08, 0.005);
    digit.rotation.z = side * (finger - 1.5) * 0.025;
    root.add(digit);
    const nail = new THREE.Mesh(
      cachedGeometry(`hand-nail:${radiusKey}:${finger}`, () =>
        anatomicalLoft(
          [
            {
              at: [0, 0, 0],
              width: radius * 0.098,
              depth: radius * 0.021,
            },
            {
              at: [0, -length * 0.17, 0],
              width: radius * 0.09,
              depth: radius * 0.018,
            },
            {
              at: [0, -length * 0.29, 0],
              width: radius * 0.018,
              depth: radius * 0.008,
            },
          ],
          8,
        ),
      ),
      keratin,
    );
    nail.name = `${digit.name}の爪`;
    nail.position.set(x, digit.position.y - length * 0.69, radius * 0.125);
    nail.rotation.z = digit.rotation.z;
    root.add(nail);
  }
  const thumbLength = radius * 0.82,
    thumb = new THREE.Group(),
    thumbDigit = new THREE.Mesh(
      cachedGeometry(`hand-thumb:${radiusKey}`, () =>
        anatomicalLoft(
          [
            {
              at: [0, 0, 0],
              width: radius * 0.18,
              depth: radius * 0.15,
            },
            {
              at: [0, -thumbLength * 0.45, radius * 0.018],
              width: radius * 0.16,
              depth: radius * 0.14,
            },
            {
              at: [0, -thumbLength, 0],
              width: radius * 0.09,
              depth: radius * 0.075,
            },
          ],
          10,
        ),
      ),
      skin,
    ),
    thumbNail = new THREE.Mesh(
      cachedGeometry(`hand-thumb-nail:${radiusKey}`, () =>
        anatomicalLoft(
          [
            {
              at: [0, 0, 0],
              width: radius * 0.105,
              depth: radius * 0.022,
            },
            {
              at: [0, -thumbLength * 0.2, 0],
              width: radius * 0.082,
              depth: radius * 0.016,
            },
            {
              at: [0, -thumbLength * 0.31, 0],
              width: radius * 0.018,
              depth: radius * 0.008,
            },
          ],
          8,
        ),
      ),
      keratin,
    );
  thumb.name = '対向する親指';
  thumbDigit.name = '親指の二関節';
  thumbNail.name = '親指の爪';
  thumbNail.position.set(0, -thumbLength * 0.55, radius * 0.15);
  thumb.add(thumbDigit, thumbNail);
  thumb.position.set(side * radius * 0.62, -radius * 0.38, 0.025);
  thumb.rotation.z = side * -0.72;
  thumb.rotation.x = -0.24;
  root.add(thumb);
  root.traverse((part) => {
    if (part instanceof THREE.Mesh) part.castShadow = part.receiveShadow = true;
  });
  return root;
}

export type CreatureLimbEnd =
  | 'hand'
  | 'boot'
  | 'paw'
  | 'claw'
  | 'stone'
  | 'root';

export function createCreatureLimbEnd(
  style: CreatureLimbEnd,
  material: THREE.Material,
  accent: THREE.Material,
  side: number,
  radius: number,
) {
  if (style === 'hand')
    return createFullBodyDemonHand(material, accent, side, radius);
  const root = new THREE.Group();
  root.name = `専用肢端・${style}`;
  if (style === 'boot') {
    const boot = new THREE.Mesh(
      cachedGeometry(
        `end-boot:${radius.toFixed(4)}`,
        () =>
          new RoundedBoxGeometry(
            radius * 2.25,
            radius * 1.25,
            radius * 3.1,
            2,
            radius * 0.3,
          ),
      ),
      accent,
    );
    boot.name = '厚底の足';
    boot.position.set(0, -radius * 0.2, radius * 0.55);
    root.add(boot);
  } else if (style === 'paw') {
    const pad = new THREE.Mesh(
      cachedGeometry(
        `end-paw:${radius.toFixed(4)}`,
        () =>
          new RoundedBoxGeometry(
            radius * 2.5,
            radius * 1.15,
            radius * 3.3,
            3,
            radius * 0.35,
          ),
      ),
      material,
    );
    pad.name = '獣の足裏';
    pad.position.set(0, -radius * 0.13, radius * 0.46);
    root.add(pad);
    for (let toe = 0; toe < 3; toe++) {
      const claw = new THREE.Mesh(
        cachedGeometry(
          `end-paw-claw:${radius.toFixed(4)}`,
          () => new THREE.ConeGeometry(radius * 0.18, radius * 0.72, 7),
        ),
        accent,
      );
      claw.name = `獣爪${toe + 1}`;
      claw.position.set(
        (toe - 1) * radius * 0.62,
        -radius * 0.12,
        radius * 2.2,
      );
      claw.rotation.x = Math.PI / 2;
      root.add(claw);
    }
  } else if (style === 'claw') {
    const joint = new THREE.Mesh(
      cachedGeometry(
        `end-insect-joint:${radius.toFixed(4)}`,
        () => new THREE.SphereGeometry(radius * 0.78, 9, 6),
      ),
      material,
    );
    joint.name = '節足の関節';
    joint.scale.set(1.3, 0.68, 0.85);
    root.add(joint);
    for (const fork of [-1, 1]) {
      const hook = new THREE.Mesh(
        cachedGeometry(
          `end-insect-claw:${radius.toFixed(4)}`,
          () => new THREE.ConeGeometry(radius * 0.22, radius * 1.85, 6),
        ),
        accent,
      );
      hook.name = fork < 0 ? '左鉤爪' : '右鉤爪';
      hook.position.set(fork * radius * 0.42, -radius * 0.82, radius * 0.22);
      hook.rotation.z = fork * -0.38;
      hook.rotation.x = -0.25;
      root.add(hook);
    }
  } else if (style === 'stone') {
    const knuckle = new THREE.Mesh(
      cachedGeometry(
        `end-stone-fist:${radius.toFixed(4)}`,
        () => new THREE.DodecahedronGeometry(radius * 1.45, 1),
      ),
      material,
    );
    knuckle.name = '岩塊の拳';
    knuckle.scale.set(1.12, 0.82, 1.04);
    knuckle.position.y = -radius * 0.38;
    root.add(knuckle);
    for (let shard = 0; shard < 3; shard++) {
      const toe = new THREE.Mesh(
        cachedGeometry(
          `end-stone-finger:${radius.toFixed(4)}`,
          () => new THREE.DodecahedronGeometry(radius * 0.55, 0),
        ),
        accent,
      );
      toe.name = `岩指${shard + 1}`;
      toe.position.set(
        (shard - 1) * radius * 0.72,
        -radius * 0.86,
        radius * 0.5,
      );
      root.add(toe);
    }
  } else {
    for (let rootIndex = 0; rootIndex < 4; rootIndex++) {
      const angle = ((rootIndex - 1.5) / 3) * 1.35,
        rootFinger = new THREE.Mesh(
          cachedGeometry(
            `end-root:${radius.toFixed(4)}`,
            () => new THREE.ConeGeometry(radius * 0.22, radius * 2.5, 7),
          ),
          rootIndex % 2 ? material : accent,
        );
      rootFinger.name = `根指${rootIndex + 1}`;
      rootFinger.position.set(
        Math.sin(angle) * radius * 0.8,
        -radius * 0.9,
        Math.cos(angle) * radius * 0.65,
      );
      rootFinger.rotation.z = Math.sin(angle) * 0.38;
      rootFinger.rotation.x = Math.cos(angle) * 0.28;
      root.add(rootFinger);
    }
  }
  root.traverse((part) => {
    if (part instanceof THREE.Mesh) part.castShadow = part.receiveShadow = true;
  });
  return root;
}
