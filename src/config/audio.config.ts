// Placeholder synth audio tuning (§11). All sounds are generated with Web Audio.
export const AUDIO_CONFIG = {
  engine: { idleHz: 62, topHz: 230, idleGain: 0.05, throttleGain: 0.07, smoothing: 0.06 },
  screech: { bandHz: 1700, q: 2.5, gainPerMs: 0.012, maxGain: 0.16 },
  nitro: { gain: 0.08 },
  bonk: { minImpact: 3, gainPerMs: 0.03, maxGain: 0.35 },
  music: {
    lobbyBpm: 108,
    raceBpm: 128,
    gain: 0.16,
  },
  /** Volume dip on music while a menu is open. */
  menuMusicDuck: 0.6,
};
