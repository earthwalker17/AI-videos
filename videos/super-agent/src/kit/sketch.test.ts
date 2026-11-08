import { describe, expect, it } from 'vitest';
import { dashRuns, roundedPolyline, roundedRectLoop, sketchPasses, sketchStroke, smoothThrough, strokeSamples, type Pt, type SketchOptions } from './sketch.ts';

const LINE: Pt[] = [
  [0, 0],
  [200, 0],
  [400, 0],
];
const O: SketchOptions = { width: 6, seed: 7, id: 'test' };

describe('sketch strokes', () => {
  it('are a pure function of their points and seed', () => {
    expect(sketchStroke(LINE, O)).toBe(sketchStroke(LINE, { ...O }));
    expect(sketchStroke(LINE, O)).not.toBe(sketchStroke(LINE, { ...O, seed: 8 }));
    expect(sketchStroke(LINE, O)).not.toBe(sketchStroke(LINE, { ...O, id: 'other' }));
  });

  it('taper to points at both ends and swell between, within the width', () => {
    const ss = strokeSamples(LINE, O);
    expect(ss[0].w).toBe(0);
    expect(ss[ss.length - 1].w).toBeCloseTo(0, 9);
    const mid = ss.slice(ss.length / 4, (3 * ss.length) / 4).map((s) => s.w);
    expect(Math.max(...mid)).toBeLessThanOrEqual(6);
    expect(Math.min(...mid)).toBeGreaterThanOrEqual(6 * (1 - 0.4) - 1e-9);
    // pressure varies the width along the line
    expect(Math.max(...mid) - Math.min(...mid)).toBeGreaterThan(0.2);
  });

  it('wander only slightly off their path', () => {
    for (const s of strokeSamples(LINE, O)) expect(Math.abs(s.y)).toBeLessThanOrEqual(1.2 + 1e-9);
  });

  it('draw on without the drawn part changing shape', () => {
    const half = strokeSamples(LINE, { ...O, to: 0.5, head: 0 });
    const full = strokeSamples(LINE, O);
    expect(half[half.length - 1].x).toBeCloseTo(200, 6);
    // the outline points of the drawn part sit where the finished line has them
    for (const s of half.slice(1, -1)) {
      const twin = full.find((t) => Math.abs(t.x - s.x) < 1e-6);
      expect(twin).toBeDefined();
      expect(s.w).toBeCloseTo(twin!.w, 9);
    }
    // with the default head, the pen's tip tapers at the cut
    const drawing = strokeSamples(LINE, { ...O, to: 0.5 });
    expect(drawing[drawing.length - 1].w).toBe(0);
    expect(sketchStroke(LINE, { ...O, to: 0 })).toBe('');
  });

  it('close their outline', () => {
    const d = sketchStroke(LINE, O);
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d).not.toMatch(/NaN|Infinity/);
  });

  it('get a looser, thinner scribble pass that waits for the line', () => {
    const [main, scribble] = sketchPasses(LINE, O);
    expect(main).toBe(sketchStroke(LINE, O));
    expect(scribble).not.toBe('');
    expect(sketchPasses(LINE, { ...O, to: 0.03 })[1]).toBe('');
  });

  it('smooth through the points', () => {
    const pts: Pt[] = [
      [0, 0],
      [100, 100],
      [200, 0],
    ];
    const dense = smoothThrough(pts);
    expect(dense[0]).toEqual([0, 0]);
    expect(dense[dense.length - 1]).toEqual([200, 0]);
    expect(dense.some(([x, y]) => x === 100 && y === 100)).toBe(true);
  });
});

describe('roundedRectLoop', () => {
  it('goes once round the rectangle and runs on past its start', () => {
    const pts = roundedRectLoop(10, 20, 120, 80, 12, 0.25, 24);
    const [sx, sy] = pts[0];
    expect(sy).toBe(20);
    expect(sx).toBeCloseTo(10 + 12 + 0.25 * 96, 9);
    // inside the box, touching all four sides
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(10, 6);
    expect(Math.max(...xs)).toBeCloseTo(130, 6);
    expect(Math.min(...ys)).toBeCloseTo(20, 6);
    expect(Math.max(...ys)).toBeCloseTo(100, 6);
    // it ends on the top edge, the overshoot past where it began
    const last = pts[pts.length - 1];
    expect(last[1]).toBe(20);
    expect(last[0]).toBeCloseTo(sx + 24, 9);
  });
  it('keeps the overshoot on the straight top edge', () => {
    const last = roundedRectLoop(0, 0, 100, 60, 10, 0.9, 50).at(-1)!;
    expect(last[0]).toBeCloseTo(90, 9);
  });
  it('samples its edges as finely as its arcs, so the smoothing meets each corner without a jog', () => {
    const pts = roundedRectLoop(0, 0, 200, 120, 18, 0.3, 14, 5);
    for (let i = 1; i < pts.length; i++) expect(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])).toBeLessThanOrEqual(5 + 1e-9);
    // the smoothed line never strays outside the box by more than a hair
    for (const [x, y] of smoothThrough(pts)) {
      expect(x).toBeGreaterThan(-0.2);
      expect(x).toBeLessThan(200.2);
      expect(y).toBeGreaterThan(-0.2);
      expect(y).toBeLessThan(120.2);
    }
  });
});

describe('roundedPolyline', () => {
  it('keeps its runs straight and rounds each corner inside the corner, tangent to both runs', () => {
    const pts = roundedPolyline(
      [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
      20,
      10,
    );
    expect(pts[0]).toEqual([0, 0]);
    expect(pts.at(-1)).toEqual([100, 100]);
    // the first run is straight up to the arc's start, 20 before the corner
    for (const [, y] of pts.filter(([x]) => x <= 80)) expect(y).toBe(0);
    // the arc cuts the corner: no point reaches it, and every point stays in the quarter it turns through
    expect(pts.some(([x, y]) => x === 100 && y === 0)).toBe(false);
    for (const [x, y] of pts) expect(x <= 100 && y >= 0).toBe(true);
    for (let i = 1; i < pts.length; i++) expect(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])).toBeLessThanOrEqual(10 + 1e-9);
  });
  it('shortens the rounding where a run is too short, and leaves a straight line alone', () => {
    const pts = roundedPolyline(
      [
        [0, 0],
        [10, 0],
        [10, 100],
      ],
      40,
    );
    for (const [x, y] of pts) expect(x >= 5 - 1e-9 || y === 0).toBe(true);
    expect(
      roundedPolyline(
        [
          [0, 0],
          [50, 50],
        ],
        30,
        100,
      ),
    ).toEqual([
      [0, 0],
      [50, 50],
    ]);
  });
});

describe('dashRuns', () => {
  it('cover the line from 0 to 1 in order, the gaps taking their share', () => {
    const runs = dashRuns(4, 0.3, 7, 'tile');
    expect(runs).toHaveLength(4);
    expect(runs[0][0]).toBe(0);
    expect(runs[3][1]).toBe(1);
    let inked = 0;
    for (let i = 0; i < runs.length; i++) {
      expect(runs[i][1]).toBeGreaterThan(runs[i][0]);
      if (i > 0) expect(runs[i][0]).toBeCloseTo(runs[i - 1][1] + 0.1, 9);
      inked += runs[i][1] - runs[i][0];
    }
    expect(inked).toBeCloseTo(0.7, 9);
  });
  it('are a pure function of the seed, and one run is the whole line', () => {
    expect(dashRuns(3, 0.2, 1, 'a')).toEqual(dashRuns(3, 0.2, 1, 'a'));
    expect(dashRuns(3, 0.2, 1, 'a')).not.toEqual(dashRuns(3, 0.2, 2, 'a'));
    expect(dashRuns(1, 0.5, 1, 'a')).toEqual([[0, 1]]);
  });
});

describe('the scribble pass', () => {
  it('is left out at 0 and strays less when tighter', () => {
    expect(sketchPasses(LINE, { ...O, scribble: 0 })[1]).toBe('');
    const loose = strokeSamples(LINE, { ...O, id: 'test:scribble', width: 6 * 0.45, wobble: 1.2 * 2.5 + 6 * 0.4, wobbleScale: 140 * 0.55, from: 0.06, to: 0.9 });
    const tight = strokeSamples(LINE, { ...O, id: 'test:scribble', width: 6 * 0.45, wobble: 0.2 * (1.2 * 2.5 + 6 * 0.4), wobbleScale: 140 * 0.55, from: 0.06, to: 0.9 });
    const stray = (ss: { y: number }[]) => Math.max(...ss.map((s) => Math.abs(s.y)));
    expect(stray(tight)).toBeLessThan(stray(loose));
    expect(sketchPasses(LINE, { ...O, scribble: 0.2 })[1]).toBe(sketchStroke(LINE, { ...O, id: 'test:scribble', width: 6 * 0.45, wobble: 0.2 * (1.2 * 2.5 + 6 * 0.4), wobbleScale: 140 * 0.55, from: 0.06, to: 0.9, scribble: 0.2 }));
  });
});
