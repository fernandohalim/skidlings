import type { TrackDefinition } from '../engine/track/TrackDefinition';
import { SEASIDE_THEME } from './themes';

/**
 * Seaside Cliffs — a cliff-top straight above the ocean, a lighthouse
 * headland, a descent inland to a crest jump and a climb back to the sea.
 */
export const SEASIDE_CLIFFS: TrackDefinition = {
  id: 'seasideCliffs',
  name: 'Seaside Cliffs',
  laps: 3,
  controlPoints: [
    [72, -70],
    [75, -10],
    [72, 50],
    [55, 88],
    [20, 98],
    [-10, 82],
    [-30, 55],
    [-62, 52],
    [-92, 32],
    [-98, -2],
    [-76, -28],
    [-46, -26],
    [-28, -46],
    [-34, -84],
    [-5, -110],
    [35, -110],
    [62, -95],
  ],
  roadWidth: 14,
  checkpointCount: 14,
  startIndex: 1,
  theme: SEASIDE_THEME,
  decorationSeed: 777,
  terrain: {
    baseHeight: 5,
    hillAmplitude: 3,
    hillScale: 60,
    blendWidth: 9,
    peaks: { amplitude: 9, scale: 70, minDistance: 45 },
    coast: { nx: 1, nz: 0, d: 90, seaLevel: -3 },
  },
  features: {
    elevation: [
      [0, 9],
      [0.16, 10],
      [0.3, 6],
      [0.42, 3],
      [0.55, 6],
      [0.7, 2.5],
      [0.85, 6],
    ],
    // A jump along the cliff top (sea view!) and one on the climb back.
    ramps: [
      { at: 0.11, length: 9, height: 1.5 },
      { at: 0.97, length: 9, height: 1.3 },
    ],
    boostPads: [0.06, 0.36, 0.93],
  },
  landmarks: [
    { kind: 'lighthouse', x: 84, z: 104 },
    { kind: 'boat', x: 125, z: 20, rotation: 0.5 },
    { kind: 'boat', x: 140, z: -60, rotation: 2.2, scale: 1.3 },
    { kind: 'boat', x: 115, z: -120, rotation: 1.1 },
  ],
};
