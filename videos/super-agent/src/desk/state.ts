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
import { spring } from 'remotion';
import { BEAT, FPS } from '../cues.ts';
import { CARD, CHUTE, DRAWER, INDEX, LAMP, MOUTH, PINS, TOWER, rectC, towerTop, type P2, type P3 } from './layout.ts';

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
  testsCap: 2156,
  testsDim: 2160,
  cardEject: 2163,
  cardFly: 18,
  stampIn: 2183,
  reelDetent: 2187,
  fold: 2189,
  foldFrames: 8,
  tabDrop: 2197,
  tabFrames: 6,
  armTurn: 2200,
  slipLeave: 2206,
  emergeFrames: 4,
  slipRide: 22,
  lampUp: 2234,
  /** the bug bay's pins flip one per beat from here (4 f each), cycling through the six */
  pinsFrom: 2120,
  pinFlip: 4,
} as const;
/** The reply starts riding once it has emerged, and lands at the end of its ride. */
export const SLIP_RIDE_FROM = EVENTS_B.slipLeave + EVENTS_B.emergeFrames;
export const SLIP_LANDS = SLIP_RIDE_FROM + EVENTS_B.slipRide;

/** The angle (radians, from +x) of the index arm's detents: toward each party it can address. */
export const DETENT = {
  you: Math.atan2(-60 - INDEX.pivot[1], -520 - INDEX.pivot[0]),
  tests: Math.atan2(139 - INDEX.pivot[1], -232 - INDEX.pivot[0]),
  docs: Math.atan2(139 - INDEX.pivot[1], 150 - INDEX.pivot[0]),
  bug: Math.atan2(90 - INDEX.pivot[1], 298 - INDEX.pivot[0]),
} as const;

/** Your lamp's attention steps: the bulb's level and its pool (a step dimmer while you wait). */
export const LAMP_STEPS = { dim: 0.62, up: 0.9 } as const;

/** What steps down during a beat: everything not in its action. */
export type FocusId = 'intake' | 'gate' | 'belt' | 'plate' | 'fanfold' | 'policy' | 'docsBay' | 'bugBay' | 'cord' | 'reel' | 'lock';
/**
 * Per-beat focus sets (film frames). C12's action is the handshake: the test tower, the card, the
 * mouth, the cell, the arm, the chute, the reply, your in-tray. The bug bay steps down too (its slot
 * keeps working and the request's vermilion stays), and so do the reel's face and the lock.
 */
export const FOCUS_BEATS: readonly { id: string; from: number; to: number; step: readonly FocusId[] }[] = [
  { id: 'c12', from: 2130, to: 2266, step: ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'cord', 'reel', 'lock'] },
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
  /** the test tower's cap: 0 open → 1 closed */
  testsCap: number;
  /** the bug bay's work slot (computing): 1 */
  bugLight: number;
  /** each of the bug bay's six pins: 0 graphite face up (not run) → 1 enamel face up (passed) */
  pins: number[];
  /** the docs galley: how far the current line is set (0..1) */
  galley: number;
  /** the focus step-down: how far it has gone (0..1) and what it applies to */
  step: { amount: number; ids: readonly FocusId[] };
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
  const cellLit = springAt(f, E.stampIn + 2, SPRING.effects);
  const reel = springAt(f, E.reelDetent, SPRING.detent);
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
  const lamp = LAMP_STEPS.dim + (LAMP_STEPS.up - LAMP_STEPS.dim) * springAt(f, E.lampUp, SPRING.effects);

  // the bug bay's pins: one flips per beat, 4 f each, cycling round the six
  const pins = Array.from({ length: PINS.n }, (_, i) => {
    const sinceFrom = f - E.pinsFrom - i * BEAT;
    if (sinceFrom < 0) return 0;
    const cycle = PINS.n * BEAT;
    const k = sinceFrom % cycle;
    return Math.floor(sinceFrom / cycle) % 2 === 0 ? clamp(k / E.pinFlip) : 1 - clamp(k / E.pinFlip);
  });
  const galley = ((((f - 2000) % 160) + 160) % 160) / 160;

  return { f, arm, slip, lamp, card, dock, stamp, cellLit, reel, transit, testsLight, testsCap, bugLight: 1, pins, galley, step: stepAt(f) };
}

/** The reply's pose: under the index sector while it emerges, then on the chute, turning along its exit curve. */
export function slipPose(s: number): { p: P3; heading: number; slope: number } {
  const { p, dir } = polylineAt(CHUTE, s);
  const h = Math.hypot(dir[0], dir[1]);
  return { p, heading: Math.atan2(dir[1], dir[0]), slope: Math.atan2(dir[2], h) };
}

/** Your lamp's head points here; the pool centre follows the aim. */
export const LAMP_AIM: P2 = [LAMP.aim[0], LAMP.aim[1]];
