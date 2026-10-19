/**
 * Mutable car simulation state on the XZ plane.
 * Heading convention: heading 0 faces +Z; forward = (sin h, cos h); right = (-cos h, sin h).
 * Positive steer (right) decreases heading.
 */
export interface CarState {
  x: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  /** Previous-step pose, for render interpolation. */
  prevX: number;
  prevZ: number;
  prevHeading: number;
  /** Derived each step: car-local forward / lateral (right +) speed. */
  speedForward: number;
  speedLateral: number;
  /** Current yaw rate (rad/s, + = turning left). */
  yawRate: number;
  /** Current lateral grip coefficient (blends between normal and drift grip). */
  grip: number;
  /** 2.5D vertical state: height of the car's base, vertical speed, air time. */
  y: number;
  prevY: number;
  vy: number;
  airborne: boolean;
  airTime: number;
}

export function createCarState(x = 0, z = 0, heading = 0, grip = 10): CarState {
  return {
    x,
    z,
    heading,
    vx: 0,
    vz: 0,
    prevX: x,
    prevZ: z,
    prevHeading: heading,
    speedForward: 0,
    speedLateral: 0,
    yawRate: 0,
    grip,
    y: 0,
    prevY: 0,
    vy: 0,
    airborne: false,
    airTime: 0,
  };
}

/** Teleports the car and kills all motion (R key / spawn). */
export function resetCarState(s: CarState, x: number, z: number, heading: number, y = 0): void {
  s.x = s.prevX = x;
  s.z = s.prevZ = z;
  s.heading = s.prevHeading = heading;
  s.vx = s.vz = 0;
  s.speedForward = s.speedLateral = 0;
  s.yawRate = 0;
  s.y = s.prevY = y;
  s.vy = 0;
  s.airborne = false;
  s.airTime = 0;
}
