/**
 * Rocks as geometry: seeded chiselled boulders and slabs, flat stones and pebbles. A subdivided
 * icosahedron is cut by facet planes spread over it (a faceted polyhedron, the painted-rock look,
 * not a smooth loaf), its edges softened by a narrow bevel so highlights become thin lines, chips
 * at the corners, grit and cracks, and its base pressed flat so it can sink into the ground; a
 * vertex colour darkens its underside, hollows and cracks (cheap ambient occlusion). `mergeRocks` places
 * many rocks into one geometry (one draw call) and darkens every vertex near the ground it
 * stands on (contact occlusion), given that ground's height function.
 *
 * Deterministic: all randomness from @aiv/core's hashed `rand` / `hash32`.
 * Generic: no film imports.
 */
import { hash32, rand } from '@aiv/core';
import { BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, Matrix4, Vector3 } from 'three';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a: number, b: number, x: number) => smooth(clamp01((x - a) / (b - a)));

/** Stateless 3D value noise in [0, 1). */
export function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const w = smooth(z - zi);
  const h = (a: number, b: number, c: number) => hash32(seed, xi + a, yi + b, zi + c) / 4294967296;
  const x00 = h(0, 0, 0) + (h(1, 0, 0) - h(0, 0, 0)) * u;
  const x10 = h(0, 1, 0) + (h(1, 1, 0) - h(0, 1, 0)) * u;
  const x01 = h(0, 0, 1) + (h(1, 0, 1) - h(0, 0, 1)) * u;
  const x11 = h(0, 1, 1) + (h(1, 1, 1) - h(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/** Fractal 3D value noise in about [-1, 1]. */
export function fbm3(x: number, y: number, z: number, seed: number, octaves = 3): number {
  let s = 0;
  let a = 1;
  let n = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    s += a * (valueNoise3(x * f + o * 7.1, y * f - o * 3.3, z * f + o * 5.7, seed + o * 31) * 2 - 1);
    n += a;
    a *= 0.5;
    f *= 2.07;
  }
  return s / n;
}

export interface RockParams {
  seed: number;
  /** icosahedron subdivision (0 a pebble .. 26 a hero slab); facets need resolution to stay crisp */
  detail?: number;
  /** flat cutting planes spread over the rock (its facets) */
  facets?: number;
  /** how deep the cuts reach (0 none .. 0.5 deep), as a fraction of the radius */
  cut?: number;
  /** low noise displacement, as a fraction of the radius (keep it small: facets stay flat) */
  noise?: number;
  /** noise features per unit radius */
  freq?: number;
  /** half extents x, y, z */
  size?: [number, number, number];
  /** the base: below this height (−1..1 of the half height) the rock is pressed flat */
  base?: number;
  /** how dark the underside, the hollows and the cracks get (0..1) */
  ao?: number;
  /** crease angle in degrees for the shading (facet edges); 0 = smooth */
  crease?: number;
  /** squareness of the body before the cuts: 2 a sphere, 3-5 a rounded block */
  boxy?: number;
  /** rounding of the edges between facets (fraction of the radius): a narrow bevel catches a thin highlight */
  bevel?: number;
  /** fine grit (fraction of the radius) and its features per unit radius */
  grit?: number;
  gritFreq?: number;
  /** long cracks across the rock (grooves, darkened) */
  cracks?: number;
  /** small chips knocked off the corners */
  chips?: number;
  /** the top facet's tilt (radians): a sloped, wedge-like top; undefined: a random flat-ish top most of the time */
  topTilt?: number;
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Polynomial smooth minimum: a rounded edge of width k where two facets meet. */
function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/**
 * One rock, centred on its origin (its base at about y = base * size[1]); position, normal, color.
 * A rounded block is cut by facet planes spread over it (Fibonacci directions, jittered), chips
 * at its corners and a top facet, every edge softened by a narrow smooth-minimum bevel (so the
 * moon's rim breaks into thin bright lines along the edges); low noise keeps the facets from
 * reading machined, grit roughens them, cracks groove across them.
 */
export function rockGeometry(p: RockParams): BufferGeometry {
  const { seed, detail = 3, facets = 8, cut = 0.3, noise = 0.05, freq = 1.6, size = [1, 1, 1], base = -0.55, ao = 0.55, crease = 34, boxy = 2, bevel = 0.03, grit = 0, gritFreq = 9, cracks = 0, chips = 0, topTilt } = p;
  let k = 0;
  const r = () => rand(seed, 'rock', k++);
  const planes: { n: Vector3; o: number }[] = [];
  const rot = r() * Math.PI * 2;
  for (let i = 0; i < facets; i++) {
    const y = 1 - (2 * (i + 0.5)) / facets;
    const s = Math.sqrt(Math.max(0, 1 - y * y));
    const t = i * GOLDEN + rot;
    const n = new Vector3(Math.cos(t) * s + (r() - 0.5) * 0.5, y + (r() - 0.5) * 0.5, Math.sin(t) * s + (r() - 0.5) * 0.5).normalize();
    planes.push({ n, o: 1 - cut * (0.35 + 0.65 * r()) });
  }
  // chips: shallow cuts that only take the corners off
  for (let i = 0; i < chips; i++) {
    const t = r() * Math.PI * 2;
    const y = r() * 1.6 - 0.5;
    const s = Math.sqrt(Math.max(0, 1 - y * y));
    planes.push({ n: new Vector3(Math.cos(t) * s, y, Math.sin(t) * s).normalize(), o: 1 - cut * (0.55 + 0.35 * r()) });
  }
  // the top: a sloped facet (a wedge), or most of the time a flat-ish one
  if (topTilt !== undefined) {
    const az = r() * Math.PI * 2;
    const tl = topTilt * (0.7 + 0.3 * r());
    planes.push({ n: new Vector3(Math.sin(tl) * Math.cos(az), Math.cos(tl), Math.sin(tl) * Math.sin(az)), o: 1 - cut * (0.3 + 0.4 * r()) });
  } else if (facets > 0 && r() < 0.7) planes.push({ n: new Vector3(r() * 0.5 - 0.25, 1, r() * 0.5 - 0.25).normalize(), o: 1 - cut * (0.3 + 0.5 * r()) });
  // cracks: planes through the rock, a groove where the surface crosses them (along part of their run)
  const cr = Array.from({ length: cracks }, () => {
    const t = r() * Math.PI * 2;
    const y = (r() - 0.5) * 1.2;
    const s = Math.sqrt(Math.max(0, 1 - y * y));
    return { n: new Vector3(Math.cos(t) * s, y, Math.sin(t) * s).normalize(), o: (r() - 0.5) * 0.5, w: 0.018 + 0.02 * r(), d: 0.03 + 0.03 * r(), seed: Math.floor(r() * 1e6) };
  });
  const ns = seed * 13 + 7;
  let g: BufferGeometry = new IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position as BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const v = new Vector3();
  const q = new Vector3();
  const bY = base * size[1];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    // a rounded block (superellipsoid) before the cuts
    let rad = boxy === 2 ? 1 : Math.pow(Math.abs(v.x) ** boxy + Math.abs(v.y) ** boxy + Math.abs(v.z) ** boxy, -1 / boxy);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d <= 1e-3) continue;
      rad = smin(rad, pl.o / d, bevel);
    }
    const n = fbm3(v.x * freq, v.y * freq, v.z * freq, ns, 3);
    rad *= 1 + noise * n;
    if (grit > 0) rad *= 1 + grit * fbm3(v.x * gritFreq, v.y * gritFreq, v.z * gritFreq, ns + 5, 2);
    let crack = 0;
    for (const c of cr) {
      q.copy(v).multiplyScalar(rad);
      const sd = Math.abs(q.dot(c.n) - c.o);
      if (sd >= c.w) continue;
      const along = smoothstep(-0.05, 0.25, fbm3(q.x * 1.7, q.y * 1.7, q.z * 1.7, c.seed, 2));
      const gv = (1 - sd / c.w) ** 2 * along;
      rad *= 1 - c.d * gv;
      crack = Math.max(crack, gv);
    }
    let x = v.x * rad * size[0];
    let y = v.y * rad * size[1];
    let z = v.z * rad * size[2];
    if (y < bY) {
      // press the base flat (and spread it a touch, as a sunk rock's skirt)
      const t = (bY - y) / Math.max(1e-4, size[1] + bY);
      y = bY - (bY - y) * 0.12;
      x *= 1 + 0.08 * t;
      z *= 1 + 0.08 * t;
    }
    pos.setXYZ(i, x, y, z);
    // occlusion: dark underside, darker hollows of the noise and the cracks
    const under = smoothstep(-0.75, 0.45, v.y);
    const hollow = smoothstep(-0.5, 0.4, n);
    const a = (1 - ao + ao * under * (0.7 + 0.3 * hollow)) * (1 - 0.75 * crack);
    col[i * 3] = a;
    col[i * 3 + 1] = a;
    col[i * 3 + 2] = a;
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.computeVertexNormals();
  if (crease > 0) {
    const c = toCreasedNormals(g, (crease * Math.PI) / 180);
    g.dispose();
    g = c;
  }
  g.computeBoundingSphere();
  return g;
}

export interface PlacedRock {
  geometry: BufferGeometry;
  matrix: Matrix4;
  /** multiplies the rock's vertex colour (tint and brightness) */
  tint?: Color;
}

export interface MergeOptions {
  /** the ground's world height at (x, z): vertices near it darken (contact occlusion) */
  ground?: (x: number, z: number) => number;
  /** height above the ground over which the contact darkening fades out (world units) */
  contact?: number;
  /** how dark a vertex at the ground gets (0..1) */
  contactDark?: number;
}

const _c = new Vector3();

/** Many placed rocks merged into one geometry (position, normal, color). The inputs are not disposed. */
export function mergeRocks(rocks: PlacedRock[], o: MergeOptions = {}): BufferGeometry {
  const { ground, contact = 0.08, contactDark = 0.6 } = o;
  const parts: BufferGeometry[] = [];
  const v = new Vector3();
  for (const rk of rocks) {
    // creased rocks are non-indexed: merge everything non-indexed
    const g = (rk.geometry.index ? rk.geometry.toNonIndexed() : rk.geometry.clone()).applyMatrix4(rk.matrix);
    const pos = g.attributes.position as BufferAttribute;
    const col = g.attributes.color as BufferAttribute;
    const tint = rk.tint ?? new Color(1, 1, 1);
    // the ground under the rock as a plane through its centre (four samples, not one per vertex)
    _c.setFromMatrixPosition(rk.matrix);
    const e = 0.08;
    const g0 = ground ? ground(_c.x, _c.z) : 0;
    const gx = ground ? (ground(_c.x + e, _c.z) - ground(_c.x - e, _c.z)) / (2 * e) : 0;
    const gz = ground ? (ground(_c.x, _c.z + e) - ground(_c.x, _c.z - e)) / (2 * e) : 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      let a = 1;
      if (ground) a = 1 - contactDark * (1 - smoothstep(0, contact, v.y - (g0 + gx * (v.x - _c.x) + gz * (v.z - _c.z))));
      col.setXYZ(i, col.getX(i) * tint.r * a, col.getY(i) * tint.g * a, col.getZ(i) * tint.b * a);
    }
    parts.push(g);
  }
  const merged = parts.length ? mergeGeometries(parts, false) : new BufferGeometry();
  parts.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}
