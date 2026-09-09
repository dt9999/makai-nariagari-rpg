import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeGameSave, encodeGameSave } from '../app/save-game.ts';

const defaults = () => ({
  job: '',
  x: 10,
  y: 20,
  hp: 100,
  maxHp: 100,
  energy: 100,
  maxEnergy: 100,
  lv: 1,
  rank: 0,
  guarding: false,
  autoRun: false,
  buildMode: false,
  attackAnim: 0,
  attackKind: 'none',
  dodgeTime: 0,
  pendingHits: [],
  preferences: { quality: 'medium' },
  tutorial: { completed: [] },
  stats: { life: 1 },
  equipment: { weapon: null },
  careers: {},
  inventory: [],
  loot: [],
  unlocked: [],
  mobs: [],
  nodes: [],
  bases: [],
  roster: [],
  discovered: ['ruins'],
  discoveredSites: [],
  talkedSites: [],
  activatedSites: [],
  rumoredSites: [],
  conquered: [],
});

test('round-trips progress and clears transient combat state', () => {
  const world = {
    ...defaults(),
    job: 'blade',
    lv: 12,
    rank: 3,
    x: 321,
    y: 654,
    guarding: true,
    autoRun: true,
    buildMode: true,
    attackAnim: 0.4,
    attackKind: 'heavy',
    dodgeTime: 0.2,
    pendingHits: [{ damage: 9 }],
    inventory: [{ id: 'potion', count: 4 }],
    conquered: ['ruins'],
  };
  const restored = decodeGameSave(encodeGameSave(world, 123), defaults());
  assert.equal(restored.job, 'blade');
  assert.equal(restored.lv, 12);
  assert.deepEqual(restored.inventory, [{ id: 'potion', count: 4 }]);
  assert.deepEqual(restored.conquered, ['ruins']);
  assert.equal(restored.guarding, false);
  assert.equal(restored.autoRun, false);
  assert.equal(restored.attackKind, 'none');
  assert.deepEqual(restored.pendingHits, []);
});

test('merges new defaults and rejects malformed saves', () => {
  const old = JSON.stringify({
    version: 1,
    world: {
      job: 'mage',
      x: 1,
      y: 2,
      hp: 999,
      maxHp: 120,
      energy: -4,
      maxEnergy: 80,
      lv: 140,
      rank: 22,
      tutorial: { completed: ['look'] },
    },
  });
  const restored = decodeGameSave(old, defaults());
  assert.equal(restored.preferences.quality, 'medium');
  assert.deepEqual(restored.tutorial.completed, ['look']);
  assert.equal(restored.hp, 120);
  assert.equal(restored.energy, 0);
  assert.equal(restored.lv, 99);
  assert.equal(restored.rank, 7);
  assert.equal(decodeGameSave('{broken', defaults()), null);
  assert.equal(
    decodeGameSave(JSON.stringify({ version: 2, world: {} }), defaults()),
    null,
  );
});
