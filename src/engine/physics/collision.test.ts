import { describe, expect, it } from 'vitest';
import { CAR_CONFIG } from '../../config/car.config';
import { CarSimulation } from '../car/CarSimulation';
import { createInputState } from '../input/types';
import { circleVsSegment, createContact } from './collision';
import { CollisionWorld } from './World';

describe('collision', () => {
  it('circle vs segment reports normal and depth', () => {
    const c = createContact();
    expect(circleVsSegment(0, 0.5, 1, -5, 0, 5, 0, c)).toBe(true);
    expect(c.nz).toBeCloseTo(1);
    expect(c.depth).toBeCloseTo(0.5);
    expect(circleVsSegment(0, 2, 1, -5, 0, 5, 0, c)).toBe(false);
    // beyond the endpoint uses the endpoint
    expect(circleVsSegment(5.5, 0, 1, -5, 0, 5, 0, c)).toBe(true);
    expect(c.nx).toBeCloseTo(1);
  });

  it('world pushes a circle fully out of a wall', () => {
    const w = new CollisionWorld(new Float32Array([-50, 10, 50, 10]));
    const out = { x: 0, z: 0, hits: 0, nx: 0, nz: 0 };
    w.resolveCircle(0, 9.5, 1, out);
    expect(out.hits).toBe(1);
    expect(out.z).toBeCloseTo(9);
    w.resolveCircle(0, 0, 1, out);
    expect(out.hits).toBe(0);
  });

  it('car slides along a wall at an angle, keeping most of its speed', () => {
    // Long wall along X at z = 20; car drives +Z angled 30° toward +X.
    const world = new CollisionWorld(new Float32Array([-500, 20, 500, 20]));
    const sim = new CarSimulation({ ...CAR_CONFIG }, world);
    sim.reset(0, 0, Math.PI / 6);
    const input = { ...createInputState(), throttle: 1 };
    for (let i = 0; i < 180; i++) sim.step(input, 1 / 60);
    // Never tunnels through the wall
    expect(sim.car.z).toBeLessThan(20);
    // Still moving fast along the wall instead of stopping dead
    expect(Math.hypot(sim.car.vx, sim.car.vz)).toBeGreaterThan(10);
    expect(sim.car.x).toBeGreaterThan(10);
  });

  it('a car pinned nose-first into a wall turns along it and drives free on throttle', () => {
    const world = new CollisionWorld(new Float32Array([-500, 6, 500, 6]));
    const sim = new CarSimulation({ ...CAR_CONFIG }, world);
    sim.reset(0, 2, 0.05); // facing the wall almost perpendicular
    const input = { ...createInputState(), throttle: 1 };
    for (let i = 0; i < 240; i++) sim.step(input, 1 / 60);
    expect(sim.car.z).toBeLessThan(6);
    expect(Math.hypot(sim.car.vx, sim.car.vz)).toBeGreaterThan(8);
  });

  it('head-on hit stops forward motion without passing through', () => {
    const world = new CollisionWorld(new Float32Array([-50, 15, 50, 15]));
    const sim = new CarSimulation({ ...CAR_CONFIG }, world);
    const input = { ...createInputState(), throttle: 1 };
    for (let i = 0; i < 240; i++) sim.step(input, 1 / 60);
    expect(sim.car.z).toBeLessThan(15);
  });
});
