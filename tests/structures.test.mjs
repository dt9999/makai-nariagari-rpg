import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  structurePlan,
  localToWorld,
  worldToLocal,
  blockedByBuildings,
  moveAroundBuildings,
  plannedBuilding,
  placementIssue,
  buildingHeightScale,
  constructionRate,
  constructionWork,
  constructionPoint,
  constructionApproach,
  clearBuildingSight,
  sceneryInsideBuilding,
} from '../app/structures.ts';
import { createStructureModel } from '../app/structures3d.ts';
import {
  DISCOVERY_SITES,
  HAZARDS,
  wallsFor,
  WORLD_WIDTH,
} from '../app/world.ts';

const kinds = [
  'hideout',
  'storage',
  'barracks',
  'smithy',
  'laboratory',
  'watchtower',
  'wall',
  'gate',
  'fortress',
  'castle',
  'demon-castle',
];
const landmark = DISCOVERY_SITES.find((s) => s.kind === 'vista');
const site = (kind = 'hideout', yaw = 0, extra = {}) => ({
  id: 10,
  kind,
  x: landmark.x,
  y: landmark.y,
  yaw,
  complete: true,
  progress: 14,
  duration: 14,
  ...extra,
});
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);

test('clearing respects rotated footprints and resource placement never removes resources', () => {
  const building = site('hideout', 0.7, { x: 800, y: 800 });
  assert.ok(sceneryInsideBuilding(building, [building]));
  assert.equal(
    sceneryInsideBuilding(localToWorld(building, 20, 0), [building]),
    false,
  );
  const resources = [{ x: building.x, y: building.y, n: 3 }];
  assert.match(placementIssue(building, [], undefined, resources), /採集物/);
  assert.equal(resources[0].n, 3);
});

test('all eleven buildings draw exactly the shared metre-based plan without per-part resources', () => {
  const mat = new THREE.MeshStandardMaterial();
  const materials = Object.fromEntries(
    ['stone', 'wood', 'iron', 'cloth', 'glow', 'fire'].map((key) => [key, mat]),
  );
  const geometry = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
    cone: new THREE.ConeGeometry(1, 1, 8),
  };
  for (const kind of kinds) {
    const plan = structurePlan(kind),
      model = createStructureModel(site(kind), materials, geometry);
    assert.ok(plan.width > 0 && plan.depth > 0);
    assert.equal(model.children.length, plan.parts.length);
    assert.equal(model.userData.ghostMaterial, null);
    plan.parts.forEach((part, index) => {
      assert.ok(
        part.size.every((value) => Number.isFinite(value) && value > 0),
      );
      assert.ok(part.at.every(Number.isFinite));
      const mesh = model.children[index];
      assert.equal(mesh.geometry, geometry[part.shape]);
      assert.equal(mesh.material, mat);
      assert.deepEqual(mesh.position.toArray(), part.at);
      close(mesh.scale.x, part.size[0] * (part.shape === 'box' ? 1 : 0.5));
    });
    const ghost = createStructureModel(site(kind), materials, geometry, true);
    assert.ok(
      ghost.children.every(
        (mesh) =>
          mesh.material === ghost.userData.ghostMaterial && !mesh.castShadow,
      ),
    );
    ghost.userData.ghostMaterial.dispose();
  }
  Object.values(geometry).forEach((g) => g.dispose());
  mat.dispose();
});

test('rotated architecture round-trips between world and local coordinates', () => {
  for (const yaw of [0, Math.PI / 2, -1.7, Math.PI]) {
    const building = site('castle', yaw);
    for (const [x, z] of [
      [0, 0],
      [-5, 7],
      [2, -3],
    ]) {
      const result = worldToLocal(building, localToWorld(building, x, z));
      close(result.x, x);
      close(result.y, z);
    }
  }
});

test('every enterable completed building has an open central entrance in all orientations', () => {
  for (const kind of kinds.filter((kind) => kind !== 'wall'))
    for (const yaw of [0, Math.PI / 2, -0.8]) {
      const building = site(kind, yaw),
        plan = structurePlan(kind);
      for (let z = -plan.depth / 2 - 0.5; z <= 0; z += 0.15) {
        assert.equal(
          blockedByBuildings(localToWorld(building, 0, z), [building]),
          false,
          `${kind} yaw ${yaw} doorway z ${z}`,
        );
      }
    }
});

test('walls block walking and swept fast dodges, while doors allow movement', () => {
  for (const yaw of [0, Math.PI / 2]) {
    const building = site('hideout', yaw);
    const start = localToWorld(building, 0, 0),
      end = localToWorld(building, 4, 0);
    const stopped = worldToLocal(
      building,
      moveAroundBuildings(start, end, [building]),
    );
    assert.ok(stopped.x < 1.55 && stopped.x > 1.35);
    const doorway = localToWorld(building, 0, -2.5);
    const arrived = moveAroundBuildings(doorway, start, [building]);
    close(arrived.x, start.x);
    close(arrived.y, start.y);
  }
  const wall = site('wall');
  assert.ok(blockedByBuildings(localToWorld(wall, 0, 0), [wall]));
});

test('construction collision follows the same growing height as the model', () => {
  const building = site('hideout', 0, { complete: false, progress: 0 });
  close(buildingHeightScale(building), 0.12);
  const point = localToWorld(building, 1.85, 0);
  assert.ok(blockedByBuildings(point, [building]));
  assert.equal(blockedByBuildings(point, [building], 0.5), false);
  building.progress = 14;
  assert.ok(blockedByBuildings(point, [building], 0.5));
  close(buildingHeightScale(building), 1);
});

test('placement rejects overlapping sites, player, boundaries, static walls, hazards and steep ground', () => {
  const building = site();
  assert.equal(
    placementIssue(site('hideout', 0, { x: 800, y: 800 }), []),
    null,
  );
  assert.match(
    placementIssue(building, [
      site('hideout', 0.6, { complete: false, progress: 0 }),
    ]),
    /重な/,
  );
  assert.match(placementIssue(building, [], building), /自分/);
  assert.match(
    placementIssue(site('castle', 0.5, { x: WORLD_WIDTH - 20 }), []),
    /境界/,
  );
  const camp = DISCOVERY_SITES.find((s) => s.kind === 'camp');
  const wall = wallsFor(camp)[0];
  assert.match(
    placementIssue(site('hideout', 0, { x: wall.x, y: wall.y }), []),
    /集落/,
  );
  const hazardIssues = HAZARDS.map((hazard) =>
    placementIssue(site('hideout', 0, { x: hazard.x, y: hazard.y }), []),
  );
  assert.ok(hazardIssues.every(Boolean));
  assert.ok(hazardIssues.some((issue) => issue.includes('危険')));
  // Find a real sloping test plot rather than assuming all biome terrain is flat.
  let steep = false;
  for (let x = 1500; x < 7000 && !steep; x += 250)
    for (let y = 1800; y < 7000 && !steep; y += 250)
      steep =
        placementIssue(site('demon-castle', 0.5, { x, y }), [])?.includes(
          '傾斜',
        ) || false;
  assert.ok(steep);
});

test('large building previews keep the entire footprint ahead of the player', () => {
  for (const kind of kinds)
    for (const viewYaw of [0, 1.1, Math.PI]) {
      const player = { x: 4000, y: 4000, viewYaw, selectedBuilding: kind };
      const preview = plannedBuilding(player),
        local = worldToLocal(preview, player);
      close(local.x, 0);
      assert.ok(local.y <= -structurePlan(kind).depth / 2 - 2 + 0.00001);
      close(preview.yaw, viewYaw);
    }
});

test('only on-site workers and an idle player facing the site contribute', () => {
  const building = site('hideout', 0, { complete: false, progress: 0 });
  const front = constructionPoint(building, 2);
  const player = { ...front, viewYaw: 0, canWork: false };
  const away = { id: 2, x: front.x + 500, y: front.y, power: 8 };
  let result = constructionWork([building], [away], player);
  assert.equal(result.assignments.get(2).id, building.id);
  assert.equal(result.rates.get(building.id), 0);
  result = constructionWork([building], [{ ...away, ...front }], player);
  assert.equal(result.present.get(building.id).length, 1);
  assert.ok(result.rates.get(building.id) > 0);
  result = constructionWork([building], [], { ...player, canWork: true });
  assert.equal(result.playerSite.id, building.id);
  assert.equal(result.rates.get(building.id), 1);
  result = constructionWork([building], [], {
    ...player,
    viewYaw: Math.PI,
    canWork: true,
  });
  assert.equal(result.rates.get(building.id), 0);
  assert.equal(
    constructionWork([{ ...building, complete: true }], [away], player)
      .assignments.size,
    0,
  );
});

test('workers never contribute to two sites; aptitude and headcount improve speed with a floor on duration', () => {
  const first = site('hideout', 0, { complete: false, progress: 0 });
  const second = { ...first, id: 20, x: first.x + 500 };
  const front = constructionPoint(first, 2);
  const result = constructionWork(
    [first, second],
    [{ ...front, id: 2, power: 4 }],
    { ...front, canWork: false, viewYaw: 0 },
  );
  assert.equal(result.assignments.size, 1);
  assert.equal(result.rates.get(second.id), 0);
  assert.ok(constructionRate(false, [4, 4]) > constructionRate(false, [4]));
  assert.ok(constructionRate(false, [8]) > constructionRate(false, [4]));
  close(constructionRate(true, Array(100).fill(100)), 1 / 0.34);
  assert.equal(constructionRate(false, [NaN, -2, Infinity]), 0);
});

test('a worker approaches around the outside and ends at the front work point', () => {
  const building = site('hideout', 0.5, { complete: false, progress: 0 });
  let worker = { id: 2, ...localToWorld(building, 0, 4) };
  for (let i = 0; i < 1500; i++) {
    const next = constructionApproach(building, worker);
    const distance = Math.hypot(next.x - worker.x, next.y - worker.y) || 1;
    const move = Math.min(distance, 2);
    const result = moveAroundBuildings(
      worker,
      {
        x: worker.x + ((next.x - worker.x) / distance) * move,
        y: worker.y + ((next.y - worker.y) / distance) * move,
      },
      [building],
    );
    worker = { id: 2, ...result };
    assert.equal(blockedByBuildings(worker, [building]), false);
  }
  const target = constructionPoint(building, worker.id);
  assert.ok(Math.hypot(target.x - worker.x, target.y - worker.y) < 1);
});

test('attacks pass through doors but not constructed or settlement walls', () => {
  const building = site();
  assert.equal(
    clearBuildingSight(
      localToWorld(building, 0, 0),
      localToWorld(building, 3, 0),
      [building],
    ),
    false,
  );
  assert.equal(
    clearBuildingSight(
      localToWorld(building, 0, 0),
      localToWorld(building, 0, -3),
      [building],
    ),
    true,
  );
  const camp = DISCOVERY_SITES.find((s) => s.kind === 'camp'),
    wall = wallsFor(camp)[0];
  assert.equal(
    clearBuildingSight(
      { x: wall.x - wall.width / 2 - 20, y: wall.y },
      { x: wall.x + wall.width / 2 + 20, y: wall.y },
      [],
    ),
    false,
  );
});
