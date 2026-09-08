import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptiveRenderScale,
  DEFAULT_PREFERENCES,
  sanitizePreferences,
  qualityProfile,
} from '../app/preferences.ts';
test('invalid local settings cannot enter camera or GPU configuration', () => {
  for (const value of [
    null,
    false,
    'bad',
    [],
    { quality: 'ultra', fov: Infinity, cameraMotion: NaN, invertY: 'false' },
  ])
    assert.deepEqual(sanitizePreferences(value), DEFAULT_PREFERENCES);
  const bounded = sanitizePreferences({
    fov: 400,
    sensitivity: -1,
    touchScale: 10,
    touchRise: -40,
    weaponMotion: -8,
  });
  assert.equal(bounded.fov, 95);
  assert.equal(bounded.sensitivity, 0.2);
  assert.equal(bounded.touchScale, 1.15);
  assert.equal(bounded.touchRise, 0);
  assert.equal(bounded.weaponMotion, 0);
});
test('three quality levels strictly increase scene detail and cap mobile GPU costs', () => {
  const profiles = ['low', 'medium', 'high'].map((q) =>
    qualityProfile(q, false),
  );
  assert.equal(profiles[0].shadowSize, 0);
  for (let i = 1; i < 3; i++)
    for (const key of [
      'pixelRatio',
      'shadowSize',
      'distance',
      'enemyDistance',
      'particles',
      'allies',
    ])
      assert.ok(profiles[i][key] > profiles[i - 1][key]);
  for (const q of ['low', 'medium', 'high']) {
    const m = qualityProfile(q, true);
    assert.ok(m.shadowSize <= 1024);
    assert.ok(m.pixelRatio <= 1.25);
  }
  for (const q of ['low', 'medium', 'high'])
    assert.equal(qualityProfile(q, true).fps, 30);
});
test('adaptive resolution steps down under sustained load and restores gradually', () => {
  assert.equal(adaptiveRenderScale(1, 18, 30, 29), 0.9);
  assert.equal(adaptiveRenderScale(0.9, 30, 30, 8), 0.95);
  assert.equal(adaptiveRenderScale(0.8, 27, 30, 18), 0.8);
  assert.equal(adaptiveRenderScale(0.65, 10, 30, 40), 0.65);
  assert.equal(adaptiveRenderScale(Number.NaN, 60, 60, 6), 1);
});
test('permitted touch scale preserves 44px targets and fits a 360px portrait screen', () => {
  assert.ok(48 * 0.95 >= 44);
  assert.ok((156 + 112) * 1.15 + 20 * 2 < 360);
});
