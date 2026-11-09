/**
 * The turn (MT2, film f1400–1660; STORYBOARD 3.3–4.2, synthesis §5 MT2): the routing job lifts off
 * your desk and becomes the Register. One object becomes another by physical means only, one idea at
 * a time (at most two or three motions overlap):
 * 1. 1436–1470: the heap, the feeders and the request step down (the focus pull leads the camera);
 *    on the hit the notes loop dips and lifts, and the eight folders (and Fix A's) are pressed into the
 *    desk, each as one body (squashed flat, then sunk north edge first), leaving their imprints.
 * 2. 1452–1530: the loop turns on edge (its outer edge up), rounds, its tabs fold in over its rim and
 *    it coils into a pack; the hub telescopes out of its centre; Fix A's tape winds in under the clip,
 *    grey stock turning to paper as it leaves the desk. The clip and the tabs ride the outer turn.
 * 3. 1496–1594: Fix B's replies leave your in-tray for their trays as one flock; five trays are pressed
 *    flat into imprints; one at a time, three wall up into the bays of (b) (the docs galley, the bug bench,
 *    the test tower): the nameplate prints, the tray's floor drops and slides away under the slate and the
 *    hatch's leaves shut over the pit. The bays stand closed and idle (no work, no light) until each is
 *    dispatched in beat 4 (desk/beat4.ts).
 * 4. 1530–1612: your desk slides south-west and the lamp narrows (after the tape has left its path); the
 *    deck rolls in collapsed from the north with its log (the fanfold on the slate under it, the filed
 *    tabs in its drawer), its legs telescope up (C9's "Above"), its shade spreading as it rises, and its
 *    parts unfold (throat, head, index arm, loupe, ramp).
 * 5. 1560–1616: the reel glides over the deck, descends and locks; the pilot jewel lights (1618).
 * 6. 1592–1627: the belt runs out of the throat carrying its gate; the first chat slip rides it into the
 *    throat (1620), the head drops and its row prints with a 3 f ink spread (1624).
 * 7. 1626–1660: every channel into one intake (the spool slides in, mail and calendar press flat into
 *    vellum drawings), the reply chute extends to your in-tray, the Continuous plate turns over on its
 *    cue (1640): the loop's hand-over is complete and your lamp dims one step (to act two's level).
 * At most three of these motions run at once (turn.test.ts). Your lamp stays on, attending, while the loop
 * rises; the request rises out of the old heap from 1648 (desk/beat4.ts), the first thing the hand-off
 * to act two carries over (desk/film.ts).
 *
 * Every value is a pure function of the film frame (springs on the synthesis's tokens, the film's move
 * curve). The schedule's order is tested (turn.test.ts): nothing acts before its cause, nothing appears
 * in one frame.
 */
import { clamp, easings } from '@aiv/core';
import { Easing, spring } from 'remotion';
import { FPS, cue } from '../cues.ts';
import { ACT_ONE_END, BULB_A, FOLDERS, LOOP_A, YOU_C_A, YOU_SHIFT_A, actOneAt, actOnePools, ciHopperFootprints, stackTop, youPoseA, type ActOneState, type LoopPose } from './actOne.ts';
import { A_ITEMS, A_LEN, A_PITCH, A_TAPE_W, A_LIFT, BAY_TRAYS, B_SLIP, FIX_A_FOLDER, IN_TRAY_A_C, IN_TRAY_PILE, PRESS_TRAYS, TRAYS, TRAY_Z, aPathAt, type AItem } from './beat3.ts';
import { bayDoor, bayShellFootprints, circleFp, pitFootprints, rectFp, registerFootprints, segFp, youFootprints, type Footprint } from './footprints.ts';
import { BAYS, BELT, CELLS_X, CHUTE, CHUTE_POSTS, DECK, DISPATCH_HOUSING, FANFOLD, FEEDERS, FEEDER_H, GATE, LAMP, LEG_R, LEG_STRUTS, NEXT_SLIP, PRINT_HEAD, REEL, REQUEST, SHEET, SPOOL, TAPE, YOU, rectC, shadowOffset, type BayId, type BayLayout, type P2, type P3, type Pool, type Rect } from './layout.ts';
import { B4, REEL_LOCK, cellLitAt, requestAt } from './beat4.ts';
import { EMIT, LIGHT_HEX, tint } from './pools.ts';
import { LAMP_AIM, LAMP_STEPS, SPRING, deskStateAt, hammerOffset, springAt, type DeskState } from './state.ts';
import { LAMP_FOOT_Z, YOU_POSE_B, lampElbow, type YouPose } from './you.ts';

/** The span the turn poses (MT2's: lookdev/frames.ts). Before it, act one; from its end, act two's world. */
export const TURN_SPAN: readonly [number, number] = [ACT_ONE_END, 1660];

/** The synthesis's curves: move (.2, 0, 0, 1) and enter (.05, .7, .1, 1). */
const MOVE = Easing.bezier(0.2, 0, 0, 1);
const ENTER = Easing.bezier(0.05, 0.7, 0.1, 1);
/** The synthesis's camera curve (.65, 0, .35, 1): an in-out for the deck's long roll in from the north. */
const CAMERA = Easing.bezier(0.65, 0, 0.35, 1);
const span01 = (f: number, a: number, b: number): number => clamp((f - a) / (b - a));
/** The move curve over [a, b] (0 before, 1 after). */
const moveOver = (f: number, a: number, b: number): number => MOVE(span01(f, a, b));

/** A spring on one of the synthesis's tokens, stretched to land over `dur` frames (0 before `start`). */
export function springOver(f: number, start: number, dur: number, config: (typeof SPRING)[keyof typeof SPRING]): number {
  return f <= start ? 0 : spring({ frame: f - start, fps: FPS, config: { ...config, overshootClamping: false }, durationInFrames: dur });
}

/**
 * The schedule (film frames). The turn hit is bar 19's downbeat (cues.ts `turn`); the lock, the jewel,
 * the first slip and its row keep their frames; the Continuous plate turns over on `trait-continuous`.
 */
export const TURN = {
  /** 3.3: Fix A's queue moves one station on the beat; Fix B's last reply is posted (3 f anticipation, a 14 f arc) */
  advance: 1400,
  advanceFrames: 10,
  bPost: 1394,
  bArc: 14,
  /** everything stills, pens lifted (4 f): 16 f of stillness before the hit */
  still: 1420,
  hit: cue('turn').frame,
  /** the focus pull: the heap, the feeders and the request step down before the camera moves, and come back for "hears every channel" */
  stepIn: 1436,
  stepOut: 1592,
  stepFrames: 16,
  /** your act-one label leaves as the camera starts (its wipe, then its leader, 6 f) */
  youOut: 1441,
  /** the loop: a 2% dip (4 f), the lift on spring-heavy to h 160, on edge and round, its tabs folding in over its rim, then it coils */
  dipFrames: 4,
  rise: 1444,
  riseEnd: 1496,
  edge: 1452,
  edgeEnd: 1490,
  fold: 1478,
  foldFrames: 14,
  coil: 1486,
  coilEnd: 1508,
  hub: 1494,
  hubFrames: 14,
  /** the folders pressed into the desk, Fix A's first then F1..F8, 2 f apart, each over 8 f */
  press: 1442,
  pressStagger: 2,
  pressFrames: 8,
  /** Fix A's tape winds onto the coil (its desk run leaves the desk before your desk slides over its path) */
  wind: 1494,
  windEnd: 1530,
  /** your lamp stays on, attending, while the loop rises; once the loop's hand-over is complete (the Continuous plate docks) it pulls its bulb in and dims one step, to act two's level (state.ts LAMP_STEPS.dim) */
  lampHandOver: 1642,
  /** your desk slides south-west once Fix A's tape has left its path; the lamp re-aims at your in-tray */
  slide: 1530,
  slideEnd: 1560,
  /** the deck rolls in collapsed from the north (the film's camera curve: it gathers speed off the frame and brakes in), then its legs telescope (3 f stagger) */
  deckIn: 1536,
  deckInEnd: 1570,
  legs: 1566,
  legStagger: 3,
  legFrames: 20,
  /** the stowed parts move into place, 3 f apart (structure on spring-settle, arms on spring-detent): throat, head, index arm, loupe; the ramp */
  parts: 1576,
  partFrames: 16,
  ramp: 1582,
  /** the reply chute extends out of the deck's south-west corner to your in-tray once the intake is in; its posts telescope down */
  chute: 1626,
  chuteEnd: 1642,
  posts: 1640,
  postFrames: 10,
  /** Fix B: the replies leave your in-tray as a flock (1.5 f apart; 3 f anticipation, a 14 f arc), the pressed trays' first */
  replies: 1496,
  replyStagger: 1.5,
  replyArc: 14,
  /** a tray pressed flat (8 f) 2 f after its reply lands; the bays wall up one at a time (bayTimes) */
  trayAfter: 2,
  growFrames: 14,
  /** the bays in turn (docs, bug, tests): each walls up 16 f after the one before, the test bay's once the coil has left its place (it hovers over its box) */
  bayFrom: 1526,
  bayGap: 16,
  testsFrom: 1564,
  /** the coil rises over the deck's lamp and glides straight to the reel (clear of the bays), descends and locks */
  glide: 1560,
  glideEnd: 1592,
  descend: 1594,
  lock: 1616,
  detent: 1604,
  jewel: 1618,
  /** the belt extends from the throat carrying its gate (for the first slip); then every other channel: the spool slides in from the north, mail and calendar press flat */
  belt: 1592,
  beltFrames: 14,
  spool: 1626,
  spoolFrames: 16,
  mail: 1628,
  calendar: 1632,
  flattenFrames: 8,
  /** the leader out of the head; the first chat slip: posted, rides the belt, enters the throat, fed to the head; the head drops, the row prints */
  leader: 1594,
  leaderEnd: 1612,
  post: 1595,
  postArc: 12,
  ride: 1610,
  throat: 1620,
  feedFrames: 3,
  headDrop: 1620,
  print: 1624,
  inkFrames: 3,
  /** the Continuous plate turns over (riding face down since the deck came in) */
  plate: cue('trait-continuous').frame,
  /** labels: "you · 你" re-enters once the camera has settled; "Router" 2 f after the lock */
  youLabel: 1604,
  routerLabel: 1618,
} as const;

/** How high the loop lifts, and how high the coil glides (over the reading lamp's arm). */
export const LIFT_H = 160;
export const GLIDE_H = 236;
/** The ribbon rounds to this radius on edge, then coils in to the hub; Fix A's tape winds it out to the pack's radius. */
export const COIL_R0 = 70;
/** The collapsed deck: everything on it this far down, and this far north while it rolls in. */
export const DECK_LOW = 80;
export const DECK_NORTH = 560;
/**
 * The parts ride in with the deck, stowed: the throat lowered under the deck's west end, the head lying flat (hinged
 * at its west edge), the index arm and the loupe parked, the ramp raised, the plate face down.
 */
export const STOW = { throat: -42, head: Math.PI / 2, index: 1.9, loupe: -1.4, ramp: (-2 * Math.PI) / 3, plate: Math.PI } as const;
/** The clip's place on the reel at the lock: south-east, clear of the frame and of the tape's rise (radians, counter-clockwise from east). */
export const CLIP_AT_LOCK = -Math.PI / 4;
/** The clip's parameter on the loop (act one's: just past where the ends overlap). */
export const CLIP_T = LOOP_A.clipAt + 0.05;

// ------------------------------------------------------------------------------------------------
// The loop and the coil

export interface CoilState {
  c: P2;
  /** the coil's underside */
  h: number;
  rIn: number;
  rOut: number;
  /** its height (the ribbon on edge: the tape's width) */
  t: number;
  /** turned so far (radians, counter-clockwise from above) */
  spin: number;
  /** the hub telescoped up out of the coil's centre (0..1), then the spokes out from it (0..1) */
  hub: number;
  spokes: number;
  /** the pack's colour from the loop's tape to the reel's (0..1) */
  stock: number;
}
export interface LoopTurn {
  /** the ribbon while it is one (null once it has coiled): its pose, how far it has turned on edge (outer edge up), its tabs folded in over the rim */
  ribbon: { L: LoopPose; h: number; edge: number; fold: number } | null;
  coil: CoilState | null;
  /** the outer turn's riders (the clip and the tabs): how far on edge, how far folded in over the rim (carried through the handover) */
  edge: number;
  fold: number;
}

/** Fix A's tape wound onto the coil so far (u), and the tape's whole length. */
const A_SPAN0 = 15;
export const A_TAPE_LEN = A_LEN + A_SPAN0;
/** A trapezoid-velocity ease (constant-speed transport with short ramps), 0..1. */
function transport(t: number, ramp = 0.14): number {
  const x = clamp(t);
  const v = 1 / (1 - ramp);
  if (x < ramp) return (v * x * x) / (2 * ramp);
  if (x > 1 - ramp) return 1 - (v * (1 - x) * (1 - x)) / (2 * ramp);
  return v * (x - ramp / 2);
}
export function woundAt(f: number): number {
  return A_PITCH * MOVE(span01(f, TURN.advance, TURN.advance + TURN.advanceFrames)) + (A_TAPE_LEN - A_PITCH) * transport(span01(f, TURN.wind, TURN.windEnd));
}

function liftAt(f: number): number {
  return LIFT_H * springOver(f, TURN.rise, TURN.riseEnd - TURN.rise, SPRING.heavy);
}

/** The coil's centre: from the loop's centre straight over the deck to the reel (high enough to pass over the reading lamp). */
function glideAt(f: number): P2 {
  const e = moveOver(f, TURN.glide, TURN.glideEnd);
  return [YOU_C_A[0] + (REEL.x - YOU_C_A[0]) * e, YOU_C_A[1] + (REEL.y - YOU_C_A[1]) * e];
}

const PACK_H = REEL.packZ[1] - REEL.packZ[0];
/**
 * The coil's last turn: six turns while Fix A winds on, ending where beat 4's detents bring the reel to the Register's
 * own rest angle by MT1 (beat4.ts REEL_LOCK), so stills (b) to (d) keep their reel.
 */
export const SPIN_TOTAL = 6 * Math.PI + REEL_LOCK;
export function loopTurnAt(f: number): LoopTurn {
  const dip = f < TURN.hit ? 0 : Math.sin(Math.PI * span01(f, TURN.hit, TURN.hit + 2 * TURN.dipFrames));
  const edge = springOver(f, TURN.edge, TURN.edgeEnd - TURN.edge, SPRING.heavy);
  const coilK = springOver(f, TURN.coil, TURN.coilEnd - TURN.coil, SPRING.heavy);
  const c = glideAt(f);
  const lift = liftAt(f);
  const descend = moveOver(f, TURN.descend, TURN.lock);
  // the ribbon's underside (act one's tape lies at LOOP_A.z): it ends on the reel's flange
  const up = moveOver(f, TURN.glide, TURN.glide + 14);
  const h = (f < TURN.descend ? lift + (GLIDE_H - LIFT_H) * up : GLIDE_H + (REEL.packZ[0] - LOOP_A.z - GLIDE_H) * descend) + LOOP_A.z;
  // the ribbon: a 2% dip, then it rounds from act one's superellipse to the coil's circle as it turns on edge
  const k = 1 - 0.02 * dip;
  const round = Math.min(edge, 1);
  const L: LoopPose = {
    ...LOOP_A,
    c,
    a: (LOOP_A.a + (COIL_R0 - LOOP_A.a) * round) * k,
    b: (LOOP_A.b + (COIL_R0 - LOOP_A.b) * round) * k,
    n: LOOP_A.n + (2 - LOOP_A.n) * round,
    z: h,
  };
  const fold = moveOver(f, TURN.fold, TURN.fold + TURN.foldFrames);
  const wound = woundAt(f) - A_PITCH;
  const windK = clamp(wound / (A_TAPE_LEN - A_PITCH));
  const rOut = Math.sqrt(COIL_R0 * COIL_R0 + (REEL.packR * REEL.packR - COIL_R0 * COIL_R0) * windK);
  // the turn: carried round while it winds, the last 0.26 rad on spring-detent at the lock
  const spin = (SPIN_TOTAL + 0.26) * transport(span01(f, TURN.coil, TURN.windEnd)) - 0.26 * springAt(f, TURN.detent, SPRING.detent);
  const coil: CoilState | null =
    f < TURN.coil
      ? null
      : {
          c,
          h,
          rIn: COIL_R0 - 0.75 - (COIL_R0 - 0.75 - REEL.hubR) * coilK,
          rOut: rOut + 0.75 * (1 - windK),
          t: A_TAPE_W + (PACK_H - A_TAPE_W) * coilK,
          spin: f >= TURN.lock + 8 ? SPIN_TOTAL : spin,
          hub: moveOver(f, TURN.hub, TURN.hub + TURN.hubFrames),
          spokes: moveOver(f, TURN.hub + TURN.hubFrames - 2, TURN.hub + TURN.hubFrames + 10),
          stock: springAt(f, TURN.coil, SPRING.effects),
        };
  return { ribbon: f < TURN.coil ? { L, h, edge, fold } : null, coil, edge: Math.min(edge, 1), fold };
}

/** The coil's outer turn as a loop pose (a circle at the pack's radius), for the clip and tabs that ride it. */
export const coilRim = (C: CoilState): LoopPose => ({ ...LOOP_A, c: C.c, a: C.rOut, b: C.rOut, n: 2, z: C.h, w: C.t });

// ------------------------------------------------------------------------------------------------
// Fix A's tape: on the desk from its tail to the lift-off, then a free span up to the loop or coil

export interface TapeSpan {
  /** where it leaves the desk and where it meets the loop/coil */
  a: P3;
  b: P3;
  /** the width direction at each end (unit) */
  wa: P3;
  wb: P3;
  len: number;
}
export interface FixATurn {
  /** tape wound so far (u) */
  wound: number;
  span: TapeSpan;
  /** the desk part: from the lift-off back to the tail (path distance), 0 when it has all left the desk */
  deskLen: number;
  /** how much of the span carries tape (from the coil end) */
  spanLen: number;
  /** each queued item's pose, or null once wound in */
  items: ({ p: P3; x: P3; y: P3; paper: number } | null)[];
}

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: P3): P3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Where Fix A's tape meets the loop or the coil: on the ribbon's centreline facing the lift-off, or tangent to the coil's outer turn. */
function attachAt(lt: LoopTurn): { p: P3; w: P3 } {
  if (lt.ribbon) {
    const { L, edge } = lt.ribbon;
    const t = Math.atan2((A_LIFT[1] - L.c[1]) / L.b, (A_LIFT[0] - L.c[0]) / L.a);
    const cs = Math.cos(t);
    const sn = Math.sin(t);
    const e = 2 / L.n;
    const x = L.c[0] + L.a * Math.sign(cs) * Math.abs(cs) ** e;
    const y = L.c[1] + L.b * Math.sign(sn) * Math.abs(sn) ** e;
    const out = norm([x - L.c[0], y - L.c[1], 0]);
    const th = (edge * Math.PI) / 2;
    // under the tape (its outer edge turning up): the tape's centreline
    return { p: [x, y, L.z - 0.6 + (A_TAPE_W / 2) * Math.sin(th)], w: norm([out[0] * Math.cos(th), out[1] * Math.cos(th), Math.sin(th)]) };
  }
  const C = lt.coil!;
  const d = norm([A_LIFT[0] - C.c[0], A_LIFT[1] - C.c[1], 0]);
  return { p: [C.c[0] + d[0] * C.rOut, C.c[1] + d[1] * C.rOut, C.h + C.t / 2], w: [0, 0, 1] };
}

export function fixATurnAt(f: number, lt: LoopTurn): FixATurn {
  const wound = woundAt(f);
  const at = attachAt(lt);
  const a: P3 = [A_LIFT[0], A_LIFT[1], 0.5];
  const along = sub(at.p, a);
  const len = Math.hypot(along[0], along[1], along[2]);
  // the desk-end width: flat, across the tape's heading off the desk
  const hd = norm([along[0], along[1], 0]);
  const wa: P3 = [-hd[1], hd[0], 0];
  const wb: P3 = at.w[2] > 0.99 ? at.w : at.w[0] * wa[0] + at.w[1] * wa[1] < 0 ? [-at.w[0], -at.w[1], at.w[2]] : at.w;
  const span: TapeSpan = { a, b: at.p, wa, wb, len };
  const tail = A_TAPE_LEN - wound;
  const deskLen = Math.max(0, tail - len);
  const spanLen = clamp(tail, 0, len);
  const items = A_ITEMS.map((it: AItem) => {
    // the item's material place, from the lead end; its place along the tape now, from the coil end
    const u = it.d + A_SPAN0;
    const p = u - wound;
    if (p < it.l / 2) return null;
    if (p <= len) {
      const pos = lerp3(at.p, a, p / len);
      const w = norm(lerp3(wb, wa, p / len));
      const x = norm(along);
      return { p: [pos[0], pos[1], pos[2] + 0.8] as P3, x, y: w, paper: clamp((len - p) / 40) };
    }
    const { p: q, dir } = aPathAt(p - len);
    // on the desk the slip lies along the tape, its nose toward the lift-off
    return { p: [q[0], q[1], 1.1] as P3, x: [-dir[0], -dir[1], 0] as P3, y: [dir[1], -dir[0], 0] as P3, paper: 0 };
  });
  return { wound, span, deskLen, spanLen, items };
}

// ------------------------------------------------------------------------------------------------
// Pressing: a folder or a tray squashed flat as one body, then sunk into the desk north edge first

/** A body being pressed into the desk: its height scale, its tilt (radians, north edge down) and how far it has sunk. */
export interface Press {
  k: number;
  scaleZ: number;
  tilt: number;
  sink: number;
}
/** The press at a frame for a body `depth` u deep and `top` u tall (8 f: squash 0–0.7, tilt, sink 0.7–1). */
export function pressAt(f: number, start: number, depth: number, top: number, frames: number = TURN.pressFrames): Press {
  const k = span01(f, start, start + frames);
  const sq = easings.inOutSine(clamp(k / 0.7));
  const scaleZ = 1 - 0.94 * sq;
  const tilt = 0.06 * clamp((k - 0.6) / 0.1);
  // sunk until even its south edge's top is under the slate
  const sink = (top * 0.06 + (depth / 2) * Math.sin(0.06) + 0.8) * clamp((k - 0.7) / 0.3) ** 1.2;
  return { k, scaleZ, tilt, sink };
}
/** How deep the desk's imprint under a pressed body is (it is in before the body sinks into it). */
export const imprintOf = (p: Press): number => clamp((p.k - 0.3) / 0.3);

// ------------------------------------------------------------------------------------------------
// Fix B: the replies; five trays pressed flat, three walled up into the bays of (b)

export interface BayTurn {
  id: BayId;
  /** the tray's growth into the bay's walls (0..1): its rect, wall height, thickness and door interpolate to the bay's */
  grow: number;
  /** grey stock to graphite and enamel (0..1) */
  built: number;
  /** the nameplate's print wiped in (0..1) */
  print: number;
  /** the tray's floor: dropped under the slate (0..1), then slid east out of the walls (0..1) */
  drop: number;
  slide: number;
  /** the hatch under it: its leaves (1 open while the floor goes, 0 shut over the pit), and whether its hole in the slate is open */
  leaves: number;
  hole: boolean;
  /** walled up, its hatch shut: the closed, idle bay (objects/Bay.tsx draws it from here, as act two does) */
  done: boolean;
}
export interface FixBTurn {
  /** each reply slip k (from tray k): its centre, turn, tilt, and how far it has turned to paper */
  slips: { p: P3; rot: number; tilt: number; paper: number }[];
  /** each tray pressed into the desk (null: not pressed; trays that become bays are never pressed) */
  press: (Press | null)[];
  /** the trays that become bays (BAY_TRAYS order) */
  bays: BayTurn[];
}

const IN_TRAY_Z = YOU.top + 3;
/** The order the replies leave in: the trays that are pressed first (the ones inside a bay's box before the others), then the bays' own. */
export const REPLY_ORDER: readonly number[] = [7, 3, 2, 0, 1, ...BAY_TRAYS.map((b) => b.k).reverse()];
/** Slip k leaves your in-tray. */
export const replyLeaves = (k: number): number => TURN.replies + TURN.replyStagger * REPLY_ORDER.indexOf(k);
export const replyLands = (k: number): number => replyLeaves(k) + 3 + TURN.replyArc;
const overlaps = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const trayRect = (k: number): Rect => ({ x0: TRAYS[k].c[0] - TRAYS[k].w / 2, x1: TRAYS[k].c[0] + TRAYS[k].w / 2, y0: TRAYS[k].c[1] - TRAYS[k].d / 2, y1: TRAYS[k].c[1] + TRAYS[k].d / 2 });
/** The order the bays wall up in, one at a time. */
export const BAY_ORDER: readonly BayId[] = ['docs', 'bug', 'tests'];
/**
 * A tray's own change starts 2 f after its reply has come home; a bay's tray also waits for the trays inside its box
 * to be pressed and for the bay before it (one at a time, 16 f apart), and the test bay's for the coil to leave.
 */
export const trayStarts = (k: number): number => {
  const own = replyLands(k) + TURN.trayAfter;
  const bay = BAY_TRAYS.find((b) => b.k === k);
  if (!bay) return own;
  const inside = PRESS_TRAYS.filter((j) => overlaps(trayRect(j), BAYS[bay.id].box)).map((j) => replyLands(j) + TURN.trayAfter + TURN.pressFrames);
  const i = BAY_ORDER.indexOf(bay.id);
  const after = i > 0 ? trayStarts(BAY_TRAYS.find((b) => b.id === BAY_ORDER[i - 1])!.k) + TURN.bayGap : TURN.bayFrom;
  return Math.max(own, ...inside, after, bay.id === 'tests' ? TURN.testsFrom : 0);
};
/** A bay's schedule from its tray's start: the walls grow (14 f), the nameplate prints (4 f), the floor drops (2 f) and slides away (8 f), the hatch's leaves shut over the pit (4 f): closed. */
export const bayTimes = (k: number) => {
  const s = trayStarts(k);
  return { grow: s, print: s + 12, drop: s + 14, slide: s + 16, shut: s + 24, closed: s + 28 };
};

function inTraySlot(k: number, shift: P2): P3 {
  const o = IN_TRAY_PILE[k].o;
  return [IN_TRAY_A_C[0] - YOU_SHIFT_A[0] + shift[0] + o[0], IN_TRAY_A_C[1] - YOU_SHIFT_A[1] + shift[1] + o[1], IN_TRAY_Z + 0.9 * k];
}
/** Where a reply rests in its tray (tray-local offset from its centre). */
export const TRAY_REST: P3 = [16, -6, TRAY_Z.floor + 0.6];
const trayRest = (k: number): P3 => [TRAYS[k].c[0] + TRAY_REST[0], TRAYS[k].c[1] + TRAY_REST[1], TRAY_REST[2]];

export function fixBTurnAt(f: number, shiftAt: (f: number) => P2): FixBTurn {
  const slips = IN_TRAY_PILE.map((pile, k) => {
    // the last reply (k 7) is still in flight at f1400: posted from its tray, it lands on top of the pile
    if (k === 7 && f < TURN.bPost + 3 + TURN.bArc) {
      const u = clamp((f - TURN.bPost - 3) / TURN.bArc);
      const from = trayRest(7);
      const to = inTraySlot(7, shiftAt(f));
      const e = Math.sin((u * Math.PI) / 2) ** 2;
      const p: P3 = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + (to[2] - from[2]) * e + 4 * 60 * u * (1 - u) + (f < TURN.bPost + 3 ? 3 * clamp((f - TURN.bPost) / 3) : 0)];
      return { p, rot: 0.2 + (pile.rot - 0.2) * e, tilt: 0.3 * Math.sin(u * Math.PI), paper: 0 };
    }
    const leave = replyLeaves(k);
    if (f < leave) return { p: inTraySlot(k, shiftAt(f)), rot: pile.rot, tilt: 0, paper: 0 };
    // 3 f anticipation (it lifts 4 u), then an 18 f arc home (apex 70), landing on its tray's floor
    const from = inTraySlot(k, shiftAt(leave + 3));
    const to = trayRest(k);
    if (f < leave + 3) {
      const a = inTraySlot(k, shiftAt(f));
      return { p: [a[0], a[1], a[2] + 4 * MOVE((f - leave) / 3)] as P3, rot: pile.rot, tilt: 0, paper: 0 };
    }
    const u = clamp((f - leave - 3) / TURN.replyArc);
    const e = Math.sin((u * Math.PI) / 2) ** 2;
    const p: P3 = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + 4 + (to[2] - from[2] - 4) * e + 4 * 70 * u * (1 - u)];
    const homeRot = 0.08 * (k % 2 ? 1 : -1);
    return { p, rot: pile.rot + (homeRot - pile.rot) * e, tilt: 0.25 * Math.sin(u * Math.PI), paper: 0 };
  });
  const press = TRAYS.map((tr, k) => (PRESS_TRAYS.includes(k) ? pressAt(f, trayStarts(k), tr.d, TRAY_Z.rim + 2) : null));
  const bays = BAY_TRAYS.map(({ k, id }): BayTurn => {
    const T = bayTimes(k);
    return {
      id,
      grow: springOver(f, T.grow, TURN.growFrames, SPRING.heavy),
      built: springAt(f, T.grow, SPRING.effects),
      print: span01(f, T.print, T.print + 4),
      drop: moveOver(f, T.drop, T.drop + 2),
      slide: moveOver(f, T.slide, T.slide + 8),
      leaves: 1 - easings.inOutSine(span01(f, T.shut, T.shut + 4)),
      hole: f >= T.drop && f < T.closed,
      done: f >= T.closed,
    };
  });
  return { slips, press, bays };
}

/** A bay's walls while its tray grows into them: the box, the wall height and thickness, the south wall, the door gap. */
export interface BayShape {
  box: Rect;
  wallH: number;
  wall: number;
  southWall: number;
  door: [number, number];
}
export function bayShapeAt(k: number, b: BayLayout, grow: number): BayShape {
  const tr = TRAYS[k];
  const t: Rect = { x0: tr.c[0] - tr.w / 2, x1: tr.c[0] + tr.w / 2, y0: tr.c[1] - tr.d / 2, y1: tr.c[1] + tr.d / 2 };
  const g = grow;
  const mix = (a: number, c: number) => a + (c - a) * g;
  const box: Rect = { x0: mix(t.x0, b.box.x0), x1: mix(t.x1, b.box.x1), y0: mix(t.y0, b.box.y0), y1: mix(t.y1, b.box.y1) };
  // the door gap: the tray's (30 u at its offset) to the bay's, relative to the box's west edge
  const tDoor: [number, number] = [tr.c[0] + tr.door - 15 - t.x0, tr.c[0] + tr.door + 15 - t.x0];
  const bDoor: [number, number] = [b.door[0] - b.box.x0, b.door[1] - b.box.x0];
  return {
    box,
    wallH: mix(tr.wall, b.wallH),
    wall: mix(TRAY_Z.wallT, b.wall),
    southWall: mix(TRAY_Z.wallT + 2, b.southWall),
    door: [box.x0 + mix(tDoor[0], bDoor[0]), box.x0 + mix(tDoor[1], bDoor[1])],
  };
}
/** The walls of a bay shape (as footprints.ts bayWalls). */
export function shapeWalls(s: BayShape): Rect[] {
  const { box, wall, southWall, door } = s;
  return [
    { x0: box.x0, x1: box.x0 + wall, y0: box.y0, y1: box.y1 },
    { x0: box.x1 - wall, x1: box.x1, y0: box.y0, y1: box.y1 },
    { x0: box.x0 + wall, x1: box.x1 - wall, y0: box.y0, y1: box.y0 + southWall },
    { x0: box.x0 + wall, x1: door[0], y0: box.y1 - wall, y1: box.y1 },
    { x0: door[1], x1: box.x1 - wall, y0: box.y1 - wall, y1: box.y1 },
  ];
}

// ------------------------------------------------------------------------------------------------
// The deck and what docks on it

export interface DeckTurn {
  /** the deck's pose: north offset while it rolls in, its lift (negative: below its place), its tilt (about x, about y) */
  dy: number;
  dz: number;
  tilt: P2;
  /** each leg's extension 0 (collapsed) .. 1 (up), in LEG_STRUTS order */
  legs: number[];
}
export interface PartsTurn {
  /** the throat's height (0 seated), the head's hinge, the index arm's and the loupe's swing, the ramp's hinge (radians, 0 in place) */
  throat: number;
  head: number;
  index: number;
  loupe: number;
  ramp: number;
  /** the reply chute extended out of the deck's corner (0..1 of its length), its posts telescoped down to the desk (0..1) */
  chute: number;
  posts: number;
  /** the Continuous plate turned over (radians, 0 face up: it rides in face down) */
  plate: number;
}

/** The order the legs telescope (south-west, south-east, north-west, north-east: the side nearest the camera first). */
const LEG_ORDER = [0, 1, 2, 3];
export function deckTurnAt(f: number): DeckTurn {
  const roll = CAMERA(span01(f, TURN.deckIn, TURN.deckInEnd));
  const legs = LEG_ORDER.map((k) => springOver(f, TURN.legs + TURN.legStagger * k, TURN.legFrames, SPRING.heavy));
  const zOf = (k: number) => -DECK_LOW * (1 - legs[k]);
  const south = (zOf(0) + zOf(1)) / 2;
  const north = (zOf(2) + zOf(3)) / 2;
  const west = (zOf(0) + zOf(2)) / 2;
  const east = (zOf(1) + zOf(3)) / 2;
  const depth = LEG_STRUTS[2].top[1] - LEG_STRUTS[0].top[1];
  const width = LEG_STRUTS[1].top[0] - LEG_STRUTS[0].top[0];
  return { dy: DECK_NORTH * (1 - roll), dz: (south + north) / 2, tilt: [Math.atan2(north - south, depth), -Math.atan2(east - west, width)], legs };
}

/** A stowed part moving into place: structure on spring-settle, the swinging arms on spring-detent. */
const into = (f: number, start: number, stow: number, config: (typeof SPRING)[keyof typeof SPRING] = SPRING.settle): number => stow * (1 - springOver(f, start, TURN.partFrames, config));
export function partsTurnAt(f: number): PartsTurn {
  const p = TURN.parts;
  return {
    throat: into(f, p, STOW.throat),
    head: into(f, p + 3, STOW.head),
    index: into(f, p + 6, STOW.index, SPRING.detent),
    loupe: into(f, p + 9, STOW.loupe, SPRING.detent),
    ramp: into(f, TURN.ramp, STOW.ramp),
    chute: moveOver(f, TURN.chute, TURN.chuteEnd),
    posts: springOver(f, TURN.posts, TURN.postFrames, SPRING.settle),
    // it rides in face down and turns over on the cue (edge-on at about f1640), settling a few frames later
    plate: STOW.plate * (1 - springOver(f, TURN.plate - 6, 14, SPRING.settle)),
  };
}

/** Where a deck point (world, in its place) is at a deck pose. */
export function deckPoint(d: DeckTurn, p: P3): P3 {
  const cx = (DECK.x0 + DECK.x1) / 2;
  const cy = (DECK.y0 + DECK.y1) / 2;
  const [ax, ay] = d.tilt;
  // rotation about x then y (three's XYZ order), round the deck's centre at z 0
  let x = p[0] - cx;
  let y = p[1] - cy;
  let z = p[2];
  const y1 = y * Math.cos(ax) - z * Math.sin(ax);
  const z1 = y * Math.sin(ax) + z * Math.cos(ax);
  y = y1;
  z = z1;
  const x2 = x * Math.cos(ay) + z * Math.sin(ay);
  const z2 = -x * Math.sin(ay) + z * Math.cos(ay);
  x = x2;
  z = z2;
  return [x + cx, y + cy + d.dy, z + d.dz];
}

/** Each leg: its foot (on the desk, rolling with the deck), its top under the rail's corner, and how far it is up. */
export function legsAt(d: DeckTurn): { foot: P3; top: P3; up: number }[] {
  return LEG_STRUTS.map((l, k) => ({ foot: [l.foot[0], l.foot[1] + d.dy, 0] as P3, top: deckPoint(d, l.top), up: d.legs[k] }));
}

// ------------------------------------------------------------------------------------------------
// You

/** Your desk's slide (0 at act one's place … 1 at act two's). */
export function slideAt(f: number): number {
  return springOver(f, TURN.slide, TURN.slideEnd - TURN.slide, SPRING.heavy);
}
export const shiftAt = (f: number): P2 => {
  const m = slideAt(f);
  return [YOU_SHIFT_A[0] * (1 - m), YOU_SHIFT_A[1] * (1 - m)];
};

/** Act one, held from the stillness on (pens lifted over 4 f, nothing else moving). */
export function heldActOne(f: number): ActOneState {
  const a = actOneAt(Math.min(f, TURN.still - 1));
  if (f < TURN.still) return a;
  const lift = clamp((f - TURN.still) / 4);
  return { ...a, f, folders: a.folders.map((s) => ({ ...s, pen: Math.max(s.pen, lift) })), flight: null };
}

/** Your lamp after the turn: a step dimmer once the loop is handed over, waiting for a reply (act two's level, state.ts LAMP_STEPS). */
export const TURN_LAMP = LAMP_STEPS.dim;
/** How far your lamp has dimmed and pulled its bulb in (0 attending … 1 waiting), on spring-effects once the loop's hand-over is complete. */
export const lampDimAt = (f: number): number => {
  const k = springAt(f, TURN.lampHandOver, SPRING.effects);
  // settled: exactly act two's level (a hold is dead still, and the hand-off to act two never steps)
  return k > 0.9995 ? 1 : k;
};

export function youPoseTurn(f: number): YouPose {
  const m = slideAt(f);
  const A = youPoseA(heldActOne(f));
  // the in-tray holds an older reply under Fix B's slips (act two's, YourDesk slip1)
  const inTray = { inTray: true } as const;
  if (m >= 0.9995) {
    const dim = lampDimAt(f);
    if (dim >= 1) return { ...YOU_POSE_B, bulb: EMIT.bulbMax * TURN_LAMP, ...inTray };
    return { ...YOU_POSE_B, bulb: BULB_A.level + (EMIT.bulbMax * TURN_LAMP - BULB_A.level) * dim, bulbOut: BULB_A.out * (1 - dim), ...inTray };
  }
  if (m <= 0) {
    const dim = lampDimAt(f);
    return { ...A, bulb: BULB_A.level + (EMIT.bulbMax * TURN_LAMP - BULB_A.level) * dim, bulbOut: BULB_A.out * (1 - dim), ...inTray };
  }
  const mix = (a: P3, b: P3): P3 => lerp3(a, b, m);
  const head = mix(A.lamp.head, LAMP.head);
  const aim = mix(A.lamp.aim, LAMP.aim);
  const foot: P3 = [LAMP.base[0], LAMP.base[1], LAMP.base[2] + LAMP_FOOT_Z];
  const poleA = sub(A.lamp.elbow, foot);
  const poleB = sub(YOU_POSE_B.lamp.elbow, foot);
  const elbow = lampElbow(LAMP.base, head, mix(poleA, poleB));
  const dim = lampDimAt(f);
  return {
    shift: shiftAt(f),
    lamp: { base: LAMP.base, elbow, head, aim },
    bulb: BULB_A.level + (EMIT.bulbMax * TURN_LAMP - BULB_A.level) * dim,
    bulbOut: BULB_A.out * (1 - dim),
    strut: 'tray',
    held: { key: 1, glass: 1, strut: 1 },
    ...inTray,
  };
}

// ------------------------------------------------------------------------------------------------
// The intake, the first slip, the tape's leader, the stamp

export interface IntakeTurn {
  /** the spool sliding in from the north (u north of its seat; null: not yet in the frame) */
  spool: number | null;
  /** the belt extended out of the throat (0..1 of its run; it carries the gate at its foot; null: still stowed) */
  belt: number | null;
  /** mail and calendar: the generic boxes pressed into the desk, leaving their vellum drawings (k: 0 generic … 1 vellum) */
  mail: Press;
  calendar: Press;
}
/** How far north the spool starts (off the top of the frame). */
export const SPOOL_NORTH = 340;
export function intakeTurnAt(f: number): IntakeTurn {
  return {
    spool: f < TURN.spool ? null : SPOOL_NORTH * (1 - springOver(f, TURN.spool, TURN.spoolFrames, SPRING.heavy)),
    belt: f < TURN.belt ? null : springOver(f, TURN.belt, TURN.beltFrames, SPRING.settle),
    mail: pressAt(f, TURN.mail, FEEDERS.mail.y1 - FEEDERS.mail.y0, 34, TURN.flattenFrames),
    calendar: pressAt(f, TURN.calendar, FEEDERS.calendar.y1 - FEEDERS.calendar.y0, 24, TURN.flattenFrames),
  };
}
/** Where the belt's foot (and the gate on it) is while the belt extends (e: 0 at the throat … 1 seated). */
export const beltEnd = (e: number): P3 => lerp3(BELT.to, BELT.from, e);

export interface SlipTurn {
  p: P3;
  heading: number;
  slope: number;
}
/** The first chat slip: out of the spout over the gate (3 f anticipation, a 12 f arc), up the belt, into the throat, fed to the head. */
export function firstSlipAt(f: number): SlipTurn | null {
  const S = NEXT_SLIP;
  if (f < TURN.post || f >= TURN.throat + TURN.feedFrames) return null;
  const beltHeading = Math.atan2(S.throat[1] - S.gate[1], S.throat[0] - S.gate[0]);
  const beltSlope = Math.atan2(S.throat[2] - S.gate[2], Math.hypot(S.throat[0] - S.gate[0], S.throat[1] - S.gate[1]));
  if (f < TURN.post + 3) return { p: [S.spout[0] - 3 * clamp((f - TURN.post) / 3), S.spout[1], S.spout[2]], heading: Math.atan2(S.gate[1] - S.spout[1], S.gate[0] - S.spout[0]), slope: 0 };
  if (f < TURN.ride) {
    const u = clamp((f - TURN.post - 3) / TURN.postArc);
    const e = Math.sin((u * Math.PI) / 2) ** 2;
    const p = lerp3(S.spout, S.gate, e);
    return { p: [p[0], p[1], p[2] + 4 * S.apex * u * (1 - u)], heading: Math.atan2(S.gate[1] - S.spout[1], S.gate[0] - S.spout[0]), slope: 0.3 * Math.cos(u * Math.PI) };
  }
  if (f < TURN.throat) return { p: lerp3(S.gate, S.throat, (f - TURN.ride) / (TURN.throat - TURN.ride)), heading: beltHeading, slope: beltSlope };
  return { p: lerp3(S.throat, S.head, MOVE((f - TURN.throat) / TURN.feedFrames)), heading: 0, slope: 0 };
}

export interface RegisterTape {
  /** the leader laid so far from the head east (0..1 of the flat run) */
  leader: number;
  /** the row's print: none yet, then its ink spreading over 3 f (0, 1, 2), then printed (3) */
  ink: -1 | 0 | 1 | 2 | 3;
  /** the print head's hammer (0 up .. 1 down on the tape) and the newest cell's light */
  hammer: number;
  cellLit: number;
  /** the reading lamp's pool (light is attention: it comes on when the Register first reads) */
  reading: number;
  jewel: number;
}
export function registerTapeAt(f: number): RegisterTape {
  const ink = f < TURN.print ? -1 : (Math.min(3, f - TURN.print) as 0 | 1 | 2 | 3);
  return {
    leader: transport(span01(f, TURN.leader, TURN.leaderEnd), 0.2),
    ink,
    // the head drops over 4 f onto the tape, holds 2 f while the ink spreads, lifts over 4 f
    hammer: moveOver(f, TURN.headDrop, TURN.print) * (1 - moveOver(f, TURN.print + 2, TURN.print + 6)),
    cellLit: springAt(f, TURN.print + 1, SPRING.effects),
    reading: springAt(f, TURN.throat, SPRING.effects),
    jewel: springAt(f, TURN.jewel, SPRING.effects),
  };
}

// ------------------------------------------------------------------------------------------------
// Labels

export interface LabelReveal {
  /** the hairline leader drawn (0..1, 6 f), then the label wiped in (0..1, 8 f) */
  leader: number;
  wipe: number;
}
const reveal = (f: number, from: number): LabelReveal | null => (f < from ? null : { leader: ENTER(clamp((f - from) / 6)), wipe: clamp((f - from - 6) / 8) });
/** Your act-one label: landed until the camera moves, then it exits over 6 f (its wipe back over 4 f, its leader back into its foot); null once gone. */
const exitAt = (f: number, from: number): LabelReveal | null => (f < from ? { leader: 1, wipe: 1 } : f > from + 6 ? null : { leader: 1 - clamp((f - from - 2) / 4), wipe: 1 - clamp((f - from) / 4) });
export function labelsTurnAt(f: number): { youA: LabelReveal | null; you: LabelReveal | null; router: LabelReveal | null } {
  return { youA: exitAt(f, TURN.youOut), you: reveal(f, TURN.youLabel), router: reveal(f, TURN.routerLabel) };
}

// ------------------------------------------------------------------------------------------------
// The whole state

export interface TurnState {
  f: number;
  act: ActOneState;
  /** each act-one folder pressed into the desk (FOLDERS order), and Fix A's */
  press: Press[];
  pressA: Press;
  you: YouPose;
  loop: LoopTurn;
  fixA: FixATurn;
  fixB: FixBTurn;
  deck: DeckTurn;
  parts: PartsTurn;
  intake: IntakeTurn;
  slip: SlipTurn | null;
  tape: RegisterTape;
  labels: ReturnType<typeof labelsTurnAt>;
  /** the focus step-down of the heap, the feeders and the request (0..1) */
  step: number;
}

export const pressStart = (i: number): number => TURN.press + TURN.pressStagger * i;
/** The focus step-down: in over 16 f before the camera moves, out over 16 f for "hears every channel". */
export function turnStepAt(f: number): number {
  return Math.min(easings.inOutSine(span01(f, TURN.stepIn, TURN.stepIn + TURN.stepFrames)), 1 - easings.inOutSine(span01(f, TURN.stepOut, TURN.stepOut + TURN.stepFrames)));
}

export function turnAt(f: number): TurnState {
  const pressA = pressAt(f, pressStart(0), FIX_A_FOLDER.d, 1.2 + FIX_A_FOLDER.sheets * 0.8 + 4);
  const press = FOLDERS.map((fl, i) => pressAt(f, pressStart(i + 1), fl.d, stackTop(fl) + 34));
  const loop = loopTurnAt(f);
  return {
    f,
    act: heldActOne(f),
    pressA,
    press,
    you: youPoseTurn(f),
    loop,
    fixA: fixATurnAt(f, loop),
    fixB: fixBTurnAt(f, shiftAt),
    deck: deckTurnAt(f),
    parts: partsTurnAt(f),
    intake: intakeTurnAt(f),
    slip: firstSlipAt(f),
    tape: registerTapeAt(f),
    labels: labelsTurnAt(f),
    step: turnStepAt(f),
  };
}

/** The desk state the act-two objects read during the turn: act two's rest (nothing of (b)'s handshake has happened), the intake's focus step. */
export function turnDeskState(f: number): DeskState {
  const step = turnStepAt(f);
  return { ...deskStateAt(f), step: { amount: step, ids: step > 0 ? ['intake'] : [] } };
}

/** Each imprint's depth (beat3.ts IMPRINTS order: F1..F8, Fix A's, then the pressed trays). */
export const imprintsAt = (t: TurnState): number[] => [...t.press.map(imprintOf), imprintOf(t.pressA), ...PRESS_TRAYS.map((k) => imprintOf(t.fixB.press[k]!))];

/** The desk's open hatches during the turn (world rects; one per bay while its floor slides away and its leaves shut). */
export function turnHoles(t: TurnState): Rect[] {
  return t.fixB.bays.filter((b) => b.hole).map((b) => BAYS[b.id].box);
}

// ------------------------------------------------------------------------------------------------
// Light: the frame's footprints and pools

/** A pressed body's footprint: its outline at its squashed height (nothing once it is under the slate). */
function pressedFp(c: P2, w: number, d: number, rot: number, top: number, p: Press): Footprint[] {
  if (p.k >= 1) return [];
  const z1 = top * p.scaleZ - p.sink;
  if (z1 <= 0.4) return [];
  return [{ kind: 'rect', c, h: [w / 2, d / 2], r: 3, rot, z0: 0, z1, contact: 0.8 }];
}


export function turnFootprints(t: TurnState): Footprint[] {
  const fp: Footprint[] = [...youFootprints(t.you)];
  const a = t.act;
  // the folders, pressed flat and sinking (their pens and flags with them)
  FOLDERS.forEach((fl, i) => {
    if (a.folders[i].present <= 0) return;
    fp.push(...pressedFp(fl.c, fl.w, fl.d, fl.rot, stackTop(fl), t.press[i]));
  });
  fp.push(...pressedFp(FIX_A_FOLDER.c, FIX_A_FOLDER.w, FIX_A_FOLDER.d, FIX_A_FOLDER.rot, 1.2 + FIX_A_FOLDER.sheets * 0.8, t.pressA));
  // the feeders
  fp.push(circleFp(rectC(FEEDERS.chat), (FEEDERS.chat.y1 - FEEDERS.chat.y0) / 2, 0, FEEDER_H.chat, 1));
  fp.push(...ciHopperFootprints());
  fp.push(...pressedFp(rectC(FEEDERS.mail), FEEDERS.mail.x1 - FEEDERS.mail.x0, FEEDERS.mail.y1 - FEEDERS.mail.y0, 0, 30, t.intake.mail));
  fp.push(...pressedFp(rectC(FEEDERS.calendar), FEEDERS.calendar.x1 - FEEDERS.calendar.x0, FEEDERS.calendar.y1 - FEEDERS.calendar.y0, 0, 18, t.intake.calendar));
  if (t.intake.spool !== null) fp.push(circleFp([SPOOL.x, SPOOL.y + t.intake.spool], SPOOL.r, 0, SPOOL.z[1], 1));
  if (t.intake.belt !== null) {
    const e = t.intake.belt;
    const end = beltEnd(e);
    fp.push(segFp(BELT.to, end, BELT.w / 2));
    const lift = end[2] - BELT.from[2];
    const gx = end[0] - BELT.from[0];
    const gy = end[1] - BELT.from[1];
    fp.push(rectFp({ x0: GATE.bar.x0 + gx, x1: GATE.bar.x1 + gx, y0: GATE.bar.y0 + gy, y1: GATE.bar.y1 + gy }, lift, GATE.h + lift, lift < 1 ? 1 : 0, 3));
  }
  // the heap's footprint is act one's (the request with it)
  // the loop or the coil
  const lt = t.loop;
  if (lt.ribbon) {
    const { L, edge } = lt.ribbon;
    for (let i = 0; i < 16; i++) {
      const p = loopAt(L, (i / 16) * Math.PI * 2);
      const q = loopAt(L, ((i + 1) / 16) * Math.PI * 2);
      fp.push(segFp([p[0], p[1], L.z + edge * A_TAPE_W], [q[0], q[1], L.z + edge * A_TAPE_W], 10 + 2 * (1 - edge)));
    }
  }
  // the coil until it locks (then it is the Register's reel, whose footprint the Register's are)
  if (lt.coil && t.f < TURN.lock) fp.push(circleFp(lt.coil.c, lt.coil.rOut + 4, lt.coil.h, lt.coil.h + lt.coil.t, 0.6));
  // Fix A: the tape (a thin line of shadow), the items on the desk, the span
  const A = t.fixA;
  if (A.deskLen > 0) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const p = aPathAt((A.deskLen * i) / n).p;
      const q = aPathAt((A.deskLen * (i + 1)) / n).p;
      fp.push(segFp([p[0], p[1], 0.4], [q[0], q[1], 0.4], A_TAPE_W / 2 - 2));
    }
  }
  if (A.spanLen > 0) fp.push(segFp(A.span.b, lerp3(A.span.b, A.span.a, A.spanLen / A.span.len), A_TAPE_W / 2 - 2));
  A.items.forEach((it, i) => {
    if (!it || i > 14) return;
    const [l, w] = [A_ITEMS[i].l, A_ITEMS[i].w];
    fp.push({ kind: 'rect', c: [it.p[0], it.p[1]], h: [l / 2, w / 2], r: 2, rot: Math.atan2(it.x[1], it.x[0]), z0: it.p[2] - 0.4, z1: it.p[2] + 0.4, contact: it.p[2] < 3 ? 0.4 : 0 });
  });
  // Fix B: the trays (pressed, or growing into bays), the replies, the bays' work rising
  TRAYS.forEach((tr, k) => {
    const p = t.fixB.press[k];
    if (p) fp.push(...pressedFp(tr.c, tr.w, tr.d, 0, TRAY_Z.rim, p));
  });
  t.fixB.bays.forEach((b, i) => {
    // closed: act two's shell (objects/Bay.tsx draws it from here); walling up: the growing walls and door; the pit while the floor goes
    if (b.done) {
      fp.push(...bayShellFootprints(BAYS[b.id]));
      return;
    }
    const k = BAY_TRAYS[i].k;
    const s = bayShapeAt(k, BAYS[b.id], b.grow);
    const h = TRAY_Z.rim + (s.wallH - TRAY_Z.rim) * Math.min(1, b.grow * 1.4);
    for (const w of shapeWalls(s)) fp.push(rectFp(w, 0, h, 1, 2));
    if (b.grow > 0) fp.push(rectFp(bayDoor(BAYS[b.id]), 0, (BAYS[b.id].wallH - 6) * b.grow, 1, 2));
    if (b.hole) fp.push(...pitFootprints(BAYS[b.id].box));
  });
  t.fixB.slips.forEach((s, k) => {
    const p = t.fixB.press[k];
    if (p && p.k > 0) return;
    if (!p && t.fixB.bays.find((b, i) => BAY_TRAYS[i].k === k && b.drop > 0)) return;
    fp.push({ kind: 'rect', c: [s.p[0], s.p[1]], h: [B_SLIP.l / 2, B_SLIP.w / 2], r: 2, rot: s.rot, z0: s.p[2] - 0.4, z1: s.p[2] + 0.4, contact: s.p[2] < YOU.top + 8 ? 0.4 : 0 });
  });
  // the Register: present once it rolls into the frame, posed with the deck; its legs as they telescope
  if (t.f >= TURN.deckIn) {
    const d = t.deck;
    for (const l of legsAt(d)) {
      fp.push(segFp(l.top, l.foot, LEG_R));
      fp.push(circleFp([l.foot[0], l.foot[1]], 14, 0, 4, 1));
    }
    const reg = [...registerFootprints({ legs: false, fanfold: false }), rectFp(DISPATCH_HOUSING.box, DISPATCH_HOUSING.z[0], DISPATCH_HOUSING.z[1], 0, 3)];
    for (const r of reg) {
      if (r.kind === 'rect' || r.kind === 'circle') fp.push({ ...r, c: [r.c[0], r.c[1] + d.dy], z0: Math.max(0, r.z0 + d.dz), z1: Math.max(0.5, r.z1 + d.dz) });
      else if (r.kind === 'seg') fp.push({ ...r, a: [r.a[0], r.a[1] + d.dy], b: [r.b[0], r.b[1] + d.dy], ha: Math.max(0, r.ha + d.dz), hb: Math.max(0, r.hb + d.dz) });
      else {
        // the deck's shade: carried down the key by its shadow's offset at the deck's height now, so it spreads as the legs lift it
        const [ox, oy] = shadowOffset(DECK.top + d.dz);
        const [ox1, oy1] = shadowOffset(DECK.top);
        fp.push({ ...r, c: [r.c[0] - ox1 + ox, r.c[1] - oy1 + oy + d.dy], z: r.z + d.dz });
      }
    }
    // its log rides in with it: the fanfold on the slate under it
    fp.push(rectFp({ ...FANFOLD.box, y0: FANFOLD.box.y0 + d.dy, y1: FANFOLD.box.y1 + d.dy }, 0, FANFOLD.sheets * SHEET + 2, 1, 2));
    // the print head's hammer, raised over the tape, as act two casts it
    const [hx, , hz] = hammerOffset(0);
    fp.push(rectFp({ x0: PRINT_HEAD.box.x1 - 4 + hx, x1: PRINT_HEAD.box.x1 + 10 + hx, y0: TAPE.y0 + 6 + d.dy, y1: TAPE.y1 - 6 + d.dy }, Math.max(0, TAPE.z + 3 + hz + d.dz), Math.max(0.5, TAPE.z + 16 + hz + d.dz), 0, 1));
  }
  // the chute as far as it has extended
  if (t.parts.chute > 0) {
    const pts = chutePath(t.parts.chute);
    for (let i = 1; i < pts.length; i++) fp.push(segFp(pts[i - 1], pts[i], 12));
  }
  // its posts as they telescope down to the desk
  if (t.parts.posts > 0) for (const [x, y] of CHUTE_POSTS) fp.push(circleFp([x, y], 6, 90 * (1 - t.parts.posts), 90, t.parts.posts > 0.99 ? 1 : 0));
  if (t.slip) fp.push({ kind: 'rect', c: [t.slip.p[0], t.slip.p[1]], h: [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2], r: 2, rot: t.slip.heading, z0: t.slip.p[2] - 0.4, z1: t.slip.p[2] + 0.4, contact: 0 });
  // the request rising out of the old heap (desk/beat4.ts), as act two casts it
  const r = requestAt(t.f).pose;
  if (r && t.f >= B4.requestRise) fp.push({ kind: 'rect', c: [r.p[0], r.p[1]], h: [REQUEST.l / 2, REQUEST.w / 2], r: 2, rot: r.heading, z0: r.p[2] - 0.4, z1: r.p[2] + 0.6, contact: r.p[2] < 3 ? 0.4 : 0 });
  return fp.slice(0, 128);
}

/** The chute's centreline from the deck's corner as far as it has extended (0..1 of its length). */
export function chutePath(k: number): P3[] {
  const lens: number[] = [0];
  for (let i = 1; i < CHUTE.length; i++) lens.push(lens[i - 1] + Math.hypot(CHUTE[i][0] - CHUTE[i - 1][0], CHUTE[i][1] - CHUTE[i - 1][1], CHUTE[i][2] - CHUTE[i - 1][2]));
  const L = lens[lens.length - 1] * clamp(k);
  const out: P3[] = [CHUTE[0]];
  for (let i = 1; i < CHUTE.length; i++) {
    if (lens[i] <= L) out.push(CHUTE[i]);
    else {
      const u = (L - lens[i - 1]) / (lens[i] - lens[i - 1]);
      if (u > 1e-3) out.push(lerp3(CHUTE[i - 1], CHUTE[i], u));
      break;
    }
  }
  return out;
}

/** A point of a loop pose (as actOne.ts loopPoint). */
function loopAt(L: LoopPose, t: number): P2 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const e = 2 / L.n;
  return [L.c[0] + L.a * Math.sign(c) * Math.abs(c) ** e, L.c[1] + L.b * Math.sign(s) * Math.abs(s) ** e];
}

/** The pools: your lamp's (from the folder it attended to your in-tray, narrowing and dimming), the Register's reading lamp and its newest cell once it reads. */
export function turnPools(t: TurnState): Pool[] {
  const m = slideAt(t.f);
  const dim = lampDimAt(t.f);
  // act one's pool on the folder it attends (as act one draws it), moving to your in-tray with the desk, dimming once F3 is pressed
  const P = actOnePools(t.act)[0];
  const mix = (a: number, b: number) => a + (b - a) * m;
  const mixD = (a: number, b: number) => a + (b - a) * dim;
  const yourA = P.rgb;
  // once the loop is handed over: a step dimmer on your in-tray, waiting for a reply (act two's pool, pools.ts)
  const yourB = tint(LIGHT_HEX.yours, 3.6 * LAMP_STEPS.dim);
  const cellY = (TAPE.y0 + TAPE.y1) / 2;
  const newest = (CELLS_X[0][0] + CELLS_X[0][1]) / 2;
  return [
    { c: [mix(P.c[0], LAMP_AIM[0]), mix(P.c[1], LAMP_AIM[1])], z: [0, mix(60, 140)], sigma: [mix(P.sigma[0], 74), mix(P.sigma[1], 66)], rgb: [mixD(yourA[0], yourB[0]), mixD(yourA[1], yourB[1]), mixD(yourA[2], yourB[2])] },
    { c: [newest + 70, cellY], z: [118, 170], sigma: [130, 40], rgb: tint(LIGHT_HEX.reading, 2.4 * t.tape.reading) },
    // the newest cell lights as each row inks, as act two's (beat4.ts cellLitAt, pools.ts)
    { c: [newest, cellY], z: [118, 140], sigma: [40, 30], rgb: tint(LIGHT_HEX.reading, 1.05 * cellLitAt(t.f)) },
  ];
}
