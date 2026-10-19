import { describe, expect, it } from 'vitest';
import { CAR_CONFIG } from '../../config/car.config';
import { createInputState, type InputState } from '../input/types';
import { CarSimulation } from './CarSimulation';
import { tierForCharge } from './DriftSystem';
import { combinedSpeedMultiplier } from './NitroSystem';

const DT = 1 / 60;

function run(sim: CarSimulation, input: Partial<InputState>, seconds: number) {
  const inp = { ...createInputState(), ...input };
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) sim.step(inp, DT);
}

/** Gets the car up to cruising speed. */
function cruising(): CarSimulation {
  const sim = new CarSimulation({ ...CAR_CONFIG }, undefined, 'race', 50);
  run(sim, { throttle: 1 }, 2.5);
  return sim;
}

describe('DriftSystem', () => {
  it('maps charge to tiers at the configured thresholds', () => {
    const [t1, t2, t3] = CAR_CONFIG.driftTiers.map((t) => t.minCharge) as [number, number, number];
    expect(tierForCharge(t1 - 0.01, CAR_CONFIG)).toBe(0);
    expect(tierForCharge(t1, CAR_CONFIG)).toBe(1);
    expect(tierForCharge(t2, CAR_CONFIG)).toBe(2);
    expect(tierForCharge(t3, CAR_CONFIG)).toBe(3);
    expect(tierForCharge(99, CAR_CONFIG)).toBe(3);
  });

  it('does not start a drift without steering or below min speed', () => {
    const slow = new CarSimulation({ ...CAR_CONFIG });
    run(slow, { throttle: 1, drift: true, steer: 1 }, 0.2);
    expect(slow.drift.drifting).toBe(false);

    const straight = cruising();
    run(straight, { throttle: 1, drift: true }, 0.2);
    expect(straight.drift.drifting).toBe(false);
  });

  it('drifting lowers grip so the car slides sideways', () => {
    const grip = cruising();
    run(grip, { throttle: 1, steer: 1 }, 0.6);
    const sim = cruising();
    run(sim, { throttle: 1, steer: 1, drift: true }, 0.6);
    expect(sim.drift.drifting).toBe(true);
    expect(Math.abs(sim.car.speedLateral)).toBeGreaterThan(Math.abs(grip.car.speedLateral) * 2);
  });

  it('releasing after a tier-2 charge fires a tier-2 mini-boost', () => {
    const sim = cruising();
    run(sim, { throttle: 1, steer: 0.6, drift: true }, 1.8);
    expect(sim.drift.tier).toBe(2);
    run(sim, { throttle: 1 }, DT);
    expect(sim.drift.drifting).toBe(false);
    expect(sim.drift.boostTier).toBe(2);
    expect(sim.drift.boostTime).toBeCloseTo(CAR_CONFIG.driftTiers[1]!.duration, 1);
  });

  it('a short drift (below tier 1) gives no boost', () => {
    const sim = cruising();
    run(sim, { throttle: 1, steer: 1, drift: true }, 0.4);
    run(sim, { throttle: 1 }, DT);
    expect(sim.drift.boostTime).toBe(0);
  });

  it('a long drift keeps most of the entry speed (momentum retention)', () => {
    const sim = cruising();
    const entry = sim.car.speedForward;
    run(sim, { throttle: 1, steer: 1, drift: true }, 1.5);
    expect(sim.drift.drifting).toBe(true);
    expect(Math.hypot(sim.car.vx, sim.car.vz)).toBeGreaterThan(entry * 0.7);
  });

  it('never spins out: slip angle stays within maxDriftAngle during a long hard drift', () => {
    const sim = cruising();
    const inp = { ...createInputState(), throttle: 1, steer: 1, drift: true };
    let maxSlip = 0;
    for (let i = 0; i < 240; i++) {
      sim.step(inp, DT);
      const c = sim.car;
      const travel = Math.atan2(c.vx, c.vz);
      let slip = c.heading - travel;
      slip = Math.atan2(Math.sin(slip), Math.cos(slip));
      maxSlip = Math.max(maxSlip, Math.abs(slip));
    }
    expect(sim.drift.drifting).toBe(true);
    expect(maxSlip).toBeLessThanOrEqual(CAR_CONFIG.maxDriftAngle + 1e-6);
    expect(maxSlip).toBeGreaterThan(0.3); // it is actually sliding
  });

  it('drift is the fast line: turns 90° far quicker than gripping, keeping more speed', () => {
    const turn90 = (drift: boolean) => {
      const sim = cruising();
      const startYaw = Math.atan2(sim.car.vx, sim.car.vz);
      const inp = { ...createInputState(), throttle: 1, steer: 1, drift };
      let t = 0;
      for (; t < 6; t += DT) {
        sim.step(inp, DT);
        const travel = Math.atan2(sim.car.vx, sim.car.vz);
        let d = startYaw - travel;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (d >= Math.PI / 2) break;
      }
      return { t, speed: Math.hypot(sim.car.vx, sim.car.vz) };
    };
    const grip = turn90(false);
    const slide = turn90(true);
    expect(slide.t).toBeLessThan(grip.t * 0.7);
    expect(slide.speed).toBeGreaterThan(grip.speed);
  });

  it('gripping at speed understeers: turn rate is capped by lateral grip', () => {
    const sim = cruising();
    run(sim, { throttle: 1, steer: 1 }, 0.5);
    const v = Math.abs(sim.car.speedForward);
    expect(Math.abs(sim.car.yawRate)).toBeLessThanOrEqual(CAR_CONFIG.gripLatAccel / v + 1e-6);
  });

  it('accumulates drift score while sliding', () => {
    const sim = cruising();
    run(sim, { throttle: 1, steer: 1, drift: true }, 1);
    expect(sim.drift.score).toBeGreaterThan(0);
  });

  it('a boost lets the car exceed its normal top speed', () => {
    const sim = new CarSimulation({ ...CAR_CONFIG });
    run(sim, { throttle: 1 }, 10);
    sim.boost(3);
    run(sim, { throttle: 1 }, 0.8);
    expect(sim.car.speedForward).toBeGreaterThan(CAR_CONFIG.maxSpeed * 1.1);
  });
});

describe('NitroSystem', () => {
  it('drains while held and stops at zero', () => {
    const sim = new CarSimulation({ ...CAR_CONFIG }, undefined, 'race', 30);
    run(sim, { throttle: 1, nitro: true }, 0.5);
    expect(sim.nitro.amount).toBeCloseTo(30 - CAR_CONFIG.nitroDrainPerSecond * 0.5, 0);
    run(sim, { throttle: 1, nitro: true }, 2);
    expect(sim.nitro.amount).toBe(0);
    expect(sim.nitro.active).toBe(false);
  });

  it('fills from drifting, never above nitroMax', () => {
    const sim = cruising();
    const before = sim.nitro.amount;
    run(sim, { throttle: 1, steer: 1, drift: true }, 1);
    expect(sim.nitro.amount).toBeGreaterThan(before);
    sim.nitro.amount = CAR_CONFIG.nitroMax - 1;
    run(sim, { throttle: 1, steer: 1, drift: true }, 1);
    expect(sim.nitro.amount).toBeLessThanOrEqual(CAR_CONFIG.nitroMax);
  });

  it('refills over time in the lobby but not in races', () => {
    const lobby = new CarSimulation({ ...CAR_CONFIG }, undefined, 'lobby', 0);
    const race = new CarSimulation({ ...CAR_CONFIG }, undefined, 'race', 0);
    run(lobby, {}, 1);
    run(race, {}, 1);
    expect(lobby.nitro.amount).toBeCloseTo(CAR_CONFIG.nitroFillPerSecondLobby, 0);
    expect(race.nitro.amount).toBe(0);
  });

  it('nitro + boost stack but are capped at maxTotalSpeedBonus', () => {
    expect(combinedSpeedMultiplier(0, false, CAR_CONFIG)).toBe(1);
    expect(combinedSpeedMultiplier(0, true, CAR_CONFIG)).toBeCloseTo(1.4);
    expect(combinedSpeedMultiplier(0.35, true, CAR_CONFIG)).toBeCloseTo(
      1 + CAR_CONFIG.maxTotalSpeedBonus,
    );
  });
});
