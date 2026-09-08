import test from 'node:test';
import assert from 'node:assert/strict';
import { recruitmentCohort, recruitmentChance } from '../app/recruitment.ts';

test('defeating a commander recruits subordinate captains and all their squads', () => {
  const commander = { id: 1, dead: true, recruitTime: 14 };
  const captains = [
    { id: 2, commanderId: 1 },
    { id: 3, commanderId: 1 },
  ];
  const troops = Array.from({ length: 10 }, (_, i) => ({
    id: i + 4,
    commanderId: i < 5 ? 2 : 3,
  }));
  const mobs = [commander, ...captains, ...troops, { id: 99 }];
  assert.deepEqual(
    recruitmentCohort(commander, mobs).map((m) => m.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  );
  assert.equal(
    commander.dead,
    true,
    'collecting candidates cannot mutate game state before the roll',
  );
});

test('existing allies and expired corpses are not re-enlisted; living descendants retain their command chain', () => {
  const commander = { id: 1, dead: true, recruitTime: 8 };
  const mobs = [
    commander,
    { id: 2, commanderId: 1, ally: true },
    { id: 3, commanderId: 1, dead: true, recruitTime: 0 },
    { id: 4, commanderId: 3 },
    { id: 5, commanderId: 1, dead: true, recruitTime: 2 },
    { id: 6, commanderId: 1, boss: true },
  ];
  assert.deepEqual(
    recruitmentCohort(commander, mobs).map((m) => m.id),
    [1, 5, 4],
  );
});

test('cycles and duplicate IDs cannot cause duplicate recruitment or infinite traversal', () => {
  const commander = { id: 1, commanderId: 3, dead: true, recruitTime: 8 };
  const mobs = [
    commander,
    { id: 2, commanderId: 1 },
    { id: 3, commanderId: 2 },
    { id: 2, commanderId: 1 },
  ];
  assert.deepEqual(
    recruitmentCohort(commander, mobs).map((m) => m.id),
    [1, 2, 3],
  );
});

test('bosses, living enemies, allies and expired targets cannot start a recruitment chain', () => {
  for (const target of [
    { id: 1, dead: true, recruitTime: 8, boss: true },
    { id: 1, dead: false, recruitTime: 8 },
    { id: 1, dead: true, recruitTime: 8, ally: true },
    { id: 1, dead: true, recruitTime: 0 },
  ]) {
    assert.deepEqual(
      recruitmentCohort(target, [target, { id: 2, commanderId: 1 }]),
      [],
    );
  }
});

test('greater player strength and leadership improve success; stronger opponents and bigger armies resist', () => {
  let previous = 0;
  for (let might = 0; might <= 500; might += 5) {
    const chance = recruitmentChance(might, 2, 3, 1);
    assert.ok(chance >= previous && chance >= 0.08 && chance <= 0.96);
    previous = chance;
  }
  assert.ok(recruitmentChance(100, 1, 0, 1) > recruitmentChance(100, 3, 0, 1));
  assert.ok(recruitmentChance(100, 2, 0, 1) > recruitmentChance(100, 2, 10, 1));
  assert.ok(recruitmentChance(100, 2, 3, 10) > recruitmentChance(100, 2, 3, 1));
});
