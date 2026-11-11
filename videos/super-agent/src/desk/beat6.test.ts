import { describe, expect, it } from 'vitest';
import { BEAT_6, cue } from '../cues.ts';
import { BATCHES, BAR_PARK, CROP, E6, FRONT_X, LAND_S, PITCH, QUEUE_LEN, TRAY, answerAt, barAt, beat6At, decodeAt, hopTargets, plateAt, reviewAt, rewindAt, stripAt, stripSlipAt, threadAt } from './beat6.ts';
import { cameraAt, deskCamera, FRAMING_C } from './camera.ts';
import { footprintsAt, MAX_FOOTPRINTS } from './footprints.ts';
import { poolsAt } from './pools.ts';
import { EVENTS_C, SPRING, deskStateAt, springAt } from './state.ts';
import type { P3 } from './layout.ts';

const dock = (f: number, at: number) => springAt(f, at, SPRING.dock);
const dist = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('beat 6: every cue sheet frame is a contact frame', () => {
  it('lands each waiting slip in the strip on its frame, a pitch behind the one before', () => {
    for (const b of BATCHES)
      b.slips.forEach((L, i) => {
        const before = stripSlipAt(L - 1, b, i)!;
        const on = stripSlipAt(L, b, i)!;
        expect(before.inStrip).toBe(false);
        expect(on.inStrip).toBe(true);
        expect(on.pose.p[0]).toBeCloseTo(FRONT_X + i * PITCH, 6);
        expect(on.view).not.toBeNull();
        // sliding along the tray until then, never past its place
        expect(before.pose.p[0]).toBeGreaterThan(on.pose.p[0]);
        expect(dist(before.pose.p, on.pose.p)).toBeLessThan(45);
      });
  });
  it('sweeps each strip on its downbeat for sweepBase + sweepPerSlip per slip frames; every cell is lit within 6 f', () => {
    for (const b of BATCHES) {
      expect(b.sweepFrames).toBe(BEAT_6.sweepBase + BEAT_6.sweepPerSlip * b.n);
      expect(b.sweep).toBe(cue(b.k === 0 ? 'batch' : 'batch-2').frame);
      // still before it (10-20 f of stillness before the climax): the bar parked, no cell lit
      expect(barAt(b.sweep - 2)!.x).toBeCloseTo(BAR_PARK, 9);
      expect(stripAt(b.sweep - 2).filter((x) => x.b === b.k && x.lit > 0)).toHaveLength(0);
      const last = Math.max(...b.slips);
      expect(b.sweep - last).toBeGreaterThanOrEqual(10);
      // on the downbeat the bar is off its park and the front cell is lit
      expect(barAt(b.sweep)!.x).toBeGreaterThan(BAR_PARK + 10);
      expect(stripAt(b.sweep).find((x) => x.b === b.k && x.i === 0)!.lit).toBeGreaterThan(0.5);
      // every cell lit within 6 f
      for (const x of stripAt(b.sweep + 5).filter((y) => y.b === b.k)) expect(x.lit).toBe(1);
      // the whole strip is drawn in under the west hood within the sweep, the bar back on its park at its end
      expect(stripAt(b.end).filter((x) => x.b === b.k && !x.hidden)).toHaveLength(0);
      expect(barAt(b.end)!.x).toBeCloseTo(BAR_PARK, 9);
    }
    // the longer strip is swept barely longer
    expect(BATCHES[1].sweepFrames - BATCHES[0].sweepFrames).toBe(BATCHES[1].n - BATCHES[0].n);
  });
  it('clears the tray before the next batch’s first slip comes out of the east hood (the real queue clears every beat)', () => {
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
    // the text is fully there from the plate cue's span (it arrives engraved) and stays to the summary
    expect(plateAt(cue('plate').frame)).not.toBeNull();
    expect(plateAt(E6.until - 1)!.d).toEqual([0, 0, 0]);
  });
  it('holds the cache’s eject, fold and the tab’s landing on the score’s frames', () => {
    expect(EVENTS_C.cardEject).toBe(BEAT_6.cacheEject);
    expect(EVENTS_C.fold).toBe(BEAT_6.cacheFold);
    // audio/keepUp.ts TAB_LANDS: the pointer tick 16 f after the fold
    expect(EVENTS_C.tabDrop + EVENTS_C.tabFrames).toBe(BEAT_6.cacheFold + 16);
  });
  it('brings the review card into the throat on review-card and stamps it in on review-in', () => {
    const R = BEAT_6.recall;
    const at = reviewAt(R.card)!;
    const before = reviewAt(R.card - 1)!;
    expect(before.p[0]).toBeLessThan(at.p[0]);
    expect(reviewAt(R.card + 5)!.p).toEqual(at.p);
    expect(reviewAt(R.stampIn)).toBeNull();
    expect(beat6At(R.stampIn, dock).hammer).toBe(1);
    expect(beat6At(R.stampIn - 3, dock).hammer).toBe(0);
  });
  it('rewinds the reel over rewindFrames from recall', () => {
    const R = BEAT_6.recall;
    expect(rewindAt(R.rewind)).toBe(0);
    expect(rewindAt(R.rewind + 1)).toBeGreaterThan(0);
    expect(rewindAt(R.rewind + R.rewindFrames)).toBe(1);
    expect(rewindAt(R.rewind + R.rewindFrames - 1)).toBeLessThan(1);
  });
  it('lands each hop of the reading thread on its frame (10 f a hop, 4 f dwell), each opening its № tab', () => {
    const T = hopTargets();
    BEAT_6.recall.hops.forEach((h, k) => {
      const t = threadAt(h, dock)!;
      expect(dist(t.pts[t.pts.length - 1], T[k + 1])).toBeLessThan(1e-6);
      const t1 = threadAt(h - 1, dock)!;
      expect(dist(t1.pts[t1.pts.length - 1], T[k + 1])).toBeGreaterThan(1);
      expect(t.tabs[k]).toBe(0);
      expect(threadAt(h + 1, dock)!.tabs[k]).toBeGreaterThan(0);
      if (k > 0) expect(h - BEAT_6.recall.hops[k - 1]).toBe(E6.hopFrames + 4);
    });
    expect(threadAt(BEAT_6.recall.hops[0] - E6.hopFrames - 1, dock)).toBeNull();
  });
  it('sends the answer back on recall-answer under the transit light', () => {
    const a = BEAT_6.recall.answer;
    expect(answerAt(a - 1)!.free).toBe(false);
    expect(answerAt(a)!.free).toBe(true);
    expect(answerAt(a + 6)!.transit).toBeGreaterThan(0.5);
    expect(answerAt(a + E6.answerFly)).toBeNull();
  });
});

describe('beat 6: nothing jumps, nothing vanishes in the open', () => {
  it('moves every slip, the bar, the plate, the card, the answer and the thread’s head less than 60 u a frame', () => {
    const key = (b: number, i: number) => `${b}.${i}`;
    let prev = new Map<string, P3>();
    let prevBar: P3 | null = null;
    let prevPlate: P3 | null = null;
    let prevReview: P3 | null = null;
    let prevAnswer: P3 | null = null;
    let prevHead: P3 | null = null;
    for (let f = 2700; f < 3460; f++) {
      const e = beat6At(f, dock);
      const now = new Map<string, P3>();
      for (const x of e.strip) {
        // a slip under the head and the deck plate is out of sight (its way from the throat to the tray's east hood)
        if (x.hidden) continue;
        now.set(key(x.b, x.i), x.pose.p);
        const p = prev.get(key(x.b, x.i));
        if (p) expect(dist(p, x.pose.p), `slip ${key(x.b, x.i)} at f${f}`).toBeLessThan(60);
      }
      // a slip leaves the open only into the throat (under the head) or under the west hood (drawn in with its strip)
      for (const [k, p] of prev) if (!now.has(k)) expect(p[0] < -300 || p[0] + 48 < CROP.west + 40, `slip ${k} gone at f${f} at x ${p[0]}`).toBe(true);
      prev = now;
      const bp: P3 | null = e.bar ? [e.bar.x, 0, 0] : null;
      if (bp && prevBar) expect(dist(prevBar, bp)).toBeLessThan(60);
      prevBar = bp;
      const pp: P3 | null = e.plate ? e.plate.d : null;
      if (pp && prevPlate) expect(dist(pp, prevPlate)).toBeLessThan(60);
      prevPlate = pp;
      if (e.review && prevReview) expect(dist(e.review.p, prevReview)).toBeLessThan(60);
      prevReview = e.review?.p ?? null;
      if (e.answer && prevAnswer) expect(dist(e.answer.p, prevAnswer)).toBeLessThan(60);
      prevAnswer = e.answer?.p ?? null;
      const head = e.thread ? e.thread.pts[e.thread.pts.length - 1] : null;
      if (head && prevHead) expect(dist(head, prevHead)).toBeLessThan(60);
      prevHead = head;
    }
  });
  it('posts every slip from inside the chat spout and lands it on the belt', () => {
    expect(LAND_S).toBeGreaterThan(0);
    expect(LAND_S).toBeLessThan(QUEUE_LEN);
    for (const b of BATCHES)
      for (let i = 0; i < b.n; i++) {
        let f = b.slips[i] - 80;
        while (!stripSlipAt(f, b, i)) f++;
        // its first frame: inside the spout's drum, west of its mouth
        expect(stripSlipAt(f, b, i)!.pose.p[0]).toBeLessThan(-890);
      }
  });
  it('never lets two slips of a strip stand in each other’s place, and keeps the last of the long strip on the belt', () => {
    const b = BATCHES[1];
    // the eighth's tail clear of the east hood's crop; the front's nose clear of the west hood
    expect(FRONT_X + (b.n - 1) * PITCH + 48).toBeLessThanOrEqual(CROP.east);
    expect(FRONT_X - 48).toBeGreaterThanOrEqual(TRAY.x0 + TRAY.hood);
    expect(LAND_S).toBeLessThan(QUEUE_LEN);
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
  it('holds the close (still (c)’s framing) from the bar-34 dolly to the bar-42 ease-out', () => {
    for (const f of [2720, 2800, 2960, 3080, 3150, 3280]) expect(cameraAt(f, 15)).toEqual(deskCamera(FRAMING_C, 15));
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
