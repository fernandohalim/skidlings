import { describe, expect, it } from 'vitest';
import { CAR_CONFIG, VERTICAL_CONFIG } from '../../config/car.config';
import { CarSimulation } from '../car/CarSimulation';
import { createInputState } from '../input/types';
import { RampField, type HeightField } from './HeightField';

const DT = 1 / 60;

function drive(sim: CarSimulation, seconds: number, drift = false) {
  const inp = { ...createInputState(), throttle: 1, drift, steer: drift ? 0.5 : 0 };
  let maxAir = 0;
  let everAir = false;
  for (let t = 0; t < seconds; t += DT) {
    sim.step(inp, DT);
    everAir ||= sim.car.airborne;
    maxAir = Math.max(maxAir, sim.car.airTime);
  }
  return { everAir, maxAir };
}

describe('2.5D vertical physics', () => {
  it('never goes airborne on flat ground, even drifting', () => {
    const sim = new CarSimulation({ ...CAR_CONFIG });
    expect(drive(sim, 3).everAir).toBe(false);
    expect(drive(sim, 3, true).everAir).toBe(false);
    expect(sim.car.y).toBe(0);
  });

  it('a ramp launches a real hop and lands hard, keeping most speed', () => {
    const ramps = new RampField([{ x: 0, z: 60, heading: 0, length: 8, width: 10, height: 1.6 }]);
    const sim = new CarSimulation({ ...CAR_CONFIG });
    sim.heights = ramps;
    sim.reset(0, 0, 0);
    const { everAir, maxAir } = drive(sim, 4);
    expect(everAir).toBe(true);
    expect(maxAir).toBeGreaterThan(0.25);
    expect(sim.consumeLanding()).toBeGreaterThan(VERTICAL_CONFIG.landingMinImpact);
    expect(sim.car.airborne).toBe(false);
    expect(Math.hypot(sim.car.vx, sim.car.vz)).toBeGreaterThan(20);
  });

  it('rolling hills keep the car on the ground (no bump flicker)', () => {
    const hills: HeightField = { heightAt: (_x, z) => 0.6 * Math.sin(z / 12) };
    const sim = new CarSimulation({ ...CAR_CONFIG });
    sim.heights = hills;
    sim.reset(0, 0, 0);
    expect(drive(sim, 5).everAir).toBe(false);
  });

  it('follows the ground height up a slope', () => {
    const slope: HeightField = { heightAt: (_x, z) => Math.max(0, z * 0.1) };
    const sim = new CarSimulation({ ...CAR_CONFIG });
    sim.heights = slope;
    sim.reset(0, 0, 0);
    drive(sim, 2);
    expect(sim.car.y).toBeCloseTo(slope.heightAt(sim.car.x, sim.car.z), 1);
  });
});
