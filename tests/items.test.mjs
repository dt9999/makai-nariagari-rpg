import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEMS,
  itemOf,
  emptyEquipment,
  addInventory,
  removeInventory,
  receiveItem,
  inventoryView,
  equipItem,
  consumeItem,
  discardItem,
  exchangeItem,
  equipmentBonus,
  weaponFor,
  lootFor,
} from '../app/items.ts';
const owner = () => ({
  inventory: [],
  equipment: emptyEquipment(),
  job: 'blade',
  rank: 0,
  hp: 80,
  maxHp: 100,
  energy: 20,
  maxEnergy: 100,
  wood: 6,
  ore: 6,
});

test('catalog has all six kinds, unique IDs, valid ranks and numeric effects', () => {
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
  assert.equal(new Set(ITEMS.map((i) => i.kind)).size, 6);
  for (const item of ITEMS) {
    assert.ok(item.name && item.description);
    assert.ok(item.rank >= 0 && item.rank <= 7);
    assert.ok(item.value > 0);
    for (const value of Object.values(item.bonus))
      assert.ok(Number.isFinite(value) && value >= 0);
  }
});
test('all actual careers have a compatible F weapon', () => {
  for (const job of [
    'blade',
    'berserker',
    'mage',
    'shadow',
    'lancer',
    'ruler',
    'warlock',
    'nightseer',
    'dragoon',
  ]) {
    const item = itemOf(weaponFor(job, 0));
    assert.ok(item.jobs.includes(job));
    assert.equal(item.rank, 0);
  }
});
test('stack accounting refuses zero, fractional, negative and non-finite counts', () => {
  const bag = [];
  for (const count of [0, -1, 0.5, NaN, Infinity])
    addInventory(bag, 'potion', count);
  assert.equal(bag.length, 0);
  addInventory(bag, 'potion', 2);
  addInventory(bag, 'potion');
  for (const count of [0, -1, 0.5, NaN, Infinity, 4])
    assert.equal(removeInventory(bag, 'potion', count), false);
  assert.equal(bag[0].count, 3);
  assert.ok(removeInventory(bag, 'potion', 3));
  assert.equal(bag.length, 0);
});
test('wood and ore have exactly one source of truth shared with construction', () => {
  const w = owner();
  receiveItem(w, 'wood', 3);
  receiveItem(w, 'ore', 2);
  assert.equal(w.inventory.length, 0);
  w.wood -= 4;
  assert.equal(inventoryView(w).find((s) => s.id === 'wood').count, 5);
  discardItem(w, 'ore');
  assert.equal(w.ore, 7);
});
test('equip enforces ownership, rank and profession without consuming equipment', () => {
  const w = owner();
  equipItem(w, 'sword-0');
  assert.equal(w.equipment.weapon, null);
  receiveItem(w, 'sword-2');
  equipItem(w, 'sword-2');
  assert.equal(w.equipment.weapon, null);
  receiveItem(w, 'staff-0');
  equipItem(w, 'staff-0');
  assert.equal(w.equipment.weapon, null);
  receiveItem(w, 'sword-0');
  equipItem(w, 'sword-0');
  assert.equal(w.equipment.weapon, 'sword-0');
  assert.equal(w.inventory.find((s) => s.id === 'sword-0').count, 1);
  assert.equal(equipmentBonus(w.equipment, w.job).attack, 3);
});
test('equipment slots are independent, life recalculation cannot heal by toggling', () => {
  const w = owner();
  receiveItem(w, 'armor-0');
  receiveItem(w, 'ember-gem');
  receiveItem(w, 'crown-relic');
  equipItem(w, 'armor-0');
  assert.equal(w.maxHp, 108);
  assert.equal(w.hp, 80);
  equipItem(w, 'ember-gem');
  equipItem(w, 'crown-relic');
  assert.deepEqual(equipmentBonus(w.equipment, w.job), {
    attack: 6,
    magic: 5,
    defense: 1,
    life: 8,
    leadership: 3,
  });
  equipItem(w, 'armor-0');
  assert.equal(w.maxHp, 100);
  assert.equal(w.hp, 80);
  equipItem(w, 'armor-0');
  assert.equal(w.hp, 80);
  w.hp = 108;
  equipItem(w, 'armor-0');
  assert.equal(w.hp, 100);
});
test('cannot discard last equipped copy; extra copies can be discarded', () => {
  const w = owner();
  receiveItem(w, 'sword-0');
  equipItem(w, 'sword-0');
  discardItem(w, 'sword-0');
  assert.equal(w.inventory[0].count, 1);
  receiveItem(w, 'sword-0');
  discardItem(w, 'sword-0');
  assert.equal(w.inventory[0].count, 1);
  equipItem(w, 'sword-0');
  discardItem(w, 'sword-0');
  assert.equal(w.inventory.length, 0);
});
test('consumables clamp healing, respect inventory, and do not consume at full', () => {
  const w = owner();
  consumeItem(w, 'potion');
  assert.equal(w.hp, 80);
  receiveItem(w, 'potion', 2);
  consumeItem(w, 'potion');
  assert.equal(w.hp, 100);
  assert.equal(w.inventory[0].count, 1);
  consumeItem(w, 'potion');
  assert.equal(w.inventory[0].count, 1);
  receiveItem(w, 'elixir');
  consumeItem(w, 'elixir');
  assert.equal(w.energy, 90);
  consumeItem(w, 'elixir');
  assert.equal(w.energy, 90);
});
test('material exchange is atomic and only accepts designated trade resources', () => {
  const w = owner();
  exchangeItem(w, 'hide');
  assert.equal(w.wood, 6);
  receiveItem(w, 'hide');
  exchangeItem(w, 'hide');
  assert.equal(w.wood, 9);
  assert.equal(w.ore, 9);
  assert.equal(w.inventory.length, 0);
  receiveItem(w, 'sword-0');
  exchangeItem(w, 'sword-0');
  assert.equal(w.inventory[0].count, 1);
});
test('drop tables return valid items across every enemy tier and boss reward', () => {
  for (let tier = 0; tier <= 9; tier++)
    for (let seed = 0; seed < 100; seed++)
      assert.ok(itemOf(lootFor(tier, seed, 'mage')));
  assert.equal(itemOf(lootFor(2, 1, 'mage', true)).kind, 'relic');
  assert.equal(lootFor(7, 1, 'blade', true), 'abyss-relic');
});
