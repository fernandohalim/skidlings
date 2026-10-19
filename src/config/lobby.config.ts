// Lobby "playmat park" tuning (§8.4).
export const LOBBY_CONFIG = {
  /** Half-size of the square playmat (m). */
  halfSize: 100,
  /** Wall inset from the mat edge. */
  borderInset: 2,
  padRadius: 6,
  /** Car must be slower than this (m/s) to trigger a pad, so drive-throughs at speed don't. */
  padMaxSpeed: 14,
  cone: {
    radius: 0.45,
    friction: 2.2,
    restitution: 1.3,
    carry: 0.25,
    carSlowdown: 0.02,
    spinPerMeter: 1.2,
  },
  driftRingRadius: 18,
  driftRingCones: 26,
  slalomCones: 8,
  slalomSpacing: 9,
  decorationCount: 70,
  /** Controls hint fades after this many seconds of driving (§10.6). */
  hintFadeAfter: 10,
};
