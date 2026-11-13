/**
 * The turn (MT2, film f1400–1660; STORYBOARD 3.3–4.2, synthesis §5 MT2): the routing job lifts off
 * your desk and becomes the Register. It takes act one's world over at f1400 exactly as act one and beat 3
 * left it at f1399 (ActOneFrame: the intake held stepped down, Fix A's queue on its tape, Fix B's eight
 * replies in your in-tray) and hands act two its world at f1661 (the bays closed under their lids, the reel
 * locked, the request riding the belt). One object becomes another by physical means only, one idea at a
 * time (at most two or three motions overlap):
 * 1. 1400–1440: Fix A's queue moves its last station; everything stills (pens lifted) before the hit.
 * 2. 1440–1453: from the hit the eight folders and Fix A's are pressed into the desk, each as one body with
 *    its pen, flag and pile, the press running along the arc from Fix A's to F8 (2 f from first to last):
 *    a 3 f squash spreading flat (their shadows pull in), the imprint's rim, the draw-in, then the slate's
 *    tone and a sink to −2 as they go under (13 f each); the notes loop dips and lifts.
 * 3. 1452–1530: the loop turns on edge (its outer edge up), rounds, its tabs fold in over its rim and it
 *    coils into a pack; the hub telescopes out of its centre. Fix A's tape end lifts off the desk at its
 *    folder's old mouth and is caught by the rising loop; the coil winds the whole tape in, grey stock
 *    turning to paper as it leaves the desk, and Fix A's chutes slide back into their feeders as the tape's
 *    tail passes them. The clip and the tabs ride the outer turn.
 * 4. 1468–1594: Fix B's replies leave your in-tray for their trays as one flock; five trays are posted
 *    back out beyond the east edge the way they came in (lifted over the trays that stay); one at a time,
 *    three wall up into the bays of (b) (the bug bench, the docs galley, the test tower: the last slides
 *    west along the clear south row first): their grey-stock rims grow into the bays' walls, the floor
 *    becomes the bay's graphite lid, which drops open like a trapdoor (what lay in the tray falls into the
 *    pit) and swings shut: the bay stands closed and idle (no work, no light, its nameplate blank) until it
 *    is dispatched in beat 4 (desk/beat4.ts).
 * 5. 1530–1612: your desk slides south-west and the lamp narrows (after the tape has left its path); the
 *    deck rolls in collapsed from the north with its log (the fanfold on the slate under it, the filed
 *    tabs in its drawer), its legs telescope up (C9's "Above"), its shade spreading as it rises, and its
 *    parts unfold (throat, head, index arm, loupe, ramp).
 * 6. 1560–1616: the reel glides over the deck, descends and locks; the pilot jewel lights (1618).
 * 7. 1592–1627: the belt runs out of the throat carrying its gate; the first chat slip rides it into the
 *    throat (1620), the head drops and its row prints with a 3 f ink spread (1624).
 * 8. 1626–1660: every channel into one intake (the spool slides in, mail and calendar press flat into
 *    vellum drawings), the reply chute extends to your in-tray, the Continuous plate turns over on its
 *    cue (1640): the loop's hand-over is complete and your lamp dims one step (to act two's level).
 * At most three of these motions run at once (turn.test.ts). Your lamp stays on, attending, while the loop
 * rises; the request starts out of the old heap from beat4.ts REQUEST_FROM (1645), the first thing the
 * hand-off to act two carries over (desk/film.ts).
 *
 * Every value is a pure function of the film frame (springs on the synthesis's tokens, the film's move
 * curve). The schedule's order is tested (turn.test.ts): nothing acts before its cause, nothing appears
 * in one frame.
 */
import { clamp, easings } from '@aiv/core';
import { Easing, spring } from 'remotion';
import { FPS, cue } from '../cues.ts';
import { ACT_ONE_END, BULB_A, FOLDERS, LOOP_A, YOU_C_A, YOU_SHIFT_A, actOneAt, actOnePools, feederFootprints, folderFootprints, heapFootprints, youPoseA, type ActOneState, type LoopPose } from './actOne.ts';
import { A_CHUTES, A_FOLDER_IN, A_PITCH, A_QUEUE, A_STACK_END, A_TAPE, A_TAPE_W, BAY_TRAYS, FIX_A_FOLDER, IN_TRAY_A_C, IN_TRAY_PILE, RETIRE_TRAYS, TRAYS, TRAY_STUFF, TRAY_Z, aPathAt, fixAFootprints, replySlipFootprint, trayRestB, type FixAView } from './beat3.ts';
import { bayShellFootprints, circleFp, heapFootprintsAt, pitFootprints, rectFp, registerFootprints, segFp, youFootprints, type Footprint } from './footprints.ts';
import { BAYS, BELT, CELLS_X, CHUTE, CHUTE_POSTS, DECK, DISPATCH_HOUSING, FANFOLD, FEEDERS, GATE, LAMP, LEG_R, LEG_STRUTS, NEXT_SLIP, PRINT_HEAD, REEL, REQUEST, SHEET, SPOOL, TAPE, YOU, shadowOffset, type BayId, type BayLayout, type P2, type P3, type Pool, type Rect } from './layout.ts';
import { REEL_LOCK, REQUEST_FROM, cellLitAt, heapAt, requestAt } from './beat4.ts';
import { EMIT, LIGHT_HEX, linearOf, tint } from './pools.ts';
import { LAMP_AIM, LAMP_STEPS, REPLY_PATH, SPRING, deskStateAt, hammerOffset, polylineAt, replyRun, springAt, type DeskState } from './state.ts';
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
  /** 3.3: Fix A's queue moves its last station on the beat (the cue sheet's last FIX_A step) */
  advance: 1400,
  advanceFrames: 10,
  /** everything stills, pens lifted (4 f): stillness before the hit */
  still: 1420,
  hit: cue('turn').frame,
  /** the intake (the heap, the feeders, the request) comes back from act one's step-down for "hears every channel" */
  stepOut: 1592,
  stepFrames: 16,
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
  /**
   * the folders, act one's eight and Fix A's, pressed into the desk from the hit, the press running along the arc
   * (PRESS_DELAY, 0–2 f; the first body moves on the hit itself): each a squash spreading flat, its imprint's rim, the
   * draw-in, then the slate's tone and the sink (PRESS_PHASE), gone under the slate on its own frame pressFrames; all gone
   * by press + pressGone (the L1-05 P1: the nine had faded into the slate together in about 4 f)
   */
  press: 1440,
  pressFrames: 13,
  pressGone: 14,
  /** Fix A's tape end lifts off the desk at its folder's old mouth and is caught by the rising loop (the camera curve, a small arc) */
  catch: 1456,
  catchFrames: 16,
  /** then the coil winds all of the tape in (its desk run leaves the desk before your desk slides over its path) */
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
  /** Fix B: the replies leave your in-tray as a flock (1.5 f apart; 3 f anticipation, a 14 f arc), the retiring trays' first */
  replies: 1468,
  replyStagger: 1.5,
  replyArc: 14,
  /** a retiring tray is posted back out 2 f after its reply is home: 3 f anticipation (a 4 u lift), then up and away east, gathering speed */
  retireAfter: 2,
  retireAntic: 3,
  retireFrames: 18,
  /** the bays wall up one at a time (bayTimes): the bug bench in tray 5's place, the docs galley in tray 3's once your desk has left its box, the test tower once tray 6 has slid west to it */
  bayGap: 16,
  growFrames: 14,
  testsSlide: 1544,
  testsSlideFrames: 18,
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
/**
 * The collapsed deck: everything on it this far down, and this far north while it rolls in: far enough that on the roll's
 * first frames (the camera curve gathers speed slowly) all of it, its mouth and feet and the shade it casts down the key,
 * is beyond the frame's top edge, so it comes into view already rolling (turn.test.ts), never whole in one frame.
 */
export const DECK_LOW = 80;
export const DECK_NORTH = 800;
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
  /** its height: the loop's ribbon on edge (LOOP_A.w) as it takes over, settling to the pack's (PACK_H) as it coils */
  t: number;
  /** how far it has coiled (0 the ribbon's take-over … 1 the pack) */
  k: number;
  /** turned so far (radians, counter-clockwise from above) */
  spin: number;
  /** the hub telescoped up out of the coil's centre (0..1), then the spokes out from it (0..1) */
  hub: number;
  spokes: number;
  /**
   * The loop's own outer turn (printed with your notes, as the ribbon was) stays the coil's outside until Fix A's tape has
   * wound over it: `wrap` is how far round it the new tape lies (radians, 0 … 2π, from TURN.wind as the coil turns), ending
   * at `wrapLead` (the coil's own frame: the angle in the spun group where the tape's first wound end rides).
   */
  wrap: number;
  wrapLead: number;
  /** the outermost turn's radius: the loop's own (COIL_R0) until Fix A's tape lies round it, then the wound pack's (rOut) */
  rim: number;
  /** the wound pack's colour from the tape's paper to the reel's (0..1), once the loop's turn is wholly under it */
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

/**
 * Fix A's tape in material units (u along the tape, from beat 3's notional lead: beat3.ts A_TAPE at f1399, where the
 * tape's place d on its path has u = d - A_TAPE.lead). Beat 3 leaves it running from inside the folder's mouth back to
 * its tail by the chat spout; the turn's advance moves it one station further into the folder; once the folder is
 * pressed, the tape's end lies on the desk at the folder's old mouth (A_FOLDER_IN), where it lifts off.
 */
const A_TAIL_U = A_TAPE.tail - A_TAPE.lead;
const A_ADV_LEAD = A_TAPE.lead - A_PITCH;
/** The material at the mouth once the advance is done, and the tape that is left from there to its tail (all of it is wound in). */
export const A_MOUTH_U = A_FOLDER_IN - A_ADV_LEAD;
export const A_TAPE_LEN = A_TAIL_U - A_MOUTH_U;
/** A trapezoid-velocity ease (constant-speed transport with short ramps), 0..1. */
function transport(t: number, ramp = 0.14): number {
  const x = clamp(t);
  const v = 1 / (1 - ramp);
  if (x < ramp) return (v * x * x) / (2 * ramp);
  if (x > 1 - ramp) return 1 - (v * (1 - x) * (1 - x)) / (2 * ramp);
  return v * (x - ramp / 2);
}
/** The queue's last station (beat 3's advance, one more): how far it has moved toward the folder (u). */
const advanceAt = (f: number): number => A_PITCH * MOVE(span01(f, TURN.advance, TURN.advance + TURN.advanceFrames));
/** The tape wound onto the coil so far (u, of A_TAPE_LEN). */
export function woundAt(f: number): number {
  return A_TAPE_LEN * transport(span01(f, TURN.wind, TURN.windEnd));
}

function liftAt(f: number): number {
  return LIFT_H * springOver(f, TURN.rise, TURN.riseEnd - TURN.rise, SPRING.heavy);
}

/** The coil's centre: from the loop's centre straight over the deck to the reel (high enough to pass over the reading lamp). */
function glideAt(f: number): P2 {
  const e = moveOver(f, TURN.glide, TURN.glideEnd);
  return [YOU_C_A[0] + (REEL.x - YOU_C_A[0]) * e, YOU_C_A[1] + (REEL.y - YOU_C_A[1]) * e];
}

export const PACK_H = REEL.packZ[1] - REEL.packZ[0];
/**
 * The coil's last turn: six turns while Fix A winds on, ending where beat 4's detents bring the reel to the Register's
 * own rest angle by MT1 (beat4.ts REEL_LOCK), so stills (b) to (d) keep their reel.
 */
export const SPIN_TOTAL = 6 * Math.PI + REEL_LOCK;
/** The turn: carried round while it winds, the last 0.26 rad on spring-detent at the lock. */
const spinAt = (f: number): number => (SPIN_TOTAL + 0.26) * transport(span01(f, TURN.coil, TURN.windEnd)) - 0.26 * springAt(f, TURN.detent, SPRING.detent);
/** How far the coil has turned when Fix A's tape starts to wind on (its first wound end rides round from there). */
const SPIN_WIND = spinAt(TURN.wind);
/** The wound pack takes the reel's paper over this many frames once the loop's printed turn is wholly under Fix A's tape (WRAP_FULL). */
export const STOCK_FRAMES = 16;
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
  const windK = clamp(woundAt(f) / A_TAPE_LEN);
  const rOut = Math.sqrt(COIL_R0 * COIL_R0 + (REEL.packR * REEL.packR - COIL_R0 * COIL_R0) * windK);
  const spin = spinAt(f);
  const wrap = f < TURN.wind ? 0 : Math.min(Math.max(spin - SPIN_WIND, 0), 2 * Math.PI);
  const coil: CoilState | null =
    f < TURN.coil
      ? null
      : {
          c,
          h,
          // from the ribbon's own radius (the coil's top comes in from nothing at the take-over), in to the hub
          rIn: COIL_R0 - (COIL_R0 - REEL.hubR) * coilK,
          rOut: rOut + 0.75 * (1 - windK),
          // the ribbon's own height as it coils (no jump at TURN.coil: the turn's code review, MAJOR 6), to the pack's
          t: LOOP_A.w + (PACK_H - LOOP_A.w) * coilK,
          k: coilK,
          spin: f >= TURN.lock + 8 ? SPIN_TOTAL : spin,
          hub: moveOver(f, TURN.hub, TURN.hub + TURN.hubFrames),
          spokes: moveOver(f, TURN.hub + TURN.hubFrames - 2, TURN.hub + TURN.hubFrames + 10),
          wrap,
          wrapLead: WRAP_LEAD,
          rim: COIL_R0 + (rOut + 0.75 * (1 - windK) - COIL_R0) * (wrap / (2 * Math.PI)),
          stock: easings.inOutSine(span01(f, WRAP_FULL, WRAP_FULL + STOCK_FRAMES)),
        };
  return { ribbon: f < TURN.coil ? { L, h, edge, fold } : null, coil, edge: Math.min(edge, 1), fold };
}

/** The coil's outer turn as a loop pose (a circle at its outermost turn's radius), for the clip and tabs that ride it. */
export const coilRim = (C: CoilState): LoopPose => ({ ...LOOP_A, c: C.c, a: C.rim, b: C.rim, n: 2, z: C.h, w: C.t });

// ------------------------------------------------------------------------------------------------
// Fix A's tape: as beat 3 left it on the desk; then its end lifts off at the folder's old mouth and is caught by the
// loop, a free span up to the loop or coil, the rest of the tape on the desk behind it, until the coil has wound it in

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
  /** the tape's material place where it meets the loop or coil (u: the print rides it) */
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

/** Where the tape lifts off: on its path at the folder's old mouth, on the tape's face. */
const A_MOUTH: P3 = [aPathAt(A_FOLDER_IN).p[0], aPathAt(A_FOLDER_IN).p[1], aPathAt(A_FOLDER_IN).z - 0.1];
/**
 * Fix A's tape meets the coil on its outer turn facing the mouth (attachAt); the end it lays there at TURN.wind rides round
 * with the coil, so in the coil's spun frame it stays at this angle, and the tape wound behind it covers the loop's
 * printed turn from there back to where it meets the coil now.
 */
const WRAP_LEAD = (() => {
  const c = glideAt(TURN.wind);
  return Math.atan2(A_MOUTH[1] - c[1], A_MOUTH[0] - c[0]) - SPIN_WIND;
})();
/** The first frame the loop's printed turn lies wholly under Fix A's tape (the coil has turned once since TURN.wind). */
export const WRAP_FULL = (() => {
  for (let f = TURN.wind; f <= TURN.windEnd; f++) if (spinAt(f) - SPIN_WIND >= 2 * Math.PI) return f;
  throw new Error('turn: the coil never turns once while Fix A winds on');
})();

/**
 * The radius of the turn Fix A's tape is wound onto: while it winds (TURN.wind to WRAP_FULL) the partial wrap stands at
 * the wrap's own radius (the outer turn's, a tape's thickness proud of the loop's printed turn under it), which lags rOut
 * (the coil's top ring and the riders stand on it too); once round, rOut. objects/Turn.tsx Coil draws the partial wrap at
 * it, and attachAt lands the tape's span end on it.
 */
export const wrapRadius = (c: { wrap: number; rim: number; rOut: number }): number => (c.wrap > 0 && c.wrap < 2 * Math.PI ? Math.max(c.rim, COIL_R0 + 0.6) : c.rOut);

/** Where Fix A's tape meets the loop or the coil: on the ribbon's centreline facing the mouth, or tangent to the coil's outer turn. */
function attachAt(lt: LoopTurn): { p: P3; w: P3 } {
  if (lt.ribbon) {
    const { L, edge } = lt.ribbon;
    const t = Math.atan2((A_MOUTH[1] - L.c[1]) / L.b, (A_MOUTH[0] - L.c[0]) / L.a);
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
  const d = norm([A_MOUTH[0] - C.c[0], A_MOUTH[1] - C.c[1], 0]);
  // at the take-over where the ribbon held it (its underside with the loop's, as above), centred on the pack as it coils
  const lift = (A_TAPE_W / 2 - 0.6 - LOOP_A.w / 2) * (1 - C.k);
  // on the turn it is wound onto (wrapRadius: the partial wrap's radius while it winds, rOut once round)
  const r = wrapRadius(C);
  return { p: [C.c[0] + d[0] * r, C.c[1] + d[1] * r, C.h + C.t / 2 + lift], w: [0, 0, 1] };
}

/** An item lying on the tape at path distance d (as beat3.ts places it: its nose toward the folder). */
function onTape(d: number): { p: P3; x: P3; y: P3 } {
  const { p, z, dir3 } = aPathAt(d);
  const x: P3 = [-dir3[0], -dir3[1], -dir3[2]];
  const pl = Math.hypot(dir3[0], dir3[1]) || 1;
  return { p: [p[0], p[1], z + 0.7], x, y: [dir3[1] / pl, -dir3[0] / pl, 0] };
}
/** The queue's places as beat 3 leaves them (A_ITEMS order: A_QUEUE without what the folder swallowed), their material place on the tape. */
const A_ITEM_U: readonly number[] = A_QUEUE.filter((q) => !q.swallow).map((q) => q.d - A_TAPE.lead);
const A_ITEM_L: readonly number[] = A_QUEUE.filter((q) => !q.swallow).map((q) => q.l);

/** The free span from the lift-off up to the loop or coil once the end is caught (its far end, width directions, length), from TURN.catch on. */
function spanAt(f: number, lt: LoopTurn): { b: P3; wa: P3; wb: P3; len: number; along: P3; flying: boolean } {
  // the end lifts off and flies up to the loop (the camera curve, a small arc), the tape peeling up behind it; then it
  // rides the loop up and round and the coil winds it in
  const at = attachAt(lt);
  const e = CAMERA(span01(f, TURN.catch, TURN.catch + TURN.catchFrames));
  const flying = e < 1;
  const l = lerp3(A_MOUTH, at.p, e);
  const b: P3 = flying ? [l[0], l[1], l[2] + 36 * Math.sin(Math.PI * e)] : at.p;
  const along = sub(b, A_MOUTH);
  const len = Math.hypot(along[0], along[1], along[2]);
  // the desk-end width: flat, across the tape's heading off the desk
  const hd = norm([along[0], along[1], 0]);
  const wa: P3 = [-hd[1], hd[0], 0];
  const w = flying ? norm(lerp3(wa, at.w[0] * wa[0] + at.w[1] * wa[1] < 0 ? [-at.w[0], -at.w[1], at.w[2]] : at.w, e)) : at.w;
  const wb: P3 = w[2] > 0.99 ? w : w[0] * wa[0] + w[1] * wa[1] < 0 ? [-w[0], -w[1], w[2]] : w;
  return { b, wa, wb, len, along, flying };
}

/**
 * Where Fix A's tape's tail lies on its path at f (path distance): beat 3's, one station further in, until the catch; then
 * the end of the tape still on the desk behind the span (fixATurnAt's tape.d1), at the mouth once it has all left the desk.
 */
export function aTailAt(f: number): number {
  if (f < TURN.catch) return A_TAPE.tail - advanceAt(f);
  const left = A_TAPE_LEN - woundAt(f);
  return A_FOLDER_IN + Math.max(0, left - spanAt(f, loopTurnAt(f)).len);
}
/** How far past a chute's junction the tail must be before that chute goes home (u: the tail is clear of its mouth). */
export const CHUTE_CLEAR = 24;
/** Each chute slides back into its feeder (4 f, as it slid out) as the tape's tail passes it: from the frame the tail is clear of its junction. */
export const CHUTE_IN: readonly number[] = A_CHUTES.map((c) => {
  for (let f = TURN.advance; f <= TURN.windEnd; f++) if (aTailAt(f) < c.d - CHUTE_CLEAR) return f;
  return TURN.windEnd;
});

/** The frame each queued item first leaves the desk (on the span, or wound straight in): it turns from grey stock to paper over PAPER_FRAMES from then. */
const PAPER_FRAMES = 6;
const A_ITEM_LIFT: readonly number[] = A_ITEM_U.map((u) => {
  for (let f = TURN.catch; f <= TURN.windEnd; f++) {
    const S = spanAt(f, loopTurnAt(f));
    const left = A_TAPE_LEN - woundAt(f);
    if (u - (A_TAIL_U - left) <= clamp(left, 0, S.len) && S.len > 0) return f;
  }
  return TURN.windEnd;
});
const paperAt = (f: number, i: number): number => easings.inOutSine(span01(f, A_ITEM_LIFT[i], A_ITEM_LIFT[i] + PAPER_FRAMES));

export function fixATurnAt(f: number, lt: LoopTurn): FixAView {
  const adv = advanceAt(f);
  const chutes = A_CHUTES.map((_, k) => 1 - MOVE(span01(f, CHUTE_IN[k], CHUTE_IN[k] + 4)));
  const none: TapeSpan = { a: A_MOUTH, b: A_MOUTH, wa: [0, 1, 0], wb: [0, 1, 0], len: 0 };
  const base = { stackTop: A_STACK_END, folderDy: 0, chutes };
  if (f < TURN.catch) {
    // beat 3's tape, one station further in: drawn from inside the folder's mouth (from the mouth once the folder is
    // pressed: what lay under its cover is never seen) back to its tail
    const lead = A_ADV_LEAD + (A_PITCH - adv);
    const d0 = Math.max(lead, pressT(f, PRESS_DELAY[FOLDERS.length]) <= 0 ? A_FOLDER_IN - 14 : A_FOLDER_IN);
    const d1 = A_TAPE.tail - (A_TAPE.lead - lead);
    const items = A_ITEM_U.map((u) => ({ ...onTape(u + lead), paper: 0 }));
    return { ...base, wound: A_MOUTH_U, span: none, deskLen: d1 - d0, spanLen: 0, items, tape: { d0, d1, u0: d0 - lead } };
  }
  const { b, wa, wb, len, along, flying } = spanAt(f, lt);
  const span: TapeSpan = { a: A_MOUTH, b, wa, wb, len };
  const left = A_TAPE_LEN - woundAt(f);
  const spanLen = clamp(left, 0, len);
  const deskLen = Math.max(0, left - len);
  const uB = A_TAIL_U - left;
  const into = norm([along[0], along[1], 0]);
  const items = A_ITEM_U.map((u, i) => {
    const s = u - uB;
    // wound in: it threads on into the pack, level, under its top and inside its outer turn, until it is wholly in
    if (s < 0) {
      if (s < -A_ITEM_L[i] || flying) return null;
      return { p: [b[0] - into[0] * s, b[1] - into[1] * s, b[2]] as P3, x: into, y: wb, paper: paperAt(f, i) };
    }
    // off the desk it turns from grey stock to paper over a few frames from the frame it left the desk (never in one)
    if (s <= spanLen && len > 0) {
      const p = lerp3(b, A_MOUTH, s / len);
      return { p: [p[0], p[1], p[2] + 0.7] as P3, x: norm(along), y: norm(lerp3(wb, wa, s / len)), paper: paperAt(f, i) };
    }
    return { ...onTape(A_FOLDER_IN + (s - spanLen)), paper: 0 };
  });
  return { ...base, wound: uB, span, deskLen, spanLen, items, tape: deskLen > 0.5 ? { d0: A_FOLDER_IN, d1: A_FOLDER_IN + deskLen, u0: A_TAIL_U - deskLen } : undefined };
}

// ------------------------------------------------------------------------------------------------
/// Pressing: the folders pressed into the desk on the hit; the generic feeders (mail, calendar) pressed flat into vellum

/**
 * A body being pressed into the desk: its height scale, its tilt (radians, north edge down) and how far it has sunk; a
 * folder's also how far it has drawn in from its outline (u: its imprint's embossed edge shows round it) and how far it
 * has taken the slate's tone (0..1: by amount, its own paper and, on the kit's late set, its pen, flag and clip).
 */
export interface Press {
  k: number;
  scaleZ: number;
  tilt: number;
  sink: number;
  inset?: number;
  slate?: number;
  /** the slate's tone as lit where the body goes under (linear RGB, turn.ts slateToneAt): what its paper's tone goes to */
  tone?: P3;
}
/** The feeders' press at a frame for a body `depth` u deep and `top` u tall (squash 0–0.7, tilt, sink 0.7–1). */
export function pressAt(f: number, start: number, depth: number, top: number, frames: number = TURN.flattenFrames): Press {
  const k = span01(f, start, start + frames);
  const sq = easings.inOutSine(clamp(k / 0.7));
  const scaleZ = 1 - 0.94 * sq;
  const tilt = 0.06 * clamp((k - 0.6) / 0.1);
  // sunk until even its south edge's top is under the slate
  const sink = (top * 0.06 + (depth / 2) * Math.sin(0.06) + 0.8) * clamp((k - 0.7) / 0.3) ** 1.2;
  return { k, scaleZ, tilt, sink };
}
/** The press runs along the arc over this many frames (Fix A's first, F8 last). */
export const PRESS_SPREAD = 2;
/**
 * Each body's press delay after TURN.press (FOLDERS order, then Fix A's): the press runs along the arc at one pace, from
 * Fix A's in the west round to F8 in the east (the bodies in order of their bearing from your desk, each delayed by its
 * distance along that chain): 0 to PRESS_SPREAD, every body a share of it after its neighbour (R-A3: by distance from
 * your desk, five of the eight had pressed within 0.44 f of each other).
 */
export const PRESS_DELAY: readonly number[] = (() => {
  const cs = [...FOLDERS.map((fl) => fl.c), FIX_A_FOLDER.c];
  const bearing = (c: P2) => {
    const a = Math.atan2(c[1] - LOOP_A.c[1], c[0] - LOOP_A.c[0]);
    return a < -Math.PI / 2 ? a + 2 * Math.PI : a;
  };
  const order = cs.map((_, i) => i).sort((i, j) => bearing(cs[j]) - bearing(cs[i]));
  const along = new Array<number>(cs.length).fill(0);
  order.forEach((i, n) => {
    if (n > 0) along[i] = along[order[n - 1]] + Math.hypot(cs[i][0] - cs[order[n - 1]][0], cs[i][1] - cs[order[n - 1]][1]);
  });
  const total = along[order[order.length - 1]];
  return along.map((x) => (PRESS_SPREAD * x) / total);
})();
/**
 * A body's press phases (its own frames: 1 on its first frame, which is the hit's for the first body; pressFrames in all):
 * - a 3 f squash to 45% of its height (fast in: its shadow and its pen's pull in), spreading 4 u each side as it goes
 *   flat, held spread until the draw-in (so it reads as flattening outward, not a puff: R-A3);
 * - the imprint's embossed rim deepens under it from `rimFrom` to `rimTo` (before any colour change);
 * - it draws in from its spread to 5 u inside its outline (`drawFrom`–`drawTo`), uncovering the rim, and flattens on;
 * - it takes the slate's tone from `slateFrom` (4 frames of physical change first) to `flat`;
 * - only then, in the slate's tone, does it sink under the slate (`sinkFrom`–`sinkTo`): nothing goes under the slate's
 *   surface before it is in the slate's tone.
 */
export const PRESS_PHASE = { squash: 3, half: 0.55, spread: 4, rimFrom: 2, rimTo: 6, drawFrom: 5, drawTo: 9, slateFrom: 5, flat: 11, sinkFrom: 11, sinkTo: 12 } as const;
/** A body's own press frame (`delay` after TURN.press: PRESS_DELAY): 1 on its first frame, so the first body moves on the hit itself. */
export const pressT = (f: number, delay: number): number => f - TURN.press - delay + 1;
/** How far a body is pressed (0..1 of the way to flat; monotonic, never past flat). */
export const pressedAt = (f: number, delay: number): number => {
  const t = pressT(f, delay);
  const P = PRESS_PHASE;
  return P.half * easings.outQuad(clamp(t / P.squash)) + (1 - P.half) * easings.inOutSine(clamp((t - P.squash) / (P.flat - P.squash)));
};
/** How far a pressed body has taken the slate's tone: after its squash and draw-in have started, all of it by the time it is flat. */
export const slateAt = (f: number, delay: number): number => {
  const x = clamp((pressT(f, delay) - PRESS_PHASE.slateFrom) / (PRESS_PHASE.flat - PRESS_PHASE.slateFrom));
  return x * x * (3 - 2 * x);
};
/** The kit's late step amount that takes graphite, enamel and steel exactly to the slate's tone (gl/materials.ts: 0.45 of the way per unit). */
export const PRESS_LATE = 1 / 0.45;
/**
 * A folder pressed into the desk (act one's eight and Fix A's, from the hit, `delay` frames after TURN.press:
 * PRESS_DELAY): one body with its pen, flag, clip and pile, on PRESS_PHASE: squashed and spread, drawn in 5 u from its
 * outline into its imprint as it flattens and takes the slate's tone, then sunk 2.4 u (h 0 → −2) in that tone; its top is
 * under the slate, its tone the slate's, before it is dropped (from its own frame pressFrames).
 */
export function foldPressAt(f: number, delay: number = 0): Press {
  const t = pressT(f, delay);
  if (t >= TURN.pressFrames) return { k: 1, scaleZ: 0.02, tilt: 0, sink: 2.4, inset: 5, slate: 1 };
  if (t <= 0) return { k: 0, scaleZ: 1, tilt: 0, sink: 0, inset: 0, slate: 0 };
  const P = PRESS_PHASE;
  const s = pressedAt(f, delay);
  const spread = P.spread * easings.outQuad(clamp(t / P.squash));
  const draw = easings.inOutSine(clamp((t - P.drawFrom) / (P.drawTo - P.drawFrom)));
  return {
    k: Math.min(t / TURN.pressFrames, 0.999),
    scaleZ: 1 - 0.98 * s,
    tilt: 0,
    sink: 2.4 * easings.inOutSine(clamp((t - P.sinkFrom) / (P.sinkTo - P.sinkFrom))),
    inset: -spread + (5 + spread) * draw,
    slate: slateAt(f, delay),
  };
}
/** How deep the desk's imprint under a pressed folder is (its embossed rim in, PRESS_PHASE rimFrom–rimTo, before the folder takes the slate's tone). */
export const imprintOf = (p: Press): number => clamp((p.k * TURN.pressFrames - PRESS_PHASE.rimFrom) / (PRESS_PHASE.rimTo - PRESS_PHASE.rimFrom));

// ------------------------------------------------------------------------------------------------
// Fix B: the replies home; five trays posted back out east; three walled up into the bays of (b)

/** A retiring tray on its way out (its offset from its place) until it is beyond the frame's east edge. */
export interface TrayRetire {
  off: P3;
  gone: boolean;
}
export interface BayTurn {
  id: BayId;
  /** the tray's slide toward its bay's place before it walls up (u along x: the test tower's tray) */
  slide: number;
  /** the tray's growth into the bay's walls (0..1): its rect, wall height, thickness and door interpolate to the bay's */
  grow: number;
  /** grey stock to graphite (0..1) */
  built: number;
  /** its torn, perforated rim straightening into the bay's bevelled walls (0..1) */
  morph: number;
  /** its floor becoming the bay's graphite lid: two leaves on their hinges, the seam between them (0..1) */
  lid: number;
  /** the lid's leaves dropped open into the pit (0 shut … 1 hanging: objects/Dispatch.tsx Hatch 'lid') */
  leaves: number;
  /** how far what lay in the tray has fallen into the pit (0..1) */
  fall: number;
  /** whether its hatch's hole in the slate is open */
  hole: boolean;
  /** walled up, its lid shut: the closed, idle bay (objects/Bay.tsx draws it from here, as act two does) */
  done: boolean;
}
export interface FixBTurn {
  /** each reply slip k (from tray k): its centre, turn, tilt, and how far it has turned to paper */
  slips: { p: P3; rot: number; tilt: number; paper: number }[];
  /** each retiring tray posted back out (null: a tray that becomes a bay) */
  retire: (TrayRetire | null)[];
  /** the trays that become bays (BAY_TRAYS order) */
  bays: BayTurn[];
}

const IN_TRAY_Z = YOU.top + 3;
/** The order the replies leave in: the retiring trays' first, eastmost first, then the bays' own. */
export const REPLY_ORDER: readonly number[] = [2, 7, 4, 1, 0, ...BAY_TRAYS.map((b) => b.k)];
/** Slip k leaves your in-tray. */
export const replyLeaves = (k: number): number => TURN.replies + TURN.replyStagger * REPLY_ORDER.indexOf(k);
export const replyLands = (k: number): number => replyLeaves(k) + 3 + TURN.replyArc;
/** How far a retiring tray travels east (beyond the frame's east edge from any tray's place, the camera at 0.85x) and how high it lifts (over the trays that stay). */
const RETIRE_DIST = 900;
const RETIRE_LIFT = 40;
export const retireStarts = (k: number): number => replyLands(k) + TURN.retireAfter;
/** The order the bays wall up in, one at a time. */
export const BAY_ORDER: readonly BayId[] = ['bug', 'docs', 'tests'];
/**
 * Each bay walls up once the trays in its box have gone: the bug bench in tray 5's place once the retiring trays have
 * flown over it; the docs galley in tray 3's once your desk's east end has left its box; the test tower once tray 6 has
 * slid west along the south row (clear of the docs galley) and your desk has left its place.
 */
const BAY_GROW: Readonly<Record<BayId, number>> = { bug: 1510, docs: 1540, tests: TURN.testsSlide + TURN.testsSlideFrames };
/**
 * A bay's schedule: its tray's slide, the walls grow (14 f), the floor becomes the lid (8 f), the lid's leaves drop open
 * (LEAVES_OPEN f, gathering speed) and hang while what lay in the tray falls into the pit and slides under the near (south)
 * wall, then they swing shut (6 f): closed.
 */
export const LEAVES_OPEN = 4;
export const bayTimes = (k: number) => {
  const id = BAY_TRAYS.find((b) => b.k === k)!.id;
  const g = BAY_GROW[id];
  return { slide: id === 'tests' ? TURN.testsSlide : g, grow: g, lid: g + 10, open: g + 18, shut: g + 24, closed: g + 30 };
};
/** When a tray first changes after its reply is home: a retiring tray's post out, a bay's slide or growth. */
export const trayStarts = (k: number): number => (RETIRE_TRAYS.includes(k) ? retireStarts(k) : bayTimes(k).slide);
/** How far the test tower's tray slides west, to the middle of the tower's box (along the clear south row). */
export const TESTS_SLIDE = (BAYS.tests.box.x0 + BAYS.tests.box.x1) / 2 - TRAYS[BAY_TRAYS.find((b) => b.id === 'tests')!.k].c[0];

function inTraySlot(k: number, shift: P2): P3 {
  const o = IN_TRAY_PILE[k].o;
  return [IN_TRAY_A_C[0] - YOU_SHIFT_A[0] + shift[0] + o[0], IN_TRAY_A_C[1] - YOU_SHIFT_A[1] + shift[1] + o[1], IN_TRAY_Z + 0.9 * k];
}

/** A retiring tray posted back out: 3 f anticipation (a 4 u lift, slow off its place), then up over the trays that stay and away east, gathering speed. */
export function retireAt(k: number, f: number): TrayRetire {
  const t0 = retireStarts(k);
  if (f < t0) return { off: [0, 0, 0], gone: false };
  if (f < t0 + TURN.retireAntic) return { off: [0, 0, 4 * easings.inOutSine((f - t0) / TURN.retireAntic)], gone: false };
  const u = (f - t0 - TURN.retireAntic) / TURN.retireFrames;
  if (u >= 1) return { off: [RETIRE_DIST, 0, 4 + RETIRE_LIFT], gone: true };
  return { off: [RETIRE_DIST * u * u, 0, 4 + RETIRE_LIFT * MOVE(u)], gone: false };
}

/** A retiring tray's contact shadow: it fades over the first two thirds of its anticipation as it lifts off (before the shaders stop drawing it, above 2 u), never cut whole. */
export const retireContact = (k: number, f: number): number => 0.8 * clamp(1 - (1.5 * (f - retireStarts(k))) / TURN.retireAntic);

export function fixBTurnAt(f: number, shiftAt: (f: number) => P2): FixBTurn {
  const slips = IN_TRAY_PILE.map((pile, k) => {
    const leave = replyLeaves(k);
    // in your in-tray as beat 3 left them (it rides your desk)
    if (f < leave) return { p: inTraySlot(k, shiftAt(f)), rot: pile.rot, tilt: 0, paper: 0 };
    // 3 f anticipation (it lifts 4 u), then a 14 f arc home (apex 70), landing where it rested in its tray in beat 3
    const from = inTraySlot(k, shiftAt(leave + 3));
    const to = trayRestB(k);
    if (f < leave + 3) {
      const a = inTraySlot(k, shiftAt(f));
      return { p: [a[0], a[1], a[2] + 4 * MOVE((f - leave) / 3)] as P3, rot: pile.rot, tilt: 0, paper: 0 };
    }
    const u = clamp((f - leave - 3) / TURN.replyArc);
    const e = Math.sin((u * Math.PI) / 2) ** 2;
    const p: P3 = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + 4 + (to[2] - from[2] - 4) * e + 4 * 70 * u * (1 - u)];
    const home = TRAY_STUFF[k].reply.rot;
    return { p: u >= 1 ? to : p, rot: pile.rot + (home - pile.rot) * e, tilt: 0.25 * Math.sin(u * Math.PI), paper: 0 };
  });
  const retire = TRAYS.map((_, k) => (RETIRE_TRAYS.includes(k) ? retireAt(k, f) : null));
  const bays = BAY_TRAYS.map(({ k, id }): BayTurn => {
    const T = bayTimes(k);
    const grow = clamp(springOver(f, T.grow, TURN.growFrames, SPRING.heavy));
    return {
      id,
      slide: id === 'tests' ? TESTS_SLIDE * CAMERA(span01(f, T.slide, T.grow)) : 0,
      grow,
      built: springAt(f, T.grow, SPRING.effects),
      morph: grow,
      lid: easings.inOutSine(span01(f, T.lid, T.open)),
      // the leaves drop open over LEAVES_OPEN f gathering speed (Hatch: an angle of open²), hang, then swing back up and shut
      leaves: f < T.shut ? span01(f, T.open, T.open + LEAVES_OPEN) : 1 - easings.inOutSine(span01(f, T.shut, T.closed)),
      // what lay in the tray falls as the leaves drop from under it, sliding to the near wall, hidden before they shut
      fall: easings.inQuad(span01(f, T.open + 1, T.shut - 1)),
      // the hole opens as the leaves leave the slate (never on a frame they lie shut on it) and closes as they shut
      hole: f > T.open && f < T.closed,
      done: f >= T.closed,
    };
  });
  return { slips, retire, bays };
}

/** A bay's walls while its tray grows into them: the box, the wall height and thickness, the south wall, the door gap. */
export interface BayShape {
  box: Rect;
  wallH: number;
  wall: number;
  southWall: number;
  door: [number, number];
}
/** A tray's door gap in its north wall (30 u wide at its offset from the middle), as the bay's door grows from it. */
const TRAY_DOOR = 30;
export function bayShapeAt(k: number, b: BayLayout, grow: number, slide = 0): BayShape {
  const tr = TRAYS[k];
  const t: Rect = { x0: tr.c[0] + slide - tr.w / 2, x1: tr.c[0] + slide + tr.w / 2, y0: tr.c[1] - tr.d / 2, y1: tr.c[1] + tr.d / 2 };
  const g = grow;
  const mix = (a: number, c: number) => a + (c - a) * g;
  const box: Rect = { x0: mix(t.x0, b.box.x0), x1: mix(t.x1, b.box.x1), y0: mix(t.y0, b.box.y0), y1: mix(t.y1, b.box.y1) };
  // the door gap: the tray's to the bay's, relative to the box's west edge
  const tDoor: [number, number] = [tr.w / 2 + tr.door - TRAY_DOOR / 2, tr.w / 2 + tr.door + TRAY_DOOR / 2];
  const bDoor: [number, number] = [b.door[0] - b.box.x0, b.door[1] - b.box.x0];
  return {
    box,
    wallH: mix(TRAY_Z.rim, b.wallH),
    wall: mix(TRAY_Z.wallT, b.wall),
    southWall: mix(TRAY_Z.wallT + 2, b.southWall),
    door: [box.x0 + mix(tDoor[0], bDoor[0]), box.x0 + mix(tDoor[1], bDoor[1])],
  };
}
/** The walls of a bay shape (as footprints.ts bayWalls): west, east, south, and the north wall either side of the door. */
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

/** Your lid strut goes home to its recess as your desk slides (a low hop over 18 f, in and out), so act two finds it in its tray. */
export const STRUT_HOME = { from: TURN.slide + 2, frames: 18 } as const;
export function strutTurnAt(f: number): Pick<YouPose, 'strut' | 'strutMix'> {
  const k = easings.inOutSine(span01(f, STRUT_HOME.from, STRUT_HOME.from + STRUT_HOME.frames));
  return k <= 0 ? { strut: 'lid' } : k >= 1 ? { strut: 'tray' } : { strut: 'lid', strutMix: k };
}

export function youPoseTurn(f: number): YouPose {
  const m = slideAt(f);
  const A = youPoseA(heldActOne(f));
  // the in-tray stays empty after the flock until the chute's first delivery lands in it (act two's older reply, YourDesk slip1)
  const inTray = { inTray: true, inTraySlip: f >= OLDER_REPLY.lands } as const;
  const strut = strutTurnAt(f);
  if (m >= 0.9995) {
    const dim = lampDimAt(f);
    if (dim >= 1) return { ...YOU_POSE_B, bulb: EMIT.bulbMax * TURN_LAMP, ...inTray, ...strut };
    return { ...YOU_POSE_B, bulb: BULB_A.level + (EMIT.bulbMax * TURN_LAMP - BULB_A.level) * dim, bulbOut: BULB_A.out * (1 - dim), ...inTray, ...strut };
  }
  if (m <= 0) {
    const dim = lampDimAt(f);
    return { ...A, bulb: BULB_A.level + (EMIT.bulbMax * TURN_LAMP - BULB_A.level) * dim, bulbOut: BULB_A.out * (1 - dim), ...inTray, ...strut };
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
    ...strut,
    held: { key: 1, glass: 1, strut: 1 },
    ...inTray,
  };
}

/**
 * The older reply act two finds in your in-tray (YourDesk slip1, "14:00 ok"): the reply chute's first delivery once it
 * stands. Out from under the deck along the chute's line (as act two's replies come: state.ts REPLY_PATH), gathering
 * speed, down the chute at a constant pace, off its lip in a short hop, landing on the in-tray's floor where act two
 * draws it, still before the hand-off.
 */
export const OLDER_REPLY = { leave: TURN.chuteEnd - 4, lip: TURN.chuteEnd + 10, lands: TURN.chuteEnd + 14, hop: 12 } as const;
/** Where it lies in the in-tray (desk coordinates at act two's place, as YourDesk's slip1): its centre and its turn. */
export const OLDER_REPLY_REST = { p: [(YOU.inTray.x0 + YOU.inTray.x1) / 2 + 2, (YOU.inTray.y0 + YOU.inTray.y1) / 2 - 14, YOU.top + 4.2] as P3, heading: -0.1, size: [80, 52] as P2 } as const;
export function olderReplyAt(f: number): { p: P3; heading: number; slope: number } | null {
  const R = OLDER_REPLY;
  if (f < R.leave || f >= R.lands) return null;
  if (f < R.lip) {
    const { p, dir } = polylineAt(REPLY_PATH, replyRun((f - R.leave) / (R.lip - R.leave)));
    return { p, heading: Math.atan2(dir[1], dir[0]) + Math.PI, slope: Math.atan2(dir[2], Math.hypot(dir[0], dir[1])) };
  }
  // off the lip: it leaves at the chute's heading and slope, hops over the in-tray's wall, turns and levels to lie in it
  const end = REPLY_PATH[REPLY_PATH.length - 1];
  const { dir } = polylineAt(REPLY_PATH, 1);
  const h0 = Math.atan2(dir[1], dir[0]) + Math.PI;
  const s0 = Math.atan2(dir[2], Math.hypot(dir[0], dir[1]));
  const u = (f - R.lip) / (R.lands - R.lip);
  const e = easings.inOutSine(u);
  const to = OLDER_REPLY_REST.p;
  const p: P3 = [end[0] + (to[0] - end[0]) * u, end[1] + (to[1] - end[1]) * u, end[2] + (to[2] - end[2]) * u * u + 4 * R.hop * u * (1 - u)];
  let h1 = OLDER_REPLY_REST.heading;
  while (h1 - h0 > Math.PI) h1 -= 2 * Math.PI;
  while (h0 - h1 > Math.PI) h1 += 2 * Math.PI;
  return { p, heading: h0 + (h1 - h0) * e, slope: s0 * (1 - e) };
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
/// Labels

export interface LabelReveal {
  /** the hairline leader drawn (0..1, 6 f), then the label wiped in (0..1, 8 f) */
  leader: number;
  wipe: number;
}
const reveal = (f: number, from: number): LabelReveal | null => (f < from ? null : { leader: ENTER(clamp((f - from) / 6)), wipe: clamp((f - from - 6) / 8) });
/** The act-two labels as they enter once the camera has settled (your act-one label left as beat 3 began: actOne.ts YOU_LABEL_OUT). */
export function labelsTurnAt(f: number): { you: LabelReveal | null; router: LabelReveal | null } {
  return { you: reveal(f, TURN.youLabel), router: reveal(f, TURN.routerLabel) };
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
  fixA: FixAView;
  fixB: FixBTurn;
  deck: DeckTurn;
  parts: PartsTurn;
  intake: IntakeTurn;
  slip: SlipTurn | null;
  /** the older reply on its way down the chute (act two finds it in your in-tray) */
  reply: ReturnType<typeof olderReplyAt>;
  tape: RegisterTape;
  labels: ReturnType<typeof labelsTurnAt>;
  /** the focus step-down of the heap, the feeders and the request (0..1) */
  step: number;
}

/** The intake's step-down: held from act one (actOne.ts FOCUS_A.intake), out over 16 f for "hears every channel". */
export function turnStepAt(f: number): number {
  return 1 - easings.inOutSine(span01(f, TURN.stepOut, TURN.stepOut + TURN.stepFrames));
}

/**
 * The slate's tone as the frame lights it at a place (linear RGB): the desk's base under the pools that reach the desk
 * there (gl/desk.ts: base × (1 + pool)). A pressed folder's paper goes to exactly this, so it goes under the slate in the
 * slate's own tone (never darker than the desk round it, never a step when it is gone).
 */
/** The desk's base (gl/desk.ts DESK_HEX.base; that module carries the shader, so it is not imported here). */
const SLATE_HEX = '#212322';
export function slateToneAt(pools: readonly Pool[], c: P2): P3 {
  const base = linearOf(SLATE_HEX);
  const s = [0, 0, 0];
  for (const q of pools) {
    if (q.z[0] > 0 || q.z[1] < 0) continue;
    const dx = (c[0] - q.c[0]) / q.sigma[0];
    const dy = (c[1] - q.c[1]) / q.sigma[1];
    const e = Math.exp(-0.5 * (dx * dx + dy * dy));
    for (let i = 0; i < 3; i++) s[i] += q.rgb[i] * e;
  }
  return [base[0] * (1 + s[0]), base[1] * (1 + s[1]), base[2] * (1 + s[2])];
}

export function turnAt(f: number): TurnState {
  const loop = loopTurnAt(f);
  const act = heldActOne(f);
  // the pools reach the slate as act one's (held) pool and the Register's (which never reaches the desk: z from 118)
  const pools = turnPools({ f, act, tape: registerTapeAt(f) });
  return {
    f,
    act,
    pressA: { ...foldPressAt(f, PRESS_DELAY[FOLDERS.length]), tone: slateToneAt(pools, FIX_A_FOLDER.c) },
    press: FOLDERS.map((fl, i) => ({ ...foldPressAt(f, PRESS_DELAY[i]), tone: slateToneAt(pools, fl.c) })),
    you: youPoseTurn(f),
    loop,
    fixA: fixATurnAt(f, loop),
    fixB: fixBTurnAt(f, shiftAt),
    deck: deckTurnAt(f),
    parts: partsTurnAt(f),
    intake: intakeTurnAt(f),
    slip: firstSlipAt(f),
    reply: olderReplyAt(f),
    tape: registerTapeAt(f),
    labels: labelsTurnAt(f),
    step: turnStepAt(f),
  };
}

/**
 * The desk state the act-two objects read during the turn: act two's rest (nothing of (b)'s handshake has happened) and
 * the intake's step held from act one. (The pressed folders' pens, flags and clips are on their own materials, each
 * folder's toned with its own press: objects/ActOne.tsx Folder; they no longer ride the kit's late ramp, one for all.)
 */
export function turnDeskState(f: number): DeskState {
  const step = turnStepAt(f);
  const s = deskStateAt(f);
  return { ...s, step: { amount: step, ids: step > 0 ? ['intake'] : [] } };
}

/** Each imprint's depth (beat3.ts IMPRINTS order: F1..F8, then Fix A's). */
export const imprintsAt = (t: TurnState): number[] => [...t.press.map(imprintOf), imprintOf(t.pressA)];

/** The desk's open hatches during the turn (world rects; one per bay while its floor slides away and its leaves shut). */
export function turnHoles(t: TurnState): Rect[] {
  return t.fixB.bays.filter((b) => b.hole).map((b) => BAYS[b.id].box);
}

// ------------------------------------------------------------------------------------------------
// Light: the frame's footprints and pools

/**
 * A footprint of a pressed body (a folder's, its pen's, its flag's): carried by the press, its heights squashed and sunk,
 * its outline drawn in toward the body's centre in the body's own frame; nothing once it is under the slate.
 */
function pressFp(fp: Footprint, c: P2, w: number, d: number, rot: number, p: Press): Footprint | null {
  if (p.k <= 0) return fp;
  if (p.k >= 1) return null;
  const z = (h: number) => h * p.scaleZ - p.sink;
  const inset = p.inset ?? 0;
  const sx = Math.max(0.05, 1 - (2 * inset) / w);
  const sy = Math.max(0.05, 1 - (2 * inset) / d);
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const q = (pt: readonly number[]): P2 => {
    const dx = pt[0] - c[0];
    const dy = pt[1] - c[1];
    const u = (cs * dx + sn * dy) * sx;
    const v = (-sn * dx + cs * dy) * sy;
    return [c[0] + cs * u - sn * v, c[1] + sn * u + cs * v];
  };
  // its contact fades as the body goes flat (gone before the footprint is dropped)
  const fade = (z1: number) => clamp((z1 - 0.4) / 8);
  if (fp.kind === 'rect') {
    const z1 = z(fp.z1);
    if (z1 <= 0.4) return null;
    const own = Math.abs(fp.rot - rot) < 1e-9;
    return { ...fp, c: q(fp.c), h: own ? [fp.h[0] * sx, fp.h[1] * sy] : fp.h, z0: Math.max(0, z(fp.z0)), z1, contact: fp.contact * fade(z1) };
  }
  if (fp.kind === 'seg') {
    const ha = z(fp.ha);
    const hb = z(fp.hb);
    if (Math.max(ha, hb) <= 0.5) return null;
    const a = q(fp.a);
    const b = q(fp.b);
    return { ...fp, a, b, ha, hb };
  }
  if (fp.kind === 'circle') {
    const z1 = z(fp.z1);
    return z1 <= 0.4 ? null : { ...fp, c: q(fp.c), z0: Math.max(0, z(fp.z0)), z1, contact: fp.contact * fade(z1) };
  }
  return fp;
}

/** A feeder's generic box (and what lies on it) pressed flat into its vellum drawing: its heights squashed and sunk; nothing once flat. */
function flattenFp(fp: Footprint, p: Press): Footprint | null {
  if (p.k <= 0) return fp;
  if (p.k >= 1 || fp.kind !== 'rect') return null;
  const z1 = fp.z1 * p.scaleZ - p.sink;
  return z1 <= 0.4 ? null : { ...fp, z0: Math.max(0, fp.z0 * p.scaleZ - p.sink), z1 };
}

/** The loop's clip's contact as it lifts off the desk (u): 0.9 on the desk, gone by 3.2 u. */
export const clipContact = (lift: number): number => 0.9 * clamp(1 - lift / 3.2);

/** The request in the old heap as act one casts it, handed to act two's cast (desk/footprints.ts carrierContact: none above 5 u) over 16 f while the camera moves. */
const REQUEST_CAST = { from: 1460, frames: 16 } as const;
const carrierContact = (z: number): number => 0.4 * clamp((5 - z) / 3.6);

/**
 * A Register footprint (rect or circle, in its place) posed with the deck as the deck is drawn (deckPoint: its roll, lift and
 * tilt, objects/Register.tsx): its plan where its middle is, its heights the lowest its base and its top reach over its
 * outline. A footprint is flat and the deck tilts as its legs settle (their 3 f stagger), so its top is taken at its
 * lowest corner: what lies on it (the plate's top, the window's floor) is never under it, never shaded by its own support.
 * (Moved by (dy, dz) alone, the plate's top went into its own shadow wherever the tilt dipped it under the plate's
 * translated top: a straight diagonal edge swept the window at f1586, the plate stayed shaded through the legs' settle and
 * came back lit in one frame at f1596; the critic's throat-window P2, A18.) At rest the pose is the identity.
 */
function posedOnDeck(d: DeckTurn, r: Extract<Footprint, { kind: 'rect' | 'circle' }>): Footprint {
  const ext: P2[] =
    r.kind === 'rect'
      ? [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sy]) => {
          const x = sx * r.h[0];
          const y = sy * r.h[1];
          return [r.c[0] + x * Math.cos(r.rot) - y * Math.sin(r.rot), r.c[1] + x * Math.sin(r.rot) + y * Math.cos(r.rot)] as P2;
        })
      : [
          [r.c[0] - r.r, r.c[1]],
          [r.c[0] + r.r, r.c[1]],
          [r.c[0], r.c[1] - r.r],
          [r.c[0], r.c[1] + r.r],
        ];
  const mid = deckPoint(d, [r.c[0], r.c[1], (r.z0 + r.z1) / 2]);
  const z0 = Math.min(...ext.map((q) => deckPoint(d, [q[0], q[1], r.z0])[2]));
  const z1 = Math.min(...ext.map((q) => deckPoint(d, [q[0], q[1], r.z1])[2]));
  return { ...r, c: [mid[0], mid[1]], z0: Math.max(0, z0), z1: Math.max(0.5, z1) };
}

export function turnFootprints(t: TurnState): Footprint[] {
  const f = t.f;
  const fp: Footprint[] = [...youFootprints(t.you)];
  const a = t.act;
  // the notes loop: its sixteen chords and its clip (act one's while it lies on the desk), up on edge; then the coil until it locks
  const lt = t.loop;
  if (lt.ribbon) {
    const { L, edge } = lt.ribbon;
    // cast at the ribbon's underside (so the band never shades itself as it turns on edge: a receiver on it is never
    // under its own chords), its plan carried down the key by the shadow's offset from its raised edge (where act one's
    // flat tape, edge 0, casts exactly as act one does)
    const [ox, oy] = shadowOffset(edge * A_TAPE_W);
    const zc = edge > 0 ? L.z - 0.1 : L.z;
    for (let i = 0; i < 16; i++) {
      const p = loopAt(L, (i / 16) * Math.PI * 2);
      const q = loopAt(L, ((i + 1) / 16) * Math.PI * 2);
      fp.push(segFp([p[0] + ox, p[1] + oy, zc], [q[0] + ox, q[1] + oy, zc], 10 + 2 * (1 - edge)));
    }
    const lift = L.z - LOOP_A.z + (L.w / 2) * edge;
    // its contact fades with its lift (out by 3.2 u: the rise's first frame lifts it 1.6 u, so it halves, never cuts)
    fp.push(circleFp(loopAt(L, L.clipAt), 26, lift, lift + 7.8, clipContact(lift)));
  }
  if (lt.coil && f < TURN.lock) fp.push(circleFp(lt.coil.c, lt.coil.rOut + 4, lt.coil.h, lt.coil.h + lt.coil.t, 0.6));
  // act one's folders, pressed with their pens and flags
  FOLDERS.forEach((fl, i) => {
    for (const x of folderFootprints(fl, a.folders[i])) {
      const y = pressFp(x, fl.c, fl.w, fl.d, fl.rot, t.press[i]);
      if (y) fp.push(y);
    }
  });
  // the feeders: act one's (the generic mail and calendar pressed flat into their vellum drawings), then the intake's spool, belt and gate
  const fd = feederFootprints();
  fp.push(...fd.slice(0, fd.length - 4));
  const [box, envelope, pad, leaf] = fd.slice(fd.length - 4);
  for (const [x, p] of [
    [box, t.intake.mail],
    [envelope, t.intake.mail],
    [pad, t.intake.calendar],
    [leaf, t.intake.calendar],
  ] as const) {
    const y = flattenFp(x, p);
    if (y) fp.push(y);
  }
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
  // the old heap and the request in it: act one's cast (the request's handed to act two's), then beat 4's as the request
  // starts out of it (desk/beat4.ts REQUEST_FROM), as act two casts them
  if (f < REQUEST_FROM) {
    const k = easings.inOutSine(span01(f, REQUEST_CAST.from, REQUEST_CAST.from + REQUEST_CAST.frames));
    for (const x of heapFootprints(a)) {
      if (x.kind === 'rect' && x.h[0] === REQUEST.l / 2 && x.h[1] === REQUEST.w / 2 && k > 0) {
        const z = requestAt(REQUEST_FROM).pose!.p[2];
        fp.push({ ...x, z0: x.z0 + (z - 0.4 - x.z0) * k, z1: x.z1 + (z + 0.6 - x.z1) * k, contact: x.contact + (carrierContact(z) - x.contact) * k });
      } else fp.push(x);
    }
  } else {
    fp.push(...heapFootprintsAt(heapAt(f)));
    const r = requestAt(f).pose;
    if (r) fp.push({ kind: 'rect', c: [r.p[0], r.p[1]], h: [REQUEST.l / 2, REQUEST.w / 2], r: 2, rot: r.heading, z0: r.p[2] - 0.4, z1: r.p[2] + 0.6, contact: carrierContact(r.p[2]) });
  }
  // Fix A: its folder pressed with its pile, its tape on the desk and its chutes (as beat 3 casts them), the span up to the loop or coil
  const A = t.fixA;
  const fa = fixAFootprints({ ...A, items: [] });
  const F = FIX_A_FOLDER;
  const body = pressFp(fa[0], F.c, F.w, F.d, F.rot, t.pressA);
  if (body) fp.push(body);
  fp.push(...fa.slice(1));
  if (A.spanLen > 0.5) fp.push(segFp(A.span.b, lerp3(A.span.b, A.span.a, A.spanLen / A.span.len), A_TAPE_W / 2 - 2));
  // Fix B: the replies in your in-tray and in the air (home in its tray, a reply casts nothing of its own); each retiring
  // tray as it is posted out; each bay tray as it slides and walls up (its own rect drawing in under its floor as its
  // walls take over), the pit under an open hatch, then the closed bay's shell (act two's)
  const B = t.fixB;
  B.slips.forEach((s, k) => {
    if (f >= replyLands(k)) return;
    fp.push(replySlipFootprint(s));
  });
  TRAYS.forEach((tr, k) => {
    const R = B.retire[k];
    if (!R || R.gone) return;
    const o = R.off;
    fp.push({ kind: 'rect', c: [tr.c[0] + o[0], tr.c[1] + o[1]], h: [tr.w / 2, tr.d / 2], r: 3, rot: 0, z0: o[2], z1: o[2] + TRAY_Z.rim, contact: retireContact(k, f) });
  });
  B.bays.forEach((b, i) => {
    const L = BAYS[b.id];
    if (b.done) return void fp.push(...bayShellFootprints(L));
    const k = BAY_TRAYS[i].k;
    const s = bayShapeAt(k, L, b.grow, b.slide);
    const c: P2 = [(s.box.x0 + s.box.x1) / 2, (s.box.y0 + s.box.y1) / 2];
    fp.push({ kind: 'rect', c, h: [(s.box.x1 - s.box.x0) / 2, (s.box.y1 - s.box.y0) / 2], r: 3, rot: 0, z0: 0, z1: Math.max(0.4, TRAY_Z.rim * (1 - b.grow)), contact: 0.8 * (1 - b.grow) });
    if (b.grow > 0) {
      const h = TRAY_Z.rim + (L.wallH - TRAY_Z.rim) * b.grow;
      for (const w of shapeWalls(s)) fp.push(rectFp(w, 0, h, b.grow, 2));
      fp.push(rectFp({ x0: s.door[0], x1: s.door[1], y0: s.box.y1 - s.wall + 2, y1: s.box.y1 - 2 }, 0, (L.wallH - 6) * b.grow, b.grow, 2));
    }
    // the open pit's sky occlusion only (its darkening grows with depth: a leaf dropping open and what falls into the pit
    // darken as they go down, never at once on the frame the leaves leave the slate's plane)
    if (b.hole) fp.push(...pitFootprints(L.box).filter((x) => x.kind === 'canopy'));
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
      if (r.kind === 'rect' || r.kind === 'circle') fp.push(posedOnDeck(d, r));
      else if (r.kind === 'seg') {
        // its ends posed with the deck (its tilt too)
        const a = deckPoint(d, [r.a[0], r.a[1], r.ha]);
        const b = deckPoint(d, [r.b[0], r.b[1], r.hb]);
        fp.push({ ...r, a: [a[0], a[1]], b: [b[0], b[1]], ha: Math.max(0, a[2]), hb: Math.max(0, b[2]) });
      } else {
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
  // the older reply in the air (lying in the in-tray it casts nothing of its own, as act two's)
  if (t.reply) fp.push({ kind: 'rect', c: [t.reply.p[0], t.reply.p[1]], h: [OLDER_REPLY_REST.size[0] / 2, OLDER_REPLY_REST.size[1] / 2], r: 2, rot: t.reply.heading, z0: t.reply.p[2] - 0.4, z1: t.reply.p[2] + 0.4, contact: 0 });
  return fp;
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

/**
 * How low your lamp's pool lights in the turn: down into the bays' pits while their lids drop open (a leaf going under the
 * slate's plane is never cut out of the light: it darkens by its own turn and the pit's depth), from once the pressed
 * folders are gone (nothing lies under the slate's plane then) until every bay is closed; the slate's plane before and after.
 */
export const POOL_DEEP = { from: TURN.press + TURN.pressGone, to: TURN.descend, z: -400 } as const;
export const poolFloorAt = (f: number): number => (f >= POOL_DEEP.from && f < POOL_DEEP.to ? POOL_DEEP.z : 0);

/** The pools: your lamp's (from the folder it attended to your in-tray, narrowing and dimming), the Register's reading lamp and its newest cell once it reads. */
export function turnPools(t: Pick<TurnState, 'f' | 'act' | 'tape'>): Pool[] {
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
  // how high it lights: act one's heights (POOL_A_Z) until your desk slides; as it slides, from the heights its upper pool
  // reached (your lamp's band) down to act two's, with the desk
  const top = m >= 0.9995 ? 140 : m > 0 ? mix(UPPER_POOL.top, 140) : P.z[1];
  const yours: Pool = { c: [mix(P.c[0], LAMP_AIM[0]), mix(P.c[1], LAMP_AIM[1])], z: [poolFloorAt(t.f), top], sigma: [mix(P.sigma[0], 74), mix(P.sigma[1], 66)], rgb: [mixD(yourA[0], yourB[0]), mixD(yourA[1], yourB[1]), mixD(yourA[2], yourB[2])] };
  const scaled = (k: number): P3 => [yours.rgb[0] * k, yours.rgb[1] * k, yours.rgb[2] * k];
  // the same light comes up over the heights above it while the hit moves everything (UPPER_POOL: your lamp's hood and
  // arm; HIGH_POOL: up to the rising loop's top), so the loop's band, rising through them while its face turns up, stays in
  // its light, and nothing is lit in one frame; the light above your lamp's band goes again, by amount, as the band stands
  // on edge (so the coil's top, which comes up there, is never lit to white by it)
  const up = m <= 0 ? Math.max(0, easings.inOutSine(span01(t.f, UPPER_POOL.from, UPPER_POOL.to))) : 0;
  const upper: Pool = { ...yours, z: [P.z[1], UPPER_POOL.top], rgb: scaled(up) };
  const high: Pool = { ...yours, z: [UPPER_POOL.top, HIGH_POOL.top], rgb: scaled(up * (1 - easings.inOutSine(span01(t.f, HIGH_POOL.from, HIGH_POOL.to)))) };
  return [
    yours,
    { c: [newest + 70, cellY], z: [118, 170], sigma: [130, 40], rgb: tint(LIGHT_HEX.reading, 2.4 * t.tape.reading) },
    // the newest cell lights as each row inks, as act two's (beat4.ts cellLitAt, pools.ts)
    { c: [newest, cellY], z: [118, 140], sigma: [40, 30], rgb: tint(LIGHT_HEX.reading, 1.05 * cellLitAt(t.f)) },
    upper,
    high,
  ];
}
/** Your lamp's height band over act one's pool top (its hood and arm, up to 150 u): the pool's light comes up over it during the hit, before the loop's band rises into it. */
export const UPPER_POOL = { from: TURN.hit, to: TURN.edge + 2, top: 150 } as const;
/**
 * Above that, up to the loop's top while its face still turns up (under the lamp's elbow): its light goes, by amount over
 * 10 f, once the band's underside has risen clear of UPPER_POOL's top (the first frame it is, f1466), so no row of the band
 * is between the two pools while one of them fades (a gate at z 150 drew a hard line down the rising band); still out
 * before the coil comes up (TURN.coil), so the coil's top is never lit by it.
 */
export const HIGH_POOL: { readonly top: 210; readonly from: number; readonly to: number } = (() => {
  for (let f = TURN.edge; f < TURN.coil; f++) if (loopTurnAt(f).ribbon!.L.z >= UPPER_POOL.top) return { top: 210, from: f, to: f + 10 } as const;
  throw new Error('turn: the loop never rises clear of the upper pool');
})();
