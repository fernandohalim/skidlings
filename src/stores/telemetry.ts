/**
 * High-frequency player values for the HUD (§4.1). A plain mutable object:
 * the sim writes it every frame, DOM HUD reads it on a ~15 Hz timer.
 * Never put this in React state.
 */
export const telemetry = {
  speed: 0,
  /** Throttle input 0..1 (engine sound). */
  throttle: 0,
  /** |lateral speed| m/s (tire screech). */
  lateral: 0,
  nitro: 0,
  nitroMax: 100,
  nitroActive: false,
  drifting: false,
  driftCharge: 0,
  /** Charge needed for the top drift tier (for the badge's progress bar). */
  driftMaxCharge: 1,
  driftTier: 0,
  boostTier: 0,
  boostTime: 0,
  driftScore: 0,
  /** Race clocks (seconds); 0 outside races. */
  raceTime: 0,
  lapTime: 0,
};

/** Display speed: m/s × 3.6 × "fun factor" 1.6 (§10.5). */
export function displayKmh(ms: number): number {
  return Math.round(Math.abs(ms) * 3.6 * 1.6);
}
