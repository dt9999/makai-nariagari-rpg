/** Shared simulation/render coordinates. A world unit is 1.8 cm. */
export const WORLD_WIDTH = 32000;
export const WORLD_HEIGHT = 18000;
export const REGION_W = 6400;
export const REGION_H = 9000;
export const SCALE = 0.018;
/** Includes the outer guard ring so camp enemies and first construction sites stay readable. */
export const CAMP_CLEARING_RADIUS = 820;
export const worldX = (x: number) => (x - WORLD_WIDTH / 2) * SCALE;
export const worldZ = (y: number) => (y - WORLD_HEIGHT / 2) * SCALE;
export type Region = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  biome: string;
  color: string;
  owner: 'unknown' | 'wild' | 'enemy' | 'own';
  landmark: string;
  subBiomes: string[];
  sky: string;
  mist: string;
};
const definitions = [
  [
    'ruins',
    '忘れられた大廃墟',
    '廃墟',
    '#49434d',
    '始まりの地下砦',
    '崩れた街道|墓標の丘|月影の湿地',
    '#292637',
    '#635369',
  ],
  [
    'forest',
    '囁きの魔樹海',
    '森',
    '#304937',
    '千年魔樹の集落',
    '苔むす林床|毒花の湿原|銀葉の深森',
    '#182c30',
    '#496957',
  ],
  [
    'mountain',
    '骸骨連峰',
    '岩山',
    '#55525e',
    '白骨山塞',
    '風削りの尾根|白骨の峡谷|紫晶の峰',
    '#37384b',
    '#71758b',
  ],
  [
    'citadel',
    '黒曜城塞領',
    '砦',
    '#3c3941',
    '黒曜大城壁',
    '鉄錆の前線|黒曜採石場|城門回廊',
    '#31242b',
    '#665056',
  ],
  [
    'ashland',
    '灰冠の塔領',
    '塔',
    '#43404d',
    '天を穿つ灰冠塔',
    '灰の砂丘|浮遊石の谷|魔力断層',
    '#302943',
    '#776184',
  ],
  [
    'waste',
    '赤錆大荒野',
    '荒野',
    '#755443',
    '巨人の監視塔',
    '赤砂の盆地|枯骨の平原|黄昏の台地',
    '#49322c',
    '#9d735b',
  ],
  [
    'village',
    '薄暮都市圏',
    '魔族集落',
    '#4b3b49',
    '角笛の城下町',
    '交易の街道|畑と放牧地|廃水の低地',
    '#382b3c',
    '#765c70',
  ],
  [
    'cave',
    '底無し洞窟領',
    '洞窟',
    '#303d4b',
    '深淵王の大裂け目',
    '陥没台地|青燐の岩窟|地底菌の森',
    '#182737',
    '#435e74',
  ],
  [
    'volcano',
    '業火火山帯',
    '火山',
    '#52332b',
    '煉獄火口神殿',
    '黒灰の斜面|硫黄の裂け目|溶岩の渓谷',
    '#3c2021',
    '#874a3e',
  ],
  [
    'castle',
    '魔王城外郭領',
    '城',
    '#363043',
    '封印された巨城',
    '紫夜の庭園|封印の回廊|王城の断崖',
    '#241c36',
    '#645078',
  ],
] as const;
export const REGIONS: Region[] = definitions.map((r, i) => ({
  id: r[0],
  name: r[1],
  biome: r[2],
  color: r[3],
  landmark: r[4],
  subBiomes: r[5].split('|'),
  sky: r[6],
  mist: r[7],
  x: (i % 5) * REGION_W,
  y: Math.floor(i / 5) * REGION_H,
  w: REGION_W,
  h: REGION_H,
  owner: 'enemy',
}));
export const regionAt = (x: number, y: number) =>
  REGIONS[
    Math.max(0, Math.min(4, Math.floor(x / REGION_W))) +
      Math.max(0, Math.min(1, Math.floor(y / REGION_H))) * 5
  ];
export const subBiomeAt = (x: number, y: number) => {
  const r = regionAt(x, y);
  return r.subBiomes[Math.min(2, Math.floor(((y - r.y) / r.h) * 3))];
};
export type SiteKind =
  | 'camp'
  | 'ruin'
  | 'cave'
  | 'quarry'
  | 'nest'
  | 'shrine'
  | 'outpost'
  | 'vista';
export type DiscoverySite = {
  id: string;
  region: string;
  name: string;
  kind: SiteKind;
  x: number;
  y: number;
  radius: number;
  description: string;
  danger: number;
};
/** Camps are defended from outside their walls; other packs stay close to their habitat. */
export function encounterPackRadius(kind: SiteKind, member: number) {
  const index = Math.max(0, Math.floor(member));
  return kind === 'camp' ? 620 + index * 35 : 130 + index * 35;
}
export const SITE_LABELS: Record<SiteKind, string> = {
  camp: '集落',
  ruin: '遺跡',
  cave: '洞窟',
  quarry: '資源地',
  nest: '魔物の巣',
  shrine: '祭壇',
  outpost: '前線基地候補',
  vista: '秘境',
};
const siteKinds: SiteKind[] = [
  'camp',
  'ruin',
  'cave',
  'quarry',
  'nest',
  'shrine',
  'outpost',
  'vista',
];
const siteNames = [
  [
    '残火の隠れ里',
    '鐘のない礼拝堂',
    '泣き石の地下墓',
    '月銀の採掘跡',
    '瓦礫喰いの寝床',
    '最初の誓い',
    '崩橋の野営地',
    '星映りの湿地',
  ],
  [
    '根編みの村',
    '蔦縛りの王廟',
    '樹洞の深淵',
    '翡翠樹液の泉',
    '月狼の狩場',
    '銀葉の祭壇',
    '古木の見張り場',
    '蛍光胞子の庭',
  ],
  [
    '風待ちの岩屋',
    '骨柱の神殿',
    '骸晶の洞',
    '白鉄露頭',
    '断崖獣の巣',
    '峰守りの石輪',
    '峠の宿営地',
    '双牙の自然橋',
  ],
  [
    '鎖鍛冶の集落',
    '灰旗の兵廟',
    '城壁下の抜け穴',
    '黒曜切り出し場',
    '重殻獣の厩',
    '戦士の誓碑',
    '捨てられた攻城陣',
    '剣塚の丘',
  ],
  [
    '灯守りの宿',
    '観測者の廃塔',
    '浮石の空洞',
    '無重力の晶窟',
    '怨眼の漂流地',
    '重力の祭壇',
    '塔影の休息所',
    '逆さ石の円環',
  ],
  [
    '骨布の商隊',
    '砂埋まりの都市',
    '赤砂の横穴',
    '赤鉄の鉱脈',
    '六脚獣の狩場',
    '風葬の石壇',
    '砂嵐避けの陣',
    '巨人の肋骨',
  ],
  [
    '薄暮の交易所',
    '角笛の劇場跡',
    '地下水路',
    '魔麦と薬草の畑',
    '屋根這いの巣',
    '街道の守り神',
    '旧市場の広場',
    '紫灯の水庭',
  ],
  [
    '菌傘の集落',
    '沈んだ石書庫',
    '青燐の大洞',
    '紫水晶の露頭',
    '蝙蝠の天蓋',
    '地底の記憶',
    '岩棚の避難所',
    '光菌の湖畔',
  ],
  [
    '火守りの小屋',
    '焼けた巡礼院',
    '冷えた溶岩洞',
    '硫黄の採掘場',
    '火蜥蜴の産卵場',
    '業火の石壇',
    '火山灰の避難陣',
    '赤い噴気孔',
  ],
  [
    '影縫いの城下',
    '王家の霊廟',
    '封印の地下道',
    '王晶の庭',
    '混成魔獣の檻',
    '黒冠の祭壇',
    '城外の攻略陣',
    '夜を映す庭園',
  ],
];
const placements = [
  [0.16, 0.15],
  [0.38, 0.25],
  [0.77, 0.19],
  [0.27, 0.48],
  [0.8, 0.7],
  [0.43, 0.83],
  [0.59, 0.43],
  [0.17, 0.77],
];
const descriptions: Record<SiteKind, string> = {
  camp: '生き残った魔族が集まる。道を尋ね、物資を補給できる。',
  ruin: 'かつての魔界の記録と、守られた宝箱が眠る。',
  cave: '入口の先には暗い岩の通路と希少な鉱石が続く。',
  quarry: '良質な魔木と鉱石が集まる。採集班を送る価値がある。',
  nest: '隊長と群れが縄張りを守る。制圧すれば新しい軍勢を得られる。',
  shrine: '古い魔力が残る。封印を調べれば遺物が見つかる。',
  outpost: '領主の本拠地へ向かう前に、拠点を構えられる平坦な土地。',
  vista: '道を外れた者だけが出会う、魔界の静かな秘境。',
};
export const DISCOVERY_SITES: DiscoverySite[] = REGIONS.flatMap((r, ri) =>
  siteKinds.map((kind, i) => ({
    id: `${r.id}-${kind}`,
    region: r.id,
    name: siteNames[ri][i],
    kind,
    x: r.x + r.w * placements[i][0],
    y: r.y + r.h * placements[i][1],
    radius: 150,
    description: descriptions[kind],
    danger: kind === 'nest' ? 2 : kind === 'cave' || kind === 'shrine' ? 1 : 0,
  })),
);
const regionSites = new Map(
  REGIONS.map((r) => [r.id, DISCOVERY_SITES.filter((s) => s.region === r.id)]),
);
export const sitesIn = (region: string) => regionSites.get(region) || [];
export const nearestSite = (x: number, y: number) =>
  sitesIn(regionAt(x, y).id).reduce((a, b) =>
    Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b,
  );

export type WorldPoint = { x: number; y: number };
export type Waypoint = WorldPoint & { id: string; name: string };
export const headquartersOf = (r: Region): Waypoint => ({
  id: `${r.id}-lord`,
  name: r.landmark,
  x: r.x + r.w * 0.68,
  y: r.y + r.h * 0.5,
});
export const campResidentAt = (s: DiscoverySite): WorldPoint => ({
  x: s.x - 70,
  y: s.y - 120,
});
export function recordSiteVisit(records: string[], id: string): boolean {
  if (
    records.includes(id) ||
    !DISCOVERY_SITES.some(
      (s) => s.id === id && ['camp', 'shrine', 'vista'].includes(s.kind),
    )
  )
    return false;
  records.push(id);
  return true;
}
export const CAMP_ROOMS = [
  [-4, 1],
  [4, 3],
] as const;
export type SiteWall = {
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
};
const wallCache = new Map<string, SiteWall[]>();
/** Coordinates in simulation units, derived from the same metre-sized walls used for rendering. */
export function wallsFor(s: DiscoverySite): SiteWall[] {
  const cached = wallCache.get(s.id);
  if (cached) return cached;
  const walls: SiteWall[] = [];
  const box = (
    x: number,
    z: number,
    width: number,
    depth: number,
    height = 2.8,
  ) =>
    walls.push({
      x: s.x + x / SCALE,
      y: s.y + z / SCALE,
      width: width / SCALE,
      depth: depth / SCALE,
      height,
    });
  if (s.kind === 'camp')
    for (const [x, z] of CAMP_ROOMS) {
      box(x - 2, z, 0.3, 4);
      box(x + 2, z, 0.3, 4);
      box(x, z + 2, 4, 0.25);
      for (const side of [-1, 1]) box(x + side * 1.35, z - 2, 1.3, 0.25);
    }
  if (s.kind === 'cave') {
    box(-3, 7, 1.7, 16, 4);
    box(3, 7, 1.7, 16, 4);
  }
  wallCache.set(s.id, walls);
  return walls;
}
export function positionBlocked(
  x: number,
  y: number,
  radius = 16,
  height = 0,
): boolean {
  for (const s of sitesIn(regionAt(x, y).id))
    for (const wall of wallsFor(s)) {
      if (height >= wall.height) continue;
      const dx = Math.max(0, Math.abs(x - wall.x) - wall.width / 2),
        dy = Math.max(0, Math.abs(y - wall.y) - wall.depth / 2);
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  return false;
}
/** Swept small steps prevent sprint/dodge tunnelling and allow sliding along walls. */
export function moveOnGround(
  from: WorldPoint,
  to: WorldPoint,
  height = 0,
): WorldPoint {
  let x = from.x,
    y = from.y;
  const dx = to.x - x,
    dy = to.y - y,
    steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let i = 0; i < steps; i++) {
    const nx = Math.max(20, Math.min(WORLD_WIDTH - 20, x + dx / steps));
    if (!positionBlocked(nx, y, 16, height)) x = nx;
    const ny = Math.max(20, Math.min(WORLD_HEIGHT - 20, y + dy / steps));
    if (!positionBlocked(x, ny, 16, height)) y = ny;
  }
  return { x, y };
}
export type Hazard = {
  id: string;
  site: string;
  region: string;
  kind: 'poison' | 'fire' | 'arcane';
  name: string;
  x: number;
  y: number;
  radius: number;
  damage: number;
  phase: number;
};
export const HAZARDS: Hazard[] = DISCOVERY_SITES.filter((s) =>
  ['quarry', 'cave', 'nest', 'vista'].includes(s.kind),
).map((s, i) => {
  const kind = (
    ['forest', 'cave', 'village'].includes(s.region)
      ? 'poison'
      : ['volcano', 'citadel', 'waste'].includes(s.region)
        ? 'fire'
        : 'arcane'
  ) as Hazard['kind'];
  return {
    id: `${s.id}-hazard`,
    site: s.id,
    region: s.region,
    kind,
    name:
      kind === 'poison'
        ? '毒胞子の噴気'
        : kind === 'fire'
          ? '灼熱の裂け目'
          : '魔力の放電',
    x: s.x + (s.kind === 'cave' ? 70 : 290),
    y: s.y + (s.kind === 'cave' ? 360 : 170),
    radius: s.kind === 'cave' ? 42 : 85,
    damage: kind === 'fire' ? 10 : 6,
    phase: (i % 5) * 1.3,
  };
});
export const hazardPhase = (
  hazard: Hazard,
  time: number,
): 'quiet' | 'warning' | 'active' => {
  const t = (((time + hazard.phase) % 7) + 7) % 7;
  return t < 3.5 ? 'quiet' : t < 5 ? 'warning' : 'active';
};
export function hazardAt(x: number, y: number): Hazard | undefined {
  return HAZARDS.find((h) => Math.hypot(h.x - x, h.y - y) < h.radius);
}
export function hazardDamage(
  x: number,
  y: number,
  height: number,
  time: number,
  dt: number,
): number {
  const h = hazardAt(x, y);
  return h && height < 0.65 && hazardPhase(h, time) === 'active'
    ? h.damage * Math.max(0, dt)
    : 0;
}
export type Interaction = {
  kind: 'loot' | 'node' | 'camp' | 'shrine' | 'vista';
  id: string | number;
  label: string;
  distance: number;
};
export function nearbyInteraction(
  player: WorldPoint,
  loot: ({
    id: number;
    claimed: boolean;
    chest: boolean;
    item: string;
  } & WorldPoint)[],
  nodes: ({ id: number; n: number; kind: 'wood' | 'ore' } & WorldPoint)[],
): Interaction | undefined {
  const candidates: Interaction[] = [];
  const add = (
    at: WorldPoint,
    radius: number,
    candidate: Omit<Interaction, 'distance'>,
  ) => {
    const distance = Math.hypot(player.x - at.x, player.y - at.y);
    if (distance < radius) candidates.push({ ...candidate, distance });
  };
  for (const l of loot)
    if (!l.claimed)
      add(l, 90, {
        kind: 'loot',
        id: l.id,
        label: l.chest ? '宝箱を開ける' : '戦利品を拾う',
      });
  for (const n of nodes)
    if (n.n > 0)
      add(n, 75, {
        kind: 'node',
        id: n.id,
        label: n.kind === 'ore' ? '瘴気鉱を採掘' : '魔木を採集',
      });
  for (const s of sitesIn(regionAt(player.x, player.y).id)) {
    if (s.kind === 'camp')
      add(campResidentAt(s), 90, {
        kind: 'camp',
        id: s.id,
        label: '道守りと話す・補給',
      });
    if (s.kind === 'shrine')
      add(s, 90, { kind: 'shrine', id: s.id, label: '祭壇の封印を調べる' });
    if (s.kind === 'vista')
      add(s, 100, { kind: 'vista', id: s.id, label: '秘境の記憶を記す' });
  }
  return candidates.sort((a, b) => a.distance - b.distance)[0];
}

/** Continuous terrain with soft region transitions and level foundations at destinations. */
export function terrainHeight(x: number, y: number): number {
  const r = regionAt(x, y),
    u = (x - r.x) / r.w,
    v = (y - r.y) / r.h;
  const edge = Math.max(0, Math.min(1, Math.min(u, 1 - u, v, 1 - v) * 9));
  const relief =
    r.biome === '岩山'
      ? 11
      : r.biome === '火山'
        ? 8
        : r.biome === '洞窟'
          ? 5
          : 3.2;
  const global =
    1.8 * Math.sin(x * 0.0012) * Math.cos(y * 0.0011) +
    0.6 * Math.sin((x + y) * 0.003);
  const local =
    edge *
    relief *
    (0.55 * Math.sin(u * 12.5) * Math.cos(v * 10.8) +
      0.25 * Math.sin(u * 27 + v * 18));
  // Broad tracks lead from the frontier through the forward camp to headquarters.
  const roadY = r.y + r.h * (0.43 + 0.04 * Math.sin(u * 5));
  const roadBlend = Math.min(1, Math.abs(y - roadY) / 110);
  let height = global + local * roadBlend;
  for (const site of sitesIn(r.id)) {
    const dx = x - site.x,
      dy = y - site.y;
    const distance =
      site.kind === 'cave'
        ? Math.hypot(dx, dy - Math.max(0, Math.min(14 / SCALE, dy)))
        : Math.hypot(dx, dy);
    const flatRadius =
      site.kind === 'camp'
        ? CAMP_CLEARING_RADIUS
        : site.kind === 'cave'
          ? 180
          : 120;
    if (distance < flatRadius + 120) {
      const t = Math.max(0, Math.min(1, (distance - flatRadius) / 120));
      const blend = t * t * (3 - 2 * t);
      const foundation =
        1.8 * Math.sin(site.x * 0.0012) * Math.cos(site.y * 0.0011) +
        0.6 * Math.sin((site.x + site.y) * 0.003);
      height = foundation * (1 - blend) + height * blend;
    }
  }
  return height;
}
