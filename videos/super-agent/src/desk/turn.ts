/**
 * The turn (MT2, film f1400–1660; STORYBOARD 3.3–4.2, synthesis §5 MT2): the routing job lifts off
 * your desk and becomes the Register. One object becomes another by physical means only:
 * - the notes loop dips, lifts, turns on edge and coils into a reel, Fix A's tape winding onto it
 *   (grey stock turning to paper as it leaves the desk); the coil glides over the deck, descends and
 *   locks on the detent;
 * - the eight folders (and Fix A's) are pressed into the desk: the imprints under the deck;
 * - your desk slides south-west to its act-two place and the lamp narrows (its bulb back in the hood);
 * - the deck rolls in collapsed from the north (once the folders are under the slate) and its legs
 *   telescope up (3 f stagger); the parts it carries stowed move into place: the throat rises under its
 *   west end, the print head hinges up, the index arm and the loupe swing in, the ramp lowers like a
 *   drawbridge, the chute hinges down to your in-tray and its posts telescope to the desk;
 * - Fix B's replies leave your in-tray for their trays, and each tray grows walls and a nameplate
 *   band: the bays; nothing fires at you again;
 * - the intake drops in (the gate, the belt, the spool); mail and calendar press flat into vellum;
 * - the tape's leader runs out of the head under the window, the first chat slip rides the belt
 *   into the throat (f1620) and its row prints (f1624, a mark: design D2); the Continuous plate docks
 *   on the deck (f1640, `trait-continuous`).
 *
 * Every value is a pure function of the film frame (springs on the synthesis's tokens, the move
 * and enter curves). The schedule's order is tested (turn.test.ts): nothing acts before its cause.
 */
import { clamp } from '@aiv/core';
import { Easing, spring } from 'remotion';
import { FPS, cue } from '../cues.ts';
import { ACT_ONE_END, BULB_A, FOLDERS, LOOP_A, YOU_C_A, YOU_SHIFT_A, actOneAt, youPoseA, type ActOneState, type LoopPose } from './actOne.ts';
import { A_ITEMS, A_LEN, A_LIFT, A_PITCH, A_TAPE_W, B_SLIP, FIX_A_FOLDER, IN_TRAY_A_C, IN_TRAY_PILE, TRAYS, TRAY_Z, aPathAt, type AItem } from './beat3.ts';
import { circleFp, rectFp, registerFootprints, segFp, shiftFootprints, youFootprints, type Footprint } from './footprints.ts';
import { CELLS_X, CHUTE, DECK, FEEDERS, FEEDER_H, GATE, BELT, LAMP, LEG_R, LEG_STRUTS, NEXT_SLIP, REEL, SPOOL, TAPE, YOU, rectC, type P2, type P3, type Pool } from './layout.ts';
import { EMIT, LIGHT_HEX, tint } from './pools.ts';
import { LAMP_AIM, LAMP_STEPS, SPRING, deskStateAt, springAt, type DeskState } from './state.ts';
import { LAMP_FOOT_Z, YOU_POSE_B, lampElbow, type YouPose } from './you.ts';

/** The span the turn poses (MT2's: lookdev/frames.ts). Before it, act one; from its end, act two's world. */
export const TURN_SPAN: readonly [number, number] = [ACT_ONE_END, 1660];

/** The synthesis's curves: move (.2, 0, 0, 1) and enter (.05, .7, .1, 1). */
const MOVE = Easing.bezier(0.2, 0, 0, 1);
/** The deck rolls in on an in-out curve (heavy: it gathers speed, then brakes), so it reaches the folders' row only once they are pressed. */
const ROLL = Easing.bezier(0.45, 0, 0.2, 1);
const ENTER = Easing.bezier(0.05, 0.7, 0.1, 1);
const span01 = (f: number, a: number, b: number): number => clamp((f - a) / (b - a));

/** A spring on one of the synthesis's tokens, stretched to land over `dur` frames (0 before `start`). */
export function springOver(f: number, start: number, dur: number, config: (typeof SPRING)[keyof typeof SPRING]): number {
  return f <= start ? 0 : spring({ frame: f - start, fps: FPS, config: { ...config, overshootClamping: false }, durationInFrames: dur });
}

/**
 * The schedule (film frames). The turn hit is bar 19's downbeat (cues.ts `turn`); the Continuous
 * plate docks on `trait-continuous`.
 */
export const TURN = {
  /** 3.3: Fix A's queue moves one station on the beat; Fix B's last reply is posted (3 f anticipation, a 14 f arc) */
  advance: 1400,
  advanceFrames: 10,
  bPost: 1394,
  bArc: 14,
  /** everything stills, pens lifted (4 f): 20 f of stillness before the hit */
  still: 1420,
  hit: cue('turn').frame,
  /** the loop: a 2% dip (4 f), the lift on spring-heavy to h 160, the tabs fold flat, the ribbon turns on edge and rounds, then coils in to the hub */
  dipFrames: 4,
  rise: 1444,
  riseEnd: 1520,
  fold: 1444,
  foldFrames: 12,
  edge: 1452,
  edgeEnd: 1500,
  coil: 1494,
  coilEnd: 1522,
  hub: 1512,
  hubFrames: 14,
  /** the folders pressed into the desk, Fix A's first then F1..F8, 2 f apart: all are under the slate before the deck rolls over them */
  press: 1442,
  pressStagger: 2,
  pressFrames: 16,
  /** your desk slides south-west; the lamp narrows */
  slide: 1460,
  slideEnd: 1540,
  /** the deck rolls in collapsed from the north, then its legs telescope (3 f stagger) */
  deckIn: 1458,
  deckInEnd: 1492,
  legs: 1490,
  legStagger: 3,
  legFrames: 30,
  /** the stowed parts move into place, 3 f apart (structure on spring-settle, arms on spring-detent): throat, head, index arm, loupe; then the ramp and the chute */
  parts: 1530,
  partFrames: 16,
  chute: 1560,
  ramp: 1552,
  /** Fix B: the replies leave your in-tray (top of the pile first, 3 f apart; 3 f anticipation, a 22 f arc), each tray's walls rise 6 f after its reply lands */
  replies: 1488,
  replyStagger: 3,
  replyArc: 22,
  wallsAfter: 6,
  wallFrames: 30,
  /**
   * Fix A's tape winds onto the coil while it is still south of the deck (so the tape never passes through it), then
   * the coil glides on over the deck (east first, then north), descends and locks
   */
  wind: 1504,
  windEnd: 1556,
  glide: 1520,
  glideEnd: 1600,
  descend: 1600,
  lock: 1616,
  detent: 1604,
  jewel: 1618,
  /** the intake drops in (spring-heavy); mail and calendar press flat into vellum */
  gate: 1568,
  belt: 1572,
  spool: 1580,
  dropFrames: 22,
  mail: 1602,
  calendar: 1608,
  flattenFrames: 18,
  /** the leader out of the head; the first chat slip: posted, rides the belt, enters the throat, fed to the head, printed */
  leader: 1588,
  leaderEnd: 1612,
  post: 1595,
  postArc: 12,
  ride: 1610,
  throat: 1620,
  feedFrames: 3,
  print: 1624,
  /** the Continuous plate docks */
  plate: cue('trait-continuous').frame,
  /** labels: "you · 你" re-enters once the camera has settled; "Router" 2 f after the lock */
  youLabel: 1604,
  routerLabel: 1618,
} as const;

/** How high the loop lifts, and the reel it becomes. */
export const LIFT_H = 160;
/** The ribbon rounds to this radius on edge, then coils in to the hub; Fix A's tape winds it out to the pack's radius. */
export const COIL_R0 = 70;
/** The collapsed deck: everything on it this far down, and this far north while it rolls in. */
export const DECK_LOW = 80;
export const DECK_NORTH = 560;
/**
 * The parts ride in with the deck, stowed: the throat lowered under the deck's west end, the head lying flat (hinged
 * at its west edge), the index arm and the loupe parked, the ramp and the chute raised; then each moves into place.
 */
export const STOW = { throat: -42, head: Math.PI / 2, index: 1.9, loupe: -1.4, ramp: (-2 * Math.PI) / 3, chute: 0.62, plate: Math.PI } as const;
/** The intake drops in from this high (it is not the deck's: it lands on the desk). */
export const DROP_H = 90;

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
  /** the ribbon while it is one (null once it has coiled) */
  ribbon: { L: LoopPose; h: number; edge: number; fold: number } | null;
  coil: CoilState | null;
  /** the clip still shows (A's tape has not wound over it) */
  clip: boolean;
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

/** The coil's centre: from the loop's centre over the deck to the reel (x leads, y follows: it passes clear of the reading lamp's post). */
function glideAt(f: number): P2 {
  const ex = MOVE(span01(f, TURN.glide, TURN.glideEnd - 8));
  const ey = ROLL(span01(f, TURN.glide + 20, TURN.glideEnd));
  return [YOU_C_A[0] + (REEL.x - YOU_C_A[0]) * ex, YOU_C_A[1] + (REEL.y - YOU_C_A[1]) * ey];
}

const PACK_H = REEL.packZ[1] - REEL.packZ[0];
export function loopTurnAt(f: number): LoopTurn {
  const dip = f < TURN.hit ? 0 : Math.sin(Math.PI * span01(f, TURN.hit, TURN.hit + 2 * TURN.dipFrames));
  const edge = springOver(f, TURN.edge, TURN.edgeEnd - TURN.edge, SPRING.heavy);
  const coilK = springOver(f, TURN.coil, TURN.coilEnd - TURN.coil, SPRING.heavy);
  const c = glideAt(f);
  const lift = liftAt(f);
  const descend = MOVE(span01(f, TURN.descend, TURN.lock));
  const h = f < TURN.descend ? lift : LIFT_H + (REEL.packZ[0] - LIFT_H) * descend;
  // the ribbon: a 2% dip, then it rounds from act one's superellipse to the coil's circle as it turns on edge
  const k = 1 - 0.02 * dip;
  const round = Math.min(edge, 1);
  const L: LoopPose = {
    ...LOOP_A,
    c,
    a: (LOOP_A.a + (COIL_R0 - LOOP_A.a) * round) * k,
    b: (LOOP_A.b + (COIL_R0 - LOOP_A.b) * round) * k,
    n: LOOP_A.n + (2 - LOOP_A.n) * round,
    z: LOOP_A.z + h,
  };
  const fold = MOVE(span01(f, TURN.fold, TURN.fold + TURN.foldFrames));
  const wound = woundAt(f) - A_PITCH;
  const windK = clamp(wound / (A_TAPE_LEN - A_PITCH));
  const rOut = Math.sqrt(COIL_R0 * COIL_R0 + (REEL.packR * REEL.packR - COIL_R0 * COIL_R0) * windK);
  // the detent at the lock: the last 0.26 rad of the turn on spring-detent
  const spin = 6 * Math.PI * transport(span01(f, TURN.coil, TURN.windEnd)) - 0.26 * (1 - springAt(f, TURN.detent, SPRING.detent));
  const coil: CoilState | null =
    f < TURN.coil
      ? null
      : {
          c,
          h,
          rIn: COIL_R0 - 0.75 - (COIL_R0 - 0.75 - REEL.hubR) * coilK,
          rOut: rOut + 0.75 * (1 - windK),
          t: A_TAPE_W + (PACK_H - A_TAPE_W) * coilK,
          spin: f >= TURN.lock + 6 ? 0 : spin,
          hub: MOVE(span01(f, TURN.hub, TURN.hub + TURN.hubFrames)),
          spokes: MOVE(span01(f, TURN.hub + TURN.hubFrames - 2, TURN.hub + TURN.hubFrames + 10)),
          stock: springAt(f, TURN.coil, SPRING.effects),
        };
  return { ribbon: f < TURN.coil ? { L, h, edge, fold } : null, coil, clip: f < TURN.glide + 8 };
}

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

/** Where Fix A's tape meets the loop or the coil: its centreline point facing the lift-off, at the ribbon's height. */
function attachAt(f: number, lt: LoopTurn): { p: P3; w: P3 } {
  if (lt.ribbon) {
    const { L, h, edge } = lt.ribbon;
    const t = Math.atan2((A_LIFT[1] - L.c[1]) / L.b, (A_LIFT[0] - L.c[0]) / L.a);
    const c = Math.cos(t);
    const s = Math.sin(t);
    const e = 2 / L.n;
    const x = L.c[0] + L.a * Math.sign(c) * Math.abs(c) ** e;
    const y = L.c[1] + L.b * Math.sign(s) * Math.abs(s) ** e;
    const out = norm([x - L.c[0], y - L.c[1], 0]);
    const th = (edge * Math.PI) / 2;
    return { p: [x + out[0] * (A_TAPE_W / 2) * Math.cos(th), y + out[1] * (A_TAPE_W / 2) * Math.cos(th), h + LOOP_A.z + 0.6 + (A_TAPE_W / 2) * Math.sin(th)], w: norm([out[0] * Math.cos(th), out[1] * Math.cos(th), Math.sin(th)]) };
  }
  const C = lt.coil!;
  const d = norm([A_LIFT[0] - C.c[0], A_LIFT[1] - C.c[1], 0]);
  void f;
  return { p: [C.c[0] + d[0] * C.rOut, C.c[1] + d[1] * C.rOut, C.h + C.t / 2], w: [0, 0, 1] };
}

export function fixATurnAt(f: number, lt: LoopTurn): FixATurn {
  const wound = woundAt(f);
  const at = attachAt(f, lt);
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
// Fix B: the replies, the trays' walls

export interface FixBTurn {
  /** each reply slip k (from tray k): its centre, turn, tilt, and how far it has turned to paper */
  slips: { p: P3; rot: number; tilt: number; paper: number }[];
  /** each tray's walls (0..1 of their height) and how built it is (grey stock to graphite and enamel, 0..1) */
  walls: number[];
  built: number[];
}

const IN_TRAY_Z = YOU.top + 3;
/** Slip k leaves your in-tray (top of the pile first). */
export const replyLeaves = (k: number): number => TURN.replies + TURN.replyStagger * (7 - k);
export const replyLands = (k: number): number => replyLeaves(k) + 3 + TURN.replyArc;
export const wallsRise = (k: number): number => replyLands(k) + TURN.wallsAfter;

function inTraySlot(k: number, shift: P2): P3 {
  const o = IN_TRAY_PILE[k].o;
  return [IN_TRAY_A_C[0] - YOU_SHIFT_A[0] + shift[0] + o[0], IN_TRAY_A_C[1] - YOU_SHIFT_A[1] + shift[1] + o[1], IN_TRAY_Z + 0.9 * k];
}
const trayRest = (k: number): P3 => [TRAYS[k].c[0] + 16, TRAYS[k].c[1] - 6, TRAY_Z.floor + 0.6];

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
    // 3 f anticipation (it lifts 4 u), then a 22 f arc home (apex 70), landing on its tray's floor
    const from = inTraySlot(k, shiftAt(leave + 3));
    const to = trayRest(k);
    if (f < leave + 3) {
      const a = inTraySlot(k, shiftAt(f));
      return { p: [a[0], a[1], a[2] + 4 * MOVE((f - leave) / 3)] as P3, rot: pile.rot, tilt: 0, paper: 0 };
    }
    const u = clamp((f - leave - 3) / TURN.replyArc);
    const e = Math.sin((u * Math.PI) / 2) ** 2;
    const p: P3 = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, from[2] + 4 + (to[2] - from[2] - 4) * e + 4 * 70 * u * (1 - u)];
    const homeRot = 0.08 * (k % 2 ? 1 : -1) + Math.PI / 2;
    return { p, rot: pile.rot + (homeRot - pile.rot) * e, tilt: 0.25 * Math.sin(u * Math.PI), paper: springAt(f, wallsRise(k), SPRING.effects) };
  });
  const walls = TRAYS.map((_, k) => springOver(f, wallsRise(k), TURN.wallFrames, SPRING.heavy));
  const built = TRAYS.map((_, k) => springAt(f, wallsRise(k), SPRING.effects));
  return { slips, walls, built };
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
  /** the throat's height (0 seated), the head's hinge, the index arm's and the loupe's swing, the ramp's and the chute's hinge (radians, 0 in place) */
  throat: number;
  head: number;
  index: number;
  loupe: number;
  ramp: number;
  chute: number;
  /** the chute's posts telescoped down to the desk (0..1) */
  posts: number;
  /** the Continuous plate turned over (radians, 0 face up: it rides in face down) */
  plate: number;
}

/** The order the legs telescope (south-west, south-east, north-west, north-east: the side nearest the camera first). */
const LEG_ORDER = [0, 1, 2, 3];
export function deckTurnAt(f: number): DeckTurn {
  const roll = ROLL(span01(f, TURN.deckIn, TURN.deckInEnd));
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
    chute: into(f, TURN.chute, STOW.chute),
    posts: springOver(f, TURN.chute + TURN.partFrames - 4, 10, SPRING.settle),
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

/** Each leg: its foot (on the desk, rolling with the deck) and its top under the rail's corner. */
export function legsAt(d: DeckTurn): { foot: P3; top: P3 }[] {
  return LEG_STRUTS.map((l) => ({ foot: [l.foot[0], l.foot[1] + d.dy, 0] as P3, top: deckPoint(d, l.top) }));
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

export function youPoseTurn(f: number): YouPose {
  const m = slideAt(f);
  const A = youPoseA(heldActOne(f));
  const inTray = { inTray: true, inTraySlip: false } as const;
  if (m >= 0.9995) return { ...YOU_POSE_B, ...inTray };
  if (m <= 0) return { ...A, ...inTray };
  const mix = (a: P3, b: P3): P3 => lerp3(a, b, m);
  const head = mix(A.lamp.head, LAMP.head);
  const aim = mix(A.lamp.aim, LAMP.aim);
  const foot: P3 = [LAMP.base[0], LAMP.base[1], LAMP.base[2] + LAMP_FOOT_Z];
  const poleA = sub(A.lamp.elbow, foot);
  const poleB = sub(LAMP.elbow, foot);
  const elbow = lampElbow(LAMP.base, head, mix(poleA, poleB));
  return {
    shift: shiftAt(f),
    lamp: { base: LAMP.base, elbow, head, aim },
    bulb: BULB_A.level + (EMIT.bulbMax * LAMP_STEPS.dim - BULB_A.level) * m,
    bulbOut: BULB_A.out * (1 - m),
    strut: 'tray',
    held: { key: 1, glass: 1, strut: 1 },
    ...inTray,
  };
}

// ------------------------------------------------------------------------------------------------
// The intake, the first slip, the tape's leader, the stamp

export interface IntakeTurn {
  /** the spool, gate and belt dropping in (u above their seats; null: not yet there) */
  spool: number | null;
  gate: number | null;
  belt: number | null;
  /** mail and calendar: generic (0) pressed flat into vellum (1) */
  mail: number;
  calendar: number;
}
const drop = (f: number, start: number): number | null => (f < start ? null : DROP_H * (1 - springOver(f, start, TURN.dropFrames, SPRING.heavy)));
export function intakeTurnAt(f: number): IntakeTurn {
  return {
    spool: drop(f, TURN.spool),
    gate: drop(f, TURN.gate),
    belt: drop(f, TURN.belt),
    mail: springOver(f, TURN.mail, TURN.flattenFrames, SPRING.heavy),
    calendar: springOver(f, TURN.calendar, TURN.flattenFrames, SPRING.heavy),
  };
}

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
  /** the leader laid so far from the head east (0..1 of the flat run), the run's print */
  leader: number;
  print: 'blank' | 'first';
  /** the print head's hammer (0..1) and the newest cell's light */
  hammer: number;
  cellLit: number;
  /** the reading lamp's pool (light is attention: it comes on when the Register first reads) */
  reading: number;
  jewel: number;
}
export function registerTapeAt(f: number): RegisterTape {
  return {
    leader: transport(span01(f, TURN.leader, TURN.leaderEnd), 0.2),
    print: f >= TURN.print + 1 ? 'first' : 'blank',
    hammer: clamp((f - TURN.print) / 1.5) * (1 - clamp((f - TURN.print - 4) / 2)),
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
export function labelsTurnAt(f: number): { you: LabelReveal | null; router: LabelReveal | null } {
  return { you: reveal(f, TURN.youLabel), router: reveal(f, TURN.routerLabel) };
}

// ------------------------------------------------------------------------------------------------
// The whole state

export interface TurnState {
  f: number;
  act: ActOneState;
  /** each act-one folder pressed into the desk (0..1, FOLDERS order), and Fix A's */
  press: number[];
  pressA: number;
  you: YouPose;
  loop: LoopTurn;
  fixA: FixATurn;
  fixB: FixBTurn;
  deck: DeckTurn;
  parts: PartsTurn;
  intake: IntakeTurn;
  slip: SlipTurn | null;
  tape: RegisterTape;
  labels: { you: LabelReveal | null; router: LabelReveal | null };
}

export const pressStart = (i: number): number => TURN.press + TURN.pressStagger * i;
export function turnAt(f: number): TurnState {
  const press = [0, ...FOLDERS.map((_, i) => i + 1)].map((i) => springOver(f, pressStart(i), TURN.pressFrames, SPRING.heavy));
  const loop = loopTurnAt(f);
  return {
    f,
    act: heldActOne(f),
    pressA: press[0],
    press: press.slice(1),
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
  };
}

/** The desk state the act-two objects read during the turn: act two's rest (nothing of (b)'s handshake has happened), no focus step-down. */
export function turnDeskState(f: number): DeskState {
  return { ...deskStateAt(f), step: { amount: 0, ids: [] } };
}

/** Each imprint's depth (beat3.ts IMPRINTS order: F1..F8, then Fix A's). */
export const imprintsAt = (t: TurnState): number[] => [...t.press, t.pressA];

// ------------------------------------------------------------------------------------------------
// Light: the frame's footprints and pools

/** How deep a folder sinks when it is pressed in (below the desk it casts nothing). */
export const PRESS_DEPTH = 70;

export function turnFootprints(t: TurnState): Footprint[] {
  const fp: Footprint[] = [...youFootprints(t.you)];
  const a = t.act;
  // the folders, sinking (their pens and flags with them)
  FOLDERS.forEach((fl, i) => {
    const s = a.folders[i];
    if (s.present <= 0 || t.press[i] >= 1) return;
    const own: Footprint[] = [{ kind: 'rect', c: fl.c, h: [fl.w / 2, fl.d / 2], r: 3, rot: fl.rot, z0: 0, z1: 1.2 + fl.sheets * 0.8 - 0.1, contact: 0.8 }];
    fp.push(...shiftFootprints(own, -PRESS_DEPTH * t.press[i]));
  });
  if (t.pressA < 1) fp.push(...shiftFootprints([{ kind: 'rect', c: FIX_A_FOLDER.c, h: [FIX_A_FOLDER.w / 2, FIX_A_FOLDER.d / 2], r: 3, rot: FIX_A_FOLDER.rot, z0: 0, z1: 1.2 + FIX_A_FOLDER.sheets * 0.8, contact: 0.8 }], -PRESS_DEPTH * t.pressA));
  // the feeders
  fp.push(circleFp(rectC(FEEDERS.chat), (FEEDERS.chat.y1 - FEEDERS.chat.y0) / 2, 0, FEEDER_H.chat, 1));
  fp.push(rectFp(FEEDERS.ci, 0, FEEDER_H.ci, 1, 8));
  if (t.intake.mail < 1) fp.push(rectFp(FEEDERS.mail, 0, 30 * (1 - t.intake.mail), 1, 6));
  if (t.intake.calendar < 1) fp.push(rectFp(FEEDERS.calendar, 0, 18 * (1 - t.intake.calendar), 1, 6));
  if (t.intake.spool !== null) fp.push(circleFp([SPOOL.x, SPOOL.y], SPOOL.r, t.intake.spool, SPOOL.z[1] + t.intake.spool, 1));
  if (t.intake.gate !== null) fp.push(rectFp(GATE.bar, t.intake.gate, GATE.h + t.intake.gate, 1, 3));
  if (t.intake.belt !== null) fp.push(segFp([BELT.from[0], BELT.from[1], BELT.from[2] + t.intake.belt], [BELT.to[0], BELT.to[1], BELT.to[2] + t.intake.belt], BELT.w / 2));
  // the heap's footprint is act one's (the request with it)
  // the loop or the coil
  const lt = t.loop;
  if (lt.ribbon) {
    const { L, h } = lt.ribbon;
    for (let i = 0; i < 16; i++) {
      const p = loopAt(L, (i / 16) * Math.PI * 2);
      const q = loopAt(L, ((i + 1) / 16) * Math.PI * 2);
      fp.push(segFp([p[0], p[1], L.z], [q[0], q[1], L.z], 10));
    }
    void h;
  }
  if (lt.coil) fp.push(circleFp(lt.coil.c, lt.coil.rOut, lt.coil.h, lt.coil.h + lt.coil.t, 0.6));
  // Fix A: the tape (a thin line of shadow), its folder, the items on the desk, the span
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
  // Fix B: the trays (their walls as they rise), the replies
  TRAYS.forEach((tr, k) => {
    const hz = TRAY_Z.rim + (tr.wall - TRAY_Z.rim) * t.fixB.walls[k];
    fp.push({ kind: 'rect', c: tr.c, h: [tr.w / 2, tr.d / 2], r: 3, rot: 0, z0: 0, z1: hz, contact: 1 });
  });
  t.fixB.slips.forEach((s) => fp.push({ kind: 'rect', c: [s.p[0], s.p[1]], h: [B_SLIP.l / 2, B_SLIP.w / 2], r: 2, rot: s.rot, z0: s.p[2] - 0.4, z1: s.p[2] + 0.4, contact: s.p[2] < YOU.top + 8 ? 0.4 : 0 }));
  // the Register: present once it rolls into the frame, posed with the deck; its legs as they telescope
  if (t.f >= TURN.deckIn) {
    const d = t.deck;
    for (const l of legsAt(d)) {
      fp.push(segFp(l.top, l.foot, LEG_R));
      fp.push(circleFp([l.foot[0], l.foot[1]], 14, 0, 4, 1));
    }
    const reg = registerFootprints({ legs: false, fanfold: false });
    for (const r of reg) {
      if (r.kind === 'rect' || r.kind === 'circle') fp.push({ ...r, c: [r.c[0], r.c[1] + d.dy], z0: Math.max(0, r.z0 + d.dz), z1: Math.max(0.5, r.z1 + d.dz) });
      else if (r.kind === 'seg') fp.push({ ...r, a: [r.a[0], r.a[1] + d.dy], b: [r.b[0], r.b[1] + d.dy], ha: Math.max(0, r.ha + d.dz), hb: Math.max(0, r.hb + d.dz) });
      else fp.push({ ...r, c: [r.c[0], r.c[1] + d.dy], z: r.z + d.dz });
    }
  }
  if (t.parts.chute < 0.05) for (let i = 1; i < CHUTE.length; i++) fp.push(segFp(CHUTE[i - 1], CHUTE[i], 12));
  if (t.slip) fp.push({ kind: 'rect', c: [t.slip.p[0], t.slip.p[1]], h: [NEXT_SLIP.l / 2, NEXT_SLIP.w / 2], r: 2, rot: t.slip.heading, z0: t.slip.p[2] - 0.4, z1: t.slip.p[2] + 0.4, contact: 0 });
  return fp.slice(0, 128);
}

/** A point of a loop pose (as actOne.ts loopPoint). */
function loopAt(L: LoopPose, t: number): P2 {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const e = 2 / L.n;
  return [L.c[0] + L.a * Math.sign(c) * Math.abs(c) ** e, L.c[1] + L.b * Math.sign(s) * Math.abs(s) ** e];
}

/** The pools: your lamp's (from the folder it attended to your in-tray, as the lamp narrows), the Register's reading lamp and its newest cell once it reads. */
export function turnPools(t: TurnState): Pool[] {
  const m = slideAt(t.f);
  const A = t.act.lamp.aim;
  const mix = (a: number, b: number) => a + (b - a) * m;
  const yourA = tint(LIGHT_HEX.yours, 0.85);
  const yourB = tint(LIGHT_HEX.yours, 4.2 * LAMP_STEPS.dim);
  const cellY = (TAPE.y0 + TAPE.y1) / 2;
  const newest = (CELLS_X[0][0] + CELLS_X[0][1]) / 2;
  return [
    { c: [mix(A[0], LAMP_AIM[0]), mix(A[1], LAMP_AIM[1])], z: [0, mix(60, 140)], sigma: [mix(64, 74), mix(76, 66)], rgb: [mix(yourA[0], yourB[0]), mix(yourA[1], yourB[1]), mix(yourA[2], yourB[2])] },
    { c: [newest + 70, cellY], z: [118, 170], sigma: [130, 40], rgb: tint(LIGHT_HEX.reading, 2.4 * t.tape.reading) },
    { c: [newest, cellY], z: [118, 140], sigma: [40, 30], rgb: tint(LIGHT_HEX.reading, 1.6 * t.tape.cellLit) },
  ];
}
