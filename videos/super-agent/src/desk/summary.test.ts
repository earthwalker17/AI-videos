import { describe, expect, it } from 'vitest';
import { cue } from '../cues.ts';
import { ROUND2 } from '../lookdev/frames.ts';
import { youPoseAt } from './actOne.ts';
import { YOU } from './layout.ts';
import { BAYS } from './layout.ts';
import { EASE_OUT_D, FRAMING_D, QUERIES, REPORT_PORT, ROUTE_HOME, ROUTE_OUT, SPAN_D, STAMP_F, STUB_A, poseD, summaryAt, summaryDeskState, summaryLabelAt } from './summary.ts';
import { FRAMING_B, deskCamera } from './camera.ts';
import { CHUTE, INDEX, PRINT_HEAD, RAMP, REEL, WINDOW } from './layout.ts';
import { DETENT } from './state.ts';
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
  it('runs the green home through the Register: up the groove and the ramp, along the window, through the print head, out along the index arm, down the chute', () => {
    const inBox = (p: readonly number[], b: { x0: number; x1: number; y0: number; y1: number }) => p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.y0 && p[1] <= b.y1;
    // up the ramp's quarter pipe (its south lane)
    expect(ROUTE_HOME.some((p) => p[0] > RAMP.x + 5 && p[0] < RAMP.x + RAMP.lip && p[1] < (RAMP.y0 + RAMP.y1) / 2)).toBe(true);
    // along the window's south bar, on its top
    expect(ROUTE_HOME.filter((p) => p[1] >= WINDOW.frame.y0 && p[1] <= WINDOW.frame.y0 + WINDOW.bar && p[2] >= WINDOW.z[1]).length).toBeGreaterThanOrEqual(3);
    // through the print head
    expect(ROUTE_HOME.some((p) => inBox(p, PRINT_HEAD.box))).toBe(true);
    // out along the index arm at your detent
    const along = (p: readonly number[]) => {
      const dx = p[0] - INDEX.pivot[0];
      const dy = p[1] - INDEX.pivot[1];
      const t = dx * Math.cos(DETENT.you) + dy * Math.sin(DETENT.you);
      return t > 10 && t <= INDEX.length && Math.abs(-dx * Math.sin(DETENT.you) + dy * Math.cos(DETENT.you)) < 6;
    };
    expect(ROUTE_HOME.filter(along).length).toBeGreaterThanOrEqual(2);
    // down the reply chute's bed
    for (const c of CHUTE.slice(1)) expect(ROUTE_HOME.some((p) => p[0] === c[0] && p[1] === c[1])).toBe(true);
    // no free arc: no stretch of the route leaps more than 130 u, and it never crosses the other bays' floors
    for (const route of [ROUTE_HOME, ROUTE_OUT]) {
      for (let i = 1; i < route.length; i++) expect(Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1])).toBeLessThan(130);
      // (over their north walls only on the deck's south rail, a level above)
      for (const p of route) for (const b of [BAYS.tests, BAYS.docs]) expect(inBox(p, b.box) && p[2] < 100).toBe(false);
    }
  });
  it('runs the vermilion out over the tape to the stub of the request on the reel, then down the ramp', () => {
    const stub: readonly number[] = [REEL.x + (REEL.packR - 6) * Math.cos(STUB_A), REEL.y + (REEL.packR - 6) * Math.sin(STUB_A)];
    expect(ROUTE_OUT.some((p) => Math.hypot(p[0] - stub[0], p[1] - stub[1]) < 1)).toBe(true);
    expect(ROUTE_OUT.some((p) => p[0] > RAMP.x + 5 && p[0] < RAMP.x + RAMP.lip && p[1] > (RAMP.y0 + RAMP.y1) / 2)).toBe(true);
  });
  it('eases the camera out over bar 69 from the Register at 0.85x to the whole desk at 0.64x, settled before still D', () => {
    expect(EASE_OUT_D.from).toBe(STAMP_F);
    expect(poseD(STAMP_F, 15)).toEqual(deskCamera(FRAMING_B, 15));
    expect(poseD(EASE_OUT_D.to, 15)).toEqual(deskCamera(FRAMING_D, 15));
    expect(poseD(ROUND2.stillD, 15)).toEqual(deskCamera(FRAMING_D, 15));
    expect(poseD(STAMP_F + 30, 15)).not.toEqual(deskCamera(FRAMING_D, 15));
  });
  it('takes the labels off for the move and lands them again, still, before still D', () => {
    for (let i = 0; i < 3; i++) {
      expect(summaryLabelAt(STAMP_F - 1, i)).toEqual({});
      expect(summaryLabelAt(STAMP_F + 3, i)?.opacity).toBeCloseTo(0.5, 6);
      expect(summaryLabelAt(STAMP_F + 10, i)).toBeNull();
      // no label is up while the camera moves
      for (let f = STAMP_F + 6; f < EASE_OUT_D.to; f++) expect(summaryLabelAt(f, i)).toBeNull();
      expect(summaryLabelAt(ROUND2.stillD, i)).toEqual({});
    }
  });
});
