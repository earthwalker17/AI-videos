import { describe, expect, it } from 'vitest';
import { BEAT_7, WORDS, at, cue, textWindow } from '../cues.ts';
import {
  BUILT,
  CAPSULE,
  CAP_SLIT,
  CLIP_S,
  CORD_L,
  DOSSIER,
  DOSSIER_IN_X,
  DOSSIER_LAND_X,
  E7,
  ENTRY,
  FOCUS_7,
  GATE,
  GLASS_REST,
  LAMP_7,
  ARM_7,
  NOTICES,
  OVAL_AWAY,
  OVAL_BOX,
  PLATE_RISE,
  PORT,
  PRODUCTIVE_PLATE,
  RAIL,
  RIDER,
  S_MAST,
  SAG,
  SHELF,
  SLOT_7,
  SLOT_LIE,
  SPOT_7,
  STOP_S,
  TAGS_7,
  TAG_GAP_7,
  TAG_JOBS_LINES,
  TALLY,
  beat7At,
  capsuleAt,
  card7At,
  cardOut7,
  cards7,
  cordAt,
  cordHeadAt,
  cordStatic,
  dossierAt,
  footprints7,
  gateAt,
  glassAt,
  noticeInk,
  ovalAwayAt,
  pools7,
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
import { CI_MOUTH, SPOUT_INSIDE } from './beat6.ts';
import { cardSize } from './beat4.ts';
import { FRAMING_B, deskCamera, project, projectBox, screenToDesk } from './camera.ts';
import { BAYS, CORDS, DECK, FEEDERS, MAST, NEXT_SLIP, PINS, BENCH, REEL_FRAME, REEL_FRAME_Z, SPOOL, TRAIT_PLATE, rectC } from './layout.ts';
import { DETENT, armOf, deskStateAt, focusAt, stepAt, type DeskState } from './state.ts';
import { DOCKED, JOB_RAIL, SEAM_D, summaryDeskState } from './summary.ts';
import { polySegs, segFp } from './fpKit.ts';
import { tagText } from './Overlay.tsx';

const RAIL_RISE_FROM = RAIL.open;
/** How much of the bug bay's lit slit (Bay.tsx: x slot.x0 + 8 .. slot.x1 - 8, its plane at CAP_SLIT.z) the capsule's top stands over at f, in or at its slot. */
function slitCover(f: number): number {
  const c = capsuleAt(f);
  if (!c || Math.abs(c.p[0] - CAPSULE.rest[0]) > 1e-9 || Math.abs(c.p[1] - CAPSULE.rest[1]) > 1e-9) return c ? 1 : 0;
  const [x0, x1] = [BAYS.bug.slot.x0 + 8, BAYS.bug.slot.x1 - 8];
  let n = 0;
  for (let x = x0 + 0.5; x < x1; x++) {
    const a = (x - c.p[0]) / Math.cos(c.slope);
    const axis = c.p[2] + a * Math.sin(c.slope);
    const d = Math.abs(a) - CAPSULE.half;
    const top = d <= 0 ? axis + CAPSULE.r / Math.cos(c.slope) : d <= CAPSULE.r ? axis + Math.sqrt(CAPSULE.r ** 2 - d * d) : -Infinity;
    if (top > CAP_SLIT.z) n++;
  }
  return n / (x1 - x0);
}
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
    // (wave 2: the summary keeps beat 7's parts at rest as act two left them, summary.ts summaryDeskState: across the seam its
    // footprints are act two's last frame's; the worded Productive plate leaves under the ease-out, the cord's stay the stub's)
    expect(footprints7(summaryDeskState(SEAM_D))).toEqual(footprints7(deskStateAt(SEAM_D - 1)));
    expect(footprints7(summaryDeskState(6000)).slice(0, stub.length)).toEqual(stub);
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
  it('slides both cards out of their slots beside what they qualify and back in: opaque, never crossing the frame’s edge, the Continuous plate or the reel', () => {
    const pose = deskCamera(FRAMING_B, 15);
    const plate = projectBox(pose, [
      [TRAIT_PLATE.box.x0, TRAIT_PLATE.box.y0, TRAIT_PLATE.z[1]],
      [TRAIT_PLATE.box.x1, TRAIT_PLATE.box.y1, TRAIT_PLATE.z[1]],
    ]);
    // each slot is the line of a real edge on screen: the real tally's (the reel frame's north member under it), the deck's south rail
    expect(SLOT_7.tally.y).toBeCloseTo(Math.max(project(pose, [REEL_FRAME[1].x0, REEL_FRAME[1].y0, REEL_FRAME_Z[0]])[1], project(pose, [TALLY.x0, TALLY.y - TALLY.w / 2, TALLY.z - TALLY.t])[1]), 6);
    expect(SLOT_7.door.y).toBeCloseTo(project(pose, [DECK.x1, DECK.y0, DECK.railZ0])[1], 6);
    expect(SLOT_7.tally.y).toBeGreaterThan(project(pose, [TALLY.x0, TALLY.y - TALLY.w / 2, TALLY.z])[1]);
    for (const [k, c] of [
      ['tally', { rise: BEAT_7.tally.ghostRise, strike: BEAT_7.tally.ghostStrike }],
      ['door', { rise: BEAT_7.doorGhost.rise, strike: BEAT_7.doorGhost.strike }],
    ] as const) {
      const { w, h, tilt } = cardSize(SPOT_7[k]);
      // the clip plane holds the slot's screen line (through the eye: any point on it projects onto the line), the card's place on its kept side
      const [nx, ny, nz, d] = SLOT_7[k].plane;
      const side = (p: readonly number[]) => nx * p[0]! + ny * p[1]! + nz * p[2]! + d;
      expect(side(SPOT_7[k].at)).toBeGreaterThan(0);
      for (const z of [60, 240, 400]) {
        const q = screenToDesk(pose, [900, SLOT_7[k].y], z);
        expect(Math.abs(side(q)), `${k} z${z}`).toBeLessThan(1e-6);
      }
      // its torn top edge (h/2 - 1.2 at its highest) south of the line at its place: wholly out there
      const topAt = (cc: readonly number[], up: number) => project(pose, [cc[0]!, cc[1]! + up * Math.cos(tilt), cc[2]! + up * Math.sin(tilt)])[1];
      expect(topAt(SPOT_7[k].at, h / 2 - 1.2)).toBeGreaterThan(SLOT_7[k].y);
      // its first move on its cue (a sliver out of the slot), wholly in the slot on its last drawn frame, then gone
      expect(card7At(c.rise - 1, k)).toBeNull();
      expect(cardOut7(card7At(c.rise, k)!, k)).toBeGreaterThan(0.01);
      expect(cardOut7(card7At(c.rise, k)!, k)).toBeLessThan(0.06);
      expect(card7At(c.rise + 11, k)!.back).toBe(0);
      expect(cardOut7(card7At(c.strike + 12, k)!, k)).toBe(0);
      expect(card7At(c.strike + 12, k)!.travel).toBe(0);
      expect(card7At(c.strike + 13, k)).toBeNull();
      // struck on its cue (the pen touching the frame before, as beat 4's)
      expect(card7At(c.strike - 2, k)!.strike).toBe(0);
      expect(card7At(c.strike, k)!.strike).toBeGreaterThan(0);
      let prev: [number, number] | null = null;
      let prevOut = 0;
      for (let f = c.rise; f <= c.strike + 12; f++) {
        const x = card7At(f, k)!;
        const ps = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => project(pose, [x.c[0] + (sx * w) / 2, x.c[1] + ((sy * h) / 2) * Math.cos(tilt), x.c[2] + ((sy * h) / 2) * Math.sin(tilt)])));
        // what is drawn: the card south of its slot's line
        const b = { x0: Math.min(...ps.map((p) => p[0])), x1: Math.max(...ps.map((p) => p[0])), y0: Math.max(SLOT_7[k].y, Math.min(...ps.map((p) => p[1]))), y1: Math.max(...ps.map((p) => p[1])) };
        expect(b.x0, `${k} f${f}`).toBeGreaterThan(0);
        expect(b.x1, `${k} f${f}`).toBeLessThan(1920);
        expect(b.y1, `${k} f${f}`).toBeLessThan(868);
        // clear of the Continuous plate's lettering at every frame (all of the plate is north of the slot)
        expect(plate.y1, `${k} f${f}`).toBeLessThan(SLOT_7[k].y);
        // it slides along its own face (straight down the screen), never faster than 45 px a frame, out (or in) a frame at a time
        const p = project(pose, x.c);
        if (prev) {
          expect(Math.abs(p[0] - prev[0]), `${k} f${f}`).toBeLessThan(0.5);
          expect(Math.hypot(p[0] - prev[0], p[1] - prev[1]), `${k} f${f}`).toBeLessThan(45);
        }
        // how much of it is out moves by at most a third of it a frame (no one-frame swap)
        expect(Math.abs(cardOut7(x, k) - prevOut), `${k} f${f}`).toBeLessThan(0.34);
        prev = p;
        prevOut = cardOut7(x, k);
      }
    }
    // the door card plays beside the bay (west of it, over the docs bay), not over it
    const door = project(pose, SPOT_7.door.at);
    const bayW = project(pose, [BAYS.bug.box.x0, 0, 40]);
    expect(door[0] + 140).toBeLessThan(bayW[0]);
    // gone by the cue sheet's gone frames, and the door card back in its slot before the second follow-up enters
    expect(BEAT_7.tally.ghostStrike + 13).toBeLessThanOrEqual(BEAT_7.tally.ghostGone);
    expect(BEAT_7.doorGhost.strike + 13).toBeLessThanOrEqual(BEAT_7.doorGhost.gone);
    expect(BEAT_7.doorGhost.strike + 12).toBeLessThanOrEqual(BEAT_7.riders[1].enter - 2);
  });
  it('casts and lights its cards itself, at their pose: their light and shadow come out of the slot with them', () => {
    const c = BEAT_7.tally.ghostRise;
    // beat 4's generic path (footprints.ts part2Cards) has none of them
    expect(cards7(deskStateAt(c + 20))).toEqual([]);
    expect(pools7(deskStateAt(c - 1))).toEqual([]);
    const lit = pools7(deskStateAt(c + 20));
    expect(lit).toHaveLength(1);
    expect(pools7(deskStateAt(c + 2))[0]!.rgb[0]).toBeLessThan(lit[0]!.rgb[0]);
    const card = (f: number) => footprints7(deskStateAt(f)).filter((x) => x.kind === 'rect' && x.z0 > 150);
    expect(card(c - 1)).toHaveLength(0);
    expect(card(c + 20)).toHaveLength(1);
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
    // it takes the slate's tone as it sinks (graphite, enamel and steel all the way to the slate: 0.45 of the way a unit),
    // fully by the time its hatch's leaves start to close over it, so they close over a slate-dark track
    expect(stepAt(OVAL_AWAY.open - 1).ids.includes('b7-oval')).toBe(false);
    expect(stepAt(OVAL_AWAY.down).ids).toEqual(['b7-oval']);
    expect(stepAt(OVAL_AWAY.down).amount * 0.45).toBeCloseTo(1, 9);
    expect(ovalAwayAt(OVAL_AWAY.down)!.leaves).toBe(1);
    for (let f = OVAL_AWAY.open + 1; f <= OVAL_AWAY.down; f++) expect(stepAt(f).amount - stepAt(f - 1).amount, `f${f}`).toBeLessThan(0.3);
    for (let f = OVAL_AWAY.open + 1; f < OVAL_AWAY.down + 5; f++) expect(Math.abs(ovalAwayAt(f)!.dz - ovalAwayAt(f - 1)!.dz), `f${f}`).toBeLessThan(4);
  });
  it('raises the long test out of the slit over 5 f, peels it on job-peel, lands it on the rail on its cue, runs a lap and docks it back', () => {
    expect(capsuleAt(BEAT_7.peel.lift - 9)).toBeNull();
    // up out of the slit over 5 f: never more than 6 u a frame
    for (let f = BEAT_7.peel.lift - 7; f < BEAT_7.peel.lift; f++) expect(Math.abs(capsuleAt(f)!.p[2] - capsuleAt(f - 1)!.p[2]), `f${f}`).toBeLessThan(6);
    expect(capsuleAt(BEAT_7.peel.rail)!.onRail).toBe(true);
    expect(capsuleAt(BEAT_7.peel.rail - 1)!.onRail).toBe(false);
    expect(capsuleAt(BEAT_7.peel.dock)!.p.slice(0, 2)).toEqual(CAPSULE.rest.slice(0, 2));
    // the lit slit goes under it a quarter at a time as it comes out, and comes back a quarter at a time as it goes in: no
    // one-frame swap of the slit (session 6's critics), and nothing of it over the slit on the frame it is gone
    const lift = BEAT_7.peel.lift;
    expect(slitCover(lift - 9)).toBe(0);
    for (let f = lift - 8; f <= lift; f++) expect(Math.abs(slitCover(f) - slitCover(f - 1)), `f${f}`).toBeLessThan(0.3);
    expect(slitCover(lift - 4)).toBeGreaterThan(0.95);
    for (let f = BEAT_7.peel.dock; f <= BEAT_7.peel.dock + 6; f++) expect(Math.abs(slitCover(f) - slitCover(f - 1)), `f${f}`).toBeLessThan(0.3);
    expect(slitCover(BEAT_7.peel.dock + 5)).toBeLessThan(0.3);
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
    // as long as the slit allows (Bay.tsx: the slot less 8 u at each end), about 85 px at 0.85x
    expect(2 * CAPSULE.half + 2 * CAPSULE.r).toBeLessThanOrEqual(BAYS.bug.slot.x1 - BAYS.bug.slot.x0 - 16);
    expect(2 * CAPSULE.half + 2 * CAPSULE.r).toBeGreaterThanOrEqual(96);
    // on the rail it never turns, and every point of it stays over the oval's plate (its lap's loop inside the oval)
    for (let f = BEAT_7.peel.rail; f < BEAT_7.peel.dockFrom; f++) {
      const c = capsuleAt(f)!;
      expect(c.heading, `f${f}`).toBe(0);
      expect(c.p[0] - CAPSULE.half - CAPSULE.r, `f${f}`).toBeGreaterThanOrEqual(OVAL_BOX.x0);
      expect(c.p[0] + CAPSULE.half + CAPSULE.r, `f${f}`).toBeLessThanOrEqual(OVAL_BOX.x1);
      expect(c.p[1] - CAPSULE.r, `f${f}`).toBeGreaterThanOrEqual(OVAL_BOX.y0);
      expect(c.p[1] + CAPSULE.r, `f${f}`).toBeLessThanOrEqual(OVAL_BOX.y1);
      if (f > BEAT_7.peel.rail) expect(dist(c.p, capsuleAt(f - 1)!.p), `f${f}`).toBeLessThan(10);
    }
    // a whole lap: it lifts off where it landed
    expect(capsuleAt(BEAT_7.peel.dockFrom - 1)!.p[0]).toBeCloseTo(capsuleAt(BEAT_7.peel.rail)!.p[0], 0);
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
  it('flies the glass clear of the jobs tag’s lines and its leader at every frame of its flight', () => {
    const pose = deskCamera(FRAMING_B, 15);
    const tag = TAGS_7.find((t) => t.cue === 'tag-jobs')!;
    // the tag's block as Overlay.tsx sets it (its longest line, "prototype: background", is about 420 px; 460 allowed)
    const n = tagText(tag).en.length + tagText(tag).zh.length;
    const block = { x0: tag.at[0] - 8, x1: tag.at[0] + 460, y0: tag.at[1] - 40, y1: tag.at[1] + (n - 1) * TAG_GAP_7 + 20 };
    const foot = project(pose, tag.foot);
    for (let f = BEAT_7.glass.lift; f <= BEAT_7.glass.dock; f++) {
      const g = glassAt(f)!;
      // the glass's extent: 22 u round its axis, from just under its rest point to its top (its taller tray body)
      const pts = [-22, 22].flatMap((dx) => [-22, 22].flatMap((dy) => [-12, 56].map((dz) => project(pose, [g.p[0] + dx, g.p[1] + dy, g.p[2] + dz]))));
      const b = { x0: Math.min(...pts.map((q) => q[0])), x1: Math.max(...pts.map((q) => q[0])), y0: Math.min(...pts.map((q) => q[1])), y1: Math.max(...pts.map((q) => q[1])) };
      if (b.x1 > block.x0 && b.x0 < block.x1) expect(b.y1 < block.y0 - 4 || b.y0 > block.y1 + 4, `f${f}`).toBe(true);
      // the leader: from the block's east edge to its foot on the shelf, about level
      if (b.x1 > block.x1 && b.x0 < foot[0]) expect(b.y1 < foot[1] - 6 || b.y0 > foot[1] + 6, `f${f}`).toBe(true);
    }
  });
  it('has the Productive plate rise after the glass docks, its words written on from its dock, and never shades its own face', () => {
    const P = BEAT_7.glass;
    // the hatch shut until the glass has docked, then its leaves part (the plate's face under them blank) as it rises from
    // deep in the pit: its top under the slate until the leaves are three quarters open
    expect(productivePlateAt(P.dock - 1)).toBeNull();
    expect(productivePlateAt(P.dock)).toEqual({ leaves: 0, hole: true, dz: -PLATE_RISE.depth, words: 0 });
    expect(productivePlateAt(P.dock + 1)!.dz).toBeGreaterThan(-PLATE_RISE.depth);
    for (let f = P.dock; f <= P.plateDock; f++) {
      const x = productivePlateAt(f)!;
      if (PRODUCTIVE_PLATE.z[1] + x.dz > 0) expect(x.leaves, `f${f}`).toBeGreaterThanOrEqual(0.75);
      // its leaves part a step at a time (never most of the way in one frame)
      if (f > P.dock) expect(x.leaves - productivePlateAt(f - 1)!.leaves, `f${f}`).toBeLessThanOrEqual(0.5);
    }
    // no word shows before the dock; the first on it; all by 7 f after
    for (let f = PLATE_RISE.open; f < P.plateDock; f++) expect(productivePlateAt(f)!.words, `f${f}`).toBe(0);
    expect(productivePlateAt(P.plateDock)!.words).toBeGreaterThan(0);
    expect(productivePlateAt(P.plateDock + PLATE_RISE.words - 1)!.words).toBe(1);
    // its words never go back (still (d) keeps them)
    expect(productivePlateAt(SEAM_D - 1)!.words).toBe(1);
    // the plate's and the shelf's footprints stay under their own tops as they rise (a footprint over its top shaded it:
    // the plate stepped dark for 6 f and popped back)
    for (let f = RAIL_RISE_FROM; f <= P.plateDock + 6; f++) {
      const s = deskStateAt(f);
      const e = s.e7!;
      for (const x of footprints7(s)) {
        if (x.kind !== 'rect') continue;
        if (e.plate && x.c[0] === (PRODUCTIVE_PLATE.box.x0 + PRODUCTIVE_PLATE.box.x1) / 2 && x.c[1] === (PRODUCTIVE_PLATE.box.y0 + PRODUCTIVE_PLATE.box.y1) / 2) expect(x.z1, `plate f${f}`).toBeLessThan(PRODUCTIVE_PLATE.z[1] + e.plate.dz);
        if (e.rail && x.c[0] === (SHELF.x0 + SHELF.x1) / 2 && x.c[1] === (SHELF.y0 + SHELF.y1) / 2) expect(x.z1, `shelf f${f}`).toBeLessThan(SHELF.z + e.rail.dz);
      }
    }
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
    expect(d.p[0]).toBe(DOSSIER_LAND_X);
    expect(d.p[1]).toBe(PORT.to[1]);
    expect(d.squash).toBeGreaterThan(0.05);
    // it comes down east of the roller and the cards' east edges (objects/Intake.tsx: the roller's axis at x1 - 2, radius 6),
    // its west end never over them in flight and under them on the thud (RV-M3-LIP, c3894-3895); flat from the thud while
    // it is pushed in under them
    for (let f = BEAT_7.dossier.leave; f <= BEAT_7.dossier.lands + 4; f++) {
      const x = dossierAt(f)!;
      const west = x.p[0] - (DOSSIER.l / 2) * (1 + x.squash / 2) * Math.cos(x.slope);
      expect(west, `f${f}`).toBeGreaterThan(FEEDERS.ci.x1 - 2 + 6 + 1);
    }
    for (let f = BEAT_7.dossier.lands; f < BEAT_7.dossier.lands + 10; f++) if (dossierAt(f)) expect(dossierAt(f)!.slope, `f${f}`).toBe(0);
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
      const { en, zh } = tagText(t);
      expect(t.at[1] + (en.length + zh.length - 1) * (t.gap ?? 50) + 10).toBeLessThanOrEqual(868);
    }
    expect(TAGS_7.map((t) => t.cue)).toEqual(['tag-jobs', 'tag-100']);
    // their EN alone (the zh policy), the jobs tag broken where its words break
    for (const t of TAGS_7) expect(tagText(t).zh, t.cue).toEqual([]);
    expect(TAG_JOBS_LINES.en.join(' ')).toBe(WORDS.tagJobs.en);
    // 24 px or more of air under W-08's nameplate (its foot at y 679 at 0.85x) to the first line's ascenders (0.72 of 40 px
    // over its baseline), and from the jobs tag's last line (no descenders: "after 5 s") to the Productive plate's rim (y 814)
    // that it overlaps in x (R2-L3-06)
    for (const t of TAGS_7) expect(t.at[1] - 0.72 * 40 - 679, t.cue).toBeGreaterThanOrEqual(24);
    const jobs = TAGS_7.find((t) => t.cue === 'tag-jobs')!;
    expect(814 - (jobs.at[1] + (tagText(jobs).en.length - 1) * TAG_GAP_7)).toBeGreaterThanOrEqual(24);
    // the 100-word tag (and its leader) only once the reply has landed in the in-tray it points at, inside its cue's window
    const t100 = TAGS_7.find((t) => t.cue === 'tag-100')!;
    expect(t100.from).toBeUndefined();
    expect(textWindow(cue('tag-100'))[0]).toBe(BEAT_7.reply.lands);
  });
});

describe('the heavy dossier keeps one value through its flight and landing (R2-L3-03)', () => {
  it('never puts any of its top under its own footprint: tilted in flight, squashed on the thud, pushed in', () => {
    // (a receiver under a footprint's top is in its shade: gl/materials.ts shades at z − 0.5 against z1 + 0.5. Tilted, its
    // low end sat under it; the landing's 8% squash put its whole top under it for 4 f, c3895-3898: lit, grey, lit)
    let n = 0;
    for (let f = BEAT_7.dossier.leave - DOSSIER.outFrames; f < BEAT_7.dossier.lands + 12; f++) {
      const d = dossierAt(f);
      if (!d) continue;
      n++;
      const own = footprints7(deskStateAt(f)).find((x) => x.kind === 'rect' && x.c[0] === d.p[0] && x.c[1] === d.p[1] && x.h[1] === DOSSIER.w / 2);
      expect(own, `f${f}`).toBeDefined();
      // the lowest point of its top face as drawn (objects/Beat7.tsx: z scaled 1 − squash, length 1 + squash / 2, tilted)
      const low = d.p[2] + (DOSSIER.t / 2) * (1 - d.squash) * Math.cos(d.slope) - (DOSSIER.l / 2) * (1 + d.squash / 2) * Math.abs(Math.sin(d.slope));
      if (own?.kind === 'rect') {
        expect(low, `f${f}`).toBeGreaterThanOrEqual(own.z1 + 0.1);
        expect(own.z0, `f${f}`).toBeLessThan(own.z1);
      }
    }
    expect(n).toBeGreaterThan(30);
    // lying flat and still, the footprint it always had (its shadow on the mouth unchanged)
    const rest = BEAT_7.dossier.lands + 8;
    const d = dossierAt(rest)!;
    const own = footprints7(deskStateAt(rest)).find((x) => x.kind === 'rect' && x.c[0] === d.p[0] && x.h[1] === DOSSIER.w / 2);
    expect(d.squash).toBeLessThan(0.02);
    expect(own?.kind === 'rect' && own.h[0]).toBe(DOSSIER.l / 2);
  });
});

describe('the follow-ups come out of the spout and round the spool clear of it (R2-L3-04)', () => {
  const corners = (r: NonNullable<ReturnType<typeof riderAt>>) =>
    [-1, -0.5, 0, 0.5, 1].flatMap((u) =>
      [-1, 0, 1].map((v) => {
        const x = (u * RIDER.l) / 2;
        const y = (v * RIDER.w) / 2;
        const c = Math.cos(r.heading);
        const sn = Math.sin(r.heading);
        return [r.p[0] + c * x * Math.cos(r.slope) - sn * y, r.p[1] + sn * x * Math.cos(r.slope) + c * y, r.p[2] - x * Math.sin(r.slope)] as const;
      }),
    );
  it('starts wholly inside the chat drum, east of its back wall, so nothing of it shows west of the drum (c3485)', () => {
    const [cx, cy] = rectC(FEEDERS.chat);
    const R = (FEEDERS.chat.y1 - FEEDERS.chat.y0) / 2;
    const back = (y: number) => cx - Math.sqrt(R * R - (y - cy) ** 2);
    for (const y of [SPOUT_INSIDE[1] - NEXT_SLIP.w / 2, SPOUT_INSIDE[1] + NEXT_SLIP.w / 2]) expect(SPOUT_INSIDE[0] - NEXT_SLIP.l / 2).toBeGreaterThan(back(y) + 3);
    BEAT_7.riders.forEach((r, i) => {
      expect(riderAt(i, r.spout)!.p).toEqual(SPOUT_INSIDE);
      for (let f = r.spout; f < r.spout + 5; f++) for (const [x, y] of corners(riderAt(i, f)!)) expect(x, `rider ${i} f${f}`).toBeGreaterThan(back(Math.min(Math.max(y, cy - R + 1), cy + R - 1)));
    });
  });
  it('rounds the spool wide: never within its reach while any of it is under the spool’s top (drawn over its winding, then under its foot, c3496-3498)', () => {
    BEAT_7.riders.forEach((r, i) => {
      for (let f = r.spout; f <= r.clipOn + 2; f++)
        for (const [x, y, z] of corners(riderAt(i, f)!)) if (z < SPOOL.z[1] + 6) expect(Math.hypot(x - SPOOL.x, y - SPOOL.y), `rider ${i} f${f}`).toBeGreaterThan(SPOOL.r + 16);
    });
  });
});
