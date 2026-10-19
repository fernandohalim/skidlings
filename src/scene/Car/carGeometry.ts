import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarId } from '../../config/car.config';
import { TOON_CONFIG } from '../../config/graphics.config';

// Builds each toy car as a few merged, vertex-colored meshes instead of ~20
// separate ones (§13 draw-call budget): one outlined "shell", one detail mesh
// (glass, stripes, lights) and one wheel mesh per side. Cached and shared by
// every car with the same model + paint.

const INK = TOON_CONFIG.outlineColor;
const WHITE = '#FFFFFF';
const WHEEL = '#3A3350';
const GLASS = '#BFE9FF';
const HEADLIGHT = '#FFF4C2';
const TAILLIGHT = '#FF4D6D';
const PAINT = 'paint';

export const WHEEL_RADIUS = 0.52;
export const WHEEL_WIDTH = 0.46;

interface Part {
  geo: BufferGeometry;
  pos: [number, number, number];
  rotX?: number;
  rotZ?: number;
  /** Hex color or 'paint'. */
  color: string;
}

const rbox = (w: number, h: number, d: number, r: number, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, r);
const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);

const cyl = (r: number, h: number, seg = 12) => new CylinderGeometry(r, r, h, seg);
const BUMPER = '#3A3350';
const CHROME = '#D5DAE4';

interface Body {
  halfW: number;
  bodyY: number;
  bodyH: number;
  frontZ: number;
  rearZ: number;
  cabinHalfW: number;
  cabinY: number;
  cabinFrontZ: number;
  lightY: number;
  lightSpread: number;
}

/** Shared trim every car gets: bumpers, grille, round lights, skirts, roundels, mirrors, exhausts. */
function trim(b: Body): Part[] {
  const low = b.bodyY - b.bodyH / 2;
  const parts: Part[] = [
    // bumpers + grille
    {
      geo: rbox(b.halfW * 2 + 0.06, 0.24, 0.34, 0.1, 2),
      pos: [0, low + 0.14, b.frontZ + 0.02],
      color: BUMPER,
    },
    {
      geo: rbox(b.halfW * 2 + 0.06, 0.24, 0.34, 0.1, 2),
      pos: [0, low + 0.14, b.rearZ - 0.02],
      color: BUMPER,
    },
    { geo: box(0.9, 0.14, 0.05), pos: [0, b.lightY, b.frontZ + 0.01], color: INK },
  ];
  for (const s of [-1, 1]) {
    parts.push(
      // round headlights with a white rim, chunky taillights
      {
        geo: cyl(0.2, 0.05, 14),
        pos: [s * b.lightSpread, b.lightY, b.frontZ + 0.03],
        rotX: Math.PI / 2,
        color: WHITE,
      },
      {
        geo: cyl(0.15, 0.06, 14),
        pos: [s * b.lightSpread, b.lightY, b.frontZ + 0.05],
        rotX: Math.PI / 2,
        color: HEADLIGHT,
      },
      {
        geo: box(0.42, 0.17, 0.06),
        pos: [s * b.lightSpread, b.lightY, b.rearZ - 0.01],
        color: TAILLIGHT,
      },
      // side skirts
      {
        geo: box(0.07, 0.12, Math.abs(b.frontZ - b.rearZ) * 0.55),
        pos: [s * (b.halfW + 0.02), low + 0.1, 0],
        color: BUMPER,
      },
      // racing roundel on each door (white disc, ink dot)
      {
        geo: cyl(0.34, 0.03, 18),
        pos: [s * (b.halfW + 0.02), b.bodyY + 0.02, 0.15],
        rotZ: Math.PI / 2,
        color: WHITE,
      },
      {
        geo: cyl(0.14, 0.04, 12),
        pos: [s * (b.halfW + 0.03), b.bodyY + 0.02, 0.15],
        rotZ: Math.PI / 2,
        color: INK,
      },
      // mirrors
      {
        geo: rbox(0.24, 0.13, 0.14, 0.05, 2),
        pos: [s * (b.cabinHalfW + 0.14), b.cabinY - 0.05, b.cabinFrontZ],
        color: PAINT,
      },
      // exhaust pipes (nitro flames come out of these)
      {
        geo: cyl(0.09, 0.32, 10),
        pos: [s * 0.42, 0.5, b.rearZ - 0.12],
        rotX: Math.PI / 2,
        color: CHROME,
      },
    );
  }
  return parts;
}

/** shell = outlined silhouette parts; detail = flat trim drawn without outlines. */
function design(carId: CarId): { shell: Part[]; detail: Part[] } {
  switch (carId) {
    case 'balanced': // chunky hatchback, tall rear-biased cabin, roof rack
      return {
        shell: [
          { geo: rbox(1.9, 0.62, 3.8, 0.22), pos: [0, 0.68, 0], color: PAINT },
          { geo: rbox(1.62, 0.62, 2.1, 0.24), pos: [0, 1.22, -0.35], color: PAINT },
          { geo: box(1.5, 0.08, 0.1), pos: [0, 1.62, 0.1], color: INK },
          { geo: box(1.5, 0.08, 0.1), pos: [0, 1.62, -0.8], color: INK },
        ],
        detail: [
          { geo: box(1.66, 0.3, 1.8), pos: [0, 1.26, -0.35], color: GLASS },
          { geo: box(0.36, 0.02, 2.0), pos: [0, 1.531, -0.35], color: WHITE },
          { geo: box(0.36, 0.02, 1.2), pos: [0, 1.0, 1.25], color: WHITE },
          ...trim({
            halfW: 0.95,
            bodyY: 0.68,
            bodyH: 0.62,
            frontZ: 1.9,
            rearZ: -1.9,
            cabinHalfW: 0.81,
            cabinY: 1.22,
            cabinFrontZ: 0.65,
            lightY: 0.78,
            lightSpread: 0.58,
          }),
        ],
      };
    case 'drifter': // boxy retro coupe, low cabin, big rear wing, front lip
      return {
        shell: [
          { geo: rbox(1.92, 0.56, 3.95, 0.1, 2), pos: [0, 0.64, 0], color: PAINT },
          { geo: rbox(1.52, 0.5, 1.7, 0.12, 2), pos: [0, 1.15, -0.2], color: PAINT },
          { geo: box(1.9, 0.08, 0.5), pos: [0, 1.3, -1.75], color: WHITE },
          { geo: box(1.8, 0.06, 0.3), pos: [0, 0.3, 2.05], color: INK },
        ],
        detail: [
          { geo: box(1.56, 0.26, 1.4), pos: [0, 1.17, -0.2], color: GLASS },
          { geo: box(0.32, 0.02, 1.9), pos: [0, 0.93, 0.95], color: WHITE },
          { geo: box(0.1, 0.38, 0.14), pos: [-0.6, 1.08, -1.7], color: INK },
          { geo: box(0.1, 0.38, 0.14), pos: [0.6, 1.08, -1.7], color: INK },
          ...trim({
            halfW: 0.96,
            bodyY: 0.64,
            bodyH: 0.56,
            frontZ: 1.975,
            rearZ: -1.975,
            cabinHalfW: 0.76,
            cabinY: 1.15,
            cabinFrontZ: 0.6,
            lightY: 0.72,
            lightSpread: 0.6,
          }),
        ],
      };
    case 'speedster': // low wedge sports car, sloped hood with scoop, cabin pushed back
      return {
        shell: [
          { geo: rbox(1.96, 0.44, 4.0, 0.16), pos: [0, 0.56, 0], color: PAINT },
          { geo: rbox(1.8, 0.24, 1.7, 0.1, 2), pos: [0, 0.8, 0.95], rotX: 0.12, color: PAINT },
          { geo: rbox(1.4, 0.42, 1.5, 0.2), pos: [0, 0.98, -0.55], color: PAINT },
          { geo: rbox(0.6, 0.14, 0.6, 0.05, 2), pos: [0, 0.98, 0.7], rotX: 0.12, color: INK },
        ],
        detail: [
          { geo: box(1.44, 0.22, 1.2), pos: [0, 1.0, -0.5], color: GLASS },
          { geo: box(0.16, 0.02, 1.6), pos: [-0.22, 0.95, 0.95], rotX: 0.12, color: WHITE },
          { geo: box(0.16, 0.02, 1.6), pos: [0.22, 0.95, 0.95], rotX: 0.12, color: WHITE },
          { geo: box(1.7, 0.08, 0.4), pos: [0, 0.82, -1.75], color: INK },
          ...trim({
            halfW: 0.98,
            bodyY: 0.56,
            bodyH: 0.44,
            frontZ: 2.0,
            rearZ: -2.0,
            cabinHalfW: 0.7,
            cabinY: 0.98,
            cabinFrontZ: 0.15,
            lightY: 0.6,
            lightSpread: 0.63,
          }),
        ],
      };
  }
}

const tmpColor = new Color();
const m = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const one = new Vector3(1, 1, 1);

/** Transforms + vertex-colors each part, then merges into one geometry. */
function merge(parts: Part[], paint: string): BufferGeometry {
  const geos = parts.map((p) => {
    // Same layout everywhere (non-indexed; position/normal/color) so they merge:
    // RoundedBoxGeometry is non-indexed while Box/Cylinder are indexed.
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    if (g !== p.geo) p.geo.dispose();
    g.deleteAttribute('uv');
    e.set(p.rotX ?? 0, 0, p.rotZ ?? 0);
    m.compose(new Vector3(...p.pos), q.setFromEuler(e), one);
    g.applyMatrix4(m);
    tmpColor.set(p.color === PAINT ? paint : p.color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
    g.setAttribute('color', new BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) throw new Error('car geometry merge failed');
  merged.computeBoundingSphere();
  return merged;
}

export interface CarGeometry {
  shell: BufferGeometry;
  detail: BufferGeometry;
  /** Wheel with its hubcap on the +X (left) or −X (right) side. */
  wheelLeft: BufferGeometry;
  wheelRight: BufferGeometry;
}

function wheel(side: 1 | -1): BufferGeometry {
  const face = side * (WHEEL_WIDTH / 2 + 0.01);
  const parts: Part[] = [
    {
      geo: new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 16),
      pos: [0, 0, 0],
      rotZ: Math.PI / 2,
      color: WHEEL,
    },
    // white rim disc + ink hub, so the spin reads clearly
    {
      geo: new CylinderGeometry(0.33, 0.33, 0.05, 16),
      pos: [face, 0, 0],
      rotZ: Math.PI / 2,
      color: WHITE,
    },
    {
      geo: new CylinderGeometry(0.11, 0.11, 0.08, 8),
      pos: [face + side * 0.03, 0, 0],
      rotZ: Math.PI / 2,
      color: INK,
    },
  ];
  for (let k = 0; k < 3; k++) {
    parts.push({
      geo: new BoxGeometry(0.06, 0.6, 0.08),
      pos: [face + side * 0.02, 0, 0],
      rotX: (k * Math.PI) / 3,
      color: '#B8BECB',
    });
  }
  return merge(parts, WHITE);
}

const cache = new Map<string, CarGeometry>();
let wheels: { left: BufferGeometry; right: BufferGeometry } | null = null;

export function getCarGeometry(carId: CarId, paint: string): CarGeometry {
  const key = `${carId}|${paint}`;
  const hit = cache.get(key);
  if (hit) return hit;
  wheels ??= { left: wheel(1), right: wheel(-1) };
  const d = design(carId);
  const g: CarGeometry = {
    shell: merge(d.shell, paint),
    detail: merge(d.detail, paint),
    wheelLeft: wheels.left,
    wheelRight: wheels.right,
  };
  cache.set(key, g);
  return g;
}
