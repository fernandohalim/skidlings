import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, MeshBasicMaterial, type Group, type Mesh } from 'three';
import type { CarSimulation } from '../../engine/car/CarSimulation';
import type { CarRenderPose } from '../sim/CarRenderPose';

// Exhaust flames (§10.10): blue-purple cones behind the car while nitro is held,
// plus a short burst when a mini-boost fires. Bright (>1) colors so the
// optional bloom catches them. Follows the interpolated pose each frame.

const EXHAUST_Z = -2.05;
const EXHAUST_Y = 0.5;
const EXHAUST_X = 0.42;

export function NitroFlame({ sim, pose }: { sim: CarSimulation; pose: CarRenderPose }) {
  const root = useRef<Group>(null);
  const flames = useRef<(Mesh | null)[]>([]);
  const st = useRef({ size: 0, burst: 0, lastBoost: 0 });
  const { outer, inner } = useMemo(
    () => ({
      outer: new MeshBasicMaterial({
        color: new Color(1.6, 0.7, 2.6),
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      inner: new MeshBasicMaterial({
        color: new Color(1.2, 2.2, 2.8),
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    }),
    [],
  );

  useEffect(
    () => () => {
      outer.dispose();
      inner.dispose();
    },
    [outer, inner],
  );

  useFrame(({ clock }, dt) => {
    const s = st.current;
    const d = sim.drift;
    if (d.boostTime > s.lastBoost + 0.05) s.burst = 1; // a mini-boost just fired
    s.lastBoost = d.boostTime;
    s.burst = Math.max(0, s.burst - dt * 2.5);

    const target = sim.nitro.active ? 1 : d.boostTime > 0 ? 0.55 : 0;
    s.size += (target - s.size) * Math.min(1, dt * 14);
    const size = s.size + s.burst * 0.9;

    const g = root.current;
    if (!g) return;
    g.visible = size > 0.02;
    if (!g.visible) return;
    g.position.set(pose.x, pose.y, pose.z);
    g.rotation.order = 'YXZ';
    g.rotation.set(pose.pitch, pose.heading, 0);
    const t = clock.elapsedTime;
    flames.current.forEach((m, i) => {
      if (!m) return;
      const flicker = 0.85 + Math.sin(t * 50 + i * 2.1) * 0.1 + Math.sin(t * 31 + i) * 0.08;
      const len = size * flicker * (i % 2 === 0 ? 1.6 : 1.0);
      m.scale.set(size * 0.9, len, size * 0.9);
      m.position.z = EXHAUST_Z - len * 0.5;
    });
  }, -1);

  const sides = [-EXHAUST_X, EXHAUST_X];
  return (
    <group ref={root} visible={false}>
      {sides.flatMap((x, si) => [
        <mesh
          key={`o${si}`}
          ref={(m) => void (flames.current[si * 2] = m)}
          position={[x, EXHAUST_Y, EXHAUST_Z]}
          rotation-x={-Math.PI / 2}
          material={outer}
          renderOrder={4}
        >
          <coneGeometry args={[0.32, 1, 10, 1, true]} />
        </mesh>,
        <mesh
          key={`i${si}`}
          ref={(m) => void (flames.current[si * 2 + 1] = m)}
          position={[x, EXHAUST_Y, EXHAUST_Z]}
          rotation-x={-Math.PI / 2}
          material={inner}
          renderOrder={5}
        >
          <coneGeometry args={[0.18, 1, 8, 1, true]} />
        </mesh>,
      ])}
    </group>
  );
}
