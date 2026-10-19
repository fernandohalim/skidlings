import { Outlines } from '@react-three/drei';
import type { Group } from 'three';
import { CAR_PRESETS, type CarId } from '../../config/car.config';
import { TOON_CONFIG } from '../../config/graphics.config';
import { getToonVertexColorMaterial } from '../materials/toon';
import { getCarGeometry, WHEEL_RADIUS } from './carGeometry';

export { WHEEL_RADIUS } from './carGeometry';

/** Handles PlayerCar animates each frame (front-wheel steer, wheel spin, body lean). */
export interface CarRig {
  steerPivots: Group[];
  spinners: Group[];
  body: Group | null;
}

export function createCarRig(): CarRig {
  return { steerPivots: [], spinners: [], body: null };
}

interface CarVisualProps {
  carId: CarId;
  rig: CarRig;
  outlines: boolean;
  /** Paint override (AI cars); defaults to the preset color. */
  color?: string;
}

interface WheelSpot {
  x: number;
  z: number;
  front: boolean;
}

const WHEELS: WheelSpot[] = [
  { x: 0.98, z: 1.3, front: true },
  { x: -0.98, z: 1.3, front: true },
  { x: 0.98, z: -1.3, front: false },
  { x: -0.98, z: -1.3, front: false },
];

/**
 * Low-poly toy car (local frame: +Z forward, +Y up). Static parts are merged
 * into 2 vertex-colored meshes + 4 wheels, so a car costs ~11 draw calls with
 * outlines instead of ~35 (see carGeometry.ts).
 */
export function CarVisual({ carId, rig, outlines, color }: CarVisualProps) {
  const geo = getCarGeometry(carId, color ?? CAR_PRESETS[carId].color);
  const mat = getToonVertexColorMaterial();
  rig.steerPivots.length = 0;
  rig.spinners.length = 0;
  const outline = outlines ? (
    <Outlines thickness={TOON_CONFIG.outlineThickness} color={TOON_CONFIG.outlineColor} />
  ) : null;

  return (
    <group>
      <group ref={(g) => void (rig.body = g)}>
        <mesh geometry={geo.shell} material={mat} castShadow>
          {outline}
        </mesh>
        <mesh geometry={geo.detail} material={mat} />
      </group>

      {WHEELS.map((w, i) => (
        <group
          key={i}
          position={[w.x, WHEEL_RADIUS, w.z]}
          ref={(g) => {
            if (g && w.front && !rig.steerPivots.includes(g)) rig.steerPivots.push(g);
          }}
        >
          <group
            ref={(g) => {
              if (g && !rig.spinners.includes(g)) rig.spinners.push(g);
            }}
          >
            <mesh geometry={w.x > 0 ? geo.wheelLeft : geo.wheelRight} material={mat} castShadow>
              {outline}
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
