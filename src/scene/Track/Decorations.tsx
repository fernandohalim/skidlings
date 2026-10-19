import { useMemo } from 'react';
import { WORLD_PALETTE as P } from '../../config/graphics.config';
import type { Decoration } from '../../engine/track/TrackDefinition';
import { getToonMaterial } from '../materials/toon';
import { InstancedParts, type Part } from './InstancedParts';

// Instanced toy props (§10.10): blob trees, stacked pines, palms, cacti,
// mushrooms, bushes, rocks, flowers, toy blocks and grass tufts. Every kind is
// a handful of instanced meshes, so hundreds of props cost ~16 draw calls.

const pick = <T,>(arr: readonly T[], i: number): T => arr[i % arr.length]!;
type Ground = (x: number, z: number) => number;

const KEYS = [
  'trunks',
  'leaves',
  'leavesTop',
  'pineTrunks',
  'pineCones',
  'palmTrunks',
  'palmLeaves',
  'cactus',
  'shroomStems',
  'shroomCaps',
  'shroomDots',
  'bushes',
  'rocks',
  'blocks',
  'flowers',
  'tufts',
] as const;
type PartLists = Record<(typeof KEYS)[number], Part[]>;

function buildParts(items: Decoration[], ground: Ground): PartLists {
  const L = Object.fromEntries(KEYS.map((k) => [k, [] as Part[]])) as PartLists;
  for (const d of items) {
    const s = d.scale;
    const { x, z, rotation: ry } = d;
    const g = ground(x, z);
    const at = (lx: number, lz: number): [number, number] => [
      x + lx * Math.cos(ry) + lz * Math.sin(ry),
      z - lx * Math.sin(ry) + lz * Math.cos(ry),
    ];
    switch (d.kind) {
      case 'tree':
        L.trunks.push({ x, y: g + 1.1 * s, z, sx: 0.5 * s, sy: 2.2 * s, sz: 0.5 * s, ry });
        L.leaves.push({ x, y: g + 3.4 * s, z, sx: 2.8 * s, sy: 2.5 * s, sz: 2.8 * s, ry });
        {
          const [tx, tz] = at(0.5 * s, -0.3 * s);
          L.leavesTop.push({
            x: tx,
            y: g + 4.7 * s,
            z: tz,
            sx: 1.7 * s,
            sy: 1.5 * s,
            sz: 1.7 * s,
            ry,
          });
          const [bx, bz] = at(-1.0 * s, 0.6 * s);
          L.leavesTop.push({
            x: bx,
            y: g + 3.0 * s,
            z: bz,
            sx: 1.4 * s,
            sy: 1.3 * s,
            sz: 1.4 * s,
            ry,
          });
        }
        break;
      case 'pine':
        L.pineTrunks.push({ x, y: g + 0.6 * s, z, sx: 0.45 * s, sy: 1.2 * s, sz: 0.45 * s, ry });
        L.pineCones.push({ x, y: g + 2.3 * s, z, sx: 2.6 * s, sy: 2.6 * s, sz: 2.6 * s, ry });
        L.pineCones.push({
          x,
          y: g + 3.8 * s,
          z,
          sx: 2.0 * s,
          sy: 2.3 * s,
          sz: 2.0 * s,
          ry: ry + 0.4,
        });
        L.pineCones.push({
          x,
          y: g + 5.1 * s,
          z,
          sx: 1.3 * s,
          sy: 1.9 * s,
          sz: 1.3 * s,
          ry: ry + 0.8,
        });
        break;
      case 'palm': {
        // leaning trunk of 4 segments, frond fan on top
        let px = x;
        let pz = z;
        const lean = 0.35 * s;
        const dx = Math.sin(ry) * lean;
        const dz = Math.cos(ry) * lean;
        for (let k = 0; k < 4; k++) {
          L.palmTrunks.push({
            x: px,
            y: g + 0.7 * s + k * 1.3 * s,
            z: pz,
            sx: 0.42 * s,
            sy: 1.35 * s,
            sz: 0.42 * s,
            ry,
          });
          px += dx;
          pz += dz;
        }
        for (let k = 0; k < 6; k++) {
          const a = ry + (k * Math.PI) / 3;
          L.palmLeaves.push({
            x: px + Math.sin(a) * 1.3 * s,
            y: g + 5.8 * s,
            z: pz + Math.cos(a) * 1.3 * s,
            sx: 0.9 * s,
            sy: 0.25 * s,
            sz: 2.8 * s,
            ry: a,
          });
        }
        break;
      }
      case 'cactus': {
        L.cactus.push({ x, y: g + 1.5 * s, z, sx: 0.7 * s, sy: 3.0 * s, sz: 0.7 * s, ry });
        const [ax, az] = at(0.65 * s, 0);
        L.cactus.push({
          x: ax,
          y: g + 1.9 * s,
          z: az,
          sx: 0.45 * s,
          sy: 1.3 * s,
          sz: 0.45 * s,
          ry,
        });
        const [bx, bz] = at(-0.6 * s, 0);
        L.cactus.push({
          x: bx,
          y: g + 1.4 * s,
          z: bz,
          sx: 0.42 * s,
          sy: 1.0 * s,
          sz: 0.42 * s,
          ry,
        });
        break;
      }
      case 'mushroom':
        L.shroomStems.push({ x, y: g + 0.45 * s, z, sx: 0.45 * s, sy: 0.9 * s, sz: 0.45 * s, ry });
        L.shroomCaps.push({ x, y: g + 1.0 * s, z, sx: 1.5 * s, sy: 0.8 * s, sz: 1.5 * s, ry });
        for (let k = 0; k < 3; k++) {
          const a = ry + k * 2.1;
          L.shroomDots.push({
            x: x + Math.cos(a) * 0.45 * s,
            y: g + 1.28 * s,
            z: z + Math.sin(a) * 0.45 * s,
            sx: 0.22 * s,
            sy: 0.14 * s,
            sz: 0.22 * s,
            ry: 0,
          });
        }
        break;
      case 'bush':
        L.bushes.push({ x, y: g + 0.55 * s, z, sx: 1.7 * s, sy: 1.2 * s, sz: 1.5 * s, ry });
        {
          const [bx, bz] = at(0.9 * s, 0.2 * s);
          L.bushes.push({
            x: bx,
            y: g + 0.4 * s,
            z: bz,
            sx: 1.1 * s,
            sy: 0.8 * s,
            sz: 1.1 * s,
            ry,
          });
        }
        break;
      case 'rock':
        L.rocks.push({ x, y: g + 0.4 * s, z, sx: 1.5 * s, sy: 1.1 * s, sz: 1.2 * s, ry });
        if (d.variant % 2 === 0) {
          const [bx, bz] = at(1.0 * s, 0.4 * s);
          L.rocks.push({
            x: bx,
            y: g + 0.25 * s,
            z: bz,
            sx: 0.8 * s,
            sy: 0.6 * s,
            sz: 0.7 * s,
            ry: ry + 1,
          });
        }
        break;
      case 'block': {
        const b = 1.4 * s;
        L.blocks.push({
          x,
          y: g + b / 2,
          z,
          sx: b,
          sy: b,
          sz: b,
          ry,
          color: pick(P.toyColors, d.variant),
        });
        if (d.variant % 2 === 0) {
          L.blocks.push({
            x,
            y: g + b + b * 0.35,
            z,
            sx: b * 0.7,
            sy: b * 0.7,
            sz: b * 0.7,
            ry: ry + 0.5,
            color: pick(P.toyColors, d.variant + 2),
          });
        }
        break;
      }
      case 'flower':
        for (let k = 0; k < 6; k++) {
          const a = ry + k * 1.05;
          const r = 0.5 + (k % 3) * 0.45;
          const fx = x + Math.cos(a) * r * s;
          const fz = z + Math.sin(a) * r * s;
          L.flowers.push({
            x: fx,
            y: ground(fx, fz) + 0.35,
            z: fz,
            sx: 0.34,
            sy: 0.34,
            sz: 0.34,
            ry: 0,
            color: pick(P.flowerColors, d.variant + k),
          });
        }
        break;
      case 'tuft':
        for (let k = 0; k < 3; k++) {
          const [tx, tz] = at((k - 1) * 0.35 * s, (k % 2) * 0.25 * s);
          L.tufts.push({
            x: tx,
            y: g + 0.35 * s,
            z: tz,
            sx: 0.28 * s,
            sy: (0.7 + k * 0.15) * s,
            sz: 0.28 * s,
            ry,
          });
        }
        break;
    }
  }
  return L;
}

export function Decorations({
  items,
  outlines,
  ground = () => 0,
}: {
  items: Decoration[];
  outlines: boolean;
  /** Terrain height (2.5D); flat lobby by default. */
  ground?: Ground;
}) {
  const L = useMemo(() => buildParts(items, ground), [items, ground]);
  const white = getToonMaterial('#FFFFFF');
  const o = outlines;

  return (
    <>
      <InstancedParts parts={L.trunks} material={getToonMaterial(P.trunk)}>
        <cylinderGeometry args={[0.5, 0.6, 1, 7]} />
      </InstancedParts>
      <InstancedParts parts={L.leaves} material={getToonMaterial(P.leaves)} outlines={o}>
        <icosahedronGeometry args={[0.5, 1]} />
      </InstancedParts>
      <InstancedParts parts={L.leavesTop} material={getToonMaterial(P.leavesLight)} outlines={o}>
        <icosahedronGeometry args={[0.5, 1]} />
      </InstancedParts>
      <InstancedParts parts={L.pineTrunks} material={getToonMaterial(P.trunk)}>
        <cylinderGeometry args={[0.5, 0.6, 1, 6]} />
      </InstancedParts>
      <InstancedParts parts={L.pineCones} material={getToonMaterial(P.pine)} outlines={o}>
        <coneGeometry args={[0.5, 1, 8]} />
      </InstancedParts>
      <InstancedParts parts={L.palmTrunks} material={getToonMaterial('#B98552')}>
        <cylinderGeometry args={[0.45, 0.55, 1, 7]} />
      </InstancedParts>
      <InstancedParts parts={L.palmLeaves} material={getToonMaterial('#3DBE5A')} outlines={o}>
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      <InstancedParts parts={L.cactus} material={getToonMaterial('#3FAE5C')} outlines={o}>
        <capsuleGeometry args={[0.5, 0.6, 4, 8]} />
      </InstancedParts>
      <InstancedParts parts={L.shroomStems} material={getToonMaterial('#F7EBDD')}>
        <cylinderGeometry args={[0.45, 0.55, 1, 8]} />
      </InstancedParts>
      <InstancedParts parts={L.shroomCaps} material={getToonMaterial('#FF4D4D')} outlines={o}>
        <sphereGeometry args={[0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </InstancedParts>
      <InstancedParts parts={L.shroomDots} material={white} castShadow={false}>
        <sphereGeometry args={[0.5, 8, 4]} />
      </InstancedParts>
      <InstancedParts parts={L.bushes} material={getToonMaterial(P.bush)} outlines={o}>
        <icosahedronGeometry args={[0.5, 1]} />
      </InstancedParts>
      <InstancedParts parts={L.rocks} material={getToonMaterial(P.rock)} outlines={o}>
        <dodecahedronGeometry args={[0.5, 0]} />
      </InstancedParts>
      <InstancedParts parts={L.blocks} material={white} outlines={o}>
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      <InstancedParts parts={L.flowers} material={white} castShadow={false}>
        <icosahedronGeometry args={[0.5, 0]} />
      </InstancedParts>
      <InstancedParts parts={L.tufts} material={getToonMaterial('#3E9F45')} castShadow={false}>
        <coneGeometry args={[0.5, 1, 4]} />
      </InstancedParts>
    </>
  );
}
