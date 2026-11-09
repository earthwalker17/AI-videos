/**
 * Beat 4 after the turn (STORYBOARD 4.2-4.5, film f1648-2140): what the Register Desk does between the
 * reel's lock and MT1, every value a pure function of the film frame and every event one of the cue
 * sheet's (cues.ts BEAT_4) or a sub-step hung off one. In cause order:
 * - 4.2 the request rises out of the old heap (1648: 3 f anticipation, its crease flattening), slides out
 *   from under the pieces on it, is posted onto the belt's foot, rides up into the throat and is fed to the
 *   head; the reel detents and drives the tape one cell, the head drops and its row inks (1680) with its
 *   vermilion stub; the notes loop's clip and tabs are wound into the reel by that turn, and the stub's ink
 *   shows on the reel's top. With the request in, the old heap drops through a hatch in the slate;
 * - 4.3 a grey-stock card rises (the request torn three ways), is struck by an ink rule and goes back down
 *   (rise 12 f, strike 6 f, exit 8 f); the index arm detents toward the bay floor (1740); a groove is cut, the
 *   bug bay's hatch opens and its bench rises (1760); the request rides out of the dispatch housing, down the
 *   ramp and along its groove whole, the door lifting before it, and climbs onto its folder on the bench,
 *   which takes its vermilion; the work light ramps in. Its Thread subscription inks into its row (1800): the
 *   tape records the subscription and no cord is drawn before C17 (design D1);
 * - 4.4 the neck-collar gauge's needle lifts to low as the first arrival comes; a ghost card (a Router with a
 *   bench, its backlog piling at its door for a bar) is struck (1920); arrivals take the next rows (a CI card,
 *   then a chat slip asking for docs) while the index keeps a detent on beats 2 and 4;
 * - 4.5 two more dispatches (1990/2000 tests, 2030/2040 docs): a groove cut, a hatch, the bay rising, its
 *   light; no carrier rides these grooves (each door stays shut: the cut is the hand-over's trace).
 * By f2140 the world is still (b)'s (state.ts deskStateAt reads `beat4At` for every frame).
 *
 * The three new bays stand closed and idle from the turn (walls, nameplate, door shut, the hatch closed under
 * them) until each is dispatched. `hatchRiseAt` is the one dispatch move every Worker uses (MT1's fresh bay
 * included): visible leaves slide open over 4 f, the bay rises on spring-heavy only once they are open, and
 * its footprint's contact tightens over the last frames of the rise.
 */
import { clamp, easings } from '@aiv/core';
import { Curve } from '@aiv/remotion-kit';
import { Easing } from 'remotion';
import { BEAT_4 } from '../cues.ts';
import { BAYS, BENCH, FEEDERS, GROOVES, NEXT_SLIP, PINS, RAMP, REQUEST, TOWER, rectC, towerTop, type BayId, type P2, type P3, type Rect } from './layout.ts';
import { DETENT, SPRING, springAt } from './state.ts';

// ------------------------------------------------------------------------------------------------
// The schedule

const sine = (t: number): number => easings.inOutSine(clamp(t));
const MOVE = Easing.bezier(0.2, 0, 0, 1);
const EXIT = Easing.bezier(0.3, 0, 0.8, 0.15);
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A stamp-in (TREATMENT Relationships): the reel detents and drives the tape one cell (`detent`, 7 f), the head drops (`stamp`) and the new print inks over 3 f. */
export interface StampIn {
  detent: number | null;
  stamp: number;
}

export const B4 = {
  /** 4.2: the request out of the heap (3 f anticipation), slid out from under the pieces on it (4 f), posted onto the belt's foot (8 f), up the belt (8 f), fed into the head (3 f) */
  requestRise: BEAT_4.requestRise,
  requestAntic: 3,
  requestSlide: 4,
  requestPost: 8,
  requestBelt: 8,
  requestFeed: 3,
  /** its stamp-in: the reel detents 7 f before the head drops */
  requestIn: { detent: BEAT_4.requestIn - 7, stamp: BEAT_4.requestIn } as StampIn,
  /** the old heap: once the request is in, the hatch under it opens (4 f), the heap falls through (8 f), the leaves shut (4 f) */
  heapOpen: BEAT_4.requestIn + 4,
  heapFall: BEAT_4.requestIn + 8,
  heapShut: BEAT_4.requestIn + 16,
  /** 4.3: the split card (rise 12 f, its pieces drift apart, strike 6 f on the cue, exit 8 f) */
  split: { rise: BEAT_4.splitCard, strike: BEAT_4.splitStrike },
  armBug: BEAT_4.armBug,
  /** the bug dispatch: the groove cut (10 f), the hatch (4 f), the bench rising on the cue */
  bug: { cut: BEAT_4.armBug + 4, cutFrames: 10, rise: BEAT_4.dispatchBug },
  /** the request's ride: pushed out of the housing's slit (6 f), off the ramp's lip (4 f), along the groove (20 f), through the door and up onto its folder on the bench (8 f) */
  ride: { out: BEAT_4.dispatchBug + 1, outFrames: 6, rampFrames: 4, grooveFrames: 20, climbFrames: 8 },
  /** the Thread's subscription inks into the request's row (the head drops on the cue; no tape advance) */
  threadRow: { detent: null, stamp: BEAT_4.threadRow } as StampIn,
  /** 4.4: the gauge's needle lifts off its stop to low as the first arrival comes */
  gauge: BEAT_4.gauge,
  ghost: { rise: BEAT_4.ghostCard, strike: BEAT_4.ghostStrike },
  /** the index keeps its detent on beats 2 and 4 under N2 */
  ticks: [1820, ...BEAT_4.rows] as readonly number[],
  /** the arrivals the Register decides on, each stamped in as the next row (CELLS_BEFORE: the CI card for the tests, the chat slip asking for docs) */
  rows: [
    { kind: 'ci', stamp: BEAT_4.rows[0] },
    { kind: 'docs', stamp: BEAT_4.rows[1] },
  ] as const,
  /** 4.5 */
  armTests: BEAT_4.armTests,
  tests: { cut: BEAT_4.armTests + 1, cutFrames: 6, rise: BEAT_4.dispatchTests },
  armDocs: BEAT_4.armDocs,
  docs: { cut: BEAT_4.armDocs + 1, cutFrames: 6, rise: BEAT_4.dispatchDocs },
  /** the work light ramps in once the bay is working (a carrier docked, or the bay risen): over 10 f on spring-effects */
  lightAfter: { bug: 0, tests: 16, docs: 16 },
} as const;

/** A counterfactual's beats (TREATMENT element sheet): rise 12 f, strike 6 f, exit 8 f. */
export const CARD_RISE = 12;
export const CARD_STRIKE = 6;
export const CARD_EXIT = 8;

/** The hatch's leaves part over 4 f; the bay rises only once they are open. */
export const HATCH_FRAMES = 4;
/** Frames after a bay's rise starts at which its hatch hole is closed again (the bay's floor plate covers it). */
export const HATCH_HOLD = 40;
/** How deep each bay's work waits under its hatch: below its tallest part (the test tower capped), so nothing of it shows before it rises. */
export const WORK_DEPTH: Record<BayId, number> = { tests: towerTop() + TOWER.dome + 8, docs: BAYS.docs.wallH + 8, bug: BENCH.z[1] + PINS.h + 6 };

// ------------------------------------------------------------------------------------------------
// One dispatch move for every Worker

export interface HatchRise {
  /** the groove cut from the ramp's foot to the door (fraction of its length) */
  cut: number;
  /** the hatch's leaves parted (0 shut .. 1 open) */
  hatch: number;
  /** the hole in the slate is open (the leaves are drawn in it) */
  hole: boolean;
  /** the bay's work risen out of its pit (0..1, spring-heavy) */
  rise: number;
  /** its contact shadow on the slate, tightening as it settles (0..1) */
  contact: number;
}

/**
 * The hatch and rise of a Worker dispatched with its rise on frame `rise`: the groove is cut over `cutFrames`
 * from `cut`, the leaves part over the 4 f before the rise, the work rises on spring-heavy; the hole closes
 * once the bay's floor covers it.
 */
export function hatchRiseAt(f: number, o: { cut: number; cutFrames: number; rise: number }): HatchRise {
  const cut = easings.outCubic(clamp((f - o.cut) / o.cutFrames));
  const open = o.rise - HATCH_FRAMES;
  const hatch = sine((f - open) / HATCH_FRAMES);
  const rise = springAt(f, o.rise, SPRING.heavy);
  const hole = f >= open && f < o.rise + HATCH_HOLD;
  // the last 4 f of the rise's travel (it reaches 0.97 of its travel in about 14 f on spring-heavy): the contact closes in
  const contact = clamp((rise - 0.8) / 0.2);
  return { cut, hatch, hole, rise, contact };
}

export interface BayDispatch extends HatchRise {
  /** the door (0 shut .. 1 lifted) */
  door: number;
  /** the work light (0 idle, dark .. 1 computing) */
  light: number;
}

const BAY_PLAN: Record<BayId, { cut: number; cutFrames: number; rise: number }> = { bug: B4.bug, tests: B4.tests, docs: B4.docs };

/** The request's ride's frames (the bug dispatch): out of the housing, off the ramp, along the groove, through the door, up onto the bench. */
export const RIDE = (() => {
  const R = B4.ride;
  const ramp = R.out + R.outFrames;
  const groove = ramp + R.rampFrames;
  const door = groove + R.grooveFrames;
  const dock = door + R.climbFrames;
  return { out: R.out, ramp, groove, door, dock };
})();

/** Each bay's dispatch at film frame f. */
export function bayDispatchAt(f: number, id: BayId): BayDispatch {
  const h = hatchRiseAt(f, BAY_PLAN[id]);
  // only the request's bay takes a carrier: its door lifts (4 f) and is fully up 4 f before the request reaches it, drops 6 f after it is in
  const door = id === 'bug' ? sine((f - (RIDE.door - 18)) / 4) * (1 - sine((f - (RIDE.door + 10)) / 4)) : 0;
  const lightFrom = id === 'bug' ? RIDE.dock + 2 : BAY_PLAN[id].rise + B4.lightAfter[id];
  return { ...h, door, light: springAt(f, lightFrom, SPRING.effects) };
}

// ------------------------------------------------------------------------------------------------
// The tape: the rows printed since the turn

export interface TapeCell {
  kind: 'chat' | 'ci' | 'docs' | 'test';
  request?: boolean;
  /** the request's Thread subscription, inked into its row (no cord yet: design D1) */
  thread?: boolean;
}
/** The tape's states, newest cell first: each a stamp-in (the turn's first row at f1624, then beat 4's). */
export const TAPE_ROWS: readonly { cells: readonly TapeCell[]; at: StampIn }[] = [
  { cells: [{ kind: 'chat' }], at: { detent: null, stamp: 1620 } },
  { cells: [{ kind: 'chat', request: true }, { kind: 'chat' }], at: B4.requestIn },
  { cells: [{ kind: 'chat', request: true, thread: true }, { kind: 'chat' }], at: B4.threadRow },
  { cells: [{ kind: 'ci' }, { kind: 'chat', request: true, thread: true }, { kind: 'chat' }], at: { detent: B4.rows[0].stamp - 7, stamp: B4.rows[0].stamp } },
  { cells: [{ kind: 'docs' }, { kind: 'ci' }, { kind: 'chat', request: true, thread: true }, { kind: 'chat' }], at: { detent: B4.rows[1].stamp - 7, stamp: B4.rows[1].stamp } },
];

export interface TapeState {
  /** the state shown (TAPE_ROWS index; -1: the bare leader) */
  row: number;
  /** its ink stage: 0 and 1 the first two frames of the spread, 2 printed */
  stage: number;
  /** the tape driven on toward the reel by the next stamp-in's detent (0..1 of one cell) */
  advance: number;
}

/**
 * The tape at film frame f, as MT1 stamps (state.ts EVENTS_B): the reel detents and the tape slides one cell
 * east (7 f, the old print on it), the head drops, and from 2 f after it the new state shows with the new
 * print's ink at its first stage, then its second, then printed.
 */
export function tapeAt(f: number): TapeState {
  let row = -1;
  let stage = 2;
  for (let i = 0; i < TAPE_ROWS.length; i++) {
    const s = TAPE_ROWS[i].at.stamp;
    // the turn's first row prints at f1624 (its head drops at f1620): its stages follow the turn's print
    const first = i === 0 ? 1624 : s + 2;
    if (f >= first) {
      row = i;
      stage = Math.min(2, f - first);
    }
  }
  const next = TAPE_ROWS[row + 1];
  const advance = next && next.at.detent !== null ? sine((f - next.at.detent) / 7) : 0;
  return { row, stage, advance };
}

/** The print head's hammer at f for beat 4's stamp-ins (0 up .. 1 down), as MT1's. */
export function hammerAt(f: number): number {
  let h = 0;
  for (const r of TAPE_ROWS.slice(1)) h = Math.max(h, clamp((f - r.at.stamp) / 1.5) * (1 - clamp((f - r.at.stamp - 4) / 2)));
  return h;
}

/** The newest cell's light (the reading pool's stamp): lit as each print inks, out when the tape next moves on (the last one at MT1's detent, f2183). */
export function cellLitAt(f: number, nextDetent = 2183): number {
  const stamps = [1624, ...TAPE_ROWS.slice(1).filter((r) => r.at.detent !== null).map((r) => r.at.stamp)];
  let lit = 0;
  stamps.forEach((s, i) => {
    const off = i + 1 < stamps.length ? TAPE_ROWS.slice(1).filter((r) => r.at.detent !== null)[i].at.detent! : nextDetent;
    lit += springAt(f, s + 1, SPRING.effects) - springAt(f, off, SPRING.effects);
  });
  return clamp(lit);
}

// ------------------------------------------------------------------------------------------------
// The reel

/** Beat 4's detents (each stamp-in that drives the tape on). */
export const REEL_DETENTS: readonly number[] = TAPE_ROWS.slice(1).flatMap((r) => (r.at.detent === null ? [] : [r.at.detent]));
/** One detent's turn (radians, clockwise): as MT1's (objects/Register.tsx turns the reel -0.26 a detent). */
export const DETENT_TURN = 0.26;
/**
 * Where the coil ends its spin at the lock (radians past whole turns, counter-clockwise): beat 4's detents then
 * bring the reel to rest at the Register's own angle (0) by MT1, so still (b)'s reel is the lookdev's.
 */
export const REEL_LOCK = DETENT_TURN * REEL_DETENTS.length;
/** The reel's angle at f (radians, counter-clockwise, 0 at the Register's rest from MT1 on). */
export function reelAt(f: number): number {
  return REEL_LOCK - DETENT_TURN * REEL_DETENTS.reduce((a, t) => a + springAt(f, t, SPRING.detent), 0);
}
/** The request's stub on the reel's top inks with its row: stages 0, 1, then printed (2); -1 before. */
export function stubAt(f: number): number {
  const s = B4.requestIn.stamp + 1;
  return f < s ? -1 : Math.min(2, f - s);
}
/**
 * The notes loop's clip and tabs, riding the reel since the lock, are wound in as the request's detent turns
 * it: drawn in toward the hub and down under the pack's top (0 riding .. 1 gone); null once gone.
 */
export function ridersAt(f: number): { sink: number } | null {
  const d = B4.requestIn.detent!;
  if (f >= d + 7) return null;
  return { sink: sine((f - d) / 7) };
}

// ------------------------------------------------------------------------------------------------
// The index arm and the gauge

/** The arm's detents in beat 4 (from the turn's, at the test tower's notch): toward each bay as it is dispatched (read lazily: state.ts and this module import each other). */
const armSteps = (): readonly { at: number; to: number }[] => [
  { at: B4.armBug, to: DETENT.bug },
  { at: B4.armTests, to: DETENT.tests },
  { at: B4.armDocs, to: DETENT.docs },
];
/** The arm's angle at f (radians): its detents on spring-detent, and under N2 a one-notch tick on beats 2 and 4. */
export function armAt(f: number): number {
  let a = DETENT.tests;
  for (const s of armSteps()) a += (s.to - a) * springAt(f, s.at, SPRING.detent);
  const tick = B4.ticks.reduce((t, at) => t + springAt(f, at, SPRING.detent) - springAt(f, at + 4, SPRING.detent), 0);
  return a + 0.07 * tick;
}
/** Where the arm rests once beat 4 is over (MT1 turns it from here to you). */
export const armRest = (): number => DETENT.docs;

/** The neck-collar gauge's needle (radians about its hub): on its stop until the first arrival, then low (design D5: an arc gauge). */
export const GAUGE = { stop: Math.PI * 1.25, low: Math.PI * 0.86 } as const;
export const gaugeAt = (f: number): number => GAUGE.stop + (GAUGE.low - GAUGE.stop) * springAt(f, B4.gauge, SPRING.detent);

// ------------------------------------------------------------------------------------------------
// Cargo: the request, the arrivals

/** A carrier's pose: centre, heading about z, slope (radians, nose up), its landing squash, its transit light. */
export interface Carry {
  p: P3;
  heading: number;
  slope: number;
  squash: number;
  transit: number;
}

/** The belt's line from the gate's keep side up into the throat (as the turn's first slip rides it). */
const BELT_HEADING = Math.atan2(NEXT_SLIP.throat[1] - NEXT_SLIP.gate[1], NEXT_SLIP.throat[0] - NEXT_SLIP.gate[0]);
const BELT_SLOPE = Math.atan2(NEXT_SLIP.throat[2] - NEXT_SLIP.gate[2], Math.hypot(NEXT_SLIP.throat[0] - NEXT_SLIP.gate[0], NEXT_SLIP.throat[1] - NEXT_SLIP.gate[1]));

/** Posted onto the belt's foot (an arc from `from`), up the belt, into the throat, fed to the head: the ride every arrival shares. */
function intakeRide(f: number, from: P3, fromHeading: number, post: number, postFrames: number, beltFrames: number, feedFrames: number, apex: number): Carry | null {
  const S = NEXT_SLIP;
  const belt = post + postFrames;
  const throat = belt + beltFrames;
  const head = throat + feedFrames;
  if (f < post || f >= head + 1) return null;
  if (f < belt) {
    const u = clamp((f - post) / postFrames);
    const e = Math.sin((u * Math.PI) / 2) ** 2;
    const p = lerp3(from, S.gate, e);
    return { p: [p[0], p[1], p[2] + 4 * apex * u * (1 - u)], heading: fromHeading + (BELT_HEADING - fromHeading) * e, slope: 0.3 * Math.cos(u * Math.PI) * Math.sin(u * Math.PI), squash: 0, transit: 0 };
  }
  if (f < throat) {
    const squash = Math.max(0, 1 - (f - belt) / 3);
    return { p: lerp3(S.gate, S.throat, (f - belt) / beltFrames), heading: BELT_HEADING, slope: BELT_SLOPE, squash, transit: 0 };
  }
  return { p: lerp3(S.throat, S.head, MOVE(clamp((f - throat) / feedFrames))), heading: 0, slope: 0, squash: 0, transit: 0 };
}

export interface Arrival {
  kind: 'chat' | 'ci';
  pose: Carry;
}
/** A CI card's mouth: it is pushed out from under the card lying in the feeder's mouth (4 f). */
const CI_OUT: { from: P3; to: P3 } = { from: [FEEDERS.ci.x1 - 30, rectC(FEEDERS.ci)[1] - 2, 5.2], to: [FEEDERS.ci.x1 + 30, rectC(FEEDERS.ci)[1] - 2, 5.2] };
/** A chat slip comes out of the spout from inside its drum (as MT1's next slip). */
const SPOUT_OUT: { from: P3; to: P3 } = { from: [NEXT_SLIP.spout[0] - 60, NEXT_SLIP.spout[1], NEXT_SLIP.spout[2] + 2], to: NEXT_SLIP.spout };

/** The arrivals in transit at f: each out of its feeder (4 f), posted over the gate (12 f), up the belt (8 f), fed to the head (3 f), arriving for its stamp-in. */
export function arrivalsAt(f: number): Arrival[] {
  const out: Arrival[] = [];
  for (const r of B4.rows) {
    const kind = r.kind === 'ci' ? 'ci' : 'chat';
    // feed ends as the reel detents (7 f before the stamp)
    const feedEnd = r.stamp - 7;
    const post = feedEnd - 3 - 8 - 12;
    const emerge = post - 4;
    const src = kind === 'ci' ? CI_OUT : SPOUT_OUT;
    if (f >= emerge && f < post) out.push({ kind, pose: { p: lerp3(src.from, src.to, easings.outCubic(clamp((f - emerge) / 4))), heading: 0, slope: 0, squash: 0, transit: 0 } });
    else {
      const p = intakeRide(f, src.to, 0, post, 12, 8, 3, NEXT_SLIP.apex);
      if (p) out.push({ kind, pose: p });
    }
  }
  return out;
}

/** The request in the old heap (actOne.ts REQUEST_A, which beat4.test.ts holds this equal to): creased, its east flap lifted. */
export const REQUEST_HEAP = { c: [-762, 150] as P2, rot: 0.38, z: 0.9 } as const;

export interface RequestState {
  /** where it is; null while it is inside the Register (fed to the head, waiting in the housing) or once docked on the bench (objects/Bay.tsx draws it there) */
  pose: Carry | null;
  /** its crease (the east flap's lift, 0 flat .. 1 act one's) */
  crease: number;
}

/** The request's dispatch ride's path: out of the housing's slit, off the ramp's lip onto the bug groove, along it to the door, then up onto its folder. */
const RIDE_FROM: P3 = [RAMP.x - REQUEST.l / 2 - 1, (RAMP.y0 + RAMP.y1) / 2, 73];
const RIDE_OUT_AT: P3 = [RAMP.x + 1 + REQUEST.l / 2 + 3, (RAMP.y0 + RAMP.y1) / 2, 72.5];
const RIDE_LANDS: P3 = [GROOVES.bug[0][0], GROOVES.bug[0][1], 1.4];
/** Where it docks: on its folder on the bench (layout.ts REQUEST), as objects/Bay.tsx draws it at rest. */
export const REQUEST_DOCK: P3 = [REQUEST.c[0], REQUEST.c[1], REQUEST.z - 0.3];
export const REQUEST_DOCK_HEADING = REQUEST.rot - Math.PI / 2;

function polyAt(pts: readonly P3[], s: number): { p: P3; dir: P3 } {
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1], q[2] - pts[i][2]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = clamp(s) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const t = seg[i] > 0 ? Math.min(d / seg[i], 1) : 0;
      return { p: lerp3(pts[i], pts[i + 1], t), dir: [(pts[i + 1][0] - pts[i][0]) / seg[i], (pts[i + 1][1] - pts[i][1]) / seg[i], (pts[i + 1][2] - pts[i][2]) / seg[i]] };
    }
    d -= seg[i];
  }
  return { p: pts[pts.length - 1], dir: [0, 0, 0] };
}
/** The bug groove's centreline (from the ramp's foot to just inside the door), at the request's riding height. */
export const BUG_LINE: readonly P3[] = (() => {
  const g = new Curve(GROOVES.bug.map((p) => [p[0], p[1]])).polyline(13).map((p): P3 => [p[0], p[1], 1.4]);
  // on through the door straight south, clear of the bay's west wall, to just inside its north wall (its heading turns
  // smoothly into it: lineHeading)
  return [...g, [(BAYS.bug.door[0] + BAYS.bug.door[1]) / 2, BAYS.bug.box.y1 - BAYS.bug.wall - 14, 1.4]];
})();
/** The groove's heading at s (a central difference over its polyline, so it turns smoothly from segment to segment). */
function lineHeading(s: number): number {
  const a = polyAt(BUG_LINE, Math.max(0, s - 0.05)).p;
  const b = polyAt(BUG_LINE, Math.min(1, s + 0.05)).p;
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

export function requestAt(f: number): RequestState {
  const B = B4;
  const r0 = B.requestRise;
  const slide = r0 + B.requestAntic;
  const post = slide + B.requestSlide;
  const heap: P3 = [REQUEST_HEAP.c[0], REQUEST_HEAP.c[1], REQUEST_HEAP.z];
  const axis: P2 = [Math.cos(REQUEST_HEAP.rot), Math.sin(REQUEST_HEAP.rot)];
  const slid: P3 = [heap[0] + axis[0] * 46, heap[1] + axis[1] * 46, 1.4];
  if (f < r0) return { pose: { p: heap, heading: REQUEST_HEAP.rot, slope: 0, squash: 0, transit: 0 }, crease: 1 };
  if (f < slide) return { pose: { p: heap, heading: REQUEST_HEAP.rot, slope: 0, squash: 0, transit: 0 }, crease: 1 - sine((f - r0) / B.requestAntic) };
  if (f < post) {
    // it slides out from under the pieces on it along its own axis, the light through its beetle coming up as it moves
    const u = easings.inQuad(clamp((f - slide) / B.requestSlide));
    return { pose: { p: lerp3(heap, slid, u), heading: REQUEST_HEAP.rot, slope: 0, squash: 0, transit: clamp((f - slide) / 3) }, crease: 0 };
  }
  const ride = intakeRide(f, slid, REQUEST_HEAP.rot, post, B.requestPost, B.requestBelt, B.requestFeed, 46);
  if (ride) return { pose: { ...ride, transit: f < post + B.requestPost + B.requestBelt ? 1 : 0 }, crease: 0 };
  // inside the Register until it is dispatched: then out of the housing's slit, down the ramp, along its groove, up onto its folder
  const R = RIDE;
  if (f < R.out || f >= R.dock + 12) return { pose: null, crease: 0 };
  const transit = (t: number) => clamp(t / 4) * clamp((R.dock - f) / 6) ** 2;
  if (f < R.ramp) return { pose: { p: lerp3(RIDE_FROM, RIDE_OUT_AT, sine((f - R.out) / (R.ramp - R.out))), heading: 0, slope: 0, squash: 0, transit: transit(f - R.out) }, crease: 0 };
  if (f < R.groove) {
    const t = clamp((f - R.ramp) / (R.groove - R.ramp));
    const a = RIDE_OUT_AT;
    const b = RIDE_LANDS;
    return { pose: { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t * t], heading: 0, slope: -0.62 * Math.sin(Math.PI * t), squash: 0, transit: transit(f - R.out) }, crease: 0 };
  }
  if (f < R.door) {
    // along the groove at an even pace (linear transport), easing out only into the door
    const s = clamp((f - R.groove) / (R.door - R.groove));
    const { p } = polyAt(BUG_LINE, s);
    // it lands off the ramp heading east and swivels into the groove over its first 4 f
    const turn = sine((f - R.groove) / 4);
    return { pose: { p, heading: lineHeading(s) * turn, slope: 0, squash: 0, transit: transit(f - R.out) }, crease: 0 };
  }
  if (f < R.dock) {
    // through the door, up over the bench's edge and down onto its folder (an arc), turning to lie as it will
    const u = clamp((f - R.door) / (R.dock - R.door));
    const e = Math.sin((u * Math.PI) / 2) ** 2;
    const from = BUG_LINE[BUG_LINE.length - 1];
    const h0 = lineHeading(1);
    const p = lerp3(from, REQUEST_DOCK, e);
    return { pose: { p: [p[0], p[1], p[2] + 4 * 34 * u * (1 - u) * (1 - 0.4 * u)], heading: h0 + (REQUEST_DOCK_HEADING - h0) * e, slope: 0.25 * Math.sin(Math.PI * u), squash: 0, transit: transit(f - R.out) }, crease: 0 };
  }
  // docked: settling on spring-dock with a 3% squash; from 12 f on objects/Bay.tsx draws it at rest
  const settle = springAt(f, R.dock, SPRING.dock);
  const squash = Math.max(0, 1 - (f - R.dock) / 4) * Math.min(1, (f - R.dock + 1) / 1.5);
  return { pose: { p: [REQUEST_DOCK[0], REQUEST_DOCK[1], REQUEST_DOCK[2] + 2.5 * (1 - settle)], heading: REQUEST_DOCK_HEADING, slope: 0, squash, transit: 0 }, crease: 0 };
}

/** The folder on the bench takes the request's vermilion as it lands on it (0 its own stock .. 1 vermilion). */
export const folderTakeAt = (f: number): number => springAt(f, RIDE.dock, SPRING.effects);

// ------------------------------------------------------------------------------------------------
// The old heap

/** The hatch under the heap: its box (world, clear of the feeders' bodies and of your desk) and its pit's depth. */
export const HEAP_HATCH: { box: Rect; depth: number } = { box: { x0: -912, x1: -592, y0: -2, y1: 446 }, depth: 46 };

export interface HeapState {
  /** the request has left it: the pieces that lay on it drop onto what is under them (0..1) */
  settle: number;
  /** the hatch's leaves (0 shut .. 1 open), whether the hole is open, how far the heap has fallen (u) */
  hatch: number;
  hole: boolean;
  fall: number;
  /** under the slate, the leaves shut over it: nothing to draw */
  gone: boolean;
}
export function heapAt(f: number): HeapState {
  const left = B4.requestRise + B4.requestAntic + B4.requestSlide;
  const settle = sine((f - left) / 2);
  const open = sine((f - B4.heapOpen) / HATCH_FRAMES) * (1 - sine((f - B4.heapShut) / HATCH_FRAMES));
  const t = Math.max(0, f - B4.heapFall);
  return { settle, hatch: open, hole: f >= B4.heapOpen && f < B4.heapShut + HATCH_FRAMES, fall: 1.6 * t * t, gone: f >= B4.heapShut + HATCH_FRAMES };
}

// ------------------------------------------------------------------------------------------------
// Counterfactual cards (objects/Counterfactual.tsx)

export interface CardState {
  /** risen (0..1, the enter curve over 12 f), struck (the ink rule drawn 0..1 over 6 f), gone (0..1, the exit curve over 8 f) */
  rise: number;
  strike: number;
  exit: number;
  /** frames since it was up (its own play: the split's pieces drifting, the ghost's backlog piling) */
  play: number;
}
/** A counterfactual risen on `rise`, struck on `strike`; null outside its life. */
export function cardAt(f: number, c: { rise: number; strike: number }): CardState | null {
  const end = c.strike + CARD_STRIKE + CARD_EXIT;
  if (f < c.rise || f >= end) return null;
  // the rise on an even in-out (its two phases, up through the slate standing and lying back, each read), the exit on the exit curve
  return { rise: sine((f - c.rise) / CARD_RISE), strike: clamp((f - c.strike) / CARD_STRIKE), exit: EXIT(clamp((f - c.strike - CARD_STRIKE) / CARD_EXIT)), play: f - c.rise - CARD_RISE };
}
/**
 * Where beat 4's cards rise: up out of the slate west of the intake (the old heap's ground, open slate by then),
 * standing, through the slate as through a slit, then lying back to face the camera at their hover (tilt from flat).
 */
export const CARD_SPOT = { at: [-730, 100, 150] as P3, tilt: 0.3, w: 280, h: 176 } as const;
/** A card's pose: its centre, its tilt from flat (pi/2 standing), its scale (1). Standing it comes up through the slate (all of it under the slate at 0), then lies back to its hover; it goes back the same way. */
export function cardPose(c: CardState): { c: P3; tilt: number; scale: number } {
  const k = c.rise * (1 - c.exit);
  const h = CARD_SPOT.h;
  const [x, y, z] = CARD_SPOT.at;
  // up through the slate standing (its bottom edge clear of it at a = 1), then up to its hover lying back
  const a = clamp(k / 0.45);
  const b = clamp((k - 0.45) / 0.55);
  const zc = -h / 2 - 1 + (h + 3) * a + (z - (h / 2 + 2)) * easings.inOutSine(b);
  return { c: [x, y, zc], tilt: Math.PI / 2 + (CARD_SPOT.tilt - Math.PI / 2) * easings.inOutSine(b), scale: 1 };
}

// ------------------------------------------------------------------------------------------------
// The whole state

export interface Beat4State {
  bays: Record<BayId, BayDispatch>;
  tape: TapeState;
  hammer: number;
  cellLit: number;
  reel: number;
  stub: number;
  riders: { sink: number } | null;
  arm: number;
  gauge: number;
  request: RequestState;
  folderTake: number;
  arrivals: Arrival[];
  heap: HeapState;
  cards: { split: CardState | null; ghost: CardState | null };
  /** the test tower's lamps lit as its tests start (bottom up, 2 f apart, 4 f each) */
  lamps: number[];
}

/** Beat 4's state at film frame f (pure): before the turn's end it is the closed, idle world the turn leaves; after f2140 still (b)'s. */
export function beat4At(f: number): Beat4State {
  const bays = { bug: bayDispatchAt(f, 'bug'), tests: bayDispatchAt(f, 'tests'), docs: bayDispatchAt(f, 'docs') };
  const lampsOn = B4.tests.rise + B4.lightAfter.tests + 4;
  return {
    bays,
    tape: tapeAt(f),
    hammer: hammerAt(f),
    cellLit: cellLitAt(f),
    reel: reelAt(f),
    stub: stubAt(f),
    riders: ridersAt(f),
    arm: armAt(f),
    gauge: gaugeAt(f),
    request: requestAt(f),
    folderTake: folderTakeAt(f),
    arrivals: arrivalsAt(f),
    heap: heapAt(f),
    cards: { split: cardAt(f, B4.split), ghost: cardAt(f, B4.ghost) },
    lamps: [0, 1, 2].map((i) => sine((f - lampsOn - 2 * i) / 4)),
  };
}
