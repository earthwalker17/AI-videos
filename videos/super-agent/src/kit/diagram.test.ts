import { getLength } from '@remotion/paths';
import { describe, expect, it } from 'vitest';
import { arcPath, hatchLines, penFrames, penLength, pointAt, routePath } from './diagram.tsx';

describe('routePath', () => {
  it('is a straight line between two points', () => {
    expect(routePath([[0, 0], [100, 0]], 24)).toBe('M 0 0 L 100 0');
  });
  it('rounds a right-angle corner with a quarter circle', () => {
    const d = routePath([[0, 0], [100, 0], [100, 100]], 24);
    expect(d).toBe('M 0 0 L 76 0 A 24 24 0 0 1 100 24 L 100 100');
    expect(getLength(d)).toBeCloseTo(76 + 76 + (Math.PI * 24) / 2, 1);
  });
  it('rounds a 45 degree turn, and turns left with sweep 0', () => {
    const d = routePath([[0, 0], [200, 0], [300, -100]], 24);
    expect(d).toMatch(/A 24 24 0 0 0 /);
    const t = 24 * Math.tan(Math.PI / 8);
    expect(getLength(d)).toBeCloseTo(200 - t + (Math.hypot(100, 100) - t) + 24 * (Math.PI / 4), 1);
  });
  it('shrinks the radius where a run is too short', () => {
    const d = routePath([[0, 0], [20, 0], [20, 20]], 24);
    expect(d).toBe('M 0 0 L 10 0 A 10 10 0 0 1 20 10 L 20 20');
  });
  it('needs two points', () => {
    expect(() => routePath([[0, 0]], 24)).toThrow();
  });
});

describe('penLength', () => {
  it('draws at constant speed between the ramps and stops exactly at the end', () => {
    const total = 400;
    const speed = 1000 / 30;
    const T = penFrames(total, speed);
    expect(T).toBeCloseTo(400 / speed + 5, 9);
    expect(penLength(10, 10, total, speed)).toBe(0);
    expect(penLength(10 + T, 10, total, speed)).toBe(total);
    expect(penLength(10 + T + 50, 10, total, speed)).toBe(total);
    // cruising: one frame covers `speed`
    expect(penLength(18, 10, total, speed) - penLength(17, 10, total, speed)).toBeCloseTo(speed, 9);
    // ramps: slower than cruising at both ends
    expect(penLength(11, 10, total, speed)).toBeLessThan(speed);
    expect(total - penLength(10 + T - 1, 10, total, speed)).toBeLessThan(speed);
  });
  it('never goes back', () => {
    let last = 0;
    for (let f = 0; f < 40; f += 0.25) {
      const l = penLength(f, 0, 300, 25);
      expect(l).toBeGreaterThanOrEqual(last - 1e-9);
      last = l;
    }
  });
  it('slows a line too short for full speed, keeping the ramps', () => {
    expect(penFrames(10, 100)).toBeCloseTo(10, 9);
    expect(penLength(10, 0, 10, 100)).toBe(10);
    expect(penLength(5, 0, 10, 100)).toBeGreaterThan(0);
  });
});

describe('pointAt', () => {
  it('finds the point and heading along a path', () => {
    const p = pointAt('M 0 0 L 100 0 L 100 100', 150);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
    expect(p.angle).toBeCloseTo(90);
  });
});

describe('arcPath', () => {
  it('starts at 12 o clock and runs clockwise', () => {
    expect(arcPath(0, 0, 10, 0, 0.25)).toBe('M 0 -10 A 10 10 0 0 1 10 0');
    expect(arcPath(0, 0, 10, 0, 0.75)).toMatch(/A 10 10 0 1 1 -10 0/);
    expect(getLength(arcPath(0, 0, 10, 0, 1))).toBeCloseTo(2 * Math.PI * 10, 1);
  });
});

describe('hatchLines', () => {
  const box = { x0: 0, y0: 0, x1: 80, y1: 40 };
  it('fills a box with clipped parallel lines at the pitch', () => {
    const lines = hatchLines(box, 8);
    // 45 degrees: the box spans (80 + 40)/sqrt(2) across the normal; the lines through a lone corner have no length
    expect(lines.length).toBe(Math.ceil(120 / Math.SQRT2 / 8) - 1);
    for (const [a, b] of lines) {
      for (const [x, y] of [a, b]) {
        expect(x).toBeGreaterThanOrEqual(-1e-9);
        expect(x).toBeLessThanOrEqual(80 + 1e-9);
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeLessThanOrEqual(40 + 1e-9);
      }
      // rising to the right
      expect(Math.sign(b[0] - a[0])).toBe(-Math.sign(b[1] - a[1]));
    }
  });
  it('moves with its box', () => {
    const a = hatchLines(box, 8).map(([p, q]) => [p[0] + 100, p[1], q[0] + 100, q[1]]);
    const b = hatchLines({ x0: 100, y0: 0, x1: 180, y1: 40 }, 8).map(([p, q]) => [p[0], p[1], q[0], q[1]]);
    expect(b.length).toBe(a.length);
    b.forEach((l, i) => l.forEach((v, k) => expect(v).toBeCloseTo(a[i][k], 6)));
  });
  it('draws vertical and horizontal hatching too', () => {
    expect(hatchLines(box, 10, 90).length).toBe(9);
    expect(hatchLines(box, 10, 0).length).toBe(5);
  });
});
