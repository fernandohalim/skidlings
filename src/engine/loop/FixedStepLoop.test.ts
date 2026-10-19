import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from './FixedStepLoop';

describe('FixedStepLoop', () => {
  it('runs whole steps and returns the leftover as alpha', () => {
    const loop = new FixedStepLoop(1 / 60);
    let n = 0;
    const alpha = loop.advance(2.5 / 60, () => n++);
    expect(n).toBe(2);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('caps steps per frame and drops backlog after a stall', () => {
    const loop = new FixedStepLoop(1 / 60, 5);
    let n = 0;
    loop.advance(1, () => n++);
    expect(n).toBe(5);
    n = 0;
    loop.advance(0, () => n++);
    expect(n).toBe(0);
  });
});
