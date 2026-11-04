/**
 * Roofs as geometry, for storybook buildings: real overlapping tiles laid in uneven, wavy courses
 * on a roof plane (each tile a slab with a rounded, chamfered bottom edge, kicked up off the course
 * below it, jittered in width, height, angle and lift, some slipped or missing), half-round ridge
 * caps, iron cresting (spear-tipped spikes on a rail) and iron finials (a turned pole with balls,
 * scrolls and a spike), plus the planes of a gabled roof over a box.
 *
 * Everything is written into a `Builder`: non-indexed triangles with flat face normals (crisp
 * edges catch the light as thin lines) and an RGBA vertex colour: RGB a cheap ambient occlusion and
 * colour variation, A the storybook rim's mask (thin and edge-on parts take little rim). Merge one
 * builder per material: one draw call per material for a whole building.
 *
 * Deterministic: all randomness from @aiv/core's hashed `rand(seed, id, k)` through per-call
 * counters. Generic: no film imports.
 */
import { rand } from '@aiv/core';
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, LatheGeometry, Matrix3, Matrix4, TubeGeometry, Vector2, Vector3 } from 'three';

export type V3 = readonly [number, number, number];
/** r, g, b (0..1, multiplies the material colour) and a (the rim's mask) */
export type RGBA = readonly [number, number, number, number];

const TAU = Math.PI * 2;
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();

/** Accumulates triangles (flat normals, RGBA colours) for one material. */
export class Builder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly uv: number[] = [];
  /** set once any triangle carried UVs: the geometry gets a uv attribute */
  hasUV = false;

  /** a triangle, counter-clockwise seen from its front; one colour or one per corner; optional UVs */
  tri(a: V3 | Vector3, b: V3 | Vector3, c: V3 | Vector3, rgba: RGBA | readonly [RGBA, RGBA, RGBA], uvs?: readonly [readonly [number, number], readonly [number, number], readonly [number, number]]): void {
    if (uvs) {
      this.hasUV = true;
      this.uv.push(uvs[0][0], uvs[0][1], uvs[1][0], uvs[1][1], uvs[2][0], uvs[2][1]);
    } else this.uv.push(0, 0, 0, 0, 0, 0);
    const A = a instanceof Vector3 ? _a.copy(a) : _a.set(a[0], a[1], a[2]);
    const B = b instanceof Vector3 ? _b.copy(b) : _b.set(b[0], b[1], b[2]);
    const C = c instanceof Vector3 ? _c.copy(c) : _c.set(c[0], c[1], c[2]);
    this.pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z);
    // the face normal
    const ux = B.x - A.x;
    const uy = B.y - A.y;
    const uz = B.z - A.z;
    const vx = C.x - A.x;
    const vy = C.y - A.y;
    const vz = C.z - A.z;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    const many = Array.isArray(rgba[0]);
    for (let i = 0; i < 3; i++) {
      const q = (many ? (rgba as readonly RGBA[])[i] : rgba) as RGBA;
      this.col.push(q[0], q[1], q[2], q[3]);
    }
  }

  /** a quad a-b-c-d, counter-clockwise seen from its front */
  quad(a: V3 | Vector3, b: V3 | Vector3, c: V3 | Vector3, d: V3 | Vector3, rgba: RGBA | readonly [RGBA, RGBA, RGBA, RGBA]): void {
    if (Array.isArray(rgba[0])) {
      const q = rgba as readonly RGBA[];
      this.tri(a, b, c, [q[0], q[1], q[2]]);
      this.tri(a, c, d, [q[0], q[2], q[3]]);
    } else {
      this.tri(a, b, c, rgba as RGBA);
      this.tri(a, c, d, rgba as RGBA);
    }
  }

  /** append a geometry (indexed or not) transformed by m, coloured per vertex by fn (or one colour) */
  add(g: BufferGeometry, m: Matrix4 | null, rgba: RGBA | ((p: Vector3, n: Vector3, i: number) => RGBA)): void {
    const src = g.index ? g.toNonIndexed() : g;
    if (!src.attributes.normal) src.computeVertexNormals();
    const p = src.attributes.position as BufferAttribute;
    const n = src.attributes.normal as BufferAttribute;
    const c = src.attributes.color as BufferAttribute | undefined;
    const t = src.attributes.uv as BufferAttribute | undefined;
    if (t) this.hasUV = true;
    const nm = m ? new Matrix3().getNormalMatrix(m) : null;
    const P = new Vector3();
    const N = new Vector3();
    for (let i = 0; i < p.count; i++) {
      P.fromBufferAttribute(p, i);
      N.fromBufferAttribute(n, i);
      if (m) P.applyMatrix4(m);
      if (nm) N.applyMatrix3(nm).normalize();
      this.pos.push(P.x, P.y, P.z);
      this.nor.push(N.x, N.y, N.z);
      this.uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
      let q: RGBA = typeof rgba === 'function' ? rgba(P, N, i) : rgba;
      if (c) q = [q[0] * c.getX(i), q[1] * c.getY(i), q[2] * c.getZ(i), q[3] * (c.itemSize === 4 ? c.getW(i) : 1)];
      this.col.push(q[0], q[1], q[2], q[3]);
    }
    if (src !== g) src.dispose();
  }

  get triangles(): number {
    return this.pos.length / 9;
  }

  /** remap every vertex position (and recompute the face normals): a crooked warp */
  warp(fn: (p: Vector3) => void, from = 0): void {
    const P = new Vector3();
    for (let i = from * 3; i < this.pos.length; i += 3) {
      P.set(this.pos[i], this.pos[i + 1], this.pos[i + 2]);
      fn(P);
      this.pos[i] = P.x;
      this.pos[i + 1] = P.y;
      this.pos[i + 2] = P.z;
    }
    for (let i = from * 3; i < this.pos.length; i += 9) {
      _a.set(this.pos[i], this.pos[i + 1], this.pos[i + 2]);
      _b.set(this.pos[i + 3], this.pos[i + 4], this.pos[i + 5]).sub(_a);
      _c.set(this.pos[i + 6], this.pos[i + 7], this.pos[i + 8]).sub(_a);
      // keep curved (smooth-shaded) parts smooth: only flat faces get their normal replaced
      const flat = this.nor[i] === this.nor[i + 3] && this.nor[i + 1] === this.nor[i + 4] && this.nor[i] === this.nor[i + 6] && this.nor[i + 2] === this.nor[i + 8];
      if (!flat) continue;
      _b.cross(_c).normalize();
      for (let k = 0; k < 3; k++) {
        this.nor[i + k * 3] = _b.x;
        this.nor[i + k * 3 + 1] = _b.y;
        this.nor[i + k * 3 + 2] = _b.z;
      }
    }
  }

  /** the vertex count so far (a mark for `warp(fn, from)` and colour passes) */
  get count(): number {
    return this.pos.length / 3;
  }

  /** multiply the colours of vertices from `from` by fn(position) */
  shade(fn: (p: Vector3) => number, from = 0): void {
    const P = new Vector3();
    for (let v = from; v < this.count; v++) {
      P.set(this.pos[v * 3], this.pos[v * 3 + 1], this.pos[v * 3 + 2]);
      const k = fn(P);
      this.col[v * 4] *= k;
      this.col[v * 4 + 1] *= k;
      this.col[v * 4 + 2] *= k;
    }
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 4));
    if (this.hasUV) g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// ---- roof planes ---------------------------------------------------------------------------

/** A sloped rectangle: from `origin` (the eave's start), `width` along the eave and `length` up the slope. */
export interface RoofPlane {
  origin: V3;
  /** unit vector along the eave; along × up is the roof's outward normal */
  along: V3;
  /** unit vector up the slope, eave to ridge */
  up: V3;
  width: number;
  length: number;
}

/** A point on a plane: a along the eave, b up the slope, h out of it. */
export function onPlane(pl: RoofPlane, a: number, b: number, h: number, out = new Vector3()): Vector3 {
  const n = planeNormal(pl);
  return out.set(
    pl.origin[0] + pl.along[0] * a + pl.up[0] * b + n.x * h,
    pl.origin[1] + pl.along[1] * a + pl.up[1] * b + n.y * h,
    pl.origin[2] + pl.along[2] * a + pl.up[2] * b + n.z * h,
  );
}

export function planeNormal(pl: RoofPlane): Vector3 {
  return new Vector3(pl.along[0], pl.along[1], pl.along[2]).cross(new Vector3(pl.up[0], pl.up[1], pl.up[2])).normalize();
}

/** A gabled box: footprint x0..x1 × z0..z1, eave height, ridge height, the ridge along x or z. */
export interface Gable {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  eave: number;
  peak: number;
  ridge: 'x' | 'z';
  /** how far the roof runs past the walls at the eaves and at the gable ends */
  overhang?: number;
  verge?: number;
}

/** The two slopes of a gabled box (outward normals), its ridge line, and its pitch (radians). */
export function gablePlanes(g: Gable): { planes: [RoofPlane, RoofPlane]; ridge: [V3, V3]; pitch: number } {
  const oh = g.overhang ?? 0.12;
  const vg = g.verge ?? 0.1;
  const rise = g.peak - g.eave;
  if (g.ridge === 'z') {
    const xc = (g.x0 + g.x1) / 2;
    const half = (g.x1 - g.x0) / 2;
    const pitch = Math.atan2(rise, half);
    const run = half + oh;
    const len = run / Math.cos(pitch);
    const yE = g.peak - run * Math.tan(pitch);
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    const zF = g.z1 + vg;
    const zB = g.z0 - vg;
    // right slope: along −z from the front; left slope: along +z from the back
    const right: RoofPlane = { origin: [xc + run, yE, zF], along: [0, 0, -1], up: [-c, s, 0], width: zF - zB, length: len };
    const left: RoofPlane = { origin: [xc - run, yE, zB], along: [0, 0, 1], up: [c, s, 0], width: zF - zB, length: len };
    return { planes: [left, right], ridge: [[xc, g.peak, zB], [xc, g.peak, zF]], pitch };
  }
  const zc = (g.z0 + g.z1) / 2;
  const half = (g.z1 - g.z0) / 2;
  const pitch = Math.atan2(rise, half);
  const run = half + oh;
  const len = run / Math.cos(pitch);
  const yE = g.peak - run * Math.tan(pitch);
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const xL = g.x0 - vg;
  const xR = g.x1 + vg;
  const front: RoofPlane = { origin: [xL, yE, zc + run], along: [1, 0, 0], up: [0, s, -c], width: xR - xL, length: len };
  const back: RoofPlane = { origin: [xR, yE, zc - run], along: [-1, 0, 0], up: [0, s, c], width: xR - xL, length: len };
  return { planes: [front, back], ridge: [[xL, g.peak, zc], [xR, g.peak, zc]], pitch };
}

/** Is p under the roof of gabled box g (inside its footprint grown by `grow`, below its slopes)? */
export function underGable(g: Gable, p: Vector3, grow = 0): boolean {
  const oh = g.overhang ?? 0.12;
  const vg = g.verge ?? 0.1;
  const rise = g.peak - g.eave;
  if (g.ridge === 'z') {
    const xc = (g.x0 + g.x1) / 2;
    const half = (g.x1 - g.x0) / 2;
    if (p.z < g.z0 - vg - grow || p.z > g.z1 + vg + grow) return false;
    const d = Math.abs(p.x - xc);
    if (d > half + oh + grow) return false;
    return p.y < g.peak - (d / half) * rise + grow;
  }
  const zc = (g.z0 + g.z1) / 2;
  const half = (g.z1 - g.z0) / 2;
  if (p.x < g.x0 - vg - grow || p.x > g.x1 + vg + grow) return false;
  const d = Math.abs(p.z - zc);
  if (d > half + oh + grow) return false;
  return p.y < g.peak - (d / half) * rise + grow;
}

// ---- tiles ---------------------------------------------------------------------------------

export interface ShingleSpec {
  seed: number;
  /** tile width along the eave, and its variation (fraction) */
  tileW: number;
  tileWJitter?: number;
  /** the exposed height of a course (along the slope), and its variation (fraction) */
  exposure: number;
  exposureJitter?: number;
  /** a tile's full length (the next course hides the rest); default 1.9 × exposure */
  tileL?: number;
  thickness?: number;
  /** how far a tile's bottom stands off the course below (the kick), and its variation */
  kick?: number;
  /** course waviness: amplitude (fraction of the exposure) and wavelength along the eave */
  wave?: number;
  waveLen?: number;
  /** per-tile drop of the bottom edge (fraction of the exposure): uneven courses */
  ragged?: number;
  /** rotation jitter about the roof's normal (radians) */
  twist?: number;
  /** bottom edge: rounding (fraction of the width) and corner chamfer (fraction of the width) */
  round?: number;
  chamfer?: number;
  /** the gap between neighbouring tiles */
  gap?: number;
  /** chance of a missing tile, of a slipped one */
  missing?: number;
  slipped?: number;
  /** per-tile value variation (±), and tints picked per tile (RGB multipliers) */
  value?: number;
  tints?: readonly (readonly [number, number, number])[];
  /** how dark a tile gets where the next course covers it (0..1), and its lit lower edge (+) */
  ao?: number;
  edgeLight?: number;
  /** the rim mask of the tops and of the edges */
  alphaTop?: number;
  alphaEdge?: number;
  /** drop a tile when this is true at the centre of its exposed part (plane space → caller space) */
  clip?: (p: Vector3) => boolean;
  /** the first course starts this far below the plane's origin (a ragged eave) */
  start?: number;
}

/** Lay tiles on a roof plane into a builder. Returns the number of tiles laid. */
export function shingles(pl: RoofPlane, s: ShingleSpec, out: Builder): number {
  const {
    seed,
    tileW,
    tileWJitter = 0.25,
    exposure,
    exposureJitter = 0.12,
    thickness = 0.018,
    kick = 0.012,
    wave = 0.18,
    waveLen = 0.9,
    ragged = 0.12,
    twist = 0.05,
    round = 0.12,
    chamfer = 0.14,
    gap = 0.008,
    missing = 0.015,
    slipped = 0.025,
    value = 0.16,
    tints = [[1, 1, 1]],
    ao = 0.55,
    edgeLight = 0.18,
    alphaTop = 1,
    alphaEdge = 0.35,
    clip,
    start = 0.02,
  } = s;
  const tileL = s.tileL ?? exposure * 1.9;
  let k = 0;
  const r = () => rand(seed, 'tile', k++);
  const P = (a: number, b: number, h: number) => onPlane(pl, a, b, h);
  const test = new Vector3();
  let laid = 0;
  let b = -start;
  let course = 0;
  while (b < pl.length - exposure * 0.25) {
    const e = exposure * (1 + (r() - 0.5) * 2 * exposureJitter);
    const phase = r() * TAU;
    let a = -(course % 2 ? 0.5 : 0) * tileW - r() * tileW * 0.35;
    while (a < pl.width) {
      const w = tileW * (1 + (r() - 0.5) * 2 * tileWJitter);
      const a0 = Math.max(a, 0);
      const a1 = Math.min(a + w, pl.width);
      a += w;
      const rr = [r(), r(), r(), r(), r(), r(), r(), r()];
      if (a1 - a0 < tileW * 0.3) continue;
      if (rr[0] < missing) continue;
      const ac = (a0 + a1) / 2;
      let b0 = b + wave * e * Math.sin((TAU * ac) / waveLen + phase) - rr[1] * ragged * e;
      if (rr[2] < slipped) b0 -= e * 0.4;
      const L = Math.min(tileL, pl.length + 0.01 - b0);
      if (L < e * 0.35) continue;
      const ex = Math.min(e, L * 0.9);
      if (clip && clip(test.copy(P(ac, b0 + ex * 0.5, 0)))) continue;
      laid++;
      const x0 = a0 + gap / 2;
      const x1 = a1 - gap / 2;
      const tw = x1 - x0;
      const ch = chamfer * tw * (0.5 + rr[3]);
      const rd = round * tw * (0.4 + rr[4] * 0.9);
      const hb = thickness + kick * (0.5 + rr[5]);
      const ht = thickness * 0.25;
      const ang = (rr[6] - 0.5) * 2 * twist;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const cb = b0 + L / 2;
      // a tile point (local a, b) → rotated about the tile's centre → plane space with its height
      const T = (ta: number, tb: number, dh = 0) => {
        const da = ta - ac;
        const db = tb - cb;
        const qa = ac + da * ca - db * sa;
        const qb = cb + da * sa + db * ca;
        const hh = hb + ((ht - hb) * (tb - b0)) / L;
        return P(qa, qb, hh + dh);
      };
      const v = 1 + (rr[7] - 0.5) * 2 * value;
      const tint = tints[Math.floor(rand(seed, 'tint', laid) * tints.length) % tints.length];
      const C = (m: number, alpha: number): RGBA => [tint[0] * v * m, tint[1] * v * m, tint[2] * v * m, alpha];
      const lit = C(1 + edgeLight, alphaTop);
      const mid = C(1 - ao, alphaTop);
      const top = C((1 - ao) * 0.75, alphaTop * 0.6);
      const edge = C(0.72, alphaEdge);
      const edgeDark = C(0.5, alphaEdge);
      // the outline (counter-clockwise from +n): rounded, chamfered bottom; sides; hidden top
      const xm = ac + (rr[3] - 0.5) * tw * 0.2;
      const BL = [x0, b0 + ch] as const;
      const BL2 = [x0 + ch, b0] as const;
      const BM = [xm, b0 - rd] as const;
      const BR2 = [x1 - ch, b0] as const;
      const BR = [x1, b0 + ch] as const;
      const MR = [x1, b0 + ex] as const;
      const ML = [x0, b0 + ex] as const;
      const TR = [x1, b0 + L] as const;
      const TL = [x0, b0 + L] as const;
      const p = (q: readonly [number, number], dh = 0) => T(q[0], q[1], dh);
      const pBM = p(BM);
      // the exposed face: a fan from the bottom middle
      out.tri(pBM, p(BR2), p(BR), [lit, lit, lit]);
      out.tri(pBM, p(BR), p(MR), [lit, lit, mid]);
      out.tri(pBM, p(MR), p(ML), [lit, mid, mid]);
      out.tri(pBM, p(ML), p(BL), [lit, mid, lit]);
      out.tri(pBM, p(BL), p(BL2), [lit, lit, lit]);
      // the hidden upper part (seen only through gaps and missing tiles)
      out.quad(p(ML), p(MR), p(TR), p(TL), [mid, mid, top, top]);
      // the edges: thickness strips along the bottom and both sides
      const outline = [TL, ML, BL, BL2, BM, BR2, BR, MR, TR];
      for (let i = 0; i < outline.length - 1; i++) {
        const A = outline[i];
        const B = outline[i + 1];
        const sideEdge = i < 2 || i > 5;
        const cc = sideEdge ? edgeDark : edge;
        out.quad(p(A), p(A, -thickness), p(B, -thickness), p(B), cc);
      }
    }
    b += e;
    course++;
  }
  return laid;
}

// ---- ridge caps, cresting, finials ----------------------------------------------------------

export interface RidgeSpec {
  seed: number;
  /** the half-round's radius, and each piece's length */
  radius?: number;
  piece?: number;
  /** the colour (and rim mask) of the caps */
  rgba?: RGBA;
  value?: number;
}

/** Half-round ridge tiles from a to b (each piece a little wider at its start, overlapping the last). */
export function ridgeCap(a: V3, b: V3, s: RidgeSpec, out: Builder): void {
  const { seed, radius = 0.05, piece = 0.16, rgba = [0.85, 0.85, 0.85, 0.8], value = 0.12 } = s;
  const A = new Vector3(...a);
  const B = new Vector3(...b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  dir.normalize();
  const up = new Vector3(0, 1, 0);
  const side = new Vector3().crossVectors(dir, up).normalize();
  up.crossVectors(side, dir).normalize();
  const n = Math.max(1, Math.round(len / piece));
  const seg = 7;
  let k = 0;
  const r = () => rand(seed, 'ridge', k++);
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * len - 0.01;
    const t1 = ((i + 1) / n) * len + 0.012;
    const r0 = radius * (1.06 + (r() - 0.5) * 0.12);
    const r1 = r0 * 0.9;
    const tilt = (r() - 0.5) * 0.08;
    const v = 1 + (r() - 0.5) * 2 * value;
    const c: RGBA = [rgba[0] * v, rgba[1] * v, rgba[2] * v, rgba[3]];
    const cd: RGBA = [rgba[0] * v * 0.6, rgba[1] * v * 0.6, rgba[2] * v * 0.6, rgba[3] * 0.5];
    const ring = (t: number, rad: number) => {
      const pts: Vector3[] = [];
      for (let j = 0; j <= seg; j++) {
        const ph = -Math.PI / 2 - 0.25 + ((Math.PI + 0.5) * j) / seg + tilt;
        pts.push(
          A.clone()
            .addScaledVector(dir, t)
            .addScaledVector(side, Math.sin(ph) * rad)
            .addScaledVector(up, Math.cos(ph) * rad - radius * 0.35),
        );
      }
      return pts;
    };
    const s0 = ring(t0, r0);
    const s1 = ring(t1, r1);
    const s0in = ring(t0, r0 * 0.78);
    for (let j = 0; j < seg; j++) {
      out.quad(s0[j], s0[j + 1], s1[j + 1], s1[j], c);
      // the lip at the piece's start
      out.quad(s0in[j], s0in[j + 1], s0[j + 1], s0[j], cd);
    }
  }
}

export interface CrestSpec {
  seed: number;
  /** spacing between spikes, and its jitter (fraction) */
  spacing?: number;
  jitter?: number;
  /** spike height (the tall ones are taller), its variation, and the bar's width */
  height?: number;
  heightJitter?: number;
  width?: number;
  /** spikes start this far above the line (on top of the ridge cap) */
  lift?: number;
  /** lean jitter (radians) */
  lean?: number;
  rgba?: RGBA;
  /** leave a spike out where this is true (t: distance along the ridge from a) */
  skip?: (t: number) => boolean;
}

/** Iron cresting along a ridge, a to b: spear-tipped spikes standing on a rail. */
export function cresting(a: V3, b: V3, s: CrestSpec, out: Builder): void {
  const { seed, spacing = 0.1, jitter = 0.3, height = 0.1, heightJitter = 0.25, width = 0.02, lift = 0.03, lean = 0.1, rgba = [1, 1, 1, 0.35], skip } = s;
  const A = new Vector3(...a);
  const B = new Vector3(...b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  dir.normalize();
  const side = new Vector3().crossVectors(dir, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(side, dir).normalize();
  let k = 0;
  const r = () => rand(seed, 'crest', k++);
  const n = Math.max(2, Math.round(len / spacing));
  const base = (t: number) => A.clone().addScaledVector(dir, t).addScaledVector(up, lift);
  // the rail
  const rw = width * 0.45;
  const rail = (t: number, dz: number) => base(t).addScaledVector(up, dz);
  const r0 = rail(0.02, 0);
  const r1 = rail(len - 0.02, 0);
  const sq = (p: Vector3, w: number) => [p.clone().addScaledVector(side, -w).addScaledVector(up, -w), p.clone().addScaledVector(side, w).addScaledVector(up, -w), p.clone().addScaledVector(side, w).addScaledVector(up, w), p.clone().addScaledVector(side, -w).addScaledVector(up, w)];
  const q0 = sq(r0, rw);
  const q1 = sq(r1, rw);
  for (let j = 0; j < 4; j++) out.quad(q0[j], q1[j], q1[(j + 1) % 4], q0[(j + 1) % 4], rgba);
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5 + (r() - 0.5) * jitter) / n) * len;
    if (skip && skip(t)) {
      r();
      r();
      r();
      r();
      continue;
    }
    const tall = i % 2 === 0 ? 1.35 : 1;
    const h = height * tall * (1 + (r() - 0.5) * 2 * heightJitter);
    const axis = up
      .clone()
      .addScaledVector(dir, (r() - 0.5) * 2 * lean)
      .addScaledVector(side, (r() - 0.5) * lean)
      .normalize();
    const p0 = base(t).addScaledVector(up, -rw);
    const w0 = width * 0.5 * (0.85 + r() * 0.3);
    const neck = p0.clone().addScaledVector(axis, h * 0.66);
    const head = p0.clone().addScaledVector(axis, h * 0.76);
    const tip = p0.clone().addScaledVector(axis, h);
    // the shaft: a tapered square prism
    const sb = [p0.clone().addScaledVector(dir, -w0).addScaledVector(side, -w0), p0.clone().addScaledVector(dir, w0).addScaledVector(side, -w0), p0.clone().addScaledVector(dir, w0).addScaledVector(side, w0), p0.clone().addScaledVector(dir, -w0).addScaledVector(side, w0)];
    const wn = w0 * 0.55;
    const sn = [neck.clone().addScaledVector(dir, -wn).addScaledVector(side, -wn), neck.clone().addScaledVector(dir, wn).addScaledVector(side, -wn), neck.clone().addScaledVector(dir, wn).addScaledVector(side, wn), neck.clone().addScaledVector(dir, -wn).addScaledVector(side, wn)];
    for (let j = 0; j < 4; j++) out.quad(sb[j], sn[j], sn[(j + 1) % 4], sb[(j + 1) % 4], rgba);
    // the spear head: a diamond, wide along the ridge, thin across it
    const wa = w0 * 1.9;
    const wb = w0 * 0.75;
    const ring = [head.clone().addScaledVector(dir, -wa), head.clone().addScaledVector(side, -wb), head.clone().addScaledVector(dir, wa), head.clone().addScaledVector(side, wb)];
    for (let j = 0; j < 4; j++) {
      out.tri(ring[(j + 1) % 4], ring[j], tip, rgba);
      out.tri(ring[j], ring[(j + 1) % 4], neck, rgba);
    }
  }
}

export interface FinialSpec {
  seed: number;
  height?: number;
  /** the pole's base radius */
  radius?: number;
  /** scrolls either side (0, 2 or 4) */
  scrolls?: number;
  rgba?: RGBA;
}

/** An iron finial standing at the origin, pointing up +y: turned pole, balls, scrolls, a spike. */
export function finial(s: FinialSpec, out: Builder, m: Matrix4): void {
  const { seed, height: H = 0.32, radius: R = 0.022, scrolls = 2, rgba = [1, 1, 1, 0.45] } = s;
  let k = 0;
  const r = () => rand(seed, 'finial', k++);
  // the turned profile: collar, spindle, ball, spindle, small ball, spike
  const prof: [number, number][] = [
    [R * 1.6, 0],
    [R * 1.5, 0.05],
    [R * 0.7, 0.09],
    [R * 0.55, 0.2],
    [R * 1.5, 0.26],
    [R * 1.65, 0.31],
    [R * 1.5, 0.36],
    [R * 0.5, 0.41],
    [R * 0.45, 0.55],
    [R * 1.0, 0.6],
    [R * 1.05, 0.63],
    [R * 0.9, 0.66],
    [R * 0.4, 0.7],
    [R * 0.28, 0.85],
    [0, 1],
  ];
  const pts = prof.map(([x, y]) => new Vector2(x, y * H));
  const lathe = new LatheGeometry(pts, 8);
  out.add(lathe, m, rgba);
  lathe.dispose();
  // the scrolls: S-curls leaving the pole at about half height
  const turn = r() * TAU;
  for (let i = 0; i < scrolls; i++) {
    const az = turn + (i * TAU) / scrolls;
    const dx = Math.cos(az);
    const dz = Math.sin(az);
    const y0 = H * (0.42 + r() * 0.06);
    const sz = H * (0.22 + r() * 0.06);
    const curve: Vector3[] = [];
    for (let j = 0; j <= 12; j++) {
      const t = j / 12;
      // out and up, then curling over and down into a spiral
      const ang = t * Math.PI * 1.7;
      const rad = sz * (0.25 + 0.75 * (1 - t * 0.6));
      const ox = Math.sin(ang) * rad * 0.9 + t * sz * 0.35;
      const oy = (1 - Math.cos(ang)) * rad * 0.55 - t * t * sz * 0.2;
      curve.push(new Vector3(dx * ox, y0 + oy, dz * ox));
    }
    const tube = new TubeGeometry(new CatmullRomCurve3(curve), 18, R * 0.42, 5, false);
    out.add(tube, m, rgba);
    tube.dispose();
  }
}

/** Triangle count of a geometry (indexed or not). */
export function triangles(g: BufferGeometry): number {
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}
