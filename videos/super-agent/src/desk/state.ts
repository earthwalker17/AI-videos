/**
 * What the Register Desk is doing at a film frame: a pure function of the frame, so any frame
 * renders the same whichever frame its page started on.
 *
 * Around style frame (b) (C12 "Workers report up. Only the Router talks to you.") the handshake runs
 * in cause order (STORYBOARD 4.6, synthesis §5 MT1), all inside MT1 (f2140–2340):
 * - 2156 the test tower caps; 2160 (downbeat) its work light dims;
 * - 2163 its report card leaves the tower's dome and flies 18 f under the transit light, up into the
 *   deck's mouth (docked 2181);
 * - 2183 the print head drops: the report stamps in and its window cell (the newest, by the head)
 *   lights from 2185;
 * - 2200 (downbeat) the index arm turns west to you (spring-detent);
 * - 2202 the reply leaves the print head, citing the report, and rides the chute 22 f under the
 *   transit light; it lands in your in-tray at 2224 with a 3% squash; your lamp brightens a step at 2226.
 * Still B (lookdev/frames.ts) is f2210: the card docked, its cell lit, the arm west, the reply about
 * 30% down the chute. Only one carrier is in flight at a time, and it carries the one transit light.
 *
 * Focus (synthesis §2): during a beat, what is not part of its action steps down to 55% contrast and
 * 30% chroma over 14 f (`stepAt`). Easing uses the film's spring tokens, mass 1.
 */
import { clamp, easings } from '@aiv/core';
import { spring } from 'remotion';
import { BEAT, FPS } from '../cues.ts';
import { CARD, CHUTE, INDEX, LAMP, MOUTH, PINS, TOWER, towerTop, type P2, type P3 } from './layout.ts';

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
  armTurn: 2200,
  slipLeave: 2202,
  slipRide: 22,
  lampUp: 2226,
  /** the bug bay's pins flip one per beat from here (4 f each), cycling through the six */
  pinsFrom: 2120,
  pinFlip: 4,
} as const;

/** The angle (radians, from +x) of the index arm's detents: toward each party it can address. */
export const DETENT = {
  you: Math.atan2(-60 - INDEX.pivot[1], -520 - INDEX.pivot[0]),
  tests: Math.atan2(92 - INDEX.pivot[1], -210 - INDEX.pivot[0]),
  docs: Math.atan2(92 - INDEX.pivot[1], 230 - INDEX.pivot[0]),
  bug: Math.atan2(90 - INDEX.pivot[1], 530 - INDEX.pivot[0]),
} as const;

/** Your lamp's attention steps: the bulb's level and its pool (a step dimmer while you wait). */
export const LAMP_STEPS = { dim: 0.6, up: 0.85 } as const;

/** What steps down during a beat: everything not in its action. */
export type FocusId = 'intake' | 'gate' | 'belt' | 'plate' | 'fanfold' | 'policy' | 'docsBay' | 'bugBay' | 'cord';
/** Per-beat focus sets (film frames). C12's action is the handshake: tower, card, mouth, cell, arm, chute, slip, your desk. */
export const FOCUS_BEATS: readonly { id: string; from: number; to: number; step: readonly FocusId[] }[] = [
  { id: 'c12', from: 2130, to: 2266, step: ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'cord'] },
];
/** The step-down ramp, frames (synthesis: 12–16 f). */
export const STEP_FRAMES = 14;

export interface DeskState {
  f: number;
  /** the index arm's angle (radians) */
  arm: number;
  /** the reply slip: progress down the chute 0..1 (null before it leaves), and its landing squash 0..1 */
  slip: { s: number; squash: number } | null;
  /** your lamp's level (0..1 scale of its pool and bulb) */
  lamp: number;
  /** the report card in flight: arc progress 0..1, world position, pitch (null when not flying) */
  card: { s: number; pos: P3; pitch: number } | null;
  /** the card has docked in the deck's mouth (it stays there) */
  cardDocked: boolean;
  /** the print head's stamp 0..1 (down at 1) */
  stamp: number;
  /** the newest window cell, lit as the report stamps in (0..1) */
  cellLit: number;
  /** the one transit light: which carrier wears it, and how bright (0..1) */
  transit: { on: 'card' | 'slip' | null; level: number };
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

/** The card's flight: from the tower's dome up into the mouth, a parabolic arc `apex` above the chord. */
export const CARD_FROM: P3 = [TOWER.x, TOWER.y, towerTop() + TOWER.dome + 2];
export const CARD_TO: P3 = MOUTH.land;
export function cardArc(s: number): { pos: P3; pitch: number } {
  const u = clamp(s);
  const pos: P3 = [CARD_FROM[0] + (CARD_TO[0] - CARD_FROM[0]) * u, CARD_FROM[1] + (CARD_TO[1] - CARD_FROM[1]) * u, CARD_FROM[2] + (CARD_TO[2] - CARD_FROM[2]) * u + 4 * CARD.apex * u * (1 - u)];
  const run = Math.hypot(CARD_TO[0] - CARD_FROM[0], CARD_TO[1] - CARD_FROM[1]);
  const pitch = Math.atan2(4 * CARD.apex * (1 - 2 * u) + (CARD_TO[2] - CARD_FROM[2]), run);
  return { pos, pitch };
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

/** A carrier's transit light over a ride from 0 to 1: up in the first sixth, down in the last. */
const rideLight = (u: number): number => (u <= 0 || u >= 1 ? 0 : clamp(u * 6) * clamp((1 - u) * 6));

/** The state of the desk at film frame `f` (pure). */
export function deskStateAt(f: number): DeskState {
  const E = EVENTS_B;
  // the test tower finishes: cap, dim; its card flies up into the mouth and docks
  const testsCap = springAt(f, E.testsCap, SPRING.detent);
  const testsLight = 1 - springAt(f, E.testsDim, SPRING.effects);
  const fly = (f - E.cardEject) / E.cardFly;
  let card: DeskState['card'] = null;
  if (fly >= 0 && fly < 1) {
    const arc = cardArc(easings.inOutSine(fly));
    card = { s: easings.inOutSine(fly), pos: arc.pos, pitch: arc.pitch };
  }
  const cardDocked = fly >= 1;
  // stamp-in: the head drops 4 f, the newest cell lights (spring-effects)
  const stamp = clamp((f - E.stampIn) / 2) * (1 - clamp((f - E.stampIn - 4) / 3));
  const cellLit = springAt(f, E.stampIn + 2, SPRING.effects);
  // the index arm: from the test tower's detent to yours (west) on spring-detent
  const arm = DETENT.tests + (DETENT.you - DETENT.tests) * springAt(f, E.armTurn, SPRING.detent);
  // the reply rides the chute (a gravity ride: in and out), then lands with a 3% squash
  const ride = (f - E.slipLeave) / E.slipRide;
  const land = E.slipLeave + E.slipRide;
  const slip = f < E.slipLeave ? null : { s: easings.inOutSine(clamp(ride)), squash: f < land ? 0 : Math.max(0, 1 - (f - land) / 4) * (f - land < 2 ? (f - land) / 2 : 1) };
  // the one transit light rides the one carrier in flight
  const transit: DeskState['transit'] = card ? { on: 'card', level: rideLight(fly) } : slip && ride < 1 ? { on: 'slip', level: rideLight(ride) } : { on: null, level: 0 };
  // your lamp: one step dimmer until the reply has landed, then up one step on spring-effects
  const lamp = LAMP_STEPS.dim + (LAMP_STEPS.up - LAMP_STEPS.dim) * springAt(f, E.lampUp, SPRING.effects);

  // the bug bay's pins: one flips per beat, 4 f each, cycling round the six
  const pins = Array.from({ length: PINS.n }, (_, i) => {
    const sinceFrom = f - E.pinsFrom - i * BEAT;
    if (sinceFrom < 0) return 0;
    const cycle = PINS.n * BEAT;
    const k = sinceFrom % cycle;
    return Math.floor(sinceFrom / cycle) % 2 === 0 ? clamp(k / E.pinFlip) : 1 - clamp(k / E.pinFlip);
  });

  // the galley: a line of type takes two bars to set
  const galley = ((((f - 2000) % 160) + 160) % 160) / 160;

  return { f, arm, slip, lamp, card, cardDocked, stamp, cellLit, transit, testsLight, testsCap, bugLight: 1, pins, galley, step: stepAt(f) };
}

/** The slip's pose on the chute at progress s (lying in the trough, along its slope). */
export function slipPose(s: number): { p: P3; heading: number; slope: number } {
  const { p, dir } = polylineAt(CHUTE, s);
  const h = Math.hypot(dir[0], dir[1]);
  return { p, heading: Math.atan2(dir[1], dir[0]), slope: Math.atan2(dir[2], h) };
}

/** Your lamp's head points here; the pool centre follows the aim. */
export const LAMP_AIM: P2 = [LAMP.aim[0], LAMP.aim[1]];
