import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, sitesIn } from '../app/world.ts';
import {
  sceneryBlocksTravel,
  territoryRoute,
} from '../app/travel-corridors.ts';

test('every map route has a continuous decoration-free corridor through its three legs', () => {
  for (const region of REGIONS) {
    const route = territoryRoute(region);
    assert.equal(route.length, 4);
    for (let i = 1; i < route.length; i++)
      for (let s = 0; s <= 100; s++) {
        const t = s / 100;
        const point = {
          x: route[i - 1].x + (route[i].x - route[i - 1].x) * t,
          y: route[i - 1].y + (route[i].y - route[i - 1].y) * t,
        };
        assert.equal(sceneryBlocksTravel(point), true);
      }
    const camp = sitesIn(region.id).find((site) => site.kind === 'camp');
    for (let i = 0; i < 24; i++)
      assert.equal(
        sceneryBlocksTravel({
          x: camp.x + 500 * Math.cos(i),
          y: camp.y + 500 * Math.sin(i),
        }),
        true,
      );
  }
});

test('clearing settlements and routes retains the majority of each regions wild landscape', () => {
  for (const region of REGIONS) {
    let retained = 0,
      total = 0;
    for (let x = 100; x < region.w; x += 200)
      for (let y = 100; y < region.h; y += 200) {
        total++;
        if (!sceneryBlocksTravel({ x: region.x + x, y: region.y + y }, 120))
          retained++;
      }
    assert.ok(retained / total > 0.6, `${region.id}: ${retained}/${total}`);
  }
});
