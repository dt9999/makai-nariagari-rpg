export type DamageSource = {
  x: number;
  y: number;
  name: string;
  remaining: number;
};

type Fallen = {
  x: number;
  y: number;
  dead?: boolean;
  ally?: boolean;
  boss?: boolean;
  recruitTime?: number;
};
export function nearestRecruit<T extends Fallen>(
  player: { x: number; y: number },
  mobs: readonly T[],
  radius = 120,
): T | undefined {
  let selected: T | undefined;
  let distance = radius * radius;
  for (const mob of mobs) {
    if (!mob.dead || mob.ally || mob.boss || (mob.recruitTime ?? 0) <= 0)
      continue;
    const squared = (mob.x - player.x) ** 2 + (mob.y - player.y) ** 2;
    if (squared < distance) {
      selected = mob;
      distance = squared;
    }
  }
  return selected;
}

export function damageBearing(
  player: { x: number; y: number; viewYaw: number },
  source: DamageSource,
) {
  const angle =
    Math.atan2(source.x - player.x, source.y - player.y) - player.viewYaw;
  const radians = Math.atan2(Math.sin(angle), Math.cos(angle));
  const degrees = (radians * 180) / Math.PI;
  const direction =
    Math.abs(degrees) <= 45
      ? '正面'
      : Math.abs(degrees) >= 135
        ? '背後'
        : degrees > 0
          ? '右側'
          : '左側';
  return { degrees, direction };
}
