/**
 * What the Register Desk is doing at a film frame: a pure function of the frame, so any frame
 * renders the same whichever frame its page started on.
 *
 * Around style frame (b) (C12 "Workers report up. Only the Router talks to you.") the handshake runs
 * in cause order (STORYBOARD 4.6, synthesis §5 MT1), all inside MT1 (f2140–2340):
 * - 2156 the test tower caps; 2160 (downbeat) its work light dims;
 * - 2163 its report card #0408 leaves the tower and flies 18 f under the transit light (the
 *   treatment's one transit light rides a report card or a dispatch folder, never a reply) up into
 *   the deck's mouth, docking on spring-dock at 2181;
 * - stamp-in: 2183 the print head drops for 4 f; the card's header prints into the newest window
 *   cell (its ID at ≥ 24 px) and the older cells dim a step; 2187 the reel detents one step; 2189
 *   the card's body folds into a tab (8 f) and 2197 the tab drops into the spill drawer (6 f):
 *   Inline & Spill;
 * - 2200 (downbeat) the index arm turns west to you and settles on spring-detent;
 * - 2206 the reply #0408 ok emerges from the slot under the index sector (4 f), rides the chute
 *   from 2210 for 22 f, turns along its exit curve and lands in your in-tray beside #0403 at 2232
 *   (spring-dock, 3% squash); your lamp brightens a step at 2234.
 * Still B (lookdev/frames.ts) is f2218: the cell lit with #0408, the card folded away, the arm
 * west, the reply about 30% down the chute.
 *
 * Focus (synthesis §2): during a beat, what is not part of its action steps down to 55% contrast and
 * 30% chroma over 14 f (`stepAt`). Easing uses the film's spring tokens, mass 1.
 */
import { clamp, easings } from '@aiv/core';
import { Curve } from '@aiv/remotion-kit';
import { spring } from 'remotion';
import { BEAT, FPS } from '../cues.ts';
import { CARD, CARD_C, CHUTE, DISPATCH, DRAWER, FOLDER_OUT, FOLDER_SLOT, FRESH, GROOVE_FRESH, INDEX, LAMP, LOUPE, MOUTH, NEXT_SLIP, PINS, RAMP, TOWER, rectC, towerTop, type P2, type P3 } from './layout.ts';

/** Remotion spring configs from the synthesis's tokens (mass 1, c = 2ζ√k). Remotion's default spring is never used. */
export const SPRING = {
  settle: { stiffness: 380, damping: 31.2, mass: 1 },
  dock: { stiffness: 800, damping: 33.9, mass: 1 },
  heavy: { stiffness: 200, damping: 22.6, mass: 1 },
  detent: { stiffness: 600, damping: 44.1, mass: 1 },
  effects: { stiffness: 1600, damping: 80, mass: 1 },
} as const;

/** A spring from 0 to 1 starting at frame `start` (0 before it). */
export const springAt = (f: number, start: number, config: (typeof SPRING)[keyof typeof SPRING]): number =>
  f <= start ? 0 : spring({ frame: f - start, fps: FPS, config: { ...config, overshootClamping: false } });

/** The handshake round C12 (film frames). */
export const EVENTS_B = {
  testsCap: 2160,
  testsDim: 2160,
  /** the card is pushed out of the slot in the tower's cap (4 f), then flies */
  cardEmerge: 2160,
  cardEject: 2164,
  cardFly: 18,
  /** the reel detents and drives the tape on one cell (7 f) while the header slides up from the holder */
  reelDetent: 2183,
  tapeFrames: 7,
  header: 2184,
  headerFrames: 6,
  /** the print head drops (4 f) and #0408 prints into the newest cell, its ink spreading over 3 f */
  stampIn: 2190,
  /** the test tower steps down once it has reported */
  testsStep: 2186,
  fold: 2193,
  foldFrames: 8,
  tabDrop: 2201,
  tabFrames: 6,
  armTurn: 2200,
  slipLeave: 2208,
  emergeFrames: 4,
  slipRide: 22,
  lampUp: 2236,
  /** the bug bay's pins flip one per beat from here (4 f each), cycling through the six */
  pinsFrom: 2120,
  pinFlip: 4,
} as const;
/** The reply starts riding once it has emerged, and lands at the end of its ride. */
export const SLIP_RIDE_FROM = EVENTS_B.slipLeave + EVENTS_B.emergeFrames;
export const SLIP_LANDS = SLIP_RIDE_FROM + EVENTS_B.slipRide;

/** The angle (radians, from +x) of the index arm's detents: toward each party it can address. */
export const DETENT = {
  /** toward you, stopping at the chute's lip (never over the reply) */
  you: Math.atan2(CHUTE[0][1] - 14 - INDEX.pivot[1], CHUTE[0][0] - 8 - INDEX.pivot[0]),
  tests: Math.atan2(139 - INDEX.pivot[1], -232 - INDEX.pivot[0]),
  docs: Math.atan2(139 - INDEX.pivot[1], 150 - INDEX.pivot[0]),
  bug: Math.atan2(90 - INDEX.pivot[1], 298 - INDEX.pivot[0]),
  /** toward the fresh bay MT1 dispatches to (its centre) */
  fresh: Math.atan2(rectC(FRESH.box)[1] - INDEX.pivot[1], rectC(FRESH.box)[0] - INDEX.pivot[0]),
} as const;

/** Beat 5's downbeat: the starter key leaves your tray and your lamp dims a step (cues.ts trait-proactive). */
export const LAMP_DIMS = 2340;

/** Your lamp's attention steps: the bulb's level and its pool (a step dimmer while you wait). */
export const LAMP_STEPS = { dim: 0.62, up: 0.9 } as const;

/** What steps down during a beat: everything not in its action. */
export type FocusId = 'intake' | 'gate' | 'belt' | 'plate' | 'fanfold' | 'policy' | 'docsBay' | 'bugBay' | 'cord' | 'reel' | 'lock' | 'gauge';
/** No Thread cord before C17's beat: it first pays out at 7.1 (f3440); before that a Thread is a row on the tape (design D1). */
export const CORD_FROM = 3440;
/**
 * Per-beat focus sets (film frames). C12's action is the handshake: the test tower, the card, the
 * mouth, the cell, the arm, the chute, the reply, your in-tray. The bug bay steps down too (its slot
 * keeps working and the request's vermilion stays), and so do the reel's face and the lock.
 */
export const FOCUS_BEATS: readonly { id: string; from: number; to: number; step: readonly FocusId[] }[] = [
  { id: 'c12', from: 2130, to: 2320, step: ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'cord', 'reel', 'lock', 'gauge'] },
  // N5 at the window (still C): the report, the window, the head, the mouth and the drawer are the action
  { id: 'n5', from: 3040, to: 3216, step: ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'cord', 'reel', 'lock', 'gauge'] },
];
/** The step-down ramp, frames (synthesis: 12–16 f). */
export const STEP_FRAMES = 14;

export interface DeskState {
  f: number;
  /** the index arm's angle (radians) */
  arm: number;
  /** the reply: emerging from the slot (0..1), then progress down the chute 0..1, its landing squash and settle; null before it leaves */
  slip: { emerge: number; s: number; squash: number; settle: number } | null;
  /** your lamp's level (0..1 scale of its pool and bulb) */
  lamp: number;
  /** the report card in flight: arc progress 0..1, world position (null when not flying) */
  card: { s: number; pos: P3 } | null;
  /** the card at the mouth: docked (settling on spring-dock), folding into a tab, the tab dropping into the drawer */
  dock: { settle: number; fold: number; drop: number; gone: boolean } | null;
  /** the print head's stamp 0..1 (down at 1) */
  stamp: number;
  /** the stamp-in: the newest cell carries the new report (0 before, 1 after) and lights */
  cellLit: number;
  /** the reel's detent step 0..1 */
  reel: number;
  /** the one transit light (on the report card in flight), 0..1 */
  transit: number;
  /** the test tower's work light, 1 working → 0 done */
  testsLight: number;
  /** the test tower steps down once it has reported (0..1, its own ramp) */
  testsStep: number;
  /** the card rising out of the cap's slot before it flies (0..1), null outside it */
  cardOut: number | null;
  /** the tape advancing one cell, driven by the reel's detent (0..1) */
  tape: number;
  /** the report's header sliding up from the holder to the print head (0..1, 1 = arrived) */
  header: number;
  /** the #0408 ink spreading in the newest cell (0..1) */
  ink: number;
  /** the test tower's cap: 0 open → 1 closed */
  testsCap: number;
  /** the bug bay's work slot (computing): 1 */
  bugLight: number;
  /** each of the bug bay's six pins: 0 graphite face up (not run) → 1 enamel face up (passed) */
  pins: number[];
  /** the docs galley: how far the current line is set (0..1) */
  galley: number;
  /** the focus step-down: how far it has gone (0..1) and what it applies to; `own`: parts on their own ramp (kit.tsx `Step on="own"`) */
  step: { amount: number; ids: readonly FocusId[]; own?: { amount: number; ids: readonly FocusId[] } };
  /** MT1's next dispatch (f2226-2340): the chat slip judged and stamped in, the fresh bay and its folder */
  next: NextState;
  /** still (c): the request's report at the window; null before it */
  cache: CacheState | null;
  /** the finished test bay sinking into its hatch (0..1, spring-heavy) */
  testsSink: number;
}

/** Arc length positions along a polyline (for the chute ride). */
export function polylineAt(pts: readonly P3[], s: number): { p: P3; dir: P3 } {
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1], q[2] - pts[i][2]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = clamp(s) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const t = seg[i] > 0 ? Math.min(d / seg[i], 1) : 0;
      const a = pts[i];
      const b = pts[i + 1];
      const p: P3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      return { p, dir: [(b[0] - a[0]) / seg[i], (b[1] - a[1]) / seg[i], (b[2] - a[2]) / seg[i]] };
    }
    d -= seg[i];
  }
  return { p: pts[pts.length - 1], dir: [0, 0, 0] };
}

/** The card's flight: from the tower's lens cap up into the mouth, a parabolic arc `apex` above the chord. */
export const CARD_FROM: P3 = [TOWER.x, TOWER.y, towerTop() + TOWER.dome + 2];
export const CARD_TO: P3 = MOUTH.land;
export function cardArc(s: number): { pos: P3 } {
  const u = clamp(s);
  return { pos: [CARD_FROM[0] + (CARD_TO[0] - CARD_FROM[0]) * u, CARD_FROM[1] + (CARD_TO[1] - CARD_FROM[1]) * u, CARD_FROM[2] + (CARD_TO[2] - CARD_FROM[2]) * u + 4 * CARD.apex * u * (1 - u)] };
}

/** Where the folded tab falls: from the mouth into the spill drawer (an arc, dropping). */
export const TAB_FROM: P3 = MOUTH.land;
export const TAB_TO: P3 = [rectC(DRAWER.box)[0], rectC(DRAWER.box)[1], DRAWER.z[0] + 8];
export function tabArc(u: number): P3 {
  const t = clamp(u);
  return [TAB_FROM[0] + (TAB_TO[0] - TAB_FROM[0]) * t, TAB_FROM[1] + (TAB_TO[1] - TAB_FROM[1]) * t, TAB_FROM[2] + (TAB_TO[2] - TAB_FROM[2]) * t * t + 14 * t * (1 - t)];
}

/** The focus step-down at film frame f: ramps in over STEP_FRAMES from a beat's start, out after its end. */
export function stepAt(f: number): DeskState['step'] {
  for (const b of FOCUS_BEATS) {
    if (f < b.from || f >= b.to + STEP_FRAMES) continue;
    const amount = Math.min(easings.inOutSine(clamp((f - b.from) / STEP_FRAMES)), 1 - easings.inOutSine(clamp((f - b.to) / STEP_FRAMES)));
    return { amount, ids: b.step };
  }
  return { amount: 0, ids: [] };
}

/** The state of the desk at film frame `f` (pure). */
export function deskStateAt(f: number): DeskState {
  const E = EVENTS_B;
  // the test tower finishes: cap, dim; its card flies up into the mouth
  const testsCap = springAt(f, E.testsCap, SPRING.detent);
  const testsLight = 1 - springAt(f, E.testsDim, SPRING.effects);
  const fly = (f - E.cardEject) / E.cardFly;
  const card = fly >= 0 && fly < 1 ? { s: easings.inOutSine(fly), pos: cardArc(easings.inOutSine(fly)).pos } : null;
  // the transit light fades in over 4 f after the card leaves and out over the 4 f before it docks (dark in the dock frame)
  const flown = f - E.cardEject;
  const transit = card ? clamp(flown / 4) * clamp((E.cardFly - flown) / 4) : 0;
  // at the mouth: dock (spring-dock settle), stamp, fold, the tab drops into the drawer
  const docked = f >= E.cardEject + E.cardFly;
  const dock = docked
    ? {
        settle: springAt(f, E.cardEject + E.cardFly, SPRING.dock),
        fold: easings.inOutSine(clamp((f - E.fold) / E.foldFrames)),
        drop: clamp((f - E.tabDrop) / E.tabFrames),
        gone: f >= E.tabDrop + E.tabFrames,
      }
    : null;
  const stamp = clamp((f - E.stampIn) / 1.5) * (1 - clamp((f - E.stampIn - 4) / 2));
  const cellLit = springAt(f, E.stampIn + 1, SPRING.effects);
  const reel = springAt(f, E.reelDetent, SPRING.detent);
  const tape = easings.inOutSine(clamp((f - E.reelDetent) / E.tapeFrames));
  const header = easings.inOutSine(clamp((f - E.header) / E.headerFrames));
  const ink = clamp((f - E.stampIn - 1) / 3);
  const cardOut = f >= E.cardEmerge && f < E.cardEject ? easings.outCubic((f - E.cardEmerge) / (E.cardEject - E.cardEmerge)) : null;
  const testsStep = easings.inOutSine(clamp((f - E.testsStep) / STEP_FRAMES));
  // the index arm: from the test bay's detent to yours (west), settled before the reply moves
  const arm = DETENT.tests + (DETENT.you - DETENT.tests) * springAt(f, E.armTurn, SPRING.detent);
  // the reply: emerges from the slot, rides the chute (in and out), lands on spring-dock with a 3% squash
  let slip: DeskState['slip'] = null;
  if (f >= E.slipLeave) {
    const emerge = easings.outCubic(clamp((f - E.slipLeave) / E.emergeFrames));
    const s = easings.inOutSine(clamp((f - SLIP_RIDE_FROM) / E.slipRide));
    const settle = springAt(f, SLIP_LANDS, SPRING.dock);
    const squash = f < SLIP_LANDS ? 0 : Math.max(0, 1 - (f - SLIP_LANDS) / 4) * Math.min(1, (f - SLIP_LANDS) / 1.5);
    slip = { emerge, s, squash, settle };
  }
  // beat 5 (f2340, STORYBOARD 5.1): events trip the intake by themselves, and your lamp dims a step again
  const lamp = LAMP_STEPS.dim + (LAMP_STEPS.up - LAMP_STEPS.dim) * (springAt(f, E.lampUp, SPRING.effects) - springAt(f, LAMP_DIMS, SPRING.effects));

  // the bug bay's pins: one flips per beat, 4 f each, cycling round the six
  const pins = Array.from({ length: PINS.n }, (_, i) => {
    const sinceFrom = f - E.pinsFrom - i * BEAT;
    if (sinceFrom < 0) return 0;
    const cycle = PINS.n * BEAT;
    const k = sinceFrom % cycle;
    return Math.floor(sinceFrom / cycle) % 2 === 0 ? clamp(k / E.pinFlip) : 1 - clamp(k / E.pinFlip);
  });
  const galley = ((((f - 2000) % 160) + 160) % 160) / 160;

  const next = nextAt(f);
  // MT1: once the slip is stamped in, the arm turns from you to the fresh bay's detent
  const armNow = f > EVENTS_D.armTurn ? DETENT.you + (DETENT.fresh - DETENT.you) * springAt(f, EVENTS_D.armTurn, SPRING.detent) : arm;
  const testsSink = springAt(f, EVENTS_D.rest, SPRING.heavy);
  return { f, arm: armNow, slip, lamp, card, dock, stamp, cellLit, reel, transit, testsLight, testsStep, cardOut, tape, header, ink, testsCap, bugLight: 1, pins, galley, step: withOwnRamp(f, stepAt(f)), next, cache: cacheAt(f), testsSink };
}

/** The reply's pose: under the index sector while it emerges, then on the chute, turning along its exit curve. */
export function slipPose(s: number): { p: P3; heading: number; slope: number } {
  const { p, dir } = polylineAt(CHUTE, s);
  const h = Math.hypot(dir[0], dir[1]);
  return { p, heading: Math.atan2(dir[1], dir[0]), slope: Math.atan2(dir[2], h) };
}

/** Your lamp's head points here; the pool centre follows the aim. */
export const LAMP_AIM: P2 = [LAMP.aim[0], LAMP.aim[1]];

// ------------------------------------------------------------------------------------------------
// MT1 after the reply (film f2226-2340; TREATMENT Lookdev MT1, STORYBOARD 4.6): the next chat slip
// is judged at the throat and stamped in; the index turns to the bay floor, a groove is cut, a hatch
// opens and a fresh bay rises; the folder slides the groove whole, the door lifting before it and
// dropping after; the work light ignites; the finished test bay sinks into its hatch. The gate's
// fingers only stand ready (the gate is explained in beat 5; its spike enters at 5.2, f2470).

/** The next dispatch, in cause order (film frames). */
export const EVENTS_D = {
  /** the chat slip slides out of the spout (4 f), is posted over the gate (an 11 f arc, landing at 2240 with a 3% squash) */
  slipOut: 2226,
  slipOutFrames: 4,
  post: 2229,
  postFrames: 11,
  /** it rides the belt up into the throat (linear transport) */
  belt: 2241,
  beltFrames: 6,
  /** the loupe swings over the policy card (4 f), scans its rules (12 f) and dwells to the beat */
  loupe: 2248,
  loupeFrames: 4,
  scan: 2252,
  scanFrames: 12,
  /** the punch notches the accepted slip; the loupe swings home */
  notch: 2266,
  loupeHome: 2267,
  /** stamp-in: the slip feeds into the head (3 f), the reel detents and drives the tape one cell (6 f), the head drops and the cell prints */
  feed: 2268,
  feedFrames: 3,
  reelDetent: 2271,
  tapeFrames: 6,
  stampIn: 2277,
  /** dispatch: the index arm detents toward the bay floor */
  armTurn: 2280,
  /** the fresh groove is cut from the ramp's foot (10 f), the hatch opens (6 f), the bay rises on spring-heavy */
  cut: 2283,
  cutFrames: 10,
  hatch: 2286,
  hatchFrames: 6,
  rise: 2289,
  /** the folder is pushed out of the rail's slot (4 f), down the ramp (6 f), along the groove (14 f) */
  folderOut: 2290,
  folderOutFrames: 4,
  ramp: 2294,
  rampFrames: 6,
  groove: 2300,
  grooveFrames: 14,
  /** the door lifts 4 f before the folder arrives and drops 6 f after it docks */
  doorUp: 2310,
  dock: 2314,
  doorDown: 2320,
  /** the work light ignites (spring-effects) */
  light: 2322,
  /** rest: the c12 step-down ramps out, the finished test bay sinks */
  rest: 2320,
} as const;

/** The intake, gate, belt, policy card and gauge leave C12's step-down as the slip comes to them, and step down again during the dispatch. */
export const OWN_STEP: readonly FocusId[] = ['intake', 'gate', 'belt', 'policy', 'gauge'];

/** C12's step-down with the parts on their own ramp (from f2226 to the end of the rest). */
export function withOwnRamp(f: number, step: DeskState['step']): DeskState['step'] {
  const E = EVENTS_D;
  if (f < E.slipOut || f >= E.rest + STEP_FRAMES) return step;
  const r = (a: number) => easings.inOutSine(clamp((f - a) / STEP_FRAMES));
  const amount = Math.min(Math.max(1 - r(E.slipOut), r(E.cut - 1)), 1 - r(E.rest));
  return { ...step, own: { amount, ids: OWN_STEP } };
}

export interface NextState {
  /** the chat slip: centre, heading and slope (radians), landing squash 0..1, notched once punched; null before it leaves and once it is in the head */
  slip: { p: P3; heading: number; slope: number; squash: number; notched: boolean } | null;
  /** the loupe's swing about its pivot (radians, 0 at rest over the card's centre) */
  loupe: number;
  /** the punch's drop (0 up, 1 down) */
  punch: number;
  /** the second stamp-in: the head's drop, the tape advancing one cell, the reel's detent, the new cell's ink (0..1 each) */
  stamp: number;
  tape: number;
  reel: number;
  ink: number;
  /** the fresh groove's cut (fraction of its length), the hatch open, the bay risen (0..1) */
  cut: number;
  hatch: number;
  rise: number;
  /** the fresh bay's door (0 shut, 1 lifted) and its work light (0..1) */
  door: number;
  light: number;
  /** the dispatch folder: centre, heading, slope; null before it leaves the slot */
  folder: { p: P3; heading: number; slope: number } | null;
  /** the one transit light, on the folder in flight (0..1) */
  folderTransit: number;
}

const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sine = (t: number): number => easings.inOutSine(clamp(t));

/** The belt's top, where the slip leaves it for the throat. */
const BELT_TOP: P3 = [-394, 210, 112];
/** The slip's ride from the gate up the belt into the throat. */
export const SLIP_BELT: readonly P3[] = [NEXT_SLIP.gate, BELT_TOP, NEXT_SLIP.throat];

/** The ramp's quarter pipe, as points 2 u above its sheet, from the rail's lip down to the desk. */
function rampPath(y: number): P3[] {
  const r = RAMP.lip;
  const pts: P3[] = [
    [RAMP.x + 2, y, RAMP.top + 2],
    [RAMP.x + 2, y, r + 4],
  ];
  for (let i = 1; i <= 8; i++) {
    const a = (Math.PI / 2) * (1 - i / 8);
    pts.push([RAMP.x + r - (r - 2) * Math.sin(a), y, r - (r - 2) * Math.cos(a) + 0.5]);
  }
  return pts;
}

/** The fresh groove as a polyline: centripetal Catmull-Rom through its keys (the kit's Curve, as the desk engraves it). */
export function freshGrooveLine(n = 13): P2[] {
  return new Curve(GROOVE_FRESH.map((p) => [p[0], p[1]])).polyline(n).map((p) => [p[0], p[1]] as P2);
}

/** The folder's whole path: out of the rail's slot, down the ramp, along the fresh groove, through the door to its dock. */
export const FOLDER_PATH: readonly P3[] = (() => {
  const y = (RAMP.y0 + RAMP.y1) / 2;
  const groove = freshGrooveLine().map(([x, yy]): P3 => [x, yy, 1.2]);
  return [FOLDER_SLOT, ...FOLDER_OUT, ...rampPath(y), ...groove.slice(1), DISPATCH.dock];
})();
/** Where the slot's push and the ramp end on the folder's path (arc-length fractions), so each leg keeps its own timing. */
const FOLDER_LEGS = (() => {
  const len = (pts: readonly P3[]) => pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1], q[2] - pts[i][2]), 0);
  const total = len(FOLDER_PATH);
  const out = 1 + FOLDER_OUT.length;
  return { top: len(FOLDER_PATH.slice(0, out + 1)) / total, rampEnd: len(FOLDER_PATH.slice(0, out + rampPath(0).length)) / total };
})();

/** MT1's next dispatch at film frame f (pure). */
export function nextAt(f: number): NextState {
  const E = EVENTS_D;
  // the chat slip: out of the spout, posted over the gate, up the belt, waiting in the throat, fed into the head
  let slip: NextState['slip'] = null;
  const notched = f >= E.notch;
  if (f >= E.slipOut && f < E.feed + E.feedFrames + 1) {
    if (f < E.post) {
      // inside the drum (its west end never shows past the drum's far wall)
      const inSpout: P3 = [NEXT_SLIP.spout[0] - 60, NEXT_SLIP.spout[1], NEXT_SLIP.spout[2] + 2];
      slip = { p: lerp3(inSpout, NEXT_SLIP.spout, easings.outCubic(clamp((f - E.slipOut) / E.slipOutFrames))), heading: 0, slope: 0, squash: 0, notched };
    } else if (f < E.belt) {
      // it leaves the spout fast (off the slip still lying there) and comes down slower onto the belt's foot
      const t = clamp((f - E.post) / E.postFrames);
      const u = easings.outCubic(t);
      const a = NEXT_SLIP.spout;
      const b = NEXT_SLIP.gate;
      const p: P3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * t + 4 * NEXT_SLIP.apex * t * (1 - t)];
      const landed = f - (E.post + E.postFrames);
      const squash = landed < 0 ? 0 : Math.max(0, 1 - landed / 3);
      slip = { p, heading: Math.atan2(b[1] - a[1], b[0] - a[0]) * u, slope: -0.3 * (u - 0.5) * (u < 1 ? 1 : 0), squash, notched };
    } else if (f < E.feed) {
      const { p, dir } = polylineAt(SLIP_BELT, clamp((f - E.belt) / E.beltFrames));
      const h = Math.hypot(dir[0], dir[1]);
      const atThroat = f >= E.belt + E.beltFrames;
      slip = { p, heading: atThroat ? 0 : Math.atan2(dir[1], dir[0]), slope: atThroat ? 0 : Math.atan2(dir[2], h), squash: 0, notched };
    } else {
      slip = { p: lerp3(NEXT_SLIP.throat, NEXT_SLIP.head, easings.inCubic(clamp((f - E.feed) / E.feedFrames))), heading: 0, slope: 0, squash: 0, notched };
    }
  }
  // the loupe: from its rest south of the card's print it swings up onto the rule lines (4 f), reads
  // across them (12 f), dwells to the beat and swings home once the slip is notched
  const [a0, a1] = LOUPE_READ;
  let loupe = 0;
  if (f >= E.loupe && f < E.scan) loupe = a0 * sine((f - E.loupe) / E.loupeFrames);
  else if (f >= E.scan && f < E.loupeHome) loupe = a0 + (a1 - a0) * sine((f - E.scan) / E.scanFrames);
  else if (f >= E.loupeHome) loupe = a1 * (1 - sine((f - E.loupeHome) / 6));
  const punch = Math.max(0, 1 - Math.abs(f - E.notch) / 1.5);
  // the second stamp-in
  const tape = sine((f - E.reelDetent) / E.tapeFrames);
  const reel = springAt(f, E.reelDetent, SPRING.detent);
  const stamp = clamp((f - E.stampIn) / 1.5) * (1 - clamp((f - E.stampIn - 4) / 2));
  const ink = clamp((f - E.stampIn - 1) / 3);
  // the fresh bay
  const cut = easings.outCubic(clamp((f - E.cut) / E.cutFrames));
  const hatch = sine((f - E.hatch) / E.hatchFrames);
  const rise = springAt(f, E.rise, SPRING.heavy);
  const door = sine((f - E.doorUp) / 4) * (1 - sine((f - E.doorDown) / 4));
  const light = springAt(f, E.light, SPRING.effects);
  // the folder: pushed out of the slot, down the ramp, along the groove, in through the door
  let folder: NextState['folder'] = null;
  let folderTransit = 0;
  if (f >= E.folderOut) {
    const docked = f >= E.dock;
    if (docked) {
      const settle = springAt(f, E.dock, SPRING.dock);
      folder = { p: [DISPATCH.dock[0], DISPATCH.dock[1], DISPATCH.dock[2] + 2.5 * (1 - settle)], heading: -Math.PI / 2, slope: 0 };
    } else {
      let s: number;
      if (f < E.ramp) s = FOLDER_LEGS.top * easings.outCubic(clamp((f - E.folderOut) / E.folderOutFrames));
      else if (f < E.groove) s = FOLDER_LEGS.top + (FOLDER_LEGS.rampEnd - FOLDER_LEGS.top) * easings.inQuad(clamp((f - E.ramp) / E.rampFrames));
      else s = FOLDER_LEGS.rampEnd + (1 - FOLDER_LEGS.rampEnd) * (1 - Math.pow(1 - clamp((f - E.groove) / E.grooveFrames), 1.6));
      const { p, dir } = polylineAt(FOLDER_PATH, s);
      const h = Math.hypot(dir[0], dir[1]);
      folder = { p, heading: h > 1e-3 ? Math.atan2(dir[1], dir[0]) : 0, slope: Math.atan2(dir[2], Math.max(h, 1e-3)) };
      folderTransit = clamp((f - E.folderOut) / 4) * clamp((E.dock - f) / 4);
    }
  }
  return { slip, loupe, punch, stamp, tape, reel, ink, cut, hatch, rise, door, light, folder, folderTransit };
}

/** The loupe's reading swing (radians about its pivot): onto the card's lower rule line, then across both. */
export const LOUPE_READ = [0.85, 1.45] as const;

/** Where the loupe's lens sits at a swing (about its pivot). */
export function loupeAt(a: number): P2 {
  const dx = LOUPE.x - LOUPE.pivot[0];
  const dy = LOUPE.y - LOUPE.pivot[1];
  return [LOUPE.pivot[0] + dx * Math.cos(a) - dy * Math.sin(a), LOUPE.pivot[1] + dx * Math.sin(a) + dy * Math.cos(a)];
}

// ------------------------------------------------------------------------------------------------
// Still (c), context as a cache (film f3150; STORYBOARD 6.3, TREATMENT Lookdev (c)): the request's
// bay sends a progress report up. At the mouth its header strip tears off and slides into the head
// while the older cards in the window shrink to stubs and pack east (the tape moving with the
// reel); the head prints the header and a three-line summary inline; the stubs dim one step; the
// body folds along a crease into a pointer tab that drops into the spill drawer. At f3150 the reel
// is still and the fold is the only motion.

export const EVENTS_C = {
  /** from here the window holds the cache's cells (the batching beats before it are not built) */
  from: 3000,
  /** the card rises out of the request bay's work slot (4 f), then flies 18 f under the transit light into the mouth */
  cardOut: 3106,
  cardEject: 3110,
  cardFly: 18,
  /** the older cards shrink to stubs as the reel detents and drives the tape: oldest first (they lead, so no two
   * ever overlap), 1 f apart, 6 f each, all packed before the head prints into the cell they leave */
  shrink: 3129,
  shrinkFrames: 6,
  shrinkStagger: 1,
  reelDetent: 3129,
  tapeFrames: 9,
  /** the header strip tears off along its perforation and slides into the head (6 f) */
  header: 3133,
  headerFrames: 6,
  /** the head drops (4 f) and the record prints inline (its ink over 3 f); the stubs dim one step (4 f) */
  stampIn: 3140,
  dim: 3142,
  /** the body folds along its crease (8 f), the tab drops into the drawer (6 f) and settles */
  fold: 3145,
  foldFrames: 8,
  tabDrop: 3155,
  tabFrames: 6,
} as const;

export interface CacheState {
  /** the card rising out of the bay's slot (0..1), null outside it */
  out: number | null;
  /** in flight: arc progress and position */
  card: { s: number; pos: P3 } | null;
  transit: number;
  /** at the mouth: settling on spring-dock, its header strip still on it until it tears off */
  docked: { settle: number; headerOn: boolean } | null;
  /** the header strip, mouth to head (0..1); null when not travelling */
  header: number | null;
  /** the head's drop, the record's ink (0..1) */
  stamp: number;
  ink: number;
  /** each older card's shrink to its stub (0..1), newest first */
  shrink: number[];
  /** the tape's advance and the reel's detent (0..1) */
  tape: number;
  reel: number;
  /** the stubs' one-step dim (0..1) */
  dim: number;
  /** the body's fold (0 flat .. 1 folded over), the tab's drop (0..1), its settle once landed in the drawer */
  fold: number;
  drop: number;
  landed: number | null;
}

/**
 * The close shot's fine print (TREATMENT Type: printed fields swap by an 8 f cross-fade at the start of a
 * camera move, on those objects only): in from bar 34's dolly (f2640), out from bar 42's (f3280).
 */
export function closeAt(f: number): number {
  return sine((f - 2640) / 8) * (1 - sine((f - 3280) / 8));
}

/** The card's flight from the request bay's slot into the mouth (an arc `apex` over the chord). */
export function cardArcC(s: number): P3 {
  const u = clamp(s);
  const a = CARD_C.from;
  const b: P3 = [MOUTH.land[0], MOUTH.land[1], MOUTH.z[1] + 3];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u + 4 * CARD_C.apex * u * (1 - u)];
}

/** Where the folded tab comes to rest in the spill drawer: lying on the filed tabs, its ID up. */
export const TAB_REST_C: P3 = [rectC(DRAWER.box)[0] - 22, DRAWER.box.y0 + 16, DRAWER.z[0] + 23];

/** Still (c)'s report at film frame f (pure); null before the cache's cells are in the window. */
export function cacheAt(f: number): CacheState | null {
  const E = EVENTS_C;
  if (f < E.from) return null;
  const out = f >= E.cardOut && f < E.cardEject ? easings.outCubic((f - E.cardOut) / (E.cardEject - E.cardOut)) : null;
  const fly = (f - E.cardEject) / E.cardFly;
  const card = fly >= 0 && fly < 1 ? { s: sine(fly), pos: cardArcC(sine(fly)) } : null;
  const flown = f - E.cardEject;
  const transit = card ? clamp(flown / 4) * clamp((E.cardFly - flown) / 4) : 0;
  const dockAt = E.cardEject + E.cardFly;
  const docked = f >= dockAt && f <= E.tabDrop ? { settle: springAt(f, dockAt, SPRING.dock), headerOn: f < E.header } : null;
  const header = f >= E.header && f < E.header + E.headerFrames ? sine((f - E.header) / E.headerFrames) : null;
  const stamp = clamp((f - E.stampIn) / 1.5) * (1 - clamp((f - E.stampIn - 4) / 2));
  const ink = clamp((f - E.stampIn - 1) / 3);
  const shrink = [0, 1, 2, 3, 4].map((i) => sine((f - E.shrink - (4 - i) * E.shrinkStagger) / E.shrinkFrames));
  const tape = sine((f - E.reelDetent) / E.tapeFrames);
  const reel = springAt(f, E.reelDetent, SPRING.detent);
  const dim = sine((f - E.dim) / 4);
  const fold = sine((f - E.fold) / E.foldFrames);
  const drop = clamp((f - E.tabDrop) / E.tabFrames);
  const landed = f >= E.tabDrop + E.tabFrames ? springAt(f, E.tabDrop + E.tabFrames, SPRING.dock) : null;
  return { out, card, transit, docked, header, stamp, ink, shrink, tape, reel, dim, fold, drop, landed };
}
