// Quality presets (§13) + toon art direction (§0.1).
export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  dpr: [number, number];
  shadowMapSize: number; // 0 = shadows off
  outlines: boolean;
  antialias: boolean;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: { dpr: [1, 1], shadowMapSize: 0, outlines: false, antialias: false },
  medium: { dpr: [1, 1.5], shadowMapSize: 1024, outlines: true, antialias: true },
  high: { dpr: [1, 2], shadowMapSize: 2048, outlines: true, antialias: true },
};

/** Post-processing (bloom) tuning. */
export const GRAPHICS_FX = {
  bloomIntensity: 0.9,
  /** Just above 1.0: only over-bright VFX (flames, sparks) bloom. */
  bloomThreshold: 1.02,
  /** Color grade on top (glow effects on): extra saturation + soft vignette. */
  saturation: 0.14,
  vignetteOffset: 0.32,
  vignetteDarkness: 0.38,
};

/** Scene lighting: warm sun + sky/ground fill (§10.10). */
export const LIGHTING = {
  skyColor: '#BFE6FF',
  groundColor: '#8CC66B',
  hemiIntensity: 0.95,
  sunColor: '#FFEFD2',
  sunIntensity: 2.6,
};

export const TOON_CONFIG = {
  /** Brightness of each light band, darkest → brightest. */
  bands: [0.62, 0.84, 1.0],
  outlineColor: '#2B2340',
  /** Pixels (drei <Outlines> with screenspace=false is pixel-sized, zoom-independent). */
  outlineThickness: 3,
};

export const WORLD_PALETTE = {
  grass: '#8BD17C',
  grassDark: '#6FBF67',
  road: '#5A5F73',
  curbA: '#FF5A3C',
  curbB: '#FFFFFF',
  bumperA: '#2EC4F1',
  bumperB: '#FFC933',
  sky: '#BFE9FF',
  horizon: '#FFF8EE',
  trunk: '#A0673A',
  leaves: '#4CB963',
  leavesLight: '#6CCB6E',
  pine: '#3E9E5A',
  bush: '#5FC46A',
  rock: '#B8B4C8',
  mound: '#7FC873',
  tire: '#3A3350',
  dash: '#ECEAF4',
  /** Toy blocks / flowers / flags / crowd pick from these. */
  toyColors: ['#FF5A3C', '#2EC4F1', '#FFC933', '#3DD68C', '#9B5CFF'],
  flowerColors: ['#FF8FB1', '#FFC933', '#FFFFFF', '#B79CFF'],
};
