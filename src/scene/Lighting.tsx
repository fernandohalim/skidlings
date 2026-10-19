import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Object3D, type DirectionalLight } from 'three';
import { LIGHTING, type QualityPreset } from '../config/graphics.config';
import type { CarRenderPose } from './sim/CarRenderPose';

interface LightingProps {
  quality: QualityPreset;
  /** Shadow camera follows this pose so shadow resolution stays high (§10.10). */
  follow: CarRenderPose;
}

const SUN_OFFSET = { x: 30, y: 60, z: 20 };
const SHADOW_EXTENT = 40;

export function Lighting({ quality, follow }: LightingProps) {
  const shadows = quality.shadowMapSize > 0;
  const sun = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);

  useFrame(() => {
    const l = sun.current;
    if (!l) return;
    l.position.set(follow.x + SUN_OFFSET.x, follow.y + SUN_OFFSET.y, follow.z + SUN_OFFSET.z);
    target.position.set(follow.x, follow.y, follow.z);
    target.updateMatrixWorld();
  }, -1);

  return (
    <>
      <hemisphereLight args={[LIGHTING.skyColor, LIGHTING.groundColor, LIGHTING.hemiIntensity]} />
      <directionalLight
        ref={sun}
        target={target}
        intensity={LIGHTING.sunIntensity}
        color={LIGHTING.sunColor}
        castShadow={shadows}
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={150}
        shadow-bias={-0.0005}
      />
    </>
  );
}
