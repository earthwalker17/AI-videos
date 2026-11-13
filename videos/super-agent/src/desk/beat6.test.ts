import { describe, expect, it } from 'vitest';
import { BEAT_6, at as bar, cue, textWindow } from '../cues.ts';
import { BELT_HEADING as BELT_HEADING_5, BELT_SLOPE as BELT_SLOPE_5, CREST, KEEP_LAND as KEEP_LAND_5 } from './beat5.ts';
import {
  BAR_FAR,
  BELT_HEADING,
  BELT_SLOPE,
  KEEP_LAND,
  BAR_PARK,
  BATCHES,
  CARRIERS,
  CROP,
  E6,
  ENTRY_X,
  FRONT_X,
  HIDDEN,
  PITCH,
  RIDE6,
  FILED_LIFT,
  TAB_LEAN_REQUEST,
  STRESS_PLATE,
  STRIP_KINDS,
  THREAD_ROW,
  TRAY,
  answerAt,
  barAt,
  beat6At,
  decodeAt,
  hopTargets,
  needleAt,
  plateAt,
  PLATE_CONTACT,
  reviewAt,
  rewindAt,
  stripAt,
  stripFrames,
  stripSlipAt,
  threadAt,
  threadRowX,
  trayGlide,
  type PathPose,
} from './beat6.ts';
import { cameraAt, deskCamera, FRAMING_C, project } from './camera.ts';
import { footprintsAt, MAX_FOOTPRINTS, registerFootprints, THROAT_FLOOR_FP } from './footprints.ts';
import { DECK, GATE, INDEX, PRINT_HEAD, TAPE_FLAT_X1, THROAT, type P3 } from './layout.ts';
import { poolsAt } from './pools.ts';
import { DETENT, EVENTS_C, EVENTS_D, MT1_BELT, N6_GONE, SPRING, STEP_FRAMES, STRESS_LATE, TAB_LEAN_C, cacheAt, cardArcC, closeAt, deskStateAt, headDipAt, nextAt, springAt } from './state.ts';
import { isStepped } from './kit.tsx';

const dock = (f: number, at: number) => springAt(f, at, SPRING.dock);
const dist = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The smallest difference of two angles. */
const dAng = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('beat 6: every cue sheet frame is a contact frame', () => {
  it('lands each waiting slip in the strip on its frame, a pitch behind (west of) the one before, sliding east out of the west hood', () => {
    for (const b of BATCHES)
      b.slips.forEach((L, i) => {
        const before = stripSlipAt(L - 1, b, i)!;
        const on = stripSlipAt(L, b, i)!;
        expect(before.inStrip).toBe(false);
        expect(on.inStrip).toBe(true);
        expect(on.pose.p[0]).toBeCloseTo(FRONT_X - i * PITCH, 6);
        expect(on.pose.heading).toBe(0);
        expect(on.view).not.toBeNull();
        // sliding east along the tray until then, never past its place
        expect(before.pose.p[0]).toBeLessThan(on.pose.p[0]);
        expect(dist(before.pose.p, on.pose.p)).toBeLessThan(45);
      });
  });
  it('sweeps each strip on its downbeat for sweepBase + sweepPerSlip per slip frames; every cell is lit within 6 f', () => {
    for (const b of BATCHES) {
      expect(b.sweep).toBe(cue(b.k === 0 ? 'batch' : 'batch-2').frame);
      // still before it (10-20 f of stillness before the climax): the bar parked, no cell lit
      expect(barAt(b.sweep - 2)!.x).toBeCloseTo(BAR_PARK, 9);
      expect(stripAt(b.sweep - 2).filter((x) => x.b === b.k && x.lit > 0)).toHaveLength(0);
      const last = Math.max(...b.slips);
      expect(b.sweep - last).toBeGreaterThanOrEqual(10);
      // on the downbeat the bar is off its park (running west down the strip) and the front cell is lit
      expect(barAt(b.sweep)!.x).toBeLessThan(BAR_PARK - 10);
      expect(stripAt(b.sweep).find((x) => x.b === b.k && x.i === 0)!.lit).toBeGreaterThan(0.5);
      // every cell lit within 6 f
      for (const x of stripAt(b.sweep + 5).filter((y) => y.b === b.k)) expect(x.lit).toBe(1);
      // the whole strip is drawn in under the west hood within the sweep, the bar back on its park at its end
      expect(stripAt(b.end).filter((x) => x.b === b.k && !x.hidden)).toHaveLength(0);
      expect(barAt(b.end)!.x).toBeCloseTo(BAR_PARK, 9);
    }
  });
  it('clears the tray before the next batch’s first slip comes out of the west hood (the real queue clears every beat)', () => {
    const b1 = BATCHES[1];
    const firstIn = Array.from({ length: 40 }, (_, k) => b1.slips[0] - 40 + k).find((f) => stripSlipAt(f, b1, 0)?.view);
    expect(firstIn).toBeDefined();
    expect(stripAt(firstIn!).filter((x) => x.b === 0)).toHaveLength(0);
  });
  it('punches the decode slip one cell per decodeCell frames from the sweep’s end, then drops it into the dispatch slot', () => {
    for (const b of BATCHES) {
      for (let k = 1; k <= E6.decodeCells; k++) {
        const at = b.end + (k - 1) * BEAT_6.decodeCell + 1;
        expect(decodeAt(at)!.punched).toBe(k);
        expect(decodeAt(at - 1)!.punched).toBe(k - 1);
      }
      const torn = b.end + E6.decodeCells * BEAT_6.decodeCell + E6.tear;
      expect(decodeAt(torn - 1)!.free).toBe(false);
      expect(decodeAt(torn)!.free).toBe(true);
      // wholly under the deck plate by its last frame, then gone
      const lastF = torn + E6.dispatch - 1;
      expect(decodeAt(lastF)!.p[2]).toBeLessThan(123);
      expect(decodeAt(torn + E6.dispatch)).toBeNull();
    }
  });
  it('seats the stress plate on plate-detent (3% squash), in the air the frame before', () => {
    const at = cue('plate-detent').frame;
    expect(plateAt(at)!.d).toEqual([0, 0, 0]);
    expect(plateAt(at)!.squash).toBeCloseTo(0.03, 9);
    expect(plateAt(at - 1)!.d[2]).toBeGreaterThan(0);
    expect(plateAt(at - E6.plateFly - 1)).toBeNull();
    expect(plateAt(cue('plate').frame)).not.toBeNull();
  });
  it('retires the stress plate once N4 and its own words are off: off its hooks on bar 39’s downbeat, gone before the eject, never back', () => {
    const [, n4Out] = textWindow(cue('n4'));
    const [, plateOut] = textWindow(cue('plate'));
    expect(E6.plateExit).toBeGreaterThanOrEqual(n4Out);
    expect(E6.plateExit).toBeGreaterThanOrEqual(plateOut);
    expect(E6.plateExit).toBe(bar(39));
    // seated (and still) until the downbeat, off its hooks on it, eased away over 12-16 f
    expect(plateAt(E6.plateExit - 1)!.d).toEqual([0, 0, 0]);
    expect(plateAt(E6.plateExit - 1)!.squash).toBe(0);
    expect(plateAt(E6.plateExit)!.d[2]).toBeGreaterThan(0);
    expect(plateAt(E6.plateExit)!.d[2]).toBeLessThanOrEqual(6 + 1e-9);
    // its contact shadow fades with the lift, never cut on the exit's first frame (A10)
    const contactAt = (f: number) => {
      const p = plateAt(f);
      return p ? (p.contact ?? (p.flying ? 0 : PLATE_CONTACT.seated)) : 0;
    };
    expect(contactAt(E6.plateExit - 1)).toBe(PLATE_CONTACT.seated);
    for (let f = E6.plateExit; f < E6.plateExit + E6.plateOut; f++) {
      expect(contactAt(f), `f${f}`).toBeLessThan(contactAt(f - 1) + 1e-12);
      expect(contactAt(f - 1) - contactAt(f), `f${f}`).toBeLessThanOrEqual(0.3);
    }
    expect(E6.plateOut).toBeGreaterThanOrEqual(12);
    expect(E6.plateOut).toBeLessThanOrEqual(16);
    expect(E6.plateExit + E6.plateOut).toBeLessThanOrEqual(BEAT_6.cacheEject);
    // it leaves the close's frame whole before it is dropped: its last pose is off the frame's east edge
    const lastF = E6.plateExit + E6.plateOut - 1;
    const last = plateAt(lastF)!;
    const c: P3 = [(STRESS_PLATE.box.x0 + STRESS_PLATE.box.x1) / 2 + last.d[0], (STRESS_PLATE.box.y0 + STRESS_PLATE.box.y1) / 2 + last.d[1], STRESS_PLATE.z[0] + last.d[2]];
    const hx = (STRESS_PLATE.box.x1 - STRESS_PLATE.box.x0) / 2;
    const hy = (STRESS_PLATE.box.y1 - STRESS_PLATE.box.y0) / 2;
    for (const [dx, dy, dz] of [-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [0, STRESS_PLATE.z[1] - STRESS_PLATE.z[0]].map((z) => [a * hx, b * hy, z])))) {
      // posed as objects/Batch.tsx poses it: turned about z, then tilted about x, about its own centre
      const [cz, sz] = [Math.cos(last.turn), Math.sin(last.turn)];
      const [ct, st] = [Math.cos(last.tilt), Math.sin(last.tilt)];
      const [x1, y1] = [dx * cz - dy * sz, dx * sz + dy * cz];
      const [y2, z2] = [y1 * ct - dz * st, y1 * st + dz * ct];
      const [x] = project(cameraAt(lastF, 15), [c[0] + x1, c[1] + y2, c[2] + z2]);
      expect(x, 'the plate’s last pose is off the frame’s east edge').toBeGreaterThan(1920);
    }
    for (let f = E6.plateExit + E6.plateOut; f < E6.until; f += 5) expect(plateAt(f), `f${f}`).toBeNull();
  });
  it('holds the cache’s eject, fold and the tab’s landing on the score’s frames', () => {
    expect(EVENTS_C.cardEject).toBe(BEAT_6.cacheEject);
    expect(EVENTS_C.fold).toBe(BEAT_6.cacheFold);
    // audio/keepUp.ts TAB_LANDS: the pointer tick 16 f after the fold
    expect(EVENTS_C.tabDrop + EVENTS_C.tabFrames).toBe(BEAT_6.cacheFold + 16);
  });
  it('presses the head down before the record’s ink: the hammer is down on stampIn, where the header’s ink first shows', () => {
    const E = EVENTS_C;
    expect(deskStateAt(E.stampIn - 2).cache!.stamp).toBe(0);
    expect(deskStateAt(E.stampIn - 1).cache!.stamp).toBeGreaterThan(0);
    expect(deskStateAt(E.stampIn).cache!.stamp).toBe(1);
    // the ink's first stage on the contact frame, none before it
    expect(deskStateAt(E.stampIn - 1).cache!.stagger).toBeLessThan(0);
    expect(deskStateAt(E.stampIn).cache!.stagger).toBe(0);
    // the head dips with it (and its footprint's top goes down with it: footprints.ts)
    expect(headDipAt(deskStateAt(E.stampIn - 1))).toBeGreaterThan(0);
  });
  it('lands the review card in the throat on review-card and has it wholly under the head before review-in', () => {
    const R = BEAT_6.recall;
    const at = reviewAt(R.card)!;
    const before = reviewAt(R.card - 1)!;
    // still settling down between the cheeks the frame before (beat6.ts hopInto: over the slot first, then down onto its floor)
    expect(before.p[0]).toBeLessThanOrEqual(at.p[0]);
    expect(before.p[2]).toBeGreaterThan(at.p[2]);
    expect(at.flying).toBe(false);
    expect(before.flying).toBe(true);
    expect(reviewAt(R.card + 5)!.p).toEqual(at.p);
    // the frame before the stamp it is wholly under the head (its west end past the head's west face), then gone
    const last = reviewAt(R.stampIn - 1)!;
    expect(last.p[0] - CARRIERS.ci.l / 2).toBeGreaterThanOrEqual(PRINT_HEAD.box.x0);
    expect(reviewAt(R.stampIn)).toBeNull();
    expect(beat6At(R.stampIn, dock).hammer).toBe(1);
    expect(beat6At(R.stampIn - 3, dock).hammer).toBe(0);
  });
  it('rewinds the reel over rewindFrames from recall, the Thread’s row coming out with the tape from wholly under its rise', () => {
    const R = BEAT_6.recall;
    expect(rewindAt(R.rewind)).toBe(0);
    expect(rewindAt(R.rewind + 1)).toBeGreaterThan(0);
    expect(rewindAt(R.rewind + R.rewindFrames)).toBe(1);
    expect(rewindAt(R.rewind + R.rewindFrames - 1)).toBeLessThan(1);
    expect(THREAD_ROW.from).toBeGreaterThanOrEqual(TAPE_FLAT_X1 + 2);
    expect(threadRowX(R.rewind)).toBe(THREAD_ROW.from);
    expect(threadRowX(R.rewind + R.rewindFrames)).toBe(THREAD_ROW.x0);
  });
  it('lands each hop of the reading thread on its frame (10 f a hop, 4 f dwell), each opening its № tab', () => {
    const T = hopTargets();
    BEAT_6.recall.hops.forEach((h, k) => {
      const t = threadAt(h, dock)!;
      expect(dist(t.pts[t.pts.length - 1], T[k + 1])).toBeLessThan(1e-6);
      expect(t.shuttle).toBeNull();
      const t1 = threadAt(h - 1, dock)!;
      expect(dist(t1.pts[t1.pts.length - 1], T[k + 1])).toBeGreaterThan(1);
      expect(t1.shuttle).not.toBeNull();
      expect(t.tabs[k]).toBe(0);
      expect(threadAt(h + 1, dock)!.tabs[k]).toBeGreaterThan(0);
      if (k > 0) expect(h - BEAT_6.recall.hops[k - 1]).toBe(E6.hopFrames + 4);
    });
    expect(threadAt(BEAT_6.recall.hops[0] - E6.hopFrames - 1, dock)).toBeNull();
  });
  it('sends the answer back on recall-answer under the transit light, out of the close’s frame long before it is gone', () => {
    const a = BEAT_6.recall.answer;
    expect(answerAt(a - 1)!.free).toBe(false);
    expect(answerAt(a)!.free).toBe(true);
    expect(answerAt(a + 6)!.transit).toBeGreaterThan(0.5);
    expect(answerAt(a + E6.answerFly)).toBeNull();
    // its last 8 frames are wholly west of the frame (the camera barely starts its ease-out by then)
    for (let f = a + E6.answerFly - 8; f < a + E6.answerFly; f++) {
      const p = answerAt(f)!.p;
      const sx = project(cameraAt(f, 15), [p[0] + 30, p[1], p[2]])[0];
      expect(sx, `f${f}`).toBeLessThan(0);
    }
  });
});

describe('beat 6: nothing jumps, snaps or vanishes in the open', () => {
  it('moves every slip and card under 60 u and turns it under 0.15 rad a frame while in sight', () => {
    const key = (b: number, i: number) => `${b}.${i}`;
    let prev = new Map<string, PathPose & { hidden: boolean }>();
    let prevReview: PathPose | null = null;
    for (let f = 2600; f < 3460; f++) {
      const e = beat6At(f, dock);
      const now = new Map<string, PathPose & { hidden: boolean }>();
      for (const x of e.strip) {
        now.set(key(x.b, x.i), { ...x.pose, hidden: x.hidden });
        const p = prev.get(key(x.b, x.i));
        // a slip under the head and the deck plate is out of sight (its way from the throat to the tray's west hood)
        if (!p || x.hidden || p.hidden) continue;
        expect(dist(p.p, x.pose.p), `slip ${key(x.b, x.i)} at f${f}`).toBeLessThan(60);
        expect(dAng(p.heading, x.pose.heading), `slip ${key(x.b, x.i)} heading at f${f}`).toBeLessThan(0.15);
        expect(Math.abs(p.slope - x.pose.slope), `slip ${key(x.b, x.i)} slope at f${f}`).toBeLessThan(0.15);
      }
      // a slip leaves the open only under the head or under the west hood (drawn in with its strip, under 50 u a frame)
      for (const [k, p] of prev) if (!now.has(k)) expect(p.hidden || p.p[0] + 48 <= CROP.west + 50, `slip ${k} gone at f${f} at x ${p.p[0]}`).toBe(true);
      prev = now;
      if (e.review && prevReview) {
        expect(dist(e.review.p, prevReview.p), `review at f${f}`).toBeLessThan(60);
        expect(dAng(e.review.heading, prevReview.heading), `review heading at f${f}`).toBeLessThan(0.15);
        expect(Math.abs(e.review.slope - prevReview.slope), `review slope at f${f}`).toBeLessThan(0.15);
      }
      if (!e.review && prevReview) expect(prevReview.p[0] - CARRIERS.ci.l / 2, `review gone at f${f}`).toBeGreaterThanOrEqual(PRINT_HEAD.box.x0);
      prevReview = e.review;
    }
  });
  it('moves the bar, the plate, the answer and the thread’s head under 60 u a frame', () => {
    let prevBar: number | null = null;
    let prevPlate: P3 | null = null;
    let prevAnswer: P3 | null = null;
    let prevHead: P3 | null = null;
    for (let f = 2600; f < 3460; f++) {
      const e = beat6At(f, dock);
      if (e.bar && prevBar !== null) expect(Math.abs(e.bar.x - prevBar)).toBeLessThan(60);
      prevBar = e.bar?.x ?? null;
      if (e.plate && prevPlate) expect(dist(e.plate.d, prevPlate)).toBeLessThan(60);
      prevPlate = e.plate?.d ?? null;
      if (e.answer && prevAnswer) expect(dist(e.answer.p, prevAnswer)).toBeLessThan(60);
      prevAnswer = e.answer?.p ?? null;
      const head = e.thread ? e.thread.pts[e.thread.pts.length - 1] : null;
      if (head && prevHead) expect(dist(head, prevHead)).toBeLessThan(60);
      prevHead = head;
    }
  });
  it('rides every carrier from inside its feeder: posted, up the belt to beat 5’s crest, a hop clear of the cheeks into the throat', () => {
    // beat 5's belt, landing and crest (its asks' ride), the same values
    expect(dist(CARRIERS.chat.crest, CREST)).toBeLessThan(1e-9);
    expect(dist(KEEP_LAND, KEEP_LAND_5)).toBeLessThan(1e-9);
    expect(BELT_HEADING).toBeCloseTo(BELT_HEADING_5, 12);
    expect(BELT_SLOPE).toBeCloseTo(BELT_SLOPE_5, 12);
    const cheekTop = THROAT.z[1] + 4;
    for (const b of BATCHES)
      for (let i = 0; i < b.n; i++) {
        const F = stripFrames(b, i);
        const c = CARRIERS[b.kinds[i]!.kind];
        let f = F.land - 40;
        while (!stripSlipAt(f, b, i)) f++;
        // its first frame: inside its feeder, west of its mouth
        expect(stripSlipAt(f, b, i)!.pose.p[0]).toBeLessThan(c.mouth[0]);
        // on the belt's landing it lies in the belt's pose, the same pose the frame after (it rides on in it)
        const l0 = stripSlipAt(F.land, b, i)!.pose;
        const l1 = stripSlipAt(F.land + 1, b, i)!.pose;
        expect(l0.heading).toBeCloseTo(l1.heading, 9);
        expect(l0.slope).toBeCloseTo(l1.slope, 9);
        // the hop: wherever a corner is over a cheek, it is above the cheek's top
        for (let t = F.land + RIDE6.belt; t <= F.th; t += 0.25) {
          const x = stripSlipAt(t, b, i)!.pose;
          for (const [sx, sy] of [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ]) {
            const lx = (sx * c.l) / 2;
            const ly = (sy * c.w) / 2;
            const cx = x.p[0] + lx * Math.cos(x.slope) * Math.cos(x.heading) - ly * Math.sin(x.heading);
            const cy = x.p[1] + lx * Math.cos(x.slope) * Math.sin(x.heading) + ly * Math.cos(x.heading);
            const cz = x.p[2] + lx * Math.sin(x.slope);
            const overCheek = cx >= THROAT.box.x0 - 6 && cx <= THROAT.box.x1 && (cy <= THROAT.box.y0 + 6 || cy >= THROAT.box.y1 - 6);
            if (overCheek) expect(cz, `slip ${b.k}.${i} corner over a cheek at f${t}`).toBeGreaterThan(cheekTop);
          }
        }
        // out of sight at least HIDDEN frames between wholly under the head and the west hood
        expect(F.inTray - F.under).toBeGreaterThanOrEqual(8);
        expect(HIDDEN).toBeGreaterThanOrEqual(8);
      }
  });
  it('never passes a carrier (every strip slip, the review card) through the throat’s cheeks, its floor or the gate bar (0.25 f steps)', () => {
    // the bodies as objects/Register.tsx builds them (beat5.test.ts's boxes): the cheeks with their rails, the throat's floor, the gate's bar
    const CHEEKS = [
      { x0: THROAT.box.x0 - 6, x1: THROAT.box.x1, y0: THROAT.box.y0 - 4, y1: THROAT.box.y0 + 6, z0: THROAT.z[0] + 4, z1: THROAT.z[1] + 4 },
      { x0: THROAT.box.x0 - 6, x1: THROAT.box.x1, y0: THROAT.box.y1 - 6, y1: THROAT.box.y1 + 4, z0: THROAT.z[0] + 4, z1: THROAT.z[1] + 4 },
    ];
    const FLOOR = { ...THROAT.box, z0: THROAT.z[0], z1: THROAT.z[1] - 8 };
    const BAR = { ...GATE.bar, z0: 0, z1: GATE.h + 3.5 };
    const inBox = (p: P3, b: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }) => p[0] > b.x0 && p[0] < b.x1 && p[1] > b.y0 && p[1] < b.y1 && p[2] > b.z0 && p[2] < b.z1;
    // a grid over the card's top and underside, posed as objects/Batch.tsx poses it (rotation [0, -slope, heading], 'ZYX')
    const grid = (x: PathPose, l: number, w: number): P3[] => {
      const out: P3[] = [];
      const [ch, sh, cs, ss] = [Math.cos(x.heading), Math.sin(x.heading), Math.cos(x.slope), Math.sin(x.slope)];
      for (let i = 0; i <= 12; i++)
        for (let j = 0; j <= 4; j++)
          for (const z of [-0.4, 0.4]) {
            const [lx, ly] = [-l / 2 + (l * i) / 12, -w / 2 + (w * j) / 4];
            // Ry(-slope) then Rz(heading)
            const [ax, az] = [lx * cs - z * ss, lx * ss + z * cs];
            out.push([x.p[0] + ax * ch - ly * sh, x.p[1] + ax * sh + ly * ch, x.p[2] + az]);
          }
      return out;
    };
    const check = (who: string, x: PathPose | null, l: number, w: number, t: number) => {
      if (!x) return;
      for (const p of grid(x, l, w)) {
        for (const c of CHEEKS) expect(inBox(p, c), `${who} in a cheek at f${t}`).toBe(false);
        expect(inBox(p, FLOOR), `${who} in the throat’s floor at f${t}`).toBe(false);
        expect(inBox(p, BAR), `${who} in the gate bar at f${t}`).toBe(false);
      }
    };
    for (const b of BATCHES)
      for (let i = 0; i < b.n; i++) {
        const F = stripFrames(b, i);
        const c = CARRIERS[b.kinds[i]!.kind];
        for (let t = F.land - E6.post - E6.outFrames; t <= F.under; t += 0.25) {
          const x = stripSlipAt(t, b, i);
          if (x && !x.hidden && !x.inTray) check(`slip ${b.k}.${i}`, x.pose, c.l, c.w, t);
        }
      }
    const R = BEAT_6.recall;
    for (let t = R.card - 30; t < R.stampIn; t += 0.25) check('review card', reviewAt(t), CARRIERS.ci.l, CARRIERS.ci.w, t);
  });
  it('lets a carrier leave the open only wholly under the head: it goes out of sight on the frame its west end passes the head’s face', () => {
    for (const b of BATCHES)
      for (let i = 0; i < b.n; i++) {
        const F = stripFrames(b, i);
        const c = CARRIERS[b.kinds[i]!.kind];
        expect(Number.isInteger(F.under), `slip ${b.k}.${i}`).toBe(true);
        for (let f = F.land; f <= F.inTray; f++) {
          const was = stripSlipAt(f - 1, b, i)!;
          const now = stripSlipAt(f, b, i)!;
          if (was.hidden || !now.hidden) continue;
          // the frame it goes out of sight is a ride frame, its pose wholly under the head
          expect(f, `slip ${b.k}.${i} hidden at f${f}`).toBeLessThanOrEqual(F.under);
          expect(now.pose.p[0] - c.l / 2, `slip ${b.k}.${i} hidden at f${f}`).toBeGreaterThanOrEqual(PRINT_HEAD.box.x0);
        }
      }
  });
  it('never has two carriers on the intake at once within a slip’s length of each other', () => {
    for (let f = 2600; f < 3000; f += 0.5) {
      const on = stripAt(f).filter((x) => !x.inTray && !x.hidden && x.pose.p[0] > -700);
      for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) expect(dist(on[a].pose.p, on[b].pose.p), `f${f}`).toBeGreaterThan(70);
    }
  });
  it('lays the strip inside the tray between the hoods, its newest slip by the west hood', () => {
    const b = BATCHES[1];
    expect(FRONT_X + 48).toBeLessThanOrEqual(TRAY.x1 - TRAY.hood);
    expect(FRONT_X - (b.n - 1) * PITCH - 48).toBeGreaterThanOrEqual(CROP.west - 1);
    expect(ENTRY_X + 48).toBeCloseTo(CROP.west, 9);
    // the bar's sweep stays out of both hoods (its 5 u width)
    expect(BAR_PARK + 2.5).toBeLessThan(TRAY.x1 - TRAY.hood);
    expect(BAR_FAR - 2.5).toBeGreaterThan(TRAY.x0 + TRAY.hood);
  });
  it('keeps the index arm (its outline and its tip’s dome, objects/Register.tsx armShape) clear of the tray’s west hood at its detent', () => {
    const a = DETENT.fresh;
    const L = INDEX.length;
    const at = (x: number, y: number): [number, number] => [INDEX.pivot[0] + x * Math.cos(a) - y * Math.sin(a), INDEX.pivot[1] + x * Math.sin(a) + y * Math.cos(a)];
    const pts: [number, number][] = [];
    for (let t = 0; t <= 1; t += 0.02) pts.push(at((L - 22) * t, 8 - 4 * t), at(L - 22 + 22 * t, 4 - 4 * t));
    for (let k = 0; k < 64; k++) pts.push(at(L - 14 + 4.5 * Math.cos((k / 64) * 2 * Math.PI), 4.5 * Math.sin((k / 64) * 2 * Math.PI)));
    for (const [x, y] of pts) if (y >= TRAY.y0 - 3) expect(x, `arm point (${x.toFixed(1)}, ${y.toFixed(1)})`).toBeLessThan(TRAY.x0 - 0.5);
  });
  it('mixes the channels in every strip: both kinds, never three alike in a row', () => {
    for (const kinds of STRIP_KINDS) {
      expect(new Set(kinds.map((k) => k.kind)).size).toBe(2);
      for (let i = 2; i < kinds.length; i++) expect(kinds[i].kind === kinds[i - 1].kind && kinds[i].kind === kinds[i - 2].kind).toBe(false);
    }
    expect(STRIP_KINDS.map((k) => k.length)).toEqual(BEAT_6.batches.map((b) => b.slips.length));
  });
  it('raises the neck collar’s needle a hair per slip and eases it down with the gulp (never a drop)', () => {
    let prev = needleAt(2700);
    for (let f = 2701; f < 3000; f++) {
      const n = needleAt(f);
      // up by one slip's step on its landing, down by at most a third of a strip's reading a frame
      expect(n - prev, `f${f}`).toBeLessThan(0.11);
      expect(prev - n, `f${f}`).toBeLessThanOrEqual(0.036);
      expect(n).toBeGreaterThanOrEqual(-0.035 * 8);
      prev = n;
    }
  });
});

describe('the hop into the throat: it turns flat and settles over frames, never in one (L2-01)', () => {
  // a carrier's pose frame by frame up to its landing in the throat: its drop, turn and tilt per frame
  const steps = (poses: { p: P3; heading: number; slope: number }[]) =>
    poses.slice(1).map((x, k) => ({ drop: poses[k]!.p[2] - x.p[2], turn: dAng(x.heading, poses[k]!.heading), tilt: Math.abs(x.slope - poses[k]!.slope) }));
  it('lands every strip slip and the review card in the throat at rest: flat two frames before, its drop spread over three', () => {
    const rides: { who: string; th: number; at: (f: number) => PathPose | null }[] = [];
    for (const b of BATCHES) for (let i = 0; i < b.n; i++) rides.push({ who: `slip ${b.k}.${i}`, th: stripFrames(b, i).th, at: (f) => stripSlipAt(f, b, i)?.pose ?? null });
    rides.push({ who: 'review card', th: BEAT_6.recall.card, at: (f) => reviewAt(f) });
    for (const r of rides) {
      const poses = [-6, -5, -4, -3, -2, -1, 0].map((k) => r.at(r.th + k)!);
      const st = steps(poses);
      // lying along the throat (flat, its tab state settled) from two frames before it lands, so the last frames only settle it
      for (const x of poses.slice(4)) {
        expect(x.heading, r.who).toBeCloseTo(0, 6);
        expect(x.slope, r.who).toBeCloseTo(0, 6);
      }
      // the descent onto the throat's floor: over the last three frames, smaller each frame, the last a settle (it had dropped 15 u in one)
      expect(st.slice(3).every((x) => x.drop > 0), r.who).toBe(true);
      expect(st[3]!.drop, r.who).toBeGreaterThan(st[4]!.drop);
      expect(st[4]!.drop, r.who).toBeGreaterThan(st[5]!.drop);
      expect(st[5]!.drop, r.who).toBeLessThan(4);
      expect(Math.max(...st.map((x) => x.drop)), r.who).toBeLessThan(12);
      for (const x of st) expect(x.turn, r.who).toBeLessThan(0.15);
    }
  });
  it('takes MT1’s next slip the same way: posted into the belt’s pose, up the belt, the hop, in the throat on belt + beltFrames', () => {
    const E = EVENTS_D;
    const th = E.belt + E.beltFrames;
    const poses = [];
    for (let f = E.post; f <= th; f++) poses.push(nextAt(f).slip!);
    const st = steps(poses);
    // never a pose swapped in a frame (it turned 0.5 rad and tilted 0.45 rad in one at f2246-2247, and again on the belt's foot at 2241)
    st.forEach((x, k) => {
      expect(x.turn, `f${E.post + k + 1}`).toBeLessThan(0.2);
      expect(x.tilt, `f${E.post + k + 1}`).toBeLessThan(0.2);
      // (the post comes down onto the belt as every post does; from the crest on, the hop settles)
      if (E.post + k >= E.belt - 1 + MT1_BELT) expect(x.drop, `f${E.post + k + 1}`).toBeLessThan(12);
    });
    // in the belt's pose on its landing and the frame after; flat in the throat from the frame before it lands there
    const land = nextAt(E.belt - 1).slip!;
    expect(land.heading).toBeCloseTo(BELT_HEADING, 6);
    expect(land.slope).toBeCloseTo(BELT_SLOPE, 6);
    expect(land.p).toEqual(KEEP_LAND);
    expect(nextAt(E.belt - 1 + MT1_BELT).slip!.p).toEqual(CARRIERS.chat.crest);
    expect(nextAt(th - 1).slip!.heading).toBeCloseTo(0, 6);
    expect(nextAt(th).slip!.p).toEqual(CARRIERS.chat.throat);
    expect(st[st.length - 1]!.drop).toBeLessThan(4);
  });
  it('never shades MT1’s next slip by its own footprint (its 3% landing squash put its top under it for 3 f)', () => {
    for (let f = EVENTS_D.post; f < EVENTS_D.belt + EVENTS_D.beltFrames + 8; f++) {
      const sl = nextAt(f).slip;
      if (!sl) continue;
      const own = footprintsAt(deskStateAt(f)).find((fp) => fp.kind === 'rect' && fp.c[0] === sl.p[0] && fp.c[1] === sl.p[1] && fp.h[0] === 48);
      expect(own, `f${f}`).toBeDefined();
      // its top face (objects/Dispatch.tsx slipGeometry: ±0.4, squashed 3% at most) at or over its footprint's top
      if (own?.kind === 'rect') expect(sl.p[2] + 0.4 * (1 - 0.03 * sl.squash), `f${f}`).toBeGreaterThanOrEqual(own.z1 + 0.1);
    }
  });
  it('shades a carrier settling into the throat only by the cheeks’ cast shade: nothing over the slot stands above it (R-A4)', () => {
    // (one footprint over the whole throat up to 126 shaded a carrier the frame it went under 126, on a hard edge at the
    // throat's west face: every beat-6 landing and MT1's)
    const lying = CARRIERS.chat.throat[2];
    const floor = THROAT.z[1] - 8;
    const over = (x: number, y: number) =>
      registerFootprints().filter((fp) => fp.kind === 'rect' && fp.rot === 0 && Math.abs(x - fp.c[0]) <= fp.h[0] && Math.abs(y - fp.c[1]) <= fp.h[1]);
    const slotY = (THROAT.box.y0 + THROAT.box.y1) / 2;
    // (east of the deck's west rail's inner face the rail's own top, 122, lies over the carrier's east end: drawn there too)
    for (let x = THROAT.box.x0; x < DECK.x0; x += 4)
      for (const y of [slotY - 18, slotY, slotY + 18]) {
        const fps = over(x, y);
        for (const fp of fps) if (fp.kind === 'rect') expect(fp.z1, `${x},${y}`).toBeLessThanOrEqual(lying);
        // the floor still in its own shade (as before)
        expect(fps.some((fp) => fp.kind === 'rect' && fp.z1 > floor + 0.5), `${x},${y}`).toBe(true);
      }
    expect(THROAT_FLOOR_FP).toBeGreaterThan(floor + 0.5);
    // the cheeks cast: standing over the carrier's height, either side of the slot
    for (const y of [THROAT.box.y0 + 1, THROAT.box.y1 - 1]) expect(over(THROAT.box.x0 + 10, y).some((fp) => fp.kind === 'rect' && fp.z1 >= THROAT.z[1] + 2)).toBe(true);
  });
});

describe('flights in the 2.4x close timed by screen distance (L2-03)', () => {
  const px = (f: number, p: P3) => project(cameraAt(f, 15), p);
  const stepPx = (f: number, a: P3, b: P3) => Math.hypot(px(f, a)[0] - px(f - 1, b)[0], px(f, a)[1] - px(f - 1, b)[1]);
  it('flies the cache card into the mouth at an even speed on screen (no strobe), ejecting and landing on its frames', () => {
    const E = EVENTS_C;
    expect(E.cardEject).toBe(BEAT_6.cacheEject);
    expect(cacheAt(E.cardEject)!.card!.s).toBe(0);
    expect(cacheAt(E.cardEject + E.cardFly)!.card).toBeNull();
    expect(cacheAt(E.cardEject + E.cardFly - 1)!.card!.s).toBeLessThan(1);
    let inFrame = 0;
    for (let f = E.cardEject + 2; f <= E.cardEject + E.cardFly; f++) {
      const a = f < E.cardEject + E.cardFly ? cacheAt(f)!.card!.pos : cardArcC(1);
      const b = cacheAt(f - 1)!.card!.pos;
      const step = stepPx(f, a, b);
      // at most about 87 px a frame (it had run up to 146, each step close to its own width: about 190 px at 2.4x)
      expect(step, `f${f}`).toBeLessThan(90);
      if (px(f, a)[0] < 1920) inFrame++;
    }
    expect(inFrame).toBeGreaterThanOrEqual(16);
    // it slows into the mouth
    const s1 = stepPx(E.cardEject + E.cardFly - 1, cacheAt(E.cardEject + E.cardFly - 1)!.card!.pos, cacheAt(E.cardEject + E.cardFly - 2)!.card!.pos);
    expect(s1).toBeLessThan(75);
  });
  it('gulps each swept strip in over 8 f at about 80 px a frame, the tray clear before the next batch comes out', () => {
    for (const b of BATCHES) {
      const xs: number[] = [];
      let f = b.sweep;
      while (stripSlipAt(f, b, 0)) xs.push(stripSlipAt(f++, b, 0)!.pose.p[0]);
      const moving = xs.slice(1).map((x, k) => xs[k]! - x).filter((d) => d > 1e-6);
      expect(moving.length, `batch ${b.k}`).toBeGreaterThanOrEqual(7);
      // (the tray's floor at the deck's top, 2.66 px a unit at 2.4x)
      for (const d of moving) expect(d * 2.66, `batch ${b.k}`).toBeLessThan(84);
    }
    // never two batches' slips in view in the tray on one frame
    for (let f = BATCHES[1]!.sweep - 200; f < BATCHES[1]!.sweep; f++) {
      const seen = stripAt(f).filter((x) => x.inTray && x.view);
      expect(new Set(seen.map((x) => x.b)).size, `f${f}`).toBeLessThanOrEqual(1);
    }
  });
  it('slides each slip out of the west hood into the strip under the object cap (an even glide, then its stop), on its frame', () => {
    expect(trayGlide(0)).toBe(0);
    expect(trayGlide(1)).toBeCloseTo(1, 12);
    for (const b of BATCHES)
      for (let i = 0; i < b.n; i++) {
        const F = stripFrames(b, i);
        let prev = stripSlipAt(Math.floor(F.inTray), b, i)!.pose.p[0];
        const steps: number[] = [];
        for (let f = Math.floor(F.inTray) + 1; f <= F.L; f++) {
          const x = stripSlipAt(f, b, i)!.pose.p[0];
          steps.push(x - prev);
          prev = x;
        }
        // (the tray's floor at the deck's top, 2.66 px a unit at 2.4x: under 80 px a frame; it had come out at 115-125)
        for (const d of steps) expect(d * 2.66, `slip ${b.k}.${i}`).toBeLessThan(80);
        expect(steps.every((d) => d >= -1e-9), `slip ${b.k}.${i}`).toBe(true);
        // in its place on its frame, slowing into it over its last frames
        expect(stripSlipAt(F.L, b, i)!.pose.p[0]).toBeCloseTo(F.place, 9);
        expect(steps[steps.length - 1]!, `slip ${b.k}.${i}`).toBeLessThan(Math.max(...steps) / 2);
      }
  });
  it('never shades the tilted stress plate by its own footprint as it flies (a band swept up its face for 8 f)', () => {
    const B = STRESS_PLATE.box;
    const hd = (B.y1 - B.y0) / 2;
    for (let f = E6.plateDetent - E6.plateFly; f < E6.plateExit + E6.plateOut; f++) {
      const p = plateAt(f);
      if (!p) continue;
      const c = [(B.x0 + B.x1) / 2 + p.d[0], (B.y0 + B.y1) / 2 + p.d[1]];
      const own = footprintsAt(deskStateAt(f)).find((fp) => fp.kind === 'rect' && Math.abs(fp.c[0] - c[0]) < 1e-6 && Math.abs(fp.c[1] - c[1]) < 1e-6 && fp.h[0] === (B.x1 - B.x0) / 2);
      expect(own, `f${f}`).toBeDefined();
      // its face's lowest point (its south edge as it tilts north edge up) at or over its footprint's top
      const face = STRESS_PLATE.z[0] + p.d[2] - hd * Math.sin(p.tilt) + (STRESS_PLATE.z[1] - STRESS_PLATE.z[0] + 0.2) * Math.cos(p.tilt);
      if (own?.kind === 'rect') expect(face, `f${f}`).toBeGreaterThanOrEqual(own.z1 + (p.tilt > 0 ? 0.2 : -0.3));
    }
  });
  it('takes the stress plate out east over 14 f in frame, gathering speed, never over 80 px a frame', () => {
    const c: P3 = [(STRESS_PLATE.box.x0 + STRESS_PLATE.box.x1) / 2, (STRESS_PLATE.box.y0 + STRESS_PLATE.box.y1) / 2, STRESS_PLATE.z[1]];
    const at = (f: number): P3 => {
      const p = plateAt(f)!;
      return [c[0] + p.d[0], c[1] + p.d[1], c[2] + p.d[2]];
    };
    let prev = 0;
    for (let f = E6.plateExit + E6.plateUnhook + 1; f < E6.plateExit + E6.plateOut; f++) {
      const step = stepPx(f, at(f), at(f - 1));
      expect(step, `f${f}`).toBeLessThan(80);
      expect(step, `f${f}`).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = step;
    }
    expect(E6.plateOut - E6.plateUnhook).toBeGreaterThanOrEqual(8);
  });
});

describe('beat 6: the window, the light and the focus', () => {
  it('swaps the printed tape for the close’s cards over 8 f from the dolly (no one-frame swap at f3000)', () => {
    expect(deskStateAt(2639).cache).toBeNull();
    expect(deskStateAt(2640).cache!.fade).toBe(0);
    expect(deskStateAt(2648).cache!.fade).toBe(1);
    for (let f = 2990; f < 3010; f++) expect(deskStateAt(f).cache!.fade).toBe(1);
  });
  it('keeps the reading light continuous through the close and the record’s stamp-in', () => {
    const pools = (f: number) => poolsAt(deskStateAt(f)).slice(0, 2);
    for (let f = 2630; f < 3140; f++) {
      const [a, b] = [pools(f), pools(f + 1)];
      for (let i = 0; i < 2; i++) {
        expect(Math.abs(a[i].c[0] - b[i].c[0])).toBeLessThan(12);
        expect(Math.abs(a[i].rgb[1] - b[i].rgb[1])).toBeLessThan(0.4);
      }
    }
  });
  it('ramps still (c)’s own step-down back out after N5 (no pop at f3327), and every part’s step moves without a jump through N5 and N6', () => {
    // each part's step as the kit draws it: the late set (testsStep), its own ramp, or the beat's
    const IDS = ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'testsBay', 'reel', 'lock', 'gauge', 'head', 'index', 'mouth', 'jaws', 'bosses', 'deck', 'stress'] as const;
    const amountOf = (f: number, id: string): number => {
      const s = deskStateAt(f);
      const st = isStepped(s.step, id);
      return st === 'late' ? s.testsStep : st === 'own' ? s.step.own!.amount : st ? s.step.amount : 0;
    };
    for (const id of IDS) {
      let prev = amountOf(3020, id);
      for (let f = 3021; f < 3420; f++) {
        const a = amountOf(f, id);
        expect(Math.abs(a - prev), `${id} at f${f}`).toBeLessThan(0.2);
        prev = a;
      }
    }
    // the docs bay (W-09's name strip in the notes band) stays down until N6's line has gone, then comes up
    for (let f = 3060; f < N6_GONE; f += 3) expect(amountOf(f, 'docsBay'), `f${f}`).toBe(1);
    expect(amountOf(N6_GONE + STEP_FRAMES, 'docsBay')).toBe(0);
    // the close's print swaps back to the coarse print only once N6 is gone
    expect(closeAt(N6_GONE)).toBe(1);
    expect(closeAt(N6_GONE + 8)).toBe(0);
  });
  it('steps the stress plate down with N5 as it leaves: it never relights on its way out', () => {
    for (let f = E6.plateExit; f < E6.plateExit + E6.plateOut; f++) {
      const s = deskStateAt(f);
      expect(s.step.ids, `f${f}`).toContain('stress');
      if (f >= STRESS_LATE) expect(s.testsStep, `f${f}`).toBe(1);
    }
  });
  it('holds the close (still (c)’s framing) from the bar-34 dolly to the bar-43 ease-out', () => {
    for (const f of [2720, 2800, 2960, 3080, 3150, 3280, 3350, 3360]) expect(cameraAt(f, 15)).toEqual(deskCamera(FRAMING_C, 15));
  });
  it('keeps the footprints under the shader’s budget through beat 6', () => {
    let max = 0;
    for (let f = 2640; f < 3440; f++) max = Math.max(max, footprintsAt(deskStateAt(f)).length);
    expect(max).toBeLessThanOrEqual(MAX_FOOTPRINTS - 8);
    // from C17 (f3440) the Thread cord's footprints come in: still inside the shaders' array
    for (let f = 3440; f < 3480; f++) expect(footprintsAt(deskStateAt(f)).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
  });
  it('files #0408 under the older tabs: they stand on it where it lies under them, never over the request’s tab', () => {
    expect(TAB_LEAN_REQUEST).toBe(TAB_LEAN_C);
    // the front tab's foot lies under the request's tab (it stays on the floor); the others stand on #0408
    expect(FILED_LIFT[0]).toBe(0);
    for (const k of [1, 2, 3]) expect(FILED_LIFT[k]!).toBeGreaterThan(2);
  });
  it('draws nothing of beat 6 in the summary’s world', () => {
    const e = beat6At(E6.until, dock);
    expect(e.strip).toHaveLength(0);
    expect(e.bar).toBeNull();
    expect(e.plate).toBeNull();
    expect(e.thread).toBeNull();
    expect(e.advance).toBe(0);
    expect(e.rewind).toBe(0);
    expect(deskStateAt(E6.until).cache!.summary).toBe(true);
  });
});

describe('#0408’s ID buried as it is filed (A1)', () => {
  it('lets its bury down under cover after the request’s tab has landed on it and settled, done before still (c)', async () => {
    const { TAB_INK_OFF } = await import('./objects/Cache.tsx');
    expect(TAB_INK_OFF).toBeGreaterThanOrEqual(EVENTS_C.tabDrop + EVENTS_C.tabFrames + 4);
    // still (c) is film 3150: the bury is wholly let down by then, so (c) draws #0408 exactly as before
    expect(TAB_INK_OFF + 4).toBeLessThanOrEqual(3150);
  });
});

