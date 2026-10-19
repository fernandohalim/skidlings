import { Outlines } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, type Group } from 'three';
import { TOON_CONFIG } from '../../config/graphics.config';
import type { Landmark, TrackData } from '../../engine/track/TrackDefinition';
import { getToonMaterial as M } from '../materials/toon';

// Big hand-placed set pieces that make each track memorable.

interface Ctx {
  outlines: boolean;
}

function Ol({ on }: { on: boolean }) {
  return on ? (
    <Outlines thickness={TOON_CONFIG.outlineThickness} color={TOON_CONFIG.outlineColor} />
  ) : null;
}

function Lighthouse({ outlines }: Ctx) {
  const beam = useRef<Group>(null);
  const beamMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(2.2, 2.0, 1.2),
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useFrame((_, dt) => {
    if (beam.current) beam.current.rotation.y += dt * 0.9;
  });
  const bands: ReactNode[] = [];
  for (let k = 0; k < 5; k++) {
    const r0 = 3.2 - k * 0.35;
    bands.push(
      <mesh
        key={k}
        position-y={1.6 + k * 3.2}
        material={M(k % 2 === 0 ? '#FF4B33' : '#FFFFFF')}
        castShadow
      >
        <cylinderGeometry args={[r0 - 0.35, r0, 3.2, 16]} />
        <Ol on={outlines} />
      </mesh>,
    );
  }
  return (
    <group>
      <mesh position-y={0.5} material={M('#8E93A6')} castShadow>
        <cylinderGeometry args={[4.2, 4.6, 1, 16]} />
        <Ol on={outlines} />
      </mesh>
      {bands}
      <mesh position-y={17.6} material={M('#FFF4C2')}>
        <cylinderGeometry args={[1.6, 1.6, 2, 12]} />
      </mesh>
      <mesh position-y={19.3} material={M('#FF4B33')} castShadow>
        <coneGeometry args={[2.2, 1.8, 12]} />
        <Ol on={outlines} />
      </mesh>
      <group ref={beam} position-y={17.6}>
        <mesh position-x={14} rotation-z={Math.PI / 2} material={beamMat}>
          <coneGeometry args={[3, 28, 12, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

function Windmill({ outlines }: Ctx) {
  const blades = useRef<Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 0.8;
  });
  return (
    <group>
      <mesh position-y={5} material={M('#FFF1DC')} castShadow>
        <cylinderGeometry args={[1.8, 3, 10, 8]} />
        <Ol on={outlines} />
      </mesh>
      <mesh position-y={11} material={M('#FF4B33')} castShadow>
        <coneGeometry args={[2.6, 3, 8]} />
        <Ol on={outlines} />
      </mesh>
      <mesh position={[0, 3.2, 2.9]} material={M('#7A4A2A')}>
        <boxGeometry args={[1.4, 2.4, 0.3]} />
      </mesh>
      <group ref={blades} position={[0, 9.5, 2.4]}>
        <mesh material={M('#2B2340')}>
          <cylinderGeometry args={[0.45, 0.45, 0.8, 8]} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation-z={(k * Math.PI) / 2}>
            <mesh position-y={3.6} material={M('#FFFFFF')} castShadow>
              <boxGeometry args={[1.4, 6.4, 0.15]} />
              <Ol on={outlines} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Mesa({ outlines }: Ctx) {
  const layers = ['#B9502C', '#E07B3C', '#C45E33', '#EFA45C', '#B9502C'];
  return (
    <group>
      {layers.map((c, k) => (
        <mesh key={k} position-y={2.5 + k * 4.6} material={M(c)} castShadow receiveShadow>
          <cylinderGeometry args={[13 - k * 1.2, 14 - k * 1.1, 4.6, 9]} />
          <Ol on={outlines} />
        </mesh>
      ))}
    </group>
  );
}

function ArchRock({ outlines }: Ctx) {
  return (
    <group>
      {[-6, 6].map((x) => (
        <mesh key={x} position={[x, 4.5, 0]} material={M('#C45E33')} castShadow>
          <cylinderGeometry args={[2.2, 3, 9, 7]} />
          <Ol on={outlines} />
        </mesh>
      ))}
      <mesh position-y={9} rotation-x={Math.PI / 2} material={M('#B9502C')} castShadow>
        <torusGeometry args={[6, 2.2, 7, 12, Math.PI]} />
        <Ol on={outlines} />
      </mesh>
    </group>
  );
}

function Boat({ outlines, seed }: Ctx & { seed: number }) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime + seed;
    g.current.position.y = Math.sin(t * 1.3) * 0.25;
    g.current.rotation.z = Math.sin(t * 0.9) * 0.06;
    g.current.rotation.x = Math.cos(t * 1.1) * 0.04;
  });
  return (
    <group ref={g}>
      <mesh position-y={0.5} material={M('#FFFFFF')} castShadow>
        <boxGeometry args={[3, 1.4, 8]} />
        <Ol on={outlines} />
      </mesh>
      <mesh position-y={1.3} material={M('#2E8BF1')}>
        <boxGeometry args={[3.05, 0.3, 8.05]} />
      </mesh>
      <mesh position-y={5} material={M('#A0673A')}>
        <cylinderGeometry args={[0.15, 0.15, 7.5, 6]} />
      </mesh>
      <mesh position={[0, 5, -1.6]} rotation-y={Math.PI / 2} material={M('#FFF8EE')} castShadow>
        <coneGeometry args={[2.6, 6, 3]} />
        <Ol on={outlines} />
      </mesh>
    </group>
  );
}

function BigTree({ outlines }: Ctx) {
  return (
    <group>
      <mesh position-y={3.5} material={M('#8A5530')} castShadow>
        <cylinderGeometry args={[1, 1.6, 7, 8]} />
        <Ol on={outlines} />
      </mesh>
      {[
        [0, 9, 0, 5.5],
        [3, 8, 1.5, 3.8],
        [-3, 8.5, -1, 4],
        [1, 12, -1, 3.6],
      ].map(([x, y, z, r], k) => (
        <mesh
          key={k}
          position={[x!, y!, z!]}
          material={M(k % 2 ? '#6CCB6E' : '#4CB963')}
          castShadow
        >
          <icosahedronGeometry args={[r!, 1]} />
          <Ol on={outlines} />
        </mesh>
      ))}
    </group>
  );
}

function LandmarkView({
  l,
  track,
  outlines,
  i,
}: {
  l: Landmark;
  track: TrackData;
  outlines: boolean;
  i: number;
}) {
  const y =
    l.kind === 'boat' ? (track.terrain.seaLevel ?? 0) : track.terrain.heightAt(l.x, l.z) - 0.2;
  const s = l.scale ?? 1;
  const ctx = { outlines };
  return (
    <group position={[l.x, y, l.z]} rotation-y={l.rotation ?? 0} scale={s}>
      {l.kind === 'lighthouse' && <Lighthouse {...ctx} />}
      {l.kind === 'windmill' && <Windmill {...ctx} />}
      {l.kind === 'mesa' && <Mesa {...ctx} />}
      {l.kind === 'archRock' && <ArchRock {...ctx} />}
      {l.kind === 'boat' && <Boat {...ctx} seed={i * 1.7} />}
      {l.kind === 'bigTree' && <BigTree {...ctx} />}
    </group>
  );
}

export function Landmarks({ track, outlines }: { track: TrackData; outlines: boolean }) {
  return (
    <>
      {(track.def.landmarks ?? []).map((l, i) => (
        <LandmarkView key={i} i={i} l={l} track={track} outlines={outlines} />
      ))}
    </>
  );
}
