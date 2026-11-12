/**
 * What the Register Desk is doing at a film frame: a pure function of the frame, so any frame
 * renders the same whichever frame its page started on.
 *
 * Around style frame (b) (C12 "Workers report up. Only the Router talks to you.") the handshake runs
 * in cause order (STORYBOARD 4.6, synthesis §5 MT1), all inside MT1 (f2140–2340):
 * - 2140 the test tower's lamps go out one by one as their tests finish (2 f stagger); its cap swings
 *   shut over 8 f and lands on the 2160 downbeat; its work light dims from there;
 * - 2160 its report card #0408 rises out of the slot in the cap (4 f), then flies an 18 f arc under the
 *   transit light (the one transit light rides a report card or a dispatch folder, never a reply), up
 *   over the deck's rail and down into its mouth, docking on spring-dock at 2182;
 * - stamp-in: 2183 the reel detents and drives the tape one cell; 2190 (the cue, a contact frame) the print head is
 *   down and #0408's first ink shows in the newest cell, spreading over 3 f (the older cells dim a step with it); 2194 the card folds
 *   in half along its crease (8 f) into a pointer tab, which drops into the spill drawer from 2203
 *   (6 f) and stays there, its #0408 face up: Inline & Spill;
 * - 2200 (downbeat) the index arm turns west to you and settles on spring-detent;
 * - 2206 the reply #0408 slides out from under the deck's south-west corner along the chute's line
 *   and on down the chute, one motion of 28 f, landing in your in-tray at 2234 (spring-dock, 3%
 *   squash); your lamp brightens a step at 2236.
 * Still B (lookdev/frames.ts) is f2225: the cell inked with #0408, the tab in the drawer, the arm
 * west, the reply about 60% down the chute.
 *
 * Focus (synthesis §2): during a beat, what is not part of its action steps down to 55% contrast and
 * 30% chroma over 14 f (`stepAt`). Easing uses the film's spring tokens, mass 1.
 */
import { clamp, easings } from '@aiv/core';
import { Curve } from '@aiv/remotion-kit';
import { Easing } from 'remotion';
import { BEAT, BEAT_4, BEAT_5, BEAT_7, cue, textWindow } from '../cues.ts';
import { armRest, beat4At, hammerStroke, hatchRiseAt, inkSpread, type Beat4State } from './beat4.ts';
import { beat5At, type Beat5State } from './beat5.ts';
import { E6, beat6At, type Beat6State } from './beat6.ts';
import { ARM_7, FOCUS_7, LAMP_7, beat7At, replies7, type Beat7State } from './beat7.ts';
import { ARM_8, FOCUS_8, LAMP_8, beat8At, replies8, type Beat8State } from './beat8.ts';
import { ARM_9, FOCUS_9, LAMP_9, beat9At, replies9, type Beat9State } from './beat9.ts';
import { ARM_10, FOCUS_10, LAMP_10, beat10At, pins10, replies10, type Beat10State } from './beat10.ts';
import { LAMP_11, beat11At, type Beat11State } from './beat11.ts';
import { LAMP_END, endAt, type EndState } from './end.ts';
import { DOLLY_IN, EASE_OUT } from './camera.ts';
import { SPRING, STEP_FRAMES, springAt } from './springs.ts';
import { CARD, CARD_C, CHUTE, DISPATCH, DRAWER, DRAWER_OPEN_C, FOLDER_OUT, FOLDER_SLOT, FRESH, GROOVE_FRESH, INDEX, LAMP, LOUPE, MOUTH, NEXT_SLIP, PINS, RAMP, TOWER, YOU, rectC, towerTop, type P2, type P3 } from './layout.ts';

// the spring tokens and the step ramp live in the leaf springs.ts (the beat modules this file imports take them from there)
export { SPRING, STEP_FRAMES, springAt };

/** The handshake round C12 (film frames). */
export const EVENTS_B = {
  /** the test lamps go out one by one as their tests finish: 4 f each, 2 f apart */
  lampsOut: 2140,
  lampStagger: 2,
  lampFrames: 4,
  /** the cap swings shut over 8 f (falling, the move curve's tail), landing on the downbeat */
  testsCap: 2152,
  capFrames: 8,
  testsDim: 2160,
  /** the card is pushed up out of the slot in the tower's cap (4 f), then flies */
  cardEmerge: 2160,
  cardEject: 2164,
  cardFly: 18,
  /** the reel detents and drives the tape on one cell (7 f) */
  reelDetent: 2183,
  tapeFrames: 7,
  /** the print head comes down on this frame (falling over the 2 f before) and #0408's ink spreads over 3 f from it (beat4.ts hammerStroke, inkSpread) */
  stampIn: 2190,
  /** the test tower steps down once it has reported */
  testsStep: 2186,
  /** the card folds in half along its crease (8 f), then the tab drops into the spill drawer (6 f) and stays */
  fold: 2194,
  foldFrames: 8,
  tabDrop: 2203,
  tabFrames: 6,
  armTurn: 2200,
  /** the reply: out from under the deck (its lead-in) and down the chute, one motion */
  slipLeave: 2206,
  emergeFrames: 6,
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
  /** toward you (west-south-west), its tip at the chute's north lip: the reply slides out under the deck and down the chute clear of it */
  you: (-165 * Math.PI) / 180,
  tests: Math.atan2(139 - INDEX.pivot[1], -232 - INDEX.pivot[0]),
  docs: Math.atan2(139 - INDEX.pivot[1], 150 - INDEX.pivot[0]),
  bug: Math.atan2(90 - INDEX.pivot[1], 298 - INDEX.pivot[0]),
  /** toward the fresh bay MT1 dispatches to (its centre) */
  fresh: Math.atan2(rectC(FRESH.box)[1] - INDEX.pivot[1], rectC(FRESH.box)[0] - INDEX.pivot[0]),
} as const;

/** Beat 5: your lamp dims a step as the intake answers the starter key's dock, 2 f after it (cues.ts key-dock; beat5.ts E5.answer). */
export const LAMP_DIMS = BEAT_5.keyDock + 2;

/** Your lamp's attention steps: the bulb's level and its pool (a step dimmer while you wait). */
export const LAMP_STEPS = { dim: 0.62, up: 0.9 } as const;

/**
 * A step of your lamp's attention: from `at` it moves `steps` steps (one step: LAMP_STEPS.up − dim; + brighter, −
 * dimmer, fractions allowed) on spring-effects. Your lamp is LAMP_STEPS.dim plus every step so far (lampAt).
 */
export interface LampStep {
  at: number;
  steps: number;
}
/** Part 1's: up a step as MT1's reply lands (C12), down a step as the intake answers the starter key's dock (beat 5). */
export const LAMP_PART1: readonly LampStep[] = [
  { at: EVENTS_B.lampUp, steps: 1 },
  { at: LAMP_DIMS, steps: -1 },
];
/** Your lamp's level at film frame f: part 1's steps, then each beat module's (read here: never at module level). */
export function lampAt(f: number): number {
  let k = 0;
  for (const x of [...LAMP_PART1, ...LAMP_7, ...LAMP_8, ...LAMP_9, ...LAMP_10, ...LAMP_11, ...LAMP_END]) k += x.steps * springAt(f, x.at, SPRING.effects);
  return LAMP_STEPS.dim + (LAMP_STEPS.up - LAMP_STEPS.dim) * k;
}

/** The index arm's detents by name (DETENT). */
export type DetentId = 'you' | 'tests' | 'docs' | 'bug' | 'fresh';
/** A turn of the index arm to a detent: it leaves the detent it rests on on the frame after `at`, settling on spring-detent. */
export interface ArmStep {
  at: number;
  to: DetentId;
}
/**
 * The arm at film frame f from MT1's next stamp-in on (part 1's detents, then each beat module's): armOf over every step.
 * `before`: its angle until the first of them.
 */
export function armAt(f: number, before: number): number {
  return armOf([...ARM_PART1, ...ARM_7, ...ARM_8, ...ARM_9, ...ARM_10], f, before);
}
/**
 * The arm at film frame f under `steps` (pure, for any list): `before` until the first step, then the springs superposed,
 * DETENT.you + Σ (DETENT[to_i] − DETENT[to_i−1]) · springAt(f, at_i, SPRING.detent) over the steps begun (frame order;
 * to_−1 is 'you'). Each turn adds its own swing to what the arm is doing, so a turn that starts before the one before it
 * has settled carries the rest of that one on (it never drops it in one frame).
 */
export function armOf(steps: readonly ArmStep[], f: number, before: number): number {
  const sorted = [...steps].sort((a, b) => a.at - b.at);
  if (!sorted.length || f <= sorted[0]!.at) return before;
  let arm: number = DETENT.you;
  let from: number = DETENT.you;
  for (const d of sorted) {
    if (f > d.at) arm += (DETENT[d.to] - from) * springAt(f, d.at, SPRING.detent);
    from = DETENT[d.to];
  }
  return arm;
}

/** A reply's ride (replyRideAt): emerging from under the deck (0..1), down the chute (0..1), the hop into the tray (0..1), its landing squash and settle. */
export interface SlipRide {
  emerge: number;
  s: number;
  arc: number;
  squash: number;
  settle: number;
}
/**
 * A reply riding the chute into your in-tray (DeskState.replies): MT1's #0408 first, then each beat module's. `ride`:
 * replyRideAt; `rest`: where it comes to lie (default IN_TRAY_REST; a later reply lies on the earlier ones); `size`: its
 * length and width (default layout.ts SLIP). footprints.ts casts each while it rides; the lane draws its own.
 */
export interface ReplyState {
  id: string;
  ride: SlipRide;
  rest: P3;
  size?: readonly [number, number];
}

/**
 * What steps down during a beat: everything not in its action. A part-2 beat module names its own parts under its prefix
 * (`b7-rider`, `b8-sheet`, `b9-vellum`, `b11-plates`, `end-card`, ...), so it steps them without a shared edit.
 */
export type FocusId = 'intake' | 'gate' | 'belt' | 'plate' | 'fanfold' | 'policy' | 'docsBay' | 'bugBay' | 'testsBay' | 'freshBay' | 'cord' | 'reel' | 'lock' | 'gauge' | 'head' | 'index' | 'mouth' | 'folders' | 'loop' | 'you' | 'fixA' | 'fixB' | 'deck' | 'chute' | 'proactive' | 'spike' | 'stress' | 'jaws' | 'bosses' | `b${7 | 8 | 9 | 10 | 11}-${string}` | `end-${string}`;
/** No Thread cord before C17's beat: it first pays out at 7.1 (f3440); before that a Thread is a row on the tape (design D1). */
export const CORD_FROM = BEAT_7.cordOut;
/**
 * Per-beat focus sets (film frames). C12's action is the handshake: the test tower, the card, the
 * mouth, the cell, the arm, the chute, the reply, your in-tray. The bug bay steps down too (its slot
 * keeps working and the request's vermilion stays), and so do the reel's face and the lock.
 */
/**
 * How far a counterfactual steps the rest down (the step amount's full value: 1 for a beat): 0.68 of the way to the step's
 * targets in display values (gl/materials.ts), its darkest graphite still over the slate's floor tone.
 */
const CARD_DEPTH = 1.5;
/** Everything of act two's world that a counterfactual card steps down while it is up (the card is the beat's action). */
const ALL_BUT_CARD: readonly FocusId[] = ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'testsBay', 'cord', 'reel', 'lock', 'gauge', 'head', 'index', 'mouth', 'you', 'deck', 'chute'];
/**
 * A beat's focus (stepAt, stepOf): from `from` its `step` set steps down over STEP_FRAMES (to `depth`, 1 for a beat), and
 * comes back up over STEP_FRAMES from `to`. Where entries overlap (each live from `from` to `to` + STEP_FRAMES) the one
 * with the highest `priority` wins (default 0; on a tie the earlier in focusEntries), whole: an entry that starts while
 * another is down ramps in from nothing, so the parts they share pump (down, up, down) unless it takes over (`handFrom`).
 * `own`: a second set on its own ramp inside the entry (kit.tsx `Step on="own"`, STEP_OWN), in from `own.from` and out
 * from `own.to`; `late`: parts held on the late set (STEP_LATE, at a full step from f2200: the finished test tower's ramp).
 *
 * `handFrom`: the id of the entry this one takes over from, with no pump and no pop. From this entry's `from` on it wins
 * over the entry it names, whatever their order and priority; over [from, from + STEP_FRAMES) the parts in both sets stay
 * at a full step, the parts only in the named entry's set ramp out (1 − inOutSine), the parts only in this one's ramp in on
 * its main ramp; after that it steps as any entry does. stepOf throws unless: the hand-over is part 2's (from >= CORD_FROM);
 * the named entry exists, has the same depth, holds the frame before `from` and is at a full step on `from` (its ramp in
 * done, its `to` not passed) and does not outlive this one (its `to` <= this one's); neither carries `late`, and an `own`
 * of either is idle over the hand-over (its amount 0 from from − 1 to from + STEP_FRAMES − 1) and steps none of the parts
 * of either set. How the parts are carried (handOverStep): with parts in all three groups, the shared on the late set
 * (exactly 1 there, so only at depth 1: at another depth there is no third set to carry them, and stepOf throws), the
 * dropped on the own set, the added on the main one; with a group empty, the shared keep the main set at the full step and
 * the one ramping group takes the own set (with none shared, the added take the main set and the dropped the own).
 */
export interface FocusEntry {
  id: string;
  from: number;
  to: number;
  step: readonly FocusId[];
  depth?: number;
  priority?: number;
  own?: { from: number; to: number; step: readonly FocusId[] };
  late?: readonly FocusId[];
  handFrom?: string;
}
/** Part 1's focus entries (beats 4-6); part 2's come from the beat modules (focusEntries). */
export const FOCUS_BEATS: readonly FocusEntry[] = [
  // 4.3, 4.4: while a counterfactual is up, everything else steps down (from its first move to the frame it starts off),
  // half as far again as a beat's step (CARD_DEPTH), so the card is the frame's one lit paper; under the ghost Router the
  // real index arm keeps its detent on every beat at full contrast (STORYBOARD 4.4), and the arrivals riding in (cargo in
  // motion) never step
  { id: 'split', from: BEAT_4.splitCard - 1, to: BEAT_4.splitStrike + 5, step: ALL_BUT_CARD, depth: CARD_DEPTH },
  { id: 'ghost', from: BEAT_4.ghostCard - 1, to: BEAT_4.ghostStrike + 5, step: ALL_BUT_CARD.filter((x) => x !== 'index'), depth: CARD_DEPTH },
  { id: 'c12', from: 2130, to: 2320, step: ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'cord', 'reel', 'lock', 'gauge'] },
  // beat 5 (5.1-5.3), one beat in two stages so nothing pumps: from 4 f before the starter key lifts (after C12's ramp
  // out at 2320-2334) the Register's body, the chute, the fresh bay, the index arm and the mouth step down, leading the eye
  // to your desk, the key's flight and the intake it docks on, where the events then arrive by themselves; from 8 f before
  // the spike stands up (5.2, C14: the Fast Path and the Slow Path are the action) the rest steps down with them on its own
  // ramp (B5_LATE: what C12 had stepped and released, so it never dips and rises again), and both come back up as the dolly
  // closes on the throat, 6 f before it lands
  { id: 'b5', from: BEAT_5.keyDock - 20, to: 2700, step: ['deck', 'freshBay', 'chute', 'index', 'mouth'] },
  // N5 at the window (still C): the report, the window, the head, the mouth and the drawer are the action; beat 6's stress
  // plate, read under N4 before it, steps down with the rest (it stays on the rail)
  { id: 'n5', from: 3040, to: 3216, step: ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'cord', 'reel', 'lock', 'gauge', 'stress'] },
];
export interface DeskState {
  f: number;
  /** the index arm's angle (radians) */
  arm: number;
  /** MT1's reply #0408: emerging from the slot (0..1), then progress down the chute 0..1, its landing squash and settle; null before it leaves */
  slip: SlipRide | null;
  /** every reply that has left for your in-tray: MT1's (`slip`) first, then each beat module's (state.ts ReplyState) */
  replies: ReplyState[];
  /** your lamp's level (0..1 scale of its pool and bulb) */
  lamp: number;
  /** the report card in flight: arc progress 0..1, world position (null when not flying) */
  card: { s: number; pos: P3 } | null;
  /** the card at the mouth: docked (settling on spring-dock), folding in half into a tab, the tab dropping into the spill drawer and landing (spring-dock, then still); it stays until the cache's cards take the window (f3000) */
  dock: { settle: number; fold: number; drop: number; landed: number | null; squash: number } | null;
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
  /** the #0408 ink spreading in the newest cell (0..1) */
  ink: number;
  /** the test tower's cap: 0 open → 1 closed */
  testsCap: number;
  /** each of the test tower's three lamps, bottom up: 1 lit (its test running) → 0 out (finished) */
  lamps: number[];
  /** the bug bay's work slot (computing): 1 */
  bugLight: number;
  /** each of the bug bay's six pins: 0 graphite face up (not run) → 1 enamel face up (passed) */
  pins: number[];
  /** the docs galley: how far the current line is set (0..1) */
  galley: number;
  /** the focus step-down: how far it has gone (0..1) and what it applies to; `own`: parts on their own ramp (kit.tsx `Step on="own"`) */
  step: { amount: number; ids: readonly FocusId[]; own?: { amount: number; ids: readonly FocusId[] }; late?: readonly FocusId[] };
  /** MT1's next dispatch (f2226-2340): the chat slip judged and stamped in, the fresh bay and its folder */
  next: NextState;
  /** still (c): the request's report at the window; null before it */
  cache: CacheState | null;
  /** the finished test bay sinking into its hatch (0..1, spring-heavy) */
  testsSink: number;
  /** beat 4 (desk/beat4.ts): the bays' dispatches, the tape's rows, the reel, the request, the heap, the counterfactual cards; still (b)'s from f2140 */
  b4: Beat4State;
  /** beat 5 (desk/beat5.ts): the starter key's hand-over, the Proactive plate, the spike, the filter's slips, the gate's fingers, the loupe and punch for the kept slips */
  e5: Beat5State;
  /** beat 6 (desk/beat6.ts): the batches' strip, the reading bar, the decode slip, the stress plate, the review card, the rewind, the reading thread, the answer */
  e6: Beat6State;
  /** part 2's beats (desk/beat7.ts ... end.ts), each null outside its life: 7-10 in act two's world, 11 and the end in the summary's */
  e7: Beat7State | null;
  e8: Beat8State | null;
  e9: Beat9State | null;
  e10: Beat10State | null;
  e11: Beat11State | null;
  end: EndState | null;
}

/** The print head's hammer at its stroke h (0 raised clear of the tape, 1 down on the newest cell): it rocks east as it falls, so its drop reads from above. */
export const hammerOffset = (h: number): [number, number, number] => [3.5 * h, 0, 12 - 13 * h];

/** The one transit light along a flight of `length` frames, `t` frames in: in over 4 f, out over the last 6 f on a squared ramp (its last frames under the bloom's threshold). */
export const transitRamp = (t: number, length: number): number => clamp(t / 4) * clamp((length - t) / 6) ** 2;

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

/**
 * The slot in the test tower's cap: across the cap's south half, where its chord is wider than the card.
 * The card stands in it, its face to the south, and rises out of it before it flies.
 */
export const CAP_SLOT: P3 = [TOWER.x, TOWER.y - 14, towerTop() + TOWER.dome];
/** The standing card's centre, risen `out` (0: its top edge at the cap's top, all of it inside the tower; 1: its foot at the cap's top). */
export const cardRise = (out: number): P3 => [CAP_SLOT[0], CAP_SLOT[1], CAP_SLOT[2] + (CARD.d / 2) * (2 * clamp(out) - 1) + 0.6];
/** The card's flight: from standing clear of the slot, up over the deck's south rail and down into the mouth, an arc `apex` above the chord. */
export const CARD_FROM: P3 = cardRise(1);
/** Where it docks: on the mouth, its foot clear of the hopper's south wall, its head resting over the south rail. */
export const DOCK_B: P3 = [MOUTH.land[0], MOUTH.land[1], MOUTH.z[1] - 2];
export const CARD_TO: P3 = DOCK_B;
export function cardArc(s: number): { pos: P3 } {
  const u = clamp(s);
  return { pos: [CARD_FROM[0] + (CARD_TO[0] - CARD_FROM[0]) * u, CARD_FROM[1] + (CARD_TO[1] - CARD_FROM[1]) * u, CARD_FROM[2] + (CARD_TO[2] - CARD_FROM[2]) * u + 4 * CARD.apex * u * (1 - u)] };
}
/** The card's tilt about x: standing (leaning back a little) as it leaves the slot, lying at the mouth's tilt by two thirds of its flight. */
export const CARD_STAND = Math.PI / 2 - 0.16;
export const CARD_DOCK_TILT = 0.28;
export const cardTilt = (s: number): number => CARD_DOCK_TILT + (CARD_STAND - CARD_DOCK_TILT) * (1 - Math.min(1, clamp(s) / 0.66)) ** 2;

/**
 * The folded tab (the card folded in half along its crease, #0408 face up) and where it comes to rest:
 * standing on its fold in the spill drawer's front, leaning back on the filed tabs, its face to the
 * camera above the drawer's front plate.
 */
export const TAB_B = { w: CARD.w, d: CARD.d / 2 } as const;
export const TAB_REST_B: P3 = [rectC(DRAWER.box)[0], DRAWER.box.y0 + 5, DRAWER.z[0] + 4];
export const TAB_LEAN_B = 0.86;
/** The tab's path from the mouth to its rest: across first (the move curve), then down into the drawer once clear of its wall. */
export function tabArc(u: number): P3 {
  const t = clamp(u);
  const a = DOCK_B;
  const across = Easing.bezier(0.2, 0, 0, 1)(t);
  const down = Math.max(0, (t - 0.55) / 0.45) ** 2;
  return [a[0] + (TAB_REST_B[0] - a[0]) * across, a[1] + (TAB_REST_B[1] - a[1]) * across, a[2] + (TAB_REST_B[2] - a[2]) * down + 10 * Math.sin(Math.PI * Math.min(1, t / 0.55))];
}

/**
 * Every focus entry of the film: part 1's, then each part-2 beat module's (read here, never at module level: a beat module
 * may import modules that import this one).
 */
export function focusEntries(): readonly FocusEntry[] {
  return [...FOCUS_BEATS, ...FOCUS_7, ...FOCUS_8, ...FOCUS_9, ...FOCUS_10];
}
/** A ramp in over STEP_FRAMES from `from`, out over STEP_FRAMES from `to` (0..1). */
const rampAt = (f: number, from: number, to: number): number => Math.min(easings.inOutSine(clamp((f - from) / STEP_FRAMES)), 1 - easings.inOutSine(clamp((f - to) / STEP_FRAMES)));
/** The focus entry that holds film frame f: focusOf over every entry of the film. */
export function focusAt(f: number): FocusEntry | null {
  return focusOf(focusEntries(), f);
}
/**
 * The entry of `entries` that holds film frame f (pure, for any list): of the entries live there, the highest priority
 * (the earliest on a tie), leaving out every entry that a live one takes over from (FocusEntry.handFrom).
 */
export function focusOf(entries: readonly FocusEntry[], f: number): FocusEntry | null {
  const live = entries.filter((b) => f >= b.from && f < b.to + STEP_FRAMES);
  let best: FocusEntry | null = null;
  for (const b of live) {
    if (live.some((x) => x.handFrom === b.id)) continue;
    if (!best || (b.priority ?? 0) > (best.priority ?? 0)) best = b;
  }
  return best;
}
/** The focus step-down at film frame f: stepOf over every entry of the film. */
export function stepAt(f: number): DeskState['step'] {
  return stepOf(focusEntries(), f);
}
/**
 * The focus step-down at film frame f under `entries` (pure, for any list): the holding entry's ramps (in over
 * STEP_FRAMES from its `from`, out from its `to`), or, over the first STEP_FRAMES of an entry that takes over from another
 * (FocusEntry.handFrom), the hand-over (handOverStep). Throws on a hand-over that cannot be continuous (handOverFrom).
 */
export function stepOf(entries: readonly FocusEntry[], f: number): DeskState['step'] {
  const b = focusOf(entries, f);
  // every hand-over live at f is checked, whichever entry holds the frame
  for (const e of entries) if (e !== b && e.handFrom !== undefined && f >= e.from && f < e.to + STEP_FRAMES) handOverFrom(entries, e);
  if (!b) return { amount: 0, ids: [] };
  if (b.handFrom !== undefined) {
    const x = handOverFrom(entries, b);
    if (f < b.from + STEP_FRAMES) return handOverStep(x, b, f);
  }
  const step: DeskState['step'] = { amount: (b.depth ?? 1) * rampAt(f, b.from, b.to), ids: b.step };
  if (b.own) step.own = { amount: rampAt(f, b.own.from, b.own.to), ids: b.own.step };
  if (b.late) step.late = b.late;
  return step;
}
/** The entry `b` takes over from (FocusEntry.handFrom), once every condition of a continuous hand-over holds (else it throws). */
function handOverFrom(entries: readonly FocusEntry[], b: FocusEntry): FocusEntry {
  const no = (why: string): never => {
    throw new Error(`focus: '${b.id}' cannot take over from '${b.handFrom}': ${why}`);
  };
  const x = entries.find((e) => e.id === b.handFrom && e !== b);
  if (!x) return no('there is no other entry of that id');
  if (b.from < CORD_FROM) no(`a hand-over is part 2's (from >= ${CORD_FROM}: before it part 1's holds drive the late and own sets)`);
  if ((x.depth ?? 1) !== (b.depth ?? 1)) no(`their depths differ (${x.depth ?? 1}, ${b.depth ?? 1})`);
  if (rampAt(b.from, x.from, x.to) !== 1) no(`it is not at a full step on f${b.from} (in from ${x.from}, out from ${x.to})`);
  if (focusOf(entries, b.from - 1) !== x) no(`it does not hold f${b.from - 1}, the frame before the hand-over`);
  if (x.to > b.to) no(`it outlives the entry taking over (to ${x.to} > ${b.to})`);
  if (b.to < b.from + STEP_FRAMES) no(`'${b.id}' ramps out (to ${b.to}) before its hand-over is done (f${b.from + STEP_FRAMES})`);
  for (const e of [x, b]) {
    if (e.late) no(`'${e.id}' carries a late set (the hand-over holds the shared parts there)`);
    if (!e.own) continue;
    for (let f = b.from - 1; f < b.from + STEP_FRAMES; f++) if (rampAt(f, e.own.from, e.own.to) !== 0) no(`the own set of '${e.id}' is live at f${f} (the hand-over ramps the parts it drops or adds there)`);
    if (e.own.step.some((id) => x.step.includes(id) || b.step.includes(id))) no(`the own set of '${e.id}' steps a part that the hand-over carries`);
  }
  return x;
}
/**
 * The hand-over from `x` to `b` at film frame f in [b.from, b.from + STEP_FRAMES) (FocusEntry.handFrom), every part exactly
 * continuous with what it was and what it will be: the parts in both sets at the full step (d), the parts only in x's
 * ramping out (d · (1 − inOutSine)), the parts only in b's ramping in on b's main ramp (d · inOutSine). With parts in all
 * three groups the shared are held on the late set (STEP_LATE: testsStep, exactly 1 from f2200, so only at depth 1), the
 * added on the main set, the dropped on the own set; with a group empty the shared keep the main set (no part changes set
 * where it need not) and the one ramping group takes the own set.
 */
function handOverStep(x: FocusEntry, b: FocusEntry, f: number): DeskState['step'] {
  const d = b.depth ?? 1;
  const u = easings.inOutSine(clamp((f - b.from) / STEP_FRAMES));
  const shared = b.step.filter((id) => x.step.includes(id));
  const added = b.step.filter((id) => !x.step.includes(id));
  const dropped = x.step.filter((id) => !b.step.includes(id));
  if (shared.length && added.length && dropped.length) {
    if (d !== 1) throw new Error(`focus: '${b.id}' cannot take over from '${x.id}': at depth ${d} the late set (at 1) cannot hold the shared parts while others are added and dropped`);
    return { amount: u, ids: added, own: { amount: 1 - u, ids: dropped }, late: shared };
  }
  if (!shared.length) return { amount: d * u, ids: added, own: { amount: d * (1 - u), ids: dropped } };
  if (added.length) return { amount: d, ids: shared, own: { amount: d * u, ids: added } };
  if (dropped.length) return { amount: d, ids: shared, own: { amount: d * (1 - u), ids: dropped } };
  return { amount: d, ids: shared };
}

/** The state of the desk at film frame `f` (pure). */
export function deskStateAt(f: number): DeskState {
  const E = EVENTS_B;
  // beat 4: the bays dispatched one by one (their lights, the test tower's lamps lit as its tests start), the arm's detents, the rows' stamps
  const b4 = beat4At(f);
  // the test tower finishes: its lamps go out one by one, its cap swings shut onto the downbeat, its light dims; its card flies up into the mouth
  const lamps = [0, 1, 2].map((i) => (1 - sine((f - E.lampsOut - i * E.lampStagger) / E.lampFrames)) * b4.lamps[i]);
  const testsCap = easings.inCubic(clamp((f - E.testsCap) / E.capFrames));
  const testsLight = (1 - springAt(f, E.testsDim, SPRING.effects)) * b4.bays.tests.light;
  const fly = (f - E.cardEject) / E.cardFly;
  const card = fly >= 0 && fly < 1 ? { s: easings.inOutSine(fly), pos: cardArc(easings.inOutSine(fly)).pos } : null;
  // the transit light ramps in over 4 f after the card leaves and out over the 6 f before it docks (spring-effects-like, under the bloom by its last frame; dark in the dock frame)
  const flown = f - E.cardEject;
  const transit = card ? transitRamp(flown, E.cardFly) : 0;
  // at the mouth: dock (spring-dock settle), stamp, fold in half, the tab drops into the drawer and lands there (it stays until the cache takes the window)
  const docked = f >= E.cardEject + E.cardFly && f < EVENTS_C.from;
  const landAt = E.tabDrop + E.tabFrames;
  const dock = docked
    ? {
        settle: springAt(f, E.cardEject + E.cardFly, SPRING.dock),
        fold: easings.inOutSine(clamp((f - E.fold) / E.foldFrames)),
        drop: clamp((f - E.tabDrop) / E.tabFrames),
        landed: f >= landAt ? (f - landAt >= 12 ? 1 : springAt(f, landAt, SPRING.dock)) : null,
        squash: f < landAt ? 0 : Math.max(0, 1 - (f - landAt) / 4) * Math.min(1, (f - landAt + 1) / 1.5),
      }
    : null;
  // the stamp-in (MT1 stampIn, a contact frame): the head comes down on its cue and #0408's first ink shows on it
  const stamp = Math.max(b4.hammer, hammerStroke(f, E.stampIn));
  const cellLit = springAt(f, E.stampIn, SPRING.effects);
  const reel = springAt(f, E.reelDetent, SPRING.detent);
  const tape = easings.inOutSine(clamp((f - E.reelDetent) / E.tapeFrames));
  const ink = inkSpread(f, E.stampIn);
  const cardOut = f >= E.cardEmerge && f < E.cardEject ? easings.outCubic((f - E.cardEmerge) / (E.cardEject - E.cardEmerge)) : null;
  const testsStep = easings.inOutSine(clamp((f - E.testsStep) / STEP_FRAMES));
  // the index arm: beat 4's detents (it rests at the docs galley's), then to yours (west), settled before the reply moves
  const arm = (f <= E.armTurn ? b4.arm : armRest()) + (DETENT.you - armRest()) * springAt(f, E.armTurn, SPRING.detent);
  // the reply: one motion from under the deck along the chute's line and down the chute (replyRideAt), landing in your
  // in-tray on MT1's replyLands (a contact frame)
  const slip = replyRideAt(f, E.slipLeave, SLIP_LANDS);
  // your lamp: up a step as the reply lands, down a step as the intake answers the starter key's dock (beat 5), then
  // each later beat's steps (lampAt)
  const lamp = lampAt(f);

  // the bug bay's pins: one flips per beat, 4 f each, cycling round the six, until bar 68 takes them (beat10.ts pins10)
  const cycling = Array.from({ length: PINS.n }, (_, i) => {
    const sinceFrom = f - E.pinsFrom - i * BEAT;
    if (sinceFrom < 0) return 0;
    const cycle = PINS.n * BEAT;
    const k = sinceFrom % cycle;
    return Math.floor(sinceFrom / cycle) % 2 === 0 ? clamp(k / E.pinFlip) : 1 - clamp(k / E.pinFlip);
  });
  const pins = pins10(f, cycling);
  const galley = ((((f - 2000) % 160) + 160) % 160) / 160;

  const next = nextAt(f);
  // MT1: once the slip is stamped in, the arm turns from you to the fresh bay's detent; then each later beat's detents (armAt)
  const armNow = armAt(f, arm);
  const testsSink = springAt(f, EVENTS_D.rest, SPRING.heavy);
  // part 2's beats (each null outside its life), and every reply that has left for your in-tray
  const e7 = beat7At(f);
  const e8 = beat8At(f);
  const e9 = beat9At(f);
  const e10 = beat10At(f);
  const replies: ReplyState[] = [...(slip ? [{ id: '0408', ride: slip, rest: IN_TRAY_REST }] : []), ...replies7(e7), ...replies8(e8), ...replies9(e9), ...replies10(e10)];
  return { f, arm: armNow, slip, replies, lamp, card, dock, stamp, cellLit, reel, transit, testsLight, testsStep, cardOut, tape, ink, testsCap, lamps, bugLight: b4.bays.bug.light, pins, galley, step: withLateHold(f, withBeat6Ramp(f, withBeat5Ramp(f, withOwnRamp(f, stepAt(f))))), next, cache: cacheAt(f), testsSink, b4, e5: beat5At(f), e6: beat6At(f, (x, at) => springAt(x, at, SPRING.dock)), e7, e8, e9, e10, e11: beat11At(f), end: endAt(f) };
}

/**
 * A reply's ride at film frame f, leaving on `leave` and landing in your in-tray on `lands` (a contact frame): one motion
 * from under the deck along the chute's line and down the chute, gathering speed as it comes out from under the deck and
 * then at a constant pace to the chute's lip (it never slows in the trough), off the lip in a short arc (REPLY_ARC) into
 * the tray, landing on spring-dock with its squash at its deepest on `lands`. Null before it leaves.
 */
export function replyRideAt(f: number, leave: number, lands: number): SlipRide | null {
  if (f < leave) return null;
  const lip = lands - REPLY_ARC;
  const d = replyRun((f - leave) / (lip - leave)) * (REPLY_LEAD + REPLY_CHUTE);
  const emerge = clamp(d / REPLY_LEAD);
  const s = clamp((d - REPLY_LEAD) / REPLY_CHUTE);
  const arc = clamp((f - lip) / REPLY_ARC);
  const settle = springAt(f, lands, SPRING.dock);
  const squash = f < lands ? 0 : Math.max(0, 1 - (f - lands) / 4);
  return { emerge, s, arc, squash, settle };
}

/** The reply's lead-in: hidden under the deck's plate and south rail, on the chute's line produced back north-east, so it slides out of the deck straight into the chute. */
export const REPLY_LEAD = 132;
const CHUTE_DIR: P3 = (() => {
  const [a, b] = [CHUTE[0], CHUTE[1]];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, 0];
})();
/** Its path: from under the deck (a little low, under the plate) to the chute's head, then the chute's bed. */
export const REPLY_PATH: readonly P3[] = [[CHUTE[0][0] - CHUTE_DIR[0] * REPLY_LEAD, CHUTE[0][1] - CHUTE_DIR[1] * REPLY_LEAD, CHUTE[0][2] + 3], ...CHUTE.map((p): P3 => [p[0], p[1], p[2] + 6])];
const REPLY_CHUTE = CHUTE.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - CHUTE[i][0], q[1] - CHUTE[i][1], q[2] - CHUTE[i][2]), 0);
/** The reply leaves the chute's lip this many frames before it lands: a short arc off the lip into the tray (the MT1 critic: no hold under the lip). */
export const REPLY_ARC = 5;
/** How high the reply hops off the chute's lip (u): clear of the trough's walls while it turns to lie in the tray. */
export const REPLY_HOP = 20;
export const SLIP_LIP = SLIP_LANDS - REPLY_ARC;
/** The reply's run to the lip (0..1 of its path): it gathers speed over the first quarter (out from under the deck), then runs at a constant pace (linear transport) to the lip. */
export function replyRun(t: number): number {
  const x = clamp(t);
  const a = 0.25;
  return x < a ? (x * x) / (2 * a) / (1 - a / 2) : (x - a / 2) / (1 - a / 2);
}
/** Where the landed reply rests: in the in-tray's north part, clear of the chute's mouth and of the older slip's print. */
export const IN_TRAY_REST: P3 = [rectC(YOU.inTray)[0] + 4, YOU.inTray.y1 - 23, 33];

/**
 * The reply's pose: on its path (heading and slope from it), turning along the chute's exit curve to lie
 * as it will in the tray, then settling into the tray on spring-dock.
 */
export function replyPose(slip: SlipRide, rest: P3 = IN_TRAY_REST): { p: P3; heading: number; slope: number } {
  const { emerge, s, arc, settle } = slip;
  if (s >= 1) {
    // off the lip: an arc that leaves at the chute's own heading and slope, then turns and levels to lie in the tray
    const end = REPLY_PATH[REPLY_PATH.length - 1];
    const { dir } = polylineAt(REPLY_PATH, 1);
    const h0 = Math.atan2(dir[1], dir[0]) + Math.PI;
    const s0 = Math.atan2(dir[2], Math.hypot(dir[0], dir[1]));
    const u = clamp(arc);
    const e = easings.inOutSine(u);
    // landed: it settles the last hair onto the tray on spring-dock
    // it hops off the lip (over the trough's walls, so nothing of it passes under them as it turns), then drops into the tray
    const z = end[2] + (rest[2] - end[2]) * u * u + 4 * REPLY_HOP * u * (1 - u) + (u >= 1 ? 1.2 * (1 - settle) : 0);
    const p: P3 = [end[0] + (rest[0] - end[0]) * u, end[1] + (rest[1] - end[1]) * u, z];
    return { p, heading: h0 + (0.05 - h0) * e, slope: s0 * (1 - e) };
  }
  const lead = REPLY_LEAD / (REPLY_LEAD + REPLY_CHUTE);
  const u = s > 0 ? lead + (1 - lead) * s : lead * emerge;
  // the path's own arc length, mapped so the lead-in and the chute keep their shares
  const { p, dir } = polylineAt(REPLY_PATH, u);
  const h = Math.hypot(dir[0], dir[1]);
  // along the chute to its lip: the chute's own heading and slope (it never turns broadside inside the trough)
  return { p, heading: Math.atan2(dir[1], dir[0]) + Math.PI, slope: Math.atan2(dir[2], h) };
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
  /** the fresh groove is cut from the ramp's foot (10 f), the hatch's leaves slide open (4 f), the bay rises out of its pit on spring-heavy only once they are open (beat4.ts hatchRiseAt) */
  cut: 2283,
  cutFrames: 10,
  hatch: 2285,
  hatchFrames: 4,
  rise: 2289,
  /** the folder is pushed out of the dispatch housing's slit (6 f), runs down the ramp (4 f), along the groove (14 f) */
  folderOut: 2290,
  folderOutFrames: 6,
  ramp: 2296,
  rampFrames: 4,
  groove: 2300,
  grooveFrames: 14,
  /** the door lifts (4 f) and is fully up 4 f before the folder's leading edge reaches it; it drops 6 f after the folder docks */
  doorUp: 2299,
  dock: 2314,
  doorDown: 2320,
  /** the work light ignites (spring-effects) */
  light: 2322,
  /** rest: the c12 step-down ramps out, the finished test bay sinks */
  rest: 2320,
} as const;
/** Part 1's arm detents after MT1's reply (armAt): once the next slip is stamped in, the arm turns from you to the fresh bay. */
export const ARM_PART1: readonly ArmStep[] = [{ at: EVENTS_D.armTurn, to: 'fresh' }];

/**
 * Still (c): from the tab's launch the head, the index arm and the holder are out of the action (their enamel steps under
 * the lit record), and so are the throat's enamel jaws and the reel frame's bosses (still (c)'s critic, item 6: the
 * enamel highlights must not beat the paper). They come back up a few frames after N5's step-down ramps out, before the
 * head stamps the review comment in (6.4).
 */
export const CACHE_SETTLE = 3127;
const CACHE_STEP: readonly FocusId[] = ['head', 'index', 'mouth', 'jaws', 'bosses'];
/** When the own set ramps back up: after N5's ramp out, a stagger behind it. */
export const CACHE_UNSTEP = 3216 + STEP_FRAMES + 2;
/**
 * Beat 6.2's stress plate steps down with N5's focus and stays down after it (it must never relight over the record
 * through N6, nor read as a label on the docs bay under it): once N5's ramp has reached it, it hands over to the late
 * set (the finished test tower's ramp, at 1 from f2200 on), the same values, so the hand-over is invisible.
 */
export const STRESS_LATE = FOCUS_BEATS.find((b) => b.id === 'n5')!.from + STEP_FRAMES;
/** The print head's dip (u at full) and how far it is down (0..1): it presses down with its hammer for the cache's record and the review's row (about 8 px at the close). */
export const HEAD_DIP = 7;
export const headDipAt = (s: Pick<DeskState, 'cache' | 'e6'>): number => Math.max(s.cache?.dip ?? 0, s.e6.hammer);
/** The own parts' lag behind the bays when C12's step-down ramps out at the rest. */
const OWN_LAG = 3;

/** The intake, gate, belt, policy card and gauge leave C12's step-down as the slip comes to them, and step down again during the dispatch. */
export const OWN_STEP: readonly FocusId[] = ['intake', 'gate', 'belt', 'policy', 'gauge'];

/** Beat 5.2-5.3's second stage (FOCUS_BEATS 'b5'): the reel, the lock, the log, both trait plates, the bays and your desk step down on their own ramp from 8 f before the spike stands up, and come back up with the beat. */
export const B5_LATE: readonly FocusId[] = ['reel', 'lock', 'fanfold', 'plate', 'proactive', 'docsBay', 'bugBay', 'you', 'gauge'];
export const B5_LATE_FROM = BEAT_5.spikeIn - 8;
export function withBeat5Ramp(f: number, step: DeskState['step']): DeskState['step'] {
  const b5 = FOCUS_BEATS.find((b) => b.id === 'b5')!;
  if (step.own || f < B5_LATE_FROM || f >= b5.to + STEP_FRAMES) return step;
  const amount = Math.min(easings.inOutSine(clamp((f - B5_LATE_FROM) / STEP_FRAMES)), 1 - easings.inOutSine(clamp((f - b5.to) / STEP_FRAMES)));
  return { ...step, own: { amount, ids: B5_LATE } };
}

/**
 * 5.1's focus (the critic's pump): what C12 had stepped down and beat 5's second stage steps down again (B5_LATE but
 * your desk and the Proactive plate, which are 5.1's action) never comes up in between: from C12's ramp-out (where it is
 * at a full step) it is drawn with the late set (at a full step from f2200: testsStep) until B5_LATE's own ramp has
 * reached a full step, which then carries it (the same values: the hand-overs are invisible) and brings it up with the dolly.
 */
export const B5_HOLD: readonly FocusId[] = ['reel', 'lock', 'fanfold', 'plate', 'docsBay', 'bugBay', 'gauge'];
const C12_OUT = FOCUS_BEATS.find((b) => b.id === 'c12')!.to;
const B5_HOLD_TO = B5_LATE_FROM + STEP_FRAMES;
/**
 * N6 (the recall): the docs bay, whose W-09 name strip lies in the notes band in the close, stays stepped down from N5
 * until N6's line is off the screen (its lit paper never enters the band under the line): on the late set once N5's ramp
 * has reached it, then on its own ramp at a full step once the cache's own set has handed back (CACHE_UNSTEP), ramping up
 * after N6 has gone (as the camera eases out).
 */
export const N6_HOLD: readonly FocusId[] = ['docsBay'];
/** The frame N6's line is gone (its window's end: cues.ts textWindow). */
export const N6_GONE = textWindow(cue('n6'))[1];
/** The parts held on the late set at f (B5_HOLD in 5.1, the docs bay in N5-N6). */
export function withLateHold(f: number, step: DeskState['step']): DeskState['step'] {
  const late = f >= C12_OUT && f < B5_HOLD_TO ? B5_HOLD : f >= STRESS_LATE && f < CACHE_UNSTEP + STEP_FRAMES ? N6_HOLD : null;
  return late ? { ...step, late } : step;
}
/** The docs bay's own ramp after the cache's (N6_HOLD): at a full step until N6 is gone, then up over STEP_FRAMES. */
export function withBeat6Ramp(f: number, step: DeskState['step']): DeskState['step'] {
  if (step.own || f < CACHE_UNSTEP + STEP_FRAMES || f >= N6_GONE + STEP_FRAMES) return step;
  return { ...step, own: { amount: 1 - easings.inOutSine(clamp((f - N6_GONE) / STEP_FRAMES)), ids: N6_HOLD } };
}

/** C12's step-down with the parts on their own ramp (from f2226 to the end of the rest). */
export function withOwnRamp(f: number, step: DeskState['step']): DeskState['step'] {
  const E = EVENTS_D;
  // still (c): once the record is in and the tab is falling, the print head, the index and the emptied holder step down
  // with the other parts out of the action, so the inline record and the drawer are the frame's brightest
  if (f >= CACHE_SETTLE && f < CACHE_UNSTEP + STEP_FRAMES) return { ...step, own: { amount: Math.min(easings.inOutSine(clamp((f - CACHE_SETTLE) / STEP_FRAMES)), 1 - easings.inOutSine(clamp((f - CACHE_UNSTEP) / STEP_FRAMES))), ids: CACHE_STEP } };
  if (f < E.slipOut || f >= E.rest + OWN_LAG + STEP_FRAMES) return step;
  const r = (a: number) => easings.inOutSine(clamp((f - a) / STEP_FRAMES));
  // at the rest they come back up a few frames after the bays (a stagger, never one block)
  const amount = Math.min(Math.max(1 - r(E.slipOut), r(E.cut - 1)), 1 - r(E.rest + OWN_LAG));
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
  /** the fresh groove's cut (fraction of its length), the hatch's leaves open, the bay risen (0..1); its hole in the slate open; its contact shadow tightening as it settles */
  cut: number;
  hatch: number;
  rise: number;
  hole: boolean;
  contact: number;
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

/** The fresh groove as a polyline: centripetal Catmull-Rom through its keys (the kit's Curve, as the desk engraves it). */
export function freshGrooveLine(n = 13): P2[] {
  return new Curve(GROOVE_FRESH.map((p) => [p[0], p[1]])).polyline(n).map((p) => [p[0], p[1]] as P2);
}

/**
 * The folder's legs. Pushed level out of the housing's slit until its tail clears it; then it drops off the lip
 * down the quarter pipe (a short fall, nose down then level: the pipe is too tight for it to slide rigidly) and lands
 * on the fresh groove's start; then along the groove, through the door, to its dock.
 */
export const FOLDER_OUT_AT: P3 = [FOLDER_OUT[0][0] + DISPATCH.w / 2 + 3, FOLDER_OUT[0][1], FOLDER_OUT[0][2]];
export const FOLDER_LANDS: P3 = [RAMP.foot + 14, (RAMP.y0 + RAMP.y1) / 2, 1.6];
export const FOLDER_PATH: readonly P3[] = (() => {
  const groove = freshGrooveLine().map(([x, yy]): P3 => [x, yy, 1.2]);
  return [FOLDER_LANDS, ...groove.slice(1), DISPATCH.dock];
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
  const stamp = hammerStroke(f, E.stampIn);
  const ink = inkSpread(f, E.stampIn);
  // the fresh bay: the one dispatch move every Worker shares
  const { cut, hatch, rise, hole, contact } = hatchRiseAt(f, { cut: E.cut, cutFrames: E.cutFrames, rise: E.rise });
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
      if (f < E.ramp) {
        // pushed level out of the slit (the push takes it)
        folder = { p: lerp3(FOLDER_SLOT, FOLDER_OUT_AT, sine((f - E.folderOut) / E.folderOutFrames)), heading: 0, slope: 0 };
      } else if (f < E.groove) {
        // off the lip: a fall down the pipe, nose down, levelling as it lands on the groove's start
        const t = clamp((f - E.ramp) / E.rampFrames);
        const a = FOLDER_OUT_AT;
        const b = FOLDER_LANDS;
        folder = { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t * t], heading: 0, slope: -0.62 * Math.sin(Math.PI * t) };
      } else {
        // along the groove, easing into the dock
        const s = Math.sin((Math.PI / 2) * clamp((f - E.groove) / E.grooveFrames));
        const { p, dir } = polylineAt(FOLDER_PATH, s);
        const h = Math.hypot(dir[0], dir[1]);
        folder = { p, heading: h > 1e-3 ? Math.atan2(dir[1], dir[0]) : 0, slope: 0 };
      }
      folderTransit = transitRamp(f - E.folderOut, E.dock - E.folderOut);
    }
  }
  return { slip, loupe, punch, stamp, tape, reel, ink, cut, hatch, rise, hole, contact, door, light, folder, folderTransit };
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
// bay sends a progress report up. At the mouth its header strip, which carries the record's header and
// its three summary lines, tears off along its perforation, flies to the print head and feeds down
// through the slot in the head's cap; meanwhile the older cards in the window shrink to stubs and pack
// east (the reel stays still: TREATMENT (c), one mechanism moving). The head drops and the record
// stamps in with a 3 f ink spread; the stubs dim one step. The body folds along its crease into a
// pointer tab, which drops into the spill drawer and lands on spring-dock in front of the older tabs.
// By f3150 the tab is seated and the frame holds.

export const EVENTS_C = {
  /**
   * From the bar-34 dolly onto the close the window holds cards (desk/beat6.ts WINDOW_CARDS: the cells the tape held after
   * MT1, in still (c)'s card style), which replace the printed tape by the close shot's 8 f print swap (closeAt); the test
   * report's tab #0408 stays in the drawer (objects/Cache.tsx draws it from here)
   */
  from: 2640,
  /** the card rises out of the request bay's work slot (4 f), then flies 18 f under the transit light into the mouth (ejecting on the beat) */
  cardOut: 3076,
  cardEject: 3080,
  cardFly: 18,
  /** the older cards shrink to stubs: oldest first (they lead, so no two ever overlap), 1 f apart, 6 f each, all packed before the head prints */
  shrink: 3100,
  shrinkFrames: 6,
  shrinkStagger: 1,
  /**
   * the header strip tears off along its perforation (3 f anticipation once the card has docked), flies to the head in an
   * arc (8 f, eased in and out: under 60 px a frame at 2.4x, still (c)'s critic item 1) and feeds down through the slot
   * in its cap (3 f)
   */
  header: 3102,
  headerFrames: 8,
  slotFrames: 3,
  /**
   * the head presses down with its hammer over the 2 f before (a dip you see, its shadow tightening) and is down on
   * stampIn, the record's contact: the header's ink shows on it, each summary line a frame later, each over 3 f (item 4);
   * the stubs dim one step (4 f)
   */
  stampIn: 3114,
  dim: 3116,
  /** on the downbeat the body folds along its crease (8 f); a 2 f hold; the tab drops into the drawer (6 f, the move curve) and lands on spring-dock */
  fold: 3120,
  foldFrames: 8,
  tabDrop: 3130,
  tabFrames: 6,
  /** the record's pointer prints 2 f after the tab it points to has landed (item 2), over a 3 f spread */
  pointer: 3138,
  /** the emptied holder folds down to hang against the south rail's face on spring-heavy as soon as the tab has left it (item 5) */
  hopper: 3131,
} as const;

export interface CacheState {
  /** the card rising out of the bay's slot (0..1), null outside it */
  out: number | null;
  /** in flight: arc progress and position */
  card: { s: number; pos: P3 } | null;
  transit: number;
  /** at the mouth: settling on spring-dock, its header strip still on it until it tears off */
  docked: { settle: number; headerOn: boolean } | null;
  /** the header strip: its flight from the mouth to over the head (0..1), then its feed down through the slot (0..1); null when not travelling */
  strip: { fly: number; feed: number } | null;
  /** the head's drop; the record's ink spread (0..1 over 3 f: each third a stage, never an alpha fade) */
  stamp: number;
  ink: number;
  /** each older card's shrink to its stub (0..1), newest first */
  shrink: number[];
  /** the tape's advance and the reel's detent: none in (c), the reel stays still */
  tape: number;
  reel: number;
  /** the stubs' one-step dim (0..1) */
  dim: number;
  /** the body's fold (0 flat .. 1 folded over), the tab's drop (0..1, eased), its spring-dock settle once landed and its landing squash (0..1) */
  fold: number;
  drop: number;
  landed: number | null;
  squash: number;
  /** the hooded reading lamp's pool on the record: 1 lights it to lit paper (still (c)); lower leaves it idle paper (the summary) */
  lamp: number;
  /** the spill drawer pulling open to take the tab (0..1 of layout.ts DRAWER_OPEN_C, spring-detent) */
  drawer: number;
  /** beat 6: the window's cards replacing the printed tape (0..1: the close's 8 f print swap); from the summary on, still (d)'s window (its own cards) */
  fade: number;
  summary: boolean;
  /** the record's ink: frames since the stamp (gl/text.ts recordStagger), the pointer's ink stage (-1 none, 0..2) */
  stagger: number;
  pointer: number;
  /** the reading lamp's light gathering onto the record as it prints (0 the window's pool, 1 still (c)'s) */
  gather: number;
  /** the test report's tab #0408 filing back behind the drawer's front as the drawer opens (0..1, spring-dock) */
  file: number;
  /** the emptied holder folded up against the rail (0..1, spring-heavy) */
  hopper: number;
  /** the head's dip as it stamps (0..1) */
  dip: number;
}

/**
 * The close shot's fine print (TREATMENT Type: printed fields swap by an 8 f cross-fade at the start of a
 * camera move, on those objects only): in from bar 34's dolly (f2640), out once bar 43's ease-out (f3360) is under way
 * and N6's line has gone (f3370: the coarse print never fades in under the line).
 */
export function closeAt(f: number): number {
  return sine((f - DOLLY_IN.from) / 8) * (1 - sine((f - Math.max(EASE_OUT.from, N6_GONE)) / 8));
}

/** The card's flight from the request bay's slot into the mouth (an arc `apex` over the chord). */
export function cardArcC(s: number): P3 {
  const u = clamp(s);
  const a = CARD_C.from;
  const b: P3 = [MOUTH.land[0], MOUTH.land[1], MOUTH.z[1] + 3];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u + 4 * CARD_C.apex * u * (1 - u)];
}

/**
 * Where the folded tab comes to rest in the spill drawer: its crease (the tab's south edge) on the
 * filed tabs in front, its face leaning back toward the key and the camera, the ID upright; the face
 * stands above the drawer's front so the ID reads (TREATMENT Lookdev (c)).
 */
export const TAB_REST_C: P3 = [rectC(DRAWER.box)[0] - 3, DRAWER.box.y0 + 5.5 - DRAWER_OPEN_C, DRAWER.z[0] + 4];
/** The tab's lean at rest (about x, its north edge up on the filed tab behind it) and its small turn (about z), radians. */
export const TAB_LEAN_C = 0.38;
export const TAB_TURN_C = -0.03;

/** Still (c)'s report at film frame f (pure); null before the close's cards are in the window. */
export function cacheAt(f: number): CacheState | null {
  const E = EVENTS_C;
  if (f < E.from) return null;
  const out = f >= E.cardOut && f < E.cardEject ? easings.outCubic((f - E.cardOut) / (E.cardEject - E.cardOut)) : null;
  const fly = (f - E.cardEject) / E.cardFly;
  const card = fly >= 0 && fly < 1 ? { s: sine(fly), pos: cardArcC(sine(fly)) } : null;
  const flown = f - E.cardEject;
  const transit = card ? transitRamp(flown, E.cardFly) : 0;
  const dockAt = E.cardEject + E.cardFly;
  const docked = f >= dockAt && f <= E.tabDrop ? { settle: springAt(f, dockAt, SPRING.dock), headerOn: f < E.header - ANTICIPATE } : null;
  const feedEnd = E.header + E.headerFrames + E.slotFrames;
  // the strip tears off and draws back a hair (3 f anticipation), then flies to the head in an arc, eased in and out
  const strip = f >= E.header - ANTICIPATE && f < feedEnd ? { fly: f < E.header ? -0.05 * Math.sin((Math.PI * (f - E.header + ANTICIPATE)) / ANTICIPATE) : sine((f - E.header) / E.headerFrames), feed: clamp((f - E.header - E.headerFrames) / E.slotFrames) } : null;
  // the head comes down over the 2 f before the stamp and is down on it (the ink's contact frame), up again over 2 f
  const stamp = clamp((f - E.stampIn + 2) / 2) * (1 - clamp((f - E.stampIn - 2) / 2));
  const ink = clamp((f - E.stampIn) / 3);
  const shrink = [0, 1, 2, 3, 4].map((i) => sine((f - E.shrink - (4 - i) * E.shrinkStagger) / E.shrinkFrames));
  const dim = sine((f - E.dim) / 4);
  const fold = sine((f - E.fold) / E.foldFrames);
  // the tab's launch: 3 f of anticipation (it lifts and draws back), then the drop eases in and out
  const drop = f < E.tabDrop ? -0.04 * Math.sin((Math.PI * clamp((f - E.tabDrop + ANTICIPATE) / ANTICIPATE))) : sine((f - E.tabDrop) / E.tabFrames);
  const landAt = E.tabDrop + E.tabFrames;
  // a hold is dead still: 12 f after the landing the spring is within 2e-3 of rest (far under a pixel), so it rests exactly
  const landed = f >= landAt ? (f - landAt >= SETTLED ? 1 : springAt(f, landAt, SPRING.dock)) : null;
  // the landing's squash: 3% at contact, gone over 4 f
  const squash = f < landAt ? 0 : Math.max(0, 1 - (f - landAt) / 4) * Math.min(1, (f - landAt + 1) / 1.5);
  // the drawer pulls open on the fold's downbeat (eased in and out over DRAWER_FRAMES, its travel revealing the filed
  // tabs as #0408's tab lies back), ready before the tab drops
  const drawer = sine((f - E.fold) / DRAWER_FRAMES) + 0;
  // beat 6 (from the close until the summary, whose world is still (d)'s): the print swap, the record's staggered ink and
  // its pointer, the reading light gathering on the record, the #0408 tab filing back, the holder folding away, the head's dip
  const summary = f >= E6.until;
  const fade = summary ? 1 : sine((f - E.from) / 8) + 0;
  const stagger = f - E.stampIn;
  const pointer = summary ? 2 : f < E.pointer ? -1 : Math.min(2, f - E.pointer);
  const gather = summary ? 1 : sine((f - E.stampIn) / 6);
  // #0408's tab lies back with the drawer's pull (its top edge's travel down reveals the filed tabs), flat before the request's tab drops
  const file = summary ? 0 : sine((f - E.fold) / DRAWER_FRAMES) + 0;
  const hopper = summary ? 0 : f - E.hopper >= 40 ? 1 : springAt(f, E.hopper, SPRING.heavy);
  const dip = summary ? 0 : stamp;
  return { out, card, transit, docked, strip, stamp, ink, shrink, tape: 0, reel: 0, dim, fold, drop, landed, squash, lamp: 1, drawer, fade, summary, stagger, pointer, gather, file, hopper, dip };
}

/** Frames after which a cache spring rests exactly (no sub-pixel creep in a hold). */
const SETTLED = 12;
/** The spill drawer's pull (still (c)'s critic: never a 2 f pop of the filed tabs). */
export const DRAWER_FRAMES = 6;

/** Cargo anticipates by 3 f (TREATMENT Motion grammar). */
const ANTICIPATE = 3;
