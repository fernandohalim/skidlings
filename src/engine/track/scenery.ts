import type { TRACK_CONFIG } from '../../config/track.config';
import { createRng } from '../utils/random';
import type {
  Decoration,
  DecorationKind,
  EdgeProp,
  GroundPatch,
  Grandstand,
  Mound,
  TrackDefinition,
  TrackScenery,
} from './TrackDefinition';

type TrackConfig = typeof TRACK_CONFIG;

interface Centerline {
  n: number;
  px: Float32Array;
  pz: Float32Array;
  tx: Float32Array;
  tz: Float32Array;
  dist: Float32Array;
  wallOffset: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** Squared distance from (x, z) to the nearest centerline sample (every 2nd sample). */
function nearestD2(c: Centerline, x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < c.n; i += 2) {
    const d = (c.px[i]! - x) ** 2 + (c.pz[i]! - z) ** 2;
    if (d < best) best = d;
  }
  return best;
}

/** Point offset sideways from sample i along r = (-tz, tx). */
function offset(c: Centerline, i: number, off: number): [number, number] {
  return [c.px[i]! - c.tz[i]! * off, c.pz[i]! + c.tx[i]! * off];
}

/** Signed turn toward +r over ±k samples (positive = turning toward +r). */
function turnSide(c: Centerline, i: number, k = 6): number {
  const a = (i - k + c.n) % c.n;
  const b = (i + k) % c.n;
  const dtx = c.tx[b]! - c.tx[a]!;
  const dtz = c.tz[b]! - c.tz[a]!;
  return dtx * -c.tz[i]! + dtz * c.tx[i]!;
}

function localRadius(c: Centerline, i: number, k = 6): number {
  const a = (i - k + c.n) % c.n;
  const b = (i + k) % c.n;
  const ax = c.px[a]!;
  const az = c.pz[a]!;
  const bx = c.px[i]!;
  const bz = c.pz[i]!;
  const cx = c.px[b]!;
  const cz = c.pz[b]!;
  const ab = Math.hypot(bx - ax, bz - az);
  const bc = Math.hypot(cx - bx, cz - bz);
  const ca = Math.hypot(ax - cx, az - cz);
  const area2 = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}

/**
 * Deterministic scenery around a built centerline: small decorations, ground
 * patches, mounds, tire stacks on corner exits, flag posts and the grandstand.
 */
export function buildScenery(
  def: TrackDefinition,
  cfg: TrackConfig,
  c: Centerline,
  bumperThickness: number,
): { decorations: Decoration[]; scenery: TrackScenery } {
  const rng = createRng(def.decorationSeed);
  const wallOut = c.wallOffset + bumperThickness;

  // --- grandstand beside the start straight, on the outside of the loop
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < c.n; i++) {
    cx += c.px[i]!;
    cz += c.pz[i]!;
  }
  cx /= c.n;
  cz /= c.n;
  const standSample = (c.n - Math.round(cfg.grandstandLength * 0.35)) % c.n;
  const standOff = wallOut + 2 + cfg.grandstandDepth / 2;
  const [ax, az] = offset(c, standSample, standOff);
  const [bx, bz] = offset(c, standSample, -standOff);
  const plusSide = (ax - cx) ** 2 + (az - cz) ** 2 > (bx - cx) ** 2 + (bz - cz) ** 2;
  const side = plusSide ? 1 : -1;
  const [gx, gz] = plusSide ? [ax, az] : [bx, bz];
  // Stand faces the track: its local +Z points back toward the road (−side·r).
  const faceX = c.tz[standSample]! * side;
  const faceZ = -c.tx[standSample]! * side;
  const grandstand: Grandstand = {
    x: gx,
    z: gz,
    rotation: Math.atan2(faceX, faceZ),
    length: cfg.grandstandLength,
  };
  const standClear2 = (cfg.grandstandLength * 0.7) ** 2;
  const nearStand = (x: number, z: number) => (x - gx) ** 2 + (z - gz) ** 2 < standClear2;

  // --- small decorations
  const weights = cfg.decorationWeights[def.theme.kind] ?? { tree: 1 };
  const kinds = Object.keys(weights) as DecorationKind[];
  const totalW = kinds.reduce((a, k) => a + (weights[k] ?? 0), 0);
  const pickKind = (): DecorationKind => {
    let r = rng() * totalW;
    for (const k of kinds) {
      r -= weights[k] ?? 0;
      if (r <= 0) return k;
    }
    return kinds[0] ?? 'tree';
  };
  const decorations: Decoration[] = [];
  const minDist = c.wallOffset + cfg.decorationClearance;
  const pad = cfg.decorationPadding;
  const b = c.bounds;
  const randomPoint = (): [number, number] => [
    b.minX - pad + rng() * (b.maxX - b.minX + pad * 2),
    b.minZ - pad + rng() * (b.maxZ - b.minZ + pad * 2),
  ];
  for (
    let tries = 0;
    decorations.length < cfg.decorationCount && tries < cfg.decorationCount * 30;
    tries++
  ) {
    const [x, z] = randomPoint();
    if (nearStand(x, z) || nearestD2(c, x, z) < minDist * minDist) continue;
    const kind = pickKind();
    const big = kind === 'tree' || kind === 'pine' || kind === 'palm';
    decorations.push({
      kind,
      x,
      z,
      scale: big ? 0.7 + rng() * 0.9 : 0.8 + rng() * 0.6,
      rotation: rng() * Math.PI * 2,
      variant: Math.floor(rng() * 4),
    });
  }

  // --- grass tufts close-ish to the road (cheap detail that reads at speed)
  for (let k = 0, tries = 0; k < cfg.tuftCount && tries < cfg.tuftCount * 10; tries++) {
    const i = Math.floor(rng() * c.n);
    const side = rng() < 0.5 ? -1 : 1;
    const off = c.wallOffset + 1.5 + rng() * cfg.tuftMaxDistance;
    const [x, z] = offset(c, i, side * off);
    if (nearStand(x, z) || nearestD2(c, x, z) < (c.wallOffset + 1.2) ** 2) continue;
    decorations.push({
      kind: 'tuft',
      x,
      z,
      scale: 0.6 + rng() * 0.7,
      rotation: rng() * 6.28,
      variant: 0,
    });
    k++;
  }

  // --- mounds (big, far from the road)
  const mounds: Mound[] = [];
  for (let tries = 0; mounds.length < cfg.moundCount && tries < cfg.moundCount * 40; tries++) {
    const [x, z] = randomPoint();
    const radius = 10 + rng() * 14;
    const clear = c.wallOffset + cfg.moundClearance + radius;
    if (nearStand(x, z) || nearestD2(c, x, z) < clear * clear) continue;
    mounds.push({ x, z, radius, height: radius * (0.25 + rng() * 0.2) });
  }

  // --- ground patches (anywhere off the road surface)
  const patches: GroundPatch[] = [];
  const roadClear = def.roadWidth / 2 + 2;
  for (
    let tries = 0;
    patches.length < cfg.groundPatchCount && tries < cfg.groundPatchCount * 20;
    tries++
  ) {
    const [x, z] = randomPoint();
    if (nearestD2(c, x, z) < roadClear * roadClear) continue;
    const s = 3 + rng() * 7;
    patches.push({ x, z, sx: s, sz: s * (0.5 + rng() * 0.7), rotation: rng() * Math.PI });
  }

  // --- tire stacks on the outside of tighter corners
  const tireStacks: EdgeProp[] = [];
  let lastTire = -Infinity;
  for (let i = 0; i < c.n; i++) {
    if (c.dist[i]! - lastTire < cfg.tireSpacing) continue;
    if (localRadius(c, i) > cfg.tireCornerRadius) continue;
    const outer = turnSide(c, i) > 0 ? -1 : 1;
    const [x, z] = offset(c, i, outer * (wallOut + 1.3));
    if (nearStand(x, z)) continue;
    tireStacks.push({ x, z, rotation: rng() * Math.PI, variant: Math.floor(rng() * 3) });
    lastTire = c.dist[i]!;
  }

  // --- flag posts along the track, alternating sides
  const flags: EdgeProp[] = [];
  let k = 0;
  for (let d = cfg.flagSpacing / 2; d < c.dist[c.n - 1]!; d += cfg.flagSpacing, k++) {
    let i = 0;
    while (i < c.n - 1 && c.dist[i]! < d) i++;
    const s = k % 2 === 0 ? 1 : -1;
    const [x, z] = offset(c, i, s * (wallOut + 2.6));
    if (nearStand(x, z)) continue;
    flags.push({ x, z, rotation: Math.atan2(c.tx[i]!, c.tz[i]!), variant: k % 4 });
  }

  return { decorations, scenery: { patches, mounds, tireStacks, flags, grandstand } };
}
