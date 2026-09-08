export type DamageSource = {
  x: number;
  y: number;
  name: string;
  remaining: number;
};

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
