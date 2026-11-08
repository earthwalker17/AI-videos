import { describe, expect, it } from 'vitest';
import { RUNS, timetable } from './chart.ts';
import { PANEL } from './world.ts';

const t = timetable(PANEL);

describe('the timetable (FACTS.md, block 113)', () => {
  it('draws the three runs of the article: p50/p95 20.4/29.5, 13.8/29.0, 12.4/15.7; tokens 6.1M, 10.8M, 23.2M', () => {
    expect(RUNS.map((r) => [r.typical, r.slowest, r.tokens])).toEqual([
      [20.4, 29.5, 6.1],
      [13.8, 29.0, 10.8],
      [12.4, 15.7, 23.2],
    ]);
    expect(RUNS.map((r) => r.lane)).toEqual(['laneOne', 'laneTold', 'laneTwo']);
  });

  it('starts every lane on one shared start line', () => {
    for (const l of t.lanes) expect(l.x0).toBe(t.start.x);
  });

  it('makes every rail exactly proportional to its slowest time, and every dot to its typical time, on one scale', () => {
    const k = (t.lanes[0].endX - t.lanes[0].x0) / RUNS[0].slowest;
    for (const l of t.lanes) {
      expect((l.endX - l.x0) / l.run.slowest).toBeCloseTo(k, 9);
      expect((l.dotX - l.x0) / l.run.typical).toBeCloseTo(k, 9);
    }
    expect(k).toBeCloseTo(t.minute, 9);
    // the ratios the narration states, read off the drawing
    const len = (i: number) => t.lanes[i].endX - t.lanes[i].x0;
    expect(len(2) / len(0)).toBeCloseTo(15.7 / 29.5, 9);
    expect(len(2) / len(1)).toBeCloseTo(15.7 / 29.0, 9);
    const dot = (i: number) => t.lanes[i].dotX - t.lanes[i].x0;
    expect(1 - dot(2) / dot(1)).toBeCloseTo((13.8 - 12.4) / 13.8, 9);
  });

  it('makes the token bars exactly proportional to the tokens per run', () => {
    const m = (t.lanes[0].tokenX1 - t.tokens.x0) / RUNS[0].tokens;
    for (const l of t.lanes) expect((l.tokenX1 - t.tokens.x0) / l.run.tokens).toBeCloseTo(m, 9);
    const bar = (i: number) => t.lanes[i].tokenX1 - t.tokens.x0;
    expect(bar(2) / bar(1)).toBeCloseTo(23.2 / 10.8, 9);
    expect(bar(2) / bar(0)).toBeCloseTo(23.2 / 6.1, 9);
  });

  it('keeps everything inside the panel, the rails left of the token column', () => {
    for (const l of t.lanes) {
      expect(l.endX).toBeLessThan(t.tokens.divider);
      expect(l.tokenX1).toBeLessThanOrEqual(PANEL.x + PANEL.w);
      expect(l.y).toBeGreaterThan(t.header.ruleY);
      expect(l.y).toBeLessThan(PANEL.y + PANEL.h);
    }
    expect(t.tokens.x0).toBeGreaterThan(t.tokens.divider);
  });
});
