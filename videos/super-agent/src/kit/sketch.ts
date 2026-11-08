/**
 * Sketch lines: tapered, variable-width strokes, drawn as filled outline polygons (not SVG strokes),
 * so the width can swell and thin along the line like a pen's pressure. The pressure and a slight
 * wander off the path are seeded value noise along the line's length (@aiv/core): the same points
 * and seed give the same outline on every frame and every render. A second, thinner and looser
 * "scribble" pass over the first makes it read as drawn by hand.
 *
 * Outlines are in the units of the points (world units under the camera), so a sketch line zooms
 * with the world. Pure: tested in sketch.test.ts.
 */
import { hash32, hashString, rand, valueNoise } from '@aiv/core';

export type Pt = readonly [number, number];

export interface SketchOptions {
  /** the full width of the stroke where the pressure is highest */
  width: number;
  seed: number;
  id: string | number;
  /** the share of the length each end tapers over, 0..0.5 (default 0.18) */
  taper?: number;
  /** how much the pressure thins the stroke, 0..1 (default 0.4) */
  pressure?: number;
  /** length of one swell of pressure (default 80) */
  pressureScale?: number;
  /** how far the line wanders off its path (default 1.2) */
  wobble?: number;
  /** length of one wander (default 140) */
  wobbleScale?: number;
  /** spacing of the outline's points along the line (default 4) */
  spacing?: number;
  /** the part of the line drawn, as shares of its length: drawing on runs `to` from 0 to 1 */
  from?: number;
  to?: number;
  /** where a line is cut short (`from` > 0 or `to` < 1), it tapers over this length (default 3 widths) */
  head?: number;
  /** how loose sketchPasses' second, scribble pass is: 0 none, 1 the default; it scales how far it strays from the line */
  scribble?: number;
}

export interface StrokeSample {
  x: number;
  y: number;
  /** the stroke's width here */
  w: number;
  /** the unit normal (to the left of the direction of travel) */
  nx: number;
  ny: number;
}

/** A smooth curve through the points (uniform Catmull-Rom), as a dense polyline. */
export function smoothThrough(points: readonly Pt[], steps = 12): Pt[] {
  if (points.length < 3) return [...points];
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** 0 at a tip, rising to 1 over `t` of 0..1 with a pointed start. */
const tip = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) * (1 - x);
};

/** The outline samples of a sketch line through `points` (smoothed), from `from` to `to` of its length. */
export function strokeSamples(points: readonly Pt[], o: SketchOptions): StrokeSample[] {
  if (points.length < 2) throw new Error('sketch: a line needs at least two points');
  const dense = smoothThrough(points);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const L = cum[cum.length - 1];
  if (L <= 0) return [];
  const taper = Math.min(0.5, Math.max(1e-6, o.taper ?? 0.18));
  const pressure = o.pressure ?? 0.4;
  const pScale = o.pressureScale ?? 80;
  const wobble = o.wobble ?? 1.2;
  const wScale = o.wobbleScale ?? 140;
  const spacing = Math.max(0.5, o.spacing ?? 4);
  const s0 = Math.max(0, Math.min(1, o.from ?? 0)) * L;
  const s1 = Math.max(0, Math.min(1, o.to ?? 1)) * L;
  if (s1 <= s0) return [];
  const head = o.head ?? 3 * o.width;
  const seed = hash32(o.seed, typeof o.id === 'string' ? hashString(o.id) : o.id);

  // position and direction at arc length s on the dense polyline
  let seg = 1;
  const at = (s: number) => {
    while (seg < dense.length - 1 && cum[seg] < s) seg++;
    while (seg > 1 && cum[seg - 1] > s) seg--;
    const a = dense[seg - 1];
    const b = dense[seg];
    const len = cum[seg] - cum[seg - 1] || 1;
    const t = (s - cum[seg - 1]) / len;
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / len, dy: (b[1] - a[1]) / len };
  };

  // samples on a fixed lattice along the line, plus both ends: a line being drawn on grows without
  // its outline points sliding
  const at0 = [s0];
  for (let k = Math.floor(s0 / spacing) + 1; k * spacing < s1; k++) at0.push(k * spacing);
  at0.push(s1);
  const out: StrokeSample[] = [];
  for (const s of at0) {
    const p = at(s);
    const u = s / L;
    // the taper is set by the whole line, so a line being drawn keeps its shape
    let w = o.width * tip(Math.min(u, 1 - u) / taper) * (1 - pressure * valueNoise(s / pScale, 0.5, seed));
    // a line cut short (being drawn on, or erased from its start) tapers at the cut as a pen's tip
    if (s1 < L && head > 0) w *= tip((s1 - s) / head);
    if (s0 > 0 && head > 0) w *= tip((s - s0) / head);
    const nx = -p.dy;
    const ny = p.dx;
    const off = wobble * (2 * valueNoise(s / wScale, 7.5, seed ^ 0x5bd1e995) - 1);
    out.push({ x: p.x + nx * off, y: p.y + ny * off, w, nx, ny });
  }
  return out;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The outline of a sketch line as a closed SVG path (fill it in the sketch tone; no stroke). */
export function sketchStroke(points: readonly Pt[], o: SketchOptions): string {
  const ss = strokeSamples(points, o);
  if (ss.length < 2) return '';
  const left = ss.map((s) => `${r2(s.x + (s.nx * s.w) / 2)} ${r2(s.y + (s.ny * s.w) / 2)}`);
  const right = ss.map((s) => `${r2(s.x - (s.nx * s.w) / 2)} ${r2(s.y - (s.ny * s.w) / 2)}`).reverse();
  return `M ${left.join(' L ')} L ${right.join(' L ')} Z`;
}

/**
 * Points round a rounded rectangle, as a hand draws it: clockwise from a point `start` of the way
 * along its top edge, once round, and `overshoot` past where it began (the pen closes the shape by
 * running over its first stroke). Arcs and edges alike are sampled every `step` units or closer:
 * the smoothing through them (smoothThrough) then keeps the edges straight and meets each corner
 * without a jog, which a long edge given only its two ends would bulge into. Feed it to sketchPasses.
 */
export function roundedRectLoop(x: number, y: number, w: number, h: number, r: number, start = 0.2, overshoot = 24, step = 6): Pt[] {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  const arc = (cx: number, cy: number, a0: number): Pt[] => {
    const n = Math.max(2, Math.ceil((Math.PI / 2) * q / step));
    return Array.from({ length: n + 1 }, (_, k) => {
      const a = a0 + (k / n) * (Math.PI / 2);
      return [cx + q * Math.cos(a), cy + q * Math.sin(a)] as Pt;
    });
  };
  // once round, clockwise on screen (y down) from the top-left corner's end
  const ring: Pt[] = [
    ...arc(x + w - q, y + q, -Math.PI / 2),
    ...arc(x + w - q, y + h - q, 0),
    ...arc(x + q, y + h - q, Math.PI / 2),
    ...arc(x + q, y + q, Math.PI),
  ];
  const s = x + q + start * (w - 2 * q);
  const out: Pt[] = [[s, y], ...ring, [s, y]];
  // the overshoot runs on along the top edge, never past its straight part
  const end = Math.min(x + w - q, s + overshoot);
  if (end > s + 1e-6) out.push([end, y]);
  // the straight edges, sampled as finely as the arcs
  const dense: Pt[] = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const [a, b] = [out[i - 1], out[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) dense.push(k === n ? b : [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return dense;
}

/**
 * A polyline as a hand follows it: straight runs sampled every `step` units and each corner rounded
 * over the tangent length a circle of `radius` would take (shorter where a run is too short), by a
 * quadratic curve tangent to both runs, so that the smoothing of a sketch line keeps the runs
 * straight and bends only at the corners. Feed it to sketchPasses.
 */
export function roundedPolyline(points: readonly Pt[], radius: number, step = 24): Pt[] {
  if (points.length < 2) throw new Error('roundedPolyline: a line needs at least two points');
  // where each corner's arc starts and ends: the corner pulled back along both runs
  const cut: { a: Pt; b: Pt; c: Pt }[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1];
    const c = points[i];
    const n = points[i + 1];
    const lin = Math.hypot(c[0] - p[0], c[1] - p[1]);
    const lout = Math.hypot(n[0] - c[0], n[1] - c[1]);
    const u: Pt = [(c[0] - p[0]) / lin, (c[1] - p[1]) / lin];
    const v: Pt = [(n[0] - c[0]) / lout, (n[1] - c[1]) / lout];
    const turn = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    const t = turn < 1e-6 ? 0 : Math.min(radius * Math.tan(turn / 2), lin / 2, lout / 2);
    cut.push({ a: [c[0] - u[0] * t, c[1] - u[1] * t], b: [c[0] + v[0] * t, c[1] + v[1] * t], c });
  }
  const out: Pt[] = [];
  const run = (from: Pt, to: Pt) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = out.length ? 1 : 0; k <= n; k++) out.push([from[0] + ((to[0] - from[0]) * k) / n, from[1] + ((to[1] - from[1]) * k) / n]);
  };
  let from: Pt = points[0];
  for (const { a, b, c } of cut) {
    run(from, a);
    // the arc from a to b, tangent to both runs: a quadratic through the corner, sampled
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(2, Math.ceil(len / (step / 3)));
    for (let k = 1; k <= n; k++) {
      const s = k / n;
      const q = (1 - s) * (1 - s);
      const m = 2 * (1 - s) * s;
      const r = s * s;
      out.push([q * a[0] + m * c[0] + r * b[0], q * a[1] + m * c[1] + r * b[1]]);
    }
    from = b;
  }
  run(from, points[points.length - 1]);
  return out;
}

/**
 * A line broken into `n` dashes, as shares of its length: seeded lengths, the gaps taking `gap`
 * of the whole, the first dash starting at 0 and the last ending at 1. With `n` = 1 the line is
 * whole. Pure: the same seed and id give the same dashes.
 */
export function dashRuns(n: number, gap: number, seed: number, id: string | number): [number, number][] {
  const count = Math.max(1, Math.floor(n));
  if (count === 1) return [[0, 1]];
  const g = Math.min(0.9, Math.max(0, gap)) / (count - 1);
  const weights = Array.from({ length: count }, (_, k) => 0.55 + rand(seed, id, k));
  const sum = weights.reduce((a, b) => a + b, 0);
  const ink = 1 - g * (count - 1);
  const out: [number, number][] = [];
  let t = 0;
  for (const wt of weights) {
    const len = (ink * wt) / sum;
    out.push([t, t + len]);
    t += len + g;
  }
  out[out.length - 1][1] = 1;
  return out;
}

/**
 * The two passes of a hand-drawn line: the main stroke, and a thinner, looser scribble over it
 * that starts a little later and ends a little sooner, as a pen going back over a line does.
 */
export function sketchPasses(points: readonly Pt[], o: SketchOptions): [string, string] {
  const loose = Math.max(0, o.scribble ?? 1);
  if (loose === 0) return [sketchStroke(points, o), ''];
  const from = o.from ?? 0;
  const to = o.to ?? 1;
  const sFrom = Math.max(from, 0.06);
  const sTo = Math.min(to, 0.9);
  const scribble: SketchOptions = {
    ...o,
    id: `${o.id}:scribble`,
    width: o.width * 0.45,
    wobble: loose * ((o.wobble ?? 1.2) * 2.5 + o.width * 0.4),
    wobbleScale: (o.wobbleScale ?? 140) * 0.55,
    from: sFrom,
    to: sTo,
  };
  return [sketchStroke(points, o), sTo > sFrom ? sketchStroke(points, scribble) : ''];
}
