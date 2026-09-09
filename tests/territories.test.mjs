import test from 'node:test';
import assert from 'node:assert/strict';
import { headquartersOf, REGIONS } from '../app/world.ts';
import {
  initialHoldings,
  territoryOwner,
  conquerTerritory,
  territoryBossId,
  territorySiegeStatus,
} from '../app/territories.ts';

test('the weakest demon owns no territory; every region including ruins can be challenged', () => {
  const state = initialHoldings();
  assert.equal(state.lands, 0);
  assert.deepEqual(state.conquered, []);
  assert.equal(REGIONS.length, 10);
  for (const region of REGIONS)
    assert.equal(territoryOwner(state, region), 'enemy');
});

test('conquest grants the defeated lords territory exactly once and never claims neighbouring lands', () => {
  const state = initialHoldings();
  for (let i = 0; i < REGIONS.length; i++) {
    const region = REGIONS[i];
    assert.equal(conquerTerritory(state, region.id), true);
    assert.equal(state.lands, i + 1);
    assert.equal(territoryOwner(state, region), 'own');
    assert.equal(conquerTerritory(state, region.id), false);
    assert.equal(state.lands, i + 1);
    if (REGIONS[i + 1])
      assert.equal(territoryOwner(state, REGIONS[i + 1]), 'enemy');
  }
  assert.equal(conquerTerritory(state, 'unknown'), false);
  assert.equal(state.lands, 10);
});

test('simultaneously active lords have stable distinct IDs unrelated to defeat order', () => {
  const ids = REGIONS.map((region) => territoryBossId(region.id));
  assert.equal(new Set(ids).size, 10);
  assert.ok(ids.every((id) => id >= 10000));
  assert.deepEqual(
    [...REGIONS]
      .reverse()
      .map((region) => territoryBossId(region.id))
      .reverse(),
    ids,
  );
  assert.throws(() => territoryBossId('unknown'));
});

test('a fresh expedition never shares conquered state with another expedition', () => {
  const first = initialHoldings(),
    second = initialHoldings();
  conquerTerritory(first, REGIONS[0].id);
  assert.deepEqual(second, { lands: 0, conquered: [] });
});

test('territory battle guidance and the actual gate agree on distance, level and ownership', () => {
  const region = REGIONS[0];
  const far = territorySiegeStatus(
    { x: region.x, y: region.y, lv: 99, conquered: [] },
    region,
  );
  assert.equal(far.canStart, false);
  assert.match(far.label, /本拠地まで/);
  const headquarters = headquartersOf(region);
  const underLevel = territorySiegeStatus(
    { ...headquarters, lv: 1, conquered: [] },
    region,
  );
  assert.equal(underLevel.canStart, false);
  assert.match(underLevel.label, /推奨Lv\.2/);
  assert.equal(
    territorySiegeStatus({ ...headquarters, lv: 2, conquered: [] }, region)
      .canStart,
    true,
  );
  assert.equal(
    territorySiegeStatus(
      { ...headquarters, lv: 99, conquered: [region.id] },
      region,
    ).label,
    '征服済み',
  );
  assert.equal(
    territorySiegeStatus(
      { ...headquarters, lv: 99, conquered: [] },
      region,
      true,
    ).label,
    '領土ボスと交戦中',
  );
});
