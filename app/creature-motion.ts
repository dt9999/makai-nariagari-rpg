export type MonsterMotionKind =
  | 'imp'
  | 'beast'
  | 'insect'
  | 'golem'
  | 'flying'
  | 'plant'
  | 'slime'
  | 'armored'
  | 'aberration';

export type CreatureAttackPose = {
  anticipation: number;
  strike: number;
  impact: number;
  recovery: number;
  lunge: number;
  lift: number;
  twist: number;
  compression: number;
};

type AttackProfile = {
  windEnd: number;
  windOut: number;
  impactAt: number;
  impactWidth: number;
  recoverStart: number;
  recoverEnd: number;
  lunge: number;
  lift: number;
  twist: number;
  compression: number;
};

const ATTACK_PROFILES: Record<MonsterMotionKind, AttackProfile> = {
  imp: {
    windEnd: 0.28,
    windOut: 0.35,
    impactAt: 0.53,
    impactWidth: 0.1,
    recoverStart: 0.66,
    recoverEnd: 0.94,
    lunge: 0.72,
    lift: 0.08,
    twist: 0.75,
    compression: 0.25,
  },
  armored: {
    windEnd: 0.38,
    windOut: 0.44,
    impactAt: 0.59,
    impactWidth: 0.12,
    recoverStart: 0.72,
    recoverEnd: 0.99,
    lunge: 0.52,
    lift: 0.04,
    twist: 0.95,
    compression: 0.34,
  },
  beast: {
    windEnd: 0.3,
    windOut: 0.37,
    impactAt: 0.51,
    impactWidth: 0.09,
    recoverStart: 0.64,
    recoverEnd: 0.91,
    lunge: 1,
    lift: 0.45,
    twist: 0.15,
    compression: 0.4,
  },
  insect: {
    windEnd: 0.18,
    windOut: 0.23,
    impactAt: 0.39,
    impactWidth: 0.065,
    recoverStart: 0.49,
    recoverEnd: 0.78,
    lunge: 1.15,
    lift: 0.04,
    twist: 0.28,
    compression: 0.2,
  },
  golem: {
    windEnd: 0.48,
    windOut: 0.54,
    impactAt: 0.66,
    impactWidth: 0.13,
    recoverStart: 0.78,
    recoverEnd: 1,
    lunge: 0.5,
    lift: 0,
    twist: 0.45,
    compression: 0.8,
  },
  flying: {
    windEnd: 0.27,
    windOut: 0.33,
    impactAt: 0.49,
    impactWidth: 0.09,
    recoverStart: 0.62,
    recoverEnd: 0.9,
    lunge: 1.3,
    lift: 1,
    twist: 0.3,
    compression: 0.2,
  },
  plant: {
    windEnd: 0.38,
    windOut: 0.46,
    impactAt: 0.6,
    impactWidth: 0.12,
    recoverStart: 0.73,
    recoverEnd: 0.97,
    lunge: 0.7,
    lift: 0.1,
    twist: 1.1,
    compression: 0.25,
  },
  aberration: {
    windEnd: 0.44,
    windOut: 0.51,
    impactAt: 0.65,
    impactWidth: 0.13,
    recoverStart: 0.77,
    recoverEnd: 1,
    lunge: 0.6,
    lift: 0.3,
    twist: 1.3,
    compression: 0.45,
  },
  slime: {
    windEnd: 0.32,
    windOut: 0.4,
    impactAt: 0.56,
    impactWidth: 0.11,
    recoverStart: 0.69,
    recoverEnd: 0.94,
    lunge: 0.85,
    lift: 0.25,
    twist: 0.15,
    compression: 1,
  },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothRange = (start: number, end: number, value: number) => {
  const normalized = clamp01((value - start) / Math.max(0.0001, end - start));
  return normalized * normalized * (3 - 2 * normalized);
};

export function creatureAttackImpactProgress(
  kind: MonsterMotionKind,
  boss = false,
) {
  const base = ATTACK_PROFILES[kind].impactAt;
  return boss ? Math.min(0.72, base + 0.035) : base;
}

export function creatureAttackPose(
  kind: MonsterMotionKind,
  progress: number,
  boss = false,
  target?: CreatureAttackPose,
) {
  const profile = ATTACK_PROFILES[kind],
    p = clamp01(progress),
    weight = boss ? 1.18 : 1,
    impactAt = creatureAttackImpactProgress(kind, boss),
    anticipation =
      smoothRange(0, profile.windEnd + (boss ? 0.025 : 0), p) *
      (1 - smoothRange(profile.windOut, impactAt, p)),
    strike =
      smoothRange(profile.windEnd * 0.82, impactAt, p) *
      (1 - smoothRange(profile.recoverStart, profile.recoverEnd, p)),
    pose =
      target ??
      ({
        anticipation: 0,
        strike: 0,
        impact: 0,
        recovery: 0,
        lunge: 0,
        lift: 0,
        twist: 0,
        compression: 0,
      } satisfies CreatureAttackPose);

  pose.anticipation = anticipation * weight;
  pose.strike = strike * weight;
  pose.impact =
    clamp01(1 - Math.abs(p - impactAt) / profile.impactWidth) * weight;
  pose.recovery = smoothRange(profile.recoverStart, profile.recoverEnd, p);
  pose.lunge = strike * profile.lunge * weight;
  pose.lift = strike * profile.lift * weight;
  pose.twist = (strike - anticipation * 0.7) * profile.twist * weight;
  pose.compression = anticipation * profile.compression * weight;
  return pose;
}
