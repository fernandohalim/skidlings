import type { TrackDefinition } from '../engine/track/TrackDefinition';
import { CANYON_THEME } from './themes';

/**
 * Red Canyon — the technical one: a road carved through a sandstone plateau,
 * a tight hairpin for tier-3 drifts, a chicane and a jump across a dip.
 */
export const RED_CANYON: TrackDefinition = {
  id: 'redCanyon',
  name: 'Red Canyon',
  laps: 3,
  controlPoints: [
    [0, -70],
    [40, -72],
    [75, -55],
    [88, -20],
    [70, 10],
    [40, 15],
    [20, 35],
    [30, 62],
    [60, 75],
    [88, 95],
    [76, 128],
    [38, 128],
    [5, 105],
    [-20, 80],
    [-50, 85],
    [-80, 70],
    [-90, 35],
    [-70, 5],
    [-75, -30],
    [-50, -60],
  ],
  roadWidth: 13,
  checkpointCount: 16,
  startIndex: 0,
  theme: CANYON_THEME,
  decorationSeed: 4242,
  terrain: {
    baseHeight: 6.5,
    hillAmplitude: 1.2,
    hillScale: 30,
    blendWidth: 3.5,
    peaks: { amplitude: 18, scale: 60, minDistance: 30 },
  },
  features: {
    elevation: [
      [0, 0],
      [0.18, 2],
      [0.34, -0.5],
      [0.5, 2.5],
      [0.66, 0.5],
      [0.84, 2],
    ],
    ramps: [
      { at: 0.39, length: 8, height: 1.3 },
      { at: 0.585, length: 9, height: 1.6 },
    ],
    dips: [{ at: 0.605, length: 24, depth: 3.5 }],
    boostPads: [0.03, 0.45, 0.78],
  },
  landmarks: [
    { kind: 'archRock', x: 2, z: -18, rotation: 0.4 },
    { kind: 'mesa', x: -30, z: 30, scale: 1 },
    { kind: 'mesa', x: 135, z: 40, scale: 1.4 },
  ],
};
