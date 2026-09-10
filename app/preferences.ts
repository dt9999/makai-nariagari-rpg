export type Quality = 'low' | 'medium' | 'high';
export type GamePreferences = {
  quality: Quality;
  sensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  fov: number;
  cameraMotion: number;
  weaponMotion: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  audioMuted: boolean;
  touchScale: number;
  touchRise: number;
  touchInset: number;
};
export const DEFAULT_PREFERENCES: GamePreferences = {
  quality: 'medium',
  sensitivity: 1,
  touchSensitivity: 1,
  invertY: false,
  fov: 72,
  cameraMotion: 0.45,
  weaponMotion: 1,
  masterVolume: 0.75,
  musicVolume: 0.45,
  sfxVolume: 0.8,
  audioMuted: false,
  touchScale: 1,
  touchRise: 0,
  touchInset: 12,
};
const BOUNDS = {
  sensitivity: [0.2, 3],
  touchSensitivity: [0.2, 3],
  fov: [55, 95],
  cameraMotion: [0, 1],
  weaponMotion: [0, 1],
  masterVolume: [0, 1],
  musicVolume: [0, 1],
  sfxVolume: [0, 1],
  touchScale: [0.95, 1.15],
  touchRise: [0, 64],
  touchInset: [4, 20],
} as const;
/** Validate stored preferences before they reach camera matrices or GPU allocation. */
export function sanitizePreferences(value: unknown): GamePreferences {
  const result = { ...DEFAULT_PREFERENCES };
  if (!value || typeof value !== 'object') return result;
  const input = value as Record<string, unknown>;
  if (
    input.quality === 'low' ||
    input.quality === 'medium' ||
    input.quality === 'high'
  )
    result.quality = input.quality;
  if (typeof input.invertY === 'boolean') result.invertY = input.invertY;
  if (typeof input.audioMuted === 'boolean')
    result.audioMuted = input.audioMuted;
  for (const key of Object.keys(BOUNDS) as (keyof typeof BOUNDS)[]) {
    const n = input[key],
      [min, max] = BOUNDS[key];
    if (typeof n === 'number' && Number.isFinite(n))
      result[key] = Math.max(min, Math.min(max, n));
  }
  return result;
}
const PRESETS = {
  low: {
    pixelRatio: 0.9,
    shadowSize: 0,
    distance: 1200,
    enemyDistance: 800,
    enemyDetailDistance: 480,
    particles: 36,
    allies: 4,
    fps: 30,
  },
  medium: {
    pixelRatio: 1.25,
    shadowSize: 1024,
    distance: 2000,
    enemyDistance: 1350,
    enemyDetailDistance: 720,
    particles: 90,
    allies: 8,
    fps: 60,
  },
  high: {
    pixelRatio: 1.75,
    shadowSize: 2048,
    distance: 3000,
    enemyDistance: 1900,
    enemyDetailDistance: 980,
    particles: 150,
    allies: 14,
    fps: 60,
  },
} as const;
export function qualityProfile(quality: Quality, mobile: boolean) {
  const preset = PRESETS[quality];
  return {
    ...preset,
    pixelRatio: mobile ? Math.min(preset.pixelRatio, 1.25) : preset.pixelRatio,
    shadowSize: mobile ? Math.min(preset.shadowSize, 1024) : preset.shadowSize,
    distance: mobile ? Math.min(preset.distance, 2200) : preset.distance,
    enemyDetailDistance: mobile
      ? Math.min(preset.enemyDetailDistance, 720)
      : preset.enemyDetailDistance,
    fps: mobile ? 30 : preset.fps,
  };
}

export function adaptiveRenderScale(
  current: number,
  fps: number,
  targetFps: number,
  frameMs: number,
  minimum = 0.65,
) {
  const safeCurrent = Number.isFinite(current) ? current : 1,
    safeTarget = Math.max(1, Number.isFinite(targetFps) ? targetFps : 30),
    safeMinimum = Math.max(
      0.5,
      Math.min(1, Number.isFinite(minimum) ? minimum : 0.65),
    ),
    scale = Math.max(safeMinimum, Math.min(1, safeCurrent)),
    budget = 1000 / safeTarget,
    overloaded =
      !Number.isFinite(fps) ||
      !Number.isFinite(frameMs) ||
      fps < safeTarget * 0.82 ||
      frameMs > budget * 0.92,
    comfortable =
      fps >= safeTarget * 0.96 && frameMs > 0 && frameMs < budget * 0.62;
  if (overloaded)
    return Math.round(Math.max(safeMinimum, scale - 0.1) * 100) / 100;
  if (comfortable) return Math.round(Math.min(1, scale + 0.05) * 100) / 100;
  return scale;
}

export type RenderPerformance = {
  fps: number;
  targetFps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  resolutionScale: number;
};
