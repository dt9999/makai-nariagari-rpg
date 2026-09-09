import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  anatomicalLoft,
  createDemonArm,
  poseDemonArm,
  mountAtHandGrip,
} from '../app/hands3d.ts';

const materials = Object.fromEntries(
  ['skin', 'cloth', 'leather', 'metal', 'keratin', 'rune'].map((key) => [
    key,
    new THREE.MeshStandardMaterial(),
  ]),
);
const dispose = (root) =>
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });

test('anatomical loft has outward normals, closed ends and a varying wrist silhouette', () => {
  const geometry = anatomicalLoft([
    { at: [0, 0, 0], width: 0.1, depth: 0.08 },
    { at: [0, 0.2, 0], width: 0.05, depth: 0.04 },
    { at: [0, 0.3, 0], width: 0.06, depth: 0.03 },
  ]);
  const positions = geometry.getAttribute('position'),
    normals = geometry.getAttribute('normal');
  assert.ok(normals.getX(17) > 0.7);
  assert.ok(positions.getX(0) > positions.getX(17));
  assert.equal(geometry.index.count / 3, 96);
  assert.ok(Array.from(normals.array).every(Number.isFinite));
  geometry.dispose();
});

test('both arms use one bounded, fingerless mitten volume at all eight ranks', () => {
  for (const side of [-1, 1])
    for (let rank = 0; rank <= 7; rank++) {
      const arm = createDemonArm(side, rank, materials);
      const mitten = arm.getObjectByName('指を分けないミトン型の革手袋');
      assert.ok(mitten instanceof THREE.Mesh);
      for (const oldFinger of [
        '人差し指',
        '中指',
        '薬指',
        '小指',
        '対向する二関節の親指',
      ])
        assert.equal(arm.getObjectByName(oldFinger), undefined);
      assert.deepEqual(arm.userData.flex, []);
      let vertices = 0;
      arm.traverse((mesh) => {
        if (!(mesh instanceof THREE.Mesh)) return;
        vertices += mesh.geometry.getAttribute('position').count;
        for (const attribute of ['position', 'normal', 'uv'])
          assert.ok(
            Array.from(mesh.geometry.getAttribute(attribute).array).every(
              Number.isFinite,
            ),
          );
      });
      assert.ok(vertices < 3000, `${side}/${rank}: ${vertices} vertices`);
      assert.equal(
        !!arm.getObjectByName('身体とは別の金属製前腕甲'),
        rank >= 3,
      );
      dispose(arm);
    }
});

test('fingerless hand posing remains finite and keeps the mitten geometry rigid', () => {
  const arm = createDemonArm(1, 0, materials);
  const mitten = arm.getObjectByName('指を分けないミトン型の革手袋');
  const before = Array.from(mitten.geometry.getAttribute('position').array);
  poseDemonArm(arm, 0, 1 / 60);
  for (let frame = 0; frame < 60; frame++) poseDemonArm(arm, 1, 1 / 60);
  poseDemonArm(arm, Number.NaN, Infinity);
  assert.ok(Number.isFinite(arm.userData.grip));
  assert.deepEqual(
    Array.from(mitten.geometry.getAttribute('position').array),
    before,
  );
  dispose(arm);
});

test('left and right forearms and mittens mirror without negative mesh scales', () => {
  const left = createDemonArm(-1, 0, materials),
    right = createDemonArm(1, 0, materials);
  for (const name of ['肘から手首へ続く前腕', '指を分けないミトン型の革手袋']) {
    const a = left.getObjectByName(name).geometry,
      b = right.getObjectByName(name).geometry;
    a.computeBoundingBox();
    b.computeBoundingBox();
    assert.ok(Math.abs(a.boundingBox.min.x + b.boundingBox.max.x) < 0.001);
    assert.ok(Math.abs(a.boundingBox.max.y - b.boundingBox.max.y) < 0.001);
  }
  dispose(left);
  dispose(right);
});

test('weapon, staff, dagger and hammer handle centres stay inside the grip through all swing rotations', () => {
  for (const side of [-1, 1])
    for (const centre of [0.02, 0.1, 0.15, 0.18, 0.25]) {
      const root = new THREE.Group(),
        handle = new THREE.Object3D();
      handle.position.y = centre;
      root.add(handle);
      mountAtHandGrip(root, centre, side);
      for (const angle of [-1.2, -0.2, 0, 0.7, 1.5]) {
        root.rotation.set(angle * 0.6, -0.22, angle);
        root.updateMatrixWorld(true);
        const point = handle.getWorldPosition(new THREE.Vector3());
        assert.ok(
          point.distanceTo(new THREE.Vector3(side * 0.022, 0.218, -0.263)) <
            1e-7,
        );
      }
    }
});

test.after(() =>
  Object.values(materials).forEach((material) => material.dispose()),
);
