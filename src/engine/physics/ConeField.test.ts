import { describe, expect, it } from 'vitest';
import { LOBBY_CONFIG } from '../../config/lobby.config';
import { createCarState } from '../car/types';
import { ConeField } from './ConeField';
import { CollisionWorld, EMPTY_WORLD } from './World';

const DT = 1 / 60;

describe('ConeField', () => {
  it('a driving car knocks a cone forward and barely slows down', () => {
    const cones = new ConeField([[0, 5]], LOBBY_CONFIG.cone);
    const car = createCarState(0, 0, 0);
    car.vz = 15;
    for (let i = 0; i < 30; i++) {
      car.prevZ = car.z;
      car.z += car.vz * DT;
      cones.step(car, 1, 1, EMPTY_WORLD, DT);
    }
    expect(cones.vz[0]!).toBeGreaterThan(5);
    expect(cones.z[0]!).toBeGreaterThan(car.z);
    expect(car.vz).toBeGreaterThan(13);
  });

  it('friction brings a pushed cone to rest', () => {
    const cones = new ConeField([[0, 0]], LOBBY_CONFIG.cone);
    cones.vx[0] = 10;
    const car = createCarState(100, 100, 0);
    for (let i = 0; i < 600; i++) cones.step(car, 1, 1, EMPTY_WORLD, DT);
    expect(Math.abs(cones.vx[0]!)).toBeLessThan(0.05);
  });

  it('cones bounce off walls instead of passing through', () => {
    const world = new CollisionWorld(new Float32Array([-50, 3, 50, 3]));
    const cones = new ConeField([[0, 0]], LOBBY_CONFIG.cone);
    cones.vz[0] = 12;
    const car = createCarState(100, 100, 0);
    for (let i = 0; i < 120; i++) cones.step(car, 1, 1, world, DT);
    expect(cones.z[0]!).toBeLessThan(3);
  });

  it('reset puts cones home', () => {
    const cones = new ConeField([[2, 3]], LOBBY_CONFIG.cone);
    cones.x[0] = 40;
    cones.vx[0] = 4;
    cones.reset();
    expect(cones.x[0]).toBe(2);
    expect(cones.vx[0]).toBe(0);
  });
});
