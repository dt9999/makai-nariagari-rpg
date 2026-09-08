import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  REGIONS,
  DISCOVERY_SITES,
  encounterPackRadius,
  positionBlocked,
  regionAt,
  terrainHeight,
  sitesIn,
} from '../app/world.ts';

test('the original ten territories cover a connected world at least three times the baseline area', () => {
  assert.ok(WORLD_WIDTH * WORLD_HEIGHT >= 16000 * 9000 * 3);
  assert.equal(REGIONS.length, 10);
  assert.equal(
    REGIONS.reduce((a, r) => a + r.w * r.h, 0),
    WORLD_WIDTH * WORLD_HEIGHT,
  );
  assert.equal(new Set(REGIONS.map((r) => r.id)).size, 10);
  for (let x = 0; x < WORLD_WIDTH; x += 250)
    for (let y = 0; y < WORLD_HEIGHT; y += 250) {
      const matches = REGIONS.filter(
        (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h,
      );
      assert.equal(matches.length, 1, `gap or overlap at ${x},${y}`);
      assert.equal(regionAt(x, y).id, matches[0].id);
    }
});
test('every territory has eight named reachable destinations and three sub-biomes', () => {
  assert.equal(new Set(DISCOVERY_SITES.map((s) => s.id)).size, 80);
  for (const r of REGIONS) {
    const sites = sitesIn(r.id);
    assert.equal(sites.length, 8);
    assert.equal(new Set(sites.map((s) => s.kind)).size, 8);
    assert.equal(r.subBiomes.length, 3);
    for (const site of sites) assert.equal(regionAt(site.x, site.y).id, r.id);
  }
});
test('terrain meets across region seams without vertical cliffs caused by mismatched height functions', () => {
  for (let x = 6400; x < WORLD_WIDTH; x += 6400)
    for (let y = 50; y < WORLD_HEIGHT; y += 251)
      assert.ok(
        Math.abs(terrainHeight(x - 0.01, y) - terrainHeight(x + 0.01, y)) <
          0.01,
      );
  for (let x = 50; x < WORLD_WIDTH; x += 251)
    assert.ok(
      Math.abs(terrainHeight(x, 8999.99) - terrainHeight(x, 9000.01)) < 0.01,
    );
});
test('destinations have flat foundations for walk-in structures', () => {
  for (const site of DISCOVERY_SITES) {
    const h = terrainHeight(site.x, site.y);
    for (const [dx, dy] of [
      [60, 0],
      [-60, 0],
      [0, 60],
      [0, -60],
    ])
      assert.ok(Math.abs(terrainHeight(site.x + dx, site.y + dy) - h) < 0.0001);
  }
});
test('camp encounters guard the perimeter instead of spawning inside settlement buildings', () => {
  for (const site of DISCOVERY_SITES.filter(
    (candidate) => candidate.kind === 'camp',
  )) {
    for (let member = 0; member < 4; member++) {
      const angle = member * 2.35;
      const radius = encounterPackRadius(site.kind, member);
      const x = site.x + Math.cos(angle) * radius;
      const y = site.y + Math.sin(angle) * radius;
      assert.equal(regionAt(x, y).id, site.region);
      assert.equal(positionBlocked(x, y, 28), false);
      assert.ok(Math.hypot(x - site.x, y - site.y) > 600);
    }
  }
});
