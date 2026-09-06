export type Quality = 'low' | 'medium' | 'high';
export type GamePreferences = {
  quality: Quality;
  sensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  fov: number;
  cameraMotion: number;
  weaponMotion: number;
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
    particles: 36,
    allies: 4,
    fps: 30,
  },
  medium: {
    pixelRatio: 1.25,
    shadowSize: 1024,
    distance: 2000,
    enemyDistance: 1350,
    particles: 90,
    allies: 8,
    fps: 60,
  },
  high: {
    pixelRatio: 1.75,
    shadowSize: 2048,
    distance: 3000,
    enemyDistance: 1900,
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
    fps: mobile && quality !== 'high' ? 30 : preset.fps,
  };
}
export type RenderPerformance = {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
};
