import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  Color,
  InstancedBufferAttribute,
  OctahedronGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { ThemeKind } from '../../engine/track/TrackDefinition';
import { createRng } from '../../engine/utils/random';
import type { CarRenderPose } from '../sim/CarRenderPose';

// Floating theme particles around the player (life in the air): falling leaves
// in the forest, sea spray specks at the coast, dust motes in the canyon.
// Positions wrap inside a box that follows the car: zero CPU per particle.

const COUNT = 140;
const BOX = new Vector3(80, 18, 80);

const STYLE: Record<
  ThemeKind | 'town',
  { colors: string[]; fall: number; size: number; drift: number }
> = {
  forest: { colors: ['#7BD957', '#FFD54A', '#F59E3B'], fall: 1.2, size: 0.32, drift: 1.4 },
  seaside: { colors: ['#FFFFFF', '#D8F3FF'], fall: -0.3, size: 0.18, drift: 2.4 },
  canyon: { colors: ['#FFD9A8', '#F5B97A'], fall: 0.2, size: 0.16, drift: 3 },
  town: { colors: ['#FF8FB1', '#FFFFFF', '#FFC933'], fall: 0.9, size: 0.22, drift: 1 },
};

const vert = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform float uFall;
  uniform float uDrift;
  uniform float uSize;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec3 move = vec3(sin(uTime * 0.6 + aPhase) * uDrift, -uFall * uTime, cos(uTime * 0.5 + aPhase * 1.3) * uDrift);
    vec3 p = mod(aOffset + move - uCenter + uBox * 0.5, uBox) - uBox * 0.5 + uCenter;
    // tumble
    float a = uTime * 2.0 + aPhase;
    vec3 v = position * uSize;
    v.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * v.xz;
    gl_Position = projectionMatrix * viewMatrix * vec4(p + v, 1.0);
  }
`;
const frag = /* glsl */ `
  varying vec3 vColor;
  void main() { gl_FragColor = vec4(vColor, 1.0); }
`;

export function Ambience({ theme, pose }: { theme: ThemeKind | 'town'; pose: CarRenderPose }) {
  const style = STYLE[theme];
  const { geometry, material } = useMemo(() => {
    const g = new OctahedronGeometry(1, 0);
    g.scale(1, 0.25, 1); // flakes
    const r = createRng(91);
    const off = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const ph = new Float32Array(COUNT);
    const c = new Color();
    for (let i = 0; i < COUNT; i++) {
      off.set([r() * BOX.x, r() * BOX.y, r() * BOX.z], i * 3);
      c.set(style.colors[i % style.colors.length]!);
      col.set([c.r, c.g, c.b], i * 3);
      ph[i] = r() * 6.28;
    }
    g.setAttribute('aOffset', new InstancedBufferAttribute(off, 3));
    g.setAttribute('aColor', new InstancedBufferAttribute(col, 3));
    g.setAttribute('aPhase', new InstancedBufferAttribute(ph, 1));
    const m = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new Vector3() },
        uBox: { value: BOX },
        uFall: { value: style.fall },
        uDrift: { value: style.drift },
        uSize: { value: style.size },
      },
    });
    return { geometry: g, material: m };
  }, [style]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame((_, dt) => {
    material.uniforms.uTime!.value += dt;
    (material.uniforms.uCenter!.value as Vector3).set(pose.x, pose.y + 6, pose.z);
  });
  return <instancedMesh args={[geometry, material, COUNT]} frustumCulled={false} />;
}
