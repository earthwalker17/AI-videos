/**
 * Centripetal Catmull-Rom splines with an arc-length table, in 2D (paths on the ground: x, z)
 * and 3D (camera positions and aim points). Centripetal parametrisation never overshoots into
 * cusps or loops between unevenly spaced keys, which is what makes a camera or a walk read as
 * one continuous move instead of key-to-key segments. Pure functions of their inputs.
 * Generic: no film imports (listed in video.json `reusable`).
 */

export type P2 = readonly [number, number];
export type P3 = readonly [number, number, number];

function cr1(p0: number, p1: number, p2: number, p3: number, t0: number, t1: number, t2: number, t3: number, t: number): number {
  // Barry–Goldman pyramidal form of the non-uniform Catmull-Rom segment between p1 and p2
  const a1 = ((t1 - t) * p0 + (t - t0) * p1) / (t1 - t0);
  const a2 = ((t2 - t) * p1 + (t - t1) * p2) / (t2 - t1);
  const a3 = ((t3 - t) * p2 + (t - t2) * p3) / (t3 - t2);
  const b1 = ((t2 - t) * a1 + (t - t0) * a2) / (t2 - t0);
  const b2 = ((t3 - t) * a2 + (t - t1) * a3) / (t3 - t1);
  return ((t2 - t) * b1 + (t - t1) * b2) / (t2 - t1);
}

/** A centripetal Catmull-Rom curve through `pts` (any dimension), end tangents by reflection. */
export class Curve<P extends readonly number[]> {
  readonly pts: number[][];
  private readonly knots: number[];
  private readonly table: { u: number; s: number }[] = [];
  readonly length: number;

  constructor(points: readonly P[], samplesPerSegment = 48) {
    if (points.length < 2) throw new Error('a curve needs two points');
    const p = points.map((q) => [...q]);
    // phantom ends: reflect the second point through the first (and the last)
    const first = p[0].map((v, i) => 2 * v - p[1][i]);
    const last = p[p.length - 1].map((v, i) => 2 * v - p[p.length - 2][i]);
    this.pts = [first, ...p, last];
    this.knots = [0];
    for (let i = 1; i < this.pts.length; i++) {
      const d = Math.sqrt(this.pts[i].reduce((s, v, k) => s + (v - this.pts[i - 1][k]) ** 2, 0));
      this.knots.push(this.knots[i - 1] + Math.max(1e-6, Math.sqrt(d)));
    }
    // arc-length table over u in [0, 1]
    const n = (points.length - 1) * samplesPerSegment;
    let s = 0;
    let prev = this.at(0);
    this.table.push({ u: 0, s: 0 });
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const q = this.at(u);
      s += Math.sqrt(q.reduce((acc, v, k) => acc + (v - prev[k]) ** 2, 0));
      this.table.push({ u, s });
      prev = q;
    }
    this.length = s;
  }

  /** The point at curve parameter u in [0, 1] (uniform in segments, not in length). */
  at(u: number): number[] {
    const segs = this.pts.length - 3;
    const x = Math.min(Math.max(u, 0), 1) * segs;
    const i = Math.min(segs - 1, Math.floor(x));
    const k = this.knots;
    const t = k[i + 1] + (x - i) * (k[i + 2] - k[i + 1]);
    const [p0, p1, p2, p3] = [this.pts[i], this.pts[i + 1], this.pts[i + 2], this.pts[i + 3]];
    return p1.map((_, d) => cr1(p0[d], p1[d], p2[d], p3[d], k[i], k[i + 1], k[i + 2], k[i + 3], t));
  }

  /** The curve parameter at arc length s (clamped). */
  uAt(s: number): number {
    const tb = this.table;
    if (s <= 0) return 0;
    if (s >= this.length) return 1;
    let lo = 0;
    let hi = tb.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tb[mid].s < s) lo = mid;
      else hi = mid;
    }
    const a = tb[lo];
    const b = tb[hi];
    return a.u + ((s - a.s) / Math.max(1e-9, b.s - a.s)) * (b.u - a.u);
  }

  /** The point at arc length s. */
  pointAt(s: number): number[] {
    return this.at(this.uAt(s));
  }

  /** The unit tangent at arc length s (central difference). */
  tangentAt(s: number): number[] {
    const h = Math.min(0.02, this.length * 0.001);
    const a = this.pointAt(Math.max(0, s - h));
    const b = this.pointAt(Math.min(this.length, s + h));
    const d = b.map((v, i) => v - a[i]);
    const l = Math.sqrt(d.reduce((acc, v) => acc + v * v, 0)) || 1;
    return d.map((v) => v / l);
  }

  /** A polyline of n + 1 points evenly spaced in arc length. */
  polyline(n: number): number[][] {
    return Array.from({ length: n + 1 }, (_, i) => this.pointAt((i / n) * this.length));
  }
}

/** Distance from (x, z) to a 2D polyline, and the arc length of the nearest point on it. */
export function distanceToPolyline(x: number, z: number, line: readonly (readonly number[])[]): { d: number; s: number } {
  let best = Infinity;
  let bestS = 0;
  let acc = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const vx = bx - ax;
    const vz = bz - az;
    const l2 = vx * vx + vz * vz || 1e-12;
    const t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / l2));
    const px = ax + vx * t;
    const pz = az + vz * t;
    const d = Math.hypot(x - px, z - pz);
    const seg = Math.sqrt(l2);
    if (d < best) {
      best = d;
      bestS = acc + t * seg;
    }
    acc += seg;
  }
  return { d: best, s: bestS };
}
