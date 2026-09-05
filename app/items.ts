export type ItemKind =
  | 'weapon'
  | 'armor'
  | 'consumable'
  | 'material'
  | 'gem'
  | 'relic';
export type ItemBonus = {
  attack?: number;
  defense?: number;
  magic?: number;
  life?: number;
  leadership?: number;
};
export type ItemDefinition = {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
  rank: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  value: number;
  bonus: ItemBonus;
  jobs?: string[];
  heal?: number;
  energy?: number;
};
export type InventoryStack = { id: string; count: number };
export type Equipment = {
  weapon: string | null;
  armor: string | null;
  gem: string | null;
  relic: string | null;
};
export type WorldLoot = {
  id: number;
  x: number;
  y: number;
  item: string;
  count: number;
  chest: boolean;
  claimed: boolean;
};
export const ITEM_KIND_NAMES: Record<ItemKind, string> = {
  weapon: '武器',
  armor: '防具',
  consumable: '消耗品',
  material: '素材',
  gem: '魔石',
  relic: '遺物',
};
export const RARITY_NAMES = {
  common: '通常',
  uncommon: '良質',
  rare: '希少',
  epic: '叙事',
  legendary: '伝説',
};
export const RARITY_COLORS = {
  common: '#c1bec8',
  uncommon: '#76c894',
  rare: '#70a9e0',
  epic: '#bc83eb',
  legendary: '#efbb61',
};
export const BONUS_NAMES: Record<keyof ItemBonus, string> = {
  attack: '攻撃',
  defense: '防御',
  magic: '魔力',
  life: '生命',
  leadership: '統率',
};
const weapons = [
  ['sword', '魔剣', ['blade', 'dragoon']],
  ['axe', '戦斧', ['berserker', 'warlock']],
  ['staff', '魔杖', ['mage', 'nightseer']],
  ['dagger', '双短剣', ['shadow', 'nightseer']],
  ['spear', '長槍', ['lancer', 'dragoon']],
  ['sigil', '支配器', ['ruler', 'warlock']],
] as const;
export const ITEMS: ItemDefinition[] = [
  ...weapons.flatMap(([id, name, jobs]) =>
    [0, 1, 2, 3].map((t) => ({
      id: `${id}-${t}`,
      name: `${['欠けた', '黒鉄の', '魂紋の', '深淵王の'][t]}${name}`,
      description: `${['朽ちた遺跡で拾える粗末な', '魔界の職人が鍛えた堅牢な', '古い魂が刻まれた希少な', '覇者の魔力を宿した'][t]}${name}。職業に合う者だけが力を引き出せる。`,
      kind: 'weapon' as const,
      rank: t * 2,
      rarity: (['common', 'uncommon', 'rare', 'legendary'] as const)[t],
      value: 8 + t * t * 35,
      bonus: {
        attack: 3 + t * 7,
        magic: id === 'staff' || id === 'sigil' ? 3 + t * 6 : t,
      },
      jobs: [...jobs],
    })),
  ),
  ...[0, 1, 2, 3].map((t) => ({
    id: `armor-${t}`,
    name: ['灰獣の革鎧', '黒鉄の胸甲', '月影の魔装', '魔王の外殻'][t],
    description:
      '厚みのある魔界素材で作られた鎧。身体の進化とは独立して装備できる。',
    kind: 'armor' as const,
    rank: t * 2,
    rarity: (['common', 'uncommon', 'rare', 'legendary'] as const)[t],
    value: 12 + t * t * 40,
    bonus: { defense: 1 + t * 3, life: 8 + t * 14 },
  })),
  {
    id: 'potion',
    name: '緋色の回復薬',
    description: 'HPを60回復する。満タンのときは消費しない。',
    kind: 'consumable',
    rank: 0,
    rarity: 'common',
    value: 8,
    bonus: {},
    heal: 60,
  },
  {
    id: 'elixir',
    name: '夜露の活力薬',
    description: '持久力を70回復する。満タンのときは消費しない。',
    kind: 'consumable',
    rank: 0,
    rarity: 'uncommon',
    value: 10,
    bonus: {},
    energy: 70,
  },
  {
    id: 'wood',
    name: '魔木',
    description: '建築の骨組みと道具に用いる、瘴気に耐える木材。',
    kind: 'material',
    rank: 0,
    rarity: 'common',
    value: 2,
    bonus: {},
  },
  {
    id: 'ore',
    name: '瘴気鉱',
    description: '建築と鍛冶に用いる硬い鉱石。紫の脈が走っている。',
    kind: 'material',
    rank: 0,
    rarity: 'common',
    value: 3,
    bonus: {},
  },
  {
    id: 'hide',
    name: '魔獣の厚皮',
    description: '獣から得る丈夫な皮。資材交換で魔木や鉱石に換えられる。',
    kind: 'material',
    rank: 0,
    rarity: 'uncommon',
    value: 12,
    bonus: {},
  },
  {
    id: 'crystal',
    name: '未精製の魂晶',
    description: '強い魔物や鉱脈から得る結晶。資材交換に使える。',
    kind: 'material',
    rank: 2,
    rarity: 'rare',
    value: 24,
    bonus: {},
  },
  {
    id: 'ember-gem',
    name: '火種の魔石',
    description: '武器へ小さな炎の魔力を添える。',
    kind: 'gem',
    rank: 0,
    rarity: 'uncommon',
    value: 20,
    bonus: { magic: 5, attack: 2 },
  },
  {
    id: 'moon-gem',
    name: '銀月の魔石',
    description: '魔術と防御を調和させる澄んだ石。',
    kind: 'gem',
    rank: 2,
    rarity: 'rare',
    value: 60,
    bonus: { magic: 12, defense: 2 },
  },
  {
    id: 'crown-relic',
    name: '名もなき王の欠片',
    description: '最弱だった名もなき魔族の遺志。軍勢に勇気を与える。',
    kind: 'relic',
    rank: 0,
    rarity: 'epic',
    value: 120,
    bonus: { leadership: 3, attack: 4 },
  },
  {
    id: 'abyss-relic',
    name: '深淵王の印章',
    description: '領主が守っていた古い印章。生命と魔力を高める。',
    kind: 'relic',
    rank: 4,
    rarity: 'legendary',
    value: 280,
    bonus: { life: 45, magic: 18, leadership: 5 },
  },
];
const byId = new Map(ITEMS.map((i) => [i.id, i]));
export const itemOf = (id: string) => {
  const item = byId.get(id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
};
export const emptyEquipment = (): Equipment => ({
  weapon: null,
  armor: null,
  gem: null,
  relic: null,
});
export function addInventory(
  inventory: InventoryStack[],
  id: string,
  count = 1,
) {
  if (!Number.isSafeInteger(count) || count <= 0) return;
  itemOf(id);
  const stack = inventory.find((s) => s.id === id);
  if (stack) stack.count += count;
  else inventory.push({ id, count });
}
export function removeInventory(
  inventory: InventoryStack[],
  id: string,
  count = 1,
): boolean {
  const i = inventory.findIndex((s) => s.id === id);
  if (
    i < 0 ||
    !Number.isSafeInteger(count) ||
    count <= 0 ||
    inventory[i].count < count
  )
    return false;
  inventory[i].count -= count;
  if (!inventory[i].count) inventory.splice(i, 1);
  return true;
}
export function equipmentBonus(
  equipment: Equipment,
  job: string,
): Required<ItemBonus> {
  const result = { attack: 0, defense: 0, magic: 0, life: 0, leadership: 0 };
  for (const id of Object.values(equipment))
    if (id) {
      const item = itemOf(id);
      if (item.jobs && !item.jobs.includes(job)) continue;
      for (const key of Object.keys(item.bonus) as (keyof ItemBonus)[])
        result[key] += item.bonus[key] || 0;
    }
  return result;
}
export const weaponFor = (job: string, tier: number) => {
  const weapon =
    weapons.find(([, , jobs]) => (jobs as readonly string[]).includes(job)) ||
    weapons[0];
  return `${weapon[0]}-${Math.max(0, Math.min(3, tier))}`;
};
export function lootFor(
  tier: number,
  seed: number,
  job: string,
  boss = false,
): string {
  if (boss) return tier >= 4 ? 'abyss-relic' : 'crown-relic';
  const roll = seed % 8,
    t = Math.min(3, Math.floor(tier / 2));
  return roll === 0
    ? weaponFor(job, t)
    : roll === 1
      ? `armor-${t}`
      : roll === 2
        ? 'potion'
        : roll === 3
          ? 'elixir'
          : roll === 4
            ? 'hide'
            : roll === 5
              ? 'crystal'
              : roll === 6
                ? 'ember-gem'
                : 'moon-gem';
}

// Construction keeps the canonical wood / ore counters; never duplicate them in the bag.
export type InventoryOwner = {
  inventory: InventoryStack[];
  equipment: Equipment;
  job: string;
  rank: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  wood: number;
  ore: number;
};
export function inventoryView(w: InventoryOwner): InventoryStack[] {
  return [
    ...w.inventory.map((s) => ({ ...s })),
    { id: 'wood', count: w.wood },
    { id: 'ore', count: w.ore },
  ].filter((s) => s.count > 0);
}
export function receiveItem(w: InventoryOwner, id: string, count = 1) {
  if (!Number.isSafeInteger(count) || count <= 0) return;
  if (id === 'wood' || id === 'ore') w[id] += count;
  else addInventory(w.inventory, id, count);
}
export function equipItem(w: InventoryOwner, id: string): string {
  const item = itemOf(id);
  if (!w.inventory.some((s) => s.id === id && s.count > 0))
    return 'このアイテムを所持していない。';
  if (!['weapon', 'armor', 'gem', 'relic'].includes(item.kind))
    return '装備できない種類のアイテム。';
  const slot = item.kind as keyof Equipment;
  const removing = w.equipment[slot] === id;
  if (!removing && item.rank > w.rank)
    return `装備には魔族ランク ${['F', 'E', 'D', 'C', 'B', 'A', 'S', '魔王'][item.rank]} が必要。`;
  if (!removing && item.jobs && !item.jobs.includes(w.job))
    return '現在の職業では扱えない武器。';
  const before = equipmentBonus(w.equipment, w.job).life;
  w.equipment[slot] = w.equipment[slot] === id ? null : id;
  const delta = equipmentBonus(w.equipment, w.job).life - before;
  w.maxHp += delta;
  // Equipping and unequipping must never create free healing.
  w.hp = Math.min(w.hp, w.maxHp);
  return `${item.name}を${w.equipment[slot] ? '装備した' : '外した'}。`;
}
export function consumeItem(w: InventoryOwner, id: string): string {
  const item = itemOf(id);
  if (item.kind !== 'consumable') return '使用できない種類のアイテム。';
  if (
    (!item.heal || w.hp >= w.maxHp) &&
    (!item.energy || w.energy >= w.maxEnergy)
  )
    return 'すでに全回復しているため消費しなかった。';
  if (!removeInventory(w.inventory, id))
    return 'このアイテムを所持していない。';
  w.hp = Math.min(w.maxHp, w.hp + (item.heal || 0));
  w.energy = Math.min(w.maxEnergy, w.energy + (item.energy || 0));
  return `${item.name}を使用した。`;
}
export function discardItem(w: InventoryOwner, id: string): string {
  const item = itemOf(id);
  if (id === 'wood' || id === 'ore') {
    if (w[id] <= 0) return 'この素材を所持していない。';
    w[id]--;
  } else {
    const stack = w.inventory.find((s) => s.id === id);
    if (Object.values(w.equipment).includes(id) && (stack?.count || 0) <= 1)
      return '装備中のため破棄できない。先に装備を外そう。';
    if (!removeInventory(w.inventory, id))
      return 'このアイテムを所持していない。';
  }
  return `${item.name}を1個破棄した。`;
}
export function exchangeItem(w: InventoryOwner, id: string): string {
  if (!['hide', 'crystal'].includes(id)) return '交換に使えるのは厚皮と魂晶。';
  if (!removeInventory(w.inventory, id)) return '交換素材を所持していない。';
  const count = id === 'hide' ? 3 : 6;
  w.wood += count;
  w.ore += count;
  return `${itemOf(id).name}を魔木・瘴気鉱 各${count}へ交換した。`;
}
