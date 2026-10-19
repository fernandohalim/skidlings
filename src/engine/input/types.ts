export interface InputState {
  /** 0..1 */
  throttle: number;
  /** 0..1 */
  brake: number;
  /** -1 (left) .. 1 (right), smoothed. */
  steer: number;
  drift: boolean;
  nitro: boolean;
  /** Edge-triggered: true for exactly one simulation step after the key goes down. */
  reset: boolean;
}

export function createInputState(): InputState {
  return { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false, reset: false };
}
