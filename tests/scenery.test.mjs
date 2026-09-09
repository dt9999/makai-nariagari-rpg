import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS } from '../app/world.ts';
import { SCENERY_BIOMES, sceneryProfile } from '../app/scenery.ts';
import { createSceneryGeometries } from '../app/scenery-geometry.ts';

test('all ten territory biomes use a distinct readable scenery family', () => {
  const families = REGIONS.map((region) => sceneryProfile(region.biome).family);
  assert.equal(REGIONS.length, 10);
  assert.equal(new Set(families).size, REGIONS.length);
  assert.deepEqual(
    new Set(SCENERY_BIOMES),
    new Set(REGIONS.map((r) => r.biome)),
  );
});

test('scenery profiles stay bounded for mobile instancing and retain accents', () => {
  for (const region of REGIONS) {
    const profile = sceneryProfile(region.biome);
    assert.ok(profile.count >= 12 && profile.count <= 36, region.name);
    assert.ok(
      profile.accentRatio >= 0.4 && profile.accentRatio <= 1,
      region.name,
    );
    assert.ok(profile.minHeight > 0 && profile.maxHeight > profile.minHeight);
    assert.notEqual(profile.primary, profile.accent, region.name);
  }
});

test('unknown biomes fail soft to the ruined-land profile', () => {
  assert.equal(sceneryProfile('unknown').family, 'broken-sanctum');
});

test('merged scenery silhouettes have finite renderable geometry', () => {
  const geometries = createSceneryGeometries();
  assert.equal(Object.keys(geometries).length, 16);
  for (const [shape, geometry] of Object.entries(geometries)) {
    const positions = geometry.getAttribute('position');
    assert.ok(positions.count >= 12, shape);
    assert.ok(
      Array.from(positions.array).every(Number.isFinite),
      `${shape} has invalid vertices`,
    );
    assert.ok(geometry.boundingBox, `${shape} has no bounds`);
    geometry.dispose();
  }
});
