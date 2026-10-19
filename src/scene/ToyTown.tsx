import { Outlines } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  MeshToonMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Group,
} from 'three';
import { TOON_CONFIG } from '../config/graphics.config';
import type { LobbyLayout } from '../tracks/lobby';
import { getToonGradient, getToonMaterial } from './materials/toon';
import { InstancedParts, type Part } from './Track/InstancedParts';

// Toy Town (the lobby theme): a skyline of chunky toy buildings with windows
// and pointy roofs, a splashing fountain, and chevron practice ramps.

function buildingParts(layout: LobbyLayout) {
  const bodies: Part[] = [];
  const roofs: Part[] = [];
  const windows: Part[] = [];
  for (const b of layout.buildings) {
    bodies.push({
      x: b.x,
      y: b.h / 2,
      z: b.z,
      sx: b.w,
      sy: b.h,
      sz: b.d,
      ry: b.rotation,
      color: b.color,
    });
    roofs.push({
      x: b.x,
      y: b.h + 2,
      z: b.z,
      sx: b.w * 0.78,
      sy: 4,
      sz: b.d * 0.78,
      ry: b.rotation + Math.PI / 4,
      color: b.roof,
    });
    // windows on the face pointing toward the playmat (local -Z after rotation)
    const rows = Math.max(1, Math.floor((b.h - 2) / 3.2));
    const cols = Math.max(1, Math.floor(b.w / 3));
    const c = Math.cos(b.rotation);
    const s = Math.sin(b.rotation);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const lx = (k - (cols - 1) / 2) * 2.8;
        const lz = -b.d / 2 - 0.05;
        windows.push({
          x: b.x + lx * c + lz * s,
          y: 2.2 + r * 3.2,
          z: b.z - lx * s + lz * c,
          sx: 1.4,
          sy: 1.7,
          sz: 0.2,
          ry: b.rotation,
          color: (r + k) % 3 === 0 ? '#FFF4C2' : '#BFE9FF',
        });
      }
    }
  }
  return { bodies, roofs, windows };
}

/** Triangular-prism wedge: foot at local z=0, lip (full height) at z=length. */
function wedgeGeometry(length: number, width: number, height: number): BufferGeometry {
  const w = width / 2;
  // 6 corners: foot-left/right on the ground, lip-left/right top + bottom
  const v = [
    [-w, 0, 0],
    [w, 0, 0],
    [-w, height, length],
    [w, height, length],
    [-w, 0, length],
    [w, 0, length],
  ];
  const tri = (a: number, b: number, c: number) => [...v[a]!, ...v[b]!, ...v[c]!];
  // slope (UV for chevrons), back face, sides
  const pos = [
    ...tri(0, 2, 1),
    ...tri(1, 2, 3),
    ...tri(4, 5, 2),
    ...tri(5, 3, 2),
    ...tri(0, 4, 2),
    ...tri(1, 3, 5),
  ];
  const uv = [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, ...new Array(24).fill(0)];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.computeVertexNormals();
  return g;
}

function chevrons(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFC933';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#2B2340';
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
  t.repeat.set(3, 3);
  return t;
}

function Fountain({
  x,
  z,
  radius,
  outlines,
}: {
  x: number;
  z: number;
  radius: number;
  outlines: boolean;
}) {
  const jet = useRef<Group>(null);
  useFrame(({ clock }) => {
    const j = jet.current;
    if (!j) return;
    const t = clock.elapsedTime;
    j.scale.set(1, 1 + Math.sin(t * 6) * 0.08, 1);
    j.rotation.y = t * 0.6;
  });
  const ol = outlines ? (
    <Outlines thickness={TOON_CONFIG.outlineThickness} color={TOON_CONFIG.outlineColor} />
  ) : null;
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.5} material={getToonMaterial('#FFFFFF')} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius + 0.4, 1, 24]} />
        {ol}
      </mesh>
      <mesh position-y={0.92} material={getToonMaterial('#3BB7F0')}>
        <cylinderGeometry args={[radius - 0.6, radius - 0.6, 0.1, 24]} />
      </mesh>
      <mesh position-y={1.8} material={getToonMaterial('#FF8FB1')} castShadow>
        <cylinderGeometry args={[0.8, 1.2, 2, 12]} />
        {ol}
      </mesh>
      <mesh position-y={2.9} material={getToonMaterial('#FFFFFF')}>
        <cylinderGeometry args={[2.2, 1.4, 0.4, 16]} />
        {ol}
      </mesh>
      <group ref={jet} position-y={3}>
        <mesh position-y={1.4} material={getToonMaterial('#8FD8FF')}>
          <coneGeometry args={[0.6, 2.8, 8]} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <mesh
            key={k}
            position={[Math.cos((k * Math.PI) / 3) * 1.4, 0.4, Math.sin((k * Math.PI) / 3) * 1.4]}
            material={getToonMaterial('#BFE9FF')}
          >
            <sphereGeometry args={[0.35, 8, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function ToyTown({ layout, outlines }: { layout: LobbyLayout; outlines: boolean }) {
  const parts = useMemo(() => buildingParts(layout), [layout]);
  const ramps = useMemo(() => {
    const mat = new MeshToonMaterial({ map: chevrons(), gradientMap: getToonGradient() });
    const geos = layout.ramps.map((r) => wedgeGeometry(r.length, r.width, r.height));
    return { mat, geos };
  }, [layout]);
  useEffect(
    () => () => {
      ramps.mat.map?.dispose();
      ramps.mat.dispose();
      ramps.geos.forEach((g) => g.dispose());
    },
    [ramps],
  );
  const white = getToonMaterial('#FFFFFF');

  return (
    <>
      <InstancedParts parts={parts.bodies} material={white} outlines={outlines} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      <InstancedParts parts={parts.roofs} material={white} outlines={outlines}>
        <coneGeometry args={[0.72, 1, 4]} />
      </InstancedParts>
      <InstancedParts parts={parts.windows} material={white} castShadow={false}>
        <boxGeometry args={[1, 1, 1]} />
      </InstancedParts>
      {layout.ramps.map((r, i) => (
        <mesh
          key={i}
          geometry={ramps.geos[i]}
          material={ramps.mat}
          position={[r.x, 0, r.z]}
          rotation-y={r.heading}
          castShadow
          receiveShadow
        />
      ))}
      <Fountain {...layout.fountain} outlines={outlines} />
    </>
  );
}
