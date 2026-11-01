import { describe, expect, it } from 'vitest';
import { halton, hash32, hashString, mix32, rand, randInt, randRange, valueNoise } from './rng.ts';

describe('rng', () => {
  it('is a pure function of its arguments', () => {
    expect(rand(7, 'star', 3)).toBe(rand(7, 'star', 3));
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
    expect(rand(7, 'star', 3)).not.toBe(rand(7, 'star', 4));
    expect(rand(7, 'star', 3)).not.toBe(rand(8, 'star', 3));
  });

  // reference values computed with MAP's rng.ts @696e968: the port must stay bit-identical,
  // or every frame that uses it changes
  it('keeps known values stable across releases', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(mix32(0)).toBe(0);
    expect(hash32(1, 2, 3)).toBe(4055516840);
    expect(rand(42, 'x', 0)).toBe(0.12049307464621961);
  });

  it('stays in range and is roughly uniform', () => {
    const n = 20000;
    const bins = new Array(10).fill(0);
    for (let i = 0; i < n; i++) {
      const r = rand(1, i);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
      bins[Math.floor(r * 10)]++;
    }
    for (const b of bins) expect(Math.abs(b - n / 10)).toBeLessThan(n / 10 / 5);
    for (let i = 0; i < 1000; i++) {
      const v = randRange(3, i, 0, -2, 5);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(5);
      const k = randInt(3, i, 1, 1, 6);
      expect(Number.isInteger(k) && k >= 1 && k <= 6).toBe(true);
    }
  });

  it('halton gives the radical inverse', () => {
    expect([1, 2, 3, 4].map((i) => halton(i, 2))).toEqual([0.5, 0.25, 0.75, 0.125]);
    expect(halton(1, 3)).toBeCloseTo(1 / 3);
  });

  it('valueNoise is continuous, bounded and lattice-exact', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.137;
      const v = valueNoise(x, 1.5, 9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(Math.abs(valueNoise(x + 1e-4, 1.5, 9) - v)).toBeLessThan(1e-2);
    }
    expect(valueNoise(3, 4, 9)).toBe(hash32(9, 3, 4) / 4294967296);
  });
});
