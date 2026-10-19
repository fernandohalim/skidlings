/**
 * Interpolated player pose written once per frame by PlayerCar and read by
 * the camera / lighting. Plain mutable object: never put this in React state.
 */
export interface CarRenderPose {
  x: number;
  /** 2.5D height of the car's base. */
  y: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  speedForward: number;
  speedLateral: number;
  /** Mini-boost or nitro active (camera FOV kick). */
  boosting: boolean;
  /** Fixed-step interpolation alpha of the current frame (shared with bot rendering). */
  alpha: number;
  airborne: boolean;
  /** Visual pitch (rad, nose up negative). */
  pitch: number;
}

export function createCarRenderPose(): CarRenderPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    vx: 0,
    vz: 0,
    speedForward: 0,
    speedLateral: 0,
    boosting: false,
    alpha: 0,
    airborne: false,
    pitch: 0,
  };
}
