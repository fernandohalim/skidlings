// Race rules tuning (§9).
export const RACE_CONFIG = {
  defaultLaps: 3,
  introDuration: 1.5,
  countdownStepDuration: 1,
  finishSlowMoDuration: 1.5,
  finishSlowMoScale: 0.35,
  /** Throttle pressed this long before GO still counts as a perfect start (s). */
  perfectStartEarly: 0.15,
  /** …and up to this long after GO (s). Holding throttle earlier than the window = no boost. */
  perfectStartWindow: 0.25,
  /** Drift tier (1-based) granted by a perfect start. */
  perfectStartTier: 1,
  wrongWayAngleDeg: 120,
  wrongWayDelay: 1,
  /** Below this speed the wrong-way check is paused (turning around in place is fine). */
  wrongWayMinSpeed: 2,
  /** Local search radius (samples) when tracking the car along the centerline. */
  trackSearchWindow: 30,
  /** Drift tier (1-based) a boost pad gives. */
  boostPadTier: 2,
  startNitroRace: 50,
  startNitroLobby: 100,
};

export type RaceConfig = typeof RACE_CONFIG;
