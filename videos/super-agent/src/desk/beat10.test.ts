import { describe, expect, it } from 'vitest';
// actOne.ts first: it is the module the film's frame code reaches the beat modules through (its tables read state.ts's)
import { youPoseAt } from './actOne.ts';
import { BEAT_10 } from '../cues.ts';
import { ALL_BUT_CARDS, ARM_10, CAP_LANDS, CARDS_10, FOCUS_10, HIJACK_GONE, PINS_10, POLE_B, REACH, REPLY_0405, SPOT_10, beat10At, capAt, capLanded, etchAt, hijackAt, pins10, pose0405, ride0405, you10 } from './beat10.ts';
import { FOCUS_9 } from './beat9.ts';
import { REPLY_REST } from './beat7.ts';
import { CARD_SPOT, cardAt, cardPose } from './beat4.ts';
import { FRAMING_B, deskCamera, project } from './camera.ts';
import { cardFootprint } from './footprints.ts';
import { KEY_DOCK, YOU, rectC, type P3 } from './layout.ts';
import { YOU_POSE_B, lampElbow } from './you.ts';
import { SEAM } from './proposed.ts';
import { DETENT, STEP_FRAMES, deskStateAt } from './state.ts';
import { PROPOSED_STEP_ID, WATCHDOG_STEP_ID } from './objects/Beat9.tsx';
import { summaryDeskState } from './summary.ts';

describe('beat 10: still open, and bar 68', () => {
  it('slips the hatched slip in from the spout to the Register on its cue, clear of the docked key (no tick)', () => {
    expect(hijackAt(BEAT_10.hatch.spout - 1)).toBeNull();
    let nearest = Infinity;
    for (let f = BEAT_10.hatch.spout; f < BEAT_10.hatch.register; f++) {
      const h = hijackAt(f)!;
      nearest = Math.min(nearest, Math.hypot(h.p[0] - KEY_DOCK[0], h.p[1] - KEY_DOCK[1]));
    }
    expect(nearest).toBeGreaterThan(60);
    // its nose is out of the chat drum's wall (x -893 on its axis) on the cue frame, and not before
    expect(hijackAt(BEAT_10.hatch.spout)!.p[0] + 48).toBeGreaterThan(-893 + 3);
    // it turns smoothly: never a flick of its heading or slope (the belt's corner into the throat is not its heading)
    for (let f = BEAT_10.hatch.spout + 1; f < HIJACK_GONE; f++) {
      const a = hijackAt(f - 1)!;
      const b = hijackAt(f)!;
      expect(Math.abs(b.heading - a.heading), `f${f}`).toBeLessThan(0.3);
      expect(Math.abs(b.slope - a.slope), `f${f}`).toBeLessThan(0.3);
    }
    // it lies in the throat from the intrusion for most of a beat, then is fed into the head
    expect(hijackAt(BEAT_10.hatch.register)!.p).toEqual(hijackAt(BEAT_10.hatch.register + 15)!.p);
    expect(hijackAt(HIJACK_GONE)).toBeNull();
  });

  it('spreads the etch to one machine per beat and has it gone (nothing of it left) before bar 65’s dolly', () => {
    for (const [i, f] of BEAT_10.etch.entries()) {
      const e = etchAt(f)!;
      expect(e.tethers[i]![1]).toBe(1);
      if (i < 2) expect(etchAt(f)!.tethers[i + 1]![1]).toBeLessThan(1);
    }
    expect(etchAt(at65())).toBeNull();
  });

  it('rises Fix A’s and Fix B’s cards for one beat and slides them away from their exit (never struck), from and to just beyond the top edge, each move seen whole', () => {
    expect(cardAt(BEAT_10.cards.rise - 1, CARDS_10)).toBeNull();
    expect(Math.abs(cardAt(BEAT_10.cards.exit - 1, CARDS_10)!.exit)).toBe(0);
    expect(cardAt(BEAT_10.cards.exit, CARDS_10)!.exit).toBeGreaterThan(0);
    const lastF = BEAT_10.cards.exit + 6;
    expect(cardAt(lastF + 1, CARDS_10)).toBeNull();
    const pose = deskCamera(FRAMING_B, 15);
    // its lowest edge on screen (beat4.test's)
    const low = (c: { c: P3; tilt: number }) => project(pose, [c.c[0], c.c[1] - (CARD_SPOT.h / 2) * Math.cos(c.tilt), c.c[2] - (CARD_SPOT.h / 2) * Math.sin(c.tilt)])[1];
    for (const k of ['fixA', 'fixB'] as const) {
      const first = cardAt(BEAT_10.cards.rise, CARDS_10)!;
      // off the frame in a zero-in pose and on its last drawn frame, just over the top edge; in the frame on its cue
      expect(low(cardPose({ ...first, rise: 0 }, SPOT_10[k]))).toBeLessThan(0);
      expect(low(cardPose({ ...first, rise: 0 }, SPOT_10[k]))).toBeGreaterThan(-24);
      expect(low(cardPose(cardAt(lastF, CARDS_10)!, SPOT_10[k]))).toBeLessThan(0);
      expect(low(cardPose(first, SPOT_10[k]))).toBeGreaterThan(0);
      // in view on every frame of its exit but the last (it slides off, never jumps)
      for (let f = BEAT_10.cards.exit; f < lastF; f++) expect(low(cardPose(cardAt(f, CARDS_10)!, SPOT_10[k])), `${k} f${f}`).toBeGreaterThan(0);
      // and its shadow is never on the desk while it is beyond the top edge (beat4.test's south reach of the footprint)
      for (let f = BEAT_10.cards.rise; f <= lastF; f++) {
        const st = cardAt(f, CARDS_10)!;
        if (low(cardPose(st, SPOT_10[k])) >= 0) continue;
        const fp = cardFootprint(st, SPOT_10[k])!;
        if (fp.kind !== 'rect') throw new Error('a card casts a rect');
        for (const zr of [0, 122]) {
          const h = fp.z1 - zr;
          expect(project(pose, [fp.c[0] + fp.h[0] + 0.78 * 0.84 * h, fp.c[1] - fp.h[1] - 0.64 * 0.84 * h - (4 + 0.22 * h) / 2, zr])[1], `${k} f${f} z${zr}`).toBeLessThan(0);
        }
      }
    }
  });

  it('never pumps the step: 14 f or more between beat 9’s hold, the cards and the rest', () => {
    const watch = FOCUS_9.at(-1)!;
    expect(watch.id).toBe('b9-etch');
    const fix = FOCUS_10.find((x) => x.id === 'b10-fix')!;
    const rest = FOCUS_10.find((x) => x.id === 'b10-rest')!;
    expect(fix.from).toBeGreaterThanOrEqual(watch.to + STEP_FRAMES);
    expect(rest.from).toBeGreaterThanOrEqual(fix.to + STEP_FRAMES);
    for (const e of FOCUS_9) expect(e.step).not.toContain('you');
  });

  it('names the objects’ step ids as objects/Beat9.tsx mounts them: the cards step the proposed parts and the Watchdog; N8 steps the vellum but the Watchdog', () => {
    expect(ALL_BUT_CARDS).toContain(PROPOSED_STEP_ID);
    expect(ALL_BUT_CARDS).toContain(WATCHDOG_STEP_ID);
    const n8 = FOCUS_9.find((x) => x.id === 'b9-n8')!;
    expect(n8.step).toContain(PROPOSED_STEP_ID);
    expect(n8.step).not.toContain(WATCHDOG_STEP_ID);
    expect(n8.step).not.toContain('freshBay');
    // the vellum is back up before 10.1's hatched slip comes in
    expect(n8.to + STEP_FRAMES).toBeLessThanOrEqual(BEAT_10.hatch.spout);
  });

  it('reaches your lamp for the running bay and brings it home before bar 68, leaving the summary’s pose alone', () => {
    const at = (f: number) => youPoseAt(f).lamp.head;
    expect(at(BEAT_10.reach + 20)[0]).toBeGreaterThan(at(BEAT_10.reach)[0] + 40);
    expect(at(BEAT_10.pinsDrop + 30)).toEqual(at(BEAT_10.reach - 1));
    const p = youPoseAt(SEAM);
    expect(you10(SEAM, p)).toBe(p);
    // its first move on the cue
    expect(youPoseAt(BEAT_10.reach).lamp.head).not.toEqual(youPoseAt(BEAT_10.reach - 1).lamp.head);
  });

  it('bends your lamp’s elbow continuously through the reach (never a jump or a one-frame swap), the pose’s own before and after', () => {
    const L = YOU_POSE_B.lamp;
    const e = lampElbow(L.base, L.head, POLE_B);
    for (let i = 0; i < 3; i++) expect(e[i]).toBeCloseTo(L.elbow[i]!, 9);
    expect(REACH.from).toBe(BEAT_10.reach - 1);
    const d = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
    // its per-frame move: never a lone spike (a swap and back), and never much more than the head's fastest
    const step = (f: number) => d(youPoseAt(f - 1).lamp.elbow, youPoseAt(f).lamp.elbow);
    let head = 0;
    let elbow = 0;
    for (let f = BEAT_10.reach - 1; f < SEAM; f++) {
      head = Math.max(head, d(youPoseAt(f - 1).lamp.head, youPoseAt(f).lamp.head));
      elbow = Math.max(elbow, step(f));
      expect(step(f), `f${f}`).toBeLessThanOrEqual(2 * Math.max(step(f - 1), step(f + 1)) + 0.5);
    }
    expect(elbow).toBeLessThan(1.5 * head);
    expect(youPoseAt(SEAM - 1).lamp).toEqual(youPoseAt(BEAT_10.reach - 1).lamp);
  });

  it('turns the index on its cues (the arm leaves on the cue frame)', () => {
    for (const f of [BEAT_10.pinsDrop, BEAT_10.indexWest]) expect(deskStateAt(f).arm).not.toBe(deskStateAt(f - 1).arm);
  });

  it('drops the request’s pins, then passes all six by the seam', () => {
    const cycling = [0, 0, 1, 1, 0, 1];
    expect(pins10(BEAT_10.pinsDrop - 1, cycling)).toBe(cycling);
    expect(pins10(PINS_10.rise, cycling).every((x) => x === 0)).toBe(true);
    expect(pins10(SEAM - 1, cycling)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('caps the bay as still (d)’s cap and puts its light out as it lands', () => {
    expect(capAt(BEAT_10.reportUp)).toBeNull();
    expect(capLanded(capAt(CAP_LANDS)!)).toBe(true);
    expect(capLanded(capAt(CAP_LANDS - 1)!)).toBe(false);
    expect(deskStateAt(CAP_LANDS - 2).bugLight).toBe(1);
    expect(deskStateAt(CAP_LANDS + 10).bugLight).toBeLessThan(0.01);
  });

  it('lands the reply #0405 on its cue exactly where still (d) lays it, then nothing moves into the seam', () => {
    expect(REPLY_0405.rest).toEqual([rectC(YOU.inTray)[0], YOU.inTray.y1 - 44, YOU.top + 7.6]);
    expect(REPLY_0405.size).toEqual([104, 72]);
    // on top of 7.4's chat reply's "≤ 100" stop tab (objects/Replies.tsx: its face 2.45 over the slip's rest), so your stamp's
    // check prints on #0405's own paper, a hair over the tab's face
    expect(REPLY_0405.rest[2]).toBeGreaterThanOrEqual(REPLY_REST[2] + 2.45 + 0.15);
    // and the tab's glyphs (cap height about 0.7 of its 30 u em about its centre line) lie wholly south of #0405's south edge
    const [cx, cy] = REPLY_0405.rest;
    const southAt = (x: number) => cy - (REPLY_0405.size[1] / 2) * Math.cos(REPLY_0405.turn) + (x - cx) * Math.tan(REPLY_0405.turn);
    const glyphTop = REPLY_REST[1] + 0.35 * 30;
    for (const x of [-540, -520, -500, -480]) expect(glyphTop, `x ${x}`).toBeLessThan(southAt(x));
    const r = ride0405(BEAT_10.replyLands)!;
    expect(r.arc).toBe(1);
    const p = pose0405(r);
    expect(p.p).toEqual(REPLY_0405.rest);
    expect(p.curl).toBe(0);
    expect(ride0405(BEAT_10.replyLeave - 1)).toBeNull();
    for (let f = BEAT_10.replyLands; f < SEAM; f++) {
      const e = beat10At(f)!;
      expect(e.hijack).toBeNull();
      expect(e.window).toBeNull();
      expect(e.report).toBeNull();
      expect(capLanded(e.cap!)).toBe(true);
    }
  });

  it('meets the summary at the seam: the arm at your detent, every pin passed, the bays’ lights out, the summary’s step, your lamp', () => {
    const a = deskStateAt(SEAM - 1);
    const s = summaryDeskState(SEAM);
    expect(Math.abs(a.arm - DETENT.you)).toBeLessThan(1e-9);
    expect(ARM_10[ARM_10.length - 1]!.to).toBe('you');
    expect(a.pins).toEqual(s.pins);
    expect(a.bugLight).toBe(0);
    expect(a.next.light).toBe(0);
    expect(a.step).toEqual(s.step);
    expect(a.lamp).toBe(s.lamp);
    expect(a.replies.find((r) => r.id === '0405')!.ride.arc).toBe(1);
    // the stillness: nothing of act two's state that beat 10 drives moves from the reply's landing into the seam
    const still = deskStateAt(BEAT_10.replyLands);
    expect(Math.abs(still.arm - a.arm)).toBeLessThan(1e-9);
    expect([still.bugLight, still.next.light, ...still.pins]).toEqual([a.bugLight, a.next.light, ...a.pins]);
    expect(still.step).toEqual(a.step);
  });
});

/** Bar 65's downbeat (camera.ts TO_REGISTER). */
const at65 = (): number => 5120;
