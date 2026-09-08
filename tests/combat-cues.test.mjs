import test from 'node:test';
import assert from 'node:assert/strict';
import {
  damageBearing,
  nearestRecruit,
  retreatHostilesAfterDefeat,
} from '../app/combat-cues.ts';

test('recruit hints and actions select the same nearest eligible corpse within their exact range', () => {
  const player = { x: 0, y: 0 };
  const corpse = { x: 100, y: 0, dead: true, recruitTime: 7 };
  const excluded = [
    { ...corpse, x: 1, ally: true },
    { ...corpse, x: 2, boss: true },
    { ...corpse, x: 3, recruitTime: 0 },
    { ...corpse, x: 4, dead: false },
  ];
  assert.equal(nearestRecruit(player, [...excluded, corpse]), corpse);
  corpse.x = 120;
  assert.equal(nearestRecruit(player, [corpse]), undefined);
  assert.equal(nearestRecruit(player, [corpse], 360), corpse);
  corpse.recruitTime = 0;
  assert.equal(nearestRecruit(player, [corpse], 360), undefined);
});
import { constructionPoint, blockedByBuildings } from '../app/structures.ts';
import { positionBlocked } from '../app/world.ts';

test('the starting refuge returns the player outside its walls and settlement obstacles', () => {
  const site = {
    id: 1,
    x: 760,
    y: 1040,
    yaw: 0,
    kind: 'hideout',
    complete: true,
    progress: 1,
  };
  const point = constructionPoint(site, 2);
  assert.equal(blockedByBuildings(point, [site]), false);
  assert.equal(positionBlocked(point.x, point.y), false);
  assert.ok(point.y < site.y);
});

test('damage directions use the current camera orientation, including wrapped angles', () => {
  const player = { x: 10, y: 20, viewYaw: 0 };
  const source = (x, y) => ({ x, y, name: '敵', remaining: 1.8 });
  assert.equal(damageBearing(player, source(10, 30)).direction, '正面');
  assert.equal(damageBearing(player, source(20, 20)).direction, '右側');
  assert.equal(damageBearing(player, source(0, 20)).direction, '左側');
  assert.equal(damageBearing(player, source(10, 0)).direction, '背後');
  for (const rotation of [
    Math.PI / 2,
    Math.PI / 2 + Math.PI * 20,
    Math.PI / 2 - Math.PI * 20,
  ]) {
    player.viewYaw = rotation;
    assert.equal(damageBearing(player, source(20, 20)).direction, '正面');
    assert.equal(damageBearing(player, source(10, 30)).direction, '左側');
  }
});

test('defeat sends only the active hostile encounter home and resets boss progress', () => {
  const nearby = {
      x: 40,
      y: 50,
      anchorX: 400,
      anchorY: 500,
      hp: 17,
      max: 40,
      attackAnim: 0.4,
      attackCd: 0,
      attackHit: true,
      attackTarget: 3,
      hitAnim: 0.2,
    },
    boss = { ...nearby, x: 80, boss: true, hp: 5, max: 120 },
    ally = { ...nearby, x: 20, ally: true },
    corpse = { ...nearby, x: 30, dead: true },
    distant = { ...nearby, x: 1200, y: 1200 };
  assert.equal(
    retreatHostilesAfterDefeat(
      [nearby, boss, ally, corpse, distant],
      { x: 0, y: 0 },
      900,
    ),
    2,
  );
  for (const hostile of [nearby, boss]) {
    assert.deepEqual([hostile.x, hostile.y], [400, 500]);
    assert.equal(hostile.attackAnim, 0);
    assert.equal(hostile.attackCd, 1.5);
    assert.equal(hostile.attackHit, false);
    assert.equal(hostile.attackTarget, undefined);
    assert.equal(hostile.hitAnim, 0);
  }
  assert.equal(nearby.hp, 17);
  assert.equal(boss.hp, boss.max);
  assert.equal(ally.x, 20);
  assert.equal(corpse.x, 30);
  assert.equal(distant.x, 1200);
});
