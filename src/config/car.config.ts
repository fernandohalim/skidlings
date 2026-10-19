// All car tuning values (§6.8). Units: meters, seconds, radians.

export interface DriftTier {
  minCharge: number;
  duration: number;
  bonus: number;
}

export interface CarConfig {
  // size
  length: number;
  width: number;
  height: number;
  mass: number;
  // longitudinal
  maxSpeed: number;
  accel: number;
  brakeDecel: number;
  maxReverseSpeed: number;
  reverseAccel: number;
  dragCoef: number;
  /** Deceleration back down to the cap after a boost/nitro ends (m/s²). */
  overspeedDecel: number;
  /** Extra deceleration when neither throttle nor brake is held, so the car rolls to a stop. */
  coastDecel: number;
  // steering
  steerRate: number;
  steerFullSpeedAt: number;
  steerHighSpeedReduction: number;
  steerSmoothTime: number;
  // grip
  normalGrip: number;
  driftGrip: number;
  gripRecoveryTime: number;
  // drift
  minDriftSpeed: number;
  /** |steer| needed to start a drift. */
  driftMinSteer: number;
  /** Drift turn rate (rad/s) with neutral steering… */
  driftBaseYaw: number;
  /** …plus/minus this much when steering into / out of the slide. */
  driftSteerYaw: number;
  /** Max sideways acceleration (m/s²) while gripping; beyond it the car understeers. */
  gripLatAccel: number;
  /** Speed lost (m/s²) at full understeer. */
  cornerScrub: number;
  /** Steering and grip factors while airborne. */
  airSteer: number;
  airGrip: number;
  /** Extra yaw (rad/s) toward the steer side right as a drift starts: the snappy "flick". */
  driftKickYawRate: number;
  driftKickTime: number;
  /** Max angle (rad) between heading and travel direction while drifting: no spin-outs. */
  maxDriftAngle: number;
  /** Fraction of sideways speed scrubbed while drifting that is fed back into forward speed. */
  driftSpeedRetention: number;
  /** Multiplies drift charge accumulation (Drifter charges tiers faster). */
  driftChargeRate: number;
  driftTiers: readonly DriftTier[];
  driftScoreRate: number;
  /** Instant forward kick on mini-boost release, as a fraction of maxSpeed × tier bonus. */
  driftBoostKick: number;
  /** Accel multiplier while a mini-boost is active. */
  boostAccelMultiplier: number;
  // nitro
  nitroMax: number;
  nitroDrainPerSecond: number;
  nitroFillPerSecondDrifting: number;
  nitroFillPerSecondLobby: number;
  nitroAccelMultiplier: number;
  nitroMaxSpeedMultiplier: number;
  maxTotalSpeedBonus: number;
  // walls
  wallTangentialKeep: number;
  /** Impact speed into a wall (m/s) that cancels a drift. */
  wallHardHitSpeed: number;
  // collision shape: two circles along the car's long axis
  collisionRadius: number;
  collisionCircleOffset: number;
}

export const CAR_CONFIG: CarConfig = {
  length: 4.0,
  width: 2.0,
  height: 1.2,
  mass: 1,
  maxSpeed: 28,
  accel: 26,
  brakeDecel: 35,
  maxReverseSpeed: 10,
  reverseAccel: 14,
  dragCoef: 0.35,
  overspeedDecel: 6,
  coastDecel: 3,
  steerRate: 3.1,
  steerFullSpeedAt: 8,
  steerHighSpeedReduction: 0.2,
  steerSmoothTime: 0.06,
  normalGrip: 9,
  gripLatAccel: 19,
  cornerScrub: 12,
  airSteer: 0.35,
  airGrip: 0.6,
  driftGrip: 2.6,
  gripRecoveryTime: 0.35,
  minDriftSpeed: 8,
  driftMinSteer: 0.2,
  driftBaseYaw: 1.15,
  driftSteerYaw: 0.85,
  driftKickYawRate: 1.1,
  driftKickTime: 0.12,
  maxDriftAngle: 0.6,
  driftSpeedRetention: 0.92,
  driftChargeRate: 1,
  driftTiers: [
    { minCharge: 0.55, duration: 0.8, bonus: 0.15 },
    { minCharge: 1.3, duration: 1.2, bonus: 0.25 },
    { minCharge: 2.2, duration: 1.6, bonus: 0.35 },
  ],
  driftScoreRate: 10,
  driftBoostKick: 0.6,
  boostAccelMultiplier: 1.8,
  nitroMax: 100,
  nitroDrainPerSecond: 30,
  nitroFillPerSecondDrifting: 18,
  nitroFillPerSecondLobby: 10,
  nitroAccelMultiplier: 1.6,
  nitroMaxSpeedMultiplier: 1.4,
  maxTotalSpeedBonus: 0.6,
  wallTangentialKeep: 0.85,
  wallHardHitSpeed: 9,
  collisionRadius: 1.0,
  collisionCircleOffset: 1.0,
};

/** 2.5D vertical physics (hills, ramps). Arcade gravity: snappy hops. */
export const VERTICAL_CONFIG = {
  gravity: 30,
  /** Small separations snap back to the ground so bumps don't flicker "airborne". */
  groundSnap: 0.12,
  /** Max vertical speed taken from slope following (m/s). */
  maxSlopeVy: 25,
  /** Landings harder than this (m/s down) count as a "landing" event. */
  landingMinImpact: 4,
  /** Fraction of speed kept on a hard landing. */
  landingSpeedKeep: 0.97,
};

export type CarId = 'balanced' | 'drifter' | 'speedster';

export interface CarPreset {
  id: CarId;
  name: string;
  tagline: string;
  color: string;
  /** Stat overrides on top of CAR_CONFIG. */
  overrides: Partial<CarConfig>;
}

export const CAR_PRESETS: Record<CarId, CarPreset> = {
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    tagline: 'Good at everything.',
    color: '#FF5A3C',
    overrides: {},
  },
  drifter: {
    id: 'drifter',
    name: 'Drifter',
    tagline: 'Slides easy, charges fast.',
    color: '#9B5CFF',
    overrides: {
      maxSpeed: 25,
      driftGrip: 2.1,
      minDriftSpeed: 6.5,
      driftBaseYaw: 1.35,
      driftSteerYaw: 1.0,
      maxDriftAngle: 0.72,
      driftChargeRate: 1.3,
      nitroFillPerSecondDrifting: 22,
    },
  },
  speedster: {
    id: 'speedster',
    name: 'Speedster',
    tagline: 'Top speed king. Grippy.',
    color: '#2EC4F1',
    overrides: {
      maxSpeed: 32,
      accel: 24,
      normalGrip: 11,
      gripLatAccel: 21,
      driftGrip: 3.1,
      minDriftSpeed: 10,
      driftBaseYaw: 1.0,
      driftSteerYaw: 0.75,
      maxDriftAngle: 0.5,
      driftChargeRate: 0.85,
    },
  },
};

export function resolveCarConfig(id: CarId): CarConfig {
  return { ...CAR_CONFIG, ...CAR_PRESETS[id].overrides };
}
