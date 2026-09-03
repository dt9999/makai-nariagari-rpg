'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Binoculars,
  Brain,
  Castle,
  ChevronUp,
  Crosshair,
  Flame,
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
import { createDemonPreview, createGame3D } from './game3d';

type Owner = 'unknown' | 'wild' | 'enemy' | 'own';
type MonsterKind =
  | 'imp'
  | 'beast'
  | 'insect'
  | 'golem'
  | 'flying'
  | 'plant'
  | 'slime'
  | 'armored'
  | 'aberration';
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
type BaseSite = {
  id: number;
  x: number;
  y: number;
  yaw: number;
  level: number;
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
  | 'map';
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
  map: 'm',
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
  gather: '採集',
  map: '地図',
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
  dodgeCd: number;
  dodgeTime: number;
  skillCd: number;
  heavyCd: number;
  attackAnim: number;
  attackTotal: number;
  attackKind: 'none' | 'normal' | 'heavy' | 'skill';
  hitAnim: number;
  buildAnim: number;
  buildMode: boolean;
  buildYaw: number;
  bases: BaseSite[];
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
const WORLD_WIDTH = 16000;
const WORLD_HEIGHT = 9000;
const REGION_W = 3200;
const REGION_H = 4500;
const REGIONS: Region[] = [
  {
    id: 'ruins',
    name: '忘れられた大廃墟',
    x: 0,
    y: 0,
    w: REGION_W,
    h: REGION_H,
    biome: '廃墟',
    color: '#353347',
    owner: 'own',
    landmark: '始まりの地下砦',
  },
  {
    id: 'forest',
    name: '囁きの魔樹海',
    x: 3200,
    y: 0,
    w: REGION_W,
    h: REGION_H,
    biome: '森',
    color: '#163d38',
    owner: 'enemy',
    landmark: '千年魔樹の集落',
  },
  {
    id: 'mountain',
    name: '骸骨連峰',
    x: 6400,
    y: 0,
    w: REGION_W,
    h: REGION_H,
    biome: '岩山',
    color: '#403945',
    owner: 'enemy',
    landmark: '白骨山塞',
  },
  {
    id: 'citadel',
    name: '黒曜城塞領',
    x: 9600,
    y: 0,
    w: REGION_W,
    h: REGION_H,
    biome: '砦',
    color: '#44202b',
    owner: 'enemy',
    landmark: '黒曜大城壁',
  },
  {
    id: 'ashland',
    name: '灰冠の塔領',
    x: 12800,
    y: 0,
    w: REGION_W,
    h: REGION_H,
    biome: '塔',
    color: '#302b43',
    owner: 'enemy',
    landmark: '天を穿つ灰冠塔',
  },
  {
    id: 'waste',
    name: '赤錆大荒野',
    x: 0,
    y: 4500,
    w: REGION_W,
    h: REGION_H,
    biome: '荒野',
    color: '#563328',
    owner: 'enemy',
    landmark: '巨人の監視塔',
  },
  {
    id: 'village',
    name: '薄暮都市圏',
    x: 3200,
    y: 4500,
    w: REGION_W,
    h: REGION_H,
    biome: '魔族集落',
    color: '#3e2546',
    owner: 'enemy',
    landmark: '角笛の城下町',
  },
  {
    id: 'cave',
    name: '底無し洞窟領',
    x: 6400,
    y: 4500,
    w: REGION_W,
    h: REGION_H,
    biome: '洞窟',
    color: '#1b2637',
    owner: 'enemy',
    landmark: '深淵王の大裂け目',
  },
  {
    id: 'volcano',
    name: '業火火山帯',
    x: 9600,
    y: 4500,
    w: REGION_W,
    h: REGION_H,
    biome: '火山',
    color: '#54221e',
    owner: 'enemy',
    landmark: '煉獄火口神殿',
  },
  {
    id: 'castle',
    name: '魔王城外郭領',
    x: 12800,
    y: 4500,
    w: REGION_W,
    h: REGION_H,
    biome: '城',
    color: '#281b3f',
    owner: 'enemy',
    landmark: '封印された巨城',
  },
];
const regionAt = (x: number, y: number) =>
  REGIONS.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ||
  REGIONS[0];
const ownerOf = (w: World, r: Region): Owner =>
  w.conquered.includes(r.id) ? 'own' : r.owner;
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
    Array.from({ length: 10 }, (_, i) => {
      const tier = Math.min(
        6,
        1 + Math.floor(regionIndex / 2) + (i % 3 === 2 ? 1 : 0),
      );
      const species = (MONSTER_ECOLOGY[region.biome] ||
          MONSTER_ECOLOGY['廃墟'])[i % 4],
        speciesIndex = i % 4,
        packIndex = Math.floor(i / 4),
        packAngle = packIndex * 2.35 + speciesIndex * 0.4,
        packRadius = 80 + packIndex * 58,
        hp = 30 + tier * 22;
      return {
        id: regionIndex * 20 + i + 1,
        x:
          region.x +
          690 +
          (speciesIndex % 2) * 1780 +
          Math.cos(packAngle) * packRadius,
        y:
          region.y +
          980 +
          Math.floor(speciesIndex / 2) * 2320 +
          Math.sin(packAngle) * packRadius,
        name: species.name,
        kind: species.kind,
        variant: (regionIndex * 3 + i) % 5,
        tier,
        hp,
        max: hp,
        home: region.id,
      };
    }),
  );
const resources = (): Node[] =>
  Array.from({ length: 120 }, (_, i) => ({
    id: i,
    x: 180 + ((i * 1877) % (WORLD_WIDTH - 360)),
    y: 180 + ((i * 1297) % (WORLD_HEIGHT - 360)),
    kind: i % 2 ? 'wood' : 'ore',
    n: 3 + (i % 3),
  }));
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
  x: 900,
  y: 1250,
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
  dodgeCd: 0,
  dodgeTime: 0,
  skillCd: 0,
  heavyCd: 0,
  attackAnim: 0,
  attackTotal: 0.62,
  attackKind: 'none',
  hitAnim: 0,
  buildAnim: 0,
  buildMode: false,
  buildYaw: 0,
  bases: [{ id: 1, x: 930, y: 1170, yaw: 0, level: 1 }],
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
  lands: 1,
  kills: 0,
  bossKills: 0,
  achievements: 0,
  mobs: spawn(),
  nodes: resources(),
  discovered: ['ruins'],
  conquered: ['ruins'],
  message: '職業を選び、魔王への一歩を踏み出せ。',
  banner: '自分の領土',
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
  w.maxHp = 100 + w.stats.life * 12 + (w.lv - 1) * 8 + w.base * 12;
  w.hp = w.maxHp;
  w.energy = w.maxEnergy;
};

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null),
    rankCanvas = useRef<HTMLCanvasElement>(null),
    game = useRef(fresh()),
    keys = useRef<Record<string, boolean>>({}),
    stick = useRef({ x: 0, y: 0, on: false }),
    lookTouch = useRef({ id: -1, x: 0, y: 0 }),
    bindingsRef = useRef({ ...DEFAULT_BINDINGS }),
    listeningRef = useRef<BindingAction | null>(null),
    [hud, setHud] = useState<World>(fresh),
    [mapOpen, setMapOpen] = useState(false),
    [rankOpen, setRankOpen] = useState(false),
    [growthOpen, setGrowthOpen] = useState(false),
    [transferOpen, setTransferOpen] = useState(false),
    [controlsOpen, setControlsOpen] = useState(false),
    [rankEvolution, setRankEvolution] = useState<number | null>(null),
    [bindings, setBindings] = useState({ ...DEFAULT_BINDINGS }),
    [listening, setListening] = useState<BindingAction | null>(null);
  const sync = useCallback(
    () =>
      setHud({
        ...game.current,
        stats: { ...game.current.stats },
        unlocked: [...game.current.unlocked],
        careers: { ...game.current.careers },
        mobs: [...game.current.mobs],
        nodes: [...game.current.nodes],
        bases: [...game.current.bases],
        pendingHits: [...game.current.pendingHits],
        discovered: [...game.current.discovered],
        conquered: [...game.current.conquered],
      }),
    [],
  );
  const say = (s: string) => {
    game.current.message = s;
    sync();
  };
  const targetsAhead = (w: World, range: number, cone = 0.42) =>
    w.mobs
      .filter((mob) => {
        if (mob.ally || mob.dead) return false;
        const distance = d(w, mob) || 1;
        const aim =
          ((mob.x - w.x) * w.facingX + (mob.y - w.y) * w.facingY) / distance;
        return distance < range && aim > cone;
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
    w.message = jobOf(w).weapon + 'をLv.' + w.weaponLevel + 'へ強化！';
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
    t.dead = true;
    t.deathAnim = 1.15;
    t.hitAnim = 0.32;
    w.kills++;
    if (t.boss) {
      w.bossKills++;
      if (!w.conquered.includes(t.home)) {
        w.conquered.push(t.home);
        w.lands++;
      }
      w.achievements++;
      w.message =
        t.name + 'を撃破！ ' + regionAt(t.x, t.y).name + 'を領土にした。';
    } else {
      w.ore++;
      gain(12 + t.tier * 5);
      w.message = t.name + 'を撃破。瘴気鉱を獲得。';
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
    if (!t) return say(j.weapon + 'の攻撃範囲に敵がいない。');
    let branchPower =
        1 + w.unlocked.filter((s) => s.endsWith('a')).length * 0.08,
      hit = Math.floor(
        (12 +
          w.lv * 4 +
          w.weaponLevel * 4 +
          w.stats.strength * 3 +
          w.stats.magic * 4 * j.magic +
          w.minions * j.minion * (2 + w.stats.leadership * 0.3)) *
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
    w.cd = 0.38 / (j.speed * (1 + w.stats.agility * 0.025));
    w.attackTotal = 0.62;
    w.attackAnim = w.attackTotal;
    w.attackKind = 'normal';
    w.message = j.name + 'が構え、' + j.weapon + 'で踏み込む！';
    sync();
  };
  const heavyAttack = () => {
    let w = game.current;
    if (!w.job || w.heavyCd > 0 || w.energy < 28 || w.guarding) return;
    let j = jobOf(w),
      t = targetsAhead(w, 125 * j.range, 0.25)[0];
    if (!t) return say('強攻撃の間合いに敵がいない。');
    let hit = Math.floor(
      (20 +
        w.lv * 6 +
        w.weaponLevel * 7 +
        w.stats.strength * 5 +
        w.stats.magic * 3 * j.magic) *
        j.power *
        1.65,
    );
    if (w.unlocked.includes('crusher') && t.boss) hit = Math.floor(hit * 1.35);
    queueHit(w, t, hit, 0.51, 35);
    w.energy -= 28;
    w.heavyCd = 1.1;
    w.attackTotal = 0.96;
    w.attackAnim = w.attackTotal;
    w.attackKind = 'heavy';
    w.message = '重心を落とし、渾身の一撃を振りかぶる！';
    sync();
  };
  const dodge = () => {
    let w = game.current;
    if (!w.job || w.dodgeCd > 0 || w.energy < 22) return;
    w.energy -= 22;
    w.dodgeCd = 0.82;
    w.dodgeTime = 0.48;
    w.x = Math.max(30, Math.min(WORLD_WIDTH - 30, w.x + w.facingX * 95));
    w.y = Math.max(30, Math.min(WORLD_HEIGHT - 30, w.y + w.facingY * 95));
    w.message = '回避！ 身を沈めて攻撃をすり抜けた。';
    sync();
  };
  const useCombatSkill = () => {
    let w = game.current;
    if (!w.job || w.skillCd > 0 || w.energy < 35) return;
    let j = jobOf(w),
      targets = targetsAhead(w, 155 * j.range, 0.05).slice(0, 6);
    if (!targets.length) return say('スキルの範囲に敵がいない。');
    let hit = Math.floor(
        (25 +
          w.lv * 5 +
          w.weaponLevel * 5 +
          w.stats.magic * 7 +
          w.stats.strength * 3) *
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
    let w = game.current;
    if (!w.job) return say('先に職業を選択しよう。');
    let threshold =
        0.48 +
        w.stats.leadership * 0.012 +
        (w.job === 'ruler' ? 0.12 : 0) +
        (w.unlocked.includes('dominate') ? 0.12 : 0),
      t = w.mobs.find(
        (m) =>
          !m.ally &&
          !m.boss &&
          !m.dead &&
          m.hp / m.max <= threshold &&
          d(w, m) < 110,
      );
    if (!t)
      return say(
        '敵を弱らせよう。現在の勧誘可能HP：' +
          Math.round(threshold * 100) +
          '%以下。',
      );
    t.ally = true;
    t.hp = t.max;
    t.attackAnim = 0;
    t.attackCd = 0;
    w.minions++;
    if (w.minions === 1) w.achievements++;
    w.message = t.name + 'が' + jobOf(w).name + 'に服従した！';
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
    let w = game.current,
      n = w.nodes.find((n) => n.n && d(w, n) < 75);
    if (!n) return say('光る魔木・瘴気鉱の近くで採集できる。');
    n.n--;
    if (n.kind === 'wood') w.wood++;
    else w.ore++;
    w.message = n.kind === 'wood' ? '魔木を採集した。' : '瘴気鉱を採集した。';
    sync();
  };
  const build = () => {
    const w = game.current;
    const c = w.base + 2;
    if (w.buildMode) {
      w.buildMode = false;
      w.message = '建築予定を取り消した。';
      sync();
      return;
    }
    if (w.wood < c || w.ore < c)
      return say('拠点強化には魔木・瘴気鉱 各' + c + 'が必要。');
    w.buildMode = true;
    w.buildYaw = w.viewYaw;
    w.message = '建築予定地を確認中。視点で位置を決め、左クリックで建築開始。';
    sync();
  };
  const confirmBuild = () => {
    const w = game.current;
    if (!w.buildMode) return;
    const c = w.base + 2;
    if (w.wood < c || w.ore < c) {
      w.buildMode = false;
      return say('建築中に必要素材が不足した。');
    }
    w.wood -= c;
    w.ore -= c;
    w.base++;
    w.maxHp += 12;
    w.hp = w.maxHp;
    w.achievements++;
    w.buildAnim = 5.5;
    w.buildMode = false;
    w.bases.push({
      id: w.bases.length + 1,
      x: w.x + w.facingX * 320,
      y: w.y + w.facingY * 320,
      yaw: w.viewYaw,
      level: w.base,
    });
    w.message =
      '配下が前線基地の建築を開始した。完成後は内部へ入り利用できる。';
    sync();
  };
  const raid = () => {
    let w = game.current,
      r = regionAt(w.x, w.y);
    if (ownerOf(w, r) !== 'enemy')
      return say('敵領土のランドマーク付近で領土ボスを呼び出せる。');
    const headquarters = { x: r.x + r.w * 0.68, y: r.y + r.h * 0.5 };
    if (d(w, headquarters) > 620)
      return say(
        '領主の本拠地はまだ遠い。敵領土を偵察し、巨大建造物を目指そう。',
      );
    if (w.mobs.some((m) => m.boss && !m.dead && m.home === r.id))
      return say('この領土の支配者はすでに出現している。');
    let required = Math.max(2, REGIONS.indexOf(r) - 1);
    if (w.lv < required)
      return say('この領土の瘴気は強すぎる。推奨Lv.' + required + '。');
    const lord = TERRITORY_LORDS[r.id] || {
      name: r.name + 'の異形領主',
      kind: 'aberration' as MonsterKind,
    };
    w.mobs.push({
      id: 10000 + w.bossKills,
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
    const rotateView = (dx: number, dy: number, sensitivity = 0.0022) => {
      const w = game.current;
      w.viewYaw -= dx * sensitivity;
      w.viewPitch = Math.max(
        -1.2,
        Math.min(1.2, w.viewPitch - dy * sensitivity),
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
      keys.current[key] = true;
      const map = bindingsRef.current;
      if (key === map.jump) {
        e.preventDefault();
        jump();
      }
      if (key === map.heavy) heavyAttack();
      if (key === map.skill) useCombatSkill();
      if (key === map.dodge) dodge();
      if (key === map.recruit) recruit();
      if (key === map.gather) gather();
      if (key === map.map) setMapOpen((v) => !v);
      if (key === map.guard) game.current.guarding = true;
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys.current[key] = false;
      if (key === bindingsRef.current.guard) game.current.guarding = false;
    };
    const mouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        if (game.current.buildMode) confirmBuild();
        else attack();
        if (document.pointerLockElement !== c) void c.requestPointerLock();
      }
      if (e.button === 2) {
        if (game.current.buildMode) build();
        else game.current.guarding = true;
      }
    };
    const mouseUp = (e: MouseEvent) => {
      if (e.button === 2) game.current.guarding = false;
    };
    const mouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === c)
        rotateView(e.movementX, e.movementY);
    };
    const pointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
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
    if (!c) return;
    const view = createGame3D(c, REGIONS);
    let last = performance.now(),
      frame = 0,
      id = 0;
    const loop = (now: number) => {
      let dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      frame++;
      const w = game.current;
      const held = (action: BindingAction) =>
        !!keys.current[bindingsRef.current[action]];
      const strafe =
          (held('right') ? 1 : 0) -
          (held('left') ? 1 : 0) +
          (stick.current.on ? stick.current.x : 0),
        forward =
          (held('forward') ? 1 : 0) -
          (held('back') ? 1 : 0) -
          (stick.current.on ? stick.current.y : 0),
        intent = Math.min(1, Math.hypot(strafe, forward)),
        length = Math.hypot(strafe, forward) || 1,
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
        sprinting = held('sprint') && intent > 0.2 && w.energy > 1,
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
      w.x = Math.max(
        30,
        Math.min(
          WORLD_WIDTH - 30,
          w.x + directionX * move * sprintBoost * intent * dt * actionSlow,
        ),
      );
      w.y = Math.max(
        30,
        Math.min(
          WORLD_HEIGHT - 30,
          w.y + directionY * move * sprintBoost * intent * dt * actionSlow,
        ),
      );
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
      w.buildAnim = Math.max(0, w.buildAnim - dt);
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
        if (!t || t.dead) return;
        t.hp -= hit.damage;
        t.hitAnim = 0.34;
        if (hit.knockback) {
          let q = d(w, t) || 1;
          t.x += ((t.x - w.x) / q) * hit.knockback;
          t.y += ((t.y - w.y) / q) * hit.knockback;
        }
        if (t.hp <= 0) defeat(w, t);
      });
      w.bannerTime = Math.max(0, w.bannerTime - dt);
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
      w.mobs.forEach((m) => {
        m.attackCd = Math.max(0, (m.attackCd || 0) - dt);
        m.hitAnim = Math.max(0, (m.hitAnim || 0) - dt);
        if (m.dead) {
          m.deathAnim = Math.max(0, (m.deathAnim || 0) - dt);
          return;
        }
        const behavior = behaviorOf(m),
          q = d(w, m) || 1,
          reach = behavior.reach * (m.boss ? 2.35 : 1),
          detect = behavior.detect * (m.boss ? 1.55 : 1);
        let target: Mob | undefined;
        if (m.ally) {
          target = w.mobs
            .filter((x) => !x.ally && !x.dead)
            .sort((a, b) => d(m, a) - d(m, b))[0];
          const tq = target ? d(m, target) || 1 : 999;
          if (target && tq < detect) {
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
          } else if (q > 80 && !(m.attackAnim || 0)) {
            const followSpeed =
              Math.max(54, behavior.speed) + w.stats.leadership * 2;
            m.x += ((w.x - m.x) / q) * followSpeed * dt;
            m.y += ((w.y - m.y) / q) * followSpeed * dt;
          }
        } else {
          if (q < detect && q > reach && !(m.attackAnim || 0)) {
            const chaseSpeed = behavior.speed * (m.boss ? 0.78 : 1),
              strafe =
                m.kind === 'insect' || m.kind === 'flying'
                  ? Math.sin(now * 0.005 + m.id) * chaseSpeed * 0.28
                  : 0;
            m.x +=
              (((w.x - m.x) / q) * chaseSpeed + ((w.y - m.y) / q) * strafe) *
              dt;
            m.y +=
              (((w.y - m.y) / q) * chaseSpeed - ((w.x - m.x) / q) * strafe) *
              dt;
          } else if (q <= reach && (m.attackCd || 0) <= 0) {
            m.attackTotal = behavior.attack * (m.boss ? 1.18 : 1);
            m.attackAnim = m.attackTotal;
            m.attackCd = behavior.cooldown * (m.boss ? 1.12 : 1);
            m.attackHit = false;
          } else if (
            q >= detect &&
            behavior.wander > 0 &&
            !(m.attackAnim || 0)
          ) {
            const home = REGIONS.find((region) => region.id === m.home),
              angle = now * 0.00022 * (1 + behavior.wander / 20) + m.id * 1.71;
            m.x += Math.cos(angle) * behavior.wander * dt;
            m.y += Math.sin(angle * 0.83) * behavior.wander * dt;
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
        if ((m.attackAnim || 0) > 0) {
          let progress = 1 - (m.attackAnim || 0) / (m.attackTotal || 0.78);
          if (progress > 0.5 && !m.attackHit) {
            m.attackHit = true;
            if (m.ally) {
              let victim = w.mobs.find(
                (x) => x.id === m.attackTarget && !x.dead,
              );
              if (victim && d(m, victim) < reach + 25) {
                victim.hp -= Math.max(
                  2,
                  3 + m.tier * 2 + Math.floor(w.stats.leadership * 0.8),
                );
                victim.hitAnim = 0.3;
                if (victim.hp <= 0) defeat(w, victim);
              }
            } else if (d(w, m) < reach + 28 && w.dodgeTime <= 0) {
              let branchGuard =
                  1 - w.unlocked.filter((s) => s.endsWith('b')).length * 0.08,
                harm = Math.max(
                  1,
                  Math.floor(
                    ((m.boss ? 13 : 3 + m.tier) -
                      Math.floor(w.stats.defense * 0.55)) *
                      branchGuard,
                  ),
                );
              if (w.guarding) {
                harm = Math.max(1, Math.floor(harm * 0.28));
                w.energy = Math.max(0, w.energy - 10);
              }
              w.hp -= harm;
              w.hitAnim = 0.34;
            }
          }
          m.attackAnim = Math.max(0, (m.attackAnim || 0) - dt);
        }
      });
      w.mobs = w.mobs.filter((m) => !m.dead || (m.deathAnim || 0) > 0);
      if (w.hp <= 0) {
        if (w.job === 'berserker' && w.unlocked.includes('undying')) {
          w.hp = 1;
          w.unlocked = w.unlocked.filter((s) => s !== 'undying');
          w.message = '不死の執念で致命傷に耐えた！';
        } else {
          w.x = 900;
          w.y = 1250;
          w.viewYaw = 0;
          w.viewPitch = 0;
          w.hp = w.maxHp;
          w.message = '敗北。忘れられた廃墟へ撤退した。';
        }
      }
      view.render(w, dt);
      if (frame % 10 === 0) sync();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      view.dispose();
    };
  }, [sync]);
  useEffect(() => {
    if (!rankOpen || !rankCanvas.current || !hud.job) return;
    const preview = createDemonPreview(rankCanvas.current, hud.job, hud.rank);
    return () => preview.dispose();
  }, [rankOpen, hud.job, hud.rank]);
  useEffect(() => {
    if (rankEvolution === null) return;
    const timeout = setTimeout(() => setRankEvolution(null), 2600);
    return () => clearTimeout(timeout);
  }, [rankEvolution]);
  const current = regionAt(hud.x, hud.y),
    currentOwner = ownerOf(hud, current),
    need = hud.lv * 34,
    ready = canRank(hud),
    currentJob = JOBS.find((j) => j.id === hud.job),
    milestoneGroups = currentJob ? milestonesFor(currentJob.id) : [];
  return (
    <main className="game-shell">
      <section className="game-frame open-world">
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
        {hud.job && (
          <>
            <div className="fps-crosshair" aria-hidden="true">
              <i />
              <i />
            </div>
            <div className="fps-lock-hint">
              <Crosshair size={13} />
              画面をクリックして視点固定
            </div>
          </>
        )}
        {hud.buildMode && (
          <div className="build-placement">
            <Hammer size={15} />
            <div>
              <b>前線基地を配置</b>
              <span>
                視点で位置・向きを確認　左クリック：決定 / 右クリック：取消
              </span>
            </div>
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
        {hud.bannerTime > 0 && (
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
          <div className="controls-panel">
            <div className="panel-head">
              <div>
                <Settings size={18} />
                <b>PCキー設定</b>
              </div>
              <button onClick={() => setControlsOpen(false)}>×</button>
            </div>
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
          </div>
        )}
        {mapOpen && (
          <div className="world-map">
            <div className="panel-head">
              <div>
                <Map size={18} />
                <b>魔界広域図</b>
              </div>
              <button onClick={() => setMapOpen(false)}>×</button>
            </div>
            <div className="map-grid">
              {REGIONS.map((r) => {
                let seen = hud.discovered.includes(r.id),
                  here = r.id === current.id,
                  territory = ownerOf(hud, r);
                return (
                  <div
                    key={r.id}
                    className={
                      'map-cell ' +
                      (seen ? territory : 'unknown') +
                      (here ? ' here' : '')
                    }
                  >
                    <span>{seen ? r.biome : '未探索'}</span>
                    <b>{seen ? r.name : '？？？'}</b>
                    {here && <i>現在地</i>}
                  </div>
                );
              })}
            </div>
            <div className="map-legend">
              <span>
                <i className="own" />
                自領
              </span>
              <span>
                <i className="enemy" />
                敵領
              </span>
              <span>
                <i className="wild" />
                未支配
              </span>
              <span>
                <i className="unknown" />
                未探索
              </span>
            </div>
          </div>
        )}
        {rankOpen && (
          <div
            className={
              'rank-panel ' + (rankEvolution !== null ? 'evolving' : '')
            }
          >
            <div className="panel-head">
              <div>
                <Shield size={18} />
                <b>魔族ランク</b>
              </div>
              <button onClick={() => setRankOpen(false)}>×</button>
            </div>
            <div className="rank-showcase">
              <canvas
                ref={rankCanvas}
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
          </div>
        )}
        {transferOpen && currentJob && (
          <div className="transfer-panel">
            <div className="panel-head">
              <div>
                <RefreshCcw size={18} />
                <b>転職の祭壇</b>
                <span>世界進行は維持・職業進行は個別</span>
              </div>
              <button onClick={() => setTransferOpen(false)}>×</button>
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
          </div>
        )}
        {growthOpen && currentJob && (
          <div className="growth-panel">
            <div className="panel-head">
              <div>
                <Brain size={18} />
                <b>成長ボード</b>
                <span>
                  {currentJob.name} / 職業Lv.{hud.lv}
                </span>
              </div>
              <button onClick={() => setGrowthOpen(false)}>×</button>
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
          </div>
        )}
        <div className="quest-card">
          <span>現在地</span>
          <b>{current.landmark}</b>
          <small>
            {current.biome} /{' '}
            {currentOwner === 'enemy'
              ? '敵勢力が支配中'
              : currentOwner === 'own'
                ? 'あなたの支配地'
                : 'まだ誰の領土でもない'}
          </small>
        </div>
        <div className="notice">{hud.message}</div>
        <div className="combat-controls">
          <button className="action attack" onClick={attack}>
            <Swords />
            <span>通常攻撃</span>
            <kbd>左クリック</kbd>
          </button>
          <button className="action heavy" onClick={heavyAttack}>
            <Hammer />
            <span>強攻撃</span>
            <kbd>{bindingName(bindings.heavy)}</kbd>
          </button>
          <button
            className={'action guard ' + (hud.guarding ? 'active' : '')}
            onPointerDown={() => {
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
            <span>スキル</span>
            <kbd>{bindingName(bindings.skill)}</kbd>
          </button>
          <button className="action jump" onClick={jump}>
            <ChevronUp />
            <span>ジャンプ</span>
            <kbd>{bindingName(bindings.jump)}</kbd>
          </button>
        </div>
        <div className="utility-controls">
          <button onClick={recruit}>
            <Users />
            配下 <kbd>{bindingName(bindings.recruit)}</kbd>
          </button>
          <button onClick={gather}>
            <Sparkles />
            採集 <kbd>{bindingName(bindings.gather)}</kbd>
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
        <div
          className="joystick"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            stick.current.on = true;
          }}
          onPointerMove={(e) => {
            if (!stick.current.on) return;
            let r = e.currentTarget.getBoundingClientRect();
            stick.current.x = Math.max(
              -1,
              Math.min(1, (e.clientX - r.left - r.width / 2) / (r.width / 2)),
            );
            stick.current.y = Math.max(
              -1,
              Math.min(1, (e.clientY - r.top - r.height / 2) / (r.height / 2)),
            );
          }}
          onPointerUp={() => (stick.current = { x: 0, y: 0, on: false })}
        >
          <i />
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
