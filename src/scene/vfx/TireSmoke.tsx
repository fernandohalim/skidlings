import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  Matrix4,
  ShaderMaterial,
  type InstancedMesh,
} from 'three';
import type { CarSimulation } from '../../engine/car/CarSimulation';
import type { CarRenderPose } from '../sim/CarRenderPose';

// Soft white puffs from the rear wheels while drifting. Growth, rise and fade
// all happen in the vertex shader from a per-instance birth time.

const MAX_PUFFS = 90;
const LIFE = 0.9;
const SPAWN_INTERVAL = 0.035;
const REAR_X = 0.98;
const REAR_Z = -1.5;

const vertexShader = /* glsl */ `
  attribute float aBirth;
  uniform float uTime;
  varying float vAlpha;
  varying vec3 vNormal;
  void main() {
    float t = clamp((uTime - aBirth) / ${LIFE.toFixed(2)}, 0.0, 1.0);
    float scale = mix(0.35, 1.5, sqrt(t));
    vAlpha = (1.0 - t) * 0.75;
    vec4 world = instanceMatrix * vec4(position * scale, 1.0);
    world.y += t * 1.4;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * world;
  }
`;
const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vNormal;
  void main() {
    if (vAlpha <= 0.01) discard;
    // two-band toon shade so puffs match the cel look
    float l = dot(normalize(vNormal), normalize(vec3(0.3, 1.0, 0.4)));
    vec3 c = l > 0.2 ? vec3(1.0) : vec3(0.86, 0.88, 0.94);
    gl_FragColor = vec4(c, vAlpha);
  }
`;

interface Props {
  sim: CarSimulation;
  pose: CarRenderPose;
}

export function TireSmoke({ sim, pose }: Props) {
  const mesh = useRef<InstancedMesh>(null);
  const { geometry, material, birth } = useMemo(() => {
    const g = new IcosahedronGeometry(0.5, 1);
    const b = new InstancedBufferAttribute(new Float32Array(MAX_PUFFS).fill(-1e6), 1);
    b.setUsage(DynamicDrawUsage);
    g.setAttribute('aBirth', b);
    const m = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    return { geometry: g, material: m, birth: b };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const st = useRef({ time: 0, cooldown: 0, next: 0, mat: new Matrix4() });

  useFrame((_, dt) => {
    const s = st.current;
    s.time += dt;
    material.uniforms.uTime!.value = s.time;
    const m = mesh.current;
    if (!m || !sim.drift.drifting || pose.airborne) return;
    s.cooldown -= dt;
    if (s.cooldown > 0) return;
    s.cooldown = SPAWN_INTERVAL;

    const h = pose.heading;
    const c = Math.cos(h);
    const sn = Math.sin(h);
    for (let w = 0; w < 2; w++) {
      const lx = w === 0 ? REAR_X : -REAR_X;
      const jitter = ((s.next * 7919) % 100) / 100 - 0.5;
      s.mat.makeTranslation(
        pose.x + lx * c + REAR_Z * sn + jitter * 0.3,
        pose.y + 0.35,
        pose.z - lx * sn + REAR_Z * c - jitter * 0.3,
      );
      m.setMatrixAt(s.next, s.mat);
      birth.array[s.next] = s.time;
      s.next = (s.next + 1) % MAX_PUFFS;
    }
    m.instanceMatrix.needsUpdate = true;
    birth.needsUpdate = true;
  }, -1);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, MAX_PUFFS]}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}
