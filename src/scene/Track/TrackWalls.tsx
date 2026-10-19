import { Outlines } from '@react-three/drei';
import { useLayoutEffect, useRef } from 'react';
import { Color, Object3D, type InstancedMesh } from 'three';
import { TOON_CONFIG } from '../../config/graphics.config';
import { TRACK_CONFIG } from '../../config/track.config';
import type { TrackData } from '../../engine/track/TrackDefinition';
import { getToonMaterial } from '../materials/toon';

/** Soft toy bumper blocks along both walls: one instanced draw (+ outline). */
export function TrackWalls({ track, outlines }: { track: TrackData; outlines: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const count = track.wallBlocks.length;

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const d = new Object3D();
    const colors = [new Color(track.def.theme.bumperA), new Color(track.def.theme.bumperB)];
    track.wallBlocks.forEach((b, i) => {
      d.position.set(b.x, b.y + TRACK_CONFIG.bumperHeight / 2, b.z);
      d.rotation.set(0, b.rotation, 0);
      d.scale.set(TRACK_CONFIG.bumperThickness, TRACK_CONFIG.bumperHeight, b.length);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, colors[b.color]!);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [track]);

  return (
    <instancedMesh
      key={count}
      ref={mesh}
      args={[undefined, getToonMaterial('#FFFFFF'), count]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      {outlines && (
        <Outlines thickness={TOON_CONFIG.outlineThickness} color={TOON_CONFIG.outlineColor} />
      )}
    </instancedMesh>
  );
}
