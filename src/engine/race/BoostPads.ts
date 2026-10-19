import type { CarSimulation } from '../car/CarSimulation';
import type { RoadPatch } from '../track/TrackDefinition';

/**
 * Boost pads on the road: any car (player or bot) driving over one gets a
 * mini-boost. Per-car, per-pad cooldown so a pad fires once per pass.
 */
export class BoostPads {
  private readonly cooldowns = new WeakMap<CarSimulation, Float32Array>();

  constructor(
    readonly pads: RoadPatch[],
    readonly tier: number,
    readonly cooldown = 1.5,
  ) {}

  /** Call once per fixed step per car. Returns the index of a pad that fired, or -1. */
  update(sim: CarSimulation, dt: number): number {
    let cd = this.cooldowns.get(sim);
    if (!cd) {
      cd = new Float32Array(this.pads.length);
      this.cooldowns.set(sim, cd);
    }
    const c = sim.car;
    let fired = -1;
    for (let i = 0; i < this.pads.length; i++) {
      if (cd[i]! > 0) {
        cd[i] = cd[i]! - dt;
        continue;
      }
      const p = this.pads[i]!;
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const dx = c.x - p.x;
      const dz = c.z - p.z;
      const along = dx * fx + dz * fz;
      const side = dx * -fz + dz * fx;
      if (Math.abs(along) < p.length / 2 && Math.abs(side) < p.width / 2 && !c.airborne) {
        sim.boost(this.tier);
        cd[i] = this.cooldown;
        fired = i;
      }
    }
    return fired;
  }
}
