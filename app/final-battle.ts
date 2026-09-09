import { SCALE } from './world.ts';

export type FinalBattleStatus = {
  canStart: boolean;
  label: string;
  message: string;
};

type Fortress = {
  x: number;
  y: number;
  kind: string;
  complete: boolean;
};

/** One source of truth for the final menu hint and the actual summon gate. */
export function finalBattleStatus(
  state: {
    x: number;
    y: number;
    rank: number;
    heroDefeated: boolean;
  },
  bases: Fortress[],
  heroActive = false,
): FinalBattleStatus {
  if (state.heroDefeated)
    return {
      canStart: false,
      label: '勇者撃破 — 魔界統一',
      message: '勇者は倒れた。最弱から始まった魔族が、魔界の王となった。',
    };
  if (state.rank < 7)
    return {
      canStart: false,
      label: '魔王即位後に解放',
      message: '魔族ランクを魔王まで高めると、人界の勇者が動き出す。',
    };
  const castle = [...bases]
    .reverse()
    .find((site) => site.complete && site.kind === 'demon-castle');
  if (!castle)
    return {
      canStart: false,
      label: '魔王城の完成が必要',
      message: '勇者を迎え撃つ象徴として、完成した魔王城が必要だ。',
    };
  if (heroActive)
    return {
      canStart: false,
      label: '勇者と最終決戦中',
      message: '魔王城の前で勇者との最終決戦が続いている。',
    };
  const distance = Math.hypot(state.x - castle.x, state.y - castle.y);
  if (distance > 620) {
    const metres = Math.max(1, Math.round(distance * SCALE));
    return {
      canStart: false,
      label: `魔王城まで ${metres}m`,
      message: `最終決戦は魔王城で始まる。城まで約${metres}m。`,
    };
  }
  return {
    canStart: true,
    label: '勇者を迎え撃つ',
    message: '勇者が魔界へ到達した。魔王城で最終決戦を始められる。',
  };
}

export function finalCastle<T extends Fortress>(bases: T[]) {
  return [...bases]
    .reverse()
    .find((site) => site.complete && site.kind === 'demon-castle');
}
