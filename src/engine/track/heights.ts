import type { HeightField } from '../physics/HeightField';
import type { TrackFeatures } from './TrackDefinition';

/** Wrap-aware forward distance from a to b along a loop of `length`. */
const fwd = (a: number, b: number, length: number) => (((b - a) % length) + length) % length;

/**
 * Road height per centerline sample (2.5D): smooth cosine interpolation of
 * elevation keypoints, plus kicker ramps (rise, then instant drop at the lip)
 * and smooth dips. Fractions are measured from the start line (sample 0).
 */
export function buildRoadHeights(
  features: TrackFeatures | undefined,
  dist: Float32Array,
  length: number,
): Float32Array {
  const n = dist.length;
  const h = new Float32Array(n);
  const keys = [...(features?.elevation ?? [[0, 0]])].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < n; i++) {
    const f = dist[i]! / length;
    // find the key segment containing f (wrapping last → first)
    let k = keys.length - 1;
    for (let j = 0; j < keys.length; j++) if (keys[j]![0] <= f) k = j;
    const a = keys[k]!;
    const b = keys[(k + 1) % keys.length]!;
    const span = fwd(a[0], b[0], 1) || 1;
    const t = fwd(a[0], f, 1) / span;
    const s = (1 - Math.cos(Math.PI * Math.min(1, t))) / 2;
    h[i] = a[1] + (b[1] - a[1]) * s;
  }
  for (const r of features?.ramps ?? []) {
    const lip = r.at * length;
    for (let i = 0; i < n; i++) {
      const back = fwd(dist[i]!, lip, length); // meters before the lip
      if (back <= r.length) h[i] = h[i]! + r.height * (1 - back / r.length) ** 1.4;
    }
  }
  for (const d of features?.dips ?? []) {
    const c = d.at * length;
    const half = d.length / 2;
    for (let i = 0; i < n; i++) {
      let off = fwd(c, dist[i]!, length);
      if (off > length / 2) off -= length;
      if (Math.abs(off) < half)
        h[i] = h[i]! - d.depth * (0.5 + 0.5 * Math.cos((Math.PI * off) / half));
    }
  }
  return h;
}

/**
 * Fast road height lookup for physics: nearest centerline sample via a uniform
 * grid, linearly interpolated along the segment. Valid anywhere inside the walls.
 */
export class TrackHeightField implements HeightField {
  private readonly cells = new Map<number, number[]>();

  constructor(
    private readonly px: Float32Array,
    private readonly pz: Float32Array,
    private readonly h: Float32Array,
    private readonly cell = 8,
  ) {
    for (let i = 0; i < px.length; i++) {
      const key = this.key(Math.floor(px[i]! / cell), Math.floor(pz[i]! / cell));
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    }
  }

  private key(cx: number, cz: number): number {
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  /** Nearest sample index (or -1 if none within ~2 cells). */
  nearest(x: number, z: number): number {
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    let best = -1;
    let bestD = Infinity;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const list = this.cells.get(this.key(cx + dx, cz + dz));
        if (!list) continue;
        for (const i of list) {
          const d = (this.px[i]! - x) ** 2 + (this.pz[i]! - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
    }
    return best;
  }

  heightAt(x: number, z: number): number {
    const n = this.px.length;
    const i = this.nearest(x, z);
    if (i < 0) return 0;
    const j = (i + 1) % n;
    const k = (i - 1 + n) % n;
    // project onto the neighbor on the side the point lies
    const ax = this.px[j]! - this.px[i]!;
    const az = this.pz[j]! - this.pz[i]!;
    const t = ((x - this.px[i]!) * ax + (z - this.pz[i]!) * az) / (ax * ax + az * az || 1);
    if (t >= 0) return this.h[i]! + (this.h[j]! - this.h[i]!) * Math.min(1, t);
    const bx = this.px[k]! - this.px[i]!;
    const bz = this.pz[k]! - this.pz[i]!;
    const u = ((x - this.px[i]!) * bx + (z - this.pz[i]!) * bz) / (bx * bx + bz * bz || 1);
    return this.h[i]! + (this.h[k]! - this.h[i]!) * Math.min(1, Math.max(0, u));
  }
}
