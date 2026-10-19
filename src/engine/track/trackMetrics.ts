import type { TrackData } from './TrackDefinition';

/**
 * Geometry sanity metrics for track design (used by tests and the dev
 * preview). Brute force; only for tooling, never at runtime.
 */
export interface TrackMetrics {
  /** Tightest centerline turn radius (m). */
  minRadius: number;
  /** Where it happens (sample index). */
  minRadiusAt: number;
  /** Closest approach between two parts of the track that are far apart along the loop (m). */
  minClearance: number;
  minClearanceAt: [number, number];
}

export function measureTrack(t: TrackData, span = 4): TrackMetrics {
  const n = t.sampleCount;
  let minRadius = Infinity;
  let minRadiusAt = 0;
  for (let i = 0; i < n; i++) {
    const a = (i - span + n) % n;
    const b = (i + span) % n;
    const r = circumradius(t.px[a]!, t.pz[a]!, t.px[i]!, t.pz[i]!, t.px[b]!, t.pz[b]!);
    if (r < minRadius) {
      minRadius = r;
      minRadiusAt = i;
    }
  }

  // Pairs further apart along the loop than this are "different parts" of the track.
  const along = Math.max(60, t.wallOffset * 6);
  let minClearance = Infinity;
  let at: [number, number] = [0, 0];
  for (let i = 0; i < n; i += 2) {
    for (let j = i + 2; j < n; j += 2) {
      const d1 = Math.abs(t.dist[j]! - t.dist[i]!);
      if (Math.min(d1, t.length - d1) < along) continue;
      const d = Math.hypot(t.px[i]! - t.px[j]!, t.pz[i]! - t.pz[j]!);
      if (d < minClearance) {
        minClearance = d;
        at = [i, j];
      }
    }
  }
  return { minRadius, minRadiusAt, minClearance, minClearanceAt: at };
}

function circumradius(ax: number, az: number, bx: number, bz: number, cx: number, cz: number) {
  const ab = Math.hypot(bx - ax, bz - az);
  const bc = Math.hypot(cx - bx, cz - bz);
  const ca = Math.hypot(ax - cx, az - cz);
  const area2 = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}
