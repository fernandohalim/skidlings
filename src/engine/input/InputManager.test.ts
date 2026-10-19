import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../config/input.config';
import { InputManager } from './InputManager';

const DT = 1 / 60;

describe('InputManager', () => {
  it('maps WASD and arrows to the same actions', () => {
    const im = new InputManager(DEFAULT_BINDINGS);
    im.press('ArrowUp');
    expect(im.update(DT, 0.08).throttle).toBe(1);
    im.release('ArrowUp');
    im.press('KeyW');
    expect(im.update(DT, 0.08).throttle).toBe(1);
  });

  it('ramps steering over steerSmoothTime', () => {
    const im = new InputManager(DEFAULT_BINDINGS);
    im.press('KeyD');
    const first = im.update(DT, 0.08).steer;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    for (let i = 0; i < 10; i++) im.update(DT, 0.08);
    expect(im.state.steer).toBe(1);
  });

  it('opposite steer keys cancel', () => {
    const im = new InputManager(DEFAULT_BINDINGS);
    im.press('KeyA');
    im.press('KeyD');
    for (let i = 0; i < 10; i++) im.update(DT, 0.08);
    expect(im.state.steer).toBe(0);
  });

  it('reset is edge-triggered for exactly one step', () => {
    const im = new InputManager(DEFAULT_BINDINGS);
    im.press('KeyR');
    expect(im.update(DT, 0.08).reset).toBe(true);
    expect(im.update(DT, 0.08).reset).toBe(false);
  });

  it('releaseAll (window blur) clears held keys', () => {
    const im = new InputManager(DEFAULT_BINDINGS);
    im.press('KeyW');
    im.press('Space');
    im.releaseAll();
    const s = im.update(DT, 0.08);
    expect(s.throttle).toBe(0);
    expect(s.drift).toBe(false);
  });
});
