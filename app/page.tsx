'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Binoculars,
  Backpack,
  Brain,
  Castle,
  ChevronUp,
  Crosshair,
  Flame,
  Footprints,
  Hammer,
  Lock,
  Map,
  Plus,
  RefreshCcw,
  Settings,
  Shield,
  ShieldCheck,
  Skull,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Wind,
  Zap,
} from 'lucide-react';
import {
  creatureAttackImpactProgress,
  type MonsterMotionKind,
} from './creature-motion';
import { NearbyIndex, PatrolClock } from './simulation';
import {
  MAX_RECRUIT_REFUSALS,
  RECRUIT_REFUSAL_BONUS,
  RECRUIT_WINDOW_SECONDS,
  recruitmentCohort,
  recruitmentChance,
} from './recruitment';
import {
  damageBearing,
  nearestRecruit,
  retreatHostilesAfterDefeat,
  selectAimCue,
  type DamageSource,
} from './combat-cues';
import {
  initialHoldings,
  territoryOwner,
  conquerTerritory,
  territoryBossId,
  territorySiegeStatus,
} from './territories';
import { InventoryPanel } from './inventory-panel';
import { RealmMap } from './realm-map';
import { PreferencesPanel } from './preferences-panel';
import { TutorialHint, TutorialPanel } from './tutorial-panel';
import {
  newTutorial,
  completeLesson,
  recordTutorialMotion,
  type TutorialState,
} from './tutorial';
import {
  moveAroundBuildings,
  plannedBuilding,
  placementIssue,
  constructionApproach,
  constructionPoint,
  constructionWork,
  clearBuildingSight,
  type StructureKind,
} from './structures';
import {
  DEFAULT_PREFERENCES,
  sanitizePreferences,
  type GamePreferences,
  type RenderPerformance,
} from './preferences';
import {
  AdventureHUD,
  AdventureMenu,
  GamePanel,
  type GameScreen,
} from './game-interface';
import './inventory.css';
import './game-interface.css';
import {
  emptyEquipment,
  equipmentBonus,
  itemOf,
  receiveItem,
  equipItem,
  consumeItem,
  discardItem,
  exchangeItem,
  weaponFor,
  lootFor,
  type InventoryStack,
  type Equipment,
  type WorldLoot,
} from './items';
import {
  REGIONS,
  DISCOVERY_SITES,
  SITE_LABELS,
  regionAt,
  subBiomeAt,
  sitesIn,
  headquartersOf,
  nearbyInteraction,
  hazardAt,
  hazardDamage,
  hazardPhase,
  recordSiteVisit,
  encounterPackRadius,
  type Waypoint,
} from './world';
import {
  AUTO_RUN_STUCK_SECONDS,
  nextAutoRunBlockedTime,
  resolveTravelAxes,
} from './travel';

type Owner = 'unknown' | 'wild' | 'enemy' | 'own';
type MonsterKind = MonsterMotionKind;
type Region = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  biome: string;
  color: string;
  owner: Owner;
  landmark: string;
};
type Mob = {
  id: number;
  x: number;
  y: number;
  hp: number;
  max: number;
  name: string;
  tier: number;
  boss?: boolean;
  ally?: boolean;
  kind?: MonsterKind;
  variant?: number;
  home: string;
  attackAnim?: number;
  attackTotal?: number;
  attackCd?: number;
  attackHit?: boolean;
  attackTarget?: number;
  hitAnim?: number;
  deathAnim?: number;
  dead?: boolean;
  recruitTime?: number;
  commanderId?: number;
  assignment?: MinionTask;
  anchorX?: number;
  anchorY?: number;
  rare?: boolean;
  patrol?: 'sentinel' | 'ambush' | 'roam';
  working?: boolean;
  workYaw?: number;
};
type Node = {
  id: number;
  x: number;
  y: number;
  kind: 'wood' | 'ore';
  n: number;
};
type PendingHit = {
  target: number;
  damage: number;
  delay: number;
  knockback?: number;
};
type MinionTask =
  | 'combat'
  | 'guard'
  | 'build'
  | 'gather'
  | 'mine'
  | 'haul'
  | 'smith'
  | 'research'
  | 'scout';
type MinionUnit = {
  id: number;
  name: string;
  kind: MonsterKind;
  tier: number;
  commanderId?: number;
  assignment: MinionTask;
  aptitudes: Record<MinionTask, number>;
};
type BuildingKind = StructureKind;
type BaseSite = {
  id: number;
  x: number;
  y: number;
  yaw: number;
  level: number;
  kind: BuildingKind;
  name: string;
  progress: number;
  duration: number;
  complete: boolean;
  workers: number;
  playerWorking?: boolean;
};
type BindingAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'guard'
  | 'heavy'
  | 'skill'
  | 'dodge'
  | 'recruit'
  | 'gather'
  | 'inventory'
  | 'map'
  | 'autoRun';
const DEFAULT_BINDINGS: Record<BindingAction, string> = {
  forward: 'w',
  back: 's',
  left: 'a',
  right: 'd',
  jump: ' ',
  sprint: 'shift',
  guard: 'r',
  heavy: '2',
  skill: '3',
  dodge: '4',
  recruit: 'e',
  gather: 'f',
  inventory: 'i',
  map: 'm',
  autoRun: 'c',
};
const BINDING_LABELS: Record<BindingAction, string> = {
  forward: '前進',
  back: '後退',
  left: '左移動',
  right: '右移動',
  jump: 'ジャンプ',
  sprint: 'ダッシュ',
  guard: '防御',
  heavy: '強攻撃',
  skill: 'スキル',
  dodge: '回避',
  recruit: '配下にする',
  gather: '調べる・拾う・採集',
  inventory: '持ち物',
  map: '地図',
  autoRun: '自動前進',
};
const bindingName = (key: string) =>
  key === ' ' ? 'SPACE' : key.toUpperCase();
type StatKey =
  | 'life'
  | 'strength'
  | 'defense'
  | 'magic'
  | 'agility'
  | 'stamina'
  | 'leadership';
type Stats = Record<StatKey, number>;
type JobSkill = {
  id: string;
  name: string;
  desc: string;
  level: number;
  cost: number;
};
type Job = {
  id: string;
  name: string;
  weapon: string;
  style: string;
  color: string;
  tier: 'base' | 'advanced';
  requires?: string[];
  power: number;
  magic: number;
  speed: number;
  range: number;
  minion: number;
  bonus: Partial<Stats>;
  skills: JobSkill[];
};
type Career = {
  lv: number;
  xp: number;
  skillPoints: number;
  stats: Stats;
  unlocked: string[];
  weaponLevel: number;
};
type World = {
  tutorial: TutorialState;
  preferences: GamePreferences;
  talkedSites: string[];
  activatedSites: string[];
  rumoredSites: string[];
  waypoint: Waypoint | null;
  worldTime: number;
  inventory: InventoryStack[];
  equipment: Equipment;
  loot: WorldLoot[];
  lootSequence: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  xp: number;
  lv: number;
  rank: number;
  job: string;
  skillPoints: number;
  stats: Stats;
  unlocked: string[];
  weaponLevel: number;
  careers: Record<string, Career>;
  energy: number;
  maxEnergy: number;
  guarding: boolean;
  autoRun: boolean;
  dodgeCd: number;
  dodgeTime: number;
  skillCd: number;
  heavyCd: number;
  attackAnim: number;
  attackTotal: number;
  attackKind: 'none' | 'normal' | 'heavy' | 'skill';
  hitAnim: number;
  respawnGrace: number;
  damageSource?: DamageSource;
  buildAnim: number;
  buildMode: boolean;
  buildYaw: number;
  selectedBuilding: BuildingKind;
  bases: BaseSite[];
  roster: MinionUnit[];
  recruitRefusals: number;
  workClock: number;
  forgeProgress: number;
  researchProgress: number;
  scoutProgress: number;
  pendingHits: PendingHit[];
  facingX: number;
  facingY: number;
  viewYaw: number;
  viewPitch: number;
  height: number;
  velocityY: number;
  grounded: boolean;
  wood: number;
  ore: number;
  minions: number;
  base: number;
  lands: number;
  kills: number;
  bossKills: number;
  achievements: number;
  mobs: Mob[];
  nodes: Node[];
  discovered: string[];
  discoveredSites: string[];
  conquered: string[];
  message: string;
  banner: string;
  bannerTime: number;
  region: string;
  cd: number;
};
const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', '魔王'];
const RANK_APPEARANCE = [
  '小さな双角と異質な紫肌。粗末な装備でも確かに魔族だ。',
  '角と鉤爪が伸び、立ち姿に自信が宿り始める。',
  '瞳と皮膚紋様に固有の紫魔力が流れ始める。',
  '発達した角と手甲を備え、強者の輪郭が完成する。',
  '硬質な装甲と肩角が育ち、上位魔族の威圧を放つ。',
  '翼状の背部器官と長大な角で、遠目にも格を示す。',
  '黒角・魔力紋・装備が調和した最高位の魔族。',
  '始まりの双角と紫の瞳が、魔王の威厳ある最終形へ至る。',
];
const MINION_TASKS: {
  id: MinionTask;
  name: string;
  desc: string;
}[] = [
  { id: 'combat', name: '戦闘', desc: '敵を追撃して前線で戦う' },
  { id: 'guard', name: '護衛', desc: '主人公と拠点を優先して守る' },
  { id: 'build', name: '建築', desc: '建築時間を短縮する' },
  { id: 'gather', name: '採集', desc: '魔木を継続的に集める' },
  { id: 'mine', name: '採掘', desc: '瘴気鉱を継続的に掘る' },
  { id: 'haul', name: '運搬', desc: '採集・採掘効率を高める' },
  { id: 'smith', name: '鍛冶', desc: '武器強化の進行を蓄積する' },
  { id: 'research', name: '研究', desc: '経験と魔界知識を獲得する' },
  { id: 'scout', name: '偵察', desc: '未探索領域の情報を集める' },
];
const BUILDINGS: {
  id: BuildingKind;
  name: string;
  desc: string;
  wood: number;
  ore: number;
  seconds: number;
  rank: number;
  scale: string;
}[] = [
  {
    id: 'hideout',
    name: '小さな隠れ家',
    desc: '休息と敗北時の帰還に使える最小拠点',
    wood: 3,
    ore: 2,
    seconds: 14,
    rank: 0,
    scale: '小型',
  },
  {
    id: 'storage',
    name: '魔材倉庫',
    desc: '採集・採掘の自動収入を25%高める',
    wood: 5,
    ore: 3,
    seconds: 22,
    rank: 0,
    scale: '小型',
  },
  {
    id: 'barracks',
    name: '魔獣兵舎',
    desc: '戦闘配下の攻撃力を18%高める長屋',
    wood: 8,
    ore: 6,
    seconds: 34,
    rank: 1,
    scale: '中型',
  },
  {
    id: 'smithy',
    name: '黒鉄鍛冶場',
    desc: '鍛冶班が職業武器を自動で強化する',
    wood: 7,
    ore: 10,
    seconds: 42,
    rank: 2,
    scale: '中型',
  },
  {
    id: 'laboratory',
    name: '魔力研究所',
    desc: '研究班が魔界知識を経験値へ変える',
    wood: 10,
    ore: 12,
    seconds: 52,
    rank: 2,
    scale: '中型',
  },
  {
    id: 'watchtower',
    name: '見張り塔',
    desc: '偵察班の未探索地域発見を加速する',
    wood: 12,
    ore: 10,
    seconds: 58,
    rank: 3,
    scale: '大型',
  },
  {
    id: 'wall',
    name: '城壁',
    desc: '領地を分断する堅牢な壁',
    wood: 8,
    ore: 16,
    seconds: 62,
    rank: 3,
    scale: '大型',
  },
  {
    id: 'gate',
    name: '魔界門',
    desc: '軍勢が通過できる城門',
    wood: 14,
    ore: 20,
    seconds: 78,
    rank: 4,
    scale: '大型',
  },
  {
    id: 'fortress',
    name: '前線砦',
    desc: '敗北時にも戻れる敵領土攻略拠点',
    wood: 24,
    ore: 28,
    seconds: 105,
    rank: 4,
    scale: '巨大',
  },
  {
    id: 'castle',
    name: '魔族城',
    desc: '領地を統べる本格的な帰還拠点',
    wood: 42,
    ore: 48,
    seconds: 150,
    rank: 6,
    scale: '超巨大',
  },
  {
    id: 'demon-castle',
    name: '魔王城',
    desc: '配下攻撃を35%高める最終帰還拠点',
    wood: 90,
    ore: 110,
    seconds: 240,
    rank: 7,
    scale: '魔王級',
  },
];
const buildingOf = (id: BuildingKind) =>
  BUILDINGS.find((building) => building.id === id)!;
const aptitudeFor = (mob: Mob): Record<MinionTask, number> => {
  const kind = mob.kind || 'imp',
    base = 1 + mob.tier,
    aptitudes = Object.fromEntries(
      MINION_TASKS.map((task) => [task.id, base]),
    ) as Record<MinionTask, number>,
    boosts: Record<MonsterKind, MinionTask[]> = {
      imp: ['build', 'gather', 'scout'],
      beast: ['combat', 'guard', 'scout'],
      insect: ['gather', 'mine', 'haul'],
      golem: ['build', 'mine', 'haul'],
      flying: ['scout', 'haul', 'guard'],
      plant: ['gather', 'research', 'build'],
      slime: ['haul', 'research', 'gather'],
      armored: ['combat', 'guard', 'smith'],
      aberration: ['research', 'scout', 'combat'],
    };
  boosts[kind].forEach((task, index) => {
    aptitudes[task] +=
      3 + mob.tier + (index === (mob.variant || 0) % 3 ? 2 : 0);
  });
  return aptitudes;
};
const minionFrom = (
  mob: Mob,
  assignment: MinionTask = 'combat',
): MinionUnit => ({
  id: mob.id,
  name: mob.name,
  kind: mob.kind || 'imp',
  tier: mob.tier,
  commanderId: mob.commanderId,
  assignment,
  aptitudes: aptitudeFor(mob),
});
const taskPower = (world: World, task: MinionTask) =>
  world.roster
    .filter((unit) => unit.assignment === task)
    .reduce((total, unit) => total + unit.aptitudes[task], 0);
const STAT_INFO: { id: StatKey; name: string; desc: string }[] = [
  { id: 'life', name: '生命', desc: '最大HP +12' },
  { id: 'strength', name: '力', desc: '物理攻撃力 +3' },
  { id: 'defense', name: '耐久', desc: '被ダメージ軽減' },
  { id: 'magic', name: '魔力', desc: '魔法・範囲威力' },
  { id: 'agility', name: '敏捷', desc: '移動・攻撃速度' },
  { id: 'stamina', name: '持久', desc: '自領での自然回復' },
  { id: 'leadership', name: '統率', desc: '配下攻撃・勧誘力' },
];
const JOBS: Job[] = [
  {
    id: 'blade',
    name: '魔剣士',
    weapon: '魔剣',
    style: '近接と魔法を切り替える万能型',
    color: '#a873ed',
    tier: 'base',
    power: 1.08,
    magic: 0.8,
    speed: 1,
    range: 1.05,
    minion: 1,
    bonus: { strength: 2, magic: 2 },
    skills: [
      {
        id: 'flame-edge',
        name: '魔炎斬',
        desc: '攻撃に魔力を追加',
        level: 1,
        cost: 1,
      },
      {
        id: 'dark-wave',
        name: '闇の波動',
        desc: '攻撃範囲が拡大',
        level: 3,
        cost: 2,
      },
      {
        id: 'resonance',
        name: '魔剣共鳴',
        desc: '物理と魔法を相互強化',
        level: 6,
        cost: 3,
      },
    ],
  },
  {
    id: 'berserker',
    name: '狂戦士',
    weapon: '大剣・戦斧',
    style: '一撃の威力を極めるパワー型',
    color: '#ef684f',
    tier: 'base',
    power: 1.38,
    magic: 0.1,
    speed: 0.82,
    range: 1.15,
    minion: 0.8,
    bonus: { life: 2, strength: 4 },
    skills: [
      {
        id: 'rage',
        name: '血の狂乱',
        desc: 'HP減少時に威力上昇',
        level: 1,
        cost: 1,
      },
      {
        id: 'crusher',
        name: '大地砕き',
        desc: '重撃で強敵へ追加威力',
        level: 3,
        cost: 2,
      },
      {
        id: 'undying',
        name: '不死の執念',
        desc: '致命傷を一度耐える',
        level: 6,
        cost: 3,
      },
    ],
  },
  {
    id: 'mage',
    name: '魔術師',
    weapon: '魔杖',
    style: '遠距離と範囲魔法で制圧',
    color: '#6f8cff',
    tier: 'base',
    power: 0.62,
    magic: 1.65,
    speed: 0.92,
    range: 1.75,
    minion: 0.9,
    bonus: { magic: 5, stamina: 1 },
    skills: [
      { id: 'bolt', name: '魔弾', desc: '遠距離攻撃を強化', level: 1, cost: 1 },
      {
        id: 'nova',
        name: '冥界ノヴァ',
        desc: '周囲の敵へ範囲ダメージ',
        level: 3,
        cost: 2,
      },
      {
        id: 'meteor',
        name: '魔星落とし',
        desc: '強敵へ大魔法を放つ',
        level: 6,
        cost: 3,
      },
    ],
  },
  {
    id: 'shadow',
    name: '影魔',
    weapon: '双短剣',
    style: '高速移動と連撃で翻弄',
    color: '#5ee1cf',
    tier: 'base',
    power: 0.88,
    magic: 0.35,
    speed: 1.42,
    range: 0.85,
    minion: 0.9,
    bonus: { agility: 5, strength: 1 },
    skills: [
      {
        id: 'double',
        name: '影連斬',
        desc: '確率で二連続攻撃',
        level: 1,
        cost: 1,
      },
      {
        id: 'step',
        name: '虚影歩',
        desc: '移動速度をさらに強化',
        level: 3,
        cost: 2,
      },
      {
        id: 'assassin',
        name: '暗殺刻印',
        desc: '弱った敵へ大ダメージ',
        level: 6,
        cost: 3,
      },
    ],
  },
  {
    id: 'lancer',
    name: '魔槍士',
    weapon: '長槍',
    style: '長い間合いと突進力を両立',
    color: '#e5b85c',
    tier: 'base',
    power: 1.12,
    magic: 0.25,
    speed: 1.15,
    range: 1.48,
    minion: 1,
    bonus: { strength: 2, agility: 3 },
    skills: [
      {
        id: 'thrust',
        name: '魔槍突き',
        desc: '攻撃距離を延長',
        level: 1,
        cost: 1,
      },
      {
        id: 'charge',
        name: '黒風突進',
        desc: '移動中の威力上昇',
        level: 3,
        cost: 2,
      },
      {
        id: 'dragon',
        name: '竜穿槍',
        desc: '強敵の防御を貫通',
        level: 6,
        cost: 3,
      },
    ],
  },
  {
    id: 'ruler',
    name: '支配者',
    weapon: '支配器',
    style: '配下の指揮と強化に特化',
    color: '#f093bd',
    tier: 'base',
    power: 0.72,
    magic: 0.7,
    speed: 0.95,
    range: 1.12,
    minion: 2.2,
    bonus: { leadership: 5, magic: 1 },
    skills: [
      {
        id: 'command',
        name: '進軍命令',
        desc: '配下の攻撃力を強化',
        level: 1,
        cost: 1,
      },
      {
        id: 'dominate',
        name: '絶対服従',
        desc: '魔物を勧誘しやすくする',
        level: 3,
        cost: 2,
      },
      {
        id: 'legion',
        name: '魔王軍陣',
        desc: '配下数に応じて自身も強化',
        level: 6,
        cost: 3,
      },
    ],
  },
  {
    id: 'warlock',
    name: '魔装覇王',
    weapon: '覇王魔装',
    style: '狂戦士の破壊力と支配者の軍勢を融合',
    color: '#ff835d',
    tier: 'advanced',
    requires: ['berserker', 'ruler'],
    power: 1.55,
    magic: 0.7,
    speed: 1.02,
    range: 1.25,
    minion: 1.8,
    bonus: { life: 4, strength: 5, leadership: 3 },
    skills: [
      {
        id: 'tyrant',
        name: '暴君覚醒',
        desc: '自身と配下を同時強化',
        level: 1,
        cost: 2,
      },
      {
        id: 'warcry',
        name: '覇王号令',
        desc: '広範囲へ衝撃波を放つ',
        level: 4,
        cost: 3,
      },
      {
        id: 'overlord',
        name: '魔装解放',
        desc: '全能力を一時的に増幅',
        level: 8,
        cost: 4,
      },
    ],
  },
  {
    id: 'nightseer',
    name: '冥影賢者',
    weapon: '影魔杖',
    style: '魔術師の範囲魔法と影魔の速度を融合',
    color: '#77a7ff',
    tier: 'advanced',
    requires: ['mage', 'shadow'],
    power: 0.95,
    magic: 1.85,
    speed: 1.35,
    range: 1.85,
    minion: 1,
    bonus: { magic: 6, agility: 5 },
    skills: [
      {
        id: 'blink',
        name: '冥界転移',
        desc: '回避距離と魔力を強化',
        level: 1,
        cost: 2,
      },
      {
        id: 'shade-nova',
        name: '影星ノヴァ',
        desc: '移動しながら範囲攻撃',
        level: 4,
        cost: 3,
      },
      {
        id: 'eclipse',
        name: '終夜蝕',
        desc: '広域を闇で制圧',
        level: 8,
        cost: 4,
      },
    ],
  },
  {
    id: 'dragoon',
    name: '魔竜剣槍士',
    weapon: '魔竜剣槍',
    style: '魔剣と長槍を切り替える複合近接職',
    color: '#e6c36b',
    tier: 'advanced',
    requires: ['blade', 'lancer'],
    power: 1.35,
    magic: 0.85,
    speed: 1.22,
    range: 1.55,
    minion: 1,
    bonus: { strength: 4, magic: 3, agility: 3 },
    skills: [
      {
        id: 'swap',
        name: '剣槍転式',
        desc: '間合いで武器を自動切替',
        level: 1,
        cost: 2,
      },
      {
        id: 'dragon-wave',
        name: '魔竜波',
        desc: '突進と魔法斬撃を連結',
        level: 4,
        cost: 3,
      },
      {
        id: 'dragon-soul',
        name: '竜魔魂',
        desc: '連撃ごとに威力上昇',
        level: 8,
        cost: 4,
      },
    ],
  },
];
type Milestone = { level: number; skills: JobSkill[] };
const MILESTONE_NAMES: Record<string, string[]> = {
  blade: ['魔力装甲', '吸魂剣', '深紅の剣界', '月蝕斬'],
  berserker: ['粉砕衝動', '血肉再生', '巨神の一撃', '絶命狂化'],
  mage: ['連鎖魔弾', '魔力障壁', '虚無爆発', '禁呪増幅'],
  shadow: ['残影分身', '毒刃刻印', '無音暗殺', '千影乱舞'],
  lancer: ['旋回槍陣', '雷光突き', '天穿撃', '竜騎疾走'],
  ruler: ['軍勢鼓舞', '魂の徴税', '絶対指揮', '王威結界'],
  warlock: ['覇軍粉砕', '暴君再生', '魔王軍突撃', '終焉魔装'],
  nightseer: ['影魔障壁', '転移魔弾', '夜天崩落', '無限残像'],
  dragoon: ['剣槍連環', '竜鱗守護', '天魔穿孔', '双極解放'],
};
const milestonesFor = (jobId: string): Milestone[] => {
  let names = MILESTONE_NAMES[jobId] || [
    '覚醒攻撃',
    '覚醒防御',
    '奥義・破',
    '奥義・守',
  ];
  return [
    {
      level: 4,
      skills: [
        {
          id: jobId + '-m4a',
          name: names[0],
          desc: '攻撃系統を伸ばす節目スキル',
          level: 4,
          cost: 2,
        },
        {
          id: jobId + '-m4b',
          name: names[1],
          desc: '生存・補助系統を伸ばす節目スキル',
          level: 4,
          cost: 2,
        },
      ],
    },
    {
      level: 8,
      skills: [
        {
          id: jobId + '-m8a',
          name: names[2],
          desc: '高威力の奥義系統へ進む',
          level: 8,
          cost: 3,
        },
        {
          id: jobId + '-m8b',
          name: names[3],
          desc: '特殊戦術の奥義系統へ進む',
          level: 8,
          cost: 3,
        },
      ],
    },
  ];
};
const ownerOf = (w: World, r: Region): Owner => territoryOwner(w, r);
const jobOf = (w: World) => JOBS.find((j) => j.id === w.job) || JOBS[0];
const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const MONSTER_BEHAVIOR: Record<
  MonsterKind,
  {
    speed: number;
    reach: number;
    detect: number;
    attack: number;
    cooldown: number;
    wander: number;
  }
> = {
  imp: {
    speed: 76,
    reach: 42,
    detect: 230,
    attack: 0.64,
    cooldown: 0.92,
    wander: 18,
  },
  beast: {
    speed: 92,
    reach: 55,
    detect: 310,
    attack: 0.76,
    cooldown: 1.08,
    wander: 22,
  },
  insect: {
    speed: 84,
    reach: 48,
    detect: 275,
    attack: 0.68,
    cooldown: 0.88,
    wander: 26,
  },
  golem: {
    speed: 31,
    reach: 74,
    detect: 245,
    attack: 1.34,
    cooldown: 1.9,
    wander: 5,
  },
  flying: {
    speed: 78,
    reach: 68,
    detect: 340,
    attack: 0.92,
    cooldown: 1.3,
    wander: 20,
  },
  plant: {
    speed: 10,
    reach: 128,
    detect: 260,
    attack: 1.18,
    cooldown: 1.65,
    wander: 0,
  },
  slime: {
    speed: 38,
    reach: 44,
    detect: 195,
    attack: 0.9,
    cooldown: 1.35,
    wander: 7,
  },
  armored: {
    speed: 34,
    reach: 72,
    detect: 250,
    attack: 1.2,
    cooldown: 1.72,
    wander: 6,
  },
  aberration: {
    speed: 48,
    reach: 138,
    detect: 360,
    attack: 1.28,
    cooldown: 1.58,
    wander: 11,
  },
};
const behaviorOf = (mob: Mob) => MONSTER_BEHAVIOR[mob.kind || 'imp'];
type MonsterSpecies = { name: string; kind: MonsterKind };
const MONSTER_ECOLOGY: Record<string, MonsterSpecies[]> = {
  廃墟: [
    { name: '瓦礫喰いスライム', kind: 'slime' },
    { name: '片翼の灰インプ', kind: 'imp' },
    { name: '墓石甲虫', kind: 'insect' },
    { name: '漂う怨眼', kind: 'aberration' },
  ],
  森: [
    { name: '毒牙ムーンウルフ', kind: 'beast' },
    { name: '根歩きマンドラゴラ', kind: 'plant' },
    { name: '鎌羽モス', kind: 'flying' },
    { name: '樹液鎧カブト', kind: 'insect' },
  ],
  岩山: [
    { name: '断崖ストーンゴーレム', kind: 'golem' },
    { name: '骸骨山ヤギ魔獣', kind: 'beast' },
    { name: '裂岩ワーム', kind: 'insect' },
    { name: '白翼ガーゴイル', kind: 'flying' },
  ],
  砦: [
    { name: '黒曜殻センチネル', kind: 'armored' },
    { name: '城壁喰いゴーレム', kind: 'golem' },
    { name: '鉄顎ハウンド', kind: 'beast' },
    { name: '鎖脚スカラベ', kind: 'insect' },
  ],
  塔: [
    { name: '灰翼ヴォイドレイ', kind: 'flying' },
    { name: '多眼の魔力核', kind: 'aberration' },
    { name: '封印液スライム', kind: 'slime' },
    { name: '塔守りルーンゴーレム', kind: 'golem' },
  ],
  荒野: [
    { name: '砂走り六脚獣', kind: 'beast' },
    { name: '赤錆甲殻ワーム', kind: 'insect' },
    { name: '巨顎デザートハウンド', kind: 'beast' },
    { name: '風葬いハゲタカ魔', kind: 'flying' },
  ],
  魔族集落: [
    { name: '家畜喰い小鬼', kind: 'imp' },
    { name: '角笛鎧の番獣', kind: 'armored' },
    { name: '屋根這い羽虫', kind: 'flying' },
    { name: '魔力排水スライム', kind: 'slime' },
  ],
  洞窟: [
    { name: '天井這い大蝙蝠', kind: 'flying' },
    { name: '紫晶ゴーレム', kind: 'golem' },
    { name: '地底百足', kind: 'insect' },
    { name: '深淵粘体', kind: 'slime' },
  ],
  火山: [
    { name: '溶岩サラマンダー', kind: 'beast' },
    { name: '火口殻ゴーレム', kind: 'golem' },
    { name: '爆炎羽トカゲ', kind: 'flying' },
    { name: '煮え血スライム', kind: 'slime' },
  ],
  城: [
    { name: '魔城の重殻騎獣', kind: 'armored' },
    { name: '王眼キメラ', kind: 'aberration' },
    { name: '断頭翼ガーゴイル', kind: 'flying' },
    { name: '城壁融合ゴーレム', kind: 'golem' },
  ],
};
const TERRITORY_LORDS: Record<string, MonsterSpecies> = {
  forest: { name: '千年喰いの歩行魔樹', kind: 'plant' },
  mountain: { name: '連峰を背負う骸晶巨像', kind: 'golem' },
  citadel: { name: '黒曜百腕城塞獣', kind: 'armored' },
  ashland: { name: '灰冠の六翼魔眼', kind: 'aberration' },
  waste: { name: '赤砂を泳ぐ大顎王', kind: 'beast' },
  village: { name: '角笛都市の鎧殻女王', kind: 'insect' },
  cave: { name: '深淵天蓋の晶翼蝙蝠', kind: 'flying' },
  volcano: { name: '火山核を抱く溶岩巨神', kind: 'golem' },
  castle: { name: '封印王城の混成魔獣', kind: 'aberration' },
};
const spawn = (): Mob[] =>
  REGIONS.flatMap((region, regionIndex) =>
    Array.from({ length: 32 }, (_, i) => {
      const tier = Math.min(
        6,
        1 + Math.floor(regionIndex / 2) + (i % 3 === 2 ? 1 : 0),
      );
      const species = (MONSTER_ECOLOGY[region.biome] ||
          MONSTER_ECOLOGY['廃墟'])[i % 4],
        packIndex = Math.floor(i / 4),
        member = i % 4,
        site = sitesIn(region.id)[packIndex],
        packAngle = member * 2.35 + packIndex * 0.4,
        packRadius = encounterPackRadius(site.kind, member),
        hp = (30 + tier * 22) * (i === 31 ? 2.2 : 1),
        x = site.x + Math.cos(packAngle) * packRadius,
        y = site.y + Math.sin(packAngle) * packRadius;
      return {
        id: regionIndex * 100 + i + 1,
        x,
        y,
        anchorX: x,
        anchorY: y,
        rare: i === 31,
        patrol:
          site.kind === 'cave'
            ? 'ambush'
            : site.kind === 'nest' || site.kind === 'outpost'
              ? 'sentinel'
              : 'roam',
        name:
          i === 31
            ? '希少種 ' + species.name
            : member === 0
              ? '群れ長 ' + species.name
              : species.name,
        kind: species.kind,
        variant: (regionIndex * 3 + i) % 5,
        commanderId:
          member > 0 ? regionIndex * 100 + packIndex * 4 + 1 : undefined,
        tier,
        hp,
        max: hp,
        home: region.id,
      };
    }),
  );
const resources = (): Node[] =>
  DISCOVERY_SITES.flatMap((site, si) =>
    Array.from({ length: site.kind === 'quarry' ? 18 : 8 }, (_, i) => ({
      id: si * 30 + i,
      x: site.x + Math.cos(i * 2.4) * (65 + (i % 5) * 48),
      y: site.y + Math.sin(i * 2.4) * (65 + (i % 5) * 48),
      kind: i % 2 ? ('wood' as const) : ('ore' as const),
      n: site.kind === 'quarry' ? 9 : 4,
    })),
  );
const baseStats = (): Stats => ({
  life: 1,
  strength: 1,
  defense: 1,
  magic: 1,
  agility: 1,
  stamina: 1,
  leadership: 1,
});
const fresh = (): World => ({
  ...initialHoldings(),
  tutorial: newTutorial(),
  preferences: { ...DEFAULT_PREFERENCES },
  talkedSites: [],
  activatedSites: [],
  rumoredSites: [],
  waypoint: null,
  worldTime: 0,
  inventory: [
    { id: 'potion', count: 2 },
    { id: 'elixir', count: 1 },
  ],
  equipment: emptyEquipment(),
  loot: DISCOVERY_SITES.filter((site) =>
    ['camp', 'cave', 'ruin', 'outpost', 'shrine'].includes(site.kind),
  ).map((site, index) => ({
    id: index + 1,
    x: site.x + 42,
    y: site.y + 55,
    item:
      site.kind === 'camp'
        ? 'potion'
        : site.kind === 'shrine'
          ? 'ember-gem'
          : lootFor(
              REGIONS.findIndex((r) => r.id === site.region),
              index,
              'blade',
            ),
    count: 1,
    chest: true,
    claimed: false,
  })),
  lootSequence: 1000,
  x: 1024,
  y: 1180,
  hp: 100,
  maxHp: 100,
  xp: 0,
  lv: 1,
  rank: 0,
  job: '',
  skillPoints: 0,
  stats: baseStats(),
  unlocked: [],
  weaponLevel: 1,
  careers: {},
  energy: 100,
  maxEnergy: 100,
  guarding: false,
  autoRun: false,
  dodgeCd: 0,
  dodgeTime: 0,
  skillCd: 0,
  heavyCd: 0,
  attackAnim: 0,
  attackTotal: 0.62,
  attackKind: 'none',
  hitAnim: 0,
  respawnGrace: 0,
  buildAnim: 0,
  buildMode: false,
  buildYaw: 0,
  selectedBuilding: 'hideout',
  bases: [
    {
      id: 1,
      x: 760,
      y: 1040,
      yaw: 0,
      level: 1,
      kind: 'hideout',
      name: '始まりの隠れ家',
      progress: 1,
      duration: 1,
      complete: true,
      workers: 0,
    },
  ],
  roster: [],
  recruitRefusals: 0,
  workClock: 0,
  forgeProgress: 0,
  researchProgress: 0,
  scoutProgress: 0,
  pendingHits: [],
  facingX: 0,
  facingY: 1,
  viewYaw: 0,
  viewPitch: 0,
  height: 0,
  velocityY: 0,
  grounded: true,
  wood: 6,
  ore: 6,
  minions: 0,
  base: 1,
  kills: 0,
  bossKills: 0,
  achievements: 0,
  mobs: spawn(),
  nodes: resources(),
  discovered: ['ruins'],
  discoveredSites: [],
  message: '職業を選び、魔王への一歩を踏み出せ。',
  banner: '敵領土',
  bannerTime: 2,
  region: 'ruins',
  cd: 0,
});
const requirement = (w: World) =>
  [
    '開始ランク',
    'Lv.2・敵撃破2・地域発見2',
    'Lv.3・配下1・実績1',
    'Lv.4・拠点Lv.2・敵撃破6',
    'Lv.5・領土2・配下2・強敵撃破1',
    'Lv.7・領土3・配下4・実績4',
    'Lv.9・領土5・強敵撃破3・実績6',
    'Lv.10以上・領土7・配下6・強敵撃破5・拠点Lv.5',
  ][Math.min(w.rank + 1, 7)];
const canRank = (w: World) => {
  if (w.rank === 0)
    return w.lv >= 2 && w.kills >= 2 && w.discovered.length >= 2;
  if (w.rank === 1) return w.lv >= 3 && w.minions >= 1 && w.achievements >= 1;
  if (w.rank === 2) return w.lv >= 4 && w.base >= 2 && w.kills >= 6;
  if (w.rank === 3)
    return w.lv >= 5 && w.lands >= 2 && w.minions >= 2 && w.bossKills >= 1;
  if (w.rank === 4)
    return w.lv >= 7 && w.lands >= 3 && w.minions >= 4 && w.achievements >= 4;
  if (w.rank === 5)
    return w.lv >= 9 && w.lands >= 5 && w.bossKills >= 3 && w.achievements >= 6;
  if (w.rank === 6)
    return (
      w.lv >= 10 &&
      w.lands >= 7 &&
      w.minions >= 6 &&
      w.bossKills >= 5 &&
      w.base >= 5
    );
  return false;
};
const snapshotCareer = (w: World): Career => ({
  lv: w.lv,
  xp: w.xp,
  skillPoints: w.skillPoints,
  stats: { ...w.stats },
  unlocked: [...w.unlocked],
  weaponLevel: w.weaponLevel,
});
const careerLevel = (w: World, id: string) =>
  w.job === id ? w.lv : w.careers[id]?.lv || 0;
const jobUnlocked = (w: World, j: Job) =>
  j.tier === 'base' ||
  (j.requires || []).every((id) => careerLevel(w, id) >= 6);
const newCareer = (j: Job): Career => {
  let stats = baseStats();
  Object.entries(j.bonus).forEach(
    ([key, value]) => (stats[key as StatKey] += value || 0),
  );
  return {
    lv: 1,
    xp: 0,
    skillPoints: j.tier === 'advanced' ? 3 : 1,
    stats,
    unlocked: [],
    weaponLevel: 1,
  };
};
const applyCareer = (w: World, id: string, c: Career) => {
  w.job = id;
  w.lv = c.lv;
  w.xp = c.xp;
  w.skillPoints = c.skillPoints;
  w.stats = { ...c.stats };
  w.unlocked = [...c.unlocked];
  w.weaponLevel = c.weaponLevel;
  // Old equipment stays owned, but a new profession starts with its own F weapon.
  const starter = weaponFor(id, 0);
  if (!w.inventory.some((stack) => stack.id === starter))
    receiveItem(w, starter);
  w.equipment.weapon = starter;
  w.maxHp =
    100 +
    w.stats.life * 12 +
    (w.lv - 1) * 8 +
    w.base * 12 +
    equipmentBonus(w.equipment, id).life;
  w.hp = w.maxHp;
  w.energy = w.maxEnergy;
};

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null),
    game = useRef(fresh()),
    keys = useRef<Record<string, boolean>>({}),
    stick = useRef({ x: 0, y: 0, on: false }),
    touchInput = useRef(false),
    joystickPointer = useRef<number | null>(null),
    lookTouch = useRef({ id: -1, x: 0, y: 0 }),
    bindingsRef = useRef({ ...DEFAULT_BINDINGS }),
    listeningRef = useRef<BindingAction | null>(null),
    menuOpenRef = useRef(false),
    quickMenuRef = useRef<string | null>(null),
    [hud, setHud] = useState<World>(fresh),
    [mapOpen, setMapOpen] = useState(false),
    [rankOpen, setRankOpen] = useState(false),
    [growthOpen, setGrowthOpen] = useState(false),
    [transferOpen, setTransferOpen] = useState(false),
    [controlsOpen, setControlsOpen] = useState(false),
    [minionOpen, setMinionOpen] = useState(false),
    [buildMenuOpen, setBuildMenuOpen] = useState(false),
    [inventoryOpen, setInventoryOpen] = useState(false),
    [adventureOpen, setAdventureOpen] = useState(false),
    [guideOpen, setGuideOpen] = useState(false),
    [renderPerformance, setRenderPerformance] =
      useState<RenderPerformance | null>(null),
    [pointerLocked, setPointerLocked] = useState(false),
    [dragLookOnly, setDragLookOnly] = useState(false),
    [rankEvolution, setRankEvolution] = useState<number | null>(null),
    [rendererReady, setRendererReady] = useState(false),
    [bindings, setBindings] = useState({ ...DEFAULT_BINDINGS }),
    [listening, setListening] = useState<BindingAction | null>(null),
    [touchAim, setTouchAim] = useState(false);
  const rendererEnabled = !!hud.job;
  const sync = useCallback(
    () =>
      setHud({
        ...game.current,
        tutorial: {
          ...game.current.tutorial,
          completed: [...game.current.tutorial.completed],
        },
        stats: { ...game.current.stats },
        inventory: (game.current.inventory || []).map((stack) => ({
          ...stack,
        })),
        equipment: { ...(game.current.equipment || emptyEquipment()) },
        loot: [...(game.current.loot || [])],
        unlocked: [...game.current.unlocked],
        careers: { ...game.current.careers },
        mobs: [...game.current.mobs],
        nodes: [...game.current.nodes],
        bases: game.current.bases.map((base) => ({ ...base })),
        roster: game.current.roster.map((unit) => ({
          ...unit,
          aptitudes: { ...unit.aptitudes },
        })),
        pendingHits: [...game.current.pendingHits],
        discovered: [...game.current.discovered],
        discoveredSites: [...(game.current.discoveredSites || [])],
        talkedSites: [...(game.current.talkedSites || [])],
        activatedSites: [...(game.current.activatedSites || [])],
        rumoredSites: [...(game.current.rumoredSites || [])],
        conquered: [...game.current.conquered],
      }),
    [],
  );
  const say = (s: string) => {
    game.current.message = s;
    sync();
  };
  const changePreferences = (value: GamePreferences) => {
    game.current.preferences = sanitizePreferences(value);
    try {
      localStorage.setItem(
        'makai-preferences',
        JSON.stringify(game.current.preferences),
      );
    } catch {
      /* Device-local preferences remain usable without storage. */
    }
    sync();
  };
  useEffect(() => {
    try {
      const saved = localStorage.getItem('makai-preferences');
      if (saved)
        game.current.preferences = sanitizePreferences(JSON.parse(saved));
    } catch {
      game.current.preferences = { ...DEFAULT_PREFERENCES };
    }
    sync();
  }, [sync]);
  useEffect(() => {
    quickMenuRef.current = inventoryOpen ? 'inventory' : mapOpen ? 'map' : null;
    if (!controlsOpen) {
      listeningRef.current = null;
      setListening(null);
    }
    menuOpenRef.current =
      mapOpen ||
      rankOpen ||
      growthOpen ||
      transferOpen ||
      controlsOpen ||
      minionOpen ||
      buildMenuOpen ||
      inventoryOpen ||
      adventureOpen ||
      guideOpen;
    if (
      inventoryOpen &&
      game.current.job &&
      completeLesson(game.current.tutorial, 'inventory')
    )
      sync();
    if (menuOpenRef.current) {
      keys.current = {};
      stick.current = { x: 0, y: 0, on: false };
      lookTouch.current.id = -1;
      game.current.guarding = false;
      game.current.autoRun = false;
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [
    mapOpen,
    rankOpen,
    growthOpen,
    transferOpen,
    controlsOpen,
    minionOpen,
    buildMenuOpen,
    inventoryOpen,
    adventureOpen,
    guideOpen,
    sync,
  ]);
  const openScreen = (screen: GameScreen) => {
    setAdventureOpen(false);
    setInventoryOpen(screen === 'inventory');
    setMapOpen(screen === 'map');
    setGrowthOpen(screen === 'growth');
    setRankOpen(screen === 'rank');
    setMinionOpen(screen === 'minions');
    setBuildMenuOpen(screen === 'build');
    setTransferOpen(screen === 'transfer');
    setControlsOpen(screen === 'settings');
    setGuideOpen(screen === 'guide');
  };
  const inventoryAction = (
    action: 'equip' | 'use' | 'discard' | 'exchange',
    id: string,
  ) => {
    const w = game.current;
    say(
      {
        equip: equipItem,
        use: consumeItem,
        discard: discardItem,
        exchange: exchangeItem,
      }[action](w, id),
    );
  };
  const setWaypoint = (target: Waypoint | null) => {
    game.current.waypoint = target;
    if (target) completeLesson(game.current.tutorial, 'map');
    say(
      target
        ? `目的地を「${target.name}」に設定。矢印と距離を目印に歩こう。`
        : '目的地を解除した。',
    );
  };
  const targetsAhead = (
    w: World,
    range: number,
    cone = touchInput.current ? 0.24 : 0.42,
  ) =>
    w.mobs
      .filter((mob) => {
        if (mob.ally || mob.dead) return false;
        const distance = d(w, mob) || 1;
        const aim =
          ((mob.x - w.x) * w.facingX + (mob.y - w.y) * w.facingY) / distance;
        return (
          distance < range &&
          aim > cone &&
          clearBuildingSight(w, mob, w.bases, w.height + 0.9)
        );
      })
      .sort((a, b) => d(w, a) - d(w, b));
  const jump = () => {
    const w = game.current;
    if (!w.job || !w.grounded) return;
    w.velocityY = 6.2;
    w.grounded = false;
  };
  const changeBinding = (action: BindingAction, key: string) => {
    const next = { ...bindingsRef.current, [action]: key };
    bindingsRef.current = next;
    setBindings(next);
    listeningRef.current = null;
    setListening(null);
    localStorage.setItem('makai-key-bindings', JSON.stringify(next));
  };
  const chooseJob = (id: string) => {
    let w = game.current,
      j = JOBS.find((x) => x.id === id);
    if (!j || j.tier !== 'base') return;
    let career = newCareer(j);
    applyCareer(w, id, career);
    w.message = j.name + 'として目覚めた。武器「' + j.weapon + '」を手にした！';
    sync();
  };
  const changeJob = (id: string) => {
    let w = game.current,
      j = JOBS.find((x) => x.id === id);
    if (!j || id === w.job) return;
    if (!jobUnlocked(w, j))
      return say('必要職業をLv.6まで育成すると解放される。');
    let known = !!w.careers[id],
      cost = 3 + Object.keys(w.careers).length;
    if (!known && (w.wood < cost || w.ore < cost))
      return say('新職への転職には魔木・瘴気鉱 各' + cost + 'が必要。');
    if (w.job) w.careers[w.job] = snapshotCareer(w);
    if (!known) {
      w.wood -= cost;
      w.ore -= cost;
    }
    let career = w.careers[id] || newCareer(j);
    applyCareer(w, id, career);
    w.message =
      j.name +
      'へ転職。' +
      (known
        ? '以前の職業進行を復元した。'
        : 'Lv.1・武器Lv.1から再修行が始まる。');
    setTransferOpen(false);
    sync();
  };
  const upgradeWeapon = () => {
    let w = game.current,
      cost = w.weaponLevel + 2;
    if (w.wood < cost || w.ore < cost)
      return say('武器強化には魔木・瘴気鉱 各' + cost + 'が必要。');
    w.wood -= cost;
    w.ore -= cost;
    w.weaponLevel++;
    const forged = weaponFor(w.job, Math.min(3, Math.floor(w.rank / 2)));
    receiveItem(w, forged);
    w.message =
      jobOf(w).weapon +
      'をLv.' +
      w.weaponLevel +
      'へ強化！ ' +
      itemOf(forged).name +
      'を持ち物に追加。';
    sync();
  };
  const gain = (n: number) => {
    let w = game.current;
    if (w.lv >= 99) {
      w.xp = 0;
      return;
    }
    w.xp += n;
    while (w.lv < 99 && w.xp >= w.lv * 34) {
      w.xp -= w.lv * 34;
      w.lv++;
      w.skillPoints += 3;
      w.maxHp += 8;
      w.hp = w.maxHp;
      w.achievements++;
      w.message =
        w.lv === 4 || w.lv === 8
          ? 'Lv.' + w.lv + 'の節目！ 二択スキルを無料で1つ選べる。'
          : 'Lv.' + w.lv + '！ スキルポイントを3獲得。';
    }
    if (w.lv >= 99) w.xp = 0;
  };
  const queueHit = (
    w: World,
    t: Mob,
    damage: number,
    delay: number,
    knockback = 0,
  ) => w.pendingHits.push({ target: t.id, damage, delay, knockback });
  const defeat = (w: World, t: Mob) => {
    if (t.dead) return;
    completeLesson(w.tutorial, 'battle');
    t.dead = true;
    t.deathAnim = 1.15;
    t.hitAnim = 0.32;
    const dropped = lootFor(t.tier, t.id + w.kills, w.job, !!t.boss);
    w.loot.push({
      id: ++w.lootSequence,
      x: t.x,
      y: t.y,
      item: dropped,
      count: t.rare ? 2 : 1,
      chest: false,
      claimed: false,
    });
    w.kills++;
    if (t.boss) {
      gain(80 + t.tier * 20);
      w.bossKills++;
      conquerTerritory(w, t.home);
      if (w.region === t.home) {
        w.banner = '領土獲得';
        w.bannerTime = 3;
      }
      w.achievements++;
      w.message =
        t.name + 'を撃破！ ' + regionAt(t.x, t.y).name + 'を領土にした。';
    } else {
      t.recruitTime = RECRUIT_WINDOW_SECONDS;
      w.ore++;
      gain(12 + t.tier * 5);
      const followers = w.mobs.filter(
        (mob) => mob.commanderId === t.id && !mob.ally,
      ).length;
      w.message =
        t.name +
        `を撃破。${RECRUIT_WINDOW_SECONDS}秒以内なら服従を試みられる。` +
        (followers ? ` この隊長には配下が${followers}体いる。` : '');
    }
  };
  const attack = () => {
    let w = game.current;
    if (!w.job) return say('先に職業を選択しよう。');
    if (w.cd > 0 || w.guarding) return;
    let j = jobOf(w),
      range =
        100 *
        j.range *
        (w.unlocked.includes('dark-wave') || w.unlocked.includes('thrust')
          ? 1.18
          : 1),
      targets = targetsAhead(w, range),
      t = targets[0];
    w.cd = 0.38 / (j.speed * (1 + w.stats.agility * 0.025));
    w.attackTotal = 0.62;
    w.attackAnim = w.attackTotal;
    w.attackKind = 'normal';
    if (!t) return say('空振り。敵を正面と間合いに捉えよう。');
    let branchPower =
        1 + w.unlocked.filter((s) => s.endsWith('a')).length * 0.08,
      hit = Math.floor(
        (12 +
          w.lv * 4 +
          w.weaponLevel * 4 +
          w.stats.strength * 3 +
          equipmentBonus(w.equipment, w.job).attack +
          (w.stats.magic + equipmentBonus(w.equipment, w.job).magic) *
            4 *
            j.magic +
          w.minions *
            j.minion *
            (2 +
              (w.stats.leadership +
                equipmentBonus(w.equipment, w.job).leadership) *
                0.3)) *
          j.power *
          (1 + w.unlocked.length * 0.04) *
          branchPower,
      );
    if (
      w.job === 'berserker' &&
      w.unlocked.includes('rage') &&
      w.hp < w.maxHp / 2
    )
      hit = Math.floor(hit * 1.35);
    if (
      w.job === 'shadow' &&
      w.unlocked.includes('assassin') &&
      t.hp < t.max * 0.35
    )
      hit = Math.floor(hit * 1.6);
    if (w.job === 'ruler' && w.unlocked.includes('legion'))
      hit += w.minions * 5;
    queueHit(w, t, hit, 0.29);
    if (w.job === 'mage' && w.unlocked.includes('nova'))
      targets
        .slice(1, 4)
        .forEach((m) => queueHit(w, m, Math.floor(hit * 0.35), 0.32));
    if (w.job === 'shadow' && w.unlocked.includes('double'))
      queueHit(w, t, Math.floor(hit * 0.35), 0.39);
    w.message = j.name + 'が構え、' + j.weapon + 'で踏み込む！';
    sync();
  };
  const heavyAttack = () => {
    let w = game.current;
    if (!w.job) return;
    if (w.heavyCd > 0) return say('強攻撃の構え直し中。少し待とう。');
    if (w.energy < 28) return say('強攻撃にはスタミナ28が必要。');
    if (w.guarding) return say('防御を解いてから強攻撃しよう。');
    let j = jobOf(w),
      t = targetsAhead(w, 125 * j.range, 0.25)[0];
    w.energy -= 28;
    w.heavyCd = 1.1;
    w.attackTotal = 0.96;
    w.attackAnim = w.attackTotal;
    w.attackKind = 'heavy';
    if (!t)
      return say('強攻撃が空を切った。スタミナを回復して間合いを詰めよう。');
    let hit = Math.floor(
      (20 +
        w.lv * 6 +
        w.weaponLevel * 7 +
        w.stats.strength * 5 +
        equipmentBonus(w.equipment, w.job).attack * 1.5 +
        (w.stats.magic + equipmentBonus(w.equipment, w.job).magic) *
          3 *
          j.magic) *
        j.power *
        1.65,
    );
    if (w.unlocked.includes('crusher') && t.boss) hit = Math.floor(hit * 1.35);
    queueHit(w, t, hit, 0.51, 35);
    w.message = '重心を落とし、渾身の一撃を振りかぶる！';
    sync();
  };
  const dodge = () => {
    let w = game.current;
    if (!w.job) return;
    if (w.dodgeCd > 0) return say('回避の直後。次の踏み込みを待とう。');
    if (w.energy < 22) return say('回避にはスタミナ22が必要。');
    w.energy -= 22;
    w.dodgeCd = 0.82;
    w.dodgeTime = 0.48;
    Object.assign(
      w,
      moveAroundBuildings(
        w,
        { x: w.x + w.facingX * 95, y: w.y + w.facingY * 95 },
        w.bases,
        w.height,
      ),
    );
    w.message = '回避！ 身を沈めて攻撃をすり抜けた。';
    sync();
  };
  const useCombatSkill = () => {
    let w = game.current;
    if (!w.job) return;
    if (w.skillCd > 0)
      return say(`スキルはあと${Math.ceil(w.skillCd)}秒で使用可能。`);
    if (w.energy < 35) return say('スキルにはスタミナ35が必要。');
    if (w.guarding) return say('防御を解いてからスキルを使おう。');
    let j = jobOf(w),
      targets = targetsAhead(w, 155 * j.range, 0.05).slice(0, 6);
    let hit = Math.floor(
        (25 +
          w.lv * 5 +
          w.weaponLevel * 5 +
          (w.stats.magic + equipmentBonus(w.equipment, w.job).magic) * 7 +
          w.stats.strength * 3 +
          equipmentBonus(w.equipment, w.job).attack) *
          (0.7 + j.magic * 0.55),
      ),
      known = j.skills.find((s) => w.unlocked.includes(s.id));
    targets.forEach((t, i) => queueHit(w, t, hit, 0.45 + i * 0.025, 12));
    w.energy -= 35;
    w.skillCd = 3.2;
    w.attackTotal = 1.08;
    w.attackAnim = w.attackTotal;
    w.attackKind = 'skill';
    w.message = (known?.name || j.name + '固有技') + 'の魔力を全身に集める！';
    sync();
  };
  const recruit = () => {
    const w = game.current;
    if (!w.job) return say('先に職業を選択しよう。');
    const target = nearestRecruit(w, w.mobs);
    if (!target)
      return say(
        `倒した領土ボス以外の魔物へ近づき、${RECRUIT_WINDOW_SECONDS}秒以内に服従を命じよう。`,
      );
    const joined = recruitmentCohort(target, w.mobs),
      followers = joined.slice(1),
      playerMight =
        w.lv * 12 +
        w.rank * 22 +
        w.weaponLevel * 6 +
        (w.stats.leadership + equipmentBonus(w.equipment, w.job).leadership) *
          9 +
        (w.job === 'ruler' ? 20 : 0) +
        (w.unlocked.includes('dominate') ? 18 : 0),
      chance = recruitmentChance(
        playerMight,
        target.tier,
        followers.length,
        w.stats.leadership,
        w.recruitRefusals ?? 0,
      ),
      rawRoll =
        Math.sin(target.id * 12.9898 + w.kills * 7.233 + w.minions * 2.417) *
        43758.5453,
      roll = rawRoll - Math.floor(rawRoll);
    if (roll > chance) {
      target.recruitTime = 0;
      w.recruitRefusals = Math.min(
        MAX_RECRUIT_REFUSALS,
        (w.recruitRefusals ?? 0) + 1,
      );
      w.message = `${target.name}は服従を拒み、瘴気へ還った。成功率 ${Math.round(chance * 100)}%。次回の服従圧 +${Math.round(w.recruitRefusals * RECRUIT_REFUSAL_BONUS * 100)}%。`;
      sync();
      return;
    }
    const firstRecruitment = w.roster.length === 0;
    joined.forEach((mob, index) => {
      const assignment: MinionTask = index ? 'guard' : 'combat';
      mob.ally = true;
      mob.dead = false;
      mob.recruitTime = 0;
      mob.deathAnim = 0;
      mob.hp = Math.max(1, Math.floor(mob.max * (index ? 0.7 : 0.5)));
      mob.attackAnim = 0;
      mob.attackCd = 0;
      mob.assignment = assignment;
      if (!w.roster.some((unit) => unit.id === mob.id))
        w.roster.push(minionFrom(mob, assignment));
    });
    w.minions = w.roster.length;
    w.recruitRefusals = 0;
    completeLesson(w.tutorial, 'recruit');
    if (firstRecruitment && w.minions > 0) w.achievements++;
    w.message =
      target.name +
      'が服従した！ 成功率 ' +
      Math.round(chance * 100) +
      '%。' +
      (followers.length
        ? ` 隊長配下${followers.length}体も勢力へ加入。`
        : ' 配下名簿へ登録した。');
    sync();
  };
  const assignMinion = (id: number, assignment: MinionTask) => {
    const w = game.current,
      unit = w.roster.find((candidate) => candidate.id === id),
      mob = w.mobs.find((candidate) => candidate.id === id);
    if (!unit) return;
    unit.assignment = assignment;
    completeLesson(w.tutorial, 'order');
    if (mob) mob.assignment = assignment;
    w.message = `${unit.name}へ「${MINION_TASKS.find((task) => task.id === assignment)!.name}」を命令した。`;
    sync();
  };
  const allocate = (key: StatKey) => {
    let w = game.current;
    if (w.skillPoints < 1) return;
    w.skillPoints--;
    w.stats[key]++;
    if (key === 'life') {
      w.maxHp += 12;
      w.hp += 12;
    }
    w.message = STAT_INFO.find((s) => s.id === key)!.name + 'を強化した。';
    sync();
  };
  const learn = (skill: JobSkill) => {
    let w = game.current;
    if (w.unlocked.includes(skill.id)) return;
    if (w.lv < skill.level)
      return say('習得にはLv.' + skill.level + 'が必要。');
    if (w.skillPoints < skill.cost)
      return say('スキルポイントが' + skill.cost + '必要。');
    w.skillPoints -= skill.cost;
    w.unlocked.push(skill.id);
    w.message = '職業スキル「' + skill.name + '」を習得！';
    sync();
  };
  const learnMilestone = (group: Milestone, skill: JobSkill) => {
    let w = game.current;
    if (w.unlocked.includes(skill.id)) return;
    if (w.lv < group.level)
      return say('節目の選択はLv.' + group.level + 'で解放。');
    let already = group.skills.some((s) => w.unlocked.includes(s.id)),
      cost = already ? skill.cost : 0;
    if (w.skillPoints < cost)
      return say('選ばなかった節目スキルの追加習得には' + cost + ' SP必要。');
    w.skillPoints -= cost;
    w.unlocked.push(skill.id);
    w.message = already
      ? '節目スキル「' + skill.name + '」を追加習得！'
      : 'Lv.' + group.level + 'の節目で「' + skill.name + '」を選択！';
    sync();
  };
  const gather = () => {
    let w = game.current;
    if (!w.job) return say('先に職業を選択しよう。');
    const interaction = nearbyInteraction(w, w.loot, w.nodes);
    if (!interaction)
      return say(
        '調べられる対象に近づこう。集落の道守り、祭壇、宝箱、採集物を探せる。',
      );
    if (['camp', 'shrine', 'vista'].includes(interaction.kind)) {
      const site = DISCOVERY_SITES.find((s) => s.id === interaction.id)!;
      if (interaction.kind === 'camp') {
        completeLesson(w.tutorial, 'camp');
        const first = recordSiteVisit(w.talkedSites, site.id);
        if (first) {
          receiveItem(w, 'potion', 2);
          receiveItem(w, 'wood', 3);
          receiveItem(w, 'ore', 3);
        }
        w.hp = w.maxHp;
        w.energy = w.maxEnergy;
        const clues = sitesIn(site.region).filter((s) =>
          ['quarry', 'outpost'].includes(s.kind),
        );
        for (const clue of clues)
          if (!w.rumoredSites.includes(clue.id)) w.rumoredSites.push(clue.id);
        const target =
          clues.find((s) => !w.discoveredSites.includes(s.id)) ||
          headquartersOf(regionAt(site.x, site.y));
        w.waypoint = {
          id: target.id,
          name: target.name,
          x: target.x,
          y: target.y,
        };
        return say(
          `道守り「${first ? '旅支度に薬と資材を持っていけ。' : 'ここで傷を癒やしていけ。'}資源地を調べ、前線基地を構えてから領主へ向かうといい」— 地図に情報を記録。`,
        );
      }
      if (w.activatedSites.includes(site.id))
        return say('この場所の記憶はすでに持ち帰った。');
      if (
        interaction.kind === 'shrine' &&
        w.mobs.some((m) => !m.ally && !m.dead && d(m, site) < 220)
      )
        return say('祭壇を守る魔物がいる。先に周囲の敵を倒そう。');
      recordSiteVisit(w.activatedSites, site.id);
      w.achievements++;
      gain(interaction.kind === 'vista' ? 30 : 45);
      const reward =
        interaction.kind === 'vista'
          ? 'crown-relic'
          : REGIONS.findIndex((r) => r.id === site.region) >= 5
            ? 'abyss-relic'
            : 'moon-gem';
      receiveItem(w, reward);
      return say(
        `${site.name}の${interaction.kind === 'vista' ? '記憶を記した' : '封印を解いた'}。${itemOf(reward).name}を獲得！`,
      );
    }
    const loot =
      interaction.kind === 'loot'
        ? w.loot.find((item) => item.id === interaction.id)
        : undefined;
    if (loot) {
      receiveItem(w, loot.item, loot.count);
      loot.claimed = true;
      if (loot.chest) {
        gain(8);
        w.achievements++;
      }
      return say(
        `${loot.chest ? '宝箱を開けた。' : '拾得：'}${itemOf(loot.item).name} ×${loot.count} — 持ち物で確認できる。`,
      );
    }
    let n = w.nodes.find((n) => n.id === interaction.id);
    if (!n) return say('宝箱・落ちたアイテム・光る採集物へ近づいて調べよう。');
    n.n--;
    completeLesson(w.tutorial, 'gather');
    if (n.kind === 'wood') w.wood++;
    else w.ore++;
    if (n.n === 0) receiveItem(w, n.kind === 'ore' ? 'crystal' : 'hide');
    w.message = n.kind === 'wood' ? '魔木を採集した。' : '瘴気鉱を採集した。';
    sync();
  };
  const build = () => {
    const w = game.current;
    if (w.buildMode) {
      w.buildMode = false;
      w.message = '建築予定を取り消した。';
      sync();
      return;
    }
    if (document.pointerLockElement) document.exitPointerLock();
    setBuildMenuOpen(true);
  };
  const selectBuilding = (kind: BuildingKind) => {
    const w = game.current,
      definition = buildingOf(kind);
    if (w.rank < definition.rank)
      return say(
        `${definition.name}は魔族ランク ${RANKS[definition.rank]} で解放。`,
      );
    if (w.wood < definition.wood || w.ore < definition.ore)
      return say(
        `${definition.name}には魔木${definition.wood}・瘴気鉱${definition.ore}が必要。`,
      );
    w.selectedBuilding = kind;
    w.buildMode = true;
    w.buildYaw = w.viewYaw;
    setBuildMenuOpen(false);
    w.message = `${definition.name}の予定地を確認中。視点で位置を決め、左クリックで着工。`;
    sync();
  };
  const confirmBuild = () => {
    const w = game.current;
    if (!w.buildMode) return;
    const definition = buildingOf(w.selectedBuilding);
    if (w.wood < definition.wood || w.ore < definition.ore) {
      w.buildMode = false;
      return say('建築中に必要素材が不足した。');
    }
    const buildAt = plannedBuilding(w);
    const invalid = placementIssue(
      buildAt,
      w.bases,
      w,
      w.nodes.filter((node) => node.n > 0),
    );
    if (invalid) return say(invalid);
    w.wood -= definition.wood;
    w.ore -= definition.ore;
    completeLesson(w.tutorial, 'build');
    w.buildAnim = 0;
    w.buildMode = false;
    w.bases.push({
      id: w.bases.length + 1,
      x: buildAt.x,
      y: buildAt.y,
      yaw: buildAt.yaw,
      level: w.rank + 1,
      kind: definition.id,
      name: definition.name,
      progress: 0,
      duration: definition.seconds,
      complete: false,
      workers: 0,
    });
    w.message = `${definition.name}を着工。正面へ近づき、建物を見て立ち止まると作業。建築担当の配下も現地へ向かいます。`;
    sync();
  };
  const raid = () => {
    let w = game.current,
      r = regionAt(w.x, w.y);
    const activeBoss = w.mobs.some((m) => m.boss && !m.dead && m.home === r.id),
      siege = territorySiegeStatus(w, r, activeBoss);
    if (!siege.canStart) return say(siege.message);
    const headquarters = headquartersOf(r),
      required = siege.requiredLevel;
    const lord = TERRITORY_LORDS[r.id] || {
      name: r.name + 'の異形領主',
      kind: 'aberration' as MonsterKind,
    };
    w.mobs.push({
      id: territoryBossId(r.id),
      x: headquarters.x,
      y: headquarters.y,
      hp: 150 + required * 35,
      max: 150 + required * 35,
      name: lord.name,
      kind: lord.kind,
      variant: 4,
      tier: required,
      boss: true,
      home: r.id,
      attackAnim: 0,
      attackCd: 0.8,
    });
    w.message = '領土ボスが出現！ 倒せばこの地を奪える。';
    sync();
  };
  const rankUp = () => {
    let w = game.current;
    if (w.rank >= 7) return say('すでに魔王として君臨している。');
    if (!canRank(w)) return say('昇格条件が不足している：' + requirement(w));
    w.rank++;
    w.maxHp += 25;
    w.hp = w.maxHp;
    w.achievements++;
    setRankEvolution(w.rank);
    w.message =
      w.rank === 7
        ? '魔王戴冠！ レベルだけでは届かない覇道を成し遂げた。'
        : '魔族ランク ' + RANKS[w.rank] + ' に昇格！';
    sync();
  };
  const updateJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!touchInput.current) setTouchAim(true);
    touchInput.current = true;
    game.current.autoRun = false;
    const rect = event.currentTarget.getBoundingClientRect();
    const x =
      (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.42);
    const y =
      (event.clientY - rect.top - rect.height / 2) / (rect.height * 0.42);
    const length = Math.max(1, Math.hypot(x, y));
    stick.current = { x: x / length, y: y / length, on: true };
  };
  const releaseJoystick = () => {
    joystickPointer.current = null;
    stick.current = { x: 0, y: 0, on: false };
  };
  const toggleAutoRun = () => {
    const w = game.current;
    if (!w.job) return say('先に職業を選択しよう。');
    w.autoRun = !w.autoRun;
    w.message = w.autoRun
      ? '自動前進を開始。視点で進行方向を調整。後退・スティック・被弾で停止する。'
      : '自動前進を停止した。';
    sync();
  };
  useEffect(() => {
    const saved = localStorage.getItem('makai-key-bindings');
    if (!saved) return;
    try {
      const loaded = { ...DEFAULT_BINDINGS, ...JSON.parse(saved) };
      bindingsRef.current = loaded;
      setBindings(loaded);
    } catch {
      localStorage.removeItem('makai-key-bindings');
    }
  }, []);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const mouseLook = { on: false, x: 0, y: 0 };
    let pointerLockUnavailable = false;
    const rotateView = (dx: number, dy: number, sensitivity = 0.0022) => {
      const w = game.current;
      const preferences = w.preferences || DEFAULT_PREFERENCES;
      const gain =
        sensitivity *
        (sensitivity === 0.005
          ? preferences.touchSensitivity
          : preferences.sensitivity);
      w.viewYaw -= dx * gain;
      if (w.job) recordTutorialMotion(w.tutorial, 0, Math.abs(dx * gain));
      w.viewPitch = Math.max(
        -1.2,
        Math.min(1.2, w.viewPitch - dy * gain * (preferences.invertY ? -1 : 1)),
      );
      w.facingX = Math.sin(w.viewYaw);
      w.facingY = Math.cos(w.viewYaw);
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (listeningRef.current) {
        e.preventDefault();
        changeBinding(listeningRef.current, key);
        return;
      }
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input,textarea,select,[contenteditable=true]')
      )
        return;
      if (
        key === 'escape' &&
        !menuOpenRef.current &&
        !document.pointerLockElement &&
        game.current.job
      ) {
        setAdventureOpen(true);
        return;
      }
      if (
        key === bindingsRef.current.inventory &&
        !e.repeat &&
        (!menuOpenRef.current || quickMenuRef.current === 'inventory')
      ) {
        e.preventDefault();
        setInventoryOpen((v) => !v);
        return;
      }
      if (
        key === bindingsRef.current.map &&
        !e.repeat &&
        (!menuOpenRef.current || quickMenuRef.current === 'map')
      ) {
        e.preventDefault();
        setMapOpen((v) => !v);
        return;
      }
      if (menuOpenRef.current) return;
      keys.current[key] = true;
      const map = bindingsRef.current;
      if (key === map.autoRun && !e.repeat) {
        e.preventDefault();
        keys.current[key] = false;
        toggleAutoRun();
        return;
      }
      if (key === map.back) game.current.autoRun = false;
      if (key === map.jump) {
        e.preventDefault();
        jump();
      }
      if (key === map.heavy) heavyAttack();
      if (key === map.skill) useCombatSkill();
      if (key === map.dodge) dodge();
      if (key === map.recruit) recruit();
      if (key === map.gather) gather();
      if (key === map.guard) game.current.guarding = true;
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys.current[key] = false;
      if (key === bindingsRef.current.guard) game.current.guarding = false;
    };
    const mouseDown = (e: MouseEvent) => {
      if (menuOpenRef.current || !game.current.job) return;
      if (e.button === 0) {
        if (document.pointerLockElement !== c) {
          mouseLook.on = true;
          mouseLook.x = e.clientX;
          mouseLook.y = e.clientY;
          if (!pointerLockUnavailable && c.requestPointerLock)
            void c.requestPointerLock().catch(() => {
              pointerLockUnavailable = true;
              setDragLookOnly(true);
              game.current.message =
                'この画面では視点固定が使えません。左ドラッグで見回せます。攻撃は画面下のボタンから。';
              sync();
            });
          return;
        }
        if (game.current.buildMode) confirmBuild();
        else attack();
      }
      if (e.button === 2) {
        if (game.current.buildMode) build();
        else game.current.guarding = true;
      }
    };
    const mouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseLook.on = false;
      if (e.button === 2) game.current.guarding = false;
    };
    const mouseMove = (e: MouseEvent) => {
      if (menuOpenRef.current) return;
      if (document.pointerLockElement === c)
        rotateView(e.movementX, e.movementY);
      else if (mouseLook.on) {
        rotateView(e.clientX - mouseLook.x, e.clientY - mouseLook.y);
        mouseLook.x = e.clientX;
        mouseLook.y = e.clientY;
      }
    };
    const pointerDown = (e: PointerEvent) => {
      if (menuOpenRef.current) return;
      if (e.pointerType !== 'touch') return;
      if (!touchInput.current) setTouchAim(true);
      touchInput.current = true;
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      if (e.clientX < rect.left + rect.width * 0.42) return;
      lookTouch.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      c.setPointerCapture(e.pointerId);
    };
    const pointerMove = (e: PointerEvent) => {
      if (e.pointerId !== lookTouch.current.id) return;
      rotateView(
        e.clientX - lookTouch.current.x,
        e.clientY - lookTouch.current.y,
        0.005,
      );
      lookTouch.current.x = e.clientX;
      lookTouch.current.y = e.clientY;
    };
    const pointerUp = (e: PointerEvent) => {
      if (e.pointerId === lookTouch.current.id) lookTouch.current.id = -1;
    };
    const contextMenu = (e: MouseEvent) => e.preventDefault();
    const clearInput = () => {
      mouseLook.on = false;
      keys.current = {};
      stick.current = { x: 0, y: 0, on: false };
      lookTouch.current.id = -1;
      game.current.guarding = false;
      game.current.autoRun = false;
    };
    const lockChanged = () => {
      setPointerLocked(document.pointerLockElement === c);
      if (document.pointerLockElement !== c) clearInput();
    };
    document.addEventListener('pointerlockchange', lockChanged);
    addEventListener('blur', clearInput);
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('mousemove', mouseMove);
    addEventListener('mouseup', mouseUp);
    c.addEventListener('mousedown', mouseDown);
    c.addEventListener('contextmenu', contextMenu);
    c.addEventListener('pointerdown', pointerDown);
    c.addEventListener('pointermove', pointerMove);
    c.addEventListener('pointerup', pointerUp);
    c.addEventListener('pointercancel', pointerUp);
    return () => {
      document.removeEventListener('pointerlockchange', lockChanged);
      removeEventListener('blur', clearInput);
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
      removeEventListener('mousemove', mouseMove);
      removeEventListener('mouseup', mouseUp);
      c.removeEventListener('mousedown', mouseDown);
      c.removeEventListener('contextmenu', contextMenu);
      c.removeEventListener('pointerdown', pointerDown);
      c.removeEventListener('pointermove', pointerMove);
      c.removeEventListener('pointerup', pointerUp);
      c.removeEventListener('pointercancel', pointerUp);
    };
  }, []);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !rendererEnabled) {
      setRendererReady(false);
      return;
    }
    setRendererReady(false);
    let cancelled = false,
      loadFailed = false,
      view: ReturnType<(typeof import('./game3d'))['createGame3D']> | undefined;
    void import('./game3d')
      .then(({ createGame3D }) => {
        if (cancelled) return;
        view = createGame3D(c, REGIONS, setRenderPerformance);
        setRendererReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        loadFailed = true;
        setRendererReady(true);
        game.current.message =
          '3D描画の読み込みに失敗しました。画面を再読み込みしてください。';
        sync();
      });
    const nearbyEnemies = new NearbyIndex<Mob>();
    const patrolClock = new PatrolClock();
    let last = performance.now(),
      frame = 0,
      id = 0,
      autoRunBlockedFor = 0;
    const loop = (now: number) => {
      if (!view) {
        last = now;
        if (!loadFailed) id = requestAnimationFrame(loop);
        return;
      }
      let dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      frame++;
      const w = game.current;
      w.preferences ||= { ...DEFAULT_PREFERENCES };
      w.tutorial ||= newTutorial();
      w.discoveredSites ||= [];
      w.talkedSites ||= [];
      w.activatedSites ||= [];
      w.rumoredSites ||= [];
      w.worldTime ||= 0;
      w.inventory ||= [];
      w.equipment ||= emptyEquipment();
      w.loot ||= [];
      w.lootSequence ||= 1000;
      if (menuOpenRef.current || !w.job) {
        view.render(w, dt);
        id = requestAnimationFrame(loop);
        return;
      }
      w.worldTime += dt;
      const held = (action: BindingAction) =>
        !!keys.current[bindingsRef.current[action]];
      const { strafe, forward, intent, length } = resolveTravelAxes({
          autoRun: w.autoRun,
          forward: held('forward'),
          back: held('back'),
          left: held('left'),
          right: held('right'),
          stick: stick.current,
        }),
        directionX =
          Math.sin(w.viewYaw) * (forward / length) +
          Math.cos(w.viewYaw) * (strafe / length),
        directionY =
          Math.cos(w.viewYaw) * (forward / length) -
          Math.sin(w.viewYaw) * (strafe / length),
        j = jobOf(w),
        move = w.job
          ? 145 *
            j.speed *
            (1 + w.stats.agility * 0.018) *
            (w.unlocked.includes('step') ? 1.15 : 1)
          : 0,
        sprinting =
          (held('sprint') ||
            w.autoRun ||
            (stick.current.on &&
              Math.hypot(stick.current.x, stick.current.y) > 0.92)) &&
          intent > 0.2 &&
          w.energy > 1,
        sprintBoost = sprinting ? 1.58 : 1,
        actionSlow =
          w.attackAnim > 0
            ? w.attackKind === 'heavy'
              ? 0.28
              : 0.48
            : w.guarding
              ? 0.45
              : 1;
      w.facingX = Math.sin(w.viewYaw);
      w.facingY = Math.cos(w.viewYaw);
      if (w.buildMode) w.buildYaw = w.viewYaw;
      const previousPosition = { x: w.x, y: w.y };
      Object.assign(
        w,
        moveAroundBuildings(
          w,
          {
            x: w.x + directionX * move * sprintBoost * intent * dt * actionSlow,
            y: w.y + directionY * move * sprintBoost * intent * dt * actionSlow,
          },
          w.bases,
          w.height,
        ),
      );
      const travelled = d(w, previousPosition);
      recordTutorialMotion(w.tutorial, travelled, 0);
      autoRunBlockedFor = nextAutoRunBlockedTime(
        w.autoRun,
        travelled,
        dt,
        autoRunBlockedFor,
      );
      if (autoRunBlockedFor >= AUTO_RUN_STUCK_SECONDS) {
        w.autoRun = false;
        autoRunBlockedFor = 0;
        w.message = '自動前進を停止。障害物を回り込んでから再開しよう。';
      }
      w.respawnGrace = Math.max(0, (w.respawnGrace || 0) - dt);
      const environmentHarm = hazardDamage(w.x, w.y, w.height, w.worldTime, dt);
      if (environmentHarm > 0 && w.respawnGrace <= 0) {
        w.hp -= environmentHarm;
        w.hitAnim = 0.15;
        w.damageSource = undefined;
        w.autoRun = false;
      }
      if (sprinting) w.energy = Math.max(0, w.energy - 17 * dt);
      if (!w.grounded) {
        w.velocityY -= 15.5 * dt;
        w.height += w.velocityY * dt;
        if (w.height <= 0) {
          w.height = 0;
          w.velocityY = 0;
          w.grounded = true;
        }
      }
      w.cd = Math.max(0, w.cd - dt);
      w.heavyCd = Math.max(0, w.heavyCd - dt);
      w.dodgeCd = Math.max(0, w.dodgeCd - dt);
      w.dodgeTime = Math.max(0, w.dodgeTime - dt);
      w.skillCd = Math.max(0, w.skillCd - dt);
      w.attackAnim = Math.max(0, w.attackAnim - dt);
      if (w.attackAnim <= 0) w.attackKind = 'none';
      w.hitAnim = Math.max(0, w.hitAnim - dt);
      if (w.damageSource) {
        w.damageSource.remaining -= dt;
        if (w.damageSource.remaining <= 0) w.damageSource = undefined;
      }
      const incompleteSites = w.bases.filter((site) => !site.complete);
      const builders = new globalThis.Map(
        w.roster
          .filter((unit) => unit.assignment === 'build')
          .map((unit) => [unit.id, unit]),
      );
      const work = constructionWork(
        w.bases,
        w.mobs
          .filter(
            (mob) =>
              mob.ally &&
              !mob.dead &&
              !(mob.attackAnim || 0) &&
              builders.has(mob.id),
          )
          .map((mob) => ({
            id: mob.id,
            x: mob.x,
            y: mob.y,
            power: builders.get(mob.id)!.aptitudes.build,
          })),
        {
          x: w.x,
          y: w.y,
          viewYaw: w.viewYaw,
          canWork:
            intent < 0.1 &&
            w.grounded &&
            !w.guarding &&
            !w.attackAnim &&
            !w.buildMode &&
            !w.dodgeTime,
        },
      );
      incompleteSites.forEach((site) => {
        site.workers = work.present.get(site.id)?.length || 0;
        site.playerWorking = work.playerSite?.id === site.id;
        site.progress = Math.min(
          site.duration,
          site.progress + dt * (work.rates.get(site.id) || 0),
        );
        if (site.progress >= site.duration) {
          site.complete = true;
          w.base++;
          w.maxHp += 12;
          w.hp = w.maxHp;
          w.achievements++;
          w.message = `${site.name}が完成！ ${site.kind === 'wall' ? '城壁が通行を遮り、拠点を囲めます。' : site.kind === 'gate' ? '中央の城門を通行できます。' : '正面の入口から中へ入れます。'}`;
        }
      });
      w.buildAnim = work.playerSite && !work.playerSite.complete ? 1 : 0;
      w.workClock += dt;
      if (w.workClock >= 8) {
        w.workClock -= 8;
        const completed = new Set(
            w.bases.filter((site) => site.complete).map((site) => site.kind),
          ),
          haulPower = taskPower(w, 'haul'),
          logistics = 1 + Math.min(0.65, haulPower * 0.012),
          storage = completed.has('storage') ? 1.25 : 1,
          gatherPower = taskPower(w, 'gather'),
          minePower = taskPower(w, 'mine'),
          woodGain = gatherPower
            ? Math.max(1, Math.floor((gatherPower / 13) * logistics * storage))
            : 0,
          oreGain = minePower
            ? Math.max(1, Math.floor((minePower / 14) * logistics * storage))
            : 0;
        w.wood += woodGain;
        w.ore += oreGain;
        if (completed.has('smithy')) {
          w.forgeProgress += taskPower(w, 'smith');
          const forgeNeed = 70 + w.weaponLevel * 10;
          if (w.forgeProgress >= forgeNeed && w.weaponLevel < 20) {
            w.forgeProgress -= forgeNeed;
            w.weaponLevel++;
            const forged = weaponFor(
              w.job,
              Math.min(3, Math.floor(w.rank / 2)),
            );
            receiveItem(w, forged);
            w.message = `鍛冶班が武器をLv.${w.weaponLevel}へ強化し、${itemOf(forged).name}を製作した。`;
          }
        }
        if (completed.has('laboratory')) {
          w.researchProgress += taskPower(w, 'research');
          if (w.researchProgress >= 70) {
            w.researchProgress -= 70;
            gain(16 + taskPower(w, 'research'));
            const gem = w.rank >= 2 ? 'moon-gem' : 'ember-gem';
            receiveItem(w, gem);
            w.message = `研究班が魔界知識を解析し、経験値と${itemOf(gem).name}を獲得した。`;
          }
        }
        const scoutBonus = completed.has('watchtower') ? 1.35 : 1;
        w.scoutProgress += taskPower(w, 'scout') * scoutBonus;
        if (w.scoutProgress >= 90) {
          const discovered = REGIONS.find(
            (region) => !w.discovered.includes(region.id),
          );
          w.scoutProgress -= 90;
          if (discovered) {
            w.discovered.push(discovered.id);
            w.achievements++;
            w.message = `偵察隊が「${discovered.name}」の位置を地図へ記録した。`;
          }
        }
      }
      if (!sprinting)
        w.energy = Math.min(
          w.maxEnergy,
          w.energy + (12 + w.stats.stamina * 1.2) * dt,
        );
      if (w.guarding) {
        w.energy = Math.max(0, w.energy - 8 * dt);
        if (w.energy <= 0) w.guarding = false;
      }
      w.pendingHits.forEach((hit) => (hit.delay -= dt));
      let impacts = w.pendingHits.filter((hit) => hit.delay <= 0);
      w.pendingHits = w.pendingHits.filter((hit) => hit.delay > 0);
      impacts.forEach((hit) => {
        let t = w.mobs.find((m) => m.id === hit.target);
        if (
          !t ||
          t.dead ||
          t.ally ||
          !clearBuildingSight(w, t, w.bases, w.height + 0.9)
        )
          return;
        t.hp -= hit.damage;
        t.hitAnim = 0.34;
        if (hit.knockback) {
          let q = d(w, t) || 1;
          Object.assign(
            t,
            moveAroundBuildings(
              t,
              {
                x: t.x + ((t.x - w.x) / q) * hit.knockback,
                y: t.y + ((t.y - w.y) / q) * hit.knockback,
              },
              w.bases,
            ),
          );
        }
        if (t.hp <= 0) defeat(w, t);
      });
      w.bannerTime = Math.max(0, w.bannerTime - dt);
      if (frame % 15 === 0 && w.job) {
        for (const site of sitesIn(regionAt(w.x, w.y).id)) {
          if (
            !w.discoveredSites.includes(site.id) &&
            d(w, site) < site.radius + 100
          ) {
            w.discoveredSites.push(site.id);
            w.achievements++;
            gain(10);
            w.message = `${SITE_LABELS[site.kind]}発見：${site.name} — ${site.description}`;
          }
        }
      }
      let r = regionAt(w.x, w.y);
      if (r.id !== w.region) {
        w.region = r.id;
        if (!w.discovered.includes(r.id)) {
          w.discovered.push(r.id);
          w.achievements++;
          w.message = '新地域発見：' + r.name;
        }
        let territory = ownerOf(w, r);
        w.banner =
          territory === 'enemy'
            ? '敵領土'
            : territory === 'own'
              ? '自分の領土'
              : '未支配地域';
        w.bannerTime = 2.4;
      }
      if (frame % 60 === 0 && ownerOf(w, r) === 'own')
        w.hp = Math.min(
          w.maxHp,
          w.hp + Math.max(1, Math.floor(w.stats.stamina * 0.45)),
        );
      const safeCamp =
        w.respawnGrace > 0 ||
        sitesIn(r.id).some((site) => site.kind === 'camp' && d(w, site) < 190);
      nearbyEnemies.rebuild(w.mobs, (m) => !m.ally && !m.dead);
      w.mobs.forEach((m) => {
        m.working = false;
        m.attackCd = Math.max(0, (m.attackCd || 0) - dt);
        m.hitAnim = Math.max(0, (m.hitAnim || 0) - dt);
        if (m.dead) {
          m.deathAnim = Math.max(0, (m.deathAnim || 0) - dt);
          m.recruitTime = Math.max(0, (m.recruitTime || 0) - dt);
          return;
        }
        const movementDt = patrolClock.step(m, w, dt);
        if (!movementDt) return;
        const previousMobPosition = { x: m.x, y: m.y };
        const behavior = behaviorOf(m),
          q = d(w, m) || 1,
          reach = behavior.reach * (m.boss ? 2.35 : 1),
          detect =
            behavior.detect *
            (m.boss
              ? 1.55
              : m.patrol === 'ambush'
                ? 0.48
                : m.patrol === 'sentinel'
                  ? 0.8
                  : 1);
        let target: Mob | undefined;
        if (m.ally) {
          const assignment =
              m.assignment ||
              w.roster.find((unit) => unit.id === m.id)?.assignment ||
              'combat',
            fieldDuty = assignment === 'combat' || assignment === 'guard';
          if (fieldDuty) {
            const dutyDetect =
              assignment === 'guard' ? Math.min(190, detect) : detect;
            target = nearbyEnemies.nearest(
              m,
              dutyDetect,
              (x) => !x.dead && !x.ally,
            );
            const tq = target ? d(m, target) || 1 : 999;
            if (target && tq < dutyDetect) {
              if (tq > reach && !(m.attackAnim || 0)) {
                const allySpeed =
                  Math.max(38, behavior.speed) + w.stats.leadership * 2;
                m.x += ((target.x - m.x) / tq) * allySpeed * dt;
                m.y += ((target.y - m.y) / tq) * allySpeed * dt;
              } else if (tq <= reach && (m.attackCd || 0) <= 0) {
                m.attackTotal = behavior.attack;
                m.attackAnim = m.attackTotal;
                m.attackCd = behavior.cooldown;
                m.attackHit = false;
                m.attackTarget = target.id;
              }
            } else if (
              q > (assignment === 'guard' ? 62 : 90) &&
              !(m.attackAnim || 0)
            ) {
              const followSpeed =
                Math.max(54, behavior.speed) + w.stats.leadership * 2;
              m.x += ((w.x - m.x) / q) * followSpeed * dt;
              m.y += ((w.y - m.y) / q) * followSpeed * dt;
            }
          } else {
            const completedBase = [...w.bases]
                .reverse()
                .find((site) => site.complete),
              construction =
                assignment === 'build' ? work.assignments.get(m.id) : undefined,
              resource =
                assignment === 'gather' || assignment === 'mine'
                  ? w.nodes
                      .filter(
                        (node) =>
                          node.n > 0 &&
                          node.kind ===
                            (assignment === 'gather' ? 'wood' : 'ore'),
                      )
                      .sort((a, b) => d(m, a) - d(m, b))[0]
                  : undefined,
              scoutDistance = assignment === 'scout' ? 520 : 0,
              anchor =
                assignment === 'build' && construction
                  ? construction
                  : resource || completedBase || w,
              approach =
                construction && !construction.complete
                  ? constructionApproach(construction, m)
                  : undefined,
              targetX =
                approach?.x ??
                anchor.x +
                  Math.cos(
                    m.id * 2.17 + now * (assignment === 'scout' ? 0.00035 : 0),
                  ) *
                    (scoutDistance || 55 + (m.id % 4) * 24),
              targetY =
                approach?.y ??
                anchor.y +
                  Math.sin(
                    m.id * 1.73 + now * (assignment === 'scout' ? 0.00035 : 0),
                  ) *
                    (scoutDistance || 55 + (m.id % 4) * 24),
              workDistance = Math.hypot(targetX - m.x, targetY - m.y) || 1;
            if (workDistance > 38 && !(m.attackAnim || 0)) {
              const workSpeed = Math.max(34, behavior.speed * 0.78);
              m.x += ((targetX - m.x) / workDistance) * workSpeed * dt;
              m.y += ((targetY - m.y) / workDistance) * workSpeed * dt;
            }
            if (
              construction &&
              !construction.complete &&
              work.present
                .get(construction.id)
                ?.some((worker) => worker.id === m.id)
            ) {
              m.working = true;
              m.workYaw = Math.atan2(
                construction.x - m.x,
                construction.y - m.y,
              );
            }
          }
        } else {
          const inTerritory =
            m.boss ||
            Math.hypot(m.x - (m.anchorX || m.x), m.y - (m.anchorY || m.y)) <
              700;
          if (
            !safeCamp &&
            inTerritory &&
            q < detect &&
            q > reach &&
            !(m.attackAnim || 0)
          ) {
            const chaseSpeed = behavior.speed * (m.boss ? 0.78 : 1),
              strafe =
                m.kind === 'insect' || m.kind === 'flying'
                  ? Math.sin(now * 0.005 + m.id) * chaseSpeed * 0.28
                  : 0;
            m.x +=
              (((w.x - m.x) / q) * chaseSpeed + ((w.y - m.y) / q) * strafe) *
              movementDt;
            m.y +=
              (((w.y - m.y) / q) * chaseSpeed - ((w.x - m.x) / q) * strafe) *
              movementDt;
          } else if (
            !safeCamp &&
            inTerritory &&
            q <= reach &&
            (m.attackCd || 0) <= 0
          ) {
            m.attackTotal = behavior.attack * (m.boss ? 1.18 : 1);
            m.attackAnim = m.attackTotal;
            m.attackCd = behavior.cooldown * (m.boss ? 1.12 : 1);
            m.attackHit = false;
          } else if (
            (q >= detect || !inTerritory || safeCamp) &&
            behavior.wander > 0 &&
            !(m.attackAnim || 0)
          ) {
            const home = REGIONS.find((region) => region.id === m.home),
              angle = now * 0.00022 * (1 + behavior.wander / 20) + m.id * 1.71;
            const patrolRadius =
                m.patrol === 'ambush' ? 8 : m.patrol === 'sentinel' ? 60 : 100,
              tx = (m.anchorX ?? m.x) + Math.cos(angle) * patrolRadius,
              ty = (m.anchorY ?? m.y) + Math.sin(angle * 0.83) * patrolRadius,
              distance = Math.hypot(tx - m.x, ty - m.y) || 1;
            m.x += ((tx - m.x) / distance) * behavior.wander * movementDt;
            m.y += ((ty - m.y) / distance) * behavior.wander * movementDt;
            if (home) {
              m.x = Math.max(
                home.x + 120,
                Math.min(home.x + home.w - 120, m.x),
              );
              m.y = Math.max(
                home.y + 120,
                Math.min(home.y + home.h - 120, m.y),
              );
            }
          }
        }
        Object.assign(m, moveAroundBuildings(previousMobPosition, m, w.bases));
        nearbyEnemies.moved(m);
        if ((m.attackAnim || 0) > 0) {
          let progress = 1 - (m.attackAnim || 0) / (m.attackTotal || 0.78);
          if (
            progress >
              creatureAttackImpactProgress(m.kind || 'imp', !!m.boss) &&
            !m.attackHit
          ) {
            m.attackHit = true;
            if (m.ally) {
              let victim = w.mobs.find(
                (x) => x.id === m.attackTarget && !x.dead && !x.ally,
              );
              if (
                victim &&
                d(m, victim) < reach + 25 &&
                clearBuildingSight(m, victim, w.bases)
              ) {
                const barracksBonus = w.bases.some(
                    (site) => site.complete && site.kind === 'barracks',
                  )
                    ? 1.18
                    : 1,
                  throneBonus = w.bases.some(
                    (site) => site.complete && site.kind === 'demon-castle',
                  )
                    ? 1.35
                    : 1;
                victim.hp -= Math.max(
                  2,
                  Math.floor(
                    (3 +
                      m.tier * 2 +
                      Math.floor(
                        (w.stats.leadership +
                          equipmentBonus(w.equipment, w.job).leadership) *
                          0.8,
                      )) *
                      barracksBonus *
                      throneBonus,
                  ),
                );
                victim.hitAnim = 0.3;
                if (victim.hp <= 0) defeat(w, victim);
              }
            } else if (
              !safeCamp &&
              w.respawnGrace <= 0 &&
              d(w, m) < reach + 28 &&
              w.dodgeTime <= 0 &&
              clearBuildingSight(m, w, w.bases, 0.9, w.height + 0.9)
            ) {
              let branchGuard =
                  1 - w.unlocked.filter((s) => s.endsWith('b')).length * 0.08,
                harm = Math.max(
                  1,
                  Math.floor(
                    ((m.boss ? 13 : 3 + m.tier) -
                      Math.floor(
                        w.stats.defense * 0.55 +
                          equipmentBonus(w.equipment, w.job).defense,
                      )) *
                      branchGuard,
                  ),
                );
              if (w.guarding) {
                harm = Math.max(1, Math.floor(harm * 0.28));
                w.energy = Math.max(0, w.energy - 10);
              }
              w.hp -= harm;
              w.hitAnim = 0.34;
              w.damageSource = { x: m.x, y: m.y, name: m.name, remaining: 1.8 };
              w.autoRun = false;
            }
          }
          m.attackAnim = Math.max(0, (m.attackAnim || 0) - dt);
        }
      });
      w.mobs = w.mobs.filter(
        (m) =>
          !m.dead ||
          (m.deathAnim || 0) > 0 ||
          (!m.boss && (m.recruitTime || 0) > 0),
      );
      if (w.hp <= 0) {
        if (w.job === 'berserker' && w.unlocked.includes('undying')) {
          w.hp = 1;
          w.unlocked = w.unlocked.filter((s) => s !== 'undying');
          w.message = '不死の執念で致命傷に耐えた！';
        } else {
          const defeatedAt = { x: w.x, y: w.y };
          const refuge = [...w.bases]
            .reverse()
            .find(
              (site) =>
                site.complete &&
                ['hideout', 'fortress', 'castle', 'demon-castle'].includes(
                  site.kind,
                ),
            );
          const returnPoint = refuge
            ? constructionPoint(refuge, 2)
            : { x: 1024, y: 1180 };
          w.x = returnPoint.x;
          w.y = returnPoint.y;
          w.viewYaw = refuge
            ? Math.atan2(returnPoint.x - refuge.x, returnPoint.y - refuge.y)
            : 0;
          w.viewPitch = 0;
          w.height = 0;
          w.velocityY = 0;
          w.grounded = true;
          w.hp = w.maxHp;
          w.energy = w.maxEnergy;
          w.guarding = false;
          w.autoRun = false;
          w.dodgeTime = 0;
          w.attackAnim = 0;
          w.attackKind = 'none';
          w.pendingHits = [];
          w.respawnGrace = 5;
          w.damageSource = undefined;
          const retreated = retreatHostilesAfterDefeat(w.mobs, defeatedAt);
          w.message = `敗北。${refuge?.name || '忘れられた廃墟'}へ撤退した。5秒間は攻撃を受けない。${retreated ? `追跡していた敵${retreated}体は縄張りへ戻った。` : ''}`;
        }
      }
      view.render(w, dt);
      if (frame % 10 === 0) sync();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
      view?.dispose();
    };
  }, [rendererEnabled, sync]);
  const rankPreviewRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!node || !hud.job) return;
      let cancelled = false,
        dispose: (() => void) | undefined;
      void import('./game3d')
        .then(({ createDemonPreview }) => {
          if (cancelled) return;
          const preview = createDemonPreview(
            node,
            hud.job,
            hud.rank,
            hud.equipment.weapon,
          );
          dispose = preview.dispose;
        })
        .catch(() => {
          if (cancelled) return;
          game.current.message =
            '全身3D表示の読み込みに失敗しました。画面を開き直してください。';
          sync();
        });
      return () => {
        cancelled = true;
        dispose?.();
      };
    },
    [hud.job, hud.rank, hud.equipment.weapon],
  );
  useEffect(() => {
    if (rankEvolution === null) return;
    const timeout = setTimeout(() => setRankEvolution(null), 2600);
    return () => clearTimeout(timeout);
  }, [rankEvolution]);
  const currentJob = JOBS.find((j) => j.id === hud.job),
    attackRange = currentJob
      ? 100 *
        currentJob.range *
        (hud.unlocked.includes('dark-wave') || hud.unlocked.includes('thrust')
          ? 1.18
          : 1)
      : 0,
    aimCue = currentJob
      ? selectAimCue(
          hud,
          hud.mobs,
          attackRange,
          touchAim ? 0.24 : 0.42,
          (mob) => clearBuildingSight(hud, mob, hud.bases, hud.height + 0.9),
        )
      : undefined,
    directlyAimed = aimCue?.direct,
    trackedThreat = aimCue?.tracked,
    trackedDistance = aimCue?.distance ?? 0,
    trackedAim = aimCue?.alignment ?? 0,
    trackedClear = aimCue?.clear ?? false,
    aimReason = directlyAimed
      ? '攻撃可能'
      : trackedThreat && !trackedClear
        ? '遮蔽物あり'
        : trackedThreat && trackedAim <= 0.42
          ? '照準を合わせる'
          : trackedThreat
            ? `あと${Math.max(1, Math.ceil((trackedDistance - attackRange) * 0.018))}m近づく`
            : '',
    current = regionAt(hud.x, hud.y),
    activeBoss = hud.mobs.find(
      (mob) => mob.boss && !mob.dead && mob.home === current.id,
    ),
    siegeStatus = territorySiegeStatus(hud, current, !!activeBoss),
    recruitHint = nearestRecruit(hud, hud.mobs, 360),
    recruitReady = recruitHint && d(hud, recruitHint) < 120,
    interaction = nearbyInteraction(hud, hud.loot, hud.nodes),
    currentHazard = hazardAt(hud.x, hud.y),
    currentOwner = ownerOf(hud, current),
    inCombat =
      !!activeBoss ||
      ((hud.respawnGrace || 0) <= 0 &&
        !sitesIn(current.id).some(
          (site) => site.kind === 'camp' && d(hud, site) < 190,
        ) &&
        hud.mobs.some((mob) => !mob.dead && !mob.ally && d(hud, mob) < 240)),
    need = hud.lv * 34,
    ready = canRank(hud),
    milestoneGroups = currentJob ? milestonesFor(currentJob.id) : [],
    activeConstructions = hud.bases.filter((site) => !site.complete),
    buildIssue = hud.buildMode
      ? placementIssue(
          plannedBuilding(hud),
          hud.bases,
          hud,
          hud.nodes.filter((node) => node.n > 0),
        )
      : null,
    taskCounts = Object.fromEntries(
      MINION_TASKS.map((task) => [
        task.id,
        hud.roster.filter((unit) => unit.assignment === task.id).length,
      ]),
    ) as Record<MinionTask, number>;
  return (
    <main className="game-shell immersive-shell">
      <section
        style={
          {
            '--touch-scale': hud.preferences?.touchScale ?? 1,
            '--touch-rise': `${hud.preferences?.touchRise ?? 0}px`,
            '--touch-inset': `${hud.preferences?.touchInset ?? 12}px`,
          } as React.CSSProperties
        }
        className={`game-frame open-world ${hud.job ? 'playing' : 'choosing'} ${mapOpen || rankOpen || growthOpen || transferOpen || controlsOpen || minionOpen || buildMenuOpen || inventoryOpen || adventureOpen || guideOpen ? 'menu-visible' : ''}`}
      >
        {hud.job &&
          !hud.buildMode &&
          !activeConstructions.length &&
          !currentHazard &&
          hud.bannerTime <= 0 &&
          !inCombat && (
            <TutorialHint
              state={hud.tutorial}
              onOpen={() => openScreen('guide')}
              onHide={() => {
                game.current.tutorial.hidden = true;
                sync();
              }}
            />
          )}
        {guideOpen && (
          <TutorialPanel
            state={hud.tutorial}
            bindings={bindings}
            onClose={() => setGuideOpen(false)}
            onToggle={() => {
              game.current.tutorial.hidden = !game.current.tutorial.hidden;
              sync();
            }}
          />
        )}
        {hud.job && (
          <AdventureHUD
            world={hud}
            jobName={currentJob?.name || ''}
            rankName={RANKS[hud.rank]}
            regionName={current.name}
            owner={currentOwner}
            inCombat={inCombat}
            onMenu={() => setAdventureOpen(true)}
            onMap={() => openScreen('map')}
            onInventory={() => openScreen('inventory')}
            onRank={() => openScreen('rank')}
          />
        )}
        {hud.job && hud.damageSource && (
          <div className="damage-direction" role="status">
            <span
              aria-hidden="true"
              style={{
                transform: `rotate(${damageBearing(hud, hud.damageSource).degrees}deg)`,
              }}
            >
              ▲
            </span>
            <b>{damageBearing(hud, hud.damageSource).direction}から被弾</b>
            <small>{hud.damageSource.name}</small>
          </div>
        )}
        {adventureOpen && (
          <AdventureMenu
            stats={hud}
            raidStatus={siegeStatus.label}
            raidReady={siegeStatus.canStart}
            onClose={() => setAdventureOpen(false)}
            onSelect={openScreen}
            onRaid={() => {
              setAdventureOpen(false);
              raid();
            }}
            onRestart={() => {
              const preferences = game.current.preferences;
              game.current = fresh();
              game.current.preferences = preferences;
              setAdventureOpen(false);
              sync();
            }}
          />
        )}
        <InventoryPanel
          world={hud}
          open={inventoryOpen}
          onOpenChange={setInventoryOpen}
          onAction={inventoryAction}
          message={hud.message}
        />
        {hud.job && (
          <button
            className="inventory-toggle"
            onClick={() => setInventoryOpen(true)}
          >
            <Backpack size={18} />
            持ち物 <kbd>{bindingName(bindings.inventory)}</kbd>
          </button>
        )}
        {hud.job && !inventoryOpen && recruitHint && (
          <div className="interaction-prompt recruit-prompt">
            <kbd>{bindingName(bindings.recruit)}</kbd>
            <span>
              {recruitHint.name}
              <br />
              {recruitReady ? '服従できる' : '近づいて服従'} · 残り
              {Math.ceil(recruitHint.recruitTime || 0)}秒
            </span>
          </div>
        )}
        {hud.job && !inventoryOpen && !recruitHint && interaction && (
          <div className="interaction-prompt">
            <kbd>{bindingName(bindings.gather)}</kbd>
            {interaction.label}
          </div>
        )}
        {hud.job && hud.waypoint && (
          <div className="waypoint-hud">
            <span
              className="waypoint-arrow"
              style={{
                transform: `rotate(${((Math.atan2(hud.waypoint.x - hud.x, hud.waypoint.y - hud.y) - hud.viewYaw) * 180) / Math.PI}deg)`,
              }}
            >
              ↑
            </span>
            <div>
              <b>{hud.waypoint.name}</b>
              <small>
                {Math.round(d(hud, hud.waypoint) * 0.018)} m ·{' '}
                {d(hud, hud.waypoint) < 100 ? '目的地付近' : '目的地'}
              </small>
            </div>
          </div>
        )}
        {hud.job && activeBoss && (
          <output
            className="boss-health"
            aria-label={`${activeBoss.name} 生命力 ${Math.max(0, Math.ceil(activeBoss.hp))} / ${activeBoss.max}`}
          >
            <div className="boss-health-heading">
              <small>領土ボス</small>
              <b>{activeBoss.name}</b>
              <span>
                {Math.max(0, Math.ceil(activeBoss.hp))} / {activeBoss.max}
              </span>
            </div>
            <div className="boss-health-meter" aria-hidden="true">
              <i
                style={{
                  width: `${Math.max(0, Math.min(100, (activeBoss.hp / activeBoss.max) * 100))}%`,
                }}
              />
            </div>
          </output>
        )}
        {hud.job && currentHazard && (
          <div
            className={`hazard-warning ${hazardPhase(currentHazard, hud.worldTime)}`}
          >
            {currentHazard.name} —{' '}
            {hazardPhase(currentHazard, hud.worldTime) === 'active'
              ? '危険！ 範囲の外へ'
              : hazardPhase(currentHazard, hud.worldTime) === 'warning'
                ? 'まもなく噴出。離れよう'
                : '今は静かだ。立ち止まらず進もう'}
          </div>
        )}
        <header className="topbar">
          <div className="brand">
            <Flame size={20} fill="currentColor" />
            <span>魔界成り上がり譚</span>
            <small>FIRST-PERSON OPEN WORLD</small>
          </div>
          <div className={'zone-chip ' + currentOwner}>
            <Map size={14} />
            <span>{current.name}</span>
            <b>
              {currentOwner === 'enemy'
                ? '敵領土'
                : currentOwner === 'own'
                  ? '自分の領土'
                  : '未支配地域'}
            </b>
          </div>
          <button
            className="reset"
            onClick={() => {
              game.current = fresh();
              sync();
            }}
          >
            最初から
          </button>
        </header>
        <div className="hud-left">
          <button
            className={'rank-badge rank-button ' + (ready ? 'ready' : '')}
            onClick={() => setRankOpen((v) => !v)}
          >
            <span>RANK</span>
            <b>{RANKS[hud.rank]}</b>
            {ready && <ChevronUp size={12} />}
          </button>
          <div className="vitals">
            <div className="lv">
              LV <b>{hud.lv}</b>
              <em>{currentJob ? currentJob.name : '未選択'}</em>
            </div>
            <div className="meter hp">
              <i style={{ width: (hud.hp / hud.maxHp) * 100 + '%' }} />
            </div>
            <div className="meter xp">
              <i
                style={{
                  width: (hud.lv >= 99 ? 100 : (hud.xp / need) * 100) + '%',
                }}
              />
            </div>
            <small>
              HP {Math.ceil(hud.hp)}/{hud.maxHp}　
              {hud.lv >= 99 ? 'LEVEL MAX' : 'EXP ' + hud.xp + '/' + need}
            </small>
          </div>
        </div>
        <div className="hud-right">
          <div className={hud.skillPoints ? 'sp-ready' : ''}>
            <Brain size={15} />
            SP <b>{hud.skillPoints}</b>
          </div>
          <div>
            <Users size={15} />
            配下 <b>{hud.minions}</b>
          </div>
          <div>
            <Castle size={15} />
            領土 <b>{hud.lands}</b>
          </div>
          <div>
            <Trophy size={15} />
            実績 <b>{hud.achievements}</b>
          </div>
        </div>
        <canvas
          ref={canvas}
          className="game-canvas"
          aria-label="リアルタイム3D魔界フィールド"
        />
        {hud.job && !rendererReady && (
          <div className="renderer-loading" role="status" aria-live="polite">
            <Flame size={18} />
            <span>魔界を構築中…</span>
          </div>
        )}
        {hud.job && (
          <>
            <div
              className={`fps-crosshair ${directlyAimed ? 'target-ready' : ''}`}
              aria-hidden="true"
            >
              <i />
              <i />
            </div>
            {trackedThreat && !hud.buildMode && (
              <div
                className={`aim-target ${directlyAimed ? 'ready' : ''}`}
                role="status"
              >
                <b>{trackedThreat.name}</b>
                <span>
                  {aimReason} ·{' '}
                  {Math.max(1, Math.round(trackedDistance * 0.018))}m
                </span>
              </div>
            )}
            {!pointerLocked && (
              <div className="fps-lock-hint">
                <Crosshair size={13} />
                {dragLookOnly
                  ? '左ドラッグで見回す · 攻撃は下のボタン'
                  : '画面をクリックして視点固定'}
              </div>
            )}
          </>
        )}
        {hud.buildMode && (
          <div className={'build-placement' + (buildIssue ? ' invalid' : '')}>
            <Hammer size={15} />
            <div>
              <b>{buildingOf(hud.selectedBuilding).name}を配置</b>
              <span>
                {buildIssue ||
                  '緑の予定地を確認して「着工」。歩いて配置場所・視点で向きを調整。'}
              </span>
            </div>
            <button onClick={confirmBuild} disabled={!!buildIssue}>
              着工
            </button>
            <button onClick={build}>取消</button>
          </div>
        )}
        {!hud.job && (
          <div className="job-select">
            <div className="job-title">
              <span>GAME START</span>
              <h1>最初の職業を選べ</h1>
              <p>職業は武器・間合い・成長方針・専用スキルを大きく変えます</p>
            </div>
            <div className="job-grid">
              {JOBS.filter((j) => j.tier === 'base').map((j) => (
                <button
                  key={j.id}
                  className={'job-card ' + j.id}
                  onClick={() => chooseJob(j.id)}
                  style={{ '--job-color': j.color } as React.CSSProperties}
                >
                  <div className="job-mark">
                    <Swords />
                  </div>
                  <span>{j.weapon}</span>
                  <h2>{j.name}</h2>
                  <p>{j.style}</p>
                  <div className="job-bars">
                    <i style={{ width: (j.power / 1.85) * 100 + '%' }} />
                    <i style={{ width: (j.magic / 1.85) * 100 + '%' }} />
                    <i style={{ width: (j.speed / 1.42) * 100 + '%' }} />
                  </div>
                  <small>攻撃　魔力　速度</small>
                  <b>この職業で始める</b>
                </button>
              ))}
            </div>
          </div>
        )}
        {hud.job &&
          hud.bannerTime > 0 &&
          !inCombat &&
          !currentHazard &&
          !hud.buildMode && (
            <div className={'territory-banner ' + currentOwner}>
              <span>{hud.banner}</span>
              <b>{current.name}</b>
            </div>
          )}
        <button className="map-toggle" onClick={() => setMapOpen((v) => !v)}>
          <Map size={16} />
          世界地図 <kbd>{bindingName(bindings.map)}</kbd>
        </button>
        <button
          className={'growth-toggle ' + (hud.skillPoints ? 'ready' : '')}
          onClick={() => setGrowthOpen((v) => !v)}
        >
          <Brain size={16} />
          能力・スキル <b>{hud.skillPoints} SP</b>
        </button>
        <button
          className="transfer-toggle"
          onClick={() => setTransferOpen((v) => !v)}
        >
          <RefreshCcw size={15} />
          転職
        </button>
        <button
          className="controls-toggle"
          onClick={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setControlsOpen((v) => !v);
          }}
        >
          <Settings size={15} />
          操作設定
        </button>
        {controlsOpen && (
          <GamePanel
            title="操作・画質設定"
            className="controls-panel"
            onClose={() => setControlsOpen(false)}
          >
            <div className="panel-head">
              <div>
                <Settings size={18} />
                <b>操作・画質設定</b>
              </div>
              <button
                onClick={() => setControlsOpen(false)}
                aria-label="操作設定を閉じる"
              >
                戻る
              </button>
            </div>
            <PreferencesPanel
              value={hud.preferences || DEFAULT_PREFERENCES}
              onChange={changePreferences}
              performance={renderPerformance}
            />
            <h3>PCキー設定</h3>
            <p>変更する操作を選び、割り当てたいキーを押してください。</p>
            <div className="binding-grid">
              {(Object.keys(BINDING_LABELS) as BindingAction[]).map(
                (action) => (
                  <button
                    key={action}
                    className={listening === action ? 'listening' : ''}
                    onClick={() => {
                      listeningRef.current = action;
                      setListening(action);
                    }}
                  >
                    <span>{BINDING_LABELS[action]}</span>
                    <kbd>
                      {listening === action
                        ? 'キー入力待ち…'
                        : bindingName(bindings[action])}
                    </kbd>
                  </button>
                ),
              )}
            </div>
            <button
              className="binding-reset"
              onClick={() => {
                bindingsRef.current = { ...DEFAULT_BINDINGS };
                setBindings({ ...DEFAULT_BINDINGS });
                localStorage.setItem(
                  'makai-key-bindings',
                  JSON.stringify(DEFAULT_BINDINGS),
                );
              }}
            >
              初期設定に戻す
            </button>
            <small>
              マウス：視点 / 左クリック：通常攻撃 / 右クリック：防御・建築取消
            </small>
          </GamePanel>
        )}
        <RealmMap
          world={hud}
          open={mapOpen}
          onOpenChange={setMapOpen}
          onWaypoint={setWaypoint}
        />
        {rankOpen && (
          <GamePanel
            title="魔族ランク"
            onClose={() => setRankOpen(false)}
            className={
              'rank-panel ' + (rankEvolution !== null ? 'evolving' : '')
            }
          >
            <div className="panel-head">
              <div>
                <Shield size={18} />
                <b>魔族ランク</b>
              </div>
              <button
                onClick={() => setRankOpen(false)}
                aria-label="魔族ランクを閉じる"
              >
                戻る
              </button>
            </div>
            <div className="rank-showcase">
              <canvas
                ref={rankPreviewRef}
                aria-label={`${RANKS[hud.rank]}ランク主人公の全身3D表示`}
              />
              <div>
                <span>DEMON EVOLUTION</span>
                <b>RANK {RANKS[hud.rank]}</b>
                <p>{RANK_APPEARANCE[hud.rank]}</p>
                <small>ドラッグして全身を回転</small>
              </div>
              {rankEvolution !== null && (
                <strong>魔族進化 — {RANKS[rankEvolution]}</strong>
              )}
            </div>
            <div className="rank-track">
              {RANKS.map((r, i) => (
                <span
                  key={r}
                  className={
                    i === hud.rank ? 'current' : i < hud.rank ? 'done' : ''
                  }
                >
                  {r}
                </span>
              ))}
            </div>
            <small>次の昇格条件</small>
            <p>
              {hud.rank === 7
                ? 'すべての条件を達成し、魔王に君臨している。'
                : requirement(hud)}
            </p>
            <div className="rank-stats">
              <span>敵撃破 {hud.kills}</span>
              <span>強敵 {hud.bossKills}</span>
              <span>領土 {hud.lands}</span>
              <span>配下 {hud.minions}</span>
              <span>拠点 Lv.{hud.base}</span>
              <span>地域 {hud.discovered.length}/10</span>
            </div>
            <button
              className={'rank-up ' + (ready ? 'ready' : '')}
              onClick={rankUp}
            >
              {ready ? 'ランクアップ' : '条件未達成'}
            </button>
            <em>Lv.99だけでは魔王になれません</em>
          </GamePanel>
        )}
        {transferOpen && currentJob && (
          <GamePanel
            title="転職の祭壇"
            className="transfer-panel"
            onClose={() => setTransferOpen(false)}
          >
            <div className="panel-head">
              <div>
                <RefreshCcw size={18} />
                <b>転職の祭壇</b>
                <span>世界進行は維持・職業進行は個別</span>
              </div>
              <button
                onClick={() => setTransferOpen(false)}
                aria-label="転職を閉じる"
              >
                戻る
              </button>
            </div>
            <div className="preserved">
              <ShieldCheck />
              <div>
                <b>失われないもの</b>
                <span>
                  領土 {hud.lands}・配下 {hud.minions}・拠点 Lv.{hud.base}・実績{' '}
                  {hud.achievements}・重要所有物
                </span>
              </div>
            </div>
            <div className="career-grid">
              {JOBS.map((j) => {
                let unlocked = jobUnlocked(hud, j),
                  level = careerLevel(hud, j.id),
                  active = j.id === hud.job,
                  cost = 3 + Object.keys(hud.careers).length;
                return (
                  <button
                    key={j.id}
                    className={
                      'career-card ' +
                      (active ? 'active ' : '') +
                      (unlocked ? '' : 'locked ') +
                      j.tier
                    }
                    disabled={active || !unlocked}
                    onClick={() => changeJob(j.id)}
                    style={{ '--job-color': j.color } as React.CSSProperties}
                  >
                    <div>
                      <span>
                        {j.tier === 'advanced' ? '上位・複合職' : j.weapon}
                      </span>
                      <b>{j.name}</b>
                      <small>{j.style}</small>
                    </div>
                    <strong>
                      {active
                        ? '現在の職業'
                        : level
                          ? '保存 Lv.' + level
                          : '新規 Lv.1'}
                    </strong>
                    {!unlocked && (
                      <em>
                        <Lock />{' '}
                        {j.requires
                          ?.map((id) => JOBS.find((x) => x.id === id)?.name)
                          .join(' + ')}
                        をLv.6
                      </em>
                    )}
                    {unlocked && !active && !level && (
                      <em>代償：魔木・鉱石 各{cost}</em>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="transfer-warning">
              転職先ではLv.1・能力値・武器Lv.1から育成。以前の職業へ戻ると保存した進行を復元します。
            </p>
          </GamePanel>
        )}
        {growthOpen && currentJob && (
          <GamePanel
            title="成長ボード"
            className="growth-panel"
            onClose={() => setGrowthOpen(false)}
          >
            <div className="panel-head">
              <div>
                <Brain size={18} />
                <b>成長ボード</b>
                <span>
                  {currentJob.name} / 職業Lv.{hud.lv}
                </span>
              </div>
              <button
                onClick={() => setGrowthOpen(false)}
                aria-label="成長ボードを閉じる"
              >
                戻る
              </button>
            </div>
            <div className="growth-top">
              <div className="sp-wallet">
                <Sparkles />
                <span>使用可能スキルポイント</span>
                <b>{hud.skillPoints}</b>
                <small>レベルアップごとに3獲得</small>
              </div>
              <div className="weapon-card">
                <Swords />
                <div>
                  <span>職業専用武器</span>
                  <b>
                    {currentJob.weapon} Lv.{hud.weaponLevel}
                  </b>
                </div>
                <button onClick={upgradeWeapon}>強化</button>
              </div>
            </div>
            <div className="growth-columns">
              <section>
                <h3>能力値</h3>
                <div className="stat-list">
                  {STAT_INFO.map((s) => (
                    <div className="stat-row" key={s.id}>
                      <div>
                        <b>{s.name}</b>
                        <small>{s.desc}</small>
                      </div>
                      <strong>{hud.stats[s.id]}</strong>
                      <button
                        disabled={!hud.skillPoints}
                        onClick={() => allocate(s.id)}
                        aria-label={s.name + 'を強化'}
                      >
                        <Plus />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3>{currentJob.name} 基礎スキルツリー</h3>
                <div className="skill-tree">
                  {currentJob.skills.map((s, i) => {
                    let learned = hud.unlocked.includes(s.id),
                      available =
                        hud.lv >= s.level && hud.skillPoints >= s.cost;
                    return (
                      <button
                        key={s.id}
                        className={
                          (learned ? 'learned ' : '') +
                          (available ? 'available' : '')
                        }
                        onClick={() => learn(s)}
                      >
                        <i>{learned ? <Sparkles /> : <Lock />}</i>
                        <div>
                          <span>
                            段階 {i + 1}　Lv.{s.level}
                          </span>
                          <b>{s.name}</b>
                          <small>{s.desc}</small>
                        </div>
                        <em>{learned ? '習得済' : s.cost + ' SP'}</em>
                      </button>
                    );
                  })}
                </div>
                <div className="job-doctrine">
                  <b>戦闘スタイル</b>
                  <p>{currentJob.style}</p>
                  <span>
                    威力 ×{currentJob.power.toFixed(2)}　間合い ×
                    {currentJob.range.toFixed(2)}　速度 ×
                    {currentJob.speed.toFixed(2)}
                  </span>
                </div>
              </section>
            </div>
            <section className="milestones">
              <h3>レベル節目 — 二択スキル</h3>
              <p>
                最初の1つは無料選択。選ばなかった候補も後からSPで習得できます。
              </p>
              {milestoneGroups.map((group) => (
                <div
                  className={
                    'milestone-group ' +
                    (hud.lv >= group.level ? 'open' : 'locked')
                  }
                  key={group.level}
                >
                  <strong>Lv.{group.level}</strong>
                  <div>
                    {group.skills.map((skill) => {
                      let learned = hud.unlocked.includes(skill.id),
                        chosen = group.skills.some((s) =>
                          hud.unlocked.includes(s.id),
                        );
                      return (
                        <button
                          key={skill.id}
                          disabled={learned || hud.lv < group.level}
                          className={learned ? 'learned' : ''}
                          onClick={() => learnMilestone(group, skill)}
                        >
                          <span>
                            {learned
                              ? '習得済'
                              : chosen
                                ? skill.cost + ' SP'
                                : '無料選択'}
                          </span>
                          <b>{skill.name}</b>
                          <small>{skill.desc}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          </GamePanel>
        )}
        {buildMenuOpen && (
          <GamePanel
            title="自由建築"
            className="build-menu-panel"
            onClose={() => setBuildMenuOpen(false)}
          >
            <div className="panel-head">
              <div>
                <Hammer size={18} />
                <b>自由建築</b>
                <span>歩いて探した場所へ建築予定を配置</span>
              </div>
              <button
                onClick={() => setBuildMenuOpen(false)}
                aria-label="自由建築を閉じる"
              >
                戻る
              </button>
            </div>
            <div className="build-wallet">
              <span>
                魔木 <b>{hud.wood}</b>
              </span>
              <span>
                瘴気鉱 <b>{hud.ore}</b>
              </span>
              <span>
                建築班 <b>{taskCounts.build}体</b>
              </span>
            </div>
            <div className="building-grid">
              {BUILDINGS.map((building) => {
                const locked = hud.rank < building.rank,
                  short = hud.wood < building.wood || hud.ore < building.ore;
                return (
                  <button
                    key={building.id}
                    className={
                      (locked ? 'locked ' : '') + (short ? 'short' : '')
                    }
                    onClick={() => selectBuilding(building.id)}
                  >
                    <div>
                      <span>{building.scale}</span>
                      <b>{building.name}</b>
                      <small>{building.desc}</small>
                    </div>
                    <strong>
                      魔木 {building.wood} / 鉱石 {building.ore}
                    </strong>
                    <em>
                      {locked
                        ? `RANK ${RANKS[building.rank]}で解放`
                        : `ひとりの実作業 ${building.seconds}秒`}
                    </em>
                  </button>
                );
              })}
            </div>
            <p className="build-help">
              緑の予定地で「着工」。正面に近づき、建物を見て立ち止まると作業できます。建築班は現地到着後に参加。移動・待機時間は作業時間に含みません。
            </p>
          </GamePanel>
        )}
        {minionOpen && (
          <GamePanel
            title="配下名簿・仕事命令"
            className="minion-panel"
            onClose={() => setMinionOpen(false)}
          >
            <div className="panel-head">
              <div>
                <Users size={18} />
                <b>配下名簿・仕事命令</b>
                <span>勢力 {hud.roster.length}体 / 配置はいつでも変更可能</span>
              </div>
              <button
                onClick={() => setMinionOpen(false)}
                aria-label="配下名簿を閉じる"
              >
                戻る
              </button>
            </div>
            <div className="task-summary">
              {MINION_TASKS.map((task) => (
                <div key={task.id}>
                  <span>{task.name}</span>
                  <b>{taskCounts[task.id]}</b>
                  <small>能力 {Math.floor(taskPower(hud, task.id))}</small>
                </div>
              ))}
            </div>
            {!hud.roster.length ? (
              <div className="empty-roster">
                <Skull />
                <b>まだ配下はいない</b>
                <p>
                  領土ボス以外の魔物を倒し、金色の服従印が消える前に近づいて「配下」を実行してください。
                </p>
              </div>
            ) : (
              <div className="roster-grid">
                {hud.roster.map((unit) => {
                  const strongest = [...MINION_TASKS]
                    .sort((a, b) => unit.aptitudes[b.id] - unit.aptitudes[a.id])
                    .slice(0, 3);
                  return (
                    <article key={unit.id}>
                      <div className="minion-id">
                        <i>{unit.kind.slice(0, 1).toUpperCase()}</i>
                        <div>
                          <b>{unit.name}</b>
                          <span>
                            戦力階級 {unit.tier} /{' '}
                            {unit.commanderId ? '隊員' : '独立・隊長'}
                          </span>
                        </div>
                      </div>
                      <div className="aptitudes">
                        {strongest.map((task) => (
                          <span key={task.id}>
                            {task.name} <b>{unit.aptitudes[task.id]}</b>
                          </span>
                        ))}
                      </div>
                      <label>
                        現在の命令
                        <select
                          value={unit.assignment}
                          onChange={(event) =>
                            assignMinion(
                              unit.id,
                              event.target.value as MinionTask,
                            )
                          }
                        >
                          {MINION_TASKS.map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.name} — {task.desc}
                            </option>
                          ))}
                        </select>
                      </label>
                    </article>
                  );
                })}
              </div>
            )}
          </GamePanel>
        )}
        <div className="quest-card">
          <span>現在地</span>
          <b>{current.landmark}</b>
          <small>
            {subBiomeAt(hud.x, hud.y)} /{' '}
            {currentOwner === 'enemy'
              ? '敵勢力が支配中'
              : currentOwner === 'own'
                ? 'あなたの支配地'
                : 'まだ誰の領土でもない'}
          </small>
        </div>
        <div className="notice" role="status">
          {hud.message}
        </div>
        {!!activeConstructions.length && (
          <div className="construction-status">
            {activeConstructions.slice(0, 2).map((site) => {
              const progress = Math.min(
                100,
                (site.progress / site.duration) * 100,
              );
              return (
                <div key={site.id}>
                  <span>
                    <Hammer /> {site.name}
                    <b>{Math.floor(progress)}%</b>
                  </span>
                  <i>
                    <em style={{ width: `${progress}%` }} />
                  </i>
                  <small>
                    {site.playerWorking
                      ? '主人公が作業中'
                      : site.workers
                        ? '配下が作業中'
                        : '正面へ近づき、建物を見ると作業'}
                    {site.workers > 0 && ` · ${site.workers}体`}
                  </small>
                </div>
              );
            })}
          </div>
        )}
        <div className="combat-controls">
          <button className="action attack" onClick={attack}>
            <Swords />
            <span>攻撃</span>
            <kbd>左クリック</kbd>
          </button>
          <button className="action heavy" onClick={heavyAttack}>
            <Hammer />
            <span>強攻撃</span>
            <kbd>{bindingName(bindings.heavy)}</kbd>
          </button>
          <button
            className={'action guard ' + (hud.guarding ? 'active' : '')}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              game.current.guarding = true;
              sync();
            }}
            onPointerUp={() => {
              game.current.guarding = false;
              sync();
            }}
            onPointerLeave={() => {
              game.current.guarding = false;
            }}
            onPointerCancel={() => {
              game.current.guarding = false;
              sync();
            }}
            onLostPointerCapture={() => {
              game.current.guarding = false;
            }}
          >
            <Shield />
            <span>防御</span>
            <kbd>右クリック / {bindingName(bindings.guard)}</kbd>
          </button>
          <button className="action evade" onClick={dodge}>
            <Wind />
            <span>回避</span>
            <kbd>{bindingName(bindings.dodge)}</kbd>
          </button>
          <button className="action combat-skill" onClick={useCombatSkill}>
            <Zap />
            <span>
              {hud.skillCd > 0
                ? `スキル ${Math.ceil(hud.skillCd)}秒`
                : 'スキル'}
            </span>
            <kbd>{bindingName(bindings.skill)}</kbd>
          </button>
          <button className="action jump" onClick={jump}>
            <ChevronUp />
            <span>跳ぶ</span>
            <kbd>{bindingName(bindings.jump)}</kbd>
          </button>
        </div>
        <div className="utility-controls">
          <button
            onClick={recruit}
            className={recruitReady ? 'recruit-ready' : undefined}
          >
            <Users />
            服従 <kbd>{bindingName(bindings.recruit)}</kbd>
          </button>
          <button onClick={gather}>
            <Sparkles />
            調べる <kbd>{bindingName(bindings.gather)}</kbd>
          </button>
          <button
            onClick={() => {
              if (document.pointerLockElement) document.exitPointerLock();
              setMinionOpen((open) => !open);
            }}
          >
            <ShieldCheck />
            配下管理
          </button>
          <button className={hud.buildMode ? 'active' : ''} onClick={build}>
            <Hammer />
            {hud.buildMode ? '配置取消' : '建築配置'}
          </button>
          <button onClick={raid}>
            <Skull />
            領土戦
          </button>
        </div>
        <div className="resources">
          <span>
            魔木 <b>{hud.wood}</b>
          </span>
          <span>
            瘴気鉱 <b>{hud.ore}</b>
          </span>
        </div>
        <button
          className={`auto-run-button ${hud.autoRun ? 'active' : ''}`}
          onClick={toggleAutoRun}
          aria-pressed={hud.autoRun}
        >
          <Footprints />
          <span>{hud.autoRun ? '自動移動を停止' : '自動前進'}</span>
          <kbd>{bindingName(bindings.autoRun)}</kbd>
        </button>
        <div
          className="joystick"
          role="group"
          aria-label="移動スティック。外側でダッシュ"
          onPointerDown={(e) => {
            if (
              joystickPointer.current !== null &&
              e.currentTarget.hasPointerCapture(joystickPointer.current)
            )
              return;
            joystickPointer.current = e.pointerId;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            updateJoystick(e);
          }}
          onPointerMove={(e) => {
            if (!stick.current.on || e.pointerId !== joystickPointer.current)
              return;
            updateJoystick(e);
          }}
          onPointerUp={releaseJoystick}
          onPointerCancel={releaseJoystick}
          onLostPointerCapture={releaseJoystick}
        >
          <i
            style={{
              transform: `translate(${stick.current.x * 28}px, ${stick.current.y * 28}px)`,
            }}
          />
        </div>
        <div className="hint">
          <Binoculars size={14} />
          WASD移動 / マウス視点 / Shiftダッシュ —
          遠くの巨大建造物まで歩いて到達できる
        </div>
      </section>
      <section className="legend">
        <div>
          <b>自由探索</b>
          <span>10の巨大領域を境界なしで移動</span>
        </div>
        <div>
          <b>領土侵入</b>
          <span>偵察・前線建築を経て領主本拠地へ進軍</span>
        </div>
        <div>
          <b>条件制ランク</b>
          <span>レベル・領土・配下・実績を揃えて昇格</span>
        </div>
      </section>
    </main>
  );
}
