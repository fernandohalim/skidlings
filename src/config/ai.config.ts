import type { CarId } from './car.config';

// AI opponents (§9.4, M8). Easy & forgiving: bots are a little slower than a
// clean player and rubber-band to keep the race close.

export interface BotProfile {
  name: string;
  carId: CarId;
  color: string;
  /** Preferred lateral offset from the centerline (m, + = right of travel). */
  lane: number;
  /** Fraction of the car's top speed this bot aims for (before rubber-banding). */
  pace: number;
  /** 0..1: how eagerly the bot drifts through tight corners. */
  driftEagerness: number;
}

export const BOT_PROFILES: BotProfile[] = [
  { name: 'Pip', carId: 'balanced', color: '#3DD68C', lane: -2.2, pace: 0.9, driftEagerness: 0.5 },
  {
    name: 'Zoom',
    carId: 'speedster',
    color: '#FFC933',
    lane: 1.8,
    pace: 0.88,
    driftEagerness: 0.3,
  },
  { name: 'Bloop', carId: 'drifter', color: '#2EC4F1', lane: 0.4, pace: 0.92, driftEagerness: 0.9 },
];

export const AI_CONFIG = {
  /** Grid slot for the player (0 = pole). Starting at the back makes overtakes fun. */
  playerGridSlot: 3,
  /** Look-ahead along the centerline: base samples + per m/s of speed. */
  lookAheadBase: 7,
  lookAheadPerSpeed: 0.55,
  steerGain: 2.4,
  /** Heading change (rad) over `cornerWindow` samples that counts as a corner. */
  cornerWindow: 22,
  driftCornerAngle: 0.55,
  brakeCornerAngle: 1.35,
  brakeAboveSpeed: 21,
  /** Lane sway amplitude (m) and wavelength (m) so bots don't drive on rails. */
  laneSway: 1.2,
  laneSwayLength: 90,
  /** Nitro on straights when the bot has this much in the tank. */
  nitroMin: 45,
  /** Rubber-band: max speed multiplier range, by progress gap to the player (in checkpoints). */
  rubberBandMax: 1.12,
  rubberBandMin: 0.86,
  rubberBandGap: 3,
  /** Car-to-car contact. */
  contactRestitution: 0.3,
};
