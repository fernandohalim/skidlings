import { describe, expect, it } from 'vitest';
import { clamp, damp, moveTowards, wrapAngle } from './math';

describe('math utils', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('wraps angles into (-PI, PI]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(2 * Math.PI + 0.1)).toBeCloseTo(0.1);
  });

  it('damp is frame-rate independent', () => {
    // One 1/30 s step ≈ two 1/60 s steps.
    const one = damp(0, 10, 6, 1 / 30);
    const two = damp(damp(0, 10, 6, 1 / 60), 10, 6, 1 / 60);
    expect(one).toBeCloseTo(two, 10);
  });

  it('moveTowards never overshoots', () => {
    expect(moveTowards(0, 1, 0.3)).toBeCloseTo(0.3);
    expect(moveTowards(0.9, 1, 0.3)).toBe(1);
    expect(moveTowards(0, -1, 0.3)).toBeCloseTo(-0.3);
  });
});
