import {
  CAMP_CLEARING_RADIUS,
  REGIONS,
  sitesIn,
  headquartersOf,
  regionAt,
  type Region,
} from './world.ts';
type Point = { x: number; y: number };

export function territoryRoute(region: Region): Point[] {
  const sites = sitesIn(region.id);
  return ['camp', 'quarry', 'outpost']
    .map<Point>((kind) => sites.find((site) => site.kind === kind)!)
    .concat([headquartersOf(region)]);
}

const routes = new Map(
  REGIONS.map((region) => [region.id, territoryRoute(region)]),
);

function segmentDistance(point: Point, start: Point, end: Point) {
  const x = end.x - start.x,
    y = end.y - start.y;
  const length = x * x + y * y;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - start.x) * x + (point.y - start.y) * y) / length,
        ),
      )
    : 0;
  return Math.hypot(point.x - start.x - t * x, point.y - start.y - t * y);
}

/** Decorative props cannot fill the inhabited clearing or the route drawn on the map. */
export function sceneryBlocksTravel(point: Point, radius = 0) {
  const region = regionAt(point.x, point.y);
  for (const site of sitesIn(region.id)) {
    const clearing = site.kind === 'camp' ? CAMP_CLEARING_RADIUS : 260;
    if (Math.hypot(point.x - site.x, point.y - site.y) < clearing + radius)
      return true;
  }
  const route = routes.get(region.id)!;
  for (let i = 1; i < route.length; i++) {
    if (segmentDistance(point, route[i - 1], route[i]) < 100 + radius)
      return true;
  }
  return false;
}
