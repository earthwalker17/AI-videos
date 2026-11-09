import { describe, expect, it } from 'vitest';
import { cue } from '../cues.ts';
import { ROUND2 } from '../lookdev/frames.ts';
import { youPoseAt } from './actOne.ts';
import { YOU } from './layout.ts';
import { BAYS } from './layout.ts';
import { QUERIES, REPORT_PORT, ROUTE_HOME, ROUTE_OUT, SPAN_D, STAMP_F, summaryAt, summaryDeskState } from './summary.ts';
import { YOU_POSE_B } from './you.ts';

describe('the summary at the sign-off rest (still D, f5520)', () => {
  it('is posed inside its span, after the stamp', () => {
    expect(ROUND2.stillD).toBeGreaterThanOrEqual(SPAN_D[0]);
    expect(ROUND2.stillD).toBeLessThanOrEqual(SPAN_D[1]);
    expect(STAMP_F).toBe(cue('stamp').frame);
    expect(ROUND2.stillD).toBeGreaterThan(STAMP_F);
  });
  it('draws the route once, out then home, after its cause (the stamp), complete by still D', () => {
    expect(summaryAt(STAMP_F).out).toBeCloseTo(0, 9);
    expect(summaryAt(STAMP_F).home).toBeCloseTo(0, 9);
    for (let f = STAMP_F; f < ROUND2.stillD; f++) {
      const s = summaryAt(f);
      if (s.home > 0) expect(s.out).toBe(1);
    }
    const d = summaryAt(ROUND2.stillD);
    expect(d.out).toBe(1);
    expect(d.home).toBe(1);
    expect(d.ink).toBe(1);
    expect(summaryAt(ROUND2.stillD)).toEqual(d);
  });
  it('runs vermilion from the chat spout to the request bay, and green from its report port home to your in-tray', () => {
    expect(ROUTE_OUT[0][0]).toBeLessThan(-800);
    const inBay = (p: readonly number[]) => p[0] > BAYS.bug.box.x0 && p[0] < BAYS.bug.box.x1 && p[1] > BAYS.bug.box.y0 && p[1] < BAYS.bug.box.y1;
    expect(inBay(ROUTE_OUT[ROUTE_OUT.length - 1])).toBe(true);
    expect(ROUTE_HOME[0]).toEqual(REPORT_PORT);
    expect(inBay(REPORT_PORT)).toBe(true);
    const end = ROUTE_HOME[ROUTE_HOME.length - 1];
    expect(end[0]).toBeGreaterThan(YOU.inTray.x0);
    expect(end[0]).toBeLessThan(YOU.inTray.x1);
  });
  it('caps every bay (work lights out, stepped down) and empties your chore tray', () => {
    const s = summaryDeskState(ROUND2.stillD);
    expect(s.testsLight).toBe(0);
    expect(s.bugLight).toBe(0);
    expect(s.step.ids).toEqual(expect.arrayContaining(['bugBay', 'docsBay', 'freshBay', 'cord']));
    // W-07 is dead still: every pin passed, none flips during the trace
    for (let f = STAMP_F; f <= ROUND2.stillD; f++) expect(summaryDeskState(f).pins.every((p) => p === 1)).toBe(true);
    expect(youPoseAt(ROUND2.stillD).held).toEqual({ key: 0, glass: 0, strut: 0 });
    expect(youPoseAt(ROUND2.stillB)).toBe(YOU_POSE_B);
  });
  it('draws each open problem’s "?" at least 64 px at 1×', () => {
    for (const q of QUERIES) expect(q.size).toBeGreaterThanOrEqual(64);
  });
});
