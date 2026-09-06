import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REGIONS,
  DISCOVERY_SITES,
  sitesIn,
  regionAt,
  SCALE,
  headquartersOf,
  CAMP_ROOMS,
  wallsFor,
  positionBlocked,
  moveOnGround,
  terrainHeight,
  HAZARDS,
  hazardAt,
  hazardPhase,
  hazardDamage,
  campResidentAt,
  nearbyInteraction,
  recordSiteVisit,
} from '../app/world.ts';
test('every region has a camp, resource and outpost route before headquarters', () => {
  for (const r of REGIONS) {
    const sites = sitesIn(r.id),
      camp = sites.find((s) => s.kind === 'camp'),
      quarry = sites.find((s) => s.kind === 'quarry'),
      outpost = sites.find((s) => s.kind === 'outpost'),
      hq = headquartersOf(r);
    for (const p of [camp, quarry, outpost, hq])
      assert.equal(regionAt(p.x, p.y).id, r.id);
    assert.ok(Math.hypot(hq.x - camp.x, hq.y - camp.y) > 2000);
    assert.ok(Math.hypot(hq.x - outpost.x, hq.y - outpost.y) < 1500);
  }
});
test('ten camps have accessible doorways and solid side and rear walls', () => {
  for (const s of DISCOVERY_SITES.filter((s) => s.kind === 'camp')) {
    assert.equal(wallsFor(s).length, 10);
    for (const [x, z] of CAMP_ROOMS) {
      const center = { x: s.x + x / SCALE, y: s.y + z / SCALE },
        entry = { x: center.x, y: center.y - 3 / SCALE },
        inside = moveOnGround(entry, center);
      assert.ok(Math.hypot(inside.x - center.x, inside.y - center.y) < 1);
      assert.ok(positionBlocked(center.x + 2 / SCALE, center.y));
      const throughBack = moveOnGround(center, {
        x: center.x,
        y: center.y + 4 / SCALE,
      });
      assert.ok(throughBack.y < center.y + 2 / SCALE);
      const throughSide = moveOnGround(center, {
        x: center.x + 4 / SCALE,
        y: center.y,
      });
      assert.ok(throughSide.x < center.x + 2 / SCALE);
      assert.ok(!positionBlocked(throughSide.x, throughSide.y));
    }
  }
});
test('cave floors stay level throughout the tunnel and entries stay open', () => {
  for (const s of DISCOVERY_SITES.filter((s) => s.kind === 'cave')) {
    for (let z = -1; z <= 15; z += 0.5) {
      assert.ok(!positionBlocked(s.x, s.y + z / SCALE));
      assert.ok(
        Math.abs(
          terrainHeight(s.x, s.y + z / SCALE) - terrainHeight(s.x, s.y),
        ) < 1e-6,
      );
    }
    assert.ok(positionBlocked(s.x + 3 / SCALE, s.y + 7 / SCALE));
  }
});
test('40 hazard circles stay within regions and leave settlements and outposts safe', () => {
  assert.equal(HAZARDS.length, 40);
  for (const r of REGIONS)
    assert.equal(HAZARDS.filter((h) => h.region === r.id).length, 4);
  for (const h of HAZARDS) {
    assert.equal(regionAt(h.x, h.y).id, h.region);
    assert.equal(hazardAt(h.x, h.y).id, h.id);
  }
  for (const s of DISCOVERY_SITES.filter(
    (s) => s.kind === 'camp' || s.kind === 'outpost',
  ))
    assert.equal(hazardAt(s.x, s.y), undefined);
});
test('hazard damage agrees with telegraph, distance and jump clearance', () => {
  for (const h of HAZARDS) {
    const t = 7 - h.phase;
    assert.equal(hazardPhase(h, t), 'quiet');
    assert.equal(hazardPhase(h, t + 4), 'warning');
    assert.equal(hazardPhase(h, t + 6), 'active');
    assert.equal(hazardDamage(h.x, h.y, 0, t + 4, 1), 0);
    assert.equal(hazardDamage(h.x, h.y, 0, t + 6, 0.5), h.damage * 0.5);
    assert.equal(hazardDamage(h.x, h.y, 0.7, t + 6, 0.5), 0);
    assert.equal(hazardDamage(h.x + h.radius + 2, h.y, 0, t + 6, 0.5), 0);
  }
});
test('interaction selects nearest available target, not claimed or depleted targets', () => {
  const at = { x: 2200, y: 2200 },
    loot = [
      { id: 1, x: 2220, y: 2200, claimed: false, chest: true, item: 'potion' },
    ],
    nodes = [{ id: 2, x: 2250, y: 2200, n: 1, kind: 'ore' }];
  assert.equal(nearbyInteraction(at, loot, nodes).kind, 'loot');
  loot[0].claimed = true;
  assert.equal(nearbyInteraction(at, loot, nodes).kind, 'node');
  nodes[0].n = 0;
  assert.equal(nearbyInteraction(at, loot, nodes), undefined);
  const camp = sitesIn('ruins').find((s) => s.kind === 'camp');
  assert.equal(nearbyInteraction(campResidentAt(camp), [], []).kind, 'camp');
});
test('camp, shrine and vista first-visit records cannot be duplicated', () => {
  const records = [];
  for (const s of DISCOVERY_SITES.filter((s) =>
    ['camp', 'shrine', 'vista'].includes(s.kind),
  )) {
    assert.ok(recordSiteVisit(records, s.id));
    assert.equal(recordSiteVisit(records, s.id), false);
  }
  assert.equal(records.length, 30);
  assert.equal(recordSiteVisit(records, 'fake'), false);
  assert.equal(recordSiteVisit(records, 'ruins-quarry'), false);
});
