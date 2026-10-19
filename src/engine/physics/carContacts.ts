import type { CarState } from '../car/types';

/**
 * Soft bumper-car contact between two cars, each modelled as two circles along
 * its heading. Pushes them apart equally and exchanges a little of the closing
 * velocity. Returns the closing speed of the hardest contact (0 = none).
 */
export function resolveCarPair(
  a: CarState,
  b: CarState,
  radius: number,
  offset: number,
  restitution: number,
): number {
  const afx = Math.sin(a.heading);
  const afz = Math.cos(a.heading);
  const bfx = Math.sin(b.heading);
  const bfz = Math.cos(b.heading);
  const reach = radius * 2;
  // quick reject: centers far apart
  const dcx = a.x - b.x;
  const dcz = a.z - b.z;
  const far = reach + offset * 2;
  if (dcx * dcx + dcz * dcz > far * far) return 0;

  let impact = 0;
  for (let i = -1; i <= 1; i += 2) {
    for (let j = -1; j <= 1; j += 2) {
      const ax = a.x + afx * offset * i;
      const az = a.z + afz * offset * i;
      const bx = b.x + bfx * offset * j;
      const bz = b.z + bfz * offset * j;
      const dx = ax - bx;
      const dz = az - bz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= reach * reach) continue;
      const d = Math.sqrt(d2) || 1e-4;
      const nx = dx / d;
      const nz = dz / d;
      const push = (reach - d) / 2;
      a.x += nx * push;
      a.z += nz * push;
      b.x -= nx * push;
      b.z -= nz * push;
      const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (vn < 0) {
        const jImp = (-(1 + restitution) * vn) / 2;
        a.vx += nx * jImp;
        a.vz += nz * jImp;
        b.vx -= nx * jImp;
        b.vz -= nz * jImp;
        impact = Math.max(impact, -vn);
      }
    }
  }
  if (impact > 0) {
    refreshLocal(a);
    refreshLocal(b);
  }
  return impact;
}

function refreshLocal(c: CarState): void {
  const hx = Math.sin(c.heading);
  const hz = Math.cos(c.heading);
  c.speedForward = c.vx * hx + c.vz * hz;
  c.speedLateral = c.vx * -hz + c.vz * hx;
}
