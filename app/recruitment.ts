type Candidate = {
  id: number;
  commanderId?: number;
  ally?: boolean;
  boss?: boolean;
  dead?: boolean;
  recruitTime?: number;
};

/** Preserve real command chains, including captains with their own squads. */
export function recruitmentCohort<T extends Candidate>(
  target: T,
  mobs: readonly T[],
): T[] {
  if (
    !mobs.includes(target) ||
    target.ally ||
    target.boss ||
    !target.dead ||
    (target.recruitTime ?? 0) <= 0
  )
    return [];
  const children = new Map<number, T[]>();
  for (const mob of mobs) {
    if (mob.commanderId === undefined || mob.boss) continue;
    const squad = children.get(mob.commanderId) ?? [];
    squad.push(mob);
    children.set(mob.commanderId, squad);
  }
  const result = [target],
    queue = [target.id],
    seen = new Set(queue);
  for (let index = 0; index < queue.length; index++) {
    for (const follower of children.get(queue[index]) ?? []) {
      if (seen.has(follower.id)) continue;
      seen.add(follower.id);
      queue.push(follower.id);
      if (!follower.ally && (!follower.dead || (follower.recruitTime ?? 0) > 0))
        result.push(follower);
    }
  }
  return result;
}

export function recruitmentChance(
  playerMight: number,
  tier: number,
  followers: number,
  leadership: number,
) {
  const opposition = tier * 23 + followers * 5 + 12;
  return Math.max(
    0.08,
    Math.min(
      0.96,
      0.38 + (playerMight - opposition) / 125 + leadership * 0.012,
    ),
  );
}
