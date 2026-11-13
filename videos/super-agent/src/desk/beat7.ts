/**
 * Beat 7, waiting, handed over (STORYBOARD 7.1-7.4, film f3440-3919; cues.ts BEAT_7): what the beat's parts do at a film
 * frame. Pure: every value is a function of the frame and the cue sheet's beat-7 events, which the score sounds on the
 * same frames (audio/waiting.ts), so each contact frame below is the frame the picture's event lands on.
 *
 * - 7.1 the Thread (C17): on `cord-out` the request's Thread cord pays out of the chat spool along its final path (layout.ts
 *   CORDS, still (d)'s shape) at 1400 u/s, its end bead leading: the spool takes its vermilion as the cord (its twist
 *   streaming out of it), the guide's arm slides out of the deck's east rail and its post telescopes up before the cord reaches it,
 *   the terminal rises out of the bay's north wall with the Thread's gate (two leaves on the wall top between a post and
 *   the terminal) before the bead docks in it (`cordTaut`). The cord comes out with a droop added to its final shape (8%
 *   of each span, 4.5% over the Continuous plate so it never touches it) that settles to 3% by `cordSettled` and is
 *   gone under bar 50's move, so the cord ends exactly as still (d) draws it (Links.tsx Cords, from the seam on). A
 *   follow-up (a chat slip of the spout's size, #0405 printed on it: the request's Thread) leaves the chat spout, is
 *   posted round the spool's south side and up under the cord, and clips on (2 f; a pluck runs the cord: 8 u, ζ 0.35,
 *   2.5 Hz). It rides it like a cable car (hung by its leading corner, to the right of its way) at about 900 px/s, crosses
 *   the guide on `flyover` (the bypass: a vermilion notice prints on the tape beside the Thread's row; the index makes no
 *   detent), swings round level as it slows down the cord's descent, and stops at the cord's end. The gate has swung open
 *   for it 4 f before: it slides over the wall top through the open gate (it goes straight to its Worker), drops onto the
 *   work slot, lies there for a beat and is fed into the slit on its edge.
 * - 7.2 (C18): the Router's decision tally feeds out from under the reel frame's north-west boss on `tally`, a tick on
 *   every beat after it (follow-ups add none); a grey-stock ghost tally (the count without pass-through, 1.3x as long, its
 *   follow-ups' decisions marked) rises under it for a beat, is struck and slides away. The bug bay stays up while it plays
 *   (its pins keep their pace). The tally feeds back in as C18 ends.
 * - 7.3 (N7): a one-beat ghost (the bay with its long job in the slot, the gate shut, a follow-up waiting outside on the
 *   cord) rises beside the bay, is struck and goes; the job rail rises out of a slate hatch south of the bay; the long test
 *   rises out of the work slot (4 f), crouches (3 f anticipation) and on `job-peel` arcs 10 f onto the rail's oval track,
 *   its "started" receipt pushed up out of the shelf to stand on `job-receipt`, and runs a lap of the oval (the background)
 *   while the second follow-up arrives on the cord and is through the open gate within 2 f. On the same frame the
 *   sand-glass lifts off your tray (the chore hand-over grammar: 4 f anticipation, a 10 f rise, the arc, the dock), taking
 *   still (d)'s body in flight, and docks on the shelf where still (d) keeps it; the Productive plate rises out of its
 *   slate hatch west of the rail and docks; your lamp dims a step. On `job-dock` the capsule docks back into the slot as an
 *   event (8 f) and sinks into it, the receipt sinks back into the shelf, and the oval sinks into its hatch: the station
 *   is still (d)'s shelf from then on.
 * - 7.4: the index turns west; a short chat reply with an enamel "≤ 100" stop tab rides the chute into your in-tray
 *   (state.ts replyRideAt; your lamp up a step as it lands); a heavy tabbed dossier (half as large again as the reply) is
 *   pushed out from under the deck's west rail, flies heavy to the card feeder's mouth (the repo port), thuds onto it
 *   (its squash over 3 f, spring-heavy's settle) and is pushed in. No sender line.
 *
 * The world from the summary on (summary.ts SEAM_D) draws its own end state (objects/Trace.tsx: the shelf, the glass, the
 * plate; Links.tsx the cord): `beat7At` is null from E7.until (SEAM_D) and the objects draw nothing there.
 *
 * Import rule: state.ts, footprints.ts and pools.ts import this module, so its module-level tables take values only from
 * leaf modules (cues.ts, layout.ts, springs.ts, fpKit.ts, you.ts, camera.ts); values from state.ts, beat4.ts and beat6.ts
 * are used inside functions only (types from anywhere).
 */
import { clamp, easings } from '@aiv/core';
import { CatmullRomCurve3, Vector3 } from 'three';
import { BEAT_7, WORDS, at } from '../cues.ts';
import { FRAMING_B, deskCamera, project, screenToDesk } from './camera.ts';
import type { CardUp, CardSpot } from './beat4.ts';
import { CARD_RISE, cardAt, cardSize } from './beat4.ts';
import { LIGHT_HEX, carrierSpan, circleFp, polySegs, rectFp, segFp, tint, type Footprint } from './fpKit.ts';
import { BAYS, CORDS, DECK, FEEDERS, MAST, NEXT_SLIP, REEL_FRAME, REEL_FRAME_Z, SPOOL, TAPE, YOU, rectC, type P3, type Pool, type Rect } from './layout.ts';
import type { TagSpec } from './Overlay.tsx';
import { SPRING, STEP_FRAMES, springAt } from './springs.ts';
import { replyRideAt, type ArmStep, type DeskState, type FocusEntry, type FocusId, type LampStep, type ReplyState } from './state.ts';
import { CHORES, TRAY_Z, type YouPose } from './you.ts';

/** Whether beat 7 is built (false: the animatic's slate shows its cues' words and the "animatic" mark over its frames). */
export const BUILT = true;

/** In-out sine on 0..1 (never -0: a pose at rest is exactly the rest pose). */
const sine = (t: number): number => easings.inOutSine(clamp(t)) + 0;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerp3 = (a: P3, b: P3, t: number): P3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** A squash on a contact frame, decaying over the next frames (the film's grammar: never a one-frame blip). */
const squashAt = (f: number, contact: number, amount: number, frames = 4): number => (f < contact ? 0 : amount * Math.max(0, 1 - (f - contact) / frames));

/** Beat 7's own frames (film frames), hung off the cue sheet's. */
export const E7 = {
  cordOut: BEAT_7.cordOut,
  taut: BEAT_7.cordTaut,
  settled: BEAT_7.cordSettled,
  /** the guide's arm slides out of the deck's east rail, then its post telescopes up (the sheave on it) */
  arm: [BEAT_7.cordOut, BEAT_7.cordOut + 6] as const,
  post: [BEAT_7.cordOut + 4, BEAT_7.cordOut + 14] as const,
  /** the terminal and the gate rise out of the bay's north wall, up before the cord's end bead docks in the terminal */
  terminal: [BEAT_7.cordTaut - 16, BEAT_7.cordTaut - 7] as const,
  /** the gate's leaves swing open, done 4 f before the first follow-up arrives (the door stays open) */
  gateOpen: [BEAT_7.riders[0].arrive - 10, BEAT_7.riders[0].arrive - 4] as const,
  /** the spool takes its vermilion as the cord leaves it */
  colour: [BEAT_7.cordOut, BEAT_7.cordOut + 6] as const,
  /** the droop's last 3% goes under bar 50's camera move (the cord ends as still (d) draws it, never creeping on a hold) */
  slack: [at(50) + 2, at(50) + 62] as const,
  /** the summary's world draws the beat's end state itself from the seam (summary.ts SEAM_D; beat7.test holds them equal) */
  until: 5424,
} as const;

// ------------------------------------------------------------------------------------------------
// 7.1 the Thread cord: its path, the payout, the droop, the pluck

/** The cord's centre line, as still (d) draws it (geom.ts twistedPair over CORDS.vermilion: a centripetal Catmull-Rom). */
const CORD_CURVE = new CatmullRomCurve3(
  CORDS.vermilion.map((p) => new Vector3(p[0], p[1], p[2])),
  false,
  'centripetal',
);
/** The cord's length along its curve (u). */
export const CORD_L = CORD_CURVE.getLength();
/** The arc length of control point i (by bisection on the curve's own arc-length map). */
function arcOfPoint(i: number): number {
  const t = i / (CORDS.vermilion.length - 1);
  let a = 0;
  let b = 1;
  for (let k = 0; k < 50; k++) {
    const m = (a + b) / 2;
    if (CORD_CURVE.getUtoTmapping(m, 0) < t) a = m;
    else b = m;
  }
  return ((a + b) / 2) * CORD_L;
}
/** Each control point's arc length (the footprints' polyline), and the guide's (the mast's sheave). */
export const CORD_S: readonly number[] = CORDS.vermilion.map((_, i) => (i === 0 ? 0 : i === CORDS.vermilion.length - 1 ? CORD_L : arcOfPoint(i)));
export const S_MAST = CORD_S[CORDS.vermilion.findIndex((p) => p[0] === MAST.x && p[1] === MAST.y)]!;

/** The payout's pace: 1400 u/s (STORYBOARD 7.1), gathering speed out of the spool and easing into the terminal. */
export const PAYOUT = { speed: 1400 / 30, accel: 3, decel: 3 } as const;
/** How far the cord has paid out at f (u along it; CORD_L once its end bead is docked in the terminal). */
export function cordHeadAt(f: number): number {
  const T = E7.taut - E7.cordOut;
  return CORD_L * trapezoid((f - E7.cordOut) / T, PAYOUT.accel / T, PAYOUT.decel / T);
}
/** A run 0..1 over t 0..1 at a trapezoid of speed: up over `a`, even, down over `d` (C1). */
function trapezoid(t: number, a: number, d: number): number {
  const x = clamp(t);
  const v = 1 / (1 - a / 2 - d / 2);
  if (x < a) return (v * x * x) / (2 * a);
  if (x <= 1 - d) return v * (x - a / 2);
  const y = 1 - x;
  return 1 - (v * y * y) / (2 * d);
}

/**
 * The droop's share of a span: 8% out of the spool, settled to 3% over 16 f (cordSettled), gone under bar 50's move. The
 * spool's span (over the Continuous plate) takes two thirds of it, never more than 4.5% (its belly 6 u over the plate).
 */
export const SAG = { out: 0.08, active: 0.03, plate: 0.045, spool: 2 / 3 } as const;
/** The droop's ratio at f (of each span's length): the settle a damped half swing that lands on 3% on cordSettled and stays. */
export function sagAt(f: number): number {
  if (f < E7.cordOut) return SAG.out;
  const u = clamp((f - E7.taut) / (E7.settled - E7.taut));
  // past 3% by a hair at two thirds of the way and back (spring-settle's look), exactly 3% from cordSettled
  const k = sine(u) + 0.06 * Math.sin(Math.PI * u) * u;
  const settle = SAG.out + (SAG.active - SAG.out) * k;
  return settle * (1 - sine((f - E7.slack[0]) / (E7.slack[1] - E7.slack[0])));
}
/** The pluck (TREATMENT Relationships, Threads): 8 u, ζ 0.35, 2.5 Hz, sideways (it reads from above), across the spool's span. */
export const PLUCK = { amp: 8, zeta: 0.35, hz: 2.5 } as const;
/** The pluck's sideways throw at mid-span at f: one per follow-up clipping on. */
export function pluckAt(f: number): number {
  const w = 2 * Math.PI * PLUCK.hz;
  const wd = w * Math.sqrt(1 - PLUCK.zeta * PLUCK.zeta);
  let d = 0;
  for (const r of BEAT_7.riders) {
    const t = (f - r.clipOn) / 30;
    if (t <= 0 || t > 1.2) continue;
    d += PLUCK.amp * Math.exp(-PLUCK.zeta * w * t) * Math.sin(wd * t);
  }
  return d;
}

/** The cord's shape at a frame: how far it has paid out, its droop's ratio, the pluck's throw. */
export interface CordState {
  head: number;
  sag: number;
  pluck: number;
}
export const cordAt = (f: number): CordState => ({ head: cordHeadAt(f), sag: sagAt(f), pluck: pluckAt(f) });
/** The cord at rest in its final shape (still (d)): what Links.tsx Cords draws. */
export const cordStatic = (c: CordState): boolean => c.head >= CORD_L && c.sag === 0 && c.pluck === 0;

/** The droop (u, downward) at arc length s for a cord state: a sine belly in each span between its supports (the spool, the guide, the end bead). */
export function droopAt(s: number, c: CordState): number {
  if (c.sag === 0) return 0;
  const head = Math.min(c.head, CORD_L);
  const span = (a: number, b: number, ratio: number) => (b - a > 1 && s > a && s < b ? ratio * (b - a) * Math.sin((Math.PI * (s - a)) / (b - a)) : 0);
  return span(0, Math.min(head, S_MAST), Math.min(c.sag * SAG.spool, SAG.plate)) + (head > S_MAST ? span(S_MAST, head, c.sag) : 0);
}
/** The pluck's sideways throw at arc length s: a standing wave over the spool's span. */
export const pluckOffset = (s: number, c: CordState): number => (c.pluck !== 0 && s > 0 && s < S_MAST ? c.pluck * Math.sin((Math.PI * s) / S_MAST) : 0);

const V = new Vector3();
/** The cord's centre at arc length s (its final curve), and its plan tangent's unit vector. */
export function cordBase(s: number): { p: P3; t: readonly [number, number] } {
  const u = clamp(s / CORD_L);
  CORD_CURVE.getPointAt(u, V);
  const p: P3 = [V.x, V.y, V.z];
  CORD_CURVE.getTangentAt(u, V);
  const l = Math.hypot(V.x, V.y) || 1;
  return { p, t: [V.x / l, V.y / l] };
}
/** The cord's centre at arc length s under a state: its final curve, drooped, plucked sideways. */
export function cordPoint(s: number, c: CordState): P3 {
  const { p, t } = cordBase(s);
  const d = pluckOffset(s, c);
  // the pluck throws it to the right of its way (south over the spool's span)
  return [p[0] + t[1] * d, p[1] - t[0] * d, p[2] - droopAt(s, c)];
}

// ------------------------------------------------------------------------------------------------
// 7.1 the guide, the terminal and its gate, the spool

/** The guide (Links.tsx's bracket, post and sheave): how far its arm is out of the rail and its post up (0..1 each). */
export function guideAt(f: number): { arm: number; post: number } {
  return { arm: easings.outCubic(clamp((f - E7.arm[0]) / (E7.arm[1] - E7.arm[0]))), post: sine((f - E7.post[0]) / (E7.post[1] - E7.post[0])) };
}
/** The terminal on the bay's north wall: how far it has risen out of the wall's top (0..1). */
export const terminalAt = (f: number): number => easings.outCubic(clamp((f - E7.terminal[0]) / (E7.terminal[1] - E7.terminal[0])));
/**
 * The Thread's gate: the door at the cord's end, on the bug bay's north wall top between a steel post (west, just east of
 * the bay's own door) and the terminal (east). Two enamel leaves meet in its middle when shut; each swings north about
 * its post, 90° open. It rises out of the wall with the terminal, shut, and swings open before the first follow-up
 * arrives; it stays open (the door ghost shows it shut). Units: the wall's top is z 40.
 */
export const GATE = { x0: BAYS.bug.door[1] + 3, x1: CORDS.vermilion[CORDS.vermilion.length - 1]![0] - 5, y: BAYS.bug.box.y1 - BAYS.bug.wall / 2, z0: BAYS.bug.wallH + 4, z1: BAYS.bug.wallH + 12, t: 10, postR: 3.4, postTop: BAYS.bug.wallH + 20 } as const;
export const GATE_LEAF = (GATE.x1 - GATE.x0) / 2;
/** How deep the gate waits in the wall before it rises with the terminal (its post's top under the wall's top). */
export const GATE_RISE = 24;
/** The gate at f: how far it has risen with the terminal (0..1) and how far its leaves are open (0 shut .. 1 swung north). */
export const gateAt = (f: number): { rise: number; open: number } => ({ rise: terminalAt(f), open: sine((f - E7.gateOpen[0]) / (E7.gateOpen[1] - E7.gateOpen[0])) });
/**
 * The spool: its vermilion (0 rubber .. 1), taken over 6 f as the cord leaves it. It does not turn (objects/Intake.tsx: its
 * top flange's windows are cut about the wrong centre, out of frame, and a turn swings their walls into view): the cord's
 * twist streaming out of it carries the payout.
 */
export function spoolAt(f: number): { colour: number } {
  return { colour: sine((f - E7.colour[0]) / (E7.colour[1] - E7.colour[0])) };
}

// ------------------------------------------------------------------------------------------------
// 7.1, 7.3 the follow-ups riding the cord

/**
 * A follow-up: a chat slip of the spout's own size (layout.ts NEXT_SLIP, 96 x 40), its print the request's ID (#0405, as
 * the reply #0408 is printed: gl/print7.ts) and the Thread's vermilion rim. Its clip hangs it by its leading corner (`hook`,
 * in the slip's own frame: x along it, y to its left), `hang` under the cord: so it rides to the right of its way and
 * trails, the cord never over its print.
 */
export const RIDER = { l: NEXT_SLIP.l, w: NEXT_SLIP.w, hook: [42, 24] as const, hang: 18 } as const;
/** It clips on this far along the cord from the spool: the slip trails its hook by 80 u, so its trailing end is well clear of the spool's flange (r 30). */
export const CLIP_S = 136;
/** The post from the spout: a curve round the spool's south side (its control point), up under the cord. */
const POST = { out: 5, via: [SPOOL.x - 4, SPOOL.y - 96] as const, hump: 26 } as const;
/** The ride: up to speed over this many frames from the clip's closing; the swing round level on the cord's descent (frames before arrival). */
const RIDE_ACCEL = 4;
const LEVEL = 12;
/** The wall the follow-up crosses (the bug bay's north wall) and the slot it lands on. */
const WALL = { y0: BAYS.bug.box.y1 - BAYS.bug.wall, y1: BAYS.bug.box.y1, top: BAYS.bug.wallH } as const;
/** The slot's top (Bay.tsx: the work slot's block, its lit slit at 30.3) and where a follow-up lies on it, along the slit, its east end clear of the terminal. */
const SLOT_TOP = 30.4;
/** The slit's steel lip stands to 32 (Bay.tsx slitLip): a follow-up lies on it. */
const SLOT_LIP = 32;
export const SLOT_LIE: P3 = [GATE.x1 - 1 - RIDER.l / 2, rectC(BAYS.bug.slot)[1] - 4, SLOT_LIP + 0.7];
/** How high it slides over the wall top (clear of the terminal's top and the open leaves), then drops onto the slot. */
const OVER_Z = GATE.z1 + 7;

/** Where its hook is (u along the cord) when it stops at the cord's end: its south edge 4 u north of the wall, level (heading 0). */
export const STOP_S = (() => {
  let a = S_MAST;
  let b = CORD_L;
  for (let k = 0; k < 60; k++) {
    const m = (a + b) / 2;
    if (cordBase(m).p[1] - RIDER.hook[1] - RIDER.w / 2 > WALL.y1 + 4) a = m;
    else b = m;
  }
  return a;
})();

/** Each follow-up's frames past its arrival: the slide over the wall (it is through the gate on `enter`), the drop, a beat on the slot, fed in on its edge. */
export const ENTRY = BEAT_7.riders.map((r) => {
  const slide = r.enter + 2;
  const land = slide + 3;
  const feed = land + 18;
  return { slide, land, feed, tip: feed + 4, gone: feed + 9 };
});

export interface RiderPose {
  i: number;
  /** the slip's centre, heading (about z), nose-down slope (about its local y: the swing about the hook while it rides), roll about its length */
  p: P3;
  heading: number;
  slope: number;
  roll: number;
  /** its clip's hook: how far it is closed over the cord (0 open .. 1 closed; drawn in the slip's own frame); its rod folded flat along the slip (0 up .. 1) */
  close: number;
  fold: number;
  squash: number;
}
/** A bump 0..1..0 over x 0..1 (the swing as the rider gathers speed and as it slows). */
const bump = (x: number): number => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
/** Its swing on the ride (back as it gathers speed, forward as it slows): what it still has on arrival is let go as the clip opens. */
const swingAt = (r: (typeof BEAT_7.riders)[number], f: number): number => -0.22 * bump((f - r.clipOn) / 12) + 0.2 * bump((f - (r.arrive - 7)) / 12);

/** The arc length a rider's hook is at, frame f (from its clip-on to its stop): up to speed, even, crossing the guide on its cue, slowing to stop on arrival. */
export function rideS(r: (typeof BEAT_7.riders)[number], f: number): number {
  const t0 = r.clipOn + 1;
  const v = (S_MAST - CLIP_S) / (r.guide - t0 - RIDE_ACCEL / 2);
  const dec = 2 * (r.arrive - r.guide - (STOP_S - S_MAST) / v);
  const t = f - t0;
  if (t <= 0) return CLIP_S;
  if (t < RIDE_ACCEL) return CLIP_S + (v * t * t) / (2 * RIDE_ACCEL);
  const tStop = r.arrive - t0;
  if (t < tStop - dec) return CLIP_S + v * (t - RIDE_ACCEL / 2);
  if (t >= tStop) return STOP_S;
  const y = tStop - t;
  return STOP_S - (v * y * y) / (2 * dec);
}
/** The slip's centre hung from its hook at `q` (the hook in the slip's frame: RIDER.hook), at a heading, swung by `swing` about the hook's cross axis. */
function hangFrom(q: P3, heading: number, swing: number): P3 {
  const [hx, hy] = RIDER.hook;
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  // the hook's offset from the slip's centre, rotated to the heading; the slip hangs `hang` below it, swung back along its way
  const along = -RIDER.hang * Math.sin(swing);
  const down = RIDER.hang * Math.cos(swing);
  return [q[0] - (c * hx - s * hy) + c * along, q[1] - (s * hx + c * hy) + s * along, q[2] - down];
}
/** The heading it rides at on the cord at arc length s (the cord's plan tangent), swung round level (0) over the last stretch of the descent. */
function rideHeading(r: (typeof BEAT_7.riders)[number], f: number, s: number): number {
  const t = cordBase(s).t;
  const h = Math.atan2(t[1], t[0]);
  return h + (0 - h) * sine((f - (r.arrive - LEVEL)) / LEVEL);
}
/** Where its clip is when it closes (the post's end): hung at CLIP_S, along the cord. */
const clipPose = (f: number): { p: P3; heading: number } => {
  const q = cordPoint(CLIP_S, cordAt(f));
  const t = cordBase(CLIP_S).t;
  const heading = Math.atan2(t[1], t[0]);
  return { p: hangFrom(q, heading, 0), heading };
};

/** A follow-up at f: null before it leaves the spout and once it is fed into the slot. */
export function riderAt(i: number, f: number): RiderPose | null {
  const r = BEAT_7.riders[i]!;
  const E = ENTRY[i]!;
  if (f < r.spout || f >= E.gone) return null;
  const c = cordAt(f);
  const clip = clipPose(r.clipOn - 2);
  if (f < r.clipOn - 2) {
    // out of the chat drum's spout (5 f), then posted round the spool's south side and up under the cord, turning to its way
    const inDrum: P3 = [NEXT_SLIP.spout[0] - 70, NEXT_SLIP.spout[1], NEXT_SLIP.spout[2]];
    if (f < r.spout + POST.out) return { i, p: lerp3(inDrum, NEXT_SLIP.spout, easings.outCubic((f - r.spout) / POST.out)), heading: 0, slope: 0, roll: 0, close: 0, fold: 0, squash: 0 };
    const u = (f - r.spout - POST.out) / (r.clipOn - 2 - r.spout - POST.out);
    const w = sine(u);
    const a = NEXT_SLIP.spout;
    const b = clip.p;
    const [vx, vy] = POST.via;
    // a quadratic curve through the control point south of the spool, its height eased up with a small hump
    const x = (1 - w) * (1 - w) * a[0] + 2 * (1 - w) * w * vx + w * w * b[0];
    const y = (1 - w) * (1 - w) * a[1] + 2 * (1 - w) * w * vy + w * w * b[1];
    const z = lerp(a[2], b[2], w) + POST.hump * Math.sin(Math.PI * w);
    return { i, p: [x, y, z], heading: clip.heading * w, slope: 0.18 * Math.sin(Math.PI * u), roll: 0, close: 0, fold: 0, squash: 0 };
  }
  if (f <= r.arrive) {
    // the clip closes over the cord (2 f), then it rides, swinging back as it gathers speed and forward as it slows, round level on the descent
    const s = rideS(r, f);
    const swing = swingAt(r, f);
    const heading = rideHeading(r, f, s);
    const q = cordPoint(s, c);
    return { i, p: hangFrom(q, heading, swing), heading, slope: swing, roll: 0, close: clamp((f - (r.clipOn - 2)) / 2), fold: 0, squash: 0 };
  }
  // its stop pose, the swing it has on arrival let go as the clip opens and it slides off
  const sw = swingAt(r, r.arrive);
  const stop = hangFrom(cordPoint(STOP_S, c), 0, sw);
  if (f < E.slide) {
    // off the cord: the clip opens (2 f) and it slides south over the wall top through the open gate, level, at OVER_Z
    const u = (f - r.arrive) / (E.slide - r.arrive);
    const e = sine(u);
    const over: P3 = [SLOT_LIE[0], WALL.y0 - RIDER.w / 2 - 1, OVER_Z];
    return { i, p: [lerp(stop[0], over[0], e), lerp(stop[1], over[1], e), lerp(stop[2], over[2], e)], heading: 0, slope: sw * (1 - e), roll: 0, close: 1 - clamp(u * 2), fold: sine(u * 2 - 1), squash: 0 };
  }
  if (f < E.land) {
    // the drop onto the slot (3 f, gathering speed)
    const u = (f - E.slide) / (E.land - E.slide);
    return { i, p: [SLOT_LIE[0], lerp(WALL.y0 - RIDER.w / 2 - 1, SLOT_LIE[1], sine(u)), lerp(OVER_Z, SLOT_LIE[2], u * u)], heading: 0, slope: 0, roll: 0, close: 0, fold: 1, squash: 0 };
  }
  if (f < E.feed) return { i, p: SLOT_LIE, heading: 0, slope: 0, roll: 0, close: 0, fold: 1, squash: squashAt(f, E.land, 0.04) };
  // fed in: it stands up on its long edge over the slit (4 f), then sinks into it (5 f)
  const slitY = rectC(BAYS.bug.slot)[1];
  if (f < E.tip) {
    const u = sine((f - E.feed) / (E.tip - E.feed));
    return { i, p: [SLOT_LIE[0], lerp(SLOT_LIE[1], slitY, u), SLOT_LIE[2] + (RIDER.w / 2) * Math.sin((Math.PI / 2) * u)], heading: 0, slope: 0, roll: (Math.PI / 2) * u, close: 0, fold: 1, squash: 0 };
  }
  const w = clamp((f - E.tip) / (E.gone - 1 - E.tip));
  return { i, p: [SLOT_LIE[0], slitY, SLOT_LIE[2] + RIDER.w / 2 - (RIDER.w + 4) * easings.inQuad(w)], heading: 0, slope: 0, roll: Math.PI / 2, close: 0, fold: 1, squash: 0 };
}

/**
 * The notices on the tape, in the gap between the window's last stub and the Thread's row (the stubs east of the window
 * lie at x 15-33 and 51-69 once beat 6's review has advanced them; the Thread's row at 74-104): a graphite row rule and,
 * for each follow-up crossing the guide, a vermilion bubble (the Thread's colour), inked over 3 f from the crossing (the
 * tape never moves: no detent). Its north end lies under the reel's flange.
 */
export const NOTICES: readonly { x: number; y: number; w: number; h: number; f: number }[] = [
  { x: 42, y: (TAPE.y0 + TAPE.y1) / 2, w: 14, h: TAPE.y1 - TAPE.y0, f: BEAT_7.riders[0].guide },
  { x: 42, y: (TAPE.y0 + TAPE.y1) / 2 + 4, w: 14, h: 16, f: BEAT_7.riders[1].guide },
];
export const noticeInk = (f: number): number[] => NOTICES.map((n) => clamp((f - n.f + 1) / 3));

// ------------------------------------------------------------------------------------------------
// 7.2 the decision tally and its ghost

/** The tally strip, raised over the reel frame's north member's cap (its own paper and a shade edge), fed east out from under its north-west boss. */
export const TALLY = {
  /** where it comes out (the boss's east side) and its line (the member's middle); its underside over the cap's top (143) */
  x0: REEL_FRAME[1].x0 + 19,
  y: (REEL_FRAME[1].y0 + REEL_FRAME[1].y1) / 2,
  z: REEL_FRAME_Z[1] + 3.6,
  t: 1.4,
  w: 20,
  /** a tick's pitch, five to a group (four strokes and the fifth across them), the gap between groups, the strip's lead */
  pitch: 7,
  gap: 10,
  lead: 6,
  /** the ticks it carries as it prints, one more on every beat after (decisions); the ghost's (the count without pass-through) */
  first: 20,
  ticks: [3580, 3600, 3620, 3640, 3660, 3680],
  ghost: 30,
  /** it feeds out over this many frames from the frame before `tally`, and back in as C18 ends */
  feed: 9,
  back: [3674, 3688] as const,
} as const;
/** The strip's length (u) carrying n ticks. */
export const tallyLength = (n: number): number => {
  const groups = Math.floor(n / 5);
  const rest = n % 5;
  return TALLY.lead + groups * (5 * TALLY.pitch + TALLY.gap) + rest * TALLY.pitch + 2;
};
/** The tally at f: the ticks printed and the length fed out (null before it starts and once it is back in). */
export function tallyAt(f: number): { n: number; len: number } | null {
  const p = BEAT_7.tally.print - 1;
  if (f <= p || f >= TALLY.back[1]) return null;
  const n = TALLY.first + TALLY.ticks.filter((t) => f >= t).length;
  // its first ticks feed out (in-out, so its first frame shows its lead peeping out from under the boss); each new tick
  // feeds the strip on by one group's pitch over 2 f (the tick printed under the boss as it feeds)
  let len = tallyLength(TALLY.first) * sine((f - p) / TALLY.feed);
  TALLY.ticks.forEach((t, k) => (len += (tallyLength(TALLY.first + k + 1) - tallyLength(TALLY.first + k)) * sine((f - t + 1) / 2)));
  len *= 1 - sine((f - TALLY.back[0]) / (TALLY.back[1] - TALLY.back[0]));
  return { n, len };
}

/** The two counterfactual cards: the ghost tally under the real one (7.2), the shut gate beside the bay (7.3). */
export const CARDS_7 = {
  tally: { rise: BEAT_7.tally.ghostRise, strike: BEAT_7.tally.ghostStrike },
  door: { rise: BEAT_7.doorGhost.rise, strike: BEAT_7.doorGhost.strike },
} as const;
/** The card's tilt (beat4.ts CARD_SPOT) and how far it hovers (its own light: pools7). */
const CARD_Z = 240;
const CARD_TILT = 0.3;
/** A spot whose card's centre projects to the screen point `scr` (FRAMING_B at the film's 15° pitch; its `off`: SPOT_7). */
function spotAt(scr: readonly [number, number], w: number, h: number): CardSpot {
  const at = screenToDesk(deskCamera(FRAMING_B, 15), [scr[0], scr[1]], CARD_Z);
  return { at, off: at, w, h };
}
/** The ghost tally's card: the ghost strip (TALLY.ghost ticks, at the real strip's pitch on screen) on a strip of a card, a margin round it. */
export const TALLY_CARD = (() => {
  const w = Math.round(tallyLength(TALLY.ghost) * 0.98 + 44);
  return { w, h: 62, strip: { x0: -w / 2 + 22, y: -6 } };
})();
/** The door ghost's card: the bay in plan, its gate shut, the long job in its slot, one follow-up waiting outside on the cord. */
export const DOOR_CARD = { w: 280, h: 200 } as const;
/** Each card's place. */
const SPOT_AT: Record<'tally' | 'door', CardSpot> = {
  tally: (() => {
    // its ghost strip's west end 44 px under the real tally's on screen (FRAMING_B, 15°: the film's pitch)
    const pose = deskCamera(FRAMING_B, 15);
    const real = project(pose, [TALLY.x0, TALLY.y, TALLY.z]);
    let at: P3 = screenToDesk(pose, [real[0] + 100, real[1] + 46], CARD_Z);
    for (let i = 0; i < 3; i++) {
      const c = project(pose, at);
      const kx = (project(pose, [at[0] + 100, at[1], at[2]])[0] - c[0]) / 100;
      const ky = (c[1] - project(pose, [at[0], at[1] + 100 * Math.cos(CARD_TILT), at[2] + 100 * Math.sin(CARD_TILT)])[1]) / 100;
      at = screenToDesk(pose, [real[0] - TALLY_CARD.strip.x0 * kx, real[1] + 46 + TALLY_CARD.strip.y * ky], CARD_Z);
    }
    return { at, off: at, w: TALLY_CARD.w, h: TALLY_CARD.h };
  })(),
  // beside the bay, over the docs bay (W-09): the real gate, open, a hand's breadth east of it
  door: spotAt([1186, 548], DOOR_CARD.w, DOOR_CARD.h),
};

/**
 * Where each beat-7 card comes from (TREATMENT element sheet: in 12 f, struck 6 f, off 8 f; nothing from nowhere): a slot
 * just north of its place, out of which it slides south along its own face, opaque, and back into which it goes. The ghost
 * tally comes out from under the real tally (the reel frame's north member that carries it: the count without
 * pass-through pulled out from under the real count); the door ghost from under the Register deck's south rail, over the
 * docs bay beside the request's bay. Each slot is the screen line (FRAMING_B, the film's 15° pitch) of that edge's lowest
 * visible face; the card is drawn only south of it (Counterfactual.tsx `clip`: a plane through the camera's eye and that
 * line), so it reads as coming out from under the edge however high it hovers (session 6's critics: dropped in from beyond
 * the frame's top, the cards whipped back up through the Continuous plate and the reel; risen in place, they faded in).
 */
const SLOT_EDGES: Record<'tally' | 'door', readonly P3[]> = {
  // the member's south face's foot, and the strip's south edge under its paper
  tally: [
    [REEL_FRAME[1].x0, REEL_FRAME[1].y0, REEL_FRAME_Z[0]],
    [TALLY.x0, TALLY.y - TALLY.w / 2, TALLY.z - TALLY.t],
  ],
  // the deck's south rail: its south face's foot
  door: [[DECK.x1, DECK.y0, DECK.railZ0]],
};
/** A plane (three.js Plane: the side where n·p + d >= 0 is kept) as [nx, ny, nz, d]. */
export type Plane4 = readonly [number, number, number, number];
/** Each card's slot: its screen line (y, px), the clip plane through the camera's eye and that line, and how far up its face (u) from its centre at its place the line crosses it. */
export const SLOT_7: Record<'tally' | 'door', { y: number; plane: Plane4; edge: number }> = (() => {
  const pose = deskCamera(FRAMING_B, 15);
  const of = (k: 'tally' | 'door') => {
    const y = Math.max(...SLOT_EDGES[k].map((p) => project(pose, p)[1]));
    const E = pose.pos;
    const a = screenToDesk(pose, [600, y], CARD_Z);
    const b = screenToDesk(pose, [1500, y], CARD_Z);
    const u = [a[0] - E[0], a[1] - E[1], a[2] - E[2]] as const;
    const v = [b[0] - E[0], b[1] - E[1], b[2] - E[2]] as const;
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]] as const;
    const l = Math.hypot(c[0], c[1], c[2]);
    let n: P3 = [c[0] / l, c[1] / l, c[2] / l];
    let d = -(n[0] * E[0] + n[1] * E[1] + n[2] * E[2]);
    // the card's place on the kept side (south of the line on screen)
    const at = SPOT_AT[k].at;
    if (n[0] * at[0] + n[1] * at[1] + n[2] * at[2] + d < 0) {
      n = [-n[0], -n[1], -n[2]];
      d = -d;
    }
    const up = upFace(1);
    const edge = -(n[0] * at[0] + n[1] * at[1] + n[2] * at[2] + d) / (n[0] * up[0] + n[1] * up[1] + n[2] * up[2]);
    return { y, plane: [n[0], n[1], n[2], d] as Plane4, edge };
  };
  return { tally: of('tally'), door: of('door') };
})();
/**
 * How far up its face a card starts and goes back to: in, its south edge `peek` u out of the slot when it starts (so its
 * first move shows on its cue frame); out, `tuck` u inside it on its last drawn frame (so nothing vanishes). Its contact
 * shadow comes and goes with its travel (Counterfactual.tsx `inFrame`).
 */
const CARD_PEEK = 1.5;
const CARD_TUCK = 1;
export const CARD_SLIDE_7: Record<'tally' | 'door', { in: number; out: number }> = {
  tally: { in: SLOT_7.tally.edge + TALLY_CARD.h / 2 - CARD_PEEK, out: SLOT_7.tally.edge + TALLY_CARD.h / 2 + CARD_TUCK },
  door: { in: SLOT_7.door.edge + DOOR_CARD.h / 2 - CARD_PEEK, out: SLOT_7.door.edge + DOOR_CARD.h / 2 + CARD_TUCK },
};
/** A step of s u up a card's face (its tilt about x). */
function upFace(s: number): P3 {
  return [0, s * Math.cos(CARD_TILT), s * Math.sin(CARD_TILT)];
}
function add3(a: P3, b: P3): P3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
/** The beat's card spots (beat4.ts CardSpot): `off` up its face, in its slot. */
export const SPOT_7: Record<'tally' | 'door', CardSpot> = {
  tally: { ...SPOT_AT.tally, off: add3(SPOT_AT.tally.at, upFace(CARD_SLIDE_7.tally.out)) },
  door: { ...SPOT_AT.door, off: add3(SPOT_AT.door.at, upFace(CARD_SLIDE_7.door.out)) },
};

/** A beat-7 card at a frame: its centre and tilt, how far up its face it is (u: 0 at its place), how far it has travelled out (0..1: its contact shadow), its strike (0..1), frames since it settled. */
export interface Card7 {
  c: P3;
  tilt: number;
  back: number;
  travel: number;
  strike: number;
  play: number;
}
/**
 * A beat-7 card on beat 4's beats (beat4.ts cardAt: its life, its strike 6 f, out over 8 f easing in and out), slid out of
 * its slot along its own face over 12 f from the frame before its cue, easing in and out (a slide out of a slot, never the
 * move curve's first-frame leap: the door card is 180 px tall), and back in: null outside its life.
 */
export function card7At(f: number, k: 'tally' | 'door'): Card7 | null {
  const C = CARDS_7[k];
  const s = cardAt(f, C);
  if (!s) return null;
  const rise = sine((f - (C.rise - 1)) / CARD_RISE);
  const S = CARD_SLIDE_7[k];
  const back = s.exit > 0 ? S.out * s.exit : S.in * (1 - rise);
  return { c: add3(SPOT_7[k].at, upFace(back)), tilt: CARD_TILT, back, travel: rise * (1 - s.exit), strike: s.strike, play: s.play };
}
/** How much of a card is out of its slot (0..1 of its face, from its south edge). */
export function cardOut7(c: Card7, k: 'tally' | 'door'): number {
  const h = cardSize(SPOT_7[k]).h;
  return clamp((SLOT_7[k].edge - c.back + h / 2) / h);
}
/**
 * The light on a beat-7 card (as pools.ts cardPoolOf lights beat 4's, riding with it), weaker: its stock reads as grey
 * stock level with the real tally's paper, never as the frame's brightest bone paper (session 6's critics: the road not
 * taken read as the most built object in the frame; the door card, the larger, read brighter than the real tally even at
 * a third of the tally ghost's light, so the key alone lights it). It comes out of the slot with the card.
 */
export const CARD_LIGHT_7 = { tally: 0.3, door: 0 } as const;
const cardPool7 = (c: Card7, k: 'tally' | 'door'): Pool => ({ c: [c.c[0], c.c[1]], z: [c.c[2] - 40, c.c[2] + 50], sigma: [180, 120], rgb: tint(LIGHT_HEX.reading, CARD_LIGHT_7[k] * cardOut7(c, k)) });
/**
 * A beat-7 card's cast shadow (footprints.ts cardFootprint's, at its own pose): of the part out of its slot only, so it
 * grows out of the slot with the card and goes back in with it.
 */
function cardFootprint7(c: Card7, k: 'tally' | 'door'): Footprint | null {
  const { w, h } = cardSize(SPOT_7[k]);
  const out = cardOut7(c, k) * h;
  const low = c.c[2] - (h / 2) * Math.sin(c.tilt);
  if (out < 2 || low < 1) return null;
  // from its south edge up `out` along its face
  const mid = -h / 2 + out / 2;
  return { kind: 'rect', c: [c.c[0], c.c[1] + mid * Math.cos(c.tilt)], h: [w / 2, Math.max(1, (out / 2) * Math.cos(c.tilt))], r: 4, rot: 0, z0: low - 1.5, z1: low - 0.5, contact: 0 };
}

// ------------------------------------------------------------------------------------------------
// 7.3 the job rail, the long test, its receipt; the sand-glass and the Productive plate

/** Still (d)'s job rail shelf (summary.ts JOB_RAIL: beat7.test holds them equal) and where the sand-glass docks on it. */
export const SHELF = { x0: 264, x1: 456, y0: -286, y1: -214, z: 5, lip: 11 } as const;
/**
 * The oval track south of the shelf (its north straight along the shelf's south face): a graphite plate and a raised
 * graphite rail round it with a steel running strip, the long test running on the strip. Centres of its two ends, their
 * radius (the rail's centre line), the plate's margin round the rail, the plate's top, the rail's top and the strip's.
 */
export const OVAL = { c0: [298, -314] as const, c1: [422, -314] as const, r: 22, plate: 8, z: 4, railW: 8, railZ: 9, stripZ: 9.8 } as const;
/** The oval's plate (its bounding box): it lies 1 u south of the shelf, so it can sink alone into its own hatch. */
export const OVAL_BOX: Rect = { x0: OVAL.c0[0] - OVAL.r - OVAL.plate, x1: OVAL.c1[0] + OVAL.r + OVAL.plate, y0: OVAL.c0[1] - OVAL.r - OVAL.plate, y1: OVAL.c0[1] + OVAL.r + OVAL.plate };
/** The rail station rises out of a slate hatch (its leaves part 4 f, it rises on spring-settle, the hole closed under it once up). */
export const RAIL_HATCH: Rect = { x0: SHELF.x0 - 6, x1: SHELF.x1 + 6, y0: OVAL_BOX.y0 - 6, y1: SHELF.y1 + 6 };
export const RAIL = { open: 3700, rise: 3704, up: 3716, depth: 24 } as const;
/** The oval sinks back into a hatch of its own once the test has docked back (the station is still (d)'s shelf from then). */
export const OVAL_HATCH: Rect = { x0: OVAL_BOX.x0 - 2, x1: OVAL_BOX.x1 + 2, y0: OVAL_BOX.y0 - 2, y1: SHELF.y0 };
export const OVAL_AWAY = { open: BEAT_7.peel.dock + 6, sink: BEAT_7.peel.dock + 10, down: BEAT_7.peel.dock + 20, depth: 24 } as const;
/**
 * The long test: a capsule as long as the slit allows (Bay.tsx: the lit slit is the slot less 8 u at each end, 100 u; the
 * capsule 2 half + 2 r = 98 u, about 85 px at 0.85x), its radius the slit's half width, resting hidden in the slit's middle;
 * its arc's apex.
 */
export const CAPSULE = { r: 6, half: 43, rest: [rectC(BAYS.bug.slot)[0], rectC(BAYS.bug.slot)[1], 22] as P3, apex: 124 } as const;
/** Its receipt: a ticket pushed up out of a slit in the shelf's west part, leaning back, a bold start mark on it; sinking back as the test docks. */
export const RECEIPT = { c: [SHELF.x0 + 40, -258, SHELF.z] as P3, w: 46, h: 30, lean: 0.5 } as const;
/** The sand-glass docked on the shelf: still (d)'s DOCKED.glass (it takes still (d)'s body in flight). */
export const GLASS_DOCK: P3 = [414, -252, SHELF.z];
/** The glass in your tray (you.ts CHORES, TRAY_Z: objects/YourDesk.tsx builds it about this rest point). */
export const GLASS_REST: P3 = [CHORES.glass.c[0], CHORES.glass.c[1], TRAY_Z.floor];
/**
 * The Productive plate (Productive · 高效, made as the Proactive plate): it rises out of a slate hatch of its own west of the
 * rail and docks there, low in the frame (the tags take the ground over it). Its hatch is its own outline.
 */
export const PRODUCTIVE_PLATE = { box: { x0: -94, x1: 250, y0: -348, y1: -284 } as Rect, z: [0, 4] as const } as const;
/**
 * Its order (Persistent's, 9.1): the glass docks, then the plate rises and its words are written on. Its hatch stays shut
 * until the glass has docked: its leaves part over `leaves` f from the glass's dock while the plate rises from deep in the
 * pit (its blank face, the plate's enamel with no words, so nothing is cut through a glyph; its top under the slate until
 * the leaves are most of the way open), it docks on `plate-productive`, and from that frame its words are written on from
 * its west edge over `words` f (session 6's critics: its words showed through a centre-out clip 14 f before the dock; then
 * its blank face showed while the glass was still in the air).
 */
export const PLATE_RISE = { open: BEAT_7.glass.dock, rise: BEAT_7.glass.dock, leaves: 3, depth: 10, words: 8 } as const;

/** Beat 7's peel frames. */
const P7 = {
  emerge: BEAT_7.peel.lift - 8,
  crouch: BEAT_7.peel.lift - 3,
  lift: BEAT_7.peel.lift,
  rail: BEAT_7.peel.rail,
  receipt: BEAT_7.peel.receipt,
  dockFrom: BEAT_7.peel.dockFrom,
  dock: BEAT_7.peel.dock,
  sink: 6,
} as const;

/** A part rising out of a slate hatch: its leaves (0 shut .. 1 open), whether the hole is open, its height under its rest (<= 0). */
export interface RailState {
  leaves: number;
  hole: boolean;
  dz: number;
}
/** The rail station: the shelf (and the oval with it) up out of its hatch; the oval's own sink back once the test has docked. */
export function railAt(f: number): RailState | null {
  if (f < RAIL.open || f >= E7.until) return null;
  // the leaves part (4 f), the station rises on spring-settle, the leaves close under it once it is up (4 f), then the hole shuts
  const leaves = sine((f - RAIL.open) / 4) * (1 - sine((f - RAIL.up) / 4));
  const spring = -RAIL.depth * (1 - springAt(f, RAIL.rise, SPRING.settle));
  const dz = f < RAIL.rise ? -RAIL.depth : f >= RAIL.up || Math.abs(spring) < 0.05 ? 0 : spring;
  return { leaves, hole: f < RAIL.up + 5, dz };
}
/** The oval's sink: its hatch's leaves part under it (hidden by its plate), it sinks (sine, 10 f), the leaves close over it. Null before and once it has gone. */
export function ovalAwayAt(f: number): RailState | null {
  const A = OVAL_AWAY;
  if (f < A.open || f >= A.down + 5) return null;
  return { leaves: sine((f - A.open) / 4) * (1 - sine((f - A.down) / 4)), hole: true, dz: -A.depth * sine((f - A.sink) / (A.down - A.sink)) };
}
/** Whether the oval is drawn (risen with the station, until it has sunk back). */
export const ovalShown = (f: number): boolean => f >= RAIL.open && f < OVAL_AWAY.down;

/** A point of the oval's rail at arc length d from its north straight's west end, heading east along the north straight (clockwise in plan). */
const OVAL_STRAIGHT = OVAL.c1[0] - OVAL.c0[0];
export const OVAL_PERIM = 2 * OVAL_STRAIGHT + 2 * Math.PI * OVAL.r;
export function ovalAt(d: number): { x: number; y: number; heading: number } {
  const L = ((d % OVAL_PERIM) + OVAL_PERIM) % OVAL_PERIM;
  const [x0, cy] = OVAL.c0;
  const x1 = OVAL.c1[0];
  const r = OVAL.r;
  const arc = Math.PI * r;
  if (L < OVAL_STRAIGHT) return { x: x0 + L, y: cy + r, heading: 0 };
  if (L < OVAL_STRAIGHT + arc) {
    const a = Math.PI / 2 - (L - OVAL_STRAIGHT) / r;
    return { x: x1 + r * Math.cos(a), y: cy + r * Math.sin(a), heading: a - Math.PI / 2 };
  }
  if (L < 2 * OVAL_STRAIGHT + arc) return { x: x1 - (L - OVAL_STRAIGHT - arc), y: cy - r, heading: Math.PI };
  const a = -Math.PI / 2 - (L - 2 * OVAL_STRAIGHT - arc) / r;
  return { x: x0 + r * Math.cos(a), y: cy + r * Math.sin(a), heading: a - Math.PI / 2 };
}
/**
 * The capsule comes up out of the slit and goes back down into it tilted `nose` (its east end leading out, its west end
 * leading in), crossing the slit's plane at an even pace over `cross` f (from its east cap's top at the plane, CAP_FROM, to
 * its west cap's, CAP_CLEAR), so the lit slit goes under it a quarter at a time and comes back the same way (session 6's
 * critics: level, it covered all 98 u of the 100 u slit in one frame and uncovered it in one). Clear of the slit it levels
 * as it rises on (2 f, easing out); going back, it tilts as it comes down to the slit (2 f, easing in).
 */
export const CAP_SLIT = { z: 30.3, nose: 0.13, cross: 4 } as const;
const CAP_REACH = (CAPSULE.half + CAPSULE.r) * Math.tan(CAP_SLIT.nose);
const CAP_FROM = CAP_SLIT.z - CAPSULE.r - CAP_REACH;
const CAP_CLEAR = CAP_SLIT.z - CAPSULE.r + CAP_REACH;
/** Where the capsule lands on the rail (on its north straight, the west end of its lap's: lapAt) and lifts off again after one lap. */
const LAND_D = 0;
const CAP_Z = OVAL.stripZ + CAPSULE.r;

export interface CapsulePose {
  p: P3;
  heading: number;
  /** about its long axis (it rolls a half turn in the air) and nose up */
  roll: number;
  slope: number;
  squash: number;
  /** on the rail (its contact shadow), or in the air */
  onRail: boolean;
}
/**
 * The capsule's lap (its centre's path; it never turns: its axis lies along the straights all the way round). It is longer
 * (98 u) than the oval's ends are wide (the rail's radius 22, the oval 68 u from side to side): turned to follow the rail
 * round an end it swung its caps far off the oval (session 6 draft), so it circulates like a carriage on a loop, east along
 * the north rail, across the east end, west along the south rail and back across the west end, its centre on a loop
 * inside the oval whose ends keep its caps over the oval's plate: every point of it stays over the oval.
 */
export const LAP = { x0: OVAL_BOX.x0 + CAPSULE.half + CAPSULE.r + OVAL.r + 2, x1: OVAL_BOX.x1 - CAPSULE.half - CAPSULE.r - OVAL.r - 2 } as const;
export const LAP_PERIM = 2 * (LAP.x1 - LAP.x0) + 2 * Math.PI * OVAL.r;
/** The capsule's centre on its lap at d (from the north straight's west end, clockwise in plan). */
export function lapAt(d: number): { x: number; y: number } {
  const L = ((d % LAP_PERIM) + LAP_PERIM) % LAP_PERIM;
  const S = LAP.x1 - LAP.x0;
  const r = OVAL.r;
  const cy = OVAL.c0[1];
  if (L < S) return { x: LAP.x0 + L, y: cy + r };
  if (L < S + Math.PI * r) {
    const a = Math.PI / 2 - (L - S) / r;
    return { x: LAP.x1 + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  if (L < 2 * S + Math.PI * r) return { x: LAP.x1 - (L - S - Math.PI * r), y: cy - r };
  const a = -Math.PI / 2 - (L - 2 * S - Math.PI * r) / r;
  return { x: LAP.x0 + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
/** The long test at f: risen out of the slit (4 f), its crouch, its arc onto the rail, a lap of the oval, docked back into the slot and sunk. Null while it is inside the slot. */
export function capsuleAt(f: number): CapsulePose | null {
  if (f < P7.emerge || f >= P7.dock + P7.sink) return null;
  const R = CAPSULE.rest;
  const top = SLOT_TOP + CAPSULE.r * 0.7;
  if (f < P7.lift) {
    // up out of the slit nose first (5 f, in-out, levelling as it comes: CAP_SLIT), then the anticipation: a crouch (3 f)
    // and its squash, let go on the lift
    if (f < P7.crouch) {
      const t = f - P7.emerge + 1;
      if (t <= CAP_SLIT.cross) return { p: [R[0], R[1], lerp(CAP_FROM, CAP_CLEAR, t / CAP_SLIT.cross)], heading: 0, roll: 0, slope: CAP_SLIT.nose, squash: 0, onRail: false };
      const e = 1 - (1 - (t - CAP_SLIT.cross) / (P7.crouch - P7.emerge + 1 - CAP_SLIT.cross)) ** 2;
      return { p: [R[0], R[1], lerp(CAP_CLEAR, top + 1.5, e)], heading: 0, roll: 0, slope: CAP_SLIT.nose * (1 - e), squash: 0, onRail: false };
    }
    const k = (f - P7.crouch) / (P7.lift - P7.crouch);
    return { p: [R[0], R[1], top + 1.5 - 2 * sine(k)], heading: 0, roll: 0, slope: 0, squash: 0.03 * sine(k), onRail: false };
  }
  const land = lapAt(LAND_D);
  const L: P3 = [land.x, land.y, CAP_Z];
  if (f < P7.rail) {
    // the 10 f arc up over the bay's south wall onto the rail, rolling a half turn about its length
    const u = (f - P7.lift) / (P7.rail - P7.lift);
    const e = sine(u);
    const a: P3 = [R[0], R[1], top - 0.5];
    return { p: [lerp(a[0], L[0], e), lerp(a[1], L[1], e), lerp(a[2], L[2], u) + 4 * CAPSULE.apex * u * (1 - u)], heading: 0, roll: Math.PI * e, slope: 0.35 * Math.sin(Math.PI * u) * (1 - 2 * u), squash: 0.03 * Math.max(0, 1 - (f - P7.lift + 1) / 2), onRail: false };
  }
  if (f < P7.dockFrom) {
    // the lap: on the rail, gathering speed, round the oval once, slowing back to its landing point
    const T = P7.dockFrom - P7.rail;
    const d = LAND_D + LAP_PERIM * trapezoid((f - P7.rail) / T, 8 / T, 8 / T);
    const o = lapAt(d);
    return { p: [o.x, o.y, CAP_Z], heading: 0, roll: Math.PI, slope: 0, squash: squashAt(f, P7.rail, 0.03), onRail: true };
  }
  if (f < P7.dock) {
    // docked back as an event: up off the rail and back over the wall into the slit (8 f)
    const u = (f - P7.dockFrom) / (P7.dock - P7.dockFrom);
    const e = sine(u);
    const b: P3 = [R[0], R[1], top];
    return { p: [lerp(L[0], b[0], e), lerp(L[1], b[1], e), lerp(L[2], b[2], u) + 4 * CAPSULE.apex * u * (1 - u)], heading: 0, roll: Math.PI * (1 - e), slope: -0.3 * Math.sin(Math.PI * u) * (1 - 2 * u), squash: 0, onRail: false };
  }
  // in the slot: its 3% squash on the dock (the contact frame, decaying), then down to the slit tilting (2 f) and into it tail
  // first (CAP_SLIT), its last quarter under the slit's plane the frame after its last
  const w = f - P7.dock;
  const lead = P7.sink - CAP_SLIT.cross;
  if (w <= lead) {
    const e = (w / lead) ** 2;
    return { p: [R[0], R[1], lerp(top, CAP_CLEAR, e)], heading: 0, roll: 0, slope: CAP_SLIT.nose * e, squash: squashAt(f, P7.dock, 0.03), onRail: false };
  }
  return { p: [R[0], R[1], lerp(CAP_CLEAR, CAP_FROM, (w - lead) / CAP_SLIT.cross)], heading: 0, roll: 0, slope: CAP_SLIT.nose, squash: squashAt(f, P7.dock, 0.03), onRail: false };
}
/** The receipt: how far it has risen out of the shelf's slit (0..1): pushed up over 4 f to stand on `job-receipt`, sunk back over 5 f from the dock. */
export const receiptAt = (f: number): number | null => {
  const from = P7.receipt - 3;
  if (f <= from || f >= P7.dock + 6) return null;
  return sine((f - from) / 4) * (1 - sine((f - P7.dock) / 5));
};

/** The sand-glass's hand-over (beat 5's key's grammar): lift, 4 f anticipation, a 10 f rise in an arc, the drop into its dock on `glass-dock`. */
export interface GlassPose {
  /** its rest point (the glass is built about your tray's rest point: an offset of 0 is the tray's own pose) */
  p: P3;
  yaw: number;
  tilt: number;
  squash: number;
  /** how far above where it lies it is (its contact shadow opens as it lifts) */
  lift: number;
  /** from your tray's glass (0) to still (d)'s docked body (1: objects/Trace.tsx glassAt's ends and bulbs) */
  morph: number;
}
/**
 * Its flight: up out of the tray and north over the south ends of W-08 and W-09 (its plan path a curve through `via`), then
 * down over the dock: so it flies clear of the jobs tag's lines and its leader, set on its cue as the glass lifts (session
 * 6's critics: it flew behind "after 5 s" and the leader as they were read; beat7.test checks its screen box per frame).
 */
const G7 = { lift: BEAT_7.glass.lift, anticipate: 4, dock: BEAT_7.glass.dock, hover: 34, arc: 100, across: 0.9, ramp: 0.18, via: [-100, 120] as const } as const;
const GLASS_BACK: P3 = [-3, 0, 2.5];
/** The glass's run along its way (0..1) over its flight's share u: gathering speed, even, easing into the hover over the dock (a trapezoid, so its peak pace stays under beat 5's key's). */
const glassAcross = (u: number): number => trapezoid(u / G7.across, G7.ramp, G7.ramp);
export function glassAt(f: number): GlassPose | null {
  if (f < G7.lift || f >= E7.until) return null;
  const A = GLASS_REST;
  const D = GLASS_DOCK;
  if (f < G7.lift + G7.anticipate) {
    const t = sine((f - G7.lift) / G7.anticipate);
    const p = lerp3(A, [A[0] + GLASS_BACK[0], A[1] + GLASS_BACK[1], A[2] + GLASS_BACK[2]], t);
    return { p, yaw: 0, tilt: 0.1 * t, squash: 0, lift: p[2] - A[2], morph: 0 };
  }
  if (f < G7.dock) {
    // one arc from the anticipation to over the dock (its rise in its first half), then the drop into the dock, gathering speed
    const a: P3 = [A[0] + GLASS_BACK[0], A[1] + GLASS_BACK[1], A[2] + GLASS_BACK[2]];
    const u = (f - G7.lift - G7.anticipate) / (G7.dock - G7.lift - G7.anticipate);
    const h = clamp(u / G7.across);
    const k = glassAcross(u);
    const top = D[2] + G7.hover;
    const z = u < G7.across ? lerp(a[2], top, sine(h)) + 4 * G7.arc * h * (1 - h) : top - (top - D[2]) * ((u - G7.across) / (1 - G7.across)) ** 2;
    const under = lerp(A[2], D[2], k);
    // its plan path: a quadratic curve from the anticipation's end through G7.via to the dock
    const w = 1 - k;
    const [vx, vy] = G7.via;
    const x = w * w * a[0] + 2 * w * k * vx + k * k * D[0];
    const y = w * w * a[1] + 2 * w * k * vy + k * k * D[1];
    return { p: [x, y, z], yaw: 0.5 * Math.sin(Math.PI * h), tilt: 0.1 * (1 - h) - 0.35 * Math.sin(Math.PI * h), squash: 0, lift: z - under, morph: sine(h) };
  }
  return { p: D, yaw: 0, tilt: 0, squash: squashAt(f, G7.dock, 0.03), lift: 0, morph: 1 };
}
/** The Productive plate: its hatch and its rise, and how much of its words are written on (0 none .. 1 all: its west part shows). */
export interface PlateState extends RailState {
  words: number;
}
/** The Productive plate's hatch, its rise and its words (null before its hatch opens and from the summary on). */
export function productivePlateAt(f: number): PlateState | null {
  const P = PLATE_RISE;
  const dock = BEAT_7.glass.plateDock;
  if (f < P.open || f >= E7.until) return null;
  return {
    leaves: sine((f - P.open) / P.leaves) * (1 - sine((f - dock) / 4)),
    hole: f < dock + 5,
    dz: f >= dock ? 0 : -P.depth * (1 - sine((f - P.rise) / (dock - P.rise))),
    // its first word's start on the dock frame (the contact), all of them by its 8th frame
    words: sine((f - dock + 1) / P.words),
  };
}

// ------------------------------------------------------------------------------------------------
// 7.4 the chat reply and the dossier

/**
 * The chat reply's rest in your in-tray: south of #0408's, beside it, on the tray's floor (as #0408: state.ts IN_TRAY_REST),
 * far enough south (its slip to the tray's open south lip) that its whole "≤ 100" stop tab shows below the reply #0405,
 * which lies over it from bar 68 (beat10.ts REPLY_0405): no glyph of the tab is cut by #0405's edge.
 */
export const REPLY_REST: P3 = [rectC(YOU.inTray)[0] - 10, YOU.inTray.y1 - 93, 33];
/**
 * Its stop tab (enamel, the "≤ 100" in the sans: gl/print7.ts) clipped over the slip's trailing end, standing proud of it, its
 * glyphs at least 18 px; their ink ends `clear` short of its east end, where tag-100's leader foot (TAB_REST, 5 u in) and its
 * 4 px dot sit clear of the last "0".
 */
export const STOP_TAB = { w: 96, h: 32, over: 24, em: 30, clear: 14 } as const;
/** The tab's words: WORDS.tag100's limit, as the tag sets it. */
export const TAB_WORDS = WORDS.tag100.en.match(/≤\s?\d+/)![0];

/**
 * The dossier: a thick tabbed stack (paper, half as large again as the chat reply), pushed out from under the deck's west
 * rail (hidden under the deck's plate until then), a heavy flight to the card feeder's mouth, a thud, pushed in under the
 * deck of cards until its east end is under the roller.
 */
export const DOSSIER = { w: 62, l: 108, t: 16, tabs: 3, fly: 24, apex: 44, outFrames: 8, inFrames: 6 } as const;
/** The card feeder's mouth (beat6.ts CI_MOUTH: beat7.test holds them equal): where the dossier lands; how far in it goes (its east end under the roller, inside the feeder's face). */
export const PORT = { to: [-860, 261, 5.2] as P3, from: [-920, 261, 5.2] as P3 } as const;
export const DOSSIER_IN_X = FEEDERS.ci.x1 - 1 - DOSSIER.l / 2;
/** Where it comes out from under the deck (its centre, hidden under the plate) and where it is fully out (its east end past the deck's west rail). */
const DOSSIER_OUT = { from: [DECK.x0 + 70, 172, 62] as P3, to: [DECK.x0 - 2 - DOSSIER.l / 2 - 30, 172, 64] as P3 } as const;
export interface DossierPose {
  p: P3;
  heading: number;
  slope: number;
  squash: number;
  flying: boolean;
}
export function dossierAt(f: number): DossierPose | null {
  const D = BEAT_7.dossier;
  const from = D.leave - DOSSIER.outFrames;
  const done = D.lands + 4 + DOSSIER.inFrames;
  if (f < from || f >= done) return null;
  const O = DOSSIER_OUT;
  if (f < D.leave) {
    // pushed out west from under the deck's plate (gathering speed, so it leaves at its flight's pace)
    const u = (f - from) / DOSSIER.outFrames;
    return { p: lerp3(O.from, O.to, u * u * 0.7 + u * 0.3), heading: Math.PI, slope: 0, squash: 0, flying: false };
  }
  // on the mouth's plate (its top at 6), then in under the deck of cards
  const land: P3 = [PORT.to[0], PORT.to[1], 6.4 + DOSSIER.t / 2];
  if (f < D.lands) {
    // heavy: a low arc, gathering speed as it falls, its tabs trailing
    const u = (f - D.leave) / (D.lands - D.leave);
    const xy = u * 0.55 + 0.45 * sine(u);
    const z = lerp(O.to[2], land[2], u * u) + 4 * DOSSIER.apex * u * (1 - u) * (1 - u * 0.4);
    return { p: [lerp(O.to[0], land[0], xy), lerp(O.to[1], land[1], xy), z], heading: Math.PI, slope: -0.22 * Math.sin(Math.PI * u) + 0.12 * u, squash: 0, flying: true };
  }
  // the thud (the contact frame: an 8% squash, let go on spring-heavy: about half gone in 2 f, a hair left at 6), then pushed in under the cards
  const after = f - D.lands;
  const squash = Math.max(0, 0.08 * (1 - springAt(f, D.lands, SPRING.heavy)));
  if (after < 4) return { p: land, heading: Math.PI, slope: 0, squash, flying: false };
  const w = sine((after - 4) / (DOSSIER.inFrames - 1));
  return { p: [lerp(land[0], DOSSIER_IN_X, w), land[1], land[2]], heading: Math.PI, slope: 0, squash, flying: false };
}

// ------------------------------------------------------------------------------------------------
// The state

export interface Beat7State {
  f: number;
  cord: CordState;
  guide: { arm: number; post: number };
  terminal: number;
  gate: { rise: number; open: number };
  spool: { colour: number };
  riders: RiderPose[];
  notices: number[];
  tally: { n: number; len: number } | null;
  rail: RailState | null;
  oval: RailState | null;
  capsule: CapsulePose | null;
  receipt: number | null;
  glass: GlassPose | null;
  plate: PlateState | null;
  dossier: DossierPose | null;
}
/** DeskState.e7: beat 7's parts at f, from `cord-out` to the seam (null outside). */
export function beat7At(f: number): Beat7State | null {
  if (f < E7.cordOut || f >= E7.until) return null;
  return {
    f,
    cord: cordAt(f),
    guide: guideAt(f),
    terminal: terminalAt(f),
    gate: gateAt(f),
    spool: spoolAt(f),
    riders: [0, 1].flatMap((i) => riderAt(i, f) ?? []),
    notices: noticeInk(f),
    tally: tallyAt(f),
    rail: railAt(f),
    oval: ovalAwayAt(f),
    capsule: capsuleAt(f),
    receipt: receiptAt(f),
    glass: glassAt(f),
    plate: productivePlateAt(f),
    dossier: dossierAt(f),
  };
}

// ------------------------------------------------------------------------------------------------
// The hooks

/** What a card steps down (everything of act two's world but the card and what it is read against: each card leaves its own out). */
const CARD_STEP_ALL: readonly FocusId[] = ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'testsBay', 'freshBay', 'cord', 'reel', 'lock', 'gauge', 'head', 'index', 'mouth', 'you', 'deck', 'chute', 'proactive', 'spike', 'stress', 'b7-rail', 'b7-gate', 'b7-plate'];
/** The tally card is read against the real tally (its own paper, never stepped) and the bay whose pins keep their pace. */
const TALLY_STEP: readonly FocusId[] = CARD_STEP_ALL.filter((x) => x !== 'bugBay' && x !== 'b7-gate');
/** The door card is read against the real bay, its open gate and the cord the second follow-up rides. */
const DOOR_STEP: readonly FocusId[] = CARD_STEP_ALL.filter((x) => x !== 'bugBay' && x !== 'b7-gate' && x !== 'cord');
/** How far a card steps the rest down (state.ts CARD_DEPTH, beat 4's cards). */
const CARD_DEPTH = 1.5;
/** The step that takes graphite, enamel and steel to the slate's tone (gl/materials.ts: 0.45 of the way a unit; turn.ts PRESS_LATE). */
const OVAL_SLATE = 1 / 0.45;
/**
 * Focus (state.ts FocusEntry): 7.1's Thread is the action (the spool, the cord, the guide on the deck, the request's bay
 * and the tape it notices on), so the other bays, the gate, the belt and the filter's spike step down from the cord's
 * payout until the first follow-up is through the gate (your desk stays up); the two cards then step everything but
 * themselves and what they are read against down half as far again, each from its first move, the tally card's to 5 f
 * after its strike as beat 4's did, the door card's to 2 f before it. Nothing overlaps, so nothing pumps: 'b7' is up by
 * f3550, the tally card's ramp out ends at f3659, the door card starts at f3691; all is back up by f3720 (the peel, the
 * glass's lift), long before bar 50 (beat 8's entry starts at f3920 without a hand-over).
 */
export const FOCUS_7: readonly FocusEntry[] = [
  { id: 'b7', from: E7.cordOut, to: BEAT_7.riders[0].enter, step: ['docsBay', 'freshBay', 'gate', 'belt', 'policy', 'gauge', 'proactive', 'spike', 'stress', 'chute'] },
  { id: 'b7-tally', from: CARDS_7.tally.rise - 1, to: CARDS_7.tally.strike + 5, step: TALLY_STEP, depth: CARD_DEPTH },
  // the door card's world comes back up from just before its strike, so all is up on the peel (your desk's glass hands over at full)
  { id: 'b7-door', from: CARDS_7.door.rise - 1, to: CARDS_7.door.strike - 2, step: DOOR_STEP, depth: CARD_DEPTH },
  // the oval track, its job done, takes the slate's tone as it sinks (the turn's pressed folders' step, turn.ts PRESS_LATE),
  // so its hatch's leaves close over a slate-dark track, never as a clip across its lit lip (session 6's critics)
  { id: 'b7-oval', from: OVAL_AWAY.open, to: OVAL_AWAY.down + 5, step: ['b7-oval'], depth: OVAL_SLATE },
];
/** Your lamp: down a step as the sand-glass docks on the job rail (the receiving part answers 2 f after), up a step as the chat reply lands; net 0 (still (d)'s 0.62). */
export const LAMP_7: readonly LampStep[] = [
  { at: BEAT_7.glass.dock + 2, steps: -1 },
  { at: BEAT_7.reply.lands + 2, steps: 1 },
];
/** The index arm: no detent for the bypass; it turns west to you for the chat reply (still (d)'s detent from here). */
export const ARM_7: readonly ArmStep[] = [{ at: BEAT_7.reply.indexWest, to: 'you' }];
/** The chat reply riding the chute into your in-tray (state.ts replyRideAt, the standard ride: it leaves under the deck on its cue, lands on `reply-chat`). */
export function replies7(e: Beat7State | null): ReplyState[] {
  if (!e) return [];
  const ride = replyRideAt(e.f, BEAT_7.reply.leave, BEAT_7.reply.lands);
  return ride ? [{ id: '7-chat', ride, rest: REPLY_REST }] : [];
}
/**
 * The counterfactual cards up at a state for footprints.ts and pools.ts to cast and light (beat 4's way: in and out along
 * cardPose's slide): none. Beat 7's rise in place (card7At), so footprints7 casts them and pools7 lights them at that pose.
 */
export function cards7(_s: DeskState): CardUp[] {
  return [];
}
/** The beat's cards up at f (card7At), each with its key. */
const cardsUp7 = (f: number): { k: 'tally' | 'door'; c: Card7 }[] =>
  (['tally', 'door'] as const).flatMap((k) => {
    const c = card7At(f, k);
    return c ? [{ k, c }] : [];
  });

/**
 * How far below a part's top its footprint ends when that top is a receiver the part lights (footprints.ts TOP_CLEAR): a
 * footprint reaching its own top shades it (gl/light.ts), and the shelf read as a hole in the floor.
 */
const TOP_CLEAR = 0.25;
/**
 * Beat 7's footprints: the Thread cord and its guide in both worlds (the summary's are still (d)'s, exactly the stub's),
 * and in act two the parts of the beat: the cord as it pays out and droops, the guide rising, the gate, the follow-ups,
 * the job rail and its long test (the shelf's own only while it rises: still (d) casts none), the tally strip, the
 * sand-glass, the Productive plate, the dossier.
 */
export function footprints7(s: DeskState): Footprint[] {
  if (s.f < E7.cordOut) return [];
  const e = s.e7;
  if (!e) return [...STATIC_CORD_FP];
  const z0 = DECK.top - 4;
  const fp: Footprint[] = [];
  // the guide: its arm out of the rail, its post up
  if (e.guide.arm > 0) fp.push(segFp([MAST.arm[0], MAST.arm[1], z0], [MAST.arm[0] + (MAST.x - MAST.arm[0]) * e.guide.arm, MAST.y, z0], 4));
  if (e.guide.post > 0) fp.push(segFp([MAST.x, MAST.y, z0], [MAST.x, MAST.y, z0 + (MAST.h - z0) * e.guide.post], 5));
  // the cord: its control points drooped and plucked, as far as it has paid out
  if (cordStatic(e.cord)) fp.push(...polySegs(CORDS.vermilion, 4));
  else {
    const pts: P3[] = [];
    CORD_S.forEach((sk) => {
      if (sk < e.cord.head) pts.push(cordPoint(sk, e.cord));
    });
    pts.push(cordPoint(Math.min(e.cord.head, CORD_L), e.cord));
    if (pts.length >= 2) fp.push(...polySegs(pts, 4));
  }
  // the gate on the wall top (risen with the terminal): its post and its two leaves, each about its own post
  if (e.gate.rise > 0) {
    const dz = -GATE_RISE * (1 - e.gate.rise);
    fp.push(circleFp([GATE.x0, GATE.y], GATE.postR + 1, GATE.z0 - 1 + dz, GATE.postTop + dz, 1));
    const a = (Math.PI / 2) * e.gate.open;
    for (const [hx, dir] of [
      [GATE.x0, 1],
      [GATE.x1, -1],
    ] as const) {
      const tip: P3 = [hx + dir * GATE_LEAF * Math.cos(a), GATE.y + GATE_LEAF * Math.sin(a), GATE.z1 + dz];
      fp.push(segFp([hx, GATE.y, GATE.z1 + dz], tip, GATE.t / 2 + 1));
    }
  }
  for (const r of e.riders) fp.push({ kind: 'rect', c: [r.p[0], r.p[1]], h: [Math.max(1, (RIDER.l / 2) * Math.abs(Math.cos(r.slope))), Math.max(1, (RIDER.w / 2) * Math.abs(Math.cos(r.roll)))], r: 2, rot: r.heading, ...carrierSpan({ p: r.p, slope: r.slope }, RIDER.l / 2, 0.4), contact: r.p[2] < SLOT_TOP + 2 ? 0.5 : 0 });
  // the tally strip over the cap (a hair under its own top)
  if (e.tally && e.tally.len > 1) fp.push(rectFp({ x0: TALLY.x0, x1: TALLY.x0 + e.tally.len, y0: TALLY.y - TALLY.w / 2, y1: TALLY.y + TALLY.w / 2 }, TALLY.z - TALLY.t, TALLY.z - TOP_CLEAR, 0, 1));
  // the station while it rises (its shadow on the hatch's leaves and pit; still (d) casts none for the shelf once it is up),
  // only once its top is out of the pit: a footprint over its own top shades it (it stepped dark as it rose)
  const shelfTop = SHELF.z + (e.rail?.dz ?? 0) - TOP_CLEAR;
  if (e.rail && e.rail.dz < 0 && shelfTop > 0.5) fp.push(rectFp(SHELF, 0, shelfTop, 1, 3));
  const c = e.capsule;
  if (c) fp.push({ kind: 'rect', c: [c.p[0], c.p[1]], h: [CAPSULE.half + CAPSULE.r, CAPSULE.r], r: CAPSULE.r, rot: c.heading, z0: Math.max(0, c.p[2] - CAPSULE.r), z1: c.p[2] - CAPSULE.r * 0.2, contact: c.onRail ? 0.6 : 0 });
  const g = e.glass;
  // your tray's glass footprint (footprints.ts youFootprints) carried with it: the same on its lift frame, its contact opening as it lifts
  // docked, it lets its shadow go under bar 50's move (still (d)'s glass casts none, so the seam keeps it)
  const gk = 1 - sine((s.f - GLASS_SHADE_OFF[0]) / (GLASS_SHADE_OFF[1] - GLASS_SHADE_OFF[0]));
  if (g && gk > 0) fp.push({ kind: 'rect', c: [g.p[0], g.p[1]], h: [CHORES.glass.half[0] - 1 - 6 * g.morph, CHORES.glass.half[1] - 4 * g.morph], r: 4, rot: g.yaw, z0: g.p[2], z1: g.p[2] + 0.5 + (26.5 - 8 * g.morph) * gk, contact: 0.8 * clamp(1 - g.lift / 3) * gk });
  // the plate's, only once its top is out of the pit (a footprint over its own top shaded it: it dipped and popped back as it
  // rose), its contact coming in as it comes up
  const plateTop = PRODUCTIVE_PLATE.z[1] + (e.plate?.dz ?? 0) - TOP_CLEAR;
  if (e.plate && plateTop > 0.5) fp.push(rectFp(PRODUCTIVE_PLATE.box, 0, plateTop, clamp((plateTop - 0.5) / (PRODUCTIVE_PLATE.z[1] - TOP_CLEAR - 0.5)), 3));
  const d = e.dossier;
  if (d) fp.push({ kind: 'rect', c: [d.p[0], d.p[1]], h: [DOSSIER.l / 2, DOSSIER.w / 2], r: 3, rot: d.heading, z0: Math.max(0, d.p[2] - DOSSIER.t / 2), z1: d.p[2] + DOSSIER.t / 2 - TOP_CLEAR, contact: d.flying ? 0 : 0.7 });
  // the counterfactual cards' shadows (in place: cardFootprint7)
  for (const { k, c: card } of cardsUp7(s.f)) {
    const cf = cardFootprint7(card, k);
    if (cf) fp.push(cf);
  }
  return fp;
}
/** The docked glass's shadow goes over these frames (under bar 50's camera move). */
const GLASS_SHADE_OFF = [at(50) + 2, at(50) + 18] as const;
/** The cord and its guide at rest (still (d); the stub's footprints, unchanged). */
const STATIC_CORD_FP: Footprint[] = [segFp([MAST.arm[0], MAST.arm[1], DECK.top - 4], [MAST.x, MAST.y, DECK.top - 4], 4), segFp([MAST.x, MAST.y, DECK.top - 4], [MAST.x, MAST.y, MAST.h], 5), ...polySegs(CORDS.vermilion, 4)];

/** Beat 7's pools: the light on its counterfactual cards while one is up (cardPool7, riding in and out with it). */
export function pools7(s: DeskState): Pool[] {
  if (!s.e7) return [];
  return cardsUp7(s.f).flatMap(({ k, c }) => (CARD_LIGHT_7[k] > 0 ? [cardPool7(c, k)] : []));
}
/**
 * Beat 7's tags, in the clear ground east of your desk and under the docs bays (inside title-safe and the action band, clear
 * of the notes; the Productive plate docks under them). The jobs tag qualifies the job rail (its leader to the shelf's west
 * end); the 100-word tag the chat reply's stop tab, where the reply comes to lie in your in-tray.
 */
export const TAG_AT = [772, 718] as const;
/** The jobs tag a little east of the 100-word tag's place, so the sand-glass's flight clears its first letters (G7). */
export const TAG_JOBS_AT = [TAG_AT[0] + 28, TAG_AT[1]] as const;
export const TAG_GAP_7 = 42;
export const TAG_JOBS_LINES = { en: ['prototype: background', 'after 5 s'], zh: ['原型：5 秒后转入后台'] } as const;
/** The chat reply's stop tab at rest: its east end (the leader's dot clear of its glyphs; the slip lying at heading 0.05). */
export const TAB_REST: P3 = [REPLY_REST[0] + (50 + STOP_TAB.over - 5) * Math.cos(0.05), REPLY_REST[1] + (50 + STOP_TAB.over - 5) * Math.sin(0.05), REPLY_REST[2] + 2.5];
export const TAGS_7: readonly TagSpec[] = [
  { cue: 'tag-jobs', words: WORDS.tagJobs, at: TAG_JOBS_AT, anchor: 'start', foot: [SHELF.x0 + 4, (SHELF.y0 + SHELF.y1) / 2, SHELF.z], lines: TAG_JOBS_LINES, gap: TAG_GAP_7 },
  // its wipe (and its leader, growing with it) from the reply's landing, so it never points at the empty in-tray while the
  // reply is still in the chute (session 6's critics); its cue's window is unchanged
  { cue: 'tag-100', words: WORDS.tag100, at: TAG_AT, anchor: 'start', foot: TAB_REST, gap: TAG_GAP_7 },
];
/** Your desk's pose: beat 7 changes nothing of it (the glass leaves your tray on its lift frame: actOne.ts youPoseAt). */
export function you7(_f: number, pose: YouPose): YouPose {
  return pose;
}

/** The beat's span for the tests and the renders. */
export const BEAT_7_SPAN = [at(44), at(50)] as const;
export { STEP_FRAMES };
