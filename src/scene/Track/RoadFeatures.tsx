import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  MeshToonMaterial,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three';
import type { TrackData } from '../../engine/track/TrackDefinition';
import { getToonGradient, getToonMaterial } from '../materials/toon';
import { InstancedParts, type Part } from './InstancedParts';

// Road features: chevron ramps, glowing boost pads, wooden bridges.

/** A strip following the centerline over samples [from, to], `width` wide, `lift` above the road. */
function roadStrip(
  t: TrackData,
  from: number,
  to: number,
  width: number,
  lift: number,
): BufferGeometry {
  const n = t.sampleCount;
  const count = ((to - from + n) % n) + 1;
  const pos = new Float32Array(count * 2 * 3);
  const uv = new Float32Array(count * 2 * 2);
  const idx: number[] = [];
  const half = width / 2;
  for (let k = 0; k < count; k++) {
    const i = (from + k) % n;
    const rx = -t.tz[i]!;
    const rz = t.tx[i]!;
    const y = t.h[i]! + lift;
    pos.set(
      [
        t.px[i]! - rx * half,
        y,
        t.pz[i]! - rz * half,
        t.px[i]! + rx * half,
        y,
        t.pz[i]! + rz * half,
      ],
      k * 6,
    );
    const v = k / Math.max(1, count - 1);
    uv.set([0, v, 1, v], k * 4);
    if (k < count - 1) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Yellow/ink chevrons pointing in the driving direction (+v). */
function chevronTexture(a: string, b: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = b;
  g.beginPath();
  g.moveTo(0, 40);
  g.lineTo(32, 12);
  g.lineTo(64, 40);
  g.lineTo(64, 58);
  g.lineTo(32, 30);
  g.lineTo(0, 58);
  g.closePath();
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

const padVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const padFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    // scrolling chevrons; bright (>1) so bloom makes them glow
    float x = abs(vUv.x - 0.5);
    float v = fract(vUv.y * 3.0 - x * 1.6 - uTime * 1.8);
    float chevron = smoothstep(0.0, 0.08, v) * (1.0 - smoothstep(0.42, 0.5, v));
    float edge = smoothstep(0.5, 0.42, x);
    gl_FragColor = vec4(uColor * (0.6 + 1.6 * chevron), (0.35 + 0.65 * chevron) * edge);
  }
`;

export function RoadFeatures({ track, outlines }: { track: TrackData; outlines: boolean }) {
  const n = track.sampleCount;

  const ramps = useMemo(() => {
    const tex = chevronTexture('#FFC933', '#2B2340');
    tex.repeat.set(3, 2);
    const mat = new MeshToonMaterial({ map: tex, gradientMap: getToonGradient() });
    const geos = track.ramps.map((r) => {
      const half = Math.round(r.length / 2);
      return roadStrip(
        track,
        (r.sample - half + n) % n,
        (r.sample + half) % n,
        track.def.roadWidth * 0.8,
        0.06,
      );
    });
    return { mat, geos };
  }, [track, n]);

  const pads = useMemo(() => {
    const mat = new ShaderMaterial({
      vertexShader: padVert,
      fragmentShader: padFrag,
      uniforms: { uTime: { value: 0 }, uColor: { value: new Color(1.1, 0.55, 2.2) } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const geos = track.boostPads.map((p) =>
      roadStrip(track, (p.sample - 3 + n) % n, (p.sample + 3) % n, track.def.roadWidth * 0.6, 0.07),
    );
    return { mat, geos };
  }, [track, n]);

  const bridge = useMemo(() => buildBridges(track), [track]);

  useEffect(
    () => () => {
      ramps.mat.map?.dispose();
      ramps.mat.dispose();
      ramps.geos.forEach((g) => g.dispose());
      pads.mat.dispose();
      pads.geos.forEach((g) => g.dispose());
    },
    [ramps, pads],
  );
  useFrame((_, dt) => {
    pads.mat.uniforms.uTime!.value += dt;
  });

  return (
    <>
      {ramps.geos.map((g, i) => (
        <mesh key={`r${i}`} geometry={g} material={ramps.mat} receiveShadow />
      ))}
      {pads.geos.map((g, i) => (
        <mesh key={`p${i}`} geometry={g} material={pads.mat} renderOrder={2} />
      ))}
      <InstancedParts
        parts={bridge.beams}
        material={getToonMaterial('#A0673A')}
        outlines={outlines}
      >
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      <InstancedParts
        parts={bridge.rails}
        material={getToonMaterial('#FFFFFF')}
        outlines={outlines}
      >
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      <InstancedParts
        parts={bridge.pillars}
        material={getToonMaterial('#8E93A6')}
        outlines={outlines}
      >
        <cylinderGeometry args={[0.5, 0.6, 1, 8]} />
      </InstancedParts>
    </>
  );
}

/** Wherever the ground drops well below the road (river crossings), build a bridge. */
function buildBridges(t: TrackData): { beams: Part[]; rails: Part[]; pillars: Part[] } {
  const beams: Part[] = [];
  const rails: Part[] = [];
  const pillars: Part[] = [];
  const half = t.def.roadWidth / 2;
  const water = t.terrain.riverLevel ?? t.terrain.seaLevel;
  for (let i = 0; i < t.sampleCount; i++) {
    const ground = t.terrain.heightAt(t.px[i]!, t.pz[i]!);
    if (ground > t.h[i]! - 1.0) continue;
    const yaw = Math.atan2(t.tx[i]!, t.tz[i]!);
    const rx = -t.tz[i]!;
    const rz = t.tx[i]!;
    for (const side of [-1, 1]) {
      const ox = t.px[i]! + rx * side * (half + 0.3);
      const oz = t.pz[i]! + rz * side * (half + 0.3);
      // deck edge beam + railing
      beams.push({ x: ox, y: t.h[i]! - 0.35, z: oz, sx: 0.6, sy: 0.7, sz: 1.05, ry: yaw });
      if (i % 2 === 0)
        rails.push({ x: ox, y: t.h[i]! + 0.6, z: oz, sx: 0.18, sy: 1.2, sz: 0.18, ry: yaw });
      rails.push({ x: ox, y: t.h[i]! + 1.15, z: oz, sx: 0.22, sy: 0.18, sz: 1.05, ry: yaw });
      if (i % 8 === 0 && water !== null) {
        const top = t.h[i]! - 0.6;
        const bottom = water - 2;
        pillars.push({
          x: ox,
          y: (top + bottom) / 2,
          z: oz,
          sx: 1,
          sy: top - bottom,
          sz: 1,
          ry: 0,
        });
      }
    }
    // underside planks so the road reads as a deck from the side
    beams.push({
      x: t.px[i]!,
      y: t.h[i]! - 0.3,
      z: t.pz[i]!,
      sx: t.def.roadWidth,
      sy: 0.5,
      sz: 1.05,
      ry: yaw,
    });
  }
  return { beams, rails, pillars };
}
