/**
 * The last house: a crooked, chapel-like storybook cottage on the crest of the hill, right of
 * centre in the hero view (LAND.house), built in its own frame (world/layout.ts houseFrame: x along
 * the front, y up from the door's floor, z out of the front; the door at the origin).
 *
 * The plan, as in the reference's cottage: two spiky peaks with a valley between them. On the left
 * the door wing, a narrow steep front gable over the door, its ridge crested and a tall finial on
 * its apex; on the right the tall wing, hipped at both ends, its short ridge crested between two
 * finials, two owls on it and a crooked chimney behind; a lower bay with its own gable in front of
 * the tall wing, and a porch hood over the door. The wings lean apart, the ridges sag and the eaves
 * kick up at their corners. Rough stone walls (stucco over rubble, cut corner stones, a plinth)
 * with pointed gothic windows that glow cyan from inside; big wavy slate tiles laid in uneven
 * courses (kit/roof.ts); a cyan lantern on an iron bracket off the door wing's front-left corner,
 * whose light (and the red lanterns' and the windows') is baked into the surfaces round it.
 *
 * The door front (layout.ts DOOR_FRONT, used exactly): the arched plank door, its own group hinged
 * on its left jamb (`doorOpen` 0 shut .. 1 swung 100° into the room), the upright 福 on it, the
 * couplets either side and the 横批 above (look/redpaper.ts: the approved text), a stone arch, a
 * stone step, the porch eave with the two red paper lanterns glowing dimly, and the room behind the
 * opening: a dim plank-floored interior (a table with a candle, a chair, a dresser) lit cyan from
 * an inner doorway, enough to silhouette the neighbour who steps out. The room is dug out of
 * whatever ground lies under the house (a depth-only cap drawn after the room hides the terrain
 * inside the walls), so the doorway never shows turf. The yard in front of the door stays clear.
 *
 * FarHouse is the small house down the lane with one big window (LAND.farWindow) whose glow is
 * warm and flips cold (`cold`).
 *
 * Every surface is a storybook material; static geometry is merged per material (about 22 draw
 * calls for the house, 5 for the far house). Deterministic: seeded geometry built once per mount.
 */
import { clamp, rand, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  LinearSRGBColorSpace,
  Matrix3,
  Matrix4,
  MeshBasicMaterial,
  Path,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type MeshStandardMaterial,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import { fbm2 } from '../kit/field.ts';
import { Builder, cresting, finial, gablePlanes, ridgeCap, shingles, underGable, type Gable, type RGBA, type RoofPlane, type ShingleSpec, type V3 } from '../kit/roof.ts';
import { useFilmFonts } from '../look/fonts.ts';
import { storybookMaterial, type Paint } from '../look/materials.ts';
import { canvas, seq } from '../look/paper.ts';
import { GOLD_INK, useRedPaper } from '../look/redpaper.ts';
import { DOOR_FRONT, FLOOR, houseFrame, LAND, onGround } from './layout.ts';
import { ground, surfaceHeight } from './Terrain.tsx';

const TAU = Math.PI * 2;
const HF = houseFrame();
const HF_Y = HF.elements[13];
const _w = new Vector3();
/** the ground's height (world y) under a house-local point */
function groundUnder(p: Vector3, frame: Matrix4 = HF): number {
  _w.copy(p).applyMatrix4(frame);
  return FLOOR + ground(_w.x, _w.z);
}
/** the rendered surface's height (house-local y) under a house-local point */
function surfaceUnder(x: number, z: number): number {
  _w.set(x, 0, z).applyMatrix4(HF);
  return FLOOR + 0.004 + surfaceHeight(_w.x, _w.z) - HF_Y;
}

// ---- the plan (house-local) -------------------------------------------------------------------

/** A side-gabled wing hipped at both ends: its ridge runs from hipL to hipR. */
export interface Hipped extends Gable {
  hipL: number;
  hipR: number;
}

/** the door wing: a narrow steep front gable over the door */
export const DOOR_WING: Gable = { x0: -0.64, x1: 0.6, z0: -1.18, z1: 0, eave: 1.5, peak: 2.8, ridge: 'z', overhang: 0.1, verge: 0.1 };
/** the tall wing right of it: hipped at both ends, its short ridge crested between two finials */
export const TALL_WING: Hipped = { x0: 0.56, x1: 1.98, z0: -1.42, z1: -0.32, eave: 1.6, peak: 2.95, ridge: 'x', overhang: 0.12, verge: 0.1, hipL: 0.98, hipR: 1.64 };
/** the low bay in front of the tall wing, with its own gable */
export const BAY: Gable = { x0: 0.9, x1: 1.56, z0: -0.7, z1: 0.0, eave: 1.18, peak: 2.08, ridge: 'z', overhang: 0.08, verge: 0.08 };
/** the porch hood over the door (the red lanterns hang under it) */
export const PORCH: Gable = { x0: -0.62, x1: 0.62, z0: 0.0, z1: 0.46, eave: 1.46, peak: 1.98, ridge: 'z', overhang: 0.07, verge: 0.06 };

const WALL_T = 0.13;
const D = DOOR_FRONT.door;
/** the door's arch: springing height and arc radius (a drop arch, a little pointed) */
const DOOR_ARCH = 0.62;
/** the door leaf: its front face is this far behind the wall face; its thickness; the hinge */
const LEAF_Z = -0.07;
const LEAF_T = 0.035;
const HINGE: V3 = [-D.w / 2 + 0.004, 0, LEAF_Z - LEAF_T];
/** the cyan wall lantern's glass centre: on a bracket off the door wing's front-left corner */
export const WALL_LANTERN = new Vector3(-0.9, 0.84, 0.08);
const LANTERN_SCALE = 1.5;

const gauss = (d: number, s: number) => Math.exp(-((d / s) ** 2));
/** roof corners whose eaves kick up (plan x, z, the eave's height) */
const KICKS: [number, number, number][] = (() => {
  const dw = DOOR_WING;
  const tw = TALL_WING;
  const b = BAY;
  const oh = (g: Gable) => g.overhang ?? 0.12;
  const vg = (g: Gable) => g.verge ?? 0.1;
  return [
    [dw.x0 - oh(dw), dw.z1 + vg(dw), dw.eave],
    [dw.x1 + oh(dw), dw.z1 + vg(dw), dw.eave],
    [dw.x0 - oh(dw), dw.z0 - vg(dw), dw.eave],
    [tw.x0 - oh(tw), tw.z1 + oh(tw), tw.eave],
    [tw.x1 + oh(tw), tw.z1 + oh(tw), tw.eave],
    [tw.x1 + oh(tw), tw.z0 - oh(tw), tw.eave],
    [tw.x0 - oh(tw), tw.z0 - oh(tw), tw.eave],
    [b.x0 - oh(b), b.z1 + vg(b), b.eave],
    [b.x1 + oh(b), b.z1 + vg(b), b.eave],
  ];
})();

/**
 * The crooked warp: the two wings lean apart (the door gable about 4° left, the tall wing about 3°
 * right), the ridges sag, the eaves kick up at the roof's corners, the whole top twists a little in
 * plan. Nothing below the porch eave moves (the door front stays exactly where DOOR_FRONT says).
 */
function crooked(p: Vector3): void {
  const y = p.y;
  if (y <= 0.95) return;
  // eave kicks (the walls' tops under them rise with them, hidden by the overhang)
  let kick = 0;
  for (const [x, z, e] of KICKS) {
    if (y < e - 0.12 || y > e + 0.45) continue;
    kick = Math.max(kick, 0.06 * gauss(Math.hypot(p.x - x, p.z - z), 0.24) * smoothstep(e - 0.12, e + 0.02, y) * (1 - smoothstep(e + 0.15, e + 0.45, y)));
  }
  const h = smoothstep(1.45, 3.0, y);
  const dy = Math.max(0, y - 1.45);
  // the lean: tan −0.07 on the door wing, +0.055 on the tall wing, blended across the valley
  const lean = -0.07 + 0.125 * smoothstep(0.3, 0.9, p.x);
  const x0 = p.x;
  p.x += lean * dy * smoothstep(1.45, 1.75, y);
  // the ridges sag
  const tw = TALL_WING;
  const dw = DOOR_WING;
  const sagT = 0.05 * Math.sin(Math.PI * clamp((x0 - tw.hipL + 0.05) / (tw.hipR - tw.hipL + 0.1), 0, 1)) * smoothstep(tw.eave + 0.5, tw.peak, y) * smoothstep(0.55, 0.85, x0);
  const sagD = 0.045 * Math.sin(Math.PI * clamp((p.z - dw.z0 + 0.1) / (dw.z1 - dw.z0 + 0.2), 0, 1)) * smoothstep(dw.eave + 0.5, dw.peak, y) * (1 - smoothstep(0.4, 0.7, x0));
  p.y += kick - sagT - sagD;
  p.z += 0.03 * h * h * Math.sin(2.3 * x0 + 1.1);
}

// ---- the practicals' light, baked: the lanterns and windows light the surfaces round them ------

/** the storybook injection (one module-level function shared by every storybook material) */
const SB_INJECT = (() => {
  const m = storybookMaterial();
  const f = m.onBeforeCompile;
  m.dispose();
  return f;
})();

interface GlowUniforms {
  uGlowMul: { value: number };
  uGlowWin: { value: number };
  uGlowAlbedo: { value: number };
}

const GLOW_VERT = 'attribute vec3 aGlow;\nattribute vec3 aGlowW;\nuniform float uGlowMul;\nuniform float uGlowWin;\nvarying vec3 vSbGlow;\n';
const GLOW_FRAG = 'uniform float uGlowAlbedo;\nvarying vec3 vSbGlow;\n';

/**
 * The storybook material plus a baked practical light: per-vertex RGB (aGlow: the lanterns, scaled
 * by uGlowMul; aGlowW: the windows, scaled by uGlowWin) added to the emitted light, times the
 * surface's albedo (uGlowAlbedo 1: light falling on it) or as it is (0: the surface glows itself,
 * the paper lanterns). One module-level injection, keyed apart from the plain storybook programs.
 */
function injectGlow(this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer): void {
  SB_INJECT.call(this, shader, renderer);
  Object.assign(shader.uniforms, (this.userData as { glow: GlowUniforms }).glow);
  shader.vertexShader = GLOW_VERT + shader.vertexShader.replace('#include <project_vertex>', 'vSbGlow = aGlow * uGlowMul + aGlowW * uGlowWin;\n#include <project_vertex>');
  shader.fragmentShader = GLOW_FRAG + shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vSbGlow * mix(vec3(1.0), diffuseColor.rgb, uGlowAlbedo);');
}

/** A storybook material that takes the baked practical light (see injectGlow). */
export function glowMaterial(o: Paint, albedo = 1): MeshStandardMaterial {
  const m = storybookMaterial(o);
  const glow: GlowUniforms = { uGlowMul: { value: 1 }, uGlowWin: { value: 1 }, uGlowAlbedo: { value: albedo } };
  m.userData.glow = glow;
  const key = m.customProgramCacheKey();
  m.onBeforeCompile = injectGlow;
  m.customProgramCacheKey = () => `${key}:glow`;
  return m;
}

/** A small light source baked into the surfaces: colour × power / (d² + r0²), out to `reach`. */
interface Practical {
  p: Vector3;
  c: readonly [number, number, number];
  power: number;
  r0: number;
  reach: number;
}

const RED_LANTERNS = DOOR_FRONT.lanterns.map(([x, y, z]) => new Vector3(x, y, z));
const LANTERN_LIGHTS: Practical[] = [
  { p: WALL_LANTERN, c: [0.3, 0.88, 1.0], power: 0.18, r0: 0.12, reach: 1.4 },
  ...RED_LANTERNS.map((p) => ({ p, c: [1.0, 0.42, 0.16] as const, power: 0.026, r0: 0.1, reach: 0.65 })),
];

function lightAt(P: Vector3, N: Vector3, lights: readonly Practical[], out: [number, number, number]): [number, number, number] {
  out[0] = out[1] = out[2] = 0;
  for (const L of lights) {
    const dx = L.p.x - P.x;
    const dy = L.p.y - P.y;
    const dz = L.p.z - P.z;
    const d = Math.hypot(dx, dy, dz);
    if (d >= L.reach) continue;
    const ndl = clamp(((N.x * dx + N.y * dy + N.z * dz) / (d || 1) + 0.25) / 1.25, 0, 1);
    const k = (L.power / (d * d + L.r0 * L.r0)) * ndl * smoothstep(L.reach, L.reach * 0.45, d);
    out[0] += L.c[0] * k;
    out[1] += L.c[1] * k;
    out[2] += L.c[2] * k;
  }
  out[0] = Math.min(out[0], 1.6);
  out[1] = Math.min(out[1], 1.6);
  out[2] = Math.min(out[2], 1.6);
  return out;
}

/** Write a per-vertex glow attribute: fn(house-local position, normal) → RGB (m: geometry → house-local). */
function setGlow(g: BufferGeometry, name: 'aGlow' | 'aGlowW', fn: (p: Vector3, n: Vector3) => readonly [number, number, number], m?: Matrix4): void {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const arr = new Float32Array(pos.count * 3);
  const P = new Vector3();
  const N = new Vector3();
  const nm = m ? new Matrix3().getNormalMatrix(m) : null;
  for (let i = 0; i < pos.count; i++) {
    P.fromBufferAttribute(pos, i);
    if (nor) N.fromBufferAttribute(nor, i);
    else N.set(0, 0, 1);
    if (m && nm) {
      P.applyMatrix4(m);
      N.applyMatrix3(nm).normalize();
    }
    const c = fn(P, N);
    arr[i * 3] = c[0];
    arr[i * 3 + 1] = c[1];
    arr[i * 3 + 2] = c[2];
  }
  g.setAttribute(name, new BufferAttribute(arr, 3));
}

/** Both glow attributes: the lanterns' light and the windows' (house-local); `lanterns` may leave some out. */
function bakeGlow(g: BufferGeometry, windows: readonly Practical[], m?: Matrix4, lanterns: readonly Practical[] = LANTERN_LIGHTS): void {
  const t: [number, number, number] = [0, 0, 0];
  setGlow(g, 'aGlow', (p, n) => lightAt(p, n, lanterns, t), m);
  setGlow(g, 'aGlowW', (p, n) => lightAt(p, n, windows, t), m);
}

// ---- cut stone -----------------------------------------------------------------------------------

/**
 * A dressed stone: a box with chamfered edges and corners (flat faces, crisp edges that catch the
 * light as thin lines), every corner knocked a little differently and every face a little out of
 * true, so no two stones are alike. Half extents h, chamfer ch (world units), transformed by m.
 */
function cutStone(out: Builder, m: Matrix4, h: readonly [number, number, number], ch: number, seed: number, rgba: RGBA, jit = 0.35): void {
  let k = 0;
  const r = () => rand(seed, 'cut', k++) - 0.5;
  const ctr = new Vector3().applyMatrix4(m);
  const V: Vector3[][] = [];
  for (let c = 0; c < 8; c++) {
    const s = [c & 1 ? 1 : -1, c & 2 ? 1 : -1, c & 4 ? 1 : -1];
    const knock = 1 + Math.max(0, r()) * 1.8;
    const row: Vector3[] = [];
    for (let a = 0; a < 3; a++) {
      const q = [0, 0, 0];
      for (let i = 0; i < 3; i++) q[i] = i === a ? s[i] * (h[i] + r() * jit * ch) : s[i] * (h[i] - ch * knock * (1 + r() * 0.4));
      row.push(new Vector3(q[0], q[1], q[2]).applyMatrix4(m));
    }
    V.push(row);
  }
  const idx = (s: number[]) => (s[0] > 0 ? 1 : 0) + (s[1] > 0 ? 2 : 0) + (s[2] > 0 ? 4 : 0);
  const n = new Vector3();
  const e1 = new Vector3();
  const e2 = new Vector3();
  const tri = (a: Vector3, b: Vector3, c: Vector3, col: RGBA) => {
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    const mx = (a.x + b.x + c.x) / 3 - ctr.x;
    const my = (a.y + b.y + c.y) / 3 - ctr.y;
    const mz = (a.z + b.z + c.z) / 3 - ctr.z;
    if (n.x * mx + n.y * my + n.z * mz < 0) out.tri(a, c, b, col);
    else out.tri(a, b, c, col);
  };
  const dark: RGBA = [rgba[0] * 0.82, rgba[1] * 0.82, rgba[2] * 0.82, rgba[3] * 0.6];
  // faces
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3;
    const c = (a + 2) % 3;
    for (const sa of [-1, 1]) {
      const q = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sb, sc]) => {
        const s = [0, 0, 0];
        s[a] = sa;
        s[b] = sb;
        s[c] = sc;
        return V[idx(s)][a];
      });
      tri(q[0], q[1], q[2], rgba);
      tri(q[0], q[2], q[3], rgba);
    }
  }
  // edge bevels
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 3; b++) {
      const c = 3 - a - b;
      for (const sa of [-1, 1])
        for (const sb of [-1, 1]) {
          const s0 = [0, 0, 0];
          const s1 = [0, 0, 0];
          s0[a] = s1[a] = sa;
          s0[b] = s1[b] = sb;
          s0[c] = -1;
          s1[c] = 1;
          const p0 = V[idx(s0)][a];
          const p1 = V[idx(s1)][a];
          const p2 = V[idx(s1)][b];
          const p3 = V[idx(s0)][b];
          const lit = (b === 1 && sb > 0) || (a === 1 && sa > 0);
          const col: RGBA = lit ? [rgba[0] * 1.12, rgba[1] * 1.12, rgba[2] * 1.12, rgba[3]] : dark;
          tri(p0, p1, p2, col);
          tri(p0, p2, p3, col);
        }
    }
  // corners
  for (let c = 0; c < 8; c++) tri(V[c][0], V[c][1], V[c][2], dark);
}

// ---- walls -----------------------------------------------------------------------------------

export interface Opening {
  /** centre along the wall, sill (bottom) height, width, height */
  u: number;
  y: number;
  w: number;
  h: number;
  /** arc radius as a fraction of the width (0.5 round; more: a flatter drop arch; ≤ 0.5 + tiny: pointed) */
  arch?: number;
  kind?: 'door' | 'window' | 'round';
}

export interface Wall {
  /** origin, the unit direction of u along the wall; the outward normal is u × y */
  o: V3;
  u: V3;
  outline: [number, number][];
  openings?: Opening[];
  /** where the stucco stays flat (the papers): wall (u, y) → 0..1 weight of the bulge */
  flat?: (u: number, y: number) => number;
}

/** An opening's outline (u, y), counter-clockwise from its bottom left. */
export function openingOutline(o: Opening, n = 10): [number, number][] {
  const { u, y, w, h } = o;
  if (o.kind === 'round') {
    const r = w / 2;
    return Array.from({ length: 20 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 20) * TAU;
      return [u + Math.cos(a) * r, y + r + Math.sin(a) * r] as [number, number];
    });
  }
  const R = Math.max(0.5, o.arch ?? 0.6) * w;
  const c = R - w / 2;
  const rise = Math.sqrt(R * R - c * c);
  const spring = y + h - rise;
  const pts: [number, number][] = [
    [u - w / 2, y],
    [u + w / 2, y],
  ];
  const ta = Math.acos(c / R);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * ta;
    pts.push([u - c + R * Math.cos(t), spring + R * Math.sin(t)]);
  }
  for (let i = n; i >= 0; i--) {
    const t = Math.PI - (i / n) * ta;
    pts.push([u + c + R * Math.cos(t), spring + R * Math.sin(t)]);
  }
  // drop the duplicate apex
  pts.splice(n + 3, 1);
  return pts;
}

function wallMatrix(w: Wall): Matrix4 {
  const U = new Vector3(...w.u);
  const Y = new Vector3(0, 1, 0);
  const N = new Vector3().crossVectors(U, Y);
  return new Matrix4().makeBasis(U, Y, N).setPosition(w.o[0], w.o[1], w.o[2]);
}

/** the shortest distance from (u, y) to the boxes of the wall's openings */
function openingDist(w: Wall, u: number, y: number): number {
  let d = 9;
  for (const o of w.openings ?? []) {
    const dx = Math.max(Math.abs(u - o.u) - o.w / 2, 0);
    const dy = Math.max(o.y - y, y - (o.y + o.h), 0);
    d = Math.min(d, Math.hypot(dx, dy));
  }
  return d;
}

const tess = new TessellateModifier(0.075, 14);

/**
 * One wall's outer face (tessellated, bulged a little, coloured: contact occlusion at the ground,
 * shade under the eaves, stains under the sills, patchy stucco) and its openings' reveals.
 */
function buildWall(out: Builder, jambs: Builder, w: Wall, seed: number, eaveY: number, frame: Matrix4 = HF, doorReveal?: Builder): void {
  const M = wallMatrix(w);
  const shape = new Shape(w.outline.map(([u, y]) => new Vector2(u, y)));
  for (const o of w.openings ?? []) shape.holes.push(new Path(openingOutline(o).map(([u, y]) => new Vector2(u, y))));
  const base = new ShapeGeometry(shape, 1);
  // the masonry canvas tiles every MASONRY units, offset per wall so no two walls repeat alike
  const uv = base.attributes.uv;
  const du = rand(seed, 'uv', 0);
  const dv = rand(seed, 'uv', 1);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / MASONRY + du, uv.getY(i) / MASONRY + dv);
  const g = tess.modify(base);
  base.dispose();
  const pos = g.attributes.position;
  const P = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const y = pos.getY(i);
    const near = smoothstep(0.015, 0.11, openingDist(w, u, y));
    const flat = w.flat ? w.flat(u, y) : 1;
    const bulge = (0.007 * fbm2(u * 4.2, y * 4.2, seed, 3) + 0.004 * fbm2(u * 13, y * 13, seed + 9, 2)) * near * flat;
    pos.setZ(i, bulge);
  }
  g.applyMatrix4(M);
  g.deleteAttribute('normal');
  const ig = mergeVertices(g, 1e-5);
  g.dispose();
  ig.computeVertexNormals();
  const Minv = new Matrix4().copy(M).invert();
  out.add(ig, null, (p) => {
    // back to wall (u, y) for the patterns
    const loc = P.copy(p).applyMatrix4(Minv);
    const u = loc.x;
    const y = loc.y;
    const hg = p.y + frame.elements[13] - groundUnder(p, frame);
    const contact = 0.42 + 0.58 * smoothstep(-0.02, 0.42, hg);
    const eave = 1 - 0.35 * smoothstep(eaveY - 0.32, eaveY + 0.05, y);
    let stain = 1;
    for (const o of w.openings ?? []) {
      if (o.kind === 'door') continue;
      const dx = Math.abs(u - o.u) / (o.w * 0.6);
      if (dx < 1 && y < o.y && y > o.y - 0.55) stain *= 1 - 0.22 * (1 - dx * dx) * (1 - (o.y - y) / 0.55);
    }
    const patch = 0.88 + 0.2 * fbm2(u * 1.7 + seed, y * 1.9, seed + 3, 3);
    const v = contact * eave * stain * patch;
    // warmer, mossier low down
    const low = 1 - smoothstep(0.0, 0.5, hg);
    return [v * (1 - 0.06 * low), v * (1 + 0.04 * low), v * (1 - 0.04 * low), 1];
  });
  ig.dispose();
  // the reveals: from the face back through the wall's thickness
  for (const o of w.openings ?? []) {
    const ol = openingOutline(o);
    for (let i = 0; i < ol.length; i++) {
      const a = ol[i];
      const b = ol[(i + 1) % ol.length];
      if (o.kind === 'door' && i === 0) continue;
      const A0 = new Vector3(a[0], a[1], 0).applyMatrix4(M);
      const B0 = new Vector3(b[0], b[1], 0).applyMatrix4(M);
      const Ab = new Vector3(a[0], a[1], -WALL_T).applyMatrix4(M);
      const Bb = new Vector3(b[0], b[1], -WALL_T).applyMatrix4(M);
      const top = a[1] > o.y + o.h * 0.6 ? 0.62 : 0.8;
      (o.kind === 'door' && doorReveal ? doorReveal : jambs).quad(A0, B0, Bb, Ab, [top, top, top * 0.95, 0.15]);
    }
  }
}

/**
 * A stone surround round an opening: voussoirs over the arch (a keystone at its crown), jamb
 * stones down the sides, all standing proud of the wall; and for windows a sill.
 */
function surround(out: Builder, w: Wall, o: Opening, seed: number, width: number, proud: number): void {
  const M = wallMatrix(w);
  const r = (k: number) => rand(seed, 'surround', k);
  let k = 0;
  const P = (u: number, y: number, d: number) => new Vector3(u, y, d).applyMatrix4(M);
  const stone = (q: [number, number][], d: number, rgba: RGBA) => {
    // a prism: front polygon q (counter-clockwise) at depth d, sides back to the wall
    const front = q.map(([u, y]) => P(u, y, d));
    const back = q.map(([u, y]) => P(u, y, -0.005));
    for (let i = 1; i < q.length - 1; i++) out.tri(front[0], front[i], front[i + 1], rgba);
    for (let i = 0; i < q.length; i++) {
      const j = (i + 1) % q.length;
      out.quad(back[i], back[j], front[j], front[i], [rgba[0] * 0.72, rgba[1] * 0.72, rgba[2] * 0.72, 0.06]);
    }
  };
  if (o.kind === 'round') {
    const R0 = o.w / 2;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + 0.02;
      const a1 = ((i + 1) / n) * TAU - 0.02;
      const R1 = R0 + width * (0.85 + 0.3 * r(k++));
      const cy = o.y + R0;
      const v = 0.85 + 0.3 * r(k++);
      stone(
        [
          [o.u + Math.cos(a0) * R0, cy + Math.sin(a0) * R0],
          [o.u + Math.cos(a0) * R1, cy + Math.sin(a0) * R1],
          [o.u + Math.cos(a1) * R1, cy + Math.sin(a1) * R1],
          [o.u + Math.cos(a1) * R0, cy + Math.sin(a1) * R0],
        ],
        proud * (0.8 + 0.4 * r(k++)),
        [v, v, v, 0.8],
      );
    }
    return;
  }
  const R = Math.max(0.5, o.arch ?? 0.6) * o.w;
  const c = R - o.w / 2;
  const rise = Math.sqrt(R * R - c * c);
  const spring = o.y + o.h - rise;
  const ta = Math.acos(c / R);
  // voussoirs: each side's arc split into stones, radiating from that arc's centre
  const nv = Math.max(3, Math.round((ta * R) / 0.07));
  for (const side of [1, -1]) {
    const cx = o.u - side * c;
    for (let i = 0; i < nv; i++) {
      const t0 = (i / nv) * ta + 0.012;
      const t1 = ((i + 1) / nv) * ta - (i === nv - 1 ? 0 : 0.012);
      const wd = width * (0.85 + 0.35 * r(k++));
      const ang = (t: number) => (side > 0 ? t : Math.PI - t);
      const pt = (t: number, rad: number): [number, number] => [cx + Math.cos(ang(t)) * rad, spring + Math.sin(ang(t)) * rad];
      const q: [number, number][] = [pt(t0, R + 0.004), pt(t0, R + wd), pt(t1, R + wd), pt(t1, R + 0.004)];
      const v = 0.82 + 0.3 * r(k++);
      stone(side > 0 ? q : (q.reverse() as [number, number][]), proud * (0.85 + 0.3 * r(k++)), [v, v * 0.98, v * 0.97, 0.8]);
    }
  }
  // the keystone at the crown
  const apex = o.y + o.h;
  const kw = width * 0.65;
  const kv = 0.95;
  stone(
    [
      [o.u - kw * 0.55, apex - 0.02],
      [o.u + kw * 0.55, apex - 0.02],
      [o.u + kw * 0.75, apex + width * 1.05],
      [o.u - kw * 0.75, apex + width * 1.05],
    ],
    proud * 1.35,
    [kv, kv, kv, 0.9],
  );
  // jamb stones down both sides, alternating long and short
  for (const side of [-1, 1]) {
    let y = o.y + (o.kind === 'door' ? 0.0 : 0.0);
    let i = 0;
    while (y < spring - 0.02) {
      const hh = Math.min(spring - y, (o.kind === 'door' ? 0.13 : 0.09) * (0.8 + 0.4 * r(k++)));
      const wd = width * (i % 2 ? 0.75 : 1.1) * (0.9 + 0.2 * r(k++));
      const x0 = o.u + side * (o.w / 2 + 0.003);
      const x1 = o.u + side * (o.w / 2 + wd);
      const q: [number, number][] = side > 0 ? [[x0, y + 0.006], [x1, y + 0.006], [x1, y + hh], [x0, y + hh]] : [[x1, y + 0.006], [x0, y + 0.006], [x0, y + hh], [x1, y + hh]];
      const v = 0.8 + 0.3 * r(k++);
      stone(q, proud * (0.75 + 0.35 * r(k++)), [v, v, v * 0.98, 0.8]);
      y += hh;
      i++;
    }
  }
  if (o.kind !== 'door') {
    // the sill: a slab under the window standing out of the wall
    const sw = o.w / 2 + width * 1.2;
    const sy = o.y;
    const P2 = (u: number, y: number, d: number) => new Vector3(u, y, d).applyMatrix4(M);
    const a = [P2(o.u - sw, sy - 0.045, 0), P2(o.u + sw, sy - 0.045, 0), P2(o.u + sw, sy - 0.045, proud * 2.2), P2(o.u - sw, sy - 0.045, proud * 2.2)];
    const b = [P2(o.u - sw, sy, 0), P2(o.u + sw, sy, 0), P2(o.u + sw, sy, proud * 2.2), P2(o.u - sw, sy, proud * 2.2)];
    const lit: RGBA = [1.05, 1.05, 1.05, 0.9];
    const dark: RGBA = [0.6, 0.6, 0.6, 0.5];
    out.quad(b[0], b[3], b[2], b[1], lit);
    out.quad(a[3], b[3], b[0], a[0], dark);
    out.quad(a[3], a[2], b[2], b[3], [0.8, 0.8, 0.8, 0.7]);
    out.quad(a[0], a[1], a[2], a[3], dark);
    out.quad(a[1], b[1], b[2], a[2], dark);
  }
}

/** A rectangular timber between two points (width across, depth along `side`). */
export function beam(out: Builder, a: Vector3, b: Vector3, w: number, d: number, up: Vector3, rgba: RGBA): void {
  const dir = b.clone().sub(a).normalize();
  const side = new Vector3().crossVectors(dir, up).normalize();
  const u = new Vector3().crossVectors(side, dir).normalize();
  const c = (p: Vector3, s: number, t: number) => p.clone().addScaledVector(side, s * d * 0.5).addScaledVector(u, t * w * 0.5);
  const A = [c(a, -1, -1), c(a, 1, -1), c(a, 1, 1), c(a, -1, 1)];
  const B = [c(b, -1, -1), c(b, 1, -1), c(b, 1, 1), c(b, -1, 1)];
  const dark: RGBA = [rgba[0] * 0.7, rgba[1] * 0.7, rgba[2] * 0.7, rgba[3] * 0.6];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    out.quad(A[i], B[i], B[j], A[j], i === 2 ? rgba : dark);
  }
  out.quad(A[0], A[1], A[2], A[3], dark);
  out.quad(B[3], B[2], B[1], B[0], dark);
}

/** Corner stones (quoins) up a corner: cut blocks alternately long on either face, standing proud. */
function quoins(out: Builder, corner: V3, faceA: V3, faceB: V3, y0: number, y1: number, seed: number, long = 0.17, short = 0.1): void {
  let y = y0;
  let i = 0;
  const A = new Vector3(...faceA);
  const B = new Vector3(...faceB);
  while (y < y1 - 0.04) {
    const h = Math.min(y1 - y, 0.12 + 0.07 * rand(seed, 'q', i));
    const la = (i % 2 ? short : long) * (0.9 + 0.2 * rand(seed, 'qa', i));
    const lb = (i % 2 ? long : short) * (0.9 + 0.2 * rand(seed, 'qb', i));
    // the block's frame: x along face A, y up, z along face B (whichever handedness the corner has)
    const m = new Matrix4().makeBasis(A, new Vector3(0, 1, 0), B);
    const c = new Vector3(...corner)
      .addScaledVector(A, la / 2 - 0.02)
      .addScaledVector(B, lb / 2 - 0.02)
      .add(new Vector3(0, y + h / 2, 0));
    m.setPosition(c);
    m.multiply(new Matrix4().makeRotationY((rand(seed, 'qr', i) - 0.5) * 0.06));
    const v = 0.85 + 0.3 * rand(seed, 'qv', i);
    cutStone(out, m, [la / 2, h * 0.47, lb / 2], 0.014 + 0.008 * rand(seed, 'qc', i), seed * 37 + i, [v, v * 0.98, v * 1.02, 0.45]);
    y += h;
    i++;
  }
}

// ---- roofs -----------------------------------------------------------------------------------

const SLATE_TINTS = [
  [1, 1, 1],
  [0.92, 0.95, 1.06],
  [1.06, 0.97, 1.0],
  [0.9, 1.02, 1.0],
  [1.1, 1.04, 1.02],
] as const;

function roofTiles(out: Builder, wood: Builder, g: Gable, seed: number, spec: Partial<ShingleSpec>, clip: (p: Vector3) => boolean = () => false): RoofPlane[] {
  const { planes } = gablePlanes(g);
  planes.forEach((pl, i) => {
    shingles(
      pl,
      {
        seed: seed * 7 + i,
        tileW: 0.19,
        exposure: 0.125,
        thickness: 0.024,
        kick: 0.02,
        ao: 0.62,
        edgeLight: 0.38,
        value: 0.22,
        tints: SLATE_TINTS,
        clip,
        ...spec,
      },
      out,
    );
    // the deck under the tiles (dark boards, seen at the eaves and through gaps)
    const n = new Vector3(...pl.along).cross(new Vector3(...pl.up)).normalize();
    const o = new Vector3(...pl.origin);
    const A = new Vector3(...pl.along).multiplyScalar(pl.width);
    const U = new Vector3(...pl.up).multiplyScalar(pl.length);
    const q = (a: number, b: number, h: number) => o.clone().addScaledVector(A, a).addScaledVector(U, b).addScaledVector(n, h);
    const dk: RGBA = [0.35, 0.33, 0.34, 0.3];
    wood.quad(q(0, 0, 0.004), q(1, 0, 0.004), q(1, 1, 0.004), q(0, 1, 0.004), dk);
    wood.quad(q(0, 0, -0.03), q(0, 1, -0.03), q(1, 1, -0.03), q(1, 0, -0.03), [0.25, 0.22, 0.24, 0.2]);
    // fascia: the deck's front edge
    wood.quad(q(0, 0, -0.03), q(1, 0, -0.03), q(1, 0, 0.004), q(0, 0, 0.004), [0.5, 0.45, 0.45, 0.4]);
  });
  return planes;
}

/** The hipped wing's shape: eave lines, which side of each hip line a point is on, its height. */
function hipShape(g: Hipped) {
  const { pitch } = gablePlanes(g);
  const oh = g.overhang ?? 0.12;
  const zc = (g.z0 + g.z1) / 2;
  const half = (g.z1 - g.z0) / 2;
  const xEL = g.x0 - oh;
  const xER = g.x1 + oh;
  const yE = g.eave - oh * Math.tan(pitch);
  const f = (p: Vector3) => Math.min(1, Math.abs(p.z - zc) / (half + oh));
  return {
    oh,
    zc,
    half,
    xEL,
    xER,
    yE,
    /** beyond the right / left hip line (in plan), by margin m */
    onR: (p: Vector3, m: number) => p.x > g.hipR + (xER - g.hipR) * f(p) + m,
    onL: (p: Vector3, m: number) => p.x < g.hipL - (g.hipL - xEL) * f(p) - m,
  };
}

/** Is p under the hipped wing's roof (its slopes and its hips)? */
function underHip(g: Hipped, p: Vector3, grow = 0): boolean {
  const { zc, half, oh, xEL, xER } = hipShape(g);
  if (p.x < xEL - grow || p.x > xER + grow) return false;
  const d = Math.abs(p.z - zc);
  if (d > half + oh + grow) return false;
  const rise = g.peak - g.eave;
  const side = g.peak - (d / half) * rise;
  const hr = g.peak - (Math.max(0, p.x - g.hipR) / (g.x1 - g.hipR)) * rise;
  const hl = g.peak - (Math.max(0, g.hipL - p.x) / (g.hipL - g.x0)) * rise;
  return p.y < Math.min(side, hr, hl) + grow;
}

/**
 * A side-gabled wing hipped at both ends: its two slopes (trapezoids, tiles clipped at the hip
 * lines), the two hips' triangles (tiles clipped to them), the decks under them, and big half-round
 * caps riding the four hip seams (the tiles' cut ends hide under them).
 */
function hippedTiles(out: Builder, wood: Builder, g: Hipped, seed: number, spec: Partial<ShingleSpec>, others: (p: Vector3) => boolean): void {
  const { planes } = gablePlanes(g);
  const { oh, zc, xEL, xER, yE, onR, onL } = hipShape(g);
  const base: ShingleSpec = { seed: 0, tileW: 0.19, exposure: 0.125, thickness: 0.024, kick: 0.02, ao: 0.62, edgeLight: 0.38, value: 0.22, tints: SLATE_TINTS, ...spec };
  const deck = (pl: RoofPlane, poly: [number, number][]) => {
    const n = new Vector3(...pl.along).cross(new Vector3(...pl.up)).normalize();
    const o = new Vector3(...pl.origin);
    const A = new Vector3(...pl.along);
    const U = new Vector3(...pl.up);
    const q = (a: number, b: number, h: number) => o.clone().addScaledVector(A, a).addScaledVector(U, b).addScaledVector(n, h);
    for (let i = 1; i < poly.length - 1; i++) {
      wood.tri(q(...poly[0], 0.004), q(...poly[i], 0.004), q(...poly[i + 1], 0.004), [0.35, 0.33, 0.34, 0.3]);
      wood.tri(q(...poly[0], -0.03), q(...poly[i + 1], -0.03), q(...poly[i], -0.03), [0.25, 0.22, 0.24, 0.2]);
    }
  };
  planes.forEach((pl, i) => {
    shingles(pl, { ...base, seed: seed * 7 + i, clip: (p) => onR(p, -0.025) || onL(p, -0.025) || others(p) }, out);
    const L = pl.length;
    const x0 = pl.origin[0];
    // the deck: the plane's rectangle cut at both hip lines (front runs +x, back runs −x)
    if (i === 0) deck(pl, [[xEL - x0, 0], [xER - x0, 0], [g.hipR - x0, L], [g.hipL - x0, L]]);
    else deck(pl, [[x0 - xER, 0], [x0 - xEL, 0], [x0 - g.hipL, L], [x0 - g.hipR, L]]);
  });
  const rise = g.peak - yE;
  const width = g.z1 - g.z0 + 2 * oh;
  // the right hip: from the right eave up to the ridge's right end
  {
    const run = xER - g.hipR;
    const len = Math.hypot(run, rise);
    const hip: RoofPlane = { origin: [xER, yE, g.z1 + oh], along: [0, 0, -1], up: [-run / len, rise / len, 0], width, length: len };
    shingles(hip, { ...base, seed: seed * 7 + 5, clip: (p) => !onR(p, 0.025) || others(p) }, out);
    deck(hip, [[0, 0], [width, 0], [width / 2, len]]);
  }
  // the left hip
  {
    const run = g.hipL - xEL;
    const len = Math.hypot(run, rise);
    const hip: RoofPlane = { origin: [xEL, yE, g.z0 - oh], along: [0, 0, 1], up: [run / len, rise / len, 0], width, length: len };
    shingles(hip, { ...base, seed: seed * 7 + 6, clip: (p) => !onL(p, 0.025) || others(p) }, out);
    deck(hip, [[0, 0], [width, 0], [width / 2, len]]);
  }
  const cap = (a: V3, b: V3, k: number) => ridgeCap(a, b, { seed: seed * 7 + k, radius: 0.085, piece: 0.16, rgba: [0.9, 0.9, 0.92, 0.85] }, out);
  cap([g.hipR, g.peak + 0.01, zc], [xER, yE + 0.01, g.z1 + oh], 8);
  cap([g.hipR, g.peak + 0.01, zc], [xER, yE + 0.01, g.z0 - oh], 9);
  cap([g.hipL, g.peak + 0.01, zc], [xEL, yE + 0.01, g.z1 + oh], 10);
  cap([g.hipL, g.peak + 0.01, zc], [xEL, yE + 0.01, g.z0 - oh], 11);
}

/** Bargeboards along a front gable's rakes (front verge), from the eaves to the apex. */
function bargeboards(wood: Builder, g: Gable, front = true): void {
  if (g.ridge !== 'z') return;
  const oh = g.overhang ?? 0.12;
  const vg = g.verge ?? 0.1;
  const xc = (g.x0 + g.x1) / 2;
  const half = (g.x1 - g.x0) / 2;
  const rise = g.peak - g.eave;
  const z = front ? g.z1 + vg - 0.012 : g.z0 - vg + 0.012;
  const yAt = (x: number) => g.peak - (Math.abs(x - xc) / half) * rise;
  const up = new Vector3(0, 0, 1);
  for (const s of [-1, 1]) {
    const xe = xc + s * (half + oh);
    const a = new Vector3(xe, yAt(xe) - 0.035, z);
    const b = new Vector3(xc, g.peak - 0.035, z);
    beam(wood, a, b, 0.075, 0.03, up, [0.95, 0.92, 0.92, 0.6]);
  }
}

// ---- the door, the room, windows ---------------------------------------------------------------

/** The arched plank door, built at the hinge's frame (x from the hinge, z its front at 0). */
function buildDoor(wood: Builder, iron: Builder): void {
  // the arch's top height at u (the opening's outline above the springing)
  const R = DOOR_ARCH * D.w;
  const c = R - D.w / 2;
  const rise = Math.sqrt(R * R - c * c);
  const spring = D.h - rise;
  const topAt = (u: number) => {
    const a = Math.abs(u);
    const dx = a + c;
    return spring + Math.sqrt(Math.max(0, R * R - dx * dx));
  };
  const gap = 0.006;
  const x0 = -D.w / 2 + gap;
  const x1 = D.w / 2 - gap;
  const planks = 6;
  const hx = HINGE[0];
  let k = 0;
  const r = () => rand(83, 'door', k++);
  let edges = [x0];
  for (let i = 1; i < planks; i++) edges.push(x0 + ((x1 - x0) * (i + (r() - 0.5) * 0.25)) / planks);
  edges.push(x1);
  edges = edges.sort((a, b) => a - b);
  for (let i = 0; i < planks; i++) {
    const a = edges[i] + 0.002;
    const b = edges[i + 1] - 0.002;
    const dz = (r() - 0.5) * 0.004;
    const v = 0.85 + 0.3 * r();
    const col: RGBA = [v, v * 0.97, v * 0.95, 1];
    const top = [b, (a * 2 + b) / 3 + (b - a) / 6, a].map((u) => [u, topAt(u) - gap] as [number, number]);
    const front: [number, number][] = [[a, gap], [b, gap], ...top];
    // front face (counter-clockwise from +z), at the hinge frame (x − hinge, z from the leaf front)
    const F = front.map(([u, y]) => new Vector3(u - hx, y, dz));
    const B = front.map(([u, y]) => new Vector3(u - hx, y, -LEAF_T));
    for (let j = 1; j < F.length - 1; j++) wood.tri(F[0], F[j], F[j + 1], col);
    for (let j = 1; j < B.length - 1; j++) wood.tri(B[0], B[j + 1], B[j], [0.6, 0.55, 0.55, 0.4]);
    for (let j = 0; j < F.length; j++) {
      const m = (j + 1) % F.length;
      wood.quad(B[j], B[m], F[m], F[j], [v * 0.55, v * 0.52, v * 0.5, 0.3]);
    }
  }
  // iron straps from the hinge side, with rivets, ending in a spear tip
  const strap = (y: number, len: number) => {
    const w = 0.034;
    const z0 = 0.004;
    const z1 = 0.011;
    const xa = x0 - hx + 0.004;
    const xb = xa + len;
    const q = (x: number, yy: number, z: number) => new Vector3(x, yy, z);
    const col: RGBA = [1, 1, 1, 0.5];
    iron.quad(q(xa, y - w / 2, z1), q(xb, y - w / 2, z1), q(xb, y + w / 2, z1), q(xa, y + w / 2, z1), col);
    iron.quad(q(xa, y - w / 2, z0), q(xb, y - w / 2, z0), q(xb, y - w / 2, z1), q(xa, y - w / 2, z1), [0.6, 0.6, 0.6, 0.3]);
    iron.quad(q(xa, y + w / 2, z1), q(xb, y + w / 2, z1), q(xb, y + w / 2, z0), q(xa, y + w / 2, z0), [0.6, 0.6, 0.6, 0.3]);
    // the spear tip
    iron.tri(q(xb, y - w / 2, z1), q(xb + w * 1.3, y, z1), q(xb, y + w / 2, z1), col);
    iron.tri(q(xb, y - w * 0.9, z1), q(xb + w * 0.35, y - w * 0.5, z1), q(xb, y - w / 2, z1), col);
    iron.tri(q(xb, y + w / 2, z1), q(xb + w * 0.35, y + w * 0.5, z1), q(xb, y + w * 0.9, z1), col);
    // rivets
    for (let i = 0; i < 5; i++) {
      const x = xa + 0.03 + ((len - 0.05) * i) / 4;
      const s = 0.006;
      iron.quad(q(x - s, y - s, z1 + 0.004), q(x + s, y - s, z1 + 0.004), q(x + s, y + s, z1 + 0.004), q(x - s, y + s, z1 + 0.004), [1.3, 1.3, 1.3, 0.5]);
    }
  };
  strap(0.2, D.w * 0.78);
  strap(0.92, D.w * 0.62);
  // the ring handle on its backplate
  const ring = new TorusGeometry(0.036, 0.0065, 6, 18);
  iron.add(ring, new Matrix4().makeTranslation(D.w / 2 - 0.12 - hx, 0.5, 0.016), [1.1, 1.1, 1.1, 0.6]);
  ring.dispose();
  const plate = (x: number, y: number, s: number) => {
    const z = 0.009;
    iron.quad(new Vector3(x - s, y - s, z), new Vector3(x + s, y - s, z), new Vector3(x + s, y + s, z), new Vector3(x - s, y + s, z), [0.9, 0.9, 0.9, 0.5]);
  };
  plate(D.w / 2 - 0.12 - hx, 0.536, 0.022);
}

/**
 * The cyan wall lantern hanging from an iron bracket off the door wing's front-left corner: an iron
 * cage with a mid bar on each pane, a flared pointed cap with a ball and spike, a drop below, the
 * glowing glass; `s` scales it about its glass centre `at`.
 */
function wallLantern(iron: Builder, glass: Builder, at: Vector3, s: number, corner: Vector3): void {
  const w = 0.066 * s;
  const hb = 0.21 * s;
  const y0 = at.y - hb / 2;
  const y1 = at.y + hb / 2;
  const c = at;
  const corner3 = (sx: number, sz: number, y: number, k = 1) => new Vector3(c.x + sx * w * k, y, c.z + sz * w * k);
  const col: RGBA = [1, 1, 1, 0.12];
  const P4 = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const;
  // glass box (four panes), tapering down a little
  const g0 = P4.map(([a, b]) => corner3(a, b, y0, 0.66));
  const g1 = P4.map(([a, b]) => corner3(a, b, y1, 0.95));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    glass.tri(g0[i], g1[i], g1[j], [1, 1, 1, 0], [[0, 0], [0, 1], [1, 1]]);
    glass.tri(g0[i], g1[j], g0[j], [1, 1, 1, 0], [[0, 0], [1, 1], [1, 0]]);
  }
  // corner posts, rails and a mid bar on each pane
  const up = new Vector3(0, 1, 0);
  const t = 0.012 * s;
  for (const [a, b] of P4) beam(iron, corner3(a, b, y0 - 0.02 * s, 0.7), corner3(a, b, y1 + 0.01 * s, 1), t * 1.8, t * 1.8, new Vector3(1, 0, 0), col);
  for (const [y, k] of [[y0, 0.7], [y1, 1]] as const)
    for (let i = 0; i < 4; i++) beam(iron, corner3(P4[i][0], P4[i][1], y, k), corner3(P4[(i + 1) % 4][0], P4[(i + 1) % 4][1], y, k), t * 1.6, t * 1.6, up, col);
  for (let i = 0; i < 4; i++) {
    const a = P4[i];
    const b = P4[(i + 1) % 4];
    beam(iron, corner3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, y0, 0.68), corner3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, y1, 0.97), t, t, new Vector3(1, 0, 0), col);
  }
  // the cap: a flared pyramid in two steps, a ball and a spike
  const capA = P4.map(([a, b]) => corner3(a, b, y1, 1.4));
  const capB = P4.map(([a, b]) => corner3(a, b, y1 + 0.035 * s, 0.75));
  const capTop = new Vector3(c.x, y1 + 0.095 * s, c.z);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    iron.quad(capA[j], capA[i], capB[i], capB[j], [1, 1, 1, 0.5]);
    iron.tri(capB[j], capB[i], capTop, [1, 1, 1, 0.5]);
    iron.quad(capA[i], capA[j], g1[j], g1[i], [0.6, 0.6, 0.6, 0.2]);
  }
  iron.add(new SphereGeometry(0.014 * s, 6, 4), new Matrix4().makeTranslation(c.x, y1 + 0.095 * s, c.z), col);
  // the bottom: an inverted pyramid with a drop
  const bot0 = P4.map(([a, b]) => corner3(a, b, y0, 0.8));
  const bot = new Vector3(c.x, y0 - 0.06 * s, c.z);
  for (let i = 0; i < 4; i++) iron.tri(bot0[i], bot0[(i + 1) % 4], bot, col);
  // the bracket: an arm out of the corner (under the eave), a hanger down to the cap's ball, a
  // scrolled brace under the arm, a plate on the corner stones
  const top = y1 + 0.095 * s + 0.03;
  const arm0 = new Vector3(corner.x + 0.01, top, corner.z - 0.01);
  const arm1 = new Vector3(c.x - 0.02, top, c.z);
  beam(iron, arm0, arm1, 0.022, 0.018, up, col);
  beam(iron, arm1, new Vector3(c.x - 0.02, y1 + 0.08 * s, c.z), 0.01, 0.01, new Vector3(1, 0, 0), col);
  const pts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((k) => {
    const a = (k * Math.PI) / 2;
    return new Vector3().lerpVectors(arm0, arm1, Math.sin(a) * 0.75).add(new Vector3(0, -0.17 * Math.cos(a), 0));
  });
  for (let i = 0; i < 5; i++) beam(iron, pts[i], pts[i + 1], 0.013, 0.013, new Vector3(0, 0, 1), col);
  beam(iron, new Vector3(corner.x - 0.012, top - 0.22, corner.z + 0.012), new Vector3(corner.x - 0.012, top + 0.03, corner.z + 0.012), 0.05, 0.016, new Vector3(-1, 0, 1).normalize(), col);
}

/** A red paper lantern's body: a ribbed sphere (12 ribs), a little squashed; centred at the origin. */
function lanternBody(out: Builder, m: Matrix4): void {
  const R = 0.1;
  const H = 0.09;
  const nu = 36;
  const nv = 12;
  const P = (iu: number, iv: number) => {
    const t = iu / nu;
    const th = t * TAU;
    const s = 0.12 + (iv / nv) * 0.76;
    const phi = s * Math.PI;
    const rib = 1 - 0.07 * Math.pow(Math.abs(Math.sin(th * 6)), 0.5);
    const rr = R * Math.sin(phi) * rib + 0.012;
    return new Vector3(Math.cos(th) * rr, -Math.cos(phi) * H, Math.sin(th) * rr).applyMatrix4(m);
  };
  for (let iv = 0; iv < nv; iv++)
    for (let iu = 0; iu < nu; iu++) {
      const shade = 0.75 + 0.35 * Math.sin(((iv + 0.5) / nv) * Math.PI);
      const col: RGBA = [shade, shade, shade, 0.7];
      out.quad(P(iu, iv), P(iu, iv + 1), P(iu + 1, iv + 1), P(iu + 1, iv), col);
    }
}

function redLanterns(paper: Builder, gold: Builder, iron: Builder): void {
  for (const [x, y, z] of DOOR_FRONT.lanterns) {
    const m = new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationY(x * 3));
    lanternBody(paper, m);
    // gold caps top and bottom (a lip and a band)
    for (const s of [1, -1]) {
      const cap = new CylinderGeometry(0.046, 0.05, 0.026, 14, 1);
      gold.add(cap, new Matrix4().makeTranslation(x, y + s * 0.092, z), [1, 1, 1, 0.6]);
      cap.dispose();
      const lip = new CylinderGeometry(0.03, 0.03, 0.012, 12, 1);
      gold.add(lip, new Matrix4().makeTranslation(x, y + s * 0.11, z), [1.1, 1.1, 1.1, 0.6]);
      lip.dispose();
    }
    // the tassel: a knot, a bead and a bundle of cords
    const knot = new SphereGeometry(0.014, 8, 6);
    gold.add(knot, new Matrix4().makeTranslation(x, y - 0.128, z), [1.2, 1.1, 1, 0.5]);
    knot.dispose();
    const bundle = new CylinderGeometry(0.008, 0.02, 0.1, 10, 1, true);
    gold.add(bundle, new Matrix4().makeTranslation(x, y - 0.19, z), [0.95, 0.85, 0.7, 0.3]);
    bundle.dispose();
    // the cord up to the porch beam, and the hook it hangs from
    const top = y + 0.117;
    beam(gold, new Vector3(x, top, z), new Vector3(x + 0.004, PORCH_BEAM_Y - 0.03, z), 0.013, 0.013, new Vector3(1, 0, 0), [0.8, 0.55, 0.45, 0.3]);
    const hook = new TorusGeometry(0.016, 0.004, 5, 10);
    iron.add(hook, new Matrix4().makeTranslation(x + 0.004, PORCH_BEAM_Y - 0.03, z).multiply(new Matrix4().makeRotationY(0.4)), [0.8, 0.8, 0.8, 0.3]);
    hook.dispose();
  }
}
const PORCH_BEAM_Y = 1.47;

/** World units per repeat of the wall's masonry canvas. */
const MASONRY = 2.0;

/** The masonry canvases as repeating textures (colour sRGB, height linear). */
function masonryTextures(): { map: CanvasTexture; bump: CanvasTexture } {
  const { color, bump } = masonryCanvas();
  const map = new CanvasTexture(color);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.anisotropy = 8;
  const b = new CanvasTexture(bump);
  b.colorSpace = LinearSRGBColorSpace;
  b.wrapS = b.wrapT = RepeatWrapping;
  return { map, bump: b };
}

/**
 * The walls' masonry (colour and height, tiling): rubble stone in uneven courses with dark mortar,
 * each stone its own tint with a lit upper edge, patches of old stucco over it with peeled edges,
 * grime streaks and grit. Seeded, drawn once.
 */
function masonryCanvas(): { color: HTMLCanvasElement; bump: HTMLCanvasElement } {
  const N = 1024;
  const r = seq(57, 'masonry');
  const a = canvas(N, N);
  const b = canvas(N, N);
  const g = a.g;
  const q = b.g;
  g.fillStyle = '#33343c';
  g.fillRect(0, 0, N, N);
  q.fillStyle = 'rgb(46,46,46)';
  q.fillRect(0, 0, N, N);
  const tones = ['#6d6878', '#736b74', '#625f72', '#78717c', '#5d5867', '#6a6874', '#6f6670'];
  // wrapped drawing: a shape near an edge is drawn again on the other side
  const wrap = (fn: (dx: number, dy: number) => void, x: number, y: number, w: number, h: number) => {
    for (const dx of [-N, 0, N])
      for (const dy of [-N, 0, N]) {
        if (x + dx + w < 0 || x + dx > N || y + dy + h < 0 || y + dy > N) continue;
        fn(dx, dy);
      }
  };
  const rows: number[] = [];
  let tot = 0;
  while (tot < N) {
    const h = 40 + r() * 34;
    rows.push(h);
    tot += h;
  }
  const k = N / tot;
  let y = 0;
  for (const h0 of rows) {
    const h = h0 * k;
    let x = -r() * 90;
    while (x < N) {
      const w = 64 + r() * 120;
      const gap = 2.5 + r() * 2.5;
      // an irregular, angular block: a box with its corners knocked off at random, jittered
      const hw = w / 2 - gap;
      const hh = h / 2 - gap;
      const ck = () => 0.12 + r() * 0.3;
      const k1 = ck();
      const k2 = ck();
      const k3 = ck();
      const k4 = ck();
      const cxs = x + w / 2;
      const cys = y + h / 2;
      const raw: [number, number][] = [
        [-hw, -hh * (1 - k1)],
        [-hw * (1 - k1), -hh],
        [hw * (1 - k2), -hh],
        [hw, -hh * (1 - k2)],
        [hw, hh * (1 - k3)],
        [hw * (1 - k3), hh],
        [-hw * (1 - k4), hh],
        [-hw, hh * (1 - k4)],
      ];
      const pts: [number, number][] = raw.map(([px, py]) => [cxs + px + (r() - 0.5) * 6, cys + py + (r() - 0.5) * 5]);
      const tone = tones[Math.floor(r() * tones.length)];
      const lift = 150 + Math.floor(r() * 70);
      const shade = 0.9 + r() * 0.2;
      wrap(
        (dx, dy) => {
          g.save();
          g.translate(dx, dy);
          g.fillStyle = tone;
          g.globalAlpha = 1;
          g.beginPath();
          pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
          g.closePath();
          g.fill();
          // value variation, a lit upper edge and a shaded lower one
          g.fillStyle = shade > 1 ? `rgba(255,240,240,${(shade - 1) * 0.6})` : `rgba(10,5,10,${(1 - shade) * 0.8})`;
          g.fill();
          g.clip();
          const lg = g.createLinearGradient(0, y, 0, y + h);
          lg.addColorStop(0, 'rgba(225,215,225,0.22)');
          lg.addColorStop(0.3, 'rgba(225,215,225,0)');
          lg.addColorStop(0.75, 'rgba(15,8,14,0)');
          lg.addColorStop(1, 'rgba(15,8,14,0.35)');
          g.fillStyle = lg;
          g.fillRect(x - 10, y - 10, w + 20, h + 20);
          g.restore();
          q.save();
          q.translate(dx, dy);
          q.fillStyle = `rgb(${lift},${lift},${lift})`;
          q.beginPath();
          pts.forEach(([px, py], i) => (i ? q.lineTo(px, py) : q.moveTo(px, py)));
          q.closePath();
          q.fill();
          q.restore();
        },
        x,
        y,
        w,
        h,
      );
      x += w;
    }
    y += h;
  }
  // stucco patches over the rubble, their edges peeled
  for (let i = 0; i < 16; i++) {
    const cx = r() * N;
    const cy = r() * N;
    const R = 70 + r() * 170;
    const pts: [number, number][] = [];
    const n = 22;
    for (let j = 0; j < n; j++) {
      const t = (j / n) * Math.PI * 2;
      const rr = R * (0.65 + 0.35 * r()) * (1 + 0.25 * Math.sin(t * 3 + i));
      pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * 0.8]);
    }
    const tone = r() < 0.5 ? '#77737f' : '#6e6a76';
    wrap(
      (dx, dy) => {
        g.save();
        g.translate(dx, dy);
        g.beginPath();
        pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py)));
        g.closePath();
        g.fillStyle = tone;
        g.fill();
        g.strokeStyle = 'rgba(160,150,158,0.5)';
        g.lineWidth = 3;
        g.stroke();
        g.restore();
        q.save();
        q.translate(dx, dy);
        q.beginPath();
        pts.forEach(([px, py], j) => (j ? q.lineTo(px, py) : q.moveTo(px, py)));
        q.closePath();
        q.fillStyle = 'rgb(176,176,176)';
        q.fill();
        q.restore();
      },
      cx - R,
      cy - R,
      R * 2,
      R * 2,
    );
  }
  // grit, and grime streaks running down
  for (let i = 0; i < 3500; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? `rgba(20,12,18,${0.1 + 0.2 * r()})` : `rgba(200,190,198,${0.05 + 0.12 * r()})`;
    const s = 1 + r() * 3;
    g.fillRect(r() * N, r() * N, s, s);
  }
  for (let i = 0; i < 14; i++) {
    const x = r() * N;
    const w = 8 + r() * 40;
    const lg = g.createLinearGradient(0, 0, 0, N);
    lg.addColorStop(0, 'rgba(25,15,22,0)');
    lg.addColorStop(0.5, `rgba(25,15,22,${0.08 + 0.12 * r()})`);
    lg.addColorStop(1, 'rgba(25,15,22,0)');
    g.fillStyle = lg;
    g.fillRect(x, 0, w, N);
  }
  return { color: a.c, bump: b.c };
}

/** The lantern's glass glow: a hot core round the flame, falling off to cyan at the panes' edges. */
function lanternCanvas(): HTMLCanvasElement {
  const W = 64;
  const H = 128;
  const { c, g } = canvas(W, H);
  const grd = g.createRadialGradient(W * 0.5, H * 0.56, 2, W * 0.5, H * 0.52, H * 0.6);
  grd.addColorStop(0, 'rgb(255,255,255)');
  grd.addColorStop(0.25, 'rgb(215,248,255)');
  grd.addColorStop(1, 'rgb(60,150,170)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  return c;
}

/** The window glow: a soft hot centre low in the glass, darker leaded panes toward the edges. */
function windowGlowCanvas(): HTMLCanvasElement {
  const W = 128;
  const H = 256;
  const { c, g } = canvas(W, H);
  const grd = g.createRadialGradient(W * 0.5, H * 0.66, 4, W * 0.5, H * 0.6, H * 0.62);
  grd.addColorStop(0, 'rgb(255,255,255)');
  grd.addColorStop(0.35, 'rgb(205,235,240)');
  grd.addColorStop(1, 'rgb(70,120,130)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // leaded quarries: diamond lines
  g.strokeStyle = 'rgba(10,18,22,0.75)';
  g.lineWidth = 3;
  for (let i = -6; i <= 6; i++) {
    g.beginPath();
    g.moveTo(i * 26, 0);
    g.lineTo(i * 26 + H * 0.5, H);
    g.stroke();
    g.beginPath();
    g.moveTo(W - i * 26, 0);
    g.lineTo(W - i * 26 - H * 0.5, H);
    g.stroke();
  }
  // a curtain edge on one side, a plant's silhouette on the sill
  g.fillStyle = 'rgba(12,30,36,0.55)';
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(W * 0.3, H * 0.4, W * 0.12, H);
  g.lineTo(0, H);
  g.fill();
  return c;
}

/** The back wall of the room: a dim teal room, an inner doorway glowing cyan, a warm glow low left. */
function roomCanvas(): HTMLCanvasElement {
  const W = 320;
  const H = 260;
  const { c, g } = canvas(W, H);
  const r = seq(91, 'room');
  g.fillStyle = '#0b1d24';
  g.fillRect(0, 0, W, H);
  // the warm glow (a candle on a low table, left)
  const warm = g.createRadialGradient(W * 0.2, H * 0.62, 2, W * 0.2, H * 0.62, W * 0.3);
  warm.addColorStop(0, 'rgba(255,170,90,0.9)');
  warm.addColorStop(0.3, 'rgba(150,80,50,0.45)');
  warm.addColorStop(1, 'rgba(60,30,30,0)');
  g.fillStyle = warm;
  g.fillRect(0, 0, W, H);
  // the cyan glow spilling from the inner doorway (the screen's light in the next room)
  const cool = g.createRadialGradient(W * 0.62, H * 0.6, 6, W * 0.62, H * 0.55, W * 0.55);
  cool.addColorStop(0, 'rgba(90,190,205,0.5)');
  cool.addColorStop(0.4, 'rgba(30,95,112,0.32)');
  cool.addColorStop(1, 'rgba(10,30,40,0)');
  g.fillStyle = cool;
  g.fillRect(0, 0, W, H);
  // the inner doorway itself
  const dx = W * 0.52;
  const dw = W * 0.2;
  const dh = H * 0.62;
  const door = g.createLinearGradient(0, H - dh, 0, H);
  door.addColorStop(0, 'rgb(40,105,120)');
  door.addColorStop(0.55, 'rgb(70,150,165)');
  door.addColorStop(1, 'rgb(110,190,200)');
  g.fillStyle = door;
  g.beginPath();
  g.moveTo(dx, H);
  g.lineTo(dx, H - dh + dw * 0.5);
  g.arc(dx + dw / 2, H - dh + dw * 0.5, dw / 2, Math.PI, 0);
  g.lineTo(dx + dw, H);
  g.fill();
  // the floor line, a shelf with jars, a picture frame: dark shapes against the glow
  g.fillStyle = 'rgba(6,12,16,0.9)';
  g.fillRect(0, H * 0.9, W, H * 0.1);
  g.fillRect(W * 0.06, H * 0.42, W * 0.32, H * 0.025);
  for (let i = 0; i < 5; i++) {
    const x = W * (0.08 + i * 0.06 + r() * 0.02);
    const h = H * (0.05 + r() * 0.05);
    g.fillRect(x, H * 0.42 - h, W * 0.035, h);
  }
  g.strokeStyle = 'rgba(6,12,16,0.85)';
  g.lineWidth = 5;
  g.strokeRect(W * 0.12, H * 0.14, W * 0.18, H * 0.18);
  return c;
}

// ---- the house -------------------------------------------------------------------------------

/** the room inside the door wing (house-local): inside its walls, the back wall at z0 */
const ROOM = { x0: DOOR_WING.x0 + WALL_T, x1: DOOR_WING.x1 - WALL_T, z0: -1.0, h: 1.3 };
/** the owls on the tall wing's ridge: x, turn, size */
const OWLS: [number, number, number][] = [
  [1.2, 0.35, 1.0],
  [1.47, -0.3, 0.86],
];

interface HouseGeos {
  walls: BufferGeometry;
  stones: BufferGeometry;
  reveal: BufferGeometry;
  roof: BufferGeometry;
  wood: BufferGeometry;
  iron: BufferGeometry;
  glass: BufferGeometry;
  lanternGlass: BufferGeometry;
  eyes: BufferGeometry;
  paper: BufferGeometry;
  gold: BufferGeometry;
  room: BufferGeometry;
  cap: BufferGeometry;
  decal: BufferGeometry;
  doorWood: BufferGeometry;
  doorIron: BufferGeometry;
  stats: Record<string, number>;
}

/** The window openings per wall. */
const WIN = {
  doorWingLeft: { u: -0.62, y: 0.55, w: 0.2, h: 0.5, arch: 0.55 } as Opening,
  tallFront: { u: 1.78, y: 0.44, w: 0.2, h: 0.7, arch: 0.53 } as Opening,
  tallRight: { u: 0.875, y: 0.5, w: 0.24, h: 0.66, arch: 0.55 } as Opening,
  tallBack: { u: -1.3, y: 0.62, w: 0.2, h: 0.5, arch: 0.55 } as Opening,
  bayFront: { u: 1.23, y: 0.38, w: 0.17, h: 0.44, arch: 0.52 } as Opening,
};

/** The house's footprint in plan (house-local x, z), counter-clockwise seen from above. */
const FOOTPRINT: [number, number][] = [
  [DOOR_WING.x0, DOOR_WING.z1],
  [DOOR_WING.x1, DOOR_WING.z1],
  [DOOR_WING.x1, TALL_WING.z1],
  [BAY.x0, TALL_WING.z1],
  [BAY.x0, BAY.z1],
  [BAY.x1, BAY.z1],
  [BAY.x1, TALL_WING.z1],
  [TALL_WING.x1, TALL_WING.z1],
  [TALL_WING.x1, TALL_WING.z0],
  [TALL_WING.x0, TALL_WING.z0],
  [TALL_WING.x0, DOOR_WING.z0],
  [DOOR_WING.x0, DOOR_WING.z0],
];

/** Signed distance (plan) to the footprint: negative inside. */
function footprintDistance(x: number, z: number): number {
  let d = Infinity;
  let inside = false;
  const n = FOOTPRINT.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, zi] = FOOTPRINT[i];
    const [xj, zj] = FOOTPRINT[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    const ex = xj - xi;
    const ez = zj - zi;
    const t = clamp(((x - xi) * ex + (z - zi) * ez) / (ex * ex + ez * ez), 0, 1);
    d = Math.min(d, Math.hypot(x - xi - ex * t, z - zi - ez * t));
  }
  return inside ? -d : d;
}

function buildHouse(): HouseGeos {
  const walls = new Builder();
  const stones = new Builder();
  const reveal = new Builder();
  const roof = new Builder();
  const wood = new Builder();
  const iron = new Builder();
  const glass = new Builder();
  const lanternGlass = new Builder();
  const eyes = new Builder();
  const paper = new Builder();
  const gold = new Builder();
  const room = new Builder();
  const doorWood = new Builder();
  const doorIron = new Builder();
  const B = -0.45;
  const dw = DOOR_WING;
  const tw = TALL_WING;
  const bay = BAY;
  const dwc = (dw.x0 + dw.x1) / 2;
  const door: Opening = { u: 0, y: 0, w: D.w, h: D.h, arch: DOOR_ARCH, kind: 'door' };
  // the papers' rectangles on the door wing's front: the stucco stays flat there
  const flatFront = (u: number, y: number) => (Math.abs(u) < 0.56 && y < 1.42 ? 0 : smoothstep(0.56, 0.62, Math.abs(u)) + smoothstep(1.42, 1.52, y));
  const W: { wall: Wall; eave: number; seed: number }[] = [
    // the door wing
    { wall: { o: [0, 0, 0], u: [1, 0, 0], outline: [[dw.x0, B], [dw.x1, B], [dw.x1, dw.eave], [dwc, dw.peak], [dw.x0, dw.eave]], openings: [door], flat: (u, y) => clamp(flatFront(u, y), 0, 1) }, eave: dw.eave, seed: 1 },
    { wall: { o: [dw.x0, 0, 0], u: [0, 0, 1], outline: [[dw.z0, B], [dw.z1, B], [dw.z1, dw.eave], [dw.z0, dw.eave]], openings: [WIN.doorWingLeft] }, eave: dw.eave, seed: 2 },
    { wall: { o: [dw.x1, 0, 0], u: [0, 0, -1], outline: [[-dw.z1, B], [-tw.z1 + 0.02, B], [-tw.z1 + 0.02, dw.eave], [-dw.z1, dw.eave]] }, eave: dw.eave, seed: 3 },
    { wall: { o: [0, 0, dw.z0], u: [-1, 0, 0], outline: [[-dw.x1, B], [-dw.x0, B], [-dw.x0, dw.eave], [-dwc, dw.peak], [-dw.x1, dw.eave]] }, eave: dw.eave, seed: 4 },
    // the tall wing (hipped: plain walls to the eaves all round)
    { wall: { o: [0, 0, tw.z1], u: [1, 0, 0], outline: [[tw.x0, B], [tw.x1, B], [tw.x1, tw.eave], [tw.x0, tw.eave]], openings: [WIN.tallFront] }, eave: tw.eave, seed: 5 },
    { wall: { o: [tw.x1, 0, 0], u: [0, 0, -1], outline: [[-tw.z1, B], [-tw.z0, B], [-tw.z0, tw.eave], [-tw.z1, tw.eave]], openings: [WIN.tallRight] }, eave: tw.eave, seed: 6 },
    { wall: { o: [tw.x0, 0, 0], u: [0, 0, 1], outline: [[tw.z0, B], [tw.z1, B], [tw.z1, tw.eave], [tw.z0, tw.eave]] }, eave: tw.eave, seed: 7 },
    { wall: { o: [0, 0, tw.z0], u: [-1, 0, 0], outline: [[-tw.x1, B], [-tw.x0, B], [-tw.x0, tw.eave], [-tw.x1, tw.eave]], openings: [WIN.tallBack] }, eave: tw.eave, seed: 8 },
    // the bay
    { wall: { o: [0, 0, bay.z1], u: [1, 0, 0], outline: [[bay.x0, B], [bay.x1, B], [bay.x1, bay.eave], [(bay.x0 + bay.x1) / 2, bay.peak], [bay.x0, bay.eave]], openings: [WIN.bayFront] }, eave: bay.eave, seed: 9 },
    { wall: { o: [bay.x0, 0, 0], u: [0, 0, 1], outline: [[tw.z1 - 0.02, B], [bay.z1, B], [bay.z1, bay.eave], [tw.z1 - 0.02, bay.eave]] }, eave: bay.eave, seed: 10 },
    { wall: { o: [bay.x1, 0, 0], u: [0, 0, -1], outline: [[-bay.z1, B], [-tw.z1 + 0.02, B], [-tw.z1 + 0.02, bay.eave], [-bay.z1, bay.eave]] }, eave: bay.eave, seed: 11 },
  ];
  for (const { wall, eave, seed } of W) {
    buildWall(walls, stones, wall, seed * 17, eave, HF, reveal);
    // the door's jamb stones stay narrow: the couplets sit flat on the wall beside them
    for (const o of wall.openings ?? []) surround(stones, wall, o, seed * 5 + o.u * 10, 0.034, o.kind === 'door' ? 0.03 : 0.02);
  }
  // corner stones
  const qs: [V3, V3, V3, number, number][] = [
    [[dw.x0, 0, dw.z1], [1, 0, 0], [0, 0, -1], dw.eave, 0.15],
    [[dw.x1, 0, dw.z1], [-1, 0, 0], [0, 0, -1], dw.eave, 0.12],
    [[dw.x0, 0, dw.z0], [1, 0, 0], [0, 0, 1], dw.eave, 0.17],
    [[tw.x1, 0, tw.z1], [-1, 0, 0], [0, 0, -1], tw.eave, 0.12],
    [[tw.x1, 0, tw.z0], [-1, 0, 0], [0, 0, 1], tw.eave, 0.17],
    [[bay.x0, 0, bay.z1], [1, 0, 0], [0, 0, -1], bay.eave, 0.12],
    [[bay.x1, 0, bay.z1], [-1, 0, 0], [0, 0, -1], bay.eave, 0.12],
  ];
  qs.forEach(([c, a, b, top, long], i) => quoins(stones, c, a, b, -0.3, top, 40 + i, long, long * 0.6));
  // the plinth: rough cut stones along the fronts, half buried (not at the door: the step is there)
  const plinth = (x0: number, x1: number, z: number, seed: number) => {
    let x = x0;
    let i = 0;
    while (x < x1 - 0.06) {
      const w = Math.min(x1 - x, 0.15 + 0.13 * rand(seed, 'pl', i));
      const h = 0.15 + 0.08 * rand(seed, 'ph', i);
      const m = new Matrix4()
        .makeTranslation(x + w / 2, -0.07 + h * 0.2, z + 0.025)
        .multiply(new Matrix4().makeRotationY((rand(seed, 'py', i) - 0.5) * 0.12))
        .multiply(new Matrix4().makeRotationZ((rand(seed, 'pz', i) - 0.5) * 0.08));
      const v = 0.72 + 0.28 * rand(seed, 'pv', i);
      cutStone(stones, m, [w * 0.5, h * 0.5, 0.055], 0.018, seed * 31 + i, [v, v * 0.98, v * 1.02, 0.35], 0.6);
      x += w + 0.004;
      i++;
    }
  };
  plinth(dw.x0 + 0.1, -0.4, dw.z1, 61);
  plinth(0.4, dw.x1 - 0.1, dw.z1, 62);
  plinth(dw.x1, bay.x0, tw.z1, 63);
  plinth(bay.x0 + 0.1, bay.x1 - 0.1, bay.z1, 64);
  plinth(bay.x1 + 0.02, tw.x1 - 0.12, tw.z1, 65);
  // the step at the door: a worn slab, its top at the door's floor
  cutStone(stones, new Matrix4().makeTranslation(0, -0.085, 0.16).multiply(new Matrix4().makeRotationY(0.02)), [0.38, 0.09, 0.15], 0.028, 71, [0.95, 0.94, 0.97, 0.5], 0.4);
  // exposed rubble where the stucco has fallen: patches of small cut stones standing a little proud
  const rubble = (wall: Wall, u0: number, y0: number, cols: number, rows: number, seed: number) => {
    const M = wallMatrix(wall);
    for (let j = 0; j < rows; j++) {
      let u = u0 + (j % 2) * 0.04;
      for (let i = 0; i < cols; i++) {
        if (rand(seed, 'rb', j * 31 + i) < 0.25) {
          u += 0.09;
          continue;
        }
        const w = 0.08 + 0.05 * rand(seed, 'rw', j * 31 + i);
        const h = 0.05 + 0.03 * rand(seed, 'rh', j * 31 + i);
        const m = M.clone().multiply(new Matrix4().makeTranslation(u + w / 2, y0 + j * 0.068 + h / 2, 0.004)).multiply(new Matrix4().makeRotationZ((rand(seed, 'rz', j * 31 + i) - 0.5) * 0.1));
        const v = 0.7 + 0.3 * rand(seed, 'rv', j * 31 + i);
        cutStone(stones, m, [w / 2 - 0.003, h / 2 - 0.003, 0.014], 0.008, seed * 7 + j * 31 + i, [v * 1.02, v, v * 0.97, 0.3], 0.8);
        u += w + 0.006;
      }
    }
  };
  rubble(W[0].wall, -0.6, 1.6, 4, 3, 81);
  rubble(W[4].wall, 1.5, 1.2, 3, 4, 82);
  rubble(W[5].wall, 0.35, 0.08, 4, 3, 83);

  // windows: glass set back in the reveal, a wooden mullion and transom, Y tracery; their light
  const windowLights: Practical[] = [];
  const glassAt = (wall: Wall, o: Opening) => {
    const M = wallMatrix(wall);
    const ol = openingOutline(o, 8);
    const pts = ol.map(([u, y]) => new Vector3(u, y, -0.07).applyMatrix4(M));
    const uvs = ol.map(([u, y]) => [(u - o.u + o.w / 2) / o.w, (y - o.y) / o.h] as const);
    const cIdx = new Vector3(o.u, o.y + o.h * 0.4, -0.07).applyMatrix4(M);
    for (let i = 0; i < pts.length; i++) glass.tri(cIdx, pts[i], pts[(i + 1) % pts.length], [1, 1, 1, 0], [[0.5, 0.4], uvs[i], uvs[(i + 1) % pts.length]]);
    windowLights.push({ p: new Vector3(o.u, o.y + o.h * 0.45, 0.05).applyMatrix4(M), c: [0.3, 0.85, 1.0], power: 0.008 * (o.w / 0.2), r0: 0.06, reach: 0.5 });
    const n = new Vector3(...wall.u).cross(new Vector3(0, 1, 0));
    const col: RGBA = [0.8, 0.78, 0.78, 0.3];
    beam(wood, new Vector3(o.u, o.y, -0.05).applyMatrix4(M), new Vector3(o.u, o.y + o.h - 0.01, -0.05).applyMatrix4(M), 0.02, 0.026, n, col);
    const ty = o.y + o.h * 0.5;
    beam(wood, new Vector3(o.u - o.w / 2, ty, -0.05).applyMatrix4(M), new Vector3(o.u + o.w / 2, ty, -0.05).applyMatrix4(M), 0.018, 0.026, n, col);
    const R = Math.max(0.5, o.arch ?? 0.6) * o.w;
    const c = R - o.w / 2;
    const spring = o.y + o.h - Math.sqrt(R * R - c * c);
    for (const s of [-1, 1]) beam(wood, new Vector3(o.u, spring + 0.01, -0.052).applyMatrix4(M), new Vector3(o.u + (s * o.w) / 2.05, spring + (o.h - (spring - o.y)) * 0.15 + 0.02, -0.052).applyMatrix4(M), 0.014, 0.022, n, col);
  };
  for (const { wall } of W) for (const o of wall.openings ?? []) if (o.kind !== 'door') glassAt(wall, o);

  // the roofs
  const tileSpec = { tileW: 0.25, exposure: 0.16, thickness: 0.03, kick: 0.03, ao: 0.74, edgeLight: 0.8, value: 0.3 };
  roofTiles(roof, wood, dw, 1, tileSpec, (p) => underHip(tw, p, 0.012) || underGable(bay, p, 0.012));
  hippedTiles(roof, wood, tw, 2, tileSpec, (p) => underGable(dw, p, 0.012) || underGable(bay, p, 0.012));
  roofTiles(roof, wood, bay, 3, { tileW: 0.15, exposure: 0.1, thickness: 0.016 }, (p) => underHip(tw, p, 0.012));
  roofTiles(roof, wood, PORCH, 4, { tileW: 0.15, exposure: 0.1, thickness: 0.016 });
  // painted light on the roofs: dark at the eaves, lifting toward the ridges where the low moon
  // behind grazes over them (each roof by its own eave and peak), so the slopes read as planes
  {
    const roofsLit: Gable[] = [dw, tw, bay, PORCH];
    roof.shade((p) => {
      let k = 0;
      for (const g of roofsLit) if (underGable(g, p, 0.2) || (g === tw && underHip(tw, p, 0.2))) k = Math.max(k, smoothstep(g.eave - 0.2, g.peak, p.y));
      return 0.72 + 0.6 * k * k;
    });
  }
  bargeboards(wood, dw);
  bargeboards(wood, bay);
  bargeboards(wood, PORCH);
  // ridges: caps, iron cresting, finials on the two peaks
  const cap: RGBA = [0.9, 0.9, 0.92, 0.85];
  const crest = { spacing: 0.135, jitter: 0.4, height: 0.19, heightJitter: 0.3, width: 0.035, lift: 0.045, lean: 0.14 };
  const fin = (p: V3, h: number, s: number, along: 'x' | 'z') =>
    finial({ seed: s, height: h, radius: 0.024, scrolls: h > 0.28 ? 2 : 0 }, iron, new Matrix4().makeTranslation(p[0], p[1] + 0.02, p[2]).multiply(new Matrix4().makeRotationY(along === 'z' ? Math.PI / 2 : 0)));
  {
    // the door wing's ridge, front to back, its finial on the front apex
    const [a, b] = gablePlanes(dw).ridge;
    ridgeCap(a, b, { seed: 100, radius: 0.05, piece: 0.15, rgba: cap }, roof);
    cresting([a[0], a[1] + 0.04, a[2] + 0.12], [b[0], b[1] + 0.04, b[2] - 0.12], { seed: 110, ...crest }, iron);
    fin(b, 0.36, 120, 'z');
    fin(a, 0.2, 121, 'z');
  }
  {
    // the tall wing's short ridge between its hips, crested between two finials (gaps for the owls)
    const zc = (tw.z0 + tw.z1) / 2;
    const a: V3 = [tw.hipL, tw.peak, zc];
    const b: V3 = [tw.hipR, tw.peak, zc];
    ridgeCap(a, b, { seed: 101, radius: 0.05, piece: 0.15, rgba: cap }, roof);
    const owlGap = (t: number) => OWLS.some(([x]) => Math.abs(a[0] + t - x) < 0.07);
    cresting([a[0] + 0.06, a[1] + 0.04, a[2]], [b[0] - 0.05, b[1] + 0.04, b[2]], { seed: 111, ...crest, skip: owlGap }, iron);
    fin(a, 0.34, 122, 'x');
    fin(b, 0.28, 123, 'x');
  }
  {
    const [a0, b] = gablePlanes(bay).ridge;
    const a: V3 = [a0[0], a0[1], -0.36];
    ridgeCap(a, b, { seed: 102, radius: 0.04, piece: 0.15, rgba: cap }, roof);
    cresting([a[0], a[1] + 0.035, a[2]], [b[0], b[1] + 0.035, b[2] - 0.1], { seed: 112, ...crest, height: 0.14, width: 0.03 }, iron);
    fin(b, 0.24, 124, 'z');
  }
  {
    const [a0, b] = gablePlanes(PORCH).ridge;
    ridgeCap([a0[0], a0[1], 0.02], b, { seed: 103, radius: 0.036, piece: 0.15, rgba: cap }, roof);
    fin(b, 0.15, 125, 'z');
  }
  // the chimney: a crooked stack of cut blocks on the tall wing's back slope, a cap slab, two pots
  {
    let y = 2.0;
    let x = 1.4;
    let z = -1.2;
    for (let i = 0; i < 3; i++) {
      const h = [0.42, 0.34, 0.3][i];
      const m = new Matrix4()
        .makeTranslation(x, y + h / 2, z)
        .multiply(new Matrix4().makeRotationZ([0.05, -0.08, 0.06][i]))
        .multiply(new Matrix4().makeRotationY([0.05, -0.1, 0.12][i]));
      cutStone(stones, m, [0.1 - i * 0.006, h / 2, 0.095 - i * 0.005], 0.016, 140 + i, [0.85, 0.82, 0.84, 0.7], 0.5);
      y += h - 0.02;
      x += [-0.025, 0.035, -0.01][i];
      z += [0.01, -0.012, 0.01][i];
    }
    cutStone(stones, new Matrix4().makeTranslation(x, y + 0.02, z), [0.13, 0.024, 0.12], 0.01, 150, [1, 1, 1, 0.8], 0.4);
    for (const [dx, h] of [[-0.05, 0.13], [0.055, 0.1]] as const) {
      const pot = new CylinderGeometry(0.032, 0.04, h, 8, 1, false);
      stones.add(pot, new Matrix4().makeTranslation(x + dx, y + 0.04 + h / 2, z).multiply(new Matrix4().makeRotationZ(dx * 1.5)), [0.75, 0.62, 0.58, 0.7]);
      pot.dispose();
    }
  }
  // the porch hood's timber: outriggers from the wall with curved braces, the beam the lanterns hang from
  {
    const col: RGBA = [0.9, 0.85, 0.85, 0.6];
    const up = new Vector3(0, 1, 0);
    for (const s of [-1, 1]) {
      const x = s * 0.4;
      beam(wood, new Vector3(x, 1.5, -0.02), new Vector3(x, 1.5, PORCH.z1 + 0.04), 0.06, 0.05, up, col);
      const pts = [0, 0.33, 0.66, 1].map((t) => {
        const a = (t * Math.PI) / 2;
        return new Vector3(x, 1.5 - 0.3 * Math.cos(a) - 0.02, 0.0 + 0.3 * Math.sin(a) + 0.005);
      });
      for (let i = 0; i < 3; i++) beam(wood, pts[i], pts[i + 1], 0.042, 0.04, new Vector3(1, 0, 0).cross(pts[i + 1].clone().sub(pts[i])).normalize().negate(), col);
    }
    beam(wood, new Vector3(-0.66, PORCH_BEAM_Y, DOOR_FRONT.lanterns[0][2]), new Vector3(0.66, PORCH_BEAM_Y, DOOR_FRONT.lanterns[0][2]), 0.045, 0.045, up, col);
    // the porch's front gable: vertical boards in the triangle over a tie beam, a pendant at the apex
    const zf = PORCH.z1 + 0.02;
    const pc = (PORCH.x0 + PORCH.x1) / 2;
    const half = (PORCH.x1 - PORCH.x0) / 2;
    const yAt = (x: number) => PORCH.peak - (Math.abs(x - pc) / half) * (PORCH.peak - PORCH.eave) - 0.05;
    beam(wood, new Vector3(PORCH.x0 - 0.02, PORCH.eave - 0.03, zf), new Vector3(PORCH.x1 + 0.02, PORCH.eave - 0.03, zf), 0.06, 0.05, up, col);
    const nb = 9;
    for (let i = 0; i < nb; i++) {
      const xa = PORCH.x0 + ((PORCH.x1 - PORCH.x0) * i) / nb + 0.004;
      const xb = PORCH.x0 + ((PORCH.x1 - PORCH.x0) * (i + 1)) / nb - 0.004;
      const ya = yAt(xa);
      const yb = yAt(xb);
      const y0 = PORCH.eave;
      const v = 0.82 + 0.25 * rand(4, 'board', i);
      const bc: RGBA = [v, v * 0.96, v * 0.94, 0.5];
      if (Math.min(ya, yb) <= y0 + 0.01) continue;
      wood.quad(new Vector3(xa, y0, zf), new Vector3(xb, y0, zf), new Vector3(xb, yb, zf), new Vector3(xa, ya, zf), bc);
      wood.quad(new Vector3(xb, y0, zf - 0.02), new Vector3(xa, y0, zf - 0.02), new Vector3(xa, ya, zf - 0.02), new Vector3(xb, yb, zf - 0.02), [0.5, 0.45, 0.45, 0.2]);
    }
    beam(wood, new Vector3(pc, PORCH.peak - 0.04, zf + 0.02), new Vector3(pc, PORCH.eave + 0.08, zf + 0.02), 0.03, 0.03, new Vector3(1, 0, 0), col);
  }
  redLanterns(paper, gold, iron);
  // the cyan wall lantern on its bracket off the door wing's front-left corner
  wallLantern(iron, lanternGlass, WALL_LANTERN, LANTERN_SCALE, new Vector3(dw.x0, 0, dw.z1));

  // the crooked warp over everything static above the porch eave (the owls go on after it)
  for (const b of [walls, stones, roof, wood, iron, glass, lanternGlass]) b.warp(crooked);
  // the warp moved the window glass: its light follows
  for (const L of windowLights) crooked(L.p);

  // two owls on the tall wing's ridge, placed on the warped ridge (never warped again)
  const owl = (x: number, turn: number, s: number) => {
    const base = new Vector3(x, tw.peak + 0.05, (tw.z0 + tw.z1) / 2);
    crooked(base);
    const m = new Matrix4().makeTranslation(base.x, base.y, base.z).multiply(new Matrix4().makeRotationY(turn)).multiply(new Matrix4().makeScale(s, s, s));
    const add = (g: BufferGeometry, mm: Matrix4, rgba: RGBA, to: Builder = wood) => {
      to.add(g, m.clone().multiply(mm), rgba);
      g.dispose();
    };
    const body: RGBA = [0.62, 0.58, 0.6, 0.7];
    add(new SphereGeometry(0.05, 10, 8), new Matrix4().makeTranslation(0, 0.05, 0).multiply(new Matrix4().makeScale(1, 1.25, 0.9)), body);
    add(new SphereGeometry(0.04, 10, 8), new Matrix4().makeTranslation(0, 0.13, 0.004).multiply(new Matrix4().makeScale(1.05, 0.9, 0.95)), body);
    for (const sx of [-1, 1]) {
      add(new CylinderGeometry(0.0, 0.012, 0.035, 4, 1), new Matrix4().makeTranslation(sx * 0.024, 0.17, 0).multiply(new Matrix4().makeRotationZ(-sx * 0.35)), body);
      add(new SphereGeometry(0.011, 8, 6), new Matrix4().makeTranslation(sx * 0.016, 0.135, 0.034), [1, 1, 1, 0], eyes);
    }
    add(new CylinderGeometry(0.0, 0.007, 0.018, 4, 1), new Matrix4().makeTranslation(0, 0.12, 0.04).multiply(new Matrix4().makeRotationX(Math.PI)), [0.5, 0.45, 0.4, 0.3]);
  };
  for (const [x, turn, sc] of OWLS) owl(x, turn, sc);

  // the room behind the door (MeshBasic, drawn before the dig cap): walls and ceiling lit cyan from
  // the inner doorway and warm low on the left, dark plank floor, a table with a candle, a chair, a dresser
  {
    const { x0, x1, z0, h } = ROOM;
    const zf = -WALL_T;
    const c = (x: number, y: number, z: number): RGBA => {
      const back = smoothstep(zf, z0, z);
      const cyan = 0.18 + 0.36 * back * smoothstep(x0, x1, x + 0.2) * (1 - 0.5 * smoothstep(0.3, h, y));
      const warm = 0.3 * smoothstep(0.7, 0.2, y) * smoothstep(x1, x0, x) * back;
      return [0.04 + 0.45 * warm + 0.08 * cyan, 0.07 + 0.2 * warm + 0.3 * cyan, 0.09 + 0.08 * warm + 0.36 * cyan, 1];
    };
    const q = (a: V3, b: V3, cc: V3, d: V3) => room.quad(a, b, cc, d, [c(...a), c(...b), c(...cc), c(...d)]);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const za = zf + ((z0 - zf) * i) / n;
      const zb = zf + ((z0 - zf) * (i + 1)) / n;
      q([x0, h, zb], [x1, h, zb], [x1, h, za], [x0, h, za]);
      q([x0, 0, zb], [x0, h, zb], [x0, h, za], [x0, 0, za]);
      q([x1, 0, za], [x1, h, za], [x1, h, zb], [x1, 0, zb]);
    }
    // the threshold stone under the door, then floor planks running back into the room
    room.quad([-D.w / 2, 0.004, 0.0], [D.w / 2, 0.004, 0.0], [D.w / 2, 0.004, zf], [-D.w / 2, 0.004, zf], [0.16, 0.16, 0.18, 1]);
    const planks = 7;
    for (let i = 0; i < planks; i++) {
      const xa = x0 + ((x1 - x0) * i) / planks + 0.003;
      const xb = x0 + ((x1 - x0) * (i + 1)) / planks - 0.003;
      const v = 0.75 + 0.5 * rand(92, 'plank', i);
      const lit = (x: number, z: number): RGBA => {
        const k = c(x, 0, z);
        return [k[0] * 0.7 * v, k[1] * 0.62 * v, k[2] * 0.6 * v, 1];
      };
      room.quad([xa, 0.004, zf], [xb, 0.004, zf], [xb, 0.004, z0], [xa, 0.004, z0], [lit(xa, zf), lit(xb, zf), lit(xb, z0), lit(xa, z0)]);
    }
    // furniture: dark boxes catching a little cyan on the faces toward the inner doorway
    const box = (bx0: number, bx1: number, by0: number, by1: number, bz0: number, bz1: number, v = 1) => {
      const dark: RGBA = [0.03 * v, 0.045 * v, 0.055 * v, 1];
      const lit: RGBA = [0.05 * v, 0.12 * v, 0.14 * v, 1];
      const top: RGBA = [0.06 * v, 0.1 * v, 0.11 * v, 1];
      const p = (x: number, y: number, z: number): V3 => [x, y, z];
      room.quad(p(bx0, by0, bz1), p(bx1, by0, bz1), p(bx1, by1, bz1), p(bx0, by1, bz1), dark);
      room.quad(p(bx1, by0, bz1), p(bx1, by0, bz0), p(bx1, by1, bz0), p(bx1, by1, bz1), lit);
      room.quad(p(bx0, by0, bz0), p(bx0, by0, bz1), p(bx0, by1, bz1), p(bx0, by1, bz0), dark);
      room.quad(p(bx0, by1, bz1), p(bx1, by1, bz1), p(bx1, by1, bz0), p(bx0, by1, bz0), top);
    };
    // the table at the back left (clear of the door's swing), a candle on it
    const tx0 = x0 + 0.03;
    const tx1 = x0 + 0.33;
    const tz0 = z0 + 0.03;
    const tz1 = z0 + 0.24;
    box(tx0, tx1, 0.37, 0.4, tz0, tz1);
    for (const [lx, lz] of [[tx0 + 0.02, tz0 + 0.02], [tx1 - 0.04, tz0 + 0.02], [tx0 + 0.02, tz1 - 0.04], [tx1 - 0.04, tz1 - 0.04]]) box(lx, lx + 0.022, 0, 0.37, lz, lz + 0.022);
    const cx = (tx0 + tx1) / 2 + 0.05;
    const cz = (tz0 + tz1) / 2;
    box(cx - 0.012, cx + 0.012, 0.4, 0.47, cz - 0.012, cz + 0.012, 6);
    room.quad([cx - 0.008, 0.47, cz + 0.013], [cx + 0.008, 0.47, cz + 0.013], [cx + 0.005, 0.51, cz + 0.013], [cx - 0.005, 0.51, cz + 0.013], [1.4, 0.95, 0.5, 1]);
    // a chair right of the middle, its back to the door
    const chx = 0.12;
    const chz = -0.62;
    box(chx, chx + 0.16, 0.22, 0.25, chz, chz + 0.16);
    for (const [lx, lz] of [[chx, chz], [chx + 0.14, chz], [chx, chz + 0.14], [chx + 0.14, chz + 0.14]]) box(lx, lx + 0.02, 0, 0.22, lz, lz + 0.02);
    box(chx, chx + 0.16, 0.25, 0.55, chz + 0.14, chz + 0.16);
    // a dresser against the back wall, right
    box(x1 - 0.3, x1 - 0.02, 0, 0.56, z0 + 0.01, z0 + 0.17, 0.9);
    box(x1 - 0.32, x1, 0.56, 0.59, z0 + 0.0, z0 + 0.19, 1.1);
  }

  // the door, at its hinge's frame
  buildDoor(doorWood, doorIron);

  const out: Record<string, BufferGeometry> = {};
  const stats: Record<string, number> = {};
  for (const [k, b] of Object.entries({ walls, stones, reveal, roof, wood, iron, glass, lanternGlass, eyes, paper, gold, room, doorWood, doorIron })) {
    out[k] = b.geometry();
    stats[k] = b.triangles;
  }
  // the baked practical light on everything near the lanterns and windows
  for (const k of ['walls', 'stones', 'reveal', 'roof', 'wood', 'gold']) bakeGlow(out[k], windowLights);
  // the iron takes the red lanterns' light only (the cyan lantern's own cage would glow grey)
  bakeGlow(out.iron, windowLights, undefined, LANTERN_LIGHTS.slice(1));
  const leaf = new Matrix4().makeTranslation(HINGE[0], HINGE[1], HINGE[2] + LEAF_T);
  for (const k of ['doorWood', 'doorIron']) bakeGlow(out[k], windowLights, leaf);
  // the paper lanterns glow themselves: brightest at the equator between the ribs, dim at the caps
  setGlow(out.paper, 'aGlow', (p) => {
    let best = RED_LANTERNS[0];
    for (const L of RED_LANTERNS) if (L.distanceToSquared(p) < best.distanceToSquared(p)) best = L;
    const dy = (p.y - best.y) / 0.09;
    const th = Math.atan2(p.z - best.z, p.x - best.x) + best.x * 3;
    const between = Math.pow(Math.abs(Math.sin(th * 6)), 0.5);
    const k = (0.15 + 0.85 * (1 - dy * dy)) * (0.45 + 0.55 * between) * 0.8;
    return [k, k * 0.17, k * 0.04];
  });
  setGlow(out.paper, 'aGlowW', () => [0, 0, 0]);
  const cap0 = digCap();
  const decal = contactDecal();
  stats.cap = cap0.index ? cap0.index.count / 3 : 0;
  stats.decal = decal.index ? decal.index.count / 3 : 0;
  return { ...(out as unknown as Omit<HouseGeos, 'stats' | 'cap' | 'decal'>), cap: cap0, decal, stats };
}

/**
 * The dig: a depth-only surface laid just over the terrain inside the door wing (and the door's
 * reveal), drawn after the room and before the world, so ground that rises above the house's floor
 * never shows through the doorway: the room drawn before it shows instead. Inert where the ground
 * is below the floor (the floor is nearer, the cap fails its depth test).
 */
function digCap(): BufferGeometry {
  const x0 = ROOM.x0 - 0.02;
  const x1 = ROOM.x1 + 0.02;
  const z0 = ROOM.z0 - 0.02;
  const z1 = 0.0;
  const nx = Math.ceil((x1 - x0) / 0.04);
  const nz = Math.ceil((z1 - z0) / 0.04);
  const pos: number[] = [];
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const z = z0 + ((z1 - z0) * j) / nz;
      pos.push(x, surfaceUnder(x, z) + 0.015, z);
    }
  const idx: number[] = [];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Contact shade on the ground round the house's foot: dark at the walls, gone 0.2 out. */
function contactDecal(): BufferGeometry {
  const step = 0.04;
  const grow = 0.22;
  const xs = FOOTPRINT.map((p) => p[0]);
  const zs = FOOTPRINT.map((p) => p[1]);
  const x0 = Math.min(...xs) - grow;
  const x1 = Math.max(...xs) + grow;
  const z0 = Math.min(...zs) - grow;
  const z1 = Math.max(...zs) + grow;
  const nx = Math.ceil((x1 - x0) / step);
  const nz = Math.ceil((z1 - z0) / step);
  const pos: number[] = [];
  const col: number[] = [];
  const dist: number[] = [];
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const z = z0 + ((z1 - z0) * j) / nz;
      const d = footprintDistance(x, z);
      dist.push(d);
      pos.push(x, surfaceUnder(x, z) + 0.012, z);
      // lighter in the door's yard (the actors' ground keeps its value), darkest in the corners
      const yard = smoothstep(0.5, 0.3, Math.abs(x)) * smoothstep(-0.05, 0.1, z);
      const a = 0.55 * (1 - smoothstep(0.0, grow, Math.max(d, 0))) * (1 - 0.6 * yard);
      col.push(1, 1, 1, a);
    }
  const idx: number[] = [];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const q = [a, a + 1, a + nx + 1, a + nx + 2];
      // keep cells that touch the band outside the walls
      if (q.every((k) => dist[k] < -0.02) || q.every((k) => dist[k] > grow)) continue;
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(pos.map((_, i) => (i % 3 === 1 ? 1 : 0))), 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** A soft round glow (white, alpha falling off): the lantern's halo card. */
function haloCanvas(): HTMLCanvasElement {
  const N = 128;
  const { c, g } = canvas(N, N);
  g.clearRect(0, 0, N, N);
  const grd = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, N, N);
  return c;
}

/** A sheet of paper glued on: a subdivided plane with a low wrinkle, its base at z 0 (house-local by m). */
function paperSheet(w: number, h: number, seed: number, m: Matrix4): BufferGeometry {
  const g = new PlaneGeometry(w, h, 6, Math.max(2, Math.round((h / w) * 6)));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, 0.0018 * fbm2(p.getX(i) * 30, p.getY(i) * 30, seed, 2) + 0.0014);
  g.computeVertexNormals();
  g.applyMatrix4(m);
  return g;
}

export interface HouseProps {
  /** the door: 0 shut .. 1 swung 100° into the room */
  doorOpen?: number;
  /** the windows' and the room's glow, 0..1 */
  windows?: number;
  /** the film frame (reserved for flicker; the house is otherwise static) */
  f?: number;
}

/** The last house in its frame (houseFrame), the door at the local origin. */
export function House({ doorOpen = 0, windows = 1 }: HouseProps) {
  const { fonts, ready } = useFilmFonts();
  const geos = useMemo(buildHouse, []);
  const glowTex = useMemo(() => {
    const t = new CanvasTexture(windowGlowCanvas());
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  const roomTex = useMemo(() => {
    const t = new CanvasTexture(roomCanvas());
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  const wallTex = useMemo(() => masonryTextures(), []);
  const lanternTex = useMemo(() => {
    const t = new CanvasTexture(lanternCanvas());
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  const haloTex = useMemo(() => {
    const t = new CanvasTexture(haloCanvas());
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  const mats = useMemo(() => {
    // the cottage holds its value in the mid-ground haze, as in the reference (the castle behind is hazed)
    const fog = 0.5;
    const walls = glowMaterial({ kind: 'stone', color: '#ffffff', color2: '#4a4250', map: wallTex.map, bumpMap: wallTex.bump, bumpScale: 2.0, breakup: 0.16, scale: 0.22, bump: 0.5, topCoat: 0.2, vertexColors: true, rim: 0.8, fog });
    const stones = glowMaterial({ kind: 'stone', color: '#8a8794', color2: '#5e5a68', breakup: 0.2, scale: 0.06, bump: 0.35, topCoat: 0.15, vertexColors: true, rim: 0.4, fog, ambient: 0.85 });
    const roof = glowMaterial({ kind: 'stone', color: '#575166', color2: '#3d3848', breakup: 0.22, scale: 0.07, bump: 0.55, vertexColors: true, rim: 1.1, roughness: 0.7, fog });
    const wood = glowMaterial({ kind: 'wood', color: '#54424a', color2: '#36282e', breakup: 0.3, scale: 0.1, bump: 0.8, vertexColors: true, rim: 0.6, fog });
    const iron = glowMaterial({ kind: 'iron', color: '#2a2a31', metalness: 0.45, roughness: 0.5, breakup: 0.12, scale: 0.04, bump: 0.3, vertexColors: true, rim: 1.1, fog });
    const glass = storybookMaterial({ color: '#04090c', emissive: '#7fe4f2', emissiveMap: glowTex, emissiveIntensity: 2.2, roughness: 0.25, fog: 0.4, rim: 0, ambient: 0, breakup: 0 });
    const lanternGlass = storybookMaterial({ color: '#04090c', emissive: '#86ecff', emissiveMap: lanternTex, emissiveIntensity: 2.6, roughness: 0.25, fog: 0.3, rim: 0, ambient: 0, breakup: 0 });
    const eyes = storybookMaterial({ color: '#000000', emissive: '#ffd35a', emissiveIntensity: 2.6, fog: 0.5, rim: 0, ambient: 0, breakup: 0 });
    const paper = glowMaterial({ kind: 'cloth', color: '#8f2a27', color2: '#5e1a1c', breakup: 0.18, scale: 0.05, vertexColors: true, rim: 0.4, roughness: 0.8, fog }, 0);
    const gold = glowMaterial({ kind: 'iron', color: '#a8843c', metalness: 0.65, roughness: 0.42, breakup: 0.1, scale: 0.03, vertexColors: true, rim: 0.5, fog });
    const room = new MeshBasicMaterial({ vertexColors: true });
    const roomBack = new MeshBasicMaterial({ map: roomTex });
    const cap = new MeshBasicMaterial({ colorWrite: false });
    const decal = storybookMaterial({ color: '#000000', vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, rim: 0, ambient: 0, breakup: 0, fog: 0.5 });
    const doorWood = glowMaterial({ kind: 'wood', color: '#4e464f', color2: '#2d2830', breakup: 0.34, scale: 0.07, bump: 1.0, vertexColors: true, rim: 0.5, fog });
    const doorIron = glowMaterial({ kind: 'iron', color: '#1e1f24', metalness: 0.55, roughness: 0.45, breakup: 0.1, scale: 0.04, bump: 0.3, vertexColors: true, rim: 0.4, fog });
    const halo = new SpriteMaterial({ map: haloTex, color: '#6fdcf2', blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 });
    return { walls, stones, roof, wood, iron, glass, lanternGlass, eyes, paper, gold, room, roomBack, cap, decal, doorWood, doorIron, halo };
  }, [glowTex, roomTex, wallTex, lanternTex, haloTex]);
  const fu = useRedPaper('fu', fonts.cjk, ready, 11);
  const upper = useRedPaper('upper', fonts.cjk, ready, 12);
  const lower = useRedPaper('lower', fonts.cjk, ready, 13);
  const horizontal = useRedPaper('horizontal', fonts.cjk, ready, 14);
  const paperMats = useMemo(
    () =>
      [fu, upper, lower, horizontal].map(({ map, bumpMap, inkMap }) =>
        // the gold ink catches the lanterns' light a little (gold leaf), the paper does not glow
        glowMaterial({ color: '#ffffff', map, bumpMap, bumpScale: 1.5, alphaTest: 0.5, roughness: 0.82, breakup: 0.06, scale: 0.04, rim: 0.2, emissive: GOLD_INK, emissiveMap: inkMap, emissiveIntensity: 0.24 }),
      ),
    [fu, upper, lower, horizontal],
  );
  const paperGeos = useMemo(() => {
    const c = DOOR_FRONT.couplet;
    const hp = DOOR_FRONT.hengpi;
    const at = (x: number, y: number, z: number, rz: number) => new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeRotationZ(rz));
    // the couplets: 上联 on the left, 下联 on the right (the 横批 reads left to right); flat on the wall
    const upperG = paperSheet(c.w, c.h, 2, at(-c.x, c.y, 0.002, 0.012));
    const lowerG = paperSheet(c.w, c.h, 5, at(c.x, c.y, 0.002, -0.01));
    const hengpiG = paperSheet(hp.w, hp.h, 3, at(0, hp.y, 0.002, 0.008));
    // the 福 on the door leaf (its group's frame: x from the hinge, z from the leaf's front)
    const fuG = paperSheet(DOOR_FRONT.fu.size, DOOR_FRONT.fu.size, 1, at(-HINGE[0], DOOR_FRONT.fu.y, 0.004, Math.PI / 4));
    const none: Practical[] = [];
    for (const g of [upperG, lowerG, hengpiG]) bakeGlow(g, none);
    bakeGlow(fuG, none, new Matrix4().makeTranslation(HINGE[0], HINGE[1], HINGE[2] + LEAF_T));
    return { fu: fuG, upper: upperG, lower: lowerG, hengpi: hengpiG };
  }, []);
  useLayoutEffect(
    () => () => {
      Object.values(geos).forEach((g) => (g instanceof BufferGeometry ? g.dispose() : null));
      Object.values(mats).forEach((m) => m.dispose());
      Object.values(paperGeos).forEach((g) => g.dispose());
      glowTex.dispose();
      roomTex.dispose();
      wallTex.map.dispose();
      wallTex.bump.dispose();
      lanternTex.dispose();
      haloTex.dispose();
    },
    [geos, mats, paperGeos, glowTex, roomTex, wallTex, lanternTex, haloTex],
  );
  useLayoutEffect(() => () => paperMats.forEach((m) => m.dispose()), [paperMats]);
  const k = clamp(windows, 0, 1);
  const open = clamp(doorOpen, 0, 1);
  // the glows follow `windows`; the door leaf, swung into the dark room, loses the moon's rim, the
  // lanterns' light and some of the night's ambient as it opens
  useLayoutEffect(() => {
    (mats.glass as MeshStandardMaterial).emissiveIntensity = 2.2 * k;
    mats.room.color.setScalar(0.3 + 0.7 * k);
    mats.roomBack.color.setScalar(0.3 + 0.7 * k);
    for (const m of [mats.walls, mats.stones, mats.roof, mats.wood, mats.iron, mats.gold]) (m.userData.glow as GlowUniforms).uGlowWin.value = k;
    const shut = 1 - open;
    for (const [m, rim] of [[mats.doorWood, 0.5], [mats.doorIron, 0.4], [paperMats[0], 0.2]] as const) {
      (m.userData.sb as { uSbRimMul: { value: number } }).uSbRimMul.value = rim * shut * shut;
      (m.userData.sb as { uSbAmbMul: { value: number } }).uSbAmbMul.value = 1 - 0.75 * open;
      (m.userData.glow as GlowUniforms).uGlowMul.value = shut;
    }
    // swung into the dark, the leaf darkens and its iron goes matte (no glint off the straps)
    mats.doorWood.color.set('#4e464f').multiplyScalar(1 - 0.6 * open);
    mats.doorIron.color.set('#1e1f24').multiplyScalar(1 - 0.6 * open);
    mats.doorIron.metalness = 0.55 * shut;
    mats.doorIron.roughness = 0.45 + 0.5 * open;
  }, [mats, paperMats, k, open]);
  const yaw = LAND.house.yaw ?? 0;
  const pos = new Vector3().setFromMatrixPosition(HF);
  const halo = WALL_LANTERN.clone().add(new Vector3(0, 0.0, 0.16));
  return (
    <group position={pos} rotation-y={yaw}>
      {/* the room, the door and its reveal draw first; the dig cap then hides any ground inside */}
      {/* the room also casts the moon's shadow: the house's walls are single sheets facing out, and a
          sheet facing the moon casts nothing (three renders back faces into the shadow map) */}
      <mesh geometry={geos.room} material={mats.room} renderOrder={-2} castShadow />
      <mesh material={mats.roomBack} position={[(ROOM.x0 + ROOM.x1) / 2, ROOM.h / 2, ROOM.z0 + 0.002]} renderOrder={-2} castShadow>
        <planeGeometry args={[ROOM.x1 - ROOM.x0, ROOM.h]} />
      </mesh>
      <mesh geometry={geos.reveal} material={mats.stones} renderOrder={-2} receiveShadow />
      <mesh geometry={geos.cap} material={mats.cap} renderOrder={-1} />
      <mesh geometry={geos.walls} material={mats.walls} castShadow receiveShadow />
      <mesh geometry={geos.stones} material={mats.stones} castShadow receiveShadow />
      <mesh geometry={geos.roof} material={mats.roof} castShadow receiveShadow />
      <mesh geometry={geos.wood} material={mats.wood} castShadow receiveShadow />
      <mesh geometry={geos.iron} material={mats.iron} castShadow />
      <mesh geometry={geos.glass} material={mats.glass} />
      <mesh geometry={geos.lanternGlass} material={mats.lanternGlass} />
      <mesh geometry={geos.eyes} material={mats.eyes} />
      <mesh geometry={geos.paper} material={mats.paper} castShadow />
      <mesh geometry={geos.gold} material={mats.gold} />
      <mesh geometry={geos.decal} material={mats.decal} renderOrder={1} />
      <sprite material={mats.halo} position={[halo.x, halo.y, halo.z]} scale={[0.62, 0.62, 1]} renderOrder={4} />
      <mesh geometry={paperGeos.upper} material={paperMats[1]} receiveShadow />
      <mesh geometry={paperGeos.lower} material={paperMats[2]} receiveShadow />
      <mesh geometry={paperGeos.hengpi} material={paperMats[3]} receiveShadow />
      {/* the door on its hinge (the left jamb) */}
      <group position={HINGE as unknown as [number, number, number]} rotation-y={open * ((100 * Math.PI) / 180)}>
        <group position-z={LEAF_T}>
          <mesh geometry={geos.doorWood} material={mats.doorWood} renderOrder={-2} castShadow receiveShadow />
          <mesh geometry={geos.doorIron} material={mats.doorIron} renderOrder={-2} castShadow />
          <mesh geometry={paperGeos.fu} material={paperMats[0]} renderOrder={-2} receiveShadow />
        </group>
      </group>
    </group>
  );
}

// ---- the far window house ------------------------------------------------------------------

const FAR: Gable = { x0: -0.42, x1: 0.42, z0: -0.38, z1: 0.3, eave: 0.62, peak: 1.18, ridge: 'z', overhang: 0.07, verge: 0.07 };
const FAR_WINDOW: Opening = { u: 0.02, y: 0.18, w: 0.3, h: 0.4, arch: 0.55 };

function farFrame(): Matrix4 {
  const s = LAND.farWindow;
  const p = onGround(s.x, s.z, 0);
  return new Matrix4().makeRotationY(s.yaw ?? 0).setPosition(p[0], p[1], p[2]);
}

function buildFarHouse(): { walls: BufferGeometry; stones: BufferGeometry; roof: BufferGeometry; wood: BufferGeometry; glass: BufferGeometry } {
  const frame = farFrame();
  const walls = new Builder();
  const stones = new Builder();
  const roof = new Builder();
  const wood = new Builder();
  const glass = new Builder();
  const g = FAR;
  const B = -0.35;
  const xc = (g.x0 + g.x1) / 2;
  const zc = (g.z0 + g.z1) / 2;
  const ws: Wall[] = [
    { o: [0, 0, g.z1], u: [1, 0, 0], outline: [[g.x0, B], [g.x1, B], [g.x1, g.eave], [xc, g.peak], [g.x0, g.eave]], openings: [FAR_WINDOW] },
    { o: [g.x1, 0, 0], u: [0, 0, -1], outline: [[-g.z1, B], [-g.z0, B], [-g.z0, g.eave], [-g.z1, g.eave]] },
    { o: [g.x0, 0, 0], u: [0, 0, 1], outline: [[g.z0, B], [g.z1, B], [g.z1, g.eave], [g.z0, g.eave]] },
    { o: [0, 0, g.z0], u: [-1, 0, 0], outline: [[-g.x1, B], [-g.x0, B], [-g.x0, g.eave], [-xc, g.peak], [-g.x1, g.eave]] },
  ];
  ws.forEach((w, i) => {
    buildWall(walls, stones, w, 300 + i * 7, g.eave, frame);
    for (const o of w.openings ?? []) surround(stones, w, o, 310 + i, 0.04, 0.02);
  });
  quoins(stones, [g.x0, 0, g.z1], [1, 0, 0], [0, 0, -1], -0.25, g.eave, 330, 0.13, 0.08);
  quoins(stones, [g.x1, 0, g.z1], [-1, 0, 0], [0, 0, -1], -0.25, g.eave, 331, 0.13, 0.08);
  roofTiles(roof, wood, g, 9, { tileW: 0.15, exposure: 0.1, thickness: 0.016 });
  bargeboards(wood, g);
  const { ridge } = gablePlanes(g);
  ridgeCap(ridge[0], ridge[1], { seed: 340, radius: 0.035, piece: 0.13 }, roof);
  // the window: glass, mullion and transom, the glow canvas
  {
    const M = wallMatrix(ws[0]);
    const ol = openingOutline(FAR_WINDOW, 8);
    const pts = ol.map(([u, y]) => new Vector3(u, y, -0.06).applyMatrix4(M));
    const o0 = FAR_WINDOW;
    const uvs = ol.map(([u, y]) => [(u - o0.u + o0.w / 2) / o0.w, (y - o0.y) / o0.h] as const);
    const ctr = new Vector3(FAR_WINDOW.u, FAR_WINDOW.y + FAR_WINDOW.h * 0.4, -0.06).applyMatrix4(M);
    for (let i = 0; i < pts.length; i++) glass.tri(ctr, pts[i], pts[(i + 1) % pts.length], [1, 1, 1, 0], [[0.5, 0.4], uvs[i], uvs[(i + 1) % pts.length]]);
    const n = new Vector3(0, 0, 1);
    const col: RGBA = [0.8, 0.78, 0.78, 0.3];
    const o = FAR_WINDOW;
    beam(wood, new Vector3(o.u, o.y, -0.045), new Vector3(o.u, o.y + o.h - 0.01, -0.045), 0.02, 0.024, n, col);
    beam(wood, new Vector3(o.u - o.w / 2, o.y + o.h * 0.48, -0.045), new Vector3(o.u + o.w / 2, o.y + o.h * 0.48, -0.045), 0.018, 0.024, n, col);
  }
  // a chimney on the back slope
  {
    cutStone(stones, new Matrix4().makeTranslation(g.x1 - 0.18, 0.95 + 0.2, zc - 0.18).multiply(new Matrix4().makeRotationZ(0.06)), [0.07, 0.25, 0.07], 0.012, 350, [0.85, 0.82, 0.8, 0.8], 0.5);
  }
  for (const b of [walls, stones, roof, wood, glass])
    b.warp((p) => {
      const h = smoothstep(0.5, 1.2, p.y);
      p.x += 0.05 * h * h;
      p.y -= 0.02 * h * Math.sin(Math.PI * clamp((p.z - g.z0) / (g.z1 - g.z0), 0, 1));
    });
  return { walls: walls.geometry(), stones: stones.geometry(), roof: roof.geometry(), wood: wood.geometry(), glass: glass.geometry() };
}

/** The far house down the lane (LAND.farWindow): one big window, warm, flipping cold (`cold` 0..1). */
export function FarHouse({ cold = 0 }: { cold?: number }) {
  const geos = useMemo(buildFarHouse, []);
  const glowTex = useMemo(() => {
    const t = new CanvasTexture(windowGlowCanvas());
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);
  const wallTex = useMemo(() => masonryTextures(), []);
  const mats = useMemo(
    () => ({
      walls: storybookMaterial({ kind: 'stone', color: '#ffffff', color2: '#4a4250', map: wallTex.map, bumpMap: wallTex.bump, bumpScale: 2.0, breakup: 0.16, scale: 0.22, bump: 0.5, topCoat: 0.2, vertexColors: true, rim: 0.9 }),
      stones: storybookMaterial({ kind: 'stone', color: '#868995', color2: '#5b5e6a', breakup: 0.32, scale: 0.07, bump: 1.1, topCoat: 0.2, vertexColors: true, rim: 0.8 }),
      roof: storybookMaterial({ kind: 'stone', color: '#676d80', color2: '#474b5c', breakup: 0.22, scale: 0.07, bump: 0.55, vertexColors: true, rim: 1.2, roughness: 0.7 }),
      wood: storybookMaterial({ kind: 'wood', color: '#5a4447', color2: '#3a2a2e', breakup: 0.3, scale: 0.1, bump: 0.8, vertexColors: true, rim: 0.7 }),
      glass: storybookMaterial({ color: '#05080a', emissive: '#ffb45a', emissiveMap: glowTex, emissiveIntensity: 2.6, roughness: 0.25, fog: 0.5, rim: 0, ambient: 0, breakup: 0 }),
    }),
    [glowTex, wallTex],
  );
  useLayoutEffect(() => () => (Object.values(geos).forEach((g) => g.dispose()), Object.values(mats).forEach((m) => m.dispose()), glowTex.dispose(), wallTex.map.dispose(), wallTex.bump.dispose()), [geos, mats, glowTex, wallTex]);
  useLayoutEffect(() => {
    const k = clamp(cold, 0, 1);
    (mats.glass as MeshStandardMaterial).emissive.copy(WARM).lerp(COLD, k);
  }, [mats, cold]);
  const frame = useMemo(farFrame, []);
  const pos = new Vector3().setFromMatrixPosition(frame);
  return (
    <group position={pos} rotation-y={LAND.farWindow.yaw ?? 0}>
      <mesh geometry={geos.walls} material={mats.walls} castShadow receiveShadow />
      <mesh geometry={geos.stones} material={mats.stones} castShadow receiveShadow />
      <mesh geometry={geos.roof} material={mats.roof} castShadow receiveShadow />
      <mesh geometry={geos.wood} material={mats.wood} castShadow />
      <mesh geometry={geos.glass} material={mats.glass} />
    </group>
  );
}
const WARM = new Color('#ffb45a');
const COLD = new Color('#8fe6ff');

/** Triangle counts per part (for the budget). */
export function houseStats(): Record<string, number> {
  const g = buildHouse();
  const s = g.stats;
  Object.values(g).forEach((x) => (x instanceof BufferGeometry ? x.dispose() : null));
  return s;
}

/** Triangle counts per part of the far house (for the budget). */
export function farHouseStats(): Record<string, number> {
  const g = buildFarHouse();
  const s: Record<string, number> = {};
  for (const [k, v] of Object.entries(g)) {
    s[k] = (v.index ? v.index.count : v.attributes.position.count) / 3;
    v.dispose();
  }
  return s;
}
