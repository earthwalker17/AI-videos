import { describe, expect, it } from 'vitest';
import { Curve, distanceToPolyline, type P2, type P3 } from './spline.ts';

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

describe('Curve', () => {
  it('passes through every key', () => {
    const keys: P3[] = [
      [0, 0, 0],
      [1, 2, 0],
      [4, 2, 1],
      [5, 0, 3],
    ];
    const c = new Curve(keys);
    keys.forEach((k, i) => {
      const p = c.at(i / (keys.length - 1));
      for (let d = 0; d < 3; d++) expect(p[d]).toBeCloseTo(k[d], 9);
    });
  });

  it('measures a straight run exactly, with no overshoot between uneven keys', () => {
    // collinear keys spaced 1, 0.05 and 5: a curve that overshot a key would run back over it
    // and measure longer than the run
    const c = new Curve<P2>([
      [0, 0],
      [1, 0],
      [1.05, 0],
      [6.05, 0],
    ]);
    expect(c.length).toBeCloseTo(6.05, 6);
    let prev = -Infinity;
    for (let i = 0; i <= 600; i++) {
      const [x, z] = c.at(i / 600);
      expect(x).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(Math.abs(z)).toBeLessThan(1e-12);
      prev = x;
    }
  });

  it('never loops or cusps on a zig-zag of uneven keys: the tangent keeps to each chord', () => {
    const keys: P2[] = [
      [0, 0],
      [3, 0.2],
      [3.2, 2.5],
      [3.3, 2.6],
      [0.5, 3],
      [0.4, 6],
    ];
    const c = new Curve(keys);
    const segs = keys.length - 1;
    for (let s = 0; s < segs; s++) {
      const chord = keys[s + 1].map((v, i) => v - keys[s][i]);
      for (let j = 1; j < 50; j++) {
        const u0 = (s + (j - 0.5) / 50) / segs;
        const u1 = (s + (j + 0.5) / 50) / segs;
        const a = c.at(u0);
        const b = c.at(u1);
        expect((b[0] - a[0]) * chord[0] + (b[1] - a[1]) * chord[1]).toBeGreaterThan(0);
      }
    }
  });

  it('is parametrised by arc length: even spacing, clamped ends, unit tangents', () => {
    const c = new Curve<P2>([
      [0, 0],
      [2, 1],
      [2.5, 4],
      [6, 4.5],
    ]);
    const line = c.polyline(40);
    const step = c.length / 40;
    for (let i = 1; i < line.length; i++) expect(Math.abs(dist(line[i], line[i - 1]) - step) / step).toBeLessThan(0.01);
    expect(c.uAt(-1)).toBe(0);
    expect(c.uAt(c.length + 1)).toBe(1);
    expect(c.pointAt(0)).toEqual(c.at(0));
    for (const s of [0, c.length / 3, c.length]) expect(Math.hypot(...c.tangentAt(s))).toBeCloseTo(1, 9);
    expect(() => new Curve<P2>([[0, 0]])).toThrow(/two points/);
  });
});

describe('distanceToPolyline', () => {
  it('finds the nearest point and its arc length', () => {
    const line = [
      [0, 0],
      [4, 0],
      [4, 3],
    ];
    expect(distanceToPolyline(2, 1, line)).toEqual({ d: 1, s: 2 });
    const r = distanceToPolyline(5, 2, line);
    expect(r.d).toBeCloseTo(1, 12);
    expect(r.s).toBeCloseTo(6, 12);
  });
});
