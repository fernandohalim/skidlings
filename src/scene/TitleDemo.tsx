import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, PerspectiveCamera } from 'three';
import { CAMERA_CONFIG } from '../config/camera.config';
import { resolveCarConfig, type CarId } from '../config/car.config';
import { CarSimulation } from '../engine/car/CarSimulation';
import { createInputState } from '../engine/input/types';
import { FixedStepLoop } from '../engine/loop/FixedStepLoop';
import { wrapAngle } from '../engine/utils/math';
import { applyCarPose, createPoseSmoothing } from './Car/carPose';
import { CarVisual, createCarRig, WHEEL_RADIUS } from './Car/CarVisual';
import type { CarRenderPose } from './sim/CarRenderPose';
import { SkidMarks } from './vfx/SkidMarks';
import { DriftSparks } from './vfx/DriftSparks';
import { NitroFlame } from './vfx/NitroFlame';
import { TireSmoke } from './vfx/TireSmoke';

interface Props {
  center: { x: number; z: number; radius: number };
  carId: CarId;
  pose: CarRenderPose;
  outlines: boolean;
}

// Title backdrop (§10.7): a demo car endlessly drifting around the lobby's drift
// ring under a scripted "autopilot", while the camera slowly orbits.

const ORBIT_SPEED = 0.12; // rad/s
const ORBIT_DIST = 38;
const ORBIT_HEIGHT = 22;

export function TitleDemo({ center, carId, pose, outlines }: Props) {
  const sim = useMemo(() => {
    const s = new CarSimulation(resolveCarConfig(carId), undefined, 'lobby');
    // start on the ring, tangent to it (counter-clockwise)
    s.reset(center.x + center.radius - 4, center.z, 0);
    return s;
  }, [carId, center]);
  const input = useMemo(() => createInputState(), []);
  const loop = useMemo(() => new FixedStepLoop(1 / 60, 5), []);
  const rig = useMemo(() => createCarRig(), []);
  const smoothing = useMemo(() => createPoseSmoothing(), []);
  const group = useRef<Group>(null);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const clock = useRef(0);

  useFrame((_, dt) => {
    clock.current += dt;
    const alpha = loop.advance(dt, (h) => {
      const c = sim.car;
      // Steer toward a point ahead on the circle; pulse drift for constant boosts.
      const ang = Math.atan2(c.z - center.z, c.x - center.x) + 0.55;
      const tx = center.x + Math.cos(ang) * (center.radius - 4);
      const tz = center.z + Math.sin(ang) * (center.radius - 4);
      const want = Math.atan2(tx - c.x, tz - c.z);
      const d = wrapAngle(want - c.heading);
      input.steer = Math.max(-1, Math.min(1, -d * 2.5));
      input.throttle = 1;
      const phase = clock.current % 3.4;
      input.drift = phase < 2.8;
      sim.step(input, h);
    });
    const c = sim.car;
    applyCarPose(group.current, pose, c, sim.heights, alpha, dt, smoothing);
    pose.boosting = sim.drift.boostTime > 0;
    pose.alpha = alpha;
    for (const p of rig.steerPivots) p.rotation.y = -input.steer * 0.45;
    for (const w of rig.spinners) w.rotation.x += (c.speedForward * dt) / WHEEL_RADIUS;

    const a = clock.current * ORBIT_SPEED;
    camera.position.set(
      center.x + Math.sin(a) * ORBIT_DIST,
      ORBIT_HEIGHT,
      center.z + Math.cos(a) * ORBIT_DIST,
    );
    camera.lookAt(center.x, 0, center.z);
    if (camera.fov !== CAMERA_CONFIG.fov) {
      camera.fov = CAMERA_CONFIG.fov;
      camera.updateProjectionMatrix();
    }
  }, -2);

  return (
    <>
      <group ref={group}>
        <CarVisual carId={carId} rig={rig} outlines={outlines} />
      </group>
      <SkidMarks sim={sim} pose={pose} />
      <TireSmoke sim={sim} pose={pose} />
      <DriftSparks sim={sim} pose={pose} />
      <NitroFlame sim={sim} pose={pose} />
    </>
  );
}
