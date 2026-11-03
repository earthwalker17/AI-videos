/**
 * Camera paths that move like one continuous crane, not key to key: positions and aim points
 * on centripetal Catmull-Rom curves (no cusps or loops between uneven keys), parametrised in
 * knot time, and a monotone cubic time warp from film frames to knot time (Fritsch–Carlson), so
 * velocity is continuous through every key. A key marked `hold` is a deliberate stop: the warp's
 * slope is zero there, so the move eases in and out of it; every other key is passed through
 * at speed. Field of view and focus follow the same warp. Pure functions of the frame.
 */
import type { V3 } from './timeline.ts';

export interface CamKey {
  f: number;
  pos: V3;
  look: V3;
  fov: number;
  focus: number;
  /** stop here (ease in and out); otherwise pass through */
  hold?: boolean;
}

export interface CamPose {
  pos: V3;
  look: V3;
  fov: number;
  focus: number;
}

/** Barry–Goldman evaluation of one coordinate on the segment p1..p2 with knots t0..t3. */
function bg(p0: number, p1: number, p2: number, p3: number, t0: number, t1: number, t2: number, t3: number, t: number): number {
  const a1 = ((t1 - t) * p0 + (t - t0) * p1) / (t1 - t0);
  const a2 = ((t2 - t) * p1 + (t - t1) * p2) / (t2 - t1);
  const a3 = ((t3 - t) * p2 + (t - t2) * p3) / (t3 - t2);
  const b1 = ((t2 - t) * a1 + (t - t0) * a2) / (t2 - t0);
  const b2 = ((t3 - t) * a2 + (t - t1) * a3) / (t3 - t1);
  return ((t2 - t) * b1 + (t - t1) * b2) / (t2 - t1);
}

/** Monotone cubic Hermite through (x[i], y[i]) with Fritsch–Carlson slopes; `zero[i]` forces slope 0. */
class Monotone {
  private readonly m: number[];
  constructor(
    private readonly x: number[],
    private readonly y: number[],
    zero: boolean[],
  ) {
    const n = x.length;
    const d = Array.from({ length: n - 1 }, (_, i) => (y[i + 1] - y[i]) / (x[i + 1] - x[i]));
    const m = Array.from({ length: n }, (_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
    zero.forEach((z, i) => z && (m[i] = 0));
    this.m = m;
  }
  at(v: number): number {
    const { x, y, m } = this;
    if (v <= x[0]) return y[0];
    if (v >= x[x.length - 1]) return y[y.length - 1];
    let i = 0;
    while (v > x[i + 1]) i++;
    const h = x[i + 1] - x[i];
    const t = (v - x[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h * m[i + 1];
  }
}

export class CamPath {
  private readonly knots: number[];
  private readonly P: number[][];
  private readonly L: number[][];
  private readonly warp: Monotone;
  private readonly fov: Monotone;
  private readonly focus: Monotone;

  constructor(readonly keys: CamKey[]) {
    if (keys.length < 2) throw new Error('a camera path needs two keys');
    for (let i = 1; i < keys.length; i++) if (!(keys[i].f > keys[i - 1].f)) throw new Error(`camera keys out of order at ${keys[i].f}`);
    const P = keys.map((k) => [...k.pos]);
    const L = keys.map((k) => [...k.look]);
    // phantom ends by reflection, centripetal knots from the positions (and the aim, so a pan in place still has length)
    const ext = (a: number[][]) => [a[0].map((v, i) => 2 * v - a[1][i]), ...a, a[a.length - 1].map((v, i) => 2 * v - a[a.length - 2][i])];
    this.P = ext(P);
    this.L = ext(L);
    this.knots = [0];
    for (let i = 1; i < this.P.length; i++) {
      const dp = Math.hypot(...this.P[i].map((v, k) => v - this.P[i - 1][k]));
      const dl = Math.hypot(...this.L[i].map((v, k) => v - this.L[i - 1][k]));
      this.knots.push(this.knots[i - 1] + Math.max(1e-4, Math.sqrt(dp + 0.35 * dl)));
    }
    const fs = keys.map((k) => k.f);
    const holds = keys.map((k, i) => !!k.hold || i === 0 || i === keys.length - 1);
    this.warp = new Monotone(fs, keys.map((_, i) => this.knots[i + 1]), holds);
    this.fov = new Monotone(fs, keys.map((k) => k.fov), holds);
    this.focus = new Monotone(fs, keys.map((k) => k.focus), holds);
  }

  private curve(pts: number[][], t: number): V3 {
    const k = this.knots;
    // segment i spans knots[i+1]..knots[i+2] (between real keys i and i+1)
    let i = 0;
    while (i < pts.length - 4 && t > k[i + 2]) i++;
    const out = [0, 1, 2].map((d) => bg(pts[i][d], pts[i + 1][d], pts[i + 2][d], pts[i + 3][d], k[i], k[i + 1], k[i + 2], k[i + 3], Math.min(Math.max(t, k[i + 1]), k[i + 2])));
    return out as unknown as V3;
  }

  at(f: number): CamPose {
    const t = this.warp.at(f);
    return { pos: this.curve(this.P, t), look: this.curve(this.L, t), fov: this.fov.at(f), focus: this.focus.at(f) };
  }
}
