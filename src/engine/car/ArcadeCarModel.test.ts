import { describe, expect, it } from 'vitest';
import { CAR_CONFIG, resolveCarConfig } from '../../config/car.config';
import { createInputState, type InputState } from '../input/types';
import { stepCar } from './ArcadeCarModel';
import { createCarState, type CarState } from './types';

const DT = 1 / 60;

function run(s: CarState, input: Partial<InputState>, seconds: number, cfg = CAR_CONFIG) {
  const inp = { ...createInputState(), ...input };
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) stepCar(s, inp, cfg, DT);
}

describe('ArcadeCarModel', () => {
  it('accelerates forward (+Z at heading 0) and caps at maxSpeed', () => {
    const s = createCarState();
    run(s, { throttle: 1 }, 10);
    expect(s.z).toBeGreaterThan(100);
    expect(Math.abs(s.x)).toBeLessThan(1e-6);
    expect(s.speedForward).toBeLessThanOrEqual(CAR_CONFIG.maxSpeed);
    expect(s.speedForward).toBeGreaterThan(CAR_CONFIG.maxSpeed * 0.98);
  });

  it('each car preset respects its own top speed', () => {
    for (const id of ['balanced', 'drifter', 'speedster'] as const) {
      const cfg = resolveCarConfig(id);
      const s = createCarState();
      run(s, { throttle: 1 }, 12, cfg);
      expect(s.speedForward).toBeLessThanOrEqual(cfg.maxSpeed);
      expect(s.speedForward).toBeGreaterThan(cfg.maxSpeed * 0.98);
    }
  });

  it('cannot turn when stationary', () => {
    const s = createCarState();
    run(s, { steer: 1 }, 2);
    expect(s.heading).toBe(0);
    expect(s.x).toBe(0);
    expect(s.z).toBe(0);
  });

  it('steering right turns toward -X (car right side at heading 0)', () => {
    const s = createCarState();
    run(s, { throttle: 1 }, 1);
    run(s, { throttle: 1, steer: 1 }, 0.5);
    expect(s.heading).toBeLessThan(0);
    expect(s.x).toBeLessThan(0);
  });

  it('lateral speed decays by exp(-grip * dt)', () => {
    const s = createCarState();
    s.vx = -10; // heading 0 → right = (-1, 0), so this is +10 lateral
    stepCar(s, createInputState(), CAR_CONFIG, DT);
    expect(s.speedLateral).toBeCloseTo(10 * Math.exp(-CAR_CONFIG.normalGrip * DT), 6);
  });

  it('brakes to a stop, then reverses up to maxReverseSpeed', () => {
    const s = createCarState();
    run(s, { throttle: 1 }, 2);
    run(s, { brake: 1 }, 1);
    expect(s.speedForward).toBeLessThan(0);
    run(s, { brake: 1 }, 5);
    expect(s.speedForward).toBeGreaterThanOrEqual(-CAR_CONFIG.maxReverseSpeed);
    expect(s.speedForward).toBeLessThan(-CAR_CONFIG.maxReverseSpeed * 0.95);
  });

  it('reversing steers inverted (like a real car)', () => {
    const s = createCarState();
    run(s, { brake: 1 }, 2);
    run(s, { brake: 1, steer: 1 }, 0.5);
    expect(s.heading).toBeGreaterThan(0);
  });

  it('coasts to a full stop with no input', () => {
    const s = createCarState();
    run(s, { throttle: 1 }, 1);
    run(s, {}, 15);
    expect(s.speedForward).toBe(0);
  });
});
