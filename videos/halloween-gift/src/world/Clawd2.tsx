/**
 * Clawd, V2: the hero as a soft handmade storybook puppet, on the model sheet EXACTLY (it is the
 * character): a 13 x 8 body with no mouth, two 1 x 2 vertical slit eyes in rows 2-3, 2 x 2 arm
 * stubs in rows 4-5 and four 1 x 2 legs in columns 0, 2, 10 and 12, in #D77757, at U = 0.025
 * world units a cell (V1's 0.05 x DOOR_SCALE: the body is 0.325 x 0.2, 0.25 tall on his legs).
 *
 * The V2 look: stuffed felt. Every block is a rounded, slightly pillowed box (world/Clawd2
 * softBox: a subdivided cube projected onto a bevelled box, its faces puffed a little as if stuffed,
 * a faint handmade wobble), a felt map and fibre bump in his own frame (feltPatch), a moon rim in
 * his own hue from the geometric normal (a felt sheen, never a pale cyan side), vertex-colour
 * occlusion under the body and down the legs, and a small self-lit term in his own colour
 * (emissive, no light) so he reads against the dark ground. The post's screen-space tints (the
 * maroon foot band, the vignette's red-sparing corners, the plum floor) are undone on his pixels
 * (ScreenComp; `foot` is the post's foot, film/beats.ts footAt by default), so his colour holds
 * across cuts. A contact shadow (a soft ellipse under the body, a dot under each planted foot)
 * is multiplied into the ground under him. The eyes are black felt patches sewn on proud of the
 * front, in columns 2 and 10. The costume is ours: a crooked plum witch hat of soft cloth (a
 * floppy brim that drapes over the body's top corner, relaxed out of the body at build time; a
 * cone whose tip bends over and droops, creased where it bends and crumpled at the band; an
 * orange band; a mint buckle), an
 * ember-tipped twig wand (a gnarled tapering twig with a side shoot; the ember an HDR bead that
 * pulses smoothly and flares on a knock or a flick), the carved pumpkin pail (world/Pumpkins.tsx
 * PumpkinPail, hung by its handle from his left hand, resting on the ground when the hand is low)
 * and the gift envelope (black paper, a flap, an orange ribbon, a red wax seal) that pops up over
 * his hat on the ta-da.
 *
 * Driven by film/blocking.ts clawdAt(f) → { pose, hop }: pos (on the ground; the hop's lift
 * included), heading, rise (the pop-up from flat: a hinge about his front bottom edge, so at 0
 * he lies face up, flush with the ground), arms, eyes (open, closed, wink, left, right; plus an
 * idle blink), wand, envelope, hatTip, pailLit, and the hop's sy / sxz squash and stretch (about
 * the ground under him; the pail does not squash) and tuck (legs drawn up in the air). The pose's
 * arms and eyes are discrete; clawdSmooth(stateAt, f) eases them over a few frames (pass it as
 * `smooth`). Everything on ones, from the frame number alone.
 *
 * Props: pose, hop, f; smooth (clawdSmooth), ground, blink, glow, foot, camPos (the pail's opening
 * glows less from afar: at 25 px it read as a flat orange disc).
 *
 * Draw calls: the felt (body, legs and arms merged per frame into one mesh), the eyes, the hat,
 * the wand, the ember, the pail, the contact shadow, and the envelope while shown: 7-8. About
 * 23.6k triangles of his own (felt 8.2k, eyes 1.3k, hat 8.9k, wand 0.7k, ember 0.2k, envelope
 * 3.2k, contact 1.1k) and the pail's 9.9k.
 */
import { clamp, rand, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, Color, CustomBlending, DoubleSide, DstColorFactor, Euler, IcosahedronGeometry, LinearSRGBColorSpace, Matrix3, Matrix4, MeshBasicMaterial, Quaternion, RepeatWrapping, ShaderMaterial, Vector2, Vector3, Vector4, ZeroFactor, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FPS } from '../cues.ts';
import type { ClawdPose } from '../film/actors.ts';
import { footAt } from '../film/beats.ts';
import type { HopState } from '../film/gait.ts';
import { fbm2 } from '../kit/field.ts';
import { Curve } from '../kit/spline.ts';
import { NIGHT, storybookMaterial } from '../look/materials.ts';
import { canvas } from '../look/paper.ts';
import { FLOOR, groundHeight } from './layout.ts';
import { PAIL, PumpkinPail } from './Pumpkins.tsx';
import { surfaceHeight } from './Terrain.tsx';

const TAU = Math.PI * 2;
type V3 = [number, number, number];
export type RGBA = [number, number, number, number];

/** One cell of the model sheet, in world units (V1's 0.05 × DOOR_SCALE): the body is 0.325 x 0.2. */
export const U = 0.025;
export const CLAWD = '#D77757';
/** his height on his legs, and with the hat (world units) */
export const CLAWD_H = 10 * U;

/** linear RGB of an sRGB hex */
export function lin(hex: string): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

// ---- geometry kit (shared with world/Neighbour.tsx and world/Letter2.tsx) ----------------------

export interface SoftBoxSpec {
  /** full size x, y, z */
  size: readonly [number, number, number];
  /** bevel radius (clamped inside the box) */
  r: number;
  /** pillow: how far each pair of faces (x, y, z) puffs out at its middle */
  bulge?: readonly [number, number, number];
  /** handmade wobble along the normal (world units) and its feature size */
  wobble?: number;
  wobbleSize?: number;
  seed?: number;
  /** interior segments per axis, and steps per 45° of bevel */
  inner?: readonly [number, number, number];
  bevel?: number;
  /** vertex colour (linear RGBA; alpha is the rim's share) from the final position and normal */
  color?: (p: Vector3, n: Vector3) => RGBA;
}

/** Grid coordinates along one axis: tan-spaced over the bevels (even angles on the round), uniform between. */
function axisCoords(half: number, r: number, inner: number, bev: number): number[] {
  const c = half - r;
  const out: number[] = [];
  for (let i = bev; i > 0; i--) out.push(-(c + r * Math.tan(((i / bev) * Math.PI) / 4)));
  for (let i = 0; i <= inner; i++) out.push(-c + (2 * c * i) / inner);
  for (let i = 1; i <= bev; i++) out.push(c + r * Math.tan(((i / bev) * Math.PI) / 4));
  return out;
}

/** The pillow's push at an inner-box point q (normalised by c) along the normal n. */
function pillowAt(q: readonly number[], c: readonly number[], n: readonly number[], b: readonly number[]): number {
  let w = 0;
  for (let a = 0; a < 3; a++) {
    if (b[a] === 0) continue;
    let k = n[a] * n[a] * b[a];
    for (let i = 0; i < 3; i++) if (i !== a) k *= c[i] > 1e-9 ? Math.max(0, 1 - (q[i] / c[i]) ** 2) : 0;
    w += k;
  }
  return w;
}

/**
 * A soft box: a subdivided cube projected onto a box with rounded edges and corners (radius r),
 * its faces puffed out at the middle (stuffed felt), a faint wobble; welded, smooth normals,
 * outward winding, RGBA vertex colours. Centred on the origin.
 */
export function softBox(s: SoftBoxSpec): BufferGeometry {
  const half = [s.size[0] / 2, s.size[1] / 2, s.size[2] / 2];
  const r = Math.min(s.r, half[0] * 0.98, half[1] * 0.98, half[2] * 0.98);
  const c = half.map((h) => h - r);
  const bev = s.bevel ?? 4;
  const inner = s.inner ?? [3, 3, 3];
  const bulge = s.bulge ?? [0, 0, 0];
  const coords = [0, 1, 2].map((a) => axisCoords(half[a], r, Math.max(1, inner[a]), bev));
  const pos: number[] = [];
  const idx: number[] = [];
  for (let a = 0; a < 3; a++)
    for (const sg of [-1, 1]) {
      const u = (a + 1) % 3;
      const v = (a + 2) % 3;
      const cu = coords[u];
      const cv = coords[v];
      const base = pos.length / 3;
      for (let j = 0; j < cv.length; j++)
        for (let i = 0; i < cu.length; i++) {
          const p = [0, 0, 0];
          p[a] = sg * half[a];
          p[u] = cu[i];
          p[v] = cv[j];
          pos.push(p[0], p[1], p[2]);
        }
      const nu = cu.length;
      for (let j = 0; j < cv.length - 1; j++)
        for (let i = 0; i < nu - 1; i++) {
          const a0 = base + j * nu + i;
          const a1 = a0 + 1;
          const b0 = a0 + nu;
          const b1 = b0 + 1;
          if (sg > 0) idx.push(a0, a1, b1, a0, b1, b0);
          else idx.push(a0, b1, a1, a0, b0, b1);
        }
    }
  const wob = s.wobble ?? 0;
  const wk = 1 / (s.wobbleSize ?? 0.08);
  const seed = s.seed ?? 1;
  for (let i = 0; i < pos.length; i += 3) {
    const p = [pos[i], pos[i + 1], pos[i + 2]];
    const q = p.map((x, a) => Math.min(c[a], Math.max(-c[a], x)));
    let d = p.map((x, a) => x - q[a]);
    const l = Math.hypot(d[0], d[1], d[2]);
    d = l > 1e-12 ? d.map((x) => x / l) : [0, 1, 0];
    const push = r + pillowAt(q, c, d, bulge);
    let x = q[0] + d[0] * push;
    let y = q[1] + d[1] * push;
    let z = q[2] + d[2] * push;
    if (wob > 0) {
      const w = wob * fbm2(x * wk + z * 0.37 * wk, y * wk - z * 0.61 * wk, seed, 3);
      x += d[0] * w;
      y += d[1] * w;
      z += d[2] * w;
    }
    pos[i] = x;
    pos[i + 1] = y;
    pos[i + 2] = z;
  }
  let g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  const welded = mergeVertices(g, 1e-6);
  g.dispose();
  g = welded;
  g.computeVertexNormals();
  paint(g, s.color ?? (() => [1, 1, 1, 1]));
  return g;
}

/** Set an RGBA colour attribute from a function of each vertex's position and normal. */
export function paint(g: BufferGeometry, color: (p: Vector3, n: Vector3) => RGBA): void {
  const P = g.attributes.position as BufferAttribute;
  const N = g.attributes.normal as BufferAttribute;
  const col = new Float32Array(P.count * 4);
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i);
    n.fromBufferAttribute(N, i);
    col.set(color(p, n), i * 4);
  }
  g.setAttribute('color', new BufferAttribute(col, 4));
}

/**
 * A swept tube along a 3D curve with parallel-transported frames, welded round (no seam), outward
 * winding, an optional cap at the end. `radius(t, a)` and `color(t, a)` take t 0..1 along the
 * curve and the angle round it, measured from `n0` (the frame's first normal at the start) toward
 * tangent × n0.
 */
export function sweep(points: readonly V3[], rings: number, sides: number, radius: (t: number, a: number) => number, color: (t: number, a: number) => RGBA, n0: V3 = [0, 0, 1], cap = true): BufferGeometry {
  const curve = new Curve<V3>(points, 32);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const T = new Vector3(...(curve.tangentAt(0) as V3));
  const N = new Vector3(...n0);
  N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
  const B = new Vector3();
  const prevT = T.clone();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const s = t * curve.length;
    const p = curve.pointAt(s);
    T.set(...(curve.tangentAt(s) as V3));
    const axis = new Vector3().crossVectors(prevT, T);
    const sn = axis.length();
    if (sn > 1e-9) N.applyAxisAngle(axis.divideScalar(sn), Math.asin(clamp(sn, -1, 1)));
    N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
    B.crossVectors(T, N);
    prevT.copy(T);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU;
      const rr = radius(t, a);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      pos.push(p[0] + (N.x * ca + B.x * sa) * rr, p[1] + (N.y * ca + B.y * sa) * rr, p[2] + (N.z * ca + B.z * sa) * rr);
      col.push(...color(t, a));
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a0 = i * sides + j;
      const a1 = i * sides + ((j + 1) % sides);
      const b0 = a0 + sides;
      const b1 = a1 + sides;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
  if (cap) {
    const p = curve.pointAt(curve.length);
    const tip = pos.length / 3;
    const end = curve.tangentAt(curve.length);
    const lastR = radius(1, 0);
    pos.push(p[0] + end[0] * lastR * 0.6, p[1] + end[1] * lastR * 0.6, p[2] + end[2] * lastR * 0.6);
    col.push(...color(1, 0));
    const L = rings * sides;
    for (let j = 0; j < sides; j++) idx.push(L + j, L + ((j + 1) % sides), tip);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Static parts merged into one mesh and posed per frame on the CPU (one draw call): each part's
 * positions and normals are transformed by its matrix into a shared buffer; colours and the index
 * are written once.
 */
export class PartRig {
  readonly geometry = new BufferGeometry();
  private readonly parts: { pos: Float32Array; nrm: Float32Array; start: number }[] = [];
  private readonly nm = new Matrix3();
  constructor(parts: BufferGeometry[]) {
    let count = 0;
    const idx: number[] = [];
    for (const p of parts) {
      const P = p.attributes.position as BufferAttribute;
      const ix = p.index ? Array.from(p.index.array) : Array.from({ length: P.count }, (_, i) => i);
      for (const k of ix) idx.push(k + count);
      this.parts.push({ pos: Float32Array.from(P.array), nrm: Float32Array.from((p.attributes.normal as BufferAttribute).array), start: count });
      count += P.count;
    }
    const col = new Float32Array(count * 4);
    parts.forEach((p, i) => {
      const C = p.attributes.color as BufferAttribute | undefined;
      const n = (p.attributes.position as BufferAttribute).count;
      for (let k = 0; k < n; k++) {
        if (C) for (let c = 0; c < 4; c++) col[(this.parts[i].start + k) * 4 + c] = C.itemSize === 4 ? C.getComponent(k, c) : c < 3 ? C.getComponent(k, c) : 1;
        else col.set([1, 1, 1, 1], (this.parts[i].start + k) * 4);
      }
    });
    // each part's rest position and normal (its own frame, offset per part), for textures that stick to it
    const rest = new Float32Array(count * 3);
    const restN = new Float32Array(count * 3);
    this.parts.forEach((part, i) => {
      const n = part.pos.length / 3;
      for (let k = 0; k < n; k++) {
        const o = (part.start + k) * 3;
        rest[o] = part.pos[k * 3] + i * 0.37;
        rest[o + 1] = part.pos[k * 3 + 1] + i * 0.71;
        rest[o + 2] = part.pos[k * 3 + 2] + i * 0.13;
        restN.set([part.nrm[k * 3], part.nrm[k * 3 + 1], part.nrm[k * 3 + 2]], o);
      }
    });
    this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    this.geometry.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3), 3));
    this.geometry.setAttribute('color', new BufferAttribute(col, 4));
    this.geometry.setAttribute('aRest', new BufferAttribute(rest, 3));
    this.geometry.setAttribute('aRestN', new BufferAttribute(restN, 3));
    this.geometry.setIndex(idx);
  }
  /** Pose every part by its matrix (in the mesh's frame). */
  pose(mats: readonly Matrix4[]): void {
    const P = this.geometry.attributes.position as BufferAttribute;
    const N = this.geometry.attributes.normal as BufferAttribute;
    const pa = P.array as Float32Array;
    const na = N.array as Float32Array;
    this.parts.forEach((part, i) => {
      const e = mats[i].elements;
      this.nm.getNormalMatrix(mats[i]);
      const m = this.nm.elements;
      const n = part.pos.length / 3;
      for (let k = 0; k < n; k++) {
        const x = part.pos[k * 3];
        const y = part.pos[k * 3 + 1];
        const z = part.pos[k * 3 + 2];
        const o = (part.start + k) * 3;
        pa[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
        pa[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        pa[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        const a = part.nrm[k * 3];
        const b = part.nrm[k * 3 + 1];
        const c = part.nrm[k * 3 + 2];
        let nx = m[0] * a + m[3] * b + m[6] * c;
        let ny = m[1] * a + m[4] * b + m[7] * c;
        let nz = m[2] * a + m[5] * b + m[8] * c;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        na[o] = nx;
        na[o + 1] = ny;
        na[o + 2] = nz;
      }
    });
    P.needsUpdate = true;
    N.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
  dispose(): void {
    this.geometry.dispose();
  }
}

// ---- Clawd's parts --------------------------------------------------------------------------

/** the body's soft box: 13 x 8 x 6 cells, its centre 6 cells up (on 2-cell legs) */
const BODY = { size: [13 * U, 8 * U, 6 * U] as const, r: 0.72 * U, bulge: [0.16 * U, 0.2 * U, 0.38 * U] as const, y: 6 * U };
const LEG = { size: [1 * U, 2.45 * U, 1.2 * U] as const, r: 0.34 * U, cols: [0, 2, 10, 12] };
const ARM = { size: [2.15 * U, 2 * U, 2 * U] as const, r: 0.6 * U, x: 7.42 * U, y: 5 * U };
/**
 * The eyes: 1 x 2 cells in rows 2-3, in columns 2 and 10 (their centres ±4 cells from the middle).
 * The CLI's own pixel Clawd keeps two columns of body between each eye and the body's edge; V1 had
 * them at ±3.5, half a cell off the 13-column grid.
 */
const EYE = { size: [1 * U, 2 * U, 0.34 * U] as const, x: 4 * U, y: 7 * U };

/** The body front's z (its pillow included) at body-local x, y (y from the ground). */
function frontZ(x: number, y: number): number {
  const c = [BODY.size[0] / 2 - BODY.r, BODY.size[1] / 2 - BODY.r, BODY.size[2] / 2 - BODY.r];
  const q = [Math.min(c[0], Math.max(-c[0], x)), Math.min(c[1], Math.max(-c[1], y - BODY.y)), c[2]];
  return BODY.size[2] / 2 + pillowAt(q, c, [0, 0, 1], BODY.bulge);
}
/** The body top's height (its pillow included) at body-local x, z. */
function topY(x: number, z: number): number {
  const c = [BODY.size[0] / 2 - BODY.r, BODY.size[1] / 2 - BODY.r, BODY.size[2] / 2 - BODY.r];
  const q = [Math.min(c[0], Math.max(-c[0], x)), c[1], Math.min(c[2], Math.max(-c[2], z))];
  return BODY.y + BODY.size[1] / 2 + pillowAt(q, c, [0, 1, 0], BODY.bulge);
}

/**
 * The body's signed distance (body-local, the ground under his centre at the origin): its rounded
 * box, the stuffed faces' pillow included. Positive outside.
 */
function bodySd(x: number, y: number, z: number): number {
  const c = [BODY.size[0] / 2 - BODY.r, BODY.size[1] / 2 - BODY.r, BODY.size[2] / 2 - BODY.r];
  const p = [x, y - BODY.y, z];
  const q = p.map((v, a) => Math.min(c[a], Math.max(-c[a], v)));
  const d = p.map((v, a) => v - q[a]);
  const l = Math.hypot(d[0], d[1], d[2]);
  if (l < 1e-9) return -BODY.r - Math.min(...c.map((ca, a) => ca - Math.abs(p[a])));
  return l - BODY.r - pillowAt(q, c, d.map((v) => v / l), BODY.bulge);
}

/** The hat's rest place on the body (squash-group frame): a little right of centre, crooked, sunk into the top's pillow. */
const HAT_REST = (() => {
  const x = 0.6 * U;
  const z = -0.2 * U;
  return { pos: [x, topY(x, z) - 0.1 * U, z] as V3, rot: [-0.04, 0.25, -0.13] as V3 };
})();

/** Felt occlusion: darker underneath and low down, a faint mottle; alpha (the rim's share) 1. */
function feltColor(low: number, high: number, seed: number) {
  return (p: Vector3, n: Vector3): RGBA => {
    const h = smoothstep(low, high, p.y);
    const under = smoothstep(0.2, -0.8, n.y);
    // hand-dyed felt: a soft mottle, and the stuffed edges a little darker than the puffed faces
    const mott = 1 + 0.07 * fbm2(p.x * 40 + p.z * 23, p.y * 40 - p.z * 31, seed, 3);
    const flat = Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
    const edge = 1 - 0.16 * smoothstep(0.98, 0.72, flat);
    const k = (0.56 + 0.44 * h * h) * (1 - 0.36 * under) * mott * edge;
    return [k, k, k, 1];
  };
}

/**
 * The running stitch round the front and back panels: short dashes of a darker thread of his own
 * colour, sunk half into the felt a little inside the panel's edge (body-local, centred).
 */
function buildStitches(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const hx = 5.5 * U;
  const hy = 3.25 * U;
  const dash = 0.44 * U;
  const gap = 0.3 * U;
  // the rectangle's outline, with rounded corners, walked by arc length
  const rc = 0.6 * U;
  const path: [number, number][] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * (Math.PI / 2);
      path.push([cx + Math.cos(a) * rc, cy + Math.sin(a) * rc]);
    }
  };
  corner(hx - rc, hy - rc, 0);
  corner(-hx + rc, hy - rc, Math.PI / 2);
  corner(-hx + rc, -hy + rc, Math.PI);
  corner(hx - rc, -hy + rc, (3 * Math.PI) / 2);
  path.push(path[0]);
  const lens = [0];
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const total = lens[lens.length - 1];
  const at = (s: number): [number, number, number] => {
    let i = 1;
    while (i < lens.length - 1 && lens[i] < s) i++;
    const t = (s - lens[i - 1]) / Math.max(1e-9, lens[i] - lens[i - 1]);
    const x = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t;
    const y = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t;
    return [x, y, Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0])];
  };
  const n = Math.floor(total / (dash + gap));
  let k = 0;
  for (const side of [1, -1])
    for (let i = 0; i < n; i++) {
      const jit = (rand(5, 'st', k) - 0.5) * 0.08 * U;
      const [x, y, a] = at(((i + 0.5) / n) * total + jit);
      // a plain box per stitch (12 triangles: they are a few pixels long)
      const g = new BoxGeometry(dash * (0.92 + 0.16 * rand(5, 'sl', k)), 0.13 * U, 0.16 * U);
      g.deleteAttribute('uv');
      paint(g, () => [0.42, 0.42, 0.42, 0.3]);
      const z = side * (frontZ(x, y + BODY.y) + 0.005 * U);
      g.applyMatrix4(new Matrix4().makeRotationZ(a + (rand(5, 'sa', k) - 0.5) * 0.12).setPosition(x, y, z));
      parts.push(g);
      k++;
    }
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

function buildFelt(): BufferGeometry[] {
  const panel = softBox({ size: BODY.size, r: BODY.r, bulge: BODY.bulge, wobble: 0.07 * U, wobbleSize: 3 * U, seed: 71, inner: [10, 7, 5], bevel: 4, color: feltColor(-4 * U, 2.5 * U, 72) });
  const stitches = buildStitches();
  const body = mergeGeometries([panel, stitches], false);
  panel.dispose();
  stitches.dispose();
  const legs = LEG.cols.map((c, i) => {
    const g = softBox({ size: LEG.size, r: LEG.r, bulge: [0.05 * U, 0, 0.06 * U], wobble: 0.04 * U, wobbleSize: 1.5 * U, seed: 80 + i, inner: [1, 3, 1], bevel: 3, color: feltColor(-1.2 * U, 0.9 * U, 90 + c) });
    // the leg's top at its origin, hanging down (it reaches 0.45 cell up into the body)
    g.translate(0, -LEG.size[1] / 2, 0);
    return g;
  });
  const arms = [-1, 1].map((s) => softBox({ size: ARM.size, r: ARM.r, bulge: [0.08 * U, 0.08 * U, 0.1 * U], wobble: 0.05 * U, wobbleSize: 1.5 * U, seed: 95 + s, inner: [2, 2, 2], bevel: 3, color: feltColor(-1.6 * U, 0.8 * U, 97 + s) }));
  return [body, ...legs, ...arms];
}

function buildEyes(): BufferGeometry[] {
  return [0, 1].map((i) => softBox({ size: EYE.size, r: 0.32 * U, bulge: [0, 0, 0.05 * U], inner: [1, 2, 1], bevel: 3, seed: 61 + i, color: () => [1, 1, 1, 0.35] }));
}

// a mid violet: the darker #5e3166, then #7a4185, sank into the house's wall in the door shots (luma 4 apart)
const HAT = '#9a58ab';
const BAND = '#E9862E';
const BUCKLE = '#DCE6B7';

/** The witch hat (its origin at the brim's centre, bottom): a floppy brim, a creased cone that bends over and droops, a band and a buckle. */
function buildHat(): BufferGeometry {
  const plum = lin(HAT);
  const band = lin(BAND);
  const mint = lin(BUCKLE);
  // the brim: a rounded cross-section swept round, its outer part drooping in soft waves
  const R0 = 3.6 * U;
  const R1 = 6.5 * U;
  const th = 0.3 * U;
  const prof: [number, number][] = [];
  prof.push([R0, th]);
  for (let k = 1; k <= 6; k++) prof.push([R0 + ((R1 - 0.16 * U - R0) * k) / 6, th]);
  for (let k = 1; k < 8; k++) {
    const a = Math.PI / 2 - (k / 8) * Math.PI;
    prof.push([R1 - 0.16 * U + Math.cos(a) * 0.16 * U, th / 2 + Math.sin(a) * (th / 2)]);
  }
  for (let k = 0; k <= 6; k++) prof.push([R1 - 0.16 * U - ((R1 - 0.16 * U - R0) * k) / 6, 0]);
  const S = 72;
  const bp: number[] = [];
  const bc: number[] = [];
  const bi: number[] = [];
  for (let j = 0; j < S; j++) {
    const a = (j / S) * TAU;
    for (const [r, y] of prof) {
      const k = clamp((r - R0) / (R1 - R0), 0, 1);
      const droop = -(0.75 * U) * k * k * (0.7 + 0.3 * Math.sin(2 * a + 0.8) + 0.25 * Math.sin(3 * a + 1.9));
      const rr = r * (1 + 0.03 * k * Math.sin(4 * a + 0.3) + 0.015 * k * Math.sin(7 * a + 2.0));
      bp.push(Math.sin(a) * rr, y + droop, Math.cos(a) * rr);
      const ao = y < th * 0.5 ? 0.6 : 0.95 - 0.25 * (1 - k);
      bc.push(plum[0] * ao, plum[1] * ao, plum[2] * ao, 0.75);
    }
  }
  // the brim drapes over the body: every column of the brim (its underside's point at that radius)
  // is pushed out of the body's rounded box to a small clearance, so over the top-right corner it
  // bends down round the edge instead of cutting through it (the push is the body SDF's gradient,
  // taken in the body's frame at the hat's rest place and carried back into the hat's)
  {
    const toBody = new Matrix4().compose(new Vector3(...HAT_REST.pos), new Quaternion().setFromEuler(new Euler(...HAT_REST.rot)), new Vector3(1, 1, 1));
    const toHat = toBody.clone().invert();
    const clear = 0.2 * U;
    const e = 0.02 * U;
    const np = prof.length;
    const grad = (v: Vector3) => new Vector3(bodySd(v.x + e, v.y, v.z) - bodySd(v.x - e, v.y, v.z), bodySd(v.x, v.y + e, v.z) - bodySd(v.x, v.y - e, v.z), bodySd(v.x, v.y, v.z + e) - bodySd(v.x, v.y, v.z - e)).normalize();
    // the underside's point under each vertex (same radius and droop, y 0 of the profile), in the body's frame
    const anchor: Vector3[] = [];
    for (let j = 0; j < S; j++)
      for (let k = 0; k < np; k++) {
        const o = (j * np + k) * 3;
        anchor.push(new Vector3(bp[o], bp[o + 1] - prof[k][1], bp[o + 2]).applyMatrix4(toBody));
      }
    const start = anchor.map((v) => v.clone());
    // relax: push the points out, then every edge whose middle is still in (a chord across the
    // rounded corner between points pushed up and points pushed out) pushes both its ends
    const m = new Vector3();
    for (let round = 0; round < 8; round++) {
      for (const v of anchor) {
        const d = bodySd(v.x, v.y, v.z);
        if (d < clear) v.addScaledVector(grad(v), clear - d);
      }
      for (let j = 0; j < S; j++)
        for (let k = 0; k < np; k++) {
          const a = anchor[j * np + k];
          for (const b of [anchor[((j + 1) % S) * np + k], k + 1 < np ? anchor[j * np + k + 1] : null]) {
            if (!b) continue;
            m.addVectors(a, b).multiplyScalar(0.5);
            const d = bodySd(m.x, m.y, m.z);
            if (d >= clear) continue;
            const g = grad(m).multiplyScalar(clear - d);
            a.add(g);
            b.add(g);
          }
        }
    }
    for (let i = 0; i < anchor.length; i++) {
      const push = anchor[i].clone().applyMatrix4(toHat).sub(start[i].clone().applyMatrix4(toHat));
      bp[i * 3] += push.x;
      bp[i * 3 + 1] += push.y;
      bp[i * 3 + 2] += push.z;
    }
  }
  const np = prof.length;
  for (let j = 0; j < S; j++)
    for (let k = 0; k < np; k++) {
      const a0 = j * np + k;
      const a1 = j * np + ((k + 1) % np);
      const b0 = ((j + 1) % S) * np + k;
      const b1 = ((j + 1) % S) * np + ((k + 1) % np);
      bi.push(a0, a1, b0, a1, b1, b0);
    }
  let brim = new BufferGeometry();
  brim.setAttribute('position', new BufferAttribute(new Float32Array(bp), 3));
  brim.setAttribute('color', new BufferAttribute(new Float32Array(bc), 4));
  brim.setIndex(bi);
  brim.computeVertexNormals();
  brim = orientOutward(brim, [0, 1, 0], 3);
  // the cone: up, then bending over to his left and back, the tip drooping
  const axis: V3[] = [
    [0, 0.1 * U, 0],
    [0.05 * U, 2.0 * U, -0.02 * U],
    [0.22 * U, 3.7 * U, -0.18 * U],
    [0.75 * U, 5.05 * U, -0.42 * U],
    [1.7 * U, 5.95 * U, -0.7 * U],
    [2.75 * U, 6.05 * U, -0.88 * U],
    [3.55 * U, 5.45 * U, -1.0 * U],
  ];
  const fold = (a: number, t: number) => {
    // crumpled near the band and at the bend, smooth between; uneven ridges (never a regular star)
    const crump = 0.09 * Math.exp(-(((t - 0.04) / 0.12) ** 2)) + 0.07 * Math.exp(-(((t - 0.58) / 0.1) ** 2)) + 0.02;
    return crump * (Math.sin(5 * a + 0.7 + 2.0 * t) * 0.6 + Math.sin(8 * a + 2.1 - 1.3 * t) * 0.3 + fbm2(Math.cos(a) * 1.5 + t * 3, Math.sin(a) * 1.5 - t * 2, 123, 2) * 0.5);
  };
  const coneR = (t: number, a: number) => {
    const base = 3.95 * U * Math.pow(1 - t, 0.92) + 0.18 * U;
    const pinch = 1 - 0.13 * Math.exp(-(((t - 0.6) / 0.06) ** 2));
    const bandBump = t < 0.17 ? 0.16 * U * smoothstep(0.0, 0.02, t) * smoothstep(0.17, 0.145, t) : 0;
    return base * pinch * (1 + fold(a, t)) + bandBump;
  };
  const coneC = (t: number, a: number): RGBA => {
    if (t > 0.012 && t < 0.165) {
      const k = 0.88 + 0.12 * Math.cos(a);
      return [band[0] * k, band[1] * k, band[2] * k, 0.8];
    }
    const crease = 1 - 2.2 * Math.max(0, -fold(a, t));
    const bendShade = 1 - 0.22 * Math.exp(-(((t - 0.6) / 0.07) ** 2));
    const k = clamp(crease * bendShade * (t < 0.2 ? 0.8 + t : 1), 0.45, 1.05);
    return [plum[0] * k, plum[1] * k, plum[2] * k, t > 0.85 ? 0.5 : 1];
  };
  const cone = sweep(axis, 56, 40, coneR, coneC, [0, 0, 1], true);
  // the buckle: a mint square frame on the band at the front, leaning back with the cone
  const bars = [
    { s: [1.75 * U, 0.34 * U, 0.2 * U], p: [0, 0.55 * U, 0] },
    { s: [1.75 * U, 0.34 * U, 0.2 * U], p: [0, -0.55 * U, 0] },
    { s: [0.34 * U, 1.44 * U, 0.2 * U], p: [-0.7 * U, 0, 0] },
    { s: [0.34 * U, 1.44 * U, 0.2 * U], p: [0.7 * U, 0, 0] },
  ].map((b, i) => {
    const g = softBox({ size: b.s as V3, r: 0.08 * U, inner: [2, 1, 1], bevel: 2, seed: 140 + i, color: (_p, n) => [mint[0] * (0.85 + 0.15 * n.y), mint[1] * (0.85 + 0.15 * n.y), mint[2] * (0.85 + 0.15 * n.y), 0.5] });
    g.translate(b.p[0], b.p[1], b.p[2]);
    return g;
  });
  const buckle = mergeGeometries(bars, false);
  bars.forEach((b) => b.dispose());
  const bandT = 0.085;
  const bandR = coneR(bandT, 0);
  buckle.applyMatrix4(new Matrix4().makeRotationX(-0.36).setPosition(0, 0.1 * U + bandT * 8.5 * U, bandR + 0.04 * U));
  // the lining: a dark disc closing the cone over his head (seen when the hat tips)
  const lining = new CircleGeometry(3.95 * U, 40);
  lining.deleteAttribute('uv');
  lining.rotateX(Math.PI / 2);
  lining.translate(0, 0.16 * U, 0);
  paint(lining, () => [plum[0] * 0.35, plum[1] * 0.35, plum[2] * 0.35, 0.2]);
  const parts = [brim, cone, buckle, lining].map((g) => {
    const n = g.index ? g.toNonIndexed() : g.clone();
    g.dispose();
    return n;
  });
  const hat = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return hat;
}

/** Flip a geometry's winding if its face nearest `dir` from the centre points inward (a guard against inside-out sweeps). */
function orientOutward(g: BufferGeometry, dir: V3, vertex: number): BufferGeometry {
  const N = g.attributes.normal as BufferAttribute;
  const n = new Vector3().fromBufferAttribute(N, vertex);
  if (n.dot(new Vector3(...dir)) >= 0) return g;
  const ix = g.index!.array as Uint16Array | Uint32Array;
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix[i + 1];
    ix[i + 1] = ix[i + 2];
    ix[i + 2] = t;
  }
  g.index!.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** The twig wand (its origin where the hand grips it, the tip up +y): gnarled, tapering, a side shoot. */
const WAND_TIP: V3 = [0.04 * U, 8.1 * U, 0.03 * U];
function buildWand(): BufferGeometry {
  // a lighter, warmer twig: the dark one vanished against the house wall from behind
  const bark = lin('#8a5c3c');
  const pts: V3[] = [
    [0, -1.1 * U, 0],
    [0.1 * U, 1.0 * U, 0.06 * U],
    [-0.14 * U, 3.1 * U, 0.0],
    [0.12 * U, 5.3 * U, -0.06 * U],
    WAND_TIP,
  ];
  const knot = (t: number) => 1 + 0.35 * Math.exp(-(((t - 0.44) / 0.035) ** 2)) + 0.28 * Math.exp(-(((t - 0.71) / 0.03) ** 2));
  const main = sweep(
    pts,
    36,
    8,
    (t, a) => (0.34 * U - 0.17 * U * t) * knot(t) * (1 + 0.08 * Math.sin(3 * a + t * 9)),
    (t, a) => {
      const k = 0.7 + 0.25 * Math.sin(5 * a + t * 31) * 0.5 + 0.3 * t;
      return [bark[0] * k, bark[1] * k, bark[2] * k, 0.6];
    },
    [0, 0, 1],
    true,
  );
  const shoot = sweep(
    [
      [0.02 * U, 4.4 * U, 0],
      [0.7 * U, 5.3 * U, 0.12 * U],
      [1.05 * U, 6.3 * U, 0.2 * U],
    ],
    10,
    6,
    (t) => 0.15 * U - 0.05 * U * t,
    () => [bark[0] * 0.8, bark[1] * 0.8, bark[2] * 0.8, 0.4],
    [0, 0, 1],
    true,
  );
  const g = mergeGeometries([main, shoot], false);
  main.dispose();
  shoot.dispose();
  return g;
}

/** The ember: a lumpy bead at the wand's tip. */
function buildEmber(): BufferGeometry {
  const g = new IcosahedronGeometry(0.6 * U, 2);
  const P = g.attributes.position as BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const v = new Vector3().fromBufferAttribute(P, i);
    const k = 1 + 0.22 * fbm2(v.x * 160 + v.z * 70, v.y * 160, 51, 2);
    P.setXYZ(i, v.x * k, v.y * k * 1.15, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** The gift: a black paper envelope (10 x 6.5 cells) with its flap, an orange ribbon and a red wax seal, facing +z. */
function buildEnvelope(): BufferGeometry {
  // black paper, a shade lifted: from behind, against the house's dark wall, the darker one vanished and left only its ribbon's orange cross
  const black = lin('#3b2e45');
  const flapC = lin('#4a3a52');
  const orange = lin('#E9862E');
  const red = lin('#b52a24');
  const W = 10 * U;
  const H = 6.5 * U;
  const parts: BufferGeometry[] = [];
  parts.push(softBox({ size: [W, H, 0.32 * U], r: 0.1 * U, bulge: [0, 0, 0.06 * U], inner: [6, 4, 1], bevel: 2, seed: 150, color: (_p, n) => [black[0], black[1], black[2], 0.7 * Math.abs(n.z) + 0.3] }));
  // the flap: a thin triangle from the top corners to below the middle
  {
    const z0 = 0.17 * U;
    const z1 = 0.25 * U;
    const a: V3 = [-W / 2 + 0.15 * U, H / 2 - 0.12 * U, 0];
    const b: V3 = [W / 2 - 0.15 * U, H / 2 - 0.12 * U, 0];
    const c: V3 = [0, -0.6 * U, 0];
    const tri = [a, b, c];
    const pos: number[] = [];
    const col: number[] = [];
    for (const z of [z1, z0]) for (const p of tri) pos.push(p[0], p[1], z);
    const idx = [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5];
    for (let i = 0; i < 6; i++) col.push(flapC[0], flapC[1], flapC[2], 0.5);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
    g.setIndex(idx);
    const ng = g.toNonIndexed();
    g.dispose();
    ng.computeVertexNormals();
    parts.push(ng);
  }
  const ribbon = (sx: number, sy: number, seed: number, side = 1) => {
    const g = softBox({ size: [sx, sy, 0.12 * U], r: 0.05 * U, inner: [4, 4, 1], bevel: 2, seed, color: (_p, n) => [orange[0] * (0.9 + 0.1 * n.z), orange[1] * (0.9 + 0.1 * n.z), orange[2] * (0.9 + 0.1 * n.z), 0.6] });
    g.translate(0, 0, side * 0.3 * U);
    return g;
  };
  // the ribbon wraps round: a cross on the back too (the camera often sees his back on the ta-da)
  parts.push(ribbon(W + 0.2 * U, 0.75 * U, 151), ribbon(0.75 * U, H + 0.2 * U, 152), ribbon(W + 0.2 * U, 0.75 * U, 153, -1), ribbon(0.75 * U, H + 0.2 * U, 154, -1));
  // the seal: a lumpy red wax disc with a pressed pumpkin's ribs
  const seal = sweep(
    [
      [0, 0, 0.34 * U],
      [0, 0, 0.72 * U],
    ],
    3,
    32,
    (t, a) => 1.35 * U * (1 + 0.06 * Math.sin(5 * a + 1) + 0.04 * Math.sin(9 * a)) * (t < 0.99 ? 1 : 0.8),
    (t, a) => {
      const rib = 0.85 + 0.15 * Math.cos(8 * a);
      return [red[0] * rib, red[1] * rib, red[2] * rib, t > 0.5 ? 0.8 : 0.4];
    },
    [1, 0, 0],
    true,
  );
  parts.push(seal);
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  parts.forEach((p) => p.dispose());
  return g;
}

// ---- motion helpers -----------------------------------------------------------------------------

/** Continuous arms and eyelids eased over a few frames around f (the pose's are discrete). */
export interface ClawdSmooth {
  /** arm raise 0 down .. 1 up: left (the pail's) and right (the wand's) */
  armL: number;
  armR: number;
  /** eye openness 1 .. 0.2 (a closed slit): left (−x) and right (+x) */
  lidL: number;
  lidR: number;
  /** the eyes' sideways glance −1 .. 1 */
  look: number;
}

const ease = (x: number) => x * x * (3 - 2 * x);

function discrete(p: ClawdPose): ClawdSmooth {
  const up = p.arms === 'up';
  const lidOf = (side: -1 | 1) => (p.eyes === 'closed' || (p.eyes === 'wink' && side === 1) ? 0.2 : 1);
  return { armL: up ? 1 : 0, armR: up || p.arms === 'one-up' ? 1 : 0, lidL: lidOf(-1), lidR: lidOf(1), look: p.eyes === 'left' ? -1 : p.eyes === 'right' ? 1 : 0 };
}

/**
 * The pose's arms and eyes eased over neighbouring frames (a pure function of f): arms over ±3
 * frames, eyelids and glances over ±1 (a blink then has one half-shut drawing either side).
 */
export function clawdSmooth(stateAt: (f: number) => { pose: ClawdPose }, f: number): ClawdSmooth {
  const acc = { armL: 0, armR: 0, lidL: 0, lidR: 0, look: 0 };
  let wa = 0;
  let we = 0;
  for (let k = -3; k <= 3; k++) {
    const d = discrete(stateAt(f + k).pose);
    const a = 4 - Math.abs(k);
    acc.armL += d.armL * a;
    acc.armR += d.armR * a;
    wa += a;
    if (Math.abs(k) <= 1) {
      const e = k === 0 ? 2 : 1;
      acc.lidL += d.lidL * e;
      acc.lidR += d.lidR * e;
      acc.look += d.look * e;
      we += e;
    }
  }
  return { armL: ease(acc.armL / wa), armR: ease(acc.armR / wa), lidL: acc.lidL / we, lidR: acc.lidR / we, look: acc.look / we };
}

/** An idle blink (0 open .. 1 shut): one every 2.6-4.4 s at seeded times, five drawings long. */
export function idleBlink(f: number, seed = 3): number {
  const period = 84;
  const k = Math.floor(f / period);
  for (const j of [k - 1, k]) {
    const start = j * period + Math.floor(rand(seed, 'blink', j) * 40);
    const d = f - start;
    if (d >= 0 && d < 5) return [0.55, 1, 1, 0.55, 0.15][d];
  }
  return 0;
}

/** The ember's glow: a smooth breathing pulse (two slow sines), flaring with the wand. */
export function emberGlow(f: number, wand: number): number {
  const t = f / FPS;
  return (1 + 0.16 * Math.sin(TAU * 0.9 * t) + 0.07 * Math.sin(TAU * 2.3 * t + 1.1)) * (1 + 0.9 * wand);
}

// ---- the puppet -------------------------------------------------------------------------------

export interface Clawd2Props {
  pose: ClawdPose;
  hop?: HopState | null;
  f: number;
  /** eased arms and eyelids (clawdSmooth); default: the pose's discrete values */
  smooth?: ClawdSmooth;
  /** stand on world/Terrain's displaced surface instead of layout's groundHeight (default true) */
  ground?: boolean;
  /** idle blinks (default true) */
  blink?: boolean;
  /** the self-lit term (emissive in his own colour), for tuning */
  glow?: number;
  /** the post's foot band at this frame (NightPost `foot`), undone on his pixels; default film/beats.ts footAt(f) */
  foot?: number;
  /** the camera's position: the pail's opening glows less from afar (omitted: full glow) */
  camPos?: readonly number[];
}

/** the self-lit term's default strength (his colour, emissive) */
export const CLAWD_GLOW = 0.8;
/**
 * the felt's albedo: the model sheet's #D77757 a breath toward yellow (16.5° against 15°) and a
 * little less saturated (0.58 against 0.6: the self-lit term and the rim in his own hue add chroma). With the
 * post's foot band, vignette and floor tints undone on his pixels (ScreenComp) and the rim in his
 * own hue, the lit hue stays within a few degrees of the sheet's 15° in every light: the night's
 * cool fog and plum ambient pull it a little red from afar, the door yard's light a little yellow
 * (the characters lookdev's measurements).
 */
const FELT = '#D47A58';

let feltTex: CanvasTexture | null = null;
/**
 * A tileable felt map (256², grey about 0.5, built once from seeded code): soft blotches of
 * uneven dye and a dense mat of short fibres, lighter and darker, wrapped at the edges.
 */
export function feltTexture(): CanvasTexture {
  if (feltTex) return feltTex;
  const n = 256;
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      // periodic blotches: the noise sampled on a torus
      const a = (x / n) * TAU;
      const b = (y / n) * TAU;
      h[y * n + x] = 0.5 + 0.1 * fbm2(Math.cos(a) * 1.3 + Math.sin(b) * 0.4, Math.sin(a) * 1.3 + Math.cos(b) * 1.3, 901, 3);
    }
  // (dense and contrasty: at V1's 4200 faint fibres his felt read as smooth clay at the door camera)
  for (let i = 0; i < 11000; i++) {
    let x = rand(902, 'x', i) * n;
    let y = rand(902, 'y', i) * n;
    const ang = rand(902, 'a', i) * TAU;
    const len = 3 + rand(902, 'l', i) * 12;
    const v = (rand(902, 'v', i) < 0.55 ? 1 : -0.85) * (0.09 + 0.13 * rand(902, 'k', i));
    const bend = (rand(902, 'b', i) - 0.5) * 0.15;
    let th = ang;
    // (each fibre two texels wide: one-texel fibres averaged away below a pixel at the door camera)
    const px = Math.round(-Math.sin(ang));
    const py = Math.round(Math.cos(ang));
    for (let s = 0; s < len; s++) {
      const xi = ((Math.floor(x) % n) + n) % n;
      const yi = ((Math.floor(y) % n) + n) % n;
      const k = v * Math.sin((Math.PI * (s + 0.5)) / len);
      h[yi * n + xi] += k;
      h[(((yi + py) % n) + n) % n * n + ((((xi + px) % n) + n) % n)] += 0.6 * k;
      th += bend;
      x += Math.cos(th);
      y += Math.sin(th);
    }
  }
  // pills: little balls of matted fibre, lighter, each with a soft dark foot
  for (let i = 0; i < 700; i++) {
    const cx = rand(903, 'x', i) * n;
    const cy = rand(903, 'y', i) * n;
    const R = 1.2 + 2.2 * rand(903, 'r', i);
    const r0 = Math.ceil(R * 2);
    for (let dy = -r0; dy <= r0; dy++)
      for (let dx = -r0; dx <= r0; dx++) {
        const d = Math.hypot(dx, dy) / R;
        const xi = (((Math.floor(cx) + dx) % n) + n) % n;
        const yi = (((Math.floor(cy) + dy) % n) + n) % n;
        h[yi * n + xi] += d < 1 ? 0.16 * (1 - d * d) : -0.05 * Math.max(0, 1 - (d - 1));
      }
  }
  const { c, g } = canvas(n, n);
  const img = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const v = Math.max(0, Math.min(255, Math.round(h[i] * 255)));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  feltTex = new CanvasTexture(c);
  feltTex.colorSpace = LinearSRGBColorSpace;
  feltTex.wrapS = feltTex.wrapT = RepeatWrapping;
  // the side faces are often seen at a grazing angle: without it the fibres smear into streaks
  feltTex.anisotropy = 8;
  return feltTex;
}

export interface FeltPatch {
  /** world units per felt tile */
  tile: number;
  /** how much the felt varies the albedo (0..1) */
  tone: number;
  /** the felt's bump */
  bump: number;
  /** the emissive follows the vertex colour's occlusion (a self-lit term that models) */
  occlude?: boolean;
  /**
   * The moon rim in the surface's own colour (0: the storybook's cool rim, 1: the albedo's hue),
   * from the geometric normal (the fibre bump streaked it), a Fresnel edge capped at `rimCap`:
   * the cool rim turned his moon-facing side faces pale pink-white (saturation 0.19).
   */
  rimTint?: number;
  rimCap?: number;
  /** undo the post's foot-band and vignette tint on these pixels (see ScreenComp) */
  comp?: ScreenComp;
  /** the felt's fuzz: a soft sheen of loose fibres toward the silhouette (× the shaded colour) */
  fuzz?: number;
}

/**
 * The post's screen-space tints undone on a character's pixels (look/NightPost.tsx FINISH): the
 * maroon foot band (green and blue down far more than red) and the vignette's red-sparing bottom
 * corners turned him brick red at the bottom of the hero frame (hue 8°, saturation 0.79) and left
 * him salmon in close-ups (21°). The darkening stays (by the red channel's factor, the least), the
 * tint goes, so his colour holds across cuts. `uFoot` is the post's foot (film/beats.ts footAt);
 * `uView` the render target's size, set per draw (screenCompRender).
 */
export interface ScreenComp {
  uFoot: { value: number };
  uView: { value: Vector2 };
}
export function screenComp(): ScreenComp {
  return { uFoot: { value: 1 }, uView: { value: new Vector2(1920, 1080) } };
}
const _vp = new Vector4();
/** A mesh's onBeforeRender that hands the comp the render target's size. */
export function screenCompRender(c: ScreenComp) {
  return (renderer: WebGLRenderer) => {
    renderer.getCurrentViewport(_vp);
    c.uView.value.set(Math.max(1, _vp.z), Math.max(1, _vp.w));
  };
}

/** the storybook material's moon-rim line (look/materials.ts FRAG_OUT), replaced by the tinted rim */
const SB_RIM_LINE = 'outgoingLight += uSbRimColor * edge * toward * behind * uSbRim * uSbRimMul * diffuseColor.a;';
const COMP_GLSL = /* glsl */ `
{
  // look/NightPost.tsx FINISH's vignette tint and foot band at this pixel, undone but for their darkening
  vec2 sq = gl_FragCoord.xy / uCompView;
  vec2 dv = (sq - 0.5) * vec2(1.0, 0.82);
  // (as look/NightPost.tsx FINISH_TINT_GLSL, at FINISH_VIGNETTE 0.8: keep the two in step)
  float kv = smoothstep(0.22, 0.72, length(dv)) * 0.8 * mix(1.0, 0.32, smoothstep(0.45, 1.0, sq.y));
  vec3 dk = mix(vec3(0.6, 1.0, 1.0), vec3(1.0), smoothstep(0.15, 0.75, sq.y));
  float foot = smoothstep(0.27, 0.02, sq.y) * uCompFoot;
  vec3 mm = (1.0 - min(kv * dk, vec3(0.95))) * (1.0 - foot * vec3(0.4, 0.8, 0.82));
  outgoingLight *= mm.r / max(mm, vec3(0.05));
  // and the painted floor's tint (FINISH_LIFT, linear: its maroon low in the frame, slate high), its brightness kept
  vec3 lift = mix(vec3(0.0103, 0.0015, 0.0015), vec3(0.0065, 0.0091, 0.0159), smoothstep(0.05, 0.85, sq.y));
  outgoingLight = max(outgoingLight - (lift - dot(lift, vec3(0.2126, 0.7152, 0.0722))), vec3(0.0));
}
#include <opaque_fragment>`;

/** Add the screen comp to a material's shader (after its own injection): before its last opaque_fragment. */
function compShader(shader: WebGLProgramParametersWithUniforms, c: ScreenComp): void {
  shader.uniforms.uCompFoot = c.uFoot;
  shader.uniforms.uCompView = c.uView;
  const fs = shader.fragmentShader;
  const at = fs.lastIndexOf('#include <opaque_fragment>');
  if (at < 0) throw new Error('screen comp: no opaque_fragment');
  shader.fragmentShader = 'uniform float uCompFoot;\nuniform vec2 uCompView;\n' + fs.slice(0, at) + COMP_GLSL + fs.slice(at + '#include <opaque_fragment>'.length);
}

/** A storybook material with only the screen comp (the wand). */
export function compPatch(m: MeshStandardMaterial, c: ScreenComp): MeshStandardMaterial {
  const base = m.onBeforeCompile;
  const key = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = function (this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) {
    base.call(this, shader, renderer);
    compShader(shader, c);
  };
  m.customProgramCacheKey = () => `${key()}:comp`;
  return m;
}

const FUZZ_GLSL = /* glsl */ `{
  float fz = 1.0 - abs(dot(sbGeoN, normalize(vViewPosition)));
  outgoingLight *= 1.0 + uFeltFuzz * fz * fz * (0.55 + 0.9 * sbFelt);
}
`;
const RIM_TINTED = /* glsl */ `{
    float gF = max(dot(sbGeoN, V), 0.0);
    float gE = pow(max(1.0 - gF, 0.0), 3.5);
    float gT = smoothstep(-0.25, 0.65, dot(sbGeoN, Lv));
    vec3 hue = diffuseColor.rgb / max(max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), 1e-3);
    vec3 rc = mix(uSbRimColor, hue * 0.9, uFeltRim.x);
    outgoingLight += rc * min(gE * gT * behind * uSbRim * uSbRimMul, uFeltRim.y) * diffuseColor.a;
  }`;

/**
 * Felt on a storybook material, in the geometry's own frame (it moves with the puppet, never
 * swimming through world-space noise): a triplanar lookup of feltTexture() at the vertices' rest
 * positions (aRest / aRestN, or position / normal) tones the albedo and bumps the normal (less at
 * grazing angles, where a screen-space bump streaks); the emissive can follow the occlusion in the
 * vertex colours; the rim can take the albedo's hue; the post's tints can be undone. Its own
 * program cache key.
 */
export function feltPatch(m: MeshStandardMaterial, o: FeltPatch, rest = true): MeshStandardMaterial {
  const base = m.onBeforeCompile;
  const key = m.customProgramCacheKey.bind(m);
  const uniforms = { uFelt: { value: feltTexture() }, uFeltK: { value: new Vector3(o.tile, o.tone, o.bump) }, uFeltRim: { value: new Vector2(o.rimTint ?? 0, o.rimCap ?? 1) }, uFeltFuzz: { value: o.fuzz ?? 0 } };
  const P = rest ? 'aRest' : 'position';
  const N = rest ? 'aRestN' : 'normal';
  const tinted = o.rimTint !== undefined;
  m.onBeforeCompile = function (this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) {
    base.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `${rest ? 'attribute vec3 aRest;\nattribute vec3 aRestN;\n' : ''}varying vec3 vFeltP;\nvarying vec3 vFeltN;\n` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nvFeltP = ${P};\nvFeltN = ${N};`);
    let fs =
      `uniform sampler2D uFelt;\nuniform vec3 uFeltK;\nuniform vec2 uFeltRim;\nuniform float uFeltFuzz;\nvarying vec3 vFeltP;\nvarying vec3 vFeltN;\nfloat feltTri() {\n  vec3 w = pow(abs(normalize(vFeltN)), vec3(4.0));\n  w /= (w.x + w.y + w.z);\n  vec3 p = vFeltP / uFeltK.x;\n  return texture2D(uFelt, p.yz).r * w.x + texture2D(uFelt, p.zx + 0.37).r * w.y + texture2D(uFelt, p.xy + 0.71).r * w.z;\n}\n` +
      shader.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat sbFelt = feltTri();\ndiffuseColor.rgb *= 1.0 + (sbFelt - 0.5) * 2.0 * uFeltK.y;')
        .replace(
          '#include <normal_fragment_maps>',
          '#include <normal_fragment_maps>\nvec3 sbGeoN = normal;\n{ float graze = smoothstep(0.08, 0.45, abs(dot(normal, normalize(vViewPosition)))); normal = sbPerturb(-vViewPosition, normal, vec2(dFdx(sbFelt), dFdy(sbFelt)) * uFeltK.z * graze, faceDirection); }',
        )
        .replace('#include <emissivemap_fragment>', o.occlude ? '#include <emissivemap_fragment>\n#if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )\n  totalEmissiveRadiance *= vColor.rgb * (1.0 + (sbFelt - 0.5) * 2.0 * uFeltK.y);\n#endif' : '#include <emissivemap_fragment>');
    if (tinted) {
      if (!fs.includes(SB_RIM_LINE)) throw new Error('feltPatch: the storybook rim line moved (look/materials.ts)');
      fs = fs.replace(SB_RIM_LINE, RIM_TINTED);
    }
    if (o.fuzz) {
      // loose fibres catching light toward the silhouette, brighter on the felt's lighter fibres
      const at = fs.lastIndexOf('#include <opaque_fragment>');
      if (at < 0) throw new Error('feltPatch: no opaque_fragment');
      fs = fs.slice(0, at) + FUZZ_GLSL + fs.slice(at);
    }
    shader.fragmentShader = fs;
    if (o.comp) compShader(shader, o.comp);
  };
  m.customProgramCacheKey = () => `${key()}:felt:${rest ? 1 : 0}:${o.occlude ? 1 : 0}:${tinted ? 1 : 0}:${o.comp ? 1 : 0}:${o.fuzz ? 1 : 0}`;
  return m;
}

// ---- contact shadow ------------------------------------------------------------------------------

/** One soft disc of the contact decal (world xz, its half extents along his x and z, its darkness). */
interface ContactDisc {
  x: number;
  z: number;
  rx: number;
  rz: number;
  amt: number;
}
const CONTACT_RINGS = 5;
const CONTACT_SEG = 24;
const CONTACT_N = 1 + CONTACT_RINGS * CONTACT_SEG;
/** the body's soft shadow and one dot under each leg */
const CONTACT_DISCS = 5;

/**
 * Clawd's contact shadow: a soft dark ellipse under the body (a little toward the camera side,
 * away from the low moon) and a darker dot under each foot, laid on world/Terrain's displaced
 * surface and multiplied into the ground (no depth write, no light). The moon's own shadow is too
 * coarse for a figure 0.25 tall in the wide shadow box, and the yards he stands in are mostly in
 * the trees' and the house's shadow already. Rebuilt per frame (he moves): 5 polar discs.
 */
class ContactShadow {
  readonly geometry = new BufferGeometry();
  readonly material: ShaderMaterial;
  constructor() {
    const n = CONTACT_DISCS * CONTACT_N;
    const uv = new Float32Array(n * 2);
    const idx: number[] = [];
    for (let d = 0; d < CONTACT_DISCS; d++) {
      const base = d * CONTACT_N;
      for (let r = 0; r <= CONTACT_RINGS; r++)
        for (let k = 0; k < (r === 0 ? 1 : CONTACT_SEG); k++) {
          const a = (k / CONTACT_SEG) * TAU;
          const q = r / CONTACT_RINGS;
          const i = r === 0 ? base : base + 1 + (r - 1) * CONTACT_SEG + k;
          uv[i * 2] = Math.cos(a) * q;
          uv[i * 2 + 1] = Math.sin(a) * q;
        }
      const ring = (r: number, k: number) => (r === 0 ? base : base + 1 + (r - 1) * CONTACT_SEG + (k % CONTACT_SEG));
      for (let k = 0; k < CONTACT_SEG; k++) idx.push(ring(0, 0), ring(1, k + 1), ring(1, k));
      for (let r = 1; r < CONTACT_RINGS; r++) for (let k = 0; k < CONTACT_SEG; k++) idx.push(ring(r, k), ring(r, k + 1), ring(r + 1, k + 1), ring(r, k), ring(r + 1, k + 1), ring(r + 1, k));
    }
    this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    this.geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    this.geometry.setAttribute('aAmt', new BufferAttribute(new Float32Array(n), 1));
    this.geometry.setIndex(idx);
    this.material = new ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aAmt;
        varying vec2 vQ;
        varying float vAmt;
        void main() {
          vQ = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          // far off, the fogged ground must not show an unfogged dark spot
          vAmt = aAmt * (1.0 - smoothstep(5.0, 14.0, length(w.xyz - cameraPosition)));
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTint;
        varying vec2 vQ;
        varying float vAmt;
        void main() {
          float a = 1.0 - smoothstep(0.2, 1.0, length(vQ));
          gl_FragColor = vec4(mix(vec3(1.0), uTint, a * a * vAmt), 1.0);
        }`,
      uniforms: { uTint: { value: new Color('#24161f') } },
      blending: CustomBlending,
      blendSrc: DstColorFactor,
      blendDst: ZeroFactor,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }
  /** Lay the discs (world xz) on the terrain, turned by his heading. */
  pose(discs: readonly ContactDisc[], heading: number): void {
    const P = this.geometry.attributes.position as BufferAttribute;
    const A = this.geometry.attributes.aAmt as BufferAttribute;
    const UV = this.geometry.attributes.uv as BufferAttribute;
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    discs.forEach((d, j) => {
      for (let k = 0; k < CONTACT_N; k++) {
        const i = j * CONTACT_N + k;
        const lx = UV.getX(i) * d.rx;
        const lz = UV.getY(i) * d.rz;
        const x = d.x + lx * c + lz * s;
        const z = d.z - lx * s + lz * c;
        P.setXYZ(i, x, FLOOR + surfaceHeight(x, z) + 0.003, z);
        A.setX(i, d.amt);
      }
    });
    P.needsUpdate = true;
    A.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** The ground's direction away from the moon (where a contact shadow leans), xz. */
const AWAY = (() => {
  const d = NIGHT.uSbMoonDir.value;
  const l = Math.hypot(d.x, d.z) || 1;
  return [-d.x / l, -d.z / l] as const;
})();

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _v = new Vector3();
const _s = new Vector3();

function trs(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): Matrix4 {
  return new Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

export function Clawd2({ pose, hop = null, f, smooth, ground = true, blink = true, glow = CLAWD_GLOW, foot, camPos }: Clawd2Props) {
  const built = useMemo(() => {
    const felt = new PartRig(buildFelt());
    const eyes = new PartRig(buildEyes());
    const hat = buildHat();
    const wand = buildWand();
    const ember = buildEmber();
    const envelope = buildEnvelope();
    const contact = new ContactShadow();
    const comp = screenComp();
    // he travels: no world-space breakup or bump (they would swim through him); his felt is his own,
    // its rim in his own colour (a felt sheen at the silhouette, never a pale cyan side)
    const feltMat = feltPatch(storybookMaterial({ kind: 'cloth', color: FELT, breakup: 0, rim: 1.5, vertexColors: true, roughness: 0.95, emissive: FELT, emissiveIntensity: glow }), { tile: 0.34, tone: 0.6, bump: 2.6, occlude: true, rimTint: 1, rimCap: 0.85, comp, fuzz: 0.9 });
    const eyeMat = storybookMaterial({ kind: 'cloth', color: '#0e0b0d', breakup: 0, rim: 0.5, vertexColors: true, roughness: 0.6, ambient: 0.5 });
    // the hat is felt too: fibres, a fuzz sheen, its rim in its own violet (the cool rim and the thin
    // felt read as plastic), lifted off the house's wall by its lit brim
    // (and a little of the body's self-lit term, so it reads in the house's shadow, 20 luma off the wall)
    const hatMat = feltPatch(storybookMaterial({ kind: 'cloth', color: '#ffffff', breakup: 0, rim: 1.6, vertexColors: true, roughness: 1, side: DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.24 }), { tile: 0.28, tone: 0.5, bump: 2.4, occlude: true, rimTint: 0.85, rimCap: 0.7, comp, fuzz: 1.0 }, false);
    const wandMat = compPatch(storybookMaterial({ kind: 'bark', color: '#ffffff', breakup: 0, rim: 1.1, vertexColors: true, roughness: 1 }), comp);
    const emberMat = new MeshBasicMaterial({ color: new Color(4, 1.5, 0.35), toneMapped: false });
    // the gift glows a little in its own colours (the ribbon reads orange even from behind, in the house's shadow): the occluded self-lit term again
    const envMat = feltPatch(storybookMaterial({ kind: 'plain', color: '#ffffff', breakup: 0, rim: 0.9, vertexColors: true, roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0.32 }), { tile: 0.2, tone: 0.04, bump: 0.2, occlude: true, comp }, false);
    return { felt, eyes, hat, wand, ember, envelope, contact, comp, onDraw: screenCompRender(comp), feltMat, eyeMat, hatMat, wandMat, emberMat, envMat };
  }, []);
  useLayoutEffect(
    () => () => {
      built.felt.dispose();
      built.eyes.dispose();
      built.contact.dispose();
      for (const g of [built.hat, built.wand, built.ember, built.envelope]) g.dispose();
      for (const m of [built.feltMat, built.eyeMat, built.hatMat, built.wandMat, built.emberMat, built.envMat]) m.dispose();
    },
    [built],
  );

  // ---- the pose, in the squash group's frame (the ground under his centre at the origin) ----
  const sm = smooth ?? discrete(pose);
  const tuck = hop?.tuck ?? 0;
  const walkLift = (pair: 0 | 1) => (pose.walk === null ? 0 : Math.max(0, Math.sin((pose.walk + pair * 0.5) * TAU)) * 1.0 * U);
  const bob = pose.walk === null ? 0 : Math.abs(Math.sin(pose.walk * TAU)) * 0.5 * U;
  const legTop = 2 * U + 0.45 * U + bob;
  const mats: Matrix4[] = [trs(0, BODY.y + bob, 0)];
  LEG.cols.forEach((c, i) => {
    const lean = (rand(7, 'leg', i) - 0.5) * 0.05;
    const k = 1 - 0.58 * tuck;
    mats.push(trs((c - 6) * U, legTop + walkLift(i % 2 === 0 ? 0 : 1) * (1 - tuck), 0, lean * 0.5, 0, lean, 1, k, 1));
  });
  const armM = ([-1, 1] as const).map((s) => {
    const r = s < 0 ? sm.armL : sm.armR;
    // raised, the stub pivots up and out about where it joins the body (rows 4-5): a cheer, its end high
    const pivot = trs(s * 6.35 * U, ARM.y + bob, 0.35 * U * r, -0.2 * r, 0, s * 1.05 * r);
    return pivot.multiply(trs(s * (ARM.x - 6.35 * U), 0, 0));
  });
  mats.push(...armM);

  // eyes: openness from the pose (or eased), an idle blink, the glance
  const b = blink && (pose.eyes === 'open' || pose.eyes === 'left' || pose.eyes === 'right') ? idleBlink(f) : 0;
  const lid = (o: number) => Math.min(o, 1 - 0.8 * b);
  const look = sm.look * 0.6 * U;
  const eyeMats = ([-1, 1] as const).map((s) => {
    const open = lid(s < 0 ? sm.lidL : sm.lidR);
    const x = s * EYE.x + look;
    return trs(x, EYE.y + bob - (1 - open) * 0.35 * U, frontZ(x, EYE.y) + 0.06 * U, 0, 0, 0, 1, open, 1);
  });

  // the hands: the pail hangs from the left (−x), the wand grips in the right (+x)
  const handL = new Vector3(-0.78 * U, -0.72 * U, 0.25 * U).applyMatrix4(armM[0]);
  const handR = new Vector3(0.55 * U, -0.35 * U, 0.8 * U).applyMatrix4(armM[1]);

  // ---- the world frame ----
  const [px, py, pz] = pose.pos;
  const groundY = FLOOR + groundHeight(px, pz);
  const hopLift = Math.max(0, py - groundY);
  const y = ground ? FLOOR + surfaceHeight(px, pz) + hopLift : py;
  const sy = hop?.sy ?? 1;
  const sxz = hop?.sxz ?? 1;

  // the contact shadow: the body's soft ellipse (a little away from the moon) and a dot under each
  // planted foot, fading and spreading as he leaves the ground; none while he lies flat
  const fade = clamp(pose.rise, 0, 1) * (1 - smoothstep(0, 0.12, hopLift));
  const spread = 1 + 3 * hopLift;
  const ch = Math.cos(pose.heading);
  const shd = Math.sin(pose.heading);
  const at = (lx: number, lz: number): [number, number] => [px + lx * ch + lz * shd, pz - lx * shd + lz * ch];
  const discs: ContactDisc[] = [{ x: at(0, 0)[0] + AWAY[0] * 1.6 * U, z: at(0, 0)[1] + AWAY[1] * 1.6 * U, rx: 7.9 * U * spread * sxz, rz: 4.4 * U * spread * sxz, amt: 0.6 * fade }];
  LEG.cols.forEach((c, i) => {
    const [x, z] = at((c - 6) * U * sxz, 0);
    const up = walkLift(i % 2 === 0 ? 0 : 1);
    discs.push({ x, z, rx: 1.45 * U, rz: 1.6 * U, amt: 0.8 * fade * (1 - tuck) * (1 - smoothstep(0, 1.0 * U, up)) });
  });

  useLayoutEffect(() => {
    built.felt.pose(mats);
    built.eyes.pose(eyeMats);
    built.emberMat.color.setRGB(4, 1.5, 0.35).multiplyScalar(emberGlow(f, pose.wand));
    built.feltMat.emissiveIntensity = glow;
    built.comp.uFoot.value = foot ?? footAt(f);
    built.contact.pose(discs, pose.heading);
  });

  if (!pose.visible) return null;

  // the pail: unsquashed, hung from the squashed hand, resting on the ground when the hand is low
  const hand = handL.clone().multiply(_s.set(sxz, sy, sxz));
  const pailY = Math.max(hand.y - PAIL.handle[1], 0.0015);
  // its carved opening glows less from afar (at 25 px it read as a flat orange disc)
  const dCam = camPos ? Math.hypot(camPos[0] - px, camPos[1] - y, camPos[2] - pz) : 0;
  const pailK = 1 - 0.6 * smoothstep(1.5, 3.5, dCam);
  // the wand: resting tilted out and forward; lifted (knock, flick) it points ahead and up
  const w = clamp(pose.wand, 0, 1.2);
  const wandRot: V3 = [0.32 + 0.95 * w, 0.15 * w, -0.42 + 0.3 * w];
  // the hat: crooked; the tip raises and tilts it
  const [hx, hy, hz] = HAT_REST.pos;
  const [hrx, hry, hrz] = HAT_REST.rot;
  const env = clamp(pose.envelope, 0, 1);
  const rise = pose.rise;
  return (
    <>
      <mesh geometry={built.contact.geometry} material={built.contact.material} renderOrder={2} frustumCulled={false} />
      <group position={[px, y, pz]} rotation-y={pose.heading}>
        {/* the pop-up hinge about his front bottom edge: flat face up at rise 0 */}
        <group position-z={3 * U} rotation-x={-(1 - rise) * (Math.PI / 2)}>
          <group position-z={-3 * U}>
            <group scale={[sxz, sy, sxz]}>
              <mesh geometry={built.felt.geometry} material={built.feltMat} onBeforeRender={built.onDraw} castShadow receiveShadow />
              <mesh geometry={built.eyes.geometry} material={built.eyeMat} />
              <group position={[hx, hy + bob + pose.hatTip * 2.5 * U, hz + pose.hatTip * 1.5 * U]} rotation={[hrx - pose.hatTip * 0.35, hry, hrz + pose.hatTip * 0.25]}>
                <mesh geometry={built.hat} material={built.hatMat} onBeforeRender={built.onDraw} castShadow receiveShadow />
              </group>
              <group position={handR.toArray()} rotation={wandRot}>
                <mesh geometry={built.wand} material={built.wandMat} onBeforeRender={built.onDraw} castShadow />
                <mesh geometry={built.ember} material={built.emberMat} position={WAND_TIP} />
              </group>
              {env > 0.01 && (
                <group position={[0, 16.9 * U - (1 - env) * 5 * U, 3.4 * U]} rotation={[-0.1, 0, (1 - env) * 0.5 + 0.04]} scale={0.35 + 0.65 * env}>
                  <mesh geometry={built.envelope} material={built.envMat} onBeforeRender={built.onDraw} castShadow />
                </group>
              )}
            </group>
            <group position={[hand.x - 0.15 * U, pailY, hand.z + 0.1 * U]} rotation-y={0.45}>
              <PumpkinPail f={f} lit={pose.pailLit * pailK} />
            </group>
          </group>
        </group>
      </group>
    </>
  );
}

/** Triangle counts (for the budget). */
export function clawd2Stats(): Record<string, number> {
  const tri = (g: BufferGeometry) => (g.index ? g.index.count : (g.attributes.position as BufferAttribute).count) / 3;
  const felt = buildFelt();
  const eyes = buildEyes();
  const out = { felt: felt.reduce((a, g) => a + tri(g), 0), eyes: eyes.reduce((a, g) => a + tri(g), 0), hat: tri(buildHat()), wand: tri(buildWand()), ember: tri(buildEmber()), envelope: tri(buildEnvelope()) };
  return out;
}

/**
 * Where the V2 pail's opening is in the world for a pose (the candy's target at the door): the pail
 * hangs from the left hand (arm raise from the pose's arms), unsquashed, turned with his heading,
 * on the displaced ground. (film/blocking.ts pailWorld is V1's offset, ~3.6 cm further out.)
 */
export function pail2World(pose: ClawdPose, hop: HopState | null = null): [number, number, number] {
  const raise = pose.arms === 'up' ? 1 : 0;
  const pivot = trs(-6.35 * U, ARM.y, 0.35 * U * raise, -0.2 * raise, 0, -1.05 * raise).multiply(trs(-(ARM.x - 6.35 * U), 0, 0));
  const hand = new Vector3(-0.78 * U, -0.72 * U, 0.25 * U).applyMatrix4(pivot).multiply(new Vector3(hop?.sxz ?? 1, hop?.sy ?? 1, hop?.sxz ?? 1));
  const local = new Vector3(hand.x - 0.15 * U, Math.max(hand.y - PAIL.handle[1], 0.0015) + PAIL.rimY, hand.z + 0.1 * U);
  const [px, py, pz] = pose.pos;
  const lift = Math.max(0, py - (FLOOR + groundHeight(px, pz)));
  const c = Math.cos(pose.heading);
  const s = Math.sin(pose.heading);
  return [px + local.x * c + local.z * s, FLOOR + surfaceHeight(px, pz) + lift + local.y, pz - local.x * s + local.z * c];
}
