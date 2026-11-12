import { describe, expect, it } from 'vitest';
import { BEAT_5, cue } from '../cues.ts';
import { BELT_HEADING, BELT_SLOPE, CREST, DOCS, DOCS_DOCK, DOCS_SLIT, E5, docsTakeAt, FLIP, KEEP_LAND, KEY_HIT, KEY_REST, KEY_PIVOT, KEY_SEAT, KICK, KICK_FLY, RACK, RACK_ROLL, SLIPS_5, STRIKES, beat5At, fingersAt, flipCurve, hatchHoleAt, keyAt, kickAt, loupeAt5, pileAt, plateAt, punchAt5, slipsAt, spikeAt, type FilterSlip } from './beat5.ts';
import { deskHoles } from './objects/Dispatch.tsx';
import { RIDES } from './beat4.ts';
import { MAX_FOOTPRINTS, footprintsAt } from './footprints.ts';
import { BAYS, CHUTE_POSTS, FINGER_ROOT, FINGER_Y, GALLEY_TRAY, GATE, KEY_DOCK, NEXT_SLIP, PRINT_HEAD, PROACTIVE_PLATE, PUNCH, SPIKE, THROAT, YOU, type P3 } from './layout.ts';
import { B5_HOLD, B5_LATE, B5_LATE_FROM, FOCUS_BEATS, LAMP_DIMS, SLIP_BELT, STEP_FRAMES, deskStateAt, stepAt } from './state.ts';
import { isStepped } from './kit.tsx';
import { DOCKED, SPAN_D, summaryDeskState } from './summary.ts';
import { ACT2_TAGS } from './film.ts';
import { SAFE } from '../look/tokens.ts';
import { CHORES } from './you.ts';

const dist = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const slipOf = (f: number, i: number): FilterSlip | undefined => slipsAt(f).find((x) => x.i === i);
const HL = NEXT_SLIP.l / 2;
const HW = NEXT_SLIP.w / 2;
/** the paper's half thickness (objects/Filter.tsx filterSlipGeometry) */
const HT = 0.4;

/** A slip's local frame as objects/Filter.tsx poses it: rotation [roll, -slope, heading] in 'ZYX' order (Rz Ry Rx). */
function frameOf(x: FilterSlip): { toWorld: (v: P3) => P3; toLocal: (w: P3) => P3 } {
  const [cr, sr] = [Math.cos(x.roll), Math.sin(x.roll)];
  const [cp, sp] = [Math.cos(-x.slope), Math.sin(-x.slope)];
  const [ch, sh] = [Math.cos(x.heading), Math.sin(x.heading)];
  // M = Rz(h) Ry(-s) Rx(r), columns are the local axes in world
  const m = [
    [ch * cp, ch * sp * sr - sh * cr, ch * sp * cr + sh * sr],
    [sh * cp, sh * sp * sr + ch * cr, sh * sp * cr - ch * sr],
    [-sp, cp * sr, cp * cr],
  ];
  const toWorld = (v: P3): P3 => [0, 1, 2].map((r) => x.p[r]! + m[r]![0]! * v[0] + m[r]![1]! * v[1] + m[r]![2]! * v[2]) as unknown as P3;
  const toLocal = (w: P3): P3 => {
    const d = [w[0] - x.p[0], w[1] - x.p[1], w[2] - x.p[2]];
    return [0, 1, 2].map((c) => m[0]![c]! * d[0]! + m[1]![c]! * d[1]! + m[2]![c]! * d[2]!) as unknown as P3;
  };
  return { toWorld, toLocal };
}
/** Points over a slip's top and underside (a grid, its edges included). */
function slipPoints(x: FilterSlip, nx = 13, ny = 5): P3[] {
  const { toWorld } = frameOf(x);
  const out: P3[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (const z of [-HT, HT]) out.push(toWorld([-HL + (2 * HL * i) / (nx - 1), -HW + (2 * HW * j) / (ny - 1), z]));
  return out;
}
const inside = (l: P3, m = 0): boolean => Math.abs(l[0]) <= HL + m && Math.abs(l[1]) <= HW + m;
/** Whether a world point is inside an axis-aligned box. */
const inBox = (p: P3, b: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }): boolean => p[0] > b.x0 && p[0] < b.x1 && p[1] > b.y0 && p[1] < b.y1 && p[2] > b.z0 && p[2] < b.z1;
/** The docked key's solid points (its bow ring, its shank, its bit), posed as keyAt poses it (yaw about its rest point). */
function keyPoints(f: number): P3[] {
  const k = keyAt(f)!;
  const { bowY, bowR, shank, bit } = CHORES.key;
  const local: P3[] = [];
  for (let a = 0; a < 24; a++) for (const r of [7, bowR]) local.push([r * Math.cos((a * Math.PI) / 12), bowY + r * Math.sin((a * Math.PI) / 12), 6]);
  for (let y = shank[0]; y <= shank[1]; y += 3) for (const x of [-2.4, 2.4]) local.push([x, y, 4.8]);
  for (let x = bit.x[0]; x <= bit.x[1]; x += 3) for (let y = bit.y[0]; y <= bit.y[1]; y += 3) local.push([x, y, 5.4]);
  const [c, s] = [Math.cos(k.yaw), Math.sin(k.yaw)];
  return local.map(([x, y, z]) => [k.p[0] + x * c - y * s, k.p[1] + x * s + y * c, k.p[2] + z]);
}
const BAR = { ...GATE.bar, z0: 0, z1: GATE.h + 3.5 };
const CHEEKS = [
  { x0: THROAT.box.x0 - 6, x1: THROAT.box.x1, y0: THROAT.box.y0 - 4, y1: THROAT.box.y0 + 6, z0: THROAT.z[0] + 4, z1: THROAT.z[1] + 4 },
  { x0: THROAT.box.x0 - 6, x1: THROAT.box.x1, y0: THROAT.box.y1 - 6, y1: THROAT.box.y1 + 4, z0: THROAT.z[0] + 4, z1: THROAT.z[1] + 4 },
];
const THROAT_FLOOR = { ...THROAT.box, z0: THROAT.z[0], z1: THROAT.z[1] - 8 };

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
    // a kept slip lands on MT1's belt line (beat 6's strips ride it too), wholly past the gate's bar
    const [a, b] = [SLIP_BELT[0]!, SLIP_BELT[1]!];
    const c = (KEEP_LAND[0] - a[0]) / (b[0] - a[0]);
    expect((KEEP_LAND[1] - a[1]) / (b[1] - a[1])).toBeCloseTo(c, 9);
    expect((KEEP_LAND[2] - a[2]) / (b[2] - a[2])).toBeCloseTo(c, 9);
  });

  it('the trips: each event strikes the docked key on its own frame of BEAT_5.trips, with no one prompting it, before the spike is up', () => {
    const trips = SLIPS_5.filter((s) => s.role === 'trip');
    expect(trips.map((s) => s.strike)).toEqual([...BEAT_5.trips]);
    for (const s of trips) {
      expect(s.strike!).toBeGreaterThan(E5.plateDock);
      // it is out of the spout on its own, airborne until its strike, lying on the key on it
      expect(slipOf(s.strike! - E5.out - 1, s.i)).toBeUndefined();
      expect(slipOf(s.strike! - 1, s.i)!.flying).toBe(true);
      expect(dist(slipOf(s.strike!, s.i)!.p, KEY_HIT)).toBeLessThan(1e-9);
      // the key kicks from its strike, never before
      expect(kickAt(s.strike!)).toBe(0);
      expect(Math.abs(kickAt(s.strike! + 1))).toBeGreaterThan(0.5);
      // it is gone under the print head before the next one strikes, and all before the spike's hatch opens
      expect(slipOf(s.strike! + 30, s.i)).toBeUndefined();
      expect(slipOf(E5.spikeOpen, s.i)).toBeUndefined();
    }
    // nothing of it is a tape row: no trip lies in the throat when beat 6's first strip slip lands (its history is fixed)
    for (const s of trips) expect(slipOf(2730, s.i)).toBeUndefined();
  });

  it('every slip reaches the gate on its frame: a dropped one lands across the fingers, a kept one on the belt past them', () => {
    for (const s of SLIPS_5.filter((x) => x.role !== 'trip')) {
      const first = s.strike ?? s.f;
      expect(slipOf(first - E5.out - 1, s.i)).toBeUndefined();
      const at = slipOf(s.f, s.i)!;
      expect(dist(at.p, s.role === 'keep' ? KEEP_LAND : RACK)).toBeLessThan(1e-9);
      expect(at.flying).toBe(false);
      expect(slipOf(s.f - 1, s.i)!.flying).toBe(true);
      // a kept slip struck the key KICK_FLY frames before it (an ask passes the key; noise never reaches it)
      if (s.role === 'keep') {
        expect(s.strike).toBe(s.f - KICK_FLY);
        expect(dist(slipOf(s.strike!, s.i)!.p, KEY_HIT)).toBeLessThan(1e-9);
      } else expect(s.strike).toBeNull();
    }
    expect(STRIKES).toHaveLength(BEAT_5.trips.length + BEAT_5.slips.filter((s) => s.keep).length);
  });

  it('noise is marked and asks are not: every dropped slip carries a stamp a rule matches (no two alike), every ask is a plain ask', () => {
    for (const s of SLIPS_5) expect(s.print.kind).toBe(s.role === 'drop' ? 'noise' : 'ask');
    const noise = SLIPS_5.filter((s) => s.role === 'drop');
    expect(new Set(noise.map((s) => (s.print.kind === 'noise' ? s.print.v : -1))).size).toBe(noise.length);
    // the kinds alternate: no two dropped slips in a row carry the same stamp
    for (let i = 1; i < noise.length; i++) expect(noise[i]!.print).not.toMatchObject({ noise: (noise[i - 1]!.print as { noise: string }).noise });
  });
});

describe('beat 5: the key', () => {
  it('in your tray until trait-proactive, 4 f of anticipation, airborne until key-dock, docked on it (a contact frame)', () => {
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

  it('kicks a quarter turn about its bow on each strike and springs home, never past it, its bow still', () => {
    for (const s of STRIKES) {
      expect(kickAt(s + KICK.out)).toBeCloseTo(KICK.a, 9);
      expect(Math.abs(kickAt(s + KICK.out + 6))).toBeLessThan(0.05);
      for (let f = s; f < s + 30; f += 0.25) {
        const a = kickAt(f);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(KICK.a + 1e-9);
        // the bow (its pivot) stays where it lies
        const k = keyAt(f)!;
        const bow = [k.p[0] + KEY_PIVOT[0] * Math.cos(k.yaw) - KEY_PIVOT[1] * Math.sin(k.yaw), k.p[1] + KEY_PIVOT[0] * Math.sin(k.yaw) + KEY_PIVOT[1] * Math.cos(k.yaw)];
        expect(Math.hypot(bow[0]! - KEY_SEAT[0] - KEY_PIVOT[0], bow[1]! - KEY_SEAT[1] - KEY_PIVOT[1])).toBeLessThan(1e-9);
        // and the key never swings into the gate's bar
        for (const p of keyPoints(f)) expect(inBox(p, BAR), `key in the bar at ${f}`).toBe(false);
      }
    }
    // it lies still between kicks (the dock) and before the first
    expect(kickAt(BEAT_5.trips[0]! - 1)).toBe(0);
  });
});

describe('beat 5: the plate and the spike', () => {
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
    // it slides past the chute's posts (their feet r 13) and docks clear south of the raised belt
    for (const [x] of CHUTE_POSTS) expect(B.x1 < x - 13 || B.x0 > x + 13).toBe(true);
  });

  it('the spike stands up on spike-in, nothing of it above the slate before its leaves part', () => {
    expect(spikeAt(E5.spikeOpen - 1)).toBeNull();
    for (let f = E5.spikeOpen; f < E5.spikeRise; f++) expect(SPIKE.h + spikeAt(f)!.dz).toBeLessThan(0);
    expect(spikeAt(E5.spikeIn - 1)!.dz).toBeLessThan(0);
    expect(spikeAt(E5.spikeIn)!.dz).toBe(0);
    // it stands before the first slip is flipped onto it
    expect(E5.spikeIn).toBeLessThan(BEAT_5.slips[0]!.f + BEAT_5.flip);
  });
});

describe('beat 5: the filter', () => {
  it('a dropped slip: the fingers flip it (4 f), it lands impaled on the pile on f + impale, and the pile counts it the frame after', () => {
    for (const s of SLIPS_5.filter((x) => x.role === 'drop')) {
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
    expect(pileAt(2719)).toBe(SLIPS_5.filter((x) => x.role === 'drop').length);
  });

  it('a dropped slip rests on the fingers’ tops and rides the leading finger: no finger passes through it (landing and flip, 0.25 f steps)', () => {
    // each finger's centreline (objects/Intake.tsx useGateGeometry: root, knee, tip), turned about its root as Gate turns it
    const line = (y: number): P3[] => {
      const pts: [number, number, number][] = [
        [GATE.bar.x0 + 2, y, GATE.h - 10],
        [GATE.bar.x0 - GATE.fingerL * 0.6, y, GATE.h - 12],
        [GATE.bar.x0 - GATE.fingerL, y, GATE.h - 18],
      ];
      const out: P3[] = [];
      for (let i = 0; i < pts.length - 1; i++) for (let t = 0; t < 1; t += 0.05) out.push(pts[i]!.map((v, c) => v + (pts[i + 1]![c]! - v) * t) as unknown as P3);
      out.push(pts[pts.length - 1]!);
      return out;
    };
    const turn = (p: P3, a: number): P3 => {
      const x = p[0] - FINGER_ROOT.x;
      const z = p[2] - FINGER_ROOT.z;
      return [FINGER_ROOT.x + x * Math.cos(a) + z * Math.sin(a), p[1], FINGER_ROOT.z - x * Math.sin(a) + z * Math.cos(a)];
    };
    for (const s of SLIPS_5.filter((x) => x.role === 'drop')) {
      for (let f = s.f; f <= s.f + BEAT_5.flip; f += 0.25) {
        const x = slipOf(f, s.i)!;
        const { toLocal } = frameOf(x);
        const angles = fingersAt(f);
        FINGER_Y.forEach((y, j) => {
          for (const p of line(y)) {
            const l = toLocal(turn(p, angles[j]!));
            if (inside(l)) expect(l[2], `finger ${j} through slip ${s.i} at ${f}`).toBeLessThanOrEqual(-3.0);
          }
        });
      }
    }
    // it rides the leading finger: the slip's turn is that finger's
    const s = SLIPS_5.find((x) => x.role === 'drop')!;
    expect(slipOf(s.f + 2, s.i)!.roll).toBeCloseTo(RACK_ROLL - FLIP.a * flipCurve(2), 9);
  });

  it('an ask glances off the key onto the belt in the belt’s own pose: it lands lying as it rides on, then hops into the throat', () => {
    for (const s of SLIPS_5.filter((x) => x.role !== 'drop')) {
      const l = slipOf(s.land!, s.i)!;
      const n = slipOf(s.land! + 1, s.i)!;
      expect(dist(l.p, KEEP_LAND)).toBeLessThan(1e-9);
      expect(l.heading).toBeCloseTo(BELT_HEADING, 9);
      expect(l.slope).toBeCloseTo(BELT_SLOPE, 9);
      expect(n.heading).toBeCloseTo(l.heading, 9);
      expect(n.slope).toBeCloseTo(l.slope, 9);
      expect(l.flying).toBe(false);
      // in the throat, lying along it, from the end of its hop
      const th = slipOf(s.land! + 8, s.i)!;
      expect(th.p).toEqual(NEXT_SLIP.throat);
      expect([th.heading, th.slope]).toEqual([0, 0]);
      expect(slipOf(s.land! + 3, s.i)!.p).toEqual(CREST);
    }
  });

  it('an ask never passes through the gate bar, the key (kicking or not), the throat’s cheeks or its floor (0.25 f steps)', () => {
    for (const s of SLIPS_5.filter((x) => x.role !== 'drop')) {
      for (let f = s.strike! - 3; f <= s.land! + 12; f += 0.25) {
        const x = slipOf(f, s.i);
        if (!x) continue;
        const pts = slipPoints(x);
        for (const p of pts) {
          expect(inBox(p, BAR), `slip ${s.i} in the gate bar at ${f}`).toBe(false);
          for (const c of CHEEKS) expect(inBox(p, c), `slip ${s.i} in a cheek at ${f}`).toBe(false);
          expect(inBox(p, THROAT_FLOOR), `slip ${s.i} in the throat floor at ${f}`).toBe(false);
        }
        // the key under it: every key point inside its outline is under its underside
        const { toLocal } = frameOf(x);
        if (f >= E5.keyDock) for (const k of keyPoints(f)) {
          const l = toLocal(k);
          if (inside(l)) expect(l[2], `key through slip ${s.i} at ${f}`).toBeLessThanOrEqual(-HT + 1e-6);
        }
      }
    }
  });

  it('no two slips pass through each other in the air (0.25 f steps), and the posts and throws clear the spike and its pile', () => {
    for (let f = BEAT_5.trips[0]! - E5.out; f < 2720; f += 0.25) {
      const xs = slipsAt(f).filter((x) => !x.onPile);
      const pile = slipsAt(f).filter((x) => x.onPile);
      for (const a of xs) {
        const pa = slipPoints(a, 9, 5);
        for (const b of [...xs, ...pile]) {
          if (a === b) continue;
          const { toLocal } = frameOf(b);
          for (const p of pa) {
            const l = toLocal(p);
            if (inside(l)) expect(Math.abs(l[2]), `slip ${a.i} through slip ${b.i} at ${f}`).toBeGreaterThan(2 * HT);
          }
        }
        // the spike's rod: no slip point within its radius under its tip (a dropped slip comes down it threaded, its centre on it)
        if (spikeAt(Math.floor(f))) {
          const threaded = a.role === 'drop' && Math.hypot(a.p[0] - SPIKE.x, a.p[1] - SPIKE.y) < 1e-6;
          if (!threaded) for (const p of pa) if (p[2] < SPIKE.h + 1) expect(Math.hypot(p[0] - SPIKE.x, p[1] - SPIKE.y), `slip ${a.i} on the rod at ${f}`).toBeGreaterThan(3.2);
        }
      }
    }
  });

  it('a kept slip: the loupe swings out once it is in the throat, the punch notches it on f + notchAfter, then it feeds into the head', () => {
    for (const s of SLIPS_5.filter((x) => x.role === 'keep')) {
      const n = s.f + BEAT_5.notchAfter;
      expect(slipOf(s.f + 8, s.i)!.p).toEqual(NEXT_SLIP.throat);
      expect(loupeAt5(s.f + 8)).toBe(0);
      expect(loupeAt5(s.f + 9)).toBeGreaterThan(0);
      expect(slipOf(n - 1, s.i)!.notched).toBe(false);
      expect(slipOf(n, s.i)!.notched).toBe(true);
      // the punch is down on the slip's edge on its notch frame (its lowest), out of the cheek before it, hidden well after
      expect(punchAt5(n)!.z).toBeCloseTo(PUNCH.hidden + PUNCH.out - PUNCH.drop, 6);
      expect(punchAt5(n - 1)!.z).toBeGreaterThan(punchAt5(n)!.z);
      expect(punchAt5(n + 8)).toBeNull();
      // the die grows out of the cheek and goes back into it: never whole on its first or last frame out
      let prev = 0;
      for (let f = n - 6; f <= n + 6; f++) {
        const out = punchAt5(f)?.out ?? 0;
        expect(Math.abs(out - prev), `punch out at ${f}`).toBeLessThan(0.55);
        prev = out;
      }
      expect(prev).toBe(0);
      // fed wholly under the head and gone there
      expect(slipOf(n + 6, s.i)).toBeDefined();
      expect(slipOf(n + 7, s.i)).toBeUndefined();
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
        // an ask leaves the picture only under the print head
        if (!y) {
          expect(s.role, `slip ${x.i} vanished at ${f}`).not.toBe('drop');
          // (wholly under it: its west end past the head's west face, so no tail is left in the throat)
          expect(x.p[0] - HL, `slip ${x.i} gone at ${f} with its tail in the throat`).toBeGreaterThanOrEqual(PRINT_HEAD.box.x0);
          continue;
        }
        // (the post leaves the spout fast, about 70 u in its first frame, then slower down onto the gate)
        expect(dist(y.p, x.p), `slip ${x.i} at ${f}`).toBeLessThan(80);
        expect(Math.abs(y.heading - x.heading), `slip ${x.i} heading at ${f}`).toBeLessThan(0.75);
        expect(Math.abs(y.roll - x.roll), `slip ${x.i} roll at ${f}`).toBeLessThan(0.45);
        // a slip lying on something never snaps its slope from one frame to the next (a landing in the air's pose is the contact)
        if (!x.flying && !y.flying) expect(Math.abs(y.slope - x.slope), `slip ${x.i} slope at ${f}`).toBeLessThan(0.25);
      }
      prev = b;
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
    expect(stepAt(2560).amount).toBe(1);
    expect(stepAt(2700 + STEP_FRAMES).amount).toBe(0);
    // 5.1: the hand-over's focus leads the key's lift by 4 f, your desk, the key's dock and the intake at full
    expect(b5.from).toBe(E5.lift - 4);
    expect(stepAt(E5.lift + 10).amount).toBe(1);
    for (const id of ['you', 'proactive', 'gate', 'intake', 'belt'] as const) expect(b5.step).not.toContain(id);
    // nothing C12 stepped and released at 2320-2334 steps again before 5.2 (no pumping)
    const c12 = FOCUS_BEATS.find((b) => b.id === 'c12')!;
    for (const id of c12.step) expect(b5.step).not.toContain(id);
    // 5.2: the rest steps down on its own ramp from 8 f before the spike, continuously, and comes back up with the beat
    let prev = 0;
    for (let f = 2300; f < 2760; f++) {
      const own = deskStateAt(f).step.own;
      const a = own && own.ids === B5_LATE ? own.amount : 0;
      expect(Math.abs(a - prev), `own step at ${f}`).toBeLessThan(0.12);
      prev = a;
    }
    expect(deskStateAt(B5_LATE_FROM - 1).step.own?.ids === B5_LATE).toBe(false);
    expect(deskStateAt(2560).step.own).toEqual({ amount: 1, ids: B5_LATE });
    expect(B5_LATE).toContain('you');
  });

  it('5.1 never pumps: what C12 had stepped and 5.2 steps again stays down through 5.1, and no part goes up and then down again', () => {
    const IDS = ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'reel', 'lock', 'gauge', 'proactive', 'you', 'deck', 'freshBay', 'chute', 'index', 'mouth'] as const;
    const amountOf = (f: number, id: string): number => {
      const s = deskStateAt(f);
      const st = isStepped(s.step, id);
      return st === 'late' ? s.testsStep : st === 'own' ? s.step.own!.amount : st ? s.step.amount : 0;
    };
    for (const id of IDS) {
      const a = Array.from({ length: 2720 - 2300 }, (_, k) => amountOf(2300 + k, id));
      for (let k = 1; k < a.length; k++) expect(Math.abs(a[k]! - a[k - 1]!), `${id} at ${2300 + k}`).toBeLessThan(0.12);
      // from C12's ramp-out to 5.3's ramp-out each part only ever goes one way (down, or up), never up and back down
      const seg = a.slice(2320 - 2300, 2700 - 2300);
      const ups = seg.some((v, k) => k > 0 && v > seg[k - 1]! + 1e-9);
      const downs = seg.some((v, k) => k > 0 && v < seg[k - 1]! - 1e-9);
      expect(ups && downs, `${id} pumps in 5.1-5.2`).toBe(false);
    }
    for (const id of B5_HOLD) for (let f = 2320; f < 2700; f += 4) expect(amountOf(f, id), `${id} at ${f}`).toBe(1);
  });

  it('W-09 takes its ask in: off the galley, over to its lit work slot, nose down into the slit; never on the galley in still (c) or (d)', () => {
    // it lies where beat 4 docked it until it moves (after still (b)), wholly in the slot before the bar-34 dolly
    expect(dist(DOCS_DOCK, RIDES.docs.dock)).toBeLessThan(1e-9);
    const from = DOCS.in - DOCS.feed - DOCS.hop;
    expect(from).toBeGreaterThan(2240);
    expect(DOCS.in).toBeLessThan(2640);
    expect(docsTakeAt(from)).toBeNull();
    for (const f of [DOCS.in, 2700, 3150, 5400, 5535]) expect(docsTakeAt(f), `f${f}`).toBe('gone');
    expect(summaryDeskState(5535).e5.docs).toBe('gone');
    // out of the galley's shade (its rails' tops) on its first frame, at the shade's tone, its own darkening gone over 4 f
    const first = docsTakeAt(from + 1) as Exclude<ReturnType<typeof docsTakeAt>, 'gone' | null>;
    expect(first.p[2] - 0.4).toBeGreaterThan(GALLEY_TRAY.z[1]);
    expect(first.shade).toBe(1);
    expect((docsTakeAt(from + 1 + DOCS.shadeRamp) as { shade: number }).shade).toBe(0);
    let prev = { p: DOCS_DOCK, heading: 0, slope: 0 };
    for (let f = from + 1; f < DOCS.in; f++) {
      const x = docsTakeAt(f) as Exclude<ReturnType<typeof docsTakeAt>, 'gone' | null>;
      expect(dist(x.p, prev.p), `docs slip at ${f}`).toBeLessThan(60);
      expect(Math.abs(x.heading - prev.heading), `docs slip heading at ${f}`).toBeLessThan(0.3);
      expect(Math.abs(x.slope - prev.slope), `docs slip slope at ${f}`).toBeLessThan(0.3);
      // its lowest point: over the galley's rails, the stick and the slot block until it stands over the slit and goes in
      const low = x.p[2] - (NEXT_SLIP.l / 2) * Math.abs(Math.sin(x.slope)) - 0.4;
      const overSlit = Math.abs(x.p[0] - DOCS_SLIT[0]) < 1e-9 && Math.abs(x.p[1] - DOCS_SLIT[1]) < 1e-9 && x.slope === -Math.PI / 2 && x.heading === Math.PI / 2;
      const S = BAYS.docs.slot;
      const overBlock = x.p[0] + NEXT_SLIP.l / 2 > S.x0 && x.p[1] + NEXT_SLIP.l / 2 > S.y0;
      if (!overSlit) expect(low, `docs slip low at ${f}`).toBeGreaterThan(overBlock ? 32.5 : GALLEY_TRAY.z[1] + 0.5);
      prev = x;
    }
    // standing in the slit: its width (40) inside the slit's 42, its thickness inside its 12
    expect(NEXT_SLIP.w).toBeLessThan(BAYS.docs.slot.x1 - BAYS.docs.slot.x0 - 16);
    // its last frame before it is gone: its top edge still over the slit's lip (it goes under on DOCS.in)
    const last = docsTakeAt(DOCS.in - 1) as { p: P3 };
    expect(last.p[2] + NEXT_SLIP.l / 2).toBeGreaterThan(DOCS_SLIT[2]);
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

describe('beat 5: the gate tag', () => {
  it('sets its text inside title-safe, its leader down to the gate bar', () => {
    const t = ACT2_TAGS.find((x) => x.cue === 'tag-gate')!;
    // its EN line's ascenders stand 30 px over its baseline (measured on the renders)
    expect(t.at[1] - 30).toBeGreaterThanOrEqual(SAFE.y);
    expect(t.anchor === 'start' ? t.at[0] : 1920 - t.at[0]).toBeGreaterThanOrEqual(SAFE.x);
    expect(t.foot[0]).toBeGreaterThanOrEqual(GATE.bar.x0);
    expect(t.foot[0]).toBeLessThanOrEqual(GATE.bar.x1);
  });
});

describe('the spike pile’s landing slip and its own footprint (A9)', () => {
  it('keeps a landing slip’s top over its own footprint’s while it squashes, exactly as before once still', () => {
    let squashed = 0;
    for (let f = 2400; f < 2700; f++) {
      const s = deskStateAt(f);
      const pile = (s.e5?.slips ?? []).filter((x) => x.onPile);
      if (!pile.length) continue;
      const fps = footprintsAt(s);
      for (const x of pile.slice(-4)) {
        const fp = fps.find((q) => q.kind === 'rect' && q.c[0] === x.p[0] && q.c[1] === x.p[1] && Math.abs(q.z0 - (x.p[2] - 0.4)) < 1e-9);
        expect(fp, `f${f} slip ${x.i}`).toBeTruthy();
        if (fp?.kind !== 'rect') continue;
        // its top face: the slip's centre plus its half thickness squashed 3% (objects/Filter.tsx SlipAt)
        const top = x.p[2] + 0.4 * (1 - 0.03 * x.squash);
        if (x.squash > 0) {
          squashed++;
          expect(top - fp.z1, `f${f} slip ${x.i}`).toBeGreaterThan(0.05);
        } else expect(fp.z1, `f${f} slip ${x.i}`).toBe(x.p[2] + 0.4);
      }
    }
    expect(squashed).toBeGreaterThan(8);
  });
});

