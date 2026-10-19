import type { CarConfig } from '../../config/car.config';
import type { InputState } from '../input/types';
import type { CarState } from './types';

/** Drift + mini-boost state (§6.5). Tier 0 = none, 1..3 = driftTiers index + 1. */
export interface DriftState {
  drifting: boolean;
  /** Seconds of drift charge (scaled by driftChargeRate). */
  charge: number;
  /** Tier currently reached by the ongoing drift. */
  tier: number;
  /** Mini-boost remaining seconds / bonus fraction / tier that produced it. */
  boostTime: number;
  boostBonus: number;
  boostTier: number;
  /** Set for exactly one step when a boost fires; consumed by the car step as a kick. */
  boostKick: number;
  /** Accumulated drift score (race HUD). */
  score: number;
  /** Direction of the current drift: -1 left, 1 right. */
  direction: number;
  /** Real seconds since the current drift started. */
  elapsed: number;
}

export function createDriftState(): DriftState {
  return {
    drifting: false,
    charge: 0,
    tier: 0,
    boostTime: 0,
    boostBonus: 0,
    boostTier: 0,
    boostKick: 0,
    score: 0,
    direction: 0,
    elapsed: 0,
  };
}

/** Highest tier (1-based) whose minCharge is met, 0 if none. */
export function tierForCharge(charge: number, cfg: CarConfig): number {
  let tier = 0;
  for (let i = 0; i < cfg.driftTiers.length; i++) {
    if (charge >= cfg.driftTiers[i]!.minCharge) tier = i + 1;
  }
  return tier;
}

/** Starts a mini-boost for a tier (also used by the perfect start). */
export function triggerBoost(d: DriftState, tier: number, cfg: CarConfig): void {
  const t = cfg.driftTiers[tier - 1];
  if (!t) return;
  // A stronger or equal boost replaces a running one; a weaker one never cuts it short.
  if (d.boostTime > 0 && t.bonus < d.boostBonus) return;
  d.boostTime = t.duration;
  d.boostBonus = t.bonus;
  d.boostTier = tier;
  d.boostKick = t.bonus * cfg.maxSpeed * cfg.driftBoostKick;
}

/**
 * Advances drift rules one step, BEFORE the car step (it decides grip/yaw).
 * `hardWallHit` comes from the previous step's collision resolve.
 */
export function updateDrift(
  d: DriftState,
  input: InputState,
  car: CarState,
  cfg: CarConfig,
  dt: number,
  hardWallHit: boolean,
): void {
  d.boostKick = 0;
  if (d.boostTime > 0) {
    d.boostTime = Math.max(0, d.boostTime - dt);
    if (d.boostTime === 0) {
      d.boostBonus = 0;
      d.boostTier = 0;
    }
  }

  const vF = car.speedForward;
  if (!d.drifting) {
    if (input.drift && Math.abs(input.steer) > cfg.driftMinSteer && vF > cfg.minDriftSpeed) {
      d.drifting = true;
      d.charge = 0;
      d.tier = 0;
      d.direction = Math.sign(input.steer);
      d.elapsed = 0;
    }
    return;
  }

  const shouldEnd = !input.drift || vF < cfg.minDriftSpeed || hardWallHit;
  if (shouldEnd) {
    // Releasing Space cashes in the boost; losing speed or hitting a wall forfeits it.
    if (!input.drift && !hardWallHit && d.tier > 0) triggerBoost(d, d.tier, cfg);
    d.drifting = false;
    d.charge = 0;
    d.tier = 0;
    d.direction = 0;
    return;
  }

  d.elapsed += dt;
  d.charge += dt * cfg.driftChargeRate;
  d.tier = tierForCharge(d.charge, cfg);
  d.score += Math.abs(car.speedLateral) * dt * cfg.driftScoreRate;
}
