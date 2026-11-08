import { describe, expect, it } from 'vitest';
import { sketchPasses, sketchStroke, smoothThrough, strokeSamples, type Pt, type SketchOptions } from './sketch.ts';

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
