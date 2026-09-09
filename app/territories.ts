import { REGIONS, SCALE, headquartersOf, type Region } from './world.ts';

type Holdings = { conquered: string[]; lands: number };

export function initialHoldings(): Holdings {
  return { conquered: [], lands: 0 };
}

export function territoryOwner(
  state: Pick<Holdings, 'conquered'>,
  region: Pick<Region, 'id' | 'owner'>,
) {
  return state.conquered.includes(region.id) ? 'own' : region.owner;
}

/** A small shelter is property, not ownership of the entire surrounding territory. */
export function conquerTerritory(state: Holdings, regionId: string) {
  if (
    !REGIONS.some((region) => region.id === regionId) ||
    state.conquered.includes(regionId)
  )
    return false;
  state.conquered.push(regionId);
  state.lands = state.conquered.length;
  return true;
}

export function territoryBossId(regionId: string) {
  const index = REGIONS.findIndex((region) => region.id === regionId);
  if (index < 0) throw new Error(`Unknown territory: ${regionId}`);
  return 10000 + index;
}

export type SiegeStatus = {
  canStart: boolean;
  requiredLevel: number;
  distance: number;
  label: string;
  message: string;
};

/** One source of truth for the menu hint and the actual territory-battle gate. */
export function territorySiegeStatus(
  state: {
    x: number;
    y: number;
    lv: number;
    conquered: string[];
  },
  region: Region,
  activeBoss = false,
): SiegeStatus {
  const headquarters = headquartersOf(region),
    distance = Math.hypot(state.x - headquarters.x, state.y - headquarters.y),
    requiredLevel = Math.max(2, REGIONS.indexOf(region) - 1);
  if (state.conquered.includes(region.id))
    return {
      canStart: false,
      requiredLevel,
      distance,
      label: '征服済み',
      message: 'この領土はすでに自分の支配地だ。',
    };
  if (activeBoss)
    return {
      canStart: false,
      requiredLevel,
      distance,
      label: '領土ボスと交戦中',
      message: 'この領土の支配者はすでに出現している。',
    };
  if (distance > 620) {
    const metres = Math.max(1, Math.round(distance * SCALE));
    return {
      canStart: false,
      requiredLevel,
      distance,
      label: `本拠地まで ${metres}m`,
      message: `領主の本拠地まで約${metres}m。地図で目的地に設定し、敵領土を偵察しながら進もう。`,
    };
  }
  if (state.lv < requiredLevel)
    return {
      canStart: false,
      requiredLevel,
      distance,
      label: `推奨Lv.${requiredLevel}（現在Lv.${state.lv}）`,
      message: `この領土の瘴気は強すぎる。推奨Lv.${requiredLevel}。`,
    };
  return {
    canStart: true,
    requiredLevel,
    distance,
    label: '領土戦を開始できる',
    message: '領土戦を開始できる。',
  };
}
