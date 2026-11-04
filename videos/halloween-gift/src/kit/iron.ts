/**
 * Wrought iron as geometry: bars as tubes along bent polylines (rotation-minimising frames, so a
 * crooked bar never twists), lathe-turned parts (finials, collars, bases, urns) from (radius,
 * height) profiles, and scrollwork (C and S scrolls as spirals) — all accumulated into ONE
 * geometry per builder (position, normal, RGBA colour), so a whole fence is one draw call. The
 * colour comes from a callback per vertex (world position, normal, and the part's own "thin"
 * weight), so the caller can rust the feet, darken near the ground and keep the rim off thin
 * bars (storybookMaterial multiplies its rim by the vertex alpha).
 *
 * Deterministic: no randomness here; callers jitter with their seeded rand. Generic: no film
 * imports.
 */
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';

export type V3 = [number, number, number];
/** (radius, height) points of a lathe profile, bottom to top */
export type Profile = [number, number][];
/** A vertex's colour (r, g, b linear) and alpha (the rim weight) */
export type Shade = (p: Vector3, n: Vector3) => [number, number, number, number];

const _a = new Vector3();
const _b = new Vector3();
const _t = new Vector3();
const _n = new Vector3();
const _p = new Vector3();

export class IronBuilder {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly col: number[] = [];
  private readonly idx: number[] = [];
  constructor(private readonly shade: Shade) {}

  get triangles(): number {
    return this.idx.length / 3;
  }

  private vert(p: Vector3, n: Vector3): number {
    const i = this.pos.length / 3;
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    const c = this.shade(p, n);
    this.col.push(c[0], c[1], c[2], c[3]);
    return i;
  }

  /**
   * A tube along a polyline, `radius` per point (or one for all), `sides` around; flat caps at
   * the ends if asked. `flat` squashes the section across (a flat strap: < 1).
   */
  tube(pts: readonly V3[], radius: number | readonly number[], sides = 6, o: { capStart?: boolean; capEnd?: boolean; flat?: number; twist?: number } = {}): void {
    const n = pts.length;
    if (n < 2) return;
    const rad = (i: number) => (typeof radius === 'number' ? radius : radius[i]);
    // rotation-minimising frames by the double reflection method
    const T: Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const a = _a.fromArray(pts[Math.max(0, i - 1)]);
      const b = _b.fromArray(pts[Math.min(n - 1, i + 1)]);
      T.push(b.clone().sub(a).normalize());
    }
    const N: Vector3[] = [];
    {
      const t0 = T[0];
      const up = Math.abs(t0.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      N.push(new Vector3().crossVectors(up, t0).normalize());
    }
    for (let i = 1; i < n; i++) {
      const x0 = new Vector3().fromArray(pts[i - 1]);
      const x1 = new Vector3().fromArray(pts[i]);
      const v1 = x1.clone().sub(x0);
      const c1 = v1.dot(v1) || 1e-12;
      const rL = N[i - 1].clone().sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(N[i - 1])));
      const tL = T[i - 1].clone().sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(T[i - 1])));
      const v2 = T[i].clone().sub(tL);
      const c2 = v2.dot(v2) || 1e-12;
      N.push(rL.sub(v2.multiplyScalar((2 / c2) * v2.dot(rL))).normalize());
    }
    const flat = o.flat ?? 1;
    const base = this.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const B = new Vector3().crossVectors(T[i], N[i]).normalize();
      const r = rad(i);
      const tw = (o.twist ?? 0) * (i / (n - 1));
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2 + tw;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        _n.copy(N[i]).multiplyScalar(ca).addScaledVector(B, sa * flat).normalize();
        _p.fromArray(pts[i]).addScaledVector(N[i], ca * r).addScaledVector(B, sa * r * flat);
        this.vert(_p, _n);
      }
    }
    for (let i = 0; i < n - 1; i++)
      for (let s = 0; s < sides; s++) {
        const a = base + i * sides + s;
        const b = base + i * sides + ((s + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        this.idx.push(a, b, d, a, d, c);
      }
    const cap = (i: number, dir: number) => {
      _n.copy(T[i]).multiplyScalar(dir);
      const c = this.vert(_p.fromArray(pts[i]), _n);
      const ring: number[] = [];
      for (let s = 0; s < sides; s++) {
        const k = base + i * sides + s;
        _p.set(this.pos[k * 3], this.pos[k * 3 + 1], this.pos[k * 3 + 2]);
        ring.push(this.vert(_p, _n));
      }
      for (let s = 0; s < sides; s++) {
        const a = ring[s];
        const b = ring[(s + 1) % sides];
        if (dir > 0) this.idx.push(c, a, b);
        else this.idx.push(c, b, a);
      }
    };
    if (o.capStart) cap(0, -1);
    if (o.capEnd) cap(n - 1, 1);
  }

  /**
   * A lathe-turned part: the profile (radius, height) swept about an axis from `at` along `dir`
   * (unit), `sides` around. A profile point with radius 0 closes it to a point.
   */
  lathe(profile: Profile, at: V3, dir: V3, sides = 8, scale = 1): void {
    const axis = new Vector3(...dir).normalize();
    const up = Math.abs(axis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const u = new Vector3().crossVectors(up, axis).normalize();
    const w = new Vector3().crossVectors(axis, u).normalize();
    const o = new Vector3(...at);
    const base = this.pos.length / 3;
    const m = profile.length;
    for (let i = 0; i < m; i++) {
      const [r, y] = profile[i];
      // the profile's normal: perpendicular to its tangent in the (radius, height) plane
      const [r0, y0] = profile[Math.max(0, i - 1)];
      const [r1, y1] = profile[Math.min(m - 1, i + 1)];
      let nr = y1 - y0;
      let ny = -(r1 - r0);
      const l = Math.hypot(nr, ny) || 1;
      nr /= l;
      ny /= l;
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        _p.copy(o)
          .addScaledVector(axis, y * scale)
          .addScaledVector(u, ca * r * scale)
          .addScaledVector(w, sa * r * scale);
        _n.copy(u).multiplyScalar(ca * nr).addScaledVector(w, sa * nr).addScaledVector(axis, ny).normalize();
        this.vert(_p, _n);
      }
    }
    for (let i = 0; i < m - 1; i++)
      for (let s = 0; s < sides; s++) {
        const a = base + i * sides + s;
        const b = base + i * sides + ((s + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        this.idx.push(a, b, d, a, d, c);
      }
  }

  /**
   * A surface through closed rings of points (each ring the same count, bottom to top), normals
   * from the surface itself (so a fluted or moulded section shades as cut).
   */
  rings(rings: readonly (readonly V3[])[]): void {
    const nr = rings.length;
    const ns = rings[0].length;
    const base = this.pos.length / 3;
    const along = new Vector3();
    const round = new Vector3();
    for (let i = 0; i < nr; i++)
      for (let s = 0; s < ns; s++) {
        const up = rings[Math.min(nr - 1, i + 1)][s];
        const dn = rings[Math.max(0, i - 1)][s];
        const nx = rings[i][(s + 1) % ns];
        const pv = rings[i][(s - 1 + ns) % ns];
        along.set(up[0] - dn[0], up[1] - dn[1], up[2] - dn[2]);
        round.set(nx[0] - pv[0], nx[1] - pv[1], nx[2] - pv[2]);
        _n.crossVectors(along, round).normalize();
        this.vert(_p.fromArray(rings[i][s]), _n);
      }
    for (let i = 0; i < nr - 1; i++)
      for (let s = 0; s < ns; s++) {
        const a = base + i * ns + s;
        const b = base + i * ns + ((s + 1) % ns);
        const c = a + ns;
        const d = b + ns;
        this.idx.push(a, d, b, a, c, d);
      }
  }

  /** The accumulated geometry (indexed; position, normal, color RGBA). */
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 4));
    g.setIndex(this.pos.length / 3 > 65535 ? new BufferAttribute(new Uint32Array(this.idx), 1) : new BufferAttribute(new Uint16Array(this.idx), 1));
    return g;
  }
}

// ---- profiles (unit height; scale them) ------------------------------------------------------

/** A spear finial: a collar, a neck and a leaf-shaped point (r = bar radius at the base). */
export function spearProfile(r: number, len: number, wide = 2.1): Profile {
  return [
    [r, 0],
    [r * 1.5, len * 0.04],
    [r * 1.5, len * 0.12],
    [r * 0.9, len * 0.16],
    [r * 0.9, len * 0.26],
    [r * wide, len * 0.5],
    [r * wide * 0.8, len * 0.62],
    [r * 0.3, len * 0.92],
    [0, len],
  ];
}

/** A bulb finial: a collar, a round knob and a short spike. */
export function bulbProfile(r: number, len: number, bulb = 2.0): Profile {
  const k = r * bulb;
  return [
    [r, 0],
    [r * 1.4, len * 0.05],
    [r * 1.4, len * 0.12],
    [r * 0.9, len * 0.16],
    [k * 0.7, len * 0.24],
    [k, len * 0.36],
    [k * 0.95, len * 0.46],
    [k * 0.6, len * 0.56],
    [r * 0.55, len * 0.64],
    [r * 0.45, len * 0.74],
    [0, len],
  ];
}

/** A post's urn finial: a cap plate, an urn, a ball and a point. */
export function urnProfile(r: number, len: number): Profile {
  return [
    [r, 0],
    [r * 1.5, len * 0.02],
    [r * 1.5, len * 0.08],
    [r * 0.8, len * 0.11],
    [r * 1.2, len * 0.22],
    [r * 1.45, len * 0.34],
    [r * 1.2, len * 0.45],
    [r * 0.55, len * 0.5],
    [r * 0.55, len * 0.54],
    [r * 1.05, len * 0.62],
    [r * 1.1, len * 0.7],
    [r * 0.8, len * 0.79],
    [r * 0.25, len * 0.86],
    [0, len],
  ];
}

/** A ring of points on a circle (centre c, radius rad, plane spanned by unit u and v), n segments, from angle a0 to a1. */
export function arcPoints(c: V3, u: V3, v: V3, rad: number, a0: number, a1: number, n: number): V3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    const ca = Math.cos(a) * rad;
    const sa = Math.sin(a) * rad;
    return [c[0] + u[0] * ca + v[0] * sa, c[1] + u[1] * ca + v[1] * sa, c[2] + u[2] * ca + v[2] * sa] as V3;
  });
}

/**
 * A C-scroll: a spiral that winds `turns` times inward from radius r0 to r1 about centre c in the
 * plane (u, v), starting at angle a0 (direction +1 counter-clockwise).
 */
export function scrollPoints(c: V3, u: V3, v: V3, r0: number, r1: number, a0: number, turns: number, dir = 1, n = 24): V3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const a = a0 + dir * t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    const ca = Math.cos(a) * r;
    const sa = Math.sin(a) * r;
    return [c[0] + u[0] * ca + v[0] * sa, c[1] + u[1] * ca + v[1] * sa, c[2] + u[2] * ca + v[2] * sa] as V3;
  });
}

/** Transform points by a matrix. */
export function applyPoints(pts: readonly V3[], m: Matrix4): V3[] {
  const v = new Vector3();
  return pts.map((p) => {
    v.fromArray(p).applyMatrix4(m);
    return [v.x, v.y, v.z] as V3;
  });
}

/** Points along a straight bar from a to b with a gentle bow and wobble: `bend(t)` is the sideways offset vector at fraction t. */
export function barPoints(a: V3, b: V3, n: number, bend?: (t: number) => V3): V3[] {
  _t.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const o = bend ? bend(t) : [0, 0, 0];
    return [a[0] + _t.x * t + o[0], a[1] + _t.y * t + o[1], a[2] + _t.z * t + o[2]] as V3;
  });
}
