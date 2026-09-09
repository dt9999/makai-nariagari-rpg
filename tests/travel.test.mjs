import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTO_RUN_STUCK_SECONDS,
  nextAutoRunBlockedTime,
  resolveTravelAxes,
} from '../app/travel.ts';

const idleStick = { x: 0, y: 0, on: false };

test('auto-run supplies normal forward intent while preserving keyboard steering', () => {
  assert.deepEqual(
    resolveTravelAxes({
      autoRun: true,
      forward: false,
      back: false,
      left: false,
      right: false,
      stick: idleStick,
    }),
    { strafe: 0, forward: 1, intent: 1, length: 1 },
  );
  const steered = resolveTravelAxes({
    autoRun: true,
    forward: false,
    back: false,
    left: false,
    right: true,
    stick: idleStick,
  });
  assert.equal(steered.forward, 1);
  assert.equal(steered.strafe, 1);
  assert.equal(steered.intent, 1);
  assert.equal(steered.length, Math.SQRT2);
});

test('manual movement remains unchanged when auto-run is off', () => {
  assert.deepEqual(
    resolveTravelAxes({
      autoRun: false,
      forward: true,
      back: false,
      left: true,
      right: false,
      stick: idleStick,
    }),
    { strafe: -1, forward: 1, intent: 1, length: Math.SQRT2 },
  );
});

test('blocked auto-run accumulates only while stationary and resets on progress', () => {
  let blocked = 0;
  for (let i = 0; i < 80; i++)
    blocked = nextAutoRunBlockedTime(true, 0, 1 / 60, blocked);
  assert.ok(blocked >= AUTO_RUN_STUCK_SECONDS);
  assert.equal(nextAutoRunBlockedTime(true, 1, 1 / 60, blocked), 0);
  assert.equal(nextAutoRunBlockedTime(false, 0, 1, blocked), 0);
});
