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
import { hash32, hashString, valueNoise } from '@aiv/core';

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
 * The two passes of a hand-drawn line: the main stroke, and a thinner, looser scribble over it
 * that starts a little later and ends a little sooner, as a pen going back over a line does.
 */
export function sketchPasses(points: readonly Pt[], o: SketchOptions): [string, string] {
  const from = o.from ?? 0;
  const to = o.to ?? 1;
  const sFrom = Math.max(from, 0.06);
  const sTo = Math.min(to, 0.9);
  const scribble: SketchOptions = {
    ...o,
    id: `${o.id}:scribble`,
    width: o.width * 0.45,
    wobble: (o.wobble ?? 1.2) * 2.5 + o.width * 0.4,
    wobbleScale: (o.wobbleScale ?? 140) * 0.55,
    from: sFrom,
    to: sTo,
  };
  return [sketchStroke(points, o), sTo > sFrom ? sketchStroke(points, scribble) : ''];
}
