import { Outlines } from '@react-three/drei';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Color, Object3D, type InstancedMesh, type Material } from 'three';
import { TOON_CONFIG } from '../../config/graphics.config';

/** One instance: position, yaw, scale and optional per-instance color. */
export interface Part {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  ry: number;
  color?: string;
}

interface Props {
  parts: Part[];
  material: Material;
  /** Geometry element, e.g. <boxGeometry args={[1, 1, 1]} />. */
  children: ReactNode;
  outlines?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Renders many copies of one geometry in a single draw call (§13). Per-instance
 * colors multiply the material color, so pass a white material for them.
 */
export function InstancedParts({
  parts,
  material,
  children,
  outlines = false,
  castShadow = true,
  receiveShadow = false,
}: Props) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const d = new Object3D();
    const c = new Color();
    parts.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, p.ry, 0);
      d.scale.set(p.sx, p.sy, p.sz);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (p.color) m.setColorAt(i, c.set(p.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [parts]);

  if (parts.length === 0) return null;
  return (
    <instancedMesh
      key={parts.length}
      ref={ref}
      args={[undefined, material, parts.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {children}
      {outlines && (
        <Outlines thickness={TOON_CONFIG.outlineThickness} color={TOON_CONFIG.outlineColor} />
      )}
    </instancedMesh>
  );
}
