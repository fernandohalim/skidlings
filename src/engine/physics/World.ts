import { circleVsSegment, createContact, type Contact } from './collision';

/**
 * Static wall segments in a uniform spatial grid. Built once per track;
 * queries are allocation-free.
 */
export class CollisionWorld {
  /** Flat segment data: [ax, az, bx, bz] per segment. */
  readonly segments: Float32Array;
  readonly segmentCount: number;

  private readonly cellSize: number;
  private readonly minX: number;
  private readonly minZ: number;
  private readonly cols: number;
  private readonly rows: number;
  /** cells[i] = segment indices overlapping that cell. */
  private readonly cells: Int32Array[];
  /** Per-query dedupe stamp, so a segment spanning several cells is tested once. */
  private readonly stamp: Uint32Array;
  private queryId = 0;

  constructor(segments: Float32Array, cellSize = 8) {
    this.segments = segments;
    this.segmentCount = segments.length / 4;
    this.cellSize = cellSize;
    this.stamp = new Uint32Array(this.segmentCount);

    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < segments.length; i += 2) {
      minX = Math.min(minX, segments[i]!);
      maxX = Math.max(maxX, segments[i]!);
      minZ = Math.min(minZ, segments[i + 1]!);
      maxZ = Math.max(maxZ, segments[i + 1]!);
    }
    if (!Number.isFinite(minX)) minX = minZ = maxX = maxZ = 0;
    this.minX = minX - cellSize;
    this.minZ = minZ - cellSize;
    this.cols = Math.ceil((maxX - this.minX) / cellSize) + 2;
    this.rows = Math.ceil((maxZ - this.minZ) / cellSize) + 2;

    const lists: number[][] = Array.from({ length: this.cols * this.rows }, () => []);
    for (let s = 0; s < this.segmentCount; s++) {
      const o = s * 4;
      const x0 = Math.min(segments[o]!, segments[o + 2]!);
      const x1 = Math.max(segments[o]!, segments[o + 2]!);
      const z0 = Math.min(segments[o + 1]!, segments[o + 3]!);
      const z1 = Math.max(segments[o + 1]!, segments[o + 3]!);
      for (let cz = this.cellZ(z0); cz <= this.cellZ(z1); cz++) {
        for (let cx = this.cellX(x0); cx <= this.cellX(x1); cx++) {
          lists[cz * this.cols + cx]!.push(s);
        }
      }
    }
    this.cells = lists.map((l) => Int32Array.from(l));
  }

  private cellX(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.minX) / this.cellSize)));
  }

  private cellZ(z: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.minZ) / this.cellSize)));
  }

  private readonly tmp: Contact = createContact();

  /**
   * Pushes a circle out of every overlapping wall. Calls `onContact` with the
   * resolved normal for each hit (so the caller can adjust velocity).
   * Returns the total push applied via `out` (x, z) and the hit count.
   */
  resolveCircle(
    x: number,
    z: number,
    r: number,
    out: { x: number; z: number; hits: number; nx: number; nz: number },
  ): void {
    out.x = x;
    out.z = z;
    out.hits = 0;
    out.nx = 0;
    out.nz = 0;
    this.queryId = (this.queryId + 1) >>> 0;
    if (this.queryId === 0) {
      this.stamp.fill(0);
      this.queryId = 1;
    }
    const cx0 = this.cellX(x - r);
    const cx1 = this.cellX(x + r);
    const cz0 = this.cellZ(z - r);
    const cz1 = this.cellZ(z + r);
    const seg = this.segments;
    const c = this.tmp;
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const list = this.cells[cz * this.cols + cx]!;
        for (let k = 0; k < list.length; k++) {
          const s = list[k]!;
          if (this.stamp[s] === this.queryId) continue;
          this.stamp[s] = this.queryId;
          const o = s * 4;
          if (circleVsSegment(out.x, out.z, r, seg[o]!, seg[o + 1]!, seg[o + 2]!, seg[o + 3]!, c)) {
            out.x += c.nx * c.depth;
            out.z += c.nz * c.depth;
            out.nx += c.nx;
            out.nz += c.nz;
            out.hits++;
          }
        }
      }
    }
    if (out.hits > 0) {
      const l = Math.hypot(out.nx, out.nz) || 1;
      out.nx /= l;
      out.nz /= l;
    }
  }
}

/** An empty world (open playground: no walls). */
export const EMPTY_WORLD = new CollisionWorld(new Float32Array(0));
