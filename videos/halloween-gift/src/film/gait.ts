/**
 * Clawd's hop: one ballistic hop per beat, landing exactly on the footfalls the score places
 * (audio/timeline.ts `footfalls`: a foot every beat after a walk starts, and once more on
 * arrival), so his feet never skate and the steps stay in sync with the sound. Travel happens
 * only in the air (a parabola), so nothing slides while a foot is planted; the first and last
 * hops are shorter (an eased start and stop), a tiny remainder before arrival becomes a settle;
 * squash on landing, a little anticipation before take-off, a stretch leaving the ground.
 * Everything is a smooth function of the film frame (on ones).
 */
import { BEAT } from '../cues.ts';

export interface Walk {
  /** frames [from, to]: the walk's start and its arrival (as in audio/timeline.ts WALKS) */
  from: number;
  to: number;
  /** path arc lengths it covers */
  s0: number;
  s1: number;
}

export interface HopState {
  /** arc length along the path */
  s: number;
  /** height of the body above the ground (world units) */
  lift: number;
  /** body scale: y (squash < 1, stretch > 1) and x/z (volume kept) */
  sy: number;
  sxz: number;
  /** 0..1 how tucked the legs are (in the air) */
  tuck: number;
  /** true between the walk's start and its arrival */
  moving: boolean;
}

/** frames in the air per hop (at most; shorter when the beat is shorter) */
export const AIR = 7;

/** The footfall frames of a walk: every beat after `from`, and the arrival. */
export function footfallsOf(w: Walk): number[] {
  const out: number[] = [];
  for (let f = w.from + BEAT; f < w.to; f += BEAT) out.push(f);
  out.push(w.to);
  return out;
}

interface Hop {
  takeoff: number;
  land: number;
  s0: number;
  s1: number;
  height: number;
}

/** The hops of a walk (cached per walk object). */
const cache = new WeakMap<Walk, Hop[]>();
export function hopsOf(w: Walk): Hop[] {
  const c = cache.get(w);
  if (c) return c;
  const falls = footfallsOf(w);
  const prevs = [w.from, ...falls.slice(0, -1)];
  // travel weights: an eased first hop, a last hop scaled by its beat fraction, a settle if tiny
  const weights = falls.map((f, i) => {
    const gap = f - prevs[i];
    if (gap < 5) return 0;
    const frac = Math.min(1, gap / BEAT);
    const first = i === 0 ? 0.7 : 1;
    const last = i === falls.length - 1 ? 0.75 : 1;
    return frac * first * last;
  });
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const hops = falls.map((f, i) => {
    const gap = f - prevs[i];
    const air = Math.min(AIR, gap - 1);
    const a = w.s0 + ((w.s1 - w.s0) * acc) / sum;
    acc += weights[i];
    const b = w.s0 + ((w.s1 - w.s0) * acc) / sum;
    const d = Math.abs(b - a);
    return { takeoff: f - Math.max(1, air), land: f, s0: a, s1: b, height: weights[i] === 0 ? 0 : 0.045 + 0.16 * d };
  });
  cache.set(w, hops);
  return hops;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Where a walking Clawd is at film frame f (f may be fractional for smoothing). */
export function hopAt(w: Walk, f: number): HopState {
  const hops = hopsOf(w);
  const rest: HopState = { s: f <= w.from ? w.s0 : w.s1, lift: 0, sy: 1, sxz: 1, tuck: 0, moving: f > w.from && f < w.to };
  if (f <= w.from - 4 || f >= w.to + 6) return rest;
  for (let i = 0; i < hops.length; i++) {
    const h = hops[i];
    const prevLand = i === 0 ? w.from - 4 : hops[i - 1].land;
    // on the ground before this hop: recovering from the last landing, then anticipating
    if (f >= prevLand && f < h.takeoff) {
      const sinceLand = f - prevLand;
      const toTake = h.takeoff - f;
      const land = i === 0 ? 0 : Math.max(0, 1 - sinceLand / 4);
      const antic = h.height > 0 ? Math.max(0, 1 - toTake / 3) : 0;
      const sq = 1 - 0.15 * land * land - 0.08 * smooth(antic);
      return { s: h.s0, lift: 0, sy: sq, sxz: 1 / Math.sqrt(sq), tuck: 0, moving: true };
    }
    // in the air
    if (f >= h.takeoff && f < h.land) {
      const u = (f - h.takeoff) / (h.land - h.takeoff);
      const s = h.s0 + (h.s1 - h.s0) * u;
      const lift = h.height * 4 * u * (1 - u);
      // stretch leaving the ground, round at the top, a little stretch reaching down
      const st = h.height > 0 ? 1 + 0.07 * Math.max(0, 1 - u * 3) + 0.03 * Math.max(0, u * 3 - 2) : 1;
      return { s, lift, sy: st, sxz: 1 / Math.sqrt(st), tuck: h.height > 0 ? Math.sin(Math.PI * u) : 0, moving: true };
    }
  }
  // after the last landing: the squash settles
  const last = hops[hops.length - 1];
  const since = f - last.land;
  const land = Math.max(0, 1 - since / 5);
  const sq = 1 - 0.15 * land * land;
  return { ...rest, s: w.s1, sy: sq, sxz: 1 / Math.sqrt(sq), moving: since < 0 };
}

/** The path speed's sign at f (for heading): +1 forward, 0 when not travelling. */
export function travelling(w: Walk, f: number): boolean {
  return f > w.from && f < w.to;
}

