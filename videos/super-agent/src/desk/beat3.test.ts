import { describe, expect, it } from 'vitest';
import { BEAT, BOTH_FIXES, FIX_A, FIX_B } from '../cues.ts';
import { actOneFrameFootprints, fixAOf, fixBOf } from './ActOneFrame.tsx';
import { FIX_LAMP, FOLDERS, LOOP_A, MOUTH, POOL_A_Z, REQUEST_ON_TAPE, REQUEST_STEPPED_FROM, actOneAt, actOneStep, actOneStepA, loopPoint, requestStepOf, stackTop } from './actOne.ts';
import {
  A_CHUTES,
  A_FOLDER_IN,
  A_FOLDER_TOP,
  A_STACK_END,
  A_LAST_LAUNCH,
  A_PILE,
  A_POURS,
  A_QUEUE,
  A_REQUEST,
  A_SIZE,
  A_STEPS,
  A_STEP_FRAMES,
  A_SWALLOW_FRAMES,
  A_TAPE_W,
  BREAK,
  B_POST,
  B_SLIP,
  EVENT_SIZE,
  FIX_A_FOLDER,
  FOLLOW_UP,
  REPLY_7,
  REPLY_FREE,
  RIFFLE,
  riffleSheetFootprint,
  STUB,
  TEAR,
  TRAYS,
  TRAY_STUFF,
  TRAY_Z,
  aBackAt,
  aPathAt,
  aStackTopAt,
  replyFreeB,
  replyLandsB,
  replyPostedB,
  replySlipFootprint,
  replyToneB,
  trayLandsB,
  trayThrownB,
} from './beat3.ts';
import { cameraAt, project } from './camera.ts';
import { MAX_FOOTPRINTS } from './footprints.ts';
import { fixATurnAt, fixBTurnAt, loopTurnAt, shiftAt, turnAt } from './turn.ts';

const span = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const scr = (f: number, p: readonly number[]) => project(cameraAt(f, 15), [p[0], p[1], p[2] ?? 0]);
const json = (x: unknown) => JSON.stringify(x);

describe('beat 3 comes to rest before the turn (f1399)', () => {
  it('launches nothing after A_LAST_LAUNCH: every pour and every swallow has finished, and Fix A is dead still from its last advance', () => {
    for (const P of A_POURS) expect(P.lands).toBeLessThanOrEqual(A_LAST_LAUNCH);
    for (const q of A_QUEUE) if (q.swallow) expect(q.swallow.at).toBeLessThanOrEqual(A_LAST_LAUNCH);
    const last = Math.max(A_STEPS[A_STEPS.length - 1] + A_STEP_FRAMES, ...A_QUEUE.map((q) => (q.swallow ? q.swallow.at + A_SWALLOW_FRAMES : 0)));
    expect(last).toBeLessThanOrEqual(1390);
    for (const f of span(last, 1399)) expect(json(fixAOf(f)), `f${f}`).toBe(json(fixAOf(1399)));
  });

  it('posts reply 7 on the cue sheet’s frame and launches nothing after it: from its landing and jostle every reply holds still to f1399', () => {
    expect(REPLY_7.post).toBe(FIX_B.reply7);
    const settled = Math.max(FIX_B.replies[6], FIX_B.reply7) + 3 + 14 + 8;
    for (const f of span(settled, 1399)) expect(json(fixBOf(f).b.slips), `f${f}`).toBe(json(fixBOf(settled).b.slips));
  });

  it('posts reply 7 without a dip: it lifts over its anticipation and the arc starts from there', () => {
    const z = span(REPLY_7.post, REPLY_7.post + 6).map((f) => fixBOf(f).b.slips[7].p[2]);
    for (let i = 1; i < z.length; i++) expect(z[i], `f${REPLY_7.post + i}`).toBeGreaterThanOrEqual(z[i - 1]);
  });

  it('brings both fixes, your desk, the folders and the loop back to full contrast in 3.3; the intake stays down into the turn', () => {
    for (const f of span(BOTH_FIXES + 14, 1399)) {
      expect(actOneStep(f).own?.amount).toBe(0);
      expect(actOneStepA(f)).toBe(0);
      // the turn holds the feeders, the heap and the request down until its stepOut (turn.ts): beat 3 hands them over down
      expect(actOneStep(f).amount).toBe(1);
      expect(actOneStep(f).ids).toEqual(['intake']);
    }
  });

  // The turn (turn.ts, TurnFrame) takes beat 3's f1399 state over (turn.test.ts holds the whole frame's shadows equal too).
  it('turn.ts fixATurnAt(1400) starts from beat 3’s f1399 Fix A (its queue where beat 3 leaves it)', () => {
    const turn = fixATurnAt(1400, loopTurnAt(1400));
    const a = fixAOf(1399).items.filter((x) => x !== null);
    expect(turn.items.filter((x) => x !== null).map((x) => x!.p.map((v) => Math.round(v)))).toEqual(a.map((x) => x!.p.map((v) => Math.round(v))));
  });
  it('turn.ts fixBTurnAt(1400) continues beat 3’s Fix B (every reply home in your in-tray, reply 7 too)', () => {
    expect(json(fixBTurnAt(1400, shiftAt).slips)).toBe(json(fixBOf(1400).b.slips));
  });
});

describe('Fix A (3.1): one folder, one tape, every feeder pouring onto it', () => {
  it('arrives on its cue: the folder slides up from below the frame as the tape runs in from above it, the chutes out before the first pour', () => {
    const F = FIX_A_FOLDER;
    const A0 = fixAOf(FIX_A.in);
    expect(scr(FIX_A.in, [F.c[0], F.c[1] + F.d / 2 - (A0.folderDy ?? 0), 20])[1]).toBeGreaterThan(1080);
    expect(A0.tape ? scr(FIX_A.in, [...aPathAt(A0.tape.d0).p, aPathAt(A0.tape.d0).z])[1] : -1).toBeLessThan(0);
    expect(fixAOf(984).folderDy).toBe(0);
    expect(aBackAt(980)).toBeCloseTo(A_STEPS.length * 16, 9);
    const first = A_POURS[0].lands - A_POURS[0].arc - 3;
    expect(fixAOf(first).chutes!.every((e) => e === 1)).toBe(true);
    // no step on the screen bigger than a few dozen px a frame for the folder
    for (const f of span(FIX_A.in, 990)) expect(Math.abs((fixAOf(f + 1).folderDy ?? 0) - (fixAOf(f).folderDy ?? 0)) * 1.2).toBeLessThan(100);
  });

  it('advances one station on every beat from bar 13 beat 2, dead still between', () => {
    expect(A_STEPS[0]).toBe(980);
    expect(A_STEPS.length).toBe(21);
    for (let i = 1; i < A_STEPS.length; i++) expect(A_STEPS[i] - A_STEPS[i - 1]).toBe(20);
    expect(aBackAt(1395)).toBeCloseTo(0, 12);
    expect(aBackAt(995)).toBe(aBackAt(999));
  });

  it('drops from every feeder: out of its mouth, over its chute, onto its own place on the tape as it lands', () => {
    expect(new Set(A_POURS.map((P) => P.from))).toEqual(new Set(['chat', 'ci', 'mail', 'calendar']));
    for (const P of A_POURS) {
      const t0 = P.lands - P.arc - 3;
      expect(fixAOf(t0 - 1).items[P.q]).toBeNull();
      expect(fixAOf(t0).items[P.q]!.p).toEqual(MOUTH[P.from].in);
      const before = fixAOf(P.lands - 1).items[P.q]!;
      const at = fixAOf(P.lands).items[P.q]!;
      expect(at.air).toBeUndefined();
      expect(Math.hypot(at.p[0] - before.p[0], at.p[1] - before.p[1], at.p[2] - before.p[2])).toBeLessThan(20);
      // it lands where its chute meets the tape
      const c = A_CHUTES.find((x) => x.from === P.from)!;
      expect(Math.abs(at.p[1] - c.y)).toBeLessThan(10);
    }
  });

  it('shows the grey request legibly behind a dozen from the start of 3.1, and it waits (never reaches the folder)', () => {
    expect(A_SIZE.request[0] * 1.2).toBeGreaterThanOrEqual(56);
    expect(A_QUEUE[A_REQUEST].pour!.from).toBe('chat');
    expect(A_QUEUE[A_REQUEST].pour!.lands).toBeLessThanOrEqual(FIX_A.steps[0] + 10);
    const ahead = (f: number) => fixAOf(f).items.filter((it, i) => it && !it.air && i < A_REQUEST).length;
    expect(ahead(A_QUEUE[A_REQUEST].pour!.lands)).toBeGreaterThanOrEqual(12);
    expect(A_QUEUE[A_REQUEST].swallow).toBeUndefined();
    for (const f of span(A_QUEUE[A_REQUEST].pour!.lands, 1399)) {
      const s = scr(f, fixAOf(f).items[A_REQUEST]!.p);
      expect(s[0]).toBeGreaterThan(96);
      expect(s[1]).toBeGreaterThan(54);
      expect(s[1]).toBeLessThan(868);
    }
  });

  it('interleaves three task cards (at least 48 px) on the tape within 3.1', () => {
    expect(A_SIZE.task[0] * 1.2).toBeGreaterThanOrEqual(48);
    const A = fixAOf(1100);
    expect(A.items.filter((it, i) => it && !it.air && A_QUEUE[i].kind === 'task').length).toBeGreaterThanOrEqual(3);
  });

  it('lifts each item at the mouth onto the pile without a jump, the pile growing one by one; nothing lies inside the folder', () => {
    let pile = fixAOf(980).pile!.length;
    for (const f of span(980, 1399)) {
      const A = fixAOf(f);
      expect(A.pile!.length).toBeGreaterThanOrEqual(pile);
      expect(A.pile!.length - pile).toBeLessThanOrEqual(1);
      pile = A.pile!.length;
      A.items.forEach((it, i) => {
        if (!it || it.air) return;
        // on the tape: its centre outside the folder's mouth (the swallow lifts it before it would go under the cover)
        const d = A_QUEUE[i].d + aBackAt(f);
        expect(d, `f${f} item ${i}`).toBeGreaterThan(A_FOLDER_IN);
      });
    }
    expect(pile).toBe(A_PILE.length);
    // each swallowed item rises clear of the stack before it crosses over it: whenever its plan overlaps the stack's, its
    // underside is at or above the stack's top (it never passes through the folder)
    const F = FIX_A_FOLDER;
    const R = { x0: F.c[0] - F.w / 2 + 5, x1: F.c[0] + F.w / 2 - 5, y0: F.c[1] - F.d / 2 + 5, y1: F.c[1] + F.d / 2 - 5 };
    for (const q of A_QUEUE) {
      if (!q.swallow) continue;
      const [l, w] = A_SIZE[q.kind];
      // (on its first frame it still lies on the tape, its nose in the mouth under the cover, as it came)
      for (const f of span(q.swallow.at + 1, q.swallow.at + A_SWALLOW_FRAMES)) {
        const A = fixAOf(f);
        const it = A.pile![q.swallow.m];
        const dy = A.folderDy ?? 0;
        const corners = [
          [1, 1],
          [1, -1],
          [-1, -1],
          [-1, 1],
        ].map(([a, b]) => [it.p[0] + (it.x[0] * a * l) / 2 + (it.y[0] * b * w) / 2, it.p[1] + dy + (it.x[1] * a * l) / 2 + (it.y[1] * b * w) / 2]);
        const box = [
          [R.x0, R.y0],
          [R.x1, R.y0],
          [R.x1, R.y1],
          [R.x0, R.y1],
        ];
        const axes = [
          [1, 0],
          [0, 1],
          [it.x[0], it.x[1]],
          [it.y[0], it.y[1]],
        ];
        const overlaps = axes.every(([ax, ay]) => {
          const pa = corners.map(([x, y]) => x * ax + y * ay);
          const pb = box.map(([x, y]) => x * ax + y * ay);
          return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
        });
        if (overlaps) expect(it.p[2], `item ${q.swallow.m} f${f}`).toBeGreaterThanOrEqual(aStackTopAt(f));
      }
    }
    for (const q of A_QUEUE) {
      if (!q.swallow) continue;
      const i = A_QUEUE.indexOf(q);
      const last = fixAOf(q.swallow.at - 1).items[i]!;
      const first = fixAOf(q.swallow.at).pile![q.swallow.m];
      // the frame before, it was finishing its last station (its move curve ends on this frame)
      expect(Math.hypot(first.p[0] - last.p[0], first.p[1] - last.p[1], first.p[2] - last.p[2])).toBeLessThan(0.5);
      expect(fixAOf(q.swallow.at).items[i]).toBeNull();
    }
  });

  it('ends its tape inside the folder, away from your notes loop, and keeps it north of the notes band', () => {
    for (const f of [980, 1100, 1250, 1399]) {
      const t = fixAOf(f).tape!;
      expect(t.d0).toBeGreaterThanOrEqual(A_FOLDER_IN - 14);
      for (let d = t.d0; d <= t.d1; d += 10) {
        const p = aPathAt(d).p;
        for (let k = 0; k < 64; k++) {
          const q = loopPoint(LOOP_A, (k / 64) * Math.PI * 2);
          expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeGreaterThan(60);
        }
        expect(scr(f, [p[0], p[1] - A_TAPE_W / 2, aPathAt(d).z])[1]).toBeLessThan(868);
      }
    }
  });

  it('is what your lamp turns to in 3.1, then Fix B in 3.2, then between them in 3.3', () => {
    expect(Math.hypot(FIX_LAMP.a.aim[0] - FIX_A_FOLDER.c[0], FIX_LAMP.a.aim[1] - FIX_A_FOLDER.c[1])).toBeLessThan(90);
    const cx = TRAYS.reduce((s, t) => s + t.c[0], 0) / TRAYS.length;
    const cy = TRAYS.reduce((s, t) => s + t.c[1], 0) / TRAYS.length;
    expect(Math.hypot(FIX_LAMP.b.aim[0] - cx, FIX_LAMP.b.aim[1] - cy)).toBeLessThan(30);
    expect(actOneAt(1100).lamp.n).toBe(FIX_LAMP.a.n);
    expect(actOneAt(1250).lamp.n).toBe(FIX_LAMP.b.n);
    expect(actOneAt(1399).lamp.n).toBe(FIX_LAMP.both.n);
    expect(actOneStepA(1200)).toBeGreaterThan(0.99);
  });
});

describe('Fix B (3.2): eight trays, one per event, none alike', () => {
  it('lies inside title-safe and north of the notes band, no two trays touching, no two the same size', () => {
    const p = cameraAt(1250, 15);
    for (const t of TRAYS) {
      const ne = project(p, [t.c[0] + t.w / 2, t.c[1] + t.d / 2, 7]);
      const se = project(p, [t.c[0] + t.w / 2, t.c[1] - t.d / 2, 7]);
      const sw = project(p, [t.c[0] - t.w / 2, t.c[1] - t.d / 2, 7]);
      expect(Math.max(ne[0], se[0])).toBeLessThanOrEqual(1824);
      expect(Math.max(se[1], sw[1])).toBeLessThan(868);
    }
    for (let i = 0; i < TRAYS.length; i++)
      for (let j = i + 1; j < TRAYS.length; j++) {
        const a = TRAYS[i];
        const b = TRAYS[j];
        const gapX = Math.abs(a.c[0] - b.c[0]) - (a.w + b.w) / 2;
        const gapY = Math.abs(a.c[1] - b.c[1]) - (a.d + b.d) / 2;
        expect(Math.max(gapX, gapY), `${i}-${j}`).toBeGreaterThanOrEqual(3);
        expect(`${a.w}x${a.d}`).not.toBe(`${b.w}x${b.d}`);
      }
    expect(new Set(TRAY_STUFF.map((s) => s.event.kind))).toEqual(new Set(['chat', 'ci', 'mail', 'leaf']));
    expect(new Set(TRAY_STUFF.map((s) => s.dossier.sheets)).size).toBeGreaterThanOrEqual(5);
  });

  it('posts its trays in one by one from beyond the east edge (2 f apart, each with its anticipation and a 3% squash), then fires replies 0–6 on the cue sheet’s frames', () => {
    expect(B_POST.from).toBe(FIX_B.in);
    TRAYS.forEach((tr, k) => {
      const t0 = trayThrownB(k);
      expect(t0 - (k ? trayThrownB(k - 1) : t0 - 2)).toBeGreaterThanOrEqual(2);
      const o = fixBOf(t0).posts[k].off;
      expect(scr(t0, [tr.c[0] - tr.w / 2 + o[0], tr.c[1] + o[1], o[2]])[0]).toBeGreaterThan(1930);
      // the anticipation lifts before it travels
      expect(fixBOf(t0 + 2).posts[k].off[2]).toBeGreaterThan(fixBOf(t0).posts[k].off[2]);
      expect(fixBOf(t0 + 2).posts[k].off[0]).toBe(fixBOf(t0).posts[k].off[0]);
      const lands = trayLandsB(k);
      expect(fixBOf(lands).posts[k].off).toEqual([0, 0, 0]);
      expect(Math.max(...span(lands, lands + 6).map((f) => fixBOf(f).posts[k].squash))).toBeCloseTo(0.03, 2);
      for (const f of span(t0 + 3, lands)) {
        const a = fixBOf(f - 1).posts[k].off;
        const b = fixBOf(f).posts[k].off;
        expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), `tray ${k} f${f}`).toBeLessThan(110);
      }
      // its reply leaves only once it has landed and settled
      expect(lands + 6).toBeLessThanOrEqual(replyPostedB(k));
    });
    FIX_B.replies.forEach((leave, k) => {
      expect(replyPostedB(k)).toBe(leave);
      expect(json(fixBOf(leave - 1).b.slips[k])).toBe(json(fixBOf(leave).b.slips[k]));
      expect(fixBOf(leave + 8).b.slips[k].p[2]).toBeGreaterThan(fixBOf(leave).b.slips[k].p[2] + 20);
    });
  });

  it('makes its trays big enough to read (120 px and more across) and fills each with its own event (48 px and more) and dossier', () => {
    for (const tr of TRAYS) expect(tr.w * 1.2).toBeGreaterThanOrEqual(120);
    for (const [w] of Object.values(EVENT_SIZE)) expect(w * 1.2).toBeGreaterThanOrEqual(48);
    TRAYS.forEach((tr, k) => {
      const S = TRAY_STUFF[k];
      const [ew, ed] = EVENT_SIZE[S.event.kind];
      const inside = (o: readonly number[], w: number, d: number) => Math.abs(o[0]) + w / 2 < tr.w / 2 - 4 && Math.abs(o[1]) + d / 2 < tr.d / 2 - 4;
      expect(inside(S.event.o, ew, ed), `event ${k}`).toBe(true);
      expect(inside(S.dossier.o, S.dossier.w, S.dossier.d), `dossier ${k}`).toBe(true);
      expect(inside(S.reply.o, B_SLIP.l, B_SLIP.w), `reply ${k}`).toBe(true);
      // the event and the dossier never overlap
      expect(S.dossier.o[0] - S.dossier.w / 2 - (S.event.o[0] + ew / 2), `tray ${k}`).toBeGreaterThan(2);
    });
  });

  it('lands the follow-up (tray 2’s family and print, 48 px and more) in tray 6 on its cue; on the break mark tray 2’s card tears in two, both halves left in tray 2', () => {
    expect(FOLLOW_UP.lands).toBe(FIX_B.followUp);
    expect(TEAR.at).toBe(FIX_B.breakMark);
    expect(TEAR.at).toBeGreaterThan(FOLLOW_UP.lands);
    expect(TRAY_STUFF[BREAK.from].event.kind).toBe('ci');
    expect([FOLLOW_UP.w, FOLLOW_UP.d]).toEqual(EVENT_SIZE.ci);
    expect(FOLLOW_UP.w * 1.2).toBeGreaterThanOrEqual(48);
    const fu = fixBOf(FIX_B.followUp).followUp!;
    const t6 = TRAYS[BREAK.to];
    expect(Math.abs(fu.p[0] - t6.c[0])).toBeLessThan(t6.w / 2 - FOLLOW_UP.w / 2);
    expect(Math.abs(fu.p[1] - t6.c[1])).toBeLessThan(t6.d / 2 - FOLLOW_UP.d / 2 + 2);
    // clear of tray 6's own event and dossier
    const S6 = TRAY_STUFF[BREAK.to];
    expect(FOLLOW_UP.o[0] - FOLLOW_UP.w / 2).toBeGreaterThan(S6.event.o[0] + EVENT_SIZE[S6.event.kind][0] / 2);
    expect(FOLLOW_UP.o[0] + FOLLOW_UP.w / 2).toBeLessThan(S6.dossier.o[0] - S6.dossier.w / 2);
    expect(fixBOf(FIX_B.followUp - 30).followUp).toBeNull();
    expect(Math.min(STUB.w, STUB.d) * 1.2).toBeGreaterThanOrEqual(24);
    expect(fixBOf(TEAR.at).tear).toBe(0);
    expect(fixBOf(TEAR.at + 10).tear).toBeGreaterThan(0.9);
    for (const f of span(TEAR.at, TEAR.at + 12)) expect(Math.abs(fixBOf(f + 1).tear - fixBOf(f).tear)).toBeLessThan(0.45);
    // the torn half stays inside tray 2, clear of its dossier
    const t2 = TRAYS[BREAK.from];
    const S2 = TRAY_STUFF[BREAK.from];
    const x = S2.event.o[0] + STUB.w / 2 + TEAR.slide[0];
    const reach = Math.hypot(STUB.w, STUB.d) / 2;
    expect(Math.abs(x) + reach).toBeLessThan(t2.w / 2);
    expect(x + reach).toBeLessThan(S2.dossier.o[0] - S2.dossier.w / 2 + 6);
  });

  it('has every reply in your in-tray by 3.3, reply 7 posting on the cue sheet’s f1300 and landing on top', () => {
    for (let k = 0; k < 7; k++) expect(fixBOf(1290).b.slips[k].p[2]).toBeGreaterThan(28);
    expect(fixBOf(REPLY_7.post - 1).b.slips[7].p[2]).toBeLessThan(4);
    expect(fixBOf(replyLandsB(7)).b.slips[7].p[2]).toBeGreaterThan(28);
  });

  it('works in place on eighths until f1390 (a dossier sheet riffling, nothing launched), every tray at rest from then to the turn', () => {
    let ticks = 0;
    for (let f = RIFFLE.from; f < 1400; f++) {
      const r = fixBOf(f).riffle;
      for (let k = 0; k < 8; k++) {
        if (r[k] > 0 && fixBOf(f - 1).riffle[k] === 0) {
          ticks++;
          // each riffle starts on an eighth
          expect((f - 1 - RIFFLE.from) % (BEAT / 2), `tray ${k} f${f}`).toBe(0);
        }
        expect(Math.abs(r[k] - fixBOf(f - 1).riffle[k])).toBeLessThan(0.5);
      }
    }
    expect(ticks).toBeGreaterThan(30);
    for (const f of span(1390, 1399)) expect(json(fixBOf(f)), `f${f}`).toBe(json(fixBOf(1399)));
    expect(fixBOf(1399).riffle.every((r) => r === 0)).toBe(true);
  });

  it('keeps a riffling sheet in its tray’s shade and contact as it lifts over the rim (its light never leads or trails it), touching nothing else’s', () => {
    let covered = 0;
    for (let f = RIFFLE.from; f < RIFFLE.until + 2; f++) {
      const B = fixBOf(f);
      const fps = actOneFrameFootprints(f);
      for (let k = 0; k < 8; k++) {
        const D = TRAY_STUFF[k].dossier;
        const o = B.posts[k].off[2];
        const hinge = o + TRAY_Z.floor + 0.4 + 0.8 * D.sheets - 0.3;
        const rim = o + TRAY_Z.rim;
        const top = hinge + (D.w - 1) * Math.sin(B.riffle[k]) + 0.3 * Math.cos(B.riffle[k]);
        const fp = riffleSheetFootprint(k, B.riffle[k], B.posts[k]);
        // a sheet resting over the rim (never in the tray's shade) gets nothing; one under it, once any of it rises
        // half a unit over the rim, a plate from just over the rim to over its top
        if (hinge + 0.3 >= rim || top < rim + 0.51) continue;
        expect(fp, `tray ${k} f${f}`).not.toBeNull();
        if (fp?.kind !== 'rect') continue;
        covered++;
        expect(fps).toContainEqual(fp);
        expect(fp.z1).toBeGreaterThan(top + 0.5);
        expect(fp.contact).toBe(0.8);
        // its contact never reaches the rims (a receiver at the rim's top, 0.5 under it, is more than 2 u under its foot)
        expect(fp.z0 - 2).toBeGreaterThan(rim - 0.5);
        expect(fp.z0 - 2).toBeLessThan(rim - 0.5 + 0.02);
      }
    }
    expect(covered).toBeGreaterThan(40);
    expect(riffleSheetFootprint(1, 0, fixBOf(1200).posts[1])).toBeNull();
  });

  it('lifts each reply out of its tray’s shade only as it travels, its paper easing up from its tray tone over 6 f (no flash in place)', () => {
    for (let k = 0; k < 8; k++) {
      const leave = replyPostedB(k);
      // through the anticipation and the arc's first frame the slip's top face stays under the rim: in the tray's shade
      for (const f of span(leave, leave + 3)) {
        expect(fixBOf(f).b.slips[k].p[2] + B_SLIP.t, `reply ${k} f${f}`).toBeLessThan(TRAY_Z.rim - 0.3);
        expect(replyToneB(k, f)).toBe(1);
      }
      // it leaves the shade on replyFreeB, already well over the rim and on its way
      const free = replyFreeB(k);
      expect(fixBOf(free).b.slips[k].p[2]).toBeGreaterThan(TRAY_Z.rim + 5);
      expect(json(fixBOf(free).b.slips[k].p.slice(0, 2))).not.toBe(json(fixBOf(leave).b.slips[k].p.slice(0, 2)));
      // its paper eases up from about its tray tone, a quarter of the way at most in a frame
      expect(replyToneB(k, free)).toBe(REPLY_FREE.from);
      let prev: number = REPLY_FREE.from;
      for (const f of span(free + 1, free + REPLY_FREE.frames)) {
        const t = replyToneB(k, f);
        expect(t, `reply ${k} f${f}`).toBeGreaterThan(prev);
        expect(t - prev).toBeLessThan(0.26 * (1 - REPLY_FREE.from));
        prev = t;
      }
      expect(prev).toBe(1);
    }
  });

  it('never lets a reply shade itself as it tilts in flight, in beat 3 or flying home in the turn', () => {
    const lowestTop = (s: { p: readonly number[]; rot: number; tilt: number }) =>
      s.p[2] + B_SLIP.t * Math.cos(s.tilt) - ((B_SLIP.l / 2) * Math.abs(Math.sin(s.rot)) + (B_SLIP.w / 2) * Math.abs(Math.cos(s.rot))) * Math.abs(Math.sin(s.tilt));
    let tilted = 0;
    for (const f of span(FIX_B.replies[0], 1660)) {
      const slips = f < 1400 ? fixBOf(f).b.slips : turnAt(f).fixB.slips;
      for (const s of slips) {
        const fp = replySlipFootprint(s);
        expect(fp.z1, `f${f}`).toBeLessThanOrEqual(lowestTop(s) + 1e-9);
        expect(fp.z1).toBeGreaterThan(fp.z0);
        if (Math.abs(s.tilt) > 0.05) tilted++;
      }
    }
    expect(tilted).toBeGreaterThan(50);
  });

  it('keeps every reply under act one’s pool ceiling while it is low (a tilted slip crossing it would split along a hard line)', () => {
    const highestTop = (s: { p: readonly number[]; rot: number; tilt: number }) =>
      s.p[2] + B_SLIP.t * Math.cos(s.tilt) + ((B_SLIP.l / 2) * Math.abs(Math.sin(s.rot)) + (B_SLIP.w / 2) * Math.abs(Math.cos(s.rot))) * Math.abs(Math.sin(s.tilt));
    let flying = 0;
    for (const f of span(FIX_B.replies[0], POOL_A_Z.from - 1))
      fixBOf(f).b.slips.forEach((s, k) => {
        if (f < replyPostedB(k) || f >= replyLandsB(k)) return;
        flying++;
        expect(highestTop(s), `reply ${k} f${f}`).toBeLessThan(POOL_A_Z.low - 3);
      });
    expect(flying).toBeGreaterThan(40);
  });
});

describe('the request in 3.1, and Fix A as one session holding everything', () => {
  it('puts one request on screen: its copy on the tape is vermilion while Fix A holds the focus, the heap’s drained meanwhile', () => {
    const q = A_QUEUE[A_REQUEST];
    // the copy is inside the spout on the pour's first frame (beat3.ts pourPose: from the mouth's inside): it takes the
    // vermilion from the next, its first in sight, while the heap's drains over the same frames
    expect(q.pour!.lands - q.pour!.arc - 3 + 1).toBe(REQUEST_ON_TAPE.from);
    expect(fixAOf(REQUEST_ON_TAPE.from).requestInk).toBe(0);
    expect(fixAOf(REQUEST_ON_TAPE.from + 1).requestInk).toBeGreaterThan(0);
    // the heap's request changes sets only once both its ramps are fully down (nothing jumps)
    expect(actOneStep(REQUEST_STEPPED_FROM).own?.amount).toBe(1);
    expect(actOneStep(REQUEST_STEPPED_FROM).amount).toBe(1);
    expect(REQUEST_STEPPED_FROM).toBeLessThan(BOTH_FIXES);
    for (let f = REQUEST_ON_TAPE.from; f < 1400; f++) {
      const copy = fixAOf(f).requestInk!;
      const heap = actOneAt(f).request.ink;
      expect(copy + heap, `f${f}`).toBeCloseTo(1, 1);
      expect(Math.abs(copy - fixAOf(f - 1).requestInk!)).toBeLessThan(0.5);
    }
    for (const f of span(1000, 1125)) expect(fixAOf(f).requestInk).toBeGreaterThan(0.95);
    expect(fixAOf(1399).requestInk).toBe(0);
    expect(actOneAt(1399).request.ink).toBeCloseTo(1, 6);
  });

  it('keeps the heap’s request its colour until its copy is in sight, steps it only on the hand-over’s spring, and never greys it (the worked example)', () => {
    // nothing of it changes before the copy's first frame in sight, while the rest of act one steps down
    for (let f = 900; f <= REQUEST_ON_TAPE.from; f++) {
      expect(Math.abs(requestStepOf(actOneAt(f))), `f${f}`).toBeLessThan(1e-9);
      expect(actOneAt(f).request.ink, `f${f}`).toBeCloseTo(1, 6);
    }
    expect(actOneStep(REQUEST_ON_TAPE.from).own!.amount).toBeGreaterThan(0.5);
    // then by amount, frame to frame, as its ink goes (and comes back with the hand-back), and continuous into the turn
    for (let f = REQUEST_ON_TAPE.from + 1; f < 1400; f++) expect(Math.abs(requestStepOf(actOneAt(f)) - requestStepOf(actOneAt(f - 1))), `f${f}`).toBeLessThan(0.45);
    expect(requestStepOf(actOneAt(1399))).toBeCloseTo(requestStepOf(turnAt(1400).act, turnAt(1400).step), 6);
  });

  it('is the fattest folder on the desk (200 px and more across), its stack thickening with every swallow', () => {
    expect(FIX_A_FOLDER.w * 1.2).toBeGreaterThanOrEqual(200);
    for (const fl of FOLDERS) expect(A_FOLDER_TOP).toBeGreaterThan(stackTop(fl));
    let prev = aStackTopAt(FIX_A.in);
    expect(prev).toBeCloseTo(A_FOLDER_TOP, 9);
    for (const f of span(FIX_A.in, 1399)) {
      const t = aStackTopAt(f);
      expect(t - prev, `f${f}`).toBeLessThan(2);
      prev = t;
    }
    expect(aStackTopAt(1399)).toBeCloseTo(A_STACK_END, 6);
    expect(A_STACK_END - A_FOLDER_TOP).toBeGreaterThanOrEqual(15);
    // the pile rides the stack: its lowest piece just on the top sheet on every frame
    for (const f of [990, 1100, 1250, 1399]) {
      const A = fixAOf(f);
      expect(Math.min(...A.pile!.map((p) => p.p[2]))).toBeCloseTo(A.stackTop! + 0.5, 6);
    }
  });
});

describe('act one’s shadows fit the shaders, and act one is a pure function of the frame', () => {
  it('casts at most MAX_FOOTPRINTS footprints on every frame of act one', () => {
    let most = 0;
    for (let f = 0; f < 1400; f++) {
      const n = actOneFrameFootprints(f).length;
      most = Math.max(most, n);
      expect(n, `f${f}`).toBeLessThanOrEqual(MAX_FOOTPRINTS);
    }
    expect(most).toBeGreaterThan(60);
  });
  it('gives the same state at a frame whatever was computed before it (frames visited in two different orders)', () => {
    const frames = [0, 150, 700, 905, 990, 1100, 1210, 1250, 1394, 1399];
    const forward = frames.map((f) => json([actOneAt(f), fixAOf(f), fixBOf(f)]));
    const backward = [...frames].reverse().map((f) => json([actOneAt(f), fixAOf(f), fixBOf(f)]));
    expect(backward.reverse()).toEqual(forward);
  });
});
