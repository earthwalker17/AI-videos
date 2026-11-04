/**
 * A hardcover book's parts as BufferGeometry, for a book lying on its back board with the spine
 * along the back edge (−z) and the fore-edge toward +z (the cover hinges along the spine like a
 * lid). Every part is built in book coordinates (x across, y up from the desk, z toward the
 * fore-edge) and carries what the storybook material needs:
 *  - boards: a rounded-rectangle slab with a crisp bevel (worn corners rounder than the spine's),
 *    UVs in plan (u across, v from the fore-edge back, so a canvas drawn top = spine reads
 *    upright from the front), RGBA vertex colour lighter on the bevel (rubbed cloth) and the
 *    rim mask in alpha;
 *  - the rounded spine with raised bands, its head and tail caps;
 *  - the page block's three open edges as one consistent set of grids (fore-edge concave as a
 *    rounded-and-backed book's is, the signatures standing a little in and out, a few leaves
 *    proud), UVs running round the perimeter so the leaf lines continue round the corners;
 *  - brass corner protectors, a ribbon strip with a forked tail, a striped headband.
 * Grids check their own winding (normals face out), so nothing renders inside out.
 * Deterministic: randomness only from @aiv/core's rand. Generic: no film imports.
 */
import { rand } from '@aiv/core';
import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Shape, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm2 } from './field.ts';

export type V3 = [number, number, number];

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---- grids --------------------------------------------------------------------------------------

/**
 * An indexed grid from a point function over (i, j) ∈ [0, nu] × [0, nv], with per-vertex uv and
 * RGBA colour; the winding is flipped if the normal at the middle does not point along `out`.
 */
export function gridGeometry(nu: number, nv: number, point: (i: number, j: number) => V3, uv: (i: number, j: number) => [number, number], color: (i: number, j: number, p: V3) => [number, number, number, number], out: (p: V3) => V3): BufferGeometry {
  const P = new Float32Array((nu + 1) * (nv + 1) * 3);
  const U = new Float32Array((nu + 1) * (nv + 1) * 2);
  const C = new Float32Array((nu + 1) * (nv + 1) * 4);
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const k = j * (nu + 1) + i;
      const p = point(i, j);
      P.set(p, k * 3);
      U.set(uv(i, j), k * 2);
      C.set(color(i, j, p), k * 4);
    }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 1;
      const d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(P, 3));
  g.setAttribute('uv', new BufferAttribute(U, 2));
  g.setAttribute('color', new BufferAttribute(C, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  // winding check at the middle vertex
  const mid = Math.floor(nv / 2) * (nu + 1) + Math.floor(nu / 2);
  const n = g.getAttribute('normal');
  const p: V3 = [P[mid * 3], P[mid * 3 + 1], P[mid * 3 + 2]];
  const o = out(p);
  if (n.getX(mid) * o[0] + n.getY(mid) * o[1] + n.getZ(mid) * o[2] < 0) {
    for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

// ---- boards ------------------------------------------------------------------------------------

export interface BoardSpec {
  /** plan extent */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** thickness (the slab spans y 0..t) */
  t: number;
  /** corner radii in plan: at the back (spine) and at the front (fore-edge, worn round) */
  rBack: number;
  rFront: number;
  /** bevel size (the edge's rounding) */
  bevel: number;
  /** vertex colour of the bevel and sides (rubbed lighter cloth, > 1 lightens) and of the faces */
  edge?: number;
  /** the rim mask (vertex alpha) */
  rim?: number;
}

/** A rounded rectangle in the plan (x, z) as a Shape in (x, −z), counter-clockwise. */
function planShape(x0: number, z0: number, x1: number, z1: number, rBL: number, rBR: number, rFR: number, rFL: number): Shape {
  const s = new Shape();
  const yb = -z1;
  const yt = -z0;
  const r = (v: number) => Math.max(1e-3, v);
  const [bl, br, fr, fl] = [r(rBL), r(rBR), r(rFR), r(rFL)];
  s.moveTo(x0 + fl, yb);
  s.lineTo(x1 - fr, yb);
  s.absarc(x1 - fr, yb + fr, fr, -Math.PI / 2, 0, false);
  s.lineTo(x1, yt - br);
  s.absarc(x1 - br, yt - br, br, 0, Math.PI / 2, false);
  s.lineTo(x0 + bl, yt);
  s.absarc(x0 + bl, yt - bl, bl, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, yb + fl);
  s.absarc(x0 + fl, yb + fl, fl, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Extrude a plan shape over y 0..t with a rounded bevel; smooth normals, flat faces exactly flat. */
function slab(shape: Shape, t: number, bevel: number, segs = 3, curve = 10): BufferGeometry {
  const bt = Math.min(bevel, t * 0.45);
  const e = new ExtrudeGeometry(shape, { depth: Math.max(1e-4, t - 2 * bt), bevelEnabled: true, bevelThickness: bt, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: segs, curveSegments: curve });
  e.translate(0, 0, bt);
  e.rotateX(-Math.PI / 2);
  e.deleteAttribute('uv');
  e.deleteAttribute('normal');
  const g = mergeVertices(e, 1e-5);
  e.dispose();
  g.computeVertexNormals();
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (Math.abs(y - t) < 1e-5) n.setXYZ(i, 0, 1, 0);
    else if (Math.abs(y) < 1e-5) n.setXYZ(i, 0, -1, 0);
  }
  return g;
}

/** A board: UVs in plan (v = 1 at the back edge), RGBA colour lighter on the bevel. */
export function boardGeometry(s: BoardSpec): BufferGeometry {
  const { x0, x1, z0, z1, t, rBack, rFront, bevel, edge = 1.25, rim = 0.8 } = s;
  const g = slab(planShape(x0, z0, x1, z1, rBack, rBack, rFront, rFront), t, bevel);
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  const col = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    uv[i * 2] = (x - x0) / (x1 - x0);
    uv[i * 2 + 1] = (z1 - z) / (z1 - z0);
    const side = 1 - Math.abs(n.getY(i));
    const k = 1 + (edge - 1) * smooth(0.05, 0.6, side);
    col.set([k, k, k, rim], i * 4);
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setAttribute('color', new BufferAttribute(col, 4));
  return g;
}

// ---- the spine ---------------------------------------------------------------------------------

export interface SpineSpec {
  x0: number;
  x1: number;
  /** the boards' back edge (z) and the spine's height (desk to the closed cover's top) */
  z: number;
  h: number;
  /** how far the round stands out behind the boards */
  bulge: number;
  /** raised bands: centres (x), height, half width */
  bands: number[];
  bandH: number;
  bandW: number;
  seed: number;
}

/** The rounded spine with raised bands (outer surface) and its head and tail caps. */
export function spineGeometry(s: SpineSpec): BufferGeometry {
  const { x0, x1, z, h, bulge, bands, bandH, bandW, seed } = s;
  const nu = 220;
  const nv = 28;
  const prof = (v: number) => Math.pow(Math.sin(Math.PI * v), 0.55);
  const bandAt = (x: number) => {
    let b = 0;
    for (const c of bands) {
      const d = Math.abs(x - c) / bandW;
      if (d < 1) b = Math.max(b, Math.cos(d * Math.PI * 0.5) ** 2);
    }
    return b;
  };
  const point = (i: number, j: number): V3 => {
    const x = x0 + ((x1 - x0) * i) / nu;
    const v = j / nv;
    const ring = bandAt(x) * bandH * Math.pow(Math.sin(Math.PI * v), 0.35);
    const wob = 0.006 * fbm2(x * 1.3, v * 3, seed);
    return [x, h * v, z - (bulge + wob) * prof(v) - ring];
  };
  const body = gridGeometry(
    nu,
    nv,
    point,
    (i, j) => [i / nu, j / nv],
    (i, j) => {
      const x = x0 + ((x1 - x0) * i) / nu;
      const v = j / nv;
      // rubbed lighter on the band crests and along the round's crown; darker either side of a band and in the joints
      const b = bandAt(x);
      const crown = Math.exp(-(((v - 0.5) / 0.22) ** 2));
      const joint = 1 - 0.35 * (1 - smooth(0.0, 0.12, v)) - 0.35 * smooth(0.88, 1.0, v);
      const flank = b > 0.05 && b < 0.6 ? 0.85 : 1;
      const k = (1 + 0.28 * b * b + 0.12 * crown + 0.06 * fbm2(x * 2.2, v * 4, seed + 3)) * joint * flank;
      return [k, k, k, 0.7];
    },
    () => [0, 0, -1],
  );
  // the caps: a fan from the chord (the boards' back edge) to the profile, at either end
  const caps: BufferGeometry[] = [];
  for (const end of [0, 1]) {
    const x = end ? x1 : x0;
    const P: number[] = [];
    const C: number[] = [];
    const UV: number[] = [];
    const centre: V3 = [x, h / 2, z];
    for (let j = 0; j < nv; j++) {
      const a = point(end * nu, j);
      const b = point(end * nu, j + 1);
      P.push(...centre, ...a, ...b);
      for (let k = 0; k < 3; k++) {
        // the spine's end: in its own shadow, darker than the cloth
        C.push(0.32, 0.32, 0.32, 0.2);
        UV.push(0.5, 0.5);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(UV), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(C), 4));
    g.computeVertexNormals();
    // facing outward along x
    const nx = g.getAttribute('normal').getX(0);
    if ((end ? 1 : -1) * nx < 0) {
      const arr = g.getAttribute('position').array as Float32Array;
      for (let t = 0; t < arr.length; t += 9) for (let c = 0; c < 3; c++) [arr[t + 3 + c], arr[t + 6 + c]] = [arr[t + 6 + c], arr[t + 3 + c]];
      g.computeVertexNormals();
    }
    caps.push(g);
  }
  const g = mergeGeometries([body.toNonIndexed(), ...caps])!;
  body.dispose();
  caps.forEach((c) => c.dispose());
  return g;
}

// ---- the page block ----------------------------------------------------------------------------

export interface PageBlockSpec {
  x0: number;
  x1: number;
  /** z0: the spine side (hidden in the spine), z1: the fore-edge */
  z0: number;
  z1: number;
  y0: number;
  y1: number;
  /** the fore-edge's concavity (the middle leaves recessed) */
  concave: number;
  /** signatures (gathered sections) through the thickness */
  signatures: number;
  /** leaves standing proud: fraction of the height, extent along the edge (u range on the
   * perimeter 0..1), how far out */
  proud: { v: number; u0: number; u1: number; out: number }[];
  seed: number;
}

export interface PageBlock {
  /** the three open edges, one grid set with perimeter UVs (u 0 at the head's spine end .. 1 at the tail's) */
  edges: BufferGeometry;
  /** where the perimeter's faces meet: u of the head–fore-edge and fore-edge–tail corners */
  corners: [number, number];
  /** the edge's outward displacement at (perimeter u, height fraction v): for decals that sit on it */
  surface: (u: number, v: number) => V3;
}

/** The page block's open edges (the top page and the bottom are separate planes). */
export function pageBlockGeometry(s: PageBlockSpec): PageBlock {
  const { x0, x1, z0, z1, y0, y1, concave, signatures, proud, seed } = s;
  const D = z1 - z0;
  const W = x1 - x0;
  const L = 2 * D + W;
  const cA = D / L;
  const cB = (D + W) / L;
  // a pure function of the height alone, asked for at every vertex of a row: worked out once per height
  const perHeight = (fn: (v: number) => number) => {
    const memo = new Map<number, number>();
    return (v: number) => {
      let r = memo.get(v);
      if (r === undefined) {
        r = fn(v);
        memo.set(v, r);
      }
      return r;
    };
  };
  // each signature stands a little in or out of its neighbours; the leaves wave slightly
  const sigOffAt = (v: number, k: number) => {
    const t = v * signatures;
    const i = Math.min(signatures - 1, Math.floor(t));
    const f = t - i;
    const a = rand(seed, 'sig' + k, i) * 2 - 1;
    const b = rand(seed, 'sig' + k, Math.min(signatures - 1, i + 1)) * 2 - 1;
    // flat across a signature, a quick change at its boundary, a groove at the boundary
    const m = smooth(0.82, 1.0, f);
    const groove = Math.exp(-(((f > 0.5 ? 1 - f : f) / 0.07) ** 2));
    return a + (b - a) * m - 0.5 * groove;
  };
  const sigs = [0, 1, 2].map((k) => perHeight((v) => sigOffAt(v, k)));
  const sigOff = (v: number, k: number) => sigs[k](v);
  const proudAt = (u: number, v: number) => {
    let o = 0;
    for (const p of proud) {
      const dv = Math.abs(v - p.v);
      if (dv > 0.03) continue;
      const along = smooth(p.u0, p.u0 + 0.01, u) * (1 - smooth(p.u1 - 0.01, p.u1, u));
      o = Math.max(o, p.out * along * (1 - smooth(0.007, 0.018, dv)));
    }
    return o;
  };
  const conc = (v: number) => 1 - (2 * v - 1) ** 2;
  // outward displacement of each face (fore-edge: +z, head: −x, tail: +x), by nominal coordinates
  // the signatures step only a little (a strong step read as a few broad bands from afar)
  const foreD = (x: number, v: number, u: number) => -concave * conc(v) + 0.003 * sigOff(v, 0) + 0.004 * fbm2(x * 0.7, v * 5, seed + 1) + proudAt(u, v);
  const sideD = (z: number, v: number, k: number, u: number) => {
    // held tight by the binding near the spine
    const held = smooth(z0, z0 + 1.2, z);
    return (0.003 * sigOff(v, k) + 0.003 * fbm2(z * 0.7, v * 5, seed + 2 + k) - 0.18 * concave * conc(v)) * held + proudAt(u, v);
  };
  // the corners' displacements, where the faces meet (each face's ends follow them)
  const foreA = perHeight((v) => foreD(x0, v, cA));
  const foreB = perHeight((v) => foreD(x1, v, cB));
  const sideA = perHeight((v) => sideD(z1, v, 1, cA));
  const sideB = perHeight((v) => sideD(z1, v, 2, cB));
  const H = y1 - y0;
  const nv = 80;
  const surface = (u: number, v: number): V3 => {
    const y = y0 + H * v;
    if (u <= cA) {
      // head (left, x0): z from the spine to the corner
      const z = z0 + (u / cA) * D;
      const zEnd = z1 + foreA(v);
      return [x0 - sideD(z, v, 1, u), y, z0 + (zEnd - z0) * (u / cA)];
    }
    if (u <= cB) {
      const x = x0 + ((u - cA) / (cB - cA)) * W;
      const xa = x0 - sideA(v);
      const xb = x1 + sideB(v);
      const xx = xa + ((xb - xa) * (x - x0)) / W;
      return [xx, y, z1 + foreD(x, v, u)];
    }
    const z = z1 - ((u - cB) / (1 - cB)) * D;
    const zEnd = z1 + foreB(v);
    const zz = z0 + ((zEnd - z0) * (z - z0)) / D;
    return [x1 + sideD(z, v, 2, u), y, zz];
  };
  const faces: BufferGeometry[] = [];
  const spans: [number, number, number, V3][] = [
    [0, cA, 90, [-1, 0, 0]],
    [cA, cB, 240, [0, 0, 1]],
    [cB, 1, 90, [1, 0, 0]],
  ];
  for (const [ua, ub, nu, out] of spans) {
    faces.push(
      gridGeometry(
        nu,
        nv,
        (i, j) => surface(ua + ((ub - ua) * i) / nu, j / nv),
        (i, j) => [ua + ((ub - ua) * i) / nu, j / nv],
        (i, j) => {
          const u = ua + ((ub - ua) * i) / nu;
          const v = j / nv;
          // shadowed under the boards' squares, and deep in the joint at the spine ends
          const under = 0.62 + 0.38 * smooth(0.0, 0.07, v) * (1 - 0.45 * smooth(0.9, 1.0, v));
          const joint = 0.55 + 0.45 * smooth(0, 0.05, u) * smooth(1, 0.95, u);
          const k = under * joint;
          return [k, k, k, 0.3];
        },
        () => out,
      ),
    );
  }
  const edges = mergeGeometries(faces)!;
  faces.forEach((f) => f.dispose());
  return { edges, corners: [cA, cB], surface };
}

// ---- brass corner protectors -------------------------------------------------------------------

export interface CornerSpec {
  /** the board corner in plan (x, z) and which way is outward (sx = ±1 along x, sz = ±1 along z) */
  x: number;
  z: number;
  sx: number;
  sz: number;
  /** the board's y range */
  y0: number;
  t: number;
  /** leg length along each edge, plate thickness, the board corner's radius */
  leg: number;
  plate: number;
  r: number;
  /** two domed rivets on the outer plate (+1 the top, −1 the bottom, 0 none) */
  rivets?: number;
}

/** A brass corner: a cap wrapping the board's corner, its inner edge a concave curve. */
export function cornerGeometry(c: CornerSpec): BufferGeometry {
  const { x, z, sx, sz, y0, t, leg, plate, r, rivets = 0 } = c;
  const e = plate * 0.8;
  // local (a along −sx, b along −sz from the outer corner), outward by e
  const pts: [number, number][] = [];
  const R = r + e;
  // the rounded outer corner, from the x edge to the z edge
  for (let k = 0; k <= 10; k++) {
    const th = (Math.PI / 2) * (k / 10);
    pts.push([R - R * Math.cos(th) - e, R - R * Math.sin(th) - e]);
  }
  // reversed so the outline runs: along the b = −e edge out to the leg, the concave curve back, the a = −e edge
  const outline: [number, number][] = [];
  outline.push([leg, -e]);
  for (let k = pts.length - 1; k >= 0; k--) outline.push(pts[k]);
  outline.push([-e, leg]);
  // the concave inner edge from (−e, leg) to (leg, −e), bowing toward the corner, with a small cusp
  const ctrl: [number, number] = [leg * 0.32, leg * 0.32];
  for (let k = 1; k < 16; k++) {
    const tt = k / 16;
    const a = (1 - tt) ** 2 * -e + 2 * (1 - tt) * tt * ctrl[0] + tt * tt * leg;
    const b = (1 - tt) ** 2 * leg + 2 * (1 - tt) * tt * ctrl[1] + tt * tt * -e;
    outline.push([a, b]);
  }
  // to world plan coordinates; the Shape is in (x, −z)
  const s = new Shape();
  outline.forEach(([a, b], i) => {
    const wx = x - sx * a;
    const wz = z - sz * b;
    if (i === 0) s.moveTo(wx, -wz);
    else s.lineTo(wx, -wz);
  });
  const g = slab(s, t + 2 * plate, plate * 0.45, 2, 4);
  g.translate(0, y0 - plate, 0);
  // worn bright on the outer edges and the corner, tarnished at the inner curve
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const col = new Float32Array(p.count * 4);
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const a = (x - p.getX(i)) * sx;
    const b = (z - p.getZ(i)) * sz;
    const corner = Math.exp(-(a * a + b * b) / (0.25 * leg * leg));
    const side = 1 - Math.abs(n.getY(i));
    const inner = smooth(leg * 0.45, leg * 0.75, a + b);
    const k = (0.85 + 0.35 * corner + 0.25 * side) * (1 - 0.35 * inner);
    col.set([k, k, k, 0.6], i * 4);
    uv.set([a / leg, b / leg], i * 2);
  }
  g.setAttribute('color', new BufferAttribute(col, 4));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  if (!rivets) return g;
  // the rivets: low domes, bright on their crowns
  const parts: BufferGeometry[] = [g];
  for (const [a, b] of [
    [0.34 * leg, 0.11 * leg],
    [0.11 * leg, 0.34 * leg],
  ]) {
    const d = new SphereGeometry(0.034, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    d.scale(1, 0.42 * rivets, 1);
    d.translate(x - sx * a, rivets > 0 ? y0 + t + plate - 0.002 : y0 - plate + 0.002, z - sz * b);
    const q = d.getAttribute('position');
    const dc = new Float32Array(q.count * 4);
    for (let i = 0; i < q.count; i++) {
      const k = 0.9 + 0.5 * Math.abs(d.getAttribute('normal').getY(i));
      dc.set([k, k, k, 0.5], i * 4);
    }
    d.setAttribute('color', new BufferAttribute(dc, 4));
    parts.push(d.toNonIndexed());
    d.dispose();
  }
  const out = mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q)))!;
  parts.forEach((q) => q.dispose());
  return out;
}

// ---- strips: the ribbon and the headband ------------------------------------------------------

/**
 * A flat strip along a polyline: `side` gives each point's across direction; the end is cut in a
 * V (`notch`: how far the centre line stops short of the edges). Three columns across. Colour per
 * point: `color(t)`.
 */
export function ribbonGeometry(points: V3[], side: V3[], width: number, notch: number, color: (t: number, across: number) => [number, number, number, number]): BufferGeometry {
  const n = points.length;
  const acc: number[] = [0];
  for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], points[i][2] - points[i - 1][2]));
  const Ltot = acc[n - 1];
  const P: number[] = [];
  const UV: number[] = [];
  const C: number[] = [];
  for (let i = 0; i < n; i++) {
    for (const a of [-1, 0, 1]) {
      let p = points[i];
      // the V: the centre column pulled back along the strip at the last point
      if (a === 0 && i === n - 1) {
        const q = points[n - 2];
        const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        const t = Math.min(1, notch / d);
        p = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      }
      const s = side[i];
      P.push(p[0] + s[0] * a * width * 0.5, p[1] + s[1] * a * width * 0.5, p[2] + s[2] * a * width * 0.5);
      UV.push((a + 1) / 2, acc[i] / Ltot);
      C.push(...color(acc[i] / Ltot, a));
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++)
    for (let a = 0; a < 2; a++) {
      const k = i * 3 + a;
      idx.push(k, k + 1, k + 4, k, k + 4, k + 3);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(UV), 2));
  g.setAttribute('color', new BufferAttribute(new Float32Array(C), 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A round tube along a polyline (constant radius, capped by its own taper), colour per point. */
export function tubeAlong(points: V3[], radius: number, radial: number, color: (t: number) => [number, number, number, number], taper = 0): BufferGeometry {
  const n = points.length;
  const P: number[] = [];
  const C: number[] = [];
  const UV: number[] = [];
  let prevN = new Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = new Vector3(...points[Math.max(0, i - 1)]);
    const b = new Vector3(...points[Math.min(n - 1, i + 1)]);
    const T = b.sub(a).normalize();
    // parallel transport of the frame
    let N = prevN.clone().sub(T.clone().multiplyScalar(prevN.dot(T)));
    if (N.lengthSq() < 1e-6) N = new Vector3(1, 0, 0).sub(T.clone().multiplyScalar(T.x));
    N.normalize();
    prevN = N;
    const B = new Vector3().crossVectors(T, N);
    const t = i / (n - 1);
    const r = radius * (1 - taper * t);
    for (let k = 0; k <= radial; k++) {
      const th = (2 * Math.PI * k) / radial;
      const d = N.clone().multiplyScalar(Math.cos(th)).add(B.clone().multiplyScalar(Math.sin(th)));
      P.push(points[i][0] + d.x * r, points[i][1] + d.y * r, points[i][2] + d.z * r);
      C.push(...color(t));
      UV.push(k / radial, t);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < radial; k++) {
      const a = i * (radial + 1) + k;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(C), 4));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(UV), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
