/**
 * What the Register Desk is doing at a film frame, around style frame (b) (film f2200, C12 "Workers
 * report up. Only the Router talks to you."): a pure function of the frame, so any frame renders
 * the same whichever frame its page started on.
 *
 * This is lookdev's own small timeline (synthesis §4 (b) and §5 MT1), set so that f2200 is exactly
 * the still the spec describes:
 * - the index arm sits at its west detent: it turned to you at 2184 (6 f) and has just sent the reply;
 * - the reply slip left at 2186 and rides the chute for 22 f: 70% down at 2200; it lands in your
 *   in-tray at 2208 (3% squash), and your lamp brightens one step from 2210 (so at 2200 it is still
 *   one step dimmer);
 * - the test tower capped at 2187; its work light dims from 2192 (8 f into its dim at 2200); its
 *   report card ejected at 2190 and flies 18 f with its transit light: about 60% along at 2200;
 * - the bug bay computes (its work slot is lit) while its six test pins flip one per beat;
 * - the docs galley sets type under its clamped work light.
 * Easing uses the film's tokens (synthesis §2, Motion): springs from {stiffness, damping}, mass 1.
 */
import { clamp, easings } from '@aiv/core';
import { spring } from 'remotion';
import { BEAT, FPS } from '../cues.ts';
import { CARD, CHUTE, HOPPER, INDEX, LAMP, PINS, TOWER, towerTop, type P2, type P3 } from './layout.ts';

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

/** The lookdev events round f2200 (film frames). */
export const EVENTS_B = {
  armTurn: 2184,
  slipLeave: 2186,
  slipRide: 22,
  lampUp: 2210,
  testsCap: 2187,
  testsDim: 2192,
  cardEject: 2190,
  cardFly: 18,
  /** the bug bay's pins flip one per beat from here (4 f each), cycling through the six */
  pinsFrom: 2120,
  pinFlip: 4,
} as const;

/** The angle (radians, from +x) of the index arm's detents: toward each party it can address. */
export const DETENT = {
  you: Math.atan2(-150 - INDEX.pivot[1], -600 - INDEX.pivot[0]),
  bug: Math.atan2(-30 - INDEX.pivot[1], 130 - INDEX.pivot[0]),
  tests: Math.atan2(-40 - INDEX.pivot[1], 398 - INDEX.pivot[0]),
  docs: Math.atan2(-104 - INDEX.pivot[1], 728 - INDEX.pivot[0]),
} as const;

/** Your lamp's attention steps: the bulb's level and its pool (synthesis: a step dimmer while you wait). */
export const LAMP_STEPS = { dim: 0.55, up: 0.8 } as const;

export interface DeskState {
  f: number;
  /** the index arm's angle (radians) */
  arm: number;
  /** the reply slip: progress down the chute 0..1 (null before it leaves), and its landing squash 0..1 */
  slip: { s: number; squash: number } | null;
  /** your lamp's level (0..1 scale of its pool and bulb) */
  lamp: number;
  /** the report card: arc progress 0..1, its world position and pitch, its transit light 0..1 (null when docked or not out) */
  card: { s: number; pos: P3; pitch: number; light: number } | null;
  /** the card has landed in the Register's hopper (it stays there, its light off) */
  cardDocked: boolean;
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

/** The card's flight: from the tower cap up to the hopper, a parabolic arc `apex` above the chord. */
export const CARD_FROM: P3 = [TOWER.x, TOWER.y, towerTop() + 1];
export const CARD_TO: P3 = HOPPER.land;
export function cardArc(s: number): { pos: P3; pitch: number } {
  const u = clamp(s);
  const pos: P3 = [CARD_FROM[0] + (CARD_TO[0] - CARD_FROM[0]) * u, CARD_FROM[1] + (CARD_TO[1] - CARD_FROM[1]) * u, CARD_FROM[2] + (CARD_TO[2] - CARD_FROM[2]) * u + 4 * CARD.apex * u * (1 - u)];
  const run = Math.hypot(CARD_TO[0] - CARD_FROM[0], CARD_TO[1] - CARD_FROM[1]);
  // the slope of the arc: dz/ds over the horizontal run
  const pitch = Math.atan2(4 * CARD.apex * (1 - 2 * u) + (CARD_TO[2] - CARD_FROM[2]), run);
  return { pos, pitch };
}

/** The state of the desk at film frame `f` (pure). */
export function deskStateAt(f: number): DeskState {
  const E = EVENTS_B;
  // the index arm: from the bug bay's detent to yours (west) on spring-detent
  const turn = springAt(f, E.armTurn, SPRING.detent);
  const arm = DETENT.bug + (DETENT.you - DETENT.bug) * turn;

  // the reply slip rides the chute (a gravity ride: in and out), then lands with a 3% squash
  const ride = (f - E.slipLeave) / E.slipRide;
  const land = E.slipLeave + E.slipRide;
  const slip = f < E.slipLeave ? null : { s: easings.inOutSine(clamp(ride)), squash: f < land ? 0 : Math.max(0, 1 - (f - land) / 4) * (f - land < 2 ? (f - land) / 2 : 1) };

  // your lamp: one step dimmer until the reply has landed, then up one step on spring-effects
  const lamp = LAMP_STEPS.dim + (LAMP_STEPS.up - LAMP_STEPS.dim) * springAt(f, E.lampUp, SPRING.effects);

  // the test tower: cap, dim, eject; the card flies 18 f (in-out), its transit light on while it flies
  const testsCap = springAt(f, E.testsCap, SPRING.detent);
  const testsLight = 1 - springAt(f, E.testsDim, SPRING.effects);
  const fly = (f - E.cardEject) / E.cardFly;
  let card: DeskState['card'] = null;
  if (fly >= 0 && fly < 1) {
    const s = easings.inOutSine(fly);
    const arc = cardArc(s);
    card = { s, pos: arc.pos, pitch: arc.pitch, light: clamp(fly * 6) * clamp((1 - fly) * 6) };
  }

  // the bug bay's pins: one flips per beat, 4 f each, cycling round the six
  const pins = Array.from({ length: PINS.n }, (_, i) => {
    const sinceFrom = f - E.pinsFrom - i * BEAT;
    if (sinceFrom < 0) return 0;
    const cycle = PINS.n * BEAT;
    const k = sinceFrom % cycle;
    // passed after its flip, reset when the cycle comes round (all six face up at the end of a run)
    return Math.floor(sinceFrom / cycle) % 2 === 0 ? clamp(k / E.pinFlip) : 1 - clamp(k / E.pinFlip);
  });

  // the galley: a line of type takes two bars to set
  const galley = (((f - 2000) % 160) + 160) % 160 / 160;

  const cardDocked = fly >= 1;

  return { f, arm, slip, lamp, card, cardDocked, testsLight, testsCap, bugLight: 1, pins, galley };
}

/** The slip's pose on the chute at progress s (lying in the trough, along its slope). */
export function slipPose(s: number): { p: P3; heading: number; slope: number } {
  const { p, dir } = polylineAt(CHUTE, s);
  const h = Math.hypot(dir[0], dir[1]);
  return { p, heading: Math.atan2(dir[1], dir[0]), slope: Math.atan2(dir[2], h) };
}

/** Your lamp's head points here; the pool centre follows the aim. */
export const LAMP_AIM: P2 = [LAMP.aim[0], LAMP.aim[1]];
