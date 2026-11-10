import { describe, expect, it } from 'vitest';
import { BOTH_FIXES, FIX_A, FIX_B } from '../cues.ts';
import { actOneFrameFootprints, fixAOf, fixBOf } from './ActOneFrame.tsx';
import { FIX_LAMP, LOOP_A, MOUTH, actOneAt, actOneStep, actOneStepA, loopPoint } from './actOne.ts';
import {
  A_CHUTES,
  A_FOLDER_IN,
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
  B_RISE,
  EVENT_SIZE,
  FIX_A_FOLDER,
  FOLLOW_UP,
  REPLY_7,
  STUB,
  TEAR,
  TRAYS,
  TRAY_STUFF,
  aBackAt,
  aPathAt,
  replyPostedB,
} from './beat3.ts';
import { cameraAt, project } from './camera.ts';
import { MAX_FOOTPRINTS } from './footprints.ts';
import { TURN, fixATurnAt, fixBTurnAt, loopTurnAt, shiftAt } from './turn.ts';

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

  it('holds Fix B still once the last of replies 0–6 has landed and jostled, until reply 7 posts (the cue sheet’s f1394)', () => {
    const settled = FIX_B.replies[6] + 3 + 14 + 8;
    for (const f of span(settled, REPLY_7.post)) expect(json(fixBOf(f)), `f${f}`).toBe(json(fixBOf(settled)));
    expect(REPLY_7.post).toBe(TURN.bPost);
  });

  it('posts reply 7 without a dip: it lifts over its anticipation and the arc starts from there', () => {
    const z = span(REPLY_7.post, REPLY_7.post + 6).map((f) => fixBOf(f).b.slips[7].p[2]);
    for (let i = 1; i < z.length; i++) expect(z[i], `f${REPLY_7.post + i}`).toBeGreaterThanOrEqual(z[i - 1]);
  });

  it('brings both fixes, your desk, the folders and the loop back to full contrast in 3.3; the intake stays down into the turn', () => {
    for (const f of span(BOTH_FIXES + 14, 1399)) {
      expect(actOneStep(f).own?.amount).toBe(0);
      expect(actOneStepA(f)).toBe(0);
      // the turn's own pull (turn.ts stepIn, f1436) holds the feeders, the heap and the request down: beat 3 hands them over down
      expect(actOneStep(f).amount).toBe(1);
      expect(actOneStep(f).ids).toEqual(['intake']);
    }
  });

  // The turn (turn.ts, TurnFrame) is rebuilt next to start from beat 3's f1399 state. Until it does, these seams are open:
  // `it.fails` passes while they are, and fails (asking for `it`) once the turn has taken beat 3 over.
  it.fails('turn.ts fixATurnAt(1400) starts from beat 3’s f1399 Fix A (its queue where beat 3 leaves it)', () => {
    const turn = fixATurnAt(1400, loopTurnAt(1400));
    const a = fixAOf(1399).items.filter((x) => x !== null);
    expect(turn.items.filter((x) => x !== null).map((x) => x!.p.map((v) => Math.round(v)))).toEqual(a.map((x) => x!.p.map((v) => Math.round(v))));
  });
  it.fails('turn.ts fixBTurnAt(1400) continues beat 3’s Fix B (reply 7 in flight, the replies in your in-tray)', () => {
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

  it('slides in from the east edge on its cue and fires replies 0–6 on the cue sheet’s frames (anticipation first)', () => {
    expect(B_RISE.from).toBe(FIX_B.in);
    for (const tr of TRAYS) expect(scr(FIX_B.in, [tr.c[0] - tr.w / 2 + fixBOf(FIX_B.in).rise, tr.c[1], 7])[0]).toBeGreaterThan(1930);
    expect(fixBOf(B_RISE.from + B_RISE.frames).rise).toBe(0);
    expect(B_RISE.from + B_RISE.frames).toBeLessThan(FIX_B.replies[0]);
    FIX_B.replies.forEach((leave, k) => {
      expect(replyPostedB(k)).toBe(leave);
      expect(json(fixBOf(leave - 1).b.slips[k])).toBe(json(fixBOf(leave).b.slips[k]));
      expect(fixBOf(leave + 8).b.slips[k].p[2]).toBeGreaterThan(fixBOf(leave).b.slips[k].p[2] + 20);
    });
  });

  it('lands the follow-up in tray 6 on its cue; tray 2’s stub (at least 24 px) tears off on the break mark and stays in tray 2', () => {
    expect(FOLLOW_UP.lands).toBe(FIX_B.followUp);
    expect(TEAR.at).toBe(FIX_B.breakMark);
    expect(TEAR.at).toBeGreaterThan(FOLLOW_UP.lands);
    const fu = fixBOf(FIX_B.followUp).followUp!;
    const t6 = TRAYS[BREAK.to];
    expect(Math.abs(fu.p[0] - t6.c[0])).toBeLessThan(t6.w / 2 - FOLLOW_UP.w / 2);
    expect(Math.abs(fu.p[1] - t6.c[1])).toBeLessThan(t6.d / 2 - FOLLOW_UP.d / 2 + 2);
    expect(fixBOf(FIX_B.followUp - 30).followUp).toBeNull();
    expect(Math.min(STUB.w, STUB.d) * 1.2).toBeGreaterThanOrEqual(24);
    expect(fixBOf(TEAR.at).tear).toBe(0);
    expect(fixBOf(TEAR.at + 10).tear).toBeGreaterThan(0.9);
    for (const f of span(TEAR.at, TEAR.at + 12)) expect(Math.abs(fixBOf(f + 1).tear - fixBOf(f).tear)).toBeLessThan(0.45);
    // the stub stays inside tray 2 once torn
    const t2 = TRAYS[BREAK.from];
    const ev = TRAY_STUFF[BREAK.from].event;
    const x = ev.o[0] + EVENT_SIZE[ev.kind][0] / 2 + STUB.w / 2 + TEAR.slide[0];
    expect(Math.abs(x) + STUB.w / 2).toBeLessThan(t2.w / 2);
  });

  it('has every reply in your in-tray before 3.3 ends, reply 7 posting on the turn’s frame', () => {
    for (let k = 0; k < 7; k++) expect(fixBOf(1300).b.slips[k].p[2]).toBeGreaterThan(28);
    expect(fixBOf(REPLY_7.post - 1).b.slips[7].p[2]).toBeLessThan(4);
  });
});

describe('act one’s shadows fit the shaders, and act one is a pure function of the frame', () => {
  it('casts at most MAX_FOOTPRINTS footprints on every frame of act one', () => {
    let most = 0;
    for (let f = 0; f < 1400; f++) {
      const n = actOneFrameFootprints(f, cameraAt(f, 15)).length;
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
