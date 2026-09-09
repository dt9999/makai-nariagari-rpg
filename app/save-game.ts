export const GAME_SAVE_KEY = 'makai-adventure-save-v1';
export const GAME_SAVE_VERSION = 1;

type Dictionary = Record<string, unknown>;

const record = (value: unknown): value is Dictionary =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);
const list = (value: unknown, fallback: unknown[]) =>
  Array.isArray(value) ? value : fallback;

/** Remove momentary combat/input state so loading always resumes safely. */
export function encodeGameSave(world: object, savedAt = Date.now()) {
  const snapshot = {
    ...(world as Dictionary),
    guarding: false,
    autoRun: false,
    buildMode: false,
    attackAnim: 0,
    attackKind: 'none',
    dodgeTime: 0,
    pendingHits: [],
    damageSource: undefined,
  };
  return JSON.stringify({
    version: GAME_SAVE_VERSION,
    savedAt,
    world: snapshot,
  });
}

/** Merge old saves with today's defaults so additions do not break progress. */
export function decodeGameSave<T extends object>(
  source: string,
  defaults: T,
): T | null {
  try {
    const envelope = JSON.parse(source) as unknown;
    if (!record(envelope) || envelope.version !== GAME_SAVE_VERSION)
      return null;
    const saved = envelope.world;
    if (!record(saved)) return null;
    if (
      typeof saved.job !== 'string' ||
      !finite(saved.x) ||
      !finite(saved.y) ||
      !finite(saved.hp) ||
      !finite(saved.maxHp)
    )
      return null;

    const base = defaults as Dictionary;
    const merged = {
      ...base,
      ...saved,
      preferences: {
        ...(record(base.preferences) ? base.preferences : {}),
        ...(record(saved.preferences) ? saved.preferences : {}),
      },
      tutorial: {
        ...(record(base.tutorial) ? base.tutorial : {}),
        ...(record(saved.tutorial) ? saved.tutorial : {}),
        completed: list(
          record(saved.tutorial) ? saved.tutorial.completed : undefined,
          [],
        ),
      },
      stats: {
        ...(record(base.stats) ? base.stats : {}),
        ...(record(saved.stats) ? saved.stats : {}),
      },
      equipment: {
        ...(record(base.equipment) ? base.equipment : {}),
        ...(record(saved.equipment) ? saved.equipment : {}),
      },
      careers: record(saved.careers) ? saved.careers : base.careers,
      inventory: list(saved.inventory, list(base.inventory, [])),
      loot: list(saved.loot, list(base.loot, [])),
      unlocked: list(saved.unlocked, list(base.unlocked, [])),
      mobs: list(saved.mobs, list(base.mobs, [])),
      nodes: list(saved.nodes, list(base.nodes, [])),
      bases: list(saved.bases, list(base.bases, [])),
      roster: list(saved.roster, list(base.roster, [])),
      discovered: list(saved.discovered, list(base.discovered, [])),
      discoveredSites: list(saved.discoveredSites, []),
      talkedSites: list(saved.talkedSites, []),
      activatedSites: list(saved.activatedSites, []),
      rumoredSites: list(saved.rumoredSites, []),
      conquered: list(saved.conquered, []),
      pendingHits: [],
      guarding: false,
      autoRun: false,
      buildMode: false,
      attackAnim: 0,
      attackKind: 'none',
      dodgeTime: 0,
      damageSource: undefined,
    } as Dictionary;

    merged.lv = Math.max(1, Math.min(99, Math.floor(Number(merged.lv) || 1)));
    merged.rank = Math.max(
      0,
      Math.min(7, Math.floor(Number(merged.rank) || 0)),
    );
    merged.maxHp = Math.max(1, Number(merged.maxHp) || 1);
    merged.hp = Math.max(
      0,
      Math.min(Number(merged.hp) || 0, merged.maxHp as number),
    );
    merged.maxEnergy = Math.max(1, Number(merged.maxEnergy) || 100);
    merged.energy = Math.max(
      0,
      Math.min(Number(merged.energy) || 0, merged.maxEnergy as number),
    );
    return merged as T;
  } catch {
    return null;
  }
}
