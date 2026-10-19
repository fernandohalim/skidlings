import type { Checkpoint } from '../track/TrackDefinition';

/**
 * True if the move (ax,az) → (bx,bz) crosses the checkpoint gate in the race
 * direction. The gate is the line through the checkpoint, perpendicular to the
 * track tangent, `halfWidth` wide on each side.
 */
export function crossesGate(
  cp: Checkpoint,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  const da = (ax - cp.x) * cp.tx + (az - cp.z) * cp.tz;
  const db = (bx - cp.x) * cp.tx + (bz - cp.z) * cp.tz;
  if (!(da < 0 && db >= 0)) return false;
  // Lateral offset at the crossing point.
  const t = da / (da - db);
  const cx = ax + (bx - ax) * t - cp.x;
  const cz = az + (bz - az) * t - cp.z;
  const lateral = -cx * cp.tz + cz * cp.tx;
  return Math.abs(lateral) <= cp.halfWidth;
}

/** Formats seconds as m:ss.mmm (§9.3). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-:--.---';
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}
