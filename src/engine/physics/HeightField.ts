/** Ground height query for the 2.5D world (hills, ramps). */
export interface HeightField {
  heightAt(x: number, z: number): number;
}

export const FLAT_GROUND: HeightField = { heightAt: () => 0 };

/** A wedge ramp: rises along its direction, then drops (a kicker). */
export interface RampShape {
  x: number;
  z: number;
  /** Yaw of the up-slope direction (same convention as car heading). */
  heading: number;
  length: number;
  width: number;
  height: number;
}

/** Height of a single ramp at (x, z), 0 outside it. Linear slope (matches the wedge mesh). */
export function rampHeight(r: RampShape, x: number, z: number): number {
  const fx = Math.sin(r.heading);
  const fz = Math.cos(r.heading);
  const dx = x - r.x;
  const dz = z - r.z;
  const along = dx * fx + dz * fz; // 0 at the foot, `length` at the lip
  const side = dx * -fz + dz * fx;
  if (along < 0 || along > r.length || Math.abs(side) > r.width / 2) return 0;
  return (r.height * along) / r.length;
}

/** Flat ground + a set of wedge ramps (lobby / toy town). */
export class RampField implements HeightField {
  constructor(readonly ramps: RampShape[]) {}
  heightAt(x: number, z: number): number {
    let h = 0;
    for (const r of this.ramps) {
      const v = rampHeight(r, x, z);
      if (v > h) h = v;
    }
    return h;
  }
}
