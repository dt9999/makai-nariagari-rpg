import test from 'node:test';
import assert from 'node:assert/strict';
import { NearbyIndex, PatrolClock } from '../app/simulation.ts';

test('spatial nearest agrees with a full stable search across cell boundaries and ties', () => {
  const items = Array.from({ length: 1000 }, (_, id) => ({
    id,
    x: ((id * 197) % 32000) - 1000,
    y: ((id * 431) % 18000) - 1000,
    dead: id % 7 === 0,
  }));
  items.push(
    { id: 1000, x: -1, y: 0, dead: false },
    { id: 1001, x: 1, y: 0, dead: false },
  );
  const index = new NearbyIndex();
  const alive = (m) => !m.dead;
  index.rebuild(items, alive);
  for (let i = 0; i < 500; i++) {
    const point = {
      x: i ? (i * 811) % 32000 : 0,
      y: i ? (i * 123) % 18000 : 0,
    };
    const radius = 190 + (i % 200);
    const distance = (m) => Math.hypot(m.x - point.x, m.y - point.y);
    const expected = items
      .filter((m) => alive(m) && distance(m) <= radius)
      .sort((a, b) => distance(a) - distance(b))[0];
    assert.equal(index.nearest(point, radius, alive), expected);
  }
});

test('moving an indexed enemy crosses buckets immediately; dead and removed targets are excluded', () => {
  const enemy = { x: 500, y: 0, dead: false },
    other = { x: 2500, y: 0, dead: false };
  const index = new NearbyIndex();
  const alive = (m) => !m.dead;
  index.rebuild([enemy, other], alive);
  enemy.x = 520;
  index.moved(enemy);
  assert.equal(index.nearest({ x: 700, y: 0 }, 190, alive), enemy);
  enemy.dead = true;
  assert.equal(index.nearest({ x: 700, y: 0 }, 190, alive), undefined);
  index.rebuild([], alive);
  assert.equal(index.nearest(other, 5000, alive), undefined);
  index.rebuild([other], alive);
  assert.equal(index.nearest(other, 1, alive), other);
});

test('a local query inspects local candidates instead of sorting the whole army', () => {
  const items = Array.from({ length: 3200 }, (_, id) => ({
    id,
    x: (id % 80) * 400,
    y: Math.floor(id / 80) * 400,
  }));
  const index = new NearbyIndex();
  index.rebuild(items, () => true);
  let candidates = 0;
  const found = index.nearest({ x: 16000, y: 8000 }, 360, () => {
    candidates++;
    return true;
  });
  assert.equal(found.x, 16000);
  assert.ok(candidates < 30, `inspected ${candidates} candidates`);
});

test('distant idle patrols update at coarse staggered intervals without gaining elapsed time', () => {
  const clock = new PatrolClock(),
    player = { x: 0, y: 0 };
  const actors = Array.from({ length: 320 }, (_, id) => ({
    id,
    x: 5000,
    y: 5000,
  }));
  const totals = actors.map(() => 0),
    updates = actors.map(() => 0);
  for (let frame = 0; frame < 60; frame++) {
    actors.forEach((actor, i) => {
      const elapsed = clock.step(actor, player, 1 / 60);
      assert.ok(elapsed <= 0.29);
      totals[i] += elapsed;
      if (elapsed) updates[i]++;
    });
  }
  assert.ok(totals.every((n) => n > 0.7 && n <= 1.00001));
  assert.ok(updates.every((n) => n >= 3 && n <= 5));
});

test('approaching players, active attacks, damage and every allied job always receive full-rate updates', () => {
  const clock = new PatrolClock(),
    player = { x: 0, y: 0 };
  const enemy = { id: 0, x: 5000, y: 0 };
  assert.equal(clock.step(enemy, player, 0.04), 0);
  enemy.x = 2400;
  assert.equal(clock.step(enemy, player, 0.016), 0.016);
  for (const state of [{ ally: true }, { hitAnim: 0.3 }, { attackAnim: 0.7 }]) {
    const actor = { id: 0, x: 6000, y: 6000, ...state };
    for (let i = 0; i < 10; i++)
      assert.equal(clock.step(actor, player, 0.016), 0.016);
  }
});
