/** Result slot reused by collision queries (allocation-free hot path). */
export interface Contact {
  /** Unit normal pointing out of the wall toward the circle. */
  nx: number;
  nz: number;
  /** Penetration depth (>0 when overlapping). */
  depth: number;
}

export function createContact(): Contact {
  return { nx: 0, nz: 0, depth: 0 };
}

/**
 * Circle vs line segment. Writes into `out` and returns true on overlap.
 * Segment endpoints (ax,az)-(bx,bz).
 */
export function circleVsSegment(
  cx: number,
  cz: number,
  r: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  out: Contact,
): boolean {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((cx - ax) * abx + (cz - az) * abz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + abx * t;
  const pz = az + abz * t;
  const dx = cx - px;
  const dz = cz - pz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  const d = Math.sqrt(d2);
  if (d > 1e-6) {
    out.nx = dx / d;
    out.nz = dz / d;
  } else {
    // Center exactly on the segment: use the segment's left normal.
    const l = Math.sqrt(len2) || 1;
    out.nx = -abz / l;
    out.nz = abx / l;
  }
  out.depth = r - d;
  return true;
}

/** Circle vs circle. Normal points from B toward A. */
export function circleVsCircle(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
  out: Contact,
): boolean {
  const dx = ax - bx;
  const dz = az - bz;
  const r = ar + br;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  const d = Math.sqrt(d2);
  if (d > 1e-6) {
    out.nx = dx / d;
    out.nz = dz / d;
  } else {
    out.nx = 1;
    out.nz = 0;
  }
  out.depth = r - d;
  return true;
}
