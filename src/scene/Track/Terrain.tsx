import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  MeshToonMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import { buildTerrainMesh } from '../../engine/track/terrain';
import type { TrackData } from '../../engine/track/TrackDefinition';
import { getToonGradient } from '../materials/toon';

const PAD = 110; // terrain beyond the track bounds (fills the view, fades into fog)
const CELL = 3;

/** 2.5D ground: a vertex-colored toon heightfield + animated toon water. */
export function Terrain({ track }: { track: TrackData }) {
  const { geometry, material } = useMemo(() => {
    const m = buildTerrainMesh(
      track.terrain,
      track.def.theme,
      track.bounds,
      PAD,
      CELL,
      track.def.decorationSeed,
    );
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(m.positions, 3));
    g.setAttribute('normal', new BufferAttribute(m.normals, 3));
    g.setAttribute('color', new BufferAttribute(m.colors, 3));
    g.setIndex(new BufferAttribute(m.indices, 1));
    g.computeBoundingSphere();
    const mat = new MeshToonMaterial({ vertexColors: true, gradientMap: getToonGradient() });
    return { geometry: g, material: mat };
  }, [track]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const water = [track.terrain.seaLevel, track.terrain.riverLevel].filter(
    (v): v is number => v !== null,
  );
  return (
    <>
      <mesh geometry={geometry} material={material} receiveShadow />
      {water.map((level) => (
        <Water key={level} track={track} level={level} />
      ))}
    </>
  );
}

const waterVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    w.y += sin(w.x * 0.15 + uTime * 1.3) * 0.12 + cos(w.z * 0.12 + uTime * 1.1) * 0.12;
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const waterFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uLight;
  uniform vec3 uFog;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorld;
  void main() {
    // toon water: two flat tones from slow interfering waves + crisp sparkle lines
    float w = sin(vWorld.x * 0.08 + uTime * 0.6) + sin(vWorld.z * 0.11 - uTime * 0.5)
            + sin((vWorld.x + vWorld.z) * 0.05 + uTime * 0.4);
    vec3 col = w > 0.6 ? uLight : uDeep;
    float sparkle = step(0.985, sin(vWorld.x * 0.9 + uTime * 2.0) * sin(vWorld.z * 0.7 - uTime * 1.7));
    col = mix(col, vec3(1.0), sparkle * 0.85);
    float d = length(cameraPosition - vWorld);
    float f = smoothstep(uFogNear, uFogFar, d);
    gl_FragColor = vec4(mix(col, uFog, f), 1.0);
  }
`;

function Water({ track, level }: { track: TrackData; level: number }) {
  const { geometry, material } = useMemo(() => {
    const b = track.bounds;
    const w = b.maxX - b.minX + PAD * 2 + 200;
    const h = b.maxZ - b.minZ + PAD * 2 + 200;
    const g = new PlaneGeometry(w, h, 40, 40);
    g.rotateX(-Math.PI / 2);
    g.translate((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    const theme = track.def.theme;
    const deep = new Color(theme.water);
    const light = deep.clone().lerp(new Color('#FFFFFF'), 0.35);
    const mat = new ShaderMaterial({
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: deep },
        uLight: { value: light },
        uFog: { value: new Color(theme.skyHorizon) },
        uFogNear: { value: 90 },
        uFogFar: { value: 260 },
      },
    });
    return { geometry: g, material: mat };
  }, [track]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame((_, dt) => {
    material.uniforms.uTime!.value += dt;
  });
  return <mesh geometry={geometry} material={material} position-y={level} receiveShadow />;
}
