export const AUTO_RUN_STUCK_SECONDS = 1.25;

export type TravelAxes = {
  strafe: number;
  forward: number;
  intent: number;
  length: number;
};

export function resolveTravelAxes(input: {
  autoRun: boolean;
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  stick: { x: number; y: number; on: boolean };
}): TravelAxes {
  const strafe =
      (input.right ? 1 : 0) -
      (input.left ? 1 : 0) +
      (input.stick.on ? input.stick.x : 0),
    forward =
      (input.forward || input.autoRun ? 1 : 0) -
      (input.back ? 1 : 0) -
      (input.stick.on ? input.stick.y : 0),
    length = Math.hypot(strafe, forward) || 1;
  return {
    strafe,
    forward,
    intent: Math.min(1, Math.hypot(strafe, forward)),
    length,
  };
}

export function nextAutoRunBlockedTime(
  active: boolean,
  travelled: number,
  dt: number,
  previous: number,
) {
  if (!active || travelled >= 0.5) return 0;
  return previous + Math.max(0, dt);
}
