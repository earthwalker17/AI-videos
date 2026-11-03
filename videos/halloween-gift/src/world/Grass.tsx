/**
 * Moonlit grass in clumps: real blade meshes (no alpha cards, so no overdraw or shimmering
 * cut-outs) gathered into tufts of 6-8 blades, in four kinds (short turf, mid turf, tall
 * unkempt grass, dead straw-pale tufts), instanced, and scattered once with hashed randomness:
 * short and sparse along the dirt track's ragged edge, tall and unkempt at the fence, around
 * the stones, the rocks and the trees, straw patches here and there, bare earth patches left
 * open, never on the track, the page margin, the stones or the rocks.
 *
 * The moon is low and behind the world: every blade's normal turns from facing the viewer at
 * the root to facing up and toward the moon at the tip, so tips catch the moon and the rim
 * light while roots stay dark (vertex colour darkens them too). Blades face the viewer's side
 * (every shot looks roughly toward −z), so they are single-sided.
 *
 * Density falls with distance from the hero camera (tufts grow wider instead), so the far hill
 * keeps its cover without sub-pixel blades that shimmer. Tufts sway with a frame-driven wind in
 * the storybook material, one phase per tuft. Split into tiles so off-screen tiles cull.
 * `grow` raises the grass with the terrain.
 */
import { rand, smoothstep } from '@aiv/core';
import { useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, FrontSide, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { bump } from '../kit/field.ts';
import { storybookMaterial } from '../look/materials.ts';
import { BOULDERS, rootGrass, ROOTS_FOOTPRINT } from './Dressing.tsx';
import { FLOOR, LAND, PAGE, pageMask, STONES } from './layout.ts';
import { bareMask, fbm, fenceDistance, ground, groundShading, surfaceHeight, trackAt, turfColor, TURF_SHEEN, turfSweep, yardMask } from './Terrain.tsx';

/** The hero camera (layout of the reference's view): grass density is planned around it. */
const HERO_EYE = new Vector3(0.3, 3.45, 7.6);
/** horizontal direction toward the moon (NIGHT.uSbMoonDir without its height) */
const MOONWARD = new Vector3(0.494, 0, -0.863).normalize();
/** the moon lifted toward the sky: what lights the turf's slopes */
const LIGHT = new Vector3(0.494, 0.6, -0.863).normalize();

type Kind = 'short' | 'mid' | 'mid2' | 'tall' | 'straw' | 'far' | 'far2';
const KINDS: Kind[] = ['short', 'mid', 'mid2', 'tall', 'straw', 'far', 'far2'];

interface KindSpec {
  blades: number;
  /** segments per blade */
  seg: number;
  h: [number, number];
  w: [number, number];
  spread: number;
  lean: [number, number];
  bend: [number, number];
  /** blade shade variation (vertex colour), and the root's darkness */
  shade: [number, number];
  root: number;
  /** how much the root's normal faces up (the sky light), and how much the tips turn to the moon */
  rootUp?: number;
  moon?: [number, number];
  /** combed: every blade lies over to the same side (radians, toward the tip), as wind-combed turf */
  comb?: [number, number];
  /** brightness of the blade at its root and tip (vertex colour ramp) */
  ramp?: [number, number];
  /** sway: scales aWind (0 still .. 1) */
  sway?: number;
  /** fraction of blades lying over, broken (random yaw, nearly flat) */
  lying?: number;
}

const SPEC: Record<Kind, KindSpec> = {
  short: { blades: 7, seg: 2, h: [0.035, 0.08], w: [0.008, 0.011], spread: 0.03, lean: [0.05, 0.35], bend: [0.2, 0.6], shade: [0.75, 1.1], root: 0.35, ramp: [0.3, 0.9], sway: 0.6 },
  mid: { blades: 8, seg: 2, h: [0.07, 0.15], w: [0.009, 0.013], spread: 0.04, lean: [0.05, 0.4], bend: [0.3, 0.8], shade: [0.7, 1.15], root: 0.3, ramp: [0.3, 0.9], sway: 0.6, comb: [-0.2, 0.5] },
  mid2: { blades: 8, seg: 2, h: [0.07, 0.15], w: [0.009, 0.013], spread: 0.045, lean: [0.05, 0.4], bend: [0.3, 0.8], shade: [0.7, 1.15], root: 0.3, ramp: [0.3, 0.9], sway: 0.6, comb: [-0.6, 0.1] },
  // tall unkempt grass: tips that only glint (no silver flames), a few blades broken over
  tall: { blades: 9, seg: 3, h: [0.12, 0.3], w: [0.008, 0.012], spread: 0.06, lean: [0.1, 0.6], bend: [0.4, 1.3], shade: [0.6, 1.15], root: 0.35, rootUp: 0.9, moon: [0.08, 0.35], ramp: [0.42, 0.85], sway: 1, lying: 0.12 },
  // dead straw: pale, bent and broken, a fifth of it lying flat
  straw: { blades: 8, seg: 3, h: [0.08, 0.22], w: [0.007, 0.01], spread: 0.06, lean: [0.25, 1.0], bend: [0.5, 1.6], shade: [0.75, 1.2], root: 0.45, rootUp: 0.9, moon: [0.08, 0.35], ramp: [0.45, 0.85], sway: 0.8, lying: 0.22 },
  // the far hill: upright strokes lit like the turf under them (no dark roots); they fade into
  // the turf with distance (groundShading fade), two combs so no tuft repeats like a stamp
  far: { blades: 5, seg: 2, h: [0.05, 0.13], w: [0.006, 0.009], spread: 0.04, lean: [0.03, 0.15], bend: [0.1, 0.35], shade: [0.9, 1.05], root: 0.9, rootUp: 2.2, moon: [0.03, 0.2], comb: [0.1, 0.45], ramp: [0.65, 0.9], sway: 0.25 },
  far2: { blades: 4, seg: 2, h: [0.04, 0.11], w: [0.007, 0.01], spread: 0.04, lean: [0.03, 0.18], bend: [0.1, 0.4], shade: [0.9, 1.05], root: 0.9, rootUp: 2.2, moon: [0.03, 0.2], comb: [-0.45, -0.1], ramp: [0.65, 0.9], sway: 0.25 },
};

/** One tuft of blades (root at the origin, about 1 unit of height scale), position/normal/color/aWind. */
function tuftGeometry(kind: Kind, seed: number): BufferGeometry {
  const sp = SPEC[kind];
  const SEG = sp.seg;
  let k = 0;
  const r = () => rand(seed, kind, k++);
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const wind: number[] = [];
  const idx: number[] = [];
  const up = new Vector3(0, 1, 0);
  for (let b = 0; b < sp.blades; b++) {
    // a broken blade lying over: any direction, nearly flat
    const lying = r() < (sp.lying ?? 0);
    // the blade faces the viewer's side (±50°), fans out from a small clump
    const phi = lying ? (r() - 0.5) * 2.6 : (r() - 0.5) * 1.2;
    const face = new Vector3(Math.sin(phi), 0, Math.cos(phi));
    const side = new Vector3(Math.cos(phi), 0, -Math.sin(phi));
    const ra = r() * Math.PI * 2;
    const rr = Math.sqrt(r()) * sp.spread;
    const root = new Vector3(Math.cos(ra) * rr, 0, Math.sin(ra) * rr);
    const h = sp.h[0] + (sp.h[1] - sp.h[0]) * r() ** 0.8;
    const w = sp.w[0] + (sp.w[1] - sp.w[0]) * r();
    // lean and bend over, toward the viewer or away, and outward from the clump's centre
    const dirSign = r() < 0.6 ? 1 : -1;
    const lean = lying ? (1.1 + 0.3 * r()) * dirSign : (sp.lean[0] + (sp.lean[1] - sp.lean[0]) * r()) * dirSign;
    const bend = lying ? 0.25 * r() * dirSign : (sp.bend[0] + (sp.bend[1] - sp.bend[0]) * r()) * dirSign;
    const out = new Vector3(Math.cos(ra), 0, Math.sin(ra)).multiplyScalar(0.15);
    const shade = sp.shade[0] + (sp.shade[1] - sp.shade[0]) * r();
    const comb = sp.comb ? sp.comb[0] + (sp.comb[1] - sp.comb[0]) * r() : 0;
    // a little hue drift per blade: cooler or warmer
    const warm = (r() - 0.5) * 0.16;
    // the tip's normal: up and toward the moon (behind), so the tip catches the rim light
    // how much this blade's tip turns to the moon: some catch it, most only a little
    const mr = sp.moon ?? [0.25, 0.7];
    const catchMoon = mr[0] + (mr[1] - mr[0]) * r() ** 1.5;
    const tipN = new Vector3().copy(up).multiplyScalar(0.8).addScaledVector(MOONWARD, catchMoon).addScaledVector(face, 0.2).normalize();
    const rootN = new Vector3().copy(face).addScaledVector(up, sp.rootUp ?? 0.6).normalize();
    const base = pos.length / 3;
    const p = root.clone();
    const sub = 4;
    let row = 0;
    const d = new Vector3(0, 1, 0);
    const across = new Vector3();
    for (let i = 0; i <= SEG * sub; i++) {
      const t = i / (SEG * sub);
      if (i % sub === 0) {
        // a strap that keeps its width, then a short pointed tip
        const wt = w * (1 - 0.35 * t) * Math.min(1, (1 - t) * 3.2) + 0.0004;
        const n = rootN.clone().lerp(tipN, Math.pow(t, 0.9)).normalize();
        const ramp = sp.ramp ?? [0.22, 0.95];
        const s = ramp[0] + (ramp[1] - ramp[0]) * Math.pow(t, 0.8);
        const cR = shade * s * (1 + warm);
        const cG = shade * s;
        const cB = shade * s * (1 - warm * 0.6);
        const shadeRoot = sp.root + (1 - sp.root) * Math.min(1, t * 1.8);
        // across the blade: perpendicular to its direction, in its face
        across.crossVectors(d, face).normalize();
        for (const sgn of [-1, 1]) {
          pos.push(p.x + across.x * wt * 0.5 * sgn, p.y + across.y * wt * 0.5 * sgn, p.z + across.z * wt * 0.5 * sgn);
          nor.push(n.x, n.y, n.z);
          col.push(cR * shadeRoot, cG * shadeRoot, cB * shadeRoot);
          wind.push(t * (sp.sway ?? 1));
        }
        if (row > 0) {
          const a = base + (row - 1) * 2;
          // counter-clockwise seen from the face direction (front face toward the viewer)
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        row++;
      }
      if (i < SEG * sub) {
        const theta = lean + bend * t;
        const tc = comb * Math.pow(t + 0.5 / (SEG * sub), 0.7);
        const dh = h / (SEG * sub);
        d.set(Math.sin(theta) * face.x + out.x * Math.abs(Math.sin(theta)) * 0.5, Math.cos(theta), Math.sin(theta) * face.z + out.z * Math.abs(Math.sin(theta)) * 0.5).normalize();
        if (tc !== 0) d.multiplyScalar(Math.cos(tc)).addScaledVector(side, Math.sin(tc)).normalize();
        p.addScaledVector(d, dh);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('aWind', new BufferAttribute(new Float32Array(wind), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

interface Tuft {
  x: number;
  z: number;
  kind: number;
  m: Matrix4;
  c: Color;
}

const TEAL = new Color('#5a8b96');
const TEAL_DARK = new Color('#335762');
const OLIVE = new Color('#62766b');
const STRAW = new Color('#8b8670');
/** the hill's grass, catching the moon and the fog's glow */
const HILL = new Color('#78a9b3');
const STRAW_DARK = new Color('#6a6656');

/** Beyond this distance from the hero camera the far hill has no blades (the turf carries it). */
const FAR_MAX = 11.5;

/** Where grass may grow, and how it grows there. */
function site(x: number, z: number) {
  const pm = pageMask(x, z);
  if (pm < 0.15) return null;
  const tr = trackAt(x, z);
  if (tr.m > 0.55) return null;
  let d = pm;
  // ragged, thinning toward the track
  const nearTrack = 1 - Math.min(1, Math.max(0, tr.edge) / 0.25);
  d *= 1 - 0.55 * nearTrack;
  // clumps and gaps
  d *= Math.min(1, Math.max(0, 0.55 + 0.9 * fbm(x, z, 71, 3, 1.9)));
  // bare earth: a sparse short stubble, not a smooth patch
  const bare = bareMask(x, z, tr);
  d *= 1 - 0.8 * bare;
  // stones: none on the footprint, tall around it
  let stoneRing = 0;
  for (const s of STONES) {
    const dd = Math.hypot(x - s.x, z - s.z);
    if (dd < 0.13 + s.h * 0.08) return null;
    stoneRing = Math.max(stoneRing, bump(x, z, s.x, s.z, 0.42));
  }
  for (const b of BOULDERS) {
    const dd = Math.hypot(x - b.x, z - b.z);
    if (dd < b.r * 0.92) return null;
    stoneRing = Math.max(stoneRing, bump(x, z, b.x, b.z, b.r * 1.9));
  }
  if (Math.hypot(x - ROOTS_FOOTPRINT.x, z - ROOTS_FOOTPRINT.z) < ROOTS_FOOTPRINT.r) return null;
  if (Math.hypot(x - LAND.house.x, z - LAND.house.z) < 1.0) return null;
  for (const t of [LAND.ghostTree, LAND.oldTree]) {
    const dd = Math.hypot(x - t.x, z - t.z);
    if (dd < 0.22) return null;
    stoneRing = Math.max(stoneRing, bump(x, z, t.x, t.z, 0.9));
  }
  const fence = 1 - Math.min(1, fenceDistance(x, z) / 0.35);
  const margin = 1 - pm;
  // tall grass grows in clumps (a low noise), not as an even hedge
  const clump = smoothKnee(0.45 + 1.3 * fbm(x, z, 75, 2, 2.4));
  const unkempt = Math.max(fence, stoneRing * 0.9, margin * 0.8, smoothKnee(fbm(x, z, 72, 2, 0.7)) * 0.5) * (0.35 + 0.65 * clump);
  const yard = yardMask(x, z);
  const strawy = (1 - yard) * Math.max(smoothKnee(fbm(x, z, 73, 3, 1.4) * 1.3 - 0.2), nearTrack * 0.4, fence * 0.3);
  return { d, nearTrack, unkempt: unkempt * (1 - yard), strawy, tr, yard, bare, clump };
}
const smoothKnee = (v: number) => Math.max(0, Math.min(1, v));

function scatter(cell: number, densityScale: number): Tuft[] {
  const out: Tuft[] = [];
  const q = new Quaternion();
  const tilt = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const ax = new Vector3(1, 0, 0);
  const nx = Math.floor(PAGE.w / cell);
  const nz = Math.floor(PAGE.d / cell);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = -PAGE.w / 2 + (i + rand(5, i, j * 2)) * cell;
      const z = -PAGE.d / 2 + (j + rand(5, i, j * 2 + 1)) * cell;
      // fewer tufts far from the hero camera (they grow wider instead)
      const dist = Math.hypot(x - HERO_EYE.x, z - HERO_EYE.z);
      // the hill's top, seen against the sky from the hero view: a dense, moonlit fringe
      const crest = smoothstep(-1.4, -3.2, z);
      const far = Math.min(1, Math.max(0.4 + 0.22 * crest, (6.0 / dist) ** 1.1));
      // denser in the foreground (the turf between tufts must not read as bare snow)
      if (rand(6, i, j) > (0.58 + 0.14 * smoothstep(1.8, 3.6, z)) * far * densityScale) continue;
      const st = site(x, z);
      if (!st || rand(6, i, j + 7777) > st.d) continue;
      // the kind: short and sparse by the track and on bare earth, tall and unkempt at fences and stones, straw patches
      const kr = rand(12, i, j);
      let kind: Kind = kr < 0.25 ? 'short' : rand(18, i, j) < 0.5 ? 'mid' : 'mid2';
      if (st.unkempt > 0.3 && rand(13, i, j) < st.unkempt) kind = 'tall';
      if ((st.nearTrack > 0.4 && rand(14, i, j) < 0.7) || st.bare > 0.4) kind = 'short';
      if (rand(15, i, j) < st.strawy * 0.75) kind = 'straw';
      // the far hill (the hero view's middle distance and its crest): light strokes in two combs;
      // past FAR_MAX nothing (the turf's own colour carries it, no sub-pixel blades)
      const isFar = (kind === 'short' || kind === 'mid' || kind === 'mid2') && rand(17, i, j) < Math.max(smoothstep(7.4, 9.8, dist), crest);
      if (isFar) {
        // and only in loose patches: the turf between them carries the hill
        if (dist > FAR_MAX || rand(21, i, j) > 0.35 + 0.65 * smoothKnee(0.5 + 1.4 * fbm(x, z, 77, 2, 0.9))) continue;
        kind = rand(19, i, j) < 0.5 ? 'far' : 'far2';
      }
      if (st.yard > 0.5) kind = 'short';
      const h = surfaceHeight(x, z, st.tr);
      let hs = (0.75 + 0.5 * rand(7, i, j)) * (1 + 0.35 * st.unkempt) * (1 - 0.45 * st.nearTrack) * (1 - 0.4 * st.yard) * (1 - 0.35 * st.bare);
      // tall and straw grass: heights vary in low patches (0.5..1.3)
      if (kind === 'tall' || kind === 'straw') hs *= 0.5 + 0.8 * smoothKnee(0.5 + 0.9 * fbm(x, z, 76, 2, 1.7)) * (0.6 + 0.4 * st.clump);
      if (kind === 'straw' && st.nearTrack > 0.3) hs *= 0.8;
      const wide = Math.min(1.3, far ** -0.3);
      const yaw = (rand(8, i, j) - 0.5) * 0.9;
      q.setFromAxisAngle(up, yaw);
      tilt.setFromAxisAngle(ax, (rand(9, i, j) - 0.5) * 0.3);
      q.multiply(tilt);
      const s = 0.85 + 0.3 * rand(10, i, j);
      const m = new Matrix4().compose(new Vector3(x, h - 0.006, z), q, new Vector3(s * wide, hs / 1, s * wide));
      const c = new Color();
      if (kind === 'straw') c.copy(STRAW_DARK).lerp(STRAW, rand(11, i, j));
      else c.copy(TEAL_DARK).lerp(TEAL, 0.35 + 0.65 * rand(11, i, j)).lerp(OLIVE, Math.max(0, fbm(x, z, 74, 2, 1.1)) * 0.8);
      if (kind !== 'straw') c.lerp(HILL, 0.45 * smoothstep(1.2, -1.2, z));
      // the far hill's strokes take the turf's own colour (a little lighter): no tuft reads as a stamp
      if (kind === 'far' || kind === 'far2') turfColor(x, z, ground(x, z), 0, c).multiplyScalar(1.05 + 0.1 * rand(11, i, j));
      // the slope's light: lighter where the turf turns up toward the moon and the sky, darker where it faces the viewer
      const e = 0.12;
      const gx = (ground(x + e, z) - ground(x - e, z)) / (2 * e);
      const gz = (ground(x, z + e) - ground(x, z - e)) / (2 * e);
      const lit = (-gx * LIGHT.x + LIGHT.y - gz * LIGHT.z) / Math.hypot(gx, 1, gz);
      // the turf's long sweeps of light and dark (Terrain), so blades and turf move together
      const sweep = Math.max(0.6, 1 + 0.25 * turfSweep(x, z));
      c.multiplyScalar((0.8 + 0.35 * rand(16, i, j)) * (1 + 0.2 * crest) * (0.55 + 1.0 * (lit - 0.25)) * sweep);
      out.push({ x, z, kind: KINDS.indexOf(kind), m, c });
    }
  // tufts of straw and tall grass on top of the root mass's roots (Dressing)
  rootGrass().forEach((g, k) => {
    const kind: Kind = rand(20, k, 0) < 0.55 ? 'straw' : 'tall';
    q.setFromAxisAngle(up, (rand(20, k, 1) - 0.5) * 1.2);
    tilt.setFromAxisAngle(ax, (rand(20, k, 2) - 0.5) * 0.5);
    q.multiply(tilt);
    const sc = g.s * (0.8 + 0.4 * rand(20, k, 3));
    const m = new Matrix4().compose(new Vector3(g.x, g.y - FLOOR - 0.004 - 0.004, g.z), q, new Vector3(sc, sc * (0.6 + 0.5 * rand(20, k, 4)), sc));
    const c = kind === 'straw' ? STRAW_DARK.clone().lerp(STRAW, rand(20, k, 5)).multiplyScalar(0.75) : TEAL_DARK.clone().lerp(TEAL, rand(20, k, 5)).multiplyScalar(0.8);
    out.push({ x: g.x, z: g.z, kind: KINDS.indexOf(kind), m, c });
  });
  return out;
}

export function Grass({ grow = 1, cell = 0.062, density = 1, tiles = 2 }: { grow?: number; cell?: number; density?: number; tiles?: number }) {
  const { meshes, geometries, material } = useMemo(() => {
    const geometries = KINDS.map((k, i) => tuftGeometry(k, 40 + i));
    // the turf's sheen (Terrain), so blades and turf glow together; blades fade into the turf with distance
    const material = groundShading(storybookMaterial({ kind: 'grass', vertexColors: true, side: FrontSide, roughness: 0.8, breakup: 0.1, scale: 0.6, rim: 0.45, wind: 0.03 }), { sheen: TURF_SHEEN, fade: [5, 11] });
    const tufts = scatter(cell, density);
    // tiles over the page so off-screen ones cull, one instanced mesh per kind and tile
    const buckets: Tuft[][] = Array.from({ length: tiles * tiles * KINDS.length }, () => []);
    for (const t of tufts) {
      const ti = Math.min(tiles - 1, Math.floor(((t.x + PAGE.w / 2) / PAGE.w) * tiles));
      const tj = Math.min(tiles - 1, Math.floor(((t.z + PAGE.d / 2) / PAGE.d) * tiles));
      buckets[(tj * tiles + ti) * KINDS.length + t.kind].push(t);
    }
    const meshes: InstancedMesh[] = [];
    buckets.forEach((bucket, bi) => {
      if (!bucket.length) return;
      const m = new InstancedMesh(geometries[bi % KINDS.length], material, bucket.length);
      bucket.forEach((b, k) => {
        m.setMatrixAt(k, b.m);
        m.setColorAt(k, b.c);
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      m.receiveShadow = true;
      m.castShadow = false;
      meshes.push(m);
    });
    return { meshes, geometries, material };
  }, [cell, density, tiles]);
  useLayoutEffect(
    () => () => {
      meshes.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
      material.dispose();
    },
    [meshes, geometries, material],
  );
  return (
    <group position-y={FLOOR + 0.004} scale-y={Math.max(0.001, grow)} visible={grow > 0.02}>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}

/** Diagnostics: how many tufts of each kind, and triangles in all. */
export function grassStats(cell = 0.062, density = 1): { tufts: number[]; triangles: number } {
  const tufts = scatter(cell, density);
  const counts = KINDS.map((_, i) => tufts.filter((t) => t.kind === i).length);
  const tris = KINDS.map((k) => SPEC[k].blades * SPEC[k].seg * 2);
  return { tufts: counts, triangles: counts.reduce((a, c, i) => a + c * tris[i], 0) };
}
