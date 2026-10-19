import { Color } from 'three';
import { fbm, smoothstep } from '../utils/noise';
import type { TerrainSpec, TrackTheme } from './TrackDefinition';

/** Ground height + water info around a track (2.5D world). */
export interface TerrainSampler {
  heightAt(x: number, z: number): number;
  /** Water surface heights to render (sea and/or river), null if none. */
  seaLevel: number | null;
  riverLevel: number | null;
  /** True where the point is under water (no props there). */
  isWater(x: number, z: number): boolean;
}

interface Centerline {
  n: number;
  px: Float32Array;
  pz: Float32Array;
  h: Float32Array;
  wallOffset: number;
  roadWidth: number;
}

function distToPolyline(pts: [number, number][], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]!;
    const [bx, bz] = pts[i + 1]!;
    const abx = bx - ax;
    const abz = bz - az;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz || 1)),
    );
    const d = Math.hypot(ax + abx * t - x, az + abz * t - z);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Ground = road height near the road, blending (over `blendWidth`) into themed
 * base terrain: noise hills, far peaks/mesas, a sea beyond a coastline (the
 * steep blend makes cliffs) and a carved river (the road crosses it on a bridge).
 */
export function createTerrain(spec: TerrainSpec, c: Centerline, seed: number): TerrainSampler {
  const inner = c.wallOffset + 1.5;
  const outer = inner + spec.blendWidth;

  const nearest = (x: number, z: number): [number, number] => {
    let best = Infinity;
    let bi = 0;
    for (let i = 0; i < c.n; i += 2) {
      const d = (c.px[i]! - x) ** 2 + (c.pz[i]! - z) ** 2;
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    return [Math.sqrt(best), bi];
  };

  const baseAt = (x: number, z: number, roadDist: number): number => {
    let b =
      spec.baseHeight +
      (fbm(x / spec.hillScale, z / spec.hillScale, 4, seed) - 0.5) * 2 * spec.hillAmplitude;
    if (spec.peaks) {
      const p = spec.peaks;
      const n = fbm(x / p.scale, z / p.scale, 3, seed + 11);
      b +=
        smoothstep(p.minDistance, p.minDistance + 40, roadDist) *
        Math.max(0, n - 0.45) *
        2 *
        p.amplitude;
    }
    if (spec.coast) {
      const s = x * spec.coast.nx + z * spec.coast.nz - spec.coast.d;
      b += (spec.coast.seaLevel - 4 - b) * smoothstep(-4, 10, s);
    }
    return b;
  };

  const heightAt = (x: number, z: number): number => {
    const [d, i] = nearest(x, z);
    const roadH = c.h[i]! - 0.08;
    const t = smoothstep(inner, outer, d);
    let y = roadH + (baseAt(x, z, d) - roadH) * t;
    if (spec.coast) {
      // The sea always wins far from the road: cliffs drop straight into it.
      const s = x * spec.coast.nx + z * spec.coast.nz - spec.coast.d;
      if (s > 0 && d > inner)
        y = Math.min(
          y,
          roadH + (spec.coast.seaLevel - 4 - roadH) * smoothstep(inner, inner + 6, d),
        );
    }
    if (spec.river) {
      const r = spec.river;
      const dr = distToPolyline(r.points, x, z);
      const bed = r.level - 2.2;
      y = Math.min(y, bed + (y - bed) * smoothstep(r.width * 0.5, r.width * 1.4, dr));
    }
    return y;
  };

  const isWater = (x: number, z: number): boolean => {
    const y = heightAt(x, z);
    if (spec.coast && y < spec.coast.seaLevel + 0.3) return true;
    if (spec.river && y < spec.river.level + 0.3) return true;
    return false;
  };

  return {
    heightAt,
    seaLevel: spec.coast?.seaLevel ?? null,
    riverLevel: spec.river?.level ?? null,
    isWater,
  };
}

export interface TerrainMesh {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

/**
 * Heightfield grid over `bounds` (+ padding) with vertex colors from height and
 * slope: grass tones, rock on steep faces, sand by the water, canyon strata.
 */
export function buildTerrainMesh(
  sampler: TerrainSampler,
  theme: TrackTheme,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  pad: number,
  cell: number,
  seed: number,
): TerrainMesh {
  const x0 = bounds.minX - pad;
  const z0 = bounds.minZ - pad;
  const nx = Math.ceil((bounds.maxX - bounds.minX + pad * 2) / cell) + 1;
  const nz = Math.ceil((bounds.maxZ - bounds.minZ + pad * 2) / cell) + 1;
  const count = nx * nz;
  const positions = new Float32Array(count * 3);
  const hs = new Float32Array(count);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = x0 + i * cell;
      const z = z0 + j * cell;
      const y = sampler.heightAt(x, z);
      hs[k] = y;
      positions.set([x, y, z], k * 3);
    }
  }
  // Normals from central differences.
  const normals = new Float32Array(count * 3);
  const H = (i: number, j: number) =>
    hs[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]!;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const dx = (H(i + 1, j) - H(i - 1, j)) / (2 * cell);
      const dz = (H(i, j + 1) - H(i, j - 1)) / (2 * cell);
      const l = Math.hypot(dx, 1, dz);
      normals.set([-dx / l, 1 / l, -dz / l], (j * nx + i) * 3);
    }
  }
  // Colors.
  const colors = new Float32Array(count * 3);
  const cA = new Color(theme.ground);
  const cB = new Color(theme.groundB);
  const cRock = new Color(theme.rock);
  const cSand = new Color(theme.sand);
  const tmp = new Color();
  const water = Math.max(sampler.seaLevel ?? -Infinity, sampler.riverLevel ?? -Infinity);
  for (let k = 0; k < count; k++) {
    const x = positions[k * 3]!;
    const y = positions[k * 3 + 1]!;
    const z = positions[k * 3 + 2]!;
    const up = normals[k * 3 + 1]!;
    tmp.copy(cA).lerp(cB, smoothstep(0.35, 0.65, fbm(x / 22, z / 22, 3, seed + 5)));
    if (theme.kind === 'canyon') {
      // layered sandstone strata on anything raised
      const band = Math.floor(y / 2.2) % 2 === 0 ? cRock : cB;
      tmp.lerp(band, smoothstep(1.5, 3.5, y));
    }
    tmp.lerp(cRock, smoothstep(0.86, 0.7, up));
    if (Number.isFinite(water)) tmp.lerp(cSand, smoothstep(water + 1.6, water + 0.4, y));
    colors.set([tmp.r, tmp.g, tmp.b], k * 3);
  }
  const indices = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let o = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      // +Y facing: (a, c, b) and (b, c, d) with z increasing along j
      indices.set([a, c, b, b, c, d], o);
      o += 6;
    }
  }
  return { positions, normals, colors, indices };
}
