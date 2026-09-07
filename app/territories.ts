import { REGIONS, type Region } from './world.ts';

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
