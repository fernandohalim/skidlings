import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { CAMERA_CONFIG } from '../../config/camera.config';
import { clamp, degToRad, wrapAngle } from '../../engine/utils/math';
import type { RaceController } from '../../engine/race/RaceController';
import { useSettingsStore } from '../../stores/settingsStore';
import type { CarRenderPose } from '../sim/CarRenderPose';
import { fx as juice } from '../sim/fx';

interface TopDownCameraProps {
  pose: CarRenderPose;
  heightMultiplier?: number;
  /** When set, plays the intro sweep while the race is in its intro phase. */
  race?: RaceController | null;
}

/** Intro sweep: starts this many times higher and swung this far around the car. */
const INTRO_HEIGHT_MULT = 3.2;
const INTRO_YAW_SWING = Math.PI * 0.85;
/** Smoothing toward the intro progress, so skipping the intro eases instead of snapping. */
const INTRO_DAMPING = 5;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Runs after the simulation (priority -1 > PlayerCar's -2). */
export const CAMERA_FRAME_PRIORITY = -1;

/**
 * Chase top-down camera: yaw follows the car (blended toward travel direction),
 * target leads ahead with speed, height grows with speed. All smoothing is
 * frame-rate independent: 1 - exp(-k * dt).
 */
export function TopDownCamera({ pose, heightMultiplier = 1, race }: TopDownCameraProps) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const st = useRef({
    x: 0,
    z: 0,
    leadX: 0,
    leadZ: 0,
    y: 0,
    yaw: 0,
    height: 0,
    intro: 1,
    initialized: false,
  });

  useLayoutEffect(() => {
    st.current.initialized = false;
  }, [pose]);

  useFrame((_, rawDt) => {
    const c = CAMERA_CONFIG;
    const s = st.current;
    const dt = Math.min(rawDt, 0.1);

    // Desired yaw: heading, blended toward velocity direction when moving forward.
    let yawTarget = pose.heading;
    if (pose.speedForward > c.velocityYawMinSpeed) {
      const velYaw = Math.atan2(pose.vx, pose.vz);
      yawTarget += wrapAngle(velYaw - pose.heading) * c.velocityYawBlend;
    }

    const speed = Math.hypot(pose.vx, pose.vz);
    const heightTarget =
      (c.baseHeight + Math.min(speed * c.heightPerSpeed, c.maxExtraHeight)) * heightMultiplier;

    if (!s.initialized) {
      s.yaw = yawTarget;
      s.leadX = Math.sin(yawTarget) * c.baseLookAhead;
      s.leadZ = Math.cos(yawTarget) * c.baseLookAhead;
      s.height = heightTarget;
      s.y = pose.y;
      s.initialized = true;
    }

    s.yaw += wrapAngle(yawTarget - s.yaw) * (1 - Math.exp(-c.yawDamping * dt));
    s.yaw = wrapAngle(s.yaw);
    s.height += (heightTarget - s.height) * (1 - Math.exp(-c.zoomDamping * dt));

    // Intro sweep: high and swung around, easing down behind the car.
    const introTarget = race ? race.introProgress : 1;
    s.intro =
      introTarget < s.intro
        ? introTarget // restart: jump back to the start of the sweep
        : s.intro + (introTarget - s.intro) * (1 - Math.exp(-INTRO_DAMPING * dt));
    const sweep = 1 - easeInOutCubic(Math.min(1, s.intro));
    const yaw = s.yaw + sweep * INTRO_YAW_SWING;
    const height = s.height * (1 + sweep * (INTRO_HEIGHT_MULT - 1));

    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const lead =
      c.baseLookAhead +
      clamp(Math.max(0, pose.speedForward) * c.lookAheadFactor, 0, c.maxLookAhead);
    // Track the car rigidly and smooth only the look-ahead offset, so the car
    // never lags toward the screen edge at high speed.
    const kFollow = 1 - Math.exp(-c.followDamping * dt);
    s.leadX += (fx * lead - s.leadX) * kFollow;
    s.leadZ += (fz * lead - s.leadZ) * kFollow;
    s.x = pose.x + s.leadX;
    s.z = pose.z + s.leadZ;

    const back = height / Math.tan(degToRad(c.pitchDeg));
    // Shake: decaying jitter from boosts / hard hits (fx.ts already applied settings).
    juice.shake *= Math.exp(-c.shakeDecay * dt);
    const t = performance.now() / 1000;
    const shX = juice.shake * (Math.sin(t * 61) + Math.sin(t * 37) * 0.5) * 0.35;
    const shY = juice.shake * Math.sin(t * 53) * 0.25;
    // 2.5D: follow the car's height smoothly (airtime shouldn't yank the view).
    s.y += (pose.y - s.y) * (1 - Math.exp(-c.heightFollowDamping * dt));
    camera.position.set(s.x - fx * back + shX, s.y + height + shY, s.z - fz * back);
    camera.lookAt(s.x + shX * 0.5, s.y, s.z);

    // Speed / boost FOV kick (sense of speed). Reduce motion keeps the FOV fixed.
    juice.fovKick *= Math.exp(-c.fovKickDecay * dt);
    const calm = useSettingsStore.getState().reduceMotion;
    const fovTarget = calm
      ? c.fov
      : c.fov +
        c.speedFovKick * clamp(speed / c.speedFovRef, 0, 1) +
        (pose.boosting ? c.nitroFovKick : 0) +
        juice.fovKick;
    const fov = camera.fov + (fovTarget - camera.fov) * (1 - Math.exp(-c.fovDamping * dt));
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, CAMERA_FRAME_PRIORITY);

  return null;
}
