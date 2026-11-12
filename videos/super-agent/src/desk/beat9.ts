/**
 * Beat 9 (STORYBOARD 9.1-9.2, film f4560-4959; cues.ts BEAT_9): keeping it running, handed over (proposed). On bar 58's
 * downbeat beat 8's sheet slides away east, your laptop's lid shuts (actOne.ts LID_SHUTS) and the camera eases out to
 * still (d)'s framing (camera.ts TO_VELLUM). East of the system the vellum is laid down, each sheet unrolled from its
 * west edge in 12 f on `lays` (the plan of the deck, the state cabinet, the loop's sheet, the tethers and their clips),
 * each waiting until the departing sheet has cleared its ground; the graphite machines rise out of the slate through
 * hatches once the sheet has passed them (their holes close under their bases). The lid strut lifts off your tray in the
 * tray's own pose (the hand-over grammar: 4 f anticipation, the arc, the drop), docks lying on the loop's sheet where the
 * sheet draws it and takes the vellum's material (it presses flat and pales into the drawing as its pictogram inks in
 * under it); the Persistent plate slides out from under it into the form still (d) prints. The tethers' dashes march
 * from the machines' side until the etch stops each (beat10.ts). A machine's work light comes on and a queued vellum slip
 * rides its tether and drops into it. Under N8 the Watchdog is laid outside the system, its sightline (its own mesh,
 * turning about the lens) sweeps 20 f on each of `sweeps` over the stuck bay, whose card drum steps out and back on every
 * beat while its work light stays solid; it pins a pencil flag on it, then draws its sightline on its sheet as still (d)
 * prints it and draws its beam back into the lens.
 *
 * Proposed (objects/Proposed.tsx) draws every vellum and pencil part and the machines from `proposedAt`'s state, each
 * ending exactly as still (d) draws it (the summary mounts it with no state). Import rule as beat7.ts's: module-level
 * tables from leaf modules only (cues.ts, layout.ts, springs.ts, fpKit.ts, you.ts, camera.ts); still (d)'s layout
 * (summary.ts) is restated here where a table needs it, and beat9.test.ts holds the copies equal.
 */
import { clamp, easings } from '@aiv/core';
import { BEAT_9, BEAT_10, WORDS } from '../cues.ts';
import type { CardUp } from './beat4.ts';
import { proposed10, type Proposed10 } from './beat10.ts';
import { LOOP_SHEET, MACHINES_9, RELEASE, SEAM, clipX, lerp, sine, trapezoid } from './proposed.ts';
import { rectFp, type Footprint } from './fpKit.ts';
import type { P2, P3, Pool } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import { SPRING, springAt } from './springs.ts';
import { FRAMING_D, TO_REGISTER, cameraAt, deskCamera, project, screenToDesk } from './camera.ts';
import type { ArmStep, DeskState, FocusEntry, LampStep, ReplyState } from './state.ts';
import { CHORES, TRAY_Z, strutInTray, type YouPose } from './you.ts';

/** Whether beat 9 is built (false: the animatic's slate shows its cues' words and the "animatic" mark over its frames). */
export const BUILT = true;

const lerp3 = (a: P3, b: P3, t: number): P3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Where beat 8's departing sheet's west edge is (beat8.ts: x 1050 on 4578, 1325 on 4589, off the frame from 4609): what east of x 1050 waits for. */
export const SHEET_CLEARS = { x1050: 4578, x1325: 4589 } as const;

// ------------------------------------------------------------------------------------------------
// 9.1 the vellum laid down; the machines

/** Each sheet's lay: 12 f, unrolled from its west edge (plan, cabinet, loop sheet, tethers with their clips). */
export const LAY_FRAMES = 12;
export const LAYS = { plan: BEAT_9.lays[0], cabinet: BEAT_9.lays[1], loop: BEAT_9.lays[2], tethers: BEAT_9.lays[3] } as const;
/** A sheet's lay at f (0 none .. 1 laid): the roll's run, gathering speed off the edge and easing into its far edge; its first frame on the cue, laid on its twelfth. */
export const layAt = (f: number, from: number): number => trapezoid((f - from + 1) / LAY_FRAMES, 0.3, 0.45);

/**
 * The machines' rise (still (d)'s MACHINES, north to south: server, workstation, laptop): each through a slate hatch the
 * size of its base (objects/Dispatch.tsx Hatch, 'slate'), once beat 8's sheet has passed its ground (x 1165-1325 is clear
 * from 4589): the leaves part (4 f), it rises out of its pit (its own frames, gathering speed and easing onto the slate),
 * and the leaves close again under its base (4 f: they slide in under it, only the hole's 1.2 u margin round the base
 * showing them), then the hole goes (the slate whole under it). Two of the slate's hole slots serve them (gl/desk.ts
 * DESK_HOLES 0 and 2, idle in beat 9): the server's and then the laptop's in slot 0, never both open at once.
 */
export const MACHINE_RISE = [
  { open: 4589, rise: [4592, 4603] as const, slot: 0 },
  { open: 4596, rise: [4599, 4611] as const, slot: 2 },
  { open: 4607, rise: [4610, 4617] as const, slot: 0 },
] as const;
/** The leaves' frames each way. */
export const LEAF_FRAMES = 4;
export interface MachineRise {
  /** the hatch's leaves (0 shut .. 1 open), and whether its hole is cut */
  leaves: number;
  hole: boolean;
  /** its base under the slate (u, <= 0) */
  dz: number;
}
export function machineRiseAt(i: number, f: number): MachineRise {
  const M = MACHINE_RISE[i]!;
  const h = MACHINES_9[i]!.h;
  const [r0, r1] = M.rise;
  const dz = f >= r1 ? 0 : -(h + 4) * (1 - easings.outCubic(clamp((f - r0) / (r1 - r0))));
  const leaves = f < r1 ? sine((f - M.open) / LEAF_FRAMES) : 1 - sine((f - r1) / LEAF_FRAMES);
  return { leaves, hole: f >= M.open && f < r1 + LEAF_FRAMES, dz };
}

// ------------------------------------------------------------------------------------------------
// 9.1 the lid strut's hand-over (beat 5's key's grammar), and the Persistent plate

/** The strut still (d)'s loop sheet draws (objects/Proposed.tsx loopSheet): the loop's centre, its bar's centre. */
const LOOP_C: P2 = [LOOP_SHEET.x0 + (LOOP_SHEET.x1 - LOOP_SHEET.x0) * 0.48, LOOP_SHEET.y0 + (LOOP_SHEET.y1 - LOOP_SHEET.y0) * 0.62];
/** The drawn strut's centre on the sheet (the track's foot: the loop's centre + its ry less half its gauge, south). */
export const STRUT_DRAWN: P2 = [LOOP_C[0], LOOP_C[1] - 96 + 8];
/** The strut in your tray (you.ts strutInTray): YourDesk draws it from its end `a`, its length along +y. */
const TRAY = strutInTray();
export const STRUT_LEN = Math.round(Math.hypot(TRAY.b[0] - TRAY.a[0], TRAY.b[1] - TRAY.a[1], TRAY.b[2] - TRAY.a[2]) * 4) / 4;
const STRUT_REST: P3 = [(TRAY.a[0] + TRAY.b[0]) / 2, (TRAY.a[1] + TRAY.b[1]) / 2, TRAY.a[2]];
/** Docked: lying east-west along the drawn bar, its clevises on the sheet (their half height 5.5 over it). */
export const STRUT_DOCK: P3 = [STRUT_DRAWN[0], STRUT_DRAWN[1], 6];
/**
 * The flight (the hand-over grammar: 4 f anticipation, the rise, the arc, the dock), the whole span from the lid's click to
 * the dock: up over an arc whose top lies a little before half way (`arc`, over the straight line, on the flight's time) and
 * bowing north on the desk (`bow`), so the arc reads on screen from the camera's pitch; across at a speed chosen frame by
 * frame so that its speed ON SCREEN, bar 58's ease-out included (camera.ts cameraAt), runs a trapezoid: in from rest over
 * `ramp`, level, braking over `brake` (FLIGHT). The level is as low as the cues allow: the camera's pan no longer adds to
 * the strut's own top speed. It comes down onto the sheet as it brakes, its fall meeting the sheet on `dock` (the contact).
 * The bump rises from rest over `rise` of the flight (it gathers height out of the anticipation, never leaving it at speed).
 */
const S9 = { lift: BEAT_9.strut.lift, anticipate: 4, dock: BEAT_9.strut.dock, arc: 318, skew: 0.35, rise: 0.3, bow: 80, ramp: 0.12, brake: 0.18 } as const;
/** The arc's bump, 0 at both ends and 1 at its top: u(1 - u)(1 - skew u), normalised (its top before half way, its fall steeper than its rise). */
const BUMP = (() => {
  const b = (u: number) => u * (1 - u) * (1 - S9.skew * u);
  let m = 0;
  for (let i = 0; i <= 1000; i++) m = Math.max(m, b(i / 1000));
  return (u: number) => b(u) / m;
})();
/** The anticipation: back (west, away from its way) and up a little before it goes. */
const STRUT_BACK: P3 = [-3, 0, 2.5];
const STRUT_FROM: P3 = [STRUT_REST[0] + STRUT_BACK[0], STRUT_REST[1] + STRUT_BACK[1], STRUT_REST[2] + STRUT_BACK[2]];
/** The flight's first frame (the anticipation's end) and its length in frames (to the dock). */
const FLY_FROM = S9.lift + S9.anticipate;
const FLY_N = S9.dock - FLY_FROM;
/** Where the strut is at `k` of its way across (0 the anticipation's end, 1 the dock) and `u` of the flight's time: its height on time, its ground track bowed north. */
function strutPath(k: number, u: number): P3 {
  const D = STRUT_DOCK;
  return [lerp(STRUT_FROM[0], D[0], k), lerp(STRUT_FROM[1], D[1], k) + S9.bow * 4 * k * (1 - k), lerp(STRUT_FROM[2], D[2], u) + S9.arc * BUMP(u) * sine(u / S9.rise)];
}
/**
 * How far across (0..1) the strut is on each frame of its flight (FLY_FROM + i): each frame's step is the one that moves it
 * on screen (under that frame's camera) by its share of a trapezoid of screen speed; the trapezoid's level is the one
 * whose steps arrive exactly on the dock frame. A pure function of the cue sheet and the camera, computed once.
 */
const FLIGHT: readonly number[] = (() => {
  const cam = (i: number) => cameraAt(FLY_FROM + i, 15);
  const at = (i: number, k: number) => project(cam(i), strutPath(k, i / FLY_N));
  const run = (level: number): number[] => {
    const ks = [0];
    let p = at(0, 0);
    for (let i = 1; i <= FLY_N; i++) {
      const want = level * (trapezoid(i / FLY_N, S9.ramp, S9.brake) - trapezoid((i - 1) / FLY_N, S9.ramp, S9.brake));
      let lo = ks[i - 1]!;
      let hi = 1;
      const d = (k: number) => {
        const q = at(i, k);
        return Math.hypot(q[0] - p[0], q[1] - p[1]);
      };
      if (d(hi) <= want) lo = hi;
      else if (d(lo) < want)
        for (let n = 0; n < 40; n++) {
          const m = (lo + hi) / 2;
          if (d(m) < want) lo = m;
          else hi = m;
        }
      ks.push(lo);
      p = at(i, lo);
    }
    return ks;
  };
  // the level (the screen path's length) at which the last step lands on the dock
  let lo = 0;
  let hi = 6000;
  for (let n = 0; n < 40; n++) {
    const m = (lo + hi) / 2;
    if (run(m)[FLY_N]! < 1 - 1e-9) lo = m;
    else hi = m;
  }
  const ks = run(hi);
  ks[FLY_N] = 1;
  return ks;
})();
/** It takes the vellum's material once the plate has docked: it presses flat and pales into the drawing (8 f). */
export const STRUT_MORPH = { from: BEAT_9.strut.plateDock, frames: 8 } as const;
/** The drawn strut inks in under it as it goes (from the dock's settle to the morph's end). */
export const STRUT_INK = { from: BEAT_9.strut.dock + 2, to: STRUT_MORPH.from + STRUT_MORPH.frames } as const;

export interface StrutPose {
  /** its centre (the middle of its axis) */
  c: P3;
  /** turned about z (0 lying north as in your tray, -pi/2 east as docked), pitched about its own x */
  yaw: number;
  tilt: number;
  /** its landing squash (0..0.03) */
  squash: number;
  /** how high above where it lies (its contact shadow opens as it lifts) */
  lift: number;
  /** from steel (0) to the vellum drawing (1): it presses flat and pales */
  morph: number;
}
/** The lid strut from its lift (in your tray's pose) to the end of its morph into the drawing; null before and after. */
export function strutAt(f: number): StrutPose | null {
  if (f < S9.lift || f >= STRUT_MORPH.from + STRUT_MORPH.frames) return null;
  const A = STRUT_REST;
  if (f < FLY_FROM) {
    const t = sine((f - S9.lift) / S9.anticipate);
    const c = lerp3(A, STRUT_FROM, t);
    return { c, yaw: 0, tilt: 0.08 * t, squash: 0, lift: c[2] - A[2], morph: 0 };
  }
  const D = STRUT_DOCK;
  if (f < S9.dock) {
    // one arc from the anticipation onto its dock, its way across paced on screen (FLIGHT), turning a quarter east as it
    // goes; it comes down onto the sheet as it brakes, meeting it on the dock frame (no hover: nothing stalls before the contact)
    const u = (f - FLY_FROM) / FLY_N;
    const k = FLIGHT[f - FLY_FROM]!;
    const c = strutPath(k, u);
    const under = lerp(A[2], D[2], k);
    return { c, yaw: (-Math.PI / 2) * sine(k / 0.85), tilt: 0.08 * (1 - u) + 0.3 * Math.sin(Math.PI * u), squash: 0, lift: c[2] - under, morph: 0 };
  }
  // docked (its contact frame: a 3% squash, settling on the dock spring); then it takes the vellum's material
  return { c: D, yaw: -Math.PI / 2, tilt: 0, squash: 0.03 * Math.abs(1 - springAt(f, S9.dock, SPRING.dock)), lift: 0, morph: sine((f - STRUT_MORPH.from) / STRUT_MORPH.frames) };
}
/** The strut's pictogram on the loop's sheet (0 none .. 1 still (d)'s): inked along its length under the docked strut. */
export const strutInkAt = (f: number): number => sine((f - STRUT_INK.from) / (STRUT_INK.to - STRUT_INK.from));
/** The Persistent plate (its pictogram on the loop's sheet): slides south out from under the docked strut, docking on `plateDock`; its offset north of its place (u, 0 docked), null before it shows. */
export const PLATE_SLIDE = { from: BEAT_9.strut.dock, dy: 44 } as const;
export function plateAt(f: number): number | null {
  if (f < PLATE_SLIDE.from) return null;
  // (an even slide out, easing in and out: its first frame out is not most of the way)
  return PLATE_SLIDE.dy * (1 - sine((f - PLATE_SLIDE.from) / (BEAT_9.strut.plateDock - PLATE_SLIDE.from)));
}

/**
 * The Persistent plate's words (STORYBOARD 9.1: "Persistent · 持久" docks, in vellum; SCRIPT.md's trait table: one EN · zh
 * plate each, as the three enamel ones): a vellum plate laid on the loop's sheet's north edge, between it and the plan of the
 * deck and west of 10.1's "?" (QUERIES[0]), unrolled from its west edge over 8 f from the strut's dock ('trait-persistent':
 * the lay's first frame is the contact). Bar 65's dolly would cut it at the frame's east edge, so it rolls back up under
 * that move (TREATMENT Type: a printed field leaves at the start of a camera move); from there the pictogram on the loop's
 * sheet (still (d)'s) is Persistent's plate, as the others turn to theirs at the sign-off. Its centre is placed on still
 * (d)'s screen (FRAMING_D: about 225 x 40 px at x 1425, y 376: about 15 px clear of each sheet).
 */
export const PERSIST_WORDS = {
  c: ((): P3 => {
    const p = screenToDesk(deskCamera(FRAMING_D, 15), [1425, 376], 0.55);
    return [Math.round(p[0]), Math.round(p[1]), 0.55];
  })(),
  w: 330,
  d: 58,
  lay: { from: BEAT_9.strut.dock, frames: 8 },
  roll: { from: TO_REGISTER.from, frames: 8 },
} as const;
/** How much of the Persistent words plate is laid (0 none .. 1 whole; its west part shows). */
export const persistWordsAt = (f: number): number => {
  const P = PERSIST_WORDS;
  if (f < P.lay.from || f >= P.roll.from + P.roll.frames) return 0;
  return sine((f - P.lay.from + 1) / P.lay.frames) * (1 - sine((f - P.roll.from) / P.roll.frames));
};

// ------------------------------------------------------------------------------------------------
// 9.1 the loop runs: the tethers' dashes march, a machine's work light, the queued slip

/**
 * The tethers' dashes march out toward the machines from the moment each strip is laid (its edges' dash and its perforation
 * move together, u along the strip) until the etch reaches its machine (beat10.ts ETCH: the loop stalls), easing to a stop
 * on a whole number of both patterns (16+10 and 3+9: 156 u), so each ends exactly as still (d) draws it.
 */
export const MARCH = { from: LAYS.tethers + LAY_FRAMES, speed: 1.1, period: 156 } as const;
export function marchAt(i: number, f: number): number {
  const to = BEAT_10.etch[i]!;
  const T = to - MARCH.from;
  const n = Math.max(1, Math.round((MARCH.speed * T) / MARCH.period));
  return n * MARCH.period * trapezoid((f - MARCH.from) / T, 0.04, 0.12);
}
/** The server's work light (its panel slit, under the bloom: EMIT.slotDocs at most): on with `machineLamp` on spring-effects, out as the etch reaches it (beat10.ts). */
export const MACHINE_LAMP = { machine: 0, on: BEAT_9.machineLamp, off: BEAT_10.etch[0] + 1 } as const;
export const machineLampAt = (f: number): number => springAt(f, MACHINE_LAMP.on - 1, SPRING.effects) * (1 - springAt(f, MACHINE_LAMP.off, SPRING.effects));
/** Its slit opens from a line (3 f) just before it lights, and closes the same way once its light has died (objects/Proposed.tsx SERVER_LAMP). */
export const lampOpenAt = (f: number): number => sine((f - (MACHINE_LAMP.on - 3)) / 3) * (1 - sine((f - (MACHINE_LAMP.off + 6)) / 3));

/**
 * The queued slip: a vellum slip (proposed work) slides out of the loop's port onto the server's tether (setting out a
 * little before the machine's light comes on, so its ride is slow enough to follow at 0.64x), rides it to the clip and
 * hops over the server's west face, standing up edge-on, and drops into the vent slot on its top on `slipDrop` (the
 * contact frame: it is half in), wholly inside the frame after. 56 x 22 u (about 36 x 14 px), its overhang either side of
 * the 16 u tether a thing riding it.
 */
export const QUEUED = { out: BEAT_9.machineLamp - 8, hop: BEAT_9.slipDrop - 8, drop: BEAT_9.slipDrop, gone: BEAT_9.slipDrop + 2, l: 56, w: 22, apex: 40 } as const;
export interface QueuedSlip {
  p: P3;
  /** stood up about its length (0 flat .. pi/2 edge-on) */
  stand: number;
  /** how far it has come out of the port (0..1: its west part still inside the port's ring) */
  out: number;
}
const PORT_X = LOOP_SHEET.x1 - 8;
export function queuedAt(f: number): QueuedSlip | null {
  if (f < QUEUED.out || f >= QUEUED.gone) return null;
  const m = MACHINES_9[0]!;
  const y = m.c[1];
  const cx = clipX(0);
  const slot: P3 = [m.c[0] - 30, y, m.h];
  if (f < QUEUED.hop) {
    const u = (f - QUEUED.out) / (QUEUED.hop - QUEUED.out);
    const x = lerp(PORT_X - QUEUED.l / 2, cx - QUEUED.l / 2 - 6, trapezoid(u, 0.25, 0.3));
    return { p: [x, y, 1.2], stand: 0, out: clamp(u / 0.25) };
  }
  if (f < QUEUED.drop) {
    // the hop: up over the clip and the server's west face, standing up as it turns down onto the slot
    const u = (f - QUEUED.hop) / (QUEUED.drop - QUEUED.hop);
    const a: P3 = [cx - QUEUED.l / 2 - 6, y, 1.2];
    const e = sine(u);
    const z = lerp(a[2], slot[2] + QUEUED.w / 2, e) + 4 * QUEUED.apex * u * (1 - u);
    return { p: [lerp(a[0], slot[0], e), y, z], stand: (Math.PI / 2) * sine(u * 1.25), out: 1 };
  }
  // into the slot, gathering speed: half in on the contact frame, wholly in on the next
  const k = f - QUEUED.drop;
  return { p: [slot[0], y, slot[2] - (QUEUED.w / 2 + 1) * k * (k + 1)], stand: Math.PI / 2, out: 1 };
}

// ------------------------------------------------------------------------------------------------
// 9.2 the Watchdog: laid outside the system, its sightline sweeping, the stuck bay, the flag

/** The Watchdog's sheet unrolls from its west edge on `watchdog`. */
export const WATCH_LAY = BEAT_9.watchdog;
/**
 * Its beam: out of the lens (4 f), a sweep across the stuck bay (20 f), held, the sweep back onto the flag (20 f, a little
 * past and back), drawn back into the lens once its marks are drawn. `amp` (radians either side of the flag): the station
 * stands just south of the bay (summary.ts WATCHDOG), so its short beam swings wide, inside the arc of ticks its turntable
 * draws (±0.54), its tip passing over the bay's south wall and its east end.
 */
export const BEAM = { out: BEAT_9.sweeps[0] - 6, outFrames: 6, sweeps: BEAT_9.sweeps, frames: BEAT_9.sweepFrames, amp: 0.48, back: [BEAT_9.flag + 8, BEAT_9.flag + 14] as const } as const;
/**
 * Out past the target and back onto it, from rest and to rest (0 at 0, 1 at 1, both ends still): an ease in and out with a
 * swell that carries it about 3.5% past the target near the end and settles it back (never a start at full speed).
 */
const settleOnto = (t: number): number => {
  const u = clamp(t);
  return sine(u) + 0.6 * Math.sin(Math.PI * u) ** 2 * u * u;
};
/** A sweep's run at f from its cue: its first frame of motion on the cue, a visible step (the ease's second frame), done 18 f later. */
const sweepT = (f: number, s: number): number => (f < s ? 0 : clamp((f - s + 2) / BEAM.frames));
export interface Beam {
  /** its turn about the lens from still (d)'s aim (radians, + anticlockwise) */
  a: number;
  /** its length (0 in the lens .. 1 to the flag's ring) */
  len: number;
}
export function beamAt(f: number): Beam | null {
  if (f < BEAM.out || f >= BEAM.back[1]) return null;
  const [s1, s2] = BEAM.sweeps;
  const A = BEAM.amp;
  let a: number;
  if (f < s1) a = -A;
  else if (f < s2) a = -A + 2 * A * sine(sweepT(f, s1));
  // the sweep back eases onto the flag a hair past it and settles on it, before the flag's frame
  else a = A * (1 - settleOnto(sweepT(f, s2)));
  // (out of the lens easing in and out over 6 f, wholly out on the frame before the first sweep, as before)
  const len = Math.min(sine((f - BEAM.out + 1) / BEAM.outFrames), 1 - sine((f - BEAM.back[0]) / (BEAM.back[1] - BEAM.back[0])));
  return { a, len };
}
/** Still (d)'s sightline on the Watchdog's sheet (its two dashed edges from the lens out, then the ring round the flag), drawn as the beam settles on the flag. */
export const MARKS = { from: BEAT_9.flag + 1, to: BEAT_9.flag + 9 } as const;
export const marksAt = (f: number): number => clamp((f - MARKS.from) / (MARKS.to - MARKS.from));
/** The pencil flag: its staff drawn down into the nameplate band, pinned on `flag` (drawn over the 4 f before), its pennant drawn out after it. */
export const FLAG_DRAW = { from: BEAT_9.flag - 4, pin: BEAT_9.flag, to: BEAT_9.flag + 6 } as const;
export const flagAt = (f: number): number => clamp((f - FLAG_DRAW.from) / (FLAG_DRAW.to - FLAG_DRAW.from));

/**
 * The stuck bay's card drum (objects/Bay.tsx FreshParts): on every beat from `stuck.from` it steps a sixteenth of a turn on (about two cards; out, 4 f)
 * and back (from the half beat, 4 f), never round: the damped two-note loop. Radians about its axle.
 */
export const DRUM = { step: (Math.PI * 2) / 16, out: 4, back: 4, half: 10 } as const;
export function drumAt(f: number): number {
  const { from, to } = BEAT_9.stuck;
  let a = 0;
  for (let b = from; b < to; b += 20) {
    // (its first move on the beat itself: x is 1 on the beat's frame, 20 on its last)
    const x = f - b + 1;
    if (x <= 0 || x > 20) continue;
    a += DRUM.step * (sine(x / DRUM.out) - sine((x - DRUM.half) / DRUM.back));
  }
  return a;
}

// ------------------------------------------------------------------------------------------------
// The state

export interface Beat9State {
  f: number;
  /** the machines rising through their hatches (null once all are up and their holes shut) */
  machines: MachineRise[] | null;
  strut: StrutPose | null;
  queued: QueuedSlip | null;
  beam: Beam | null;
  /** the stuck bay's card drum (radians) */
  drum: number;
}
/** DeskState.e9: beat 9's movers, from bar 58 to bar 63. */
export function beat9At(f: number): Beat9State | null {
  if (f < BEAT_9.away || f >= BEAT_10.hatch.spout - 2) return null;
  const machines = f < MACHINE_RISE[2].rise[1] + LEAF_FRAMES ? MACHINES_9.map((_, i) => machineRiseAt(i, f)) : null;
  return { f, machines, strut: strutAt(f), queued: queuedAt(f), beam: beamAt(f), drum: drumAt(f) };
}

/**
 * The proposed parts' pose (objects/Proposed.tsx's `state` prop). Proposed draws still (d)'s static pose for a null state
 * (the summary's mount), so every part ends exactly as the signed-off still draws it.
 */
export interface ProposedState extends Proposed10 {
  f: number;
  /** each sheet laid (0..1 of its unroll from its west edge) */
  lay: { plan: number; cabinet: number; loop: number; tethers: number; watch: number };
  /** the machines: each one's base under the slate (u, <= 0) */
  dz: readonly number[];
  /** the loop sheet's strut and plate pictograms (0..1 inked; the plate's offset north of its dock, null before it shows) */
  strutInk: number;
  plate: number | null;
  /** the tethers' dash phase (u), each strip's own */
  march: readonly number[];
  /** the server's work light (0..1 of EMIT.slotDocs), and how far its slit is open (0 a line .. 1) */
  lamp: number;
  lampOpen: number;
  /** the Watchdog's sightline marks (0..1), its pencil flag (0..1) */
  marks: number;
  flag: number;
}
/** The proposed parts at a film frame in act two's world (from beat 9 on), null where act two draws none of them. */
export function proposedAt(f: number): ProposedState | null {
  if (f < LAYS.plan || f >= SEAM) return null;
  return {
    f,
    lay: { plan: layAt(f, LAYS.plan), cabinet: layAt(f, LAYS.cabinet), loop: layAt(f, LAYS.loop), tethers: layAt(f, LAYS.tethers), watch: layAt(f, WATCH_LAY) },
    dz: MACHINES_9.map((_, i) => machineRiseAt(i, f).dz),
    strutInk: strutInkAt(f),
    plate: plateAt(f),
    march: MACHINES_9.map((_, i) => marchAt(i, f)),
    lamp: machineLampAt(f),
    lampOpen: lampOpenAt(f),
    marks: marksAt(f),
    flag: flagAt(f),
    ...proposed10(f),
  };
}

// ------------------------------------------------------------------------------------------------
// The hooks

/**
 * Focus. Bar 58 takes over from beat 8's 'b8-away' (the same set: nothing comes up or goes down on the hand-over, your desk
 * never steps): everything of the system stays down while the vellum is laid and the strut flies. Under N8 the stuck bay
 * comes up (its drum and its light are the action), from 30 f before the first sweep ('b9-watch'); once it is up, the rest
 * of the vellum and the tests bay step down too ('b9-n8', the hand-over adding them: nothing else moves), so the Watchdog
 * (objects/Beat9.tsx WATCHDOG_STEP_ID: its station, its sightline, its flag) and the stuck bay hold the frame's top
 * contrast through both sweeps and the flag; a beat after the flag's beam is back in its lens they come back up ('b9-etch'
 * dropping them) for 10.1's hijack along the vellum tethers, which holds the rest down, releasing it as bar 65's dolly
 * sets out onto the Register.
 */
export const B9_STEP = ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'freshBay', 'cord', 'reel', 'lock', 'gauge', 'head', 'index', 'mouth', 'deck', 'chute', 'proactive', 'spike', 'stress', 'jaws', 'bosses', 'b7-rail', 'b7-plate'] as const;
export const WATCH_FROM = BEAT_9.sweeps[0] - 34;
/** N8's hold on the Watchdog and the stuck bay: from 'b9-watch''s full step to a beat after the beam is back (BEAM.back). */
export const N8_HOLD = { from: WATCH_FROM + 14, to: BEAT_9.flag + 30 } as const;
const WATCH_STEP = B9_STEP.filter((x) => x !== 'freshBay');
export const FOCUS_9: readonly FocusEntry[] = [
  { id: 'b9', from: BEAT_9.away, to: WATCH_FROM, step: B9_STEP, handFrom: 'b8-away' },
  { id: 'b9-watch', from: WATCH_FROM, to: N8_HOLD.from, step: WATCH_STEP, handFrom: 'b9' },
  { id: 'b9-n8', from: N8_HOLD.from, to: N8_HOLD.to, step: [...WATCH_STEP, 'testsBay', 'b9-proposed'], handFrom: 'b9-watch' },
  { id: 'b9-etch', from: N8_HOLD.to, to: RELEASE, step: WATCH_STEP, handFrom: 'b9-n8' },
];
export const LAMP_9: readonly LampStep[] = [];
export const ARM_9: readonly ArmStep[] = [];
export function replies9(_e: Beat9State | null): ReplyState[] {
  return [];
}
export function cards9(_s: DeskState): CardUp[] {
  return [];
}

/** The strut's footprint in your tray (footprints.ts youFootprints: its recess's rect), carried with it from its lift frame: the same on that frame, its contact opening as it lifts, gone as it presses into the drawing. */
const STRUT_FP_H: P2 = [CHORES.strut.half[0], CHORES.strut.half[1]];
export function footprints9(s: DeskState): Footprint[] {
  const e = s.e9;
  const fp: Footprint[] = [];
  const st = e?.strut;
  if (st) {
    const z0 = TRAY_Z.floor + (st.c[2] - STRUT_REST[2]);
    const flat = 1 - st.morph;
    // (rectFp's own fields, so it is exactly youFootprints' recess rect on the lift frame)
    const base = rectFp({ x0: st.c[0] - STRUT_FP_H[0], x1: st.c[0] + STRUT_FP_H[0], y0: st.c[1] - STRUT_FP_H[1], y1: st.c[1] + STRUT_FP_H[1] }, z0, z0 + 8 * flat, 0.7 * clamp(1 - st.lift / 3) * flat, 4);
    if (flat > 0.02 && base.kind === 'rect') fp.push({ ...base, rot: st.yaw });
  }
  return fp;
}
export function pools9(_s: DeskState): Pool[] {
  return [];
}
/**
 * The proposed tag (C24, N8: cue 'tag-proposed', from bar 59 once bar 58's ease-out has settled at still (d)'s framing):
 * upper right inside title-safe, its leader straight down from under its block onto the north edge of the vellum plan of
 * the deck, the first sheet laid (it qualifies every vellum part east of the system).
 */
export const TAGS_9: readonly TagSpec[] = [{ cue: 'tag-proposed', words: WORDS.tagProposed, at: [1824, 96], anchor: 'end', foot: [990, 530, 0.4] }];
export function you9(_f: number, pose: YouPose): YouPose {
  return pose;
}
