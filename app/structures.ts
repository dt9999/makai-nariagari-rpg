import {
  SCALE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  DISCOVERY_SITES,
  HAZARDS,
  terrainHeight,
  wallsFor,
  positionBlocked,
  type WorldPoint,
} from './world.ts';

export type StructureKind =
  | 'hideout'
  | 'storage'
  | 'barracks'
  | 'smithy'
  | 'laboratory'
  | 'watchtower'
  | 'wall'
  | 'gate'
  | 'fortress'
  | 'castle'
  | 'demon-castle';
export type StructureSite = WorldPoint & {
  id: number;
  kind: string;
  yaw: number;
  progress: number;
  duration: number;
  complete: boolean;
};
export type StructurePart = {
  shape: 'box' | 'cylinder' | 'cone';
  material: 'stone' | 'wood' | 'iron' | 'cloth' | 'glow' | 'fire';
  size: [number, number, number];
  at: [number, number, number];
  solid: boolean;
  tilt?: number;
};
export type StructurePlan = {
  parts: StructurePart[];
  width: number;
  depth: number;
  enterable: boolean;
};
const plans = new Map<string, StructurePlan>();

/** Metre-based architecture is authoritative for BOTH drawing and collision. */
export function structurePlan(kind: string): StructurePlan {
  const saved = plans.get(kind);
  if (saved) return saved;
  const parts: StructurePart[] = [];
  const put = (
    size: StructurePart['size'],
    at: StructurePart['at'],
    material: StructurePart['material'] = 'stone',
    solid = true,
    shape: StructurePart['shape'] = 'box',
    tilt?: number,
  ) => parts.push({ size, at, material, solid, shape, tilt });
  const tower = (x: number, z: number, h: number, diameter: number) => {
    put([diameter, h, diameter], [x, h / 2, z], 'stone', true, 'cylinder');
    put(
      [diameter + 0.3, 0.2, diameter + 0.3],
      [x, h, z],
      'stone',
      false,
      'cylinder',
    );
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      put(
        [0.3, 0.4, 0.3],
        [
          x + Math.cos(a) * diameter * 0.44,
          h + 0.25,
          z + Math.sin(a) * diameter * 0.44,
        ],
        'stone',
        false,
      );
    }
  };
  const roof = (hx: number, hz: number, y: number) => {
    const rise = hx * 0.5,
      slope = Math.atan2(rise, hx + 0.25),
      length = Math.hypot(hx + 0.25, rise);
    for (const side of [-1, 1])
      put(
        [length, 0.16, hz * 2 + 0.6],
        [(side * (hx + 0.25)) / 2, y + rise / 2, 0],
        'wood',
        false,
        'box',
        -side * slope,
      );
    put([0.22, 0.22, hz * 2 + 0.65], [0, y + rise, 0], 'wood', false);
  };
  const room = (
    hx: number,
    hz: number,
    height = 2.6,
    door = 0.7,
    material: StructurePart['material'] = 'stone',
    offsetZ = 0,
  ) => {
    put(
      [2 * hx + 0.3, 0.08, 2 * hz + 0.3],
      [0, -0.04, offsetZ],
      'stone',
      false,
    );
    for (const side of [-1, 1]) {
      put([0.22, height, hz * 2], [side * hx, height / 2, offsetZ]);
      put(
        [hx - door, height, 0.22],
        [(side * (hx + door)) / 2, height / 2, offsetZ - hz],
        material,
      );
    }
    put([hx * 2, height, 0.22], [0, height / 2, offsetZ + hz]);
    put([door * 2, 0.28, 0.24], [0, height - 0.14, offsetZ - hz], material);
    put(
      [hx * 2 + 0.25, 0.14, hz * 2 + 0.25],
      [0, height + 0.07, offsetZ],
      'wood',
      false,
    );
  };
  let enterable = true;
  switch (kind) {
    case 'wall':
      enterable = false;
      put([9.2, 3.6, 0.55], [0, 1.8, 0]);
      tower(-4.6, 0, 4.1, 1.24);
      tower(4.6, 0, 4.1, 1.24);
      for (let x = -4; x <= 4; x++)
        put([0.45, 0.45, 0.65], [x, 3.8, 0], 'stone', false);
      break;
    case 'gate':
      tower(-2.5, 0, 5, 1.8);
      tower(2.5, 0, 5, 1.8);
      put([3.2, 0.65, 0.9], [0, 4, 0]);
      // Raised portcullis leaves the full central passage physically open.
      for (const x of [-1.2, -0.6, 0, 0.6, 1.2])
        put([0.07, 1.5, 0.09], [x, 4.2, -0.48], 'iron', false);
      break;
    case 'fortress':
    case 'castle':
    case 'demon-castle': {
      const s = kind === 'demon-castle' ? 1.8 : kind === 'castle' ? 1.4 : 1;
      const hx = 5.5 * s,
        hz = 5 * s,
        h = 3 * s;
      for (const x of [-hx, hx])
        for (const z of [-hz, hz]) tower(x, z, 5 * s, 1.5 * s);
      for (const x of [-hx, hx]) put([0.4 * s, h, hz * 2], [x, h / 2, 0]);
      put([hx * 2, h, 0.4 * s], [0, h / 2, hz]);
      const door = 1.4 * s;
      for (const side of [-1, 1])
        put([hx - door, h, 0.4 * s], [(side * (hx + door)) / 2, h / 2, -hz]);
      put([door * 2, 0.6 * s, 0.5 * s], [0, h + 0.1, -hz]);
      room(2.4 * s, 2 * s, 3.3 * s, 0.85 * s, 'stone', 0.8 * s);
      for (const x of [-2.4 * s, 2.4 * s]) tower(x, 2.8 * s, 6.3 * s, 1.2 * s);
      put([1.2 * s, 1.8 * s, 0.06], [0, 4.3 * s, -1.25 * s], 'cloth', false);
      if (kind === 'demon-castle')
        for (const x of [-2.4 * s, 2.4 * s]) {
          put(
            [1.4, 3.2, 1.4],
            [x, 6.3 * s + 1.5, 2.8 * s],
            'iron',
            false,
            'cone',
          );
          put(
            [0.5, 0.9, 0.5],
            [x, 6.3 * s + 3.2, 2.8 * s],
            'glow',
            false,
            'cone',
          );
        }
      break;
    }
    default: {
      const hx = kind === 'barracks' ? 3 : kind === 'smithy' ? 2.3 : 1.85;
      const hz = kind === 'barracks' ? 2.1 : 1.7;
      room(hx, hz, 2.6, 0.75, kind === 'storage' ? 'wood' : 'stone');
      roof(hx, hz, 2.7);
      if (kind === 'watchtower') {
        for (const x of [-1.55, 1.55])
          for (const z of [-1.4, 1.4])
            put([0.22, 5.4, 0.22], [x, 2.7, z], 'wood');
        put([3.5, 0.25, 3.2], [0, 5.1, 0], 'wood', false);
        put([3.5, 0.3, 0.16], [0, 5.8, -1.6], 'wood', false);
      } else if (kind === 'smithy') {
        put([0.9, 0.7, 0.7], [1.2, 0.35, 0.8]);
        put([0.6, 0.22, 0.5], [1.2, 0.8, 0.8], 'fire', false);
        put([0.42, 3.5, 0.42], [1.2, 1.75, 1.1], 'iron');
        put([0.6, 0.75, 0.4], [-1, 0.375, 0.4], 'iron');
      } else if (kind === 'laboratory') {
        put([2.5, 0.15, 0.65], [0, 0.8, 0.9], 'wood', false);
        for (const x of [-0.8, 0, 0.8])
          put([0.25, 0.55, 0.25], [x, 1.1, 0.9], 'glow', false, 'cone');
      } else if (kind === 'storage') {
        for (const x of [-1.2, 0, 1.2])
          put([0.75, 0.8, 0.7], [x, 0.4, 1], 'wood');
      } else {
        for (const x of [-hx + 0.65, hx - 0.65]) {
          put([0.9, 0.35, 1.7], [x, 0.175, 0.4], 'wood', false);
          put([0.85, 0.12, 1.5], [x, 0.41, 0.4], 'cloth', false);
        }
      }
    }
  }
  const width = Math.max(
    ...parts.map((p) => Math.abs(p.at[0]) * 2 + p.size[0]),
  );
  const depth = Math.max(
    ...parts.map((p) => Math.abs(p.at[2]) * 2 + p.size[2]),
  );
  const plan = { parts, width, depth, enterable };
  plans.set(kind, plan);
  return plan;
}

export const buildingHeightScale = (s: StructureSite) =>
  s.complete
    ? 1
    : 0.12 +
      0.88 * Math.max(0, Math.min(1, s.progress / Math.max(1, s.duration)));
export function localToWorld(
  s: Pick<StructureSite, 'x' | 'y' | 'yaw'>,
  x: number,
  z: number,
): WorldPoint {
  return {
    x: s.x + (x * Math.cos(s.yaw) + z * Math.sin(s.yaw)) / SCALE,
    y: s.y + (-x * Math.sin(s.yaw) + z * Math.cos(s.yaw)) / SCALE,
  };
}
export function worldToLocal(
  s: Pick<StructureSite, 'x' | 'y' | 'yaw'>,
  p: WorldPoint,
): WorldPoint {
  const dx = (p.x - s.x) * SCALE,
    dz = (p.y - s.y) * SCALE;
  return {
    x: dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw),
    y: dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw),
  };
}
export function blockedByBuildings(
  p: WorldPoint,
  sites: StructureSite[],
  height = 0,
  radius = 16,
  bodyHeight = 1.65,
): boolean {
  for (const site of sites) {
    const plan = structurePlan(site.kind),
      local = worldToLocal(site, p),
      rad = radius * SCALE;
    if (
      Math.abs(local.x) > plan.width / 2 + rad ||
      Math.abs(local.y) > plan.depth / 2 + rad
    )
      continue;
    const scale = buildingHeightScale(site),
      altitude =
        height + terrainHeight(p.x, p.y) - terrainHeight(site.x, site.y);
    for (const part of plan.parts) {
      if (
        !part.solid ||
        part.tilt ||
        altitude >= (part.at[1] + part.size[1] / 2) * scale ||
        altitude + bodyHeight <= (part.at[1] - part.size[1] / 2) * scale
      )
        continue;
      const dx = Math.max(Math.abs(local.x - part.at[0]) - part.size[0] / 2, 0),
        dz = Math.max(Math.abs(local.y - part.at[2]) - part.size[2] / 2, 0);
      if (dx * dx + dz * dz <= rad * rad) return true;
    }
  }
  return false;
}
export function moveAroundBuildings(
  from: WorldPoint,
  to: WorldPoint,
  sites: StructureSite[],
  height = 0,
): WorldPoint {
  const result = { x: from.x, y: from.y },
    steps = Math.max(
      1,
      Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8),
    );
  for (let i = 0; i < steps; i++) {
    const x = Math.max(
      20,
      Math.min(WORLD_WIDTH - 20, result.x + (to.x - from.x) / steps),
    );
    if (
      !positionBlocked(x, result.y, 16, height) &&
      !blockedByBuildings({ x, y: result.y }, sites, height)
    )
      result.x = x;
    const y = Math.max(
      20,
      Math.min(WORLD_HEIGHT - 20, result.y + (to.y - from.y) / steps),
    );
    if (
      !positionBlocked(result.x, y, 16, height) &&
      !blockedByBuildings({ x: result.x, y }, sites, height)
    )
      result.y = y;
  }
  return result;
}
type Footprint = WorldPoint & { yaw: number; width: number; depth: number };
/** Check the attack segment again at impact, including static and new walls. */
export function clearBuildingSight(
  from: WorldPoint,
  to: WorldPoint,
  sites: StructureSite[],
  startHeight = 0.9,
  endHeight = 0.9,
) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8),
  );
  const start = terrainHeight(from.x, from.y) + startHeight,
    end = terrainHeight(to.x, to.y) + endHeight;
  for (let i = 1; i < steps; i++) {
    const ratio = i / steps,
      p = {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      };
    const altitude = start + (end - start) * ratio - terrainHeight(p.x, p.y);
    if (
      positionBlocked(p.x, p.y, 0.01, altitude) ||
      blockedByBuildings(p, sites, altitude, 0, 0.05)
    )
      return false;
  }
  return true;
}
function overlap(a: Footprint, b: Footprint, margin = 0.25) {
  const ca = Math.cos(a.yaw),
    sa = Math.sin(a.yaw),
    cb = Math.cos(b.yaw),
    sb = Math.sin(b.yaw);
  const axes = [
    [ca, -sa],
    [sa, ca],
    [cb, -sb],
    [sb, cb],
  ];
  return axes.every(([x, z]) => {
    const distance = Math.abs(
      (b.x - a.x) * SCALE * x + (b.y - a.y) * SCALE * z,
    );
    const ar =
      (a.width / 2) * Math.abs(x * ca - z * sa) +
      (a.depth / 2) * Math.abs(x * sa + z * ca);
    const br =
      (b.width / 2) * Math.abs(x * cb - z * sb) +
      (b.depth / 2) * Math.abs(x * sb + z * cb);
    return distance < ar + br + margin;
  });
}
export function plannedBuilding(
  player: WorldPoint & { viewYaw: number; selectedBuilding: string },
): StructureSite {
  const plan = structurePlan(player.selectedBuilding),
    distance = Math.max(320, (plan.depth / 2 + 2) / SCALE);
  return {
    id: -1,
    x: player.x + Math.sin(player.viewYaw) * distance,
    y: player.y + Math.cos(player.viewYaw) * distance,
    yaw: player.viewYaw,
    kind: player.selectedBuilding,
    progress: 0,
    duration: 1,
    complete: false,
  };
}
export function placementIssue(
  site: StructureSite,
  existing: StructureSite[],
  player?: WorldPoint,
  resources: WorldPoint[] = [],
): string | null {
  const plan = structurePlan(site.kind),
    footprint = { ...site, width: plan.width, depth: plan.depth };
  const corners = [-1, 1].flatMap((x) =>
    [-1, 1].map((z) =>
      localToWorld(site, (x * plan.width) / 2, (z * plan.depth) / 2),
    ),
  );
  if (
    corners.some(
      (p) =>
        p.x < 20 ||
        p.y < 20 ||
        p.x > WORLD_WIDTH - 20 ||
        p.y > WORLD_HEIGHT - 20,
    )
  )
    return '建物の一部が魔界の境界を越えています。';
  if (player) {
    const p = worldToLocal(site, player);
    if (
      Math.abs(p.x) < plan.width / 2 + 0.4 &&
      Math.abs(p.y) < plan.depth / 2 + 0.4
    )
      return '自分の立っている場所を避けて配置しよう。';
  }
  if (
    existing.some((s) => overlap(footprint, { ...s, ...structurePlan(s.kind) }))
  )
    return '別の建物・工事予定地と重なっています。';
  for (const s of DISCOVERY_SITES) {
    if (Math.hypot(site.x - s.x, site.y - s.y) > 1800) continue;
    if (
      wallsFor(s).some((w) =>
        overlap(footprint, {
          x: w.x,
          y: w.y,
          yaw: 0,
          width: w.width * SCALE,
          depth: w.depth * SCALE,
        }),
      )
    )
      return '集落や洞窟の壁に重なっています。';
  }
  if (
    HAZARDS.some((h) =>
      overlap(footprint, {
        ...h,
        yaw: 0,
        width: h.radius * SCALE * 2,
        depth: h.radius * SCALE * 2,
      }),
    )
  )
    return '危険地帯を避けて配置しよう。';
  if (resources.some((point) => sceneryInsideBuilding(point, [site], 0.4)))
    return '採集物に重なっています。先に採り切るか、場所をずらそう。';
  const heights = [
    terrainHeight(site.x, site.y),
    ...corners.map((p) => terrainHeight(p.x, p.y)),
  ];
  if (Math.max(...heights) - Math.min(...heights) > 0.55)
    return '傾斜が大きすぎます。もっと平らな場所を探そう。';
  return null;
}
export function constructionPoint(site: StructureSite, workerId = 0) {
  const plan = structurePlan(site.kind);
  return localToWorld(
    site,
    ((workerId % 5) - 2) * Math.min(0.6, plan.width / 8),
    -plan.depth / 2 - 0.75,
  );
}
/** Clear decorative growth, but never delete gameplay resources or landmarks. */
export function sceneryInsideBuilding(
  point: WorldPoint,
  sites: StructureSite[],
  margin = 2.5,
) {
  return sites.some((site) => {
    const plan = structurePlan(site.kind);
    if (
      Math.hypot(point.x - site.x, point.y - site.y) * SCALE >
      Math.hypot(plan.width, plan.depth) / 2 + margin * 2
    )
      return false;
    const local = worldToLocal(site, point);
    return (
      Math.abs(local.x) < plan.width / 2 + margin &&
      Math.abs(local.y) < plan.depth / 2 + margin
    );
  });
}

export function constructionRate(
  playerWorking: boolean,
  powers: number[],
): number {
  const power = powers.reduce(
    (sum, value) => sum + (Number.isFinite(value) ? Math.max(0, value) : 0),
    0,
  );
  if (!playerWorking && power === 0) return 0;
  return Math.min(
    1 / 0.34,
    (playerWorking ? 1 : 0.65) + Math.sqrt(power) * 0.34,
  );
}

/** Workers approach from outside the footprint, never through the rising walls. */
export function constructionApproach(
  site: StructureSite,
  worker: WorldPoint & { id: number },
): WorldPoint {
  const p = worldToLocal(site, worker),
    plan = structurePlan(site.kind);
  const front = -plan.depth / 2 - 0.95,
    side = plan.width / 2 + 0.95;
  if (p.y > front + 0.25) {
    const direction = p.x < 0 ? -1 : 1;
    if (Math.abs(p.x) < side - 0.2)
      return localToWorld(site, direction * side, p.y);
    return localToWorld(site, direction * side, front);
  }
  return constructionPoint(site, worker.id);
}

export type ConstructionWorker = WorldPoint & { id: number; power: number };
export type ConstructionPlayer = WorldPoint & {
  viewYaw: number;
  canWork: boolean;
};
/** One worker contributes to exactly one site, and only after arriving there. */
export function constructionWork(
  sites: StructureSite[],
  workers: ConstructionWorker[],
  player: ConstructionPlayer,
) {
  const active = sites.filter((site) => !site.complete);
  const assignments = new Map<number, StructureSite>();
  const present = new Map<number, ConstructionWorker[]>();
  for (const worker of workers) {
    const nearest = active.reduce<StructureSite | undefined>((best, site) => {
      const target = constructionPoint(site, worker.id);
      const prior = best && constructionPoint(best, worker.id);
      return !prior ||
        Math.hypot(target.x - worker.x, target.y - worker.y) <
          Math.hypot(prior.x - worker.x, prior.y - worker.y)
        ? site
        : best;
    }, undefined);
    if (!nearest) continue;
    assignments.set(worker.id, nearest);
    const target = constructionPoint(nearest, worker.id);
    if (Math.hypot(target.x - worker.x, target.y - worker.y) <= 42) {
      const list = present.get(nearest.id) || [];
      list.push(worker);
      present.set(nearest.id, list);
    }
  }
  const playerSite = player.canWork
    ? active.find((site) => {
        const target = constructionPoint(site, 2),
          distance = Math.hypot(site.x - player.x, site.y - player.y) || 1;
        return (
          Math.hypot(target.x - player.x, target.y - player.y) < 100 &&
          ((site.x - player.x) * Math.sin(player.viewYaw) +
            (site.y - player.y) * Math.cos(player.viewYaw)) /
            distance >
            0.45
        );
      })
    : undefined;
  return {
    assignments,
    present,
    playerSite,
    rates: new Map(
      active.map((site) => [
        site.id,
        constructionRate(
          site.id === playerSite?.id,
          (present.get(site.id) || []).map((worker) => worker.power),
        ),
      ]),
    ),
  };
}
