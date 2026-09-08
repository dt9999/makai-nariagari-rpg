import test from 'node:test';
import assert from 'node:assert/strict';
import {
  damageBearing,
  nearestRecruit,
  retreatHostilesAfterDefeat,
  selectAimCue,
} from '../app/combat-cues.ts';

test('aim guidance selects a visible crosshair target in one pass', () => {
  const player = { x: 0, y: 0, facingX: 0, facingY: 1 };
  const blocked = { id: 1, x: 0, y: 40 };
  const ready = { id: 2, x: 8, y: 70 };
  const behind = { id: 3, x: 0, y: -10 };
  const cue = selectAimCue(
    player,
    [blocked, ready, behind],
    100,
    0.42,
    (mob) => mob !== blocked,
  );
  assert.equal(cue.direct, ready);
  assert.equal(cue.tracked, ready);
  assert.equal(cue.clear, true);
});

test('aim guidance explains the best forward threat when blocked', () => {
  const player = { x: 0, y: 0, facingX: 0, facingY: 1 };
  const blocked = { id: 1, x: 0, y: 80 };
  const distant = { id: 2, x: 10, y: 200 };
  const cue = selectAimCue(
    player,
    [distant, blocked],
    60,
    0.42,
    (mob) => mob !== blocked,
  );
  assert.equal(cue.direct, undefined);
  assert.equal(cue.tracked, blocked);
  assert.equal(cue.clear, false);
  assert.equal(cue.distance, 80);
});

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
