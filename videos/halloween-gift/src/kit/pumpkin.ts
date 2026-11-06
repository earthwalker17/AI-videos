/**
 * Pumpkins as geometry: a ribbed, lopsided, warty shell built as a parametric surface whose
 * columns follow the ribs (every groove lies on a grid line, so the creases stay crisp and never
 * zipper), carved right through with exact polygon cuts. No alpha cut-outs, no face texture.
 *
 *  - The body: an oblate ellipsoid with a deep dimple at the stem and a flattened seat; ribs of
 *    seeded, uneven widths (round lobes, sharp grooves that run into the dimple), each rib
 *    bulging by its own amount, a slow spiral; a lopsided swell and lean; clusters of flat warts
 *    and fine dimpling; a heavy brow over the eyes, and teeth that stand proud of the rind with a
 *    ridge down their middles (carved forms, not a flat stencil).
 *  - The carvings: seeded polygons in the face's angular coordinates (u around, v up on the body
 *    stretched to a sphere), the grin built tooth by tooth. The rind around each cut is
 *    re-triangulated (earcut) against the exact polygon, so the knife edges are straight and the
 *    tooth tips sharp at any mesh resolution; a narrow knife bevel runs along every outer edge
 *    (a crisp highlight line), and the cut walls run through the shell's thickness to the inner
 *    wall, the hole narrowing inward by the knife's slope (never far enough to close a thin slit
 *    or a gap between teeth: each point moves at most 45 % of the way to the hole's medial axis).
 *  - The inner wall: a smoother copy of the body facing in. Its front (behind the face) is
 *    back-facing from anywhere outside, so it needs no holes; through the cuts one sees its far
 *    side, the cavity.
 *  - A tall ridged stem (flared woody base, twisted ridges, a curling tip) and a dry vine tendril.
 *
 * The output is one non-indexed geometry with RGBA vertex colours (alpha scales the moon rim: 1 on
 * the rind, low on the stem and the bevels, 0 in the cuts) and a `uv` whose x indexes one emission
 * ramp: the rind's faint glow toward a cut (0..0.1), the knife bevel (0.16..0.26), the cut wall
 * from the rind to its inner edge (0.38..0.7), the cavity, hotter by the candle (0.72..1). Colours
 * are linear RGB; without emission the cut faces are dark flesh, darker inward, and the cavity is
 * near black, so a dead jack-o'-lantern still reads as a carved, dark-eyed gourd.
 *
 * Deterministic: noise is hashed from coordinates and seeds; randomness from @aiv/core `rand`.
 * Generic: no film imports.
 */
import { rand } from '@aiv/core';
import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Earcut } from 'three/src/extras/Earcut.js';
import { Curve } from './spline.ts';
import { fbm3, noise3, type V3 } from './stone.ts';

export type { V3 };

export type Carve = 'angry' | 'grin' | 'small' | 'round' | 'none';
/** a closed polygon in face coordinates (u, v), radians */
export type Poly = [number, number][];

export interface StemSpec {
  /** height above the top of the body (world units) */
  h: number;
  /** base radius */
  r: number;
  /** how far the tip curls over (0 straight .. 1 a hook) */
  curl: number;
  /** lean of the lower stem (world units at its middle) */
  lean: number;
  /** ridge twist along the stem (radians) */
  twist: number;
  /** turn of the stem's curl about y */
  yaw: number;
}

export interface PumpkinSpec {
  seed: number;
  /** across (x, z), world units */
  width: number;
  /** the body's height over its width */
  squat: number;
  ribs: number;
  /** groove depth, a fraction of the radius */
  ribDepth: number;
  /** lobe exponent: lower is flatter lobes and sharper grooves */
  ribSharp: number;
  /** the stem dimple's depth (fraction of the radius) */
  dimple: number;
  /** lopsided swell (fraction of the radius) */
  lopsided: number;
  /** lean of the body (radians) */
  lean: number;
  /** wart clusters */
  warts: number;
  /** wart height (fraction of the width) */
  wartSize: number;
  /** wall thickness (fraction of the width) */
  wall: number;
  carve: Carve;
  /** the face's centre: turn about y (radians, 0 faces +z) and elevation */
  faceYaw: number;
  faceTilt: number;
  /** the face's size multiplier */
  faceScale: number;
  /** the knife's slope: how far a hole narrows from the rind to the inner wall (fraction of the wall) */
  bevel: number;
  /** the knife bevel along every cut's outer edge: its width (fraction of the width) */
  chamfer: number;
  /** a heavy brow ridge over the eyes (0..1) */
  brow: number;
  /** the teeth stand proud of the rind, ridged down their middles (0..1) */
  proud: number;
  /** cut the top off (a pail) above this elevation (radians), or null */
  openTop: number | null;
  stem: StemSpec | null;
  vine: boolean;
  /** mesh resolution: columns per rib, rows from pole to pole */
  cols: number;
  rows: number;
  /** skin colours (sRGB): lobe, groove, a sun-browned patch, the stem, the cut flesh */
  colors: { skin: string; groove: string; patch: string; stem: string; flesh: string };
  /**
   * the direction toward the key light (local), or null: the rind's paint turns cooler and greyer
   * on the side facing away (a painter's shadow side, so the darks read cool, not maroon)
   */
  shade?: V3 | null;
}

export interface PumpkinBuild {
  /** the rind, the cut faces and the cavity, with the stem and the vine merged in */
  geometry: BufferGeometry;
  /** local y of the body's lowest point (the body centre is y = 0) */
  bottom: number;
  /** local y of the top of the body at the stem */
  top: number;
  /** where a candle stands inside (local) */
  candle: V3;
  /** the stem's tip (local) */
  stemTip: V3;
  triangles: number;
}

const TAU = Math.PI * 2;
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const wrapPi = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

/** Signed distance to a polygon (negative inside), any winding (Inigo Quilez's crossing test). */
function sdPoly(px: number, py: number, v: Float64Array): number {
  const n = v.length / 2;
  let d = (px - v[0]) ** 2 + (py - v[1]) ** 2;
  let s = 1;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const vix = v[i * 2];
    const viy = v[i * 2 + 1];
    const ex = v[j * 2] - vix;
    const ey = v[j * 2 + 1] - viy;
    const wx = px - vix;
    const wy = py - viy;
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-12), 0, 1);
    const bx = wx - ex * t;
    const by = wy - ey * t;
    const dd = bx * bx + by * by;
    if (dd < d) d = dd;
    const c1 = py >= viy;
    const c2 = py < v[j * 2 + 1];
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

/**
 * `sdPoly` over one fixed polygon, bit-identical (the same arithmetic per edge) and much faster:
 * its edges worked out once, and a grid that tells, per cell, which edges can be the nearest
 * (the distance is the least of theirs, as of all) and, away from the outline, the sign.
 */
class PolyField {
  private readonly n: number;
  private readonly v0x: number;
  private readonly v0y: number;
  private readonly e: Float64Array;
  /** scratch: each edge's squared distance to its bounds */
  private readonly lb: Float64Array;
  private readonly grid: { x0: number; y0: number; cs: number; nx: number; ny: number; cells: Int32Array[]; sign: Int8Array; rows: Int32Array[] };
  /** the polygon's bounds */
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  constructor(v: Float64Array, pad = 0.35) {
    const n = v.length / 2;
    this.n = n;
    this.v0x = v[0];
    this.v0y = v[1];
    this.lb = new Float64Array(n);
    // per edge: vix, viy, ex, ey, |e|² (or 1e-12), vjy, then its bounds x0, x1, y0, y1
    this.e = new Float64Array(n * 10);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0, j = n - 1; i < n; j = i, i++) {
      const vix = v[i * 2];
      const viy = v[i * 2 + 1];
      const ex = v[j * 2] - vix;
      const ey = v[j * 2 + 1] - viy;
      const o = i * 10;
      this.e[o] = vix;
      this.e[o + 1] = viy;
      this.e[o + 2] = ex;
      this.e[o + 3] = ey;
      this.e[o + 4] = ex * ex + ey * ey || 1e-12;
      this.e[o + 5] = v[j * 2 + 1];
      this.e[o + 6] = Math.min(vix, v[j * 2]);
      this.e[o + 7] = Math.max(vix, v[j * 2]);
      this.e[o + 8] = Math.min(viy, v[j * 2 + 1]);
      this.e[o + 9] = Math.max(viy, v[j * 2 + 1]);
      x0 = Math.min(x0, vix);
      x1 = Math.max(x1, vix);
      y0 = Math.min(y0, viy);
      y1 = Math.max(y1, viy);
    }
    this.x0 = x0;
    this.x1 = x1;
    this.y0 = y0;
    this.y1 = y1;
    this.grid = this.buildGrid(pad);
  }
  /** sdPoly's squared distance from (px, py) to edge o (its offset in `e`). */
  private edge2(o: number, px: number, py: number): number {
    const E = this.e;
    const ex = E[o + 2];
    const ey = E[o + 3];
    const wx = px - E[o];
    const wy = py - E[o + 1];
    const t = clamp((wx * ex + wy * ey) / E[o + 4], 0, 1);
    const bx = wx - ex * t;
    const by = wy - ey * t;
    return bx * bx + by * by;
  }
  /** = sdPoly(px, py, v): from the grid where (px, py) falls in it, else in full */
  sd(px: number, py: number): number {
    const g = this.grid;
    const i = Math.floor((px - g.x0) / g.cs);
    const j = Math.floor((py - g.y0) / g.cs);
    if (!(i >= 0 && j >= 0 && i < g.nx && j < g.ny)) return this.full(px, py);
    const c = j * g.nx + i;
    const list = g.cells[c];
    let d = (px - this.v0x) ** 2 + (py - this.v0y) ** 2;
    for (let q = 0; q < list.length; q++) {
      const dd = this.edge2(list[q], px, py);
      if (dd < d) d = dd;
    }
    const s = g.sign[c] !== 0 ? g.sign[c] : this.crossingOf(g.rows[j], px, py);
    return s * Math.sqrt(d);
  }
  /**
   * The crossing test over the edges listed (offsets): those whose heights reach the row of the
   * point (an edge that does not reach py never flips the sign; the flips commute).
   */
  private crossingOf(list: Int32Array, px: number, py: number): number {
    const E = this.e;
    let s = 1;
    for (let q = 0; q < list.length; q++) {
      const o = list[q];
      const viy = E[o + 1];
      const c1 = py >= viy;
      const c2 = py < E[o + 5];
      if (c1 === c2 && c1 === (E[o + 2] * (py - viy) > E[o + 3] * (px - E[o]))) s = -s;
    }
    return s;
  }
  /** sdPoly's sign at (px, py): its crossing test over every edge */
  private crossing(px: number, py: number): number {
    const E = this.e;
    let s = 1;
    for (let o = 0; o < this.n * 10; o += 10) {
      const viy = E[o + 1];
      const c1 = py >= viy;
      const c2 = py < E[o + 5];
      // (sdPoly's flip: c1, c2 and c3 all true or all false)
      if (c1 === c2 && c1 === (E[o + 2] * (py - viy) > E[o + 3] * (px - E[o]))) s = -s;
    }
    return s;
  }
  /** = sdPoly(px, py, v), every edge looked at (only the nearest bounds' edges measured) */
  full(px: number, py: number): number {
    const lb = this.lb;
    const n = this.n;
    // (NaN: no edge is nearest, every bound test fails, and d is NaN already)
    let near = Infinity;
    let on = -1;
    for (let k = 0, o = 0; k < n; k++, o += 10) {
      const q = this.box2(o, px, py);
      lb[k] = q;
      if (q < near) {
        near = q;
        on = o;
      }
    }
    const lim = on >= 0 ? (Math.sqrt(this.edge2(on, px, py)) + 1e-12) ** 2 : Infinity;
    let d = (px - this.v0x) ** 2 + (py - this.v0y) ** 2;
    for (let k = 0, o = 0; k < n; k++, o += 10) {
      if (lb[k] > lim) continue;
      const dd = this.edge2(o, px, py);
      if (dd < d) d = dd;
    }
    return this.crossing(px, py) * Math.sqrt(d);
  }
  /** squared distance from (px, py) to edge o's bounds */
  private box2(o: number, px: number, py: number): number {
    const E = this.e;
    const qx = px < E[o + 6] ? E[o + 6] - px : px > E[o + 7] ? px - E[o + 7] : 0;
    const qy = py < E[o + 8] ? E[o + 8] - py : py > E[o + 9] ? py - E[o + 9] : 0;
    return qx * qx + qy * qy;
  }
  /**
   * A grid over the bounds (and `pad` round them): per cell, the edges that can be nearest to a
   * point in it (within the nearest edge's distance from the cell's centre plus two half
   * diagonals, and 1e-9: as world/Terrain's NearLine), and the sign where the cell lies wholly on
   * one side, more than 1e-9 clear of the outline (there every point's crossing test gives the
   * centre's: rounding can flip it only within ~1e-15 of an edge); 0 where the outline is near.
   */
  private buildGrid(pad: number): { x0: number; y0: number; cs: number; nx: number; ny: number; cells: Int32Array[]; sign: Int8Array; rows: Int32Array[] } {
    const n = this.n;
    const x0 = this.x0 - pad;
    const y0 = this.y0 - pad;
    const span = Math.max(this.x1 - this.x0, this.y1 - this.y0) + 2 * pad;
    const cs = Math.max(1e-4, span / 48);
    const nx = Math.max(1, Math.ceil((this.x1 + pad - x0) / cs));
    const ny = Math.max(1, Math.ceil((this.y1 + pad - y0) / cs));
    const cells: Int32Array[] = [];
    const sign = new Int8Array(nx * ny);
    const rows: Int32Array[] = [];
    if (!(n > 0 && Number.isFinite(span) && nx * ny <= 1e5)) return { x0, y0, cs, nx: 0, ny: 0, cells, sign, rows };
    // each row's edges: those whose heights reach the row's (1e-9 wider, for a point's rounding into it)
    for (let j = 0; j < ny; j++) {
      const r0 = y0 + j * cs - 1e-9;
      const r1 = y0 + (j + 1) * cs + 1e-9;
      const list: number[] = [];
      for (let k = 0; k < n; k++) if (!(this.e[k * 10 + 9] < r0 || this.e[k * 10 + 8] > r1)) list.push(k * 10);
      rows.push(Int32Array.from(list));
    }
    const half = (cs * Math.SQRT2) / 2;
    const ds = new Float64Array(n);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const cx = x0 + (i + 0.5) * cs;
        const cy = y0 + (j + 0.5) * cs;
        let near = Infinity;
        let kn = -1;
        for (let k = 0; k < n; k++) {
          ds[k] = this.box2(k * 10, cx, cy);
          if (ds[k] < near) {
            near = ds[k];
            kn = k;
          }
        }
        const ub = Math.sqrt(this.edge2(kn * 10, cx, cy));
        const far = (ub + 2 * half + 2e-9) ** 2;
        let m = Infinity;
        for (let k = 0; k < n; k++) {
          ds[k] = ds[k] > far ? NaN : Math.sqrt(this.edge2(k * 10, cx, cy));
          if (ds[k] < m) m = ds[k];
        }
        const list: number[] = [];
        for (let k = 0; k < n; k++) if (ds[k] - half <= m + half + 1e-9) list.push(k * 10);
        cells.push(Int32Array.from(list));
        sign[j * nx + i] = m > half + 1e-9 ? this.crossingOf(rows[j], cx, cy) : 0;
      }
    return { x0, y0, cs, nx, ny, cells, sign, rows };
  }
  /** Squared distance from (px, py) to the polygon's bounds (0 inside them). */
  boxDist2(px: number, py: number): number {
    const qx = Math.max(this.x0 - px, px - this.x1, 0);
    const qy = Math.max(this.y0 - py, py - this.y1, 0);
    return qx * qx + qy * qy;
  }
}

const polyArea = (p: Poly | [number, number][]) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
};
const ccw = (p: Poly): Poly => (polyArea(p) < 0 ? [...p].reverse() : p);
const flat = (p: Poly) => Float64Array.from(p.flat());

// ---- faces ------------------------------------------------------------------------------------

interface GrinOpts {
  left: number;
  right: number;
  /** the corners' height */
  corner: number;
  /** how far the upper lip sags to the middle, and the lower lip drops */
  upper: number;
  lower: number;
  up: number;
  down: number;
  /** tooth lengths, fractions of the lips' gap where they stand */
  upLen: number;
  downLen: number;
  /** the rows' half-spans (fractions of the mouth's half-width) and tooth widths (of the spacing) */
  upSpan?: number;
  downSpan?: number;
  upWidth?: number;
  downWidth?: number;
  /** tooth flank exponent: < 1 broad, bulging fangs; > 1 thin spikes */
  upGamma?: number;
  downGamma?: number;
  samples?: number;
}

/**
 * A grin built tooth by tooth between two pointed corners: the upper lip sags to the middle, the
 * lower lip drops deep; upper fangs hang down and lower teeth rise between them, each a fraction of
 * the lips' gap where it stands (irregular widths, lengths and tilts), the two rows scaled
 * together so they never meet. Also returns the lips' envelope (the mouth without its teeth).
 */
function grin(r: (k: number) => number, o: GrinOpts): { hole: Poly; envelope: Poly } {
  const { left, right, corner, upper, lower } = o;
  const w = (right - left) / 2;
  const cx = (right + left) / 2;
  const yUp = (n: number) => corner - upper * (1 - n * n);
  const yLo = (n: number) => corner - lower * Math.pow(Math.max(0, 1 - n * n), 0.62);
  interface Tooth {
    c: number;
    hw: number;
    len: number;
    tilt: number;
    g: number;
  }
  const row = (count: number, span: number, width: number, k0: number, len: number, g: number): Tooth[] => {
    const step = (2 * span) / Math.max(1, count);
    return Array.from({ length: count }, (_, i) => ({
      c: -span + step * (i + 0.5) + (r(k0 + i) - 0.5) * step * 0.2,
      hw: (step * width * (0.85 + 0.3 * r(k0 + 10 + i))) / 2,
      len: len * (0.8 + 0.35 * r(k0 + 20 + i)),
      tilt: (r(k0 + 30 + i) - 0.5) * 0.6,
      g,
    }));
  };
  const ups = row(o.up, o.upSpan ?? 0.66, o.upWidth ?? 0.9, 10, o.upLen, o.upGamma ?? 1);
  const los = row(o.down, o.downSpan ?? 0.72, o.downWidth ?? 0.7, 50, o.downLen, o.downGamma ?? 1);
  const tooth = (n: number, t: Tooth) => {
    if (Math.abs(n - t.c) >= t.hw) return 0;
    const tip = t.c + t.tilt * t.hw;
    const p = n < tip ? (n - (t.c - t.hw)) / (tip - (t.c - t.hw)) : (t.c + t.hw - n) / (t.c + t.hw - tip);
    return Math.pow(clamp(p, 0, 1), t.g);
  };
  const drop = (n: number) => ups.reduce((acc, t) => acc + t.len * tooth(n, t), 0);
  const rise = (n: number) => los.reduce((acc, t) => acc + t.len * tooth(n, t), 0);
  const fit = (n: number) => {
    const sum = drop(n) + rise(n);
    return sum > 0.82 ? 0.82 / sum : 1;
  };
  const N = o.samples ?? 48;
  // every tooth's shoulders and tip exactly (crisp points), its curved flanks sampled densely
  const teethN = (ts: Tooth[]) => {
    const out: number[] = [];
    for (const t of ts) {
      const tip = t.c + t.tilt * t.hw;
      const sides = t.g === 1 ? 1 : 7;
      for (let q = 0; q <= sides; q++) {
        out.push(t.c - t.hw + (tip - (t.c - t.hw)) * (q / sides));
        out.push(tip + (t.c + t.hw - tip) * (q / sides));
      }
    }
    return out;
  };
  const uniq = (xs: number[], lo: number, hi: number) => [...new Set(xs.filter((q) => q >= lo && q <= hi).map((q) => Math.round(q * 1e9) / 1e9))].sort((p, q) => p - q);
  const upN = uniq([...Array.from({ length: N + 1 }, (_, i) => -1 + (2 * i) / N), ...teethN(ups)], -1, 1);
  const loN = uniq([...Array.from({ length: N - 1 }, (_, i) => -1 + (2 * (i + 1)) / N), ...teethN(los)], -1 + 1e-6, 1 - 1e-6);
  const hole: Poly = [];
  for (const n of upN) {
    const gap = yUp(n) - yLo(n);
    hole.push([cx + n * w, yUp(n) - gap * drop(n) * fit(n)]);
  }
  for (const n of loN.reverse()) {
    const gap = yUp(n) - yLo(n);
    hole.push([cx + n * w, yLo(n) + gap * rise(n) * fit(n)]);
  }
  const envelope: Poly = [];
  for (let i = 0; i <= N; i++) envelope.push([cx + (-1 + (2 * i) / N) * w, yUp(-1 + (2 * i) / N)]);
  for (let i = N - 1; i > 0; i--) envelope.push([cx + (-1 + (2 * i) / N) * w, yLo(-1 + (2 * i) / N)]);
  return { hole, envelope };
}

/** A triangle eye: base corners and an apex, jittered. */
function triEye(side: -1 | 1, r: (k: number) => number, o: { inner: number; outer: number; base: number; apexU: number; apex: number }): Poly {
  const j = (k: number, a: number) => (r(k) - 0.5) * a;
  return [
    [side * (o.inner + j(1, 0.03)), o.base + j(2, 0.02)],
    [side * (o.outer + j(3, 0.04)), o.base + j(4, 0.03)],
    [side * (o.apexU + j(5, 0.04)), o.apex + j(6, 0.05)],
  ];
}

/**
 * An angry slit eye: the brow's straight cut from a pointed inner tip (low, by the nose) up to
 * the outer end, the lower lid an arc sagging below it, deepest toward the outside.
 */
function slitEye(side: -1 | 1, r: (k: number) => number, o: { iu: number; iv: number; ou: number; ov: number; depth: number }): Poly {
  const j = (k: number, a: number) => (r(k) - 0.5) * a;
  const I: [number, number] = [side * (o.iu + j(1, 0.03)), o.iv + j(2, 0.03)];
  const O: [number, number] = [side * (o.ou + j(3, 0.04)), o.ov + j(4, 0.03)];
  const dx = O[0] - I[0];
  const dy = O[1] - I[1];
  const L = Math.hypot(dx, dy);
  let nx = -dy / L;
  let ny = dx / L;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const pts: Poly = [I, [I[0] + dx * 0.5 - nx * 0.01, I[1] + dy * 0.5 - ny * 0.01], O];
  const depth = o.depth * (0.9 + 0.2 * r(7));
  const M = 14;
  for (let k = 1; k < M; k++) {
    const t = 1 - k / M;
    const sag = depth * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.3)), 0.85);
    pts.push([I[0] + dx * t + nx * sag, I[1] + dy * t + ny * sag]);
  }
  return pts;
}

/** A round (oval) eye, a little uneven. */
function roundEye(side: -1 | 1, r: (k: number) => number, o: { u: number; v: number; ru: number; rv: number }): Poly {
  const pts: Poly = [];
  const M = 16;
  for (let k = 0; k < M; k++) {
    const a = (k / M) * TAU;
    const q = 1 + 0.08 * Math.sin(3 * a + r(1) * TAU) + 0.05 * Math.sin(5 * a + r(2) * TAU);
    pts.push([side * o.u + Math.cos(a) * o.ru * q, o.v + Math.sin(a) * o.rv * q]);
  }
  return pts;
}

interface Face {
  holes: Poly[];
  eyes: Poly[];
  mouth: Poly | null;
  envelope: Poly | null;
}

/** The face's holes (eyes, nose, mouth) and the shapes the relief follows (brows, teeth). */
function faceDesign(carve: Carve, seed: number, scale: number, big: boolean): Face {
  const r = (k: number) => rand(seed, 'face', k);
  const sc = (p: Poly): Poly => ccw(p.map(([u, v]) => [u * scale, v * scale]));
  const make = (eyes: Poly[], nose: Poly | null, m: { hole: Poly; envelope: Poly }): Face => ({
    holes: [...eyes, ...(nose ? [nose] : []), m.hole].map(sc),
    eyes: eyes.map(sc),
    mouth: sc(m.hole),
    envelope: sc(m.envelope),
  });
  const nose = (): Poly => [
    [-0.06 + (r(300) - 0.5) * 0.02, 0.0],
    [0.065 + (r(301) - 0.5) * 0.02, 0.005],
    [0.005 + (r(302) - 0.5) * 0.03, 0.11],
  ];
  if (carve === 'none') return { holes: [], eyes: [], mouth: null, envelope: null };
  if (carve === 'angry') {
    // two small slanted slits high on the shoulders under heavy brows; no nose; a huge crescent
    // grin with six long upper fangs and five lower teeth
    const eyes = ([-1, 1] as const).map((s) => slitEye(s, (k) => r(100 * (s + 2) + k), { iu: 0.15, iv: 0.55, ou: 0.45, ov: 0.7, depth: 0.08 }));
    const mouth = grin((k) => r(400 + k), {
      left: -1.05,
      right: 1.0,
      corner: 0.3,
      upper: 0.13,
      lower: 0.98,
      up: big ? 6 : 4,
      down: big ? 5 : 3,
      upLen: 0.56,
      downLen: 0.3,
      upGamma: 0.78,
      downGamma: 1.1,
      upSpan: 0.76,
      downSpan: 0.68,
      upWidth: 0.94,
      downWidth: 0.72,
      samples: big ? 96 : 48,
    });
    return make(eyes, null, mouth);
  }
  if (carve === 'round') {
    const eyes = ([-1, 1] as const).map((s) => roundEye(s, (k) => r(100 * (s + 2) + k), { u: 0.27 + (r(5) - 0.5) * 0.04, v: 0.24, ru: 0.085 + 0.02 * r(6), rv: 0.1 + 0.02 * r(7) }));
    const teeth = r(8) < 0.5 ? 1 : 0;
    const mouth = grin((k) => r(400 + k), { left: -0.56, right: 0.54, corner: 0.06, upper: 0.12, lower: 0.36, up: teeth, down: 1 - teeth, upLen: 0.5, downLen: 0.4 });
    return make(eyes, null, mouth);
  }
  if (carve === 'grin') {
    const tri = (s: -1 | 1) => triEye(s, (k) => r(100 * (s + 2) + k), { inner: 0.12, outer: 0.4, base: 0.12, apexU: 0.27, apex: 0.4 });
    const mouth = grin((k) => r(400 + k), { left: -0.62, right: 0.6, corner: 0.02, upper: 0.08, lower: 0.42, up: 1 + Math.floor(r(9) * 2.5), down: 1 + Math.floor(r(10) * 2), upLen: 0.45, downLen: 0.34 });
    return make([tri(-1), tri(1)], nose(), mouth);
  }
  // small: little triangle eyes and a thin smile with a tooth or two
  const tri = (s: -1 | 1) => triEye(s, (k) => r(100 * (s + 2) + k), { inner: 0.1, outer: 0.34, base: 0.12, apexU: 0.22, apex: 0.33 });
  const mouth = grin((k) => r(400 + k), { left: -0.48, right: 0.48, corner: 0.0, upper: 0.06, lower: 0.28, up: 1, down: 2, upLen: 0.4, downLen: 0.3 });
  return make([tri(-1), tri(1)], null, mouth);
}

/** The face's polygons for a carve style (centred on (0, 0) in face coordinates, counter-clockwise). */
export function facePolys(carve: Carve, seed: number, scale = 1, big = false): Poly[] {
  return faceDesign(carve, seed, scale, big).holes;
}

// ---- the body ---------------------------------------------------------------------------------

/** What a body point's paint needs (filled by `point`). */
interface Info {
  /** the rib, where across it (0 groove .. 1 groove), the lobe profile (0 groove .. 1 crown) */
  k: number;
  t: number;
  lobe: number;
  /** the direction's height (−1 bottom .. 1 top) */
  dy: number;
  /** distance to the nearest hole (face coordinates; 9 far from the face) */
  sdh: number;
  /** the surface normal (local), filled before painting */
  n: V3;
  /** on a tooth (inside the lips' envelope, outside the hole): 0..1 */
  tooth: number;
  /** inside the carved face's oval, where the ribs flatten out (0 off the face .. 1 its middle) */
  face?: number;
}

interface Wart {
  d: V3;
  h: number;
  w2: number;
}

function bodyModel(s: PumpkinSpec) {
  const a = s.width / 2;
  const c = a * s.squat;
  const N = s.ribs;
  const R = (k: number | string, j = 0) => rand(s.seed, k, j);
  // uneven rib boundaries (fractions of a turn), each rib's own bulge
  const bounds: number[] = [];
  for (let k = 0; k <= N; k++) bounds.push((k + (k === 0 || k === N ? 0 : (R('rb', k) - 0.5) * 0.8)) / N);
  const bulge = Array.from({ length: N }, (_, k) => 0.72 + 0.56 * R('bulge', k));
  const ph = R('phase') * TAU;
  const w1 = R('w1') * TAU;
  const w2 = R('w2') * TAU;
  const l1 = R('l1') * TAU;
  const l2 = R('l2') * TAU;
  const twist = (R('tw') - 0.5) * 0.5;
  // flat warts in clusters on the upper half and the shoulders
  const warts: Wart[] = [];
  for (let k = 0; k < s.warts; k++) {
    const th = R('wt', k) * TAU;
    const el = -0.15 + 0.85 * R('we', k);
    const n = 3 + Math.floor(R('wn', k) * 5);
    for (let m = 0; m < n; m++) {
      const t2 = th + (R('wx', k * 7 + m) - 0.5) * 0.13;
      const e2 = el + (R('wy', k * 7 + m) - 0.5) * 0.1;
      const ce = Math.cos(e2);
      const w = 0.018 + 0.028 * R('ww', k * 7 + m);
      warts.push({ d: [Math.sin(t2) * ce, Math.sin(e2), Math.cos(t2) * ce], h: s.wartSize * s.width * (0.35 + 0.65 * R('wh', k * 7 + m)), w2: w * w });
    }
  }
  const face = faceDesign(s.carve, s.seed, s.faceScale, s.width > 0.6);
  const holeF = face.holes.map(flat);
  const eyeF = face.eyes.map(flat);
  const eyeV = face.eyes.map((p) => p.reduce((acc, q) => acc + q[1], 0) / p.length);
  const mouthF = face.mouth ? flat(face.mouth) : null;
  const envF = face.envelope ? flat(face.envelope) : null;
  let uMin = 9;
  let uMax = -9;
  let vMin = 9;
  let vMax = -9;
  for (const p of face.holes)
    for (const [u, v] of p) {
      uMin = Math.min(uMin, u);
      uMax = Math.max(uMax, u);
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }
  const pad = 0.3;
  const inBox = (u: number, v: number) => u > uMin - pad && u < uMax + pad && v > vMin - pad && v < vMax + pad;
  // the face's oval: the carver's flattened field, where the ribs fade out (they crossed the eyes and the grin)
  const fcU = (uMin + uMax) / 2;
  const fcV = (vMin + vMax) / 2;
  const fhU = Math.max(0.05, (uMax - uMin) / 2) * 1.25;
  const fhV = Math.max(0.05, (vMax - vMin) / 2) * 1.45;
  const faceAt = (u: number, v: number) => {
    const q = ((u - fcU) / fhU) ** 2 + ((v - fcV) / fhV) ** 2;
    return Math.exp(-q * q * 1.2);
  };
  const holeP = holeF.map((p) => new PolyField(p));
  const eyeP = eyeF.map((p) => new PolyField(p));
  const mouthP = mouthF ? new PolyField(mouthF) : null;
  const envP = envF ? new PolyField(envF) : null;
  const holeBox = new Float64Array(holeP.length);
  /**
   * The nearest hole's signed distance (the first nearest, as a scan in order finds it). A hole
   * whose bounds lie beyond the exact distance to the hole with the nearest bounds cannot be the
   * nearest (outside its bounds a point is outside it, at least that far): it is not measured.
   */
  const sdHoles = (u: number, v: number) => {
    if (!inBox(u, v)) return 9;
    let kn = -1;
    let bn = Infinity;
    for (let k = 0; k < holeP.length; k++) {
      holeBox[k] = holeP[k].boxDist2(u, v);
      if (holeBox[k] < bn) {
        bn = holeBox[k];
        kn = k;
      }
    }
    // (beyond ub + 1e-12, far beyond rounding: such a hole's distance exceeds ub)
    const ub = kn >= 0 ? holeP[kn].sd(u, v) : Infinity;
    const lim = ub + 1e-12;
    const lim2 = lim * lim;
    let sd = 9;
    for (let k = 0; k < holeP.length; k++) {
      if (k !== kn && (lim < 0 ? holeBox[k] > 0 : holeBox[k] > lim2)) continue;
      const q = k === kn ? ub : holeP[k].sd(u, v);
      if (q < sd) sd = q;
    }
    return sd;
  };
  const T = s.wall * s.width;
  const cl = Math.cos(s.lean);
  const sl = Math.sin(s.lean);
  const dyOf = (el: number) => (c * Math.sin(el)) / Math.hypot(a * Math.cos(el), c * Math.sin(el));
  const browH = s.brow * 0.022 * s.width;
  const proudH = s.proud * 0.012 * s.width;
  const sc = s.faceScale;

  // (the lobe profile's constant powers, once)
  const lobeE = 0.006;
  const lobeP = s.ribSharp / 2;
  const lobeE0 = Math.pow(lobeE, lobeP);
  const lobeE1 = Math.pow(1 + lobeE, lobeP);
  /** the rib coordinate at a direction: which rib, where across it, the lobe's profile */
  const ribAt = (th: number, dy: number, out: Info) => {
    const tw = th + 0.06 * Math.sin(2 * th + w1) + 0.04 * Math.sin(3 * th + w2) + twist * dy + ph;
    let f = tw / TAU;
    f -= Math.floor(f);
    let k = 0;
    while (k < N - 1 && f >= bounds[k + 1]) k++;
    const t = clamp((f - bounds[k]) / (bounds[k + 1] - bounds[k]), 0, 1);
    const sn = Math.sin(Math.PI * t);
    out.k = k;
    out.t = t;
    out.lobe = (Math.pow(sn * sn + lobeE, lobeP) - lobeE0) / (lobeE1 - lobeE0);
  };
  /** the azimuth of rib coordinate f at height dy (the warp inverted by Newton steps) */
  const thFor = (f: number, dy: number) => {
    const target = f * TAU - twist * dy - ph;
    let th = target;
    for (let i = 0; i < 7; i++) {
      const g = th + 0.06 * Math.sin(2 * th + w1) + 0.04 * Math.sin(3 * th + w2) - target;
      const dg = 1 + 0.12 * Math.cos(2 * th + w1) + 0.12 * Math.cos(3 * th + w2);
      th -= g / dg;
    }
    return th;
  };
  const scratch: Info = { k: 0, t: 0, lobe: 0, dy: 0, sdh: 9, n: [0, 1, 0], tooth: 0 };
  /**
   * A point of the outer surface (or the inner wall) at azimuth th and stretched elevation el,
   * leaned; `drop` sinks it toward the centre (the knife bevel). Fills `info` when given.
   */
  const point = (th: number, el: number, inner: boolean, out: number[], info: Info | null = null, drop = 0) => {
    const ce = Math.cos(el);
    const ex = a * ce * Math.sin(th);
    const ey = c * Math.sin(el);
    const ez = a * ce * Math.cos(th);
    const rE = Math.hypot(ex, ey, ez);
    const dx = ex / rE;
    const dy = ey / rE;
    const dz = ez / rE;
    const sp = Math.hypot(dx, dz);
    const phi = Math.acos(clamp(dy, -1, 1));
    const top = 1 - s.dimple * Math.exp(-((phi / 0.42) ** 2));
    const bot = 1 - 0.12 * Math.exp(-(((Math.PI - phi) / 0.55) ** 2));
    const rb = info ?? scratch;
    ribAt(th, dy, rb);
    rb.tooth = 0;
    rb.face = face.holes.length ? faceAt(wrapPi(th - s.faceYaw), el - s.faceTilt) : 0;
    const depth = s.ribDepth * smoothstep(0.03, 0.4, sp) * (1 - 0.85 * rb.face);
    const bul = bulge[rb.k];
    const lop = 1 + s.lopsided * (0.6 * Math.sin(th + l1) + 0.4 * Math.sin(2 * th + l2)) * sp;
    const base = rE * top * bot * lop;
    let r: number;
    if (inner) {
      r = base * (1 - depth * 0.75 + depth * 0.75 * rb.lobe * bul) - T;
      if (dy < 0) r = Math.min(r, (-0.9 * c) / dy - T * 0.85);
    } else {
      r = base * (1 - depth + depth * rb.lobe * bul);
      r *= 1 + 0.012 * (noise3(dx * 7, dy * 7, dz * 7, s.seed) - 0.5);
      for (let m = 0; m < warts.length; m++) {
        const wt = warts[m];
        const cs = dx * wt.d[0] + dy * wt.d[1] + dz * wt.d[2];
        if (cs < 0.98) continue;
        const q = (2 * (1 - cs)) / wt.w2;
        r += wt.h * Math.exp(-q * q);
      }
      if (holeF.length) {
        const u = wrapPi(th - s.faceYaw);
        const v = el - s.faceTilt;
        if (inBox(u, v)) {
          // the heavy brow over each eye, and the teeth standing proud with a ridge down their middles
          for (let e = 0; e < eyeF.length; e++) {
            const above = smoothstep(eyeV[e] - 0.01 * sc, eyeV[e] + 0.05 * sc, v);
            if (above <= 0) continue;
            const q = (eyeP[e].sd(u, v) - 0.055 * sc) / (0.04 * sc);
            r += browH * Math.exp(-q * q) * above;
          }
          if (envP && mouthP && proudH > 0) {
            const inEnv = smoothstep(0.004 * sc, -0.014 * sc, envP.sd(u, v));
            if (inEnv > 0) {
              const sm = mouthP.sd(u, v);
              if (sm > 0) {
                r += proudH * inEnv * smoothstep(0, 0.05 * sc, sm);
                rb.tooth = inEnv;
              }
            }
          }
        }
      }
      if (dy < 0) r = Math.min(r, (-0.9 * c) / dy);
    }
    r -= drop;
    rb.dy = dy;
    if (info) info.sdh = holeF.length ? sdHoles(wrapPi(th - s.faceYaw), el - s.faceTilt) : 9;
    const x = dx * r;
    const y = dy * r;
    out[0] = x * cl - y * sl;
    out[1] = x * sl + y * cl;
    out[2] = dz * r;
  };
  return { a, c, T, N, bounds, point, thFor, dyOf, sdHoles, holes: face.holes, inBox };
}

// ---- tubes (the stem, the vine, a pail's handle) ------------------------------------------------

export interface TubeSpec {
  points: V3[];
  /** radius along the tube (t 0..1) and around it (angle) */
  radius: (t: number, ang: number) => number;
  segments: number;
  sides: number;
  /** colour (linear RGBA) at t, around angle */
  color: (t: number, ang: number) => [number, number, number, number];
  closeEnd?: boolean;
}

/** A tube along a smooth curve with parallel-transported frames, indexed, normals computed. */
export function tubeGeometry(spec: TubeSpec): BufferGeometry {
  const curve = new Curve<V3>(spec.points, 24);
  const { segments: S, sides: M } = spec;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  let prevT = new Vector3(...(curve.tangentAt(0) as V3));
  const nrm = new Vector3(0, 0, 1);
  if (Math.abs(prevT.z) > 0.9) nrm.set(1, 0, 0);
  nrm.sub(prevT.clone().multiplyScalar(nrm.dot(prevT))).normalize();
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const p = curve.pointAt(t * curve.length);
    const tg = new Vector3(...(curve.tangentAt(t * curve.length) as V3));
    // parallel transport the normal
    const axis = new Vector3().crossVectors(prevT, tg);
    const sn = axis.length();
    if (sn > 1e-6) {
      axis.divideScalar(sn);
      nrm.applyAxisAngle(axis, Math.asin(clamp(sn, -1, 1)));
    }
    nrm.sub(tg.clone().multiplyScalar(nrm.dot(tg))).normalize();
    const bin = new Vector3().crossVectors(tg, nrm);
    prevT = tg;
    for (let j = 0; j <= M; j++) {
      const ang = (j / M) * TAU;
      const r = spec.radius(t, ang);
      const cx = Math.cos(ang);
      const sy = Math.sin(ang);
      pos.push(p[0] + (nrm.x * cx + bin.x * sy) * r, p[1] + (nrm.y * cx + bin.y * sy) * r, p[2] + (nrm.z * cx + bin.z * sy) * r);
      col.push(...spec.color(t, ang));
    }
  }
  for (let i = 0; i < S; i++)
    for (let j = 0; j < M; j++) {
      const a0 = i * (M + 1) + j;
      const b0 = a0 + M + 1;
      idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
    }
  if (spec.closeEnd) {
    // a cap at the tip
    const p = curve.pointAt(curve.length);
    const c0 = pos.length / 3;
    pos.push(p[0], p[1], p[2]);
    col.push(...spec.color(1, 0));
    const last = S * (M + 1);
    for (let j = 0; j < M; j++) idx.push(last + j, c0, last + j + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = pos.length / 3;
  g.setAttribute('uv', new BufferAttribute(new Float32Array(n * 2), 2));
  return g.toNonIndexed();
}

const lin = (hex: string) => {
  const c = new Color(hex);
  return [c.r, c.g, c.b] as [number, number, number];
};

/** The stem: a flared, ridged, twisting woody stalk that curls over at the tip (dull: a low rim). */
function stemGeometry(s: PumpkinSpec, base: V3): { geo: BufferGeometry; tip: V3 } {
  const st = s.stem!;
  const R = (k: number) => rand(s.seed, 'stem', k);
  const h = st.h;
  const cy = Math.cos(st.yaw);
  const sy = Math.sin(st.yaw);
  const [bx, topY, bz] = base;
  const rot = (x: number, y: number, z: number): V3 => [bx + x * cy + z * sy, y, bz - x * sy + z * cy];
  const y0 = topY - st.r * 0.9;
  const pts: V3[] = [
    rot(0, y0, 0),
    rot(0.004, topY + h * 0.22, 0.003),
    rot(-st.lean * 0.9, topY + h * 0.52, 0.01 * (R(1) - 0.5)),
    rot(-st.lean * 0.3 + st.curl * h * 0.12, topY + h * 0.82, 0.01),
    rot(st.curl * h * 0.36, topY + h * (0.98 - 0.02 * st.curl), -0.012),
    rot(st.curl * h * 0.58, topY + h * (0.9 - 0.22 * st.curl), -0.02),
  ];
  const ridges = 5 + Math.floor(R(2) * 3);
  const stem = lin(s.colors.stem);
  const geo = tubeGeometry({
    points: pts,
    segments: 30,
    sides: ridges * 4,
    closeEnd: true,
    radius: (t, ang) => {
      const flare = 1 + 1.1 * Math.exp(-((t / 0.08) ** 2));
      // (a thick, fluted, twisted stalk to a blunt dry end: a smooth taper read as a horn)
      const taper = Math.pow(1 - 0.74 * t, 0.85);
      const ridge = 1 + 0.36 * (Math.abs(Math.cos((ang * ridges) / 2 + st.twist * t)) - 0.5) * 2;
      const gnarl = 1 + 0.22 * (noise3(t * 7, Math.cos(ang) * 1.5, Math.sin(ang) * 1.5, s.seed + 3) - 0.5) + 0.1 * Math.sin(t * 19 + ang);
      return st.r * flare * taper * ridge * gnarl;
    },
    color: (t, ang) => {
      const ridge = Math.abs(Math.cos((ang * ridges) / 2 + st.twist * t));
      // dry fibres streaking along the stalk, darker in the furrows, browner where it is driest
      const fib = 0.72 + 0.56 * noise3(ang * ridges * 1.3 + st.twist * t * 2, t * 5, 1.5, s.seed + 11);
      // (dark furrows, pale dry ridges: the reference's stalk reads by its fluting)
      const k = (0.3 + 1.05 * ridge * ridge) * fib * (0.8 + 0.25 * noise3(t * 9, ang, 1, s.seed + 9)) * (t < 0.08 ? 0.6 + 5 * t : 1);
      const dry = smoothstep(0.35, 1, t);
      return [stem[0] * k * (1 + 0.12 * dry), stem[1] * k * (1 + 0.08 * dry), stem[2] * k * (1 + 0.1 * ridge), 0.08 + 0.14 * ridge];
    },
  });
  const tp = pts[pts.length - 1];
  return { geo, tip: [tp[0], tp[1], tp[2]] };
}

/** A dry vine tendril from the stem's base, over the shoulder, ending in a corkscrew. */
function vineGeometry(s: PumpkinSpec, base: V3, a: number): BufferGeometry {
  const R = (k: number) => rand(s.seed, 'vine', k);
  const ang0 = s.stem!.yaw + Math.PI * (0.6 + 0.5 * R(0));
  const pts: V3[] = [];
  const n = 26;
  const [bx, topY, bz] = base;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // out along the top, then down the shoulder, curling
    const reach = a * (0.12 + 0.55 * t);
    const ang = ang0 + 0.5 * t;
    const coil = t > 0.55 ? (t - 0.55) / 0.45 : 0;
    const cr = 0.035 * a * coil;
    const ca = coil * 5.5 * Math.PI;
    const y = topY + 0.02 * a - a * 0.42 * t * t + Math.sin(ca) * cr;
    pts.push([bx + Math.sin(ang) * reach + Math.cos(ang) * Math.cos(ca) * cr, y, bz + Math.cos(ang) * reach - Math.sin(ang) * Math.cos(ca) * cr]);
  }
  const stem = lin(s.colors.stem);
  const r0 = Math.max(0.006, 0.012 * a);
  return tubeGeometry({
    points: pts,
    segments: 60,
    sides: 5,
    closeEnd: true,
    radius: (t) => r0 * (1 - 0.55 * t),
    color: (t) => [stem[0] * 0.8, stem[1] * 0.8, stem[2] * 0.75, 0.06 - 0.03 * t],
  });
}

// ---- mesh building blocks -----------------------------------------------------------------------

/** A vertex pool (position, normal, RGBA colour, emission index) and the triangles over it. */
class Pool {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];
  e: number[] = [];
  tris: number[] = [];
  add(p: ArrayLike<number>, n: ArrayLike<number>, col: ArrayLike<number>, e: number): number {
    this.p.push(p[0], p[1], p[2]);
    this.n.push(n[0], n[1], n[2]);
    this.c.push(col[0], col[1], col[2], col[3]);
    this.e.push(e);
    return this.e.length - 1;
  }
  /** a triangle wound to face `ref` (or, without one, its vertices' normals); slivers dropped */
  tri(a: number, b: number, c: number, ref: V3 | null = null) {
    const P = this.p;
    const ax = P[b * 3] - P[a * 3];
    const ay = P[b * 3 + 1] - P[a * 3 + 1];
    const az = P[b * 3 + 2] - P[a * 3 + 2];
    const bx = P[c * 3] - P[a * 3];
    const by = P[c * 3 + 1] - P[a * 3 + 1];
    const bz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    if (nx * nx + ny * ny + nz * nz < 1e-24) return;
    const N = this.n;
    const rx = ref ? ref[0] : N[a * 3] + N[b * 3] + N[c * 3];
    const ry = ref ? ref[1] : N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1];
    const rz = ref ? ref[2] : N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    if (nx * rx + ny * ry + nz * rz < 0) this.tris.push(a, c, b);
    else this.tris.push(a, b, c);
  }
  /** area-weighted face normals accumulated onto vertices [from, to) (strips: no analytic normal) */
  smoothNormals(from: number, to: number, triFrom: number, fallback: (v: number) => V3) {
    const acc = new Float64Array((to - from) * 3);
    const P = this.p;
    const T = this.tris;
    for (let t = triFrom; t < T.length; t += 3) {
      const a = T[t];
      const b = T[t + 1];
      const c = T[t + 2];
      const ax = P[b * 3] - P[a * 3];
      const ay = P[b * 3 + 1] - P[a * 3 + 1];
      const az = P[b * 3 + 2] - P[a * 3 + 2];
      const bx = P[c * 3] - P[a * 3];
      const by = P[c * 3 + 1] - P[a * 3 + 1];
      const bz = P[c * 3 + 2] - P[a * 3 + 2];
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      for (const v of [a, b, c])
        if (v >= from && v < to) {
          acc[(v - from) * 3] += nx;
          acc[(v - from) * 3 + 1] += ny;
          acc[(v - from) * 3 + 2] += nz;
        }
    }
    for (let v = from; v < to; v++) {
      let x = acc[(v - from) * 3];
      let y = acc[(v - from) * 3 + 1];
      let z = acc[(v - from) * 3 + 2];
      let l = Math.hypot(x, y, z);
      if (l < 1e-14) {
        [x, y, z] = fallback(v);
        l = Math.hypot(x, y, z) || 1;
      }
      this.n[v * 3] = x / l;
      this.n[v * 3 + 1] = y / l;
      this.n[v * 3 + 2] = z / l;
    }
  }
  geometry(): BufferGeometry {
    const n = this.tris.length;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const col = new Float32Array(n * 4);
    const uv = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) {
      const v = this.tris[k];
      for (let j = 0; j < 3; j++) {
        pos[k * 3 + j] = this.p[v * 3 + j];
        nor[k * 3 + j] = this.n[v * 3 + j];
      }
      for (let j = 0; j < 4; j++) col[k * 4 + j] = this.c[v * 4 + j];
      uv[k * 2] = this.e[v];
      uv[k * 2 + 1] = 0.5;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('normal', new BufferAttribute(nor, 3));
    g.setAttribute('color', new BufferAttribute(col, 4));
    g.setAttribute('uv', new BufferAttribute(uv, 2));
    return g;
  }
}

/** A hole's outline resampled for its walls: points, the inward normal (into the hole), fans at corners. */
function holeLoop(poly: Poly, maxSeg: number): { u: number[]; v: number[]; nu: number[]; nv: number[]; s: number[] } {
  const n = poly.length;
  const out = { u: [] as number[], v: [] as number[], nu: [] as number[], nv: [] as number[], s: [] as number[] };
  const edgeN = (i: number) => {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    return [-(y1 - y0) / l, (x1 - x0) / l];
  };
  let arc = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = poly[i];
    const [pnx, pny] = edgeN((i - 1 + n) % n);
    const [qnx, qny] = edgeN(i);
    // the turn at this corner (+ left: a convex corner of the hole)
    const tau = Math.atan2(pnx * qny - pny * qnx, pnx * qnx + pny * qny);
    if (Math.abs(tau) > 0.2) {
      const kf = Math.ceil(Math.abs(tau) / 0.2);
      for (let q = 0; q <= kf; q++) {
        const a = (tau * q) / kf;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        out.u.push(x);
        out.v.push(y);
        out.nu.push(pnx * ca - pny * sa);
        out.nv.push(pnx * sa + pny * ca);
        out.s.push(arc);
      }
    } else {
      const l = Math.hypot(pnx + qnx, pny + qny) || 1;
      out.u.push(x);
      out.v.push(y);
      out.nu.push((pnx + qnx) / l);
      out.nv.push((pny + qny) / l);
      out.s.push(arc);
    }
    const [x1, y1] = poly[(i + 1) % n];
    const len = Math.hypot(x1 - x, y1 - y);
    const segs = Math.ceil(len / maxSeg);
    for (let k = 1; k < segs; k++) {
      out.u.push(x + ((x1 - x) * k) / segs);
      out.v.push(y + ((y1 - y) * k) / segs);
      out.nu.push(qnx);
      out.nv.push(qny);
      out.s.push(arc + (len * k) / segs);
    }
    arc += len;
  }
  return out;
}

// ---- the build ----------------------------------------------------------------------------------

/** Build a pumpkin (local frame: body centre at the origin, face toward +z turned by faceYaw). */
export function buildPumpkin(s: PumpkinSpec): PumpkinBuild {
  const B = bodyModel(s);
  const { a, c } = B;
  const N = s.ribs;
  const carved = B.holes.length > 0 || s.openTop !== null;
  const skin = lin(s.colors.skin);
  const groove = lin(s.colors.groove);
  const patch = lin(s.colors.patch);
  const flesh = lin(s.colors.flesh);
  const ribTint = Array.from({ length: N }, (_, k) => [0.88 + 0.24 * rand(s.seed, 'rt', k), 0.9 + 0.16 * rand(s.seed, 'rt2', k)]);
  const halo = 0.06 * s.width;
  const pool = new Pool();
  const tmp = [0, 0, 0];
  const tmp2 = [0, 0, 0];
  const info: Info = { k: 0, t: 0, lobe: 0, dy: 0, sdh: 9, n: [0, 1, 0], tooth: 0 };

  /** the rind's paint at a body point (info filled by `point`) */
  const rindPaint = (p: number[], th: number, el: number, q: Info): [number, number, number, number, number] => {
    // (the lobes hold the skin colour well into the grooves: one-for-one dark grooves read as a striped ball;
    // on the carved face the grooves fade with the ribs)
    const lobeK = Math.pow(q.lobe, 0.38) + (1 - Math.pow(q.lobe, 0.38)) * 0.75 * (q.face ?? 0);
    let r = groove[0] + (skin[0] - groove[0]) * lobeK;
    let g = groove[1] + (skin[1] - groove[1]) * lobeK;
    let b = groove[2] + (skin[2] - groove[2]) * lobeK;
    const rt = ribTint[q.k] ?? [1, 1];
    const tw = Math.sqrt(q.lobe);
    r *= 1 + (rt[0] - 1) * tw;
    g *= 1 + (rt[1] - 1) * tw;
    // sun-browned, greenish patches (more of them), and the bands at the stem and the seat
    const pn = smoothstep(0.05, 0.5, fbm3((p[0] * 4) / s.width, (p[1] * 4) / s.width, (p[2] * 4) / s.width, s.seed + 21, 3));
    const near = smoothstep(0.55, 0.95, q.dy) * 0.7 + smoothstep(-0.6, -0.95, q.dy) * 0.5;
    const pk = Math.min(1, pn * 0.8 + near);
    r += (patch[0] - r) * pk;
    g += (patch[1] - g) * pk;
    b += (patch[2] - b) * pk;
    const scab = smoothstep(0.7, 0.78, noise3((p[0] * 22) / s.width, (p[1] * 22) / s.width, (p[2] * 22) / s.width, s.seed + 40));
    // healed scars: long thin pale scratches across the ribs (noise stretched along a slant), corky
    const sc = noise3((p[0] * 4 + p[1] * 9) / s.width, (p[1] * 70 - p[0] * 30) / s.width, (p[2] * 6) / s.width, s.seed + 41);
    const scar = smoothstep(0.74, 0.8, sc) * smoothstep(0.35, 0.7, noise3((p[0] * 3) / s.width, (p[1] * 3) / s.width, (p[2] * 3) / s.width, s.seed + 42));
    // painted streaks along the meridians (broad and fine), and a dark stroke down every groove
    const st = noise3(Math.cos(th) * 13, Math.sin(th) * 13, el * 1.3, s.seed + 44) - 0.5;
    const fine = noise3(Math.cos(th) * 38, Math.sin(th) * 38, el * 2.6, s.seed + 45) - 0.5;
    const streak = 1 + 0.8 * st + 0.3 * fine;
    const stroke = 1 - 0.26 * (1 - smoothstep(0.0, 0.12, q.lobe)) * (1 - 0.8 * (q.face ?? 0));
    // the crowns caught pale (a dry, dusty tan dabbed along the ribs' backs)
    const crown = smoothstep(0.7, 1, q.lobe) * smoothstep(0.35, 0.75, noise3(Math.cos(th) * 9, Math.sin(th) * 9, el * 3.1, s.seed + 46));
    r += (skin[0] * 1.25 + 0.06 - r) * crown * 0.45;
    g += (skin[1] * 1.3 + 0.05 - g) * crown * 0.45;
    b += (skin[2] * 1.5 + 0.04 - b) * crown * 0.45;
    // the shadow side painted duller and darker (a plum-brown), the top caught light
    if (s.shade) {
      const away = smoothstep(0.1, -0.7, q.n[0] * s.shade[0] + q.n[1] * s.shade[1] + q.n[2] * s.shade[2]) * (1 - smoothstep(0.4, 0.9, q.dy));
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      // (toward a dull plum-brown, a little: an olive slate turned the back of the rind green)
      r += (lum * 1.05 - r) * away * 0.22;
      g += (lum * 0.82 - g) * away * 0.22;
      b += (lum * 0.95 - b) * away * 0.22;
    }
    // the teeth: carved paler and lit warm by the glow around them (the reference's tan fangs)
    if (q.tooth > 0) {
      r += (skin[0] * 1.2 + 0.03 - r) * q.tooth * 0.6;
      g += (skin[1] * 1.15 + 0.02 - g) * q.tooth * 0.6;
      b += (skin[2] * 1.1 - b) * q.tooth * 0.6;
    }
    r += (skin[0] * 0.9 + 0.05 - r) * scar * 0.5;
    g += (skin[1] * 1.1 + 0.045 - g) * scar * 0.5;
    b += (skin[2] * 1.3 + 0.03 - b) * scar * 0.5;
    const k = (1 - 0.45 * scab) * streak * stroke * (0.58 + 0.42 * smoothstep(-0.9, -0.2, q.dy)) * (1 + 0.6 * smoothstep(0.25, 0.85, q.dy));
    const glow = q.sdh < 9 ? Math.max(0.15 * Math.exp(-(Math.max(0, q.sdh) * a) / halo), 0.2 * q.tooth) : 0;
    // the rim (alpha) low in the grooves: their walls face sideways and would outline every rib
    return [r * k, g * k, b * k, 0.12 + 0.88 * q.lobe * q.lobe, glow];
  };

  /** a body point with its analytic normal (central differences), its paint, into the pool */
  const surfVertex = (th: number, el: number, inner: boolean, paint: (p: number[], q: Info) => [number, number, number, number, number]): number => {
    const p = [0, 0, 0];
    B.point(th, el, inner, p, info);
    const q = { ...info };
    const h = 2e-4;
    const ht = h / Math.max(0.05, Math.cos(el));
    const pa = [0, 0, 0];
    const pb = [0, 0, 0];
    const pc = [0, 0, 0];
    const pd = [0, 0, 0];
    B.point(th + ht, el, inner, pa);
    B.point(th - ht, el, inner, pb);
    B.point(th, Math.min(Math.PI / 2, el + h), inner, pc);
    B.point(th, Math.max(-Math.PI / 2, el - h), inner, pd);
    const ux = pa[0] - pb[0];
    const uy = pa[1] - pb[1];
    const uz = pa[2] - pb[2];
    const vx = pc[0] - pd[0];
    const vy = pc[1] - pd[1];
    const vz = pc[2] - pd[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    let l = Math.hypot(nx, ny, nz);
    if (l < 1e-14) {
      nx = p[0];
      ny = p[1];
      nz = p[2];
      l = Math.hypot(nx, ny, nz) || 1;
    }
    let sg = (nx * p[0] + ny * p[1] + nz * p[2] < 0 ? -1 : 1) / l;
    if (inner) sg = -sg;
    q.n = [nx * sg, ny * sg, nz * sg];
    const col = paint(p, q);
    return pool.add(p, [nx * sg, ny * sg, nz * sg], col, col[4]);
  };

  // ---- the rind: a grid whose columns follow the ribs ---------------------------------------------
  const closed = s.openTop === null;
  const elTop = closed ? Math.PI / 2 : s.openTop!;
  const NR = s.rows;
  /** the rib coordinates of the columns: denser toward each groove */
  const colF = (perRib: number) => {
    const f: number[] = [];
    for (let k = 0; k < N; k++)
      for (let m = 0; m < perRib; m++) {
        const t = m / perRib - (0.55 / TAU) * Math.sin((TAU * m) / perRib);
        f.push(B.bounds[k] + t * (B.bounds[k + 1] - B.bounds[k]));
      }
    return f;
  };
  const buildGrid = (perRib: number, rows: number, inner: boolean, paint: (p: number[], q: Info, th: number, el: number) => [number, number, number, number, number]) => {
    const fs = colF(perRib);
    const NC = fs.length;
    const elJ = (j: number) => -Math.PI / 2 + (elTop + Math.PI / 2) * (j / rows);
    const ids = new Int32Array(NC * (rows + 1)).fill(-1);
    const th = new Float64Array(NC * (rows + 1));
    const south = surfVertex(0, -Math.PI / 2, inner, (p, q) => paint(p, q, 0, -Math.PI / 2));
    const north = closed ? surfVertex(0, Math.PI / 2, inner, (p, q) => paint(p, q, 0, Math.PI / 2)) : -1;
    for (let j = 1; j <= rows; j++) {
      if (j === rows && closed) break;
      const el = elJ(j);
      const dy = B.dyOf(el);
      for (let i = 0; i < NC; i++) {
        const t = B.thFor(fs[i], dy);
        th[j * NC + i] = t;
        ids[j * NC + i] = surfVertex(t, el, inner, (p, q) => paint(p, q, t, el));
      }
    }
    const vid = (i: number, j: number) => (j === 0 ? south : j === rows && closed ? north : ids[j * NC + (((i % NC) + NC) % NC)]);
    return { NC, rows, vid, th, elJ, south, north };
  };
  const rindAt = (p: number[], q: Info, th: number, el: number) => rindPaint(p, th, el, q);
  const G = buildGrid(s.cols, NR, false, rindAt);
  const NC = G.NC;
  const uOf = (i: number, j: number) => wrapPi(G.th[j * NC + (((i % NC) + NC) % NC)] - s.faceYaw);

  // ---- the carvings ------------------------------------------------------------------------------
  // cell types: 0 rind, 1 the ring re-triangulated around a cut, 2 inside a hole (dropped)
  const cellT = new Int8Array(NC * NR);
  const cidx = (i: number, j: number) => j * NC + (((i % NC) + NC) % NC);
  const cw = (s.chamfer * s.width) / a;
  const d0 = (s.bevel * B.T) / a;
  const CM = 2;
  const WM = 3;
  const walls: { from: number; to: number; tri: number }[] = [];
  if (B.holes.length) {
    const lastRow = closed ? NR - 2 : NR - 1;
    let minCell = 9;
    for (let j = 1; j <= lastRow; j++) {
      const v0 = G.elJ(j) - s.faceTilt;
      const v1 = G.elJ(j + 1) - s.faceTilt;
      for (let i = 0; i < NC; i++) {
        const us = [uOf(i, j), uOf(i + 1, j), uOf(i + 1, j + 1), uOf(i, j + 1)];
        if (Math.max(...us) - Math.min(...us) > Math.PI) continue;
        const cu = (us[0] + us[1] + us[2] + us[3]) / 4;
        const cv = (v0 + v1) / 2;
        if (!B.inBox(cu, cv)) continue;
        const sd = B.sdHoles(cu, cv);
        const diag = Math.max(Math.hypot(us[2] - us[0], v1 - v0), Math.hypot(us[3] - us[1], v1 - v0));
        minCell = Math.min(minCell, diag);
        const dl = cw + 0.8 * diag;
        cellT[cidx(i, j)] = Math.abs(sd) < dl ? 1 : sd < 0 ? 2 : 0;
      }
    }
    // no rind cell may touch a dropped one; no two ring cells may meet only at a corner across rind
    const T8 = (i: number, j: number) => (j < 0 || j >= NR ? 0 : cellT[cidx(i, j)]);
    for (let j = 0; j < NR; j++)
      for (let i = 0; i < NC; i++) {
        if (cellT[cidx(i, j)] !== 0) continue;
        let touch = false;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (T8(i + di, j + dj) === 2) touch = true;
        if (touch) cellT[cidx(i, j)] = 1;
      }
    for (let changed = true; changed; ) {
      changed = false;
      for (let j = 0; j < NR - 1; j++)
        for (let i = 0; i < NC; i++) {
          const A = cellT[cidx(i, j)];
          const Bq = cellT[cidx(i + 1, j)];
          const C = cellT[cidx(i, j + 1)];
          const D = cellT[cidx(i + 1, j + 1)];
          if (A !== 0 && D !== 0 && Bq === 0 && C === 0) {
            cellT[cidx(i + 1, j)] = 1;
            cellT[cidx(i, j + 1)] = 1;
            changed = true;
          } else if (Bq !== 0 && C !== 0 && A === 0 && D === 0) {
            cellT[cidx(i, j)] = 1;
            cellT[cidx(i + 1, j + 1)] = 1;
            changed = true;
          }
        }
    }

    // each hole's loop, its knife bevel (CM rows out onto the rind) and its wall (WM rows in to the inner wall)
    const maxSeg = Math.max(0.004, minCell * 0.3);
    const hRay = (u: number, v: number, nu: number, nv: number, cap: number) => {
      const tmax = cap / 0.45;
      const ok = (t: number) => Math.abs(B.sdHoles(u + nu * t, v + nv * t)) >= t * 0.985;
      if (ok(tmax)) return tmax;
      let lo = 0;
      let hi = tmax;
      for (let it = 0; it < 14; it++) {
        const m = (lo + hi) / 2;
        if (ok(m)) lo = m;
        else hi = m;
      }
      return lo;
    };
    const ringCopies: { ids: number[]; u: number[]; v: number[] }[] = [];
    for (const poly of B.holes) {
      const L = holeLoop(poly, maxSeg);
      const K = L.u.length;
      const out = new Float64Array(K);
      const inw = new Float64Array(K);
      for (let k = 0; k < K; k++) {
        out[k] = Math.min(cw, 0.45 * hRay(L.u[k], L.v[k], -L.nu[k], -L.nv[k], cw));
        inw[k] = Math.min(d0, 0.45 * hRay(L.u[k], L.v[k], L.nu[k], L.nv[k], d0));
      }
      // a light smoothing that never exceeds the room each point has
      for (const arr of [out, inw])
        for (let it = 0; it < 2; it++) {
          const prev = Float64Array.from(arr);
          for (let k = 0; k < K; k++) arr[k] = Math.min(prev[k], (prev[(k - 1 + K) % K] + 2 * prev[k] + prev[(k + 1) % K]) / 4);
        }
      const chDepth = 0.55 * cw * a;
      const at = (k: number, m: number) => [L.u[k] - L.nu[k] * out[k] * (m / CM), L.v[k] - L.nv[k] * out[k] * (m / CM)];
      const fibre = (k: number, depth: number) => 0.78 + 0.44 * noise3(L.s[k] * 140, depth * 2, 0.5, s.seed + 50);
      // the ring copy of the bevel's outer row (rind paint, analytic normals) for the earcut fill
      const ring: number[] = [];
      const ru: number[] = [];
      const rv: number[] = [];
      for (let k = 0; k < K; k++) {
        const [u, v] = at(k, CM);
        ring.push(surfVertex(u + s.faceYaw, v + s.faceTilt, false, (p, q) => rindPaint(p, u + s.faceYaw, v + s.faceTilt, q)));
        ru.push(u);
        rv.push(v);
      }
      ringCopies.push({ ids: ring, u: ru, v: rv });
      // the bevel strip
      const chFrom = pool.e.length;
      const chTri = pool.tris.length;
      const ch: number[][] = [];
      const dropK = (k: number) => chDepth * (out[k] / Math.max(1e-9, cw));
      for (let m = 0; m <= CM; m++) {
        const row: number[] = [];
        for (let k = 0; k < K; k++) {
          const [u, v] = at(k, m);
          const drop = dropK(k) * (1 - m / CM) ** 2;
          B.point(u + s.faceYaw, v + s.faceTilt, false, tmp, null, drop);
          const f = fibre(k, 0) * 0.85;
          const edge = smoothstep(0.55, 1, m / CM);
          const col = [flesh[0] * f * (1 - edge) + skin[0] * 0.55 * edge, flesh[1] * f * (1 - edge) + skin[1] * 0.55 * edge, flesh[2] * f * (1 - edge) + skin[2] * 0.55 * edge, 0.12];
          row.push(pool.add(tmp, [0, 0, 0], col, 0.16 + 0.1 * (1 - m / CM)));
        }
        ch.push(row);
      }
      for (let m = 0; m < CM; m++)
        for (let k = 0; k < K; k++) {
          const k1 = (k + 1) % K;
          const id = ch[m][k];
          const ref: V3 = [pool.p[id * 3], pool.p[id * 3 + 1], pool.p[id * 3 + 2]];
          pool.tri(ch[m][k], ch[m][k1], ch[m + 1][k1], ref);
          pool.tri(ch[m][k], ch[m + 1][k1], ch[m + 1][k], ref);
        }
      pool.smoothNormals(chFrom, pool.e.length, chTri, (v) => [pool.p[v * 3], pool.p[v * 3 + 1], pool.p[v * 3 + 2]]);
      // the wall: from the bevel's inner edge through the shell to the inner wall
      const wFrom = pool.e.length;
      const wTri = pool.tris.length;
      const wl: number[][] = [];
      const intoHole: V3[] = [];
      for (let k = 0; k < K; k++) {
        B.point(L.u[k] + s.faceYaw, L.v[k] + s.faceTilt, false, tmp);
        B.point(L.u[k] + L.nu[k] * 1e-3 + s.faceYaw, L.v[k] + L.nv[k] * 1e-3 + s.faceTilt, false, tmp2);
        intoHole.push([tmp2[0] - tmp[0], tmp2[1] - tmp[1], tmp2[2] - tmp[2]]);
      }
      for (let m = 0; m <= WM; m++) {
        const row: number[] = [];
        const f = m / WM;
        for (let k = 0; k < K; k++) {
          if (m === 0) {
            const src = ch[0][k];
            tmp[0] = pool.p[src * 3];
            tmp[1] = pool.p[src * 3 + 1];
            tmp[2] = pool.p[src * 3 + 2];
          } else {
            const u = L.u[k] + L.nu[k] * inw[k] * f + s.faceYaw;
            const v = L.v[k] + L.nv[k] * inw[k] * f + s.faceTilt;
            B.point(u, v, false, tmp, null, dropK(k));
            B.point(u, v, true, tmp2);
            for (let q = 0; q < 3; q++) tmp[q] += (tmp2[q] - tmp[q]) * f;
          }
          // pale fibrous flesh, a thin skin edge at the rind, darker inward (dark when unlit)
          const fib = fibre(k, f);
          const kk = fib * 0.5 * (1 - 0.85 * f) * (m === 0 ? 0.75 : 1);
          const col = [flesh[0] * kk, flesh[1] * kk * (1 - 0.1 * f), flesh[2] * kk * (1 - 0.25 * f), 0];
          row.push(pool.add(tmp, [0, 0, 0], col, 0.38 + 0.32 * f + 0.03 * (fib - 1)));
        }
        wl.push(row);
      }
      for (let m = 0; m < WM; m++)
        for (let k = 0; k < K; k++) {
          const k1 = (k + 1) % K;
          pool.tri(wl[m][k], wl[m][k1], wl[m + 1][k1], intoHole[k]);
          pool.tri(wl[m][k], wl[m + 1][k1], wl[m + 1][k], intoHole[k]);
        }
      walls.push({ from: wFrom, to: pool.e.length, tri: wTri });
      pool.smoothNormals(wFrom, pool.e.length, wTri, (v) => intoHole[(v - wFrom) % K]);
    }

    // the ring cells' components, their rind boundaries, and the earcut fill against the loops
    const comp = new Int32Array(NC * NR).fill(-1);
    let nComp = 0;
    for (let j = 0; j < NR; j++)
      for (let i = 0; i < NC; i++) {
        if (cellT[cidx(i, j)] !== 1 || comp[cidx(i, j)] >= 0) continue;
        const stack = [[i, j]];
        comp[cidx(i, j)] = nComp;
        const cells: [number, number][] = [];
        while (stack.length) {
          const [ci, cj] = stack.pop()!;
          cells.push([ci, cj]);
          for (const [di, dj] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const ni = (((ci + di) % NC) + NC) % NC;
            const nj = cj + dj;
            if (nj < 0 || nj >= NR) continue;
            if (cellT[cidx(ni, nj)] === 1 && comp[cidx(ni, nj)] < 0) {
              comp[cidx(ni, nj)] = nComp;
              stack.push([ni, nj]);
            }
          }
        }
        nComp++;
        // the boundary edges against rind cells, the ring on their left (counter-clockwise in u, v)
        const next = new Map<number, number[]>();
        const addE = (p: number, q: number) => {
          const l = next.get(p);
          if (l) l.push(q);
          else next.set(p, [q]);
        };
        const kind = (ci: number, cj: number) => (cj < 0 || cj >= NR ? 0 : cellT[cidx(ci, cj)]);
        for (const [ci, cj] of cells) {
          const v00 = G.vid(ci, cj);
          const v10 = G.vid(ci + 1, cj);
          const v11 = G.vid(ci + 1, cj + 1);
          const v01 = G.vid(ci, cj + 1);
          if (kind(ci, cj - 1) === 0) addE(v00, v10);
          if (kind(ci + 1, cj) === 0) addE(v10, v11);
          if (kind(ci, cj + 1) === 0) addE(v11, v01);
          if (kind(ci - 1, cj) === 0) addE(v01, v00);
        }
        // grid vertex -> face coordinates
        const uvOf = new Map<number, [number, number]>();
        for (const [ci, cj] of cells)
          for (const [di, dj] of [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ])
            uvOf.set(G.vid(ci + di, cj + dj), [uOf(ci + di, cj + dj), G.elJ(cj + dj) - s.faceTilt]);
        const loops: number[][] = [];
        for (const [start, ends] of next)
          while (ends.length) {
            const loop = [start];
            let cur = ends.pop()!;
            let guard = 0;
            while (cur !== start && guard++ < 1e6) {
              loop.push(cur);
              const l = next.get(cur);
              if (!l || !l.length) break;
              cur = l.pop()!;
            }
            loops.push(loop);
          }
        if (!loops.length) continue;
        const areaOf = (lp: number[]) => polyArea(lp.map((v) => uvOf.get(v)!));
        const areas = loops.map(areaOf);
        const outerI = areas.indexOf(Math.max(...areas));
        const outer = loops[outerI];
        const outerF = flat(outer.map((v) => uvOf.get(v)!));
        const data: number[] = [];
        const holeIdx: number[] = [];
        const map: number[] = [];
        // (earcut drops points with exactly zero turn, which would leave T-junctions against the
        // grid rows and the bevel strip: a sub-micron, deterministic jitter keeps every point)
        const put = (id: number, u: number, v: number) => {
          const q = map.length;
          const h1 = Math.sin(q * 12.9898 + 78.233) * 43758.5453;
          const h2 = Math.sin(q * 39.3468 + 11.135) * 24634.6345;
          data.push(u + (h1 - Math.floor(h1) - 0.5) * 4e-9, v + (h2 - Math.floor(h2) - 0.5) * 4e-9);
          map.push(id);
        };
        for (const v of outer) put(v, ...uvOf.get(v)!);
        loops.forEach((lp, li) => {
          if (li === outerI || areas[li] > 0) return;
          holeIdx.push(map.length);
          for (const v of lp) put(v, ...uvOf.get(v)!);
        });
        // the holes' bevel loops inside this component
        for (const rc of ringCopies) {
          if (sdPoly(rc.u[0], rc.v[0], outerF) > 0) continue;
          holeIdx.push(map.length);
          for (let k = 0; k < rc.ids.length; k++) put(rc.ids[k], rc.u[k], rc.v[k]);
        }
        // Steiner points: grid vertices inside the ring, clear of the bevel loops
        const onB = new Set<number>(loops.flat());
        for (const [ci, cj] of cells) {
          const v = G.vid(ci, cj);
          if (onB.has(v) || cj === 0) continue;
          let all = true;
          for (const [di, dj] of [
            [-1, -1],
            [0, -1],
            [-1, 0],
          ])
            if (kind(ci + di, cj + dj) !== 1 || comp[cidx(ci + di, cj + dj)] !== comp[cidx(ci, cj)]) all = false;
          if (!all) continue;
          const [u, vv] = uvOf.get(v)!;
          if (B.sdHoles(u, vv) < cw + 0.35 * minCell) continue;
          holeIdx.push(map.length);
          put(v, u, vv);
        }
        const tri = Earcut.triangulate(data, holeIdx);
        for (let t = 0; t < tri.length; t += 3) pool.tri(map[tri[t]], map[tri[t + 1]], map[tri[t + 2]]);
      }
  }
  // the rind's kept cells
  for (let j = 0; j < NR; j++)
    for (let i = 0; i < NC; i++) {
      if (cellT[cidx(i, j)] !== 0) continue;
      const v00 = G.vid(i, j);
      const v10 = G.vid(i + 1, j);
      const v11 = G.vid(i + 1, j + 1);
      const v01 = G.vid(i, j + 1);
      if (j === 0) pool.tri(v00, v11, v01);
      else if (j === NR - 1 && closed) pool.tri(v00, v10, v11);
      else {
        pool.tri(v00, v10, v11);
        pool.tri(v00, v11, v01);
      }
    }

  // ---- the inner wall, facing in (the cavity), and a pail's rim ---------------------------------
  if (carved) {
    const hot: V3 = [Math.sin(s.faceYaw) * a * 0.1, -0.62 * c, Math.cos(s.faceYaw) * a * 0.1];
    const cavity = (p: number[]): [number, number, number, number, number] => {
      const d = Math.hypot(p[0] - hot[0], p[1] - hot[1], p[2] - hot[2]);
      const heat = Math.exp(-((d / (0.95 * a)) ** 2));
      const pulp = 0.55 + 0.45 * noise3((p[0] * 30) / s.width, (p[1] * 8) / s.width, (p[2] * 30) / s.width, s.seed + 60);
      return [0.026 * pulp, 0.017 * pulp, 0.011 * pulp, 0, 0.72 + 0.28 * heat];
    };
    const inCols = closed ? Math.max(3, Math.round(s.cols / 3)) : s.cols;
    const inRows = closed ? Math.max(12, Math.round(NR / 2.5)) : NR;
    const I = buildGrid(inCols, inRows, true, (p) => cavity(p));
    for (let j = 0; j < inRows; j++)
      for (let i = 0; i < I.NC; i++) {
        const v00 = I.vid(i, j);
        const v10 = I.vid(i + 1, j);
        const v11 = I.vid(i + 1, j + 1);
        const v01 = I.vid(i, j + 1);
        if (j === 0) pool.tri(v00, v11, v01);
        else if (j === inRows - 1 && closed) pool.tri(v00, v10, v11);
        else {
          pool.tri(v00, v10, v11);
          pool.tri(v00, v11, v01);
        }
      }
    if (!closed) {
      // the open top's cut rim: the outer and the inner top rows share their columns
      const from = pool.e.length;
      const triFrom = pool.tris.length;
      const o: number[] = [];
      const i2: number[] = [];
      for (let i = 0; i < NC; i++) {
        for (const [arr, src] of [
          [o, G.vid(i, NR)],
          [i2, I.vid(i, NR)],
        ] as [number[], number][]) {
          const fib = 0.8 + 0.4 * noise3(i * 0.9, arr === o ? 0 : 1, 0.5, s.seed + 70);
          arr.push(pool.add([pool.p[src * 3], pool.p[src * 3 + 1], pool.p[src * 3 + 2]], [0, 1, 0], [flesh[0] * fib * 0.8, flesh[1] * fib * 0.8, flesh[2] * fib * 0.75, 0.1], arr === o ? 0.4 : 0.55));
        }
      }
      for (let i = 0; i < NC; i++) {
        const i1 = (i + 1) % NC;
        pool.tri(o[i], o[i1], i2[i1], [0, 1, 0]);
        pool.tri(o[i], i2[i1], i2[i], [0, 1, 0]);
      }
      pool.smoothNormals(from, pool.e.length, triFrom, () => [0, 1, 0]);
    }
  }

  let geometry = pool.geometry();
  let bottom = 0;
  for (let v = 1; v < pool.p.length; v += 3) bottom = Math.min(bottom, pool.p[v]);
  // the stem sits in the dimple at the (leaned) top of the body
  const pole = [0, 0, 0];
  B.point(0, Math.PI / 2, false, pole);
  const top = pole[1];
  let stemTip: V3 = [pole[0], top, pole[2]];
  if (s.stem && s.openTop === null) {
    const st = stemGeometry(s, [pole[0], top, pole[2]]);
    stemTip = st.tip;
    const parts = [geometry, st.geo];
    if (s.vine) parts.push(vineGeometry(s, [pole[0], top, pole[2]], a));
    const merged = mergeGeometries(parts, false);
    parts.forEach((q) => q.dispose());
    geometry = merged;
  }
  // the candle: low in the cavity, toward the face
  const candle: V3 = [Math.sin(s.faceYaw) * a * 0.5, -c * 0.5, Math.cos(s.faceYaw) * a * 0.5];
  geometry.computeBoundingSphere();
  return { geometry, bottom, top, candle, stemTip, triangles: geometry.attributes.position.count / 3 };
}

/** The body's half-width and half-height (for seating). */
export function pumpkinHalf(s: PumpkinSpec): { a: number; c: number } {
  return { a: s.width / 2, c: (s.width / 2) * s.squat };
}

// ---- seeded variety ---------------------------------------------------------------------------

// a muted ochre-orange rind (the reference's), dark brown furrows, sun-browned (never olive-green) patches
const SKIN = { skin: '#b4662e', groove: '#3c1c10', patch: '#6c5636', stem: '#4a3a36', flesh: '#f0c27a' };

/** The giant jack-o'-lantern: squat and heavy, deep ribs, warts, deep-carved and angry. */
export function giantSpec(seed: number, width: number): PumpkinSpec {
  return {
    seed,
    width,
    squat: 0.57,
    ribs: 11,
    ribDepth: 0.2,
    ribSharp: 0.66,
    dimple: 0.27,
    lopsided: 0.12,
    lean: 0.07,
    warts: 22,
    wartSize: 0.02,
    wall: 0.07,
    carve: 'angry',
    faceYaw: 0,
    faceTilt: 0.0,
    faceScale: 1,
    bevel: 0.3,
    chamfer: 0.011,
    brow: 1,
    proud: 1,
    openTop: null,
    stem: { h: width * 0.48, r: width * 0.082, curl: 0.72, lean: width * 0.07, twist: 3.6, yaw: 0 },
    vine: true,
    cols: 24,
    rows: 140,
    // a weathered, dusty ochre (a saturated orange read as a plastic toy)
    colors: { ...SKIN, skin: '#a26a3a' },
  };
}

/** A small pumpkin of seeded shape (tall, squat, warty, smooth), carved or plain; `face` scales its carving. */
export function smallSpec(seed: number, width: number, carve: Carve, face = 1): PumpkinSpec {
  const r = (k: number) => rand(seed, 'small', k);
  const tall = r(0);
  const plain = carve === 'none';
  return {
    seed,
    width,
    squat: 0.58 + 0.38 * tall,
    ribs: 8 + Math.floor(r(1) * 6),
    ribDepth: 0.05 + 0.08 * r(2),
    ribSharp: 0.4 + 0.4 * r(3),
    dimple: 0.18 + 0.15 * r(4),
    lopsided: 0.02 + 0.06 * r(5),
    lean: (r(6) - 0.5) * 0.16,
    warts: r(7) < 0.6 ? 2 + Math.floor(r(8) * 4) : 0,
    wartSize: 0.012,
    wall: 0.08,
    carve,
    faceYaw: 0,
    faceTilt: -0.04,
    faceScale: (0.9 + 0.2 * r(9)) * face,
    bevel: 0.3,
    chamfer: 0.013,
    brow: 0.5,
    proud: 0.5,
    openTop: null,
    stem: { h: width * (0.18 + 0.2 * r(10)), r: width * (0.05 + 0.02 * r(11)), curl: 0.2 + 0.7 * r(12), lean: width * 0.03 * (r(13) - 0.5), twist: 1.5, yaw: r(14) * TAU },
    vine: r(15) < 0.35,
    cols: plain ? 7 : 8,
    rows: plain ? 30 : 38,
    colors: { ...SKIN, skin: r(16) < 0.5 ? '#c06c32' : '#b4622c' },
  };
}

/** Clawd's pail: a little jack-o'-lantern bucket, its top cut away, a grin, no stem. */
export function pailSpec(seed: number, width: number): PumpkinSpec {
  return { ...smallSpec(seed, width, 'grin'), squat: 0.78, ribs: 10, ribDepth: 0.06, warts: 0, openTop: 0.62, stem: null, vine: false, wall: 0.06, cols: 6, rows: 28, lean: 0, faceTilt: -0.12, faceScale: 0.95 };
}
