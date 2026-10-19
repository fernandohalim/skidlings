// Chase-style top-down camera tuning (§7 + §0.1: rotates to stay behind the car).
export const CAMERA_CONFIG = {
  fov: 40,
  /** Angle below horizontal. 90 = straight down. */
  pitchDeg: 55,
  baseHeight: 20,
  /** Speed zoom: pulls back up to maxExtraHeight at ~top speed for a sense of velocity. */
  heightPerSpeed: 0.22,
  maxExtraHeight: 6,
  /** Constant look-ahead so the car sits in the lower part of the screen. */
  baseLookAhead: 4,
  /** Extra look-ahead per m/s of forward speed, along the camera's facing. */
  lookAheadFactor: 0.15,
  maxLookAhead: 5,
  /** Smoothing of the look-ahead offset (the car itself is tracked rigidly). */
  followDamping: 4,
  zoomDamping: 3,
  /** How fast the camera follows the car's height (hills, jumps). */
  heightFollowDamping: 3,
  /** How fast the camera yaw catches up to the car (higher = snappier). */
  yawDamping: 3.5,
  /** 0 = follow car heading, 1 = follow travel direction. Blending keeps drifts readable. */
  velocityYawBlend: 0.6,
  /** Below this forward speed the camera follows heading only (avoids flips when reversing). */
  velocityYawMinSpeed: 4,
  /** FOV widens with speed: +speedFovKick degrees at speedFovRef m/s. */
  speedFovKick: 8,
  speedFovRef: 32,
  /** Extra FOV while a mini-boost or nitro is active. */
  nitroFovKick: 6,
  fovDamping: 4,
  /** Decay rates (1/s) of camera shake and the boost FOV punch. */
  shakeDecay: 6,
  fovKickDecay: 3,
  lobbyHeightMultiplier: 1,
};

export type CameraConfig = typeof CAMERA_CONFIG;
