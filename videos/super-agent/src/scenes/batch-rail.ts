/**
 * The Router's rail as the third and fourth answers both draw it (batch.ts, cache.ts): one clock
 * for bars 41 to 56, so the picture runs through from one into the other.
 *
 * The rail is the Router's one context. The three channels of section 3 run into it from the near
 * side. An arrival comes down a channel and stops short of the rail. A call is a lit stretch of
 * the rail with room for a few arrivals: while it is lit, whoever arrives waits. When it ends,
 * those waiting enter together and one call takes them all. What a call has handled moves left
 * along the rail, into the Router's history, as one group.
 *
 * Facts (FACTS.md, sections 4 and 6): in the authors' stress test the average batch grew from 1.0
 * to 2.8 and the time per request ROSE (2.5 s to 3.9 s) while the model time per decision fell. So a
 * call here is never shorter than the one before it, the later ones are a little longer, and no
 * batch is larger than a handful. The limit per call is the article's (block 35); the number of
 * places is the film's own.
 */
import { clamp, easings, lerp } from '@aiv/core';
import { at } from '../cues.ts';
import type { Vec3 } from '../kit/camera.ts';
import type { Draw } from '../kit/draw.ts';
import { mix, scale, type Rgb } from '../kit/look.ts';
import { prog } from '../kit/time.ts';
import { CELLS } from './flat.ts';
import { LEVEL, SLAB } from './world.ts';

export const R = LEVEL.router;

// ── the plane ──────────────────────────────────────────────────────────────────────────────────
/** the channels of section 3 (levels.ts), where they were */
const MID = CELLS[3]!.x;
const CHANNELS: readonly number[] = [MID - 330, MID, MID + 330];
/** the present: where a call's light stands on the rail, at the mouth of the middle channel */
const HEAD = MID;
/** places on the rail are this far apart, in a call and in the history */
export const PITCH = 62;
/** a call takes at most this many (the film's own number: the article gives none) */
const SEATS = 4;
/** half the length of a call's light: its places and a margin, so a full call looks full */
const LIT = ((SEATS - 1) / 2) * PITCH + 38;
/** the place in the history nearest the present: no place of the history lies on a channel's mouth */
export const HIST = HEAD - 232;
/** an arrival stops this far short of the rail; a second one on its channel stops behind it */
const SILL = 66;
const QUEUE = 41;
/** an arrival is first seen this far down its channel, below the frame */
const Z_IN = 470;

const DOT = 13;
const RING = 22;
/** the brighter stretch that runs along a call's light: world units a frame, and half its length */
const GLINT = { pace: 3.1, reach: 44 } as const;

// ── the clock ──────────────────────────────────────────────────────────────────────────────────
/** frames an arrival takes down its channel */
const TRAVEL = 46;
/** a call opens on a beat: those waiting step in from here ... to here, and its light is on by `LIT_AT` */
const ENTER: readonly [number, number] = [3, 16];
const LIT_AT = 15;
/** what a call has handled leaves the present in this many frames, and the history moves up with it */
const SLIDE = 20;
/** a waiting arrival moves up its channel when those ahead of it have gone in */
const MOVE_UP: readonly [number, number] = [6, 24];

export interface Call {
  /** the call before it has ended: those waiting start to enter (on a beat) */
  open: number;
  /** its light is on */
  lit: number;
  /** it ends (on a beat) */
  close: number;
  /** places it fills: its arrivals, and any it keeps for something else */
  size: number;
  /** places kept at its left end for what the scene brings itself (a recalled body) */
  kept: number;
}

export interface Arrival {
  /** it stops at its place before the rail at this frame */
  t: number;
  ch: number;
  /** a person sent it */
  person: boolean;
  /** the call that takes it, and its place in that call from the left */
  call: number;
  seat: number;
}

/**
 * The calls. One arrival at first; then three wait and enter together (43,1); under the test's
 * figures a call holds three (its average batch was 2.8 at the highest load) and lasts a little
 * longer; then a burst, and a call fills (48,1) while the rest wait for the next one (49,4). In the
 * cache section one more call answers a person who brings an old task up again.
 */
const CALL_TIMES: ReadonlyArray<readonly [open: number, close: number, kept?: number]> = [
  [at(41, 3), at(43, 1)],
  [at(43, 1), at(44, 3)],
  [at(44, 3), at(46, 2)],
  [at(46, 2), at(48, 1)],
  [at(48, 1), at(49, 4)],
  [at(49, 4), at(51, 3)],
  [at(52, 1) - LIT_AT, at(54, 2), 1],
];

/** Arrivals: [the frame it stops before the rail, channel, a person sent it]. They come when they come, off the beat. */
const ARRIVAL_TIMES: ReadonlyArray<readonly [t: number, ch: number, person?: boolean]> = [
  // the rail is free: this one goes straight in
  [at(41, 3), 1, true],
  // they wait for the first call
  [at(41, 4) + 24, 0],
  [at(42, 2) + 13, 2, true],
  [at(42, 3) + 24, 1],
  // the load is up: three to a call
  [at(43, 2) + 12, 1],
  [at(43, 3) + 27, 0, true],
  [at(44, 1) + 18, 2],
  [at(44, 4) + 12, 2],
  [at(45, 2) + 1, 0, true],
  [at(46, 1) - 15, 1],
  // a burst: more than one call takes
  [at(46, 3) + 11, 1],
  [at(46, 4) + 18, 0],
  [at(47, 1) + 19, 2, true],
  [at(47, 2) + 11, 1],
  [at(47, 3) + 3, 0],
  [at(47, 3) + 21, 2],
  [at(47, 4) + 8, 1, true],
  // one more while the full call runs: with the three left over, the next call is full too
  [at(49, 2) + 8, 2],
  // an old task comes up again
  [at(52, 1) - LIT_AT, 1, true],
];

export const CALLS: Call[] = CALL_TIMES.map(([open, close, kept = 0]) => ({ open, lit: open + LIT_AT, close, size: kept, kept }));
export const ARRIVALS: Arrival[] = ARRIVAL_TIMES.map(([t, ch, person = false]) => ({ t, ch, person, call: -1, seat: 0 }));
for (let k = 0; k < CALLS.length; k++) {
  const c = CALLS[k]!;
  // first come, first taken, up to the limit; in the call they stand in the order of their channels, so no two paths cross
  const taken = ARRIVALS.filter((a) => a.call < 0 && a.t <= c.open)
    .sort((a, b) => a.t - b.t)
    .slice(0, SEATS - c.kept)
    .sort((a, b) => a.ch - b.ch || a.t - b.t);
  if (taken.length === 0) throw new Error(`batch: the call that opens at frame ${c.open} takes nothing`);
  taken.forEach((a, j) => {
    a.call = k;
    a.seat = c.kept + j;
  });
  c.size = c.kept + taken.length;
  if (k > 0 && c.open < CALLS[k - 1]!.close) throw new Error(`batch: the call at frame ${c.open} opens before the one before it ends`);
}
if (ARRIVALS.some((a) => a.call < 0)) throw new Error('batch: an arrival is never taken');

// ── where things are ───────────────────────────────────────────────────────────────────────────

/** How far the history has moved up since call `k` ended: each later call pushes it by its own length and a gap. */
function pushed(k: number, f: number): number {
  let s = 0;
  for (let m = k + 1; m < CALLS.length; m++) {
    const c = CALLS[m]!;
    if (f > c.close) s += (c.size + 1) * PITCH * easings.outCubic(clamp((f - c.close) / SLIDE));
  }
  return s;
}

/** World x of place `seat` of call `k` at frame `f`: in the present while the call runs, then in the history. */
export function placeX(k: number, seat: number, f: number): number {
  const c = CALLS[k]!;
  const present = HEAD + (seat - (c.size - 1) / 2) * PITCH;
  if (f <= c.close) return present;
  const past = HIST - (c.size - 1 - seat) * PITCH;
  return lerp(present, past, easings.outCubic(clamp((f - c.close) / SLIDE))) - pushed(k, f);
}

/** Where place `seat` of call `k` comes to rest once call `m` (itself or a later one) has ended. */
export function restX(k: number, seat: number, m: number): number {
  let x = HIST - (CALLS[k]!.size - 1 - seat) * PITCH;
  for (let i = k + 1; i <= m; i++) x -= (CALLS[i]!.size + 1) * PITCH;
  return x;
}

/** How far from the rail arrival `a` waits at `f`: at the sill, or behind those ahead of it on its channel. */
function waitZ(a: Arrival, f: number): number {
  let ahead = 0;
  for (const b of ARRIVALS) {
    if (b === a || b.ch !== a.ch || b.t >= a.t) continue;
    const open = CALLS[b.call]!.open;
    ahead += 1 - prog(f, open + MOVE_UP[0], open + MOVE_UP[1]);
  }
  return SILL + QUEUE * ahead;
}

/** Arrival `a` at frame `f`: its place on the Router's plane (x, z; z = 0 is the rail). */
function whereIs(a: Arrival, f: number): readonly [number, number] {
  const c = CALLS[a.call]!;
  const x0 = CHANNELS[a.ch]!;
  if (f < a.t) return [x0, lerp(Z_IN, waitZ(a, f), easings.outCubic(clamp((f - (a.t - TRAVEL)) / TRAVEL)))];
  const u = prog(f, c.open + ENTER[0], c.open + ENTER[1]);
  if (u <= 0) return [x0, waitZ(a, f)];
  return [lerp(x0, placeX(a.call, a.seat, f), u), lerp(waitZ(a, f), 0, u)];
}

/** How brightly a call's light is on at `f`: 0 between calls (it is out on the beat a call ends on), a little over 1 as one begins. */
function calling(f: number): number {
  for (const c of CALLS) {
    if (f <= c.lit - 5 || f >= c.close) continue;
    const attack = 1 - clamp((f - c.lit) / 26);
    return clamp((f - (c.lit - 5)) / 6) * clamp((c.close - 1 - f) / 8) * (1 + 0.22 * attack);
  }
  return 0;
}

// ── the marks ──────────────────────────────────────────────────────────────────────────────────

/** An event: a disc that faces the viewer; it wears a coral ring when a person sent it. */
export function event(d: Draw, o: Vec3, rgb: Rgb, alpha: number, person: boolean, feather = 0, size = 1): void {
  if (alpha <= 0 || size <= 0) return;
  d.dot(o, DOT * size, rgb, { alpha: 0.96 * alpha, feather });
  if (person) d.dot(o, RING * size, d.pal.you, { stroke: 3.2 * Math.min(1, size * 1.4), alpha: 0.95 * alpha * clamp(size * 2), feather });
}

/** A mark that moves fast stretches into its own motion: the feather for a step of `step` world units a frame. */
export const smear = (step: number): number => Math.min(9, step * 0.16);

/** What a call has handled, as the rail keeps it. `x` is its place at `f`; `alpha` the scene's. */
export type Kept = (d: Draw, f: number, a: Arrival, x: number, alpha: number) => void;

/** Handled: the event stays on the rail and greys a little as it goes back into the history. */
const keptDot: Kept = (d, f, a, x, alpha) => {
  const c = CALLS[a.call]!;
  const age = f - c.close;
  const rgb = mix(d.pal.bone, d.pal.ash, 0.42 * clamp(age / 330));
  event(d, [x, R + 2, 0], rgb, alpha, a.person, smear(Math.abs(x - placeX(a.call, a.seat, f - 1))));
};

/** The channels: each runs into the rail from the near side. */
function channels(d: Draw, f: number, from: number, alpha: number): void {
  const p = d.pal;
  const open = prog(f, from + 2, from + 30, easings.outCubic);
  if (open <= 0) return;
  for (const x of CHANNELS) d.line([[x, R + 1, 14], [x, R + 1, 14 + (SLAB.halfD - 14) * open]], 2.2, mix(p.ash, p.bone, 0.45), { alpha: 0.7 * alpha });
}

/** A call: a lit stretch of the rail, its light pooled on the plane. The film's only glow here. */
function light(d: Draw, f: number, alpha: number): void {
  const run = calling(f) * alpha;
  if (run <= 0) return;
  const p = d.pal;
  d.pool([HEAD, R, 0], [LIT * 0.92, 40], 104, p.think, 0.2 * run);
  d.flat([HEAD, R + 2, 0], [LIT, 8], 8, scale(p.think, 3.2), { alpha: Math.min(1, run), add: 0.8 });
  // the model reads on: a brighter stretch runs along it, as round a working cell
  const u = ((f * GLINT.pace) % (2 * LIT + 2 * GLINT.reach)) - LIT - GLINT.reach;
  const from = Math.max(-LIT + 6, u - GLINT.reach);
  const to = Math.min(LIT - 6, u + GLINT.reach);
  if (to - from > 12) d.flat([HEAD + (from + to) / 2, R + 2.2, 0], [(to - from) / 2, 9], 9, scale(p.think, 2.2), { alpha: 0.7 * Math.min(1, run) * clamp((to - from - 12) / 40), add: 1, feather: 7 });
}

/**
 * The rail's picture at `f`: channels, the call's light, what waits and what is in the call, and
 * (through `kept`) what has been handled. `from` is the frame the scene begins at; `alpha` fades
 * the whole of it.
 */
export function rail(d: Draw, f: number, from: number, alpha: number, kept: Kept = keptDot): void {
  if (alpha <= 0 || f <= from) return;
  const p = d.pal;
  channels(d, f, from, alpha);
  for (const a of ARRIVALS) {
    if (f > CALLS[a.call]!.close) kept(d, f, a, placeX(a.call, a.seat, f), alpha);
  }
  light(d, f, alpha);
  // on its way, waiting or in the call: drawn over the light, so a call shows what it holds
  for (const a of ARRIVALS) {
    if (f > CALLS[a.call]!.close || f <= a.t - TRAVEL) continue;
    const [x, z] = whereIs(a, f);
    const [x1, z1] = whereIs(a, f - 1);
    const seen = alpha * clamp((f - (a.t - TRAVEL)) / 8) * clamp((f - from) / 10);
    // in the light it keeps its own edge: the call shows how many it holds
    const held = Math.min(1, calling(f)) * clamp(1 - z / 12);
    if (held > 0) d.dot([x, R + 2, z], DOT + 4, p.ground[0], { alpha: 0.72 * held * seen, feather: 2 });
    event(d, [x, R + 2, z], p.bone, seen, a.person, smear(Math.hypot(x - x1, z - z1)));
  }
}
