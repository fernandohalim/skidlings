import type { TrackDefinition } from '../engine/track/TrackDefinition';
import { FOREST_THEME } from './themes';

/**
 * Pine Hills — the friendly one: rolling forest hills, a crest jump, a wooden
 * bridge over a river, sweepers, an S-bend and a drift hairpin.
 */
export const PINE_HILLS: TrackDefinition = {
  id: 'pineHills',
  name: 'Pine Hills',
  laps: 3,
  controlPoints: [
    [70, -60],
    [72, 0],
    [68, 50],
    [52, 82],
    [22, 92],
    [-5, 80],
    [-18, 55],
    [-14, 32],
    [-25, 10],
    [-55, 8],
    [-80, 25],
    [-106, 24],
    [-122, -2],
    [-116, -30],
    [-84, -38],
    [-60, -50],
    [-55, -80],
    [-30, -100],
    [10, -98],
    [45, -85],
  ],
  roadWidth: 14,
  checkpointCount: 14,
  startIndex: 1,
  theme: FOREST_THEME,
  decorationSeed: 1337,
  terrain: {
    baseHeight: 1.5,
    hillAmplitude: 5,
    hillScale: 55,
    blendWidth: 16,
    peaks: { amplitude: 16, scale: 80, minDistance: 40 },
    river: {
      points: [
        [-200, -40],
        [-130, -62],
        [-70, -66],
        [-20, -50],
        [30, -40],
        [90, -30],
        [200, -20],
      ],
      width: 12,
      level: -1.2,
    },
  },
  features: {
    elevation: [
      [0, 3],
      [0.12, 6],
      [0.24, 9],
      [0.36, 5],
      [0.5, 2],
      [0.62, 4],
      [0.76, 3],
      [0.9, 3],
    ],
    // Ramps on the two straights, each fed by a boost pad.
    ramps: [
      { at: 0.075, length: 9, height: 1.4 },
      { at: 0.825, length: 9, height: 1.5 },
    ],
    boostPads: [0.035, 0.47, 0.79],
  },
  landmarks: [
    { kind: 'windmill', x: -40, z: -18, rotation: 0.6 },
    { kind: 'bigTree', x: 34, z: 34 },
    { kind: 'bigTree', x: -78, z: -6, scale: 1.2 },
  ],
};
