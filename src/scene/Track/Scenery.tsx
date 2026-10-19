import { useEffect, useMemo } from 'react';
import { DataTexture, MeshToonMaterial, NearestFilter, RGBAFormat, RepeatWrapping } from 'three';
import { WORLD_PALETTE as P } from '../../config/graphics.config';
import { TRACK_CONFIG } from '../../config/track.config';
import type { TrackData } from '../../engine/track/TrackDefinition';
import { createRng } from '../../engine/utils/random';
import { getToonGradient, getToonMaterial } from '../materials/toon';
import { InstancedParts, type Part } from './InstancedParts';

// Depth & life around the track: ground patches, mounds, tire stacks, flag
// posts, center-line dashes, a grandstand with a toy crowd and a start gantry.

const pick = <T,>(arr: readonly T[], i: number): T => arr[i % arr.length]!;

/** Transforms a point in a local frame (yaw `ry` around origin x0,z0) to world. */
function local(x0: number, z0: number, ry: number, lx: number, lz: number): [number, number] {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return [x0 + lx * c + lz * s, z0 - lx * s + lz * c];
}

function buildSceneryParts(t: TrackData) {
  const sc = t.scenery;
  const rng = createRng(t.def.decorationSeed + 7);

  const tires: Part[] = [];
  for (const s of sc.tireStacks) {
    for (let k = 0; k < 3; k++) {
      tires.push({
        x: s.x,
        y: 0.2 + k * 0.38,
        z: s.z,
        sx: 1,
        sy: 1,
        sz: 1,
        ry: s.rotation,
        color: k === 1 ? pick(P.toyColors, s.variant) : P.tire,
      });
    }
  }

  const poles: Part[] = [];
  const flags: Part[] = [];
  for (const f of sc.flags) {
    poles.push({ x: f.x, y: 2.6, z: f.z, sx: 0.12, sy: 5.2, sz: 0.12, ry: 0 });
    const [fx, fz] = local(f.x, f.z, f.rotation, 0, -0.85);
    flags.push({
      x: fx,
      y: 4.6,
      z: fz,
      sx: 0.06,
      sy: 1.0,
      sz: 1.6,
      ry: f.rotation,
      color: pick(P.toyColors, f.variant),
    });
  }

  // Center-line dashes: strong motion cue at speed.
  const dashes: Part[] = [];
  const period = TRACK_CONFIG.dashLength + TRACK_CONFIG.dashGap;
  for (let d = 0, i = 0; d < t.length - period; d += period) {
    while (i < t.sampleCount - 1 && t.dist[i]! < d + TRACK_CONFIG.dashLength / 2) i++;
    if (d < 6) continue; // keep the start line clean
    dashes.push({
      x: t.px[i]!,
      y: t.h[i]! + 0.035,
      z: t.pz[i]!,
      sx: 0.35,
      sy: 1,
      sz: TRACK_CONFIG.dashLength,
      ry: Math.atan2(t.tx[i]!, t.tz[i]!),
    });
  }

  // Grandstand: stepped tiers rising away from the track (local -Z), roof on posts.
  const g = sc.grandstand;
  const tiers: Part[] = [];
  const crowd: Part[] = [];
  const roof: Part[] = [];
  const depth = TRACK_CONFIG.grandstandDepth;
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const lz = depth / 2 - (r + 0.5) * (depth / rows);
    const h = 0.8 + r * 0.9;
    const [x, z] = local(g.x, g.z, g.rotation, 0, lz);
    tiers.push({
      x,
      y: h / 2,
      z,
      sx: g.length,
      sy: h,
      sz: depth / rows,
      ry: g.rotation,
      color: r % 2 === 0 ? '#FFFFFF' : '#F3ECFF',
    });
    for (let k = 0; k < 16; k++) {
      const lx = -g.length / 2 + 1.2 + k * ((g.length - 2.4) / 15) + (rng() - 0.5) * 0.6;
      const [cx, cz] = local(g.x, g.z, g.rotation, lx, lz);
      const sz = 0.55 + rng() * 0.2;
      crowd.push({
        x: cx,
        y: h + sz * 0.6,
        z: cz,
        sx: sz,
        sy: sz * 1.3,
        sz,
        ry: 0,
        color: pick(P.toyColors, Math.floor(rng() * 5)),
      });
    }
  }
  const roofH = 0.8 + rows * 0.9 + 2.4;
  for (const lx of [-g.length / 2 + 0.4, g.length / 2 - 0.4]) {
    const [x, z] = local(g.x, g.z, g.rotation, lx, -depth / 2 + 0.4);
    roof.push({
      x,
      y: roofH / 2,
      z,
      sx: 0.4,
      sy: roofH,
      sz: 0.4,
      ry: g.rotation,
      color: '#FFFFFF',
    });
  }
  // Roof covers only the back rows so the crowd stays visible from the chase camera.
  const [rx, rz] = local(g.x, g.z, g.rotation, 0, -depth * 0.3);
  roof.push({
    x: rx,
    y: roofH,
    z: rz,
    sx: g.length + 1,
    sy: 0.4,
    sz: depth * 0.45,
    ry: g.rotation,
    color: P.curbA,
  });

  // Start gantry over the line.
  const s0 = 0;
  const yaw = Math.atan2(t.tx[s0]!, t.tz[s0]!);
  const span = t.def.roadWidth / 2 + TRACK_CONFIG.curbWidth + 0.6;
  const gantry: Part[] = [];
  for (const side of [-1, 1]) {
    const [x, z] = local(t.px[s0]!, t.pz[s0]!, yaw, side * span, 0);
    gantry.push({ x, y: 3.4, z, sx: 0.8, sy: 6.8, sz: 0.8, ry: yaw, color: '#FFFFFF' });
  }
  const banner = { x: t.px[s0]!, y: t.h[s0]! + 6.6, z: t.pz[s0]!, width: span * 2 + 0.8, yaw };

  // 2.5D: stand everything on the ground (terrain) or road it belongs to.
  const G = (x: number, z: number) => t.terrain.heightAt(x, z);
  for (const p of tires) p.y += G(p.x, p.z);
  sc.flags.forEach((f, k) => {
    const base = G(f.x, f.z);
    poles[k]!.y += base;
    flags[k]!.y += base;
  });
  const standY = G(g.x, g.z);
  for (const p of [...tiers, ...crowd, ...roof]) p.y += standY;
  for (const p of gantry) p.y += t.h[s0]!;

  return { tires, poles, flags, dashes, tiers, crowd, roof, gantry, banner };
}

function checkerTexture(): DataTexture {
  const data = new Uint8Array([
    255, 255, 255, 255, 43, 35, 64, 255, 43, 35, 64, 255, 255, 255, 255, 255,
  ]);
  const t = new DataTexture(data, 2, 2, RGBAFormat);
  t.magFilter = t.minFilter = NearestFilter;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

export function Scenery({ track, outlines }: { track: TrackData; outlines: boolean }) {
  const S = useMemo(() => buildSceneryParts(track), [track]);
  const bannerMat = useMemo(() => {
    const tex = checkerTexture();
    tex.repeat.set(S.banner.width / 0.8, 2);
    return new MeshToonMaterial({ map: tex, gradientMap: getToonGradient() });
  }, [S]);
  useEffect(
    () => () => {
      bannerMat.map?.dispose();
      bannerMat.dispose();
    },
    [bannerMat],
  );
  const white = getToonMaterial('#FFFFFF');

  return (
    <>
      <InstancedParts
        parts={S.dashes}
        material={getToonMaterial(P.dash)}
        castShadow={false}
        receiveShadow
      >
        <boxGeometry args={[1, 0.02, 1]} />
      </InstancedParts>
      <InstancedParts parts={S.tires} material={white} outlines={outlines}>
        <cylinderGeometry args={[0.6, 0.6, 0.36, 12]} />
      </InstancedParts>
      <InstancedParts parts={S.poles} material={white}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </InstancedParts>
      <InstancedParts parts={S.flags} material={white} castShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      <InstancedParts parts={S.tiers} material={white} outlines={outlines} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      <InstancedParts parts={S.crowd} material={white} castShadow={false}>
        <icosahedronGeometry args={[0.5, 0]} />
      </InstancedParts>
      <InstancedParts parts={[...S.roof, ...S.gantry]} material={white} outlines={outlines}>
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      <mesh
        position={[S.banner.x, S.banner.y, S.banner.z]}
        rotation={[0, S.banner.yaw, 0]}
        material={bannerMat}
        castShadow
      >
        <boxGeometry args={[S.banner.width, 1.6, 0.5]} />
      </mesh>
    </>
  );
}
