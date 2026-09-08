import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creatureAttackImpactProgress,
  creatureAttackPose,
} from '../app/creature-motion.ts';

const KINDS = [
  'imp',
  'armored',
  'beast',
  'insect',
  'golem',
  'flying',
  'plant',
  'aberration',
  'slime',
];

test('every creature attack has anticipation, a synchronized impact and recovery', () => {
  for (const kind of KINDS) {
    const impactAt = creatureAttackImpactProgress(kind),
      start = creatureAttackPose(kind, 0),
      anticipation = creatureAttackPose(kind, impactAt * 0.62),
      impact = creatureAttackPose(kind, impactAt),
      end = creatureAttackPose(kind, 1);

    assert.equal(start.anticipation, 0, `${kind} starts at rest`);
    assert.ok(anticipation.anticipation > 0.02, `${kind} visibly winds up`);
    assert.ok(impact.impact > 0.99, `${kind} impact reaches its visual peak`);
    assert.ok(impact.strike > 0.2, `${kind} follows through at contact`);
    assert.equal(end.anticipation, 0, `${kind} ends its wind-up`);
    assert.equal(end.strike, 0, `${kind} returns its attacking limbs`);
    assert.equal(end.impact, 0, `${kind} clears its impact pulse`);
    assert.equal(end.recovery, 1, `${kind} completes recovery`);

    for (const pose of [start, anticipation, impact, end]) {
      for (const value of Object.values(pose)) {
        assert.ok(Number.isFinite(value));
        assert.ok(value >= -0.85 && value <= 1.55);
      }
    }
  }
});

test('species use distinct physical attack signatures instead of one shared motion', () => {
  const signatures = new Set(
    KINDS.map((kind) => {
      const early = creatureAttackPose(kind, 0.25),
        contact = creatureAttackPose(kind, creatureAttackImpactProgress(kind));
      return [
        early.anticipation,
        early.strike,
        contact.lunge,
        contact.lift,
        contact.twist,
        contact.compression,
      ]
        .map((value) => value.toFixed(3))
        .join(':');
    }),
  );
  assert.equal(signatures.size, KINDS.length);
});

test('fast insects connect before heavy golems and bosses delay their impact', () => {
  assert.ok(
    creatureAttackImpactProgress('insect') <
      creatureAttackImpactProgress('imp'),
  );
  assert.ok(
    creatureAttackImpactProgress('imp') < creatureAttackImpactProgress('golem'),
  );
  assert.ok(
    creatureAttackImpactProgress('golem', true) >
      creatureAttackImpactProgress('golem'),
  );
});

test('runtime can reuse one pose object without allocating every animation frame', () => {
  const reusable = creatureAttackPose('beast', 0.1),
    updated = creatureAttackPose('beast', 0.5, false, reusable);
  assert.strictEqual(updated, reusable);
  assert.ok(updated.strike > 0.5);
});
