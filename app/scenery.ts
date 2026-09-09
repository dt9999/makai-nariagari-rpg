export type SceneryFamily =
  | 'broken-sanctum'
  | 'gnarled-grove'
  | 'crystal-ridge'
  | 'iron-palisade'
  | 'levitating-shards'
  | 'bone-scrub'
  | 'settlement-fence'
  | 'fungal-depths'
  | 'basalt-vents'
  | 'royal-thorns';

export type SceneryShape =
  | 'ruin'
  | 'tree'
  | 'spire'
  | 'palisade'
  | 'shards'
  | 'dead-tree'
  | 'fence'
  | 'fungus'
  | 'basalt'
  | 'thorns'
  | 'crown'
  | 'crystal'
  | 'rubble'
  | 'lantern'
  | 'bone'
  | 'ember';

export type SceneryMaterial =
  | 'stone'
  | 'moss'
  | 'wood'
  | 'leaf'
  | 'iron'
  | 'ash'
  | 'bone'
  | 'magic'
  | 'fungus'
  | 'lava'
  | 'obsidian';

export type SceneryProfile = {
  family: SceneryFamily;
  count: number;
  primary: SceneryShape;
  primaryMaterial: SceneryMaterial;
  accent: SceneryShape;
  accentMaterial: SceneryMaterial;
  accentRatio: number;
  minHeight: number;
  maxHeight: number;
  raised?: boolean;
};

const profiles: Record<string, SceneryProfile> = {
  廃墟: {
    family: 'broken-sanctum',
    count: 20,
    primary: 'ruin',
    primaryMaterial: 'stone',
    accent: 'rubble',
    accentMaterial: 'moss',
    accentRatio: 0.7,
    minHeight: 1.6,
    maxHeight: 4.2,
  },
  森: {
    family: 'gnarled-grove',
    count: 34,
    primary: 'tree',
    primaryMaterial: 'wood',
    accent: 'crown',
    accentMaterial: 'leaf',
    accentRatio: 1,
    minHeight: 6.5,
    maxHeight: 12,
  },
  岩山: {
    family: 'crystal-ridge',
    count: 24,
    primary: 'spire',
    primaryMaterial: 'stone',
    accent: 'crystal',
    accentMaterial: 'magic',
    accentRatio: 0.46,
    minHeight: 2.8,
    maxHeight: 7.2,
  },
  砦: {
    family: 'iron-palisade',
    count: 18,
    primary: 'palisade',
    primaryMaterial: 'iron',
    accent: 'rubble',
    accentMaterial: 'stone',
    accentRatio: 0.72,
    minHeight: 2.2,
    maxHeight: 4.6,
  },
  塔: {
    family: 'levitating-shards',
    count: 20,
    primary: 'shards',
    primaryMaterial: 'ash',
    accent: 'crystal',
    accentMaterial: 'magic',
    accentRatio: 0.72,
    minHeight: 1.7,
    maxHeight: 4.8,
    raised: true,
  },
  荒野: {
    family: 'bone-scrub',
    count: 20,
    primary: 'dead-tree',
    primaryMaterial: 'wood',
    accent: 'bone',
    accentMaterial: 'bone',
    accentRatio: 0.68,
    minHeight: 2.6,
    maxHeight: 5.8,
  },
  魔族集落: {
    family: 'settlement-fence',
    count: 16,
    primary: 'fence',
    primaryMaterial: 'wood',
    accent: 'lantern',
    accentMaterial: 'lava',
    accentRatio: 0.55,
    minHeight: 1.3,
    maxHeight: 2.3,
  },
  洞窟: {
    family: 'fungal-depths',
    count: 24,
    primary: 'fungus',
    primaryMaterial: 'fungus',
    accent: 'crystal',
    accentMaterial: 'magic',
    accentRatio: 0.62,
    minHeight: 1.4,
    maxHeight: 3.5,
  },
  火山: {
    family: 'basalt-vents',
    count: 25,
    primary: 'basalt',
    primaryMaterial: 'obsidian',
    accent: 'ember',
    accentMaterial: 'lava',
    accentRatio: 0.7,
    minHeight: 2.2,
    maxHeight: 6.4,
  },
  城: {
    family: 'royal-thorns',
    count: 20,
    primary: 'thorns',
    primaryMaterial: 'iron',
    accent: 'crystal',
    accentMaterial: 'magic',
    accentRatio: 0.5,
    minHeight: 2.6,
    maxHeight: 5.5,
  },
};

export function sceneryProfile(biome: string): SceneryProfile {
  return profiles[biome] || profiles['廃墟'];
}

export const SCENERY_BIOMES = Object.keys(profiles);
