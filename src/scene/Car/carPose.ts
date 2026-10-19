import type { Group } from 'three';
import type { CarState } from '../../engine/car/types';
import type { HeightField } from '../../engine/physics/HeightField';
import { lerp, wrapAngle } from '../../engine/utils/math';
import type { CarRenderPose } from '../sim/CarRenderPose';

/** Per-car smoothing state for the visual pose. */
export interface PoseSmoothing {
  pitch: number;
  squash: number;
  wasAirborne: boolean;
}

export function createPoseSmoothing(): PoseSmoothing {
  return { pitch: 0, squash: 0, wasAirborne: false };
}

const HALF_WHEELBASE = 1.6;

/**
 * Interpolates a car's simulated state into `pose` and its scene group:
 * position (incl. 2.5D height), yaw, pitch that follows the slope on the
 * ground or the flight path in the air, and a squash on landing.
 */
export function applyCarPose(
  group: Group | null,
  pose: CarRenderPose,
  c: CarState,
  heights: HeightField,
  alpha: number,
  dt: number,
  st: PoseSmoothing,
): void {
  pose.x = lerp(c.prevX, c.x, alpha);
  pose.z = lerp(c.prevZ, c.z, alpha);
  pose.y = lerp(c.prevY, c.y, alpha);
  pose.heading = c.prevHeading + wrapAngle(c.heading - c.prevHeading) * alpha;
  pose.vx = c.vx;
  pose.vz = c.vz;
  pose.speedForward = c.speedForward;
  pose.speedLateral = c.speedLateral;
  pose.airborne = c.airborne;

  // Pitch: nose up = negative rotation.x (local +Z is forward).
  let target: number;
  if (c.airborne) {
    target = -Math.max(-0.35, Math.min(0.35, c.vy * 0.025));
  } else {
    const fx = Math.sin(pose.heading) * HALF_WHEELBASE;
    const fz = Math.cos(pose.heading) * HALF_WHEELBASE;
    const ahead = heights.heightAt(pose.x + fx, pose.z + fz);
    const behind = heights.heightAt(pose.x - fx, pose.z - fz);
    target = -Math.atan2(ahead - behind, HALF_WHEELBASE * 2);
  }
  st.pitch += (target - st.pitch) * Math.min(1, dt * (c.airborne ? 4 : 14));
  if (st.wasAirborne && !c.airborne) st.squash = 1;
  st.wasAirborne = c.airborne;
  st.squash = Math.max(0, st.squash - dt * 5);
  pose.pitch = st.pitch;

  if (group) {
    group.position.set(pose.x, pose.y, pose.z);
    group.rotation.order = 'YXZ';
    group.rotation.set(st.pitch, pose.heading, 0);
    const sq = st.squash * 0.18;
    group.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  }
}
