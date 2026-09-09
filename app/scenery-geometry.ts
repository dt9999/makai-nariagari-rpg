import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SceneryShape } from './scenery';

type Part = {
  geometry: THREE.BufferGeometry;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
};

function merged(parts: Part[]) {
  const transformed = parts.map((part) => {
    const source = part.geometry;
    source.scale(...(part.scale || [1, 1, 1]));
    source.rotateX(part.rotation?.[0] || 0);
    source.rotateY(part.rotation?.[1] || 0);
    source.rotateZ(part.rotation?.[2] || 0);
    source.translate(...(part.position || [0, 0, 0]));
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    return geometry;
  });
  const geometry = mergeGeometries(transformed, false);
  transformed.forEach((part) => part.dispose());
  if (!geometry) throw new Error('Failed to assemble scenery geometry.');
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const box = (
  scale: [number, number, number],
  position: [number, number, number],
  rotation?: [number, number, number],
): Part => ({
  geometry: new THREE.BoxGeometry(1, 1, 1),
  scale,
  position,
  rotation,
});

const column = (
  radius: number,
  height: number,
  position: [number, number, number],
  rotation?: [number, number, number],
  segments = 7,
): Part => ({
  geometry: new THREE.CylinderGeometry(radius * 0.72, radius, height, segments),
  position,
  rotation,
});

const cone = (
  radius: number,
  height: number,
  position: [number, number, number],
  rotation?: [number, number, number],
  segments = 6,
): Part => ({
  geometry: new THREE.ConeGeometry(radius, height, segments),
  position,
  rotation,
});

const rock = (
  radius: number,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
): Part => ({
  geometry: new THREE.DodecahedronGeometry(radius, 0),
  position,
  scale,
});

const shard = (
  radius: number,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation?: [number, number, number],
): Part => ({
  geometry: new THREE.OctahedronGeometry(radius, 0),
  position,
  scale,
  rotation,
});

/** Shared multi-part silhouettes keep each regional prop to one instanced draw call. */
export function createSceneryGeometries(): Record<
  SceneryShape,
  THREE.BufferGeometry
> {
  const deadTree = () =>
    merged([
      column(0.11, 0.72, [0, 0.36, 0], [0, 0, -0.04]),
      column(0.065, 0.48, [-0.14, 0.68, 0], [0, 0, 0.76]),
      column(0.055, 0.42, [0.15, 0.62, 0.03], [0.18, 0, -0.85]),
      column(0.038, 0.3, [0.02, 0.82, -0.06], [-0.62, 0.1, 0.2]),
    ]);
  return {
    ruin: merged([
      box([0.62, 0.08, 0.46], [0, 0.04, 0]),
      box([0.15, 0.9, 0.14], [-0.2, 0.49, 0], [0, 0, -0.05]),
      box([0.14, 0.58, 0.14], [0.23, 0.33, 0.03], [0.04, 0, 0.09]),
      box([0.53, 0.13, 0.14], [0.02, 0.9, 0], [0, 0, -0.1]),
    ]),
    tree: deadTree(),
    spire: merged([
      cone(0.24, 1, [0, 0.5, 0], [0.04, 0, -0.08], 5),
      cone(0.16, 0.72, [-0.22, 0.36, 0.08], [0, 0, 0.2], 5),
      cone(0.13, 0.56, [0.2, 0.28, -0.08], [0.14, 0, -0.16], 5),
    ]),
    palisade: merged([
      ...[-0.22, 0, 0.22].flatMap((x, index) => [
        column(0.07, 0.72 + index * 0.08, [x, 0.36 + index * 0.04, 0]),
        cone(0.075, 0.22, [x, 0.83 + index * 0.08, 0], undefined, 6),
      ]),
      box([0.72, 0.08, 0.08], [0, 0.35, 0.03], [0, 0, 0.05]),
    ]),
    shards: merged([
      shard(0.24, [0, 0.55, 0], [0.72, 1.8, 0.72], [0.1, 0, 0.14]),
      shard(0.18, [-0.28, 0.32, 0.08], [0.72, 1.25, 0.72], [0, 0, -0.18]),
      shard(0.15, [0.25, 0.23, -0.06], [0.7, 0.95, 0.7], [0.16, 0, 0.12]),
    ]),
    'dead-tree': deadTree(),
    fence: merged([
      column(0.07, 0.82, [-0.34, 0.41, 0]),
      column(0.07, 0.82, [0.34, 0.41, 0]),
      box([0.82, 0.09, 0.08], [0, 0.31, 0.01], [0, 0, 0.07]),
      box([0.82, 0.09, 0.08], [0, 0.61, 0.01], [0, 0, -0.06]),
    ]),
    fungus: merged([
      column(0.08, 0.62, [0, 0.31, 0], [0.03, 0, -0.04], 8),
      cone(0.38, 0.24, [0, 0.68, 0], [0, 0, 0.03], 12),
      column(0.045, 0.3, [-0.22, 0.15, 0.08], [0, 0, 0.09], 7),
      cone(0.2, 0.13, [-0.2, 0.34, 0.08], undefined, 10),
    ]),
    basalt: merged([
      column(0.2, 0.94, [0, 0.47, 0], [0, 0, -0.04], 6),
      column(0.15, 0.68, [-0.2, 0.34, 0.08], [0.05, 0, 0.08], 6),
      column(0.13, 0.53, [0.2, 0.265, -0.07], [-0.05, 0, -0.1], 6),
    ]),
    thorns: merged([
      cone(0.1, 0.92, [0, 0.46, 0], [0.05, 0, -0.08], 6),
      cone(0.075, 0.62, [-0.18, 0.43, 0], [0, 0, 0.62], 6),
      cone(0.065, 0.54, [0.18, 0.38, 0.02], [0.12, 0, -0.72], 6),
    ]),
    crown: merged([
      rock(0.34, [0, 0.78, 0], [1.25, 0.7, 1.05]),
      rock(0.28, [-0.28, 0.69, 0.04], [1, 0.75, 0.9]),
      rock(0.29, [0.27, 0.72, -0.03], [1.05, 0.8, 0.96]),
      rock(0.24, [0.03, 0.94, 0.05], [0.9, 0.72, 0.82]),
    ]),
    crystal: merged([
      shard(0.19, [0, 0.38, 0], [0.72, 2, 0.72], [0, 0, 0.08]),
      shard(0.13, [-0.17, 0.2, 0.04], [0.7, 1.4, 0.7], [0, 0, -0.18]),
      shard(0.11, [0.16, 0.15, -0.05], [0.68, 1.08, 0.68], [0.08, 0, 0.2]),
    ]),
    rubble: merged([
      rock(0.2, [-0.19, 0.13, 0], [1.2, 0.62, 0.9]),
      rock(0.18, [0.14, 0.1, 0.06], [1, 0.55, 1.25]),
      rock(0.12, [0.02, 0.07, -0.18], [1.35, 0.55, 0.8]),
    ]),
    lantern: merged([
      box([0.3, 0.4, 0.3], [0, 0.42, 0]),
      cone(0.24, 0.16, [0, 0.7, 0], undefined, 6),
      box([0.08, 0.2, 0.08], [0, 0.12, 0]),
    ]),
    bone: merged([
      column(0.045, 0.72, [0, 0.36, 0], [0, 0, -0.22], 7),
      column(0.035, 0.48, [-0.15, 0.32, 0], [0, 0, 0.72], 7),
      column(0.035, 0.42, [0.17, 0.38, 0], [0, 0, -0.78], 7),
      rock(0.12, [0.08, 0.78, 0], [1, 0.75, 0.7]),
    ]),
    ember: merged([
      shard(0.18, [0, 0.2, 0], [0.8, 1.35, 0.8]),
      shard(0.11, [-0.16, 0.1, 0.02], [0.7, 0.9, 0.7]),
      shard(0.09, [0.14, 0.08, -0.04], [0.7, 0.78, 0.7]),
    ]),
  };
}
