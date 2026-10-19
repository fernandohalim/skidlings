import type { InputAction, KeyBindings } from '../../config/input.config';
import { moveTowards } from '../utils/math';
import { createInputState, type InputState } from './types';

/**
 * Keyboard → InputState. Call `update(dt)` once per simulation step.
 * Holds no React state; allocation-free after construction.
 */
export class InputManager {
  readonly state: InputState = createInputState();

  private readonly pressed = new Set<string>();
  private codeToActions = new Map<string, InputAction[]>();
  /** Number of held keys per action, so isDown() is O(1) and allocation-free. */
  private readonly heldCount: Record<InputAction, number> = {
    throttle: 0,
    brake: 0,
    left: 0,
    right: 0,
    drift: 0,
    nitro: 0,
    reset: 0,
    pause: 0,
    confirm: 0,
    help: 0,
  };
  private resetQueued = false;
  private target: EventTarget | null = null;

  constructor(bindings: KeyBindings) {
    this.setBindings(bindings);
  }

  setBindings(bindings: KeyBindings): void {
    const map = new Map<string, InputAction[]>();
    for (const action of Object.keys(bindings) as InputAction[]) {
      for (const code of bindings[action]) {
        const list = map.get(code) ?? [];
        list.push(action);
        map.set(code, list);
      }
    }
    this.codeToActions = map;
    this.releaseAll(); // counts are bound to the old mapping
  }

  attach(target: EventTarget): void {
    this.detach();
    this.target = target;
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.target = null;
    this.releaseAll();
  }

  press(code: string): void {
    if (this.pressed.has(code)) return;
    this.pressed.add(code);
    const actions = this.codeToActions.get(code);
    if (!actions) return;
    for (const a of actions) {
      this.heldCount[a]++;
      if (a === 'reset') this.resetQueued = true;
    }
  }

  release(code: string): void {
    if (!this.pressed.delete(code)) return;
    const actions = this.codeToActions.get(code);
    if (actions) for (const a of actions) this.heldCount[a]--;
  }

  releaseAll(): void {
    this.pressed.clear();
    for (const a of Object.keys(this.heldCount) as InputAction[]) this.heldCount[a] = 0;
    this.resetQueued = false;
  }

  isDown(action: InputAction): boolean {
    return this.heldCount[action] > 0;
  }

  /** Advances smoothing by one step. `steerSmoothTime` = seconds from 0 to full lock. */
  update(dt: number, steerSmoothTime: number): InputState {
    const s = this.state;
    s.throttle = this.isDown('throttle') ? 1 : 0;
    s.brake = this.isDown('brake') ? 1 : 0;
    s.drift = this.isDown('drift');
    s.nitro = this.isDown('nitro');

    const targetSteer = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    const rate = steerSmoothTime > 0 ? dt / steerSmoothTime : 2;
    s.steer = moveTowards(s.steer, targetSteer, rate);

    s.reset = this.resetQueued;
    this.resetQueued = false;
    return s;
  }

  private onKeyDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (!this.codeToActions.has(e.code)) return;
    // Stop Space/arrows from scrolling — but never block Enter/Space on a
    // focused button or form control, or menus stop working.
    const tag = (e.target as { tagName?: string } | null)?.tagName;
    const interactive =
      tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (!interactive) e.preventDefault();
    if (!e.repeat) this.press(e.code);
  };

  private onKeyUp = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    this.release(e.code);
  };

  private onBlur = (): void => {
    this.releaseAll();
  };
}
