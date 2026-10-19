import { CatmullRomCurve3, Color, Vector3 } from 'three';
import { TRACK_CONFIG } from '../../config/track.config';
import { buildRoadHeights, TrackHeightField } from './heights';
import { buildScenery } from './scenery';
import { createTerrain } from './terrain';
import type {
  Checkpoint,
  GridSlot,
  RibbonGeometry,
  RoadPatch,
  TrackData,
  TrackDefinition,
  WallBlock,
} from './TrackDefinition';

type TrackConfig = typeof TRACK_CONFIG;

/**
 * Builds all track data from a definition (§8.2). Pure + deterministic.
 * Conventions: forward t = (tx, tz); right r = (-tz, tx) (matches the car).
 */
export function buildTrack(def: TrackDefinition, cfg: TrackConfig = TRACK_CONFIG): TrackData {
  // 1–2. Closed Catmull-Rom → evenly spaced samples
  const curve = new CatmullRomCurve3(
    def.controlPoints.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    'centripetal',
  );
  const length = curve.getLength();
  const n = Math.max(16, Math.round(length / cfg.sampleSpacing));
  const pts = curve.getSpacedPoints(n); // n + 1 points, last == first
  let px: Float32Array<ArrayBuffer> = new Float32Array(n);
  let pz: Float32Array<ArrayBuffer> = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = pts[i]!.x;
    pz[i] = pts[i]!.z;
  }

  // Rotate so sample 0 sits at the start control point.
  const [sx, sz] = def.controlPoints[def.startIndex] ?? def.controlPoints[0]!;
  let start = 0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const d = (px[i]! - sx) ** 2 + (pz[i]! - sz) ** 2;
    if (d < best) {
      best = d;
      start = i;
    }
  }
  px = rotate(px, start);
  pz = rotate(pz, start);

  const tx = new Float32Array(n);
  const tz = new Float32Array(n);
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n;
    const b = (i + 1) % n;
    const dx = px[b]! - px[a]!;
    const dz = pz[b]! - pz[a]!;
    const l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l;
    tz[i] = dz / l;
    if (i > 0) dist[i] = dist[i - 1]! + Math.hypot(px[i]! - px[i - 1]!, pz[i]! - pz[i - 1]!);
  }
  const half = def.roadWidth / 2;
  const loopLength = dist[n - 1]! + Math.hypot(px[0]! - px[n - 1]!, pz[0]! - pz[n - 1]!);

  // 2b. Road heights (2.5D): elevation keypoints, kicker ramps, dips.
  const h = buildRoadHeights(def.features, dist, loopLength);

  // 3. Road ribbon
  const road = ribbon(
    n,
    (i, side) => offsetPoint(px, pz, tx, tz, i, side ? half : -half),
    (i) => h[i]! + 0.02,
  );

  // 4. Curbs: unique verts per quad so stripes stay crisp
  const curbs = buildCurbs(def, cfg, n, px, pz, tx, tz, dist, half, h);

  // 5. Walls
  const wallOffset = half + cfg.curbWidth + cfg.wallGap;
  const { segments, blocks } = buildWalls(cfg, n, px, pz, tx, tz, wallOffset, h);

  // 5b. Ramps (lip areas) and boost pads as road patches.
  const patchAt = (fraction: number, length: number): RoadPatch => {
    const d = (((fraction % 1) + 1) % 1) * loopLength;
    let i = 0;
    while (i < n - 1 && dist[i]! < d) i++;
    return {
      sample: i,
      x: px[i]!,
      z: pz[i]!,
      y: h[i]!,
      heading: Math.atan2(tx[i]!, tz[i]!),
      length,
      width: def.roadWidth,
    };
  };
  const ramps = (def.features?.ramps ?? []).map((r) => {
    // patch centered on the ramp's slope, ending at the lip
    const mid = r.at - r.length / 2 / loopLength;
    const p = patchAt(mid, r.length);
    return { ...p, y: h[patchAt(r.at, 0).sample]! };
  });
  const boostPads = (def.features?.boostPads ?? []).map((f) => patchAt(f, 6));

  // 6. Checkpoints, 0 = start/finish
  const checkpoints: Checkpoint[] = [];
  for (let k = 0; k < def.checkpointCount; k++) {
    const s = Math.round((k * n) / def.checkpointCount) % n;
    checkpoints.push({
      index: k,
      sample: s,
      x: px[s]!,
      z: pz[s]!,
      tx: tx[s]!,
      tz: tz[s]!,
      halfWidth: wallOffset,
    });
  }

  // 7. Start grid: staggered 2-wide rows behind the line
  const startGrid: GridSlot[] = [];
  for (let k = 0; k < 4; k++) {
    const back = cfg.gridFirstRow + Math.floor(k / 2) * cfg.gridRowSpacing;
    const s = (n - Math.round(back / cfg.sampleSpacing)) % n;
    const lateral = (k % 2 === 0 ? -1 : 1) * cfg.gridLateral;
    const [x, z] = offsetPoint(px, pz, tx, tz, s, lateral);
    startGrid.push({ x, z, heading: Math.atan2(tx[s]!, tz[s]!) });
  }

  // Bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, px[i]!);
    maxX = Math.max(maxX, px[i]!);
    minZ = Math.min(minZ, pz[i]!);
    maxZ = Math.max(maxZ, pz[i]!);
  }
  const bounds = {
    minX: minX - wallOffset,
    maxX: maxX + wallOffset,
    minZ: minZ - wallOffset,
    maxZ: maxZ + wallOffset,
  };

  // 8. Terrain (2.5D ground, sea, river) + decorations/scenery kept out of the water.
  const heightField = new TrackHeightField(px, pz, h);
  const terrain = createTerrain(
    def.terrain,
    { n, px, pz, h, wallOffset, roadWidth: def.roadWidth },
    def.decorationSeed,
  );
  const built = buildScenery(
    def,
    cfg,
    { n, px, pz, tx, tz, dist, wallOffset, bounds },
    cfg.bumperThickness,
  );
  const dry = (p: { x: number; z: number }) => !terrain.isWater(p.x, p.z);
  const decorations = built.decorations.filter(dry);
  const scenery = {
    ...built.scenery,
    patches: built.scenery.patches.filter(dry),
    mounds: built.scenery.mounds.filter(dry),
    tireStacks: built.scenery.tireStacks.filter(dry),
    flags: built.scenery.flags.filter(dry),
  };

  return {
    def,
    length: loopLength,
    h,
    ramps,
    boostPads,
    heightField,
    terrain,
    sampleCount: n,
    px,
    pz,
    tx,
    tz,
    dist,
    road,
    curbs,
    wallSegments: segments,
    wallBlocks: blocks,
    wallOffset,
    checkpoints,
    startGrid,
    decorations,
    scenery,
    bounds,
  };
}

function rotate(a: Float32Array, by: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[(i + by) % a.length]!;
  return out;
}

/** Point offset sideways from sample i along r = (-tz, tx). */
function offsetPoint(
  px: Float32Array,
  pz: Float32Array,
  tx: Float32Array,
  tz: Float32Array,
  i: number,
  off: number,
): [number, number] {
  return [px[i]! - tz[i]! * off, pz[i]! + tx[i]! * off];
}

/**
 * Closed strip with two verts per sample. `edge(i, false)` must be the
 * -r side (left), `edge(i, true)` the +r side, so triangles face +Y.
 */
function ribbon(
  n: number,
  edge: (i: number, plusR: boolean) => [number, number],
  yOf: (i: number) => number,
): RibbonGeometry {
  const positions = new Float32Array(n * 2 * 3);
  const normals = new Float32Array(n * 2 * 3);
  const indices = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const [ax, az] = edge(i, false);
    const [bx, bz] = edge(i, true);
    const y = yOf(i);
    positions.set([ax, y, az, bx, y, bz], i * 6);
    normals.set([0, 1, 0, 0, 1, 0], i * 6);
    const a0 = i * 2;
    const b0 = a0 + 1;
    const a1 = ((i + 1) % n) * 2;
    const b1 = a1 + 1;
    indices.set([a0, b0, a1, b0, b1, a1], i * 6);
  }
  return { positions, normals, indices };
}

function buildCurbs(
  def: TrackDefinition,
  cfg: TrackConfig,
  n: number,
  px: Float32Array,
  pz: Float32Array,
  tx: Float32Array,
  tz: Float32Array,
  dist: Float32Array,
  half: number,
  h: Float32Array,
): RibbonGeometry {
  const quads = n * 2;
  const positions = new Float32Array(quads * 4 * 3);
  const normals = new Float32Array(quads * 4 * 3);
  const colors = new Float32Array(quads * 4 * 3);
  const indices = new Uint32Array(quads * 6);
  const ca = new Color(def.theme.curbA);
  const cb = new Color(def.theme.curbB);
  let q = 0;
  for (let side = 0; side < 2; side++) {
    // [inner-from-left, outer] offsets ordered so 'a' is always the -r side.
    const a = side === 0 ? -half - cfg.curbWidth : half;
    const b = side === 0 ? -half : half + cfg.curbWidth;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const [a0x, a0z] = offsetPoint(px, pz, tx, tz, i, a);
      const [b0x, b0z] = offsetPoint(px, pz, tx, tz, i, b);
      const [a1x, a1z] = offsetPoint(px, pz, tx, tz, j, a);
      const [b1x, b1z] = offsetPoint(px, pz, tx, tz, j, b);
      const v = q * 4;
      const y0 = h[i]! + 0.04;
      const y1 = h[j]! + 0.04;
      positions.set([a0x, y0, a0z, b0x, y0, b0z, a1x, y1, a1z, b1x, y1, b1z], v * 3);
      normals.set([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], v * 3);
      const c = Math.floor(dist[i]! / cfg.curbStripeLength) % 2 === 0 ? ca : cb;
      for (let k = 0; k < 4; k++) colors.set([c.r, c.g, c.b], (v + k) * 3);
      indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], q * 6);
      q++;
    }
  }
  return { positions, normals, indices, colors };
}

function buildWalls(
  cfg: TrackConfig,
  n: number,
  px: Float32Array,
  pz: Float32Array,
  tx: Float32Array,
  tz: Float32Array,
  offset: number,
  h: Float32Array,
): { segments: Float32Array; blocks: WallBlock[] } {
  const stride = Math.max(1, cfg.wallStride);
  const count = Math.floor(n / stride);
  const segments = new Float32Array(count * 2 * 4);
  const blocks: WallBlock[] = [];
  let s = 0;
  for (const side of [-1, 1]) {
    for (let k = 0; k < count; k++) {
      const i = k * stride;
      const j = ((k + 1) % count) * stride;
      const [ax, az] = offsetPoint(px, pz, tx, tz, i, side * offset);
      const [bx, bz] = offsetPoint(px, pz, tx, tz, j, side * offset);
      segments.set([ax, az, bx, bz], s * 4);
      s++;
      // Visual bumper sits just outside the collision line.
      const ox = -tz[i]! * side * (cfg.bumperThickness / 2);
      const oz = tx[i]! * side * (cfg.bumperThickness / 2);
      blocks.push({
        x: (ax + bx) / 2 + ox,
        z: (az + bz) / 2 + oz,
        y: (h[i]! + h[j]!) / 2,
        length: Math.hypot(bx - ax, bz - az) + 0.15,
        rotation: Math.atan2(bx - ax, bz - az),
        color: (Math.floor(k / 2) % 2) as 0 | 1,
      });
    }
  }
  return { segments, blocks };
}

/** Index of the centerline sample nearest to (x, z). Brute force; fine for tests/tools. */
export function nearestSample(track: TrackData, x: number, z: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < track.sampleCount; i++) {
    const d = (track.px[i]! - x) ** 2 + (track.pz[i]! - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
