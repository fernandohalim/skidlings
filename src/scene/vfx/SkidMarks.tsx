import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Color,
  type InstancedMesh,
} from 'three';
import type { CarSimulation } from '../../engine/car/CarSimulation';
import type { CarRenderPose } from '../sim/CarRenderPose';

// Ring buffer of instanced quads. Fade is computed on the GPU from each
// mark's birth time, so the CPU only writes the newest marks (§13).

const MAX_MARKS = 700;
const LIFE = 6; // seconds (§10.10)
const FADE = 1.5;
const WIDTH = 0.38;
const MIN_SPACING = 0.5;
const REAR_X = 0.98;
const REAR_Z = -1.3;

const vertexShader = /* glsl */ `
  attribute float aBirth;
  uniform float uTime;
  varying float vAlpha;
  void main() {
    float age = uTime - aBirth;
    vAlpha = clamp((${LIFE.toFixed(1)} - age) / ${FADE.toFixed(1)}, 0.0, 1.0) * 0.55;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    if (vAlpha <= 0.0) discard;
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;

interface Props {
  sim: CarSimulation;
  pose: CarRenderPose;
}

export function SkidMarks({ sim, pose }: Props) {
  const mesh = useRef<InstancedMesh>(null);
  const { geometry, material, birth } = useMemo(() => {
    const g = new PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const b = new InstancedBufferAttribute(new Float32Array(MAX_MARKS).fill(-1e6), 1);
    b.setUsage(DynamicDrawUsage);
    g.setAttribute('aBirth', b);
    const m = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 }, uColor: { value: new Color('#3B3846') } },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
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

  const st = useRef({ time: 0, next: 0, last: [NaN, NaN, NaN, NaN], dummy: new Object3D() });

  useFrame((_, dt) => {
    const s = st.current;
    s.time += dt;
    material.uniforms.uTime!.value = s.time;
    const m = mesh.current;
    if (!m) return;

    if (!sim.drift.drifting || pose.airborne) {
      s.last[0] = NaN;
      s.last[2] = NaN;
      return;
    }
    const h = pose.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    let wrote = false;
    for (let w = 0; w < 2; w++) {
      const lx = w === 0 ? REAR_X : -REAR_X;
      // local +X → world (cos h, -sin h); local +Z → (sin h, cos h)
      const x = pose.x + lx * Math.cos(h) + REAR_Z * fx;
      const z = pose.z - lx * Math.sin(h) + REAR_Z * fz;
      const px = s.last[w * 2]!;
      const pz = s.last[w * 2 + 1]!;
      if (Number.isNaN(px)) {
        s.last[w * 2] = x;
        s.last[w * 2 + 1] = z;
        continue;
      }
      const dx = x - px;
      const dz = z - pz;
      const len = Math.hypot(dx, dz);
      if (len < MIN_SPACING) continue;
      const d = s.dummy;
      d.position.set((x + px) / 2, pose.y + 0.04, (z + pz) / 2);
      d.rotation.set(0, Math.atan2(dx, dz), 0);
      d.scale.set(WIDTH, 1, len);
      d.updateMatrix();
      m.setMatrixAt(s.next, d.matrix);
      birth.array[s.next] = s.time;
      s.next = (s.next + 1) % MAX_MARKS;
      s.last[w * 2] = x;
      s.last[w * 2 + 1] = z;
      wrote = true;
    }
    if (wrote) {
      m.instanceMatrix.needsUpdate = true;
      birth.needsUpdate = true;
    }
  }, -1);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, MAX_MARKS]}
      frustumCulled={false}
      renderOrder={1}
    />
  );
}
