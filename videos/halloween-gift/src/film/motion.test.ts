import { describe, expect, it } from 'vitest';
import { footfalls, WALKS } from '../../audio/timeline.ts';
import { CamPath, type CamKey } from './campath.ts';
import { footfallsOf, hopAt, hopsOf, type Walk } from './gait.ts';

describe('the hop gait', () => {
  const walks: Walk[] = WALKS.map(([from, to], i) => ({ from, to, s0: i, s1: i + 2.2 }));

  it('lands on exactly the footfalls the score plays', () => {
    const score = footfalls().map((x) => x.frame);
    const ours = walks.flatMap((w) => footfallsOf(w));
    expect(ours).toEqual(score);
    for (const w of walks) for (const h of hopsOf(w)) expect(hopAt(w, h.land).lift).toBe(0);
  });

  it('never moves along the path while a foot is planted, and never jumps', () => {
    for (const w of walks) {
      let prev = hopAt(w, w.from - 6);
      for (let f = w.from - 5; f <= w.to + 8; f += 0.5) {
        const st = hopAt(w, f);
        expect(st.s).toBeGreaterThanOrEqual(prev.s - 1e-9);
        // no step bigger than a hop's share in half a frame (no teleports)
        expect(st.s - prev.s).toBeLessThan(0.12);
        if (st.lift === 0 && prev.lift === 0 && st.sy !== 1.07) expect(Math.abs(st.s - prev.s) < 1e-9 || st.lift > 0 || prev.lift > 0).toBe(true);
        prev = st;
      }
      expect(hopAt(w, w.to + 8).s).toBeCloseTo(w.s1, 9);
    }
  });

  it('keeps hops within the budget (≤ 0.55 units)', () => {
    // the layout's walk lengths (world/layout.ts STOPS) and the exit
    const lengths = [1.2, 2.15, 2.25, 3.6, 1.85];
    WALKS.forEach(([from, to], i) => {
      const w: Walk = { from, to, s0: 0, s1: lengths[i] };
      for (const h of hopsOf(w)) expect(h.s1 - h.s0).toBeLessThanOrEqual(0.55);
    });
  });
});

describe('the camera path', () => {
  const keys: CamKey[] = [
    { f: 0, pos: [0, 1, 10], look: [0, 1, 0], fov: 30, focus: 10 },
    { f: 40, pos: [3, 2, 6], look: [0, 1, 0], fov: 34, focus: 6 },
    { f: 70, pos: [4, 1.5, 3], look: [1, 1, -1], fov: 34, focus: 4, hold: true },
    { f: 120, pos: [-2, 1, 2], look: [-1, 1, -2], fov: 30, focus: 3 },
  ];
  const path = new CamPath(keys);
  const v = (f: number) => {
    const a = path.at(f - 0.5).pos;
    const b = path.at(f + 0.5).pos;
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  };

  it('passes through every key at its frame', () => {
    for (const k of keys) {
      const p = path.at(k.f);
      for (let d = 0; d < 3; d++) {
        expect(p.pos[d]).toBeCloseTo(k.pos[d], 6);
        expect(p.look[d]).toBeCloseTo(k.look[d], 6);
      }
      expect(p.fov).toBeCloseTo(k.fov, 6);
    }
  });

  it('keeps moving through a pass-through key, stops at a hold', () => {
    expect(v(40)).toBeGreaterThan(0.02);
    // continuous speed across the key: no jump between just before and just after
    expect(Math.abs(v(39) - v(41)) / v(40)).toBeLessThan(0.2);
    expect(v(70) / v(40)).toBeLessThan(0.05);
  });
});
