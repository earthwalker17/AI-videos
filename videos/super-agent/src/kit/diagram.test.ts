import { getLength } from '@remotion/paths';
import { describe, expect, it } from 'vitest';
import { arcPath, fittedDash, fittedOpenDash, hatchLines, octilinear, offsetRoute, penFrames, penLength, pointAt, routePath, squareFromTop } from './diagram.tsx';

describe('octilinear', () => {
  it('takes the diagonal for the shorter offset and an axis run for the rest, in the order asked', () => {
    expect(octilinear([0, 0], [100, 40], true)).toEqual([
      [0, 0],
      [40, 40],
      [100, 40],
    ]);
    expect(octilinear([0, 0], [100, 40], false)).toEqual([
      [0, 0],
      [60, 0],
      [100, 40],
    ]);
    expect(octilinear([10, 10], [-20, -100], false)).toEqual([
      [10, 10],
      [10, -70],
      [-20, -100],
    ]);
  });
  it('is one run when the offset is straight or exactly diagonal', () => {
    expect(octilinear([0, 0], [0, 50], true)).toEqual([
      [0, 0],
      [0, 50],
    ]);
    expect(octilinear([0, 0], [-30, 30], false)).toEqual([
      [0, 0],
      [-30, 30],
    ]);
  });
});

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

describe('routePath with a radius per corner', () => {
  it('rounds each corner with its own radius', () => {
    const d = routePath([[0, 0], [100, 0], [100, 100], [200, 100]], [0, 10, 30, 0]);
    expect(d).toBe('M 0 0 L 90 0 A 10 10 0 0 1 100 10 L 100 70 A 30 30 0 0 0 130 100 L 200 100');
  });
});

describe('offsetRoute', () => {
  it('runs parallel, d to the left on screen, with mitred corners', () => {
    const { points, radii } = offsetRoute([[0, 0], [100, 0], [100, 100]], 10, 24);
    expect(points[0]).toEqual([0, -10]);
    expect(points[1][0]).toBeCloseTo(110, 9);
    expect(points[1][1]).toBeCloseTo(-10, 9);
    expect(points[2]).toEqual([110, 100]);
    // a right turn on screen: the left side is its outside
    expect(radii).toEqual([0, 34, 0]);
  });
  it('keeps a 45 degree route the same distance away all along, corners concentric', () => {
    const route = [[0, 0], [200, 0], [300, 100], [500, 100]] as const;
    const r = 28;
    const d = -12;
    const o = offsetRoute(route, d, r);
    // the original and the offset, sampled: every offset point is |d| from the original path
    const a = routePath(route, r);
    const b = routePath(o.points, o.radii);
    const la = getLength(a);
    const lb = getLength(b);
    // the original path sampled once (each pointAt parses the path again)
    const along = Array.from({ length: 2001 }, (_, j) => pointAt(a, (la * j) / 2000));
    for (let k = 0; k <= 40; k++) {
      const p = pointAt(b, (lb * k) / 40);
      const best = Math.min(...along.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
      expect(best).toBeCloseTo(Math.abs(d), 0);
    }
    // right turn then left turn: the right side (d < 0) is inside the first, outside the second
    expect(o.radii).toEqual([0, r + d, r - d, 0]);
  });
  it('never gives a negative radius', () => {
    expect(offsetRoute([[0, 0], [100, 0], [100, 100]], -40, 24).radii[1]).toBe(0);
  });
});

describe('fittedDash and squareFromTop', () => {
  it('stretch a dash so a closed outline holds a whole number of periods, a multiple of four', () => {
    const [on, off] = fittedDash(300, 14, 10);
    const periods = 300 / (on + off);
    expect(periods).toBeCloseTo(Math.round(periods), 9);
    expect(Math.round(periods) % 4).toBe(0);
    expect(on / off).toBeCloseTo(14 / 10, 9);
    // never fewer periods than the multiple, however short the outline
    expect(30 / fittedDash(30, 14, 10).reduce((a, b) => a + b)).toBeCloseTo(4, 9);
  });
  it('stretch a dash so an open line starts and ends on a whole dash, as near the pattern as it can', () => {
    const strain = (length: number, m: number) => Math.abs(Math.log(length / (m * 14 + (m - 1) * 10)));
    for (const length of [30, 38, 48, 60, 62, 100, 173.5]) {
      const [on, off] = fittedOpenDash(length, 14, 10);
      const n = Math.round((length + off) / (on + off));
      // n dashes and n - 1 gaps fill the line exactly
      expect(n * on + (n - 1) * off).toBeCloseTo(length, 9);
      expect(on / off).toBeCloseTo(14 / 10, 9);
      // no other count of dashes would stretch or squeeze the pattern less
      for (const m of [n - 1, n + 1].filter((m) => m >= 1)) expect(strain(length, n)).toBeLessThanOrEqual(strain(length, m) + 1e-9);
    }
    // at the pattern's own lengths it does not stretch: 3 dashes in 62, 2 in 38
    expect(fittedOpenDash(62, 14, 10)).toEqual([14, 10]);
    expect(fittedOpenDash(38, 14, 10)).toEqual([14, 10]);
    // a line shorter than about a dash and a half is one dash
    expect(fittedOpenDash(20, 14, 10)).toEqual([20, 0]);
  });
  it('trace a rounded square from the middle of its top side, its length the perimeter', () => {
    const sq = squareFromTop(100, 100, 80, 10);
    expect(sq.d.startsWith('M 100 60 ')).toBe(true);
    expect(sq.length).toBeCloseTo(4 * 60 + 2 * Math.PI * 10, 9);
    expect(getLength(sq.d)).toBeCloseTo(sq.length, 1);
  });
});
