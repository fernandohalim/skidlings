import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BackSide, Color, ShaderMaterial, SphereGeometry, type Mesh } from 'three';

const vert = /* glsl */ `
  varying float vY;
  void main() {
    vY = normalize(position).y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const frag = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  varying float vY;
  void main() {
    float t = smoothstep(-0.05, 0.55, vY);
    gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);
  }
`;

/**
 * Gradient sky dome (§10.10): saturated blue overhead fading to a warm
 * horizon that matches the fog. Follows the camera so it never clips.
 */
export function Sky({ top, horizon }: { top: string; horizon: string }) {
  const ref = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera);
  const { geometry, material } = useMemo(
    () => ({
      geometry: new SphereGeometry(450, 24, 12),
      material: new ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uTop: { value: new Color(top) }, uHorizon: { value: new Color(horizon) } },
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    }),
    [top, horizon],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(() => {
    ref.current?.position.copy(camera.position);
  });
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      renderOrder={-10}
      frustumCulled={false}
    />
  );
}
