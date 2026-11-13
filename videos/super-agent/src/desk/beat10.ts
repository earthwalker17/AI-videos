/**
 * Beat 10 (STORYBOARD 10.1-10.3, film f4960-5439; cues.ts BEAT_10): still open, and bar 68's handshake, whose stillness
 * holds the seam into the summary's world (summary.ts SEAM_D).
 * - 10.1: in the two beats' silence a hatched chat slip (45° graphite strokes, 2 px at an 8 px pitch at 0.64x) slides out
 *   of the chat spout, is posted over the gate on MT1's line (clear of the docked key: no tick) and glides up the belt into
 *   the throat, reaching the Register on `hatch.register`, fed on into the head. The etch spreads from it over the vellum:
 *   the loop's sheet and the plan of the deck, then each tether from its port, reaching one machine per beat on `etch`
 *   (its clip and its top hatched, its gloss killed); then it recedes and a pencil "?" settles beside the tethers on
 *   `query` (still (d)'s QUERIES[0]) and stays.
 * - 10.2 (N9, bar 65's dolly onto the Register): in pencil the Register splits (the crack across the reel, a "?" on its
 *   west half), its tape tears, and a second reading window (vellum, the shard's) is fed out of the print head over the
 *   real one and slides south beside it, its record cell a № behind the real one's: the two disagree; Fix A's and Fix B's grey-stock cards rise either side,
 *   hold about 20 f and slide away from `cards.exit` (no strike); the reel's outer windings go to pencil with a "?"; then
 *   the shard's window fades where it lies (SHARD_WINDOW).
 * - 10.3 (N10): your lamp reaches for the docs bay (a running bay just beyond it) and falls short; a pencil handle
 *   outline and "?" are drawn where its handle would be; the lamp comes home. Bar 68: the request's bay finishes (MT1's
 *   handshake, compressed): its pins stop and drop, then pass one by one; its report card #0405 rises out of the work
 *   slit and flies to the mouth under the transit light, docking on `stampIn`, and is taken in under the deck; the bay's
 *   cap rises out of its slot block and swings shut over the slit as its work light dies (still (d)'s cap, objects/Trace.tsx);
 *   the stuck bay's light goes out as the request completes; the index turns to the bay, then west on `indexWest`; the
 *   reply #0405 rides the chute and lands in your in-tray on `replyLands` exactly where still (d) lays it (objects/Trace.tsx);
 *   the bays and the Thread cord step down; then nothing moves into the seam.
 * The pencil and vellum parts are drawn by objects/Proposed.tsx (proposed10's state, through beat9.ts proposedAt); the
 * movers by objects/Beat10.tsx. Import rule as beat7.ts's: module-level tables from leaf modules only.
 */
import { clamp, easings } from '@aiv/core';
import { BEAT_10 } from '../cues.ts';
import { cardAt, type CardSpot, type CardUp } from './beat4.ts';
import { carrierSpan, type Footprint } from './fpKit.ts';
import { CARD, CARD_C, DECK, FEEDERS, MOUTH, NEXT_SLIP, YOU, rectC, type P3, type Pool } from './layout.ts';
import { FRAMING_D, deskCamera, project, screenToDesk } from './camera.ts';
import type { TagSpec } from './Overlay.tsx';
import { CRAWL, ETCH, LOOP_SHEET, MACHINES_9, SEAM, lerp, sine, trapezoid } from './proposed.ts';
import { SPRING, springAt } from './springs.ts';
import { polylineAt, replyPose, replyRideAt, SLIP_BELT, type ArmStep, type DeskState, type FocusEntry, type LampStep, type ReplyState, type SlipRide } from './state.ts';
import { LAMP_ARMS, LAMP_FOOT_Z, lampElbow, type YouPose } from './you.ts';

/** Whether beat 10 is built (false: the animatic's slate shows its cues' words and the "animatic" mark over its frames). */
export const BUILT = true;

const lerp3 = (a: P3, b: P3, t: number): P3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ------------------------------------------------------------------------------------------------
// 10.1 the hatched slip

/**
 * The hatched slip's way (MT1's next dispatch's line, state.ts nextAt: the spout, posted over the gate onto the belt's
 * foot, up the belt into the throat, fed into the head), slower: it glides. MT1's post lands on the belt 84 u south of the
 * docked key (layout.ts KEY_DOCK), so it never touches the key's lever: no strike, no tick.
 */
/**
 * The hatched slip's size: 1.35x a chat slip (MT1's NEXT_SLIP, 96 x 40 u), so the film's biggest open risk rides a slip that
 * reads at 0.64x (session 6's critics: at a chat slip's size it was about 52 x 25 px, missed under C25's wipe). Its hatch
 * keeps the storyboard's pitch (2 px at 8 px at 0.64x).
 */
export const HIJACK_SLIP = { l: Math.round(NEXT_SLIP.l * 1.35), w: Math.round(NEXT_SLIP.w * 1.35) } as const;
/** (`back`: how far inside the spout it starts, so its nose shows as far out on its first frame as a chat slip's does.) */
export const HIJACK = { out: BEAT_10.hatch.spout - 1, outFrames: 5, back: 50 + (HIJACK_SLIP.l - NEXT_SLIP.l) / 2, post: BEAT_10.hatch.spout + 4, postFrames: 12, register: BEAT_10.hatch.register, hold: 16, feedFrames: 6, turn: 4 } as const;
/** When it is wholly in the head (the hatched slip lies in the throat from `register` for most of a beat, the etch spreading from it, then it is fed in). */
export const HIJACK_GONE = HIJACK.register + HIJACK.hold + HIJACK.feedFrames;
/**
 * The chat drum hides the slip's start (layout.ts FEEDERS.chat: a drum of radius 49 round x -942, its open top covered by
 * its ring and its roll from z 50 up). At 1.35x a chat slip is longer than the drum is wide, so while it slides out of the
 * spout the part of it west of `x` is not drawn (the cut lies inside the drum, 18 u west of its axis, under its roll: never
 * seen), and its tail never pokes out through the drum's back wall (session 6's review, C-R1: a hatched sliver showed
 * west of the drum on f4962-4963). It is whole from the post on (its tail then east of the cut).
 */
export const HIJACK_CUT = { x: rectC(FEEDERS.chat)[0] - 18 } as const;
export interface HijackPose {
  p: P3;
  heading: number;
  slope: number;
  /** where its drawn part starts along its length (u from its centre, west -l/2 when whole): HIJACK_CUT while it leaves the drum */
  tail: number;
}
/** The belt's own heading and slope (its first segment, the gate's foot to the belt's top: the throat's short corner is not the slip's heading). In a function: SLIP_BELT is state.ts's (the import rule). */
function beltDir(): { heading: number; slope: number } {
  const [a, b] = [SLIP_BELT[0]!, SLIP_BELT[1]!];
  return { heading: Math.atan2(b[1] - a[1], b[0] - a[0]), slope: Math.atan2(b[2] - a[2], Math.hypot(b[0] - a[0], b[1] - a[1])) };
}
export function hijackAt(f: number): HijackPose | null {
  const H = HIJACK;
  if (f <= H.out || f >= HIJACK_GONE) return null;
  const BELT_DIR = beltDir();
  if (f < H.post) {
    // out of the spout's mouth (from its nose at the drum's wall: its first frame out shows on the cue), easing onto the lip
    const inSpout: P3 = [NEXT_SLIP.spout[0] - H.back, NEXT_SLIP.spout[1], NEXT_SLIP.spout[2] + 2];
    const p = lerp3(inSpout, NEXT_SLIP.spout, sine((f - H.out) / H.outFrames));
    // (lying level along x here: the cut is a length along it)
    return { p, heading: 0, slope: 0, tail: Math.max(-HIJACK_SLIP.l / 2, HIJACK_CUT.x - p[0]) };
  }
  const belt = H.post + H.postFrames;
  if (f < belt) {
    const t = clamp((f - H.post) / H.postFrames);
    // posted over the gate on a trapezoid of speed (from rest at the lip: it glides, never jumping to full speed)
    const u = trapezoid(t, 0.3, 0.35);
    const a = NEXT_SLIP.spout;
    const b = NEXT_SLIP.gate;
    // nose up off the spout's lip, then down onto the belt's foot, settling in the belt's slope (its rise and fall on the
    // same run: from rest and to rest in every axis)
    return { p: [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u) + 4 * NEXT_SLIP.apex * u * (1 - u)], heading: Math.atan2(b[1] - a[1], b[0] - a[0]) * u, slope: BELT_DIR.slope * u * u - 0.5 * u * (1 - u), tail: -HIJACK_SLIP.l / 2 };
  }
  if (f < H.register) {
    // up the belt at an even pace (it glides), turning to lie along the throat over its last frames
    const u = (f - belt) / (H.register - belt);
    const { p } = polylineAt(SLIP_BELT, trapezoid(u, 0.2, 0.1));
    const k = sine((f - (H.register - H.turn)) / H.turn);
    const head0 = Math.atan2(NEXT_SLIP.gate[1] - NEXT_SLIP.spout[1], NEXT_SLIP.gate[0] - NEXT_SLIP.spout[0]);
    const turnIn = sine((f - belt) / 4);
    return { p, heading: lerp(lerp(head0, BELT_DIR.heading, turnIn), 0, k), slope: BELT_DIR.slope * (1 - k), tail: -HIJACK_SLIP.l / 2 };
  }
  // in the throat on the cue, lying there while the etch spreads from it, then fed into the head
  return { p: lerp3(NEXT_SLIP.throat, NEXT_SLIP.head, easings.inCubic(clamp((f - H.register - H.hold) / H.feedFrames))), heading: 0, slope: 0, tail: -HIJACK_SLIP.l / 2 };
}

// ------------------------------------------------------------------------------------------------
// 10.1 the etch's crawl from the throat to the loop

/**
 * The crawl's way (proposed.ts CRAWL: its frames): a hatched band (CRAWL_W wide) laid flat at the deck's rail-top height,
 * out from under the hatched slip in the throat, south-east onto the deck's south rail, east along the rail to its east end,
 * then on east, level, to where the loop's sheet's north-west corner lies on screen at still (d)'s framing (it is held from
 * bar 58's ease-out to bar 65's dolly), so on screen it runs from the slip along the deck's south edge and on to the loop's
 * corner, where the loop's etch starts (ETCH.sheets). World points (u), its arc length `length`.
 */
export const CRAWL_Z = 123.6;
export const CRAWL_W = 18;
export const CRAWL_PATH: readonly P3[] = (() => {
  const pose = deskCamera(FRAMING_D, 15);
  const corner = screenToDesk(pose, project(pose, [LOOP_SHEET.x0 + 12, LOOP_SHEET.y1 - 12, 0.4]), CRAWL_Z);
  return [
    [NEXT_SLIP.throat[0] + 20, NEXT_SLIP.throat[1], CRAWL_Z],
    [DECK.x0 + 20, DECK.y0 + DECK.rail / 2, CRAWL_Z],
    [DECK.x1 - 10, DECK.y0 + DECK.rail / 2, CRAWL_Z],
    [Math.round(corner[0]), Math.round(corner[1]), CRAWL_Z],
  ];
})();
/** The crawl at f: the band's tail and head as fractions of its way (0 the throat .. 1 the loop's corner), null when none of it shows; its tail follows its head out of the throat and eases into the loop's corner after it (proposed.ts CRAWL). */
export function crawlAt(f: number): { tail: number; head: number } | null {
  const head = trapezoid((f - CRAWL.from + 1) / (CRAWL.to - CRAWL.from), 0.18, 0);
  const tail = trapezoid((f - CRAWL.back) / CRAWL.backRun, 0.18, 0.3);
  return head <= 0 || tail >= 1 ? null : { tail, head };
}

// ------------------------------------------------------------------------------------------------
// 10.1 the etch

/** Where the hatching lies on a strip: from `a` to `b` (fractions along it, from where it starts); [0, 0] none. */
export type Span = readonly [number, number];
export interface EtchState {
  /** the plan of the deck (west to east), the loop's sheet (north to south) */
  plan: Span;
  loop: Span;
  /** each tether, from its port to its clip; each clip and each machine's top (0..1 hatched from the west) */
  tethers: readonly Span[];
  clips: readonly Span[];
  tops: readonly Span[];
}
/** A spread over [from, from + run) then a recession over [back, back + run): the span hatched at f. */
function spanAt(f: number, from: number, run: number, back: number, backRun: number): Span {
  const b = trapezoid((f - from) / run, 0.25, 0.25);
  const a = trapezoid((f - back) / backRun, 0.25, 0.25);
  return a >= 1 || b <= 0 ? [0, 0] : [a, b];
}
export function etchAt(f: number): EtchState | null {
  if (f < ETCH.sheets[0] || f >= ETCH.gone) return null;
  const E = BEAT_10.etch;
  const [s0, s1] = ETCH.sheets;
  return {
    plan: spanAt(f, s0, 14, ETCH.recede, 12),
    loop: spanAt(f, s0, s1 - s0, ETCH.recede + 2, 14),
    tethers: E.map((t, i) => spanAt(f, t - ETCH.run, ETCH.run, ETCH.recede + 6 + 2 * i, ETCH.recedeRun)),
    clips: E.map((t, i) => spanAt(f, t - 3, 3, ETCH.recede + 6 + 2 * i + ETCH.recedeRun - 4, 4)),
    tops: E.map((t, i) => spanAt(f, t - 1, 5, ETCH.recede + 6 + 2 * i + ETCH.recedeRun - 2, 5)),
  };
}
/** Each machine's gloss killed by the etch (0 its graphite .. 1 matte): as the hatching reaches its top, back as it leaves. */
export const glossAt = (i: number, f: number): number => {
  const t = BEAT_10.etch[i]!;
  const back = ETCH.recede + 6 + 2 * i + ETCH.recedeRun - 2;
  return sine((f - t + 1) / 4) * (1 - sine((f - back) / 10));
};

// ------------------------------------------------------------------------------------------------
// The pencil (drawn once, never erased: objects/Proposed.tsx draws each stroke's length so far)

/** Each pencil part's draw-on (0..1), on its cue: the contact frame is where the stroke completes (the split, the tear, the pin). */
export const PENCIL = {
  query: [BEAT_10.query - 8, BEAT_10.query] as const,
  crack: [BEAT_10.split - 6, BEAT_10.split] as const,
  shard: [BEAT_10.split + 2, BEAT_10.split + 10] as const,
  tear: [BEAT_10.tear - 4, BEAT_10.tear] as const,
  windings: [BEAT_10.windings - 12, BEAT_10.windings] as const,
  windingsQ: [BEAT_10.windings + 1, BEAT_10.windings + 9] as const,
  handle: [BEAT_10.handle - 6, BEAT_10.handle] as const,
  handleQ: [BEAT_10.handle + 1, BEAT_10.handle + 9] as const,
} as const;
const draw = (f: number, [a, b]: readonly [number, number]): number => clamp((f - a) / (b - a));

/** Beat 10's part of the proposed parts' pose (beat9.ts ProposedState). */
export interface Proposed10 {
  etch: EtchState | null;
  gloss: readonly number[];
  /** the "?" beside the tethers, the "?" by the handle (still (d)'s QUERIES) */
  queries: readonly [number, number];
  split: { crack: number; shard: number; tear: number; windings: number; windingsQ: number };
  handle: number;
}
export function proposed10(f: number): Proposed10 {
  const P = PENCIL;
  return {
    etch: etchAt(f),
    gloss: MACHINES_9.map((_, i) => glossAt(i, f)),
    queries: [draw(f, P.query), draw(f, P.handleQ)],
    split: { crack: draw(f, P.crack), shard: draw(f, P.shard), tear: draw(f, P.tear), windings: draw(f, P.windings), windingsQ: draw(f, P.windingsQ) },
    handle: draw(f, P.handle),
  };
}

// ------------------------------------------------------------------------------------------------
// 10.2 the shard's reading window; Fix A's and Fix B's cards

/**
 * The shard's window (vellum): fed out of the print head east over the real window (6 f) once the tape has torn, slid south
 * beside it (6 f), settling on `windows`: the same record cell, its № one behind the real one's, right under it (the two
 * disagree); it stays through the cards and the windings and fades where it lies (`fade` frames) only once the windings'
 * "?" is drawn and the labels have landed (one thing at a time). It lies 1.5 u over the window's frame (its top at z 133).
 * (It had slid back north over the window and been fed into the head: its "#0404" printed over the teaching ID #0405 as a
 * smeared double and its dashed edge swept the record's print, R2-L4-04.)
 */
export const SHARD_WINDOW = { out: BEAT_10.tear + 2, beside: BEAT_10.windows - 6, back: BEAT_10.windings + 22, frames: 6, fade: 8, dy: -100, z: 134.5 } as const;
export interface ShardWindow {
  /** how far it is out of the head (0 inside .. 1 its whole length out) and north of the window (u); how much of it is left (1 .. 0 as it fades) */
  out: number;
  dy: number;
  fade: number;
}
export function shardWindowAt(f: number): ShardWindow | null {
  const W = SHARD_WINDOW;
  if (f <= W.out || f >= W.back + W.fade) return null;
  const out = trapezoid((f - W.out) / W.frames, 0.3, 0.4);
  const dy = W.dy * sine((f - W.beside) / W.frames);
  return { out, dy, fade: 1 - sine((f - W.back) / W.fade) };
}

/**
 * Fix A's and Fix B's cards (C7's choice, back): either side of the Register, held about 20 f, sliding away from `cards.exit`
 * (no strike: beat4.ts cardAt's exit starts the strike's 6 f after `strike`, so its first move lands on the cue).
 */
export const CARDS_10 = { rise: BEAT_10.cards.rise, strike: BEAT_10.cards.exit - 6 } as const;
/**
 * Where they play at FRAMING_B (0.85x): hovering 240 u up either side of the Register, over the feeders (west, Fix A's
 * one tape beside the real intake) and over the bays (east, Fix B's trays beside the real Workers), high enough that their
 * lower edges clear the Router label's line (y 352 px) and the reel frame; in from just beyond the top edge (beat 4's
 * CARD_AT's: its lower edge a few px over the frame), so the whole 12 f rise and 8 f exit are seen, never a dash.
 */
export const SPOT_10: Record<'fixA' | 'fixB', CardSpot> = {
  fixA: { at: [-770, 370, 240], off: [-770, 732, 240] },
  fixB: { at: [600, 370, 240], off: [600, 732, 240] },
};
export function cards10(s: DeskState): CardUp[] {
  const c = cardAt(s.f, CARDS_10);
  return c ? (['fixA', 'fixB'] as const).map((k) => ({ card: c, spot: SPOT_10[k] })) : [];
}

// ------------------------------------------------------------------------------------------------
// 10.3 your lamp's reach; bar 68

/**
 * Your lamp reaches for the docs bay on spring-heavy, its head as far east as its arms go (it falls short), its pool short
 * of the bay; it comes home before bar 68. Its spring starts the frame before the cue (springAt is 0 on its own frame), so
 * the first move lands on `reach`. The elbow's pole turns from the act-two pose's own (you.ts YOU_POSE_B: POLE_B) to the
 * reach's with the same amount, so the elbow is the pose's own exactly at 0 and never jumps (beat10.test holds POLE_B to it).
 */
export const REACH = { from: BEAT_10.reach - 1, home: BEAT_10.pinsDrop - 26, toward: [-490, -52, 160] as P3, aim: [-300, -66, 0] as P3, pole: [0.3, -0.7, 0.65] as P3 } as const;
/** The act-two lamp pose's elbow pole (you.ts YOU_POSE_B, restated: you.ts does not export it). */
export const POLE_B: P3 = [0.25, -0.62, 0.74];
/** Its head at the reach: toward REACH.toward from the base's swivel, 3 u inside the arms' full length (it can reach no farther). */
export function reachHead(base: P3): P3 {
  const foot: P3 = [base[0], base[1], base[2] + LAMP_FOOT_Z];
  const d: P3 = [REACH.toward[0] - foot[0], REACH.toward[1] - foot[1], REACH.toward[2] - foot[2]];
  const l = Math.hypot(...d);
  const r = Math.min(l, LAMP_ARMS.lower + LAMP_ARMS.upper - 3);
  return [foot[0] + (d[0] / l) * r, foot[1] + (d[1] / l) * r, foot[2] + (d[2] / l) * r];
}
export const reachAt = (f: number): number => springAt(f, REACH.from, SPRING.heavy) - springAt(f, REACH.home, SPRING.heavy);
export function you10(f: number, pose: YouPose): YouPose {
  const k = reachAt(f);
  // (the cut is safe: the elbow is continuous in k, and the pose's own at k = 0)
  if (f >= SEAM || Math.abs(k) < 1e-6) return pose;
  const L = pose.lamp;
  const head = lerp3(L.head, reachHead(L.base), k);
  return { ...pose, lamp: { ...L, head, elbow: lampElbow(L.base, head, lerp3(POLE_B, REACH.pole, k)), aim: lerp3(L.aim, REACH.aim, k) } };
}

/** The bug bay's pins: on `pinsDrop` they stop cycling and drop (4 f, their first move on the cue), then pass one by one (4 f each, 2 f apart), all up by the stamp-in. */
export const PINS_10 = { drop: BEAT_10.pinsDrop, dropFrames: 4, rise: BEAT_10.pinsDrop + 6, stagger: 2, flip: 4 } as const;
export function pins10(f: number, pins: number[]): number[] {
  const P = PINS_10;
  if (f < P.drop) return pins;
  return pins.map((v, i) => (f < P.rise ? v * (1 - sine((f - P.drop + 1) / P.dropFrames)) : sine((f - P.rise - i * P.stagger) / P.flip)));
}

/**
 * The report card #0405 (MT1's card, objects/Handshake.tsx CardHalves): pushed up out of the work slit standing (4 f) on
 * `reportUp`, an arc under the transit light up over the deck's south rail into the mouth, docking on `stampIn` (MT1's
 * dock, state.ts DOCK_B, at the mouth's tilt), then taken in under the deck (it slides north and down under the rail, 8 f).
 */
export const REPORT_10 = { up: BEAT_10.reportUp, emerge: 4, dock: BEAT_10.stampIn, apex: 70, takeIn: BEAT_10.stampIn + 3, takeFrames: 8 } as const;
/** It rises standing out of the bug bay's work slit (its block's top at z 30: objects/Bay.tsx) and docks on the mouth (MT1's DOCK_B). */
const SLIT_Z = 30.3;
const REPORT_FROM: P3 = [CARD_C.from[0], 60, SLIT_Z + CARD.d / 2 + 0.6];
const REPORT_DOCK: P3 = [MOUTH.land[0], MOUTH.land[1], MOUTH.z[1] - 2];
/** Taken in: under the deck's south rail, north and down. */
const REPORT_IN: P3 = [MOUTH.land[0], MOUTH.land[1] + 92, MOUTH.z[1] - 16];
export interface ReportPose {
  p: P3;
  /** about x: standing (CARD_STAND) to the mouth's tilt (CARD_DOCK_TILT) */
  tilt: number;
  /** its flight's share (0..1: the transit light rides it), its landing squash */
  s: number | null;
  transit: number;
  squash: number;
}
/** The card's tilts (state.ts CARD_STAND, CARD_DOCK_TILT). */
const STAND = Math.PI / 2 - 0.16;
const DOCK_TILT = 0.28;
export function reportAt(f: number): ReportPose | null {
  const R = REPORT_10;
  if (f < R.up || f >= R.takeIn + R.takeFrames) return null;
  const fly = R.up + R.emerge;
  if (f < fly) {
    // standing in the slit, pushed up out of it (its lower part inside the slot block)
    const out = easings.outCubic(clamp((f - R.up + 1) / R.emerge));
    return { p: [REPORT_FROM[0], REPORT_FROM[1], REPORT_FROM[2] - CARD.d * (1 - out)], tilt: STAND, s: null, transit: 0, squash: 0 };
  }
  if (f < R.dock) {
    const T = R.dock - fly;
    const u = sine((f - fly) / T);
    const from = REPORT_FROM;
    const p: P3 = [lerp(from[0], REPORT_DOCK[0], u), lerp(from[1], REPORT_DOCK[1], u), lerp(from[2], REPORT_DOCK[2], u) + 4 * R.apex * u * (1 - u)];
    const t = f - fly;
    const transit = clamp(t / 4) * clamp((T - t) / 5) ** 2;
    return { p, tilt: DOCK_TILT + (STAND - DOCK_TILT) * (1 - Math.min(1, u / 0.66)) ** 2, s: u, transit, squash: 0 };
  }
  if (f < R.takeIn) return { p: REPORT_DOCK, tilt: DOCK_TILT, s: null, transit: 0, squash: 0.03 * Math.max(0, 1 - (f - R.dock) / 3) };
  // (taken in evenly, easing in and out over 8 f: an ease-in folded it under the rail in its last 2 f, unseen: session 6's L4-11)
  const k = sine((f - R.takeIn + 1) / R.takeFrames);
  return { p: lerp3(REPORT_DOCK, REPORT_IN, k), tilt: DOCK_TILT * (1 - k), s: null, transit: 0, squash: 0 };
}

/**
 * The bug bay's cap: once the report card has left the slit it rises standing on its hinge out of the slot (4 f), then
 * swings shut over the slit (5 f, falling), landing as still (d)'s cap (objects/Trace.tsx); its work light dies as it lands
 * (from `lightFrom`, the frame before: the capped slot's glass falls to Trace's dark).
 */
export const CAP_10 = { rise: BEAT_10.reportUp + 4, swing: BEAT_10.reportUp + 8, frames: 5, lightFrom: BEAT_10.reportUp + 12 } as const;
export interface CapPose {
  /** how far it has risen out of its block (0..1), its swing (0 standing .. 1 shut) */
  rise: number;
  swing: number;
}
export function capAt(f: number): CapPose | null {
  const C = CAP_10;
  if (f <= C.rise) return null;
  // up out of its slot easing in and out (its first frame up is not most of the way), then falling shut, gathering speed
  return { rise: sine((f - C.rise) / (C.swing - C.rise)), swing: easings.inCubic(clamp((f - C.swing) / C.frames)) };
}
/** The cap lands here: the request's bay's work light dies from it (spring-effects). */
export const CAP_LANDS = CAP_10.swing + CAP_10.frames;
/** Whether the cap has landed (from then on it is still (d)'s slab). */
export const capLanded = (c: CapPose): boolean => c.rise >= 1 && c.swing >= 1;
export const bugLight10 = (f: number, light: number): number => light * (1 - springAt(f, CAP_LANDS - 1, SPRING.effects));
/** The stuck bay's work light goes out as the request completes (its report stamped in). */
export const FRESH_OUT = BEAT_10.stampIn + 2;
export const freshLight10 = (f: number, light: number): number => light * (1 - springAt(f, FRESH_OUT, SPRING.effects));

/**
 * The reply #0405 rests exactly where still (d) lays it (objects/Replies.tsx SIGNED_REPLY): its centre, height, turn, size.
 * It lies on top of the in-tray's slips, over 7.4's chat reply's "≤ 100" stop tab too (beat7.ts REPLY_REST z 33: the tab's
 * face at 35.45), so your stamp's green check prints on #0405's own paper (summary.ts STAMP.paperZ follows its height).
 */
export const REPLY_0405 = { rest: [rectC(YOU.inTray)[0], YOU.inTray.y1 - 44, YOU.top + 7.6] as P3, turn: 0.06, size: [104, 72] as const } as const;
/** Its ride (state.ts replyRideAt), landing dead on `replyLands`: no squash and no settle, so nothing moves from there into the seam. */
export function ride0405(f: number): SlipRide | null {
  const r = replyRideAt(f, BEAT_10.replyLeave, BEAT_10.replyLands);
  return r ? { ...r, squash: 0, settle: 1 } : null;
}
/**
 * Its pose: the chute's (state.ts replyPose), turning on to still (d)'s turn as it drops into the tray (exactly at rest from
 * `replyLands`); `curl`: its long sides up the trough's walls (objects/Replies.tsx REPLY_CURL) from its first frames out
 * from under the deck, opening flat over its hop into the tray.
 */
export function pose0405(r: SlipRide): { p: P3; heading: number; slope: number; curl: number } {
  const p = replyPose(r, REPLY_0405.rest);
  if (r.s < 1) return { ...p, curl: 1 };
  return { ...p, heading: p.heading + (REPLY_0405.turn - 0.05) * sine(r.arc), curl: 1 - sine(r.arc / 0.8) };
}

// ------------------------------------------------------------------------------------------------
// The state

export interface Beat10State {
  f: number;
  hijack: HijackPose | null;
  /** the etch's crawl from the throat to the loop (its tail and head along CRAWL_PATH), null when none of it shows */
  crawl: { tail: number; head: number } | null;
  window: ShardWindow | null;
  report: ReportPose | null;
  cap: CapPose | null;
  reply: SlipRide | null;
}
/** DeskState.e10: beat 10's movers, from bar 63 to the seam. */
export function beat10At(f: number): Beat10State | null {
  if (f < BEAT_10.hatch.spout || f >= SEAM) return null;
  return { f, hijack: hijackAt(f), crawl: crawlAt(f), window: shardWindowAt(f), report: reportAt(f), cap: capAt(f), reply: ride0405(f) };
}

/**
 * Focus. Beat 9's hold on the system releases as bar 65's dolly sets out (beat9.ts 'b9-etch'). While Fix A's and Fix B's
 * cards are up, everything else steps down (a counterfactual's depth, ramping from nothing: nothing else is held then).
 * From 2 f before the reply leaves, the bays and the Thread cord step down as the summary has them (summary.ts
 * summaryDeskState: still (d)'s step), done before the reply lands, so the stillness is still; its own set is the
 * summary's (the trace's), idle until after the seam.
 */
/** Everything but Fix A's and Fix B's cards (10.2), the proposed parts too (their vellum and the pencil on the reel, and the Watchdog's: objects/Beat9.tsx PROPOSED_STEP_ID, WATCHDOG_STEP_ID). */
export const ALL_BUT_CARDS = ['intake', 'gate', 'belt', 'plate', 'fanfold', 'policy', 'docsBay', 'bugBay', 'testsBay', 'freshBay', 'cord', 'reel', 'lock', 'gauge', 'head', 'index', 'mouth', 'you', 'deck', 'chute', 'proactive', 'spike', 'stress', 'jaws', 'bosses', 'b7-rail', 'b7-plate', 'b9-proposed', 'b9-watchdog'] as const;
export const REST_STEP = ['docsBay', 'bugBay', 'freshBay', 'cord'] as const;
export const TRACE_OWN = ['reel', 'lock', 'policy', 'gauge', 'plate', 'fanfold', 'intake'] as const;
export const REST_FROM = BEAT_10.replyLeave - 8;
export const FOCUS_10: readonly FocusEntry[] = [
  { id: 'b10-fix', from: CARDS_10.rise - 1, to: BEAT_10.cards.exit + 1, step: ALL_BUT_CARDS, depth: 1.5 },
  // the summary's step (summary.ts summaryDeskState): the own set's ramp starts with the ease-out's focus lead (5435)
  { id: 'b10-rest', from: REST_FROM, to: SEAM + 16, step: REST_STEP, own: { from: 5435, to: 6000, step: TRACE_OWN } },
];
export const LAMP_10: readonly LampStep[] = [];
/** The index turns to the finishing bay as its pins drop, then west to you once the report is stamped in (each step a frame ahead of its cue: state.ts armOf turns the arm from the frame after a step's `at`, so it leaves on the cue). */
export const ARM_10: readonly ArmStep[] = [
  { at: BEAT_10.pinsDrop - 1, to: 'bug' },
  { at: BEAT_10.indexWest - 1, to: 'you' },
];
export function replies10(e: Beat10State | null): ReplyState[] {
  return e?.reply ? [{ id: '0405', ride: e.reply, rest: REPLY_0405.rest, size: REPLY_0405.size }] : [];
}

/** The hatched slip's (a carrier: lying in its pose) and the report card's (MT1's, footprints.ts) while they fly. */
export function footprints10(s: DeskState): Footprint[] {
  const e = s.e10;
  if (!e) return [];
  const fp: Footprint[] = [];
  const h = e.hijack;
  if (h && h.p[0] > NEXT_SLIP.spout[0] - 10) {
    const { z0, z1 } = carrierSpan({ p: h.p, slope: h.slope }, HIJACK_SLIP.l / 2, 0.8);
    fp.push({ kind: 'rect', c: [h.p[0], h.p[1]], h: [HIJACK_SLIP.l / 2, HIJACK_SLIP.w / 2], r: 3, rot: h.heading, z0, z1, contact: 0 });
  }
  const r = e.report;
  if (r && r.s !== null) fp.push({ kind: 'rect', c: [r.p[0], r.p[1]], h: [CARD.w / 2, Math.max(1, (CARD.d / 2) * Math.cos(r.tilt))], r: 3, rot: 0, z0: r.p[2] - (CARD.d / 2) * Math.sin(r.tilt), z1: r.p[2] + (CARD.d / 2) * Math.sin(r.tilt), contact: 0 });
  return fp;
}
export function pools10(_s: DeskState): Pool[] {
  return [];
}
export const TAGS_10: readonly TagSpec[] = [];
