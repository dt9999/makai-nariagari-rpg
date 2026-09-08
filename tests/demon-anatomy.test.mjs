import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createCreatureLimbEnd,
  createFullBodyDemonHand,
  demonLimbGeometry,
  demonPelvisGeometry,
  demonShoulderGeometry,
  demonTorsoGeometry,
} from '../app/demon-anatomy3d.ts';

const sizeOf = (geometry) => {
  geometry.computeBoundingBox();
  return geometry.boundingBox.getSize(new THREE.Vector3());
};

test('full-body anatomy has tapered three-dimensional torso, pelvis and limbs', () => {
  const torso = demonTorsoGeometry(0),
    sovereignTorso = demonTorsoGeometry(7),
    pelvis = demonPelvisGeometry(0),
    shoulder = demonShoulderGeometry(0.105, 0),
    upper = demonLimbGeometry(0.52, 0.115),
    lower = demonLimbGeometry(0.46, 0.1, true);
  for (const geometry of [
    torso,
    sovereignTorso,
    pelvis,
    shoulder,
    upper,
    lower,
  ]) {
    const size = sizeOf(geometry);
    assert.ok(size.x > 0 && size.y > 0 && size.z > 0);
    assert.ok(geometry.getAttribute('normal').count > 0);
  }
  assert.ok(sizeOf(sovereignTorso).x > sizeOf(torso).x);
  assert.ok(sizeOf(upper).y > sizeOf(lower).y);
  const shoulderSize = sizeOf(shoulder);
  assert.ok(shoulderSize.y < shoulderSize.z * 0.8);
  assert.strictEqual(demonShoulderGeometry(0.105, 0), shoulder);
});

test('creature families have silhouette-specific feet, claws, fists and roots', () => {
  const body = new THREE.MeshStandardMaterial(),
    accent = new THREE.MeshStandardMaterial();
  const expected = {
    boot: '厚底の足',
    paw: '獣の足裏',
    claw: '節足の関節',
    stone: '岩塊の拳',
    root: '根指1',
  };
  const signatures = new Set();
  for (const [style, namedPart] of Object.entries(expected)) {
    const end = createCreatureLimbEnd(style, body, accent, 1, 0.12),
      names = [];
    end.traverse((part) => names.push(part.name));
    assert.ok(names.includes(namedPart));
    assert.ok(end.children.length >= (style === 'boot' ? 1 : 3));
    const size = new THREE.Box3()
      .setFromObject(end)
      .getSize(new THREE.Vector3());
    assert.ok(size.x > 0.1 && size.y > 0.05 && size.z > 0.03);
    signatures.add(
      `${end.children.length}:${size.x.toFixed(2)}:${size.y.toFixed(2)}:${size.z.toFixed(2)}`,
    );
  }
  assert.equal(signatures.size, Object.keys(expected).length);
});

test('repeated creatures reuse immutable anatomy geometry instead of duplicating GPU data', () => {
  assert.strictEqual(demonTorsoGeometry(2), demonTorsoGeometry(2));
  assert.strictEqual(demonPelvisGeometry(4), demonPelvisGeometry(4));
  assert.strictEqual(
    demonLimbGeometry(0.52, 0.115),
    demonLimbGeometry(0.52, 0.115),
  );
  const body = new THREE.MeshStandardMaterial(),
    accent = new THREE.MeshStandardMaterial(),
    first = createCreatureLimbEnd('paw', body, accent, 1, 0.085),
    second = createCreatureLimbEnd('paw', body, accent, -1, 0.085),
    firstMeshes = [],
    secondMeshes = [];
  first.traverse((part) => {
    if (part instanceof THREE.Mesh) firstMeshes.push(part);
  });
  second.traverse((part) => {
    if (part instanceof THREE.Mesh) secondMeshes.push(part);
  });
  assert.equal(firstMeshes.length, secondMeshes.length);
  firstMeshes.forEach((mesh, index) =>
    assert.strictEqual(mesh.geometry, secondMeshes[index].geometry),
  );
});

test('full-body hands use a palm, four distinct fingers, thumb and nails', () => {
  const skin = new THREE.MeshStandardMaterial(),
    nail = new THREE.MeshStandardMaterial();
  for (const side of [-1, 1]) {
    const hand = createFullBodyDemonHand(skin, nail, side, 0.105),
      names = [];
    hand.traverse((part) => names.push(part.name));
    assert.ok(names.includes('掌'));
    assert.ok(names.includes('対向する親指'));
    for (const finger of ['人差し指', '中指', '薬指', '小指']) {
      assert.ok(names.includes(finger));
      assert.ok(names.includes(`${finger}の爪`));
    }
    assert.ok(names.includes('親指の二関節'));
    assert.ok(names.includes('親指の爪'));
    const box = new THREE.Box3().setFromObject(hand),
      size = box.getSize(new THREE.Vector3());
    assert.ok(size.x > 0.1 && size.y > 0.1 && size.z > 0.03);

    const indexFinger = hand.getObjectByName('人差し指'),
      nailPlate = hand.getObjectByName('人差し指の爪'),
      palm = hand.getObjectByName('掌');
    assert.equal(indexFinger.geometry.type, 'BufferGeometry');
    assert.equal(nailPlate.geometry.type, 'BufferGeometry');
    assert.equal(palm.userData.anatomy, '手根・母指球を含む連続曲面');
    const nailSize = sizeOf(nailPlate.geometry);
    assert.ok(
      nailSize.z < nailSize.x * 0.35,
      'nails are thin plates, not balls',
    );
  }
});
