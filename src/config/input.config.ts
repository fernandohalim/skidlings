// Default key bindings (§5). Values are KeyboardEvent.code strings.
// Steering smoothing lives in CAR_CONFIG.steerSmoothTime.
export type InputAction =
  | 'throttle'
  | 'brake'
  | 'left'
  | 'right'
  | 'drift'
  | 'nitro'
  | 'reset'
  | 'pause'
  | 'confirm'
  | 'help';

export type KeyBindings = Record<InputAction, string[]>;

export const DEFAULT_BINDINGS: KeyBindings = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  drift: ['Space'],
  nitro: ['ShiftLeft', 'ShiftRight'],
  reset: ['KeyR'],
  pause: ['Escape'],
  confirm: ['Enter'],
  help: ['KeyH'],
};
