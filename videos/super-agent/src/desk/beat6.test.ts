import { describe, expect, it } from 'vitest';
import { BEAT_6, cue } from '../cues.ts';
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
  reviewAt,
  rewindAt,
  stripAt,
  stripFrames,
  stripSlipAt,
  threadAt,
  threadRowX,
  type PathPose,
} from './beat6.ts';
import { cameraAt, deskCamera, FRAMING_C, project } from './camera.ts';
import { footprintsAt, MAX_FOOTPRINTS } from './footprints.ts';
import { INDEX, PRINT_HEAD, TAPE_FLAT_X1, THROAT, type P3 } from './layout.ts';
import { poolsAt } from './pools.ts';
import { DETENT, EVENTS_C, SPRING, STRESS_LATE, deskStateAt, headDipAt, springAt } from './state.ts';

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
    expect(plateAt(E6.until - 1)!.d).toEqual([0, 0, 0]);
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
    expect(before.p[0]).toBeLessThan(at.p[0]);
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
  it('ramps still (c)’s own step-down back out after N5 (no pop at f3327)', () => {
    let prev = deskStateAt(3100).step.own?.amount ?? 0;
    for (let f = 3101; f < 3340; f++) {
      const a = deskStateAt(f).step.own?.amount ?? 0;
      expect(Math.abs(a - prev), `f${f}`).toBeLessThan(0.2);
      prev = a;
    }
  });
  it('keeps the stress plate stepped down from N5 on: it hands over to the late set at a full step and never relights', () => {
    const at = deskStateAt(STRESS_LATE);
    expect(at.step.ids).toContain('stress');
    expect(at.step.amount).toBe(1);
    for (let f = STRESS_LATE; f < E6.until; f += 7) expect(deskStateAt(f).testsStep, `f${f}`).toBe(1);
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
