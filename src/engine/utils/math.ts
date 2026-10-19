// Small allocation-free math helpers shared by the engine.

export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential smoothing: lerp(a, b, 1 - exp(-k * dt)). */
export function damp(a: number, b: number, k: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-k * dt));
}

/** Wraps an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Moves `current` toward `target` by at most `maxDelta`. */
export function moveTowards(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
