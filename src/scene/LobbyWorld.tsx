import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  MeshBasicMaterial,
  Object3D,
  type Group,
  type InstancedMesh,
  type Mesh,
} from 'three';
import { WORLD_PALETTE as P } from '../config/graphics.config';
import { LOBBY_CONFIG } from '../config/lobby.config';
import type { ConeField } from '../engine/physics/ConeField';
import type { LobbyLayout } from '../tracks/lobby';
import { getToonMaterial } from './materials/toon';
import { Decorations } from './Track/Decorations';
import { InstancedParts, type Part } from './Track/InstancedParts';
import { PadLabel } from './PadLabel';
import { ToyTown } from './ToyTown';

// The lobby "playmat park" (§8.4): a mat with painted lanes, a soft bumper
// border, glowing race/garage pads with bobbing labels, a drift ring and
// pushable cones.

const MAT_COLORS = ['#A8DD8F', '#9CD585'];

function matParts(): { tiles: Part[]; lanes: Part[] } {
  const h = LOBBY_CONFIG.halfSize;
  const tile = 25;
  const tiles: Part[] = [];
  for (let x = -h; x < h; x += tile) {
    for (let z = -h; z < h; z += tile) {
      const odd = (Math.round((x + h) / tile) + Math.round((z + h) / tile)) % 2;
      tiles.push({
        x: x + tile / 2,
        y: 0.01,
        z: z + tile / 2,
        sx: tile,
        sy: 1,
        sz: tile,
        ry: 0,
        color: MAT_COLORS[odd],
      });
    }
  }
  // Painted playmat lanes: a cross through the middle + a ring road.
  const lanes: Part[] = [];
  for (let z = -h + 10; z < h - 10; z += 6)
    lanes.push({ x: 0, y: 0.02, z, sx: 0.5, sy: 1, sz: 3, ry: 0 });
  for (let x = -h + 10; x < h - 10; x += 6)
    lanes.push({ x, y: 0.02, z: 0, sx: 3, sy: 1, sz: 0.5, ry: 0 });
  return { tiles, lanes };
}

function borderParts(layout: LobbyLayout): Part[] {
  const w = layout.walls;
  const out: Part[] = [];
  const thick = 1.2;
  // Only the 4 border sides get bumpers (later segments are the fountain).
  for (let i = 0; i < Math.min(w.length, 16); i += 4) {
    const ax = w[i]!;
    const az = w[i + 1]!;
    const bx = w[i + 2]!;
    const bz = w[i + 3]!;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.round(len / 6);
    const ry = Math.atan2(bx - ax, bz - az);
    // push blocks outward (walls wind so outward is to the left of travel here)
    const ox = (-(bz - az) / len) * -(thick / 2);
    const oz = ((bx - ax) / len) * -(thick / 2);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      out.push({
        x: ax + (bx - ax) * t + ox,
        y: 0.6,
        z: az + (bz - az) * t + oz,
        sx: thick,
        sy: 1.2,
        sz: len / n + 0.05,
        ry,
        color: k % 2 === 0 ? P.bumperA : P.bumperB,
      });
    }
  }
  return out;
}

function Pad({ pad }: { pad: LobbyLayout['pads'][number] }) {
  const glow = useRef<Mesh>(null);
  const label = useRef<Group>(null);
  const glowMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(pad.color),
        transparent: true,
        opacity: 0.45,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [pad.color],
  );
  useEffect(() => () => glowMat.dispose(), [glowMat]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (glow.current) {
      const s = 1 + Math.sin(t * 2.4) * 0.06;
      glow.current.scale.set(s, s, 1);
      glowMat.opacity = 0.35 + Math.sin(t * 2.4) * 0.12;
    }
    if (label.current) label.current.position.y = 4.2 + Math.sin(t * 1.8 + pad.x) * 0.35;
  });
  const r = LOBBY_CONFIG.padRadius;
  return (
    <group position={[pad.x, 0, pad.z]}>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.04}
        material={getToonMaterial('#FFFFFF')}
        receiveShadow
      >
        <circleGeometry args={[r, 40]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.06} material={getToonMaterial(pad.color)}>
        <ringGeometry args={[r * 0.62, r * 0.92, 40]} />
      </mesh>
      <mesh ref={glow} rotation-x={-Math.PI / 2} position-y={0.08} material={glowMat}>
        <ringGeometry args={[r * 0.95, r * 1.25, 40]} />
      </mesh>
      <group ref={label}>
        <PadLabel text={pad.label} color={pad.color} />
      </group>
    </group>
  );
}

function Cones({ cones }: { cones: ConeField }) {
  const ref = useRef<InstancedMesh>(null);
  const tmp = useMemo(() => new Object3D(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < cones.count; i++) {
      const sp = Math.hypot(cones.vx[i]!, cones.vz[i]!);
      // knocked cones wobble/tilt while sliding
      tmp.position.set(cones.x[i]!, 0.45, cones.z[i]!);
      tmp.rotation.set(Math.min(0.9, sp * 0.08), cones.spin[i]!, 0, 'YXZ');
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, -1);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, getToonMaterial('#FF9F1C'), cones.count]}
      castShadow
      frustumCulled={false}
    >
      <coneGeometry args={[0.45, 0.9, 10]} />
    </instancedMesh>
  );
}

export function LobbyWorld({
  layout,
  cones,
  outlines,
}: {
  layout: LobbyLayout;
  cones: ConeField;
  outlines: boolean;
}) {
  const mat = useMemo(() => matParts(), []);
  const border = useMemo(() => borderParts(layout), [layout]);
  const ring = layout.driftRing;
  return (
    <>
      <InstancedParts
        parts={mat.tiles}
        material={getToonMaterial('#FFFFFF')}
        castShadow={false}
        receiveShadow
      >
        <boxGeometry args={[1, 0.02, 1]} />
      </InstancedParts>
      <InstancedParts
        parts={mat.lanes}
        material={getToonMaterial(P.dash)}
        castShadow={false}
        receiveShadow
      >
        <boxGeometry args={[1, 0.02, 1]} />
      </InstancedParts>
      <InstancedParts
        parts={border}
        material={getToonMaterial('#FFFFFF')}
        outlines={outlines}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      {/* drift practice ring painted on the mat */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[ring.x, 0.03, ring.z]}
        material={getToonMaterial(P.road)}
        receiveShadow
      >
        <ringGeometry args={[ring.radius - 9, ring.radius - 1, 48]} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[ring.x, 0.035, ring.z]}
        material={getToonMaterial(P.curbA)}
      >
        <ringGeometry args={[ring.radius - 9.6, ring.radius - 9, 48]} />
      </mesh>
      {layout.pads.map((p) => (
        <Pad key={p.id} pad={p} />
      ))}
      <Cones cones={cones} />
      <Decorations items={layout.decorations} outlines={outlines} />
      <ToyTown layout={layout} outlines={outlines} />
    </>
  );
}
