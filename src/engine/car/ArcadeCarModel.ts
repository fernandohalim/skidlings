import type { CarConfig } from '../../config/car.config';
import type { InputState } from '../input/types';
import { clamp, wrapAngle } from '../utils/math';
import type { CarState } from './types';

/** Per-step modifiers supplied by drift/nitro systems (M2). */
export interface CarStepModifiers {
  /** Multiplies maxSpeed (1 = none). */
  maxSpeedMultiplier: number;
  /** Multiplies accel (1 = none). */
  accelMultiplier: number;
  /** Multiplies yaw rate (drift). */
  yawMultiplier: number;
  /** Target lateral grip; undefined = cfg.normalGrip. */
  grip?: number;
  /** Share of scrubbed lateral speed converted to forward speed (drift), 0 = none. */
  lateralToForward?: number;
  /** One-shot forward speed added this step (mini-boost kick), m/s. */
  impulseForward?: number;
  /**
   * Drift yaw rate (rad/s, + = left). When set it replaces grip steering and is
   * NOT limited by lateral grip: that is what makes drifting the fast line.
   */
  yawOverride?: number;
  /** Airborne: reduced steering, no traction. */
  airborne?: boolean;
}

const NO_MODS: CarStepModifiers = { maxSpeedMultiplier: 1, accelMultiplier: 1, yawMultiplier: 1 };

/** Below this forward speed, S switches from braking to reversing. */
const REVERSE_THRESHOLD = 0.5;

/**
 * Pure arcade car step (§6.1–6.4). Mutates `s` in place, allocation-free.
 * Order: steer (rotate heading) → decompose velocity on new heading →
 * longitudinal forces → lateral grip → recompose → integrate.
 */
export function stepCar(
  s: CarState,
  input: InputState,
  cfg: CarConfig,
  dt: number,
  mods: CarStepModifiers = NO_MODS,
): void {
  s.prevX = s.x;
  s.prevZ = s.z;
  s.prevHeading = s.heading;

  const maxSpeed = cfg.maxSpeed * mods.maxSpeedMultiplier;

  // --- steering (§6.3), based on last step's forward speed
  const vF0 = s.speedForward;
  const absVF = Math.abs(vF0);
  const speedFactor = clamp(absVF / cfg.steerFullSpeedAt, 0, 1);
  const highSpeedDamp = clamp(1 - cfg.steerHighSpeedReduction * (absVF / cfg.maxSpeed), 0, 1);
  const dir = vF0 >= 0 ? 1 : -1;
  let understeer = 0;
  if (mods.yawOverride !== undefined) {
    s.yawRate = mods.yawOverride * speedFactor;
  } else {
    // + yawRate = turning left; right steer (+) turns right.
    s.yawRate =
      -input.steer * cfg.steerRate * speedFactor * highSpeedDamp * dir * mods.yawMultiplier;
    // Grip limit: tyres can only hold gripLatAccel sideways (a = v·ω). Asking for
    // more understeers and scrubs speed, so tight corners at speed want a drift.
    const maxYaw = cfg.gripLatAccel / Math.max(absVF, 1);
    const demand = Math.abs(s.yawRate);
    if (demand > maxYaw) {
      understeer = Math.min(1, demand / maxYaw - 1);
      s.yawRate = Math.sign(s.yawRate) * maxYaw;
    }
  }
  if (mods.airborne) s.yawRate *= cfg.airSteer;
  s.heading = wrapAngle(s.heading + s.yawRate * dt);

  // --- decompose on new heading
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const rx = -fz;
  const rz = fx;
  let vF = s.vx * fx + s.vz * fz;
  let vL = s.vx * rx + s.vz * rz;

  // --- longitudinal (§6.2); no traction in the air
  const accel = mods.airborne ? 0 : cfg.accel * mods.accelMultiplier;
  if (input.throttle > 0) {
    if (vF < -REVERSE_THRESHOLD) {
      vF = Math.min(0, vF + cfg.brakeDecel * input.throttle * dt); // braking out of reverse
    } else if (vF < maxSpeed) {
      vF = Math.min(maxSpeed, vF + accel * input.throttle * dt);
    }
  }
  if (input.brake > 0) {
    if (vF > REVERSE_THRESHOLD) {
      vF = Math.max(0, vF - cfg.brakeDecel * input.brake * dt);
    } else if (input.throttle === 0) {
      vF = Math.max(-cfg.maxReverseSpeed, vF - cfg.reverseAccel * input.brake * dt);
    }
  }
  if (input.throttle === 0 && input.brake === 0) {
    const coast = cfg.coastDecel * dt;
    vF = Math.abs(vF) <= coast ? 0 : vF - Math.sign(vF) * coast;
  }
  vF *= Math.exp(-cfg.dragCoef * dt);
  if (understeer > 0 && vF > 0) vF = Math.max(0, vF - cfg.cornerScrub * understeer * dt);
  if (mods.impulseForward) vF += mods.impulseForward;
  // Bleed off speed above the current cap (after boosts end) smoothly, not instantly.
  if (vF > maxSpeed) vF = Math.max(maxSpeed, vF - cfg.overspeedDecel * dt);

  // --- lateral grip (§6.4): blend grip toward target, then decay sideways speed
  const targetGrip = mods.grip ?? cfg.normalGrip;
  if (s.grip < targetGrip && cfg.gripRecoveryTime > 0) {
    // Ease back to full grip over gripRecoveryTime (no snap after a drift).
    const rate = ((cfg.normalGrip - cfg.driftGrip) / cfg.gripRecoveryTime) * dt;
    s.grip = Math.min(targetGrip, s.grip + rate);
  } else {
    s.grip = targetGrip;
  }
  const vLAfter = vL * Math.exp(-(mods.airborne ? cfg.airGrip : s.grip) * dt);
  // Drift keeps momentum: part of the scrubbed slide becomes forward speed.
  if (mods.lateralToForward && vF > 0 && vF < maxSpeed) {
    const gain = (Math.abs(vL) - Math.abs(vLAfter)) * mods.lateralToForward;
    vF = Math.min(maxSpeed, vF + gain);
  }
  vL = vLAfter;

  // --- recompose + integrate
  s.vx = fx * vF + rx * vL;
  s.vz = fz * vF + rz * vL;
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  s.speedForward = vF;
  s.speedLateral = vL;
}

/** Absolute planar speed (m/s). */
export function carSpeed(s: CarState): number {
  return Math.hypot(s.vx, s.vz);
}
