import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Shared "juice" impulses (§10.8) written by gameplay feedback and read by the
 * camera. Plain mutable object, never React state.
 */
export const fx = {
  /** Current camera shake strength (m), decays in the camera. */
  shake: 0,
  /** Extra FOV kick (deg), decays in the camera. */
  fovKick: 0,
};

/** Adds camera shake, respecting the Camera shake + Reduce motion settings. */
export function addShake(amount: number): void {
  const s = useSettingsStore.getState();
  if (!s.cameraShake || s.reduceMotion) return;
  fx.shake = Math.min(1.2, fx.shake + amount);
}

/** Short FOV punch (mini-boost release), disabled by Reduce motion. */
export function addFovKick(deg: number): void {
  if (useSettingsStore.getState().reduceMotion) return;
  fx.fovKick = Math.max(fx.fovKick, deg);
}
