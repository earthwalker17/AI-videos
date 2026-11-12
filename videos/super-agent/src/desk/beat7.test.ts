import { describe, expect, it } from 'vitest';
import { BEAT_7, at } from '../cues.ts';
import {
  BUILT,
  CAPSULE,
  CLIP_S,
  CORD_L,
  DOSSIER,
  DOSSIER_IN_X,
  E7,
  ENTRY,
  FOCUS_7,
  GATE,
  GLASS_REST,
  LAMP_7,
  ARM_7,
  NOTICES,
  OVAL_AWAY,
  PLATE_RISE,
  PORT,
  RIDER,
  S_MAST,
  SAG,
  SHELF,
  SLOT_LIE,
  SPOT_7,
  STOP_S,
  TAGS_7,
  TALLY,
  beat7At,
  capsuleAt,
  cordAt,
  cordHeadAt,
  cordStatic,
  dossierAt,
  footprints7,
  gateAt,
  glassAt,
  noticeInk,
  ovalAwayAt,
  productivePlateAt,
  railAt,
  receiptAt,
  replies7,
  riderAt,
  rideS,
  sagAt,
  spoolAt,
  tallyAt,
  tallyLength,
} from './beat7.ts';
import { CI_MOUTH } from './beat6.ts';
import { cardAt, cardPose, cardSize } from './beat4.ts';
import { FRAMING_B, deskCamera, project } from './camera.ts';
import { BAYS, CORDS, DECK, FEEDERS, MAST, PINS, BENCH, SPOOL } from './layout.ts';
import { DETENT, armOf, deskStateAt, focusAt, stepAt, type DeskState } from './state.ts';
import { DOCKED, JOB_RAIL, SEAM_D, summaryDeskState } from './summary.ts';
import { polySegs, segFp } from './fpKit.ts';

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('beat 7: its frames and what it hands the summary', () => {
  it('is built, lives from cord-out to the seam, and matches still (d)’s numbers where the summary takes over', () => {
    expect(BUILT).toBe(true);
    expect(E7.until).toBe(SEAM_D);
    expect(beat7At(E7.cordOut - 1)).toBeNull();
    expect(beat7At(E7.cordOut)).not.toBeNull();
    expect(beat7At(SEAM_D - 1)).not.toBeNull();
    expect(beat7At(SEAM_D)).toBeNull();
    expect(SHELF).toEqual(JOB_RAIL);
    expect([PORT.to, PORT.from]).toEqual([CI_MOUTH.to, CI_MOUTH.from]);
    // the glass docks where still (d) keeps it, in still (d)'s body
    const g = glassAt(BEAT_7.glass.dock + 10)!;
    expect(g.p).toEqual(DOCKED.glass);
    expect(g.morph).toBe(1);
    // the station is still (d)'s shelf alone from bar 50: the oval has sunk into its hatch and the hatch has shut
    expect(ovalAwayAt(OVAL_AWAY.down + 5)).toBeNull();
    expect(OVAL_AWAY.down + 5).toBeLessThanOrEqual(at(50));
  });

  it('leaves the cord, the guide and the terminal exactly as still (d) draws them before the seam', () => {
    const e = beat7At(SEAM_D - 1)!;
    expect(cordStatic(e.cord)).toBe(true);
    expect(e.guide).toEqual({ arm: 1, post: 1 });
    expect(e.terminal).toBe(1);
    expect(e.spool).toEqual({ colour: 1 });
    // the cord's footprints: the summary's are the stub's (still (d)), act two's last frame starts with the same
    const stub = [segFp([MAST.arm[0], MAST.arm[1], DECK.top - 4], [MAST.x, MAST.y, DECK.top - 4], 4), segFp([MAST.x, MAST.y, DECK.top - 4], [MAST.x, MAST.y, MAST.h], 5), ...polySegs(CORDS.vermilion, 4)];
    expect(footprints7(summaryDeskState(SEAM_D))).toEqual(stub);
    expect(footprints7(summaryDeskState(6000))).toEqual(stub);
    const act = footprints7(deskStateAt(SEAM_D - 1));
    expect(act.slice(0, stub.length)).toEqual(stub);
    expect(cordStatic(cordAt(E7.slack[1]))).toBe(true);
    expect(cordStatic(cordAt(E7.slack[1] - 1))).toBe(false);
  });
});

describe('7.1 the Thread', () => {
  it('pays out at 1400 u/s from cord-out, its end bead docked in the terminal on cordTaut', () => {
    expect(cordHeadAt(E7.cordOut)).toBe(0);
    expect(cordHeadAt(E7.taut)).toBeCloseTo(CORD_L, 6);
    let max = 0;
    for (let f = E7.cordOut + 1; f <= E7.taut; f++) max = Math.max(max, cordHeadAt(f) - cordHeadAt(f - 1));
    // its even pace (gathering speed over 3 f and easing into the terminal over 3 f)
    expect(max * 30).toBeGreaterThan(1400);
    expect(max * 30).toBeLessThan(1700);
  });
  it('raises the guide before the cord reaches it and the terminal before the bead docks', () => {
    const reachMast = Array.from({ length: 60 }, (_, i) => E7.cordOut + i).find((f) => cordHeadAt(f) >= S_MAST)!;
    expect(beat7At(reachMast - 4)!.guide).toEqual({ arm: 1, post: 1 });
    expect(beat7At(E7.taut - 4)!.terminal).toBe(1);
  });
  it('droops 8% as it comes out, settles to 3% on cordSettled, holds still, and loses the rest under bar 50’s move', () => {
    expect(sagAt(E7.taut)).toBeCloseTo(SAG.out, 6);
    expect(sagAt(E7.settled)).toBeCloseTo(SAG.active, 9);
    // dead still from cordSettled to the move (no creep on the hold)
    for (let f = E7.settled; f <= E7.slack[0]; f++) expect(sagAt(f), `f${f}`).toBe(sagAt(E7.settled));
    expect(E7.slack[0]).toBeGreaterThanOrEqual(at(50));
    expect(E7.slack[1]).toBeLessThanOrEqual(at(50) + 80);
    expect(sagAt(E7.slack[1])).toBe(0);
  });
  it('raises the gate with the terminal and has it open 4 f before the first follow-up arrives, open from then on', () => {
    expect(gateAt(E7.taut - 4)).toEqual({ rise: 1, open: 0 });
    for (const r of BEAT_7.riders) expect(gateAt(r.arrive - 4).open).toBe(1);
    expect(gateAt(SEAM_D - 1)).toEqual({ rise: 1, open: 1 });
    // between the bay's own door and the terminal
    expect(GATE.x0).toBeGreaterThan(BAYS.bug.door[1]);
    expect(GATE.x1).toBeLessThan(CORDS.vermilion[CORDS.vermilion.length - 1]![0] - 4);
  });
  it('gives the spool its vermilion over 6 f as the cord leaves it (it does not turn: objects/Intake.tsx)', () => {
    expect(spoolAt(E7.cordOut)).toEqual({ colour: 0 });
    expect(spoolAt(E7.colour[1])).toEqual({ colour: 1 });
  });
  it('rides each follow-up across the guide on its cue and stops it at the cord’s end on arrival', () => {
    for (const r of BEAT_7.riders) {
      expect(rideS(r, r.guide)).toBeCloseTo(S_MAST, 1);
      expect(rideS(r, r.arrive)).toBeCloseTo(STOP_S, 6);
    }
  });
  it('moves every follow-up continuously from the spout to the slot, clear of the spool, the wall and the terminal', () => {
    const wall = BAYS.bug;
    const term = CORDS.vermilion[CORDS.vermilion.length - 1]!;
    for (const [i, r] of BEAT_7.riders.entries()) {
      const E = ENTRY[i]!;
      let prev: ReturnType<typeof riderAt> = null;
      for (let f = r.spout; f < E.gone; f++) {
        const x = riderAt(i, f)!;
        expect(x, `r${i} f${f}`).not.toBeNull();
        if (prev && f > r.spout + 5) expect(dist(x.p, prev.p), `r${i} f${f}`).toBeLessThan(62);
        // the slip's corners (lying flat) in plan
        const c = Math.cos(x.heading);
        const sn = Math.sin(x.heading);
        const corners = [-1, 1].flatMap((a) => [-1, 1].map((b) => [x.p[0] + c * a * (RIDER.l / 2) - sn * b * (RIDER.w / 2), x.p[1] + sn * a * (RIDER.l / 2) + c * b * (RIDER.w / 2)] as const));
        // never through the spool's flange (r 30, top 110) on its way up to the cord
        if (x.p[2] < 112) for (const q of corners) expect(Math.hypot(q[0] - SPOOL.x, q[1] - SPOOL.y), `r${i} f${f}`).toBeGreaterThan(SPOOL.r + 1);
        // off the cord: over the north wall (y 80..90) above the wall's top, and above the terminal's top wherever it is over it
        if (f > r.arrive && x.roll === 0) {
          const ys = corners.map((q) => q[1]);
          const xs = corners.map((q) => q[0]);
          if (Math.min(...ys) < wall.box.y1 && Math.max(...ys) > wall.box.y1 - wall.wall) expect(x.p[2], `r${i} f${f}`).toBeGreaterThan(wall.wallH + 1);
          if (Math.max(...xs) > term[0] - 6 && Math.min(...ys) < term[1] + 6 && Math.max(...ys) > term[1] - 6) expect(x.p[2], `r${i} f${f}`).toBeGreaterThan(term[2] + 3);
        }
        prev = x;
      }
      expect(riderAt(i, E.gone)).toBeNull();
      // through the gate by its enter cue (its south edge past the wall's middle), lying on the slot for a beat, fed in on its edge
      expect(riderAt(i, r.enter)!.p[1] - RIDER.w / 2).toBeLessThan(GATE.y);
      expect(riderAt(i, E.land)!.p).toEqual(SLOT_LIE);
      expect(riderAt(i, E.feed - 1)!.p).toEqual(SLOT_LIE);
      expect(E.feed - E.land).toBeGreaterThanOrEqual(15);
      expect(riderAt(i, E.gone - 1)!.roll).toBeCloseTo(Math.PI / 2, 9);
      expect(riderAt(i, E.gone - 1)!.p[2] + RIDER.w / 2).toBeLessThan(30);
    }
    expect(CLIP_S).toBeGreaterThan(100);
  });
  it('inks a notice on the tape as each follow-up crosses the guide (no detent)', () => {
    BEAT_7.riders.forEach((r, i) => {
      expect(noticeInk(r.guide - 2)[i]).toBe(0);
      expect(noticeInk(r.guide + 2)[i]).toBe(1);
    });
    // in the gap between the last stub east of the window (to x 33) and the next (from x 51)
    expect(NOTICES.every((n) => n.x - n.w / 2 > 33 && n.x + n.w / 2 < 51)).toBe(true);
    expect(ARM_7.map((a) => a.at)).toEqual([BEAT_7.reply.indexWest]);
  });
});

describe('7.2 the tally', () => {
  it('feeds out from the frame before its cue (its lead showing on the cue), a tick a beat after, and back in as C18 ends', () => {
    expect(tallyAt(BEAT_7.tally.print - 1)).toBeNull();
    expect(tallyAt(BEAT_7.tally.print)!.len).toBeGreaterThan(2);
    expect(tallyAt(BEAT_7.tally.print)!.len).toBeLessThan(12);
    let prev = 0;
    for (let f = BEAT_7.tally.print; f < TALLY.back[0]; f++) {
      const len = tallyAt(f)!.len;
      expect(len - prev, `f${f}`).toBeLessThan(34);
      prev = len;
    }
    expect(tallyAt(3599)!.n).toBe(TALLY.first + 1);
    expect(tallyAt(3680)!.n).toBe(TALLY.first + TALLY.ticks.length);
    expect(tallyAt(TALLY.back[1])).toBeNull();
    expect(TALLY.back[1]).toBeLessThanOrEqual(3690);
    // the ghost strip is about 1.3x as long as the real one at its strike
    expect(tallyLength(TALLY.ghost) / tallyAt(BEAT_7.tally.ghostStrike)!.len).toBeCloseTo(1.3, 1);
  });
  it('plays both cards in frame at their spots (inside the action band), from and back to beyond the frame’s top edge', () => {
    const pose = deskCamera(FRAMING_B, 15);
    for (const [k, c] of [
      ['tally', { rise: BEAT_7.tally.ghostRise, strike: BEAT_7.tally.ghostStrike }],
      ['door', { rise: BEAT_7.doorGhost.rise, strike: BEAT_7.doorGhost.strike }],
    ] as const) {
      const spot = SPOT_7[k];
      const { w, h, tilt } = cardSize(spot);
      const corners = (c0: readonly number[]) => [-1, 1].flatMap((sx) => [-1, 1].map((sy) => project(pose, [c0[0]! + (sx * w) / 2, c0[1]! + ((sy * h) / 2) * Math.cos(tilt), c0[2]! + ((sy * h) / 2) * Math.sin(tilt)])));
      for (const p of corners(spot.at)) {
        expect(p[0], k).toBeGreaterThan(0);
        expect(p[0], k).toBeLessThan(1920);
        expect(p[1], k).toBeGreaterThan(0);
        expect(p[1], k).toBeLessThan(868);
      }
      expect(Math.max(...corners(spot.off).map((p) => p[1])), k).toBeLessThan(0);
      // in on its rise's cue and gone after its exit
      expect(cardAt(c.rise - 1, c)).toBeNull();
      expect(cardAt(c.rise, c)).not.toBeNull();
      expect(cardAt(c.strike + 12, c)).not.toBeNull();
      expect(cardAt(c.strike + 13, c)).toBeNull();
      void cardPose;
    }
    // the door card plays beside the bay (west of it, over the docs bay), not over it
    const door = project(pose, SPOT_7.door.at);
    const bayW = project(pose, [BAYS.bug.box.x0, 0, 40]);
    expect(door[0] + 140).toBeLessThan(bayW[0]);
    // wholly beyond the top edge by the cue sheet's gone frames
    expect(BEAT_7.tally.ghostStrike + 13).toBeLessThanOrEqual(BEAT_7.tally.ghostGone);
    expect(BEAT_7.doorGhost.strike + 13).toBeLessThanOrEqual(BEAT_7.doorGhost.gone);
  });
});

describe('7.3 the job, the sand-glass and the Productive plate', () => {
  it('raises the rail out of its hatch before the long test lands on it, shuts the hole under it, and sinks the oval after', () => {
    expect(railAt(BEAT_7.peel.rail - 10)!.dz).toBe(0);
    expect(railAt(BEAT_7.peel.rail)!.hole).toBe(false);
    expect(railAt(SEAM_D - 1)).toEqual({ leaves: 0, hole: false, dz: 0 });
    for (let f = 3700; f < 3730; f++) expect(Math.abs(railAt(f)!.dz - railAt(f - 1 < 3700 ? 3700 : f - 1)!.dz), `f${f}`).toBeLessThan(8);
    // the oval goes only once the test has docked back and sunk into the slot
    expect(ovalAwayAt(OVAL_AWAY.open - 1)).toBeNull();
    expect(capsuleAt(OVAL_AWAY.open)).toBeNull();
    for (let f = OVAL_AWAY.open + 1; f < OVAL_AWAY.down + 5; f++) expect(Math.abs(ovalAwayAt(f)!.dz - ovalAwayAt(f - 1)!.dz), `f${f}`).toBeLessThan(4);
  });
  it('raises the long test out of the slit over 4 f, peels it on job-peel, lands it on the rail on its cue, runs a lap and docks it back', () => {
    expect(capsuleAt(BEAT_7.peel.lift - 8)).toBeNull();
    // up out of the slit over 4 f: never more than 6 u a frame
    for (let f = BEAT_7.peel.lift - 7; f < BEAT_7.peel.lift; f++) expect(Math.abs(capsuleAt(f)!.p[2] - (capsuleAt(f - 1)?.p[2] ?? CAPSULE.rest[2])), `f${f}`).toBeLessThan(6);
    expect(capsuleAt(BEAT_7.peel.rail)!.onRail).toBe(true);
    expect(capsuleAt(BEAT_7.peel.rail - 1)!.onRail).toBe(false);
    expect(capsuleAt(BEAT_7.peel.dock)!.p.slice(0, 2)).toEqual(CAPSULE.rest.slice(0, 2));
    // it sinks wholly under the slit (30.3) before it goes
    expect(capsuleAt(BEAT_7.peel.dock + 5)!.p[2] + CAPSULE.r).toBeLessThan(30);
    expect(capsuleAt(BEAT_7.peel.dock + 6)).toBeNull();
    // its squash decays over frames, never a one-frame blip
    expect(capsuleAt(BEAT_7.peel.dock + 1)!.squash).toBeGreaterThan(0);
    expect(capsuleAt(BEAT_7.peel.lift - 1)!.squash).toBeGreaterThan(0);
    expect(capsuleAt(BEAT_7.peel.lift - 2)!.squash).toBeGreaterThan(0);
    // over the bench's pins in the air, the capsule clears their tops
    const pinTop = BENCH.z[1] + PINS.h;
    for (let f = BEAT_7.peel.lift; f <= BEAT_7.peel.dock; f++) {
      const c = capsuleAt(f)!;
      if (Math.abs(c.p[1] - PINS.y) < 14 && c.p[0] > PINS.x0 - 10 && c.p[0] < PINS.x0 + 5 * PINS.dx + 10) expect(c.p[2] - CAPSULE.r, `f${f}`).toBeGreaterThan(pinTop + 2);
    }
    // the receipt: pushed up over 4 f, standing (most of the way) on its cue, back down over 5 f from the dock
    expect(receiptAt(BEAT_7.peel.receipt - 3)).toBeNull();
    expect(receiptAt(BEAT_7.peel.receipt)!).toBeGreaterThan(0.8);
    expect(receiptAt(BEAT_7.peel.receipt + 1)).toBeCloseTo(1, 9);
    expect(receiptAt(BEAT_7.peel.dock + 6)).toBeNull();
  });
  it('lifts the glass off your tray on its lift frame in the tray’s own pose and docks it on its cue in still (d)’s body', () => {
    expect(glassAt(BEAT_7.glass.lift - 1)).toBeNull();
    expect(glassAt(BEAT_7.glass.lift)).toEqual({ p: GLASS_REST, yaw: 0, tilt: 0, squash: 0, lift: 0, morph: 0 });
    expect(glassAt(BEAT_7.glass.dock)!.lift).toBe(0);
    expect(glassAt(BEAT_7.glass.dock - 1)!.lift).toBeGreaterThan(0);
    let prev = glassAt(BEAT_7.glass.lift)!;
    for (let f = BEAT_7.glass.lift + 1; f <= BEAT_7.glass.dock + 4; f++) {
      const g = glassAt(f)!;
      // no faster than beat 5's key (about 2410 px/s at 0.85x: 95 u a frame)
      expect(dist(g.p, prev.p), `f${f}`).toBeLessThan(100);
      prev = g;
    }
    // the plate: up out of its hatch, docked on its cue, the hole shut under it
    expect(productivePlateAt(PLATE_RISE.open - 1)).toBeNull();
    expect(productivePlateAt(PLATE_RISE.rise)!.dz).toBe(-PLATE_RISE.depth);
    expect(productivePlateAt(BEAT_7.glass.plateDock)!.dz).toBe(0);
    expect(productivePlateAt(BEAT_7.glass.plateDock + 5)!.hole).toBe(false);
  });
});

describe('7.4 the replies; the hooks', () => {
  it('rides the chat reply down the chute on its cue frames and nets your lamp back to still (d)’s by bar 50', () => {
    const r = replies7(beat7At(BEAT_7.reply.lands))!;
    expect(r).toHaveLength(1);
    expect(r[0]!.ride.squash).toBe(1);
    expect(replies7(beat7At(BEAT_7.reply.leave - 1))).toEqual([]);
    expect(LAMP_7.reduce((a, x) => a + x.steps, 0)).toBe(0);
    expect(armOf(ARM_7, at(50), 0)).toBeCloseTo(DETENT.you, 9);
  });
  it('lands the dossier on the card feeder’s mouth on its cue and pushes it wholly in (no sender line)', () => {
    const d = dossierAt(BEAT_7.dossier.lands)!;
    expect(d.p[0]).toBe(PORT.to[0]);
    expect(d.squash).toBeGreaterThan(0.05);
    expect(dossierAt(BEAT_7.dossier.lands + 2)!.squash).toBeGreaterThan(0.01);
    // its last frame: its east end inside the feeder's face (under the roller), so nothing of it is left on the mouth
    const last = Array.from({ length: 20 }, (_, i) => BEAT_7.dossier.lands + i).filter((f) => dossierAt(f)).pop()!;
    expect(dossierAt(last)!.p[0] + DOSSIER.l / 2).toBeLessThanOrEqual(FEEDERS.ci.x1);
    expect(DOSSIER_IN_X + DOSSIER.l / 2).toBeLessThanOrEqual(FEEDERS.ci.x1);
    expect(dossierAt(BEAT_7.dossier.lands + 10)).toBeNull();
    // half as large again as the chat reply (layout.ts SLIP 44 x 100)
    expect(DOSSIER.l * DOSSIER.w).toBeGreaterThanOrEqual(1.5 * 44 * 100);
  });
  it('releases its focus by f3906 and has every part back up on bar 50 (beat 8 starts there without a hand-over)', () => {
    expect(Math.max(...FOCUS_7.map((e) => e.to))).toBeLessThanOrEqual(3906);
    const s: DeskState = deskStateAt(at(50));
    const b7 = new Set(FOCUS_7.map((e) => e.id));
    expect(b7.has(focusAt(at(50))?.id ?? '')).toBe(false);
    for (let f = at(50) - 14; f <= at(50); f++) expect(b7.has(focusAt(f)?.id ?? ''), `f${f}`).toBe(false);
    void s;
    // the glass hands over at full: nothing of your desk steps on its lift frame
    expect(stepAt(BEAT_7.glass.lift).ids.includes('you') && stepAt(BEAT_7.glass.lift).amount > 0).toBe(false);
    // no entry starts while another is still ramping out (nothing pumps)
    const sorted = [...FOCUS_7].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.from, sorted[i]!.id).toBeGreaterThanOrEqual(sorted[i - 1]!.to + 14);
  });
  it('places its tags inside title-safe and the action band, each on a cue of its own', () => {
    for (const t of TAGS_7) {
      expect(t.at[0]).toBeGreaterThanOrEqual(96);
      expect(t.at[1] - 40).toBeGreaterThanOrEqual(72);
      const lines = (t.lines?.en.length ?? 1) + (t.lines?.zh.length ?? 1);
      expect(t.at[1] + (lines - 1) * (t.gap ?? 50) + 10).toBeLessThanOrEqual(868);
    }
    expect(TAGS_7.map((t) => t.cue)).toEqual(['tag-jobs', 'tag-100']);
  });
});
