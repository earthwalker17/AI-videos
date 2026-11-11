import { describe, expect, it } from 'vitest';
import { BEAT_5, cue } from '../cues.ts';
import { E5, KEEP_LAND, KEY_REST, KEY_SEAT, RACK, SLIPS_5, beat5At, fingersAt, hatchHoleAt, keyAt, loupeAt5, pileAt, plateAt, punchAt5, slipsAt, spikeAt, type FilterSlip } from './beat5.ts';
import { deskHoles } from './objects/Dispatch.tsx';
import { MAX_FOOTPRINTS, footprintsAt } from './footprints.ts';
import { GATE, KEY_DOCK, NEXT_SLIP, PROACTIVE_PLATE, PUNCH, SPIKE, YOU } from './layout.ts';
import { FOCUS_BEATS, LAMP_DIMS, SLIP_BELT, STEP_FRAMES, deskStateAt, stepAt } from './state.ts';
import { DOCKED, SPAN_D, summaryDeskState } from './summary.ts';
import { ACT2_TAGS } from './film.ts';

const dist = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const slipOf = (f: number, i: number): FilterSlip | undefined => slipsAt(f).find((x) => x.i === i);

describe('beat 5: the cue sheet holds', () => {
  it('hangs off the cue sheet: the lift on trait-proactive, the docks on key-dock and plate-proactive, the spike on spike-in', () => {
    expect(E5.lift).toBe(cue('trait-proactive').frame);
    expect(E5.keyDock).toBe(cue('key-dock').frame);
    expect(E5.plateDock).toBe(cue('plate-proactive').frame);
    expect(E5.spikeIn).toBe(cue('spike-in').frame);
    // the receiver answers 2 f after the dock, and your lamp dims with it
    expect(E5.answer).toBe(BEAT_5.keyDock + 2);
    expect(LAMP_DIMS).toBe(E5.answer);
    // the summary draws the end state itself from its first frame
    expect(E5.until).toBe(SPAN_D[0]);
    expect(KEY_DOCK).toEqual(DOCKED.key);
    // a kept slip lands on MT1's belt line, wholly past the gate's bar (its tail clear of the bar's east face)
    const [a, b] = [SLIP_BELT[0]!, SLIP_BELT[1]!];
    const c = (KEEP_LAND[0] - a[0]) / (b[0] - a[0]);
    expect((KEEP_LAND[1] - a[1]) / (b[1] - a[1])).toBeCloseTo(c, 9);
    expect(KEEP_LAND[0] - (NEXT_SLIP.l / 2) * Math.cos(Math.atan2(KEEP_LAND[1] - NEXT_SLIP.spout[1], KEEP_LAND[0] - NEXT_SLIP.spout[0]))).toBeGreaterThan(GATE.bar.x1);
  });

  it('the key: in your tray until trait-proactive, 4 f of anticipation, airborne until key-dock, docked on it (a contact frame)', () => {
    expect(keyAt(E5.lift - 1)).toBeNull();
    const k0 = keyAt(E5.lift)!;
    expect(k0.p).toEqual(KEY_REST);
    expect(k0.lift).toBe(0);
    // the anticipation draws back south, away from the dock
    expect(keyAt(E5.lift + E5.anticipate - 1)!.p[1]).toBeLessThan(KEY_REST[1]);
    for (let f = E5.lift + E5.anticipate; f < E5.keyDock; f++) expect(keyAt(f)!.lift).toBeGreaterThan(1);
    // the rise: 10 f of it climb (the arc), then the drop into the dock
    const rise = Array.from({ length: 6 }, (_, i) => keyAt(E5.lift + E5.anticipate + i)!.p[2]);
    for (let i = 1; i < rise.length; i++) expect(rise[i]!).toBeGreaterThan(rise[i - 1]!);
    expect(keyAt(E5.keyDock - 1)!.p[2]).toBeLessThan(keyAt(E5.keyDock - 3)!.p[2]);
    const d = keyAt(E5.keyDock)!;
    expect(d.p).toEqual(KEY_SEAT);
    expect(d.lift).toBe(0);
    expect(d.squash).toBeCloseTo(0.03, 6);
    expect(keyAt(E5.keyDock + 4)!.squash).toBe(0);
  });

  it('sets the gate tag inside title-safe (54 px), its leader down to the gate bar', () => {
    const t = ACT2_TAGS.find((x) => x.cue === 'tag-gate')!;
    // its EN line's ascenders stand 30 px over its baseline (measured on the renders)
    expect(t.at[1] - 30).toBeGreaterThanOrEqual(54);
    expect(t.anchor === 'start' ? t.at[0] : 1920 - t.at[0]).toBeGreaterThanOrEqual(54);
    expect(t.foot[0]).toBeGreaterThanOrEqual(GATE.bar.x0);
    expect(t.foot[0]).toBeLessThanOrEqual(GATE.bar.x1);
  });

  it('the Proactive plate leaves your desk once the key is in the air, wholly under its slab until it moves, and docks on plate-proactive', () => {
    expect(plateAt(E5.plateOut - 1)).toBeNull();
    expect(E5.plateOut).toBeGreaterThan(E5.lift + E5.anticipate);
    const B = PROACTIVE_PLATE.box;
    const start = plateAt(E5.plateOut)!.dy;
    expect(B.y1 + start).toBeLessThan(YOU.slab.y1);
    expect(B.y0 + start).toBeGreaterThan(YOU.slab.y0);
    expect(B.x0).toBeGreaterThan(YOU.slab.x0);
    expect(B.x1).toBeLessThan(YOU.slab.x1);
    expect(plateAt(E5.plateDock - 1)!.dy).toBeLessThan(0);
    expect(plateAt(E5.plateDock)!.dy).toBe(0);
    expect(plateAt(E5.plateDock + 40)!.dy).toBe(0);
  });

  it('the spike stands up on spike-in, nothing of it above the slate before its leaves part', () => {
    expect(spikeAt(E5.spikeOpen - 1)).toBeNull();
    for (let f = E5.spikeOpen; f < E5.spikeRise; f++) expect(SPIKE.h + spikeAt(f)!.dz).toBeLessThan(0);
    expect(spikeAt(E5.spikeIn - 1)!.dz).toBeLessThan(0);
    expect(spikeAt(E5.spikeIn)!.dz).toBe(0);
    // it stands before the first slip is flipped onto it
    expect(E5.spikeIn).toBeLessThan(BEAT_5.slips[0]!.f + BEAT_5.flip);
  });

  it('every slip reaches the gate on its frame: a dropped one lands across the fingers, a kept one on the belt past them', () => {
    for (const s of SLIPS_5) {
      expect(slipOf(s.f - E5.out - 1, s.i)).toBeUndefined();
      const at = slipOf(s.f, s.i)!;
      expect(dist(at.p, s.keep ? KEEP_LAND : RACK)).toBeLessThan(1e-9);
      expect(at.flying).toBe(false);
      expect(slipOf(s.f - 1, s.i)!.flying).toBe(true);
    }
  });

  it('a dropped slip: the fingers flip it (4 f), it lands impaled on the pile on f + impale, and the pile counts it the frame after', () => {
    for (const s of SLIPS_5.filter((x) => !x.keep)) {
      // the fingers move first: up from its landing, at their height on f + flip
      const a = (f: number) => Math.max(...fingersAt(f));
      expect(a(s.f)).toBe(0);
      expect(a(s.f + 1)).toBeGreaterThan(0);
      expect(a(s.f + BEAT_5.flip)).toBeGreaterThan(0.8);
      expect(slipOf(s.f + BEAT_5.impale - 1, s.i)!.onPile).toBe(false);
      const on = slipOf(s.f + BEAT_5.impale, s.i)!;
      expect(on.onPile).toBe(true);
      expect(on.p[0]).toBe(SPIKE.x);
      expect(on.p[1]).toBe(SPIKE.y);
      expect(pileAt(s.f + BEAT_5.impale)).toBe(s.k);
      expect(pileAt(s.f + BEAT_5.impale + 1)).toBe(s.k + 1);
      // on the pile for the rest of the act
      expect(slipOf(3439, s.i)!.onPile).toBe(true);
    }
    expect(pileAt(2719)).toBe(SLIPS_5.filter((x) => !x.keep).length);
  });

  it('a kept slip: the loupe swings out once it is in the throat, the punch notches it on f + notchAfter, then it feeds into the head', () => {
    for (const s of SLIPS_5.filter((x) => x.keep)) {
      const n = s.f + BEAT_5.notchAfter;
      expect(slipOf(s.f + 7, s.i)!.p).toEqual(NEXT_SLIP.throat);
      expect(loupeAt5(s.f + 7)).toBe(0);
      expect(loupeAt5(s.f + 9)).toBeGreaterThan(0);
      expect(slipOf(n - 1, s.i)!.notched).toBe(false);
      expect(slipOf(n, s.i)!.notched).toBe(true);
      // the punch is down on the slip's edge on its notch frame (its lowest), out of the cheek before it, hidden well after
      expect(punchAt5(n)).toBeCloseTo(PUNCH.hidden + PUNCH.out - PUNCH.drop, 6);
      expect(punchAt5(n - 1)!).toBeGreaterThan(punchAt5(n)!);
      expect(punchAt5(n + 8)).toBeNull();
      // fed into the head and gone under it
      expect(slipOf(n + 5, s.i)).toBeDefined();
      expect(slipOf(n + 6, s.i)).toBeUndefined();
    }
  });
});

describe('beat 5: nothing jumps, nothing vanishes', () => {
  it('walks every moving part frame by frame without a one-frame jump', () => {
    let prev = beat5At(2320);
    for (let f = 2321; f < 2760; f++) {
      const b = beat5At(f);
      if (prev.key && b.key) {
        expect(dist(b.key.p, prev.key.p), `key at ${f}`).toBeLessThan(110);
        expect(Math.abs(b.key.tilt - prev.key.tilt), `key tilt at ${f}`).toBeLessThan(0.25);
      }
      if (prev.key) expect(b.key, `key vanished at ${f}`).not.toBeNull();
      if (prev.plate && b.plate) expect(Math.abs(b.plate.dy - prev.plate.dy), `plate at ${f}`).toBeLessThan(25);
      if (prev.spike && b.spike) expect(Math.abs(b.spike.dz - prev.spike.dz), `spike at ${f}`).toBeLessThan(31);
      b.fingers.forEach((a, i) => expect(Math.abs(a - prev.fingers[i]!), `finger ${i} at ${f}`).toBeLessThan(0.45));
      expect(Math.abs(b.loupe - prev.loupe), `loupe at ${f}`).toBeLessThan(0.4);
      for (const x of prev.slips) {
        const y = b.slips.find((z) => z.i === x.i);
        const s = SLIPS_5[x.i]!;
        // a kept slip leaves the picture only under the print head
        if (!y) {
          expect(s.keep, `slip ${x.i} vanished at ${f}`).toBe(true);
          expect(dist(x.p, NEXT_SLIP.head)).toBeLessThan(1e-6);
          continue;
        }
        // (the post leaves the spout fast, about 70 u in its first frame, then slower down onto the gate)
        expect(dist(y.p, x.p), `slip ${x.i} at ${f}`).toBeLessThan(80);
        expect(Math.abs(y.heading - x.heading), `slip ${x.i} heading at ${f}`).toBeLessThan(0.75);
        expect(Math.abs(y.roll - x.roll), `slip ${x.i} roll at ${f}`).toBeLessThan(0.45);
      }
      prev = b;
    }
  });

  it('a dropped slip never passes through the spike: near its rod it is above the tip or threaded on it', () => {
    for (let f = 2460; f < 2720; f += 0.25) {
      for (const x of slipsAt(f)) {
        if (x.keep) continue;
        const r = Math.hypot(x.p[0] - SPIKE.x, x.p[1] - SPIKE.y);
        if (r < NEXT_SLIP.l / 2 + 3) expect(x.p[2] > SPIKE.h + 2 || r < 1e-6, `slip ${x.i} at ${f}: r ${r.toFixed(1)}, z ${x.p[2].toFixed(1)}`).toBe(true);
      }
    }
  });

  it('the hatches take the desk’s third hole slot only while the docs bay’s is shut', () => {
    for (let f = 2320; f < 2760; f++) if (hatchHoleAt(f)) expect(deskHoles(deskStateAt(f))[2]!.x).toBeGreaterThan(1e5);
  });

  it('keeps the shader’s footprint budget through act two and the summary', () => {
    let max = 0;
    for (let f = 2320; f < 3440; f++) max = Math.max(max, footprintsAt(deskStateAt(f)).length);
    expect(max).toBeLessThanOrEqual(MAX_FOOTPRINTS - 8);
    expect(footprintsAt(summaryDeskState(5535)).length).toBeLessThanOrEqual(MAX_FOOTPRINTS);
  });

  it('hands the key’s tray footprint over to the moving key without a change on the lift', () => {
    const key = (f: number) => footprintsAt(deskStateAt(f)).filter((x) => x.kind === 'rect' && Math.abs(x.c[0] - (KEY_REST[0] + 1.5)) < 1e-9 && x.z0 === KEY_REST[2]);
    expect(key(E5.lift - 1)).toEqual(key(E5.lift));
    expect(key(E5.lift)).toHaveLength(1);
  });

  it('beat 5’s focus ramps in and out without a pop, after C12’s ramp out (nothing ramps at 2334)', () => {
    const b5 = FOCUS_BEATS.find((b) => b.id === 'b5')!;
    expect(b5.from).toBeGreaterThanOrEqual(2334);
    for (let f = 2300; f < 2760; f++) {
      const a = stepAt(f);
      const b = stepAt(f + 1);
      expect(Math.abs(b.amount - a.amount), `step at ${f}`).toBeLessThan(0.12);
      // the ids change only while nothing is stepped
      if (a.amount > 0 && b.amount > 0) expect(b.ids).toEqual(a.ids);
    }
    expect(stepAt(2400).amount).toBe(0);
    expect(stepAt(2560).amount).toBe(1);
    expect(stepAt(2700 + STEP_FRAMES).amount).toBe(0);
  });

  it('leaves the summary (still (d)) to its own drawing: no key, plate, spike or slips from f5400', () => {
    for (const f of [SPAN_D[0], 5535, 6000]) {
      const b = beat5At(f);
      expect([b.key, b.plate, b.spike, b.punch]).toEqual([null, null, null, null]);
      expect(b.slips).toHaveLength(0);
      expect(b.fingers.every((a) => a === 0)).toBe(true);
    }
  });
});
