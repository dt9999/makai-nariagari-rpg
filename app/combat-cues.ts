export type DamageSource = {
  x: number;
  y: number;
  name: string;
  remaining: number;
};

type AimTarget = {
  x: number;
  y: number;
  ally?: boolean;
  dead?: boolean;
};

export type AimCue<T extends AimTarget> = {
  direct?: T;
  tracked?: T;
  distance: number;
  alignment: number;
  clear: boolean;
};

/** Find the crosshair target and the best nearby guidance target in one pass. */
export function selectAimCue<T extends AimTarget>(
  player: { x: number; y: number; facingX: number; facingY: number },
  mobs: readonly T[],
  attackRange: number,
  directCone: number,
  hasClearSight: (target: T) => boolean,
): AimCue<T> {
  let direct: T | undefined,
    directDistance = Infinity,
    tracked: T | undefined,
    trackedDistance = 0,
    trackedAlignment = -Infinity,
    trackedClear = false;
  const trackingRange = Math.max(520, attackRange * 2.6);

  for (const mob of mobs) {
    if (mob.ally || mob.dead) continue;
    const dx = mob.x - player.x,
      dy = mob.y - player.y,
      distance = Math.hypot(dx, dy) || 1,
      alignment = (dx * player.facingX + dy * player.facingY) / distance;
    if (distance >= trackingRange || alignment <= 0.2) continue;
    const clear = hasClearSight(mob);

    if (
      distance < attackRange &&
      alignment > directCone &&
      clear &&
      distance < directDistance
    ) {
      direct = mob;
      directDistance = distance;
    }
    if (
      alignment > trackedAlignment ||
      (alignment === trackedAlignment && distance < trackedDistance)
    ) {
      tracked = mob;
      trackedDistance = distance;
      trackedAlignment = alignment;
      trackedClear = clear;
    }
  }

  if (direct)
    return {
      direct,
      tracked: direct,
      distance: directDistance,
      alignment: 1,
      clear: true,
    };
  return {
    tracked,
    distance: trackedDistance,
    alignment: trackedAlignment,
    clear: trackedClear,
  };
}

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

export type RetreatingHostile = {
  x: number;
  y: number;
  anchorX?: number;
  anchorY?: number;
  hp: number;
  max: number;
  ally?: boolean;
  dead?: boolean;
  boss?: boolean;
  attackAnim?: number;
  attackCd?: number;
  attackHit?: boolean;
  attackTarget?: number;
  hitAnim?: number;
};

/** Clear only the encounter that defeated the player; unrelated world simulation is preserved. */
export function retreatHostilesAfterDefeat<T extends RetreatingHostile>(
  mobs: T[],
  defeatedAt: { x: number; y: number },
  radius = 900,
) {
  let retreated = 0;
  const radiusSquared = radius * radius;
  for (const mob of mobs) {
    if (
      mob.ally ||
      mob.dead ||
      (mob.x - defeatedAt.x) ** 2 + (mob.y - defeatedAt.y) ** 2 >= radiusSquared
    )
      continue;
    mob.x = Number.isFinite(mob.anchorX) ? mob.anchorX! : mob.x;
    mob.y = Number.isFinite(mob.anchorY) ? mob.anchorY! : mob.y;
    mob.attackAnim = 0;
    mob.attackCd = 1.5;
    mob.attackHit = false;
    mob.attackTarget = undefined;
    mob.hitAnim = 0;
    if (mob.boss) mob.hp = mob.max;
    retreated++;
  }
  return retreated;
}
