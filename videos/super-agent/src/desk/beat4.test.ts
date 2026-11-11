import { describe, expect, it } from 'vitest';
import { BEAT_4, MT1 } from '../cues.ts';
import { CELLS, CELLS_BEFORE } from '../print.ts';
import { REQUEST_A, requestZ } from './actOne.ts';
import {
  B4,
  CARD_AT,
  CARD_EXIT,
  CARD_RISE,
  CARD_SPOT,
  CARD_STRIKE,
  DETENT_LEAD,
  HATCH_FRAMES,
  HEAP_CAST,
  LID_FRAMES,
  REEL_DETENTS,
  REEL_LOCK,
  REQUEST_FROM,
  REQUEST_HEAP,
  REQUEST_RIDE,
  RIDE,
  RIDE_FRAMES,
  TAPE_ROWS,
  TICK,
  armAt,
  armRest,
  beat4At,
  bayDispatchAt,
  cardAt,
  cardIn,
  cardPose,
  cardShadeShift,
  CARD_SHADE_CLEAR,
  carriersAt,
  cellLitAt,
  gaugeFlipAt,
  hammerAt,
  hatchRiseAt,
  heapAt,
  heapFloor,
  heapPieceAt,
  rampTopAt,
  ridersAt,
  RIDERS_WIND,
  PIN_SHADE_TOP,
  REQUEST_SHADE_IN,
  SHADE_IN,
  DOCK_SHADE_TOP,
  SHADE_RAMP,
  shadeAt,
  WORK_REST,
  liftOf,
  testsCapOpenAt,
  workLift,
  ON_REQUEST,
  reelAt,
  requestAt,
  stubAt,
  tapeAt,
  type Carry,
} from './beat4.ts';
import { deskCamera, FRAMING_B, project } from './camera.ts';
import { bayWalls, cardFootprint, footprintsAt, heapFootprintsAt, MAX_FOOTPRINTS, type Footprint } from './footprints.ts';
import { BAYS, BAY_FLOOR, BENCH, DECK, DISPATCH_HOUSING, DRAWER, LEG_R, LEG_STRUTS, MOUTH, NEXT_SLIP, PINS, RAMP, REQUEST, SHEET, TOWER, rectC, towerTop, type BayId, type P3 } from './layout.ts';
import { LIGHT_GLSL } from './gl/light.ts';
import { poolsAt, MAX_POOLS } from './pools.ts';
import { DETENT, EVENTS_D, FOCUS_BEATS, deskStateAt, nextAt, SLIP_LANDS, stepAt } from './state.ts';
import { SPIN_TOTAL, TURN_SPAN, turnAt, turnFootprints } from './turn.ts';
import { HEAP, PIECE } from './actOne.ts';

const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
/** The smallest turn between two headings (radians). */
const dTurn = (a: number, b: number) => Math.abs(((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);
const IDS: readonly BayId[] = ['bug', 'tests', 'docs'];
const DISPATCH: Record<BayId, { arm: number; rise: number }> = {
  bug: { arm: BEAT_4.armBug, rise: BEAT_4.dispatchBug },
  tests: { arm: BEAT_4.armTests, rise: BEAT_4.dispatchTests },
  docs: { arm: BEAT_4.armDocs, rise: BEAT_4.dispatchDocs },
};

/**
 * A carrier's pose never jumps between two frames it is drawn in: not in position (at most `step` u), heading or slope
 * (at most 0.35 rad: a one-frame orientation snap is a swap), nor squash.
 */
function expectContinuous(poses: [number, Carry | null][], step = 60) {
  for (let i = 1; i < poses.length; i++) {
    const [f, b] = poses[i];
    const a = poses[i - 1][1];
    if (!a || !b) continue;
    expect(Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]), `position f${f}`).toBeLessThan(step);
    expect(dTurn(a.heading, b.heading), `heading f${f}`).toBeLessThan(0.35);
    expect(Math.abs(b.slope - a.slope), `slope f${f}`).toBeLessThan(0.35);
  }
}

/** A dispatched carrier's pose (the request's for the bug bay). */
const carrierAt = (id: BayId, f: number): Carry | null => (id === 'bug' ? requestAt(f).pose : (carriersAt(f).find((c) => c.id === id)?.pose ?? null));
/** Each carrier's half length and half width. */
const HALF: Record<BayId, [number, number]> = { bug: [REQUEST.l / 2, REQUEST.w / 2], tests: [42, 25], docs: [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2] };
/** A carrier's footprint samples in the world (its ends, quarters and centre, by its edges and middle), at their heights. */
function samples(id: BayId, c: Carry): P3[] {
  const [hl, hw] = HALF[id];
  return [-1, -0.5, 0, 0.5, 1].flatMap((a) =>
    [-1, 0, 1].map((w): P3 => {
      const ax = a * hl * Math.cos(c.slope);
      return [c.p[0] + ax * Math.cos(c.heading) - w * hw * Math.sin(c.heading), c.p[1] + ax * Math.sin(c.heading) + w * hw * Math.cos(c.heading), c.p[2] + a * hl * Math.sin(c.slope)];
    }),
  );
}

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
    expect(B4.rows.map((r) => r.stamp)).toEqual([...BEAT_4.rows]);
    expect([B4.armTests, B4.tests.rise, B4.armDocs, B4.docs.rise]).toEqual([BEAT_4.armTests, BEAT_4.dispatchTests, BEAT_4.armDocs, BEAT_4.dispatchDocs]);
    // the request starts from where act one leaves it in the heap (its underside on the pieces under it)
    expect(REQUEST_HEAP.c).toEqual(REQUEST_A.c);
    expect(REQUEST_HEAP.rot).toBe(REQUEST_A.rot);
    expect(REQUEST_HEAP.z).toBeCloseTo(requestZ(), 9);
  });

  it('is a pure function of the frame', () => {
    for (const f of [1648, 1661, 1700, 1785, 1875, 2025, 2139]) expect(JSON.stringify(beat4At(f))).toBe(JSON.stringify(beat4At(f)));
  });

  describe('lands every cue frame as a contact frame: the event on the cue, its anticipation before it', () => {
    it('the request’s first move out of the heap (requestRise), its crease gathering before it', () => {
      const r = B4.requestRise;
      const at = (f: number) => requestAt(f).pose!.p;
      expect(at(r - 1)).toEqual(at(r - 4));
      expect(Math.hypot(at(r)[0] - at(r - 1)[0], at(r)[1] - at(r - 1)[1])).toBeGreaterThan(1);
      expect(requestAt(r - 4).crease).toBe(1);
      expect(requestAt(r - 2).crease).toBeLessThan(1);
      expect(REQUEST_FROM).toBeLessThan(r);
    });

    it('every stamp-in (the request in, the Thread’s row, the two arrivals): the head down and the first ink on the cue, the reel seated on it', () => {
      for (const s of [BEAT_4.requestIn, BEAT_4.threadRow, ...BEAT_4.rows]) {
        expect(hammerAt(s), `f${s}`).toBe(1);
        expect(hammerAt(s - 3), `f${s}`).toBe(0);
        const i = TAPE_ROWS.findIndex((x) => x.at.stamp === s);
        expect(tapeAt(s)).toMatchObject({ row: i, stage: 0 });
        expect(tapeAt(s - 1).row).toBe(i - 1);
        expect(tapeAt(s + 2).stage).toBe(2);
      }
      // the reel's detents click home on their stamps (spring-detent from 7 f before)
      for (const d of REEL_DETENTS) expect(d + DETENT_LEAD).toBe(TAPE_ROWS.find((x) => x.at.detent === d)!.at.stamp);
      expect(stubAt(BEAT_4.requestIn - 1)).toBe(-1);
      expect(stubAt(BEAT_4.requestIn)).toBe(0);
    });

    it('each card’s first move on its rise cue and its strike’s pen touching on its strike cue', () => {
      for (const c of [B4.split, B4.ghost]) {
        expect(cardAt(c.rise - 1, c)).toBeNull();
        expect(cardAt(c.rise, c)!.rise).toBeGreaterThan(0);
        expect(cardAt(c.strike - 1, c)!.strike).toBe(0);
        expect(cardAt(c.strike, c)!.strike).toBeGreaterThan(0);
        expect(cardAt(c.strike - 1 + CARD_STRIKE, c)!.strike).toBe(1);
      }
    });

    it('each arm detent seated on its cue, never started before its lead', () => {
      for (const id of IDS) {
        const d = DISPATCH[id];
        expect(Math.abs(armAt(d.arm) - DETENT[id]), id).toBeLessThan(0.003);
        expect(armAt(d.arm - DETENT_LEAD)).toBeCloseTo(armAt(d.arm - DETENT_LEAD - 1), 9);
      }
    });

    it('each dispatch: the lid’s leaves hit their stops on the cue, the bay rises from it, its nameplate prints on it', () => {
      for (const id of IDS) {
        const r = DISPATCH[id].rise;
        expect(bayDispatchAt(r, id).hatch).toBe(1);
        expect(bayDispatchAt(r - 1, id).hatch).toBeLessThan(1);
        expect(bayDispatchAt(r - LID_FRAMES, id).hatch).toBe(0);
        expect(bayDispatchAt(r, id).rise).toBe(0);
        expect(bayDispatchAt(r + 1, id).rise).toBeGreaterThan(0);
        expect(bayDispatchAt(r - 1, id).plate).toBe(-1);
        expect(bayDispatchAt(r, id).plate).toBe(0);
        expect(bayDispatchAt(r + 2, id).plate).toBe(2);
      }
    });

    it('the gauge lands face up on its cue, turning over in the 8 f before it', () => {
      expect(gaugeFlipAt(BEAT_4.gauge)).toBe(0);
      expect(gaugeFlipAt(BEAT_4.gauge - 1)).toBeGreaterThan(0.1);
      expect(gaugeFlipAt(BEAT_4.gauge - 8)).toBeCloseTo(Math.PI, 9);
      expect(gaugeFlipAt(TURN_SPAN[1] + 1)).toBeCloseTo(Math.PI, 9);
    });

    it('MT1’s cues: the card out of the slot and flying, the stamp’s contact, the reply in the tray, the fresh bay’s leaves on their stops', () => {
      expect(deskStateAt(MT1.reportUp - 1).card).toBeNull();
      expect(deskStateAt(MT1.reportUp).card).not.toBeNull();
      expect(deskStateAt(MT1.stampIn).stamp).toBe(1);
      expect(deskStateAt(MT1.stampIn - 1).ink).toBe(0);
      expect(deskStateAt(MT1.stampIn).ink).toBeGreaterThan(0);
      expect(SLIP_LANDS).toBe(MT1.replyLands);
      const lands = deskStateAt(MT1.replyLands).slip!;
      expect(lands.arc).toBe(1);
      expect(lands.squash).toBe(1);
      expect(deskStateAt(MT1.replyLands - 1).slip!.arc).toBeLessThan(1);
      expect(nextAt(MT1.dispatchFresh).hatch).toBe(1);
      expect(nextAt(MT1.dispatchFresh).rise).toBe(0);
    });
  });

  it('dispatches MT1’s fresh bay by the one move: the leaves open over 4 f, the bay rises only once they are open, the hole closes once it is up', () => {
    const o = { cut: EVENTS_D.cut, cutFrames: EVENTS_D.cutFrames, rise: EVENTS_D.rise };
    expect(hatchRiseAt(o.rise - HATCH_FRAMES - 1, o).hole).toBe(false);
    expect(hatchRiseAt(o.rise - HATCH_FRAMES, o).hole).toBe(true);
    expect(hatchRiseAt(o.rise, o).hatch).toBe(1);
    for (const f of range(o.rise - 10, o.rise + 1)) expect(hatchRiseAt(f, o).rise).toBe(0);
    expect(hatchRiseAt(o.rise + 40, o).hole).toBe(false);
  });

  it('holds the three bays closed (their lids on the slate, no hole, a blank plate) from the turn until each is dispatched, then working by MT1', () => {
    for (const id of IDS) {
      const rise = DISPATCH[id].rise;
      for (const f of [TURN_SPAN[1], TURN_SPAN[1] + 1, rise - LID_FRAMES]) {
        const d = beat4At(f).bays[id];
        expect(d.rise + d.light + d.hatch + d.door, `${id} f${f}`).toBe(0);
        expect(d.hole, `${id} f${f}`).toBe(false);
        expect(d.plate).toBe(-1);
      }
      // the hole opens on the leaves' first move, before the slate under them shows
      expect(beat4At(rise - LID_FRAMES + 1).bays[id].hole).toBe(true);
      const b = beat4At(2140).bays[id];
      expect(b.rise).toBeGreaterThan(0.999);
      expect(b.light).toBeGreaterThan(0.999);
      expect(b.hole).toBe(false);
      expect(b.door).toBe(0);
      expect(b.plate).toBe(2);
    }
    const s = deskStateAt(2140);
    expect(s.bugLight).toBeGreaterThan(0.999);
    expect(s.testsLight).toBeGreaterThan(0.999);
    for (const l of s.lamps) expect(l).toBeGreaterThan(0.999);
  });

  it('hops every dispatch into its bay from the ramp’s foot (the request, the CI card, the docs slip): its door shut, its light only once it is in, cause before effect', () => {
    for (const id of IDS) {
      const F = RIDE_FRAMES[id];
      for (let f = F.groove; f < F.dock + 12; f++) {
        expect(carrierAt(id, f), `${id} f${f}`).not.toBeNull();
        // every carrier comes in over the walls: no door opens (nothing passes through one)
        expect(bayDispatchAt(f, id).door).toBe(0);
      }
      expect(bayDispatchAt(F.dock, id).light).toBe(0);
      expect(bayDispatchAt(F.dock + 12, id).light).toBeGreaterThan(0.5);
      // its ride is cause after effect: out of the housing only once the arm has turned to it and its hatch is opening
      expect(F.out).toBeGreaterThan(DISPATCH[id].arm);
    }
    expect(beat4At(RIDE.dock).folderTake).toBe(0);
    expect(beat4At(RIDE.dock + 10).folderTake).toBeGreaterThan(0.9);
    // docked by MT1, resting in their bays
    for (const c of carriersAt(2140)) expect(c.docked).toBe(true);
    // each waits wholly inside the dispatch housing until it is pushed out (nothing of it shows before its ride)
    for (const id of IDS) {
      const p = carrierAt(id, RIDE_FRAMES[id].out)!;
      expect(p.p[0] - HALF[id][0], id).toBeGreaterThanOrEqual(DISPATCH_HOUSING.box.x0);
      expect(p.p[0] + HALF[id][0], id).toBeLessThanOrEqual(DISPATCH_HOUSING.box.x1);
    }
  });

  it('keeps every dispatched carrier whole and in view: over every wall, slot and pin it passes, clear of the deck’s legs, never under the rails, the mouth or the drawer', () => {
    const pose = deskCamera(FRAMING_B, 15);
    const C = pose.pos as P3;
    const boxes = [
      { x0: DECK.x0, x1: DECK.x1, y0: DECK.y0, y1: DECK.y0 + DECK.rail, z0: DECK.railZ0, z1: DECK.top },
      { x0: DECK.x1 - DECK.rail, x1: DECK.x1, y0: DECK.y0, y1: DECK.y1, z0: DECK.railZ0, z1: DECK.top },
      { ...DRAWER.box, z0: DRAWER.z[0], z1: DRAWER.z[1] },
      { ...MOUTH.box, z0: MOUTH.z[0], z1: MOUTH.z[1] },
    ];
    // whether the line from a point to the camera passes through a box (slab test)
    const hidden = (P: P3, B: (typeof boxes)[number]): boolean => {
      let t0 = 1e-4;
      let t1 = 1;
      const lo = [B.x0, B.y0, B.z0];
      const hi = [B.x1, B.y1, B.z1];
      for (let k = 0; k < 3; k++) {
        const d = C[k] - P[k];
        let a = (lo[k] - P[k]) / d;
        let b = (hi[k] - P[k]) / d;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, b);
        if (t0 > t1) return false;
      }
      return true;
    };
    const segDist = (p: P3, a: P3, b: P3): number => {
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
      return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t);
    };
    for (const id of IDS) {
      const F = RIDE_FRAMES[id];
      for (let f = F.ramp; f < F.dock; f++) {
        for (const P of samples(id, carrierAt(id, f)!)) {
          const at = `${id} f${f} (${P.map((v) => v.toFixed(0)).join(',')})`;
          for (const b of IDS) {
            for (const w of bayWalls(BAYS[b])) if (P[0] >= w.x0 && P[0] <= w.x1 && P[1] >= w.y0 && P[1] <= w.y1) expect(P[2], `${at} over ${b}'s wall`).toBeGreaterThan(BAYS[b].wallH + 1.5);
            const sl = BAYS[b].slot;
            if (P[0] >= sl.x0 && P[0] <= sl.x1 && P[1] >= sl.y0 && P[1] <= sl.y1) expect(P[2], `${at} over ${b}'s slot`).toBeGreaterThan(33);
          }
          if (P[0] >= PINS.x0 - 6 && P[0] <= PINS.x0 + PINS.dx * (PINS.n - 1) + 6 && Math.abs(P[1] - PINS.y) < 5) expect(P[2], `${at} over the pins`).toBeGreaterThan(BENCH.z[1] + PINS.h + 2);
          // never under the slate (touching down and lifting off level: no end dipped into the desk)
          expect(P[2], `${at} under the slate`).toBeGreaterThanOrEqual(1.35);
          if (f >= BEAT_4.dispatchTests && Math.hypot(P[0] - TOWER.x, P[1] - TOWER.y) < TOWER.r + 4) expect(P[2], `${at} over the tower`).toBeGreaterThan(towerTop() + 10);
          for (const s of LEG_STRUTS) expect(segDist(P, s.top, [s.foot[0], s.foot[1], 0]), `${at} through a leg`).toBeGreaterThan(LEG_R + 1);
          if (f >= F.groove) for (const B of boxes) expect(hidden(P, B), `${at} out of sight`).toBe(false);
        }
      }
    }
  });

  it('brings the request down onto its folder clear of the pins and their flags: its north edge south of the flags before it is as low as their tops (dense samples, every frame)', () => {
    // each flag lies flat on its pin's top (objects/Bay.tsx PinFlag: 22 u along x, from 2 to 22 u south of the pin, its
    // enamel and graphite faces 2.4 u thick), the pins' posts up to their tops
    const top = BENCH.z[1] + PINS.h + 1.3;
    const F = RIDE_FRAMES.bug;
    const [hl, hw] = HALF.bug;
    for (let f = F.groove; f <= F.dock + 11; f++) {
      const c = carrierAt('bug', f)!;
      for (let i = 0; i <= 40; i++)
        for (let j = 0; j <= 20; j++) {
          const a = -1 + i / 20;
          const w = -1 + j / 10;
          const ax = a * hl * Math.cos(c.slope);
          const P: P3 = [c.p[0] + ax * Math.cos(c.heading) - w * hw * Math.sin(c.heading), c.p[1] + ax * Math.sin(c.heading) + w * hw * Math.cos(c.heading), c.p[2] + a * hl * Math.sin(c.slope)];
          const overPins = P[0] >= PINS.x0 - 12 && P[0] <= PINS.x0 + PINS.dx * (PINS.n - 1) + 12 && P[1] >= PINS.y - 23 && P[1] <= PINS.y + 5;
          // (its underside 0.3 u under its centre plane, 1.2 u clear of a flag's top)
          if (overPins) expect(P[2] - 0.3, `f${f} (${P.map((v) => v.toFixed(0)).join(',')}) through the pins' flags`).toBeGreaterThan(top + 1.2);
        }
    }
  });

  it('darkens each carrier into its dock’s shade over the frames before the shade takes it (all of its top in one frame: it comes down level), never stepping its tone', () => {
    const tops: Record<BayId, [number, number]> = { bug: [0.6, 0.8], tests: [0.4, 0.4], docs: [0.4, 0.4] };
    for (const id of IDS) {
      const F = RIDE_FRAMES[id];
      const zs = (f: number) => samples(id, carrierAt(id, f)!).map((P) => P[2]);
      const S = SHADE_IN[id];
      // the frame before: its whole top over the shade's top; on it: its whole top under it
      expect(Math.min(...zs(S - 1)) + tops[id][0], id).toBeGreaterThan(DOCK_SHADE_TOP[id] + 0.02);
      expect(Math.max(...zs(S)) + tops[id][1], id).toBeLessThan(DOCK_SHADE_TOP[id] - 0.02);
      expect(shadeAt(S - 1, id)).toBe(1);
      expect(shadeAt(S, id)).toBe(0);
      expect(shadeAt(S - 1 - SHADE_RAMP, id)).toBe(0);
      for (let f = F.out; f < F.dock + 12; f++) if (f !== S) expect(Math.abs(shadeAt(f, id) - shadeAt(f - 1, id)), `${id} f${f}`).toBeLessThan(0.55);
      expect(carrierAt(id, S - 2)!.shade, id).toBeGreaterThan(0.5);
      // it docks under the shade, as still (b) has it
      expect(Math.max(...zs(F.dock)) + tops[id][1], id).toBeLessThan(DOCK_SHADE_TOP[id]);
    }
    expect(REQUEST_SHADE_IN).toBe(SHADE_IN.bug);
    expect(DOCK_SHADE_TOP.bug).toBe(PIN_SHADE_TOP);
    // the shaders' rule SHADE_IN is built on: a footprint is skipped when z1 <= zr + 0.5 (and the lit materials pass a
    // surface at z as the receiver z - 0.5, gl/materials.ts), so a surface is under a footprint exactly when z < z1
    expect(LIGHT_GLSL).toContain('if (z1 <= zr + 0.5) continue;');
  });

  it('moves the request as one body: out of the heap, up the belt, into the throat and under the head, then out of the housing onto its folder (no snap in place, heading or slope)', () => {
    const intake = range(REQUEST_FROM, REQUEST_RIDE.hidden + 1).map((f): [number, Carry | null] => [f, requestAt(f).pose]);
    expectContinuous(intake);
    // hidden only while it is inside the Register (under the head, then waiting until it is dispatched)
    for (const f of range(REQUEST_RIDE.hidden + 1, RIDE.out)) expect(requestAt(f).pose, `f${f}`).toBeNull();
    expect(REQUEST_RIDE.hidden).toBeLessThan(BEAT_4.requestIn);
    const ride = range(RIDE.out, RIDE.dock + 12).map((f): [number, Carry | null] => [f, requestAt(f).pose]);
    expectContinuous(ride);
    // its crease: gathered to a slight curl before it moves, the same all the way
    for (const f of range(B4.requestRise, REQUEST_RIDE.hidden + 1)) expect(requestAt(f).crease).toBe(requestAt(B4.requestRise).crease);
    // its light through the beetle ramps in and out (never on or off in one frame)
    for (const f of range(REQUEST_FROM, RIDE.dock + 2)) {
      const a = requestAt(f - 1).pose?.transit ?? 0;
      const b = requestAt(f).pose?.transit ?? 0;
      expect(Math.abs(b - a), `f${f}`).toBeLessThan(0.45);
    }
    expect(requestAt(RIDE.dock).pose!.transit).toBe(0);
  });

  it('moves every other carrier as one body: the arrivals up the intake, the CI card and the docs slip down their grooves', () => {
    for (const k of [0, 1]) expectContinuous(range(1800, 1910).map((f): [number, Carry | null] => [f, beat4At(f).arrivals.find((a) => a.kind === (k ? 'chat' : 'ci'))?.pose ?? null]));
    for (const id of ['tests', 'docs'] as const) expectContinuous(range(1990, 2140).map((f): [number, Carry | null] => [f, carriersAt(f).find((c) => c.id === id)?.pose ?? null]));
  });

  it('slides every dispatched carrier down the ramp over its sheet and cheeks, never through them, and never back under its toe', () => {
    for (const id of IDS) {
      const F = RIDE_FRAMES[id];
      for (let f = F.ramp; f <= F.dock; f++) for (const P of samples(id, carrierAt(id, f)!)) expect(P[2], `${id} f${f} (${P.map((v) => v.toFixed(0)).join(',')})`).toBeGreaterThan(rampTopAt(P[0], P[1]) + 0.5);
      // it lands on the slate wholly past the toe (and its cheeks)
      const land = carrierAt(id, F.groove)!;
      expect(land.p[0] - HALF[id][0], id).toBeGreaterThan(RAMP.foot + 0.5);
      expect(land.p[2], id).toBeCloseTo(1.4, 5);
    }
  });

  it('spends a carrier’s push before it touches down and starts its hop from rest (no bounce back), its contact shadow drawing out and in over frames', () => {
    for (const id of IDS) {
      const F = RIDE_FRAMES[id];
      const at = (f: number) => carrierAt(id, f)!;
      const vx = (f: number) => at(f).p[0] - at(f - 1).p[0];
      // horizontal speed eases to nothing at the touchdown (its last frame's step under 3.5 u, 3 px) and out of rest after
      // it: never reversing
      expect(Math.abs(vx(F.groove)), id).toBeLessThan(3.5);
      // one push out of the slit and off the lip: its speed never stops or jumps at the lip (no stop-then-lurch)
      const speed = (f: number) => Math.hypot(at(f).p[0] - at(f - 1).p[0], at(f).p[1] - at(f - 1).p[1], at(f).p[2] - at(f - 1).p[2]);
      for (let f = F.ramp - 2; f <= F.ramp + 3; f++) expect(Math.abs(speed(f + 1) - speed(f)), `${id} f${f}`).toBeLessThan(6);
      for (let f = F.out + 2; f < F.groove; f++) expect(speed(f), `${id} f${f}`).toBeGreaterThan(1);
      expect(Math.hypot(at(F.groove + 1).p[0] - at(F.groove).p[0], at(F.groove + 1).p[1] - at(F.groove).p[1]), id).toBeLessThan(2);
      for (let f = F.ramp + 1; f <= F.groove; f++) expect(vx(f), `${id} f${f}`).toBeGreaterThanOrEqual(0);
      // its velocity turns smoothly on the hop (no kink: the direction turns under 0.5 rad a frame once it moves)
      for (let f = F.groove + 2; f < F.dock - 1; f++) {
        const a = at(f - 1).p;
        const b = at(f).p;
        const c = at(f + 1).p;
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
        const lu = Math.hypot(u[0], u[1], u[2]);
        const lv = Math.hypot(v[0], v[1], v[2]);
        if (lu < 1 || lv < 1) continue;
        expect(Math.acos(Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv))), `${id} f${f}`).toBeLessThan(0.5);
      }
      // its contact shadow: drawn out as it lifts off and in as it settles (never all at once mid-ride)
      for (let f = F.groove + 1; f < F.dock; f++) expect(Math.abs((at(f).contact ?? 0) - (at(f - 1).contact ?? 0)), `${id} f${f}`).toBeLessThan(0.7);
    }
  });

  it('never spins a dispatched carrier round: it turns only from the ramp’s heading to its dock’s', () => {
    // the whole turn from the ramp's foot to rest (radians): nose first it was about 4.4 (the request) and 6 (the CI card, the docs slip)
    const most: Record<BayId, number> = { bug: 0.1, tests: 0.01, docs: 0.01 };
    for (const id of IDS) {
      const F = RIDE_FRAMES[id];
      let turn = 0;
      for (let f = F.groove + 1; f <= F.dock; f++) turn += dTurn(carrierAt(id, f - 1)!.heading, carrierAt(id, f)!.heading);
      expect(turn, id).toBeLessThan(most[id]);
    }
  });

  it('settles the pieces that lay on the request and presses the heap flat as history: never through the slate, never floating, stepped down', () => {
    const onReq = HEAP.filter((p) => Math.abs(p.z - (REQUEST_HEAP.z + ON_REQUEST)) < 1e-6);
    expect(onReq.length).toBeGreaterThan(0);
    // settled onto what lay under the request once it has slid out (no piece left at its old height)
    for (const p of onReq) expect(heapPieceAt(p.z, true, heapAt(REQUEST_RIDE.post + 3)).z).toBeCloseTo(REQUEST_HEAP.z, 6);
    for (const f of range(B4.requestRise, 2140)) {
      const h = heapAt(f);
      const g = heapAt(f - 1);
      for (const p of HEAP) {
        const on = onReq.includes(p);
        const fl = heapFloor(p.c, p.rot, PIECE[p.kind][0], PIECE[p.kind][1], p.z);
        const a = heapPieceAt(p.z, on, g, fl);
        const b = heapPieceAt(p.z, on, h, fl);
        // never pressed through what it lies on (the CI feeder's mouth card)
        if (fl > 0) expect(b.z, `f${f}`).toBeGreaterThan(fl);
        expect(b.z, `f${f}`).toBeGreaterThan(0.1);
        // pressed on spring-heavy: a press (at most 4 u a frame, about 3 px), never a jump
        expect(Math.abs(b.z - a.z), `f${f}`).toBeLessThan(4);
      }
    }
    // pressed flat and stepped by (b), and it stays (never dropped through a hatch: no heap hole exists)
    const b = heapAt(2225);
    expect(b.press).toBeGreaterThan(0.999);
    expect(b.step).toBe(1);
    for (const p of HEAP) {
      const fl = heapFloor(p.c, p.rot, PIECE[p.kind][0], PIECE[p.kind][1], p.z);
      expect(heapPieceAt(p.z, onReq.includes(p), b, fl).z).toBeLessThan(fl + 1.6);
    }
    // the pieces spilled over the CI feeder's mouth card press onto it
    expect(HEAP.filter((p) => heapFloor(p.c, p.rot, PIECE[p.kind][0], PIECE[p.kind][1], p.z) > 0).length).toBeGreaterThan(0);
    // its shadows draw in under its pieces before they stop casting (nothing pops at the stop)
    const last = heapFootprintsAt(heapAt(B4.heapPress + HEAP_CAST - 1));
    expect(last.length).toBeGreaterThan(0);
    for (const fp of last) if (fp.kind === 'rect') expect(fp.contact).toBeLessThan(0.002);
    expect(heapFootprintsAt(heapAt(B4.heapPress + HEAP_CAST))).toEqual([]);
  });

  it('prints the tape row by row, and leaves (b)’s window for MT1’s stamp-in: docs, CI, the request, the first chat slip', () => {
    expect(TAPE_ROWS.map((r) => r.cells.length)).toEqual([1, 2, 2, 3, 4]);
    const last = TAPE_ROWS[TAPE_ROWS.length - 1].cells;
    expect(last.map((c) => c.kind)).toEqual(CELLS_BEFORE.slice(0, 4).map((c) => c.kind));
    expect(last.map((c) => !!c.request)).toEqual(CELLS_BEFORE.slice(0, 4).map((c) => c.request));
    expect(CELLS.slice(1).map((c) => c.kind)).toEqual(last.map((c) => c.kind));
    // the Thread's mark is inked into the request's own row (no tape advance)
    expect(TAPE_ROWS[2].at.detent).toBeNull();
    expect(TAPE_ROWS[2].cells.find((c) => c.request)!.thread).toBe(true);
    expect(tapeAt(2140)).toEqual({ row: TAPE_ROWS.length - 1, stage: 2, advance: 0 });
    expect(cellLitAt(2140)).toBeGreaterThan(0.99);
    expect(cellLitAt(2200)).toBeLessThan(0.01);
  });

  it('brings the reel from the coil’s lock to the Register’s rest by MT1, so (b) to (d) keep their reel', () => {
    const twoPi = 2 * Math.PI;
    expect(((SPIN_TOTAL % twoPi) + twoPi) % twoPi).toBeCloseTo(REEL_LOCK, 9);
    expect(reelAt(TURN_SPAN[1] + 1)).toBeCloseTo(REEL_LOCK, 9);
    expect(Math.abs(reelAt(2140))).toBeLessThan(1e-6);
  });

  it('turns the arm to each bay and ticks it visibly on beats 2 and 4 under N2 (each tick clicking home on its beat), resting at the docs galley for MT1', () => {
    expect(armAt(B4.armBug - DETENT_LEAD)).toBeCloseTo(DETENT.tests, 9);
    expect(armAt(2100)).toBeCloseTo(armRest(), 6);
    for (const t of B4.ticks) {
      // off its notch by most of a tick (about 8 px at its tip) a few frames before the beat, home on the beat
      const peak = Math.max(...range(t - 10, t).map((f) => Math.abs(armAt(f) - armAt(t))));
      expect(peak, `tick ${t}`).toBeGreaterThan(0.75 * TICK);
      expect(Math.abs(armAt(t) - armAt(t + 3)), `tick ${t}`).toBeLessThan(0.003);
    }
    expect(B4.ticks).toEqual([1820, 1860, 1900, 1940]);
    expect(MT1.dispatchFresh).toBe(EVENTS_D.rise);
  });

  it('brings each counterfactual in from beyond the frame’s top edge and takes it back off it (never appearing or vanishing), one at a time, with everything else stepped down and the light on it', () => {
    const pose = deskCamera(FRAMING_B, 15);
    const offFrame = (c: { c: P3; tilt: number }) => {
      // its lowest edge, on screen: above the frame's top
      const p: P3 = [c.c[0], c.c[1] - (CARD_SPOT.h / 2) * Math.cos(c.tilt), c.c[2] - (CARD_SPOT.h / 2) * Math.sin(c.tilt)];
      return project(pose, p)[1] < 0;
    };
    for (const which of ['split', 'ghost'] as const) {
      const c = B4[which];
      const first = cardAt(c.rise, c)!;
      const lastF = c.strike - 1 + CARD_STRIKE + CARD_EXIT - 1;
      // the frame before it is drawn (a zero-in pose) and on the last frame it is drawn, it is wholly off the frame: it
      // never appears or vanishes in view
      expect(offFrame(cardPose({ ...first, rise: 0 }, which))).toBe(true);
      expect(cardAt(lastF + 1, c)).toBeNull();
      expect(offFrame(cardPose(cardAt(lastF, c)!, which))).toBe(true);
      // and it slides: never more than a third of its way in a frame
      for (let f = c.rise; f <= lastF; f++) expect(Math.abs(cardIn(cardAt(f, c)) - cardIn(cardAt(f - 1, c))), `${which} f${f}`).toBeLessThan(0.34);
      expect(cardAt(c.rise + CARD_RISE - 1, c)!.rise).toBe(1);
      // its first move shows on its cue: part of it is in the frame
      expect(offFrame(cardPose(first, which)), which).toBe(false);
      // the focus: everything but the card steps down while it is up, further than a beat's step (the card the one lit paper)
      const beat = FOCUS_BEATS.find((b) => b.id === which)!;
      expect(beat.from).toBeLessThanOrEqual(c.rise);
      expect(stepAt(c.strike).amount).toBe(1.5);
      expect(stepAt(c.strike).ids).toContain('deck');
      // and the light is on it
      expect(poolsAt(deskStateAt(c.strike)).some((p) => p.c[0] === CARD_AT[which].at[0] && p.rgb[0] > 0.5)).toBe(true);
    }
    // the ghost Router leaves the real index arm at full contrast (it keeps its beat)
    expect(stepAt(B4.ghost.strike).ids).not.toContain('index');
    for (let f = 1600; f < 2140; f++) {
      const b = beat4At(f);
      expect(Number(b.cards.split !== null) + Number(b.cards.ghost !== null)).toBeLessThanOrEqual(1);
    }
  });


  it('takes each counterfactual’s cast shadow off the frame with it: never on the desk while the card is beyond the top edge', () => {
    const pose = deskCamera(FRAMING_B, 15);
    const cardOut = (c: { c: P3; tilt: number }) => project(pose, [c.c[0], c.c[1] - (CARD_SPOT.h / 2) * Math.cos(c.tilt), c.c[2] - (CARD_SPOT.h / 2) * Math.sin(c.tilt)])[1] < 0;
    // the shadow's southmost reach on a receiver at height zr (the slate, the deck's rails): its footprint's south edge,
    // carried down the key from its top, and half its penumbra
    const shadeOut = (fp: Footprint, zr: number) => {
      if (fp.kind !== 'rect') throw new Error('a card casts a rect');
      const h = fp.z1 - zr;
      const p: P3 = [fp.c[0] + fp.h[0] + 0.78 * 0.84 * h, fp.c[1] - fp.h[1] - 0.64 * 0.84 * h - (4 + 0.22 * h) / 2, zr];
      return project(pose, p)[1] < 0;
    };
    for (const which of ['split', 'ghost'] as const) {
      const c = B4[which];
      const lastF = c.strike - 1 + CARD_STRIKE + CARD_EXIT - 1;
      let shown = 0;
      for (let f = c.rise; f <= lastF; f++) {
        const st = cardAt(f, c)!;
        const fp = cardFootprint(st, which)!;
        if (cardOut(cardPose(st, which))) for (const zr of [0, 122]) expect(shadeOut(fp, zr), `${which} f${f} z${zr}`).toBe(true);
        else shown++;
        // at its place it casts where it hovers
        if (cardIn(st) >= CARD_SHADE_CLEAR.k) expect(cardShadeShift(st)).toBe(0);
      }
      expect(shown).toBeGreaterThan(20);
      expect(cardShadeShift(cardAt(lastF, c)!)).toBeCloseTo(CARD_SHADE_CLEAR.u, 6);
    }
  });
  it('winds the notes loop’s riders in at the rim with the request’s detent (from rest at the turn’s end, nothing moving before the reel does, the detent only once the request is at the head), and ramps the request’s beetle light out before the head can cut it off', () => {
    expect(ridersAt(TURN_SPAN[1] + 1)!.sink).toBe(0);
    expect(RIDERS_WIND.frames).toBeGreaterThanOrEqual(8);
    expect(RIDERS_WIND.from).toBeGreaterThan(TURN_SPAN[1]);
    expect(ridersAt(RIDERS_WIND.from + RIDERS_WIND.frames)).toBeNull();
    // the reel holds still until the request lies at the head (its nose at the head's edge), and the riders hold with it
    for (let f = TURN_SPAN[1] + 1; f <= RIDERS_WIND.from; f++) {
      expect(reelAt(f), `f${f}`).toBe(REEL_LOCK);
      expect(ridersAt(f)!.sink, `f${f}`).toBe(0);
    }
    expect(reelAt(RIDERS_WIND.from + 1)).toBeLessThan(REEL_LOCK);
    expect(ridersAt(RIDERS_WIND.from + 1)!.sink).toBeGreaterThan(0);
    expect(REQUEST_RIDE.inThroat).toBeLessThanOrEqual(RIDERS_WIND.from);
    // the light through the beetle is out once the request's east end (the beetle) is under the head, 2 f into its feed
    expect(requestAt(REQUEST_RIDE.feed + 2).pose!.transit).toBe(0);
    for (let f = REQUEST_RIDE.inThroat; f <= REQUEST_RIDE.feed + 2; f++) expect(Math.abs(requestAt(f).pose!.transit - requestAt(f - 1).pose!.transit), `f${f}`).toBeLessThan(0.45);
  });

  it('keeps the test tower’s cap shut while the tower rises and swings it open as its task lands, before its lamps light', () => {
    const rise = BEAT_4.dispatchTests;
    for (let f = rise; f < rise + 20; f++) expect(testsCapOpenAt(f), `f${f}`).toBeCloseTo(0, 9);
    const F = RIDE_FRAMES.tests;
    expect(testsCapOpenAt(F.dock - 2)).toBeCloseTo(0, 9);
    expect(testsCapOpenAt(F.dock + 6)).toBe(1);
    expect(beat4At(F.dock + 6).lamps[0]).toBeCloseTo(0, 9);
  });

  it('casts at most 128 footprints and 8 pools through beat 4', () => {
    for (let f = TURN_SPAN[1]; f < 2140; f += 2) {
      const s = deskStateAt(f);
      expect(footprintsAt(s).length, `f${f}`).toBeLessThanOrEqual(MAX_FOOTPRINTS);
      expect(poolsAt(s).length).toBeLessThanOrEqual(MAX_POOLS);
    }
  });

  it('hands the turn its end: act two at f1660 casts the turn’s footprints (the heap’s with them: desk/turn.ts casts heapFootprintsAt(heapAt(f)))', () => {
    // as a multiset (a capsule either way round, rounded to 0.05 u), as turn.test.ts compares them
    const key = (fp: Footprint): string => {
      const r = (x: number) => (Math.round(x * 20) / 20).toFixed(2);
      if (fp.kind === 'seg') {
        const [a, b] = [`${r(fp.a[0])},${r(fp.a[1])},${r(fp.ha)}`, `${r(fp.b[0])},${r(fp.b[1])},${r(fp.hb)}`].sort();
        return `seg ${a} ${b} ${r(fp.r)}`;
      }
      if (fp.kind === 'canopy') return `canopy ${r(fp.c[0])},${r(fp.c[1])} ${r(fp.h[0])},${r(fp.h[1])} ${r(fp.z)} ${r(fp.strength)}`;
      if (fp.kind === 'circle') return `circle ${r(fp.c[0])},${r(fp.c[1])} ${r(fp.r)} ${r(fp.z0)}-${r(fp.z1)} ${r(fp.contact)}`;
      return `rect ${r(fp.c[0])},${r(fp.c[1])} ${r(fp.h[0])},${r(fp.h[1])} ${r(fp.r)} ${r(fp.rot)} ${r(fp.z0)}-${r(fp.z1)} ${r(fp.contact)}`;
    };
    const f = TURN_SPAN[1];
    const act2 = footprintsAt(deskStateAt(f)).map(key).sort();
    const turn = turnFootprints(turnAt(f)).map(key).sort();
    expect(act2).toEqual(turn);
  });

  it('casts each rising bay’s work where it is drawn, its overshoot included, so no part leaves its footprint; at rest exactly once settled, the floor’s top clear of its own footprint', () => {
    for (const id of IDS) {
      const r = DISPATCH[id].rise;
      const b = BAYS[id];
      const at = (fp: Footprint, c: readonly [number, number]) => fp.kind === 'rect' && Math.abs(fp.c[0] - c[0]) < 1e-6 && Math.abs(fp.c[1] - c[1]) < 1e-6;
      const isDossier = (fp: Footprint) => at(fp, rectC(b.dossier));
      const isFloor = (fp: Footprint) => at(fp, rectC(b.box)) && fp.kind === 'rect' && Math.abs(fp.h[0] - (b.box.x1 - b.box.x0) / 2) < 1e-6;
      for (let f = r + 10; f <= r + 70; f++) {
        const s = deskStateAt(f);
        const lift = workLift(s.b4.bays[id], id);
        const fps = footprintsAt(s);
        const dossier = fps.find(isDossier);
        const floor = fps.find(isFloor);
        expect(dossier && floor, `${id} f${f}`).toBeTruthy();
        // the dossier's footprint rides with it (its top always 1.8 u under the footprint's: the same shade every frame)
        if (dossier?.kind === 'rect') expect(dossier.z1 - lift, `${id} f${f}`).toBeCloseTo(BAY_FLOOR + 4 + b.sheets * SHEET, 6);
        // the floor plate's top stands clear over its own footprint (never a coin flip of its own shade)
        if (floor?.kind === 'rect') expect(BAY_FLOOR + lift - floor.z1, `${id} f${f}`).toBeGreaterThan(0.2);
        // its spring's last wobble is rest exactly
        if (f >= r + 20) expect(lift, `${id} f${f}`).toBe(0);
      }
    }
    expect(liftOf(1 - WORK_REST / 200, 100)).toBe(0);
    expect(liftOf(0.5, 100)).toBe(-50);
  });

  it('keeps a closed bay’s look for the turn to draw: no hole, no work, its lid on the slate', () => {
    for (const id of IDS) {
      const d = bayDispatchAt(TURN_SPAN[1], id);
      expect(d.hole).toBe(false);
      expect(d.hatch).toBe(0);
      expect(rectC(BAYS[id].box)).toBeTruthy();
    }
  });
});
