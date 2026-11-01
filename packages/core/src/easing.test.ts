import { describe, expect, it } from 'vitest';
import { clamp, easings, invLerp, lerp, mapRange, progress, smootherstep, smoothstep } from './easing.ts';

describe('easing', () => {
  it('scalar helpers', () => {
    expect(clamp(-1)).toBe(0);
    expect(clamp(2)).toBe(1);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(invLerp(10, 20, 12.5)).toBe(0.25);
    expect(invLerp(3, 3, 7)).toBe(0);
    expect(mapRange(15, 10, 20, 0, 100)).toBe(50);
    expect(mapRange(30, 10, 20, 0, 100)).toBe(100);
    expect(mapRange(30, 10, 20, 0, 100, false)).toBe(200);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, -3)).toBe(0);
    expect(smootherstep(0, 1, 1)).toBe(1);
  });

  it('every easing maps 0 → 0 and 1 → 1, clamps outside, and is monotonic', () => {
    for (const [name, f] of Object.entries(easings)) {
      expect(f(0), name).toBeCloseTo(0, 12);
      expect(f(1), name).toBeCloseTo(1, 12);
      expect(f(-1), name).toBeCloseTo(0, 12);
      expect(f(2), name).toBeCloseTo(1, 12);
      let prev = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const v = f(i / 100);
        expect(v, `${name} at ${i}`).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = v;
      }
    }
  });

  it('progress is frame-indexed', () => {
    expect(progress(15, 10, 20)).toBe(0.5);
    expect(progress(5, 10, 20, 'outCubic')).toBe(0);
    expect(progress(25, 10, 20, (t) => t * t)).toBe(1);
  });
});
