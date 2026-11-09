import { describe, expect, it } from 'vitest';
import { BEAT_4, MT1 } from '../cues.ts';
import { CELLS, CELLS_BEFORE } from '../print.ts';
import { REQUEST_A } from './actOne.ts';
import { B4, CARD_EXIT, CARD_RISE, CARD_STRIKE, HATCH_FRAMES, REEL_LOCK, REQUEST_HEAP, RIDE, TAPE_ROWS, armAt, armRest, beat4At, cardAt, cellLitAt, hatchRiseAt, reelAt, requestAt, tapeAt } from './beat4.ts';
import { footprintsAt, MAX_FOOTPRINTS } from './footprints.ts';
import { BAYS } from './layout.ts';
import { DETENT, EVENTS_D, deskStateAt, nextAt } from './state.ts';
import { SPIN_TOTAL, TURN_SPAN } from './turn.ts';

const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);

describe('beat 4 after the turn (desk/beat4.ts)', () => {
  it('keeps the cue sheet’s frames (cues.ts BEAT_4) for every event it draws', () => {
    expect(B4.requestRise).toBe(BEAT_4.requestRise);
    expect(B4.requestIn.stamp).toBe(BEAT_4.requestIn);
    expect(B4.split).toEqual({ rise: BEAT_4.splitCard, strike: BEAT_4.splitStrike });
    expect(B4.armBug).toBe(BEAT_4.armBug);
    expect(B4.bug.rise).toBe(BEAT_4.dispatchBug);
    expect(B4.threadRow.stamp).toBe(BEAT_4.threadRow);
    expect(B4.gauge).toBe(BEAT_4.gauge);
    expect(B4.ghost).toEqual({ rise: BEAT_4.ghostCard, strike: BEAT_4.ghostStrike });
    expect(B4.rows.map((r) => r.stamp)).toEqual(BEAT_4.rows.slice(0, 2));
    expect([B4.armTests, B4.tests.rise, B4.armDocs, B4.docs.rise]).toEqual([BEAT_4.armTests, BEAT_4.dispatchTests, BEAT_4.armDocs, BEAT_4.dispatchDocs]);
    // the request starts from where act one leaves it in the heap
    expect(REQUEST_HEAP.c).toEqual(REQUEST_A.c);
    expect(REQUEST_HEAP.rot).toBe(REQUEST_A.rot);
  });

  it('is a pure function of the frame', () => {
    for (const f of [1661, 1700, 1785, 1875, 2025, 2139]) expect(JSON.stringify(beat4At(f))).toBe(JSON.stringify(beat4At(f)));
  });

  it('dispatches each Worker by the one move: the leaves open over 4 f, the bay rises only once they are open, the hole closes once it is up', () => {
    for (const o of [B4.bug, B4.tests, B4.docs, { cut: EVENTS_D.cut, cutFrames: EVENTS_D.cutFrames, rise: EVENTS_D.rise }]) {
      expect(hatchRiseAt(o.rise - HATCH_FRAMES - 1, o).hole).toBe(false);
      expect(hatchRiseAt(o.rise - HATCH_FRAMES, o).hatch).toBeCloseTo(0, 9);
      expect(hatchRiseAt(o.rise - HATCH_FRAMES, o).hole).toBe(true);
      expect(hatchRiseAt(o.rise, o).hatch).toBe(1);
      expect(hatchRiseAt(o.rise, o).rise).toBe(0);
      for (const f of range(o.rise - 10, o.rise + 1)) expect(hatchRiseAt(f, o).rise).toBe(0);
      // the groove is cut before the hatch is fully open (MT1, as signed off, cuts on as its bay rises)
      if (o.rise !== EVENTS_D.rise) expect(o.cut + o.cutFrames).toBeLessThanOrEqual(o.rise);
      const up = hatchRiseAt(o.rise + 40, o);
      expect(up.rise).toBeGreaterThan(0.99);
      expect(up.hole).toBe(false);
    }
    // MT1's fresh bay is the same move (the W-10 critic: a 3 f aperture wipe)
    const n = nextAt(EVENTS_D.rise - 2);
    expect(n.hatch).toBeGreaterThan(0.2);
    expect(n.hatch).toBeLessThan(0.9);
    expect(n.rise).toBe(0);
  });

  it('holds the three bays closed and idle from the turn until each is dispatched, then working by MT1', () => {
    for (const id of ['bug', 'tests', 'docs'] as const) {
      const rise = id === 'bug' ? B4.bug.rise : id === 'tests' ? B4.tests.rise : B4.docs.rise;
      for (const f of [TURN_SPAN[1], rise - HATCH_FRAMES - 1]) {
        const d = beat4At(f).bays[id];
        expect(d.rise + d.light + d.hatch + d.door, `${id} f${f}`).toBe(0);
        expect(d.hole).toBe(false);
      }
      const b = beat4At(2140).bays[id];
      expect(b.rise).toBeGreaterThan(0.999);
      expect(b.light).toBeGreaterThan(0.999);
      expect(b.hole).toBe(false);
      expect(b.door).toBe(0);
    }
    // MT1 starts as still (b) was built: the bug bay computing, the test tower's lamps lit, its light at work
    const s = deskStateAt(2140);
    expect(s.bugLight).toBeGreaterThan(0.999);
    expect(s.testsLight).toBeGreaterThan(0.999);
    for (const l of s.lamps) expect(l).toBeGreaterThan(0.999);
  });

  it('lifts the bug bay’s door fully before the request reaches it, and drops it after; the folder takes its vermilion only as it lands', () => {
    const doorY = BAYS.bug.box.y1;
    let reached = -1;
    for (let f = RIDE.groove; f < RIDE.dock; f++) {
      const p = requestAt(f).pose!;
      const lead = p.p[1] + Math.sin(p.heading) * 57;
      if (lead < doorY + 4 && reached < 0) reached = f;
    }
    expect(reached).toBeGreaterThan(0);
    expect(beat4At(reached - 4).bays.bug.door).toBeGreaterThan(0.99);
    expect(beat4At(RIDE.dock + 12).bays.bug.door).toBe(0);
    expect(beat4At(RIDE.dock).folderTake).toBe(0);
    expect(beat4At(RIDE.dock + 10).folderTake).toBeGreaterThan(0.9);
    // its work light comes on after it docks
    expect(beat4At(RIDE.dock).bays.bug.light).toBe(0);
  });

  it('moves the request continuously: out of the heap, into the head, hidden inside the Register, out of the housing and onto its folder', () => {
    let prev = requestAt(B4.requestRise).pose!.p;
    for (const f of range(B4.requestRise + 1, RIDE.dock + 12)) {
      const p = requestAt(f).pose;
      if (!p) {
        // hidden only while it is inside the Register: fed to the head, then waiting until it is dispatched
        expect(f > B4.requestIn.detent! && f < RIDE.out, `f${f}`).toBe(true);
        continue;
      }
      if (f !== RIDE.out) expect(Math.hypot(p.p[0] - prev[0], p.p[1] - prev[1], p.p[2] - prev[2]), `f${f}`).toBeLessThan(60);
      prev = p.p;
    }
    // it carries the transit light only while it moves (one transit light: nothing else is in flight then)
    expect(requestAt(RIDE.dock).pose!.transit).toBe(0);
    for (const f of range(RIDE.out, RIDE.dock)) expect(deskStateAt(f).next.folderTransit + deskStateAt(f).transit).toBe(0);
  });

  it('prints the tape row by row, and leaves (b)’s window for MT1’s stamp-in: docs, CI, the request, the first chat slip', () => {
    // each state adds one cell (a stamp-in that drives the tape on) or inks the Thread's mark into the request's own row
    expect(TAPE_ROWS.map((r) => r.cells.length)).toEqual([1, 2, 2, 3, 4]);
    const last = TAPE_ROWS[TAPE_ROWS.length - 1].cells;
    expect(last.map((c) => c.kind)).toEqual(CELLS_BEFORE.slice(0, 4).map((c) => c.kind));
    expect(last.map((c) => !!c.request)).toEqual(CELLS_BEFORE.slice(0, 4).map((c) => c.request));
    // after MT1's stamp-in the window shows (b)'s cells: #0408 and these four
    expect(CELLS.slice(1).map((c) => c.kind)).toEqual(last.map((c) => c.kind));
    // never a print before its stamp: the ink shows from 2 f after the head drops
    for (const r of TAPE_ROWS.slice(1)) {
      expect(tapeAt(r.at.stamp + 1).row).toBe(TAPE_ROWS.indexOf(r) - 1);
      expect(tapeAt(r.at.stamp + 2)).toMatchObject({ row: TAPE_ROWS.indexOf(r), stage: 0 });
      expect(tapeAt(r.at.stamp + 4).stage).toBe(2);
    }
    expect(tapeAt(2140)).toEqual({ row: TAPE_ROWS.length - 1, stage: 2, advance: 0 });
    // the newest cell lights as each row inks and goes out as the tape next moves on (MT1's detent last)
    expect(cellLitAt(2140)).toBeGreaterThan(0.99);
    expect(cellLitAt(2200)).toBeLessThan(0.01);
  });

  it('brings the reel from the coil’s lock to the Register’s rest by MT1, so (b) to (d) keep their reel', () => {
    const twoPi = 2 * Math.PI;
    expect(((SPIN_TOTAL % twoPi) + twoPi) % twoPi).toBeCloseTo(REEL_LOCK, 9);
    expect(reelAt(TURN_SPAN[1] + 1)).toBeCloseTo(REEL_LOCK, 9);
    expect(Math.abs(reelAt(2140))).toBeLessThan(1e-6);
  });

  it('turns the arm to each bay as it is dispatched and keeps a tick on beats 2 and 4 under N2, resting at the docs galley for MT1', () => {
    expect(armAt(B4.armBug - 1)).toBeCloseTo(DETENT.tests, 9);
    expect(armAt(B4.bug.rise)).toBeCloseTo(DETENT.bug, 2);
    expect(armAt(B4.tests.rise + 8)).toBeCloseTo(DETENT.tests, 2);
    expect(armAt(2100)).toBeCloseTo(armRest(), 6);
    for (const t of B4.ticks) expect(Math.abs(armAt(t + 2) - armAt(t - 1))).toBeGreaterThan(0.01);
    expect(MT1.dispatchFresh).toBe(EVENTS_D.rise);
  });

  it('rises, strikes and clears each counterfactual on its cues, one at a time', () => {
    for (const c of [B4.split, B4.ghost]) {
      expect(cardAt(c.rise - 1, c)).toBeNull();
      expect(cardAt(c.rise + CARD_RISE, c)!.rise).toBe(1);
      expect(cardAt(c.strike - 1, c)!.strike).toBe(0);
      expect(cardAt(c.strike + CARD_STRIKE, c)!.strike).toBe(1);
      expect(cardAt(c.strike + CARD_STRIKE + CARD_EXIT, c)).toBeNull();
    }
    for (let f = 1600; f < 2140; f++) {
      const b = beat4At(f);
      expect(Number(b.cards.split !== null) + Number(b.cards.ghost !== null)).toBeLessThanOrEqual(1);
    }
  });

  it('casts at most 128 footprints through beat 4', () => {
    for (let f = TURN_SPAN[1]; f < 2140; f += 3) expect(footprintsAt(deskStateAt(f)).length, `f${f}`).toBeLessThanOrEqual(MAX_FOOTPRINTS);
  });
});
