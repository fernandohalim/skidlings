import { VERTICAL_CONFIG, type CarConfig } from '../../config/car.config';
import { FLAT_GROUND, type HeightField } from '../physics/HeightField';
import type { InputState } from '../input/types';
import { EMPTY_WORLD, type CollisionWorld } from '../physics/World';
import { clamp, wrapAngle } from '../utils/math';
import { stepCar, type CarStepModifiers } from './ArcadeCarModel';
import { createDriftState, triggerBoost, updateDrift, type DriftState } from './DriftSystem';
import {
  combinedSpeedMultiplier,
  createNitroState,
  updateNitro,
  type NitroMode,
  type NitroState,
} from './NitroSystem';
import { createCarState, resetCarState, type CarState } from './types';

/** Impact speed (m/s into the wall) above which tangential speed is scrubbed. */
const SCRAPE_THRESHOLD = 2;
/** How much of the gap between heading and wall direction is closed on a solid hit. */
const WALL_ALIGN = 0.25;
/** While touching a wall and facing into it, the nose turns along the wall at this rate (rad/s). */
const WALL_UNPIN_RATE = 3;
/** heading·normal below this counts as "facing into the wall". */
const FACING_WALL_DOT = -0.2;

/**
 * One player/AI car: arcade model + drift + nitro + forgiving wall collisions.
 * Pure TS, allocation-free per step.
 */
export class CarSimulation {
  readonly car: CarState;
  readonly drift: DriftState = createDriftState();
  readonly nitro: NitroState;
  /** Strongest wall impact speed during the last step (for audio/VFX). */
  lastImpact = 0;
  /** Strongest impact since the last `consumeImpact()` (frames span several steps). */
  private peakImpact = 0;

  /** Hardest landing (m/s down) since the last `consumeLanding()`. */
  private peakLanding = 0;
  private hardHit = false;
  /** Ground under the car (2.5D). */
  heights: HeightField = FLAT_GROUND;
  private readonly mods: CarStepModifiers = {
    maxSpeedMultiplier: 1,
    accelMultiplier: 1,
    yawMultiplier: 1,
    grip: 0,
    impulseForward: 0,
    lateralToForward: 0,
    yawOverride: undefined,
    airborne: false,
  };
  private readonly push = { x: 0, z: 0, hits: 0, nx: 0, nz: 0 };

  constructor(
    public cfg: CarConfig,
    public world: CollisionWorld = EMPTY_WORLD,
    public mode: NitroMode = 'lobby',
    startNitro = cfg.nitroMax,
  ) {
    this.car = createCarState(0, 0, 0, cfg.normalGrip);
    this.nitro = createNitroState(startNitro);
  }

  reset(x: number, z: number, heading: number): void {
    resetCarState(this.car, x, z, heading, this.heights.heightAt(x, z));
    this.drift.drifting = false;
    this.drift.charge = 0;
    this.drift.tier = 0;
    this.drift.boostTime = 0;
    this.drift.boostBonus = 0;
    this.drift.boostTier = 0;
    this.car.grip = this.cfg.normalGrip;
  }

  /** Full reset for a (re)started race: pose, nitro meter and drift score. */
  resetForRace(x: number, z: number, heading: number, nitro: number): void {
    this.reset(x, z, heading);
    this.nitro.amount = nitro;
    this.nitro.active = false;
    this.drift.score = 0;
  }

  /** Returns the hardest landing since the previous call, then clears it. */
  consumeLanding(): number {
    const v = this.peakLanding;
    this.peakLanding = 0;
    return v;
  }

  /** Returns the hardest wall hit since the previous call, then clears it. */
  consumeImpact(): number {
    const v = this.peakImpact;
    this.peakImpact = 0;
    return v;
  }

  /** Perfect-start / pickup boost. */
  boost(tier: number): void {
    triggerBoost(this.drift, tier, this.cfg);
  }

  step(input: InputState, dt: number): void {
    const { cfg, car, drift, nitro, mods } = this;

    updateDrift(drift, input, car, cfg, dt, this.hardHit);
    updateNitro(nitro, input.nitro, drift.drifting, this.mode, cfg, dt);

    const boosting = drift.boostTime > 0;
    mods.maxSpeedMultiplier = combinedSpeedMultiplier(drift.boostBonus, nitro.active, cfg);
    mods.accelMultiplier =
      (nitro.active ? cfg.nitroAccelMultiplier : 1) * (boosting ? cfg.boostAccelMultiplier : 1);
    mods.yawMultiplier = 1;
    // Drift steering: a steady arc you tighten by steering into the slide or
    // widen by counter-steering. direction: -1 left, +1 right; + yaw = left.
    if (drift.drifting) {
      const into = clamp(input.steer * drift.direction, -1, 1);
      const yaw = Math.max(0.15, cfg.driftBaseYaw + into * cfg.driftSteerYaw);
      mods.yawOverride = -drift.direction * yaw;
    } else {
      mods.yawOverride = undefined;
    }
    mods.grip = drift.drifting ? cfg.driftGrip : cfg.normalGrip;
    mods.impulseForward = drift.boostKick;
    mods.airborne = car.airborne;
    mods.lateralToForward = drift.drifting ? cfg.driftSpeedRetention : 0;

    // Drift flick: a quick extra rotation into the slide as it starts.
    if (drift.drifting && drift.elapsed < cfg.driftKickTime) {
      car.heading = wrapAngle(car.heading - drift.direction * cfg.driftKickYawRate * dt);
    }

    stepCar(car, input, cfg, dt, mods);
    if (drift.drifting) this.capDriftAngle();
    this.collide(dt);
    this.stepVertical(dt);
  }

  /**
   * 2.5D vertical motion: follow the ground while it keeps up with gravity;
   * when it falls away faster (ramp lip, hill crest) the car flies.
   */
  private stepVertical(dt: number): void {
    const c = this.car;
    const v = VERTICAL_CONFIG;
    const ground = this.heights.heightAt(c.x, c.z);
    c.prevY = c.y;
    c.vy -= v.gravity * dt;
    const y = c.y + c.vy * dt;
    if (y <= ground || (!c.airborne && y - ground < v.groundSnap)) {
      if (c.airborne) {
        const impact = -c.vy;
        if (impact > v.landingMinImpact) {
          if (impact > this.peakLanding) this.peakLanding = impact;
          c.vx *= v.landingSpeedKeep;
          c.vz *= v.landingSpeedKeep;
        }
      }
      c.vy = Math.max(-v.maxSlopeVy, Math.min(v.maxSlopeVy, (ground - c.y) / dt));
      c.y = ground;
      c.airborne = false;
      c.airTime = 0;
    } else {
      c.y = y;
      c.airborne = true;
      c.airTime += dt;
    }
  }

  /** Keeps the slide controllable: heading never swings past maxDriftAngle from travel. */
  private capDriftAngle(): void {
    const { car, cfg } = this;
    const speed = Math.hypot(car.vx, car.vz);
    if (speed < 1) return;
    const travel = Math.atan2(car.vx, car.vz);
    const slip = wrapAngle(car.heading - travel);
    if (Math.abs(slip) <= cfg.maxDriftAngle) return;
    car.heading = wrapAngle(travel + Math.sign(slip) * cfg.maxDriftAngle);
    const hx = Math.sin(car.heading);
    const hz = Math.cos(car.heading);
    car.speedForward = car.vx * hx + car.vz * hz;
    car.speedLateral = car.vx * -hz + car.vz * hx;
  }

  /** Forgiving wall response (§6.7): slide along, keep most tangential speed, never pin. */
  private collide(dt: number): void {
    const { car, cfg, push } = this;
    this.lastImpact = 0;
    this.hardHit = false;
    if (this.world.segmentCount === 0) return;

    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const off = cfg.collisionCircleOffset;
    let touched = false;

    for (let side = -1; side <= 1; side += 2) {
      const cx = car.x + fx * off * side;
      const cz = car.z + fz * off * side;
      this.world.resolveCircle(cx, cz, cfg.collisionRadius, push);
      if (push.hits === 0) continue;
      touched = true;
      car.x += push.x - cx;
      car.z += push.z - cz;

      const vn = car.vx * push.nx + car.vz * push.nz;
      if (vn < 0) {
        // Remove only the into-wall component.
        car.vx -= push.nx * vn;
        car.vz -= push.nz * vn;
        const impact = -vn;
        if (impact > this.lastImpact) this.lastImpact = impact;
        if (impact > SCRAPE_THRESHOLD) {
          car.vx *= cfg.wallTangentialKeep;
          car.vz *= cfg.wallTangentialKeep;
          // Nudge the nose along the wall so the player isn't pinned into it.
          const sp = Math.hypot(car.vx, car.vz);
          if (sp > 1) {
            const travelYaw = Math.atan2(car.vx, car.vz);
            car.heading = wrapAngle(car.heading + wrapAngle(travelYaw - car.heading) * WALL_ALIGN);
          }
        }
      }

      // Anti-pin: nose into the wall at low speed can't steer out (no speed → no
      // yaw), so swing it toward whichever wall tangent is closer.
      const hx = Math.sin(car.heading);
      const hz = Math.cos(car.heading);
      if (hx * push.nx + hz * push.nz < FACING_WALL_DOT) {
        let tx = -push.nz;
        let tz = push.nx;
        if (tx * hx + tz * hz < 0) {
          tx = -tx;
          tz = -tz;
        }
        const diff = wrapAngle(Math.atan2(tx, tz) - car.heading);
        const maxTurn = WALL_UNPIN_RATE * dt;
        car.heading = wrapAngle(car.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)));
      }
    }

    if (touched) {
      const hx = Math.sin(car.heading);
      const hz = Math.cos(car.heading);
      car.speedForward = car.vx * hx + car.vz * hz;
      car.speedLateral = car.vx * -hz + car.vz * hx;
      this.hardHit = this.lastImpact > cfg.wallHardHitSpeed;
      if (this.lastImpact > this.peakImpact) this.peakImpact = this.lastImpact;
    }
  }
}
