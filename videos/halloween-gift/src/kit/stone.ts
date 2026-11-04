/**
 * Carved stone as geometry: headstones, crosses and obelisks as signed distance fields, meshed by
 * surface nets, so every stone is hand-cut rather than extruded: bevelled and slightly bulging
 * faces, edges worn unevenly (the rounding radius itself wanders), chips knocked off the edges
 * and corners (flat facets and conchoidal scoops, boolean-free: the field takes the max with the
 * chip's), grooved cracks, a stone snapped in two along a jagged break. Normals come from the
 * field's gradient at each vertex (projected onto the surface), and a curvature estimate per
 * vertex (convex edges > 0, crevices < 0) lets the caller lighten worn edges and darken hollows.
 *
 * Carving lives in a canvas (drawn once, seeded) mapped on the front faces: `CARVED_GLYPHS` are
 * hand-cut stroke letters (only those needed for RIP IN PEACE) and `pseudoGlyph` draws worn,
 * unreadable lettering.
 *
 * Deterministic: noise is hashed from coordinates and seeds (@aiv/core mix32), randomness comes
 * from the caller's seeded `rand`. Generic: no film imports.
 */
import { mix32 } from '@aiv/core';

export type V3 = [number, number, number];
export type SDF = (x: number, y: number, z: number) => number;

// ---- noise ------------------------------------------------------------------------------------

// a 32³ lattice of hashed values (built once): meshing a stone samples its field ~10⁵ times
const TN = 32;
const TM = TN - 1;
const TABLE = (() => {
  const t = new Float32Array(TN * TN * TN);
  for (let i = 0; i < t.length; i++) t[i] = mix32(Math.imul(i, 0x8da6b343) ^ 0x2f6b9e37) / 4294967296;
  return t;
})();

/** Stateless 3D value noise in [0, 1) (periodic over 32 units; seeds shift the lattice). */
export function noise3(x: number, y: number, z: number, seed: number): number {
  x += seed * 7.31;
  y += seed * 3.17;
  z += seed * 5.53;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let u = x - xi;
  let v = y - yi;
  let w = z - zi;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  w = w * w * (3 - 2 * w);
  // (L's lattice index, its wrapped coordinates worked out once for the eight corners)
  const ix0 = xi & TM;
  const ix1 = (xi + 1) & TM;
  const iy0 = TN * (yi & TM);
  const iy1 = TN * ((yi + 1) & TM);
  const iz0 = TN * TN * (zi & TM);
  const iz1 = TN * TN * ((zi + 1) & TM);
  const a = TABLE[ix0 + iy0 + iz0];
  const b = TABLE[ix1 + iy0 + iz0];
  const c = TABLE[ix0 + iy1 + iz0];
  const d = TABLE[ix1 + iy1 + iz0];
  const e = TABLE[ix0 + iy0 + iz1];
  const f = TABLE[ix1 + iy0 + iz1];
  const g = TABLE[ix0 + iy1 + iz1];
  const h = TABLE[ix1 + iy1 + iz1];
  const x0 = a + (b - a) * u;
  const x1 = c + (d - c) * u;
  const x2 = e + (f - e) * u;
  const x3 = g + (h - g) * u;
  const y0 = x0 + (x1 - x0) * v;
  const y1 = x2 + (x3 - x2) * v;
  return y0 + (y1 - y0) * w;
}

/** Fractal 3D value noise in about [-1, 1]. */
export function fbm3(x: number, y: number, z: number, seed: number, octaves = 3): number {
  let s = 0;
  let a = 1;
  let n = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    s += a * (noise3(x * f + o * 7.13, y * f - o * 3.31, z * f + o * 5.77, seed + o * 31) * 2 - 1);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

// ---- field helpers ----------------------------------------------------------------------------

/** Polynomial smooth minimum (union with a fillet of width k). */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export const smax = (a: number, b: number, k: number): number => -smin(-a, -b, k);

/** 2D box (half extents bx, by) signed distance. */
export function sdBox2(x: number, y: number, bx: number, by: number): number {
  const qx = Math.abs(x) - bx;
  const qy = Math.abs(y) - by;
  const mx = Math.max(qx, 0);
  const my = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(mx * mx + my * my);
}

/** 3D box with rounded edges (half extents, rounding r) signed distance. */
export function sdRoundBox(x: number, y: number, z: number, bx: number, by: number, bz: number, r: number): number {
  const qx = Math.abs(x) - bx + r;
  const qy = Math.abs(y) - by + r;
  const qz = Math.abs(z) - bz + r;
  const mx = Math.max(qx, 0);
  const my = Math.max(qy, 0);
  const mz = Math.max(qz, 0);
  return Math.min(Math.max(qx, qy, qz), 0) + Math.sqrt(mx * mx + my * my + mz * mz) - r;
}

/**
 * A 2D outline (signed distance d2 in the x-y plane) extruded to half thickness `th` with edges
 * rounded by r: the slab of a headstone.
 */
export function extrudeRound(d2: number, z: number, th: number, r: number): number {
  const wx = d2 + r;
  const wz = Math.abs(z) - th + r;
  const mx = Math.max(wx, 0);
  const mz = Math.max(wz, 0);
  return Math.min(Math.max(wx, wz), 0) + Math.sqrt(mx * mx + mz * mz) - r;
}

/** Distance from (x, y) to a 2D polyline, and the fraction along it (0..1) of the nearest point. */
export function polyline2(x: number, y: number, pts: readonly (readonly [number, number])[]): { d: number; t: number } {
  let best = Infinity;
  let bt = 0;
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(l);
    total += l;
  }
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const vx = pts[i][0] - ax;
    const vy = pts[i][1] - ay;
    const l2 = vx * vx + vy * vy || 1e-12;
    const t = Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / l2));
    const d = Math.hypot(x - ax - vx * t, y - ay - vy * t);
    if (d < best) {
      best = d;
      bt = (acc + t * lens[i - 1]) / (total || 1);
    }
    acc += lens[i - 1];
  }
  return { d: best, t: bt };
}

/**
 * `polyline2` for one fixed polyline, its segments worked out once (bit-identical: the same
 * arithmetic in the same order), and `near`: false only where every segment lies more than
 * `reach` away (a box test), so a caller that ignores the line beyond `reach` can skip it.
 */
export class Polyline {
  private readonly ax: Float64Array;
  private readonly ay: Float64Array;
  private readonly vx: Float64Array;
  private readonly vy: Float64Array;
  private readonly l2: Float64Array;
  private readonly lens: Float64Array;
  private readonly acc: Float64Array;
  private readonly box: Float64Array;
  private readonly total: number;
  private readonly res = { d: Infinity, t: 0 };
  constructor(pts: readonly (readonly [number, number])[], reach: number) {
    const n = Math.max(0, pts.length - 1);
    this.ax = new Float64Array(n);
    this.ay = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.l2 = new Float64Array(n);
    this.lens = new Float64Array(n);
    this.acc = new Float64Array(n);
    this.box = new Float64Array(n * 4);
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      this.lens[i - 1] = l;
      total += l;
    }
    this.total = total || 1;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const k = i - 1;
      this.ax[k] = ax;
      this.ay[k] = ay;
      this.vx[k] = pts[i][0] - ax;
      this.vy[k] = pts[i][1] - ay;
      this.l2[k] = this.vx[k] * this.vx[k] + this.vy[k] * this.vy[k] || 1e-12;
      this.acc[k] = acc;
      acc += this.lens[k];
      this.box[k * 4] = Math.min(ax, pts[i][0]) - reach;
      this.box[k * 4 + 1] = Math.max(ax, pts[i][0]) + reach;
      this.box[k * 4 + 2] = Math.min(ay, pts[i][1]) - reach;
      this.box[k * 4 + 3] = Math.max(ay, pts[i][1]) + reach;
    }
  }
  /** True unless (x, y) is more than `reach` from every segment (NaN is near). */
  near(x: number, y: number): boolean {
    const b = this.box;
    for (let k = 0; k < b.length; k += 4) if (!(x < b[k] || x > b[k + 1] || y < b[k + 2] || y > b[k + 3])) return true;
    return false;
  }
  /** = polyline2(x, y, pts) (the result object is reused). */
  at(x: number, y: number): { d: number; t: number } {
    let best = Infinity;
    let bt = 0;
    const n = this.ax.length;
    for (let k = 0; k < n; k++) {
      const ax = this.ax[k];
      const ay = this.ay[k];
      const vx = this.vx[k];
      const vy = this.vy[k];
      const t = Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / this.l2[k]));
      const d = Math.hypot(x - ax - vx * t, y - ay - vy * t);
      if (d < best) {
        best = d;
        bt = (this.acc[k] + t * this.lens[k]) / this.total;
      }
    }
    this.res.d = best;
    this.res.t = bt;
    return this.res;
  }
}

// ---- chips ------------------------------------------------------------------------------------

/** A chip knocked off an edge: a flat facet (plane) or a scoop (sphere), limited to a ball. */
export interface Chip {
  c: V3;
  /** outward direction of the facet (unit) */
  n: V3;
  /** facet depth below c along n, and the ball radius it is confined to */
  depth: number;
  radius: number;
  /** scoop instead of a flat facet */
  scoop: boolean;
}

/** The field with the chips cut out. */
export function chipped(sdf: SDF, chips: readonly Chip[]): SDF {
  if (!chips.length) return sdf;
  /** the field d with chip k's cut taken at (x, y, z) (d as it is beyond its ball) */
  const cutAt = (k: Chip, x: number, y: number, z: number, d: number): number => {
    const dx = x - k.c[0];
    const dy = y - k.c[1];
    const dz = z - k.c[2];
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 > k.radius * k.radius * 2.56) return d;
    const r = Math.sqrt(r2);
    let cut: number;
    if (k.scoop) {
      // a sphere centred outside the surface along n
      const ox = dx - k.n[0] * (k.radius - k.depth);
      const oy = dy - k.n[1] * (k.radius - k.depth);
      const oz = dz - k.n[2] * (k.radius - k.depth);
      cut = Math.sqrt(ox * ox + oy * oy + oz * oz) - k.radius;
    } else {
      // the half space beyond the facet plane, inside the ball
      cut = Math.max(-(dx * k.n[0] + dy * k.n[1] + dz * k.n[2] + k.depth), r - k.radius);
    }
    return Math.max(d, -cut);
  };
  const all = (x: number, y: number, z: number): number => {
    let d = sdf(x, y, z);
    for (const k of chips) d = cutAt(k, x, y, z, d);
    return d;
  };
  // Where the chips reach: a grid over their balls lists each cell's chips (in order), so a sample
  // tests only those that can reach it (the same test in the same order, the others would fail it:
  // the same field, much faster). Each ball is widened by 1e-6 against rounding.
  const PAD = 1e-6;
  const reach = chips.map((k) => Math.sqrt(k.radius * k.radius * 2.56) * (1 + 1e-9) + PAD);
  if (!chips.every((k, i) => Number.isFinite(reach[i]) && k.c.every(Number.isFinite))) return all;
  const lo: V3 = [Infinity, Infinity, Infinity];
  const hi: V3 = [-Infinity, -Infinity, -Infinity];
  chips.forEach((k, i) => {
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], k.c[a] - reach[i]);
      hi[a] = Math.max(hi[a], k.c[a] + reach[i]);
    }
  });
  const cs = Math.max(0.02, Math.min(...reach) * 0.75);
  const n = [0, 1, 2].map((a) => Math.max(1, Math.ceil((hi[a] - lo[a]) / cs)));
  const lists: number[][] = Array.from({ length: n[0] * n[1] * n[2] }, () => []);
  chips.forEach((k, ci) => {
    const r = reach[ci];
    const i0 = [0, 1, 2].map((a) => Math.max(0, Math.floor((k.c[a] - r - lo[a]) / cs) - 1));
    const i1 = [0, 1, 2].map((a) => Math.min(n[a] - 1, Math.floor((k.c[a] + r - lo[a]) / cs) + 1));
    for (let kk = i0[2]; kk <= i1[2]; kk++)
      for (let j = i0[1]; j <= i1[1]; j++)
        for (let i = i0[0]; i <= i1[0]; i++) {
          // the cell's box (padded) against the ball
          let q = 0;
          const ijk = [i, j, kk];
          for (let a = 0; a < 3; a++) {
            const b0 = lo[a] + ijk[a] * cs - PAD;
            const b1 = lo[a] + (ijk[a] + 1) * cs + PAD;
            const e = k.c[a] < b0 ? b0 - k.c[a] : k.c[a] > b1 ? k.c[a] - b1 : 0;
            q += e * e;
          }
          if (q <= r * r) lists[i + n[0] * (j + n[1] * kk)].push(ci);
        }
  });
  const [nx, ny, nz] = n;
  const [x0, y0, z0] = lo;
  const cells = lists.map((l) => Int32Array.from(l));
  // each chip packed: c, n, depth, radius, its ball (radius² · 2.56), radius − depth, scoop (cutAt's terms, the same values)
  const F = new Float64Array(chips.length * 11);
  chips.forEach((k, i) => F.set([k.c[0], k.c[1], k.c[2], k.n[0], k.n[1], k.n[2], k.depth, k.radius, k.radius * k.radius * 2.56, k.radius - k.depth, k.scoop ? 1 : 0], i * 11));
  return (x, y, z) => {
    const i = Math.floor((x - x0) / cs);
    const j = Math.floor((y - y0) / cs);
    const kk = Math.floor((z - z0) / cs);
    // outside every ball (NaN goes the long way, as before)
    if (!(i >= 0 && j >= 0 && kk >= 0 && i < nx && j < ny && kk < nz)) return x === x && y === y && z === z ? sdf(x, y, z) : all(x, y, z);
    let d = sdf(x, y, z);
    const list = cells[i + nx * (j + ny * kk)];
    for (let q = 0; q < list.length; q++) {
      // = cutAt(chips[list[q]], x, y, z, d)
      const o = list[q] * 11;
      const dx = x - F[o];
      const dy = y - F[o + 1];
      const dz = z - F[o + 2];
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 > F[o + 8]) continue;
      const r = Math.sqrt(r2);
      let cut: number;
      if (F[o + 10]) {
        const ox = dx - F[o + 3] * F[o + 9];
        const oy = dy - F[o + 4] * F[o + 9];
        const oz = dz - F[o + 5] * F[o + 9];
        cut = Math.sqrt(ox * ox + oy * oy + oz * oz) - F[o + 7];
      } else {
        cut = Math.max(-(dx * F[o + 3] + dy * F[o + 4] + dz * F[o + 5] + F[o + 6]), r - F[o + 7]);
      }
      d = Math.max(d, -cut);
    }
    return d;
  };
}

/** Unit gradient of a field (tetrahedral differences: four samples). */
export function gradient(sdf: SDF, x: number, y: number, z: number, h: number, out: V3 = [0, 0, 0]): V3 {
  const a = sdf(x + h, y - h, z - h);
  const b = sdf(x - h, y - h, z + h);
  const c = sdf(x - h, y + h, z - h);
  const d = sdf(x + h, y + h, z + h);
  const gx = a - b - c + d;
  const gy = -a - b + c + d;
  const gz = -a + b - c + d;
  const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
  out[0] = gx / l;
  out[1] = gy / l;
  out[2] = gz / l;
  return out;
}

/**
 * Chip sites: points on the surface where it is most convex (edges and corners), from seeded
 * candidates, each with the outward direction its facet takes. `rnd(k)` is the caller's seeded
 * uniform [0, 1).
 */
export function chipSites(sdf: SDF, min: V3, max: V3, count: number, rnd: (k: number) => number, o: { depth: [number, number]; radius: [number, number]; scoop?: number; minY?: number; spacing?: number }): Chip[] {
  const cands: { p: V3; n: V3; conv: number }[] = [];
  const g: V3 = [0, 0, 0];
  const e = Math.max(o.radius[0] * 0.5, 0.006);
  for (let i = 0; i < count * 30; i++) {
    let x = min[0] + (max[0] - min[0]) * rnd(i * 5);
    let y = min[1] + (max[1] - min[1]) * rnd(i * 5 + 1);
    let z = min[2] + (max[2] - min[2]) * rnd(i * 5 + 2);
    for (let it = 0; it < 6; it++) {
      const d = sdf(x, y, z);
      gradient(sdf, x, y, z, 0.002, g);
      x -= g[0] * d;
      y -= g[1] * d;
      z -= g[2] * d;
    }
    if (Math.abs(sdf(x, y, z)) > 0.004 || y < (o.minY ?? -Infinity)) continue;
    gradient(sdf, x, y, z, 0.002, g);
    const n: V3 = [g[0], g[1], g[2]];
    const conv = convexity(sdf, x, y, z, n, e);
    cands.push({ p: [x, y, z], n, conv });
  }
  cands.sort((a, b) => b.conv - a.conv);
  const out: Chip[] = [];
  const spacing = o.spacing ?? o.radius[1] * 1.5;
  for (const c of cands) {
    if (out.length >= count) break;
    if (c.conv < 0.05) break;
    if (out.some((k) => Math.hypot(k.c[0] - c.p[0], k.c[1] - c.p[1], k.c[2] - c.p[2]) < spacing)) continue;
    const k = out.length;
    // the facet leans off the edge's normal a little, so chips are not all alike
    const nx = c.n[0] + (rnd(9000 + k * 3) - 0.5) * 0.7;
    const ny = c.n[1] + (rnd(9001 + k * 3) - 0.5) * 0.7;
    const nz = c.n[2] + (rnd(9002 + k * 3) - 0.5) * 0.7;
    const l = Math.hypot(nx, ny, nz) || 1;
    const t = rnd(9100 + k);
    out.push({
      c: c.p,
      n: [nx / l, ny / l, nz / l],
      depth: o.depth[0] + (o.depth[1] - o.depth[0]) * t,
      radius: o.radius[0] + (o.radius[1] - o.radius[0]) * rnd(9200 + k),
      scoop: rnd(9300 + k) < (o.scoop ?? 0.35),
    });
  }
  return out;
}

/**
 * Hand-dressing: broad, shallow, slightly tilted flat cuts on the faces (the planes a mason's
 * chisel leaves), as chips confined to wide balls. Points are found from the bounds' sides
 * (`front` the share on +z, the rest on −z and ±x) projected onto the surface.
 */
export function faceFacets(sdf: SDF, min: V3, max: V3, count: number, rnd: (k: number) => number, o: { depth: [number, number]; radius: [number, number]; tilt: [number, number]; front?: number; minY?: number }): Chip[] {
  const out: Chip[] = [];
  const g: V3 = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const side = rnd(i * 9);
    const front = o.front ?? 0.55;
    let x = min[0] + (max[0] - min[0]) * (0.15 + 0.7 * rnd(i * 9 + 1));
    let y = Math.max(o.minY ?? min[1], min[1]) + (max[1] - Math.max(o.minY ?? min[1], min[1])) * (0.1 + 0.75 * rnd(i * 9 + 2));
    let z = min[2] + (max[2] - min[2]) * (0.2 + 0.6 * rnd(i * 9 + 3));
    if (side < front) z = max[2];
    else if (side < front + (1 - front) * 0.5) z = min[2];
    else x = rnd(i * 9 + 4) < 0.5 ? min[0] : max[0];
    for (let it = 0; it < 8; it++) {
      const d = sdf(x, y, z);
      gradient(sdf, x, y, z, 0.002, g);
      x -= g[0] * d;
      y -= g[1] * d;
      z -= g[2] * d;
    }
    if (Math.abs(sdf(x, y, z)) > 0.004) continue;
    gradient(sdf, x, y, z, 0.002, g);
    // tilt the facet off the face's normal in a random direction
    const a = rnd(i * 9 + 5) * Math.PI * 2;
    const t = o.tilt[0] + (o.tilt[1] - o.tilt[0]) * rnd(i * 9 + 6);
    const ax = Math.abs(g[0]) < 0.9 ? 1 : 0;
    let ux = ax ? 0 : -g[2];
    let uy = ax ? g[2] : 0;
    let uz = ax ? -g[1] : g[0];
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = g[1] * uz - g[2] * uy;
    const vy = g[2] * ux - g[0] * uz;
    const vz = g[0] * uy - g[1] * ux;
    const ca = Math.cos(a) * Math.sin(t);
    const sa = Math.sin(a) * Math.sin(t);
    const nx = g[0] * Math.cos(t) + ux * ca + vx * sa;
    const ny = g[1] * Math.cos(t) + uy * ca + vy * sa;
    const nz = g[2] * Math.cos(t) + uz * ca + vz * sa;
    const nl = Math.hypot(nx, ny, nz) || 1;
    out.push({
      c: [x, y, z],
      n: [nx / nl, ny / nl, nz / nl],
      depth: o.depth[0] + (o.depth[1] - o.depth[0]) * rnd(i * 9 + 7),
      radius: o.radius[0] + (o.radius[1] - o.radius[0]) * rnd(i * 9 + 8),
      scoop: false,
    });
  }
  return out;
}

/**
 * How convex the surface is at p (normal n), about −1..1: the field's mean over a ring of points
 * in the tangent plane at radius e, over e. Edges and corners > 0, flat ≈ 0, crevices < 0.
 */
export function convexity(sdf: SDF, x: number, y: number, z: number, n: V3, e: number): number {
  // a tangent basis
  const ax = Math.abs(n[0]) < 0.9 ? 1 : 0;
  const ay = ax ? 0 : 1;
  let tx = ay * n[2] - 0 * n[1];
  let ty = 0 * n[0] - ax * n[2];
  let tz = ax * n[1] - ay * n[0];
  const tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl;
  ty /= tl;
  tz /= tl;
  const bx = n[1] * tz - n[2] * ty;
  const by = n[2] * tx - n[0] * tz;
  const bz = n[0] * ty - n[1] * tx;
  let s = 0;
  const N = 4;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const c = Math.cos(a) * e;
    const sn = Math.sin(a) * e;
    s += sdf(x + tx * c + bx * sn, y + ty * c + by * sn, z + tz * c + bz * sn);
  }
  return s / N / e;
}

// ---- surface nets -----------------------------------------------------------------------------

export interface NetMesh {
  positions: Float32Array;
  normals: Float32Array;
  /** per vertex: convexity (edges > 0, hollows < 0) */
  convex: Float32Array;
  /** per vertex: occlusion 0 (buried in a crevice) .. 1 (open) */
  open: Float32Array;
  indices: Uint32Array;
}

/**
 * Mesh a field's zero set inside [min, max] on a grid of `cell` (naive surface nets: one vertex
 * per cell the surface crosses, at the mean of its edge crossings, then projected onto the
 * surface along the gradient; one quad per grid edge the surface crosses, split along its
 * shorter diagonal). Winding is counter-clockwise seen from outside.
 */
export function surfaceNets(sdf: SDF, min: V3, max: V3, cell: number): NetMesh {
  const nx = Math.max(2, Math.ceil((max[0] - min[0]) / cell) + 1);
  const ny = Math.max(2, Math.ceil((max[1] - min[1]) / cell) + 1);
  const nz = Math.max(2, Math.ceil((max[2] - min[2]) / cell) + 1);
  const val = new Float32Array(nx * ny * nz);
  const P = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  // (in P's order: one running index)
  for (let k = 0, p = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) val[p++] = sdf(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);

  const cx = nx - 1;
  const cy = ny - 1;
  const cz = nz - 1;
  const C = (i: number, j: number, k: number) => i + cx * (j + cy * k);
  const vid = new Int32Array(cx * cy * cz).fill(-1);
  const pos: number[] = [];
  // the 12 edges of a cell as pairs of corner bits (corner bit = i + 2j + 4k)
  const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
  const cv = new Float64Array(8);
  // a cell's corners from its first: corner b at +(b & 1), +nx·(b >> 1 & 1), +nx·ny·(b >> 2 & 1)
  const sY = nx;
  const sZ = nx * ny;
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        const p = P(i, j, k);
        const v0 = val[p];
        const v1 = val[p + 1];
        const v2 = val[p + sY];
        const v3 = val[p + sY + 1];
        const v4 = val[p + sZ];
        const v5 = val[p + sZ + 1];
        const v6 = val[p + sZ + sY];
        const v7 = val[p + sZ + sY + 1];
        const mask = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0) | (v4 < 0 ? 16 : 0) | (v5 < 0 ? 32 : 0) | (v6 < 0 ? 64 : 0) | (v7 < 0 ? 128 : 0);
        if (mask === 0 || mask === 255) continue;
        cv[0] = v0;
        cv[1] = v1;
        cv[2] = v2;
        cv[3] = v3;
        cv[4] = v4;
        cv[5] = v5;
        cv[6] = v6;
        cv[7] = v7;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (let e = 0; e < 24; e += 2) {
          const a = EDGES[e];
          const b = EDGES[e + 1];
          const va = cv[a];
          const vb = cv[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          n++;
        }
        vid[C(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
      }

  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const dac = (pos[a * 3] - pos[c * 3]) ** 2 + (pos[a * 3 + 1] - pos[c * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[c * 3 + 2]) ** 2;
    const dbd = (pos[b * 3] - pos[d * 3]) ** 2 + (pos[b * 3 + 1] - pos[d * 3 + 1]) ** 2 + (pos[b * 3 + 2] - pos[d * 3 + 2]) ** 2;
    if (dac <= dbd) tris.push(a, b, c, a, c, d);
    else tris.push(a, b, d, b, c, d);
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const p = P(i, j, k);
        const v0 = val[p];
        // x edge: cells around it in (y, z), counter-clockwise about +x
        if (i < cx && j > 0 && k > 0 && j < cy && k < cz) {
          const v1 = val[p + 1];
          if (v0 < 0 !== v1 < 0) {
            const a = vid[C(i, j - 1, k - 1)];
            const b = vid[C(i, j, k - 1)];
            const c = vid[C(i, j, k)];
            const d = vid[C(i, j - 1, k)];
            if (v0 < 0) quad(a, b, c, d);
            else quad(a, d, c, b);
          }
        }
        // y edge: cells around it in (z, x), counter-clockwise about +y
        if (j < cy && i > 0 && k > 0 && i < cx && k < cz) {
          const v1 = val[p + sY];
          if (v0 < 0 !== v1 < 0) {
            const a = vid[C(i - 1, j, k - 1)];
            const b = vid[C(i - 1, j, k)];
            const c = vid[C(i, j, k)];
            const d = vid[C(i, j, k - 1)];
            if (v0 < 0) quad(a, b, c, d);
            else quad(a, d, c, b);
          }
        }
        // z edge: cells around it in (x, y), counter-clockwise about +z
        if (k < cz && i > 0 && j > 0 && i < cx && j < cy) {
          const v1 = val[p + sZ];
          if (v0 < 0 !== v1 < 0) {
            const a = vid[C(i - 1, j - 1, k)];
            const b = vid[C(i, j - 1, k)];
            const c = vid[C(i, j, k)];
            const d = vid[C(i - 1, j, k)];
            if (v0 < 0) quad(a, b, c, d);
            else quad(a, d, c, b);
          }
        }
      }

  // the sampled grid, trilinear: convexity and openness come from it (cheap), not the field
  const grid = (x: number, y: number, z: number) => {
    const u = Math.min(nx - 1.0001, Math.max(0, (x - min[0]) / cell));
    const v = Math.min(ny - 1.0001, Math.max(0, (y - min[1]) / cell));
    const w = Math.min(nz - 1.0001, Math.max(0, (z - min[2]) / cell));
    const i = Math.floor(u);
    const j = Math.floor(v);
    const k = Math.floor(w);
    const fu = u - i;
    const fv = v - j;
    const fw = w - k;
    const p = P(i, j, k);
    const sx = 1;
    const sy = nx;
    const sz = nx * ny;
    const c00 = val[p] + (val[p + sx] - val[p]) * fu;
    const c10 = val[p + sy] + (val[p + sy + sx] - val[p + sy]) * fu;
    const c01 = val[p + sz] + (val[p + sz + sx] - val[p + sz]) * fu;
    const c11 = val[p + sz + sy] + (val[p + sz + sy + sx] - val[p + sz + sy]) * fu;
    const c0 = c00 + (c10 - c00) * fv;
    const c1 = c01 + (c11 - c01) * fv;
    return c0 + (c1 - c0) * fw;
  };
  // project the vertices onto the surface, then the normal, convexity and openness there
  const nv = pos.length / 3;
  const positions = new Float32Array(pos);
  const normals = new Float32Array(nv * 3);
  const convex = new Float32Array(nv);
  const open = new Float32Array(nv);
  const g: V3 = [0, 0, 0];
  const h = cell * 0.3;
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3];
    let y = pos[v * 3 + 1];
    let z = pos[v * 3 + 2];
    const x0 = x;
    const y0 = y;
    const z0 = z;
    {
      const d = sdf(x, y, z);
      gradient(sdf, x, y, z, h, g);
      x -= g[0] * d;
      y -= g[1] * d;
      z -= g[2] * d;
    }
    // never move a vertex out of its own neighbourhood (sharp features fold otherwise)
    const mv = Math.hypot(x - x0, y - y0, z - z0);
    if (mv > cell * 0.6) {
      const s = (cell * 0.6) / mv;
      x = x0 + (x - x0) * s;
      y = y0 + (y - y0) * s;
      z = z0 + (z - z0) * s;
    }
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    positions[v * 3 + 2] = z;
    gradient(sdf, x, y, z, h, g);
    normals[v * 3] = g[0];
    normals[v * 3 + 1] = g[1];
    normals[v * 3 + 2] = g[2];
    // (less the grid's own offset from the true surface at the vertex)
    convex[v] = convexity(grid, x, y, z, g, cell * 1.6) - grid(x, y, z) / (cell * 1.6);
    // openness: how far the field grows along the normal (a crevice stops it short)
    const d1 = grid(x + g[0] * cell * 3, y + g[1] * cell * 3, z + g[2] * cell * 3) / (cell * 3);
    open[v] = Math.min(1, Math.max(0, d1));
  }
  return { positions, normals, convex, open, indices: new Uint32Array(tris) };
}

// ---- carved letters ---------------------------------------------------------------------------

/**
 * Hand-cut stroke letters in a unit box (x right 0..w, y up 0..1), each a list of strokes, each
 * stroke a polyline (arcs pre-sampled). Only the letters a carving here needs.
 */
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as [number, number];
  });

export const CARVED_GLYPHS: Record<string, { w: number; strokes: [number, number][][] }> = {
  R: {
    w: 0.72,
    strokes: [
      [
        [0.08, 0],
        [0.08, 1],
      ],
      [[0.08, 1], [0.38, 1], ...arc(0.38, 0.75, 0.27, 0.25, Math.PI / 2, -Math.PI / 2, 10).slice(1), [0.08, 0.5]],
      [
        [0.33, 0.5],
        [0.68, 0],
      ],
    ],
  },
  I: {
    w: 0.36,
    strokes: [
      [
        [0.18, 0],
        [0.18, 1],
      ],
      [
        [0.07, 1],
        [0.29, 1],
      ],
      [
        [0.07, 0],
        [0.29, 0],
      ],
    ],
  },
  P: {
    w: 0.66,
    strokes: [
      [
        [0.08, 0],
        [0.08, 1],
      ],
      [[0.08, 1], [0.36, 1], ...arc(0.36, 0.74, 0.26, 0.26, Math.PI / 2, -Math.PI / 2, 10).slice(1), [0.08, 0.48]],
    ],
  },
  N: {
    w: 0.74,
    strokes: [
      [
        [0.08, 0],
        [0.08, 1],
        [0.66, 0],
        [0.66, 1],
      ],
    ],
  },
  E: {
    w: 0.6,
    strokes: [
      [
        [0.56, 1],
        [0.08, 1],
        [0.08, 0],
        [0.56, 0],
      ],
      [
        [0.08, 0.52],
        [0.46, 0.52],
      ],
    ],
  },
  A: {
    w: 0.76,
    strokes: [
      [
        [0.04, 0],
        [0.38, 1],
        [0.72, 0],
      ],
      [
        [0.17, 0.38],
        [0.59, 0.38],
      ],
    ],
  },
  C: { w: 0.7, strokes: [arc(0.4, 0.5, 0.32, 0.5, Math.PI * 0.28, Math.PI * 1.72, 16)] },
  ' ': { w: 0.4, strokes: [] },
};

/** Draw a word of carved letters as strokes (the caller sets stroke style, width and joins). */
export function strokeWord(g: CanvasRenderingContext2D, text: string, x: number, baseline: number, size: number, o: { spacing?: number; jitter?: (k: number) => number; slant?: number } = {}): number {
  const sp = o.spacing ?? 0.14;
  const jit = o.jitter ?? (() => 0);
  let cx = x;
  let k = 0;
  for (const ch of text) {
    const glyph = CARVED_GLYPHS[ch];
    if (!glyph) continue;
    for (const s of glyph.strokes) {
      g.beginPath();
      s.forEach(([u, v], i) => {
        const px = cx + (u + (o.slant ?? 0) * v) * size + jit(k++) * size;
        const py = baseline - v * size + jit(k++) * size;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.stroke();
    }
    cx += (glyph.w + sp) * size;
  }
  return cx - x - sp * size;
}

/** The width of a carved word in units of its size. */
export function wordWidth(text: string, spacing = 0.14): number {
  let w = 0;
  for (const ch of text) w += (CARVED_GLYPHS[ch]?.w ?? 0) + spacing;
  return w - spacing;
}

/**
 * A worn, unreadable letter of even cap height h at (x, baseline) (y grows downward, canvas
 * convention): stems, cap and base bars, diagonals and bowls that span the full cap height, as
 * worn capitals do from a few steps away, but never a whole letter (one stroke of most is worn
 * away). Strokes one at a time; returns its advance width. `r(k)` is the caller's seeded uniform.
 */
export function pseudoGlyph(g: CanvasRenderingContext2D, x: number, baseline: number, h: number, r: (k: number) => number): number {
  const kind = Math.floor(r(0) * 6);
  const w = h * [0.3, 0.72, 0.6, 0.78, 0.62, 0.72][kind];
  const top = baseline - h;
  const strokes: [number, number][][] = [];
  const L = x + w * 0.12;
  const R = x + w * 0.88;
  const M = x + w * 0.5;
  switch (kind) {
    case 0:
      strokes.push([[M, baseline], [M, top]]);
      break;
    case 1:
      strokes.push([[L, baseline], [L, top]], [[R, baseline], [R, top]], r(1) < 0.5 ? [[L, top], [R, baseline]] : [[L, baseline - h * 0.5], [R, baseline - h * 0.5]]);
      break;
    case 2:
      strokes.push([[L, baseline], [L, top]], [[L, top], [R, top]], r(1) < 0.5 ? [[L, baseline], [R, baseline]] : [[L, baseline - h * 0.5], [R - w * 0.15, baseline - h * 0.5]]);
      break;
    case 3: {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        pts.push([M + Math.cos(a) * w * 0.38, baseline - h * 0.5 + Math.sin(a) * h * 0.5]);
      }
      strokes.push(pts.slice(0, 8), pts.slice(7));
      break;
    }
    case 4: {
      const pts: [number, number][] = [[L, top]];
      for (let k = 0; k <= 8; k++) {
        const a = -Math.PI / 2 + (k / 8) * Math.PI;
        pts.push([L + w * 0.42 + Math.cos(a) * w * 0.32, top + h * 0.27 + Math.sin(a) * h * 0.27]);
      }
      pts.push([L, top + h * 0.54]);
      strokes.push([[L, baseline], [L, top]], pts);
      break;
    }
    default:
      strokes.push([[L, top], [M, baseline]], [[M, baseline], [R, top]]);
  }
  // one stroke of a many-stroke letter is worn away
  const drop = strokes.length > 1 && r(2) < 0.7 ? Math.floor(r(3) * strokes.length) : -1;
  strokes.forEach((st, k) => {
    if (k === drop) return;
    g.beginPath();
    st.forEach(([u, v], i) => (i ? g.lineTo(u, v) : g.moveTo(u, v)));
    g.stroke();
  });
  return w;
}

// ---- headstones -------------------------------------------------------------------------------

export type StoneKind = 'round' | 'gothic' | 'slab' | 'cross' | 'obelisk';

export interface StoneShape {
  kind: StoneKind;
  seed: number;
  /** height above the ground line (y = 0), width (a cross: its stem), thickness */
  h: number;
  w: number;
  t: number;
  /** how far the stone reaches below the ground line */
  sink: number;
  /** edge rounding (world units) and how much it wanders over the stone (0..1) */
  round: number;
  roundVar?: number;
  /** the faces bulge by this fraction of the half thickness at their centre */
  bulge?: number;
  /** the width grows toward the base by this fraction */
  taper?: number;
  /** weathering: lumpy displacement amplitude (world units) and its features per unit */
  wear?: number;
  wearFreq?: number;
  /** round: the arch radius as a multiple of the half width (1 a semicircle, larger flatter) */
  arch?: number;
  /** shoulders: the top narrower than the body by this fraction, stepped at the springing */
  shoulders?: number;
  /** slab: the top's rise at the centre (a low gable) */
  gable?: number;
  /** the top skews: one shoulder higher than the other (rise per unit x, applied toward the top) */
  skew?: number;
  /** a flat 45° chamfer of this width on the face edges (crisp highlight lines), instead of a round */
  chamfer?: number;
  /** cross: arm centre height (fraction of h), span and arm height (world units) */
  arm?: { at: number; span: number; hgt: number };
  /** a plinth under the stone: its height above the ground line and its overhang */
  plinth?: { h: number; out: number };
  /** grooved cracks: 2D polylines across the face (x, y), half width, depth from each face */
  cracks?: { pts: [number, number][]; width: number; depth: number }[];
  /** carved grooves of even width (a panel border): 2D polylines on the front face (z > 0) only, half width, depth */
  grooves?: { pts: [number, number][]; width: number; depth: number }[];
  /**
   * cut along a break and keep one side: the break is a fan of flat fracture facets (seeded
   * planes, `rough` their height range) about the plane y + tilt·x
   */
  split?: { y: number; tilt: number; rough: number; keep: 'below' | 'above' };
}

/** The stone's half width at height y (it widens toward the base). */
export function halfWidth(s: StoneShape, y: number): number {
  return (s.w / 2) * (1 + (s.taper ?? 0) * Math.min(1.3, Math.max(0, 1 - y / s.h)));
}

/**
 * `outline` for one stone, its constants worked out once (the same arithmetic: the field asks
 * for it ~10⁵ times a stone, and the round arch's springing alone took a 3-step iteration).
 */
function outlineOf(s: StoneShape): (x: number, y0: number) => number {
  const skew = s.skew ?? 0;
  const taper = s.taper ?? 0;
  const hw0 = s.w / 2;
  const sink = s.sink;
  const h = s.h;
  // = halfWidth(s, y)
  const hwAt = (y: number) => hw0 * (1 + taper * Math.min(1.3, Math.max(0, 1 - y / h)));
  const shear = (x: number, y0: number) => y0 - skew * x * Math.min(1, Math.max(0, y0 / h));
  switch (s.kind) {
    case 'round': {
      const sh = s.shoulders ?? 0;
      let hwA = hw0 * (1 - sh);
      if (sh === 0 && s.taper)
        for (let it = 0; it < 3; it++) {
          const R0 = hwA * (s.arch ?? 1);
          const yS0 = s.h - R0 + Math.sqrt(Math.max(0, R0 * R0 - hwA * hwA));
          hwA = hw0 * (1 + s.taper * Math.min(1.3, Math.max(0, 1 - yS0 / s.h)));
        }
      const R = hwA * (s.arch ?? 1);
      const cy = s.h - R;
      const yS = cy + Math.sqrt(Math.max(0, R * R - hwA * hwA));
      const ySh = yS - 0.012 - sh * 0.15;
      if (sh > 0)
        return (x, y0) => {
          const y = shear(x, y0);
          const ax = Math.abs(x);
          const arch = Math.max(ax - hwA, Math.min(y - yS, Math.hypot(x, y - cy) - R));
          return Math.max(Math.min(arch, Math.max(ax - hwAt(y), y - ySh)), -(y0 + sink));
        };
      return (x, y0) => {
        const y = shear(x, y0);
        return Math.max(Math.max(Math.abs(x) - hwAt(y), Math.min(y - yS, Math.hypot(x, y - cy) - R)), -(y0 + sink));
      };
    }
    case 'gothic': {
      const sh = s.shoulders ?? 0;
      const hwA = hw0 * (1 - sh);
      const R = hwA * 1.9;
      const ha = Math.sqrt(R * R - (R - hwA) * (R - hwA));
      const yS = s.h - ha;
      const off = hwA - R;
      const yS1 = yS - 0.01;
      return (x, y0) => {
        const y = shear(x, y0);
        const ax = Math.abs(x);
        const lens = Math.max(Math.hypot(x - off, y - yS) - R, Math.hypot(x + off, y - yS) - R);
        const d = sh > 0 ? Math.min(Math.max(ax - hwA, Math.min(y - yS, lens)), Math.max(ax - hwAt(y), y - yS1)) : Math.max(ax - hwAt(y), Math.min(y - yS, lens));
        return Math.max(d, -(y0 + sink));
      };
    }
    case 'cross': {
      const a = s.arm ?? { at: 0.72, span: s.w * 3, hgt: s.w };
      const sy = (s.h - s.sink) / 2;
      const sby = (s.h + s.sink) / 2 - 0.006;
      const ay = s.h * a.at;
      const abx = a.span / 2 - 0.006;
      const aby = a.hgt / 2 - 0.006;
      return (x, y0) => {
        const y = shear(x, y0);
        const stem = sdBox2(x, y - sy, hwAt(y) - 0.006, sby) - 0.006;
        const arm = sdBox2(x, y - ay, abx, aby) - 0.006;
        return Math.max(smin(stem, arm, 0.02), -(y0 + sink));
      };
    }
    default:
      return (x, y0) => outline(s, x, y0);
  }
}

/** The 2D outline of a slab-like stone (signed distance in x, y). */
function outline(s: StoneShape, x: number, y0: number): number {
  // a skewed top: the outline's upper part is sheared, the base stays level
  const y = y0 - (s.skew ?? 0) * x * Math.min(1, Math.max(0, y0 / s.h));
  const hw = halfWidth(s, y);
  const hw0 = s.w / 2;
  const ax = Math.abs(x);
  const below = -(y0 + s.sink);
  let d: number;
  switch (s.kind) {
    case 'round': {
      const sh = s.shoulders ?? 0;
      let hwA = hw0 * (1 - sh);
      // without shoulders the arch springs from the tapered body's own width (no ledge there)
      if (sh === 0 && s.taper)
        for (let it = 0; it < 3; it++) {
          const R0 = hwA * (s.arch ?? 1);
          const yS0 = s.h - R0 + Math.sqrt(Math.max(0, R0 * R0 - hwA * hwA));
          hwA = hw0 * (1 + s.taper * Math.min(1.3, Math.max(0, 1 - yS0 / s.h)));
        }
      const R = hwA * (s.arch ?? 1);
      const cy = s.h - R;
      const yS = cy + Math.sqrt(Math.max(0, R * R - hwA * hwA));
      const arch = Math.max(ax - hwA, Math.min(y - yS, Math.hypot(x, y - cy) - R));
      d = sh > 0 ? Math.min(arch, Math.max(ax - hw, y - (yS - 0.012 - sh * 0.15))) : Math.max(ax - hw, Math.min(y - yS, Math.hypot(x, y - cy) - R));
      break;
    }
    case 'gothic': {
      const sh = s.shoulders ?? 0;
      const hwA = hw0 * (1 - sh);
      const R = hwA * 1.9;
      const ha = Math.sqrt(R * R - (R - hwA) * (R - hwA));
      const yS = s.h - ha;
      const lens = Math.max(Math.hypot(x - (hwA - R), y - yS) - R, Math.hypot(x + (hwA - R), y - yS) - R);
      const arch = Math.max(ax - hwA, Math.min(y - yS, lens));
      d = sh > 0 ? Math.min(arch, Math.max(ax - hw, y - (yS - 0.01))) : Math.max(ax - hw, Math.min(y - yS, lens));
      break;
    }
    case 'slab': {
      const top = s.h - (s.gable ?? 0) * Math.pow(Math.min(1, ax / hw0), 1.4);
      d = Math.max(ax - hw, y - top);
      break;
    }
    case 'cross': {
      const a = s.arm ?? { at: 0.72, span: s.w * 3, hgt: s.w };
      const stem = sdBox2(x, y - (s.h - s.sink) / 2, hw - 0.006, (s.h + s.sink) / 2 - 0.006) - 0.006;
      const arm = sdBox2(x, y - s.h * a.at, a.span / 2 - 0.006, a.hgt / 2 - 0.006) - 0.006;
      // a fillet in the four inner corners
      d = smin(stem, arm, 0.02);
      break;
    }
    default:
      d = Math.max(ax - hw, y - s.h);
  }
  return Math.max(d, below);
}

/** The obelisk: a plinth, a die with a cornice, a tapering shaft and a pyramid cap. */
function obelisk(s: StoneShape, x: number, y: number, z: number): number {
  const r = s.round;
  const pb = s.w / 2;
  const ph = s.h * 0.085;
  const db = pb * 0.8;
  const dh = s.h * 0.22;
  const ch = s.h * 0.035;
  const y0 = ph + dh + ch;
  const pyr = s.h * 0.09;
  const y1 = s.h - pyr;
  const s0 = db * 0.7;
  const s1 = s0 * 0.72;
  const plinth = sdRoundBox(x, y - (ph - s.sink) / 2, z, pb, (ph + s.sink) / 2, pb, r);
  const die = sdRoundBox(x, y - (ph + dh / 2), z, db, dh / 2, db, r);
  const cornice = sdRoundBox(x, y - (ph + dh + ch / 2), z, db * 1.1, ch / 2, db * 1.1, r * 0.7);
  const u = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
  const hs = s0 + (s1 - s0) * u;
  const shaft = sdRoundBox(x, y - (y0 + y1) / 2, z, hs, (y1 - y0) / 2 + r, hs, r) * 0.98;
  const hp = s1 * Math.max(0, (s.h - y) / pyr);
  const cap = Math.max(Math.abs(x) - hp, Math.abs(z) - hp, y1 - y, y - s.h) * 0.85;
  return smin(smin(smin(plinth, die, 0.008), smin(cornice, shaft, 0.006), 0.006), cap, 0.004);
}

/** The bounds of a stone's field (local, with a margin). */
export function stoneBounds(s: StoneShape, margin = 0.03): { min: V3; max: V3 } {
  const hwMax = Math.max(halfWidth(s, -s.sink), s.kind === 'cross' ? (s.arm?.span ?? s.w * 3) / 2 : 0, s.plinth ? s.w / 2 + s.plinth.out : 0, s.kind === 'obelisk' ? s.w / 2 : 0);
  const th = s.kind === 'obelisk' ? s.w / 2 : (s.t / 2) * (1 + (s.bulge ?? 0)) + (s.plinth?.out ?? 0) + (s.taper ?? 0) * s.t * 0.4;
  const top = s.h + (s.wear ?? 0) * 2;
  return { min: [-hwMax - margin, -s.sink - margin, -th - margin], max: [hwMax + margin, top + margin, th + margin] };
}

/** A stone's signed distance field in its own frame (x across, y up from the ground line, z out of its front). */
export function stoneField(s: StoneShape): SDF {
  const seed = s.seed;
  const wear = s.wear ?? 0;
  const wf = s.wearFreq ?? 14;
  const rv = s.roundVar ?? 0.6;
  const band = wear * 3 + 0.02;
  // each crack's and groove's bounds widened by its reach (3 widths) and a margin far beyond
  // rounding: outside them polyline2's distance exceeds 3 widths, so the test can be skipped
  const reach = (list: { pts: [number, number][]; width: number; depth: number }[] | undefined) => (list ?? []).map((c) => ({ width: c.width, depth: c.depth, w3: c.width * 3, line: new Polyline(c.pts, c.width * 3 * (1 + 1e-9) + 1e-9) }));
  const cracks = reach(s.cracks);
  const grooves = reach(s.grooves);
  // (the shape's constants, once: the same values the expressions below took per sample)
  const outlineAt = outlineOf(s);
  const obeliskKind = s.kind === 'obelisk';
  const h = s.h;
  const hw0 = s.w / 2;
  const taper = s.taper ?? 0;
  const h45 = s.h * 0.45;
  const hMin = Math.max(s.h, 1e-3);
  const t2 = s.t / 2;
  const bulge = s.bulge ?? 0;
  const taper4 = taper * 0.4;
  const chamfer = s.chamfer;
  const round = s.round;
  const kCh = Math.min(s.round, 0.006);
  const pl = s.plinth ? { pw: halfWidth(s, 0) + s.plinth.out, pt: s.t / 2 + s.plinth.out, cy: (s.plinth.h - s.sink) / 2, hy: (s.plinth.h + s.sink) / 2, r: s.round * 0.8 } : null;
  const base: SDF = (x, y, z) => {
    if (obeliskKind) return obelisk(s, x, y, z);
    const d2 = outlineAt(x, y);
    // (halfWidth(s, y) and the taper's share of the thickness share their clamp)
    const tw = Math.min(1.3, Math.max(0, 1 - y / h));
    const hw = Math.max(hw0 * (1 + taper * tw), 1e-3);
    const ux = Math.min(1, Math.abs(x) / hw);
    const uy = (y - h45) / hMin;
    const th = t2 * (1 + bulge * (1 - ux * ux) * Math.max(0, 1 - uy * uy * 2.2) + taper4 * tw);
    let d: number;
    if (chamfer) {
      // a flat chamfer whose width wanders, its edges softened by a narrow round
      const ez = Math.abs(z) - th;
      const k = kCh;
      d = Math.max(d2, ez);
      if (Math.abs(d) < band) {
        const ch = chamfer * (1 + rv * (noise3(x * 4.3, y * 4.3, z * 4.3, seed + 12) * 2 - 1));
        d = smax(smax(d2, ez, k), (d2 + ez + Math.max(0.002, ch)) * Math.SQRT1_2, k);
      }
    } else {
      d = extrudeRound(d2, z, th, Math.min(round, th * 0.9));
      if (rv > 0 && Math.abs(d) < band) {
        const r = Math.max(0.002, round * (1 + rv * (noise3(x * 5.1, y * 5.1, z * 5.1, seed + 11) * 2 - 1)));
        d = extrudeRound(d2, z, th, Math.min(r, th * 0.9));
      }
    }
    if (pl) d = smin(d, sdRoundBox(x, y - pl.cy, z, pl.pw, pl.hy, pl.pt, pl.r), 0.01);
    for (const c of cracks) {
      // (well clear of every segment: polyline2 would find it beyond 3 widths too)
      if (!c.line.near(x, y)) continue;
      const p = c.line.at(x, y);
      if (p.d > c.w3) continue;
      const hwid = c.width * (1 - 0.8 * p.t * p.t);
      const groove = Math.max(p.d - hwid, th - c.depth - Math.abs(z));
      d = Math.max(d, -groove);
    }
    if (z > 0)
      for (const c of grooves) {
        if (!c.line.near(x, y)) continue;
        const p = c.line.at(x, y);
        if (p.d > c.w3) continue;
        // a V-ish channel: full depth on its line, shallower toward its lips
        const groove = Math.max(p.d - c.width, th - c.depth * (1 - 0.45 * (p.d / c.width) ** 2) - z);
        d = Math.max(d, -groove);
      }
    return d;
  };
  const worn: SDF =
    wear > 0
      ? (x, y, z) => {
          const d = base(x, y, z);
          if (Math.abs(d) > band) return d;
          return d + wear * 0.6 * (noise3(x * wf, y * wf, z * wf, seed + 3) * 2 - 1 + 0.5 * (noise3(x * wf * 2.3, y * wf * 2.3, z * wf * 2.3, seed + 4) * 2 - 1) + 0.35 * (noise3(x * wf * 5.1, y * wf * 5.1, z * wf * 5.1, seed + 5) * 2 - 1));
        }
      : base;
  const sp = s.split;
  if (!sp) return worn;
  const brk = breakField(s);
  return (x, y, z) => {
    const b = brk(x, y, z);
    const d = worn(x, y, z);
    return sp.keep === 'below' ? Math.max(d, b) : Math.max(d, -b);
  };
}

/**
 * The break of a split stone as a field: < 0 below the fracture, > 0 above it (about a distance).
 * The fracture is flat facets, as stone snaps: the plane y + tilt·x raised by
 * max(min(P0, P1), min(P2, P3), min(P4, P5)) of six seeded planes (heights within ±rough,
 * slopes across the face and through the thickness), so ridges and valleys meet at crisp creases.
 */
export function breakField(s: StoneShape): SDF {
  const sp = s.split;
  if (!sp) return () => -1;
  const hr = (k: number) => mix32(Math.imul(s.seed + 911, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) / 4294967296;
  const P = Array.from({ length: 6 }, (_, k) => ({ h: (hr(k * 3) - 0.5) * 2 * sp.rough, gx: (hr(k * 3 + 1) - 0.5) * 1.1, gz: (hr(k * 3 + 2) - 0.5) * 1.5 }));
  return (x, y, z) => {
    let best = -Infinity;
    let bi = 0;
    for (let k = 0; k < 6; k += 2) {
      const a = P[k].h + P[k].gx * x + P[k].gz * z;
      const b = P[k + 1].h + P[k + 1].gx * x + P[k + 1].gz * z;
      const m = a < b ? a : b;
      if (m > best) {
        best = m;
        bi = a < b ? k : k + 1;
      }
    }
    const gx = P[bi].gx + sp.tilt;
    const gz = P[bi].gz;
    return (y - (sp.y + sp.tilt * x + best)) / Math.sqrt(1 + gx * gx + gz * gz);
  };
}
