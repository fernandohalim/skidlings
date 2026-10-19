import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  OctahedronGeometry,
  ShaderMaterial,
  type InstancedMesh,
} from 'three';
import type { CarSimulation } from '../../engine/car/CarSimulation';
import type { CarRenderPose } from '../sim/CarRenderPose';

// Tier-colored sparks spraying from the rear wheels while a drift is charged
// (§10.10): blue → orange → pink/purple. Ballistic motion + fade run in the
// vertex shader from per-instance birth time, velocity and color; the CPU only
// writes newly spawned sparks. Colors exceed 1.0 so bloom picks them up.

const MAX = 220;
const LIFE = 0.45;
const RATE = 90; // sparks per second per wheel
const REAR_X = 0.98;
const REAR_Z = -1.35;
const GRAVITY = 14;

const TIER_RGB: [number, number, number][] = [
  [0, 0, 0],
  [0.4, 1.6, 2.4], // blue
  [2.4, 1.3, 0.25], // orange
  [2.4, 0.6, 2.2], // pink/purple
];

const vertexShader = /* glsl */ `
  attribute float aBirth;
  attribute vec3 aOrigin;
  attribute vec3 aVel;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float age = uTime - aBirth;
    float t = clamp(age / ${LIFE.toFixed(2)}, 0.0, 1.0);
    vAlpha = age < 0.0 ? 0.0 : 1.0 - t;
    vColor = aColor;
    vec3 p = aOrigin + aVel * age + vec3(0.0, -0.5 * ${GRAVITY.toFixed(1)} * age * age, 0.0);
    p.y = max(p.y, 0.05);
    float s = mix(1.0, 0.2, t);
    gl_Position = projectionMatrix * viewMatrix * vec4(p + position * s, 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    if (vAlpha <= 0.01) discard;
    gl_FragColor = vec4(vColor * vAlpha, vAlpha);
  }
`;

export function DriftSparks({ sim, pose }: { sim: CarSimulation; pose: CarRenderPose }) {
  const mesh = useRef<InstancedMesh>(null);
  const { geometry, material, attrs } = useMemo(() => {
    const g = new OctahedronGeometry(0.09, 0);
    const mk = (n: number, fill = 0) => {
      const a = new InstancedBufferAttribute(new Float32Array(MAX * n).fill(fill), n);
      a.setUsage(DynamicDrawUsage);
      return a;
    };
    const attrs = { birth: mk(1, -1e6), origin: mk(3), vel: mk(3), color: mk(3) };
    g.setAttribute('aBirth', attrs.birth);
    g.setAttribute('aOrigin', attrs.origin);
    g.setAttribute('aVel', attrs.vel);
    g.setAttribute('aColor', attrs.color);
    const m = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return { geometry: g, material: m, attrs };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const st = useRef({ time: 0, carry: 0, next: 0, seed: 1 });

  useFrame((_, dt) => {
    const s = st.current;
    s.time += dt;
    material.uniforms.uTime!.value = s.time;
    const tier = sim.drift.drifting && !pose.airborne ? sim.drift.tier : 0;
    if (tier === 0) {
      s.carry = 0;
      return;
    }
    s.carry += RATE * dt;
    const count = Math.floor(s.carry);
    if (count === 0) return;
    s.carry -= count;

    const h = pose.heading;
    const c = Math.cos(h);
    const sn = Math.sin(h);
    const rgb = TIER_RGB[tier]!;
    const rnd = () => {
      s.seed = (s.seed * 16807) % 2147483647;
      return s.seed / 2147483647;
    };
    for (let k = 0; k < count; k++) {
      for (let w = 0; w < 2; w++) {
        const lx = w === 0 ? REAR_X : -REAR_X;
        const i = s.next;
        const ox = pose.x + lx * c + REAR_Z * sn;
        const oz = pose.z - lx * sn + REAR_Z * c;
        attrs.origin.setXYZ(i, ox, pose.y + 0.15, oz);
        // spray backward + outward with randomness
        const back = 3 + rnd() * 4;
        const side = (rnd() - 0.5) * 5 + Math.sign(lx) * 1.5;
        attrs.vel.setXYZ(
          i,
          -sn * back + side * c + pose.vx * 0.3,
          2.5 + rnd() * 3.5,
          -c * back - side * sn + pose.vz * 0.3,
        );
        attrs.color.setXYZ(i, rgb[0], rgb[1], rgb[2]);
        attrs.birth.setX(i, s.time - rnd() * dt);
        s.next = (s.next + 1) % MAX;
      }
    }
    attrs.birth.needsUpdate = true;
    attrs.origin.needsUpdate = true;
    attrs.vel.needsUpdate = true;
    attrs.color.needsUpdate = true;
  }, -1);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, MAX]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}
