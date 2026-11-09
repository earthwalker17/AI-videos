import { describe, expect, it } from 'vitest';
import { BOTH_FIXES, FIX_A, FIX_B } from '../cues.ts';
import { TITLE_CARD, actOneFrameFootprints, fixAOf, fixBOf } from './ActOneFrame.tsx';
import { actOneAt, actOneStep, actOneStepA } from './actOne.ts';
import {
  A_FOLDER_IN,
  A_ITEMS,
  A_POURS,
  A_QUEUE,
  A_RISE,
  A_STEPS,
  B_RISE,
  FIX_A_FOLDER,
  FOLLOW_UP,
  REPLY_7,
  TRAYS,
  aPathAt,
  aWoundAt,
} from './beat3.ts';
import { cameraAt, project } from './camera.ts';
import { MAX_FOOTPRINTS } from './footprints.ts';
import { TURN, fixATurnAt, fixBTurnAt, loopTurnAt, shiftAt } from './turn.ts';

const pose = cameraAt(1000, 15);
const span = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('beat 3 hands the turn its state at f1400 (no seam)', () => {
  it('poses Fix A as turn.ts does at f1400, and holds it there from the last beat-3 advance on', () => {
    const turn = fixATurnAt(1400, loopTurnAt(1400));
    const a = fixAOf(1400).main;
    expect(a.wound).toBeCloseTo(0, 12);
    expect(a.deskLen).toBeCloseTo(turn.deskLen, 9);
    expect(a.spanLen).toBeCloseTo(turn.spanLen, 9);
    expect(JSON.stringify(a.span)).toBe(JSON.stringify(turn.span));
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(turn.items));
    // nothing of the main instance moves after the advance at 1380 has finished (the turn advances at 1400)
    for (const f of span(A_STEPS[A_STEPS.length - 1] + 10, 1399)) expect(JSON.stringify(fixAOf(f).main)).toBe(JSON.stringify(fixAOf(1400).main));
    // and every item ahead of A_ITEMS has gone in under the folder by then
    for (const inst of fixAOf(1395).extras) expect(inst.items.every((it) => it === null)).toBe(true);
  });

  it('poses Fix B as turn.ts does at f1400, reply 7 posting on the turn’s own frames', () => {
    const b = fixBOf(1400);
    expect(b.rise).toBe(0);
    expect(JSON.stringify(b.b)).toBe(JSON.stringify(fixBTurnAt(1400, shiftAt)));
    expect(REPLY_7.post).toBe(TURN.bPost);
    expect(REPLY_7.arc).toBe(TURN.bArc);
    for (const f of span(1380, 1400)) expect(JSON.stringify(fixBOf(f).b)).toBe(JSON.stringify(fixBTurnAt(f, shiftAt)));
  });

  it('is back at full contrast everywhere before the turn (whose own focus pull starts at f1436)', () => {
    for (const f of span(BOTH_FIXES + 14, 1419)) {
      expect(actOneStep(f).amount).toBe(0);
      expect(actOneStep(f).own?.amount).toBe(0);
      expect(actOneStepA(f)).toBe(0);
    }
  });
});

describe('Fix A (3.1)', () => {
  it('rises from below the frame on its cue, before C5 wipes in, and never pops', () => {
    expect(A_RISE.from).toBe(FIX_A.in);
    const at = (f: number) => {
      const A = fixAOf(f);
      return project(cameraAt(f, 15), [FIX_A_FOLDER.c[0], FIX_A_FOLDER.c[1] + FIX_A_FOLDER.d / 2 - A.rise, 12]);
    };
    expect(at(FIX_A.in)[1]).toBeGreaterThan(1090);
    expect(fixAOf(A_RISE.from + A_RISE.frames).rise).toBe(0);
    expect(A_RISE.from + A_RISE.frames).toBeLessThanOrEqual(988);
    // no step on the screen bigger than a few dozen px a frame
    for (const f of span(FIX_A.in, A_RISE.from + A_RISE.frames)) expect(Math.abs(at(f + 1)[1] - at(f)[1])).toBeLessThan(90);
  });

  it('advances one station on every beat from bar 13 beat 2 to the turn', () => {
    expect(A_STEPS[0]).toBe(980);
    expect(A_STEPS.length).toBe(21);
    for (let i = 1; i < A_STEPS.length; i++) expect(A_STEPS[i] - A_STEPS[i - 1]).toBe(20);
    expect(aWoundAt(970)).toBeCloseTo(-43 * 21, 9);
    expect(aWoundAt(1395)).toBeCloseTo(0, 12);
    // between steps the queue is dead still
    expect(aWoundAt(995)).toBe(aWoundAt(999));
  });

  it('pours every item in frame from a feeder, out of its mouth, landing at the queue’s tail, never while Fix A is still rising', () => {
    let prev = -Infinity;
    for (const P of A_POURS) {
      expect(P.lands).toBeGreaterThan(prev);
      prev = P.lands;
      expect(P.lands - P.arc - 3).toBeGreaterThan(A_RISE.from + A_RISE.frames);
      // it lands in frame, on the tape, behind the item poured before it
      const q = A_QUEUE[P.q];
      const A = fixAOf(P.lands);
      const it = (q.inst === 0 ? A.main.items : A.extras[q.inst - 1].items)[q.slot]!;
      expect(it).not.toBeNull();
      const s = project(cameraAt(P.lands, 15), it.p);
      expect(s[0]).toBeGreaterThan(0);
      expect(it.p[2]).toBeLessThan(2);
    }
    expect(A_POURS.length).toBeGreaterThan(25);
  });

  it('keeps the queue nose to tail and the grey request behind a dozen items', () => {
    for (let i = 1; i < A_QUEUE.length; i++) {
      const a = A_QUEUE[i - 1];
      const b = A_QUEUE[i];
      expect(b.u - b.l / 2 - (a.u + a.l / 2)).toBeCloseTo(5, 6);
    }
    expect(A_ITEMS.findIndex((it) => it.kind === 'request')).toBe(12);
    expect(A_QUEUE.filter((q) => q.kind === 'request')).toHaveLength(1);
  });

  it('hides an item only once it is wholly in under the folder', () => {
    for (const f of span(980, 1399)) {
      const A = fixAOf(f);
      [A.main, ...A.extras].forEach((inst) =>
        inst.items.forEach((it) => {
          if (!it || it.p[2] > 2) return;
          // anything on the tape lies at or south of the folder's mouth (none pokes out of its north side)
          const d0 = aPathAt(0).p;
          expect(Math.hypot(it.p[0] - d0[0], it.p[1] - d0[1])).toBeGreaterThan(A_FOLDER_IN - 120);
        }),
      );
    }
  });
});

describe('Fix B (3.2)', () => {
  it('slides in from the east edge on its cue and fires replies 0–6 on the cue sheet’s frames', () => {
    expect(B_RISE.from).toBe(FIX_B.in);
    const p = cameraAt(FIX_B.in, 15);
    for (const tr of TRAYS) expect(project(p, [tr.c[0] - tr.w / 2 + fixBOf(FIX_B.in).rise, tr.c[1], 7])[0]).toBeGreaterThan(1930);
    expect(fixBOf(B_RISE.from + B_RISE.frames).rise).toBe(0);
    expect(B_RISE.from + B_RISE.frames).toBeLessThan(FIX_B.replies[0]);
    FIX_B.replies.forEach((leave, k) => {
      expect(JSON.stringify(fixBOf(leave - 1).b.slips[k])).toBe(JSON.stringify(fixBOf(leave).b.slips[k]));
      expect(fixBOf(leave + 8).b.slips[k].p[2]).toBeGreaterThan(fixBOf(leave).b.slips[k].p[2] + 20);
    });
  });

  it('lands the follow-up in tray 6 on its cue, and every reply in your in-tray before the turn', () => {
    expect(FOLLOW_UP.lands).toBe(FIX_B.followUp);
    const fu = fixBOf(FIX_B.followUp).followUp!;
    expect(Math.hypot(fu.p[0] - TRAYS[6].c[0], fu.p[1] - TRAYS[6].c[1])).toBeLessThan(30);
    expect(fixBOf(FIX_B.followUp - 30).followUp).toBeNull();
    const t = fixBTurnAt(1400, shiftAt);
    for (let k = 0; k < 7; k++) expect(fixBOf(1300).b.slips[k]).toEqual(t.slips[k]);
  });
});

describe('act one’s shadows fit the shaders', () => {
  it('casts at most MAX_FOOTPRINTS footprints on every frame of act one', () => {
    let most = 0;
    for (let f = 0; f < 1400; f++) {
      const n = actOneFrameFootprints(f, cameraAt(f, 15)).length;
      most = Math.max(most, n);
      expect(n, `f${f}`).toBeLessThanOrEqual(MAX_FOOTPRINTS);
    }
    expect(most).toBeGreaterThan(60);
  });
  it('is a pure function of the frame', () => {
    for (const f of [0, 150, 700, 905, 1100, 1250, 1399]) {
      expect(JSON.stringify(actOneAt(f))).toBe(JSON.stringify(actOneAt(f)));
      expect(JSON.stringify(fixAOf(f))).toBe(JSON.stringify(fixAOf(f)));
      expect(JSON.stringify(fixBOf(f))).toBe(JSON.stringify(fixBOf(f)));
    }
    void pose;
    void TITLE_CARD;
  });
});
