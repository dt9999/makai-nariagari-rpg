import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { anatomicalLoft } from './hands3d.ts';

export function demonTorsoGeometry(rank: number) {
  const strength = THREE.MathUtils.clamp(rank, 0, 7) * 0.008;
  return anatomicalLoft(
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
  );
}

export function demonPelvisGeometry(rank: number) {
  const strength = THREE.MathUtils.clamp(rank, 0, 7) * 0.004;
  return anatomicalLoft(
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
  );
}

export function demonLimbGeometry(
  length: number,
  radius: number,
  lower = false,
) {
  const calf = lower ? 1 : 0;
  return anatomicalLoft(
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
  const palm = new THREE.Mesh(
    new RoundedBoxGeometry(
      radius * 1.42,
      radius * 1.18,
      radius * 0.84,
      3,
      radius * 0.19,
    ),
    skin,
  );
  palm.name = '掌';
  palm.position.set(0, -radius * 0.54, 0.012);
  root.add(palm);
  for (let finger = 0; finger < 4; finger++) {
    const scale = [0.9, 1.04, 0.98, 0.78][finger],
      x = side * (-0.38 + finger * 0.255) * radius,
      length = radius * (0.82 + scale * 0.36),
      digit = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius * 0.115, length, 3, 7),
        skin,
      );
    digit.name = ['人差し指', '中指', '薬指', '小指'][finger];
    digit.position.set(x, -radius * 1.22 - length * 0.35, 0.015);
    digit.rotation.z = side * (finger - 1.5) * 0.025;
    root.add(digit);
    const nail = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.105, 7, 5),
      keratin,
    );
    nail.name = `${digit.name}の爪`;
    nail.scale.set(0.72, 0.9, 0.24);
    nail.position.set(x, digit.position.y - length * 0.48, radius * 0.105);
    root.add(nail);
  }
  const thumbLength = radius * 0.7,
    thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius * 0.14, thumbLength, 3, 7),
      skin,
    );
  thumb.name = '対向する親指';
  thumb.position.set(side * radius * 0.72, -radius * 0.62, 0.035);
  thumb.rotation.z = side * -0.72;
  thumb.rotation.x = -0.24;
  root.add(thumb);
  root.traverse((part) => {
    if (part instanceof THREE.Mesh) part.castShadow = part.receiveShadow = true;
  });
  return root;
}
