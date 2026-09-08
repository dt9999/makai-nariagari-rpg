import test from 'node:test';
import assert from 'node:assert/strict';
import { damageBearing, nearestRecruit } from '../app/combat-cues.ts';

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
