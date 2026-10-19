import type { CarConfig } from '../../config/car.config';

/** Nitro meter (§6.6). */
export interface NitroState {
  amount: number;
  active: boolean;
  /** True for the single step nitro switched on (camera FOV kick / whoosh). */
  justActivated: boolean;
}

export function createNitroState(amount: number): NitroState {
  return { amount, active: false, justActivated: false };
}

export type NitroMode = 'lobby' | 'race';

export function updateNitro(
  n: NitroState,
  wantsNitro: boolean,
  drifting: boolean,
  mode: NitroMode,
  cfg: CarConfig,
  dt: number,
): void {
  const wasActive = n.active;
  n.active = wantsNitro && n.amount > 0;
  n.justActivated = n.active && !wasActive;

  if (n.active) n.amount -= cfg.nitroDrainPerSecond * dt;
  if (drifting) n.amount += cfg.nitroFillPerSecondDrifting * dt;
  if (mode === 'lobby' && !n.active) n.amount += cfg.nitroFillPerSecondLobby * dt;
  n.amount = Math.min(cfg.nitroMax, Math.max(0, n.amount));
}

/**
 * Combined speed bonus from mini-boost + nitro, capped (§6.6).
 * Returns the maxSpeed multiplier.
 */
export function combinedSpeedMultiplier(
  boostBonus: number,
  nitroActive: boolean,
  cfg: CarConfig,
): number {
  const nitroBonus = nitroActive ? cfg.nitroMaxSpeedMultiplier - 1 : 0;
  return 1 + Math.min(boostBonus + nitroBonus, cfg.maxTotalSpeedBonus);
}
