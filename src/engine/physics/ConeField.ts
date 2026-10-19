import type { CarState } from '../car/types';
import type { CollisionWorld } from './World';

export interface ConeConfig {
  radius: number;
  /** Velocity damping on the ground (1/s). */
  friction: number;
  /** How hard the car bats a cone away (× approach speed). */
  restitution: number;
  /** Share of the car's own velocity a hit cone picks up. */
  carry: number;
  /** Fraction of car speed lost per cone hit (light!). */
  carSlowdown: number;
  /** Visual spin (rad per meter traveled). */
  spinPerMeter: number;
}

/**
 * Light pushable cones (§8.4): circle bodies the car knocks around. They
 * collide with static walls but not with each other. Pure TS, allocation-free.
 */
export class ConeField {
  readonly count: number;
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly vx: Float32Array;
  readonly vz: Float32Array;
  /** Accumulated spin (rad) for the visual tumble. */
  readonly spin: Float32Array;
  private readonly homeX: Float32Array;
  private readonly homeZ: Float32Array;
  private readonly push = { x: 0, z: 0, hits: 0, nx: 0, nz: 0 };

  constructor(
    positions: [number, number][],
    readonly cfg: ConeConfig,
  ) {
    this.count = positions.length;
    this.x = Float32Array.from(positions, (p) => p[0]);
    this.z = Float32Array.from(positions, (p) => p[1]);
    this.homeX = this.x.slice();
    this.homeZ = this.z.slice();
    this.vx = new Float32Array(this.count);
    this.vz = new Float32Array(this.count);
    this.spin = new Float32Array(this.count);
  }

  /** Puts every cone back where it started. */
  reset(): void {
    this.x.set(this.homeX);
    this.z.set(this.homeZ);
    this.vx.fill(0);
    this.vz.fill(0);
    this.spin.fill(0);
  }

  /**
   * Advance one fixed step. The car is two circles along its heading
   * (`carRadius`, ±`carOffset`). Returns the number of cones hit this step.
   */
  step(
    car: CarState,
    carRadius: number,
    carOffset: number,
    world: CollisionWorld,
    dt: number,
  ): number {
    const c = this.cfg;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const reach = carRadius + c.radius;
    const damp = Math.exp(-c.friction * dt);
    let hits = 0;

    for (let i = 0; i < this.count; i++) {
      // car vs cone
      for (let side = -1; side <= 1; side += 2) {
        const ccx = car.x + fx * carOffset * side;
        const ccz = car.z + fz * carOffset * side;
        const dx = this.x[i]! - ccx;
        const dz = this.z[i]! - ccz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= reach * reach) continue;
        const d = Math.sqrt(d2) || 1e-4;
        const nx = dx / d;
        const nz = dz / d;
        // Cone is light: it takes the whole separation.
        this.x[i] = ccx + nx * reach;
        this.z[i] = ccz + nz * reach;
        const approach = (car.vx - this.vx[i]!) * nx + (car.vz - this.vz[i]!) * nz;
        if (approach > 0) {
          this.vx[i] = this.vx[i]! + nx * approach * c.restitution + car.vx * c.carry;
          this.vz[i] = this.vz[i]! + nz * approach * c.restitution + car.vz * c.carry;
          car.vx *= 1 - c.carSlowdown;
          car.vz *= 1 - c.carSlowdown;
          hits++;
        }
      }

      // integrate + friction
      const vx = this.vx[i]! * damp;
      const vz = this.vz[i]! * damp;
      this.vx[i] = vx;
      this.vz[i] = vz;
      this.x[i] = this.x[i]! + vx * dt;
      this.z[i] = this.z[i]! + vz * dt;
      this.spin[i] = this.spin[i]! + Math.hypot(vx, vz) * dt * c.spinPerMeter;

      // walls: bounce off
      if (world.segmentCount > 0) {
        world.resolveCircle(this.x[i]!, this.z[i]!, c.radius, this.push);
        if (this.push.hits > 0) {
          this.x[i] = this.push.x;
          this.z[i] = this.push.z;
          const vn = vx * this.push.nx + vz * this.push.nz;
          if (vn < 0) {
            this.vx[i] = vx - 1.6 * vn * this.push.nx;
            this.vz[i] = vz - 1.6 * vn * this.push.nz;
          }
        }
      }
    }
    return hits;
  }
}
